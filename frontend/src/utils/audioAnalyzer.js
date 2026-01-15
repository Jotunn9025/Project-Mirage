/**
 * Audio Analyzer - Extracts voice features using Meyda.js
 * Runs in browser, no backend processing needed
 */

import Meyda from 'meyda';

export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyzer = null;
        this.stream = null;
        this.isAnalyzing = false;
        this.onFeaturesExtracted = null;
    }

    /**
     * Initialize audio context and request microphone access
     */
    async initialize() {
        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create media stream source
            const source = this.audioContext.createMediaStreamSource(this.stream);

            // Initialize Meyda
            this.analyzer = Meyda.createMeydaAnalyzer({
                audioContext: this.audioContext,
                source: source,
                bufferSize: 512,
                featureExtractors: [
                    'rms',           // Root Mean Square (volume/energy)
                    'spectralCentroid',
                    'spectralFlatness',
                    'zcr',           // Zero Crossing Rate
                    'energy',
                    'loudness'
                ],
                callback: (features) => {
                    if (this.isAnalyzing && this.onFeaturesExtracted) {
                        const voiceFeatures = this.extractVoiceFeatures(features);
                        this.onFeaturesExtracted(voiceFeatures);
                    }
                }
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            throw error;
        }
    }

    /**
     * Extract and normalize voice features from Meyda output
     */
    extractVoiceFeatures(meydaFeatures) {
        // Track peak RMS for dynamic normalization
        if (!this.peakRMS) this.peakRMS = 0.1;
        if (meydaFeatures.rms > this.peakRMS) {
            this.peakRMS = meydaFeatures.rms;
        } else {
            // Slowly decay peak to adapt to quieter environments
            this.peakRMS *= 0.999;
        }

        // Energy: Based on RMS and loudness, dynamically scaled
        const energy = this.normalizeEnergy(
            meydaFeatures.rms,
            meydaFeatures.loudness?.total || 0
        );

        // Confidence: Based on spectral flatness (inverse) and pitch stability
        const confidence = this.normalizeConfidence(
            meydaFeatures.spectralFlatness,
            meydaFeatures.spectralCentroid
        );

        // Stress: Based on ZCR and high-frequency tension
        const stress = this.normalizeStress(
            meydaFeatures.zcr,
            meydaFeatures.spectralCentroid
        );

        // Tempo: Based on energy variance
        const tempo = this.normalizeTempo(meydaFeatures.energy);

        // Clarity: Based on sibilance and spectral clarity
        const clarity = this.normalizeClarity(
            meydaFeatures.spectralCentroid,
            meydaFeatures.spectralFlatness
        );

        const currentFeatures = {
            energy: isNaN(energy) ? 0.0 : this.clamp(energy),
            confidence: isNaN(confidence) ? 0.5 : this.clamp(confidence),
            stress: isNaN(stress) ? 0.5 : this.clamp(stress),
            tempo: isNaN(tempo) ? 0.5 : this.clamp(tempo),
            clarity: isNaN(clarity) ? 0.5 : this.clamp(clarity)
        };

        // Smoothing buffer to prevent rapid flickering
        if (!this.smoothedFeatures) {
            this.smoothedFeatures = currentFeatures;
        } else {
            const alpha = 0.15; // Smoothing factor (lower = smoother)
            for (let key in currentFeatures) {
                this.smoothedFeatures[key] = (alpha * currentFeatures[key]) + ((1 - alpha) * this.smoothedFeatures[key]);
            }
        }

        return { ...this.smoothedFeatures };
    }

    /**
     * Normalize energy (0.0 = whisper, 1.0 = shouting)
     */
    normalizeEnergy(rms, loudness) {
        // Use a much more sensitive baseline for web mics
        // Normal speech usually averages 0.05-0.1 RMS
        const rmsSensitive = Math.min(rms / Math.max(0.05, this.peakRMS * 0.8), 1.0);

        // Perceived loudness (Sones) ranges 0-64, speech is often 2-15
        const loudnessNormalized = Math.min(Math.abs(loudness) / 20, 1.0);

        // Boost low energy to avoid constant lethargic state
        let energy = (rmsSensitive * 0.7 + loudnessNormalized * 0.3);

        // Non-linear boost for speech range
        if (energy > 0.01) energy = Math.pow(energy, 0.7);

        return energy;
    }

    /**
     * Normalize confidence (0.0 = timid, 1.0 = dominant)
     */
    normalizeConfidence(spectralFlatness, spectralCentroid) {
        // Voice is more confident when it's tonal (lower flatness)
        const toneWeight = 1.0 - spectralFlatness;

        // Mid-range centroid (800-2500Hz) is usually stable speech
        const centroidStability = spectralCentroid > 800 && spectralCentroid < 2500 ? 0.8 : 0.4;

        return (toneWeight * 0.5 + centroidStability * 0.5);
    }

    /**
     * Normalize stress (0.0 = relaxed, 1.0 = panicked)
     */
    normalizeStress(zcr, spectralCentroid) {
        // Higher ZCR + High frequency centroid = tension
        const zcrNormalized = Math.min(zcr / 0.4, 1.0);
        const highFreqTension = spectralCentroid > 3000 ? Math.min((spectralCentroid - 3000) / 2000, 1.0) : 0.2;

        return (zcrNormalized * 0.4 + highFreqTension * 0.6);
    }

    /**
     * Normalize tempo (0.0 = slow, 1.0 = rapid)
     */
    normalizeTempo(energy) {
        if (!this.energyHistory) this.energyHistory = [];
        this.energyHistory.push(energy);
        if (this.energyHistory.length > 20) this.energyHistory.shift();

        if (this.energyHistory.length < 5) return 0.5;

        // Tempo derived from energy transitions (flux)
        let flux = 0;
        for (let i = 1; i < this.energyHistory.length; i++) {
            flux += Math.abs(this.energyHistory[i] - this.energyHistory[i - 1]);
        }

        return Math.min(flux * 2.5, 1.0);
    }

    /**
     * Normalize clarity (0.0 = mumbled, 1.0 = crisp)
     */
    normalizeClarity(spectralCentroid, spectralFlatness) {
        // High clarity = strong sibilance (high centroid) but tonal vowels
        const sibilance = spectralCentroid > 2000 ? 0.7 : 0.3;
        const tone = 1.0 - spectralFlatness;

        return (sibilance * 0.4 + tone * 0.6);
    }

    /**
     * Clamp value to 0.0-1.0 range
     */
    clamp(value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    /**
     * Start analyzing audio
     */
    start(callback) {
        this.onFeaturesExtracted = callback;
        this.isAnalyzing = true;
        if (this.analyzer) {
            this.analyzer.start();
        }
    }

    /**
     * Stop analyzing audio
     */
    stop() {
        this.isAnalyzing = false;
        if (this.analyzer) {
            this.analyzer.stop();
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stop();

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.analyzer = null;
        this.audioContext = null;
        this.stream = null;
    }
}
