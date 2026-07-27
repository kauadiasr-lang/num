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
        // *60 porque vx/vy/decay foram calibrados assumindo ~60 chamadas por
        // segundo (dt≈1/60) — sem isso, a partícula andava/sumia por chamada
        // em vez de por tempo real, ficando mais rápida em telas de alta
        // taxa de atualização e mais lenta quando o jogo engasga.
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.life -= this.decay * dt * 60;
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
        // Mesma correção das partículas: velocidade/decaimento por segundo,
        // não por quadro (ver comentário em Particle.update).
        this.y += this.vy * dt * 60;
        this.life -= 0.02 * dt * 60;
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
    update(dt) { this.life -= this.decay * dt * 60; } // ver comentário em Particle.update
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

// ==========================================================================
// ARQUÉTIPOS DE LUTADOR: identidade visual (silhueta/proporções + paleta de
// destaque + adereço assinatura), independente de atributos/equipamento —
// dois personagens com o mesmo equipamento ainda parecem lutadores
// diferentes. Usado pelo criador de personagem (ui.js) e pela geração de
// inimigos/rivais (enemy.js), então fica exposto em window.
// ==========================================================================
const FIGHTER_ARCHETYPES = {
    veterano: { name: 'Gladiador Veterano', build: { shoulder: 1.05, waist: 1.0, limb: 1.04 }, accent: '#9c7a4e' },
    barbaro: { name: 'Bárbaro', build: { shoulder: 1.24, waist: 1.12, limb: 1.2 }, accent: '#6b4226' },
    cavaleiro: { name: 'Cavaleiro', build: { shoulder: 1.1, waist: 0.95, limb: 1.0 }, accent: '#3d5a80' },
    assassino: { name: 'Assassino', build: { shoulder: 0.9, waist: 0.84, limb: 0.9 }, accent: '#2a2a2a' },
    guerreira: { name: 'Guerreira', build: { shoulder: 0.95, waist: 0.8, limb: 0.95 }, accent: '#a13d4c' },
    mercenario: { name: 'Mercenário', build: { shoulder: 1.0, waist: 1.0, limb: 1.0 }, accent: '#7a7a4a' },
    campeao: { name: 'Campeão', build: { shoulder: 1.16, waist: 0.9, limb: 1.05 }, accent: '#d4af37' }
};
window.FIGHTER_ARCHETYPES = FIGHTER_ARCHETYPES;

