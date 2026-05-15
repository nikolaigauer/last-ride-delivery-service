// Level Editor for Last Ride Delivery Service
// Toggleable with 'E' key - create and edit levels visually

class LevelEditor {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.selectedTool = 'select'; // select, place, terrain, delete
        this.selectedSprite = null;
        this.selectedObject = null;
        
        // Sprite library - available objects to place
        this.spriteLibrary = [
            { type: 'phone', name: 'Phone Booth', asset: 'assets/phone.png', width: 60, height: 80, properties: { message: 'Mission briefing...', nextLevel: null } },
            { type: 'hospital', name: 'Hospital', asset: 'assets/hospital.png', width: 120, height: 80, properties: { spawnsCargo: true } },
            { type: 'church', name: 'Church', asset: 'assets/church.png', width: 120, height: 80, properties: { isDestination: true } },
            { type: 'pothole1', name: 'Pothole 1', asset: 'assets/pothole1.png', width: 40, height: 20, properties: { severity: 1, bumpValue: 1, imageIndex: 0 } },
            { type: 'pothole2', name: 'Pothole 2', asset: 'assets/pothole2.png', width: 45, height: 22, properties: { severity: 2, bumpValue: 2, imageIndex: 1 } },
            { type: 'pothole3', name: 'Pothole 3', asset: 'assets/pothole3.png', width: 50, height: 25, properties: { severity: 3, bumpValue: 3, imageIndex: 2 } },
            { type: 'pothole4', name: 'Pothole 4', asset: 'assets/pothole4.png', width: 55, height: 28, properties: { severity: 4, bumpValue: 4, imageIndex: 3 } },
            { type: 'hearse', name: 'Hearse', asset: 'assets/hearse.png', width: 120, height: 60, properties: { isPlayerVehicle: true } },
            { type: 'coffin', name: 'Coffin', asset: 'assets/closed-coffin.png', width: 80, height: 40, properties: { health: 100 } }
        ];
        
        // Load sprite images
        this.spriteImages = {};
        this.loadSpriteAssets();
        
        // UI state
        this.showSpriteLibrary = true;
        this.showPropertyPanel = false;
        this.showTerrainTools = true;
        
        // Terrain drawing
        this.isDrawingTerrain = false;
        this.terrainBrushSize = 50;
        this.terrainHeight = 100;
        
        // Current level data
        this.currentLevel = this.createEmptyLevel();
        
        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        this.isDragging = false;
        
        // Transform state
        this.isTransforming = false;
        this.transformHandle = null; // 'tl', 'tr', 'bl', 'br', 'center'
        this.transformStartPos = { x: 0, y: 0 };
        this.transformStartSize = { width: 0, height: 0 };
        this.transformStartMouse = { x: 0, y: 0 };
        
        // Editor camera (independent of game camera)
        this.editorCameraX = 0;
        this.editorCameraSpeed = 10;
        
