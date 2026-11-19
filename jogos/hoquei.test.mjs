import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, RAIO } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './hoquei.mjs';

const disco = (x, z, vx, vz) => ({ x, z, vx, vz, pausa: 0, lado: 1, sz: 0, lento: 0, som: 0 });

// Partida so com os discos dados e sem a entrada do segundo disco.
function com(...discos) {
  const p = partidaCom(jogo);
  p.dados.discos = discos; p.dados.segundo = true;
  return p;
}

test('hoquei: disco no gol da direita e gol do jogador 1; o disco volta ao centro e sai para quem levou', () => {
  const p = com(disco(8, 2, 12, 0));
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [1, 0]);
  const b = p.dados.discos[0];
  assert.ok(b.pausa > 0 && b.x === 0 && b.z === 0, 'voltou ao centro, parado');
  roda(p, 1.2);
  assert.ok(b.vx > 0 && b.x > 0, 'saiu para o lado de quem levou o gol');
  assert.equal(p.fase, 'jogando');
});

test('hoquei: gol na esquerda vale para o jogador 2 e o disco sai para a esquerda', () => {
  const p = com(disco(-8, -2, -12, 0));
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [0, 1]);
  roda(p, 1.2);
  assert.ok(p.dados.discos[0].x < 0);
});

test('hoquei: fora do vao do gol o disco quica na parede do fundo e nas laterais', () => {
  const p = com(disco(8, 4.5, 12, 9));
  roda(p, 1);
  assert.deepEqual(p.dados.placar, [0, 0]);
  const b = p.dados.discos[0];
  assert.ok(b.vx < 0, 'voltou da parede do fundo');
  assert.ok(Math.abs(b.x) <= 11 && Math.abs(b.z) <= 6);
});

test('hoquei: o terceiro gol vence', () => {
  const p = com(disco(8, 2, 12, 0));
  p.dados.placar = [2, 0];
  roda(p, 0.5);
  assert.equal(p.vencedor, 0);
  const q = com(disco(-8, 2, -12, 0));
  q.dados.placar = [2, 2];
  roda(q, 0.5);
  assert.equal(q.vencedor, 1);
});

test('hoquei: ninguem cruza a linha do meio', () => {
  const p = com();
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: -1, y: 0 });
  roda(p, 3);
  assert.ok(p.jogadores[0].x <= -RAIO + 1e-9);
  assert.ok(p.jogadores[1].x >= RAIO - 1e-9);
});

test('hoquei: o jogador bate no disco e a velocidade do disco tem limite', () => {
  const p = com(disco(-3, 0, 0, 0));
  entrada(p, 0, { x: 1, y: 0, n: 0 });
  entrada(p, 0, { x: 1, y: 0, n: 1 });          // tacada
  let maior = 0, passou = false;
  for (let i = 0; i < 90; i++) {
    passo(p, DT);
    const b = p.dados.discos[0];
    maior = Math.max(maior, Math.hypot(b.vx, b.vz));
    passou ||= b.x > 0;
  }
  assert.ok(passou, 'o disco foi para a metade do outro');
  assert.ok(maior > 8 && maior <= 18 + 1e-9, 'velocidade ' + maior);
});

test('hoquei: disco parado no canto por 3 s leva um empurrao para o centro', () => {
  const p = com(disco(10.4, 5.4, 0, 0));
  roda(p, 2.5);
  assert.ok(Math.hypot(p.dados.discos[0].vx, p.dados.discos[0].vz) < 1, 'ainda parado');
  roda(p, 1.2);
  const b = p.dados.discos[0];
  assert.ok(b.vx < 0 && b.vz < 0, 'andando para o centro');
  assert.ok(b.x < 10 && b.z < 5.2);
});

test('hoquei: com 20 s entra o segundo disco', () => {
  const p = partidaCom(jogo);
  p.dados.discos = [];
  roda(p, 19);
  assert.equal(p.dados.discos.length, 0);
  roda(p, 1.5);
  assert.equal(p.dados.discos.length, 1);
  roda(p, 5);
  assert.equal(p.dados.discos.length, 1, 'entra so uma vez');
});

test('hoquei: no tempo vence o maior placar; igual empata', () => {
  let p = com();
  roda(p, 51);
  assert.equal(p.vencedor, -1);
  p = com();
  p.dados.placar = [1, 2];
  roda(p, 51);
  assert.equal(p.vencedor, 1);
  p = com();
  p.dados.placar = [2, 0];
  roda(p, 49);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, 0);
});

test('hoquei: o saque nunca entra direto no gol de quem esta parado (sai na diagonal e bate no fundo)', () => {
  for (let semente = 1; semente <= 40; semente++) {
    const p = partidaCom(jogo, sorteio(semente));
    p.dados.segundo = true;
    for (const j of p.jogadores) j.vivo = false;   // ninguem toca no disco (o choque so vale para quem esta vivo)
    roda(p, 2.9);                                  // a pausa e a primeira ida ate o fundo
    assert.deepEqual(p.dados.placar, [0, 0], 'semente ' + semente);
  }
});

test('hoquei: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});
