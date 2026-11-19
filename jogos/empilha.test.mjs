import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { L0, V0 } from './empilha.mjs';

// O bloco espera 0.8 s parado no começo; os testes de soltar zeram essa espera (há teste próprio dela).
const nova = () => { const p = partidaCom(jogo); for (const e of p.dados.e) e.espera = 0; return p; };
const est = (p, i) => p.dados.e[i];
const topo = e => e.blocos[e.blocos.length - 1];

// Toque com contador (sem d): o jeito mais comum de apertar no celular.
function toque(p, i, vezes = 1) {
  const j = p.jogadores[i];
  if (j.n === undefined) entrada(p, i, { n: 0 });
  entrada(p, i, { n: j.n + vezes }); passo(p, DT);
}
// Para o bloco que desliza a "desvio" do centro do topo da torre e solta.
function solta(p, i, desvio = 0, vezes = 1) {
  const e = est(p, i);
  e.v = 0; e.bx = topo(e).x + desvio;
  toque(p, i, vezes);
}
const espera = p => roda(p, 0.4);

test('empilha: soltar no centro é perfeito, sem corte, e vale 1 andar', () => {
  const p = nova(), e = est(p, 0);
  solta(p, 0, 0);
  assert.equal(e.blocos.length, 2);
  assert.equal(topo(e).l, L0);
  assert.equal(p.dados.cortes.length, 0);
  assert.deepEqual(p.dados.placar, [1, 0]);
});

test('empilha: a parte que passa da borda é cortada e cai, e o próximo bloco fica mais estreito', () => {
  const p = nova();
  solta(p, 1, 0.8);
  const b = topo(est(p, 1));
  assert.ok(Math.abs(b.l - (L0 - 0.8)) < 1e-9, 'largura ' + b.l);
  assert.ok(Math.abs(b.x - 0.4) < 1e-9, 'centro do que ficou ' + b.x);
  assert.equal(p.dados.cortes.length, 1);
  const c = p.dados.cortes[0];
  assert.equal(c.i, 1);
  assert.ok(Math.abs(c.l - 0.8) < 1e-9 && c.x > b.x + b.l / 2, 'o pedaço cai do lado que sobrou');
  espera(p);
  assert.equal(est(p, 1).l, b.l, 'o bloco que desliza tem a largura do topo');
});

test('empilha: corte do lado esquerdo também funciona', () => {
  const p = nova();
  solta(p, 0, -1);
  const b = topo(est(p, 0));
  assert.ok(Math.abs(b.x + 0.5) < 1e-9 && Math.abs(b.l - (L0 - 1)) < 1e-9);
  assert.ok(p.dados.cortes[0].x < b.x - b.l / 2);
});

test('empilha: quase no centro conta como perfeito e mantém a largura', () => {
  const p = nova();
  solta(p, 0, 0.05);
  assert.equal(topo(est(p, 0)).l, L0);
  assert.equal(topo(est(p, 0)).x, 0);
});

test('empilha: errar o bloco inteiro nao elimina: o bloco cai, a torre fica e a rodada segue', () => {
  const p = nova();
  solta(p, 1, 0); espera(p);
  solta(p, 0, L0 + 0.1);               // o jogador 1 erra o bloco inteiro
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[0].vivo, true);
  assert.equal(est(p, 0).blocos.length, 1, 'nao ganhou andar');
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.dados.cortes.length, 1, 'o bloco inteiro cai');
  roda(p, 1);
  assert.equal(est(p, 0).l, L0, 'o proximo vem com a mesma largura');
  solta(p, 0, 0);
  assert.deepEqual(p.dados.placar, [1, 1], 'continua empilhando');
});

test('empilha: os dois erram juntos e ninguem perde na hora', () => {
  const q = nova();
  est(q, 0).v = est(q, 1).v = 0;
  est(q, 0).bx = 99; est(q, 1).bx = -99;
  entrada(q, 0, { n: 0 }); entrada(q, 1, { n: 0 });
  entrada(q, 0, { n: 1 }); entrada(q, 1, { n: 1 }); passo(q, DT);
  assert.equal(q.fase, 'jogando');
  assert.deepEqual(q.jogadores.map(j => j.vivo), [true, true]);
});

