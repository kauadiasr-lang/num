# Arena of Blades — Contexto de Sessão (para retomada sem histórico de chat)

> Gerado automaticamente por Claude a pedido do usuário, para permitir retomar o
> trabalho caso esta conversa perca o contexto (compactação, nova sessão, etc).
> Leia este arquivo inteiro antes de continuar qualquer trabalho no projeto.

## 1. O que é este projeto

**Arena of Blades**: RPG de gladiadores em HTML5/Canvas/JavaScript vanilla, **zero
dependências** de runtime (sem frameworks, sem build step, sem bibliotecas
externas — tudo puro JS/CSS/HTML). `index.html` carrega os scripts em ordem de
dependência via `<script>` tags clássicas (não-módulo), então todos os arquivos
`js/*.js` compartilham o MESMO escopo léxico global — uma variável `const X`
declarada em `items.js` é acessível como identificador solto (`X`, não
`window.X`) em qualquer arquivo carregado depois, mesmo sem `window.X = X`
explícito. Isso é usado deliberadamente em vários lugares (ex: `RARITY` em
`ai.js`/`ui.js`).

- **Repo**: `kauadiasr-lang/num`
- **Branch de trabalho**: `claude/arena-of-blades-rpg-7upo4h` (sempre
  desenvolver aqui, nunca em outra branch sem permissão explícita)
- **Sem framework de testes formal** — verificação é feita com scripts
  Playwright ad-hoc escritos a cada mudança (ver seção 6)

## 2. Instruções permanentes vigentes ("Modo Evolução Contínua")

Este é um loop de desenvolvimento contínuo e de longuíssima duração, rodando via
`/loop` (modo dinâmico, sem intervalo fixo — self-paced via `ScheduleWakeup`).
Regras que estão em vigor **o tempo todo**, independente de qual prompt
específico disparou a iteração atual:

1. **Nunca remover funcionalidade existente, nunca simplificar sistemas já
   implementados.** Cada iteração deve ADICIONAR ou CORRIGIR, nunca reverter.
2. **Nunca usar placeholders, sistemas temporários, ou funções vazias.** Tudo
   que for escrito precisa estar 100% funcional e conectado ao resto do jogo.
3. **Nunca quebrar saves antigos.** Todo campo novo em `Player`/`Enemy`/etc
   precisa de fallback defensivo (`this.campo || valorPadrao`), seguindo o
   padrão já estabelecido em todo o código (`this.fatigue || 0`,
   `this.race || 'humano'`, etc).
4. **Nunca piorar performance ou introduzir bugs visuais.** Qualquer código que
   rode a cada frame (`draw()`, `drawArenaBackground()`) NÃO PODE chamar
   `Math.random()`/`Utils.chance()`/`Utils.randomFloat()` diretamente se o
   resultado afetar geometria renderizada — isso causa "flicker" (forma
   mudando 60x/segundo). Padrão correto: gerar aleatoriedade UMA VEZ por
   batalha/estado e cachear (ver `_buildArenaGroundTexture`,
   `_buildMidgroundShapeIfNeeded` em `graphics.js`).
5. **Verificar regressão depois de CADA mudança**, antes de commitar:
   - `node --check <arquivo.js>` em todo arquivo tocado (sintaxe)
   - Um script Playwright dedicado testando especificamente a mudança feita
     (ver seção 6 — padrão de scripts em `/tmp/.../scratchpad/`)
   - `audit_full.js` (regressão completa existente, 3 viewports) — ver seção 6
6. **Ao final de cada iteração**: commit com mensagem detalhada em português
   (ver estilo no `git log`), `git push -u origin
   claude/arena-of-blades-rpg-7upo4h`, atualizar o TaskList (marcar iteração
   atual como completed, criar a próxima como pending), e reagendar o loop
   (ver seção 5 — **cuidado, ver bug conhecido do `ScheduleWakeup`**).
7. **Qualquer pedido explícito e concreto do usuário no meio do loop tem
   prioridade absoluta** sobre o trabalho autodirigido das 10 áreas
   obrigatórias — sempre resolver o pedido do usuário primeiro, totalmente
   verificado, antes de voltar ao loop genérico.
8. **Periodicamente** (a cada ~5-10 iterações, ou quando pedido), zipar o
   projeto inteiro (`zip -r -q arena-of-blades.zip . -x ".git/*"`) e enviar via
   `SendUserFile` — fazer isso proativamente, sem esperar o usuário pedir de
   novo cada vez.
