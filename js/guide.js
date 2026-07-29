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
        { id: 'skills', label: 'Magias', icon: '🔮' },
        { id: 'enchant', label: 'Encantamentos', icon: '✨' },
        { id: 'lineages', label: 'Linhagens', icon: '🩸' },
        { id: 'cities', label: 'Cidades', icon: '🏛️' },
        { id: 'races', label: 'Raças', icon: '👥' },
        { id: 'bosses', label: 'Bosses', icon: '👑' },
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
            skills: () => this._renderSkills(),
            enchant: () => this._renderEnchant(),
            lineages: () => this._renderLineages(),
            cities: () => this._renderCities(),
            races: () => this._renderRaces(),
            bosses: () => this._renderBosses(),
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
                <p><strong>Fadiga:</strong> acumulada por derrotas ou noites sem dormir, reduz dano físico e esquiva em até 24% (cura no Curandeiro ou com bandagem).</p>
                <p><strong>Peças quebradas:</strong> uma arma/armadura com durabilidade zerada entrega só metade do dano/defesa até ser reparada no Ferreiro/Armeiro.</p>
                <p><strong>Bloqueio de escudo:</strong> reduz o dano já mitigado pela metade, e depende só do equipamento (nenhum atributo contribui diretamente).</p>
            </div>
        `;
    },

    // ==========================================================================
    // MAGIAS E HABILIDADES
    // ==========================================================================
    _renderSkills() {
        const all = Object.values(window.SkillDB || {})
            .filter(s => !s.isBossSkill && !s.isMutationSkill)
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
