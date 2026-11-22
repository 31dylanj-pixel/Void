# VOID

> Descend. Survive. Adapt.

VOID is a browser-based top-down sci-fi roguelite set inside an unknown underground facility. Fight through 15 increasingly dangerous rooms, gather scrap, build upgrades, and try to reach the bottom.

## Run the game

Serve the folder from GitHub Pages or another static web server. The Three.js renderer needs a browser with WebGL and an internet connection because it loads the pinned Three.js 0.160.0 modules from jsDelivr. If WebGL, the CDN, or browser module loading is unavailable (for example, when opened directly as a `file://` page), the game automatically falls back to its original 2D canvas renderer.

## Controls

| Control | Action |
| --- | --- |
| W, A, S, D | Move |
| Mouse | Aim |
| Hold left click | Fire |
| Space or Shift | Dash through danger; briefly invulnerable |
| P or Escape | Pause and resume |

Sound effects and music are generated in the browser (no audio files) and can be toggled in Settings.
| R | Restart after death |

## Run loop

1. Enter a room and defeat its enemies.
2. Collect scrap, pickups, and kill-combo points.
3. Choose equipment upgrades at the station.
4. Descend into the next room. Enemy types and pressure increase with depth.

The run ends on death or after room 15. Best score, deepest room, and total kills are saved in the browser when storage is available.

## Pickups

| Pickup | Effect |
| --- | --- |
| Repair | Restores up to 25% of maximum health |
| Overclock | Increases firing speed for 8 seconds |
| Shield | Adds temporary damage-absorbing shield |
| Pulse | Damages nearby enemies and clears nearby enemy bullets |

Enemies can drop pickups. More dangerous enemies are more likely to drop them. Pickups drift toward a nearby player and expire if left behind.

## Upgrades

The existing Core, Thrust, Weapon, Overdrive, Velocity, Split Round, Explosive Bullets, and Void Ring upgrades remain. Two new upgrades are available:

- **Nano Repair** — restores health over time after you avoid damage for a short period.
- **Dash Core** — reduces the dash cooldown.

## Main menu and settings

The menu includes a field manual, settings, and saved run records. Settings include bloom/glow, screen shake, damage numbers, 3D graphics, and low-quality rendering. These preferences save between visits. Press P or Escape to pause a run; the pause screen can resume, restart, or return to the main menu.

## Graphics and fonts

The optional Three.js renderer draws a perspective-lit grid arena, floating dust, a procedural black-hole menu scene, geometric enemy models, glowing pickups, particles, and bloom/vignette post-processing. It uses no external art assets. The original 2D canvas renderer remains available in settings as a fallback.

- **Orbitron** — headings, buttons, and HUD labels.
- **EB Garamond** — body copy and longer descriptions.

Both fonts are loaded from Google Fonts; system fallbacks are included.

## Files

- `index.html` — screen layout and font / Three.js imports.
- `style.css` — interface and menu styling.
- `game.js` — game logic and the classic 2D renderer.
- `renderer3d.js` — optional Three.js scene and renderer.
