# Arquitetura do NeuroMobs AI

> Alvo: Minecraft Bedrock **26.20+** (motor `1.26.20+`), Script API **estável**
> (`@minecraft/server` 2.x, `@minecraft/server-ui` 2.x). Nenhum toggle
> experimental é necessário — compatível com Survival, multiplayer e Realms.

## 1. Princípio de projeto: arquitetura híbrida

Na Bedrock Edition **o pathfinder nativo não pode ser substituído por
scripts** — não existe API estável para calcular ou impor rotas arbitrárias a
um mob. O que a plataforma oferece são duas alavancas complementares:

1. **JSON de entidade (Behavior Pack)** — controla o pathfinder e os goals
   nativos: parâmetros de navegação (`avoid_damage_blocks`, `avoid_sun`,
   custos de `minecraft:preferred_path`), seleção de alvos, sensores e
   `component_groups` que podem ser ligados/desligados por eventos.
2. **Script API** — percepção customizada (raycast, cone de visão), memória,
   comunicação entre entidades, decisões de grupo e configuração — coisas que
   o JSON sozinho não expressa.

O NeuroMobs usa as duas: **o script decide, o JSON executa.** A ponte entre
os dois mundos é o sistema de eventos:

```
        (JSON -> script)                       (script -> JSON)
minecraft:on_target_acquired  ─┐        entity.triggerEvent("neuro:alert")
minecraft:on_target_escape     ├─► world.afterEvents            │
sensores/dano                 ─┘   .dataDrivenEntityTrigger     ▼
                                        │              evento adiciona/remove
                                        ▼              component_groups
                                  cérebro decide       (perseguir sem visão,
                                                        buscar waypoint,
                                                        flanquear, congelar…)
```

## 2. Camadas

```
┌────────────────────────────────────────────────────────────┐
│ UI / Config (ui.js, config.js)                             │
│  /scriptevent neuro:menu · dynamic properties persistentes │
├────────────────────────────────────────────────────────────┤
│ Sistemas de decisão                                        │
│  senses.js  → visão real (cone+raycast), memória, busca    │
│  squad.js   → alerta em grupo, papéis (cerco), creeper     │
│  adaptive.js→ reforços por ameaça, tag de prioridade       │
├────────────────────────────────────────────────────────────┤
│ Núcleo (core.js)                                           │
│  registro de cérebros (lazy) + escalonador com orçamento   │
├────────────────────────────────────────────────────────────┤
│ Overrides de entidade (entities/*.json)                    │
│  navegação anti-perigo, alcance, grupos neuro:*, eventos   │
└────────────────────────────────────────────────────────────┘
```

### 2.1 Núcleo (`core.js`)

* **Cérebro**: objeto leve (`targetId`, `lastKnown`, `lastSeenTick`,
  `searching`, `waypointId`, `role`, `frozen`, cooldowns) criado **apenas
  quando o mob engaja** — mobs ociosos custam zero.
* **Escalonador**: a cada tick processa no máximo `budgetPerTick` cérebros em
  rodízio. O custo por tick é **constante** e configurável; `maxTracked`
  limita a memória total (despejo do mais antigo). `perf` mede ms por tick
  (visível em `/scriptevent neuro:stats`).

### 2.2 Sentidos e memória (`senses.js`)

* `canSee()`: distância → cone frontal (produto escalar do olhar) → raycast
  de oclusão (`getBlockFromRay`). É a **visão realista** usada em todas as
  decisões de script — nada de detectar através de paredes.
* **Memória**: enquanto há visão, grava a posição do alvo. Ao perder o alvo
  (evento `on_target_escape` ou alvo saindo do alcance), abre-se uma janela
  de 1 s–30 s de memória.
* **Busca ativa**: dentro da janela, o script invoca `neuro:waypoint` — uma
  entidade **invisível, sem colisão, imune e com autodespawn (25 s)** — na
  última posição conhecida e liga o grupo `neuro:searching`, cujo
  `nearest_attackable_target` mira **apenas** a família `neuro_waypoint`.
  O pathfinder nativo então leva o mob até lá com toda a lógica de rota.
  Chegando (toque no waypoint dispara o `damage_sensor` dele, ou o script
  detecta distância < 2), a busca termina. Se durante o trajeto o script
  **reavistar o jogador por LOS real**, reengaja na hora (`neuro:alert`).
  Importante: durante a busca o grupo substitui a seleção de alvos, evitando
  o efeito "wallhack" de um `must_see: false` permanente.
* **Audição**: quebrar/colocar blocos gera um ruído; até 4 mobs `neuro_smart`
  ociosos num raio configurável vão **investigar o ponto exato**
  (compartilhando um único waypoint — barato).

### 2.3 Esquadrão (`squad.js`)

* **Alerta em grupo**: ao adquirir um jogador, o mob "grita" (cooldown 5 s,
  teto de 8 aliados por grito). Aliados recebem `neuro:alert` — 15 s de
  perseguição com `must_see:false` e alcance ampliado — e, se não têm visão,
  partilham um waypoint até a posição do alvo.
