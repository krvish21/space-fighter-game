// Asteroid Enemy - Dark/harmful enemy type that damages the player
class Asteroid {
    constructor(canvasWidth, canvasHeight, difficultyConfig = {}) {
        this.isDark = true;
        this.isSpeedBoost = false;
        this.isMagnet = false;
        this.isHomingMine = false;
        this.isHeal = false;

        // Size variation: diversify asteroid sizes
        const bucket = Math.random();
        if (bucket < 0.5) {
            this.radius = 8 + Math.floor(Math.random() * 8);   // small
        } else if (bucket < 0.85) {
            this.radius = 16 + Math.floor(Math.random() * 14); // medium
        } else {
            this.radius = 30 + Math.floor(Math.random() * 20); // large
        }

        this.color = '#8D6E63'; // brown
        this.shadowBlur = 15;

        // Spawn position and velocity
        const side = Math.floor(Math.random() * 8); // 0..3 edges, 4..7 corners
        let speed = 1.5 + Math.random() * 2.2;

        // Apply difficulty-based speed multiplier
        const speedMultiplier = difficultyConfig.enemySpeedMultiplier || 1.0;
        const sizeFactor = Math.max(0.6, 22 / (this.radius || 22));
        speed *= 2 * sizeFactor * speedMultiplier;

        this.setupSpawnPosition(side, speed, canvasWidth, canvasHeight);
        this.setupVisuals();
    }

    setupSpawnPosition(side, speed, canvasWidth, canvasHeight) {
        if (side === 0) {
            // Top
            this.posX = Math.floor(Math.random() * Math.max(1, canvasWidth - this.radius * 2));
            this.posY = -this.radius * 2;
            // point velocity toward canvas center
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * speed;
            this.vy = (dy / d) * speed;
        } else if (side === 1) {
            // Bottom
            this.posX = Math.floor(Math.random() * Math.max(1, canvasWidth - this.radius * 2));
            this.posY = canvasHeight + this.radius * 2;
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * speed;
            this.vy = (dy / d) * speed;
        } else if (side === 2) {
            // Left
            this.posX = -this.radius * 2;
            this.posY = Math.floor(Math.random() * Math.max(1, canvasHeight - this.radius * 2));
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * speed;
            this.vy = (dy / d) * speed;
        } else if (side === 3) {
            // Right
            this.posX = canvasWidth + this.radius * 2;
            this.posY = Math.floor(Math.random() * Math.max(1, canvasHeight - this.radius * 2));
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * speed;
            this.vy = (dy / d) * speed;
        } else if (side === 4) {
            // Top-left corner
            this.posX = -this.radius * 2;
            this.posY = -this.radius * 2;
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const dist = Math.hypot(dx, dy) || 1;
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        } else if (side === 5) {
            // Top-right corner
            this.posX = canvasWidth + this.radius * 2;
            this.posY = -this.radius * 2;
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const dist = Math.hypot(dx, dy) || 1;
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        } else if (side === 6) {
            // Bottom-left corner
            this.posX = -this.radius * 2;
            this.posY = canvasHeight + this.radius * 2;
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const dist = Math.hypot(dx, dy) || 1;
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        } else {
            // Bottom-right corner
            this.posX = canvasWidth + this.radius * 2;
            this.posY = canvasHeight + this.radius * 2;
            const cx = canvasWidth / 2;
            const cy = canvasHeight / 2;
            let dx = cx - this.posX;
            let dy = cy - this.posY;
            const dist = Math.hypot(dx, dy) || 1;
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
    }

    setupVisuals() {
        // Create irregular asteroid polygon
        const vertexCount = 8 + Math.floor(Math.random() * 5); // 8-12 vertices
        this.verts = [];
        for (let i = 0; i < vertexCount; i++) {
            const angle = (i / vertexCount) * Math.PI * 2;
            const jitter = 0.6 + Math.random() * 0.6; // 0.6 - 1.2
            this.verts.push({ angle, radius: this.radius * jitter });
        }
        this.rot = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() * 0.02 - 0.01); // -0.01 to 0.01 rad/frame
    }

    update(playerX, playerY) {
        this.posX += this.vx;
        this.posY += this.vy;
        if (this.rotSpeed !== undefined) {
            this.rot += this.rotSpeed;
        }
    }

    draw(ctx) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.save();
        ctx.translate(this.posX, this.posY);
        ctx.rotate(this.rot);

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#6D4C41'; // darker brown stroke
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let i = 0; i < this.verts.length; i++) {
            const v = this.verts[i];
            const x = Math.cos(v.angle) * v.radius;
            const y = Math.sin(v.angle) * v.radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // crater dots
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#5D4037'; // crater brown
        for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = this.radius * (0.2 + Math.random() * 0.5);
            const cx = Math.cos(a) * (this.radius * 0.4 * Math.random());
            const cy = Math.sin(a) * (this.radius * 0.4 * Math.random());
            ctx.beginPath();
            ctx.arc(cx, cy, rr * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
}

// Make it globally available
window.Asteroid = Asteroid;