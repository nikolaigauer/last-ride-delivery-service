// Church destination point for delivery

class Church {
    constructor(x = 3500, y = 280) {
        this.x = x;
        this.y = y;
        this.width = 400; // Church building width
        this.height = 280; // Church building height

        // Delivery area (in front of church)
        this.deliveryAreaX = this.x - 100;
        this.deliveryAreaY = this.y + this.height;
        this.deliveryAreaWidth = 200; // Wider than hearse
        this.deliveryAreaHeight = 20;

        // Mission state
        this.hasReceivedDelivery = false;
        
        // Interaction ranges
        this.deliveryAreaTolerance = this.deliveryAreaWidth * 0.75; // More lenient

    }

    update(terrain) {
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
        // Check if delivery can be completed:
        // 1. Hearse is in delivery area
        // 2. Coffin is in hearse
        // 3. Corpse is in coffin (or has been delivered previously)
        return this.checkHearseInDeliveryArea(hearse) && 
               coffin.inHearse && 
               (corpse.inCoffin || this.hasReceivedDelivery);
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

    getDeliveryMessage(score) {
        if (score >= 90) {
            return "Exemplary service! The family was deeply moved by your professionalism.";
        } else if (score >= 70) {
            return "Good delivery. The family appreciates your careful handling.";
        } else if (score >= 50) {
            return "Adequate service. Some minor concerns were raised.";
        } else if (score >= 30) {
            return "Rough delivery. The family was... understanding about the condition.";
        } else {
            return "We're getting calls. Please handle our clients with more dignity.";
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

            // Draw delivery area with glow when hearse is positioned correctly
            ctx.shadowBlur = 0; // Reset shadow
            if (isHearseInDeliveryArea) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 10]);
            } else {
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
            }
            
            ctx.strokeRect(deliveryAreaScreenX, this.deliveryAreaY, this.deliveryAreaWidth, this.deliveryAreaHeight);
            ctx.setLineDash([]);

            // Show interaction prompts
            ctx.shadowBlur = 0;
            ctx.font = 'bold 14px Arial';

            if (canDeliver && !this.hasReceivedDelivery) {
                ctx.fillStyle = '#00ff00';
                ctx.fillText('SPACEBAR: Complete Delivery', screenX + this.width/2 - 80, this.y - 20);
            } else if (isHearseInDeliveryArea && (!coffin.inHearse || !corpse.inCoffin)) {
                ctx.fillStyle = '#ff6600';
                if (!coffin.inHearse) {
                    ctx.fillText('Load coffin into hearse first', screenX + this.width/2 - 80, this.y - 20);
                } else if (!corpse.inCoffin) {
                    ctx.fillText('Corpse missing from coffin!', screenX + this.width/2 - 80, this.y - 20);
                }
            } else if (!isHearseInDeliveryArea) {
                ctx.fillStyle = '#ffaa00';
                ctx.fillText('← PARK IN DELIVERY AREA', screenX - 180, this.y + this.height/2);
            }

            if (this.hasReceivedDelivery) {
                ctx.fillStyle = '#888';
                ctx.fillText('✓ Delivery Complete', screenX + this.width/2 - 60, this.y - 20);
            }

            ctx.restore();
        }
    }
}