9. **Nunca reverter ou simplificar nenhuma melhoria de iteração anterior.**

### As 10 áreas obrigatórias (para trabalho autodirigido quando não há pedido explícito do usuário)

Mundo, Personagem, Raças, NPCs, Inimigos, Combate, Interface, Arte, Procedural,
Arquitetura. A cada iteração livre, escolher UMA área, fazer uma melhoria real
e bem verificada nela (não superficial), e diversificar entre iterações (não
repetir sempre a mesma área).

### Heurística que tem funcionado muito bem para achar trabalho real

"Grep por uma flag/campo que é setado mas nunca lido" ou "sistema X já existe
mas sistema Y correlato não foi atualizado pra usá-lo" — encontrou bugs reais
como: `pickWeaponFromStyle`/`pickShieldFromStyle` nunca filtravam por região
mesmo a Loja já filtrando (corrigido); `startCityAmbience()` nunca variava por
cidade mesmo tudo mais (visual/clima/raça/economia) já sendo por cidade
(corrigido); armas regionais só apareciam via 10% de chance aleatória, nunca
nos pools curados de estilo (corrigido). Ao escolher a próxima melhoria
autodirigida, considerar procurar esse tipo de inconsistência antes de
inventar uma feature nova do zero.

## 3. O prompt-base do `/loop` atual (repassar EXATAMENTE este texto a cada `ScheduleWakeup`)

O `/loop` foi originalmente disparado com o pedido "Cidades-Hub Regionais"
abaixo. Esse pedido **já foi 100% implementado e verificado duas vezes** (ver
seção 4.1) — reenviá-lo não deve gerar retrabalho, só uma checagem rápida de
regressão antes de seguir para as iterações autodirigidas. O texto exato (que
deve continuar sendo repassado em todo `ScheduleWakeup`/`send_later`, prefixado
com `/loop `, pra reentrar no skill corretamente) é:

```
continue os 100 loops
Atue como um desenvolvedor de jogos sênior e arquiteto de software. Nossa missão é expandir o projeto "Arena of Blades" introduzindo um sistema de Cidades-Hub Regionais. O objetivo é conectar os cenários de batalha procedurais a cidades específicas, criar um sistema de viagem e introduzir novas raças e economias locais.
Durante toda a implementação, siga obrigatoriamente estas regras:
Nunca simplifique uma funcionalidade apenas para terminar mais rápido.
Nunca utilize placeholders, sistemas temporários ou funções vazias. Tudo deve ser implementado de forma funcional e conectado aos arquivos existentes (como CityEngine, items.js, races.js).
Mantenha 100% de compatibilidade com os saves antigos através de fallbacks lógicos.
Implemente as seguintes mecânicas:
Sistema de Múltiplas Cidades (CityDatabase e CityEngine)
Crie um registro de cidades disponíveis (ex: Cidade Humana, Fortaleza Orc, Santuário Élfico). Cada cidade deve ter um ID, nome, descrição, um conjunto de fundos de arena (cenários) vinculados a ela e modificadores climáticos próprios (ex: Santuário Élfico chove mais).
Refatore o gerenciamento do jogador para salvar em qual cidade ele está atualmente.
Quando o jogador entrar na Arena, o cenário sorteado deve pertencer exclusivamente à lista de cenários da cidade atual.
Viagem Rápida e Passagens
Adicione um novo NPC interativo na praça ou um novo menu na cidade chamado "Mestre de Caravanas" (ou "Estábulo").
Este menu deve listar as cidades descobertas/disponíveis e cobrar um valor em Ouro (ticketPrice) para realizar a viagem.
Ao comprar a passagem, a interface deve fazer uma transição, atualizar a cidade atual no save e recarregar os NPCs e o ambiente gráfico para refletir a nova localização.
Expansão de Espécies (races.js e Inimigos)
Adicione as novas raças de Alta Fantasia ao races.js (como Orcs, Elfos, Anões), com seus respectivos bônus de atributos e traços passivos de combate.
Modifique o gerador de inimigos do Duelo Rápido para respeitar a demografia da cidade. Se o jogador estiver na Fortaleza Orc, a vasta maioria dos oponentes gerados deve ser da raça Orc.
Economia e Itens Regionais (items.js e Lojas)
Expanda o banco de dados de itens introduzindo equipamentos completamente novos e exclusivos para as novas regiões (ex: "Lâmina Élfica", "Armadura Pesada Orc").
Adicione uma propriedade aos itens (como region ou cityId) para definir onde eles podem ser encontrados.
Atualize a lógica do Ferreiro e do Armeiro para que eles sorteiem seus estoques diários baseados na cidade atual, vendendo apenas itens neutros e itens específicos daquela cultura.
Por favor, forneça o código arquitetural inicial para o CityDatabase, as alterações necessárias no CityEngine para suportar a mudança de cidades e a lógica da loja para filtrar itens por região.
```

