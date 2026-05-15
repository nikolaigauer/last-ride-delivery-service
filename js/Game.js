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
        this.church = new Church(22000, 280); // Church destination for delivery - FAR away!
        this.deliveryBooth = new PhoneBooth(23000, 300); // Delivery completion booth after church
        // this.potholeManager = new PotholeManager(); // Terrain hazards - REMOVED

        // Start player in hearse for streamlined beginning
        this.player.enterHearse(this.hearse);

        // Camera system
        this.cameraX = 0;
        this.targetCameraX = 0;

        // Mission system
        this.missionBriefing = null;
        this.briefingTimer = 0;

        // Set delivery booth to only ring when coffin is loaded
        this.deliveryBooth.isRinging = false;

        // Generate potholes across the world - REMOVED
        // this.potholeManager.generatePotholes(50000);

        // Dev tools (editors) only load with ?dev=1 query string
        this.isDevMode = typeof window !== 'undefined' && window.location.search.includes('dev=1');
        const noopEditor = { isActive: false, update: () => {}, draw: () => {}, toggle: () => {} };
        this.levelEditor = this.isDevMode ? new LevelEditor(this) : noopEditor;
        this.corpseEditor = this.isDevMode ? new CorpseEditor(this) : noopEditor;
        this.levelManager = new LevelManager(this);
        
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

    completeDelivery() {
        const completion = {
            title: "Delivery Complete",
            message: "Package delivered successfully to final destination.\n\nThe family appreciates your... professional service.",
            instruction: "🎯 Mission Complete! Press R to restart"
        };
        this.showMissionBriefing(completion);
        this.deliveryBooth.isRinging = false;
        this.deliveryBooth.isAnswered = true;
        console.log('🎯 Delivery completed successfully!');
    }

    showDeliveryResult(deliveryResult) {
        const completion = {
            title: `Delivery Complete — Score: ${deliveryResult.score}/100`,
            message: `${deliveryResult.message}\n\nHealth Status:\nHearse: ${deliveryResult.hearseHealth || 0}/100\nCoffin: ${deliveryResult.coffinHealth || 0}/100\nCorpse: ${deliveryResult.corpseHealth || 0}/100\n\nLid open: ${deliveryResult.lidOpen ? 'Yes' : 'No'}\nCorpse present: ${deliveryResult.corpseInCoffin ? 'Yes' : 'No'}`,
            instruction: "Mission complete. Press SPACE to continue."
        };
        this.showMissionBriefing(completion, 1200); // ~20s after typewriter reveal completes

        // Activate delivery booth for next mission
        this.deliveryBooth.isRinging = true;
        console.log(`🎯 Church delivery completed! Score: ${deliveryResult.score}/100`);
    }

    update() {
        // Step Matter.js engine (no bodies yet — Phase 1 foundation)
        this.physics.step();

        // Editor toggles only respond in dev mode (?dev=1)
        if (this.isDevMode) {
            if (this.input.isKeyPressed('KeyE')) {
                this.levelEditor.toggle();
                this.input.clearKey('KeyE');
            }
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

        // Skip normal game updates if any editor is active
        if (this.levelEditor.isActive) {
            this.levelEditor.update();
            return;
        }
        
        if (this.corpseEditor.isActive) {
            this.corpseEditor.update();
            return;
        }

        // Handle spacebar interactions
        if (this.input.isKeyPressed('Space')) {
            // If mission briefing is showing, dismiss/complete it instead of triggering gameplay action
            if (this.missionBriefing) {
                this.dismissMissionBriefing();
            } else {
                this.handleInteractions();
            }
            this.input.clearKey('Space'); // Prevent key repeat
        }

        // Update all game objects (hearse first, then player follows)
        this.hearse.update(this.terrain, this.input, this.player, this.coffin);
        this.player.update(this.input, this.terrain, this.hearse);

        // Update audio based on game state
        if (this.player.inVehicle) {
            this.audio.updateEngine(this.hearse.velocity, this.hearse.isAirborne);
        }
        this.phoneBooth.update(this.terrain);
        this.deliveryBooth.update(this.terrain);
        this.hospital.update(this.terrain);
        this.church.update(this.terrain);
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
                    console.log(`Moving corpse with coffin to: ${this.coffin.x.toFixed(1)}, ${this.coffin.y.toFixed(1)}`);
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
                console.log(`🚨 MOVING CORPSE WITH CARRIED COFFIN to: ${this.coffin.x.toFixed(1)}, ${this.coffin.y.toFixed(1)}`);
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

        // Update camera
        this.updateCamera();

        // Update level manager for transitions
        this.levelManager.update(16.67); // Approximate 60fps deltaTime

        // Update mission briefing timer
        this.updateMissionBriefing();
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

        // Check church delivery completion (when hearse with coffin is at church)
        if (this.church.canCompleteDelivery(this.hearse, this.coffin, this.corpse) && this.input.isKeyPressed('Space')) {
            const deliveryResult = this.church.completeDelivery(this.hearse, this.coffin, this.corpse);
            this.showDeliveryResult(deliveryResult);
            
            // Trigger level completion after delivery
            setTimeout(() => {
                this.levelManager.completeLevel();
            }, 3000);
            
            return; // Exit early after delivery
        }

        // Check delivery completion (when carrying coffin to delivery booth)
        if (this.deliveryBooth.canInteract(this.player) && this.coffin.isActive && this.coffin.inHearse) {
            this.completeDelivery();
            return; // Exit early after delivery
        }

        // Check hospital door interaction (second priority)
        if (this.hospital.canPlayerInteractWithDoor(this.player)) {
            this.hospital.interactWithDoor();
            return; // Exit early after hospital interaction
        }
        if (!this.player.inVehicle && this.corpse.isActive && !this.coffin.isPickedUp && !this.corpse.isPickedUp &&
            distanceToCorpse < 60 && !this.corpse.inCoffin && this.corpse.ejectionImmunityTimer === 0) {
            // Pick up corpse
            this.corpse.isPickedUp = true;
            console.log('Picked up corpse');

        // Check detached head pickup (only if NOT already carrying it)
        } else if (!this.player.inVehicle && this.corpse.isActive && this.corpse.headDetached && this.corpse.detachedHead &&
                   !this.corpse.detachedHead.isPickedUp &&
                   !this.coffin.isPickedUp && !this.corpse.isPickedUp && this.corpse.ejectionImmunityTimer === 0) {
            const distanceToHead = Math.abs(this.player.x - this.corpse.detachedHead.x);
            if (distanceToHead < 60) {
                // Pick up detached head
                this.corpse.detachedHead.isPickedUp = true;
                console.log('Picked up detached head');
            }

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
        this.cameraX = Math.max(0, Math.min(25000 - this.canvas.width, this.cameraX)); // Epic world width
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

        // Only draw coffin and corpse if they're active
        if (this.corpse.isActive) {
            this.corpse.draw(this.ctx, this.cameraX, this.player, this.coffin);
            // Draw detached head separately with player reference for proximity glow
            this.corpse.drawDetachedHead(this.ctx, this.cameraX, this.player);
        } else {
            console.log(`🚨 CORPSE NOT ACTIVE! Active: ${this.corpse.isActive}`);
        }
        if (this.coffin.isActive) {
            this.coffin.draw(this.ctx, this.cameraX, this.player, this.corpse);
        }

        this.hearse.draw(this.ctx, this.cameraX, this.player, this.coffin, this.corpse);
        this.player.draw(this.ctx, this.cameraX);
        this.drawUI();
        this.drawDebug();

        // Draw level editor on top of everything
        this.levelEditor.draw(this.ctx, this.cameraX);
        
        // Draw corpse editor on top of everything
        this.corpseEditor.draw(this.ctx, this.cameraX);
        // Mission briefing is now an HTML overlay; nothing to draw on canvas.
    }

    drawUI() {
        // Show bump counter when in vehicle
        if (this.player.inVehicle) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(
                `Bumps: ${this.hearse.bumpCounter}/${this.hearse.bumpThreshold}`,
                10, 390
            );

            if (this.hearse.doorOpen) {
                this.ctx.fillStyle = '#ff6600';
                this.ctx.font = '14px Arial';
                this.ctx.fillText('DOOR OPEN!', 10, 370);
            }
        }
    }

    drawDebug() {
        // Skip debug panel when editor is active to avoid overlap or when disabled
        if (this.levelEditor.isActive || !this.showDebug) return;
        
        // Debug panel in top-left
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(5, 5, 280, 160);

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
        this.ctx.fillText(`Hearse velocity: ${this.hearse.velocity.toFixed(1)} | Tilt: ${(this.hearse.tiltAngle * 180 / Math.PI).toFixed(1)}°${this.hearse.isAirborne ? ' | 🚀 AIRBORNE!' : ''}`, 10, 110);
        this.ctx.fillText(`Player X: ${Math.round(this.player.x)} | Hearse X: ${Math.round(this.hearse.x)}`, 10, 125);

        // Health status
        this.ctx.fillText(`Health - Hearse: ${this.hearse.health}/100 | Coffin: ${this.coffin.health}/100 | Corpse: ${this.corpse.health}/100`, 10, 140);
        
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

    // Mission briefing is now an HTML overlay (Special Elite typewriter style).
    // See #mission-overlay in index.html and styles.css.
    showMissionBriefing(mission, autoDismissAfterRevealFrames = 900) {
        this.missionBriefing = mission;
        this.briefingTimer = 0; // Countdown does not start until typewriter reveal finishes.
        this._briefingAutoDismiss = autoDismissAfterRevealFrames;
        console.log(`Mission received: ${mission.message}`);

        const el = document.getElementById('mission-overlay');
        if (!el) return;

        const titleEl = el.querySelector('.dispatch-title');
        const bodyEl = el.querySelector('.dispatch-body');
        const instEl = el.querySelector('.dispatch-instruction');

        titleEl.textContent = mission.title || '';
        bodyEl.textContent = '';
        instEl.textContent = '';
        el.classList.remove('hidden');

        if (this._typewriterTimer) {
            clearInterval(this._typewriterTimer);
            this._typewriterTimer = null;
        }

        const fullBody = mission.message || '';
        const instruction = mission.instruction || '';
        let i = 0;
        const charDelayMs = 28;

        this._typewriterTimer = setInterval(() => {
            if (i < fullBody.length) {
                i++;
                bodyEl.textContent = fullBody.slice(0, i);
            } else {
                clearInterval(this._typewriterTimer);
                this._typewriterTimer = null;
                instEl.textContent = instruction;
                this.briefingTimer = this._briefingAutoDismiss;
            }
        }, charDelayMs);
    }

    dismissMissionBriefing() {
        // If still typing, the first press completes the text instead of dismissing.
        if (this._typewriterTimer) {
            clearInterval(this._typewriterTimer);
            this._typewriterTimer = null;
            const el = document.getElementById('mission-overlay');
            if (el && this.missionBriefing) {
                el.querySelector('.dispatch-body').textContent = this.missionBriefing.message || '';
                el.querySelector('.dispatch-instruction').textContent = this.missionBriefing.instruction || '';
            }
            this.briefingTimer = this._briefingAutoDismiss;
            return;
        }
        const el = document.getElementById('mission-overlay');
        if (el) el.classList.add('hidden');
        this.missionBriefing = null;
        this.briefingTimer = 0;
    }

    updateMissionBriefing() {
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
🎮 LEVEL PROGRESSION CONSOLE COMMANDS:

📂 Level Management:
  game.createLevel('level_01', 'Tutorial Level')          - Create new level
  game.saveCurrentLevel('level_01')                        - Save current state as level
  game.loadLevel('level_01')                               - Load level from storage
  game.linkLevels('level_01', 'level_02')                 - Link levels in progression
  
🔍 Level Inspection:
  game.listStoredLevels()                                  - Show all levels in storage
  game.getCurrentLevelInfo()                               - Show current level details
  
🎯 Testing & Navigation:
  game.forceCompleteLevel()                                - Force trigger level completion
  game.jumpToChapter(5000)                                 - Jump camera to x position
  game.teleportToHospital()                                - Teleport to hospital (pickup)
  game.teleportToCanyon()                                  - Teleport to great canyon (50% point)
  game.teleportToMountains()                               - Teleport to mountain peaks (67% point)
  game.teleportToEnd()                                     - Teleport to church for delivery
  
🗑️ Cleanup:
  game.clearAllLevels()                                    - Clear all levels from storage
  
💡 Epic Journey Sections:
  🏥 Hospital Pickup: 2500x        🏔️ Canyon Challenge: 12500x
  ⛰️ Mountain Peaks: 17000x       🏛️ Church Delivery: 22000x
        `);
    }
    
    // Console command implementations
    createLevel(id, name) {
        this.levelEditor.setLevelId(id);
        this.levelEditor.setLevelName(name);
        console.log(`✨ Created level: ${id} (${name})`);
        console.log('💡 Use the level editor (press E) to design your level, then call game.saveCurrentLevel()');
    }
    
    saveCurrentLevel(id) {
        if (id) {
            this.levelEditor.setLevelId(id);
        }
        this.levelEditor.saveLevel();
    }
    
    loadLevel(levelId) {
        this.levelManager.loadNextLevel(levelId);
    }
    
    linkLevels(currentId, nextId) {
        this.levelEditor.linkLevels(currentId, nextId);
        this.levelEditor.saveLevel();
        console.log(`🔗 Linked and saved: ${currentId} → ${nextId}`);
    }
    
    listStoredLevels() {
        const levels = this.levelManager.getStoredLevels();
        console.log('📋 Stored Levels:');
        levels.forEach(level => {
            console.log(`  - ${level.id}: ${level.name}`);
        });
        if (levels.length === 0) {
            console.log('  (No levels found in storage)');
        }
    }
    
    getCurrentLevelInfo() {
        const level = this.levelManager.currentLevel || this.levelEditor.currentLevel;
        if (level) {
            console.log(`📍 Current Level: ${level.id} (${level.name})`);
            console.log(`   Next: ${level.nextLevel || 'None'}`);
            console.log(`   Objects: ${level.objects?.length || 0}`);
        } else {
            console.log('ℹ️ No current level loaded');
        }
    }
    
    forceCompleteLevel() {
        this.levelManager.completeLevel();
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
    
    clearAllLevels() {
        this.levelManager.clearStoredLevels();
    }
}