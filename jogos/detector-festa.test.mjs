import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, T_CAVA, T_ERRO, ACHOU, raioDe, qtdTesouros, intervalo, calor } from './detector-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
const aperta = (p, i) => { const j = p.jogadores[i], n = (j.n ?? 0) + 1; entrada(p, i, { x: 0, y: 0, d: false, n: n - 1 }); entrada(p, i, { x: 0, y: 0, d: true, n }); };
// O jogador i cava no ponto (x, z) e espera o buraco ficar pronto.
function cava(p, i, x, z) {
  poe(p, i, x, z); aperta(p, i); passo(p, DT);
  for (let k = 0; k < (T_CAVA + 0.1) * 60 && p.fase === 'jogando' && p.dados.cava[i] > 0; k++) passo(p, DT);
}
const acha = (p, i, k = 0) => { const t = p.dados.tesouros[k]; cava(p, i, t.x, t.z); };
// Um ponto da arena longe de todos os tesouros.
function vazio(p) {
  for (let a = 0; a < 40; a++) {
    const x = Math.cos(a) * 5, z = Math.sin(a) * 5;
    if (p.dados.tesouros.every(t => Math.hypot(t.x - x, t.z - z) > ACHOU + 2.5)) return { x, z };
  }
  throw new Error('sem lugar vazio');
}
const parados = (p, s) => { for (let k = 0; k < s * 60 && p.fase === 'jogando'; k++) passo(p, DT); };
const permitidos = () => MODIFICADORES.filter(m => (!m.pulo || !jogo.semPulo) && !jogo.semMod?.includes(m.id));

test('detector-festa: contrato da festa, tempo de 20 a 50 s, genero, botao e dica em uma frase', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(jogo.genero, 'ritmo');
  assert.equal(jogo.rotulo, 'tesouros');
  assert.deepEqual(jogo.controle, { modo: 'padrao', a: 'Cavar', b: '' });
  assert.ok(jogo.semDash && jogo.semPulo && !jogo.semMovimento);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('detector-festa: comeca com 2, 3 e 4 (e em times), com tesouros enterrados dentro da arena e longe de todos', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, donos = o.modo === 'times' ? 2 : o.n;
    assert.equal(p.jogadores.length, o.n);
    assert.equal(p.arena.raio, raioDe(o.n));
    assert.equal(d.tesouros.length, qtdTesouros(o.n));
    assert.deepEqual(d.placar, Array(donos).fill(0));
    for (const t of d.tesouros) {
      assert.ok(Math.hypot(t.x, t.z) <= p.arena.raio - 2 + 1e-9, 'tesouro dentro da arena');
      for (const j of p.jogadores) assert.ok(Math.hypot(j.x - t.x, j.z - t.z) > 2.5, 'ninguem larga em cima de um tesouro');
    }
    for (const j of p.jogadores) assert.ok(Math.hypot(j.x, j.z) < p.arena.raio - 1);
    for (const c of p.celular) assert.match(c.texto, /^Tesouros( do time)?: 0\. (Frio|Morno|Quente)/);
  }
  assert.ok(qtdTesouros(4) > qtdTesouros(2), 'mais gente, mais tesouros');
});

test('detector-festa: quente e frio pela distancia do tesouro mais proximo, no celular e na vibracao', () => {
  assert.ok(intervalo(0) < 0.2 && intervalo(3) < intervalo(8) && intervalo(50) <= 2);
  assert.ok(calor(0) === 1 && calor(4) > calor(8) && calor(30) === 0);
  const p = partidaCom(jogo, undefined, vs(2)), [t0, t1] = p.dados.tesouros;
  const longe = [...Array(60).keys()].map(a => ({ x: Math.cos(a) * 8, z: Math.sin(a) * 8 })).sort((a, b) =>
    Math.min(Math.hypot(b.x - t0.x, b.z - t0.z), Math.hypot(b.x - t1.x, b.z - t1.z)) - Math.min(Math.hypot(a.x - t0.x, a.z - t0.z), Math.hypot(a.x - t1.x, a.z - t1.z)))[0];
  let v0 = p.celular[0].vibra ?? 0, v1 = p.celular[1].vibra ?? 0;
  for (let k = 0; k < 120; k++) { poe(p, 0, t1.x, t1.z); poe(p, 1, longe.x, longe.z); passo(p, DT); }       // J1 em cima do segundo tesouro: vale o mais proximo
  v0 = p.celular[0].vibra - v0; v1 = (p.celular[1].vibra ?? 0) - v1;
  assert.ok(v0 >= 8, 'em cima do tesouro vibra varias vezes por segundo: ' + v0);
  assert.ok(v1 <= 3 && v0 > v1 * 3, 'longe vibra pouco: ' + v1);
  assert.match(p.celular[0].texto, /Quente/);
  assert.match(p.celular[1].texto, /Frio/);
  assert.ok(p.dados.calor[0] > 0.9 && p.dados.calor[1] < 0.4);
});

