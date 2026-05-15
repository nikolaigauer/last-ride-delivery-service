// Level sequence and progression management

class LevelManager {
    constructor(game) {
        this.game = game;
        this.currentLevelIndex = 0;
        this.levels = [];
        this.isLevelComplete = false;
        this.loadedLevels = new Map(); // Cache for loaded level files
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 2000; // 2 seconds
        
        // Default level progression
        this.defaultLevels = [
            'level_01_tutorial',
            'level_02_hills'
        ];
    }
    
    loadLevel(levelData) {
        console.log(`📂 Loading level: ${levelData.name}`);
        
        // Store level data
        this.currentLevel = levelData;
        
        // Apply level to game
        this.applyLevelToGame(levelData);
        
        this.isLevelComplete = false;
    }
    
    applyLevelToGame(levelData) {
        // Set terrain
        if (levelData.terrain) {
            this.game.terrain.worldWidth = levelData.terrain.width || 50000;
            
            if (levelData.terrain.points && levelData.terrain.points.length > 0) {
                this.game.terrain.landscapePoints = [...levelData.terrain.points];
            } else {
                // Regenerate terrain if no custom points
                this.game.terrain.landscapePoints = this.game.terrain.generateLandscape();
            }
        }
        
        // Clear existing objects
        this.clearGameObjects();
        
        // Apply spawn positions
        if (levelData.spawn) {
            this.game.player.x = levelData.spawn.x;
            this.game.player.y = levelData.spawn.y;
        }
        
        if (levelData.hearseSpawn) {
            this.game.hearse.teleportTo(levelData.hearseSpawn.x, levelData.hearseSpawn.y);
        }
        
        // Create level objects
        this.createLevelObjects(levelData.objects);
        
        // Reset camera
        this.game.cameraX = 0;
        this.game.targetCameraX = 0;
        
        console.log(`✅ Level applied: ${levelData.name}`);
    }
    
    clearGameObjects() {
        // Clear potholes
        this.game.potholeManager.potholes = [];
        
        // Reset core objects to default positions
        this.game.phoneBooth.x = 400;
        this.game.phoneBooth.y = 300;
        this.game.hospital.x = 1500;
        this.game.hospital.y = 280;
        this.game.church.x = 3500;
        this.game.church.y = 280;
        this.game.deliveryBooth.x = 4500;
        this.game.deliveryBooth.y = 300;
    }
    
    createLevelObjects(objects) {
        if (!objects) return;
        
        objects.forEach(obj => {
            switch (obj.type) {
                case 'phone':
                    // Update phone booth position and properties
                    if (obj.id === 'phone_booth_main') {
                        this.game.phoneBooth.x = obj.x;
                        this.game.phoneBooth.y = obj.y;
                        if (obj.properties.message) {
                            this.game.phoneBooth.missionMessage = obj.properties.message;
                        }
                    } else if (obj.id === 'phone_booth_delivery') {
                        this.game.deliveryBooth.x = obj.x;
                        this.game.deliveryBooth.y = obj.y;
                    }
                    break;
                    
                case 'hospital':
                    this.game.hospital.x = obj.x;
                    this.game.hospital.y = obj.y;
                    break;
                    
                case 'church':
                    this.game.church.x = obj.x;
                    this.game.church.y = obj.y;
                    break;
                    
                case 'hearse':
                    this.game.hearse.teleportTo(obj.x, obj.y);
                    break;
                    
                default:
                    // Handle potholes and other objects
                    if (obj.type.startsWith('pothole')) {
                        const pothole = {
                            x: obj.x,
                            y: obj.y,
                            width: obj.width || 40,
                            height: obj.height || 20,
                            severity: (obj.properties && obj.properties.severity) || 1,
                            bumpValue: (obj.properties && obj.properties.bumpValue) || 1,
                            imageIndex: (obj.properties && obj.properties.imageIndex) || 0
                        };
                        this.game.potholeManager.potholes.push(pothole);
                    }
                    break;
            }
        });
    }
    
    completeLevel() {
        if (this.isLevelComplete) return;
        
        this.isLevelComplete = true;
        
        console.log(`🎉 Level completed: ${(this.currentLevel && this.currentLevel.name) || 'Unknown'}`);

        // Check if there's a next level
        if (this.currentLevel && this.currentLevel.nextLevel) {
            this.loadNextLevel(this.currentLevel.nextLevel);
        } else {
            // Default progression
            this.currentLevelIndex++;
            if (this.currentLevelIndex < this.defaultLevels.length) {
                this.loadNextLevel(this.defaultLevels[this.currentLevelIndex]);
            } else {
                this.showGameComplete();
            }
        }
    }
    
    loadNextLevel(levelId) {
        console.log(`⏭️ Attempting to load next level: ${levelId}`);
        
        // Check if level is already cached
        if (this.loadedLevels.has(levelId)) {
            this.transitionToLevel(this.loadedLevels.get(levelId));
            return;
        }
        
        // Try to load from localStorage first
        const savedLevel = this.loadFromStorage(levelId);
        if (savedLevel) {
            this.loadedLevels.set(levelId, savedLevel);
            this.transitionToLevel(savedLevel);
            return;
        }
        
        // Show level selection dialog if not found
        this.showLevelLoadDialog(levelId);
    }
    
    loadFromStorage(levelId) {
        try {
            const levelData = localStorage.getItem(`level_${levelId}`);
            if (levelData) {
                console.log(`📦 Found level in storage: ${levelId}`);
                return JSON.parse(levelData);
            }
        } catch (error) {
            console.error(`Failed to load level from storage: ${levelId}`, error);
        }
        return null;
    }
    
