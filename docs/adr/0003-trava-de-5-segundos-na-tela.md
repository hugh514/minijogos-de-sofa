# ADR 0003: Trava de 5 segundos aplicada na tela, não em cada jogo

Status: aceita.

## Contexto

Uma auditoria dos minijogos achou rodadas que acabavam em menos de 2 segundos por um toque sem querer: sumô em 0,8 s, empilha em 0,0 s e sequência em 1,8 s. Quem joga perde um ponto sem ter jogado. Corrigir um jogo por vez resolve aquele jogo, mas o minijogo seguinte, escrito depois, pode repetir o problema.

## Decisão

1. A regra "nenhuma rodada fecha antes de 5 s de jogo" é aplicada por uma função do motor, `comMinimo(jogo)`, que embrulha o `atualiza` do minijogo. Se o jogo decide antes de 5 s, o resultado fica guardado em `p.dados.fimCedo`, `atualiza` deixa de ser chamado, a física segue e a rodada fecha aos 5 s com o mesmo resultado.
2. Resultado inválido para o modo não espera: vira erro na hora, como sempre.
3. Quem aplica a trava é a tela, em todo minijogo: nos embutidos (`JOGOS.forEach(comMinimo)`) e em cada um que chega da pasta (`registra(comMinimo(jogo))`). O minijogo não sabe que a trava existe.
4. Os testes de unidade de cada minijogo rodam sem a trava, para conferir a regra pura do jogo. A regra dos 5 s é conferida em um só arquivo, `jogos/minimo-5s.test.mjs`, que liga a trava e roda todos os minijogos em todos os modos que declaram. Um dos testes lê `tela.html` e falha se alguma chamada de `registra` não passar por `comMinimo`.

## Consequências

- Um minijogo novo respeita a regra sem o autor ter de lembrar dela.
- A regra tem um só lugar para ler e um só arquivo de teste.
- Os segundos entre a decisão e o fechamento não são jogo. A trava impede a rodada curta, mas não torna esses segundos divertidos. `jogos/ESTILO.md` pede para desenhar o minijogo de modo a não decidir tão cedo, e `jogos/LEIA.md` pede para deixar `p.celular` e `p.dados.aviso` no estado final antes de devolver o resultado, porque a tela segue desenhando.
- Depois da decisão o `atualiza` não roda mais, então o placar do minijogo não deve depender de ele continuar sendo chamado. Os jogos de queda tratam isso em seus próprios testes.
- A garantia depende de a tela chamar `comMinimo`. O teste que lê `tela.html` protege contra o esquecimento, mas é uma verificação por leitura de texto, não de execução da tela.

Ver [`specs/006-regra-dos-5-segundos`](../../specs/006-regra-dos-5-segundos/spec.md).
