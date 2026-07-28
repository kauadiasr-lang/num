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

// ==========================================================================
// BIOMAS DE ARENA: cada cenário de batalha tem identidade própria (paleta
// de solo, vegetação, silhueta de fundo e props espalhados) — sorteado uma
// vez por luta (resetForNewBattle), igual ao horário do dia já existente.
// O solo detalhado de cada bioma é pré-renderizado uma única vez por luta
// num canvas offscreen (ver _buildArenaGroundTexture) e só é "colado"
// (drawImage) a cada quadro — o mesmo princípio de reaproveitar uma
// textura/spritesheet em vez de redesenhar dezenas de pedras/rachaduras/
// tufos de grama a cada frame, o que manteria os 60fps mesmo em qualidade alta.
// ==========================================================================
const ARENA_BIOMES = {
    coliseu: {
        name: 'Coliseu Imperial',
        ground: ['#7a5a34', '#6b4d2a', '#8a6a3e', '#5a4025'], accent: '#3d2c18',
        vegetation: 'none', special: null,
        midground: 'colosseum', hasCrowd: true, hasBanners: true,
        props: ['rock', 'rubble', 'brokenShield', 'bones']
    },
    areia: {
        name: 'Arena de Areia Clássica',
        ground: ['#c9a876', '#d4b483', '#b89563', '#e0c294'], accent: '#8a6a3e',
        vegetation: 'none', special: 'sand',
        midground: 'dunes', midgroundColor: 'rgba(180,150,100,0.45)', hasCrowd: false, hasBanners: true,
        props: ['stake', 'bones', 'rock', 'brokenWeapon']
    },
    floresta: {
        name: 'Clareira da Floresta',
        ground: ['#4a3f24', '#5a4a2a', '#3d3520', '#4f4526'], accent: '#2a2415',
        vegetation: 'dense', special: null,
        midground: 'treeline', midgroundColor: 'rgba(30,42,26,0.75)', hasCrowd: false, hasBanners: false,
        props: ['log', 'bush', 'flower', 'stump', 'rock']
    },
    ruinas: {
        name: 'Ruínas Antigas',
        ground: ['#6b6558', '#5a564a', '#7a7364', '#4f4b40'], accent: '#3a372e',
        vegetation: 'moss', special: null,
        midground: 'walls', midgroundColor: 'rgba(74,70,64,0.8)', midgroundBroken: true,
        hasCrowd: false, hasBanners: true, bannerTattered: true,
        props: ['brokenPillar', 'rubble', 'statue', 'bones', 'oldBanner']
    },
    deserto: {
        name: 'Deserto Escaldante',
        ground: ['#e0c294', '#d4b483', '#c9a876', '#e8cc9e'], accent: '#a3825a',
        vegetation: 'none', special: 'sand',
        midground: 'dunes', midgroundColor: 'rgba(201,168,118,0.55)', hasCrowd: false, hasBanners: false,
        props: ['bones', 'deadBush', 'rock']
    },
    castelo: {
        name: 'Pátio do Castelo',
        ground: ['#8a8a8a', '#7a7a7a', '#95958f', '#6e6e6e'], accent: '#4a4a4a',
        vegetation: 'none', special: 'cobblestone',
        midground: 'walls', midgroundColor: 'rgba(90,90,90,0.85)', hasCrowd: true, hasBanners: true,
        props: ['torchStake', 'brokenShield', 'rock']
    },
    templo: {
        name: 'Templo Esquecido',
        ground: ['#c9b896', '#b8a67e', '#d4c4a0', '#a39270'], accent: '#8a7a5a',
        vegetation: 'sparse', special: null,
        midground: 'columns', midgroundColor: 'rgba(184,166,126,0.7)', hasCrowd: false, hasBanners: true, bannerTattered: true,
        props: ['brokenPillar', 'statue', 'flower', 'rubble']
    },
    montanhas: {
        name: 'Platô da Montanha',
        ground: ['#6a6355', '#5a5548', '#79715f', '#4f4a3e'], accent: '#3a362d',
        vegetation: 'medium', special: null,
        midground: 'peaks', midgroundColor: 'rgba(70,64,86,0.55)', hasCrowd: false, hasBanners: false,
        props: ['bigRock', 'log', 'bush', 'rock']
    },
    vulcanica: {
        name: 'Arena Vulcânica',
        ground: ['#2a2220', '#3a2a24', '#241c1a', '#33241f'], accent: '#ff6a2b',
        vegetation: 'none', special: 'lava',
        midground: 'peaks', midgroundColor: 'rgba(90,30,20,0.55)', hasCrowd: false, hasBanners: false,
        props: ['bigRock', 'bones', 'brokenWeapon']
    },
    congelada: {
        name: 'Arena Congelada',
        ground: ['#dce8f0', '#c7d8e3', '#eef5fa', '#b8cdda'], accent: '#8fa8ba',
        vegetation: 'none', special: 'snow',
        midground: 'peaks', midgroundColor: 'rgba(180,200,220,0.5)', hasCrowd: false, hasBanners: false,
        props: ['icicleRock', 'bones', 'frozenBanner']
    }
};
window.ARENA_BIOMES = ARENA_BIOMES;

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
        this.arenaBiome = 'coliseu'; // padrão até a primeira batalha sortear um bioma
        this._ambientFx = [];
        // Progresso contínuo (0..1) do ciclo dia/noite da Cidade — usado só
        // pelo céu da Cidade pra o sol/lua se moverem em arco de verdade ao
        // longo do tempo, em vez de pular de posição a cada troca de fase.
        // A Arena de combate continua com o céu estático por luta (this.arenaTime).
        this.cityDayProgress = 0.5;
        this._dustTimer = 0;
        this._birdTimer = 6;
        // Flash de relâmpago (ver CityEngine._updateWeather, tempestade) —
        // 1.0 no instante do raio, decaindo rápido até 0. Desenhado como um
        // véu branco translúcido por cima de tudo, só na Cidade.
        this._lightningFlash = 0;
        // Estrelas cadentes: raras, só à noite (Arena ou Cidade) — antes o
        // céu noturno só tinha estrelas fixas piscando, sem NENHUM evento
        // ocasional pra recompensar quem observa o céu por mais tempo.
        this._shootingStars = [];
        this._shootingStarTimer = Utils.randomFloat(15, 40);
        this._initArenaAmbience();
    }

    // Chamado por CityEngine quando uma tempestade dispara um raio.
    triggerLightningFlash() {
        this._lightningFlash = 1.0;
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

        // Nuvens lentas: poucas, bem discretas, cada uma feita de 3 blobs
        // sobrepostos (silhueta mais orgânica que uma única elipse)
        this._clouds = Array.from({ length: 4 }, () => ({
            x: Math.random(), y: Utils.randomFloat(0.08, 0.4), scale: Utils.randomFloat(0.7, 1.3),
            speed: Utils.randomFloat(0.004, 0.009)
        }));
    }

    // Chamado ao entrar no Menu Principal/Créditos: fixa o céu no entardecer
    // (a identidade visual pedida — "coliseu ao pôr do sol"), diferente da
    // batalha, que sorteia um horário dinâmico a cada luta.
    initMenuAmbience() {
        this.arenaTime = 'sunset';
        // O menu sempre mostra o Coliseu Imperial (identidade fixa), mesmo
        // que a última batalha tenha sorteado outro bioma — só as batalhas
        // sorteiam um cenário novo (ver resetForNewBattle).
        this.arenaBiome = 'coliseu';
        this.birds = [];
        this._birdTimer = Utils.randomFloat(2, 5);
    }

    // Chamado a cada nova batalha: sincroniza o horário do céu com o horário
    // ATUAL da cidade e reseta as animações dos combatentes para o estado
    // neutro.
    resetForNewBattle() {
        // Antes sorteava um horário totalmente aleatório a cada luta —
        // uma batalha podia começar de dia mesmo com a cidade em plena
        // noite (ou vice-versa), quebrando a continuidade do ciclo
        // dia/noite que o jogador acabou de viver na praça (ruas vazias,
        // perigo noturno...) e que devia continuar valendo na arena.
        if (window.City && window.City._initialized && window.City.dayPhases) {
            this.arenaTime = window.City.dayPhases[window.City.dayPhaseIndex];
        } else {
            const times = ['dawn', 'day', 'sunset', 'night'];
            this.arenaTime = times[Utils.randomInt(0, times.length - 1)];
        }

        // Sorteia o bioma da arena (identidade própria de solo/vegetação/
        // fundo/props) e pré-renderiza o solo detalhado uma única vez para
        // esta luta — ver ARENA_BIOMES e _buildArenaGroundTexture.
        const biomeIds = Object.keys(ARENA_BIOMES);
        this.arenaBiome = biomeIds[Utils.randomInt(0, biomeIds.length - 1)];
        this._buildArenaGroundTexture();

        this.playerAnim = { type: 'idle', start: performance.now(), duration: 0 };
        this.enemyAnim = { type: 'idle', start: performance.now(), duration: 0 };
        this.birds = [];
        this._birdTimer = Utils.randomFloat(3, 7);
        this._ambientFx = []; // brasas/neve/folhas específicas do bioma (ver update())
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

    // Linha do horizonte (fração da altura da tela) — MESMA proporção usada
    // por CityEngine._horizon(h), mas repetida aqui como número mágico
    // solto (h * 0.62) em 5 lugares diferentes deste arquivo antes desta
    // extração. Uma única fonte de verdade evita o cenário de alguém
    // atualizar 4 das 5 ocorrências e deixar o horizonte da arena
    // dessincronizado do resto.
    _horizonY(h) {
        return h * 0.62;
    }

    // Toca uma animação num dos dois combatentes (chamado a partir do battle.js
    // em pontos específicos, sem alterar em nada a lógica/matemática do combate).
    // A duração respeita a configuração de "Velocidade das animações" (padrão 1x).
    playAnim(isPlayer, type, duration = 650, crit = false) {
        const anim = isPlayer ? this.playerAnim : this.enemyAnim;
        anim.type = type;
        anim.start = performance.now();
        anim.duration = duration / (this.animationSpeedMultiplier || 1);
        // Só relevante pra 'hurt' (ver computePose) — reação física mais forte
        // num acerto crítico, pra crits serem visualmente distintos de um
        // acerto normal e não só na cor do número/partícula.
        anim.crit = crit;
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

    // Pingo de chuva (ver CityEngine._updateWeather, clima da praça) — não
    // reaproveita spawnParticles porque um pingo precisa cair reto e rápido
    // (vy alto, vx quase nulo), diferente de faísca/poeira/sangue que se
    // espalham em qualquer direção. Respeita "reduzir efeitos" na cidade
    // igual já acontece em spawnParticles.
    spawnRainDrop(x, y) {
        if (this.reduceEffects && Utils.chance(50)) return;
        const p = new Particle(x, y, 'rgba(120,150,185,0.85)', 0, 3);
        p.vx = Utils.randomFloat(0.3, 0.7);
        p.vy = Utils.randomFloat(9, 13);
        p.decay = 0.012;
        this.particles.push(p);
    }

    // Flash de impacto crítico (anel dourado expansivo)
    spawnCritBurst(x, y, color = '#ffcc00') {
        this.bursts.push(new ImpactBurst(x, y, color));
    }

    // Explosão de partículas + anéis de luz pra cinemática "NOVA LINHAGEM
    // DESPERTA" (ver ui.js showLineageAwakening) — centrada no jogador,
    // cor vinda do acento da linhagem (ver LINEAGES em lineages.js).
    playLineageAwakeningVFX(color) {
        if (!window.Engine) return;
        const x = this.getEntityX(true, window.Engine.width);
        const y = window.Engine.height / 2;
        this.spawnParticles(x, y, color, 60, 7, 5);
        for (let i = 0; i < 4; i++) {
            setTimeout(() => this.spawnCritBurst(x, y, color), i * 150);
        }
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
        if (this._lightningFlash > 0) this._lightningFlash = Math.max(0, this._lightningFlash - dt * 2.5);

        // Estrelas cadentes (ver constructor) — só sorteia uma nova enquanto
        // é noite; fora disso, o temporizador só reseta com um intervalo
        // curto pra tentar de novo assim que a noite cair, sem acumular
        // atraso.
        this._shootingStarTimer -= dt;
        if (this._shootingStarTimer <= 0) {
            if (this.arenaTime === 'night') {
                this._shootingStarTimer = Utils.randomFloat(20, 45);
                this._shootingStars.push({
                    x0: Utils.randomFloat(0.15, 0.75), y0: Utils.randomFloat(0.05, 0.22),
                    dx: Utils.randomFloat(220, 340), dy: Utils.randomFloat(90, 160),
                    life: 1.0
                });
            } else {
                this._shootingStarTimer = Utils.randomFloat(5, 15);
            }
        }
        this._shootingStars.forEach(s => s.life -= dt * 1.3);
        this._shootingStars = this._shootingStars.filter(s => s.life > 0);

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

            // Nuvens à deriva, bem lentas (mantidas mesmo em qualidade baixa —
            // é só translação de posição, sem redesenho pesado)
            this._clouds.forEach(cl => {
                cl.x += cl.speed * dt;
                if (cl.x > 1.25) cl.x = -0.25;
            });

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

            // Efeito ambiente específico do bioma da arena (folhas, brasas,
            // neve, areia) — sempre discreto, nunca mais que um punhado de
            // partículas de cada vez (ver _spawnBiomeAmbient).
            if (isBattle && this.qualityLevel !== 'baixa') {
                this._biomeFxTimer = (this._biomeFxTimer || 0) - dt;
                if (this._biomeFxTimer <= 0 && this.particles.length < 80) {
                    this._biomeFxTimer = Utils.randomFloat(0.5, 1.1);
                    this._spawnBiomeAmbient();
                }
            }
        }
    }

    // Poeira/folha/brasa/neve ambiente conforme o bioma sorteado — reaproveita
    // a mesma classe Particle das outras partículas do jogo, só muda cor/
    // velocidade/ponto de origem pra combinar com o cenário.
    _spawnBiomeAmbient() {
        if (!window.Engine) return;
        const w = window.Engine.width, h = window.Engine.height;
        const horizon = this._horizonY(h);
        const biome = ARENA_BIOMES[this.arenaBiome];
        if (!biome) return;

        if (biome.special === 'lava') { // brasas subindo devagar
            const p = new Particle(Utils.randomFloat(w * 0.1, w * 0.9), h - 10, '#ff8a3a', 0.6, Utils.randomFloat(1.5, 3));
            p.vy = -Utils.randomFloat(0.4, 1.0); p.vx *= 0.3; p.decay = 0.012;
            this.particles.push(p);
        } else if (biome.special === 'snow') { // neve caindo devagar
            const p = new Particle(Utils.randomFloat(0, w), horizon - 10, 'rgba(255,255,255,0.85)', 0.4, Utils.randomFloat(2, 4));
            p.vy = Utils.randomFloat(0.6, 1.2); p.vx *= 0.4; p.decay = 0.006;
            this.particles.push(p);
        } else if (biome.vegetation === 'dense') { // folhas voando (floresta)
            const p = new Particle(Utils.randomFloat(0, w * 0.3), Utils.randomFloat(horizon, horizon + 60), '#a3752a', 1.2, Utils.randomFloat(2, 3.5));
            p.vy = Utils.randomFloat(0.2, 0.6); p.vx = Utils.randomFloat(0.8, 1.8); p.decay = 0.01;
            this.particles.push(p);
        } else if (biome.special === 'sand') { // névoa fina de areia
            const p = new Particle(Utils.randomFloat(0, w), Utils.randomFloat(horizon, h - 20), 'rgba(220,190,140,0.25)', 1.5, Utils.randomFloat(3, 6));
            p.vy *= 0.1; p.decay = 0.01;
            this.particles.push(p);
        }
    }

    _spawnAmbientDust() {
        if (!window.Engine) return;
        const w = window.Engine.width;
        const h = window.Engine.height;
        const horizon = this._horizonY(h);
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
            const horizon = this._horizonY(canvasHeight);
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

        // Flash de relâmpago (tempestade na Cidade, ver
        // CityEngine._updateWeather/triggerLightningFlash) — só fica > 0
        // enquanto a Cidade está ativa, então nunca aparece na Arena.
        if (this._lightningFlash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this._lightningFlash * 0.55})`;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    }

    // ======================================================================
    // FUNDO DA ARENA: céu dinâmico, coliseu, plateia, bandeiras, tochas, areia
    // ======================================================================

    // Paletas de horário do dia — além das cores do céu (usadas por _drawSky),
    // cada uma carrega groundTint/groundAlpha: o "banho de luz" aplicado sobre
    // o solo pré-renderizado (quente e suave de dia, azulado e mais escuro à
    // noite) sem precisar regenerar a textura cara pra cada horário.
    _timePalettes() {
        return {
            dawn: { top: '#2b3a67', mid: '#c96a4e', bottom: '#f2b866', sun: '#ffdca0', crowd: '#3a2f45', torch: true, sunAlpha: 0.75, groundTint: 'rgba(255,180,120,0.16)', shadowAlpha: 0.12 },
            day: { top: '#3d7dc9', mid: '#79b8e8', bottom: '#cbe6f7', sun: '#fff6d8', crowd: '#5a4d3a', torch: false, sunAlpha: 0.9, groundTint: 'rgba(255,240,200,0.10)', shadowAlpha: 0.10 },
            sunset: { top: '#1b1035', mid: '#8a3b5e', bottom: '#e8843f', sun: '#ffb35c', crowd: '#2c2030', torch: true, sunAlpha: 0.8, groundTint: 'rgba(255,120,60,0.20)', shadowAlpha: 0.18 },
            night: { top: '#04050f', mid: '#0c1230', bottom: '#1c2140', sun: '#e8e8ff', crowd: '#0c0c14', torch: true, sunAlpha: 0.85, groundTint: 'rgba(60,90,160,0.32)', shadowAlpha: 0.26 }
        };
    }

    drawArenaBackground(ctx, w, h) {
        const pal = this._timePalettes()[this.arenaTime] || this._timePalettes().sunset;
        const biome = ARENA_BIOMES[this.arenaBiome] || ARENA_BIOMES.coliseu;
        const horizon = this._horizonY(h);
        const t = this._torchClock || 0;

        this._drawSky(ctx, w, h, horizon, pal, t);

        // Plano intermediário: silhueta de fundo própria do bioma (arcos do
        // coliseu, dunas, mata, muralhas, colunas ou picos) — camada de
        // profundidade entre o céu e o solo, nunca a mesma pra todo cenário.
        this._drawBiomeMidground(ctx, w, horizon, biome);

        // Plateia animada: só em arenas com arquibancada de verdade (detalhe
        // poupado em qualidade baixa)
        if (biome.hasCrowd && this.qualityLevel !== 'baixa') this._drawCrowd(ctx, w, horizon, pal.crowd);

        // Bandeiras (ou tattered/rasgadas nas ruínas/templo) balançando ao vento
        if (biome.hasBanners) this._drawBanners(ctx, w, horizon, t, !!biome.bannerTattered);

        // Tochas com chama tremulante (aparecem à noite/entardecer/amanhecer)
        if (pal.torch) {
            this._drawTorch(ctx, w * 0.07, horizon, t);
            this._drawTorch(ctx, w * 0.93, horizon, t);
        }

        // Solo: textura rica pré-renderizada (rachaduras, pedras, vegetação,
        // pegadas, marcas de batalha, props — ver _buildArenaGroundTexture),
        // colada e esticada pra caber na tela atual (barato: um drawImage só,
        // em vez de redesenhar dezenas de elementos todo quadro).
        if (!this._groundCanvas || this._groundBiomeBuilt !== this.arenaBiome) this._buildArenaGroundTexture();
        ctx.drawImage(this._groundCanvas, 0, horizon, w, h - horizon);

        // Banho de luz do horário por cima do solo (quente de dia, azulado à
        // noite) — dinâmico, não precisa regenerar a textura cara.
        ctx.fillStyle = pal.groundTint;
        ctx.fillRect(0, horizon, w, h - horizon);
    }

    // ======================================================================
    // SOLO: textura pré-renderizada por bioma — o "chão" deixa de ser um
    // gradiente liso e passa a ter variação de cor, rachaduras, pedras,
    // vegetação irregular, folhas secas, pegadas, marcas de batalha, manchas
    // antigas e poeira, além dos props espalhados do bioma. Desenhado uma
    // única vez por luta num canvas offscreen (this._groundCanvas, resolução
    // de referência fixa) e reaproveitado (drawImage) a cada quadro — o
    // equivalente, em Canvas puro, a usar um spritesheet em vez de redesenhar
    // dezenas de elementos todo frame.
    // ======================================================================
    _buildArenaGroundTexture() {
        const biome = ARENA_BIOMES[this.arenaBiome] || ARENA_BIOMES.coliseu;
        this._groundBiomeBuilt = this.arenaBiome;

        const W = 1400, H = 360; // resolução de referência; esticado no draw
        if (!this._groundCanvas) this._groundCanvas = document.createElement('canvas');
        const c = this._groundCanvas;
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');

        // 1) Base: gradiente sutil (mais claro perto do horizonte, mais
        // escuro/próximo embaixo — sugere profundidade mesmo no solo plano)
        const base = ctx.createLinearGradient(0, 0, 0, H);
        base.addColorStop(0, biome.ground[0]);
        base.addColorStop(1, biome.ground[3] || biome.ground[0]);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, W, H);

        // 2) Manchas irregulares de variação de cor (terra/pedra/grama) —
        // várias camadas de blobs semitransparentes, nunca uma cor sólida.
        for (let i = 0; i < 26; i++) {
            const x = Utils.randomFloat(0, W), y = Utils.randomFloat(0, H);
            const r = Utils.randomFloat(30, 90);
            ctx.fillStyle = biome.ground[Utils.randomInt(1, biome.ground.length - 1)];
            ctx.globalAlpha = Utils.randomFloat(0.12, 0.28);
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * Utils.randomFloat(0.4, 0.7), Utils.randomFloat(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 3) Tratamentos especiais de bioma (areia, neve, lava, pedra de calçada)
        if (biome.special === 'sand') this._groundSandRipples(ctx, W, H, biome);
        else if (biome.special === 'snow') this._groundSnowOverlay(ctx, W, H, biome);
        else if (biome.special === 'lava') this._groundLavaCracks(ctx, W, H, biome);
        else if (biome.special === 'cobblestone') this._groundCobblestone(ctx, W, H, biome);
        else this._groundCracks(ctx, W, H, biome); // rachaduras comuns de terra/pedra seca

        // 4) Pedras espalhadas (sempre, exceto neve/lava que têm as suas)
        if (biome.special !== 'snow' && biome.special !== 'lava') {
            for (let i = 0; i < 18; i++) this._propRock(ctx, Utils.randomFloat(0, W), Utils.randomFloat(H * 0.3, H), Utils.randomFloat(0.5, 1.3), biome.accent);
        }

        // 5) Vegetação irregular (grama/musgo/plantinhas), quando o bioma tem
        if (biome.vegetation !== 'none') this._groundVegetation(ctx, W, H, biome);

        // 6) Folhas secas espalhadas (mais em biomas com vegetação, algumas
        // sempre presentes como detrito natural)
        const leafCount = biome.vegetation === 'dense' ? 22 : (biome.vegetation === 'none' ? 4 : 12);
        for (let i = 0; i < leafCount; i++) this._propDryLeaf(ctx, Utils.randomFloat(0, W), Utils.randomFloat(H * 0.3, H));

        // 7) Pegadas (trilhas cruzando o solo — sugere que já houve movimento ali)
        this._groundFootprintTrail(ctx, W, H);
        this._groundFootprintTrail(ctx, W, H);

        // 8) Marcas de batalha: sulcos/arranhões escuros e, se o sangue
        // estiver habilitado nas configurações, manchas antigas bem sutis
        // (memória de lutas passadas, não sangue da luta atual)
        for (let i = 0; i < 6; i++) {
            const x = Utils.randomFloat(W * 0.15, W * 0.85), y = Utils.randomFloat(H * 0.4, H * 0.92);
            ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Utils.randomFloat(2, 4);
            ctx.beginPath();
            const ang = Utils.randomFloat(0, Math.PI * 2), len = Utils.randomFloat(14, 30);
            ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.4);
            ctx.stroke();
        }
        if (this.bloodEnabled) {
            for (let i = 0; i < 3; i++) {
                const x = Utils.randomFloat(W * 0.2, W * 0.8), y = Utils.randomFloat(H * 0.45, H * 0.9);
                ctx.fillStyle = 'rgba(90,20,20,0.22)';
                ctx.beginPath();
                ctx.ellipse(x, y, Utils.randomFloat(10, 20), Utils.randomFloat(4, 8), Utils.randomFloat(0, Math.PI), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 9) Props do bioma (pedras grandes, ossos, ruínas, bandeiras caídas,
        // etc) — espalhados nas laterais/frente, deixando o centro livre pro
        // combate (onde os gladiadores ficam posicionados).
        const propFns = { rock: this._propRock, bigRock: this._propBigRock, rubble: this._propRubble,
            bones: this._propBones, brokenShield: this._propBrokenShield, brokenWeapon: this._propBrokenWeapon,
            stake: this._propStake, log: this._propLog, stump: this._propStump, bush: this._propBush,
            deadBush: this._propDeadBush, flower: this._propFlower, brokenPillar: this._propBrokenPillar,
            statue: this._propStatue, oldBanner: this._propOldBanner, torchStake: this._propTorchStake,
            icicleRock: this._propIcicleRock, frozenBanner: this._propFrozenBanner };
        const propCount = Utils.randomInt(6, 9);
        for (let i = 0; i < propCount; i++) {
            const propType = biome.props[Utils.randomInt(0, biome.props.length - 1)];
            const fn = propFns[propType];
            if (!fn) continue;
            // Mantém uma faixa central livre (onde os lutadores ficam) —
            // props só nas laterais (30% esquerda / 30% direita) ou bem à frente.
            const zone = Utils.randomInt(0, 2);
            const x = zone === 0 ? Utils.randomFloat(W * 0.02, W * 0.28)
                : zone === 1 ? Utils.randomFloat(W * 0.72, W * 0.98)
                : Utils.randomFloat(W * 0.1, W * 0.9);
            const y = zone === 2 ? Utils.randomFloat(H * 0.78, H * 0.96) : Utils.randomFloat(H * 0.45, H * 0.92);
            const scale = 0.7 + (y / H) * 0.7; // mais perto (embaixo) = maior, sugere profundidade
            fn.call(this, ctx, x, y, scale, biome.accent);
        }

        // 10) Poeira fina por cima de tudo (speckle discreto)
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 60; i++) {
            ctx.fillRect(Utils.randomFloat(0, W), Utils.randomFloat(0, H), 1.5, 1.5);
        }
    }

    // --- Tratamentos especiais de solo por bioma ---

    _groundSandRipples(ctx, W, H, biome) {
        ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            const y = (i / 10) * H + Utils.randomFloat(-8, 8);
            ctx.beginPath();
            for (let x = 0; x <= W; x += 40) {
                const yy = y + Math.sin(x * 0.03 + i) * 5;
                if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
    }

    _groundSnowOverlay(ctx, W, H, biome) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 40; i++) {
            const x = Utils.randomFloat(0, W), y = Utils.randomFloat(0, H);
            ctx.beginPath();
            ctx.ellipse(x, y, Utils.randomFloat(18, 45), Utils.randomFloat(6, 14), 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 80; i++) ctx.fillRect(Utils.randomFloat(0, W), Utils.randomFloat(0, H), 2, 2);
    }

    _groundLavaCracks(ctx, W, H, biome) {
        for (let i = 0; i < 8; i++) {
            const x0 = Utils.randomFloat(0, W), y0 = Utils.randomFloat(0, H);
            ctx.strokeStyle = biome.accent; ctx.lineWidth = Utils.randomFloat(1.5, 3);
            ctx.shadowColor = biome.accent; ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            let x = x0, y = y0;
            for (let k = 0; k < 4; k++) {
                x += Utils.randomFloat(-40, 40); y += Utils.randomFloat(-20, 20);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    _groundCobblestone(ctx, W, H, biome) {
        const size = 46;
        for (let y = 0; y < H; y += size * 0.8) {
            for (let x = 0; x < W; x += size) {
                const ox = (Math.round(y / size) % 2) * size / 2;
                ctx.fillStyle = biome.ground[Utils.randomInt(0, biome.ground.length - 1)];
                ctx.globalAlpha = 0.5;
                this._roundRect(ctx, x + ox - size * 0.42, y - size * 0.36, size * 0.84, size * 0.68, 4);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    _groundCracks(ctx, W, H, biome) {
        for (let i = 0; i < 9; i++) {
            const x0 = Utils.randomFloat(0, W), y0 = Utils.randomFloat(H * 0.2, H);
            ctx.strokeStyle = biome.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = Utils.randomFloat(1, 2.2);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            let x = x0, y = y0;
            const branches = Utils.randomInt(3, 5);
            for (let k = 0; k < branches; k++) {
                x += Utils.randomFloat(-35, 35); y += Utils.randomFloat(-18, 18);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    _groundVegetation(ctx, W, H, biome) {
        const density = biome.vegetation === 'dense' ? 55 : (biome.vegetation === 'medium' ? 32 : (biome.vegetation === 'moss' ? 18 : 14));
        const color = biome.vegetation === 'moss' ? 'rgba(90,110,60,0.5)' : '#3a5a2a';
        for (let i = 0; i < density; i++) {
            const x = Utils.randomFloat(0, W), y = Utils.randomFloat(H * 0.35, H);
            if (biome.vegetation === 'moss') {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(x, y, Utils.randomFloat(8, 18), Utils.randomFloat(4, 8), 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Tufo de grama irregular: 3-4 lâminas finas em leque
                ctx.strokeStyle = color; ctx.lineWidth = 1.4;
                const blades = 3 + Utils.randomInt(0, 2);
                for (let b = 0; b < blades; b++) {
                    const ang = -Math.PI / 2 + Utils.randomFloat(-0.5, 0.5);
                    const len = Utils.randomFloat(6, 14);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 - 2, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
                    ctx.stroke();
                }
            }
        }
    }

    _groundFootprintTrail(ctx, W, H) {
        const y0 = Utils.randomFloat(H * 0.4, H * 0.55);
        const dir = Utils.chance(50) ? 1 : -1;
        let x = Utils.randomFloat(W * 0.2, W * 0.8);
        const steps = Utils.randomInt(5, 9);
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        for (let i = 0; i < steps; i++) {
            const y = y0 + i * 9;
            const side = i % 2 === 0 ? -5 : 5;
            ctx.beginPath();
            ctx.ellipse(x + side, y, 5, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();
            x += dir * Utils.randomFloat(3, 7);
        }
    }

    // --- Biblioteca de props (cada um recebe ctx, x, y, scale, accentColor) ---

    _propRock(ctx, x, y, s, accent) {
        ctx.fillStyle = '#5a564a';
        ctx.beginPath();
        ctx.ellipse(x, y, 9 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.ellipse(x - 2 * s, y - 2 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    _propBigRock(ctx, x, y, s, accent) {
        ctx.fillStyle = '#4a463c';
        ctx.beginPath();
        ctx.moveTo(x - 22 * s, y);
        ctx.lineTo(x - 14 * s, y - 26 * s);
        ctx.lineTo(x + 6 * s, y - 32 * s);
        ctx.lineTo(x + 22 * s, y - 8 * s);
        ctx.lineTo(x + 16 * s, y + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 10 * s, y - 20 * s); ctx.lineTo(x, y - 26 * s); ctx.stroke();
    }

    _propRubble(ctx, x, y, s, accent) {
        for (let i = 0; i < 4; i++) this._propRock(ctx, x + Utils.randomFloat(-14, 14) * s, y + Utils.randomFloat(-6, 6) * s, s * Utils.randomFloat(0.4, 0.8), accent);
    }

    _propBones(ctx, x, y, s, accent) {
        ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 12 * s, y); ctx.lineTo(x + 12 * s, y - 4 * s); ctx.stroke();
        ctx.fillStyle = '#c9c0ac';
        ctx.beginPath(); ctx.arc(x, y - 12 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); // caveira simplificada
        ctx.fillStyle = '#3a352a';
        ctx.beginPath(); ctx.arc(x - 2 * s, y - 13 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2 * s, y - 13 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = 'butt';
    }

    _propBrokenShield(ctx, x, y, s, accent) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.3);
        ctx.fillStyle = '#5a4632'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14 * s, 18 * s, 0, -0.2, Math.PI * 1.5);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    _propBrokenWeapon(ctx, x, y, s, accent) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.6);
        ctx.fillStyle = '#8891a0';
        ctx.fillRect(-2 * s, -18 * s, 4 * s, 20 * s);
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(-5 * s, 0, 10 * s, 6 * s);
        ctx.restore();
    }

    _propStake(ctx, x, y, s, accent) {
        ctx.fillStyle = '#4a3826';
        ctx.beginPath();
        ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 2 * s, y - 30 * s); ctx.lineTo(x + 2 * s, y - 30 * s); ctx.lineTo(x + 3 * s, y);
        ctx.closePath(); ctx.fill();
    }

    _propLog(ctx, x, y, s, accent) {
        ctx.fillStyle = '#5a4327';
        this._roundRect(ctx, x - 24 * s, y - 8 * s, 48 * s, 12 * s, 6 * s);
        ctx.fill();
        ctx.fillStyle = '#3a2c18';
        ctx.beginPath(); ctx.ellipse(x - 24 * s, y - 2 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    _propStump(ctx, x, y, s, accent) {
        ctx.fillStyle = '#4a3826';
        this._roundRect(ctx, x - 10 * s, y - 14 * s, 20 * s, 14 * s, 3 * s);
        ctx.fill();
        ctx.fillStyle = '#8a6a42';
        ctx.beginPath(); ctx.ellipse(x, y - 14 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    _propBush(ctx, x, y, s, accent) {
        ctx.fillStyle = '#3a5a2a';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(x + i * 8 * s, y - Math.abs(i) * 3 * s, 9 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _propDeadBush(ctx, x, y, s, accent) {
        ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.5 * s;
        for (let i = 0; i < 6; i++) {
            const ang = -Math.PI / 2 + (i - 2.5) * 0.35;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(ang) * 14 * s, y + Math.sin(ang) * 14 * s);
            ctx.stroke();
        }
    }

    _propFlower(ctx, x, y, s, accent) {
        const colors = ['#e05a7a', '#e8c94a', '#8a6ae0'];
        ctx.fillStyle = colors[Utils.randomInt(0, colors.length - 1)];
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(ang) * 3 * s, y + Math.sin(ang) * 3 * s, 2.5 * s, 2 * s, ang, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#e8c94a';
        ctx.beginPath(); ctx.arc(x, y, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    }

    _propBrokenPillar(ctx, x, y, s, accent) {
        ctx.fillStyle = '#8a8272';
        this._roundRect(ctx, x - 9 * s, y - 34 * s, 18 * s, 34 * s, 2 * s);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 30 * s); ctx.lineTo(x + 2 * s, y - 24 * s); ctx.lineTo(x - 9 * s, y - 18 * s); ctx.closePath(); ctx.fill();
    }

    _propStatue(ctx, x, y, s, accent) {
        ctx.fillStyle = '#9a9282';
        this._roundRect(ctx, x - 7 * s, y - 26 * s, 14 * s, 26 * s, 3 * s);
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 30 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    }

    _propOldBanner(ctx, x, y, s, accent) {
        ctx.strokeStyle = '#4a3826'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(120,80,80,0.5)';
        ctx.beginPath();
        ctx.moveTo(x, y - 26 * s); ctx.lineTo(x + 14 * s, y - 22 * s); ctx.lineTo(x + 4 * s, y - 12 * s); ctx.lineTo(x + 10 * s, y - 4 * s); ctx.lineTo(x, y - 8 * s);
        ctx.closePath(); ctx.fill();
    }

    _propTorchStake(ctx, x, y, s, accent) {
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(x - 2 * s, y - 24 * s, 4 * s, 24 * s);
        ctx.fillStyle = '#ff8a1e';
        ctx.beginPath(); ctx.ellipse(x, y - 28 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    _propIcicleRock(ctx, x, y, s, accent) {
        this._propRock(ctx, x, y, s, accent);
        ctx.fillStyle = 'rgba(200,230,245,0.8)';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x - 6 * s + i * 6 * s, y - 4 * s);
            ctx.lineTo(x - 5 * s + i * 6 * s, y - 4 * s - 10 * s);
            ctx.lineTo(x - 4 * s + i * 6 * s, y - 4 * s);
            ctx.closePath();
            ctx.fill();
        }
    }

    _propFrozenBanner(ctx, x, y, s, accent) {
        ctx.strokeStyle = '#7a8a95'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 28 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(180,210,230,0.55)';
        ctx.fillRect(x, y - 28 * s, 14 * s, 20 * s);
    }

    _propDryLeaf(ctx, x, y) {
        const colors = ['#8a6a2a', '#a3752a', '#6a5222'];
        ctx.fillStyle = colors[Utils.randomInt(0, colors.length - 1)];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Utils.randomFloat(0, Math.PI * 2));
        ctx.beginPath();
        ctx.ellipse(0, 0, Utils.randomFloat(3, 6), Utils.randomFloat(1.5, 2.5), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

            // Estrelas cadentes (ver update()/constructor) — um risco breve
            // com rastro esmaecendo, cruzando o céu na diagonal.
            this._shootingStars.forEach(s => {
                const progress = 1 - s.life;
                const headX = s.x0 * w + progress * s.dx;
                const headY = s.y0 * horizon + progress * s.dy;
                const tailX = headX - (s.dx / 8);
                const tailY = headY - (s.dy / 8);
                const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
                grad.addColorStop(0, `rgba(255,255,255,${starAlpha * s.life})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(headX, headY);
                ctx.lineTo(tailX, tailY);
                ctx.stroke();
            });
        }

        const narrow = w < 560;
        const isNightSky = dayProgress !== null ? starAlpha > 0.5 : this.arenaTime === 'night';
        let moonPos = null;
        if (dayProgress !== null) {
            moonPos = this._drawCelestialArc(ctx, w, horizon, dayProgress, narrow);
        } else {
            // Sol / lua estático por fase (em telas estreitas, encolhe e recua
            // para o canto para não ficar atrás do menu/logo centralizado).
            const sunScale = narrow ? 0.5 : 1;
            const sunX = narrow ? w * 0.91 : w * 0.82;
            const sunY = narrow ? horizon * 0.16 : horizon * 0.3;
            const r = (this.arenaTime === 'night' ? 24 : 38) * sunScale;
            if (this.arenaTime !== 'night') {
                // Sol: núcleo + halo suave de raios (mais realista que um
                // disco liso), sutil e sem exagero.
                ctx.globalAlpha = pal.sunAlpha * 0.35;
                const halo = ctx.createRadialGradient(sunX, sunY, r * 0.6, sunX, sunY, r * 2.2);
                halo.addColorStop(0, pal.sun); halo.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = halo;
                ctx.beginPath(); ctx.arc(sunX, sunY, r * 2.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = pal.sunAlpha;
            ctx.fillStyle = pal.sun;
            ctx.beginPath();
            ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            if (this.arenaTime === 'night') moonPos = { x: sunX, y: sunY, r };
        }

        // Crateras discretas na lua (só quando ela está visível) — dá textura
        // à esfera em vez de um disco liso.
        if (moonPos) {
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = '#8a8aa0';
            ctx.beginPath(); ctx.arc(moonPos.x - moonPos.r * 0.3, moonPos.y - moonPos.r * 0.2, moonPos.r * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(moonPos.x + moonPos.r * 0.25, moonPos.y + moonPos.r * 0.3, moonPos.r * 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(moonPos.x + moonPos.r * 0.1, moonPos.y - moonPos.r * 0.35, moonPos.r * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Nuvens à deriva — silhueta suave, tingidas pela paleta do horário
        // (mais claras de dia, acinzentadas ao entardecer/amanhecer, quase
        // invisíveis de noite) pra nunca destoar do céu.
        if (this.qualityLevel !== 'baixa') {
            const cloudAlpha = isNightSky ? 0.10 : 0.30;
            ctx.fillStyle = 'rgba(255,255,255,1)';
            this._clouds.forEach(cl => {
                const cx = cl.x * w, cy = cl.y * horizon;
                ctx.globalAlpha = cloudAlpha;
                [-1, 0, 1].forEach(off => {
                    ctx.beginPath();
                    ctx.ellipse(cx + off * 26 * cl.scale, cy + Math.abs(off) * 4 * cl.scale, 30 * cl.scale, 13 * cl.scale, 0, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
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

        return isSun ? null : { x, y, r }; // permite crateras discretas na lua (ver _drawSky)
    }

    // Pano de fundo da Cidade explorável: mesmo céu/sol/lua/estrelas/pássaros
    // e ciclo dia-noite da arena, mas com montanhas distantes no lugar do
    // coliseu — a praça é um lugar diferente da arena de combate, não o
    // mesmo coliseu por trás (CityEngine desenha a praça/prédios por cima).
    drawCityBackdrop(ctx, w, h) {
        const horizon = this._horizonY(h);
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

    // Despacha a silhueta de fundo (plano intermediário) de acordo com o
    // bioma sorteado — a arena imperial mantém os arcos do coliseu, mas cada
    // outro cenário ganha uma camada de profundidade própria, nunca o mesmo
    // pano de fundo genérico pra tudo.
    _drawBiomeMidground(ctx, w, horizon, biome) {
        switch (biome.midground) {
            case 'colosseum':
                this._drawColosseumRing(ctx, w, horizon, 0.62, '#4a4030');
                this._drawColosseumRing(ctx, w, horizon, 0.38, '#332a1e');
                break;
            case 'dunes':
                this._drawMountainRange(ctx, w, horizon, horizon * 0.22, biome.midgroundColor, 7, 0.9);
                this._drawMountainRange(ctx, w, horizon, horizon * 0.14, 'rgba(0,0,0,0.12)', 9, 3.4);
                break;
            case 'treeline':
                this._drawTreeline(ctx, w, horizon, biome.midgroundColor);
                break;
            case 'walls':
                this._drawWalls(ctx, w, horizon, biome.midgroundColor, !!biome.midgroundBroken);
                break;
            case 'columns':
                this._drawColumnRow(ctx, w, horizon, biome.midgroundColor);
                break;
            case 'peaks':
                this._drawMountainRange(ctx, w, horizon, horizon * 0.5, biome.midgroundColor, 5, 0.4);
                this._drawMountainRange(ctx, w, horizon, horizon * 0.32, 'rgba(20,16,20,0.35)', 6, 2.1);
                break;
            default:
                this._drawColosseumRing(ctx, w, horizon, 0.62, '#4a4030');
        }
    }

    // Linha de árvores densas — copas irregulares sobrepostas, mais escuras
    // no fundo pra dar profundidade (Floresta).
    _drawTreeline(ctx, w, horizon, color) {
        ctx.fillStyle = color;
        const count = 14;
        for (let i = 0; i < count; i++) {
            const x = (i / count) * w + (i % 2 === 0 ? 10 : -10);
            const canopyR = 34 + (i % 3) * 8;
            const trunkH = 30;
            ctx.fillRect(x - 3, horizon - trunkH, 6, trunkH + 4);
            ctx.beginPath();
            ctx.arc(x, horizon - trunkH - canopyR * 0.5, canopyR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Muralhas de pedra (Castelo íntegro, ou Ruínas com o topo quebrado
    // irregular em vez da linha reta das ameias).
    _drawWalls(ctx, w, horizon, color, broken) {
        const wallH = horizon * 0.4;
        const topY = horizon - wallH;
        ctx.fillStyle = color;
        if (!broken) {
            ctx.fillRect(0, topY, w, wallH);
            // Ameias (merlons) no topo
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            const step = 40;
            for (let x = 0; x < w; x += step) ctx.fillRect(x, topY, step * 0.5, 10);
        } else {
            // Muralha desmoronada: topo irregular, brechas ocasionais
            ctx.beginPath();
            ctx.moveTo(0, horizon);
            let x = 0;
            while (x < w) {
                const seg = Utils.randomFloat(50, 110);
                const gap = Utils.chance(20);
                const yTop = gap ? horizon - wallH * 0.25 : topY + Utils.randomFloat(-14, 14);
                ctx.lineTo(x, yTop);
                x += seg;
                ctx.lineTo(x, yTop);
            }
            ctx.lineTo(w, horizon);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Fileira de colunas de pedra (Templo) — algumas já quebradas pela metade.
    _drawColumnRow(ctx, w, horizon, color) {
        ctx.fillStyle = color;
        const count = 9;
        for (let i = 0; i < count; i++) {
            const x = (i / count) * w + w / (count * 2);
            const broken = Utils.chance(30);
            const colH = horizon * (broken ? 0.22 : 0.42);
            ctx.fillRect(x - 8, horizon - colH, 16, colH);
            if (!broken) ctx.fillRect(x - 12, horizon - colH - 6, 24, 8); // capitel
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

    // tattered: bandeiras velhas e rasgadas (Ruínas/Templo) — pano puído com
    // um rasgo triangular e cor desbotada, em vez do estandarte cheio da
    // arena imperial. Reforça que aquele cenário já viu dias melhores.
    _drawBanners(ctx, w, horizon, t, tattered = false) {
        const positions = [0.13, 0.36, 0.64, 0.87];
        positions.forEach((fx, i) => {
            const x = fx * w;
            const y = horizon - 78;
            const sway = Math.sin(t * 2 + i * 1.4) * 6;

            ctx.strokeStyle = '#2a2118';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x, y + (tattered ? 30 : 44));
            ctx.stroke();

            ctx.globalAlpha = tattered ? 0.55 : 1;
            ctx.fillStyle = i % 2 === 0 ? (tattered ? '#5a3a3a' : '#7a1f1f') : (tattered ? '#5a4a3a' : '#8a5a2b');
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + (tattered ? 24 : 40));
            if (tattered) {
                // Pano rasgado: ponta irregular em vez da curva cheia
                ctx.lineTo(x + 6, y + 14);
                ctx.lineTo(x + 12, y + 20);
                ctx.lineTo(x + 8 + sway * 0.4, y + 6);
            } else {
                ctx.quadraticCurveTo(x + 15 + sway, y + 30, x + 3 + sway, y + 18);
                ctx.quadraticCurveTo(x + 15 + sway, y + 6, x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
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
                const critMult = anim.crit ? 1.7 : 1;
                pose.offsetX = -12 * k * critMult;
                pose.torsoLean -= 14 * k * critMult;
                // Crítico: compressão rápida (impacto) seguida de leve
                // expansão, além do recuo — diferencia visualmente um
                // acerto crítico de um golpe comum além da cor do número.
                if (anim.crit) pose.torsoScaleY *= 1 - 0.12 * Math.sin(Math.min(t, 1) * Math.PI * 2) * (1 - Math.min(t, 1));
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
            case 'boss_bats': { // Conde Vampiro: Enxame de Morcegos — gesto amplo e caótico convocando o enxame
                const k = Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                pose.weaponAngle -= 70 * Math.sin(t * Math.PI * 3); // agito rápido, irregular
                pose.torsoLean += 10 * k;
                pose.offsetX = Math.sin(t * Math.PI * 4) * 6 * k;
                break;
            }
            case 'boss_slam': { // Conde Vampiro: Garra Imortal — golpe pesado de cima pra baixo, atordoante
                const k = Utils.clamp(t / 0.5, 0, 1);
                pose.weaponAngle = Utils.lerp(-90, 40, k);
                pose.offsetY = Math.sin(Utils.clamp(t, 0, 1) * Math.PI) * 10;
                pose.torsoLean += 14 * Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                break;
            }
            case 'boss_judgment': { // Anjo Guardião: Julgamento Final — braços erguidos aos céus, depois libera
                const k = Math.sin(Utils.clamp(t, 0, 1) * Math.PI);
                pose.weaponAngle = -140 * k;
                pose.offsetY = -12 * k;
                pose.torsoLean -= 4 * k;
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

        const exclusiveAnims = ['attack', 'hurt', 'death', 'approach', 'retreat', 'run', 'charge', 'push', 'cast', 'prepare', 'boss_bats', 'boss_slam', 'boss_judgment'];
        pose.guard = !!isDefending && !exclusiveAnims.includes(anim.type);
        return pose;
    }

    drawGladiator(ctx, x, y, entity, isPlayer, anim, battleState) {
        const pose = this.computePose(anim, battleState && battleState.isDefending);
        // Fadiga (só o Player tem esse campo, ver player.js addFatigue — já
        // reduz dano/esquiva em -8% por estágio, mas até agora era 100%
        // invisível no modelo: o número "Fadiga: X/3" no HUD era a única
        // pista). Curva levemente a postura pra frente/baixo proporcional
        // aos 0-3 estágios acumulados, discreto o bastante pra não brigar
        // com nenhuma pose de animação em curso.
        if (entity.fatigue) {
            const droop = entity.fatigue * 2.5;
            pose.offsetY += droop;
            pose.torsoLean += droop * 0.6;
        }
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

        this._drawLineageAura(ctx, entity); // aura/fumaça da Linhagem — atrás de tudo, igual à capa
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

    // Só o contorno do quadrilátero afunilado (sem preencher) — compartilhado
    // entre o preenchimento base e a sobreposição de sombra em
    // _drawTaperedLimb, pra nunca duas cópias do mesmo cálculo de path.
    _taperedLimbPath(ctx, x0, y0, y1, wStart, wEnd) {
        ctx.beginPath();
        ctx.moveTo(x0 - wStart / 2, y0);
        ctx.lineTo(x0 + wStart / 2, y0);
        ctx.lineTo(x0 + wEnd / 2, y1);
        ctx.lineTo(x0 - wEnd / 2, y1);
        ctx.closePath();
    }

    // Quadrilátero afunilado entre duas alturas locais (y0->y1) com larguras
    // diferentes em cada ponta — substitui os retângulos "de bloco" antigos
    // de braços/pernas por membros com silhueta humana de verdade.
    _drawTaperedLimb(ctx, x0, y0, y1, wStart, wEnd) {
        this._taperedLimbPath(ctx, x0, y0, y1, wStart, wEnd);
        ctx.fill();

        // Sombreamento direcional (mesma luz vindo da esquerda usada em
        // _drawTorso) — antes só o torso tinha esse volume; braços e pernas
        // ficavam com preenchimento chapado (uma perna nem tinha a linha de
        // sombra improvisada que a outra tinha). Agora os 4 membros recebem
        // o mesmo tratamento de luz consistente.
        const halfW = Math.max(wStart, wEnd) / 2;
        const shade = ctx.createLinearGradient(x0 - halfW, 0, x0 + halfW, 0);
        shade.addColorStop(0, 'rgba(255,255,255,0.16)');
        shade.addColorStop(0.5, 'rgba(255,255,255,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.24)');
        const prevStyle = ctx.fillStyle;
        ctx.fillStyle = shade;
        this._taperedLimbPath(ctx, x0, y0, y1, wStart, wEnd);
        ctx.fill();
        ctx.fillStyle = prevStyle;
    }

    // Capa/manto atrás dos ombros — só alguns arquétipos têm (Campeão: capa
    // ampla e dourada; Cavaleiro: capa curta de nobreza); balança levemente
    // com o idle, sem depender de nenhum equipamento específico.
    // Aura/fumaça da Linhagem (ver lineages.js `visual`) — um halo suave
    // atrás do personagem, independente de arquétipo/equipamento. Luz ganha
    // um brilho dourado com partículas subindo; Sombras (ainda bloqueada,
    // mas com a arquitetura pronta) ganharia fumaça escura viva.
    _drawLineageAura(ctx, entity) {
        const v = entity && entity.visuals;
        if (!v || (!v.hasAura && !v.hasSmoke)) return;
        const legLen = this._legLen();
        const cy = -legLen - this._torsoH() * 0.6;
        const t = performance.now() / 1000;

        if (v.hasAura) {
            const r = 46 + Math.sin(t * 1.5) * 4;
            const glow = ctx.createRadialGradient(0, cy, 4, 0, cy, r);
            glow.addColorStop(0, v.auraColor || 'rgba(255,242,192,0.35)');
            glow.addColorStop(1, 'rgba(255,242,192,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, cy, r, 0, Math.PI * 2);
            ctx.fill();

            // `particle` (ver lineages.js) diferencia o efeito por linhagem —
            // Luz sobe partículas douradas; o comentário acima desta função
            // já prometia isso, mas nada lia o campo até agora.
            if (v.particle === 'light_motes') {
                const cycle = 2.2;
                ctx.fillStyle = v.auraColor || '#fff2c0';
                for (let i = 0; i < 6; i++) {
                    const phase = ((t + i * (cycle / 6)) % cycle) / cycle;
                    const mx = Math.sin(t * 0.8 + i * 2.1) * (14 + i * 2);
                    const my = cy - phase * 60;
                    const alpha = Math.sin(phase * Math.PI);
                    ctx.globalAlpha = alpha * 0.85;
                    ctx.beginPath();
                    ctx.arc(mx, my, 1.6 + (1 - phase) * 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            } else if (v.particle === 'elite_sparks') {
                // Inimigo Elite (ver enemy.js ELITE_ENEMY_CHANCE): faíscas
                // douradas irradiando pra fora, bem diferentes do fluxo
                // ascendente e suave da Linhagem Luz — reforça visualmente
                // que este é um combatente perigoso à parte, não só um
                // prefixo no nome.
                const cycle = 1.4;
                ctx.fillStyle = v.auraColor || '#ffd700';
                for (let i = 0; i < 8; i++) {
                    const phase = ((t + i * (cycle / 8)) % cycle) / cycle;
                    const angle = (i / 8) * Math.PI * 2 + t * 0.6;
                    const dist = phase * 42;
                    const sx = Math.cos(angle) * dist;
                    const sy = cy + Math.sin(angle) * dist * 0.6;
                    const alpha = 1 - phase;
                    ctx.globalAlpha = alpha * 0.9;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2 - phase * 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        } else if (v.hasSmoke) {
            ctx.fillStyle = 'rgba(20,15,25,0.3)';
            for (let i = 0; i < 3; i++) {
                const wob = Math.sin(t * 1.2 + i * 2) * 6;
                ctx.beginPath();
                ctx.ellipse(wob, cy - i * 14, 22 - i * 3, 14, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

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
        this._drawRaceSash(ctx, entity, m, torsoH);

        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(-m.waist / 2, -12, m.waist, 6);
        ctx.restore();
    }

    // Faixa/baldric diagonal com a cor cultural da Raça (ver races.js
    // `accent`) — antes Raça era só uma camada de bônus/penalidade de
    // atributo (Entity.getTotalStat em player.js), sem NENHUMA marca visual
    // distinguindo um Espartano de um Ateniense na arena. Humano não tem
    // `accent` (raça "neutra") e não desenha nada aqui.
    _drawRaceSash(ctx, entity, m, torsoH) {
        const race = entity.race && window.RACES ? window.RACES[entity.race] : null;
        if (!race || !race.accent) return;
        ctx.save();
        ctx.strokeStyle = race.accent;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-m.shoulder / 2 + 2, -torsoH + 8);
        ctx.lineTo(m.waist / 2 - 2, -8);
        ctx.stroke();
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

        // Olhos brilhantes (Linhagem Luz): halo suave em volta do olho, além
        // da cor normal — não é só uma cor diferente, é luminoso de verdade.
        if (v.hasAura) {
            ctx.fillStyle = v.eyeColor || '#fff6d8';
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(10, headY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = v.eyeColor || '#1a1a1a';
        ctx.beginPath();
        ctx.arc(10, headY, 2, 0, Math.PI * 2);
        ctx.fill();

        this._drawMouth(ctx, v, headY, pose);
        this._drawScar(ctx, v, headY, headR);
        this._drawFangs(ctx, v, headY);

        if (!helmet) this._drawHair(ctx, v, headY, headR, false);
        this._drawFacialHair(ctx, v, headY);
        this._drawArchetypeHeadSignature(ctx, entity, headY, headR);
        if (helmet) this._drawHelmet(ctx, helmet, headY, headR);
    }

    // Presas pequenas (Linhagem Vampirismo) — dois triângulos discretos na
    // borda inferior da boca. Puramente estético, igual cicatriz/cabelo.
    _drawFangs(ctx, v, headY) {
        if (!v.hasFangs) return;
        ctx.fillStyle = '#fff8ec';
        ctx.beginPath();
        ctx.moveTo(4, headY + 8); ctx.lineTo(5.5, headY + 12); ctx.lineTo(7, headY + 8);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9, headY + 8); ctx.lineTo(10.5, headY + 12); ctx.lineTo(12, headY + 8);
        ctx.closePath(); ctx.fill();
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

    // Capacetes de couro e de metal tinham exatamente a mesma forma antes
    // (só a cor da crista, vinda da raridade, mudava) — "equipamentos sem
    // identidade" apontado em auditoria. Agora o material do próprio item
    // (`leathercap` vs qualquer capacete de metal) muda cor base e brilho:
    // couro fica fosco e marrom, metal continua cinza com o realce
    // especular de antes.
    _drawHelmet(ctx, item, headY, headR) {
        const crestColor = item.rarity ? item.rarity.color : '#d4af37';
        const isLeather = item.id === 'leathercap';
        ctx.fillStyle = isLeather ? '#5a4028' : '#8891a0';
        ctx.beginPath();
        ctx.arc(0, headY - 4, headR + 2, Math.PI, Math.PI * 2.05);
        ctx.fill();
        ctx.fillRect(-headR - 2, headY - 4, 4, 15);
        ctx.fillRect(headR - 2, headY - 4, 4, 15);

        // Brilho metálico no topo — só em capacetes de metal; couro é fosco
        // por natureza, então nunca ganha esse realce especular.
        if (!isLeather) {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(-headR * 0.3, headY - 4, headR - 3, Math.PI * 1.05, Math.PI * 1.4);
            ctx.stroke();
        }

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

        // Registry orientado a dados (id -> função de desenho), em vez de um
        // switch grande: uma arma nova só precisa registrar sua própria
        // entrada aqui (ver WEAPON_RENDERERS), sem tocar em nenhum outro
        // código de renderização. Sem entrada correspondente, cai no
        // `default` (espada genérica) — nunca quebra pra uma arma futura
        // ainda não desenhada especificamente.
        const draw = WEAPON_RENDERERS[weapon.id] || WEAPON_RENDERERS.default;
        draw(ctx);

        // Brilho elemental do Encantamento (ver enchantments.js) — a arma
        // nunca mostrava visualmente estar encantada, só o VFX passageiro
        // do acerto (ver battle.js executeAttack, enchantEff.particleColor).
        // Reaproveita a MESMA cor já definida por encantamento, sem precisar
        // de nenhum campo visual novo — aura sutil e pulsante na lâmina.
        if (weapon.enchantmentId && window.ENCHANTMENTS) {
            const ench = window.ENCHANTMENTS[weapon.enchantmentId];
            if (ench) {
                const pulse = 0.35 + Math.sin(performance.now() / 333) * 0.15;
                ctx.save();
                ctx.globalAlpha = pulse;
                ctx.fillStyle = ench.color;
                ctx.beginPath();
                ctx.arc(8, 0, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

// Cada função recebe o contexto já posicionado/rotacionado na mão do
// lutador (ver _drawWeapon acima) e desenha só a "lâmina"/cabeça da arma —
// o cabo comum já foi desenhado antes de chamar o registry.
const WEAPON_RENDERERS = {
    w_02(ctx) { // Machado
        ctx.beginPath();
        ctx.moveTo(12, -4); ctx.lineTo(34, -17); ctx.lineTo(39, 0); ctx.lineTo(34, 17); ctx.lineTo(12, 4);
        ctx.closePath(); ctx.fill();
    },
    w_03(ctx) { // Adaga
        ctx.beginPath();
        ctx.moveTo(12, -3); ctx.lineTo(27, 0); ctx.lineTo(12, 3);
        ctx.closePath(); ctx.fill();
    },
    w_04(ctx) { // Martelo de Guerra
        ctx.fillRect(12, -11, 27, 22);
        ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 1; ctx.strokeRect(12, -11, 27, 22);
    },
    w_05(ctx) { // Lança
        ctx.fillRect(12, -2, 52, 4);
        ctx.beginPath();
        ctx.moveTo(64, -6); ctx.lineTo(76, 0); ctx.lineTo(64, 6);
        ctx.closePath(); ctx.fill();
    },
    w_06(ctx) { // Rapieira
        ctx.fillRect(12, -1.5, 46, 3);
        ctx.strokeStyle = '#c7ccd1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.stroke();
    },
    w_07(ctx) { // Espada Longa: lâmina mais comprida e larga que a curta
        ctx.fillRect(12, -3.5, 54, 7);
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(10, -9, 4, 18);
    },
    w_08(ctx) { // Chicote: tira fina e ondulada saindo do cabo
        ctx.strokeStyle = '#4a3826'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(30, -14, 46, 2);
        ctx.quadraticCurveTo(58, 12, 50, 22);
        ctx.stroke();
    },
    w_09(ctx) { // Arco Curto: arco recurvo com corda, empunhado verticalmente
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(6, 0, 22, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
        ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, -18.5); ctx.lineTo(20, 18.5);
        ctx.stroke();
    },
    w_10(ctx) { // Besta de Aço: estrutura (trilho) + arco curto horizontal
        ctx.fillRect(8, -2.5, 34, 5);
        ctx.strokeStyle = '#8891a0'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(16, 0, 16, Math.PI * 0.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, -14); ctx.lineTo(24, 14);
        ctx.stroke();
    },
    default(ctx) { // w_01 e qualquer arma futura não mapeada: espada genérica
        ctx.fillRect(12, -3, 40, 6);
        ctx.fillStyle = '#3a2f22';
        ctx.fillRect(10, -8, 4, 16);
    }
};

window.GFX = new GraphicsEngine();
