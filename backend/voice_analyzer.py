"""
Voice Analyzer - Processes voice features and calculates momentum
"""

import numpy as np
from typing import Dict, List
from collections import deque

class VoiceAnalyzer:
    def __init__(self, history_size: int = 5):
        """
        Initialize voice analyzer
        
        Args:
            history_size: Number of historical voice snapshots to maintain
        """
        self.history_size = history_size
        self.voice_history = deque(maxlen=history_size)
    
    def add_voice_features(self, features: Dict[str, float]) -> None:
        """Add new voice features to history"""
        self.voice_history.append(features)
    
    def get_recent_history(self) -> List[Dict[str, float]]:
        """Get recent voice history as list"""
        return list(self.voice_history)
    
    def calculate_momentum(self, current_features: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate momentum/trends from voice history
        
        Args:
            current_features: Current voice features
            
        Returns:
            Dictionary of momentum values for each feature
        """
        
        if len(self.voice_history) < 3:
            # Not enough history, return zero momentum
            return {
                "stress_trend": 0.0,
                "energy_trend": 0.0,
                "confidence_trend": 0.0,
                "tempo_trend": 0.0,
                "clarity_trend": 0.0
            }
        
        # Calculate average of last 3 entries
        recent = list(self.voice_history)[-3:]
        
        avg_stress = np.mean([h.get("stress", 0.5) for h in recent])
        avg_energy = np.mean([h.get("energy", 0.5) for h in recent])
        avg_confidence = np.mean([h.get("confidence", 0.5) for h in recent])
        avg_tempo = np.mean([h.get("tempo", 0.5) for h in recent])
        avg_clarity = np.mean([h.get("clarity", 0.5) for h in recent])
        
        # Calculate trends (normalized by 0.3 as per spec)
        stress_trend = (current_features.get("stress", 0.5) - avg_stress) / 0.3
        energy_trend = (current_features.get("energy", 0.5) - avg_energy) / 0.3
        confidence_trend = (current_features.get("confidence", 0.5) - avg_confidence) / 0.3
        tempo_trend = (current_features.get("tempo", 0.5) - avg_tempo) / 0.3
        clarity_trend = (current_features.get("clarity", 0.5) - avg_clarity) / 0.3
        
        return {
            "stress_trend": float(stress_trend),
            "energy_trend": float(energy_trend),
            "confidence_trend": float(confidence_trend),
            "tempo_trend": float(tempo_trend),
            "clarity_trend": float(clarity_trend)
        }
    
    def interpret_momentum(self, momentum: Dict[str, float]) -> Dict[str, bool]:
        """
        Interpret momentum trends into actionable flags
        
        Args:
            momentum: Momentum dictionary from calculate_momentum
            
        Returns:
            Dictionary of boolean flags for significant trends
        """
        
        return {
            "escalating_tension": momentum["stress_trend"] > 0.2,
            "user_fatiguing": momentum["energy_trend"] < -0.2,
            "user_gaining_control": momentum["confidence_trend"] > 0.15,
            "user_scattered": abs(momentum["tempo_trend"]) > 0.25,
            "improving_clarity": momentum["clarity_trend"] > 0.15,
            "deteriorating_clarity": momentum["clarity_trend"] < -0.15
        }
    
    def normalize_features(self, raw_features: Dict[str, float]) -> Dict[str, float]:
        """
        Normalize and validate voice features to 0.0-1.0 range
        Handles NaN and missing values safely
        """
        import math
        normalized = {}
        for key in ["energy", "confidence", "stress", "tempo", "clarity"]:
            value = raw_features.get(key, 0.5)
            # Handle NaN or None
            try:
                val = float(value)
                if math.isnan(val):
                    val = 0.5
            except (TypeError, ValueError):
                val = 0.5
                
            # Clamp to 0.0-1.0
            normalized[key] = max(0.0, min(1.0, val))
        
        return normalized
    
    def get_emotional_state(self, features: Dict[str, float]) -> str:
        """
        Get human-readable emotional state from features
        
        Args:
            features: Normalized voice features
            
        Returns:
            Emotional state description
        """
        
        energy = features.get("energy", 0.5)
        stress = features.get("stress", 0.5)
        confidence = features.get("confidence", 0.5)
        
        # High stress states
        if stress > 0.8:
            if energy > 0.6:
                return "anxious/agitated"
            else:
                return "overwhelmed/defeated"
        
        # Low energy states
        if energy < 0.15:
            if stress > 0.5:
                return "exhausted/stressed"
            else:
                return "calm/tired"
        
        # High energy states
        if energy > 0.7:
            if confidence > 0.6:
                return "excited/confident"
            else:
                return "hyper/scattered"
        
        # Confidence-based
        if confidence < 0.3:
            return "uncertain/timid"
        elif confidence > 0.7:
            return "assured/dominant"
        
        # Default balanced state
        return "neutral/balanced"


# Test function
if __name__ == "__main__":
    analyzer = VoiceAnalyzer()
    
    # Simulate conversation with increasing stress
    test_sequence = [
        {"energy": 0.5, "confidence": 0.6, "stress": 0.3, "tempo": 0.5, "clarity": 0.7},
        {"energy": 0.4, "confidence": 0.5, "stress": 0.4, "tempo": 0.5, "clarity": 0.6},
        {"energy": 0.3, "confidence": 0.4, "stress": 0.5, "tempo": 0.4, "clarity": 0.5},
        {"energy": 0.25, "confidence": 0.35, "stress": 0.6, "tempo": 0.4, "clarity": 0.5},
        {"energy": 0.2, "confidence": 0.3, "stress": 0.7, "tempo": 0.3, "clarity": 0.4},
    ]
    
    for i, features in enumerate(test_sequence):
        normalized = analyzer.normalize_features(features)
        analyzer.add_voice_features(normalized)
        
        momentum = analyzer.calculate_momentum(normalized)
        flags = analyzer.interpret_momentum(momentum)
        state = analyzer.get_emotional_state(normalized)
        
        print(f"\n=== Step {i+1} ===")
        print(f"Features: {normalized}")
        print(f"Emotional State: {state}")
        print(f"Momentum: {momentum}")
        print(f"Flags: {flags}")
