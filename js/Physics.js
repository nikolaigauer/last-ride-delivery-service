// Matter.js physics engine wrapper
// Phase 1: engine runs every frame, no bodies yet

class Physics {
    constructor() {
        this.engine = Matter.Engine.create();
        this.engine.gravity.y = 1.0;
        this.world = this.engine.world;
    }

    step(dtMs = 16.67) {
        Matter.Engine.update(this.engine, dtMs);
    }
}
