// Terrain generation and management

class Terrain {
    constructor(worldWidth = 10000) {
        this.worldWidth = worldWidth;
        this.landscapePoints = this.generateLandscape();

        // Parallax silhouette layers — deterministic procedural ridgelines.
        // Each layer: { points: [...], parallax: 0..1, fill, opacity, baseY, amp }
        this.parallaxLayers = this.generateParallaxLayers();

        // Pre-render a small paper-grain tile once; we'll repeat-draw it each frame.
        this.grainTile = this.buildGrainTile(160);
    }

    // Seeded pseudo-random so silhouettes don't shimmer between frames or sessions.
    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    generateParallaxLayers() {
        // Far layer: faint, low contrast, gentle profile.
        // Near layer: stronger, slightly more jagged.
        const layers = [
            { parallax: 0.15, fill: 'rgba(0,0,0,0.10)', amp: 70,  baseY: 290, step: 220, seed: 1337 },
            { parallax: 0.35, fill: 'rgba(0,0,0,0.18)', amp: 55,  baseY: 320, step: 160, seed: 9001 },
        ];
        return layers.map(layer => {
            const rng = this.seededRandom(layer.seed);
            const pts = [];
            // Generate well beyond world bounds for parallax tail
            const xMax = this.worldWidth + 4000;
            for (let x = -2000; x <= xMax; x += layer.step) {
                const noise = (rng() - 0.5) * 2; // -1..1
                const slow  = Math.sin(x * 0.0008 + layer.seed) * 0.6;
                pts.push({ x, y: layer.baseY + (noise * 0.6 + slow) * layer.amp });
            }
            return { ...layer, points: pts };
        });
    }

