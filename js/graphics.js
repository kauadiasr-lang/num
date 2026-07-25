/**
 * Motor Gráfico (Arena cinematográfica, gladiadores modulares, animação e VFX)
 *
 * Composição em camadas, sem nenhum asset de imagem — tudo desenhado
 * proceduralmente no Canvas 2D:
 *   céu/coliseu/plateia/tochas/poeira (fundo) -> gladiadores modulares
 *   (pernas/torso/braços/cabeça, equipamento lido de entity.equipment)
 *   -> partículas/textos/flashes de crítico (primeiro plano).
 */

class Particle {
    constructor(x, y, color, speed, size) {
        this.x = x;
        this.y = y;
        this.vx = Utils.randomFloat(-speed, speed);
        this.vy = Utils.randomFloat(-speed, speed);
        this.life = 1.0; // De 1.0 a 0.0
        this.decay = Utils.randomFloat(0.02, 0.05);
        this.color = color;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class FloatingText {
    constructor(x, y, text, color, isCrit) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -2; // Sobe
        this.size = isCrit ? 40 : 25;
        this.isCrit = isCrit;
    }
    update(dt) {
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px ${this.isCrit ? "Georgia, 'Times New Roman'," : ''} 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';

        // Contorno para legibilidade
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// Anel de impacto expansivo — usado em acertos críticos
class ImpactBurst {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
        this.decay = 0.055;
    }
    update(dt) { this.life -= this.decay; }
    draw(ctx) {
        const radius = (1 - this.life) * 46 + 4;
        ctx.globalAlpha = Math.max(0, this.life) * 0.85;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

class GraphicsEngine {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
        this.bursts = [];

        // Sangue é opcional e configurável — desligado por padrão (impactos
        // usam faíscas neutras em vez de partículas vermelhas de sangue).
        this.bloodEnabled = false;

        // Configurações aplicadas por settings.js (valores padrão até o
        // SettingsManager rodar applyAll() na inicialização)
        this.qualityLevel = 'alta';       // baixa | media | alta
        this.showFloatingDamage = true;
        this.animationSpeedMultiplier = 1;
        this.reduceEffects = false;

        // Estado de animação por combatente. Não é salvo no jogo (fica só em
        // memória), então nunca afeta o save/compatibilidade.
        this.playerAnim = { type: 'idle', start: 0, duration: 0 };
        this.enemyAnim = { type: 'idle', start: 0, duration: 0 };

        // Ambientação da arena (plateia, estrelas) — gerada uma vez e reaproveitada
        this.arenaTime = 'sunset';
        this._dustTimer = 0;
        this._birdTimer = 6;
        this._initArenaAmbience();
    }

    _initArenaAmbience() {
        this.crowd = [];
        for (let tier = 0; tier < 3; tier++) {
            const count = 22;
            for (let i = 0; i < count; i++) {
                this.crowd.push({
                    tier,
                    baseX: (i + Math.random() * 0.7) / count,
                    seed: Math.random() * Math.PI * 2
                });
            }
        }
        this._stars = Array.from({ length: 45 }, () => ({
            x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2
        }));
        this.birds = [];
    }

    // Chamado ao entrar no Menu Principal/Créditos: fixa o céu no entardecer
    // (a identidade visual pedida — "coliseu ao pôr do sol"), diferente da
    // batalha, que sorteia um horário dinâmico a cada luta.
    initMenuAmbience() {
        this.arenaTime = 'sunset';
        this.birds = [];
        this._birdTimer = Utils.randomFloat(2, 5);
    }

    // Chamado a cada nova batalha: sorteia o horário do céu (atmosfera "dinâmica")
    // e reseta as animações dos combatentes para o estado neutro.
    resetForNewBattle() {
        const times = ['dawn', 'day', 'sunset', 'night'];
        this.arenaTime = times[Utils.randomInt(0, times.length - 1)];
        this.playerAnim = { type: 'idle', start: performance.now(), duration: 0 };
        this.enemyAnim = { type: 'idle', start: performance.now(), duration: 0 };
        this.birds = [];
        this._birdTimer = Utils.randomFloat(3, 7);
        // Distância exibida (suavizada) começa já alinhada com a distância real da batalha
        this._displayDistance = (window.BattleEngine && typeof window.BattleEngine.distance === 'number') ? window.BattleEngine.distance : 5;
    }

    // Toca uma animação num dos dois combatentes (chamado a partir do battle.js
    // em pontos específicos, sem alterar em nada a lógica/matemática do combate).
    // A duração respeita a configuração de "Velocidade das animações" (padrão 1x).
    playAnim(isPlayer, type, duration = 650) {
        const anim = isPlayer ? this.playerAnim : this.enemyAnim;
        anim.type = type;
        anim.start = performance.now();
        anim.duration = duration / (this.animationSpeedMultiplier || 1);
    }

    spawnParticles(x, y, color, amount, speed = 5, size = 4) {
        // Sangue é opcional: se desligado, troca vermelho por faísca neutra dourada
        let useColor = color;
        if (!this.bloodEnabled && (color === '#cc0000' || color === '#8b0000')) {
            useColor = '#ffcf6b';
        }
        // "Reduzir efeitos visuais" corta a quantidade de partículas pela metade
        // (mantém o feedback visível, sem sobrecarregar aparelhos mais fracos)
        const finalAmount = this.reduceEffects ? Math.ceil(amount * 0.5) : amount;
        for (let i = 0; i < finalAmount; i++) {
            this.particles.push(new Particle(x, y, useColor, speed, size));
        }
    }

    spawnText(x, y, text, color, isCrit = false) {
        if (!this.showFloatingDamage) return;
        // Varia levemente a posição X para os números não sobreporem perfeitamente
        const offsetX = Utils.randomFloat(-20, 20);
        this.floatingTexts.push(new FloatingText(x + offsetX, y, text, color, isCrit));
    }

    // Flash de impacto crítico (anel dourado expansivo)
    spawnCritBurst(x, y, color = '#ffcc00') {
        this.bursts.push(new ImpactBurst(x, y, color));
    }

    // Posição X de um gladiador na arena. Reflete a distância tática real da
    // batalha (suavizada quadro a quadro): quanto maior window.BattleEngine.distance,
    // mais afastados os gladiadores aparecem — e vice-versa quando se aproximam.
    // Sempre escalada para caber em telas estreitas (mobile).
    getEntityX(isPlayer, canvasWidth) {
        const minOffset = Math.min(45, canvasWidth * 0.09);
        const maxOffset = Math.min(230, canvasWidth * 0.34);
        const dist = this._displayDistance !== undefined ? this._displayDistance : 5;
        const t = Utils.clamp(dist / 10, 0, 1);
        const offset = Utils.lerp(minOffset, maxOffset, t);
        return canvasWidth / 2 + (isPlayer ? -offset : offset);
    }

    update(dt) {
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        this.floatingTexts.forEach(t => t.update(dt));
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);

        this.bursts.forEach(b => b.update(dt));
        this.bursts = this.bursts.filter(b => b.life > 0);

        this._torchClock = (this._torchClock || 0) + dt;

        // A arena cinematográfica (céu, plateia, poeira, pássaros) é usada tanto
        // na batalha quanto de pano de fundo do Menu Principal e dos Créditos —
        // qualquer uma dessas telas mantém a ambientação viva.
        const isArenaBackdrop = window.Engine && ['BATTLE', 'MAINMENU', 'CREDITS'].includes(window.Engine.state.screen);

        if (isArenaBackdrop) {
            const isBattle = window.Engine.state.screen === 'BATTLE';

            // Suaviza a posição visual dos gladiadores em direção à distância real
            // da batalha (evita "teleporte" abrupto quando alguém se move)
            if (isBattle && window.BattleEngine && typeof window.BattleEngine.distance === 'number') {
                if (this._displayDistance === undefined) this._displayDistance = window.BattleEngine.distance;
                this._displayDistance = Utils.lerp(this._displayDistance, window.BattleEngine.distance, Math.min(1, dt * 4));
            }

            // Poeira ambiente, taxa baixa e limitada (mantém performance previsível).
            // Qualidade "baixa" corta esse detalhe decorativo por completo.
            const dustCap = this.qualityLevel === 'baixa' ? 0 : (this.qualityLevel === 'media' ? 35 : 70);
            this._dustTimer -= dt;
            if (dustCap > 0 && this._dustTimer <= 0 && this.particles.length < dustCap) {
                this._dustTimer = 0.18;
                this._spawnAmbientDust();
            }

            // Pássaros cruzando o céu ocasionalmente (também poupados em qualidade baixa)
            if (this.qualityLevel !== 'baixa') {
                this._birdTimer -= dt;
                if (this._birdTimer <= 0) {
                    this._birdTimer = Utils.randomFloat(7, 15);
                    this.birds.push({ x: -40, y: Utils.randomFloat(30, 130), speed: Utils.randomFloat(55, 95), wingPhase: 0 });
                }
                this.birds.forEach(b => { b.x += b.speed * dt; b.wingPhase += dt * 10; });
                if (window.Engine) this.birds = this.birds.filter(b => b.x < window.Engine.width + 50);
            }
        }
    }

    _spawnAmbientDust() {
        if (!window.Engine) return;
        const w = window.Engine.width;
        const h = window.Engine.height;
        const horizon = h * 0.62;
        const x = Utils.randomFloat(w * 0.15, w * 0.85);
        const y = Utils.randomFloat(horizon + 15, h - 15);
        const p = new Particle(x, y, 'rgba(205,182,140,0.3)', 4, Utils.randomFloat(1.5, 3));
        p.decay = 0.008;
        p.vy *= 0.15;
        this.particles.push(p);
    }

    draw(ctx, canvasWidth, canvasHeight) {
        const screen = window.Engine && window.Engine.state.screen;

        if (screen === 'BATTLE' && window.BattleEngine) {
            this.drawArenaBackground(ctx, canvasWidth, canvasHeight);

            // Os gladiadores precisam ficar sempre dentro da areia (abaixo do
            // horizonte do céu). Em janelas altas (tablets em pé, monitores
            // ultrawide verticais), canvasHeight/2 + 100 pode cair acima do
            // horizonte (h * 0.62) e fazer os lutadores "flutuarem" no céu —
            // por isso o resultado nunca fica mais alto que horizonte + margem.
            const horizon = canvasHeight * 0.62;
            const groundY = Math.max(canvasHeight / 2 + 100, horizon + 40);
            this.drawGladiator(ctx, this.getEntityX(true, canvasWidth), groundY, window.BattleEngine.player, true, this.playerAnim, window.BattleEngine.playerState);
            this.drawGladiator(ctx, this.getEntityX(false, canvasWidth), groundY, window.BattleEngine.enemy, false, this.enemyAnim, window.BattleEngine.enemyState);
        } else if (screen === 'MAINMENU' || screen === 'CREDITS') {
            // Mesma arena cinematográfica, sem gladiadores — pano de fundo do
            // Menu Principal e dos Créditos (entardecer, coliseu, plateia, poeira)
            this.drawArenaBackground(ctx, canvasWidth, canvasHeight);
            ctx.fillStyle = 'rgba(10,6,3,0.35)'; // véu escuro sutil pra dar contraste à UI por cima
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // VFX em primeiro plano
        this.bursts.forEach(b => b.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.floatingTexts.forEach(t => t.draw(ctx));
    }

    // ======================================================================
    // FUNDO DA ARENA: céu dinâmico, coliseu, plateia, bandeiras, tochas, areia
    // ======================================================================

    drawArenaBackground(ctx, w, h) {
        const palettes = {
            dawn: { top: '#2b3a67', mid: '#c96a4e', bottom: '#f2b866', sun: '#ffdca0', crowd: '#3a2f45', torch: true, sunAlpha: 0.75 },
            day: { top: '#3d7dc9', mid: '#79b8e8', bottom: '#cbe6f7', sun: '#fff6d8', crowd: '#5a4d3a', torch: false, sunAlpha: 0.9 },
            sunset: { top: '#1b1035', mid: '#8a3b5e', bottom: '#e8843f', sun: '#ffb35c', crowd: '#2c2030', torch: true, sunAlpha: 0.8 },
            night: { top: '#04050f', mid: '#0c1230', bottom: '#1c2140', sun: '#e8e8ff', crowd: '#0c0c14', torch: true, sunAlpha: 0.85 }
        };
        const pal = palettes[this.arenaTime] || palettes.sunset;
        const horizon = h * 0.62;
        const t = this._torchClock || 0;

        // Céu
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0, pal.top);
        skyGrad.addColorStop(0.6, pal.mid);
        skyGrad.addColorStop(1, pal.bottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);

        // Estrelas (só à noite)
        if (this.arenaTime === 'night') {
            ctx.fillStyle = '#ffffff';
            this._stars.forEach(s => {
                ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.phase);
                ctx.fillRect(s.x * w, s.y * horizon * 0.85, 2, 2);
            });
            ctx.globalAlpha = 1;
        }

        // Sol / lua (em telas estreitas, encolhe e recua para o canto para não
        // ficar atrás do menu/logo centralizado, que ocupa quase toda a largura)
        const narrow = w < 560;
        const sunScale = narrow ? 0.5 : 1;
        const sunX = narrow ? w * 0.91 : w * 0.82;
        const sunY = narrow ? horizon * 0.16 : horizon * 0.3;
        ctx.globalAlpha = pal.sunAlpha;
        ctx.fillStyle = pal.sun;
        ctx.beginPath();
        ctx.arc(sunX, sunY, (this.arenaTime === 'night' ? 24 : 38) * sunScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Pássaros
        ctx.strokeStyle = 'rgba(20,15,10,0.55)';
        ctx.lineWidth = 2;
        this.birds.forEach(b => {
            const flap = Math.sin(b.wingPhase) * 7;
            ctx.beginPath();
            ctx.moveTo(b.x - 9, b.y - flap);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x + 9, b.y - flap);
            ctx.stroke();
        });

        // Coliseu: bandas de arquibancada em camadas (silhueta com arcos romanos)
        this._drawColosseumRing(ctx, w, horizon, 0.62, '#4a4030');
        this._drawColosseumRing(ctx, w, horizon, 0.38, '#332a1e');

        // Plateia animada (detalhe decorativo, poupado em qualidade baixa)
        if (this.qualityLevel !== 'baixa') this._drawCrowd(ctx, w, horizon, pal.crowd);

        // Bandeiras balançando ao vento
        this._drawBanners(ctx, w, horizon, t);

        // Tochas com chama tremulante (aparecem à noite/entardecer/amanhecer)
        if (pal.torch) {
            this._drawTorch(ctx, w * 0.07, horizon, t);
            this._drawTorch(ctx, w * 0.93, horizon, t);
        }

        // Areia da arena
        const sandGrad = ctx.createLinearGradient(0, horizon, 0, h);
        sandGrad.addColorStop(0, '#7a5a34');
        sandGrad.addColorStop(1, '#3d2c18');
        ctx.fillStyle = sandGrad;
        ctx.fillRect(0, horizon, w, h - horizon);

        // Sombras suaves de ondulação na areia
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.ellipse(w * (0.08 + i * 0.22), horizon + 22 + i * 5, 70, 7, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawColosseumRing(ctx, w, horizon, heightFrac, color) {
        const bandHeight = horizon * heightFrac * 0.5;
        const y = horizon - bandHeight - (horizon * (heightFrac === 0.62 ? 0.05 : 0));
        ctx.fillStyle = color;
        ctx.fillRect(0, y, w, bandHeight + 4);

        // Arcos romanos repetidos ao longo da banda
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        const archWidth = 36;
        for (let x = archWidth / 2; x < w; x += archWidth) {
            ctx.beginPath();
            ctx.arc(x, y + bandHeight * 0.5, 11, Math.PI, 0);
            ctx.fill();
        }
    }

    _drawCrowd(ctx, w, horizon, baseColor) {
        const t = this._torchClock || 0;
        this.crowd.forEach(p => {
            const rowY = horizon - 40 - p.tier * 17;
            const bob = Math.sin(t * 2.5 + p.seed) * 2;
            const px = p.baseX * w;
            ctx.fillStyle = baseColor;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(px, rowY + bob, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(230,210,180,0.55)';
            ctx.beginPath();
            ctx.arc(px, rowY + bob - 3, 1.6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    _drawBanners(ctx, w, horizon, t) {
        const positions = [0.13, 0.36, 0.64, 0.87];
        positions.forEach((fx, i) => {
            const x = fx * w;
            const y = horizon - 78;
            const sway = Math.sin(t * 2 + i * 1.4) * 6;

            ctx.strokeStyle = '#2a2118';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x, y + 44);
            ctx.stroke();

            ctx.fillStyle = i % 2 === 0 ? '#7a1f1f' : '#8a5a2b';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 40);
            ctx.quadraticCurveTo(x + 15 + sway, y + 30, x + 3 + sway, y + 18);
            ctx.quadraticCurveTo(x + 15 + sway, y + 6, x, y);
            ctx.closePath();
            ctx.fill();
        });
    }

    _drawTorch(ctx, x, horizon, t) {
        const y = horizon - 6;
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(x - 4, y - 46, 8, 50);

        const flicker = Math.sin(t * 13) * 3 + Math.sin(t * 5.3) * 2;
        ctx.fillStyle = '#ff8a1e';
        ctx.beginPath();
        ctx.ellipse(x, y - 54 + flicker * 0.2, 9, 16 + flicker * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.ellipse(x, y - 52 + flicker * 0.2, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        if (Utils.chance(3) && this.particles.length < 70) {
            const ember = new Particle(x, y - 58, '#ffcf6b', 1.2, 2);
            ember.decay = 0.03;
            ember.vy = -Utils.randomFloat(0.5, 1.5);
            this.particles.push(ember);
        }
    }

    // ======================================================================
    // GLADIADOR MODULAR: pernas, torso, braços, cabeça — cada parte lida
    // o equipamento de `entity.equipment` automaticamente, então qualquer
    // item novo (identificado por slot) já aparece no personagem sem
    // precisar mexer neste arquivo.
    // ======================================================================

    computePose(anim, isDefending) {
        const now = performance.now();
        const t = anim.duration > 0 ? Utils.clamp((now - anim.start) / anim.duration, 0, 1) : 1;
        const idleT = now / 1000;

        const pose = {
            legSway: Math.sin(idleT * 1.2) * 2,
            torsoLean: Math.sin(idleT * 1.5) * 1.2,
            torsoScaleY: 1 + Math.sin(idleT * 1.5) * 0.015,
            weaponAngle: -8,
            offsetX: 0, // negativo = recua (longe do oponente), local, antes do espelhamento
            offsetY: 0,
            rotation: 0,
            alpha: 1
        };

        switch (anim.type) {
            case 'attack': {
                let swing;
                if (t < 0.35) swing = Utils.lerp(0, -55, t / 0.35);
                else if (t < 0.6) swing = Utils.lerp(-55, 60, (t - 0.35) / 0.25);
                else swing = Utils.lerp(60, 0, (t - 0.6) / 0.4);
                pose.weaponAngle += swing;
                pose.torsoLean += swing * 0.12;
                pose.offsetX = t < 0.6 ? Utils.lerp(0, 8, Math.min(1, t / 0.55)) : Utils.lerp(8, 0, (t - 0.6) / 0.4);
                break;
            }
            case 'hurt': {
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.offsetX = -12 * k;
                pose.torsoLean -= 14 * k;
                break;
            }
            case 'dodge': {
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.offsetX = -26 * k;
                pose.offsetY = -5 * k;
                break;
            }
            case 'death': {
                const k = Utils.clamp(t / 0.85, 0, 1);
                pose.rotation = 78 * k * (Math.PI / 180);
                pose.offsetY = 16 * k;
                pose.alpha = 1 - k * 0.2;
                break;
            }
            case 'victory': {
                const k = Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                pose.weaponAngle = -95 - k * 12;
                pose.offsetY = -k * 7;
                pose.victoryPose = true;
                break;
            }
            case 'approach': { // Aproximar: passo em direção ao oponente
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.legSway = Math.sin(idleT * 5) * 5;
                pose.offsetX = 6 * k;
                pose.torsoLean += 3 * k;
                break;
            }
            case 'retreat': { // Recuar: passo para trás, abrindo distância
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.legSway = Math.sin(idleT * 5) * 5;
                pose.offsetX = -8 * k;
                pose.torsoLean -= 3 * k;
                break;
            }
            case 'run': { // Correr: sprint vigoroso em direção ao oponente
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.legSway = Math.sin(idleT * 9) * 8;
                pose.offsetX = 10 * k;
                pose.torsoLean += 8 * k;
                break;
            }
            case 'charge': { // Investida: arrancada agressiva, corpo projetado à frente
                const k = Utils.clamp(t / 0.6, 0, 1);
                pose.legSway = Math.sin(idleT * 10) * 7;
                pose.offsetX = 14 * Math.sin(k * Math.PI);
                pose.torsoLean += 12;
                break;
            }
            case 'push': { // Empurrão: recuo curto ao resistir a uma aproximação inimiga
                const k = Math.sin(Math.min(t, 1) * Math.PI);
                pose.offsetX = -10 * k;
                pose.torsoLean -= 8 * k;
                break;
            }
            case 'cast': { // Conjuração: gesto de invocar magia/cura
                const k = Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                pose.weaponAngle = -30 - k * 25;
                pose.offsetY = -k * 4;
                break;
            }
            case 'walk': {
                // reservado para futura locomoção livre pelo mapa
                pose.legSway = Math.sin(idleT * 4) * 6;
                break;
            }
            default: break;
        }

        const exclusiveAnims = ['attack', 'hurt', 'death', 'approach', 'retreat', 'run', 'charge', 'push', 'cast'];
        pose.guard = !!isDefending && !exclusiveAnims.includes(anim.type);
        return pose;
    }

    drawGladiator(ctx, x, y, entity, isPlayer, anim, battleState) {
        const pose = this.computePose(anim, battleState && battleState.isDefending);
        const dir = isPlayer ? 1 : -1;

        // Sombra (fixa no chão, não acompanha os pequenos deslocamentos de pose)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + 8, 32, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = pose.alpha;
        ctx.translate(x, y + pose.offsetY);
        if (pose.rotation) ctx.rotate(pose.rotation);
        ctx.scale(dir, 1);
        ctx.translate(pose.offsetX, 0);

        this._drawLegs(ctx, entity, pose);
        this._drawTorso(ctx, entity, pose);
        this._drawBackArm(ctx, entity, pose);
        this._drawTorsoDetail(ctx, entity);
        this._drawHead(ctx, entity, pose);
        this._drawFrontArm(ctx, entity, pose);

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    _legLen() { return 58; }
    _torsoH() { return 62; }
    _torsoW() { return 34; }
    _headR() { return 20; }
    _armLen() { return 46; }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    _drawLegs(ctx, entity, pose) {
        const legLen = this._legLen();
        const boots = entity.equipment && entity.equipment[SLOTS.FEET];
        const legColor = '#4a3826';
        const sway = pose.legSway * 0.15;

        ctx.fillStyle = legColor;
        ctx.save();
        ctx.translate(-8, 0);
        ctx.rotate(sway * Math.PI / 180);
        ctx.fillRect(-6, -legLen, 11, legLen);
        ctx.restore();

        ctx.save();
        ctx.translate(8, 0);
        ctx.rotate(-sway * Math.PI / 180);
        ctx.fillRect(-5, -legLen, 11, legLen);
        ctx.restore();

        if (boots) {
            const bootColor = boots.rarity ? boots.rarity.color : '#8a5a2b';
            ctx.fillStyle = '#2c2318';
            ctx.fillRect(-14, -16, 12, 16);
            ctx.fillRect(2, -16, 12, 16);
            ctx.strokeStyle = bootColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(-14, -16, 12, 16);
            ctx.strokeRect(2, -16, 12, 16);
        }
    }

    _drawTorso(ctx, entity, pose) {
        const legLen = this._legLen();
        const torsoH = this._torsoH();
        const torsoW = this._torsoW();
        const chest = entity.equipment && entity.equipment[SLOTS.CHEST];
        const teamColor = entity.__teamColor || '#5a4632';

        let torsoColor = teamColor;
        let metallic = false;
        if (chest) {
            if (chest.id === 'a_03') { torsoColor = '#8891a0'; metallic = true; }
            else if (chest.id === 'a_02') { torsoColor = '#6b7280'; metallic = true; }
            else if (chest.id === 'a_01') { torsoColor = '#8a5a2b'; }
            else {
                const def = chest.defense || 0;
                torsoColor = def > 8 ? '#8891a0' : '#8a5a2b';
                metallic = def > 8;
            }
        }

        ctx.save();
        ctx.translate(0, -legLen);
        ctx.rotate(pose.torsoLean * Math.PI / 180 * 0.3);
        ctx.scale(1, pose.torsoScaleY);
        ctx.fillStyle = torsoColor;
        this._roundRect(ctx, -torsoW / 2, -torsoH, torsoW, torsoH, 6);
        ctx.fill();

        if (metallic) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-torsoW / 2 + 5, -torsoH + 6);
            ctx.lineTo(-torsoW / 2 + 5, -6);
            ctx.stroke();
        }

        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(-torsoW / 2, -12, torsoW, 6);
        ctx.restore();
    }

    // Amuleto/anel: um leve brilho no peito quando equipados (acessório visível)
    _drawTorsoDetail(ctx, entity) {
        const amulet = entity.equipment && entity.equipment[SLOTS.AMULET];
        if (!amulet) return;
        const legLen = this._legLen();
        const color = amulet.rarity ? amulet.rarity.color : '#d4af37';
        ctx.save();
        ctx.translate(0, -legLen - this._torsoH() + 18);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _headAnchorY() { return -this._legLen() - this._torsoH() - this._headR() + 6; }

    _drawHead(ctx, entity, pose) {
        const v = entity.visuals || {};
        const skin = v.skinTone || '#ffcc99';
        const headR = this._headR();
        const headY = this._headAnchorY();
        const helmet = entity.equipment && entity.equipment[SLOTS.HEAD];

        // Pescoço
        ctx.fillStyle = skin;
        ctx.fillRect(-6, -this._legLen() - this._torsoH() - 6, 12, 10);

        // Cabelo atrás da cabeça (só se não houver capacete)
        if (!helmet) this._drawHair(ctx, v, headY, headR, true);

        // Cabeça — o formato do rosto estica levemente a largura (redondo/oval/anguloso)
        const faceWidth = v.faceShape === 2 ? 0.86 : (v.faceShape === 3 ? 1.08 : 1);
        ctx.save();
        ctx.translate(0, headY);
        ctx.scale(faceWidth, 1);
        ctx.beginPath();
        ctx.arc(0, 0, headR, 0, Math.PI * 2);
        ctx.fillStyle = skin;
        ctx.fill();
        ctx.restore();

        // Sobrancelha e olho
        ctx.strokeStyle = v.eyebrowColor || v.hairColor || '#2a1c10';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, headY - 4);
        ctx.lineTo(13, headY - 6);
        ctx.stroke();

        ctx.fillStyle = v.eyeColor || '#1a1a1a';
        ctx.beginPath();
        ctx.arc(10, headY, 2, 0, Math.PI * 2);
        ctx.fill();

        if (!helmet) this._drawHair(ctx, v, headY, headR, false);
        this._drawFacialHair(ctx, v, headY);
        if (helmet) this._drawHelmet(ctx, helmet, headY, headR);
    }

    _drawHair(ctx, v, headY, headR, backLayer) {
        const style = v.hairStyle || 1;
        const color = v.hairColor || '#2a1c10';
        ctx.fillStyle = color;

        if (style === 1) {
            if (backLayer) return;
            ctx.beginPath();
            ctx.arc(0, headY - 4, headR - 1, Math.PI, Math.PI * 2);
            ctx.fill();
        } else if (style === 2) {
            if (!backLayer) return;
            ctx.fillRect(-headR + 1, headY - 8, 7, 30);
            ctx.fillRect(headR - 8, headY - 8, 7, 30);
            ctx.beginPath();
            ctx.arc(0, headY - 4, headR, Math.PI, Math.PI * 2);
            ctx.fill();
        } else {
            if (backLayer) return;
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            ctx.arc(0, headY - 6, headR - 3, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    _drawFacialHair(ctx, v, headY) {
        const beardStyle = v.beardStyle || 0;
        if (!beardStyle) return;
        const color = v.beardColor || v.hairColor || '#2a1c10';
        ctx.fillStyle = color;

        if (beardStyle === 1) { // bigode
            ctx.beginPath();
            ctx.ellipse(0, headY + 8, 8, 2.6, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (beardStyle === 2) { // cavanhaque
            ctx.beginPath();
            ctx.ellipse(0, headY + 8, 8, 2.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-6, headY + 7);
            ctx.quadraticCurveTo(0, headY + 19, 6, headY + 7);
            ctx.quadraticCurveTo(0, headY + 13, -6, headY + 7);
            ctx.fill();
        } else if (beardStyle === 3) { // barba cheia
            ctx.beginPath();
            ctx.arc(0, headY + 4, this._headR() - 2, 0, Math.PI);
            ctx.fill();
        }
    }

    _drawHelmet(ctx, item, headY, headR) {
        const crestColor = item.rarity ? item.rarity.color : '#d4af37';
        ctx.fillStyle = '#8891a0';
        ctx.beginPath();
        ctx.arc(0, headY - 4, headR + 2, Math.PI, Math.PI * 2.05);
        ctx.fill();
        ctx.fillRect(-headR - 2, headY - 4, 4, 15);
        ctx.fillRect(headR - 2, headY - 4, 4, 15);

        ctx.fillStyle = crestColor;
        ctx.beginPath();
        ctx.moveTo(0, headY - headR - 10);
        ctx.lineTo(-4, headY - 2);
        ctx.lineTo(4, headY - 2);
        ctx.closePath();
        ctx.fill();
    }

    // Braço de trás: escudo (se houver) — desenhado antes da cabeça pra ficar atrás do corpo
    _drawBackArm(ctx, entity, pose) {
        const shoulderY = -this._legLen() - this._torsoH() + 10;
        const skin = (entity.visuals && entity.visuals.skinTone) || '#ffcc99';
        const gloves = entity.equipment && entity.equipment[SLOTS.HANDS];
        const armColor = gloves ? '#3a2f22' : skin;
        const shield = entity.equipment && entity.equipment[SLOTS.OFF_HAND];
        const angle = pose.guard ? -110 : -75;

        ctx.save();
        ctx.translate(-this._torsoW() / 2 + 3, shoulderY);
        ctx.rotate(angle * Math.PI / 180);
        ctx.fillStyle = armColor;
        ctx.fillRect(-4, 0, 8, this._armLen() * 0.7);
        ctx.restore();

        if (shield) {
            const shieldColor = shield.rarity ? shield.rarity.color : '#8a5a2b';
            const sx = pose.guard ? -this._torsoW() / 2 - 14 : -this._torsoW() / 2 - 4;
            const sy = pose.guard ? shoulderY + 2 : shoulderY + 22;
            ctx.save();
            ctx.fillStyle = '#5a4632';
            ctx.strokeStyle = shieldColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 12, 17, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = shieldColor;
            ctx.fill();
            ctx.restore();
        }
    }

    // Braço da frente: sempre a arma equipada (ou punho nu)
    _drawFrontArm(ctx, entity, pose) {
        const shoulderY = -this._legLen() - this._torsoH() + 10;
        const skin = (entity.visuals && entity.visuals.skinTone) || '#ffcc99';
        const gloves = entity.equipment && entity.equipment[SLOTS.HANDS];
        const armColor = gloves ? '#3a2f22' : skin;

        ctx.save();
        ctx.translate(this._torsoW() / 2 - 3, shoulderY);
        ctx.rotate(pose.weaponAngle * Math.PI / 180);
        ctx.fillStyle = armColor;
        ctx.fillRect(-4, 0, 8, this._armLen());
        ctx.translate(0, this._armLen());
        this._drawWeapon(ctx, entity.equipment && entity.equipment[SLOTS.MAIN_HAND]);
        ctx.restore();
    }

    _drawWeapon(ctx, weapon) {
        if (!weapon) {
            ctx.fillStyle = '#c99a6b';
            ctx.beginPath();
            ctx.arc(4, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(0, -4, 12, 8);
        ctx.fillStyle = '#c7ccd1';

        switch (weapon.id) {
            case 'w_02': // Machado
                ctx.beginPath();
                ctx.moveTo(12, -4); ctx.lineTo(34, -17); ctx.lineTo(39, 0); ctx.lineTo(34, 17); ctx.lineTo(12, 4);
                ctx.closePath(); ctx.fill();
                break;
            case 'w_03': // Adaga
                ctx.beginPath();
                ctx.moveTo(12, -3); ctx.lineTo(27, 0); ctx.lineTo(12, 3);
                ctx.closePath(); ctx.fill();
                break;
            case 'w_04': // Martelo de Guerra
                ctx.fillRect(12, -11, 27, 22);
                ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 1; ctx.strokeRect(12, -11, 27, 22);
                break;
            case 'w_05': // Lança
                ctx.fillRect(12, -2, 52, 4);
                ctx.beginPath();
                ctx.moveTo(64, -6); ctx.lineTo(76, 0); ctx.lineTo(64, 6);
                ctx.closePath(); ctx.fill();
                break;
            case 'w_06': // Rapieira
                ctx.fillRect(12, -1.5, 46, 3);
                ctx.strokeStyle = '#c7ccd1'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.stroke();
                break;
            case 'w_07': // Espada Longa: lâmina mais comprida e larga que a curta
                ctx.fillRect(12, -3.5, 54, 7);
                ctx.fillStyle = '#3a2f22';
                ctx.fillRect(10, -9, 4, 18);
                break;
            case 'w_08': // Chicote: tira fina e ondulada saindo do cabo
                ctx.strokeStyle = '#4a3826'; ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(12, 0);
                ctx.quadraticCurveTo(30, -14, 46, 2);
                ctx.quadraticCurveTo(58, 12, 50, 22);
                ctx.stroke();
                break;
            case 'w_09': // Arco Curto: arco recurvo com corda, empunhado verticalmente
                ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(6, 0, 22, -Math.PI * 0.42, Math.PI * 0.42);
                ctx.stroke();
                ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -18.5); ctx.lineTo(20, 18.5);
                ctx.stroke();
                break;
            case 'w_10': // Besta de Aço: estrutura (trilho) + arco curto horizontal
                ctx.fillRect(8, -2.5, 34, 5);
                ctx.strokeStyle = '#8891a0'; ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(16, 0, 16, Math.PI * 0.15, Math.PI * 1.85);
                ctx.stroke();
                ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(24, -14); ctx.lineTo(24, 14);
                ctx.stroke();
                break;
            default: // w_01 e qualquer arma futura não mapeada: espada genérica
                ctx.fillRect(12, -3, 40, 6);
                ctx.fillStyle = '#3a2f22';
                ctx.fillRect(10, -8, 4, 16);
                break;
        }
    }
}

window.GFX = new GraphicsEngine();
