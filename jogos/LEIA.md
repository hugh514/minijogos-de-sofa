# Como criar um minijogo

Jogo de festa para 2 a 4 jogadores na mesma sala. O PC mostra a tela 3D (three.js) e cada jogador usa o celular como controle, tudo na rede local. Cada minijogo é uma rodada curta (20 a 50 s; jogos de gol podem ir a 55 s) que vale 1 ponto.

Há dois modos, escolhidos no menu do celular do Jogador 1 (o anfitrião) antes de começar:

- **Clássico**: exatamente 2 jogadores e os minijogos sem o campo `festa` (todos os que estão neste manual, fora a seção "Modo Festa"). Nada neles muda com 3 ou 4 jogadores: os celulares 3 e 4 só assistem. Em Duplas eles também entram, em revezamento: joga um de cada dupla e o minijogo recebe `vista(p)`, com `p.jogadores`, `p.celular` e `p.nomes` só dos dois da vez. Por isso use sempre `p.jogadores`, `c.cores` e `c.bonecos` (nunca o índice de um lugar fixo da tela) e devolva `0` ou `1` como sempre.
- **Festa**: de 2 a 4 jogadores, em três submodos (todos contra todos, times 2x2 e cooperativo), com minijogos próprios que declaram `festa` (seção "Modo Festa", no fim).

Um minijogo é **um arquivo** `jogos/<id>.mjs` com `export default { ... }`, mais o teste `jogos/<id>.test.mjs`. A tela confere a pasta `jogos/` a cada 8 s e põe o arquivo novo na rotação sozinha, com os celulares conectados. Por isso:

- Trabalhe em `em-obras/<id>.mjs` e `em-obras/<id>.test.mjs`. Só copie os dois para `jogos/` quando `node --test em-obras/<id>.test.mjs` passar.
- Não altere nenhum outro arquivo. Não reinicie o servidor. Não abra navegador (a conferência visual é feita depois, por quem despachou).
- `id`: minúsculas, números e hífen. Exemplo completo e curto: `jogos/cabo.mjs` e `jogos/cabo.test.mjs`. Exemplos com joystick: os minijogos dentro de `logica.mjs` (o desenho deles está em `DESENHO`, no `tela.html`).

## Formato

```js
import { posiciona, quemSobrou, maiorPlacar, elimina, pontoNoCirculo, colide, RAIO } from '../logica.mjs';

export default {
  id: 'meu-jogo', nome: 'Nome na tela', dica: 'Regra em uma frase curta, entendida em 3 segundos',
  // opcionais:
  genero: 'corrida',    // para a rotacao nao repetir o tipo de jogo (ver "Rotação e variedade"). Um de: empurra corrida mira reflexo ritmo memoria blefe gol equilibrio
  controle: { modo: 'padrao', a: 'EMPURRA', b: 'PULA' },   // o que o celular mostra (ver "Controle")
  semMovimento: true,   // o motor não move os bonecos pelo joystick (você posiciona j.x / j.z)
  semDash: true,        // botão A não dá o empurrão padrão
  empurrao: 1.2,        // força do choque entre os dois bonecos (parâmetro k de colide; padrão 1.2, a batata quente usa 2.3)
  semPulo: true,        // botão B não pula
  semMod: ['lua'],      // modificadores de rodada que não podem sair neste minijogo (ids: ouro, gelo, foguete, espelho, lua)
  semCarta: ['pulo'],   // cartas de poder que não são oferecidas neste minijogo (ids: dobro, moedas, escudo, turbo, dash, pulo)
  rotulo: 'moedas',     // texto do placar da rodada, se você mantiver p.dados.placar = [a, b]
  duracao: 25,          // se a rodada tem tempo fixo, a tela mostra a contagem regressiva
  coop: true,           // cooperativo: os dois jogam juntos (ver "Minijogo cooperativo")
  semNome: true,        // esconde o nome flutuante ("Jogador N") em cima dos bonecos (kart: o nome do rival atrás da câmera atrapalha)
  tema: 4,              // fixa o cenário (céu, mar, enfeites) em vez de sortear pelo id: índice em TEMAS do tela.html (0 dia azul, 1 pôr do sol, 2 noite, 3 doce rosa, 4 verde-água, 5 deserto, 6 neve, 7 roxo escuro). Use quando as cores do minijogo somem no cenário sorteado
  modelos: ['pacote/arquivo'],   // modelos 3D que a tela baixa antes da rodada (ver "Modelos 3D"). Sem a lista o modelo pode não ter chegado na 1ª rodada

  inicia(p) { ... },            // monta a rodada: p.arena, posição dos jogadores, p.dados
  atualiza(p, dt) { ... },      // a cada quadro (dt em segundos). Devolve 0 ou 1 (vencedor), -1 (empate) ou undefined (segue)
  monta(c) { ... },             // cria os objetos 3D da rodada (uma vez)
  desenha(c, dt, t) { ... },    // a cada quadro: atualiza os objetos 3D a partir de p.dados
};
```

