// Hearse vehicle — Matter.js physics for movement, door/bump/health logic unchanged

class Hearse {
    constructor(x = 100, y = 280) {
        this.x = x;        // left edge of sprite, mapped from chassis each frame
        this.y = y;        // top of sprite, mapped from chassis each frame
        this.width = 210;
        this.height = 150;

        // These are read back from Matter each frame (external systems still read them)
        this.velocity = 0;
        this.tiltAngle = 0;
        this.isAirborne = false;
        this.maxSpeed = 12;
        this.lastDirection = null;

        // Door mechanics (unchanged)
        this.doorOpen = false;
        this.doorOpenedByBump = false;
        this.bumpCounter = 0;
        this.bumpThreshold = 20;
        this.doorTimer = 0;

        // Health system (unchanged)
        this.maxHealth = 100;
        this.health = 100;
        this.damagePerBump = 8;

        // Matter.js bodies — populated by buildMatterBodies()
        this.chassis = null;
        this.wheelA = null; // rear (left) wheel
        this.wheelB = null; // front (right) wheel
        this._wheelContacts = 0;      // active wheel-terrain contact count
        this._airborneFrames = 0;     // frames with no wheel contact (debounced)

        // Sprite offset: chassis.position → sprite top-left
        // Wheel center is 45px below chassis center; visual wheel center ≈ 115px from sprite top
        // → _chassisOffsetY = 115 - 45 = 70
        this._chassisOffsetX = this.width / 2; // 105
        this._chassisOffsetY = 70;

        this.closedSprite = new Image();
        this.closedSprite.src = 'assets/hearse.png';
        this.openSprite = new Image();
        this.openSprite.src = 'assets/open-door-hearse.png';
    }

