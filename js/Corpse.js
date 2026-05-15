// Verlet-based ragdoll corpse with proper constraint physics

class Corpse {
    constructor(x = 600, y = 300) {
        this.x = x; // Reference position for pickup detection
        this.y = y;
        this.width = 40; // For proximity detection
        this.height = 60;
        this.scale = 0.8; // Scale multiplier
        this.isPickedUp = false;
        this.inCoffin = false;
        this.ejectionImmunityTimer = 0;
        
        // Health system
        this.maxHealth = 100;
        this.health = 100;
        this.damagePerImpact = 15;
        
        // Dismemberment system
        this.headDetached = false;
        this.detachedHead = null; // Separate physics object for detached head
        this.headDetachThreshold = 30; // Health threshold for head detachment
        
        // Verlet physics settings
        this.gravity = 0.2; // Slightly floaty for comedy effect
        this.damping = 0.98;
        this.stiffness = 0.5;
        this.constraintIterations = 5;
        
        // Dragging (for when picked up by player)
        this.grabbedPoint = null; // Which point the player is holding
        
        // Create the skeleton
        this.createSkeleton(x, y);
    }
    
    createSkeleton(x, y) {
        // Human proportions - head unit ~12px at default scale
        const head = 12 * this.scale;
        
        /**
         * SKELETON POINTS
         * Each point: { x, y, oldX, oldY, pinned }
         * Velocity is implicit: (x - oldX, y - oldY)
         */
        this.points = {
            // Head & Spine
            head:       this.createPoint(x, y - head * 3.5),
            neck:       this.createPoint(x, y - head * 2.8),
            shoulder:   this.createPoint(x, y - head * 2.5),
            chest:      this.createPoint(x, y - head * 1.5),
            hip:        this.createPoint(x, y),
            
            // Left Arm
            leftShoulder:  this.createPoint(x - head * 0.8, y - head * 2.5),
            leftElbow:     this.createPoint(x - head * 1.5, y - head * 1.8),
            leftWrist:     this.createPoint(x - head * 2.0, y - head * 1.2),
            
            // Right Arm  
            rightShoulder: this.createPoint(x + head * 0.8, y - head * 2.5),
            rightElbow:    this.createPoint(x + head * 1.5, y - head * 1.8),
            rightWrist:    this.createPoint(x + head * 2.0, y - head * 1.2),
            
            // Left Leg
            leftHip:    this.createPoint(x - head * 0.4, y),
            leftKnee:   this.createPoint(x - head * 0.4, y + head * 1.8),
            leftAnkle:  this.createPoint(x - head * 0.4, y + head * 3.5),
            
            // Right Leg
            rightHip:   this.createPoint(x + head * 0.4, y),
            rightKnee:  this.createPoint(x + head * 0.4, y + head * 1.8),
            rightAnkle: this.createPoint(x + head * 0.4, y + head * 3.5),
        };
        
        /**
         * DISTANCE CONSTRAINTS (bones)
         * These keep points at fixed distances
         */
        this.distanceConstraints = [
            // Spine
            { a: 'head', b: 'neck', length: null },
            { a: 'neck', b: 'shoulder', length: null },
            { a: 'shoulder', b: 'chest', length: null },
            { a: 'chest', b: 'hip', length: null },
            
            // Shoulders
            { a: 'shoulder', b: 'leftShoulder', length: null },
            { a: 'shoulder', b: 'rightShoulder', length: null },
            
            // Left Arm
            { a: 'leftShoulder', b: 'leftElbow', length: null },
            { a: 'leftElbow', b: 'leftWrist', length: null },
            
            // Right Arm
            { a: 'rightShoulder', b: 'rightElbow', length: null },
            { a: 'rightElbow', b: 'rightWrist', length: null },
            
            // Hips
            { a: 'hip', b: 'leftHip', length: null },
            { a: 'hip', b: 'rightHip', length: null },
            
            // Left Leg
            { a: 'leftHip', b: 'leftKnee', length: null },
            { a: 'leftKnee', b: 'leftAnkle', length: null },
            
            // Right Leg
            { a: 'rightHip', b: 'rightKnee', length: null },
            { a: 'rightKnee', b: 'rightAnkle', length: null },
            
            // Cross-bracing for stability
            { a: 'leftShoulder', b: 'rightShoulder', length: null },
            { a: 'leftHip', b: 'rightHip', length: null },
        ];
        
        // Calculate rest lengths from initial positions
        this.distanceConstraints.forEach(c => {
            const pa = this.points[c.a];
            const pb = this.points[c.b];
            c.length = this.distance(pa.x, pa.y, pb.x, pb.y);
        });
    }
    
