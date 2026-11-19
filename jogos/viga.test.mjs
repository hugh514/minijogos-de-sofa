import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { temChao, progresso } from './viga.mjs';

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

test('viga: um sai do caminho, ninguem cai de vez: os dois voltam e o outro vai na frente', () => {
  const p = partidaCom(jogo), d = p.dados;
  entrada(p, 0, { x: 0, y: -1 });
  for (let k = 0; k < 60 * 3 && !d.quedas; k++) passo(p, DT);
  assert.equal(d.quedas, 1, 'pisou fora');
  entrada(p, 0, { x: 0, y: 0 });
  roda(p, 2);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.jogadores[0].vivo && p.jogadores[1].vivo);
  assert.ok(temChao(p.jogadores[0].x, p.jogadores[0].z) && temChao(p.jogadores[1].x, p.jogadores[1].z));
  assert.ok(Math.abs(distancia(p) - 4) < 0.05);
  assert.ok(progresso(p.jogadores[1].x, p.jogadores[1].z) > progresso(p.jogadores[0].x, p.jogadores[0].z) + 3, 'quem nao caiu vai na frente');
});

test('viga: depois da curva, a queda volta para a curva e nao para a saida', () => {
  const p = partidaCom(jogo), d = p.dados, [a, b] = p.jogadores;
  Object.assign(a, { x: 8, z: -2 }); Object.assign(b, { x: 8, z: 2 });
  passo(p, DT);
  Object.assign(a, { x: 0, z: 3, vx: 0, vz: 0 }); Object.assign(b, { x: 0, z: -1, vx: 0, vz: 0 });
  passo(p, DT);
  assert.equal(d.quedas, 1);
  roda(p, 1.5);
  assert.ok(Math.hypot(a.x - 8, a.z) < 0.3, 'quem caiu volta na curva');
  assert.ok(Math.hypot(b.x - 4, b.z) < 0.3, 'o outro fica 4 passos na frente');
});

test('viga: no limite de tempo vence quem esta mais perto da meta pelo caminho', () => {
  const p = partidaCom(jogo), [a, b] = p.jogadores;
  Object.assign(a, { x: -3.6, z: -5.8 }); Object.assign(b, { x: -7.6, z: -5.8 });
  roda(p, 51);
  assert.equal(p.vencedor, 0);
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
