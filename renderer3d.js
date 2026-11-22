/* =========================================================
   VOID — RENDERER3D.JS
   Three.js renderer for the game.

   game.js keeps all gameplay logic in 2D pixel coordinates.
   This module reads that state every frame and draws it as a
   lit 3D scene: a top-down perspective camera whose z = 0 plane
   maps 1:1 onto screen pixels, so aiming and collisions stay exact.

   If Three.js cannot load (offline, blocked CDN, no WebGL) this
   module reports failure and game.js keeps using its 2D renderer.
========================================================= */

async function boot() {

    const THREE = await import("three");
    const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
    const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
    const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
    const { ShaderPass } = await import("three/addons/postprocessing/ShaderPass.js");
    const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");

    return createRenderer(THREE, {
        EffectComposer,
        RenderPass,
        UnrealBloomPass,
        ShaderPass,
        OutputPass
    });
}

function announce(api) {
    window.VoidRenderer = api;
    window.dispatchEvent(new Event("voidrenderer"));
}

boot().then(announce).catch(error => {
    console.warn("VOID: Three.js renderer unavailable, using 2D fallback.", error);
    announce({ ready: false, failed: true });
});


function createRenderer(THREE, Addons) {

    const glCanvas = document.getElementById("gl-canvas");

    const renderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance"
    });

    renderer.setClearColor(0x050912, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();

    const FOV = 40;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 8000);

    let W = 0;
    let H = 0;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let camDistance = 1000;

    /* ---------- post-processing ---------- */

    const target = new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType,
        samples: 4
    });

    const composer = new Addons.EffectComposer(renderer, target);
    composer.addPass(new Addons.RenderPass(scene, camera));

    const bloomPass = new Addons.UnrealBloomPass(
        new THREE.Vector2(256, 256),
        0.9,
        0.55,
        0.7
    );
    composer.addPass(bloomPass);

    const finishPass = new Addons.ShaderPass({
        uniforms: {
            tDiffuse: { value: null },
            uTime: { value: 0 },
            uFlash: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D tDiffuse;
            uniform float uTime;
            uniform float uFlash;

            void main() {
                vec2 c = vUv - 0.5;
                float d = dot(c, c);

                vec2 off = c * d * (0.035 + uFlash * 0.05);

                float r = texture2D(tDiffuse, vUv + off).r;
                float g = texture2D(tDiffuse, vUv).g;
                float b = texture2D(tDiffuse, vUv - off).b;

                vec3 col = vec3(r, g, b);

                col *= 1.0 - smoothstep(0.18, 0.75, d) * 0.55;
                col += vec3(1.0, 0.04, 0.12) * uFlash * smoothstep(0.05, 0.5, d) * 0.9;

                float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
                col += (n - 0.5) * 0.012;

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    composer.addPass(finishPass);
    composer.addPass(new Addons.OutputPass());


    /* ---------- helpers ---------- */

    const colorCache = new Map();

    function rgb(hex) {
        let c = colorCache.get(hex);
        if (!c) {
            c = new THREE.Color(hex);
            colorCache.set(hex, c);
        }
        return c;
    }

    function hdr(hex, k) {
        return rgb(hex).clone().multiplyScalar(k);
    }

    const zAxis = new THREE.Vector3(0, 0, 1);
    const tmpQuat = new THREE.Quaternion();
    const tmpPos = new THREE.Vector3();
    const tmpScale = new THREE.Vector3();
    const tmpMat = new THREE.Matrix4();

    const toX = x => x - W / 2;
    const toY = y => H / 2 - y;


    /* ---------- lights ---------- */

    scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x120a24, 0.9));

    const keyLight = new THREE.DirectionalLight(0xbfd8ff, 1.6);
    keyLight.position.set(-0.5, 0.7, 1.0);
    scene.add(keyLight);

    const playerLight = new THREE.PointLight(0x72d7ff, 22000, 0, 2);
    playerLight.position.set(0, 0, 110);
    scene.add(playerLight);


    /* ---------- floor ---------- */

    const floorMaterial = new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: {
            uRes: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uGrid: { value: 70 },
            uPlayer: { value: new THREE.Vector2(0, 0) },
            uTint: { value: new THREE.Color(0.25, 0.7, 1.0) },
            uFlash: { value: 0 },
            uLight: { value: 1 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec2 uRes;
            uniform float uTime;
            uniform float uGrid;
            uniform vec2 uPlayer;
            uniform vec3 uTint;
            uniform float uFlash;
            uniform float uLight;

            float gridLine(vec2 p, float size, float w) {
                vec2 q = p / size;
                vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(0.0001));
                float l = min(g.x, g.y);
                return 1.0 - clamp(l / w, 0.0, 1.0);
            }

            void main() {
                vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
                vec2 center = uRes * 0.5;
                float d = length(p - center) / length(center);

                vec3 col = vec3(0.010, 0.017, 0.040);
                col += uTint * 0.035 * (1.0 - d);

                float minor = gridLine(p, uGrid, 1.1);
                float major = gridLine(p, uGrid * 4.0, 1.5);

                float pd = length(p - uPlayer);
                float light = exp(-(pd * pd) / (2.0 * 280.0 * 280.0)) * uLight;

                col += uTint * (minor * 0.05 + major * 0.11) * (0.55 + light * 2.4);
                col += uTint * light * 0.05;

                float pulse = fract(uTime * 0.10);
                float ring = abs(d - pulse);
                col += uTint * 0.06 * (1.0 - smoothstep(0.0, 0.03, ring)) * (1.0 - pulse);

                col += vec3(0.6, 0.04, 0.1) * uFlash * 0.12;
                col *= 1.0 - 0.5 * smoothstep(0.55, 1.2, d);

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMaterial);
    floor.renderOrder = -10;
    floor.frustumCulled = false;
    scene.add(floor);


    /* ---------- soft glowing points (dust + game particles) ---------- */

    function makePointCloud(capacity) {

        const geometry = new THREE.BufferGeometry();

        const position = new Float32Array(capacity * 3);
        const color = new Float32Array(capacity * 3);
        const size = new Float32Array(capacity);
        const alpha = new Float32Array(capacity);

        geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
        geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
        geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
        geometry.setDrawRange(0, 0);

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uPx: { value: pixelRatio },
                uDist: { value: camDistance }
            },
            vertexShader: `
                attribute vec3 aColor;
                attribute float aSize;
                attribute float aAlpha;
                uniform float uPx;
                uniform float uDist;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    vColor = aColor;
                    vAlpha = aAlpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = max(1.0, aSize * uPx * (uDist / -mv.z));
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    float a = smoothstep(0.5, 0.0, d);
                    a *= a;
                    gl_FragColor = vec4(vColor, a * vAlpha);
                }
            `
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;

        return { points, geometry, material, position, color, size, alpha, capacity };
    }

    const DUST_COUNT = 160;
    const dust = makePointCloud(DUST_COUNT);
    dust.points.renderOrder = -5;
    scene.add(dust.points);

    const dustData = [];
    for (let i = 0; i < DUST_COUNT; i++) {
        dustData.push({
            x: Math.random(),
            y: Math.random(),
            z: 12 + Math.random() * 110,
            vx: (Math.random() - 0.5) * 0.01,
            vy: -0.004 - Math.random() * 0.012,
            size: 1.4 + Math.random() * 2.6,
            phase: Math.random() * 6.28
        });
    }

    const sparks = makePointCloud(2000);
    sparks.points.renderOrder = 20;
    scene.add(sparks.points);


    /* ---------- instanced bullets ---------- */

    const BULLET_CAP = 500;

    const bulletMesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 10, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 3.2, 3.8) }),
        BULLET_CAP
    );
    bulletMesh.count = 0;
    bulletMesh.frustumCulled = false;
    scene.add(bulletMesh);

    const ENEMY_BULLET_CAP = 700;

    const enemyBulletMesh = new THREE.InstancedMesh(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.55, 1.0) }),
        ENEMY_BULLET_CAP
    );
    enemyBulletMesh.count = 0;
    enemyBulletMesh.frustumCulled = false;
    scene.add(enemyBulletMesh);


    /* ---------- shared geometries ---------- */

    const geo = {
        ico0: new THREE.IcosahedronGeometry(1, 0),
        ico1: new THREE.IcosahedronGeometry(1, 1),
        dodeca: new THREE.DodecahedronGeometry(1, 0),
        octa: new THREE.OctahedronGeometry(1, 0),
        sphere: new THREE.SphereGeometry(1, 18, 12),
        sphereLow: new THREE.SphereGeometry(1, 12, 8),
        hex: new THREE.CylinderGeometry(0.95, 1, 0.8, 6).rotateX(Math.PI / 2),
        dart: new THREE.ConeGeometry(0.85, 2.0, 4).rotateZ(-Math.PI / 2),
        ship: new THREE.ConeGeometry(0.9, 2.2, 3).rotateZ(-Math.PI / 2),
        barrel: new THREE.BoxGeometry(1, 0.22, 0.22).translate(0.5, 0, 0),
        torus: new THREE.TorusGeometry(1, 0.28, 10, 40),
        ringThin: new THREE.TorusGeometry(1, 0.03, 6, 72),
        ringMed: new THREE.TorusGeometry(1, 0.06, 8, 72),
        arc: new THREE.TorusGeometry(1, 0.014, 6, 36, 1.7),
        ringFlat: new THREE.RingGeometry(0.9, 1, 72)
    };

    const edgeCache = new Map();

    function edgesOf(geometry) {
        let e = edgeCache.get(geometry.uuid);
        if (!e) {
            e = new THREE.EdgesGeometry(geometry, 20);
            edgeCache.set(geometry.uuid, e);
        }
        return e;
    }

    function wireOf(geometry) {
        let e = edgeCache.get("w" + geometry.uuid);
        if (!e) {
            e = new THREE.WireframeGeometry(geometry);
            edgeCache.set("w" + geometry.uuid, e);
        }
        return e;
    }

    function makeArcRing(material) {
        const group = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const arc = new THREE.Mesh(geo.arc, material);
            arc.rotation.z = (i * Math.PI * 2) / 3;
            group.add(arc);
        }
        return group;
    }


    /* ---------- player ---------- */

    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const playerBodyMat = new THREE.MeshStandardMaterial({
        color: 0x0c1c30,
        emissive: rgb("#72d7ff").clone(),
        emissiveIntensity: 0.45,
        metalness: 0.8,
        roughness: 0.3,
        flatShading: true
    });

    const playerEdgeMat = new THREE.LineBasicMaterial({
        color: hdr("#72d7ff", 2.6)
    });

    const playerShip = new THREE.Group();
    playerGroup.add(playerShip);

    const shipBody = new THREE.Mesh(geo.ship, playerBodyMat);
    playerShip.add(shipBody);
    playerShip.add(new THREE.LineSegments(edgesOf(geo.ship), playerEdgeMat));

    const shipCore = new THREE.Mesh(
        geo.sphereLow,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 3.4, 4.2) })
    );
    shipCore.scale.setScalar(0.34);
    playerShip.add(shipCore);

    const playerRingMat = new THREE.MeshBasicMaterial({
        color: hdr("#72d7ff", 1.7),
        transparent: true,
        opacity: 0.9
    });
    const playerRing = new THREE.Mesh(geo.ringMed, playerRingMat);
    playerRing.scale.setScalar(1.45);
    playerGroup.add(playerRing);

    const shieldMat = new THREE.MeshBasicMaterial({
        color: hdr("#72d7ff", 1.4),
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
    });
    const shieldMesh = new THREE.Mesh(geo.ico1, shieldMat);
    shieldMesh.visible = false;
    playerGroup.add(shieldMesh);

    /* void ring (upgrade) */
    const voidRingMat = new THREE.MeshBasicMaterial({
        color: hdr("#72d7ff", 1.6),
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const voidRingGroup = makeArcRing(voidRingMat);
    const voidRingDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 56),
        new THREE.MeshBasicMaterial({
            color: hdr("#72d7ff", 0.5),
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    voidRingGroup.add(voidRingDisc);
    voidRingGroup.visible = false;
    scene.add(voidRingGroup);


    /* ---------- enemies ---------- */

    const enemyRecords = new Map();
    let frameId = 0;

    function addEdges(parent, geometry, material, wire) {
        const lines = new THREE.LineSegments(
            wire ? wireOf(geometry) : edgesOf(geometry),
            material
        );
        parent.add(lines);
        return lines;
    }

    function makeEnemy(type, data) {

        const shiny = type.indexOf("shiny") === 0;
        const kind = shiny
            ? type.charAt(5).toLowerCase() + type.slice(6)
            : type;

        const col = rgb(data.color);

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x0b1424,
            emissive: col.clone(),
            emissiveIntensity: 0.35,
            metalness: 0.55,
            roughness: 0.4,
            flatShading: true
        });
        const edgeMat = new THREE.LineBasicMaterial({
            color: col.clone().multiplyScalar(2.4)
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: col.clone().multiplyScalar(2.2)
        });
        const ringMat = new THREE.MeshBasicMaterial({
            color: col.clone().multiplyScalar(1.5),
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });

        const group = new THREE.Group();
        const spin = new THREE.Group();
        const aim = new THREE.Group();
        group.add(spin);
        group.add(aim);

        const rec = {
            group, spin, aim,
            bodyMat, edgeMat, coreMat, ringMat,
            color: col,
            kind,
            shiny,
            hue: Math.random(),
            age: 0,
            lastHealth: -1,
            flash: 0,
            ring: null,
            orbiters: [],
            tumble: [0.7, 0.5, 0.3],
            baseEmissive: 0.35
        };

        switch (kind) {

            case "crawler": {
                spin.add(new THREE.Mesh(geo.ico0, bodyMat));
                addEdges(spin, geo.ico0, edgeMat);
                const core = new THREE.Mesh(geo.sphereLow, coreMat);
                core.scale.setScalar(0.34);
                spin.add(core);
                break;
            }

            case "splitter": {
                spin.add(new THREE.Mesh(geo.dodeca, bodyMat));
                addEdges(spin, geo.dodeca, edgeMat);
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    const pod = new THREE.Mesh(geo.ico0, coreMat);
                    pod.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.2);
                    pod.scale.setScalar(0.2);
                    spin.add(pod);
                }
                rec.tumble = [0.25, 0.2, 0.45];
                break;
            }

            case "gunner": {
                spin.add(new THREE.Mesh(geo.hex, bodyMat));
                addEdges(spin, geo.hex, edgeMat);
                const core = new THREE.Mesh(geo.sphereLow, coreMat);
                core.scale.setScalar(0.3);
                core.position.z = 0.4;
                spin.add(core);
                const barrel = new THREE.Mesh(
                    geo.barrel,
                    new THREE.MeshStandardMaterial({
                        color: 0xd9e6ef, metalness: 0.9, roughness: 0.25,
                        emissive: 0x335566, emissiveIntensity: 0.6
                    })
                );
                barrel.scale.set(1.45, 1.4, 1.4);
                aim.add(barrel);
                rec.tumble = [0, 0, 0.4];
                break;
            }

            case "voidling": {
                spin.add(new THREE.Mesh(geo.sphereLow, bodyMat));
                addEdges(spin, geo.sphereLow, edgeMat, true);
                const core = new THREE.Mesh(geo.sphereLow, coreMat);
                core.scale.setScalar(0.4);
                spin.add(core);

                for (let i = 0; i < 2; i++) {
                    const orbit = new THREE.Mesh(geo.ringThin, ringMat);
                    orbit.scale.setScalar(1.35);
                    orbit.rotation.x = i === 0 ? 1.1 : -0.6;
                    orbit.rotation.y = i * 1.2;
                    rec.orbiters.push(orbit);
                    spin.add(orbit);
                }

                const barrel = new THREE.Mesh(
                    geo.barrel,
                    new THREE.MeshStandardMaterial({
                        color: 0xd9e6ef, metalness: 0.9, roughness: 0.25
                    })
                );
                barrel.scale.set(1.45, 1.2, 1.2);
                aim.add(barrel);

                rec.ring = makeArcRing(ringMat);
                rec.ring.scale.setScalar(2.2);
                group.add(rec.ring);
                rec.tumble = [0.2, 0.3, 0.3];
                break;
            }

            case "stalker": {
                aim.add(new THREE.Mesh(geo.dart, bodyMat));
                addEdges(aim, geo.dart, edgeMat);
                const core = new THREE.Mesh(geo.sphereLow, coreMat);
                core.scale.setScalar(0.28);
                core.position.x = -0.15;
                aim.add(core);
                rec.tumble = [0, 0, 0];
                break;
            }

            case "boss": {
                spin.add(new THREE.Mesh(geo.ico1, bodyMat));
                addEdges(spin, geo.ico1, edgeMat);

                const dark = new THREE.Mesh(
                    geo.sphere,
                    new THREE.MeshBasicMaterial({ color: 0x02050a })
                );
                dark.scale.setScalar(0.45);
                dark.position.z = 0.55;
                group.add(dark);

                const eye = new THREE.Mesh(geo.sphereLow, coreMat);
                eye.scale.setScalar(0.22);
                eye.position.z = 0.8;
                group.add(eye);

                for (let i = 0; i < 8; i++) {
                    const a = (i - 3.5) * 0.075;
                    const turret = new THREE.Group();
                    turret.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.45);
                    turret.rotation.z = a;

                    const base = new THREE.Mesh(geo.sphereLow, coreMat);
                    base.scale.setScalar(0.11);
                    turret.add(base);

                    const gun = new THREE.Mesh(
                        geo.barrel,
                        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.0, 2.4) })
                    );
                    gun.scale.set(0.24, 0.35, 0.35);
                    turret.add(gun);
                    aim.add(turret);
                }

                for (let i = 0; i < 2; i++) {
                    const orbit = new THREE.Mesh(geo.ringThin, ringMat);
                    orbit.scale.setScalar(1.3 + i * 0.15);
                    orbit.rotation.x = 1.2 - i * 0.5;
                    rec.orbiters.push(orbit);
                    spin.add(orbit);
                }

                rec.ring = makeArcRing(ringMat);
                rec.ring.scale.setScalar(2.2);
                group.add(rec.ring);
                rec.tumble = [0.06, 0.08, 0.12];
                break;
            }

            case "halo": {
                const body = new THREE.Mesh(
                    geo.torus,
                    new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.0) })
                );
                body.scale.setScalar(0.85);
                spin.add(body);

                const inner = new THREE.Mesh(geo.ico1, bodyMat);
                inner.scale.setScalar(0.5);
                spin.add(inner);
                addEdges(inner, geo.ico1, edgeMat);

                const barrel = new THREE.Mesh(
                    geo.barrel,
                    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6) })
                );
                barrel.scale.set(1.3, 1.6, 1.6);
                aim.add(barrel);

                rec.ring = makeArcRing(ringMat);
                rec.ring.scale.setScalar(2.2);
                group.add(rec.ring);
                rec.tumble = [0.3, 0.2, 0.5];
                break;
            }

            default: {
                spin.add(new THREE.Mesh(geo.ico0, bodyMat));
                addEdges(spin, geo.ico0, edgeMat);
            }
        }

        if (shiny) {
            /* a bright glint orbits shiny enemies */
            const glint = new THREE.Mesh(
                geo.sphereLow,
                new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) })
            );
            glint.scale.setScalar(0.14);
            rec.glint = glint;
            group.add(glint);
            rec.baseEmissive = 0.7;
            bodyMat.emissiveIntensity = 0.7;
        }

        return rec;
    }

    function disposeEnemy(rec) {
        rec.bodyMat.dispose();
        rec.edgeMat.dispose();
        rec.coreMat.dispose();
        rec.ringMat.dispose();
    }

    function updateEnemies(s, dt) {

        frameId++;

        const viz = s.viz;
        const player = s.player;

        if (!s.menu) {
            for (const enemy of s.enemies) {

                const data = s.enemyTypes[enemy.type];
                if (!data) {
                    continue;
                }

                let rec = enemyRecords.get(enemy);

                if (!rec) {
                    rec = makeEnemy(enemy.type, data);
                    rec.lastHealth = enemy.health;
                    enemyRecords.set(enemy, rec);
                    scene.add(rec.group);
                }

                rec.frame = frameId;
                rec.age += dt;

                if (enemy.health < rec.lastHealth - 0.01) {
                    rec.flash = 1;
                }
                rec.lastHealth = enemy.health;
                rec.flash = Math.max(0, rec.flash - dt * 7);

                const R = enemy.radius * viz;
                const t = Math.min(1, rec.age / 0.35);
                const ease = 1 - Math.pow(1 - t, 3);

                rec.group.position.set(toX(enemy.x), toY(enemy.y), R * 0.55);
                rec.group.scale.setScalar(Math.max(0.001, R * ease));

                const time = s.time;
                rec.spin.rotation.x = time * rec.tumble[0] + rec.hue * 6;
                rec.spin.rotation.y = time * rec.tumble[1];
                rec.spin.rotation.z = time * rec.tumble[2];

                const aimAngle = -Math.atan2(
                    player.y - enemy.y,
                    player.x - enemy.x
                );
                rec.aim.rotation.z = aimAngle;

                if (rec.kind === "stalker") {
                    rec.aim.rotation.x = Math.sin(time * 6 + rec.hue * 10) * 0.25;
                }

                if (rec.ring) {
                    rec.ring.rotation.z = time * 0.9 + rec.hue * 6;
                }

                for (let i = 0; i < rec.orbiters.length; i++) {
                    rec.orbiters[i].rotation.z = time * (i % 2 ? -1.2 : 0.9);
                }

                if (rec.glint) {
                    const a = time * 3 + rec.hue * 6;
                    rec.glint.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.7);
                }

                /* colors + hit flash */
                if (rec.shiny) {
                    rec.edgeMat.color.setHSL((time * 0.35 + rec.hue) % 1, 1, 0.6)
                        .multiplyScalar(2.2 + rec.flash * 4);
                    rec.bodyMat.emissive.setHSL((time * 0.35 + rec.hue) % 1, 0.9, 0.5);
                } else {
                    rec.edgeMat.color.copy(rec.color).multiplyScalar(2.4 + rec.flash * 5);
                }
                rec.bodyMat.emissiveIntensity = rec.baseEmissive + rec.flash * 2.2;
            }
        }

        for (const [enemy, rec] of enemyRecords) {
            if (rec.frame !== frameId) {
                scene.remove(rec.group);
                disposeEnemy(rec);
                enemyRecords.delete(enemy);
            }
        }
    }


    /* ---------- pickups ---------- */

    const pickupRecords = new Map();

    function makePickup(info) {

        const col = rgb(info.color);
        const group = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x0b1424,
            emissive: col.clone(),
            emissiveIntensity: 1.2,
            metalness: 0.4,
            roughness: 0.3,
            flatShading: true
        });
        const ringMat = new THREE.MeshBasicMaterial({
            color: col.clone().multiplyScalar(2),
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });

        const body = new THREE.Mesh(geo.octa, bodyMat);
        body.scale.setScalar(9);
        group.add(body);

        const ring = new THREE.Mesh(geo.ringMed, ringMat);
        ring.scale.setScalar(19);
        group.add(ring);

        return { group, body, ring, bodyMat, ringMat };
    }

    function updatePickups(s) {

        frameId++;

        const viz = Math.max(0.6, s.viz);

        if (!s.menu) {
            for (const pickup of s.pickups) {

                const info = s.pickupTypes[pickup.type];
                let rec = pickupRecords.get(pickup);

                if (!rec) {
                    rec = makePickup(info);
                    pickupRecords.set(pickup, rec);
                    scene.add(rec.group);
                }

                rec.frame = frameId;

                const remaining = pickup.life - pickup.age;
                const blinkOff = remaining < 3 && Math.floor(pickup.age * 8) % 2 === 0;

                rec.group.visible = !blinkOff;
                rec.group.position.set(
                    toX(pickup.x),
                    toY(pickup.y),
                    16 + Math.sin(s.time * 3 + pickup.x) * 4
                );
                rec.group.scale.setScalar(viz);
                rec.body.rotation.z = s.time * 1.6;
                rec.body.rotation.x = s.time * 1.1;
                rec.ring.rotation.x = 1.0;
                rec.ring.rotation.z = s.time * -1.3;
            }
        }

        for (const [pickup, rec] of pickupRecords) {
            if (rec.frame !== frameId) {
                scene.remove(rec.group);
                rec.bodyMat.dispose();
                rec.ringMat.dispose();
                pickupRecords.delete(pickup);
            }
        }
    }


    /* ---------- effect rings (pool) ---------- */

    const FX_POOL = 48;
    const fxPool = [];

    for (let i = 0; i < FX_POOL; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(2, 2, 2),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo.ringFlat, material);
        mesh.visible = false;
        mesh.renderOrder = 15;
        scene.add(mesh);
        fxPool.push(mesh);
    }

    function updateEffects(s) {

        let used = 0;

        if (!s.menu || s.effects.length) {
            for (const fx of s.effects) {

                if (used >= FX_POOL) {
                    break;
                }

                const mesh = fxPool[used++];
                const t = 1 - fx.life / fx.maxLife;
                const fade = Math.pow(Math.max(0, 1 - t), 1.6);
                const radius = Math.max(1, fx.radius * (0.15 + t * 0.85));

                mesh.visible = true;
                mesh.position.set(toX(fx.x), toY(fx.y), 4);
                mesh.scale.set(radius, radius, 1);
                mesh.material.color.copy(rgb(fx.color)).multiplyScalar(2.2);
                mesh.material.opacity = fade * 0.9;
            }
        }

        for (let i = used; i < FX_POOL; i++) {
            fxPool[i].visible = false;
        }
    }


    /* ---------- particles ---------- */

    function updateParticles(s) {

        const cloud = sparks;
        const list = s.particles;
        const n = Math.min(list.length, cloud.capacity);
        const viz = s.viz;

        for (let i = 0; i < n; i++) {

            const p = list[i];
            const maxLife = p.maxLife || 0.5;
            const life = Math.max(0, Math.min(1, p.life / maxLife));
            const c = rgb(p.color || (p.type === "explosion" ? "#ffb347" : "#72d7ff"));

            cloud.position[i * 3] = toX(p.x);
            cloud.position[i * 3 + 1] = toY(p.y);
            cloud.position[i * 3 + 2] = 8;

            cloud.color[i * 3] = c.r * 1.8;
            cloud.color[i * 3 + 1] = c.g * 1.8;
            cloud.color[i * 3 + 2] = c.b * 1.8;

            cloud.size[i] = (p.size || 2) * 3.2 * viz * (0.4 + life * 0.6);
            cloud.alpha[i] = life * life;
        }

        cloud.geometry.setDrawRange(0, n);
        cloud.geometry.attributes.position.needsUpdate = true;
        cloud.geometry.attributes.aColor.needsUpdate = true;
        cloud.geometry.attributes.aSize.needsUpdate = true;
        cloud.geometry.attributes.aAlpha.needsUpdate = true;
    }

    function updateDust(s, dt, tint) {

        for (let i = 0; i < DUST_COUNT; i++) {

            const d = dustData[i];

            d.x += d.vx * dt;
            d.y += d.vy * dt;

            if (d.x < -0.02) d.x += 1.04;
            if (d.x > 1.02) d.x -= 1.04;
            if (d.y < -0.02) d.y += 1.04;

            const twinkle = 0.55 + 0.45 * Math.sin(s.time * 1.3 + d.phase);

            dust.position[i * 3] = (d.x - 0.5) * W;
            dust.position[i * 3 + 1] = (d.y - 0.5) * H;
            dust.position[i * 3 + 2] = d.z;

            dust.color[i * 3] = 0.55 + tint.r * 0.9;
            dust.color[i * 3 + 1] = 0.55 + tint.g * 0.9;
            dust.color[i * 3 + 2] = 0.65 + tint.b * 0.9;

            dust.size[i] = d.size;
            dust.alpha[i] = 0.16 + twinkle * 0.2;
        }

        dust.geometry.setDrawRange(0, DUST_COUNT);
        dust.geometry.attributes.position.needsUpdate = true;
        dust.geometry.attributes.aColor.needsUpdate = true;
        dust.geometry.attributes.aSize.needsUpdate = true;
        dust.geometry.attributes.aAlpha.needsUpdate = true;
    }


    /* ---------- bullets ---------- */

    function updateBullets(s) {

        const viz = s.viz;
        const list = s.menu ? [] : s.bullets;
        const n = Math.min(list.length, BULLET_CAP);

        for (let i = 0; i < n; i++) {

            const b = list[i];
            const r = b.radius * viz;

            tmpPos.set(toX(b.x), toY(b.y), 10);
            tmpQuat.setFromAxisAngle(zAxis, Math.atan2(-b.vy, b.vx));
            tmpScale.set(r * 3.4, r * 1.15, r * 1.15);
            tmpMat.compose(tmpPos, tmpQuat, tmpScale);
            bulletMesh.setMatrixAt(i, tmpMat);
        }

        bulletMesh.count = n;
        bulletMesh.instanceMatrix.needsUpdate = true;

        const eList = s.menu ? [] : s.enemyBullets;
        const m = Math.min(eList.length, ENEMY_BULLET_CAP);

        for (let i = 0; i < m; i++) {

            const b = eList[i];
            const r = (b.radius + 1.5) * viz;

            tmpPos.set(toX(b.x), toY(b.y), 10);
            tmpQuat.setFromAxisAngle(zAxis, s.time * 6 + i);
            tmpScale.set(r, r, r);
            tmpMat.compose(tmpPos, tmpQuat, tmpScale);
            enemyBulletMesh.setMatrixAt(i, tmpMat);
        }

        enemyBulletMesh.count = m;
        enemyBulletMesh.instanceMatrix.needsUpdate = true;
    }


    /* ---------- player ---------- */

    function updatePlayer(s) {

        const p = s.player;
        const show = !s.menu && !p.dead;
        const viz = s.viz;

        playerGroup.visible = show;
        playerLight.intensity = show ? 22000 : 0;
        voidRingGroup.visible = show && s.voidRing.enabled;

        if (!show) {
            return;
        }

        const r = p.radius * viz;
        const x = toX(p.x);
        const y = toY(p.y);

        playerGroup.position.set(x, y, 10);
        playerGroup.scale.setScalar(r);

        playerShip.rotation.z = -p.angle;
        playerShip.rotation.x = Math.sin(s.time * 2.2) * 0.12;

        const dashing = p.dashTime > 0;
        playerShip.scale.set(dashing ? 1.6 : 1, dashing ? 0.7 : 1, 1);

        playerBodyMat.emissiveIntensity = dashing ? 2.2 : 0.45;
        playerEdgeMat.color.copy(rgb("#72d7ff")).multiplyScalar(dashing ? 5 : 2.6);

        playerRing.rotation.z = s.time * 0.8;

        const invulnBlink = p.invuln > 0 && !dashing &&
            Math.floor(s.time * 20) % 2 === 0;
        playerRingMat.opacity = invulnBlink ? 0.25 : 0.9;

        shieldMesh.visible = s.shieldPoints > 0;
        if (shieldMesh.visible) {
            shieldMesh.scale.setScalar(2.1 + Math.sin(s.time * 5) * 0.05);
            shieldMesh.rotation.z = s.time * 0.7;
            shieldMesh.rotation.x = s.time * 0.5;
            shieldMat.opacity = Math.min(0.55, 0.15 + s.shieldPoints / 100);
        }

        playerLight.position.set(x, y, 110);
        playerLight.color.set(s.rapid ? 0xffd24a : 0x72d7ff);

        if (s.voidRing.enabled) {
            const vr = s.voidRing.radius;
            voidRingGroup.position.set(x, y, 2);
            voidRingGroup.scale.set(vr, vr, 1);
            voidRingGroup.rotation.z = s.time * 0.8;
        }
    }


    /* ---------- menu: the void ---------- */

    const voidCore = new THREE.Group();
    scene.add(voidCore);

    const horizon = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    voidCore.add(horizon);

    const glowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uColor: { value: new THREE.Color(0.55, 0.3, 1.0) }
        },
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            uniform vec3 uColor;
            void main() {
                float f = pow(1.0 - abs(vNormal.z), 3.0);
                gl_FragColor = vec4(uColor * f * 2.4, f);
            }
        `
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.07, 48, 32), glowMaterial);
    voidCore.add(glow);

    const diskMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec2 vPos;
            void main() {
                vPos = position.xy;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vPos;
            uniform float uTime;

            void main() {
                float r = length(vPos);
                float a = atan(vPos.y, vPos.x);
                float t = clamp((r - 1.25) / 1.45, 0.0, 1.0);

                float swirl = sin(a * 5.0 - uTime * 1.4 + r * 7.0) * 0.5 + 0.5;
                float bands = sin(r * 38.0 - uTime * 2.2) * 0.5 + 0.5;

                float alpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.65, 1.0, t));

                vec3 hot = vec3(1.0, 0.72, 0.4);
                vec3 cold = vec3(0.42, 0.2, 1.0);
                vec3 col = mix(hot, cold, t) * (0.45 + swirl * 0.9 + bands * 0.35) * 2.3;

                gl_FragColor = vec4(col, alpha * 0.85);
            }
        `
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.7, 128, 1), diskMaterial);
    disk.rotation.x = 1.12;
    voidCore.add(disk);

    const lensMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.6, 1.1, 2.4),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const lens = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.018, 8, 128), lensMaterial);
    lens.rotation.x = 0.12;
    voidCore.add(lens);

    voidCore.visible = false;

    function updateVoidCore(s, dt) {

        voidCore.visible = s.menu;

        if (!s.menu) {
            return;
        }

        const R = Math.min(W, H) * 0.13;
        voidCore.scale.setScalar(R);
        voidCore.position.set(0, H * 0.04, 0);

        const mx = (s.mouse.x / W - 0.5);
        const my = (s.mouse.y / H - 0.5);

        voidCore.rotation.y += ((mx * 0.5) - voidCore.rotation.y) * Math.min(1, dt * 3);
        voidCore.rotation.x += ((my * 0.35) - voidCore.rotation.x) * Math.min(1, dt * 3);

        diskMaterial.uniforms.uTime.value = s.time;
        disk.rotation.z = s.time * 0.05;
    }


    /* ---------- depth tint ---------- */

    const tint = new THREE.Color(0.25, 0.7, 1.0);
    const tintTarget = new THREE.Color();

    const palette = [
        new THREE.Color(0.25, 0.7, 1.0),
        new THREE.Color(0.55, 0.35, 1.0),
        new THREE.Color(1.0, 0.25, 0.45)
    ];

    function depthColor(depth) {
        const t = Math.min(1, Math.max(0, (depth - 1) / 14)) * 2;
        const i = Math.min(1, Math.floor(t));
        return tintTarget.copy(palette[i]).lerp(palette[i + 1], t - i);
    }


    /* ---------- resize ---------- */

    function resize(width, height) {

        W = width;
        H = height;

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(W, H, false);

        composer.setPixelRatio(pixelRatio);
        composer.setSize(W, H);

        camDistance = (H / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

        camera.aspect = W / H;
        camera.position.z = camDistance;
        camera.updateProjectionMatrix();

        floor.scale.set(W, H, 1);
        floorMaterial.uniforms.uRes.value.set(W, H);

        dust.material.uniforms.uPx.value = pixelRatio;
        dust.material.uniforms.uDist.value = camDistance;
        sparks.material.uniforms.uPx.value = pixelRatio;
        sparks.material.uniforms.uDist.value = camDistance;
    }


    /* ---------- public API ---------- */

    let enabled = true;
    let lowQuality = false;
    let time = 0;
    let broken = false;

    const api = {

        ready: true,
        failed: false,

        setOptions(options) {

            if (typeof options.bloom === "boolean") {
                bloomPass.enabled = options.bloom;
            }

            if (typeof options.enabled === "boolean") {
                enabled = options.enabled;
                glCanvas.style.visibility = enabled ? glCanvas.style.visibility : "hidden";
            }

            if (typeof options.lowQuality === "boolean" && options.lowQuality !== lowQuality) {
                lowQuality = options.lowQuality;
                pixelRatio = lowQuality
                    ? 1
                    : Math.min(window.devicePixelRatio || 1, 2);
                if (W && H) {
                    resize(W, H);
                }
            }
        },

        render(s, dt) {

            if (!enabled || broken) {
                glCanvas.style.visibility = "hidden";
                return;
            }

            try {

                if (s.width !== W || s.height !== H) {
                    resize(s.width, s.height);
                }

                time += dt;

                camera.position.x = -s.shakeX;
                camera.position.y = s.shakeY;

                tint.lerp(depthColor(s.menu ? 1 : s.depth), 1 - Math.exp(-dt * 2));

                floorMaterial.uniforms.uTime.value = s.time;
                floorMaterial.uniforms.uGrid.value = 70 * s.scale;
                floorMaterial.uniforms.uTint.value.copy(tint);
                floorMaterial.uniforms.uFlash.value = s.hitFlash;
                floorMaterial.uniforms.uLight.value = s.menu ? 0 : 1;
                floorMaterial.uniforms.uPlayer.value.set(s.player.x, s.player.y);

                updateDust(s, dt, tint);
                updateVoidCore(s, dt);
                updatePlayer(s);
                updateEnemies(s, dt);
                updatePickups(s);
                updateBullets(s);
                updateEffects(s);
                updateParticles(s);

                finishPass.uniforms.uTime.value = s.time % 100;
                finishPass.uniforms.uFlash.value = s.hitFlash;

                composer.render(dt);

                glCanvas.style.visibility = "visible";

            } catch (error) {

                console.error("VOID: 3D renderer failed, switching to 2D.", error);
                broken = true;
                api.ready = false;
                api.failed = true;
                glCanvas.style.visibility = "hidden";
                window.dispatchEvent(new Event("voidrenderer"));
            }
        }
    };

    glCanvas.style.visibility = "hidden";

    return api;
}
