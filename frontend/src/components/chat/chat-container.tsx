"use client"

import { useEffect, useRef } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { AvatarViewer } from "./avatar-viewer"
import { ChatMode } from "./chat-mode-toggle"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatContainerProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
  mode?: ChatMode
  glbPath?: string
}

export function ChatContainer({
  messages,
  onSendMessage,
  isLoading = false,
  mode = "text",
  glbPath = "/avatar.glb",
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (mode === "video") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Avatar Section - Top on Mobile, Left on Desktop */}
          <div className="lg:w-1/3 lg:border-r border-b lg:border-b-0 border-border bg-muted/30 shrink-0">
            <div className="w-full h-64 lg:h-full p-4">
              <AvatarViewer
                glbPath={glbPath}
                className="w-full h-full"
                isSpeaking={isLoading}
              />
            </div>
          </div>

          {/* Chat Section - Bottom on Mobile, Right on Desktop */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-foreground">
                      Start a conversation
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      Send a message to begin chatting with the AI assistant.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                    />
                  ))}
                  {isLoading && (
                    <div className="flex w-full gap-4 px-4 py-6 justify-start border-b border-border">
                      <div className="flex max-w-[85%] gap-3 sm:max-w-[75%]">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                          AI
                        </div>
                        <div className="rounded-lg bg-muted px-4 py-3">
                          <div className="flex gap-1">
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>
    )
  }

  // Text Mode (Original Layout)
  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">
                Start a conversation
              </h2>
              <p className="mt-2 text-muted-foreground">
                Send a message to begin chatting with the AI assistant.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))}
            {isLoading && (
              <div className="flex w-full gap-4 px-4 py-6 justify-start border-b border-border">
                <div className="flex max-w-[85%] gap-3 sm:max-w-[75%]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    AI
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <ChatInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  )
}

