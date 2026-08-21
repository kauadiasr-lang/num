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
        // Mega Atualização item 14: aba ativa do Banco (ver openBank/
        // selectBankTab) — só estado de UI, sempre reseta pra "gold" ao
        // abrir a tela, nunca persistido no save.
        this._bankActiveTab = 'gold';
        // Rework da Taverna item 1: aba ativa dos consumíveis da Taverna
        // (ver openShop/selectTavernTab) — mesmo padrão do Banco acima,
        // só estado de UI, sempre reseta pra "health" ao abrir a Taverna.
        this._tavernActiveTab = 'health';

        this.initEventListeners();
    }

    // `transition` escolhe a animação de entrada: 'fade' (padrão), 'zoom',
    // 'slide' ou 'darken'. Nunca instantâneo — toda troca de tela anima.
    showScreen(screenId, transition = 'fade') {
        const target = document.getElementById(screenId);

        // Bug de auditoria (mobile, iteração 5): attachTooltip só escuta
        // mouseenter/mouseleave — em touch não existe "mouseleave" de
        // verdade (o dedo simplesmente sai da tela), então o tooltip do
        // último item tocado ficava aberto e sobrepondo o conteúdo da
        // PRÓXIMA tela inteira (achado em Loja/mobile: o tooltip de uma
        // poção continuava visível por cima do título "Ferreiro" depois de
        // trocar de tela). Toda troca de tela agora fecha qualquer tooltip
        // que tenha ficado preso, já que ele nunca faz sentido sobreviver
        // a uma navegação real.
        this.hideTooltip();

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

        // Auditoria de UX (iteração 3, generalizada na 4): quase todo painel
        // modal do jogo usa `overflow-y:auto` + `max-height` (ver style.css)
        // e pode cortar conteúdo real — HP/Defesa/botões inteiros — sem
        // nenhum indício visual de que dá pra rolar. Descoberto primeiro no
        // criador de personagem ("Entrar na Arena" escondido abaixo da
        // dobra), depois confirmado em Inventário/Loja/Forja e outros — em
        // vez de duplicar o aviso tela por tela, toda troca de tela injeta/
        // atualiza o mesmo aviso genérico no painel ativo (ver
        // _attachScrollHintIfNeeded). rAF porque a altura real do painel só
        // existe depois que a classe 'active' aplica o layout desta tela.
        requestAnimationFrame(() => this._attachScrollHintIfNeeded(target));

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

    // Injeta (uma vez) e mantém atualizado o aviso "▼ Role para ver mais" no
    // `.panel` filho direto de uma tela — some assim que o scroll chega no
    // fim de verdade do painel, reaparece se o jogador rolar de volta pra
    // cima, e nunca aparece se o painel já couber inteiro na viewport
    // (scrollHeight <= clientHeight, comum em telas menores/mobile onde o
    // painel é proporcionalmente menor). Chamado a cada showScreen() —
    // idempotente: painéis sem overflow real nunca ganham o elemento, e
    // painéis que já têm o hint só atualizam a visibilidade dele.
    _attachScrollHintIfNeeded(screenEl) {
        const panel = screenEl.querySelector(':scope > .panel');
        if (!panel) return;
        // A tela de Créditos usa overflow:hidden com sua própria animação de
        // rolagem via transform (ver _startCreditsScroll em mainmenu.js) —
        // não é o usuário quem rola, então o aviso genérico não se aplica
        // (senão apareceria um "▼ Role para ver mais" enganoso ali).
        if (getComputedStyle(panel).overflowY !== 'auto' && getComputedStyle(panel).overflowY !== 'scroll') return;
        const scrollable = panel.scrollHeight > panel.clientHeight + 4;
        let hint = panel.querySelector(':scope > .scroll-hint');
        if (!scrollable) {
            if (hint) hint.classList.add('hidden');
            return;
        }
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'scroll-hint';
            hint.setAttribute('aria-hidden', 'true');
            hint.textContent = '▼ Role para ver mais';
            panel.appendChild(hint);
            panel.addEventListener('scroll', () => this._attachScrollHintIfNeeded(screenEl));
        }
        const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
        hint.classList.toggle('hidden', atBottom);
    }

    initEventListeners() {
        // Bug de auditoria (mobile, iteração 5): attachTooltip só cobre
        // mouseenter/mouseleave. Em navegadores touch, tocar num item com
        // tooltip dispara um mouseenter sintético (é assim que "hover" via
        // toque funciona na web), mas nunca um mouseleave de verdade — o
        // dedo só sai da tela, sem nenhum evento equivalente. Resultado: o
        // tooltip do último item tocado ficava preso aberto até a PRÓXIMA
        // vez que o dedo passasse por cima de outro item (ver também o
        // hideTooltip() adicionado em showScreen(), que cobre o caso de
        // trocar de tela). Aqui cobre o caso de tocar em qualquer outro
        // lugar DENTRO da mesma tela (rolar a loja, tocar num botão sem
        // tooltip, etc.) — fecha o tooltip preso assim que o toque não for
        // sobre o próprio item que o abriu.
        document.addEventListener('touchstart', (e) => {
            const tt = document.getElementById('item-tooltip');
            if (tt && !tt.classList.contains('hidden') && !tt.contains(e.target)) {
                this.hideTooltip();
            }
        }, { passive: true });

        // --- Navegação da Cidade (Hub) ---
        // O Hub deixou de ser um menu de botões: agora é a cidade explorável
        // (js/city.js). O jogador anda até cada prédio e interage com o
        // botão contextual "city-interact-prompt", que chama estes mesmos
        // métodos diretamente (ver CityEngine.interact()) — nada aqui muda.
        document.getElementById('btn-city-arena-quick').addEventListener('click', () => {
            document.getElementById('city-arena-menu').classList.add('hidden');
            this.previewDuel();
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

        // Modo Debug/Criativo (ver js/debugmode.js) — botão só fica
        // visível pro personagem "MarlenioDeTeste" (toggle em
        // updateHubStats), nunca aparece pra um jogador normal.
        document.getElementById('btn-hub-debug').addEventListener('click', () => this.openDebugPanel());
        document.getElementById('btn-close-debug').addEventListener('click', () => this.showScreen('screen-hub'));

        // --- Guia do Jogo — referência estática, sem depender de save/personagem,
        //     acessível tanto do Hub quanto do Menu Principal (ver mainmenu.js) ---
        document.getElementById('btn-hub-guide').addEventListener('click', () => window.GuideSystem.open('hub'));
        document.getElementById('btn-close-guide').addEventListener('click', () => window.GuideSystem.close());
        document.getElementById('btn-bank-deposit').addEventListener('click', () => this.bankDeposit());
        document.getElementById('btn-bank-withdraw').addEventListener('click', () => this.bankWithdraw());
        // Mega Atualização item 14/16: abas Dinheiro/Itens (padrão visual
        // reaproveitado do Guia do Jogo, ver guide-tabs em guide.js) +
        // Depositar Tudo/Sacar Tudo, cada par operando sobre a aba ATUAL.
        document.getElementById('bank-tabs').querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectBankTab(btn.dataset.banktab));
        });
        // Rework da Taverna item 1: mesmo padrão de bind das abas do Banco.
        document.getElementById('tavern-tabs').querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectTavernTab(btn.dataset.taverntab));
        });
        document.getElementById('btn-bank-deposit-all-gold').addEventListener('click', () => this.bankDepositAllGold());
        document.getElementById('btn-bank-withdraw-all-gold').addEventListener('click', () => this.bankWithdrawAllGold());
        document.getElementById('btn-bank-deposit-all-items').addEventListener('click', () => this.bankDepositAllItems());
        document.getElementById('btn-bank-withdraw-all-items').addEventListener('click', () => this.bankWithdrawAllItems());
        document.getElementById('btn-respec-stats').addEventListener('click', () => this.respecStats());

        // --- Fechar painéis ---
        document.getElementById('btn-close-inv').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-shop').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-skills').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-ladder').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-healer').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-open-tavern-shop').addEventListener('click', () => this.openShop(null, 'Taverna', true, 'tavern'));
        // Botão genérico de "sub-loja mágica" (ver openSkillTree, que
        // alterna visibilidade/rótulo a cada abertura conforme
        // citydatabase.js hasMagicSubShop/magicSubShopId/magicSubShopLabel)
        // — desvia pro sistema exclusivo de cada cultura que ainda usa a
        // flag: Fortaleza Orc → Mestres de Treinamento (js/orctraining.js,
        // Iteração 2, identidade é CONQUISTA, não COMPRA); Santuário Élfico
        // → Ateliê Élfico (js/elfcrafting.js, Iteração 3, identidade é
        // CRIAR, não COMPRAR). Reino Anão NÃO usa mais este botão desde a
        // Iteração 4 (a antiga "Câmara Rúnica" foi transformada em receitas
        // da Forja, ver js/forge.js RUNE_RECIPES) — `hasMagicSubShop` fica
        // false lá, então o botão nem aparece (ver openSkillTree abaixo). O
        // caminho `openShop(..., subShop)` genérico permanece só como
        // fallback pra uma futura cidade que precise de sub-loja mágica de
        // lista de verdade, nenhuma cidade atual o usa. Lê a config da
        // cidade ATUAL no momento do clique (não no bind, que só roda uma
        // vez no início do jogo) pra funcionar certo após qualquer viagem.
        document.getElementById('btn-open-rune-shop').addEventListener('click', () => {
            const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
            const subShop = (cityDef && cityDef.magicSubShopId) || 'runes';
            if (subShop === 'training') { this.openOrcTraining(); return; }
            if (subShop === 'atelier') { this.openElfCrafting(); return; }
            const title = (cityDef && cityDef.magicSubShopLabel) || 'Câmara Rúnica';
            this.openShop(null, title, true, subShop);
        });
        // Estilos de Combate (ver combatstyles.js) — botão dentro do Mercado
        // Arcano, mesma tela onde o jogador já aprende habilidades comuns.
        document.getElementById('btn-open-combatstyles').addEventListener('click', () => this.openCombatStyles());
        document.getElementById('btn-close-combatstyles').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-combatstyles-back').addEventListener('click', () => {
            document.getElementById('combatstyles-detail').classList.add('hidden');
            document.getElementById('combatstyles-list').classList.remove('hidden');
            this._renderCombatStylesList();
        });
        document.getElementById('btn-close-bank').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-house').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-halloffame').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-questboard').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-caravan').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-forge').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-oretrader').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-orctraining').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-elfcrafting').addEventListener('click', () => this.showScreen('screen-hub'));
        // Estimulantes Tribais (ver comentário completo em index.html) —
        // única parte do antigo "Círculo de Treinamento" que continua
        // sendo openShop() de verdade, e de propósito: o pedido permite
        // preparados temporários como identidade Orc legítima, só não como
        // a mecânica PRINCIPAL da cidade (essa agora são os Mestres).
        document.getElementById('btn-open-orc-stimulants').addEventListener('click', () => this.openShop(null, 'Estimulantes Tribais', true, 'training'));
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
        // Bug relatado: "não dá pra andar pela floresta no celular". Causa
        // raiz: o listener de clique estava preso ao PRÓPRIO canvas
        // (#game-canvas), mas o canvas fica ATRÁS de #ui-layer no DOM — e
        // #screen-roadworld (um dos `.screen` dentro de #ui-layer) cobre a
        // tela inteira por cima dele. `elementFromPoint` num toque real
        // confirmou que o evento nunca chegava ao canvas, só ao próprio
        // #screen-roadworld — então o clique/toque NUNCA disparava
        // handleClick, em nenhuma plataforma (mobile OU desktop, embora só
        // tenha sido notado no celular, onde não há WASD como alternativa).
        // Mesmo padrão já usado (e já funcionando) por CityEngine._setupInput:
        // o listener escuta no PRÓPRIO elemento `.screen` (que de fato
        // recebe o evento), e usa `canvas.getBoundingClientRect()` só pra
        // converter clientX/clientY em coordenada relativa ao canvas —
        // nunca precisa que o listener esteja no canvas em si.
        const roadScreenEl = document.getElementById('screen-roadworld');
        roadScreenEl.addEventListener('click', (e) => {
            if (!window.RoadEngine || !window.RoadEngine._isActive()) return;
            if (e.target.closest('button')) return; // não interfere com o aviso de interação/botão de abandonar
            // Trava de segurança contra o "clique" de compatibilidade que
            // navegadores/webviews disparam alguns instantes depois de um
            // toque real (ver touchend abaixo) — mesmo princípio já usado
            // por CityEngine._setupInput.
            if (performance.now() - (this._lastRoadTouchHandledAt || 0) < 600) return;
            const canvas = document.getElementById('game-canvas');
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;
            const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
            window.RoadEngine.handleClick(screenX - offset.dx, screenY - offset.dy);
        });
        // Toque dedicado (evita atraso/perda de "ghost click" em alguns
        // navegadores móveis) — mesmo padrão de CityEngine._setupInput.
        roadScreenEl.addEventListener('touchend', (e) => {
            if (!window.RoadEngine || !window.RoadEngine._isActive()) return;
            if (e.target.closest('button')) return;
            if (e.changedTouches && e.changedTouches[0]) {
                e.preventDefault();
                this._lastRoadTouchHandledAt = performance.now();
                const t = e.changedTouches[0];
                const canvas = document.getElementById('game-canvas');
                const rect = canvas.getBoundingClientRect();
                const screenX = t.clientX - rect.left, screenY = t.clientY - rect.top;
                const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
                window.RoadEngine.handleClick(screenX - offset.dx, screenY - offset.dy);
            }
        }, { passive: false });
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
                    } else if (this._pendingWolfDenAlpha) {
                        // Lobo Alfa da Toca (ver onWolfEncounter) — só concede a
                        // recompensa quando é ELE quem cai, nunca um lobo comum.
                        this._pendingWolfDenAlpha = false;
                        this._grantWolfDenReward(p);
                        this.showScreen('screen-roadworld');
                    } else {
                        this.showScreen('screen-roadworld');
                    }
                } else {
                    this._pendingNatureDiscovery = false;
                    this._pendingWolfDenAlpha = false;
                    p.roadWorldJourney = null;
                    if (window.RoadEngine) window.RoadEngine.abandon();
                    window.SaveManager.save(window.Engine.state);
                    if (window.MainMenu) window.MainMenu.showToast('Derrotado, você recua e abandona a viagem.', 'error');
                    this.showScreen('screen-hub');
                }
                return;
            }
            // Arena dos Campeões (item 9 da mega-diretiva) — mesmo padrão
            // dos blocos de viagem acima: vencer avança pra próxima etapa
            // da sequência (sem passar pelo Hub no meio), perder encerra a
            // corrida inteira aqui mesmo. Ver player.js championsArenaRun.
            if (p && p.championsArenaRun) {
                if (this._lastBattleWasVictory) {
                    this._advanceChampionsArena();
                } else {
                    p.championsArenaRun = null;
                    window.SaveManager.save(window.Engine.state);
                    if (window.MainMenu) window.MainMenu.showToast('Derrotado na Arena dos Campeões. A sequência recomeça do início.', 'error');
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
        if (el) {
            if (!race) { el.innerHTML = ''; }
            else {
                // `passive` (ver races.js) é o traço único de combate da raça —
                // some logo abaixo da tagline pra deixar claro que não é só
                // estética.
                const passiveHtml = race.passive ? `<br><span class="race-passive">✦ ${race.passive.label}</span>` : '';
                el.innerHTML = `${race.tagline}${passiveHtml}`;
            }
        }
        // Toda troca de raça muda o bônus racial de cada atributo — o
        // detalhamento Base/Raça/Pontos/Total (ver _refreshAllStatBreakdowns)
        // precisa refletir a raça nova na hora, senão o jogador veria o
        // bônus da raça ANTERIOR até mexer nos pontos de novo.
        if (this.creationData.stats) this._refreshAllStatBreakdowns();
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
                <div class="stat-info">
                    <span class="stat-name">${this.creationData.names[key]}</span>
                    <span class="stat-breakdown" id="breakdown-${key}"></span>
                </div>
                <div class="stat-controls">
                    <button class="btn-sub" data-stat="${key}">-</button>
                    <span id="val-${key}" style="display:inline-block; width:20px; text-align:center;">${this.creationData.stats[key]}</span>
                    <button class="btn-add" data-stat="${key}">+</button>
                </div>
            `;
            container.appendChild(row);
        }
        this._refreshAllStatBreakdowns();

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
        this._refreshStatBreakdown(statKey);
        this.validateCreation();
    }

    // Detalhamento "BASE + BÔNUS RACIAL + PONTOS DISTRIBUÍDOS = TOTAL" pedido
    // explicitamente pelo usuário ("MUITO IMPORTANTE" — o bônus racial
    // precisa aparecer imediatamente na Criação, nunca ficar escondido até
    // a primeira batalha). `creationData.stats[key]` já é "Base(5) + Pontos"
    // combinados num único número (é isso que os botões +/- editam, sempre
    // entre 5 e 15) — então "Pontos" aqui é sempre `stats[key] - 5`, nunca
    // um campo separado. O Total mostrado é DELIBERADAMENTE o mesmo cálculo
    // de Entity.getTotalStat (player.js): `baseStats[key] + raceMod` — depois
    // de finalizeCharacterCreation, `player.baseStats = {...creationData.stats}`,
    // então este Total é bit-a-bit o mesmo valor que o resto do jogo vai usar,
    // nunca uma conta paralela que pode divergir.
    _statBreakdownHtml(key) {
        const base = 5;
        const points = this.creationData.stats[key] - base;
        const race = window.RaceSystem ? window.RaceSystem.get(this.creationData.race) : null;
        const raceMod = (race && race.statMods && race.statMods[key]) || 0;
        const total = this.creationData.stats[key] + raceMod;
        const fmtSigned = (n) => (n >= 0 ? `+${n}` : `${n}`);
        const raceCls = raceMod > 0 ? 'stat-bonus-pos' : (raceMod < 0 ? 'stat-bonus-neg' : '');
        const pointsCls = points > 0 ? 'stat-bonus-pos' : '';
        return `Base ${base} `
            + `<span class="${raceCls}">Raça ${fmtSigned(raceMod)}</span> `
            + `<span class="${pointsCls}">Pontos ${fmtSigned(points)}</span> `
            + `= <span class="stat-total">Total ${total}</span>`;
    }

    _refreshStatBreakdown(key) {
        const el = document.getElementById(`breakdown-${key}`);
        if (el) el.innerHTML = this._statBreakdownHtml(key);
    }

    _refreshAllStatBreakdowns() {
        for (let key in this.creationData.stats) this._refreshStatBreakdown(key);
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

        // Modo Debug/Criativo (ver js/debugmode.js) — ativado só quando o
        // nome é EXATAMENTE "MarlenioDeTeste". Roda ANTES do resto do
        // fluxo normal de criação (que continua intocado logo abaixo:
        // raça/visual/cidade natal/arma inicial/save) — só liga a flag
        // `isDebugMode` e dá o primeiro estoque de ouro, nunca substitui
        // nenhum passo da criação normal.
        if (window.DebugMode && window.DebugMode.isDebugName(name)) {
            window.DebugMode.setup(window.Engine.state.player);
        }

        // Passa os atributos, raça e visual customizados
        window.Engine.state.player.baseStats = { ...this.creationData.stats };
        window.Engine.state.player.race = this.creationData.race || 'humano';
        window.Engine.state.player.visuals = { ...this.creationData.visuals };

        // Item 18 da revisão profunda: cidade natal por raça/povo (ver
        // RACE_HOME_CITY em citydatabase.js), em vez do DEFAULT_CITY_ID fixo
        // que o construtor de Player já usou como placeholder.
        const homeCityId = (window.RACE_HOME_CITY && window.RACE_HOME_CITY[window.Engine.state.player.race]) || window.DEFAULT_CITY_ID;
        window.Engine.state.player.currentCityId = homeCityId;
        window.Engine.state.player.visitedCityIds = [homeCityId];

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
        // Modo Debug/Criativo (ver js/debugmode.js) — "ouro infinito" sem
        // interceptar toda compra do jogo: sempre que o Hub atualiza (todo
        // retorno de loja/forja/batalha/etc), o ouro volta pro teto se
        // caiu abaixo dele. Nunca roda pra um jogador normal (isDebugMode
        // só existe no personagem "MarlenioDeTeste"). O badge "🧪 MODO
        // CRIATIVO" (ver index.html hud-top) só aparece no mesmo caso.
        window.DebugMode && window.DebugMode.ensureInfiniteGold(p);
        const debugBadge = document.getElementById('hud-debug-badge');
        if (debugBadge) debugBadge.classList.toggle('hidden', !p.isDebugMode);
        const debugBtn = document.getElementById('btn-hub-debug');
        if (debugBtn) debugBtn.classList.toggle('hidden', !p.isDebugMode);
        document.getElementById('hub-player-name').innerText = p.name;
        document.getElementById('hub-player-level').innerText = p.level;
        document.getElementById('hub-player-gold').innerText = p.gold;
        // Fase 13 da diretiva de balanceamento (Iteração 20) — achado #10:
        // o jogo nunca sugeria sacar do Banco quando o jogador estava em
        // crise de ouro carregado. "Crise" aqui é o mesmo piso usado como
        // referência em toda a UI de baixo nível (menos de 20g já dificulta
        // qualquer serviço básico — poção, encantamento simples). Só
        // aparece quando há ouro de verdade parado no Banco pra sacar;
        // nunca sugere uma ação que não resolveria nada. Reaproveita
        // `p.bankGold`, o mesmo campo já usado por bankWithdraw/openBank —
        // nenhuma lógica nova de saldo, só a exposição de uma informação
        // que já existia mas nunca era destacada no momento em que
        // importa (mesmo espírito do risco de ouro da Iteração 8 e do
        // indicador de Estilo de Combate da Iteração 15).
        const bankHintEl = document.getElementById('hub-bank-hint');
        if (bankHintEl) {
            const inCrisis = p.gold < 20 && (p.bankGold || 0) > 0;
            bankHintEl.classList.toggle('hidden', !inCrisis);
            if (inCrisis) bankHintEl.innerText = `🏦 Você tem ${p.bankGold}g guardados no Banco`;
        }
        document.getElementById('hub-player-exp').innerText = p.exp;
        document.getElementById('hub-player-max-exp').innerText = p.getExpRequired();
        document.getElementById('hub-player-fatigue').innerText = p.fatigue || 0;
        // Reputação (ver reputation.js) — GLOBAL, a mesma nas três
        // Cidades-Hub (pedido explícito do usuário: nunca reputação
        // separada por cidade). O rótulo de faixa (Infame/Malvisto/Neutro/
        // Respeitado/Lendário) acompanha o número pra deixar a "tendência"
        // clara sem precisar abrir nenhuma outra tela.
        if (window.ReputationSystem) {
            const repValue = window.ReputationSystem.getValue(p);
            const tier = window.ReputationSystem.getTier(p);
            const repEl = document.getElementById('hub-player-reputation');
            repEl.innerText = repValue;
            repEl.style.color = tier.tone === 'positive' ? 'var(--color-gold)' : (tier.tone === 'negative' ? '#e04040' : '');
            document.getElementById('hub-player-reputation-tier').innerText = `${tier.badge} ${tier.label}`;
        }
        // Cidade-Hub atual (ver citydatabase.js) — visível o tempo todo no
        // topo do Hub, não só dentro do menu do Viajante do Portão.
        if (window.getCurrentCityDef) {
            document.getElementById('hub-city-name').innerText = window.getCurrentCityDef().name;
        }
    }

    // --- MODO DEBUG/CRIATIVO (ver js/debugmode.js) ---
    // Só alcançável pelo personagem "MarlenioDeTeste" (botão do Hub fica
    // oculto pra qualquer outro, ver updateHubStats). Re-renderiza a tela
    // inteira a cada ação (mesmo padrão de refresh já usado por
    // openForge/openElfCrafting/etc), sempre lendo o estado ATUAL do
    // player, nunca cacheando nada entre aberturas.
    openDebugPanel() {
        const p = window.Engine.state.player;
        const container = document.getElementById('debug-container');
        if (!p || !container) return;

        const section = (title, bodyHtml) => `
            <div class="guide-block">
                <h4>${title}</h4>
                ${bodyHtml}
            </div>
        `;

        // --- Atributos ---
        const statKeys = ['str', 'agi', 'int', 'def', 'acc', 'luk', 'cha'];
        const statInputs = statKeys.map(k =>
            `<label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">${k.toUpperCase()}
                <input type="number" id="debug-stat-${k}" value="${p.baseStats[k]}" style="width:60px;">
            </label>`
        ).join('');
        const attrsHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px;">${statInputs}</div>
            <button class="btn btn-small" id="debug-apply-stats">Aplicar Atributos</button>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin:14px 0 10px;">
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Nível
                    <input type="number" id="debug-level" value="${p.level}" style="width:70px;"></label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">EXP
                    <input type="number" id="debug-exp" value="${p.exp}" style="width:70px;"></label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Pontos de Atributo
                    <input type="number" id="debug-statpoints" value="${p.statPoints}" style="width:70px;"></label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Pontos de Habilidade
                    <input type="number" id="debug-skillpoints" value="${p.skillPoints}" style="width:70px;"></label>
            </div>
            <button class="btn btn-small" id="debug-apply-progression">Aplicar Nível/EXP/Pontos</button>
        `;

        // --- Linhagens ---
        const lineages = window.LineageSystem ? window.LineageSystem.getAvailable() : [];
        const lineageBtns = lineages.map(l =>
            `<button class="btn btn-small debug-set-lineage" data-lineage="${l.id}" ${p.lineage === l.id ? 'disabled' : ''}>${l.icon} ${l.name}${p.lineage === l.id ? ' (ativa)' : ''}</button>`
        ).join(' ');
        const lineageHtml = `
            <p style="font-size:0.8rem; color:#aaa;">Linhagem atual: <strong>${p.lineage ? (window.LineageSystem.get(p.lineage) || {}).name : 'Nenhuma'}</strong></p>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">${lineageBtns}</div>
            <button class="btn btn-small" id="debug-clear-lineage">Remover Linhagem</button>
            <hr style="border-color:rgba(255,255,255,0.1); margin:12px 0;">
            <p style="font-size:0.8rem; color:#aaa;">Linhagem secundária (Natureza): <strong>${p.secondaryLineage ? 'Ativa' : 'Nenhuma'}</strong></p>
            <button class="btn btn-small" id="debug-set-nature">Ativar Natureza</button>
            <button class="btn btn-small" id="debug-clear-nature">Remover Natureza</button>
        `;

        // --- Árvores de Habilidade ---
        const treeIds = window.SKILL_TREES ? Object.keys(window.SKILL_TREES) : [];
        const treeBtns = treeIds.map(id =>
            `<button class="btn btn-small debug-unlock-tree" data-tree="${id}">Desbloquear tudo: ${id}</button>`
        ).join(' ');
        const treesHtml = `<div style="display:flex; flex-wrap:wrap; gap:8px;">${treeBtns}</div>
            <p style="font-size:0.75rem; color:#888; margin-top:6px;">Exige a linhagem correspondente ativa (principal ou secundária) — ative acima primeiro se precisar.</p>`;

        // --- Itens ---
        const equipCategories = ['weapons', 'armors', 'shields', 'trinkets'];
        const itemsHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Tipo
                    <select id="debug-item-kind">
                        <option value="equipment">Equipamento</option>
                        <option value="consumable">Consumível</option>
                        <option value="material">Material</option>
                        <option value="essence">Essência</option>
                        <option value="rune">Runa</option>
                    </select>
                </label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;" id="debug-item-category-wrap">Categoria
                    <select id="debug-item-category">${equipCategories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                </label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Item
                    <select id="debug-item-template"></select>
                </label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;" id="debug-item-rarity-wrap">Raridade
                    <select id="debug-item-rarity">${RARITY_ORDER.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select>
                </label>
                <button class="btn btn-small" id="debug-add-item">Adicionar</button>
            </div>
            <button class="btn btn-small" id="debug-clear-inventory" style="margin-top:10px; background:#7a2a2a;">Limpar Mochila (${p.inventory.length} itens)</button>
        `;

        // --- Aparência/Raça ---
        const raceOptions = window.RACES ? Object.keys(window.RACES).map(id => `<option value="${id}" ${p.race === id ? 'selected' : ''}>${window.RACES[id].name}</option>`).join('') : '';
        const visuals = p.visuals || {};
        const appearanceHtml = `
            <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end;">
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Raça
                    <select id="debug-race">${raceOptions}</select>
                </label>
                <button class="btn btn-small" id="debug-apply-race">Aplicar Raça</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-top:10px;">
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Pele
                    <input type="color" id="debug-visual-skin" value="${visuals.skinTone || '#ffcc99'}"></label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Olhos
                    <input type="color" id="debug-visual-eye" value="${visuals.eyeColor || '#1a1a1a'}"></label>
                <label style="display:flex; flex-direction:column; font-size:0.7rem; color:#aaa;">Cabelo
                    <input type="color" id="debug-visual-hair" value="${visuals.hairColor || '#2a1a0a'}"></label>
                <button class="btn btn-small" id="debug-apply-visuals">Aplicar Aparência</button>
            </div>
        `;

        // --- Progressão de Mundo (reputação/missões/bosses) ---
        const activeQuestCount = Object.keys(p.activeQuests || {}).length;
        const worldHtml = `
            <button class="btn btn-small" id="debug-max-rep">Maximizar Reputação</button>
            <button class="btn btn-small" id="debug-min-rep">Minimizar Reputação</button>
            <button class="btn btn-small" id="debug-complete-quests">Completar Missões Ativas (${activeQuestCount})</button>
            <br><br>
            <button class="btn btn-small" id="debug-fight-vampire">⚔️ Lutar: Conde Vampiro</button>
            <button class="btn btn-small" id="debug-fight-angel">⚔️ Lutar: Anjo Guardião</button>
        `;

        container.innerHTML =
            section('💰 Ouro', `<p style="font-size:0.8rem; color:#aaa;">Ouro atual: <strong>${p.gold}</strong> (mantido no teto automaticamente — nunca precisa de botão de recarregar).</p>`) +
            section('💪 Atributos e Progressão', attrsHtml) +
            section('🩸 Linhagens', lineageHtml) +
            section('🌳 Árvores de Habilidade', treesHtml) +
            section('🎒 Itens', itemsHtml) +
            section('🧑 Aparência/Raça', appearanceHtml) +
            section('🌍 Progressão de Mundo', worldHtml);

        // --- Wiring ---
        document.getElementById('debug-apply-stats').onclick = () => {
            const patch = {};
            statKeys.forEach(k => { patch[k] = Number(document.getElementById(`debug-stat-${k}`).value) || 0; });
            window.DebugMode.setBaseStats(p, patch);
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        document.getElementById('debug-apply-progression').onclick = () => {
            window.DebugMode.setLevel(p, Number(document.getElementById('debug-level').value));
            window.DebugMode.setProgression(p, {
                exp: Number(document.getElementById('debug-exp').value),
                statPoints: Number(document.getElementById('debug-statpoints').value),
                skillPoints: Number(document.getElementById('debug-skillpoints').value),
            });
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        container.querySelectorAll('.debug-set-lineage').forEach(btn => {
            btn.onclick = () => {
                window.DebugMode.setLineage(p, btn.dataset.lineage);
                window.SaveManager.save(window.Engine.state);
                this.openDebugPanel();
            };
        });
        document.getElementById('debug-clear-lineage').onclick = () => {
            window.DebugMode.clearLineage(p);
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        document.getElementById('debug-set-nature').onclick = () => {
            window.DebugMode.setSecondaryLineage(p, 'natureza');
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        document.getElementById('debug-clear-nature').onclick = () => {
            window.DebugMode.clearSecondaryLineage(p);
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        container.querySelectorAll('.debug-unlock-tree').forEach(btn => {
            btn.onclick = () => {
                const count = window.DebugMode.unlockAllNodes(p, btn.dataset.tree);
                window.SaveManager.save(window.Engine.state);
                if (window.MainMenu) window.MainMenu.showToast(`${count} nós desbloqueados em ${btn.dataset.tree}.`, count > 0 ? 'success' : 'info');
                this.openDebugPanel();
            };
        });

        // Itens: repopula o select de template sempre que tipo/categoria mudam.
        const kindSelect = document.getElementById('debug-item-kind');
        const categorySelect = document.getElementById('debug-item-category');
        const categoryWrap = document.getElementById('debug-item-category-wrap');
        const rarityWrap = document.getElementById('debug-item-rarity-wrap');
        const templateSelect = document.getElementById('debug-item-template');
        const refreshTemplateOptions = () => {
            const kind = kindSelect.value;
            const isEquipment = kind === 'equipment';
            categoryWrap.style.display = isEquipment ? '' : 'none';
            rarityWrap.style.display = isEquipment ? '' : 'none';
            const dbKey = isEquipment ? categorySelect.value : (kind === 'consumable' ? 'consumables' : (kind === 'material' ? 'materials' : (kind === 'essence' ? 'essences' : 'runes')));
            const templates = ItemDatabase[dbKey] || {};
            templateSelect.innerHTML = Object.keys(templates).map(key => `<option value="${key}">${templates[key].name}</option>`).join('');
        };
        kindSelect.onchange = refreshTemplateOptions;
        categorySelect.onchange = refreshTemplateOptions;
        refreshTemplateOptions();

        document.getElementById('debug-add-item').onclick = () => {
            const kind = kindSelect.value;
            const category = categorySelect.value;
            const templateId = templateSelect.value;
            const rarityId = document.getElementById('debug-item-rarity').value;
            const item = window.DebugMode.giveItem(p, kind, category, templateId, rarityId);
            if (!item) {
                window.AudioManager.playError();
                if (window.MainMenu) window.MainMenu.showToast('Mochila cheia ou item inválido!', 'error');
                return;
            }
            window.SaveManager.save(window.Engine.state);
            if (window.AudioManager) window.AudioManager.playConfirm();
            if (window.MainMenu) window.MainMenu.showToast(`Adicionado: ${item.name}`, 'success');
            this.openDebugPanel();
        };
        document.getElementById('debug-clear-inventory').onclick = () => {
            window.DebugMode.clearInventory(p);
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };

        document.getElementById('debug-apply-race').onclick = () => {
            window.DebugMode.setRace(p, document.getElementById('debug-race').value);
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };
        document.getElementById('debug-apply-visuals').onclick = () => {
            window.DebugMode.setVisuals(p, {
                skinTone: document.getElementById('debug-visual-skin').value,
                eyeColor: document.getElementById('debug-visual-eye').value,
                hairColor: document.getElementById('debug-visual-hair').value,
            });
            window.SaveManager.save(window.Engine.state);
            this.openDebugPanel();
        };

        document.getElementById('debug-max-rep').onclick = () => { window.DebugMode.maxReputation(p); window.SaveManager.save(window.Engine.state); this.openDebugPanel(); };
        document.getElementById('debug-min-rep').onclick = () => { window.DebugMode.minReputation(p); window.SaveManager.save(window.Engine.state); this.openDebugPanel(); };
        document.getElementById('debug-complete-quests').onclick = () => {
            const count = window.DebugMode.completeAllQuests(p);
            window.SaveManager.save(window.Engine.state);
            if (window.MainMenu) window.MainMenu.showToast(`${count} missões completadas.`, 'success');
            this.openDebugPanel();
        };
        document.getElementById('debug-fight-vampire').onclick = () => {
            const boss = window.createBoss('conde_vampiro', p.level);
            if (boss) this.beginBattleWith(boss);
        };
        document.getElementById('debug-fight-angel').onclick = () => {
            const boss = window.createBoss('anjo_guardiao', p.level);
            if (boss) this.beginBattleWith(boss);
        };

        this.showScreen('screen-debug');
    }

    // --- BATALHA ---
    // Auditoria de Combate e Escalonamento (Iteração 4) — Seção 4: esta é
    // a ÚNICA rota de geração de inimigo que continua ligada ao nível do
    // jogador, porque é o botão "Duelo Rápido" da Arena (ver
    // #btn-city-arena-quick em ui.js initEventListeners, chamado SEM
    // argumento — exceção explícita da diretiva). Passa a aceitar um
    // `regionLevel` opcional só pra permitir que OUTROS chamadores (eventos
    // da praça, emboscadas da Estrada — ver city.js _eventDuelist/
    // _eventHunters, ui.js onRoadWorldEncounter/advanceRoad) reaproveitem a
    // mesma função de batalha genérica com um nível vindo da REGIÃO (ver
    // enemy.js getRegionEnemyLevel) em vez do jogador — sem argumento,
    // comportamento 100% idêntico a antes.
    startBattle(regionLevel) {
        const p = window.Engine.state.player;
        const level = (regionLevel !== undefined && regionLevel !== null) ? regionLevel : p.level;
        const enemy = new Enemy(level);
        this.beginBattleWith(enemy);
    }

    // Fase 5 da diretiva de balanceamento (Iteração 4) — achado #9 da
    // auditoria: o jogador nunca sabia a força real do oponente antes de
    // já estar dentro do Duelo Rápido. Gera o oponente ANTES de entrar em
    // combate, mostra nome/nível/Elite/arquétipo/arma principal/ameaça
    // (via BalanceCore.getThreatLevel) e só chama beginBattleWith se o
    // jogador confirmar — "Recuar" simplesmente volta pro Hub, sem
    // nenhuma penalidade (mesmo espírito do botão "Voltar" do próprio
    // menu da Arena). Só o Duelo Rápido usa isso: emboscadas da Estrada e
    // batalhas de missão chamam startBattle()/beginBattleWith direto —
    // o jogador já se comprometeu ao entrar naquela situação, um prompt
    // de "quer lutar?" ali não faria sentido narrativo nenhum.
    previewDuel() {
        const p = window.Engine.state.player;
        const enemy = new Enemy(p.level);
        this._pendingDuelEnemy = enemy;

        const threat = window.BalanceCore.getThreatLevel(p, enemy);
        const weapon = enemy.equipment && enemy.equipment[enemy.activeWeaponSlot];
        const archetype = (enemy.aiStyle && enemy.aiStyle.name) || enemy.personality || 'Desconhecido';
        const lines = [
            `${enemy.name}`,
            `Nível ${enemy.level}${enemy.isElite ? ' · ★ Elite' : ''}`,
            `${archetype}${weapon ? ' · ' + weapon.name : ''}`,
            `Ameaça: ${threat.label}`,
        ];
        // Fase 12 da diretiva de balanceamento (Iteração 8) — achado #13
        // da auditoria original ("dreno de ouro por duelo"): o dreno em
        // si é real e deliberado (ver battle.js endBattle, seção 2 do
        // Sistema de Reputação — perde 8-15,5% do ouro CARREGADO numa
        // derrota, nunca o guardado no Banco), mas o jogador nunca sabia
        // disso ANTES de clicar em Lutar — só descobria depois de já ter
        // perdido. Mesma fórmula EXATA de battle.js `goldLossPercent`
        // (reaproveitando `ReputationSystem._opponentWeight`, nunca uma
        // cópia divergente), só pra exibir o risco com antecedência —
        // não muda nenhum valor de perda real, só a informação disponível
        // antes da decisão (mesmo espírito do aviso de ameaça já exibido
        // aqui desde a Iteração 4, e do telegraph de golpe finalizador da
        // Iteração 7). Omitido quando o jogador não carrega ouro nenhum
        // (nada a arriscar, nada a avisar).
        if (p.gold > 0 && window.ReputationSystem) {
            const weight = window.ReputationSystem._opponentWeight(enemy);
            const goldLossPercent = 0.08 + weight * 0.015;
            const goldAtRisk = Math.min(p.gold, Math.round(p.gold * goldLossPercent));
            lines.push(`Risco: -${goldAtRisk}g se perder`);
        }
        document.getElementById('duel-threat-text').innerText = lines.join('\n');
        document.getElementById('duel-threat-preview').classList.remove('hidden');

        document.getElementById('btn-duel-confirm').onclick = () => {
            document.getElementById('duel-threat-preview').classList.add('hidden');
            this.beginBattleWith(this._pendingDuelEnemy);
            this._pendingDuelEnemy = null;
        };
        document.getElementById('btn-duel-decline').onclick = () => {
            document.getElementById('duel-threat-preview').classList.add('hidden');
            this._pendingDuelEnemy = null;
        };
    }

    // Chefe opcional da Estrada (ver roads.js `elite`, item pedido na
    // auditoria de mundo vivo: "chefes opcionais" durante a exploração).
    // Auditoria de Combate e Escalonamento (Iteração 4) — Seção 3: antes
    // era sempre `p.level + 3` (escalava com o JOGADOR); agora usa a
    // metade superior da faixa de nível da REGIÃO de destino da viagem
    // (ver enemy.js getRegionEnemyLevel, biasHigh=true — "chefe opcional"
    // continua mais forte que um bandido comum da MESMA região, só que
    // agora relativo ao mundo, não ao jogador). Sem viagem ativa (chamado
    // fora de contexto de Estrada), cai pra cidade atual.
    startEliteRoadBattle() {
        const p = window.Engine.state.player;
        const journey = p.roadWorldJourney || p.roadJourney;
        const toId = (journey && journey.toId) || (window.getCurrentCityId ? window.getCurrentCityId() : null);
        const level = window.getRegionEnemyLevel ? window.getRegionEnemyLevel(toId, true) : p.level + 3;
        const enemy = new Enemy(level);
        this.beginBattleWith(enemy);
    }

    // Encontro da Floresta Ancestral (ver nature.js/roads.js) — mesmo
    // inimigo procedural de uma emboscada comum da Estrada, só que força o
    // cenário `floresta_ancestral` (ver graphics.js ARENA_BIOMES: névoa
    // verde, vaga-lumes) em vez do bioma normal da cidade atual — a mata
    // sagrada é neutra, nunca pertence a nenhuma Cidade-Hub, então NUNCA
    // consulta CityDatabase/getRegionEnemyLevel (não haveria cidade pra
    // consultar) — usa uma faixa fixa própria, independente do nível do
    // jogador.
    //
    // Correção (pedido direto do usuário): esta faixa fixa era 15-30 (~+2
    // de jitter automático do construtor de Enemy, ver enemy.js "this.level
    // = playerLevel + Utils.randomInt(0, 2)" — o parâmetro é sempre uma
    // BASE, nunca o nível final exato). Essa era exatamente a luta que
    // concede o Amuleto da Natureza (ver nature.js grantGuardianAmulet,
    // chamada por _resolveNatureDiscoveryVictory ao vencer aqui) — mas a
    // Floresta Ancestral é conteúdo INICIAL desta progressão (a primeira
    // floresta explorável, não uma área de mid/end game), e o Amuleto
    // precisa ser obtível por volta do nível 6. Faixa 15-30 tornava esse
    // "primeiro chefe" da progressão dramaticamente mais forte que o
    // esperado pra quem o encontra cedo. Nova faixa 6-9 (+jitter automático
    // → nível final efetivo ~6-11): ainda um degrau acima de um inimigo
    // comum do mesmo nível (é o "guardião corrompido" da floresta, deveria
    // ser mais duro que um bandido qualquer), mas coerente com um jogador
    // por volta do nível 6, não um personagem de mid/endgame.
    startNatureDiscoveryBattle() {
        const enemy = new Enemy(Utils.randomInt(6, 9));
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
        // Introduções de combate + rivalidades (itens 4 e 24 da mega-diretiva
        // Arena+Estilos) — só Rivais nomeados da Ladder carregam `introLine`/
        // `rivalOf` (ver enemy.js Rival constructor); Vampiro/Fantasma/
        // inimigos procedurais do Duelo Rápido nunca têm esses campos, então
        // este bloco simplesmente não aparece pra eles.
        if (opponent.introLine) {
            log.innerHTML += `<p style="color:var(--color-gold); font-style:italic;">"${opponent.introLine}"</p>`;
        }
        if (opponent.rivalOf && p.rivalsDefeated.includes(opponent.rivalOf)) {
            const rivalDef = this._getAllRivals().find(r => r.id === opponent.rivalOf);
            const rivalName = rivalDef ? rivalDef.name : opponent.rivalOf;
            log.innerHTML += `<p style="color:var(--color-marble-dark); font-style:italic;">${opponent.name} reconhece você: "Você derrotou ${rivalName}. Isso não vai se repetir aqui."</p>`;
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

        // Item 28 da mega-diretiva ("use o espaço lateral em PC, mantenha
        // acessível no mobile") — cada seção registra seu próprio id/label
        // aqui conforme é criada; `_renderLadderNav` (abaixo) usa essa
        // lista pra montar a barra de navegação depois que TODAS as
        // seções já existem no DOM (precisa vir depois pra `scrollIntoView`
        // ter um alvo real).
        const navSections = [];

        // Um rival só está disponível se todos os anteriores da ladder já
        // tiverem sido derrotados (progressão sequencial entre e dentro das ligas)
        const allRivals = this._getAllRivals();

        // Arena dos Campeões (item 9 da mega-diretiva) — o conteúdo de
        // endgame definitivo, então fica no TOPO da tela (antes de
        // qualquer liga), não escondida no fim de uma lista rolável.
        // Desbloqueada só depois de derrotar os 6 Campeões de liga
        // originais (nunca os Desafios — esses são opcionais À PARTE).
        if (window.CHAMPIONS_ARENA_STAGES && window.CHAMPIONS_ARENA_STAGES.length > 0) {
            const championIds = allRivals.filter(r => r.isChampion).map(r => r.id);
            const allChampionsDefeated = championIds.every(id => p.rivalsDefeated.includes(id));

            const arenaDiv = document.createElement('div');
            arenaDiv.className = 'ladder-league';
            arenaDiv.id = 'ladder-section-champions-arena';
            navSections.push({ id: 'ladder-section-champions-arena', label: '🏆 Arena dos Campeões' });
            arenaDiv.innerHTML = `<h3>🏆 Arena dos Campeões</h3>`;
            const arenaGrid = document.createElement('div');
            arenaGrid.className = 'ladder-grid';
            const card = document.createElement('div');
            card.className = `rival-card champion ${!allChampionsDefeated ? 'locked' : ''}`;
            card.innerHTML = `
                <h4>Arena dos Campeões</h4>
                <p>${window.CHAMPIONS_ARENA_STAGES.length} adversários em sequência, sem retorno ao Hub entre eles${allChampionsDefeated ? '' : ' · Requer: derrotar todos os 6 Campeões de liga'}${p.championsArenaCompletions > 0 ? ` · Completada ${p.championsArenaCompletions}x` : ''}</p>
                <p class="rival-status" style="color:${allChampionsDefeated ? 'var(--color-gold)' : '#999'}">${allChampionsDefeated ? 'Disponível' : 'Bloqueado'}</p>
            `;
            // Auditoria de acessibilidade (iteração 9): "Bloqueado"/"Indisponível"
            // usava #666 sobre o fundo escuro dos cards (~#2b241d) — contraste
            // medido ~2.6:1, bem abaixo do mínimo WCAG AA de 4.5:1 pra texto
            // deste tamanho (mesmo problema em .btn-action:disabled, fundo
            // ainda mais escuro). #999 mantém a mesma leitura visual de "cinza
            // apagado/indisponível" só que com contraste real (~5:1+ nos dois
            // fundos) — mesmo #999 usado em TODOS os outros rótulos de status
            // bloqueado da Ladder/Arena dos Campeões, pra consistência.
            if (allChampionsDefeated) {
                card.onclick = () => this.startChampionsArena();
            }
            arenaGrid.appendChild(card);
            arenaDiv.appendChild(arenaGrid);
            container.appendChild(arenaDiv);
        }

        window.RivalDatabase.leagues.forEach(league => {
            const leagueDiv = document.createElement('div');
            leagueDiv.className = 'ladder-league';
            leagueDiv.id = `ladder-section-league-${league.id}`;
            navSections.push({ id: `ladder-section-league-${league.id}`, label: league.name });
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
                    <p class="rival-status" style="color:${isDefeated ? '#1eff00' : (isUnlocked ? 'var(--color-gold)' : '#999')}">
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

        // Bosses Especiais da Arena (item 6 da mega-diretiva) — desafios
        // opcionais ALÉM dos Campeões normais, desbloqueados ao derrotar um
        // Rival específico (ver enemy.js ARENA_BOSS_DEFS.unlocksAfterRival).
        // Seção própria, separada das ligas, pra deixar claro que não fazem
        // parte da progressão sequencial normal da Ladder.
        if (window.ARENA_BOSS_DEFS && Object.keys(window.ARENA_BOSS_DEFS).length > 0) {
            const bossSectionDiv = document.createElement('div');
            bossSectionDiv.className = 'ladder-league';
            bossSectionDiv.id = 'ladder-section-special-bosses';
            navSections.push({ id: 'ladder-section-special-bosses', label: '⚔ Bosses Especiais' });
            bossSectionDiv.innerHTML = `<h3>⚔ Bosses Especiais</h3>`;
            const bossGrid = document.createElement('div');
            bossGrid.className = 'ladder-grid';

            Object.values(window.ARENA_BOSS_DEFS).forEach(bossDef => {
                // Item 7 da mega-diretiva (bosses de Linhagem): um jogador
                // que JÁ possui a MESMA linhagem do boss nunca deve poder
                // enfrentá-lo — regra explícita, aplicada aqui de forma
                // genérica (qualquer boss futuro com `lineage` definido
                // fica sujeito a ela automaticamente, não só Nyxara).
                const sameLineage = !!(bossDef.lineage && p.lineage === bossDef.lineage);
                const isUnlocked = !sameLineage && p.rivalsDefeated.includes(bossDef.unlocksAfterRival);
                const isDefeated = (p.arenaBossesDefeated || []).includes(bossDef.id);
                const prereqRival = allRivals.find(r => r.id === bossDef.unlocksAfterRival);

                let statusLabel, statusColor, subtitle;
                if (isDefeated) { statusLabel = 'Derrotado'; statusColor = '#1eff00'; subtitle = bossDef.title; }
                else if (sameLineage) { statusLabel = 'Indisponível'; statusColor = '#999'; subtitle = `${bossDef.title} · Vocês compartilham a mesma linhagem`; }
                else if (isUnlocked) { statusLabel = 'Disponível'; statusColor = 'var(--color-gold)'; subtitle = bossDef.title; }
                else { statusLabel = 'Bloqueado'; statusColor = '#999'; subtitle = `${bossDef.title} · Requer: derrotar ${prereqRival ? prereqRival.name : bossDef.unlocksAfterRival}`; }

                const card = document.createElement('div');
                card.className = `rival-card champion ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${bossDef.name}</h4>
                    <p>${subtitle}</p>
                    <p class="rival-status" style="color:${statusColor}">${statusLabel}</p>
                `;
                if (isUnlocked) {
                    card.onclick = () => {
                        const boss = window.createArenaBoss(bossDef.id, p.level);
                        this.beginBattleWith(boss);
                    };
                }
                bossGrid.appendChild(card);
            });

            bossSectionDiv.appendChild(bossGrid);
            container.appendChild(bossSectionDiv);
        }

        // Desafios de Campeão (item 8 da mega-diretiva) — versões hard mode
        // opcionais dos Campeões de liga, desbloqueadas ao derrotar o
        // Campeão original (ver enemy.js CHAMPION_CHALLENGES.challengeOf).
        // Reaproveita a classe Rival normal (o próprio sistema de fases já
        // existente entrega "comportamento diferente + habilidade extra" —
        // nenhuma IA nova é necessária aqui).
        if (window.CHAMPION_CHALLENGES && window.CHAMPION_CHALLENGES.length > 0) {
            const challengeSectionDiv = document.createElement('div');
            challengeSectionDiv.className = 'ladder-league';
            challengeSectionDiv.id = 'ladder-section-challenges';
            navSections.push({ id: 'ladder-section-challenges', label: '🔁 Desafios de Campeão' });
            challengeSectionDiv.innerHTML = `<h3>🔁 Desafios de Campeão</h3>`;
            const challengeGrid = document.createElement('div');
            challengeGrid.className = 'ladder-grid';

            window.CHAMPION_CHALLENGES.forEach(challengeDef => {
                const isUnlocked = p.rivalsDefeated.includes(challengeDef.challengeOf);
                const isDefeated = p.rivalsDefeated.includes(challengeDef.id);
                const originalChampion = allRivals.find(r => r.id === challengeDef.challengeOf);

                const card = document.createElement('div');
                card.className = `rival-card champion ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${challengeDef.name}</h4>
                    <p>Nível ${challengeDef.level} · ${challengeDef.title}${isUnlocked ? '' : ` · Requer: derrotar ${originalChampion ? originalChampion.name : challengeDef.challengeOf}`}</p>
                    <p class="rival-status" style="color:${isDefeated ? '#1eff00' : (isUnlocked ? 'var(--color-gold)' : '#999')}">
                        ${isDefeated ? 'Derrotado' : (isUnlocked ? 'Disponível' : 'Bloqueado')}
                    </p>
                `;
                if (isUnlocked) {
                    card.onclick = () => {
                        const rival = new Rival(challengeDef);
                        this.beginBattleWith(rival);
                    };
                }
                challengeGrid.appendChild(card);
            });

            challengeSectionDiv.appendChild(challengeGrid);
            container.appendChild(challengeSectionDiv);
        }

        this._renderLadderNav(navSections);
        this.showScreen('screen-ladder');
        // rAF pelo mesmo motivo do aviso vertical genérico em showScreen():
        // scrollWidth real só existe depois que a tela ativa aplica layout.
        requestAnimationFrame(() => this._attachLadderNavScrollHint(document.getElementById('ladder-nav')));
    }

    // Auditoria mobile (iteração 6): a faixa de chips de liga (.ladder-nav)
    // já era deliberadamente rolável na horizontal em telas estreitas (ver
    // comentário de .ladder-panel em style.css), mas sem nenhum indício
    // visual — a última liga simplesmente cortava na borda do painel,
    // como se a lista tivesse acabado ali (achado real via captura em
    // viewport 390px: "Liga de Bronze" cortada, "Liga de Prata" invisível
    // logo depois). Mesmo padrão do .scroll-hint vertical (iterações 3/4),
    // só que no eixo horizontal e restrito a este único elemento — no
    // layout desktop (>=900px) .ladder-nav vira coluna vertical sem
    // overflow-x, então o aviso nunca é relevante lá (guardado também via
    // CSS, ver .ladder-nav-hint na media query).
    _attachLadderNavScrollHint(nav) {
        if (!nav || window.innerWidth >= 900) return;
        const scrollable = nav.scrollWidth > nav.clientWidth + 4;
        let hint = nav.querySelector(':scope > .ladder-nav-hint');
        if (!scrollable) {
            if (hint) hint.classList.add('hidden');
            return;
        }
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'ladder-nav-hint';
            hint.setAttribute('aria-hidden', 'true');
            hint.textContent = '→';
            nav.appendChild(hint);
            nav.addEventListener('scroll', () => this._attachLadderNavScrollHint(nav));
        }
        const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4;
        hint.classList.toggle('hidden', atEnd);
    }

    // Item 28 da mega-diretiva ("use o espaço lateral em PC, mantenha
    // acessível no mobile") — monta a barra de navegação da Ladder a
    // partir das seções já registradas por openLadder() acima. Cada item
    // rola `#ladder-container` até a seção correspondente (nunca duplica
    // nenhuma lógica de card — só navegação). `scrollIntoView` encontra
    // sozinho o ancestral rolável certo (`.ladder-panel`, ver
    // css/style.css), então funciona igual em desktop (barra lateral fixa)
    // e mobile (faixa de chips horizontal), sem nenhum código condicional
    // por tamanho de tela — só CSS decide a apresentação.
    _renderLadderNav(navSections) {
        const nav = document.getElementById('ladder-nav');
        if (!nav) return;
        nav.innerHTML = '';
        navSections.forEach(section => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'ladder-nav-item';
            item.textContent = section.label;
            item.onclick = () => {
                const target = document.getElementById(section.id);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            nav.appendChild(item);
        });
    }

    // Constrói o oponente de uma etapa da Arena dos Campeões a partir do
    // `type` da def (ver enemy.js CHAMPIONS_ARENA_STAGES) — cada tipo sabe
    // instanciar sua própria fonte, então esta função nunca precisa saber
    // detalhes de Rival/boss além de qual construtor chamar.
    _buildChampionsArenaOpponent(stageDef, playerLevel) {
        if (stageDef.type === 'rival') {
            const league = window.RivalDatabase.leagues.find(l => l.id === stageDef.sourceLeague);
            const rivalDef = league && league.rivals.find(r => r.id === stageDef.sourceId);
            return rivalDef ? new Rival(rivalDef) : null;
        }
        if (stageDef.type === 'custom') {
            return new Rival(stageDef.def);
        }
        if (stageDef.type === 'arenaBoss') {
            return window.createArenaBoss(stageDef.sourceId, playerLevel);
        }
        return null;
    }

    // Inicia a Arena dos Campeões do zero — só chamado pelo card já
    // validado como desbloqueado (ver openLadder), mas confere de novo
    // aqui por segurança (nunca confiar só na UI).
    startChampionsArena() {
        const p = window.Engine.state.player;
        const allRivals = this._getAllRivals();
        const championIds = allRivals.filter(r => r.isChampion).map(r => r.id);
        if (!championIds.every(id => p.rivalsDefeated.includes(id))) return;

        p.championsArenaRun = { stageIndex: 0 };
        window.SaveManager.save(window.Engine.state);
        this._beginChampionsArenaStage(0);
    }

    // Constrói e inicia o combate da etapa `index` da corrida em andamento.
    _beginChampionsArenaStage(index) {
        const p = window.Engine.state.player;
        const stageDef = window.CHAMPIONS_ARENA_STAGES[index];
        const opponent = this._buildChampionsArenaOpponent(stageDef, p.level);
        if (!opponent) { p.championsArenaRun = null; this.showScreen('screen-hub'); return; }
        if (window.MainMenu) window.MainMenu.showToast(`Arena dos Campeões — Etapa ${index + 1}/${window.CHAMPIONS_ARENA_STAGES.length}`, 'info');
        this.beginBattleWith(opponent);
    }

    // Chamado pelo botão de retorno (ver initEventListeners btn-return-hub)
    // após uma vitória com `championsArenaRun` ativo — avança pra próxima
    // etapa ou, se essa era a última, encerra a corrida com uma recompensa
    // extra e o contador de conclusões atualizado.
    //
    // Cura parcial entre etapas (30% de HP/MP máximos, nunca cura total):
    // representa um breve respiro entre combates da mesma sequência sem
    // eliminar o desgaste acumulado — a Arena dos Campeões é pensada pra
    // testar resistência ao longo de várias lutas, não só uma de cada vez.
    _advanceChampionsArena() {
        const p = window.Engine.state.player;
        const run = p.championsArenaRun;
        if (!run) { this.showScreen('screen-hub'); return; }

        run.stageIndex++;
        if (run.stageIndex >= window.CHAMPIONS_ARENA_STAGES.length) {
            p.championsArenaRun = null;
            p.championsArenaCompletions = (p.championsArenaCompletions || 0) + 1;
            // Item 23 da mega-diretiva: a recompensa de conclusão agora é
            // sempre a Coroa dos Campeões (item exclusivo, ver items.js
            // `arenaExclusive`) em vez de um Lendário aleatório qualquer —
            // um troféu com identidade própria pra quem terminou o
            // gauntlet inteiro, não mais um item genérico igual ao de
            // qualquer outro loot do jogo.
            const bonusLoot = window.ItemFactory.createEquipment('crownofchampions', 'trinkets', RARITY.LEGENDARY);
            const bonusGold = 300 + p.level * 15;
            p.gold += bonusGold;
            if (p.inventory.length < p.inventoryCapacity) {
                p.inventory.push(bonusLoot);
            }
            window.SaveManager.save(window.Engine.state);
            if (window.MainMenu) window.MainMenu.showToast(`Arena dos Campeões completa! +${bonusGold} de ouro e ${bonusLoot.name}.`, 'success');
            this.showScreen('screen-hub');
            return;
        }

        p.currentHp = Utils.clamp(p.currentHp + Math.floor(p.derivedStats.maxHp * 0.3), 0, p.derivedStats.maxHp);
        p.currentMp = Utils.clamp(p.currentMp + Math.floor(p.derivedStats.maxMp * 0.3), 0, p.derivedStats.maxMp);
        window.SaveManager.save(window.Engine.state);
        this._beginChampionsArenaStage(run.stageIndex);
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

        // Barra de Fúria (item 6 da mega-diretiva: mecânica de boss precisa
        // ser LEGÍVEL) — só aparece contra bosses com `furyPerHit` definido
        // (ver enemy.js ARENA_BOSS_DEFS); qualquer outro combatente nunca
        // tem esse campo, então o container continua escondido como sempre.
        const furyContainer = document.getElementById('enemy-fury-container');
        const furyText = document.getElementById('enemy-fury-text');
        if (b.enemy.furyPerHit) {
            const furyPercent = Math.min(100, ((b.enemy.furyStacks || 0) / (b.enemy.furyMax || 100)) * 100);
            document.getElementById('enemy-fury-bar').style.width = `${furyPercent}%`;
            document.getElementById('enemy-fury-bar').classList.toggle('maxed', furyPercent >= 100);
            furyText.innerText = `Fúria: ${Math.floor(furyPercent)}%`;
            furyContainer.classList.remove('hidden');
            furyText.classList.remove('hidden');
        } else {
            furyContainer.classList.add('hidden');
            furyText.classList.add('hidden');
        }

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
            // Item de auditoria visual: sangramento/veneno/queimadura
            // dividem os mesmos bleedTurns/bleedDamage, mas antes SEMPRE
            // mostravam o mesmo ícone 🩸 vermelho — confundindo, por
            // exemplo, Veneno com Sangramento. dotType (ver battle.js) diz
            // qual efeito é de verdade; DOT_VISUALS (enchantments.js) dá a
            // cada um seu próprio ícone e cor.
            const visuals = (window.DOT_VISUALS && window.DOT_VISUALS[state.dotType]) || window.DOT_VISUALS.sangramento;
            icons.push(`<span class="status-icon" style="color:${visuals.color}" title="Dano contínuo (${visuals.label}): ${state.bleedDamage} de dano por ${state.bleedTurns} turno(s)">${visuals.icon}${state.bleedTurns}</span>`);
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

            // Estilo de Combate incompatível (item 19 da diretiva Arena +
            // Estilos) — segunda camada do mesmo bloqueio de battle.js
            // executePlayerTurn (nunca confia só na UI, mesmo padrão já
            // usado pra Bandagens fora de combate/outOfCombatOnly).
            const styleOk = !skill.isStyleSkill || window.CombatStyleSystem.isStyleCompatible(p, skill.styleId);

            const canCast = hasMana && !onCooldown && inRange && styleOk;
            if (!canCast) btn.disabled = true;

            let statusLabel = `${skill.mpCost} MP`;
            let statusColor = '#3388ff';
            if (onCooldown) { statusLabel = `Recarregando (${p.skillCooldowns[skillId]})`; statusColor = '#888'; }
            else if (!hasMana) { statusColor = '#888'; }
            else if (!inRange) { statusLabel = 'Fora de alcance'; statusColor = '#ff5555'; }
            else if (!styleOk) { statusLabel = 'Estilo inativo'; statusColor = '#ff5555'; }

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

        // Rework da Taverna item 4: bandagens (`outOfCombatOnly`) nunca
        // aparecem como opção durante a batalha — nem chegam a ser
        // clicáveis, então o jogador nunca vê um item que seria recusado
        // ao usar (a segunda camada de proteção real fica em
        // Player.useConsumable, ver player.js).
        const consumableIndexes = [];
        p.inventory.forEach((item, idx) => { if (item.category === 'consumable' && !item.outOfCombatOnly) consumableIndexes.push(idx); });

        if (consumableIndexes.length === 0) {
            this.appendBattleLog("Você não possui itens consumíveis utilizáveis em combate!");
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

    showBattleResults(isVictory, exp, gold, leveledUp, loot = null, newAchievements = [], reputationDelta = 0) {
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

        // Reputação (ver reputation.js) — só aparece quando a luta REALMENTE
        // moveu o número (duelos comuns não dão nem tiram reputação, ver
        // ReputationSystem._opponentWeight), pra nunca virar um "+0
        // Reputação" repetitivo e sem sentido em toda batalha (pedido
        // explícito: "não exibir mensagens desnecessárias a todo momento").
        const repRow = document.getElementById('result-reputation-row');
        const repValueEl = document.getElementById('result-reputation');
        if (reputationDelta !== 0) {
            repRow.classList.remove('hidden');
            repValueEl.innerText = `${reputationDelta >= 0 ? '+' : ''}${reputationDelta}`;
            repValueEl.style.color = reputationDelta >= 0 ? 'var(--color-gold)' : '#e04040';
        } else {
            repRow.classList.add('hidden');
        }

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
            // `gold` já chega NEGATIVO (ver battle.js endBattle DEFEAT: perda
            // econômica real por derrota, seção 2 do sistema de Reputação —
            // nunca mais um "0" fixo escondendo a penalidade de verdade).
            const goldEl = document.getElementById('result-gold');
            goldEl.innerText = `${gold}`;
            goldEl.style.color = gold < 0 ? '#e04040' : '';
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

        // Rework Econômico item 10 (achado da Iteração 3): Encantamentos
        // eram acessíveis de qualquer cidade pelo MESMO preço — nenhum
        // motivo real pra visitar o Santuário Élfico especificamente.
        // Desconto real de 20% aqui (só no custo de encantar, nunca no
        // preço de itens/consumíveis — sistemas independentes) dá esse
        // motivo, junto com o encantamento Arcano exclusivo (ver
        // enchantments.js `region`, já filtrado automaticamente por
        // `validIds` abaixo via EnchantmentSystem.canApply).
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const enchantDiscount = cityId === 'santuario_elfico' ? 0.20 : 0;

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
            const enchantPrice = Math.max(1, Math.round(preview.cost * (1 - enchantDiscount)));
            const enchantPriceLabel = enchantDiscount > 0 ? `Aplicar (<s style="opacity:0.6">${preview.cost}</s> ${enchantPrice}g 🏷️)` : `Aplicar (${enchantPrice}g)`;

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
                <button class="btn-small btn-enchant-apply">${enchantPriceLabel}</button>
            `;

            row.querySelector('.btn-enchant-cycle').addEventListener('click', () => {
                this._enchantCycle[cycleKey] = (this._enchantCycle[cycleKey] + 1) % validIds.length;
                this.renderEnchantments();
            });
            row.querySelector('.btn-enchant-apply').addEventListener('click', () => {
                if (p.gold < enchantPrice) {
                    window.AudioManager.playError();
                    return;
                }
                p.gold -= enchantPrice;
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
    // ==========================================================================
    // ESTILOS DE COMBATE (Mega Atualização Arena + Estilos) — ver
    // combatstyles.js CombatStyleSystem. Sistema TOTALMENTE separado de
    // Linhagem/Mutações (nunca reaproveita player.lineage/skillTreeUnlocked/
    // mutationSkillPoints), mas reaproveita o MESMO layout visual de árvore
    // em tiers (_renderStyleTreeInto abaixo é uma cópia enxuta de
    // _renderSkillTreeInto só pra não acoplar os dois motores).
    // ==========================================================================
    openCombatStyles() {
        const p = window.Engine.state.player;
        this._combatStylesDetailId = null;
        document.getElementById('combatstyles-detail').classList.add('hidden');
        document.getElementById('combatstyles-list').classList.remove('hidden');
        this._renderCombatStylesList();
        this.showScreen('screen-combatstyles');
    }

    _renderCombatStylesList() {
        const p = window.Engine.state.player;
        const container = document.getElementById('combatstyles-list');
        container.innerHTML = '';
        const currentCityId = window.getCurrentCityId ? window.getCurrentCityId() : null;

        Object.values(window.COMBAT_STYLES).forEach(style => {
            const learned = !!(p.combatStylesLearned && p.combatStylesLearned[style.id]);
            const isActive = p.combatStyle === style.id;
            const compatible = learned && window.CombatStyleSystem.isStyleCompatible(p, style.id);
            const card = document.createElement('div');
            card.className = 'skill-card' + (isActive ? ' unlocked' : (learned ? '' : ''));

            let actionHtml;
            if (!learned) {
                const cityOk = currentCityId === style.cityId;
                const cityName = (window.CityDatabase[style.cityId] && window.CityDatabase[style.cityId].name) || style.cityId;
                const isFirstStyle = !p.combatStylesLearned || Object.keys(p.combatStylesLearned).length === 0;
                const learnCost = isFirstStyle ? Math.round(window.CombatStyleSystem.LEARN_COST * window.CombatStyleSystem.FIRST_STYLE_DISCOUNT) : window.CombatStyleSystem.LEARN_COST;
                const discountTag = isFirstStyle ? ' — 1º estilo, -50%' : '';
                actionHtml = cityOk
                    ? `<button class="btn btn-small btn-learn-style" ${p.gold < learnCost ? 'disabled' : ''}>Aprender (${learnCost}g${discountTag})</button>`
                    : `<div class="node-cost">Aprenda em: ${cityName}</div>`;
            } else {
                actionHtml = `
                    <button class="btn btn-small btn-view-style-tree">Ver Árvore</button>
                    ${isActive ? '<div class="node-cost">✅ Ativo</div>' : `<button class="btn btn-small btn-activate-style">Ativar</button>`}
                `;
            }

            card.innerHTML = `
                <h5>${style.icon} ${style.name}</h5>
                <div class="node-type">${learned ? (compatible ? 'Compatível agora' : 'Equipamento incompatível') : 'Não aprendido'}</div>
                <div>${style.tagline}</div>
                <div style="margin-top:8px;">${actionHtml}</div>
            `;

            const learnBtn = card.querySelector('.btn-learn-style');
            if (learnBtn) {
                learnBtn.addEventListener('click', () => {
                    const result = window.CombatStyleSystem.learnStyle(p, style.id);
                    if (result.ok) {
                        window.SaveManager.save(window.Engine.state);
                        if (window.AudioManager) window.AudioManager.playConfirm();
                    } else {
                        if (window.AudioManager) window.AudioManager.playError();
                        if (window.MainMenu) window.MainMenu.showToast(result.reason, 'error');
                    }
                    this._renderCombatStylesList();
                });
            }
            const activateBtn = card.querySelector('.btn-activate-style');
            if (activateBtn) {
                activateBtn.addEventListener('click', () => {
                    p.setActiveCombatStyle(style.id);
                    window.SaveManager.save(window.Engine.state);
                    if (window.AudioManager) window.AudioManager.playConfirm();
                    this._renderCombatStylesList();
                });
            }
            const viewBtn = card.querySelector('.btn-view-style-tree');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => this._openCombatStyleDetail(style.id));
            }
            container.appendChild(card);
        });
    }

    _openCombatStyleDetail(styleId) {
        this._combatStylesDetailId = styleId;
        document.getElementById('combatstyles-list').classList.add('hidden');
        const detail = document.getElementById('combatstyles-detail');
        detail.classList.remove('hidden');
        this._renderCombatStyleDetail();
    }

    _renderCombatStyleDetail() {
        const p = window.Engine.state.player;
        const styleId = this._combatStylesDetailId;
        const style = window.CombatStyleSystem.getStyle(styleId);
        if (!style) return;

        document.getElementById('combatstyles-detail-title').innerText = `${style.icon} ${style.name}`;
        const compatible = window.CombatStyleSystem.isStyleCompatible(p, styleId);
        const statusEl = document.getElementById('combatstyles-detail-status');
        statusEl.innerText = compatible ? 'Equipamento compatível — passivos e habilidades ativos.' : style.incompatibleMessage;
        statusEl.style.color = compatible ? '#33ff66' : '#ff5555';
        document.getElementById('combatstyles-points').innerText = (p.styleSkillPoints && p.styleSkillPoints[styleId]) || 0;

        this._renderStyleTreeInto(p, styleId, document.getElementById('combatstyles-skilltree'));
    }

    // Cópia enxuta de _renderSkillTreeInto (ver comentário acima) pro motor
    // de Estilos — mesma lógica de desenho por tier, mesmo botão Equipar/
    // Desequipar pra nós ativos, só troca SkillTreeSystem por
    // CombatStyleSystem e usa o bucket equippedStyleSkills/limits.style.
    _renderStyleTreeInto(p, styleId, containerEl) {
        containerEl.innerHTML = '';
        const tree = window.CombatStyleSystem.getTreeForDisplay(p, styleId);
        if (!tree) return;
        const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2, style: 2 };
        const tiers = {};
        tree.nodes.forEach(n => { (tiers[n.tier] = tiers[n.tier] || []).push(n); });
        Object.keys(tiers).sort((a, b) => a - b).forEach(tierNum => {
            const tierRow = document.createElement('div');
            tierRow.className = 'skilltree-tier';
            tiers[tierNum].forEach(node => {
                const nodeEl = document.createElement('div');
                nodeEl.className = 'skilltree-node ' + (node.unlocked ? 'unlocked' : (node.unlockable ? 'unlockable' : 'locked'));
                const isActiveUnlocked = node.unlocked && node.type === 'active' && node.skillDef;
                const isEquipped = isActiveUnlocked && p.isSkillEquipped(node.skillDef.id);
                const equipDisabled = isActiveUnlocked && !isEquipped && p.equippedStyleSkills.length >= limits.style;
                nodeEl.innerHTML = `
                    <h5>${node.name}</h5>
                    <div class="node-type">${node.type === 'active' ? 'Ativa' : 'Passiva'}</div>
                    <div>${node.description}</div>
                    <div class="node-cost">Custo: ${node.cost}${node.unlocked ? ' (Desbloqueado)' : ''}</div>
                    ${isActiveUnlocked ? `<button class="btn btn-small btn-equip-style" style="margin-top:8px;" ${equipDisabled ? 'disabled' : ''}>${isEquipped ? 'Desequipar' : 'Equipar'}</button>` : ''}
                `;
                if (isActiveUnlocked) {
                    nodeEl.querySelector('.btn-equip-style').addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        if (isEquipped) p.unequipSkill(node.skillDef.id); else p.equipSkill(node.skillDef.id);
                        window.SaveManager.save(window.Engine.state);
                        this._renderCombatStyleDetail();
                    });
                }
                if (node.unlockable) {
                    nodeEl.addEventListener('click', () => {
                        if (window.CombatStyleSystem.unlockNode(p, styleId, node.id)) {
                            if (node.type === 'active' && node.skillDef) p.equipSkill(node.skillDef.id);
                            window.SaveManager.save(window.Engine.state);
                            if (window.AudioManager) window.AudioManager.playConfirm();
                            this._renderCombatStyleDetail();
                        }
                    });
                }
                tierRow.appendChild(nodeEl);
            });
            containerEl.appendChild(tierRow);
        });
    }

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
        // Resistência a Efeitos Negativos (ver Entity.calculateDerivedStats)
        // — antes só existia internamente pra battle.js consumir (mutação/
        // raça/Sorte contribuem, ver negativeEffectResistPercent), sem
        // NENHUM lugar pro jogador conferir o próprio valor. Mesmo motivo
        // já corrigido pra raça em updateInventoryStats acima: um número
        // que afeta combate de verdade não pode ficar invisível.
        document.getElementById('stat-negresist').innerText = Math.floor(p.derivedStats.negativeEffectResistPercent || 0);
        document.getElementById('stat-fatigue').innerText = p.fatigue || 0;

        // Carga (Força): peso equipado vs. capacidade — fica em vermelho
        // quando sobrecarregado (reduz esquiva, ver Entity.calculateDerivedStats).
        const loadEl = document.getElementById('stat-load');
        loadEl.innerText = p.derivedStats.currentLoad;
        loadEl.style.color = p.derivedStats.isOverloaded ? '#ff4444' : '';
        document.getElementById('stat-load-max').innerText = Math.round(p.derivedStats.carryCapacity);

        // Fase 15 da diretiva de balanceamento (Iteração 15) — sinaliza aqui,
        // no ponto exato onde o jogador troca de equipamento, se o Estilo de
        // Combate ATIVO está realmente compatível com o que está equipado
        // agora. Sem isso, a única forma de descobrir era abrir o menu
        // dedicado de Estilos e reparar no rótulo "Equipamento incompatível"
        // — nada avisava DURANTE a troca, o momento em que a incompatibilidade
        // é criada. Mesmo espírito informacional do risco de ouro da prévia
        // do Duelo Rápido (Iteração 8) e do telegraph de golpe finalizador
        // (Iteração 7): nenhum número de jogo muda, só a informação
        // disponível na hora certa. Só aparece se o jogador já tiver um
        // estilo ativo (a maioria não tem, ver combatstyles.js LEARN_COST) —
        // nunca polui a tela pra quem ainda não usa o sistema.
        const styleStatusEl = document.getElementById('stat-combatstyle');
        if (styleStatusEl) {
            if (p.combatStyle && window.CombatStyleSystem) {
                const style = window.CombatStyleSystem.getStyle(p.combatStyle);
                const compatible = window.CombatStyleSystem.isStyleCompatible(p, p.combatStyle);
                styleStatusEl.classList.remove('hidden');
                styleStatusEl.innerHTML = compatible
                    ? `<span style="color:#7ee787">✓ Estilo ${style.name}: passivas ativas</span>`
                    : `<span style="color:#ff8866">⚠ Estilo ${style.name}: equipamento incompatível — passivas desativadas</span>`;
            } else {
                styleStatusEl.classList.add('hidden');
                styleStatusEl.innerHTML = '';
            }
        }
    }

    renderEquipment() {
        const p = window.Engine.state.player;

        for (let slotKey in p.equipment) {
            const slotEl = document.getElementById(`slot-${slotKey}`);
            const item = p.equipment[slotKey];

            if (item) {
                // Nome abreviado (bug de auditoria visual: cortava nas 3
                // primeiras letras + ".." — "Esp.." pra "Espada Curta",
                // ilegível). `_truncateLabel` corta num limite de
                // caracteres bem maior e sempre numa fronteira de palavra
                // (nunca no meio de uma palavra) — o `.equip-slot` já
                // aceita quebra de linha (sem white-space:nowrap no CSS),
                // então o nome real do item aparece de forma legível, com
                // o tooltip (attachTooltip abaixo) continuando a ser a
                // fonte completa de detalhes. Armas de longo alcance
                // também mostram a munição atual direto no slot, sem
                // precisar abrir o tooltip.
                slotEl.innerText = this._truncateLabel(item.name, 16) + (item.maxAmmo ? ` ${item.ammo}/${item.maxAmmo}` : "");
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
                // Slot vazio — rótulo em português (SLOT_LABELS, items.js),
                // não mais a chave crua do slot ("head"/"offHand"/
                // "mainHand"): bug de auditoria visual, texto em inglês/
                // camelCase no meio de uma UI 100% em português.
                slotEl.innerText = SLOT_LABELS[slotKey] || slotKey;
                slotEl.style.borderColor = '#444';
                slotEl.style.color = '#999';
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
                // Matéria-prima (ver items.js Material) — nunca "equipável"
                // (não tem `.slot`); tratar como equipamento no clique
                // corromperia `p.equipment[undefined]`. Sem função de
                // clique própria ainda (ver js/forge.js, iteração seguinte
                // desta mesma atualização) — só pode ser vendida por ora,
                // igual equipamento, através do botão dedicado abaixo.
                const isMaterial = item.category === 'material';
                // Bug de auditoria (Iteração 9): Essência e Runa (ver
                // items.js Essence/Rune) NUNCA tinham branch próprio aqui
                // — igual Material, nenhuma das duas tem `.slot`, então
                // caíam direto no branch de "equipar" (o `else` abaixo).
                // `p.canEquip(item)` devolve `{ok:true}` pra qualquer
                // categoria != 'equipment' (ver player.js canEquip), então
                // o clique passava, rodava `p.equipment[item.slot] = item`
                // com `item.slot === undefined` — a essência/runa sumia da
                // mochila pra sempre dentro de uma chave órfã
                // `p.equipment[undefined]`, nunca lida em lugar nenhum.
                // Mesmo fix de Material: clique só avisa, nunca "equipa".
                const isEssence = item.category === 'essence';
                const isRune = item.category === 'rune';

                itemSlot.innerText = this._itemIcon(item);
                itemSlot.style.borderColor = isConsumable ? '#33cc99' : (isMaterial ? '#88ccee' : (isEssence ? '#c9a3ff' : (isRune ? '#ffb347' : item.rarity.color)));
                itemSlot.style.color = isConsumable ? '#33cc99' : (isMaterial ? '#88ccee' : (isEssence ? '#c9a3ff' : (isRune ? '#ffb347' : item.rarity.color)));
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
                } else if (isMaterial) {
                    itemSlot.onclick = () => { if (window.MainMenu) window.MainMenu.showToast('Matéria-prima — leve até a Forja pra transformar em equipamento.', 'info'); };
                } else if (isEssence) {
                    itemSlot.onclick = () => { if (window.MainMenu) window.MainMenu.showToast('Essência — leve até o Ateliê Élfico pra criar equipamento ou runas.', 'info'); };
                } else if (isRune) {
                    itemSlot.onclick = () => { if (window.MainMenu) window.MainMenu.showToast('Runa — leve até o Ateliê Élfico pra gravar num equipamento.', 'info'); };
                } else {
                    // Clique equipa o item (substituindo o atual se existir)
                    itemSlot.onclick = () => {
                        // Mega Atualização item 4: "comprar ≠ equipar" — o
                        // bloqueio acontece SÓ aqui (nunca na compra, ver
                        // openShop). Requisitos não atendidos nunca
                        // impedem guardar o item na mochila/banco, só de
                        // vesti-lo agora.
                        const check = p.canEquip(item);
                        if (!check.ok) {
                            window.AudioManager.playError();
                            if (window.MainMenu) window.MainMenu.showToast(`Requisitos não atendidos: ${check.missing.join(', ')}`, 'error');
                            return;
                        }
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

        // Reputação (seção 5 do sistema de Reputação, ver reputation.js) —
        // soma-se aos descontos de fama/Carisma já existentes, nunca os
        // substitui. `shopPriceModifier` já vem no sinal certo (negativo =
        // desconto extra, positivo = sobretaxa), então SUBTRAÍMOS do
        // desconto acumulado: reputação positiva aumenta o desconto,
        // negativa pode empurrar o preço final ACIMA do valor de tabela
        // (por isso o clamp abaixo aceita um piso negativo, diferente do
        // clamp de fama/Carisma logo acima). Nunca impede a compra
        // inteiramente — só encarece.
        if (window.ReputationSystem) {
            discount = Utils.clamp(discount - window.ReputationSystem.shopPriceModifier(p), -0.20, 0.35);
        }

        const promo = window.City && window.City.activePromotion;
        if (promo && shopName && promo.shopName === shopName) {
            discount = Utils.clamp(discount + promo.discountPercent / 100, -0.20, 0.6);
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

    // Roubo (seção 3 do sistema de Reputação, ver reputation.js
    // ReputationSystem.commitTheft) — única ação real de "jogador comete
    // um crime" do jogo: até este ponto, todo "roubo" existente era o
    // jogador sendo a VÍTIMA (city.js _eventThief/_eventNightMugging).
    // Usa `.onclick =` (atribuição, não addEventListener) de propósito —
    // mesmo padrão já usado pelo botão de reparo logo abaixo — porque
    // openShop() roda de novo toda vez que a loja é reaberta; addEventListener
    // empilharia um listener duplicado por visita (bug de auditoria
    // clássico), atribuição sempre SUBSTITUI o handler anterior.
    _bindShopTheft(p) {
        const toggleBtn = document.getElementById('btn-theft-toggle');
        const optionsEl = document.getElementById('shop-theft-options');
        toggleBtn.onclick = () => optionsEl.classList.toggle('hidden');

        optionsEl.querySelectorAll('button[data-severity]').forEach(btn => {
            btn.onclick = () => {
                const severity = btn.dataset.severity;
                const result = window.ReputationSystem.commitTheft(p, severity);
                optionsEl.classList.add('hidden'); // some depois de escolher — ação deliberada, não fica pedindo confirmação de novo
                // Limite diário (ver reputation.js commitTheft/THEFTS_PER_DAY)
                // — sem isto, o painel podia ser reaberto e clicado sem
                // parar, virando ouro efetivamente infinito.
                if (result.blocked) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Os comerciantes da cidade já estão de olho em você hoje — melhor não arriscar de novo.', 'error');
                    return;
                }
                document.getElementById('shop-player-gold').innerText = p.gold;
                this.updateHubStats(); // mantém o HUD (ouro/reputação) já corretos quando o jogador voltar ao Hub
                window.AudioManager.playTone(320, 'sawtooth', 0.15, 0.3);
                if (window.MainMenu) window.MainMenu.showToast(`+${result.gold}g roubados.`, 'success');
            };
        });
    }

    openShop(filterSlots = null, title = 'Mercado', consumablesOnly = false, subShop = null) {
        const p = window.Engine.state.player;
        document.getElementById('shop-player-gold').innerText = p.gold;
        document.getElementById('shop-panel-title').innerText = title;
        document.getElementById('shop-rarity-legend').innerHTML = this._buildRarityLegend();
        this._currentShopFilter = filterSlots;
        this._currentShopTitle = title;
        this._currentShopConsumablesOnly = consumablesOnly;
        // Marca qual sub-loja de consumíveis está aberta (ver
        // renderConsumableShop/ItemFactory.getConsumableStock) — 'tavern'
        // (Poções e Bandagens/Hidromel), 'runes' (Câmara Rúnica) ou null
        // (Mercado geral/Mercador Viajante, sempre pool neutro).
        this._currentShopSubShop = subShop;

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

        this._bindShopTheft(p);

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
                this.openShop(this._currentShopFilter, this._currentShopTitle, this._currentShopConsumablesOnly, this._currentShopSubShop);
            };
        } else {
            repairSection.style.display = 'none';
        }

        // Rework da Taverna item 1: abas só existem na Taverna de verdade
        // (consumablesOnly) — no Mercado geral o Boticário continua sendo
        // uma seção lateral com lista plana, exatamente como antes.
        // Sempre reseta pra "health" ao ABRIR a Taverna (mesmo padrão do
        // Banco: `selectBankTab('gold')` em openBank), nunca preserva a
        // aba da visita anterior.
        document.getElementById('tavern-tabs').classList.toggle('hidden', !consumablesOnly);
        document.getElementById('shop-consumables-title').classList.toggle('hidden', consumablesOnly);
        if (consumablesOnly) this.selectTavernTab('health');
        else this.renderConsumableShop();
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

            // Mega Atualização item 4/18: "comprar ≠ equipar" — a loja
            // SEMPRE deixa comprar (o botão abaixo nunca checa requisito,
            // só ouro/espaço, ver onclick), mas SEMPRE mostra o requisito
            // no próprio card, mesmo quando o jogador não atende — nunca
            // esconde item forte só porque o jogador ainda é fraco.
            const reqCheck = p.canEquip ? p.canEquip(item) : { ok: true };
            const reqBadge = (item.requiredLevel > 1 || item.requiredStats)
                ? `<span style="font-size:0.7rem; color:${reqCheck.ok ? '#88ccee' : '#ff5a5a'};">🔒 Nv.${item.requiredLevel}${item.requiredStats ? ' ' + Object.keys(item.requiredStats).map(k => `${item.requiredStats[k]}${k.toUpperCase()}`).join(' ') : ''}</span>`
                : '';

            card.innerHTML = `
                <div>
                    <h4 style="color: ${item.rarity.color}">${this._itemIcon(item)} ${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${statsText} ${regionBadge}</p>
                    <p style="font-size: 0.7rem;">${reqBadge}</p>
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
                    this.openShop(this._currentShopFilter, this._currentShopTitle, this._currentShopConsumablesOnly, this._currentShopSubShop); // Refresh, mantendo a categoria (Ferreiro/Armeiro)
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

    // Tela da Forja (Reino Anão, ver js/forge.js) — economia baseada em
    // produção (matéria-prima + receita + ouro -> equipamento com
    // qualidade variável), NUNCA uma loja de lista de itens comum. Roda de
    // novo toda vez que a Forja é reaberta (mesmo padrão de openShop), com
    // `.onclick =` em vez de addEventListener nos botões dinâmicos pra
    // nunca acumular listeners duplicados entre reaberturas.
    // Mestres de Treinamento (Fortaleza Orc, ver js/orctraining.js — MEGA
    // REWORK econômico). Substitui o antigo botão de "sub-loja mágica"
    // Orc: em vez de navegar uma lista e pagar ouro, o jogador ACEITA um
    // desafio de um Mestre (fica marcado como ativo) e precisa cumprir a
    // condição na PRÓXIMA luta — battle.js endBattle() confere e concede
    // a recompensa automaticamente (ver OrcTrainingSystem.onBattleVictory),
    // esta tela só mostra estado/permite escolher, nunca resolve o desafio
    // em si (isso só acontece de verdade em combate).
    openOrcTraining() {
        const p = window.Engine.state.player;
        const active = window.OrcTrainingSystem.getActiveChallenge(p);
        const bannerEl = document.getElementById('orctraining-active-banner');
        if (active) {
            bannerEl.classList.remove('hidden');
            bannerEl.innerHTML = `<p style="color:#ffb340">⚔️ Desafio ativo: <strong>${active.name}</strong> — ${active.description}<br>Vença sua próxima luta cumprindo essa condição.</p>`;
        } else {
            bannerEl.classList.add('hidden');
        }

        const container = document.getElementById('orctraining-masters-container');
        container.innerHTML = '';
        window.OrcTrainingSystem.MASTERS.forEach(master => {
            const completed = window.OrcTrainingSystem.isCompleted(p, master.id);
            const unlocked = window.OrcTrainingSystem.isUnlocked(p, master);
            const isActive = active && active.id === master.id;
            const card = document.createElement('div');
            let stateLabel = '';
            if (completed) stateLabel = '<span style="color:#4caf50">✓ Concluído</span>';
            else if (isActive) stateLabel = '<span style="color:#ffb340">Desafio ativo</span>';
            else if (!unlocked) stateLabel = '<span style="color:#888">🔒 Requer todos os outros Mestres</span>';

            card.className = 'forge-recipe-card' + (!unlocked && !completed ? ' forge-recipe-locked' : '');
            card.innerHTML = `
                <h4>${master.icon} ${master.name}</h4>
                <p style="font-size:0.85rem; color:#ccc;">${master.description}</p>
                <p style="font-size:0.8rem; color:#aaa;">Recompensa: +${master.reward} pontos de atributo</p>
                <p>${stateLabel}</p>
                <button class="btn btn-small" ${(completed || isActive || !unlocked) ? 'disabled' : ''}>Aceitar Desafio</button>
            `;
            const btn = card.querySelector('button');
            if (!completed && !isActive && unlocked) {
                btn.onclick = () => {
                    window.OrcTrainingSystem.startChallenge(p, master.id);
                    if (window.AudioManager) window.AudioManager.playConfirm();
                    window.SaveManager.save(window.Engine.state);
                    this.openOrcTraining(); // Refresh (mostra o banner de desafio ativo)
                };
            }
            container.appendChild(card);
        });

        this.showScreen('screen-orctraining');
    }

    // Ateliê Élfico (Santuário Élfico, ver js/elfcrafting.js — MEGA
    // REWORK econômico). Mesma estrutura visual que openForge() (item 18
    // do pedido: "as interfaces podem usar o estilo já existente quando
    // fizer sentido"), mas lendo Essência (não minério) e sem seção de
    // resultado com qualidade variável — cada receita produz uma raridade
    // FIXA sempre (ver comentário em ElfCraftingSystem).
    openElfCrafting() {
        const p = window.Engine.state.player;
        document.getElementById('elfcrafting-player-gold').innerText = p.gold;
        document.getElementById('elfcrafting-result').classList.add('hidden');

        const essenceContainer = document.getElementById('elfcrafting-essence-container');
        essenceContainer.innerHTML = '';
        const counts = {};
        p.inventory.forEach(item => {
            if (item.category !== 'essence') return;
            counts[item.id] = (counts[item.id] || 0) + 1;
        });
        const essenceIds = Object.keys(ItemDatabase.essences);
        if (essenceIds.every(id => !counts[ItemDatabase.essences[id].id])) {
            essenceContainer.innerHTML = '<p style="color:#888; grid-column: 1 / -1;">Nenhuma essência na mochila — colha as nascentes espalhadas pela cidade.</p>';
        } else {
            essenceIds.forEach(templateKey => {
                const template = ItemDatabase.essences[templateKey];
                const have = counts[template.id] || 0;
                if (have <= 0) return;
                const card = document.createElement('div');
                card.className = 'shop-item-card';
                card.innerHTML = `<h4>✨ ${template.name}</h4><p style="font-size:0.8rem; color:#aaa;">Nível ${template.tier} · você tem ${have}</p>`;
                essenceContainer.appendChild(card);
            });
        }

        const recipesContainer = document.getElementById('elfcrafting-recipes-container');
        recipesContainer.innerHTML = '';
        Object.keys(ElfCraftingSystem.RECIPES).forEach(recipeId => {
            const recipe = ElfCraftingSystem.RECIPES[recipeId];
            const affordable = ElfCraftingSystem.canCraft(p, recipeId);
            const essenceText = recipe.essence.map(req => `${req.amount}x ${ItemDatabase.essences[CityEngine.ESSENCE_TIER_ITEM[req.tier]].name}`).join(', ');
            const card = document.createElement('div');
            card.className = 'forge-recipe-card' + (affordable ? '' : ' forge-recipe-locked');
            card.innerHTML = `
                <h4 style="color:${recipe.rarity.color}">${recipe.name}</h4>
                <p style="font-size:0.8rem; color:#aaa;">${essenceText} + ${recipe.goldCost}g</p>
                <p style="font-size:0.75rem; color:${recipe.rarity.color};">${recipe.rarity.name}</p>
                <button class="btn btn-small" ${affordable ? '' : 'disabled'}>Criar</button>
            `;
            card.querySelector('button').onclick = () => {
                const result = ElfCraftingSystem.attemptCraft(p, recipeId);
                if (!result) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Mochila cheia ou componentes insuficientes!', 'error');
                    return;
                }
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                const resultEl = document.getElementById('elfcrafting-result');
                resultEl.classList.remove('hidden');
                resultEl.innerHTML = `
                    <h4 style="color:${result.item.rarity.color}">${result.item.name}</h4>
                    <p>Criado com precisão élfica — ${result.item.rarity.name}</p>
                `;
                this.openElfCrafting(); // Refresh (mochila/ouro/receitas mudaram)
            };
            recipesContainer.appendChild(card);
        });

        // Runas Élficas (Iteração 9, item 7 da diretiva) — mesma estrutura
        // visual das receitas de equipamento acima, mas produz uma Runa
        // (js/elfcrafting.js RUNE_RECIPES/attemptCraftRune), nunca um item
        // de equipamento pronto.
        const runesContainer = document.getElementById('elfcrafting-runes-container');
        runesContainer.innerHTML = '';
        Object.keys(ElfCraftingSystem.RUNE_RECIPES).forEach(recipeId => {
            const recipe = ElfCraftingSystem.RUNE_RECIPES[recipeId];
            const affordable = ElfCraftingSystem.canCraftRune(p, recipeId);
            const essenceText = recipe.essence.map(req => `${req.amount}x ${ItemDatabase.essences[CityEngine.ESSENCE_TIER_ITEM[req.tier]].name}`).join(', ');
            const card = document.createElement('div');
            card.className = 'forge-recipe-card' + (affordable ? '' : ' forge-recipe-locked');
            card.innerHTML = `
                <h4>${recipe.name}</h4>
                <p style="font-size:0.8rem; color:#aaa;">${essenceText} + ${recipe.goldCost}g</p>
                <button class="btn btn-small" ${affordable ? '' : 'disabled'}>Criar</button>
            `;
            card.querySelector('button').onclick = () => {
                const result = ElfCraftingSystem.attemptCraftRune(p, recipeId);
                if (!result) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Mochila cheia ou componentes insuficientes!', 'error');
                    return;
                }
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                const resultEl = document.getElementById('elfcrafting-result');
                resultEl.classList.remove('hidden');
                resultEl.innerHTML = `
                    <h4>${result.item.name}</h4>
                    <p>${result.item.description}</p>
                `;
                this.openElfCrafting(); // Refresh (mochila/ouro/receitas mudaram)
            };
            runesContainer.appendChild(card);
        });

        this.renderRuneApply();
        this.showScreen('screen-elfcrafting');
    }

    // Gravar Runa em Equipamento — mesmo padrão visual/estrutural de
    // renderEnchantments (Mercado Arcano), adaptado: aqui não há "trocar
    // livremente" nem custo em ouro na hora — a Runa já foi PAGA e CRIADA
    // no Ateliê (ver openElfCrafting acima); aplicar só consome a Runa da
    // mochila e grava o bônus permanente (ver js/runes.js RuneSystem).
    renderRuneApply() {
        const p = window.Engine.state.player;
        const container = document.getElementById('elfcrafting-rune-apply-container');
        if (!container) return;
        container.innerHTML = '';

        const runesInBag = [];
        p.inventory.forEach((item, idx) => {
            if (item.category === 'rune') runesInBag.push({ item, idx });
        });
        if (runesInBag.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">Nenhuma runa na mochila — crie uma acima primeiro.</p>';
            return;
        }

        const enchantableSlots = [SLOTS.MAIN_HAND, SLOTS.RANGED, SLOTS.CHEST, SLOTS.HEAD, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET, SLOTS.OFF_HAND];
        enchantableSlots.forEach(slot => {
            const item = p.equipment[slot];
            if (!item) return;
            const validRunes = runesInBag.filter(r => window.RuneSystem.canApply(item, r.item));
            if (validRunes.length === 0) return;

            if (this._runeApplyCycle === undefined) this._runeApplyCycle = {};
            const cycleKey = item.uuid;
            if (this._runeApplyCycle[cycleKey] === undefined) this._runeApplyCycle[cycleKey] = 0;
            const previewEntry = validRunes[this._runeApplyCycle[cycleKey] % validRunes.length];
            const previewRune = previewEntry.item;
            const applied = (item.appliedRunes || []).length;

            const row = document.createElement('div');
            row.className = 'enchant-row';
            row.innerHTML = `
                <span class="enchant-item-name">${item.name}<br><small style="color:#888">Runas gravadas: ${applied}/${window.RuneSystem.MAX_RUNES_PER_ITEM}</small></span>
                <div class="enchant-preview-col">
                    <button class="btn-small btn-rune-cycle" data-preview="${previewRune.name}">${previewRune.name} ▸</button>
                    <small class="enchant-preview-desc" style="color:#ffb347">${previewRune.description}</small>
                </div>
                <button class="btn-small btn-rune-apply">Gravar</button>
            `;
            row.querySelector('.btn-rune-cycle').addEventListener('click', () => {
                this._runeApplyCycle[cycleKey] = (this._runeApplyCycle[cycleKey] + 1) % validRunes.length;
                this.renderRuneApply();
            });
            row.querySelector('.btn-rune-apply').addEventListener('click', () => {
                const success = window.RuneSystem.apply(item, previewRune);
                if (!success) {
                    window.AudioManager.playError();
                    return;
                }
                const bagIdx = p.inventory.indexOf(previewEntry.item);
                if (bagIdx >= 0) p.inventory.splice(bagIdx, 1);
                p.calculateDerivedStats();
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                this.renderRuneApply();
            });
            container.appendChild(row);
        });

        if (container.children.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">Nenhum equipamento compatível com as runas da mochila (ou já no limite de 2 por peça).</p>';
        }
    }

    openForge() {
        const p = window.Engine.state.player;
        document.getElementById('forge-player-gold').innerText = p.gold;
        document.getElementById('forge-result').classList.add('hidden');

        // Matérias-primas na mochila, agrupadas por template (a mochila
        // guarda uma entrada por UNIDADE, ver items.js Material — nunca
        // stackada — então agrupamos só aqui, na exibição, sem mudar como
        // o inventário é guardado em nenhum outro lugar do jogo).
        const materialsContainer = document.getElementById('forge-materials-container');
        materialsContainer.innerHTML = '';
        const counts = {};
        p.inventory.forEach(item => {
            if (item.category !== 'material') return;
            counts[item.id] = (counts[item.id] || 0) + 1;
        });
        const materialIds = Object.keys(ItemDatabase.materials);
        if (materialIds.every(id => !counts[ItemDatabase.materials[id].id])) {
            materialsContainer.innerHTML = '<p style="color:#888; grid-column: 1 / -1;">Nenhuma matéria-prima na mochila — minere os veios espalhados pela cidade.</p>';
        } else {
            materialIds.forEach(templateKey => {
                const template = ItemDatabase.materials[templateKey];
                const have = counts[template.id] || 0;
                if (have <= 0) return;
                const card = document.createElement('div');
                card.className = 'shop-item-card';
                card.innerHTML = `<h4>⛏️ ${template.name}</h4><p style="font-size:0.8rem; color:#aaa;">Nível ${template.tier} · você tem ${have}</p>`;
                materialsContainer.appendChild(card);
            });
        }

        // Receitas — cada uma mostra o custo completo (materiais + ouro) e
        // desabilita o botão quando o jogador não pode pagar, nunca deixa
        // clicar e falhar silenciosamente.
        const recipesContainer = document.getElementById('forge-recipes-container');
        recipesContainer.innerHTML = '';
        Object.keys(ForgeSystem.RECIPES).forEach(recipeId => {
            const recipe = ForgeSystem.RECIPES[recipeId];
            const affordable = ForgeSystem.canAfford(p, recipeId);
            const materialsText = recipe.materials.map(req => `${req.amount}x ${ItemDatabase.materials[req.materialId].name}`).join(', ');
            const card = document.createElement('div');
            card.className = 'forge-recipe-card' + (affordable ? '' : ' forge-recipe-locked');
            card.innerHTML = `
                <h4>${recipe.name}</h4>
                <p style="font-size:0.8rem; color:#aaa;">${materialsText} + ${recipe.goldCost}g</p>
                <button class="btn btn-small" ${affordable ? '' : 'disabled'}>Forjar</button>
            `;
            card.querySelector('button').onclick = () => {
                const result = ForgeSystem.attemptForge(p, recipeId);
                if (!result) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Mochila cheia ou recursos insuficientes!', 'error');
                    return;
                }
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                const resultEl = document.getElementById('forge-result');
                resultEl.classList.remove('hidden');
                resultEl.innerHTML = `
                    <h4 style="color:${result.item.rarity.color}">${result.item.name}</h4>
                    <p>${result.label} — Qualidade ${result.quality}/100</p>
                `;
                this.openForge(); // Refresh (mochila/ouro/receitas mudaram)
            };
            recipesContainer.appendChild(card);
        });

        // Runas Gravadas (Rework Econômico Iteração 4) — mesma estrutura
        // visual das receitas de equipamento acima, mas gastando
        // ForgeSystem.RUNE_RECIPES/attemptForgeRune (produz Consumable, não
        // Equipment — nunca sorteia qualidade). Substitui a antiga "Câmara
        // Rúnica" (loja de lista só por ouro, ver citydatabase.js
        // reino_anao).
        const runesContainer = document.getElementById('forge-runes-container');
        runesContainer.innerHTML = '';
        Object.keys(ForgeSystem.RUNE_RECIPES).forEach(recipeId => {
            const recipe = ForgeSystem.RUNE_RECIPES[recipeId];
            const affordable = ForgeSystem.canAffordRune(p, recipeId);
            const materialsText = recipe.materials.map(req => `${req.amount}x ${ItemDatabase.materials[req.materialId].name}`).join(', ');
            const card = document.createElement('div');
            card.className = 'forge-recipe-card' + (affordable ? '' : ' forge-recipe-locked');
            card.innerHTML = `
                <h4>${recipe.name}</h4>
                <p style="font-size:0.8rem; color:#aaa;">${materialsText} + ${recipe.goldCost}g</p>
                <button class="btn btn-small" ${affordable ? '' : 'disabled'}>Gravar</button>
            `;
            card.querySelector('button').onclick = () => {
                const result = ForgeSystem.attemptForgeRune(p, recipeId);
                if (!result) {
                    window.AudioManager.playError();
                    if (window.MainMenu) window.MainMenu.showToast('Mochila cheia ou recursos insuficientes!', 'error');
                    return;
                }
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                const resultEl = document.getElementById('forge-result');
                resultEl.classList.remove('hidden');
                resultEl.innerHTML = `
                    <h4>${result.item.name}</h4>
                    <p>${result.item.description}</p>
                `;
                this.openForge(); // Refresh (mochila/ouro/receitas mudaram)
            };
            runesContainer.appendChild(card);
        });

        this.showScreen('screen-forge');
    }

    // Tela do Negociante de Minérios (Reino Anão, ver citydatabase.js
    // `hasOreTrader`) — comércio de MATÉRIA-PRIMA, não de equipamento
    // pronto. Venda: `value * 0.6`, MELHOR que os 40% genéricos da mochila
    // comum (ver renderBag) — recompensa trazer material pra cá em vez de
    // vender qualquer coisa no primeiro clique da mochila.
    //
    // Compra — REESCRITA (Rework Econômico item 2): antes vendia TODOS os
    // 5 tiers de material, sem limite de quantidade, a preço fixo (2.5x) —
    // um jogador rico comprava minério raro em massa e forjava
    // repetidamente até sair uma peça excelente, e o ouro deixava de ser
    // um limite real assim que o jogador tinha o suficiente pra comprar em
    // volume. Isso contradiz o propósito central da mineração (item 3 da
    // diretiva: cada tier deve ser genuinamente raro e vir de MINERAR, não
    // de comprar). Agora: só tier 1-2 (Minério Comum/Ferro/Carvão) —
    // materiais "comuns/médio-baixos" — aparecem aqui, com um LIMITE
    // DIÁRIO por material (mesmo padrão dayCount-reset já usado por
    // ReputationSystem.commitTheft/theftsToday) e preço de "recurso de
    // emergência" (4x o valor base, bem acima do 2.5x anterior). Tier 3+
    // (Lingote de Aço/Cristal Mágico/Adamante Anão) NUNCA mais aparece à
    // venda aqui — hoje só existe receita de equipamento consumindo
    // material (ver forge.js RECIPES), nenhuma receita PRODUZ material, e
    // nenhum outro item.js dá esses tiers de outra forma — miná-los nos
    // veios da Praça/Estrada é a ÚNICA fonte real, exatamente como a
    // diretiva pede.
    openOreTrader() {
        const p = window.Engine.state.player;
        document.getElementById('oretrader-player-gold').innerText = p.gold;

        const MAX_PER_MATERIAL_PER_DAY = 3;
        const currentDay = (window.City && window.City.dayCount) || 0;
        if (p.oreTraderDayCount !== currentDay) {
            p.oreTraderDayCount = currentDay;
            p.oreTraderPurchasesToday = {};
        }
        if (!p.oreTraderPurchasesToday) p.oreTraderPurchasesToday = {};

        const buyContainer = document.getElementById('oretrader-buy-container');
        buyContainer.innerHTML = '<p style="color:#888; font-size:0.75rem; grid-column: 1 / -1; margin-bottom:8px;">⚒️ Materiais raros (Lingote de Aço, Cristal Mágico, Adamante Anão) não são vendidos aqui — só minerando os veios da cidade.</p>';
        Object.keys(ItemDatabase.materials).filter(key => ItemDatabase.materials[key].tier <= 2).forEach(templateKey => {
            const template = ItemDatabase.materials[templateKey];
            const price = Math.ceil(template.value * 4);
            const boughtToday = p.oreTraderPurchasesToday[templateKey] || 0;
            const remaining = MAX_PER_MATERIAL_PER_DAY - boughtToday;
            const affordable = remaining > 0 && p.gold >= price && p.inventory.length < p.inventoryCapacity;
            const card = document.createElement('div');
            card.className = 'forge-recipe-card' + (affordable ? '' : ' forge-recipe-locked');
            card.innerHTML = `
                <h4>⛏️ ${template.name}</h4>
                <p style="font-size:0.8rem; color:#aaa;">Nível ${template.tier} · ${price}g · ${remaining > 0 ? `${remaining} restante(s) hoje` : 'limite diário atingido'}</p>
                <button class="btn btn-small" ${affordable ? '' : 'disabled'}>Comprar</button>
            `;
            card.querySelector('button').onclick = () => {
                if (remaining <= 0 || p.gold < price || p.inventory.length >= p.inventoryCapacity) return;
                p.gold -= price;
                p.inventory.push(ItemFactory.createMaterial(templateKey));
                p.oreTraderPurchasesToday[templateKey] = boughtToday + 1;
                window.SaveManager.save(window.Engine.state);
                if (window.AudioManager) window.AudioManager.playConfirm();
                this.openOreTrader(); // Refresh
            };
            buyContainer.appendChild(card);
        });

        const sellContainer = document.getElementById('oretrader-sell-container');
        sellContainer.innerHTML = '';
        const counts = {};
        p.inventory.forEach(item => { if (item.category === 'material') counts[item.id] = (counts[item.id] || 0) + 1; });
        const anyMaterials = Object.keys(ItemDatabase.materials).some(key => counts[ItemDatabase.materials[key].id] > 0);
        if (!anyMaterials) {
            sellContainer.innerHTML = '<p style="color:#888; grid-column: 1 / -1;">Nenhuma matéria-prima pra vender.</p>';
        } else {
            Object.keys(ItemDatabase.materials).forEach(templateKey => {
                const template = ItemDatabase.materials[templateKey];
                const have = counts[template.id] || 0;
                if (have <= 0) return;
                const sellPrice = Math.floor(template.value * 0.6);
                const card = document.createElement('div');
                card.className = 'forge-recipe-card';
                card.innerHTML = `
                    <h4>⛏️ ${template.name}</h4>
                    <p style="font-size:0.8rem; color:#aaa;">você tem ${have} · ${sellPrice}g/un.</p>
                    <button class="btn btn-small">Vender 1</button>
                `;
                card.querySelector('button').onclick = () => {
                    const idx = p.inventory.findIndex(it => it.category === 'material' && it.id === template.id);
                    if (idx < 0) return;
                    p.inventory.splice(idx, 1);
                    p.gold += sellPrice;
                    window.SaveManager.save(window.Engine.state);
                    if (window.AudioManager) window.AudioManager.playTone(700, 'sine', 0.1, 0.4);
                    this.openOreTrader(); // Refresh
                };
                sellContainer.appendChild(card);
            });
        }

        this.showScreen('screen-oretrader');
    }

    // Estoque fixo do Boticário (sempre disponível, não é consumido da lista)
    // Rework da Taverna item 1: troca de aba — mesmo padrão de
    // selectBankTab (toggle de classe `.active` + re-render filtrado),
    // nunca uma tela nova nem uma lógica de abas paralela.
    selectTavernTab(tabId) {
        this._tavernActiveTab = tabId;
        document.getElementById('tavern-tabs').querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.taverntab === tabId);
        });
        this.renderConsumableShop();
    }

    renderConsumableShop() {
        const p = window.Engine.state.player;
        const container = document.getElementById('shop-consumables-container');
        container.innerHTML = '';

        const discount = this._shopDiscount(p, this._currentShopTitle);
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        let stock = ItemFactory.getConsumableStock(cityId, this._currentShopSubShop);
        // Rework da Taverna item 1/3: só filtra por aba quando é a Taverna
        // de verdade (consumablesOnly) — o Boticário do Mercado geral
        // continua mostrando tudo junto, sem filtro, como sempre mostrou.
        if (this._currentShopConsumablesOnly) {
            stock = stock.filter(item => item.consumableCategory === this._tavernActiveTab);
        }

        // Rework da Taverna item 15: Especialidades da Casa só aparecem na
        // Taverna de verdade, e só nas abas Comida/Bebidas (são sempre
        // `consumableCategory` 'food' ou 'drink', nunca poção/bandagem).
        // Renderizadas ANTES do estoque normal, numa seção destacada.
        let specialties = [];
        if (this._currentShopConsumablesOnly && (this._tavernActiveTab === 'food' || this._tavernActiveTab === 'drink') && cityId) {
            specialties = this._getHouseSpecialties(cityId).filter(item => item.consumableCategory === this._tavernActiveTab);
        }

        if (this._currentShopConsumablesOnly && stock.length === 0 && specialties.length === 0) {
            container.innerHTML = '<p class="bank-sub" style="grid-column:1/-1;">Nada disponível nesta categoria, por enquanto.</p>';
            return;
        }

        if (specialties.length > 0) {
            const header = document.createElement('h4');
            header.className = 'house-specialty-header';
            header.innerText = '⭐ Especialidade da Casa';
            header.style.gridColumn = '1/-1';
            container.appendChild(header);
            specialties.forEach(item => container.appendChild(this._buildConsumableCard(item, discount, true)));
        }
        stock.forEach(item => container.appendChild(this._buildConsumableCard(item, discount, false)));
    }

    // Card de consumível compartilhado pelo estoque normal e pelas
    // Especialidades da Casa (ver renderConsumableShop acima) — só muda o
    // estilo visual (`isSpecialty`, borda dourada + brilho, ver
    // css/style.css .house-specialty-card) e o texto do botão. A lógica de
    // compra é IDÊNTICA nos dois casos — nunca um segundo fluxo de compra.
    _buildConsumableCard(item, discount, isSpecialty) {
        const p = window.Engine.state.player;
        const card = document.createElement('div');
        card.className = isSpecialty ? 'shop-item-card house-specialty-card' : 'shop-item-card';
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

        return card;
    }

    // Rework da Taverna item 15: sorteio diário de 1-3 Especialidades da
    // Casa por cidade, com chance de PERSISTÊNCIA (itens de ontem
    // continuam hoje) em vez de reroll total a cada dia — reaproveita o
    // MESMO padrão de cache-por-dia já usado pelo estoque de equipamento
    // (ver openShop `_shopStockCache`), só chaveado por cidade (a Taverna
    // é sempre 1 por cidade, cityId sozinho já é chave única).
    _getHouseSpecialties(cityId) {
        this._houseSpecialtyCache = this._houseSpecialtyCache || {};
        const currentDay = window.City ? window.City.dayCount : 1;
        const cached = this._houseSpecialtyCache[cityId];
        if (cached && cached.day === currentDay) {
            return cached.keys.map(k => ItemFactory.createHouseSpecialty(cityId, k)).filter(Boolean);
        }

        const pool = ItemFactory.getHouseSpecialtyPool(cityId);
        const poolKeys = Object.keys(pool);
        if (poolKeys.length === 0) {
            this._houseSpecialtyCache[cityId] = { day: currentDay, keys: [] };
            return [];
        }

        const previousKeys = cached ? cached.keys : [];
        const targetCount = Utils.randomInt(1, Math.min(3, poolKeys.length));
        const chosenKeys = [];

        // 60% de chance de cada especialidade de ONTEM continuar hoje — dá
        // ao estoque uma sensação natural de ir e vir, nunca 100%
        // aleatório a cada dia (item 15: "o jogador deve ter motivo pra
        // voltar à taverna em dias diferentes", não uma loteria completa).
        previousKeys.forEach(key => {
            if (chosenKeys.length < targetCount && poolKeys.includes(key) && Utils.chance(60)) {
                chosenKeys.push(key);
            }
        });

        const remainingKeys = poolKeys.filter(k => !chosenKeys.includes(k));
        while (chosenKeys.length < targetCount && remainingKeys.length > 0) {
            const weights = {};
            remainingKeys.forEach(k => { weights[k] = pool[k].specialtyWeight || 10; });
            const picked = Utils.weightedPick(weights);
            if (!picked) break;
            chosenKeys.push(picked);
            remainingKeys.splice(remainingKeys.indexOf(picked), 1);
        }

        this._houseSpecialtyCache[cityId] = { day: currentDay, keys: chosenKeys };
        return chosenKeys.map(k => ItemFactory.createHouseSpecialty(cityId, k)).filter(Boolean);
    }

    // --- ÁRVORE DE TALENTOS ---
    openSkillTree() {
        const p = window.Engine.state.player;
        document.getElementById('skill-points').innerText = p.skillPoints || 0;

        // Botão genérico de sub-loja mágica (ver citydatabase.js
        // hasMagicSubShop/magicSubShopLabel) — cada cidade com a flag
        // mostra seu PRÓPRIO rótulo (Fortaleza Orc: Mestres de
        // Treinamento, Iteração 2; Santuário Élfico: Ateliê Élfico,
        // Iteração 3); sem a flag, some por completo — desde a Iteração 4
        // o Reino Anão não tem mais essa flag (a antiga Câmara Rúnica virou
        // Runas Gravadas dentro da própria Forja), então este botão nunca
        // aparece lá. A Árvore de Talentos em si continua idêntica em toda
        // cidade (Rework Econômico item 8: preservar mecânica sem
        // substituto melhor), o botão só ADICIONA uma sub-loja, nunca
        // remove nada.
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const runeShopBtn = document.getElementById('btn-open-rune-shop');
        if (runeShopBtn) {
            const show = !!(cityDef && cityDef.hasMagicSubShop);
            runeShopBtn.classList.toggle('hidden', !show);
            if (show) runeShopBtn.innerText = cityDef.magicSubShopLabel || '🔮 Câmara Rúnica (Runas)';
        }

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
            if (skill.isBossSkill || skill.isMutationSkill || skill.isStyleSkill) continue;
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
        // Rótulo do botão da sub-loja reflete o que ela realmente vende
        // (ver ItemDatabase.consumables/ItemFactory.getConsumableStock) —
        // detecta pela PRÓPRIA presença de itens regionais `subShop:'tavern'`
        // pra esta cidade, em vez de outra flag fixa em citydatabase.js:
        // qualquer cidade futura que ganhe consumíveis próprios de Taverna
        // já muda o rótulo sozinha, sem precisar editar este método de novo.
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const hasRegionalTavern = Object.values(ItemDatabase.consumables).some(t => t.region === cityId && t.subShop === 'tavern');
        const shopBtn = document.getElementById('btn-open-tavern-shop');
        if (shopBtn) shopBtn.innerText = hasRegionalTavern ? '🍖 Hidromel e Comidas' : '🍷 Poções e Bandagens';
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

        // Rework da Taverna item 17: "Dormir de Graça" agora é uma escolha
        // econômica real, SEMPRE visível ao lado da opção paga (nunca só
        // um botão de emergência pra quem já está sem ouro) — "pago pela
        // segurança ou economizo e assumo o risco?". Mesmo padrão
        // toggle-reveal já usado pelo botão Roubar (ver
        // _bindShopTheft/#shop-theft-options): `.onclick =` porque
        // updateHealerScreen roda de novo toda vez que a tela reabre,
        // então isto nunca empilha handlers duplicados.
        this._bindFreeRest(p);
    }

    _bindFreeRest(p) {
        const toggleBtn = document.getElementById('btn-free-rest-toggle');
        const optionsEl = document.getElementById('healer-freerest-options');
        const confirmBtn = document.getElementById('btn-free-rest-confirm');
        const cancelBtn = document.getElementById('btn-free-rest-cancel');
        if (!toggleBtn || !optionsEl || !confirmBtn || !cancelBtn) return;

        toggleBtn.onclick = () => optionsEl.classList.toggle('hidden');
        cancelBtn.onclick = () => optionsEl.classList.add('hidden');
        confirmBtn.onclick = () => {
            optionsEl.classList.add('hidden');
            this.freeRest();
        };
    }

    // Rework da Taverna item 17: dormir de graça deixa de ser um roubo de
    // OURO (isso já existe como evento separado, ver city.js
    // _eventNightMugging/_eventThief) e passa a ser o risco de ser
    // FLAGRADO pelos guardas da Taverna — narrativo, nunca uma batalha de
    // Arena normal (nenhum BattleSystem é criado aqui). A consequência
    // principal é a fadiga ir pro máximo (3/3), não o ouro. A % de chance
    // de ser flagrado é deliberadamente não exibida na UI (só o aviso
    // genérico "pode trazer consequências" no painel de confirmação).
    freeRest() {
        const p = window.Engine.state.player;

        // Dormir de graça continua sendo "dormir de verdade" — mesmo avanço
        // de mundo completo do dormir pago (estoque de loja, juros do
        // Banco, NPCs etc, ver city.js advanceToNewDay), nos dois
        // resultados (flagrado ou não).
        p.nightsWithoutSleep = 0;
        if (window.City && window.City.dayPhases) {
            window.City.dayPhaseIndex = (window.City.dayPhaseIndex + 2) % window.City.dayPhases.length;
            window.City.dayPhaseTimer = 0;
            window.City.advanceToNewDay();
        }

        // Sem ouro nenhum: risco geral maior (nada a perder torna o
        // jogador mais descuidado/visado) — ver auditoria econômica do
        // item 17. 30% base / 45% sem ouro é "significativo mas não
        // garantido", igual pedido.
        const broke = p.gold <= 0;
        const caughtChance = broke ? 45 : 30;
        const caught = Utils.chance(caughtChance);

        let message;
        if (!caught) {
            p.cureFatigue(3); // dormiu bem, sem pagar — mesma cura completa do dormir pago, foi a aposta que compensou
            // Fase 7 da diretiva de balanceamento (Iteração 5): mesmo
            // gratuito, um descanso bem-sucedido também recupera uma
            // fração do HP que falta — bem menor que o dormir pago (20%
            // contra 50%), pra continuar valendo a pena pagar quando o
            // jogador TEM ouro, mas dando uma saída real de uma espiral de
            // derrota mesmo pra quem não tem nada (achado #3 da auditoria).
            const missingHp = p.derivedStats.maxHp - p.currentHp;
            const hpHealed = missingHp > 0 ? Math.floor(missingHp * 0.2) : 0;
            if (hpHealed > 0) p.currentHp = Utils.clamp(p.currentHp + hpHealed, 0, p.derivedStats.maxHp);
            message = 'Você encontrou um canto tranquilo da Taverna e dormiu sem ser incomodado.' + (hpHealed > 0 ? ` Recuperou ${hpHealed} HP.` : '');
            window.AudioManager.playHeal();
        } else {
            p.fatigue = 3;
            p.calculateDerivedStats();
            message = 'Um guarda da Taverna te encontrou dormindo sem pagar e te expulsou aos empurrões! Você mal descansou — a fadiga tomou conta do corpo.';
            window.AudioManager.playError();

            // Só rola furto de ITENS quando o jogador está completamente
            // sem ouro (nada de valor "fácil" pros guardas levarem) — ver
            // _rollFreeRestTheft: nunca toca equipamento VESTIDO (estrutural,
            // p.equipment é separado de p.inventory), nunca leva o
            // inventário inteiro, no máximo 2 peças.
            if (broke) {
                const stolenNames = this._rollFreeRestTheft(p);
                if (stolenNames.length > 0) {
                    message += ` Enquanto revistavam suas coisas, levaram: ${stolenNames.join(', ')}.`;
                }
            }
        }

        window.SaveManager.save(window.Engine.state);
        document.getElementById('healer-message').innerText = message;
        this.updateHealerScreen();
        this.updateHubStats();
    }

    // Furto de itens do "Dormir de Graça" sem ouro nenhum — só mira
    // equipamento NÃO equipado (`p.inventory`, categoria 'equipment':
    // armas/armaduras guardadas; p.equipment, o que está VESTIDO, nunca é
    // tocado aqui, são objetos JS separados). Itens mais valiosos são mais
    // "visados" (chance menor de escapar), mas nunca é garantido, e no
    // máximo 2 peças somem — nunca o inventário inteiro.
    _rollFreeRestTheft(p) {
        const candidates = [];
        p.inventory.forEach((item, idx) => {
            if (item.category === 'equipment') candidates.push({ item, idx });
        });
        if (candidates.length === 0) return [];

        // Fisher-Yates simples só pra não sempre mirar os primeiros slots da mochila.
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const maxStolen = Math.min(2, candidates.length);
        const stolenIndexes = [];
        const stolenNames = [];
        for (const { item, idx } of candidates) {
            if (stolenIndexes.length >= maxStolen) break;
            const takeChance = item.value >= 150 ? 20 : item.value >= 60 ? 30 : 40;
            if (Utils.chance(takeChance)) {
                stolenIndexes.push(idx);
                stolenNames.push(item.name);
            }
        }

        // Remove do maior índice pro menor, pra não invalidar os outros
        // índices já coletados no meio da remoção.
        stolenIndexes.sort((a, b) => b - a).forEach(idx => p.inventory.splice(idx, 1));
        return stolenNames;
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

        // Fase 7 da diretiva de balanceamento (Iteração 5) — achado #3 da
        // auditoria: "descanso" só tratava fadiga, nunca HP, então um
        // personagem sem poção/bandagem não tinha NENHUM jeito de sair de
        // uma espiral de derrota (perde -> HP trava em 10% -> perde de
        // novo). Dormir pago cura metade do HP que falta — nunca 100%
        // grátis (bandagem/poção continuam sendo a cura "de verdade"),
        // mas o suficiente pra realmente quebrar o ciclo.
        const missingHp = p.derivedStats.maxHp - p.currentHp;
        const hpHealed = missingHp > 0 ? Math.floor(missingHp * 0.5) : 0;
        if (hpHealed > 0) p.currentHp = Utils.clamp(p.currentHp + hpHealed, 0, p.derivedStats.maxHp);

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

        const hpNote = hpHealed > 0 ? ` Recuperou ${hpHealed} HP.` : '';
        document.getElementById('healer-message').innerText = (fatigue > 0
            ? 'Você dormiu e descansou. Fadiga totalmente curada!'
            : 'Você dormiu bem. Amanhã será outro dia.') + hpNote;
        this.updateHealerScreen();
        this.updateHubStats();
    }

    // --- BANCO ---
    // Ouro guardado (`bankGold`) fica fora do que o jogador "carrega" (`gold`)
    // — separado só pra dar função ao prédio; nenhuma mecânica existente
    // depende de `gold` incluir o que está no banco.
    //
    // Mega Atualização item 14/15/16/17: duas abas (Dinheiro/Itens, ver
    // index.html bank-tabs) reaproveitando o padrão visual do Guia do Jogo.
    // `this._bankActiveTab` (inicializado no constructor) só controla QUAL
    // conteúdo está visível nesta sessão de UI — não é persistido (sempre
    // abre em "Dinheiro", comportamento idêntico ao Guia, que também
    // sempre abre na primeira aba).
    openBank() {
        this.selectBankTab('gold');
        this.showScreen('screen-bank');
    }

    selectBankTab(tabId) {
        this._bankActiveTab = tabId;
        document.getElementById('bank-tabs').querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.banktab === tabId);
        });
        document.getElementById('bank-tab-gold').classList.toggle('hidden', tabId !== 'gold');
        document.getElementById('bank-tab-items').classList.toggle('hidden', tabId !== 'items');
        if (tabId === 'gold') this.updateBankScreen();
        else this.renderBankItemsTab();
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

    // Item 16: "Depositar Tudo"/"Sacar Tudo" da aba Dinheiro — move o
    // TOTAL respeitando os mesmos limites do fluxo manual acima (aqui só
    // não há limite nenhum a respeitar além de "ter alguma coisa pra
    // mover", já que ouro não tem teto de capacidade como o inventário).
    bankDepositAllGold() {
        const p = window.Engine.state.player;
        if (!p.gold || p.gold <= 0) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Você não tem ouro na mão pra depositar.', 'error'); return; }
        p.bankGold = (p.bankGold || 0) + p.gold;
        const moved = p.gold;
        p.gold = 0;
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.updateBankScreen();
        this.updateHubStats();
        if (window.MainMenu) window.MainMenu.showToast(`Depositado: ${moved}g`, 'success');
    }

    bankWithdrawAllGold() {
        const p = window.Engine.state.player;
        if (!p.bankGold || p.bankGold <= 0) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Você não tem ouro guardado pra sacar.', 'error'); return; }
        const moved = p.bankGold;
        p.gold += p.bankGold;
        p.bankGold = 0;
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.updateBankScreen();
        this.updateHubStats();
        if (window.MainMenu) window.MainMenu.showToast(`Sacado: ${moved}g`, 'success');
    }

    // Item 15: itens elegíveis pra depósito — só EQUIPAMENTO de verdade
    // (arma/armadura/escudo/amuleto, `category === 'equipment'`), nunca
    // consumíveis nem matéria-prima (ver comentário em player.js
    // `bankItems`). `p.bankItems` sem teto de propósito (ver mesmo
    // comentário) — só o INVENTÁRIO tem capacidade limitada, então só a
    // grade da Mochila (esquerda) mostra slots vazios até `inventoryCapacity`;
    // a grade do Banco (direita) só mostra os itens que já estão lá.
    renderBankItemsTab() {
        const p = window.Engine.state.player;
        const invGrid = document.getElementById('bank-inventory-grid');
        const bankGrid = document.getElementById('bank-items-grid');
        const eligibleInv = p.inventory.filter(i => i.category === 'equipment');

        invGrid.innerHTML = '';
        if (eligibleInv.length === 0) {
            invGrid.innerHTML = '<p class="bank-sub" style="grid-column:1/-1;">Nenhum equipamento na mochila pra depositar.</p>';
        } else {
            eligibleInv.forEach(item => invGrid.appendChild(this._buildBankItemSlot(item, 'deposit')));
        }

        bankGrid.innerHTML = '';
        if (p.bankItems.length === 0) {
            bankGrid.innerHTML = '<p class="bank-sub" style="grid-column:1/-1;">Nada guardado ainda.</p>';
        } else {
            p.bankItems.forEach(item => bankGrid.appendChild(this._buildBankItemSlot(item, 'withdraw')));
        }
    }

    // Slot compartilhado pelas duas grades da aba Itens — só muda a ação
    // do badge (📥 depositar / 📤 sacar) e pra qual função ele chama.
    _buildBankItemSlot(item, direction) {
        const slot = document.createElement('div');
        slot.className = 'bag-item';
        slot.innerText = this._itemIcon(item);
        slot.style.borderColor = item.rarity.color;
        slot.style.color = item.rarity.color;
        slot.style.boxShadow = (item.enchantmentId && window.ENCHANTMENTS[item.enchantmentId])
            ? `0 0 8px 2px ${window.ENCHANTMENTS[item.enchantmentId].color}` : '';
        this.attachTooltip(slot, item);

        const actionBtn = document.createElement('div');
        actionBtn.className = 'bag-item-sell';
        if (direction === 'deposit') {
            actionBtn.innerText = '📥';
            actionBtn.title = 'Depositar no Banco';
            actionBtn.onclick = (e) => { e.stopPropagation(); this.bankDepositItem(item.uuid); };
        } else {
            actionBtn.innerText = '📤';
            actionBtn.title = 'Sacar pra Mochila';
            actionBtn.onclick = (e) => { e.stopPropagation(); this.bankWithdrawItem(item.uuid); };
        }
        slot.appendChild(actionBtn);
        return slot;
    }

    // Item 15/17: mover é sempre SPLICE de um array + PUSH no outro — nunca
    // clona/duplica o objeto, então o mesmo item nunca existe nos dois
    // lugares ao mesmo tempo (a checagem de exploit de duplicação do item
    // 22 da diretiva foi justamente procurar por isso).
    bankDepositItem(uuid) {
        const p = window.Engine.state.player;
        const idx = p.inventory.findIndex(i => i.uuid === uuid);
        if (idx === -1) return; // já foi movido por outro clique/tab duplo
        const [item] = p.inventory.splice(idx, 1);
        p.bankItems.push(item);
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.renderBankItemsTab();
    }

    bankWithdrawItem(uuid) {
        const p = window.Engine.state.player;
        if (p.inventory.length >= p.inventoryCapacity) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Mochila cheia — abra espaço antes de sacar.', 'error');
            return;
        }
        const idx = p.bankItems.findIndex(i => i.uuid === uuid);
        if (idx === -1) return;
        const [item] = p.bankItems.splice(idx, 1);
        p.inventory.push(item);
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.renderBankItemsTab();
    }

    // Item 16: "Depositar Tudo" da aba Itens — move TODO equipamento
    // elegível da mochila pro banco de uma vez (nunca toca consumíveis/
    // matéria-prima, que continuam só na mochila).
    bankDepositAllItems() {
        const p = window.Engine.state.player;
        const eligible = p.inventory.filter(i => i.category === 'equipment');
        if (eligible.length === 0) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Nenhum equipamento na mochila pra depositar.', 'error'); return; }
        p.inventory = p.inventory.filter(i => i.category !== 'equipment');
        p.bankItems.push(...eligible);
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.renderBankItemsTab();
        if (window.MainMenu) window.MainMenu.showToast(`${eligible.length} item(ns) depositado(s).`, 'success');
    }

    // Item 16: "Sacar Tudo" da aba Itens — move o que COUBER na mochila e
    // avisa claramente quando não coube tudo (nunca falha silenciosamente
    // nem descarta o que não coube — o restante simplesmente continua no
    // banco, exatamente como antes de clicar).
    bankWithdrawAllItems() {
        const p = window.Engine.state.player;
        if (p.bankItems.length === 0) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Nada guardado no banco pra sacar.', 'error'); return; }
        const freeSlots = p.inventoryCapacity - p.inventory.length;
        if (freeSlots <= 0) { window.AudioManager.playError(); if (window.MainMenu) window.MainMenu.showToast('Mochila cheia — abra espaço antes de sacar.', 'error'); return; }
        const moving = p.bankItems.splice(0, freeSlots);
        p.inventory.push(...moving);
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playConfirm();
        this.renderBankItemsTab();
        const remaining = p.bankItems.length;
        if (remaining > 0) {
            if (window.MainMenu) window.MainMenu.showToast(`${moving.length} item(ns) sacado(s). ${remaining} não coube(ram) — mochila cheia.`, 'info');
        } else {
            if (window.MainMenu) window.MainMenu.showToast(`${moving.length} item(ns) sacado(s).`, 'success');
        }
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
            // Item 18 da revisão profunda: cidade natal por raça (ver
            // RACE_HOME_CITY em citydatabase.js) pode ter unlockLevel > 1
            // (Fortaleza Orc = 3, Santuário Élfico = 6) — sem essa segunda
            // condição, um Orc/Elfo de nível baixo que saísse da própria
            // cidade natal ficaria TRANCADO pra sempre fora dela até subir
            // de nível, mesmo já tendo nascido e vivido lá. Qualquer cidade
            // já visitada (não só a natal) permanece sempre acessível.
            const isLocked = p.level < city.unlockLevel && !(p.visitedCityIds && p.visitedCityIds.includes(city.id));
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
        // Item 18 da revisão profunda: mesma exceção das outras 3 checagens
        // de unlockLevel (city.js travelToCity, roads.js startJourney, e o
        // isLocked logo acima em openCaravan) — cidade já visitada nunca
        // trava de novo.
        if (p.level < dest.unlockLevel && !(p.visitedCityIds && p.visitedCityIds.includes(cityId))) {
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

        // Toca dos Lobos (Expansão de Exploração e Mundo, item 8) — mesmo
        // princípio da Floresta Ancestral acima: toId virtual, nunca existe
        // em CityDatabase, "chegar ao fundo da toca" só devolve o jogador
        // pra Porto Helênico (sempre a cidade natal, ver onEnterWolfDen).
        if (toId === window.WOLF_DEN_ID) {
            window.AudioManager.playConfirm();
            if (window.MainMenu) window.MainMenu.showToast('Você retorna da Toca dos Lobos.', 'info');
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
    // `dangerous` (novo, ver road.js `_miningZones`/`ev.dangerous`) marca um
    // bandido encontrado na zona FUNDA de mineração perto do Reino Anão —
    // usa o MESMO inimigo reforçado de startEliteRoadBattle (chefe opcional
    // da Estrada) em vez do Duelo Rápido genérico, mesma filosofia "risco
    // escala com recompensa" já aplicada aos veios de minério daquela zona.
    // Default `false` preserva o comportamento de sempre pra qualquer outro
    // bandido da Estrada.
    onRoadWorldEncounter(dangerous = false) {
        window.SaveManager.save(window.Engine.state);
        if (dangerous) this.startEliteRoadBattle();
        else {
            // Auditoria de Combate e Escalonamento (Iteração 4) — Seção 3:
            // bandido comum da Estrada NÃO é o Duelo Rápido — antes caía no
            // `startBattle()` sem argumento (escalava com o jogador, mesmo
            // comportamento do botão da Arena por acidente de reaproveitar
            // a função errada). Agora passa o nível da REGIÃO de destino.
            const p = window.Engine.state.player;
            const journey = p.roadWorldJourney;
            const toId = (journey && journey.toId) || (window.getCurrentCityId ? window.getCurrentCityId() : null);
            this.startBattle(window.getRegionEnemyLevel ? window.getRegionEnemyLevel(toId) : undefined);
        }
    }

    // Encontro de lobo dentro da Toca dos Lobos (Expansão de Exploração e
    // Mundo, item 8 — ver js/road.js _generateWolfPack/_updateBandits
    // isWolf). Faixa de nível FIXA (independente de região/cidade, mesmo
    // motivo de startNatureDiscoveryBattle — a Toca não pertence a nenhuma
    // Cidade-Hub) — lobos comuns são uma ameaça real mas superável cedo no
    // jogo; o Alfa é um degrau acima de verdade ("desafio superior ao
    // exterior", pedido explícito), marcando a flag que o botão de retorno
    // da tela de resultados (ver btn-return-hub) usa pra conceder a
    // recompensa da Toca só quando é ELE quem foi derrotado, nunca um
    // lobo comum qualquer.
    onWolfEncounter(isAlpha) {
        window.SaveManager.save(window.Engine.state);
        // Correção crítica (auditoria mestre): `species` faz o lobo entrar
        // em combate como fera de verdade (ver enemy.js Enemy constructor)
        // em vez de herdar a construção humana padrão — sem isso o lobo
        // podia nascer empunhando espada e vestindo armadura.
        //
        // Segundo bug corrigido (pedido direto do usuário): sem
        // `forcedBiome`, beginBattleWith cai no bioma de arena sorteado
        // pela CIDADE atual (Coliseu/arquibancadas) — errado pra um
        // encontro que acontece dentro da Toca dos Lobos, na Floresta. O
        // bioma 'floresta_ancestral' (graphics.js ARENA_BIOMES) já existe
        // pronto — paleta verde-escura, vegetação densa, vaga-lumes, SEM
        // arquibancadas/bandeiras de arena (hasCrowd:false/hasBanners:
        // false) — só nunca tinha sido aplicado aqui. Reaproveita
        // 100% do que já existe, nenhum bioma novo precisou ser criado.
        if (isAlpha) {
            this._pendingWolfDenAlpha = true;
            this.beginBattleWith(new Enemy(Utils.randomInt(9, 13), { species: 'alpha_wolf' }), 'floresta_ancestral');
        } else {
            this.beginBattleWith(new Enemy(Utils.randomInt(3, 6), { species: 'wolf' }), 'floresta_ancestral');
        }
    }

    // Recompensa da Toca dos Lobos — chamada só depois de vencer o Lobo
    // Alfa (ver onWolfEncounter/_pendingWolfDenAlpha). Ouro/XP sempre
    // concedidos (explorar de novo continua valendo a pena); o equipamento
    // único só na PRIMEIRA vez (`p.wolfDenAlphaDefeated`, persistido pelo
    // SaveManager genérico igual qualquer campo novo do Player) — "recompensa
    // significativa mas equilibrada", nunca duplicável salvando/carregando
    // repetidamente contra o mesmo Alfa.
    _grantWolfDenReward(p) {
        const gold = Utils.randomInt(180, 260);
        p.gold += gold;
        p.gainExp(120);
        let msg = `Você derrota o Lobo Alfa! +${gold}g, +120 XP.`;
        if (!p.wolfDenAlphaDefeated) {
            p.wolfDenAlphaDefeated = true;
            const weaponIds = Object.keys(ItemDatabase.weapons);
            const pickId = weaponIds[Utils.randomInt(0, weaponIds.length - 1)];
            const item = window.ItemFactory ? window.ItemFactory.createEquipment(pickId, 'weapons', RARITY.UNCOMMON) : null;
            if (item) {
                p.inventory.push(item);
                msg = `Você derrota o Lobo Alfa! +${gold}g, +120 XP, e encontra ${item.name} entre os ossos do covil.`;
            }
        }
        if (window.MainMenu) window.MainMenu.showToast(msg, 'success');
        window.SaveManager.save(window.Engine.state);
    }

    // Entrada física da Toca dos Lobos (ver js/road.js EVENT_TYPES.wolf_den_entrance,
    // _resolveEvent) — walk-up-and-click num objeto físico da Estrada,
    // nunca um pop-up nem um botão de menu. Sempre reinicia o Mundo da
    // Estrada num mundo curto e temático (ver RoadEngine.start
    // toId===WOLF_DEN_ID) com origem/destino fixos na cidade natal —
    // "localizada em uma área florestal próxima da cidade inicial",
    // voltar sempre é pra lá (ver onRoadWorldArrival), nunca pra travessia
    // real que o jogador estava fazendo quando encontrou a entrada (mesmo
    // princípio já aceito pela Expedição à Floresta Ancestral: entrar
    // num destino virtual sempre abandona a travessia em andamento).
    onEnterWolfDen() {
        if (!window.RoadEngine) return;
        const p = window.Engine.state.player;
        const homeId = window.DEFAULT_CITY_ID;
        p.roadWorldJourney = { fromId: homeId, toId: window.WOLF_DEN_ID, mode: 'walk' };
        window.RoadEngine.start(homeId, window.WOLF_DEN_ID, 'walk', p);
        window.SaveManager.save(window.Engine.state);
        document.getElementById('roadworld-title').innerText = `${window.CityDatabase[homeId].name} → Toca dos Lobos`;
        document.getElementById('roadworld-mode').innerText = 'A pé';
        // Cor de identidade da Toca — vermelho-escuro, nunca a verde padrão
        // de floresta nem a mística da Floresta Ancestral (#4a8a5a) — precisa
        // ser reconhecível como um lugar mais perigoso já pela cor do HUD.
        document.getElementById('screen-roadworld').style.setProperty('--road-accent', '#8a3a2a');
        if (window.AudioManager) window.AudioManager.playConfirm();
        if (window.MainMenu) window.MainMenu.showToast('Você entra na Toca dos Lobos. O ar cheira a mato pisado e algo mais...', 'info');
        // Único ponto de chamada hoje (_resolveEvent do road.js) já roda com
        // screen-roadworld ativa, mas chama showScreen mesmo assim — mesmo
        // padrão defensivo de startForestExpedition/startRoadJourney logo
        // abaixo, pra qualquer futuro atalho direto (ex: um botão no Portão,
        // como a Floresta Ancestral já tem) não cair numa tela errada.
        this.showScreen('screen-roadworld');
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
                else {
                    // Auditoria de Combate e Escalonamento (Iteração 4) —
                    // Seção 3: mesmo ajuste de onRoadWorldEncounter acima —
                    // bandido comum da Estrada (menu antigo) usa a região de
                    // destino, nunca o nível do jogador.
                    const toId = (p.roadJourney && p.roadJourney.toId) || (window.getCurrentCityId ? window.getCurrentCityId() : null);
                    this.startBattle(window.getRegionEnemyLevel ? window.getRegionEnemyLevel(toId) : undefined);
                }
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

        // Reputação global (ver reputation.js) — a mesma em qualquer
        // cidade, então o rótulo não menciona mais "em <cidade>" (isso
        // sugeria erroneamente que cada cidade tinha seu próprio número).
        const repTier = window.ReputationSystem ? window.ReputationSystem.getTier(p) : null;
        document.getElementById('questboard-reputation').innerText = repTier
            ? `Reputação: ${window.QuestSystem.getReputation(p, cityId)} (${repTier.badge} ${repTier.label})`
            : `Reputação: ${window.QuestSystem.getReputation(p, cityId)}`;

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
            } else if (item.category === 'material') {
                // Matéria-prima (ver items.js Material/ForgeSystem) — sem
                // slot/dano/defesa, então precisa do próprio ramo (o `else`
                // genérico abaixo assume equipamento e quebraria em
                // `item.slot.toUpperCase()`).
                document.getElementById('tt-type').innerText = `Matéria-Prima (Nível ${item.tier})`;
                statsHtml += `<p style="color:#88ccee">${item.description}</p>`;
            } else if (item.category === 'creature_material') {
                // Material de criatura (ver items.js CreatureMaterial, novo —
                // correção do bug "lobo dropa espada/armadura"): mesma forma
                // sem slot que Material acima, precisa do próprio ramo pelo
                // mesmo motivo (`item.slot.toUpperCase()` quebraria).
                document.getElementById('tt-type').innerText = `Material de Criatura (Nível ${item.tier})`;
                statsHtml += `<p style="color:#88ccee">${item.description}</p>`;
            } else {
                document.getElementById('tt-type').innerText = `Slot: ${item.slot.toUpperCase()}`;
                // Texto de identidade (Mega Atualização item 1/19 — ver
                // items.js Equipment.description, NOVO campo, opcional).
                // Itens antigos sem `description` simplesmente não mostram
                // esta linha, comportamento idêntico a antes.
                if (item.description) {
                    statsHtml += `<p style="font-style:italic; color:#c9c2ad;">${item.description}</p>`;
                }
                // Requisitos de equipar (Mega Atualização item 3/4/18) — a
                // loja/tooltip SEMPRE mostra isto, mesmo quando o jogador
                // não atende (nunca esconde item forte só por o jogador
                // ser fraco ainda). Vermelho quando falta algo, azul claro
                // quando já atende — mesma checagem de player.canEquip()
                // usada de verdade no clique de equipar, nunca duplicada.
                if (item.requiredLevel > 1 || item.requiredStats) {
                    const reqParts = [`Nv.${item.requiredLevel}`];
                    if (item.requiredStats) {
                        for (const k in item.requiredStats) reqParts.push(`${item.requiredStats[k]} ${k.toUpperCase()}`);
                    }
                    const pForReq = window.Engine.state.player;
                    const check = pForReq && pForReq.canEquip ? pForReq.canEquip(item) : { ok: true };
                    statsHtml += `<p style="color:${check.ok ? '#88ccee' : '#ff5a5a'}">🔒 Requer: ${reqParts.join(', ')}</p>`;
                }
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
                // Qualidade de Forja (ver js/forge.js/items.js Equipment.quality)
                // — eixo separado de raridade, só existe em itens forjados
                // (null em todo item de loja/loot, então este bloco nunca
                // aparece fora da Forja).
                if (item.quality !== null && item.quality !== undefined) {
                    statsHtml += `<p style="color:#88ccee">⚒️ ${window.ForgeSystem.qualityLabel(item.quality)} — Qualidade ${item.quality}/100</p>`;
                }
                if (item.damage) statsHtml += `<p>Dano Base: ${item.damage}</p>`;
                if (item.defense) statsHtml += `<p>Defesa Base: ${item.defense}</p>`;
                for (let stat in item.statBonuses) {
                    const val = item.statBonuses[stat];
                    // Item 12 da revisão profunda ("itens com identidade e
                    // trade-offs", ex: "-defesa") introduziu os primeiros
                    // `statBonuses` negativos do jogo — o "+" fixo aqui
                    // virava um "+-3 DEF" ilegível (sinal duplicado) pra
                    // qualquer penalidade. `val` já carrega o próprio sinal
                    // (negativo imprime "-3" sozinho), então só o positivo
                    // precisa do "+" explícito; a cor também troca pra
                    // vermelho, deixando a penalidade tão visível quanto o bônus.
                    statsHtml += val >= 0
                        ? `<p style="color:#1eff00">+${val} ${stat.toUpperCase()}</p>`
                        : `<p style="color:#ff6666">${val} ${stat.toUpperCase()}</p>`;
                }
                if (item.critBonus) statsHtml += `<p style="color:#ffcc00">+${item.critBonus}% Crítico</p>`;
                // MEGA REWORK Econômico Iteração 5: primeiras armas com
                // `accBonus` NEGATIVO do jogo (ver items.js orcwarchain/
                // orcboneaxe) — mesmo bug de sinal duplicado já corrigido
                // acima pra statBonuses ("+-4 Precisão"), mesmo fix aqui.
                if (item.accBonus) statsHtml += item.accBonus >= 0
                    ? `<p style="color:#ffcc00">+${item.accBonus} Precisão</p>`
                    : `<p style="color:#ff6666">${item.accBonus} Precisão</p>`;
                if (item.armorPierce) statsHtml += `<p style="color:#ff8000">Perfura ${Math.floor(item.armorPierce * 100)}% da armadura</p>`;
                if (item.blockChance) statsHtml += `<p style="color:#88ccff">+${item.blockChance}% Bloqueio</p>`;
                if (item.hpBonus) statsHtml += `<p style="color:#ff4444">+${item.hpBonus} HP Máximo</p>`;
                if (item.mpBonus) statsHtml += `<p style="color:#3388ff">+${item.mpBonus} MP Máximo</p>`;
                if (item.appliedRunes && item.appliedRunes.length > 0) {
                    // `item.appliedRunes` guarda `rune.id` (ex: 'r_01'), não
                    // a chave do template (ex: 'rune_ignea') — busca pelo
                    // campo `.id` entre os valores de ItemDatabase.runes.
                    const runeNames = item.appliedRunes.map(id => {
                        const found = Object.values(ItemDatabase.runes).find(r => r.id === id);
                        return found ? found.name : id;
                    }).join(', ');
                    statsHtml += `<p style="color:#ffb347">🔯 Runas gravadas: ${runeNames}</p>`;
                }
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

    // Corta um texto num limite de caracteres sempre numa fronteira de
    // PALAVRA (nunca no meio de uma palavra) — usado pelos rótulos de slot
    // de equipamento (renderEquipment) que antes cortavam nas primeiras 3
    // letras cruas ("Esp.." pra "Espada Curta"). Textos que já cabem no
    // limite voltam intactos, sem reticências.
    _truncateLabel(text, maxLen) {
        if (text.length <= maxLen) return text;
        const cut = text.slice(0, maxLen);
        const lastSpace = cut.lastIndexOf(' ');
        return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
    }

    // Ícone de item por slot (equipamento) ou categoria (consumível) — antes
    // a mochila/loot mostravam só a letra solta "I"/"P" como "ícone
    // placeholder" (literalmente comentado como tal no código), e a loja
    // não mostrava ícone nenhum. Reaproveita o mesmo estilo de emoji já
    // usado pelos prédios da Cidade (ver city.js `icon:`), em vez de inventar
    // um sistema de sprites novo só pra isso.
    _itemIcon(item) {
        if (item.category === 'consumable') return this._consumableIcon(item);
        if (item.category === 'material') return '⛏️';
        if (item.category === 'creature_material') return '🐾';
        // Bug de auditoria (Iteração 9): essência e runa nunca tinham
        // ícone próprio aqui — caíam no fallback `icons[item.slot]`, que
        // pra elas é sempre undefined (nenhuma das duas tem `.slot`),
        // então mostravam '❔' na mochila em vez de um ícone real.
        if (item.category === 'essence') return '✨';
        if (item.category === 'rune') return '🔯';
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

    // Ícone de consumível, por item específico (mais variedade) com
    // fallback por consumableCategory. Bug de auditoria visual reportado
    // pelo jogador: TODO consumível — poção, bandagem, comida, bebida —
    // caía no mesmo ícone genérico de tubo de ensaio 🧪; comida com cara
    // de laboratório não fazia sentido, e a categoria toda perdia
    // identidade. Segue o mesmo padrão de mapa-por-id já usado acima pras
    // armas (weaponIcons).
    _consumableIcon(item) {
        const byId = {
            c_01: '🧪', c_02: '⚗️', // poções de vida (comum / maior)
            c_03: '🔷', // poção de mana
            c_04: '🩹', c_16: '🩹', // bandagens (simples / reforçada)
            c_17: '⚕️', // bandagem medicinal (topo de linha)
            c_18: '🍞', // pão de taverna
            c_19: '🍖', // carne assada
            c_20: '🍺', // cerveja
            c_21: '🍷', // vinho
            c_05: '🍯', // hidromel forte
            c_06: '🍗', // banquete anão
            c_07: '🥓', // carne defumada
            c_22: '🌿', // pão de ervas élfico
            c_23: '🍵', // chá da lua élfica
            c_24: '🍗', // carne de javali
            c_25: '🍻', // cerveja negra orc
            hs_01: '🍲', // guisado do viajante
            hs_02: '🍷', // vinho da casa
            hs_03: '🐗', // carne de javali negro
            hs_04: '🥃', // punho de ferro
            hs_05: '🌙', // infusão da lua cheia
            hs_06: '🍇', // fruta da seiva ancestral
            hs_07: '🍲', // ensopado de ferro
            hs_08: '🍯'  // hidromel negro anão
        };
        if (item.id && byId[item.id]) return byId[item.id];
        const byCategory = {
            health: '🧪', mana: '🔷', bandage: '🩹', food: '🍽️', drink: '🍶'
        };
        return byCategory[item.consumableCategory] || '🧪';
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
