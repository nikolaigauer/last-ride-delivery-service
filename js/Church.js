// Church destination point for delivery

class Church {
    constructor(x = 3500, y = 280, name = "St. Mary's") {
        this.x = x;
        this.y = y;
        this.name = name;
        this.width = 400; // Church building width
        this.height = 280; // Church building height

        // Delivery area (in front of church)
        this.deliveryAreaX = this.x - 100;
        this.deliveryAreaY = this.y + this.height;
        this.deliveryAreaWidth = 200; // Wider than hearse
        this.deliveryAreaHeight = 20;

        // Mission state
        this.hasReceivedDelivery = false;
        this.active = true;
        
        // Interaction ranges
        this.deliveryAreaTolerance = this.deliveryAreaWidth * 0.75; // More lenient

    }

    update(terrain) {
        if (!this.active) return;
        // Position church on ground (use ground level at church center)
        const groundY = terrain.getGroundYAt(this.x + this.width / 2);
        this.y = groundY - this.height;
        
        // Update delivery area position
        this.deliveryAreaX = this.x - 100;
        this.deliveryAreaY = groundY - this.deliveryAreaHeight;
    }

    checkHearseInDeliveryArea(hearse) {
        // Check if hearse overlaps with the delivery area rectangle
        const hearseLeft = hearse.x;
        const hearseRight = hearse.x + hearse.width;
        const hearseBottom = hearse.y + hearse.height;
        
        const deliveryLeft = this.deliveryAreaX;
        const deliveryRight = this.deliveryAreaX + this.deliveryAreaWidth;
        const deliveryTop = this.deliveryAreaY;
        const deliveryBottom = this.deliveryAreaY + this.deliveryAreaHeight;
        
        // Check if hearse overlaps with delivery area (simple rectangle intersection)
        const xOverlap = hearseRight > deliveryLeft && hearseLeft < deliveryRight;
        const yOverlap = hearseBottom > deliveryTop && hearseBottom < (deliveryBottom + 100); // Allow some Y tolerance
        
        return xOverlap && yOverlap;
    }
    
    canCompleteDelivery(hearse, coffin, corpse) {
        if (!this.active || this.hasReceivedDelivery) return false;
        return this.checkHearseInDeliveryArea(hearse) &&
               coffin.inHearse &&
               corpse.inCoffin;
    }

    completeDelivery(hearse, coffin, corpse) {
        if (this.hasReceivedDelivery) return false;
        
        this.hasReceivedDelivery = true;
        
        // Calculate delivery quality based on cumulative health
        let deliveryScore = 0;
        
        // Debug health values
        console.log('Church delivery - Health values:', {
            hearse: hearse.health,
            hearseMax: hearse.maxHealth,
            coffin: coffin.health,
            coffinMax: coffin.maxHealth,
            corpse: corpse.health,
            corpseMax: corpse.maxHealth
        });
        
        // Each entity contributes based on remaining health (weighted)
        const hearseWeight = 0.3; // 30% of score
        const coffinWeight = 0.4; // 40% of score  
        const corpseWeight = 0.3; // 30% of score
        
        // Safety checks for undefined health values
        const hearseHealthRatio = (hearse.health !== undefined && hearse.maxHealth !== undefined) ? 
            (hearse.health / hearse.maxHealth) : 1;
        const coffinHealthRatio = (coffin.health !== undefined && coffin.maxHealth !== undefined) ? 
            (coffin.health / coffin.maxHealth) : 1;
        const corpseHealthRatio = (corpse.health !== undefined && corpse.maxHealth !== undefined) ? 
            (corpse.health / corpse.maxHealth) : 1;
        
        deliveryScore += hearseHealthRatio * 100 * hearseWeight;
        deliveryScore += coffinHealthRatio * 100 * coffinWeight;
        deliveryScore += corpseHealthRatio * 100 * corpseWeight;
        
        // Additional penalties for severe issues
        if (coffin.lidOpen) {
            deliveryScore -= 15; // Dignity penalty
        }
        
        if (!corpse.inCoffin) {
            deliveryScore -= 25; // Major dignity penalty
        }
        
        deliveryScore = Math.max(0, Math.round(deliveryScore)); // Round and don't go below 0
        
        console.log(`🕊️ Delivery completed at church! Final score: ${deliveryScore}/100`);
        return {
            score: deliveryScore,
            message: this.getDeliveryMessage(deliveryScore),
            hearseHealth: hearse.health || 0,
            coffinHealth: coffin.health || 0,
            corpseHealth: corpse.health || 0,
            coffinBumps: coffin.bumpCounter,
            lidOpen: coffin.lidOpen,
            corpseInCoffin: corpse.inCoffin
        };
    }

