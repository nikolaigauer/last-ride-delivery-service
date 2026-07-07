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
        // Chapter 3: the river in its cut, moving like it has somewhere to be
        if (this.currentIndex === 2) {
            const wx = CHAPTER3_GAP_X - cameraX;
            if (wx > -150 && wx < ctx.canvas.width + 150) {
                const t = performance.now() / 350;
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1.6;
                for (let i = 0; i < 3; i++) {
                    const wy = CHAPTER3_GROUND_TOP + 38 + i * 14;
                    const drift = Math.sin(t + i * 1.7) * 5;
                    ctx.beginPath();
                    ctx.moveTo(wx - 30 + drift, wy);
                    ctx.quadraticCurveTo(wx - 10 + drift, wy - 4, wx + 8 + drift, wy);
                    ctx.quadraticCurveTo(wx + 22 + drift, wy + 3, wx + 34 + drift, wy);
                    ctx.stroke();
                }
                ctx.restore();
            }
            return;
        }
        if (this.currentIndex !== 3) return;
        const groundTop = CHAPTER4_GROUND_TOP;

        // The storm drain, at the bottom of the bluff's eastern slope
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

    // === Chapter 4 scripted event: the fisherman's cart takes the hill ===
    // The recovered corpse waits, boxed, on a cart at the crest of the bluff.
    // Approach it on foot and it departs — east, downhill, into new country.
    // Mid-slope the coffin leaves the cart, the lid pops, the body ragdolls
    // down the slope, and the head separates in the tumble and rolls to the
    // storm drain at the bottom. The tumble does the severing this time —
    // no trees required.
    _updateChapter4Events(game) {
        const s = this._ch4;
        if (!s || s.phase === 'done') return;
        const bier = this._ch4PickupBier;
        switch (s.phase) {
            case 'armed':
                if (bier && bier.hasCoffin && !game.player.inVehicle &&
                    Math.abs((game.player.x + 20) - (bier.x + bier.width / 2)) < 135) {
                    bier.rolling = true;
                    bier.loose = true;
                    bier.chocked = false;
                    bier.vx = 1.4; // east. downhill. of course.
                    if (!game.monologue) game.monologue = new MonologueSystem();
                    game.monologue.playNow('No— not again. No.');
                    s.phase = 'chase';
                    s.timer = 0;
                }
                break;
            case 'chase':
                s.timer++;
                // Mid-slope, at speed, the coffin dismounts
                if (bier.x > 2980 || s.timer > 500) {
                    game.coffin.velocityX = Math.max(2.6, bier.vx + 0.8);
                    game.coffin.velocityY = -1.5;
                    game.coffin.onBier = false;
                    bier.hasCoffin = false;
                    game.coffin.bumpCounter = Math.max(game.coffin.bumpCounter, game.coffin.bumpThreshold);
                    game.coffin.lidOpen = true;
                    game.coffin.lidOpenedByBump = true;
                    if (game.audio && game.audio.playCorpseImpact) game.audio.playCorpseImpact(1.5);
                    s.phase = 'spill';
                    s.timer = 0;
                }
                break;
            case 'spill':
                s.timer++;
                // Game's update ejects the corpse; let the ragdoll tumble a
                // beat down the slope before the tumble claims the head.
                if (!game.corpse.inCoffin && s.timer > 30) {
                    if (!game.corpse.headDetached) game.corpse.detachHead();
                    s.phase = 'headRolls';
                    s.timer = 0;
                    const head = game.corpse.detachedHead;
                    s.fromX = head ? head.x : game.corpse.x;
                } else if (game.corpse.inCoffin && s.timer > 90) {
                    // Failsafe: lid open but body still in — force the spill
                    game.corpse.ejectFromCoffin(game.coffin.x, game.coffin.y, game.coffin.velocityX);
                }
                break;
            case 'headRolls': {
                s.timer++;
                const head = game.corpse.detachedHead;
                if (!head) { s.phase = 'gone'; s.timer = 0; break; }
                // Ground-hugging hops down the rest of the slope — a head
                // with somewhere to be. It keeps going.
                const T = 120;
                const t = Math.min(1, s.timer / T);
                const x = s.fromX + (CHAPTER4_DRAIN_X - s.fromX) * t;
                const y = game.terrain.getGroundYAt(x) - 9 -
                    Math.abs(Math.sin(t * Math.PI * 5)) * 24 * (1 - t * 0.7);
                head.x = x; head.y = y;
                head.oldX = x; head.oldY = y; // script drives; physics idles
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
                    // Coffin is out on the slope — help it remember gravity,
                    // and make sure the lid goes with it
                    if (game.coffin.body) {
                        Matter.Body.setVelocity(game.coffin.body, { x: -3.5, y: 0 });
                        Matter.Body.setAngularVelocity(game.coffin.body, -0.08);
                    }
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
                // Bouncing back DOWN the hill it just came up, into the water
                s.timer++;
                const T = 110;
                const t = Math.min(1, s.timer / T);
                const x = s.fromX + (CHAPTER3_GAP_X - 6 - s.fromX) * t;
                const groundY = game.terrain.getGroundYAt(Math.max(CHAPTER3_GAP_END + 10, x));
                const y = groundY - 42 - Math.abs(Math.sin(t * Math.PI * 4)) * 24 * (1 - t * 0.5);
                game.corpse.moveToPosition(x, y);
                if (t >= 1) {
                    s.phase = 'drifting';
                    s.timer = 0;
                }
                break;
            }
            case 'drifting': {
                // In the river. Sinking, and leaving — downstream is that way.
                s.timer++;
                const x = CHAPTER3_GAP_X - 6 - s.timer * 0.35;
                const y = CHAPTER3_GROUND_TOP - 20 + s.timer * 1.1;
                game.corpse.moveToPosition(x, y);
                if (s.timer >= 75) {
                    game.corpse.isActive = false; // gone. downstream. for now.
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
                    s.phase = 'deerWait';
                    s.timer = 0;
                }
                break;

            // === The deer is provided ===
            case 'deerWait':
                if (game.player.inVehicle && game.hearse.x > 8400 &&
                    Math.abs(game.hearse.velocity) > 2) {
                    s.phase = 'deerPOV';
                    s.timer = 0;
                }
                break;
            case 'deerPOV':
                s.timer++;
                if (s.timer === 38) {
                    // THUMP.
                    if (game.audio && game.audio.playCorpseImpact) game.audio.playCorpseImpact(2);
                    if (game.audio && game.audio.playStab) game.audio.playStab();
                    if (game.hearse.chassis) {
                        const v = game.hearse.chassis.velocity;
                        Matter.Body.setVelocity(game.hearse.chassis, { x: v.x * 0.25, y: v.y });
                    }
                    game.hearse.health = Math.max(0, game.hearse.health - 8);
                }
                if (s.timer >= 58) {
                    // Back to the world. Something lies on the road behind you.
                    game.roadkill.isActive = true;
                    game.roadkill.isPickedUp = false;
                    game.roadkill.inCoffin = false;
                    game.roadkill.x = game.hearse.x - 160;
                    s.phase = 'deerAfter';
                    s.timer = 0;
                }
                break;
            case 'deerAfter':
                s.timer++;
                if (s.timer === 150) {
                    if (!game.monologue) game.monologue = new MonologueSystem();
                    game.monologue.playNow('…About the right size.');
                    s.phase = 'done';
                }
                break;
        }
    }

    // Full-frame event overlays (drawn near the end of Game.render).
    // Currently: the chapter-3 deer strike, seen from the driver's seat.
    drawEventOverlay(ctx) {
        if (this.currentIndex !== 2 || !this._ch3 || this._ch3.phase !== 'deerPOV') return;
        const s = this._ch3;
        const w = ctx.canvas.width, h = ctx.canvas.height;

        ctx.save();

        // Shake after the impact
        if (s.timer > 38) {
            const decay = 1 - (s.timer - 38) / 20;
            ctx.translate((Math.random() - 0.5) * 12 * decay, (Math.random() - 0.5) * 12 * decay);
        }

        // Cab interior
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, w + 40, h + 40);

        // Windshield + road (same grammar as the daymare POV)
        const wsX = 170, wsY = 70, wsW = 660, wsH = 280;
        const vpX = w / 2, vpY = 215;
        ctx.fillStyle = '#f2f1ec';
        ctx.beginPath();
        ctx.roundRect(wsX, wsY, wsW, wsH, 14);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(wsX, wsY, wsW, wsH, 14);
        ctx.clip();

        ctx.fillStyle = '#d9d7d0';
        ctx.fillRect(wsX, vpY, wsW, wsY + wsH - vpY);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wsX, vpY); ctx.lineTo(wsX + wsW, vpY);
        ctx.moveTo(280, wsY + wsH); ctx.lineTo(vpX, vpY);
        ctx.moveTo(720, wsY + wsH); ctx.lineTo(vpX, vpY);
        ctx.stroke();

        // THE DEER — standing on the road, mid-crossing, growing fast.
        // It has already turned its head. It has already judged you.
        if (s.timer <= 42) {
            const t = Math.min(1, s.timer / 38);
            const sc = 0.35 + t * t * 1.5;            // accelerating approach
            const dy = vpY + 12 + t * t * 150;         // drops down-frame as it nears
            const dx = vpX + 20 - t * 30;
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#000';
            ctx.lineCap = 'round';
            // Legs
            ctx.lineWidth = 4 * sc;
            for (const off of [-26, -14, 12, 24]) {
                ctx.beginPath();
                ctx.moveTo(dx + off * sc, dy);
                ctx.lineTo(dx + off * sc, dy + 40 * sc);
                ctx.stroke();
            }
            // Body
            ctx.beginPath();
            ctx.ellipse(dx, dy - 8 * sc, 36 * sc, 15 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
            // Neck + head, turned toward the windshield
            ctx.beginPath();
            ctx.ellipse(dx - 30 * sc, dy - 30 * sc, 9 * sc, 14 * sc, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(dx - 34 * sc, dy - 44 * sc, 10 * sc, 8 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
            // Antlers
            ctx.lineWidth = 2.5 * sc;
            ctx.beginPath();
            ctx.moveTo(dx - 38 * sc, dy - 50 * sc); ctx.lineTo(dx - 46 * sc, dy - 66 * sc);
            ctx.moveTo(dx - 42 * sc, dy - 58 * sc); ctx.lineTo(dx - 52 * sc, dy - 62 * sc);
            ctx.moveTo(dx - 30 * sc, dy - 51 * sc); ctx.lineTo(dx - 26 * sc, dy - 68 * sc);
            ctx.stroke();
            // Eyes — two white points, fixed on you
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(dx - 38 * sc, dy - 45 * sc, 2.2 * sc, 0, Math.PI * 2);
            ctx.arc(dx - 30 * sc, dy - 45 * sc, 2.2 * sc, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore(); // windshield clip

        // Dash, wheel, hands — white ink on black
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(60, 392); ctx.lineTo(w - 60, 392);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vpX, 625, 220, Math.PI * 1.32, Math.PI * 1.68);
        ctx.stroke();
        for (const hx of [vpX - 95, vpX + 95]) {
            ctx.beginPath();
            ctx.arc(hx, 423, 11, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.stroke();
        }

        // Impact flash
        if (s.timer > 42 && s.timer <= 50) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-20, -20, w + 40, h + 40);
        }

        ctx.restore();
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
                game.biers = [game.hospitalBier, game.church.bier];
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
                if (!game.church2.bier) game.church2.bier = new Bier(15450);
                game.church2.bier.x = 15450;
                game.church2.bier.hasCoffin = false;
                game.church2.bier.chocked = false;
                game.biers = [game.church2.bier];

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

                // 7. Disable chapter-1 drawbridge during chapter 2. (The old
                // plank-over-gap puzzle is retired — the long empty road and
                // the daymare ARE chapter 2.)
                if (game.bridge) game.bridge.setActive(false);
                if (game.plankRavine) game.plankRavine.active = false;
                if (game.planks) {
                    for (const p of game.planks) p.destroy && p.destroy();
                    game.planks.length = 0;
                }

                // 8. Chapter-aware respawn checkpoint
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
                // The Hillcrest bier — an honest, stationary one. (The cart
                // with opinions about hills comes later, with the real corpse.)
                if (!game.graveyard.bier) game.graveyard.bier = new Bier(13380);
                const gBier = game.graveyard.bier;
                gBier.x = 13380;
                gBier.hasCoffin = false;
                gBier.runaway = false;
                gBier.rolling = false;
                gBier.grabbed = false;
                gBier.loose = false;
                gBier.chocked = false;
                gBier.vx = 0;

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

                // 6. The casket, boxed and waiting on a bier out front
                if (!this._ch3PickupBier) this._ch3PickupBier = new Bier(1620);
                this._ch3PickupBier.x = 1620;
                this._ch3PickupBier.hasCoffin = true;
                this._ch3PickupBier.chocked = true;
                game.biers = [this._ch3PickupBier, gBier];
                game.coffin.isActive = true;
                game.coffin.inHearse = false;
                game.coffin.isPickedUp = false;
                game.coffin.onBier = true;
                game.coffin.lidOpen = false;
                game.coffin.lidOpenedByBump = false;
                game.coffin.x = 1630;
                game.coffin.y = 395 - 34 - game.coffin.height;
                game.coffin.velocityX = 0;
                game.coffin.velocityY = 0;
                game.corpse.isActive = true;
                game.corpse.inCoffin = true;
                game.corpse.isPickedUp = false;
                game.corpse.moveToPosition(game.coffin.x, game.coffin.y);

                // 7. The deer is not there yet. The deer will be provided.
                game.roadkill.setKind('deer');
                game.roadkill.isActive = false;
                game.roadkill.inCoffin = false;
                game.roadkill.isPickedUp = false;

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
                    { triggerX: 6250, text: 'Smooth so far.' },
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
                if (!game.church4.bier) game.church4.bier = new Bier(12950);
                game.church4.bier.x = 12950;
                game.church4.bier.hasCoffin = false;
                game.church4.bier.chocked = false;
                // The fisherman's cart, at the crest of the bluff. Unchocked.
                if (!this._ch4PickupBier) this._ch4PickupBier = new Bier(CHAPTER4_BLUFF_X);
                this._ch4PickupBier.x = CHAPTER4_BLUFF_X;
                this._ch4PickupBier.hasCoffin = true;
                this._ch4PickupBier.chocked = false;
                this._ch4PickupBier.loose = false;
                this._ch4PickupBier.rolling = false;
                this._ch4PickupBier.grabbed = false;
                this._ch4PickupBier.vx = 0;
                game.biers = [this._ch4PickupBier, game.church4.bier];

                // 4. Phones
                if (!game.openingPhone) game.openingPhone = new PhoneBooth(700, 300);
                game.openingPhone.active = true;
                game.openingPhone.x = 700;
                game.openingPhone.isRinging = true;
                game.openingPhone.isAnswered = false;
                game.openingPhone.briefing = {
                    title: 'Dispatch — Quiet Job',
                    message: "A fisherman pulled something out of the river, ten miles down from the crossing. It's him. The one from Hillcrest. Don't ask how I know.\n\nFamily wants a real service after all — open casket, St. Anthony's. The whole man, presentable.\n\nHe's boxed and waiting on the bluff. Collect him quietly.",
                    instruction: 'The bluff, east of here. Then St. Anthony’s.'
                };
                if (!game.closingPhone) game.closingPhone = new PhoneBooth(14500, 300);
                game.closingPhone.active = true;
                game.closingPhone.x = 14500;
                game.closingPhone.isRinging = false;
                game.closingPhone.isAnswered = false;

                // 5. The recovered client, boxed on the cart at the crest.
                //    Ten miles of river did him no favors.
                game.coffin.isActive = true;
                game.coffin.inHearse = false;
                game.coffin.isPickedUp = false;
                game.coffin.onBier = true;
                game.coffin.lidOpen = false;
                game.coffin.lidOpenedByBump = false;
                game.coffin.bumpCounter = 0;
                game.coffin.x = CHAPTER4_BLUFF_X + 8;
                game.coffin.y = 300 - 34 - game.coffin.height;
                game.coffin.velocityX = 0;
                game.coffin.velocityY = 0;
                game.corpse.isActive = true;
                game.corpse.inCoffin = true;
                game.corpse.isPickedUp = false;
                game.corpse.health = 55; // he's seen better days. and drier ones.
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
                    { triggerX: 1100, text: 'Ten miles downriver. Persistent fellow.' },
                    { triggerX: 5300, text: 'Open casket. Everyone wants to look. Nobody wants to see.' },
                    { triggerX: 11000, text: 'Almost there. Keep the lid shut.' },
                    { triggerX: 12200, text: "St. Anthony's. Say nothing." },
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

// Chapter 4 terrain: the fisherman's bluff — a climb to a crest where the
// recovered corpse waits on a cart, and a long slope EAST for the cart to
// take without permission. The head's destination (a storm drain) sits at
// the bottom of that slope.
const CHAPTER4_BLUFF_X = 2300;    // the cart waits at the crest
const CHAPTER4_DRAIN_X = 3900;    // where the head ends up
const CHAPTER4_GROUND_TOP = 395;  // road surface through the flat staging areas

function buildChapter4Terrain(worldWidth) {
    const points = [];
    const step = 80;
    const baseHeight = 380;

    for (let x = 0; x <= worldWidth; x += step) {
        let variation = 0;

        variation += Math.sin(x * 0.0013) * 8;
        variation += Math.sin(x * 0.0037) * 4;

        // Flat spawn + phone
        if (x < 850) variation = 0;
        // The bluff: up, crest, and the long eastern slope down to the drain
        if (x >= 1400 && x < 2060) variation = -((x - 1400) / 660) * 80;
        else if (x >= 2060 && x < 2620) variation = -80;
        else if (x >= 2620 && x < 3560) variation = -80 + ((x - 2620) / 940) * 80;
        else if (x >= 3560 && x < 4300) variation = 0; // drain flats
        // Flatten under the melon stand, St. Anthony's, and the last phone
        if (Math.abs(x - 9000) < 200) variation = 0;
        if (Math.abs(x - 13200) < 450) variation = 0;
        if (Math.abs(x - 14500) < 100) variation = 0;

        points.push({
            x,
            horizonY: baseHeight + variation,
            groundY: baseHeight + variation + 15,
        });
    }
    return points;
}

// Chapter 3 terrain: rolling road, a RIVER in a narrow cut (bridged), then a
// long climb. The loss happens ON the climb: door pops, the coffin slides
// back down the hill it just came up, and the body goes into the water.
const CHAPTER3_GAP_X = 6000;      // the river (single deep terrain point)
const CHAPTER3_GAP_START = 5960;  // west bank
const CHAPTER3_GAP_END = 6040;    // east bank
const CHAPTER3_GROUND_TOP = 395;  // road surface at the banks
const CHAPTER3_LOSS_X = 6740;     // mid-climb, past the river — where it starts

function buildChapter3Terrain(worldWidth) {
    const points = [];
    const step = 80;
    const baseHeight = 380;

    for (let x = 0; x <= worldWidth; x += step) {
        let variation = 0;

        // Gentle rolling — a nicer day than yesterday, on paper
        variation += Math.sin(x * 0.0011) * 9;
        variation += Math.sin(x * 0.0031) * 4;

        // The river: single unrecoverable deep point in a narrow cut
        if (x === CHAPTER3_GAP_X) {
            variation = 500;
        }

        // Flat banks either side of the river so the bridge sits flush
        if (x !== CHAPTER3_GAP_X && Math.abs(x - CHAPTER3_GAP_X) < 340) {
            variation = 0;
        }

        // The climb east of the river — the coffin will come back down it
        if (x >= 6340 && x < 7140) variation = -((x - 6340) / 800) * 80;
        else if (x >= 7140 && x < 7540) variation = -80;
        else if (x >= 7540 && x < 8140) variation = -80 + ((x - 7540) / 600) * 80;

        // Flatten under St. Margaret's and the phones
        if (Math.abs(x - 1300) < 450) variation = 0;
        if (Math.abs(x - 700) < 100 || Math.abs(x - 15200) < 100) variation = 0;

        // Hillcrest earns its name: a long climb up to the plot, flat at the
        // crest, back down the far side. A cart with wheels will notice.
        if (x > 12300 && x < 13300) variation = -((x - 12300) / 1000) * 90;
        else if (x >= 13300 && x < 14300) variation = -90;
        else if (x >= 14300 && x < 15000) variation = -90 + ((x - 14300) / 700) * 90;

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