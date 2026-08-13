# Arena of Blades — Memória Técnica

RPG single-player para navegador (desktop/mobile). Vanilla HTML5 Canvas + JS,
**sem build step, sem framework, sem módulos ES**. Todos os arquivos em `js/`
são `<script>` clássicos carregados em ordem fixa por `index.html`, compartilhando
um único escopo global via `window.*`. Não introduza bundlers, TypeScript,
npm/módulos ou qualquer dependência externa — não é assim que este projeto é
construído, e misturar paradigmas no meio do código já existente é pior do
que manter a consistência.

## Como rodar e testar

```
python3 -m http.server 8877 --directory /caminho/do/repo
```

Não há testes automatizados versionados no repo (nenhum framework de teste
instalado). A convenção estabelecida ao longo desta sessão é: scripts
Playwright ad-hoc em `/tmp/pw/*.js` (fora do repo — não commitados), que
dirigem uma sessão real do jogo via Chromium headless
(`executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`),
navegam o fluxo real de criação de personagem até `#screen-hub.active`, e
então usam `page.evaluate` pra inspecionar/chamar `window.Engine`,
`window.City`, `window.BattleEngine`, `window.AICombat` etc. diretamente —
sem mocks, sem test runner. Ver "Procedimento de testes" abaixo para o
checklist mínimo de regressão.

## Arquitetura

### Estrutura de diretórios
- `index.html` — define todas as telas (`#screen-*`) como divs, a ordem de
  carregamento dos scripts (ordem importa — dependências implícitas via
  `window.*`), e o único `<canvas id="game-canvas">` compartilhado por todas
  as telas com renderização.
- `js/*.js` — cada arquivo é um sistema (ver tabela abaixo). Não há
  namespacing por pasta; tudo é `js/<sistema>.js` num diretório só.
- `docs/superpowers/specs/` e `docs/superpowers/plans/` — specs de design e
  planos de implementação já escritos (via as skills `brainstorming` /
  `writing-plans`) para features grandes. Ver `2026-08-02-explorable-world-travel-design.md`
  e os dois planos de "Camera/PlayerController" e "Road World mínimo" — é o
  histórico de design do sistema de viagem atual, leia antes de mexer nele.

### Fluxo principal
`main.js` (`Engine`, `window.Engine`) roda o game loop
(`requestAnimationFrame` → `loop(timestamp)` → `update(dt)` + `draw(ctx)`).
`update(dt)` delega condicionalmente pros subsistemas ativos — cada um
decide sozinho se deve fazer algo (`if (window.City) window.City.update(dt)`,
e dentro do próprio `CityEngine.update` a primeira linha é
`if (!this._isActive() || !this._initialized) return;`). Esse padrão —
"cada sistema se auto-desliga quando não é a tela ativa" — é o que mantém o
loop principal barato mesmo com vários sistemas grandes carregados ao mesmo
tempo; siga-o em qualquer sistema novo (nunca faça o loop principal decidir
"qual tela está ativa" por fora).

`Engine.state` é o único objeto de estado global salvo (`window.SaveManager.save(window.Engine.state)`
é chamado em ~20 pontos diferentes de `ui.js`, sempre serializando o objeto
inteiro). `Engine.state.player` é a fonte de verdade de tudo que precisa
sobreviver a um save — se um dado novo precisa persistir, ele PRECISA morar
dentro de `player` (ou de outro campo direto de `Engine.state`); estado que
vive só em `window.City`/`window.BattleEngine`/`window.RoadEngine` (as
instâncias de motor, não o player) **não é salvo** e é recriado do zero a
cada load.

### Sistemas principais (nome real no código)

