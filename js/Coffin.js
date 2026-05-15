// Coffin — Matter.js body when free, positionally locked when in hearse or carried

class Coffin {
    constructor(x = 300, y = 340) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 40;
        this.tiltAngle = 0;   // read from Matter body when active
        this.isOpen = false;
        this.isPickedUp = false;
        this.inHearse = false;
        this.isActive = false;
        this.velocityY = 0;   // kept for external reads (ejectFromCoffin impulse)
        this.velocityX = 0;
        this.groundY = 340;

        // Lid mechanics (unchanged)
        this.lidOpen = false;
        this.lidOpenedByBump = false;
        this.bumpCounter = 0;
        this.bumpThreshold = 6;
        this.lidTimer = 0;
        this.lastDirection = null;

        // Health (unchanged)
        this.maxHealth = 100;
        this.health = 100;
        this.damagePerBump = 12;

        // Matter.js (set by buildMatterBody)
        this.body = null;
        this._physics = null;
        this._inWorld = false;

        this.closedSprite = new Image();
        this.closedSprite.src = 'assets/closed-coffin.png';
        this.openSprite = new Image();
        this.openSprite.src = 'assets/open-coffin.png';
    }

    buildMatterBody(physics) {
        this._physics = physics;
        const { Bodies, Events } = Matter;

        this.body = Bodies.rectangle(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.width, this.height,
            { friction: 0.5, restitution: 0.2, density: 0.001, label: 'coffin' }
        );

        Events.on(physics.engine, 'collisionStart', (event) => {
            if (!this._inWorld) return;
            for (const pair of event.pairs) {
                if (this._isCoffinTerrainPair(pair)) {
                    this._handleGroundImpact(pair);
                }
            }
        });
    }

    _isCoffinTerrainPair(pair) {
        const { bodyA, bodyB } = pair;
        const isCoffin  = (b) => b === this.body;
        const isTerrain = (b) => b.label === 'terrain' || b.label === 'wall';
        return (isCoffin(bodyA) && isTerrain(bodyB)) || (isCoffin(bodyB) && isTerrain(bodyA));
    }

    _handleGroundImpact(pair) {
        const vel = this.body.velocity;
        const n = pair.collision.normal;
        const impactSpeed = Math.abs(vel.x * n.x + vel.y * n.y);

        if (impactSpeed > 3) {
            const multiplier = Math.max(0.5, Math.min(2.0, impactSpeed / 5));
            this.bumpCounter++;
            this.health = Math.max(0, this.health - Math.floor(this.damagePerBump * multiplier));
            console.log(`Coffin ground impact! speed=${impactSpeed.toFixed(1)} count=${this.bumpCounter}/${this.bumpThreshold}`);

            if (this.bumpCounter >= this.bumpThreshold) {
                this.lidOpen = true;
                this.lidOpenedByBump = true;
                console.log('Coffin lid opened by bumps!');
            }
        }
    }

    _addToWorld() {
        if (!this._inWorld && this.body && this._physics) {
            // Sync body position to current coffin coords before first insertion
            Matter.Body.setPosition(this.body, {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
            });
            Matter.Body.setVelocity(this.body, { x: this.velocityX, y: this.velocityY });
            Matter.Body.setAngle(this.body, 0);
            Matter.Composite.add(this._physics.world, this.body);
            this._inWorld = true;
        }
    }

    _removeFromWorld() {
        if (this._inWorld && this.body && this._physics) {
            Matter.Composite.remove(this._physics.world, this.body);
            this._inWorld = false;
        }
    }

    update(terrain) {
        // Lid timer (unchanged)
        if (this.lidTimer > 0) {
            this.lidTimer--;
            if (this.lidTimer === 0 && !this.lidOpenedByBump) {
                this.lidOpen = false;
            }
        }

        if (!this.isActive) return;

        if (!this.inHearse && !this.isPickedUp) {
            // Free on ground — let Matter handle physics
            this._addToWorld();
            this.x = this.body.position.x - this.width / 2;
            this.y = this.body.position.y - this.height / 2;
            this.tiltAngle = this.body.angle;
            this.velocityX = this.body.velocity.x;
            this.velocityY = this.body.velocity.y;
        } else {
            // Carried or in hearse — remove from physics world, position managed externally
            this._removeFromWorld();
            this.tiltAngle = 0;
        }
    }

    loadCorpse(corpse) {
        corpse.isPickedUp = false;
        corpse.inCoffin = true;
        this.lidOpen = true;
        this.lidOpenedByBump = false;
        this.lidTimer = 30;
        console.log(`Corpse loaded into coffin! Coffin health: ${this.health}/${this.maxHealth}`);
    }

    ejectFromHearse(hearseX, hearseY, hearseVelocityX, tiltAngle) {
        const newX = hearseX - this.width - 10;
        const newY = hearseY + 150 - this.height;

        const baseVelocity = -2;
        const tiltBonus = Math.sin(tiltAngle) * 3 * 0.8;
        const velX = baseVelocity - tiltBonus;
        const velY = 1 + Math.abs(tiltBonus * 0.3);

        // Damage from sliding out
        this.bumpCounter += 2;
        this.health = Math.max(0, this.health - (this.damagePerBump * 2));
        if (this.bumpCounter >= this.bumpThreshold) {
            this.lidOpen = true;
            this.lidOpenedByBump = true;
            console.log('Coffin lid opened by hearse ejection!');
        }
        console.log(`Coffin ejected! bumpCounter=${this.bumpCounter}/${this.bumpThreshold}, health=${this.health}`);

        this.inHearse = false;
        this.x = newX;
        this.y = newY;
        this.velocityX = velX;
        this.velocityY = velY;

        // Place body and add to world immediately so physics takes over
        if (this.body && this._physics) {
            Matter.Body.setPosition(this.body, { x: newX + this.width / 2, y: newY + this.height / 2 });
            Matter.Body.setVelocity(this.body, { x: velX, y: velY });
            Matter.Body.setAngle(this.body, 0);
            Matter.Body.setAngularVelocity(this.body, tiltAngle * 0.5);
            if (!this._inWorld) {
                Matter.Composite.add(this._physics.world, this.body);
                this._inWorld = true;
            }
        }
    }

    shouldEjectCorpse() {
        return this.lidOpen && this.lidOpenedByBump;
    }

    draw(ctx, cameraX, player, corpse) {
        if (this.inHearse) return;

        const screenX = this.x - cameraX;
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const sprite = this.lidOpen ? this.openSprite : this.closedSprite;
            const distanceToCoffin = Math.abs(player.x - this.x);
            const shouldGlow = (corpse.isPickedUp && !player.inVehicle && !this.isPickedUp && distanceToCoffin < 60) ||
                               (!player.inVehicle && !this.isPickedUp && distanceToCoffin < 60 && !corpse.isPickedUp);

            ctx.save();

            if (shouldGlow) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 15;
            }

            if (this.isPickedUp) ctx.globalAlpha = 0.8;

            // Rotate around coffin center if tumbling
            if (Math.abs(this.tiltAngle) > 0.01) {
                const cx = screenX + this.width / 2;
                const cy = this.y + this.height / 2;
                ctx.translate(cx, cy);
                ctx.rotate(this.tiltAngle);
                ctx.translate(-cx, -cy);
            }

            if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, screenX, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.lidOpen ? '#8B4513' : '#654321';
                ctx.fillRect(screenX, this.y, this.width, this.height);
            }

            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}
