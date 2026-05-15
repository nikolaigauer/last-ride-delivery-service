// Initialize and start the game
console.log('🚗 Last Ride Delivery Service - Loading...');

// Start the game when page is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new StickmanGame();
    
    // Make game globally accessible for console debugging
    window.game = game;
    
    // Console commands for testing corpse scaling:
    console.log('🔥 Enhanced Ragdoll System Loaded!');
    console.log('- 24 anatomical joints with physics');
    console.log('- Black silhouette style matching hearse driver');
    console.log('- Adjustable scale: game.corpse.setScale(1.2)');
    console.log('- Custom sizing: game.corpse.setSize(width, height)');
    console.log('- Enhanced joint physics with realistic constraints');
    console.log('🎮 Game ready! Use arrow keys and spacebar to play.');
});