**IMPORTANTE**: o texto do `prompt` passado ao `ScheduleWakeup`/`send_later`
deve ser prefixado com `/loop ` (com o espaço) na frente do texto acima, para
que a próxima invocação reentre corretamente no skill `/loop` e continue o
modo dinâmico. Ex: `/loop continue os 100 loops\n...`.

## 4. Histórico do que já foi construído (visão de altíssimo nível)

Este projeto já passou por MUITAS rodadas de desenvolvimento contínuo antes
desta sessão (loops de 20, depois 50, depois 100 iterações). Sistemas
principais já existentes e funcionais (não reconstruir, só estender):

- Combate por turnos com distância/alcance tático (Aproximar/Recuar/Investida/
  Manter Distância), IA por arquétipo de arma (`ai.js`/`ai_data.js`)
- Sistema de Raridade de itens (`RARITY`: Comum/Incomum/Raro/Épico/Lendário,
  `items.js`)
- Fadiga/ferimento + Curandeiro (Taverna) — cura paga por nível de fadiga
- Ladder de Rivais nomeados (Bronze/Prata/Ouro), Campeões com IA de fases
- Sistema de Conquistas, Hall da Fama
- Save multi-slot (`save.js`), Menu Principal cinematográfico (`mainmenu.js`)
- Munição/armas de longo alcance (slot `RANGED` separado de `MAIN_HAND`)
- Identidade visual completa de gladiadores (arquétipos, cicatrizes, cabelo,
  etc — `graphics.js`), animações de combate
- 10 biomas de arena com solo pré-renderizado em cache (`ARENA_BIOMES`,
  `_buildArenaGroundTexture`)
- Sistema de Encantamentos elementais (armas), separado do sistema de
  Linhagens (mutações permanentes: Vampirismo e Luz totalmente implementadas
  com árvore de skills, ritual de descoberta, boss dedicado; Sombra e Titã
  ainda são só stubs de dados, bloqueados — **não é bug, é intencional**)
- Ciclo dia/noite na Cidade, clima (chuva/tempestade/raio), NPCs com profissão
  e diálogo próprios, vampiros noturnos vagando à noite

### 4.1. Sistema "Cidades-Hub Regionais" (já 100% implementado — NÃO refazer)

Confirmado e reverificado DUAS VEZES nesta sessão (última vez: iteração que
gerou este arquivo) que está tudo funcionando:

- **`js/citydatabase.js`** (arquivo novo): `CityDatabase` com 3 cidades —
  `porto_helenico` (padrão, nível 1, sem custo), `fortaleza_orc` (nível 3,
  120g), `santuario_elfico` (nível 6, 220g). Cada uma com `arenaBiomes`
  (lista de biomas exclusivos), `weather` (rainChance/stormChance),
  `raceDemographics` (distribuição ponderada de raça), `accentColor`.
  Funções globais: `getCurrentCityId()`, `getCurrentCityDef()`,
  `getUnlockedCities(nível)`.
- **`Player.currentCityId`** (player.js) — salvo no save, fallback pro
  `DEFAULT_CITY_ID` se ausente (save antigo).
- **`CityEngine.travelToCity(cityId)`** (city.js) — valida nível/ouro, cobra,
  atualiza `currentCityId`, reseta NPCs/clima/loja, salva, toast de chegada.
  **Também reinicia a trilha ambiente** (ver 4.4 abaixo).
- **Viagem via NPC "Viajante do Portão"** — NÃO é um prédio/Estábulo (foi
  removido a pedido do usuário), é um NPC de verdade parado no vão lateral da
  muralha da cidade (`CityEngine.GATE_XFRAC = 0.965`). Clicar nele abre o
  menu de viagem (`ui.js openCaravan()`/`travelToCity()`).
- **Raças novas** (`races.js`): `orc` (statMods str+3/def+1/int-2, passiva
  `drainOnCritPercent`), `elfo` (agi+2/int+2/str-2, passiva
  `critChanceLowHpBonus`), `anao` (def+3/str+1/agi-2, passiva
  `bleedResistPercent`). Todas com `tagline`/`description`/`passive.label`
  completos, já aparecem automaticamente no seletor de raça da Criação de
  Personagem (que lê `Object.values(window.RACES)` dinamicamente).
