// Visual Effects System - Particle effects, comets, explosions, and visual enhancements

// Visual-only comet shooting across the sky
class Comet {
    constructor(canvasWidth, canvasHeight, startPos, endPos) {
        // Visual sizing first (so margins can account for size)
        this.length = 180 + Math.random() * 120; // more natural
        this.thickness = 3 + Math.random() * 2;  // slimmer core
        this.color = 'rgba(255,255,255,0.98)';
        this.glow = 18; // subtler glow

        // Get speed configuration
        const cfg = (window.CONFIG && window.CONFIG.comet && window.CONFIG.comet.speed) || {};
        const minSpeed = cfg.min || 9;
        const maxSpeed = cfg.max || 15;
        const baseSpeed = cfg.base || 12;
        
        // Calculate speed with configurable range
        const speed = baseSpeed + (Math.random() - 0.5) * (maxSpeed - minSpeed);

        // Choose a start point on screen edge and a target on the opposite edge
        const margin = Math.max(40, this.thickness * 5 + this.glow); // ensure on-screen head
        let x0, y0, x1, y1;
        if (startPos && endPos) {
            // Use provided path but clamp to margins
            x0 = Math.max(margin, Math.min(canvasWidth - margin, startPos.x));
            y0 = Math.max(margin, Math.min(canvasHeight - margin, startPos.y));
            x1 = Math.max(margin, Math.min(canvasWidth - margin, endPos.x));
            y1 = Math.max(margin, Math.min(canvasHeight - margin, endPos.y));
        } else {
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { // top -> bottom
                x0 = margin + Math.random() * (canvasWidth - margin * 2);
                y0 = margin;
                x1 = margin + Math.random() * (canvasWidth - margin * 2);
                y1 = canvasHeight - margin;
            } else if (side === 1) { // bottom -> top
                x0 = margin + Math.random() * (canvasWidth - margin * 2);
                y0 = canvasHeight - margin;
                x1 = margin + Math.random() * (canvasWidth - margin * 2);
                y1 = margin;
            } else if (side === 2) { // left -> right
                x0 = margin;
                y0 = margin + Math.random() * (canvasHeight - margin * 2);
                x1 = canvasWidth - margin;
                y1 = margin + Math.random() * (canvasHeight - margin * 2);
            } else { // right -> left
                x0 = canvasWidth - margin;
                y0 = margin + Math.random() * (canvasHeight - margin * 2);
                x1 = margin;
                y1 = margin + Math.random() * (canvasHeight - margin * 2);
            }
        }
        this.x = x0;
        this.y = y0;
        const dirx = x1 - x0;
        const diry = y1 - y0;
        const len = Math.hypot(dirx, diry) || 1;
        this.vx = (dirx / len) * speed;
        this.vy = (diry / len) * speed;
        this.alive = true;
        this.life = 160 + Math.floor(Math.random() * 80); // frames
        // dust particles along the trail (subtle)
        this.sparkles = [];
    }