* **Cerco**: com `flankMinPack`+ mobs no mesmo jogador, metade recebe o papel
  `flank` (grupo com `minecraft:behavior.move_around_target`: circundam o
  alvo) e metade `direct`. Os papéis **giram a cada ~3 s**, produzindo o
  padrão emergente *cercar → atacar por outro ângulo* em vez da fila indiana
  vanilla.
* **Creeper furtivo**: se o jogador está olhando na direção do creeper a
  média distância, o script congela o creeper (`neuro:freeze`, grupo que
  reduz `minecraft:movement` a 0,05); quando o jogador desvia o olhar, ele
  volta a avançar.

### 2.4 Adaptativo (`adaptive.js`)

* **Reforço por ameaça**: no engajamento, mede armadura + vida do alvo e a
  dificuldade do mundo. Alvos bem equipados enfrentam mobs com Velocidade
  (e Resistência no Difícil); iniciantes não são punidos.
* **Priorização de alvo**: a cada 10 s o jogador mais vulnerável de cada
  dimensão recebe a tag `neuro_prio`. Nos overrides, o primeiro filtro do
  `nearest_attackable_target` é exatamente essa tag — a matilha troca de alvo
  para o elo mais fraco.

### 2.5 Overrides de entidade (o que o JSON garante)

Comum aos quatro mobs da onda 1:

* `minecraft:navigation.*` com `avoid_damage_blocks: true` (lava, fogo,
  magma…) e `minecraft:preferred_path` com **custo 50** para magma, cacto,
  arbusto de bagas, fogueiras e rosa-do-wither + `max_fall_blocks: 3`
  (respeito a precipícios).
* `follow_range` ampliado (perseguição longa) e `must_see_forget_duration`
  maior (não "esquecem" em 3 s).
* Entrada prioritária de alvo para a tag `neuro_prio`.
* Grupos `neuro:alerted`, `neuro:searching` (+ `neuro:flank` nos corpo a
  corpo) com **timers de segurança** que se auto-removem — nenhum estado
  fica preso se o script for desativado.
* Gatilhos `minecraft:on_target_acquired/escape` alimentando o script.

Específicos: esqueleto **recua atirando** (kiting via `avoid_mob_type` a
< 4 blocos) e evita o sol ao navegar; zumbi preserva bebês, conversão para
drowned e quebra de portas no Difícil; creeper preserva carregado por raio e
ignição manual; aranha preserva escalada, salto e neutralidade diurna.

## 3. Estrutura de pastas

```
NeuroMobs_BP/
├── manifest.json            (data + script, deps @minecraft/server[-ui] 2.x)
├── pack_icon.png
├── entities/                zombie · skeleton · creeper · spider · waypoint
├── loot_tables/entities/    neuro_skeleton_gear.json (arco garantido)
├── scripts/                 main · core · senses · squad · adaptive
│                            config · ui · utils
└── texts/                   en_US · pt_BR
NeuroMobs_RP/
├── manifest.json
├── entity/ models/ textures/   waypoint invisível (geometria sem cubos)
└── texts/
```

## 4. Convenções

| Item | Valor |
|---|---|
| Namespace | `neuro:` (eventos, entidade, scriptevents, dynamic property) |
| Família dos mobs inteligentes | `neuro_smart` |
| Família do waypoint | `neuro_waypoint` |
| Tag de prioridade em jogadores | `neuro_prio` |
| Config persistida | dynamic property `neuro:cfg` (JSON) |

## 5. Receita para adicionar um mob (ondas futuras)

1. Copiar o override mais próximo (corpo a corpo → zumbi; à distância →
   esqueleto) e ajustar identifier, famílias (mantendo `neuro_smart`),
   atributos e loot.
2. Manter os componentes `on_target_acquired/escape` e os grupos/eventos
   `neuro:*` — o script reconhece o mob automaticamente pela família.
3. Preservar mecânicas vanilla específicas (transformações, variantes,
   interações) no próprio arquivo.
4. Registrar o mob em `docs/O-QUE-MUDOU.md` e no `CHANGELOG.md`.


## Adendo v1.0 — módulos atuais (17)

O documento acima descreve o núcleo (camadas, ponte JSON↔script,
waypoints, modelo de desempenho) — tudo segue válido. Os sistemas das
etapas v0.2–v0.9 plugam nesse mesmo núcleo, via escalonador ou eventos:

`main` (bootstrap) · `core` (cérebros + escalonador) · `config` · `ui` ·
`utils` · `senses` (visão/memória/busca/audição) · `squad` (alerta,
papéis, observadora, aura) · `siege` (anti-torre) · `defense` (vila:
alarme, sino, resgate, investigador, luto, vida social, pânico de
rebanho) · `moods` (lua/clima/raios/explosões) · `traits`
(personalidades/veteranos) · `fauna` (alcateias, carcaça, pressão) ·
`tactics` (emboscada, retirada, moral) · `adaptive` (reforços +
prioridade de alvo) · `regionmem` (fábrica de memória regional) ·
`villagemind` (trauma de vila) · `wildmind` (pressão de caça).