    // Player-facing verdicts stay prose — dispatch never says a number.
    getDeliveryMessage(score) {
        if (score >= 90) {
            return "Not a scratch on him. Nobody says thank you in this business. Still.";
        } else if (score >= 70) {
            return "He arrived more or less as he left. That's all anyone can ask.";
        } else if (score >= 50) {
            return "There were remarks about the casket. Nothing in writing.";
        } else if (score >= 30) {
            return "The family was... understanding about the condition.";
        } else {
            return "We're getting calls about you. Do better.";
        }
    }

    drawInkChurch(ctx, screenX) {
        const w = this.width, h = this.height, x = screenX, y = this.y;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;

        // Nave (main body) — half height of full sprite, sitting on the ground
        const naveH = h * 0.65;
        const naveY = y + h - naveH;
        const naveX = x + w * 0.12;
        const naveW = w * 0.76;

        // Pitched roof over nave
        const roofPeak = naveY - naveH * 0.45;
        ctx.beginPath();
        ctx.moveTo(naveX, naveY);
        ctx.lineTo(naveX + naveW / 2, roofPeak);
        ctx.lineTo(naveX + naveW, naveY);
        ctx.lineTo(naveX + naveW, naveY + naveH);
        ctx.lineTo(naveX, naveY + naveH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bell tower on the left side — taller than nave
        const towerW = w * 0.18;
        const towerX = x + w * 0.06;
        const towerTop = naveY - naveH * 0.55;
        const towerBottom = naveY + naveH;
        ctx.beginPath();
        ctx.rect(towerX, towerTop, towerW, towerBottom - towerTop);
        ctx.fill();
        ctx.stroke();

        // Spire on top of bell tower
        const spireH = naveH * 0.6;
        ctx.beginPath();
        ctx.moveTo(towerX, towerTop);
        ctx.lineTo(towerX + towerW / 2, towerTop - spireH);
        ctx.lineTo(towerX + towerW, towerTop);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cross atop spire
        const cs = 14;
        const ccx = towerX + towerW / 2;
        const ccy = towerTop - spireH - cs;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ccx, ccy - cs);
        ctx.lineTo(ccx, ccy + cs);
        ctx.moveTo(ccx - cs * 0.6, ccy - cs * 0.3);
        ctx.lineTo(ccx + cs * 0.6, ccy - cs * 0.3);
        ctx.stroke();
        ctx.lineWidth = 2;

        // Bell-tower opening (round-topped arch)
        const bowH = 36, bowW = towerW - 14;
        const bowX = towerX + 7;
        const bowY = towerTop + 30;
        ctx.beginPath();
        ctx.moveTo(bowX, bowY + bowH);
        ctx.lineTo(bowX, bowY + bowH / 2);
        ctx.quadraticCurveTo(bowX + bowW / 2, bowY - 4, bowX + bowW, bowY + bowH / 2);
        ctx.lineTo(bowX + bowW, bowY + bowH);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.fillStyle = '#fff';

        // Rose window on nave gable
        const rwX = naveX + naveW / 2;
        const rwY = naveY - naveH * 0.18;
        const rwR = 18;
        ctx.beginPath();
        ctx.arc(rwX, rwY, rwR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rwX - rwR, rwY); ctx.lineTo(rwX + rwR, rwY);
        ctx.moveTo(rwX, rwY - rwR); ctx.lineTo(rwX, rwY + rwR);
        ctx.stroke();

        // Arched doors (centered on nave)
        const dW = 36, dH = 70;
        const dX = naveX + naveW / 2 - dW / 2;
        const dY = naveY + naveH - dH;
        ctx.beginPath();
        ctx.moveTo(dX, dY + dH);
        ctx.lineTo(dX, dY + dH * 0.4);
        ctx.quadraticCurveTo(dX + dW / 2, dY - 8, dX + dW, dY + dH * 0.4);
        ctx.lineTo(dX + dW, dY + dH);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';

        // Engraved name plaque above the doors (e.g. "ST. MARY'S")
        if (this.name) {
            const plaqueY = naveY + naveH * 0.55;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(this.name.toUpperCase(), naveX + naveW / 2, plaqueY);
            ctx.textAlign = 'start';
            ctx.fillStyle = '#fff';
        }

        // Two arched nave windows on each side of doors
        const winH = 50, winW = 22;
        const winY = naveY + naveH - winH - 30;
        [-1, 1].forEach(side => {
            const wx = naveX + naveW / 2 + side * (dW / 2 + 30);
            ctx.beginPath();
            ctx.moveTo(wx - winW / 2, winY + winH);
            ctx.lineTo(wx - winW / 2, winY + winH * 0.4);
            ctx.quadraticCurveTo(wx, winY - 4, wx + winW / 2, winY + winH * 0.4);
            ctx.lineTo(wx + winW / 2, winY + winH);
            ctx.closePath();
            ctx.stroke();
            // Mullion
            ctx.beginPath();
            ctx.moveTo(wx, winY + winH); ctx.lineTo(wx, winY + 4);
            ctx.stroke();
        });
    }

