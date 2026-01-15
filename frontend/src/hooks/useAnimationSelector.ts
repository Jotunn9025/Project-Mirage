// Hook to select animation based on message content

export type AnimationType = 
  | "neutral" 
  | "greeting" 
  | "thinking" 
  | "thankful" 
  | "laughing" 
  | "angry" 
  | "sad" 
  | "reacting"

// Available animation files
export const ANIMATION_FILES: Record<AnimationType, string> = {
  neutral: "/animations/Neutral Idle.fbx",
  greeting: "/animations/Standing Greeting.fbx",
  thinking: "/animations/Thinking.fbx",
  thankful: "/animations/Thankful.fbx",
  laughing: "/animations/Laughing.fbx",
  angry: "/animations/Angry.fbx",
  sad: "/animations/Sad Idle.fbx",
  reacting: "/animations/Reacting.fbx",
}

// Keywords for emotion detection with weights (higher = stronger match)
const EMOTION_KEYWORDS: Record<AnimationType, { keywords: string[], weight: number }> = {
  laughing: {
    keywords: [
      "haha", "lol", "laugh", "funny", "hilarious", "joke", "joking", 
      "😄", "😂", "🤣", "😆", "hehe", "chuckle", "giggle", "humor",
      "comedy", "amusing", "entertaining", "hysterical", "rofl"
    ],
    weight: 3
  },
  angry: {
    keywords: [
      "angry", "mad", "furious", "annoyed", "frustrated", "upset", 
      "😠", "😡", "🤬", "hate", "disgust", "rage", "irritated",
      "outraged", "livid", "enraged", "displeased"
    ],
    weight: 3
  },
  sad: {
    keywords: [
      "sad", "sorry", "unfortunate", "unfortunately", "sadly", 
      "😢", "😭", "😔", "depressed", "disappointed", "regret",
      "apologize", "apology", "sympathy", "condolences", "mourn",
      "heartbroken", "melancholy", "sorrowful"
    ],
    weight: 3
  },
  thankful: {
    keywords: [
      "thank", "thanks", "appreciate", "grateful", "welcome", 
      "🙏", "pleasure", "glad to help", "thankful", "gratitude",
      "blessed", "indebted", "obliged"
    ],
    weight: 2
  },
  reacting: {
    keywords: [
      "wow", "amazing", "incredible", "surprising", "really", 
      "😮", "😲", "🤯", "unbelievable", "impressive", "fantastic",
      "awesome", "brilliant", "remarkable", "extraordinary", "stunning",
      "marvelous", "phenomenal", "outstanding"
    ],
    weight: 2
  },
  thinking: {
    keywords: [
      "let me think", "i'm thinking", "thinking about", "🤔", "hmm",
      "analyze", "wonder", "ponder", "reflect", "contemplate", 
      "examine", "evaluate", "assess", "deliberate", "uncertain",
      "not sure", "i'm not certain"
    ],
    weight: 1 // Reduced weight - thinking should be less common
  },
  greeting: {
    keywords: [
      "hello", "hi", "hey", "greetings", "welcome", "good morning", 
      "good afternoon", "good evening", "👋", "nice to meet", "howdy",
      "salutations", "pleased to meet", "good day"
    ],
    weight: 2
  },
  neutral: {
    keywords: [],
    weight: 0
  }
}

/**
 * Analyze message content and determine appropriate animation using scoring system
 */
