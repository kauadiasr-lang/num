/**
 * Engine de Áudio Avançada Procedural (Web Audio API Sintetizada)
 * Não requer arquivos externos. Gera sons via matemática pura (osciladores),
 * evitando qualquer dependência de assets binários ou direitos de terceiros.
 */
class AudioEngine {
    constructor() {
        this.context = null;
        this.masterVolume = 0.5;
        this.musicVolume = 0.4;
        this.sfxVolume = 0.6;
        this.initialized = false;
        this._musicNodes = null; // referências ativas da trilha ambiente, pra poder parar sem vazar
    }

    // Requer um clique do usuário para inicializar (Política dos Navegadores)
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.initialized = true;
        console.log("[AudioEngine] Sintetizador Procedural Inicializado.");
    }

    // channel: 'sfx' (padrão, efeitos de combate/interface) ou 'music' (trilha ambiente)
    playTone(frequency, type, duration, vol = 1, slideTo = null, channel = 'sfx') {
        if (!this.initialized) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        osc.frequency.setValueAtTime(frequency, this.context.currentTime);

        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.context.currentTime + duration);
        }

        const channelVol = channel === 'music' ? this.musicVolume : this.sfxVolume;

        // Fade out perfeito (anti-click)
        gain.gain.setValueAtTime(Math.max(0.0001, vol * this.masterVolume * channelVol), this.context.currentTime);
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

    // Grunhido curto ao sofrer um golpe — o tom base varia por gênero do
    // personagem (identidade visual/sonora, igual à diferença de silhueta;
    // não afeta dano nem qualquer cálculo de combate). Some junto ao som de
    // impacto da arma, não o substitui.
    playHitGrunt(gender) {
        const base = gender === 'Feminino' ? Utils.randomInt(260, 320) : Utils.randomInt(130, 170);
        this.playTone(base, 'sawtooth', 0.14, 0.25, base * 0.6);
    }

    playLevelUp() {
        // Fanfarra clássica de RPG arpejada
        const notes = [440, 554, 659, 880]; // A, C#, E, A
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.3, 0.3), i * 150);
        });
    }

    // Som de confirmação suave (save realizado, conquista, etc)
    playConfirm() {
        this.playTone(700, 'sine', 0.12, 0.35, 1000);
        setTimeout(() => this.playTone(1000, 'sine', 0.15, 0.3, 1300), 80);
    }

    // --- Trilha Ambiente (drone procedural em loop, usado no Menu/Créditos) ---
    // 3 osciladores levemente destonados + um LFO lento na amplitude, criando
    // um "pad" atmosférico contínuo sem precisar de nenhum arquivo de áudio.
    startAmbientMusic() {
        if (!this.initialized || this._musicNodes) return;

        const ctx = this.context;
        const master = ctx.createGain();
        master.gain.value = this.masterVolume * this.musicVolume;
        master.connect(ctx.destination);

        const baseFreqs = [82.41, 110.0, 123.47]; // E2, A2, B2 — acorde suspenso, clima solene
        const oscillators = baseFreqs.map((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq * (1 + (i - 1) * 0.003); // leve destonação orgânica
            const g = ctx.createGain();
            g.gain.value = 0.22;
            osc.connect(g);
            g.connect(master);
            osc.start();
            return osc;
        });

        // LFO lento modulando o volume geral, pra "respirar" em vez de ficar estático
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.08;
        lfo.connect(lfoGain);
        lfoGain.connect(master.gain);
        lfo.start();

        this._musicNodes = { master, oscillators, lfo };
    }

    stopAmbientMusic() {
        if (!this._musicNodes) return;
        const { master, oscillators, lfo } = this._musicNodes;
        const now = this.context.currentTime;
        // Fade out suave antes de desligar, evita corte abrupto/clique
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.6);
        setTimeout(() => {
            oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
            try { lfo.stop(); lfo.disconnect(); } catch (e) {}
            try { master.disconnect(); } catch (e) {}
        }, 650);
        this._musicNodes = null;
    }

    // Atualiza o volume da trilha em execução em tempo real (chamado quando o
    // jogador mexe no slider de Música/Volume Geral nas Configurações)
    updateMusicVolume() {
        if (this._musicNodes) {
            this._musicNodes.master.gain.setTargetAtTime(this.masterVolume * this.musicVolume, this.context.currentTime, 0.1);
        }
    }
}

window.AudioManager = new AudioEngine();
