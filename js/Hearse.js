// Hearse vehicle with physics, tilting, and door mechanics

class Hearse {
    constructor(x = 100, y = 280) {
        this.x = x;
        this.y = y;
        this.width = 210;
        this.height = 150;
        
        // Physics properties
        this.velocity = 0; // Current horizontal velocity
        this.velocityY = 0; // Vertical velocity for jumps
        this.maxSpeed = 12; // Increased for ramp jumps
        this.acceleration = 0.15; // Gradual build-up
        this.friction = 0.08;
        this.brakeForce = 0.4;
        this.airResistance = 0.02; // Resistance when airborne
        this.gravity = 0.4; // For jump physics
        this.isAirborne = false;
        this.tiltAngle = 0; // Current tilt in radians
        this.wheelBase = 140; // Distance between front and rear axles
        this.wheelOffset = 50; // Distance from bottom of sprite to ground

        // Terrain-impact bump tracking (replaces old direction-change model)
        this.lastCenterGroundY = null;
        this.bumpCooldown = 0;

        // Door mechanics
        this.doorOpen = false;
        this.doorOpenedByBump = false;
        this.bumpCounter = 0;
        this.bumpThreshold = 20; // Increased for longer gameplay
        this.doorTimer = 0;
        this.lastDirection = null;
        
        // Health system - starts at 100, decreases with damage
        this.maxHealth = 100;
        this.health = 100;
        this.damagePerBump = 8; // Each bump does 8 damage

        // Load sprites
        this.closedSprite = new Image();
        this.closedSprite.src = 'assets/hearse.png';
        this.openSprite = new Image();
        this.openSprite.src = 'assets/open-door-hearse.png';
    }