- **Demografia racial nos inimigos** (`enemy.js` `Enemy` constructor) — raça
  sorteada via `Utils.weightedPick(cityDef.raceDemographics)` ANTES do nome
  (pra poder escolher pool de nome regional, ver 4.2), com fallback pro
  sorteio uniforme antigo se não houver cidade/demografia.
- **Itens regionais** (`items.js`): `orcwaraxe`/`dwarvenhammer`/
  `orcheavyarmor`/`orcreinforcedshield`/`trolltusk` (região
  `fortaleza_orc`), `elvenblade`/`elvenlongbow`/`elvencloak`/
  `livingforestring` (região `santuario_elfico`). Campo `region` em
  `Equipment` — `ItemFactory.generateShopInventory(nível, cityId)` filtra por
  `!template.region || template.region === cityId`.
- **Loja filtra por cidade** (`ui.js openShop`) — cache de estoque por
  `${title}::${cityId}`.
- **Clima por cidade** (`_updateWeather` em city.js) — lê
  `cityDef.weather.rainChance/stormChance`, fallback 35/30.

### 4.2. Trabalho desta sessão estendida (em ordem cronológica)

Depois do sistema de Cidades-Hub original ter sido concluído (commit
`9983b83` e correlatos), o usuário fez vários pedidos adicionais que foram
todos endereçados:

1. **Changelog de 20/50 iterações** — arquivo gerado a partir do `git log` real
   e enviado via `SendUserFile` (não estava no meio do código, só entregue).
2. **Muralha + floresta + escadaria + Viajante do Portão + fix de NPC
   duplo-clique + andar-até-o-NPC-antes-de-falar** — tudo implementado
   (`city.js`, `graphics.js`). Detalhes:
   - `_drawCityWall`/`_drawCityStairway`/`_drawTreeline` em `graphics.js`
     (backdrop da cidade), altura da muralha reduzida de `horizon*0.4` pra
     `horizon*0.18` após feedback ("muralha grande demais").
   - Bug do "fala 2x + instantâneo": causa raiz era ghost-click residual em
     touch (`touchend` com `{passive:true}` impedia `preventDefault`) somado a
     um NPC próximo completar o ciclo aproximar+falar quase instantaneamente,
     deixando `_pendingTalkNpc` livre pra um ghost-click atrasado iniciar um
     NOVO ciclo. Fix definitivo: guarda por timestamp
     `_lastTouchHandledAt` (janela de 600ms) independente de
     `preventDefault()`, mais o fluxo `_approachAndTalk`/`_updatePendingTalk`
     (jogador anda até 42px do NPC, ambos se viram, só então fala).
3. **Fix: piscar nos biomas "Ruínas Antigas"/"Templo Esquecido"** (commit
   `8c595a9`) — `_drawWalls`/`_drawColumnRow` chamavam `Utils.randomFloat`/
   `chance` DENTRO do draw que roda todo frame; corrigido cacheando a forma
   uma vez por batalha em `_buildMidgroundShapeIfNeeded` (mesmo padrão do
   `_buildArenaGroundTexture`).
4. **Pools de nome regional Orc/Elfo** (commit `6450786`) — `RACE_ENEMY_NAMES`
   em `enemy.js`, raça sorteada ANTES do nome no construtor.
5. **Fix: Coliseu parecendo muralha sólida** (commit `a7d6793`) — usuário
   reportou "a muralha está bugando... tampando o fundo do Coliseu". Achado:
   `_drawColosseumRing` nunca teve vãos de verdade, só um escurecimento leve
   por cima de uma banda sólida — visualmente indistinguível de uma parede.
   Fix: anel externo (heightFrac 0.62) agora pinta vãos em formato de arco com
   a MESMA cor do céu daquele horário (`pal.bottom`), não
   `destination-out` (isso apagaria até a transparência total, mostrando o
   fundo da PÁGINA, não o céu — testado e descartado). Anel interno mantém o
   recesso escurecido original.