    buildMatterBodies(physics, terrain) {
        const { Bodies, Composite, Constraint, Events } = Matter;

        // Place chassis so wheels sit exactly on the ground at startup
        const cx = this.x + this._chassisOffsetX;
        const groundY = terrain
            ? terrain.getGroundYAt(cx)
            : this.y + this._chassisOffsetY + 45 + 20;
        // wheelCenter = groundY - wheelRadius; chassisCenter = wheelCenter - 45
        const cy = groundY - 20 - 45; // chassis center y

        this.chassis = Bodies.rectangle(cx, cy, 180, 50, {
            density: 0.002,
            frictionAir: 0.05,
            label: 'hearseChassis',
        });

        const wheelRadius = 20;
        this.wheelA = Bodies.circle(cx - 65, cy + 45, wheelRadius, {
            friction: 0.9,
            frictionStatic: 0.5,
            restitution: 0.05,
            density: 0.003,
            frictionAir: 0.02,
            label: 'hearseWheel',
        });
        this.wheelB = Bodies.circle(cx + 65, cy + 45, wheelRadius, {
            friction: 0.9,
            frictionStatic: 0.5,
            restitution: 0.05,
            density: 0.003,
            frictionAir: 0.02,
            label: 'hearseWheel',
        });

        // Near-rigid axles: high stiffness eliminates sag that causes the sprite to hover
        const axelA = Constraint.create({
            bodyA: this.chassis, pointA: { x: -65, y: 25 },
            bodyB: this.wheelA,
            stiffness: 0.95, damping: 0.8,
        });
        const axelB = Constraint.create({
            bodyA: this.chassis, pointA: { x: 65, y: 25 },
            bodyB: this.wheelB,
            stiffness: 0.95, damping: 0.8,
        });

        Composite.add(physics.world, [this.chassis, this.wheelA, this.wheelB, axelA, axelB]);

        // Airborne detection and terrain-impact bump scoring via collision events
        Events.on(physics.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                if (this._isWheelTerrainPair(pair)) {
                    this._wheelContacts++;
                    this._handleTerrainImpact(pair);
                }
            }
        });
        Events.on(physics.engine, 'collisionEnd', (event) => {
            for (const pair of event.pairs) {
                if (this._isWheelTerrainPair(pair)) {
                    this._wheelContacts = Math.max(0, this._wheelContacts - 1);
                }
            }
        });
    }

    _isWheelTerrainPair(pair) {
        const { bodyA, bodyB } = pair;
        const isWheel  = (b) => b === this.wheelA || b === this.wheelB;
        const isTerrain = (b) => b.label === 'terrain' || b.label === 'wall';
        return (isWheel(bodyA) && isTerrain(bodyB)) || (isWheel(bodyB) && isTerrain(bodyA));
    }

    _handleTerrainImpact(pair) {
        const wheelBody = (pair.bodyA === this.wheelA || pair.bodyA === this.wheelB)
            ? pair.bodyA : pair.bodyB;
        const vel = wheelBody.velocity;
        const n = pair.collision.normal;
        const impactSpeed = Math.abs(vel.x * n.x + vel.y * n.y);

        if (impactSpeed > 3) {
            const multiplier = Math.max(0.5, Math.min(2.0, impactSpeed / 5));
            const bumpDamage = Math.floor(this.damagePerBump * multiplier);
            this.bumpCounter++;
            this.health = Math.max(0, this.health - bumpDamage);
            console.log(`Impact bump! speed=${impactSpeed.toFixed(1)} dmg=${bumpDamage} count=${this.bumpCounter}/${this.bumpThreshold}`);

            if (window.game && window.game.coffin && window.game.coffin.inHearse && multiplier > 1.4) {
                const c = window.game.coffin;
                c.bumpCounter++;
                c.health = Math.max(0, c.health - Math.floor(c.damagePerBump * multiplier));
            }
        }
    }

    update(terrain, input, player, coffin) {
        if (!this.chassis) return;

        // Door timer (auto-close after loading animation)
        if (this.doorTimer > 0) {
            this.doorTimer--;
            if (this.doorTimer === 0 && !this.doorOpenedByBump) {
                this.doorOpen = false;
            }
        }

        // Bump threshold → permanent door open
        if (this.bumpCounter >= this.bumpThreshold && !this.doorOpenedByBump) {
            this.doorOpen = true;
            this.doorOpenedByBump = true;
            if (window.game && window.game.audio) window.game.audio.playDoorOpen();
            console.log(`Door opened by bumps! ${this.bumpCounter}/${this.bumpThreshold}`);
        }

        if (player.inVehicle) {
            const rightPressed = input.isKeyPressed('ArrowRight');
            const leftPressed  = input.isKeyPressed('ArrowLeft');

            // Drive by applying horizontal force to chassis CENTER (zero moment arm = no torque = no tipping).
            // Wheel angular velocity was causing the chassis to tip backward under acceleration.
            const driveForce = rightPressed ? 3.0 : leftPressed ? -3.0 : 0;
            if (driveForce !== 0) {
                Matter.Body.applyForce(this.chassis, this.chassis.position, { x: driveForce, y: 0 });
            }

            // Speed cap — prevents runaway on steep downhills
            const vel = this.chassis.velocity;
            if (Math.abs(vel.x) > this.maxSpeed) {
                Matter.Body.setVelocity(this.chassis, { x: Math.sign(vel.x) * this.maxSpeed, y: vel.y });
            }

            if (rightPressed) this.lastDirection = 'right';
            if (leftPressed)  this.lastDirection = 'left';
        }

        // Read state back from Matter (external systems read these properties)
        this.velocity  = this.chassis.velocity.x;
        this.tiltAngle = this.chassis.angle;

        // Debounce airborne: require 4 consecutive frames of no wheel contact.
        // Prevents micro-airborne from spring oscillation touching/losing terrain each frame.
        if (this._wheelContacts === 0) {
            this._airborneFrames = Math.min(this._airborneFrames + 1, 10);
        } else {
            this._airborneFrames = 0;
        }
        this.isAirborne = this._airborneFrames >= 4;

        // Map chassis center → sprite top-left
        this.x = this.chassis.position.x - this._chassisOffsetX;
        this.y = this.chassis.position.y - this._chassisOffsetY;
    }

    // Move all Matter bodies together when teleporting (console commands, hospital spawn, etc.)
    teleportTo(worldX, worldY) {
        if (!this.chassis) {
            this.x = worldX;
            if (worldY !== undefined) this.y = worldY;
            return;
        }
        const newCX = worldX + this._chassisOffsetX;
        const dx = newCX - this.chassis.position.x;
        const newCY = worldY !== undefined
            ? worldY + this._chassisOffsetY
            : this.chassis.position.y;
        const dy = newCY - this.chassis.position.y;

        Matter.Body.setPosition(this.chassis, { x: newCX, y: newCY });
        Matter.Body.setPosition(this.wheelA, { x: this.wheelA.position.x + dx, y: this.wheelA.position.y + dy });
        Matter.Body.setPosition(this.wheelB, { x: this.wheelB.position.x + dx, y: this.wheelB.position.y + dy });

        // Zero velocities so the car doesn't ghost-launch after teleport
        for (const body of [this.chassis, this.wheelA, this.wheelB]) {
            Matter.Body.setVelocity(body, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(body, 0);
        }
        Matter.Body.setAngle(this.chassis, 0);
    }

    loadCoffin(coffin) {
        coffin.isPickedUp = false;
        coffin.inHearse = true;
        this.doorOpen = true;
        this.doorOpenedByBump = false;
        this.doorTimer = 30;
        this.bumpCounter = 0;
        console.log('Coffin loaded into hearse!');
    }

    unloadCoffin(coffin, terrain) {
        if (!coffin.inHearse) return false;
        coffin.x = this.x - 50;
        const groundY = terrain.getGroundYAt(coffin.x + coffin.width / 2);
        coffin.y = groundY - coffin.height;
        coffin.velocityY = 0;
        coffin.velocityX = 0;
        coffin.inHearse = false;
        coffin.isPickedUp = false;
        this.doorOpen = true;
        this.doorOpenedByBump = false;
        this.doorTimer = 30;
        console.log('Coffin unloaded from hearse!');
        return true;
    }

    shouldEjectCoffin(terrain, coffin) {
        if (!coffin.inHearse || !this.doorOpen) return false;
        const slope = terrain.getTerrainSlopeAt(this.x + this.width / 2);
        const SLIDE_THRESHOLD = 0.05;
        const TILT_THRESHOLD  = 0.15;
        const terrainForce = Math.abs(slope);
        const tiltForce    = Math.abs(this.tiltAngle);
        const combinedForce = Math.max(terrainForce, tiltForce * 0.7);
        return this.doorOpenedByBump ||
               (combinedForce > SLIDE_THRESHOLD && this.doorTimer === 0) ||
               (tiltForce > TILT_THRESHOLD && this.doorTimer === 0);
    }

    getBackDoorDistance(playerX, playerWidth) {
        return Math.abs((playerX + playerWidth / 2) - this.x);
    }

    getDistanceToHearse(playerX) {
        return Math.abs(playerX - this.x);
    }

    draw(ctx, cameraX, player, coffin, corpse) {
        const screenX = this.x - cameraX;
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const playerCenterX     = player.x + player.width / 2;
            const distanceToHearse  = Math.abs(player.x - this.x);
            const distanceToBackDoor = Math.abs(playerCenterX - this.x);

            const canUnloadCoffin    = coffin.inHearse && !player.inVehicle && distanceToBackDoor < 40;
            const shouldGlowBackDoor = (coffin.isPickedUp && !player.inVehicle && distanceToBackDoor < 40) || canUnloadCoffin;
            const shouldGlowFrontDoor = !coffin.isPickedUp && !corpse.isPickedUp && distanceToHearse < 80 && !player.inVehicle && !canUnloadCoffin;

            ctx.save();

            if (shouldGlowFrontDoor) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else if (shouldGlowBackDoor) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = -15;
                ctx.shadowOffsetY = 0;
            }

            const sprite = this.doorOpen ? this.openSprite : this.closedSprite;
            const centerX = screenX + this.width * 0.2;
            const centerY = this.y + this.height;

            ctx.translate(centerX, centerY);
            ctx.rotate(this.tiltAngle);
            ctx.translate(-centerX, -centerY);

            if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, screenX, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.doorOpen ? '#555' : '#000';
                ctx.fillRect(screenX, this.y, this.width, this.height);
            }

            if (this.isAirborne) {
                ctx.save();
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(screenX - 5, this.y - 5, this.width + 10, this.height + 10);
                ctx.setLineDash([]);
                ctx.fillStyle = '#ff6600';
                ctx.font = 'bold 14px Arial';
                ctx.fillText('✈ AIRBORNE!', screenX, this.y - 10);
                ctx.restore();
            }

            if (shouldGlowBackDoor && sprite && sprite.complete && sprite.naturalWidth > 0) {
                for (let i = 0; i < 3; i++) {
                    ctx.save();
                    ctx.shadowColor = '#00ff00';
                    ctx.shadowBlur = 15 + (i * 5);
                    ctx.shadowOffsetX = -10 - (i * 3);
                    ctx.shadowOffsetY = 0;
                    ctx.globalAlpha = 0.3 - (i * 0.1);
                    ctx.drawImage(
                        sprite,
                        0, 0, sprite.width * 0.3, sprite.height,
                        screenX, this.y, this.width * 0.3, this.height
                    );
                    ctx.restore();
                }
            }

            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.restore();
        }
    }
}