test('detector-festa: cavar em cima do tesouro vale 1 ponto e surge outro em outro lugar', () => {
  const p = partidaCom(jogo, undefined, vs(3)), antes = p.dados.tesouros.map(t => ({ ...t }));
  acha(p, 1, 0);
  assert.deepEqual(p.dados.placar, [0, 1, 0]);
  assert.equal(p.dados.tesouros.length, qtdTesouros(3));
  assert.ok(Math.hypot(p.dados.tesouros[0].x - antes[0].x, p.dados.tesouros[0].z - antes[0].z) > 2, 'o novo fica longe do que saiu');
  assert.deepEqual(p.dados.tesouros[1], antes[1], 'o outro tesouro continua onde estava');
  assert.match(p.celular[1].texto, /^Tesouros: 1\./);
  assert.equal(p.dados.aviso, 'Jogador 2 achou!');
  assert.equal(p.dados.tonto[1], 0, 'quem acha nao fica parado');
});

test('detector-festa: enquanto cava o boneco fica parado, e cavar errado da mais um tempinho parado', () => {
  const p = partidaCom(jogo, undefined, vs(2)), v = vazio(p);
  poe(p, 0, v.x, v.z); aperta(p, 0); passo(p, DT);
  assert.ok(p.dados.cava[0] > 0);
  entrada(p, 0, { x: 1, y: 0, d: false, n: p.jogadores[0].n });
  roda(p, T_CAVA - 0.1);
  assert.ok(Math.hypot(p.jogadores[0].x - v.x, p.jogadores[0].z - v.z) < 1e-6, 'nao anda cavando');
  roda(p, 0.2);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.ok(p.dados.tonto[0] > T_ERRO - 0.3, 'buraco vazio: fica parado');
  assert.match(p.celular[0].texto, /Buraco vazio/);
  assert.equal(p.dados.buracos.length, 1);
  aperta(p, 0); roda(p, T_ERRO - 0.4);
  assert.ok(Math.hypot(p.jogadores[0].x - v.x, p.jogadores[0].z - v.z) < 1e-6, 'parado ate passar');
  assert.equal(p.dados.cava[0], 0, 'nao cava enquanto esta parado');
  entrada(p, 0, { x: 1, y: 0, d: false, n: p.jogadores[0].n });
  roda(p, 0.8);
  assert.ok(Math.hypot(p.jogadores[0].x - v.x, p.jogadores[0].z - v.z) > 0.5, 'depois volta a andar');
});

test('detector-festa: dois cavando o mesmo tesouro, so um leva (o que cavou mais perto), e o outro acha um buraco vazio', () => {
  const p = partidaCom(jogo, undefined, vs(2)), t = { ...p.dados.tesouros[0] };
  poe(p, 0, t.x + 0.9, t.z); poe(p, 1, t.x - 0.1, t.z);
  aperta(p, 0); aperta(p, 1); passo(p, DT);
  for (let k = 0; k < 60; k++) { poe(p, 0, t.x + 0.9, t.z); poe(p, 1, t.x - 0.1, t.z); passo(p, DT); }
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.ok(p.dados.tonto[0] > 0);
});