    draw(ctx, cameraX, hearse, coffin, corpse) {
        if (!this.active) return;
        const screenX = this.x - cameraX;
        const deliveryAreaScreenX = this.deliveryAreaX - cameraX;

        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const isHearseInDeliveryArea = this.checkHearseInDeliveryArea(hearse);
            const canDeliver = this.canCompleteDelivery(hearse, coffin, corpse);

            ctx.save();

            if (canDeliver && !this.hasReceivedDelivery) {
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 18;
            }

            this.drawInkChurch(ctx, screenX);
            ctx.shadowBlur = 0;

            // Delivery area marker — ink only: solid-dark dashes when the hearse
            // is placed right, faint dashes while it isn't.
            ctx.shadowBlur = 0; // Reset shadow
            if (isHearseInDeliveryArea) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.setLineDash([12, 7]);
            } else {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 7]);
            }
            
            ctx.strokeRect(deliveryAreaScreenX, this.deliveryAreaY, this.deliveryAreaWidth, this.deliveryAreaHeight);
            ctx.setLineDash([]);

            // Show interaction prompts
            ctx.shadowBlur = 0;

            if (canDeliver && !this.hasReceivedDelivery) {
                Utils.drawPrompt(ctx, 'space — deliver', screenX + this.width / 2, this.y - 16);
            } else if (isHearseInDeliveryArea && (!coffin.inHearse || !corpse.inCoffin)) {
                if (!coffin.inHearse) {
                    Utils.drawPrompt(ctx, 'the casket goes in the hearse first', screenX + this.width / 2, this.y - 16);
                } else if (!corpse.inCoffin) {
                    Utils.drawPrompt(ctx, 'the casket is empty', screenX + this.width / 2, this.y - 16);
                }
            } else if (!isHearseInDeliveryArea && !this.hasReceivedDelivery &&
                       Math.abs((hearse.x + hearse.width / 2) - (this.deliveryAreaX + this.deliveryAreaWidth / 2)) < 900) {
                // Only signpost the parking zone on approach — not from across the map
                Utils.drawPrompt(ctx, '← park in the delivery area', deliveryAreaScreenX + this.deliveryAreaWidth / 2, this.deliveryAreaY - 8);
            }

            ctx.restore();
        }
    }
}