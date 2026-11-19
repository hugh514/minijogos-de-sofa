# 007 Cooperativo acessível para dupla lenta

Arquivos de referência: `jogos/*-coop.mjs` e seus testes, `jogos/zumbis-coop.mjs` e `jogos/zumbis-coop.test.mjs` (o exemplo mais completo), `logica.mjs` (`NOITES_COOP`), `jogos/LEIA.md` (seção "Minijogo cooperativo").

## Problema

Todos juntos é a brincadeira de quem quer jogar sem disputa: todos do mesmo lado contra o jogo, em 5 noites. Se o jogo for difícil demais, a dupla que está aprendendo, com uma criança ou com alguém distraído olhando o celular em vez da TV, perde a noite inteira sem chance. Se for fácil demais, não tem graça. Dificuldade ajustada "no olho" muda a cada ajuste de código, e ninguém percebe quando uma mudança torna o jogo impossível para quem joga devagar.

## Para quem

- Duplas e grupos que jogam juntos, principalmente com crianças ou pessoas que estão aprendendo.
- Quem ajusta um minijogo cooperativo e precisa saber se piorou a dificuldade.

## Requisitos

- RF-1. Cada minijogo cooperativo aceita de 2 a 4 jogadores e a dificuldade cresce com o número de jogadores e com a noite (1 a 5).
- RF-2. Um robô de teste "lento" joga o minijogo no teste: reage a cada 0,5 s e se distrai em 40% das vezes (parado ou andando à toa, ou, na `canoa-coop`, errando 40% dos toques), mas foge do perigo, usa a ação do jogo e ajuda o amigo. Com 2 jogadores, esse robô vence quase sempre na 1ª noite e na maioria das vezes na 5ª. Nos testes de `zumbis-coop`, `barco-coop` e `trem-coop` o piso é 85% na 1ª noite e 60% na 5ª.
- RF-3. A 5ª noite é mais difícil que a 1ª: a taxa de vitória do robô lento na 5ª é menor que na 1ª.
- RF-4. Com 3 e 4 jogadores o robô lento também vence a maioria das noites.
- RF-5. Ficar parado não basta: com os jogadores parados, a equipe perde (ou não chega ao fim, conforme o jogo).
- RF-6. No `zumbis-coop`, o zumbi é sempre mais lento que o jogador, ninguém cai antes da primeira onda (a primeira onda sai depois de pelo menos 2,5 s), quem caiu levanta quando um amigo em pé encosta nele, e a luz de dois amigos juntos destrói os zumbis num raio maior que a luz sozinha. O controle é um botão só, Luz.
- RF-7. A rodada cooperativa nunca fecha antes de 5 s (ver `specs/006-regra-dos-5-segundos`).
- RF-8. O limiar de cada teste é um contrato: um ajuste que derruba a taxa do robô lento abaixo do piso quebra o teste, e o ajuste precisa ser desfeito ou o piso discutido em revisão.

## Critérios de aceite

- CA-1. No `zumbis-coop`, o robô lento com 2 jogadores vence 85% ou mais na 1ª noite e 60% ou mais na 5ª, e a 5ª é mais difícil que a 1ª (RF-2, RF-3).
- CA-2. No `zumbis-coop`, com 3 e 4 jogadores o robô lento vence a maioria nas duas noites e os parados perdem sempre (RF-4, RF-5).
- CA-3. No `zumbis-coop`, uma "família atenta" (foge, usa a luz, fica junta e ajuda) vence quase sempre na 1ª noite com 2, 3 e 4 jogadores (RF-2).
- CA-4. No `zumbis-coop`, com 4 parados os zumbis vencem a noite (RF-5).
- CA-5. No `zumbis-coop`, a dificuldade cresce com o número de jogadores e com a noite (RF-1).
- CA-6. No `zumbis-coop`, o zumbi é mais lento que o jogador em todas as noites e ondas (RF-6).
- CA-7. No `zumbis-coop`, os limites das ondas são coerentes e a primeira onda só sai depois de 2,5 s (RF-6).
- CA-8. No `zumbis-coop`, reviver é só encostar: um amigo em pé perto pelo tempo de reviver (`T_REVIVE`, 1,2 s no código) levanta quem caiu, dois amigos levantam na metade do tempo, e longe o progresso se perde devagar (RF-6).
- CA-9. No `zumbis-coop`, a luz de dois amigos destrói os zumbis num raio maior, e a luz sozinha só afasta e deixa tonto (RF-6).
- CA-10. Cada um dos outros nove minijogos cooperativos tem um teste de robô lento no mesmo molde (RF-2, RF-3, RF-4, RF-5): `barco-coop`, `bolhas-coop`, `canoa-coop`, `cozinha-coop`, `defesa-coop`, `jardim-coop`, `ponte-coop`, `resgate-coop` e `trem-coop`.
- CA-11. Se o robô lento é um bom modelo de uma pessoa distraída de verdade, e se a criança que joga se diverte. Sem teste automatizado: o robô é uma aproximação, e a diversão só se confere jogando.

