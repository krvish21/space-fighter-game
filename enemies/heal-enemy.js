// Heal Enemy - Beneficial yellow enemy that restores player health
class HealEnemy {
    constructor(canvasWidth, canvasHeight, difficultyConfig = {}) {
        this.isDark = false;
        this.isSpeedBoost = false;
        this.isMagnet = false;
        this.isHomingMine = false;
        this.isHeal = true;

        this.radius = 10 + Math.floor(Math.random() * 16);
        this.color = '#FFEA00'; // bright yellow
        this.shadowBlur = 15;

        // Spawn position and velocity
        const side = Math.floor(Math.random() * 8); // 0..3 edges, 4..7 corners
        let speed = 1.5 + Math.random() * 2.2;

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

    update(playerX, playerY) {
        this.posX += this.vx;
        this.posY += this.vy;
    }

    draw(ctx) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Gold ring with plus icon
        ctx.save();
        ctx.shadowColor = '#FFD54F';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#FFC107';
        ctx.lineWidth = Math.max(3, this.radius * 0.4);
        ctx.beginPath();
        ctx.arc(this.posX, this.posY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // inner thin ring highlight
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFECB3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.posX, this.posY, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // plus sign
        ctx.strokeStyle = '#FFF59D';
        ctx.lineWidth = Math.max(2, this.radius * 0.2);
        const p = this.radius * 0.5;
        ctx.beginPath();
        ctx.moveTo(this.posX - p, this.posY);
        ctx.lineTo(this.posX + p, this.posY);
        ctx.moveTo(this.posX, this.posY - p);
        ctx.lineTo(this.posX, this.posY + p);
        ctx.stroke();
        ctx.restore();

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
}

// Make it globally available
window.HealEnemy = HealEnemy;