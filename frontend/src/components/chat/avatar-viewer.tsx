"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, Environment } from "@react-three/drei"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import * as THREE from "three"

interface AvatarViewerProps {
  avatarId?: string // Kept for backward compatibility but not used
  className?: string
  isSpeaking?: boolean // New prop to indicate when avatar is speaking
}

// Avatar model component with speaking animation
function AvatarModel({ isSpeaking }: { isSpeaking?: boolean }) {
  const { scene } = useGLTF("/avatar.glb")
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useEffect(() => {
    // Enable shadows if needed
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  // Animate when speaking
  useFrame((state, delta) => {
    if (groupRef.current) {
      timeRef.current += delta

      if (isSpeaking) {
        // Subtle head bobbing and slight rotation when speaking
        const bobAmount = Math.sin(timeRef.current * 4) * 0.02 // Head bobbing
        const rotateAmount = Math.sin(timeRef.current * 3) * 0.05 // Slight head rotation
        const scaleAmount = 1 + Math.sin(timeRef.current * 5) * 0.01 // Subtle breathing effect

        groupRef.current.position.y = -1 + bobAmount
        groupRef.current.rotation.y = rotateAmount
        groupRef.current.scale.setScalar(scaleAmount)
      } else {
        // Return to neutral position
        groupRef.current.position.y = -1
        groupRef.current.rotation.y = 0
        groupRef.current.scale.setScalar(1)
      }
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

export function AvatarViewer({
  className,
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
          <p className="text-xs mt-2">Please check if avatar.glb exists in /public</p>
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
          camera={{ position: [0, 0, 5], fov: 50 }}
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

          {/* Environment for better lighting */}
          <Environment preset="sunset" />

          {/* Avatar Model with speaking animation */}
          <AvatarModel isSpeaking={isSpeaking} />

          {/* Camera Controls */}
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={3}
            maxDistance={10}
            autoRotate={!isSpeaking} // Disable auto-rotate when speaking
            autoRotateSpeed={1}
          />
        </Canvas>
      </Suspense>
    </div>
  )
}
