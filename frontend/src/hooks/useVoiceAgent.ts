"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface VoiceAgentConfig {
    characterName: string
    characterInfo: string
    userName: string
}

const VOICE_AGENT_URL = process.env.NEXT_PUBLIC_VOICE_AGENT_URL || "http://127.0.0.1:7860"

export function useVoiceAgent() {
    const [status, setStatus] = useState<ConnectionStatus>("disconnected")
    const [error, setError] = useState<string | null>(null)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [history, setHistory] = useState<any[]>([])

    const pcRef = useRef<RTCPeerConnection | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const dataChannelRef = useRef<RTCDataChannel | null>(null)

    const sendIceCandidate = async (pcId: string, candidate: RTCIceCandidate) => {
        try {
            await fetch(`${VOICE_AGENT_URL}/api/offer`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pc_id: pcId,
                    candidates: [{
                        candidate: candidate.candidate,
                        sdp_mid: candidate.sdpMid,
                        sdp_mline_index: candidate.sdpMLineIndex
                    }]
                })
            })
        } catch (err) {
            console.error("Failed to send ICE candidate:", err)
        }
    }

    const setupDataChannel = (channel: RTCDataChannel) => {
        dataChannelRef.current = channel

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === "history_update" || data.type === "history_response") {
                    setHistory(data.history)
                } else if (data.type === "status" && data.session_id) {
                    setSessionId(data.session_id)
                }
            } catch (err) {
                console.error("Failed to parse data channel message:", err)
            }
        }

        channel.onopen = () => {
            channel.send(JSON.stringify({ type: "get_history" }))
        }
    }

    const connect = useCallback(async (config: VoiceAgentConfig) => {
        setStatus("connecting")
        setError(null)

        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const configuration: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
            const pc = new RTCPeerConnection(configuration)
            pcRef.current = pc

            const pendingIceCandidates: RTCIceCandidate[] = []
            let canSendIceCandidates = false
            let pcId: string | null = null

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    if (canSendIceCandidates && pcId) {
                        sendIceCandidate(pcId, event.candidate)
                    } else {
                        pendingIceCandidates.push(event.candidate)
                    }
                }
            }

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") setStatus("connected")
                else if (pc.connectionState === "disconnected" || pc.connectionState === "closed" || pc.connectionState === "failed") {
                    setStatus("disconnected")
                }
            }

            pc.ontrack = (event) => {
                if (audioRef.current) {
                    audioRef.current.srcObject = event.streams[0]
                }
            }

            pc.ondatachannel = (event) => {
                setupDataChannel(event.channel)
            }

            pc.addTransceiver(audioStream.getAudioTracks()[0], { direction: "sendrecv" })
            pc.addTransceiver("video", { direction: "sendrecv" }) // Bot might send video (though our current one is audio only)

            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            const response = await fetch(`${VOICE_AGENT_URL}/api/offer`, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type,
                    character_name: config.characterName,
                    character_info: config.characterInfo,
                    user_name: config.userName
                }),
            })

            if (!response.ok) throw new Error("Failed to get offer response from server")

            const answer = await response.json()
            pcId = answer.pc_id
            setSessionId(answer.session_id)

            await pc.setRemoteDescription(new RTCSessionDescription(answer))

            canSendIceCandidates = true
            for (const candidate of pendingIceCandidates) {
                await sendIceCandidate(pcId!, candidate)
            }
        } catch (err: any) {
            console.error("Connection failed:", err)
            setStatus("error")
            setError(err.message || "Failed to connect to voice agent")
        }
    }, [])

    const disconnect = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close()
            pcRef.current = null
        }
        dataChannelRef.current = null
        setSessionId(null)
        setStatus("disconnected")
    }, [])

    return {
        status,
        error,
        sessionId,
        history,
        connect,
        disconnect,
        audioRef
    }
}
