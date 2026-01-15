"use client"

import React, { useRef, useEffect, useMemo } from "react"
import { useGraph, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import { SkeletonUtils } from "three-stdlib"
import * as THREE from "three"
import { Viseme } from "@/hooks/useLipSync"

interface AvatarWithLipSyncProps {
  glbPath?: string
  viseme?: Viseme
  isSpeaking?: boolean
}

// Viseme to morph target mapping for Ready Player Me avatars
// Maps Rhubarb visemes (A-F, X) to RPM morph targets
const visemeToMorphTargets: Record<Viseme, string[]> = {
  X: ["viseme_sil"],
  A: ["viseme_PP"],
  B: ["viseme_kk", "viseme_SS", "viseme_nn", "viseme_DD"],
  C: ["viseme_E"],
  D: ["viseme_aa"],
  E: ["viseme_O"],
  F: ["viseme_U"],
}

export function AvatarWithLipSync({ glbPath = "/avatar-transformed.glb", viseme = "X", isSpeaking = false }: AvatarWithLipSyncProps) {
  const { scene } = useGLTF(glbPath)
  // Memoize clone to prevent unnecessary re-renders but allow updates
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)

  const headMeshRef = useRef<THREE.SkinnedMesh>(null)
  const teethMeshRef = useRef<THREE.SkinnedMesh>(null)

  // Transition speeds
  const SMOOTHING = 0.25 // For viseme transitions

  // Track target influences for smoothing
  const targetInfluencesHead = useRef<Record<string, number>>({})
  const targetInfluencesTeeth = useRef<Record<string, number>>({})

  // Find head and teeth meshes
  useEffect(() => {
    clone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        if (child.name.includes("Head")) {
          // @ts-ignore
          headMeshRef.current = child
        }
        if (child.name.includes("Teeth")) {
          // @ts-ignore
          teethMeshRef.current = child
        }
      }
    })
  }, [clone])

  // Process mouth movement in the frame loop
  useFrame((state, delta) => {
    if (!headMeshRef.current) return

    const head = headMeshRef.current
    const headDict = head.morphTargetDictionary
    const headInfluences = head.morphTargetInfluences

    if (!headDict || !headInfluences) return

    const teeth = teethMeshRef.current
    const teethDict = teeth?.morphTargetDictionary
    const teethInfluences = teeth?.morphTargetInfluences

    // 1. Reset target influences
    const currentTargetInfluences: Record<string, number> = {}

    // 2. Determine mouth state
    if (isSpeaking) {
      if (viseme !== "X") {
        // Use viseme mapping
        const targets = visemeToMorphTargets[viseme]
        targets.forEach(t => {
          if (headDict[t] !== undefined) currentTargetInfluences[t] = 1.0
        })
      } else {
        // If isSpeaking but viseme is X (e.g. loading or gap), do a slight "mumble" or jaw open
        // This makes the character feel alive while "generating" or in between words
        const mumblePower = 0.1 + Math.sin(state.clock.elapsedTime * 10) * 0.1
        if (headDict["jawOpen"] !== undefined) currentTargetInfluences["jawOpen"] = mumblePower
        if (headDict["mouthOpen"] !== undefined) currentTargetInfluences["mouthOpen"] = mumblePower
      }
    }

    // 3. Smoothly interpolate all morph targets
    // We only care about the ones we are interested in
    const morphTargetNames = Object.keys(headDict)
    morphTargetNames.forEach((name) => {
      // Only process mouth/jaw related ones to keep it efficient
      if (!name.startsWith("viseme_") && !name.includes("mouth") && !name.includes("jaw") && !name.includes("lip")) {
        return
      }

      const index = headDict[name]
      const targetValue = currentTargetInfluences[name] || 0

      // Smooth interpolation: current + (target - current) * lerpFactor
      headInfluences[index] = THREE.MathUtils.lerp(
        headInfluences[index],
        targetValue,
        SMOOTHING
      )

      // Sync teeth if they share the same morph target names
      if (teeth && teethDict && teethInfluences && teethDict[name] !== undefined) {
        teethInfluences[teethDict[name]] = headInfluences[index]
      }
    })
  })

  // Fallback rendering
  if (!nodes || Object.keys(nodes).length === 0) {
    return <primitive object={clone} />
  }

  return (
    <group dispose={null}>
      <primitive object={nodes.Hips} />
      {nodes.Wolf3D_Hair && <skinnedMesh geometry={nodes.Wolf3D_Hair.geometry} material={materials.Wolf3D_Hair} skeleton={nodes.Wolf3D_Hair.skeleton} />}
      {nodes.Wolf3D_Body && <skinnedMesh geometry={nodes.Wolf3D_Body.geometry} material={materials.Wolf3D_Body} skeleton={nodes.Wolf3D_Body.skeleton} />}
      {nodes.Wolf3D_Outfit_Bottom && <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry} material={materials.Wolf3D_Outfit_Bottom} skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />}
      {nodes.Wolf3D_Outfit_Footwear && <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear} skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />}
      {nodes.Wolf3D_Outfit_Top && <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry} material={materials.Wolf3D_Outfit_Top} skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />}
      {nodes.EyeLeft && <skinnedMesh name="EyeLeft" geometry={nodes.EyeLeft.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeLeft.skeleton} morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary} morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />}
      {nodes.EyeRight && <skinnedMesh name="EyeRight" geometry={nodes.EyeRight.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeRight.skeleton} morphTargetDictionary={nodes.EyeRight.morphTargetDictionary} morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />}
      {nodes.Wolf3D_Head && (
        <skinnedMesh
          ref={headMeshRef}
          name="Wolf3D_Head"
          geometry={nodes.Wolf3D_Head.geometry}
          material={materials.Wolf3D_Skin}
          skeleton={nodes.Wolf3D_Head.skeleton}
          morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
          morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
        />
      )}
      {nodes.Wolf3D_Teeth && (
        <skinnedMesh
          ref={teethMeshRef}
          name="Wolf3D_Teeth"
          geometry={nodes.Wolf3D_Teeth.geometry}
          material={materials.Wolf3D_Teeth}
          skeleton={nodes.Wolf3D_Teeth.skeleton}
          morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
          morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
        />
      )}
    </group>
  )
}

useGLTF.preload("/avatar-transformed.glb")
