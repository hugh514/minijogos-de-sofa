import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS_VS, VIDAS_TIME, R_PISTA } from './cadeiras-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// Deixa a musica tocando sem parar ate a rodada do minijogo fechar (pelo tempo).
function ateOFim(p) { p.dados.dur = 999; for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }
// Uma rodada inteira: a musica para ja, todos os que jogam sentam menos "sobra", que fica no meio.
function rodadaSem(p, sobra) {
  const d = p.dados;
  for (let k = 0; k < 600 && d.fase !== 'musica' && p.fase === 'jogando'; k++) passo(p, DT);
  d.dur = 0; passo(p, DT);
  assert.equal(d.fase, 'corre');
  let k = 0;
  p.jogadores.forEach((j, i) => { if (!j.vivo) return; if (i === sobra) poe(p, i, 0, 0); else { const ch = d.cadeiras[k++]; poe(p, i, ch.x, ch.z); } });
  passo(p, DT);
}

test('cadeiras-festa: contrato da festa, tempo de 20 a 50 s, genero e rotulo', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(jogo.genero, 'ritmo');
  assert.equal(jogo.rotulo, 'vidas');
});

test('cadeiras-festa: comeca com uma cadeira a menos que os jogadores, todos com vidas e dentro da pista', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.equal(d.cadeiras.length, o.n - 1);
    assert.deepEqual(d.placar, o.modo === 'times' ? [VIDAS_TIME, VIDAS_TIME] : Array(o.n).fill(VIDAS_VS));
    assert.equal(d.fase, 'musica');
    for (const j of p.jogadores) assert.ok(Math.hypot(j.x, j.z) < R_PISTA, 'larga na pista');
  }
});

test('cadeiras-festa: com a musica tocando ninguem sai da pista e as cadeiras giram', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  d.dur = 99;
  const a0 = d.cadeiras[0].a;
  poe(p, 0, 7, 0);
  roda(p, 1.5);
  assert.ok(Math.hypot(p.jogadores[0].x, p.jogadores[0].z) <= R_PISTA + 0.01, 'puxado de volta para a pista');
  assert.notEqual(d.cadeiras[0].a, a0);
  assert.deepEqual(d.placar, [2, 2, 2], 'nada muda enquanto toca');
});

test('cadeiras-festa: a musica para sozinha, em momento sorteado, e avisa', () => {
  const duracoes = new Set();
  for (const s of [1, 2, 3, 4]) {
    const p = partidaCom(jogo, sorteio(s), vs(2)), d = p.dados;
    duracoes.add(d.dur.toFixed(2));
    roda(p, d.dur + 0.1);
    assert.equal(d.fase, 'corre');
    assert.equal(d.aviso, 'Parou!');
    assert.equal(p.celular[0].vibra, 1, 'vibra quando para');
  }
  assert.ok(duracoes.size >= 3, 'duracao varia: ' + [...duracoes]);
});

test('cadeiras-festa: quem fica sem cadeira perde uma vida, so ele, e a rodada seguinte recomeca', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  rodadaSem(p, 1);
  assert.equal(d.fase, 'sentado');
  assert.deepEqual(d.placar, [2, 1, 2]);
  assert.equal(d.dePe, 1);
  assert.match(d.aviso, /Jogador 2/);
  assert.match(p.celular[1].texto, /Vidas: 1/);
  assert.equal(p.fase, 'jogando', 'a primeira falha nao elimina');
  assert.equal(p.jogadores[1].vivo, true);
  roda(p, 2);
  assert.equal(d.fase, 'musica');
  assert.equal(d.cadeiras.length, 2, 'ainda 3 jogando: 2 cadeiras');
  assert.ok(d.sentou.every(v => v < 0), 'todos levantam');
});