    update(canvasWidth, canvasHeight) {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        // emit sparkles
        if (this.life % 3 === 0) {
            this.sparkles.push({
                x: this.x,
                y: this.y,
                vx: -this.vx * 0.1 + (Math.random() - 0.5) * 0.4,
                vy: -this.vy * 0.1 + (Math.random() - 0.5) * 0.4,
                size: 1 + Math.random() * 2,
                life: 18 + Math.floor(Math.random() * 14),
                hue: 205 + Math.random() * 15 // pale cyan-blue
            });
        }
        // update sparkles
        for (const s of this.sparkles) {
            s.x += s.vx;
            s.y += s.vy;
            s.vx *= 0.98; s.vy *= 0.98;
            s.life--;
        }
        // remove dead sparkles
        this.sparkles = this.sparkles.filter(s => s.life > 0);
        if (this.life <= 0 || this.x < -200 || this.x > canvasWidth + 200 || this.y < -200 || this.y > canvasHeight + 200) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.lineCap = 'round';
        // Realistic trail: faint bluish plume with bright white core
        const angle = Math.atan2(this.vy, this.vx);
        const tx = this.x - Math.cos(angle) * this.length;
        const ty = this.y - Math.sin(angle) * this.length;
        const gradSoft = ctx.createLinearGradient(this.x, this.y, tx, ty);
        gradSoft.addColorStop(0, 'rgba(255,255,255,0.85)');
        gradSoft.addColorStop(0.35, 'rgba(173,216,230,0.45)'); // light blue
        gradSoft.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = this.glow;
        ctx.strokeStyle = gradSoft;
        ctx.lineWidth = this.thickness * 2.0;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Bright core stroke (white to transparent)
        const gradCore = ctx.createLinearGradient(this.x, this.y, tx, ty);
        gradCore.addColorStop(0, 'rgba(255,255,255,1)');
        gradCore.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.shadowBlur = this.glow * 0.5;
        ctx.strokeStyle = gradCore;
        ctx.lineWidth = this.thickness;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Comet head (bright nucleus glow)
        const headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.thickness * 2.2);
        headGrad.addColorStop(0, 'rgba(255,255,255,1)');
        headGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.thickness * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Dust sparkles (additive blend, subtle)
        ctx.globalCompositeOperation = 'lighter';
        for (const s of this.sparkles) {
            const alpha = Math.max(0, s.life / 28);
            ctx.fillStyle = `hsla(${s.hue}, 90%, 75%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
    }
}

// Simple particle explosion system
class ExplosionEffect {
    constructor(x, y) {
        this.parts = [];
        const count = 80;
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 5;
            this.parts.push({
                x,
                y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 40 + Math.floor(Math.random() * 30),
                color: i % 3 === 0 ? '#FFEB3B' : (i % 3 === 1 ? '#FF5722' : '#FFFFFF'),
                size: 2 + Math.random() * 3
            });
        }
        this.done = false;
    }

    update() {
        for (const p of this.parts) {
            if (p.life <= 0) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.vy += 0.02; // slight drift
            p.life--;
        }
        this.done = this.parts.every(p => p.life <= 0);
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.parts) {
            if (p.life <= 0) continue;
            ctx.globalAlpha = Math.max(0, p.life / 60);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// Visual shockwave ring effect
class ShockwaveEffect {
    constructor(x, y, maxRadius) {
        this.x = x;
        this.y = y;
        this.r = 0;
        this.max = maxRadius;
        this.done = false;
    }

    update() {
        this.r += 6; // expansion speed
        if (this.r >= this.max) this.done = true;
    }

    draw(ctx) {
        const alpha = Math.max(0, 1 - this.r / this.max);
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#90CAF9';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// Floating text system for damage/heal numbers
class FloatingText {
    constructor(x, y, text, type) {
        const cfg = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.floatingText) || {};
        this.x = x;
        this.y = y;
        this.text = text;
        this.type = type;
        this.life = cfg.duration || 1200;
        this.maxLife = cfg.duration || 1200;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = -(cfg.riseSpeed || 0.5);
        this.color = cfg.colors?.[type] || '#FFFFFF';
    }

    update(dt) {
        this.life -= dt * 1000;
        this.x += this.vx;
        this.y += this.vy;
        return this.life > 0;
    }

    draw(ctx) {
        const textCfg = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.floatingText) || {};
        const fadeStart = textCfg.fadeStart || 0.7;
        const lifePercent = this.life / this.maxLife;
        let alpha = 1.0;
        if (lifePercent < fadeStart) {
            alpha = lifePercent / fadeStart;
        }
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${textCfg.fontSize || 16}px 'Orbitron', 'Exo 2', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        
        // Add subtle secondary glow
        ctx.shadowBlur = 20;
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillText(this.text, this.x, this.y);
        
        ctx.restore();
    }
}

// Factory functions for creating effects
function createExplosion(x, y) {
    return new ExplosionEffect(x, y);
}

function createShockwave(x, y, maxRadius) {
    return new ShockwaveEffect(x, y, maxRadius);
}

function createFloatingText(x, y, text, type) {
    return new FloatingText(x, y, text, type);
}

// Make them globally available
window.Comet = Comet;
window.ExplosionEffect = ExplosionEffect;
window.ShockwaveEffect = ShockwaveEffect;
window.FloatingText = FloatingText;
window.createExplosion = createExplosion;
window.createShockwave = createShockwave;
window.createFloatingText = createFloatingText;