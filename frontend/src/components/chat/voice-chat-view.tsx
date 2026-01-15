"use client"

import { useEffect, useRef } from "react"
import { useVoiceAgent } from "@/hooks/useVoiceAgent"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceChatViewProps {
    characterName: string
    characterInfo: string
    className?: string
}

export function VoiceChatView({ characterName, characterInfo, className }: VoiceChatViewProps) {
    const { user } = useAuth()
    const {
        status,
        error,
        history,
        connect,
        disconnect,
        audioRef
    } = useVoiceAgent()
    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom when history changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [history])

    const isConnected = status === "connected"
    const isConnecting = status === "connecting"

    const handleToggleConnection = () => {
        if (isConnected || isConnecting) {
            disconnect()
        } else {
            connect({
                characterName,
                characterInfo,
                userName: user?.displayName || user?.email?.split("@")[0] || "Guest"
            })
        }
    }

    // Auto-disconnect on unmount
    useEffect(() => {
        return () => disconnect()
    }, [disconnect])

    return (
        <div className={cn("flex flex-col h-full bg-background/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden", className)}>
            {/* Audio element for voice playback */}
            <audio ref={audioRef} autoPlay />

            {/* Header / Status */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2.5 h-2.5 rounded-full animate-pulse",
                        status === "connected" ? "bg-green-500" :
                            status === "connecting" ? "bg-yellow-500" :
                                status === "error" ? "bg-red-500" : "bg-muted-foreground"
                    )} />
                    <span className="text-sm font-medium capitalize">
                        {status}
                    </span>
                </div>

                <Button
                    variant={isConnected ? "destructive" : "default"}
                    size="sm"
                    onClick={handleToggleConnection}
                    disabled={isConnecting}
                    className="gap-2"
                >
                    {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isConnected ? (
                        <MicOff className="h-4 w-4" />
                    ) : (
                        <Mic className="h-4 w-4" />
                    )}
                    {isConnected ? "End Call" : isConnecting ? "Connecting..." : "Start Call"}
                </Button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{error}</span>
                    <button onClick={() => connect({ characterName, characterInfo, userName: user?.displayName || "Guest" })} className="ml-auto underline">
                        Retry
                    </button>
                </div>
            )}

            {/* History Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Mic className="h-8 w-8 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">No voice messages yet</p>
                            <p className="text-xs mt-1 max-w-[200px]">
                                Click the button above to start a live voice conversation with {characterName}.
                            </p>
                        </div>
                    ) : (
                        history.filter(m => m.role !== 'system').map((msg, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex flex-col gap-1 max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                                    msg.role === "user" ? "ml-auto items-end" : "items-start"
                                )}
                            >
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">
                                    {msg.role} {msg.emotion && `• ${msg.emotion}`}
                                </span>
                                <div className={cn(
                                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-none"
                                        : "bg-muted border border-border rounded-tl-none"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Visualizer / Active State */}
            {isConnected && (
                <div className="p-4 bg-muted/20 border-t border-border">
                    <div className="flex items-center justify-center gap-1.5 h-8">
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-primary rounded-full animate-voice-bar"
                                style={{
                                    height: "20%",
                                    animationDelay: `${i * 0.1}s`,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-widest">
                        Listening for your voice...
                    </p>
                </div>
            )}
        </div>
    )
}
