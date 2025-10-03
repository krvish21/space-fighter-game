const canvas = new myCanvas();
canvas.draw();

// Early declarations for values used by menu wiring
let gameStartTs = 0;
let gameStarted = false;
let gamePaused = false; // Add pause state
let pausedTs = 0; // Track when game was paused for time adjustment
let totalPausedTime = 0; // Total time spent paused
let spawnIntervalMs = (window.CONFIG && window.CONFIG.spawn && window.CONFIG.spawn.intervalMs) || 800; // overridden by difficulty
let currentDifficulty = 'normal'; // track current difficulty setting
let difficultyConfig = {}; // store current difficulty modifiers

// Make key game state variables globally accessible
window.gameStarted = gameStarted;
window.gameOver = false;
window.gamePaused = gamePaused;

// SFX
const cometSound = new Audio('../assests/sounds/comet.wav');
cometSound.volume = 0.6;
const explosionSound = new Audio('../assests/sounds/explosion.wav');
explosionSound.volume = 0.7;
const zapSound = new Audio('../assests/sounds/zap.mp3');
zapSound.volume = 0.8;
const finalSound = new Audio('../assests/sounds/final.mp3');
finalSound.volume = 0.9;
const pickSound = new Audio('../assests/sounds/pick.mp3');
pickSound.volume = 0.5;
const powerupSound = new Audio('../assests/sounds/power_up.mp3');
powerupSound.volume = 0.5;

// Global cleanup state
let gameCleanupHandlers = [];
let animationFrameId = null;

// Add global cleanup function
function cleanupGame() {
    console.log('Cleaning up game resources...');
    
    // Cancel animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Clean up car resources
    if (typeof car !== 'undefined' && car && car.cleanup) {
        car.cleanup();
    }
    
    // Clean up all audio elements
    const audioElements = [cometSound, explosionSound, zapSound, finalSound, pickSound, powerupSound];
    audioElements.forEach(audio => {
        if (audio) {
            try {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });
    
    // Clear all game arrays
    if (typeof enemies !== 'undefined') enemies.length = 0;
    if (typeof floatingTexts !== 'undefined') floatingTexts.length = 0;
    if (typeof shockwaves !== 'undefined') shockwaves.length = 0;
    if (typeof sideDrones !== 'undefined') sideDrones.length = 0;
    if (typeof droneProjectiles !== 'undefined') droneProjectiles.length = 0;
    
    // Clear global state
    gameStarted = false;
    gameOver = false;
    centerHeal = null;
    comet = null;
    explosion = null;
    shieldPickup = null;
    novaBomb = null;
    dronePickup = null;
    
    // Run any additional cleanup handlers
    gameCleanupHandlers.forEach(handler => {
        try {
            handler();
        } catch (e) {
            console.warn('Cleanup handler error:', e);
        }
    });
    gameCleanupHandlers.length = 0;
    
    console.log('Game cleanup completed');
}

// Menu wiring
const menuEl = document.getElementById('menu');
const startBtn = document.getElementById('start-btn');
const diffSel = document.getElementById('difficulty');

function applyDifficulty(value) {
    currentDifficulty = value;
    
    // Get difficulty-specific configuration
    const baseCfg = window.CONFIG?.spawn || {};
    difficultyConfig = baseCfg.difficulty?.[value] || baseCfg.difficulty?.normal || {};
    
    // Apply spawn timing
    spawnIntervalMs = difficultyConfig.intervalMs || baseCfg.intervalMs || 800;
    
    console.log(`Difficulty set to ${value.toUpperCase()}:`, {
        spawnInterval: spawnIntervalMs + 'ms',
        burstSize: `${difficultyConfig.burstMin || baseCfg.burstMin || 1}-${difficultyConfig.burstMax || baseCfg.burstMax || 3}`,
        asteroidChance: (difficultyConfig.asteroidChance || 0.85) * 100 + '%',
        enemySpeedMultiplier: difficultyConfig.enemySpeedMultiplier || 1.0
    });
}

if (diffSel) {
    applyDifficulty(diffSel.value);
    diffSel.addEventListener('change', (e) => applyDifficulty(e.target.value));
}

if (startBtn) {
    startBtn.addEventListener('click', () => {
        startGame(); // Use the proper startGame function instead of partial reset
    });
}

const carConfig = {
    pos: { x: 100, y: 100 },
    size: (window.CONFIG && window.CONFIG.player && window.CONFIG.player.size) || { w: 52, h: 26 },
    color: '#9C27B0'
}
// Position car at bottom-center at start
carConfig.pos = {
    x: Math.floor((canvas.width - carConfig.size.w) / 2),
    y: canvas.height - carConfig.size.h - 20
}

const car = new Car(carConfig.pos, carConfig.size, carConfig.color);
car.setControls();

// Enemies setup
const enemies = [];
let lastSpawn = 0;
let lastFrameTs = 0;
const targetDelta = 1000 / 100; // ~100 FPS

// Game state variables
let centerHeal = null;
let centerHealCooldownUntil = 0;
let shieldPickup = null;
let nextShieldWindowAt = 0;
let novaBomb = null;
let lastNovaBombSpawn = 0;
let dronePickup = null;
let sideDrones = [];
let droneProjectiles = [];
let lastDronePickupSpawn = 0;

// Make projectile array globally accessible for drones
window.droneProjectiles = droneProjectiles;

// Game timing and state
let gameOver = false;
let finalDurationMs = 0;
let healsConsumed = 0;
let speedBonusHeals = 0;
let worldDistance = 0;
let lastCometHealTrigger = 0;

// Visual effects
let comet = null;
let nextCometAt = 0;
let explosion = null;
let shakeTimeMs = 0;
let hurtFlashMs = 0;
const shockwaves = [];
const floatingTexts = [];

// Hit-stop system
let hitStopFrames = 0;
let hitStopTimeScale = 1.0;

function addFloatingText(x, y, text, type) {
    const cfg = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.floatingText) || {};
    if (!cfg.enabled) return;
    
    const floatingText = createFloatingText(x, y, text, type);
    floatingTexts.push(floatingText);
}

function triggerHitStop(type) {
    const cfg = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.hitStop) || {};
    if (!cfg.enabled) return;
    
    let shouldTrigger = false;
    if (type === 'damage' && cfg.triggerOnDamage) shouldTrigger = true;
    if (type === 'pickup' && cfg.triggerOnPickup) shouldTrigger = true;
    if (type === 'explosion' && cfg.triggerOnExplosion) shouldTrigger = true;
    
    if (shouldTrigger) {
        hitStopFrames = cfg.duration || 8;
        hitStopTimeScale = cfg.timeScale || 0.1;
    }
}

// Function to sync local variables with global ones
function syncGlobalGameState() {
    window.gameStarted = gameStarted;
    window.gameOver = gameOver;
    window.gamePaused = gamePaused;
}

