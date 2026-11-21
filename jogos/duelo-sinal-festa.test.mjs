import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { VITORIAS, LIMITE } from './duelo-sinal-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
// Um toque no botao A do jogador i (vale no proximo passo).
function aperta(p, i) { const j = p.jogadores[i], n = j.n ?? 0; entrada(p, i, { n }); entrada(p, i, { n: n + 1 }); }
function ate(p, fase) { for (let k = 0; k < 60 * 12 && p.dados.fase !== fase; k++) passo(p, DT); assert.equal(p.dados.fase, fase); }
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }

test('duelo-sinal-festa: contrato da festa e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, LIMITE);
  assert.equal(VITORIAS, 3);
});

test('duelo-sinal-festa: comeca com 2, 3 e 4 esperando o sinal, cada um no seu lugar', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.placar, Array(n).fill(0));
    assert.equal(p.dados.fase, 'espera');
    assert.equal(new Set(p.jogadores.map(j => j.x)).size, n);
    assert.ok(p.jogadores.every(j => Math.abs(j.x) < p.arena.lx));
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [0, 0]);
});

test('duelo-sinal-festa: o primeiro a apertar depois do verde ganha o ponto da rodada', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  ate(p, 'verde');
  aperta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 1, 0]);
  assert.equal(p.dados.fase, 'pausa');
  aperta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 1, 0], 'atrasado nao pontua');
  ate(p, 'espera');
});

test('duelo-sinal-festa: quem queima a largada fica fora da rodada e os outros seguem', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 0.3);
  const vibraAntes = p.celular[1].vibra ?? 0;
  aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.fora, [false, true, false]);
  assert.ok(p.celular[1].vibra > vibraAntes);
  assert.match(p.celular[1].texto, /Queimou/);
  assert.equal(p.dados.fase, 'espera', 'ainda ha dois na rodada');
  ate(p, 'verde');
  aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 0], 'quem esta fora nao pontua');
  aperta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 0, 0]);
  ate(p, 'espera');
  assert.deepEqual(p.dados.fora, [false, false, false], 'rodada nova, todos de volta');
});

test('duelo-sinal-festa: se so sobra um sem queimar, o ponto e dele; se todos queimam, ninguem pontua', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 0.3);
  aperta(p, 0); passo(p, DT);
  aperta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1, 0]);
  assert.equal(p.dados.fase, 'pausa');
  ate(p, 'espera'); roda(p, 0.3);
  aperta(p, 0); aperta(p, 1); aperta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1, 0]);
  assert.equal(p.dados.fase, 'pausa');
});

test('duelo-sinal-festa: no mesmo quadro depois do verde ninguem pontua e a rodada repete', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, 'verde');
  aperta(p, 0); aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.fase, 'pausa');
});

test('duelo-sinal-festa: ninguem aperta no verde, a rodada recomeca', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, 'verde'); roda(p, 3.2);
  assert.notEqual(p.dados.fase, 'verde');
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('duelo-sinal-festa: em vs o primeiro a 3 vence', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  for (let k = 0; k < VITORIAS; k++) {
    assert.equal(p.fase, 'jogando');
    ate(p, 'verde'); aperta(p, 3); passo(p, DT);
    if (k < VITORIAS - 1) ate(p, 'espera');
  }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 3);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 1]);
});

test('duelo-sinal-festa: em times o ponto e do time, e a dupla inteira queimada da o ponto ao outro time', () => {
  const p = partidaCom(jogo, undefined, times);
  ate(p, 'verde'); aperta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 0]);
  ate(p, 'espera'); roda(p, 0.3);
  aperta(p, 1); passo(p, DT);
  assert.equal(p.dados.fase, 'espera', 'o J4 ainda segura o time B');
  aperta(p, 3); passo(p, DT);
  assert.deepEqual(p.dados.placar, [2, 0]);
  ate(p, 'espera');
  ate(p, 'verde'); aperta(p, 0); passo(p, DT);
  assert.equal(p.vencedor, 0, 'time A (J1 + J3)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('duelo-sinal-festa: no fim do tempo vence quem esta na frente sozinho, senao empate', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 1); p.dados.placar = [0, 2, 1];
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo, undefined, vs(4));
  ateOFim(q);
  assert.equal(q.vencedor, -1, 'todos parados');
  const r = partidaCom(jogo, undefined, times);
  roda(r, 1); r.dados.placar = [1, 2];
  ateOFim(r);
  assert.equal(r.vencedor, 1);
});

test('duelo-sinal-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
