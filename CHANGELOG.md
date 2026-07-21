# Changelog

## v1.4.1 — "Instinto Selvagem" (cadeia alimentar audível)
- **Predadores geram pressão de caça**: abates por lobo/raposa/jaguatirica
  agora somam à pressão regional (antes, só jogadores) — região com
  predadores ativos deixa a fauna ARISCA de verdade (pânico mais amplo,
  vacas/galinhas em alerta). A cadeia alimentar fecha o ciclo.
- **Uivo de alcateia**: o surto de caça noturno dos lobos agora se OUVE
  (mob.wolf.howl, raro) — o jogador sabe que a alcateia saiu para caçar.
- QA da Memória de Guerra (v1.4.0): integração verificada ponto a ponto
  (tactics/squad/config/menu/devtools) — sem regressões.

## v1.4.0 — "Memória de Guerra" + correção crítica da 1.3.2
### CORREÇÃO CRÍTICA
- **A v1.3.2 estava QUEBRADA**: o `config.js` foi truncado (0 bytes) por
  um erro de ferramenta no bump de versão — todo o núcleo de script
  falhava ao carregar. Arquivo restaurado do histórico; se você instalou
  a 1.3.2, atualize. O build agora REJEITA scripts menores que 100 bytes
  (`tools/build.py`), fechando a lacuna que deixou isso passar
  (`node --check` aceita arquivo vazio).
### Memória de guerra regional (`world/warmind.js`, toggle `combatLearning`)
- **PAVOR**: cada monstro morto por jogador soma 1 ponto na célula de
  64×64 (decai em 1 dia de jogo). Onde você farma mobs, os
  sobreviventes APRENDEM: recuam mais cedo (limiar +5% por nível),
  emboscam com janela dobrada e até os "normais" preferem flanquear a
  marchar de frente.
- **VALOR**: cada jogador morto por monstro soma 2 pontos — vitórias
  deixam os bandos da região audazes (recuam mais tarde).
- Cautela efetiva = pavor − valor (−3..+3), cacheada por cérebro por
  200 ticks (custo por passada ~zero); reutiliza a fábrica `regionmem`
  (zero arquitetura nova). Visível no devtools ("cautela:N") e
  desligável no menu (Combate → "Memória de guerra regional").

## v1.3.2 — "Vozes e Instintos" (inteligência + custo)
- **Diálogos flutuantes**: aldeões FALAM (nameTag temporário ~3 s):
  conversas, fofocas de crime, pôr do sol, chuva, medo, festival e
  trabalho — a inteligência da vila fica audível e legível.
- **Humor → produtividade**: felicidade/estresse entram na decisão de
  trabalhar (vila feliz colhe mais; traumatizada desacelera).
- **Prosperidade com decaimento**: sem comércio/festivais o status cai
  (-1 a cada 2 dias) — manter a vila próspera é jogo contínuo.
- **Ronda de pontos quentes**: crime/perda recente → guarda patrulha a
  cena (casas quebradas primeiro; senão, perímetro).
- **Censo compartilhado (rosterOf)**: ~6 consultas de aldeões por ciclo
  viraram 1 (cache 60 ticks) — custo por vila ~5× menor.

## v1.3.1 — Auditoria da civilização (15 correções)
### Exploits e duplicação
- **Transmutação de comida eliminada**: partilha, presentes e evento de
  nascimento agora só retiram PÃO do celeiro e materializam exatamente o
  que retiraram (antes: 2 trigos viravam 6 pães — gerador infinito).
- **Duplicação na coleta**: stack que só coubesse PARCIALMENTE no baú
  era mantido inteiro no chão; agora o excedente retorna ao chão e o
  drop original some (contabilidade exata).
- **Farm de honra por doação**: só comida/ferro/esmeralda contam, com
  teto de 1 crédito/min — dropar lixo no celeiro não fabrica honra.
- **Item "roubado" da mão do jogador**: a coleta ignora drops com um
  jogador colado (<2,5 blocos).
### Comportamentos irreais
- **Falsa extinção de linhagens**: vila dormente/mundo fechado não
  atualiza lastSeen — o censo agora detecta o "despertar" e renova os
  registros antes de julgar desaparecimentos/heranças.
- **Guarda convocando zumbis**: defensor caçando um fora-da-lei passava
  pelo grito de alerta do bando; agora só MONSTROS gritam/recebem papéis.
- **Guardas evaporando**: removido minecraft:despawn da entidade (pagar
  ferro por guarda que sumia ao sair de perto era dreno de recursos);
  censo pós-hiato ressincroniza sem crônica falsa de "tombou em serviço".
- **Vandalismo injusto**: quebrar o PRÓPRIO baú/porta a 50 blocos do
  centro não é mais crime — só propriedade REGISTRADA da vila (portas
  das casas, o celeiro, camas a <24 do centro).
- **Porta na cara**: o fechamento noturno pula portas com jogador a <3.
- **Reparo predatório**: o construtor nunca sobrescreve blocos que o
  jogador pôs no vão da porta (só repara em espaço vazio) e só cobra a
  madeira DEPOIS do reparo bem-sucedido.
