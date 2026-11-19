import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, contexto, DT } from '../jogos/_teste.mjs';
import jogo, { LARGADA, CHEGADA, LIMITE, PISTA, ALVO_DUPLA } from './corrida-dedos-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };

function prepara(p) { for (let i = 0; i < p.n; i++) entrada(p, i, { n: 0, nb: 0 }); }
function nova(o) { const p = partidaCom(jogo, undefined, o); prepara(p); return p; }
// Um toque no botao A ('a') ou B ('b') de cada jogador em "quem", e depois "quadros" passos de jogo.
function toca(p, quem, botao, quadros = 6) {
  for (const i of [].concat(quem)) {
    const j = p.jogadores[i];
    entrada(p, i, botao === 'a' ? { n: (j.n ?? 0) + 1, nb: j.nb ?? 0 } : { n: j.n ?? 0, nb: (j.nb ?? 0) + 1 });
  }
  for (let q = 0; q < quadros && p.fase === 'jogando'; q++) passo(p, DT);
}
// Corre alternando A e B com quem for dado, a um toque a cada "quadros" quadros, ate a rodada fechar. Devolve os segundos.
function corre(p, quem, quadros = 5) {
  let k = 0;
  while (p.fase === 'jogando' && k < 60 * 80 / quadros) toca(p, quem, k++ % 2 ? 'a' : 'b', quadros);
  return k * quadros * DT;
}

test('corrida-dedos-festa: contrato da festa vs e times, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(LIMITE, 45);
  assert.equal(jogo.sufixo, '%');
  assert.equal(jogo.genero, 'ritmo');
});

test('corrida-dedos-festa: as raias e a arena escalam com n, cada um na sua raia sem repetir', () => {
  let lzAnterior = 0;
  for (const o of [vs(2), vs(3), vs(4)]) {
    const p = partidaCom(jogo, undefined, o);
    assert.equal(p.jogadores.length, o.n);
    const zs = p.jogadores.map(j => j.z);
    assert.equal(new Set(zs).size, o.n);
    assert.ok(zs.every(z => Math.abs(z) + 1 < p.arena.lz), `n ${o.n}: raias dentro da arena`);
    assert.ok(p.arena.lz > lzAnterior); lzAnterior = p.arena.lz;
    assert.ok(p.arena.lz <= 9, 'cabe na tela');
    assert.ok(p.jogadores.every(j => j.x === LARGADA));
  }
});

test('corrida-dedos-festa: vs, alternar A e B faz correr ate a chegada e vencer, devolvendo o indice', () => {
  for (const o of [vs(2), vs(3), vs(4)]) {
    const p = nova(o), i = o.n - 1;
    const t = corre(p, i, 6);                       // 10 toques por segundo
    assert.equal(p.vencedor, i);
    assert.ok(p.jogadores[i].x >= CHEGADA - 1e-6);
    assert.equal(p.dados.placar[i], 100);
    assert.equal(p.jogadores[0].x, LARGADA);
    assert.ok(t > 12 && t < 45, `n ${o.n}: duracao a 10 toques por segundo: ${t}`);
    assert.equal(p.jogadores[i].pontos, 1);
  }
});

test('corrida-dedos-festa: a pista e longa, nem um dedo perfeito termina em menos de 10 s', () => {
  const p = nova(vs(2));
  const t = corre(p, 0, 5);                         // 12 toques por segundo, alternando sem errar
  assert.ok(t >= 10, 'perfeito a 12 toques por segundo: ' + t);
  const q = nova(vs(2));
  const tq = corre(q, 0, 1);                        // um toque por quadro, 60 por segundo
  assert.ok(tq >= 5, 'absurdamente rapido: ' + tq);
});

test('corrida-dedos-festa: vs, o primeiro a chegar vence mesmo com os outros correndo', () => {
  const p = nova(vs(3));
  let k = 0;
  while (p.fase === 'jogando' && k < 3000) {      // J1 a 12 toques por segundo, J3 a 10 e J2 devagar
    toca(p, 0, k % 2 ? 'a' : 'b', 0); if (k % 6 === 0) toca(p, 2, (k / 6) % 2 ? 'a' : 'b', 0); if (k % 15 === 0) toca(p, 1, (k / 15) % 2 ? 'a' : 'b', 0);
    passo(p, DT); k++;
  }
  assert.equal(p.vencedor, 0);
  assert.ok(p.dados.placar[1] < 100 && p.dados.placar[2] < 100);
});

test('corrida-dedos-festa: repetir o mesmo botao nao da impulso e tropeca', () => {
  const p = nova(vs(3));
  for (let k = 0; k < 10; k++) toca(p, 0, k % 2 ? 'a' : 'b');
  const v = p.dados.v[0];
  assert.ok(v > 1, 'ganhou velocidade alternando');
  toca(p, 0, 'a', 1);                               // o ultimo foi A: repetiu
  assert.ok(p.dados.v[0] < v * 0.5, 'tropecou e perdeu velocidade');
  assert.ok(p.dados.tropeco[0] > 0);
  assert.equal(p.celular[0].vibra, 1);
  assert.match(p.celular[0].texto, /^Tropeçou! /);
  assert.equal(p.dados.v[1], 0, 'o tropeco e so de quem pisou duas vezes');

  const q = nova(vs(2));
  for (let k = 0; k < 40; k++) toca(q, 0, 'a');     // so um botao: quase nao sai do lugar
  for (let k = 0; k < 40; k++) toca(q, 1, k % 2 ? 'a' : 'b');
  assert.ok(q.dados.m[0] < 1, 'martelar um botao so nao anda');
  assert.ok(q.dados.m[1] > 5);
});

