# NeuroMobs AI — IA avançada para mobs (Minecraft Bedrock)

Addon **100% gratuito** que reconstrói a inteligência dos mobs combinando
overrides de comportamento (Behavior Pack) com um núcleo de decisão em
Script API estável: alerta em grupo, memória da última posição vista, busca
ativa, cerco/flanqueamento, rotas que evitam perigos, audição, creeper
furtivo, kiting de esqueleto e dificuldade adaptativa.

**Status: v1.2.0 — "Sentir a IA"** — feedback audiovisual dos momentos
táticos (grito de guerra, bote, retirada, veteranos), aviso de caçada no
HUD, crônica do mundo com marcos, boas-vindas na 1ª entrada e menu por
categorias — ver `CHANGELOG.md`. 14 mobs +
kit de teste (`/scriptevent neuro:ver`) + correções do teste em campo. — inclui o site oficial de documentação em `site/` (GitHub Pages). — núcleo + 13 mobs + anti-torre + vila viva + personalidades/veteranos/clima + alcateias, carcaças e proteção de filhotes. Roadmap em `docs/IDEIAS.md`. Veja
`docs/ROADMAP.md`.

## Requisitos
- Minecraft Bedrock **1.21.100 ou superior** (inclui toda a linha 26.x atual).
- **Nenhum experimento** precisa ser ativado — só APIs estáveis
  (`@minecraft/server` / `@minecraft/server-ui` 2.x), o que mantém
  compatibilidade com mundos Survival, multiplayer e **Realms**.

## Instalação
1. Abra o arquivo `NeuroMobs_v1.2.0.mcaddon` (duplo clique / compartilhar
   com o Minecraft). BP e RP são importados juntos.
2. Nas configurações do mundo, ative o Behavior Pack **NeuroMobs AI [BP]**
   (o RP é dependência e entra automaticamente).
3. Entre no mundo. Pronto — sem comandos obrigatórios.

## Configuração no jogo
| Comando | Efeito |
|---|---|
| `/scriptevent neuro:menu` | Menu de opções por categoria (toque para alternar) |
| `/scriptevent neuro:cronica` | Crônica do mundo — a história da IA nesta seed |
| `/scriptevent neuro:ajuda` | Lista de comandos no chat |
| `/scriptevent neuro:stats` | Cérebros ativos + custo em ms por tick |
| `/scriptevent neuro:ver` | Visão de desenvolvedor (waypoints + cérebros) |
| `/scriptevent neuro:on` · `neuro:off` | Liga/desliga o núcleo |
| `/scriptevent neuro:reset` | Restaura os padrões |

## Mobs cobertos (ondas 1–2)
Zumbi · Esqueleto · Creeper · Aranha · Husk · Stray · Aranha-de-caverna ·
Drowned · Enderman · Bruxa · **Golem de ferro · Vaca · Galinha** — detalhes
em `docs/O-QUE-MUDOU.md`. Anti-torre, **alarme de vila** e **pânico de
rebanho universal** (este último vale para todos os animais, sem override).

## Site oficial
A pasta `site/` contém o site completo (início + "O que mudou?"), pronto
para publicar de graça no GitHub Pages — instruções em `site/PUBLICAR.md`.

## Documentação
- `docs/ARQUITETURA.md` — como tudo funciona por dentro
- `docs/O-QUE-MUDOU.md` — vanilla vs. NeuroMobs, mob a mob
- `docs/CONFIGURACAO.md` — todas as opções
- `docs/LIMITES-DA-ENGINE.md` — o que a Bedrock permite (e o que não)
- `docs/ROADMAP.md` · `CHANGELOG.md`

## Licença
MIT — uso, modificação e redistribuição livres com crédito.
