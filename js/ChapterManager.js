// Chapter system: discrete episodes separated by fade transitions.
// Each chapter swaps terrain + buildings + spawns. Coffin/corpse/hearse damage persists.

class ChapterManager {
    constructor(game) {
        this.game = game;
        this.currentIndex = 0;
        this.chapters = [
            this.makeChapter1(),
            this.makeChapter2(),
            this.makeChapter3(),
        ];
        this._ch3 = null; // chapter-3 scripted-event state machine

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

        // Chapter-3 scripted beats (the loss at the gap)
        if (this.currentIndex === 2 && this.fadeState === 'idle') {
            this._updateChapter3Events(this.game);
        }
    }

    // === Chapter 3 scripted event: the corpse is lost at Dead Man's Gap ===
    // Guaranteed, not physics-random — the story must always happen. Each beat
    // hands off to the game's existing cascade (door pop → coffin eject → lid
    // pop → corpse eject), then hijacks the corpse for the tumble into the gap.
    _updateChapter3Events(game) {
        const s = this._ch3;
        if (!s || s.phase === 'done') return;
        switch (s.phase) {
            case 'armed':
                if (game.currentEpisode === 3 && game.player.inVehicle &&
                    game.coffin.inHearse && game.hearse.x > CHAPTER3_LOSS_X) {
                    game.hearse.bumpCounter = game.hearse.bumpThreshold; // door pops next frame
                    s.phase = 'doorPopped';
                    s.timer = 0;
                }
                break;
            case 'doorPopped':
                s.timer++;
                if (!game.coffin.inHearse) {
                    // Coffin is out — make sure the lid goes with it
                    game.coffin.bumpCounter = Math.max(game.coffin.bumpCounter, game.coffin.bumpThreshold);
                    game.coffin.lidOpen = true;
                    game.coffin.lidOpenedByBump = true;
                    s.phase = 'spilled';
                    s.timer = 0;
                } else if (s.timer > 240) {
                    s.phase = 'armed'; // failsafe: somehow didn't eject, re-arm
                }
                break;
            case 'spilled':
                s.timer++;
                // Game's update ejects the corpse automatically; give it a beat,
                // then take the body over for its trip to the gap.
                if (!game.corpse.inCoffin || s.timer > 30) {
                    if (game.corpse.inCoffin) {
                        game.corpse.ejectFromCoffin(game.coffin.x, game.coffin.y, game.coffin.velocityX);
                    }
                    s.phase = 'tumbling';
                    s.timer = 0;
                    s.fromX = game.corpse.x;
                    s.fromY = game.corpse.y;
                }
                break;
            case 'tumbling': {
                s.timer++;
                const T = 120;
                const t = Math.min(1, s.timer / T);
                const x = s.fromX + (CHAPTER3_GAP_X - 20 - s.fromX) * t;
                let y;
                if (t < 0.72) {
                    // Bouncing down the road toward the gap
                    const tt = t / 0.72;
                    const roadY = CHAPTER3_GROUND_TOP - 45;
                    y = s.fromY + (roadY - s.fromY) * tt - Math.abs(Math.sin(tt * Math.PI * 3)) * 22;
                } else {
                    // Over the edge, straight down
                    const tt = (t - 0.72) / 0.28;
                    y = (CHAPTER3_GROUND_TOP - 45) + tt * 300;
                }
                game.corpse.moveToPosition(x, y);
                if (t >= 1) {
                    game.corpse.isActive = false; // gone. properly gone.
                    if (!game.monologue) game.monologue = new MonologueSystem();
                    game.monologue.playNow('Of course.');
                    s.phase = 'gone';
                    s.timer = 0;
                }
                break;
            }
            case 'gone':
                s.timer++;
                if (s.timer === 200) {
                    game.monologue.playNow("Can't bury an empty box.");
                    s.phase = 'done';
                }
                break;
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
                return game.currentEpisode === 2 &&
                    game.coffin.isActive &&
                    game.coffin.inHearse &&
                    game.player.inVehicle &&
                    game.hearse.x > 23300 &&
                    game.hearse.velocity > 0.4;
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
                    { triggerX: 3500, text: "Some days it's the wrong church, right corpse. Other days it's the right church, wrong corpse." },
                    { triggerX: 5200, text: "Should've been a baker, or a butcher." },
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

                // 10. Arm the daymare (fires once, mid-flat-stretch after the ravine)
                if (game.dreamSequence) game.dreamSequence.reset();
            },
            // After the closing call, driving east off the map ends the day…
            // and begins the next one.
            shouldAdvance: (game) => {
                return game.currentEpisode === 'complete' &&
                    game.player.inVehicle &&
                    game.hearse.x > 17500 &&
                    game.hearse.velocity > 0.4;
            },
        };
    }

    makeChapter3() {
        return {
            id: 'family_plot',
            name: 'The Family Plot',
            apply: (game) => {
                // 1. New terrain: rolling road with Dead Man's Gap mid-route
                game.terrain.regenerate(buildChapter3Terrain, 16000);

                // 2. Hide everything from previous chapters
                game.hospital.active = false;
                game.church.active = false;
                game.deliveryBooth.active = false;
                game.phoneBooth.active = false;
                if (game.bridge) game.bridge.setActive(false);

                // 3. St. Margaret's again — this time as the pickup.
                //    hasReceivedDelivery stays true: it's scenery with a history.
                game.church2.active = true;
                game.church2.x = 1100;
                game.church2.hasReceivedDelivery = true;

                // 4. The destination: a family plot with a fresh hole in it
                if (!game.graveyard) {
                    game.graveyard = new Church(13500, 280, 'Hillcrest — Family Plot', 'graveyard');
                }
                game.graveyard.active = true;
                game.graveyard.x = 13500;
                game.graveyard.hasReceivedDelivery = false;

                // 5. Phones (reused from chapter 2)
                if (!game.openingPhone) game.openingPhone = new PhoneBooth(700, 300);
                game.openingPhone.active = true;
                game.openingPhone.x = 700;
                game.openingPhone.isRinging = true;
                game.openingPhone.isAnswered = false;
                game.openingPhone.briefing = {
                    title: 'Dispatch',
                    message: "Don't get comfortable. The widow moved the service. Family plot at Hillcrest, out east.\n\nSame fellow as yesterday. St. Margaret's has him boxed and waiting out front.\n\nTry not to lose him. Again.",
                    instruction: 'Collect the casket. Drive east.'
                };
                if (!game.closingPhone) game.closingPhone = new PhoneBooth(15200, 300);
                game.closingPhone.active = true;
                game.closingPhone.x = 15200;
                game.closingPhone.isRinging = false;
                game.closingPhone.isAnswered = false;

                // 6. The casket, boxed and waiting out front — same fellow inside
                const coffinX = 1650;
                game.coffin.isActive = true;
                game.coffin.inHearse = false;
                game.coffin.isPickedUp = false;
                game.coffin.lidOpen = false;
                game.coffin.lidOpenedByBump = false;
                game.coffin.x = coffinX;
                game.coffin.y = 395 - game.coffin.height;
                game.coffin.velocityX = 0;
                game.coffin.velocityY = 0;
                if (game.coffin.body) {
                    Matter.Body.setPosition(game.coffin.body, {
                        x: game.coffin.x + game.coffin.width / 2,
                        y: game.coffin.y + game.coffin.height / 2,
                    });
                    Matter.Body.setVelocity(game.coffin.body, { x: 0, y: 0 });
                    Matter.Body.setAngle(game.coffin.body, 0);
                }
                game.corpse.isActive = true;
                game.corpse.inCoffin = true;
                game.corpse.isPickedUp = false;
                game.corpse.moveToPosition(game.coffin.x, game.coffin.y);

                // 7. Something dead by the roadside, east of the gap
                game.roadkill.isActive = true;
                game.roadkill.inCoffin = false;
                game.roadkill.isPickedUp = false;
                game.roadkill.x = 8600;

                // 8. Dead Man's Gap — already bridged. The road is fine.
                //    The road was never the problem.
                if (!game.plankRavine) game.plankRavine = new PlankRavine();
                game.plankRavine.configure(CHAPTER3_GAP_START, CHAPTER3_GAP_END, game.physics, CHAPTER3_GROUND_TOP);
                if (!game.planks) game.planks = [];
                for (const p of game.planks) p.destroy && p.destroy();
                game.planks.length = 0;
                const bridgePlank = new Plank(CHAPTER3_GAP_X - 120, 280, game.physics);
                game.plankRavine.placePlank(bridgePlank);
                game.planks.push(bridgePlank);

                // 9. Spawn: hearse just west of the ringing phone
                game.hearse.teleportTo(350, 280);
                if (game.player.inVehicle) {
                    game.player.x = game.hearse.x + 60;
                    game.player.y = game.hearse.y;
                }
                game.cameraX = 0;
                game.targetCameraX = 0;
                game.currentEpisode = 3;

                // 10. Monologue along the route
                if (!game.monologue) game.monologue = new MonologueSystem();
                game.monologue.setSnippets([
                    { triggerX: 2600, text: 'Same box. Same road. Same fellow.' },
                    { triggerX: 4300, text: 'People move things. Services. Graves. Whole lives.' },
                    { triggerX: 5900, text: 'Smooth so far.' },
                    { triggerX: 10300, text: "It's what he would have wanted. Probably." },
                    { triggerX: 12300, text: 'Hillcrest. Last stop. His, anyway.' },
                ]);

                // 11. Respawn west of the gap; arm the scripted loss
                game.checkpointX = 5400;
                game.chapterManager._ch3 = { phase: 'armed', timer: 0 };
            },
            shouldAdvance: (game) => false, // end of the demo — for now
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
const CHAPTER2_RAVINE_START = 7920; // visible left cliff edge
const CHAPTER2_RAVINE_END = 8080; // visible right cliff edge
const CHAPTER2_GROUND_TOP = 393; // Top surface where the hearse rolls (matches groundY at cliff edges with subtle undulation)

// Chapter 3 terrain: rolling road, one narrow chasm ("Dead Man's Gap") that is
// already bridged for the hearse — the hazard isn't the road, it's the script.
const CHAPTER3_GAP_X = 6800;      // single deep terrain point
const CHAPTER3_GAP_START = 6760;  // visible left cliff edge
const CHAPTER3_GAP_END = 6840;    // visible right cliff edge
const CHAPTER3_GROUND_TOP = 395;  // road surface at the gap edges
const CHAPTER3_LOSS_X = 6250;     // where the scripted loss begins (west of the gap)

function buildChapter3Terrain(worldWidth) {
    const points = [];
    const step = 80;
    const baseHeight = 380;

    for (let x = 0; x <= worldWidth; x += step) {
        let variation = 0;

        // Gentle rolling — a nicer day than yesterday, on paper
        variation += Math.sin(x * 0.0011) * 9;
        variation += Math.sin(x * 0.0031) * 4;

        // Dead Man's Gap: single unrecoverable deep point
        if (x === CHAPTER3_GAP_X) {
            variation = 500;
        }

        // Flatten approaches to the gap so the plank sits flush
        if (x !== CHAPTER3_GAP_X && Math.abs(x - CHAPTER3_GAP_X) < 500) {
            variation = 0;
        }

        // Flatten under St. Margaret's, the graveyard, and both phones
        if (Math.abs(x - 1300) < 450) variation = 0;
        if (Math.abs(x - 13700) < 500) variation = 0;
        if (Math.abs(x - 700) < 100 || Math.abs(x - 15200) < 100) variation = 0;

        points.push({
            x,
            horizonY: baseHeight + variation,
            groundY: baseHeight + variation + 15,
        });
    }
    return points;
}

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