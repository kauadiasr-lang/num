/**
 * Arena of Blades - Core Engine
 * Gerencia o Game Loop, Canvas, Resolução e inicialização dos subsistemas.
 */
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // alpha false melhora performance

        this.lastTime = 0;
        this.deltaTime = 0;
        this.isRunning = false;

        // Dimensões lógicas (CSS pixels) do canvas, usadas para todo o desenho
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Estado do Screen Shake
        this.shakeTimer = 0;
        this.shakeMagnitude = 0;
        // Alguns jogadores têm sensibilidade a esse tipo de efeito (enjoo/
        // desconforto) — precisa poder ser desligado (ver settings.js
        // 'screenShake', tela de Configurações).
        this.screenShakeEnabled = true;

        // Estado Global do Jogo
        this.state = {
            screen: 'LOADING', // LOADING, CREATION, HUB, BATTLE, RESULTS, INVENTORY, SHOP, SKILLS
            player: null
        };

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        // No Chrome mobile o evento "resize" da window nem sempre dispara só
        // por causa da barra de endereço aparecer/sumir; visualViewport é o
        // sinal confiável para isso, quando disponível.
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.resize());
        }

        // Simulação de carregamento de assets (Imagens, Sons, etc)
        this.simulateAssetLoading().then(() => {
            this.onAssetsLoaded();
        });
    }

    // Mantém a proporção e lida com DPI em telas mobile (Retina).
    // Usamos setTransform (não scale) para não acumular escala a cada resize.
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // No Chrome mobile, "100vh" no CSS não acompanha a barra de
        // endereço/gestos aparecendo e sumindo — ela é calculada como se a
        // barra estivesse sempre escondida, o que empurra botões no fim da
        // tela (ex: "Mover" na batalha) para fora da área realmente visível.
        // #game-container usa esta variável (com fallback para 100vh) para
        // ficar sempre do tamanho exato da janela visível de verdade.
        document.documentElement.style.setProperty('--app-height', `${this.height}px`);
    }

    async simulateAssetLoading() {
        const progressBar = document.getElementById('loading-progress');
        const text = document.getElementById('loading-text');

        // Simula carregamento (aqui conectaremos carregamento de JSON, Mapas e Áudios no futuro)
        for (let i = 0; i <= 100; i += 5) {
            progressBar.style.width = `${i}%`;
            if (i === 30) text.innerText = "Forjando Equipamentos...";
            if (i === 60) text.innerText = "Treinando IA Inimiga...";
            if (i === 90) text.innerText = "Limpando a Arena...";
            await new Promise(r => setTimeout(r, 50));
        }
    }

    onAssetsLoaded() {
        document.getElementById('loading-text').innerText = "Tudo Pronto!";
        const btnStart = document.getElementById('btn-start');
        btnStart.classList.remove('hidden');

        btnStart.addEventListener('click', () => {
            // Inicializa áudio após interação (Políticas Web) e aplica as
            // configurações salvas (volume, qualidade gráfica, escala de UI...)
            window.AudioManager.init();
            window.Settings.applyAll();

            this.start(); // Inicia Game Loop
            window.MainMenu.showMainMenu(); // Tela inicial cinematográfica, não mais direto pro jogo
        });
    }

    // Restaura um Player a partir dos dados brutos de um save (usado tanto
    // pelo Continuar quanto pela tela de Slots). Mantido aqui por ser lógica
    // central do motor, reaproveitada por MainMenu.
    restorePlayerFromSave(savedData) {
        // Reconstrói a instância (JSON perde os métodos de classe, mas
        // Object.assign preserva o protótipo de Player já criado)
        this.state.player = new Player(savedData.player.name);
        Object.assign(this.state.player, savedData.player);
        this.state.player.calculateDerivedStats();
    }

    // Ativa o tremor de câmera (Screen Shake)
    triggerShake(magnitude = 10, duration = 0.2) {
        if (!this.screenShakeEnabled) return;
        const reduce = window.GFX && window.GFX.reduceEffects;
        this.shakeMagnitude = reduce ? magnitude * 0.4 : magnitude;
        this.shakeTimer = duration;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((timestamp) => this.loop(timestamp));
        console.log("Game Loop Inicializado.");
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        // Calcula Delta Time em segundos (independente de framerate)
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Limita o Delta Time para evitar bugs se a aba ficar inativa
        if (this.deltaTime > 0.1) this.deltaTime = 0.1;

        this.update(this.deltaTime);
        this.draw(this.ctx);

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Atualiza lógica gráfica (Partículas, Textos Flutuantes, etc)
        if (window.GFX) window.GFX.update(dt);

        // Cidade explorável (novo Hub): movimento do jogador, NPCs, ciclo
        // dia/noite, proximidade de prédios. Só age quando a tela é HUB.
        if (window.City) window.City.update(dt);

        // Atualiza timer do Screen Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        // Acumula tempo jogado (usado nos metadados da tela de saves) — só
        // conta com um personagem carregado, e ignora saltos grandes de dt
        // (aba minimizada) já que o loop principal já limita isso a 0.1s.
        if (this.state.player) {
            this.state.player.playTimeSeconds = (this.state.player.playTimeSeconds || 0) + dt;
        }

        this._updateFpsCounter(dt);
    }

    _updateFpsCounter(dt) {
        this._fpsAccum = (this._fpsAccum || 0) + dt;
        this._fpsFrames = (this._fpsFrames || 0) + 1;
        if (this._fpsAccum >= 0.5) {
            const fps = Math.round(this._fpsFrames / this._fpsAccum);
            const el = document.getElementById('fps-counter');
            if (el && !el.classList.contains('hidden')) el.innerText = `${fps} FPS`;
            this._fpsAccum = 0;
            this._fpsFrames = 0;
        }
    }

    draw(ctx) {
        // Aplica transformações de câmera (Screen Shake)
        ctx.save();
        if (this.shakeTimer > 0) {
            const dx = Utils.randomFloat(-this.shakeMagnitude, this.shakeMagnitude);
            const dy = Utils.randomFloat(-this.shakeMagnitude, this.shakeMagnitude);
            ctx.translate(dx, dy);
        }

        // O GraphicsEngine desenha a cena inteira: fundo preto simples fora de
        // batalha, ou a arena cinematográfica completa (céu, coliseu, plateia,
        // gladiadores) quando state.screen === 'BATTLE'.
        if (window.GFX) window.GFX.draw(ctx, this.width, this.height);

        // Restaura câmera
        ctx.restore();
    }
}

// Inicia a Engine após o DOM ser carregado
window.addEventListener('DOMContentLoaded', () => {
    window.Engine = new GameEngine();
});
