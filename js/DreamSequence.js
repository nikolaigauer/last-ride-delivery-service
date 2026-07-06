// The daymare (chapter 2). Driving the long flat stretch, the driver dreams:
// the back door opens by itself, the corpse crawls out and along the roof
// toward the cab — hard cut to first-person as it slams onto the windshield —
// snap back to sideview: the hood is up, steam everywhere. The hearse has
// overheated. It was never the corpse. He just needs to sleep more.
//
// Plays once. Purely audiovisual: real door/coffin/corpse state is never
// touched; the only real consequence is the overheat at the end.
//
// Test from console: game.dreamSequence.start(true)

class DreamSequence {
    constructor() {
        // Auto-trigger window (chapter 2, just after the ravine). The sequence
        // runs ~14s at cruise (~5–6000px of road), so it must start early enough
        // that the overheat strands the driver in the middle of nowhere — within
        // sight of St. Margaret's at worst, never at its doorstep.
        this.TRIGGER_MIN_X = 8700;
        this.TRIGGER_MAX_X = 11000;
        this.MIN_SPEED = 3.0;

        // Phase lengths in frames (~60fps)
        this.ONSET_FRAMES = 110;
        this.DOOR_FRAMES = 55;
        this.CRAWL_FRAMES = 430;
        this.POV_FRAMES = 88;
        this.POV_SLAM_FRAME = 50;   // beat of nothing first, then the hit
        this.AFTER_FRAMES = 45;     // pause before the monologue line

        // Crawler geometry, relative to the hearse sprite box (210x150).
        // Calibrated against the sprite's visible roofline via playtest screenshots.
        this.ROOF_Y = 58;
        this.CRAWL_FROM_X = 34;     // emerges above the back door (left)
        this.CRAWL_TO_X = 108;      // stops just behind the windshield

        this.reset();
    }

    reset() {
        this.state = 'idle';  // idle → onset → door → crawl → pov → after → done
        this.timer = 0;
        this.done = false;
        this.vignette = 0;
        this.cracks = null;
        this._crawlPauseTaken = false;
    }

    isActive() {
        return this.state !== 'idle' && this.state !== 'done';
    }

    // Suppress regular monologue while the dream owns the frame
    blocksMonologue() {
        return this.isActive() && this.state !== 'after';
    }

    start(force = false) {
        if (this.state !== 'idle' || (this.done && !force)) return;
        this.reset();
        this.state = 'onset';
        console.log('🌫 Daymare begins');
    }

    _abort(game) {
        // Player broke the trance (left the vehicle) — dissolve quietly, no payoff.
        game.hearse.visualDoorOpen = false;
        this.vignette = 0;
        this.state = 'done';
        this.done = true;
    }

