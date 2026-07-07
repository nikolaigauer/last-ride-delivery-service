// Bier — the wheeled coffin cart. Coffins are picked up from one and
// delivered onto one; nothing dignified touches the ground on purpose.
// Most biers are honest, stationary furniture. Some have wheels that
// remember they are wheels.

class Bier {
    constructor(x = 0, runaway = false) {
        this.x = x;
        this.y = 0;
        this.width = 96;
        this.height = 34;    // deck height above ground
        this.active = true;
        this.hasCoffin = false;
        this.hasCorpse = false; // the uncasketed ride from the morgue side door
        this.runaway = runaway; // this one rolls when loaded (Hillcrest)
        this.rolling = false;
        this.loose = false;     // has run off and not yet been delivered — grabbable
        this.grabbed = false;
        this.chocked = false;   // wheel chocked after its one adventure
        this.vx = 0;
        this.MAX_SPEED = 2.7;   // player walks at 3 — catchable, barely
    }

    deckY(terrain) {
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        return groundY - this.height;
    }

    update(terrain, game) {
        if (!this.active) return;
        this.y = this.deckY(terrain);

        if (this.grabbed && game) {
            // Player has hold of it — it goes where he goes, grudgingly
            const p = game.player;
            this.x = p.direction === 'left'
                ? p.x - this.width - 6
                : p.x + p.width + 6;
            this.vx = 0;
        } else if (this.rolling && !this.chocked) {
            const slope = terrain.getTerrainSlopeAt(this.x + this.width / 2);
            this.vx += slope * 0.35;
            this.vx *= 0.995;
            this.vx = Math.max(-this.MAX_SPEED, Math.min(this.MAX_SPEED, this.vx));
            this.x += this.vx;
            // Settles when it runs out of hill
            if (Math.abs(this.vx) < 0.05 && Math.abs(slope) < 0.01) {
                this.vx = 0;
                this.rolling = false;
            }
        }

        // The coffin rides the deck
        if (this.hasCoffin && game && game.coffin.onBier) {
            game.coffin.x = this.x + (this.width - game.coffin.width) / 2;
            game.coffin.y = this.y - game.coffin.height;
            game.coffin.velocityX = this.vx;
            game.coffin.velocityY = 0;
        }
        // Or the corpse rides it bare, as it comes from the morgue
        if (this.hasCorpse && game && game.corpse.isActive && !game.corpse.inCoffin && !game.corpse.isPickedUp) {
            game.corpse.moveToPosition(this.x + 8, this.y - 42);
        }
    }

    canInteract(player) {
        if (!this.active || player.inVehicle) return false;
        const pcx = player.x + player.width / 2;
        return Math.abs(pcx - (this.x + this.width / 2)) < 95;
    }

    isMoving() {
        return this.rolling && Math.abs(this.vx) > 0.15;
    }

    draw(ctx, cameraX, player, coffinCarried) {
        if (!this.active) return;
        const sx = this.x - cameraX;
        if (sx < -this.width - 50 || sx > ctx.canvas.width + this.width + 50) return;

        const top = this.y;
        ctx.save();
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;

        // Deck
        ctx.fillRect(sx, top, this.width, 7);
        ctx.strokeRect(sx, top, this.width, 7);
        // Frame legs down to the axles
        ctx.beginPath();
        ctx.moveTo(sx + 16, top + 7); ctx.lineTo(sx + 16, top + 20);
        ctx.moveTo(sx + this.width - 16, top + 7); ctx.lineTo(sx + this.width - 16, top + 20);
        ctx.stroke();
        // Wheels — spoked, ready
        for (const wx of [sx + 16, sx + this.width - 16]) {
            ctx.beginPath();
            ctx.arc(wx, top + 22, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const spin = this.x * 0.12; // wheels turn as it moves
            for (let i = 0; i < 3; i++) {
                const a = spin + i * Math.PI / 3;
                ctx.beginPath();
                ctx.moveTo(wx - Math.cos(a) * 9, top + 22 - Math.sin(a) * 9);
                ctx.lineTo(wx + Math.cos(a) * 9, top + 22 + Math.sin(a) * 9);
                ctx.stroke();
            }
        }
        // Wheel chock, once it has one
        if (this.chocked) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(sx + 30, top + 33);
            ctx.lineTo(sx + 42, top + 33);
            ctx.lineTo(sx + 42, top + 24);
            ctx.closePath();
            ctx.fill();
        }

        // Prompts
        if (player && this.canInteract(player)) {
            const cx = sx + this.width / 2;
            if (this.grabbed) {
                Utils.drawPrompt(ctx, 'space — let go', cx, top - 40);
            } else if (this.loose) {
                Utils.drawPrompt(ctx, 'space — grab the cart', cx, top - 40);
            } else if (coffinCarried && !this.hasCoffin) {
                Utils.drawPrompt(ctx, 'space — set the casket down', cx, top - 40);
            }
        }

        ctx.restore();
    }
}