    update(terrain, input, player, coffin) {
        // Handle door timer (auto-close after loading)
        if (this.doorTimer > 0) {
            this.doorTimer--;
            if (this.doorTimer === 0) {
                // Close door after loading animation completes
                if (!this.doorOpenedByBump) {
                    this.doorOpen = false;
                }
            }
        }

        // Only process vehicle input if player is actually in the hearse
        if (!player.inVehicle) {
            // Apply friction when player is not driving
            if (this.velocity > 0) {
                this.velocity = Math.max(0, this.velocity - this.friction);
            } else if (this.velocity < 0) {
                this.velocity = Math.min(0, this.velocity + this.friction);
            }
        } else {
            // Vehicle physics with enhanced acceleration and airborne mechanics
            const rightPressed = input.isKeyPressed('ArrowRight');
            const leftPressed = input.isKeyPressed('ArrowLeft');

            if (rightPressed && !leftPressed) {
                // Accelerate right or brake if moving left
                if (this.velocity < 0) {
                    this.velocity += this.brakeForce;
                } else {
                    this.velocity = Math.min(this.maxSpeed, this.velocity + this.acceleration);
                }
            } else if (leftPressed && !rightPressed) {
                // Accelerate left or brake if moving right  
                if (this.velocity > 0) {
                    this.velocity -= this.brakeForce;
                } else {
                    this.velocity = Math.max(-this.maxSpeed, this.velocity - this.acceleration);
                }
            } else {
                // No input - apply friction (air resistance if airborne)
                const resistance = this.isAirborne ? this.airResistance : this.friction;
                if (this.velocity > 0) {
                    this.velocity = Math.max(0, this.velocity - resistance);
                } else if (this.velocity < 0) {
                    this.velocity = Math.min(0, this.velocity + resistance);
                }
            }

            // Track direction (kept for any external callers); damage now comes from real terrain impacts below.
            if (rightPressed) this.lastDirection = 'right';
            if (leftPressed) this.lastDirection = 'left';
        }

        // Check door opening threshold (moved outside of driving block so it works always)
        if (this.bumpCounter >= this.bumpThreshold && !this.doorOpen) {
            this.doorOpen = true;
            this.doorOpenedByBump = true;
            console.log(`Door opened by bumps! Final count: ${this.bumpCounter}/${this.bumpThreshold}`);
            
            // Play door opening sound - access audio through game reference
            if (window.game && window.game.audio) {
                window.game.audio.playDoorOpen();
            }
        }

        // Apply horizontal velocity
        this.x += this.velocity;

        // Calculate terrain heights for wheels
        const frontWheelX = this.x + this.width * 0.8;
        const rearWheelX = this.x + this.width * 0.2;
        const frontWheelGroundY = terrain.getGroundYAt(frontWheelX);
        const rearWheelGroundY = terrain.getGroundYAt(rearWheelX);

        // Calculate desired ground position
        let desiredY = rearWheelGroundY - this.height + this.wheelOffset;

        // Airborne physics - check if hearse should be airborne based on speed and terrain
        const centerGroundY = terrain.getGroundYAt(this.x + this.width * 0.5);
        const currentBottomY = this.y + this.height - this.wheelOffset;
        
        if (this.isAirborne) {
            // Apply gravity
            this.velocityY += this.gravity;
            this.y += this.velocityY;

            // Check for landing (use center of hearse)
            if (currentBottomY >= centerGroundY) {
                // Landing!
                this.y = centerGroundY - this.height + this.wheelOffset;
                this.isAirborne = false;
                
                // Landing impact based on vertical velocity
                if (this.velocityY > 3) {
                    console.log(`🚗💥 Hard landing! Impact velocity: ${this.velocityY.toFixed(1)}`);
                    // Add extra bumps for hard landings
                    const landingBumps = Math.floor(this.velocityY / 3);
                    this.bumpCounter += landingBumps;
                    this.health = Math.max(0, this.health - (this.damagePerBump * landingBumps));
                    
                    // Transfer landing bumps to coffin if inside
                    if (coffin && coffin.inHearse) {
                        coffin.bumpCounter += landingBumps;
                        coffin.health = Math.max(0, coffin.health - (coffin.damagePerBump * landingBumps));
                        console.log(`Coffin hard landing damage! Added ${landingBumps} bumps. Coffin bumps: ${coffin.bumpCounter}/${coffin.bumpThreshold}, Health: ${coffin.health}/${coffin.maxHealth}`);
                    }
                }
                this.velocityY = 0;
            }
        } else {
            // Check if hearse should go airborne
            const groundDrop = currentBottomY - centerGroundY;
            const speed = Math.abs(this.velocity);
            
            // Go airborne if:
            // 1. Ground drops away significantly (gap/ramp end)
            // 2. High speed over small drops
            const airborneThreshold = speed > 6 ? 3 : 8; // Lower threshold at high speed
            
            if (groundDrop < -airborneThreshold) {
                this.isAirborne = true;
                this.velocityY = -speed * 0.1; // Initial upward velocity based on speed
                console.log(`🚗🚀 Hearse launched! Speed: ${speed.toFixed(1)}, Drop: ${groundDrop.toFixed(1)}`);
            } else {
                // Normal ground following (or ramp following)
                // STABILITY FIX: Smooth position changes to prevent oscillations
                const positionDiff = desiredY - this.y;
                if (Math.abs(positionDiff) > 50) {
                    // If position change is too extreme, dampen it
                    this.y += positionDiff * 0.3; // Smooth transition
                } else {
                    this.y = desiredY;
                }
            }
        }

        // Calculate tilt angle based on terrain or trajectory
        let wheelBaseDistance = frontWheelX - rearWheelX;
        if (this.isAirborne) {
            // Use velocity vector for tilt when airborne
            this.tiltAngle = Math.atan2(-this.velocityY, Math.abs(this.velocity) * 10);
        } else {
            // Use terrain angle when on ground
            const rawTiltAngle = Math.atan2(frontWheelGroundY - rearWheelGroundY, wheelBaseDistance);
            
            // ENHANCED STABILITY: Smooth tilt changes to prevent jittering
            const targetAngle = Math.max(-0.5, Math.min(0.5, rawTiltAngle)); // Max ~30 degrees
            const smoothingFactor = 0.1; // Lower = smoother but slower response
            this.tiltAngle = this.tiltAngle + (targetAngle - this.tiltAngle) * smoothingFactor;
            
            // Additional stability: if velocity is very low, reduce tilt sensitivity
            if (Math.abs(this.velocity) < 0.5) {
                this.tiltAngle *= 0.9; // Gradually reduce tilt when nearly stationary
            }
            
            // STABILITY CORRECTION: Prevent getting stuck in extreme positions
            if (Math.abs(this.tiltAngle) > 0.35 && Math.abs(this.velocity) < 0.2) {
                // Vehicle is severely tilted and nearly stationary - apply corrective nudge
                const correctionForce = this.tiltAngle > 0 ? -0.2 : 0.2;
                this.velocity += correctionForce;
                console.log(`Stability correction applied! Tilt: ${(this.tiltAngle * 180 / Math.PI).toFixed(1)}°, Force: ${correctionForce}`);
            }
        }

        // ---- Honest terrain-impact bump detection ----
        // Replaces the old direction-change model. Bumps now happen when the ground
        // height the hearse rides on changes sharply relative to its speed.
        if (this.bumpCooldown > 0) this.bumpCooldown--;
        const speed = Math.abs(this.velocity);
        if (this.lastCenterGroundY !== null && !this.isAirborne && this.bumpCooldown === 0 && speed > 1) {
            const groundDelta = Math.abs(centerGroundY - this.lastCenterGroundY);
            // Scale severity: ground delta combined with speed. ~6+ px change at speed = a real bump.
            const severity = (groundDelta / 6) * (speed / 5);
            if (severity > 0.6) {
                const multiplier = Math.max(0.5, Math.min(2.0, severity));
                const bumpDamage = Math.floor(this.damagePerBump * multiplier);
                this.bumpCounter++;
                this.health = Math.max(0, this.health - bumpDamage);
                this.bumpCooldown = 8; // ~0.13s — prevents cascading hits on a single rough patch
                console.log(`Terrain bump! delta=${groundDelta.toFixed(1)}px speed=${speed.toFixed(1)} dmg=${bumpDamage} count=${this.bumpCounter}/${this.bumpThreshold}`);

                // Only transmit *severe* hearse bumps to the coffin inside.
                // Light terrain bumps degrade the hearse but the coffin rides them out.
                if (coffin && coffin.inHearse && multiplier > 1.4) {
                    const coffinDamage = Math.floor(coffin.damagePerBump * multiplier);
                    coffin.bumpCounter++;
                    coffin.health = Math.max(0, coffin.health - coffinDamage);
                }
            }
        }
        this.lastCenterGroundY = centerGroundY;
    }

