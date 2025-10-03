// Drone System - Side drones that orbit the player and fire at enemies

// Drone Projectile class
class DroneProjectile {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.target = target; // Store reference to target enemy
        const cfg = (window.CONFIG && window.CONFIG.drones) || {};
        this.speed = cfg.projectileSpeed || 8;
        this.lifetime = cfg.projectileLifetime || 2000;
        this.age = 0;
        
        // Homing parameters for 100% hit rate
        this.homingStrength = cfg.homingStrength || 0.8; // Very strong homing
        this.speedBoostRange = cfg.speedBoostRange || 30; // Distance for speed boost
        
        // Initial velocity toward target
        const dx = target.posX - x;
        const dy = target.posY - y;
        const dist = Math.hypot(dx, dy) || 1;
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        
        this.alive = true;
        this.size = 3;
    }
    
    update(dt) {
        // Homing behavior - adjust velocity toward target
        if (this.target && this.target.posX !== undefined) {
            const dx = this.target.posX - this.x;
            const dy = this.target.posY - this.y;
            const distToTarget = Math.hypot(dx, dy);
            
            if (distToTarget > 0) {
                // Calculate desired velocity direction
                const desiredVx = (dx / distToTarget) * this.speed;
                const desiredVy = (dy / distToTarget) * this.speed;
                
                // Apply strong homing - blend current velocity with desired
                this.vx += (desiredVx - this.vx) * this.homingStrength;
                this.vy += (desiredVy - this.vy) * this.homingStrength;
                
                // Normalize to maintain constant speed
                const currentSpeed = Math.hypot(this.vx, this.vy);
                if (currentSpeed > 0) {
                    this.vx = (this.vx / currentSpeed) * this.speed;
                    this.vy = (this.vy / currentSpeed) * this.speed;
                }
                
                // Increase speed when very close for guaranteed hit
                if (distToTarget < this.speedBoostRange) {
                    const boostFactor = 1.5;
                    this.vx *= boostFactor;
                    this.vy *= boostFactor;
                }
            }
        }
        
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.age += dt * 1000;
        
        if (this.age >= this.lifetime) {
            this.alive = false;
        }
    }
    
    draw(ctx) {
        const alpha = Math.max(0.3, 1 - (this.age / this.lifetime));
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Enhanced visual for homing projectile
        ctx.fillStyle = '#00E676';
        ctx.shadowColor = '#00E676';
        ctx.shadowBlur = 12;
        
        // Draw energy bolt with directional indicator
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Enhanced trail effect showing homing trajectory
        const trailX = this.x - this.vx * 0.8;
        const trailY = this.y - this.vy * 0.8;
        
        // Main trail
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        
        // Secondary trail for homing effect
        ctx.strokeStyle = '#81C784';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(this.x - this.vx * 1.2, this.y - this.vy * 1.2);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        
        ctx.restore();
    }
}

// Side Drone class
class SideDrone {
    constructor(playerRef, slotIndex) {
        this.player = playerRef;
        this.slotIndex = slotIndex; // 0 or 1 for positioning
        
        const cfg = (window.CONFIG && window.CONFIG.drones) || {};
        this.orbitRadius = cfg.orbitRadius || 80;
        this.orbitSpeed = cfg.orbitSpeed || 0.02;
        this.fireRange = cfg.fireRange || 150;
        this.fireRate = cfg.fireRate || 800;
        this.size = cfg.size || 12;
        this.color = cfg.color || '#00E676';
        this.glowColor = cfg.glowColor || '#4CAF50';
        this.lifetime = cfg.lifetimeMs || 25000;
        
        // Position and timing
        this.orbitAngle = (slotIndex * Math.PI); // Start drones on opposite sides
        this.lastFireTime = 0;
        this.spawnTime = performance.now();
        this.pulsePhase = 0;
        
        // Current position (calculated each frame)
        this.x = 0;
        this.y = 0;
    }
    
    update(dt, enemies) {
        const now = performance.now();
        
        // Check if drone should expire
        if (now - this.spawnTime > this.lifetime) {
            return false; // Signal for removal
        }
        
        // Update orbit position
        this.orbitAngle += this.orbitSpeed;
        if (this.orbitAngle > Math.PI * 2) {
            this.orbitAngle -= Math.PI * 2;
        }
        
        // Calculate position relative to player
        const playerCenterX = this.player.posX + this.player.width / 2;
        const playerCenterY = this.player.posY + this.player.height / 2;
        this.x = playerCenterX + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = playerCenterY + Math.sin(this.orbitAngle) * this.orbitRadius;
        
        // Update pulse for visual effect
        this.pulsePhase += dt * 4;
        
        // Auto-fire at nearby threats
        if (now - this.lastFireTime > this.fireRate) {
            const target = this.findNearestThreat(enemies);
            if (target) {
                this.fireAt(target);
                this.lastFireTime = now;
            }
        }
        
        return true; // Continue existing
    }
    
    findNearestThreat(enemies) {
        let nearestEnemy = null;
        let nearestDist = this.fireRange;
        
        for (const enemy of enemies) {
            // Only target actual threats (asteroids and homing mines)
            if (!enemy.isDark && !enemy.isHomingMine) continue;
            
            const dx = enemy.posX - this.x;
            const dy = enemy.posY - this.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }
        
        return nearestEnemy;
    }
    
    fireAt(target) {
        // Create projectile toward target
        const projectile = new DroneProjectile(this.x, this.y, target);
        
        // Add to global projectile array (will be created in main.js)
        if (window.droneProjectiles) {
            window.droneProjectiles.push(projectile);
        }
        
        // Visual muzzle flash effect
        this.muzzleFlash = 8; // frames
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Pulsing glow aura
        const pulseIntensity = 0.6 + 0.4 * Math.sin(this.pulsePhase);
        const auraRadius = this.size * (1.2 + 0.3 * Math.sin(this.pulsePhase * 0.7));
        
        // Outer glow
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.fillStyle = this.glowColor + '40'; // Semi-transparent
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Main drone body (hexagonal)
        ctx.shadowBlur = 10;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * this.size * 0.8;
            const y = Math.sin(angle) * this.size * 0.8;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Central core
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Muzzle flash effect
        if (this.muzzleFlash > 0) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.size * 1.5, 0);
            ctx.stroke();
            this.muzzleFlash--;
        }
        
        // Status indicators (lifetime remaining)
        const lifePercent = Math.max(0, 1 - (performance.now() - this.spawnTime) / this.lifetime);
        if (lifePercent < 0.3) {
            // Warning indicator when drone is about to expire
            const warning = Math.sin(this.pulsePhase * 3) > 0 ? 1 : 0.3;
            ctx.globalAlpha = warning;
            ctx.strokeStyle = '#FF5722';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Make them globally available
window.SideDrone = SideDrone;
window.DroneProjectile = DroneProjectile;