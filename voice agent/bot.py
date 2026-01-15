import os
import asyncio
import numpy as np
import torch
from loguru import logger
from dotenv import load_dotenv

from transformers import Wav2Vec2FeatureExtractor, WavLMForSequenceClassification
from pipecat.audio.vad.silero import SileroVADAnalyzer, VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.frames.frames import TextFrame, AudioRawFrame, Frame, VADUserStoppedSpeakingFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
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
            f"The user sounds {self.current_emotion}. "
            "IMPORTANT: Be extremely concise (1-2 sentences). "
            "Wait for the user to finish their thought before responding."
        )

user_state = UserState()

# --- WavLM Odyssey Model Setup ---

# Updated Imports
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

# --- WavLM Odyssey Model Setup ---
logger.info("Loading SER-Odyssey-Baseline-WavLM-Categorical...")
MODEL_ID = "3loi/SER-Odyssey-Baseline-WavLM-Categorical"

# Fix: Load the feature extractor from the base WavLM model
feature_extractor = AutoFeatureExtractor.from_pretrained("microsoft/wavlm-base-plus")

# Fix: Use AutoModel with trust_remote_code=True as required by this model
emotion_model = AutoModelForAudioClassification.from_pretrained(
    MODEL_ID, 
    trust_remote_code=True
)
emotion_model.eval()

device = "cuda" if torch.cuda.is_available() else "cpu"
emotion_model.to(device)

# --- Custom Processor ---

class AudioEmotionClassifier(FrameProcessor):
    def __init__(self, sample_rate: int):
        super().__init__()
        self._sample_rate = sample_rate
        self._buffer = bytearray()

    async def _classify_emotion(self, audio_data: bytes):
        try:
            # Convert to float32
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # 1. Trimming silence for accuracy
            non_silent = np.where(np.abs(audio_np) > 0.02)[0]
            if len(non_silent) < 4000: return 
            audio_np = audio_np[non_silent[0]:non_silent[-1]]

            # 2. Gain Normalization
            audio_np = audio_np / (np.max(np.abs(audio_np)) + 1e-6)

            # 3. Extract features AND attention mask
            inputs = feature_extractor(
                audio_np, 
                sampling_rate=self._sample_rate, 
                return_tensors="pt", 
                padding=True
            )
            
            with torch.no_grad():
                # Move both inputs to the correct device
                input_values = inputs.input_values.to(device)
                attention_mask = inputs.attention_mask.to(device)
                
                # FIX: Pass the mask explicitly to solve the 'missing 1 required positional argument' error
                logits = emotion_model(input_values, mask=attention_mask)
                
                # 4. Calculate predictions
                predictions = torch.nn.functional.softmax(logits, dim=-1)
                conf, index = torch.max(predictions[0], dim=-1)
                emotion = emotion_model.config.id2label[index.item()]
            
            # Only update state if confidence is valid
            if conf > 0.15:
                user_state.current_emotion = emotion.lower()
                logger.info(f"✨ Odyssey WavLM: {emotion} ({conf*100:.1f}%)")

        except Exception as e:
            logger.error(f"WavLM Inference Error: {e}")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, AudioRawFrame):
            self._buffer.extend(frame.audio)
        
        # Trigger analysis when VAD determines speech has ended
        if isinstance(frame, VADUserStoppedSpeakingFrame):
            data = bytes(self._buffer)
            self._buffer = bytearray()
            if data:
                asyncio.create_task(self._classify_emotion(data))
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
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=1.2)),
            audio_out_10ms_chunks=2,
        ),
    )

    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))
    tts = DeepgramTTSService(api_key=os.getenv("DEEPGRAM_API_KEY"), voice="aura-asteria-en", sample_rate=sample_rate)
    llm = GroqLLMService(api_key=os.getenv("GROQ_API_KEY"), model="llama-3.1-8b-instant")

    context = LLMContext([{"role": "system", "content": user_state.get_system_prompt()}])
    context_aggregator = LLMContextAggregatorPair(context)
    emotion_analyzer = AudioEmotionClassifier(sample_rate=sample_rate)

    pipeline = Pipeline([
        transport.input(),
        emotion_analyzer,
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(audio_out_sample_rate=sample_rate))

    @transport.event_handler("on_user_finished_speaking")
    async def on_user_finished_speaking(transport, transcript):
        # The AudioEmotionClassifier handles clearing the buffer via frames
        pass

    @llm.event_handler("on_llm_response_start")
    async def on_llm_response_start(service, frame):
        new_prompt = user_state.get_system_prompt()
        context.set_system_instruction(new_prompt)
        logger.debug(f"LLM instruction set to: {user_state.current_emotion}")

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)