- **Criança perdida para sempre**: se o bebê morre longe, a busca agora
  termina com luto na crônica (a flag não fica órfã).
- **Casamento drenava censo**: a linhagem antiga do cônjuge perde 1
  membro ao unir-se à nova (contagem sem drift).
### Desempenho e decisão
- **Trabalho com prioridade dinâmica**: fome → fazendeiro na frente;
  porta quebrada/fogo → construtor na frente (antes: rodízio cego).
- **Epidemia sem varredura ociosa** (só consulta se houve surto <1 dia);
  **tocha plantada na superfície real** (nunca em caverna/dentro de
  bloco); turnos de guarda só disparam na TRANSIÇÃO (tags, sem churn);
  podas de memória em greet/activeCache; limpeza de código morto.

## v1.3.0 — "Civilização" (as vilas viram sociedades)
Camada nova `scripts/village/` (11 módulos) com escalonador LOD próprio:
1 tarefa de 1 vila por fatia de 10 ticks; vilas sem jogador dormem.
Princípio: ZERO IA falsa — tudo é mecânica real da engine. Detalhes em
`docs/CIVILIZACAO.md`.

- **Personas**: nome+sobrenome visíveis, 5 traços e humor por aldeão.
- **Famílias**: linhagens, luto com efeitos, desaparecidos com busca
  real, herança de casas anunciada na crônica.
- **Casas**: portas descobertas e registradas; FECHAM à noite e em
  lockdown; reparo FÍSICO (blocos repostos) consumindo madeira.
- **Economia**: celeiro = baú REAL; livro-razão espelha o conteúdo;
  coleta de itens do chão; partilha de pão físico (→ disposição
  vanilla → NASCIMENTOS reais); doações testemunhadas dão honra.
- **Profissões trabalham**: colheita/replantio de blocos reais,
  manutenção de defensores, suprimento de guardas, conhecimento que
  PROMOVE guardas, cura de doentes, tochas e combate a incêndio.
- **Honra por jogador/vila**: herói, suspeito e FORA-DA-LEI (guardas
  atacam pela tag neuro_outlaw). Redenção possível.
- **Crime**: testemunhas com linha de visão real, boatos que contagiam
  nas conversas, lockdown, evidência que decai (assassinato: nunca).
- **Guardas** (`neuro:guard`): recrutados com CUSTO do celeiro, turnos
  dia/noite alternados, tiers 2/3 por conhecimento, escolta de crianças
  e visita a gado perdido. Família neuro_defender: integram alarme,
  sino e explosões automaticamente.
- **Vida social**: pares se encaram (setRotation), fofoca visível,
  crianças brincando, pôr do sol, aconchego na chuva, presentes.
- **Eventos**: festival (fogos reais, custo em comida), casamento (o
  cônjuge MUDA de sobrenome), epidemia com contágio e cura clerical,
  criança perdida (busca + honra), criação de gado, caravana com
  memória de emboscada, bandidos raros (opt-in `banditRaids`).
- Crônica ampliada (guardas, festivais, casamentos, nascimentos,
  febres, caravanas); devtools inspeciona persona/humor de aldeões;
  menu Vila com 15 opções.

## v1.2.1 — Revisão de loops + arquitetura em camadas + build
### Corrigido (bugs de repetição/loop)
- **Creeper demolidor nunca explodia (crítico):** `siegeTick` disparava
  `start_exploding_forced` a CADA passada do cérebro (~0,4 s), e
  re-adicionar o grupo `forced_exploding` reseta o pavio de 1,5 s — o
  creeper ficava chiando na base do pilar para sempre. Agora detona UMA
  vez por cerco (`brain.breachFired`, rearmado quando o cerco termina).
- **Menu "não abria" pelo chat (UserBusy):** o comando é digitado no
  chat, e o form tentava abrir com a tela de chat ainda na frente — o
  `show()` voltava cancelado na hora. Novo `showWhenReady`: re-tenta a
  cada 0,5 s até o jogador fechar o chat (teto de 10 s).
### Estrutura (scripts/ em 4 camadas)
- `core/` (config · core · utils) — fundação sem dependências de cima.
- `ai/` (senses · squad · tactics · siege · traits · adaptive) — o
  comportamento dos monstros.
- `world/` (moods · defense · fauna · regionmem · villagemind ·
  wildmind) — o mundo que reage.
- `player/` (ui · fx · stats · welcome · devtools) — tudo que fala com
  o jogador. `main.js` continua como entrada (manifest inalterado);
  imports reescritos e verificados mecanicamente.
### Build
- `tools/build.py` gera o `.mcaddon` pronto para instalar (BP + RP) em
  `build/`, lendo a versão do manifest — nome sempre sincronizado.

## v1.2.0 — "Sentir a IA" (feedback, crônica e onboarding)
A IA sempre esteve lá — agora ela se APRESENTA. Nada de mecânica nova
escondida: esta versão dá som, luz e história ao que já acontecia.

