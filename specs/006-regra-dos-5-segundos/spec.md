# 006 Regra dos 5 segundos mínimos

Arquivos de referência: `logica.mjs` (`comMinimo`, `T_MIN_RODADA`), `tela.html` (aplicação da trava), `jogos/minimo-5s.test.mjs`, `jogos/ESTILO.md` (seção "Ritmo e pontuação").

## Problema

Uma auditoria dos minijogos achou rodadas que acabavam em menos de 2 segundos por um toque sem querer: um sumô de 0,8 s, um empilha de 0,0 s e uma sequência de 1,8 s. Para quem joga isso é um ponto perdido sem ter jogado. Corrigir jogo por jogo não garante que o próximo minijogo, escrito por outra pessoa, respeite a regra.

## Para quem

- Quem joga, que não deve perder ponto por uma rodada que acabou antes de começar.
- Quem escreve minijogos, que não precisa lembrar da regra para cada jogo.

## Requisitos

- RF-1. Nenhuma rodada fecha antes de 5 s de jogo (`T_MIN_RODADA`), nem por toque sem querer nem por jogada perfeita.
- RF-2. Se o minijogo devolve um resultado válido antes dos 5 s, o resultado fica guardado em `p.dados.fimCedo`, `atualiza` deixa de ser chamado, a física continua e a rodada fecha aos 5 s com o mesmo resultado.
- RF-3. Resultado inválido para o modo não espera: vira erro na hora e o minijogo sai da rotação, como em qualquer retorno inválido.
- RF-4. A trava é aplicada pela tela, em todo minijogo: nos embutidos (`JOGOS.forEach(comMinimo)`) e em cada um que chega da pasta (`registra(comMinimo(...))`), inclusive o que entra por `window.__registra`.
- RF-5. `comMinimo` aplicado duas vezes ao mesmo minijogo não muda nada.
- RF-6. Os testes de unidade de cada minijogo rodam sem a trava, para conferir a regra pura do jogo. A regra dos 5 s é conferida em um só lugar, `jogos/minimo-5s.test.mjs`, com a trava ligada, em todos os minijogos e em todos os modos que cada um declara.
- RF-7. Nos jogos de queda (sumô, lava, hélice, meteoros), a queda que decide antes dos 5 s conta no placar, mas a rodada segue e o jogador volta ao jogo.
- RF-8. Quando a trava segura um resultado, o minijogo deixa `p.celular` e `p.dados.aviso` no estado final antes de devolvê-lo, porque a tela continua desenhando até fechar.

## Critérios de aceite

- CA-1. A tela aplica `comMinimo` nos embutidos e em toda chamada de `registra`, e uma linha comentada não vale (RF-4).
- CA-2. Um resultado válido antes de 5 s sai igual aos 5 s, `atualiza` deixa de ser chamado depois da decisão e aplicar a trava duas vezes não muda nada (RF-2, RF-5).
- CA-3. Retorno inteiro inválido e exceção encerram na hora, sem esperar os 5 s (RF-3).
- CA-4. Para cada um dos 80 minijogos, em cada modo e número de jogadores que ele declara, 30 rodadas com dedos aleatórios e 10 com toque em todo quadro nunca duram menos de 5 s (RF-1, RF-6).
- CA-5. No `cor-mentirosa`, acertar cada desafio assim que aparece só fecha a rodada aos 5 s (RF-1).
- CA-6. Na `corrida-dedos`, alternar DIR e ESQ a 15 toques por segundo só fecha a rodada aos 5 s (RF-1).
- CA-7. No sumô, na lava e na hélice, 40 rodadas com dedos aleatórios nunca duram menos de 5 s (RF-1, RF-7).
- CA-8. A queda decisiva antes de 5 s conta no placar, a rodada segue e o jogador volta (RF-7).
- CA-9. Em 40 sementes, nos jogos de queda, o primeiro a 2 quedas vence, o placar nunca passa de 2 e a rodada passa de 5 s (RF-7).
- CA-10. Nos jogos de queda, quem decidiu antes dos 5 s espera os 5 s, o outro não soma e a rodada não termina cedo (RF-7).
- CA-11. O estado de `p.celular` e `p.dados.aviso` no momento em que a trava segura um resultado (RF-8). Sem teste automatizado: é uma convenção de `jogos/LEIA.md`, revisada nos prints.

## Fora do escopo

- Duração máxima da rodada. O motor encerra em empate aos 75 s, e o limite de 20 a 50 s é uma regra de estilo conferida na revisão.
- Garantir que o minijogo seja divertido nos primeiros 5 s. A trava só impede que a rodada acabe. Os segundos parados até fechar não são jogo, e `jogos/ESTILO.md` pede para desenhar o minijogo de modo a não decidir tão cedo.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `jogos/minimo-5s.test.mjs` | `a tela aplica comMinimo nos embutidos e em cada minijogo que chega da pasta` |
| CA-2 | `jogos/minimo-5s.test.mjs` | `comMinimo: resultado valido antes de 5 s fica guardado e sai igual aos 5 s; aplicar duas vezes nao muda nada` |
| CA-3 | `jogos/minimo-5s.test.mjs` | `comMinimo: inteiro invalido encerra na hora, sem esperar os 5 s` |
| CA-3 | `jogos/minimo-5s.test.mjs` | `comMinimo: exception encerra na hora, sem esperar os 5 s` |
| CA-4 | `jogos/minimo-5s.test.mjs` | `<id>: com a trava da tela, nenhuma rodada acaba antes de 5 s`, um teste por minijogo, por exemplo `sumo: com a trava da tela, nenhuma rodada acaba antes de 5 s` e `zumbis-coop: com a trava da tela, nenhuma rodada acaba antes de 5 s` |
| CA-5 | `jogos/minimo-5s.test.mjs` | `cor-mentirosa: acertando cada desafio assim que aparece, a rodada so fecha aos 5 s` |
| CA-6 | `jogos/minimo-5s.test.mjs` | `corrida-dedos: alternando DIR e ESQ a 15 toques por segundo, a rodada so fecha aos 5 s` |
| CA-7 | `logica.test.mjs` | `sumo: com dedos aleatorios, nenhuma de 40 rodadas dura menos de 5 s` |
| CA-7 | `logica.test.mjs` | `lava: com dedos aleatorios, nenhuma de 40 rodadas dura menos de 5 s` |
| CA-7 | `logica.test.mjs` | `helice: com dedos aleatorios, nenhuma de 40 rodadas dura menos de 5 s` |
| CA-8 | `logica.test.mjs` | `queda decisiva antes de 5 s conta no placar, mas a rodada segue e o jogador volta` |
| CA-9 | `logica.test.mjs` | `sumo: em 40 sementes, o primeiro a 2 quedas vence (nunca empate por isso), o placar nunca passa de 2 e a rodada passa de 5 s` (o mesmo teste existe para `lava`, `helice` e `meteoros`) |
| CA-10 | `logica.test.mjs` | `sumo: quem decidiu antes dos 5 s espera os 5 s, o outro nao soma e a rodada nao termina cedo` (o mesmo teste existe para `lava`, `helice` e `meteoros`) |
| CA-11 | sem teste automatizado | |

O número 80 de CA-4 é a soma dos 10 minijogos embutidos em `logica.mjs` com os 70 arquivos de `jogos/` que `server.js` serve, e bate com os 80 testes `<id>: com a trava da tela...` que `npm test` executa.
