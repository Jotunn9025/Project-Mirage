import React, { useState, useEffect, useRef } from 'react';
import Avatar from './components/Avatar';
import Dashboard from './components/Dashboard';
import { AudioAnalyzer } from './utils/audioAnalyzer';
import './App.css';

const WEBSOCKET_URL = 'ws://localhost:8000/ws';

function App() {
    const [isListening, setIsListening] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [voiceFeatures, setVoiceFeatures] = useState(null);
    const [personalityProfile, setPersonalityProfile] = useState(null);
    const [emotionalState, setEmotionalState] = useState('');
    const [momentum, setMomentum] = useState(null);
    const [intent, setIntent] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const audioAnalyzerRef = useRef(null);
    const websocketRef = useRef(null);
    const clientIdRef = useRef(`client_${Date.now()}`);
    const lastAnalysisTimeRef = useRef(0);
    const latestFeaturesRef = useRef(null);
    const [history, setHistory] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        // Connect to WebSocket on mount
        connectWebSocket();

        return () => {
            // Cleanup on unmount
            if (websocketRef.current) {
                websocketRef.current.close();
            }
            if (audioAnalyzerRef.current) {
                audioAnalyzerRef.current.destroy();
            }
        };
    }, []);

    const connectWebSocket = () => {
        try {
            const ws = new WebSocket(`${WEBSOCKET_URL}/${clientIdRef.current}`);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setError('');
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setIsAnalyzing(false);

                if (data.type === 'personality_update') {
                    setVoiceFeatures(data.voice_features);
                    setPersonalityProfile(data.personality_profile);
                    setEmotionalState(data.emotional_state);
                    setMomentum(data.momentum);
                    setIntent(data.intent);
                    setReason(data.reason);
                } else if (data.type === 'error') {
                    console.error('Server error:', data.message);
                    setError(data.message);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setError('WebSocket connection error. Make sure the backend is running.');
                setIsConnected(false);
                setIsAnalyzing(false);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                setIsAnalyzing(false);

                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!websocketRef.current || websocketRef.current.readyState === WebSocket.CLOSED) {
                        connectWebSocket();
                    }
                }, 3000);
            };

            websocketRef.current = ws;
        } catch (err) {
            console.error('Failed to connect WebSocket:', err);
            setError('Failed to connect to server');
        }
    };

    const analyzeNow = () => {
        if (latestFeaturesRef.current && websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            setIsAnalyzing(true);

            // Safety timeout: If backend doesn't respond in 10s, clear analyzing state
            setTimeout(() => setIsAnalyzing(false), 10000);

            websocketRef.current.send(JSON.stringify({
                type: 'voice_data',
                voice_features: latestFeaturesRef.current,
                user_text: ''
            }));
            lastAnalysisTimeRef.current = Date.now();
        }
    };

    const startListening = async () => {
        try {
            setError('');
            setIsAnalyzing(false); // Reset any stuck state
            // Clear old session data
            setPersonalityProfile(null);
            setMomentum(null);
            setIntent('');
            setReason('');
            setEmotionalState('Initializing...');
            setHistory([]); // Reset history on start

            // Initialize audio analyzer if not already done
            if (!audioAnalyzerRef.current) {
                audioAnalyzerRef.current = new AudioAnalyzer();
                await audioAnalyzerRef.current.initialize();
            }

            // Start analyzing
            audioAnalyzerRef.current.start((features) => {
                latestFeaturesRef.current = features;
                const now = Date.now();

                // Real-time local state update for the UI bars
                setVoiceFeatures(features);
                setHistory(prev => [...prev.slice(-49), { ...features, time: now }]);

                // Throttle: Automatic analysis every 3 seconds to preserve API quota
                if (now - lastAnalysisTimeRef.current > 3000) {
                    setIsAnalyzing(true);

                    // Safety timeout
                    setTimeout(() => setIsAnalyzing(false), 10000);

                    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                        websocketRef.current.send(JSON.stringify({
                            type: 'voice_data',
                            voice_features: features,
                            user_text: ''
                        }));
                        lastAnalysisTimeRef.current = now;
                    }
                }
            });

            setIsListening(true);
        } catch (err) {
            console.error('Failed to start listening:', err);
            setError('Failed to access microphone. Please grant permission.');
            setIsAnalyzing(false);
        }
    };

    const stopListening = () => {
        // Show status that we are finishing up
        setEmotionalState('Finalizing profile...');

        // Trigger one last analysis ONLY if connected
        if (isConnected && websocketRef.current?.readyState === WebSocket.OPEN) {
            if (latestFeaturesRef.current) {
                analyzeNow();
            }
        } else {
            // If disconnected, reset state immediately
            setIsAnalyzing(false);
            setEmotionalState('Session ended');
        }

        // Give it a moment to send the packet, then shut down local analyzer COMPLETELY
        setTimeout(() => {
            if (audioAnalyzerRef.current) {
                audioAnalyzerRef.current.stop();
            }
            setIsListening(false);

            // Force-clear 'Analyzing' state after a brief delay
            // This prevents getting stuck if the final API call hangs
            setTimeout(() => {
                setIsAnalyzing(false);
            }, 1000);
        }, 500);
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <div className="container">
                    <h1 className="app-title">
                        <span className="gradient-text">XAI Personality Engine</span>
                    </h1>
                    <p className="app-subtitle">
                        Transparent Decision Logic & Real-Time Voice Analysis
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                <div className="container">
                    {/* Error Display */}
                    {error && (
                        <div className="error-banner">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                    {/* Connection Status */}
                    <div className="status-bar">
                        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                            <span className="status-dot"></span>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </div>
                        <div className={`status-indicator ${isListening ? 'listening' : 'idle'}`}>
                            <span className="status-dot"></span>
                            {isListening ? 'Listening' : 'Idle'}
                        </div>
                    </div>

                    {/* Avatar and Controls */}
                    <div className="main-section">
                        <div className="avatar-section">
                            <Avatar
                                personalityProfile={personalityProfile}
                                emotionalState={emotionalState}
                                isListening={isListening}
                                voiceFeatures={voiceFeatures}
                            />

                            <div className="analysis-status">
                                {isAnalyzing && (
                                    <div className="analyzing-indicator">
                                        <div className="brain-pulse"></div>
                                        <span>Analyzing...</span>
                                    </div>
                                )}
                            </div>

                            <div className="controls">
                                {!isListening ? (
                                    <button
                                        className="btn btn-primary"
                                        onClick={startListening}
                                        disabled={!isConnected}
                                    >
                                        <span className="btn-icon">🎤</span>
                                        Start Listening
                                    </button>
                                ) : (
                                    <div className="active-controls">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={stopListening}
                                        >
                                            <span className="btn-icon">⏸️</span>
                                            Stop
                                        </button>
                                        <button
                                            className="btn btn-accent"
                                            onClick={analyzeNow}
                                            disabled={isAnalyzing}
                                        >
                                            <span className="btn-icon">🧠</span>
                                            Analyze Now
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!isConnected && (
                                <div className="connection-help">
                                    <p>⚠️ Backend not connected</p>
                                    <p className="help-text">
                                        Make sure the backend server is running:
                                        <code>cd backend && uvicorn main:app --reload</code>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Dashboard */}
                        <div className="dashboard-section">
                            <Dashboard
                                voiceFeatures={voiceFeatures}
                                personalityProfile={personalityProfile}
                                momentum={momentum}
                                intent={intent}
                                reason={reason}
                                history={history}
                                isListening={isListening}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <div className="container">
                    <p>
                        <strong>XAI CORE v1.0</strong> • Proprietary Decision Engine • Real-Time Voice Synthesis
                    </p>
                    <p className="footer-note">
                        Advanced Explainable AI Architecture
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default App;
