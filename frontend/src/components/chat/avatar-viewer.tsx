"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment } from "@react-three/drei"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { AvatarWithLipSync } from "./avatar-with-lipsync"
import { useLipSync } from "@/hooks/useLipSync"
import { useAnimationSelector, AnimationType, ANIMATION_FILES } from "@/hooks/useAnimationSelector"

interface AvatarViewerProps {
  glbPath?: string // Path to the GLB file
  className?: string
  isSpeaking?: boolean // Whether avatar is currently speaking
  speakingText?: string // Text being spoken for lip sync
  messageContent?: string // Full message content for animation selection
}

// Animation state type - now uses all available animations
type AnimationState = AnimationType

// Avatar model component with FBX animations and lip sync
function AvatarModel({ glbPath, isSpeaking, speakingText, messageContent }: { glbPath: string; isSpeaking?: boolean; speakingText?: string; messageContent?: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const prevIsSpeakingRef = useRef<boolean>(false)
  const [animationState, setAnimationState] = useState<AnimationState>("neutral")
  const [animationsLoaded, setAnimationsLoaded] = useState(false)
  
  // Calculate duration based on text length (average speaking rate: ~150 words/min = 2.5 words/sec)
  const wordsPerSecond = 2.5
  const wordCount = speakingText ? speakingText.split(/\s+/).length : 0
  const estimatedDuration = wordCount / wordsPerSecond || 3
  
  // Use lip sync hook
  const currentViseme = useLipSync(speakingText || "", estimatedDuration)
  
  // Select animation based on message content
  const selectedAnimation = useAnimationSelector(messageContent || speakingText)
  
  // Track previous message to detect changes
  const prevMessageRef = useRef<string>("")
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectedAnimationRef = useRef<AnimationType>(selectedAnimation)
  
  // Keep selectedAnimation ref updated
  useEffect(() => {
    selectedAnimationRef.current = selectedAnimation
  }, [selectedAnimation])
  
  // Update animation with 5-second delay when message content changes
  useEffect(() => {
    if (messageContent && messageContent !== prevMessageRef.current && animationsLoaded) {
      // Clear any pending animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
      
      prevMessageRef.current = messageContent
      const currentSelectedAnimation = selectedAnimationRef.current
      console.log(`🔄 New message detected: "${messageContent.substring(0, 50)}..."`)
      console.log(`🎬 Will update animation to: ${currentSelectedAnimation} after 5 seconds`)
      
      // Delay animation selection by 5 seconds
      animationTimeoutRef.current = setTimeout(() => {
        // Use the latest selected animation from ref
        const latestAnimation = selectedAnimationRef.current
        console.log(`✅ Animation delay complete, setting animation to: ${latestAnimation}`)
        setAnimationState(latestAnimation)
      }, 5000) // 5 second delay
    }
    
    // Cleanup timeout on unmount or message change
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [messageContent, animationsLoaded]) // Removed selectedAnimation from deps, using ref instead
  
  // Check if we should use lip sync model
  // Only use lip sync for transformed GLBs that have the proper structure
  const useLipSyncModel = glbPath.includes("transformed") || glbPath.includes("avatar-transformed")
  
  // Load scene for fallback path (always call hooks)
  const { scene } = useGLTF(glbPath)
  
  // Store loaded animation clips for all animations
  const animationClipsRef = useRef<Record<AnimationType, THREE.AnimationClip | null>>({
    neutral: null,
    greeting: null,
    thinking: null,
    thankful: null,
    laughing: null,
    angry: null,
    sad: null,
    reacting: null,
  })

  // Load all available FBX animations
  useEffect(() => {
    const loader = new FBXLoader()
    let loadedCount = 0
    const totalAnimations = Object.keys(ANIMATION_FILES).length

    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount === totalAnimations) {
        setAnimationsLoaded(true)
        console.log("✅ All animations loaded")
      }
    }

    // Load all animations
    Object.entries(ANIMATION_FILES).forEach(([animationType, filePath]) => {
      loader.load(
        filePath,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            animationClipsRef.current[animationType as AnimationType] = fbx.animations[0]
            console.log(`✅ Loaded animation: ${animationType}`)
          }
          checkAllLoaded()
        },
        undefined,
        (error) => {
          console.warn(`Failed to load ${animationType} animation:`, error)
          checkAllLoaded()
        }
      )
    })
  }, [])

  // Set up animation mixer when animations are loaded (only for non-lip-sync models)
  useEffect(() => {
    if (!animationsLoaded || useLipSyncModel) return

    mixerRef.current = new THREE.AnimationMixer(scene)

    return () => {
      if (currentActionRef.current) {
        currentActionRef.current.stop()
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
    }
  }, [scene, animationsLoaded, useLipSyncModel])

  // Handle animation state changes based on speaking state
  // Note: Animation selection for messageContent is handled separately with 5s delay above
  useEffect(() => {
    if (!animationsLoaded) return

    // Priority 1: If speaking without message content (or before delay), use thinking
    if (isSpeaking && !messageContent) {
      setAnimationState("thinking")
    }
    // Priority 2: If speaking with message content, the delayed animation will be set after 5 seconds
    // Don't override here - let the delay mechanism handle it
    // Priority 3: Just finished speaking - show thankful briefly
    else if (prevIsSpeakingRef.current && !isSpeaking) {
      setAnimationState("thankful")
      setTimeout(() => {
        setAnimationState("neutral")
      }, 2000)
    }
    // Priority 4: Idle - use neutral (only if no message content)
    else if (!isSpeaking && !messageContent) {
      setAnimationState("neutral")
    }

    // Update previous value
    prevIsSpeakingRef.current = isSpeaking || false
  }, [isSpeaking, animationsLoaded, messageContent])

  // Handle animation switching
  useEffect(() => {
    if (!animationsLoaded || !mixerRef.current) return

    const animationClip = animationClipsRef.current[animationState]

    if (animationClip && mixerRef.current) {
      // Fade out current action
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.3)
        currentActionRef.current.stop()
      }

      // Play new animation
      const newAction = mixerRef.current.clipAction(animationClip)
      newAction.reset()
      
      // Some animations play once, others loop
      const playOnceAnimations: AnimationType[] = ["thankful", "reacting", "laughing"]
      if (playOnceAnimations.includes(animationState)) {
        newAction.setLoop(THREE.LoopOnce, 1)
        // After animation completes, switch to neutral
        const duration = animationClip.duration
        setTimeout(() => {
          setAnimationState("neutral")
        }, duration * 1000)
      } else {
        newAction.setLoop(THREE.LoopRepeat, Infinity)
      }
      
      newAction.fadeIn(0.3)
      newAction.play()
      currentActionRef.current = newAction
      
      if (process.env.NODE_ENV === "development") {
        console.log(`🎬 Playing animation: ${animationState}`)
      }
    } else if (!animationClip && process.env.NODE_ENV === "development") {
      console.warn(`⚠️ Animation clip not found for state: ${animationState}`)
    }
  }, [animationState, animationsLoaded])

  // Note: Shadow setup moved to fallback path below

  // Enable shadows for scene (only for fallback path)
  useEffect(() => {
    if (useLipSyncModel) return
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene, useLipSyncModel])

  // Update animation mixer
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
  })

  // Use AvatarWithLipSync if using transformed GLB, otherwise use original scene
  if (useLipSyncModel) {
    return (
      <group ref={groupRef} position={[0, -1, 0]}>
        <AvatarWithLipSync glbPath={glbPath} viseme={currentViseme} isSpeaking={isSpeaking} />
      </group>
    )
  }
  
  // Fallback to original scene-based rendering (for non-transformed GLBs)
  // Note: This path doesn't support lip sync
  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      <primitive object={scene} scale={1} />
    </group>
  )
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Main Avatar Viewer
export function AvatarViewer({
  className,
  glbPath = "/avatar-transformed.glb",
  isSpeaking = false,
  speakingText,
  messageContent,
}: AvatarViewerProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div
        className={cn(
          "relative w-full h-full bg-muted rounded-lg overflow-hidden flex items-center justify-center",
          className
        )}
      >
        <div className="text-center p-4 text-muted-foreground">
          <p className="text-sm">Unable to load avatar</p>
          <p className="text-xs mt-2">Please check if {glbPath} exists in /public</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative w-full h-full rounded-lg overflow-hidden",
        className
      )}
      style={{
        backgroundImage: "url('/background-avatar.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0.8, 1], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: true }}
          onError={() => setError(true)}
        >
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-5, -5, -5]} intensity={0.5} />

          {/* Environment */}
          <Environment preset="sunset" />

          {/* Avatar */}
          <AvatarModel glbPath={glbPath} isSpeaking={isSpeaking} speakingText={speakingText} messageContent={messageContent} />

          {/* Camera Controls */}
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={0.8}
            maxDistance={3}
            autoRotateSpeed={1}
            target={[0, 0.5, 0]}
          />
        </Canvas>
      </Suspense>
    </div>
  )
}
