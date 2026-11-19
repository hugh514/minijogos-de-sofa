# Como contribuir

Este guia mostra como criar um minijogo novo, com o teste escrito primeiro. Para mudar o motor, o servidor ou o controle, o caminho é o mesmo, descrito no fim.

Leia antes, pelo menos uma vez:

- [`jogos/LEIA.md`](jogos/LEIA.md): o contrato completo do minijogo (campos, a partida `p`, controle, desenho, modos, testes).
- [`jogos/ESTILO.md`](jogos/ESTILO.md): o padrão visual e de jogo, que um minijogo precisa cumprir para entrar na rotação.
- [`specs/`](specs/README.md): as especificações das funcionalidades centrais. Em especial a [001 (contrato do minijogo)](specs/001-contrato-do-minijogo/spec.md), a [005 (rotação)](specs/005-rotacao-e-variedade/spec.md) e a [006 (regra dos 5 segundos)](specs/006-regra-dos-5-segundos/spec.md).
- [`docs/TESTES.md`](docs/TESTES.md): o que cada camada de teste garante.

## Preparar o ambiente

Precisa de Node 22 ou mais novo.

```bash
npm install                          # traz o three.js e o Playwright
npm test                             # deve passar antes de você mexer em qualquer coisa
```

## Passo a passo: um minijogo novo

### 1. Escreva a regra em frases verificáveis

Antes de abrir o editor, escreva em poucas linhas o que precisa ser verdade. Cada linha vira um teste. Exemplo para um jogo de cabo de guerra:

- Apertar no verde puxa a corda para o seu lado, e a corda no limite dá a vitória.
- Apertar no vermelho faz escorregar para o lado do outro.
- Se ninguém decide, o tempo acaba em empate.

Para um minijogo, essas frases moram nos nomes dos testes. Não precisa de uma pasta em `specs/`. Uma nova pasta de especificação é para uma funcionalidade central nova (por exemplo, um modo de jogo).

Decida também onde o jogo entra:

- **Duelo** (2 jogadores): sem o campo `festa`. Cada rodada vale 1 ponto.
- **Festa** (2 a 4 jogadores): com `festa: { min, max, modos }`, em que `modos` tem `vs` (cada um por si), `times` (duplas, só com 4) e `coop` (todos juntos). O que `atualiza` devolve muda com o modo: veja a tabela em `jogos/LEIA.md`, seção "Modo Festa", e a [spec 004](specs/004-modo-festa-e-duplas/spec.md).

Escolha também o `genero`, de uma lista fechada (`empurra`, `corrida`, `mira`, `reflexo`, `ritmo`, `memoria`, `blefe`, `gol`, `equilibrio`). Ele ajuda a rotação a não repetir o mesmo tipo de jogo em seguida.

### 2. Trabalhe fora da pasta `jogos/`

A tela confere `jogos/` a cada 8 segundos e põe qualquer arquivo novo na rotação sozinha, com o servidor ligado. Para um arquivo pela metade não entrar numa partida, o manual sugere trabalhar em `em-obras/<id>.mjs` e `em-obras/<id>.test.mjs` e copiar os dois para `jogos/` só quando o teste passar. Essa pasta é temporária e não deve ir para o commit.

O `id` usa minúsculas, números e hífen (`meu-jogo`). Os imports do teste funcionam igual de `em-obras/` e de `jogos/`.

### 3. Escreva o teste primeiro e veja-o falhar

Crie `em-obras/meu-jogo.test.mjs` com o primeiro critério. Use o apoio de `jogos/_teste.mjs`: `partidaCom` põe a partida no primeiro quadro de jogo, `roda` avança o tempo e `entrada` simula o celular. Veja `jogos/cabo.test.mjs` como exemplo curto e `jogos/bola-neve.test.mjs` como exemplo maior.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './meu-jogo.mjs';