`inicia` e `atualiza` rodam também no node (testes): nada de `window`, `document` ou three ali. Tudo que é visual fica em `monta` e `desenha`. Todo o estado da rodada mora em `p.dados` (é zerado a cada rodada).

## A partida `p`

- `p.rng()`: use no lugar de `Math.random()` (os testes dependem disso).
- `p.t`: segundos desde o começo da rodada. `p.fase`: `'intro' | 'jogando' | 'resultado' | 'fim'` (`atualiza` só roda em `'jogando'`).
- `p.arena`: o chão e as paredes, que a tela desenha sozinha. Opções:
  - `{ tipo: 'circulo', raio: 8, parede: true }` (com `parede: false` quem sair da borda cai e fica `vivo = false`)
  - `{ tipo: 'ret', lx: 11, lz: 6.5, parede: true }` (meia-largura e meia-profundidade; cabe bem na tela até `lx` 11 e `lz` 9)
- `p.jogadores[i]` (0 e 1 no Clássico; de 0 a `p.n - 1` na Festa), cada `j` tem:
  - posição `j.x`, `j.z` (chão; x cresce para a direita, z cresce para perto da câmera), altura `j.y`, velocidade `j.vx`, `j.vz`, `j.vy`
  - `j.vivo` (use `elimina(p, j)` para tirar alguém: o boneco voa e cai), `j.turbo` (multiplica a aceleração, 1 é o normal)
  - `j.ent`: `{ x, y, d, b }`, o joystick ou toque (-1 a 1) e se A / B estão apertados agora
  - `j.apertouA`, `j.apertouB`: quantos toques chegaram desde o último quadro (0 se nenhum). Use isto para "apertou", nunca `j.ent.d`, senão toque curto se perde
  - `j.escolha`: índice da opção tocada no celular neste quadro, ou -1
- `j.empurroes`: quantos empurrões (A) o jogador deu na rodada; soma 1 a cada dash de verdade e zera a cada rodada. Para detectar "acabou de empurrar", compare com o valor do quadro anterior (`j.empurroes > d.empAntes[i]`). Não use a recarga `j.cd`: a carta dash a reduz pela metade e o salto dela deixa de ser visível.
- O motor já faz: andar com inércia pelo joystick, empurrão (A, com recarga), pulo (B), choque entre os dois bonecos (`p.tocou` fica true no quadro em que encostam) e paredes. Raio do boneco: `RAIO` (0.8).
- Nome de quem joga: `quem(p, i)` (de `logica.mjs`) devolve o nome do perfil do lugar `i` (a tela põe `p.nomes`) ou "Jogador N" sem perfil. Use em texto novo de `aviso` e de `p.celular[i].texto`. Texto antigo com "Jogador N" a tela troca sozinha pelo nome (`trocaNomes`), e todo texto de minijogo passa por `textoSeguro` (sem `undefined`, `NaN`, `null` nem objeto cru). Escreva em caixa normal: "Empurre!", não "EMPURRE!".
- `p.eventos.push(nome)`: som pronto. Nomes: `'dash' 'pulo' 'batida' 'moeda' 'troca' 'queda' 'explosao' 'gol' 'ponto'`.
- `p.dados.inventario = [['Bombas 3', 'Fogo 2'], ['Bombas 2']]`: textos curtos (até 5 por jogador) que aparecem como selos embaixo do cartão de cada jogador. Número no fim do texto fica em destaque. Exemplo: o `labirinto` em `logica.mjs`.
- `p.dados.placar = [a, b]`: aparece no topo da tela. `p.dados.aviso = 'TEXTO'` (e `p.dados.avisoCor = '#ff4a4a'`): texto gigante no meio da tela durante a rodada; string vazia some.

