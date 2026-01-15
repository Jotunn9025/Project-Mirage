import os
import asyncio
import numpy as np
import torch
from loguru import logger
from dotenv import load_dotenv

from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
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

from database import DatabaseManager

load_dotenv(override=True)

# --- Session-Based State Management ---

class UserState:
    def __init__(self, session_id: str, db: DatabaseManager, character_name: str, character_info: str, user_name: str):
        self.session_id = session_id
        self.db = db
        self.character_name = character_name
        self.character_info = character_info
        self.user_name = user_name
        self.current_emotion = "neutral"
        self.pending_emotion = "neutral"  # Emotion for next message
        
    def get_system_prompt(self):
        """Generate system prompt - character only, no emotion"""
        return (
            f"You are {self.character_name}. {self.character_info}\n"
            f"User's name: {self.user_name}\n"
            "Stay in character. Don't break character or reveal you are an AI.\n"
            "IMPORTANT: Be extremely concise (1-2 sentences max)."
        )

# --- WavLM Odyssey Model Setup ---
logger.info("Loading SER-Odyssey-Baseline-WavLM-Categorical...")
MODEL_ID = "3loi/SER-Odyssey-Baseline-WavLM-Categorical"

feature_extractor = AutoFeatureExtractor.from_pretrained("microsoft/wavlm-base-plus")
emotion_model = AutoModelForAudioClassification.from_pretrained(
    MODEL_ID, 
    trust_remote_code=True
)
emotion_model.eval()

device = "cuda" if torch.cuda.is_available() else "cpu"
emotion_model.to(device)

# --- Custom Processor ---

class AudioEmotionClassifier(FrameProcessor):
    def __init__(self, sample_rate: int, user_state: UserState):
        super().__init__()
        self._sample_rate = sample_rate
        self._buffer = bytearray()
        self._user_state = user_state

    async def _classify_emotion(self, audio_data: bytes):
        try:
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            non_silent = np.where(np.abs(audio_np) > 0.02)[0]
            if len(non_silent) < 4000: 
                return 
            audio_np = audio_np[non_silent[0]:non_silent[-1]]
            audio_np = audio_np / (np.max(np.abs(audio_np)) + 1e-6)

            inputs = feature_extractor(
                audio_np, 
                sampling_rate=self._sample_rate, 
                return_tensors="pt", 
                padding=True
            )
            
            with torch.no_grad():
                input_values = inputs.input_values.to(device)
                attention_mask = inputs.attention_mask.to(device)
                logits = emotion_model(input_values, mask=attention_mask)
                predictions = torch.nn.functional.softmax(logits, dim=-1)
                conf, index = torch.max(predictions[0], dim=-1)
                emotion = emotion_model.config.id2label[index.item()]
            
            if conf > 0.15:
                old_emotion = self._user_state.current_emotion
                self._user_state.pending_emotion = emotion.lower()
                logger.info(f"✨ Emotion detected: {emotion} ({conf*100:.1f}%) - Will attach to next message")

        except Exception as e:
            logger.error(f"WavLM Inference Error: {e}")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, AudioRawFrame):
            self._buffer.extend(frame.audio)
        
        if isinstance(frame, VADUserStoppedSpeakingFrame):
            data = bytes(self._buffer)
            self._buffer = bytearray()
            if data:
                asyncio.create_task(self._classify_emotion(data))
        await self.push_frame(frame, direction)


class EmotionAugmenter(FrameProcessor):
    """Augments user messages with emotion before sending to LLM"""
    def __init__(self, user_state: UserState):
        super().__init__()
        self._user_state = user_state
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        
        # Augment text frames going to the LLM
        if isinstance(frame, TextFrame) and direction == FrameDirection.DOWNSTREAM:
            emotion = self._user_state.pending_emotion
            confidence_note = "(high confidence)" if emotion != "neutral" else "(neutral/baseline)"
            
            augmented_message = {
                "message": frame.text,
                "emotion": f"{emotion} {confidence_note}. Don't point it out or mention unless overtly asked, just adjust your behavior to better handle it in accordance to your character"
            }
            
            # Update current emotion and reset pending
            self._user_state.current_emotion = emotion
            self._user_state.pending_emotion = "neutral"
            
            # Replace the text with augmented version
            frame.text = str(augmented_message)
            
            logger.info(f"📝 Augmented message with emotion: {emotion}")
        
        await self.push_frame(frame, direction)

