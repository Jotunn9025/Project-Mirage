"""
Intent Classifier - Classifies user intent from text
Uses HuggingFace Inference API (free tier)
"""

import os
import requests
from typing import Dict
from dotenv import load_dotenv

load_dotenv()

class IntentClassifier:
    def __init__(self):
        self.api_token = os.getenv("HF_API_TOKEN")
        self.api_url = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
        self.headers = {"Authorization": f"Bearer {self.api_token}"}
        
        # Intent categories
        self.candidate_labels = [
            "question",
            "complaint", 
            "joke",
            "learning",
            "emotional",
            "task"
        ]
    
    def classify(self, text: str) -> str:
        """
        Classify user intent from text
        
        Args:
            text: User's transcribed speech
            
        Returns:
            Intent category (question|complaint|joke|learning|emotional|task)
        """
        
        if not text or len(text.strip()) < 3:
            return "task"  # Default for empty/short text
        
        try:
            # Zero-shot classification using BART
            payload = {
                "inputs": text,
                "parameters": {
                    "candidate_labels": self.candidate_labels
                }
            }
            
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                # Return highest scoring label
                return result["labels"][0]
            else:
                print(f"HF API error: {response.status_code}")
                return self._fallback_classify(text)
                
        except Exception as e:
            print(f"Intent classification error: {e}")
            return self._fallback_classify(text)
    
    def _fallback_classify(self, text: str) -> str:
        """Simple rule-based fallback when API fails"""
        
        text_lower = text.lower()
        
        # Question markers
        if any(q in text_lower for q in ["?", "what", "why", "how", "when", "where", "who", "can you"]):
            return "question"
        
        # Emotional markers
        if any(e in text_lower for e in ["feel", "sad", "happy", "angry", "frustrated", "worried", "scared", "love", "hate"]):
            return "emotional"
        
        # Complaint markers
        if any(c in text_lower for c in ["don't like", "hate", "terrible", "awful", "worst", "bad", "wrong"]):
            return "complaint"
        
        # Joke markers
        if any(j in text_lower for j in ["haha", "lol", "funny", "joke", "kidding", "just messing"]):
            return "joke"
        
        # Learning markers
        if any(l in text_lower for l in ["learn", "teach", "explain", "understand", "show me", "help me"]):
            return "learning"
        
        # Default to task
        return "task"


# Test function
if __name__ == "__main__":
    classifier = IntentClassifier()
    
    test_cases = [
        "How do I fix this error?",
        "I'm feeling really overwhelmed right now",
        "This is the worst thing ever",
        "Haha that's hilarious!",
        "Can you teach me about Python?",
        "Please send the report by EOD"
    ]
    
    for text in test_cases:
        intent = classifier.classify(text)
        print(f"Text: '{text}' → Intent: {intent}")
