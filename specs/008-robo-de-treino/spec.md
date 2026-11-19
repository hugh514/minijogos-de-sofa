# 008 Robô de treino

Arquivos de referência: `tela.html` (seção "robô de treino": `trocaRobo`, `roboJoga`, `roboLevanta`, o atalho da tecla B e o parâmetro `?bot`), `e2e/teste-robo.js`.

Esta especificação descreve o robô como está no código hoje. Ele não tem nenhum teste de unidade, porque mora dentro de `tela.html`. A cobertura vem de um script de navegador, `e2e/teste-robo.js`, que roda só com `npm run e2e` (não faz parte do `npm test` nem do CI) e cobre a escolha de lugar, a saída do lugar, o celular que chega no meio da partida, a tecla B e a rodada completa. Quatro critérios ficam sem teste automatizado, e a tabela diz quais.

## Problema

Quem está aprendendo o jogo, ou quer ver um minijogo em ação, nem sempre tem um segundo jogador por perto. Sem um adversário, a rodada do Duelo não anda. Um jogador de mentira, fácil de propósito, deixa a pessoa treinar sozinha.

## Para quem

- Uma pessoa sozinha em frente ao PC que quer treinar os controles ou conhecer os minijogos.
- Quem demonstra o jogo e tem só um celular à mão.

## Requisitos

- RF-1. O robô é ligado e desligado pela tecla B na tela do PC, ou ao abrir a tela com `?bot` no endereço. Ao ligar ou desligar pela tecla, a tela mostra um aviso. `?bot=Ana` dá ao robô o nome "Ana robô"; sem valor, o nome é "Robô". O texto do endereço é entrada de fora e passa pelo mesmo filtro dos nomes de perfil.
- RF-2. O robô escolhe o lugar só no menu, antes de a partida começar. Ele senta no lugar 1 ou 2 que estiver sem celular: com um celular só no lugar 1, senta no 2; com um celular só no lugar 2, senta no 1. Se os dois lugares têm celular que falou nos últimos 2 s, ele fica sem lugar e só assiste.
- RF-3. Durante a partida o robô não troca de lugar. Se um celular some no meio da partida, ele não assume o lugar, e nunca aperta "pronto" por outra pessoa.
- RF-4. O robô joga devagar de propósito: pensa a cada 0,45 s, anda meio sem rumo entre o rival e o meio da arena, aperta A em cerca de 30% dos ciclos, B em cerca de 8%, e escolhe uma opção ao acaso em cerca de 25%.
- RF-5. Na explicação de cada rodada, o robô espera 2,5 s, pega a primeira carta de poder oferecida (ou, sem oferta, diz que entendeu).
- RF-6. Quando chega um celular de verdade no lugar do robô, ele levanta e devolve o nome de perfil que usava. O lugar fica com a pessoa até o fim da partida, mesmo que o celular dela suma depois: o robô só volta a escolher lugar no menu. Ao ser desligado, solta o joystick e os botões, a menos que haja celular de verdade no lugar.
- RF-7. O robô não joga com a tela pausada nem com os ajustes abertos.
- RF-8. Ligar e desligar o robô em qualquer momento não derruba a tela.
- RF-9. O robô usa um nome de perfil próprio, só se o lugar ainda não tem nome.

## Critérios de aceite

- CA-1. Abrir a tela com `?bot` liga o robô sem apertar tecla. Com um celular só no lugar 1, o robô senta no 2, e com um celular só no lugar 2, senta no 1 (RF-1, RF-2).
- CA-2. Com dois celulares de verdade o robô não ocupa lugar, e quando o segundo celular chega o robô levanta e devolve o nome (RF-2, RF-6).
- CA-3. Se um celular some no meio da partida, o robô não assume o lugar e ninguém fica "pronto" por outra pessoa (RF-3).
- CA-4. Com um celular, em qualquer dos dois lugares, o robô lê a explicação, diz que entendeu sozinho e joga a rodada até o fim sem erro de minijogo (RF-4, RF-5).
- CA-5. Apertar B com o robô sentado no menu faz ele levantar e devolver o nome, e um celular só não começa partida sem ele (RF-1, RF-6, RF-8).
- CA-6. A tecla B mostra o aviso "Robô de treino entrou no jogo" ao ligar e "Robô de treino saiu" ao desligar (RF-1). Sem teste automatizado.
- CA-7. Com a partida pausada ou os ajustes abertos, o robô não manda entrada (RF-7). Sem teste automatizado.
- CA-8. O robô perde com frequência para uma pessoa que joga de verdade (RF-4). Sem teste automatizado: é um critério de sensação, não de medida.

- CA-9. Um celular de verdade que entra no lugar do robô no meio da partida fica com o lugar: o robô levanta, devolve o nome e, se o celular some, não volta nem mexe no controle daquele lugar (RF-6).
- CA-10. `?bot=Ana` dá o nome "Ana robô" e `?bot` sozinho dá "Robô" (RF-1). Sem teste automatizado: conferido à mão no navegador.

## Fora do escopo

- Robô nos modos da Festa com 3 ou 4 jogadores. O código do robô trata os lugares 1 e 2.
- Níveis de dificuldade do robô. Ele tem um nível só.
- Robô que joga bem. O robô de teste dos minijogos cooperativos, que existe só dentro dos testes, é outra coisa (ver `specs/007-cooperativo-para-dupla-lenta`).

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `e2e/teste-robo.js` | `com um celular no lugar 1, o robo senta no lugar 2` (mensagem do `assert`); `celular no lugar ${lugar}: o robo no outro` (mensagem do `assert`, para os lugares 1 e 2) |
| CA-2 | `e2e/teste-robo.js` | `chegou o segundo celular: o robo levanta e devolve o nome` (mensagem do `assert`) |
| CA-3 | `e2e/teste-robo.js` | `celular sumiu no meio da partida: o robo nao assume o lugar` e `ninguem apertou pronto por outra pessoa` (mensagens dos `assert`) |
| CA-4 | `e2e/teste-robo.js` | `ok celular no lugar ${lugar}: o robo jogou a rodada inteira` (linha impressa, para os lugares 1 e 2, depois do `assert` `a rodada com o robo fecha sem erro de minijogo`) |
| CA-5 | `e2e/teste-robo.js` | `B com o robo sentado: ele levanta`, `e o nome do lugar volta a ficar vazio` e `sem o robo, um celular so nao comeca partida` (mensagens dos `assert`) |
| CA-6 | sem teste automatizado | |
| CA-7 | sem teste automatizado | |
| CA-8 | sem teste automatizado | |
| CA-9 | `e2e/teste-robo.js` | `chegou gente no lugar do robo: ele levanta`, `o celular sumiu, mas o robo nao volta no meio da partida` e `ninguem mexe no controle do lugar 2` (mensagens dos `assert`) |
| CA-10 | sem teste automatizado | |

Como todos os testes de navegador, `e2e/teste-robo.js` é um script, e a coluna cita a mensagem do `assert` ou a linha que ele imprime. O mesmo script confere também o modo padrão da sala de espera sem robô (escolha antiga de modo repetida a uma tela recarregada), que pertence à spec 004.
