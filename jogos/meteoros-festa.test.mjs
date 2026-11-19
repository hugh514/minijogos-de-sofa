import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { VIDAS, TEMPO, raioDe, PROTECAO } from './meteoros-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
// Roda s segundos sem sorteio de pedras novas (so as que o teste posiciona).
function seca(p, s) { for (let k = 0; k < s * 60 && p.fase === 'jogando'; k++) { p.dados.prox = 1e9; passo(p, DT); } }
// Larga uma pedra em cima do jogador i, depois de a protecao dele ter acabado (so as pedras do teste caem).
function acerta(p, i) {
  const d = p.dados, j = p.jogadores[i];
  for (let k = 0; k < 20 * 60 && p.fase === 'jogando' && (d.protecao[i] > 0 || !j.vivo); k++) { d.prox = 1e9; passo(p, DT); }
  if (p.fase !== 'jogando') return;
  d.prox = 1e9; d.lista.push({ x: j.x, z: j.z, t: 0.01, r: 1.8 });
  passo(p, DT); passo(p, DT);
}
const tira = (p, i) => { for (let k = 0; k < VIDAS; k++) acerta(p, i); };

test('meteoros-festa: contrato da festa, tempo de 20 a 50 s, genero e dica em uma frase', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.genero, 'reflexo');
  assert.equal(jogo.rotulo, 'vidas');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
  assert.doesNotMatch(jogo.nome + jogo.dica, /[\u2013\u2014]|[A-ZÀ-Ý]{3,}/u);
});

test('meteoros-festa: arena e posicoes iniciais crescem com n, cada um com 3 vidas', () => {
  let anterior = 0;
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.equal(p.arena.raio, raioDe(n));
    assert.ok(p.arena.raio > anterior); anterior = p.arena.raio;
    assert.deepEqual(p.dados.vidas, Array(n).fill(3));
    assert.deepEqual(p.dados.placar, Array(n).fill(3));
    for (const j of p.jogadores) assert.ok(Math.abs(Math.hypot(j.x, j.z) - p.arena.raio * 0.5) < 0.2);
    assert.equal(p.celular[0].texto, 'Vidas: 3');
  }
});

test('meteoros-festa: com mais jogadores caem mais pedras', () => {
  const conta = n => { const p = partidaCom(jogo, undefined, vs(n)); let k = 0; for (let q = 0; q < 20 * 60; q++) { p.dados.protecao.fill(99); const antes = p.dados.lista.length; passo(p, DT); if (p.dados.lista.length > antes) k++; } return k; };
  assert.ok(conta(4) > conta(2));
});

test('meteoros-festa: o comeco e protegido, nenhuma pedra tira vida nos primeiros segundos', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  const j = p.jogadores[0];
  p.dados.prox = 1e9; p.dados.lista.push({ x: j.x, z: j.z, t: 0.01, r: 1.8 });
  passo(p, DT); passo(p, DT);
  assert.equal(p.dados.vidas[0], 3);
  assert.equal(j.vivo, true);
});

test('meteoros-festa: a pedra tira uma vida, nao elimina e o jogador volta ao seu lugar protegido', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  seca(p, PROTECAO + 0.6);
  acerta(p, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.deepEqual(p.dados.vidas, [3, 2, 3]);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.celular[1].texto, 'Atingido! Já volta');
  seca(p, 5);
  const j = p.jogadores[1];
  assert.equal(j.vivo, true);
  assert.ok(Math.abs(Math.hypot(j.x, j.z) - p.arena.raio * 0.5) < 0.2, 'voltou ao lugar de partida');
  assert.ok(p.dados.protecao[1] >= 0);
  assert.equal(p.celular[1].texto, 'Vidas: 2');
  const antes = p.dados.vidas[1];
  p.dados.protecao[1] = 1; p.dados.prox = 1e9; p.dados.lista.push({ x: j.x, z: j.z, t: 0.01, r: 1.8 }); passo(p, DT); passo(p, DT);
  assert.equal(p.dados.vidas[1], antes, 'protegido nao cai');
});