### Feedback audiovisual (novo módulo `fx.js`, toggle `feedbackFx`)
- **Grito de guerra:** o grito de alerta agora se OUVE — a voz do
  próprio mob, mais aguda (zumbi grita como zumbi, bruxa como bruxa) +
  nuvem de raiva. O jogador aprende o vocabulário: grito = bando acordado.
- **Bote da emboscada:** voz aguda + faíscas de acerto crítico no
  emboscador no instante do bote.
- **Retirada tática:** baforada de fumaça ao desengajar — lê-se "foi
  buscar reforço", não "desistiu".
- **Promoção a veterano:** acorde de encantamento + partículas — um
  chefe nasceu (o nome dourado agora tem trilha sonora).
- **Moral quebrada:** faíscas de fogo de artifício sobre o veterano
  morto — recompensa audível por abater o líder.
- **Corneta da vila:** a corneta de raid, baixa, quando o alarme de
  vila dispara (intervalo próprio de 10 s).
- **Aviso de caçada (`huntedIndicator`):** 3+ cérebros no seu rastro
  mostram "§cN caçadores na sua trilha…§r" no action bar — só quando o
  número muda (ou a cada 30 s). Cede a vez ao HUD do modo dev.

### Crônica do mundo (novo módulo `stats.js`, comando `neuro:cronica`)
- Contadores persistentes: gritos, investigações, emboscadas,
  retiradas, cercos, veteranos surgidos/abatidos, alarmes e sinos.
- **Marcos (`milestones`):** totais notáveis anunciados no chat com som
  de conquista (1º/10º/50º veterano abatido, 100º/1000º grito, 25ª
  emboscada). Desligável.
- Gravação preguiçosa: 1 dynamic property, no máximo 1×/30 s e só se
  algo mudou.

### Boas-vindas e novidades (novo módulo `welcome.js`, toggle `welcomeMessages`)
- 1ª entrada no mundo: título "NeuroMobs AI" + guia rápido no chat
  (menu, crônica, ajuda). Pós-atualização: UMA linha com as novidades.
  Estado por jogador (dynamic property), correto em multiplayer.

### Menu por categorias (ui.js reescrito)
- O menu de ~30 botões virou 6 categorias temáticas (Combate, Percepção,
  Mundo vivo, Vila, Feedback, Sistema) com descrição, contagem de opções
  ativas por categoria, estado colorido e navegação com "Voltar".
- Novos comandos: `neuro:cronica` e `neuro:ajuda` (alias `neuro:help`).
- Descrição dos packs (langs) agora ensina o comando do menu já na
  tela de instalação.

### Desempenho
- Tudo orientado a evento sobre gatilhos JÁ existentes; o indicador de
  caçada é o único intervalo novo (1×/80 ticks, percorre só o mapa de
  cérebros ≤ maxTracked). Sons/partículas ausentes degradam em silêncio.

## v1.1.1 — Auditoria de estabilização (produção)
### Corrigido
- **Retirada tática herdando busca antiga (lógico, crítico):** ao entrar
  em retirada com uma busca de memória ativa, `beginRetreat` não limpava
  `searching`/`waypointId`. Se nenhum recruta fosse achado, o waypoint
  antigo — apontando para a ÚLTIMA POSIÇÃO DO JOGADOR — era tratado como
  ponto de encontro: chegar nele contava como "recrutou reforços" e
  mandava o mob ferido de volta ao combate sozinho. A retirada agora
  começa com a busca zerada; sem recruta, vale a fuga pura até o timeout.
- **Recrutamento contando o próprio mob:** em `finishRetreat`, o
  retirante entrava na própria lista de até 5 recrutas (a consulta de
  área inclui quem consulta) — um alerta desperdiçado e duplicado.
- **Velocidade composta em reengajamento (silencioso):** um cérebro
  reidratado (evicção + novo engajamento) que sorteava veterania
  reaplicava TAMBÉM o multiplicador de personalidade já gravado no
  atributo real — ex.: audaz+veterano acumulava ~1,35× em vez de ~1,21×.
  Cada fator agora só é aplicado quando acabou de ser sorteado.
- **Veterania re-sorteada a cada reengajamento (silencioso):** o sorteio
  negativo não era persistido, então cada reidratação do cérebro dava
  nova chance de 5% — mobs longevos convergiam para "todos veteranos".
  O resultado (true OU false) agora persiste em `neuro:vet`.
- **Cérebros criados com o núcleo desligado:** o handler genérico de
  dano (squad) criava cérebros mesmo com `enabled: false`; o escalonador
  não os processava, mas a memória crescia até o teto. Agora há
  checagem de config antes de qualquer criação.
- **Vazamentos lentos de memória:** `roleClock` (relógio de papéis por
  jogador) nunca esquecia jogadores que saíram — limpo no `playerLeave`;
  `deafUntil` (surdez por explosão) só limpava entradas consultadas —
  expurgo periódico no intervalo lento já existente (custo zero novo).