function run(ts) {
    // Throttle to target FPS
    if (!lastFrameTs) lastFrameTs = ts || performance.now();
    const elapsed = (ts || performance.now()) - lastFrameTs;
    const dt = elapsed / 1000; // seconds
    if (elapsed < targetDelta) {
        animationFrameId = requestAnimationFrame(run);
        return;
    }
    lastFrameTs = ts || performance.now();

    canvas.clear();
    
    // Only advance camera and world if not paused
    if (gameStarted && !gameOver && !gamePaused) {
        // Parallax follow: match screen displacement of the ship
        const dx = car.velocityX * dt * 60;
        const dy = car.velocityY * dt * 60;
        const parallax = (window.CONFIG && window.CONFIG.parallax && window.CONFIG.parallax.factor) || 0.5;
        canvas.cameraX += dx * parallax;
        canvas.cameraY += dy * parallax;
        worldDistance += Math.hypot(dx, dy) * parallax;
    }
    canvas.draw();

    const ctx = canvas.getContext();
    const nowTs = ts || performance.now();

    if (gameStarted && !gameStartTs) gameStartTs = ts || performance.now();

    // Only update car controls and movement if not paused
    if (gameStarted && !gameOver && !gamePaused) {
        car.controls.update(dt);
        car.update(dt);
    }

    // Apply screen shake
    if (shakeTimeMs > 0) {
        const t = Math.min(1, shakeTimeMs / 300);
        const intensity = 6 * t;
        const ox = (Math.random() - 0.5) * 2 * intensity;
        const oy = (Math.random() - 0.5) * 2 * intensity;
        ctx.save();
        ctx.translate(ox, oy);
    } else {
        ctx.save();
    }

    car.draw(ctx);

    // Only spawn and update enemies if not paused
    if (gameStarted && !gameOver && !gamePaused) {
        // Spawn enemies
        if (nowTs - lastSpawn > spawnIntervalMs) {
            const baseCfg = window.CONFIG?.spawn || {};
            const burstMin = difficultyConfig.burstMin || baseCfg.burstMin || 1;
            const burstMax = difficultyConfig.burstMax || baseCfg.burstMax || 3;
            const batch = Math.floor(burstMin + Math.random() * (burstMax - burstMin + 1));
            for (let i = 0; i < batch; i++) {
                try {
                    const newEnemy = new Enemy(canvas.width, canvas.height, difficultyConfig);
                    if (newEnemy) {
                        enemies.push(newEnemy);
                    }
                } catch (error) {
                    console.warn('Failed to create enemy:', error);
                }
            }
            lastSpawn = nowTs;
        }

        // Spawn rare center heal orb
        if (!centerHeal && nowTs > centerHealCooldownUntil) {
            const moonChance = (window.CONFIG && window.CONFIG.moon && window.CONFIG.moon.spawnChance) || 0.003;
            if (Math.random() < moonChance) {
                centerHeal = new CenterHeal(canvas.width, canvas.height);
            }
        }

        // Spawn a comet every so often (purely visual)
        if (!comet && nowTs >= nextCometAt) {
            const winChance = (window.CONFIG && window.CONFIG.comet && window.CONFIG.comet.windowChance) || 0.01;
            if (Math.random() < winChance) {
                const path = computeCometPathThroughAsteroid(canvas.width, canvas.height);
                if (path) comet = new Comet(canvas.width, canvas.height, path.start, path.end); 
                else comet = new Comet(canvas.width, canvas.height);
                try { 
                    cometSound.currentTime = 0; 
                    cometSound.play().catch(() => {}); 
                } catch (e) {}
            }
            if (!comet) {
                const range = (window.CONFIG && window.CONFIG.comet && window.CONFIG.comet.windowDelayRange) || [5000, 15000];
                nextCometAt = nowTs + (range[0] + Math.random() * (range[1] - range[0]));
            }
        }

        // Spawn shield pickup on interval windows
        if (!shieldPickup && nowTs >= nextShieldWindowAt) {
            const cfg = (window.CONFIG && window.CONFIG.shield) || {};
            const chance = cfg.windowChance != null ? cfg.windowChance : 0.22;
            const interval = cfg.spawnIntervalMs != null ? cfg.spawnIntervalMs : 12000;
            if (Math.random() < chance) {
                shieldPickup = new ShieldPickup(canvas.width, canvas.height);
            }
            nextShieldWindowAt = nowTs + interval;
        }

        // Spawn Nova Bomb when screen gets crowded
        if (!novaBomb) {
            const cfg = (window.CONFIG && window.CONFIG.novaBomb) || {};
            const crowdThreshold = cfg.crowdThreshold || 20;
            const spawnChance = cfg.spawnChance || 0.15;
            const cooldownMs = cfg.cooldownMs || 30000;
            
            if (enemies.length >= crowdThreshold && (nowTs - lastNovaBombSpawn) >= cooldownMs) {
                if (Math.random() < spawnChance) {
                    novaBomb = new NovaBomb(canvas.width, canvas.height);
                    lastNovaBombSpawn = nowTs;
                }
            }
        }

        // Spawn drone pickup on cooldown
        if (!dronePickup) {
            const cfg = (window.CONFIG && window.CONFIG.drones) || {};
            if (cfg.enabled) {
                const spawnChance = cfg.spawnChance || 0.12;
                const cooldownMs = cfg.spawnCooldownMs || 15000;
                
                if ((nowTs - lastDronePickupSpawn) >= cooldownMs) {
                    if (Math.random() < spawnChance) {
                        dronePickup = new DronePickup(canvas.width, canvas.height);
                        lastDronePickupSpawn = nowTs;
                    }
                }
            }
        }

        // Update and manage side drones
        const cfg = (window.CONFIG && window.CONFIG.drones) || {};
        if (cfg.enabled) {
            for (let i = sideDrones.length - 1; i >= 0; i--) {
                const drone = sideDrones[i];
                const stillAlive = drone.update(dt, enemies);
                if (!stillAlive) {
                    sideDrones.splice(i, 1);
                }
            }
            
            for (let i = droneProjectiles.length - 1; i >= 0; i--) {
                const proj = droneProjectiles[i];
                proj.update(dt);
                
                if (!proj.alive) {
                    droneProjectiles.splice(i, 1);
                    continue;
                }
                
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (!enemy.isDark && !enemy.isHomingMine) continue;
                    
                    const dx = proj.x - enemy.posX;
                    const dy = proj.y - enemy.posY;
                    const dist = Math.hypot(dx, dy);
                    
                    if (dist <= enemy.radius + proj.size) {
                        startExplosion(enemy.posX, enemy.posY);
                        try { 
                            explosionSound.currentTime = 0; 
                            explosionSound.play().catch(() => {}); 
                        } catch (e) {}
                        triggerShockwave(enemy.posX, enemy.posY, enemy.radius * 3);
                        
                        droneProjectiles.splice(i, 1);
                        enemies.splice(j, 1);
                        break;
                    }
                }
            }
        }
    }

    // Magnet attraction - only if not paused
    if (!gamePaused && (car.magnetTimerMs || 0) > 0) {
        const cfgM = (window.CONFIG && window.CONFIG.magnet) || {};
        const radius = cfgM.radius != null ? cfgM.radius : 220;
        const strength = cfgM.strength != null ? cfgM.strength : 0.35;
        const cx = car.posX + car.width / 2;
        const cy = car.posY + car.height / 2;
        for (const e of enemies) {
            if (!(e.isHeal || e.isSpeedBoost || e.isMagnet)) continue;
            const dx = cx - e.posX;
            const dy = cy - e.posY;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist <= radius) {
                const pull = strength * (1 - dist / radius);
                e.vx = (e.vx || 0) + (dx / dist) * pull;
                e.vy = (e.vy || 0) + (dy / dist) * pull;
            }
        }
        car.magnetTimerMs = Math.max(0, car.magnetTimerMs - elapsed);
    }

    // Handle all pickups - only if not paused
    if (!gamePaused) {
        handlePickups(ctx, nowTs);
    } else {
        // Still draw pickups when paused, just don't update them
        if (centerHeal) centerHeal.draw(ctx, nowTs);
        if (shieldPickup) shieldPickup.draw(ctx, nowTs);
        if (novaBomb) novaBomb.draw(ctx, nowTs);
        if (dronePickup) dronePickup.draw(ctx, nowTs);
    }

    // Update and draw enemies - only if not paused
    if (gameStarted && !gameOver) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            
            // Add null check to prevent errors
            if (!enemy) {
                enemies.splice(i, 1);
                continue;
            }
            
            // Update enemy if not paused
            if (!gamePaused) {
                // Add safety check for update method
                if (typeof enemy.update === 'function') {
                    enemy.update(dt);
                }
                
                // Remove enemies that are off-screen or dead
                if (enemy.posX < -50 || enemy.posX > canvas.width + 50 || 
                    enemy.posY < -50 || enemy.posY > canvas.height + 50 || 
                    enemy.health <= 0) {
                    enemies.splice(i, 1);
                    continue;
                }
                
                // Check collision with player (only for harmful enemies)
                if (enemy.isDark || enemy.isHomingMine) {
                    const dx = enemy.posX - (car.posX + car.width / 2);
                    const dy = enemy.posY - (car.posY + car.height / 2);
                    const distance = Math.hypot(dx, dy);
                    const collisionRadius = enemy.radius + Math.min(car.width, car.height) / 2;
                    
                    if (distance < collisionRadius) {
                        // Handle collision
                        if (car.invincibleHitsRemaining > 0) {
                            // Player has shield
                            car.invincibleHitsRemaining--;
                            startExplosion(enemy.posX, enemy.posY);
                            try { 
                                explosionSound.currentTime = 0; 
                                explosionSound.play().catch(() => {}); 
                            } catch (e) {}
                            enemies.splice(i, 1);
                        } else {
                            // Player takes damage
                            car.health -= 0.34; // Roughly 3 hits to kill
                            car.hitCount++;
                            car.triggerFeedback('damage');
                            hurtFlashMs = 300;
                            shakeTimeMs = 200;
                            
                            startExplosion(enemy.posX, enemy.posY);
                            try { 
                                explosionSound.currentTime = 0; 
                                explosionSound.play().catch(() => {}); 
                            } catch (e) {}
                            enemies.splice(i, 1);
                            
                            // Check game over
                            if (car.health <= 0) {
                                gameOver = true;
                                car.health = 0; // Ensure health doesn't go negative
                                finalDurationMs = nowTs - gameStartTs - totalPausedTime;
                                console.log('Game Over: Player health reached 0');
                            }
                        }
                        continue;
                    }
                }
                
                // Handle pickup enemies (heal, speed boost, magnet)
                if (enemy.isHeal || enemy.isSpeedBoost || enemy.isMagnet) {
                    const dx = enemy.posX - (car.posX + car.width / 2);
                    const dy = enemy.posY - (car.posY + car.height / 2);
                    const distance = Math.hypot(dx, dy);
                    const pickupRadius = enemy.radius + Math.min(car.width, car.height) / 2;
                    
                    if (distance < pickupRadius) {
                        if (enemy.isHeal) {
                            car.health = Math.min(car.maxHealth, car.health + 0.25);
                            car.hitCount = Math.max(0, car.hitCount - 1);
                            car.triggerFeedback('heal');
                            addFloatingText(enemy.posX, enemy.posY, '+25%', 'heal');
                            healsConsumed++;
                            speedBonusHeals++;
                            applySpeedScaling();
                        } else if (enemy.isSpeedBoost) {
                            car.speedBoostTimerMs = 3500;
                            car.maxSpeed = car.baseMaxSpeed * 1.4;
                            car.triggerFeedback('boost');
                            addFloatingText(enemy.posX, enemy.posY, 'SPEED!', 'boost');
                        } else if (enemy.isMagnet) {
                            car.magnetTimerMs = 6000;
                            car.triggerFeedback('magnet');
                            addFloatingText(enemy.posX, enemy.posY, 'MAGNET!', 'magnet');
                        }
                        
                        try { 
                            pickSound.currentTime = 0; 
                            pickSound.play().catch(() => {}); 
                        } catch (e) {}
                        
                        enemies.splice(i, 1);
                        continue;
                    }
                }
            }
            
            // Draw enemy - add additional safety check
            if (enemy && typeof enemy.draw === 'function') {
                enemy.draw(ctx);
            }
        }
    }

    // Draw side drones and projectiles
    if (gameStarted) {
        const cfg = (window.CONFIG && window.CONFIG.drones) || {};
        if (cfg.enabled) {
            for (const drone of sideDrones) {
                drone.draw(ctx);
            }
        }
    }

    for (const proj of droneProjectiles) {
        proj.draw(ctx);
    }

    ctx.restore();

    // Draw UI/HUD
    drawHUD(ctx, nowTs);

    // Draw/update comet - only update if not paused
    if (comet) {
        if (!gamePaused) {
            comet.update(canvas.width, canvas.height);
            
            const angle = Math.atan2(comet.vy, comet.vx);
            const tx = comet.x - Math.cos(angle) * comet.length;
            const ty = comet.y - Math.sin(angle) * comet.length;
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                const collided = lineCircleIntersect(comet.x, comet.y, tx, ty, e.posX, e.posY, (e.radius || 12) + comet.thickness);
                if (collided) {
                    startExplosion(e.posX, e.posY);
                    try { 
                        explosionSound.currentTime = 0; 
                        explosionSound.play().catch(() => {}); 
                    } catch (e) {}
                    applyShockwave(e.posX, e.posY, 200, 8);
                    triggerShockwave(e.posX, e.posY, 220);
                    enemies.splice(i, 1);
                }
            }
            if (!comet.alive) {
                comet = null;
                nextCometAt = nowTs + (5000 + Math.random() * 10000);
            }
        }
        comet.draw(ctx);
    }

    // Draw explosion particles - only update if not paused
    if (explosion) {
        if (!gamePaused) explosion.update();
        explosion.draw(ctx);
        if (explosion.done) explosion = null;
    }

    // Red hurt overlay
    if (hurtFlashMs > 0) {
        const alpha = Math.max(0, Math.min(0.35, hurtFlashMs / 300 * 0.35));
        ctx.save();
        ctx.fillStyle = `rgba(255,0,0,${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Update timers - only if not paused
    if (!gamePaused) {
        if (shakeTimeMs > 0) shakeTimeMs = Math.max(0, shakeTimeMs - elapsed);
        if (hurtFlashMs > 0) hurtFlashMs = Math.max(0, hurtFlashMs - elapsed);
    }

    // Update shockwaves - only if not paused
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        if (!gamePaused) s.update();
        s.draw(ctx);
        if (s.done) shockwaves.splice(i, 1);
    }

    // Update floating texts - only if not paused
    const textCfg = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.floatingText) || {};
    if (textCfg.enabled) {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            const stillAlive = gamePaused ? true : ft.update(dt); // Don't update if paused
            if (!stillAlive) {
                floatingTexts.splice(i, 1);
                continue;
            }
            ft.draw(ctx);
        }
    }

    // Update hit-stop - only if not paused
    if (!gamePaused && hitStopFrames > 0) {
        hitStopFrames--;
        if (hitStopFrames <= 0) {
            hitStopTimeScale = 1.0;
        }
    }

    // Sync global state for external access
    syncGlobalGameState();

    animationFrameId = requestAnimationFrame(run);
}

// Helper functions
function handlePickups(ctx, nowTs) {
    // Handle center heal
    if (centerHeal) {
        centerHeal.update(nowTs);
        centerHeal.draw(ctx, nowTs);
        
        const circleX = centerHeal.posX;
        const circleY = centerHeal.posY;
        const radius = centerHeal.radius;
        const rectX = car.posX;
        const rectY = car.posY;
        const rectW = car.width;
        const rectH = car.height;
        const closestX = Math.max(rectX, Math.min(circleX, rectX + rectW));
        const closestY = Math.max(rectY, Math.min(circleY, rectY + rectH));
        const dx = circleX - closestX;
        const dy = circleY - closestY;
        const intersects = (dx * dx + dy * dy) <= (radius * radius);
        
        if (intersects) {
            const phase = centerHeal.getPhase(nowTs);
            const healAmount = phase;
            car.health = Math.min(car.maxHealth, car.health + healAmount);
            car.hitCount = Math.max(0, Math.floor(car.hitCount * (1 - phase)));
            car.triggerFeedback('heal');
            addFloatingText(centerHeal.posX, centerHeal.posY, `+${Math.round(phase * 100)}%`, 'heal');
            healsConsumed += 1;
            speedBonusHeals += 1;
            applySpeedScaling();
            
            try { powerupSound.currentTime = 0; powerupSound.play().catch(() => {}); } catch (e) {}
            
            const everyN2 = (window.CONFIG && window.CONFIG.comet && window.CONFIG.comet.healTriggerEvery) || 5;
            if (!comet && healsConsumed > 0 && healsConsumed % everyN2 === 0 && lastCometHealTrigger !== healsConsumed) {
                comet = new Comet(canvas.width, canvas.height);
                lastCometHealTrigger = healsConsumed;
                const range2 = (window.CONFIG && window.CONFIG.comet && window.CONFIG.comet.windowDelayRange) || [5000, 15000];
                nextCometAt = nowTs + (range2[0] + Math.random() * (range2[1] - range2[0]));
            }
            centerHeal = null;
            centerHealCooldownUntil = nowTs + (10000 + Math.random() * 10000);
        } else if (centerHeal.dead) {
            centerHeal = null;
            centerHealCooldownUntil = nowTs + (10000 + Math.random() * 10000);
        }
    }

    // Handle shield pickup
    if (shieldPickup) {
        shieldPickup.update(nowTs);
        shieldPickup.draw(ctx, nowTs);
        
        if (checkCircleRectCollision(shieldPickup, car)) {
            const cfg = (window.CONFIG && window.CONFIG.shield) || {};
            const hits = cfg.maxHits != null ? cfg.maxHits : 3;
            car.applyInvincibility(hits);
            try {
                const sfx = new Audio((cfg && cfg.pickupSound) || 'power_up.mp3');
                sfx.volume = 0.6;
                sfx.currentTime = 0; sfx.play().catch(() => {});
            } catch (e) {}
            addFloatingText(shieldPickup.posX, shieldPickup.posY, 'SHIELD!', 'shield');
            triggerHitStop('pickup');
            shieldPickup = null;
        } else if (shieldPickup.dead) {
            shieldPickup = null;
        }
    }

    // Handle Nova Bomb
    if (novaBomb) {
        novaBomb.update(nowTs);
        novaBomb.draw(ctx, nowTs);
        
        if (checkCircleRectCollision(novaBomb, car)) {
            const cfg = (window.CONFIG && window.CONFIG.novaBomb) || {};
            const explosionRadius = cfg.explosionRadius || 500;
            
            for (let i = 0; i < 5; i++) {
                const expX = Math.random() * canvas.width;
                const expY = Math.random() * canvas.height;
                startExplosion(expX, expY);
                triggerShockwave(expX, expY, explosionRadius / (i + 1));
            }
            
            startExplosion(novaBomb.posX, novaBomb.posY);
            triggerShockwave(novaBomb.posX, novaBomb.posY, explosionRadius);
            
            enemies.length = 0;
            
            shakeTimeMs = 800;
            hurtFlashMs = 0;
            
            try { 
                explosionSound.currentTime = 0; 
                explosionSound.volume = 1.0;
                explosionSound.play().catch(() => {}); 
                setTimeout(() => {
                    try {
                        powerupSound.currentTime = 0;
                        powerupSound.volume = 0.8;
                        powerupSound.play().catch(() => {});
                    } catch (e) {}
                }, 200);
            } catch (e) {}
            
            car.health = Math.min(car.maxHealth, car.health + 0.2);
            car.triggerFeedback('heal');
            addFloatingText(novaBomb.posX, novaBomb.posY, 'NOVA!', 'nova');
            triggerHitStop('pickup');
            novaBomb = null;
        } else if (novaBomb.dead) {
            novaBomb = null;
        }
    }

    // Handle drone pickup
    if (dronePickup) {
        dronePickup.update(nowTs);
        dronePickup.draw(ctx, nowTs);
        
        if (checkCircleRectCollision(dronePickup, car)) {
            const cfg = (window.CONFIG && window.CONFIG.drones) || {};
            const maxDrones = cfg.maxDrones || 2;
            
            if (sideDrones.length < maxDrones) {
                const newDrone = new SideDrone(car, sideDrones.length);
                sideDrones.push(newDrone);
                
                try { 
                    powerupSound.currentTime = 0; 
                    powerupSound.play().catch(() => {}); 
                } catch (e) {}
                
                addFloatingText(dronePickup.posX, dronePickup.posY, 'DRONE!', 'pickup');
                triggerHitStop('pickup');
            }
            
            dronePickup = null;
        } else if (dronePickup.dead) {
            dronePickup = null;
        }
    }
}

function checkCircleRectCollision(circle, rect) {
    const circleX = circle.posX;
    const circleY = circle.posY;
    const radius = circle.radius;
    const rectX = rect.posX;
    const rectY = rect.posY;
    const rectW = rect.width;
    const rectH = rect.height;
    const closestX = Math.max(rectX, Math.min(circleX, rectX + rectW));
    const closestY = Math.max(rectY, Math.min(circleY, rectY + rectH));
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return (dx * dx + dy * dy) <= (radius * radius);
}

function drawHUD(ctx, nowTs) {
    // Adjust elapsed time calculation to account for paused time
    const rawElapsedMs = gameOver ? finalDurationMs : (gameStarted ? (nowTs - gameStartTs) : 0);
    const currentPauseTime = gamePaused ? (nowTs - pausedTs) : 0;
    const elapsedMs = Math.max(0, rawElapsedMs - totalPausedTime - currentPauseTime);
    const minsHud = Math.max(0, Math.floor(elapsedMs / 60000));
    const secsHud = Math.max(0, Math.floor((elapsedMs % 60000) / 1000));

    // === MAIN HUD BAR === 
    const hudBarHeight = 70;
    const hudPadding = 20;
    
    ctx.save();
    
    // Enhanced HUD background with sci-fi gradient
    const hudGradient = ctx.createLinearGradient(0, 0, 0, hudBarHeight);
    hudGradient.addColorStop(0, 'rgba(10, 10, 26, 0.95)');
    hudGradient.addColorStop(0.3, 'rgba(22, 33, 62, 0.92)');
    hudGradient.addColorStop(0.7, 'rgba(16, 21, 46, 0.88)');
    hudGradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
    ctx.fillStyle = hudGradient;
    ctx.fillRect(0, 0, canvas.width, hudBarHeight);
    
    // Animated scan lines effect
    const scanLineY = ((nowTs * 0.03) % (hudBarHeight * 2)) - hudBarHeight;
    if (scanLineY >= 0 && scanLineY <= hudBarHeight) {
        const scanGradient = ctx.createLinearGradient(0, scanLineY - 3, 0, scanLineY + 3);
        scanGradient.addColorStop(0, 'rgba(0, 229, 255, 0)');
        scanGradient.addColorStop(0.5, 'rgba(0, 229, 255, 0.4)');
        scanGradient.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = scanGradient;
        ctx.fillRect(0, scanLineY - 3, canvas.width, 6);
    }
    
    // Grid overlay pattern
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 25;
    const gridOffset = (nowTs * 0.01) % gridSize;
    for (let x = -gridOffset; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, hudBarHeight);
        ctx.stroke();
    }
    
    // Top border with animated pulse
    const borderPulse = 0.6 + 0.4 * Math.sin(nowTs * 0.003);
    ctx.strokeStyle = `rgba(0, 229, 255, ${borderPulse})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.stroke();
    
    // Bottom border
    ctx.strokeStyle = `rgba(0, 229, 255, ${borderPulse * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, hudBarHeight - 1);
    ctx.lineTo(canvas.width, hudBarHeight - 1);
    ctx.stroke();
    
    // Corner decorative elements
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 10;
    const cornerSize = 30;
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(0, cornerSize);
    ctx.lineTo(0, 0);
    ctx.lineTo(cornerSize, 0);
    ctx.stroke();
    
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(canvas.width - cornerSize, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(canvas.width, cornerSize);
    ctx.stroke();
    
    ctx.restore();

    // === PRIMARY STATS SECTION ===
    const stats = [
        { 
            label: 'HULL INTEGRITY', 
            value: `${(car.health * 100).toFixed(0)}%`, 
            color: car.health <= 0.25 ? '#FF1744' : car.health <= 0.50 ? '#FF6B35' : '#00E5FF',
            priority: 'critical',
            icon: '🛡️'
        },
        { 
            label: 'DAMAGE LEVEL', 
            value: `${car.hitCount}/3`, 
            color: car.hitCount >= 2 ? '#FF1744' : car.hitCount >= 1 ? '#FF6B35' : '#50FA7B',
            priority: 'high',
            icon: '⚠️'
        },
        { 
            label: 'HEALS COLLECTED', 
            value: `${healsConsumed}`, 
            color: '#50FA7B',
            priority: 'medium',
            icon: '🌙'
        },
        { 
            label: 'MISSION TIME', 
            value: `${String(minsHud).padStart(2, '0')}:${String(secsHud).padStart(2, '0')}`, 
            color: '#F1FA8C',
            priority: 'high',
            icon: '⏱️'
        }
    ];
    
    ctx.save();
    ctx.textBaseline = 'top';
    
    // Left section - Primary stats with enhanced styling
    let leftX = hudPadding + 10;
    const statY = 16;
    const primaryGap = 110;
    
    for (let i = 0; i < stats.length; i++) {
        const stat = stats[i];
        const isCritical = stat.priority === 'critical';
        const isHigh = stat.priority === 'high';
        
        // Stat container background
        const containerWidth = 95;
        const containerHeight = 38;
        const containerY = statY - 4;
        
        // Background panel
        const panelGradient = ctx.createLinearGradient(leftX - 5, containerY, leftX - 5, containerY + containerHeight);
        panelGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        panelGradient.addColorStop(0.5, 'rgba(0, 229, 255, 0.05)');
        panelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(leftX - 5, containerY, containerWidth, containerHeight);
        
        // Panel border
        ctx.strokeStyle = isCritical ? 'rgba(255, 23, 68, 0.6)' : 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX - 5, containerY, containerWidth, containerHeight);
        
        // Label with Orbitron font
        ctx.font = "9px 'Orbitron', monospace";
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 2;
        ctx.textAlign = 'left';
        ctx.fillText(stat.label, leftX, statY);
        
        // Value with enhanced styling
        const fontSize = isCritical ? 20 : isHigh ? 18 : 16;
        ctx.font = `bold ${fontSize}px 'Orbitron', monospace`;
        ctx.fillStyle = stat.color;
        ctx.shadowColor = stat.color;
        ctx.shadowBlur = isCritical ? 12 : isHigh ? 8 : 6;
        ctx.fillText(stat.value, leftX, statY + 18);
        
        // Status indicator dot for critical stats
        if (isCritical) {
            const dotPulse = 0.5 + 0.5 * Math.sin(nowTs * 0.008);
            ctx.fillStyle = `${stat.color}${Math.round(dotPulse * 255).toString(16).padStart(2, '0')}`;
            ctx.shadowColor = stat.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(leftX + containerWidth - 15, containerY + 8, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        leftX += primaryGap;
    }
    
    ctx.restore();

    // === ENHANCED STATUS INDICATORS ===
    const statusItems = [
        { 
            label: 'SHIELD', 
            value: car.invincibleHitsRemaining > 0 ? `${car.invincibleHitsRemaining}` : '—', 
            color: car.invincibleHitsRemaining > 0 ? '#8BE9FD' : '#6272A4', 
            active: car.invincibleHitsRemaining > 0,
            icon: '🛡️'
        },
        { 
            label: 'BOOST', 
            value: (car.speedBoostTimerMs || 0) > 0 ? `${Math.ceil(car.speedBoostTimerMs / 1000)}S` : '—', 
            color: (car.speedBoostTimerMs || 0) > 0 ? '#FF69B4' : '#6272A4', 
            active: (car.speedBoostTimerMs || 0) > 0,
            icon: '🚀'
        },
        { 
            label: 'MAGNET', 
            value: (car.magnetTimerMs || 0) > 0 ? `${Math.ceil(car.magnetTimerMs / 1000)}S` : '—', 
            color: (car.magnetTimerMs || 0) > 0 ? '#50FA7B' : '#6272A4', 
            active: (car.magnetTimerMs || 0) > 0,
            icon: '🧲'
        },
        { 
            label: 'DRONES', 
            value: sideDrones.length > 0 ? `${sideDrones.length}` : '—', 
            color: sideDrones.length > 0 ? '#F1FA7C' : '#6272A4', 
            active: sideDrones.length > 0,
            icon: '🤖'
        }
    ];

    ctx.save();
    const statusStartX = canvas.width - hudPadding - 280;
    let statusX = statusStartX;
    
    for (let i = 0; i < statusItems.length; i++) {
        const status = statusItems[i];
        const isActive = status.active;
        
        // Enhanced status box
        const boxWidth = 65;
        const boxHeight = 38;
        const boxY = 16;
        
        // Box background with gradient
        const statusGradient = ctx.createLinearGradient(statusX, boxY, statusX, boxY + boxHeight);
        if (isActive) {
            statusGradient.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
            statusGradient.addColorStop(0.5, 'rgba(0, 229, 255, 0.08)');
            statusGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        } else {
            statusGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
            statusGradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        }
        ctx.fillStyle = statusGradient;
        ctx.fillRect(statusX, boxY, boxWidth, boxHeight);
        
        // Box border with glow
        ctx.strokeStyle = isActive ? status.color : 'rgba(100, 100, 100, 0.4)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.shadowColor = isActive ? status.color : 'transparent';
        ctx.shadowBlur = isActive ? 8 : 0;
        ctx.strokeRect(statusX, boxY, boxWidth, boxHeight);
        
        // Status label
        ctx.font = "8px 'Orbitron', monospace";
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 1;
        ctx.fillText(status.label, statusX + boxWidth/2, boxY + 6);
        
        // Status value with enhanced styling
        ctx.font = "bold 14px 'Orbitron', monospace";
        ctx.fillStyle = status.color;
        ctx.shadowColor = isActive ? status.color : 'transparent';
        ctx.shadowBlur = isActive ? 6 : 0;
        ctx.fillText(status.value, statusX + boxWidth/2, boxY + 20);
        
        // Active indicator pulse
        if (isActive) {
            const activePulse = 0.4 + 0.6 * Math.sin(nowTs * 0.006 + i * 1.2);
            ctx.fillStyle = `${status.color}${Math.round(activePulse * 128).toString(16).padStart(2, '0')}`;
            ctx.beginPath();
            ctx.arc(statusX + boxWidth - 8, boxY + 8, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        statusX += boxWidth + 6;
    }
    
    ctx.restore();

    // === ENHANCED HEALTH DISPLAY ===
    const showHealthBar = (window.CONFIG && window.CONFIG.hud && window.CONFIG.hud.health && window.CONFIG.hud.health.showBottomLeft) !== false;
    if (showHealthBar) {
        const critThresh = 0.25;
        const healthPct = Math.max(0, Math.min(100, Math.round(car.health * 100)));
        const isCritical = car.health <= critThresh;
        
        ctx.save();
        const healthX = 25;
        const healthY = canvas.height - 90;
        
        // Enhanced health frame
        const frameWidth = 160;
        const frameHeight = 65;
        
        // Frame background with sophisticated gradient
        const healthFrameGradient = ctx.createLinearGradient(healthX - 10, healthY - 10, healthX - 10, healthY + frameHeight);
        healthFrameGradient.addColorStop(0, 'rgba(10, 10, 26, 0.95)');
        healthFrameGradient.addColorStop(0.3, 'rgba(22, 33, 62, 0.9)');
        healthFrameGradient.addColorStop(0.7, 'rgba(16, 21, 46, 0.85)');
        healthFrameGradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
        ctx.fillStyle = healthFrameGradient;
        ctx.fillRect(healthX - 10, healthY - 10, frameWidth, frameHeight);
        
        // Frame border with dynamic color
        const healthBorderPulse = isCritical ? 0.8 + 0.2 * Math.sin(nowTs * 0.012) : 0.7;
        ctx.strokeStyle = isCritical ? `rgba(255, 23, 68, ${healthBorderPulse})` : `rgba(0, 229, 255, ${healthBorderPulse})`;
        ctx.lineWidth = isCritical ? 3 : 2;
        ctx.shadowColor = isCritical ? '#FF1744' : '#00E5FF';
        ctx.shadowBlur = isCritical ? 12 : 8;
        ctx.strokeRect(healthX - 10, healthY - 10, frameWidth, frameHeight);
        
        // Corner accents
        ctx.strokeStyle = isCritical ? '#FF1744' : '#00E5FF';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 10;
        const healthCornerSize = 20;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(healthX - 10, healthY - 10 + healthCornerSize);
        ctx.lineTo(healthX - 10, healthY - 10);
        ctx.lineTo(healthX - 10 + healthCornerSize, healthY - 10);
        ctx.stroke();
        
        // Health label with Orbitron font
        ctx.font = "11px 'Orbitron', monospace";
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 3;
        ctx.fillText('HULL INTEGRITY', healthX, healthY);
        
        // Health percentage with enhanced styling
        ctx.font = "bold 28px 'Orbitron', monospace";
        ctx.fillStyle = isCritical ? '#FF1744' : '#FFFFFF';
        ctx.shadowColor = isCritical ? '#FF1744' : '#00E5FF';
        ctx.shadowBlur = isCritical ? 16 : 12;
        ctx.fillText(`${healthPct}%`, healthX, healthY + 18);
        
        // Enhanced health bar with sci-fi styling
        const barWidth = 120;
        const barHeight = 12;
        const barX = healthX;
        const barY = healthY + 43;
        
        // Bar background with inner glow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Bar frame
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Health fill with dynamic gradient
        if (car.health > 0) {
            const healthBarGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            if (isCritical) {
                healthBarGradient.addColorStop(0, '#FF1744');
                healthBarGradient.addColorStop(0.5, '#FF6B35');
                healthBarGradient.addColorStop(1, '#FF1744');
            } else if (car.health <= 0.5) {
                healthBarGradient.addColorStop(0, '#FF6B35');
                healthBarGradient.addColorStop(0.5, '#F1FA8C');
                healthBarGradient.addColorStop(1, '#FF6B35');
            } else {
                healthBarGradient.addColorStop(0, '#50FA7B');
                healthBarGradient.addColorStop(0.5, '#00E5FF');
                healthBarGradient.addColorStop(1, '#50FA7B');
            }
            
            ctx.fillStyle = healthBarGradient;
            ctx.shadowColor = isCritical ? '#FF1744' : '#50FA7B';
            ctx.shadowBlur = 8;
            const fillWidth = (barWidth - 4) * car.health;
            ctx.fillRect(barX + 2, barY + 2, fillWidth, barHeight - 4);
            
            // Health bar segments
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
                const segmentX = barX + (barWidth / 4) * i;
                ctx.beginPath();
                ctx.moveTo(segmentX, barY + 2);
                ctx.lineTo(segmentX, barY + barHeight - 2);
                ctx.stroke();
            }
        }
        
        // Critical health warning
        if (isCritical) {
            const warningPulse = 0.6 + 0.4 * Math.sin(nowTs * 0.010);
            ctx.fillStyle = `rgba(255, 68, 68, ${warningPulse})`;
        }
        
        // Critical health warning
        if (isCritical) {
            const warningPulse = 0.6 + 0.4 * Math.sin(nowTs * 0.010);
            ctx.fillStyle = `rgba(255, 68, 68, ${warningPulse})`;
            ctx.font = "bold 10px 'Orbitron', monospace";
            ctx.textAlign = 'right';
            ctx.shadowColor = '#FF1744';
            ctx.shadowBlur = 8;
            ctx.fillText('⚠ CRITICAL', healthX + frameWidth - 20, healthY + 2);
        }
        
        ctx.restore();
    }

    // === ENHANCED GAME OVER OVERLAY ===
    // Use the extracted GameOverScreen class
    if (window.gameOverScreen) {
        window.gameOverScreen.draw(ctx, canvas, nowTs, finalDurationMs, healsConsumed, gameOver, gameStarted, gamePaused);
    }

    // === ENHANCED PAUSE OVERLAY ===
    if (gamePaused && gameStarted && !gameOver) {
        ctx.save();
        
        // Semi-transparent overlay with gradient
        const pauseOverlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2);
        pauseOverlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        pauseOverlayGradient.addColorStop(0.7, 'rgba(10, 10, 26, 0.8)');
        pauseOverlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        ctx.fillStyle = pauseOverlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Animated grid pattern
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
        ctx.lineWidth = 1;
        const pauseGridSize = 40;
        const pauseOffset = (nowTs * 0.005) % pauseGridSize;
        
        for (let x = -pauseOffset; x < canvas.width + pauseGridSize; x += pauseGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = -pauseOffset; y < canvas.height + pauseGridSize; y += pauseGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Pause panel
        const pausePanelW = Math.min(420, canvas.width - 60);
        const pausePanelH = 180;
        const pausePanelX = (canvas.width - pausePanelW) / 2;
        const pausePanelY = (canvas.height - pausePanelH) / 2;
        
        // Panel background
        const pausePanelGradient = ctx.createLinearGradient(pausePanelX, pausePanelY, pausePanelX, pausePanelY + pausePanelH);
        pausePanelGradient.addColorStop(0, 'rgba(10, 10, 26, 0.96)');
        pausePanelGradient.addColorStop(0.3, 'rgba(22, 33, 62, 0.93)');
        pausePanelGradient.addColorStop(0.7, 'rgba(16, 21, 46, 0.90)');
        pausePanelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
        ctx.fillStyle = pausePanelGradient;
        ctx.fillRect(pausePanelX, pausePanelY, pausePanelW, pausePanelH);
        
        // Panel border
        const pauseBorderPulse = 0.7 + 0.3 * Math.sin(nowTs * 0.004);
        ctx.strokeStyle = `rgba(0, 229, 255, ${pauseBorderPulse})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.strokeRect(pausePanelX, pausePanelY, pausePanelW, pausePanelH);
        
        // Enhanced pause icon
        const iconSize = 30;
        const iconX = canvas.width / 2 - iconSize / 2;
        const iconY = pausePanelY + 45;
        const barWidth = 8;
        const barHeight = iconSize;
        const barGap = 8;
        
        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.fillRect(iconX - barGap / 2 - barWidth, iconY, barWidth, barHeight);
        ctx.fillRect(iconX + barGap / 2, iconY, barWidth, barHeight);
        
        // "PAUSED" text with enhanced styling
        const pauseTextPulse = 0.9 + 0.1 * Math.sin(nowTs * 0.006);
        ctx.fillStyle = `rgba(255, 255, 255, ${pauseTextPulse})`;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 16;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 32px 'Orbitron', monospace";
        ctx.fillText('PAUSED', canvas.width / 2, pausePanelY + 105);
        
        // Mission status
        ctx.font = "12px 'Exo 2', sans-serif";
        ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 4;
        ctx.fillText('MISSION SUSPENDED', canvas.width / 2, pausePanelY + 130);
        
        // Instruction text
        const pauseInstructionPulse = 0.7 + 0.3 * Math.sin(nowTs * 0.005);
        ctx.font = "14px 'Exo 2', sans-serif";
        ctx.fillStyle = `rgba(255, 255, 255, ${pauseInstructionPulse})`;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 4;
        ctx.fillText('Press SPACEBAR to resume mission', canvas.width / 2, pausePanelY + 150);
        
        // Exit instruction
        ctx.font = "12px 'Exo 2', sans-serif";
        ctx.fillStyle = `rgba(255, 255, 255, ${pauseInstructionPulse * 0.8})`;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 3;
        ctx.fillText('Press ESC to exit to main menu', canvas.width / 2, pausePanelY + 165);
        
        ctx.restore();
    }

    // === ENHANCED START HINT ===
    if (!gameStarted && !gameOver) {
        ctx.save();
        const hintY = canvas.height - 60;
        const hintPulse = 0.7 + 0.3 * Math.sin(nowTs * 0.004);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "16px 'Orbitron', monospace";
        ctx.fillStyle = `rgba(0, 229, 255, ${hintPulse})`;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 8;
        ctx.fillText('Press SPACEBAR to begin mission', canvas.width / 2, hintY);
        
        // Subtitle
        ctx.font = "12px 'Exo 2', sans-serif";
        ctx.fillStyle = `rgba(255, 255, 255, ${hintPulse * 0.8})`;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 4;
        ctx.fillText('Systems armed and ready', canvas.width / 2, hintY + 20);
        
        ctx.restore();
    }
}

