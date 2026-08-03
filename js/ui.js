/**
 * Falas de comerciantes por tipo de loja (ver UIManager.openShop) — dá a
 * sensação de um lugar com gente de verdade, não só um menu de compras.
 * Orientado a dados: uma loja nova só precisa registrar sua própria
 * entrada aqui, sem tocar em nenhuma lógica de abertura de loja.
 */
const SHOP_GREETINGS = {
    Ferreiro: [
        '"Aço forjado nas fornalhas da própria arena. Nada melhor pra sobreviver lá dentro."',
        '"Cada lâmina que saiu daqui já provou sangue. Escolha bem a sua."',
        '"Vim de uma família de ferreiros de armas. Meu avô forjou a espada do próprio Campeão."'
    ],
    Armeiro: [
        '"Armadura não é covardia, gladiador. É o que separa quem volta pra casa de quem não volta."',
        '"Toquei toda essa cota de malha com as próprias mãos. Prove."',
        '"Um bom escudo vale mais que dez golpes de sorte."'
    ],
    Taverna: [
        '"Poções frescas, direto do porão. Nada de água suja com corante, prometo."',
        '"Beba, coma, descanse. Amanhã a arena não vai ter piedade."',
        '"Já vi gladiadores morrerem por economizar numa bandagem. Não seja um deles."'
    ],
    Mercado: [
        '"Um pouco de tudo, pra quem sabe procurar."',
        '"Fama e ouro abrem portas que a espada sozinha não abre."',
        '"Já vendi pra campeões e pra quem nunca voltou da arena. Você decide qual vai ser."'
    ],
    'Mercador Viajante': [
        '"Carrego mercadorias de terras que você nunca ouviu falar. Aproveite enquanto estou aqui."',
        '"Não fico muito tempo em nenhuma cidade — a estrada me chama de novo em breve."',
        '"Vi coisas do outro lado do mundo. Algumas até trouxe comigo pra vender."'
    ]
};

// Falas de comerciante ESPECÍFICAS da Cidade-Hub atual (ver
// citydatabase.js) — só Ferreiro/Armeiro, as duas lojas de ofício mais
// ligadas à cultura local (a Taverna/Mercado geral seguem universais de
// propósito). Antes desta mudança, o Ferreiro da Fortaleza Orc dizia
// exatamente as mesmas falas do Ferreiro de Porto Helênico — nenhuma loja
// em nenhuma cidade nova refletia onde o jogador estava, apesar de NPCs de
// rua, clima, raças e itens já serem por cidade há várias iterações.
// Cidade sem entrada aqui (ou sistema de cidades ausente) usa só o pool
// genérico de SHOP_GREETINGS, comportamento idêntico ao original.
const SHOP_GREETINGS_REGIONAL = {
    fortaleza_orc: {
        Ferreiro: [
            '"Forjo com o mesmo fogo que corre nas veias da montanha. Não espere delicadeza."',
            '"Aço orc não quebra fácil. Nem quem o carrega, se quiser sobreviver aqui."',
            '"Já vi forasteiro rir da minha bigorna. Parou de rir depois da primeira luta."'
        ],
        Armeiro: [
            '"Couro grosso, metal mais grosso ainda. Aqui ninguém sobrevive com armadura fina."',
            '"Peso não é problema pra quem tem força pra carregar. É problema pra quem não tem."',
            '"Já vesti chefes de guerra pra batalhas que ninguém mais lembra o nome."'
        ]
    },
    santuario_elfico: {
        Ferreiro: [
            '"Cada lâmina daqui carrega um pouco da paciência da floresta em sua forja."',
            '"Não forjamos pela pressa. Uma peça bem-feita dura mais que quem a encomendou."',
            '"O metal que vem de fora nunca canta como o nosso. Ouça com atenção, e vai entender."'
        ],
        Armeiro: [
            '"Leveza não é fraqueza — é o que deixa a mão livre pra reagir a tempo."',
            '"Tecemos proteção como quem tece uma tapeçaria: com tempo, não com pressa."',
            '"Forasteiros estranham o quanto nossa armadura pesa pouco. Nós preferimos assim."'
        ]
    }
};

/**
 * Gerenciador de Interface de Usuário
 */
class UIManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');

        // Dados temporários para a criação de personagem
        this.creationData = {
            pointsLeft: 10,
            stats: { str: 5, agi: 5, int: 5, def: 5, acc: 5, luk: 5, cha: 5 },
            names: { str: "Força", agi: "Agilidade", int: "Inteligência", def: "Defesa", acc: "Precisão", luk: "Sorte", cha: "Carisma" },
            visuals: {
                gender: 'Masculino', skinTone: '#ffcc99', hairStyle: 1, hairColor: '#2a1c10',
                beardStyle: 0, beardColor: '#2a1c10', eyebrowColor: '#2a1c10', eyeColor: '#1a1a1a', faceShape: 1,
                archetype: 'veterano', scarStyle: 0
            }
        };

        this.genderOptions = ['Masculino', 'Feminino'];
        // Índice = hairStyle (1-based). "genders" restringe a opção a um
        // gênero só por identidade visual (Sims/WoW-style) — puramente
        // estético, nunca afeta atributos, dano ou qualquer vantagem.
        this.hairOptions = [
            { name: 'Sayajin Espetado', genders: ['Masculino', 'Feminino'] },
            { name: 'Sayajin Longo', genders: ['Masculino', 'Feminino'] },
            { name: 'Moicano', genders: ['Masculino'] },
            { name: 'Samurai', genders: ['Masculino'] },
            { name: 'Rabo de Cavalo', genders: ['Masculino', 'Feminino'] },
            { name: 'Cabelo Preso', genders: ['Feminino'] },
            { name: 'Cacheado', genders: ['Masculino', 'Feminino'] },
            { name: 'Afro', genders: ['Masculino', 'Feminino'] },
            { name: 'Longo Liso', genders: ['Masculino', 'Feminino'] },
            { name: 'Tranças', genders: ['Feminino'] },
            { name: 'Cabelo Raspado', genders: ['Masculino', 'Feminino'] },
            { name: 'Careca', genders: ['Masculino', 'Feminino'] },
            { name: 'Franja', genders: ['Masculino', 'Feminino'] },
            { name: 'Cabelo Bagunçado', genders: ['Masculino', 'Feminino'] },
            { name: 'Gladiador Romano', genders: ['Masculino', 'Feminino'] }
        ];
        // Índice = beardStyle (0 = nenhuma, sempre disponível pros dois).
        this.beardOptions = [
            { name: 'Nenhuma', genders: ['Masculino', 'Feminino'] },
            { name: 'Cavanhaque', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Curta', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Média', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Longa', genders: ['Masculino'] },
            { name: 'Bigode', genders: ['Masculino', 'Feminino'] },
            { name: 'Bigode Imperial', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Cheia', genders: ['Masculino', 'Feminino'] },
            { name: 'Costeletas', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Viking', genders: ['Masculino'] },
            { name: 'Barba Trançada', genders: ['Masculino'] },
            { name: 'Barba por Fazer', genders: ['Masculino', 'Feminino'] }
        ];
        this.faceOptions = ['Redondo', 'Oval', 'Anguloso'];
        // Identidade de lutador (silhueta/paleta/adereço assinatura — ver
        // FIGHTER_ARCHETYPES em graphics.js). Ordem/ids batem 1:1 com a
        // tabela de lá; nomes aqui são só o rótulo exibido no botão.
        this.archetypeOptions = [
            { id: 'veterano', name: 'Gladiador Veterano' },
            { id: 'barbaro', name: 'Bárbaro' },
            { id: 'cavaleiro', name: 'Cavaleiro' },
            { id: 'assassino', name: 'Assassino' },
            { id: 'guerreira', name: 'Guerreira' },
            { id: 'mercenario', name: 'Mercenário' },
            { id: 'campeao', name: 'Campeão' }
        ];
        // Índice = scarStyle (0 = nenhuma). Ver SCAR_STYLES em graphics.js.
        this.scarOptions = ['Nenhuma', 'Cicatriz na Bochecha', 'Cicatriz na Sobrancelha', 'Cicatriz na Testa', 'Cicatriz no Queixo'];
        // Raças jogáveis (ver races.js) — vantagens/desvantagens reais de
        // atributo, escolhidas uma única vez na Criação de Personagem.
        this.raceOptions = window.RACES ? Object.values(window.RACES) : [];
        this._previewRAFId = null;

        this.currentShopItems = [];

        this.initEventListeners();
    }

    // `transition` escolhe a animação de entrada: 'fade' (padrão), 'zoom',
    // 'slide' ou 'darken'. Nunca instantâneo — toda troca de tela anima.
    showScreen(screenId, transition = 'fade') {
        const target = document.getElementById(screenId);
        this.screens.forEach(s => {
            s.classList.remove('active');
            s.classList.remove('transition-zoom', 'transition-slide', 'transition-darken');
        });
        if (transition !== 'fade') target.classList.add(`transition-${transition}`);
        target.classList.add('active');

        // Uma tela anterior mais alta que a viewport pode ter forçado o navegador
        // a rolar a página (ex: ao focar um campo/botão perto do fim do conteúdo).
        // Essa rolagem residual "gruda" e desloca visualmente a próxima tela, mesmo
        // sendo ela 100% do viewport — então zeramos toda rolagem a cada troca de tela.
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.getElementById('game-container').scrollTop = 0;
        document.getElementById(screenId).scrollTop = 0;

        // Sincroniza estado para o Motor Gráfico saber o que renderizar
        if (screenId === 'screen-battle') {
            window.Engine.state.screen = 'BATTLE';
        } else {
            window.Engine.state.screen = screenId.toUpperCase().replace('SCREEN-', '');
            // Limpa partículas antigas ao sair da batalha
            if (window.GFX) {
                window.GFX.particles = [];
                window.GFX.floatingTexts = [];
            }
            // A trilha de batalha só toca durante o combate — ao sair pra
            // qualquer outra tela (resultado, cidade, etc), ela para (sem
            // custo se já estiver parada).
            if (window.AudioManager) window.AudioManager.stopBattleMusic();
        }

        // Toda vez que se volta pra Cidade (de uma loja, da batalha, etc), o
        // CityEngine reposiciona o jogador na porta do prédio de onde saiu
        // e retoma a ambiência (som, NPCs) — idempotente, sem custo se já
        // estava rodando.
        if (screenId === 'screen-hub' && window.City) window.City.onEnterCity();

        // Bug de auditoria corrigido ("ouro não atualiza na tela principal
        // mesmo gastando"): o HUD do Hub (#hub-player-gold e demais) só era
        // atualizado pelos poucos lugares que lembravam de chamar
        // updateHubStats() explicitamente antes de voltar pro Hub (ex: fim
        // de batalha, cura no Curandeiro). Fechar Inventário/Encantamentos/
        // Loja/Banco/etc via showScreen('screen-hub') direto (ver
        // btn-close-inv e afins) nunca disparava esse refresh, então o HUD
        // continuava mostrando o ouro/nível/fadiga de ANTES da ação até a
        // próxima coisa que por acaso chamasse updateHubStats(). Agora
        // QUALQUER transição pro Hub garante o HUD atualizado, não importa
        // de onde o jogador voltou.
        if (screenId === 'screen-hub' && window.Engine.state.player) this.updateHubStats();
    }

    initEventListeners() {
        // --- Navegação da Cidade (Hub) ---
        // O Hub deixou de ser um menu de botões: agora é a cidade explorável
        // (js/city.js). O jogador anda até cada prédio e interage com o
        // botão contextual "city-interact-prompt", que chama estes mesmos
        // métodos diretamente (ver CityEngine.interact()) — nada aqui muda.
        document.getElementById('btn-city-arena-quick').addEventListener('click', () => {
            document.getElementById('city-arena-menu').classList.add('hidden');
            this.startBattle();
        });
        document.getElementById('btn-city-arena-ladder').addEventListener('click', () => {
            document.getElementById('city-arena-menu').classList.add('hidden');
            this.openLadder();
        });
        document.getElementById('btn-city-arena-cancel').addEventListener('click', () => {
            document.getElementById('city-arena-menu').classList.add('hidden');
        });
        // Inventário/Status não é um prédio — é sempre acessível pelo ícone da HUD
        document.getElementById('btn-hub-inventory').addEventListener('click', () => this.openInventory());
        document.getElementById('btn-hub-mutations').addEventListener('click', () => this.openMutations());
        document.getElementById('btn-close-mutations').addEventListener('click', () => this.showScreen('screen-hub'));

        // --- Guia do Jogo — referência estática, sem depender de save/personagem,
        //     acessível tanto do Hub quanto do Menu Principal (ver mainmenu.js) ---
        document.getElementById('btn-hub-guide').addEventListener('click', () => window.GuideSystem.open('hub'));
        document.getElementById('btn-close-guide').addEventListener('click', () => window.GuideSystem.close());
        document.getElementById('btn-bank-deposit').addEventListener('click', () => this.bankDeposit());
        document.getElementById('btn-bank-withdraw').addEventListener('click', () => this.bankWithdraw());
        document.getElementById('btn-respec-stats').addEventListener('click', () => this.respecStats());

        // --- Fechar painéis ---
        document.getElementById('btn-close-inv').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-shop').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-skills').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-ladder').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-healer').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-open-tavern-shop').addEventListener('click', () => this.openShop(null, 'Taverna', true));
        document.getElementById('btn-close-bank').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-house').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-halloffame').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-questboard').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-caravan').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-road').addEventListener('click', () => this.abandonRoad());
        document.getElementById('btn-road-advance').addEventListener('click', () => this.advanceRoad());
        document.getElementById('btn-road-abandon').addEventListener('click', () => this.abandonRoad());

        // Mundo da Estrada (Fase 2, ver js/road.js RoadEngine) — trajeto
        // real entre cidades: WASD/setas + Shift pra correr, clique/toque
        // pra andar até o ponto (mesma conversão de tela pra mundo via
        // Camera já usada por city.js _handleClick).
        document.getElementById('btn-abandon-roadworld').addEventListener('click', () => this.abandonRoadWorld());
        window.addEventListener('keydown', (e) => { if (window.RoadEngine) window.RoadEngine.handleKey(e, true); });
        window.addEventListener('keyup', (e) => { if (window.RoadEngine) window.RoadEngine.handleKey(e, false); });
        document.getElementById('game-canvas').addEventListener('click', (e) => {
            if (!window.RoadEngine || !window.RoadEngine._isActive()) return;
            const canvas = document.getElementById('game-canvas');
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;
            const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
            window.RoadEngine.handleClick(screenX - offset.dx, screenY - offset.dy);
        });
        document.getElementById('btn-close-achievements').addEventListener('click', () => {
            // Se foi aberta a partir do Menu Principal (sem sessão de jogo ativa,
            // só espiando o save mais recente), volta pro menu e descarta o
            // personagem temporário em vez de "entrar" na Cidade sem querer.
            if (this._achievementsSource === 'mainmenu') {
                if (window.MainMenu && window.MainMenu._peekingPlayer) {
                    window.Engine.state.player = null;
                    window.MainMenu._peekingPlayer = false;
                }
                window.MainMenu.showMainMenu();
            } else {
                this.showScreen('screen-hub');
            }
        });

        // --- Ações de Batalha ---
        document.getElementById('btn-atk').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('ATK');
        });
        document.getElementById('btn-def').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('DEF');
        });
        document.getElementById('btn-skill').addEventListener('click', () => this.openBattleSkillMenu());
        document.getElementById('btn-item').addEventListener('click', () => this.openBattleItemMenu());
        document.getElementById('btn-switch-weapon').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('SWITCH_WEAPON');
        });
        document.getElementById('btn-close-skill-menu').addEventListener('click', () => {
            document.getElementById('battle-skills-menu').classList.add('hidden');
        });
        document.getElementById('btn-close-item-menu').addEventListener('click', () => {
            document.getElementById('battle-items-menu').classList.add('hidden');
        });

        // --- Movimentação Tática (Aproximar, Recuar, Correr, Investida, Manter Distância) ---
        document.getElementById('btn-move').addEventListener('click', () => {
            document.getElementById('battle-move-menu').classList.remove('hidden');
        });
        document.getElementById('btn-close-move-menu').addEventListener('click', () => {
            document.getElementById('battle-move-menu').classList.add('hidden');
        });
        const moveActions = { 'btn-move-approach': 'APPROACH', 'btn-move-retreat': 'RETREAT', 'btn-move-run': 'RUN', 'btn-move-charge': 'CHARGE', 'btn-move-hold': 'HOLD' };
        for (let btnId in moveActions) {
            document.getElementById(btnId).addEventListener('click', () => {
                document.getElementById('battle-move-menu').classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn(moveActions[btnId]);
            });
        }

        // --- Retorno da Tela de Resultados ---
        document.getElementById('btn-return-hub').addEventListener('click', () => {
            const p = window.Engine.state.player;
            window.SaveManager.save(window.Engine.state);
            this.updateHubStats();
            // Emboscada durante uma viagem por Estrada (ver roads.js): vencer
            // retoma a viagem de onde parou; perder encerra a viagem aqui
            // mesmo (o jogador foi obrigado a recuar) — nos dois casos nunca
            // mostra o Hub como se nada tivesse acontecido no meio do
            // caminho. Batalhas comuns (sem viagem em andamento) continuam
            // indo pro Hub exatamente como antes.
            if (p && p.roadJourney) {
                if (this._lastBattleWasVictory) {
                    // Descoberta da Floresta Ancestral (ver nature.js): a
                    // vitória contra o monstro das sombras que corrompia as
                    // raízes é o próprio evento de descoberta — mostra a
                    // cena antes de voltar pra Estrada, nunca as duas coisas
                    // ao mesmo tempo silenciosamente.
                    if (this._pendingNatureDiscovery) {
                        this._pendingNatureDiscovery = false;
                        this._resolveNatureDiscoveryVictory(p);
                    } else {
                        this.openRoad();
                    }
                } else {
                    this._pendingNatureDiscovery = false;
                    window.RoadSystem.abandonJourney(p);
                    window.SaveManager.save(window.Engine.state);
                    if (window.MainMenu) window.MainMenu.showToast('Derrotado, você recua e abandona a viagem.', 'error');
                    this.showScreen('screen-hub');
                }
                return;
            }
            // Emboscada no Mundo da Estrada de verdade (ver js/road.js
            // RoadEngine _updateBandits/ui.js onRoadWorldEncounter) — mesmo
            // princípio do bloco acima (roadJourney antigo), agora pro
            // formato novo: vencer volta pra tela ROADWORLD (RoadEngine
            // nunca chamou abandon(), então a posição/zona/eventos restantes
            // continuam exatamente como estavam); perder encerra a
            // travessia aqui mesmo.
            if (p && p.roadWorldJourney) {
                if (this._lastBattleWasVictory) {
                    // Descoberta da Floresta Ancestral física (Fase 5, ver
                    // js/road.js RoadEngine._generateForestEncounter/
                    // onRoadWorldNatureDiscovery) — mesmo princípio do bloco
                    // roadJourney acima: a vitória contra o Espírito
                    // corrompido É o evento de descoberta, mostra a cena
                    // antes de retomar a Estrada.
                    if (this._pendingNatureDiscovery) {
                        this._pendingNatureDiscovery = false;
                        this._resolveNatureDiscoveryVictory(p, () => this.showScreen('screen-roadworld'));
                    } else {
                        this.showScreen('screen-roadworld');
                    }
                } else {
                    this._pendingNatureDiscovery = false;
                    p.roadWorldJourney = null;
                    if (window.RoadEngine) window.RoadEngine.abandon();
                    window.SaveManager.save(window.Engine.state);
                    if (window.MainMenu) window.MainMenu.showToast('Derrotado, você recua e abandona a viagem.', 'error');
                    this.showScreen('screen-hub');
                }
                return;
            }
            this.showScreen('screen-hub');
        });

        // --- Tooltip segue o mouse (Desktop) ---
        document.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('item-tooltip');
            if (!tt.classList.contains('hidden')) {
                tt.style.left = `${e.clientX}px`;
                tt.style.top = `${e.clientY}px`;
            }
        });

        // --- Seletores Visuais do Criador de Personagem (todos atualizam o preview ao vivo) ---
        document.getElementById('btn-race').addEventListener('click', (e) => {
            const idx = (this.raceOptions.findIndex(r => r.id === this.creationData.race) + 1) % this.raceOptions.length;
            this.creationData.race = this.raceOptions[idx].id;
            e.target.innerText = this.raceOptions[idx].name;
            this._updateRaceTagline();
        });
        document.getElementById('btn-gender').addEventListener('click', (e) => {
            const idx = (this.genderOptions.indexOf(this.creationData.visuals.gender) + 1) % this.genderOptions.length;
            this.creationData.visuals.gender = this.genderOptions[idx];
            e.target.innerText = this.creationData.visuals.gender;
            // Cabelo/barba atuais podem não existir para o novo gênero (identidade
            // visual apenas — nunca afeta atributos/combate); ajusta se preciso.
            this._ensureValidHairBeardForGender();
        });
        // Cor de pele livre: qualquer cor é aceita, incluindo tons não convencionais (verde, azul, etc)
        document.getElementById('char-skin-color').addEventListener('input', (e) => {
            this.creationData.visuals.skinTone = e.target.value;
        });
        document.getElementById('btn-hair').addEventListener('click', () => this._cycleHair(1));
        document.getElementById('char-hair-color').addEventListener('input', (e) => {
            this.creationData.visuals.hairColor = e.target.value;
        });
        document.getElementById('btn-beard').addEventListener('click', () => this._cycleBeard(1));
        document.getElementById('char-beard-color').addEventListener('input', (e) => {
            this.creationData.visuals.beardColor = e.target.value;
        });
        document.getElementById('char-eye-color').addEventListener('input', (e) => {
            this.creationData.visuals.eyeColor = e.target.value;
        });
        const btnRandomize = document.getElementById('btn-randomize-look');
        if (btnRandomize) btnRandomize.addEventListener('click', () => this.randomizeAppearance());
        document.getElementById('btn-face').addEventListener('click', (e) => {
            const idx = this.creationData.visuals.faceShape % this.faceOptions.length;
            this.creationData.visuals.faceShape = idx + 1;
            e.target.innerText = this.faceOptions[idx];
        });
        document.getElementById('btn-archetype').addEventListener('click', (e) => {
            const idx = (this.archetypeOptions.findIndex(a => a.id === this.creationData.visuals.archetype) + 1) % this.archetypeOptions.length;
            this.creationData.visuals.archetype = this.archetypeOptions[idx].id;
            e.target.innerText = this.archetypeOptions[idx].name;
        });
        document.getElementById('btn-scar').addEventListener('click', (e) => {
            const idx = (this.creationData.visuals.scarStyle + 1) % this.scarOptions.length;
            this.creationData.visuals.scarStyle = idx;
            e.target.innerText = this.scarOptions[idx];
        });

        // --- Configuração: sangue nos combates (opcional, desligado por padrão) ---
        document.getElementById('btn-toggle-blood').addEventListener('click', (e) => {
            window.GFX.bloodEnabled = !window.GFX.bloodEnabled;
            e.target.innerText = window.GFX.bloodEnabled ? 'Ligado' : 'Desligado';
        });

        // --- Sonorização Global de UI ---
        // Delegado no document (fase de captura, já que mouseenter/mouseleave não
        // borbulham) em vez de anexado a cada <button> individualmente: botões
        // criados dinamicamente depois da inicialização (Comprar na loja, Aprender
        // no talento, +/- de atributos no inventário, etc) também tocam o som,
        // o que não acontecia quando os listeners eram presos só aos botões
        // existentes no DOM no momento da construção do UIManager.
        document.addEventListener('mouseenter', (e) => {
            const btn = e.target.closest && e.target.closest('button');
            if (btn && !btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIHover();
        }, true);
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('button');
            if (btn && !btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIClick();
        }, true);

        // --- Acessibilidade: Esc fecha o painel/menu/modal aberto ---
        // Antes só clique/toque no X fechava qualquer coisa — nenhuma tecla
        // fazia isso. Reaproveita o MESMO botão de fechar que cada tela já
        // tem (inclusive o caso especial de Conquistas vindo do Menu
        // Principal), então nenhuma lógica de fechamento é duplicada.
        // Prioridade: modal de confirmação > sub-menus de batalha (perde
        // pra qualquer coisa em `.hidden` que não seja essas 3) > painel de
        // tela cheia atual.
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const confirmModal = document.getElementById('confirm-modal');
            const confirmCancel = document.getElementById('confirm-modal-cancel');
            if (confirmModal && !confirmModal.classList.contains('hidden') &&
                confirmCancel && !confirmCancel.classList.contains('hidden')) {
                confirmCancel.click();
                return;
            }
            const battleMenuIds = ['battle-skills-menu', 'battle-items-menu', 'battle-move-menu'];
            for (const id of battleMenuIds) {
                const el = document.getElementById(id);
                if (el && !el.classList.contains('hidden')) {
                    el.classList.add('hidden');
                    return;
                }
            }
            const closeBtn = document.querySelector('.screen.active .btn-close');
            if (closeBtn) closeBtn.click();
        });
    }

    // --- Identidade Visual (Cabelo/Barba) ---
    // Avança para o próximo estilo de cabelo disponível para o gênero atual
    // (pula opções exclusivas do outro gênero em vez de travar nelas).
    _cycleHair(direction = 1) {
        const gender = this.creationData.visuals.gender;
        const n = this.hairOptions.length;
        let idx = this.creationData.visuals.hairStyle - 1;
        for (let i = 0; i < n; i++) {
            idx = (idx + direction + n) % n;
            if (this.hairOptions[idx].genders.includes(gender)) break;
        }
        this.creationData.visuals.hairStyle = idx + 1;
        document.getElementById('btn-hair').innerText = this.hairOptions[idx].name;
    }

    _cycleBeard(direction = 1) {
        const gender = this.creationData.visuals.gender;
        const n = this.beardOptions.length;
        let idx = this.creationData.visuals.beardStyle;
        for (let i = 0; i < n; i++) {
            idx = (idx + direction + n) % n;
            if (this.beardOptions[idx].genders.includes(gender)) break;
        }
        this.creationData.visuals.beardStyle = idx;
        document.getElementById('btn-beard').innerText = this.beardOptions[idx].name;
    }

    // Mostra a tagline mecânica da raça atual (ver races.js) abaixo do
    // seletor — deixa claro que "Origem" não é só estética, tem
    // vantagem/desvantagem real de atributo.
    _updateRaceTagline() {
        const race = window.RaceSystem ? window.RaceSystem.get(this.creationData.race) : null;
        const el = document.getElementById('race-tagline');
        if (!el) return;
        if (!race) { el.innerHTML = ''; return; }
        // `passive` (ver races.js) é o traço único de combate da raça — some
        // logo abaixo da tagline pra deixar claro que não é só estética.
        const passiveHtml = race.passive ? `<br><span class="race-passive">✦ ${race.passive.label}</span>` : '';
        el.innerHTML = `${race.tagline}${passiveHtml}`;
    }

    // Chamado ao trocar de gênero: se o cabelo/barba selecionado for
    // exclusivo do outro gênero, avança para a próxima opção válida.
    _ensureValidHairBeardForGender() {
        const gender = this.creationData.visuals.gender;
        const hair = this.hairOptions[this.creationData.visuals.hairStyle - 1];
        if (!hair || !hair.genders.includes(gender)) this._cycleHair(1);
        const beard = this.beardOptions[this.creationData.visuals.beardStyle];
        if (!beard || !beard.genders.includes(gender)) this._cycleBeard(1);
    }

    // Botão "Aleatório": sorteia uma aparência completa de uma vez (gênero,
    // rosto, cabelo/barba já respeitando o gênero sorteado, e todas as
    // cores), pra facilitar explorar a variedade sem clicar em cada opção.
    randomizeAppearance() {
        const v = this.creationData.visuals;
        const randColor = () => '#' + Utils.randomInt(0, 0xffffff).toString(16).padStart(6, '0');

        if (this.raceOptions.length > 0) {
            const raceIdx = Utils.randomInt(0, this.raceOptions.length - 1);
            this.creationData.race = this.raceOptions[raceIdx].id;
            document.getElementById('btn-race').innerText = this.raceOptions[raceIdx].name;
            this._updateRaceTagline();
        }

        v.gender = this.genderOptions[Utils.randomInt(0, this.genderOptions.length - 1)];
        document.getElementById('btn-gender').innerText = v.gender;

        const validHair = this.hairOptions.map((h, i) => i).filter(i => this.hairOptions[i].genders.includes(v.gender));
        const hairIdx = validHair[Utils.randomInt(0, validHair.length - 1)];
        v.hairStyle = hairIdx + 1;
        document.getElementById('btn-hair').innerText = this.hairOptions[hairIdx].name;

        const validBeard = this.beardOptions.map((b, i) => i).filter(i => this.beardOptions[i].genders.includes(v.gender));
        const beardIdx = validBeard[Utils.randomInt(0, validBeard.length - 1)];
        v.beardStyle = beardIdx;
        document.getElementById('btn-beard').innerText = this.beardOptions[beardIdx].name;

        const faceIdx = Utils.randomInt(0, this.faceOptions.length - 1);
        v.faceShape = faceIdx + 1;
        document.getElementById('btn-face').innerText = this.faceOptions[faceIdx];

        const archIdx = Utils.randomInt(0, this.archetypeOptions.length - 1);
        v.archetype = this.archetypeOptions[archIdx].id;
        document.getElementById('btn-archetype').innerText = this.archetypeOptions[archIdx].name;

        const scarIdx = Utils.randomInt(0, this.scarOptions.length - 1);
        v.scarStyle = scarIdx;
        document.getElementById('btn-scar').innerText = this.scarOptions[scarIdx];

        v.skinTone = randColor();
        v.hairColor = randColor();
        v.beardColor = randColor();
        v.eyeColor = randColor();
        document.getElementById('char-skin-color').value = v.skinTone;
        document.getElementById('char-hair-color').value = v.hairColor;
        document.getElementById('char-beard-color').value = v.beardColor;
        document.getElementById('char-eye-color').value = v.eyeColor;

        if (window.AudioManager && window.AudioManager.initialized) window.AudioManager.playConfirm();
    }

    // --- CRIAÇÃO DE PERSONAGEM ---
    buildCreationScreen() {
        // Reseta os dados de criação para uma nova jornada
        this.creationData.pointsLeft = 10;
        this.creationData.stats = { str: 5, agi: 5, int: 5, def: 5, acc: 5, luk: 5, cha: 5 };
        this.creationData.race = 'humano';
        this.creationData.visuals = {
            gender: 'Masculino', skinTone: '#ffcc99', hairStyle: 1, hairColor: '#2a1c10',
            beardStyle: 0, beardColor: '#2a1c10', eyebrowColor: '#2a1c10', eyeColor: '#1a1a1a', faceShape: 1,
            archetype: 'veterano', scarStyle: 0
        };

        document.getElementById('char-name').value = '';
        document.getElementById('points-left').innerText = this.creationData.pointsLeft;
        const defaultRace = window.RaceSystem ? window.RaceSystem.get('humano') : null;
        document.getElementById('btn-race').innerText = defaultRace ? defaultRace.name : 'Humano';
        this._updateRaceTagline();
        document.getElementById('char-skin-color').value = this.creationData.visuals.skinTone;
        document.getElementById('btn-gender').innerText = this.creationData.visuals.gender;
        document.getElementById('btn-hair').innerText = this.hairOptions[0].name;
        document.getElementById('char-hair-color').value = this.creationData.visuals.hairColor;
        document.getElementById('btn-beard').innerText = this.beardOptions[0].name;
        document.getElementById('char-beard-color').value = this.creationData.visuals.beardColor;
        document.getElementById('char-eye-color').value = this.creationData.visuals.eyeColor;
        document.getElementById('btn-face').innerText = this.faceOptions[0];
        document.getElementById('btn-archetype').innerText = this.archetypeOptions[0].name;
        document.getElementById('btn-scar').innerText = this.scarOptions[0];

        this.startCreatorPreviewLoop();

        const container = document.getElementById('stats-container');
        container.innerHTML = ''; // Limpa

        for (let key in this.creationData.stats) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="stat-name">${this.creationData.names[key]}</span>
                <div class="stat-controls">
                    <button class="btn-sub" data-stat="${key}">-</button>
                    <span id="val-${key}" style="display:inline-block; width:20px; text-align:center;">${this.creationData.stats[key]}</span>
                    <button class="btn-add" data-stat="${key}">+</button>
                </div>
            `;
            container.appendChild(row);
        }

        // Delegação de eventos para os botões +/-
        container.onclick = (e) => {
            if (e.target.classList.contains('btn-add')) this.modifyStat(e.target.dataset.stat, 1);
            if (e.target.classList.contains('btn-sub')) this.modifyStat(e.target.dataset.stat, -1);
        };

        // Monitorar nome
        document.getElementById('char-name').oninput = () => this.validateCreation();

        this.validateCreation();
    }

    modifyStat(statKey, amount) {
        const currentVal = this.creationData.stats[statKey];

        if (amount > 0 && this.creationData.pointsLeft > 0 && currentVal < 15) {
            this.creationData.stats[statKey]++;
            this.creationData.pointsLeft--;
        } else if (amount < 0 && currentVal > 5) {
            this.creationData.stats[statKey]--;
            this.creationData.pointsLeft++;
        }

        document.getElementById(`val-${statKey}`).innerText = this.creationData.stats[statKey];
        document.getElementById('points-left').innerText = this.creationData.pointsLeft;
        this.validateCreation();
    }

    validateCreation() {
        const nameInput = document.getElementById('char-name').value.trim();
        const btnFinish = document.getElementById('btn-finish-creation');

        if (nameInput.length >= 3 && this.creationData.pointsLeft === 0) {
            btnFinish.classList.remove('disabled');
            btnFinish.onclick = () => this.finalizeCharacterCreation();
        } else {
            btnFinish.classList.add('disabled');
            btnFinish.onclick = null;
        }
    }

    // Preview em tempo real do gladiador no criador: reaproveita o MESMO
    // renderizador modular usado na batalha (graphics.js), então qualquer
    // mudança de visual/equipamento aparece igual nos dois lugares.
    startCreatorPreviewLoop() {
        this.stopCreatorPreviewLoop();
        const canvas = document.getElementById('creator-preview-canvas');
        const ctx = canvas.getContext('2d');

        if (!this._previewSword) {
            this._previewSword = ItemFactory.createEquipment('shortsword', 'weapons', RARITY.COMMON);
        }
        const idleAnim = { type: 'idle', start: 0, duration: 0 };

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(0.85, 0.85);
            // `race` (ver graphics.js _drawRaceSash) nunca era passado pro
            // preview — a faixa/baldric com a cor cultural da raça (accent,
            // ver races.js) aparecia certinho na Arena, mas o jogador nunca
            // via nem uma prévia dela durante a própria Criação de
            // Personagem, mesmo já escolhendo a raça bem ali no mesmo menu.
            const previewEntity = {
                race: this.creationData.race,
                visuals: this.creationData.visuals,
                equipment: { [SLOTS.MAIN_HAND]: this._previewSword }
            };
            window.GFX.drawGladiator(ctx, 0, canvas.height - 30, previewEntity, true, idleAnim, null);
            ctx.restore();
            this._previewRAFId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopCreatorPreviewLoop() {
        if (this._previewRAFId) {
            cancelAnimationFrame(this._previewRAFId);
            this._previewRAFId = null;
        }
    }

    finalizeCharacterCreation() {
        this.stopCreatorPreviewLoop();

        const name = document.getElementById('char-name').value.trim();
        window.Engine.state.player = new Player(name);

        // Passa os atributos, raça e visual customizados
        window.Engine.state.player.baseStats = { ...this.creationData.stats };
        window.Engine.state.player.race = this.creationData.race || 'humano';
        window.Engine.state.player.visuals = { ...this.creationData.visuals };

        // Dá uma arma inicial ao jogador
        const initialSword = ItemFactory.createEquipment('shortsword', 'weapons', RARITY.COMMON);
        window.Engine.state.player.equipment[SLOTS.MAIN_HAND] = initialSword;

        // Calcula a vida/dano atual com os atributos novos
        window.Engine.state.player.calculateDerivedStats();

        // Salva o progresso inicial
        window.SaveManager.save(window.Engine.state);

        this.updateHubStats();
        this.showScreen('screen-hub'); // Transição perfeita para a cidade
    }

    // --- HUB DA CIDADE ---
    updateHubStats() {
        const p = window.Engine.state.player;
        document.getElementById('hub-player-name').innerText = p.name;
        document.getElementById('hub-player-level').innerText = p.level;
        document.getElementById('hub-player-gold').innerText = p.gold;
        document.getElementById('hub-player-exp').innerText = p.exp;
        document.getElementById('hub-player-max-exp').innerText = p.getExpRequired();
        document.getElementById('hub-player-fatigue').innerText = p.fatigue || 0;
        // Cidade-Hub atual (ver citydatabase.js) — visível o tempo todo no
        // topo do Hub, não só dentro do menu do Viajante do Portão.
        if (window.getCurrentCityDef) {
            document.getElementById('hub-city-name').innerText = window.getCurrentCityDef().name;
        }
    }

    // --- BATALHA ---
    startBattle() {
        const p = window.Engine.state.player;
        // Gera inimigo baseado no nível do jogador
        const enemy = new Enemy(p.level);
        this.beginBattleWith(enemy);
    }

    // Chefe opcional da Estrada (ver roads.js `elite`, item pedido na
    // auditoria de mundo vivo: "chefes opcionais" durante a exploração) —
    // nível efetivo bem mais alto que o Duelo Rápido comum (Enemy já sorteia
    // ±1 nível e uma chance própria de Elite em cima do nível recebido,
    // então +3 aqui garante uma luta perceptivelmente mais dura sem precisar
    // duplicar/alterar a lógica de geração do Enemy). expValue/goldValue já
    // escalam com o nível, então a recompensa maior é automática.
    startEliteRoadBattle() {
        const p = window.Engine.state.player;
        const enemy = new Enemy(p.level + 3);
        this.beginBattleWith(enemy);
    }

    // Encontro da Floresta Ancestral (ver nature.js/roads.js) — mesmo
    // inimigo procedural de uma emboscada comum da Estrada, só que força o
    // cenário `floresta_ancestral` (ver graphics.js ARENA_BIOMES: névoa
    // verde, vaga-lumes) em vez do bioma normal da cidade atual — a mata
    // sagrada é neutra, nunca pertence a nenhuma Cidade-Hub.
    startNatureDiscoveryBattle() {
        const p = window.Engine.state.player;
        const enemy = new Enemy(p.level);
        this.beginBattleWith(enemy, 'floresta_ancestral');
    }

    // Prepara a tela de batalha para qualquer tipo de oponente (Enemy ou
    // Rival). `forcedBiome` é opcional — quando informado (e existir em
    // ARENA_BIOMES), sobrepõe o bioma normalmente sorteado por
    // resetForNewBattle() a partir da cidade atual (ver
    // startNatureDiscoveryBattle acima). Sem `forcedBiome`, o comportamento
    // é idêntico ao de antes desta opção existir.
    beginBattleWith(opponent, forcedBiome = null) {
        const p = window.Engine.state.player;

        // Para a ambiência pacata da cidade antes do combate e liga a trilha
        // de batalha (tensa e rítmica, em vez de silêncio)
        if (window.AudioManager) {
            window.AudioManager.stopCityAmbience();
            window.AudioManager.startBattleMusic();
        }

        // Recarrega a munição da arma de longo alcance equipada — cada
        // batalha começa com a munição cheia, senão ela nunca seria
        // reabastecida fora de magia. A arma ativa volta a ser a corpo a
        // corpo por padrão, mas só se houver uma equipada (se o jogador só
        // tiver arma de longo alcance, ela continua sendo a ativa).
        const rangedWeapon = p.equipment[SLOTS.RANGED];
        if (rangedWeapon && rangedWeapon.maxAmmo) rangedWeapon.ammo = rangedWeapon.maxAmmo;
        if (p.equipment[SLOTS.MAIN_HAND]) p.activeWeaponSlot = SLOTS.MAIN_HAND;
        else if (rangedWeapon) p.activeWeaponSlot = SLOTS.RANGED;
        p.calculateDerivedStats();

        // Instancia a Engine de Batalha Global
        window.BattleEngine = new BattleSystem(p, opponent);

        // Sorteia a atmosfera da arena (céu/horário) e zera animações dos combatentes
        if (window.GFX) window.GFX.resetForNewBattle();
        if (forcedBiome && window.ARENA_BIOMES && window.ARENA_BIOMES[forcedBiome] && window.GFX) {
            window.GFX.arenaBiome = forcedBiome;
        }

        // Atualiza UI
        document.getElementById('battle-player-name').innerText = p.name;
        document.getElementById('enemy-name').innerText = `${opponent.name} (Nv. ${opponent.level})`;

        this.updateBattleBars();

        // Limpa log anterior
        const log = document.getElementById('battle-log');
        // Raça (ver races.js) só existe pros inimigos procedurais do Duelo
        // Rápido (Enemy) — Vampiro/Fantasma/Rivais nunca setam `.race`, então
        // nunca inventamos uma raça falsa "Humano" pra eles aqui.
        const raceName = opponent.race && window.RaceSystem ? window.RaceSystem.get(opponent.race).name : null;
        log.innerHTML = `<p>Você encontrou ${opponent.name} (${opponent.personality}${raceName ? ', ' + raceName : ''})!</p>`;
        // Nome do cenário oficial da arena (item 5 da auditoria de
        // balanceamento, ver citydatabase.js `arenaName`/`officialArenaBiome`
        // e graphics.js resetForNewBattle) — sem cidade carregada, ou cidade
        // sem arenaName definido, cai no nome genérico do próprio bioma
        // (ARENA_BIOMES[id].name), nunca deixando a arena sem identidade
        // nenhuma no início da luta.
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const arenaDisplayName = (cityDef && cityDef.arenaName)
            || (window.ARENA_BIOMES && window.GFX && window.ARENA_BIOMES[window.GFX.arenaBiome] && window.ARENA_BIOMES[window.GFX.arenaBiome].name);
        if (arenaDisplayName) {
            log.innerHTML += `<p style="color:var(--color-marble-dark); font-style:italic;">⚔ ${arenaDisplayName}</p>`;
        }
        // Inimigo Elite raro do Duelo Rápido (ver enemy.js ELITE_ENEMY_CHANCE)
        // — muito mais forte e recompensador, merece um aviso claro logo de
        // cara, não só um nome diferente perdido no HUD.
        if (opponent.isElite) {
            log.innerHTML += `<p style="color:var(--color-gold-bright,#ffd700); font-weight:bold;">✦ Um inimigo Elite! Mais forte, mas com recompensa muito maior.</p>`;
        }

        // Reseta botões
        document.querySelectorAll('.btn-action').forEach(btn => btn.disabled = false);
        document.getElementById('battle-skills-menu').classList.add('hidden');
        document.getElementById('battle-items-menu').classList.add('hidden');
        document.getElementById('battle-move-menu').classList.add('hidden');

        this.updateDistanceDisplay();
        this.showScreen('screen-battle');
    }

    // Todos os Rivais em ordem, de todas as ligas concatenadas — RivalDatabase
    // é organizado por liga (`{ leagues: [{ rivals: [...] }] }`), não por id
    // (ver enemy.js), então qualquer tela que precise contar o total de
    // Rivais ou encontrar um pelo id passa por aqui, em vez de reimplementar
    // a mesma flattening (ou pior, tratar RivalDatabase como se já fosse um
    // mapa por id, que nunca foi — bug encontrado em auditoria).
    _getAllRivals() {
        const all = [];
        window.RivalDatabase.leagues.forEach(league => league.rivals.forEach(r => all.push(r)));
        return all;
    }

    // --- LADDER DE ADVERSÁRIOS ---
    openLadder() {
        const p = window.Engine.state.player;
        const container = document.getElementById('ladder-container');
        container.innerHTML = '';

        // Um rival só está disponível se todos os anteriores da ladder já
        // tiverem sido derrotados (progressão sequencial entre e dentro das ligas)
        const allRivals = this._getAllRivals();

        window.RivalDatabase.leagues.forEach(league => {
            const leagueDiv = document.createElement('div');
            leagueDiv.className = 'ladder-league';
            leagueDiv.innerHTML = `<h3>${league.name}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'ladder-grid';

            league.rivals.forEach(rivalDef => {
                const globalIdx = allRivals.indexOf(rivalDef);
                const isDefeated = p.rivalsDefeated.includes(rivalDef.id);
                const isUnlocked = globalIdx === 0 || p.rivalsDefeated.includes(allRivals[globalIdx - 1].id);

                const personalityName = (window.AI_PERSONALITIES[rivalDef.personalityId] || {}).name || rivalDef.personalityId;
                const styleName = (window.AI_FIGHTING_STYLES[rivalDef.styleId] || {}).name || rivalDef.styleId;

                // Aviso de nível: a progressão da Ladder é por sequência
                // (derrotar o anterior desbloqueia o próximo), não por nível
                // do jogador — então nada impede alguém de ter farmado pouco
                // e chegar a um rival vários níveis acima do seu, e apanhar
                // sem entender por quê. Um aviso visível ANTES do clique
                // (não depois de já ter perdido) deixa a escolha informada,
                // sem impedir ninguém de tentar mesmo assim.
                const levelGap = rivalDef.level - p.level;
                const showLevelWarning = isUnlocked && !isDefeated && levelGap >= 4;

                const card = document.createElement('div');
                card.className = `rival-card ${rivalDef.isChampion ? 'champion' : ''} ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${rivalDef.name}</h4>
                    <p>Nível ${rivalDef.level} · ${personalityName} · ${styleName}</p>
                    <p class="rival-status" style="color:${isDefeated ? '#1eff00' : (isUnlocked ? 'var(--color-gold)' : '#666')}">
                        ${isDefeated ? 'Derrotado' : (isUnlocked ? (rivalDef.isChampion ? 'Campeão' : 'Disponível') : 'Bloqueado')}
                    </p>
                    ${showLevelWarning ? `<p class="rival-level-warning">⚠️ ${levelGap} níveis acima de você — considere subir de nível antes</p>` : ''}
                `;

                if (isUnlocked) {
                    card.onclick = () => {
                        const rival = new Rival(rivalDef);
                        this.beginBattleWith(rival);
                    };
                }

                grid.appendChild(card);
            });

            leagueDiv.appendChild(grid);
            container.appendChild(leagueDiv);
        });

        this.showScreen('screen-ladder');
    }

    updateBattleBars() {
        const b = window.BattleEngine;
        if (!b) return;

        // Animação de Barras (Player)
        const pHP = (b.player.currentHp / b.player.derivedStats.maxHp) * 100;
        const pMP = (b.player.currentMp / b.player.derivedStats.maxMp) * 100;
        const playerHpBar = document.getElementById('player-hp-bar');
        playerHpBar.style.width = `${pHP}%`;
        playerHpBar.classList.toggle('critical', pHP > 0 && pHP <= 25);
        // Lasca (chip) de dano recente — ver .hp-chip em style.css. Mesmo
        // valor-alvo do preenchimento principal, mas com transition-delay
        // própria, então ela só alcança o novo valor um instante depois.
        document.getElementById('player-hp-chip').style.width = `${pHP}%`;
        document.getElementById('player-mp-bar').style.width = `${pMP}%`;
        document.getElementById('player-hp-text').innerText = `${b.player.currentHp}/${b.player.derivedStats.maxHp}`;
        document.getElementById('player-mp-text').innerText = `${b.player.currentMp}/${b.player.derivedStats.maxMp}`;

        // Munição da arma ativa (só aparece com arma de longo alcance
        // equipada e ativa) e botão de troca de arma (só com set duplo)
        const ammoText = document.getElementById('player-ammo-text');
        const activeWeapon = b.player.getActiveWeapon ? b.player.getActiveWeapon() : null;
        if (activeWeapon && activeWeapon.maxAmmo) {
            ammoText.innerText = `🏹 Munição: ${activeWeapon.ammo}/${activeWeapon.maxAmmo}`;
            ammoText.classList.remove('hidden');
        } else {
            ammoText.classList.add('hidden');
        }
        const switchBtn = document.getElementById('btn-switch-weapon');
        switchBtn.classList.toggle('hidden', !(b.player.hasDualWeapons && b.player.hasDualWeapons()));

        // Animação de Barras (Enemy)
        const eHP = (b.enemy.currentHp / b.enemy.derivedStats.maxHp) * 100;
        const enemyHpBar = document.getElementById('enemy-hp-bar');
        enemyHpBar.style.width = `${eHP}%`;
        enemyHpBar.classList.toggle('critical', eHP > 0 && eHP <= 25);
        document.getElementById('enemy-hp-chip').style.width = `${eHP}%`;
        document.getElementById('enemy-hp-text').innerText = `${b.enemy.currentHp}/${b.enemy.derivedStats.maxHp}`;

        // Barra de mana do inimigo (item 3 da auditoria de balanceamento) —
        // antes só o jogador tinha barra de MP visível; o inimigo gastava/
        // regenerava mana "às cegas", sem nenhum feedback visual, o que
        // reforçava a impressão de "magia infinita" mesmo depois da
        // munição/custo/cooldown corrigidos (ver bossai.js/ai.js). Mesma
        // estrutura da barra do jogador (fill + texto), mais uma pulsação
        // âmbar (.insufficient, ver css/style.css) quando o inimigo tem
        // habilidades mas não tem mana pra NENHUMA delas agora.
        const eMP = b.enemy.derivedStats.maxMp > 0 ? (b.enemy.currentMp / b.enemy.derivedStats.maxMp) * 100 : 0;
        const enemyMpBar = document.getElementById('enemy-mp-bar');
        enemyMpBar.style.width = `${eMP}%`;
        document.getElementById('enemy-mp-text').innerText = `${b.enemy.currentMp}/${b.enemy.derivedStats.maxMp}`;
        const enemySkillCosts = (b.enemy.aiSkills || [])
            .map(id => window.SkillDB[id] && window.SkillDB[id].mpCost)
            .filter(cost => typeof cost === 'number');
        const enemyManaInsufficient = enemySkillCosts.length > 0 && b.enemy.currentMp < Math.min(...enemySkillCosts);
        enemyMpBar.classList.toggle('insufficient', enemyManaInsufficient);

        // Ícones de status ativos (sangramento/queimadura/veneno, atordoado,
        // barreira, evasão) — os estados já existiam em playerState/
        // enemyState (ver battle.js) mas nunca tinham feedback visual algum;
        // o jogador só descobria um sangramento ativo lendo o log de texto.
        document.getElementById('player-status-icons').innerHTML = this._buildStatusIconsHtml(b.playerState);
        document.getElementById('enemy-status-icons').innerHTML = this._buildStatusIconsHtml(b.enemyState);

        // Ícones de equipamento (ver _renderGearIcons) — desde que os
        // inimigos comuns passaram a equipar armadura de verdade (ver
        // Enemy.equipArmor), o jogador já consegue VER a cor do torso
        // mudar, mas não tinha nenhuma forma de saber QUAL item é esse.
        // Refeito a cada atualização (não só uma vez no início da luta)
        // porque tanto o jogador (botão de troca de arma) quanto a IA
        // (arquétipo raro "O Inconstante", ver ai.js swapWeapon) podem
        // trocar de arma no meio do combate.
        this._renderGearIcons('player-gear-icons', b.player);
        this._renderGearIcons('enemy-gear-icons', b.enemy);

        this.updateDistanceDisplay();
    }

    // Ícones com tooltip (reaproveita attachTooltip/_itemIcon, já usados no
    // Inventário/Loja) pras peças de equipamento visualmente relevantes de
    // qualquer combatente — arma corpo a corpo, arma de longo alcance,
    // escudo e peitoral. Vampiro/Fantasma/Rivais também passam por aqui
    // (mesma leitura genérica de `entity.equipment` já usada em toda a IA),
    // não só o Duelo Rápido comum.
    _renderGearIcons(containerId, entity) {
        const container = document.getElementById(containerId);
        if (!container || !entity || !entity.equipment) return;
        container.innerHTML = '';
        [SLOTS.MAIN_HAND, SLOTS.RANGED, SLOTS.OFF_HAND, SLOTS.CHEST].forEach(slot => {
            const item = entity.equipment[slot];
            if (!item) return;
            const span = document.createElement('span');
            span.className = 'gear-icon';
            span.innerText = this._itemIcon(item);
            span.style.color = item.rarity ? item.rarity.color : '#fff';
            this.attachTooltip(span, item);
            container.appendChild(span);
        });
    }

    // Traduz o estado de batalha (bleedTurns/stunned/shieldTurns/
    // evasionTurns) em ícones com tooltip — puramente informativo, não lê
    // nem altera nenhuma lógica de combate.
    _buildStatusIconsHtml(state) {
        if (!state) return '';
        const icons = [];
        if (state.bleedTurns > 0) {
            icons.push(`<span class="status-icon" title="Sangramento contínuo: ${state.bleedDamage} de dano por ${state.bleedTurns} turno(s)">🩸${state.bleedTurns}</span>`);
        }
        if (state.stunned) {
            icons.push(`<span class="status-icon" title="Atordoado: perde a próxima ação">💫</span>`);
        }
        if (state.shieldTurns > 0) {
            icons.push(`<span class="status-icon" title="Barreira: reduz ${state.shieldPercent}% do dano recebido por ${state.shieldTurns} turno(s)">🛡️${state.shieldTurns}</span>`);
        }
        if (state.evasionTurns > 0) {
            icons.push(`<span class="status-icon" title="Evasão: +${state.evasionBonus}% de esquiva por ${state.evasionTurns} turno(s)">💨${state.evasionTurns}</span>`);
        }
        return icons.join('');
    }

    // Atualiza a barra de distância, a zona de alcance da arma do jogador e o
    // aviso de "fora de alcance"; também reforça o gate de alcance no botão Atacar.
    updateDistanceDisplay() {
        const b = window.BattleEngine;
        if (!b) return;

        const range = b.player.getWeaponRange();
        const inRange = b.isInRange(range);

        document.getElementById('distance-value').innerText = b.distance.toFixed(1);
        document.getElementById('distance-marker').style.left = `${(b.distance / 10) * 100}%`;

        const zone = document.getElementById('distance-range-zone');
        const zoneMax = Math.min(range.max, 10);
        zone.style.left = `${(range.min / 10) * 100}%`;
        zone.style.width = `${Math.max(0, (zoneMax - range.min) / 10) * 100}%`;

        document.getElementById('range-warning').classList.toggle('hidden', inRange);

        this.applyRangeGate();
    }

    // Sincroniza o botão Atacar com o alcance atual: desabilita quando fora
    // de alcance e reabilita assim que o jogador se aproxima o suficiente
    // (chamado a cada atualização de distância, não só no início do turno).
    // Nunca mexe no botão fora do turno do jogador, para não reabilitá-lo
    // por engano enquanto o inimigo ainda está agindo.
    applyRangeGate() {
        const b = window.BattleEngine;
        if (!b || !b.isPlayerTurn) return;
        const atkBtn = document.getElementById('btn-atk');
        if (!atkBtn) return;
        const range = b.player.getWeaponRange();
        atkBtn.disabled = !b.isInRange(range);
    }

    toggleBattleButtons(isActive) {
        const buttons = document.querySelectorAll('.btn-action');
        buttons.forEach(btn => btn.disabled = !isActive);
        if (isActive) this.applyRangeGate(); // Atacar continua bloqueado se ainda fora de alcance
    }

    appendBattleLog(messageHTML) {
        const logContainer = document.getElementById('battle-log');
        const p = document.createElement('p');
        p.innerHTML = messageHTML;
        logContainer.appendChild(p);

        // Mantém apenas as últimas 5 mensagens para não vazar memória ou poluir a UI
        if (logContainer.children.length > 5) {
            logContainer.removeChild(logContainer.firstChild);
        }

        // Rola automaticamente para baixo
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // --- MENU DE HABILIDADES NA BATALHA ---
    openBattleSkillMenu() {
        const p = window.Engine.state.player;
        const menu = document.getElementById('battle-skills-menu');
        const list = document.getElementById('battle-skills-list');

        // Só as habilidades EQUIPADAS (ver window.SKILL_LOADOUT_LIMITS em
        // skills.js e Player.getEquippedSkills em player.js) aparecem aqui —
        // `learnedSkills` pode ser maior que isso, mas o jogador escolheu
        // deliberadamente quais levar pra batalha na Árvore de Talentos/
        // Mutações.
        const equippedSkills = p.getEquippedSkills();
        if (p.learnedSkills.length === 0) {
            this.appendBattleLog("Você ainda não aprendeu nenhuma habilidade!");
            return;
        }
        if (equippedSkills.length === 0) {
            this.appendBattleLog("Nenhuma habilidade equipada! Equipe na Árvore de Talentos ou em Mutações.");
            return;
        }

        list.innerHTML = ''; // Limpa anterior

        const b = window.BattleEngine;

        equippedSkills.forEach(skillId => {
            const skill = window.SkillDB[skillId];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';

            // Bloqueia botão se não tiver mana suficiente, estiver em recarga ou fora de alcance
            const onCooldown = p.skillCooldowns && p.skillCooldowns[skillId] > 0;
            const hasMana = p.currentMp >= skill.mpCost;

            let skillRange = null;
            if (b) {
                if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL' || skill.type === 'CURSE') {
                    skillRange = p.getWeaponRange();
                } else if (skill.type === 'MAGIC' && skill.range !== undefined) {
                    skillRange = { min: 0, max: skill.range };
                }
            }
            const inRange = !skillRange || b.isInRange(skillRange);

            const canCast = hasMana && !onCooldown && inRange;
            if (!canCast) btn.disabled = true;

            let statusLabel = `${skill.mpCost} MP`;
            let statusColor = '#3388ff';
            if (onCooldown) { statusLabel = `Recarregando (${p.skillCooldowns[skillId]})`; statusColor = '#888'; }
            else if (!hasMana) { statusColor = '#888'; }
            else if (!inRange) { statusLabel = 'Fora de alcance'; statusColor = '#ff5555'; }

            btn.innerHTML = `
                <strong>${skill.name}</strong><br>
                <span style="font-size: 0.8rem; color:${statusColor}">${statusLabel}</span>
            `;

            btn.onclick = () => {
                menu.classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn('SKILL', skillId);
            };
            list.appendChild(btn);
        });

        menu.classList.remove('hidden');
    }

    // --- MENU DE ITENS NA BATALHA ---
    openBattleItemMenu() {
        const p = window.Engine.state.player;
        const menu = document.getElementById('battle-items-menu');
        const list = document.getElementById('battle-items-list');

        const consumableIndexes = [];
        p.inventory.forEach((item, idx) => { if (item.category === 'consumable') consumableIndexes.push(idx); });

        if (consumableIndexes.length === 0) {
            this.appendBattleLog("Você não possui itens consumíveis!");
            return;
        }

        list.innerHTML = '';

        consumableIndexes.forEach(idx => {
            const item = p.inventory[idx];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';
            btn.innerHTML = `
                <strong>${item.name}</strong><br>
                <span style="font-size: 0.8rem; color:#33cc99">${item.description}</span>
            `;
            btn.onclick = () => {
                menu.classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn('ITEM', idx);
            };
            list.appendChild(btn);
        });

        menu.classList.remove('hidden');
    }

    showBattleResults(isVictory, exp, gold, leveledUp, loot = null, newAchievements = []) {
        // Lido pelo botão de retorno (ver btn-return-hub abaixo) pra decidir
        // se retoma uma viagem por Estrada em andamento (ver roads.js) — uma
        // emboscada no caminho É a próxima etapa da viagem, então vencer
        // deve continuar de onde parou, não empurrar o jogador de volta pro
        // Hub como qualquer batalha comum faria.
        this._lastBattleWasVictory = isVictory;
        this.showScreen('screen-results');

        const title = document.getElementById('result-title');
        const lvlUpText = document.getElementById('result-levelup');
        const lootContainer = document.getElementById('result-loot');
        const achievementsContainer = document.getElementById('result-achievements');
        lootContainer.innerHTML = ''; // Limpa loot anterior
        achievementsContainer.innerHTML = '';

        // Moldura/brilho do painel reagem ao desfecho (ver .results-panel.victory/
        // .defeat em style.css) — antes vitória e derrota usavam a mesma
        // moldura dourada triunfante, só o texto do título mudava.
        const resultsPanel = document.getElementById('results-panel');
        resultsPanel.classList.toggle('victory', isVictory);
        resultsPanel.classList.toggle('defeat', !isVictory);

        if (isVictory) {
            title.innerText = "Vitória Gloriosa!";
            title.style.color = "var(--color-gold)";
            document.getElementById('result-exp').innerText = `+${exp}`;
            document.getElementById('result-gold').innerText = `+${gold}`;

            if (leveledUp) {
                lvlUpText.classList.remove('hidden');
                window.AudioManager.playLevelUp();
            } else {
                lvlUpText.classList.add('hidden');
            }

            if (newAchievements && newAchievements.length > 0) {
                if (!leveledUp) window.AudioManager.playLevelUp(); // fanfarra também para conquistas
                newAchievements.forEach(ach => {
                    const toast = document.createElement('div');
                    toast.className = 'achievement-toast';
                    toast.innerText = `Conquista Desbloqueada: ${ach.name}`;
                    achievementsContainer.appendChild(toast);
                });
            }

            // Exibe o Loot — vai direto pra mochila (com notificação), sem
            // precisar clicar nele pra "pegar".
            if (loot) {
                const p = window.Engine.state.player;
                const lootTitle = document.createElement('h4');
                lootTitle.style.width = '100%';

                const itemDiv = document.createElement('div');
                itemDiv.className = 'bag-item';
                itemDiv.style.borderColor = loot.rarity.color;
                itemDiv.style.color = loot.rarity.color;
                itemDiv.innerText = this._itemIcon(loot);
                this.attachTooltip(itemDiv, loot);

                if (p.inventory.length < p.inventoryCapacity) {
                    p.inventory.push(loot);
                    window.SaveManager.save(window.Engine.state);
                    window.AudioManager.playTone(1000, 'sine', 0.1, 0.5);
                    lootTitle.innerText = "Item Encontrado (adicionado à mochila):";
                    if (window.MainMenu) window.MainMenu.showToast(`Você encontrou ${loot.name}!`, 'success');
                } else {
                    window.AudioManager.playError();
                    lootTitle.innerText = "Item Encontrado (mochila cheia, perdido):";
                    if (window.MainMenu) window.MainMenu.showToast(`Mochila cheia! ${loot.name} foi perdido.`, 'error');
                }

                lootContainer.appendChild(lootTitle);
                lootContainer.appendChild(itemDiv);
            }

        } else {
            title.innerText = "Derrota Esmagadora";
            title.style.color = "#8b0000";
            document.getElementById('result-exp').innerText = "0";
            document.getElementById('result-gold').innerText = "0";
            lvlUpText.classList.add('hidden');
        }
    }

    // --- SISTEMA DE INVENTÁRIO E STATUS ---
    openInventory() {
        this.updateInventoryStats();
        this.renderEquipment();
        this.renderEnchantments();
        this.renderBag();
        this.showScreen('screen-inventory');
    }

    // Encantamentos (ver enchantments.js): lista cada peça de equipamento
    // capaz de receber um encantamento (armas: qualquer elemento; armaduras:
    // só Sagrado/Profano) com um ciclo de opções + botão de aplicar. Sistema
    // TOTALMENTE separado da Linhagem — nunca aparece aqui nada relacionado
    // a Mutações.
    renderEnchantments() {
        const p = window.Engine.state.player;
        const container = document.getElementById('enchant-container');
        container.innerHTML = '';

        // Bug de auditoria corrigido ("não consigo ver seu dinheiro ao
        // encantar itens"): esta tela nunca mostrava o ouro do jogador em
        // lugar nenhum, então decidir se dava pra pagar um encantamento
        // (preço mostrado em cada botão "Aplicar (Xg)") exigia sair da tela,
        // conferir no Hub, e voltar. Atualizado aqui (chamado toda vez que a
        // tela abre e depois de cada compra) e não só uma vez, pra nunca
        // mostrar um valor desatualizado após aplicar um encantamento.
        const goldEl = document.getElementById('enchant-player-gold');
        if (goldEl) goldEl.innerText = p.gold;

        const enchantableSlots = [SLOTS.MAIN_HAND, SLOTS.RANGED, SLOTS.CHEST, SLOTS.HEAD, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET, SLOTS.OFF_HAND];
        const allIds = Object.keys(window.ENCHANTMENTS);

        enchantableSlots.forEach(slot => {
            const item = p.equipment[slot];
            if (!item) return;
            const isWeapon = slot === SLOTS.MAIN_HAND || slot === SLOTS.RANGED;
            const validIds = allIds.filter(id => window.EnchantmentSystem.canApply(item, id));
            if (validIds.length === 0) return;

            if (this._enchantCycle === undefined) this._enchantCycle = {};
            const cycleKey = item.uuid;
            if (this._enchantCycle[cycleKey] === undefined) {
                const currentIdx = item.enchantmentId ? validIds.indexOf(item.enchantmentId) : -1;
                this._enchantCycle[cycleKey] = currentIdx >= 0 ? currentIdx : 0;
            }

            const row = document.createElement('div');
            row.className = 'enchant-row';
            const previewId = validIds[this._enchantCycle[cycleKey] % validIds.length];
            const preview = window.ENCHANTMENTS[previewId];
            const currentName = item.enchantmentId ? window.ENCHANTMENTS[item.enchantmentId].name : 'Nenhum';

            // Item 12 da auditoria de balanceamento ("cada encantamento deve
            // aparecer na descrição"): bug de auditoria encontrado — esta
            // linha só mostrava o NOME do encantamento em preview (ex:
            // "Fogo ▸") e o custo, nunca o que ele realmente FAZ. O jogador
            // tinha que aplicar (gastando ouro) ou já saber de cor pra
            // descobrir o efeito — a descrição só aparecia DEPOIS, no
            // tooltip do item já equipado (ver updateInventoryStats).
            row.innerHTML = `
                <span class="enchant-item-name">${item.name}<br><small style="color:#888">Atual: ${currentName}</small></span>
                <div class="enchant-preview-col">
                    <button class="btn-small btn-enchant-cycle" data-preview="${preview.name}">${preview.name} ▸</button>
                    <small class="enchant-preview-desc" style="color:${preview.color}">${preview.description}</small>
                </div>
                <button class="btn-small btn-enchant-apply">Aplicar (${preview.cost}g)</button>
            `;

            row.querySelector('.btn-enchant-cycle').addEventListener('click', () => {
                this._enchantCycle[cycleKey] = (this._enchantCycle[cycleKey] + 1) % validIds.length;
                this.renderEnchantments();
            });
            row.querySelector('.btn-enchant-apply').addEventListener('click', () => {
                if (p.gold < preview.cost) {
                    window.AudioManager.playError();
                    return;
                }
                p.gold -= preview.cost;
                window.EnchantmentSystem.apply(item, previewId);
                window.SaveManager.save(window.Engine.state);
                this.renderEnchantments();
                this.updateInventoryStats();
                if (window.AudioManager) window.AudioManager.playConfirm();
            });

            container.appendChild(row);
        });

        if (container.children.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">Equipe uma arma ou armadura para encantá-la.</p>';
        }
    }

    // --- SISTEMA DE MUTAÇÕES (Linhagens) ---
    // Tela separada do Inventário/Encantamentos: mostra a linhagem permanente
    // do jogador (se houver), o progresso dos Rituais de descoberta (ver
    // rituals.js), a Skill Tree da linhagem ativa (ver skilltrees.js) e os
    // bosses de ritual já derrotados (ver enemy.js BOSS_DEFS).
    // Desenha os nós de uma árvore de habilidades (tiers, custo, botões de
    // desbloquear/equipar) dentro de `containerEl` — extraído para ser usado
    // tanto pela linhagem PRINCIPAL quanto pela SECUNDÁRIA (Natureza, ver
    // nature.js) em openMutations, já que a lógica de desenho é idêntica
    // para qualquer árvore registrada em SKILL_TREES, só muda o `treeId`
    // usado pra consultar SkillTreeSystem.
    _renderSkillTreeInto(p, treeId, containerEl, limits) {
        containerEl.innerHTML = '';
        const tree = window.SkillTreeSystem.getTreeForDisplay(p, treeId);
        if (!tree) return;
        const tiers = {};
        tree.nodes.forEach(n => { (tiers[n.tier] = tiers[n.tier] || []).push(n); });
        Object.keys(tiers).sort((a, b) => a - b).forEach(tierNum => {
            const tierRow = document.createElement('div');
            tierRow.className = 'skilltree-tier';
            tiers[tierNum].forEach(node => {
                const nodeEl = document.createElement('div');
                nodeEl.className = 'skilltree-node ' + (node.unlocked ? 'unlocked' : (node.unlockable ? 'unlockable' : 'locked'));
                // Nós ATIVOS já desbloqueados também entram no loadout de
                // batalha (ver window.SKILL_LOADOUT_LIMITS): equipar aqui é
                // o único jeito de usar uma habilidade de árvore de Linhagem
                // em combate (ui.js openBattleSkillMenu só lê
                // Player.getEquippedSkills, nunca learnedSkills cru).
                const isActiveUnlocked = node.unlocked && node.type === 'active' && node.skillDef;
                const isEquipped = isActiveUnlocked && p.isSkillEquipped(node.skillDef.id);
                const equipDisabled = isActiveUnlocked && !isEquipped && p.equippedMutationSkills.length >= limits.mutation;
                nodeEl.innerHTML = `
                    <h5>${node.name}</h5>
                    <div class="node-type">${node.type === 'active' ? 'Ativa' : 'Passiva'}</div>
                    <div>${node.description}</div>
                    <div class="node-cost">Custo: ${node.cost}${node.unlocked ? ' (Desbloqueado)' : ''}</div>
                    ${isActiveUnlocked ? `<button class="btn btn-small btn-equip-mutation" style="margin-top:8px;" ${equipDisabled ? 'disabled' : ''}>${isEquipped ? 'Desequipar' : 'Equipar'}</button>` : ''}
                `;
                if (isActiveUnlocked) {
                    nodeEl.querySelector('.btn-equip-mutation').addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        if (isEquipped) p.unequipSkill(node.skillDef.id); else p.equipSkill(node.skillDef.id);
                        window.SaveManager.save(window.Engine.state);
                        this.openMutations();
                    });
                }
                if (node.unlockable) {
                    nodeEl.addEventListener('click', () => {
                        if (window.SkillTreeSystem.unlockNode(p, treeId, node.id)) {
                            if (node.type === 'active' && node.skillDef) p.equipSkill(node.skillDef.id); // Auto-equipa se houver vaga
                            window.SaveManager.save(window.Engine.state);
                            if (window.AudioManager) window.AudioManager.playConfirm();
                            this.openMutations();
                        }
                    });
                }
                tierRow.appendChild(nodeEl);
            });
            containerEl.appendChild(tierRow);
        });
    }

    openMutations() {
        const p = window.Engine.state.player;
        const hasLineage = !!p.lineage;

        // `mutations-content` NUNCA é escondido inteiro: mesmo sem linhagem
        // despertada, o jogador precisa continuar vendo (e clicando em) o
        // progresso dos Rituais — é assim que a linhagem é descoberta. O
        // aviso "ainda não despertou" aparece como um banner ACIMA disso,
        // nunca no lugar disso.
        document.getElementById('mutations-no-lineage').classList.toggle('hidden', hasLineage);

        const currentEl = document.getElementById('mutations-current');
        currentEl.classList.toggle('hidden', !hasLineage);
        if (hasLineage) {
            const lineage = window.LineageSystem.get(p.lineage);
            currentEl.innerHTML = `
                <span class="mutations-current-icon">${lineage.icon || '✨'}</span>
                <div>
                    <div class="mutations-current-name">${lineage.name}</div>
                    <div class="mutations-current-tagline">${lineage.tagline}</div>
                    <div class="mutations-current-specialty">Especialidade: ${lineage.specialty.join(', ')}</div>
                    <div class="mutations-current-weakness">Fraqueza: ${lineage.weaknessName}</div>
                </div>
            `;
        } else {
            currentEl.innerHTML = '';
        }

        // Rituais: uma vez despertada a linhagem, nenhum outro ritual pode
        // mais ser realizado nesta campanha (regra de "apenas UMA linhagem").
        const ritualsEl = document.getElementById('mutations-rituals');
        ritualsEl.innerHTML = '';
        if (hasLineage) {
            ritualsEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.85rem;">Sua linhagem já foi despertada. Nenhum outro ritual pode ser realizado nesta campanha.</p>';
        } else {
            window.RitualSystem.getAll().forEach(ritual => {
                const lineage = window.LineageSystem.get(ritual.lineageId);
                const progress = ritual.progress(p);
                const ready = ritual.isReady(p);
                const canNow = ritual.canPerformNow(p);

                let btnLabel = 'Realizar Ritual';
                if (!ready) btnLabel = `Progresso: ${Math.floor(progress * 100)}%`;
                else if (!canNow && ritual.requiresNight) btnLabel = 'Aguarde a noite...';

                const card = document.createElement('div');
                card.className = 'ritual-card';
                card.innerHTML = `
                    <h4>${ritual.name} <small style="color:#888">(${lineage.name})</small></h4>
                    <p>${ritual.description}</p>
                    <div class="ritual-progress-bar"><div class="ritual-progress-fill" style="width:${Math.floor(progress * 100)}%"></div></div>
                    <button class="btn-small btn-ritual" ${canNow ? '' : 'disabled'}>${btnLabel}</button>
                `;
                card.querySelector('.btn-ritual').addEventListener('click', () => {
                    if (!ritual.canPerformNow(p)) return;
                    const boss = window.createBoss(lineage.bossId, p.level);
                    if (!boss) return;
                    this.beginBattleWith(boss);
                });
                ritualsEl.appendChild(card);
            });
        }

        // Skill Tree: só existe uma vez a linhagem despertada.
        const treeSection = document.getElementById('mutations-skilltree-section');
        treeSection.classList.toggle('hidden', !hasLineage);
        if (hasLineage) {
            p._ensureSkillLoadout();
            const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2 };
            document.getElementById('mutations-skillpoints').innerText = `Pontos disponíveis: ${p.mutationSkillPoints || 0}`;
            const equippedCountEl = document.getElementById('mutations-equipped-count');
            if (equippedCountEl) {
                equippedCountEl.innerText = `Equipadas para batalha: ${p.equippedMutationSkills.length}/${limits.mutation}`;
            }
            this._renderSkillTreeInto(p, p.lineage, document.getElementById('mutations-skilltree'), limits);
        }

        // Linhagem SECUNDÁRIA (Natureza, ver nature.js) — sempre exibida numa
        // seção própria, nunca substitui a linhagem PRINCIPAL acima: as duas
        // coexistem lado a lado, cada uma com seu próprio pool de pontos e
        // árvore (mesmo mecanismo genérico de SkillTreeSystem, só que
        // parametrizado por `p.secondaryLineage` em vez de `p.lineage`).
        const secondarySection = document.getElementById('mutations-secondary-section');
        const hasSecondary = !!p.secondaryLineage;
        secondarySection.classList.toggle('hidden', !hasSecondary);
        if (hasSecondary) {
            p._ensureSkillLoadout();
            const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2 };
            const natureInfo = window.NatureSystem.get();
            const active = window.NatureSystem.isActive(p);
            const amulet = p.equipment && p.equipment[SLOTS.AMULET];
            // Mensagem distinta pro caso corrompido (ver corruption.js): o
            // amuleto está de fato equipado (pra sempre, nunca removível),
            // só que seus poderes de Natureza NUNCA mais reativam — dizer
            // "não equipado" nesse caso seria enganoso, já que ele nunca
            // sai do slot.
            let inactiveNote = '';
            if (!active) {
                inactiveNote = (amulet && amulet.isProfaneAmulet)
                    ? ' <small style="color:#8a3ae0;">(Amuleto corrompido — poderes da Natureza desligados para sempre)</small>'
                    : ' <small style="color:#e74c3c;">(Amuleto não equipado — poderes inativos)</small>';
            }
            document.getElementById('mutations-secondary-current').innerHTML = `
                <span class="mutations-current-icon">🌿</span>
                <div>
                    <div class="mutations-current-name">${natureInfo.name}${inactiveNote}</div>
                    <div class="mutations-current-tagline">${natureInfo.tagline}</div>
                    <div class="mutations-current-specialty">Especialidade: ${natureInfo.specialty.join(', ')}</div>
                </div>
            `;
            document.getElementById('mutations-secondary-skillpoints').innerText = `Pontos disponíveis: ${p.natureSkillPoints || 0}`;
            this._renderSkillTreeInto(p, p.secondaryLineage, document.getElementById('mutations-secondary-skilltree'), limits);
        }

        // Bosses de ritual derrotados
        const bossesEl = document.getElementById('mutations-bosses');
        bossesEl.innerHTML = '';
        if (p.bossesDefeated && p.bossesDefeated.length > 0) {
            p.bossesDefeated.forEach(bossId => {
                const def = window.BOSS_DEFS[bossId];
                if (!def) return;
                const card = document.createElement('div');
                card.className = 'boss-defeated-card';
                card.innerText = `${def.name} — ${def.title}`;
                bossesEl.appendChild(card);
            });
        } else {
            bossesEl.innerHTML = '<p style="font-size:0.8rem; color:#888;">Nenhum boss derrotado ainda.</p>';
        }

        this.showScreen('screen-mutations');
    }

    // Cinemática "NOVA LINHAGEM DESPERTA", disparada por battle.js ao vencer
    // um boss de ritual — mostra o overlay por cima da própria tela de
    // batalha (ainda visível por trás), dispara o VFX de partículas
    // centrado no jogador, e só então chama o callback (normalmente
    // showBattleResults) para seguir o fluxo normal de fim de combate.
    showLineageAwakening(lineageId, callback) {
        const lineage = window.LineageSystem.get(lineageId);
        if (!lineage) { if (callback) callback(); return; }

        const overlay = document.getElementById('lineage-awakening-overlay');
        // Sempre reseta o kicker pro texto padrão desta cinemática — o
        // mesmo overlay é reaproveitado por _resolveNatureDiscoveryVictory
        // (Linhagem SECUNDÁRIA) com um texto diferente, e por ser um nó DOM
        // persistente (não recriado a cada chamada) o texto anterior fica
        // "grudado" se ninguém o redefinir explicitamente aqui.
        document.getElementById('lineage-awakening-kicker').innerText = 'NOVA LINHAGEM DESPERTA';
        document.getElementById('lineage-awakening-name').innerText = lineage.name;
        document.getElementById('lineage-awakening-tagline').innerText = lineage.tagline;
        overlay.classList.remove('hidden');

        if (window.GFX && window.GFX.playLineageAwakeningVFX) {
            window.GFX.playLineageAwakeningVFX((lineage.visual && lineage.visual.accent) || '#ffd700');
        }
        if (window.AudioManager && window.AudioManager.playConfirm) window.AudioManager.playConfirm();

        setTimeout(() => {
            overlay.classList.add('hidden');
            if (callback) callback();
        }, 3200);
    }

    // Cena de descoberta da Linhagem SECUNDÁRIA da Natureza (ver nature.js)
    // — disparada ao vencer o monstro das sombras que corrompia a Floresta
    // Ancestral durante uma viagem pela Estrada (ver roads.js _rollEvent,
    // ui.js btn-return-hub). Reaproveita o MESMO overlay de
    // showLineageAwakening (nunca duplica markup/CSS pra uma segunda
    // cinemática quase idêntica), só com textos e cor de VFX diferentes, e
    // ao fechar retoma a viagem em vez de ir pra tela de resultados — a
    // vitória contra esse monstro específico É o evento de descoberta, não
    // uma batalha comum.
    // `resume` decide pra onde voltar ao fechar a cinemática — o antigo
    // menu screen-road (openRoad, padrão) ou o Mundo da Estrada de verdade
    // (screen-roadworld, ver Fase 5/onRoadWorldNatureDiscovery) quando a
    // descoberta aconteceu fisicamente na Floresta Ancestral em vez de por
    // um roll de RoadSystem.advance.
    _resolveNatureDiscoveryVictory(p, resume = () => this.openRoad()) {
        const amulet = window.NatureSystem.grantGuardianAmulet(p);
        window.SaveManager.save(window.Engine.state);
        // Segurança: se por algum motivo a linhagem secundária já existisse
        // (nunca deveria, ver NatureSystem.isDiscoveryAvailable), nunca trava
        // o jogo numa cinemática vazia — só retoma a viagem normalmente.
        if (!amulet) { resume(); return; }

        const lineage = window.NATURE_LINEAGE;
        const overlay = document.getElementById('lineage-awakening-overlay');
        document.getElementById('lineage-awakening-kicker').innerText = 'LINHAGEM SECUNDÁRIA DESPERTA';
        document.getElementById('lineage-awakening-name').innerText = lineage.name;
        document.getElementById('lineage-awakening-tagline').innerText = `${lineage.tagline} Você recebeu o Amuleto do Guardião.`;
        overlay.classList.remove('hidden');

        if (window.GFX && window.GFX.playLineageAwakeningVFX) {
            window.GFX.playLineageAwakeningVFX('#4caf50');
        }
        if (window.AudioManager && window.AudioManager.playConfirm) window.AudioManager.playConfirm();

        setTimeout(() => {
            overlay.classList.add('hidden');
            resume();
        }, 3200);
    }

    // Escolha do segredo da Corrupção (ver corruption.js CorruptionSystem,
    // roads.js _rollEvent `corruptionEvent`) — overlay PRÓPRIO (nunca o
    // mesmo de showLineageAwakening: aqui o jogador de fato ESCOLHE, nunca
    // fecha sozinho num timeout). Mostra o texto de bloqueio narrativo (sem
    // botão de aceitar) se o jogador já tiver uma Linhagem principal —
    // NUNCA sobrescreve uma linhagem já escolhida — ou a escolha real
    // (Aceitar/Recusar) caso contrário. `resume` decide pra onde voltar ao
    // fechar (openRoad antigo por padrão, ou screen-roadworld quando
    // chamado via onRoadWorldCorruptionEvent — Fase 5).
    showCorruptionChoice(resume = () => this.openRoad()) {
        const p = window.Engine.state.player;
        const overlay = document.getElementById('corruption-choice-overlay');
        const textEl = document.getElementById('corruption-choice-text');
        const acceptBtn = document.getElementById('btn-corruption-accept');
        const declineBtn = document.getElementById('btn-corruption-decline');
        const canAccept = window.CorruptionSystem.canAccept(p);

        if (canAccept) {
            textEl.innerText = 'Uma entidade profana emerge da névoa: "Sinto o poder da Natureza em você, ainda intocado. Ofereço mais — corrompa o Amuleto do Guardião, e as Sombras serão suas para sempre."';
            acceptBtn.classList.remove('hidden');
            declineBtn.innerText = 'Recusar e seguir em frente';
        } else {
            textEl.innerText = 'A entidade profana se aproxima, mas recua ao sentir outro poder já ligado a você: "Já pertence a outra escuridão... ou luz. Não há nada aqui para mim."';
            acceptBtn.classList.add('hidden');
            declineBtn.innerText = 'Seguir em frente';
        }

        acceptBtn.onclick = () => {
            const ok = window.CorruptionSystem.accept(p);
            overlay.classList.add('hidden');
            if (ok) {
                window.SaveManager.save(window.Engine.state);
                this.showLineageAwakening('sombras', resume);
            } else {
                resume();
            }
        };
        declineBtn.onclick = () => {
            overlay.classList.add('hidden');
            resume();
        };

        overlay.classList.remove('hidden');
        if (window.AudioManager && window.AudioManager.playConfirm) window.AudioManager.playConfirm();
    }

    // Soma quantos pontos de atributo já foram investidos (Criação de
    // Personagem + upagens por nível) — toda base começa em 5 (ver
    // Entity.baseStats/creationData.stats), então qualquer valor acima disso
    // é "gasto". Usado tanto pro custo do respec quanto pra decidir se há
    // algo pra redistribuir (não faz sentido cobrar por um respec vazio).
    _totalSpentStatPoints(p) {
        let total = 0;
        for (let key in p.baseStats) total += Math.max(0, p.baseStats[key] - 5);
        return total;
    }

    // Custo em ouro pra redistribuir TODOS os atributos — cresce com o
    // nível (mais pontos acumulados = respec mais valioso), mas nunca chega
    // a ser proibitivo: é uma correção de erro de build, não uma taxa punitiva.
    _respecCost(p) {
        return 50 + p.level * 15;
    }

    // Zera todo baseStats de volta a 5 e devolve TODOS os pontos investidos
    // (Criação de Personagem + upagens por nível) pra statPoints, cobrando
    // em ouro — antes não existia NENHUM jeito de corrigir uma distribuição
    // de atributos ruim a não ser recomeçar o personagem do zero.
    respecStats() {
        const p = window.Engine.state.player;
        const spent = this._totalSpentStatPoints(p);
        if (spent <= 0) return;
        const cost = this._respecCost(p);
        if (p.gold < cost) {
            if (window.AudioManager) window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente!', 'error');
            return;
        }
        p.gold -= cost;
        for (let key in p.baseStats) p.baseStats[key] = 5;
        p.statPoints = (p.statPoints || 0) + spent;
        p.calculateDerivedStats();
        window.SaveManager.save(window.Engine.state);
        this.updateInventoryStats();
        if (window.AudioManager) window.AudioManager.playConfirm();
        if (window.MainMenu) window.MainMenu.showToast(`Atributos redistribuídos! ${spent} pontos devolvidos.`, 'success');
    }

    updateInventoryStats() {
        const p = window.Engine.state.player;
        p.calculateDerivedStats(); // Garante atualização

        // Raça + passiva de combate — antes só aparecia na tela de Criação de
        // Personagem (_updateRaceTagline) e nunca mais depois disso; o
        // jogador escolhia uma raça pela passiva (ex: Elfo/critChanceLowHpBonus,
        // Anão/bleedResistPercent) e não tinha nenhum lugar pra conferir de
        // novo o que ela fazia depois de fechar aquela tela uma vez. Saves
        // antigos sem `race` (de antes das Cidades-Hub Regionais) caem no
        // fallback padrão 'humano', igual ao resto do jogo.
        const raceLineEl = document.getElementById('inv-race-line');
        if (raceLineEl) {
            const race = window.RaceSystem ? window.RaceSystem.get(p.race || 'humano') : null;
            raceLineEl.innerHTML = race
                ? `${race.name}${race.passive ? ` · <span class="race-passive">✦ ${race.passive.label}</span>` : ''}`
                : '';
        }

        document.getElementById('inv-stat-points').innerText = p.statPoints || 0;

        const respecCost = this._respecCost(p);
        const respecBtn = document.getElementById('btn-respec-stats');
        document.getElementById('respec-cost').innerText = respecCost;
        respecBtn.disabled = this._totalSpentStatPoints(p) <= 0 || p.gold < respecCost;

        // Renderiza lista de botões de upar status
        const container = document.getElementById('inv-stats-list');
        container.innerHTML = '';

        const statNames = { str: "Força", agi: "Agil.", int: "Intel.", def: "Defesa", acc: "Prec.", luk: "Sorte", cha: "Carisma" };

        for (let key in p.baseStats) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span>${statNames[key]}</span>
                <div class="stat-controls">
                    <span style="display:inline-block; width:30px; text-align:center;">${p.getTotalStat(key)}</span>
                    <button class="btn-add" ${p.statPoints > 0 ? '' : 'disabled'}>+</button>
                </div>
            `;

            // Lógica de subir status
            row.querySelector('.btn-add').addEventListener('click', () => {
                if (p.statPoints > 0) {
                    p.baseStats[key]++;
                    p.statPoints--;
                    p.calculateDerivedStats();
                    this.updateInventoryStats();
                    window.SaveManager.save(window.Engine.state); // Salva a alocação
                }
            });
            container.appendChild(row);
        }

        // Estatísticas de combate reais
        document.getElementById('stat-hp').innerText = p.derivedStats.maxHp;
        document.getElementById('stat-dmg').innerText = p.derivedStats.physicalDamage;
        document.getElementById('stat-def').innerText = p.derivedStats.defenseRating;
        document.getElementById('stat-dodge').innerText = Math.floor(p.derivedStats.dodgeChance);
        document.getElementById('stat-crit').innerText = Math.floor(p.derivedStats.critChance);
        document.getElementById('stat-block').innerText = Math.floor(p.derivedStats.blockChance || 0);
        document.getElementById('stat-fatigue').innerText = p.fatigue || 0;

        // Carga (Força): peso equipado vs. capacidade — fica em vermelho
        // quando sobrecarregado (reduz esquiva, ver Entity.calculateDerivedStats).
        const loadEl = document.getElementById('stat-load');
        loadEl.innerText = p.derivedStats.currentLoad;
        loadEl.style.color = p.derivedStats.isOverloaded ? '#ff4444' : '';
        document.getElementById('stat-load-max').innerText = Math.round(p.derivedStats.carryCapacity);
    }

    renderEquipment() {
        const p = window.Engine.state.player;

        for (let slotKey in p.equipment) {
            const slotEl = document.getElementById(`slot-${slotKey}`);
            const item = p.equipment[slotKey];

            if (item) {
                // Abreviado; armas de longo alcance também mostram a munição
                // atual direto no slot, sem precisar abrir o tooltip.
                slotEl.innerText = item.name.substring(0, 3) + ".." + (item.maxAmmo ? ` ${item.ammo}/${item.maxAmmo}` : "");
                slotEl.style.borderColor = item.rarity.color;
                slotEl.style.color = item.rarity.color;
                slotEl.classList.add('filled');
                // Brilho na cor do elemento (ver enchantments.js) — mesmo
                // sinal visual usado na mochila (renderBag), pra um item
                // encantado continuar reconhecível mesmo já equipado. O
                // Amuleto Profano (ver corruption.js) nunca tem
                // enchantmentId, mas ganha o mesmo tipo de brilho (roxo
                // sombrio) só pra sinalizar visualmente sua identidade
                // amaldiçoada/fundida — "muda a aparência inteiramente",
                // como pedido.
                if (item.isProfaneAmulet) {
                    slotEl.style.boxShadow = '0 0 10px 3px #8a3ae0';
                } else {
                    slotEl.style.boxShadow = (item.enchantmentId && window.ENCHANTMENTS[item.enchantmentId])
                        ? `0 0 8px 2px ${window.ENCHANTMENTS[item.enchantmentId].color}` : '';
                }

                // Hover e Clique para desequipar — item fundido ao corpo
                // (ver corruption.js `removable:false`, hoje só o Amuleto
                // Profano) NUNCA pode ser desequipado, nem com espaço livre
                // na mochila: o clique só avisa por quê, em vez de mover o
                // item.
                this.attachTooltip(slotEl, item);
                slotEl.onclick = () => {
                    if (item.removable === false) {
                        window.AudioManager.playError();
                        if (window.MainMenu) window.MainMenu.showToast(`${item.name} está fundido ao seu corpo — não pode ser removido.`, 'error');
                        return;
                    }
                    if (p.inventory.length < p.inventoryCapacity) {
                        p.inventory.push(item);
                        p.equipment[slotKey] = null;
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    } else {
                        window.AudioManager.playError();
                        if (window.MainMenu) window.MainMenu.showToast('Mochila cheia! Libere espaço antes de desequipar.', 'error');
                    }
                };
            } else {
                // Slot vazio
                slotEl.innerText = slotKey;
                slotEl.style.borderColor = '#444';
                slotEl.style.color = '#666';
                // Bug de auditoria corrigido ("brilho de item encantado
                // aparece mesmo sem estar encantado"): diferente da mochila
                // (renderBag), que recria cada slot do zero a cada chamada,
                // os slots de Equipamento são os MESMOS elementos do DOM
                // reaproveitados pra sempre (getElementById(`slot-${slotKey}`)
                // acima) — o ramo "item encontrado" já zera/redefine o
                // boxShadow corretamente a cada render, mas este ramo "slot
                // vazio" nunca zerava o dele. Resultado: desequipar um item
                // que estava encantado deixava o brilho da COR daquele
                // encantamento grudado no slot pra sempre, mesmo com o slot
                // genuinamente vazio (ou depois preenchido por outro item
                // sem encantamento nenhum) — bug puramente visual, nenhuma
                // corrupção de dado real por trás.
                slotEl.style.boxShadow = '';
                slotEl.classList.remove('filled');
                slotEl.onmouseenter = null;
                slotEl.onclick = null;
            }
        }
    }

    renderBag() {
        const p = window.Engine.state.player;
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';

        for (let i = 0; i < p.inventoryCapacity; i++) {
            const itemSlot = document.createElement('div');
            itemSlot.className = 'bag-item';

            if (i < p.inventory.length) {
                const item = p.inventory[i];
                const isConsumable = item.category === 'consumable';

                itemSlot.innerText = this._itemIcon(item);
                itemSlot.style.borderColor = isConsumable ? '#33cc99' : item.rarity.color;
                itemSlot.style.color = isConsumable ? '#33cc99' : item.rarity.color;
                // Brilho na cor do elemento (ver enchantments.js/renderEquipment)
                itemSlot.style.boxShadow = (item.enchantmentId && window.ENCHANTMENTS[item.enchantmentId])
                    ? `0 0 8px 2px ${window.ENCHANTMENTS[item.enchantmentId].color}` : '';

                this.attachTooltip(itemSlot, item);

                if (isConsumable) {
                    // Clique usa o consumível imediatamente (fora de batalha)
                    itemSlot.onclick = () => {
                        const result = p.useConsumable(i);
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    };
                } else {
                    // Clique equipa o item (substituindo o atual se existir)
                    itemSlot.onclick = () => {
                        const currentEquipped = p.equipment[item.slot];
                        p.equipment[item.slot] = item;
                        p.inventory.splice(i, 1); // Remove da bolsa
                        if (currentEquipped) {
                            p.inventory.push(currentEquipped); // Devolve o antigo pra bolsa
                        }
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    };
                }

                // Vender por 40% do valor de mercado — botão separado (com
                // stopPropagation) pra não disparar o clique principal de
                // equipar/usar o item.
                const sellBtn = document.createElement('div');
                sellBtn.className = 'bag-item-sell';
                const sellValue = Math.max(1, Math.floor(item.value * 0.4));
                sellBtn.innerText = `$${sellValue}`;
                sellBtn.title = `Vender por ${sellValue}g (40% do valor)`;
                sellBtn.onclick = (e) => {
                    e.stopPropagation();
                    p.gold += sellValue;
                    p.inventory.splice(i, 1);
                    window.SaveManager.save(window.Engine.state);
                    this.hideTooltip();
                    window.AudioManager.playTone(700, 'sine', 0.1, 0.4);
                    if (window.MainMenu) window.MainMenu.showToast(`Vendido: ${item.name} (+${sellValue}g)`, 'success');
                    this.openInventory(); // Refresh
                };
                itemSlot.appendChild(sellBtn);
            }
            grid.appendChild(itemSlot);
        }
    }

    // Desconto por fama: comerciantes reconhecem um gladiador com muitas
    // vitórias e cobram menos. Some-se um desconto contínuo por Carisma —
    // o atributo que antes só existia como número, sem nenhuma mecânica
    // própria (ver auditoria) — pra que negociar de verdade valha a pena
    // independente de fama.
    // `shopName` (opcional) casa com o nome da loja anunciada por
    // CityEngine._eventPromotion ('Ferreiro'/'Armeiro'/'Taverna') — quando
    // bate, soma o desconto temporário real da promoção em cima dos
    // descontos permanentes de fama/Carisma.
    _shopDiscount(p, shopName = null) {
        if (!p) return 0;
        let discount = 0;
        if (p.wins >= 25) discount = 0.20;
        else if (p.wins >= 10) discount = 0.10;

        const cha = p.getTotalStat ? p.getTotalStat('cha') : 5;
        const chaDiscount = Utils.clamp((cha - 5) * 0.006, 0, 0.12); // até +12% com Carisma bem alto
        discount = Utils.clamp(discount + chaDiscount, 0, 0.35);

        const promo = window.City && window.City.activePromotion;
        if (promo && shopName && promo.shopName === shopName) {
            discount = Utils.clamp(discount + promo.discountPercent / 100, 0, 0.6);
        }
        return discount;
    }

    // Soma quanto de durabilidade falta em todo o equipamento do jogador e
    // converte num custo em ouro (0.5g por ponto, arredondado pra cima) —
    // usado pelo botão "Reparar Equipamento" do Ferreiro/Armeiro.
    _getRepairCost(p) {
        let totalMissing = 0, brokenCount = 0;
        for (let key in p.equipment) {
            const item = p.equipment[key];
            if (item && item.maxDurability) {
                const missing = item.maxDurability - item.durability;
                if (missing > 0) totalMissing += missing;
                if (item.durability <= 0) brokenCount++;
            }
        }
        return { totalMissing, brokenCount, cost: Math.ceil(totalMissing * 0.5) };
    }

    // --- SISTEMA DE MERCADO (SHOP) ---
    // `filterSlots` (array de SLOTS ou null) diferencia Ferreiro (armas) de
    // Armeiro (armaduras/escudos/acessórios) — mesma tela e lógica de compra,
    // só filtra o que é mostrado. `title` troca o cabeçalho do painel.
    // Legenda de raridade (ver RARITY em items.js) — construída dinamicamente
    // a partir do próprio registry, então uma futura raridade nova (ex:
    // "Mítico") aparece na legenda automaticamente, sem precisar tocar
    // nesta função. Cacheada no primeiro uso (o HTML nunca muda em runtime).
    _buildRarityLegend() {
        if (this._rarityLegendHtml) return this._rarityLegendHtml;
        this._rarityLegendHtml = Object.values(RARITY).map(r =>
            `<span class="rarity-legend-item"><span class="rarity-legend-dot" style="background:${r.color}"></span>${r.name}</span>`
        ).join('');
        return this._rarityLegendHtml;
    }

    openShop(filterSlots = null, title = 'Mercado', consumablesOnly = false) {
        const p = window.Engine.state.player;
        document.getElementById('shop-player-gold').innerText = p.gold;
        document.getElementById('shop-panel-title').innerText = title;
        document.getElementById('shop-rarity-legend').innerHTML = this._buildRarityLegend();
        this._currentShopFilter = filterSlots;
        this._currentShopTitle = title;
        this._currentShopConsumablesOnly = consumablesOnly;

        // Fala do comerciante: dá a sensação de um lugar com gente de
        // verdade, não só um menu de compras. Sorteada uma vez por visita
        // (não a cada refresh de estoque após uma compra), pra não ficar
        // trocando de frase toda hora que o jogador compra algo. Cache
        // agora inclui a cidade atual (ver SHOP_GREETINGS_REGIONAL) — sem
        // isso, viajar de cidade e reabrir a mesma loja (mesmo `title`)
        // manteria a fala cacheada da cidade ANTERIOR, escondendo a fala
        // regional nova por engano.
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        if (!this._shopGreetingCache || this._shopGreetingCache.title !== title || this._shopGreetingCache.cityId !== cityId) {
            const regionalPool = (SHOP_GREETINGS_REGIONAL[cityId] || {})[title];
            const lines = (regionalPool && Utils.chance(35)) ? regionalPool : (SHOP_GREETINGS[title] || SHOP_GREETINGS.Mercado);
            this._shopGreetingCache = { title, cityId, text: lines[Utils.randomInt(0, lines.length - 1)] };
        }
        document.getElementById('shop-merchant-greeting').innerText = this._shopGreetingCache.text;

        // Reparo de equipamento: só faz sentido no Ferreiro/Armeiro (lojas
        // especializadas em metal/couro), nunca na Taverna/Mercado geral.
        // `durability` já existia em TODO item de equipamento desde
        // items.js, mas nada nunca lia esse campo — peças nunca se
        // desgastavam e reparar não existia. Agora cada luta desgasta o
        // equipamento (ver battle.js endBattle) e peças com durabilidade 0
        // ficam "quebradas" (metade do dano/defesa, ver player.js).
        const repairSection = document.getElementById('shop-repair-section');
        if (filterSlots) {
            const missing = this._getRepairCost(p);
            repairSection.style.display = '';
            const statusEl = document.getElementById('shop-repair-status');
            const btn = document.getElementById('btn-repair-all');
            if (missing.totalMissing <= 0) {
                statusEl.innerText = 'Seu equipamento está em perfeitas condições.';
                btn.disabled = true;
            } else {
                statusEl.innerText = `Equipamento desgastado (${missing.brokenCount > 0 ? missing.brokenCount + ' peça(s) quebrada(s)! ' : ''}custo: ${missing.cost}g)`;
                btn.disabled = p.gold < missing.cost;
            }
            btn.onclick = () => {
                if (p.gold < missing.cost) return;
                p.gold -= missing.cost;
                for (let key in p.equipment) {
                    const item = p.equipment[key];
                    if (item && item.maxDurability) item.durability = item.maxDurability;
                }
                p.calculateDerivedStats();
                window.SaveManager.save(window.Engine.state);
                this.openShop(this._currentShopFilter, this._currentShopTitle);
            };
        } else {
            repairSection.style.display = 'none';
        }

        this.renderConsumableShop();
        // O Boticário (poções/bandagens) aparece na Taverna (consumablesOnly)
        // e no Mercado geral; Ferreiro/Armeiro são especializados e não
        // vendem consumíveis.
        document.getElementById('shop-consumables-section').style.display = (filterSlots && !consumablesOnly) ? 'none' : '';

        const itemsTitleEl = document.getElementById('shop-items-title');
        const itemsContainerEl = document.getElementById('shop-items-container');

        // A Taverna só vende poções/bandagens — sem a seção de equipamentos.
        itemsTitleEl.style.display = consumablesOnly ? 'none' : '';
        itemsContainerEl.style.display = consumablesOnly ? 'none' : '';
        if (consumablesOnly) {
            this.currentShopItems = [];
            this.showScreen('screen-shop');
            return;
        }
        // Antes esse rótulo caía em 'Ferreiro' fixo sempre que filterSlots
        // era null — nunca dava pra notar porque nenhuma loja sem filtro
        // (Mercado geral) e sem consumablesOnly tinha sido aberta de
        // verdade ainda. O Mercador Viajante (ver city.js) é a primeira.
        itemsTitleEl.innerText = title;

        // Estoque sorteado uma vez por DIA (ver CityEngine.dayCount) — antes
        // era sorteado de novo TODA VEZ que a loja era aberta, mesmo
        // revisitando no mesmo dia sem nada ter mudado no mundo. Revisitar
        // no mesmo dia agora mostra o MESMO estoque (com os itens já
        // comprados removidos, ver o onclick de compra logo abaixo); só um
        // dia novo libera um sorteio novo. Quando filtrado por categoria,
        // tenta mais algumas rodadas pra não cravar uma prateleira vazia só
        // porque o sorteio não bateu com a categoria certa.
        // Cidade-Hub atual (ver citydatabase.js) — Ferreiro/Armeiro (e
        // qualquer outra loja que passe por aqui) só sorteiam itens neutros
        // + itens culturais da cidade onde o jogador está agora (ver
        // ItemFactory.generateShopInventory `region`). A chave do cache
        // inclui a cidade: viajar e voltar no mesmo dia não deveria mostrar
        // o estoque cru da OUTRA cidade, e revisitar a mesma loja sem viajar
        // continua mostrando o mesmo estoque do dia (comportamento já
        // existente, preservado). `cityId` já foi calculado mais acima,
        // pra escolha da fala do comerciante (ver SHOP_GREETINGS_REGIONAL).
        this._shopStockCache = this._shopStockCache || {};
        const currentDay = window.City ? window.City.dayCount : 1;
        const cacheKey = `${title}::${cityId}`;
        const cachedStock = this._shopStockCache[cacheKey];
        if (cachedStock && cachedStock.day === currentDay) {
            this.currentShopItems = cachedStock.items;
        } else {
            // Mercador Viajante vende de QUALQUER região (ver
            // ItemFactory.generateShopInventory `includeAllRegions`) — só
            // ele ignora o filtro por cidade atual, condizente com a
            // própria fala dele ("terras distantes").
            const includeAllRegions = title === 'Mercador Viajante';
            let pool = ItemFactory.generateShopInventory(p.level, cityId, includeAllRegions);
            if (filterSlots) {
                pool = pool.filter(i => filterSlots.includes(i.slot));
                let attempts = 0;
                while (pool.length < 4 && attempts < 4) {
                    pool = pool.concat(ItemFactory.generateShopInventory(p.level, cityId, includeAllRegions).filter(i => filterSlots.includes(i.slot)));
                    attempts++;
                }
            }
            this.currentShopItems = pool.slice(0, 8);
            this._shopStockCache[cacheKey] = { day: currentDay, items: this.currentShopItems };
        }

        const container = document.getElementById('shop-items-container');
        container.innerHTML = '';

        const discount = this._shopDiscount(p, title);
        this.currentShopItems.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';

            const statsText = item.damage ? `Dano: ${item.damage}` : `Def: ${item.defense}`;
            const price = Math.max(1, Math.round(item.value * (1 - discount)));
            const priceLabel = discount > 0 ? `Comprar (<s style="opacity:0.6">${item.value}</s> ${price}g 🏷️)` : `Comprar (${price}g)`;
            // Item cultural regional (ver items.js `region`/citydatabase.js) —
            // um selo curto deixa claro que essa peça é exclusiva daqui, não
            // um item comum que "por acaso" só aparece nesta loja hoje. Antes
            // dizia só "Regional" sem nome nenhum — o tooltip do mesmo item
            // (ver attachTooltip) já foi corrigido pra nomear a cidade de
            // origem, então o selo do card ficava com MENOS informação que
            // o próprio hover do card logo abaixo.
            const regionCityDefForBadge = item.region && window.CityDatabase ? window.CityDatabase[item.region] : null;
            const regionBadge = regionCityDefForBadge ? `<span style="font-size:0.7rem; color:${regionCityDefForBadge.accentColor};">🌍 ${regionCityDefForBadge.name}</span>` : '';

            card.innerHTML = `
                <div>
                    <h4 style="color: ${item.rarity.color}">${this._itemIcon(item)} ${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${statsText} ${regionBadge}</p>
                </div>
                <button class="btn btn-small">${priceLabel}</button>
            `;

            this.attachTooltip(card, item);

            card.querySelector('button').onclick = () => {
                if (p.gold >= price && p.inventory.length < p.inventoryCapacity) {
                    p.gold -= price;
                    p.inventory.push(item);
                    this.currentShopItems.splice(index, 1); // Remove da loja
                    window.SaveManager.save(window.Engine.state);
                    this.hideTooltip();
                    this.openShop(this._currentShopFilter, this._currentShopTitle); // Refresh, mantendo a categoria (Ferreiro/Armeiro)
                } else if (p.gold < price) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente!', 'error');
                } else {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Inventário cheio!', 'error');
                }
            };

            container.appendChild(card);
        });

        this.showScreen('screen-shop');
    }

    // Estoque fixo do Boticário (sempre disponível, não é consumido da lista)
    renderConsumableShop() {
        const p = window.Engine.state.player;
        const container = document.getElementById('shop-consumables-container');
        container.innerHTML = '';

        const discount = this._shopDiscount(p, this._currentShopTitle);
        ItemFactory.getConsumableStock().forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            const price = Math.max(1, Math.round(item.value * (1 - discount)));
            const priceLabel = discount > 0 ? `Comprar (<s style="opacity:0.6">${item.value}</s> ${price}g 🏷️)` : `Comprar (${price}g)`;

            card.innerHTML = `
                <div>
                    <h4 style="color: #33cc99">${this._itemIcon(item)} ${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${item.description}</p>
                </div>
                <button class="btn btn-small">${priceLabel}</button>
            `;

            this.attachTooltip(card, item);

            card.querySelector('button').onclick = () => {
                if (p.gold >= price && p.inventory.length < p.inventoryCapacity) {
                    p.gold -= price;
                    p.inventory.push(item);
                    window.SaveManager.save(window.Engine.state);
                    this.hideTooltip();
                    document.getElementById('shop-player-gold').innerText = p.gold;
                } else if (p.gold < price) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente!', 'error');
                } else {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Inventário cheio!', 'error');
                }
            };

            container.appendChild(card);
        });
    }

    // --- ÁRVORE DE TALENTOS ---
    openSkillTree() {
        const p = window.Engine.state.player;
        document.getElementById('skill-points').innerText = p.skillPoints || 0;

        p._ensureSkillLoadout();
        const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2 };
        const equippedCountEl = document.getElementById('skills-equipped-count');
        if (equippedCountEl) {
            equippedCountEl.innerText = `Equipadas para batalha: ${p.equippedCommonSkills.length}/${limits.common}`;
        }

        const convertBtn = document.getElementById('btn-convert-sp-int');
        if (convertBtn) {
            convertBtn.disabled = (p.skillPoints || 0) <= 0;
            convertBtn.onclick = () => {
                if (p.convertSkillPointToInt(1) > 0) {
                    window.SaveManager.save(window.Engine.state);
                    if (window.AudioManager) window.AudioManager.playConfirm();
                    this.openSkillTree();
                }
            };
        }

        const container = document.getElementById('skills-container');
        container.innerHTML = '';

        for (let key in window.SkillDB) {
            const skill = window.SkillDB[key];
            // Habilidades exclusivas de boss (bossai.js) e de árvores de
            // Mutação/Linhagem (skilltrees.js) NUNCA aparecem aqui — essa
            // tela é só a progressão comum de combate. Bug de auditoria
            // corrigido: sem esse filtro, dava pra "comprar" habilidades de
            // boss (ex: Julgamento Final do Anjo Guardião) com pontos de
            // talento comuns, desde o nível 1, sem nunca ter enfrentado o
            // boss — um exploit real de balanceamento.
            if (skill.isBossSkill || skill.isMutationSkill) continue;
            const isUnlocked = p.learnedSkills.includes(key);
            const canUnlock = p.level >= skill.levelReq && p.skillPoints > 0 && !isUnlocked;
            const isEquipped = isUnlocked && p.isSkillEquipped(key);

            const card = document.createElement('div');
            card.className = `skill-card ${isUnlocked ? 'unlocked' : 'locked'}`;

            let btnHTML = '';
            if (isUnlocked) {
                // Equipar/Desequipar (loadout de batalha, ver
                // window.SKILL_LOADOUT_LIMITS): aprender é permanente, mas só
                // as habilidades EQUIPADAS aparecem no menu de batalha.
                const equipDisabled = !isEquipped && p.equippedCommonSkills.length >= limits.common;
                btnHTML = `
                    <p style="color:var(--color-gold); margin-top:10px;">Adquirida</p>
                    <button class="btn btn-small btn-equip-skill" style="margin-top:5px;" ${equipDisabled ? 'disabled' : ''}>${isEquipped ? 'Desequipar' : 'Equipar'}</button>
                `;
            } else {
                btnHTML = `<button class="btn btn-small" style="margin-top:10px;" ${!canUnlock ? 'disabled' : ''}>Aprender (Nv.${skill.levelReq})</button>`;
            }

            card.innerHTML = `
                <div>
                    <h3 style="color:${skill.type === 'MAGIC' ? '#a335ee' : skill.type === 'HEAL' ? '#1eff00' : '#fff'}">${skill.name}</h3>
                    <p class="skill-cost">Custo: ${skill.mpCost} MP</p>
                    <p style="font-size: 0.85rem; margin-top: 5px; color:#aaa;">${skill.description}</p>
                </div>
                ${btnHTML}
            `;

            if (isUnlocked) {
                card.querySelector('.btn-equip-skill').onclick = () => {
                    if (isEquipped) p.unequipSkill(key); else p.equipSkill(key);
                    window.SaveManager.save(window.Engine.state);
                    this.openSkillTree(); // Refresh UI
                };
            } else if (canUnlock) {
                card.querySelector('button').onclick = () => {
                    p.skillPoints--;
                    p.learnSkill(key);
                    p.equipSkill(key); // Auto-equipa se houver vaga livre no loadout
                    window.SaveManager.save(window.Engine.state);
                    this.openSkillTree(); // Refresh UI
                };
            }
            container.appendChild(card);
        }

        this.showScreen('screen-skills');
    }

    // --- CURANDEIRO ---
    openHealer() {
        document.getElementById('healer-message').innerText = '';
        this.updateHealerScreen();
        this.showScreen('screen-healer');
    }

    // Bug de auditoria corrigido: antes, esta função limpava a mensagem de
    // resultado a cada atualização — como healFatigue() SEMPRE chama
    // updateHealerScreen() logo depois de escrever "Você dormiu e
    // descansou...", a mensagem era apagada no mesmo tick, antes de qualquer
    // repintura da tela. O jogador nunca chegava a ver a confirmação. Agora
    // a mensagem só é limpa ao ABRIR a tela (ver openHealer), não a cada
    // refresh de fadiga/custo/botão.
    // Custo real cobrado pelo Curandeiro (Taverna) — extraído pra ser
    // reaproveitado entre updateHealerScreen (preview) e healFatigue
    // (cobrança de verdade), sempre com o MESMO desconto de promoção (ver
    // CityEngine._eventPromotion/ui.js _shopDiscount), pra nunca mostrar um
    // preço e cobrar outro.
    _healerCost(p) {
        const fatigue = p.fatigue || 0;
        const discount = this._shopDiscount(p, 'Taverna');
        return Math.round(fatigue * 30 * (1 - discount));
    }

    updateHealerScreen() {
        const p = window.Engine.state.player;
        const fatigue = p.fatigue || 0;
        const cost = this._healerCost(p);

        document.getElementById('healer-fatigue-level').innerText = fatigue;
        document.getElementById('healer-cost').innerText = cost;

        const promo = window.City && window.City.activePromotion;
        const promoNote = document.getElementById('healer-promo-note');
        if (promoNote) promoNote.classList.toggle('hidden', !(promo && promo.shopName === 'Taverna'));

        // O botão continua habilitado mesmo com fadiga 0 (custo 0 nesse
        // caso): dormir também zera as noites em claro (ver
        // city.js _onNightFalls), então precisa ser possível vir descansar
        // por prevenção, não só quando já há fadiga pra curar.
        const btn = document.getElementById('btn-heal-fatigue');
        btn.disabled = p.gold < cost;
        btn.onclick = () => this.healFatigue();

        // Válvula de segurança contra a espiral "sem ouro pra pagar a fadiga,
        // sem ouro pra pagar poção" (fadiga reduz dano/esquiva, o que reduz
        // ganho de ouro em batalha, que impede pagar a cura, e por aí vai) —
        // só aparece quando o jogador não pode pagar a cura completa, e cura
        // apenas 1 nível de fadiga (não zera tudo de graça, então pagar
        // continua sendo a opção melhor sempre que possível).
        const freeBtn = document.getElementById('btn-free-rest');
        freeBtn.classList.toggle('hidden', !(fatigue > 0 && p.gold < cost));
        freeBtn.onclick = () => this.freeRest();
    }

    freeRest() {
        const p = window.Engine.state.player;
        const fatigue = p.fatigue || 0;
        if (fatigue <= 0) return;

        p.cureFatigue(1);
        p.nightsWithoutSleep = 0;

        if (window.City && window.City.dayPhases) {
            window.City.dayPhaseIndex = (window.City.dayPhaseIndex + 2) % window.City.dayPhases.length;
            window.City.dayPhaseTimer = 0;
            // Bug de auditoria (novo pedido: "dormir não atualiza o mundo"):
            // pular o relógio pro período oposto NÃO disparava nenhuma
            // consequência de novo dia — dormir no chão sempre "avança o
            // tempo" de verdade (mesmo dormindo de graça, sem pagar a
            // Taverna), então precisa do MESMO avanço de mundo completo que
            // dormir pago (ver healFatigue/city.js advanceToNewDay).
            window.City.advanceToNewDay();
        }

        // Risco de assalto (item 6 da auditoria de balanceamento): dormir no
        // chão sem pagar a taverna era 100% seguro antes, igualzinho à cura
        // paga — nenhuma consequência, nenhuma decisão de verdade. Agora é
        // uma aposta real: a maioria das vezes alguém rouba entre 40%-90%
        // de TODO o ouro CARREGADO (`p.gold` — nunca `p.bankGold`, o ouro
        // guardado no Banco da cidade continua fora de alcance, ver
        // Player.bankGold), com uma pequena chance de escapar ileso e uma
        // pequena chance de encontrar um viajante amigável que ainda ajuda
        // com um pouco de ouro. A cura de fadiga/reset de noites em claro
        // acima acontecem de qualquer forma — você dormiu de verdade nos
        // três casos, só o resultado do risco que muda.
        const eventRoll = Utils.randomInt(1, 100);
        let message;
        if (eventRoll <= 8) {
            const gift = Utils.randomInt(10, 30);
            p.gold += gift;
            message = `Você dormiu no chão, mas um viajante gentil dividiu comida e ${gift} de ouro com você durante a noite.`;
            window.AudioManager.playHeal();
        } else if (eventRoll <= 16) {
            message = 'Você sentiu passos se aproximando na escuridão — mas acordou a tempo e o assaltante fugiu antes de levar nada.';
            window.AudioManager.playConfirm();
        } else {
            const stolenPercent = Utils.randomFloat(0.4, 0.9);
            const stolen = Math.floor(p.gold * stolenPercent);
            p.gold -= stolen;
            message = stolen > 0
                ? `Você foi assaltado enquanto dormia! Levaram ${stolen} de ouro.`
                : 'Você dormiu no chão, sem nada de valor com você para roubar.';
            window.AudioManager.playError();
        }

        window.SaveManager.save(window.Engine.state);
        document.getElementById('healer-message').innerText = message;
        this.updateHealerScreen();
        this.updateHubStats();
    }

    healFatigue() {
        const p = window.Engine.state.player;
        const fatigue = p.fatigue || 0;
        const cost = this._healerCost(p);

        if (p.gold < cost) {
            window.AudioManager.playError();
            document.getElementById('healer-message').innerText = 'Ouro insuficiente!';
            return;
        }

        p.gold -= cost;
        if (fatigue > 0) p.cureFatigue(fatigue);
        p.nightsWithoutSleep = 0; // dormiu de verdade — zera o contador de noites em claro (ver city.js _onNightFalls)

        // Dormir avança o relógio da cidade pro período OPOSTO do atual —
        // dia vira noite e noite vira dia (dawn/sunset invertem entre si do
        // mesmo jeito, já que ficam exatamente na metade oposta do ciclo de
        // 4 fases). Antes dormir não tinha NENHUM efeito no relógio: o
        // jogador "dormia" e continuava no mesmo instante exato do dia.
        //
        // Bug de auditoria (novo pedido: "dormir não atualiza o mundo"):
        // pular o relógio sozinho nunca disparava as consequências de um
        // dia ter se passado de verdade (estoque de loja, juros do Banco,
        // NPCs/Viajante/Mercador/Pedras de Luz) — só a fase visual mudava,
        // então o jogador podia dormir dezenas de vezes seguidas e a cidade
        // continuava "congelada" pra todo efeito prático. Ver
        // city.js advanceToNewDay() pra tudo que passa a acontecer aqui.
        if (window.City && window.City.dayPhases) {
            window.City.dayPhaseIndex = (window.City.dayPhaseIndex + 2) % window.City.dayPhases.length;
            window.City.dayPhaseTimer = 0;
            window.City.advanceToNewDay();
        }

        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playHeal();

        document.getElementById('healer-message').innerText = fatigue > 0
            ? 'Você dormiu e descansou. Fadiga totalmente curada!'
            : 'Você dormiu bem. Amanhã será outro dia.';
        this.updateHealerScreen();
        this.updateHubStats();
    }

    // --- BANCO ---
    // Ouro guardado (`bankGold`) fica fora do que o jogador "carrega" (`gold`)
    // — separado só pra dar função ao prédio; nenhuma mecânica existente
    // depende de `gold` incluir o que está no banco.
    openBank() {
        this.updateBankScreen();
        this.showScreen('screen-bank');
    }

    updateBankScreen() {
        const p = window.Engine.state.player;
        document.getElementById('bank-carried-gold').innerText = p.gold;
        document.getElementById('bank-stored-gold').innerText = p.bankGold || 0;
        document.getElementById('bank-amount').value = '';
    }

    bankDeposit() {
        const p = window.Engine.state.player;
        const amount = Math.floor(Number(document.getElementById('bank-amount').value));
        if (!amount || amount <= 0) { window.AudioManager.playError(); return; }
        if (amount > p.gold) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Você não tem ouro suficiente na mão!', 'error'); return; }
        p.gold -= amount;
        p.bankGold = (p.bankGold || 0) + amount;
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.updateBankScreen();
        this.updateHubStats();
    }

    bankWithdraw() {
        const p = window.Engine.state.player;
        const amount = Math.floor(Number(document.getElementById('bank-amount').value));
        if (!amount || amount <= 0) { window.AudioManager.playError(); return; }
        if (amount > (p.bankGold || 0)) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Você não tem ouro suficiente guardado!', 'error'); return; }
        p.bankGold -= amount;
        p.gold += amount;
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.updateBankScreen();
        this.updateHubStats();
    }

    // --- CASA DO JOGADOR ---
    openPlayerHouse() {
        const p = window.Engine.state.player;
        const statsContainer = document.getElementById('house-stats-container');
        const stats = [
            { label: 'Nível', value: p.level },
            { label: 'Vitórias', value: p.wins || 0 },
            { label: 'Derrotas', value: p.losses || 0 },
            { label: 'Ouro Total', value: (p.gold || 0) + (p.bankGold || 0) },
            { label: 'Conquistas', value: `${p.achievements.length} / ${Object.keys(window.AchievementDB).length}` },
            { label: 'Horas Jogadas', value: `${Math.round(((p.playTimeSeconds || 0) / 3600) * 10) / 10}h` },
            // Contadores de exploração da Estrada (ver road.js _resolveEvent
            // 'lore_book'/'magic_stone'/'rare_animal') — existiam desde os
            // Ciclos 23/26 mas nunca apareciam em NENHUMA tela do jogo, só
            // de relance no toast do momento da coleta. Reaproveita o MESMO
            // grid de estatísticas já existente aqui, sem criar tela nova.
            { label: 'Livros Encontrados', value: p.loreBooksFound || 0 },
            { label: 'Pedras Mágicas', value: p.magicStonesFound || 0 },
            { label: 'Animais Raros Avistados', value: p.rareAnimalsSighted || 0 },
            // visitedCityIds (city.js travelToCity) já alimenta a conquista
            // world_explorer (ver player.js AchievementDB) desde antes desta
            // sessão, mas nunca aparecia como estatística própria em nenhuma
            // tela — mesma lacuna dos 3 contadores de exploração acima.
            { label: 'Cidades Visitadas', value: `${(p.visitedCityIds || []).length} / ${Object.keys(window.CityDatabase || {}).length}` },
        ];
        statsContainer.innerHTML = stats.map(s => `
            <div class="house-stat-card">
                <span class="house-stat-label">${s.label}</span>
                <span class="house-stat-value">${s.value}</span>
            </div>
        `).join('');

        const trophyContainer = document.getElementById('house-trophies-container');
        const defeated = p.rivalsDefeated || [];
        if (defeated.length === 0) {
            trophyContainer.innerHTML = '<p class="house-empty">Nenhum troféu ainda — derrote rivais na Arena para exibi-los aqui.</p>';
        } else {
            trophyContainer.innerHTML = defeated.map(id => {
                const def = this._getAllRivals().find(r => r.id === id);
                return `<div class="house-trophy-card">🏆 ${def ? def.name : id}</div>`;
            }).join('');
        }

        this.showScreen('screen-house');
    }

    // --- MESTRE DE CARAVANAS (Cidades-Hub Regionais) ---
    // Lista todas as cidades do registro (ver citydatabase.js): a atual
    // aparece marcada, as ainda não desbloqueadas aparecem cinzentas com o
    // requisito de nível, e as demais mostram um botão de viagem com o
    // preço real da passagem.
    openCaravan() {
        const p = window.Engine.state.player;
        const currentId = window.getCurrentCityId();
        const currentDef = window.CityDatabase[currentId];
        document.getElementById('caravan-current-city').innerText = currentDef.name;

        // Floresta Ancestral (ver nature.js/roads.js) — item pedido: acesso
        // DIRETO pelo mesmo Portão da muralha, não só o encontro raro (4%)
        // durante uma viagem comum entre cidades. Card separado das
        // cidades reais abaixo (nunca aparece na lista de destinos —
        // `toId` é um id virtual, nunca existe em CityDatabase), sempre
        // disponível e de graça (a mata sagrada não pertence a cidade
        // nenhuma pra cobrar passagem).
        const forestCard = document.getElementById('caravan-forest-card');
        if (forestCard) {
            const alreadyDiscovered = window.NatureSystem && !window.NatureSystem.isDiscoveryAvailable(p);
            forestCard.querySelector('.caravan-card-info p').innerText = alreadyDiscovered
                ? 'A mata sagrada entre as cidades — segredos e recursos ainda esperam por quem a percorrer de novo.'
                : 'Uma mata neutra e antiga entre as cidades. Dizem que algo ancestral espreita lá dentro.';
            const btn = forestCard.querySelector('#btn-forest-expedition');
            if (btn) btn.onclick = () => this.startForestExpedition();
        }

        const container = document.getElementById('caravan-container');
        const cities = Object.values(window.CityDatabase);
        container.innerHTML = cities.map(city => {
            const isCurrent = city.id === currentId;
            const isLocked = p.level < city.unlockLevel;
            const classes = ['caravan-card'];
            if (isCurrent) classes.push('caravan-card-current');
            if (isLocked) classes.push('caravan-card-locked');

            let actionHtml;
            if (isCurrent) {
                actionHtml = `<span class="highlight-gold">Você está aqui</span>`;
            } else if (isLocked) {
                actionHtml = `<span>🔒 Requer nível ${city.unlockLevel}</span>`;
            } else {
                // Viagem manual (ver roads.js RoadSystem): alternativa à
                // viagem rápida instantânea, ao lado dela — nunca a
                // substitui. A cavalo custa uma fração da passagem (mais
                // rápido, sem fadiga); a pé é de graça (mais lento, custa
                // fadiga), mesma distinção mecânica real entre os dois modos
                // pedida na auditoria de mundo vivo.
                const horseCost = window.RoadSystem ? window.RoadSystem.getHorseCost(city) : 0;
                actionHtml = `
                    <button class="btn btn-small" data-city-id="${city.id}">Viagem Rápida (${city.travelCost}g)</button>
                    <button class="btn btn-small btn-road-horse" data-city-id="${city.id}">A Cavalo (${horseCost}g)</button>
                    <button class="btn btn-small btn-road-walk" data-city-id="${city.id}">A Pé (grátis)</button>
                `;
            }

            return `
                <div class="${classes.join(' ')}" style="--caravan-accent:${city.accentColor}">
                    <div class="caravan-card-info">
                        <h4>${city.name}</h4>
                        <p>${city.description}</p>
                    </div>
                    <div class="caravan-card-actions">${actionHtml}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('button[data-city-id]:not(.btn-road-horse):not(.btn-road-walk)').forEach(btn => {
            btn.onclick = () => this.travelToCity(btn.dataset.cityId);
        });
        container.querySelectorAll('.btn-road-horse').forEach(btn => {
            btn.onclick = () => this.startRoadJourney(btn.dataset.cityId, 'horse');
        });
        container.querySelectorAll('.btn-road-walk').forEach(btn => {
            btn.onclick = () => this.startRoadJourney(btn.dataset.cityId, 'walk');
        });

        this.showScreen('screen-caravan');
    }

    // Inicia uma travessia real entre cidades (ver js/road.js RoadEngine) —
    // substitui o antigo RoadSystem.startJourney (dados-por-etapa) no
    // caminho crítico (Fase 2 do redesenho de viagem: ver
    // docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md).
    // A Expedição à Floresta Ancestral continua em startForestExpedition/
    // RoadSystem, intocada (migração física dela é Fase 5).
    startRoadJourney(cityId, mode) {
        const p = window.Engine.state.player;
        const dest = window.CityDatabase[cityId];
        if (!dest || !window.RoadEngine) return;
        if (p.level < dest.unlockLevel) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Não foi possível iniciar a viagem agora.', 'error');
            return;
        }
        const horseCost = window.RoadSystem ? window.RoadSystem.getHorseCost(dest) : 0;
        if (mode === 'horse' && p.gold < horseCost) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente para alugar um cavalo!', 'error');
            return;
        }
        if (mode === 'horse') p.gold -= horseCost;

        const fromId = window.getCurrentCityId();
        p.roadWorldJourney = { fromId, toId: cityId, mode };
        window.RoadEngine.start(fromId, cityId, mode, p);
        window.SaveManager.save(window.Engine.state);
        document.getElementById('roadworld-title').innerText = `${window.CityDatabase[fromId].name} → ${dest.name}`;
        document.getElementById('roadworld-mode').innerText = mode === 'horse' ? 'A cavalo' : 'A pé';
        // Identidade visual da cidade de destino na barra do HUD (ver
        // css/style.css #screen-roadworld .hud-top) — viajar rumo à
        // Fortaleza Orc já mostra a borda avermelhada da cidade antes
        // mesmo de chegar lá, mesmo princípio já usado por accentColor em
        // outros lugares da UI (ui.js caravan-card, guide.js).
        document.getElementById('screen-roadworld').style.setProperty('--road-accent', dest.accentColor);
        this.showScreen('screen-roadworld');
    }

    abandonRoadWorld() {
        const p = window.Engine.state.player;
        p.roadWorldJourney = null;
        if (window.RoadEngine) window.RoadEngine.abandon();
        window.SaveManager.save(window.Engine.state);
        this.showScreen('screen-hub');
    }

    // Chamado pelo RoadEngine (js/road.js update()) quando o jogador chega
    // fisicamente ao fim do mundo da Estrada — equivalente ao antigo
    // `result.arrived` de RoadSystem.advance, só que disparado por posição
    // real no mapa, não por contagem de etapas.
    onRoadWorldArrival(toId) {
        const p = window.Engine.state.player;
        p.roadWorldJourney = null;
        if (window.RoadEngine) window.RoadEngine.abandon();

        // Expedição à Floresta Ancestral (ver roads.js FOREST_EXPEDITION_ID,
        // Fase 5 do redesenho): "chegar" aqui não é viajar pra uma cidade
        // nova, é só voltar pra cidade onde o jogador já estava — toId é um
        // id virtual, nunca existe em CityDatabase, então chamar
        // City.travelToCity com ele quebraria tudo. Nunca cobra passagem de
        // volta, óbvio.
        if (toId === window.FOREST_EXPEDITION_ID) {
            window.AudioManager.playConfirm();
            if (window.MainMenu) window.MainMenu.showToast('Você retorna da Floresta Ancestral.', 'info');
            this.updateHubStats();
            this.showScreen('screen-hub');
            return;
        }

        const success = window.City.travelToCity(toId, true); // skipCost=true: passagem já resolvida (a cavalo cobrado no início; a pé sempre grátis)
        if (success) {
            window.AudioManager.playConfirm();
            if (window.MainMenu) window.MainMenu.showToast(`Você chegou em ${window.CityDatabase[toId].name}!`, 'success');
            this.updateHubStats();
        }
        this.showScreen('screen-hub');
    }

    // Chamado pelo RoadEngine (js/road.js _updateBandits) quando o jogador
    // chega perto do Espírito da Natureza físico na Floresta Ancestral
    // (Fase 5, ver _generateForestEncounter) — mesmo fluxo de sempre
    // (startNatureDiscoveryBattle), só disparado por posição real em vez
    // de um roll a cada etapa. Vencer mostra a cena de descoberta (ver
    // btn-return-hub/_resolveNatureDiscoveryVictory) antes de retomar a
    // Estrada; perder encerra a travessia como qualquer derrota na Estrada.
    onRoadWorldNatureDiscovery() {
        this._pendingNatureDiscovery = true;
        window.SaveManager.save(window.Engine.state);
        this.startNatureDiscoveryBattle();
    }

    // Chamado ao interagir com a presença física da Corrupção na Floresta
    // Ancestral (Fase 5, ver _generateForestEncounter/_resolveEvent) —
    // nunca uma emboscada (nenhuma batalha começa), só a escolha narrativa
    // de sempre (ver showCorruptionChoice), retomando o Mundo da Estrada
    // em vez do antigo menu screen-road ao fechar.
    onRoadWorldCorruptionEvent() {
        this.showCorruptionChoice(() => this.showScreen('screen-roadworld'));
    }

    // Chamado pelo RoadEngine (js/road.js _updateBandits) quando o jogador
    // chega perto demais de um bandido patrulhando — a emboscada É a
    // próxima etapa da travessia (mesmo espírito de city.js _eventHunters/
    // roads.js RoadSystem.advance `ambush`), só que disparada por posição
    // física real, não por sorteio. RoadEngine continua "vivo" (não chama
    // abandon()) — só a TELA muda pra BATTLE, então o Mundo da Estrada
    // (posição do jogador, zona atual, eventos restantes) fica intacto em
    // memória, pronto pra ser retomado exatamente de onde parou se o
    // jogador vencer (ver btn-return-hub abaixo).
    onRoadWorldEncounter() {
        window.SaveManager.save(window.Engine.state);
        this.startBattle();
    }

    // Expedição direta à Floresta Ancestral pelo Portão — a partir da Fase
    // 5 do redesenho de viagem, entra no Mundo da Estrada de verdade (ver
    // js/road.js RoadEngine _generateForestEncounter), não mais no antigo
    // menu screen-road/RoadSystem. Sempre a pé, sempre de graça (a mata
    // sagrada não pertence a cidade nenhuma), sempre a partir da cidade
    // atual — voltar é pra ela mesma (ver onRoadWorldArrival).
    startForestExpedition() {
        if (!window.RoadEngine) return;
        const p = window.Engine.state.player;
        if (p.roadWorldJourney) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Não foi possível entrar na floresta agora.', 'error');
            return;
        }
        const fromId = window.getCurrentCityId();
        p.roadWorldJourney = { fromId, toId: window.FOREST_EXPEDITION_ID, mode: 'walk' };
        window.RoadEngine.start(fromId, window.FOREST_EXPEDITION_ID, 'walk', p);
        window.SaveManager.save(window.Engine.state);
        document.getElementById('roadworld-title').innerText = `${window.CityDatabase[fromId].name} → Floresta Ancestral`;
        document.getElementById('roadworld-mode').innerText = 'A pé';
        // Floresta Ancestral não existe em CityDatabase (destino virtual,
        // sem accentColor próprio) — verde mística fixa, mesma identidade
        // de cor já usada pelas zonas de floresta em road.js/citydatabase.js.
        document.getElementById('screen-roadworld').style.setProperty('--road-accent', '#4a8a5a');
        this.showScreen('screen-roadworld');
    }

    // Tela da Estrada: mostra a rota atual, o log recente de eventos e o
    // botão de avançar — id da cidade de destino é lido de
    // player.roadJourney (ver roads.js), nunca duplicado em outro lugar.
    // Expedições à Floresta Ancestral (ver roads.js startForestExpedition,
    // `journey.isForestExpedition`) são tratadas à parte logo no início:
    // `journey.toId` é um id virtual que nunca existe em CityDatabase,
    // então nunca pode passar pelo mesmo caminho de viagem entre cidades
    // reais abaixo (toDef seria undefined e quebraria tudo).
    openRoad() {
        const p = window.Engine.state.player;
        const journey = p.roadJourney;
        if (!journey) { this.showScreen('screen-hub'); return; }

        const fromDef = window.CityDatabase[journey.fromId];

        const sceneryCanvas = document.getElementById('road-scenery-canvas');

        if (journey.isForestExpedition) {
            document.getElementById('road-title').innerText = `${fromDef.name} → Floresta Ancestral`;
            document.getElementById('road-mode').innerText = 'A pé';

            const percent = Math.floor((journey.step / journey.totalSteps) * 100);
            document.getElementById('road-progress-fill').style.width = `${percent}%`;
            document.getElementById('road-progress-label').innerText = `${journey.step}/${journey.totalSteps}`;

            // Paleta fixa esverdeada/mística (ver graphics.js ARENA_BIOMES
            // floresta_ancestral) em vez de interpolar com uma cidade
            // destino que não existe de verdade. Cena procedural (ver
            // drawRoadScenery) também escondida pelo mesmo motivo — sem
            // um `toCityId` real, não faz sentido nenhuma interpolação.
            document.getElementById('screen-road').style.background = 'linear-gradient(180deg, #1a3a1522, #0a0a0a 70%)';
            if (sceneryCanvas) sceneryCanvas.classList.add('hidden');

            const logEl = document.getElementById('road-log');
            logEl.innerHTML = journey.log.map(m => `<p>${m}</p>`).join('') || '<p style="color:#888;">A mata se fecha atrás de você...</p>';

            this.showScreen('screen-road');
            return;
        }

        const toDef = window.CityDatabase[journey.toId];
        document.getElementById('road-title').innerText = `${fromDef.name} → ${toDef.name}`;
        document.getElementById('road-mode').innerText = journey.mode === 'horse' ? 'A cavalo' : 'A pé';

        const percent = Math.floor((journey.step / journey.totalSteps) * 100);
        document.getElementById('road-progress-fill').style.width = `${percent}%`;
        document.getElementById('road-progress-label').innerText = `${journey.step}/${journey.totalSteps}`;

        // Transição gradual de bioma (item pedido na auditoria de mundo
        // vivo): sem arte nova, a cor de fundo da tela já faz uma mistura
        // real entre a paleta de origem e a de destino conforme o progresso
        // avança — não é instantâneo, mesmo sendo só uma interpolação de cor.
        const t = journey.totalSteps > 0 ? journey.step / journey.totalSteps : 0;
        const blended = Utils.lerpColor ? Utils.lerpColor(fromDef.accentColor, toDef.accentColor, t) : toDef.accentColor;
        document.getElementById('screen-road').style.background = `linear-gradient(180deg, ${blended}22, #0a0a0a 70%)`;

        // Cena procedural com vegetação/solo de verdade (ver graphics.js
        // drawRoadScenery) — a MESMA transição de progresso acima, só que
        // desenhada de verdade em vez de só uma cor de fundo.
        if (sceneryCanvas) {
            sceneryCanvas.classList.remove('hidden');
            if (window.GFX && window.GFX.drawRoadScenery) window.GFX.drawRoadScenery(sceneryCanvas, journey.fromId, journey.toId, t);
        }

        const logEl = document.getElementById('road-log');
        logEl.innerHTML = journey.log.map(m => `<p>${m}</p>`).join('') || '<p style="color:#888;">A estrada se estende à sua frente...</p>';

        this.showScreen('screen-road');
    }

    advanceRoad() {
        const p = window.Engine.state.player;
        if (!window.RoadSystem || !p.roadJourney) return;
        const result = window.RoadSystem.advance(p);
        if (!result) return;
        window.SaveManager.save(window.Engine.state);

        // Segredo da Corrupção (ver corruption.js CorruptionSystem) — nunca
        // uma emboscada (nenhuma batalha começa), só uma escolha narrativa.
        // Mostra o log de aviso primeiro (mesmo padrão do ambush abaixo),
        // depois a cena de escolha.
        if (result.corruptionEvent) {
            this.openRoad();
            setTimeout(() => {
                if (window.Engine.state.player !== p || !p.roadJourney) return;
                this.showCorruptionChoice();
            }, 1400);
            return;
        }

        if (result.ambush) {
            // A emboscada É a próxima etapa da viagem — dispara uma batalha
            // real (mesmo padrão de city.js _eventHunters) depois de um
            // instante pro jogador ler o aviso na tela da Estrada; a tela de
            // batalha assume e, ao voltar (ver btn-return-hub), retoma a
            // Estrada sozinha se o jogador venceu (ver showBattleResults).
            // `elite` (chefe opcional do caminho, ver roads.js) usa um
            // inimigo mais forte que o Duelo Rápido comum, nunca o mesmo
            // startBattle() genérico. `natureDiscovery` (Floresta Ancestral,
            // ver nature.js) marca a próxima vitória pra disparar a cena de
            // descoberta em vez de só retomar a viagem — guardado numa flag
            // própria (não no roadJourney, que já é limpo/recriado em
            // vários pontos) pra sobreviver até o clique em "Continuar".
            this._pendingNatureDiscovery = !!result.natureDiscovery;
            this.openRoad(); // atualiza o log com a mensagem de aviso antes da batalha começar
            setTimeout(() => {
                if (window.Engine.state.player !== p || !p.roadJourney) return;
                if (result.natureDiscovery) this.startNatureDiscoveryBattle();
                else if (result.elite) this.startEliteRoadBattle();
                else this.startBattle();
            }, 1400);
            return;
        }

        if (result.arrived) {
            const journey = p.roadJourney;

            // Expedição à Floresta Ancestral (ver roads.js
            // startForestExpedition): "chegar" aqui não é viajar pra uma
            // cidade nova, é só voltar pra cidade onde o jogador já estava
            // (journey.toId é um id virtual, nunca existe em
            // CityDatabase — chamar City.travelToCity com ele quebraria
            // tudo). Nunca cobra passagem de volta, óbvio.
            if (journey.isForestExpedition) {
                p.roadJourney = null;
                window.AudioManager.playConfirm();
                if (window.MainMenu) window.MainMenu.showToast('Você retorna da Floresta Ancestral.', 'info');
                this.updateHubStats();
                this.showScreen('screen-hub');
                return;
            }

            const toId = journey.toId;
            p.roadJourney = null;
            const success = window.City.travelToCity(toId, true); // skipCost=true: a passagem já foi resolvida ao longo do caminho
            if (success) {
                window.AudioManager.playConfirm();
                if (window.MainMenu) window.MainMenu.showToast(`Você chegou em ${window.CityDatabase[toId].name}!`, 'success');
                this.updateHubStats();
                this.showScreen('screen-hub');
            } else {
                this.showScreen('screen-hub');
            }
            return;
        }

        this.openRoad();
    }

    abandonRoad() {
        const p = window.Engine.state.player;
        if (window.RoadSystem) window.RoadSystem.abandonJourney(p);
        window.SaveManager.save(window.Engine.state);
        this.showScreen('screen-hub');
    }

    // Valida ouro (feedback amigável antes de tentar) e delega a troca de
    // cidade de verdade pra CityEngine.travelToCity, que é quem realmente
    // cobra o ouro, persiste no save e recarrega NPCs/clima/estoque — nunca
    // duplica essa lógica aqui.
    travelToCity(cityId) {
        const p = window.Engine.state.player;
        const dest = window.CityDatabase[cityId];
        if (!dest) return;
        if (p.gold < dest.travelCost) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente para a passagem!', 'error');
            return;
        }
        const success = window.City.travelToCity(cityId);
        if (success) {
            window.AudioManager.playConfirm();
            this.updateHubStats();
            this.showScreen('screen-hub');
        } else {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Não foi possível viajar agora.', 'error');
        }
    }

    // --- HALL DA FAMA ---
    openHallOfFame() {
        const p = window.Engine.state.player;
        const container = document.getElementById('halloffame-container');
        const defeated = p.rivalsDefeated || [];
        const champions = ['bronze_champion', 'silver_champion', 'gold_champion'].filter(id => defeated.includes(id));

        let html = `
            <div class="halloffame-entry"><span>Campeões Derrotados</span><span class="highlight-gold">${champions.length} / 3</span></div>
            <div class="halloffame-entry"><span>Rivais Derrotados</span><span class="highlight-gold">${defeated.length} / ${this._getAllRivals().length}</span></div>
            <div class="halloffame-entry"><span>Maior Nível Alcançado</span><span class="highlight-gold">${p.level}</span></div>
            <div class="halloffame-entry"><span>Vitórias Totais</span><span class="highlight-gold">${p.wins || 0}</span></div>
        `;
        container.innerHTML = html;
        this.showScreen('screen-halloffame');
    }

    // --- QUADRO DE MISSÕES (novo pedido de auditoria, itens #3/#4) ---
    openQuestBoard() {
        const p = window.Engine.state.player;
        const cityId = window.getCurrentCityId();
        const cityDef = window.getCurrentCityDef();
        window.QuestSystem._ensureFields(p);

        document.getElementById('questboard-reputation').innerText =
            `Reputação em ${cityDef.name}: ${window.QuestSystem.getReputation(p, cityId)}`;

        const board = window.QuestSystem.getBoardForCity(p, cityId);

        const activeEl = document.getElementById('questboard-active');
        activeEl.innerHTML = '';
        if (board.active.length === 0) {
            activeEl.innerHTML = '<p class="questboard-empty">Nenhuma missão ativa nesta cidade.</p>';
        }
        board.active.forEach(quest => {
            const meta = window.QUEST_TYPE_META[quest.type];
            const percent = window.QuestSystem.getProgressPercent(quest, p);
            const label = window.QuestSystem.getProgressLabel(quest, p);
            const deadline = (quest.expiresAtDay !== null && quest.expiresAtDay !== undefined)
                ? `<span class="quest-deadline">Prazo: dia ${quest.expiresAtDay}</span>` : '';
            const card = document.createElement('div');
            card.className = 'quest-card quest-active';
            card.innerHTML = `
                <div class="quest-card-header" style="color:${meta.color}">${meta.icon} ${meta.name}: ${quest.name}</div>
                <div class="quest-card-giver">Pedido por: ${quest.giver}</div>
                <div class="quest-card-desc">${quest.description}</div>
                <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${percent}%; background:${meta.color}"></div></div>
                <div class="quest-progress-label">${label} ${deadline}</div>
                <div class="quest-card-reward">Recompensa: ${quest.reward.gold}g, ${quest.reward.xp}XP, +${quest.reward.reputation} reputação</div>
                <button class="btn-small btn-quest-abandon">Abandonar</button>
            `;
            card.querySelector('.btn-quest-abandon').addEventListener('click', () => {
                window.QuestSystem.abandonQuest(p, quest.instanceId);
                window.SaveManager.save(window.Engine.state);
                this.openQuestBoard();
            });
            activeEl.appendChild(card);
        });

        const availableEl = document.getElementById('questboard-available');
        availableEl.innerHTML = '';
        if (board.available.length === 0) {
            availableEl.innerHTML = '<p class="questboard-empty">Nenhuma missão nova disponível hoje. Volte amanhã.</p>';
        }
        board.available.forEach(quest => {
            const meta = window.QUEST_TYPE_META[quest.type];
            const card = document.createElement('div');
            card.className = 'quest-card quest-available';
            card.innerHTML = `
                <div class="quest-card-header" style="color:${meta.color}">${meta.icon} ${meta.name}: ${quest.name}</div>
                <div class="quest-card-giver">Pedido por: ${quest.giver}</div>
                <div class="quest-card-desc">${quest.description}</div>
                <div class="quest-card-reward">Recompensa: ${quest.reward.gold}g, ${quest.reward.xp}XP, +${quest.reward.reputation} reputação${quest.timeLimitDays ? ` (prazo: ${quest.timeLimitDays} dias)` : ''}</div>
                <button class="btn-small btn-quest-accept">Aceitar</button>
            `;
            card.querySelector('.btn-quest-accept').addEventListener('click', () => {
                window.QuestSystem.acceptQuest(p, quest);
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                this.openQuestBoard();
            });
            availableEl.appendChild(card);
        });

        this.showScreen('screen-questboard');
    }

    // --- CONQUISTAS ---
    openAchievements(source = 'hub') {
        this._achievementsSource = source;
        const p = window.Engine.state.player;
        const container = document.getElementById('achievements-container');
        container.innerHTML = '';

        const total = Object.keys(window.AchievementDB).length;
        const unlockedCount = p.achievements.length;
        document.getElementById('achievements-summary').innerText = `${unlockedCount} / ${total} desbloqueadas`;

        for (let id in window.AchievementDB) {
            const ach = window.AchievementDB[id];
            const isUnlocked = p.achievements.includes(id);

            const card = document.createElement('div');
            const rarityClass = ach.rarity ? ach.rarity.normalize('NFD').replace(/[̀-ͯ]/g, '') : 'comum';
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'} rarity-${rarityClass}`;

            if (!isUnlocked) {
                // Conquistas bloqueadas aparecem ocultas — só o contorno e "???"
                card.innerHTML = `
                    <div class="achievement-icon">❔</div>
                    <h4>???</h4>
                    <p class="achievement-desc">Conquista ainda não descoberta.</p>
                `;
            } else {
                const date = p.achievementDates && p.achievementDates[id] ? new Date(p.achievementDates[id]) : null;
                const dateStr = date ? date.toLocaleDateString('pt-BR') : '';
                let progressHtml = '';
                if (ach.goal) {
                    const current = Math.min(ach.goal, ach.progress ? ach.progress(p) : ach.goal);
                    const pct = Math.round((current / ach.goal) * 100);
                    progressHtml = `
                        <div class="achievement-progress-bar"><div class="achievement-progress-fill" style="width:${pct}%"></div></div>
                        <p class="achievement-progress-text">${current}/${ach.goal} (${pct}%)</p>
                    `;
                }
                card.innerHTML = `
                    <div class="achievement-icon">${ach.icon || '🏆'}</div>
                    <h4>${ach.name}</h4>
                    <p class="achievement-desc">${ach.description}</p>
                    ${progressHtml}
                    <p class="achievement-rarity">${ach.rarity || 'comum'}</p>
                    ${dateStr ? `<p class="achievement-date">Desbloqueada em ${dateStr}</p>` : ''}
                `;
            }
            container.appendChild(card);
        }

        this.showScreen('screen-achievements');
    }

    // --- TOOLTIP LOGIC ---
    attachTooltip(element, item) {
        element.onmouseenter = () => {
            const tt = document.getElementById('item-tooltip');
            document.getElementById('tt-name').innerText = item.name;
            document.getElementById('tt-name').style.color = item.category === 'consumable' ? '#33cc99' : item.rarity.color;

            let statsHtml = '';
            if (item.category === 'consumable') {
                document.getElementById('tt-type').innerText = 'Consumível';
                statsHtml += `<p style="color:#33cc99">${item.description}</p>`;
            } else {
                document.getElementById('tt-type').innerText = `Slot: ${item.slot.toUpperCase()}`;
                // Origem regional (ver items.js `region`/citydatabase.js) —
                // o tooltip é o único lugar de detalhe usado em TODA parte do
                // jogo que mostra um item (loja, mochila, ícones de
                // equipamento na batalha, ver _renderGearIcons), mas nunca
                // mencionava de qual cidade uma peça regional vinha; só a
                // loja tinha um selo genérico "🌍 Regional" sem nome nenhum
                // (ver openShop). Sem cidade correspondente (região
                // desconhecida/removida), não mostra nada — nunca quebra.
                const regionCityDef = item.region && window.CityDatabase ? window.CityDatabase[item.region] : null;
                if (regionCityDef) {
                    statsHtml += `<p style="color:${regionCityDef.accentColor}">🌍 Item cultural de ${regionCityDef.name}</p>`;
                }
                // Encantamento (ver enchantments.js): antes só aparecia na
                // seção dedicada "Encantamentos" da tela de Inventário — o
                // tooltip do próprio item (bag/equipamento/loja) nunca
                // mencionava nada, então uma arma flamejante e uma comum
                // pareciam idênticas em qualquer outro lugar do jogo.
                if (item.enchantmentId && window.ENCHANTMENTS[item.enchantmentId]) {
                    const ench = window.ENCHANTMENTS[item.enchantmentId];
                    statsHtml += `<p style="color:${ench.color}">✨ Encantamento: ${ench.name} — ${ench.description}</p>`;
                }
                if (item.damage) statsHtml += `<p>Dano Base: ${item.damage}</p>`;
                if (item.defense) statsHtml += `<p>Defesa Base: ${item.defense}</p>`;
                for (let stat in item.statBonuses) {
                    statsHtml += `<p style="color:#1eff00">+${item.statBonuses[stat]} ${stat.toUpperCase()}</p>`;
                }
                if (item.critBonus) statsHtml += `<p style="color:#ffcc00">+${item.critBonus}% Crítico</p>`;
                if (item.accBonus) statsHtml += `<p style="color:#ffcc00">+${item.accBonus} Precisão</p>`;
                if (item.armorPierce) statsHtml += `<p style="color:#ff8000">Perfura ${Math.floor(item.armorPierce * 100)}% da armadura</p>`;
                if (item.blockChance) statsHtml += `<p style="color:#88ccff">+${item.blockChance}% Bloqueio</p>`;
                if (item.hpBonus) statsHtml += `<p style="color:#ff4444">+${item.hpBonus} HP Máximo</p>`;
                if (item.mpBonus) statsHtml += `<p style="color:#3388ff">+${item.mpBonus} MP Máximo</p>`;
                if (item.maxAmmo) statsHtml += `<p style="color:#88ccff">Longo Alcance: ${item.ammo}/${item.maxAmmo} disparos (recarrega no início de cada batalha)</p>`;
                if (item.maxDurability) {
                    const broken = item.durability <= 0;
                    const color = broken ? '#ff4444' : (item.durability < item.maxDurability * 0.3 ? '#ffaa00' : '#888');
                    statsHtml += `<p style="color:${color}">Durabilidade: ${item.durability}/${item.maxDurability}${broken ? ' — QUEBRADA! (metade do dano/defesa, repare no Ferreiro/Armeiro)' : ''}</p>`;
                }
                statsHtml += this._buildEquippedComparison(item);
            }
            document.getElementById('tt-stats').innerHTML = statsHtml;
            document.getElementById('tt-price').innerText = `Valor: ${item.value}g`;

            tt.classList.remove('hidden');
        };
        element.onmouseleave = () => this.hideTooltip();
    }

    // Ícone de item por slot (equipamento) ou categoria (consumível) — antes
    // a mochila/loot mostravam só a letra solta "I"/"P" como "ícone
    // placeholder" (literalmente comentado como tal no código), e a loja
    // não mostrava ícone nenhum. Reaproveita o mesmo estilo de emoji já
    // usado pelos prédios da Cidade (ver city.js `icon:`), em vez de inventar
    // um sistema de sprites novo só pra isso.
    _itemIcon(item) {
        if (item.category === 'consumable') return '🧪';
        // Bug de auditoria (visual): "ícones inconsistentes" — toda arma
        // corpo-a-corpo (adaga, machado, martelo, lança, rapieira, chicote,
        // espada) caía no MESMO ícone genérico só por compartilhar o slot
        // MAIN_HAND, mesmo já existindo uma identidade visual própria por
        // TIPO de arma em combate (ver WEAPON_RENDERERS, graphics.js — cada
        // uma com sua silhueta/animação). Mapa por `item.id` (mais
        // específico que slot) cobre os tipos com formato claro o
        // suficiente pra ter ícone Unicode próprio; o resto continua no
        // ícone genérico do slot, como antes.
        const weaponIcons = {
            w_02: '🪓', w_11: '🪓', // machados (comum e Orc)
            w_03: '🗡️', // adaga
            w_04: '🔨', w_12: '🔨', // martelos (guerra e Anão)
            w_05: '🔱', // lança
            w_06: '🤺', // rapieira
            w_08: '〰️' // chicote
        };
        if (item.id && weaponIcons[item.id]) return weaponIcons[item.id];
        const icons = {
            [SLOTS.MAIN_HAND]: '⚔️', [SLOTS.RANGED]: '🏹', [SLOTS.OFF_HAND]: '🛡️',
            [SLOTS.HEAD]: '🪖', [SLOTS.CHEST]: '👕', [SLOTS.HANDS]: '🧤',
            [SLOTS.LEGS]: '👖', [SLOTS.FEET]: '👢', [SLOTS.AMULET]: '📿', [SLOTS.RING]: '💍'
        };
        return icons[item.slot] || '❔';
    }

    hideTooltip() {
        document.getElementById('item-tooltip').classList.add('hidden');
    }

    // Comparação rápida com o item já equipado no mesmo slot — antes o
    // tooltip só mostrava os números do item em si, obrigando o jogador a
    // decorar (ou reabrir o tooltip do equipado) pra saber se uma peça nova
    // da loja/mochila é realmente uma melhoria. Cobre só os campos que já
    // aparecem no tooltip acima (damage/defense/statBonuses/critBonus/
    // accBonus/blockChance/hpBonus/mpBonus) — nunca compara o item consigo
    // mesmo (mesmo uuid).
    _buildEquippedComparison(item) {
        const p = window.Engine.state.player;
        if (!p || !item.slot) return '';
        const equipped = p.equipment[item.slot];
        if (!equipped || equipped.uuid === item.uuid) return '';

        const delta = (label, newVal, curVal) => {
            const d = (newVal || 0) - (curVal || 0);
            if (d === 0) return '';
            const sign = d > 0 ? '+' : '';
            const color = d > 0 ? '#33ff66' : '#ff5555';
            const arrow = d > 0 ? '▲' : '▼';
            return `<p style="color:${color}">${arrow} ${label}: ${sign}${d}</p>`;
        };

        let html = delta('Dano Base', item.damage, equipped.damage);
        html += delta('Defesa Base', item.defense, equipped.defense);
        const allStats = new Set([...Object.keys(item.statBonuses || {}), ...Object.keys(equipped.statBonuses || {})]);
        allStats.forEach(stat => {
            html += delta(stat.toUpperCase(), (item.statBonuses || {})[stat], (equipped.statBonuses || {})[stat]);
        });
        html += delta('Crítico', item.critBonus, equipped.critBonus);
        html += delta('Precisão', item.accBonus, equipped.accBonus);
        html += delta('Bloqueio', item.blockChance, equipped.blockChance);
        html += delta('HP Máximo', item.hpBonus, equipped.hpBonus);
        html += delta('MP Máximo', item.mpBonus, equipped.mpBonus);

        if (!html) return '';
        return `<p style="color:#aaa;margin-top:4px;border-top:1px solid rgba(255,255,255,0.15);padding-top:4px;">Comparado a ${equipped.name} equipado:</p>` + html;
    }
}

// Inicializa a UI globalmente
window.addEventListener('DOMContentLoaded', () => {
    window.UI = new UIManager();
});
