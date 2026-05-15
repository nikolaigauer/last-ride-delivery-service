// Phone booth for mission dispatch

class PhoneBooth {
    constructor(x = 500, y = 300) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 80;
        this.isRinging = true;
        this.isAnswered = false;
        
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
        if (player.inVehicle || this.isAnswered) return false;
        const distance = Math.abs(player.x - this.x);
        return distance < 60;
    }

    answer() {
        this.isRinging = false;
        this.isAnswered = true;
        console.log('Phone answered! Mission briefing...');
        return this.getMissionBriefing();
    }

    getMissionBriefing() {
        return {
            title: "Dispatch - Long Haul",
            message: "We got a pickup at Miller's Funeral Home, delivery to Hillside Cemetery.\n\nIt's a long journey through rough country. Watch for the canyon.\n\nTry to keep 'em dignified this time...",
            instruction: "→ Drive east - LONG journey ahead"
        };
    }

    draw(ctx, cameraX, player) {
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
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('SPACEBAR: Answer Phone', screenX - 20, this.y - 10);
            }
            
            ctx.restore();
        }
    }
}