        this.setupEventListeners();
    }
    
    loadSpriteAssets() {
        this.spriteLibrary.forEach(sprite => {
            const img = new Image();
            img.onload = () => {
                console.log(`📷 Loaded sprite: ${sprite.name}`);
            };
            img.src = sprite.asset;
            this.spriteImages[sprite.type] = img;
        });
    }
    
    createEmptyLevel() {
        return {
            id: 'custom_level',
            name: 'Custom Level',
            version: '1.0',
            terrain: {
                type: 'custom',
                points: [], // Will be generated from current terrain
                width: 50000
            },
            objects: [],
            spawn: { x: 300, y: 320 },
            hearseSpawn: { x: 100, y: 280 },
            music: null,
            nextLevel: null,
            description: 'A custom level created in the editor'
        };
    }
    
    setupEventListeners() {
        // We'll handle these in the game's input system
        // But store references for later cleanup if needed
        this.boundHandlers = {
            mouseMove: (e) => this.handleMouseMove(e),
            mouseDown: (e) => this.handleMouseDown(e),
            mouseUp: (e) => this.handleMouseUp(e),
            keyDown: (e) => this.handleKeyDown(e)
        };
    }
    
    toggle() {
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            // Close corpse editor if it's open
            if (this.game.corpseEditor && this.game.corpseEditor.isActive) {
                this.game.corpseEditor.toggle();
            }
            
            // Entering editor mode
            console.log('🎨 Entering level editor mode');
            this.saveCurrentGameState();
            this.loadCurrentLevelData();
            
            // Add event listeners
            const canvas = this.game.canvas;
            canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
            canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
            canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
            document.addEventListener('keydown', this.boundHandlers.keyDown);
        } else {
            // Exiting editor mode  
            console.log('🎮 Exiting level editor mode');
            this.removeEventListeners();
        }
    }
    
    removeEventListeners() {
        const canvas = this.game.canvas;
        canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
    }
    
    saveCurrentGameState() {
        // Capture current terrain and object positions
        this.currentLevel.terrain.points = this.extractTerrainPoints();
        this.currentLevel.objects = this.extractGameObjects();
        this.currentLevel.spawn = { x: this.game.player.x, y: this.game.player.y };
        this.currentLevel.hearseSpawn = { x: this.game.hearse.x, y: this.game.hearse.y };
        this.currentLevel.terrain.width = this.game.terrain.worldWidth;
    }
    
    loadCurrentLevelData() {
        // Convert current game state into editable level data
        console.log('📋 Loading current level data for editing');
    }
    
    extractTerrainPoints() {
        // Extract terrain points from current terrain system
        const points = [];
        const terrain = this.game.terrain;
        
        // Sample terrain at regular intervals
        for (let x = 0; x < terrain.worldWidth; x += 100) {
            const y = terrain.getGroundYAt(x);
            points.push({ x, y });
        }
        
        return points;
    }
    
    extractGameObjects() {
        const objects = [];
        
        // Extract existing game objects
        if (this.game.phoneBooth) {
            objects.push({
                id: 'phone_booth_main',
                type: 'phone',
                x: this.game.phoneBooth.x,
                y: this.game.phoneBooth.y,
                width: 60,
                height: 80,
                gameObjectRef: this.game.phoneBooth,
                properties: { message: 'Default mission briefing', nextLevel: null }
            });
        }
        
        if (this.game.hospital) {
            objects.push({
                id: 'hospital_main',
                type: 'hospital',
                x: this.game.hospital.x,
                y: this.game.hospital.y,
                width: 120,
                height: 80,
                gameObjectRef: this.game.hospital,
                properties: { spawnsCargo: true }
            });
        }
        
        if (this.game.church) {
            objects.push({
                id: 'church_main',
                type: 'church',
                x: this.game.church.x,
                y: this.game.church.y,
                width: 120,
                height: 80,
                gameObjectRef: this.game.church,
                properties: { isDestination: true }
            });
        }
        
        if (this.game.deliveryBooth) {
            objects.push({
                id: 'phone_booth_delivery',
                type: 'phone',
                x: this.game.deliveryBooth.x,
                y: this.game.deliveryBooth.y,
                width: 60,
                height: 80,
                gameObjectRef: this.game.deliveryBooth,
                properties: { message: 'Mission complete!', nextLevel: null }
            });
        }
        
        if (this.game.hearse) {
            objects.push({
                id: 'hearse_main',
                type: 'hearse',
                x: this.game.hearse.x,
                y: this.game.hearse.y,
                width: 120,
                height: 60,
                gameObjectRef: this.game.hearse,
                properties: { isPlayerVehicle: true }
            });
        }
        
        // Extract potholes from pothole manager
        if (this.game.potholeManager && this.game.potholeManager.potholes) {
            this.game.potholeManager.potholes.forEach((pothole, index) => {
                objects.push({
                    id: `pothole_${index}`,
                    type: 'pothole',
                    x: pothole.x,
                    y: pothole.y,
                    width: pothole.width || 40,
                    height: pothole.height || 20,
                    gameObjectRef: pothole,
                    properties: { 
                        severity: pothole.severity || 1, 
                        bumpValue: pothole.bumpValue || 1,
                        imageIndex: pothole.imageIndex || 0
                    }
                });
            });
        }
        
        return objects;
    }
    
    handleMouseMove(e) {
        if (!this.isActive) return;
        
        const rect = this.game.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        
        // Convert to world coordinates
        this.mouseWorldX = this.mouseX + this.game.cameraX;
        this.mouseWorldY = this.mouseY;
        
        // Handle terrain drawing
        if (this.selectedTool === 'terrain' && this.isDrawingTerrain) {
            this.drawTerrainAt(this.mouseWorldX, this.mouseWorldY);
        }
        
        // Handle object transforming
        if (this.isTransforming && this.selectedObject) {
            this.updateTransform();
        } else if (this.isDragging && this.selectedObject) {
            // Handle object dragging
            this.selectedObject.x = this.mouseWorldX;
            this.selectedObject.y = this.mouseWorldY;
            
            // Update the actual game object if it has a reference
            if (this.selectedObject.gameObjectRef) {
                this.selectedObject.gameObjectRef.x = this.mouseWorldX;
                this.selectedObject.gameObjectRef.y = this.mouseWorldY;
            }
        }
    }
    
    handleMouseDown(e) {
        if (!this.isActive) return;
        e.preventDefault();
        
        // Check if clicking on sprite library
        if (this.checkSpriteLibraryClick(this.mouseX, this.mouseY)) {
            return;
        }
        
        // Check if clicking on navigation slider
        if (this.checkNavigationSliderClick(this.mouseX, this.mouseY, e)) {
            return;
        }
        
        // Check if clicking on transform handles first
        if (this.selectedObject && this.selectedTool === 'select') {
            const handle = this.getTransformHandleAt(this.mouseWorldX, this.mouseY);
            if (handle) {
                this.startTransform(handle);
                return;
            }
        }
        
        switch (this.selectedTool) {
            case 'select':
                this.selectObjectAt(this.mouseWorldX, this.mouseWorldY);
                break;
            case 'place':
                if (this.selectedSprite) {
                    this.placeSprite(this.selectedSprite, this.mouseWorldX, this.mouseWorldY);
                }
                break;
            case 'terrain':
                this.isDrawingTerrain = true;
                this.drawTerrainAt(this.mouseWorldX, this.mouseWorldY);
                break;
            case 'delete':
                this.deleteObjectAt(this.mouseWorldX, this.mouseWorldY);
                break;
        }
    }
    
    handleMouseUp(e) {
        if (!this.isActive) return;
        
        this.isDrawingTerrain = false;
        this.isDragging = false;
        this.isTransforming = false;
        this.transformHandle = null;
    }
    
    handleKeyDown(e) {
        if (!this.isActive) return;
        
        switch (e.code) {
            case 'KeyQ':
                this.selectedTool = 'select';
                break;
            case 'KeyW':
                this.selectedTool = 'place';
                break;
            case 'KeyT':
                this.selectedTool = 'terrain';
                break;
            case 'KeyR':
                this.selectedTool = 'delete';
                break;
            case 'BracketLeft':
                // Decrease brush size
                this.terrainBrushSize = Math.max(10, this.terrainBrushSize - 10);
                console.log(`🖌️ Brush size: ${this.terrainBrushSize}`);
                break;
            case 'BracketRight':
                // Increase brush size
                this.terrainBrushSize = Math.min(200, this.terrainBrushSize + 10);
                console.log(`🖌️ Brush size: ${this.terrainBrushSize}`);
                break;
            case 'KeyA':
                if (this.selectedTool === 'terrain') {
                    // Add terrain point
                    this.addTerrainPoint(this.mouseWorldX, this.mouseWorldY);
                }
                break;
            case 'KeyS':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.saveLevel();
                }
                break;
            case 'KeyL':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.showLoadDialog();
                }
                break;
            case 'ArrowLeft':
                this.game.cameraX = Math.max(0, this.game.cameraX - this.editorCameraSpeed);
                break;
            case 'ArrowRight':
                this.game.cameraX = Math.min(50000 - this.game.canvas.width, this.game.cameraX + this.editorCameraSpeed);
                break;
        }
    }
    
    selectObjectAt(x, y) {
        // Find closest object to click position
        let closest = null;
        let minDistance = 100; // Max selection distance
        
        for (const obj of this.currentLevel.objects) {
            const distance = Math.sqrt((obj.x - x) ** 2 + (obj.y - y) ** 2);
            if (distance < minDistance) {
                closest = obj;
                minDistance = distance;
            }
        }
        
        this.selectedObject = closest;
        this.showPropertyPanel = !!closest;
        
        if (closest) {
            this.isDragging = true;
            console.log(`📍 Selected ${closest.type} at (${closest.x}, ${closest.y})`);
        }
    }
    
    placeSprite(spriteType, x, y) {
        const groundY = this.game.terrain.getGroundYAt(x);
        const placeY = groundY - spriteType.height;
        
        const newObject = {
            id: `${spriteType.type}_${Date.now()}`,
            type: spriteType.type,
            x: x,
            y: placeY,
            width: spriteType.width,
            height: spriteType.height,
            properties: { ...spriteType.properties } // Copy default properties
        };
        
        this.currentLevel.objects.push(newObject);
        console.log(`➕ Placed ${spriteType.name} at (${x}, ${placeY})`);
        
        // If placing a pothole, add it to the pothole manager
        if (spriteType.type.startsWith('pothole')) {
            const newPothole = {
                x: x,
                y: placeY,
                width: spriteType.width,
                height: spriteType.height,
                severity: spriteType.properties.severity,
                bumpValue: spriteType.properties.bumpValue,
                imageIndex: 0
            };
            this.game.potholeManager.potholes.push(newPothole);
            newObject.gameObjectRef = newPothole;
        }
    }
    
    deleteObjectAt(x, y) {
        const index = this.currentLevel.objects.findIndex(obj => {
            const distance = Math.sqrt((obj.x - x) ** 2 + (obj.y - y) ** 2);
            return distance < 50;
        });
        
        if (index !== -1) {
            const deleted = this.currentLevel.objects.splice(index, 1)[0];
            console.log(`🗑️ Deleted ${deleted.type}`);
            
            // If it's a pothole, remove from pothole manager
            if (deleted.type === 'pothole' && deleted.gameObjectRef) {
                const potholeIndex = this.game.potholeManager.potholes.indexOf(deleted.gameObjectRef);
                if (potholeIndex !== -1) {
                    this.game.potholeManager.potholes.splice(potholeIndex, 1);
                }
            }
            
            // Note: We don't delete core game objects like hearse, just reset their position
            if (deleted.gameObjectRef && ['hearse', 'phone', 'hospital', 'church'].includes(deleted.type)) {
                console.log(`⚠️ Cannot delete core object ${deleted.type}, use move tool instead`);
                this.currentLevel.objects.splice(index, 0, deleted); // Put it back
                return;
            }
            
            if (this.selectedObject === deleted) {
                this.selectedObject = null;
                this.showPropertyPanel = false;
            }
        }
    }
    
    drawTerrainAt(x, y) {
        // Modify terrain at this point by updating landscape points
        console.log(`🖌️ Drawing terrain at (${x}, ${y})`);
        
        const brushRadius = this.terrainBrushSize;
        const targetHeight = y;
        
        // Find and modify nearby terrain points
        this.game.terrain.landscapePoints.forEach(point => {
            const distance = Math.abs(point.x - x);
            
            if (distance <= brushRadius) {
                // Calculate influence based on distance (falloff)
                const influence = 1 - (distance / brushRadius);
                const heightChange = (targetHeight - point.groundY) * influence * 0.3; // 0.3 = brush strength
                
                point.groundY += heightChange;
                
                // Clamp terrain height to reasonable bounds
                point.groundY = Math.max(200, Math.min(450, point.groundY));
            }
        });
    }
    
    getTerrainPointAt(x) {
        // Find closest terrain point to the given x coordinate
        let closest = null;
        let minDistance = Infinity;
        
        this.game.terrain.landscapePoints.forEach(point => {
            const distance = Math.abs(point.x - x);
            if (distance < minDistance) {
                minDistance = distance;
                closest = point;
            }
        });
        
        return closest;
    }
    
    addTerrainPoint(x, y) {
        // Add a new terrain point at the specified position
        const newPoint = { x: x, groundY: y };
        
        // Find the correct insertion position to keep points sorted by x
        let insertIndex = 0;
        for (let i = 0; i < this.game.terrain.landscapePoints.length; i++) {
            if (this.game.terrain.landscapePoints[i].x > x) {
                break;
            }
            insertIndex = i + 1;
        }
        
        this.game.terrain.landscapePoints.splice(insertIndex, 0, newPoint);
        console.log(`➕ Added terrain point at (${x}, ${y})`);
        return newPoint;
    }
    
    deleteTerrainPoint(x) {
        // Remove terrain point near the given x coordinate
        const index = this.game.terrain.landscapePoints.findIndex(point => 
            Math.abs(point.x - x) < 50
        );
        
        if (index !== -1 && this.game.terrain.landscapePoints.length > 2) {
            const deleted = this.game.terrain.landscapePoints.splice(index, 1)[0];
            console.log(`🗑️ Deleted terrain point at (${deleted.x}, ${deleted.groundY})`);
            return deleted;
        }
        
        return null;
    }
    
    checkSpriteLibraryClick(x, y) {
        if (!this.showSpriteLibrary) return false;
        
        const libraryX = this.game.canvas.width - 200;
        const libraryY = 50;
        const libraryWidth = 180;
        
        // Check if click is within sprite library bounds
        if (x >= libraryX && x <= libraryX + libraryWidth && y >= libraryY && y <= libraryY + 300) {
            // Calculate which sprite was clicked (updated for 40px spacing)
            const spriteIndex = Math.floor((y - libraryY - 40) / 40);
            
            if (spriteIndex >= 0 && spriteIndex < this.spriteLibrary.length) {
                this.selectedSprite = this.spriteLibrary[spriteIndex];
                this.selectedTool = 'place'; // Auto-switch to place tool
                console.log(`🎨 Selected sprite: ${this.selectedSprite.name}`);
            }
            return true;
        }
        
        return false;
    }
    
    checkNavigationSliderClick(x, y, e) {
        const sliderY = this.game.canvas.height - 40;
        const sliderX = 50;
        const sliderWidth = this.game.canvas.width - 100;
        const sliderHeight = 20;
        
        if (x >= sliderX && x <= sliderX + sliderWidth && 
            y >= sliderY && y <= sliderY + sliderHeight) {
            
            if (e.shiftKey) {
                // Shift+click to set level length
                this.setLevelLength(x, sliderX, sliderWidth);
            } else {
                // Regular click to jump to position
                this.jumpToPosition(x, sliderX, sliderWidth);
            }
            return true;
        }
        
        return false;
    }
    
    jumpToPosition(clickX, sliderX, sliderWidth) {
        const progress = (clickX - sliderX) / sliderWidth;
        const worldWidth = this.game.terrain.worldWidth;
        const targetCameraX = progress * (worldWidth - this.game.canvas.width);
        
        this.game.cameraX = Math.max(0, Math.min(worldWidth - this.game.canvas.width, targetCameraX));
        console.log(`🎯 Jumped to position: ${Math.round(this.game.cameraX)}px`);
    }
    
    setLevelLength(clickX, sliderX, sliderWidth) {
        const progress = (clickX - sliderX) / sliderWidth;
        const minLength = 2000;
        const maxLength = 100000;
        const newLength = minLength + (progress * (maxLength - minLength));
        
        this.resizeLevel(Math.round(newLength));
    }
    
    resizeLevel(newLength) {
        const oldLength = this.game.terrain.worldWidth;
        this.game.terrain.worldWidth = newLength;
        
        // Scale existing terrain points
        this.game.terrain.landscapePoints.forEach(point => {
            point.x = (point.x / oldLength) * newLength;
        });
        
        // If we're making the level shorter, remove points beyond the new length
        if (newLength < oldLength) {
            this.game.terrain.landscapePoints = this.game.terrain.landscapePoints.filter(
                point => point.x <= newLength
            );
        } else {
            // If making longer, extend terrain
            this.extendTerrain(oldLength, newLength);
        }
        
        // Update objects if needed
        this.currentLevel.objects = this.currentLevel.objects.filter(obj => obj.x <= newLength);
        
        console.log(`📏 Resized level: ${oldLength}px → ${newLength}px`);
    }
    
    extendTerrain(oldLength, newLength) {
        const lastPoint = this.game.terrain.landscapePoints[this.game.terrain.landscapePoints.length - 1];
        const step = 150;
        
        for (let x = oldLength + step; x <= newLength; x += step) {
            this.game.terrain.landscapePoints.push({
                x: x,
                groundY: lastPoint.groundY + (Math.random() - 0.5) * 30
            });
        }
    }
    
    getTransformHandleAt(worldX, worldY) {
        if (!this.selectedObject) return null;
        
        const obj = this.selectedObject;
        const handleSize = 6;
        const tolerance = 8; // Click tolerance
        
        const handles = [
            { name: 'tl', x: obj.x - handleSize/2, y: obj.y - handleSize/2 },
            { name: 'tr', x: obj.x + obj.width - handleSize/2, y: obj.y - handleSize/2 },
            { name: 'bl', x: obj.x - handleSize/2, y: obj.y + obj.height - handleSize/2 },
            { name: 'br', x: obj.x + obj.width - handleSize/2, y: obj.y + obj.height - handleSize/2 },
            { name: 'center', x: obj.x + obj.width/2 - handleSize/2, y: obj.y + obj.height/2 - handleSize/2 }
        ];
        
        for (const handle of handles) {
            const distance = Math.sqrt((handle.x - worldX) ** 2 + (handle.y - worldY) ** 2);
            if (distance <= tolerance) {
                return handle.name;
            }
        }
        
        return null;
    }
    
    startTransform(handle) {
        this.isTransforming = true;
        this.transformHandle = handle;
        this.transformStartPos = { x: this.selectedObject.x, y: this.selectedObject.y };
        this.transformStartSize = { width: this.selectedObject.width, height: this.selectedObject.height };
        this.transformStartMouse = { x: this.mouseWorldX, y: this.mouseWorldY };
        
        console.log(`🔧 Starting transform: ${handle}`);
    }
    
    updateTransform() {
        if (!this.selectedObject || !this.transformHandle) return;
        
        const deltaX = this.mouseWorldX - this.transformStartMouse.x;
        const deltaY = this.mouseWorldY - this.transformStartMouse.y;
        
        const obj = this.selectedObject;
        
        switch (this.transformHandle) {
            case 'center':
                // Move object
                obj.x = this.transformStartPos.x + deltaX;
                obj.y = this.transformStartPos.y + deltaY;
                break;
                
            case 'tl': // Top-left corner
                obj.x = this.transformStartPos.x + deltaX;
                obj.y = this.transformStartPos.y + deltaY;
                obj.width = Math.max(20, this.transformStartSize.width - deltaX);
                obj.height = Math.max(10, this.transformStartSize.height - deltaY);
                break;
                
            case 'tr': // Top-right corner
                obj.y = this.transformStartPos.y + deltaY;
                obj.width = Math.max(20, this.transformStartSize.width + deltaX);
                obj.height = Math.max(10, this.transformStartSize.height - deltaY);
                break;
                
            case 'bl': // Bottom-left corner
                obj.x = this.transformStartPos.x + deltaX;
                obj.width = Math.max(20, this.transformStartSize.width - deltaX);
                obj.height = Math.max(10, this.transformStartSize.height + deltaY);
                break;
                
            case 'br': // Bottom-right corner
                obj.width = Math.max(20, this.transformStartSize.width + deltaX);
                obj.height = Math.max(10, this.transformStartSize.height + deltaY);
                break;
        }
        
        // Update game object reference if it exists
        if (obj.gameObjectRef) {
            obj.gameObjectRef.x = obj.x;
            obj.gameObjectRef.y = obj.y;
            if (obj.gameObjectRef.width !== undefined) obj.gameObjectRef.width = obj.width;
            if (obj.gameObjectRef.height !== undefined) obj.gameObjectRef.height = obj.height;
        }
    }
    
    saveLevel() {
        this.saveCurrentGameState(); // Update level data from current state
        
        // Also save to localStorage for level progression
        this.game.levelManager.saveToStorage(this.currentLevel.id, this.currentLevel);
        
        const levelData = JSON.stringify(this.currentLevel, null, 2);
        const filename = `${this.currentLevel.id}.json`;
        
        // Create download link
        const blob = new Blob([levelData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`💾 Saved level: ${filename} (also cached in browser)`);
    }
    
    setLevelId(newId) {
        this.currentLevel.id = newId;
        console.log(`🏷️ Level ID set to: ${newId}`);
    }
    
    setLevelName(newName) {
        this.currentLevel.name = newName;
        console.log(`📝 Level name set to: ${newName}`);
    }
    
    setNextLevel(nextLevelId) {
        this.currentLevel.nextLevel = nextLevelId;
        console.log(`➡️ Next level set to: ${nextLevelId}`);
    }
    
    linkLevels(currentId, nextId) {
        // Helper method to link two levels in progression
        this.currentLevel.id = currentId;
        this.currentLevel.nextLevel = nextId;
        
        // Update phone booth message to reference next level
        const phoneObject = this.currentLevel.objects.find(obj => obj.type === 'phone');
        if (phoneObject && phoneObject.properties) {
            phoneObject.properties.nextLevel = nextId;
            phoneObject.properties.message = `Mission briefing for ${currentId}. Next: ${nextId}`;
        }
        
        console.log(`🔗 Linked ${currentId} → ${nextId}`);
    }
    
    showLoadDialog() {
        // Create file input for loading levels
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => this.loadLevel(e.target.files[0]);
        input.click();
    }
    
    loadLevel(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.currentLevel = JSON.parse(e.target.result);
                this.applyLevelToGame();
                console.log(`📂 Loaded level: ${this.currentLevel.name}`);
            } catch (error) {
                console.error('Failed to load level:', error);
            }
        };
        reader.readAsText(file);
    }
    
    applyLevelToGame() {
        // Apply loaded level data to current game state
        console.log('🔄 Applying level to game...');
        
        // Use the LevelManager to apply the level properly
        this.game.levelManager.loadLevel(this.currentLevel);
        
        // Update editor's camera to follow the new level
        this.game.cameraX = ((this.currentLevel.spawn && this.currentLevel.spawn.x) || 200) - 200;
        this.game.targetCameraX = this.game.cameraX;
        
        console.log(`✅ Level applied to game: ${this.currentLevel.name}`);
    }
    
    update() {
        if (!this.isActive) return;
        
        // Update editor-specific logic
        // Handle continuous actions, animations, etc.
    }
    
    draw(ctx, cameraX) {
        if (!this.isActive) return;
        
        // Draw editor UI
        this.drawEditorOverlay(ctx);
        this.drawSpriteLibrary(ctx);
        this.drawToolbar(ctx);
        this.drawPropertyPanel(ctx);
        this.drawEditorObjects(ctx, cameraX);
        this.drawTerrainPoints(ctx, cameraX);
        this.drawNavigationSlider(ctx);
        this.drawCursor(ctx, cameraX);
    }
    
    drawEditorOverlay(ctx) {
        // Semi-transparent overlay to indicate editor mode
        ctx.save();
        ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
        ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        
        // Editor mode indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 200, 30);
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🎨 LEVEL EDITOR', 15, 30);
        
        ctx.restore();
    }
    
    drawToolbar(ctx) {
        const tools = [
            { key: 'Q', name: 'Select', tool: 'select', icon: '🎯' },
            { key: 'W', name: 'Place', tool: 'place', icon: '➕' },
            { key: 'T', name: 'Terrain', tool: 'terrain', icon: '🖌️' },
            { key: 'R', name: 'Delete', tool: 'delete', icon: '🗑️' }
        ];
        
        ctx.save();
        const toolbarY = 50;
        
        tools.forEach((tool, i) => {
            const x = 10 + (i * 60);
            const isSelected = this.selectedTool === tool.tool;
            
            // Tool button background
            ctx.fillStyle = isSelected ? 'rgba(0, 255, 0, 0.3)' : 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, toolbarY, 50, 50);
            
            // Tool icon
            ctx.font = '20px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(tool.icon, x + 15, toolbarY + 30);
            
            // Key indicator
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ffff00';
            ctx.fillText(tool.key, x + 5, toolbarY + 15);
        });
        
        // Show terrain brush info when terrain tool is selected
        if (this.selectedTool === 'terrain') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(10, toolbarY + 60, 200, 40);
            
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText(`Brush Size: ${this.terrainBrushSize}px`, 15, toolbarY + 75);
            ctx.font = '10px Arial';
            ctx.fillText('[ ] to resize | A to add point', 15, toolbarY + 90);
        }
        
        ctx.restore();
    }
    
    drawSpriteLibrary(ctx) {
        if (!this.showSpriteLibrary) return;
        
        ctx.save();
        const libraryX = this.game.canvas.width - 200;
        const libraryY = 50;
        const libraryWidth = 180;
        const libraryHeight = 300;
        
        // Library background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(libraryX, libraryY, libraryWidth, libraryHeight);
        
        // Title
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('SPRITE LIBRARY', libraryX + 10, libraryY + 20);
        
        // Sprite list
        this.spriteLibrary.forEach((sprite, i) => {
            const y = libraryY + 40 + (i * 40);
            const isSelected = this.selectedSprite === sprite;
            
            // Selection highlight
            if (isSelected) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.fillRect(libraryX + 5, y - 20, libraryWidth - 10, 35);
            }
            
            // Draw sprite image if loaded
            const spriteImage = this.spriteImages[sprite.type];
            if (spriteImage && spriteImage.complete) {
                const thumbSize = 24;
                ctx.drawImage(spriteImage, libraryX + 10, y - 15, thumbSize, thumbSize);
            } else {
                // Fallback to text if image not loaded
                ctx.font = '16px Arial';
                ctx.fillStyle = '#fff';
                ctx.fillText('📷', libraryX + 10, y);
            }
            
            // Sprite name
            ctx.font = '12px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(sprite.name, libraryX + 40, y - 5);
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ccc';
            ctx.fillText(`${sprite.width}x${sprite.height}`, libraryX + 40, y + 8);
        });
        
        ctx.restore();
    }
    
    drawPropertyPanel(ctx) {
        if (!this.showPropertyPanel || !this.selectedObject) return;
        
        ctx.save();
        const panelX = 10;
        const panelY = 120;
        const panelWidth = 250;
        const panelHeight = 200;
        
        // Panel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`PROPERTIES: ${this.selectedObject.type}`, panelX + 10, panelY + 20);
        
        // Properties
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        let yOffset = 45;
        
        ctx.fillText(`ID: ${this.selectedObject.id}`, panelX + 10, panelY + yOffset);
        yOffset += 20;
        ctx.fillText(`X: ${Math.round(this.selectedObject.x)}`, panelX + 10, panelY + yOffset);
        yOffset += 15;
        ctx.fillText(`Y: ${Math.round(this.selectedObject.y)}`, panelX + 10, panelY + yOffset);
        yOffset += 20;
        
        // Object-specific properties
        Object.entries(this.selectedObject.properties || {}).forEach(([key, value]) => {
            ctx.fillText(`${key}: ${value}`, panelX + 10, panelY + yOffset);
            yOffset += 15;
        });
        
        ctx.restore();
    }
    
    drawEditorObjects(ctx, cameraX) {
        // Draw level objects with editor-specific styling
        this.currentLevel.objects.forEach(obj => {
            const screenX = obj.x - cameraX;
            
            if (screenX < -200 || screenX > this.game.canvas.width + 200) return;
            
            ctx.save();
            
            // Draw actual sprite image if available
            const spriteImage = this.spriteImages[obj.type];
            if (spriteImage && spriteImage.complete) {
                ctx.globalAlpha = 0.8;
                ctx.drawImage(spriteImage, screenX, obj.y, obj.width || 50, obj.height || 50);
                ctx.globalAlpha = 1.0;
            } else {
                // Fallback to colored rectangle
                ctx.fillStyle = this.getObjectColor(obj.type);
                ctx.fillRect(screenX, obj.y, obj.width || 50, obj.height || 50);
            }
            
            // Selection highlight and transformation handles
            if (this.selectedObject === obj) {
                const objWidth = obj.width || 50;
                const objHeight = obj.height || 50;
                
                // Selection outline
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - 2, obj.y - 2, objWidth + 4, objHeight + 4);
                
                // Transformation handles
                this.drawTransformHandles(ctx, screenX, obj.y, objWidth, objHeight);
            }
            
            // Object label
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 10px Arial';
            ctx.strokeText(obj.type, screenX, obj.y - 5);
            ctx.fillText(obj.type, screenX, obj.y - 5);
            
            ctx.restore();
        });
    }
    
    getObjectColor(type) {
        const colors = {
            phone: '#ffff00',
            hospital: '#ff6666',
            church: '#6666ff',
            pothole: '#996633',
            hearse: '#333333',
            coffin: '#654321'
        };
        return colors[type] || '#888888';
    }
    
    drawTransformHandles(ctx, x, y, width, height) {
        const handleSize = 6;
        ctx.fillStyle = '#00ff00';
        ctx.strokeStyle = '#003300';
        ctx.lineWidth = 1;
        
        // Corner handles for resize
        const handles = [
            { x: x - handleSize/2, y: y - handleSize/2 }, // Top-left
            { x: x + width - handleSize/2, y: y - handleSize/2 }, // Top-right
            { x: x - handleSize/2, y: y + height - handleSize/2 }, // Bottom-left
            { x: x + width - handleSize/2, y: y + height - handleSize/2 }, // Bottom-right
        ];
        
        handles.forEach(handle => {
            ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
        
        // Center handle for moving
        const centerX = x + width/2 - handleSize/2;
        const centerY = y + height/2 - handleSize/2;
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(centerX, centerY, handleSize, handleSize);
        ctx.strokeRect(centerX, centerY, handleSize, handleSize);
    }
    
    drawCursor(ctx, cameraX) {
        // Draw cursor indicator
        const screenX = this.mouseWorldX - cameraX;
        
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        
        // Crosshair cursor
        ctx.beginPath();
        ctx.moveTo(screenX - 10, this.mouseY);
        ctx.lineTo(screenX + 10, this.mouseY);
        ctx.moveTo(screenX, this.mouseY - 10);
        ctx.lineTo(screenX, this.mouseY + 10);
        ctx.stroke();
        
        // Tool-specific cursor
        if (this.selectedTool === 'terrain') {
            // Draw terrain brush circle
            ctx.strokeStyle = '#00ff00';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(screenX, this.mouseY, this.terrainBrushSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Show target height line
            const groundY = this.game.terrain.getGroundYAt(this.mouseWorldX);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(screenX - 20, groundY);
            ctx.lineTo(screenX + 20, groundY);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    drawNavigationSlider(ctx) {
        if (!this.isActive) return;
        
        ctx.save();
        
        const sliderY = this.game.canvas.height - 40;
        const sliderX = 50;
        const sliderWidth = this.game.canvas.width - 100;
        const sliderHeight = 20;
        
        // Slider background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);
        
        // Slider track
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(sliderX, sliderY, sliderWidth, sliderHeight);
        
        // Calculate slider position based on camera
        const worldWidth = this.game.terrain.worldWidth;
        const cameraProgress = this.game.cameraX / (worldWidth - this.game.canvas.width);
        const sliderPos = sliderX + (cameraProgress * sliderWidth);
        
        // Slider handle
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(sliderPos - 5, sliderY - 2, 10, sliderHeight + 4);
        
        // Level length info
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`Level: ${worldWidth}px | Pos: ${Math.round(this.game.cameraX)}px`, sliderX, sliderY - 5);
        
        // Instructions
        ctx.font = '10px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Click to jump | Shift+Click to set level length', sliderX, sliderY + sliderHeight + 15);
        
        ctx.restore();
    }
    
    drawTerrainPoints(ctx, cameraX) {
        if (!this.isActive || this.selectedTool !== 'terrain') return;
        
        ctx.save();
        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        
        // Draw terrain control points
        this.game.terrain.landscapePoints.forEach((point, index) => {
            const screenX = point.x - cameraX;
            
            if (screenX < -50 || screenX > this.game.canvas.width + 50) return;
            
            // Draw point
            ctx.beginPath();
            ctx.arc(screenX, point.groundY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw index number
            if (index % 5 === 0) { // Only show every 5th index to avoid clutter
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText(index.toString(), screenX + 8, point.groundY - 8);
                ctx.fillStyle = '#ffff00';
            }
        });
        
        ctx.restore();
    }
}