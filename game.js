/* =========================================================
   VOID
   Phase 1A
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const container = document.getElementById("game-container");

const depthElement = document.getElementById("depth");
const scrapElement = document.getElementById("scrap");
const roomStatus = document.getElementById("room-status");

const healthFill = document.getElementById("health-fill");
const healthText = document.getElementById("health-text");

const crosshair = document.getElementById("crosshair");

const startScreen = document.getElementById("start-screen");
const deathScreen = document.getElementById("death-screen");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const finalDepth = document.getElementById("final-depth");
const finalScrap = document.getElementById("final-scrap");
const finalKills = document.getElementById("final-kills");


/* =========================================================
   CANVAS
========================================================= */

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;

let depth = 1;
let scrap = 0;
let kills = 0;

let lastTime = 0;

let enemySpawnTimer = 0;
let shootCooldown = 0;

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

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

    speed: 270,

    maxHealth: 100,
    health: 100,

    angle: 0
};


/* =========================================================
   INPUT
========================================================= */

window.addEventListener("keydown", event => {

    keys[event.key.toLowerCase()] = true;

});

window.addEventListener("keyup", event => {

    keys[event.key.toLowerCase()] = false;

});

canvas.addEventListener("mousemove", event => {

    mouseX = event.clientX;
    mouseY = event.clientY;

    crosshair.style.left = `${mouseX}px`;
    crosshair.style.top = `${mouseY}px`;

});

canvas.addEventListener("mousedown", event => {

    if (event.button === 0) {
        shoot();
    }

});


/* =========================================================
   START / RESTART
========================================================= */

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);


function startGame() {

    startScreen.classList.add("hidden");
    deathScreen.classList.add("hidden");

    resetGame();

    gameRunning = true;

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);

}


function resetGame() {

    depth = 1;
    scrap = 0;
    kills = 0;

    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    player.health = player.maxHealth;

    enemySpawnTimer = 0;

    updateHUD();

}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {

    if (!gameRunning) {
        return;
    }

    const deltaTime = Math.min(
        (timestamp - lastTime) / 1000,
        0.05
    );

    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);

}


/* =========================================================
   UPDATE
========================================================= */

function update(deltaTime) {

    updatePlayer(deltaTime);

    updateBullets(deltaTime);

    updateEnemies(deltaTime);

    updateParticles(deltaTime);

    spawnEnemies(deltaTime);

    shootCooldown -= deltaTime;

    updateHUD();

}


/* =========================================================
   PLAYER MOVEMENT
========================================================= */

function updatePlayer(deltaTime) {

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

    const length = Math.hypot(dx, dy);

    if (length > 0) {

        dx /= length;
        dy /= length;

        player.x += dx * player.speed * deltaTime;
        player.y += dy * player.speed * deltaTime;

    }

    const margin = 30;

    player.x = Math.max(
        margin,
        Math.min(canvas.width - margin, player.x)
    );

    player.y = Math.max(
        margin,
        Math.min(canvas.height - margin, player.y)
    );

    player.angle = Math.atan2(
        mouseY - player.y,
        mouseX - player.x
    );

}


/* =========================================================
   SHOOTING
========================================================= */

function shoot() {

    if (!gameRunning) {
        return;
    }

    if (shootCooldown > 0) {
        return;
    }

    shootCooldown = 0.16;

    const angle = player.angle;

    bullets.push({
        x: player.x + Math.cos(angle) * 20,
        y: player.y + Math.sin(angle) * 20,

        vx: Math.cos(angle) * 720,
        vy: Math.sin(angle) * 720,

        radius: 4,

        life: 1
    });

    createMuzzleParticles();

}


/* =========================================================
   BULLETS
========================================================= */

function updateBullets(deltaTime) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const bullet = bullets[i];

        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;

        bullet.life -= deltaTime;

        if (
            bullet.life <= 0 ||
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

            const distance = Math.hypot(
                bullet.x - enemy.x,
                bullet.y - enemy.y
            );

            if (distance < bullet.radius + enemy.radius) {

                enemy.health -= 25;

                createHitParticles(
                    bullet.x,
                    bullet.y
                );

                bullets.splice(i, 1);

                if (enemy.health <= 0) {

                    scrap += enemy.scrap;

                    kills++;

                    createExplosion(
                        enemy.x,
                        enemy.y
                    );

                    enemies.splice(j, 1);

                }

                break;
            }

        }

    }

}


/* =========================================================
   ENEMIES
========================================================= */

function spawnEnemies(deltaTime) {

    enemySpawnTimer -= deltaTime;

    if (enemySpawnTimer > 0) {
        return;
    }

    enemySpawnTimer = Math.max(
        0.55,
        1.35 - depth * 0.03
    );

    spawnEnemy();

}


function spawnEnemy() {

    const side = Math.floor(Math.random() * 4);

    let x;
    let y;

    const padding = 50;

    if (side === 0) {
        x = -padding;
        y = Math.random() * canvas.height;
    }

    else if (side === 1) {
        x = canvas.width + padding;
        y = Math.random() * canvas.height;
    }

    else if (side === 2) {
        x = Math.random() * canvas.width;
        y = -padding;
    }

    else {
        x = Math.random() * canvas.width;
        y = canvas.height + padding;
    }

    enemies.push({

        x,
        y,

        radius: 13,

        speed: 65 + depth * 2,

        health: 50 + depth * 3,

        maxHealth: 50 + depth * 3,

        damage: 10,

        scrap: 5 + Math.floor(Math.random() * 6)

    });

}


