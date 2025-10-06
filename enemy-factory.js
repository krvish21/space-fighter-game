// Enemy Factory - Manages creation and spawning of different enemy types

class EnemyFactory {
    static createEnemy(canvasWidth, canvasHeight, difficultyConfig = {}) {
        // Get difficulty-specific spawn chances or use defaults
        const asteroidChance = difficultyConfig.asteroidChance || 0.85;
        const homingChance = difficultyConfig.homingMineChance || 0.06;
        const speedBoostChance = difficultyConfig.speedBoostChance || 0.12;
        const healChance = difficultyConfig.healChance || 0.08;
        const magnetChance = difficultyConfig.magnetChance || 0.08;

        // Determine enemy type based on difficulty-adjusted probabilities
        const roll = Math.random();

        // Basic spawn roll log
        console.log(`Enemy spawn roll: ${roll.toFixed(3)}, asteroidChance: ${asteroidChance}`);

        // Asteroids should spawn most frequently (85% by default)
        if (roll < asteroidChance) {
            console.log('Spawning Asteroid');
            return new Asteroid(canvasWidth, canvasHeight, difficultyConfig);
        }

        // For the remaining space after asteroids, distribute among special enemies
        const remainingSpace = Math.max(0, 1 - asteroidChance);
        let normalizedRoll = 0;
        if (remainingSpace > 0) {
            normalizedRoll = (roll - asteroidChance) / remainingSpace;
        } else {
            // No remaining space for specials (asteroidChance >= 1)
            console.warn('EnemyFactory: asteroidChance >= 1, no space for special enemies');
        }

        // Calculate normalized chances for special enemies

        // Calculate normalized chances for special enemies and guard against sum=0
        const totalSpecialChance = speedBoostChance + magnetChance + homingChance + healChance;
        if (totalSpecialChance <= 0) {
            console.warn('EnemyFactory: totalSpecialChance is 0 or negative — falling back to default special distribution');
            // fallback distribution: equal among specials
            const equal = 1 / 4;
            const normSpeedBoost = equal;
            const normMagnet = equal;
            const normHoming = equal;
            const normHeal = equal;

            if (normalizedRoll < normSpeedBoost) {
                console.log('Spawning SpeedBoostEnemy (fallback)');
                return new SpeedBoostEnemy(canvasWidth, canvasHeight, difficultyConfig);
            } else if (normalizedRoll < normSpeedBoost + normMagnet) {
                console.log('Spawning MagnetEnemy (fallback)');
                return new MagnetEnemy(canvasWidth, canvasHeight, difficultyConfig);
            } else if (normalizedRoll < normSpeedBoost + normMagnet + normHoming) {
                console.log('Spawning HomingMine (fallback)');
                return new HomingMine(canvasWidth, canvasHeight, difficultyConfig);
            } else {
                console.log('Spawning HealEnemy (fallback)');
                return new HealEnemy(canvasWidth, canvasHeight, difficultyConfig);
            }
        }

        const normSpeedBoost = speedBoostChance / totalSpecialChance;
        const normMagnet = magnetChance / totalSpecialChance;
        const normHoming = homingChance / totalSpecialChance;
        const normHeal = healChance / totalSpecialChance;


        if (normalizedRoll < normSpeedBoost) {
            console.log('Spawning SpeedBoostEnemy');
            return new SpeedBoostEnemy(canvasWidth, canvasHeight, difficultyConfig);
        } else if (normalizedRoll < normSpeedBoost + normMagnet) {
            console.log('Spawning MagnetEnemy');
            return new MagnetEnemy(canvasWidth, canvasHeight, difficultyConfig);
        } else if (normalizedRoll < normSpeedBoost + normMagnet + normHoming) {
            console.log('Spawning HomingMine');
            return new HomingMine(canvasWidth, canvasHeight, difficultyConfig);
        } else {
            console.log('Spawning HealEnemy');
            return new HealEnemy(canvasWidth, canvasHeight, difficultyConfig);
        }
    }
}

// Legacy Enemy class wrapper for backwards compatibility
class Enemy {
    constructor(canvasWidth, canvasHeight, difficultyConfig = {}) {
        // Delegate to factory and get actual enemy instance
        this._actualEnemy = EnemyFactory.createEnemy(canvasWidth, canvasHeight, difficultyConfig);

        // Copy all properties from the actual enemy
        this.copyProperties();
    }

    copyProperties() {
        // List of properties that have getters defined - don't copy these
        const skipProperties = ['isDark', 'isHeal', 'isSpeedBoost', 'isMagnet', 'isHomingMine', 'shouldExplode', 'blastRadius', 'posX', 'posY', 'radius', 'vx', 'vy'];

        // Copy all properties from the actual enemy instance except those with getters
        for (let key in this._actualEnemy) {
            if (typeof this._actualEnemy[key] !== 'function' && !skipProperties.includes(key)) {
                this[key] = this._actualEnemy[key];
            }
        }
    }

    update(playerX, playerY) {
        const result = this._actualEnemy.update(playerX, playerY);
        // Sync properties after update
        this.copyProperties();
        return result;
    }

    draw(ctx) {
        const result = this._actualEnemy.draw(ctx);
        // Sync properties after draw
        this.copyProperties();
        return result;
    }

    // Proxy property access to ensure we always get current values
    get posX() { return this._actualEnemy.posX; }
    set posX(value) { this._actualEnemy.posX = value; }

    get posY() { return this._actualEnemy.posY; }
    set posY(value) { this._actualEnemy.posY = value; }

    get radius() { return this._actualEnemy.radius; }
    set radius(value) { this._actualEnemy.radius = value; }

    get vx() { return this._actualEnemy.vx; }
    set vx(value) { this._actualEnemy.vx = value; }

    get vy() { return this._actualEnemy.vy; }
    set vy(value) { this._actualEnemy.vy = value; }

    get isDark() { return this._actualEnemy.isDark; }
    get isHeal() { return this._actualEnemy.isHeal; }
    get isSpeedBoost() { return this._actualEnemy.isSpeedBoost; }
    get isMagnet() { return this._actualEnemy.isMagnet; }
    get isHomingMine() { return this._actualEnemy.isHomingMine; }
    get shouldExplode() { return this._actualEnemy.shouldExplode; }
    get blastRadius() { return this._actualEnemy.blastRadius; }
}

// Make them globally available
window.EnemyFactory = EnemyFactory;
window.Enemy = Enemy;