// Audio Management System - Handles all game audio including positional SFX and dynamic music

// Small AudioManager using WebAudio for SFX (supports overlapping playback and positional panning)
class AudioManager {
    constructor(cfg = {}) {
        this.cfg = cfg || {};
        this.sfxCfg = this.cfg.positionalSfx || {};
        this.sounds = new Map(); // name -> AudioBuffer
        this.soundUrls = new Map(); // name -> original url (for fallback/resolution)
        this.buffersLoaded = false;

        // WebAudio context will be lazily created on first user gesture/play
        this.audioContext = null;

        // Keep track of active nodes so we can cleanly disconnect
        this.activeNodes = new Set();
    }

    ensureAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioManager: WebAudio not supported', e);
                this.audioContext = null;
            }
        }
        return this.audioContext;
    }

    // Load a set of named sounds. soundMap: { name: url }
    async loadSounds(soundMap = {}) {
        const ctx = this.ensureAudioContext();
        const promises = [];
        for (const [name, url] of Object.entries(soundMap)) {
            // remember original url for this name
            try { this.soundUrls.set(name, url); } catch (e) { }
            promises.push(fetch(url)
                .then(res => res.arrayBuffer())
                .then(buf => ctx ? ctx.decodeAudioData(buf) : Promise.resolve(null))
                .then(decoded => {
                    if (decoded) this.sounds.set(name, decoded);
                })
                .catch(err => {
                    console.warn('AudioManager: Failed to load sound', name, url, err);
                }));
        }
        await Promise.all(promises);
        this.buffersLoaded = true;
    }

    // Play a sound by name or URL. If x,y and canvasWidth/Height supplied and panning enabled, apply positional effects.
    // nameOrUrl: either a key previously loaded via loadSounds(name->url) or a URL/filename (e.g. 'power_up.mp3' or './assets/sounds/power_up.mp3')
    async playSound(nameOrUrl, x = null, y = null, canvasWidth = null, canvasHeight = null, opts = {}) {
        const ctx = this.ensureAudioContext();

        // Helper to actually play a decoded buffer via WebAudio
        const playBuffer = (buffer) => {
            try {
                if (!ctx || !buffer) return false;
                if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => { });

                const src = ctx.createBufferSource();
                src.buffer = buffer;
                const gain = ctx.createGain();
                gain.gain.value = (opts.volume != null) ? opts.volume : 1.0;

                let panNode = null;
                if (typeof ctx.createStereoPanner === 'function' && x != null && canvasWidth) {
                    panNode = ctx.createStereoPanner();
                    panNode.pan.value = this._calculatePan(x, canvasWidth);
                }

                src.connect(gain);
                if (panNode) {
                    gain.connect(panNode);
                    panNode.connect(ctx.destination);
                } else {
                    gain.connect(ctx.destination);
                }

                const nodeGroup = { src, gain, panNode };
                this.activeNodes.add(nodeGroup);
                src.onended = () => {
                    try {
                        if (panNode) panNode.disconnect();
                        gain.disconnect();
                        src.disconnect();
                    } catch (e) { }
                    this.activeNodes.delete(nodeGroup);
                };
                src.start(0);
                return true;
            } catch (e) {
                console.warn('AudioManager: playBuffer failed', e);
                return false;
            }
        };

        // If a preloaded key exists, play it. Also try base name without extension (e.g. 'power_up' when passed 'power_up.mp3')
        let buffer = this.sounds.get(nameOrUrl);
        if (!buffer) {
            const baseKey = nameOrUrl && String(nameOrUrl).replace(/\.\w+$/, '');
            if (baseKey && this.sounds.has(baseKey)) buffer = this.sounds.get(baseKey);
        }
        // If we still don't have a buffer, but we have a recorded URL for this key, try to fetch/decode that URL
        if (!buffer && this.soundUrls.has(nameOrUrl)) {
            const url = this.soundUrls.get(nameOrUrl);
            if (ctx && url) {
                try {
                    const res = await fetch(url);
                    const arr = await res.arrayBuffer();
                    const decoded = await ctx.decodeAudioData(arr);
                    if (decoded) {
                        this.sounds.set(nameOrUrl, decoded);
                        buffer = decoded;
                    }
                } catch (e) {
                    console.warn('AudioManager: failed to fetch/decode stored url', url, e);
                }
            }
        }
        if (ctx && buffer) {
            return playBuffer(buffer);
        }

        // If nameOrUrl looks like a filename or URL (contains '/' or ends with .mp3/.wav/.ogg), attempt to fetch and decode it
        const looksLikeUrl = /[\/]|\.(mp3|wav|ogg|m4a)$/i.test(nameOrUrl);
        if (looksLikeUrl) {
            // Build a usable URL: if nameOrUrl is a bare filename, resolve using basePath
            let url = nameOrUrl;
            if (!/^[a-zA-Z0-9]+:\/\//.test(nameOrUrl) && !nameOrUrl.startsWith('.') && !nameOrUrl.startsWith('/')) {
                // bare filename like 'power_up.mp3'
                url = (this.cfg.basePath || './assets/sounds') + '/' + nameOrUrl;
            }

            if (ctx) {
                // try to fetch and decode
                try {
                    const res = await fetch(url);
                    const arr = await res.arrayBuffer();
                    const decoded = await ctx.decodeAudioData(arr);
                    // cache it under the original nameOrUrl for next time
                    this.sounds.set(nameOrUrl, decoded);
                    return playBuffer(decoded);
                } catch (e) {
                    console.warn('AudioManager: failed to fetch/decode', url, e);
                }
            }

            // Fallback to HTMLAudio element if WebAudio not available or decode failed
            try {
                const audio = new Audio(url);
                audio.volume = (opts.volume != null) ? opts.volume : 1.0;
                audio.play().catch(() => { });
                return true;
            } catch (e) {
                console.warn('AudioManager: fallback audio failed', e);
            }
            return false;
        }

        // As a last resort, try to play by constructing a URL from basePath + nameOrUrl
        try {
            const url = (this.cfg.basePath || './assets/sounds') + '/' + nameOrUrl + '.mp3';
            if (ctx) {
                const res = await fetch(url);
                const arr = await res.arrayBuffer();
                const decoded = await ctx.decodeAudioData(arr);
                this.sounds.set(nameOrUrl, decoded);
                return playBuffer(decoded);
            }
            const audio = new Audio(url);
            audio.volume = (opts.volume != null) ? opts.volume : 1.0;
            audio.play().catch(() => { });
            return true;
        } catch (e) {
            console.warn('AudioManager: failed to play', nameOrUrl, e);
            return false;
        }
    }

    _calculatePan(x, canvasWidth) {
        const centerX = canvasWidth / 2;
        const normalizedX = (x - centerX) / (canvasWidth / 2);
        const panStrength = (this.sfxCfg && this.sfxCfg.panStrength) || 0.8;
        return Math.max(-1, Math.min(1, normalizedX * panStrength));
    }

    // Stop and free resources
    cleanup() {
        try {
            for (const n of this.activeNodes) {
                try {
                    if (n.src) n.src.stop(0);
                    if (n.panNode) n.panNode.disconnect();
                    if (n.gain) n.gain.disconnect();
                    if (n.src) n.src.disconnect();
                } catch (e) { }
            }
            this.activeNodes.clear();
            if (this.audioContext && this.audioContext.state !== 'closed') {
                try { this.audioContext.close(); } catch (e) { }
            }
            this.audioContext = null;
        } catch (e) {
            console.warn('AudioManager: cleanup error', e);
        }
    }
}

window.AudioManager = AudioManager;