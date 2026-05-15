// Input handling for the game

class InputManager {
    constructor() {
        this.keys = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isKeyPressed(keyCode) {
        return !!this.keys[keyCode];
    }

    // Clear a key (useful for one-time actions like spacebar)
    clearKey(keyCode) {
        this.keys[keyCode] = false;
    }

    // Check if any movement keys are pressed
    isMoving() {
        return this.isKeyPressed('ArrowLeft') || this.isKeyPressed('ArrowRight');
    }

    // Get movement direction (-1 for left, 1 for right, 0 for none)
    getMovementDirection() {
        let direction = 0;
        if (this.isKeyPressed('ArrowLeft')) direction -= 1;
        if (this.isKeyPressed('ArrowRight')) direction += 1;
        return direction;
    }
}