6. **Balanceamento de dificuldade** (commit `c07811c`) — usuário relatou:
   itens raros demais em nível 1-3, 37 de dano na primeira luta, espiral
   fadiga→sem ouro→sem poção. Fix:
   - `ItemFactory.generateShopInventory`: rolls de raridade agora
     `Utils.clamp((nível-2)*3, 0, 35)` pra Incomum (0% em nível 1-2, cresce
     devagar) e `Utils.clamp((nível-5)*2, 0, 20)` pra Raro (0% até nível 5).
   - `Enemy.equipStyleWeapon`: chance de Incomum agora
     `Utils.clamp((nível-2)*5, 0, 40)` pra não-Elite (Elite mantém a fórmula
     antiga `15+nível+30`, intencionalmente).
   - Válvula de segurança: botão "Descansar no chão" na Taverna (aparece só
     quando `gold < custoDaCura`), cura 1 nível de fadiga de graça — nunca
     trava o jogador numa espiral sem saída, mas pagar continua sendo
     estritamente melhor quando possível.
   - NÃO mexeu na fórmula de dano bruto (STR*1.5 + arma) — considerado
     proporcional ao HP máximo (~135 no nível 1), o problema real era a
     economia ao redor, não o dano em si.
7. **Legenda de raridade na loja** (commit `b6dda38`) — `UI._buildRarityLegend()`
   gera dinamicamente a partir do registry `RARITY`.
8. **Aviso de nível na Ladder** (commit `1d9ce32`) — card de rival mostra
   "⚠️ N níveis acima de você" quando `rivalDef.level - p.level >= 4`.
9. **Trilha ambiente por cidade** (commit `9f4f6f2`) — `CITY_MUSIC_MOODS` em
   `audio.js` (default/fortaleza_orc/santuario_elfico), `startCityAmbience()`
   agora passa o mood da cidade atual. Bug encontrado e corrigido no processo:
   `travelToCity` nunca parava/recomeçava a ambiência, então o mood da cidade
   ANTERIOR tocaria pra sempre depois de viajar — corrigido com
   `stopCityAmbience()+startCityAmbience()` explícitos em `travelToCity`.
10. **Fix: armas/escudos regionais na IA** (commit `96ffd4b`) — achado por
    auditoria: `AICombat.pickWeaponFromStyle`/`pickShieldFromStyle` nunca
    filtravam por região (a Loja já filtrava desde sempre). Um Orc podia
    nascer com a Lâmina Élfica. Corrigido com o mesmo filtro
    `!item.region || item.region === cityId`.
11. **Mais falas regionais NPC** (commit `64d4878`) — pools de
    Fortaleza Orc/Santuário Élfico tinham só 3 linhas (vs 7 do genérico),
    expandido pra 7 cada.
12. **Armas regionais nos pools curados de estilo** (commit `8fa7965`) —
    complemento do item 10: mesmo já filtradas corretamente, as armas
    regionais só apareciam via 10% de "escape roll"; agora fazem parte do
    `weaponPool` de Brutamontes (orc/anão)/Arqueiro (élfico)/Espadachim
    (élfico), aparecendo com frequência comparável às armas universais na
    cidade certa.

### 4.3. Bug conhecido de agendamento (`ScheduleWakeup`) — IMPORTANTE

Em algum momento desta sessão, um `ScheduleWakeup` (delay 120s) **silenciosamente
não disparou** — ~49 minutos de silêncio confirmados comparando o horário
prometido com `date -u`. O usuário reportou "o /loop não está funcionando" e
isso foi confirmado como real (não confusão do usuário).

**Mitigação em vigor desde então**: a cada iteração, além do `ScheduleWakeup`
normal, também arma-se um **`send_later`** (MCP `Claude_Code_Remote`) redundante
com o MESMO prompt, delay de 2 minutos, e confirma-se o `trigger_id` retornado
via `list_triggers` antes de seguir. O `send_later` já se mostrou confiável
(disparou no horário exato pelo menos duas vezes seguidas desde então).
**Continuar armando os dois em paralelo** a cada iteração até novo aviso —
nunca confiar SÓ no `ScheduleWakeup` sozinho de novo.

Padrão exato usado (repetir a cada iteração):
```
mcp__Claude_Code_Remote__send_later({ message: "/loop " + <prompt completo>, delay_minutes: 2 })
// confirmar com mcp__Claude_Code_Remote__list_triggers() se necessário
ScheduleWakeup({ delaySeconds: 120, reason: "...", prompt: "/loop " + <prompt completo> })
```

## 5. Estado atual do TaskList (contador de iterações)

