import { useEffect, useRef, useState } from "react"

// Viseme types based on Rhubarb Lip Sync standard
export type Viseme = "A" | "B" | "C" | "D" | "E" | "F" | "X" // X = closed/rest

interface VisemeCue {
  viseme: Viseme
  start: number // Start time in seconds
  end: number // End time in seconds
}

// Simple phoneme to viseme mapping
const phonemeToViseme: Record<string, Viseme> = {
  // Closed/Rest
  " ": "X",
  "sil": "X",
  
  // A - Closed mouth (M, B, P)
  "M": "A",
  "B": "A",
  "P": "A",
  
  // B - Slightly open (K, S, T, D, N, G, etc.)
  "K": "B",
  "S": "B",
  "T": "B",
  "D": "B",
  "N": "B",
  "G": "B",
  "Z": "B",
  "TH": "B",
  "L": "B",
  
  // C - Open (EH, AE vowels)
  "EH": "C",
  "AE": "C",
  "AH": "C",
  
  // D - Wide open (AA vowel)
  "AA": "D",
  "AO": "D",
  
  // E - Slightly rounded (ER, OW)
  "ER": "E",
  "OW": "E",
  "OY": "E",
  
  // F - Puckered (UW, W)
  "UW": "F",
  "W": "F",
  "UH": "F",
}

// Simple text-to-phoneme approximation (for basic lip sync)
function textToPhonemes(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, "")
  const words = normalized.split(/\s+/)
  const phonemes: string[] = []
  
  for (const word of words) {
    if (word.length === 0) continue
    
    // Simple approximation: map common letter patterns to phonemes
    for (let i = 0; i < word.length; i++) {
      const char = word[i]
      const nextChar = word[i + 1]
      const prevChar = word[i - 1]
      
      // Handle common patterns
      if (char === "m" || char === "b" || char === "p") {
        phonemes.push("M")
      } else if (char === "k" || char === "c" || char === "g") {
        phonemes.push("K")
      } else if (char === "s" || char === "z") {
        phonemes.push("S")
      } else if (char === "t" || char === "d") {
        phonemes.push("T")
      } else if (char === "n") {
        phonemes.push("N")
      } else if (char === "l") {
        phonemes.push("L")
      } else if (char === "a" && (nextChar === "a" || nextChar === "r")) {
        phonemes.push("AA")
      } else if (char === "e" && nextChar === "h") {
        phonemes.push("EH")
      } else if (char === "o" && (nextChar === "w" || nextChar === "u")) {
        phonemes.push("OW")
      } else if (char === "u" && nextChar === "w") {
        phonemes.push("UW")
      } else if (char === "w") {
        phonemes.push("W")
      } else if (char === "r") {
        phonemes.push("ER")
      } else if (["a", "e", "i", "o", "u"].includes(char)) {
        phonemes.push("AH")
      } else {
        phonemes.push("B") // Default to slightly open
      }
    }
    
    // Add space between words
    phonemes.push(" ")
  }
  
  return phonemes
}

// Generate viseme cues from text
export function generateVisemeCues(text: string, duration: number): VisemeCue[] {
  const phonemes = textToPhonemes(text)
  const cues: VisemeCue[] = []
  
  if (phonemes.length === 0) {
    return [{ viseme: "X", start: 0, end: duration }]
  }
  
  const phonemeDuration = duration / phonemes.length
  let currentTime = 0
  
  for (const phoneme of phonemes) {
    const viseme = phonemeToViseme[phoneme] || "B"
    const endTime = Math.min(currentTime + phonemeDuration, duration)
    
    cues.push({
      viseme,
      start: currentTime,
      end: endTime,
    })
    
    currentTime = endTime
  }
  
  return cues
}

// Hook for lip sync animation
export function useLipSync(text: string, duration: number = 3) {
  const [currentViseme, setCurrentViseme] = useState<Viseme>("X")
  const animationRef = useRef<number | null>(null)
  const cuesRef = useRef<VisemeCue[]>([])
  const startTimeRef = useRef<number | null>(null)
  
  useEffect(() => {
    if (!text || text.trim().length === 0) {
      setCurrentViseme("X")
      return
    }
    
    // Generate viseme cues
    cuesRef.current = generateVisemeCues(text, duration)
    startTimeRef.current = Date.now()
    
    // Animate visemes
    const animate = () => {
      if (!startTimeRef.current) return
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      
      if (elapsed >= duration) {
        setCurrentViseme("X")
        return
      }
      
      // Find current viseme based on elapsed time
      const currentCue = cuesRef.current.find(
        (cue) => elapsed >= cue.start && elapsed < cue.end
      )
      
      if (currentCue) {
        setCurrentViseme(currentCue.viseme)
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      setCurrentViseme("X")
    }
  }, [text, duration])
  
  return currentViseme
}
