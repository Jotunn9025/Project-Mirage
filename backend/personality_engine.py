"""
Personality Engine - Core LLM-based personality adaptation logic
Uses Groq API for ultra-fast inference (<100ms)
"""

import os
import json
from typing import Dict, List, Any
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class PersonalityEngine:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        self.client = None
        
        if api_key and api_key != "your_groq_api_key_here":
            try:
                import httpx
                # Initialize with a custom client to handle Windows proxy environment issues
                # This often resolves the 'unexpected keyword argument proxies' error
                custom_client = httpx.Client(
                    follow_redirects=True,
                )
                self.client = Groq(
                    api_key=api_key,
                    http_client=custom_client
                )
                print("Groq API successfully initialized with custom client")
            except Exception as e:
                print(f"Warning: Failed to initialize Groq client: {e}")
                print("Trying basic initialization...")
                try:
                    self.client = Groq(api_key=api_key)
                except Exception as e2:
                    print(f"Basic initialization also failed: {e2}")
                    print("Falling back to rule-based personality engine")
        else:
            print("Warning: GROQ_API_KEY not set. Using fallback mode.")
        
        self.model = "llama-3.1-8b-instant"  # High rate limits (TPD/RPM) ideal for real-time engines
        
        # System prompt optimized for speed and accuracy
        self.system_prompt = """You are a sophisticated Psychological Personality Engine for an AI avatar. Your purpose is to analyze voice patterns, momentum, and intent to select an adaptive personality strategy that maintains engagement and emotional safety.

PROCESSING PRINCIPLES:

1. ACTIVE COUNTERBALANCING: Do not mirror negative states (irritation, sadness, anxiety). Instead, provide the stabilizing opposite.
2. MOMENTUM AWARENESS: Trends matter more than snapshots. Rising stress requires immediate de-escalation; falling energy requires re-engagement.
3. INTENT OVERRIDE: If the user describes a task or question, prioritize efficiency and clarity regardless of their emotional state.

STEP-BY-STEP ANALYSIS:

TONE INTERPRETATION:
- Energy: 0.0-0.2=muffled/exhausted, 0.2-0.5=stable, 0.5-1.0=vibrant.
- Stress: 0.0-0.3=relaxed, 0.3-0.7=neutral, 0.7-1.0=high-tension.
- Confidence: 0.0-0.3=diminished, 0.3-0.6=neutral, 0.6-1.0=empowered.

STRATEGY SELECTION:

Tone Layer:
- Depleted/Lethargic User → "energizing_warm" (Low energy needs a boost)
- Stressed/Aggressive User → "calm_grounded" (High tension needs stability)
- High Energy/Fast User → "focused_rhythmic" (Excitement needs structure)
- Unsure/Timid User → "patient_empowering" (Low confidence needs support)

Behavior Layer:
- User is Scattered → "structured_sequential"
- User is Slow/Dragging → "proactive_dynamic"
- User is Fast/Rushed → "deliberate_composed"

Helpfulness Layer:
- Task-focused → "concise_efficient"
- Confused/Learning → "scaffolded_educational"
- Venting/Emotional → "empathetic_validating"

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "personality_profile": {
    "tone_layer": "energizing_warm|calm_grounded|focused_rhythmic|patient_empowering|naturally_responsive",
    "behavior_layer": "structured_sequential|proactive_dynamic|deliberate_composed|matched_rhythm",
    "helpfulness_layer": "concise_efficient|scaffolded_educational|empathetic_validating|exploratory_coaching",
    "emotional_layer": "expressive_warm|contained_stable|naturally_responsive|animated_engaged"
  },
  "reason": "Expert psychological rationale (max 15 words)"
}"""

    def analyze(
        self,
        voice_features: Dict[str, float],
        intent_summary: str,
        recent_voice_history: List[Dict[str, float]],
        user_text: str = ""
    ) -> Dict[str, Any]:
        """
        Analyze voice patterns and generate personality profile
        
        Args:
            voice_features: Current voice metrics (energy, confidence, stress, tempo, clarity)
            intent_summary: Classified intent (question|complaint|joke|learning|emotional|task)
            recent_voice_history: Last 5 voice feature snapshots
            user_text: Transcribed text (optional)
            
        Returns:
            Personality profile with tone, behavior, helpfulness, and emotional layers
        """
        
        # Construct input JSON
        input_data = {
            "voice_features": voice_features,
            "intent_summary": intent_summary,
            "recent_voice_history": recent_voice_history,
            "user_text": user_text
        }
        
        # If client not available, use fallback immediately
        if not self.client:
            return self._get_fallback_profile(voice_features, intent_summary)
        
        try:
            # Call Groq API with optimized parameters and a hard timeout
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": json.dumps(input_data)}
                ],
                temperature=0.3,  # Low temperature for consistency
                max_tokens=200,   # Limit output size
                top_p=0.9,
                timeout=8.0,      # Prevent hanging
                response_format={"type": "json_object"}  # Force JSON output
            )
            
            # Parse response
            result = json.loads(response.choices[0].message.content)
            
            # Validate structure
            if "personality_profile" not in result:
                raise ValueError("Missing personality_profile in response")
                
            return result
            
        except Exception as e:
            print(f"Error in personality engine: {e}")
            # Fallback to safe default
            return self._get_fallback_profile(voice_features, intent_summary)
    
    def _get_fallback_profile(
        self,
        voice_features: Dict[str, float],
        intent_summary: str
    ) -> Dict[str, Any]:
        """Fallback personality profile when API fails"""
        
        # Simple rule-based fallback
        stress = voice_features.get("stress", 0.5)
        energy = voice_features.get("energy", 0.5)
        confidence = voice_features.get("confidence", 0.5)
        
        if stress > 0.8:
            tone = "calm_grounded"
            emotional = "contained_stable"
        elif energy < 0.2:
            tone = "energizing_warm"
            emotional = "expressive_warm"
        elif confidence < 0.4:
            tone = "patient_empowering"
            emotional = "expressive_warm"
        else:
            tone = "naturally_responsive"
            emotional = "naturally_responsive"
        
        behavior = "matched_rhythm"
        if energy < 0.2:
            behavior = "proactive_dynamic"
        elif stress > 0.8:
            behavior = "deliberate_composed"
            
        helpfulness = "empathetic_validating" if intent_summary == "emotional" else "exploratory_coaching"
        
        return {
            "personality_profile": {
                "tone_layer": tone,
                "behavior_layer": behavior,
                "helpfulness_layer": helpfulness,
                "emotional_layer": emotional
            },
            "reason": "Rule-based fallback strategy activated due to API unavailability"
        }


# Test function
if __name__ == "__main__":
    engine = PersonalityEngine()
    
    # Test case: User is stressed and overwhelmed
    test_input = {
        "voice_features": {
            "energy": 0.2,
            "confidence": 0.3,
            "stress": 0.7,
            "tempo": 0.3,
            "clarity": 0.4
        },
        "intent_summary": "emotional",
        "recent_voice_history": [
            {"energy": 0.4, "confidence": 0.5, "stress": 0.5, "tempo": 0.4, "clarity": 0.6},
            {"energy": 0.3, "confidence": 0.4, "stress": 0.6, "tempo": 0.35, "clarity": 0.5},
            {"energy": 0.25, "confidence": 0.35, "stress": 0.65, "tempo": 0.32, "clarity": 0.45},
            {"energy": 0.22, "confidence": 0.32, "stress": 0.68, "tempo": 0.31, "clarity": 0.42},
            {"energy": 0.2, "confidence": 0.3, "stress": 0.7, "tempo": 0.3, "clarity": 0.4}
        ],
        "user_text": "I just don't know if I can do this anymore"
    }
    
    result = engine.analyze(**test_input)
    print(json.dumps(result, indent=2))
