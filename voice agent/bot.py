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

    # ---------------------------
    # Build pipeline
    # ---------------------------
    pipeline = Pipeline([
        transport.input(),
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