    loadCoffin(coffin) {
        coffin.isPickedUp = false;
        coffin.inHearse = true;
        
        // Open door briefly for loading animation
        this.doorOpen = true;
        this.doorOpenedByBump = false;
        this.doorTimer = 30; // Close after 0.5 seconds
        
        // Reset bump counter after loading
        this.bumpCounter = 0;
        console.log('Coffin loaded into hearse!');
    }

    unloadCoffin(coffin, terrain) {
        if (!coffin.inHearse) return false;
        
        // Position coffin just behind hearse
        coffin.x = this.x - 50; // 50px behind back door
        const groundY = terrain.getGroundYAt(coffin.x + coffin.width / 2);
        coffin.y = groundY - coffin.height;
        coffin.velocityY = 0;
        coffin.velocityX = 0;
        
        coffin.inHearse = false;
        coffin.isPickedUp = false;
        
        // Open door briefly for unloading animation
        this.doorOpen = true;
        this.doorOpenedByBump = false;
        this.doorTimer = 30; // Close after 0.5 seconds
        
        console.log('Coffin unloaded from hearse!');
        return true;
    }

    shouldEjectCoffin(terrain, coffin) {
        if (!coffin.inHearse || !this.doorOpen) return false;

        const slope = terrain.getTerrainSlopeAt(this.x + this.width / 2);
        const SLIDE_THRESHOLD = 0.05;
        const TILT_THRESHOLD = 0.15;

        const terrainForce = Math.abs(slope);
        const tiltForce = Math.abs(this.tiltAngle);
        const combinedForce = Math.max(terrainForce, tiltForce * 0.7);

        // Only slide if door opened by bumps OR forces exceed threshold
        return this.doorOpenedByBump ||
               (combinedForce > SLIDE_THRESHOLD && this.doorTimer === 0) ||
               (tiltForce > TILT_THRESHOLD && this.doorTimer === 0);
    }