Funções prontas (importe de `../logica.mjs`): `posiciona(p, x, z)` (põe o jogador 1 em (-x,-z) e o 2 em (x,z)), `quemSobrou(p)` (vencedor se alguém não está vivo, -1 se os dois caíram, undefined se os dois vivos), `maiorPlacar(p)`, `elimina(p, j, salto)`, `pontoNoCirculo(p, raio)`, `colide(a, b, raioA, raioB, massaA, massaB, k)` (choque entre dois círculos com `x, z, vx, vz`; devolve true se encostou). `k` é a força do choque: 1 é inelástico (os dois seguem juntos), 2 é bola de bilhar (bate e volta). O motor chama com `empurrao` do minijogo, ou 1.2 se não houver. O evento `'batida'` do motor só sai quando a velocidade de aproximação passa de 3 m/s, então bonecos encostados e empurrando não geram som nem tremor a cada quadro; `p.tocou` continua true durante todo o contato.

## Controle (o que aparece no celular)

`controle.modo`:

- `'padrao'`: joystick à esquerda, botões B e A à direita. `a` e `b` trocam o texto dos botões; `b: ''` esconde o B. `joystick: false` esconde o joystick e deixa os dois botões do mesmo tamanho (para jogos que só usam A e B; `semMovimento` não esconde o joystick).
- `'botao'`: um botão gigante (A). Texto em `a`. Bom para apertar rápido, segurar e soltar, apertar no tempo certo.
- `'toque'`: a tela inteira vira área de toque. `j.ent.x / j.ent.y` é a posição do dedo (dentro de um círculo de raio 1, centro no meio), `j.ent.d` diz se o dedo está na tela. Soltar o dedo = `d` passa a false (guarde o estado anterior em `p.dados`). Bom para estilingue e mira.
- `'opcoes'`: até 4 botões grandes com os textos de `opcoes: ['A', 'B', ...]`. A escolha chega em `j.escolha`.
- `'espera'`: só mostra "olhe para a tela do PC".

O celular de cada jogador pode mostrar coisas diferentes e secretas. Em `inicia` ou `atualiza`, escreva em `p.celular[i]` (substitua o objeto inteiro):

```js
p.celular[0] = { modo: 'opcoes', texto: 'Só você vê: a bomba está na caixa 2', opcoes: ['Caixa 1', 'Caixa 2'] };
p.celular[1] = { modo: 'espera', texto: 'Espere a sua vez' };
p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };   // vibra o celular (some o contador)
```

Campos de `p.celular[i]`: `modo`, `a`, `b`, `texto` (uma linha no topo do celular), `opcoes`, `coresOp` (uma cor por opção, em `#rrggbb`), `linha` (`true` põe as opções lado a lado), `joy` (`false` esconde o joystick), `vibra`. O que não for posto vale o `controle` do minijogo. Os jogadores devem olhar para a tela do PC durante a ação: só exija olhar o celular em momentos de decisão.

## Desenho

`c` em `monta(c)` e `desenha(c, dt, t)`:

