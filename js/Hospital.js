// Hospital morgue with loading dock

class Hospital {
    constructor(x = 1500, y = 280) {
        this.x = x;
        this.y = y;
        this.width = 500; // Hospital building (reduced by ~15%)
        this.height = 320; // Hospital building (reduced by ~20%)

        // Hospital door (at front entrance, not loading dock)
        this.doorX = this.x + this.width / 2;
        this.doorY = this.y + this.height;

        // Loading area (to the right of hospital)
        this.loadingAreaX = this.x + this.width + 50;
        this.loadingAreaY = this.y + this.height;
        this.loadingAreaWidth = 300; // Wider than hearse
        this.loadingAreaHeight = 20;

        // Mission state
        this.hasSpawnedCargo = false;
        this.playerHasInteracted = false;
        
        // Interaction ranges
        this.doorInteractionRange = 60;
        this.loadingAreaTolerance = this.loadingAreaWidth * 0.75; // More lenient - 75% of loading area width

    }

    update(terrain) {
        // Position hospital on ground - use the flattened terrain around hospital
        // The terrain system already flattens ±300px around x=2500 (hospital location)
        const flatGroundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = flatGroundY - this.height;

        // Update door position (door is at ground level at hospital center)
        this.doorX = this.x + this.width / 2;
        this.doorY = flatGroundY;
        
        // Update loading area position - also use flat terrain for loading area
        this.loadingAreaX = this.x + this.width + 50;
        this.loadingAreaY = flatGroundY - this.loadingAreaHeight;
    }

    checkHearseInLoadingArea(hearse) {
        // Check if hearse overlaps with the loading area rectangle
        const hearseLeft = hearse.x;
        const hearseRight = hearse.x + hearse.width;
        const hearseBottom = hearse.y + hearse.height;
        
        const loadingLeft = this.loadingAreaX;
        const loadingRight = this.loadingAreaX + this.loadingAreaWidth;
        const loadingTop = this.loadingAreaY;
        const loadingBottom = this.loadingAreaY + this.loadingAreaHeight;
        
        // Check if hearse overlaps with loading area (simple rectangle intersection)
        const xOverlap = hearseRight > loadingLeft && hearseLeft < loadingRight;
        const yOverlap = hearseBottom > loadingTop && hearseBottom < (loadingBottom + 100); // Allow some Y tolerance
        
        const inLoadingArea = xOverlap && yOverlap;
        
        // Debug logging
        if (this.playerHasInteracted && !this.hasSpawnedCargo) {
            console.log(`Loading check: hearse(${hearseLeft.toFixed(1)}-${hearseRight.toFixed(1)}) vs loading(${loadingLeft.toFixed(1)}-${loadingRight.toFixed(1)}), xOverlap=${xOverlap}, yOverlap=${yOverlap}, inArea=${inLoadingArea}`);
        }
        
        return inLoadingArea;
    }
    
    canPlayerInteractWithDoor(player) {
        // Check if player (on foot) can interact with hospital door
        if (player.inVehicle) return false;
        
        const distance = Math.abs(player.x - this.doorX);
        return distance < this.doorInteractionRange;
    }

    interactWithDoor() {
        if (this.playerHasInteracted || this.hasSpawnedCargo) return false;
        
        this.playerHasInteracted = true;
        console.log('🏥 Patient collected from morgue! Ready for transport.');
        return true;
    }

    spawnCargo(coffin, corpse, hearse) {
        if (this.hasSpawnedCargo || !this.playerHasInteracted) return false;

        // Position coffin between hearse and hospital (in loading area)
        const spawnX = this.loadingAreaX + this.loadingAreaWidth / 3; // Third way into loading area
        coffin.x = spawnX - coffin.width / 2;
        
        // Get ground level and place coffin properly on it
        const groundY = this.doorY; // Use same ground level as hospital door
        coffin.y = groundY - coffin.height;
        coffin.velocityY = 0; // Prevent falling
        coffin.velocityX = 0; // Prevent sliding
        coffin.inHearse = false;
        coffin.isPickedUp = false;
        coffin.lidOpen = false;
        coffin.lidOpenedByBump = false; // Reset lid state
        coffin.bumpCounter = 0;
        coffin.lastDirection = null; // Reset direction tracking
        coffin.isActive = true; // Activate the coffin
        
        console.log(`🏥 Coffin reset - bumps: ${coffin.bumpCounter}, lid: ${coffin.lidOpen}, health: ${coffin.health}`);

        // Corpse is already loaded in the coffin (pre-prepared by morgue)
        corpse.inCoffin = true;
        corpse.isPickedUp = false;
        // CRITICAL: Must use moveToPosition to move ALL body parts, not just reference coords!
        corpse.moveToPosition(coffin.x, coffin.y);
        corpse.isActive = true;
        console.log(`💀 Corpse body parts moved to coffin position: (${coffin.x.toFixed(1)}, ${coffin.y.toFixed(1)})`); // Activate the corpse

        this.hasSpawnedCargo = true;
        console.log(`🏥 Coffin spawned at x=${coffin.x.toFixed(1)}, y=${coffin.y.toFixed(1)}! Loading area: x=${this.loadingAreaX}-${this.loadingAreaX + this.loadingAreaWidth}`);
        return true;
    }

