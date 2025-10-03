// Homing Mine Enemy - Red explosive enemy that tracks and explodes near the player
class HomingMine {
    constructor(canvasWidth, canvasHeight, difficultyConfig = {}) {
        this.isDark = false;
        this.isSpeedBoost = false;
        this.isMagnet = false;
        this.isHomingMine = true;
        this.isHeal = false;

        this.color = '#FF3030'; // red for homing mine
        this.shadowBlur = 15;
        
        const cfg = (window.CONFIG && window.CONFIG.homingMine) || {};
        this.radius = cfg.size || 16; // consistent size for mines
        this.pulsePhase = Math.random() * Math.PI * 2; // random starting phase for pulsing
        this.detectionRadius = cfg.detectionRadius || 300;
        this.blastRadius = cfg.blastRadius || 80; // explosion radius
        this.steerStrength = cfg.steerStrength || 0.02;
        this.maxSteerSpeed = cfg.maxSteerSpeed || 1.5;
        this.isHoming = false; // starts false, becomes true when player detected
        this.shouldExplode = false; // flag for explosion trigger

        // Spawn position and velocity
        const side = Math.floor(Math.random() * 8); // 0..3 edges, 4..7 corners
        let speed = (cfg.baseSpeed || 0.8);
        
        // Apply difficulty-based speed multiplier
        const speedMultiplier = difficultyConfig.enemySpeedMultiplier || 1.0;
        speed *= speedMultiplier;

        this.setupSpawnPosition(side, speed, canvasWidth, canvasHeight);
    }

    setupSpawnPosition(side, speed, canvasWidth, canvasHeight) {
        if (side === 0) {
            // Top
            this.posX = Math.floor(Math.random() * Math.max(1, canvasWidth - this.radius * 2));
            this.posY = -this.radius * 2;
            this.vx = 0;
            this.vy = speed;
        } else if (side === 1) {
            // Bottom
            this.posX = Math.floor(Math.random() * Math.max(1, canvasWidth - this.radius * 2));
            this.posY = canvasHeight + this.radius * 2;
            this.vx = 0;
            this.vy = -speed;
        } else if (side === 2) {
            // Left
            this.posX = -this.radius * 2;
            this.posY = Math.floor(Math.random() * Math.max(1, canvasHeight - this.radius * 2));
            this.vx = speed;
            this.vy = 0;
        } else if (side === 3) {
            // Right
            this.posX = canvasWidth + this.radius * 2;
            this.posY = Math.floor(Math.random() * Math.max(1, canvasHeight - this.radius * 2));
            this.vx = -speed;
            this.vy = 0;
        } else if (side === 4) {
            // Top-left corner
            this.posX = -this.radius * 2;
            this.posY = -this.radius * 2;
            const d = speed * 0.70710678; // sqrt(1/2)
            this.vx = d;
            this.vy = d;
        } else if (side === 5) {
            // Top-right corner
            this.posX = canvasWidth + this.radius * 2;
            this.posY = -this.radius * 2;
            const d = speed * 0.70710678;
            this.vx = -d;
            this.vy = d;
        } else if (side === 6) {
            // Bottom-left corner
            this.posX = -this.radius * 2;
            this.posY = canvasHeight + this.radius * 2;
            const d = speed * 0.70710678;
            this.vx = d;
            this.vy = -d;
        } else {
            // Bottom-right corner
            this.posX = canvasWidth + this.radius * 2;
            this.posY = canvasHeight + this.radius * 2;
            const d = speed * 0.70710678;
            this.vx = -d;
            this.vy = -d;
        }
    }

    update(playerX, playerY) {
        // Calculate distance to player
        const dx = (playerX + 26) - this.posX; // playerX + half ship width for center
        const dy = (playerY + 13) - this.posY; // playerY + half ship height for center
        const distToPlayer = Math.hypot(dx, dy);
        
        // Update pulse phase for visual effect
        const cfg = (window.CONFIG && window.CONFIG.homingMine) || {};
        this.pulsePhase += cfg.pulseSpeed || 0.15;
        
        // Check if player is within detection radius
        if (distToPlayer <= this.detectionRadius) {
            this.isHoming = true;
            
            // Calculate steering force toward player
            if (distToPlayer > 0) {
                const targetVx = (dx / distToPlayer) * this.maxSteerSpeed;
                const targetVy = (dy / distToPlayer) * this.maxSteerSpeed;
                
                // Gradually steer toward target velocity
                this.vx += (targetVx - this.vx) * this.steerStrength;
                this.vy += (targetVy - this.vy) * this.steerStrength;
                
                // Limit to max speed
                const currentSpeed = Math.hypot(this.vx, this.vy);
                if (currentSpeed > this.maxSteerSpeed) {
                    this.vx = (this.vx / currentSpeed) * this.maxSteerSpeed;
                    this.vy = (this.vy / currentSpeed) * this.maxSteerSpeed;
                }
            }
        }

        // Check if player is within blast radius for explosion
        if (distToPlayer <= this.blastRadius) {
            this.shouldExplode = true;
        }
        
        this.posX += this.vx;
        this.posY += this.vy;
    }

    draw(ctx) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Red homing mine with pulsing effect and directional spikes
        ctx.save();
        ctx.translate(this.posX, this.posY);
        
        // Pulsing glow effect
        const pulseIntensity = 0.7 + 0.3 * Math.sin(this.pulsePhase);
        ctx.shadowColor = this.isHoming ? '#FF6060' : '#FF3030';
        ctx.shadowBlur = this.isHoming ? 25 * pulseIntensity : 15 * pulseIntensity;
        
        // Main mine body (hexagonal shape)
        const bodyRadius = this.radius * 0.8;
        ctx.fillStyle = this.isHoming ? '#FF4444' : '#FF3030';
        ctx.strokeStyle = this.isHoming ? '#FFAAAA' : '#FF6060';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * bodyRadius;
            const y = Math.sin(angle) * bodyRadius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Directional spikes (more prominent when homing)
        ctx.strokeStyle = this.isHoming ? '#FFFFFF' : '#FFCCCC';
        ctx.lineWidth = this.isHoming ? 3 : 2;
        const spikeLength = this.radius * (this.isHoming ? 0.6 : 0.4);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const x1 = Math.cos(angle) * bodyRadius * 0.7;
            const y1 = Math.sin(angle) * bodyRadius * 0.7;
            const x2 = Math.cos(angle) * (bodyRadius + spikeLength);
            const y2 = Math.sin(angle) * (bodyRadius + spikeLength);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        // Central core (brighter when homing)
        ctx.fillStyle = this.isHoming ? '#FFFFFF' : '#FFAAAA';
        ctx.shadowBlur = this.isHoming ? 10 : 5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Detection range indicator (faint ring when homing)
        if (this.isHoming) {
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = '#FF3030';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, this.detectionRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        ctx.restore();

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
}

// Make it globally available
window.HomingMine = HomingMine;