- `c.THREE`, `c.grupo` (adicione seus objetos aqui; é descartado sozinho no fim da rodada), `c.pecas` (objeto livre para guardar referências), `c.p` (a partida)
- `c.malha(geometria, corHex, extraDoMaterial)`: cria um Mesh com sombra. Ex.: `c.malha(new c.THREE.BoxGeometry(1, 1, 1), 0xff7a2f, { emissive: 0x552200 })`
- `c.pool('nome', n, i => criaMesh)`: garante `n` objetos visíveis desse tipo (cria os que faltam, esconde os que sobram) e devolve a lista. Use para coisas que aparecem e somem (tiros, moedas)
- `c.particulas(x, y, z, corHex, quantidade, forca)`: estouro de faíscas
- `c.cores[i]`: cor atual (hex) de cada jogador; use para tudo que "pertence" a um jogador (não use azul e rosa fixos)
- `c.bonecos[i]`: o boneco 3D de cada jogador (Group). A tela já o coloca em `(j.x, RAIO + j.y, j.z)` a cada quadro. Pode esconder com `.visible = false` (volta sozinho na rodada seguinte)
- `c.som(freq, duracao, tipo, volume)`: bip avulso
- `c.modelo('pacote/arquivo', { altura, escala, proprio })`: clone de um modelo 3D pronto (ver "Modelos 3D"), ou `null` se ele ainda não chegou ou falhou. Sempre tenha a forma simples de antes para o `null`

Unidades: o boneco tem raio 0.8; a arena padrão tem raio 8. Câmera fixa, do alto e inclinada, olhando para o centro. Não há texto 3D: para texto use `p.dados.aviso`, `p.dados.placar` e o celular.

## Modelos 3D

Os modelos prontos (glTF .glb, só licença CC0, ex.: Kenney e Quaternius) ficam em `modelos/<pacote>/<arquivo>.glb`, com o `License.txt` original do pacote ao lado e a textura `colormap.png`. Tudo é local: nada é baixado na hora do jogo. Hoje há `graveyard-kit` (zumbi animado, muros, poste, lanterna, cerca, pinheiros, lápides, abóbora) e `survival-kit` (tábuas, caixa). Para pôr um modelo novo: confira o `License.txt` do pacote (tem que dizer CC0), copie só os arquivos usados e a textura, nomes em minúsculas, números, `-` e `_`.

- Liste os modelos no campo `modelos` do minijogo, para a tela baixá-los antes da rodada, e peça cada um com `c.modelo('graveyard-kit/character-zombie', { altura: 2.9 })`. O nome é `pacote/arquivo`, sem `.glb`.
- Devolve um `Group` novo a cada chamada (a geometria e a textura são compartilhadas, então 20 cópias custam pouco). Pé no chão (y 0) e centrado em x e z. `altura` ajusta o tamanho pela altura; `escala` multiplica o tamanho original (os modelos Kenney são pequenos, de 0.2 a 1.4 unidades). Depois do `c.modelo` você pode mudar `scale`, `position` e `rotation` do grupo (escala diferente em x, y e z estica a peça). Os modelos olham para +z.
- `proprio: true` dá a cada cópia o seu material, para pintar ou piscar uma só (`material.emissive.set(...)`). Sem isso o material é compartilhado e mexer nele muda todas as cópias.
- Se o modelo tem animação, o grupo traz `g.userData.toca('walk', velocidade)` (nomes do zumbi: `idle`, `walk`, `sprint`, `die`, `attack-melee-right`...). A tela avança as animações sozinha, só dos grupos visíveis (use `c.pool` e `visible`).
- **Fallback obrigatório**: `c.modelo` devolve `null` se o glb não carregou. Nesse caso desenhe a forma simples de antes (`const real = c.modelo(...) ?? c.malha(...)`). O teste de fumaça (`jogos/_teste.mjs`) roda as sementes ímpares sem modelos e as pares com modelos de mentira, então os dois caminhos são cobertos.

## Regras de um bom minijogo

1. Regra entendida de relance: a `dica` cabe em uma frase e o verbo principal é óbvio.
2. A rodada **sempre termina sozinha** em no máximo 60 s, mesmo com os dois parados (empate ou decisão por placar).
3. Virada possível até o fim; nada de ficar decidido nos primeiros 3 segundos.
4. Perder tem que ser engraçado de ver (boneco voando, explosão, queda).
5. Funciona com imprecisão: joystick de celular não tem precisão fina. Arena larga, alvos grandes.
6. Mecânica original. Não copie nome, personagem, fase nem visual de jogo existente.
7. Nunca lance exceção nem gere NaN (divisão por zero, vetor de tamanho 0). Minijogo que dá erro é tirado da rotação.
8. Textos em português do Brasil, com acentos, sem emoji e sem travessão.