    update(game) {
        // Auto-trigger: once, mid-chapter-2, cruising with the full cargo aboard
        // (the "is it the corpse????" read requires the corpse to be in the back).
        if (this.state === 'idle' && !this.done) {
            if (game.chapterManager.currentIndex === 1 &&
                game.player.inVehicle &&
                game.hearse.x > this.TRIGGER_MIN_X && game.hearse.x < this.TRIGGER_MAX_X &&
                Math.abs(game.hearse.velocity) > this.MIN_SPEED &&
                game.coffin.isActive && game.coffin.inHearse && game.corpse.inCoffin &&
                !game.missionBriefing && game.deathState === null &&
                !game.chapterManager.isFading()) {
                this.start();
            }
            return;
        }
        if (this.state === 'idle' || this.state === 'done') return;

        // Leaving the hearse mid-dream wakes him early, without the climax
        if (this.state !== 'pov' && this.state !== 'after' && !game.player.inVehicle) {
            this._abort(game);
            return;
        }

        this.timer++;

        switch (this.state) {
            case 'onset':
                // Any lingering monologue would freeze on screen for the whole
                // dream (its update is suppressed below) — clear it going in.
                if (this.timer === 1 && game.monologue) game.monologue.active = null;
                this.vignette = Math.min(0.3, this.timer / this.ONSET_FRAMES * 0.3);
                if (this.timer >= this.ONSET_FRAMES) {
                    this.state = 'door';
                    this.timer = 0;
                    game.hearse.visualDoorOpen = true;
                    if (game.audio && game.audio.playDoorOpen) game.audio.playDoorOpen();
                }
                break;

            case 'door':
                if (this.timer >= this.DOOR_FRAMES) {
                    this.state = 'crawl';
                    this.timer = 0;
                }
                break;

            case 'crawl':
                this.vignette = Math.min(0.42, 0.3 + this.timer / this.CRAWL_FRAMES * 0.12);
                if (this.timer >= this.CRAWL_FRAMES) {
                    this.state = 'pov';
                    this.timer = 0;
                    this.cracks = null;
                }
                break;

            case 'pov':
                if (this.timer === this.POV_SLAM_FRAME) {
                    this.cracks = this._makeCracks();
                    if (game.audio && game.audio.playCorpseImpact) game.audio.playCorpseImpact(2);
                }
                if (this.timer >= this.POV_FRAMES) {
                    // SNAP. Back to the world — and the mundane truth.
                    this.state = 'after';
                    this.timer = 0;
                    this.vignette = 0;
                    game.hearse.visualDoorOpen = false;
                    game.hearse.heat = game.hearse.maxHeat;
                    if (!game.hearse.overheated) {
                        game.hearse.overheated = true;
                        if (game.audio && game.audio.playSteamHiss) game.audio.playSteamHiss();
                    }
                }
                break;

            case 'after':
                if (this.timer >= this.AFTER_FRAMES) {
                    if (!game.monologue) game.monologue = new MonologueSystem();
                    game.monologue.playNow('Need to sleep more.');
                    this.state = 'done';
                    this.done = true;
                }
                break;
        }
    }

