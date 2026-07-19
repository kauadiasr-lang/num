# Guia de configuração (v1.2)

Abra o menu com `/scriptevent neuro:menu` — agora organizado em **6
categorias** (Combate, Percepção, Mundo vivo, Vila, Feedback, Sistema);
toque numa opção para alterná-la. Tudo fica salvo no mundo (dynamic
property `neuro:cfg`) e sobrevive a reinícios e atualizações. Atalhos:
`neuro:cronica` (estatísticas da IA), `neuro:ajuda` (comandos),
`neuro:stats` (cérebros ativos + custo em ms), `neuro:on` / `neuro:off`,
`neuro:reset`.

## Percepção e memória
`memorySearch` (busca ativa da última posição vista) · `hearing`
(investigam sons de blocos; raio 20) · `blastDeafen` (explosões
ensurdecem monstros por 5 s).

## Grupo e tática
`packAlert` + raio 12/24/36 · `tactics` (cerco rotativo, mínimo
`flankMinPack` = 3) · `ambush` (emboscadas coordenadas) · `retreat`
(retirada com recrutamento) · `leadership` (aura e moral dos veteranos).

## Combate e adaptação
`creeperStalk` · `antiTower` + `creeperBreach` · `adaptive` (reforços
contra alvos bem equipados; nada no Pacífico/Fácil) · `priorityTargeting`
(matilha foca o mais vulnerável, com 2+ jogadores) · `personalities` ·
`veterans`.

## Vila
`villageDefense` (alarme com golems direcionados + resgate) ·
`tacticalBell` · `villageMemory` (trauma regional persistente) ·
`villageAmbience` (conversas entre aldeões).

## Fauna e mundo
`herdPanic` · `babyGuard` · `wolfPacks` · `carrionScent` · `beeSwarm` ·
`huntingPressure` · `moonEvents` · `weatherMoods`.

## Feedback e interface (v1.2)
`feedbackFx` (sons/partículas nos momentos táticos: grito de guerra com
a voz do próprio mob, bote, retirada, veterano, moral quebrada, corneta
da vila) · `huntedIndicator` (3+ caçadores no seu rastro = aviso
discreto no action bar) · `welcomeMessages` (boas-vindas na 1ª entrada
+ resumo de novidades pós-atualização) · `milestones` (marcos da
crônica anunciados no chat).

## Sistema
`enabled` (núcleo de script; os comportamentos JSON — kiting, rotas
seguras, espreita diurna, descanso noturno — continuam) ·
`budgetPerTick` 4/6/10 · `debug`.

Esperado em `neuro:stats`: 0–1 ms por tick com o padrão.
