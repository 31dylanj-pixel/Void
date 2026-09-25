/* =========================================================
   VOID
   PHASE 2 — HARDER ROOMS + REAL KILL PROGRESS
   + SCRAP UPGRADES
   + VOID RING
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


/* =========================================================
   GAME CONFIG
========================================================= */

const MAX_ROOMS = 8;


/*
   EXACT number of actual kills required
   for each room.
*/

const ROOM_ENEMIES = [
    12,
    18,
    25,
    32,
    40,
    50,
    65,
    80
];


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;
let transitioning = false;
let upgradeScreen = false;

let depth = 1;

let scrap = 0;
let kills = 0;


/*
   IMPORTANT:

   roomEnemiesRequired
   = how many enemies must actually be killed

   roomKills
   = how many enemies have actually died
   to the player's weapon / ring
*/

let roomEnemiesRequired = 0;
let roomKills = 0;


/* Number of enemies currently alive */

let activeEnemies = 0;


let lastTime = 0;

let enemySpawnTimer = 0;

let shootCooldown = 0;


/* =========================================================
   INPUT
========================================================= */

const keys = {};

const mouse = {

    x: canvas.width / 2,

    y: canvas.height / 2,

    down: false
};


/* =========================================================
   ARRAYS
========================================================= */

const bullets = [];

const enemies = [];

const particles = [];


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

    angle: 0
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

        name: "REINFORCED CORE",

        description:
            "+20% Maximum HP",

        baseCost: 15,

        tier: 0
    },


    speed: {

        name: "OVERDRIVE",

        description:
            "+10% Movement Speed",

        baseCost: 15,

        tier: 0
    },


    damage: {

        name: "AMPLIFIED ROUND",

        description:
            "+15% Weapon Damage",

        baseCost: 20,

        tier: 0
    },


    fireRate: {

        name: "RAPID FIRE",

        description:
            "+10% Fire Rate",

        baseCost: 25,

        tier: 0
    },


    bulletSpeed: {

        name: "ACCELERATOR",

        description:
            "+15% Bullet Speed",

        baseCost: 20,

        tier: 0
    },


    multishot: {

        name: "SPLIT ROUND",

        description:
            "+1 Projectile",

        baseCost: 40,

        tier: 0
    },


    voidRing: {

        name: "VOID RING",

        description:
            tier => {

                if (tier === 0) {

                    return "Create a damaging ring around you";
                }

                return `+${Math.round(
                    15 * tier
                )}% Ring Damage / +${Math.round(
                    15 * tier
                )}% Ring Size`;
            },

        baseCost: 35,

        tier: 0
    }
};


/* =========================================================
   UPGRADE COST
========================================================= */

function getUpgradeCost(upgrade) {

    return Math.floor(

        upgrade.baseCost *

        Math.pow(
            1.5,
            upgrade.tier
        )
    );
}


/* =========================================================
   ROOM DATA
========================================================= */

function getRoomEnemyCount() {

    return ROOM_ENEMIES[
        depth - 1
    ];
}


/* =========================================================
   START
========================================================= */

function startGame() {

    document
        .getElementById("start-screen")
        .classList.add("hidden");

    document
        .getElementById("death-screen")
        .classList.add("hidden");

    document
        .getElementById("clear-screen")
        .classList.add("hidden");

    document
        .getElementById("upgrade-screen")
        .classList.add("hidden");

    resetGame();

    gameRunning = true;

    lastTime =
        performance.now();

    requestAnimationFrame(
        gameLoop
    );
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

    activeEnemies = 0;


    /* Player */

    player.maxHealth = 100;

    player.health = 100;

    player.speed = 270;

    player.damage = 25;

    player.fireRate = 0.16;

    player.bulletSpeed = 720;

    player.multishot = 1;


    /* Ring */

    voidRing.enabled = false;

    voidRing.radius = 90;

    voidRing.damage = 10;

    voidRing.cooldown = 0;


    /* Reset upgrade tiers */

    for (const key in upgrades) {

        upgrades[key].tier = 0;
    }


    player.x =
        canvas.width / 2;

    player.y =
        canvas.height / 2;


    startRoom();
}