test('meteoros-festa: vs devolve o indice do ultimo de pe (cada jogador, com 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < n; i++) {
    const p = partidaCom(jogo, undefined, vs(n));
    seca(p, PROTECAO + 0.6);
    for (let o = 0; o < n; o++) if (o !== i) tira(p, o);
    assert.equal(p.fase, 'resultado', `n ${n}, jogador ${i}`);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
    assert.equal(p.jogadores.filter(j => j.pontos).length, 1);
  }
});

test('meteoros-festa: ao decidir, celular e aviso ja estao no estado final', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  seca(p, PROTECAO + 0.6);
  tira(p, 0);
  assert.equal(p.vencedor, 1);
  assert.equal(p.celular[1].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Jogador 2 venceu');
  assert.equal(p.dados.aviso, 'Jogador 2 venceu!');
});

test('meteoros-festa: times devolvem o time e so perde quando os dois ficam sem vida', () => {
  const p = partidaCom(jogo, undefined, times);       // time A: J1 e J3, time B: J2 e J4
  seca(p, PROTECAO + 0.6);
  tira(p, 1);
  assert.equal(p.fase, 'jogando', 'o J4 ainda segura o time B');
  assert.deepEqual(p.dados.placar, [6, 3]);
  tira(p, 3);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  const q = partidaCom(jogo, undefined, times);
  seca(q, PROTECAO + 0.6);
  tira(q, 0); tira(q, 2);
  assert.equal(q.vencedor, 1);
  assert.deepEqual(q.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  assert.equal(q.celular[0].texto, 'O outro time venceu');
  assert.equal(q.dados.aviso, 'Time roxo venceu!');
});

test('meteoros-festa: tempo limite decide por mais vidas (vs e times) e igualdade e empate', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  seca(p, PROTECAO + 0.6);
  acerta(p, 0);
  seca(p, TEMPO + 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  const t = partidaCom(jogo, undefined, times);
  seca(t, PROTECAO + 0.6);
  acerta(t, 0);
  seca(t, TEMPO + 1);
  assert.equal(t.vencedor, 1, 'time A perdeu uma vida');
  const e = partidaCom(jogo, undefined, vs(3));
  seca(e, TEMPO + 1);
  assert.equal(e.vencedor, -1);
  assert.equal(e.dados.aviso, 'Empate!');
  assert.equal(e.celular[0].texto, 'Empate!');
  const f = partidaCom(jogo, undefined, vs(3));       // 2 com mais vidas empatados tambem e empate
  seca(f, PROTECAO + 0.6);
  acerta(f, 0);
  seca(f, TEMPO + 1);
  assert.equal(f.vencedor, -1);
});

test('meteoros-festa: os dois ultimos caem na mesma pedra e a rodada empata', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  seca(p, PROTECAO + 0.6);
  p.dados.vidas = [1, 1];
  Object.assign(p.jogadores[0], { x: 0, z: 0 }); Object.assign(p.jogadores[1], { x: 0.5, z: 0 });
  p.dados.prox = 1e9; p.dados.lista.push({ x: 0.2, z: 0, t: 0.01, r: 1.8 });
  passo(p, DT); passo(p, DT);
  assert.equal(p.vencedor, -1);
});

test('meteoros-festa: quem ficou sem vida nao volta', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  seca(p, PROTECAO + 0.6);
  tira(p, 0);
  seca(p, 6);
  assert.equal(p.dados.vidas[0], 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.celular[0].texto, 'Sem vidas. Torça!');
  assert.equal(p.fase, 'jogando');
});

test('meteoros-festa: botoes do celular nao quebram nada', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 1);
  assert.deepEqual(p.erros, []);
});

test('meteoros-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores em vs e 4 em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});

test('meteoros-festa: rodada de dedos aleatorios sempre termina em ate 50 s, em cada modo', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const { segundos } = rodada(jogo, aleatorio, 3, o);
    assert.ok(segundos <= 50, 'durou ' + segundos);
  }
});