## Fora do escopo

- Níveis de dificuldade escolhidos pelo jogador. A dificuldade é uma só e sobe com a noite.
- Medir o que as pessoas sentem ao jogar. O teste mede taxa de vitória de um robô, não diversão.
- Cooperativo com mais de 4 jogadores.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil` |
| CA-2 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: com 3 e 4 jogadores o robo lento tambem vence a maioria nas duas noites, mas parados perdem sempre` |
| CA-3 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: familia atenta (foge, usa a luz, fica junta e ajuda) vence quase sempre na 1a noite, com 2, 3 e 4` |
| CA-4 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: ficar parado nao basta: com 4 parados os zumbis vencem a noite` |
| CA-5 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: a dificuldade escala com o numero de jogadores e com a noite` |
| CA-6 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: justo: o zumbi e sempre mais lento que o jogador` |
| CA-7 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: tamanho das ondas e limites coerentes` |
| CA-8 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: reviver e so encostar: amigo em pe perto pelo tempo de reviver levanta (menos tempo nao basta)` |
| CA-8 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: dois amigos levantam na metade do tempo` |
| CA-8 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: longe nao revive e o progresso se perde aos poucos` |
| CA-9 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: com um amigo em pe perto a luz dos dois DESTROI os zumbis, num raio maior` |
| CA-9 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: Luz sozinha afasta e deixa tonto o zumbi perto, e nao mexe no longe` |
| CA-10 | `jogos/barco-coop.test.mjs` | `barco-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil` |
| CA-10 | `jogos/bolhas-coop.test.mjs` | `bolhas-coop: um robo lento com 2 jogadores vence quase sempre na 1a noite e na maioria na 5a, que segue mais dificil` |
| CA-10 | `jogos/canoa-coop.test.mjs` | `canoa-coop: robo lento (falha 40% dos toques) vence quase sempre com 2 jogadores na 1a noite e na maioria na 5a, que segue mais dificil` |
| CA-10 | `jogos/cozinha-coop.test.mjs` | `cozinha-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2, 3 e 4 jogadores` |
| CA-10 | `jogos/defesa-coop.test.mjs` | `defesa-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2, 3 e 4 jogadores` |
| CA-10 | `jogos/jardim-coop.test.mjs` | `jardim-coop: um robo lento com 2 jogadores vence quase sempre na 1a noite e na maioria na 5a, que segue mais dificil` |
| CA-10 | `jogos/ponte-coop.test.mjs` | `ponte-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2 jogadores e a maioria com 3 e 4` |
| CA-10 | `jogos/resgate-coop.test.mjs` | `resgate-coop: robo lento (reage a cada 0,5 s e se distrai 40% do tempo) vence quase sempre com 2 jogadores na 1a noite e na maioria na 5a, que segue mais dificil` |
| CA-10 | `jogos/trem-coop.test.mjs` | `trem-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil` |
| CA-11 | sem teste automatizado | |

Um teste citado em CA-8 ainda diz "2 s" no nome, mas mede `T_REVIVE` (1,2 s): o nome ficou desatualizado e deve ser corrigido junto com o teste.

Os testes de CA-1, CA-2 e CA-10 não usam azar: o robô usa um gerador de números com semente fixa, então o resultado se repete igual a cada execução.
