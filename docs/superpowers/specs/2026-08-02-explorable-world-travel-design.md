# Mundo Explorável: Redesenho do Sistema de Viagem — Design

## Contexto

O sistema atual de viagem manual (`js/roads.js` `RoadSystem` + `js/ui.js` `openRoad`/`advanceRoad`) é um contador de etapas: cada clique em "Avançar" soma um passo e sorteia um evento de uma tabela (emboscada, mercador, baú, segredo, descanso...), mostrado como texto num log. Não há personagem, não há mapa, não há controle do jogador durante o percurso — é um menu disfarçado de viagem, exatamente o problema apontado.

O pedido é substituir isso por um mapa de verdade, com o jogador controlando seu gladiador em tempo real entre cidades, e — confirmado nesta sessão — a câmera seguindo o jogador também dentro das cidades, não só na estrada.

## Descoberta arquitetural chave

A Praça de cada cidade (`js/city.js` `CityEngine`) **já tem um motor de movimento livre real**: clique-para-mover com pathfinding (`_findPath`), WASD/setas (`_handleKey`), colisão (`_collides`), NPCs com posição e alvo próprios, ciclo dia/noite, clima. Isso é o maior ativo reaproveitável do projeto para esta feature — não é preciso construir física de movimento do zero.

Porém, hoje esse motor roda **sem câmera**: o mundo da Praça tem exatamente o tamanho do canvas, e o jogador é travado nas bordas (`Utils.clamp(this.player.x, 30, newW - 30)`). Posições de vegetação/prédios/NPCs são calculadas como frações da largura da tela (`v.xFrac * w`), não coordenadas de mundo independentes da tela. Para a câmera seguir o jogador de verdade (em qualquer lugar, inclusive nas cidades), o mundo precisa ser maior que a tela, e todo o pipeline de desenho precisa passar a trabalhar em coordenadas de mundo com uma transformação de câmera aplicada no momento de desenhar — não mais frações da largura do canvas.

**Resolução da ambiguidade levantada e não respondida diretamente pelo usuário** (o loop autônomo seguiu em frente sem bloquear): o conteúdo das cidades (prédios, NPCs, vegetação) permanece o mesmo de hoje — nenhuma cidade ganha mais coisas para explorar. Só os limites caminháveis da Praça ficam um pouco maiores que a tela (ex: 1.4x a largura), o suficiente para a câmera ter algo real para acompanhar. Se a intenção era cidades fisicamente maiores com mais conteúdo, isso é uma iteração futura separada, não coberta aqui.

## Arquitetura proposta

### 1. Câmera e coordenadas de mundo (novo, `js/camera.js`)

```js
window.Camera = {
    x: 0, y: 0,           // centro da câmera em coordenadas de MUNDO
    follow(entity) { this.x = entity.x; this.y = entity.y; },
    toScreen(worldX, worldY, canvasW, canvasH) {
        return { x: worldX - this.x + canvasW / 2, y: worldY - this.y + canvasH / 2 };
    },
    isVisible(worldX, worldY, canvasW, canvasH, margin = 100) { /* culling */ }
};
```

Todo código de desenho (Praça e Estrada) passa a receber coordenadas de mundo e converter via `Camera.toScreen` no momento de desenhar — nunca mais `v.xFrac * w`. Isso é o núcleo do refactor: hoje inexistente, vira a base de tudo.

### 2. Player Controller compartilhado (extraído de `city.js`, novo `js/playercontroller.js`)

Extrai o que já existe em `CityEngine` (posição, alvo, pathfinding, `_handleKey`, `_collides`, animação de andar) para um módulo genérico que recebe uma função de colisão e um mundo com limites — usado tanto pela Praça quanto pela Estrada. Ganha os novos verbos pedidos: **correr** (multiplicador de velocidade, custa fadiga como o modo "a pé" já custa hoje) e **montaria** (multiplicador maior, reaproveita o desbloqueio de cavalo que já existe em `roads.js` `getHorseCost`/`startRoadJourney` — vira um estado persistente "montado" em vez de só afetar o número de etapas).

### 3. Mundo da Estrada: zonas e biomas (substitui `RoadSystem` quase por completo)

Uma viagem entre duas cidades vira uma sequência de **zonas** com bioma e comprimento (em unidades de mundo), suficiente para render(~5 minutos andando na velocidade base do jogador). Exemplo Porto Helênico → Santuário Élfico:

```
[Campos] → [Bosque] → [Floresta] → [Floresta Profunda] → [Região Élfica]
```

Cada zona tem: paleta (reaproveita `groundColors`/`treelineColor`/`vegetationTypes` já existentes em `citydatabase.js`, estendido com um novo campo por par-de-cidades ou um preset por bioma), densidade de vegetação/props, e um pool de "pontos de interesse" (ver seção 4). A transição entre zonas adjacentes já usa o mesmo princípio de mistura gradual construído nesta sessão (`Utils.lerpColor`, `drawRoadScenery`) — só que agora aplicado a uma faixa de mundo real percorrida a pé, não a uma barra de progresso.

**Geração e performance:** zonas são geradas proceduralmente na primeira vez que o jogador se aproxima (chunks de ~800 unidades de mundo), cacheadas em memória pela sessão, e apenas o chunk atual + vizinhos imediatos são desenhados/simulados — chunks distantes são descartados do desenho (culling via `Camera.isVisible`) e da simulação de NPCs/animais. Isso satisfaz "carregamento progressivo" e "geração inteligente" sem exigir um sistema de assets novo (tudo continua sendo canvas procedural, como o resto do jogo).

