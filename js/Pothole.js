// Pothole terrain hazard system

class PotholeManager {
    constructor() {
        this.potholes = [];
        this.sprites = [];
        
        // Load pothole sprites
        for (let i = 1; i <= 4; i++) {
            const sprite = new Image();
            sprite.src = `assets/pothole${i}.png`;
            this.sprites.push(sprite);
        }
    }
    
    // Generate potholes along the terrain
    generatePotholes(worldWidth, minSpacing = 200) {
        this.potholes = [];
        
        // Generate potholes with random spacing
        let x = 500; // Start after initial area
        while (x < worldWidth - 500) { // End before final area
            const pothole = {
                x: x,
                y: 0, // Will be set to ground level
                width: 60 + Math.random() * 40, // 60-100 px wide
                height: 20 + Math.random() * 20, // 20-40 px tall
                spriteIndex: Math.floor(Math.random() * this.sprites.length),
                damageMultiplier: 1.5 + Math.random() * 1.0 // 1.5x to 2.5x damage
            };
            
            this.potholes.push(pothole);
            
            // Random spacing between potholes
            x += minSpacing + Math.random() * 300;
        }
        
        console.log(`Generated ${this.potholes.length} potholes across ${worldWidth} world width`);
    }
    
    // Update pothole positions based on terrain
    update(terrain) {
        this.potholes.forEach(pothole => {
            pothole.y = terrain.getGroundYAt(pothole.x + pothole.width / 2) - pothole.height;
        });
    }
    
    // Check if hearse hits any potholes
    checkCollisions(hearse, coffin) {
        if (!hearse || hearse.isAirborne) return; // No collision while airborne
        
        const hearseLeft = hearse.x;
        const hearseRight = hearse.x + hearse.width;
        const hearseBottom = hearse.y + hearse.height;
        
        this.potholes.forEach(pothole => {
            const potholeLeft = pothole.x;
            const potholeRight = pothole.x + pothole.width;
            const potholeTop = pothole.y;
            
            // Check if hearse overlaps with pothole
            const xOverlap = hearseRight > potholeLeft && hearseLeft < potholeRight;
            const yOverlap = hearseBottom > potholeTop && hearseBottom < (potholeTop + pothole.height + 20); // Some tolerance
            
            if (xOverlap && yOverlap && !pothole.hit) {
                pothole.hit = true; // Prevent multiple hits from same pothole
                
                // Speed-based pothole damage
                const speed = Math.abs(hearse.velocity);
                const speedMultiplier = Math.max(0.3, speed / 8); // Less damage at slow speed
                const potholeBaseDamage = hearse.damagePerBump * pothole.damageMultiplier;
                const totalDamage = Math.floor(potholeBaseDamage * speedMultiplier);
                
                // Apply damage to hearse
                hearse.bumpCounter += Math.ceil(speedMultiplier * 2); // 1-3 bumps depending on speed
                hearse.health = Math.max(0, hearse.health - totalDamage);
                
                console.log(`💥 POTHOLE HIT! Speed: ${speed.toFixed(1)}, Damage: ${totalDamage}, Bumps added: ${Math.ceil(speedMultiplier * 2)}, Health: ${hearse.health}/${hearse.maxHealth}`);
                
                // Transfer damage to coffin if inside
                if (coffin && coffin.inHearse) {
                    const coffinDamage = Math.floor(coffin.damagePerBump * pothole.damageMultiplier * speedMultiplier);
                    coffin.bumpCounter += Math.ceil(speedMultiplier * 2);
                    coffin.health = Math.max(0, coffin.health - coffinDamage);
                    console.log(`💥 Coffin pothole damage! Damage: ${coffinDamage}, Bumps: ${coffin.bumpCounter}/${coffin.bumpThreshold}, Health: ${coffin.health}/${coffin.maxHealth}`);
                }
                
                // Reset hit flag after a delay to allow re-hitting same pothole
                setTimeout(() => { pothole.hit = false; }, 1000);
            }
        });
    }
    
    // Draw all potholes
    draw(ctx, cameraX) {
        this.potholes.forEach(pothole => {
            const screenX = pothole.x - cameraX;
            
            // Only draw if visible on screen
            if (screenX > -pothole.width && screenX < ctx.canvas.width + pothole.width) {
                const sprite = this.sprites[pothole.spriteIndex];
                
                if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                    ctx.drawImage(sprite, screenX, pothole.y, pothole.width, pothole.height);
                } else {
                    // Fallback: dark brown rectangle
                    ctx.fillStyle = '#2d1810';
                    ctx.fillRect(screenX, pothole.y, pothole.width, pothole.height);
                    
                    // Add rim
                    ctx.strokeStyle = '#1a0f08';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(screenX, pothole.y, pothole.width, pothole.height);
                }
            }
        });
    }
}