function startExplosion(x, y) {
    explosion = createExplosion(x, y);
}

function lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) {
        const dist2 = (cx - x1) ** 2 + (cy - y1) ** 2;
        return dist2 <= r * r;
    }
    let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const dist2 = (cx - px) ** 2 + (cy - py) ** 2;
    return dist2 <= r * r;
}

function computeCometPathThroughAsteroid(width, height) {
    const rocks = enemies.filter(e => e.isDark);
    if (!rocks.length) return null;
    const margin = 60;
    const edges = [
        { x: margin + Math.random() * (width - margin * 2), y: margin },
        { x: margin + Math.random() * (width - margin * 2), y: height - margin },
        { x: margin, y: margin + Math.random() * (height - margin * 2) },
        { x: width - margin, y: margin + Math.random() * (height - margin * 2) }
    ];
    for (let attempt = 0; attempt < 10; attempt++) {
        const start = edges[Math.floor(Math.random() * edges.length)];
        let end = edges[Math.floor(Math.random() * edges.length)];
        let guard = 0;
        while (guard++ < 5 && Math.hypot(end.x - start.x, end.y - start.y) < Math.min(width, height) * 0.6) {
            end = edges[Math.floor(Math.random() * edges.length)];
        }
        for (const r of rocks) {
            if (lineCircleIntersect(start.x, start.y, end.x, end.y, r.posX, r.posY, (r.radius || 12) + 6)) {
                return { start, end };
            }
        }
    }
    return null;
}