    getBackDoorDistance(playerX, playerWidth) {
        const hearseBackDoorX = this.x; // Left edge = back door
        const playerCenterX = playerX + playerWidth / 2;
        return Math.abs(playerCenterX - hearseBackDoorX);
    }

    getDistanceToHearse(playerX) {
        return Math.abs(playerX - this.x);
    }

    draw(ctx, cameraX, player, coffin, corpse) {
        const screenX = this.x - cameraX;

        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            // Check proximity conditions for glow effects
            const playerCenterX = player.x + player.width / 2;
            const distanceToHearse = Math.abs(player.x - this.x);
            const hearseBackDoorX = this.x;
            const distanceToBackDoor = Math.abs(playerCenterX - hearseBackDoorX);
            
            // Glow conditions - prioritize back door when carrying coffin OR when can unload
            const canUnloadCoffin = coffin.inHearse && !player.inVehicle && distanceToBackDoor < 40;
            const shouldGlowBackDoor = (coffin.isPickedUp && !player.inVehicle && distanceToBackDoor < 40) || canUnloadCoffin;
            const shouldGlowFrontDoor = !coffin.isPickedUp && !corpse.isPickedUp && distanceToHearse < 80 && !player.inVehicle && !canUnloadCoffin;

            ctx.save();

            // Add glow effects for hearse interactions
            if (shouldGlowFrontDoor) {
                // Normal glow for entering hearse
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else if (shouldGlowBackDoor) {
                // Directional glow toward left (back door) for coffin loading
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = -15; // Glow extends toward left
                ctx.shadowOffsetY = 0;
            }

            // Select sprite based on door state
            const sprite = this.doorOpen ? this.openSprite : this.closedSprite;

            // Calculate center point for rotation (rear wheel position) - used for both sprite and fallback
            const centerX = screenX + this.width * 0.2; // Rotate around rear axle
            const centerY = this.y + this.height;

            // Apply tilt rotation for both sprite and fallback
            ctx.translate(centerX, centerY);
            ctx.rotate(this.tiltAngle);
            ctx.translate(-centerX, -centerY);

            // Check if sprite is loaded before drawing
            if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, screenX, this.y, this.width, this.height);
            } else {
                // Fallback: draw simple rectangle (now also rotated!)
                ctx.fillStyle = this.doorOpen ? '#555' : '#000';
                ctx.fillRect(screenX, this.y, this.width, this.height);
            }

            // Add visual indicator when airborne
            if (this.isAirborne) {
                ctx.save();
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(screenX - 5, this.y - 5, this.width + 10, this.height + 10);
                ctx.setLineDash([]);
                
                // Add speed indicator
                ctx.fillStyle = '#ff6600';
                ctx.font = 'bold 14px Arial';
                ctx.fillText('✈ AIRBORNE!', screenX, this.y - 10);
                ctx.restore();
            }

            // Enhanced directional glow for back door loading
            if (shouldGlowBackDoor && sprite && sprite.complete && sprite.naturalWidth > 0) {
                // Add extra glow passes for stronger left-side effect
                for (let i = 0; i < 3; i++) {
                    ctx.save();
                    ctx.shadowColor = '#00ff00';
                    ctx.shadowBlur = 15 + (i * 5);
                    ctx.shadowOffsetX = -10 - (i * 3);
                    ctx.shadowOffsetY = 0;
                    ctx.globalAlpha = 0.3 - (i * 0.1);
                    
                    // Draw just the left portion of the hearse for directional effect
                    ctx.drawImage(
                        sprite,
                        0, 0, sprite.width * 0.3, sprite.height, // Source: left 30% of sprite
                        screenX, this.y, this.width * 0.3, this.height // Dest: left 30% of hearse
                    );
                    ctx.restore();
                }
            }

            // Reset shadow for other elements
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.restore();
        }
    }
}