### 4. Eventos e encontros como objetos físicos (substitui `_rollEvent`)

Em vez de um roll de dados por etapa, cada zona tem um pool de **objetos de mundo** posicionados nela na geração: carroça quebrada, mercador parado, grupo de bandidos, viajante perdido, gladiador ferido, altar antigo, animal raro, fogueira, acampamento, patrulha. O jogador anda até o objeto e escolhe interagir (tecla de ação) ou seguir andando — nunca um pop-up automático. Inimigos (bandidos, monstros) são entidades que patrulham uma área pequena da zona com IA simples de detecção (raio de visão); o jogador pode atacar (entra na tela de Batalha existente, sem mudança nela), fugir (correr pra fora do raio), contornar (desviar da rota de patrulha) ou ignorar.

Baús/segredos/ouro herdam a lógica já existente de `_rollChest`/eventos de ouro em `roads.js`, só que a "descoberta" agora é o jogador andar até o objeto no mapa, não um roll.

### 5. Missões e Natureza/Corrupção fisicamente no mundo

- Missões de viagem (escoltar, caçar criatura, investigar ruína, proteger caravana) ficam disponíveis só enquanto o jogador está numa zona de Estrada — reaproveita `QuestSystem` já existente, só muda ONDE a missão é oferecida/progride (contato físico com o NPC/objeto da missão, não um quadro).
- O Espírito da Natureza e o monstro da Corrupção (`nature.js`/`corruption.js`, construídos nesta sessão) migram de "evento sorteado ao avançar uma etapa" para uma entidade física fixa dentro da zona "Floresta Profunda" — sempre lá, mas só reage/aparece na primeira visita elegível (mesma regra de `isDiscoveryAvailable`/`isCorruptionEventReady` já existente, só migrando o GATILHO de "sorteio por etapa" para "proximidade física").

### 6. Mundo vivo ambiente

NPCs viajantes, caravanas, animais e patrulhas de guarda existem como entidades autônomas nas zonas de Estrada, com rotas simples (ex: patrulha vai e volta entre dois pontos; caravana atravessa a zona inteira e desaparece ao sair). Não bloqueiam progresso nem precisam de IA sofisticada — são vida ambiente, na mesma linha dos NPCs que já vagam pela Praça hoje.

### 7. O que é substituído vs. o que continua

- **Substituído por completo:** `RoadSystem.advance`/`_rollEvent` (o loop de dados por etapa) e a tela `screen-road` como menu de progresso — viram o mundo explorável.
- **Reaproveitado quase sem mudança:** `_pickBountyTarget`/geração procedural de missões (`QuestFactory`), `NatureSystem`/`CorruptionSystem` (só muda o gatilho), `ItemFactory` para baús, `CityDatabase` (fonte de paletas/vegetação), a tela de Batalha inteira (nenhuma mudança — encontros na Estrada abrem a MESMA batalha de sempre).
- **Viagem Rápida** (`ui.js openCaravan` botão "Viagem Rápida (Xg)", `City.travelToCity`) continua existindo intacta — o pedido não elimina a opção de pular a viagem pra quem só quer chegar rápido, só corrige o que a viagem MANUAL deveria ser.
- **Compat de save:** `player.roadJourney` (formato atual: `{fromId, toId, mode, step, totalSteps, log}`) não existe mais no formato novo — um save no meio de uma viagem antiga precisa ser resolvido na migração (ex: ao carregar, se o formato antigo for detectado, resolve automaticamente a viagem para a cidade de destino sem cobrar passagem, e informa o jogador).

## Testes

Cada camada testável isoladamente via Playwright (mesmo padrão usado a sessão inteira): Camera.toScreen/isVisible com valores conhecidos; PlayerController colisão/velocidade base vs. correndo vs. montado; geração de zona determinística dado um seed; culling (objetos fora do raio da câmera não aparecem no draw call); FPS mantido acima de 60 com N chunks carregados; fluxo completo de uma viagem pequena (cidade A → 1 zona → cidade B) via simulação de input; descoberta da Natureza/Corrupção disparando ao aproximar fisicamente do ponto fixo na zona certa; missão de viagem progredindo por contato físico.

## Entrega faseada (obrigatório dado o tamanho)

1. **Fundação:** `Camera` + `PlayerController` extraído + retrofit da Praça pra usar coordenadas de mundo (sem mudar NENHUM conteúdo da cidade, só o pipeline de desenho) — entregável e testável sozinho: a Praça continua idêntica pro jogador, só que agora via câmera.
2. **Mundo da Estrada mínimo:** uma zona única entre duas cidades (sem sub-biomas ainda), jogador anda de verdade, chega na cidade destino — substitui `RoadSystem` no caminho crítico, sem eventos ainda.
3. **Biomas graduais + zonas múltiplas:** a cadeia completa de zonas com transição de paleta/vegetação por par de cidades.
4. **Eventos físicos + encontros:** objetos de mundo + inimigos patrulhando + integração com Batalha.
5. **Missões de viagem + Natureza/Corrupção físicas.**
6. **Mundo vivo ambiente** (NPCs/caravanas/patrulhas autônomas).
7. **Performance/chunking** sob carga real (múltiplas zonas, muitas entidades).

Cada fase entrega um jogo funcional e testado antes da próxima começar — nunca deixa o jogo quebrado no meio da migração.
