import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS, tempoVolta } from './lava-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const LADO = 2.4;
const pisoDe = (p, j) => p.dados.pisos[(Math.round(j.x / LADO) + 3) * 7 + Math.round(j.z / LADO) + 3];
// Ninguem racha piso (protecao longa): o teste decide quem cai.
const protege = p => { p.dados.protecao = p.dados.protecao.map(() => 999); };
// O piso debaixo do jogador i some: ele cai pelo caminho real (o motor tira o chao) e a vida cai no quadro seguinte.
function derruba(p, i) {
  protege(p);
  Object.assign(pisoDe(p, p.jogadores[i]), { caiu: true, volta: 999 });
  roda(p, 0.1);
}
// Derruba e espera voltar (se ainda tiver vida).
function quedaInteira(p, i) { derruba(p, i); if (p.fase === 'jogando') { roda(p, 1.8); protege(p); } }
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) { protege(p); passo(p, DT); } }

test('lava-festa: contrato da festa, tempo de 20 a 50 s, genero e rotulo', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(jogo.genero, 'equilibrio');
  assert.equal(jogo.rotulo, 'vidas');
});

test('lava-festa: comeca com 49 pisos inteiros, 3 vidas para cada um e cada um num piso, longe dos outros', () => {
  assert.equal(VIDAS, 3);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.deepEqual(p.arena, { tipo: 'pisos', parede: false, n: 7, lado: LADO });
    assert.equal(d.pisos.length, 49);
    assert.ok(d.pisos.every(x => x.t < 0 && !x.caiu));
    assert.deepEqual(d.vidas, Array(o.n).fill(3));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    p.jogadores.forEach((j, i) => {
      assert.ok(Math.abs(j.x) < 8 && Math.abs(j.z) < 8, 'dentro do piso');
      p.jogadores.forEach((q, k) => { if (k > i) assert.ok(Math.hypot(j.x - q.x, j.z - q.z) > 4, 'separados'); });
    });
  }
});

test('lava-festa: nada racha nos primeiros 2,5 s; depois o piso pisado racha e cai em 2 s', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados, piso = pisoDe(p, p.jogadores[0]);
  roda(p, 2.3);
  assert.ok(d.pisos.every(x => x.t < 0), 'comeco protegido');
  roda(p, 0.4);
  assert.ok(piso.t >= 0, 'rachou');
  assert.equal(piso.caiu, false);
  roda(p, 1.5); assert.equal(piso.caiu, false);
  roda(p, 0.6); assert.equal(piso.caiu, true);
});

test('lava-festa: quem cai perde 1 vida, nao e eliminado e volta 1,5 s depois num piso inteiro', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  derruba(p, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.deepEqual(d.vidas, [3, 2, 3]);
  assert.equal(p.celular[1].vibra, 1);
  assert.match(p.celular[1].texto, /^Caiu! Volta em [12] s$/);
  assert.equal(p.fase, 'jogando', 'a primeira queda nao acaba a rodada');
  roda(p, 1.2); assert.equal(p.jogadores[1].vivo, false, 'ainda nao passou 1,5 s');
  roda(p, 0.5);
  const j = p.jogadores[1], piso = pisoDe(p, j);
  assert.equal(j.vivo, true);
  assert.equal(j.y, 0); assert.equal(j.vy, 0);
  assert.ok(piso && !piso.caiu && piso.t < 0, 'voltou num piso inteiro');
  assert.equal(p.celular[1].texto, 'Vidas: 2');
  roda(p, 0.5);
  assert.ok(piso.t < 0, 'protegido por um instante ao voltar: nao racha na hora');
  roda(p, 1.2);
  assert.ok(piso.t >= 0, 'depois da protecao o piso racha');
});

test('lava-festa: o piso que caiu volta depois de alguns segundos, mais rapido com mais gente', () => {
  assert.ok(tempoVolta(2) > tempoVolta(3) && tempoVolta(3) > tempoVolta(4) && tempoVolta(4) >= 2);
  const p = partidaCom(jogo, undefined, vs(4)), d = p.dados;
  protege(p);
  const piso = d.pisos[24];
  piso.t = 0;
  roda(p, 2.2); assert.equal(piso.caiu, true);
  roda(p, tempoVolta(4) - 0.5); assert.equal(piso.caiu, true);
  roda(p, 0.6);
  assert.equal(piso.caiu, false);
  assert.ok(piso.t < 0, 'inteiro de novo');
});

