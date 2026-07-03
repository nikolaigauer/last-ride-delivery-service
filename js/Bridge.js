// RavineBridge — counterweight drawbridge puzzle
//
// The ravine is purely visual (drawn over flat terrain). A single Matter.js wall
// body blocks the hearse at the left cliff edge when the bridge is raised.
// Placing the coffin on the counterweight platform removes the wall so the
// hearse can drive across the (visually dramatic but physically flat) gorge.
// The player walks on flat terrain throughout — no falling risk on the bridge.

class Bridge {
    constructor(physics) {
        this.physics = physics;

        this.CLIFF_Y    = 350;
        this.leftEdgeX  = 14920;
        this.rightEdgeX = 15400;

        // Drawbridge pivot pinned at the left cliff edge
        this.pivotX  = this.leftEdgeX;
        this.pivotY  = this.CLIFF_Y;
        this.plankLen = (this.rightEdgeX - this.leftEdgeX) + 60; // 540px, 60px overhang

        // Bridge angle: 0 = horizontal, negative = tip pointing up-right (raised)
        this.RAISED_ANGLE  = -0.47;
        this.LOWERED_ANGLE =  0.03;
        this.angle         = this.RAISED_ANGLE;
        this.targetAngle   = this.RAISED_ANGLE;
        this.ANIM_SPEED    = 0.012;

        this.isDown = false;

        // Counterweight platform
        this.platX = 14680;
        this.platY = 343;
        this.platW = 200;
        this.platH = 14;

        // Pulley post (visual only)
        this.pulleyX = 14840;
        this.pulleyY = 268;

        // ── Matter.js bodies ──────────────────────────────────────────────────

        // Left wall: blocks the hearse at the cliff edge when bridge is raised.
        // Removed when bridge lowers, restored when raised again.
        // Spans full height so hearse can't jump over it.
        this.wallBody = Matter.Bodies.rectangle(
            this.leftEdgeX - 10,
            this.pivotY - 175,  // center y=175, body spans y=0..350
            20, 350,
            { isStatic: true, label: 'bridgeWall', friction: 0, restitution: 0 }
        );

        // Platform body — coffin rests here physically
        this.platformBody = Matter.Bodies.rectangle(
            this.platX + this.platW / 2,
            this.platY,
            this.platW, this.platH,
            { isStatic: true, label: 'bridgePlatform', friction: 0.9 }
        );

        Matter.Composite.add(physics.world, [this.wallBody, this.platformBody]);
        this._wallInWorld = true;
        this._platformInWorld = true;
        this.active = true;
    }

    // Toggle whether the bridge participates in physics + rendering.
    // Used by ChapterManager to remove the bridge during chapter 2.
    setActive(on) {
        if (on === this.active) return;
        this.active = on;
        if (on) {
            if (!this._wallInWorld) {
                Matter.Composite.add(this.physics.world, this.wallBody);
                this._wallInWorld = true;
            }
            if (!this._platformInWorld) {
                Matter.Composite.add(this.physics.world, this.platformBody);
                this._platformInWorld = true;
            }
        } else {
            if (this._wallInWorld) {
                Matter.Composite.remove(this.physics.world, this.wallBody);
                this._wallInWorld = false;
            }
            if (this._platformInWorld) {
                Matter.Composite.remove(this.physics.world, this.platformBody);
                this._platformInWorld = false;
            }
        }
    }

    // ── Weight detection ─────────────────────────────────────────────────────

    isHearseOnBridge(hearse) {
        const cx = hearse.x + hearse.width / 2;
        return cx > this.leftEdgeX + 10 && cx < this.rightEdgeX - 10;
    }

    isGorgeOpen() {
        return this.angle > -0.15;
    }

    isCoffinOnPlatform(coffin) {
        if (!coffin.isActive || coffin.inHearse || coffin.isPickedUp) return false;
        const cx  = coffin.x + coffin.width  / 2;
        const cy  = coffin.y + coffin.height / 2;
        const top = this.platY - this.platH / 2; // 336
        return (
            cx > this.platX - 10 &&
            cx < this.platX + this.platW + 10 &&
            cy > top - 50 &&
            cy < top + coffin.height + 5
        );
    }

    // ── Update ────────────────────────────────────────────────────────────────

    update(coffin, hearse) {
        if (!this.active) return;
        const coffinDown      = this.isCoffinOnPlatform(coffin);
        this._hearseOnBridge  = hearse ? this.isHearseOnBridge(hearse) : false;
        this.isDown           = coffinDown || this._hearseOnBridge;
        this.targetAngle      = this.isDown ? this.LOWERED_ANGLE : this.RAISED_ANGLE;

        const diff = this.targetAngle - this.angle;
        if (Math.abs(diff) > 0.005) {
            this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.ANIM_SPEED);
        } else {
            this.angle = this.targetAngle;
        }