    buildGrainTile(size) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const g = c.getContext('2d');
        const img = g.createImageData(size, size);
        for (let i = 0; i < img.data.length; i += 4) {
            // Mostly transparent; sparse dark and light specks for paper feel.
            const r = Math.random();
            let a = 0, v = 0;
            if (r < 0.04)      { v = 0;   a = 22; }  // dark fleck
            else if (r < 0.10) { v = 0;   a = 10; }
            else if (r < 0.14) { v = 255; a = 18; }  // light fleck (highlights)
            img.data[i]     = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = a;
        }
        g.putImageData(img, 0, 0);
        return c;
    }

    generateLandscape() {
        const points = [];
        const step = 80; // Smaller steps for smoother curves
        let baseHeight = 350;

        for (let x = 0; x <= this.worldWidth; x += step) {
            let variation = 0;
            const worldProgress = x / this.worldWidth;

            // SECTION 1: Tutorial Flat Start (0% - 8%)
            if (worldProgress < 0.08) {
                variation = 0; // Completely flat for phone booth and hospital pickup
            }
            // SECTION 2: Gentle Hills - Learning (8% - 20%)
            else if (worldProgress < 0.20) {
                const phase = (worldProgress - 0.08) / 0.12;
                variation = Math.sin(phase * Math.PI * 4) * 25 + Math.sin(phase * Math.PI * 12) * 10;
            }
            // SECTION 3: Rolling Countryside (20% - 35%)
            else if (worldProgress < 0.35) {
                const phase = (worldProgress - 0.20) / 0.15;
                variation = Math.sin(phase * Math.PI * 5) * 45 + Math.sin(phase * Math.PI * 15) * 20;
            }
            // SECTION 4: Mountain Approach - Getting Serious (35% - 50%)
            else if (worldProgress < 0.50) {
                const phase = (worldProgress - 0.35) / 0.15;
                variation = 20 + Math.sin(phase * Math.PI * 3) * 60 + Math.sin(phase * Math.PI * 9) * 30;
                
                // Add some challenging bumps
                const bumpFreq = (x / 500) % 1;
                if (bumpFreq < 0.15) {
                    variation += Math.sin(bumpFreq * Math.PI * 6.67) * 25; // Sharp bump
                }
            }
            // SECTION 5: The Great Canyon - Major Challenge (50% - 60%)
            else if (worldProgress < 0.60) {
                const phase = (worldProgress - 0.50) / 0.10;
                
                if (phase < 0.2) {
                    // Descent into canyon
                    variation = 80 - phase * 200; // Drop from +80 to -120
                } else if (phase < 0.4) {
                    // Canyon floor with small bumps
                    variation = -120 + Math.sin((phase - 0.2) * Math.PI * 25) * 15;
                } else if (phase < 0.6) {
                    // The Big Jump - canyon exit ramp
                    const jumpPhase = (phase - 0.4) / 0.2;
                    variation = -120 + jumpPhase * 200; // Steep ramp up
                } else if (phase < 0.7) {
                    // Launch plateau
                    variation = 80;
                } else {
                    // Landing area
                    variation = 80 - (phase - 0.7) * 100; // Gentle descent
                }
            }
            // SECTION 6: Mountain Peaks - Technical Challenge (60% - 75%)
            else if (worldProgress < 0.75) {
                const phase = (worldProgress - 0.60) / 0.15;
                // Sharp, jagged mountain terrain
                variation = 50 + Math.sin(phase * Math.PI * 12) * 70;
                
                // Add dangerous spikes
                const spikeFreq = (x / 200) % 1;
                if (spikeFreq < 0.05) {
                    variation += 50; // Dangerous upward spike
                } else if (spikeFreq > 0.95) {
                    variation -= 60; // Sharp drop
                }
                
                // Secondary roughness
                variation += Math.sin(phase * Math.PI * 50) * 15;
            }
            // SECTION 7: The Descent - Speed Challenge (75% - 85%)
            else if (worldProgress < 0.85) {
                const phase = (worldProgress - 0.75) / 0.10;
                // Long downhill with challenging rhythm
                variation = 50 - phase * 100; // Overall descent
                variation += Math.sin(phase * Math.PI * 8) * 30; // Rhythm bumps
                variation += Math.sin(phase * Math.PI * 20) * 15; // Fine detail
            }
            // SECTION 8: Valley Crossing (85% - 95%)
            else if (worldProgress < 0.95) {
                const phase = (worldProgress - 0.85) / 0.10;
                // Cross a valley with one more major jump
                if (phase < 0.3) {
                    variation = -50; // Valley floor
                } else if (phase < 0.5) {
                    // Exit ramp
                    variation = -50 + ((phase - 0.3) / 0.2) * 130; // Up to +80
                } else if (phase < 0.6) {
                    // Jump plateau
                    variation = 80;
                } else {
                    // Final landing
                    variation = 80 - ((phase - 0.6) / 0.4) * 60; // Down to +20
                }
            }
            // SECTION 9: Church Approach - Final Stretch (95% - 100%)
            else {
                const phase = (worldProgress - 0.95) / 0.05;
                // Gentle approach to church
                variation = 20 * (1 - phase); // Smooth to flat
            }

            // Flatten terrain under buildings
            let finalVariation = variation;
            
            // Hospital area (x=2500, flatten ±400px around it for wider flat area)
            const hospitalX = 2500;
            if (Math.abs(x - hospitalX) < 400) {
                const hospitalBlend = Math.max(0, 1 - Math.abs(x - hospitalX) / 400);
                finalVariation = 0; // Force completely flat, no blending
            }
            
            // Church area (x=22000, flatten ±400px around it) 
            const churchX = 22000;
            if (Math.abs(x - churchX) < 400) {
                const churchBlend = Math.max(0, 1 - Math.abs(x - churchX) / 400);
                finalVariation = 0; // Force completely flat, no blending
            }
            
            // River area - flatten approach areas for barge crossing (wider area)
            const riverX = 13500;
            if (Math.abs(x - riverX) < 800) {
                finalVariation = 0; // Flat terrain for river crossing
            }
            
            points.push({
                x: x,
                horizonY: baseHeight + finalVariation,
                groundY: baseHeight + finalVariation + 15
            });
        }
        return points;
    }

    // Build static Matter.js bodies from landscapePoints.
    // Each segment becomes a thick rectangle rotated to match its slope.
    // Corpse and player still use getGroundYAt() — only hearse/coffin collide with these.
    buildMatterBody(physics) {
        const pts = this.landscapePoints;
        const thick = 200;
        const bodies = [];

        for (let i = 0; i < pts.length - 1; i++) {
            const x1 = pts[i].x,   y1 = pts[i].groundY;
            const x2 = pts[i+1].x, y2 = pts[i+1].groundY;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx);

            // Inward normal (into earth): (-sin θ, cos θ) in canvas y-down coords
            const nx = -Math.sin(angle);
            const ny =  Math.cos(angle);
            const cx = (x1 + x2) / 2 + nx * thick / 2;
            const cy = (y1 + y2) / 2 + ny * thick / 2;

            bodies.push(Matter.Bodies.rectangle(cx, cy, len, thick, {
                isStatic: true,
                angle,
                friction: 0.8,
                restitution: 0.1,
                label: 'terrain',
            }));
        }

        // World boundary walls so hearse can't escape off the edges
        const wallH = 1000;
        bodies.push(Matter.Bodies.rectangle(-100, 250, 200, wallH, { isStatic: true, label: 'wall' }));
        bodies.push(Matter.Bodies.rectangle(this.worldWidth + 100, 250, 200, wallH, { isStatic: true, label: 'wall' }));

        Matter.Composite.add(physics.world, bodies);
        this.matterBodies = bodies;
    }

    getTerrainSlopeAt(x) {
        // Find two landscape points around the given x position
        let leftPoint = null;
        let rightPoint = null;

        for (let i = 0; i < this.landscapePoints.length - 1; i++) {
            if (this.landscapePoints[i].x <= x && this.landscapePoints[i + 1].x > x) {
                leftPoint = this.landscapePoints[i];
                rightPoint = this.landscapePoints[i + 1];
                break;
            }
        }

        if (!leftPoint || !rightPoint) return 0;

        // Calculate slope (rise over run)
        const rise = rightPoint.groundY - leftPoint.groundY;
        const run = rightPoint.x - leftPoint.x;
        return rise / run;
    }

    getGroundYAt(x) {
        // Handle boundary cases - extend terrain beyond world edges
        if (x < 0) {
            // Use first point's height for positions left of world
            return this.landscapePoints[0].groundY;
        }
        if (x > this.worldWidth) {
            // Use last point's height for positions right of world
            return this.landscapePoints[this.landscapePoints.length - 1].groundY;
        }

        // Interpolate ground height at specific x position
        let leftPoint = null;
        let rightPoint = null;

        for (let i = 0; i < this.landscapePoints.length - 1; i++) {
            if (this.landscapePoints[i].x <= x && this.landscapePoints[i + 1].x > x) {
                leftPoint = this.landscapePoints[i];
                rightPoint = this.landscapePoints[i + 1];
                break;
            }
        }

        // Fallback if no points found (shouldn't happen with boundary checks above)
        if (!leftPoint || !rightPoint) {
            console.warn(`No terrain points found for x: ${x}`);
            return this.landscapePoints[0].groundY;
        }

        // Linear interpolation
        const ratio = (x - leftPoint.x) / (rightPoint.x - leftPoint.x);
        return leftPoint.groundY + (rightPoint.groundY - leftPoint.groundY) * ratio;
    }

    drawSky(ctx, canvasWidth, canvasHeight) {
        // Warm-paper gradient (off-white to faint warm grey at horizon)
        const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        grad.addColorStop(0,    '#fafaf7');
        grad.addColorStop(0.55, '#f3f1ea');
        grad.addColorStop(1,    '#e9e6dc');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    drawParallax(ctx, cameraX, canvasWidth, canvasHeight) {
        for (const layer of this.parallaxLayers) {
            const offset = cameraX * layer.parallax;
            ctx.fillStyle = layer.fill;
            ctx.beginPath();
            let started = false;
            for (const p of layer.points) {
                const sx = p.x - offset;
                if (sx < -200 || sx > canvasWidth + 200) continue;
                if (!started) { ctx.moveTo(sx, p.y); started = true; }
                else          { ctx.lineTo(sx, p.y); }
            }
            // Close ridgeline down to bottom of canvas to form a silhouette.
            ctx.lineTo(canvasWidth + 200, canvasHeight);
            ctx.lineTo(-200, canvasHeight);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawGrain(ctx, canvasWidth, canvasHeight) {
        if (!this._grainPattern) {
            this._grainPattern = ctx.createPattern(this.grainTile, 'repeat');
        }
        ctx.save();
        ctx.fillStyle = this._grainPattern;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
    }

    draw(ctx, cameraX, canvasWidth) {
        const canvasHeight = ctx.canvas.height;

        // Layered backdrop: sky → distant silhouettes → ground line.
        this.drawSky(ctx, canvasWidth, canvasHeight);
        this.drawParallax(ctx, cameraX, canvasWidth, canvasHeight);

        // Foreground fill (subterranean area) — darker than near parallax so the ground reads as solid.
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        let fillStarted = false;
        for (const point of this.landscapePoints) {
            const screenX = point.x - cameraX;
            if (screenX >= -50 && screenX <= canvasWidth + 50) {
                if (!fillStarted) {
                    ctx.moveTo(screenX, point.groundY);
                    fillStarted = true;
                } else {
                    ctx.lineTo(screenX, point.groundY);
                }
            }
        }
        // Close down to bottom of canvas to form a solid foreground mass.
        ctx.lineTo(canvasWidth + 50, canvasHeight);
        ctx.lineTo(-50, canvasHeight);
        ctx.closePath();
        ctx.fill();

        // Ground line on top of the fill
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        for (const point of this.landscapePoints) {
            const screenX = point.x - cameraX;
            if (screenX >= -50 && screenX <= canvasWidth + 50) {
                if (!started) {
                    ctx.moveTo(screenX, point.groundY);
                    started = true;
                } else {
                    ctx.lineTo(screenX, point.groundY);
                }
            }
        }
        ctx.stroke();

        // Paper grain overlay — subtle, applied over the whole frame's background only.
        // (We draw it here before entities so it sits behind characters/vehicles.)
        this.drawGrain(ctx, canvasWidth, canvasHeight);
    }
}