test('empilha: toque sem parar nao acaba a rodada antes dos 30 s', () => {
  const p = nova();
  for (let k = 0; k < 29 * 60; k++) { entrada(p, 0, { n: k }); entrada(p, 1, { n: k }); passo(p, DT); }
  assert.equal(p.fase, 'jogando');
});

test('empilha: toque curto com contador não se perde, e vários toques no mesmo quadro soltam só um bloco', () => {
  const p = nova();
  entrada(p, 0, { n: 0 });
  est(p, 0).v = 0; est(p, 0).bx = 0;
  entrada(p, 0, { n: 4 }); passo(p, DT);       // contador pulou 4: um único bloco
  assert.equal(est(p, 0).blocos.length, 2);
  roda(p, 0.4);
  est(p, 0).v = 0; est(p, 0).bx = 0;
  entrada(p, 0, { d: true, n: 5 }); entrada(p, 0, { d: false, n: 5 }); passo(p, DT);   // apertou e soltou no mesmo quadro
  assert.equal(est(p, 0).blocos.length, 3);
  assert.deepEqual(p.dados.placar, [2, 0]);
});

test('empilha: toque logo depois de soltar um bloco, antes do próximo aparecer, é ignorado sem errar', () => {
  const p = nova();
  solta(p, 0, 0);
  toque(p, 0);
  assert.equal(est(p, 0).blocos.length, 2);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[0].vivo, true);
});

test('empilha: o bloco desliza de um lado ao outro e a velocidade aumenta a cada andar', () => {
  const p = nova(), e = est(p, 0);
  assert.equal(e.v, V0);
  let min = Infinity, max = -Infinity;
  for (let k = 0; k < 600; k++) { passo(p, DT); min = Math.min(min, e.bx); max = Math.max(max, e.bx); }
  assert.ok(min < -2.5 && max > 2.5, `foi de ${min} a ${max}`);
  for (let k = 0; k < 5; k++) { solta(p, 0, 0); espera(p); }
  assert.ok(e.v > V0 * 1.5, 'velocidade ' + e.v);
});

test('empilha: aos 30 s vence a torre mais alta', () => {
  const p = nova();
  for (let k = 0; k < 3; k++) { solta(p, 0, 0); espera(p); }
  solta(p, 1, 0);
  roda(p, 28);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, 0);
  const q = nova();
  solta(q, 0, 0); espera(q);
  for (let k = 0; k < 2; k++) { solta(q, 1, 0); espera(q); }
  roda(q, 31);
  assert.equal(q.vencedor, 1);
});

test('empilha: torres iguais, ou ninguém joga, empata aos 30 s', () => {
  const p = nova();
  solta(p, 0, 0); espera(p); solta(p, 1, 0);
  roda(p, 31);
  assert.equal(p.vencedor, -1);
  const q = nova();
  roda(q, 29.5);
  assert.equal(q.fase, 'jogando');
  roda(q, 1);
  assert.equal(q.vencedor, -1);
});

test('empilha: roda inteiro, parado e com dedos aleatórios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('empilha: camera sobe com a torre mais alta e nao quebra sem dados', () => {
  assert.equal(jogo.camera({ dados: {} }), null);
  const p = nova();
  const c0 = jogo.camera(p);
  assert.ok([c0.x, c0.y, c0.z, c0.ox, c0.oy, c0.oz].every(Number.isFinite));
  const t = topo(est(p, 1));
  for (let k = 0; k < 10; k++) est(p, 1).blocos.push({ x: t.x, l: t.l });
  const c1 = jogo.camera(p);
  assert.ok(c1.y > c0.y + 3 && c1.oy > c0.oy, 'camera e mira sobem');
});

test('empilha: o primeiro bloco espera parado e toque nesse tempo e ignorado', () => {
  const p = partidaCom(jogo), e = est(p, 0);
  toque(p, 0);
  assert.equal(e.blocos.length, 1);
  assert.equal(p.jogadores[0].vivo, true);
  assert.equal(e.bx, -3.2);
});