/* =========================================================
   START ROOM
========================================================= */

function startRoom() {

    bullets.length = 0;

    enemies.length = 0;

    activeEnemies = 0;

    roomKills = 0;

    roomEnemiesRequired =
        getRoomEnemyCount();

    enemySpawnTimer = 0;


    updateProgress();

    document
        .getElementById(
            "room-status"
        )
        .textContent =
        `ROOM ${depth} / ${MAX_ROOMS}`;
}


/* =========================================================
   INPUT
========================================================= */

window.addEventListener(
    "keydown",
    e => {

        keys[
            e.key.toLowerCase()
        ] = true;

        if (
            [
                "w",
                "a",
                "s",
                "d",
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright"
            ].includes(
                e.key.toLowerCase()
            )
        ) {

            e.preventDefault();
        }
    }
);


window.addEventListener(
    "keyup",
    e => {

        keys[
            e.key.toLowerCase()
        ] = false;
    }
);


canvas.addEventListener(
    "mousemove",
    e => {

        mouse.x = e.clientX;

        mouse.y = e.clientY;

        player.angle =
            Math.atan2(

                mouse.y -
                player.y,

                mouse.x -
                player.x
            );

        updateCrosshair();
    }
);


canvas.addEventListener(
    "mousedown",
    e => {

        if (e.button === 0) {

            mouse.down = true;
        }
    }
);


canvas.addEventListener(
    "mouseup",
    e => {

        if (e.button === 0) {

            mouse.down = false;
        }
    }
);


/* =========================================================
   CROSSHAIR
========================================================= */

