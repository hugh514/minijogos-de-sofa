# Testes

O projeto tem duas famílias de teste: as que rodam com `npm test` (Node, sem navegador, sem rede externa) e as de navegador, com `npm run e2e` (Chromium controlado pelo Playwright). Este documento diz o que cada camada garante, como rodar e mostra um ciclo vermelho-verde de um teste que existe no repositório.

## Números

Medidos com `npm test` (Node 26, `node --test *.test.mjs jogos/*.test.mjs`), que terminou em cerca de 1 minuto (57 s e 79 s em duas execuções):

| Camada | Arquivos | Testes |
|---|---|---|
| Motor | `logica.test.mjs`, `logica-festa.test.mjs` | 155 + 26 = 181 |
| Servidor | `server.test.mjs` | 14 |
| Tela e controle, por leitura estática | `tela.test.mjs`, `controle.test.mjs` | 9 + 6 = 15 |
| Minijogos (unidade, um arquivo por minijogo) | 70 arquivos `jogos/<id>.test.mjs` | 963 |
| Trava dos 5 segundos, em todos os minijogos | `jogos/minimo-5s.test.mjs` | 86 |
| **Total de `npm test`** | | **1259** |

Há ainda 8 scripts de navegador em `e2e/`, que não entram nessa conta.

Para refazer a medição:

```bash
npm test            # o resumo no fim mostra "tests 1259"
node --test jogos/*.test.mjs   # só os minijogos
```

O número muda quando se acrescenta um minijogo. Os 1259 valem para o estado atual do ramo.

## A pirâmide

```
              /\
             /  \     Navegador (Playwright), 8 scripts, sob demanda
            /----\
           /      \   Tela e controle por leitura estática, 15 testes
          /--------\
         /          \ Servidor (processo real, porta de teste), 14 testes
        /------------\
       /              \ Motor (rotação, modos, pontos), 181 testes
      /----------------\
     /                  \ Minijogos (unidade + fumaça + trava de 5 s), 1049 testes
    /____________________\
```

### Unidade por minijogo (`jogos/<id>.test.mjs`)

**O que garante.** A regra do jogo, em Node, sem desenhar nada: quem ganha em cada situação, o empate, a condição de fim, o limite de tempo, os textos que o jogo mostra no celular.

**Como funciona.** O apoio `jogos/_teste.mjs` cria uma partida já no primeiro quadro de jogo (`partidaCom`), avança o tempo (`roda`) e simula o celular com `entrada`. Todo minijogo é obrigado a chamar `fumaca`: uma rodada com os jogadores parados e 15 rodadas com dedos aleatórios, chamando `monta` e `desenha` de verdade com o three.js real, sem WebGL. `fumaca` falha em caso de erro, valor `NaN` ou rodada que não termina, e confere que o vencedor é válido para o modo. Em minijogos da Festa ela roda com cada número de jogadores e cada modo que o jogo declara.

**Dificuldade dos cooperativos.** Os dez minijogos cooperativos têm também testes com um robô lento, que são a base da regra descrita em [`specs/007-cooperativo-para-dupla-lenta`](../specs/007-cooperativo-para-dupla-lenta/spec.md) e do [ADR 0004](adr/0004-dificuldade-do-cooperativo-travada-por-robo-lento.md).

### Trava dos 5 segundos (`jogos/minimo-5s.test.mjs`)

**O que garante.** Que nenhuma rodada de nenhum minijogo, em nenhum modo que ele declara, fecha antes de 5 s, mesmo com toque em todo quadro. Há um teste por minijogo (80 hoje) e mais seis testes da própria trava. Um deles lê `tela.html` e confere que toda chamada de `registra` passa por `comMinimo`. Os testes de unidade de cada minijogo rodam sem a trava, e esta é a única camada que a liga. Ver [ADR 0003](adr/0003-trava-de-5-segundos-na-tela.md).

### Motor (`logica.test.mjs`, `logica-festa.test.mjs`)

**O que garante.** As regras que valem para todos os minijogos: rotação sem repetição, gênero e distância mínima, histórico, cartas de poder, modificadores, modos (Duelo, Cada um por si, Duplas, Todos juntos), pontuação, moedas, 5 noites do cooperativo, minijogo que quebra saindo da rotação, entrada inválida do celular, contadores de toque. Muitos testes usam minijogos de mentira (`falso`, `falsos`), para a regra ser testada sem depender de um jogo real.

### Servidor (`server.test.mjs`)

**O que garante.** O que o servidor aceita e o que recusa: lugares de 1 a 4, só o Jogador 1 muda o modo, corpo acima do limite descartado, caminhos de modelo e fonte fora da expressão regular respondendo 404 sem devolver conteúdo. O teste sobe `server.js` como processo, numa porta de teste (8158), e fala com ele por HTTP e SSE de verdade.

**O que não garante.** O WebSocket (quadros inválidos, limites), os limites de conexão e a listagem de `/jogos` não têm teste dedicado. Isso está dito na [spec 002](../specs/002-servidor-carteiro/spec.md).

### Tela e controle, por leitura estática (`tela.test.mjs`, `controle.test.mjs`)

**O que garante.** Funções puras que moram dentro de `tela.html` e `controle.html`: a curva do joystick, qual botão está sob o dedo (com histerese), `textoSeguro`, `trocaNomes`, `milhar`, `pareceId`.

