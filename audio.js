/* =========================================================
   VOID AUDIO - all sound is synthesised with Web Audio.
   No audio files are needed.
========================================================= */
(function () {
    "use strict";

    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = null;
    let master = null, sfxBus = null, musicBus = null, noiseBuf = null;
    const opts = { sfx: true, music: true };
    let mode = "menu";            // "menu" | "game" | "off"
    let timer = null, nextTime = 0, step = 0;
    const lastPlayed = {};

    function init() {
        if (ctx || !AC) return;
        try {
            ctx = new AC();
        } catch (e) { ctx = null; return; }

        master = ctx.createGain();
        master.gain.value = 0.8;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = opts.sfx ? 0.55 : 0;
        sfxBus.connect(master);

        musicBus = ctx.createGain();
        musicBus.gain.value = opts.music ? 0.32 : 0;
        musicBus.connect(master);

        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

        startMusicLoop();
    }

    function resume() {
        init();
        if (ctx && ctx.state === "suspended") ctx.resume();
    }

    /* ---------- helpers ---------- */

    function tone(freq, dur, o) {
        if (!ctx || !opts.sfx && !(o && o.bus)) return;
        o = o || {};
        const t = (o.when || ctx.currentTime);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = o.type || "sine";
        osc.frequency.setValueAtTime(freq, t);
        if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
        const vol = o.vol == null ? 0.3 : o.vol;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        let out = g;
        if (o.filter) {
            const f = ctx.createBiquadFilter();
            f.type = o.filterType || "lowpass";
            f.frequency.value = o.filter;
            g.connect(f);
            out = f;
        }
        out.connect(o.bus || sfxBus);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    function noise(dur, o) {
        if (!ctx || !opts.sfx) return;
        o = o || {};
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = o.type || "lowpass";
        f.frequency.setValueAtTime(o.freq || 1200, t);
        if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweep), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(o.vol == null ? 0.3 : o.vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(sfxBus);
        src.start(t);
        src.stop(t + dur + 0.05);
    }

    /* limit how often one sound can fire so a busy fight is not harsh */
    function gate(name, ms) {
        const now = performance.now();
        if (lastPlayed[name] && now - lastPlayed[name] < ms) return false;
        lastPlayed[name] = now;
        return true;
    }

    /* ---------- sound effects ---------- */

    const sfx = {
        shoot() {
            if (!gate("shoot", 45)) return;
            tone(780 + Math.random() * 80, 0.09, { type: "square", slide: 260, vol: 0.07, filter: 3000 });
        },
        hit() {
            if (!gate("hit", 40)) return;
            tone(300, 0.05, { type: "triangle", slide: 150, vol: 0.12 });
        },
        kill() {
            if (!gate("kill", 30)) return;
            noise(0.22, { freq: 2400, sweep: 200, vol: 0.28 });
            tone(170, 0.2, { type: "sawtooth", slide: 45, vol: 0.2, filter: 900 });
        },
        hurt() {
            if (!gate("hurt", 120)) return;
            noise(0.25, { freq: 700, sweep: 120, vol: 0.45 });
            tone(120, 0.3, { type: "sawtooth", slide: 50, vol: 0.3, filter: 500 });
        },
        dash() {
            noise(0.28, { type: "bandpass", freq: 500, sweep: 3200, vol: 0.3 });
        },
        pickup() {
            const t = ctx ? ctx.currentTime : 0;
            tone(660, 0.12, { type: "triangle", vol: 0.2, when: t });
            tone(990, 0.18, { type: "triangle", vol: 0.2, when: t + 0.07 });
        },
        scrap() {
            if (!gate("scrap", 50)) return;
            tone(1400 + Math.random() * 300, 0.07, { type: "sine", vol: 0.1 });
        },
        pulse() {
            noise(0.7, { freq: 1800, sweep: 80, vol: 0.5 });
            tone(90, 0.7, { type: "sine", slide: 30, vol: 0.5 });
        },
        explosion() {
            if (!gate("explosion", 60)) return;
            noise(0.35, { freq: 1500, sweep: 100, vol: 0.3 });
            tone(100, 0.3, { type: "sine", slide: 40, vol: 0.3 });
        },
        roomClear() {
            const t = ctx ? ctx.currentTime : 0;
            [523, 659, 784, 1047].forEach((f, i) =>
                tone(f, 0.35, { type: "triangle", vol: 0.2, when: t + i * 0.1 }));
        },
        upgrade() {
            const t = ctx ? ctx.currentTime : 0;
            tone(440, 0.12, { type: "square", vol: 0.1, filter: 2500, when: t });
            tone(660, 0.12, { type: "square", vol: 0.1, filter: 2500, when: t + 0.08 });
            tone(880, 0.3, { type: "square", vol: 0.1, filter: 2500, when: t + 0.16 });
        },
        deny() {
            tone(160, 0.18, { type: "square", slide: 110, vol: 0.12, filter: 800 });
        },
        click() {
            tone(520, 0.06, { type: "triangle", vol: 0.15 });
        },
        roomStart() {
            tone(110, 0.8, { type: "sawtooth", slide: 220, vol: 0.18, filter: 700, attack: 0.3 });
        },
        death() {
            noise(1.4, { freq: 1500, sweep: 60, vol: 0.5 });
            tone(220, 1.5, { type: "sawtooth", slide: 35, vol: 0.35, filter: 600 });
        },
        victory() {
            const t = ctx ? ctx.currentTime : 0;
            [523, 659, 784, 1047, 1319].forEach((f, i) =>
                tone(f, 0.6, { type: "triangle", vol: 0.22, when: t + i * 0.15 }));
        }
    };

    /* ---------- music: a slow minor-key loop ---------- */

    // A minor, one chord per bar (8 steps per bar)
    const CHORDS = [
        [110.0, 130.8, 164.8],   // Am
        [87.3, 130.8, 174.6],    // Fmaj
        [98.0, 123.5, 146.8],    // G
        [82.4, 123.5, 164.8]     // Em
    ];
    const ARP = [0, 1, 2, 1, 2, 1, 0, 1];
    let pad = null;

    function startPad() {
        if (pad || !ctx) return;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 500;
        const oscs = [0, 7, -7].map((det, i) => {
            const o = ctx.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = i === 0 ? 55 : 110;
            o.detune.value = det;
            o.connect(f);
            o.start();
            return o;
        });
        f.connect(g);
        g.connect(musicBus);
        pad = { g, f, oscs };
    }

    function stepMs() { return mode === "game" ? 0.2 : 0.34; }

    function scheduleStep(t) {
        const bar = Math.floor(step / 8) % CHORDS.length;
        const chord = CHORDS[bar];
        const s = step % 8;

        if (pad) {
            const root = chord[0] / 2;
            pad.oscs[0].frequency.setTargetAtTime(root, t, 0.4);
            pad.oscs[1].frequency.setTargetAtTime(root * 2, t, 0.4);
            pad.oscs[2].frequency.setTargetAtTime(root * 2, t, 0.4);
        }

        // arpeggio
        const note = chord[ARP[s]] * 2;
        tone(note, stepMs() * 1.8, {
            type: "triangle", vol: mode === "game" ? 0.16 : 0.12,
            when: t, bus: musicBus, filter: 2200
        });

        if (mode === "game") {
            // pulse bass on the beat and a soft hat off-beat
            if (s % 2 === 0) {
                tone(chord[0] / 2, stepMs() * 1.6, {
                    type: "sine", slide: chord[0] / 2.6, vol: 0.4, when: t, bus: musicBus
                });
            }
            if (s % 2 === 1 && ctx) {
                const src = ctx.createBufferSource();
                src.buffer = noiseBuf;
                const hp = ctx.createBiquadFilter();
                hp.type = "highpass"; hp.frequency.value = 7000;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.06, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                src.connect(hp); hp.connect(g); g.connect(musicBus);
                src.start(t); src.stop(t + 0.07);
            }
        }
        step++;
    }

    function tick() {
        if (!ctx || mode === "off") return;
        if (ctx.state !== "running") { nextTime = ctx.currentTime + 0.05; return; }
        if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
        while (nextTime < ctx.currentTime + 0.35) {
            scheduleStep(nextTime);
            nextTime += stepMs();
        }
    }

    function applyMode() {
        if (!ctx || !pad) return;
        const t = ctx.currentTime;
        const target = mode === "off" ? 0.0001 : (mode === "game" ? 0.09 : 0.06);
        pad.g.gain.setTargetAtTime(target, t, 0.6);
        pad.f.frequency.setTargetAtTime(mode === "game" ? 800 : 450, t, 0.8);
    }

    function startMusicLoop() {
        startPad();
        applyMode();
        nextTime = ctx.currentTime + 0.1;
        timer = setInterval(tick, 100);
    }

    function setMode(m) {
        mode = m;
        applyMode();
    }

    function setOptions(o) {
        if (typeof o.sfx === "boolean") opts.sfx = o.sfx;
        if (typeof o.music === "boolean") opts.music = o.music;
        if (ctx) {
            const t = ctx.currentTime;
            sfxBus.gain.setTargetAtTime(opts.sfx ? 0.55 : 0, t, 0.05);
            musicBus.gain.setTargetAtTime(opts.music ? 0.32 : 0, t, 0.3);
        }
    }

    function play(name) {
        if (!ctx || ctx.state !== "running") return;
        const fn = sfx[name];
        if (fn) fn();
    }

    // Browsers only allow sound after the player interacts with the page.
    ["pointerdown", "keydown"].forEach(ev =>
        window.addEventListener(ev, resume, { passive: true }));

    document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    window.VoidAudio = { play, setMode, setOptions, resume };
})();