test('corrida-dedos-festa: A e B no mesmo quadro contam como dois passos alternados', () => {
  const p = nova(vs(2));
  toca(p, 0, 'a', 1);
  const j = p.jogadores[0];
  entrada(p, 0, { n: j.n + 1, nb: j.nb + 1 }); passo(p, DT);
  assert.equal(p.dados.tropeco[0], 0);
  assert.equal(p.dados.ultimo[0], 'a');
});

test('corrida-dedos-festa: a velocidade cai se parar de apertar', () => {
  const p = nova(vs(2));
  for (let k = 0; k < 12; k++) toca(p, 0, k % 2 ? 'a' : 'b');
  const v = p.dados.v[0];
  roda(p, 2);
  assert.ok(p.dados.v[0] < v * 0.2);
});

test('corrida-dedos-festa: tempo limite, vence quem esta na frente, e todos parados empatam', () => {
  for (const o of [vs(2), vs(3), vs(4)]) {
    const p = nova(o);
    for (let k = 0; k < 6; k++) toca(p, 1, k % 2 ? 'a' : 'b');
    roda(p, LIMITE + 1);
    assert.equal(p.vencedor, 1, `n ${o.n}`);
    const q = partidaCom(jogo, undefined, o);
    roda(q, LIMITE + 1);
    assert.equal(q.vencedor, -1);
  }
});

test('corrida-dedos-festa: empate no tempo limite com os dois na frente emparelhados', () => {
  const p = nova(vs(3));
  for (let k = 0; k < 6; k++) toca(p, [0, 2], k % 2 ? 'a' : 'b');
  roda(p, LIMITE + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[0].texto, 'Empate!');
});

test('corrida-dedos-festa: ao fechar, aviso e celulares ja estao no estado final', () => {
  const p = nova(vs(3));
  corre(p, 2, 6);
  assert.equal(p.vencedor, 2);
  assert.match(p.dados.aviso, /venceu a corrida!$/);
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Fim da corrida. Você não venceu.');
});

test('corrida-dedos-festa: times, os metros dos dois da dupla se somam e a dupla chega a 170 m', () => {
  const p = nova(times);
  corre(p, [0, 2], 6);                              // J1 e J3 (time A) correm; o time B fica parado
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.ok(p.dados.m[0] + p.dados.m[2] >= ALVO_DUPLA);
  assert.ok(p.dados.m[0] < PISTA * 1.3 + 1e-6);
  assert.equal(p.dados.placar[0], 100);
  assert.equal(p.dados.placar.length, 2);
  assert.match(p.dados.aviso, / e .* venceram a corrida!$/);
  const q = nova(times);
  corre(q, [1, 3], 6);
  assert.equal(q.vencedor, 1, 'o time e devolvido, nunca o indice do jogador');
});

test('corrida-dedos-festa: times, um sozinho nao vence a dupla inteira no fim por mais rapido que seja', () => {
  const p = nova(times);
  const t = corre(p, [0], 5);                        // so o J1 corre: 130 m no maximo, nunca 170
  assert.ok(t >= LIMITE, 'so fecha no tempo: ' + t);
  assert.ok(p.dados.m[0] <= 130 + 1e-6);
  assert.equal(p.vencedor, 0, 'ainda assim vence por estar na frente no tempo limite');
  const q = nova(times);
  corre(q, [0, 1, 2, 3], 5);                         // os quatro correndo igual: soma igual
  assert.equal(q.vencedor, -1, 'chegam juntos, empate');
});

test('corrida-dedos-festa: times, a dupla perfeita a 12 toques por segundo leva mais de 8 s', () => {
  const p = nova(times);
  const t = corre(p, [0, 2], 5);
  assert.ok(t >= 8, String(t));
  assert.equal(p.vencedor, 0);
});

test('corrida-dedos-festa: times, tempo limite soma a dupla; o celular mostra a dupla e a parte de cada um', () => {
  const p = nova(times);
  for (let k = 0; k < 6; k++) toca(p, [0, 2], k % 2 ? 'a' : 'b');
  for (let k = 0; k < 6; k++) toca(p, 1, k % 2 ? 'a' : 'b');
  assert.match(p.celular[0].texto, /^Sua dupla: \d+%\. Você: \d+%\./);
  roda(p, LIMITE + 1);
  assert.equal(p.vencedor, 0, 'dois correndo um pouco somam mais que um correndo bastante');
  const q = nova(times);
  roda(q, LIMITE + 1);
  assert.equal(q.vencedor, -1);
});

test('corrida-dedos-festa: desenho com o boneco de verdade (corpo) nao da erro em nenhum n', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const p = nova(o);
    const c = contexto(p);
    for (const b of c.bonecos) { b.userData.corpo = new THREE.Group(); b.add(b.userData.corpo); }
    jogo.monta(c);
    toca(p, 0, 'a'); toca(p, 0, 'a');
    jogo.desenha(c, DT, 1);
    const q = c.bonecos[0].userData.corpo.quaternion;
    assert.ok([q.x, q.y, q.z, q.w].every(Number.isFinite));
    assert.equal(p.dados.fx.length, 0, 'faiscas consumidas pelo desenho');
  }
});

test('corrida-dedos-festa: dedos aleatorios dao resultado valido em todos os modos', () => {
  for (const o of [vs(2), vs(3), vs(4), times])
    for (let s = 1; s <= 20; s++) {
      const { p } = rodada(jogo, aleatorio, s, o);
      const validos = o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()];
      assert.ok(validos.includes(p.vencedor), `${o.modo} ${o.n} semente ${s}: ${p.vencedor}`);
    }
});

test('corrida-dedos-festa: fumaca com 2, 3, 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
