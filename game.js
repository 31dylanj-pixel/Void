/* =========================================================
   VOID — PHASE 1C
   Rooms + Upgrade System
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;
let transitioning = false;
let upgradeScreen = false;

const MAX_ROOMS = 3;

let depth = 1;
let scrap = 0;
let kills = 0;

let roomEnemiesTotal = 0;
let roomEnemiesDefeated = 0;

let lastTime = 0;
let enemySpawnTimer = 0;
let shootCooldown = 0;

let mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    down: false
};

const keys = {};

const bullets = [];
const enemies = [];
const particles = [];


/* =========================================================
   PLAYER
========================================================= */

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,

    radius: 15,

    baseSpeed: 270,
    speed: 270,

    baseDamage: 25,
    damage: 25,

    maxHealth: 100,
    health: 100,

    angle: 0
};


/* =========================================================
   ROOM DATA
========================================================= */

function getRoomEnemyCount() {

    // Room 1 = 5
    // Room 2 = 7
    // Room 3 = 9

    return 4 + depth * 2;
}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("death-screen").classList.add("hidden");
    document.getElementById("clear-screen").classList.add("hidden");
    document.getElementById("upgrade-screen").classList.add("hidden");

    resetGame();

    gameRunning = true;

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);
}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

    depth = 1;
    scrap = 0;
    kills = 0;

    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;

    transitioning = false;
    upgradeScreen = false;

    player.maxHealth = 100;
    player.health = 100;

    player.speed = 270;
    player.damage = 25;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    startRoom();
}


/* =========================================================
   START ROOM
========================================================= */

function startRoom() {

    bullets.length = 0;
    enemies.length = 0;

    roomEnemiesDefeated = 0;
    roomEnemiesTotal = getRoomEnemyCount();

    enemySpawnTimer = 0;

    updateProgress();

    document.getElementById("room-status").textContent =
        `ROOM ${depth} / ${MAX_ROOMS}`;
}


/* =========================================================
   INPUT
========================================================= */

window.addEventListener("keydown", e => {

    keys[e.key.toLowerCase()] = true;

    // Prevent page scrolling
    if (
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]
        .includes(e.key.toLowerCase())
    ) {
        e.preventDefault();
    }
});


window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});


canvas.addEventListener("mousemove", e => {

    mouse.x = e.clientX;
    mouse.y = e.clientY;

    player.angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    updateCrosshair();
});


canvas.addEventListener("mousedown", e => {

    if (e.button === 0) {
        mouse.down = true;
    }
});


canvas.addEventListener("mouseup", e => {

    if (e.button === 0) {
        mouse.down = false;
    }
});


/* =========================================================
   CROSSHAIR
========================================================= */

function updateCrosshair() {

    const crosshair = document.getElementById("crosshair");

    crosshair.style.left = `${mouse.x}px`;
    crosshair.style.top = `${mouse.y}px`;
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(time) {

    if (!gameRunning) return;

    const dt = Math.min((time - lastTime) / 1000, 0.033);

    lastTime = time;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}


/* =========================================================
   UPDATE
========================================================= */

function update(dt) {

    if (transitioning || upgradeScreen) {

        updateParticles(dt);
        draw();

        return;
    }

    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateParticles(dt);

    enemySpawnTimer -= dt;

    if (
        enemySpawnTimer <= 0 &&
        enemies.length < roomEnemiesTotal &&
        roomEnemiesDefeated < roomEnemiesTotal
    ) {

        spawnEnemy();

        enemySpawnTimer = 0.7;
    }

    shootCooldown -= dt;

    if (mouse.down && shootCooldown <= 0) {

        shoot();

        shootCooldown = 0.16;
    }

    updateHUD();

    checkRoomComplete();
}


/* =========================================================
   PLAYER MOVEMENT
========================================================= */

function updatePlayer(dt) {

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy -= 1;
    }

    if (keys["s"] || keys["arrowdown"]) {
        dy += 1;
    }

    if (keys["a"] || keys["arrowleft"]) {
        dx -= 1;
    }

    if (keys["d"] || keys["arrowright"]) {
        dx += 1;
    }

    if (dx !== 0 || dy !== 0) {

        const length = Math.sqrt(dx * dx + dy * dy);

        dx /= length;
        dy /= length;

        player.x += dx * player.speed * dt;
        player.y += dy * player.speed * dt;
    }

    player.x = Math.max(
        player.radius,
        Math.min(canvas.width - player.radius, player.x)
    );

    player.y = Math.max(
        player.radius,
        Math.min(canvas.height - player.radius, player.y)
    );
}


/* =========================================================
   SHOOTING
========================================================= */

function shoot() {

    const speed = 720;

    bullets.push({

        x: player.x + Math.cos(player.angle) * 20,
        y: player.y + Math.sin(player.angle) * 20,

        vx: Math.cos(player.angle) * speed,
        vy: Math.sin(player.angle) * speed,

        radius: 4,

        damage: player.damage
    });

    createMuzzleFlash();
}