### Refatorado (sem mudança de comportamento)
- `utils.js` ganhou `hasFamily`, `isVillagerLike` e `explosionOrigin`:
  os testes de família com try/catch e a resolução de origem de
  explosão (duplicada em moods/defense) agora têm UMA implementação.
- Filtros de vítima em `defense.js`/`fauna.js` reescritos sobre os
  helpers (menos aninhamento, mesma semântica de degradação graciosa).
- Removido parâmetro morto em `beginRetreat`.

## v1.1.0 — "Kit de Teste + Nether à Vista" + correções do teste em campo
### Correções do PRIMEIRO teste real (obrigado pelo relato!)
- **Waypoints empilhando no jogador (crítico):** audição e carcaça
  criavam o waypoint no local do som/abate — ou seja, no pé de quem
  minera/caça. Nova regra em `startSearch`: **nunca criar waypoint a
  <4 blocos de um jogador** (a memória fica; o waypoint serve para onde
  o jogador ESTEVE) + **dedupe**: waypoints a <3 blocos são reutilizados.
- **Waypoint bloqueando blocos, absorvendo golpes e com sombra:** a
  caixa de colisão caiu de 0,9 para **0,1** — não impede mais colocar
  blocos (pilar liberado), não intercepta ataques e a sombra da engine
  praticamente some. A chegada dos mobs continua funcionando (checagem
  de distância do script + toque).
- **Build anterior falhou no meio** (âncora de versão do main.js
  defasada desde a v0.9 — deriva de string): sincronizado e a lição
  registrada; o pacote testado era a 1.0.1 sem os itens da 1.1.
### Novo módulo `devtools.js` — Kit de Teste
- `/scriptevent neuro:ver` (por jogador): waypoints de busca visíveis
  (colunas de partículas), **inspetor de cérebro no HUD** (tipo,
  personalidade, papel, estados) e **diagnóstico de override** — olhe
  para um monstro: `override:OK` = pack carregado; `override:AUSENTE` =
  outro pack por cima ou versão abaixo do mínimo. Inerte sem ninguém em
  modo dev.
### Novo mob: Esqueleto Wither
- Padrão-clone seguro: Wither no golpe (4 de dano, 10 s), imune a fogo
  (sem desvio de magma), espada de pedra via gear table, e TODOS os
  sistemas neuro; incluído nos conjuntos de cerco e emboscada.
### Adiado com justificativa
- Chefes (Wither/Dragão): fases e boss bar vivem na engine.

## v1.0.1 — Revisão geral da 1.0 (auditoria completa)
### Corrigido
- **Observadora poluindo o bando** (interação v0.7×v0.9): a aranha em
  espreita diurna contava como aliada (quebrando a condição "sozinho"
  das emboscadas), recebia papéis de flanco (fechava a 3–8 blocos
  "neutra") e podia entrar em modo cerco. Novo `isObserver()` com
  checagem VIVA (tipo+horário — um flag dessincronizaria ao anoitecer),
  aplicado em papéis, contagem de aliados, emboscada e cerco.
- **Drowned convertido sem ataque**: o melee vivia num grupo adicionado
  só pelo `entity_spawned`; a conversão zumbi→drowned podia pular esse
  evento. O melee foi para a base do arquivo (a variante tridente segue
  sobrepondo com o ranged).
- **Churn de cérebros na audição/carcaça/investigador**: a checagem de
  alvo agora vem ANTES do `getBrain` — cérebros só nascem para
  candidatos reais, sem pressionar o teto `maxTracked`.
### Documentação (deriva corrigida)
- `CONFIGURACAO.md` reescrito (estava na v0.1: 11 de 29 opções) e
  `ARQUITETURA.md` ganhou o adendo com os 17 módulos atuais.
### Auditoria automatizada (agora parte do build)
- Grafo de imports: **acíclico** · config↔menu: **29 toggles
  sincronizados** (o primeiro "erro" era do próprio auditor: regex
  exigia vírgula na última linha do objeto) · timers de segurança:
  presentes em todos os grupos ligados por script (exceto `daystalk`,
  por projeto — §28) · drowned conversão-seguro: confirmado.

## v1.0.0 — Lançamento: site oficial de documentação
### Site (pasta `site/`, pronto para GitHub Pages)
- `index.html`: instalação em 3 passos, atualização, compatibilidade,
  10 sistemas explicados, os 13 mobs com a melhoria característica de
  cada um, configuração agrupada (todos os toggles), documentação
  técnica resumida, FAQ (7), solução de problemas, roadmap, créditos e
  licença MIT.
- `o-que-mudou.html`: página exclusiva com as comparações
  vanilla ▸ NeuroMobs por sistema, por área (vila/fauna) e mob a mob,
  cenário narrado e guia para o usuário anexar os próprios GIFs/vídeos
  (`site/media/`).
- `styles.css`: identidade própria — paleta caverna/sinapse/tocha
  derivada do pack_icon, tipografia Chakra Petch + Instrument Sans +
  JetBrains Mono (com fallbacks de sistema), e a assinatura: um LOG de
  combate que se revela no herói (CSS puro, respeita
  prefers-reduced-motion). Responsivo, foco visível, sem JavaScript.