// Estilos de cicatriz (índice = visuals.scarStyle, 0 = nenhuma)
const SCAR_STYLES = ['none', 'cheek', 'brow', 'forehead', 'jaw'];
window.SCAR_STYLES = SCAR_STYLES;

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
        // Progresso contínuo (0..1) do ciclo dia/noite da Cidade — usado só
        // pelo céu da Cidade pra o sol/lua se moverem em arco de verdade ao
        // longo do tempo, em vez de pular de posição a cada troca de fase.
        // A Arena de combate continua com o céu estático por luta (this.arenaTime).
        this.cityDayProgress = 0.5;
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

        // Entrada na arena: os dois lutadores "chegam" de fora da tela e a
        // câmera dá um leve zoom-in que relaxa até o enquadramento normal —
        // uma apresentação antes da luta, em vez de um corte direto pro idle.
        this._entrance = { start: performance.now(), duration: 950 };
        this.playAnim(true, 'prepare', 900);
        this.playAnim(false, 'prepare', 900);
    }

    // 0 (início da entrada) .. 1 (entrada concluída, enquadramento normal).
    // Usa easing "ease-out" (1-(1-t)^3) pra desacelerar suavemente no final.
    _entranceProgress() {
        if (!this._entrance) return 1;
        const raw = Utils.clamp((performance.now() - this._entrance.start) / this._entrance.duration, 0, 1);
        if (raw >= 1) this._entrance = null;
        return 1 - Math.pow(1 - raw, 3);
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
        // na batalha quanto de pano de fundo do Menu Principal, dos Créditos e
        // da Cidade explorável — qualquer uma dessas telas mantém a ambientação viva.
        const isArenaBackdrop = window.Engine && ['BATTLE', 'MAINMENU', 'CREDITS', 'HUB'].includes(window.Engine.state.screen);

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

            // Entrada na arena: câmera com leve zoom-in relaxando ao normal,
            // e os lutadores "andando" pra dentro da cena a partir de fora
            // da tela — só cosmético, não afeta a distância tática real.
            const entranceT = this._entranceProgress();
            const zoom = Utils.lerp(1.12, 1, entranceT);
            const walkIn = Utils.lerp(140, 0, entranceT);
            ctx.save();
            ctx.translate(canvasWidth / 2, groundY);
            ctx.scale(zoom, zoom);
            ctx.translate(-canvasWidth / 2, -groundY);

            this.drawGladiator(ctx, this.getEntityX(true, canvasWidth) - walkIn, groundY, window.BattleEngine.player, true, this.playerAnim, window.BattleEngine.playerState);
            this.drawGladiator(ctx, this.getEntityX(false, canvasWidth) + walkIn, groundY, window.BattleEngine.enemy, false, this.enemyAnim, window.BattleEngine.enemyState);
            ctx.restore();
        } else if (screen === 'MAINMENU' || screen === 'CREDITS') {
            // Mesma arena cinematográfica, sem gladiadores — pano de fundo do
            // Menu Principal e dos Créditos (entardecer, coliseu, plateia, poeira)
            this.drawArenaBackground(ctx, canvasWidth, canvasHeight);
            ctx.fillStyle = 'rgba(10,6,3,0.35)'; // véu escuro sutil pra dar contraste à UI por cima
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        } else if (screen === 'HUB') {
            // A Cidade explorável tem seu próprio cenário — montanhas ao
            // longe, não o coliseu (esse fica só para a arena de combate).
            // Reaproveita o mesmo céu/sol/lua/pássaros e ciclo dia-noite;
            // CityEngine.draw desenha a praça, os prédios, NPCs e o jogador
            // por cima disso.
            this.drawCityBackdrop(ctx, canvasWidth, canvasHeight);
            if (window.City) window.City.draw(ctx, canvasWidth, canvasHeight);
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

        this._drawSky(ctx, w, h, horizon, pal, t);

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

    // Céu (gradiente por horário, estrelas à noite, sol/lua, pássaros) —
    // compartilhado entre a arena de combate e a Cidade explorável, que têm
    // o mesmo ciclo dia/noite mas cenários diferentes por trás dele.
    //
    // dayProgress (0..1, só usado pela Cidade) faz o sol/lua se moverem em
    // arco de verdade ao longo do tempo — nascendo, subindo, se pondo atrás
    // das montanhas (ocultado pelo desenho delas, por cima do céu) — em vez
    // de pular de posição a cada troca de fase. A Arena de combate (dayProgress
    // null) mantém o céu estático de sempre, sorteado uma vez por luta.
    _drawSky(ctx, w, h, horizon, pal, t, dayProgress = null) {
        if (dayProgress !== null) pal = this._blendCityPalette(dayProgress);

        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0, pal.top);
        skyGrad.addColorStop(0.6, pal.mid);
        skyGrad.addColorStop(1, pal.bottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);

        const starAlpha = dayProgress !== null ? this._cityNightFactor(dayProgress) : (this.arenaTime === 'night' ? 1 : 0);
        if (starAlpha > 0) {
            ctx.fillStyle = '#ffffff';
            this._stars.forEach(s => {
                ctx.globalAlpha = starAlpha * (0.35 + 0.35 * Math.sin(t * 2 + s.phase));
                ctx.fillRect(s.x * w, s.y * horizon * 0.85, 2, 2);
            });
            ctx.globalAlpha = 1;
        }

        const narrow = w < 560;
        if (dayProgress !== null) {
            this._drawCelestialArc(ctx, w, horizon, dayProgress, narrow);
        } else {
            // Sol / lua estático por fase (em telas estreitas, encolhe e recua
            // para o canto para não ficar atrás do menu/logo centralizado).
            const sunScale = narrow ? 0.5 : 1;
            const sunX = narrow ? w * 0.91 : w * 0.82;
            const sunY = narrow ? horizon * 0.16 : horizon * 0.3;
            ctx.globalAlpha = pal.sunAlpha;
            ctx.fillStyle = pal.sun;
            ctx.beginPath();
            ctx.arc(sunX, sunY, (this.arenaTime === 'night' ? 24 : 38) * sunScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

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
    }

    // As 4 paletas nomeadas (dawn/day/sunset/night) usadas tanto pela Arena
    // (fixa por luta) quanto como referência pra interpolação contínua da Cidade.
    _cityPalettes() {
        return {
            dawn: { top: '#2b3a67', mid: '#c96a4e', bottom: '#f2b866', sun: '#ffdca0', sunAlpha: 0.75 },
            day: { top: '#3d7dc9', mid: '#79b8e8', bottom: '#cbe6f7', sun: '#fff6d8', sunAlpha: 0.9 },
            sunset: { top: '#1b1035', mid: '#8a3b5e', bottom: '#e8843f', sun: '#ffb35c', sunAlpha: 0.8 },
            night: { top: '#04050f', mid: '#0c1230', bottom: '#1c2140', sun: '#e8e8ff', sunAlpha: 0.85 }
        };
    }

    _lerpHex(hex0, hex1, f) {
        const a = parseInt(hex0.slice(1), 16), b = parseInt(hex1.slice(1), 16);
        const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        const r = Math.round(ar + (br - ar) * f), g = Math.round(ag + (bg - ag) * f), bl = Math.round(ab + (bb - ab) * f);
        return `rgb(${r},${g},${bl})`;
    }

    // Mistura suavemente as duas paletas nomeadas vizinhas conforme o
    // progresso contínuo do dia — evita o "salto" brusco de cor toda vez que
    // a Cidade troca de fase (dawn→day→sunset→night→dawn...).
    _blendCityPalette(progress) {
        const order = ['dawn', 'day', 'sunset', 'night'];
        const palettes = this._cityPalettes();
        const scaled = Utils.clamp(progress, 0, 0.999999) * order.length;
        const i0 = Math.floor(scaled) % order.length;
        const i1 = (i0 + 1) % order.length;
        const f = scaled - Math.floor(scaled);
        const p0 = palettes[order[i0]], p1 = palettes[order[i1]];
        return {
            top: this._lerpHex(p0.top, p1.top, f),
            mid: this._lerpHex(p0.mid, p1.mid, f),
            bottom: this._lerpHex(p0.bottom, p1.bottom, f),
            sunAlpha: Utils.lerp(p0.sunAlpha, p1.sunAlpha, f)
        };
    }

    // 0..1 — quão "noturno" o céu está agora (usado pro brilho das estrelas).
    // Sobe suavemente entrando na fase de noite e desce saindo dela, em vez
    // de ligar/desligar de uma vez.
    _cityNightFactor(progress) {
        const nightStart = 0.75, fade = 0.05;
        if (progress < nightStart - fade) return 0;
        if (progress < nightStart) return (progress - (nightStart - fade)) / fade;
        if (progress < 1 - fade) return 1;
        return Utils.clamp(1 - (progress - (1 - fade)) / fade, 0, 1);
    }

    // Sol (3/4 iniciais do ciclo: dawn+day+sunset) e lua (1/4 final: night) em
    // arco contínuo — nascem numa ponta do céu, sobem até o topo do arco e se
    // põem na outra ponta. Perto do horizonte, as montanhas (desenhadas depois,
    // por cima) escondem o astro naturalmente, sem precisar recortar nada aqui.
    _drawCelestialArc(ctx, w, horizon, progress, narrow) {
        const dayFrac = 0.75;
        let angle, isSun;
        if (progress < dayFrac) {
            angle = (progress / dayFrac) * Math.PI;
            isSun = true;
        } else {
            angle = ((progress - dayFrac) / (1 - dayFrac)) * Math.PI;
            isSun = false;
        }
        const marginX = w * (narrow ? 0.14 : 0.08);
        const arcW = w - marginX * 2;
        const x = marginX + arcW * (angle / Math.PI);
        const peakHeight = horizon * 0.72;
        const y = horizon * 0.94 - Math.sin(angle) * peakHeight;

        const sizeMul = narrow ? 0.55 : 1;
        const r = (isSun ? 36 : 22) * sizeMul;
        // Fade suave nascendo/se pondo (perto das pontas do arco), além da
        // oclusão natural das montanhas — evita o disco aparecer "cortado" (pop)
        // assim que entra na tela.
        const edgeFade = Utils.clamp(Math.sin(angle) * 5, 0, 1);
        const pal = this._cityPalettes();
        ctx.globalAlpha = (isSun ? pal.day.sunAlpha : pal.night.sunAlpha) * edgeFade;
        ctx.fillStyle = isSun ? '#fff2c8' : '#e8e8ff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Pano de fundo da Cidade explorável: mesmo céu/sol/lua/estrelas/pássaros
    // e ciclo dia-noite da arena, mas com montanhas distantes no lugar do
    // coliseu — a praça é um lugar diferente da arena de combate, não o
    // mesmo coliseu por trás (CityEngine desenha a praça/prédios por cima).
    drawCityBackdrop(ctx, w, h) {
        const horizon = h * 0.62;
        const t = this._torchClock || 0;

        this._drawSky(ctx, w, h, horizon, null, t, this.cityDayProgress);
        this._drawMountains(ctx, w, horizon);
    }

    // Duas cadeias de montanhas em profundidade (mais clara/suave ao fundo,
    // mais escura/nítida na frente) — silhuetas simples, no mesmo estilo
    // "chapado" já usado no coliseu/plateia, sem exigir nenhum recurso novo.
    _drawMountains(ctx, w, horizon) {
        this._drawMountainRange(ctx, w, horizon, horizon * 0.32, 'rgba(70,64,86,0.5)', 6, 0.4);
        this._drawMountainRange(ctx, w, horizon, horizon * 0.44, 'rgba(42,38,54,0.85)', 5, 2.1);
    }

    _drawMountainRange(ctx, w, horizon, peakHeight, color, count, phase) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        const step = w / count;
        for (let i = 0; i <= count; i++) {
            const x = i * step;
            const y = horizon - peakHeight * (0.4 + 0.6 * Math.abs(Math.sin(i * 2.3 + phase)));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, horizon);
        ctx.closePath();
        ctx.fill();
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

    // sizeMul encolhe a chama mantendo o cabo apoiado no mesmo ponto (base em
    // y+4) — usado pelas tochas menores dos prédios da Cidade, que antes
    // usavam a chama no mesmo tamanho da arena e ficavam poluindo a cena.
    _drawTorch(ctx, x, horizon, t, sizeMul = 1) {
        const y = horizon - 6;
        const poleW = 8 * sizeMul, poleH = 50 * sizeMul;
        const poleTop = y + 4 - poleH;
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(x - poleW / 2, poleTop, poleW, poleH);

        const flicker = Math.sin(t * 13) * 3 + Math.sin(t * 5.3) * 2;
        ctx.fillStyle = '#ff8a1e';
        ctx.beginPath();
        ctx.ellipse(x, poleTop - 8 * sizeMul + flicker * 0.2 * sizeMul, 9 * sizeMul, (16 + flicker * 0.5) * sizeMul, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.ellipse(x, poleTop - 6 * sizeMul + flicker * 0.2 * sizeMul, 5 * sizeMul, 9 * sizeMul, 0, 0, Math.PI * 2);
        ctx.fill();

        if (Utils.chance(3) && this.particles.length < 70) {
            const ember = new Particle(x, poleTop - 12 * sizeMul, '#ffcf6b', 1.2 * sizeMul, 2);
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
            alpha: 1,
            animType: anim.type // usado pela expressão facial (_drawMouth) pra reagir ao momento da luta
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
            case 'prepare': { // Entrada na arena: flourish erguendo a arma antes da postura de combate.
                // Curva senoidal (sobe e volta à linha de base) igual a
                // hurt/dodge/victory — assim a pose sempre termina neutra em
                // t=1 sem precisar de nenhum reset explícito depois.
                const k = Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                pose.weaponAngle -= 26 * k;
                pose.torsoLean -= 2 * k;
                pose.offsetY = -3 * k;
                break;
            }
            case 'walk': {
                // Passada de verdade (usado ao caminhar livremente pela Cidade,
                // jogador e NPCs): pernas alternando bem mais largo que o balanço
                // sutil do idle, um pequeno solavanco vertical a cada passo
                // (dobro da frequência da passada — um "salto" por pé que toca
                // o chão) e leve balanço do tronco acompanhando o peso.
                const strideT = idleT * 7;
                pose.legSway = Math.sin(strideT) * 16;
                pose.offsetY = -Math.abs(Math.sin(strideT)) * 3;
                pose.torsoLean += Math.sin(strideT) * 2;
                break;
            }
            default: break;
        }

        const exclusiveAnims = ['attack', 'hurt', 'death', 'approach', 'retreat', 'run', 'charge', 'push', 'cast', 'prepare'];
        pose.guard = !!isDefending && !exclusiveAnims.includes(anim.type);
        return pose;
    }

    drawGladiator(ctx, x, y, entity, isPlayer, anim, battleState) {
        const pose = this.computePose(anim, battleState && battleState.isDefending);
        const dir = isPlayer ? 1 : -1;

        // Sombra com gradiente suave (em vez de uma elipse chapada de opacidade
        // única) — dá uma sensação de contato com o chão bem mais natural.
        const shadowGrad = ctx.createRadialGradient(x, y + 8, 2, x, y + 8, 34);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 8, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = pose.alpha;
        ctx.translate(x, y + pose.offsetY);
        if (pose.rotation) ctx.rotate(pose.rotation);
        ctx.scale(dir, 1);
        ctx.translate(pose.offsetX, 0);

        this._drawCape(ctx, entity, pose); // capa/manto (arquétipos com adereço nas costas) — atrás de tudo
        this._drawLegs(ctx, entity, pose);
        this._drawTorso(ctx, entity, pose);
        this._drawBackArm(ctx, entity, pose);
        this._drawTorsoDetail(ctx, entity);
        this._drawHead(ctx, entity, pose);
        this._drawFrontArm(ctx, entity, pose, anim);

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    _legLen() { return 58; }
    _torsoH() { return 62; }
    _headR() { return 20; }
    _armLen() { return 46; }

    // Arquétipo visual do lutador (identidade independente do equipamento —
    // ver FIGHTER_ARCHETYPES no topo do arquivo). Some lutadores antigos
    // (salvos antes deste sistema existir) podem não ter o campo: cai em
    // "veterano" como padrão neutro.
    _archetype(entity) {
        const id = entity && entity.visuals && entity.visuals.archetype;
        return FIGHTER_ARCHETYPES[id] || FIGHTER_ARCHETYPES.veterano;
    }

    // Medidas do corpo (ombro/cintura/quadril/espessura de braço e perna),
    // combinando gênero (silhueta) x arquétipo (build) — é isso que faz dois
    // lutadores com o mesmo equipamento parecerem fisicamente diferentes.
    _bodyMetrics(entity) {
        const arch = this._archetype(entity);
        const isFem = entity && entity.visuals && entity.visuals.gender === 'Feminino';
        const shoulderBase = isFem ? 30 : 34;
        const waistFrac = isFem ? 0.58 : 0.78;
        const limbMul = arch.build.limb * (isFem ? 0.92 : 1);
        return {
            shoulder: shoulderBase * arch.build.shoulder,
            waist: shoulderBase * waistFrac * arch.build.waist,
            hip: shoulderBase * (isFem ? 0.72 : 0.62) * arch.build.waist,
            ankle: 8 * limbMul,
            armShoulder: 9 * limbMul,
            armWrist: 6.5 * limbMul
        };
    }

    // Mantido por compatibilidade com o restante do arquivo — agora deriva
    // da mesma métrica de corpo (ombro) usada pelo torso afunilado.
    _torsoW(entity) {
        return this._bodyMetrics(entity).shoulder;
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Quadrilátero afunilado entre duas alturas locais (y0->y1) com larguras
    // diferentes em cada ponta — substitui os retângulos "de bloco" antigos
    // de braços/pernas por membros com silhueta humana de verdade.
    _drawTaperedLimb(ctx, x0, y0, y1, wStart, wEnd) {
        ctx.beginPath();
        ctx.moveTo(x0 - wStart / 2, y0);
        ctx.lineTo(x0 + wStart / 2, y0);
        ctx.lineTo(x0 + wEnd / 2, y1);
        ctx.lineTo(x0 - wEnd / 2, y1);
        ctx.closePath();
        ctx.fill();
    }

    // Capa/manto atrás dos ombros — só alguns arquétipos têm (Campeão: capa
    // ampla e dourada; Cavaleiro: capa curta de nobreza); balança levemente
    // com o idle, sem depender de nenhum equipamento específico.
    _drawCape(ctx, entity, pose) {
        const archId = entity && entity.visuals && entity.visuals.archetype;
        if (archId !== 'campeao' && archId !== 'cavaleiro') return;
        const arch = this._archetype(entity);
        const big = archId === 'campeao';
        const legLen = this._legLen();
        const m = this._bodyMetrics(entity);
        const topY = -legLen - this._torsoH() + 6;
        const sway = Math.sin(performance.now() / 900) * (big ? 4 : 2);

        ctx.save();
        ctx.translate(-m.shoulder * 0.3, topY);
        ctx.fillStyle = arch.accent;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(-m.shoulder * 0.35, -4);
        ctx.lineTo(m.shoulder * 0.35, -4);
        ctx.quadraticCurveTo(m.shoulder * 0.5 + sway, legLen * (big ? 0.75 : 0.4), m.shoulder * 0.25 + sway, legLen * (big ? 0.95 : 0.5));
        ctx.lineTo(-m.shoulder * 0.25 + sway, legLen * (big ? 0.95 : 0.5));
        ctx.quadraticCurveTo(-m.shoulder * 0.5 + sway, legLen * (big ? 0.75 : 0.4), -m.shoulder * 0.35, -4);
        ctx.closePath();
        ctx.fill();
        if (big) {
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-m.shoulder * 0.35, -4);
            ctx.lineTo(-m.shoulder * 0.25 + sway, legLen * 0.9);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _drawLegs(ctx, entity, pose) {
        const legLen = this._legLen();
        const boots = entity.equipment && entity.equipment[SLOTS.FEET];
        const m = this._bodyMetrics(entity);
        const legColor = '#4a3826';
        const sway = pose.legSway * 0.15;
        const hipW = m.ankle * 1.7, ankleW = m.ankle;

        ctx.fillStyle = legColor;
        ctx.save();
        ctx.translate(-8, 0);
        ctx.rotate(sway * Math.PI / 180);
        this._drawTaperedLimb(ctx, 0, -legLen, 0, hipW, ankleW);
        // linha de sombra interna simples pra sugerir volume, sem exigir gradiente por perna
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hipW * 0.15, -legLen + 4); ctx.lineTo(ankleW * 0.15, -4); ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(8, 0);
        ctx.rotate(-sway * Math.PI / 180);
        this._drawTaperedLimb(ctx, 0, -legLen, 0, hipW, ankleW);
        ctx.restore();

        // Arquétipo: tiras/enfaixamento nas pernas (Bárbaro: peles no topo da
        // coxa; Assassino: correias de utilidade na coxa) — puramente estético.
        const archId = entity.visuals && entity.visuals.archetype;
        if (archId === 'barbaro') {
            const arch = this._archetype(entity);
            ctx.fillStyle = arch.accent;
            ctx.fillRect(-8 - hipW / 2 - 1, -legLen + 2, hipW + 2, 7);
            ctx.fillRect(8 - hipW / 2 - 1, -legLen + 2, hipW + 2, 7);
        } else if (archId === 'assassino') {
            ctx.strokeStyle = this._archetype(entity).accent;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-8 - hipW / 2, -legLen * 0.62); ctx.lineTo(-8 + hipW / 2, -legLen * 0.68); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(8 - hipW / 2, -legLen * 0.62); ctx.lineTo(8 + hipW / 2, -legLen * 0.68); ctx.stroke();
        }

        if (boots) {
            const bootColor = boots.rarity ? boots.rarity.color : '#8a5a2b';
            const bw = ankleW + 6;
            ctx.fillStyle = '#2c2318';
            ctx.fillRect(-8 - bw / 2, -16, bw, 16);
            ctx.fillRect(8 - bw / 2, -16, bw, 16);
            ctx.strokeStyle = bootColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(-8 - bw / 2, -16, bw, 16);
            ctx.strokeRect(8 - bw / 2, -16, bw, 16);
            // Sola e cadarço/fivela simples pra não ficarem blocos lisos
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(-8 - bw / 2, -3, bw, 3);
            ctx.fillRect(8 - bw / 2, -3, bw, 3);
        }
    }

    // Caminho do torso afunilado (ombros largos -> cintura estreita) — usado
    // tanto pro preenchimento quanto pra sobrepor o sombreamento direcional.
    _torsoPath(ctx, m, torsoH) {
        ctx.beginPath();
        ctx.moveTo(-m.shoulder / 2, -torsoH);
        ctx.quadraticCurveTo(-m.shoulder / 2 - 3, -torsoH * 0.55, -m.waist / 2, 0);
        ctx.lineTo(m.waist / 2, 0);
        ctx.quadraticCurveTo(m.shoulder / 2 + 3, -torsoH * 0.55, m.shoulder / 2, -torsoH);
        ctx.closePath();
    }

    _drawTorso(ctx, entity, pose) {
        const legLen = this._legLen();
        const torsoH = this._torsoH();
        const m = this._bodyMetrics(entity);
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
        this._torsoPath(ctx, m, torsoH);
        ctx.fill();

        // Sombreamento direcional (luz vindo da esquerda) — dá volume ao
        // torso em vez do preenchimento chapado de antes.
        const shade = ctx.createLinearGradient(-m.shoulder / 2, 0, m.shoulder / 2, 0);
        shade.addColorStop(0, 'rgba(255,255,255,0.16)');
        shade.addColorStop(0.5, 'rgba(255,255,255,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = shade;
        this._torsoPath(ctx, m, torsoH);
        ctx.fill();

        if (metallic) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-m.shoulder / 2 + 5, -torsoH + 6);
            ctx.lineTo(-m.waist / 2 + 4, -6);
            ctx.stroke();
        }

        this._drawArchetypeTorsoSignature(ctx, entity, m, torsoH);

        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(-m.waist / 2, -12, m.waist, 6);
        ctx.restore();
    }

    // Adereço de torso assinatura por arquétipo — reforça a identidade visual
    // de cada lutador além do equipamento (ver FIGHTER_ARCHETYPES).
    _drawArchetypeTorsoSignature(ctx, entity, m, torsoH) {
        const archId = entity.visuals && entity.visuals.archetype;
        if (!archId) return;
        const arch = this._archetype(entity);

        if (archId === 'cavaleiro') { // tabardo (livrea) sobre a armadura
            ctx.fillStyle = arch.accent;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(-m.waist * 0.22, -torsoH + 8, m.waist * 0.44, torsoH - 10);
            ctx.globalAlpha = 1;
        } else if (archId === 'barbaro') { // peles no ombro + pintura tribal
            ctx.fillStyle = arch.accent;
            ctx.beginPath(); ctx.arc(-m.shoulder / 2 + 4, -torsoH + 5, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(m.shoulder / 2 - 4, -torsoH + 5, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c94f3f'; ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.moveTo(-m.waist / 2, -torsoH * 0.45); ctx.lineTo(m.waist / 2, -torsoH * 0.62); ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (archId === 'guerreira') { // faixa/sash diagonal
            ctx.strokeStyle = arch.accent; ctx.lineWidth = 6; ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.moveTo(-m.shoulder / 2 + 2, -torsoH + 6); ctx.lineTo(m.waist / 2 - 2, -4); ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (archId === 'mercenario') { // remendos assimétricos e contrastantes, equipamento improvisado
            ctx.fillStyle = 'rgba(70,95,110,0.8)';
            ctx.fillRect(-m.waist / 2 + 2, -torsoH * 0.68, m.waist * 0.42, torsoH * 0.26);
            ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 1;
            ctx.strokeRect(-m.waist / 2 + 2, -torsoH * 0.68, m.waist * 0.42, torsoH * 0.26);
            ctx.fillStyle = 'rgba(150,80,40,0.8)';
            ctx.fillRect(-m.waist * 0.1, -torsoH * 0.36, m.waist * 0.38, torsoH * 0.22);
            ctx.strokeRect(-m.waist * 0.1, -torsoH * 0.36, m.waist * 0.38, torsoH * 0.22);
        } else if (archId === 'campeao') { // friso dourado + emblema de laurel
            ctx.strokeStyle = arch.accent; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -torsoH + 6); ctx.lineTo(0, -6); ctx.stroke();
            ctx.fillStyle = arch.accent;
            ctx.beginPath(); ctx.arc(0, -torsoH * 0.6, 5, 0, Math.PI * 2); ctx.fill();
        } else if (archId === 'assassino') { // correias cruzadas no peito
            ctx.strokeStyle = arch.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(-m.shoulder / 2 + 2, -torsoH + 6); ctx.lineTo(m.waist / 2 - 2, -6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(m.shoulder / 2 - 2, -torsoH + 6); ctx.lineTo(-m.waist / 2 + 2, -6); ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (archId === 'veterano') { // faixa de bandagem enrolada cruzando o peito, marca de batalhas antigas
            ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 5.5; ctx.globalAlpha = 0.95;
            ctx.beginPath(); ctx.moveTo(-m.shoulder / 2 + 4, -torsoH * 0.68); ctx.lineTo(m.waist / 2 - 4, -torsoH * 0.22); ctx.stroke();
            ctx.fillStyle = 'rgba(140,30,30,0.6)';
            ctx.beginPath(); ctx.arc(m.waist * 0.05, -torsoH * 0.45, 2.8, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
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
        const archId = v.archetype;

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
        // Sombra sutil no lado de trás do rosto — mesmo truque de luz vindo
        // da esquerda usado no torso, evita a cabeça parecer um disco chapado.
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.beginPath();
        ctx.arc(headR * 0.35, 0, headR * 0.85, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
        ctx.restore();

        // Sobrancelha: ângulo varia por arquétipo (Bárbaro/Assassino mais
        // cerrada e agressiva, Cavaleiro/Campeão mais neutra e confiante)
        const browDrop = (archId === 'barbaro' || archId === 'assassino') ? 3 : 0;
        ctx.strokeStyle = v.eyebrowColor || v.hairColor || '#2a1c10';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, headY - 4 + browDrop);
        ctx.lineTo(13, headY - 6);
        ctx.stroke();

        ctx.fillStyle = v.eyeColor || '#1a1a1a';
        ctx.beginPath();
        ctx.arc(10, headY, 2, 0, Math.PI * 2);
        ctx.fill();

        this._drawMouth(ctx, v, headY, pose);
        this._drawScar(ctx, v, headY, headR);

        if (!helmet) this._drawHair(ctx, v, headY, headR, false);
        this._drawFacialHair(ctx, v, headY);
        this._drawArchetypeHeadSignature(ctx, entity, headY, headR);
        if (helmet) this._drawHelmet(ctx, helmet, headY, headR);
    }

    // Boca simples que reage à animação em curso — sem isso o rosto ficava
    // sempre com a mesma expressão vazia em qualquer momento da luta.
    _drawMouth(ctx, v, headY, pose) {
        const type = pose && pose.animType;
        ctx.strokeStyle = 'rgba(60,30,20,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (type === 'attack' || type === 'run' || type === 'charge') {
            ctx.arc(7, headY + 8, 3, 0.1 * Math.PI, 0.9 * Math.PI); // boca aberta, esforço
        } else if (type === 'hurt') {
            ctx.moveTo(4, headY + 9); ctx.quadraticCurveTo(8, headY + 6, 12, headY + 9); // careta
        } else if (type === 'victory') {
            ctx.arc(7, headY + 7, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); // sorriso
        } else {
            ctx.moveTo(3, headY + 8); ctx.lineTo(12, headY + 8); // neutro
        }
        ctx.stroke();
    }

    // Cicatriz (visuals.scarStyle, 0 = nenhuma) — puramente estética, mesmo
    // padrão de v.hairColor/v.eyeColor: só identidade visual.
    _drawScar(ctx, v, headY, headR) {
        const style = SCAR_STYLES[v.scarStyle || 0];
        if (!style || style === 'none') return;
        ctx.strokeStyle = 'rgba(150,90,80,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (style === 'cheek') { ctx.moveTo(2, headY - 2); ctx.lineTo(9, headY + 10); }
        else if (style === 'brow') { ctx.moveTo(0, headY - 9); ctx.lineTo(6, headY - 3); }
        else if (style === 'forehead') { ctx.moveTo(-6, headY - headR + 6); ctx.lineTo(2, headY - 10); }
        else if (style === 'jaw') { ctx.moveTo(6, headY + 9); ctx.lineTo(13, headY + 14); }
        ctx.stroke();
    }

    // Adereço de cabeça assinatura por arquétipo (Assassino: véu cobrindo o
    // rosto inferior; Campeão: coroa de louros) — some quando há capacete
    // equipado, já que o capacete cobre a mesma área.
    _drawArchetypeHeadSignature(ctx, entity, headY, headR) {
        const v = entity.visuals || {};
        const archId = v.archetype;
        const helmet = entity.equipment && entity.equipment[SLOTS.HEAD];
        if (helmet) return;
        if (archId === 'assassino') {
            ctx.fillStyle = this._archetype(entity).accent;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.ellipse(4, headY + 8, headR * 0.55, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (archId === 'campeao') {
            ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, headY - 3, headR + 4, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
        }
    }

    // Dome básico de cabelo curto — base compartilhada por vários estilos que
    // também acrescentam elementos próprios (topete, coque, franja, etc).
    _drawBaseCap(ctx, headY, headR) {
        ctx.beginPath();
        ctx.arc(0, headY - 4, headR - 1, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    // Mecha longa "escorrendo" pela lateral/nuca (rabo de cavalo, cabelo longo
    // liso, sayajin longo) — side = -1 (esquerda) ou 1 (direita).
    _drawFlowTail(ctx, headY, headR, side, length) {
        const x0 = side * (headR - 3);
        ctx.beginPath();
        ctx.moveTo(x0, headY - 6);
        ctx.quadraticCurveTo(x0 + side * 8, headY + length * 0.5, x0, headY + length);
        ctx.lineTo(x0 - side * 6, headY + length - 4);
        ctx.quadraticCurveTo(x0 - side * 2, headY + length * 0.5, x0 - side * 2, headY - 2);
        ctx.fill();
    }

    // Espetos radiais a partir do topo da cabeça (estilos sayajin).
    _drawSpikes(ctx, headY, headR, count, baseLen) {
        const half = (count - 1) / 2;
        for (let i = 0; i < count; i++) {
            const t = i - half;
            const ang = t * 16 * Math.PI / 180;
            const len = baseLen - Math.abs(t) * 2;
            const baseX = Math.sin(ang) * headR * 0.55;
            const baseY = headY - Math.cos(ang) * headR * 0.55;
            const tipX = Math.sin(ang) * (headR + len);
            const tipY = headY - headR - Math.cos(ang) * len;
            const ang2 = ang + 0.14;
            const base2X = Math.sin(ang2) * headR * 0.65;
            const base2Y = headY - Math.cos(ang2) * headR * 0.65;
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(base2X, base2Y);
            ctx.closePath();
            ctx.fill();
        }
    }

    // 15 estilos de cabelo (todos recolorívels via v.hairColor). "backLayer"
    // desenha a parte que deve ficar atrás/abaixo da cabeça (rabo, tranças,
    // mechas longas); o topo/franja sempre vai na camada da frente, depois do
    // rosto já pintado, senão ficaria escondido atrás do círculo da cabeça.
    _drawHair(ctx, v, headY, headR, backLayer) {
        const style = v.hairStyle || 1;
        ctx.fillStyle = v.hairColor || '#2a1c10';

        switch (style) {
            case 1: // Sayajin Espetado
                if (backLayer) return;
                this._drawSpikes(ctx, headY, headR, 7, 16);
                break;
            case 2: // Sayajin Longo
                if (backLayer) { this._drawFlowTail(ctx, headY, headR, -1, 46); this._drawFlowTail(ctx, headY, headR, 1, 46); return; }
                this._drawSpikes(ctx, headY, headR, 5, 20);
                break;
            case 3: // Moicano
                if (backLayer) return;
                ctx.beginPath();
                ctx.moveTo(-4, headY - headR + 3);
                ctx.lineTo(0, headY - headR - 15);
                ctx.lineTo(4, headY - headR + 3);
                ctx.closePath();
                ctx.fill();
                break;
            case 4: // Samurai (topete preso + laterais raspadas)
                if (backLayer) return;
                ctx.globalAlpha = 0.18;
                this._drawBaseCap(ctx, headY, headR);
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(-3, headY - headR - 3, 6, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 5: // Rabo de Cavalo
                if (backLayer) { this._drawFlowTail(ctx, headY, headR, -1, 44); return; }
                this._drawBaseCap(ctx, headY, headR);
                break;
            case 6: // Cabelo Preso (coque)
                if (backLayer) {
                    ctx.beginPath();
                    ctx.arc(-headR + 5, headY - 12, 7, 0, Math.PI * 2);
                    ctx.fill();
                    return;
                }
                this._drawBaseCap(ctx, headY, headR);
                break;
            case 7: // Cacheado
                if (backLayer) return;
                for (let i = -2; i <= 2; i++) {
                    ctx.beginPath();
                    ctx.arc(i * 8, headY - headR + 5 - Math.abs(i) * 2, 7, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 8: // Afro
                if (backLayer) return;
                ctx.beginPath();
                ctx.arc(0, headY - 2, headR + 6, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 9: // Longo Liso
                if (backLayer) { this._drawFlowTail(ctx, headY, headR, -1, 40); this._drawFlowTail(ctx, headY, headR, 1, 40); return; }
                this._drawBaseCap(ctx, headY, headR);
                break;
            case 10: // Tranças
                if (backLayer) {
                    for (let i = -1; i <= 1; i += 2) {
                        const bx = i * 9;
                        ctx.fillRect(bx - 2, headY - 2, 4, 38);
                        for (let k = 0; k < 4; k++) {
                            ctx.beginPath();
                            ctx.arc(bx, headY + 4 + k * 9, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    return;
                }
                this._drawBaseCap(ctx, headY, headR);
                break;
            case 11: // Cabelo Raspado
                if (backLayer) return;
                ctx.globalAlpha = 0.3;
                this._drawBaseCap(ctx, headY, headR);
                ctx.globalAlpha = 1;
                break;
            case 12: // Careca
                return;
            case 13: // Franja
                if (backLayer) return;
                this._drawBaseCap(ctx, headY, headR);
                ctx.fillRect(-headR + 4, headY - 7, headR * 2 - 8, 6);
                break;
            case 14: // Cabelo Bagunçado
                if (backLayer) return;
                for (let i = -3; i <= 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * 6, headY - headR + 7);
                    ctx.lineTo(i * 6 + (i % 2 === 0 ? -3 : 3), headY - headR - 7);
                    ctx.lineTo(i * 6 + 5, headY - headR + 8);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
            case 15: // Gladiador Romano
            default:
                if (backLayer) return;
                this._drawBaseCap(ctx, headY, headR);
                for (let i = -2; i <= 2; i++) {
                    ctx.beginPath();
                    ctx.arc(i * 7, headY - headR + 7, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }
    }

    // 12 estilos de barba/bigode (0 = nenhuma), recolorívels independente do
    // cabelo via v.beardColor. Algumas variantes mais cheias (Viking, Longa,
    // Trançada) ficam indisponíveis para o gênero Feminino no criador —
    // identidade visual apenas, sem qualquer efeito de atributo.
    _drawFacialHair(ctx, v, headY) {
        const beardStyle = v.beardStyle || 0;
        if (!beardStyle) return;
        const color = v.beardColor || v.hairColor || '#2a1c10';
        const headR = this._headR();
        ctx.fillStyle = color;

        const drawMustache = () => {
            ctx.beginPath();
            ctx.ellipse(0, headY + 8, 8, 2.6, 0, 0, Math.PI * 2);
            ctx.fill();
        };
        const drawFullBeard = (extra = 0) => {
            ctx.beginPath();
            ctx.arc(0, headY + 4, headR - 2 + extra, 0, Math.PI);
            ctx.fill();
        };

        switch (beardStyle) {
            case 1: // Cavanhaque
                drawMustache();
                ctx.beginPath();
                ctx.moveTo(-6, headY + 7);
                ctx.quadraticCurveTo(0, headY + 19, 6, headY + 7);
                ctx.quadraticCurveTo(0, headY + 13, -6, headY + 7);
                ctx.fill();
                break;
            case 2: // Barba Curta
                ctx.globalAlpha = 0.85;
                drawFullBeard(-4);
                ctx.globalAlpha = 1;
                break;
            case 3: // Barba Média
                drawFullBeard(0);
                break;
            case 4: // Barba Longa
                drawFullBeard(2);
                ctx.beginPath();
                ctx.moveTo(-6, headY + headR - 4);
                ctx.lineTo(0, headY + headR + 14);
                ctx.lineTo(6, headY + headR - 4);
                ctx.fill();
                break;
            case 5: // Bigode
                drawMustache();
                break;
            case 6: // Bigode Imperial
                drawMustache();
                ctx.beginPath();
                ctx.arc(-9, headY + 9, 2.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(9, headY + 9, 2.4, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 7: // Barba Cheia
                drawFullBeard(0);
                break;
            case 8: // Costeletas
                ctx.fillRect(-headR + 1, headY - 4, 5, 16);
                ctx.fillRect(headR - 6, headY - 4, 5, 16);
                break;
            case 9: // Barba Viking
                drawFullBeard(2);
                ctx.beginPath();
                ctx.moveTo(-3, headY + headR);
                ctx.lineTo(0, headY + headR + 20);
                ctx.lineTo(3, headY + headR);
                ctx.fill();
                break;
            case 10: // Barba Trançada
                drawFullBeard(0);
                for (let k = 0; k < 3; k++) {
                    ctx.beginPath();
                    ctx.arc(0, headY + headR + 2 + k * 6, 2.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 11: // Barba por Fazer
                ctx.globalAlpha = 0.25;
                drawFullBeard(-3);
                ctx.globalAlpha = 1;
                break;
            default:
                break;
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

        // Brilho metálico no topo — sem isso o capacete ficava um domo cinza
        // liso, igual à armadura antes do sombreamento direcional do torso.
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-headR * 0.3, headY - 4, headR - 3, Math.PI * 1.05, Math.PI * 1.4);
        ctx.stroke();

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
        const gloveColor = gloves ? (gloves.rarity ? gloves.rarity.color : '#5a4632') : null;
        const armColor = gloves ? '#3a2f22' : skin;
        const m = this._bodyMetrics(entity);
        const shield = entity.equipment && entity.equipment[SLOTS.OFF_HAND];
        const angle = pose.guard ? -110 : -75;

        ctx.save();
        ctx.translate(-m.shoulder / 2 + 3, shoulderY);
        ctx.rotate(angle * Math.PI / 180);
        ctx.fillStyle = armColor;
        this._drawTaperedLimb(ctx, 0, 0, this._armLen() * 0.7, m.armShoulder, m.armWrist);
        if (gloveColor) {
            ctx.strokeStyle = gloveColor; ctx.lineWidth = 1.5;
            ctx.strokeRect(-m.armWrist / 2, this._armLen() * 0.5, m.armWrist, this._armLen() * 0.2);
        }
        ctx.restore();

        if (shield) {
            const shieldColor = shield.rarity ? shield.rarity.color : '#8a5a2b';
            const sx = pose.guard ? -m.shoulder / 2 - 14 : -m.shoulder / 2 - 4;
            const sy = pose.guard ? shoulderY + 2 : shoulderY + 22;
            const shieldSize = 12 + (shield.defense || 0) * 0.15; // escudos mais fortes aparecem visivelmente maiores
            ctx.save();
            ctx.fillStyle = '#5a4632';
            ctx.strokeStyle = shieldColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(sx, sy, shieldSize, shieldSize * 1.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Aro interno + umbo central — dá a sensação de metal batido em
            // vez de um disco liso de cor única.
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(sx, sy, shieldSize * 0.62, shieldSize * 0.88, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = shieldColor;
            ctx.fill();
            ctx.restore();
        }
    }

    // Braço da frente: sempre a arma equipada (ou punho nu). anim (opcional)
    // permite desenhar um leve rastro de movimento durante o golpe de ataque.
    _drawFrontArm(ctx, entity, pose, anim) {
        const shoulderY = -this._legLen() - this._torsoH() + 10;
        const skin = (entity.visuals && entity.visuals.skinTone) || '#ffcc99';
        const gloves = entity.equipment && entity.equipment[SLOTS.HANDS];
        const gloveColor = gloves ? (gloves.rarity ? gloves.rarity.color : '#5a4632') : null;
        const armColor = gloves ? '#3a2f22' : skin;
        const m = this._bodyMetrics(entity);
        const armLen = this._armLen();
        const activeWeapon = entity.getActiveWeapon ? entity.getActiveWeapon() : (entity.equipment && entity.equipment[SLOTS.MAIN_HAND]);

        // Rastro de movimento (afterimage) durante o swing de ataque — 2 cópias
        // fracas do braço/arma num ângulo levemente anterior, sem precisar
        // rastrear histórico de quadros anteriores.
        if (anim && anim.type === 'attack') {
            [24, 12].forEach((back, i) => {
                ctx.save();
                ctx.globalAlpha = 0.14 + i * 0.08;
                ctx.translate(m.shoulder / 2 - 3, shoulderY);
                ctx.rotate((pose.weaponAngle - back) * Math.PI / 180);
                ctx.fillStyle = armColor;
                this._drawTaperedLimb(ctx, 0, 0, armLen, m.armShoulder, m.armWrist);
                ctx.translate(0, armLen);
                this._drawWeapon(ctx, activeWeapon);
                ctx.restore();
            });
            ctx.globalAlpha = 1;
        }

        ctx.save();
        ctx.translate(m.shoulder / 2 - 3, shoulderY);
        ctx.rotate(pose.weaponAngle * Math.PI / 180);
        ctx.fillStyle = armColor;
        this._drawTaperedLimb(ctx, 0, 0, armLen, m.armShoulder, m.armWrist);
        if (gloveColor) {
            ctx.strokeStyle = gloveColor; ctx.lineWidth = 1.5;
            ctx.strokeRect(-m.armWrist / 2, armLen * 0.72, m.armWrist, armLen * 0.22);
        }
        ctx.translate(0, armLen);
        // Usa a arma ATIVA (mainHand ou ranged, conforme activeWeaponSlot),
        // não sempre a mainHand — senão trocar de arma em combate mudava o
        // dano/alcance mas o sprite continuava mostrando a arma antiga.
        this._drawWeapon(ctx, activeWeapon);
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
