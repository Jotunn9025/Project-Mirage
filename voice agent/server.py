import argparse
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from bot import run_bot, normalize_emotion
from groq import AsyncGroq
import json
from database import DatabaseManager
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pydantic import BaseModel

# Load environment variables
load_dotenv(override=True)

# Initialize database
db = DatabaseManager()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the SmallWebRTC request handler
small_webrtc_handler: SmallWebRTCRequestHandler = SmallWebRTCRequestHandler()

# Store active sessions
active_sessions = {}


class SessionConfig(BaseModel):
    """Configuration for a new session"""
    character_name: str = "Alfred The Butler"
    character_info: str = "Very Concise and Polite Gentleman. Always ready to serve."
    user_name: str = "Guest"


@app.patch("/api/offer")
async def ice_candidate(request: SmallWebRTCPatchRequest):
    """Handle ICE candidate patches"""
    if request.candidates:
        request.candidates = [
            c for c in request.candidates 
            if c.candidate and c.candidate.strip() != ""
        ]
    
    if not request.candidates:
        return {"status": "success"}

    try:
        await small_webrtc_handler.handle_patch_request(request)
    except Exception as e:
        logger.error(f"Error handling ICE candidate: {e}")
        
    return {"status": "success"}


@app.post("/api/offer")
async def offer(request: Request, background_tasks: BackgroundTasks):
    """Handle WebRTC offer requests with character configuration"""
    
    # Parse the request body
    body = await request.json()
    
    # Extract WebRTC offer
    webrtc_request = SmallWebRTCRequest(
        sdp=body.get("sdp"),
        type=body.get("type")
    )
    
    # Extract session config (character details)
    config = SessionConfig(
        character_name=body.get("character_name", "Alfred The Butler"),
        character_info=body.get("character_info", "Very Concise and Polite Gentleman. Always ready to serve."),
        user_name=body.get("user_name", "Guest")
    )
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    logger.info(f"🆕 Creating session: {session_id}")
    logger.info(f"   Character: {config.character_name}")
    logger.info(f"   User: {config.user_name}")

    async def webrtc_connection_callback(connection):
        # Store session
        active_sessions[session_id] = {
            "connection": connection,
            "config": config
        }
        
        # Schedule run_bot as background task with character parameters
        background_tasks.add_task(
            run_bot, 
            connection, 
            session_id, 
            db,
            config.character_name,
            config.character_info,
            config.user_name
        )

    answer = await small_webrtc_handler.handle_web_request(
        request=webrtc_request,
        webrtc_connection_callback=webrtc_connection_callback,
    )
    
    # Answer is already a dict, just add our extra fields
    if isinstance(answer, dict):
        answer["session_id"] = session_id
        answer["character_name"] = config.character_name
        answer["user_name"] = config.user_name
        return answer
    else:
        # Fallback if it's an object
        return {
            "sdp": answer.sdp,
            "type": answer.type,
            "pc_id": getattr(answer, 'pc_id', None),
            "session_id": session_id,
            "character_name": config.character_name,
            "user_name": config.user_name
        }


@app.get("/")
async def serve_index():
    """Serve the main HTML page"""
    return FileResponse("index.html")


@app.get("/api/history/{session_id}")
async def get_history(session_id: str, limit: int = None):
    """Get conversation history for a specific session"""
    try:
        history = db.get_history(session_id, limit)
        return {
            "status": "success",
            "session_id": session_id,
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/emotions/{session_id}")
async def get_emotions(session_id: str):
    """Get current emotions for a specific session"""
    try:
        history = db.get_history(session_id)
        if not history:
            return {"status": "error", "message": "Session not found"}

        # Format history for the model
        convo_lines = [f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in history[-40:]]
        conversation_text = "\n".join(convo_lines)

        system_prompt = (
            "You are an emotion classifier. Given the conversation, "
            "respond ONLY with a JSON object: {\"user_emotion\": \"...\", \"bot_emotion\": \"...\"}. "
            "Values: Angry, Sad, Happy, Surprise, Fear, Disgust, Contempt, Neutral."
        )

        try:
            client = AsyncGroq()
            resp = await client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Conversation:\n{conversation_text}\n\nReturn JSON:"},
                ],
                model="llama-3.1-8b-instant",
                temperature=0.0,
                response_format={"type": "json_object"} # Force Groq to return JSON
            )

            # --- ROBUST EXTRACTION ---
            # Extract the actual text content from the Groq Response Object
            text_content = resp.choices[0].message.content
            
            # Parse the string into a Python dictionary
            parsed = json.loads(text_content)

            user_emotion = normalize_emotion(parsed.get("user_emotion", "Neutral"))
            bot_emotion = normalize_emotion(parsed.get("bot_emotion", "Neutral"))

            # Update DB
            db.update_emotions(session_id, user_emotion, bot_emotion)

            return {
                "status": "success",
                "session_id": session_id,
                "emotions": {
                    "user_emotion": user_emotion,
                    "bot_emotion": bot_emotion,
                }
            }

        except Exception as ge:
            logger.error(f"Groq error: {ge}")
            # Fallback to DB if LLM fails
            emotions = db.get_emotions(session_id)
            return {"status": "success", "session_id": session_id, "emotions": emotions}

    except Exception as e:
        logger.error(f"Error in get_emotions: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/emotion/user/{session_id}")
async def get_user_emotion(session_id: str):
    """Get current user emotion for a specific session"""
    try:
        emotions = db.get_emotions(session_id)
        if emotions:
            return {
                "status": "success",
                "session_id": session_id,
                "emotion": emotions.get("user_emotion", "Neutral"),
                "last_updated": emotions.get("last_updated")
            }
        else:
            return {"status": "error", "message": "Session not found"}
    except Exception as e:
        logger.error(f"Error fetching user emotion: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/emotion/bot/{session_id}")
async def get_bot_emotion(session_id: str):
    """Get current bot emotion for a specific session"""
    try:
        emotions = db.get_emotions(session_id)
        if emotions:
            return {
                "status": "success",
                "session_id": session_id,
                "emotion": emotions.get("bot_emotion", "Neutral"),
                "last_updated": emotions.get("last_updated")
            }
        else:
            return {"status": "error", "message": "Session not found"}
    except Exception as e:
        logger.error(f"Error fetching bot emotion: {e}")
        return {"status": "error", "message": str(e)}


@app.delete("/api/session/{session_id}")
async def clear_session(session_id: str):
    """Clear all data for a session"""
    try:
        db.clear_session(session_id)
        if session_id in active_sessions:
            del active_sessions[session_id]
        return {"status": "success", "message": "Session cleared"}
    except Exception as e:
        logger.error(f"Error clearing session: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/sessions")
async def list_sessions():
    """List all active sessions"""
    return {
        "status": "success",
        "active_sessions": list(active_sessions.keys()),
        "count": len(active_sessions)
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await small_webrtc_handler.close()


app.router.lifespan_context = lifespan


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebRTC demo")
    parser.add_argument(
        "--host", default="localhost", help="Host for HTTP server (default: localhost)"
    )
    parser.add_argument(
        "--port", type=int, default=7860, help="Port for HTTP server (default: 7860)"
    )
    parser.add_argument("--verbose", "-v", action="count")
    args = parser.parse_args()

    logger.remove(0)
    if args.verbose:
        logger.add(sys.stderr, level="TRACE")
    else:
        logger.add(sys.stderr, level="DEBUG")

    uvicorn.run(app, host=args.host, port=args.port)