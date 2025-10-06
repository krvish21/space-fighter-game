// Global game configuration
window.CONFIG = {
    player: {
        size: { w: 52, h: 26 },
        speedBoost: {
            durationMs: 3500, // boost duration in milliseconds
            amountFactor: 0.5, // fraction of base speed added at reference size
            sizeReference: { w: 52, h: 26 }, // reference ship size for scaling
            useDiagonal: true // scale by diagonal (true) or area (false)
        },
    },
    parallax: {
        factor: 0.5, // background movement relative to ship movement
    },
    nebula: {
        layers: [
            { color: 'hsla(210, 70%, 60%, 0.28)', parallax: 0.2, blobCount: 10, drift: { x: -0.02, y: 0.00 }, scale: [120, 240] },
            { color: 'hsla(280, 65%, 70%, 0.22)', parallax: 0.35, blobCount: 18, drift: { x: 0.015, y: 0.00 }, scale: [90, 200] },
            { color: 'hsla(160, 60%, 55%, 0.18)', parallax: 0.5, blobCount: 20, drift: { x: 0.0, y: -0.012 }, scale: [70, 160] },
        ],
        wrap: true,
        enabled: true,
        globalAlpha: 0.8 // overall nebula opacity
    },
    spawn: {
        intervalMs: 800, // base spawn interval
        burstMin: 1,
        burstMax: 3,
        // Off-screen removal margin (pixels). Enemies farther than this margin beyond the screen
        // will be culled. Increase to allow slower-moving enemies to enter view.
        removeMarginPx: 80,
        // Difficulty-specific overrides
        difficulty: {
            easy: {
                intervalMs: 1400, // slower spawning
                burstMin: 1,
                burstMax: 2, // smaller bursts
                asteroidChance: 0.75, // less asteroids
                homingMineChance: 0.03, // fewer homing mines
                speedBoostChance: 0.15, // more speed boosts
                healChance: 0.12, // more heals
                magnetChance: 0.10, // more magnets
                enemySpeedMultiplier: 0.8 // slower enemies
            },
            normal: {
                intervalMs: 800, // default
                burstMin: 1,
                burstMax: 3,
                asteroidChance: 0.85, // balanced asteroids
                homingMineChance: 0.06, // default homing mines
                speedBoostChance: 0.12, // default speed boosts
                healChance: 0.08, // default heals
                magnetChance: 0.08, // default magnets
                enemySpeedMultiplier: 1.0 // normal speed
            },
            hard: {
                intervalMs: 450, // faster spawning
                burstMin: 2,
                burstMax: 4, // larger bursts
                asteroidChance: 0.92, // more asteroids
                homingMineChance: 0.08, // more homing mines
                speedBoostChance: 0.08, // fewer speed boosts
                healChance: 0.05, // fewer heals
                magnetChance: 0.05, // fewer magnets
                enemySpeedMultiplier: 1.3 // faster enemies
            }
        }
    },
    comet: {
        windowChance: 0.01, // chance when window opens
        windowDelayRange: [5000, 15000], // ms
        healTriggerEvery: 5, // also triggered every N heals
        speed: {
            min: 15, // minimum comet speed (increased from ~9)
            max: 25, // maximum comet speed (increased from ~15)
            base: 20 // base speed before randomization (increased from ~9)
        }
    },
    moon: {
        spawnChance: 0.003, // per-frame when eligible
        cooldownMsRange: [10000, 20000],
    },
    fx: {
        shockwaveRadius: 200,
        shockwaveStrength: 8,
        hurtFlashMaxAlpha: 0.35,
        shakeIntensityPx: 6,
        shakeDurationMs: 250,
        hurtFlashDurationMs: 180,
    },
    hud: {
        fontSizePx: 14,
        neonColor: '#00E5FF',
        health: {
            showBottomLeft: false,
            normalColor: '#80FFEA',
            criticalColor: '#FF5252',
            criticalThreshold: 0.25
        },
        cooldownPips: {
            enabled: true,
            size: 28, // radius of each pip
            spacing: 40, // distance between pips
            offsetX: 20, // distance from right edge
            offsetY: 60, // distance from top edge
            strokeWidth: 3,
            backgroundColor: 'rgba(0,0,0,0.4)',
            activeColor: '#00E5FF',
            inactiveColor: '#404040'
        },
        floatingText: {
            enabled: true,
            fontSize: 16,
            duration: 1200, // ms
            riseSpeed: 0.5, // pixels per frame
            fadeStart: 0.7, // when to start fading (0-1)
            colors: {
                heal: '#69F0AE',
                damage: '#FF5252',
                pickup: '#FFD54F',
                boost: '#FF69B4',
                shield: '#8BE9FD',
                magnet: '#00E676',
                nova: '#FFD700'
            }
        },
        hitStop: {
            enabled: true,
            duration: 8, // frames
            timeScale: 0.1, // slow motion factor (0.1 = 10% speed)
            triggerOnDamage: true,
            triggerOnPickup: false,
            triggerOnExplosion: true
        }
    },
    speed: {
        base: 15, // matches current ship base maxSpeed
        perHeal: 0.3,
        cap: 35,
    },
    idleDecay: {
        baseDecayPerFrame: 0.0001, // normal decay rate when active
        idleThresholdMs: 3000, // time before idle decay kicks in (3 seconds)
        idleDecayMultiplier: 2.0, // multiplier for decay rate when idle
        escalationRate: 1.2, // how much decay increases over time (20% per second)
        maxDecayMultiplier: 10.0, // maximum decay multiplier when fully idle
        movementThreshold: 0.05 // minimum velocity to be considered "moving"
    },
    shield: {
        spawnIntervalMs: 12000, // base interval between shield spawn windows
        windowChance: 0.22, // chance to spawn when window opens
        lifetimeMs: 9000, // pickup exists this long if not collected
        maxHits: 3, // collisions absorbed while active
        pickupSound: './assets/sounds/power_up.mp3' // reuse or replace with dedicated sfx
    },
    magnet: {
        spawnChance: 0.08, // portion of non-dark spawns to be magnet pickups
        durationMs: 6000,
        radius: 220,
        strength: 0.35 // pull per frame
    },
    homingMine: {
        spawnChance: 0.06, // portion of enemy spawns to be homing mines
        baseSpeed: 0.8, // slower than regular asteroids
        steerStrength: 0.5, // how aggressively they turn toward player
        maxSteerSpeed: 1.5, // maximum speed when homing
        detectionRadius: 250, // distance at which they start homing
        blastRadius: 80, // distance at which they explode and damage player
        size: 16, // consistent size for mines
        pulseSpeed: 0.15 // animation speed for pulsing effect
    },
    novaBomb: {
        crowdThreshold: 40, // minimum enemy count to trigger nova bomb spawning
        spawnChance: 0.15, // chance per frame when crowded (higher chance than other pickups)
        cooldownMs: 30000, // minimum time between nova bomb spawns (30 seconds)
        size: 22, // larger than other pickups for visibility
        pulseSpeed: 0.12, // slower pulse for dramatic effect
        explosionRadius: 500, // visual explosion radius
        lifetimeMs: 10000 // pickup exists for 15 seconds if not collected
    },
    damageDecals: {
        enabled: true,
        maxDecals: 6, // maximum decals on ship at once
        fadeRate: 0.15, // how fast decals fade per heal (0-1)
        spawnChance: 0.8, // chance to spawn decal on damage
        baseAlpha: 0.7, // initial decal opacity
        colors: ['#8D4004', '#B71C1C', '#424242'], // scorch mark colors
        sizes: [0.15, 0.25, 0.35] // relative to ship size
    },
    directionalLight: {
        enabled: true,
        intensity: 0.6, // rim light strength
        baseColor: '#FFFFFF',
        boostColor: '#FFD54F', // color when speed boosting
        minimumSpeed: 2.0, // minimum speed to show directional light
        falloffDistance: 20, // distance for light falloff
        rimWidth: 8 // width of rim light effect
    },
    drones: {
        enabled: true,
        maxDrones: 2, // maximum number of drones
        spawnChance: 0.005, // extremely low chance to spawn drone pickup (was 0.12)
        spawnCooldownMs: 60000, // much longer cooldown - 60 seconds (was 15000)
        lifetimeMs: 25000, // how long each drone lasts (25 seconds)
        orbitRadius: 80, // distance from player
        orbitSpeed: 0.02, // orbital angular velocity
        fireRange: 150, // max distance to auto-target enemies
        fireRate: 800, // milliseconds between shots
        projectileSpeed: 8, // speed of drone projectiles
        projectileLifetime: 2000, // projectile lifetime in ms
        homingStrength: 0.8, // homing accuracy (0.8 = very strong tracking)
        speedBoostRange: 30, // distance at which projectiles get speed boost for guaranteed hit
        size: 12, // drone visual size
        color: '#00E676', // drone body color
        glowColor: '#4CAF50' // drone glow color
    },
};


