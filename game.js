/* =========================================================
   VOID — GAME.JS
   Phase 4 (Three.js renderer, dash, pickups, combo, menus)
========================================================= */


/* =========================================================
   CANVAS
========================================================= */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();


/* =========================================================
   GAME CONFIG
========================================================= */

const MAX_ROOMS = 15;

/*
    Total number of enemies that must
    spawn and be defeated to clear each room.
*/
const ROOM_ENEMIES = [
    30,
    63,
    70,
    77,
    87,
    97,
    110,
    125,
    145,
    170,
    200,
    230,
    260,
    290,
    320
];

const ENEMY_TYPES = {

    /* =====================================================
       CRAWLER
    ===================================================== */

    crawler: {
        name: "CRAWLER",
        color: "#ff5577",
        radius: 15,

        health: depth =>
            (45 + depth * 12) * 3,

        speed: depth =>
            70 + depth * 8,

        damage: depth =>
            15 + depth * 2,

        ability: "NONE"
    },


    /* =====================================================
       SPLITTER
    ===================================================== */

    splitter: {
        name: "SPLITTER",
        color: "#ff8a3d",
        radius: 45,

        health: depth =>
            (260 + depth * 28) * 3,

        speed: depth =>
            48 + depth * 4,

        damage: depth =>
            25 + depth * 2,

        ability: "SPLITS INTO 5 CRAWLERS"
    },


    /* =====================================================
       GUNNER
    ===================================================== */

    gunner: {
        name: "GUNNER",
        color: "#b8ff3d",
        radius: 22.5,

        health: depth =>
            (180 + depth * 20) * 3,

        speed: depth =>
            52 + depth * 5,

        damage: depth =>
            20 + depth * 2,

        ability: "MOUNTED BARREL"
    },


    /* =====================================================
       VOIDLING
    ===================================================== */

    voidling: {
        name: "VOIDLING",
        color: "#a855f7",
        radius: 37.5,

        health: depth =>
            (360 + depth * 35) * 3,

        speed: depth =>
            42 + depth * 4,

        damage: depth =>
            28 + depth * 2,

        ability: "VOID RING + TURRET"
    },


    /* =====================================================
       STALKER
    ===================================================== */

    stalker: {
        name: "STALKER",
        color: "#ffe44d",
        radius: 30,

        health: depth =>
            (250 + depth * 25) * 3,

        speed: depth =>
            (70 + depth * 8) * 2,

        damage: depth =>
            22 + depth * 2,

        ability: "2× CRAWLER SPEED"
    },


    /* =====================================================
       VOID TITAN
    ===================================================== */

    boss: {
        name: "VOID TITAN",
        color: "#e8f4ff",
        radius: 90,

        health: depth =>
            6500 * 3,

        speed: depth =>
            34,

        damage: depth =>
            45,

        ability: "VOID RING + 8 TURRETS"
    },


    /* =====================================================
       [SHINY] CRAWLER
    ===================================================== */

    shinyCrawler: {
        name: "[SHINY] CRAWLER",
        color: "#ff5577",
        radius: 15 * 2,

        health: depth =>
            ENEMY_TYPES.crawler.health(depth) * 3,

        speed: depth =>
            70 + depth * 8,

        damage: depth =>
            15 + depth * 2,

        ability: "SPLITS INTO 7 CRAWLERS"
    },


    /* =====================================================
       [SHINY] SPLITTER
    ===================================================== */

    shinySplitter: {
        name: "[SHINY] SPLITTER",
        color: "#ff8a3d",
        radius: 45 * 2,

        health: depth =>
            ENEMY_TYPES.splitter.health(depth) * 3,

        speed: depth =>
            48 + depth * 4,

        damage: depth =>
            25 + depth * 2,

        ability: "SPLITS INTO 3 SPLITTERS"
    },


    /* =====================================================
       HALO
    ===================================================== */

    halo: {
        name: "HALO",
        color: "#72d7ff",
        radius: 15 * 5,

        health: depth =>
            ENEMY_TYPES.crawler.health(depth) * 15,

        speed: depth =>
            40 + depth * 3,

        damage: depth =>
            30 + depth * 2,

        ability: "3-SHOT TURRET + VOID RING"
    },


    /* =====================================================
       [SHINY] GUNNER
    ===================================================== */

    shinyGunner: {
        name: "[SHINY] GUNNER",
        color: "#b8ff3d",
        radius: 22.5 * 2.5,

        health: depth =>
            ENEMY_TYPES.gunner.health(depth) * 3,

        speed: depth =>
            52 + depth * 5,

        damage: depth =>
            20 + depth * 2,

        ability: "5-SHOT TURRET + SPLITS INTO 3 GUNNERS"
    }

};

/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;
let gameOver = false;
let transitioning = false;

let lastTime = 0;

let depth = 1;
let scrap = 0;
let kills = 0;

let roomEnemiesRequired = 0;
let roomKills = 0;
let roomSpawned = 0;
let spawnTimer = 0;

/* =========================================================
   INPUT
========================================================= */

const keys = {};

let mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    down: false
};

window.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;

    if (e.key.toLowerCase() === "r" && gameOver) {
        startGame();
    }
});

window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("mousemove", e => {

    mouse.x = e.clientX;
    mouse.y = e.clientY;

    crosshair.style.left = `${e.clientX}px`;
    crosshair.style.top = `${e.clientY}px`;

});

window.addEventListener("mousedown", e => {
    if (e.button === 0) {
        mouse.down = true;
    }
});

window.addEventListener("mouseup", e => {
    if (e.button === 0) {
        mouse.down = false;
    }
});


/* =========================================================
   PLAYER
========================================================= */

/* base time between shots (was 0.16s, which melted enemies) */
const BASE_FIRE_RATE = 0.30;

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,

    radius: 16,

    speed: 270,

    maxHealth: 100,
    health: 100,

    damage: 25,
    fireRate: BASE_FIRE_RATE,
    bulletSpeed: 720,

    multishot: 1,

    angle: 0,

    shootCooldown: 0
};


/* =========================================================
   VOID RING
========================================================= */

const voidRing = {
    enabled: false,

    radius: 90,
    damage: 10,

    cooldown: 0,
    hitCooldown: 0.35
};

/* =========================================================
   EXPLOSIVE BULLETS
========================================================= */

const explosiveBullets = {

    enabled: false,

    damage: 50,

    radius: 45,

    damageRadiusIncrease: 12,

    damageIncrease: 25

};


/* =========================================================
   UPGRADES
========================================================= */

const upgrades = {

    health: {
        name: "CORE",
        description: "+20% maximum health",
        baseCost: 15,
        tier: 0
    },

    speed: {
        name: "THRUST",
        description: "+10% movement speed",
        baseCost: 15,
        tier: 0
    },

    damage: {
        name: "WEAPON",
        description: "+15% weapon damage",
        baseCost: 20,
        tier: 0
    },

    fireRate: {
        name: "OVERDRIVE",
        description: "10% faster firing",
        baseCost: 25,
        tier: 0
    },

    bulletSpeed: {
        name: "VELOCITY",
        description: "+15% projectile speed",
        baseCost: 20,
        tier: 0
    },

    multishot: {
        name: "SPLIT ROUND",
        description: "+1 projectile",
        baseCost: 40,
        tier: 0
    },

    explosive: {
       name: "EXPLOSIVE BULLETS",
       description: "Bullets explode on impact",
       baseCost: 45,
       tier: 0
    },

    voidRing: {
        name: "VOID RING",
        description: "Creates a damaging ring around you",
        baseCost: 35,
        tier: 0
    },

    regen: {
        name: "NANO REPAIR",
        description: "+1.5 HP per second after 3s without damage",
        baseCost: 30,
        tier: 0
    },

    dashCore: {
        name: "DASH CORE",
        description: "-15% dash cooldown",
        baseCost: 25,
        tier: 0
    }
};


/* =========================================================
   ENTITIES
========================================================= */

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];


/* =========================================================
   PHASE 4 — SETTINGS, SAVE DATA, DASH, PICKUPS, COMBO, PAUSE
========================================================= */

const SAVE_KEY = "void-save-v1";
const SETTINGS_KEY = "void-settings-v1";

const settings = {
    bloom: true,
    shake: true,
    numbers: true,
    use3d: true,
    lowQuality: false,
    sfx: true,
    music: true
};

const save = {
    bestScore: 0,
    deepest: 0,
    totalKills: 0
};

function readStored(key, target) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            Object.assign(target, JSON.parse(raw));
        }
    } catch (error) {
        /* storage unavailable: defaults are fine */
    }
}

function writeStored(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        /* storage unavailable: ignore */
    }
}

readStored(SETTINGS_KEY, settings);
readStored(SAVE_KEY, save);


/* ---------- run state ---------- */

let paused = false;
let score = 0;
let combo = 0;
let comboTimer = 0;
let bestCombo = 0;

let hitFlash = 0;
let shakePower = 0;
let shakeX = 0;
let shakeY = 0;

let dashQueued = false;

let shieldPoints = 0;
let shieldTime = 0;
let rapidTime = 0;

let pickups = [];
let effects = [];
let floatTexts = [];

const COMBO_WINDOW = 3;
const DASH_SPEED = 950;
const DASH_TIME = 0.17;

const SCORE_VALUE = {
    crawler: 10,
    splitter: 40,
    gunner: 30,
    voidling: 60,
    stalker: 35,
    boss: 1000,
    shinyCrawler: 80,
    shinySplitter: 200,
    halo: 300,
    shinyGunner: 250
};

const PICKUP_TYPES = {
    health: { label: "REPAIR", color: "#5dff9a" },
    rapid: { label: "OVERCLOCK", color: "#ffd24a" },
    shield: { label: "SHIELD", color: "#72d7ff" },
    pulse: { label: "PULSE", color: "#c07bff" }
};

/* extra player fields */
player.dashTime = 0;
player.dashCooldown = 0;
player.dashMaxCooldown = 1.6;
player.dashDirX = 1;
player.dashDirY = 0;
player.invuln = 0;
player.regen = 0;
player.regenDelay = 0;
player.dead = false;

function resetPhase4() {
    paused = false;
    score = 0;
    combo = 0;
    comboTimer = 0;
    bestCombo = 0;
    hitFlash = 0;
    shakePower = 0;
    shakeX = 0;
    shakeY = 0;
    dashQueued = false;
    shieldPoints = 0;
    shieldTime = 0;
    rapidTime = 0;
    pickups = [];
    effects = [];
    floatTexts = [];
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.dashMaxCooldown = 1.6;
    player.invuln = 0;
    player.regen = 0;
    player.regenDelay = 0;
    player.dead = false;
}


