import os
import uuid
import asyncio
import numpy as np
import torch
import librosa
from scipy.io.wavfile import write
from loguru import logger
from dotenv import load_dotenv

from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.frames.frames import TextFrame, AudioRawFrame, Frame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.groq.llm import GroqLLMService
load_dotenv(override=True)

# --- Global State Management ---

class UserState:
    def __init__(self):
        self.name = "Guest"
        self.current_emotion = "neutral"

    def get_system_prompt(self):
        return (
            f"You are a helpful AI assistant. The user's name is {self.name}. "
            f"The user currently sounds {self.current_emotion}. "
            f"Adjust your tone and empathy level to match their emotional state appropriately."
        )

# Initialize shared state
user_state = UserState()

# --- Emotion Model Setup ---

logger.info("Loading Emotion Recognition Model...")
feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained("r-f/wav2vec-english-speech-emotion-recognition")
emotion_model = Wav2Vec2ForCTC.from_pretrained("r-f/wav2vec-english-speech-emotion-recognition")
emotion_model.eval() # Set to evaluation mode

# --- Custom Processor ---

class AudioEmotionClassifier(FrameProcessor):
    def __init__(self, sample_rate: int, seconds: int = 10, output_dir: str = "recordings"):
        super().__init__()
        self._sample_rate = sample_rate
        self._target_bytes = sample_rate * 2 * 1 * seconds
        self._buffer = bytearray()
        self._output_dir = output_dir

        if not os.path.exists(self._output_dir):
            os.makedirs(self._output_dir)


    async def _classify_emotion(self, audio_data: bytes):
        """Saves bytes to .wav, reads it for inference, and deletes it after."""
        file_id = str(uuid.uuid4())
        file_path = os.path.join(self._output_dir, f"{file_id}.wav")

        try:
            # 1. Save the raw bytes to a .wav file
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            write(file_path, self._sample_rate, audio_array)

            # 2. Use librosa to load exactly 16k mono
            speech, sr = librosa.load(file_path, sr=self._sample_rate)
            
            # 3. Preprocess with the feature extractor
            # Wav2Vec2 expects 1D input normalized to zero-mean unit-variance
            inputs = feature_extractor(speech, sampling_rate=sr, return_tensors="pt", padding=True)
            
            # 4. Perform Inference
            with torch.no_grad():
                logits = emotion_model(inputs.input_values).logits
            
            # 5. Decode the CTC labels
            # For emotion recognition, we calculate the probability across the entire sequence
            # and pick the class that has the highest average probability across all time steps.
            # This is safer than argmaxing individual frames which might be noise.
            probabilities = torch.nn.functional.softmax(logits, dim=-1)
            mean_probabilities = torch.mean(probabilities, dim=1) # Mean across time dimension
            predicted_label_id = torch.argmax(mean_probabilities, dim=-1).item()
            
            emotion = emotion_model.config.id2label[predicted_label_id]
            
            # 6. Update Global State
            user_state.current_emotion = emotion
            logger.info(f"Updated Emotion: {emotion} (Confidence: {torch.max(mean_probabilities).item():.2f})")

        except Exception as e:
            # If the error is 27, it often means the input audio was too short or empty
            logger.error(f"Inference Error on file {file_path}: {e}")
        
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)


    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, AudioRawFrame):
            self._buffer.extend(frame.audio)

            if len(self._buffer) >= self._target_bytes:
                chunk_to_process = bytes(self._buffer[:self._target_bytes])
                self._buffer = self._buffer[self._target_bytes:]
                # Run classification in background
                asyncio.create_task(self._classify_emotion(chunk_to_process))

        await self.push_frame(frame, direction)

# --- Main Bot Logic ---

async def run_bot(webrtc_connection):
    sample_rate = 16000

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_out_sample_rate=sample_rate,
            vad_analyzer=SileroVADAnalyzer(),
            audio_out_10ms_chunks=2,
        ),
    )

    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))
    tts = DeepgramTTSService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        voice="aura-asteria-en",
        sample_rate=sample_rate,
    )
    llm = GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.1-8b-instant"
    )

    # Note: We initialize context with the current prompt. 
    # To update it dynamically during a turn, we use a callback or update it before LLM processing.
    context = LLMContext([{"role": "system", "content": user_state.get_system_prompt()}])
    context_aggregator = LLMContextAggregatorPair(context)
    
    # Instance of our custom classifier
    emotion_analyzer = AudioEmotionClassifier(sample_rate=sample_rate, seconds=10)

    pipeline = Pipeline([
        transport.input(),     # Client Audio In
        emotion_analyzer,      # Analyze emotion in background
        stt,                   # Speech to Text
        context_aggregator.user(),
        llm,                   # LLM
        tts,                   # Text to Speech
        transport.output(),    # Client Audio Out
        context_aggregator.assistant(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_out_sample_rate=sample_rate,
            enable_metrics=True
        )
    )

    # --- Update System Prompt dynamically before each LLM turn ---
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected ✅")
        greeting_frame = TextFrame("Hello! I'm listening. How are you feeling today?")
        await task.queue_frames([greeting_frame])

    # This hook updates the system prompt right before the LLM generates a response
    @llm.event_handler("on_llm_response_start")
    async def on_llm_response_start(service, frame):
        new_prompt = user_state.get_system_prompt()
        context.set_system_instruction(new_prompt)
        logger.debug(f"LLM starting with prompt: {new_prompt}")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.warning("Client disconnected ❌")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)