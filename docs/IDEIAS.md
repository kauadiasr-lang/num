# Banco de Ideias — NeuroMobs AI

Critérios por ideia: **Como funciona** (mecanismo real na Bedrock) ·
**Interesse/Impacto** (por que vale e o que muda no jogo) · **Dif.**
(implementação: B baixa / M média / A alta) · **Perf.** (custo: 0 nulo,
+ leve, ++ moderado) · **Prio.** (baixa/média/ALTA).
Itens marcados ✔ já existem no projeto (v0.1–v0.3); ◐ = parcial.

## 1. Mobs hostis

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| ✔ Memória + busca ativa | Última posição vista + waypoint invisível | Fugir deixa de resetar o combate | M | + | ALTA |
| ✔ Alerta em grupo | Grito → aliados alertados/direcionados | Ninguém luta sozinho; puxar 1 mob vira decisão | M | + | ALTA |
| ✔ Cerco rotativo | move_around_target alternando papéis | Fim da fila indiana; cercam de verdade | M | 0 | ALTA |
| ✔ Anti-torre | Cerco à distância + creeper demolidor | Pilar de 3 blocos deixa de ser "modo deus" | M | 0 | ALTA |
| ✔ Rotas anti-perigo | avoid_damage_blocks + preferred_path | Mobs param de se matar sozinhos | B | 0 | ALTA |
| ◐ Emboscada | Creeper congela quando observado; expandir: mobs em `searching` que avistam o alvo primeiro esperam aliados chegarem antes de atacar (script segura o `neuro:alert`) | Tensão de horror; recompensa atenção do jogador | M | + | ALTA |
| Personalidade individual | 3 perfis sorteados no 1º engajamento (cauteloso/normal/agressivo) alterando velocidade, distância de cerco e chance de flanquear via component groups | Dois zumbis nunca são iguais; imprevisibilidade barata | B | 0 | ALTA |
| Comportamento por horário/lua | environment_sensor (hourly_clock_time) + `world.getMoonPhase()`: lua cheia = raios de alerta +50%, spawns mais ousados | Noites temáticas memoráveis | B | 0 | média |
| Comportamento por clima | `world`? chuva via filtro `is_raining`/`weather_change`: trovoada deixa hostis frenéticos (Speed curto), chuva abafa a audição (raio −50%) | O mundo dita o ritmo do perigo | B | 0 | média |
| Retirada tática | Mob < 30% de vida com 0 aliados vivos foge (avoid_mob_type ativado por grupo) e busca reforços (waypoint até outro cluster) | Inimigos que valorizam a própria vida parecem vivos | M | + | média |
| Cooperação entre espécies | Alerta já é interespécies (família neuro_smart); expandir: papéis por espécie — esqueletos seguram posição elevada enquanto zumbis avançam (script atribui `hold` a ranged em terreno alto via raycast de altura) | Composições de "esquadrão" emergentes | A | + | média |
| Chefes naturais | 1 a cada N spawns vira "veterano": nome, +vida, imune a knockback, sempre agressivo, grito com raio dobrado (component groups + sorteio no spawn) | Mini-chefes orgânicos sem novo mob | B | 0 | ALTA |
| Aprendizado na partida | Contador por jogador (dynamic property): mortes por flecha ↑ → mobs daquele mundo preferem flanquear; mortes corpo a corpo ↑ → mais cautela | O mundo "aprende" seu estilo | A | + | baixa |
| Uso de terreno elevado | Ranged em `searching` prioriza waypoint deslocado para o bloco mais alto num raio de 6 (raycasts amostrados no runJob) | Esqueletos snipando de cornijas | A | ++ | baixa |
| Patrulhas noturnas | 3–5 hostis próximos sem alvo ganham waypoints em anel ao redor do último acampamento do jogador (cama/fogueira detectada por evento de uso) | Pressão constante sem spawn extra | M | + | média |
| Hierarquia | O "veterano" vivo mais próximo vira líder: aliados herdam o alvo dele primeiro (prioridade de brain no script) | Matar o líder desorganiza o bando — alvo tático | M | 0 | média |

