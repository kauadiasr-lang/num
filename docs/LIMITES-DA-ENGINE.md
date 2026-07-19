# Limites da engine (e escolhas honestas do projeto)

**Por que não "500%" literal?** Inteligência não tem unidade de medida; o que
este addon faz é maximizar cada alavanca que a Bedrock realmente expõe.

1. **Pathfinding é do motor.** Não há API estável para substituir ou guiar o
   pathfinder passo a passo. Melhoramos rotas pelos canais oficiais:
   parâmetros de navegação, custos de `preferred_path`, e o truque do
   waypoint (dar ao pathfinder um destino que nós escolhemos).
2. **Não existe `setTarget()` em script.** Direcionamos alvos via component
   groups + filtros (famílias, tag `neuro_prio`) — por isso os mobs precisam
   de override.
3. **Overrides substituem o arquivo vanilla inteiro.** Consequências:
   - Outro addon que modifique os *mesmos* mobs conflita (vence o pack de
     cima na lista).
   - Reimplementamos o essencial de cada mob; a v0.1 abre mão de detalhes
     menores, documentados: zumbi não pega itens do chão nem invoca reforços
     ao ser atingido (o alerta do NeuroMobs cumpre esse papel, melhor);
     sem jockeys (galinha/aranha) por enquanto; esqueleto sempre com arco;
     neutralidade diurna da aranha aproximada por horário (11000 ticks), não
     por luminosidade.
4. **Waypoints são entidades reais** — invisíveis, sem colisão, imunes a
   empurrão/fogo e com autodespawn em 25 s; aparecem em `/kill @e` e
   contadores de entidades (nome: `neuro:waypoint`).
5. **APIs estáveis apenas.** Nada de módulos beta: é o que garante Realms e
   atualizações do jogo sem quebrar. Quando algo só existe em beta, ficamos
   sem — e anotamos no roadmap.
6. **Segurança de estado.** Todo grupo ligado por script tem timer de
   auto-remoção no JSON: se o script for desativado no meio de um combate,
   nenhum mob fica "preso" alerta/buscando para sempre.

## Notas da Etapa 2

7. **Valores auxiliares de projéteis.** A flecha de lentidão do stray usa
   `aux_val: 18` e a poção da bruxa `aux_val: 23` — são os IDs consagrados
   pela comunidade, mas a Mojang não os documenta formalmente; se numa
   versão futura o efeito sair errado, é um número a ajustar no JSON.
8. **Bruxa simplificada.** `minecraft:behavior.drink_potion` e a seleção
   situacional de poções têm schema extenso e frágil; a v0.2 entrega a
   bruxa como artilheira de poções com kiting e adia o resto.
9. **Enderman sem carregar blocos.** Os goals `take_block/leave_block`
   dependem de listas enormes de blocos permitidos; ficou de fora por ora
   (é cosmético/griefing, não inteligência).
10. **Pillagers/raids adiados.** Overrides na família de raids podem
    corromper a lógica de ondas de invasão; entram na Etapa 3 com testes
    dedicados em vez de um port apressado.
11. **Slime não sobrescrito.** A divisão em tamanhos ao morrer é
    parcialmente resolvida na engine por identificador; sobrescrever
    arriscaria quebrar o loop de farm clássico.
12. **Anti-torre e mobGriefing.** O creeper demolidor usa a explosão normal
    (`destroy_affected_by_griefing: true`): com `/gamerule mobgriefing
    false`, ele detona sem quebrar blocos — o toggle `creeperBreach`
    também desliga só esse recurso.

## Notas da Etapa 3

13. **villager_v2 não sobrescrito (de propósito).** É o arquivo mais
    complexo do jogo: profissões, POIs, agenda, trocas e gossip. Um
    override de memória quebraria silenciosamente descontos e economia.
    A "vila viva" foi implementada por FORA (alarme + golem + dispersão),
    preservando 100% do comércio.
14. **Golem: padrão seguro.** Não há como distinguir com certeza, no
    spawn, golem construído por jogador de golem natural; o padrão adotado
    é `player_created` (nunca retalia jogadores). O evento
    `minecraft:village_created` está mapeado caso a engine o dispare.
15. **Cura do zombie villager adiada.** O desconto pós-cura vem do sistema
    de gossip (engine); replicar a cura via transformation perderia os
    descontos em silêncio — pior que manter o vanilla.
16. **Pillagers continuam adiados** até haver como testar raids ao vivo
    (ver §10); previstos como v0.8 no roadmap de IDEIAS.md.
17. **Galinha:** a queda planada (bater de asas) tem parte no motor; se
    notar dano de queda incomum em galinhas, reporte — é um ajuste fino.

## Notas da v0.4

18. **Velocidade por personalidade é atributo vivo.** Grupos que trocam o
    componente `minecraft:movement` (creeper congelando, bebês) redefinem
    o atributo — nesses casos o bônus de perfil se perde até o próximo
    sorteio. Cosmético; aceito para não duplicar grupos por perfil.
19. **Evento de raiva das abelhas.** O nome do evento interno varia entre
    versões; tentamos dois nomes conhecidos e, se ambos falharem, o enxame
    ao menos arranca com Velocidade/Força (degradação graciosa).
20. **Eventos de clima/explosão são assinados com try/catch.** Se alguma
    versão antiga (1.21.10x) não expuser `explosion`/`weatherChange`
    estáveis, o recurso específico se desliga sozinho sem afetar o resto.

