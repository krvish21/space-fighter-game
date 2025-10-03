// Audio Management System - Handles all game audio including positional SFX and dynamic music

class AudioManager {
    constructor() {
        const cfg = (window.CONFIG && window.CONFIG.audio) || {};
        this.musicCfg = cfg.dynamicMusic || {};
        this.sfxCfg = cfg.positionalSfx || {};
        
        // Music layers
        this.baseMusic = null;
        this.percussionLayer = null;
        this.bassLayer = null;
        
        // Current audio states
        this.currentPercussionVolume = 0;
        this.currentBassVolume = 0;
        this.targetPercussionVolume = 0;
        this.targetBassVolume = 0;
        
        // Audio context and node tracking for cleanup
        this.audioContext = null;
        this.audioNodes = new Set(); // track all created nodes for cleanup
        this.timeouts = new Set(); // track timeouts for cleanup
        
        this.initializeMusicLayers();
    }
    
    initializeMusicLayers() {
        if (!this.musicCfg.enabled) return;
        
        try {
            // Use existing space music as base layer
            this.baseMusic = new Audio('space.mp3');
            this.baseMusic.loop = true;
            this.baseMusic.volume = this.musicCfg.baseVolume || 0.4;
            
            // Create percussion layer (reuse space.mp3 with different processing)
            this.percussionLayer = new Audio('space.mp3');
            this.percussionLayer.loop = true;
            this.percussionLayer.volume = 0; // Start silent
            this.percussionLayer.playbackRate = 1.1; // Slightly faster for percussion feel
            
            // Create bass layer
            this.bassLayer = new Audio('space.mp3');
            this.bassLayer.loop = true;
            this.bassLayer.volume = 0; // Start silent
            this.bassLayer.playbackRate = 0.8; // Slower, deeper feel
            
        } catch (e) {
            console.warn('AudioManager: Failed to initialize music layers', e);
        }
    }
    
    // Clean up all audio resources
    cleanup() {
        // Clear all timeouts
        for (const timeout of this.timeouts) {
            clearTimeout(timeout);
        }
        this.timeouts.clear();
        
        // Stop and clean music layers
        try {
            if (this.baseMusic) {
                this.baseMusic.pause();
                this.baseMusic.removeAttribute('src');
                this.baseMusic.load(); // Force garbage collection
                this.baseMusic = null;
            }
            if (this.percussionLayer) {
                this.percussionLayer.pause();
                this.percussionLayer.removeAttribute('src');
                this.percussionLayer.load();
                this.percussionLayer = null;
            }
            if (this.bassLayer) {
                this.bassLayer.pause();
                this.bassLayer.removeAttribute('src');
                this.bassLayer.load();
                this.bassLayer = null;
            }
        } catch (e) {
            console.warn('AudioManager: Error cleaning up music layers', e);
        }
        
        // Close audio context and clean up nodes
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                // Disconnect all tracked nodes
                for (const nodeData of this.audioNodes) {
                    try {
                        if (nodeData.audioElement && nodeData.audioElement._audioNode) {
                            nodeData.audioElement._audioNode.disconnect();
                            nodeData.audioElement._audioNode = null;
                        }
                        if (nodeData.audioElement && nodeData.audioElement._panNode) {
                            nodeData.audioElement._panNode.disconnect();
                            nodeData.audioElement._panNode = null;
                        }
                    } catch (e) {
                        // Ignore disconnect errors
                    }
                }
                this.audioNodes.clear();
                
                // Close audio context
                this.audioContext.close();
                this.audioContext = null;
            } catch (e) {
                console.warn('AudioManager: Error closing audio context', e);
            }
        }
    }
    
    playPositionalSound(audioElement, x, y, canvasWidth, canvasHeight) {
        if (!this.sfxCfg.enabled || !audioElement) return;
        
        const maxDistance = this.sfxCfg.maxDistance || 800;
        const minVolume = this.sfxCfg.minVolume || 0.1;
        const maxVolume = this.sfxCfg.maxVolume || 1.0;
        const panStrength = this.sfxCfg.panStrength || 0.8;
        const rolloffFactor = this.sfxCfg.rolloffFactor || 2.0;
        const centerDeadZone = this.sfxCfg.centerDeadZone || 50;
        
        // Calculate distance from screen center
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const distance = Math.hypot(x - centerX, y - centerY);
        
        // Calculate volume based on distance
        const normalizedDistance = Math.min(distance / maxDistance, 1);
        const volumeMultiplier = Math.max(minVolume, maxVolume * Math.pow(1 - normalizedDistance, rolloffFactor));
        
        // Calculate stereo panning
        let pan = 0;
        if (distance > centerDeadZone) {
            const normalizedX = (x - centerX) / (canvasWidth / 2);
            pan = Math.max(-1, Math.min(1, normalizedX * panStrength));
        }
        
        // Apply audio effects
        try {
            if (audioElement.volume !== undefined) {
                audioElement.volume = Math.min(1, audioElement.volume * volumeMultiplier);
            }
            
            // Apply stereo panning if supported
            if (window.AudioContext || window.webkitAudioContext) {
                this.applyStereoPanning(audioElement, pan);
            }
        } catch (e) {
            console.warn('AudioManager: Error applying positional audio', e);
        }
    }
    
    applyStereoPanning(audioElement, pan) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (!audioElement._audioNode) {
                audioElement._audioNode = this.audioContext.createMediaElementSource(audioElement);
                audioElement._panNode = this.audioContext.createStereoPanner();
                audioElement._audioNode.connect(audioElement._panNode);
                audioElement._panNode.connect(this.audioContext.destination);
                
                // Track nodes for cleanup
                this.audioNodes.add({
                    audioElement: audioElement,
                    audioNode: audioElement._audioNode,
                    panNode: audioElement._panNode
                });
            }
            
            if (audioElement._panNode) {
                audioElement._panNode.pan.value = pan;
            }
        } catch (e) {
            console.warn('AudioManager: Stereo panning not supported', e);
        }
    }
    
    // Add setTimeout wrapper to track timeouts
    setTimeout(callback, delay) {
        const timeout = setTimeout(() => {
            this.timeouts.delete(timeout);
            callback();
        }, delay);
        this.timeouts.add(timeout);
        return timeout;
    }
}

// Make it globally available
window.AudioManager = AudioManager;