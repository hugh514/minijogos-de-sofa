import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { ALVOS, VISIVEL, CORTE, LIMITE } from './relogio-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const aperta = (p, i) => { const n = p.jogadores[i].n ?? 0; entrada(p, i, { n }); entrada(p, i, { n: n + 1 }); };
// Avanca ate o relogio da rodada (p.dados.t) chegar a "seg" na fase de contagem.
function ate(p, seg) { for (let k = 0; k < 3000 && p.fase === 'jogando' && !(p.dados.fase === 'conta' && p.dados.t >= seg - 1e-9); k++) passo(p, DT); }
function ateFase(p, fase) { for (let k = 0; k < 3000 && p.fase === 'jogando' && p.dados.fase !== fase; k++) passo(p, DT); }
// Cada jogador para no tempo dado (null = nao aperta), em ordem crescente de tempo; depois espera a revelacao.
function joga(p, tempos) {
  ateFase(p, 'conta');
  const ordem = tempos.map((t, i) => [t, i]).filter(([t]) => t !== null).sort((a, b) => a[0] - b[0]);
  for (const [t, i] of ordem) { ate(p, t - DT); aperta(p, i); passo(p, DT); }
  ateFase(p, 'revela');
}
function ateOFim(p) { for (let k = 0; k < 70 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }

test('relogio-festa: contrato da festa, 3 alvos diferentes e sem contagem regressiva na TV', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(new Set(ALVOS).size, 3);
  assert.equal(jogo.duracao, undefined, 'a contagem da TV seria um relogio a vista');
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
});

test('relogio-festa: comeca com 2, 3 e 4, placar zerado e cada um no seu lugar', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.placar, Array(n).fill(0));
    assert.equal(new Set(p.jogadores.map(j => j.x + ',' + j.z)).size, n);
    assert.match(p.dados.aviso, new RegExp(`${ALVOS[0]} segundos`));
    for (let i = 0; i < n; i++) assert.match(p.celular[i].texto, /Rodada 1 de 3/);
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [0, 0]);
});

test('relogio-festa: o visor conta ate 3 s e depois some; o aviso com o alvo fica parado na tela', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ate(p, 2.5);
  assert.equal(p.dados.visor, '2,5');
  assert.equal(p.dados.aviso, `Pare em ${ALVOS[0]} segundos`);
  ate(p, VISIVEL + 0.1);
  assert.equal(p.dados.visor, '?,?');
  assert.equal(p.dados.aviso, `Pare em ${ALVOS[0]} segundos`, 'aviso parado: texto que muda a cada decimo pisca na TV');
});

test('relogio-festa: aperto com o relogio a vista nao vale, e so o primeiro aperto conta', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, 1); aperta(p, 0); passo(p, DT);
  assert.equal(p.dados.parou[0], null);
  ate(p, 5 - DT); aperta(p, 0); passo(p, DT);
  ate(p, 8 - DT); aperta(p, 0); passo(p, DT);
  assert.ok(Math.abs(p.dados.parou[0] - 5) < 0.02);
  assert.equal(p.dados.fase, 'conta', 'o outro ainda nao parou');
  assert.equal(p.celular[0].modo, 'espera');
});

test('relogio-festa: quem chega mais perto leva mais pontos (1 por rival que ficou atras)', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  joga(p, [8, 9.9, 11, 10.5]);          // erros 2,0  0,1  1,0  0,5
  assert.deepEqual(p.dados.placar, [0, 3, 1, 2]);
  assert.match(p.dados.aviso, /Jogador 2 chegou mais perto: 9,90 s/);
  assert.match(p.celular[3].texto, /10,50 s/);
  assert.equal(p.fase, 'jogando');
});

test('relogio-festa: quem nao aperta fica em ultimo, atras ate de quem errou feio', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  joga(p, [4, null, 10]);
  assert.equal(p.dados.t >= ALVOS[0] + CORTE - 1e-6, true, 'a rodada fecha sozinha no corte');
  assert.deepEqual(p.dados.placar, [1, 0, 2]);
  assert.match(p.celular[1].texto, /não parou/i);
});

test('relogio-festa: erros iguais no numero que a TV mostra empatam a rodada', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  joga(p, [10 - 2 * DT, 10 + 2 * DT]);      // 9,97 e 10,03: os dois com erro de 0,03
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.match(p.dados.aviso, /Empate/);
});

test('relogio-festa: sao 3 rodadas com alvos diferentes e em vs vence a maior soma', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  joga(p, [10, 9, 8]);                  // 2 1 0
  assert.equal(p.dados.rodada, 0);
  joga(p, [5, 7, 6]);                   // alvo 7: 0 2 1
  assert.equal(p.dados.alvo, ALVOS[1]);
  assert.deepEqual(p.dados.placar, [2, 3, 1]);
  joga(p, [10, 12, 11]);                // alvo 12: 0 2 1
  assert.deepEqual(p.dados.placar, [2, 5, 2]);
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0]);
  assert.match(p.celular[1].texto, /Você venceu/);
});

test('relogio-festa: em times os pontos da dupla somam e o time vence', () => {
  const p = partidaCom(jogo, undefined, times);
  joga(p, [10, 6, 9.5, 7]);             // so os rivais contam: J1 e J3 ficam na frente dos dois do time B
  assert.deepEqual(p.dados.placar, [4, 0]);
  ateOFim(p);
  assert.equal(p.vencedor, 0, 'time A (J1 + J3)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('relogio-festa: em times o colega nao conta como rival (erro igual na dupla nao tira ponto dela)', () => {
  const p = partidaCom(jogo, undefined, times);
  joga(p, [9, 9.5, 11, 8.5]);           // erros: J1 1,0  J2 0,5  J3 1,0  J4 1,5: cada time ganha um confronto de cada rival
  assert.deepEqual(p.dados.placar, [2, 2]);
});

test('relogio-festa: o aviso de aperto cedo some assim que o relogio some', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, VISIVEL - 0.1); aperta(p, 0); passo(p, DT);
  assert.match(p.celular[0].texto, /Ainda não vale/);
  ate(p, VISIVEL + 0.05);
  assert.match(p.celular[0].texto, /pare em/);
});

test('relogio-festa: somas iguais no fim dao empate, e parados tambem', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  joga(p, [10, 9]); joga(p, [6, 7]);
  assert.deepEqual(p.dados.placar, [1, 1]);
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  for (const o of [vs(4), times]) { const q = partidaCom(jogo, undefined, o); ateOFim(q); assert.equal(q.vencedor, -1); }
});

test('relogio-festa: termina sozinho dentro do limite, com 2 a 4 e dedos aleatorios, sem NaN', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    assert.ok(rodada(jogo, () => {}, 1, o).segundos <= LIMITE + 0.1);
    const { p } = rodada(jogo, aleatorio, 5, o);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});

test('relogio-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
