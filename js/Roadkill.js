// Roadkill — a dead deer by the roadside (chapter 3). Carryable like the
// corpse, loadable into the coffin as a... substitute. Not a ragdoll: it is
// long past ragdolling. Drawn procedurally: on its back, legs stiff in the air.

class Roadkill {
    constructor(x = -1000, y = 300) {
        this.x = x;
        this.y = y;
        this.width = 78;
        this.height = 34;
        this.isActive = false;
        this.isPickedUp = false;
        this.inCoffin = false;
    }

    update(terrain) {
        if (!this.isActive || this.isPickedUp || this.inCoffin) return;
        // Settle on terrain
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = groundY - this.height;
    }

    canPickup(player) {
        if (!this.isActive || this.isPickedUp || this.inCoffin || player.inVehicle) return false;
        const playerCenterX = player.x + player.width / 2;
        return Math.abs(playerCenterX - (this.x + this.width / 2)) < 60;
    }

    drop(player, terrain) {
        this.isPickedUp = false;
        this.x = player.x + 30;
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = groundY - this.height;
    }

    draw(ctx, cameraX, player) {
        if (!this.isActive || this.inCoffin) return;

        const screenX = this.x - cameraX;
        if (screenX < -this.width || screenX > ctx.canvas.width + this.width) return;

        ctx.save();

        if (this.canPickup(player)) {
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 15;
        }
        if (this.isPickedUp) ctx.globalAlpha = 0.85;

        const x = screenX, y = this.y, w = this.width, h = this.height;
        const beltY = y + h - 12; // body centerline (it lies on its back)

        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineCap = 'round';

        // Body — belly up
        ctx.beginPath();
        ctx.ellipse(x + w * 0.45, beltY, w * 0.34, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Four stiff legs, straight up, slightly splayed — the universal sign
        ctx.lineWidth = 3.5;
        const legs = [
            [x + w * 0.28, -0.18], [x + w * 0.38, -0.06],
            [x + w * 0.52, 0.06], [x + w * 0.62, 0.18],
        ];
        for (const [lx, splay] of legs) {
            ctx.beginPath();
            ctx.moveTo(lx, beltY - 6);
            ctx.lineTo(lx + splay * 40, beltY - 30);
            ctx.stroke();
            // Hoof nub
            ctx.beginPath();
            ctx.arc(lx + splay * 40, beltY - 30, 2.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head thrown back on the ground, right side
        ctx.beginPath();
        ctx.ellipse(x + w * 0.85, beltY + 4, 10, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Snout
        ctx.beginPath();
        ctx.ellipse(x + w * 0.95, beltY + 8, 5, 3.5, 0.6, 0, Math.PI * 2);
        ctx.fill();
        // One modest antler — enough to say deer
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.84, beltY - 1);
        ctx.lineTo(x + w * 0.78, beltY - 14);
        ctx.moveTo(x + w * 0.81, beltY - 8);
        ctx.lineTo(x + w * 0.74, beltY - 12);
        ctx.stroke();
        // X for an eye — the only honest way to draw it
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.6;
        const ex = x + w * 0.86, ey = beltY + 3;
        ctx.beginPath();
        ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5);
        ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Pickup prompt
        if (this.canPickup(player)) {
            Utils.drawPrompt(ctx, 'space — take the deer', screenX + w / 2, y - 14);
        }

        ctx.restore();
    }
}