/* ---------- screen shake ---------- */

function addShake(amount) {
    if (!settings.shake) {
        return;
    }
    shakePower = Math.min(26, Math.max(shakePower, amount));
}

function updateShake(dt) {
    if (shakePower > 0.1) {
        shakeX = (Math.random() - 0.5) * 2 * shakePower;
        shakeY = (Math.random() - 0.5) * 2 * shakePower;
        shakePower *= Math.pow(0.002, dt);
    } else {
        shakePower = 0;
        shakeX = 0;
        shakeY = 0;
    }

    hitFlash = Math.max(0, hitFlash - dt * 2.4);
}


/* ---------- visual effects (rings + floating text) ---------- */

function addEffect(x, y, radius, color, life = 0.55) {
    if (effects.length > 60) {
        effects.shift();
    }
    effects.push({ x, y, radius, color, life, maxLife: life });
}

function addFloatText(x, y, text, color = "#ffffff", size = 1) {
    if (!settings.numbers && size < 1.3) {
        return;
    }
    if (floatTexts.length > 45) {
        floatTexts.shift();
    }
    floatTexts.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        text,
        color,
        size,
        life: 0.8,
        maxLife: 0.8
    });
}

function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].life -= dt;
        if (effects[i].life <= 0) {
            effects.splice(i, 1);
        }
    }

    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const t = floatTexts[i];
        t.life -= dt;
        t.y -= 38 * dt;
        if (t.life <= 0) {
            floatTexts.splice(i, 1);
        }
    }
}


/* ---------- damage to the player ---------- */

function damagePlayer(amount, continuous = false) {
    if (gameOver || amount <= 0) {
        return;
    }

    /* dashing grants brief invulnerability */
    if (player.invuln > 0 || player.dashTime > 0) {
        return;
    }

    if (shieldPoints > 0) {
        const absorbed = Math.min(shieldPoints, amount);
        shieldPoints -= absorbed;
        amount -= absorbed;
        if (shieldPoints <= 0) {
            shieldTime = 0;
            addEffect(player.x, player.y, 70, "#72d7ff", 0.4);
        }
        if (amount <= 0) {
            return;
        }
    }

    player.health -= amount;
    player.regenDelay = 3;
    if (window.VoidAudio) VoidAudio.play("hurt");

    if (continuous) {
        hitFlash = Math.min(1, hitFlash + amount * 0.5);
        addShake(3);
    } else {
        hitFlash = Math.min(1, hitFlash + 0.35 + amount / 40);
        addShake(6 + amount * 0.5);
    }
}


/* ---------- dash ---------- */

function tryDash(moveX, moveY) {
    if (
        player.dashCooldown > 0 ||
        player.dashTime > 0
    ) {
        return;
    }

    let dirX = moveX;
    let dirY = moveY;

    if (dirX === 0 && dirY === 0) {
        dirX = Math.cos(player.angle);
        dirY = Math.sin(player.angle);
    }

    player.dashDirX = dirX;
    player.dashDirY = dirY;
    player.dashTime = DASH_TIME;
    player.invuln = DASH_TIME + 0.12;
    player.dashCooldown = player.dashMaxCooldown;

    addEffect(player.x, player.y, 60, "#72d7ff", 0.35);
    addShake(2);
    if (window.VoidAudio) VoidAudio.play("dash");
}

function spawnDashTrail() {
    particles.push({
        x: player.x + (Math.random() - 0.5) * 8,
        y: player.y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.3,
        maxLife: 0.3,
        size: 3.2,
        color: "#72d7ff"
    });
}


/* ---------- combo + score ---------- */

function getComboMultiplier() {
    return 1 + Math.min(4, Math.floor(combo / 5) * 0.5);
}

function updateCombo(dt) {
    if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
            combo = 0;
        }
    }
}


/* ---------- pickups ---------- */

function pickDropType() {
    const lowHealth = player.health < player.maxHealth * 0.9;
    const weights = {
        health: lowHealth ? 40 : 10,
        rapid: 25,
        shield: 20,
        pulse: 15
    };

    let total = 0;
    for (const key in weights) {
        total += weights[key];
    }

    let roll = Math.random() * total;
    for (const key in weights) {
        roll -= weights[key];
        if (roll <= 0) {
            return key;
        }
    }

    return "health";
}

function spawnPickup(x, y, type) {
    pickups.push({
        x,
        y,
        type,
        age: 0,
        life: 14,
        radius: 14
    });
}

function rollDrop(enemy) {
    if (enemy.type === "boss") {
        spawnPickup(enemy.x - 30, enemy.y, "health");
        spawnPickup(enemy.x + 30, enemy.y, "shield");
        return;
    }

    let chance = 0.07;

    if (enemy.type === "splitter") chance = 0.12;
    if (enemy.type === "gunner" || enemy.type === "stalker") chance = 0.10;
    if (enemy.type === "voidling") chance = 0.18;
    if (enemy.type === "halo") chance = 0.4;
    if (enemy.type.startsWith("shiny")) chance = 0.3;

    /* small mercy bonus while badly hurt */
    if (player.health < player.maxHealth * 0.3) {
        chance += 0.05;
    }

    if (Math.random() < chance) {
        spawnPickup(enemy.x, enemy.y, pickDropType());
    }
}

function applyPickup(pickup) {
    const info = PICKUP_TYPES[pickup.type];

    if (pickup.type === "health") {
        player.health = Math.min(
            player.maxHealth,
            player.health + player.maxHealth * 0.25
        );
    }

    if (pickup.type === "rapid") {
        rapidTime = 8;
    }

    if (pickup.type === "shield") {
        shieldPoints = Math.min(80, shieldPoints + 40);
        shieldTime = 12;
    }

    if (pickup.type === "pulse") {
        pulseBlast();
    }

    if (window.VoidAudio) VoidAudio.play("pickup");
    addEffect(player.x, player.y, 60, info.color, 0.45);
    addFloatText(player.x, player.y - 26, info.label, info.color, 1.4);
}

function pulseBlast() {
    const radius = 340;
    if (window.VoidAudio) VoidAudio.play("pulse");

    addEffect(player.x, player.y, radius, "#c07bff", 0.7);
    addEffect(player.x, player.y, radius * 0.6, "#ffffff", 0.45);
    addShake(14);

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (Math.hypot(b.x - player.x, b.y - player.y) < radius) {
            createHitParticles(b.x, b.y, "#c07bff");
            enemyBullets.splice(i, 1);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy) {
            continue;
        }
        const distance = Math.hypot(
            enemy.x - player.x,
            enemy.y - player.y
        );
        if (distance < radius + enemy.radius) {
            enemy.health -= 220 + player.damage * 2;
            createHitParticles(enemy.x, enemy.y, "#c07bff");
            if (enemy.health <= 0 && enemies[i] === enemy) {
                killEnemy(i);
            }
        }
    }
}

function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];
        pickup.age += dt;

        if (pickup.age >= pickup.life) {
            pickups.splice(i, 1);
            continue;
        }

        const dx = player.x - pickup.x;
        const dy = player.y - pickup.y;
        const distance = Math.hypot(dx, dy);

        /* gentle magnet */
        if (distance < 170 && distance > 0) {
            const pull = (1 - distance / 170) * 420 + 60;
            pickup.x += (dx / distance) * pull * dt;
            pickup.y += (dy / distance) * pull * dt;
        }

        if (distance < player.radius + 24) {
            applyPickup(pickup);
            pickups.splice(i, 1);
        }
    }
}


/* ---------- enemy kill hook ---------- */

function onEnemyKilled(enemy) {
    combo++;
    comboTimer = COMBO_WINDOW;
    bestCombo = Math.max(bestCombo, combo);

    const points = Math.round(
        (SCORE_VALUE[enemy.type] || 10) *
        getComboMultiplier()
    );
    score += points;
    save.totalKills++;

    const data = ENEMY_TYPES[enemy.type];
    const big = enemy.radius >= 30;

    addEffect(
        enemy.x,
        enemy.y,
        enemy.radius * (big ? 3.4 : 2.2),
        data.color,
        big ? 0.7 : 0.45
    );
    addShake(big ? 14 : 2.5);

    if (big) {
        addFloatText(enemy.x, enemy.y - 10, `+${points}`, "#ffd24a", 1.4);
    }

    rollDrop(enemy);
}


/* ---------- run records ---------- */

function recordRun() {
    const newBest = score > save.bestScore;

    if (newBest) {
        save.bestScore = score;
    }
    save.deepest = Math.max(save.deepest, depth);
    writeStored(SAVE_KEY, save);

    return newBest;
}

function refreshRecords() {
    const bestScoreEl = document.getElementById("record-score");
    const bestDepthEl = document.getElementById("record-depth");
    const killsEl = document.getElementById("record-kills");

    if (bestScoreEl) bestScoreEl.textContent = save.bestScore.toLocaleString();
    if (bestDepthEl) bestDepthEl.textContent = save.deepest;
    if (killsEl) killsEl.textContent = save.totalKills.toLocaleString();
}

function fillRunSummary(newBest) {
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    set("final-score", score.toLocaleString());
    set("final-depth", String(depth).padStart(2, "0"));
    set("final-scrap", scrap);
    set("final-kills", kills);
    set("final-best", save.bestScore.toLocaleString());

    const badge = document.getElementById("new-best");
    if (badge) {
        badge.classList.toggle("hidden", !newBest || score <= 0);
    }
}


/* =========================================================
   ENEMY PROJECTILES
========================================================= */

function fireEnemyBullet(x, y, angle, speed = 260, damage = 8) {

    enemyBullets.push({

        x,
        y,

        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,

        radius: 5,

        damage

    });

}


function updateEnemyBullets(dt) {

    for (
        let i = enemyBullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet = enemyBullets[i];

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        const dx =
            player.x - bullet.x;

        const dy =
            player.y - bullet.y;

        const distance =
            Math.sqrt(dx * dx + dy * dy);

        if (
            distance <
            player.radius +
            bullet.radius
        ) {

            damagePlayer(bullet.damage);

            createHitParticles(
                bullet.x,
                bullet.y
            );

            enemyBullets.splice(i, 1);

            if (player.health <= 0) {

                player.health = 0;

                finishGame();

                return;
            }

            continue;
        }

        const margin = 150;

        if (
            bullet.x < -margin ||
            bullet.x > canvas.width + margin ||
            bullet.y < -margin ||
            bullet.y > canvas.height + margin
        ) {

            enemyBullets.splice(i, 1);
        }
    }
}

/* =========================================================
   DOM
========================================================= */

const depthText = document.getElementById("depth");
const roomStatus = document.getElementById("room-status");
const scrapText = document.getElementById("scrap");

