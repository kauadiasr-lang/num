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
        const oldWidth = this.width, oldHeight = this.height;
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

        // Bug reportado: o personagem "desaparecia" na Cidade depois de uma
        // barra de endereço do celular aparecer/sumir (ou o navegador ser
        // redimensionado) — prédios/NPCs comuns já reposicionam sozinhos a
        // cada frame (xFrac/rowOffset relativos à tela atual, ver city.js
        // draw()), mas o jogador e os NPCs guardam coordenadas em pixel
        // ABSOLUTO, fixadas só uma vez ao entrar na Cidade. Depois de um
        // resize, essas coordenadas absolutas ficavam desproporcionais ao
        // novo tamanho de tela — o jogador ainda "existia", só ficava longe
        // de onde os prédios foram redesenhados, muitas vezes perto da
        // borda ou fora da área visível. Reescala tudo proporcionalmente.
        if (window.City && window.City.handleResize && oldWidth > 0 && oldHeight > 0) {
            window.City.handleResize(oldWidth, oldHeight, this.width, this.height);
        }
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
        validateGameData();
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

        // Mundo da Estrada (Fase 2, ver js/road.js): trajeto real entre
        // cidades. Só age quando a tela é ROADWORLD (ver RoadEngine._isActive).
        if (window.RoadEngine) window.RoadEngine.update(dt);

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

