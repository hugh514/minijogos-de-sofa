# 009 Itens de rodada

Arquivos de referência: `logica.mjs` (seção "itens de rodada": `ITENS`, `itemLiberado`, `usaItem`, e os trechos de `entrada`, `move` e `passo`), `controle.html` (catálogo `ITENS`, `compraItem`, `gastaItem`, `lojaItens`, `mostraItens`), `tela.html` (`itensNaTela`, `itensCelular`, `fraseItem`), `server.js` (`recebeEntrada`), `e2e/teste-itens.js`.

## Problema

As moedas ganhas nas rodadas só compravam enfeite (cor, chapéu, pet, rastro, reação). Faltava o que gastar para mexer na disputa: jogar uma bomba no outro, ganhar um impulso. Sem limite, quem tem mais moedas ganharia sempre e a rodada viraria bagunça.

## Para quem

- Quem joga no sofá e quer usar as moedas contra os outros ou a favor de si durante a rodada.
- Quem está atrás no placar e quer uma chance de atrapalhar o líder.

## Requisitos

- RF-1. A Loja do celular tem a aba Itens, com cinco itens comprados por unidade: Bomba (30 moedas), Gelo (25), Turbo (20), Guarda-chuva (25) e Tinta (15). Cada cartão mostra o efeito, o preço e quantos o jogador tem. O estoque vai de 0 a 9 de cada e fica no perfil guardado no celular.
- RF-2. Durante a rodada o celular mostra, no topo, uma barrinha só com os itens que o jogador tem (ícone e quantidade). Ela não cobre o joystick nem os botões. Tocar em um item manda o uso para a tela pelo mesmo caminho do controle (campos `it`, índice do item, e `ni`, contador de toques).
- RF-3. Quem decide é o motor (`usaItem`). Bomba: atordoa o alvo por 1,5 s (joystick zerado, botões e escolhas ignorados; o que o dedo segurava volta a valer quando passa). Gelo: congela o alvo por 2 s e deixa o chão dele liso até 3 s depois em minijogo de joystick; nos outros, 1,2 s parado. Turbo: quem usou anda mais rápido por 4 s, só em minijogo em que o motor move o boneco. Guarda-chuva: bloqueia o próximo item jogado em quem abriu, nesta rodada. Tinta: mancha a tela do celular do alvo por 3 s, sem mexer na regra.
- RF-4. O alvo é o rival mais próximo em minijogo de joystick e o líder do placar da partida nos outros (empate vai para o próximo na roda depois de quem jogou).
- RF-5. Limites: cada jogador usa 1 item por rodada e 3 por partida; nenhum item nos 3 primeiros segundos da rodada, na explicação, nem depois que ela acabou; quem foi atingido fica imune a outro item por 4 s (o item vai para outro rival, e sem rival livre o uso é recusado); quem está atordoado, congelado ou caído não usa.
- RF-6. Item não vale no cooperativo, nunca acerta o parceiro nas Duplas, e quem está de fora da rodada (parceiro no revezamento das Duplas, ou quem descansa com 5 no sofá) não usa nem é alvo. Minijogo que declara `semItens: true` recusa todos.
- RF-7. O estoque só desce quando o motor aceita o uso: a tela devolve ao celular a confirmação com um identificador, e cada identificador desconta uma vez. Uso recusado não gasta e faz a barrinha tremer. Toque repetido com o mesmo contador não conta duas vezes, e tela pausada só acompanha o contador.
- RF-8. A TV mostra o efeito: bomba (ou bola de gelo, ou de tinta) voando de quem jogou até o alvo, explosão de partículas, estrelas girando em quem está tonto, bloco de gelo, rastro do turbo, guarda-chuva sobre quem abriu, e um aviso curto ("Ana jogou uma bomba em Bia"). O cartão do jogador no placar ganha uma ficha com o efeito, que aparece mesmo em minijogo que não mostra o boneco. Cada uso tem som próprio.
- RF-9. Valor torto vindo da rede (índice de item fora da lista, contador que não é inteiro) é descartado no servidor e no motor, sem quebrar nem gastar.

## Critérios de aceite

- CA-1. O catálogo tem os cinco itens, na mesma ordem no celular e no motor, com preço entre 15 e 30 e ícone no celular (RF-1).
- CA-2. A compra é por unidade, só com saldo e até 9 de cada, e estoque salvo torto volta ao padrão (RF-1).
- CA-3. A bomba acerta o rival mais próximo, zera o joystick, ignora botões e escolhas por 1,5 s e depois devolve o controle (RF-3, RF-4).
- CA-4. Sem posição, o alvo é o líder do placar, e o empate segue a roda (RF-4).
- CA-5. O gelo congela 2 s e deixa o chão liso por mais 3 s em minijogo de joystick, e só 1,2 s parado nos outros (RF-3).
- CA-6. O turbo acelera quem usou por 4 s e é recusado, sem gastar, onde o motor não move o boneco (RF-3).
- CA-7. O guarda-chuva bloqueia um item só e vale só na rodada em que foi aberto (RF-3).
- CA-8. A tinta marca o alvo por 3 s sem mexer no controle, e o celular dele fica manchado sem segurar o toque (RF-3).
- CA-9. 1 item por rodada e 3 por partida, por jogador; partida nova zera (RF-5).
- CA-10. Nada nos 3 primeiros segundos, na explicação, nem depois que a rodada acabou (RF-5).
- CA-11. Alvo atingido fica imune por 4 s; sem rival livre o uso é recusado e não gasta; atordoado, congelado e caído não usam (RF-5).
- CA-12. Item não vale no cooperativo, não acerta parceiro nas Duplas, não vale para quem está de fora nem em minijogo `semItens` (RF-6).
- CA-13. O uso pelo celular conta uma vez por toque, o gasto só é registrado quando o motor aceita, e pausado só acompanha o contador (RF-7).
- CA-14. O celular desconta o estoque uma vez por confirmação da tela (RF-7).
- CA-15. Valores tortos da rede não quebram nem gastam, no servidor e no motor (RF-9).
- CA-16. Cada uso vira evento de som e entra no registro `p.itens` da rodada; cada item tem aviso na TV (RF-8).
- CA-17. No navegador: compra pela Loja, barrinha no topo sem cobrir o controle, botões apagados nos 3 primeiros segundos e depois do limite, alvo atordoado sem andar, estoque descontado, aviso na TV, celular manchado de tinta, turbo apagado e bomba no líder em minijogo sem joystick (RF-1 a RF-8).
- CA-18. O efeito é legível do sofá e a barrinha não atrapalha o controle (RF-2, RF-8). Sem teste automatizado: conferido nos prints do `e2e/teste-itens.js`.