- `PUBLICAR.md`: passo a passo do GitHub Pages.
### Revisão (pedida: "revise após")
- Validador próprio rodado sobre as duas páginas: balanceamento de tags,
  11+5 âncoras e 23 links internos/entre páginas — tudo OK; identidade
  checada contra os "defaults de IA" do guia de design (fundo
  azul-caverna em vez de preto, dois acentos com papéis semânticos,
  assinatura no conteúdo e não no efeito).
### Versão
- Packs promovidos a **1.0.0** (mesmo conteúdo da v0.9 + marco de
  lançamento). Etapas restantes do banco de ideias viram pós-1.0.

## v0.9.0 — "Ecossistema Profundo"
### Refatoração sem quebra: `regionmem.js`
- A mecânica de memória regional (células, decaimento por tempo absoluto,
  LRU, persistência) virou uma FÁBRICA genérica; `villagemind.js` agora é
  casca fina por cima — mesma chave ("neuro:villmem"), mesmo formato e
  mesmos parâmetros: mundos existentes mantêm o trauma acumulado
  (verificado por assert no Passe 2).
### Pressão de caça (`huntingPressure`) — novo `wildmind.js`
- Cada animal terrestre ABATIDO POR JOGADOR soma pressão na célula
  (64×64, decaimento de 1 dia de jogo). Em regiões pressionadas a fauna
  fica ARISCA: o pânico de rebanho alcança até 21 blocos e dura até 2×
  mais, e vacas/galinhas passam a EVITAR jogadores por 20 s (grupo
  `neuro:wary`, com as entradas base replicadas — a galinha não perde o
  medo de raposa durante o efeito). Caçar rodando a área não pune;
  exterminar o mesmo pasto, sim.
- O registro de pressão foi desacoplado do cheiro de carcaça: funciona
  mesmo com `carrionScent` desligado (early-returns do fauna.js
  reordenados).
### Descanso noturno (JSON puro, como o kiting — sem toggle)
- À noite, vacas e galinhas andam menos e mais devagar (sensor de horário
  + grupo `neuro:resting`): campos que dormem.
### Revisão em 3 passes
- Passe 1: fábrica para evitar duplicação; pressão só por jogador;
  replicação das entradas do avoid no grupo arisco (lição da v0.5).
- Passe 2: vírgula do config conferida DESTA VEZ na inserção; evidências
  por grep/parser (3 entradas na galinha arisca, chave do villagemind
  intacta, gates do fauna na ordem certa).
- Passe 3: validação completa + prova dentro do .mcaddon.
### Adiado
- Territórios de alcateia e censo populacional: dependem do override do
  lobo (§21) e têm custo ++ — seguem no banco de ideias.

## v0.8.0 — "Aldeias com Memória" (etapa Villagers, sem tocar no villager_v2)
### Novo módulo `villagemind.js`
- **Trauma regional persistente**: células de 64×64 blocos acumulam pontos
  quando aldeões são atacados (+1) ou mortos (+2, "luto"); nível 0–3 com
  decaimento de 3 dias de jogo por TEMPO ABSOLUTO do mundo e teto LRU de
  24 regiões numa única dynamic property.
### Alarme com memória (`villageMemory`)
- Regiões traumatizadas respondem mais forte: golems buscados até
  32→44 blocos, dispersão dos aldeões até 2,5× mais longa e, em nível ≥2,
  os jogadores próximos são avisados no HUD MESMO com golems presentes
  ("a vila está sitiada").
### Golem investigador
- Explosão perto de aldeões manda o golem ocioso mais próximo inspecionar
  o local (waypoint próprio; assinatura separada em defense.js para não
  criar ciclo de import com moods.js).
### Vida social (`villageAmbience`)
- A cada 30 s, um par de aldeões próximos "conversa" (sons vanilla de
  idle/haggle) perto de cada jogador — ambiência a custo de 1 consulta
  por jogador/30 s, tetos de 8 jogadores e 6 aldeões.
### Revisão em 3 passes (pedido do usuário)
- Passe 1 (projeto): ciclo de import moods→defense→senses→moods evitado
  por assinatura própria; decaimento migrado para tempo absoluto (tick de
  sessão zera no reload e corromperia a memória).
- Passe 2 (código): **vírgula ausente no config.js** (mesma família do
  bug da v0.7) pega ANTES da validação; evidências das inserções
  conferidas por inspeção.
- Passe 3 (validação): JSON + Node em 16 módulos, asserts e conferência
  do conteúdo dentro do .mcaddon final.
### Repriorização
- A pedido (sem como testar raids), a etapa "Ilagers" foi movida para
  DEPOIS da v1.0 no roadmap.

## v0.7.0 — "Emboscadas & Terreno"
### Novo módulo `tactics.js`
- **Emboscada coordenada** (`ambush`): corpo a corpo que engaja SOZINHO,
  longe (>8) e sem ser visto SEGURA o bote (congela) enquanto o grito —
  que continua — traz aliados; ataca quando 2+ chegam, ao ser encarado,
  a <6 blocos, ao apanhar ou após 8 s. Audazes e veteranos nunca emboscam.