## 2. Mobs neutros

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| ✔ Enderman: perseguição vertical | teleport nativo + memória | Pilar não salva de quem teleporta | M | 0 | ALTA |
| Lobos: matilha de caça | Override: alcatéia compartilha alvo (hurt_by_target + alerta interno), flanqueia com move_around_target, uiva (som) ao iniciar caçada | Domesticar lobos vira poder real; lobos selvagens viram ameaça | M | + | ALTA |
| Abelhas: defesa do enxame | Ferir 1 abelha alerta a colmeia (nosso pânico de rebanho invertido: raiva coletiva via evento vanilla `minecraft:become_angry`) | Mexer com abelhas tem consequência | B | 0 | média |
| ✔ Golem: defensor direcionado | Alarme de vila + waypoint | Vila reage como organismo | M | + | ALTA |
| Lhamas: caravana protetora | Já seguem caravana; adicionar: cuspem em predadores que ameaçam o comerciante (nearest_attackable com filtro de família + raio curto) | Escoltas que escoltam de verdade | B | 0 | baixa |
| Golfinhos: escolta lúdica | Seguem barcos (behavior.move_around? follow) e "apontam" tesouros com waypoint quando alimentados | Oceano charmoso e útil | A | + | baixa |
| Pandas/ursos: temperamento | Perfis de personalidade (ver hostis) aplicados: panda brincalhão rola mais, urso-polar mãe tem raio de proteção do filhote dobrado | Fauna com caráter | B | 0 | média |
| Aranhas diurnas espreitando | De dia, neutras porém seguem o jogador a 12+ blocos pelo teto de cavernas (move_around_target largo) até anoitecer | Pavor legítimo de caverna | M | 0 | média |

## 3. Mobs pacíficos

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| ✔ Pânico de rebanho | Ferir 1 → espécie dispersa junto (universal, sem override) | Caçar espanta o rebanho — realismo instantâneo | B | 0 | ALTA |
| ✔ Fuga de predadores | Galinha foge de raposa/gato; nervosismo perto de monstros | Presas agem como presas | B | 0 | ALTA |
| Proteção dos filhotes | Adultos correm PARA o filhote ferido (waypoint no bebê) antes de fugirem juntos; mães ficam entre ameaça e cria (avoid assimétrico) | Cenas emergentes tocantes | M | + | ALTA |
| Rotina dia/noite | environment_sensor: ao anoitecer, speed_multiplier de stroll cai (descanso) e o bando "se junta" (tempt invisível? não — waypoint comum a cada N min) | Campos que dormem | M | + | média |
| Pastagem real | behavior.eat_block (grama) para vacas/ovelhas com regrow | Paisagem viva (cuidado com griefing visual) | B | 0 | baixa |
| Migração leve | 1×/dia lento: rebanho inteiro recebe waypoint a 40–80 blocos num bioma válido (amostragem por runJob) | Mundo que se move sozinho | A | ++ | baixa |
| Abrigo da chuva | Filtro de clima → pacíficos preferem blocos cobertos (preferred_path com custo alto "céu aberto" não existe; aproximação: waypoint sob árvores) | Clima com consequência visível | A | + | baixa |
| Interação entre espécies | Galinhas seguem vacas a pasto (follow "escudo social"); porcos fuçam onde galinhas ciscaram (waypoints encadeados) | Fazendas parecem ecossistema | M | + | baixa |

## 4. Aldeões

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| ✔ Alarme + dispersão | Golems direcionados, aldeões correm | Ataques à vila têm resposta imediata | M | + | ALTA |
| Sino de verdade | Evento de sino (block event/ouvir uso) → TODOS os aldeões num raio ganham Speed e golems patrulham o perímetro (anel de waypoints) | O sino vira ferramenta tática do jogador | M | + | ALTA |
| Investigação de eventos | Aldeão "corajoso" (perfil) investiga explosões/portas quebradas de dia (waypoint), outros evitam a área por 1 dia (memória em dynamic property da vila) | Vila com memória de trauma | A | + | média |
| Reconstrução simbólica | Pós-raid, aldeões "trabalham" em blocos danificados (animação de trabalho + partículas; sem colocar blocos de verdade — griefing reverso é arriscado) | Sensação de recuperação | M | 0 | baixa |
| Economia viva | Preços flutuam por eventos (raid recente = ferreiro paga mais por ferro) via trade tables alternadas por component groups | Comércio deixa de ser estático | A | 0 | média |
| Fofoca visível | Aldeões param em pares trocando "conversa" (look_at + som) perto de quem os salvou; descontos vanilla continuam intactos | Vila socialmente crível | M | 0 | baixa |
| Guarda voluntário | Vila sem golem elege 1 aldeão "vigia" noturno que fica perto do sino e dispara o alarme mais cedo (sensor de monstros maior) | Vilas pequenas se defendem | M | + | média |
| Zombie villager: resgate | Golems priorizam ZUMBIS que carregam alvo aldeão; aldeões trancados não abrem porta com monstro à vista (já nativo, reforçar raio) | Curar aldeões fica viável | M | 0 | média |