## Teste

`jogos/_teste.mjs` tem o apoio (importe como `'../jogos/_teste.mjs'`, funciona de `em-obras/` e de `jogos/`):

- `partidaCom(jogo)`: partida já no primeiro quadro de jogo. `roda(p, segundos)`. `DT`.
- `fumaca(jogo)`: roda a rodada inteira parado e 15 vezes com dedos aleatórios, chamando `monta` e `desenha` de verdade (three sem WebGL). Falha se der erro, NaN ou se a rodada não terminar. Devolve a lista de vencedores. **Obrigatório em todo minijogo.**
- `entrada(p, i, { x, y, d, n, b, nb, op, nop })` (de `../logica.mjs`) simula o celular. `n`, `nb` e `nop` são contadores: um toque em A é mandar `n` maior que o anterior (mande uma primeira mensagem com `n: 0` antes). Veja `cabo.test.mjs`.

Além do `fumaca`, teste as regras: quem ganha em cada situação, o empate, e a condição de fim. Rode `node --test em-obras/<id>.test.mjs`.

## Câmera própria (opcional)

Por padrão a câmera fica fixa, do alto e inclinada. O minijogo pode ter `camera(p, t)` retornando
`{ x, y, z, ox, oy, oz }` (posição da câmera e ponto para onde ela olha, em coordenadas do mundo); a tela
suaviza o caminho e mantém o tremor das pancadas. Retornar `null` volta para a câmera padrão. Exemplo: `empilha.mjs`.

Tela dividida: `cameras(p, t)` retornando `[camJogador1, camJogador2]` (cada uma no mesmo formato) divide a tela ao
meio, jogador 1 à esquerda. Serve para câmera de perseguição (corrida). Valor inválido volta para a câmera normal.

## Vibração

A tela já vibra os celulares sozinha em pancada (`batida`), explosão, queda, quando um jogador deixa de estar
`vivo` e no fim da rodada (comemoração para quem venceu, uma vibração longa para quem perdeu). Use
`p.celular[i].vibra` só para momentos que só o seu minijogo conhece (pegou o item, recebeu o balão, foi atingido).
iPhone não tem vibração pelo navegador: lá o celular mostra um clarão vermelho na borda.

## Minijogo cooperativo

Com `coop: true` os dois jogam do mesmo lado. O `atualiza` devolve só:

- `2`: venceram juntos. Cada um ganha 1 ponto (2 numa rodada de ouro) e 10 moedas, e a tela mostra "Vitória em equipe!".
- `-1`: fracassaram juntos. Ninguém pontua, cada um leva 3 moedas.
- `undefined`: a rodada segue.

`0` e `1` num minijogo coop (e `2` num minijogo que não é coop) são retorno inválido: o minijogo sai da rotação, como qualquer erro.
O cartão de explicação mostra "Todo mundo do mesmo lado". Se os dois chegam juntos ao placar final (`p.alvo`), a partida acaba com os dois campeões.
Para a partida nunca ser decidida para um só numa rodada de equipe, o sorteio pula minijogo coop quando só um dos dois está a 1 ponto de vencer.
Cartas de poder não são oferecidas em rodada coop (ficam guardadas para a próxima rodada competitiva). Os testes usam `fumaca` normalmente; ela aceita o `2`.

## Rotação e variedade (`genero`)

O motor sorteia o próximo minijogo de um baralho (`p.fila`), sem repetir ninguém antes de todos saírem, e o campo opcional `genero` ajuda a baralhar tipos de jogo diferentes. O `genero` é de uma lista fechada, `GENEROS` em `logica.mjs`: `empurra`, `corrida`, `mira`, `reflexo`, `ritmo`, `memoria`, `blefe`, `gol`, `equilibrio`. O `registra` recusa outro valor. Sem o campo, vale `controle.modo` (ou `'padrao'`), mas ponha sempre: é uma linha, logo depois do `id`. Escolha pelo que a pessoa faz, não pelo cenário (um jogo de empurrar em arena de gelo é `empurra`).

Regras (todas em `logica.mjs`, sem nada para o minijogo fazer):

