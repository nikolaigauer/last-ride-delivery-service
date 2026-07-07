// Church destination point for delivery

class Church {
    constructor(x = 3500, y = 280, name = "St. Mary's", variant = 'church') {
        this.x = x;
        this.y = y;
        this.name = name;
        this.variant = variant; // 'church' | 'graveyard' — same delivery logic, different drawing
        this.width = 400; // Building/grounds width
        this.height = variant === 'graveyard' ? 150 : 280;

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
    
    // The casket must contain SOMETHING. Nobody specified what.
    // openCasket destinations are pickier: the man must be whole — or at
    // least, something head-shaped must be in there with him.
    canCompleteDelivery(hearse, coffin, corpse, roadkill = null) {
        if (!this.active || this.hasReceivedDelivery) return false;
        let cargoLoaded;
        if (this.openCasket) {
            cargoLoaded = corpse.inCoffin &&
                (!corpse.headDetached || (roadkill && roadkill.inCoffin));
        } else {
            cargoLoaded = corpse.inCoffin || (roadkill && roadkill.inCoffin);
        }
        return this.checkHearseInDeliveryArea(hearse) &&
               coffin.inHearse &&
               cargoLoaded;
    }

    completeDelivery(hearse, coffin, corpse, roadkill = null) {
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

        // The substitutions. Body double: the family never opened the lid.
        // Head double: the family did. Verdicts differ accordingly.
        const substituted = roadkill && roadkill.inCoffin && !corpse.inCoffin;
        const headSubstituted = this.openCasket && corpse.inCoffin &&
            corpse.headDetached && roadkill && roadkill.inCoffin;

        console.log(`🕊️ Delivery completed at church! Final score: ${deliveryScore}/100${substituted || headSubstituted ? ' (SUBSTITUTED)' : ''}`);
        let message;
        if (substituted) {
            message = "Closed casket. The family was moved. Nobody looked.";
        } else if (headSubstituted) {
            message = "Open casket. The widow said he finally looked at peace. Rounder than she remembered. At peace.";
        } else {
            message = this.getDeliveryMessage(deliveryScore);
        }
        return {
            score: deliveryScore,
            substituted: substituted || headSubstituted,
            message,
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

    // Graveyard variant: low stone wall, iron gate, headstones, one bare tree.
    // Squat and mundane — a place, not a monument.
    drawInkGraveyard(ctx, screenX) {
        const w = this.width, h = this.height, x = screenX, y = this.y;
        const groundY = y + h;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 2;

        // Low wall along the full width, gap in the middle for the gate
        const wallH = 26;
        const gateW = 56;
        const gateL = x + w / 2 - gateW / 2;
        const gateR = x + w / 2 + gateW / 2;
        for (const [wx0, wx1] of [[x, gateL], [gateR, x + w]]) {
            ctx.fillRect(wx0, groundY - wallH, wx1 - wx0, wallH);
            ctx.strokeRect(wx0, groundY - wallH, wx1 - wx0, wallH);
            // Coping line
            ctx.beginPath();
            ctx.moveTo(wx0, groundY - wallH + 6);
            ctx.lineTo(wx1, groundY - wallH + 6);
            ctx.stroke();
        }

        // Gate pillars + shallow iron arch
        const pillarW = 10, pillarH = 46;
        ctx.fillRect(gateL - pillarW, groundY - pillarH, pillarW, pillarH);
        ctx.strokeRect(gateL - pillarW, groundY - pillarH, pillarW, pillarH);
        ctx.fillRect(gateR, groundY - pillarH, pillarW, pillarH);
        ctx.strokeRect(gateR, groundY - pillarH, pillarW, pillarH);
        ctx.beginPath();
        ctx.moveTo(gateL - pillarW / 2, groundY - pillarH);
        ctx.quadraticCurveTo(x + w / 2, groundY - pillarH - 26, gateR + pillarW / 2, groundY - pillarH);
        ctx.stroke();
        // Iron gate bars (open inward: just a few verticals, ajar)
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 4; i++) {
            const bx = gateL + (gateW / 5) * i - 12;
            ctx.beginPath();
            ctx.moveTo(bx, groundY);
            ctx.lineTo(bx - 6, groundY - 34);
            ctx.stroke();
        }
        ctx.lineWidth = 2;

        // Name plaque on the arch
        if (this.name) {
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(this.name.toUpperCase(), x + w / 2, groundY - pillarH - 32);
            ctx.textAlign = 'start';
            ctx.fillStyle = '#fff';
        }

        // Headstones behind the wall — assorted heights, one leaning
        const stones = [
            [0.10, 34, 16, 0], [0.20, 26, 14, 0], [0.32, 40, 16, -0.06],
            [0.62, 30, 14, 0], [0.72, 44, 18, 0.05], [0.86, 28, 14, 0],
        ];
        for (const [fx, sh, sw, lean] of stones) {
            const sx = x + w * fx;
            const sy = groundY - wallH - 2;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(lean);
            ctx.beginPath();
            ctx.moveTo(-sw / 2, 0);
            ctx.lineTo(-sw / 2, -sh + sw / 2);
            ctx.arc(0, -sh + sw / 2, sw / 2, Math.PI, 0);
            ctx.lineTo(sw / 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        // One cross among them
        const crX = x + w * 0.47, crY = groundY - wallH - 2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(crX, crY); ctx.lineTo(crX, crY - 40);
        ctx.moveTo(crX - 10, crY - 28); ctx.lineTo(crX + 10, crY - 28);
        ctx.stroke();
        ctx.lineWidth = 2;

        // Bare tree at the far end
        const tx = x + w * 0.95;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx, groundY);
        ctx.lineTo(tx - 4, groundY - h * 0.7);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - 3, groundY - h * 0.5);
        ctx.lineTo(tx - 24, groundY - h * 0.72);
        ctx.moveTo(tx - 4, groundY - h * 0.62);
        ctx.lineTo(tx + 16, groundY - h * 0.85);
        ctx.moveTo(tx - 4, groundY - h * 0.7);
        ctx.lineTo(tx - 12, groundY - h * 0.92);
        ctx.stroke();

        // A fresh hole, waiting, just inside the gate — with a mound of earth
        const holeX = x + w * 0.56, holeW = 46;
        ctx.fillStyle = '#000';
        ctx.fillRect(holeX, groundY - 3, holeW, 6);
        ctx.beginPath();
        ctx.ellipse(holeX + holeW + 22, groundY - 6, 18, 8, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
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

    draw(ctx, cameraX, hearse, coffin, corpse, roadkill = null) {
        if (!this.active) return;
        const screenX = this.x - cameraX;
        const deliveryAreaScreenX = this.deliveryAreaX - cameraX;

        // Only draw if visible on screen
        if (screenX > -this.width && screenX < ctx.canvas.width + this.width) {
            const isHearseInDeliveryArea = this.checkHearseInDeliveryArea(hearse);
            const canDeliver = this.canCompleteDelivery(hearse, coffin, corpse, roadkill);

            ctx.save();

            if (canDeliver && !this.hasReceivedDelivery) {
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 18;
            }

            if (this.variant === 'graveyard') {
                this.drawInkGraveyard(ctx, screenX);
            } else {
                this.drawInkChurch(ctx, screenX);
            }
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

            // The county believes in signage here, too
            if (!this.hasReceivedDelivery) {
                Utils.drawSign(ctx, deliveryAreaScreenX - 46, this.deliveryAreaY + this.deliveryAreaHeight, 'parking');
            }

            // Show interaction prompts
            ctx.shadowBlur = 0;

            // Delivery = the casket set on this church's bier, by hand. The
            // only church-level prompts are complaints about the contents.
            const casketFilled = this.openCasket
                ? (corpse.inCoffin && (!corpse.headDetached || (roadkill && roadkill.inCoffin)))
                : (corpse.inCoffin || (roadkill && roadkill.inCoffin));
            if (!this.hasReceivedDelivery && this.bier && this.bier.hasCoffin && !casketFilled) {
                if (this.openCasket && corpse.inCoffin && corpse.headDetached) {
                    Utils.drawPrompt(ctx, 'the man is not all there', screenX + this.width / 2, this.y - 16);
                } else {
                    Utils.drawPrompt(ctx, 'the casket is empty', screenX + this.width / 2, this.y - 16);
                }
            }

            ctx.restore();
        }
    }
}