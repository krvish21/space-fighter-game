// Pickups System - Special collectible items that provide temporary or instant benefits

// Special green heal that spawns at center, does not move
class CenterHeal {
    constructor(canvasWidth, canvasHeight) {
        this.radius = 40; // bigger moon
        this.color = '#FDD835'; // deeper moon yellow (no white look)
        this.shadowBlur = 0; // no glow
        // spawn at random on-screen position with padding for full visibility
        const padX = this.radius + 4;
        const padY = this.radius + 4;
        this.posX = Math.floor(padX + Math.random() * Math.max(1, canvasWidth - padX * 2));
        this.posY = Math.floor(padY + Math.random() * Math.max(1, canvasHeight - padY * 2));

        // Waning mask color (edge/cover tint)
        this.maskColor = '#0F1020';

        // Phase timing
        this.spawnTs = 0; // set on first update call
        this.lifetimeMs = 8000 + Math.floor(Math.random() * 6000); // 8-14s
        this.dead = false;
    }

    update(nowTs) {
        if (!this.spawnTs) this.spawnTs = nowTs;
        const elapsed = nowTs - this.spawnTs;
        if (elapsed >= this.lifetimeMs) {
            this.dead = true;
        }
    }

    // Phase [0..1], 1 = full moon, 0 = no moon
    getPhase(nowTs) {
        if (!this.spawnTs) return 1;
        const remaining = Math.max(0, this.lifetimeMs - (nowTs - this.spawnTs));
        return remaining / this.lifetimeMs;
    }

    draw(ctx, nowTs) {
        // Use offscreen buffer so masking only affects the moon, not background
        if (!this.buf) {
            this.buf = document.createElement('canvas');
            this.buf.width = this.radius * 2 + 2;
            this.buf.height = this.radius * 2 + 2;
            this.bctx = this.buf.getContext('2d');
        }
        const bctx = this.bctx;
        // Resize buffer if radius changed
        const targetW = this.radius * 2 + 2;
        const targetH = this.radius * 2 + 2;
        if (this.buf.width !== targetW || this.buf.height !== targetH) {
            this.buf.width = targetW;
            this.buf.height = targetH;
        }

        // Clear buffer
        bctx.clearRect(0, 0, this.buf.width, this.buf.height);

        // Draw full moon disc into buffer
        bctx.fillStyle = this.color;
        bctx.beginPath();
        bctx.arc(this.radius + 1, this.radius + 1, this.radius, 0, Math.PI * 2);
        bctx.closePath();
        bctx.fill();
        // subtle outline
        bctx.strokeStyle = '#F9A825';
        bctx.lineWidth = 2;
        bctx.stroke();

        // Mask with waning circle in buffer only
        const phase = this.getPhase(nowTs);
        // Start fully off to the left at full moon (-2R), approach center (0) as it wanes
        let offset = -this.radius * 2 * phase; // range [-2R, 0]
        if (offset < -this.radius * 2) offset = -this.radius * 2;
        if (offset > 0) offset = 0;
        bctx.save();
        bctx.globalCompositeOperation = 'destination-out';
        bctx.beginPath();
        bctx.arc(this.radius + 1 + offset, this.radius + 1, this.radius, 0, Math.PI * 2);
        bctx.closePath();
        bctx.fillStyle = this.maskColor;
        bctx.fill();
        bctx.restore();

        // Draw buffer onto main canvas at moon position
        ctx.drawImage(this.buf, Math.round(this.posX - this.radius - 1), Math.round(this.posY - this.radius - 1));

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
}

// Shield pickup entity: stationary glowing shield crest
class ShieldPickup {
    constructor(canvasWidth, canvasHeight) {
        const cfg = (window.CONFIG && window.CONFIG.shield) || {};
        this.radius = 24;
        this.spawnTs = 0; // set on first update
        this.lifetimeMs = cfg.lifetimeMs != null ? cfg.lifetimeMs : 9000;
        // spawn at random on-screen position with padding for full visibility
        const pad = this.radius + 6;
        this.posX = Math.floor(pad + Math.random() * Math.max(1, canvasWidth - pad * 2));
        this.posY = Math.floor(pad + Math.random() * Math.max(1, canvasHeight - pad * 2));
        this.pulse = 0;
        this.dead = false;
    }

    update(nowTs) {
        if (!this.spawnTs) this.spawnTs = nowTs;
        this.pulse += 0.08;
        if (nowTs - this.spawnTs > this.lifetimeMs) this.dead = true;
    }

