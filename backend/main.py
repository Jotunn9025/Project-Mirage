"""
Main FastAPI Server with WebSocket support
Real-time personality engine backend
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
import asyncio
from datetime import datetime

from personality_engine import PersonalityEngine
from voice_analyzer import VoiceAnalyzer
from intent_classifier import IntentClassifier

# Initialize FastAPI app
app = FastAPI(
    title="Real-Time Personality Engine API",
    description="AI-powered avatar with voice-based personality adaptation",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
personality_engine = PersonalityEngine()
intent_classifier = IntentClassifier()

# Store active connections and their analyzers
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.analyzers: Dict[str, VoiceAnalyzer] = {}
    
    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.analyzers[client_id] = VoiceAnalyzer()
        print(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.analyzers:
            del self.analyzers[client_id]
        print(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)
    
    def get_analyzer(self, client_id: str) -> Optional[VoiceAnalyzer]:
        return self.analyzers.get(client_id)

manager = ConnectionManager()


# Pydantic models
class VoiceFeatures(BaseModel):
    energy: float
    confidence: float
    stress: float
    tempo: float
    clarity: float

class AnalysisRequest(BaseModel):
    voice_features: VoiceFeatures
    user_text: Optional[str] = ""

class AnalysisResponse(BaseModel):
    personality_profile: Dict[str, str]
    reason: str
    voice_features: Dict[str, float]
    intent: str
    momentum: Dict[str, float]
    emotional_state: str
    timestamp: str


# REST Endpoints
@app.get("/")
async def root():
    return {
        "message": "Real-Time Personality Engine API",
        "version": "1.0.0",
        "endpoints": {
            "websocket": "/ws/{client_id}",
            "analyze": "/analyze",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_voice(request: AnalysisRequest):
    """
    Single voice analysis endpoint (non-WebSocket)
    Useful for testing or one-off analyses
    """
    try:
        # Create temporary analyzer
        analyzer = VoiceAnalyzer()
        
        # Normalize features
        features_dict = request.voice_features.dict()
        normalized_features = analyzer.normalize_features(features_dict)
        
        # Add to history
        analyzer.add_voice_features(normalized_features)
        
        # Classify intent
        intent = intent_classifier.classify(request.user_text)
        
        # Get momentum and emotional state
        momentum = analyzer.calculate_momentum(normalized_features)
        emotional_state = analyzer.get_emotional_state(normalized_features)
        
        # Get personality profile
        result = personality_engine.analyze(
            voice_features=normalized_features,
            intent_summary=intent,
            recent_voice_history=analyzer.get_recent_history(),
            user_text=request.user_text
        )
        
        return AnalysisResponse(
            personality_profile=result["personality_profile"],
            reason=result["reason"],
            voice_features=normalized_features,
            intent=intent,
            momentum=momentum,
            emotional_state=emotional_state,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time voice analysis
    
    Expected message format:
    {
        "type": "voice_data",
        "voice_features": {
            "energy": 0.0-1.0,
            "confidence": 0.0-1.0,
            "stress": 0.0-1.0,
            "tempo": 0.0-1.0,
            "clarity": 0.0-1.0
        },
        "user_text": "optional transcribed text"
    }
    """
    
    await manager.connect(client_id, websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            if data.get("type") == "voice_data":
                # Get analyzer for this client
                analyzer = manager.get_analyzer(client_id)
                
                if not analyzer:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": "Analyzer not initialized"
                    }, client_id)
                    continue
                
                # Extract data
                raw_features = data.get("voice_features", {})
                user_text = data.get("user_text", "")
                
                # Normalize features
                normalized_features = analyzer.normalize_features(raw_features)
                
                # Add to history
                analyzer.add_voice_features(normalized_features)
                
                # Classify intent (in a thread to not block)
                intent = await asyncio.to_thread(intent_classifier.classify, user_text)
                
                # Calculate momentum
                momentum = analyzer.calculate_momentum(normalized_features)
                momentum_flags = analyzer.interpret_momentum(momentum)
                
                # Get emotional state
                emotional_state = analyzer.get_emotional_state(normalized_features)
                
                # Get personality profile from LLM (in a thread to not block)
                result = await asyncio.to_thread(
                    personality_engine.analyze,
                    voice_features=normalized_features,
                    intent_summary=intent,
                    recent_voice_history=analyzer.get_recent_history(),
                    user_text=user_text
                )
                
                # Send response back to client
                response = {
                    "type": "personality_update",
                    "personality_profile": result["personality_profile"],
                    "reason": result["reason"],
                    "voice_features": normalized_features,
                    "intent": intent,
                    "momentum": momentum,
                    "momentum_flags": momentum_flags,
                    "emotional_state": emotional_state,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                await manager.send_personal_message(response, client_id)
            
            elif data.get("type") == "ping":
                # Heartbeat
                await manager.send_personal_message({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }, client_id)
            
            else:
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Unknown message type: {data.get('type')}"
                }, client_id)
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)


# Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
