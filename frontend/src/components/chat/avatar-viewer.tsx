"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment } from "@react-three/drei"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"

interface AvatarViewerProps {
  glbPath?: string // Path to the GLB file
  className?: string
  isSpeaking?: boolean // Whether avatar is currently speaking
}

// Animation state type
type AnimationState = "greeting" | "thinking" | "thankful"

// Avatar model component with FBX animations
function AvatarModel({ glbPath, isSpeaking }: { glbPath: string; isSpeaking?: boolean }) {
  const { scene } = useGLTF(glbPath)
  const groupRef = useRef<THREE.Group>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const prevIsSpeakingRef = useRef<boolean>(false)
  const [animationState, setAnimationState] = useState<AnimationState>("greeting")
  const [animationsLoaded, setAnimationsLoaded] = useState(false)
  
  // Store loaded animation clips
  const greetingAnimRef = useRef<THREE.AnimationClip | null>(null)
  const thinkingAnimRef = useRef<THREE.AnimationClip | null>(null)
  const thankfulAnimRef = useRef<THREE.AnimationClip | null>(null)

  // Load all three FBX animations
  useEffect(() => {
    const loader = new FBXLoader()
    let loadedCount = 0
    const totalAnimations = 3

    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount === totalAnimations) {
        setAnimationsLoaded(true)
      }
    }

    // Load Greeting animation
    loader.load(
      "/animations/Standing Greeting.fbx",
      (fbx) => {
        if (fbx.animations && fbx.animations.length > 0) {
          greetingAnimRef.current = fbx.animations[0]
        }
        checkAllLoaded()
      },
      undefined,
      (error) => {
        console.warn("Failed to load Greeting animation:", error)
        checkAllLoaded()
      }
    )

    // Load Thinking animation
    loader.load(
      "/animations/Thinking.fbx",
      (fbx) => {
        if (fbx.animations && fbx.animations.length > 0) {
          thinkingAnimRef.current = fbx.animations[0]
        }
        checkAllLoaded()
      },
      undefined,
      (error) => {
        console.warn("Failed to load Thinking animation:", error)
        checkAllLoaded()
      }
    )

    // Load Thankful animation
    loader.load(
      "/animations/Thankful.fbx",
      (fbx) => {
        if (fbx.animations && fbx.animations.length > 0) {
          thankfulAnimRef.current = fbx.animations[0]
        }
        checkAllLoaded()
      },
      undefined,
      (error) => {
        console.warn("Failed to load Thankful animation:", error)
        checkAllLoaded()
      }
    )
  }, [])

  // Set up animation mixer when animations are loaded
  useEffect(() => {
    if (!animationsLoaded) return

    mixerRef.current = new THREE.AnimationMixer(scene)

    return () => {
      if (currentActionRef.current) {
        currentActionRef.current.stop()
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
    }
  }, [scene, animationsLoaded])

  // Handle animation state changes based on isSpeaking
  useEffect(() => {
    if (!animationsLoaded) return

    // Detect transition from speaking to not speaking
    if (prevIsSpeakingRef.current && !isSpeaking) {
      // Just finished speaking - show thankful animation
      setAnimationState("thankful")
    } else if (isSpeaking) {
      // Currently speaking/thinking - show thinking animation
      setAnimationState("thinking")
    } else if (!isSpeaking && animationState !== "thankful") {
      // Idle - show greeting animation (unless showing thankful)
      setAnimationState("greeting")
    }

    // Update previous value
    prevIsSpeakingRef.current = isSpeaking || false
  }, [isSpeaking, animationsLoaded, animationState])

  // Handle animation switching
  useEffect(() => {
    if (!animationsLoaded || !mixerRef.current) return

    let animationClip: THREE.AnimationClip | null = null

    switch (animationState) {
      case "greeting":
        animationClip = greetingAnimRef.current
        break
      case "thinking":
        animationClip = thinkingAnimRef.current
        break
      case "thankful":
        animationClip = thankfulAnimRef.current
        break
    }

    if (animationClip && mixerRef.current) {
      // Fade out current action
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.3)
        currentActionRef.current.stop()
      }

      // Play new animation
      const newAction = mixerRef.current.clipAction(animationClip)
      newAction.reset()
      
      // Thankful animation plays once, others loop
      if (animationState === "thankful") {
        newAction.setLoop(THREE.LoopOnce, 1)
        // After thankful animation completes, switch to greeting
        const duration = animationClip.duration
        setTimeout(() => {
          setAnimationState("greeting")
        }, duration * 1000)
      } else {
        newAction.setLoop(THREE.LoopRepeat, Infinity)
      }
      
      newAction.fadeIn(0.3)
      newAction.play()
      currentActionRef.current = newAction
    }
  }, [animationState, animationsLoaded])

  // Enable shadows
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  // Update animation mixer
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta)
    }
  })

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
  glbPath = "/avatar.glb",
  isSpeaking = false,
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
          <AvatarModel glbPath={glbPath} isSpeaking={isSpeaking} />

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
