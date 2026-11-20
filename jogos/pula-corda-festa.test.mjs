import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS } from './pula-corda-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

// Congela os sorteios (inversao e finta) e a aceleracao, para o teste controlar a corda.
function nova(o) {
  const p = partidaCom(jogo, undefined, o);
  Object.assign(p.dados, { proxInv: Infinity, proxFinta: Infinity, acel: 0, omega: 3, sentido: 1, finta: 0 });
  return p;
}
// Toque no botao com contador: o primeiro envio so fixa a base, o segundo e o toque de verdade.
function toca(p, i, campo = 'n') {
  if (p.jogadores[i][campo] === undefined) entrada(p, i, { x: 0, y: 0, [campo]: 0 });
  entrada(p, i, { x: 0, y: 0, [campo]: p.jogadores[i][campo] + 1 });
}
// Um giro: a corda fica 0.3 rad antes do chao (passa em 0.1 s); quem esta em "pulam" aperta na hora.
function giro(p, pulam = []) {
  const d = p.dados;
  d.fase = -0.3; d.omega = 3; d.caido = d.caido.map(() => 0); d.noAr = d.noAr.map(() => -1);
  for (const i of pulam) if (p.jogadores[i].vivo) toca(p, i);
  roda(p, 0.6);
}
const todosMenos = (p, fora) => [...p.jogadores.keys()].filter(i => !fora.includes(i));
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) { p.dados.fase = 1; p.dados.omega = 0; p.dados.acel = 0; passo(p, DT); } }

test('pula-corda-festa: contrato da festa, tempo de 20 a 50 s, genero, rotulo e um botao so', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(jogo.genero, 'ritmo');
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(jogo.controle.modo, 'botao');
  assert.equal(jogo.semMovimento, true);
});

test('pula-corda-festa: comeca com 3 vidas para cada um, lado a lado na corda, sem ninguem em cima de ninguem', () => {
  assert.equal(VIDAS, 3);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(3));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    const xs = p.jogadores.map(j => j.x);
    for (let i = 1; i < o.n; i++) assert.ok(xs[i] - xs[i - 1] >= 3.5, 'separados: ' + xs);
    assert.ok(Math.abs(xs[0] + xs[o.n - 1]) < 1e-9, 'centrados');
    assert.ok(Math.abs(xs[0]) <= 6.5, 'longe das pontas da corda');
    for (const j of p.jogadores) assert.equal(j.z, 0);
  }
});

test('pula-corda-festa: quem pula no tempo passa a corda, com A ou com B', () => {
  const p = nova(vs(4));
  for (const i of [0, 1]) toca(p, i, 'nb');
  giro(p, [2, 3]);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 3]);
  assert.equal(p.fase, 'jogando');
});

test('pula-corda-festa: quem nao pula tropeca, perde uma vida, so ele, e o celular vibra', () => {
  const p = nova(vs(3));
  giro(p, [0, 2]);
  assert.deepEqual(p.dados.vidas, [3, 2, 3]);
  assert.deepEqual(p.dados.placar, [3, 2, 3]);
  assert.ok(p.dados.caido[1] > 0, 'fica caido um instante');
  assert.equal(p.celular[1].vibra, 1);
  assert.equal(p.celular[0].vibra, undefined);
  assert.match(p.celular[1].texto, /Vidas: 2/);
  assert.equal(p.fase, 'jogando', 'o primeiro erro nao elimina');
});

test('pula-corda-festa: caido nao tropeca de novo no mesmo instante', () => {
  const p = nova(vs(2)), d = p.dados;
  giro(p, [1]);
  d.fase = -0.3; roda(p, 0.3);
  assert.deepEqual(d.vidas, [2, 2], 'o J1 estava caido e nao perdeu outra; o J2 nao pulou');
});

test('pula-corda-festa: a corda acelera ate um teto', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados, w0 = d.omega;
  d.vidas = [99, 99];
  roda(p, 10);
  assert.ok(d.omega > w0);
  for (let k = 0; k < 60 * 25 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.ok(d.omega <= 7, 'teto: ' + d.omega);
});

test('pula-corda-festa: sem vidas sai da corda e o ultimo de pe vence (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = nova(vs(n));
    for (let i = 0; i < n; i++) {
      if (i === w) continue;
      for (let k = 0; k < 3; k++) { assert.equal(p.fase, 'jogando'); giro(p, todosMenos(p, [i])); }
      assert.equal(p.jogadores[i].vivo, false, 'voa para fora');
    }
    assert.equal(p.fase, 'resultado', `n ${n}`);
    assert.equal(p.vencedor, w);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('pula-corda-festa: todos os que restam errando a ultima vida no mesmo giro empatam', () => {
  const p = nova(vs(3));
  p.dados.vidas = [1, 1, 1];
  giro(p, []);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('pula-corda-festa: em times o time so perde quando os dois ficam sem vida', () => {
  for (const time of [0, 1]) {
    const p = nova(times), rival = 1 - time;
    for (let k = 0; k < 3; k++) giro(p, todosMenos(p, [rival]));
    assert.equal(p.dados.vidas[rival], 0);
    assert.equal(p.fase, 'jogando', 'o parceiro ainda segura o time');
    assert.deepEqual(p.dados.placar, time === 0 ? [6, 3] : [3, 6], 'placar soma as vidas do time');
    for (let k = 0; k < 3; k++) giro(p, todosMenos(p, [rival + 2]));
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, time, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
  }
});

test('pula-corda-festa: no fim do tempo vence quem tem mais vidas (vs e times) e vidas iguais dao empate', () => {
  let p = nova(vs(4));
  giro(p, [1, 2]); giro(p, [0, 2, 3]);
  assert.deepEqual(p.dados.vidas, [2, 2, 3, 2]);
  ateOFim(p);
  assert.equal(p.vencedor, 2);
  assert.equal(p.dados.aviso, 'Jogador 3 venceu!');
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Jogador 3 venceu');
  p = nova(times);
  giro(p, [0, 1, 2]);
  ateOFim(p);
  assert.equal(p.vencedor, 0);
  assert.equal(p.dados.aviso, 'Time laranja venceu!');
  assert.equal(p.celular[3].texto, 'O outro time venceu');
  for (const o of COMBOS) {
    p = nova(o);
    p.dados.fase = 1; p.dados.omega = 0;
    roda(p, TEMPO - 1); assert.equal(p.fase, 'jogando');
    ateOFim(p);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
  }
});

test('pula-corda-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = nova(o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta();
    giro(p, [1]); junta();
    giro(p, [1]); giro(p, [1]); junta();
    if (p.fase === 'jogando') { ateOFim(p); junta(); }
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('pula-corda-festa: dedos aleatorios ate o fim, sem NaN, com vencedor valido e dentro do tempo', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(segundos <= TEMPO + 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    for (const v of d.vidas) assert.ok(Number.isInteger(v) && v >= 0 && v <= VIDAS, 'vidas ' + d.vidas);
    assert.ok(Number.isFinite(d.fase) && Number.isFinite(d.omega));
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('pula-corda-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
