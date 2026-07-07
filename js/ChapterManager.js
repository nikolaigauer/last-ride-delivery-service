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
            this.makeChapter4(),
        ];
        this._ch3 = null; // chapter-3 scripted-event state machine
        this._ch4 = null; // chapter-4 scripted-event state machine

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
        // Chapter-4 scripted beats (the branch and the drain)
        if (this.currentIndex === 3 && this.fadeState === 'idle') {
            this._updateChapter4Events(this.game);
        }
    }

    // Per-chapter world props that don't warrant their own entity class.
    // Called from Game.render after buildings, before entities.
    drawProps(ctx, cameraX) {
        if (this.currentIndex !== 3) return;
        const groundTop = CHAPTER4_GROUND_TOP;

        // Warning sign, west of the tree
        {
            const sx = 6050 - cameraX;
            if (sx > -100 && sx < ctx.canvas.width + 100) {
                ctx.strokeStyle = '#000';
                ctx.fillStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx, groundTop); ctx.lineTo(sx, groundTop - 46);
                ctx.stroke();
                ctx.fillRect(sx - 44, groundTop - 74, 88, 28);
                ctx.strokeRect(sx - 44, groundTop - 74, 88, 28);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('MIND THE', sx, groundTop - 62);
                ctx.fillText('TREES', sx, groundTop - 52);
                ctx.textAlign = 'start';
            }
        }

        // The tree, with one long branch over the road at hearse-roof height
        {
            const tx = CHAPTER4_BRANCH_X - cameraX;
            if (tx > -300 && tx < ctx.canvas.width + 300) {
                ctx.strokeStyle = '#000';
                ctx.lineCap = 'round';
                ctx.lineWidth = 7;
                ctx.beginPath(); // trunk, leaning over the road
                ctx.moveTo(tx - 40, groundTop);
                ctx.quadraticCurveTo(tx - 44, groundTop - 90, tx - 18, groundTop - 118);
                ctx.stroke();
                ctx.lineWidth = 5;
                ctx.beginPath(); // THE branch
                ctx.moveTo(tx - 22, groundTop - 108);
                ctx.quadraticCurveTo(tx + 60, groundTop - 66, tx + 130, groundTop - 56);
                ctx.stroke();
                ctx.lineWidth = 2.5;
                ctx.beginPath(); // twigs
                ctx.moveTo(tx + 40, groundTop - 80); ctx.lineTo(tx + 58, groundTop - 100);
                ctx.moveTo(tx + 90, groundTop - 60); ctx.lineTo(tx + 106, groundTop - 78);
                ctx.moveTo(tx - 20, groundTop - 116); ctx.lineTo(tx - 2, groundTop - 148);
                ctx.moveTo(tx - 30, groundTop - 100); ctx.lineTo(tx - 58, groundTop - 128);
                ctx.stroke();
            }
        }

        // The storm drain, east of the tree
        {
            const dx = CHAPTER4_DRAIN_X - cameraX;
            if (dx > -100 && dx < ctx.canvas.width + 100) {
                ctx.fillStyle = '#000';
                ctx.fillRect(dx - 24, groundTop - 4, 48, 8);
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 1.5;
                for (let i = -16; i <= 16; i += 8) {
                    ctx.beginPath();
                    ctx.moveTo(dx + i, groundTop - 3);
                    ctx.lineTo(dx + i, groundTop + 3);
                    ctx.stroke();
                }
            }
        }

        // Roadside melon stand: a crate, a spare melon, a modest sign
        {
            const mx = 9000 - cameraX;
            if (mx > -150 && mx < ctx.canvas.width + 150) {
                ctx.strokeStyle = '#000';
                ctx.fillStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.fillRect(mx - 60, groundTop - 24, 46, 24); // crate
                ctx.strokeRect(mx - 60, groundTop - 24, 46, 24);
                ctx.beginPath();
                ctx.moveTo(mx - 60, groundTop - 12); ctx.lineTo(mx - 14, groundTop - 12);
                ctx.stroke();
                ctx.fillStyle = '#000';
                ctx.beginPath(); // spare melon on the crate
                ctx.arc(mx - 37, groundTop - 32, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath(); // sign post
                ctx.moveTo(mx + 40, groundTop); ctx.lineTo(mx + 40, groundTop - 40);
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fillRect(mx + 12, groundTop - 62, 56, 22);
                ctx.strokeRect(mx + 12, groundTop - 62, 56, 22);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('MELONS', mx + 40, groundTop - 48);
                ctx.textAlign = 'start';
            }
        }
    }

    // === Chapter 4 scripted event: the branch takes the professor's head ===
    _updateChapter4Events(game) {
        const s = this._ch4;
        if (!s || s.phase === 'done') return;
        switch (s.phase) {
            case 'armed':
                if (game.currentEpisode === 4 && game.player.inVehicle &&
                    game.coffin.inHearse && game.corpse.inCoffin &&
                    game.hearse.x + game.hearse.width * 0.7 > CHAPTER4_BRANCH_X) {
                    // THUNK. Lid flips up briefly (timer-closed, so the body
                    // stays put) and the head goes over the side.
                    game.coffin.lidOpen = true;
                    game.coffin.lidOpenedByBump = false;
                    game.coffin.lidTimer = 100;
                    if (!game.corpse.headDetached) game.corpse.detachHead();
                    s.phase = 'headArc';
                    s.timer = 0;
                    s.fromX = game.hearse.x + 130;
                    s.fromY = game.hearse.y + 40;
                    break;
                }
                break;
            case 'headArc': {
                s.timer++;
                const head = game.corpse.detachedHead;
                if (!head) { // exotic state — skip straight to the aftermath
                    s.phase = 'gone';
                    s.timer = 0;
                    break;
                }
                const T = 80;
                const t = Math.min(1, s.timer / T);
                const x = s.fromX + (CHAPTER4_DRAIN_X - s.fromX) * t;
                const y = s.fromY + (CHAPTER4_GROUND_TOP - 8 - s.fromY) * t -
                    Math.sin(t * Math.PI) * 55 - Math.abs(Math.sin(t * Math.PI * 2.5)) * 10 * (1 - t);
                head.x = x; head.y = y;
                head.oldX = x; head.oldY = y; // kill self-physics; the script drives
                head.velX = 0; head.velY = 0;
                if (t >= 1) {
                    game.corpse.detachedHead = null; // down the drain. gone.
                    if (!game.monologue) game.monologue = new MonologueSystem();
                    game.monologue.playNow("That's not ideal.");
                    s.phase = 'gone';
                    s.timer = 0;
                }
                break;
            }
            case 'gone':
                s.timer++;
                if (s.timer === 220) {
                    game.monologue.playNow('Open casket. The whole man, they said.');
                    s.phase = 'done';
                }
                break;
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
                game.roadkill.setKind('deer');
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
            // After Hillcrest's closing call, east again. Always east.
            shouldAdvance: (game) => {
                return game.currentEpisode === 'series_end' &&
                    game.player.inVehicle &&
                    game.hearse.x > 15700 &&
                    game.hearse.velocity > 0.4;
            },
        };
    }

    makeChapter4() {
        return {
            id: 'open_casket',
            name: 'The Open Casket',
            apply: (game) => {
                // 1. Terrain: rolling road, no chasms. The hazards are botanical.
                game.terrain.regenerate(buildChapter4Terrain, 15500);

                // 2. Previous chapters off
                game.hospital.active = false;
                game.church.active = false;
                game.deliveryBooth.active = false;
                game.phoneBooth.active = false;
                game.church2.active = false;
                if (game.graveyard) game.graveyard.active = false;
                if (game.bridge) game.bridge.setActive(false);
                if (game.plankRavine) game.plankRavine.active = false;
                if (game.planks) {
                    for (const p of game.planks) p.destroy && p.destroy();
                    game.planks.length = 0;
                }

                // 3. Destination: St. Anthony's — and the family wants to LOOK
                if (!game.church4) {
                    game.church4 = new Church(13000, 280, "St. Anthony's");
                }
                game.church4.active = true;
                game.church4.x = 13000;
                game.church4.hasReceivedDelivery = false;
                game.church4.openCasket = true;

                // 4. Phones
                if (!game.openingPhone) game.openingPhone = new PhoneBooth(700, 300);
                game.openingPhone.active = true;
                game.openingPhone.x = 700;
                game.openingPhone.isRinging = true;
                game.openingPhone.isAnswered = false;
                game.openingPhone.briefing = {
                    title: 'Dispatch',
                    message: "New fellow today. A professor. Emeritus, whatever that means.\n\nFamily wants an open casket, so keep him presentable. The whole man, top to bottom.\n\nSt. Anthony's, out east. Mind the trees.",
                    instruction: 'Collect the casket. Drive east.'
                };
                if (!game.closingPhone) game.closingPhone = new PhoneBooth(14500, 300);
                game.closingPhone.active = true;
                game.closingPhone.x = 14500;
                game.closingPhone.isRinging = false;
                game.closingPhone.isAnswered = false;

                // 5. The professor, boxed and waiting by the road
                game.coffin.isActive = true;
                game.coffin.inHearse = false;
                game.coffin.isPickedUp = false;
                game.coffin.lidOpen = false;
                game.coffin.lidOpenedByBump = false;
                game.coffin.bumpCounter = 0;
                game.coffin.x = 1500;
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
                // A new client: whole, for now
                game.corpse.isActive = true;
                game.corpse.inCoffin = true;
                game.corpse.isPickedUp = false;
                game.corpse.health = 100;
                game.corpse.detachedHead = null;
                game.corpse.moveToPosition(game.coffin.x, game.coffin.y);

                // 6. The melon stand, east of the tree
                game.roadkill.setKind('melon');
                game.roadkill.isActive = true;
                game.roadkill.inCoffin = false;
                game.roadkill.isPickedUp = false;
                game.roadkill.x = 8983;

                // 7. Spawn
                game.hearse.teleportTo(350, 280);
                if (game.player.inVehicle) {
                    game.player.x = game.hearse.x + 60;
                    game.player.y = game.hearse.y;
                }
                game.cameraX = 0;
                game.targetCameraX = 0;
                game.currentEpisode = 4;

                // 8. Monologue
                if (!game.monologue) game.monologue = new MonologueSystem();
                game.monologue.setSnippets([
                    { triggerX: 1200, text: 'They just leave them out, these days.' },
                    { triggerX: 3400, text: 'A professor. All that thinking. Same box as everyone.' },
                    { triggerX: 5300, text: 'Open casket. Everyone wants to look. Nobody wants to see.' },
                    { triggerX: 11000, text: 'Almost there. Keep the lid shut.' },
                    { triggerX: 12200, text: "St. Anthony's. Open casket. Say nothing." },
                ]);

                // 9. Checkpoint + arm the branch
                game.checkpointX = 5000;
                game.chapterManager._ch4 = { phase: 'armed', timer: 0 };
            },
            shouldAdvance: (game) => false, // truly the end of the demo — for now
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

// Chapter 4 terrain: rolling road with no chasms at all. The hazard hangs at
// hearse-roof height, exactly where dispatch said it would be.
const CHAPTER4_BRANCH_X = 6500;   // the tree's branch crosses the road here
const CHAPTER4_DRAIN_X = 7150;    // where the head ends up
const CHAPTER4_GROUND_TOP = 395;  // road surface through the flat staging areas

function buildChapter4Terrain(worldWidth) {
    const points = [];
    const step = 80;
    const baseHeight = 380;

    for (let x = 0; x <= worldWidth; x += step) {
        let variation = 0;

        variation += Math.sin(x * 0.0013) * 8;
        variation += Math.sin(x * 0.0037) * 4;

        // Flat through the tree/drain gag so the staging is exact
        if (x > 5800 && x < 7600) variation = 0;
        // Flatten under the pickup, the melon stand, St. Anthony's, and phones
        if (Math.abs(x - 1500) < 300) variation = 0;
        if (Math.abs(x - 9000) < 200) variation = 0;
        if (Math.abs(x - 13200) < 450) variation = 0;
        if (Math.abs(x - 700) < 100 || Math.abs(x - 14500) < 100) variation = 0;

        points.push({
            x,
            horizonY: baseHeight + variation,
            groundY: baseHeight + variation + 15,
        });
    }
    return points;
}

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