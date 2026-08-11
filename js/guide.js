/**
 * Guia do Jogo — referência estática de todos os sistemas de Arena of
 * Blades (atributos, magias, encantamentos, linhagens, cidades, raças,
 * bosses e sinergias). Acessível tanto do Menu Principal quanto do Hub da
 * cidade, sem depender de nenhum save/personagem carregado — todo o
 * conteúdo é lido diretamente dos registries reais do jogo (SkillDB,
 * ENCHANTMENTS, LINEAGES, SKILL_TREES, CityDatabase, RACES, BOSS_DEFS,
 * AI_*), nunca duplicado/hardcoded aqui, para nunca ficar desatualizado
 * conforme o jogo muda.
 */

const GuideSystem = {
    _activeTab: 'attrs',
    _source: 'hub', // 'hub' ou 'mainmenu' — pra onde o botão Fechar volta

    TABS: [
        { id: 'attrs', label: 'Atributos', icon: '💪' },
        { id: 'consumables', label: 'Consumíveis', icon: '🧺' },
        { id: 'skills', label: 'Magias', icon: '🔮' },
        { id: 'styles', label: 'Estilos de Combate', icon: '🥊' },
        { id: 'ai_behavior', label: 'Comportamento Inimigo', icon: '🧠' },
        { id: 'enchant', label: 'Encantamentos', icon: '✨' },
        { id: 'lineages', label: 'Linhagens', icon: '🩸' },
        { id: 'cities', label: 'Cidades', icon: '🏛️' },
        { id: 'races', label: 'Raças', icon: '👥' },
        { id: 'bosses', label: 'Bosses', icon: '👑' },
        { id: 'arena', label: 'Arena', icon: '⚔️' },
        { id: 'synergies', label: 'Sinergias', icon: '🔗' }
    ],

    open(source) {
        this._source = source || 'hub';
        const tabsEl = document.getElementById('guide-tabs');
        if (!tabsEl.childElementCount) {
            tabsEl.innerHTML = this.TABS.map(t =>
                `<button class="guide-tab-btn" data-tab="${t.id}">${t.icon} ${t.label}</button>`
            ).join('');
            tabsEl.querySelectorAll('.guide-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.selectTab(btn.dataset.tab));
            });
        }
        this.selectTab(this._activeTab);
        window.UI.showScreen('screen-guide', 'fade');
    },

    close() {
        if (this._source === 'mainmenu') {
            window.MainMenu.showMainMenu();
        } else {
            window.UI.showScreen('screen-hub');
        }
    },

    selectTab(tabId) {
        this._activeTab = tabId;
        document.querySelectorAll('.guide-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        const content = document.getElementById('guide-content');
        const renderers = {
            attrs: () => this._renderAttrs(),
            consumables: () => this._renderConsumables(),
            skills: () => this._renderSkills(),
            styles: () => this._renderCombatStyles(),
            ai_behavior: () => this._renderCombatAI(),
            enchant: () => this._renderEnchant(),
            lineages: () => this._renderLineages(),
            cities: () => this._renderCities(),
            races: () => this._renderRaces(),
            bosses: () => this._renderBosses(),
            arena: () => this._renderArena(),
            synergies: () => this._renderSynergies()
        };
        content.innerHTML = (renderers[tabId] || renderers.attrs)();
        content.scrollTop = 0;
    },

    // ==========================================================================
    // ATRIBUTOS
    // ==========================================================================
    _renderAttrs() {
        const rows = [
            ['Força (STR)', 'Dano físico (arma + punhos), vida máxima e capacidade de carga.', 'Dano físico = STR × 1.5 (+ dano da arma ativa). Vida máxima = 15 + STR×11 + Nível×3. Carga suportada = 15 + STR×3 (sobrecarga reduz esquiva).'],
            ['Agilidade (AGI)', 'Esquiva e chance de crítico.', 'Esquiva = (AGI×0.5 + Sorte×0.1), até 45%. Crítico = (AGI×0.2 + Sorte×0.5), até 50% (65% com bônus de equipamento/mutação).'],
            ['Inteligência (INT)', 'Dano de magias, cura e Mana máxima.', 'Dano mágico = INT×3×poder da magia (mitigado pela INT do alvo×0.5, ignora armadura). Cura = INT×2.5×poder da magia. Mana máxima = 20 + INT×8 + Nível×3.'],
            ['Defesa (DEF)', 'Redução de dano físico recebido.', 'Defesa = DEF×2 (+ defesa de armaduras/escudo). Redução = Defesa / (Defesa + 50). Defender no turno dobra a Defesa efetiva.'],
            ['Precisão (ACC)', 'Chance de acerto, ignorando esquiva do alvo.', 'Chance de acerto = 90 + ACC×2 + bônus da arma − esquiva efetiva do alvo (mínimo de 20%, máximo de 100%).'],
            ['Sorte (LUK)', 'Taxa de itens que inimigos derrotados deixam cair e críticos extremos.', 'Contribui para esquiva e crítico (ver acima). Também soma à taxa de drop de loot dos inimigos (varia por tipo de inimigo).'],
            ['Carisma (CHA)', 'Preços na loja e eventos sociais na cidade.', 'Desconto na loja de até 12% (mais desconto por vitórias, teto total 35%). Reduz chance de assalto/roubo em eventos noturnos da cidade. Também afeta a moral de inimigos em combate.']
        ];
        return `
            <p class="guide-section-intro">Os 7 atributos base de qualquer personagem (jogador, inimigo ou Rival). Todos começam em 5 e sobem com pontos de atributo ao subir de nível, bônus de raça e bônus de equipamento.</p>
            <div class="guide-table-wrap">
                <table class="guide-table">
                    <thead><tr><th>Atributo</th><th>O que faz</th><th>Fórmula / detalhe exato</th></tr></thead>
                    <tbody>
                        ${rows.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="guide-block">
                <h4>Outras regras de combate</h4>
                <p><strong>Crítico:</strong> multiplica o dano já calculado por ×1.5.</p>
                <p><strong>Fadiga:</strong> acumulada por derrotas ou noites sem dormir, reduz dano físico e esquiva em até 24% (cura dormindo na Taverna).</p>
                <p><strong>Peças quebradas:</strong> uma arma/armadura com durabilidade zerada entrega só metade do dano/defesa até ser reparada no Ferreiro/Armeiro.</p>
                <p><strong>Bloqueio de escudo:</strong> reduz o dano já mitigado pela metade, e depende só do equipamento (nenhum atributo contribui diretamente).</p>
            </div>
        `;
    },

    // ==========================================================================
    // CONSUMÍVEIS (TAVERNA)
    // ==========================================================================
    // Lê direto de ItemDatabase.consumables/houseSpecialties (Rework da
    // Taverna) — nunca duplica os números aqui, pra nunca ficar
    // desatualizado. O jogo NÃO tem sistema de fome/sede: toda comida e
    // bebida é consumível OPCIONAL com efeito próprio, nunca obrigatório.
    _renderConsumables() {
        const all = (typeof ItemDatabase !== 'undefined' && ItemDatabase.consumables) || {};
        const byCategory = (cat) => Object.values(all).filter(t => t.consumableCategory === cat);
        const health = byCategory('health');
        const mana = byCategory('mana');
        const bandages = byCategory('bandage');
        const food = byCategory('food');
        const drink = byCategory('drink');

        const statLabel = {
            physicalDamageFlat: 'Dano Físico', dodgeBonusPercent: 'Esquiva', defenseBonusPercent: 'Resistência',
            defenseRatingFlat: 'Defesa', maxMpFlat: 'MP Máximo', healPowerBonusPercent: 'Poder de Cura'
        };
        const buffLine = (t) => {
            const main = `${t.buffAmount >= 0 ? '+' : ''}${t.buffAmount} ${statLabel[t.statKey] || t.statKey}`;
            const secondary = t.secondaryStatKey ? `, ${t.secondaryAmount >= 0 ? '+' : ''}${t.secondaryAmount} ${statLabel[t.secondaryStatKey] || t.secondaryStatKey}` : '';
            const duration = t.durationBattles ? `por ${t.durationBattles} batalha(s)` : (t.durationDays ? `por ${t.durationDays} dia(s)` : '');
            return `${main}${secondary} ${duration}`.trim();
        };

        const houseSpecialties = (typeof ItemDatabase !== 'undefined' && ItemDatabase.houseSpecialties) || {};
        const cityNames = {};
        Object.values(window.CityDatabase || {}).forEach(c => { cityNames[c.id] = c.name; });
        const cityFlavor = {
            porto_helenico: 'variedade equilibrada, um pouco de tudo, sempre disponível',
            fortaleza_orc: 'comida forte e bebidas pesadas, tema de treino físico bruto',
            santuario_elfico: 'ervas, frutas e chás com toque de magia da natureza',
            reino_anao: 'hidromel, comida farta e bebidas fortes, tema de resistência'
        };

        return `
            <p class="guide-section-intro">A Taverna de cada cidade vende cinco categorias de consumíveis, organizadas em abas próprias. O jogo NÃO tem sistema de fome ou sede — nenhuma comida ou bebida é obrigatória, cada uma é uma escolha estratégica OPCIONAL com efeito próprio. Tudo aqui usa a MESMA mochila, o mesmo ouro e o mesmo save do resto do jogo.</p>

            <div class="guide-block">
                <h4>❤️ Poções de Vida &nbsp;·&nbsp; 🔷 Poções de Mana</h4>
                <p>Cura instantânea, utilizável a qualquer momento — inclusive DURANTE a batalha. Recebem bônus de Poder de Cura de equipamento/itens, ao contrário das Bandagens abaixo.</p>
                <div class="guide-table-wrap">
                    <table class="guide-table">
                        <thead><tr><th>Item</th><th>Efeito</th><th>Preço</th></tr></thead>
                        <tbody>
                            ${[...health, ...mana].map(t => `<tr><td><strong>${t.name}</strong></td><td>${t.description}</td><td>${t.value}g</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="guide-block">
                <h4>🩹 Bandagens</h4>
                <p>Cura HP, mas SÓ FORA de combate — nunca substitui uma poção numa emergência de batalha. Não recebe bônus de atributo/equipamento (valor fixo sempre), e nunca ultrapassa o HP máximo. Opção mais econômica pra recuperar entre lutas; a poção continua sendo a opção versátil dentro da batalha.</p>
                <div class="guide-table-wrap">
                    <table class="guide-table">
                        <thead><tr><th>Item</th><th>Cura</th><th>Preço</th></tr></thead>
                        <tbody>
                            ${bandages.map(t => `<tr><td><strong>${t.name}</strong></td><td>${t.power} HP</td><td>${t.value}g</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="guide-block">
                <h4>🍞 Comida &nbsp;·&nbsp; 🍺 Bebidas</h4>
                <p>Buffs temporários com duração medida em BATALHAS (não em tempo real) — pensados pra preparar o gladiador antes de uma sequência de lutas, nunca pra manter vivo durante uma. O jogador só pode carregar <strong>1 efeito de Comida + 1 efeito de Bebida ativos ao mesmo tempo</strong>: consumir outro da mesma categoria SUBSTITUI o anterior (nunca acumula). Algumas bebidas trazem um bônus e uma penalidade juntos (ex: mais dano, menos esquiva) — vantagem real, com uma escolha real por trás.</p>
                <div class="guide-table-wrap">
                    <table class="guide-table">
                        <thead><tr><th>Item</th><th>Categoria</th><th>Efeito</th><th>Preço</th></tr></thead>
                        <tbody>
                            ${[...food, ...drink].map(t => `<tr><td><strong>${t.name}</strong></td><td>${t.consumableCategory === 'food' ? 'Comida' : 'Bebida'}</td><td>${buffLine(t)}</td><td>${t.value}g</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="guide-block">
                <h4>⭐ Especialidades da Casa</h4>
                <p>Cada Taverna mantém de 1 a 3 produtos exclusivos em destaque, que giram dia a dia (com uma chance de repetir o mesmo produto do dia anterior, então vale a pena visitar em dias diferentes). São mais fortes — e mais caros — que o estoque comum, e algumas só aparecem em cidades específicas: nunca o mesmo produto vendido em duas cidades diferentes só trocando o nome.</p>
                <div class="guide-grid">
                    ${Object.keys(houseSpecialties).map(cityId => `
                        <div class="guide-card">
                            <div class="guide-card-tag">${cityNames[cityId] || cityId}${cityFlavor[cityId] ? ` · ${cityFlavor[cityId]}` : ''}</div>
                            ${Object.values(houseSpecialties[cityId]).map(t => `<p><strong>${t.name}</strong> — ${buffLine(t)} (${t.value}g)</p>`).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ==========================================================================
    // MAGIAS E HABILIDADES
    // ==========================================================================
    _renderSkills() {
        const all = Object.values(window.SkillDB || {})
            .filter(s => !s.isBossSkill && !s.isMutationSkill && !s.isStyleSkill)
            .sort((a, b) => a.levelReq - b.levelReq);
        const typeLabel = {
            PHYSICAL: 'Físico', MAGIC: 'Mágico', HEAL: 'Cura', BLEED: 'Sangramento', STUN: 'Atordoante',
            LIFESTEAL: 'Roubo de Vida', TELEPORT_ENEMY: 'Mobilidade', TELEPORT_FAR: 'Mobilidade', AMMO_RECALL: 'Utilidade'
        };
        return `
            <p class="guide-section-intro">Habilidades comuns, aprendidas com Pontos de Talento no Mercado Arcano da cidade conforme o nível sobe. Habilidades de Linhagem (Vampirismo/Luz) ficam na aba Linhagens; habilidades exclusivas de boss ficam na aba Bosses.</p>
            <div class="guide-table-wrap">
                <table class="guide-table">
                    <thead><tr><th>Nível</th><th>Nome</th><th>Tipo</th><th>Custo MP</th><th>Recarga</th><th>Descrição</th></tr></thead>
                    <tbody>
                        ${all.map(s => `<tr><td>${s.levelReq}</td><td><strong>${s.name}</strong></td><td>${typeLabel[s.type] || s.type}</td><td>${s.mpCost}</td><td>${s.cooldown} turno(s)</td><td>${s.description}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // ==========================================================================
    // ESTILOS DE COMBATE (Mega Atualização Arena + Estilos)
    // ==========================================================================
    // Lê direto de COMBAT_STYLES/COMBAT_STYLE_TREES (combatstyles.js) —
    // nunca duplica os números aqui. Sistema TOTALMENTE separado de
    // Linhagem: nunca substitui a árvore de Mutação, e o jogador pode ter
    // as duas ativas ao mesmo tempo.
    _renderCombatStyles() {
        const styles = Object.values(window.COMBAT_STYLES || {});
        const statLabel = {
            unarmedDamageBonusPercent: 'Dano desarmado', unarmedDodgeBonusPercent: 'Esquiva desarmado',
            lightWeaponDodgeBonusPercent: 'Esquiva (arma leve)', lightWeaponCritBonus: 'Crítico (arma leve)',
            shieldBlockChanceBonusFlat: 'Bloqueio (escudo)', shieldCounterChanceBonusFlat: 'Contra-ataque (escudo)',
            rangedDistanceDamageBonusPercent: 'Dano à distância (escala com a distância)', rangedRetreatSpeedBonusFlat: 'Velocidade ao recuar'
        };
        return `
            <p class="guide-section-intro">Uma camada de especialização de combate separada de Linhagem — não substitui a Árvore de Mutação, e as duas podem estar ativas ao mesmo tempo. Cada estilo é aprendido com ouro na sua cidade de origem (Mercado Arcano → "Estilos de Combate") e exige um equipamento específico pra funcionar; equipar algo incompatível nunca remove o item sozinho, só desativa os bônus e bloqueia as habilidades do estilo até você reequipar o certo. Só UM estilo fica ATIVO por vez, mas o progresso de cada estilo aprendido é preservado independentemente — trocar de estilo ativo (botão "Ativar") não apaga nada.</p>
            ${styles.map(style => {
                const tree = window.COMBAT_STYLE_TREES[style.id];
                const activeNodes = tree.nodes.filter(n => n.type === 'passive');
                const skillNodes = tree.nodes.filter(n => n.type === 'active');
                const cityName = (window.CityDatabase[style.cityId] && window.CityDatabase[style.cityId].name) || style.cityId;
                return `
                    <div class="guide-block">
                        <h4>${style.icon} ${style.name}</h4>
                        <p>${style.description}</p>
                        <p><strong>Aprendido em:</strong> ${cityName} (${window.CombatStyleSystem.LEARN_COST}g)</p>
                        <p style="color:#ffcc66;">${style.incompatibleMessage}</p>
                        <p style="color:var(--color-marble-dark); font-size:0.85rem;">Árvore com ${tree.nodes.length} nós em 4 tiers — pré-requisitos reais (nunca compre pulando ou na diagonal, cada nó exige um nó-pai específico já desbloqueado).</p>
                        <p><strong>Passivos:</strong> ${activeNodes.map(n => `${n.name} (${(Object.keys(n.statMods)[0] && statLabel[Object.keys(n.statMods)[0]]) || ''})`).join(', ')}</p>
                        <p><strong>Habilidades ativas:</strong> ${skillNodes.map(n => n.name).join(', ')}</p>
                    </div>
                `;
            }).join('')}
        `;
    },

    // ==========================================================================
    // COMPORTAMENTO INIMIGO (item 27 da mega-diretiva de rework da IA de
    // combate — explica QUE existe variedade de comportamento e COMO
    // percebê-la em jogo, sem revelar fórmulas/pontuações internas do
    // motor de decisão (ver ai.js AICombat), que estragariam a graça de
    // aprender lendo o próprio inimigo em combate.)
    // ==========================================================================
    _renderCombatAI() {
        return `
            <p class="guide-section-intro">Nenhum adversário decide no escuro. Cada inimigo (Duelo Rápido, Rival da Ladder ou Campeão) nasce com atributos, uma personalidade, um estilo de luta e um nível de inteligência próprios — e toma decisões de combate coerentes com essa combinação, turno a turno, lendo a distância e o que você está fazendo. Aprender a reconhecer esses padrões é parte da estratégia: um inimigo não é só "mais um adversário", é um perfil específico que você pode explorar.</p>
            <div class="guide-block">
                <h4>Atributos moldam comportamento, não só dano</h4>
                <p>Um inimigo de <strong>Força</strong> alta insiste mais no ataque básico e em golpes pesados — prefere resolver o combate no corpo a corpo. <strong>Agilidade</strong> alta significa mais disposição a se reposicionar (avançar ou recuar) em vez de ficar parado trocando golpes. <strong>Inteligência</strong> alta favorece magias em vez do ataque comum, e também torna o inimigo mais cuidadoso com a própria mana — não espere vê-lo esvaziá-la sem motivo. <strong>Defesa</strong> alta aumenta a chance de vê-lo Defender. <strong>Precisão</strong> alta transmite confiança no ataque direto, principalmente com armas de longo alcance. <strong>Sorte</strong> alta faz o inimigo pressionar mais quando percebe você já fraco — reconhece uma abertura e a explora.</p>
            </div>
            <div class="guide-block">
                <h4>Distância importa pra ele tanto quanto pra você</h4>
                <p>Arqueiros tentam manter distância de propósito, recuando quando você se aproxima; se você usa uma arma de longo alcance, é comum um inimigo corpo a corpo tentar fechar o espaço mais depressa, justamente pra anular sua vantagem. Alguns inimigos com armas duplas trocam de arma em pleno combate quando a distância muda — um golpe corpo a corpo pode virar um tiro de arco (e vice-versa) se a situação pedir.</p>
            </div>
            <div class="guide-block">
                <h4>Personalidade e estilo se combinam em identidades reconhecíveis</h4>
                <p>Um estilo de luta define o que o inimigo PODE fazer (arma preferida, habilidades disponíveis); a personalidade define COMO ele usa isso — cauteloso, agressivo, oportunista, propenso a blefar, disposto a perseguir quem foge... A mesma combinação de estilo e atributos praticamente nunca se comporta de forma idêntica duas vezes, mas alguns padrões ficam claros com a experiência: um Guardião de Defesa alta bloqueia muito; um Berserker raramente recua; um Arqueiro de Precisão alta atira com confiança de longe.</p>
            </div>
            <div class="guide-block">
                <h4>Inimigos fortes decidem melhor, não só batem mais forte</h4>
                <p>Nível e Inteligência também afetam a QUALIDADE das decisões do inimigo, além dos números. Um adversário fraco e pouco experiente comete erros reais com alguma frequência — pode hesitar, desperdiçar uma oportunidade ou escolher algo abaixo do ideal. Um adversário forte e experiente erra bem menos e reconhece situações com mais consistência. Nenhum dos dois joga de forma perfeita ou puramente aleatória — a diferença é de julgamento, não só de estatística.</p>
            </div>
            <div class="guide-block">
                <h4>Alguns inimigos fogem da regra</h4>
                <p>Raramente, um Duelo Rápido nasce com um comportamento fora do padrão do próprio estilo/personalidade — algo perceptível já nos primeiros turnos contra ele. Reconhecer esse desvio rápido evita se surpreender no meio da luta.</p>
            </div>
        `;
    },

    // ==========================================================================
    // ENCANTAMENTOS
    // ==========================================================================
    _renderEnchant() {
        const detail = {
            fogo: '+15% de dano físico no impacto, além de queimadura (dano extra por 2 turnos, escala com a Inteligência do atacante).',
            gelo: '+8% de dano físico no impacto, com 25% de chance de reduzir a velocidade de ataque do alvo por 1 turno.',
            eletricidade: '+10% de dano físico no impacto, com 15% de chance de atordoar o alvo.',
            veneno: 'Sem dano extra no impacto, mas aplica veneno (dano contínuo por 3 turnos que ignora armadura, escala com a Agilidade do atacante).',
            sangramento: 'Sem dano extra no impacto, mas abre um corte que sangra por 2 turnos e ACUMULA com golpes repetidos (escala com a Força do atacante).',
            sagrado: '+30% de dano contra alvos de Linhagem Vampirismo/Sombras (+10% contra qualquer outro alvo), cura 8% do dano causado. Em armadura: +6% de Defesa.',
            profano: '+30% de dano contra alvos de Linhagem Luz (+10% contra qualquer outro alvo), rouba 10% do dano como HP. Em armadura: +4% de esquiva.'
        };
        const list = Object.values(window.ENCHANTMENTS || {});
        return `
            <p class="guide-section-intro">Sistema separado das Linhagens: um encantamento só afeta o item em que é aplicado (arma ou armadura), nunca o corpo do gladiador, e pode ser trocado livremente a qualquer momento na Loja, por ouro.</p>
            <div class="guide-grid">
                ${list.map(e => `
                    <div class="guide-card" style="--guide-accent:${e.color}">
                        <div class="guide-card-tag">Aplica-se a: ${e.appliesTo.map(a => a === 'weapon' ? 'Arma' : 'Armadura').join(' e ')} · Custo: ${e.cost}g</div>
                        <h4>${e.name}</h4>
                        <p>${detail[e.id] || e.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ==========================================================================
    // LINHAGENS (MUTAÇÕES)
    // ==========================================================================
    _renderTreeNode(node) {
        const isCapstone = node.tier === 5;
        const typeLabel = node.type === 'active' ? 'Ativo' : 'Passivo';
        let effect = node.description;
        if (node.type === 'active' && node.skillDef) {
            effect = `${node.description} (${node.skillDef.mpCost} MP, recarga ${node.skillDef.extra && node.skillDef.extra.cooldown || 1} turno(s))`;
        }
        return `
            <div class="guide-tree-node ${node.type === 'active' ? 'active-node' : ''} ${isCapstone ? 'capstone' : ''}">
                <div class="node-type">${typeLabel} · Tier ${node.tier} · Custo ${node.cost}</div>
                <h5>${node.name}${isCapstone ? ' 👑' : ''}</h5>
                <p>${effect}</p>
            </div>
        `;
    },

    _renderTree(treeId) {
        const tree = (window.SKILL_TREES || {})[treeId];
        if (!tree) return '';
        const byTier = {};
        tree.nodes.forEach(n => { (byTier[n.tier] = byTier[n.tier] || []).push(n); });
        const tiers = Object.keys(byTier).sort((a, b) => a - b);
        return `
            <p style="font-size:0.82rem; color:var(--color-marble-dark); margin-bottom:8px;">Cada nó pode ser desbloqueado assim que QUALQUER UM de seus pré-requisitos já estiver aberto (não é preciso abrir todos) — a árvore permite convergir para builds diferentes a partir das mesmas raízes.</p>
            ${tiers.map(t => `<div class="guide-tree-tier">${byTier[t].map(n => this._renderTreeNode(n)).join('')}</div>`).join('')}
        `;
    },

    _renderLineages() {
        const lineages = Object.values(window.LINEAGES || {});
        const rituals = window.RITUALS || {};
        const bossDefs = window.BOSS_DEFS || {};
        return `
            <p class="guide-section-intro">Uma Linhagem é uma mutação PERMANENTE do gladiador — escolhida uma única vez, ao vencer o boss de um Ritual, e válida para o resto da campanha. Sistema totalmente separado dos Encantamentos (que ficam nos itens). Cada Linhagem é forte contra o que causa dano a ela e fraca contra uma Linhagem específica (+25% de dano recebido dessa Linhagem).</p>
            ${lineages.map(l => {
                if (l.locked) {
                    return `
                        <div class="guide-block">
                            <h4>${l.name} <span class="guide-locked-note" style="display:inline; padding:0;">(ainda não disponível nesta versão)</span></h4>
                            <p><em>"${l.tagline}"</em></p>
                            <p>Especialidades planejadas: ${l.specialty.join(', ')}. Fraqueza planejada: <span class="guide-weakness-tag">${l.weaknessName}</span>.</p>
                        </div>
                    `;
                }
                const ritual = Object.values(rituals).find(r => r.lineageId === l.id);
                const boss = bossDefs[l.bossId];
                return `
                    <div class="guide-block">
                        <h4>${l.name}</h4>
                        <p><em>"${l.tagline}"</em></p>
                        <p>Especialidades: ${l.specialty.join(', ')}. Fraqueza: <span class="guide-weakness-tag">${l.weaknessName}</span> (atacantes dessa Linhagem causam +25% de dano contra quem tem esta).</p>
                        ${ritual ? `<p><strong>Como desperta — ${ritual.name}:</strong> ${ritual.description}</p>` : ''}
                        ${boss ? `<p><strong>Guardião:</strong> ${boss.name}, ${boss.title} (ver aba Bosses).</p>` : ''}
                        <h5 style="color:var(--color-gold); margin:10px 0 6px;">Árvore de Habilidades</h5>
                        ${this._renderTree(l.skillTreeId)}
                    </div>
                `;
            }).join('')}
        `;
    },

    // ==========================================================================
    // CIDADES
    // ==========================================================================
    _renderCities() {
        const cities = Object.values(window.CityDatabase || {});
        const weapons = (typeof ItemDatabase !== 'undefined' && ItemDatabase.weapons) || {};
        const armors = (typeof ItemDatabase !== 'undefined' && ItemDatabase.armors) || {};
        const shields = (typeof ItemDatabase !== 'undefined' && ItemDatabase.shields) || {};
        const trinkets = (typeof ItemDatabase !== 'undefined' && ItemDatabase.trinkets) || {};
        const allItems = { ...weapons, ...armors, ...shields, ...trinkets };
        return `
            <p class="guide-section-intro">Três cidades-hub, cada uma com sua própria demografia, clima e itens exclusivos de Ferreiro/Armeiro. A infraestrutura civil (Ferreiro, Armeiro, Taverna, Banco, Hall da Fama, Casa, Mercado Arcano, Viajante do Portão) existe igual em toda cidade — o Viajante do Portão, parado no vão da muralha, cobra uma passagem em ouro para viajar entre elas.</p>
            ${cities.map(c => {
                const regionalItems = Object.entries(allItems).filter(([, def]) => def.region === c.id).map(([, def]) => def.name);
                const demo = Object.entries(c.raceDemographics).sort((a, b) => b[1] - a[1]).map(([race, pct]) => `${(window.RACES[race] && window.RACES[race].name) || race} ${pct}%`).join(', ');
                return `
                    <div class="guide-card" style="--guide-accent:${c.accentColor}; margin-bottom:14px;">
                        <div class="guide-card-tag">Nível mínimo: ${c.unlockLevel} · Passagem: ${c.travelCost === 0 ? 'grátis (cidade natal)' : c.travelCost + 'g'}</div>
                        <h4>${c.name}</h4>
                        <p class="guide-card-flavor">${c.description}</p>
                        <p><strong>Demografia da Arena:</strong> ${demo}</p>
                        <p><strong>Clima:</strong> ${c.weather.rainChance}% de chance de chuva, ${c.weather.stormChance}% de chance de tempestade em qualquer dia.</p>
                        ${regionalItems.length ? `<p><strong>Itens exclusivos do Ferreiro/Armeiro local:</strong> ${regionalItems.join(', ')}.</p>` : ''}
                    </div>
                `;
            }).join('')}
            <div class="guide-block">
                <h4>Perigo noturno</h4>
                <p>Em qualquer cidade, à noite os NPCs comuns somem das ruas, Vampiros passam a vagar pela praça, e há chance real de emboscada (ataque de Vampiro/Fantasma) ou eventos de risco (assalto, monstro). Só o Viajante do Portão nunca some — a viagem entre cidades nunca é bloqueada pela noite. Três noites seguidas sem dormir aumenta a fadiga do personagem; o Banco rende juros durante a noite.</p>
            </div>
        `;
    },

    // ==========================================================================
    // RAÇAS
    // ==========================================================================
    _renderRaces() {
        const races = Object.values(window.RACES || {});
        return `
            <p class="guide-section-intro">Escolhida uma única vez na Criação de Personagem (diferente de Linhagem, que é conquistada). Cada raça soma modificadores fixos de atributo e, exceto Humano, uma passiva única. Qualquer raça é jogável desde o início, sem restrição de origem — a raça também é sorteada em inimigos e Rivais gerados proceduralmente.</p>
            <div class="guide-grid">
                ${races.map(r => {
                    const mods = Object.entries(r.statMods).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ') || 'nenhum';
                    return `
                        <div class="guide-card" style="--guide-accent:${r.accent || 'var(--color-bronze)'}">
                            <h4>${r.name}</h4>
                            <p class="guide-card-flavor">${r.description}</p>
                            <p><strong>Atributos:</strong> ${mods}</p>
                            ${r.passive ? `<p><strong>Passiva:</strong> ${r.passive.label}</p>` : '<p><em>Sem passiva única — a raça mais equilibrada do elenco.</em></p>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ==========================================================================
    // BOSSES
    // ==========================================================================
    _renderBosses() {
        const bossDefs = window.BOSS_DEFS || {};
        const skillGroups = {
            conde_vampiro: ['conde_garras_sombrias', 'conde_sugar_vida', 'conde_enxame_morcegos', 'conde_garra_final'],
            anjo_guardiao: ['anjo_raio_sagrado', 'anjo_cura_divina', 'anjo_barreira', 'anjo_julgamento_final']
        };
        const behavior = {
            conde_vampiro: 'Agressivo e implacável — nunca recua nem hesita. Fica mais selvagem e imprevisível abaixo de 50% de HP (Fase 2), priorizando Sugar Vida quando ferido e reservando Garra Imortal para essa fase.',
            anjo_guardiao: 'Disciplinado e defensivo — luta com lança (recua se o oponente chegar perto demais, avança ou usa Raio Sagrado se longe demais). Ergue barreira e se cura preventivamente, e só usa Julgamento Final quando encurralado (HP ≤ 30%).'
        };
        return `
            <p class="guide-section-intro">Cada Linhagem tem um boss-guardião com IA 100% exclusiva (nunca reaproveita o comportamento dos inimigos comuns) e habilidades que nenhum outro personagem pode aprender. Vencê-lo é a única forma de despertar a Linhagem correspondente.</p>
            ${Object.values(bossDefs).map(b => {
                const lineage = window.LINEAGES && window.LINEAGES[b.lineage];
                const skills = (skillGroups[b.id] || []).map(id => window.SkillDB && window.SkillDB[id]).filter(Boolean);
                return `
                    <div class="guide-block">
                        <h4>${b.name} — <em style="color:var(--color-marble-dark);">${b.title}</em></h4>
                        <p>Guardião da Linhagem <strong>${lineage ? lineage.name : b.lineage}</strong>. Equipado com ${b.weaponId === 'dagger' ? 'Adaga' : 'Lança'} Lendária e ${b.armorId === 'chainmail' ? 'Cota de Malha' : 'Armadura de Placas'} Lendária.</p>
                        <p>${behavior[b.id] || ''}</p>
                        <div class="guide-table-wrap">
                            <table class="guide-table">
                                <thead><tr><th>Habilidade exclusiva</th><th>Descrição</th></tr></thead>
                                <tbody>
                                    ${skills.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.description}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    },

    // ==========================================================================
    // ARENA (Ladder, Bosses Especiais, Desafios de Campeão, Arena dos
    // Campeões — item 27 da mega-diretiva Arena+Estilos: nunca esquecer de
    // documentar o que foi implementado). Lê tudo direto de RivalDatabase/
    // ARENA_BOSS_DEFS/CHAMPION_CHALLENGES/CHAMPIONS_ARENA_STAGES, nunca
    // duplica números aqui, pelo mesmo motivo do resto do arquivo.
    // ==========================================================================
    _renderArena() {
        const leagues = (window.RivalDatabase && window.RivalDatabase.leagues) || [];
        const arenaBosses = Object.values(window.ARENA_BOSS_DEFS || {});
        const challenges = window.CHAMPION_CHALLENGES || [];
        const stages = window.CHAMPIONS_ARENA_STAGES || [];

        const leagueRows = leagues.map(l => {
            const levels = l.rivals.map(r => r.level);
            const champion = l.rivals.find(r => r.isChampion);
            return `<tr><td><strong>${l.name}</strong></td><td>Nível ${Math.min(...levels)}–${Math.max(...levels)}</td><td>${l.rivals.length}</td><td>${champion ? champion.name : '—'}</td></tr>`;
        }).join('');

        const rivalryPairs = [];
        leagues.forEach(l => l.rivals.forEach(r => { if (r.rivalOf) rivalryPairs.push(r); }));

        const arenaBossBlocks = arenaBosses.map(b => {
            const allRivals = [];
            leagues.forEach(l => l.rivals.forEach(r => allRivals.push(r)));
            const prereq = allRivals.find(r => r.id === b.unlocksAfterRival);
            const lineageNote = b.lineage
                ? `Representa a Linhagem <strong>${(window.LINEAGES[b.lineage] || {}).name || b.lineage}</strong> — jogadores que já possuem essa Linhagem não podem enfrentá-lo.`
                : '';
            // Item 27 da mega-diretiva ("atualizar o livro de instruções")
            // + item 32 ("mecânica precisa ser legível") — bug de auditoria
            // corrigido nesta iteração: até aqui o Guia só mostrava nome/
            // título/pré-requisito de cada Boss Especial, nunca a mecânica
            // própria dele (Fúria Crescente, Manto de Sombras, Ciclo
            // Lunar, Forja Viva) — o jogador não tinha como aprender o
            // padrão de combate lendo o Guia, só descobrindo na luta.
            // `mechanicName`/`mechanicDescription` (ver enemy.js
            // ARENA_BOSS_DEFS) lidos ao vivo, nunca duplicados aqui.
            const mechanicBlock = b.mechanicName
                ? `<p><strong>Mecânica — ${b.mechanicName}:</strong> ${b.mechanicDescription}</p>`
                : '';
            return `
                <div class="guide-block">
                    <h4>${b.name} — <em style="color:var(--color-marble-dark);">${b.title}</em></h4>
                    <p>Desbloqueado ao derrotar <strong>${prereq ? prereq.name : b.unlocksAfterRival}</strong>. ${lineageNote}</p>
                    ${mechanicBlock}
                </div>
            `;
        }).join('');

        const challengeRows = challenges.map(c => {
            const allRivals = [];
            leagues.forEach(l => l.rivals.forEach(r => allRivals.push(r)));
            const original = allRivals.find(r => r.id === c.challengeOf);
            const originalStyleName = original ? ((window.AI_FIGHTING_STYLES[original.styleId] || {}).name || original.styleId) : '?';
            const challengeStyleName = (window.AI_FIGHTING_STYLES[c.styleId] || {}).name || c.styleId;
            return `<tr><td><strong>${c.name}</strong></td><td>${original ? original.name : c.challengeOf}</td><td>${originalStyleName} → ${challengeStyleName}</td><td>${c.phases.length} fases</td></tr>`;
        }).join('');

        const stageNames = stages.map((s, i) => {
            let name = '?';
            if (s.type === 'rival') {
                const league = leagues.find(l => l.id === s.sourceLeague);
                const rival = league && league.rivals.find(r => r.id === s.sourceId);
                name = rival ? rival.name : s.sourceId;
            } else if (s.type === 'custom') {
                name = s.def.name;
            } else if (s.type === 'arenaBoss') {
                const def = (window.ARENA_BOSS_DEFS || {})[s.sourceId];
                name = def ? def.name : s.sourceId;
            }
            return `<li>${i + 1}. ${name}</li>`;
        }).join('');

        return `
            <p class="guide-section-intro">A Arena é o coração competitivo do jogo: uma sequência de Ligas cada vez mais difíceis, cada uma com lutadores nomeados e um Campeão que testa o que foi aprendido nela. Além da Ladder normal, existem três camadas de conteúdo opcional pra quem já dominou uma Liga.</p>

            <div class="guide-block">
                <h4>Ligas</h4>
                <p>As Ligas seguem sempre a mesma ordem — Bronze, Prata, Ouro, Orc, Élfica, Anã — cada uma continuando a progressão de nível de onde a anterior parou, nunca reiniciando a dificuldade. Vencer todos os lutadores de uma Liga, na ordem, libera a próxima.</p>
                <div class="guide-table-wrap">
                    <table class="guide-table">
                        <thead><tr><th>Liga</th><th>Nível</th><th>Lutadores</th><th>Campeão</th></tr></thead>
                        <tbody>${leagueRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="guide-block">
                <h4>Rivalidades</h4>
                <p>Alguns lutadores reconhecem quando você já derrotou um rival específico deles antes — a batalha começa com uma linha própria de reconhecimento. Não muda a mecânica da luta, só a identidade dela. ${rivalryPairs.length} rivalidades estão registradas atualmente na Ladder.</p>
            </div>

            <div class="guide-block">
                <h4>Bosses Especiais da Arena</h4>
                <p>Desafios opcionais além dos Campeões normais, cada um com uma mecânica de combate própria (nunca apenas mais HP/STR/DEF). Aparecem numa seção separada na tela da Ladder, depois de cumprido o requisito de desbloqueio.</p>
            </div>
            ${arenaBossBlocks}

            <div class="guide-block">
                <h4>Desafios de Campeão</h4>
                <p>Versões "hard mode" opcionais dos Campeões de Liga, desbloqueadas ao derrotá-los na Ladder normal. Nunca é "o mesmo inimigo com mais níveis": cada Desafio troca o estilo de luta principal do Campeão original e adiciona uma fase extra de escalada, representando a evolução da estratégia dele depois da derrota.</p>
                <div class="guide-table-wrap">
                    <table class="guide-table">
                        <thead><tr><th>Desafio</th><th>Campeão original</th><th>Mudança de estilo</th><th>Fases</th></tr></thead>
                        <tbody>${challengeRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="guide-block">
                <h4>Arena dos Campeões</h4>
                <p>Modalidade de endgame, desbloqueada só depois de derrotar os 6 Campeões de Liga. Uma sequência fixa de ${stages.length} adversários, enfrentados um atrás do outro sem retorno ao Hub entre eles — perder qualquer luta encerra a corrida inteira, que precisa recomeçar do início. Vencer cada etapa concede uma cura parcial (nunca total) antes da próxima; completar a sequência inteira dá uma recompensa garantida de alto valor.</p>
                <ol style="padding-left: 1.2em; color: var(--color-marble-dark);">${stageNames}</ol>
            </div>
        `;
    },

    // ==========================================================================
    // SINERGIAS
    // ==========================================================================
    _renderSynergies() {
        return `
            <p class="guide-section-intro">Combinações que valem a pena conhecer — nenhuma é obrigatória, mas todas fazem diferença real na build ou na experiência de jogo.</p>
            <div class="guide-block">
                <h4>Linhagem × Encantamento</h4>
                <p>O encantamento <strong>Sagrado</strong> causa +30% de dano (em vez de +10%) contra alvos de Linhagem Vampirismo ou Sombras — e o <strong>Profano</strong> causa +30% contra alvos de Linhagem Luz. Combinar a arma certa com o inimigo certo (inclusive contra os próprios bosses de Ritual) rende muito mais dano do que o encantamento genérico.</p>
            </div>
            <div class="guide-block">
                <h4>Raça × estilo de build</h4>
                <p>As passivas de raça reforçam caminhos específicos: Espartano e Elfo recompensam lutar arriscado com HP baixo (dano/crítico bônus); Anão e Cretense favorecem builds de sobrevivência (resistência a sangramento, esquiva); Orc combina bem com builds de crítico (rouba HP extra em acertos críticos); Tebano e Ateniense favorecem jogo mais defensivo/tático.</p>
            </div>
            <div class="guide-block">
                <h4>Raça × Cidade de origem</h4>
                <p>Orc e Anão são nativos das montanhas perto da Fortaleza Orc de Gorkhal; Elfo é nativo do Santuário Élfico de Sylvaneth — por isso a Arena dessas cidades tem uma demografia de inimigos fortemente inclinada pra essas raças. Qualquer raça continua jogável desde a Criação de Personagem, sem restrição de origem.</p>
            </div>
            <div class="guide-block">
                <h4>Estilo de luta da IA × Cidade × Item regional</h4>
                <p>Inimigos do estilo Brutamontes gerados na Fortaleza Orc tendem a empunhar o Machado de Guerra Orc ou o Martelo Rúnico Anão; Espadachins e Arqueiros gerados no Santuário Élfico tendem a empunhar a Lâmina Élfica ou o Arco Élfico Longo. Comprar essas armas regionais permite reproduzir a mesma identidade de combate no seu próprio personagem.</p>
            </div>
            <div class="guide-block">
                <h4>Sub-alcance de armas de alcance mínimo</h4>
                <p>Lança e Chicote têm um alcance MÍNIMO (não só máximo): se o oponente estiver mais perto do que esse mínimo, o ataque ainda acerta, mas com 40% menos dano. Vale a pena reabrir distância com Recuar quando possível, mas não é mais uma trava total como já foi um dia.</p>
            </div>
            <div class="guide-block">
                <h4>Ritual da Luz × combate sem magia ofensiva</h4>
                <p>Um dos três requisitos do Ritual da Luz é vencer 5 batalhas sem usar nenhuma magia ofensiva (tipo MAGIC) — ataques físicos, curas e habilidades de sangramento/atordoamento continuam livres de usar sem quebrar esse requisito, então dá pra progredir nele em qualquer build que não dependa de Bola de Fogo/Tempestade Arcana.</p>
            </div>
        `;
    }
};
window.GuideSystem = GuideSystem;
