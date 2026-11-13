import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './sequencia.mjs';

function nova() {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nop: 0 });
  return p;
}
function toca(p, i, op) { entrada(p, i, { x: 0, y: 0, op, nop: p.jogadores[i].nop + 1 }); passo(p, DT); }

test('sequencia: turnos alternam e a sequencia cresce uma cor por vez', () => {
  const p = nova(), a = p.dados.vez, b = 1 - a;
  assert.equal(p.celular[a].modo, 'opcoes'); assert.equal(p.celular[b].modo, 'espera');
  toca(p, a, 2);
  assert.deepEqual(p.dados.seq, [2]); assert.equal(p.dados.vez, b);
  assert.equal(p.celular[b].modo, 'opcoes'); assert.equal(p.celular[a].modo, 'espera');
  toca(p, b, 2); toca(p, b, 0);
  assert.deepEqual(p.dados.seq, [2, 0]); assert.equal(p.dados.vez, a);
  toca(p, a, 2); toca(p, a, 0); toca(p, a, 3);
  assert.deepEqual(p.dados.seq, [2, 0, 3]);
  assert.equal(p.fase, 'jogando');
});

test('sequencia: o primeiro erro e perdoado (vida extra) e o segundo perde', () => {
  const p = nova(), a = p.dados.vez, b = 1 - a;
  toca(p, a, 1);
  toca(p, b, 3);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[b].vivo, true);
  toca(p, b, 3);
  assert.equal(p.vencedor, a);
  assert.equal(p.jogadores[b].vivo, false);
});

test('sequencia: toque de quem nao esta na vez e ignorado', () => {
  const p = nova(), a = p.dados.vez, b = 1 - a;
  toca(p, b, 1);
  assert.deepEqual(p.dados.seq, []); assert.equal(p.dados.vez, a); assert.equal(p.fase, 'jogando');
});

test('sequencia: demorar mais de 4 s num toque perde', () => {
  const p = nova(), a = p.dados.vez;
  roda(p, 3.5);
  assert.equal(p.fase, 'jogando');
  toca(p, a, 0);                       // o toque renova o prazo, agora para o outro
  roda(p, 3.5);
  assert.equal(p.fase, 'jogando');
  roda(p, 1);
  assert.equal(p.vencedor, a);
});

test('sequencia: no limite de 55 s sem erro, empata', () => {
  const p = nova();
  while (p.fase === 'jogando') {       // os dois jogam perfeito, um toque a cada 2 s
    const d = p.dados, i = d.vez;
    roda(p, 2);
    if (p.fase === 'jogando') toca(p, i, d.pos < d.seq.length ? d.seq[d.pos] : 1);
  }
  assert.equal(p.vencedor, -1);
});

test('sequencia: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});

test('sequencia: o erro perdoado nao acende nem toca a cor errada, e a dica fala do perdao', () => {
  const p = nova(), a = p.dados.vez, b = 1 - a;
  toca(p, a, 1);
  toca(p, b, 3);
  const fx = p.dados.fx.at(-1);
  assert.equal(fx.ok, false);
  assert.equal(fx.cor, -1, 'sem cor para acender');
  assert.match(jogo.dica, /Segundo erro/);
});
