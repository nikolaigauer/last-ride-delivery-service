// Coffin object with physics and bump mechanics

class Coffin {
    constructor(x = 300, y = 340) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 40;
        this.isOpen = false;
        this.isPickedUp = false;
        this.inHearse = false;
        this.velocityY = 0;
        this.velocityX = 0;
        this.groundY = 340; // Ground level

        // Lid mechanics - bump states
        this.lidOpen = false;
        this.lidOpenedByBump = false;
        this.bumpCounter = 0;
        this.bumpThreshold = 6; // Coffin can take a few hits before the lid pops permanently
        this.lidTimer = 0;
        this.lastDirection = null; // For tracking direction changes
        
        // Health system - starts at 100, decreases with damage
        this.maxHealth = 100;
        this.health = 100;
        this.damagePerBump = 12; // Each bump does 12 damage (more fragile than hearse)

        // Load sprites
        this.closedSprite = new Image();
        this.closedSprite.src = 'assets/closed-coffin.png';
        this.openSprite = new Image();
        this.openSprite.src = 'assets/open-coffin.png';
    }

    update(terrain) {
        // Handle lid timer (auto-close after loading corpse)
        if (this.lidTimer > 0) {
            this.lidTimer--;
            if (this.lidTimer === 0) {
                // Close lid after loading animation completes
                if (!this.lidOpenedByBump) {
                    this.lidOpen = false;
                }
            }
        }

        // Update physics when not in hearse and not picked up
        if (!this.inHearse && !this.isPickedUp) {
            // Track direction changes for bump detection
            const wasMovingRight = this.lastDirection === 'right';
            const wasMovingLeft = this.lastDirection === 'left';

            // Apply gravity
            this.velocityY += 0.3;

            // Update position
            this.x += this.velocityX;
            this.y += this.velocityY;

            // Ground collision
            const groundY = terrain.getGroundYAt(this.x + this.width / 2);
            if (this.y + this.height >= groundY) {
                this.y = groundY - this.height;

                // Detect ground impact bump (when falling fast)
                if (this.velocityY > 3.5) {
                    this.bumpCounter++;
                    this.health = Math.max(0, this.health - this.damagePerBump);
                    console.log(`Coffin ground impact bump! VelY: ${this.velocityY.toFixed(1)} Count: ${this.bumpCounter}/${this.bumpThreshold}, Health: ${this.health}/${this.maxHealth}`);

                    if (this.bumpCounter >= this.bumpThreshold) {
                        this.lidOpen = true;
                        this.lidOpenedByBump = true;
                        console.log('Coffin lid opened by bumps!');
                    }
                }

                this.velocityY = 0;

                // Apply friction
                this.velocityX *= 0.95;
                if (Math.abs(this.velocityX) < 0.1) {
                    this.velocityX = 0;
                }

                // Detect direction changes for bump counting
                const nowMovingRight = this.velocityX > 0.2;
                const nowMovingLeft = this.velocityX < -0.2;

                if ((wasMovingRight && nowMovingLeft) || (wasMovingLeft && nowMovingRight)) {
                    this.bumpCounter++;
                    this.health = Math.max(0, this.health - this.damagePerBump);
                    console.log(`Coffin direction change bump! Count: ${this.bumpCounter}/${this.bumpThreshold}, Health: ${this.health}/${this.maxHealth}`);

                    if (this.bumpCounter >= this.bumpThreshold) {
                        this.lidOpen = true;
                        this.lidOpenedByBump = true;
                        console.log('Coffin lid opened by bumps!');
                    }
                }

                // Track direction for next frame
                if (nowMovingRight) this.lastDirection = 'right';
                if (nowMovingLeft) this.lastDirection = 'left';
            }
        }
    }

    loadCorpse(corpse) {
        corpse.isPickedUp = false;
        corpse.inCoffin = true;
        
        // Open coffin lid briefly for loading animation
        this.lidOpen = true;
        this.lidOpenedByBump = false;
        this.lidTimer = 30; // Close after 0.5 seconds (60fps * 0.5)
        
        // NOTE: Don't reset bump counter - damage is cumulative!
        console.log(`Corpse loaded into coffin! Coffin health: ${this.health}/${this.maxHealth}`);
    }

    ejectFromHearse(hearseX, hearseY, hearseVelocityX, tiltAngle) {
        const SLIDE_SPEED = 3;
        
        // Position coffin at back of hearse
        this.x = hearseX - this.width - 10;
        this.y = hearseY + 150 - this.height; // Hearse height - coffin height
        
        // Calculate sliding velocity
        const baseVelocity = -2; // Base backward slide
        const tiltBonus = Math.sin(tiltAngle) * SLIDE_SPEED * 0.8;
        this.velocityX = baseVelocity - tiltBonus;
        this.velocityY = 1 + Math.abs(tiltBonus * 0.3);
        
        // Add bump points for sliding out
        this.bumpCounter += 2;
        this.health = Math.max(0, this.health - (this.damagePerBump * 2));
        console.log(`Coffin sliding out of hearse! Added 2 bumps. Count: ${this.bumpCounter}/${this.bumpThreshold}, Health: ${this.health}/${this.maxHealth}`);
        
        if (this.bumpCounter >= this.bumpThreshold) {
            this.lidOpen = true;
            this.lidOpenedByBump = true;
            console.log('Coffin lid opened by hearse ejection bumps!');
        }
        
        this.inHearse = false;
    }

    draw(ctx, cameraX, player, corpse) {
        // Don't draw if in hearse
        if (this.inHearse) return;

        const screenX = this.x - cameraX;

        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const sprite = this.lidOpen ? this.openSprite : this.closedSprite;

            // Check proximity for glow effect
            const distanceToCoffin = Math.abs(player.x - this.x);
            const shouldGlow = (corpse.isPickedUp && !player.inVehicle && !this.isPickedUp && distanceToCoffin < 60) ||
                             (!player.inVehicle && !this.isPickedUp && distanceToCoffin < 60 && !corpse.isPickedUp);

            ctx.save();

            // Add glow effect if in proximity
            if (shouldGlow) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }

            // Add slight transparency if being carried
            if (this.isPickedUp) {
                ctx.globalAlpha = 0.8;
            }

            // Check if sprite is loaded before drawing
            if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                ctx.drawImage(sprite, screenX, this.y, this.width, this.height);
            } else {
                // Fallback: draw simple rectangle
                ctx.fillStyle = this.lidOpen ? '#8B4513' : '#654321';
                ctx.fillRect(screenX, this.y, this.width, this.height);
            }

            // Reset shadow
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // Check if corpse should be ejected
    shouldEjectCorpse() {
        return this.lidOpen && this.lidOpenedByBump;
    }
}