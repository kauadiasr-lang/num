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

    // Passo ao andar pela Cidade (ver city.js _updateMovement) — um "thud"
    // grave e curto, com leve variação de tom a cada passo pra não soar
    // igual um metrônomo. O jogador andava pela praça inteira sem NENHUM
    // som próprio de movimento, só o drone ambiente contínuo de fundo.
    playFootstep() {
        this.playTone(Utils.randomInt(70, 90), 'sine', 0.08, 0.15);
    }

    // Trovão de uma tempestade (ver city.js _updateWeather/isStorm) — estrondo
    // grave e longo seguido de um estalo mais agudo logo depois, imitando o
    // som chegando com um pequeno atraso do "raio" visual (ver graphics.js
    // triggerLightningFlash).
    playThunder() {
        this.playTone(Utils.randomInt(45, 70), 'sawtooth', 1.3, 0.55, 25);
        setTimeout(() => this.playTone(Utils.randomInt(90, 140), 'square', 0.3, 0.3), 90);
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

        // Fundamental + quinta + oitava (C2/G2/C3): intervalos puros e
        // consonantes. A versão anterior usava E2/A2/B2, com A2-B2 formando
        // uma segunda maior sustentada na mesma oitava — dissonância batendo
        // continuamente que soava como um chiado tenso em vez de uma trilha
        // calma (relatado pelo jogador).
        const baseFreqs = [65.41, 98.00, 130.81]; // C2, G2, C3
        const oscillators = baseFreqs.map((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq * (1 + (i - 1) * 0.0015); // destonação bem sutil, só pra dar corpo
            const g = ctx.createGain();
            g.gain.value = 0.2;
            osc.connect(g);
            g.connect(master);
            osc.start();
            return osc;
        });

        // LFO lento modulando o volume geral, pra "respirar" em vez de ficar estático
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(master.gain);
        lfo.start();

        this._musicNodes = { master, oscillators, lfo, melodyTimer: null };

        // Melodia suave e lenta por cima do pad — sem isso a trilha era só um
        // drone estático; notas espaçadas de uma escala pentatônica maior em
        // C (consonante com o novo acorde-base), com timing levemente
        // aleatório pra não soar como um metrônomo.
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4 pentatônica maior
        const scheduleNote = () => {
            if (!this._musicNodes) return;
            const freq = scale[Utils.randomInt(0, scale.length - 1)];
            this.playTone(freq, 'triangle', Utils.randomFloat(1.8, 2.6), 0.09, null, 'music');
            this._musicNodes.melodyTimer = setTimeout(scheduleNote, Utils.randomFloat(2200, 4200));
        };
        this._musicNodes.melodyTimer = setTimeout(scheduleNote, 3000);
    }

    stopAmbientMusic() {
        if (!this._musicNodes) return;
        const { master, oscillators, lfo, melodyTimer } = this._musicNodes;
        clearTimeout(melodyTimer);
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

    // --- Trilha de Batalha (procedural, tensa e rítmica) ---
    // Um pad sustentado num intervalo dissonante (trítono, em vez do acorde
    // suspenso calmo da cidade) por baixo de um pulso grave rítmico tipo
    // tambor de guerra — sensação de urgência sem precisar de nenhum arquivo
    // de áudio.
    startBattleMusic() {
        if (!this.initialized || this._battleMusicNodes) return;

        const ctx = this.context;
        const master = ctx.createGain();
        master.gain.value = this.masterVolume * this.musicVolume * 0.85;
        master.connect(ctx.destination);

        const baseFreqs = [82.41, 116.54]; // E2 + A#2 — trítono, tensão constante
        const oscillators = baseFreqs.map((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq * (1 + (i - 0.5) * 0.004);
            const g = ctx.createGain();
            g.gain.value = 0.09;
            osc.connect(g);
            g.connect(master);
            osc.start();
            return osc;
        });

        // Pulso grave rítmico (~132 bpm), com acento a cada 4 batidas
        const beatMs = 454;
        let beat = 0;
        const pulseTimer = setInterval(() => {
            if (!this.initialized) return;
            const accent = beat % 4 === 0;
            this.playTone(accent ? 65.41 : 82.41, 'triangle', 0.18, accent ? 0.32 : 0.2, null, 'music');
            beat++;
        }, beatMs);

        this._battleMusicNodes = { master, oscillators, pulseTimer };
    }

    stopBattleMusic() {
        if (!this._battleMusicNodes) return;
        const { master, oscillators, pulseTimer } = this._battleMusicNodes;
        clearInterval(pulseTimer);
        const now = this.context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
        setTimeout(() => {
            oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
            try { master.disconnect(); } catch (e) {}
        }, 450);
        this._battleMusicNodes = null;
    }

    // Atualiza o volume da trilha em execução em tempo real (chamado quando o
    // jogador mexe no slider de Música/Volume Geral nas Configurações) —
    // afeta a trilha da cidade/menu e a de batalha, qual estiver tocando.
    updateMusicVolume() {
        if (this._musicNodes) {
            this._musicNodes.master.gain.setTargetAtTime(this.masterVolume * this.musicVolume, this.context.currentTime, 0.1);
        }
        if (this._battleMusicNodes) {
            this._battleMusicNodes.master.gain.setTargetAtTime(this.masterVolume * this.musicVolume * 0.85, this.context.currentTime, 0.1);
        }
    }

    // --- Ambiência da Cidade explorável ---
    // Reaproveita o mesmo drone atmosférico do Menu Principal como base (a
    // troca de tela já para/retoma isso automaticamente, sem duplicar
    // osciladores); só soma texturas curtas ocasionais por cima.
    startCityAmbience() { this.startAmbientMusic(); }
    stopCityAmbience() { this.stopAmbientMusic(); }

    // Textura sonora aleatória da praça: martelo da forja, murmúrio distante
    // da multidão ou respingo d'água da fonte — sorteado e chamado
    // periodicamente pelo CityEngine, sem sintetizador novo (reusa playTone).
    playCityAmbientOneshot() {
        if (!this.initialized) return;
        const pick = Utils.randomInt(0, 2);
        if (pick === 0) { // martelo do ferreiro
            this.playTone(180, 'square', 0.08, 0.15, 90);
            setTimeout(() => this.playTone(160, 'square', 0.06, 0.1, 80), 140);
        } else if (pick === 1) { // murmúrio distante da multidão (triangle: mais suave que o serrote usado nos impactos de combate)
            this.playTone(Utils.randomInt(180, 260), 'triangle', 0.5, 0.05);
        } else { // respingo d'água da fonte
            this.playTone(Utils.randomInt(500, 700), 'sine', 0.15, 0.08, 300);
        }
    }
}

window.AudioManager = new AudioEngine();