const enemyCountText = document.getElementById("enemy-count");

const healthFill = document.getElementById("health-fill");
const healthText = document.getElementById("health-text");

const startScreen = document.getElementById("start-screen");
const deathScreen = document.getElementById("death-screen");
const clearScreen = document.getElementById("clear-screen");
const upgradeScreen = document.getElementById("upgrade-screen");

const upgradeScrap = document.getElementById("upgrade-scrap");
const upgradeOptions = document.getElementById("upgrade-options");
const continueButton = document.getElementById("continue-button");

const clearTitle = document.getElementById("clear-title");
const clearMessage = document.getElementById("clear-message");
const crosshair = document.getElementById("crosshair");
crosshair.style.display = "none";

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

/* =========================================================
   BUTTONS & MENUS
========================================================= */

const pauseScreen = document.getElementById("pause-screen");
const victoryActions = document.getElementById("victory-actions");

const scoreText = document.getElementById("score");
const comboBox = document.getElementById("combo");
const comboCount = document.getElementById("combo-count");
const comboFill = document.getElementById("combo-fill");
const dashFill = document.getElementById("dash-fill");
const dashText = document.getElementById("dash-text");
const shieldFill = document.getElementById("shield-fill");
const chipsBox = document.getElementById("powerup-chips");
const progressFill = document.getElementById("progress-fill");

const menuPanels = {
    main: document.getElementById("menu-main"),
    howto: document.getElementById("menu-howto"),
    settings: document.getElementById("menu-settings"),
    docs: document.getElementById("menu-docs")
};
const menuModalBackdrop = document.getElementById("menu-modal-backdrop");
let lastMenuTrigger = null;

document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("button") && !e.target.closest(".upgrade-card")) {
        if (window.VoidAudio) VoidAudio.play("click");
    }
});

function showMenuPanel(name, trigger = null) {
    if (name !== "main" && trigger instanceof HTMLElement) {
        lastMenuTrigger = trigger;
    }

    for (const key in menuPanels) {
        const panel = menuPanels[key];
        const isCurrent = key === name;
        panel.classList.toggle("hidden", !isCurrent);
        if (key !== "main") {
            panel.setAttribute("aria-hidden", String(!isCurrent));
        }
    }

    const isModal = name !== "main";
    menuModalBackdrop.classList.toggle("hidden", !isModal);
    menuModalBackdrop.setAttribute("aria-hidden", String(!isModal));

    if (isModal) {
        menuPanels[name].focus();
    } else if (lastMenuTrigger) {
        lastMenuTrigger.focus();
        lastMenuTrigger = null;
    }
}

function isMenuOpen() {
    return !startScreen.classList.contains("hidden");
}

startButton.addEventListener("click", () => {
    startGame();
});

restartButton.addEventListener("click", () => {
    startGame();
});

document.getElementById("howto-button")
    .addEventListener("click", event => showMenuPanel("howto", event.currentTarget));

document.getElementById("settings-button")
    .addEventListener("click", event => showMenuPanel("settings", event.currentTarget));

document.getElementById("docs-button")
    .addEventListener("click", event => showMenuPanel("docs", event.currentTarget));

menuModalBackdrop.addEventListener("click", () => showMenuPanel("main"));

document.querySelectorAll("[data-doc-tab]").forEach(button => {
    button.addEventListener("click", () => {
        const selected = button.dataset.docTab;
        document.querySelectorAll("[data-doc-tab]").forEach(tab => {
            const active = tab === button;
            tab.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[role=tabpanel]").forEach(panel => {
            const active = panel.id === `docs-${selected}`;
            panel.classList.toggle("hidden", !active);
            panel.setAttribute("aria-hidden", String(!active));
        });
    });
});

// Keep keyboard focus inside an open menu dialog.
document.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const panel = Object.keys(menuPanels)
        .filter(key => key !== "main")
        .map(key => menuPanels[key])
        .find(item => !item.classList.contains("hidden"));
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}, true);

document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => showMenuPanel("main"));
});

document.getElementById("resume-button")
    .addEventListener("click", () => togglePause());

document.getElementById("pause-restart-button")
    .addEventListener("click", () => {
        paused = false;
        startGame();
    });

document.getElementById("pause-menu-button")
    .addEventListener("click", () => goToMenu());

document.getElementById("death-menu-button")
    .addEventListener("click", () => goToMenu());

document.getElementById("victory-menu-button")
    .addEventListener("click", () => goToMenu());

function goToMenu() {
    if (window.VoidAudio) VoidAudio.setMode("menu");
    paused = false;
    gameRunning = false;
    gameOver = false;
    transitioning = false;

    for (const overlay of document.querySelectorAll(".room-transition")) {
        overlay.remove();
    }

    pauseScreen.classList.add("hidden");
    deathScreen.classList.add("hidden");
    clearScreen.classList.add("hidden");
    upgradeScreen.classList.add("hidden");
    victoryActions.classList.add("hidden");

    crosshair.style.display = "none";

    enemies = [];
    bullets = [];
    enemyBullets = [];
    pickups = [];
    effects = [];
    floatTexts = [];

    player.dead = true;

    refreshRecords();
    showMenuPanel("main");
    startScreen.classList.remove("hidden");
}

function togglePause() {
    if (paused) {
        paused = false;
        pauseScreen.classList.add("hidden");
        crosshair.style.display = "block";
        return;
    }

    if (!gameRunning) {
        return;
    }

    paused = true;
    mouse.down = false;
    pauseScreen.classList.remove("hidden");
    crosshair.style.display = "none";
}


/* =========================================================
   EXTRA INPUT: DASH, PAUSE
========================================================= */

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    if ((key === " " || key === "shift") && gameRunning && !paused) {
        dashQueued = true;
        if (key === " ") {
            e.preventDefault();
        }
    }

    if (key === "p" || key === "escape") {
        if (gameRunning || paused) {
            togglePause();
        } else if (isMenuOpen()) {
            showMenuPanel("main");
        }
    }
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
    mouse.down = false;

    if (gameRunning && !paused) {
        togglePause();
    }
});


/* =========================================================
   SETTINGS
========================================================= */

const settingInputs = {
    bloom: "setting-bloom",
    shake: "setting-shake",
    numbers: "setting-numbers",
    use3d: "setting-3d",
    lowQuality: "setting-lowq",
    sfx: "setting-sfx",
    music: "setting-music"
};

function applySettings() {
    if (window.VoidAudio) {
        VoidAudio.setOptions({ sfx: settings.sfx, music: settings.music });
    }
    const renderer = window.VoidRenderer;

    if (renderer && renderer.setOptions) {
        renderer.setOptions({
            bloom: settings.bloom && !settings.lowQuality,
            lowQuality: settings.lowQuality,
            enabled: settings.use3d
        });
    }
}

for (const key in settingInputs) {
    const input = document.getElementById(settingInputs[key]);
    input.checked = settings[key];
    input.addEventListener("change", () => {
        settings[key] = input.checked;
        writeStored(SETTINGS_KEY, settings);
        applySettings();
    });
}

/* the renderer module announces itself once Three.js has loaded (or failed) */
window.addEventListener("voidrenderer", () => {
    const renderer = window.VoidRenderer;
    const input = document.getElementById("setting-3d");

    if (renderer && renderer.failed) {
        input.checked = false;
        input.disabled = true;
        input.closest(".setting").classList.add("disabled");
        input.closest(".setting").querySelector("small").textContent =
            "Three.js could not be loaded. Using the classic 2D view.";
        return;
    }

    applySettings();
});


/* =========================================================
   HUD EXTRAS
========================================================= */

let lastChips = "";

function updateHUDExtras() {
    if (scoreText) {
        scoreText.textContent = score.toLocaleString();
    }

    if (comboBox) {
        if (combo >= 2) {
            comboBox.classList.remove("hidden");
            comboCount.textContent = `x${getComboMultiplier().toFixed(1).replace(".0", "")}`;
            comboBox.querySelector(".combo-label").textContent = `COMBO ${combo}`;
            comboFill.style.width = `${Math.max(0, comboTimer / COMBO_WINDOW) * 100}%`;
        } else {
            comboBox.classList.add("hidden");
        }
    }

    if (dashFill) {
        const ready = player.dashCooldown <= 0;
        const ratio = ready
            ? 1
            : 1 - player.dashCooldown / player.dashMaxCooldown;
        dashFill.style.width = `${ratio * 100}%`;
        dashText.textContent = ready
            ? "READY"
            : `${player.dashCooldown.toFixed(1)}s`;
        dashFill.classList.toggle("ready", ready);
    }

    if (shieldFill) {
        shieldFill.style.width = `${Math.min(100, (shieldPoints / player.maxHealth) * 100)}%`;
    }

    if (progressFill) {
        const total = Math.max(1, roomEnemiesRequired);
        const done = Math.max(0, roomSpawned - enemies.length);
        progressFill.style.width = `${Math.min(100, (done / total) * 100)}%`;
    }

    if (chipsBox) {
        let html = "";
        if (rapidTime > 0) {
            html += `<span class="chip rapid">OVERCLOCK ${Math.ceil(rapidTime)}s</span>`;
        }
        if (shieldPoints > 0) {
            html += `<span class="chip shield">SHIELD ${Math.ceil(shieldPoints)}</span>`;
        }
        if (html !== lastChips) {
            chipsBox.innerHTML = html;
            lastChips = html;
        }
    }
}


/* =========================================================
   ROOM TRANSITION
========================================================= */

const enemyIntroductions = {

    3: {
        type: "splitter",
        title: "NEW THREAT",
        health: "260+",
        ability: "Splits into 5 Crawlers on death."
    },

    5: {
        type: "gunner",
        title: "NEW THREAT",
        health: "180+",
        ability: "Mounted barrel fires directly at you."
    },

    7: {
        type: "voidling",
        title: "NEW THREAT",
        health: "360+",
        ability: "Damaging Void Ring + turret."
    },

    9: {
        type: "stalker",
        title: "NEW THREAT",
        health: "250+",
        ability: "Moves at 2× Crawler speed."
    },

    10: {
        type: "boss",
        title: "CRITICAL THREAT",
        health: "6,500",
        ability: "Void Ring + 8 rapid-fire turrets."
    },

    11: {
       type: "shinyCrawler",
       title: "NEW THREAT",
       health: "3× CRAWLER",
       ability: "Splits into 7 Crawlers."
   },
   
   12: {
       type: "shinySplitter",
       title: "NEW THREAT",
       health: "3× SPLITTER",
       ability: "Splits into 3 Splitters."
   },
   
   13: {
       type: "halo",
       title: "ELITE THREAT",
       health: "15× CRAWLER",
       ability: "3-shot turret + Void Ring."
   },
   
   15: {
       type: "shinyGunner",
       title: "NEW THREAT",
       health: "3× GUNNER",
       ability: "5-shot turret + splits into 3 Gunners."
   }

};


