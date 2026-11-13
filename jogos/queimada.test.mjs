import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, RAIO } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './queimada.mjs';

// Partida com uma unica bola no pe do jogador 1 (ja pega no primeiro quadro) e sem reposicao.
function comBola() {
  const p = partidaCom(jogo);
  p.dados.repoe = 999;
  p.dados.bolas = [{ x: -6, z: 0, vx: 0, vz: 0, estado: 'chao', dono: -1, quiques: 0 }];
  entrada(p, 0, { x: 0, y: 0, n: 0 }); entrada(p, 1, { x: 0, y: 0, n: 0, nb: 0 });
  passo(p, DT);
  assert.equal(p.dados.bolas[0].estado, 'mao');
  assert.equal(p.dados.bolas[0].dono, 0);
  return p;
}

test('queimada: pega a bola, arremessa parado e acerta o outro, que perde 1 vida e fica imune', () => {
  const p = comBola();
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  roda(p, 0.6);
  assert.deepEqual(p.dados.placar, [3, 2]);
  assert.ok(p.dados.imune[1] > 0, 'fica imune depois do acerto');
  assert.ok(p.jogadores[1].x > 6, 'foi empurrado para tras');
  assert.notEqual(p.dados.bolas[0].estado, 'voo', 'a bola que acertou deixa de valer');
});

test('queimada: pular desvia e a bola quica no fundo e vira bola de chao no lado do outro', () => {
  const p = comBola();
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  while (p.dados.bolas[0].x < 2) passo(p, DT);
  entrada(p, 1, { x: 0, y: 0, n: 0, nb: 1 });
  roda(p, 3);
  assert.deepEqual(p.dados.placar, [3, 3]);
  const b = p.dados.bolas[0];
  assert.equal(b.estado, 'chao');
  assert.ok(b.x > 0, 'parou na metade do jogador 2');
});

test('queimada: bola que erra para no lado do outro como bola de chao', () => {
  const p = comBola();
  p.jogadores[1].z = 5;                       // fora da linha do arremesso
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  roda(p, 3);
  const b = p.dados.bolas[0];
  assert.equal(b.estado, 'chao');
  assert.ok(b.x > 0, 'parou na metade do jogador 2');
  assert.deepEqual(p.dados.placar, [3, 3]);
});

test('queimada: zerar as vidas do outro vence', () => {
  const p = comBola();
  p.dados.placar = [3, 1];
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  roda(p, 0.6);
  assert.equal(p.vencedor, 0);
  assert.equal(p.jogadores[1].vivo, false);
});

test('queimada: ninguem cruza a linha do meio', () => {
  const p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.repoe = 999;
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: -1, y: 0 });
  roda(p, 3);
  assert.ok(p.jogadores[0].x <= -RAIO + 1e-9);
  assert.ok(p.jogadores[1].x >= RAIO - 1e-9);
});

test('queimada: no tempo, vence quem tem mais vidas; igual empata', () => {
  let p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.repoe = 999;
  roda(p, 46);
  assert.equal(p.vencedor, -1);
  p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.repoe = 999; p.dados.placar = [2, 3];
  roda(p, 46);
  assert.equal(p.vencedor, 1);
});

test('queimada: aparece bola na metade que ficou sem nenhuma', () => {
  const p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.repoe = 0.1;
  p.jogadores[0].x = -10; p.jogadores[0].z = 6; p.jogadores[1].x = 10; p.jogadores[1].z = 6;
  roda(p, 0.2);
  assert.ok(p.dados.bolas.some(b => b.x < 0) && p.dados.bolas.some(b => b.x > 0));
});

test('queimada: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