function applyShockwave(x, y, radius, strength) {
    for (const e of enemies) {
        if (!e.isDark) continue;
        const dx = e.posX - x;
        const dy = e.posY - y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0 || dist > radius) continue;
        const falloff = 1 - dist / radius;
        const push = strength * falloff;
        const nx = dx / dist;
        const ny = dy / dist;
        e.vx = (e.vx || 0) + nx * push;
        e.vy = (e.vy || 0) + ny * push;
    }
}

function applySpeedScaling() {
    const cfg = (window.CONFIG && window.CONFIG.speed) || {};
    const base = cfg.base != null ? cfg.base : 25;
    const perHeal = cfg.perHeal != null ? cfg.perHeal : 0.3;
    const cap = cfg.cap != null ? cfg.cap : 35;
    const newBase = Math.min(cap, base + speedBonusHeals * perHeal);
    car.baseMaxSpeed = newBase;
    if ((car.speedBoostTimerMs || 0) <= 0) car.maxSpeed = newBase;
}

function triggerShockwave(x, y, maxRadius) {
    const ring = createShockwave(x, y, maxRadius);
    shockwaves.push(ring);
}

// Add global spacebar handler for start/pause/restart
let spacebarCooldown = 0;
function handleSpacebarPress() {
    const now = performance.now();
    if (now - spacebarCooldown < 200) return; // 200ms cooldown to prevent spam
    spacebarCooldown = now;
    
    if (!gameStarted && !gameOver) {
        // Start game from menu
        startGame();
    } else if (gameStarted && !gameOver) {
        // Toggle pause
        togglePause();
    }
}

