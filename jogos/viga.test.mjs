import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca } from '../jogos/_teste.mjs';
import jogo, { temChao } from './viga.mjs';

const distancia = p => Math.hypot(p.jogadores[1].x - p.jogadores[0].x, p.jogadores[1].z - p.jogadores[0].z);

test('viga: tem chao no caminho e na saida, e nao tem nos vaos', () => {
  assert.ok(temChao(-7.6, -5.8) && temChao(0, -5.8) && temChao(8, -3) && temChao(0, 0) && temChao(-8, 3) && temChao(8, 5.8));
  assert.ok(!temChao(0, -2.9) && !temChao(0, 2.9) && !temChao(-10.5, 0) && !temChao(0, 8.5) && !temChao(10.5, 5.8));
});

test('viga: os dois comecam no chao, a 4 de distancia, e andar junto mantem a distancia', () => {
  const p = partidaCom(jogo);
  assert.ok(Math.abs(distancia(p) - 4) < 0.01);
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: 1, y: 0 });
  roda(p, 1);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.jogadores[0].x > -5, 'andaram pelo caminho');
  assert.ok(Math.abs(distancia(p) - 4) < 0.01);
});

test('viga: um puxa sozinho e o outro vem junto, sem a viga esticar', () => {
  const p = partidaCom(jogo);
  const antes = p.jogadores[1].x;
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 0.6);
  assert.ok(Math.abs(distancia(p) - 4) < 0.05);
  assert.ok(p.jogadores[1].x !== antes || p.jogadores[1].z < -3.8, 'o outro foi arrastado');
});

test('viga: um sai do caminho, os dois caem e da empate', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: -1 });
  roda(p, 3);
  assert.equal(p.vencedor, -1);
  assert.ok(!p.jogadores[0].vivo && !p.jogadores[1].vivo);
});

test('viga: o primeiro a encostar na meta vence', () => {
  for (const quem of [0, 1]) {
    const p = partidaCom(jogo);
    p.jogadores[quem].x = 5.5; p.jogadores[quem].z = 5.8;
    p.jogadores[1 - quem].x = 1.5; p.jogadores[1 - quem].z = 5.8;
    entrada(p, quem, { x: 1, y: 0 });
    roda(p, 3);
    assert.equal(p.vencedor, quem);
  }
});

test('viga: parados, empata no limite de tempo', () => {
  const p = partidaCom(jogo);
  roda(p, 49);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, -1);
});

test('viga: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