    createPoint(x, y) {
        return {
            x: x,
            y: y,
            oldX: x,
            oldY: y,
            pinned: false
        };
    }
    
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Check if ragdoll is at rest
     */
    isAtRest() {
        const threshold = 0.1;
        for (const p of Object.values(this.points)) {
            const vx = Math.abs(p.x - p.oldX);
            const vy = Math.abs(p.y - p.oldY);
            if (vx > threshold || vy > threshold) {
                return false;
            }
        }
        return true;
    }

    updatePhysics(terrain) {
        // Countdown immunity timer
        if (this.ejectionImmunityTimer > 0) {
            this.ejectionImmunityTimer--;
        }
        
        // Check for head detachment due to low health (even without impact)
        if (!this.headDetached && this.health <= 10) {
            console.log(`💀 Auto-detaching head due to critical health: ${this.health}`);
            this.detachHead();
        }
        
        // Don't update if in coffin
        if (this.inCoffin) {
            return;
        }
        
        // If being carried, still run physics but with grab point pinned
        // This lets limbs dangle realistically!
        if (this.isPickedUp && this.grabbedPoint) {
            // Pin the grabbed point in place (moveToPosition updates its location)
            this.grabbedPoint.pinned = true;
        }
        
        // Skip physics if at rest AND not being carried
        if (!this.isPickedUp && this.isAtRest()) {
            this.x = this.points.hip.x;
            this.y = this.points.hip.y;
            return;
        }
        
        // Verlet integration
        this.integrate();
        
        // Solve constraints
        for (let i = 0; i < this.constraintIterations; i++) {
            this.solveDistanceConstraints();
            this.solveCollisions(terrain);
        }
        
        // Update reference position (use hip as center)
        this.x = this.points.hip.x;
        this.y = this.points.hip.y;
    }
    
    /**
     * Verlet integration - velocity is implicit
     */
    integrate() {
        Object.values(this.points).forEach(p => {
            if (p.pinned) return;
            
            // Velocity from position delta
            const vx = (p.x - p.oldX) * this.damping;
            const vy = (p.y - p.oldY) * this.damping;
            
            // Store current position
            p.oldX = p.x;
            p.oldY = p.y;
            
            // Update position
            p.x += vx;
            p.y += vy + this.gravity;
        });
    }
    
    /**
     * Distance constraint solver - keeps bones at fixed lengths
     */
    solveDistanceConstraints() {
        this.distanceConstraints.forEach(c => {
            const pa = this.points[c.a];
            const pb = this.points[c.b];
            
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const currentLength = Math.sqrt(dx * dx + dy * dy);
            
            if (currentLength === 0) return;
            
            const diff = (c.length - currentLength) / currentLength;
            const offsetX = dx * diff * 0.5 * this.stiffness;
            const offsetY = dy * diff * 0.5 * this.stiffness;
            
            if (!pa.pinned) {
                pa.x -= offsetX;
                pa.y -= offsetY;
            }
            if (!pb.pinned) {
                pb.x += offsetX;
                pb.y += offsetY;
            }
        });
    }
    
