// Utility functions for the game

class Utils {
    // Linear interpolation between two points
    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    // Calculate distance between two points
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Clamp value between min and max
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Convert degrees to radians
    static toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // Convert radians to degrees
    static toDegrees(radians) {
        return radians * 180 / Math.PI;
    }

    // Random number between min and max
    static random(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Random integer between min and max (inclusive)
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}