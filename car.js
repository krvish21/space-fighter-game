class Car {
    constructor(pos, size, color) {
        this.posX = pos.x;
        this.posY = pos.y;
        this.width = size.w;
        this.height = size.h;
        this.color = color;
        this.glowColor = '';
        this.glowBlur = 3;

        this.velocityX = 0;
        this.velocityY = 0;
        this.maxSpeed = 15; // higher base speed
        this.acceleration = 1; // snappier acceleration
        this.deceleration = 0.2;
        this.rotation = 0;
        this.targetRotation = 0;
        this.rotationSpeed = 0.1;

        this.isDriving = false;
        this.drivingSound = new Audio('./assets/sounds/space.mp3');
        this.drivingSound.loop = true;
        this.drivingSound.volume = 0.5;
        this.audioPlaying = false;

		// Background space music
		this.spaceMusic = new Audio('./assets/sounds/space.mp3');
		this.spaceMusic.loop = true;
		this.spaceMusic.volume = 0.4;
		this.spaceMusicPlaying = false;

        // Spaceship render state
        this.thrustPhase = 0;

        // Feedback visuals
        this.feedbackTimer = 0; // frames remaining
        this.feedbackColor = 'transparent';

        // Health system
        this.maxHealth = 1.0; // normalized 0..1
        this.health = this.maxHealth;
        this.hitCount = 0;
        this.healthDecayPerFrame = 0.0001; // slow drain per frame
        
        // Idle decay system
        this.lastMovementTime = performance.now(); // initialize to current time
        this.idleDecayMultiplier = 1.0; // current decay multiplier
        this.isCurrentlyIdle = false;

        // Speed boost
		this.baseMaxSpeed = (window.CONFIG && window.CONFIG.speed && window.CONFIG.speed.base) || this.maxSpeed;
		this.speedBoostTimerMs = 0; // milliseconds remaining
		this.speedBoostAmount = 0; // computed extra speed during boost

		// Invincibility shield
		this.invincibleHitsRemaining = 0; // counts down on collisions
		this.shieldPickupTime = 0; // ms timestamp when shield was picked

		// Magnet power-up
		this.magnetTimerMs = 0;
        
        // Damage decals system
        this.damageDecals = [];
    }

    draw(ctx) {
        ctx.save();

        ctx.translate(this.posX + this.width / 2, this.posY + this.height / 2);
        ctx.rotate(this.rotation);

        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = this.glowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw fighter-jet style spaceship
        const w = this.width;
        const h = this.height;

        // Main fuselage (sleek arrow with spine)
        ctx.fillStyle = '#CFD8DC';
        ctx.strokeStyle = '#90A4AE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.55, 0);               // sharp nose
        ctx.lineTo(w * 0.15, -h * 0.22);
        ctx.lineTo(-w * 0.35, -h * 0.28);      // aft taper top
        ctx.lineTo(-w * 0.35, h * 0.28);       // aft taper bottom
        ctx.lineTo(w * 0.15, h * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Canopy (cockpit bubble)
        ctx.fillStyle = '#64B5F6';
        ctx.strokeStyle = '#1E88E5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(w * 0.05, -h * 0.08, w * 0.16, h * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Swept wings
        ctx.fillStyle = '#B0BEC5';
        ctx.strokeStyle = '#90A4AE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.05, -h * 0.18);
        ctx.lineTo(-w * 0.15, -h * 0.05);
        ctx.lineTo(-w * 0.45, -h * 0.30);
        ctx.lineTo(-w * 0.2, -h * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.18);
        ctx.lineTo(-w * 0.15, h * 0.05);
        ctx.lineTo(-w * 0.45, h * 0.30);
        ctx.lineTo(-w * 0.2, h * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tail fins (vertical stabilizers)
        ctx.fillStyle = '#B0BEC5';
        ctx.beginPath();
        ctx.moveTo(-w * 0.30, -h * 0.16);
        ctx.lineTo(-w * 0.42, -h * 0.04);
        ctx.lineTo(-w * 0.30, -h * 0.00);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-w * 0.30, h * 0.16);
        ctx.lineTo(-w * 0.42, h * 0.04);
        ctx.lineTo(-w * 0.30, h * 0.00);
        ctx.closePath();
        ctx.fill();

        // Thruster flame (animated)
        const speed = Math.hypot(this.velocityX, this.velocityY);
        const thrust = Math.min(1, speed / (this.maxSpeed || 1)) * 1.1 + ((this.speedBoostTimerMs || 0) > 0 ? 0.4 : 0);
        const isBoosting = (this.speedBoostTimerMs || 0) > 0;
        const flameLen = w * (0.4 + thrust * 0.8) * (isBoosting ? 1.15 : 1);
        const flicker = (Math.sin(this.thrustPhase) + 1) * 0.5; // 0..1
        const len = flameLen * (0.8 + 0.2 * flicker);
        ctx.save();
        ctx.translate(-w * 0.42, 0); // rear origin
        const grad = ctx.createLinearGradient(-len, 0, 0, 0);
        grad.addColorStop(0, 'rgba(255,140,0,0.0)');
        grad.addColorStop(0.4, isBoosting ? 'rgba(255,120,50,0.95)' : 'rgba(255,87,34,0.8)');
        grad.addColorStop(1, 'rgba(255,235,59,0.9)');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#FFEB3B';
        ctx.shadowBlur = 15 + 10 * thrust + (isBoosting ? 12 : 0);
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(-len * 0.5, -h * 0.2, 0, -h * 0.12);
        ctx.lineTo(0, h * 0.12);
        ctx.quadraticCurveTo(-len * 0.5, h * 0.2, -len, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

		// Feedback rectangle removed

        // Draw shield ring around ship if invincible
		if (this.invincibleHitsRemaining > 0) {
			ctx.save();
			const t = (performance.now() - (this.shieldPickupTime || 0)) / 1000;
			const ringR = Math.max(w, h) * 0.9;
			const pulses = 0.15 * Math.sin(t * 5);
			ctx.shadowColor = '#8BE9FD';
			ctx.shadowBlur = 20;
			ctx.strokeStyle = '#B3E5FC';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(0, 0, ringR * (1 + pulses), 0, Math.PI * 2);
			ctx.stroke();
			// subtle inner ring
			ctx.globalAlpha = 0.7;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(0, 0, ringR * 0.8, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}

        // Draw damage decals
        this.drawDamageDecals(ctx);

        // Apply directional lighting based on movement
        this.drawDirectionalLight(ctx);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'transparent';

        ctx.restore();
    }

    update(dt) {
        // Time-based acceleration and friction integration
        const accel = this.acceleration * 60; // scale to per-second feel
        const friction = 0.90; // slightly less damping for smoother glides
        const fx = Math.pow(friction, dt * 60);

        // Desired acceleration from input axes
        const ax = (this.inputAxisX || 0) * accel * dt;
        const ay = (this.inputAxisY || 0) * accel * dt;

        this.velocityX += ax;
        this.velocityY += ay;

        // Clamp max speed smoothly
        const speed = Math.hypot(this.velocityX, this.velocityY);
        const max = this.maxSpeed;
        if (speed > max) {
            const k = max / (speed || 1);
            this.velocityX *= k;
            this.velocityY *= k;
        }

        // Apply friction
        this.velocityX *= fx;
        this.velocityY *= fx;

        this.posX += this.velocityX * dt * 60;
        this.posY += this.velocityY * dt * 60;
        this.thrustPhase += 0.3;

        // Clamp by center using half-diagonal so rotated sprite never clips out
        const canvasW = window.innerWidth;
        const canvasH = window.innerHeight;
        const halfDiagonal = Math.sqrt(this.width * this.width + this.height * this.height) / 2;
        let centerX = this.posX + this.width / 2;
        let centerY = this.posY + this.height / 2;
        if (centerX < halfDiagonal) centerX = halfDiagonal;
        if (centerX > canvasW - halfDiagonal) centerX = canvasW - halfDiagonal;
        if (centerY < halfDiagonal) centerY = halfDiagonal;
        if (centerY > canvasH - halfDiagonal) centerY = canvasH - halfDiagonal;
        this.posX = centerX - this.width / 2;
        this.posY = centerY - this.height / 2;

        let angleDiff = this.targetRotation - this.rotation;

        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Smooth rotation scaled by dt for consistent feel
        this.rotation += angleDiff * this.rotationSpeed * (dt * 60);

        // Removed extra per-frame deceleration to avoid double damping; friction already applies

        // Idle decay system with escalation
        if (this.health > 0) {
            const cfg = (window.CONFIG && window.CONFIG.idleDecay) || {};
            const baseDecay = cfg.baseDecayPerFrame || 0.0001;
            const movementThreshold = cfg.movementThreshold || 0.05;
            const idleThresholdMs = cfg.idleThresholdMs || 3000;
            const idleMultiplier = cfg.idleDecayMultiplier || 2.0;
            const escalationRate = cfg.escalationRate || 1.2;
            const maxMultiplier = cfg.maxDecayMultiplier || 10.0;
            
            const currentTime = performance.now();
            const currentSpeed = Math.hypot(this.velocityX, this.velocityY);
            const isMoving = currentSpeed > movementThreshold || 
                           Math.abs(this.inputAxisX || 0) > 0.1 || 
                           Math.abs(this.inputAxisY || 0) > 0.1;
            
            if (isMoving) {
                // Player is moving - reset idle state
                this.lastMovementTime = currentTime;
                this.idleDecayMultiplier = 1.0;
                this.isCurrentlyIdle = false;
                this.healthDecayPerFrame = baseDecay;
            } else {
                // Player is not moving - check if we should start idle decay
                const timeSinceMovement = currentTime - this.lastMovementTime;
                
                if (timeSinceMovement > idleThresholdMs) {
                    // Player has been idle long enough - start escalating decay
                    this.isCurrentlyIdle = true;
                    
                    // Calculate escalation based on time idle (beyond threshold)
                    const idleTimeSeconds = (timeSinceMovement - idleThresholdMs) / 1000;
                    const escalation = Math.pow(escalationRate, idleTimeSeconds);
                    this.idleDecayMultiplier = Math.min(maxMultiplier, idleMultiplier * escalation);
                    
                    this.healthDecayPerFrame = baseDecay * this.idleDecayMultiplier;
                } else {
                    // Still within idle threshold - use base decay
                    this.isCurrentlyIdle = false;
                    this.idleDecayMultiplier = 1.0;
                    this.healthDecayPerFrame = baseDecay;
                }
            }
            
            // Apply the calculated decay rate
            this.health = Math.max(0, this.health - this.healthDecayPerFrame);
        }

        if (this.feedbackTimer > 0) {
            this.feedbackTimer -= 1;
        }

		// Speed boost countdown and effect (ms-based)
		if (this.speedBoostTimerMs > 0) {
			this.speedBoostTimerMs = Math.max(0, this.speedBoostTimerMs - dt * 1000);
			this.maxSpeed = this.baseMaxSpeed + this.speedBoostAmount;
		} else {
			this.maxSpeed = this.baseMaxSpeed;
		}

		const isMoving = Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1;
		if (isMoving && !this.spaceMusicPlaying && this.spaceMusic) {
			this.spaceMusic.play().then(() => {
				this.spaceMusicPlaying = true;
			}).catch(() => { /* ignore autoplay errors */ });
		} else if (!isMoving && this.spaceMusicPlaying && this.spaceMusic) {
			this.spaceMusic.pause();
			this.spaceMusicPlaying = false;
		}
	}

    setControls() {
        this.controls = new Controls(this);
        // Reinitialize audio if it was cleaned up
        this.initializeAudio();
    }

    initializeAudio() {
        // Reinitialize audio objects if they were cleaned up
        if (!this.spaceMusic) {
            this.spaceMusic = new Audio('./assets/sounds/space.mp3');
            this.spaceMusic.loop = true;
            this.spaceMusic.volume = 0.4;
            this.spaceMusicPlaying = false;
        }
        
        if (!this.drivingSound) {
            this.drivingSound = new Audio('./assets/sounds/space.mp3');
            this.drivingSound.loop = true;
            this.drivingSound.volume = 0.5;
            this.audioPlaying = false;
        }
    }

	applySpeedBoost() {
		const cfg = (window.CONFIG && window.CONFIG.player && window.CONFIG.player.speedBoost) || {};
		const durationMs = cfg.durationMs != null ? cfg.durationMs : 3500;
		const factor = cfg.amountFactor != null ? cfg.amountFactor : 0.5;
		const ref = cfg.sizeReference || { w: 52, h: 26 };
		const useDiag = cfg.useDiagonal !== false; // default true

		// Scale factor based on size
		const sizeScale = useDiag
			? (Math.hypot(this.width, this.height) / Math.hypot(ref.w, ref.h))
			: ((this.width * this.height) / (ref.w * ref.h));

		// Relative boost amount from base
		const base = this.baseMaxSpeed || this.maxSpeed;
		const amount = base * factor * sizeScale;

		this.speedBoostAmount = amount;
		this.speedBoostTimerMs = Math.max(this.speedBoostTimerMs || 0, durationMs);
	}

	applyInvincibility(maxHits) {
		this.invincibleHitsRemaining = Math.max(this.invincibleHitsRemaining, maxHits);
		this.shieldPickupTime = performance.now();
	}

	consumeInvincibilityHit() {
		if (this.invincibleHitsRemaining > 0) {
			this.invincibleHitsRemaining -= 1;
			return true;
		}
		return false;
	}

	applyMagnet(durationMs) {
		const cfg = (window.CONFIG && window.CONFIG.magnet) || {};
		const d = durationMs != null ? durationMs : (cfg.durationMs != null ? cfg.durationMs : 6000);
		this.magnetTimerMs = Math.max(this.magnetTimerMs || 0, d);
	}

    triggerFeedback(type) {
        // type: 'hit' | 'heal'
        this.feedbackColor = type === 'hit' ? '#ff5252' : '#69f0ae';
        this.feedbackTimer = 12; // ~200ms at 60fps
        
        // Handle damage decals
        if (type === 'hit') {
            this.addDamageDecal();
        } else if (type === 'heal') {
            this.fadeDecals();
        }
    }
    
    addDamageDecal() {
        const cfg = (window.CONFIG && window.CONFIG.damageDecals) || {};
        if (!cfg.enabled || Math.random() > (cfg.spawnChance || 0.8)) return;
        
        const maxDecals = cfg.maxDecals || 6;
        const colors = cfg.colors || ['#8D4004', '#B71C1C', '#424242'];
        const sizes = cfg.sizes || [0.15, 0.25, 0.35];
        const baseAlpha = cfg.baseAlpha || 0.7;
        
        // Remove oldest decal if at max
        if (this.damageDecals.length >= maxDecals) {
            this.damageDecals.shift();
        }
        
        // Create new decal
        const decal = {
            x: (Math.random() - 0.5) * this.width * 0.8, // relative to ship center
            y: (Math.random() - 0.5) * this.height * 0.6,
            size: sizes[Math.floor(Math.random() * sizes.length)] * Math.max(this.width, this.height),
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: baseAlpha,
            rotation: Math.random() * Math.PI * 2
        };
        
        this.damageDecals.push(decal);
    }
    
    fadeDecals() {
        const cfg = (window.CONFIG && window.CONFIG.damageDecals) || {};
        const fadeRate = cfg.fadeRate || 0.15;
        
        // Fade all decals and remove fully faded ones
        for (let i = this.damageDecals.length - 1; i >= 0; i--) {
            this.damageDecals[i].alpha -= fadeRate;
            if (this.damageDecals[i].alpha <= 0) {
                this.damageDecals.splice(i, 1);
            }
        }
    }
    
    drawDamageDecals(ctx) {
        const cfg = (window.CONFIG && window.CONFIG.damageDecals) || {};
        if (!cfg.enabled || this.damageDecals.length === 0) return;
        
        ctx.save();
        for (const decal of this.damageDecals) {
            ctx.save();
            ctx.translate(decal.x, decal.y);
            ctx.rotate(decal.rotation);
            ctx.globalAlpha = decal.alpha;
            ctx.fillStyle = decal.color;
            
            // Draw irregular scorch mark
            ctx.beginPath();
            const segments = 8;
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const radius = decal.size * (0.7 + Math.random() * 0.6);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
    
    drawDirectionalLight(ctx) {
        const cfg = (window.CONFIG && window.CONFIG.directionalLight) || {};
        if (!cfg.enabled) return;
        
        const speed = Math.hypot(this.velocityX, this.velocityY);
        const minSpeed = cfg.minimumSpeed || 2.0;
        if (speed < minSpeed) return;
        
        const intensity = cfg.intensity || 0.6;
        const rimWidth = cfg.rimWidth || 8;
        const isBoosting = (this.speedBoostTimerMs || 0) > 0;
        const baseColor = cfg.baseColor || '#FFFFFF';
        const boostColor = cfg.boostColor || '#FFD54F';
        const lightColor = isBoosting ? boostColor : baseColor;
        
        // Calculate movement direction for rim lighting
        const moveAngle = Math.atan2(this.velocityY, this.velocityX);
        const speedFactor = Math.min(1.0, speed / this.maxSpeed);
        const lightIntensity = intensity * speedFactor;
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = lightIntensity;
        
        // Create directional gradient based on movement
        const w = this.width;
        const h = this.height;
        const maxDim = Math.max(w, h);
        
        // Light source position (opposite to movement direction)
        const lightX = -Math.cos(moveAngle) * maxDim;
        const lightY = -Math.sin(moveAngle) * maxDim;
        
        // Create radial gradient for rim lighting effect
        const rimGrad = ctx.createRadialGradient(
            lightX * 0.3, lightY * 0.3, maxDim * 0.2,
            lightX * 0.3, lightY * 0.3, maxDim * 0.8
        );
        rimGrad.addColorStop(0, `rgba(0,0,0,0)`);
        rimGrad.addColorStop(0.7, lightColor + '80'); // Semi-transparent
        rimGrad.addColorStop(1, lightColor + 'FF'); // Full opacity at edges
        
        ctx.fillStyle = rimGrad;
        
        // Draw rim light on ship silhouette
        ctx.beginPath();
        // Approximate ship outline for rim lighting
        ctx.moveTo(w * 0.55, 0); // nose
        ctx.lineTo(w * 0.15, -h * 0.22);
        ctx.lineTo(-w * 0.45, -h * 0.30); // wing tip
        ctx.lineTo(-w * 0.35, -h * 0.28);
        ctx.lineTo(-w * 0.35, h * 0.28);
        ctx.lineTo(-w * 0.45, h * 0.30); // wing tip
        ctx.lineTo(w * 0.15, h * 0.22);
        ctx.closePath();
        ctx.fill();
        
        // Additional edge highlights on leading surfaces
        if (isBoosting) {
            ctx.globalAlpha = lightIntensity * 0.5;
            ctx.strokeStyle = boostColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = boostColor;
            ctx.shadowBlur = 6;
            
            // Highlight nose and leading wing edges
            ctx.beginPath();
            ctx.moveTo(w * 0.55, 0);
            ctx.lineTo(w * 0.15, -h * 0.22);
            ctx.moveTo(w * 0.55, 0);
            ctx.lineTo(w * 0.15, h * 0.22);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Clean up all car resources
    cleanup() {
        // Clean up controls
        if (this.controls && typeof this.controls.cleanup === 'function') {
            this.controls.cleanup();
            this.controls = null;
        }

        // Clean up audio
        if (this.spaceMusic) {
            try {
                this.spaceMusic.pause();
                this.spaceMusic.removeAttribute('src');
                this.spaceMusic.load(); // Force garbage collection
            } catch (e) {
                console.warn('Car: Error cleaning up space music', e);
            }
            this.spaceMusic = null;
        }

        // Clear arrays and references
        this.damageDecals = [];
        this.feedbackTimer = 0;
        this.spaceMusicPlaying = false;
    }
}