function showRoomTransition(roomNumber) {

    transitioning = true;
    gameRunning = false;

    crosshair.style.display = "none";

    const introduction =
        enemyIntroductions[
            roomNumber
        ];

    const overlay =
        document.createElement("section");

    overlay.className =
        "room-transition";


    if (introduction) {

        const data =
            ENEMY_TYPES[
                introduction.type
            ];

        overlay.innerHTML = `

            <div class="room-transition-inner enemy-intro">

                <div class="subtitle">
                    DESCENDING
                </div>

                <h1>
                    ROOM ${String(roomNumber).padStart(2, "0")}
                </h1>

                <div class="room-line"></div>

                <div class="enemy-intro-card">

                    <div class="enemy-intro-label">
                        ${introduction.title}
                    </div>

                    <div
                        class="enemy-preview"
                        style="
                            --enemy-color:
                            ${data.color};
                            --enemy-size:
                            ${Math.min(
                                data.radius,
                                58
                            )}px;
                        "
                    >
                        <div class="enemy-preview-core"></div>
                    </div>

                    <div class="enemy-intro-name">
                        ${data.name}
                    </div>

                    <div class="enemy-intro-stats">

                        <div>
                            <span>HEALTH</span>
                            <strong>
                                ${introduction.health}
                            </strong>
                        </div>

                        <div>
                            <span>SIZE</span>
                            <strong>
                                ${Math.round(
                                    data.radius / 15
                                )}×
                            </strong>
                        </div>

                    </div>

                    <div class="enemy-intro-ability">
                        ${introduction.ability}
                    </div>

                </div>

            </div>
        `;

    } else {

        overlay.innerHTML = `

            <div class="room-transition-inner">

                <div class="subtitle">
                    DESCENDING
                </div>

                <h1>
                    ROOM ${String(roomNumber).padStart(2, "0")}
                </h1>

                <div class="room-line"></div>

            </div>

        `;
    }


    document.body.appendChild(
        overlay
    );


    /*
        Normal room:
        1 second.

        New enemy:
        2.7 seconds so the player
        actually has time to read it.
    */

    const displayTime =
        introduction
            ? 2700
            : 1000;


    setTimeout(() => {

        overlay.classList.add(
            "room-transition-hide"
        );

        setTimeout(() => {

            overlay.remove();

            transitioning = false;

            beginRoom(
                roomNumber
            );

        }, 450);

    }, displayTime);
}

/* =========================================================
   START GAME
========================================================= */

function startGame() {

    depth = 1;
    scrap = 0;
    kills = 0;

    gameOver = false;
    transitioning = false;

    player.maxHealth = 100;
    player.health = 100;
    player.speed = 270;
    player.damage = 25;
    player.fireRate = BASE_FIRE_RATE;
    player.bulletSpeed = 720;
    player.multishot = 1;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    player.shootCooldown = 0;

    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];

    for (const key in upgrades) {
        upgrades[key].tier = 0;
    }

    voidRing.enabled = false;
    voidRing.radius = 90;
    voidRing.damage = 10;
    voidRing.cooldown = 0;

    explosiveBullets.enabled = false;
    explosiveBullets.damage = 50;
    explosiveBullets.radius = 45;

    resetPhase4();
    pauseScreen.classList.add("hidden");
    victoryActions.classList.add("hidden");

    startScreen.classList.add("hidden");
    deathScreen.classList.add("hidden");
    clearScreen.classList.add("hidden");
    upgradeScreen.classList.add("hidden");

    updateHUD();

    showRoomTransition(1);
}


/* =========================================================
   BEGIN ROOM
========================================================= */

function beginRoom(roomNumber) {
    if (window.VoidAudio) VoidAudio.play("roomStart");
    if (window.VoidAudio) VoidAudio.setMode("game");
    roomSpawned = 0;
    depth = roomNumber;

    roomEnemiesRequired =
        ROOM_ENEMIES[roomNumber - 1];

    roomKills = 0;

    enemies = [];
    bullets = [];
    enemyBullets = [];
    particles = [];
    pickups = [];
    effects = [];
    floatTexts = [];

    spawnTimer = 0;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    player.health = Math.min(
        player.health,
        player.maxHealth
    );

    gameRunning = true;

    crosshair.style.display = "block";

    updateHUD();
}

/* =========================================================
   ROOM SCALE
========================================================= */

/*
    Instead of physically changing the canvas size,
    the game world becomes larger as depth increases.

    This means:
    - player appears slightly smaller
    - enemies appear slightly smaller
    - bullets appear slightly smaller
    - Void Ring scales with the world
    - you get more movement space
*/

function getWorldScale() {

    return 1 + (depth - 1) * 0.10;

}


/* =========================================================
   WORLD POSITION
========================================================= */

function getWorldCenter() {

    return {
        x: canvas.width / 2,
        y: canvas.height / 2
    };

}


/* =========================================================
   ENEMY COUNT
========================================================= */

function getEnemiesRemaining() {
    return enemies.length;
}

/* =========================================================
   ROOM PROGRESS
========================================================= */

function roomIsComplete() {
    return (
        roomSpawned >= roomEnemiesRequired &&
        enemies.length === 0
    );
}

/* =========================================================
   SPAWN SETTINGS
========================================================= */

function getEnemyCap() {

    if (depth === 10) {
        return 30;
    }

    return Math.min(
        18 + depth * 2,
        40
    );

}

function getSpawnDelay() {

    return Math.max(
        0.08,
        0.42 - depth * 0.032
    );

}

function getEnemyTypeForRoom() {

    /* =====================================================
       ROOM 15
       ALL CURRENT ENEMIES + SHINY GUNNER
    ===================================================== */

    if (depth === 15) {

        const roll = Math.random();

        if (roll < 0.10) {
            return "shinyGunner";
        }

        if (roll < 0.22) {
            return "halo";
        }

        if (roll < 0.34) {
            return "shinySplitter";
        }

        if (roll < 0.46) {
            return "shinyCrawler";
        }

        if (roll < 0.58) {
            return "stalker";
        }

        if (roll < 0.68) {
            return "voidling";
        }

        if (roll < 0.78) {
            return "gunner";
        }

        if (roll < 0.88) {
            return "splitter";
        }

        return "splitter";
    }


    /* =====================================================
       ROOM 14
       HALO + SHINY ENEMIES
    ===================================================== */

    if (depth === 14) {

        const roll = Math.random();

        if (roll < 0.10) {
            return "halo";
        }

        if (roll < 0.22) {
            return "shinySplitter";
        }

        if (roll < 0.34) {
            return "shinyCrawler";
        }

        if (roll < 0.47) {
            return "stalker";
        }

        if (roll < 0.59) {
            return "voidling";
        }

        if (roll < 0.72) {
            return "gunner";
        }

        return "splitter";
    }


    /* =====================================================
       ROOM 13
       HALO INTRODUCED
    ===================================================== */

    if (depth === 13) {

        const roll = Math.random();

        if (roll < 0.5) {
            return "halo";
        }

        if (roll < 0.27) {
            return "shinySplitter";
        }

        if (roll < 0.42) {
            return "shinyCrawler";
        }

        if (roll < 0.57) {
            return "stalker";
        }

        if (roll < 0.70) {
            return "voidling";
        }

        if (roll < 0.83) {
            return "gunner";
        }

        return "splitter";
    }


    /* =====================================================
       ROOM 12
       SHINY SPLITTER INTRODUCED
    ===================================================== */

    if (depth === 12) {

        const roll = Math.random();

        if (roll < 0.15) {
            return "shinySplitter";
        }

        if (roll < 0.30) {
            return "shinyCrawler";
        }

        if (roll < 0.45) {
            return "stalker";
        }

        if (roll < 0.58) {
            return "voidling";
        }

        if (roll < 0.72) {
            return "gunner";
        }

        return "splitter";
    }


    /* =====================================================
       ROOM 11
       SHINY CRAWLER INTRODUCED
    ===================================================== */

    if (depth === 11) {

        const roll = Math.random();

        if (roll < 0.20) {
            return "shinyCrawler";
        }

        if (roll < 0.36) {
            return "stalker";
        }

        if (roll < 0.50) {
            return "voidling";
        }

        if (roll < 0.65) {
            return "gunner";
        }

        return "splitter";
    }


    /* =========================================================
      ROOM 10 — BOSS
   ========================================================= */
   
   if (depth === 10) {
   
       // Spawn the Void Titan around the middle of the room
       if (roomSpawned === 64) {
           return "boss";
       }
   
       const roll = Math.random();
   
       if (roll < 0.25) return "stalker";
       if (roll < 0.50) return "voidling";
       if (roll < 0.70) return "gunner";
       if (roll < 0.88) return "splitter";
   
       return "crawler";
   }


    /* =====================================================
       ROOMS 9
    ===================================================== */

    if (depth === 9) {

        const roll = Math.random();

        if (roll < 0.10) {
            return "stalker";
        }

        if (roll < 0.18) {
            return "voidling";
        }

        if (roll < 0.30) {
            return "gunner";
        }

        if (roll < 0.43) {
            return "splitter";
        }

        return "crawler";
    }


    /* =====================================================
       ROOMS 7–8
    ===================================================== */

    if (depth >= 7) {

        const roll = Math.random();

        if (roll < 0.08) {
            return "voidling";
        }

        if (roll < 0.20) {
            return "gunner";
        }

        if (roll < 0.35) {
            return "splitter";
        }

        return "crawler";
    }


    /* =====================================================
       ROOMS 5–6
    ===================================================== */

    if (depth >= 5) {

        const roll = Math.random();

        if (roll < 0.12) {
            return "gunner";
        }

        if (roll < 0.27) {
            return "splitter";
        }

        return "crawler";
    }


    /* =====================================================
       ROOMS 3–4
    ===================================================== */

    if (depth >= 3) {

        return Math.random() < 0.20
            ? "splitter"
            : "crawler";
    }


    /* =====================================================
       ROOMS 1–2
    ===================================================== */

    return "crawler";
}

/* =========================================================
   SPAWN ENEMY
========================================================= */

