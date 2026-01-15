import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger

class DatabaseManager:
    def __init__(self, storage_dir: str = "sessions"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        logger.info(f"Storage directory: {storage_dir}")
    
    def _get_session_file(self, session_id: str) -> str:
        """Get the file path for a session"""
        return os.path.join(self.storage_dir, f"{session_id}.json")
    
    def _load_session(self, session_id: str) -> Dict:
        """Load session data from JSON file"""
        filepath = self._get_session_file(session_id)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return None
    
    def _save_session(self, session_id: str, data: Dict):
        """Save session data to JSON file"""
        filepath = self._get_session_file(session_id)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def create_session(
        self, 
        session_id: str, 
        user_name: str = "Guest", 
        character_name: str = "Alfred The Butler",
        character_info: str = "Very Concise and Polite Gentleman. Always ready to serve."
    ):
        """Create a new conversation session"""
        data = {
            "session_id": session_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "user_name": user_name,
            "character_name": character_name,
            "character_info": character_info,
            "messages": [],
            "emotions": {
                "user_emotion": "Neutral",
                "bot_emotion": "Neutral",
                "last_updated": datetime.now().isoformat()
            }
        }
        self._save_session(session_id, data)
        logger.info(f"Created session: {session_id} | User: {user_name} | Character: {character_name}")
    
    def add_message(self, session_id: str, role: str, content: str, emotion: str = "neutral"):
        """Add a message to the conversation history"""
        data = self._load_session(session_id)
        if not data:
            self.create_session(session_id)
            data = self._load_session(session_id)
        
        message = {
            "role": role,
            "content": content,
            "emotion": emotion,
            "timestamp": datetime.now().isoformat()
        }
        
        data["messages"].append(message)
        data["updated_at"] = datetime.now().isoformat()
        self._save_session(session_id, data)
        logger.info(f"✅ Added {role} message to {session_id}")
    
    def get_history(self, session_id: str, limit: Optional[int] = None) -> List[Dict]:
        """Get conversation history for a session"""
        data = self._load_session(session_id)
        if not data:
            return []
        
        messages = data.get("messages", [])
        if limit:
            return messages[-limit:]
        return messages
    
    def update_emotions(self, session_id: str, user_emotion: str, bot_emotion: str):
        """Update current emotions for a session"""
        data = self._load_session(session_id)
        if not data:
            self.create_session(session_id)
            data = self._load_session(session_id)
        
        data["emotions"] = {
            "user_emotion": user_emotion,
            "bot_emotion": bot_emotion,
            "last_updated": datetime.now().isoformat()
        }
        data["updated_at"] = datetime.now().isoformat()
        self._save_session(session_id, data)
        logger.info(f"🎭 Updated emotions for {session_id}: User={user_emotion}, Bot={bot_emotion}")
    
    def get_emotions(self, session_id: str) -> Optional[Dict]:
        """Get current emotions for a session"""
        data = self._load_session(session_id)
        if data:
            return data.get("emotions", {
                "user_emotion": "Neutral",
                "bot_emotion": "Neutral",
                "last_updated": datetime.now().isoformat()
            })
        return None
    
    def clear_session(self, session_id: str):
        """Clear all data for a session"""
        filepath = self._get_session_file(session_id)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"🗑️ Cleared session: {session_id}")