function updateCrosshair() {

    const crosshair =
        document.getElementById(
            "crosshair"
        );

    crosshair.style.left =
        `${mouse.x}px`;

    crosshair.style.top =
        `${mouse.y}px`;
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(time) {

    if (!gameRunning) {

        return;
    }

    const dt =
        Math.min(

            (time - lastTime) /
            1000,

            0.033
        );

    lastTime = time;

    update(dt);

    draw();

    requestAnimationFrame(
        gameLoop
    );
}


/* =========================================================
   UPDATE
========================================================= */

function update(dt) {

    if (
        transitioning ||
        upgradeScreen
    ) {

        updateParticles(dt);

        return;
    }


    updatePlayer(dt);

    updateBullets(dt);

    updateEnemies(dt);

    updateVoidRing(dt);

    updateParticles(dt);


    /*
       Keep spawning until enough
       enemies have actually been killed.

       Contact deaths do NOT increase
       roomKills, so replacements
       are created.
    */

    enemySpawnTimer -= dt;


    if (

        enemySpawnTimer <= 0 &&

        roomKills <
            roomEnemiesRequired &&

        activeEnemies <
            getMaxActiveEnemies()

    ) {

        spawnEnemy();

        enemySpawnTimer =
            getSpawnDelay();
    }


    shootCooldown -= dt;


    if (

        mouse.down &&

        shootCooldown <= 0

    ) {

        shoot();

        shootCooldown =
            player.fireRate;
    }


    updateHUD();

    checkRoomComplete();
}


/* =========================================================
   DIFFICULTY
========================================================= */

function getMaxActiveEnemies() {

    /*
       More enemies can be alive
       in later rooms.
    */

    return Math.min(
        8 + depth * 2,
        22
    );
}


function getSpawnDelay() {

    /*
       Faster spawning deeper down.
    */

    return Math.max(
        0.22,
        0.65 -
        depth * 0.045
    );
}


/* =========================================================
   PLAYER MOVEMENT
========================================================= */

function updatePlayer(dt) {

    let dx = 0;

    let dy = 0;


    if (
        keys["w"] ||
        keys["arrowup"]
    ) {

        dy--;
    }


    if (
        keys["s"] ||
        keys["arrowdown"]
    ) {

        dy++;
    }


    if (
        keys["a"] ||
        keys["arrowleft"]
    ) {

        dx--;
    }


    if (
        keys["d"] ||
        keys["arrowright"]
    ) {

        dx++;
    }


    if (
        dx !== 0 ||
        dy !== 0
    ) {

        const length =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        dx /= length;

        dy /= length;


        player.x +=
            dx *
            player.speed *
            dt;


        player.y +=
            dy *
            player.speed *
            dt;
    }


    player.x =
        Math.max(

            player.radius,

            Math.min(

                canvas.width -
                player.radius,

                player.x
            )
        );


    player.y =
        Math.max(

            player.radius,

            Math.min(

                canvas.height -
                player.radius,

                player.y
            )
        );
}


/* =========================================================
   SHOOT
========================================================= */

function shoot() {

    const spread = 0.12;


    for (
        let i = 0;
        i < player.multishot;
        i++
    ) {

        let angle =
            player.angle;


        if (
            player.multishot > 1
        ) {

            const center =
                (
                    player.multishot -
                    1
                ) / 2;

            angle +=
                (
                    i -
                    center
                ) *
                spread;
        }


        bullets.push({

            x:
                player.x +
                Math.cos(angle) *
                20,

            y:
                player.y +
                Math.sin(angle) *
                20,

            vx:
                Math.cos(angle) *
                player.bulletSpeed,

            vy:
                Math.sin(angle) *
                player.bulletSpeed,

            radius: 4,

            damage:
                player.damage
        });
    }


    createMuzzleFlash();
}


/* =========================================================
   BULLETS
========================================================= */

function updateBullets(dt) {

    for (
        let i =
            bullets.length - 1;

        i >= 0;

        i--
    ) {

        const bullet =
            bullets[i];


        bullet.x +=
            bullet.vx * dt;

        bullet.y +=
            bullet.vy * dt;


        if (

            bullet.x < -50 ||

            bullet.x >
                canvas.width + 50 ||

            bullet.y < -50 ||

            bullet.y >
                canvas.height + 50

        ) {

            bullets.splice(i, 1);

            continue;
        }


        for (
            let j =
                enemies.length - 1;

            j >= 0;

            j--
        ) {

            const enemy =
                enemies[j];


            const dx =
                bullet.x -
                enemy.x;

            const dy =
                bullet.y -
                enemy.y;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (

                distance <
                bullet.radius +
                enemy.radius

            ) {

                enemy.health -=
                    bullet.damage;


                bullets.splice(
                    i,
                    1
                );


                createHitParticles(
                    bullet.x,
                    bullet.y
                );


                if (
                    enemy.health <= 0
                ) {

                    killEnemy(j);
                }


                break;
            }
        }
    }
}


/* =========================================================
   ENEMY SPAWN
========================================================= */

function spawnEnemy() {

    let x;

    let y;


    const side =
        Math.floor(
            Math.random() * 4
        );


    const padding = 70;


    if (side === 0) {

        x =
            Math.random() *
            canvas.width;

        y = -padding;

    }

    else if (side === 1) {

        x =
            canvas.width +
            padding;

        y =
            Math.random() *
            canvas.height;

    }

    else if (side === 2) {

        x =
            Math.random() *
            canvas.width;

        y =
            canvas.height +
            padding;

    }

    else {

        x = -padding;

        y =
            Math.random() *
            canvas.height;
    }


    /*
       Enemy scaling.
    */

    const health =
        45 +
        depth * 12;


    const speed =
        70 +
        depth * 8;


    enemies.push({

        x,

        y,

        radius:
            16 +
            Math.random() * 4,

        health,

        maxHealth:
            health,

        speed,

        damage:
            15 +
            depth * 2
    });


    activeEnemies++;
}


/* =========================================================
   ENEMY UPDATE
========================================================= */

function updateEnemies(dt) {

    for (
        let i =
            enemies.length - 1;

        i >= 0;

        i--
    ) {

        const enemy =
            enemies[i];


        const dx =
            player.x -
            enemy.x;


        const dy =
            player.y -
            enemy.y;


        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (
            distance > 0
        ) {

            enemy.x +=

                (
                    dx /
                    distance
                ) *
                enemy.speed *
                dt;


            enemy.y +=

                (
                    dy /
                    distance
                ) *
                enemy.speed *
                dt;
        }


        /*
           CONTACT DAMAGE

           Enemy disappears but DOES NOT
           count toward room progress.
        */

        if (

            distance <
            player.radius +
            enemy.radius

        ) {

            player.health -=
                enemy.damage;


            createExplosion(
                enemy.x,
                enemy.y
            );


            enemies.splice(i, 1);

            activeEnemies--;


            if (
                player.health <= 0
            ) {

                player.health = 0;

                endGame();

                return;
            }
        }
    }
}


/* =========================================================
   ACTUAL ENEMY KILL
========================================================= */

function killEnemy(index) {

    const enemy =
        enemies[index];


    scrap +=

        Math.floor(
            Math.random() * 8
        ) + 5;


    kills++;


    /*
       THIS is the only thing
       that increases room progress.
    */

    roomKills++;


    createExplosion(
        enemy.x,
        enemy.y
    );


    enemies.splice(
        index,
        1
    );


    activeEnemies--;
}


/* =========================================================
   VOID RING UPDATE
========================================================= */

function updateVoidRing(dt) {

    if (
        !voidRing.enabled
    ) {

        return;
    }


    voidRing.cooldown -= dt;


    if (
        voidRing.cooldown > 0
    ) {

        return;
    }


    let hitSomething = false;


    for (
        let i =
            enemies.length - 1;

        i >= 0;

        i--
    ) {

        const enemy =
            enemies[i];


        const dx =
            enemy.x -
            player.x;


        const dy =
            enemy.y -
            player.y;


        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (

            distance <=
            voidRing.radius +
            enemy.radius

        ) {

            enemy.health -=
                voidRing.damage;


            createHitParticles(
                enemy.x,
                enemy.y
            );


            hitSomething = true;


            if (
                enemy.health <= 0
            ) {

                killEnemy(i);
            }
        }
    }


    if (hitSomething) {

        voidRing.cooldown =
            voidRing.hitCooldown;
    }
}


/* =========================================================
   PROGRESS
========================================================= */

function getRoomProgress() {

    if (
        roomEnemiesRequired <= 0
    ) {

        return 0;
    }


    /*
       ONLY actual kills count.

       This value can NEVER go
       above 100.
    */

    return Math.min(

        100,

        (
            roomKills /
            roomEnemiesRequired
        ) *
        100
    );
}


function updateProgress() {

    const progress =
        getRoomProgress();


    const fill =
        document.getElementById(
            "progress-fill"
        );


    const text =
        document.getElementById(
            "progress-text"
        );


    fill.style.width =
        `${progress}%`;


    text.textContent =
        `${Math.floor(progress)}%`;
}


/* =========================================================
   ROOM COMPLETE
========================================================= */

function checkRoomComplete() {

    if (
        transitioning ||
        upgradeScreen
    ) {

        return;
    }


    /*
       No enemies can be alive,
       and every required enemy
       must have been ACTUALLY killed.
    */

    if (

        roomKills >=
            roomEnemiesRequired &&

        enemies.length === 0

    ) {

        completeRoom();
    }
}


function completeRoom() {

    transitioning = true;


    /*
       Hard lock.
    */

    roomKills =
        roomEnemiesRequired;


    document
        .getElementById(
            "progress-fill"
        )
        .style.width =
        "100%";


    document
        .getElementById(
            "progress-text"
        )
        .textContent =
        "100%";


    document
        .getElementById(
            "room-status"
        )
        .textContent =
        "ROOM CLEARED";


    document
        .getElementById(
            "clear-screen"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "clear-message"
        )
        .textContent =
        `Sector ${depth} cleared. ${roomKills} enemies eliminated.`;


    setTimeout(() => {

        document
            .getElementById(
                "clear-screen"
            )
            .classList
            .add("hidden");


        if (
            depth >= MAX_ROOMS
        ) {

            finishRun();

        }

        else {

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


    document
        .getElementById(
            "upgrade-screen"
        )
        .classList
        .remove("hidden");


    renderUpgrades();
}


function renderUpgrades() {

    const container =
        document.getElementById(
            "upgrade-options"
        );


    container.innerHTML = "";


    document
        .getElementById(
            "upgrade-scrap"
        )
        .textContent =
        scrap;


    const keys =
        Object.keys(upgrades);


    keys.sort(
        () =>
            Math.random() - 0.5
    );


    /*
       Three random upgrade choices.
    */

    const selected =
        keys.slice(0, 3);


    selected.forEach(key => {

        const upgrade =
            upgrades[key];


        const cost =
            getUpgradeCost(
                upgrade
            );


        const card =
            document.createElement(
                "button"
            );


        card.className =
            "upgrade-card";


        const tier =
            upgrade.tier;


        let description;


        if (
            typeof upgrade.description ===
            "function"
        ) {

            description =
                upgrade.description(
                    tier
                );

        }

        else {

            description =
                upgrade.description;
        }


        const canAfford =
            scrap >= cost;


        card.innerHTML = `

            <div class="upgrade-icon">
                ${getUpgradeIcon(key)}
            </div>

            <div class="upgrade-title">
                ${upgrade.name}
            </div>

            <div class="upgrade-tier">
                TIER ${tier + 1}
            </div>

            <div class="upgrade-description">
                ${description}
            </div>

            <div class="upgrade-cost">
                ${cost} SCRAP
            </div>

        `;


        if (!canAfford) {

            card.classList.add(
                "unaffordable"
            );

        }


        card.addEventListener(
            "click",
            () => {

                buyUpgrade(key);
            }
        );


        container.appendChild(
            card
        );
    });
}


/* =========================================================
   ICONS
========================================================= */

function getUpgradeIcon(key) {

    const icons = {

        health: "◉",

        speed: "»",

        damage: "✦",

        fireRate: "≋",

        bulletSpeed: "➜",

        multishot: "✣",

        voidRing: "◎"
    };


    return (
        icons[key] ||
        "◆"
    );
}


/* =========================================================
   BUY UPGRADE
========================================================= */

function buyUpgrade(key) {

    const upgrade =
        upgrades[key];


    const cost =
        getUpgradeCost(
            upgrade
        );


    if (
        scrap < cost
    ) {

        return;
    }


    scrap -= cost;


    upgrade.tier++;


    applyUpgrade(key);


    renderUpgrades();


    updateHUD();
}


/* =========================================================
   APPLY UPGRADE
========================================================= */

function applyUpgrade(key) {

    switch (key) {


        case "health":

            player.maxHealth *=
                1.20;

            player.health =
                player.maxHealth;

            break;


        case "speed":

            player.speed *=
                1.10;

            break;


        case "damage":

            player.damage *=
                1.15;

            break;


        case "fireRate":

            player.fireRate *=
                0.90;

            break;


        case "bulletSpeed":

            player.bulletSpeed *=
                1.15;

            break;


        case "multishot":

            player.multishot++;

            break;


        case "voidRing":

            voidRing.enabled = true;


            /*
               Every tier increases
               both radius and damage.
            */

            voidRing.radius =
                90 *
                Math.pow(
                    1.15,
                    upgrades.voidRing.tier
                );


            voidRing.damage =
                10 *
                Math.pow(
                    1.15,
                    upgrades.voidRing.tier
                );

            break;
    }
}


/* =========================================================
   CONTINUE BUTTON
========================================================= */

document
    .getElementById(
        "continue-button"
    )
    .addEventListener(
        "click",
        () => {

            upgradeScreen = false;


            document
                .getElementById(
                    "upgrade-screen"
                )
                .classList
                .add("hidden");


            depth++;


            player.x =
                canvas.width / 2;

            player.y =
                canvas.height / 2;


            startRoom();
        }
    );


/* =========================================================
   FINAL RUN
========================================================= */

function finishRun() {

    gameRunning = false;


    document
        .getElementById(
            "clear-screen"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "clear-title"
        )
        .textContent =
        "VOID CONQUERED";


    document
        .getElementById(
            "clear-message"
        )
        .textContent =
        `You survived all ${MAX_ROOMS} rooms.`;


    document
        .getElementById(
            "room-status"
        )
        .textContent =
        "RUN COMPLETE";
}


/* =========================================================
   DEATH
========================================================= */

function endGame() {

    gameRunning = false;


    document
        .getElementById(
            "death-screen"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "death-depth"
        )
        .textContent =
        depth;


    document
        .getElementById(
            "death-scrap"
        )
        .textContent =
        scrap;


    document
        .getElementById(
            "death-kills"
        )
        .textContent =
        kills;
}


/* =========================================================
   PARTICLES
========================================================= */

function createMuzzleFlash() {

    for (
        let i = 0;
        i < 5;
        i++
    ) {

        particles.push({

            x:
                player.x +
                Math.cos(
                    player.angle
                ) * 22,

            y:
                player.y +
                Math.sin(
                    player.angle
                ) * 22,

            vx:
                Math.cos(
                    player.angle
                ) *
                (
                    100 +
                    Math.random() *
                    100
                ),

            vy:
                Math.sin(
                    player.angle
                ) *
                (
                    100 +
                    Math.random() *
                    100
                ),

            life: 0.15,

            maxLife: 0.15,

            radius: 3
        });
    }
}


function createHitParticles(
    x,
    y
) {

    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;


        particles.push({

            x,

            y,

            vx:
                Math.cos(angle) *
                80,

            vy:
                Math.sin(angle) *
                80,

            life: 0.25,

            maxLife: 0.25,

            radius: 2
        });
    }
}


function createExplosion(
    x,
    y
) {

    for (
        let i = 0;
        i < 15;
        i++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2;


        const speed =
            50 +
            Math.random() *
            150;


        particles.push({

            x,

            y,

            vx:
                Math.cos(angle) *
                speed,

            vy:
                Math.sin(angle) *
                speed,

            life: 0.5,

            maxLife: 0.5,

            radius:
                2 +
                Math.random() * 3
        });
    }
}


function updateParticles(
    dt
) {

    for (
        let i =
            particles.length - 1;

        i >= 0;

        i--
    ) {

        const particle =
            particles[i];


        particle.x +=
            particle.vx * dt;


        particle.y +=
            particle.vy * dt;


        particle.life -= dt;


        if (
            particle.life <= 0
        ) {

            particles.splice(
                i,
                1
            );
        }
    }
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    document
        .getElementById(
            "depth"
        )
        .textContent =
        depth;


    document
        .getElementById(
            "scrap"
        )
        .textContent =
        scrap;


    document
        .getElementById(
            "health-text"
        )
        .textContent =

        `${Math.ceil(
            player.health
        )} / ${Math.ceil(
            player.maxHealth
        )}`;


    const healthPercent =
        Math.max(

            0,

            (
                player.health /
                player.maxHealth
            ) *
            100
        );


    document
        .getElementById(
            "health-fill"
        )
        .style.width =
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


    /* =====================================================
       BACKGROUND
    ===================================================== */

    const gradient =
        ctx.createRadialGradient(

            canvas.width / 2,

            canvas.height / 2,

            100,

            canvas.width / 2,

            canvas.height / 2,

            canvas.width
        );


    gradient.addColorStop(
        0,
        "#0b1b2d"
    );


    gradient.addColorStop(
        1,
        "#03060b"
    );


    ctx.fillStyle =
        gradient;


    ctx.fillRect(

        0,
        0,

        canvas.width,
        canvas.height
    );


    /* =====================================================
       GRID
    ===================================================== */

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

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            canvas.height
        );

        ctx.stroke();
    }


    for (
        let y = 0;

        y < canvas.height;

        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            canvas.width,
            y
        );

        ctx.stroke();
    }


    /* =====================================================
       VOID RING
    ===================================================== */

    if (
        voidRing.enabled
    ) {

        ctx.beginPath();

        ctx.arc(

            player.x,

            player.y,

            voidRing.radius,

            0,

            Math.PI * 2
        );


        ctx.strokeStyle =
            "rgba(114,215,255,0.35)";


        ctx.lineWidth = 2;


        ctx.stroke();


        ctx.beginPath();

        ctx.arc(

            player.x,

            player.y,

            voidRing.radius,

            0,

            Math.PI * 2
        );


        ctx.strokeStyle =
            "rgba(114,215,255,0.08)";


        ctx.lineWidth = 8;


        ctx.stroke();
    }


    /* =====================================================
       BULLETS
    ===================================================== */

    for (
        const bullet of bullets
    ) {

        ctx.beginPath();

        ctx.arc(

            bullet.x,

            bullet.y,

            bullet.radius,

            0,

            Math.PI * 2
        );


        ctx.fillStyle =
            "#72d7ff";


        ctx.fill();
    }


    /* =====================================================
       ENEMIES
    ===================================================== */

    for (
        const enemy of enemies
    ) {

        ctx.beginPath();

        ctx.arc(

            enemy.x,

            enemy.y,

            enemy.radius,

            0,

            Math.PI * 2
        );


        ctx.fillStyle =
            "#ff5577";


        ctx.fill();


        /* Enemy HP */

        const healthPercent =
            Math.max(

                0,

                enemy.health /
                enemy.maxHealth
            );


        ctx.fillStyle =
            "rgba(255,255,255,0.15)";


        ctx.fillRect(

            enemy.x - 20,

            enemy.y - 27,

            40,

            4
        );


        ctx.fillStyle =
            "#ff5577";


        ctx.fillRect(

            enemy.x - 20,

            enemy.y - 27,

            40 *
            healthPercent,

            4
        );
    }


    /* =====================================================
       PLAYER — CIRCULAR CORE
    ===================================================== */

    ctx.save();


    ctx.translate(

        player.x,

        player.y
    );


    /*
       Outer glow
    */

    ctx.beginPath();

    ctx.arc(

        0,
        0,

        player.radius + 9,

        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        "rgba(114,215,255,0.07)";


    ctx.fill();


    /*
       Outer circle
    */

    ctx.beginPath();

    ctx.arc(

        0,
        0,

        player.radius,

        0,
        Math.PI * 2
    );


    ctx.strokeStyle =
        "#72d7ff";


    ctx.lineWidth = 3;


    ctx.stroke();


    /*
       Inner circle
    */

    ctx.beginPath();

    ctx.arc(

        0,
        0,

        7,

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

        Math.cos(
            player.angle
        ) * 9,

        Math.sin(
            player.angle
        ) * 9
    );


    ctx.lineTo(

        Math.cos(
            player.angle
        ) * 22,

        Math.sin(
            player.angle
        ) * 22
    );


    ctx.strokeStyle =
        "#72d7ff";


    ctx.lineWidth = 3;


    ctx.stroke();


    ctx.restore();


    /* =====================================================
       PARTICLES
    ===================================================== */

    for (
        const particle of particles
    ) {

        const alpha =
            particle.life /
            particle.maxLife;


        ctx.globalAlpha =
            alpha;


        ctx.beginPath();

        ctx.arc(

            particle.x,

            particle.y,

            particle.radius,

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
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        canvas.width =
            window.innerWidth;

        canvas.height =
            window.innerHeight;


        player.x =
            canvas.width / 2;

        player.y =
            canvas.height / 2;
    }
);


/* =========================================================
   BUTTONS
========================================================= */

document
    .getElementById(
        "start-button"
    )
    .addEventListener(
        "click",
        startGame
    );


document
    .getElementById(
        "restart-button"
    )
    .addEventListener(
        "click",
        startGame
    );
