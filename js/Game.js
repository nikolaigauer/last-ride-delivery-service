// Main game class that orchestrates all systems

class StickmanGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Initialize all game systems
        this.physics = new Physics();
        this.input = new InputManager();
        this.terrain = new Terrain(25000); // Epic journey world size
        this.terrain.buildMatterBody(this.physics); // Phase 2: static terrain for Matter collisions
        this.showDebug = true; // Debug toggle state
        this.audio = new AudioEngine(); // Audio engine for procedural sounds

        // Initialize game objects
        this.player = new Player(300, 320);
        this.hearse = new Hearse(100, 280);
        this.hearse.buildMatterBodies(this.physics); // Phase 3: hearse as Matter composite
        this.coffin = new Coffin(-1000, 340); // Start off-screen until hospital spawns them
        this.coffin.buildMatterBody(this.physics); // Phase 4: coffin as Matter body when free
        this.corpse = new Corpse(-1000, 300); // Start off-screen until hospital spawns them

        // Mark them as inactive until hospital interaction
        this.coffin.isActive = false;
        this.corpse.isActive = false;
        this.phoneBooth = new PhoneBooth(800, 300); // Dispatch phone booth for missions
        this.hospital = new Hospital(2500, 280); // Hospital morgue pickup location
        this.church = new Church(22000, 280, "St. Mary's"); // Wrong church (episode 1)
        this.deliveryBooth = new PhoneBooth(23000, 300); // "Wrong church" callback phone
        this.church2 = new Church(24500, 280, "St. Margaret's"); // Real destination (episode 2)
        this.church2.active = false; // Chapter 2 will activate + reposition
        this.graveyard = null; // Chapter 3 destination (lazy)
        this.church4 = null;   // Chapter 4 destination (lazy)
        this.roadkill = new Roadkill(-1000, 300); // Substitute cargo: ch.3 deer, ch.4 melon (inactive until then)

        // Chapter-2 lazy slots (created on chapter swap)
        this.openingPhone = null;
        this.closingPhone = null;
        this.monologue = null;
        this.dreamSequence = new DreamSequence(); // ch.2 daymare (auto-triggers once)
        this.bridge = new Bridge(this.physics);  // Chapter 1: counterweight drawbridge
        this.plankRavine = null;                 // Chapter 2: plank-bridged chasm (lazy)
        this.planks = [];
        this.heldPlank = null;
        // this.potholeManager = new PotholeManager(); // Terrain hazards - REMOVED

        // Start player in hearse for streamlined beginning
        this.player.enterHearse(this.hearse);

        // Camera system
        this.cameraX = 0;
        this.targetCameraX = 0;

        // Mission system
        this.missionBriefing = null;
        this.briefingTimer = 0;

        // Episode state: 1 = heading to St. Mary's (wrong), 2 = heading to St. Margaret's (real), 'complete'
        this.currentEpisode = 1;

        // Game-over / respawn state
        // 'dying' → fade in, 'dead' → show prompt, null → alive
        this.deathState = null;
        this.deathAlpha = 0;
        // Checkpoint: respawn just west of the bridge so player retries the puzzle
        this.checkpointX = 14500;

        // Delivery booth only rings after the wrong-church drop
        this.deliveryBooth.isRinging = false;

        // Generate potholes across the world - REMOVED
        // this.potholeManager.generatePotholes(50000);

        // Dev tools (editors) only load with ?dev=1 query string
        this.isDevMode = typeof window !== 'undefined' && window.location.search.includes('dev=1');
        const noopEditor = { isActive: false, update: () => {}, draw: () => {}, toggle: () => {} };
        this.corpseEditor = this.isDevMode ? new CorpseEditor(this) : noopEditor;
        this.chapterManager = new ChapterManager(this);
        
        // Expose level management commands to console for testing
        window.game = this;
        this.exposeConsoleCommands();

        // Start the game loop
        this.gameLoop();
        
        // Start background music after a short delay
        setTimeout(() => {
            this.audio.startBackgroundMusic();
        }, 2000);
    }

    // Eject the coffin out of the hearse onto the church grounds, lid pops, corpse spills.
    // Used at both St. Mary's (episode 1) and St. Margaret's (episode 2).
    dropCargoOnChurchGrounds() {
        if (!this.coffin.isActive || !this.coffin.inHearse) return;
        this.coffin.ejectFromHearse(this.hearse.x, this.hearse.y, this.hearse.velocity, this.hearse.tiltAngle);
        this.coffin.lidOpen = true;
        this.coffin.lidOpenedByBump = true; // Update loop will auto-eject the corpse next frame
    }

    // Episode 1 result — coffin's at the wrong church, deliveryBooth starts ringing.
    // The card is delayed so the drop plays out on screen before the cut to black.
    showDeliveryResult(deliveryResult) {
        const completion = {
            title: "Delivered — St. Mary's",
            message: deliveryResult.message,
            instruction: "A phone is ringing, further east."
        };
        this.showMissionBriefing(completion, 1200, 110);
        this.deliveryBooth.isRinging = true;
        console.log(`🕊️ Episode 1 drop complete. Score: ${deliveryResult.score}/100`);
    }

    // Wrong-church gag: dispatcher reveals the actual destination is St. Margaret's.
    answerWrongChurchPhone() {
        const briefing = {
            title: "Dispatch — Long Pause",
            message: "Yeah... about that drop.\n\nThat was St. Mary's, wasn't it. Family's at St. Margaret's. Different church. They sound similar, I know.\n\nGrab the casket. Head east. Don't make a thing of it.",
            instruction: "Pick the casket back up. East, to St. Margaret's."
        };
        this.showMissionBriefing(briefing);
        this.deliveryBooth.isRinging = false;
        this.deliveryBooth.isAnswered = true;
        this.currentEpisode = 2;
        console.log('☎️ Wrong church revealed. Episode 2 begins.');
    }

    // Episode 2 result — final delivery, dispatcher will call again at the closing phone.
    showFinalCompletion(deliveryResult) {
        const completion = {
            title: "Delivered — St. Margaret's",
            message: `${deliveryResult.message}\n\nThe right church, this time.`,
            instruction: "The phone again. Further east."
        };
        this.showMissionBriefing(completion, 1200, 110);
        console.log(`🕯️ Chapter 2 drop complete. Score: ${deliveryResult.score}/100`);
    }

    // Closing call — the same booth serves every chapter; the words change.
    answerClosingPhone() {
        const idx = this.chapterManager ? this.chapterManager.currentIndex : 1;
        let briefing, nextEpisode;
        if (idx === 3) {
            briefing = {
                title: "Dispatch — Last Call",
                message: "Family's very happy. Said the service changed the way they see him.\n\nStop telling me how you do this. I mean it.\n\nGo home. That's the last one. For today.",
                instruction: "THE END — thank you for playing."
            };
            nextEpisode = 'the_end';
        } else if (idx === 2) {
            briefing = {
                title: "Dispatch — End of the Line",
                message: "Widow says he never looked better. The whole family was moved.\n\nI don't want to know. Whatever happened out there, I don't want to know.\n\nGo home. Wash the hearse. Burn the gloves.",
                instruction: "Drive east when you're ready."
            };
            nextEpisode = 'series_end';
        } else {
            briefing = {
                title: "Dispatch — End of Shift",
                message: "Yeah, that's the one. Good work.\n\nGo home. Wash the hearse. There'll be another call.\n\nThere's always another call.",
                instruction: "Drive east when you're ready."
            };
            nextEpisode = 'complete';
        }
        this.showMissionBriefing(briefing);
        if (this.closingPhone) {
            this.closingPhone.isRinging = false;
            this.closingPhone.isAnswered = true;
        }
        this.currentEpisode = nextEpisode;
        console.log(`☎️ Closing call answered (chapter ${idx + 1}).`);
    }

    showChurch4Completion(deliveryResult) {
        const completion = {
            title: "Delivered — St. Anthony's",
            message: `${deliveryResult.message}\n\nNobody said a word about the melon on the lawn.`,
            instruction: "The phone. One more time."
        };
        this.showMissionBriefing(completion, 1200, 110);
        console.log(`⛪ Chapter 4 delivery complete. Substituted: ${deliveryResult.substituted}`);
    }

    // Chapter-3 grave-side drop: the coffin slides out and the lid STAYS SHUT.
    // Closed casket. Whatever ejection did to the lid, undo it. Nobody looks.
    dropCargoAtGraveClosed() {
        if (!this.coffin.isActive || !this.coffin.inHearse) return;
        this.coffin.ejectFromHearse(this.hearse.x, this.hearse.y, this.hearse.velocity, this.hearse.tiltAngle);
        this.coffin.lidOpen = false;
        this.coffin.lidOpenedByBump = false;
        this.coffin.bumpCounter = 0;
    }

    showGraveCompletion(deliveryResult) {
        const completion = {
            title: "Delivered — Hillcrest",
            message: `${deliveryResult.message}\n\nThe ground doesn't ask questions.`,
            instruction: "The phone. You know the routine."
        };
        this.showMissionBriefing(completion, 1200, 110);
        console.log(`⚰️ Chapter 3 delivery complete. Substituted: ${deliveryResult.substituted}`);
    }

    update() {
        // Step Matter.js engine (no bodies yet — Phase 1 foundation)
        this.physics.step();

        // Editor toggle only responds in dev mode (?dev=1)
        if (this.isDevMode) {
            if (this.input.isKeyPressed('KeyC')) {
                this.corpseEditor.toggle();
                this.input.clearKey('KeyC');
            }
        }

        // Handle debug toggle (D key)
        if (this.input.isKeyPressed('KeyD')) {
            this.showDebug = !this.showDebug;
            this.input.clearKey('KeyD');
            console.log(`Debug panel ${this.showDebug ? 'enabled' : 'disabled'}`);
        }

        // Skip normal game updates if the editor is active
        if (this.corpseEditor.isActive) {
            this.corpseEditor.update();
            return;
        }

        // Handle spacebar interactions
        if (this.input.isKeyPressed('Space')) {
            if (this.deathState === 'dead') {
                this.respawnAtCheckpoint();
            } else if (this.missionBriefing) {
                this.dismissMissionBriefing();
            } else {
                this.handleInteractions();
            }
            this.input.clearKey('Space');
        }

        // Update all game objects (hearse first, then player follows)
        this.hearse.update(this.terrain, this.input, this.player, this.coffin);
        this.player.update(this.input, this.terrain, this.hearse);

        // Block player from walking across gorge when bridge is raised (chapter 1 only)
        if (this.bridge && this.bridge.active && !this.bridge.isGorgeOpen() && !this.player.inVehicle) {
            const gorgeL = this.bridge.leftEdgeX;
            const gorgeR = this.bridge.rightEdgeX;
            const playerCX = this.player.x + this.player.width / 2;
            if (playerCX > gorgeL && playerCX < gorgeR) {
                // Push to nearest edge
                if (playerCX < (gorgeL + gorgeR) / 2) {
                    this.player.x = gorgeL - this.player.width;
                } else {
                    this.player.x = gorgeR;
                }
            }
        }

        // Update audio based on game state
        if (this.player.inVehicle) {
            this.audio.updateEngine(this.hearse.velocity, this.hearse.isAirborne);
        }
        this.phoneBooth.update(this.terrain);
        this.deliveryBooth.update(this.terrain);
        this.hospital.update(this.terrain);
        this.church.update(this.terrain);
        this.church2.update(this.terrain);
        if (this.graveyard) this.graveyard.update(this.terrain);
        if (this.church4) this.church4.update(this.terrain);
        this.roadkill.update(this.terrain);

        // Carry the deer with the player
        if (this.roadkill.isActive && this.roadkill.isPickedUp) {
            this.roadkill.x = this.player.x + 26;
            this.roadkill.y = this.player.y - 8;
        }

        // Chapter 1: drawbridge update (no-op when inactive)
        if (this.bridge) this.bridge.update(this.coffin, this.hearse);

        // Chapter-2 entities (no-op when inactive / null)
        if (this.openingPhone) this.openingPhone.update(this.terrain);
        if (this.closingPhone) this.closingPhone.update(this.terrain);
        if (this.plankRavine) {
            for (const plank of this.planks) plank.update(this.terrain);
        }
        if (this.monologue && !this.dreamSequence.blocksMonologue()) {
            const trackX = this.player.inVehicle ? this.hearse.x : this.player.x;
            this.monologue.update(trackX);
        }

        this.dreamSequence.update(this);

        // Carry held plank with the player
        if (this.heldPlank && this.heldPlank.isPickedUp) {
            this.heldPlank.x = this.player.x - this.heldPlank.width / 2 + this.player.width / 2;
            this.heldPlank.y = this.player.y - 30;
        }

        this.chapterManager.update();
        // this.potholeManager.update(this.terrain); - REMOVED
        
        // Check for pothole collisions - REMOVED
        // this.potholeManager.checkCollisions(this.hearse, this.coffin);

        // Only update coffin and corpse if they're active (spawned by hospital)
        if (this.coffin.isActive) {
            this.coffin.update(this.terrain);

            // If corpse is in coffin but coffin is not being carried, move corpse with coffin ONLY if coffin moved
            if (this.corpse.inCoffin && !this.coffin.isPickedUp && this.coffin.isActive) {
                const coffinMoved = (Math.abs(this.coffin.x - this.corpse.x) > 1 || Math.abs(this.coffin.y - this.corpse.y) > 1);
                if (coffinMoved) {
                    this.corpse.moveToPosition(this.coffin.x, this.coffin.y);
                }
            }
        }

        // Update corpse physics when active and not in coffin
        // NOTE: We now update even when picked up so limbs can dangle!
        if (this.corpse.isActive && !this.corpse.inCoffin) {
            this.corpse.updatePhysics(this.terrain);
        }
        
        // Update detached head physics if it exists
        if (this.corpse.isActive && this.corpse.detachedHead) {
            this.corpse.updateDetachedHead(this.terrain);
        }

        // Handle carried objects (only if active)
        if (this.coffin.isActive && this.coffin.isPickedUp) {
            this.coffin.x = this.player.x - 20;
            this.coffin.y = this.player.y - 10;

            // If corpse is in coffin, move it with the coffin
            if (this.corpse.inCoffin) {
                this.corpse.moveToPosition(this.coffin.x, this.coffin.y);
            }
        }

        if (this.corpse.isActive && this.corpse.isPickedUp) {
            this.corpse.moveToPosition(this.player.x + 30, this.player.y - 5);
        }
        
        // Handle carried detached head
        if (this.corpse.isActive && this.corpse.detachedHead && this.corpse.detachedHead.isPickedUp) {
            this.corpse.detachedHead.x = this.player.x + 25;
            this.corpse.detachedHead.y = this.player.y - 15;
            this.corpse.detachedHead.oldX = this.corpse.detachedHead.x;
            this.corpse.detachedHead.oldY = this.corpse.detachedHead.y;
        }

        // Handle coffin ejection from hearse (only if active)
        if (this.coffin.isActive && this.hearse.shouldEjectCoffin(this.terrain, this.coffin)) {
            console.log(`☠️ COFFIN EJECTING! Before: inHearse=${this.coffin.inHearse}, bumps=${this.coffin.bumpCounter}, lidOpen=${this.coffin.lidOpen}, lidByBump=${this.coffin.lidOpenedByBump}`);
            this.coffin.ejectFromHearse(this.hearse.x, this.hearse.y, this.hearse.velocity, this.hearse.tiltAngle);
            console.log(`☠️ COFFIN EJECTED! After: inHearse=${this.coffin.inHearse}, bumps=${this.coffin.bumpCounter}, lidOpen=${this.coffin.lidOpen}, lidByBump=${this.coffin.lidOpenedByBump}`);
        }

        // Handle corpse ejection from coffin (only if active)
        if (this.corpse.isActive && this.corpse.inCoffin && this.coffin.shouldEjectCorpse()) {
            console.log(`🚨 EJECTING CORPSE! coffinPos=(${this.coffin.x.toFixed(0)}, ${this.coffin.y.toFixed(0)}), corpsePos=(${this.corpse.x.toFixed(0)}, ${this.corpse.y.toFixed(0)})`);
            this.corpse.ejectFromCoffin(this.coffin.x, this.coffin.y, this.coffin.velocityX);
        }

        // Check hospital cargo spawning (now requires manual interaction + hearse in loading area)
        if (this.hospital.playerHasInteracted && !this.hospital.hasSpawnedCargo) {
            if (this.hospital.checkHearseInLoadingArea(this.hearse)) {
                console.log('🚗 Hearse in loading area - spawning cargo!');
                this.hospital.spawnCargo(this.coffin, this.corpse, this.hearse);
            }
        }

        // Coffin rescue — if it sinks below terrain, surface it
        if (this.coffin.isActive && !this.coffin.inHearse && !this.coffin.isPickedUp && this.coffin.body) {
            const maxGroundY = this.terrain.getGroundYAt(this.coffin.x + this.coffin.width / 2) + 30;
            if (this.coffin.y > maxGroundY) {
                Matter.Body.setPosition(this.coffin.body, {
                    x: this.coffin.x + this.coffin.width / 2,
                    y: maxGroundY - this.coffin.height / 2,
                });
                Matter.Body.setVelocity(this.coffin.body, { x: 0, y: 0 });
            }
        }

        // Death detection — player falls off screen
        if (this.deathState === null && this.player.y > this.canvas.height + 20) {
            this.deathState = 'dying';
            this.deathAlpha = 0;
        }

        // Death fade animation
        if (this.deathState === 'dying') {
            this.deathAlpha = Math.min(1, this.deathAlpha + 0.025);
            if (this.deathAlpha >= 1) this.deathState = 'dead';
        }

        // Update camera
        this.updateCamera();

        // Update mission briefing timer
        this.updateMissionBriefing();
    }

    respawnAtCheckpoint() {
        // Respawn player on foot just west of the bridge
        if (this.player.inVehicle) this.player.exitHearse(this.hearse, this.terrain);
        this.player.x = this.checkpointX;
        this.player.y = this.terrain.getGroundYAt(this.checkpointX) - this.player.height;

        // If hearse also fell, bring it back
        if (this.hearse.y > this.canvas.height) {
            this.hearse.teleportTo(this.checkpointX - 300, this.terrain.getGroundYAt(this.checkpointX - 300) - 80);
        }

        this.deathState = null;
        this.deathAlpha = 0;
    }

    handleInteractions() {
        const distanceToHearse = this.player.getDistanceTo(this.hearse);
        const distanceToCoffin = this.player.getDistanceTo(this.coffin);
        const distanceToCorpse = this.player.getDistanceTo(this.corpse);

        // Priority order: phone booth -> corpse pickup -> coffin pickup -> coffin loading -> corpse loading -> hearse entry/exit

        // Check phone booth interaction first (highest priority)
        if (this.phoneBooth.canInteract(this.player) && this.phoneBooth.isRinging) {
            const mission = this.phoneBooth.answer();
            this.showMissionBriefing(mission);
            return; // Exit early after phone interaction
        }

        // Chapter-3 opening call (reused openingPhone with its own briefing)
        if (this.openingPhone && this.openingPhone.isRinging && this.openingPhone.briefing &&
            this.openingPhone.canInteract(this.player)) {
            this.showMissionBriefing(this.openingPhone.answer());
            return;
        }

        // Episode 3: deliver at the family plot (corpse or... whatever's in the box)
        if (this.currentEpisode === 3 && this.graveyard &&
            this.graveyard.canCompleteDelivery(this.hearse, this.coffin, this.corpse, this.roadkill)) {
            const deliveryResult = this.graveyard.completeDelivery(this.hearse, this.coffin, this.corpse, this.roadkill);
            this.dropCargoAtGraveClosed();
            this.showGraveCompletion(deliveryResult);
            this.currentEpisode = 'awaiting_final_call';
            if (this.closingPhone) this.closingPhone.isRinging = true;
            return;
        }

        // Episode 4: the open casket at St. Anthony's. The lid comes up in
        // public — the body spills, and so does whatever rode along with it.
        if (this.currentEpisode === 4 && this.church4 &&
            this.church4.canCompleteDelivery(this.hearse, this.coffin, this.corpse, this.roadkill)) {
            const deliveryResult = this.church4.completeDelivery(this.hearse, this.coffin, this.corpse, this.roadkill);
            this.dropCargoOnChurchGrounds();
            if (this.roadkill.inCoffin) {
                this.roadkill.inCoffin = false;
                this.roadkill.x = this.coffin.x + this.coffin.width + 6;
            }
            this.showChurch4Completion(deliveryResult);
            this.currentEpisode = 'awaiting_end_call';
            if (this.closingPhone) this.closingPhone.isRinging = true;
            return;
        }

        // Episode 1: drop at St. Mary's (the wrong church)
        if (this.currentEpisode === 1 && this.church.canCompleteDelivery(this.hearse, this.coffin, this.corpse)) {
            const deliveryResult = this.church.completeDelivery(this.hearse, this.coffin, this.corpse);
            this.dropCargoOnChurchGrounds();
            this.showDeliveryResult(deliveryResult);
            return;
        }

        // Episode 2: drop at St. Margaret's (the real one)
        if (this.currentEpisode === 2 && this.church2.canCompleteDelivery(this.hearse, this.coffin, this.corpse)) {
            const deliveryResult = this.church2.completeDelivery(this.hearse, this.coffin, this.corpse);
            this.dropCargoOnChurchGrounds();
            this.showFinalCompletion(deliveryResult);
            this.currentEpisode = 'awaiting_closing_call';
            if (this.closingPhone) this.closingPhone.isRinging = true;
            return;
        }

        // Wrong-church callback phone after episode-1 drop
        if (this.deliveryBooth.canInteract(this.player) && this.deliveryBooth.isRinging) {
            this.answerWrongChurchPhone();
            return;
        }

        // Closing phone (chapter-2 wrap-up)
        if (this.closingPhone && this.closingPhone.canInteract(this.player) && this.closingPhone.isRinging) {
            this.answerClosingPhone();
            return;
        }

        // Plank placement (must be holding a plank, near a ravine edge)
        if (this.heldPlank && this.plankRavine && this.plankRavine.canPlacePlank(this.player, this.heldPlank)) {
            this.plankRavine.placePlank(this.heldPlank);
            this.heldPlank = null;
            console.log('🪵 Plank placed across chasm');
            return;
        }

        // Plank pickup (when not in vehicle, not carrying coffin/corpse, not already holding plank)
        if (!this.player.inVehicle && !this.heldPlank && !this.coffin.isPickedUp && !this.corpse.isPickedUp) {
            for (const plank of this.planks) {
                if (plank.canPickup(this.player)) {
                    plank.pickUp(this.player);
                    this.heldPlank = plank;
                    console.log('🪵 Picked up plank');
                    return;
                }
            }
        }

        // Check hospital door interaction (second priority)
        if (this.hospital.canPlayerInteractWithDoor(this.player)) {
            this.hospital.interactWithDoor();
            return; // Exit early after hospital interaction
        }

        // Roadkill pickup (chapter 3) — hands must be empty
        if (this.roadkill.canPickup(this.player) &&
            !this.coffin.isPickedUp && !this.corpse.isPickedUp && !this.heldPlank &&
            !(this.corpse.detachedHead && this.corpse.detachedHead.isPickedUp)) {
            this.roadkill.isPickedUp = true;
            console.log('🦌 Picked up the deer');
            return;
        }

        // Carrying the deer: load into coffin, or put it down
        if (!this.player.inVehicle && this.roadkill.isActive && this.roadkill.isPickedUp) {
            if (this.coffin.isActive && distanceToCoffin < 60 && !this.coffin.inHearse && !this.coffin.isPickedUp) {
                this.roadkill.isPickedUp = false;
                this.roadkill.inCoffin = true;
                this.coffin.lidOpen = true;
                this.coffin.lidOpenedByBump = false;
                this.coffin.lidTimer = 30;
                if (!this.monologue) this.monologue = new MonologueSystem();
                this.monologue.playNow(this.roadkill.kind === 'melon' ? 'Close enough.' : 'God forgive me.');
                console.log(`📦 ${this.roadkill.kind} loaded into coffin. Nobody saw.`);
            } else {
                this.roadkill.drop(this.player, this.terrain);
                console.log('🦌 Put the deer down');
            }
            return;
        }
        if (!this.player.inVehicle && this.corpse.isActive && !this.coffin.isPickedUp && !this.corpse.isPickedUp &&
            distanceToCorpse < 60 && !this.corpse.inCoffin && this.corpse.ejectionImmunityTimer === 0) {
            // Pick up corpse
            this.corpse.isPickedUp = true;
            console.log('Picked up corpse');

        // Check detached head pickup (only if NOT already carrying it and NOT already in coffin)
        } else if (!this.player.inVehicle && this.corpse.isActive && this.corpse.headDetached && this.corpse.detachedHead &&
                   !this.corpse.detachedHead.isPickedUp && !this.corpse.detachedHead.inCoffin &&
                   !this.coffin.isPickedUp && !this.corpse.isPickedUp && this.corpse.ejectionImmunityTimer === 0 &&
                   Math.abs(this.player.x - this.corpse.detachedHead.x) < 60) {
            // Pick up detached head
            this.corpse.detachedHead.isPickedUp = true;
            console.log('Picked up detached head');

        } else if (!this.player.inVehicle && this.coffin.isActive && !this.coffin.isPickedUp &&
            distanceToCoffin < 60 && !this.corpse.isPickedUp &&
            !(this.corpse.detachedHead && this.corpse.detachedHead.isPickedUp)) {
            // Pick up coffin (and maintain any corpse inside)
            this.coffin.isPickedUp = true;

            // If corpse is in coffin, move it with the coffin
            if (this.corpse.inCoffin) {
                console.log('Picked up coffin with corpse inside');
            } else {
                console.log('Picked up empty coffin');
            }

        } else if (!this.player.inVehicle && this.coffin.isActive && this.coffin.isPickedUp) {
            // Carrying coffin - can load into hearse or drop
            if (this.player.canLoadCoffin(this.hearse)) {
                this.hearse.loadCoffin(this.coffin);
            } else {
                // Drop coffin on ground
                this.coffin.isPickedUp = false;
                this.coffin.x = this.player.x + 40;
                this.coffin.y = this.coffin.groundY;
                this.coffin.velocityY = 0;
                console.log('Dropped coffin');
            }

        } else if (!this.player.inVehicle && this.corpse.isActive && this.corpse.isPickedUp) {
            // Carrying corpse - can load into coffin or drop
            if (this.coffin.isActive && distanceToCoffin < 60 && !this.coffin.inHearse && !this.coffin.isPickedUp) {
                this.corpse.drop(); // Release grab before loading
                this.coffin.loadCorpse(this.corpse);
            } else {
                // Drop corpse - it will ragdoll naturally!
                this.corpse.drop();
                console.log('Dropped corpse');
            }

        } else if (!this.player.inVehicle && this.corpse.isActive && this.corpse.detachedHead && this.corpse.detachedHead.isPickedUp) {
            // Carrying detached head - can load into coffin or drop
            if (this.coffin.isActive && distanceToCoffin < 60 && !this.coffin.inHearse && !this.coffin.isPickedUp) {
                // Load head into coffin
                this.corpse.detachedHead.isPickedUp = false;
                this.corpse.detachedHead.x = this.coffin.x;
                this.corpse.detachedHead.y = this.coffin.y;
                this.corpse.detachedHead.oldX = this.corpse.detachedHead.x;
                this.corpse.detachedHead.oldY = this.corpse.detachedHead.y;
                this.corpse.detachedHead.inCoffin = true;
                console.log('Loaded detached head into coffin');
            } else {
                // Drop detached head
                this.corpse.detachedHead.isPickedUp = false;
                this.corpse.detachedHead.x = this.player.x + 30;
                this.corpse.detachedHead.y = this.player.y;
                this.corpse.detachedHead.oldX = this.corpse.detachedHead.x;
                this.corpse.detachedHead.oldY = this.corpse.detachedHead.y;
                this.corpse.detachedHead.velX = 0;
                this.corpse.detachedHead.velY = 0;
                console.log('Dropped detached head');
            }

        } else if (!this.player.inVehicle && this.player.canUnloadCoffin(this.hearse, this.coffin)) {
            // Unload coffin from hearse
            this.hearse.unloadCoffin(this.coffin, this.terrain);

        } else if (this.player.canEnterHearse(this.hearse) && !this.coffin.isPickedUp && !this.corpse.isPickedUp &&
                   !(this.corpse.detachedHead && this.corpse.detachedHead.isPickedUp)) {
            // Drop any held plank on the ground before entering
            if (this.heldPlank) {
                this.heldPlank.drop();
                this.heldPlank = null;
                console.log('🪵 Plank dropped before entering hearse');
            }
            // Enter hearse
            this.player.enterHearse(this.hearse);
            this.audio.playDoorOpen();
            this.audio.startEngine(this.hearse.velocity);

        } else if (this.player.inVehicle) {
            // Exit hearse
            this.player.exitHearse(this.hearse, this.terrain);
            this.audio.playDoorClose();
            this.audio.stopEngine();
        }
    }

    updateCamera() {
        // Set target camera based on what player is doing
        if (this.player.inVehicle) {
            // Keep hearse more centered with reduced lookahead
            const speed = Math.abs(this.hearse.velocity);
            const lookahead = speed * 15; // Reduced lookahead (was 60)
            const hearsePosition = this.canvas.width * 0.4; // Center hearse better (was 0.25)

            this.targetCameraX = this.hearse.x - hearsePosition + (this.hearse.velocity > 0 ? lookahead : -lookahead);
        } else {
            this.targetCameraX = this.player.x - this.canvas.width / 2;
        }

        // Smoother camera following - especially important during jumps
        const cameraSpeed = this.player.inVehicle ? 0.08 : 0.1; // Slower camera (was 0.15)
        this.cameraX += (this.targetCameraX - this.cameraX) * cameraSpeed;
        this.cameraX = Math.max(0, Math.min(this.terrain.worldWidth - this.canvas.width, this.cameraX));
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all game elements
        this.terrain.draw(this.ctx, this.cameraX, this.canvas.width);
        // this.potholeManager.draw(this.ctx, this.cameraX); // Draw potholes on terrain - REMOVED
        this.phoneBooth.draw(this.ctx, this.cameraX, this.player);
        this.deliveryBooth.draw(this.ctx, this.cameraX, this.player);
        this.hospital.draw(this.ctx, this.cameraX, this.hearse, this.player);
        this.church.draw(this.ctx, this.cameraX, this.hearse, this.coffin, this.corpse);
        this.church2.draw(this.ctx, this.cameraX, this.hearse, this.coffin, this.corpse);
        if (this.graveyard) this.graveyard.draw(this.ctx, this.cameraX, this.hearse, this.coffin, this.corpse, this.roadkill);
        if (this.church4) this.church4.draw(this.ctx, this.cameraX, this.hearse, this.coffin, this.corpse, this.roadkill);
        this.chapterManager.drawProps(this.ctx, this.cameraX);
        this.roadkill.draw(this.ctx, this.cameraX, this.player);

        // Chapter 1: drawbridge (no-op when inactive)
        if (this.bridge) this.bridge.draw(this.ctx, this.cameraX);

        // Chapter-2 entities
        if (this.openingPhone) this.openingPhone.draw(this.ctx, this.cameraX, this.player);
        if (this.closingPhone) this.closingPhone.draw(this.ctx, this.cameraX, this.player);
        if (this.plankRavine) this.plankRavine.draw(this.ctx, this.cameraX, this.player, this.heldPlank);
        for (const plank of this.planks) plank.draw(this.ctx, this.cameraX, this.heldPlank === plank ? this.player : null);

        // Only draw coffin and corpse if they're active
        if (this.corpse.isActive) {
            this.corpse.draw(this.ctx, this.cameraX, this.player, this.coffin);
            // Draw detached head separately with player reference for proximity glow
            this.corpse.drawDetachedHead(this.ctx, this.cameraX, this.player);
        }
        if (this.coffin.isActive) {
            this.coffin.draw(this.ctx, this.cameraX, this.player, this.corpse);
        }

        this.hearse.draw(this.ctx, this.cameraX, this.player, this.coffin, this.corpse);
        this.dreamSequence.drawWorld(this.ctx, this.cameraX, this.hearse); // roof crawler, over the hearse
        this.player.draw(this.ctx, this.cameraX);
        this.drawUI();
        this.drawDebug();

        // Draw corpse editor on top of everything
        this.corpseEditor.draw(this.ctx, this.cameraX);

        // Monologue floats above the player (camera-aware)
        if (this.monologue) this.monologue.draw(this.ctx, this.player, this.cameraX);

        // Dream vignette + POV smash take the whole frame when active
        this.dreamSequence.drawOverlay(this.ctx);

        // Chapter event overlays (e.g., the ch.3 deer strike POV)
        this.chapterManager.drawEventOverlay(this.ctx);

        // Fade overlay LAST — covers everything inside the canvas during chapter transitions
        if (this.chapterManager) this.chapterManager.drawFadeOverlay(this.ctx);

        // Death overlay (drawn after chapter fade so it always reads)
        if (this.deathState === 'dying' || this.deathState === 'dead') {
            const ctx = this.ctx;
            ctx.fillStyle = `rgba(0,0,0,${this.deathAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.deathState === 'dead') {
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.font = '26px Georgia, serif';
                ctx.textAlign = 'center';
                ctx.fillText('You fell.', this.canvas.width / 2, this.canvas.height / 2 - 16);
                ctx.font = 'italic 15px Georgia, serif';
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText('press space to try again', this.canvas.width / 2, this.canvas.height / 2 + 20);
                ctx.textAlign = 'left';
            }
        }
        // Mission briefing is now an HTML overlay; nothing to draw on canvas.
    }

    drawUI() {
        // Deliberately empty: damage state is told diegetically (door sprite,
        // steam, tilt) and numerically only in the debug panel (D key).
    }

    drawDebug() {
        // Skip debug panel when disabled
        if (!this.showDebug) return;
        
        // Debug panel in top-left
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(5, 5, 280, 190);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '11px monospace';

        const doorStatus = this.hearse.doorOpen ?
            (this.hearse.doorOpenedByBump ? 'OPEN (bump)' : 'OPEN (loading)') : 'CLOSED';

        const lidStatus = this.coffin.lidOpen ?
            (this.coffin.lidOpenedByBump ? 'OPEN (bump)' : 'OPEN (loading)') : 'CLOSED';

        const corpseStatus = this.corpse.inCoffin ? 'IN COFFIN' :
            this.corpse.isPickedUp ? 'CARRYING' : 'ON GROUND';

        this.ctx.fillText(`Door: ${doorStatus}`, 10, 20);
        this.ctx.fillText(`Door timer: ${this.hearse.doorTimer}`, 10, 35);
        this.ctx.fillText(`Bumps: ${this.hearse.bumpCounter}/${this.hearse.bumpThreshold}`, 10, 50);
        this.ctx.fillText(`Coffin: ${this.coffin.inHearse ? 'IN HEARSE' : this.coffin.isPickedUp ? 'CARRYING' : 'ON GROUND'}`, 10, 65);
        this.ctx.fillText(`Lid: ${lidStatus} | Coffin bumps: ${this.coffin.bumpCounter}/${this.coffin.bumpThreshold}`, 10, 80);
        this.ctx.fillText(`Corpse: ${corpseStatus}`, 10, 95);
        this.ctx.fillText(`Hearse velocity: ${this.hearse.velocity.toFixed(1)} | Tilt: ${(this.hearse.tiltAngle * 180 / Math.PI).toFixed(1)}°`, 10, 110);
        this.ctx.fillText(`Player X: ${Math.round(this.player.x)} | Hearse X: ${Math.round(this.hearse.x)}`, 10, 125);

        // Health status
        this.ctx.fillText(`Health - Hearse: ${this.hearse.health}/100 | Coffin: ${this.coffin.health}/100 | Corpse: ${this.corpse.health}/100`, 10, 140);

        // Heat / overheat status
        const heatBar = Math.round(this.hearse.heat);
        const heatLabel = this.hearse.overheated
            ? `🔥 OVERHEATED${this.hearse._playerAtHood ? ' (cooling fast)' : ''}`
            : (heatBar > 70 ? '⚠ running hot' : 'ok');
        this.ctx.fillText(`Heat: ${heatBar}/100 — ${heatLabel}`, 10, 170);
        if (this.bridge && this.bridge.active) this.ctx.fillText(this.bridge.getDebugText(), 10, 185);
        
        // Dismemberment status and body part tracking
        if (this.corpse.headDetached) {
            const proximity = this.corpse.getProximityStatus(this.coffin);
            this.ctx.fillText(`💀 HEAD DETACHED! Body: ${proximity.bodyNear ? '✓' : '✗'} Head: ${proximity.headNear ? '✓' : '✗'}`, 10, 155);
        }

        // Total condition score preview
        if (this.coffin.isActive && this.corpse.isActive) {
            const previewScore = Math.round((this.hearse.health * 0.3 + this.coffin.health * 0.4 + this.corpse.health * 0.3));
            this.ctx.fillText(`Estimated Delivery Score: ${previewScore}/100`, 10, 155);
        }
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    // Mission briefing is an HTML intertitle — full-frame white-on-black title card
    // (see #mission-overlay in index.html / styles.css). Text appears whole: hard
    // cut in, hard cut out. delayFrames lets the scene (coffin spilling out at the
    // church) play on screen before the cut to black.
    showMissionBriefing(mission, autoDismissFrames = 900, delayFrames = 0) {
        if (delayFrames > 0) {
            this._pendingBriefing = { mission, autoDismissFrames, framesLeft: delayFrames };
            return;
        }
        this.missionBriefing = mission;
        this.briefingTimer = autoDismissFrames;
        console.log(`Mission received: ${mission.message}`);

        const el = document.getElementById('mission-overlay');
        if (!el) return;
        el.querySelector('.dispatch-title').textContent = mission.title || '';
        el.querySelector('.dispatch-body').textContent = mission.message || '';
        el.querySelector('.dispatch-instruction').textContent = mission.instruction || '';
        el.classList.remove('hidden');
    }

    dismissMissionBriefing() {
        const el = document.getElementById('mission-overlay');
        if (el) el.classList.add('hidden');
        this.missionBriefing = null;
        this.briefingTimer = 0;
    }

    updateMissionBriefing() {
        if (this._pendingBriefing) {
            this._pendingBriefing.framesLeft--;
            if (this._pendingBriefing.framesLeft <= 0) {
                const { mission, autoDismissFrames } = this._pendingBriefing;
                this._pendingBriefing = null;
                this.showMissionBriefing(mission, autoDismissFrames);
            }
            return;
        }
        if (this.missionBriefing && this.briefingTimer > 0) {
            this.briefingTimer--;
            if (this.briefingTimer === 0) {
                this.dismissMissionBriefing();
            }
        }
    }

    // Utility methods for adjusting corpse size (for console debugging)
    setCorpseScale(scale) {
        this.corpse.setScale(scale);
    }

    setCorpseSize(width, height) {
        this.corpse.setSize(width, height);
    }
    
    exposeConsoleCommands() {
        console.log(`
🎮 TESTING CONSOLE COMMANDS:
  game.jumpToChapter(5000)     - Jump camera to x position
  game.teleportToHospital()    - Hospital pickup (x=2500)
  game.teleportToCanyon()      - Great canyon (~55%)
  game.teleportToMountains()   - Mountain peaks (~67%)
  game.teleportToEnd()         - Church delivery (x=22000)
  game.setCorpseScale(1.2)     - Resize corpse
        `);
    }

    jumpToChapter(x) {
        this.cameraX = x - this.canvas.width / 2;
        this.targetCameraX = this.cameraX;
        console.log(`📍 Jumped to x=${x}`);
    }
    
    teleportToHospital() {
        this.player.x = this.hospital.x - 200;
        this.hearse.teleportTo(this.hospital.x - 300);
        this.jumpToChapter(this.hospital.x - 200);
        console.log('🏥 Teleported to hospital for pickup');
    }

    teleportToCanyon() {
        const canyonX = 25000 * 0.55;
        this.player.x = canyonX;
        this.hearse.teleportTo(canyonX - 100);
        this.jumpToChapter(canyonX);
        console.log('🏔️ Teleported to the Great Canyon');
    }

    teleportToMountains() {
        const mountainX = 25000 * 0.67;
        this.player.x = mountainX;
        this.hearse.teleportTo(mountainX - 100);
        this.jumpToChapter(mountainX);
        console.log('⛰️ Teleported to Mountain Peaks');
    }

    teleportToEnd() {
        this.player.x = this.church.x - 200;
        this.hearse.teleportTo(this.church.x - 300);
        this.jumpToChapter(this.church.x - 200);
        console.log('🏛️ Teleported to church for delivery testing');
    }
}