## Fora do escopo

- Item para o robô de treino e para o teclado: só o celular usa.
- Item que muda a regra de um minijogo específico. Os efeitos valem iguais para todos, pelo motor; o minijogo que não combina declara `semItens`.
- Guardar o estoque no servidor. Ele fica no celular, como as moedas, e a tela confia no celular (rede de casa).
- Efeito 3D sobre o boneco em minijogo que esconde o boneco: nesses, valem o aviso e a ficha no placar.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `logica-festa.test.mjs`, `controle.test.mjs` | `itens: catalogo com os cinco itens e os limites`; `itens: celular e motor tem os mesmos itens na mesma ordem (so o indice viaja pela rede), com preco na faixa`; `itens: todo item tem icone no celular` |
| CA-2 | `controle.test.mjs` | `itens: compra por unidade, so com saldo e ate 9 de cada`; `itens: estoque salvo torto volta ao padrao (so inteiro de 0 a 9 por item do catalogo)` |
| CA-3 | `logica-festa.test.mjs` | `itens: a bomba acerta o rival mais proximo e o atordoa por 1,5 s (joystick zerado, botoes e escolhas ignorados)`; `itens: o mais proximo e medido pela posicao, nao pelo indice` |
| CA-4 | `logica-festa.test.mjs` | `itens: em minijogo sem posicao (semMovimento ou sem joystick) o alvo e o lider do placar`; `itens: o lider usa o item no melhor colocado dos outros; empate vai para o proximo na roda` |
| CA-5 | `logica-festa.test.mjs` | `itens: gelo congela por 2 s e deixa o chao liso por mais 3 s em minijogo de joystick; nos outros, 1,2 s parado` |
| CA-6 | `logica-festa.test.mjs` | `itens: turbo deixa quem usou mais rapido por 4 s e so vale em minijogo em que o motor move o boneco` |
| CA-7 | `logica-festa.test.mjs` | `itens: o guarda-chuva bloqueia o proximo item jogado em quem abriu, e so um`; `itens: o guarda-chuva vale so na rodada em que foi aberto` |
| CA-8 | `logica-festa.test.mjs`, `e2e/teste-itens.js` | `itens: a tinta marca o alvo por 3 s e nao mexe no controle`; `a mancha nao segura o toque` (mensagem do `assert`) |
| CA-9 | `logica-festa.test.mjs` | `itens: cada jogador usa 1 por rodada e 3 por partida; a partida nova zera` |
| CA-10 | `logica-festa.test.mjs` | `itens: nada nos primeiros 3 s da rodada, na explicacao, nem depois que a rodada acabou` |
| CA-11 | `logica-festa.test.mjs` | `itens: quem foi atingido fica imune por 4 s; o item vai para outro rival e, sem rival livre, nao gasta`; `itens: quem esta atordoado ou congelado nao usa item`; `itens: quem caiu (fora do jogo) nao usa nem e alvo` |
| CA-12 | `logica-festa.test.mjs` | `itens: nao valem no cooperativo`; `itens: em Duplas o parceiro nunca e alvo`; `itens: quem esta de fora da rodada nao usa nem e alvo (Duplas com minijogo de 2 e rodizio com 5)`; `itens: minijogo que declara semItens recusa todos`; `itens: funcionam no Duelo (classico) e nao em minijogo cooperativo do Duelo` |
| CA-13 | `logica-festa.test.mjs` | `itens: pelo celular (it e contador ni), cada toque conta uma vez e o gasto so e registrado quando o motor aceita`; `itens: pausado (semToque) o contador acompanha e o toque nao vale depois` |
| CA-14 | `controle.test.mjs` | `itens: o estoque so desconta quando a tela confirma o uso, e cada confirmacao conta uma vez`; `itens: confirmacao que nao e de um toque deste celular so fica registrada, sem descontar (outro aparelho no mesmo lugar)` |
| CA-15 | `logica-festa.test.mjs`, `server.test.mjs` | `itens: valores tortos vindos da rede nao quebram nem gastam`; `servidor: /in repassa o item usado (it de 0 a 15 e contador ni inteiro) e descarta valor torto` |
| CA-16 | `logica-festa.test.mjs`, `tela.test.mjs` | `itens: cada uso vira evento de som e entra no registro p.itens da rodada (quem, em quem, quando)`; `fraseItem: todo item do motor tem aviso na TV com os nomes de quem jogou e de quem levou` |
| CA-17 | `e2e/teste-itens.js` | o roteiro inteiro (Cada um por si e Duplas com lugares trocados), que termina com a linha impressa `TUDO OK` (só com `npm run e2e`) |
| CA-18 | sem teste automatizado | |