**Como funciona.** Esses arquivos são HTML com JavaScript, sem módulo para importar. O teste lê o arquivo, recorta o trecho entre os marcadores `// @puras` e `// @fim-puras` (ou `// @puras-texto` e `// @fim-puras-texto`) e o executa com `new Function`. Assim a lógica pura é testada sem navegador, sem separar o código em outro arquivo. `jogos/minimo-5s.test.mjs` usa a mesma ideia para conferir que a tela aplica a trava.

**O que não garante.** Nada de DOM, de desenho ou de toque. O que depende do navegador fica para a camada seguinte.

### Navegador com Playwright (`e2e/`)

**O que garante.** O conjunto funcionando: a tela do PC e até quatro celulares simulados, com toque de verdade (o Chromium com `hasTouch`, e eventos de toque enviados pelo protocolo de depuração), jogando partidas completas pelo servidor real. Cobre o menu do anfitrião, os modos, os controles (área de toque, deslizar entre A e B, multitoque), as cartas, a torcida, o robô de treino, os textos na TV e nos celulares (falha se aparecer `undefined`, `NaN`, `null` ou o id de um minijogo), o kart e os minijogos novos da Festa. Os scripts tiram prints em `e2e/fotos*/` (ignorados pelo git) e vários deles falham se houver erro de console ou de página.

**Como funciona.** `npm run e2e` (`e2e/rodar.js`) sobe `server.js` numa porta de teste (8170, ou a de `PORTA_E2E`), recusa-se a rodar se a porta já está em uso, roda cada script em sequência e desliga o servidor no fim. A maioria dos scripts usa `assert` e imprime uma linha `ok ...` depois de cada verificação; o do kart é um roteiro de jogo com prints, sem `assert`.

**O que não garante.** Não roda em aparelhos de verdade, só no Chromium. Não faz parte do CI.

## Como rodar

```bash
npm install                        # com as dependências de desenvolvimento (traz o Playwright)
npm test                           # tudo que não precisa de navegador
node --test jogos/zumbis-coop.test.mjs                       # um arquivo
node --test --test-name-pattern="comMinimo" jogos/minimo-5s.test.mjs   # só testes cujo nome casa

npx playwright install chromium    # uma vez
npm run e2e                        # os 8 scripts de navegador
```

No CI (`.github/workflows/testes.yml`), a cada push e pull request, roda `npm ci --omit=dev` e `npm test` em Ubuntu e Windows, com Node 22. Os testes de navegador ficam de fora do CI e são rodados à mão antes de mesclar algo visual.

## Exemplo de ciclo vermelho-verde

O teste é `comMinimo: resultado valido antes de 5 s fica guardado e sai igual aos 5 s; aplicar duas vezes nao muda nada`, em `jogos/minimo-5s.test.mjs`. Ele cobre o critério CA-2 da [spec 006](../specs/006-regra-dos-5-segundos/spec.md): um minijogo que decide em 0,1 s só pode fechar a rodada aos 5 s.

O teste cria um minijogo de mentira que devolve vencedor `1` assim que `p.t > 0.1`, aplica a trava duas vezes e joga até a rodada fechar, conferindo a cada quadro que ela não fechou antes de 4,95 s:

```js
const jogo = comMinimo(comMinimo({ id: 'cedo', nome: 'cedo', dica: 'cedo', inicia() {},
  atualiza(q) { chamadas++; return q.t > 0.1 ? 1 : undefined; } }));
// ...
jogaConferindo(p, () => {});      // falha se fechar antes de 4,95 s
assert.equal(p.vencedor, 1);
assert.ok(chamadas < 20, 'depois de decidir o minijogo nao e mais atualizado');
```

**Verde.** Com o código atual (os símbolos do relatório do Node foram trocados por palavras):

```text
passou: comMinimo: resultado valido antes de 5 s fica guardado e sai igual aos 5 s; aplicar duas vezes nao muda nada
pass 1
fail 0
```

**Vermelho.** Para ver o teste falhar pelo motivo certo, sem mexer no repositório, fez-se uma cópia de `logica.mjs`, `jogos/`, `tela.html` e do three.js numa pasta temporária e apagou-se a guarda de tempo da trava. Na linha de `comMinimo` que decide guardar o resultado:

```js
// original
if (r !== undefined && p.t < T_MIN_RODADA && resultadosValidos(p).includes(r)) { d.fimCedo = r; return undefined; }
// mutação feita só na cópia: a trava nunca segura o resultado
if (r !== undefined && false && resultadosValidos(p).includes(r)) { d.fimCedo = r; return undefined; }
```

Rodando o mesmo teste na cópia:

```text
falhou: comMinimo: resultado valido antes de 5 s fica guardado e sai igual aos 5 s; aplicar duas vezes nao muda nada
pass 0
fail 1
  AssertionError [ERR_ASSERTION]: fechou com 0.12 s
    actual: 'resultado',
    expected: 'jogando',
```

A mensagem diz o que quebrou: a rodada fechou com 0,12 s, que é exatamente o defeito que a regra existe para impedir. Desfazer a mutação traz o teste de volta ao verde.

Esta demonstração é uma mutação feita para este documento, não o histórico de commits do projeto. O ciclo na prática é o mesmo: o teste é escrito primeiro, é visto falhando por um motivo que faça sentido, e só então se escreve o código.

## Como acrescentar um teste

1. Escreva o teste antes do código e rode só o arquivo (`node --test arquivo.test.mjs`).
2. Confira que falha, e que a mensagem aponta para o comportamento que falta.
3. Escreva o menor código que o faz passar.
4. Rode `npm test` inteiro. Um ajuste em um minijogo pode quebrar a trava dos 5 segundos ou a rotação.
5. Acrescente a linha na tabela de rastreabilidade da spec correspondente, com o nome exato do teste.
