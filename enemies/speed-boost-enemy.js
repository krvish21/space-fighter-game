// Speed Boost Enemy - Beneficial pink enemy that gives player a speed boost
class SpeedBoostEnemy {
    constructor(canvasWidth, canvasHeight, difficultyConfig = {}) {
        this.isDark = false;
        this.isSpeedBoost = true;
        this.isMagnet = false;
        this.isHomingMine = false;
        this.isHeal = false;

        this.radius = 10 + Math.floor(Math.random() * 16);
        this.color = '#FF69B4'; // pink
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
        this.posX += this.vx;
        this.posY += this.vy;
    }

    draw(ctx) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Pink lightning bolt with glow
        const angle = Math.atan2(this.vy, this.vx);
        ctx.save();
        ctx.translate(this.posX, this.posY);
        ctx.rotate(angle);
        ctx.shadowColor = '#FF69B4';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FF69B4';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        const s = Math.max(10, this.radius * 1.6);
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.6);
        ctx.lineTo(s * 0.1, -s * 0.1);
        ctx.lineTo(-s * 0.05, -s * 0.1);
        ctx.lineTo(s * 0.3, s * 0.6);
        ctx.lineTo(-s * 0.1, s * 0.1);
        ctx.lineTo(s * 0.05, s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
}

// Make it globally available
window.SpeedBoostEnemy = SpeedBoostEnemy;