// Corpse Editor - Advanced ragdoll physics tuning tool
// Press 'C' to toggle corpse editor mode

class CorpseEditor {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        
        // Editor camera for close inspection
        this.editorCameraX = 0;
        this.editorCameraY = 0;
        this.zoomLevel = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 5.0;
        
        // Corpse parameters
        this.corpseParams = {
            scale: 1.0,
            weight: 1.0,
            jointStiffness: 0.5, // 0 = fully ragdoll, 1 = very stiff
            damping: 0.8, // Joint damping factor
            bounce: 0.3, // Collision bounce
            friction: 0.7, // Ground friction
            limbLength: 1.0, // Limb proportion multiplier
            torsoSize: 1.0, // Torso size multiplier
        };
        
        // Test scenarios
        this.testScenarios = [
            { name: 'Simple Drop', type: 'drop', height: 100 },
            { name: 'High Fall', type: 'drop', height: 300 },
            { name: 'Tumble Test', type: 'tumble', spin: true },
            { name: 'Cliff Roll', type: 'cliff', complex: true },
            { name: 'Physics Stress', type: 'stress', extreme: true }
        ];
        
        // UI state
        this.selectedScenario = 0;
        this.showPhysicsDebug = true;
        this.showJointConnections = true;
        
        // Corpse backup for reset
        this.originalCorpseState = null;
        
        // Test terrain for corpse physics
        this.testTerrain = null;
        this.createTestTerrain();
        
        // Panel dimensions
        this.panelWidth = 280;
        this.panelHeight = 400;
        
