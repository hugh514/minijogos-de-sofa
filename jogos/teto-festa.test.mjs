import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, contexto, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { SUBIDAS, TEMPO, ESP } from './teto-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

function nova(o, teto = 6.5) {
  const p = partidaCom(jogo, undefined, o);
  p.dados.teto = teto;
  p.jogadores.forEach((_, i) => entrada(p, i, { x: 0, y: 0, d: false, n: 0 }));
  roda(p, 0.05);
  return p;
}
const segura = (p, i) => entrada(p, i, { x: 0, y: 0, d: true, n: p.jogadores[i].n + 1 });
const solta = (p, i) => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n });
// Uma subida inteira: todos seguram e cada um solta depois de seg[i] segundos (null = segura até bater). Espera a revelação do teto.
function subida(p, seg, teto = 6.5) {
  const d = p.dados, n = d.subida;
  d.teto = teto;
  seg.forEach((_, i) => segura(p, i));
  const ordem = seg.map((_, i) => i).filter(i => seg[i] !== null).sort((a, b) => seg[a] - seg[b]);
  let t = 0;
  for (const i of ordem) { roda(p, seg[i] - t); t = seg[i]; solta(p, i); }
  for (let q = 0; q < 12 * 60 && p.fase === 'jogando' && d.subida === n; q++) passo(p, DT);
  seg.forEach((_, i) => solta(p, i));
}

test('teto-festa: contrato da festa, tempo de 20 a 50 s e um botão só', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(SUBIDAS, 3);
  assert.equal(jogo.genero, 'equilibrio');
  assert.equal(jogo.rotulo, 'cm');
  assert.equal(jogo.controle.modo, 'botao');
  assert.equal(jogo.semMovimento, true);
});

test('teto-festa: começa com uma coluna por jogador, lado a lado, todos no chão e o mesmo teto para todos', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(d.e.length, o.n);
    assert.equal(d.subida, 1);
    assert.ok(d.teto >= 3 && d.teto <= 7, 'um teto só, sorteado: ' + d.teto);
    assert.deepEqual(d.placar, o.modo === 'times' ? [0, 0] : Array(o.n).fill(0));
    const xs = p.jogadores.map(j => j.x);
    for (let i = 1; i < o.n; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - ESP) < 1e-9, 'colunas: ' + xs);
    assert.ok(Math.abs(xs[0] + xs[o.n - 1]) < 1e-9, 'centradas');
    for (const e of d.e) { assert.equal(e.estado, 'espera'); assert.equal(e.alt, 0); }
    assert.match(p.celular[o.n - 1].texto, /Subida 1 de 3/);
  }
});

test('teto-festa: segurar sobe, soltar trava de vez, só a coluna de quem apertou', () => {
  const p = nova(vs(3)), e = p.dados.e[1];
  segura(p, 1); roda(p, 1);
  assert.equal(e.estado, 'sobe');
  assert.ok(e.alt > 1.3 && e.alt < 2, 'subiu ' + e.alt);
  assert.equal(p.dados.e[0].alt, 0);
  solta(p, 1); roda(p, 0.1);
  assert.equal(e.estado, 'travou');
  const travado = p.dados.placar[1];
  assert.ok(travado > 130);
  assert.match(p.celular[1].texto, new RegExp(`Travou em ${travado} cm`));
  segura(p, 1); roda(p, 0.5);
  assert.equal(p.dados.placar[1], travado, 'apertar de novo não sobe mais');
  assert.deepEqual([p.dados.placar[0], p.dados.placar[2]], [0, 0]);
});

test('teto-festa: quem bate no teto despenca, zera a subida e o celular vibra; o teto é o mesmo para todos', () => {
  const p = nova(vs(4), 3);
  for (const i of [0, 1, 2, 3]) segura(p, i);
  roda(p, 1); solta(p, 2);                                    // o J3 trava cedo; os outros seguram até bater
  roda(p, 1.5);
  assert.deepEqual(p.dados.e.map(e => e.estado === 'caindo' || e.estado === 'caiu'), [true, true, false, true]);
  assert.equal(p.dados.placar[0], 0);
  assert.ok(p.dados.placar[2] > 130);
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[2].vibra ?? 0, 0);
  assert.match(p.celular[0].texto, /Bateu no teto/);
  roda(p, 1);
  assert.match(p.dados.aviso, /O teto estava em 300 cm/);
});

test('teto-festa: são 3 subidas, cada uma com teto novo, e as alturas travadas somam', () => {
  const p = nova(vs(3));
  subida(p, [1, 1.5, 0.5]);
  assert.equal(p.fase, 'jogando', 'uma subida só não decide');
  assert.equal(p.dados.subida, 2);
  const um = [...p.dados.placar];
  assert.ok(um[1] > um[0] && um[0] > um[2]);
  assert.ok(p.dados.e.every(e => e.estado === 'espera' && e.alt === 0), 'todos voltam ao chão');
  subida(p, [1, null, 1], 3);                                 // o J2 bate no teto: esta subida vale zero, a anterior fica
  assert.equal(p.dados.placar[1], um[1]);
  assert.ok(p.dados.placar[0] > um[0]);
  assert.equal(p.dados.subida, 3);
  subida(p, [0.5, 0.5, 0.5]);
  assert.equal(p.fase, 'resultado');
});