| Sistema | Arquivo | Responsabilidade |
|---|---|---|
| `Engine` | `main.js` | Game loop, `state` global, save-state owner |
| `Player`/`Enemy`/`Vampire`/`Ghost`/`Rival` | `player.js`, `enemy.js` | `Entity` base class; stats derivados, equipamento, progressão |
| `BattleSystem` (`window.BattleEngine`) | `battle.js` | Motor de turnos, distância/alcance, dano, um `battle.enemy` **singular** |
| `AICombat` | `ai.js` + `ai_data.js` | Decisão de ação do inimigo em combate (`decideAction`), personalidades/estilos |
| `BossAI` | `bossai.js` | IA dedicada de chefes (Conde Vampiro, Anjo Guardião) |
| `CityEngine` (`window.City`) | `city.js` | Motor da Praça: movimento livre, colisão, NPCs, dia/noite, clima |
| `CityDatabase` | `citydatabase.js` | Registro orientado a dados de cada cidade-hub (clima, demografia, biomas de arena, paleta, reskin/reposição de prédios) — **city.js lê daqui em vez de ter valores fixos por cidade**. 4 cidades hoje: `porto_helenico`, `fortaleza_orc`, `santuario_elfico`, `reino_anao` |
| `CombatStyles`/`Reputation`/`ForgeSystem`/`ElfCrafting`/`OrcTraining`/`RunesSystem`/`DebugMode` | `combatstyles.js`, `reputation.js`, `forge.js`, `elfcrafting.js`, `orctraining.js`, `runes.js`, `debugmode.js` | Sistemas de progressão/economia regional e modo debug — arquivos recentes, ainda não auditados em profundidade nesta passada (ver "Limitações conhecidas" / próximos passos) |
| `Camera` | `camera.js` | Câmera de mundo genérica (`follow`/`toScreen`/`isVisible`), usada por City e Road |
| `PlayerController` | `playercontroller.js` | Movimento/colisão/pathfinding genérico, extraído de city.js, reusado por Road |
| `RoadEngine` (`window.RoadEngine`) | `road.js` | Mundo explorável da Estrada (viagem cidade-a-cidade em tempo real) — **sistema atual e vivo** |
| `RoadSystem` (legado) | `roads.js` | Sistema antigo de viagem por menu (dados-por-etapa) — **só ainda vivo para Expedição à Floresta Ancestral**; ver "Limitações conhecidas" |
| `QuestSystem`/`QuestFactory` | `quests.js` | Missões (únicas via `QUEST_DEFS` + procedurais), orientado a dados |
| `ItemDatabase`/`ItemFactory` | `items.js` | Itens, equipamentos, geração |
| `SkillDB` | `skills.js` | Habilidades (`SKILL_TYPES`: PHYSICAL/MAGIC/HEAL/BLEED/STUN/LIFESTEAL/BUFF/TELEPORT_ENEMY/TELEPORT_FAR/AMMO_RECALL/SHIELD/EVASION/CURSE/IMBUE_WEAPON) |
| `UI` (`window.UI`) | `ui.js` | Maior arquivo do projeto (5300+ linhas) — quase toda a lógica de tela/botão/listener |
| `GuideSystem` | `guide.js` | Guia in-game, lê ao vivo de `CityDatabase`/`SkillDB`/etc. pra nunca ficar desatualizado |
| `SaveSystem` (`window.SaveManager`) | `save.js` | Save multi-slot em LocalStorage, versionado, com migração de formato legado |
| `GraphicsEngine` (`window.GFX`) | `graphics.js` | Renderização (biomas de arena, partículas, dia/noite) |
| `AudioEngine` | `audio.js` | Áudio ambiente procedural |
| Linhagens/Rituais | `lineages.js`, `rituals.js`, `nature.js`, `corruption.js` | Sistemas de progressão alternativa (Vampirismo, Luz, Natureza/Corrupção) |

### Dependências importantes (ordem de carregamento em index.html)
`utils.js` → `camera.js` → `playercontroller.js` → `save.js` → ... →
`citydatabase.js` → `roads.js` → ... → `quests.js` → `player.js` →
`ai_data.js` → `ai.js` → `enemy.js` → `bossai.js` → `battle.js` →
`graphics.js` → `city.js` → `road.js` → `guide.js` → `ui.js` → `mainmenu.js`
→ `main.js`. Um arquivo só pode referenciar `window.X` de algo carregado
**antes** dele; ao adicionar um arquivo novo, insira-o na posição certa
dessa cadeia, não só no fim.

## Convenções

