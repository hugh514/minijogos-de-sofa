import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, contexto, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { CENTRO, MEIA, Z_BONECO, VIDAS, LIMITE, T_IMUNE, bate, velocidade } from './obstaculos.mjs';

// Jogador automatico: olha a proxima fileira, vai para o vao e pula a barra na hora.
function joga(p, i) {
  const j = p.jogadores[i], x = j.x - CENTRO[i];
  const o = p.dados.pista.filter(o => o.z < Z_BONECO + 0.85).sort((a, b) => b.z - a.z)[0];
  let alvo = 0, pula = false;
  if (o?.barra) pula = Z_BONECO - o.z < velocidade(p.t) * 0.2;
  else if (o) {
    const livres = [-2.6, -2, -1, 0, 1, 2, 2.6].filter(c => !o.blocos.some(([a, b]) => c > a - 0.75 && c < b + 0.75));
    alvo = livres.sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
  }
  const m = { x: Math.max(-1, Math.min(1, (alvo - x) * 1.5 - j.vx * 0.25)), y: 0, n: j.n ?? 0, nb: j.nb ?? 0 };
  if (pula && j.y === 0) m.nb++;
  entrada(p, i, m);
}
function corre(p, segundos, quem) {
  for (let q = 0; q < segundos * 60 && p.fase === 'jogando'; q++) { quem(p); passo(p, DT); }
}
const prepara = p => { for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 }); };

test('pista maluca: toda fileira tem passagem e a regra de batida funciona', () => {
  const barra = { barra: true, z: Z_BONECO }, bloco = { blocos: [[-MEIA, 0.6]], z: Z_BONECO };
  assert.ok(bate(barra, 0, 0) && !bate(barra, 0, 1));
  assert.ok(bate(bloco, 0, 0) && bate(bloco, 0, 1.3), 'bloco alto nao da para pular');
  assert.ok(!bate(bloco, 2, 0));
  assert.ok(!bate({ ...bloco, z: Z_BONECO - 3 }, 0, 0));
  const p = partidaCom(jogo); prepara(p);
  const vistas = new Set();
  corre(p, 30, p => { joga(p, 0); joga(p, 1); for (const o of p.dados.pista) vistas.add(o); });
  assert.ok(vistas.size > 20);
  for (const o of vistas)
    assert.ok(o.barra || [-2.7, -2, 0, 2, 2.7].some(x => !bate({ ...o, z: Z_BONECO }, x, 0)), 'fileira sem passagem');
});

test('pista maluca: quem desvia e pula vence quem fica parado', () => {
  for (const semente of [1, 2, 3]) {
    const p = partidaCom(jogo, sorteio(semente)); prepara(p);
    corre(p, LIMITE + 2, p => joga(p, 1));
    assert.equal(p.vencedor, 1, 'semente ' + semente);
    assert.equal(p.jogadores[0].vivo, false);
    assert.ok(p.dados.placar[1] > p.dados.placar[0]);
  }
});

test('pista maluca: batida tira uma vida e da 1 s de invulnerabilidade', () => {
  const p = partidaCom(jogo); prepara(p);
  p.dados.falta = 999;
  p.dados.pista = [{ blocos: [[-MEIA, MEIA]], z: Z_BONECO - 0.2 }, { blocos: [[-MEIA, MEIA]], z: Z_BONECO - 0.5 }];
  p.jogadores[1].x = 99;                               // o motor devolve para a raia; fora dos blocos nao existe, entao os dois batem
  passo(p, DT);
  assert.deepEqual(p.dados.placar, [VIDAS - 1, VIDAS - 1]);
  assert.ok(p.dados.imune[0] > T_IMUNE - 0.1);
  roda(p, 0.2);
  assert.deepEqual(p.dados.placar, [VIDAS - 1, VIDAS - 1], 'invulneravel nao perde outra vida');
  assert.equal(p.fase, 'jogando');
});

test('pista maluca: o boneco fica na propria raia e parado em z', () => {
  const p = partidaCom(jogo); prepara(p);
  p.dados.falta = 999;
  corre(p, 2, p => { entrada(p, 0, { x: 1, y: 1 }); entrada(p, 1, { x: -1, y: -1 }); });
  assert.ok(p.jogadores[0].x < 0 && p.jogadores[1].x > 0);
  assert.ok(Math.abs(p.jogadores[0].x - CENTRO[0]) <= MEIA - 0.8 + 1e-9);
  assert.ok(Math.abs(p.jogadores[1].x - CENTRO[1]) <= MEIA - 0.8 + 1e-9);
  assert.equal(p.jogadores[0].z, Z_BONECO); assert.equal(p.jogadores[1].z, Z_BONECO);
});

test('pista maluca: parados perdem as vidas juntos e empatam', () => {
  const p = partidaCom(jogo);
  corre(p, LIMITE + 2, () => {});
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.ok(p.jogadores.every(j => !j.vivo));
});

test('pista maluca: no limite de tempo vence quem tem mais vidas; iguais empatam', () => {
  const p = partidaCom(jogo); prepara(p);
  p.dados.falta = 9999; p.dados.placar = [1, 2];
  corre(p, LIMITE + 1, () => {});
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo); prepara(q);
  q.dados.falta = 9999;
  corre(q, LIMITE + 1, () => {});
  assert.equal(q.vencedor, -1);
});

test('pista maluca: desenho com o boneco de verdade (corpo) nao da erro', () => {
  const p = partidaCom(jogo); prepara(p);
  const c = contexto(p);
  for (const b of c.bonecos) { b.userData.corpo = new THREE.Group(); b.add(b.userData.corpo); }
  jogo.monta(c);
  for (let q = 0; q < 600 && p.fase === 'jogando'; q++) { passo(p, DT); jogo.desenha(c, DT, q * DT); }
  assert.ok(p.dados.placar[0] < VIDAS, 'parado ja bateu em 10 s');
  assert.equal(c.pecas.vidas[0].filter(v => v.visible).length, p.dados.placar[0]);
  assert.equal(p.dados.fx.length, 0);
});

test('pista maluca: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.ok(vencedores.length === 15);
});
