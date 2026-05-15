// Chapter system: discrete episodes separated by fade transitions.
// Each chapter swaps terrain + buildings + spawns. Coffin/corpse/hearse damage persists.

class ChapterManager {
    constructor(game) {
        this.game = game;
        this.currentIndex = 0;
        this.chapters = [
            this.makeChapter1(),
            this.makeChapter2(),
        ];

        this.fadeAlpha = 0;
        this.fadeState = 'idle'; // 'idle' | 'out' | 'in'
        this.fadeOutFrames = 60;
        this.fadeInFrames = 60;
        this.fadeTimer = 0;
        this.pendingIndex = null;
    }

    update() {
        if (this.fadeState === 'out') {
            this.fadeTimer++;
            this.fadeAlpha = Math.min(1, this.fadeTimer / this.fadeOutFrames);
            if (this.fadeAlpha >= 1) {
                this.applyChapter(this.pendingIndex);
                this.fadeState = 'in';
                this.fadeTimer = 0;
            }
        } else if (this.fadeState === 'in') {
            this.fadeTimer++;
            this.fadeAlpha = Math.max(0, 1 - this.fadeTimer / this.fadeInFrames);
            if (this.fadeAlpha <= 0) {
                this.fadeAlpha = 0;
                this.fadeState = 'idle';
            }
        }

        if (this.fadeState === 'idle') {
            const cur = this.chapters[this.currentIndex];
            if (cur && cur.shouldAdvance && cur.shouldAdvance(this.game)) {
                this.beginTransitionTo(this.currentIndex + 1);
            }
        }
    }

    beginTransitionTo(idx) {
        if (idx < 0 || idx >= this.chapters.length) return;
        this.fadeState = 'out';
        this.fadeTimer = 0;
        this.pendingIndex = idx;
        console.log(`📖 Beginning fade to chapter ${idx + 1}`);
    }

    applyChapter(idx) {
        const ch = this.chapters[idx];
        if (!ch) return;
        ch.apply(this.game);
        this.currentIndex = idx;
        console.log(`📖 Now in chapter ${idx + 1}: ${ch.name}`);
    }