    // === World-space drawing (the crawler on the roof) ===
    // Called right after hearse.draw so the figure sits on top of the sprite.
    drawWorld(ctx, cameraX, hearse) {
        if (this.state !== 'crawl') return;

        const screenX = hearse.x - cameraX;
        ctx.save();
        // Match the hearse sprite's tilt transform exactly (see Hearse.draw)
        const centerX = screenX + hearse.width * 0.2;
        const centerY = hearse.y + hearse.height;
        ctx.translate(centerX, centerY);
        ctx.rotate(hearse.tiltAngle);
        ctx.translate(-centerX, -centerY);

        // Lurching progress: pulls forward, rests, pulls again. One long pause
        // ~60% of the way — it lifts its head. Just past comfortable.
        const t = this.timer / this.CRAWL_FRAMES;
        let p = t + Math.sin(t * Math.PI * 9) * 0.035; // lurch
        const PAUSE_AT = 0.58, PAUSE_LEN = 0.13;
        let headLift = 0;
        if (t > PAUSE_AT && t < PAUSE_AT + PAUSE_LEN) {
            p = PAUSE_AT;
            headLift = Math.sin((t - PAUSE_AT) / PAUSE_LEN * Math.PI) * 5;
        } else if (t >= PAUSE_AT + PAUSE_LEN) {
            p = PAUSE_AT + (t - PAUSE_AT - PAUSE_LEN) / (1 - PAUSE_AT - PAUSE_LEN) * (1 - PAUSE_AT);
        }
        p = Math.max(0, Math.min(1, p));

        const cx = screenX + this.CRAWL_FROM_X + (this.CRAWL_TO_X - this.CRAWL_FROM_X) * p;
        const roofY = hearse.y + this.ROOF_Y;
        const reach = 10 + Math.sin(this.timer * 0.09) * 8; // dragging arm cycle

        // Two passes: a white rim first, then the black figure on top — otherwise
        // a black silhouette on the black hearse roof is invisible. The rim reads
        // like moonlight and matches the sprite's white window detailing.
        const drawFigure = (color, grow) => {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineCap = 'round';
            // Prone body
            ctx.beginPath();
            ctx.ellipse(cx, roofY - 6, 15 + grow, 6 + grow, -0.06, 0, Math.PI * 2);
            ctx.fill();
            // Head (lifts during the pause — it is looking at the driver)
            ctx.beginPath();
            ctx.arc(cx + 17, roofY - 9 - headLift, 6.5 + grow, 0, Math.PI * 2);
            ctx.fill();
            // Reaching arm
            ctx.lineWidth = 4 + grow * 2;
            ctx.beginPath();
            ctx.moveTo(cx + 10, roofY - 6);
            ctx.lineTo(cx + 12 + reach, roofY - 1);
            ctx.stroke();
            // Trailing arm
            ctx.beginPath();
            ctx.moveTo(cx + 2, roofY - 5);
            ctx.lineTo(cx - 6, roofY - 1);
            ctx.stroke();
            // Legs dragging behind, limp
            ctx.lineWidth = 3.5 + grow * 2;
            ctx.beginPath();
            ctx.moveTo(cx - 12, roofY - 5);
            ctx.lineTo(cx - 26, roofY - 2 + Math.sin(this.timer * 0.05) * 1.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 12, roofY - 6);
            ctx.lineTo(cx - 28, roofY - 5);
            ctx.stroke();
        };
        drawFigure('rgba(255,255,255,0.9)', 1.6);
        drawFigure('#000', 0);

        // Eye — a single white point, no pupil
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + 19.5, roofY - 10 - headLift, 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // === Screen-space drawing (vignette + the POV smash) ===
    // Called near the end of render, before the chapter fade overlay.
    drawOverlay(ctx) {
        const w = ctx.canvas.width, h = ctx.canvas.height;

        if (this.vignette > 0) {
            ctx.save();
            const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.75);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, `rgba(0,0,0,${this.vignette})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        if (this.state !== 'pov') return;

        ctx.save();

        // Screen shake after the slam, decaying
        if (this.timer > this.POV_SLAM_FRAME) {
            const decay = 1 - (this.timer - this.POV_SLAM_FRAME) / (this.POV_FRAMES - this.POV_SLAM_FRAME);
            ctx.translate((Math.random() - 0.5) * 10 * decay, (Math.random() - 0.5) * 10 * decay);
        }

        // Cab interior — black everything
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, w + 40, h + 40);

        // Windshield
        const wsX = 170, wsY = 70, wsW = 660, wsH = 280;
        ctx.fillStyle = '#f2f1ec';
        ctx.beginPath();
        ctx.roundRect(wsX, wsY, wsW, wsH, 14);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(wsX, wsY, wsW, wsH, 14);
        ctx.clip();

        // The road ahead: flat horizon, two edges to a vanishing point
        const vpX = w / 2, vpY = 215;
        ctx.fillStyle = '#d9d7d0';
        ctx.fillRect(wsX, vpY, wsW, wsY + wsH - vpY); // ground plane
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wsX, vpY); ctx.lineTo(wsX + wsW, vpY); // horizon
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(280, wsY + wsH); ctx.lineTo(vpX, vpY);
        ctx.moveTo(720, wsY + wsH); ctx.lineTo(vpX, vpY);
        ctx.stroke();
        // Center line dashes, converging
        for (let i = 0; i < 5; i++) {
            const f0 = 0.12 + i * 0.18, f1 = f0 + 0.07;
            ctx.lineWidth = 3 * (1 - f0);
            ctx.beginPath();
            ctx.moveTo(vpX, vpY + (wsY + wsH - vpY) * f0);
            ctx.lineTo(vpX, vpY + (wsY + wsH - vpY) * f1);
            ctx.stroke();
        }

        // Rearview mirror — and, in the beat before the slam, eyes in it.
        ctx.fillStyle = '#000';
        ctx.fillRect(vpX - 55, wsY + 12, 110, 34);
        if (this.timer > 18 && this.timer < this.POV_SLAM_FRAME) {
            const a = Math.min(1, (this.timer - 18) / 20);
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.beginPath();
            ctx.arc(vpX - 16, wsY + 29, 2.6, 0, Math.PI * 2);
            ctx.arc(vpX + 16, wsY + 29, 2.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // THE SLAM — upside-down head and splayed hands from above
        if (this.timer >= this.POV_SLAM_FRAME) {
            const drop = Math.min(1, (this.timer - this.POV_SLAM_FRAME) / 4);
            const headY = wsY - 40 + drop * 118;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(vpX, headY, 40, 0, Math.PI * 2); // head
            ctx.fill();
            // Eyes — white, no pupils, low on the face because the face is upside down
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(vpX - 14, headY + 18, 4.5, 0, Math.PI * 2);
            ctx.arc(vpX + 14, headY + 18, 4.5, 0, Math.PI * 2);
            ctx.fill();
            // Hands slapped flat, fingers splayed
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#000';
            for (const hx of [vpX - 165, vpX + 165]) {
                const handY = wsY - 20 + drop * 130;
                ctx.beginPath();
                ctx.ellipse(hx, handY, 22, 27, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 7;
                ctx.lineCap = 'round';
                for (let f = -2; f <= 2; f++) {
                    ctx.beginPath();
                    ctx.moveTo(hx + f * 9, handY + 10);
                    ctx.lineTo(hx + f * 12, handY + 34);
                    ctx.stroke();
                }
            }
            // Glass cracks
            if (this.cracks) {
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = 1.4;
                const grow = Math.min(1, (this.timer - this.POV_SLAM_FRAME) / 16);
                for (const crack of this.cracks) {
                    const n = Math.max(2, Math.floor(crack.length * grow));
                    ctx.beginPath();
                    ctx.moveTo(crack[0].x, crack[0].y);
                    for (let i = 1; i < n; i++) ctx.lineTo(crack[i].x, crack[i].y);
                    ctx.stroke();
                }
            }
        }
        ctx.restore(); // windshield clip

        // Dashboard, wheel, his hands — white ink on the black interior.
        // Wheel sits fully below the dash line so the shapes don't tangle.
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(60, 392); ctx.lineTo(w - 60, 392); // dash line
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vpX, 625, 220, Math.PI * 1.32, Math.PI * 1.68); // wheel top arc
        ctx.stroke();
        for (const hx of [vpX - 95, vpX + 95]) { // hands gripping the rim
            ctx.beginPath();
            ctx.arc(hx, 423, 11, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.stroke();
        }

        // Terminal white flash
        if (this.timer > this.POV_FRAMES - 5) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-20, -20, w + 40, h + 40);
        }

        ctx.restore();
    }

    // Jagged crack polylines radiating from the impact points
    _makeCracks() {
        const cracks = [];
        const origins = [
            { x: 500, y: 150 },            // head
            { x: 335, y: 130 }, { x: 665, y: 130 }, // hands
        ];
        for (const o of origins) {
            const rays = 5 + Math.floor(Math.random() * 3);
            for (let r = 0; r < rays; r++) {
                const angle = (r / rays) * Math.PI * 2 + Math.random() * 0.5;
                const pts = [{ x: o.x, y: o.y }];
                let px = o.x, py = o.y, a = angle;
                const segs = 4 + Math.floor(Math.random() * 3);
                for (let s = 0; s < segs; s++) {
                    const len = 18 + Math.random() * 30;
                    a += (Math.random() - 0.5) * 0.7;
                    px += Math.cos(a) * len;
                    py += Math.sin(a) * len;
                    pts.push({ x: px, y: py });
                }
                cracks.push(pts);
            }
        }
        return cracks;
    }
}
