import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './um-de-nos.mjs';

const ABERTURA = 4.6;      // tempo da sequencia de pulos

// Passa a abertura e arruma a cena: robos parados e longe, jogadores onde o teste pedir.
function cena(pos0, pos1) {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, ABERTURA);
  let n = 0;
  d.esf.forEach((e, k) => {
    if (d.dono.includes(k)) return;
    Object.assign(e, { x: -8 + n++ * 2, z: 5.5, vx: 0, vz: 0, ix: 0, iz: 0, t: 999 });
  });
  Object.assign(d.esf[d.dono[0]], { x: pos0[0], z: pos0[1], vx: 0, vz: 0 });
  Object.assign(d.esf[d.dono[1]], { x: pos1[0], z: pos1[1], vx: 0, vz: 0 });
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, n: 0 });
  return p;
}
function atira(p, i) { entrada(p, i, { x: 0, y: 0, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }

test('um-de-nos: 8 esferas, 6 robos e uma para cada jogador', () => {
  for (let s = 1; s <= 20; s++) {
    const d = partidaCom(jogo, sorteio(s)).dados;
    assert.equal(d.esf.length, 8);
    assert.notEqual(d.dono[0], d.dono[1]);
    for (const k of d.dono) assert.ok(k >= 0 && k < 8);
    for (const [a, A] of d.esf.entries())
      for (const B of d.esf.slice(a + 1)) assert.ok(Math.hypot(A.x - B.x, A.z - B.z) > 1.4, 'ninguem nasce em cima de ninguem');
  }
});

test('um-de-nos: o celular vibra uma vez, na hora em que a propria esfera pula', () => {
  const p = partidaCom(jogo), d = p.dados;
  const pulou = [null, null];
  for (let q = 0; q < ABERTURA * 60; q++) {
    passo(p, DT);
    for (const i of [0, 1])
      if (pulou[i] === null && p.celular[i].vibra === 1) { pulou[i] = q; assert.ok(d.esf[d.dono[i]].salto > 0, 'vibrou junto com o pulo'); }
  }
  assert.ok(pulou[0] !== null && pulou[1] !== null);
  assert.notEqual(pulou[0], pulou[1], 'cada um em um momento');
  assert.deepEqual([p.celular[0].vibra, p.celular[1].vibra], [1, 1]);
  assert.equal(d.vez, 8, 'todas as esferas pularam');
});

test('um-de-nos: na abertura ninguem anda nem atira', () => {
  const p = partidaCom(jogo), d = p.dados, antes = d.esf.map(e => [e.x, e.z]);
  entrada(p, 0, { x: 1, y: 0, n: 0 });
  for (let q = 0; q < 120; q++) { entrada(p, 0, { x: 1, y: 0, n: q + 1 }); passo(p, DT); }
  assert.deepEqual(d.esf.map(e => [e.x, e.z]), antes);
  assert.deepEqual(d.tiro, [true, true]);
});

test('um-de-nos: a esfera obedece ao joystick, na mesma velocidade dos robos', () => {
  const p = cena([-5, 0], [5, 0]), d = p.dados, e = d.esf[d.dono[0]];
  let maior = 0;
  for (let q = 0; q < 60; q++) { entrada(p, 0, { x: 1, y: 0, n: 0 }); passo(p, DT); maior = Math.max(maior, Math.hypot(e.vx, e.vz)); }
  assert.ok(e.x > -5 + 3, 'andou para a direita');
  assert.ok(maior <= 5 + 1e-9 && maior > 4.5);
  assert.equal(d.esf[d.dono[1]].x, 5, 'a do outro nao se mexeu');
  // robo solto nunca passa da mesma velocidade
  const robo = d.esf.find((_, k) => !d.dono.includes(k));
  robo.t = 0; robo.z = 0;
  let maiorRobo = 0, andou = false;
  for (let q = 0; q < 600; q++) { passo(p, DT); const v = Math.hypot(robo.vx, robo.vz); maiorRobo = Math.max(maiorRobo, v); andou ||= v > 2; }
  assert.ok(andou, 'o robo passeia');
  assert.ok(maiorRobo <= 5 + 1e-9);
});

test('um-de-nos: acertar o outro jogador vence e revela os dois', () => {
  const p = cena([0, 0], [2, 0]), d = p.dados;
  atira(p, 1);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(d.revelado, [true, true]);
  assert.equal(d.esf[d.dono[0]].morta, true);
});

test('um-de-nos: acertar robo explode o robo, revela quem atirou e gasta o tiro', () => {
  const p = cena([0, 0], [8, -5]), d = p.dados;
  const robo = d.esf.find((_, k) => !d.dono.includes(k));
  Object.assign(robo, { x: 1.8, z: 0 });
  atira(p, 0);
  assert.equal(robo.morta, true);
  assert.deepEqual(d.revelado, [true, false]);
  assert.deepEqual(d.tiro, [false, true]);
  assert.equal(p.fase, 'jogando');
  atira(p, 0);
  assert.equal(p.fase, 'jogando', 'segundo toque nao faz nada');
  assert.equal(d.esf.filter(e => e.morta).length, 1);
  // o outro ainda pode vencer
  Object.assign(d.esf[d.dono[1]], { x: 0, z: 1.6 });
  atira(p, 1);
  assert.equal(p.vencedor, 1);
});

test('um-de-nos: pega a esfera mais proxima; o robo no meio salva o jogador', () => {
  const p = cena([0, 0], [2.2, 0]), d = p.dados;
  const robo = d.esf.find((_, k) => !d.dono.includes(k));
  Object.assign(robo, { x: 0, z: 1.5 });
  atira(p, 0);
  assert.equal(robo.morta, true);
  assert.equal(p.fase, 'jogando');
});

test('um-de-nos: os dois gastam o tiro em robo ou no vazio, empate', () => {
  const p = cena([0, 0], [8, -5]), d = p.dados;
  const robo = d.esf.find((_, k) => !d.dono.includes(k));
  Object.assign(robo, { x: 1.8, z: 0 });
  atira(p, 0);
  atira(p, 1);       // sem ninguem no alcance
  assert.equal(p.vencedor, -1);
  assert.deepEqual(d.revelado, [true, true]);
});

test('um-de-nos: 35 s sem vencedor, empate', () => {
  const p = partidaCom(jogo);
  roda(p, 34.5);
  assert.equal(p.fase, 'jogando');
  roda(p, 1);
  assert.equal(p.vencedor, -1);
});

test('um-de-nos: esferas ficam dentro da arena e nao se atravessam', () => {
  const p = partidaCom(jogo), d = p.dados;
  for (let q = 0; q < 30 * 60 && p.fase === 'jogando'; q++) {
    passo(p, DT);
    if (q % 30) continue;
    for (const [a, A] of d.esf.entries()) {
      assert.ok(Math.abs(A.x) <= 10 - 0.7 + 1e-9 && Math.abs(A.z) <= 6.5 - 0.7 + 1e-9);
      for (const B of d.esf.slice(a + 1)) assert.ok(Math.hypot(A.x - B.x, A.z - B.z) > 0.9, 'sem esfera dentro de esfera');
    }
  }
});

test('um-de-nos: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