// Validação de integridade dos registries de dados (SkillDatabase, RACES,
// LINEAGES, AchievementDB, RivalDatabase, CityEngine.NPC_PROFESSIONS) — roda
// uma vez no boot (ver onAssetsLoaded) e só ALERTA no console via
// console.warn; nunca interrompe o carregamento nem altera nada. Vários dos
// bugs reais corrigidos ao longo do projeto (promoção de loja sem efeito,
// título de loja errado) só apareciam em runtime bem específico porque
// nenhuma verificação central conferia se um registro batia com o formato
// que o código consumidor espera — isso pega erros de digitação/typo em
// registros novos (campo ausente, id duplicado) na hora do carregamento.
function validateGameData() {
    const problems = [];
    const need = (cond, msg) => { if (!cond) problems.push(msg); };

    if (typeof SkillDatabase !== 'undefined') {
        for (const key in SkillDatabase) {
            const s = SkillDatabase[key];
            need(s.id === key, `SkillDatabase['${key}']: id ('${s.id}') não bate com a chave do registro`);
            need(typeof SKILL_TYPES[s.type] === 'string', `SkillDatabase['${key}']: type '${s.type}' não existe em SKILL_TYPES`);
            need(typeof s.mpCost === 'number', `SkillDatabase['${key}']: mpCost ausente/inválido`);
            need(typeof s.powerMulti === 'number', `SkillDatabase['${key}']: powerMulti ausente/inválido`);
            need(typeof s.levelReq === 'number', `SkillDatabase['${key}']: levelReq ausente/inválido`);
        }
    }

    if (window.RACES) {
        for (const key in window.RACES) {
            const r = window.RACES[key];
            need(r.id === key, `RACES['${key}']: id ('${r.id}') não bate com a chave do registro`);
            need(typeof r.statMods === 'object', `RACES['${key}']: statMods ausente`);
            if (r.passive) {
                need(typeof r.passive.statKey === 'string' && typeof r.passive.value === 'number',
                    `RACES['${key}']: passive presente mas statKey/value inválidos`);
            }
        }
    }

    if (window.LINEAGES) {
        for (const key in window.LINEAGES) {
            const l = window.LINEAGES[key];
            need(l.id === key, `LINEAGES['${key}']: id ('${l.id}') não bate com a chave do registro`);
            need(typeof l.locked === 'boolean', `LINEAGES['${key}']: locked ausente`);
            if (!l.locked) {
                need(!!l.skillTreeId, `LINEAGES['${key}']: não bloqueada mas sem skillTreeId`);

                // Sombras (ver corruption.js CorruptionSystem) é a primeira
                // exceção real a essa regra: nunca desperta por um Ritual +
                // boss como Vampirismo/Luz, só pela Corrupção do Amuleto do
                // Guardião da Natureza — por isso NUNCA tem ritualId/bossId,
                // de propósito (`awakensVia: 'corruption'` documenta a
                // exceção explicitamente, pra nunca parecer um campo
                // esquecido por engano). Toda linhagem SEM essa flag
                // continua exigindo ritualId/bossId como sempre.
                if (l.awakensVia !== 'corruption') {
                    need(!!l.ritualId, `LINEAGES['${key}']: não bloqueada mas sem ritualId`);
                    need(!!l.bossId, `LINEAGES['${key}']: não bloqueada mas sem bossId`);
                } else {
                    need(l.ritualId === null && l.bossId === null, `LINEAGES['${key}']: awakensVia:'corruption' mas ainda tem ritualId/bossId (deveria ser null)`);
                }

                // Bug de auditoria: skillTreeId/ritualId/bossId só eram
                // checados quanto a "existe algo aqui", nunca quanto a "o
                // que está aqui aponta pra um registro de verdade" — a
                // MESMA classe de referência cruzada já coberta pra
                // arenaBiomes/raceDemographics/NPC_PROFESSIONS_REGIONAL/
                // SHOP_GREETINGS_REGIONAL/NPC_DIALOGUE/CITY_MUSIC_MOODS
                // acima, só que esquecida justamente no primeiro registry
                // de variante que o projeto criou. Um typo em qualquer um
                // dos três nunca quebraria nada visivelmente na hora (o
                // jogador simplesmente nunca conseguiria completar aquele
                // Ritual/enfrentar aquele boss), então sem essa checagem o
                // erro passaria despercebido até alguém tentar de verdade.
                if (typeof SKILL_TREES !== 'undefined') {
                    need(!!SKILL_TREES[l.skillTreeId], `LINEAGES['${key}']: skillTreeId '${l.skillTreeId}' não existe em SKILL_TREES`);
                }
                if (l.awakensVia !== 'corruption') {
                    if (typeof RITUALS !== 'undefined') {
                        need(!!RITUALS[l.ritualId], `LINEAGES['${key}']: ritualId '${l.ritualId}' não existe em RITUALS`);
                    }
                    if (typeof BOSS_DEFS !== 'undefined') {
                        need(!!BOSS_DEFS[l.bossId], `LINEAGES['${key}']: bossId '${l.bossId}' não existe em BOSS_DEFS`);
                    }
                }
            }
        }
    }

    if (window.AchievementDB) {
        for (const key in window.AchievementDB) {
            const a = window.AchievementDB[key];
            need(a.id === key, `AchievementDB['${key}']: id ('${a.id}') não bate com a chave do registro`);
            need(!!a.name && !!a.description && !!a.rarity && !!a.icon, `AchievementDB['${key}']: campo obrigatório ausente (name/description/rarity/icon)`);
        }
    }

    if (window.RivalDatabase && Array.isArray(window.RivalDatabase.leagues)) {
        // Referências cruzadas contra os MESMOS registros de IA já
        // validados acima pra AI_FIGHTING_STYLES/AI_COMBOS (personalityId/
        // styleId/unlockSkill) — bug de auditoria: a Ladder de Rivais
        // curada consome exatamente esses três registros (ver
        // AICombat.assignProfile em Rival, e Rival.phases em battle.js/
        // bossai.js pro sistema de fases de Campeão), mas nunca tinha
        // ganhado a mesma checagem de referência cruzada. Hoje todo id
        // aqui resolve certo (nenhum problema real encontrado), mas um
        // typo futuro em qualquer um deles passaria despercebido: ai.js
        // AICombat.assignProfile já mascara personalityId/styleId
        // inválidos caindo em fallback silencioso (nunca explode), e um
        // unlockSkill inexistente simplesmente nunca apareceria no menu de
        // habilidades quando a fase do Campeão mudasse — os dois tipos de
        // bug "silencioso" que os validadores de registry deste projeto
        // existem justamente pra pegar.
        const knownPersonalityIds = typeof AI_PERSONALITIES !== 'undefined' ? Object.keys(AI_PERSONALITIES) : null;
        const knownStyleIds = typeof AI_FIGHTING_STYLES !== 'undefined' ? Object.keys(AI_FIGHTING_STYLES) : null;
        const knownSkillIds3 = typeof SkillDatabase !== 'undefined' ? Object.keys(SkillDatabase) : null;
        const knownRaceIds = window.RACES ? Object.keys(window.RACES) : null;
        window.RivalDatabase.leagues.forEach(league => {
            need(!!league.id && !!league.name && Array.isArray(league.rivals), `RivalDatabase: liga malformada (${JSON.stringify(league.id)})`);
            (league.rivals || []).forEach(rival => {
                need(!!rival.id && !!rival.name && typeof rival.level === 'number', `RivalDatabase['${league.id}']: rival malformado (${JSON.stringify(rival.id)})`);
                if (knownPersonalityIds && rival.personalityId) {
                    need(knownPersonalityIds.includes(rival.personalityId), `RivalDatabase['${league.id}']['${rival.id}']: personalityId '${rival.personalityId}' não existe em AI_PERSONALITIES`);
                }
                if (knownStyleIds && rival.styleId) {
                    need(knownStyleIds.includes(rival.styleId), `RivalDatabase['${league.id}']['${rival.id}']: styleId '${rival.styleId}' não existe em AI_FIGHTING_STYLES`);
                }
                if (knownRaceIds && rival.race) {
                    need(knownRaceIds.includes(rival.race), `RivalDatabase['${league.id}']['${rival.id}']: race '${rival.race}' não existe em RACES`);
                }
                if (Array.isArray(rival.phases)) {
                    rival.phases.forEach((phase, idx) => {
                        if (knownPersonalityIds && phase.personalityId) {
                            need(knownPersonalityIds.includes(phase.personalityId), `RivalDatabase['${league.id}']['${rival.id}'].phases[${idx}]: personalityId '${phase.personalityId}' não existe em AI_PERSONALITIES`);
                        }
                        if (knownSkillIds3 && phase.unlockSkill) {
                            need(knownSkillIds3.includes(phase.unlockSkill), `RivalDatabase['${league.id}']['${rival.id}'].phases[${idx}]: unlockSkill '${phase.unlockSkill}' não existe em SkillDatabase`);
                        }
                    });
                }
            });
        });
    }

    if (typeof CityEngine !== 'undefined' && CityEngine.NPC_PROFESSIONS) {
        for (const key in CityEngine.NPC_PROFESSIONS) {
            const prof = CityEngine.NPC_PROFESSIONS[key];
            need(!!prof.name && Array.isArray(prof.lines) && prof.lines.length > 0, `NPC_PROFESSIONS['${key}']: name/lines ausente ou vazio`);
        }
    }

    // CityDatabase (ver citydatabase.js) — registro das Cidades-Hub
    // Regionais, faltando aqui desde que o sistema foi criado. Confere as
    // MESMAS classes de erro que os registros acima (id != chave, campo
    // obrigatório ausente) e também as referências cruzadas próprias desse
    // registro: `arenaBiomes` precisa apontar pra biomas que existem de
    // verdade em ARENA_BIOMES (graphics.js) e `raceDemographics` precisa
    // apontar pra raças que existem de verdade em RACES (races.js) — um
    // typo em qualquer um dos dois nunca quebraria nada visivelmente na
    // hora (o sorteio ponderado só ignora chaves desconhecidas em
    // silêncio), então sem essa checagem o erro passaria despercebido.
    if (window.CityDatabase) {
        const knownBiomes = window.ARENA_BIOMES ? Object.keys(window.ARENA_BIOMES) : null;
        const knownRaces = window.RACES ? Object.keys(window.RACES) : null;
        for (const key in window.CityDatabase) {
            const c = window.CityDatabase[key];
            need(c.id === key, `CityDatabase['${key}']: id ('${c.id}') não bate com a chave do registro`);
            need(!!c.name && !!c.description, `CityDatabase['${key}']: name/description ausente`);
            need(typeof c.unlockLevel === 'number' && typeof c.travelCost === 'number', `CityDatabase['${key}']: unlockLevel/travelCost ausente ou inválido`);
            need(Array.isArray(c.arenaBiomes) && c.arenaBiomes.length > 0, `CityDatabase['${key}']: arenaBiomes ausente ou vazio`);
            if (knownBiomes && Array.isArray(c.arenaBiomes)) {
                c.arenaBiomes.forEach(b => need(knownBiomes.includes(b), `CityDatabase['${key}']: arenaBiomes referencia bioma inexistente '${b}'`));
            }
            // officialArenaBiome (ver graphics.js resetForNewBattle, item 5
            // da auditoria de balanceamento): o cenário FIXO e oficial desta
            // arena — precisa existir em ARENA_BIOMES e estar incluído na
            // própria lista arenaBiomes da cidade (nunca um bioma "estranho"
            // à identidade já declarada dela), e vir sempre acompanhado de
            // um nome de exibição (arenaName).
            if (c.officialArenaBiome) {
                need(knownBiomes ? knownBiomes.includes(c.officialArenaBiome) : true, `CityDatabase['${key}']: officialArenaBiome referencia bioma inexistente '${c.officialArenaBiome}'`);
                need(Array.isArray(c.arenaBiomes) && c.arenaBiomes.includes(c.officialArenaBiome), `CityDatabase['${key}']: officialArenaBiome ('${c.officialArenaBiome}') não está incluído em arenaBiomes`);
                need(!!c.arenaName, `CityDatabase['${key}']: officialArenaBiome definido sem arenaName`);
            }
            need(c.weather && typeof c.weather.rainChance === 'number' && typeof c.weather.stormChance === 'number', `CityDatabase['${key}']: weather ausente ou inválido`);
            if (knownRaces && c.raceDemographics) {
                Object.keys(c.raceDemographics).forEach(r => need(knownRaces.includes(r), `CityDatabase['${key}']: raceDemographics referencia raça inexistente '${r}'`));
            }
            // groundColors/vegetationTypes (ver city.js _drawPlazaGround/
            // _drawVegetation) — adicionados numa iteração posterior à
            // criação desta validação e nunca cobertos aqui: um hex
            // malformado ou um tipo de vegetação sem renderizador
            // correspondente nunca quebraria nada visivelmente óbvio (o piso/
            // planta só ficaria com a cor/forma padrão em silêncio).
            const hexRe = /^#[0-9a-fA-F]{6}$/;
            if (c.groundColors !== undefined) {
                need(Array.isArray(c.groundColors) && c.groundColors.length === 2 && c.groundColors.every(h => hexRe.test(h)),
                    `CityDatabase['${key}']: groundColors precisa ser um array de 2 cores hex válidas`);
            }
            // statueColor (ver city.js _drawStatue) — mesma classe de campo
            // visual por cidade que groundColors, adicionado numa iteração
            // ainda mais recente.
            if (c.statueColor !== undefined) {
                need(hexRe.test(c.statueColor), `CityDatabase['${key}']: statueColor precisa ser uma cor hex válida`);
            }
            const knownVegetationTypes = ['cypress', 'laurel', 'deadTree', 'emberBush', 'ancientRoot', 'glowFern'];
            if (c.vegetationTypes !== undefined) {
                need(typeof c.vegetationTypes.edge === 'string' && typeof c.vegetationTypes.center === 'string',
                    `CityDatabase['${key}']: vegetationTypes precisa ter 'edge' e 'center' como strings`);
                ['edge', 'center'].forEach(slot => {
                    const t = c.vegetationTypes[slot];
                    if (typeof t === 'string') {
                        need(knownVegetationTypes.includes(t), `CityDatabase['${key}']: vegetationTypes.${slot} referencia tipo de planta inexistente '${t}'`);
                    }
                });
            }
            // fountainColors (ver city.js _drawFountain) — rim/basin/spout
            // precisam ser hex válido; jet é desenhado com ctx.strokeStyle
            // e usa rgba() com transparência (o jato precisa ser translúcido
            // pra sensação de água/brasa/luz), então só confere string não-vazia.
            if (c.fountainColors !== undefined) {
                const fc = c.fountainColors;
                need(hexRe.test(fc.rim), `CityDatabase['${key}']: fountainColors.rim precisa ser uma cor hex válida`);
                need(hexRe.test(fc.basin), `CityDatabase['${key}']: fountainColors.basin precisa ser uma cor hex válida`);
                need(typeof fc.jet === 'string' && fc.jet.length > 0, `CityDatabase['${key}']: fountainColors.jet ausente ou vazio`);
                need(hexRe.test(fc.spout), `CityDatabase['${key}']: fountainColors.spout precisa ser uma cor hex válida`);
            }
            // wallColors (ver graphics.js _drawCityWall) — desenhado com
            // ctx.fillStyle usando rgba() translúcido (a muralha precisa
            // deixar passar um pouco do céu/montanhas atrás), então só
            // confere strings não-vazias em vez de hex estrito.
            if (c.wallColors !== undefined) {
                need(typeof c.wallColors.base === 'string' && c.wallColors.base.length > 0, `CityDatabase['${key}']: wallColors.base ausente ou vazio`);
                need(typeof c.wallColors.tower === 'string' && c.wallColors.tower.length > 0, `CityDatabase['${key}']: wallColors.tower ausente ou vazio`);
            }
            // treelineColor (ver graphics.js drawCityBackdrop/_drawTreeline)
            // — mesma classe de campo visual translúcido que wallColors.
            if (c.treelineColor !== undefined) {
                need(typeof c.treelineColor === 'string' && c.treelineColor.length > 0, `CityDatabase['${key}']: treelineColor ausente ou vazio`);
            }
        }
    }

    // NPC_PROFESSIONS_REGIONAL (ver city.js _talkToNpc) — mesma checagem de
    // chave morta/referência cruzada das outras variantes regionais acima:
    // toda cidade referenciada precisa existir de verdade em CityDatabase, e
    // toda profissão aninhada precisa existir de verdade em NPC_PROFESSIONS
    // (senão a fala regional nunca seria escolhida por nenhum NPC real).
    if (typeof CityEngine !== 'undefined' && CityEngine.NPC_PROFESSIONS_REGIONAL && window.CityDatabase) {
        const knownProfessions = CityEngine.NPC_PROFESSIONS ? Object.keys(CityEngine.NPC_PROFESSIONS) : [];
        for (const cityKey in CityEngine.NPC_PROFESSIONS_REGIONAL) {
            need(!!window.CityDatabase[cityKey], `NPC_PROFESSIONS_REGIONAL['${cityKey}']: cidade não existe em CityDatabase`);
            const profs = CityEngine.NPC_PROFESSIONS_REGIONAL[cityKey];
            for (const profKey in profs) {
                need(knownProfessions.includes(profKey), `NPC_PROFESSIONS_REGIONAL['${cityKey}']['${profKey}']: profissão não existe em NPC_PROFESSIONS`);
                need(Array.isArray(profs[profKey]) && profs[profKey].length > 0, `NPC_PROFESSIONS_REGIONAL['${cityKey}']['${profKey}']: linhas ausentes ou vazias`);
            }
        }
    }

    // CITY_MUSIC_MOODS (ver audio.js) — mood por cidade da trilha ambiente.
    // Toda chave (exceto 'default', que não é uma cidade) precisa existir
    // de verdade em CityDatabase, senão o mood nunca seria escolhido por
    // nenhuma cidade real (chave morta, provável typo).
    if (typeof CITY_MUSIC_MOODS !== 'undefined' && window.CityDatabase) {
        for (const key in CITY_MUSIC_MOODS) {
            if (key === 'default') continue;
            need(!!window.CityDatabase[key], `CITY_MUSIC_MOODS['${key}']: cidade não existe em CityDatabase`);
        }
    }

    // SHOP_GREETINGS_REGIONAL (ver ui.js) — mesma checagem de chave morta, e
    // também confere que cada loja aninhada existe de verdade em
    // SHOP_GREETINGS (senão a fala regional nunca seria escolhida por
    // nenhuma loja real).
    if (typeof SHOP_GREETINGS_REGIONAL !== 'undefined' && window.CityDatabase) {
        const knownShops = typeof SHOP_GREETINGS !== 'undefined' ? Object.keys(SHOP_GREETINGS) : [];
        for (const key in SHOP_GREETINGS_REGIONAL) {
            need(!!window.CityDatabase[key], `SHOP_GREETINGS_REGIONAL['${key}']: cidade não existe em CityDatabase`);
            for (const shopKey in SHOP_GREETINGS_REGIONAL[key]) {
                need(knownShops.includes(shopKey), `SHOP_GREETINGS_REGIONAL['${key}']['${shopKey}']: loja não existe em SHOP_GREETINGS`);
                need(Array.isArray(SHOP_GREETINGS_REGIONAL[key][shopKey]) && SHOP_GREETINGS_REGIONAL[key][shopKey].length > 0,
                    `SHOP_GREETINGS_REGIONAL['${key}']['${shopKey}']: linhas ausentes ou vazias`);
            }
        }
    }

    // NPC_DIALOGUE (ver city.js _talkToNpc) — o PRIMEIRO registry de
    // variante regional criado (antes de CITY_MUSIC_MOODS/
    // SHOP_GREETINGS_REGIONAL/NPC_PROFESSIONS_REGIONAL, todos já validados
    // acima), mas nunca tinha ganhado a mesma checagem de chave morta —
    // uma assimetria na própria cobertura do validador, não no jogo em si.
    // 'generic'/'famous'/'legendary' são pools base (não cidades);
    // 'vampirismo'/'luz' são chaves de Linhagem (ver lineages.js); 'rumors'
    // é o pool de Rumores (item #6 do novo pedido de auditoria, ver
    // _talkToNpc) — nenhuma delas é cidade, só as demais chaves precisam
    // existir em CityDatabase.
    if (typeof CityEngine !== 'undefined' && CityEngine.NPC_DIALOGUE && window.CityDatabase) {
        const nonCityDialogueKeys = ['generic', 'famous', 'legendary', 'vampirismo', 'luz', 'rumors'];
        for (const key in CityEngine.NPC_DIALOGUE) {
            if (nonCityDialogueKeys.includes(key)) continue;
            need(!!window.CityDatabase[key], `NPC_DIALOGUE['${key}']: cidade não existe em CityDatabase`);
            need(Array.isArray(CityEngine.NPC_DIALOGUE[key]) && CityEngine.NPC_DIALOGUE[key].length > 0,
                `NPC_DIALOGUE['${key}']: linhas ausentes ou vazias`);
        }
    }

    // RACE_ENEMY_NAMES (ver enemy.js) — pool de nomes/adjetivos culturais por
    // raça pro Duelo Rápido. Mesma classe de checagem de chave morta dos
    // registros acima: uma raça digitada errado aqui nunca teria seu pool
    // escolhido por nenhum inimigo real (o próprio `namePool = ... || fallback`
    // silenciosamente cai no pool genérico, sem nenhum aviso), e cada
    // entrada precisa ter names/adjectives não-vazios pro sorteio nunca vir
    // undefined.
    if (typeof RACE_ENEMY_NAMES !== 'undefined' && window.RACES) {
        for (const key in RACE_ENEMY_NAMES) {
            need(!!window.RACES[key], `RACE_ENEMY_NAMES['${key}']: raça não existe em RACES`);
            const pool = RACE_ENEMY_NAMES[key];
            need(Array.isArray(pool.names) && pool.names.length > 0, `RACE_ENEMY_NAMES['${key}']: names ausente ou vazio`);
            need(Array.isArray(pool.adjectives) && pool.adjectives.length > 0, `RACE_ENEMY_NAMES['${key}']: adjectives ausente ou vazio`);
        }
    }

    // WEAPON_RENDERERS (ver graphics.js) — renderizador visual por id de
    // arma. Mesma checagem: um id de arma digitado errado aqui nunca seria
    // usado por nenhuma arma real (`WEAPON_RENDERERS[weapon.id] ||
    // WEAPON_RENDERERS.default` cai silenciosamente no fallback genérico) —
    // exatamente a classe de bug já corrigida nas armas regionais
    // w_11-w_14 (ver histórico de iterações), mas nunca com uma checagem
    // automática de boot que pegasse uma regressão futura.
    if (typeof WEAPON_RENDERERS !== 'undefined' && typeof ItemDatabase !== 'undefined') {
        const knownWeaponIds = Object.values(ItemDatabase.weapons || {}).map(w => w.id);
        for (const key in WEAPON_RENDERERS) {
            if (key === 'default') continue;
            need(knownWeaponIds.includes(key), `WEAPON_RENDERERS['${key}']: id de arma não existe em ItemDatabase.weapons`);
            need(typeof WEAPON_RENDERERS[key] === 'function', `WEAPON_RENDERERS['${key}']: não é uma função de desenho`);
        }
    }

    // AI_FIGHTING_STYLES (ver ai_data.js) — nunca tinha nenhuma checagem,
    // apesar de ser o registry mais arriscado de todos: um id inexistente
    // em `weaponPool` não fica só "silenciosamente ignorado" como as outras
    // chaves mortas acima — AICombat.pickWeaponFromStyle (ai.js) faz
    // `ItemDatabase.weapons[id].region` direto em cima de CADA entrada de
    // weaponPool sem checar undefined antes, então um id inválido ali
    // derruba a escolha de arma (e por consequência a criação do
    // combatente inteiro) com uma exceção real, não um bug cosmético.
    // Mesma checagem pro skillPool contra SkillDatabase, pela mesma razão
    // de segurança de dados.
    if (typeof AI_FIGHTING_STYLES !== 'undefined') {
        // weaponPool guarda a CHAVE de ItemDatabase.weapons (ex: 'shortsword'),
        // não o campo `.id` interno (ex: 'w_01', usado por WEAPON_RENDERERS) —
        // é exatamente essa chave que AICombat.pickWeaponFromStyle usa pra
        // indexar ItemDatabase.weapons[id] diretamente.
        const knownWeaponIds2 = typeof ItemDatabase !== 'undefined' ? Object.keys(ItemDatabase.weapons || {}) : null;
        const knownSkillIds = typeof SkillDatabase !== 'undefined' ? Object.keys(SkillDatabase) : null;
        for (const key in AI_FIGHTING_STYLES) {
            const s = AI_FIGHTING_STYLES[key];
            need(s.id === key, `AI_FIGHTING_STYLES['${key}']: id ('${s.id}') não bate com a chave do registro`);
            need(Array.isArray(s.weaponPool) && s.weaponPool.length > 0, `AI_FIGHTING_STYLES['${key}']: weaponPool ausente ou vazio`);
            if (knownWeaponIds2 && Array.isArray(s.weaponPool)) {
                s.weaponPool.forEach(w => need(knownWeaponIds2.includes(w), `AI_FIGHTING_STYLES['${key}']: weaponPool referencia arma inexistente '${w}' (risco real de exceção em pickWeaponFromStyle)`));
            }
            need(Array.isArray(s.skillPool) && s.skillPool.length > 0, `AI_FIGHTING_STYLES['${key}']: skillPool ausente ou vazio`);
            if (knownSkillIds && Array.isArray(s.skillPool)) {
                s.skillPool.forEach(sk => need(knownSkillIds.includes(sk), `AI_FIGHTING_STYLES['${key}']: skillPool referencia habilidade inexistente '${sk}'`));
            }
            need(typeof s.statFocus === 'object' && s.statFocus, `AI_FIGHTING_STYLES['${key}']: statFocus ausente`);
        }
    }

    // AI_COMBOS (ver ai_data.js) — mesma classe de checagem de chave morta
    // (uma entrada com um id de estilo que não existe mais em
    // AI_FIGHTING_STYLES nunca seria sorteada por _maybeStartCombo em
    // ai.js) e confere que cada passo no formato 'SKILL:<id>' referencia
    // uma habilidade real — um typo aqui faria a IA "tentar" usar uma
    // habilidade que não existe no meio do combo, silenciosamente falhando
    // aquele passo específico.
    if (typeof AI_COMBOS !== 'undefined') {
        const knownStyleIds = typeof AI_FIGHTING_STYLES !== 'undefined' ? Object.keys(AI_FIGHTING_STYLES) : null;
        const knownSkillIds2 = typeof SkillDatabase !== 'undefined' ? Object.keys(SkillDatabase) : null;
        for (const key in AI_COMBOS) {
            if (knownStyleIds) need(knownStyleIds.includes(key), `AI_COMBOS['${key}']: estilo não existe em AI_FIGHTING_STYLES`);
            const comboSet = AI_COMBOS[key];
            need(Array.isArray(comboSet) && comboSet.length > 0, `AI_COMBOS['${key}']: comboSet ausente ou vazio`);
            (comboSet || []).forEach((combo, idx) => {
                need(Array.isArray(combo.steps) && combo.steps.length > 0, `AI_COMBOS['${key}'][${idx}]: steps ausente ou vazio`);
                need(Array.isArray(combo.flavor) && combo.flavor.length > 0, `AI_COMBOS['${key}'][${idx}]: flavor ausente ou vazio`);
                if (knownSkillIds2 && Array.isArray(combo.steps)) {
                    combo.steps.forEach(step => {
                        if (typeof step === 'string' && step.startsWith('SKILL:')) {
                            const skillId = step.slice('SKILL:'.length);
                            need(knownSkillIds2.includes(skillId), `AI_COMBOS['${key}'][${idx}]: passo referencia habilidade inexistente '${skillId}'`);
                        }
                    });
                }
            });
        }
    }

    if (problems.length > 0) {
        console.warn(`[validateGameData] ${problems.length} problema(s) encontrado(s) nos registros de dados:`);
        problems.forEach(p => console.warn(' - ' + p));
    }
}

// Inicia a Engine após o DOM ser carregado
window.addEventListener('DOMContentLoaded', () => {
    window.Engine = new GameEngine();
});