- **Retirada tática** (`retreat`): ferido abaixo do limiar do perfil
  (cauteloso 40% / normal 30% / audaz 20%) e sem apoio, desengaja, corre
  até o aliado ocioso mais próximo (waypoint) e, ao chegar, RECRUTA: o
  grupo recebe a última posição do jogador e volta junto. Veteranos,
  creepers e endermen nunca recuam.
- **Liderança** (`leadership`): veterano vivo em combate pulsa Velocidade
  no bando (raio 12, a cada 5 s); MATAR o veterano quebra a moral —
  Lentidão no bando e os cautelosos debandam.
### Aranha espreitadora diurna (comportamento JSON, como o kiting)
- De dia a aranha neutra agora SEGUE o jogador a 10–14 blocos (alvo de
  observação com ataque zerado, sem grito/reforço); provocá-la ou o
  anoitecer ligam a hostilidade real.
### Revisão pré-lançamento (4 correções antes de empacotar)
- Retirada sem recruta encerrava em ~1 s (agora persiste os 15 s).
- Aranha espreitadora caía na emboscada (congelava em vez de rondar).
- `targetId` expira junto com a memória (contagens de aliados e a janela
  de re-emboscada voltam a funcionar após o alvo sumir por 30 s).
- `stalk_stop` só dispara para aranhas (menos exceções capturadas).
- **Vírgula ausente no core.js** (introduzida pelo patch dos novos campos
  do cérebro) quebrava TODOS os scripts no carregamento — pega pela
  validação da revisão. O pipeline de build agora aborta e não gera
  pacote se qualquer JSON/JS falhar.

## v0.6.1 — Revisão e conclusão da etapa "Vila Viva"
### Concluído (estava listado como pendente)
- **Postos de patrulha aterrissados:** raycast para baixo encontra o topo
  do solo — sinos ficam pendurados em postes e antes o posto podia flutuar
  ou nascer dentro de parede (o golem rondava até o waypoint expirar).
- **Sino por flecha:** acertar um sino com projétil também dispara o
  alarme tático, como o toque vanilla (`projectileHitBlock`, com guarda).
### Corrigido
- O "giro" do leque de patrulha era um resto de cálculo disfarçado de
  variação leve; agora é intencional e documentado — o leque rotaciona a
  cada toque, cobrindo pontos diferentes do perímetro em toques seguidos.
- `bellRung` aceita origem sem jogador (flecha disparada por dispenser
  não quebra o fluxo; só não há mensagem no HUD).
### Documentado
- LIMITES §27: a tag de resgate `neuro_threat` pode sobreviver a um
  fechamento do mundo dentro da janela de 30 s (o timer de limpeza vive no
  script); efeito benigno — o golem apenas continua priorizando aquele
  monstro até matá-lo.

## v0.6.0 — "Vila Viva"
### Sino tático (`tacticalBell`)
- Badalar qualquer sino mobiliza a vila: aldeões num raio de 32 dispersam
  com Velocidade e até 3 golems entram em caça ampliada E **patrulham em
  leque** — cada um recebe um posto próprio a ~12 blocos do sino (waypoint
  individual). Feedback no HUD de quem badalou. Throttle de 10 s.
- O sino vira ferramenta do jogador: viu um creeper rondando à noite?
  Badale antes que ele chegue.
### Resgate priorizado
- O alarme de vila agora **marca o "sequestrador"** (tag `neuro_threat`,
  expira em 30 s) e o golem ganhou entrada de alvo prioritária para essa
  tag (base 28, alertado 40): ele interrompe a caça ao aldeão ANTES de se
  distrair com qualquer outro monstro.
### Vilas sem golem
- Se o alarme dispara e nenhum golem responde, os JOGADORES num raio de
  48 recebem aviso no HUD ("Aldeões sob ataque nas redondezas!") — em
  multiplayer, a vizinhança inteira fica sabendo. *O "vigia" eleito entre
  aldeões foi adiado: exigiria override do villager_v2 (vetado no §13) ou
  uma entidade nova com modelo próprio (ver LIMITES §26).*
### Adiado
- Economia por eventos: depende de trocar trade tables via override do
  villager_v2 — mesmo veto do §13; segue no banco de ideias.

## v0.5.1 — Revisão de robustez (auditoria completa)
### Corrigido
- **Vazamento de estado (crítico):** os grupos `neuro:stalking`,
  `neuro:flank` e `neuro:siege` não tinham timer de segurança — mobs
  podiam ficar presos para sempre (congelados/circulando) se o cérebro
  fosse despejado ou o script desligado no meio. Agora TODO grupo ligado
  por script tem timer JSON (8/12/15 s) e o script re-sustenta o estado a
  cada passada (lógica por nível, não por borda: autocorrige qualquer
  dessincronização).