/* =========================================================
   BULLETS
========================================================= */

function updateBullets(dt) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const bullet = bullets[i];

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        if (
            bullet.x < -50 ||
            bullet.x > canvas.width + 50 ||
            bullet.y < -50 ||
            bullet.y > canvas.height + 50
        ) {

            bullets.splice(i, 1);

            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {

            const enemy = enemies[j];

            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;

            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bullet.radius + enemy.radius) {

                enemy.health -= bullet.damage;

                bullets.splice(i, 1);

                createHitParticles(
                    bullet.x,
                    bullet.y
                );

                if (enemy.health <= 0) {

                    killEnemy(j);
                }

                break;
            }
        }
    }
}


/* =========================================================
   ENEMIES
========================================================= */

function spawnEnemy() {

    let x;
    let y;

    const side = Math.floor(Math.random() * 4);

    const padding = 60;

    if (side === 0) {

        x = Math.random() * canvas.width;
        y = -padding;

    } else if (side === 1) {

        x = canvas.width + padding;
        y = Math.random() * canvas.height;

    } else if (side === 2) {

        x = Math.random() * canvas.width;
        y = canvas.height + padding;

    } else {

        x = -padding;
        y = Math.random() * canvas.height;
    }

    enemies.push({

        x,
        y,

        radius: 17,

        health: 50 + depth * 5,

        maxHealth: 50 + depth * 5,

        speed: 65 + depth * 8,

        damage: 20
    });
}


function updateEnemies(dt) {

    for (let i = enemies.length - 1; i >= 0; i--) {

        const enemy = enemies[i];

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

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

        /* -----------------------------------------
           PLAYER CONTACT
        ----------------------------------------- */

        if (
            distance <
            player.radius + enemy.radius
        ) {

            player.health -= enemy.damage;

            createExplosion(
                enemy.x,
                enemy.y
            );

            enemies.splice(i, 1);

            roomEnemiesDefeated++;

            if (player.health <= 0) {

                player.health = 0;

                endGame();
                return;
            }
        }
    }
}


/* =========================================================
   KILL ENEMY
========================================================= */

function killEnemy(index) {

    const enemy = enemies[index];

    scrap += Math.floor(
        Math.random() * 6
    ) + 5;

    kills++;

    roomEnemiesDefeated++;

    createExplosion(
        enemy.x,
        enemy.y
    );

    enemies.splice(index, 1);
}


/* =========================================================
   ROOM PROGRESS
========================================================= */

function getRoomProgress() {

    if (roomEnemiesTotal <= 0) {
        return 0;
    }

    return Math.min(
        100,
        (roomEnemiesDefeated / roomEnemiesTotal) * 100
    );
}


function updateProgress() {

    const progress = getRoomProgress();

    const fill =
        document.getElementById("progress-fill");

    const text =
        document.getElementById("progress-text");

    fill.style.width = `${progress}%`;

    text.textContent =
        `${Math.floor(progress)}%`;
}


/* =========================================================
   ROOM COMPLETION
========================================================= */

function checkRoomComplete() {

    if (transitioning || upgradeScreen) {
        return;
    }

    if (
        roomEnemiesDefeated >= roomEnemiesTotal &&
        enemies.length === 0
    ) {

        completeRoom();
    }
}


/* =========================================================
   COMPLETE ROOM
========================================================= */

function completeRoom() {

    transitioning = true;

    // LOCK progress at exactly 100%
    document.getElementById("progress-fill").style.width = "100%";
    document.getElementById("progress-text").textContent = "100%";

    document.getElementById("room-status").textContent =
        "ROOM CLEARED";

    document.getElementById("clear-screen").classList.remove("hidden");

    document.getElementById("clear-message").textContent =
        `Sector ${depth} cleared.`;

    setTimeout(() => {

        document.getElementById("clear-screen").classList.add("hidden");

        if (depth >= MAX_ROOMS) {

            finishRun();

        } else {

            showUpgradeScreen();
        }

    }, 1200);
}


/* =========================================================
   UPGRADE SCREEN
========================================================= */

function showUpgradeScreen() {

    transitioning = false;
    upgradeScreen = true;

    document.getElementById("upgrade-screen").classList.remove("hidden");

    generateUpgrades();
}


/* =========================================================
   UPGRADE OPTIONS
========================================================= */

function generateUpgrades() {

    const upgrades = [

        {
            title: "REINFORCED CORE",

            description:
                "+20 Maximum HP",

            apply: () => {

                player.maxHealth += 20;
                player.health += 20;
            }
        },

        {
            title: "OVERDRIVE",

            description:
                "+25% Movement Speed",

            apply: () => {

                player.speed *= 1.25;
            }
        },

        {
            title: "AMPLIFIED ROUND",

            description:
                "+25% Weapon Damage",

            apply: () => {

                player.damage *= 1.25;
            }
        }
    ];

    // Shuffle
    upgrades.sort(() => Math.random() - 0.5);

    const container =
        document.getElementById("upgrade-options");

    container.innerHTML = "";

    upgrades.forEach(upgrade => {

        const button =
            document.createElement("button");

        button.className = "upgrade-card";

        button.innerHTML = `
            <div class="upgrade-title">
                ${upgrade.title}
            </div>

            <div class="upgrade-description">
                ${upgrade.description}
            </div>
        `;

        button.addEventListener("click", () => {

            upgrade.apply();

            chooseUpgrade();
        });

        container.appendChild(button);
    });
}


