/**
 * Engine de Áudio Avançada Procedural (Web Audio API Sintetizada)
 * Não requer arquivos externos. Gera sons via matemática pura (osciladores),
 * evitando qualquer dependência de assets binários ou direitos de terceiros.
 */
class AudioEngine {
    constructor() {
        this.context = null;
        this.masterVolume = 0.5;
        this.initialized = false;
    }

    // Requer um clique do usuário para inicializar (Política dos Navegadores)
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.initialized = true;
        console.log("[AudioEngine] Sintetizador Procedural Inicializado.");
    }

    playTone(frequency, type, duration, vol = 1, slideTo = null) {
        if (!this.initialized) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        osc.frequency.setValueAtTime(frequency, this.context.currentTime);

        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.context.currentTime + duration);
        }

        // Fade out perfeito (anti-click)
        gain.gain.setValueAtTime(Math.max(0.0001, vol * this.masterVolume), this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.start();
        osc.stop(this.context.currentTime + duration);
    }

    // --- Biblioteca de Efeitos Sonoros ---

    playUIHover() { this.playTone(600, 'sine', 0.05, 0.1); }
    playUIClick() { this.playTone(800, 'square', 0.1, 0.2); }
    playError() { this.playTone(150, 'sawtooth', 0.2, 0.3, 100); }

    playSwordClash() {
        // Combinação de frequências agudas/graves para simular impacto metálico
        this.playTone(Utils.randomInt(800, 1200), 'square', 0.15, 0.4, 300);
        this.playTone(Utils.randomInt(400, 600), 'sawtooth', 0.2, 0.3);
    }

    playMagicCast() {
        // Deslize de frequência longo (Swoosh mágico)
        this.playTone(800, 'sine', 0.6, 0.5, 200);
        this.playTone(1200, 'triangle', 0.4, 0.3, 400);
    }

    playHeal() {
        this.playTone(400, 'sine', 0.3, 0.4, 800);
        setTimeout(() => this.playTone(600, 'sine', 0.4, 0.4, 1200), 100);
    }

    playCrit() {
        this.playTone(150, 'square', 0.4, 0.6, 50); // Tremor grave
        this.playTone(2000, 'sawtooth', 0.1, 0.3); // Impacto agudo
    }

    playLevelUp() {
        // Fanfarra clássica de RPG arpejada
        const notes = [440, 554, 659, 880]; // A, C#, E, A
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.3, 0.3), i * 150);
        });
    }
}

window.AudioManager = new AudioEngine();