        // Remove wall when bridge is nearly flat; restore when raised again
        const nearlyDown = this.angle > -0.15;
        if (nearlyDown && this._wallInWorld) {
            Matter.Composite.remove(this.physics.world, this.wallBody);
            this._wallInWorld = false;
        } else if (!nearlyDown && !this._wallInWorld) {
            Matter.Composite.add(this.physics.world, this.wallBody);
            this._wallInWorld = true;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _tipPos() {
        return {
            x: this.pivotX + Math.cos(this.angle) * this.plankLen,
            y: this.pivotY + Math.sin(this.angle) * this.plankLen,
        };
    }

    // ── Draw ──────────────────────────────────────────────────────────────────

    draw(ctx, cameraX) {
        if (!this.active) return;
        this._drawRavine(ctx, cameraX);
        this._drawPlatform(ctx, cameraX);
        this._drawPulleyPost(ctx, cameraX);
        this._drawRope(ctx, cameraX);
        this._drawPlank(ctx, cameraX);
        this._drawPrompt(ctx, cameraX);
    }

    _drawRavine(ctx, cameraX) {
        const sx  = this.leftEdgeX  - cameraX;
        const ex  = this.rightEdgeX - cameraX;
        const top = this.CLIFF_Y;
        const bot = ctx.canvas.height;

        ctx.fillStyle = '#0d0d18';
        ctx.fillRect(sx, top, ex - sx, bot - top);

        // River glint
        ctx.save();
        ctx.strokeStyle = 'rgba(140,195,255,0.20)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + 30, top + 200);
        ctx.lineTo(ex - 30, top + 200);
        ctx.stroke();
        ctx.restore();

        // Cliff face shadow slivers
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(sx - 5, top, 5, bot - top);
        ctx.fillRect(ex,     top, 5, bot - top);

        // Cliff-top edge emphasis
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(sx - 80, top); ctx.lineTo(sx, top); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, top); ctx.lineTo(ex + 80, top); ctx.stroke();
    }

    _drawPlatform(ctx, cameraX) {
        const sx  = this.platX - cameraX;
        const top = this.platY - this.platH;

        ctx.fillStyle = '#3a2510';
        ctx.fillRect(sx, top, this.platW, this.platH + 1);

        ctx.strokeStyle = '#221508';
        ctx.lineWidth = 1;
        for (let ox = 0; ox <= this.platW; ox += 22) {
            ctx.beginPath();
            ctx.moveTo(sx + ox, top);
            ctx.lineTo(sx + ox, top + this.platH);
            ctx.stroke();
        }

        ctx.fillStyle = '#221508';
        ctx.fillRect(sx + 12,              top + this.platH, 7, 16);
        ctx.fillRect(sx + this.platW - 19, top + this.platH, 7, 16);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, top, this.platW, this.platH);
    }

    _drawPulleyPost(ctx, cameraX) {
        const sx  = this.pulleyX - cameraX;
        const top = this.CLIFF_Y;

        ctx.fillStyle = '#2a1c0e';
        ctx.fillRect(sx - 4, this.pulleyY, 8, top - this.pulleyY);

        ctx.fillStyle = '#3a2810';
        ctx.fillRect(sx - 8, this.pulleyY - 4, 16, 6);

        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(sx, this.pulleyY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.arc(sx, this.pulleyY, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawRope(ctx, cameraX) {
        const tip    = this._tipPos();
        const tipSX  = tip.x - cameraX;
        const psx    = this.pulleyX - cameraX;
        const platCX = this.platX + this.platW / 2 - cameraX;
        const platTop = this.platY - this.platH;

        ctx.save();
        ctx.strokeStyle = '#7a6035';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(tipSX, tip.y);
        ctx.lineTo(psx, this.pulleyY);
        ctx.lineTo(platCX, platTop);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawPlank(ctx, cameraX) {
        const px = this.pivotX - cameraX;
        const py = this.pivotY;

        // Pivot support post
        ctx.fillStyle = '#2a1c0e';
        ctx.fillRect(px - 5, py - 74, 10, 74);
        ctx.fillStyle = '#3a2810';
        ctx.fillRect(px - 10, py - 78, 20, 8);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(this.angle);

        const pH = 15;
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(0, -pH / 2, this.plankLen, pH);

        ctx.strokeStyle = '#2a1a0f';
        ctx.lineWidth = 1.2;
        for (let ox = 28; ox < this.plankLen; ox += 30) {
            ctx.beginPath();
            ctx.moveTo(ox, -pH / 2);
            ctx.lineTo(ox,  pH / 2);
            ctx.stroke();
        }

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -pH / 2, this.plankLen, pH);

        ctx.restore();

        // Pivot pin
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    _drawPrompt(ctx, cameraX) {
        if (!this.isDown) {
            // Step 1: coffin not on platform yet
            const sx  = this.platX - cameraX;
            const top = this.platY - this.platH;
            Utils.drawPrompt(ctx, '← the casket goes here', sx + 40, top - 6);
        } else if (!this._hearseOnBridge) {
            // Step 2: bridge is down but hearse not on it yet
            const sx = this.leftEdgeX - cameraX + 10;
            Utils.drawPrompt(ctx, 'drive on →', sx + 60, this.CLIFF_Y - 6);
        }
        // Step 3: hearse on bridge — no prompt, player knows to retrieve coffin
    }

    getDebugText() {
        return `Bridge: ${this.isDown ? 'DOWN ✓' : 'RAISED'} | angle ${(this.angle * 180 / Math.PI).toFixed(0)}° | wall:${this._wallInWorld ? 'on' : 'off'}`;
    }
}
