"use client"

import { Suspense, useState, useEffect, useRef } from "react"
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

// Avatar model component with speaking animation
function AvatarModel({ glbPath, isSpeaking }: { glbPath: string; isSpeaking?: boolean }) {
  const { scene, animations: glbAnimations } = useGLTF(glbPath)
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Object3D | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)
  const fbxAnimationRef = useRef<THREE.AnimationClip | null>(null)
  const timeRef = useRef(0)
  const [fbxLoaded, setFbxLoaded] = useState(false)

  useEffect(() => {
    // Enable shadows for all meshes
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // Find the head/face mesh for mouth movement
    scene.traverse((obj) => {
      if (!headRef.current) {
        const name = obj.name.toLowerCase()
        if (
          name.includes("head") ||
          name.includes("face") ||
          name.includes("jaw") ||
          name.includes("mouth")
        ) {
          headRef.current = obj
        }
      }
    })

    // Fallback to scene if no head found
    if (!headRef.current) {
      console.warn("⚠️ Head not found, falling back to scene root")
      headRef.current = scene
    }

    // Load FBX greeting animation
    const loader = new FBXLoader()
    loader.load(
      "/animations/Standing Greeting.fbx",
      (fbx) => {
        // Extract animation from FBX
        if (fbx.animations && fbx.animations.length > 0) {
          fbxAnimationRef.current = fbx.animations[0]
          setFbxLoaded(true)
        }
      },
      undefined,
      (error) => {
        console.warn("Failed to load FBX animation:", error)
        setFbxLoaded(true)
      }
    )
  }, [scene])

  useEffect(() => {
    if (!fbxLoaded) return

    // Set up animation mixer for greeting animation
    mixerRef.current = new THREE.AnimationMixer(scene)

    // Use FBX animation if available, otherwise use GLB animations
    let animationClip: THREE.AnimationClip | null = null

    if (fbxAnimationRef.current) {
      animationClip = fbxAnimationRef.current
    } else if (glbAnimations && glbAnimations.length > 0) {
      // Fallback to GLB animations
      animationClip = glbAnimations.find(
        (anim) =>
          anim.name.toLowerCase().includes("greeting") ||
          anim.name.toLowerCase().includes("idle") ||
          anim.name.toLowerCase().includes("stand") ||
          anim.name.toLowerCase().includes("wave")
      ) || glbAnimations[0]
    }

    if (animationClip && mixerRef.current && !isSpeaking) {
      actionRef.current = mixerRef.current.clipAction(animationClip)
      actionRef.current.reset()
      actionRef.current.setLoop(THREE.LoopRepeat)
      actionRef.current.play()
    }

    return () => {
      if (actionRef.current) {
        actionRef.current.stop()
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
      }
    }
  }, [scene, glbAnimations, fbxLoaded, isSpeaking])

  // Animate mouth/head movement when speaking, or play greeting animation when idle
  useFrame((state, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta

    // Update animation mixer for greeting animation
    if (mixerRef.current && !isSpeaking) {
      mixerRef.current.update(delta)
    }

    if (isSpeaking) {
      // Stop greeting animation when speaking
      if (actionRef.current && actionRef.current.isRunning()) {
        actionRef.current.fadeOut(0.3)
      }

      // Mouth/head movement - BIG, visible motion
      if (headRef.current) {
        // Head rotation for mouth movement illusion
        headRef.current.rotation.x = Math.sin(timeRef.current * 6) * 0.15 // Nodding motion
        headRef.current.rotation.y = Math.sin(timeRef.current * 3) * 0.2 // Side-to-side
        headRef.current.position.y = Math.sin(timeRef.current * 6) * 0.05 // Vertical bob

        // Additional mouth-like movement on the head
        headRef.current.scale.y = 1 + Math.sin(timeRef.current * 8) * 0.03 // Vertical stretch (mouth opening)
        headRef.current.scale.x = 1 + Math.sin(timeRef.current * 7) * 0.02 // Horizontal stretch
      }

      // Subtle body movement
      groupRef.current.position.y = -1 + Math.sin(timeRef.current * 4) * 0.02
      groupRef.current.rotation.y = Math.sin(timeRef.current * 3) * 0.05
    } else {
      // Resume greeting animation when not speaking
      if (actionRef.current && !actionRef.current.isRunning()) {
        actionRef.current.reset().fadeIn(0.3).play()
      }

      // Smooth reset for head movement
      if (headRef.current) {
        headRef.current.rotation.x *= 0.9
        headRef.current.rotation.y *= 0.9
        headRef.current.position.y *= 0.9
        headRef.current.scale.x = 1 + (headRef.current.scale.x - 1) * 0.9
        headRef.current.scale.y = 1 + (headRef.current.scale.y - 1) * 0.9
      }

      // Reset body position
      groupRef.current.position.y = -1
      groupRef.current.rotation.y = 0
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

// Main Avatar Viewer Component
export function AvatarViewer({
  className,
  glbPath = "/avatar.glb",
  isSpeaking = false,
}: AvatarViewerProps) {
  const [error, setError] = useState(false)

  // Ensure glbPath starts with /
  const normalizedGlbPath = glbPath.startsWith("/") ? glbPath : `/${glbPath}`

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
          <p className="text-xs mt-2">Please check if {normalizedGlbPath} exists in /public</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative w-full h-full bg-muted rounded-lg overflow-hidden",
        className
      )}
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

          {/* Avatar Model */}
          <AvatarModel glbPath={normalizedGlbPath} isSpeaking={isSpeaking} />

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