    /**
     * Collision with terrain
     */
    solveCollisions(terrain) {
        Object.values(this.points).forEach(p => {
            if (p.pinned) return;
            
            // Ground collision using terrain
            const groundY = terrain.getGroundYAt(p.x);
            if (p.y > groundY - 2) {
                // Check velocity before collision for damage
                const impactVelocity = p.y - p.oldY;
                
                p.y = groundY - 2;
                
                // Friction on ground
                p.oldX = p.x - (p.x - p.oldX) * 0.8;
                
                // Damage from hard impacts (only check hip to avoid multiple damage)
                if (p === this.points.hip && impactVelocity > 5) {
                    this.health = Math.max(0, this.health - Math.floor(this.damagePerImpact * 0.6));
                    console.log(`Corpse impact! Velocity: ${impactVelocity.toFixed(1)}, Health: ${this.health}/${this.maxHealth}`);
                    
                    // Play impact sound - access audio through game reference
                    if (window.game && window.game.audio) {
                        const intensity = Math.min(2, impactVelocity / 10);
                        window.game.audio.playCorpseImpact(intensity);
                    }
                    
                    // Check for head detachment
                    this.checkHeadDetachment(impactVelocity);
                }
            }
            
            // Ceiling (shouldn't really happen but just in case)
            if (p.y < 20) {
                p.y = 20;
            }
        });
    }

    moveToPosition(x, y) {
        // When being carried, only move the grab point - let limbs dangle!
        if (this.isPickedUp) {
            // Use chest as grab point (player grabs torso area)
            if (!this.grabbedPoint) {
                this.grabbedPoint = this.points.chest;
            }
            
            // Move only the grabbed point
            this.grabbedPoint.x = x;
            this.grabbedPoint.y = y;
            // Kill velocity on grabbed point so it stays put
            this.grabbedPoint.oldX = x;
            this.grabbedPoint.oldY = y;
            this.grabbedPoint.pinned = true;
            
            // Update reference position
            this.x = this.points.hip.x;
            this.y = this.points.hip.y;
        } else {
            // Full body move (for coffin transport etc)
            const offsetX = x - this.x;
            const offsetY = y - this.y;

            Object.values(this.points).forEach(p => {
                p.x += offsetX;
                p.y += offsetY;
                p.oldX = p.x;
                p.oldY = p.y;
            });

            this.x = x;
            this.y = y;
        }
    }
    
    /**
     * Called when player drops the corpse
     */
    drop() {
        if (this.grabbedPoint) {
            this.grabbedPoint.pinned = false;
            this.grabbedPoint = null;
        }
        this.isPickedUp = false;
    }

    ejectFromCoffin(coffinX, coffinY, coffinVelocityX) {
        // Position corpse at ejection point
        const ejectX = coffinX + 40;
        const ejectY = coffinY - 10;

        const offsetX = ejectX - this.x;
        const offsetY = ejectY - this.y;

        // Give corpse velocity by offsetting oldX/oldY
        const velX = 3 + Math.abs(coffinVelocityX) * 0.3;
        const velY = -4; // Upward pop

        Object.values(this.points).forEach(p => {
            p.x += offsetX;
            p.y += offsetY;
            // Set velocity via Verlet (old position behind current)
            p.oldX = p.x - velX + (Math.random() - 0.5) * 2;
            p.oldY = p.y - velY + (Math.random() - 0.5) * 2;
        });

        this.x = ejectX;
        this.y = ejectY;
        
        // Eject detached head too if it was in the coffin
        if (this.detachedHead && this.detachedHead.inCoffin) {
            this.detachedHead.x = ejectX + 20;
            this.detachedHead.y = ejectY - 5;
            this.detachedHead.velX = velX + Math.random() * 2;
            this.detachedHead.velY = velY - 2;
            this.detachedHead.oldX = this.detachedHead.x - this.detachedHead.velX;
            this.detachedHead.oldY = this.detachedHead.y - this.detachedHead.velY;
            this.detachedHead.inCoffin = false;
            console.log('💀 Detached head also ejected from coffin!');
        }
        
        console.log(`🚨 BEFORE EJECTION: inCoffin=${this.inCoffin}, isPickedUp=${this.isPickedUp}`);
        this.inCoffin = false;
        this.isPickedUp = false;
        this.ejectionImmunityTimer = 120; // 2 seconds immunity
        console.log(`🚨 AFTER EJECTION: inCoffin=${this.inCoffin}, isPickedUp=${this.isPickedUp}`);
        
        // Damage from ejection
        this.health = Math.max(0, this.health - this.damagePerImpact);
        console.log(`Corpse ejected! Health: ${this.health}/${this.maxHealth}`);
    }

