import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, META } from './pega-bandeira-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// Roda ate a rodada acabar (devolve os segundos de jogo) com um callback por quadro para segurar os jogadores no lugar.
function jogaAte(p, antes = () => {}, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { antes(p); passo(p, DT); t += DT; } return t; }
const empurra = (p, i) => { const j = p.jogadores[i], n = (j.n ?? 0) + 1; entrada(p, i, { x: 0, y: 0, d: false, n: n - 1 }); entrada(p, i, { x: 0, y: 0, d: true, n }); };
// Leva a bandeira para o jogador i pelo caminho real: o jogador vai ate ela depois de armada.
function entrega(p, i) { roda(p, 1.6); const b = p.dados.bandeira; poe(p, i, b.x + 0.5, b.z); roda(p, 0.05); assert.equal(p.dados.com, i); }

test('pega-bandeira-festa: contrato da festa vs e times, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(TEMPO, 40);
});

test('pega-bandeira-festa: a bandeira so pode ser pega depois de armada (1,5 s)', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  poe(p, 0, 0.4, 0);
  roda(p, 1.0);
  assert.equal(p.dados.com, -1);
  roda(p, 0.6);
  assert.equal(p.dados.com, 0);
});

test('pega-bandeira-festa: quem segura soma 1 ponto por segundo e o dobro na reta final', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  entrega(p, 1);
  const base = p.dados.pontos[1];
  roda(p, 5);
  assert.ok(Math.abs(p.dados.pontos[1] - base - 5) < 0.1, 'ganhou ' + (p.dados.pontos[1] - base));
  assert.equal(p.dados.pontos[0], 0);
  const j = p.jogadores[1]; p.t = 31;
  const antes = p.dados.pontos[1]; roda(p, 2);
  assert.ok(Math.abs(p.dados.pontos[1] - antes - 4) < 0.1, 'dobro: ' + (p.dados.pontos[1] - antes));
  assert.ok(j.vivo);
});

test('pega-bandeira-festa: o empurrao de um adversario perto derruba a bandeira e ela voa', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  entrega(p, 0);
  poe(p, 1, p.jogadores[0].x + 1.6, p.jogadores[0].z);
  empurra(p, 1);
  roda(p, 0.1);
  assert.equal(p.dados.com, -1, 'caiu');
  assert.ok(Math.hypot(p.dados.bandeira.vx, p.dados.bandeira.vz) > 1 || p.dados.bandeira.x !== p.jogadores[0].x, 'voou');
  assert.ok(p.dados.nopega[0] > 0, 'quem perdeu nao pega de volta na hora');
  assert.match(p.celular[2].texto, /Pegue a bandeira/);
});

test('pega-bandeira-festa: empurrao de longe nao derruba', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  entrega(p, 0);
  poe(p, 1, p.jogadores[0].x + 6, p.jogadores[0].z);
  empurra(p, 1);
  roda(p, 0.05);
  assert.equal(p.dados.com, 0);
});

test('pega-bandeira-festa: em times so o adversario derruba, e os pontos vao para o time', () => {
  const p = partidaCom(jogo, undefined, times);
  entrega(p, 0);                                         // J1 e do time A (J1 + J3)
  poe(p, 2, p.jogadores[0].x + 1.5, p.jogadores[0].z);   // J3, parceiro
  empurra(p, 2); roda(p, 0.05);
  assert.equal(p.dados.com, 0, 'o parceiro nao derruba');
  assert.deepEqual(p.dados.placar.length, 2);
  roda(p, 3);
  assert.ok(p.dados.pontos[0] > 3 && p.dados.pontos[1] === 0);
  poe(p, 1, p.jogadores[0].x - 1.5, p.jogadores[0].z);   // J2, do time B
  empurra(p, 1); roda(p, 0.05);
  assert.notEqual(p.dados.com, 0, 'o adversario derruba');
});

test('pega-bandeira-festa: termina pelo objetivo, 30 pontos vencem na hora (vs) e o time vence em times', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  entrega(p, 2);
  p.dados.pontos[2] = META - 0.05;
  roda(p, 0.2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 1]);
  const q = partidaCom(jogo, undefined, times);
  entrega(q, 3);                                         // J4: time B
  q.dados.pontos[1] = META - 0.05;
  roda(q, 0.2);
  assert.equal(q.vencedor, 1);
  assert.deepEqual(q.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('pega-bandeira-festa: termina pelo tempo, vence quem tem mais pontos e empate da -1', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  p.dados.pontos = [4, 9, 6];
  const t = jogaAte(p);
  assert.ok(Math.abs(t - TEMPO) < 0.1, 'acabou aos ' + t);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo, undefined, vs(2));
  jogaAte(q);
  assert.equal(q.vencedor, -1, 'ninguem pegou: empate');
  const r = partidaCom(jogo, undefined, times);
  r.dados.pontos = [3, 8];
  jogaAte(r);
  assert.equal(r.vencedor, 1);
  assert.deepEqual(r.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('pega-bandeira-festa: a virada e possivel nos ultimos segundos (dobro)', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  p.dados.pontos = [20, 12];
  p.t = 32; entrega(p, 1); p.t = 32;
  jogaAte(p, q => { q.dados.pontos[0] = Math.min(q.dados.pontos[0], 20); });
  assert.equal(p.vencedor, 1, 'o jogador 2 virou segurando a bandeira ate o fim: ' + p.dados.pontos);
});

test('pega-bandeira-festa: retorno certo para o modo (indice do jogador em vs, 0 ou 1 em times)', () => {
  for (const [o, validos] of [[vs(2), [-1, 0, 1]], [vs(3), [-1, 0, 1, 2]], [vs(4), [-1, 0, 1, 2, 3]], [times, [-1, 0, 1]]]) {
    const { p } = rodada(jogo, aleatorio, 3, o);
    assert.ok(validos.includes(p.vencedor), `${o.modo} ${o.n}: ${p.vencedor}`);
  }
});

test('pega-bandeira-festa: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, vs 2, 3, 4 e times)', () => {
  for (const o of [vs(2), vs(3), vs(4), times])
    for (let s = 1; s <= 40; s++) {
      const { segundos } = rodada(jogo, aleatorio, s, o);
      assert.ok(segundos >= 5, `${o.modo} ${o.n} semente ${s}: ${segundos}`);
    }
});

test('pega-bandeira-festa: fumaca com 2, 3, 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