- **Busca atropelando combate real:** um monstro lutando com golem ou
  aldeão podia ter a luta interrompida pela busca por um jogador antigo.
  A memória agora respeita combates com alvos não-jogadores.
- **"Wallhack residual" da engine:** `must_see_forget_duration` base caiu
  de 30 s para 12 s nos 10 hostis — a engine desiste rápido e o sistema de
  memória honesta (LOS real + busca) assume, como o design sempre
  documentou. Os grupos `neuro:alerted` mantêm 45–60 s de propósito
  (é o efeito temporário do grito de alerta).
### Verificado sem problemas
- Ciclos de import (acíclico), limpeza de cérebros, throttles de todos os
  eventos, guardas try/catch de APIs opcionais, exclusão de golems dos
  gritos de monstros, famílias e loot tables, sincronia BP↔RP.

## v0.5.0 — "Matilhas & Carcaças"
### Novo módulo `fauna.js`
- **Excitação de alcateia** (`wolfPacks`): lobo atacando ou apanhando faz
  os lobos num raio de 16 arrancarem juntos (Velocidade breve). Somado à
  raiva de bando nativa e ao pânico de rebanho das presas (v0.3), a caçada
  passa a acontecer em GRUPO dos dois lados. *Decisão de engenharia: o
  override completo do lobo (flanquear/papéis) foi avaliado e adiado —
  ver LIMITES §21.*
- **Cheiro de carcaça** (`carrionScent`): morte violenta de um animal
  terrestre atrai até 3 monstros espertos OCIOSOS num raio de 24 para
  investigar o ponto exato do abate (reutiliza o waypoint/busca). Caçar à
  noite tem preço. Água dispersa o cheiro; throttle global de 10 s.
### Proteção de filhotes (`babyGuard`)
- Universal (script): ferir um FILHOTE de qualquer espécie intensifica o
  pânico de rebanho — raio 18 (vs 12), até 10 adultos, Velocidade 2×
  mais longa; o `follow_parent` do bebê o mantém colado nos adultos
  (escolta natural emergente).
- JSON: bebês de vaca (monstros a 12) e de galinha (predadores a 14,
  monstros a 10) fogem mais cedo e mais rápido que os adultos.
### Config/menu
- 3 toggles novos: `wolfPacks`, `carrionScent`, `babyGuard`.

## v0.4.0 — "Personalidade & Clima"
### Novos módulos
- **`traits.js`** — Personalidade individual: no 1º engajamento cada
  monstro sorteia cauteloso (25%) / normal (50%) / audaz (25%), persistido
  na PRÓPRIA entidade (dynamic property): sobrevive a reloads e vale igual
  para todos os jogadores. Efeitos: velocidade −5%/+12%, viés no cerco
  (audaz ataca direto, cauteloso flanqueia) e limiar do creeper furtivo
  (audaz quase não congela; cauteloso congela com um relance).
  **Veteranos**: ~5% (2× na lua cheia) ganham nome "§6Veterano" (nunca
  sobrescreve nomes dados pelo jogador), Resistência I permanente, +8% de
  velocidade, resistência a knockback (grupo `neuro:veteran` injetado nos
  10 hostis) e grito de alerta com raio 1,5×.
- **`moods.js`** — O mundo influencia a IA:
  - **Lua cheia**: raio dos gritos ×1,25; veteranos 2× mais comuns.
  - **Chuva/trovoada**: audição dos mobs cai 50% (furtividade na chuva
    passa a funcionar de verdade).
  - **Virada para trovoada**: frenesi breve nos hostis perto dos jogadores.
  - **Raios**: criaturas num raio de 16 se assustam (rebanhos debandam).
  - **Explosões**: monstros num raio de 10 ficam 5 s surdos — não ouvem
    blocos nem os gritos de alerta.
- **Enxame de abelhas** (`defense.js`): ferir uma abelha enfurece até 6
  vizinhas (tenta os eventos de raiva vanilla; garante ao menos a
  arrancada).
### Integrações
- `squad.js`: traços resolvidos no engajamento; raio do grito considera
  lua e veterania; surdos não ouvem gritos; papéis e creeper com viés de
  personalidade. `senses.js`: audição × clima; surdos não investigam.
- Config/menu: 6 toggles novos (`personalities`, `veterans`, `moonEvents`,
  `weatherMoods`, `blastDeafen`, `beeSwarm`).

## v0.3.0 — Etapa 3 (vila viva + fauna)
### Compatibilidade
- `min_engine_version` reduzido para **1.21.100** (pedido do usuário): tudo
  que o addon usa existe desde 1.20.80/API 2.0.0, então a faixa suportada é
  1.21.100+ até 26.x.
### Novos mobs (3)
- **Golem de ferro**: caça monstros proativamente (raio 24, ignora
  creepers como no vanilla), responde ao alarme da vila sendo DIRECIONADO
  à ameaça via waypoint, reparo com barra de ferro (interact +25),
  imune a knockback, sem despawn; spawn padrão marcado como
  `player_created` (nunca retalia jogadores — ver LIMITES §14).
