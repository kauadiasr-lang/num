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
            window.SaveManager.save(window.Engine.state);
            this.updateHubStats();
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
            const previewEntity = {
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
    }

    // --- BATALHA ---
    startBattle() {
        const p = window.Engine.state.player;
        // Gera inimigo baseado no nível do jogador
        const enemy = new Enemy(p.level);
        this.beginBattleWith(enemy);
    }

    // Prepara a tela de batalha para qualquer tipo de oponente (Enemy ou Rival)
    beginBattleWith(opponent) {
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

                const card = document.createElement('div');
                card.className = `rival-card ${rivalDef.isChampion ? 'champion' : ''} ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${rivalDef.name}</h4>
                    <p>Nível ${rivalDef.level} · ${personalityName} · ${styleName}</p>
                    <p class="rival-status" style="color:${isDefeated ? '#1eff00' : (isUnlocked ? 'var(--color-gold)' : '#666')}">
                        ${isDefeated ? 'Derrotado' : (isUnlocked ? (rivalDef.isChampion ? 'Campeão' : 'Disponível') : 'Bloqueado')}
                    </p>
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
        document.getElementById('enemy-hp-text').innerText = `${b.enemy.currentHp}/${b.enemy.derivedStats.maxHp}`;

        // Ícones de status ativos (sangramento/queimadura/veneno, atordoado,
        // barreira, evasão) — os estados já existiam em playerState/
        // enemyState (ver battle.js) mas nunca tinham feedback visual algum;
        // o jogador só descobria um sangramento ativo lendo o log de texto.
        document.getElementById('player-status-icons').innerHTML = this._buildStatusIconsHtml(b.playerState);
        document.getElementById('enemy-status-icons').innerHTML = this._buildStatusIconsHtml(b.enemyState);

        this.updateDistanceDisplay();
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

        if (p.learnedSkills.length === 0) {
            this.appendBattleLog("Você ainda não aprendeu nenhuma habilidade!");
            return;
        }

        list.innerHTML = ''; // Limpa anterior

        const b = window.BattleEngine;

        p.learnedSkills.forEach(skillId => {
            const skill = window.SkillDB[skillId];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';

            // Bloqueia botão se não tiver mana suficiente, estiver em recarga ou fora de alcance
            const onCooldown = p.skillCooldowns && p.skillCooldowns[skillId] > 0;
            const hasMana = p.currentMp >= skill.mpCost;

            let skillRange = null;
            if (b) {
                if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL') {
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
        this.showScreen('screen-results');

        const title = document.getElementById('result-title');
        const lvlUpText = document.getElementById('result-levelup');
        const lootContainer = document.getElementById('result-loot');
        const achievementsContainer = document.getElementById('result-achievements');
        lootContainer.innerHTML = ''; // Limpa loot anterior
        achievementsContainer.innerHTML = '';

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

            row.innerHTML = `
                <span class="enchant-item-name">${item.name}<br><small style="color:#888">Atual: ${currentName}</small></span>
                <button class="btn-small btn-enchant-cycle" data-preview="${preview.name}">${preview.name} ▸</button>
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
                <span class="mutations-current-icon">${lineage.id === 'vampirismo' ? '🩸' : '✨'}</span>
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
            document.getElementById('mutations-skillpoints').innerText = `Pontos disponíveis: ${p.mutationSkillPoints || 0}`;
            const treeEl = document.getElementById('mutations-skilltree');
            treeEl.innerHTML = '';
            const tree = window.SkillTreeSystem.getTreeForDisplay(p, p.lineage);
            if (tree) {
                const tiers = {};
                tree.nodes.forEach(n => { (tiers[n.tier] = tiers[n.tier] || []).push(n); });
                Object.keys(tiers).sort((a, b) => a - b).forEach(tierNum => {
                    const tierRow = document.createElement('div');
                    tierRow.className = 'skilltree-tier';
                    tiers[tierNum].forEach(node => {
                        const nodeEl = document.createElement('div');
                        nodeEl.className = 'skilltree-node ' + (node.unlocked ? 'unlocked' : (node.unlockable ? 'unlockable' : 'locked'));
                        nodeEl.innerHTML = `
                            <h5>${node.name}</h5>
                            <div class="node-type">${node.type === 'active' ? 'Ativa' : 'Passiva'}</div>
                            <div>${node.description}</div>
                            <div class="node-cost">Custo: ${node.cost}${node.unlocked ? ' (Desbloqueado)' : ''}</div>
                        `;
                        if (node.unlockable) {
                            nodeEl.addEventListener('click', () => {
                                if (window.SkillTreeSystem.unlockNode(p, p.lineage, node.id)) {
                                    window.SaveManager.save(window.Engine.state);
                                    if (window.AudioManager) window.AudioManager.playConfirm();
                                    this.openMutations();
                                }
                            });
                        }
                        tierRow.appendChild(nodeEl);
                    });
                    treeEl.appendChild(tierRow);
                });
            }
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
                // encantado continuar reconhecível mesmo já equipado.
                slotEl.style.boxShadow = (item.enchantmentId && window.ENCHANTMENTS[item.enchantmentId])
                    ? `0 0 8px 2px ${window.ENCHANTMENTS[item.enchantmentId].color}` : '';

                // Hover e Clique para desequipar
                this.attachTooltip(slotEl, item);
                slotEl.onclick = () => {
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
    openShop(filterSlots = null, title = 'Mercado', consumablesOnly = false) {
        const p = window.Engine.state.player;
        document.getElementById('shop-player-gold').innerText = p.gold;
        document.getElementById('shop-panel-title').innerText = title;
        this._currentShopFilter = filterSlots;
        this._currentShopTitle = title;
        this._currentShopConsumablesOnly = consumablesOnly;

        // Fala do comerciante: dá a sensação de um lugar com gente de
        // verdade, não só um menu de compras. Sorteada uma vez por visita
        // (não a cada refresh de estoque após uma compra), pra não ficar
        // trocando de frase toda hora que o jogador compra algo.
        if (!this._shopGreetingCache || this._shopGreetingCache.title !== title) {
            const lines = SHOP_GREETINGS[title] || SHOP_GREETINGS.Mercado;
            this._shopGreetingCache = { title, text: lines[Utils.randomInt(0, lines.length - 1)] };
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
        this._shopStockCache = this._shopStockCache || {};
        const currentDay = window.City ? window.City.dayCount : 1;
        const cachedStock = this._shopStockCache[title];
        if (cachedStock && cachedStock.day === currentDay) {
            this.currentShopItems = cachedStock.items;
        } else {
            let pool = ItemFactory.generateShopInventory(p.level);
            if (filterSlots) {
                pool = pool.filter(i => filterSlots.includes(i.slot));
                let attempts = 0;
                while (pool.length < 4 && attempts < 4) {
                    pool = pool.concat(ItemFactory.generateShopInventory(p.level).filter(i => filterSlots.includes(i.slot)));
                    attempts++;
                }
            }
            this.currentShopItems = pool.slice(0, 8);
            this._shopStockCache[title] = { day: currentDay, items: this.currentShopItems };
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

            card.innerHTML = `
                <div>
                    <h4 style="color: ${item.rarity.color}">${this._itemIcon(item)} ${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${statsText}</p>
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

            const card = document.createElement('div');
            card.className = `skill-card ${isUnlocked ? 'unlocked' : 'locked'}`;

            let btnHTML = '';
            if (isUnlocked) {
                btnHTML = `<p style="color:var(--color-gold); margin-top:10px;">Adquirida</p>`;
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

            if (!isUnlocked && canUnlock) {
                card.querySelector('button').onclick = () => {
                    p.skillPoints--;
                    p.learnSkill(key);
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
        if (window.City && window.City.dayPhases) {
            window.City.dayPhaseIndex = (window.City.dayPhaseIndex + 2) % window.City.dayPhases.length;
            window.City.dayPhaseTimer = 0;
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