/* =========================================================
   CHOOSE UPGRADE
========================================================= */

function chooseUpgrade() {

    upgradeScreen = false;

    document
        .getElementById("upgrade-screen")
        .classList.add("hidden");

    depth++;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    startRoom();
}


/* =========================================================
   RUN COMPLETE
========================================================= */

function finishRun() {

    gameRunning = false;

    document
        .getElementById("clear-screen")
        .classList.remove("hidden");

    document.getElementById("clear-title").textContent =
        "VOID CONQUERED";

    document.getElementById("clear-message").textContent =
        `You survived all ${MAX_ROOMS} rooms.`;

    document.getElementById("room-status").textContent =
        "RUN COMPLETE";
}


/* =========================================================
   DEATH
========================================================= */

function endGame() {

    gameRunning = false;

    document
        .getElementById("death-screen")
        .classList.remove("hidden");

    document.getElementById("death-depth").textContent =
        depth;

    document.getElementById("death-scrap").textContent =
        scrap;

    document.getElementById("death-kills").textContent =
        kills;
}


/* =========================================================
   PARTICLES
========================================================= */

function createMuzzleFlash() {

    for (let i = 0; i < 5; i++) {

        particles.push({

            x: player.x + Math.cos(player.angle) * 22,
            y: player.y + Math.sin(player.angle) * 22,

            vx:
                Math.cos(player.angle) *
                (100 + Math.random() * 100),

            vy:
                Math.sin(player.angle) *
                (100 + Math.random() * 100),

            life: 0.15,

            maxLife: 0.15,

            radius: 3
        });
    }
}


function createHitParticles(x, y) {

    for (let i = 0; i < 5; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * 80,
            vy: Math.sin(angle) * 80,

            life: 0.25,

            maxLife: 0.25,

            radius: 2
        });
    }
}


function createExplosion(x, y) {

    for (let i = 0; i < 15; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            50 + Math.random() * 150;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            life: 0.5,

            maxLife: 0.5,

            radius: 2 + Math.random() * 3
        });
    }
}


function updateParticles(dt) {

    for (let i = particles.length - 1; i >= 0; i--) {

        const particle = particles[i];

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        particle.life -= dt;

        if (particle.life <= 0) {

            particles.splice(i, 1);
        }
    }
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    document.getElementById("depth").textContent =
        depth;

    document.getElementById("scrap").textContent =
        scrap;

    document.getElementById("health-text").textContent =
        `${Math.ceil(player.health)} / ${player.maxHealth}`;

    const healthPercent =
        Math.max(
            0,
            (player.health / player.maxHealth) * 100
        );

    document.getElementById("health-fill").style.width =
        `${healthPercent}%`;

    updateProgress();
}


/* =========================================================
   DRAW
========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /* Background */

    const gradient =
        ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            100,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width
        );

    gradient.addColorStop(0, "#0b1b2d");
    gradient.addColorStop(1, "#03060b");

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /* Grid */

    ctx.strokeStyle =
        "rgba(114,215,255,0.06)";

    ctx.lineWidth = 1;

    const gridSize = 50;

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


    /* Bullets */

    for (const bullet of bullets) {

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            bullet.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#72d7ff";

        ctx.fill();
    }


    /* Enemies */

    for (const enemy of enemies) {

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            enemy.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ff5577";

        ctx.fill();


        /* Enemy health */

        const healthPercent =
            enemy.health / enemy.maxHealth;

        ctx.fillStyle =
            "rgba(255,255,255,0.15)";

        ctx.fillRect(
            enemy.x - 20,
            enemy.y - 27,
            40,
            4
        );

        ctx.fillStyle = "#ff5577";

        ctx.fillRect(
            enemy.x - 20,
            enemy.y - 27,
            40 * healthPercent,
            4
        );
    }


    /* Player */

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(player.angle);

    ctx.beginPath();

    ctx.moveTo(21, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 11);

    ctx.closePath();

    ctx.fillStyle = "#72d7ff";

    ctx.fill();

    ctx.restore();


    /* Particles */

    for (const particle of particles) {

        const alpha =
            particle.life / particle.maxLife;

        ctx.globalAlpha = alpha;

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#72d7ff";

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener("resize", () => {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
});


/* =========================================================
   BUTTONS
========================================================= */

document
    .getElementById("start-button")
    .addEventListener("click", startGame);

document
    .getElementById("restart-button")
    .addEventListener("click", startGame);