    drawInkBuilding(ctx, screenX) {
        const w = this.width, h = this.height, x = screenX, y = this.y;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'miter';

        // Main block (flat-roof institutional)
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();

        // Roof parapet line
        ctx.beginPath();
        ctx.moveTo(x, y + 18);
        ctx.lineTo(x + w, y + 18);
        ctx.stroke();

        // Window grid — 3 columns x 3 rows
        const winCols = 3, winRows = 3;
        const padX = 40, padY = 50;
        const winW = (w - padX * 2) / (winCols * 2 - 1);
        const winH = 38;
        const rowGap = 28;
        for (let r = 0; r < winRows; r++) {
            for (let c = 0; c < winCols; c++) {
                const wx = x + padX + c * winW * 2;
                const wy = y + padY + r * (winH + rowGap);
                ctx.strokeRect(wx, wy, winW, winH);
                ctx.beginPath();
                ctx.moveTo(wx + winW / 2, wy);
                ctx.lineTo(wx + winW / 2, wy + winH);
                ctx.moveTo(wx, wy + winH / 2);
                ctx.lineTo(wx + winW, wy + winH / 2);
                ctx.stroke();
            }
        }

        // Central double-door entrance
        const doorW = 60, doorH = 90;
        const doorX = x + w / 2 - doorW / 2;
        const doorY = y + h - doorH;
        ctx.strokeRect(doorX, doorY, doorW, doorH);
        ctx.beginPath();
        ctx.moveTo(doorX + doorW / 2, doorY);
        ctx.lineTo(doorX + doorW / 2, doorY + doorH);
        ctx.stroke();

        // Cross plaque above door
        const cs = 22;
        const cx = x + w / 2;
        const cy = doorY - 24;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cs / 2);
        ctx.lineTo(cx, cy + cs / 2);
        ctx.moveTo(cx - cs / 2, cy);
        ctx.lineTo(cx + cs / 2, cy);
        ctx.stroke();
        ctx.lineWidth = 2;

        // "HOSPITAL" sign band
        ctx.beginPath();
        ctx.moveTo(x + 30, y + 28);
        ctx.lineTo(x + w - 30, y + 28);
        ctx.moveTo(x + 30, y + 42);
        ctx.lineTo(x + w - 30, y + 42);
        ctx.stroke();
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText('HOSPITAL', x + w / 2, y + 39);
        ctx.textAlign = 'start';

        // Loading-dock awning (cantilevered over loading area, to the right)
        const awnX = x + w;
        const awnY = y + h - 60;
        const awnW = 80;
        const awnH = 20;
        ctx.beginPath();
        ctx.moveTo(awnX, awnY);
        ctx.lineTo(awnX + awnW, awnY + awnH);
        ctx.lineTo(awnX + awnW, awnY + awnH + 6);
        ctx.lineTo(awnX, awnY + 6);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.stroke();
    }

    draw(ctx, cameraX, hearse, player) {
        const screenX = this.x - cameraX;
        const loadingAreaScreenX = this.loadingAreaX - cameraX;

        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const isHearseInLoadingArea = this.checkHearseInLoadingArea(hearse);
            const canPlayerInteract = this.canPlayerInteractWithDoor(player);

            ctx.save();

            // Glow when interactable
            if (canPlayerInteract && !this.playerHasInteracted) {
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 20;
            }

            this.drawInkBuilding(ctx, screenX);
            ctx.shadowBlur = 0;

            // Draw loading area with glow when hearse is positioned correctly
            ctx.shadowBlur = 0; // Reset shadow
            if (isHearseInLoadingArea) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 10]);
            } else {
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
            }
            
            ctx.strokeRect(loadingAreaScreenX, this.loadingAreaY, this.loadingAreaWidth, this.loadingAreaHeight);
            ctx.setLineDash([]);

            // Show interaction prompts
            if (hearse && player) {
                ctx.shadowBlur = 0;
                ctx.font = 'bold 14px Arial';

                // Hospital door interaction
                if (canPlayerInteract && !this.playerHasInteracted) {
                    ctx.fillStyle = '#00ff00';
                    ctx.fillText('SPACEBAR: Collect Patient', screenX + this.width/2 - 80, this.y - 20);
                } else if (this.playerHasInteracted && !this.hasSpawnedCargo) {
                    ctx.fillStyle = '#ffaa00';
                    ctx.fillText('Patient ready for transport...', screenX + this.width/2 - 80, this.y - 20);
                }

                // Loading area guidance
                if (isHearseInLoadingArea && this.playerHasInteracted) {
                    ctx.fillStyle = '#00ff00';
                    ctx.fillText('✓ LOADING AREA', loadingAreaScreenX + 20, this.loadingAreaY - 10);
                } else if (!isHearseInLoadingArea) {
                    ctx.fillStyle = '#ffaa00';
                    ctx.fillText('PARK IN LOADING AREA →', screenX + this.width + 10, this.y + this.height/2);
                }
            }

            ctx.restore();
        }
    }
}