function spawnEnemy() {

    if (
        roomSpawned >=
        roomEnemiesRequired
    ) {
        return;
    }

    if (
        enemies.length >=
        getEnemyCap()
    ) {
        return;
    }

    const type =
        getEnemyTypeForRoom();

    const data =
        ENEMY_TYPES[type];

    const angle =
        Math.random() *
        Math.PI *
        2;

    const worldScale =
        getWorldScale();

    const spawnDistance =
       type === "boss"
           ? Math.max(canvas.width, canvas.height) * 0.35
           : Math.max(canvas.width, canvas.height) * 0.55 * worldScale;

    const center =
        getWorldCenter();

    const x =
        center.x +
        Math.cos(angle) *
        spawnDistance;

    const y =
        center.y +
        Math.sin(angle) *
        spawnDistance;

    const health =
        data.health(depth);

    const enemy = {

        type,

        x,
        y,

        radius:
            data.radius,

        health,

        maxHealth:
            health,

        speed:
            data.speed(depth),

        damage:
            data.damage(depth),

        shootCooldown:
            type === "boss"
                ? 0
                : Math.random(),

        ringCooldown: 0,

        turretAngles:
            type === "boss"
                ? Array.from(
                    { length: 8 },
                    (_, i) =>
                        i *
                        (Math.PI * 2 / 8)
                )
                : null
    };

    enemies.push(enemy);

    roomSpawned++;
}

/* =========================================================
   BULLET
========================================================= */

function shoot() {

    if (player.shootCooldown > 0) {
        return;
    }

    const angle =
        Math.atan2(
            mouse.y - player.y,
            mouse.x - player.x
        );

    const spread = 0.12;

    for (let i = 0; i < player.multishot; i++) {

        let bulletAngle = angle;

        if (player.multishot > 1) {

            const offset =
                i -
                (player.multishot - 1) / 2;

            bulletAngle += offset * spread;
        }

        bullets.push({

            x: player.x,
            y: player.y,

            vx:
                Math.cos(bulletAngle) *
                player.bulletSpeed,

            vy:
                Math.sin(bulletAngle) *
                player.bulletSpeed,

            radius: 4,

            damage: player.damage

        });
    }

    player.shootCooldown =
        player.fireRate * (rapidTime > 0 ? 0.6 : 1);
    if (window.VoidAudio) VoidAudio.play("shoot");
}


/* =========================================================
   PLAYER UPDATE
========================================================= */

function updatePlayer(dt) {

    let dx = 0;
    let dy = 0;

    if (keys["w"]) dy--;
    if (keys["s"]) dy++;
    if (keys["a"]) dx--;
    if (keys["d"]) dx++;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }

    /* timers */
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (rapidTime > 0) rapidTime -= dt;
    if (shieldTime > 0) {
        shieldTime -= dt;
        if (shieldTime <= 0) shieldPoints = 0;
    }

    /* dash (input is consumed every frame so it never queues up) */
    if (dashQueued) {
        dashQueued = false;
        tryDash(dx, dy);
    }

    if (player.dashTime > 0) {

        player.dashTime -= dt;
        player.x += player.dashDirX * DASH_SPEED * dt;
        player.y += player.dashDirY * DASH_SPEED * dt;
        spawnDashTrail();

    } else if (moving) {

        player.x += dx * player.speed * dt;
        player.y += dy * player.speed * dt;
    }

    /*
        Larger rooms give the player more usable space.
    */
    const margin = 35 * getWorldScale();

    player.x = Math.max(
        margin,
        Math.min(canvas.width - margin, player.x)
    );

    player.y = Math.max(
        margin,
        Math.min(canvas.height - margin, player.y)
    );

    player.angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    if (player.shootCooldown > 0) {
        player.shootCooldown -= dt;
    }

    /* Nano Repair */
    if (player.regen > 0 && player.health < player.maxHealth) {
        if (player.regenDelay > 0) {
            player.regenDelay -= dt;
        } else {
            player.health = Math.min(
                player.maxHealth,
                player.health + player.regen * dt
            );
        }
    }

    if (mouse.down) {
        shoot();
    }
}


/* =========================================================
   EXPLOSION DAMAGE
========================================================= */

function createBulletExplosion(x, y) {
    if (window.VoidAudio) VoidAudio.play("explosion");


    const explosionRadius =
        explosiveBullets.radius;

    const explosionDamage =
        explosiveBullets.damage;


    /*
        Visual explosion
    */

    for (let i = 0; i < 18; i++) {

        const angle =
            Math.random() *
            Math.PI *
            2;

        const speed =
            80 +
            Math.random() * 180;

        particles.push({

          x,
          y,
      
          vx:
              Math.cos(angle) *
              speed,
      
          vy:
              Math.sin(angle) *
              speed,
      
          life:
              0.35 +
              Math.random() * 0.25,
      
          type: "explosion"
      
      });
    }


    /*
        Damage every enemy inside
        the explosion.
    */

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy =
            enemies[i];

        const dx =
            enemy.x - x;

        const dy =
            enemy.y - y;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (
            distance <=
            explosionRadius +
            enemy.radius
        ) {

            enemy.health -=
                explosionDamage;

            createHitParticles(
                enemy.x,
                enemy.y
            );

            if (
                enemy.health <= 0
            ) {

                killEnemy(i);
            }
        }
    }
}

/* =========================================================
   BULLET UPDATE
========================================================= */

function updateBullets(dt) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const bullet = bullets[i];

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        const margin = 100;

        if (
             bullet.x < 0 ||
             bullet.x > canvas.width ||
             bullet.y < 0 ||
             bullet.y > canvas.height
         ) {
         
             bullets.splice(i, 1);
         
             continue;
         }

        for (
            let j = enemies.length - 1;
            j >= 0;
            j--
        ) {

            const enemy = enemies[j];

            const dx =
                bullet.x - enemy.x;

            const dy =
                bullet.y - enemy.y;

            const distance =
                Math.sqrt(dx * dx + dy * dy);

            if (
                distance <
                bullet.radius +
                enemy.radius
            ) {

                enemy.health -=
                bullet.damage;
                showDamageNumber(enemy, bullet.damage);
                if (window.VoidAudio) VoidAudio.play("hit");
            
            createHitParticles(
                enemy.x,
                enemy.y
            );
            
            bullets.splice(i, 1);
            
            
            /*
                Explosive Bullet
            */
            
            if (
                explosiveBullets.enabled
            ) {
            
                createBulletExplosion(
                    bullet.x,
                    bullet.y
                );
            
            }
            
            
            /*
                Direct hit killed enemy.
            */
            
            if (
                enemy.health <= 0 &&
                enemies[j]
            ) {
            
                killEnemy(j);
            
            }
            
            break;
               
            }
        }
    }
}

/* =========================================================
   ENEMY ABILITIES
========================================================= */

function updateEnemyWeapons(enemy, dt) {

    /*
        GUNNER / VOIDLING
        One turret barrel.
    */

    if (
        enemy.type === "gunner" ||
        enemy.type === "voidling"
    ) {

        enemy.shootCooldown -= dt;

        if (enemy.shootCooldown <= 0) {

            const angle =
                Math.atan2(
                    player.y - enemy.y,
                    player.x - enemy.x
                );

            fireEnemyBullet(
                enemy.x,
                enemy.y,
                angle,
                260,
                8
            );

            enemy.shootCooldown =
                1.15;
        }
    }


    /*
        VOIDLING RING
    */

    if (enemy.type === "voidling") {

        enemy.ringCooldown -= dt;

        if (enemy.ringCooldown <= 0) {

            enemy.ringCooldown = 0.35;

            const dx =
                player.x - enemy.x;

            const dy =
                player.y - enemy.y;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            const ringRadius =
                enemy.radius * 2.2;

            if (
                distance <
                ringRadius
            ) {

                damagePlayer(7);

                if (player.health <= 0) {

                    player.health = 0;

                    finishGame();
                }
            }
        }
    }

   /* =====================================================
      HALO
      3 bullets every 0.25 seconds
   ===================================================== */
   
   if (enemy.type === "halo") {
   
       enemy.shootCooldown -= dt;
   
       if (enemy.shootCooldown <= 0) {
   
           const baseAngle =
               Math.atan2(
                   player.y - enemy.y,
                   player.x - enemy.x
               );
   
           const spread = 0.12;
   
           for (let i = 0; i < 3; i++) {
   
               const angle =
                   baseAngle +
                   (i - 1) * spread;
   
               fireEnemyBullet(
                   enemy.x,
                   enemy.y,
                   angle,
                   280,
                   10
               );
           }
   
           enemy.shootCooldown = 0.25;
       }
   
   
       /* HALO VOID RING */
   
       enemy.ringCooldown -= dt;
   
       if (enemy.ringCooldown <= 0) {
   
           enemy.ringCooldown = 0.30;
   
           const dx =
               player.x - enemy.x;
   
           const dy =
               player.y - enemy.y;
   
           const distance =
               Math.sqrt(
                   dx * dx +
                   dy * dy
               );
   
           const ringRadius =
               enemy.radius * 1.5;
   
           if (distance < ringRadius) {
   
               damagePlayer(10);
   
               if (player.health <= 0) {
   
                   player.health = 0;
   
                   finishGame();
               }
           }
       }
   }

   /* =====================================================
      [SHINY] GUNNER
      5 bullets every 0.20 seconds
   ===================================================== */
   
   if (enemy.type === "shinyGunner") {
   
       enemy.shootCooldown -= dt;
   
       if (enemy.shootCooldown <= 0) {
   
           const baseAngle =
               Math.atan2(
                   player.y - enemy.y,
                   player.x - enemy.x
               );
   
           const spread = 0.10;
   
           for (let i = 0; i < 5; i++) {
   
               const angle =
                   baseAngle +
                   (i - 2) * spread;
   
               fireEnemyBullet(
                   enemy.x,
                   enemy.y,
                   angle,
                   300,
                   11
               );
           }
   
           enemy.shootCooldown = 0.20;
       }
   }
    /*
        VOID TITAN
        Eight independently aimed turrets.
    */

    if (enemy.type === "boss") {

        enemy.shootCooldown -= dt;

        if (enemy.shootCooldown <= 0) {

            for (
                let i = 0;
                i < 8;
                i++
            ) {

                const turretAngle =
                    Math.atan2(
                        player.y - enemy.y,
                        player.x - enemy.x
                    ) +
                    (i - 3.5) * 0.075;

                const turretDistance =
                    enemy.radius * 0.62;

                const turretX =
                    enemy.x +
                    Math.cos(turretAngle) *
                    turretDistance;

                const turretY =
                    enemy.y +
                    Math.sin(turretAngle) *
                    turretDistance;

                fireEnemyBullet(
                    turretX,
                    turretY,
                    turretAngle,
                    300,
                    9
                );
            }

            /*
                Base player fire rate:
                0.16 seconds.
            */

            enemy.shootCooldown =
                0.16;
        }


        /*
            Boss Void Ring
        */

        enemy.ringCooldown -= dt;

        if (enemy.ringCooldown <= 0) {

            enemy.ringCooldown = 0.30;

            const dx =
                player.x - enemy.x;

            const dy =
                player.y - enemy.y;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            const ringRadius =
                enemy.radius * 2.2;

            if (
                distance <
                ringRadius
            ) {

                damagePlayer(12);

                if (player.health <= 0) {

                    player.health = 0;

                    finishGame();
                }
            }
        }
    }
}