- **Baralho sem repetição e distância mínima**: ao montar um baralho novo, o que saiu nas últimas rodadas vai para o fim, de modo que o mesmo id só volta depois de `min(4, elegíveis - 1)` rodadas (e depois de metade do total quando há muitos).
- **Gênero**: nunca o mesmo `genero` 2 vezes seguidas, e nunca 3 seguidas com o mesmo `controle.modo`. A ordem do baralho já nasce assim. Ao sortear, as regras valem nesta ordem de força, e cada camada só é abandonada se ninguém passa nela: coop que cabe, no coop o que ainda não saiu nesta partida, a distância mínima, o gênero e por último o modo (a primeira busca olha só os 6 primeiros da fila). A distância nunca perde para o gênero.
- **Memória entre partidas**: `reinicia` não zera a fila (só `configura`, ao trocar de modo ou de número de jogadores, zera), e o que saiu nas últimas `floor(elegíveis / 2)` rodadas vai para o fim dela. A tela guarda `p.historico` (os ids dos últimos 30 minijogos) no localStorage, na chave `historico-minijogos`, e o passa em `criaPartida(rng, { historico })`. Só entram ids curtos (`[a-z0-9-]`, até 40 caracteres); o resto é descartado.
- **Minijogo novo** que chega com a tela aberta entra em `p.prioridade` (a tela faz `p.prioridade.push(jogo)`): sai na próxima rodada, antes da fila e do gênero, uma vez só.
- **A distância vale mais que o gênero**: o id que saiu nas últimas `max(1, min(4, elegíveis - 1) - 1)` rodadas nunca é sorteado de novo; o gênero e o modo só mandam entre os que sobram.
- **`semMod: ['espelho', 'foguete']`** (opcional, lista de ids de `MODIFICADORES`): modificadores que não fazem sentido no minijogo e que o sorteio nunca lhe dá (hoje só o zumbis-coop).
- **Histórico**: só entra a rodada que de fato começou; ao voltar ao menu ou trocar de modo antes de começar, o id sorteado sai do histórico. O alvo `p.alvo` é recalculado a cada rodada enquanto todos têm 0 pontos (a pasta pode ainda estar carregando).
- **Poucos elegíveis** (menos de 8): minijogo repetido na mesma partida volta com modificador diferente. Com menos de 6 elegíveis o alvo de pontos (`p.alvo`) é 6 em vez de `PONTOS_VITORIA` (10), e a tela mostra `p.alvo`, nunca a constante. "Todos contra todos" com 2 pessoas sorteia também os minijogos do Clássico (menos os `coop`).
- **Cooperativo (5 noites)**: o baralho garante que as 5 noites cubram os minijogos coop distintos antes de repetir um (com 4 coop, a quinta noite é a única repetida, com modificador).

## Cartas de poder (o motor cuida, o minijogo não precisa fazer nada)

Quem perde uma rodada escolhe no celular 1 entre 3 cartas durante a explicação da rodada seguinte, e ela vale só nessa rodada. Há também "Não quero carta", que recusa e já conta como Entendi.
O motor guarda a carta em `j.carta` (`'dobro' 'moedas' 'escudo' 'turbo' 'dash' 'pulo'`, ou `null`) e aplica sozinho:
dobro e escudo mexem no ponto, moedas no prêmio; turbo, dash e pulo multiplicam a aceleração, a recarga do empurrão e a força do pulo
do movimento padrão, e só são oferecidas em minijogo de joystick (`controle.modo` `'padrao'` sem `semMovimento`; dash pede empurrão e pulo pede pulo).
Elas não mexem em `j.turbo`, então minijogo que usa `j.turbo` continua igual. Durante a explicação a escolha das cartas usa o mesmo `op/nop`
do celular, mas `j.escolha` do minijogo só recebe toques na fase `'jogando'`, como antes (para quem tinha carta, a partir de 0,35 s de rodada: um toque atrasado na carta não vira resposta). Evento novo de som: `'carta'` (o motor emite).

## Modo Festa (2 a 4 jogadores)

