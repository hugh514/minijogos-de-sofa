import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, contexto, DT } from '../jogos/_teste.mjs';
import jogo, { LARGADA, CHEGADA, LIMITE } from './corrida-dedos.mjs';

// Um toque no botao A ('a') ou B ('b') e depois "quadros" passos de jogo.
function toca(p, i, botao, quadros = 6) {
  const j = p.jogadores[i];
  entrada(p, i, botao === 'a' ? { n: (j.n ?? 0) + 1, nb: j.nb ?? 0 } : { n: j.n ?? 0, nb: (j.nb ?? 0) + 1 });
  for (let q = 0; q < quadros && p.fase === 'jogando'; q++) passo(p, DT);
}
function prepara(p) { for (const i of [0, 1]) entrada(p, i, { n: 0, nb: 0 }); }

test('cem metros: alternar A e B faz correr ate a chegada e vencer', () => {
  const p = partidaCom(jogo); prepara(p);
  let k = 0;
  while (p.fase === 'jogando' && k < 600) toca(p, 1, k++ % 2 ? 'a' : 'b');
  assert.equal(p.vencedor, 1);
  assert.ok(p.jogadores[1].x >= CHEGADA);
  assert.equal(p.dados.placar[1], 100);
  assert.equal(p.jogadores[0].x, LARGADA);
  assert.ok(k * 0.1 > 4 && k * 0.1 < 20, 'duracao razoavel a 10 toques por segundo: ' + k * 0.1);
});

test('cem metros: humano mediano (7 toques por segundo) leva uns 15 s, nao acaba antes de entender', () => {
  const p = partidaCom(jogo); prepara(p);
  let k = 0;
  while (p.fase === 'jogando' && k < 600) { const j = p.jogadores[0]; entrada(p, 0, k++ % 2 ? { n: j.n + 1, nb: j.nb } : { n: j.n, nb: j.nb + 1 }); roda(p, 1 / 7); }
  const seg = k * 9 * DT;                           // roda(p, 1/7) anda 9 quadros
  assert.equal(p.vencedor, 0);
  assert.ok(seg > 13 && seg < LIMITE, 'duracao a 7 toques por segundo: ' + seg.toFixed(1));
});

test('cem metros: repetir o mesmo botao nao da impulso e tropeca', () => {
  const p = partidaCom(jogo); prepara(p);
  for (let k = 0; k < 10; k++) toca(p, 0, k % 2 ? 'a' : 'b');
  const v = p.dados.v[0];
  assert.ok(v > 1, 'ganhou velocidade alternando');
  toca(p, 0, 'a', 1);                               // o ultimo foi A: repetiu
  assert.ok(p.dados.v[0] < v * 0.5, 'tropecou e perdeu velocidade');
  assert.ok(p.dados.tropeco[0] > 0);
  assert.equal(p.celular[0].vibra, 1);

  const q = partidaCom(jogo); prepara(q);
  for (let k = 0; k < 40; k++) toca(q, 0, 'a');     // so um botao: quase nao sai do lugar
  for (let k = 0; k < 40; k++) toca(q, 1, k % 2 ? 'a' : 'b');
  assert.ok(q.jogadores[0].x - LARGADA < 1, 'martelar um botao so nao anda');
  assert.ok(q.jogadores[1].x - LARGADA > 5 || q.vencedor === 1);
});

test('cem metros: A e B no mesmo quadro contam como dois passos alternados', () => {
  const p = partidaCom(jogo); prepara(p);
  toca(p, 0, 'a', 1);
  const j = p.jogadores[0];
  entrada(p, 0, { n: j.n + 1, nb: j.nb + 1 }); passo(p, DT);
  assert.equal(p.dados.tropeco[0], 0);
  assert.equal(p.dados.ultimo[0], 'a');
});

test('cem metros: a velocidade cai se parar de apertar', () => {
  const p = partidaCom(jogo); prepara(p);
  for (let k = 0; k < 12; k++) toca(p, 0, k % 2 ? 'a' : 'b');
  const v = p.dados.v[0];
  roda(p, 2);
  assert.ok(p.dados.v[0] < v * 0.2);
});

test('cem metros: no limite de tempo vence quem esta na frente; parados empatam', () => {
  const p = partidaCom(jogo); prepara(p);
  for (let k = 0; k < 6; k++) toca(p, 0, k % 2 ? 'a' : 'b');
  roda(p, LIMITE + 1);
  assert.equal(p.vencedor, 0);

  const q = partidaCom(jogo);
  roda(q, LIMITE + 1);
  assert.equal(q.vencedor, -1);
});

test('cem metros: desenho com o boneco de verdade (corpo) nao da erro', () => {
  const p = partidaCom(jogo); prepara(p);
  const c = contexto(p);
  for (const b of c.bonecos) { b.userData.corpo = new THREE.Group(); b.add(b.userData.corpo); }
  jogo.monta(c);
  toca(p, 0, 'a'); toca(p, 0, 'a');
  jogo.desenha(c, DT, 1);
  const q = c.bonecos[0].userData.corpo.quaternion;
  assert.ok([q.x, q.y, q.z, q.w].every(Number.isFinite));
  assert.equal(p.dados.fx.length, 0, 'faiscas consumidas pelo desenho');
});

test('cem metros: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.ok(vencedores.length === 15);
});
