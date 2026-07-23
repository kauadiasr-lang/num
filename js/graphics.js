/**
 * Motor Gráfico (VFX, Partículas, Textos Flutuantes e Renderização Geométrica)
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
        ctx.font = `bold ${this.size}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';

        // Contorno para legibilidade
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class GraphicsEngine {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
    }

    spawnParticles(x, y, color, amount, speed = 5, size = 4) {
        for (let i = 0; i < amount; i++) {
            this.particles.push(new Particle(x, y, color, speed, size));
        }
    }

    spawnText(x, y, text, color, isCrit = false) {
        // Varia levemente a posição X para os números não sobreporem perfeitamente
        const offsetX = Utils.randomFloat(-20, 20);
        this.floatingTexts.push(new FloatingText(x + offsetX, y, text, color, isCrit));
    }

    // Posição X de um gladiador na arena, escalada para caber em telas estreitas (mobile)
    getEntityX(isPlayer, canvasWidth) {
        const offset = Math.min(200, canvasWidth * 0.28);
        return canvasWidth / 2 + (isPlayer ? -offset : offset);
    }

    update(dt) {
        // Atualiza e remove partículas/textos mortos
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        this.floatingTexts.forEach(t => t.update(dt));
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
    }

    draw(ctx, canvasWidth, canvasHeight) {
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;

        // Se estivermos em batalha, desenha os gladiadores
        if (window.Engine && window.Engine.state.screen === 'BATTLE' && window.BattleEngine) {
            this.drawGladiator(ctx, this.getEntityX(true, canvasWidth), cy + 100, window.BattleEngine.player, true);
            this.drawGladiator(ctx, this.getEntityX(false, canvasWidth), cy + 100, window.BattleEngine.enemy, false);
        }

        // Desenha VFX por cima de tudo
        this.particles.forEach(p => p.draw(ctx));
        this.floatingTexts.forEach(t => t.draw(ctx));
    }

    // Desenha um personagem estilizado com formas geométricas
    drawGladiator(ctx, x, y, entity, isPlayer) {
        const direction = isPlayer ? 1 : -1; // 1 = olha pra direita, -1 = olha pra esquerda

        // Sombras
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y + 10, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corpo Base (Cores variam se é player ou inimigo)
        ctx.fillStyle = isPlayer ? '#2255ff' : '#aa2222';
        ctx.fillRect(x - 20, y - 80, 40, 60); // Tronco

        // Cabeça
        ctx.fillStyle = entity.visuals ? entity.visuals.skinTone : '#ffcc99';
        ctx.beginPath();
        ctx.arc(x, y - 100, 25, 0, Math.PI * 2);
        ctx.fill();

        // Olhos agressivos
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(x + (10 * direction), y - 110);
        ctx.lineTo(x + (20 * direction), y - 105);
        ctx.lineTo(x + (10 * direction), y - 100);
        ctx.fill();

        // Arma (Mão principal)
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x + (30 * direction), y - 60, 50 * direction, 10); // Espada/Lâmina
        ctx.fillStyle = '#553311';
        ctx.fillRect(x + (20 * direction), y - 65, 10 * direction, 20); // Guarda

        // Indicador de Defesa (Escudo mágico azulado se estiver defendendo)
        let isDefending = false;
        if (window.BattleEngine) {
            isDefending = isPlayer ? window.BattleEngine.playerState.isDefending : window.BattleEngine.enemyState.isDefending;
        }

        if (isDefending) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(x, y - 50, 90, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

window.GFX = new GraphicsEngine();