test('meu-jogo: apertar no verde puxa a corda e vence', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: 0, n: 0 });                 // o primeiro envio fixa a base do contador
  for (let k = 1; k <= 30; k++) { entrada(p, 0, { x: 0, y: 0, n: k }); passo(p, DT); }
  assert.equal(p.vencedor, 0);
});
```

Rode:

```bash
node --test em-obras/meu-jogo.test.mjs
```

O teste tem de falhar. Se o arquivo do jogo ainda não existe, a falha é "Cannot find module", o que já conta como vermelho. Depois de criar o esqueleto do jogo (passo 4), exija que falhe por causa da regra, não por erro de digitação. Um teste que passa sem código novo não prova nada.

### 4. Escreva o minijogo mínimo

Crie `em-obras/meu-jogo.mjs` com os campos obrigatórios e só o necessário para o teste passar:

```js
export default {
  id: 'meu-jogo', genero: 'reflexo', nome: 'Meu jogo', dica: 'A regra em uma frase',
  controle: { modo: 'botao', a: 'PUXA!' },
  inicia(p) { /* arena, posição dos jogadores e p.dados */ },
  atualiza(p, dt) { /* devolve 0 ou 1 (vencedor), -1 (empate) ou undefined (segue) */ },
  monta(c) { /* objetos 3D, uma vez */ },
  desenha(c, dt, t) { /* atualiza os objetos a partir de p.dados */ },
};
```

Regras que o motor cobra (detalhes em `jogos/LEIA.md`):

- `inicia` e `atualiza` rodam em Node: nada de `window`, `document` ou three.js ali. O visual fica em `monta` e `desenha`.
- Use `p.rng()` no lugar de `Math.random()`, para os testes se repetirem iguais.
- Para "apertou", use `j.apertouA` e `j.apertouB`, nunca `j.ent.d`, senão um toque curto se perde.
- A rodada sempre termina sozinha, em no máximo 60 s, mesmo com os dois parados.
- Nunca lance exceção nem gere `NaN`. Um minijogo que dá erro sai da rotação.
- Em Duplas, `atualiza` devolve o time (`0` ou `1`). Em Todos juntos, devolve `2` (venceram) ou `-1` (fracassaram).
- Textos em português do Brasil, com acentos, sem emoji e sem travessão, em caixa normal ("Empurre!", não "EMPURRE!").

### 5. Repita: um critério por vez

Para cada frase da lista do passo 1, escreva o teste, veja falhar, escreva o código mínimo, veja passar. Além das regras do jogo, cubra sempre:

- **Empate** e **fim por tempo**.
- **`fumaca`**, que é obrigatória: `fumaca(jogo)` roda a rodada parada e 15 vezes com dedos aleatórios, chamando `monta` e `desenha` de verdade. Em minijogo de festa, passe `{ n, modo }` para cada combinação que o `festa` declara, como em `jogos/zumbis-coop.test.mjs`.
- Para minijogo da Festa, **cada valor de retorno do modo** (índice do vencedor, time, ou `2`).
- Para cooperativo, a **dificuldade**: um robô lento que vence a maioria das noites e jogadores parados que perdem. Veja o [ADR 0004](docs/adr/0004-dificuldade-do-cooperativo-travada-por-robo-lento.md) e `jogos/zumbis-coop.test.mjs`.

### 6. Entre na pasta e rode tudo

Com o teste do jogo verde:

```bash
cp em-obras/meu-jogo.mjs em-obras/meu-jogo.test.mjs jogos/
npm test
```

O `npm test` inclui `jogos/minimo-5s.test.mjs`, que confere, com a trava da tela ligada, que nenhuma rodada do seu jogo acaba antes de 5 segundos, nem com toque em todo quadro. Se falhar, o seu jogo decide cedo demais (veja a [spec 006](specs/006-regra-dos-5-segundos/spec.md) e o [ADR 0003](docs/adr/0003-trava-de-5-segundos-na-tela.md)). O teste da rotação (`logica.test.mjs`) também confere que o `genero` é da lista fechada.

Remova `em-obras/` do que for para o commit.

### 7. Confira na tela

Teste unitário não vê o jogo. Antes de pedir revisão:

1. Suba o servidor com `npm start` e abra `http://localhost:8080` no PC. Abra `/c` em um ou mais celulares, ou em abas do navegador no modo celular.
2. Aperte `N` na tela para pular para o próximo da rotação até o seu jogo aparecer.
3. Jogue uma rodada inteira. Confira cada item de [`jogos/ESTILO.md`](jogos/ESTILO.md): legibilidade a 2 ou 3 metros da TV (objetos importantes com no mínimo 40 px de altura numa tela de 1280x720), câmera, controle do celular, ritmo, tema e som.
4. Tire prints do começo, do meio e do fim da rodada e do celular. Pergunte-se: no print do meio, dá para dizer em 1 segundo quem está ganhando?
5. Se o seu jogo mexe no que é compartilhado (menu, modos, controle), rode também `npm run e2e` (precisa de `npx playwright install chromium` uma vez).

### 8. Modelos 3D, se usar

Só modelos com licença CC0, com o `License.txt` do pacote ao lado em `modelos/<pacote>/`. Liste-os em `modelos: ['pacote/arquivo']` e sempre tenha um desenho de reserva para quando `c.modelo(...)` devolve `null`. Veja o [ADR 0005](docs/adr/0005-modelos-e-fonte-de-terceiros-com-licenca-ao-lado.md).

### 9. Peça revisão

Abra o pull request com o diff, o que o jogo faz e como foi verificado (saída do `npm test` e os prints). Quem revisa lê o diff junto com os critérios, sem depender da conclusão de quem escreveu. Resolva os achados críticos e importantes antes de mesclar.

## Mudar o motor, o servidor, o controle ou um modo

Aqui existe especificação em `specs/`. O caminho:

1. Leia a spec da área (por exemplo, [`002-servidor-carteiro`](specs/002-servidor-carteiro/spec.md) para o servidor, [`003-controle-no-celular`](specs/003-controle-no-celular/spec.md) para o controle).
2. Se a mudança cria ou altera um comportamento, escreva ou ajuste o requisito e o critério de aceite primeiro.
3. Escreva o teste do critério, veja falhar, escreva o código mínimo.
4. Preencha a tabela de rastreabilidade com o arquivo e o nome exato do teste. Se um critério ficar sem teste, escreva "sem teste automatizado".
5. Se a mudança é uma decisão de projeto difícil de desfazer (uma dependência nova, o que o servidor guarda, uma regra do motor), acrescente um registro curto em [`docs/adr/`](docs/adr/) com contexto, decisão e consequências.

Cuidados que valem para o servidor: não acrescente dependência de execução sem necessidade real (o projeto tem uma, o three.js), não sirva arquivo por caminho vindo da URL sem uma expressão regular fechada e não confie em nenhum campo que vem do celular.

## Texto e estilo

- Português do Brasil, com acentos, frases diretas.
- Sem travessão e sem emoji, nos textos do jogo e na documentação.
- Mecânica original: não copie nome, personagem, fase nem visual de jogo existente.
