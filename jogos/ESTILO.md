# Padrão visual e de jogo

Todo minijogo novo ou alterado passa por esta lista antes de entrar na rotação. Cada regra veio de um problema real achado na auditoria de 2026-11-13. "Parece pronto nos testes" não basta: quem joga está no sofá, a 2 ou 3 metros da TV.

## 1. Legibilidade na TV

- Personagem, bola, peça ou alvo que importa para a jogada tem no mínimo 40 px de altura numa tela de 1280x720. Pino de 10 px e tanque de 30 px reprovaram.
- Nada importante fica embaixo do placar (topo), do título ou do cartão de texto. A faixa de cima (até 18% da altura) é do placar. Objetos ficam entre 20% e 85%.
- O nome "Jogador N" não pode cobrir o objeto da jogada. Se cobrir, o minijogo sobe o objeto (y + 2,2) ou esconde o nome.
- Contraste: objeto da jogada nunca usa a cor de um jogador nem a cor do fundo. Nada translúcido para coisa que precisa ser vista.
- Os dois lados da arena se veem igual. Quem joga "no fundo" não pode ficar menor nem escondido (o rebate reprovou).

## 2. Câmera

- A câmera mostra o que decide a rodada. Disputa de altura pede câmera de lado, corrida pede câmera atrás (tela dividida via `cameras()`), arena pede câmera alta.
- Nada alto entre a câmera e o jogador: ponte, poste, caixa alta. Paredes de labirinto têm no máximo 0,8 de altura.
- Teste: no print do meio da rodada, dá para dizer em 1 segundo quem está ganhando? Se não, a câmera ou o placar estão errados.

## 3. Controle no celular

- Joystick só aparece se mexe em alguma coisa (`controle.joystick: false` quando não mexe).
- Botões com nomes diferentes e do mesmo tamanho quando têm o mesmo peso. Nada de dois botões "PULA".
- Ação que encerra a vez do jogador (derrubar, apostar tudo) pede segurar 1 s, nunca um toque.
- O celular repete a informação essencial em texto curto (lugar, volta, item), mas a TV continua sendo o lugar onde se joga. Regra que só aparece no celular reprovou (cor-mentirosa).
- Vibração é tempero, nunca a única pista: iPhone não vibra.

## 4. Ritmo e pontuação

- Rodada de 20 a 50 s; jogos de gol podem ir a 55 s. Nenhuma rodada pode acabar em menos de 5 s por um toque sem querer (sumô de 0,8 s, empilha de 0,0 s e sequência de 1,8 s reprovaram). A tela garante isso sozinha: se o minijogo decide antes, o resultado fica guardado e a rodada fecha aos 5 s (`comMinimo`, em `logica.mjs`). Mesmo assim, desenhe o jogo para não decidir tão cedo: os segundos parados até fechar não são jogo.
- Primeiro erro não elimina: dê uma vida extra, um escudo de 1 s ou uma espera inicial de 0,8 s.
- Jogo de gol ou ponto vai a um placar que dá virada: 3 gols, 5 pontos ou 10 acertos, com limite de tempo que decide por quem está na frente. "Um gol vence" reprovou (cara ou coroa).
- Sorte pesa no máximo um terço. Quem joga melhor ganha a maioria das vezes.

## 5. Cara de jogo, não de template

- Proibido: cartão de vidro roxo genérico, gradiente sem motivo, emoji como ícone de interface, texto em caixa alta em todo lugar, borda brilhante em tudo.
- Cada minijogo tem um tema (lugar, época, material) e todos os objetos seguem esse tema. Cubos e esferas cruas só como peça provisória.
- Pode usar modelo 3D pronto, desde que a licença seja CC0 (ex.: Kenney, Quaternius) e o arquivo de licença fique ao lado, em `modelos/<pacote>/`. Nada baixado na hora do jogo: tudo local, a casa pode estar sem internet.
- Animação com intenção: antecipação antes do golpe, tremida no impacto, partícula curta. Partícula não pode esconder o boneco (o kart reprovou na 1ª versão).
- Som em todo evento que muda o placar, com timbre próprio do tema.

## 6. Como provar

- Playwright headless com GPU (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`), nunca janela na tela de quem está usando o PC.
- Prints do começo, do meio e do fim da rodada, e do celular. Quem despacha abre cada print e confere esta lista item por item.
- O teste do minijogo cobre: a rodada não acaba em menos de 5 s por um toque, o placar chega ao alvo, e o limite de tempo decide.