        this.setupEventListeners();
    }
    
    handleKeyDown(e) {
        if (!this.isActive) return;
        
        switch (e.code) {
            case 'Digit1':
                this.runTestScenario(0);
                break;
            case 'Digit2':
                this.runTestScenario(1);
                break;
            case 'Digit3':
                this.runTestScenario(2);
                break;
            case 'Digit4':
                this.runTestScenario(3);
                break;
            case 'Digit5':
                this.runTestScenario(4);
                break;
            case 'KeyR':
                this.resetCorpse();
                break;
            case 'KeyF':
                this.autoFollowCorpse = !this.autoFollowCorpse;
                console.log(`📹 Auto-follow: ${this.autoFollowCorpse ? 'ON' : 'OFF'}`);
                break;
            case 'KeyV':
                this.showPhysicsDebug = !this.showPhysicsDebug;
                console.log(`🔍 Physics debug: ${this.showPhysicsDebug ? 'ON' : 'OFF'}`);
                break;
            case 'KeyB':
                this.showJointConnections = !this.showJointConnections;
                console.log(`🦴 Joint connections: ${this.showJointConnections ? 'ON' : 'OFF'}`);
                break;
            case 'Equal':
            case 'NumpadAdd':
                // Increase stiffness
                this.corpseParams.jointStiffness = Math.min(1.0, this.corpseParams.jointStiffness + 0.1);
                this.applyCorpseParameters();
                console.log(`🎛️ Stiffness: ${this.corpseParams.jointStiffness.toFixed(1)}`);
                break;
            case 'Minus':
            case 'NumpadSubtract':
                // Decrease stiffness
                this.corpseParams.jointStiffness = Math.max(0.0, this.corpseParams.jointStiffness - 0.1);
                this.applyCorpseParameters();
                console.log(`🎛️ Stiffness: ${this.corpseParams.jointStiffness.toFixed(1)}`);
                break;
        }
    }
    
    createTestTerrain() {
        // Create custom terrain for corpse testing
        this.testTerrain = [];
        
        // Flat area for drops
        for (let x = 0; x <= 500; x += 50) {
            this.testTerrain.push({ x: x, groundY: 400 });
        }
        
        // Cliff for tumbling
        for (let x = 500; x <= 700; x += 25) {
            const progress = (x - 500) / 200;
            this.testTerrain.push({ x: x, groundY: 400 + (progress * 200) });
        }
        
        // Bottom area
        for (let x = 700; x <= 1000; x += 50) {
            this.testTerrain.push({ x: x, groundY: 600 });
        }
        
        // Rolling hills for complex testing
        for (let x = 1000; x <= 1500; x += 25) {
            const hillY = 550 + Math.sin((x - 1000) * 0.01) * 50;
            this.testTerrain.push({ x: x, groundY: hillY });
        }
    }
    
    getTestGroundYAt(x) {
        // Find terrain height at x position in test terrain
        for (let i = 0; i < this.testTerrain.length - 1; i++) {
            const p1 = this.testTerrain[i];
            const p2 = this.testTerrain[i + 1];
            
            if (x >= p1.x && x <= p2.x) {
                const ratio = (x - p1.x) / (p2.x - p1.x);
                return p1.groundY + (p2.groundY - p1.groundY) * ratio;
            }
        }
        
        return this.testTerrain[0]?.groundY || 400;
    }
    
    setupEventListeners() {
        this.boundHandlers = {
            wheel: (e) => this.handleWheel(e),
            mouseMove: (e) => this.handleMouseMove(e),
            mouseDown: (e) => this.handleMouseDown(e),
            keyDown: (e) => this.handleKeyDown(e)
        };
    }
    
    toggle() {
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            // Close level editor if it's open
            if (this.game.levelEditor && this.game.levelEditor.isActive) {
                this.game.levelEditor.toggle();
            }
            
            console.log('🧟 Entering corpse editor mode');
            this.enterCorpseEditor();
        } else {
            console.log('🎮 Exiting corpse editor mode');
            this.exitCorpseEditor();
        }
    }
    
    enterCorpseEditor() {
        // Backup original corpse state
        this.backupCorpseState();
        
        // Set up test environment
        this.setupTestEnvironment();
        
        // Add event listeners for zoom and pan
        const canvas = this.game.canvas;
        canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
        canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
        document.addEventListener('keydown', this.boundHandlers.keyDown);
    }
    
    exitCorpseEditor() {
        // Remove event listeners
        const canvas = this.game.canvas;
        canvas.removeEventListener('wheel', this.boundHandlers.wheel);
        canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        
        // Restore original state if needed
        this.restoreCorpseState();
    }
    
    backupCorpseState() {
        const corpse = this.game.corpse;
        this.originalCorpseState = {
            x: corpse.x || 0,
            y: corpse.y || 0,
            scale: corpse.scale || 1,
            isActive: corpse.isActive || false
        };
        
        // Only backup joints if they exist
        if (corpse.joints && typeof corpse.joints === 'object') {
            try {
                this.originalCorpseState.joints = JSON.parse(JSON.stringify(corpse.joints));
            } catch (e) {
                console.warn('Could not backup joints:', e);
                this.originalCorpseState.joints = null;
            }
        }
    }
    
    restoreCorpseState() {
        if (this.originalCorpseState) {
            const corpse = this.game.corpse;
            corpse.x = this.originalCorpseState.x;
            corpse.y = this.originalCorpseState.y;
            corpse.scale = this.originalCorpseState.scale;
            // Don't restore joints as they may have been modified intentionally
        }
    }
    
    setupTestEnvironment() {
        // Position corpse in test area
        const corpse = this.game.corpse;
        
        // Ensure corpse is active and properly initialized
        corpse.isActive = true;
        corpse.isPickedUp = false;
        corpse.inCoffin = false;
        corpse.x = 250;
        corpse.y = 200;
        
        // Initialize body parts if they don't exist (corpse uses bodyParts, not joints)
        if (!corpse.bodyParts || Object.keys(corpse.bodyParts).length === 0) {
            console.log('🔧 Corpse has no body parts - creating basic structure...');
            this.initializeCorpseBodyParts(corpse);
        } else {
            console.log('🔧 Corpse body parts found:', Object.keys(corpse.bodyParts));
        }
        
        // Ensure corpse has a scale property
        if (corpse.scale === undefined) {
            corpse.scale = 1.0;
        }
        
        // Apply current parameters
        this.applyCorpseParameters();
        
        // Center camera on corpse
        this.editorCameraX = corpse.x - this.game.canvas.width / 2;
        this.editorCameraY = corpse.y - this.game.canvas.height / 2;
        this.zoomLevel = 2.0; // Start zoomed in
        
        console.log(`🧟 Corpse setup complete - Active: ${corpse.isActive}, Body Parts: ${Object.keys(corpse.bodyParts || {}).length}`);
    }
    
    applyCorpseParameters() {
        const corpse = this.game.corpse;
        
        // Apply scale (use setScale method if available, otherwise set directly)
        if (typeof corpse.setScale === 'function') {
            corpse.setScale(this.corpseParams.scale);
        } else {
            corpse.scale = this.corpseParams.scale;
        }
        
        // Apply physics parameters to body parts (if they exist)
        if (corpse.bodyParts && typeof corpse.bodyParts === 'object') {
            Object.values(corpse.bodyParts).forEach(part => {
                if (part && typeof part === 'object') {
                    part.damping = this.corpseParams.damping;
                    part.stiffness = this.corpseParams.jointStiffness;
                    part.bounce = this.corpseParams.bounce;
                    part.friction = this.corpseParams.friction;
                }
            });
        }
        
        console.log(`🔧 Applied corpse parameters:`, this.corpseParams);
    }
    
    handleWheel(e) {
        if (!this.isActive) return;
        e.preventDefault();
        
        // Zoom in/out
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomDelta));
        
        console.log(`🔍 Zoom: ${this.zoomLevel.toFixed(2)}x`);
    }
    
    handleMouseMove(e) {
        if (!this.isActive) return;
        // Mouse tracking for potential future features
    }
    
    handleMouseDown(e) {
        if (!this.isActive) return;
        
        const rect = this.game.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Check UI interactions
        this.checkUIInteraction(mouseX, mouseY);
    }
    
    checkUIInteraction(mouseX, mouseY) {
        // Check parameter sliders
        const panelX = 10;
        const panelY = 50;
        
        // Scenario buttons
        this.testScenarios.forEach((scenario, index) => {
            const buttonY = panelY + 30 + (index * 25);
            if (mouseX >= panelX && mouseX <= panelX + 100 && 
                mouseY >= buttonY && mouseY <= buttonY + 20) {
                this.runTestScenario(index);
            }
        });
        
        // Reset button
        if (mouseX >= panelX && mouseX <= panelX + 60 && 
            mouseY >= panelY + 200 && mouseY <= panelY + 220) {
            this.resetCorpse();
        }
        
        // Parameter sliders interaction
        this.checkParameterSliders(mouseX, mouseY);
    }
    
    checkParameterSliders(mouseX, mouseY) {
        const panelX = 10;
        const panelY = 320;
        
        const params = [
            { name: 'Scale', key: 'scale', min: 0.5, max: 3.0 },
            { name: 'Weight', key: 'weight', min: 0.1, max: 2.0 },
            { name: 'Stiffness', key: 'jointStiffness', min: 0.0, max: 1.0 },
            { name: 'Damping', key: 'damping', min: 0.1, max: 1.0 },
            { name: 'Bounce', key: 'bounce', min: 0.0, max: 1.0 }
        ];
        
        params.forEach((param, index) => {
            const sliderY = panelY + 35 + (index * 20);
            const sliderX = panelX + 120;
            const sliderWidth = 120;
            
            // Check if clicking on slider
            if (mouseX >= sliderX && mouseX <= sliderX + sliderWidth &&
                mouseY >= sliderY && mouseY <= sliderY + 8) {
                
                // Calculate new value based on click position
                const progress = (mouseX - sliderX) / sliderWidth;
                const newValue = param.min + (progress * (param.max - param.min));
                
                // Update parameter
                this.corpseParams[param.key] = Math.max(param.min, Math.min(param.max, newValue));
                
                // Apply changes immediately
                this.applyCorpseParameters();
                
                console.log(`🎛️ ${param.name}: ${this.corpseParams[param.key].toFixed(2)}`);
            }
        });
    }
    
    runTestScenario(scenarioIndex) {
        if (scenarioIndex < 0 || scenarioIndex >= this.testScenarios.length) return;
        
        const scenario = this.testScenarios[scenarioIndex];
        const corpse = this.game.corpse;
        
        console.log(`🧪 Running test: ${scenario.name}`);
        
        switch (scenario.type) {
            case 'drop':
                this.setupDropTest(scenario.height);
                break;
            case 'tumble':
                this.setupTumbleTest();
                break;
            case 'cliff':
                this.setupCliffTest();
                break;
            case 'stress':
                this.setupStressTest();
                break;
        }
    }
    
    setupDropTest(height) {
        const corpse = this.game.corpse;
        corpse.x = 250;
        corpse.y = this.getTestGroundYAt(250) - height;
        
        // Zero out velocities for clean drop
        Object.values(corpse.joints).forEach(joint => {
            joint.velocityX = 0;
            joint.velocityY = 0;
        });
        
        this.centerCameraOnCorpse();
    }
    
    setupTumbleTest() {
        const corpse = this.game.corpse;
        corpse.x = 450;
        corpse.y = this.getTestGroundYAt(450) - 50;
        
        // Add some initial spin
        Object.values(corpse.joints).forEach((joint, index) => {
            joint.velocityX = 2 + Math.random();
            joint.velocityY = Math.random() - 0.5;
        });
        
        this.centerCameraOnCorpse();
    }
    
    setupCliffTest() {
        const corpse = this.game.corpse;
        corpse.x = 500;
        corpse.y = this.getTestGroundYAt(500) - 20;
        
        // Push towards cliff
        Object.values(corpse.joints).forEach(joint => {
            joint.velocityX = 3;
            joint.velocityY = -1;
        });
        
        this.centerCameraOnCorpse();
    }
    
    setupStressTest() {
        const corpse = this.game.corpse;
        corpse.x = 200;
        corpse.y = 100; // High drop
        
        // Extreme forces for stress testing
        Object.values(corpse.joints).forEach(joint => {
            joint.velocityX = (Math.random() - 0.5) * 10;
            joint.velocityY = Math.random() * 5;
        });
        
        this.centerCameraOnCorpse();
    }
    
    resetCorpse() {
        const corpse = this.game.corpse;
        
        // Ensure corpse is active
        corpse.isActive = true;
        corpse.x = 250;
        corpse.y = 200;
        
        // Reset all body part velocities (if body parts exist)
        if (corpse.bodyParts && typeof corpse.bodyParts === 'object') {
            Object.values(corpse.bodyParts).forEach(part => {
                if (part && typeof part === 'object') {
                    part.vx = 0;
                    part.vy = 0;
                    part.angularVel = 0;
                }
            });
        }
        
        // Reset body part positions relative to corpse center
        this.resetBodyPartPositions(corpse);
        
        this.centerCameraOnCorpse();
        console.log('🔄 Corpse reset');
    }
    
    centerCameraOnCorpse() {
        const corpse = this.game.corpse;
        this.editorCameraX = corpse.x - this.game.canvas.width / 2;
        this.editorCameraY = corpse.y - this.game.canvas.height / 2;
    }
    
    update() {
        if (!this.isActive) return;
        
        // Update corpse physics using test terrain
        if (this.game.corpse.isActive) {
            this.updateCorpsePhysicsWithTestTerrain();
        }
        
        // Auto-follow corpse option
        if (this.autoFollowCorpse) {
            this.centerCameraOnCorpse();
        }
    }
    
    updateCorpsePhysicsWithTestTerrain() {
        const corpse = this.game.corpse;
        
        if (!corpse.bodyParts) return;
        
        // Update each body part with test terrain
        Object.values(corpse.bodyParts).forEach(part => {
            if (!part || typeof part !== 'object') return;
            
            // Apply gravity
            part.vy += 0.5; // Gravity
            
            // Update position
            part.x += part.vx;
            part.y += part.vy;
            
            // Check collision with test terrain
            const groundY = this.getTestGroundYAt(part.x);
            
            if (part.y > groundY) {
                part.y = groundY;
                part.vy *= -(this.corpseParams.bounce || 0.3);
                part.vx *= (this.corpseParams.friction || 0.7);
                
                // Apply minimum velocity threshold
                if (Math.abs(part.vy) < 0.1) part.vy = 0;
                if (Math.abs(part.vx) < 0.05) part.vx = 0;
            }
            
            // Apply damping
            part.vx *= (this.corpseParams.damping || 0.95);
            part.vy *= (this.corpseParams.damping || 0.95);
        });
        
        // Update corpse center position based on torso (or average of parts)
        if (corpse.bodyParts.torso) {
            corpse.x = corpse.bodyParts.torso.x;
            corpse.y = corpse.bodyParts.torso.y;
        } else {
            const parts = Object.values(corpse.bodyParts);
            if (parts.length > 0) {
                corpse.x = parts.reduce((sum, part) => sum + part.x, 0) / parts.length;
                corpse.y = parts.reduce((sum, part) => sum + part.y, 0) / parts.length;
            }
        }
    }
    
    draw(ctx, cameraX) {
        if (!this.isActive) return;
        
        // Use editor camera instead of game camera
        const editorCameraX = this.editorCameraX;
        
        // Draw test terrain
        this.drawTestTerrain(ctx, editorCameraX);
        
        // Draw corpse with zoom
        this.drawCorpseWithZoom(ctx, editorCameraX);
        
        // Draw physics debug info
        if (this.showPhysicsDebug) {
            this.drawPhysicsDebug(ctx, editorCameraX);
        }
        
        // Draw UI panels
        this.drawUI(ctx);
    }
    
    drawTestTerrain(ctx, cameraX) {
        ctx.save();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        let started = false;
        
        for (const point of this.testTerrain) {
            const screenX = (point.x - cameraX) * this.zoomLevel + this.game.canvas.width / 2;
            const screenY = point.groundY * this.zoomLevel - this.editorCameraY;
            
            if (screenX >= -50 && screenX <= this.game.canvas.width + 50) {
                if (!started) {
                    ctx.moveTo(screenX, screenY);
                    started = true;
                } else {
                    ctx.lineTo(screenX, screenY);
                }
            }
        }
        
        ctx.stroke();
        ctx.restore();
    }
    
    drawCorpseWithZoom(ctx, cameraX) {
        if (!this.game.corpse.isActive) return;
        
        ctx.save();
        
        // Apply zoom transformation
        const corpse = this.game.corpse;
        const centerX = this.game.canvas.width / 2;
        const centerY = this.game.canvas.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.scale(this.zoomLevel, this.zoomLevel);
        ctx.translate(-centerX, -centerY);
        
        // Draw corpse with custom camera offset (check if draw method exists)
        try {
            if (typeof this.game.corpse.draw === 'function') {
                this.game.corpse.draw(ctx, this.editorCameraX, this.game.player, this.game.coffin);
            } else {
                this.drawCorpseFallback(ctx, corpse);
            }
        } catch (error) {
            console.warn('Error drawing corpse, using fallback:', error);
            this.drawCorpseFallback(ctx, corpse);
        }
        
        ctx.restore();
    }
    
    drawPhysicsDebug(ctx, cameraX) {
        if (!this.game.corpse.isActive) return;
        
        const corpse = this.game.corpse;
        
        // Skip if no body parts
        if (!corpse.bodyParts || typeof corpse.bodyParts !== 'object') return;
        
        ctx.save();
        
        // Apply zoom for debug info
        const centerX = this.game.canvas.width / 2;
        const centerY = this.game.canvas.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.scale(this.zoomLevel, this.zoomLevel);
        ctx.translate(-centerX, -centerY);
        
        // Draw constraint connections (if available)
        if (this.showJointConnections && corpse.constraints) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            
            corpse.constraints.forEach(constraint => {
                const partA = corpse.bodyParts[constraint.partA];
                const partB = corpse.bodyParts[constraint.partB];
                
                if (partA && partB && 
                    typeof partA.x === 'number' && typeof partA.y === 'number' &&
                    typeof partB.x === 'number' && typeof partB.y === 'number') {
                    
                    const x1 = partA.x - this.editorCameraX;
                    const y1 = partA.y - this.editorCameraY;
                    const x2 = partB.x - this.editorCameraX;
                    const y2 = partB.y - this.editorCameraY;
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            });
        }
        
        // Draw body part velocity vectors
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        
        Object.values(corpse.bodyParts).forEach(part => {
            if (part && typeof part === 'object' && 
                typeof part.x === 'number' && typeof part.y === 'number' &&
                typeof part.vx === 'number' && typeof part.vy === 'number') {
                
                const screenX = part.x - this.editorCameraX;
                const screenY = part.y - this.editorCameraY;
                
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX + part.vx * 5, screenY + part.vy * 5);
                ctx.stroke();
            }
        });
        
        ctx.restore();
    }
    
    drawUI(ctx) {
        // Main control panel
        this.drawControlPanel(ctx);
        
        // Parameter sliders
        this.drawParameterSliders(ctx);
        
        // Info panel
        this.drawInfoPanel(ctx);
        
        // Editor overlay indicator
        ctx.save();
        ctx.fillStyle = 'rgba(100, 0, 100, 0.1)';
        ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        
        // Mode indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 220, 30);
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🧟 CORPSE EDITOR', 15, 30);
        
        ctx.restore();
    }
    
    drawControlPanel(ctx) {
        const panelX = 10;
        const panelY = 50;
        
        ctx.save();
        
        // Panel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(panelX, panelY, this.panelWidth, this.panelHeight);
        
        // Title
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('TEST SCENARIOS', panelX + 10, panelY + 20);
        
        // Scenario buttons
        this.testScenarios.forEach((scenario, index) => {
            const buttonY = panelY + 30 + (index * 25);
            const isSelected = index === this.selectedScenario;
            
            // Button background
            ctx.fillStyle = isSelected ? 'rgba(255, 0, 255, 0.3)' : 'rgba(100, 100, 100, 0.3)';
            ctx.fillRect(panelX + 10, buttonY, 120, 20);
            
            // Button text
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText(scenario.name, panelX + 15, buttonY + 14);
        });
        
        // Reset button
        ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.fillRect(panelX + 10, panelY + 200, 60, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('RESET', panelX + 25, panelY + 214);
        
        // Zoom controls
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`Zoom: ${this.zoomLevel.toFixed(1)}x`, panelX + 10, panelY + 240);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Mouse wheel to zoom', panelX + 10, panelY + 255);
        
        ctx.restore();
    }
    
    drawParameterSliders(ctx) {
        const panelX = 10;
        const panelY = 320;
        
        ctx.save();
        
        // Parameters panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(panelX, panelY, this.panelWidth, 150);
        
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('CORPSE PARAMETERS', panelX + 10, panelY + 20);
        
        const params = [
            { name: 'Scale', key: 'scale', min: 0.5, max: 3.0 },
            { name: 'Weight', key: 'weight', min: 0.1, max: 2.0 },
            { name: 'Stiffness', key: 'jointStiffness', min: 0.0, max: 1.0 },
            { name: 'Damping', key: 'damping', min: 0.1, max: 1.0 },
            { name: 'Bounce', key: 'bounce', min: 0.0, max: 1.0 }
        ];
        
        params.forEach((param, index) => {
            const y = panelY + 35 + (index * 20);
            const value = this.corpseParams[param.key];
            const progress = (value - param.min) / (param.max - param.min);
            
            // Parameter name
            ctx.fillStyle = '#fff';
            ctx.font = '11px Arial';
            ctx.fillText(`${param.name}: ${value.toFixed(2)}`, panelX + 10, y + 8);
            
            // Slider track
            ctx.fillStyle = '#333';
            ctx.fillRect(panelX + 120, y, 120, 8);
            
            // Slider fill
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(panelX + 120, y, progress * 120, 8);
        });
        
        ctx.restore();
    }
    
    drawInfoPanel(ctx) {
        const panelX = this.game.canvas.width - 200;
        const panelY = 50;
        
        ctx.save();
        
        // Info panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(panelX, panelY, 180, 120);
        
        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('PHYSICS INFO', panelX + 10, panelY + 20);
        
        if (this.game.corpse.isActive) {
            const corpse = this.game.corpse;
            
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            
            let totalVelocity = 0;
            let partCount = 0;
            
            if (corpse.bodyParts) {
                Object.values(corpse.bodyParts).forEach(part => {
                    if (part && typeof part.vx === 'number' && typeof part.vy === 'number') {
                        totalVelocity += Math.sqrt(part.vx ** 2 + part.vy ** 2);
                        partCount++;
                    }
                });
            }
            
            const avgVelocity = partCount > 0 ? totalVelocity / partCount : 0;
            
            ctx.fillText(`Position: ${Math.round(corpse.x)}, ${Math.round(corpse.y)}`, panelX + 10, panelY + 40);
            ctx.fillText(`Avg Velocity: ${avgVelocity.toFixed(2)}`, panelX + 10, panelY + 55);
            ctx.fillText(`Body Parts: ${Object.keys(corpse.bodyParts || {}).length}`, panelX + 10, panelY + 70);
            ctx.fillText(`Scale: ${corpse.scale.toFixed(2)}`, panelX + 10, panelY + 85);
        }
        
        ctx.fillStyle = '#ccc';
        ctx.font = '9px Arial';
        ctx.fillText('Shortcuts:', panelX + 10, panelY + 105);
        ctx.fillText('1-5: Test scenarios', panelX + 10, panelY + 115);
        ctx.fillText('R: Reset | F: Follow', panelX + 10, panelY + 125);
        ctx.fillText('V: Debug | +/-: Stiffness', panelX + 10, panelY + 135);
        ctx.fillText('C: Exit Editor', panelX + 10, panelY + 145);
        
        ctx.restore();
    }
    
    initializeCorpseBodyParts(corpse) {
        // Create basic body parts if they don't exist
        const x = corpse.x || 250;
        const y = corpse.y || 200;
        
        corpse.bodyParts = {
            torso: {
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                width: 10,
                height: 25,
                mass: 3.0,
                angle: 0,
                angularVel: 0
            },
            head: {
                x: x,
                y: y - 15,
                vx: 0,
                vy: 0,
                radius: 5,
                mass: 2.0,
                angle: 0,
                angularVel: 0
            },
            leftArm: {
                x: x - 8,
                y: y - 5,
                vx: 0,
                vy: 0,
                length: 8,
                mass: 1.0,
                angle: 0,
                angularVel: 0
            },
            rightArm: {
                x: x + 8,
                y: y - 5,
                vx: 0,
                vy: 0,
                length: 8,
                mass: 1.0,
                angle: 0,
                angularVel: 0
            },
            leftLeg: {
                x: x - 3,
                y: y + 15,
                vx: 0,
                vy: 0,
                length: 12,
                mass: 1.5,
                angle: 0,
                angularVel: 0
            },
            rightLeg: {
                x: x + 3,
                y: y + 15,
                vx: 0,
                vy: 0,
                length: 12,
                mass: 1.5,
                angle: 0,
                angularVel: 0
            }
        };
        
        // Create basic constraints
        corpse.constraints = [
            { partA: 'torso', partB: 'head', length: 15, strength: 1.0 },
            { partA: 'torso', partB: 'leftArm', length: 8, strength: 0.8 },
            { partA: 'torso', partB: 'rightArm', length: 8, strength: 0.8 },
            { partA: 'torso', partB: 'leftLeg', length: 15, strength: 0.8 },
            { partA: 'torso', partB: 'rightLeg', length: 15, strength: 0.8 }
        ];
        
        console.log('✅ Created basic corpse body parts');
    }
    
    resetBodyPartPositions(corpse) {
        if (!corpse.bodyParts) return;
        
        const centerX = corpse.x;
        const centerY = corpse.y;
        
        // Reset parts to default relative positions
        if (corpse.bodyParts.torso) {
            corpse.bodyParts.torso.x = centerX;
            corpse.bodyParts.torso.y = centerY;
        }
        if (corpse.bodyParts.head) {
            corpse.bodyParts.head.x = centerX;
            corpse.bodyParts.head.y = centerY - 15;
        }
        if (corpse.bodyParts.leftArm) {
            corpse.bodyParts.leftArm.x = centerX - 8;
            corpse.bodyParts.leftArm.y = centerY - 5;
        }
        if (corpse.bodyParts.rightArm) {
            corpse.bodyParts.rightArm.x = centerX + 8;
            corpse.bodyParts.rightArm.y = centerY - 5;
        }
        if (corpse.bodyParts.leftLeg) {
            corpse.bodyParts.leftLeg.x = centerX - 3;
            corpse.bodyParts.leftLeg.y = centerY + 15;
        }
        if (corpse.bodyParts.rightLeg) {
            corpse.bodyParts.rightLeg.x = centerX + 3;
            corpse.bodyParts.rightLeg.y = centerY + 15;
        }
    }
    
    drawCorpseFallback(ctx, corpse) {
        // Simple fallback drawing if main corpse.draw() fails
        const screenX = corpse.x - this.editorCameraX;
        const screenY = corpse.y;
        
        if (corpse.bodyParts) {
            // Draw body parts as simple shapes
            Object.entries(corpse.bodyParts).forEach(([partName, part]) => {
                if (!part || typeof part.x !== 'number' || typeof part.y !== 'number') return;
                
                const partScreenX = part.x - this.editorCameraX;
                const partScreenY = part.y;
                
                ctx.fillStyle = '#000';
                
                if (partName === 'head' && part.radius) {
                    // Draw head as circle
                    ctx.beginPath();
                    ctx.arc(partScreenX, partScreenY, part.radius, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Draw other parts as rectangles
                    const width = part.width || part.length || 8;
                    const height = part.height || part.length || 8;
                    ctx.fillRect(partScreenX - width/2, partScreenY - height/2, width, height);
                }
                
                // Label parts
                ctx.fillStyle = '#fff';
                ctx.font = '8px Arial';
                ctx.fillText(partName.substr(0, 3), partScreenX - 8, partScreenY - 10);
            });
        } else {
            // Ultra-simple fallback
            ctx.fillStyle = '#000';
            ctx.fillRect(screenX, screenY, 20, 50);
            
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText('CORPSE', screenX, screenY - 10);
        }
    }
}