/* =========================================================
   ENEMY UPDATE
========================================================= */

function updateEnemies(dt) {

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy = enemies[i];

        const dx =
            player.x - enemy.x;

        const dy =
            player.y - enemy.y;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        /*
            Move toward player.
        */

        if (distance > 0) {

            enemy.x +=
                (dx / distance) *
                enemy.speed *
                dt;

            enemy.y +=
                (dy / distance) *
                enemy.speed *
                dt;
        }


        /*
            Special abilities.
        */

        updateEnemyWeapons(
            enemy,
            dt
        );


        /*
            Contact damage.
        */

        const newDistance =
            Math.sqrt(
                Math.pow(
                    player.x - enemy.x,
                    2
                ) +
                Math.pow(
                    player.y - enemy.y,
                    2
                )
            );

        if (
            newDistance <
            player.radius +
            enemy.radius
        ) {

            damagePlayer(enemy.damage * dt, true);

            const knockback =
                120 * dt;

            if (newDistance > 0) {

                enemy.x -=
                    ((player.x - enemy.x) /
                    newDistance) *
                    knockback;

                enemy.y -=
                    ((player.y - enemy.y) /
                    newDistance) *
                    knockback;
            }

            if (player.health <= 0) {

                player.health = 0;

                finishGame();

                return;
            }
        }
    }
}

/* =========================================================
   VOID RING
========================================================= */

function updateVoidRing(dt) {

    if (!voidRing.enabled) {
        return;
    }

    voidRing.cooldown -= dt;

    if (voidRing.cooldown > 0) {
        return;
    }

    voidRing.cooldown =
        voidRing.hitCooldown;

    const scale =
        getWorldScale();

    const ringRadius =
        voidRing.radius *
        scale;

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy = enemies[i];

        const dx =
            enemy.x - player.x;

        const dy =
            enemy.y - player.y;

        const distance =
            Math.sqrt(dx * dx + dy * dy);

        if (
            distance <=
            ringRadius +
            enemy.radius
        ) {

            enemy.health -=
                voidRing.damage;

            createHitParticles(
                enemy.x,
                enemy.y
            );

            if (enemy.health <= 0) {

                killEnemy(i);
            }
        }
    }
}


/* =========================================================
   KILL ENEMY
========================================================= */

function killEnemy(index) {
    if (window.VoidAudio) VoidAudio.play("kill");

    const enemy =
        enemies[index];

    if (!enemy) {
        return;
    }


    /*
        Scrap reward scales slightly
        with enemy difficulty.
    */

    let scrapReward =
        Math.floor(
            Math.random() * 8
        ) + 5;


    if (enemy.type === "splitter") {
        scrapReward += 8;
    }

    if (enemy.type === "gunner") {
        scrapReward += 5;
    }

    if (enemy.type === "voidling") {
        scrapReward += 10;
    }

    if (enemy.type === "stalker") {
        scrapReward += 8;
    }

    if (enemy.type === "boss") {
        scrapReward += 150;
    }


    scrap += scrapReward;

    kills++;
    roomKills++;


    createExplosion(
        enemy.x,
        enemy.y,
        ENEMY_TYPES[enemy.type].color,
        enemy.radius
    );

    onEnemyKilled(enemy);


    /*
        SPLITTER
        Creates five normal Crawlers.

        These are additional enemies,
        so roomSpawned is NOT increased.
        They must still be defeated before
        the room can finish.
    */

    /* =====================================================
      SPLITTER
      5 CRAWLERS
   ===================================================== */
   
   if (
       enemy.type === "splitter"
   ) {
   
       for (
           let i = 0;
           i < 5;
           i++
       ) {
   
           const angle =
               i *
               (Math.PI * 2 / 5);
   
           const distance = 55;
   
           const health =
               ENEMY_TYPES.crawler
                   .health(depth);
   
           enemies.push({
   
               type: "crawler",
   
               x:
                   enemy.x +
                   Math.cos(angle) *
                   distance,
   
               y:
                   enemy.y +
                   Math.sin(angle) *
                   distance,
   
               radius:
                   ENEMY_TYPES.crawler.radius,
   
               health,
   
               maxHealth:
                   health,
   
               speed:
                   ENEMY_TYPES.crawler
                       .speed(depth),
   
               damage:
                   ENEMY_TYPES.crawler
                       .damage(depth),
   
               shootCooldown: 0,
               ringCooldown: 0,
               turretAngles: null
   
           });
       }
   }
   
   
   /* =====================================================
      [SHINY] CRAWLER
      7 CRAWLERS
   ===================================================== */
   
   if (
       enemy.type === "shinyCrawler"
   ) {
   
       for (
           let i = 0;
           i < 7;
           i++
       ) {
   
           const angle =
               i *
               (Math.PI * 2 / 7);
   
           const distance = 70;
   
           const health =
               ENEMY_TYPES.crawler
                   .health(depth);
   
           enemies.push({
   
               type: "crawler",
   
               x:
                   enemy.x +
                   Math.cos(angle) *
                   distance,
   
               y:
                   enemy.y +
                   Math.sin(angle) *
                   distance,
   
               radius:
                   ENEMY_TYPES.crawler.radius,
   
               health,
   
               maxHealth:
                   health,
   
               speed:
                   ENEMY_TYPES.crawler
                       .speed(depth),
   
               damage:
                   ENEMY_TYPES.crawler
                       .damage(depth),
   
               shootCooldown: 0,
               ringCooldown: 0,
               turretAngles: null
   
           });
       }
   }
   
   
   /* =====================================================
      [SHINY] SPLITTER
      3 SPLITTERS
   ===================================================== */
   
   if (
       enemy.type === "shinySplitter"
   ) {
   
       for (
           let i = 0;
           i < 3;
           i++
       ) {
   
           const angle =
               i *
               (Math.PI * 2 / 3);
   
           const distance = 110;
   
           const health =
               ENEMY_TYPES.splitter
                   .health(depth);
   
           enemies.push({
   
               type: "splitter",
   
               x:
                   enemy.x +
                   Math.cos(angle) *
                   distance,
   
               y:
                   enemy.y +
                   Math.sin(angle) *
                   distance,
   
               radius:
                   ENEMY_TYPES.splitter.radius,
   
               health,
   
               maxHealth:
                   health,
   
               speed:
                   ENEMY_TYPES.splitter
                       .speed(depth),
   
               damage:
                   ENEMY_TYPES.splitter
                       .damage(depth),
   
               shootCooldown: 0,
               ringCooldown: 0,
               turretAngles: null
   
           });
       }
   }
   
   
   /* =====================================================
      [SHINY] GUNNER
      3 GUNNERS
   ===================================================== */
   
   if (
       enemy.type === "shinyGunner"
   ) {
   
       for (
           let i = 0;
           i < 3;
           i++
       ) {
   
           const angle =
               i *
               (Math.PI * 2 / 3);
   
           const distance = 90;
   
           const health =
               ENEMY_TYPES.gunner
                   .health(depth);
   
           enemies.push({
   
               type: "gunner",
   
               x:
                   enemy.x +
                   Math.cos(angle) *
                   distance,
   
               y:
                   enemy.y +
                   Math.sin(angle) *
                   distance,
   
               radius:
                   ENEMY_TYPES.gunner.radius,
   
               health,
   
               maxHealth:
                   health,
   
               speed:
                   ENEMY_TYPES.gunner
                       .speed(depth),
   
               damage:
                   ENEMY_TYPES.gunner
                       .damage(depth),
   
               shootCooldown: 0,
               ringCooldown: 0,
               turretAngles: null
   
           });
       }
   }


    enemies.splice(
        index,
        1
    );

    updateHUD();
}

/* =========================================================
   PARTICLES
========================================================= */

function createHitParticles(x, y, color = "#9fe6ff") {

    const count = settings.lowQuality ? 2 : 5;

    for (let i = 0; i < count; i++) {

        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 160;
        const life = 0.2 + Math.random() * 0.15;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: 1.6 + Math.random() * 1.4,
            color
        });
    }
}

function createExplosion(x, y, color = "#ffb347", radius = 15) {

    const base = 14 + Math.round(radius / 3);
    const count = Math.min(
        settings.lowQuality ? 18 : 46,
        base
    );

    for (let i = 0; i < count; i++) {

        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * (200 + radius * 2.5);
        const life = 0.45 + Math.random() * 0.45;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: 1.8 + Math.random() * 2.8,
            color: Math.random() < 0.28 ? "#ffffff" : color
        });
    }
}

function showDamageNumber(enemy, amount) {

    if (!settings.numbers) {
        return;
    }

    const now = performance.now();

    if (now - (enemy.lastNumber || 0) < 130) {
        return;
    }

    enemy.lastNumber = now;

    addFloatText(
        enemy.x,
        enemy.y - enemy.radius / getWorldScale() - 8,
        String(Math.round(amount)),
        "#eaf6ff",
        0.8
    );
}

function updateParticles(dt) {

    const drag = Math.pow(0.25, dt);

    for (let i = particles.length - 1; i >= 0; i--) {

        const particle = particles[i];

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (particle.maxLife) {
            particle.vx *= drag;
            particle.vy *= drag;
        }

        particle.life -= dt;

        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }

    if (particles.length > 1400) {
        particles.splice(0, particles.length - 1400);
    }
}

/* =========================================================
   ROOM COMPLETION
========================================================= */

function completeRoom() {
    gameRunning = false;
    if (window.VoidAudio) VoidAudio.play("roomClear");
    if (window.VoidAudio) VoidAudio.setMode("menu");

    score += depth * 100;
    addFloatText(player.x, player.y - 40, `+${depth * 100}`, "#ffd24a", 1.5);


    crosshair.style.display = "none";

    clearTitle.textContent =
        `ROOM ${depth} CLEARED`;

    clearMessage.textContent =
        depth >= MAX_ROOMS
            ? "The facility ends here."
            : "Sector secured. Upgrade your equipment.";

    clearScreen.classList.remove("hidden");

    setTimeout(() => {
        clearScreen.classList.add("hidden");

        if (depth >= MAX_ROOMS) {
            finishRun();
            return;
        }

        showUpgradeScreen();
    }, 1100);
}

