import os
from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.frames.frames import TextFrame
# Deepgram / Ollama services
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.google.llm import GoogleLLMService
load_dotenv(override=True)




SYSTEM_INSTRUCTION = "You are a helpful AI assistant."

import os
import uuid
import asyncio
import numpy as np
from scipy.io.wavfile import write
from loguru import logger
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.frames.frames import AudioRawFrame, Frame

class AudioChunkRecorder(FrameProcessor):
    def __init__(self, sample_rate: int, seconds: int = 10, output_dir: str = "recordings"):
        super().__init__()
        self._sample_rate = sample_rate
        self._target_bytes = sample_rate * 2 * 1 * seconds
        self._buffer = bytearray()
        self._output_dir = output_dir

        if not os.path.exists(self._output_dir):
            os.makedirs(self._output_dir)

    async def _handle_transformers_task(self, audio_data: bytes):
        """Saves bytes to .wav and triggers background processing."""
        file_id = str(uuid.uuid4())
        file_path = os.path.join(self._output_dir, f"{file_id}.wav")

        try:
            # Convert raw bytes to NumPy array (16-bit PCM)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            
            # Write directly to .wav
            write(file_path, self._sample_rate, audio_array)
            
            logger.info(f"Chunk saved: {file_path}")
            
            # TODO: Add your transformers inference call here
        except Exception as e:
            logger.error(f"Error saving chunk: {e}")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, AudioRawFrame):
            self._buffer.extend(frame.audio)

            # Check if we've hit our 10-second mark
            if len(self._buffer) >= self._target_bytes:
                # 1. Extract exactly 10 seconds worth of data
                chunk_to_process = bytes(self._buffer[:self._target_bytes])
                
                # 2. Keep any 'overflow' data for the next chunk
                self._buffer = self._buffer[self._target_bytes:]
                
                # 3. Dispatch to background (Non-blocking)
                asyncio.create_task(self._handle_transformers_task(chunk_to_process))

        # Pass frame along to STT/LLM without interruption
        await self.push_frame(frame, direction)


async def run_bot(webrtc_connection):
    sample_rate = 16000  # Standardized for Deepgram & WebRTC

    # ---------------------------
    # Initialize WebRTC transport
    # ---------------------------
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

    # ---------------------------
    # Initialize STT, TTS, LLM
    # ---------------------------
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    tts = DeepgramTTSService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        voice="aura-asteria-en",
        sample_rate=sample_rate,
    )

    # llm = OLLamaLLMService(
    #     model=os.getenv("LLM_MODEL"),
    #     url=os.getenv("OLLAMA_SERVER"),
    # )
    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        model="gemini-2.0-flash"
    )
    # ---------------------------
    # LLM context setup
    # ---------------------------
    context = LLMContext([
        {"role": "system", "content": SYSTEM_INSTRUCTION}
    ])
    context_aggregator = LLMContextAggregatorPair(context)
    recorder= AudioChunkRecorder(sample_rate=sample_rate, seconds=10)
    # ---------------------------
    # Build pipeline
    # ---------------------------
    pipeline = Pipeline([
        transport.input(),
        recorder,
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_out_sample_rate=sample_rate,
            enable_metrics=True
        )
    )

    # ---------------------------
    # Event: client connects
    # ---------------------------
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected ✅")

        # Queue a greeting so TTS actually speaks
        greeting_frame = TextFrame("Hello! How can I help you today?")
        await task.queue_frames([greeting_frame])

    # ---------------------------
    # Event: client disconnects
    # ---------------------------
    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.warning("Client disconnected ❌")
        # Cancel the pipeline gracefully
        await task.cancel()

    # ---------------------------
    # Start the pipeline runner
    # ---------------------------
    runner = PipelineRunner(handle_sigint=False)
    logger.info("Starting pipeline runner...")
    await runner.run(task)
    logger.info("Pipeline runner finished.")