    draw(ctx, cameraX, player, coffin) {
        // Don't draw if in coffin
        if (this.inCoffin) return;

        const screenX = this.x - cameraX;
        
        // Check proximity for glow effect
        const distanceToCorpse = Math.abs(player.x - this.x);
        const shouldGlow = !this.inCoffin && !this.isPickedUp && !player.inVehicle && !coffin.isPickedUp && distanceToCorpse < 60;
        const justEjected = this.ejectionImmunityTimer > 60; // Glow for first second after ejection

        ctx.save();

        // Glow effect
        if (shouldGlow || justEjected) {
            ctx.shadowColor = justEjected ? '#ff0000' : '#ff4444';
            ctx.shadowBlur = justEjected ? 20 : 12;
        }

        // Transparency if being carried
        if (this.isPickedUp) {
            ctx.globalAlpha = 0.8;
        }

        // Black silhouette style
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const p = this.points;
        
        // Draw head (only if not detached)
        if (!this.headDetached) {
            const headRadius = 10 * this.scale;
            const headScreenX = p.head.x - cameraX;
            ctx.beginPath();
            ctx.arc(headScreenX, p.head.y, headRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw torso (polygon from shoulders to hips)
        ctx.beginPath();
        ctx.moveTo(p.leftShoulder.x - cameraX, p.leftShoulder.y);
        ctx.lineTo(p.rightShoulder.x - cameraX, p.rightShoulder.y);
        ctx.lineTo(p.rightHip.x - cameraX, p.rightHip.y);
        ctx.lineTo(p.leftHip.x - cameraX, p.leftHip.y);
        ctx.closePath();
        ctx.fill();
        
        // Draw limbs as thick lines
        const limbWidth = 4 * this.scale;
        ctx.lineWidth = limbWidth;
        
        // Left Arm
        this.drawLimb(ctx, cameraX, p.leftShoulder, p.leftElbow);
        this.drawLimb(ctx, cameraX, p.leftElbow, p.leftWrist);
        
        // Right Arm
        this.drawLimb(ctx, cameraX, p.rightShoulder, p.rightElbow);
        this.drawLimb(ctx, cameraX, p.rightElbow, p.rightWrist);
        
        // Left Leg
        this.drawLimb(ctx, cameraX, p.leftHip, p.leftKnee);
        this.drawLimb(ctx, cameraX, p.leftKnee, p.leftAnkle);
        
        // Right Leg
        this.drawLimb(ctx, cameraX, p.rightHip, p.rightKnee);
        this.drawLimb(ctx, cameraX, p.rightKnee, p.rightAnkle);

        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    drawLimb(ctx, cameraX, p1, p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x - cameraX, p1.y);
        ctx.lineTo(p2.x - cameraX, p2.y);
        ctx.stroke();
    }

    setScale(scale) {
        const oldScale = this.scale;
        this.scale = scale;
        this.width = 40 * scale;
        this.height = 60 * scale;
        
        // Rescale skeleton points relative to hip
        const hipX = this.points.hip.x;
        const hipY = this.points.hip.y;
        const scaleRatio = scale / oldScale;
        
        Object.values(this.points).forEach(p => {
            p.x = hipX + (p.x - hipX) * scaleRatio;
            p.y = hipY + (p.y - hipY) * scaleRatio;
            p.oldX = p.x;
            p.oldY = p.y;
        });
        
        // Recalculate constraint lengths
        this.distanceConstraints.forEach(c => {
            c.length *= scaleRatio;
        });
        
        console.log(`Corpse scale set to ${scale}`);
    }

    setSize(width, height) {
        const scaleX = width / 40;
        const scaleY = height / 60;
        this.setScale((scaleX + scaleY) / 2);
    }

    checkHeadDetachment(impactVelocity) {
        // Head detaches if health is low and impact is severe (lowered thresholds)
        if (!this.headDetached && this.health <= this.headDetachThreshold && impactVelocity > 3) {
            this.detachHead();
        }
        
        // Also check if health is critically low (below 10) - auto detach
        if (!this.headDetached && this.health <= 10) {
            console.log(`💀 Critical damage! Auto-detaching head at ${this.health} health`);
            this.detachHead();
        }
    }

    detachHead() {
        if (this.headDetached) return;
        
        this.headDetached = true;
        console.log('💀 HEAD DETACHED! Corpse is falling apart...');
        
        // Create detached head as separate physics object
        const headPoint = this.points.head;
        this.detachedHead = {
            x: headPoint.x,
            y: headPoint.y,
            oldX: headPoint.oldX,
            oldY: headPoint.oldY,
            velX: (headPoint.x - headPoint.oldX) * 1.5, // Extra velocity from detachment
            velY: (headPoint.y - headPoint.oldY) * 1.5 - 3, // Pop upward
            onGround: false,
            radius: 10 * this.scale
        };
        
        // Remove head from main skeleton (make it invisible)
        this.points.head.detached = true;
        
        // Remove neck constraints to head
        this.distanceConstraints = this.distanceConstraints.filter(c => 
            !(c.a === 'head' || c.b === 'head')
        );
        
        // Play detachment sound
        if (window.game && window.game.audio) {
            window.game.audio.playCorpseImpact(1.5);
        }
    }

    updateDetachedHead(terrain) {
        if (!this.detachedHead) return;
        
        const head = this.detachedHead;
        
        // Verlet physics for detached head
        const newX = head.x + head.velX;
        const newY = head.y + head.velY + this.gravity;
        
        head.oldX = head.x;
        head.oldY = head.y;
        head.x = newX;
        head.y = newY;
        
        // Ground collision
        const groundY = terrain.getGroundYAt(head.x);
        if (head.y + head.radius > groundY) {
            head.y = groundY - head.radius;
            head.velX *= 0.7; // Friction
            head.velY *= -0.3; // Small bounce
            head.onGround = true;
            
            // Impact sound for head hitting ground
            if (Math.abs(head.velY) > 3 && window.game && window.game.audio) {
                window.game.audio.playCorpseImpact(0.5);
            }
        }
        
        // Update velocity
        head.velX = head.x - head.oldX;
        head.velY = head.y - head.oldY;
        
        // Damping
        head.velX *= this.damping;
        head.velY *= this.damping;
    }

    drawDetachedHead(ctx, cameraX, player) {
        if (!this.detachedHead) return;
        
        const head = this.detachedHead;
        const screenX = head.x - cameraX;
        
        // Check proximity for glow effect
        const distanceToHead = player ? Math.abs(player.x - head.x) : 999;
        const shouldGlow = !head.inCoffin && !head.isPickedUp && !player.inVehicle && distanceToHead < 60;
        
        ctx.save();
        
        // Glow effect for pickup
        if (shouldGlow) {
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 12;
        }
        
        // Transparency if being carried
        if (head.isPickedUp) {
            ctx.globalAlpha = 0.8;
        }
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(screenX, head.y, head.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Check if both head and body are in coffin (needed for delivery)
    isCompletelyInCoffin() {
        if (!this.headDetached) {
            return this.inCoffin;
        } else {
            // Both parts need to be in coffin or very close to it
            return this.inCoffin && this.detachedHead && 
                   (this.detachedHead.inCoffin || Math.abs(this.detachedHead.x - this.x) < 50);
        }
    }

    // Get proximity status for UI display
    getProximityStatus(coffin) {
        if (!this.headDetached) {
            return { bodyNear: this.inCoffin, headNear: true, complete: this.inCoffin };
        }
        
        const bodyNear = this.inCoffin;
        const headNear = this.detachedHead && (this.detachedHead.inCoffin || 
                                               Math.abs(this.detachedHead.x - coffin.x) < 80);
        const complete = bodyNear && headNear;
        
        return { bodyNear, headNear, complete };
    }
}