    drawFadeOverlay(ctx) {
        if (this.fadeAlpha <= 0) return;
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    isFading() {
        return this.fadeState !== 'idle';
    }

    // === Chapter definitions ===

    makeChapter1() {
        return {
            id: 'wrong_church',
            name: 'The Wrong Church',
            apply: (game) => {
                // Cold start: Game.constructor handles this. Defensive on re-entry.
                game.hospital.active = true;
                game.church.active = true;
                game.deliveryBooth.active = true;
                game.phoneBooth.active = true;
                if (game.bridge) game.bridge.setActive(true);
                if (game.openingPhone) game.openingPhone.active = false;
                if (game.closingPhone) game.closingPhone.active = false;
                if (game.plankRavine) game.plankRavine.active = false;
                game.checkpointX = 14500;
            },
            shouldAdvance: (game) => {
                return game.currentEpisode === 2
                    && game.coffin.isActive
                    && game.coffin.inHearse
                    && game.player.inVehicle
                    && game.hearse.x > 23300
                    && game.hearse.velocity > 0.4;
            },
        };
    }

    makeChapter2() {
        return {
            id: 'east_of_nowhere',
            name: 'East of Nowhere',
            apply: (game) => {
                // 1. New terrain: monotonous flat → ravine → flat to St. Margaret's
                game.terrain.regenerate(buildChapter2Terrain, 18000);

                // 2. Hide chapter-1 buildings
                game.hospital.active = false;
                game.church.active = false;
                game.deliveryBooth.active = false;
                game.phoneBooth.active = false;

                // 3. Position chapter-2 buildings
                game.church2.active = true;
                game.church2.x = 15500;
                game.church2.hasReceivedDelivery = false;

                // Opening phone (silent — visual continuity beat)
                if (!game.openingPhone) {
                    game.openingPhone = new PhoneBooth(300, 300);
                }
                game.openingPhone.active = true;
                game.openingPhone.isRinging = false;
                game.openingPhone.isAnswered = true;

                // Closing phone (rings after final delivery)
                if (!game.closingPhone) {
                    game.closingPhone = new PhoneBooth(17000, 300);
                }
                game.closingPhone.active = true;
                game.closingPhone.isRinging = false;
                game.closingPhone.isAnswered = false;

                // 4. Teleport hearse + player to chapter-2 spawn (next to opening phone)
                game.hearse.teleportTo(500, 280);
                if (game.player.inVehicle) {
                    game.player.x = game.hearse.x + 60;
                    game.player.y = game.hearse.y;
                }

                // 5. Reset camera
                game.cameraX = 0;
                game.targetCameraX = 0;

                // 6. Monologue snippets along the flat stretch
                if (!game.monologue) game.monologue = new MonologueSystem();
                game.monologue.setSnippets([
                    { triggerX: 1800, text: "Some days the road just keeps going." },
                    { triggerX: 3500, text: "Wrong church. Right corpse. Bureaucracy at work." },
                    { triggerX: 5200, text: "Should've been a baker." },
                    { triggerX: 9500, text: "Always something. Always something between you and where you're supposed to be." },
                    { triggerX: 13000, text: "St. Margaret's. Better be the right one this time." },
                ]);

                // 7. Disable chapter-1 drawbridge during chapter 2
                if (game.bridge) game.bridge.setActive(false);

                // 8. Plank-bridged chasm + planks
                if (!game.plankRavine) game.plankRavine = new PlankRavine();
                game.plankRavine.configure(CHAPTER2_RAVINE_START, CHAPTER2_RAVINE_END, game.physics, CHAPTER2_GROUND_TOP);

                if (!game.planks) game.planks = [];
                // Clean up old plank physics bodies before respawning
                for (const p of game.planks) p.destroy && p.destroy();
                game.planks.length = 0;
                // One plank, sized to span the chasm with 40px overhang
                game.planks.push(new Plank(7500, 280, game.physics));

                // 9. Chapter-aware respawn checkpoint (~1500px before the chasm)
                game.checkpointX = 6300;
            },
            shouldAdvance: (game) => false, // last chapter for now
        };
    }
}

// Chapter 2 terrain generator.
// Canvas Y is DOWN, so positive variation = ground drops down (a real pit).
// Layout: flat monotonous stretch → narrow chasm → flat → St. Margaret's
//
// Terrain points are generated every 80px. The chasm is a SINGLE deep terrain
// point at x=8000, with ground points at x=7920 and x=8080 acting as the cliff
// edges. Visible gap is 160px wide; a 240px plank covers it with 40px overhang
// on each side.
const CHAPTER2_RAVINE_DEEP_X = 8000; // single deep terrain point
const CHAPTER2_RAVINE_START  = 7920; // visible left cliff edge
const CHAPTER2_RAVINE_END    = 8080; // visible right cliff edge
const CHAPTER2_GROUND_TOP    = 393;  // Top surface where the hearse rolls (matches groundY at cliff edges with subtle undulation)

function buildChapter2Terrain(worldWidth) {
    const points = [];
    const step = 80;
    const baseHeight = 380;

    for (let x = 0; x <= worldWidth; x += step) {
        let variation = 0;

        // Subtle undulation — barely noticeable, intentionally monotonous
        variation += Math.sin(x * 0.0008) * 6;
        variation += Math.sin(x * 0.0023) * 3;

        // The chasm: a single deep point that creates an unrecoverable pit
        if (x === CHAPTER2_RAVINE_DEEP_X) {
            variation = 500; // Way below visible canvas
        }

        // Flatten under St. Margaret's (church2 sits at x=15500)
        if (Math.abs(x - 15500) < 400) {
            variation = 0;
        }

        // Flatten under opening + closing phones
        if (Math.abs(x - 300) < 80 || Math.abs(x - 17000) < 80) {
            variation = 0;
        }

        points.push({
            x,
            horizonY: baseHeight + variation,
            groundY: baseHeight + variation + 15,
        });
    }
    return points;
}
