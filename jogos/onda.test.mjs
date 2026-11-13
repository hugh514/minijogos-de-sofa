import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca } from '../jogos/_teste.mjs';
import jogo from './onda.mjs';

// Partida sem pulsos automaticos e com uma onda ja a caminho dos dois (que estao a 4.5 do centro).
function comOnda() {
  const p = partidaCom(jogo);
  p.dados.prox = 999;
  p.dados.ondas.push({ r: 3.5, v: 5, dupla: false });
  return p;
}

test('onda: quem esta no chao quando o anel passa perde uma vida, voa para tras e fica imune', () => {
  const p = comOnda();
  roda(p, 0.4);
  assert.deepEqual(p.dados.placar, [1, 1]);
  assert.ok(p.dados.imune[0] > 0 && p.dados.imune[1] > 0);
  assert.ok(p.jogadores[0].x < -4.6 && p.jogadores[1].x > 4.6, 'foram jogados para fora');
  assert.equal(p.vencedor, undefined);
});

test('onda: quem pula na hora passa ileso', () => {
  const p = comOnda();
  entrada(p, 0, { x: 0, y: 0, nb: 0 });
  entrada(p, 0, { x: 0, y: 0, nb: 1 });
  roda(p, 1.2);
  assert.deepEqual(p.dados.placar, [2, 1]);
});

test('onda: imune nao apanha de novo; sem imunidade a segunda batida elimina', () => {
  const p = comOnda();
  p.dados.vidas = [2, 1]; p.dados.imune = [0.5, 0.5];
  roda(p, 0.4);
  assert.deepEqual(p.dados.placar, [2, 1], 'a onda passou durante a imunidade');
  p.dados.imune = [0, 0];
  p.jogadores[0].y = 3;                              // jogador 1 no ar
  p.dados.ondas.push({ r: 3.5, v: 5, dupla: true });
  roda(p, 0.4);
  assert.equal(p.vencedor, 0);
  assert.equal(p.jogadores[1].vivo, false);
});

test('onda: os dois parados caem juntos e da empate', () => {
  const p = partidaCom(jogo);
  roda(p, 3.5); assert.deepEqual(p.dados.placar, [1, 1]);
  roda(p, 3.5);
  assert.equal(p.vencedor, -1);
});

test('onda: no limite de 55 s decide pelas vidas', () => {
  const empate = partidaCom(jogo);
  empate.dados.imune = [99, 99];
  roda(empate, 54); assert.equal(empate.vencedor, undefined);
  roda(empate, 1.1); assert.equal(empate.vencedor, -1);
  const p = partidaCom(jogo);
  p.dados.imune = [99, 99]; p.dados.vidas = [1, 2];
  roda(p, 55.1);
  assert.equal(p.vencedor, 1);
});

test('onda: os pulsos aceleram e o nucleo avisa antes de soltar', () => {
  const p = partidaCom(jogo);
  p.dados.imune = [99, 99];
  roda(p, 2);
  assert.ok(p.dados.carga > 0.3 && p.dados.ondas.length === 0, 'nucleo inchando antes do primeiro pulso');
  roda(p, 8);
  const cedo = p.dados.ondas.length;
  roda(p, 35);
  assert.ok(p.dados.ondas.length > cedo, 'mais aneis na arena no fim do que no comeco');
});

test('onda: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