- **Comentários em português**, só explicando o PORQUÊ (bug encontrado,
  decisão de design, invariante não-óbvia) — nunca o quê (o código já diz o
  quê). Muitos comentários citam explicitamente "item X da auditoria de
  balanceamento" / "revisão profunda" — isso é rastreabilidade histórica
  real do projeto, não ruído; preserve esse estilo.
- **Registries orientados a dados**: todo sistema de conteúdo novo
  (Encantamentos, Linhagens, Rituais, Missões, Cidades) segue o mesmo
  padrão — um objeto/tabela de definições (`QUEST_DEFS`, `CityDatabase`,
  `ItemDatabase.weapons`, ...) que o motor itera genericamente, nunca um
  `if (id === 'x')` por entrada. Ao adicionar conteúdo, adicione uma
  entrada na tabela; ao adicionar uma MECÂNICA nova, adicione um campo na
  tabela que os sistemas existentes já sabem ler.
- **`window.X` é a única forma de export/import entre arquivos** — sem
  módulos, sem `require`/`import`. Nomeie globais com o mesmo padrão dos
  existentes (`PascalCase` pra sistemas/classes: `BattleSystem`,
  `QuestSystem`, `RoadEngine`).
- **Defensive fallback pra campos novos em saves antigos**: em vez de
  assumir que um campo sempre existe, o padrão do projeto é
  `p.campoNovo || valorPadrão` ou `if (!p.campoNovo) p.campoNovo = ...` no
  ponto de uso — nunca uma migração de schema completa no momento do load
  (exceto quando o formato mudou estruturalmente, ver `save.js`
  `_migrateLegacySave` e `mainmenu.js` `loadSlotAndEnterHub`).
- **`_isActive()` / gate de tela no início de `update()`**: qualquer sistema
  com estado por-frame deve checar se é a tela atual ativa antes de fazer
  qualquer trabalho, replicando o padrão de `CityEngine.update`/
  `RoadEngine.update`.

## Regras de desenvolvimento

1. **Não reescreva sistemas que já funcionam.** Este projeto passou por
   180+ tarefas de expansão/auditoria — a maior parte do código já foi
   revisada e testada várias vezes. Prefira estender/generalizar a
   substituir.
2. **Sempre teste depois de mudar algo**, usando o padrão Playwright em
   `/tmp/pw/` descrito acima. Não declare uma correção concluída sem rodar
   pelo menos o fluxo afetado de verdade no navegador.
3. **Preserve compatibilidade de save.** Qualquer campo novo em `player`
   precisa de um fallback pra saves que não o têm (ver convenção acima).
   Nunca renomeie um campo salvo sem migração.
4. **Evite hardcoding específico de uma única cidade/inimigo/rota** — use
   `CityDatabase`/tabelas equivalentes. Ver "Limitações conhecidas" para os
   pontos onde isso ainda NÃO é verdade.
5. **Cuidado com o gate de alcance em combate**: `BattleSystem`/`ai.js`
   bloqueiam ATK/SKILL fora do alcance da arma (`enemy.getWeaponRange()` /
   `battle.distance`) ANTES de qualquer outra lógica — testes isolados de
   IA/combate que não respeitam isso produzem falsos resultados (erro
   cometido e corrigido várias vezes ao longo desta sessão). Sempre valide
   `battle.distance` contra `getWeaponRange()` em testes automatizados de
   combate.
6. **Sentinelas de HP/MP**: `Entity.currentHp`/`currentMp` usam `-1` como
   "nunca inicializado" (não `0` — `0` é um estado de combate legítimo,
   "acabou de morrer"). Não reintroduza `0` como sentinela.

## Limitações conhecidas (não corrigidas nesta auditoria — ver relatório)

