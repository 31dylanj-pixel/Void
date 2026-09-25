# VOID

> Descend. Survive. Adapt.

VOID is a browser-based top-down roguelite built with HTML, CSS, and JavaScript.

You wake up inside an endless underground facility with no clear explanation of how you got there. Each room becomes more dangerous as you descend. Fight enemies, collect scrap, upgrade your equipment, and keep moving deeper.

---

## Gameplay

VOID is built around a simple loop:

1. Enter a room
2. Fight enemies
3. Collect scrap
4. Choose upgrades
5. Enter the next room
6. Survive increasingly difficult encounters
7. Reach the bottom

Enemies that collide with the player damage them but do not count toward the room's required kills.

---

## Features

- Top-down canvas-based gameplay
- WASD movement
- Mouse aiming
- Click to fire
- Multiple projectiles
- Increasing enemy difficulty
- Scrap currency
- Upgrade system
- Upgrade tiers
- Increasing upgrade costs
- Void Ring ability
- 10 progressively harder rooms
- Increasing enemy counts
- Expanding-feeling arenas
- Room transition screens
- Health system
- Particle effects
- Dark sci-fi interface
- Responsive fullscreen canvas

---

## Rooms

The current room requirements are:

| Room | Required Kills |
|------|----------------|
| 1 | 12 |
| 2 | 18 |
| 3 | 25 |
| 4 | 32 |
| 5 | 40 |
| 6 | 50 |
| 7 | 65 |
| 8 | 80 |
| 9 | 100 |
| 10 | 125 |

Later rooms increase both the number and difficulty of enemies.

---

## Controls

| Control | Action |
|---------|--------|
| W | Move up |
| A | Move left |
| S | Move down |
| D | Move right |
| Mouse | Aim |
| Left Click | Fire |
| R | Restart after death |

---

## Upgrade System

Scrap can be spent at the upgrade station between rooms.

### Core
Increases maximum health by 20%.

### Thrust
Increases movement speed by 10%.

### Weapon
Increases weapon damage by 15%.

### Overdrive
Increases firing speed by 10%.

### Velocity
Increases projectile speed by 15%.

### Split Round
Adds an additional projectile.

### Void Ring
Creates a damaging ring around the player.

Each upgrade has tiers, and upgrade costs increase as the tier increases.

---

## Void Ring

The Void Ring surrounds the player and damages enemies that enter its radius.

Each successive Void Ring upgrade increases:

- Damage
- Ring size

The ability becomes increasingly useful as enemy numbers increase.

---

## Room Scaling

As the player descends, the game world gradually becomes larger.

Instead of changing the physical browser canvas, the game scales the world so that:

- The player appears slightly smaller
- Enemies appear slightly smaller
- The grid spacing increases
- More movement space is available
- The Void Ring scales with the world

This makes later rooms feel more open without requiring the browser window to change size.

---

## Technology

VOID is built using:

- HTML5
- CSS3
- JavaScript
- HTML Canvas
- Google Fonts

### Fonts

The interface uses:

- **Montserrat** for general UI and headings
- **Orbitron** for futuristic HUD elements and system labels

Orbitron is a geometric sans-serif typeface designed by Matt McInerney and distributed under the SIL Open Font License. 

---

## Project Structure

```text
VOID/
│
├── index.html
├── style.css
├── game.js
└── README.md
