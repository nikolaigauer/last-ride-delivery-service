// Procedural audio engine for STICKMAN game
// Uses Web Audio API for real-time sound synthesis

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.sounds = new Map();
        this.isInitialized = false;
        this.backgroundMusic = null;
        
        // Engine state for dynamic sounds
        this.engineGain = null;
        this.engineOscillator = null;
        this.isEngineRunning = false;
        
        this.initializeAudio();
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.3; // Master volume
            
            this.isInitialized = true;
            console.log('🔊 Audio engine initialized successfully');
        } catch (error) {
            console.warn('Audio initialization failed:', error);
        }
    }

    async ensureAudioContext() {
        if (!this.isInitialized || this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn('Failed to resume audio context:', error);
            }
        }
    }

    // HEARSE ENGINE SOUNDS
    startEngine(velocity = 0) {
        if (!this.isInitialized || this.isEngineRunning) return;
        
        this.ensureAudioContext();
        
        // Create low rumble base frequency
        this.engineOscillator = this.audioContext.createOscillator();
        this.engineGain = this.audioContext.createGain();
        
        this.engineOscillator.type = 'sawtooth';
        this.engineOscillator.frequency.value = 45 + velocity * 2; // Dynamic frequency
        
        this.engineGain.gain.value = 0.15;
        
        this.engineOscillator.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        
        this.engineOscillator.start();
        this.isEngineRunning = true;
    }

    updateEngine(velocity = 0, isAirborne = false) {
        if (!this.isEngineRunning || !this.engineOscillator) return;
        
        // Dynamic engine sound based on speed
        const baseFreq = 45;
        const speedMultiplier = Math.abs(velocity) * 3;
        const targetFreq = baseFreq + speedMultiplier;
        
        this.engineOscillator.frequency.exponentialRampToValueAtTime(
            Math.max(30, Math.min(targetFreq, 180)), 
            this.audioContext.currentTime + 0.1
        );
        
        // Volume changes with speed
        const targetVolume = isAirborne ? 0.05 : (0.15 + Math.abs(velocity) * 0.01);
        this.engineGain.gain.exponentialRampToValueAtTime(
            Math.max(0.05, Math.min(targetVolume, 0.3)), 
            this.audioContext.currentTime + 0.1
        );
    }

    stopEngine() {
        if (!this.isEngineRunning || !this.engineOscillator) return;
        
        try {
            this.engineGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            this.engineOscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Error stopping engine:', error);
        }
        
        this.isEngineRunning = false;
        this.engineOscillator = null;
        this.engineGain = null;
    }

    // DOOR SOUNDS
    playDoorOpen() {
        this.playSound('doorOpen', () => {
            const duration = 0.8;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'square';
            osc.frequency.value = 120;
            
            // Creaky door sound - frequency modulation
            osc.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + duration);
            
            gain.gain.value = 0.2;
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        });
    }

    playDoorClose() {
        this.playSound('doorClose', () => {
            const duration = 0.6;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'square';
            osc.frequency.value = 80;
            osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + duration);
            
            gain.gain.value = 0.25;
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        });
    }

    // CORPSE IMPACT SOUNDS
    playCorpseImpact(intensity = 1) {
        this.playSound('corpseImpact', () => {
            const duration = 0.3 + intensity * 0.2;
            
            // Wet slap sound using filtered noise
            const bufferSize = this.audioContext.sampleRate * duration;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate noise with attack/decay envelope
            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;
                const envelope = Math.exp(-t * 15); // Quick decay
                data[i] = (Math.random() * 2 - 1) * envelope * intensity * 0.3;
            }
            
            const source = this.audioContext.createBufferSource();
            const filter = this.audioContext.createBiquadFilter();
            const gain = this.audioContext.createGain();
            
            source.buffer = buffer;
            filter.type = 'lowpass';
            filter.frequency.value = 200 + intensity * 100; // Higher pitch for harder impacts
            
            gain.gain.value = 0.4;
            
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            source.start();
        });
    }

    // BACKGROUND MUSIC - 80s Japanese Jazz Fusion
    startBackgroundMusic() {
        if (this.backgroundMusic) return;
        
        this.ensureAudioContext();
        
        // Create a simple ambient jazz chord progression
        this.backgroundMusic = {
            oscillators: [],
            gains: [],
            isPlaying: true
        };
        
        // Jazz chord progression: Cmaj7 - Am7 - Dm7 - G7
        const chordProgression = [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [220.00, 261.63, 329.63, 415.30], // Am7
            [293.66, 349.23, 440.00, 523.25], // Dm7
            [196.00, 246.94, 293.66, 369.99]  // G7
        ];
        
        const startTime = this.audioContext.currentTime;
        
        chordProgression.forEach((chord, chordIndex) => {
            const chordStartTime = startTime + (chordIndex * 8); // 8 seconds per chord
            
            chord.forEach((freq, noteIndex) => {
                setTimeout(() => {
                    if (!this.backgroundMusic?.isPlaying) return;
                    
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    
                    gain.gain.value = 0;
                    gain.gain.exponentialRampToValueAtTime(0.03, this.audioContext.currentTime + 1);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 7);
                    
                    osc.connect(gain);
                    gain.connect(this.masterGain);
                    
                    osc.start();
                    osc.stop(this.audioContext.currentTime + 8);
                    
                    this.backgroundMusic.oscillators.push(osc);
                    this.backgroundMusic.gains.push(gain);
                }, (chordIndex * 8000) + (noteIndex * 100)); // Slight stagger
            });
        });
        
        // Loop the progression
        setTimeout(() => {
            if (this.backgroundMusic?.isPlaying) {
                this.backgroundMusic.oscillators = [];
                this.backgroundMusic.gains = [];
                this.startBackgroundMusic();
            }
        }, 32000); // 4 chords * 8 seconds
    }

    stopBackgroundMusic() {
        if (!this.backgroundMusic) return;
        
        this.backgroundMusic.isPlaying = false;
        
        // Fade out current oscillators
        this.backgroundMusic.gains.forEach(gain => {
            try {
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2);
            } catch (error) {
                // Handle already disconnected nodes
            }
        });
        
        setTimeout(() => {
            if (this.backgroundMusic) {
                this.backgroundMusic.oscillators.forEach(osc => {
                    try {
                        osc.stop();
                    } catch (error) {
                        // Handle already stopped oscillators
                    }
                });
            }
            this.backgroundMusic = null;
        }, 2000);
    }

    // Generic sound management
    playSound(soundId, createSoundFn) {
        if (!this.isInitialized) return;
        
        this.ensureAudioContext();
        
        // Prevent sound spam
        if (this.sounds.has(soundId)) {
            const lastPlayed = this.sounds.get(soundId);
            if (Date.now() - lastPlayed < 100) return; // 100ms cooldown
        }
        
        this.sounds.set(soundId, Date.now());
        createSoundFn();
    }

    // Utility method to set master volume
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
}