## Notas da v0.5

21. **Lobo não sobrescrito (de propósito).** O wolf.json vanilla carrega
    9 variantes por bioma, armadura de lobo, domar/sentar/seguir dono e
    coleira tingível com 16 cores. Reescrever isso de memória arriscaria
    regressões visíveis (lobos todos iguais, armadura morta, sentar
    quebrado) — pior que o ganho. A camada de alcateia foi entregue por
    script; o flanco coordenado de lobos fica para quando houver ambiente
    de teste (previsto junto da v0.8).
22. **Carcaça só atrai monstros espertos** (família neuro_smart) — lobos
    e raposas vanilla não podem ser direcionados sem override (sem
    grupos `neuro:*`). Mortes na água não geram cheiro; throttle global
    de 10 s limita o custo e o caos.
23. **Detecção de filhote é universal**: usa o componente
    `minecraft:is_baby`, então funciona para TODAS as espécies do jogo,
    incluindo as não sobrescritas.

## Notas da v0.5.1 (auditoria)

24. **Um timer por vez.** `minecraft:timer` é um componente único: se dois
    grupos com timer estiverem ativos (ex.: alertado + flanqueando), vale o
    do último grupo adicionado; ao removê-lo, o do outro REINICIA. Efeito
    prático: um estado pode durar um pouco mais que o nominal — nunca
    menos, e nunca para sempre (o script também limpa por nível).
25. **Formato de `destination_position_range`.** Usamos a forma-objeto
    `{min, max}` (padrão consolidado nas versões 1.26.20+). Se numa
    1.21.10x específica o flanqueamento não ocorrer visivelmente, é este
    campo a checar no content log — a falha é isolada (o resto do grupo e
    do mob segue normal).

## Nota da v0.6

26. **"Vigia" eleito entre aldeões: adiado.** Fazer um aldeão FICAR num
    posto exige goals novos no villager_v2 (veto do §13) ou uma entidade
    customizada com modelo/textura próprios (fora do escopo atual — sem
    assets de qualidade, viraria um boneco quebrado). O papel foi coberto
    de outra forma: em vilas sem golem, o alarme avisa os jogadores no
    HUD — em multiplayer, a vizinhança vira a guarda. O sino tático usa
    `playerInteractWithBlock` assinado com try/catch: se a versão não
    expõe o evento, só esse recurso se desliga.

27. **Tag de resgate e reload.** A limpeza da tag `neuro_threat` (30 s)
    vive num `runTimeout` do script; fechar o mundo dentro dessa janela
    deixa a tag no monstro. Efeito benigno: golems continuam priorizando
    aquele alvo até eliminá-lo — nunca um estado quebrado.

## Nota da v0.7

28. **Aranha espreitadora não tem toggle** — como o kiting do esqueleto, é
    comportamento JSON (o menu controla apenas a camada de script). O
    "alvo de observação" usa ataque com alcance zero: nunca causa dano;
    o congelamento da emboscada reutiliza o padrão do §18 (troca de
    movimento pode resetar o bônus de perfil — cosmético).

## Notas da v0.8

29. **Memória por células de 64 blocos.** Um ataque exatamente na divisa
    pode cair na célula vizinha (resposta um nível abaixo naquele ponto
    específico) — custo aceito para manter UMA dynamic property pequena
    (≤24 regiões, LRU). Sem `getAbsoluteTime` (versões antigas), o
    decaimento por tempo se desliga e o esquecimento fica só pelo LRU.
30. **Sons da vida social** usam ids vanilla ("mob.villager.idle" /
    "mob.villager.haggle") dentro de try/catch: se um id mudar no futuro,
    apenas o som some — nada mais é afetado.

## Notas da v0.9

31. **Refatoração regionmem sem quebra.** villagemind manteve chave,
    formato e parâmetros — o assert do Passe 2 confere os cinco valores
    no arquivo final. Se um dia mudarem, é migração de dados (documentar).
32. **Fauna arisca só nas espécies sobrescritas.** O grupo `neuro:wary`
    existe em vaca e galinha; nas demais espécies o efeito da pressão é o
    pânico ampliado (universal). Ovelha/porco entram quando (se) forem
    sobrescritos com segurança. O descanso noturno segue o padrão do §28
    (JSON puro, sem toggle).

## Nota da v1.0

33. **Site.** GIFs/vídeos demonstrativos ficam a cargo do usuário (não há
    como gravar gameplay daqui) — a página "O que mudou?" traz o guia de
    onde e como inserir cada clipe. As fontes vêm do Google Fonts com
    fallback de sistema: offline, o site degrada graciosamente.

## Notas da v1.1

35. **Kit de teste.** Partícula "minecraft:endrod" em try/catch (se o id
    não existir, só o visual some); inspetor por raycast apenas para
    jogadores com a tag `neuro_dev` — sem ninguém em modo dev, o módulo
    é inerte. Chefes seguem adiados (fases/boss bar são da engine).
36. **Waypoint pós-teste-em-campo.** Caixa 0,1 (sem sombra perceptível,
    sem bloquear blocos, sem absorver golpes), nunca criado a <4 blocos
    de um jogador e com dedupe a <3 blocos. A sombra que restar em algum
    dispositivo é a da engine para entidades — proporcional à caixa,
    agora mínima.