Um minijogo de festa é um arquivo `jogos/<id>.mjs` como os outros, com o campo novo `festa`, e só entra na rotação da Festa. Os minijogos sem `festa` entram no Clássico, em Cada um por si com 2 pessoas e, em revezamento, em Duplas (os cooperativos, não). Exemplos prontos: `tinta-festa`, `sumo-vidas`, `futebol-times` e `zumbis-coop`.

```js
export default {
  id: 'meu-jogo', nome: 'Nome', dica: 'Regra em uma frase',
  festa: { min: 2, max: 4, modos: ['vs', 'times', 'coop'] },   // só os modos que ele suporta; min e max entre 2 e 4
  duracao: 40, rotulo: 'do chão', sufixo: '%',                   // sufixo (opcional): texto depois de cada número do placar da rodada
  inicia(p) { ... }, atualiza(p, dt) { ... }, monta(c) { ... }, desenha(c, dt, t) { ... },
};
```

`registra` recusa um `festa` torto (min e max fora de 2 a 4, min maior que max, lista de modos vazia ou com modo desconhecido).

**Modos e o que `atualiza` devolve** (`p.modo` diz em qual a partida está; `p.n` é o número de jogadores; `p.jogadores.length` é igual a `p.n`):

| modo | quem joga | `atualiza` devolve | o motor dá ponto a |
| --- | --- | --- | --- |
| `vs` (todos contra todos) | 2 a 4, cada um por si | índice do vencedor (0 a n-1), `-1` empate, `undefined` segue | só o vencedor |
| `times` (2x2, o motor só aceita com 4) | time A = J1 + J3, time B = J2 + J4 | `0` ou `1` (o time), `-1` empate | os dois do time |
| `coop` (todos juntos) | 2 a 4 | `2` (todos vencem), `-1` fracasso | todos (1 ponto cada) |

Retorno fora dessa tabela é retorno inválido: o minijogo sai da rotação, como qualquer erro. A partida da Festa vai a `p.alvo` pontos (10, ou 6 quando há menos de 6 minijogos elegíveis; em times, pontos do time, que valem para os dois do time). O cooperativo é diferente: dura 5 rodadas (`NOITES_COOP`, em `logica.mjs`) e `p.noites` guarda `{ jogadas, vencidas }`. No fim a tela mostra "Sobreviveram a X de 5 noites"; com mais da metade vencida todos são campeões, senão ninguém é. Cartas de poder e anúncios de arcade ficam desligados na Festa nesta primeira versão. As rodadas especiais (modificadores) valem na Festa também, e como há poucos minijogos, um que volta na mesma partida volta sempre com um modificador diferente do da vez anterior (`p.repete` fica `true`). O ouro (2 pontos) não sai no cooperativo, que dura 5 noites. Se o único minijogo de um modo falhar (erro ou retorno inválido), a tela avisa e volta ao menu em vez de repetir o erro (`p.semJogo`). Moedas: quem venceu (ou o time, ou todos) leva 10, os outros 3, empate 5 (fracasso em coop, 3).

Na Festa o minijogo recebe, além do que está acima:

- `p.n`, `p.modo` e `timeDe(p, i)` (de `../logica.mjs`: 0 para J1 e J3, 1 para J2 e J4). Use `venceu(p, i)` depois da rodada, se precisar.
- `posicionaCantos(p, x, z)` (J1 em cima à esquerda, J2 em cima à direita, J3 embaixo à esquerda, J4 embaixo à direita; o time A fica na esquerda) e `posicionaRoda(p, raio)` (em roda, com os times nas diagonais) no lugar de `posiciona`, que só serve a 2 jogadores.
- `c.times` no desenho: `[corDoTimeA, corDoTimeB]` (laranja e roxo). Em times pinte, marque e destaque com `c.times`, nunca com `c.cores`; nos outros modos use `c.cores[i]`. `c.bonecos` e `c.cores` têm só os `p.n` jogadores. A tela já põe um anel no chão com a cor do time embaixo de cada boneco em times.
- `p.dados.placar` pode ter um valor por jogador (vs) ou por time (times); `p.dados.inventario` tem um item de lista por jogador. Os números aparecem no topo, com as cores do time em times.
- Controle, câmera e a regra de 20 a 50 s (jogos de gol, até 55 s) do ESTILO.md valem iguais. Todo jogador precisa ter o que fazer o tempo todo: ninguém espera a vez de outro.

