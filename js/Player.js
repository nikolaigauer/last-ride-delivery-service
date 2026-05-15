// Player character with walk animation and sprite handling

class Player {
    constructor(x = 300, y = 320) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 60;
        this.speed = 3;
        this.isMoving = false;
        this.direction = 'right'; // 'right' or 'left'
        this.inVehicle = false;

        // Animation state
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.frameDelay = 8; // frames to wait before next sprite frame

        // Sprite configuration
        this.spriteSheet = new Image();
        this.spriteSheet.src = 'assets/cycle3.png';
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.framesPerRow = 7;
        this.totalFrames = 9;

        // Initialize sprite when loaded
        this.spriteSheet.onload = () => {
            this.frameWidth = this.spriteSheet.width / this.framesPerRow;
            this.frameHeight = this.spriteSheet.height;
            console.log('Player sprite loaded:', this.spriteSheet.width, 'x', this.spriteSheet.height);
            console.log('Frame dimensions:', this.frameWidth, 'x', this.frameHeight);
        };
    }

    update(input, terrain, hearse) {
        if (this.inVehicle) {
            // Player is driving - position follows hearse, no independent movement
            this.x = hearse.x + hearse.width / 2;
            this.isMoving = false;
            // Don't process arrow key input when in vehicle - hearse handles it
        } else {
            // Player is on foot - only then handle movement input
            this.isMoving = false;

            if (input.isKeyPressed('ArrowRight')) {
                this.x += this.speed;
                this.direction = 'right';
                this.isMoving = true;
            }

            if (input.isKeyPressed('ArrowLeft')) {
                this.x -= this.speed;
                this.direction = 'left';
                this.isMoving = true;
            }

            // Keep player on ground when walking
            const playerGroundY = terrain.getGroundYAt(this.x + this.width / 2);
            this.y = playerGroundY - this.height;
        }

        // Update animation only when walking
        if (this.isMoving && !this.inVehicle) {
            this.frameTimer++;
            if (this.frameTimer >= this.frameDelay) {
                this.frameTimer = 0;
                this.currentFrame = (this.currentFrame + 1) % this.framesPerRow;
            }
        }

        // Keep player in world bounds
        this.x = Math.max(0, Math.min(50000 - this.width, this.x)); // worldWidth = 50000
    }

    enterHearse(hearse) {
        this.inVehicle = true;
        console.log('Player entered hearse');
    }

    exitHearse(hearse, terrain) {
        this.inVehicle = false;
        this.x = hearse.x + hearse.width * 0.6; // Exit at driver's door

        // Position player on ground at exit location
        const exitGroundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = exitGroundY - this.height;
        
        console.log('Player exited hearse');
    }

    draw(ctx, cameraX) {
        // Don't draw if in vehicle
        if (this.inVehicle) return;

        const screenX = this.x - cameraX;

        // Fallback if sprite not loaded
        if (this.frameWidth === 0 || this.frameHeight === 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(screenX, this.y, this.width, this.height);
            return;
        }

        ctx.save();

        // Handle mirroring for left movement
        if (this.direction === 'left') {
            ctx.translate(screenX + this.width / 2, 0);
            ctx.scale(-1, 1);
            ctx.translate(-this.width / 2, 0);
        }

        // Always use the top row (right-facing sprites) and mirror for left
        const row = 0;
        const col = this.currentFrame;

        // Asymmetric crop to fix head and hide left guides
        const leftCrop = 8;
        const topCrop = 2;
        const rightCrop = 3;
        const bottomCrop = 8;

        const srcX = col * this.frameWidth + leftCrop;
        const srcY = row * this.frameHeight + topCrop;
        const srcW = this.frameWidth - leftCrop - rightCrop;
        const srcH = this.frameHeight - topCrop - bottomCrop;

        const drawX = this.direction === 'left' ? 0 : screenX;

        // No glow effect for player

        ctx.drawImage(
            this.spriteSheet,
            srcX, srcY, srcW, srcH,
            drawX, this.y, this.width, this.height
        );

        ctx.restore();
    }

    // Check if player is near an object
    getDistanceTo(object) {
        return Math.abs(this.x - object.x);
    }

    // Check if player can interact with hearse
    canEnterHearse(hearse) {
        const distance = this.getDistanceTo(hearse);
        return distance < 80 && !this.inVehicle;
    }

    // Check if player can load coffin into hearse
    canLoadCoffin(hearse) {
        const hearseBackDoorX = hearse.x;
        const playerCenterX = this.x + this.width / 2;
        const distanceToBackDoor = Math.abs(playerCenterX - hearseBackDoorX);
        return distanceToBackDoor < 40;
    }

    // Check if player can unload coffin from hearse
    canUnloadCoffin(hearse, coffin) {
        if (!coffin.inHearse) return false;
        const hearseBackDoorX = hearse.x;
        const playerCenterX = this.x + this.width / 2;
        const distanceToBackDoor = Math.abs(playerCenterX - hearseBackDoorX);
        return distanceToBackDoor < 40;
    }

}