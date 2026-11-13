import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { TIPOS } from './tiro-alvo.mjs';

const alvo = (tipo, x, z) => ({ tipo, x, z, r: TIPOS[tipo].r, vida: 99, t: 1, vx: 0, vz: 0 });
// partida sem alvos nascendo sozinhos, com os alvos dados
function cena(...alvos) {
  const p = partidaCom(jogo);
  p.dados.nasce = 999; p.dados.alvos = alvos;
  return p;
}
function segura(p, i, x, y, segundos = 0.5) { for (let k = 0; k < segundos * 60; k++) { entrada(p, i, { x, y, d: true }); passo(p, DT); } }
function solta(p, i, x, y) { entrada(p, i, { x, y, d: false }); passo(p, DT); }

test('tiro-alvo: a mira segue o dedo pela arena inteira, com suavizacao', () => {
  const p = cena();
  entrada(p, 0, { x: 0.5, y: -0.3, d: true }); passo(p, DT);
  const logo = p.dados.miras[0].x;
  segura(p, 0, 0.5, -0.3);
  const m = p.dados.miras[0];
  assert.ok(logo < m.x, 'nao pula de uma vez');
  assert.ok(Math.abs(m.x - 0.7 * 8.2) < 0.05 && Math.abs(m.z + 0.42 * 5.5) < 0.05, `mira em ${m.x}, ${m.z}`);
  segura(p, 0, -0.75, 0.75);
  assert.ok(m.x < -8.1 && m.z > 5.4, 'o dedo no canto leva a mira ate o canto');
  assert.deepEqual(p.dados.tiros, [], 'arrastar nao atira');
});

test('tiro-alvo: soltar atira onde a mira esta; comum vale 1 e dourado vale 3', () => {
  const p = cena(alvo('comum', 0, 0), alvo('dourado', 5.74, 0));
  segura(p, 0, 0, 0); solta(p, 0, 0, 0);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.dados.alvos.length, 1, 'o alvo acertado some');
  assert.ok(p.jogadores[0].vy > 0 || p.jogadores[0].y > 0, 'quem acerta pula');
  segura(p, 1, 0.5, 0, 0.6); solta(p, 1, 0.5, 0);
  assert.deepEqual(p.dados.placar, [1, 3]);
  assert.equal(p.dados.alvos.length, 0);
});

test('tiro-alvo: bomba tira 2 pontos e vibra o celular de quem acertou', () => {
  const p = cena(alvo('bomba', 0, 0));
  segura(p, 1, 0, 0); solta(p, 1, 0, 0);
  assert.deepEqual(p.dados.placar, [0, -2]);
  assert.equal(p.celular[1].vibra, 1);
  assert.ok(p.eventos.includes('explosao'));
});

test('tiro-alvo: tiro no vazio nao pontua nem tira alvo', () => {
  const p = cena(alvo('comum', 6, 4));
  segura(p, 0, 0, 0); solta(p, 0, 0, 0);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.alvos.length, 1);
  assert.equal(p.dados.tiros.length, 1, 'mas o tiro saiu');
});

test('tiro-alvo: os dois no mesmo alvo, so um leva', () => {
  const p = cena(alvo('comum', 0, 0));
  for (let k = 0; k < 30; k++) { entrada(p, 0, { x: 0, y: 0, d: true }); entrada(p, 1, { x: 0, y: 0, d: true }); passo(p, DT); }
  entrada(p, 0, { x: 0, y: 0, d: false }); entrada(p, 1, { x: 0, y: 0, d: false }); passo(p, DT);
  assert.equal(p.dados.placar[0] + p.dados.placar[1], 1);
  assert.equal(p.dados.alvos.length, 0);
});

test('tiro-alvo: recarga de 0,4 s entre dois tiros', () => {
  const p = cena(alvo('comum', 0, 0), alvo('comum', 0, 3));
  segura(p, 0, 0, 0); solta(p, 0, 0, 0);
  assert.equal(p.dados.placar[0], 1);
  segura(p, 0, 0, 3 / 5.5 / 1.4, 0.2); solta(p, 0, 0, 3 / 5.5 / 1.4);
  assert.equal(p.dados.placar[0], 1, 'ainda recarregando');
  roda(p, 0.3);
  assert.equal(p.dados.placar[0], 2, 'o tiro guardado sai quando a recarga acaba');
});

test('tiro-alvo: toque curto, que chega ja solto, tambem atira no lugar do dedo', () => {
  const p = cena(alvo('comum', 4, -2));
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 }); passo(p, DT);
  entrada(p, 0, { x: 4 / 8.2 / 1.4, y: -2 / 5.5 / 1.4, d: false, n: 1 }); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 0]);
});

test('tiro-alvo: alvos nascem sozinhos, somem com o tempo e vem em dobro nos 8 s finais', () => {
  const p = partidaCom(jogo);
  roda(p, 6);
  assert.ok(p.dados.alvos.length >= 1 && p.dados.alvos.length <= 12);
  assert.ok(p.dados.alvos.every(a => a.t < a.vida && Math.abs(a.x) <= 7.6 && Math.abs(a.z) <= 4.9));
  roda(p, 8);
  const a = p.dados.total;
  roda(p, 7.5);
  const b = p.dados.total;
  assert.equal(p.dados.dobro, false);
  roda(p, 8);
  const c = p.dados.total;
  assert.equal(p.dados.dobro, true);
  assert.ok(c - b >= (b - a) * 1.7, `antes ${b - a}, no fim ${c - b}`);
});

test('tiro-alvo: aos 30 s vence o maior placar, e igual e empate', () => {
  let p = partidaCom(jogo);
  roda(p, 29.5);
  assert.equal(p.fase, 'jogando');
  roda(p, 0.7);
  assert.equal(p.vencedor, -1);
  p = partidaCom(jogo);
  p.dados.placar = [4, -2];
  roda(p, 30.2);
  assert.equal(p.vencedor, 0);
});

test('tiro-alvo: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