Para o celular o minijogo continua escrevendo em `p.celular[i]`, uma entrada por jogador. Repita a informação essencial (vidas, porcentagem, gols) no `texto` de cada um, como pede o ESTILO.md.

### Como testar com n jogadores

`jogos/_teste.mjs` aceita um último argumento `{ n, modo }`; sem ele o teste é o do Clássico com 2:

```js
import { partidaCom, roda, fumaca, rodada } from '../jogos/_teste.mjs';
const times = { n: 4, modo: 'times' };
const p = partidaCom(jogo, undefined, times);          // já no primeiro quadro de jogo; registra o minijogo na rotação da Festa
roda(p, 5);
fumaca(jogo, { n: 3, modo: 'vs' });                    // rodada parada + 15 de dedos aleatórios, com monta e desenha de verdade
rodada(jogo, aleatorio, 7, { n: 4, modo: 'coop' });
```

Teste pelo menos: cada valor de retorno do modo, o empate, o limite de tempo, que nenhum toque acaba a rodada em menos de 5 s (a tela aplica `comMinimo` em todo minijogo: se `atualiza` devolve um resultado antes de 5 s, ele fica guardado, `atualiza` não é mais chamado e a rodada fecha aos 5 s com o mesmo resultado; a física segue, então deixe `p.celular` e `p.dados.aviso` no estado final antes de devolver o resultado. Os testes de unidade do minijogo rodam sem a trava, então a regra dos 5 s não se testa neles: quem confere é `jogos/minimo-5s.test.mjs`, com a trava, em todos os minijogos), e `fumaca` com todos os n e modos que o `festa` declara (`fumaca` confere se o vencedor é válido para o modo). Em `times`, `atualiza` devolve o time, nunca o índice do jogador. `logica-festa.test.mjs` cobre o motor (rotação, pontuação por modo, partida com n jogadores) e `server.test.mjs` os lugares 1 a 4 do servidor.

### Menu e partida (o que não é do minijogo)

O celular do Jogador 1 mostra, na espera, o menu de brincadeiras: Duelo (o Clássico, 2 jogadores), Cada um por si (todos contra todos), Duplas (times 2x2, só com os 4 conectados), Todos juntos (cooperativo) e o botão Começar. Brincadeira travada fica cinza com o motivo e, tocada, balança (`aria-disabled`). Na explicação de cada rodada o celular mostra nome, dica e o desenho do controle, e o botão Entendi (antes PRONTO!). A escolha vai por `POST /modo` (`{ j: 1, modo, comeca }`, corpo de até 200 bytes, só de quem se declara Jogador 1: veja abaixo) e a tela mostra o modo e os conectados. Com os Jogadores 1 e 2 conectados e ninguém mexendo no menu, o Clássico começa sozinho depois de 6 s, com a contagem "Duelo começa em 5" na TV e no celular (`texto`). Um 3º ou 4º celular conectado não bloqueia o início: com o Clássico escolhido ele só assiste. Só um modo Festa escolhido pelo Jogador 1 impede o início automático; `Enter` no PC começa já. `V` no PC (ou "Voltar ao menu" nos ajustes) volta ao menu. Se o único minijogo de um modo quebra, esse modo fica desabilitado no menu (`sala.faltas` do celular do J1 traz o motivo) até a página do minijogo ser recarregada com a versão nova. O servidor guarda a última escolha só enquanto a partida não começa: `POST /modo` com `comeca: true` e `POST /modo-limpa` (a tela, ao começar ou voltar ao menu) a esquecem.

**Quem é o Jogador 1.** O `/modo` é aceito de quem manda `j: 1`, e é o próprio celular que se declara Jogador 1 (o slot que ele escolhe ao abrir o controle). Não há autenticação: qualquer aparelho na rede pode se declarar J1 e mudar o modo. Isso é aceito porque o jogo roda só na rede de casa, sem exposição à internet.