export function selectAnimationFromMessage(message: string): AnimationType {
  if (!message || message.trim().length === 0) {
    return "neutral"
  }

  const lowerMessage = message.toLowerCase()
  const words = lowerMessage.split(/\s+/)
  
  // Score each emotion type
  const scores: Record<AnimationType, number> = {
    neutral: 0,
    greeting: 0,
    thinking: 0,
    thankful: 0,
    laughing: 0,
    angry: 0,
    sad: 0,
    reacting: 0,
  }
  
  // Score based on keyword matches (use word boundaries to avoid partial matches)
  for (const [emotion, data] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion === "neutral") continue
    
    const emotionType = emotion as AnimationType
    for (const keyword of data.keywords) {
      // Use word boundaries for single words, exact match for phrases
      let pattern: RegExp
      if (keyword.includes(" ")) {
        // Phrase - match exactly
        pattern = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")
      } else {
        // Single word - use word boundaries to avoid partial matches
        pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi")
      }
      
      const matches = (lowerMessage.match(pattern) || []).length
      if (matches > 0) {
        scores[emotionType] += matches * data.weight
      }
    }
  }
  
  // Additional scoring based on punctuation and patterns
  const questionCount = (message.match(/\?/g) || []).length
  const exclamationCount = (message.match(/!/g) || []).length
  
  // Only boost thinking for questions if message is short and contains specific thinking phrases
  if (questionCount > 0 && message.length < 80) {
    const hasThinkingPhrases = lowerMessage.includes("let me think") || 
                               lowerMessage.includes("i'm thinking") ||
                               lowerMessage.includes("thinking about") ||
                               lowerMessage.includes("wonder") || 
                               lowerMessage.includes("not sure")
    if (hasThinkingPhrases) {
      scores.thinking += questionCount * 1
    }
  }
  
  if (exclamationCount > 0) {
    // Exclamations could be reacting, laughing, or angry
    if (scores.reacting > 0 || scores.laughing > 0) {
      scores.reacting += exclamationCount * 1.5
    } else if (scores.angry > 0) {
      scores.angry += exclamationCount
    } else {
      scores.reacting += exclamationCount
    }
  }
  
  // Check for common phrases that indicate specific emotions (higher priority)
  const commonPhrases: Array<[string, AnimationType, number]> = [
    // Sad phrases (highest priority for apologies)
    ["i'm sorry", "sad", 8],
    ["i apologize", "sad", 8],
    ["sorry about", "sad", 6],
    ["my apologies", "sad", 7],
    
    // Thankful phrases
    ["thank you", "thankful", 6],
    ["thanks", "thankful", 4],
    ["you're welcome", "thankful", 5],
    ["no problem", "thankful", 3],
    ["my pleasure", "thankful", 4],
    ["glad to help", "thankful", 4],
    
    // Laughing phrases
    ["that's funny", "laughing", 6],
    ["that's hilarious", "laughing", 7],
    ["haha", "laughing", 5],
    ["lol", "laughing", 5],
    ["that made me laugh", "laughing", 6],
    
    // Reacting phrases
    ["that's amazing", "reacting", 6],
    ["that's incredible", "reacting", 6],
    ["wow", "reacting", 4],
    ["that's awesome", "reacting", 5],
    ["that's fantastic", "reacting", 5],
    
    // Angry phrases
    ["i'm angry", "angry", 8],
    ["i'm frustrated", "angry", 7],
    ["i hate", "angry", 8],
    ["that's annoying", "angry", 6],
    
    // Thinking phrases (more specific, lower weight)
    ["let me think", "thinking", 4],
    ["i'm thinking", "thinking", 3],
    ["i'm not sure", "thinking", 3],
    // Remove generic "i think" as it's too common
  ]
  
  for (const [phrase, emotion, weight] of commonPhrases) {
    if (lowerMessage.includes(phrase)) {
      scores[emotion] += weight
    }
  }
  
  // Check message length - shorter messages with questions might be thinking
  // But only if no other strong emotion is detected
  const maxOtherScore = Math.max(
    scores.laughing, scores.angry, scores.sad, 
    scores.thankful, scores.reacting, scores.greeting
  )
  if (message.length < 60 && questionCount > 0 && maxOtherScore === 0 && scores.thinking < 3) {
    scores.thinking += 1 // Reduced from 2
  }
  
  // Find the emotion with the highest score
  let maxScore = 0
  let selectedEmotion: AnimationType = "neutral"
  
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      selectedEmotion = emotion as AnimationType
    }
  }
  
  // Only use neutral if no other emotion scored
  if (maxScore === 0) {
    // Default to reacting for exclamations, thinking only for very short questions, neutral otherwise
    if (exclamationCount > 0) {
      return "reacting"
    }
    if (questionCount > 0 && message.length < 50) {
      return "thinking"
    }
    return "neutral"
  }
  
  // Prevent thinking from winning too easily - require higher threshold
  if (selectedEmotion === "thinking") {
    const secondHighest = Object.entries(scores)
      .filter(([emotion]) => emotion !== "thinking" && emotion !== "neutral")
      .sort(([, a], [, b]) => b - a)[0]
    
    // If thinking score is low (< 4) and another emotion scored reasonably (>= 2), prefer that
    if (maxScore < 4 && secondHighest && secondHighest[1] >= 2) {
      selectedEmotion = secondHighest[0] as AnimationType
      maxScore = secondHighest[1]
      if (process.env.NODE_ENV === "development") {
        console.log(`🔄 Overriding thinking (score: ${scores.thinking}) with ${selectedEmotion} (score: ${maxScore})`)
      }
    }
    // If thinking score is moderate but another emotion scored close, prefer the other
    else if (maxScore >= 4 && maxScore < 6 && secondHighest && secondHighest[1] >= maxScore - 1) {
      selectedEmotion = secondHighest[0] as AnimationType
      maxScore = secondHighest[1]
      if (process.env.NODE_ENV === "development") {
        console.log(`🔄 Overriding thinking (score: ${scores.thinking}) with ${selectedEmotion} (score: ${maxScore})`)
      }
    }
  }
  
  // Log for debugging
  if (process.env.NODE_ENV === "development") {
    console.log(`🎭 Animation selection scores:`, scores)
    console.log(`✅ Selected: ${selectedEmotion} (score: ${maxScore})`)
  }
  
  return selectedEmotion
}

/**
 * Hook to get animation type based on message
 */
export function useAnimationSelector(message: string | null | undefined): AnimationType {
  if (!message) return "neutral"
  return selectAnimationFromMessage(message)
}