/* =========================================================
   UPGRADE COST
========================================================= */

function getUpgradeCost(upgrade) {

    return Math.floor(
        upgrade.baseCost *
        Math.pow(1.5, upgrade.tier)
    );

}


/* =========================================================
   APPLY UPGRADE
========================================================= */

function applyUpgrade(key) {

    const upgrade = upgrades[key];

    const cost =
        getUpgradeCost(upgrade);

    if (scrap < cost) {
        if (window.VoidAudio) VoidAudio.play("deny");
        return;
    }

    scrap -= cost;
    if (window.VoidAudio) VoidAudio.play("upgrade");

    upgrade.tier++;

    switch (key) {

        case "health":

            player.maxHealth *= 1.20;

            player.health =
                player.maxHealth;

            break;


        case "speed":

            player.speed *= 1.10;

            break;


        case "damage":

            player.damage *= 1.15;

            break;


        case "fireRate":

            player.fireRate *= 0.90;

            break;


        case "bulletSpeed":

            player.bulletSpeed *= 1.15;

            break;


        case "multishot":

            player.multishot++;

            break;

        case "explosive":

        explosiveBullets.enabled =
           true;
   
        explosiveBullets.damage =
           50 +
           (upgrade.tier - 1) *
           explosiveBullets.damageIncrease;
   
        explosiveBullets.radius =
           45 +
           (upgrade.tier - 1) *
           explosiveBullets.damageRadiusIncrease;
   
        break;

        case "regen":
            player.regen += 1.5;
            break;

        case "dashCore":
            player.dashMaxCooldown = Math.max(0.5, player.dashMaxCooldown * 0.85);
            break;

        case "voidRing":

            voidRing.enabled = true;

            voidRing.radius =
                90 *
                Math.pow(
                    1.15,
                    upgrade.tier - 1
                );

            voidRing.damage =
                10 *
                Math.pow(
                    1.15,
                    upgrade.tier - 1
                );

            break;
    }

    updateHUD();

    renderUpgrades();
}


/* =========================================================
   UPGRADE SCREEN
========================================================= */

function showUpgradeScreen() {
    crosshair.style.display = "none";

    upgradeScreen.classList.remove("hidden");

    renderUpgrades();
}


function renderUpgrades() {

    upgradeScrap.textContent =
        scrap;

    upgradeOptions.innerHTML = "";

    const keys = Object.keys(upgrades);

    keys.sort(() =>
        Math.random() - 0.5
    );

    const selected =
        keys.slice(0, 3);

    for (const key of selected) {

        const upgrade =
            upgrades[key];

        const cost =
            getUpgradeCost(upgrade);

        const card =
            document.createElement("button");

        card.className =
            "upgrade-card";

        if (scrap < cost) {
            card.classList.add(
                "unaffordable"
            );
        }

        let icon = "✦";

        if (key === "health") icon = "◉";
        if (key === "speed") icon = "»";
        if (key === "damage") icon = "✦";
        if (key === "fireRate") icon = "≋";
        if (key === "bulletSpeed") icon = "➜";
        if (key === "multishot") icon = "✣";
        if (key === "explosive") icon = "✹";
        if (key === "voidRing") icon = "◎";
        if (key === "regen") icon = "✚";
        if (key === "dashCore") icon = "⇢";

        card.innerHTML = `

            <div class="upgrade-icon">
                ${icon}
            </div>

            <div class="upgrade-name">
                ${upgrade.name}
            </div>

            <div class="upgrade-description">
                ${upgrade.description}
            </div>

            <div class="upgrade-tier">
                TIER ${upgrade.tier + 1}
            </div>

            <div class="upgrade-cost">
                ${cost} SCRAP
            </div>

        `;

        card.addEventListener(
            "click",
            () => {

                if (scrap >= cost) {

                    applyUpgrade(key);

                }

            }
        );

        upgradeOptions.appendChild(card);
    }
}


/* =========================================================
   CONTINUE BUTTON
========================================================= */

continueButton.addEventListener(
    "click",
    () => {

        upgradeScreen.classList.add("hidden");

        const nextRoom =
            depth + 1;

        showRoomTransition(
            nextRoom
        );

    }
);


/* =========================================================
   GAME OVER
========================================================= */

function finishGame() {

    if (gameOver) {
        return;
    }

    gameRunning = false;
    gameOver = true;
    player.dead = true;
    paused = false;

    crosshair.style.display = "none";

    if (window.VoidAudio) VoidAudio.play("death");
    if (window.VoidAudio) VoidAudio.setMode("menu");
    createExplosion(player.x, player.y, "#72d7ff", 60);
    addEffect(player.x, player.y, 260, "#72d7ff", 0.9);
    addShake(18);

    fillRunSummary(recordRun());

    deathScreen.classList.remove(
        "hidden"
    );
}

/* =========================================================
   FINAL ROOM
========================================================= */

function finishRun() {

    gameRunning = false;

    const newBest = recordRun();
    fillRunSummary(newBest);

    clearTitle.textContent =
        "FACILITY COMPLETE";

    clearMessage.textContent =
        `You reached the bottom of the VOID. Final score: ${score.toLocaleString()}`;

    victoryActions.classList.remove("hidden");

    clearScreen.classList.remove(
        "hidden"
    );
}

/* =========================================================
   HUD
========================================================= */

function updateHUDBase() {

    if (depthText) {
        depthText.textContent =
            String(depth).padStart(2, "0");
    }

    if (roomStatus) {
       roomStatus.textContent =
           `ROOM ${String(depth).padStart(2, "0")}`;
    }
    if (scrapText) {
        scrapText.textContent =
            scrap;
    }

    if (enemyCountText) {

        enemyCountText.textContent =
            `ENEMIES: ${getEnemiesRemaining()}`;

    }

    if (healthFill) {

        const percent =
            Math.max(
                0,
                (player.health /
                player.maxHealth) * 100
            );

        healthFill.style.width =
            `${percent}%`;

    }

    if (healthText) {

        healthText.textContent =
            `${Math.ceil(player.health)} / ${Math.ceil(player.maxHealth)}`;

    }
}


function updateHUD() {
    updateHUDBase();
    updateHUDExtras();
}

/* =========================================================
   DRAW BACKGROUND
========================================================= */

function drawBackground() {

    ctx.fillStyle = "#050912";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /*
        Subtle grid.
    */

    const scale =
        getWorldScale();

    const gridSize =
        70 * scale;

    ctx.strokeStyle =
        "rgba(114, 215, 255, 0.045)";

    ctx.lineWidth = 1;

    for (
        let x = 0;
        x < canvas.width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);

        ctx.stroke();
    }

    for (
        let y = 0;
        y < canvas.height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);

        ctx.stroke();
    }
}


/* =========================================================
   DRAW PLAYER
========================================================= */

function drawPlayer() {

    const scale =
        getWorldScale();

    const radius =
        player.radius / scale;

    /*
        Outer glow
    */

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        radius + 9 / scale,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "rgba(114, 215, 255, 0.08)";

    ctx.fill();


    /*
        Outer ring
    */

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        "#72d7ff";

    ctx.lineWidth =
        2 / scale;

    ctx.stroke();


    /*
        Inner core
    */

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        7 / scale,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#72d7ff";

    ctx.fill();


    /*
        Aim line
    */

    ctx.beginPath();

    ctx.moveTo(
        player.x,
        player.y
    );

    ctx.lineTo(
        player.x +
            Math.cos(player.angle) *
            (radius + 7 / scale),

        player.y +
            Math.sin(player.angle) *
            (radius + 7 / scale)
    );

    ctx.strokeStyle =
        "rgba(114, 215, 255, 0.8)";

    ctx.lineWidth =
        2 / scale;

    ctx.stroke();
}


/* =========================================================
   DRAW VOID RING
========================================================= */

function drawVoidRing() {

    if (!voidRing.enabled) {
        return;
    }

    const scale =
        getWorldScale();

    const radius =
        voidRing.radius *
        scale /
        scale;

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        radius,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        "rgba(114, 215, 255, 0.35)";

    ctx.lineWidth =
        2 / scale;

    ctx.shadowBlur =
        18 / scale;

    ctx.shadowColor =
        "#72d7ff";

    ctx.stroke();

    ctx.shadowBlur = 0;
}


/* =========================================================
   DRAW BULLETS
========================================================= */

function drawBullets() {

    const scale =
        getWorldScale();

    for (const bullet of bullets) {

        const radius =
            bullet.radius /
            scale;

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#eef5ff";

        ctx.fill();
    }
}

/* =========================================================
   DRAW ENEMY BULLETS
========================================================= */

function drawEnemyBullets() {

    const scale =
        getWorldScale();

    for (const bullet of enemyBullets) {

        const radius =
            bullet.radius /
            scale;

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            radius + 3 / scale,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(255, 85, 119, 0.12)";

        ctx.fill();


        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#ff5577";

        ctx.fill();
    }
}

/* =========================================================
   DRAW ENEMIES
========================================================= */