function exitToMainMenu() {
    console.log('Exiting to main menu...');
    
    // Clean up game state
    cleanupGame();
    
    // Reset all game variables for a fresh start
    gameStarted = false;
    gameOver = false;
    gamePaused = false;
    totalPausedTime = 0;
    gameStartTs = 0;
    pausedTs = 0;
    
    // Sync global state after changes
    syncGlobalGameState();
    
    // Reset timing variables
    lastSpawn = 0;
    lastFrameTs = 0;
    
    // Reset game statistics
    healsConsumed = 0;
    speedBonusHeals = 0;
    worldDistance = 0;
    finalDurationMs = 0;
    lastCometHealTrigger = 0;
    
    // Reset cooldown timers
    centerHealCooldownUntil = 0;
    nextShieldWindowAt = 0;
    lastNovaBombSpawn = 0;
    lastDronePickupSpawn = 0;
    nextCometAt = 0;
    
    // Reset visual effects
    shakeTimeMs = 0;
    hurtFlashMs = 0;
    hitStopFrames = 0;
    hitStopTimeScale = 1.0;
    
    // Reset car to initial state
    if (car) {
        car.posX = carConfig.pos.x;
        car.posY = carConfig.pos.y;
        car.velocityX = 0;
        car.velocityY = 0;
        car.health = car.maxHealth;
        car.hitCount = 0;
        car.invincibleHitsRemaining = 0;
        car.speedBoostTimerMs = 0;
        car.magnetTimerMs = 0;
        car.maxSpeed = car.baseMaxSpeed;
        car.lastMovementTime = performance.now();
        car.idleDecayMultiplier = 1.0;
        car.isCurrentlyIdle = false;
    }
    
    // Reset camera position
    if (canvas) {
        canvas.cameraX = 0;
        canvas.cameraY = 0;
    }
    
    // Show main menu
    if (menuEl) {
        menuEl.style.display = 'flex';
    }
    
    console.log('Returned to main menu - all game state reset');
}