- **Vaca**: nervosa perto de monstros (fuga proativa), rotas seguras,
  ordenha/reprodução/crescimento/tempt preservados; sem despawn.
- **Galinha**: foge de raposas/gatos/jaguatiricas e de monstros, ovos,
  reprodução e crescimento preservados.
### Novo módulo `defense.js`
- **Alarme de vila** (`villageDefense`): monstro mirando/ferindo aldeão →
  até 3 golems num raio de 32 são alertados e direcionados (waypoint
  compartilhado — reutiliza o sistema de busca, zero duplicação); aldeões
  num raio de 16 dispersam com Velocidade breve.
- **Pânico de rebanho** (`herdPanic`): QUALQUER mob pacífico/neutro ferido
  assusta até 6 vizinhos da mesma espécie (raio 12) — universal, sem
  override, funciona com todos os animais do jogo.
- Ambos 100% orientados a evento com throttle: custo ocioso zero.
### Integrações
- `squad.js`: monstro adquirindo aldeão como alvo agora dispara o alarme
  de vila (antes o evento era ignorado).
- Config/menu: toggles `villageDefense` e `herdPanic`.
### Documentação
- Novo `docs/IDEIAS.md`: ~50 ideias categorizadas (hostis, neutros,
  pacíficos, aldeões, ecossistema, mundo) com dificuldade/perf/prioridade
  e roadmap reordenado por ganho÷custo (v0.4–v1.0).

## v0.2.0 — Etapa 2 (hostis de superfície/caverna + anti-torre)
### Novos mobs (6)
- **Husk**: base do zumbi; não queima de dia, aplica Fome no golpe,
  converte-se em zumbi na água; flanco, cerco, memória e alerta completos.
- **Stray**: base do esqueleto; flechas de lentidão (aux 18), kiting,
  evita o sol ao navegar.
- **Aranha-de-caverna**: veneno no golpe, sempre hostil, escalada, flanco
  e cerco.
- **Drowned**: navegação anfíbia (`navigation.generic` nadar+andar),
  variante com tridente (15%, `thrown_trident`), busca água de dia,
  queima fora d'água; cerco e sistemas neuro completos.
- **Enderman**: agressão por encarar (`minecraft:lookat` com exceção de
  abóbora), teleporte tático nativo (inclui perseguição vertical),
  imune a projéteis, dano por água/chuva; memória/busca; **solitário**
  (não participa dos gritos de alerta).
- **Bruxa** (simplificada): arremessa poções nocivas mantendo distância
  (kiting), memória/busca/alerta.
### Sistema anti-torre (novo módulo `siege.js`)
- Detecção de pilar: alvo 3+ blocos acima e < 6 na horizontal por ~3
  passadas consecutivas do cérebro.
- Corpo a corpo entra em **modo cerco** (circula a 4–9 blocos em vez de se
  amontoar na base); grupos/eventos `neuro:siege` em zumbi, husk, aranhas
  e drowned.
- **Creeper demolidor**: ao encostar na base do pilar, detona o apoio
  (respeita o gamerule mobGriefing). Toggle próprio (`creeperBreach`).
- Esqueletos/bruxas já punem torres atirando; enderman teleporta até o alvo.
### Núcleo
- Config: novas opções `antiTower` e `creeperBreach` (menu atualizado).
- Cérebro: campos `sieging`/`towerTicks`; cerco tem prioridade sobre a
  rotação de papéis; endermen excluídos do broadcast de alerta.

## v0.1.0 — Etapa 1 (fundação)
### Núcleo (scripts, API estável 2.x)
- Registro de cérebros lazy + escalonador com orçamento por tick e teto de
  memória (`budgetPerTick`, `maxTracked`), medição de desempenho embutida.
- Visão realista: cone frontal + raycast de oclusão (`canSee`).
- Memória da última posição vista (janela 1 s–30 s) e busca ativa via
  waypoints invisíveis com autodespawn.
- Alerta em grupo (cooldown 5 s, teto 8 aliados, waypoint compartilhado).
- Papéis de cerco com rotação (~3 s): flanquear ↔ atacar direto.
- Creeper furtivo (congela quando observado).
- Audição: investigação do ponto exato de quebra/colocação de blocos.
- Dificuldade adaptativa (reforços por dificuldade + equipamento do alvo) e
  priorização do jogador mais vulnerável (tag `neuro_prio`).
- Configuração persistente + menu no jogo (`/scriptevent neuro:menu`).
### Entidades
- Overrides: zumbi, esqueleto, creeper, aranha — navegação anti-perigo
  (`avoid_damage_blocks` + `preferred_path` custo 50, quedas ≤ 3 blocos),
  alcance de perseguição ampliado, gatilhos de alvo, grupos `neuro:*` com
  timers de segurança. Kiting do esqueleto; mecânicas vanilla críticas
  preservadas (bebês/drowned/portas, carregado/ignição, escalada/dia).
- Nova entidade `neuro:waypoint` (invisível, autodespawn 25 s) + RP mínimo.