function drawEnemies() {

    const scale =
        getWorldScale();

    for (const enemy of enemies) {

        const radius =
            enemy.radius /
            scale;

        const color =
            ENEMY_TYPES[
                enemy.type
            ].color;


        /*
            VOID RING ENEMIES
        */

        if (
             enemy.type === "voidling" ||
             enemy.type === "boss" ||
             enemy.type === "halo"
         ) {

            const ringRadius =
                enemy.radius *
                2.2 /
                scale;

            ctx.beginPath();

            ctx.arc(
                enemy.x,
                enemy.y,
                ringRadius,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                enemy.type === "boss"
                   ? "rgba(114, 215, 255, 0.45)"
                   : enemy.type === "halo"
                       ? "rgba(114, 215, 255, 0.40)"
                       : "rgba(168, 85, 247, 0.40)";
            ctx.lineWidth =
                3 / scale;

            ctx.shadowBlur =
                18 / scale;

            ctx.shadowColor =
                color;

            ctx.stroke();

            ctx.shadowBlur = 0;
        }


        /*
            OUTER GLOW
        */

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            radius + 8 / scale,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            color
                .replace(")", ", 0.10)")
                .replace("rgb", "rgba");

        /*
            Hex colors cannot be directly converted
            with the above approach, so use alpha
            through a fixed glow instead.
        */

        ctx.fillStyle =
            enemy.type === "boss"
                ? "rgba(114, 215, 255, 0.10)"
                : enemy.type === "voidling"
                    ? "rgba(168, 85, 247, 0.10)"
                    : enemy.type === "gunner"
                        ? "rgba(184, 255, 61, 0.09)"
                        : enemy.type === "stalker"
                            ? "rgba(255, 228, 77, 0.09)"
                            : enemy.type === "splitter"
                                ? "rgba(255, 138, 61, 0.09)"
                                : "rgba(255, 85, 119, 0.08)";

      ctx.fill();

        /* =====================================================
         SHINY GLINT
      ===================================================== */
      
      if (
          enemy.type === "shinyCrawler" ||
          enemy.type === "shinySplitter" ||
          enemy.type === "shinyGunner"
      ) {
      
          const glint =
              Math.sin(
                  performance.now() * 0.006
              );
      
          const glintX =
              enemy.x +
              Math.cos(
                  -0.7
              ) *
              radius *
              0.55;
      
          const glintY =
              enemy.y +
              Math.sin(
                  -0.7
              ) *
              radius *
              0.55;
      
          ctx.globalAlpha =
              0.35 +
              glint * 0.25;
      
          ctx.beginPath();
      
          ctx.arc(
              glintX,
              glintY,
              Math.max(
                  3,
                  radius * 0.12
              ),
              0,
              Math.PI * 2
          );
      
          ctx.fillStyle =
              "#ffffff";
      
          ctx.shadowBlur =
              14;
      
          ctx.shadowColor =
              "#ffffff";
      
          ctx.fill();
      
          ctx.shadowBlur = 0;
      
          ctx.globalAlpha = 1;
      }

        /*
            MAIN BODY
        */

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            color;

        ctx.fill();


        /*
            BOSS CORE
        */

        if (enemy.type === "boss") {

            ctx.beginPath();

            ctx.arc(
                enemy.x,
                enemy.y,
                radius * 0.45,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "#050912";

            ctx.fill();

            ctx.beginPath();

            ctx.arc(
                enemy.x,
                enemy.y,
                radius * 0.22,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "#72d7ff";

            ctx.fill();
        }


        /*
            TURRET / BARREL
        */

        if (
            enemy.type === "gunner" ||
            enemy.type === "voidling"
        ) {

            const angle =
                Math.atan2(
                    player.y - enemy.y,
                    player.x - enemy.x
                );

            const barrelLength =
                radius * 1.45;

            ctx.beginPath();

            ctx.moveTo(
                enemy.x +
                    Math.cos(angle) *
                    radius * 0.25,

                enemy.y +
                    Math.sin(angle) *
                    radius * 0.25
            );

            ctx.lineTo(
                enemy.x +
                    Math.cos(angle) *
                    barrelLength,

                enemy.y +
                    Math.sin(angle) *
                    barrelLength
            );

            ctx.strokeStyle =
                "#d9e6ef";

            ctx.lineWidth =
                5 / scale;

            ctx.stroke();
        }


        /*
            BOSS TURRETS
        */

        if (enemy.type === "boss") {

            for (
                let i = 0;
                i < 8;
                i++
            ) {

                const angle =
                    Math.atan2(
                        player.y - enemy.y,
                        player.x - enemy.x
                    ) +
                    (i - 3.5) *
                    0.075;

                const turretDistance =
                    radius * 0.62;

                const turretX =
                    enemy.x +
                    Math.cos(angle) *
                    turretDistance;

                const turretY =
                    enemy.y +
                    Math.sin(angle) *
                    turretDistance;

                ctx.beginPath();

                ctx.arc(
                    turretX,
                    turretY,
                    radius * 0.11,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    "#72d7ff";

                ctx.fill();


                ctx.beginPath();

                ctx.moveTo(
                    turretX,
                    turretY
                );

                ctx.lineTo(
                    turretX +
                        Math.cos(angle) *
                        radius * 0.22,

                    turretY +
                        Math.sin(angle) *
                        radius * 0.22
                );

                ctx.strokeStyle =
                    "#dff7ff";

                ctx.lineWidth =
                    3 / scale;

                ctx.stroke();
            }
        }


        /*
            HEALTH BAR
        */

        const healthPercent =
            Math.max(
                0,
                enemy.health /
                enemy.maxHealth
            );

        const barWidth =
            Math.max(
                32,
                radius * 2
            );

        const barHeight =
            enemy.type === "boss"
                ? 5
                : 3;

        ctx.fillStyle =
            "rgba(255,255,255,0.08)";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y -
                radius -
                9 / scale,
            barWidth,
            barHeight
        );

        ctx.fillStyle =
            color;

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y -
                radius -
                9 / scale,
            barWidth *
                healthPercent,
            barHeight
        );
    }
}


/* =========================================================
   OVERLAY (health bars + floating numbers) — used with 3D
========================================================= */

function drawEnemyHealthBars() {
    const scale = getWorldScale();

    for (const enemy of enemies) {
        const radius = enemy.radius / scale;
        const percent = Math.max(0, enemy.health / enemy.maxHealth);

        if (percent >= 1 && enemy.type !== "boss") {
            continue;
        }

        const color = ENEMY_TYPES[enemy.type].color;
        const barWidth = Math.max(32, radius * 2);
        const barHeight = enemy.type === "boss" ? 5 : 3;
        const x = enemy.x - barWidth / 2;
        const y = enemy.y - radius - 12 / scale;

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth * percent, barHeight);
    }
}

function drawFloatTexts() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const t of floatTexts) {
        const alpha = Math.max(0, Math.min(1, t.life / t.maxLife * 1.6));
        ctx.globalAlpha = alpha;
        ctx.font = `700 ${Math.round(13 * t.size)}px Orbitron, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(5, 9, 18, 0.85)";
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
    }

    ctx.globalAlpha = 1;
}

function drawOverlay() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isMenuOpen()) {
        return;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawEnemyHealthBars();
    drawFloatTexts();
    ctx.restore();
}


/* =========================================================
   2D FALLBACK EXTRAS
========================================================= */

function drawEffects2D() {
    for (const fx of effects) {
        const t = 1 - fx.life / fx.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * (0.2 + t * 0.8), 0, Math.PI * 2);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawPickups2D() {
    const pulse = Math.sin(performance.now() * 0.008) * 2;

    for (const pickup of pickups) {
        const info = PICKUP_TYPES[pickup.type];
        const blink = pickup.life - pickup.age < 3
            && Math.floor(pickup.age * 8) % 2 === 0;

        if (blink) {
            continue;
        }

        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, pickup.radius + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = info.color;
        ctx.fill();
    }
}

function drawShield2D() {
    if (shieldPoints <= 0) {
        return;
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(114, 215, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawHitFlash2D() {
    if (hitFlash <= 0.01) {
        return;
    }
    const g = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.9
    );
    g.addColorStop(0, "rgba(255, 40, 70, 0)");
    g.addColorStop(1, `rgba(255, 40, 70, ${hitFlash * 0.45})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawParticles() {
    const scale = getWorldScale();

    for (const particle of particles) {
        const maxLife = particle.maxLife || 0.5;
        ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / maxLife));
        ctx.beginPath();
        ctx.arc(
            particle.x,
            particle.y,
            (particle.size || 2) / scale,
            0,
            Math.PI * 2
        );
        ctx.fillStyle =
            particle.color ||
            (particle.type === "explosion" ? "#ffb347" : "#72d7ff");
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================================
   DRAW
========================================================= */

const renderState = {
    width: 0,
    height: 0,
    viz: 1,
    scale: 1,
    depth: 1,
    menu: true,
    running: false,
    player,
    enemies,
    bullets,
    enemyBullets,
    particles,
    effects,
    pickups,
    voidRing,
    enemyTypes: ENEMY_TYPES,
    pickupTypes: PICKUP_TYPES,
    shieldPoints: 0,
    rapid: false,
    hitFlash: 0,
    shakeX: 0,
    shakeY: 0,
    mouse,
    time: 0
};

function syncRenderState() {
    const s = renderState;

    s.width = canvas.width;
    s.height = canvas.height;
    s.scale = getWorldScale();
    s.viz = 1 / s.scale;
    s.depth = depth;
    s.menu = isMenuOpen();
    s.running = gameRunning;

    /* arrays are re-assigned on room changes, so refresh references */
    s.enemies = enemies;
    s.bullets = bullets;
    s.enemyBullets = enemyBullets;
    s.particles = particles;
    s.effects = effects;
    s.pickups = pickups;

    s.shieldPoints = shieldPoints;
    s.rapid = rapidTime > 0;
    s.hitFlash = hitFlash;
    s.shakeX = shakeX;
    s.shakeY = shakeY;
    s.time = performance.now() / 1000;
}

function use3D() {
    const renderer = window.VoidRenderer;
    return Boolean(
        renderer &&
        renderer.ready &&
        settings.use3d
    );
}

function draw2D() {
    drawBackground();

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawVoidRing();
    drawBullets();
    drawEnemyBullets();
    drawEnemies();
    drawPickups2D();
    drawEffects2D();
    drawParticles();

    if (!player.dead && !isMenuOpen()) {
        drawPlayer();
        drawShield2D();
    }

    drawFloatTexts();
    ctx.restore();

    drawHitFlash2D();
}

function draw(dt) {
    if (use3D()) {
        document.body.classList.add("gl-on");
        syncRenderState();
        window.VoidRenderer.render(renderState, dt);
        drawOverlay();
    } else {
        document.body.classList.remove("gl-on");
        draw2D();
    }
}

/* =========================================================
   MAIN LOOP
========================================================= */

function gameLoop(timestamp) {

    const realDt = Math.min(
        (timestamp - lastTime) / 1000,
        0.05
    );

    const dt = realDt;

    lastTime = timestamp;

    if (gameRunning && !paused) {

        updatePlayer(dt);
        updateBullets(dt);
        updateEnemies(dt);
        updateVoidRing(dt);
        updateEnemyBullets(dt);
        updateParticles(dt);
        updatePickups(dt);
        updateCombo(dt);

        /* Spawn the fixed number of enemies assigned to this room. */
        if (roomSpawned < roomEnemiesRequired) {
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnEnemy();
                spawnTimer = getSpawnDelay();
            }
        }

        /*
            Room is complete when:
            - all required enemies have spawned
            - no enemies remain alive
        */
        if (roomIsComplete()) {
            completeRoom();
        }

        updateHUD();

    } else if (!paused) {

        /* keep sparks and rings animating after death / between rooms */
        updateParticles(dt);
    }

    if (!paused) {
        updateEffects(dt);
        updateShake(dt);
    }

    draw(realDt);

    requestAnimationFrame(gameLoop);
}

window.VoidGame = {
    settings,
    applySettings
};

/* =========================================================
   INITIALIZE
========================================================= */

updateHUD();
refreshRecords();
applySettings();
showMenuPanel("main");
requestAnimationFrame(gameLoop);