    saveToStorage(levelId, levelData) {
        try {
            localStorage.setItem(`level_${levelId}`, JSON.stringify(levelData));
            console.log(`💾 Saved level to storage: ${levelId}`);
        } catch (error) {
            console.error(`Failed to save level to storage: ${levelId}`, error);
        }
    }
    
    showLevelLoadDialog(levelId) {
        const message = {
            title: `Load Next Level: ${levelId}`,
            message: `Level "${levelId}" not found in storage.\n\nOptions:\n1. Load level file from disk\n2. Create default level\n3. Stay on current level`,
            instruction: "Press L to load file, D for default, or SPACE to continue"
        };
        
        this.game.showMissionBriefing(message);
        this.pendingLevelId = levelId;
        
        // Set up temporary input handler for level loading options
        this.originalInputHandler = this.game.input.onKeyPressed;
        this.game.input.onKeyPressed = (key) => {
            if (key === 'l' || key === 'L') {
                this.loadLevelFromFile();
            } else if (key === 'd' || key === 'D') {
                this.createAndLoadDefaultLevel(levelId);
            } else if (key === ' ') {
                this.cancelLevelLoading();
            }
        };
    }
    
    loadLevelFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const levelData = JSON.parse(e.target.result);
                    this.loadedLevels.set(this.pendingLevelId, levelData);
                    this.saveToStorage(this.pendingLevelId, levelData);
                    this.transitionToLevel(levelData);
                    this.restoreInputHandler();
                } catch (error) {
                    console.error('Failed to load level file:', error);
                    this.cancelLevelLoading();
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    createAndLoadDefaultLevel(levelId) {
        const defaultLevel = this.createDefaultLevel(levelId);
        this.loadedLevels.set(levelId, defaultLevel);
        this.saveToStorage(levelId, defaultLevel);
        this.transitionToLevel(defaultLevel);
        this.restoreInputHandler();
    }
    
    cancelLevelLoading() {
        this.restoreInputHandler();
        console.log('📌 Staying on current level');
    }
    
    restoreInputHandler() {
        this.game.input.onKeyPressed = this.originalInputHandler;
        this.pendingLevelId = null;
    }
    
    transitionToLevel(levelData) {
        console.log(`🔄 Starting transition to: ${levelData.name}`);
        this.nextLevelData = levelData;
        this.isTransitioning = true;
        this.transitionProgress = 0;
        
        // Start smooth camera pan to new level area
        const targetX = (levelData.spawn && levelData.spawn.x) || 0;
        this.startCameraX = this.game.cameraX;
        this.targetCameraX = Math.max(0, targetX - this.game.canvas.width / 2);
    }
    
    showGameComplete() {
        const gameCompleteMessage = {
            title: "🎉 Game Complete!",
            message: "Congratulations! You've completed all levels.\n\nYour undertaking business is thriving!\nTime to expand the delivery empire.",
            instruction: "Press SPACE to restart or create new levels in the editor"
        };
        
        this.game.showMissionBriefing(gameCompleteMessage);
        console.log('🏁 All levels completed!');
    }
    
    createDefaultLevel(levelId) {
        // Create default level data structure
        return {
            id: levelId,
            name: levelId.replace(/_/g, ' ').toUpperCase(),
            version: '1.0',
            terrain: {
                type: 'procedural',
                points: [],
                width: 50000
            },
            objects: [
                { id: 'phone_booth_main', type: 'phone', x: 400, y: 300, width: 60, height: 80, 
                  properties: { message: 'Another delivery awaits...', nextLevel: null } },
                { id: 'hospital_main', type: 'hospital', x: 1500, y: 280, width: 120, height: 80, 
                  properties: { spawnsCargo: true } },
                { id: 'church_main', type: 'church', x: 3500, y: 280, width: 120, height: 80, 
                  properties: { isDestination: true } },
                { id: 'hearse_main', type: 'hearse', x: 100, y: 280, width: 120, height: 60, 
                  properties: { isPlayerVehicle: true } }
            ],
            spawn: { x: 300, y: 320 },
            hearseSpawn: { x: 100, y: 280 },
            nextLevel: null
        };
    }
    
    update(deltaTime) {
        // Handle level transition animation
        if (this.isTransitioning && this.nextLevelData) {
            this.transitionProgress += deltaTime;
            
            // Smooth camera interpolation
            const progress = Math.min(this.transitionProgress / this.transitionDuration, 1);
            const easedProgress = this.easeInOutCubic(progress);
            
            this.game.cameraX = this.startCameraX + 
                (this.targetCameraX - this.startCameraX) * easedProgress;
            this.game.targetCameraX = this.game.cameraX;
            
            // Complete transition
            if (progress >= 1) {
                this.loadLevel(this.nextLevelData);
                this.isTransitioning = false;
                this.nextLevelData = null;
                console.log('✅ Level transition complete');
            }
        }
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    // Helper method to save current level to storage
    saveCurrentLevelToStorage() {
        if (this.currentLevel) {
            this.saveToStorage(this.currentLevel.id, this.currentLevel);
        }
    }
    
    // Get list of all levels in storage
    getStoredLevels() {
        const levels = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('level_')) {
                try {
                    const levelData = JSON.parse(localStorage.getItem(key));
                    levels.push({
                        id: levelData.id,
                        name: levelData.name,
                        storageKey: key
                    });
                } catch (error) {
                    console.warn(`Invalid level data in storage: ${key}`);
                }
            }
        }
        return levels;
    }
    
    // Clear all levels from storage
    clearStoredLevels() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('level_')) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
        this.loadedLevels.clear();
        console.log(`🗑️ Cleared ${keys.length} levels from storage`);
    }
}