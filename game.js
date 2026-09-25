/* =========================================================
   VOID — GAME.JS
   Phase 3
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

const MAX_ROOMS = 10;

/*
    Number of actual weapon/ring kills required
    to clear each room.
*/
const ROOM_ENEMIES = [
    12,
    18,
    25,
    32,
    40,
    50,
    65,
    80,
    100,
    125
];


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;
let gameOver = false;
let transitioning = false;

let depth = 1;
let scrap = 0;
let kills = 0;

let roomEnemiesRequired = 0;
let roomKills = 0;
let roomSpawned = 0;

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

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,

    radius: 16,

    speed: 270,

    maxHealth: 100,
    health: 100,

    damage: 25,
    fireRate: 0.16,
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

    voidRing: {
        name: "VOID RING",
        description: "Creates a damaging ring around you",
        baseCost: 35,
        tier: 0
    }
};


/* =========================================================
   ENTITIES
========================================================= */

let bullets = [];
let enemies = [];
let particles = [];


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
   BUTTONS
========================================================= */

startButton.addEventListener("click", () => {
    startGame();
});

restartButton.addEventListener("click", () => {
    startGame();
});

/* =========================================================
   ROOM TRANSITION
========================================================= */

function showRoomTransition(roomNumber) {

    transitioning = true;
    gameRunning = false;

    crosshair.style.display = "none";

    const overlay = document.createElement("section");

    overlay.className = "room-transition";

    overlay.innerHTML = `
        <div class="room-transition-inner">

            <div class="subtitle">
                DESCENDING
            </div>

            <h1>
                ROOM ${roomNumber}
            </h1>

            <div class="room-line"></div>

        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {

        overlay.classList.add("room-transition-hide");

        setTimeout(() => {

            overlay.remove();

            transitioning = false;

            beginRoom(roomNumber);

        }, 450);

    }, 1000);
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
    player.fireRate = 0.16;
    player.bulletSpeed = 720;
    player.multishot = 1;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    player.shootCooldown = 0;

    bullets = [];
    enemies = [];
    particles = [];

    for (const key in upgrades) {
        upgrades[key].tier = 0;
    }

    voidRing.enabled = false;
    voidRing.radius = 90;
    voidRing.damage = 10;
    voidRing.cooldown = 0;

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
    roomSpawned = 0;
    depth = roomNumber;

    roomEnemiesRequired =
        ROOM_ENEMIES[roomNumber - 1];

    roomKills = 0;

    enemies = [];
    bullets = [];
    particles = [];

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

    return Math.min(
        8 + depth * 2,
        24
    );

}


function getSpawnDelay() {

    return Math.max(
        0.18,
        0.65 - depth * 0.045
    );

}


/* =========================================================
   SPAWN ENEMY
========================================================= */

function spawnEnemy() {

    if (roomSpawned >= roomEnemiesRequired) {
        return;
    }

    if (enemies.length >= getEnemyCap()) {
        return;
    }

    const angle =
        Math.random() * Math.PI * 2;

    const worldScale =
        getWorldScale();

    const spawnDistance =
        Math.max(
            canvas.width,
            canvas.height
        ) *
        0.55 *
        worldScale;

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
        45 +
        depth * 12;

    const speed =
        70 +
        depth * 8;

    const damage =
        15 +
        depth * 2;

    enemies.push({

        x,
        y,

        radius: 15,

        health,
        maxHealth: health,

        speed,
        damage

    });

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
        player.fireRate;
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

    if (dx !== 0 || dy !== 0) {

        const length =
            Math.sqrt(dx * dx + dy * dy);

        dx /= length;
        dy /= length;

        player.x +=
            dx * player.speed * dt;

        player.y +=
            dy * player.speed * dt;
    }

    /*
        Larger rooms give the player more usable space.
    */

    const margin = 35 * getWorldScale();

    player.x = Math.max(
        margin,
        Math.min(
            canvas.width - margin,
            player.x
        )
    );

    player.y = Math.max(
        margin,
        Math.min(
            canvas.height - margin,
            player.y
        )
    );

    player.angle =
        Math.atan2(
            mouse.y - player.y,
            mouse.x - player.x
        );

    if (player.shootCooldown > 0) {
        player.shootCooldown -= dt;
    }

    if (mouse.down) {
        shoot();
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
            bullet.x < -margin ||
            bullet.x > canvas.width + margin ||
            bullet.y < -margin ||
            bullet.y > canvas.height + margin
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

                createHitParticles(
                    enemy.x,
                    enemy.y
                );

                bullets.splice(i, 1);

                if (enemy.health <= 0) {

                    killEnemy(j);

                }

                break;
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
            Math.sqrt(dx * dx + dy * dy);

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
            Contact with player does NOT count
            as a kill.
        */

        if (
             distance <
             player.radius +
             enemy.radius
         ) {
             player.health -= enemy.damage * dt;
         
             const knockback = 120 * dt;
         
             enemy.x -=
                 (dx / distance) *
                 knockback;
         
             enemy.y -=
                 (dy / distance) *
                 knockback;
         
             if (player.health <= 0) {
                 player.health = 0;
                 finishGame();
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

    const enemy = enemies[index];

    scrap +=
        Math.floor(Math.random() * 8) + 5;

    kills++;

    roomKills++;

    createExplosion(
        enemy.x,
        enemy.y
    );

    enemies.splice(index, 1);

    updateHUD();
}


/* =========================================================
   PARTICLES
========================================================= */

function createHitParticles(x, y) {

    for (let i = 0; i < 3; i++) {

        particles.push({

            x,
            y,

            vx:
                (Math.random() - 0.5) * 100,

            vy:
                (Math.random() - 0.5) * 100,

            life: 0.25

        });
    }
}


function createExplosion(x, y) {

    for (let i = 0; i < 10; i++) {

        particles.push({

            x,
            y,

            vx:
                (Math.random() - 0.5) * 220,

            vy:
                (Math.random() - 0.5) * 220,

            life: 0.5

        });
    }
}


function updateParticles(dt) {

    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {

        const particle = particles[i];

        particle.x +=
            particle.vx * dt;

        particle.y +=
            particle.vy * dt;

        particle.life -= dt;

        if (particle.life <= 0) {

            particles.splice(i, 1);
        }
    }
}


/* =========================================================
   ROOM COMPLETION
========================================================= */

function completeRoom() {
    gameRunning = false;

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
        return;
    }

    scrap -= cost;

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
        if (key === "voidRing") icon = "◎";

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
    gameRunning = false;
    gameOver = true;

    crosshair.style.display = "none";

    deathScreen.classList.remove(
        "hidden"
    );
}

/* =========================================================
   FINAL ROOM
========================================================= */

function finishRun() {

    gameRunning = false;

    clearTitle.textContent =
        "FACILITY COMPLETE";

    clearMessage.textContent =
        "You reached the bottom of the VOID.";

    clearScreen.classList.remove(
        "hidden"
    );
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    if (depthText) {
        depthText.textContent =
            `ROOM ${depth}`;
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
   DRAW ENEMIES
========================================================= */

function drawEnemies() {

    const scale =
        getWorldScale();

    for (const enemy of enemies) {

        const radius =
            enemy.radius /
            scale;

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#ff5577";

        ctx.fill();

        /*
            Health bar
        */

        const healthPercent =
            Math.max(
                0,
                enemy.health /
                enemy.maxHealth
            );

        const barWidth =
            32 / scale;

        const barHeight =
            3 / scale;

        ctx.fillStyle =
            "rgba(255,255,255,0.08)";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - radius - 9 / scale,
            barWidth,
            barHeight
        );

        ctx.fillStyle =
            "#ff5577";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - radius - 9 / scale,
            barWidth * healthPercent,
            barHeight
        );
    }
}


/* =========================================================
   DRAW PARTICLES
========================================================= */

function drawParticles() {

    const scale =
        getWorldScale();

    for (const particle of particles) {

        ctx.globalAlpha =
            Math.max(
                0,
                particle.life * 2
            );

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            2 / scale,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#72d7ff";

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================================
   DRAW
========================================================= */

function draw() {

    drawBackground();

    drawVoidRing();

    drawBullets();

    drawEnemies();

    drawParticles();

    drawPlayer();
}


/* =========================================================
   MAIN LOOP
========================================================= */

function gameLoop(timestamp) {

    const dt =
        Math.min(
            (timestamp - lastTime) / 1000,
            0.05
        );

    lastTime = timestamp;

    if (gameRunning) {

        updatePlayer(dt);

        updateBullets(dt);

        updateEnemies(dt);

        updateVoidRing(dt);

        updateParticles(dt);

        /*Spawn the fixed number of enemies assigned to this room.*/

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
    }

    draw();

    requestAnimationFrame(gameLoop);
}


/* =========================================================
   INITIALIZE
========================================================= */

updateHUD();

requestAnimationFrame(gameLoop);
