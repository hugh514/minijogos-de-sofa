import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { VIDAS, LIMITE, INICIO, CRESCE } from './sequencia-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
function toca(p, i, op) { const j = p.jogadores[i], n = j.nop ?? 0; entrada(p, i, { op, nop: n }); entrada(p, i, { op, nop: n + 1 }); passo(p, DT); }
function ate(p, fase) { for (let k = 0; k < 60 * 20 && p.dados.fase !== fase && p.fase === 'jogando'; k++) passo(p, DT); assert.equal(p.dados.fase, fase); }
// O jogador i repete a sequencia inteira certa.
function proxima(p) { if (p.fase === 'jogando') ate(p, 'mostra'); }       // a volta fechou: espera a seguinte (se a rodada nao acabou)
function acerta(p, i) { for (const cor of [...p.dados.seq]) toca(p, i, cor); }
function erra(p, i) { toca(p, i, (p.dados.seq[p.dados.pos[i]] + 1) % 4); }

test('sequencia-festa: contrato da festa e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, LIMITE);
});

test('sequencia-festa: comeca com 2, 3 e 4 mostrando a sequencia, todos com as mesmas vidas', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.vidas, Array(n).fill(VIDAS));
    assert.deepEqual(p.dados.placar, Array(n).fill(VIDAS));
    assert.equal(p.dados.fase, 'mostra');
    assert.equal(p.dados.seq.length, INICIO);
    for (let i = 0; i < n; i++) assert.equal(p.celular[i].modo, 'espera', 'enquanto mostra ninguem toca');
    assert.equal(new Set(p.jogadores.map(j => j.x + ',' + j.z)).size, n);
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [2 * VIDAS, 2 * VIDAS]);
});

test('sequencia-festa: toque enquanto a tela mostra nao conta', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  toca(p, 0, (p.dados.seq[0] + 1) % 4);
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS]);
});

test('sequencia-festa: todos repetem ao mesmo tempo; quando todos acertam a sequencia cresce', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ate(p, 'repete');
  for (let i = 0; i < 3; i++) assert.equal(p.celular[i].modo, 'opcoes');
  const antes = [...p.dados.seq];
  toca(p, 0, antes[0]); toca(p, 2, antes[0]); toca(p, 1, antes[0]);       // cada um no seu ritmo
  assert.deepEqual(p.dados.pos, [1, 1, 1]);
  for (let i = 0; i < 3; i++) for (const cor of antes.slice(1)) toca(p, i, cor);
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS, VIDAS]);
  proxima(p);
  assert.equal(p.dados.seq.length, antes.length + CRESCE);
  assert.deepEqual(p.dados.seq.slice(0, antes.length), antes, 'a sequencia so cresce no fim');
});

test('sequencia-festa: errar tira 1 vida, vibra e deixa fora ate a proxima sequencia', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ate(p, 'repete');
  const vibraAntes = p.celular[1].vibra ?? 0;
  erra(p, 1);
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS - 1, VIDAS]);
  assert.equal(p.jogadores[1].vivo, true, 'o primeiro erro nao elimina');
  assert.equal(p.celular[1].modo, 'espera');
  assert.ok(p.celular[1].vibra > vibraAntes);
  toca(p, 1, p.dados.seq[0]);
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS - 1, VIDAS], 'ja saiu desta sequencia');
  acerta(p, 0); acerta(p, 2);
  proxima(p); ate(p, 'repete');
  assert.equal(p.celular[1].modo, 'opcoes', 'volta na sequencia seguinte');
});

test('sequencia-festa: quem demora perde 1 vida', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, 'repete');
  acerta(p, 0);
  proxima(p);
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS - 1]);
});

test('sequencia-festa: sem vidas sai, e o ultimo que sobra vence (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < VIDAS; k++) { ate(p, 'repete'); erra(p, 0); acerta(p, 1); acerta(p, 2); proxima(p); }
  assert.equal(p.jogadores[0].vivo, false, 'sem vidas esta fora');
  assert.equal(p.fase, 'jogando', 'ainda ha dois');
  for (let k = 0; k < VIDAS; k++) {
    ate(p, 'repete'); assert.equal(p.celular[0].modo, 'espera');
    erra(p, 2);
    if (p.fase === 'jogando') { acerta(p, 1); proxima(p); }
  }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0]);
});

test('sequencia-festa: todos os que restavam caem na mesma sequencia: empate', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  for (let k = 0; k < VIDAS; k++) { ate(p, 'repete'); erra(p, 0); erra(p, 1); if (p.fase === 'jogando') proxima(p); }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, -1);
});

test('sequencia-festa: em times o time so perde quando os dois saem', () => {
  const p = partidaCom(jogo, undefined, times);
  for (let k = 0; k < VIDAS; k++) { ate(p, 'repete'); erra(p, 1); for (const i of [0, 2, 3]) acerta(p, i); proxima(p); }
  assert.equal(p.fase, 'jogando', 'o J4 ainda segura o time B');
  assert.deepEqual(p.dados.placar, [2 * VIDAS, VIDAS], 'placar em times soma as vidas');
  for (let k = 0; k < VIDAS; k++) {
    ate(p, 'repete'); erra(p, 3);
    if (p.fase === 'jogando') { for (const i of [0, 2]) acerta(p, i); proxima(p); }
  }
  assert.equal(p.vencedor, 0, 'time A (J1 + J3)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('sequencia-festa: no fim do tempo vence quem tem mais vidas; iguais, empate', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 1); p.dados.vidas = [1, 2, 1]; p.t = LIMITE - 0.1; roda(p, 0.3);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo, undefined, vs(4));
  roda(q, 1); q.t = LIMITE - 0.1; roda(q, 0.3);
  assert.equal(q.vencedor, -1);
  const r = partidaCom(jogo, undefined, times);
  roda(r, 1); r.dados.vidas = [1, 2, 1, 1]; r.t = LIMITE - 0.1; roda(r, 0.3);
  assert.equal(r.vencedor, 1, 'time B soma 3 contra 2');
});

test('sequencia-festa: parados, a rodada termina sozinha', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, -1);
});

test('sequencia-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