test('detector-festa: vs devolve o indice de quem achou mais ate o tempo acabar (cada jogador, com 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < n; i++) {
    const p = partidaCom(jogo, undefined, vs(n));
    acha(p, i); acha(p, i); acha(p, (i + 1) % n);
    assert.equal(p.fase, 'jogando', 'ninguem vence antes do tempo');
    parados(p, TEMPO + 1);
    assert.equal(p.fase, 'resultado', `n ${n}, jogador ${i}`);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
    assert.equal(p.jogadores.filter(j => j.pontos).length, 1, 'so o vencedor pontua');
    assert.equal(p.dados.aviso, `Jogador ${i + 1} venceu!`);
    assert.equal(p.celular[i].texto, 'Você venceu!');
    assert.equal(p.celular[(i + 1) % n].texto, `Jogador ${i + 1} venceu`);
  }
});

test('detector-festa: times somam os tesouros dos dois, devolvem o time (0 ou 1) e os dois do time pontuam', () => {
  const a = partidaCom(jogo, undefined, times);        // time A: J1 e J3
  acha(a, 0); acha(a, 2); acha(a, 1);
  assert.deepEqual(a.dados.placar, [2, 1]);
  assert.match(a.celular[2].texto, /^Tesouros do time: 2\./);
  parados(a, TEMPO + 1);
  assert.equal(a.vencedor, 0);
  assert.deepEqual(a.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.equal(a.dados.aviso, 'Time laranja venceu!');
  assert.equal(a.celular[1].texto, 'O outro time venceu');
  const b = partidaCom(jogo, undefined, times);        // time B: J2 e J4
  acha(b, 3);
  parados(b, TEMPO + 1);
  assert.equal(b.vencedor, 1);
  assert.deepEqual(b.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('detector-festa: empate no tempo (zerados ou iguais) devolve -1, em vs e em times', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  parados(p, TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[0].texto, 'Empate!');
  const q = partidaCom(jogo, undefined, vs(4));
  acha(q, 0); acha(q, 3);
  parados(q, TEMPO + 1);
  assert.equal(q.vencedor, -1, 'dois na frente com 1 cada');
  const t = partidaCom(jogo, undefined, times);
  acha(t, 0); acha(t, 1);
  parados(t, TEMPO + 1);
  assert.equal(t.vencedor, -1);
});

test('detector-festa: ninguem acha ha muito tempo, o buraco que acha fica maior', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  const t = p.dados.tesouros[0];
  parados(p, 25);
  cava(p, 0, t.x + ACHOU + 0.8, t.z);
  assert.equal(p.dados.placar[0], 1);
});

test('detector-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel', () => {
  const todos = [jogo.nome, jogo.dica, jogo.rotulo, jogo.controle.a];
  const colhe = p => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), v = vazio(p);
    colhe(p); acha(p, 0); colhe(p); cava(p, 1, v.x, v.z); colhe(p);
    const t = p.dados.tesouros[0]; poe(p, 0, t.x + 4, t.z); passo(p, DT); colhe(p);
    parados(p, TEMPO + 1); colhe(p);
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('detector-festa: com cada modificador permitido (ouro, gelo, foguete, espelho) roda ate o fim sem NaN', () => {
  assert.deepEqual(permitidos().map(m => m.id), ['ouro', 'gelo', 'foguete', 'espelho'], 'lua nao sai: nao ha pulo');
  for (const mod of permitidos()) for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o); p.mod = mod;
    p.jogadores[0].carta = 'turbo';
    let s = 11; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let q = 0; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      for (const j of p.jogadores) assert.ok([j.x, j.z, j.vx, j.vz].every(Number.isFinite));
    }
    assert.notEqual(p.fase, 'jogando');
    assert.deepEqual(p.erros, []);
    assert.ok(p.dados.placar.every(Number.isInteger));
  }
});

test('detector-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores em vs e 4 em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('detector-festa: rodada de dedos aleatorios termina no tempo, em cada modo', () => {
  for (const o of COMBOS) {
    const { segundos } = rodada(jogo, aleatorio, 3, o);
    assert.ok(segundos <= TEMPO + 0.1, 'durou ' + segundos);
  }
});
