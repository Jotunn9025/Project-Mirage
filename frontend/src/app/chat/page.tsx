"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { ChatContainer, Message } from "@/components/chat/chat-container"
import { ChatModeToggle, ChatMode } from "@/components/chat/chat-mode-toggle"
import { AvatarSelector, AvatarOption } from "@/components/chat/avatar-selector"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function ChatPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>("text")

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!user || !selectedAvatar) {
        return
      }

      // Add user message immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        // Prepare messages for API (last 10 messages for context)
        // Include system message with avatar personality
        const systemMessage = {
          role: "user" as const,
          content: `You are ${selectedAvatar.name}. ${selectedAvatar.personality} Your traits are: ${selectedAvatar.traits.join(", ")}. Respond in character.`,
        }

        const recentMessages = [...messages, userMessage].slice(-10)
        const apiMessages = [
          systemMessage,
          ...recentMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        ]

        // Call Gemini API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: apiMessages }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to get response from AI")
        }

        const data = await response.json()

        // Generate assistant response
        const assistantResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.text || "I'm sorry, I couldn't generate a response.",
        }

        setMessages((prev) => [...prev, assistantResponse])
      } catch (error: any) {
        console.error("Error sending message:", error)
        // Show error message to user
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, I encountered an error: ${error.message || "Unknown error"}. Please try again.`,
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, user, selectedAvatar]
  )

  // Show loading while checking auth
  if (authLoading) {
    return (
      <>
        <Header />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center pt-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  // Don't render chat if not authenticated
  if (!user) {
    return null
  }

  // Show avatar selection if no avatar is selected
  if (!selectedAvatar) {
    return (
      <>
        <Header />
        <div className="flex h-[calc(100vh-4rem)] flex-col pt-16">
          <AvatarSelector onSelect={setSelectedAvatar} />
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="flex h-[calc(100vh-4rem)] flex-col pt-16">
        {/* Chat Mode Toggle */}
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Chatting with:</span>
              <span className="text-sm font-medium text-foreground">{selectedAvatar.name}</span>
            </div>
            <ChatModeToggle mode={chatMode} onModeChange={setChatMode} />
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 min-h-0">
          <ChatContainer
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            mode={chatMode}
            glbPath={selectedAvatar.glbPath}
          />
        </div>
      </div>
    </>
  )
}

