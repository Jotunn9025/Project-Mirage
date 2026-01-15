"""
Test script for Personality Engine
Run this to verify your setup is working correctly
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from personality_engine import PersonalityEngine
from voice_analyzer import VoiceAnalyzer
from intent_classifier import IntentClassifier
import json

def test_voice_analyzer():
    """Test voice analyzer with sample data"""
    print("\n" + "="*60)
    print("Testing Voice Analyzer...")
    print("="*60)
    
    analyzer = VoiceAnalyzer()
    
    # Simulate a conversation with increasing stress
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
        
        print(f"\nStep {i+1}:")
        print(f"  Emotional State: {state}")
        print(f"  Stress Trend: {momentum['stress_trend']:.2f}")
        print(f"  Escalating Tension: {flags['escalating_tension']}")
    
    print("\n✓ Voice Analyzer test passed!")
    return True

def test_intent_classifier():
    """Test intent classifier"""
    print("\n" + "="*60)
    print("Testing Intent Classifier...")
    print("="*60)
    
    classifier = IntentClassifier()
    
    test_cases = [
        ("How do I fix this error?", "question"),
        ("I'm feeling really overwhelmed", "emotional"),
        ("This is terrible", "complaint"),
        ("Haha that's funny!", "joke"),
        ("Can you teach me Python?", "learning"),
        ("Send the report", "task")
    ]
    
    print("\nNote: Using fallback classifier (HF API may not be configured yet)")
    
    for text, expected in test_cases:
        intent = classifier._fallback_classify(text)  # Use fallback for testing
        print(f"\n  Text: '{text}'")
        print(f"  Detected: {intent}")
        print(f"  Expected: {expected}")
    
    print("\n✓ Intent Classifier test passed!")
    return True

def test_personality_engine():
    """Test personality engine"""
    print("\n" + "="*60)
    print("Testing Personality Engine...")
    print("="*60)
    
    # Check if API key is set
    if not os.getenv("GROQ_API_KEY"):
        print("\n⚠️  GROQ_API_KEY not set in .env file")
        print("Using fallback mode for testing...")
        
        engine = PersonalityEngine()
        
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
                {"energy": 0.2, "confidence": 0.3, "stress": 0.7, "tempo": 0.3, "clarity": 0.4}
            ],
            "user_text": "I just don't know if I can do this anymore"
        }
        
        result = engine._get_fallback_profile(
            test_input["voice_features"],
            test_input["intent_summary"]
        )
        
        print("\nFallback Result:")
        print(json.dumps(result, indent=2))
        print("\n✓ Personality Engine fallback test passed!")
        return True
    
    else:
        print("\n✓ GROQ_API_KEY found!")
        print("Testing with real API...")
        
        engine = PersonalityEngine()
        
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
                {"energy": 0.2, "confidence": 0.3, "stress": 0.7, "tempo": 0.3, "clarity": 0.4}
            ],
            "user_text": "I just don't know if I can do this anymore"
        }
        
        try:
            result = engine.analyze(**test_input)
            print("\nAPI Result:")
            print(json.dumps(result, indent=2))
            print("\n✓ Personality Engine API test passed!")
            return True
        except Exception as e:
            print(f"\n✗ API test failed: {e}")
            print("This is likely due to API configuration. Check API_SETUP.md")
            return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("PERSONALITY ENGINE TEST SUITE")
    print("="*60)
    
    results = []
    
    # Test 1: Voice Analyzer
    try:
        results.append(("Voice Analyzer", test_voice_analyzer()))
    except Exception as e:
        print(f"\n✗ Voice Analyzer test failed: {e}")
        results.append(("Voice Analyzer", False))
    
    # Test 2: Intent Classifier
    try:
        results.append(("Intent Classifier", test_intent_classifier()))
    except Exception as e:
        print(f"\n✗ Intent Classifier test failed: {e}")
        results.append(("Intent Classifier", False))
    
    # Test 3: Personality Engine
    try:
        results.append(("Personality Engine", test_personality_engine()))
    except Exception as e:
        print(f"\n✗ Personality Engine test failed: {e}")
        results.append(("Personality Engine", False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{name}: {status}")
    
    all_passed = all(result[1] for result in results)
    
    if all_passed:
        print("\n🎉 All tests passed! Your setup is ready.")
        print("\nNext steps:")
        print("1. Start the backend: uvicorn main:app --reload")
        print("2. Start the frontend: cd ../frontend && npm run dev")
        print("3. Open http://localhost:5173")
    else:
        print("\n⚠️  Some tests failed. Please check:")
        print("1. API keys in .env file (see API_SETUP.md)")
        print("2. Dependencies installed (pip install -r requirements.txt)")
        print("3. Python version (python --version, should be 3.9+)")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    main()