Ver `TaskList` para o estado vivo, mas na geração deste arquivo: iterações
1-9 do loop de 100 concluídas e commitadas (mais os bugs/pedidos explícitos do
usuário intercalados, listados na seção 4.2). A tarefa "iteração 10/100" foi
criada e está pendente/em andamento. **Sempre conferir o TaskList real antes
de assumir o número da iteração** — este arquivo pode ficar desatualizado se
o loop continuar depois de ser escrito.

Convenção de nomes de task: `Evolução Contínua 100x: iteração N/100`, mais
tasks avulsas pra bugs/pedidos explícitos do usuário (ex: `Fix: muralha
bugando...`, `Balance: raridade de itens...`).

## 6. Como verificar mudanças (metodologia usada em TODA iteração)

```bash
# 1. Sintaxe de todo arquivo tocado
node --check js/<arquivo>.js

# 2. Servidor local (pode ter caído entre turnos — sempre checar antes)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8877/index.html
# se não for 200, subir de novo:
cd /home/user/num && python3 -m http.server 8877 &   # (usar run_in_background:true no Bash tool)

# 3. Script Playwright dedicado pra mudança específica — escrever em
/tmp/claude-0/-home-user-num/0d8d9a60-a965-55c6-a147-f74a2bdba38c/scratchpad/
# (NOTA: esse caminho é específico desta sessão/UUID; numa sessão nova o
# caminho do scratchpad será diferente — usar o que o system prompt indicar)
# Executar com:
NODE_PATH=/opt/node22/lib/node_modules node /tmp/.../scratchpad/verify_XXX.js
# Chromium fica em: /opt/pw-browsers/chromium-1194/chrome-linux/chrome

# 4. Regressão completa (já existe, script raiz salvo em scratchpad):
NODE_PATH=/opt/node22/lib/node_modules node /tmp/.../scratchpad/audit_full.js
# Testa 3 viewports (mobile_portrait 390x844, mobile_landscape 844x390,
# small_desktop 1024x640): cria personagem, compra/equipa item, luta 3
# batalhas, salva/carrega, checa overflow horizontal e ZERO erros de console.
```

Fluxo de personagem usado nos scripts de teste (sempre igual):
`#btn-start` → `#btn-mm-newgame` → aguardar `#screen-saveslots.active` →
`.save-slot-card.empty button[data-action="create"]` → aguardar
`#screen-creation.active` → preencher `#char-name` → clicar `.btn-add` várias
vezes (pontos de atributo) → `#btn-finish-creation` → aguardar
`#screen-hub.active`.

Globais expostos em `window` úteis pra testar via `page.evaluate`:
`window.Engine.state.player`, `window.GFX` (GraphicsEngine), `window.City`
(CityEngine), `window.UI`, `window.AudioManager`, `window.BattleEngine`,
`window.CityDatabase`, `window.RACES`, `window.ItemDatabase`/`ItemFactory`,
`RARITY`/`SLOTS` (identificadores soltos, ver seção 1), `Enemy`/`Player`/
`BattleSystem` (classes, também soltas).

## 7. Convenção de commit (seguir sempre)

Mensagem em português, formato `tipo(área): resumo curto`
(`fix`/`feat`/`balance`), corpo explicando a causa raiz e o que foi mudado,
seção final "Verificado:" listando os testes rodados, terminando com:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017tdotmmfgQ4soxt7mGxXSE
```

Depois: `git push -u origin claude/arena-of-blades-rpg-7upo4h`.

## 8. Como retomar se este arquivo for a única fonte de contexto

1. Ler este arquivo inteiro.
2. `cd /home/user/num && git log --oneline -20` pra confirmar o commit mais
   recente e conferir se bate com a seção 4.2 (se houver commits mais novos
   não listados aqui, ler as mensagens deles pra atualizar o entendimento).
3. Checar `TaskList` pra saber em que iteração o loop parou.
4. Subir o servidor local (seção 6) e rodar `audit_full.js` pra confirmar que
   está tudo verde antes de continuar.
5. Se houver uma mensagem de usuário pendente/recente pedindo algo específico,
   resolver isso primeiro (prioridade sobre o loop genérico — regra 7 da
   seção 2).
6. Caso contrário, continuar a próxima iteração do loop: escolher uma das 10
   áreas obrigatórias (seção 2), implementar algo real, verificar (seção 6),
   commitar (seção 7), atualizar TaskList, reagendar com AMBOS
   `ScheduleWakeup` E `send_later` (seção 4.3), repassando o prompt completo
   da seção 3 prefixado com `/loop `.