- **O CONJUNTO de prédios da Praça é fixo (sempre os mesmos 9 ids:
  arena/blacksmith/armorer/tavern/arcane/bank/halloffame/house/questboard)
  em toda cidade** — `city.js` `this.buildings`/`this._defaultBuildings`
  (linha ~141). Nome/ícone/cor/posição (`xFrac`/`rowOffset`) JÁ são
  reskináveis por cidade via `CityDatabase[id].buildingNames`/
  `buildingIcons`/`buildingColors`/`buildingPositions` (mecanismo real,
  usado por `fortaleza_orc`/`santuario_elfico`/`reino_anao` hoje — ver
  `_syncBuildingsToCity` em city.js) — isso já resolve "cada cidade parece
  fisicamente diferente". O que ainda NÃO existe: uma cidade com MAIS ou
  MENOS prédios que as outras, um prédio exclusivo de uma cidade (quartel/
  templo/estábulo/prisão), ou múltiplas lojas do mesmo tipo. O próprio
  código já sinaliza isso como trabalho conhecido e adiado (ver comentário
  em `citydatabase.js` perto de `reino_anao.buildingNames`: "a ARENA e o
  comércio de verdade... ficam pra iterações seguintes"). Generalizar o
  ARRAY em si (permitir tamanho variável) é o próximo passo, não o reskin
  (que já está pronto).
- **Teto de população de NPCs comuns por cidade é uma constante pequena**
  (`city.js` `_spawnNpcsIfNeeded`, `Utils.clamp(4 + nível/2, 4, 14)`) — não
  suporta "dezenas/centenas de NPCs" sem revisão de performance de
  renderização/colisão primeiro.
- **`BattleSystem` assume exatamente um inimigo** (`this.enemy`, singular,
  sem array) — encontros em grupo exigiriam mudança estrutural no motor de
  batalha, não só em `enemy.js`.
- **`Enemy` só existe de verdade dentro de uma `BattleSystem` ativa** — não
  há hoje um conceito de inimigo com posição de MUNDO existindo antes do
  combate começar. Perseguição/detecção no mapa (Estrada ou cidade) precisa
  desse conceito e ainda não existe.
- **Dois sistemas de viagem coexistem por nomes parecidos**: `RoadEngine`
  (`road.js`, sistema atual/vivo pra viagem cidade-a-cidade) e `RoadSystem`
  (`roads.js`, legado) — `RoadSystem` NÃO está morto: ainda é o motor real
  da Expedição à Floresta Ancestral (`ui.js startForestExpedition`) e do
  fallback de migração de saves antigos com `p.roadJourney` no formato
  pré-`RoadEngine`. Cuidado ao ler/alterar um dos dois sem checar o outro —
  os nomes quase idênticos (`RoadEngine` vs `RoadSystem`) já causaram
  confusão em sessões anteriores.

## Decisões arquiteturais

- **Praça e Estrada compartilham `Camera`/`PlayerController`** (extraídos
  nesta linha de trabalho especificamente para isso) em vez de cada tela
  reimplementar movimento/colisão — ver
  `docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md`
  pelo raciocínio completo. Qualquer novo mapa explorável (submapa futuro)
  deve reusar os dois módulos, não duplicar movimento.
- **Nenhum prédio físico muda entre cidades hoje, de propósito** (decisão
  registrada em `citydatabase.js`, cabeçalho do arquivo) — as cidades-hub
  regionais mudam demografia/clima/bioma de arena, não infraestrutura
  civil. Isso foi uma escolha de escopo deliberada da feature "Cidades-Hub
  Regionais", não um bug — mas é exatamente a limitação que bloqueia
  prédios especiais/bairros da capital futura (ver acima).
- **Save serializa `Engine.state` inteiro, sem lista curada de campos** —
  simples e já correto para o que existe hoje (todo estado relevante mora
  em `player`), mas significa que qualquer estado novo precisa ser
  colocado deliberadamente dentro de `player`/`Engine.state` para
  persistir; não há uma camada de serialização separada para esquecer de
  atualizar.

## Expansão de Exploração e Mundo (sistemas adicionados após a auditoria acima)

Conjunto de features pequenas/médias implementadas depois da auditoria
profissional acima, todas em `road.js`/`city.js`/`ui.js`, reaproveitando a
arquitetura existente (nenhum sistema paralelo novo):

- **Perseguição de bandidos na Estrada** (`road.js` `_updateBandits`) —
  máquina de estados real por evento `type: 'bandit'`: patrulha (oscilação
  senoidal em torno de `spawnX`) → alerta (`BANDIT_ALERT_RADIUS: 200`) →
  perseguição (`BANDIT_CHASE_SPEED: 230`, movimento 2D real em direção ao
  jogador) → captura (`BANDIT_DETECT_RADIUS: 75`, dispara
  `UI.onRoadWorldEncounter`) ou desistência
  (`BANDIT_GIVE_UP_RADIUS: 340`/`BANDIT_PATROL_RANGE: 150`). Indicador visual
  de perseguição desenhado à mão, fatorado em `_drawChaseIndicator` pra ser
  reusado por qualquer criatura perseguidora (bandido ou lobo).
- **Guardas de cidade** (`city.js` `_makeGuardEntity`/`_makeGuardEnemy`) —
  spawn por cidade (`_guardsSpawned`, resetado em `travelToCity` e no
  amanhecer), interação de duas etapas (diálogo → provocar → combate) via
  `isGuard` em `_talkToNpc`. Nível/equipamento escala com o jogador
  (mesma semântica de jitter de `Enemy(x)` documentada nas Regras acima).
- **Casas residenciais decorativas** (`city.js` `residentialHouses`) —
  12 silhuetas desenhadas à mão, cacheadas via `SpriteCache`/`RenderManager`
  (bake-once-reuse), preenchendo a margem da Praça já alargada; cortadas do
  desenho via `Camera.isVisible`. Puramente decorativas, sem colisão nem
  interação.
- **Toca dos Lobos** (`road.js` + `roads.js` `WOLF_DEN_ID` + `ui.js`
  `onEnterWolfDen`/`onWolfEncounter`/`_grantWolfDenReward`) — primeiro
  "local explorável" do jogo: uma entrada física (`wolf_den_entrance`,
  ícone próprio) nasce garantida em qualquer travessia que toque a cidade
  natal (`DEFAULT_CITY_ID`). Entrar troca o Mundo da Estrada por um mundo
  curto e temático (**generaliza o padrão de "destino virtual" já usado
  pela Expedição à Floresta Ancestral**, ver `RoadEngine.start`:
  `WORLD_LENGTH` e `_zones` mudam quando `toId` não existe em
  `CityDatabase`, sempre restaurando ao valor default na próxima travessia
  normal via `_defaultWorldLength`). Dentro: 3 lobos comuns + 1 Lobo Alfa,
  ambos reaproveitando 100% de `_updateBandits` (`type: 'bandit'` por
  dentro, só com `isWolf`/`isAlphaWolf` pra desenho/flavor/recompensa —
  zero lógica de perseguição duplicada). Vencer o Alfa concede recompensa
  única na primeira vez (`p.wolfDenAlphaDefeated`, flag simples persistida
  pelo save genérico — sem duplicação salvando/recarregando).
- **Padrão "destino virtual" generalizado**: qualquer local explorável
  futuro que não seja uma cidade-hub de verdade (mina, ruína, submapa) pode
  seguir o mesmo molde — um id que nunca existe em `CityDatabase`,
  reconhecido em `RoadEngine.start` pra montar um mundo à parte, com
  `onRoadWorldArrival` devolvendo o jogador à cidade natal em vez de tentar
  `City.travelToCity` com um id inexistente. Não crie um sistema de
  submapa paralelo — estenda esse mesmo mecanismo.

## Procedimento de testes (regressão mínima antes de considerar uma mudança pronta)

Via Playwright headless (`/tmp/pw/*.js`, ver seção "Como rodar e testar"),
percorrer pelo menos:
1. Carregar `index.html` sem erros de console.
2. Menu principal → novo jogo → criação de personagem → `#screen-hub.active`.
3. Movimento (clique-para-mover) muda `window.City.player.x/y`.
4. `window.Camera.x` acompanha o jogador (não fica fixo).
5. Iniciar combate (`window.UI.startBattle()` ou fluxo de UI real) —
   **gerenciar distância/alcance no loop de teste** (ver regra 5 acima) ou
   o resultado será um falso stall, não um bug real.
6. Vencer/perder uma batalha sem travar (tela volta a um estado válido).
7. Abrir/fechar inventário.
8. `window.SaveManager.save(window.Engine.state)` → reload da página →
   carregar o slot → comparar campos-chave do player antes/depois.
9. Checar `consoleErrors` (listener de `console` tipo `error` +
   `pageerror`) ao longo de todo o fluxo — zero é o esperado.
