"use client"

import { cn } from "@/lib/utils"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user"

  return (
    <div
      className={cn(
        "flex w-full gap-4 px-4 py-6",
        isUser ? "justify-end" : "justify-start",
        "border-b border-border last:border-b-0"
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] gap-3 sm:max-w-[75%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? "CB" : "AI"}
        </div>

        {/* Message Content */}
        <div
          className={cn(
            "rounded-lg px-4 py-3 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-words">
            {content}
          </p>
        </div>
      </div>
    </div>
  )
}

