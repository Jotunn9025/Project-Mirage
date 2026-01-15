"use client"

import { MessageSquare, Video, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ChatMode = "video" | "text" | "voice"

interface ChatModeToggleProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  className?: string
}

export function ChatModeToggle({
  mode,
  onModeChange,
  className,
}: ChatModeToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-1 rounded-lg border border-border bg-card",
        className
      )}
    >
      <Button
        variant={mode === "text" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("text")}
        className="flex-1"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Text
      </Button>
      <Button
        variant={mode === "video" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("video")}
        className="flex-1"
      >
        <Video className="mr-2 h-4 w-4" />
        Avatar
      </Button>
      <Button
        variant={mode === "voice" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("voice")}
        className="flex-1"
      >
        <Mic className="mr-2 h-4 w-4" />
        Voice
      </Button>
    </div>
  )
}

