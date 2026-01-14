"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AvatarViewer } from "./avatar-viewer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* =======================
   Types
======================= */
export interface AvatarOption {
  id: string
  name: string
  glbPath: string
  description: string
  traits: string[]
  personality: string
}

/* =======================
   Avatar Data
======================= */
export const avatars: AvatarOption[] = [
  {
    id: "bruce-wayne",
    name: "Bruce Wayne",
    glbPath: "/avatar.glb",
    description: "Strategic, analytical, and always prepared.",
    traits: ["Strategic", "Analytical", "Determined"],
    personality: "Calm, tactical, and focused on solutions.",
  },
  {
    id: "clark-kent",
    name: "Clark Kent",
    glbPath: "/clark-kent.glb",
    description: "Hopeful, compassionate, and incredibly strong.",
    traits: ["Hopeful", "Compassionate", "Optimistic"],
    personality: "Warm, encouraging, and reassuring.",
  },
  {
    id: "diana",
    name: "Diana",
    glbPath: "/diana.glb",
    description: "Wise, fierce, and a natural leader.",
    traits: ["Wise", "Fierce", "Leader"],
    personality: "Confident, direct, and inspiring.",
  },
  {
    id: "harley-quinn",
    name: "Harley Quinn",
    glbPath: "/harley-quinn.glb",
    description: "Energetic, chaotic, and witty.",
    traits: ["Energetic", "Witty", "Bold"],
    personality: "Playful, unpredictable, and fast-talking.",
  },
]

/* =======================
   Props
======================= */
interface AvatarSelectorProps {
  onSelect: (avatar: AvatarOption) => void
  className?: string
}

/* =======================
   Component
======================= */
export function AvatarSelector({ onSelect, className }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div
      className={cn(
        "w-full max-w-7xl mx-auto px-6 py-16 flex flex-col items-center",
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">
          Choose Your AI Companion
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Hover to preview the avatar. Click to lock it in.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {avatars.map((avatar, idx) => {
          const isHovered = hoveredIndex === idx
          const isSelected = selectedAvatar?.id === avatar.id

          return (
            <div
              key={avatar.id}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setSelectedAvatar(avatar)}
              className={cn(
                "relative rounded-2xl transition-all cursor-pointer",
                isSelected && "ring-2 ring-primary ring-offset-2"
              )}
            >
              {/* Hover overlay */}
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    className="absolute inset-0 rounded-2xl bg-primary/10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              {/* Card */}
              <div className="relative z-10 bg-card border rounded-2xl p-4 h-full flex flex-col">
                {/* Avatar Preview */}
                <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-muted mb-4">
                  {isHovered || isSelected ? (
                    <AvatarViewer
                      glbPath={avatar.glbPath}
                      className="w-full h-full"
                      isSpeaking={false}
                    />
                  ) : (
                    <img
                      src={`/avatar-preview/${
                        avatar.id === "bruce-wayne"
                          ? "brucewayne"
                          : avatar.id === "clark-kent"
                          ? "clarkkent"
                          : avatar.id === "harley-quinn"
                          ? "harleyquin"
                          : avatar.id
                      }.png`}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Info */}
                <h3 className="text-lg font-semibold">
                  {avatar.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {avatar.description}
                </p>

                {/* Traits */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {avatar.traits.map((trait) => (
                    <span
                      key={trait}
                      className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirm */}
      {selectedAvatar && (
        <div className="mt-12">
          <Button size="lg" onClick={() => onSelect(selectedAvatar)}>
            Start Chatting with {selectedAvatar.name}
          </Button>
        </div>
      )}
    </div>
  )
}