test('cadeiras-festa: cada cadeira e de um so, do mais perto, e quem senta fica preso nela', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  d.dur = 0; passo(p, DT);
  const ch = d.cadeiras[0];
  poe(p, 0, ch.x + 0.9, ch.z); poe(p, 1, ch.x - 0.3, ch.z - 0.3);
  passo(p, DT);
  assert.equal(d.sentou[1], 0);
  assert.equal(d.sentou[0], -1);
  assert.deepEqual(d.placar, [1, 2]);
  roda(p, 0.3);
  assert.ok(Math.hypot(p.jogadores[1].x - ch.x, p.jogadores[1].z - ch.z) < 0.01);
});

test('cadeiras-festa: se ninguem chega, as cadeiras vao para os mais perto e a rodada anda', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  d.dur = 0; passo(p, DT);
  roda(p, 4);
  assert.equal(d.placar.reduce((s, v) => s + v, 0), 5, 'um perdeu a vida: ' + d.placar);
});

test('cadeiras-festa: sem vidas sai do jogo, a roda fica com menos cadeiras e o ultimo de pe vence (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n)), d = p.dados;
    let saiu = 0;
    for (let i = 0; i < n; i++) {
      if (i === w) continue;
      rodadaSem(p, i);
      assert.equal(p.fase, 'jogando');
      rodadaSem(p, i); saiu++;
      assert.equal(p.jogadores[i].vivo, false, 'voa para fora');
      if (saiu < n - 1) { roda(p, 2); assert.equal(d.cadeiras.length, n - saiu - 1); }
    }
    assert.equal(p.fase, 'resultado', `n ${n}`);
    assert.equal(p.vencedor, w);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('cadeiras-festa: em times sao 3 cadeiras sempre, a vida e do time e vence o time que sobra', () => {
  for (const time of [0, 1]) {
    const p = partidaCom(jogo, undefined, times), d = p.dados, rival = 1 - time;
    rodadaSem(p, rival);
    assert.deepEqual(d.placar, time === 0 ? [3, 2] : [2, 3]);
    assert.match(p.celular[rival + 2].texto, /Vidas do time: 2/, 'o parceiro ve a vida do time');
    roda(p, 2);
    rodadaSem(p, rival + 2);
    assert.equal(p.fase, 'jogando');
    assert.ok(p.jogadores.every(j => j.vivo), 'em times ninguem sai');
    roda(p, 2);
    assert.equal(d.cadeiras.length, 3);
    rodadaSem(p, rival);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, time, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
  }
});

test('cadeiras-festa: no fim do tempo vence quem tem mais vidas, e vidas iguais dao empate', () => {
  let p = partidaCom(jogo, undefined, vs(3));
  rodadaSem(p, 0); roda(p, 2); rodadaSem(p, 2);
  roda(p, 2); ateOFim(p);
  assert.equal(p.vencedor, 1);
  for (const o of COMBOS) {
    p = partidaCom(jogo, undefined, o);
    p.dados.dur = 999;
    roda(p, TEMPO - 1); assert.equal(p.fase, 'jogando');
    roda(p, 1.2);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.equal(p.dados.aviso, 'Empate!');
  }
  p = partidaCom(jogo, undefined, times);
  rodadaSem(p, 1); roda(p, 2); ateOFim(p);
  assert.equal(p.vencedor, 0);
  assert.equal(p.dados.aviso, 'Time laranja venceu!');
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[1].texto, 'O outro time venceu');
});

test('cadeiras-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta();
    rodadaSem(p, 0); junta();
    roda(p, 2); rodadaSem(p, 0); junta();
    if (p.fase === 'jogando') { roda(p, 2); ateOFim(p); junta(); }
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('cadeiras-festa: dedos aleatorios ate o fim, sem NaN, com vencedor valido e dentro do tempo', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(segundos <= TEMPO + 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    for (const v of d.placar) assert.ok(Number.isInteger(v) && v >= 0, 'placar ' + d.placar);
    for (const ch of d.cadeiras) for (const campo of ['x', 'z', 'a']) assert.ok(Number.isFinite(ch[campo]));
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('cadeiras-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
