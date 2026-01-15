import React, { useEffect, useRef } from 'react';
import './Avatar.css';

const Avatar = ({ emotionalState, isListening, voiceFeatures }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let frame = 0;

        const draw = () => {
            frame++;
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);

            const energy = voiceFeatures?.energy || 0;
            const stress = voiceFeatures?.stress || 0;

            const centerX = width / 2;
            const centerY = height / 2;

            // High-Tech Aura
            const auraRadius = 90 + energy * 30;
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
            ctx.strokeStyle = isListening ? (stress > 0.7 ? 'rgba(255, 75, 75, 0.2)' : 'rgba(0, 204, 136, 0.2)') : 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 10]);
            ctx.lineDashOffset = -frame * 0.2;
            ctx.stroke();
            ctx.restore();

            // Main Head (Glassy)
            const radius = 130 + energy * 20; // Increased base size from 80

            // Inner Glow
            const innerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            innerGlow.addColorStop(0, 'rgba(30, 34, 42, 0.95)');
            innerGlow.addColorStop(0.8, 'rgba(15, 17, 21, 1)');
            innerGlow.addColorStop(1, isListening ? (stress > 0.7 ? '#ff4b4b' : '#00875a') : 'rgba(255,255,255,0.15)');

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = innerGlow;
            ctx.fill();

            // Rim Highlight
            ctx.shadowBlur = 15 + energy * 20;
            ctx.shadowColor = isListening ? (stress > 0.7 ? '#ff4b4b' : '#00ff8e') : 'transparent';
            ctx.strokeStyle = isListening ? (stress > 0.7 ? '#ff4b4b' : '#00875a') : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Eyes - Premium Digital
            const eyeXOffset = 60 + energy * 10; // Widened for the larger head
            const eyeY = centerY - 25;
            const eyeWidth = 35;
            const eyeHeight = isListening ? (14 + energy * 30) : 4;

            ctx.fillStyle = isListening ? (stress > 0.7 ? '#ff4b4b' : '#00ff8e') : 'rgba(255,255,255,0.3)';

            // Left Eye
            ctx.beginPath();
            if (isListening) {
                ctx.ellipse(centerX - eyeXOffset, eyeY, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2);
            } else {
                ctx.roundRect(centerX - eyeXOffset - 10, eyeY, 20, 3, 2);
            }
            ctx.fill();

            // Right Eye
            ctx.beginPath();
            if (isListening) {
                ctx.ellipse(centerX + eyeXOffset, eyeY, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2);
            } else {
                ctx.roundRect(centerX + eyeXOffset - 10, eyeY, 20, 3, 2);
            }
            ctx.fill();

            // Mouth - Premium Reactive Line
            const mouthWidth = 50 + energy * 80;
            const mouthY = centerY + 35;

            ctx.beginPath();
            ctx.moveTo(centerX - mouthWidth / 2, mouthY);
            if (isListening) {
                const curveHeight = energy * 50;
                ctx.quadraticCurveTo(centerX, mouthY + curveHeight, centerX + mouthWidth / 2, mouthY);
            } else {
                ctx.lineTo(centerX + mouthWidth / 2, mouthY);
            }
            ctx.strokeStyle = isListening ? (stress > 0.7 ? '#ff4b4b' : '#00ff8e') : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Status Dots
            if (isListening) {
                for (let i = 0; i < 3; i++) {
                    const angle = frame * 0.05 + (i * Math.PI * 2 / 3);
                    const dotX = centerX + Math.cos(angle) * (radius + 15);
                    const dotY = centerY + Math.sin(angle) * (radius + 15);
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
                    ctx.fillStyle = stress > 0.7 ? '#ff4b4b' : '#00ff8e';
                    ctx.fill();
                }
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationRef.current);
    }, [voiceFeatures, isListening]);

    return (
        <div className="avatar-container">
            <canvas ref={canvasRef} width="300" height="300" className="avatar-canvas" />
            <div className="avatar-meta">
                <div className={`status-pill ${isListening ? 'active' : 'idle'}`}>
                    {isListening ? 'RECOGNIZING SIGNAL' : 'SYSTEM IDLE'}
                </div>
                <div className="mood-label">
                    {emotionalState || 'Calibrating...'}
                </div>
            </div>
        </div>
    );
};

export default Avatar;
