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

    // Shared in-world interaction label: small black chip, white lettering.
    // Every prompt in the game goes through this — one visual language.
    // (centerX, bottomY) in screen coordinates; bottomY is the chip's bottom edge.
    static drawPrompt(ctx, text, centerX, bottomY) {
        ctx.save();
        ctx.font = '10px Georgia, serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        const label = text.toUpperCase();
        const textW = ctx.measureText(label).width;
        const padX = 9, boxH = 20;
        const boxW = textW + padX * 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(centerX - boxW / 2, bottomY - boxH, boxW, boxH);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, centerX, bottomY - boxH / 2 + 1);
        ctx.restore();
    }
}