import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './ultimo-golpe.mjs';

// Partida sem varrida. O jogador "i" corre para o chefao e da o empurrao.
function semOnda() {
  const p = partidaCom(jogo);
  p.dados.prox = 999;
  return p;
}
function golpeia(p, i) {
  const x = i ? -1 : 1;
  entrada(p, i, { x, y: 0, n: 0 }); passo(p, DT);
  entrada(p, i, { x, y: 0, n: 1 });
  roda(p, 0.8);
}

test('ultimo-golpe: trombar com empurrao tira vida, conta o golpe e joga o jogador para tras', () => {
  const p = semOnda();
  golpeia(p, 0);
  assert.equal(p.dados.vida, 15);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.dados.golpe.quem, 0);
});

test('ultimo-golpe: encostar sem empurrao nao tira vida e ninguem atravessa o chefao', () => {
  const p = semOnda();
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 3);
  assert.equal(p.dados.vida, 16);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.ok(p.jogadores[0].x <= -2.99, 'ficou do lado de fora da esfera');
});

test('ultimo-golpe: vence quem da o golpe final, mesmo tendo batido menos', () => {
  const p = semOnda();
  p.dados.vida = 1; p.dados.placar = [9, 0];
  golpeia(p, 1);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.dados.placar, [9, 1]);
});

test('ultimo-golpe: avisa quando falta 1 golpe', () => {
  const p = semOnda();
  p.dados.vida = 2;
  golpeia(p, 0);
  assert.equal(p.dados.vida, 1);
  assert.equal(p.dados.aviso, 'FALTA 1 GOLPE!');
  roda(p, 3);
  assert.equal(p.dados.aviso, '', 'o aviso some para nao tapar a tela');
});

test('ultimo-golpe: a varrida atordoa e afasta quem esta colado; quem esta longe ou no ar escapa', () => {
  let p = partidaCom(jogo);
  p.dados.prox = 0.01;
  p.jogadores[0].x = -3.2;
  roda(p, 1);
  assert.ok(p.dados.tonto[0] > 0, 'o colado ficou atordoado');
  assert.equal(p.dados.tonto[1], 0, 'o que estava longe nao');
  assert.equal(p.jogadores[0].turbo, 0);
  roda(p, 1.2);
  assert.equal(p.jogadores[0].turbo, 1, 'o atordoamento passa');
  assert.ok(p.jogadores[0].x < -5, 'foi jogado para longe');

  p = partidaCom(jogo);
  p.dados.prox = 999; p.dados.carga = 0.3;
  p.jogadores[0].x = -3.2;
  entrada(p, 0, { x: 0, y: 0, nb: 0 }); passo(p, DT);
  entrada(p, 0, { x: 0, y: 0, nb: 1 });
  roda(p, 0.5);
  assert.equal(p.dados.ondas, 1);
  assert.equal(p.dados.tonto[0], 0, 'pulou a onda');
});

test('ultimo-golpe: atordoado nao consegue golpear', () => {
  const p = semOnda();
  p.jogadores[0].x = -3.2; p.dados.tonto[0] = 1;
  entrada(p, 0, { x: 1, y: 0, n: 0 }); passo(p, DT);
  entrada(p, 0, { x: 1, y: 0, n: 1 });
  roda(p, 0.5);
  assert.equal(p.dados.vida, 16);
});

test('ultimo-golpe: tempo acaba com o chefao vivo, empate', () => {
  const p = semOnda();
  p.dados.placar = [7, 2]; p.dados.vida = 7;
  roda(p, 39);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, -1);
});

test('ultimo-golpe: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('ultimo-golpe: com a carta dash o empurrao tambem conta como golpe', () => {
  const p = semOnda();
  const j = p.jogadores[0];
  j.carta = 'dash';
  entrada(p, 0, { x: 1, y: 0, n: 0 });
  j.cd = 0.03; passo(p, DT);                     // a recarga acaba de fechar: o proximo empurrao sai com cd 0.5 sobre uns 0.01
  entrada(p, 0, { x: 1, y: 0, n: 1 });
  roda(p, 0.8);
  assert.equal(p.dados.vida, 15);
  assert.deepEqual(p.dados.placar, [1, 0]);
});