    draw(ctx, nowTs) {
        ctx.save();
        // pulsing aura
        const auraR = this.radius * (1.1 + 0.06 * Math.sin(this.pulse));
        const grad = ctx.createRadialGradient(this.posX, this.posY, this.radius * 0.35, this.posX, this.posY, auraR);
        grad.addColorStop(0, 'rgba(120,200,255,0.9)');
        grad.addColorStop(1, 'rgba(120,200,255,0.0)');
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(this.posX, this.posY, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // shield crest (kite/teardrop) inside ring
        ctx.shadowColor = '#8BE9FD';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#B3E5FC';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const r = this.radius * 0.75;
        ctx.moveTo(this.posX, this.posY - r);
        ctx.quadraticCurveTo(this.posX + r * 0.9, this.posY - r * 0.2, this.posX, this.posY + r);
        ctx.quadraticCurveTo(this.posX - r * 0.9, this.posY - r * 0.2, this.posX, this.posY - r);
        ctx.closePath();
        ctx.stroke();
        // outer ring
        ctx.strokeStyle = '#E1F5FE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.posX, this.posY, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// Nova Bomb pickup entity: screen-clearing explosive device
class NovaBomb {
    constructor(canvasWidth, canvasHeight) {
        const cfg = (window.CONFIG && window.CONFIG.novaBomb) || {};
        this.radius = cfg.size || 22;
        this.spawnTs = 0; // set on first update
        this.lifetimeMs = cfg.lifetimeMs || 15000;
        this.pulseSpeed = cfg.pulseSpeed || 0.12;
        
        // spawn at random on-screen position with padding for full visibility
        const pad = this.radius + 10;
        this.posX = Math.floor(pad + Math.random() * Math.max(1, canvasWidth - pad * 2));
        this.posY = Math.floor(pad + Math.random() * Math.max(1, canvasHeight - pad * 2));
        
        this.pulse = 0;
        this.dead = false;
        this.rotationPhase = Math.random() * Math.PI * 2;
    }

    update(nowTs) {
        if (!this.spawnTs) this.spawnTs = nowTs;
        this.pulse += this.pulseSpeed;
        this.rotationPhase += 0.05; // slow rotation
        
        if (nowTs - this.spawnTs > this.lifetimeMs) {
            this.dead = true;
        }
    }

    draw(ctx, nowTs) {
        ctx.save();
        ctx.translate(this.posX, this.posY);
        
        // Intense pulsing aura (golden-white)
        const pulseIntensity = 0.6 + 0.4 * Math.sin(this.pulse);
        const auraR = this.radius * (1.8 + 0.3 * Math.sin(this.pulse * 1.5));
        const auraGrad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, auraR);
        auraGrad.addColorStop(0, 'rgba(255,215,0,0.9)');
        auraGrad.addColorStop(0.7, 'rgba(255,165,0,0.6)');
        auraGrad.addColorStop(1, 'rgba(255,215,0,0.0)');
        ctx.fillStyle = auraGrad;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Rotating star/supernova shape
        ctx.rotate(this.rotationPhase);
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20 * pulseIntensity;
        
        // Main star body (8-pointed star)
        const innerRadius = this.radius * 0.4;
        const outerRadius = this.radius * 0.9;
        const points = 8;
        
        ctx.fillStyle = '#FFFF00'; // bright yellow core
        ctx.strokeStyle = '#FFD700'; // golden edge
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Central core (super bright)
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius);
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.5, '#FFFF80');
        coreGrad.addColorStop(1, '#FFD700');
        ctx.fillStyle = coreGrad;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Energy arcs around the star
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 10;
        for (let i = 0; i < 4; i++) {
            const arcAngle = (i / 4) * Math.PI * 2 + this.pulse;
            const arcRadius = this.radius * 1.1;
            const startAngle = arcAngle;
            const endAngle = arcAngle + Math.PI * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, arcRadius, startAngle, endAngle);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Drone Pickup entity
class DronePickup {
    constructor(canvasWidth, canvasHeight) {
        const cfg = (window.CONFIG && window.CONFIG.drones) || {};
        this.radius = 20;
        this.spawnTs = 0;
        this.lifetimeMs = cfg.lifetimeMs || 15000;
        
        // Spawn at random position
        const pad = this.radius + 10;
        this.posX = Math.floor(pad + Math.random() * Math.max(1, canvasWidth - pad * 2));
        this.posY = Math.floor(pad + Math.random() * Math.max(1, canvasHeight - pad * 2));
        
        this.pulse = 0;
        this.rotationPhase = 0;
        this.dead = false;
    }
    
    update(nowTs) {
        if (!this.spawnTs) this.spawnTs = nowTs;
        this.pulse += 0.08;
        this.rotationPhase += 0.03;
        
        if (nowTs - this.spawnTs > this.lifetimeMs) {
            this.dead = true;
        }
    }
    
    draw(ctx, nowTs) {
        ctx.save();
        ctx.translate(this.posX, this.posY);
        ctx.rotate(this.rotationPhase);
        
        // Pulsing aura
        const pulseIntensity = 0.7 + 0.3 * Math.sin(this.pulse);
        const auraR = this.radius * (1.3 + 0.2 * Math.sin(this.pulse * 1.2));
        
        const auraGrad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, auraR);
        auraGrad.addColorStop(0, 'rgba(0,230,118,0.8)');
        auraGrad.addColorStop(0.7, 'rgba(76,175,80,0.4)');
        auraGrad.addColorStop(1, 'rgba(0,230,118,0.0)');
        ctx.fillStyle = auraGrad;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        
        // Main pickup body (diamond/drone shape)
        ctx.shadowColor = '#00E676';
        ctx.shadowBlur = 12 * pulseIntensity;
        ctx.fillStyle = '#00E676';
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        
        // Diamond shape
        const size = this.radius * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Central core
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Orbiting indicators
        for (let i = 0; i < 2; i++) {
            const orbitAngle = this.pulse * 2 + (i * Math.PI);
            const orbitRadius = size * 1.2;
            const x = Math.cos(orbitAngle) * orbitRadius;
            const y = Math.sin(orbitAngle) * orbitRadius;
            
            ctx.fillStyle = '#4CAF50';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Make them globally available
window.CenterHeal = CenterHeal;
window.ShieldPickup = ShieldPickup;
window.NovaBomb = NovaBomb;
window.DronePickup = DronePickup;