function startGame() {
    console.log('Starting new game...');
    
    // STEP 1: COMPLETE CLEANUP FIRST
    cleanupGame();
    
    // STEP 2: CLEAR AND RESET SCREEN COMPLETELY
    // Cancel any existing animation frames
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Clear canvas completely and fill with game background
    canvas.clear();
    const ctx = canvas.getContext();
    ctx.fillStyle = '#0F1020';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset canvas camera position
    canvas.cameraX = 0;
    canvas.cameraY = 0;
    
    // Force complete background redraw (stars, nebula, etc.)
    canvas.draw();
    
    // STEP 3: RESET ALL GAME STATE VARIABLES
    gameOver = false;
    gameStarted = true;
    gamePaused = false;
    gameStartTs = performance.now();
    totalPausedTime = 0;
    pausedTs = 0;
    finalDurationMs = 0;
    
    // Reset timing variables
    lastSpawn = 0;
    lastFrameTs = 0;
    
    // Reset game statistics
    healsConsumed = 0;
    speedBonusHeals = 0;
    worldDistance = 0;
    lastCometHealTrigger = 0;
    
    // Reset cooldown timers
    centerHealCooldownUntil = 0;
    nextShieldWindowAt = 0;
    lastNovaBombSpawn = 0;
    lastDronePickupSpawn = 0;
    nextCometAt = 0;
    
    // Reset visual effects
    shakeTimeMs = 0;
    hurtFlashMs = 0;
    hitStopFrames = 0;
    hitStopTimeScale = 1.0;
    
    // STEP 4: CLEAR ALL GAME ARRAYS COMPLETELY
    enemies.length = 0;
    floatingTexts.length = 0;
    shockwaves.length = 0;
    sideDrones.length = 0;
    droneProjectiles.length = 0;
    
    // Reset all pickups/objects
    centerHeal = null;
    comet = null;
    explosion = null;
    shieldPickup = null;
    novaBomb = null;
    dronePickup = null;
    
    // STEP 5: RESET PLAYER TO INITIAL STATE
    if (car) {
        // Reset position to starting location
        car.posX = carConfig.pos.x;
        car.posY = carConfig.pos.y;
        
        // Reset physics
        car.velocityX = 0;
        car.velocityY = 0;
        car.rotation = 0;
        car.targetRotation = 0;
        
        // Reset health and status
        car.health = car.maxHealth;
        car.hitCount = 0;
        car.invincibleHitsRemaining = 0;
        
        // Reset power-ups
        car.speedBoostTimerMs = 0;
        car.magnetTimerMs = 0;
        car.maxSpeed = car.baseMaxSpeed;
        
        // Reset idle system
        car.lastMovementTime = performance.now();
        car.idleDecayMultiplier = 1.0;
        car.isCurrentlyIdle = false;
        
        // Reset any visual feedback
        car.feedbackTimer = 0;
        if (car.damageDecals) car.damageDecals.length = 0;
        
        // CRITICAL: Reinitialize controls after cleanup
        car.setControls();
    }
    
    // STEP 6: SYNC GLOBAL STATE
    syncGlobalGameState();
    
    // STEP 7: HIDE MENU
    if (menuEl) menuEl.style.display = 'none';
    
    // STEP 8: PRIME AUDIO SYSTEM
    [cometSound, explosionSound, zapSound, finalSound, pickSound, powerupSound].forEach(audio => {
        try { 
            audio.currentTime = 0;
            audio.play().then(() => { 
                audio.pause(); 
                audio.currentTime = 0; 
            }).catch(() => {}); 
        } catch (e) {}
    });
    
    // STEP 9: START FRESH GAME LOOP
    console.log('Screen cleared, everything reset - starting fresh game');
    animationFrameId = requestAnimationFrame(run);
}

function togglePause() {
    if (gamePaused) {
        // Resume game
        gamePaused = false;
        const pauseDuration = performance.now() - pausedTs;
        totalPausedTime += pauseDuration;
        console.log('Game resumed via spacebar');
    } else {
        // Pause game
        gamePaused = true;
        pausedTs = performance.now();
        console.log('Game paused via spacebar');
    }
    
    // Sync global state after changes
    syncGlobalGameState();
}

// Add global keydown listener for spacebar and ESC
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent page scroll
        handleSpacebarPress();
    } else if (e.code === 'Escape' || e.key === 'Escape') {
        e.preventDefault();
        // Exit to main menu if paused or game over
        if ((gameStarted && gamePaused) || gameOver) {
            exitToMainMenu();
        }
    }
});

animationFrameId = requestAnimationFrame(run);