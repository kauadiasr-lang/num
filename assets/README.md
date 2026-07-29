# Pipeline de Assets — Arena of Blades

Este diretório é o destino final de todo asset visual (sprites, spritesheets,
ícones, texturas) do pipeline gráfico baseado em sprites (ver `js/spritesystem.js`
para a infraestrutura de carregamento/cache/atlas, e `js/graphics.js` para quem
consome esses assets).

## Por que estas pastas ainda estão vazias (só `.gitkeep`)

Nenhum asset de arte definitivo (PNG/spritesheet produzido por um artista ou
gerador de imagem) existe nesta versão. Em vez de deixar o renderizador
dependente de formas geométricas só porque a arte ainda não chegou, o pipeline
funciona em duas camadas, **hoje**:

1. **`AssetLoader`** (`js/spritesystem.js`) tenta carregar um PNG real do
   caminho esperado (ver tabela abaixo). Se o arquivo não existir (404),
   ele **nunca quebra nem trava o jogo** — cai automaticamente pro passo 2.
2. **`SpriteCache`** gera um placeholder desenhando o visual PROCEDURAL já
   existente (o mesmo código de `graphics.js` que sempre existiu) UMA ÚNICA
   VEZ para cada combinação visual (cor, arquétipo, raça, equipamento...),
   e guarda o resultado como um bitmap (`<canvas>` offscreen) em memória.
   Todos os frames seguintes reaproveitam esse bitmap via `drawImage`, em vez
   de re-executar dezenas de chamadas de `fill`/`stroke`/gradiente por frame.

Ou seja: o placeholder de hoje **já é tecnicamente um sprite** (um bitmap
gerado uma vez e reutilizado, dentro de um atlas em memória) — só que o
CONTEÚDO do bitmap ainda é desenhado por procedimento, não por um artista.
Isso já entrega o ganho de performance real de um pipeline baseado em
sprites (menos draw calls por frame), e deixa o código **pronto** pra trocar
o conteúdo procedural por um PNG de verdade sem nenhuma mudança de lógica —
basta o arquivo aparecer no caminho certo.

## Convenção de nomes e caminhos

Cada categoria abaixo corresponde a uma subpasta. Dentro dela, o nome do
arquivo é sempre o `id` já usado nos registries de dados do jogo (nunca um
nome novo inventado aqui) — assim o asset certo é encontrado automaticamente
por quem já consome aquele id.

| Pasta            | Conteúdo esperado                                             | `id` de origem (registry) |
|-------------------|----------------------------------------------------------------|----------------------------|
| `characters/`     | Partes do corpo do jogador (torso, cabeça, braços, pernas, mãos, pés), por arquétipo | `FIGHTER_ARCHETYPES` (graphics.js) |
| `enemies/`        | Overrides visuais específicos de inimigos nomeados (bosses)     | `BOSS_DEFS` (enemy.js) |
| `races/`          | Adereços/traços visuais por raça (faixa cultural, etc.)         | `RACES` (races.js) |
| `weapons/`        | Sprite de cada arma equipável                                   | `ItemDatabase.weapons` (items.js) |
| `armor/`          | Sprite de peças de peitoral/corpo                                | `ItemDatabase.armors` (items.js) |
| `shields/`        | Sprite de escudos                                                | `ItemDatabase.shields` (items.js) |
| `helmets/`        | Sprite de capacetes/elmos (equipamento de cabeça)                | `ItemDatabase` (slot HEAD) |
| `hair/`           | Cada estilo de cabelo (`hairStyle` 1-15)                         | `_drawHair` (graphics.js) |
| `beards/`         | Cada estilo de barba (`beardStyle` 0-11)                         | `_drawFacialHair` (graphics.js) |
| `ui/`             | Molduras, botões, painéis                                        | `css/style.css` (classes `.panel`, `.btn-*`) |
| `icons/`          | Ícones de habilidade/item/atributo                               | `SkillDB`, `ItemDatabase` |
| `particles/`      | Partículas (poeira, folhas, brasas, faíscas)                     | `Particle` (graphics.js) |
| `effects/`        | Efeitos de impacto/crítico/VFX de habilidade                     | `ImpactBurst` (graphics.js) |
| `projectiles/`    | Flechas/bestas/magias de longo alcance em voo                    | armas com `maxAmmo` (items.js) |
| `backgrounds/`    | Céu, montanhas, coliseu, biomas de arena                         | `ARENA_BIOMES` (graphics.js) |
| `buildings/`      | Prédios da cidade (Ferreiro, Armeiro, Taverna...)                | `city.js` |
| `props/`          | Decoração de solo (pedras, ossos, estandartes...)                | `_prop*` (graphics.js) |
| `decorations/`    | Vegetação, estátuas, elementos ambientais                        | `citydatabase.js` (vegetationTypes, statueColor) |
| `animations/`     | Spritesheets de animação (ver seção abaixo)                      | `computePose` (graphics.js) |

## Spritesheets de animação (quando a arte chegar)

Formato esperado: uma imagem única por (personagem × ação), organizada em
grade de frames iguais, nomeada `<archetype>_<acao>.png`, com um JSON irmão
`<archetype>_<acao>.json` descrevendo `{ frameWidth, frameHeight, frameCount,
fps, loop }`. As ações reservadas (ver `ANIMATION_TYPES` em
`js/spritesystem.js`, espelhando os `anim.type` já usados em `computePose`
de `graphics.js`) são: `idle`, `walk`, `run`, `attack`, `heavy_attack`, `hit`,
`block`, `dodge`, `critical`, `death`, `victory`, `cast`, `charge`, `equip`,
`unequip`.

Até essas imagens existirem, `computePose` continua gerando a pose
proceduralmente (rotação/deslocamento/escala aplicados sobre os bitmaps
baked de cada parte) — o resultado visual de hoje já é produzido pela MESMA
matemática de pose que uma spritesheet real usaria (offset de frame vs.
transform 2D), então trocar para spritesheets no futuro é só passar a
escolher um frame de imagem em vez de calcular a pose, sem mexer no resto do
pipeline de renderização.

## Como adicionar um asset real

1. Solte o arquivo PNG na subpasta certa, com o nome exato do `id` (ex.:
   `assets/weapons/spear.png`).
2. Nada mais precisa mudar no código: `AssetLoader` detecta o arquivo na
   próxima vez que o jogo carrega e passa a usá-lo no lugar do placeholder
   procedural automaticamente, para aquele id específico.