test('lava-festa: o piso racha mais depressa no fim da rodada', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  protege(p);
  p.t = TEMPO - 6;
  const piso = d.pisos[24]; piso.t = 0;
  roda(p, 1.6);
  assert.equal(piso.caiu, true);
});

test('lava-festa: a borda segura o boneco e quem anda sai do piso antes de ele cair', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  entrada(p, 0, { x: -1, y: -1, d: false, n: 0 });
  roda(p, 2);
  const j = p.jogadores[0];
  assert.equal(j.vivo, true);
  assert.ok(Math.abs(j.x) <= 8 && Math.abs(j.z) <= 8, 'parou na beirada');
});

test('lava-festa: sem vida nao volta, e o ultimo com vida vence na hora (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n));
    for (let i = 0; i < n; i++) {
      if (i === w) continue;
      for (let k = 0; k < 3; k++) { assert.equal(p.fase, 'jogando'); quedaInteira(p, i); }
      assert.equal(p.dados?.vidas?.[i] ?? 0, 0);
    }
    assert.equal(p.fase, 'resultado', `n ${n}`);
    assert.equal(p.vencedor, w);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('lava-festa: sem vidas fica fora e o celular avisa', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) quedaInteira(p, 0);
  roda(p, 2);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.celular[0].texto, 'Sem vidas. Torça!');
  assert.equal(p.fase, 'jogando');
});

test('lava-festa: em times o time so perde quando os dois ficam sem vida', () => {
  for (const time of [0, 1]) {
    const p = partidaCom(jogo, undefined, times), rival = 1 - time;
    for (let k = 0; k < 3; k++) quedaInteira(p, rival);
    assert.equal(p.dados.vidas[rival], 0);
    assert.equal(p.fase, 'jogando', 'o parceiro ainda segura o time');
    assert.deepEqual(p.dados.placar, time === 0 ? [6, 3] : [3, 6], 'placar soma as vidas do time');
    assert.match(p.celular[rival + 2].texto, /time: 3/);
    for (let k = 0; k < 3; k++) quedaInteira(p, rival + 2);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, time, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
  }
});

test('lava-festa: no fim do tempo vence quem tem mais vidas (vs e times) e vidas iguais dao empate', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  quedaInteira(p, 0); quedaInteira(p, 1); quedaInteira(p, 3);
  ateOFim(p);
  assert.equal(p.vencedor, 2);
  assert.equal(p.dados.aviso, 'Jogador 3 venceu!');
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Jogador 3 venceu');
  p = partidaCom(jogo, undefined, times);
  quedaInteira(p, 3);
  ateOFim(p);
  assert.equal(p.vencedor, 0);
  assert.equal(p.dados.aviso, 'Time laranja venceu!');
  assert.equal(p.celular[1].texto, 'O outro time venceu');
  for (const o of COMBOS) {
    p = partidaCom(jogo, undefined, o);
    protege(p); roda(p, 5); protege(p);
    assert.equal(p.fase, 'jogando');
    ateOFim(p);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.equal(p.dados.aviso, 'Empate!');
  }
});

test('lava-festa: todo mundo parado cai junto e a rodada termina sozinha em empate', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    let q = 0;
    for (; q < 60 * 60 && p.fase === 'jogando'; q++) passo(p, DT);
    assert.equal(p.vencedor, -1);
    assert.ok(q * DT > 5 && q * DT <= TEMPO + 0.1, 'durou ' + q * DT);
  }
});

test('lava-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a, jogo.controle.b];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta();
    derruba(p, 0); junta();
    roda(p, 1.8); junta();
    quedaInteira(p, 0); derruba(p, 0); junta();
    if (p.fase === 'jogando') { ateOFim(p); junta(); }
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('lava-festa: dedos aleatorios ate o fim, sem NaN, com vencedor valido e dentro do tempo', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(segundos <= TEMPO + 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    for (const v of d.vidas) assert.ok(Number.isInteger(v) && v >= 0 && v <= VIDAS, 'vidas ' + d.vidas);
    for (const x of d.pisos) assert.ok(Number.isFinite(x.t) && Number.isFinite(x.volta));
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('lava-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
