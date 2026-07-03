// Phone booth for mission dispatch

class PhoneBooth {
    constructor(x = 500, y = 300) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 64;
        this.isRinging = true;
        this.isAnswered = false;
        this.active = true;
        
        // Animation state for ringing effect
        this.ringTimer = 0;
        this.ringIntensity = 0;
        
        // Load sprites
        this.phoneSprite = new Image();
        this.phoneSprite.src = 'assets/phone.png';
        this.phoneHangingSprite = new Image();
        this.phoneHangingSprite.src = 'assets/phone-hanging.png';
    }

    update(terrain) {
        if (!this.active) return;
        // Position phone booth on ground
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = groundY - this.height;
        
        // Animate ringing effect
        if (this.isRinging && !this.isAnswered) {
            this.ringTimer++;
            this.ringIntensity = Math.sin(this.ringTimer * 0.3) * 0.5 + 0.5; // Oscillate 0-1
        }
    }

    canInteract(player) {
        if (!this.active || player.inVehicle || this.isAnswered) return false;
        const distance = Math.abs(player.x - this.x);
        return distance < 60;
    }

    answer() {
        this.isRinging = false;
        this.isAnswered = true;
        console.log('Phone answered! Mission briefing...');
        return this.getMissionBriefing();
    }

    // Deliberately vague about which church — the wrong-church gag in episode 1
    // only works if dispatch never named it.
    getMissionBriefing() {
        return {
            title: "Dispatch",
            message: "Pickup at the county hospital, east of here. They'll have him ready.\n\nDelivery's the church out past the canyon. Long road. Don't lose him again.\n\nTry not to make it two funerals.",
            instruction: "Drive east."
        };
    }

    draw(ctx, cameraX, player) {
        if (!this.active) return;
        const screenX = this.x - cameraX;
        
        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const sprite = this.isAnswered ? this.phoneHangingSprite : this.phoneSprite;
            
            ctx.save();
            
            // Add ringing glow effect
            if (this.isRinging && !this.isAnswered) {
                const glowIntensity = this.ringIntensity;
                ctx.shadowColor = '#ffff00'; // Yellow for urgent/ringing
                ctx.shadowBlur = 15 + (glowIntensity * 10);
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Slight phone shake when ringing
                const shakeX = (Math.random() - 0.5) * glowIntensity * 2;
                const shakeY = (Math.random() - 0.5) * glowIntensity * 2;
                
                if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                    ctx.drawImage(sprite, screenX + shakeX, this.y + shakeY, this.width, this.height);
                } else {
                    // Fallback: simple rectangle
                    ctx.fillStyle = '#444';
                    ctx.fillRect(screenX + shakeX, this.y + shakeY, this.width, this.height);
                }
            } else {
                // Static phone (not ringing)
                if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                    ctx.drawImage(sprite, screenX, this.y, this.width, this.height);
                } else {
                    // Fallback: simple rectangle
                    ctx.fillStyle = this.isAnswered ? '#666' : '#444';
                    ctx.fillRect(screenX, this.y, this.width, this.height);
                }
            }
            
            // Show interaction prompt when player is near
            if (this.canInteract(player)) {
                ctx.shadowBlur = 0;
                Utils.drawPrompt(ctx, 'space — answer the phone', screenX + this.width / 2, this.y - 12);
            }
            
            ctx.restore();
        }
    }
}