test('teto-festa: depois das 3 subidas vence a maior soma (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = nova(vs(n));
    const seg = Array.from({ length: n }, (_, i) => (i === w ? 1.5 : 1));
    subida(p, seg); subida(p, seg.map(() => 1)); subida(p, seg.map(() => 1));
    assert.equal(p.fase, 'resultado', `n ${n}`);
    assert.equal(p.vencedor, w);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.equal(p.dados.aviso, `Jogador ${w + 1} venceu!`);
    assert.equal(p.celular[w].texto, 'Você venceu!');
  }
});

test('teto-festa: em times vale a soma do time e o retorno é o time', () => {
  for (const time of [0, 1]) {
    const p = nova(times);
    const seg = [0, 1, 2, 3].map(i => (i % 2 === time ? 1.2 : 1));
    subida(p, seg);
    assert.equal(p.dados.placar.length, 2);
    assert.ok(p.dados.placar[time] > p.dados.placar[1 - time]);
    assert.equal(p.dados.inventario.length, 4);
    subida(p, [1, 1, 1, 1]); subida(p, [1, 1, 1, 1]);
    assert.equal(p.vencedor, time);
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
    assert.equal(p.dados.aviso, time === 0 ? 'Time laranja venceu!' : 'Time roxo venceu!');
    assert.equal(p.celular[1 - time].texto, 'O outro time venceu');
  }
  const p = nova(times);
  subida(p, [1, 2.2, 1, null], 6.5);                          // a maior altura isolada é do time B
  subida(p, [1.5, null, 1.5, null], 5); subida(p, [1.5, null, 1.5, null], 5);
  assert.equal(p.vencedor, 0, 'a soma do time A passa');
});

test('teto-festa: somas iguais dão empate, com o mesmo número que a tela mostra', () => {
  for (const o of COMBOS) {
    const p = nova(o);
    for (let k = 0; k < SUBIDAS; k++) subida(p, Array(o.n).fill(1));
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.equal(p.dados.aviso, 'Empate!');
    assert.ok(p.dados.placar.every(Number.isInteger), 'placar em centímetros inteiros');
  }
  const p = nova(vs(3));
  for (let k = 0; k < SUBIDAS; k++) subida(p, [1.5, 1.5, 1]);
  assert.equal(p.vencedor, -1, 'dois empatados na frente');
});

test('teto-festa: quem demora sobe sozinho, e um toque trava', () => {
  const p = nova(vs(2), 7);
  roda(p, 3.2);
  assert.ok(p.dados.e.every(e => e.estado === 'sobe' && e.auto));
  assert.equal(p.celular[0].vibra, 1);
  assert.match(p.celular[0].texto, /sozinho/);
  segura(p, 0); roda(p, 0.1); solta(p, 0); roda(p, 0.1);
  assert.equal(p.dados.e[0].estado, 'travou');
  assert.ok(p.dados.placar[0] > 0);
});

test('teto-festa: parados, todos batem no teto nas 3 subidas e a rodada acaba em empate dentro do tempo', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, () => {}, 1, o);
    assert.ok(segundos > 5 && segundos <= TEMPO + 0.1, 'durou ' + segundos);
    assert.equal(p.vencedor, -1);
    assert.deepEqual(p.dados.placar, o.modo === 'times' ? [0, 0] : Array(o.n).fill(0));
  }
});

test('teto-festa: o limite de tempo trava quem ainda sobe e decide pela soma', () => {
  const p = nova(vs(3), 7);
  p.dados.e[1].alt = 2; p.dados.e[1].estado = 'travou';
  p.t = TEMPO - 0.05;
  roda(p, 0.2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
});

test('teto-festa: textos sem travessão, sem caixa alta crua e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = nova(o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    junta();
    segura(p, 0); roda(p, 0.5); junta(); solta(p, 0); roda(p, 0.1); junta();
    roda(p, 3.5); junta(); roda(p, 4); junta(); roda(p, 2); junta();
    for (let k = 0; k < 60 * 40 && p.fase === 'jogando'; k++) passo(p, DT);
    junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('teto-festa: dedos aleatórios até o fim, sem NaN, no tempo e com vencedor válido', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(segundos <= TEMPO + 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    assert.ok(d.placar.every(v => Number.isInteger(v) && v >= 0 && v <= 3 * 700), 'placar ' + d.placar);
    for (const e of d.e) assert.ok(Number.isFinite(e.alt) && e.alt >= 0);
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('teto-festa: nenhum modificador de movimento serve (o motor não move ninguém) e a rodada roda inteira com qualquer p.mod', () => {
  assert.ok(jogo.semMovimento && jogo.controle.modo !== 'padrao');
  for (const m of MODIFICADORES) for (const o of COMBOS) {
    const p = partidaCom(jogo, sorteio(11), o), rng = sorteio(12), c = contexto(p);
    p.mod = m;
    jogo.monta(c);
    for (let q = 0; q < 40 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      if (p.fase === 'jogando') jogo.desenha(c, DT, q * DT);
    }
    assert.notEqual(p.fase, 'jogando', m.id);
    assert.deepEqual(p.erros, []);
    for (const j of p.jogadores) for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Number.isFinite(j[k]), m.id + ' ' + k);
  }
});

test('teto-festa: fumaça (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
