// Driver's interior monologue: text fades in/out as the player crosses trigger zones.
// Each snippet plays once per chapter. Rendered as floating text above the player/hearse.

class MonologueSystem {
    constructor() {
        this.snippets = []; // [{triggerX, text, played, fadeTimer, state}]
        this.active = null;
        this.fadeInFrames = 30;
        this.holdFrames = 180;
        this.fadeOutFrames = 60;
    }

    setSnippets(list) {
        this.snippets = list.map(s => ({
            triggerX: s.triggerX,
            text: s.text,
            played: false,
        }));
        this.active = null;
    }

    update(playerX) {
        // Tick active snippet
        if (this.active) {
            this.active.timer++;
            if (this.active.state === 'in' && this.active.timer >= this.fadeInFrames) {
                this.active.state = 'hold';
                this.active.timer = 0;
            } else if (this.active.state === 'hold' && this.active.timer >= this.holdFrames) {
                this.active.state = 'out';
                this.active.timer = 0;
            } else if (this.active.state === 'out' && this.active.timer >= this.fadeOutFrames) {
                this.active = null;
            }
        }

        // Look for next snippet to trigger
        if (!this.active) {
            for (const s of this.snippets) {
                if (!s.played && playerX >= s.triggerX) {
                    s.played = true;
                    this.active = {
                        text: s.text,
                        state: 'in',
                        timer: 0,
                    };
                    break;
                }
            }
        }
    }

    draw(ctx, player, cameraX) {
        if (!this.active) return;

        // Compute alpha based on fade state
        let alpha = 1;
        if (this.active.state === 'in') {
            alpha = this.active.timer / this.fadeInFrames;
        } else if (this.active.state === 'out') {
            alpha = 1 - (this.active.timer / this.fadeOutFrames);
        }
        alpha = Math.max(0, Math.min(1, alpha));

        const screenX = (player.x + player.width / 2) - cameraX;
        const screenY = player.y - 80;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'italic 17px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Soft black outline so the italic monologue stays legible on white background
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeText(this.active.text, screenX, screenY);

        ctx.fillStyle = '#111';
        ctx.fillText(this.active.text, screenX, screenY);

        ctx.restore();
    }
}