# --- Main Bot Logic ---
async def run_bot(
    webrtc_connection, 
    session_id: str, 
    db: DatabaseManager,
    character_name: str = "Alfred The Butler",
    character_info: str = "Very Concise and Polite Gentleman. Always ready to serve.",
    user_name: str = "Guest"
):
    sample_rate = 16000
    
    # Create session-specific user state with provided parameters
    user_state = UserState(session_id, db, character_name, character_info, user_name)
    
    # Create session in database
    db.create_session(session_id, user_name, character_name, character_info)

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
    tts = DeepgramTTSService(
        api_key=os.getenv("DEEPGRAM_API_KEY"), 
        voice="aura-asteria-en", 
        sample_rate=sample_rate
    )
    llm = GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"), 
        model="llama-3.1-8b-instant"
    )

    # Initialize context with system prompt (character only, no emotion)
    context = LLMContext([{"role": "system", "content": user_state.get_system_prompt()}])
    context_aggregator = LLMContextAggregatorPair(context)
    
    # Emotion detection (updates pending_emotion)
    emotion_analyzer = AudioEmotionClassifier(
        sample_rate=sample_rate, 
        user_state=user_state
    )
    
    # Emotion augmentation (adds emotion to messages before LLM)
    emotion_augmenter = EmotionAugmenter(user_state)
    
    # Create a logging wrapper that properly captures messages
    class MessageLogger(FrameProcessor):
        def __init__(self):
            super().__init__()
            self._last_user_msg = None
            self._last_assistant_msg = None
        
        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            
            # Check for new messages periodically
            messages = context.get_messages()
            
            # Log user messages
            if messages and messages[-1]["role"] == "user":
                user_msg = messages[-1]["content"]
                if user_msg != self._last_user_msg:
                    self._last_user_msg = user_msg
                    db.add_message(
                        session_id,
                        "user",
                        user_msg,
                        user_state.current_emotion
                    )
                    logger.info(f"💾 Logged user message: {user_msg[:50]}...")
            
            # Log assistant messages
            if messages and messages[-1]["role"] == "assistant":
                assistant_msg = messages[-1]["content"]
                if assistant_msg != self._last_assistant_msg:
                    self._last_assistant_msg = assistant_msg
                    db.add_message(
                        session_id,
                        "assistant",
                        assistant_msg,
                        "neutral"
                    )
                    logger.info(f"💾 Logged assistant message: {assistant_msg[:50]}...")
                    
                    # Send updated history to client
                    history = db.get_history(session_id)
                    await transport.send_app_message({
                        "type": "history_update",
                        "history": history
                    })
            
            await self.push_frame(frame, direction)
    
    message_logger = MessageLogger()

    pipeline = Pipeline([
        transport.input(),
        emotion_analyzer,
        stt,
        emotion_augmenter,  # NEW: Augment messages with emotion
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
        message_logger,  # NEW: Log messages to database
    ])

    task = PipelineTask(pipeline, params=PipelineParams(audio_out_sample_rate=sample_rate))

    # --- EVENT HANDLERS ---

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client_data):
        await transport.send_app_message({
            "type": "status", 
            "msg": "Bot Linked!",
            "session_id": session_id
                        })
        logger.info(f"Client connected - Session: {session_id}")

    @transport.event_handler("on_app_message")
    async def on_app_message(transport, message):
        """Handle messages from client"""
        msg_type = message.get("type")
        
        if msg_type == "get_history":
            # Send full history from database
            history = db.get_history(session_id)
            await transport.send_app_message({
                "type": "history_response",
                "history": history
            })

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)