function updateEnemies(deltaTime) {

    for (let i = enemies.length - 1; i >= 0; i--) {

        const enemy = enemies[i];

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;

        const distance = Math.hypot(dx, dy);

        if (distance > 0) {

            enemy.x +=
                (dx / distance) *
                enemy.speed *
                deltaTime;

            enemy.y +=
                (dy / distance) *
                enemy.speed *
                deltaTime;

        }

        if (
            distance <
            player.radius + enemy.radius
        ) {

            player.health -=
                enemy.damage * deltaTime;

            if (player.health <= 0) {

                player.health = 0;

                endGame();

            }

        }

    }

}


/* =========================================================
   PARTICLES
========================================================= */

function createMuzzleParticles() {

    for (let i = 0; i < 5; i++) {

        particles.push({

            x:
                player.x +
                Math.cos(player.angle) * 22,

            y:
                player.y +
                Math.sin(player.angle) * 22,

            vx:
                Math.cos(player.angle) *
                (80 + Math.random() * 100),

            vy:
                Math.sin(player.angle) *
                (80 + Math.random() * 100),

            life: 0.18,

            maxLife: 0.18,

            size: 2 + Math.random() * 2

        });

    }

}


function createHitParticles(x, y) {

    for (let i = 0; i < 7; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            50 + Math.random() * 100;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            life: 0.3,

            maxLife: 0.3,

            size: 2 + Math.random() * 2

        });

    }

}


function createExplosion(x, y) {

    for (let i = 0; i < 18; i++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            50 + Math.random() * 180;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            life: 0.5 + Math.random() * 0.3,

            maxLife: 0.8,

            size: 2 + Math.random() * 3

        });

    }

}


function updateParticles(deltaTime) {

    for (let i = particles.length - 1; i >= 0; i--) {

        const particle = particles[i];

        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;

        particle.vx *= 0.96;
        particle.vy *= 0.96;

        particle.life -= deltaTime;

        if (particle.life <= 0) {

            particles.splice(i, 1);

        }

    }

}


/* =========================================================
   DRAW
========================================================= */

function draw() {

    drawBackground();

    drawArena();

    drawParticles();

    drawBullets();

    drawEnemies();

    drawPlayer();

}


/* =========================================================
   BACKGROUND
========================================================= */

function drawBackground() {

    ctx.fillStyle = "#050912";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.7
    );

    gradient.addColorStop(
        0,
        "rgba(20, 45, 70, 0.28)"
    );

    gradient.addColorStop(
        1,
        "rgba(0, 0, 0, 0)"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

}


/* =========================================================
   ARENA
========================================================= */

function drawArena() {

    const gridSize = 60;

    ctx.strokeStyle =
        "rgba(114, 215, 255, 0.035)";

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
   PLAYER
========================================================= */

function drawPlayer() {

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(player.angle);

    /* Glow */

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        player.radius + 8,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "rgba(114, 215, 255, 0.08)";

    ctx.fill();


    /* Body */

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        player.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#dceeff";

    ctx.fill();


    /* Weapon */

    ctx.fillStyle = "#72d7ff";

    ctx.fillRect(
        7,
        -3,
        18,
        6
    );


    /* Center */

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        5,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#72d7ff";

    ctx.fill();

    ctx.restore();

}


/* =========================================================
   BULLETS
========================================================= */

function drawBullets() {

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

        ctx.shadowBlur = 12;
        ctx.shadowColor = "#72d7ff";

        ctx.fill();

        ctx.shadowBlur = 0;

    }

}


/* =========================================================
   ENEMIES
========================================================= */

function drawEnemies() {

    for (const enemy of enemies) {

        /* Body */

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            enemy.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#182434";

        ctx.fill();

        ctx.strokeStyle =
            "rgba(255, 85, 119, 0.8)";

        ctx.lineWidth = 2;

        ctx.stroke();


        /* Core */

        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            4,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ff5577";

        ctx.fill();


        /* Health bar */

        const barWidth = 26;

        const healthPercent =
            Math.max(
                0,
                enemy.health / enemy.maxHealth
            );

        ctx.fillStyle =
            "rgba(255,255,255,0.08)";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - 22,
            barWidth,
            3
        );

        ctx.fillStyle = "#ff5577";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - 22,
            barWidth * healthPercent,
            3
        );

    }

}


/* =========================================================
   PARTICLES
========================================================= */

function drawParticles() {

    for (const particle of particles) {

        const alpha =
            Math.max(
                0,
                particle.life / particle.maxLife
            );

        ctx.globalAlpha = alpha;

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#72d7ff";

        ctx.fill();

    }

    ctx.globalAlpha = 1;

}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    depthElement.textContent =
        String(depth).padStart(2, "0");

    scrapElement.textContent =
        scrap.toLocaleString();

    roomStatus.textContent =
        `ROOM ${String(depth).padStart(2, "0")}`;

    const healthPercent =
        player.health / player.maxHealth * 100;

    healthFill.style.width =
        `${Math.max(0, healthPercent)}%`;

    healthText.textContent =
        `${Math.ceil(player.health)} / ${player.maxHealth}`;

}


/* =========================================================
   DEATH
========================================================= */

function endGame() {

    if (!gameRunning) {
        return;
    }

    gameRunning = false;

    finalDepth.textContent =
        String(depth).padStart(2, "0");

    finalScrap.textContent =
        scrap.toLocaleString();

    finalKills.textContent =
        kills;

    deathScreen.classList.remove("hidden");

}


/* =========================================================
   INITIAL STATE
========================================================= */

crosshair.style.left =
    `${mouseX}px`;

crosshair.style.top =
    `${mouseY}px`;
