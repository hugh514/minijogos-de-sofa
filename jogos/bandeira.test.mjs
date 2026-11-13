import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, RAIO } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { MUROS } from './bandeira.mjs';

function poe(p, i, x, z) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }

// Partida com o jogador 1 (indice 0) ja carregando a bandeira do outro, num canto livre.
function carregando() {
  const p = partidaCom(jogo);
  poe(p, 0, 9, 0); poe(p, 1, 0, 5.5);
  passo(p, DT);
  assert.equal(p.dados.band[1].estado, 'levada');
  poe(p, 0, -8, 4);
  passo(p, DT);
  return p;
}

test('bandeira: passar por cima da bandeira do outro pega; ela acompanha e o portador fica mais lento', () => {
  const p = carregando();
  assert.equal(p.dados.band[1].x, p.jogadores[0].x);
  assert.equal(p.dados.band[1].z, p.jogadores[0].z);
  assert.ok(Math.abs(p.jogadores[0].turbo - 0.85) < 1e-9);
  assert.equal(p.jogadores[1].turbo, 1);
  assert.equal(p.dados.band[0].estado, 'base', 'a propria bandeira nao se pega');
});

test('bandeira: levar ate a propria base marca e as duas bandeiras voltam; a segunda captura vence', () => {
  const p = carregando();
  poe(p, 0, -9, 0);
  passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.dados.band[1].estado, 'base');
  assert.equal(p.dados.band[1].x, 9);
  assert.equal(p.jogadores[0].turbo, 1);
  assert.equal(p.fase, 'jogando');
  poe(p, 0, 9, 0); passo(p, DT);
  poe(p, 0, -9, 0); passo(p, DT);
  assert.equal(p.vencedor, 0);
});

test('bandeira: o jogador 2 tambem captura', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [1, 1];
  poe(p, 1, -9, 0); poe(p, 0, 0, 5.5); passo(p, DT);
  assert.equal(p.dados.band[0].estado, 'levada');
  poe(p, 1, 9, 0); passo(p, DT);
  assert.equal(p.vencedor, 1);
});

test('bandeira: encostar no portador derruba a bandeira ali; ela volta sozinha depois de 4 s', () => {
  const p = carregando();
  poe(p, 1, -6.6, 4);                              // encostado no portador
  passo(p, DT);
  const f = p.dados.band[1];
  assert.equal(f.estado, 'chao');
  assert.ok(Math.abs(f.x + 8) < 1 && Math.abs(f.z - 4) < 1, 'caiu onde o portador estava');
  assert.ok(p.jogadores[0].vx < 0, 'o portador foi empurrado para longe');
  passo(p, DT);
  assert.equal(f.estado, 'chao', 'quem perdeu nao pega de volta na hora');
  poe(p, 0, -8, -5); poe(p, 1, 8, -5);
  roda(p, 3.5);
  assert.equal(f.estado, 'chao');
  roda(p, 0.7);
  assert.equal(f.estado, 'base');
  assert.equal(f.x, 9);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('bandeira: o dono passa por cima da bandeira caida e ela volta para a base na hora', () => {
  const p = carregando();
  poe(p, 1, -6.6, 4); passo(p, DT);
  const f = p.dados.band[1];
  assert.equal(f.estado, 'chao');
  poe(p, 0, -8, -5); poe(p, 1, f.x, f.z);
  passo(p, DT);
  assert.equal(f.estado, 'base');
});

test('bandeira: o ladrao pode pegar de novo a bandeira caida depois de um instante', () => {
  const p = carregando();
  poe(p, 1, -6.6, 4); passo(p, DT);
  const f = p.dados.band[1], x = f.x, z = f.z;
  poe(p, 1, 8, -5); poe(p, 0, -8, -5);
  roda(p, 1.2);
  poe(p, 0, x, z); passo(p, DT);
  assert.equal(f.estado, 'levada');
});

test('bandeira: o empurrao acerta o portador de um pouco mais longe', () => {
  const p = carregando();
  poe(p, 1, -5.8, 4);                              // perto, mas sem encostar
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  roda(p, 0.3);
  assert.equal(p.dados.band[1].estado, 'levada', 'so chegar perto nao derruba');
  poe(p, 0, -8, 4); poe(p, 1, -5.8, 4);
  entrada(p, 1, { x: -1, y: 0, n: 1 });
  passo(p, DT);
  assert.equal(p.dados.band[1].estado, 'chao');
});

test('bandeira: ninguem atravessa os muros', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 1, y: 0 });                   // anda reto para o muro do centro
  for (let i = 0; i < 180; i++) {
    passo(p, DT);
    for (const j of p.jogadores) for (const m of MUROS) {
      const px = Math.max(m.x - m.hx, Math.min(m.x + m.hx, j.x)), pz = Math.max(m.z - m.hz, Math.min(m.z + m.hz, j.z));
      assert.ok(Math.hypot(j.x - px, j.z - pz) >= RAIO - 1e-6, 'dentro do muro');
    }
  }
  assert.ok(p.jogadores[0].x < -0.6 - RAIO + 0.01 && p.jogadores[0].x > -3, 'parou no muro do centro');
  poe(p, 0, 0, 0);                                 // nascer dentro do muro: e posto para fora sem NaN
  passo(p, DT);
  assert.ok(Math.abs(p.jogadores[0].x) >= 0.6 + RAIO - 0.3);
});

test('bandeira: no tempo vence quem tem mais capturas; igual empata', () => {
  let p = partidaCom(jogo);
  roda(p, 54);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, -1);
  p = partidaCom(jogo);
  p.dados.placar = [0, 1];
  roda(p, 56);
  assert.equal(p.vencedor, 1);
});

test('bandeira: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});

test('bandeira: com a carta dash o empurrao tambem derruba o portador', () => {
  const p = carregando();
  p.jogadores[1].carta = 'dash';
  poe(p, 0, -8, 4); poe(p, 1, -5.8, 4);
  entrada(p, 1, { x: 0, y: 0, n: 0 }); passo(p, DT);
  poe(p, 0, -8, 4); poe(p, 1, -5.8, 4);
  entrada(p, 1, { x: -1, y: 0, n: 1 });
  passo(p, DT);
  assert.equal(p.dados.band[1].estado, 'chao');
});