## 5. Ecossistema

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| Cadeia alimentar explícita | Matriz predador→presa no script guiando avoid/hunt (raposa>galinha/coelho, lobo>ovelha/raposa, gato>rato?) com fome simulada (caça só a cada N min) | O mundo "acontece" sem o jogador | M | + | ALTA |
| Territórios | Alcatéias/colmeias têm centro (dynamic property); intrusos da mesma espécie são escoltados para fora (avoid dirigido) | Geografia viva | A | + | baixa |
| Equilíbrio populacional | Censo barato por runJob a cada 5 min: excesso de predadores → caçam menos (cooldown maior); excesso de presas → predadores caçam mais | Autorregulação sem despawn artificial | A | ++ | baixa |
| Carcaça atrai | Morte de animal grande deixa waypoint "cheiro" por 60 s que atrai carniceiros (lobos, se famintos) | Cenas de natureza selvagem | B | + | média |
| Influência do jogador | Caçar demais numa área (contador por chunk-região em dynamic property) deixa presas mais ariscas ali por 1 dia (avoid contra o jogador) | Suas ações têm eco | M | + | média |

## 6. Mundo

| Ideia | Como funciona | Interesse / Impacto | Dif. | Perf. | Prio. |
|---|---|---|---|---|---|
| Trovão assusta | weatherChange/thunder: pacíficos dispersam, hostis ganham 5 s de frenesi (Speed) | Tempestades dramáticas | B | 0 | ALTA |
| Chuva abafa sons | hearingRadius efetivo −50% na chuva | Chuva vira janela furtiva PARA o jogador também | B | 0 | ALTA |
| Lua cheia | getMoonPhase(): alertas +50%, veteranos 2× mais comuns | Ritmo mensal de tensão | B | 0 | média |
| Fogo em pânico | Entidade em chamas irradia pânico de rebanho automaticamente (entityHurt cause fire já cobre ◐) | Incêndios com consequência | B | 0 | média |
| Explosões ensurdecem | Pós-explosão, mobs no raio ficam 5 s sem audição/alerta (flag no brain) | Creeper vira ferramenta tática dupla | B | 0 | média |
| Luz importa | Hostis em `searching` preferem waypoints em blocos escuros (amostrar light level? sem API estável de luz por bloco → aproximação por céu/altura) | Furtividade com lanterna faz sentido | A | ++ | baixa |
| Biomas com sotaque | Multiplicadores por bioma (deserto: husks veteranos+; taiga: matilhas maiores) via `dimension.getBiome?`/spawn rules | Identidade regional | M | 0 | média |

## Roadmap reordenado (ganho ÷ custo)

- ✔ **v0.4 — "Personalidade & Clima" (ENTREGUE):** perfis individuais,
  veteranos (chefes naturais), lua cheia, trovão/chuva na audição,
  explosões ensurdecem, abelhas em enxame. *Maior salto de "vida" por
  linha de código do projeto inteiro.*
- ◐ **v0.5 — "Matilhas & Carcaças" (ENTREGUE):** surto de alcateia
  (script), carcaça-cheiro e proteção de filhotes. Override do lobo com
  flanco coordenado adiado (LIMITES §21).
- ◐ **v0.6 — "Vila Viva" (ENTREGUE):** sino tático com patrulha em
  leque, resgate priorizado (tag na ameaça) e alerta a jogadores em vilas
  sem golem. Vigia-aldeão e economia adiados (LIMITES §13/§26).
- ✔ **v0.7 — "Emboscadas & Terreno" (ENTREGUE):** emboscada coordenada,
  retirada com recrutamento, liderança/moral de veteranos e aranhas
  espreitadoras diurnas.
- ✔ **v0.8 — "Aldeias com Memória" (ENTREGUE no lugar de Ilagers, a
  pedido):** trauma regional persistente, luto, golem investigador e vida
  social dos aldeões — tudo sem tocar no villager_v2 (§13).
- ◐ **v0.9 — "Ecossistema Profundo" (ENTREGUE):** pressão de caça
  (fauna arisca regional persistente) e descanso noturno dos rebanhos.
  Territórios e censo adiados (dependem do override do lobo, §21).
- ✔ **v1.0 — Site (GitHub Pages) — ENTREGUE:** início completo +
  página "O que mudou?" (mídia a cargo do usuário — LIMITES §33).
- ✔ **v1.1 — "Kit de Teste + Nether à Vista" (ENTREGUE):** correções do
  teste em campo (waypoints), visão de desenvolvedor com diagnóstico de
  override, e Esqueleto Wither.
- **pós-v1.1 — "Ilagers":** família pillager com bateria de testes de
  raid (exige testes ao vivo do usuário — LIMITES §10/§16).

Regra de ouro mantida: cada item usa sensores/eventos (custo zero ocioso)
ou o escalonador com orçamento — nada de polling por mob.
