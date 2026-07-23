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
            // Inicializa áudio após interação (Políticas Web)
            window.AudioManager.init();

            // Tenta carregar o Save
            const savedData = window.SaveManager.load();

            if (savedData && savedData.player) {
                console.log("Save encontrado! Restaurando gladiador...");

                // Reconstrói a instância (JSON perde os métodos de classe, mas
                // Object.assign preserva o protótipo de Player já criado)
                this.state.player = new Player(savedData.player.name);
                Object.assign(this.state.player, savedData.player);

                // Recalcula derivados para garantir matemática perfeita
                this.state.player.calculateDerivedStats();

                window.UI.updateHubStats();
                window.UI.showScreen('screen-hub');
            } else {
                console.log("Nenhum save. Iniciando nova jornada.");
                window.UI.buildCreationScreen();
                window.UI.showScreen('screen-creation');
            }

            document.getElementById('screen-loading').classList.remove('active');

            this.start(); // Inicia Game Loop
        });
    }

    // Ativa o tremor de câmera (Screen Shake)
    triggerShake(magnitude = 10, duration = 0.2) {
        this.shakeMagnitude = magnitude;
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

        // Atualiza timer do Screen Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }
    }

    draw(ctx) {
        // Preenche fundo
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);

        // Aplica transformações de câmera (Screen Shake)
        ctx.save();
        if (this.shakeTimer > 0) {
            const dx = Utils.randomFloat(-this.shakeMagnitude, this.shakeMagnitude);
            const dy = Utils.randomFloat(-this.shakeMagnitude, this.shakeMagnitude);
            ctx.translate(dx, dy);
        }

        // Fundo da Arena (Um chão simples estilizado) + Renderização de Batalha
        if (this.state.screen === 'BATTLE') {
            ctx.fillStyle = '#1a1005';
            ctx.fillRect(0, this.height / 2 + 50, this.width, this.height);

            if (window.GFX) window.GFX.draw(ctx, this.width, this.height);
        }

        // Restaura câmera
        ctx.restore();
    }
}

// Inicia a Engine após o DOM ser carregado
window.addEventListener('DOMContentLoaded', () => {
    window.Engine = new GameEngine();
});
