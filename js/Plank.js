// Plank: pickup-able by player on foot. When placed at a ravine edge, becomes a static
// Matter body bridging the gap so the hearse can drive across.

class Plank {
    constructor(x = 0, y = 280, physics = null) {
        this.x = x;
        this.y = y;
        this.width = 240;
        this.height = 14;
        this.isPickedUp = false;
        this.isPlaced = false;
        this.physics = physics;
        this.body = null; // Matter static body (only when placed)
    }

    update(terrain) {
        if (this.isPlaced || this.isPickedUp) return;
        // Settle on terrain
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = groundY - this.height;
    }

    canPickup(player) {
        if (this.isPlaced || this.isPickedUp || player.inVehicle) return false;
        const playerCenterX = player.x + player.width / 2;
        const plankCenterX = this.x + this.width / 2;
        return Math.abs(playerCenterX - plankCenterX) < 60;
    }

    pickUp(player) {
        if (!this.canPickup(player)) return false;
        this.isPickedUp = true;
        return true;
    }

    drop() {
        this.isPickedUp = false;
    }

    // Place the plank as a static Matter body bridging from spanFromX to spanToX.
    // `roadTopY` is the top of the road surface — the plank's top will be flush with it.
    placeAcross(spanFromX, spanToX, roadTopY) {
        const cx = (spanFromX + spanToX) / 2;
        const cy = roadTopY + this.height / 2;
        this.x = cx - this.width / 2;
        this.y = roadTopY;
        this.isPickedUp = false;
        this.isPlaced = true;

        if (this.physics) {
            this.body = Matter.Bodies.rectangle(cx, cy, this.width, this.height, {
                isStatic: true,
                friction: 0.9,
                restitution: 0.05,
                label: 'plank',
            });
            Matter.Composite.add(this.physics.world, this.body);
        }
    }

    destroy() {
        if (this.body && this.physics) {
            Matter.Composite.remove(this.physics.world, this.body);
            this.body = null;
        }
    }

    draw(ctx, cameraX, player) {
        let drawX = this.x;
        let drawY = this.y;
        if (this.isPickedUp && player) {
            drawX = player.x - this.width / 2 + player.width / 2;
            drawY = player.y - 30;
            this.x = drawX;
            this.y = drawY;
        }
        const screenX = drawX - cameraX;
        if (screenX < -this.width || screenX > ctx.canvas.width + this.width) return;

        ctx.save();
        // Wood grain plank — black outline, light fill, three horizontal grain lines
        ctx.fillStyle = '#d8c79a';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.fillRect(screenX, drawY, this.width, this.height);
        ctx.strokeRect(screenX, drawY, this.width, this.height);

        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
            const ly = drawY + (this.height / 3) * i;
            ctx.beginPath();
            ctx.moveTo(screenX + 6, ly);
            ctx.lineTo(screenX + this.width - 6, ly);
            ctx.stroke();
        }

        // Pickup glow
        if (!this.isPlaced && !this.isPickedUp && player && this.canPickup(player)) {
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX - 3, drawY - 3, this.width + 6, this.height + 6);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }
}

// PlankRavine: chapter-2 chasm puzzle. Player places a plank to bridge the gap.
// (Distinct from Bridge.js, which is the chapter-1 counterweight drawbridge.)
class PlankRavine {
    constructor() {
        this.startX = 0;
        this.endX = 0;
        this.topY = 393; // Chapter-2 road surface (matches groundY at cliff edges)
        this.active = false;
        this.bridged = false;
        this.physics = null;
    }

    configure(startX, endX, physics, topY = 393) {
        this.startX = startX;
        this.endX = endX;
        this.topY = topY;
        this.physics = physics;
        this.active = true;
        this.bridged = false;
    }

    // Player is on foot near either edge AND holding a plank → can place
    canPlacePlank(player, plank) {
        if (!this.active || this.bridged || player.inVehicle || !plank || !plank.isPickedUp) return false;
        const playerCenterX = player.x + player.width / 2;
        const nearLeft = Math.abs(playerCenterX - this.startX) < 120;
        const nearRight = Math.abs(playerCenterX - this.endX) < 120;
        return nearLeft || nearRight;
    }

    placePlank(plank) {
        if (this.bridged) return false;
        // Span the plank across the gap, anchored at the ravine top
        const margin = 20; // overhang on each side for grip
        const fromX = this.startX - margin;
        const toX = this.endX + margin;
        plank.placeAcross(fromX, toX, this.topY);
        this.bridged = true;
        return true;
    }

    draw(ctx, cameraX, player, hasHeldPlank) {
        if (!this.active) return;
        const screenLeft = this.startX - cameraX;
        const screenRight = this.endX - cameraX;
        if (screenRight < -100 || screenLeft > ctx.canvas.width + 100) return;

        ctx.save();

        // Mark both cliff edges with thick black bars + warning ticks
        ctx.fillStyle = '#000';
        ctx.fillRect(screenLeft - 2, this.topY - 4, 4, 14);
        ctx.fillRect(screenRight - 2, this.topY - 4, 4, 14);

        // Distance marker above the gap — only while it's still a hazard.
        // Once bridged, the plank itself is the signal; no label needed.
        if (!this.bridged) {
            const markerY = this.topY - 60;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(screenLeft, markerY);
            ctx.lineTo(screenRight, markerY);
            ctx.stroke();
            ctx.setLineDash([]);
            Utils.drawPrompt(ctx, 'gap', (screenLeft + screenRight) / 2, markerY - 6);
        }

        // Placement prompt above player when in range with a plank
        if (player && hasHeldPlank && this.canPlacePlank(player, hasHeldPlank)) {
            const psx = (player.x + player.width / 2) - cameraX;
            Utils.drawPrompt(ctx, 'space — lay the plank', psx, player.y - 44);
        }

        ctx.restore();
    }
}
