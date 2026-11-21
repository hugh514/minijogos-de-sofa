import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, RODADAS, PONTOS, T_MIRA, T_ROLA, T_PAUSA, SAIDA, R_ARENA } from './bocha-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const disco = (p, i) => p.dados.discos.find(o => o.dono === i);
// Arrasta o dedo de (0, 0) ate (ax, ay) e solta: o disco sai na direcao oposta.
function arrasta(p, quais, ax, ay) {
  for (const i of quais) entrada(p, i, { x: 0, y: 0, d: true });
  passo(p, DT);
  for (const i of quais) entrada(p, i, { x: ax, y: ay, d: true });
  passo(p, DT);
  for (const i of quais) entrada(p, i, { x: ax, y: ay, d: false });
  passo(p, DT);
}
// Fecha a rodada atual com os discos parados nas distancias dadas (uma por jogador; null = caiu da pista) e espera a pausa.
function fechaRodada(p, dist) {
  const d = p.dados;
  d.discos.forEach(o => Object.assign(o, { x: dist[o.dono] ?? 0, z: 0, vx: 0, vz: 0, lancado: true, fora: dist[o.dono] === null }));
  d.fase = 'rola'; d.tempo = 0;
  passo(p, DT);
  const ganhos = [...d.ganhos];
  for (let k = 0; k < (T_PAUSA + 0.2) * 60 && p.fase === 'jogando' && d.fase === 'pausa'; k++) passo(p, DT);
  return ganhos;
}
const permitidos = () => MODIFICADORES.filter(m => !m.anda && !jogo.semMod?.includes(m.id));       // controle de toque: o motor so da os que nao mexem no andar

test('bocha-festa: contrato da festa, tempo de 20 a 50 s, genero e dica em uma frase', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.ok(RODADAS * (T_MIRA + T_ROLA + T_PAUSA) < TEMPO, 'as 3 rodadas cabem no tempo');
  assert.equal(jogo.genero, 'mira');
  assert.equal(jogo.controle.modo, 'toque');
  assert.ok(jogo.semMovimento && jogo.semDash && jogo.semPulo);
  assert.deepEqual(PONTOS, [3, 2, 1]);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('bocha-festa: comeca com 2, 3 e 4 (e em times), um disco na frente de cada um e todos mirando ao mesmo tempo', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, donos = o.modo === 'times' ? 2 : o.n;
    assert.equal(p.jogadores.length, o.n);
    assert.equal(d.discos.length, o.n);
    assert.equal(d.fase, 'mira');
    assert.equal(d.rodada, 1);
    assert.deepEqual(d.placar, Array(donos).fill(0));
    p.jogadores.forEach((j, i) => {
      const meu = disco(p, i);
      assert.ok(Math.abs(Math.hypot(meu.x, meu.z) - SAIDA) < 1e-9, 'todos largam a mesma distancia do centro');
      const dist = d.discos.map(q => Math.hypot(q.x - j.x, q.z - j.z));
      assert.equal(d.discos[dist.indexOf(Math.min(...dist))].dono, i, `o disco mais perto do J${i + 1} e o dele`);
      assert.ok(Math.hypot(j.x, j.z) < R_ARENA, 'boneco dentro da pista');
      assert.match(p.celular[i].texto, /Rodada 1 de 3/);
    });
    for (let a = 0; a < o.n; a++) for (let b = a + 1; b < o.n; b++)
      assert.ok(Math.hypot(d.discos[a].x - d.discos[b].x, d.discos[a].z - d.discos[b].z) > 4, 'discos separados');
  }
});

test('bocha-festa: arrastar para tras e soltar lanca o disco para o lado oposto, e todos lancam no mesmo quadro', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  arrasta(p, [0, 1, 2, 3], 0.6, 0);         // arrastou para a direita: sai para a esquerda
  for (let i = 0; i < 4; i++) {
    const o = disco(p, i);
    assert.ok(o.lancado, `J${i + 1} lancou`);
    assert.ok(o.vx < -3 && Math.abs(o.vz) < 1e-9, 'vai para a esquerda');
  }
  assert.equal(p.dados.fase, 'rola', 'todos lancaram: nao espera o resto da janela');
  assert.match(p.celular[0].texto, /Olhe para a tela/);
});

test('bocha-festa: arrasto curto demais nao lanca, e quem lanca nao tira a vez dos outros', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  arrasta(p, [1], 0.02, 0);
  assert.ok(!disco(p, 1).lancado);
  arrasta(p, [0], 0, 0.7);
  assert.ok(disco(p, 0).lancado && disco(p, 0).vz < 0);
  assert.equal(p.dados.fase, 'mira', 'os outros ainda podem mirar');
  arrasta(p, [1, 2], 0.5, 0.5);
  assert.equal(p.dados.fase, 'rola');
});

test('bocha-festa: quem nao lanca na janela tem o disco lancado sozinho, fraco e rumo ao centro', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    roda(p, T_MIRA - 0.2);
    assert.equal(p.dados.fase, 'mira');
    assert.ok(p.dados.discos.every(q => !q.lancado));
    roda(p, 0.4);
    assert.ok(p.dados.discos.every(q => q.lancado));
    roda(p, 2);                              // ja pararam e a pausa da pontuacao ainda nao acabou
    for (const q of p.dados.discos) { const r = Math.hypot(q.x, q.z); assert.ok(r > 2 && r < SAIDA, 'parou a caminho do centro, longe dele: ' + r); }
  }
});

test('bocha-festa: os discos se batem', () => {
  const p = partidaCom(jogo, undefined, vs(2)), a = disco(p, 0), b = disco(p, 1);
  Object.assign(b, { x: 0, z: 0, lancado: true });
  const dir = Math.sign(a.x);
  arrasta(p, [0], dir * 0.9, 0);            // forca toda, rumo ao centro
  roda(p, 1.5);
  assert.ok(Math.hypot(b.x, b.z) > 0.5, 'o disco parado no centro foi empurrado');
  assert.ok(p.dados.fx.length > 0);
});

test('bocha-festa: disco que ainda nao foi lancado nao e empurrado pelos outros', () => {
  const p = partidaCom(jogo, undefined, vs(2)), a = disco(p, 0), b = disco(p, 1), antes = { x: b.x, z: b.z };
  arrasta(p, [0], Math.sign(a.x) * 0.9, 0);      // forca toda, atravessa a pista rumo ao disco parado do rival
  for (let k = 0; k < 90; k++) { passo(p, DT); assert.deepEqual({ x: b.x, z: b.z }, antes); }
  assert.ok(!b.lancado && p.dados.fase === 'mira');
});

test('bocha-festa: disco que sai da pista cai e nao pontua', () => {
  const p = partidaCom(jogo, undefined, vs(2)), a = disco(p, 0);
  Object.assign(a, { x: R_ARENA - 0.1, z: 0, vx: 6, vz: 0, lancado: true });
  roda(p, 0.5);
  assert.ok(a.fora);
  assert.deepEqual(fechaRodada(p, [null, 3]), [0, 3]);
});

test('bocha-festa: quando param, pontua 3, 2 e 1 pela ordem de distancia do centro (o quarto nao pontua)', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  assert.deepEqual(fechaRodada(p, [4, 1, 6, 2.5]), [1, 3, 0, 2]);
  assert.deepEqual(p.dados.placar, [1, 3, 0, 2]);
  assert.equal(p.dados.rodada, 2, 'comeca a rodada seguinte');
  assert.equal(p.dados.fase, 'mira');
  assert.ok(p.dados.discos.every(q => !q.lancado && Math.abs(Math.hypot(q.x, q.z) - SAIDA) < 1e-9), 'discos novos no lugar de saida');
  const q = partidaCom(jogo, undefined, vs(3));
  assert.deepEqual(fechaRodada(q, [2, 2, 5]), [3, 3, 1], 'mesma distancia, mesmos pontos, e o seguinte fica em terceiro');
  const r = partidaCom(jogo, undefined, vs(2));
  assert.deepEqual(fechaRodada(r, [-3, 1]), [2, 3], 'a distancia vale para qualquer lado');
});

test('bocha-festa: ao pontuar, a tela diz quem ficou mais perto e cada celular diz o lugar e o total', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  d.discos.forEach(o => Object.assign(o, { x: [4, 1, null][o.dono] ?? 0, z: 0, vx: 0, vz: 0, lancado: true, fora: o.dono === 2 }));
  d.fase = 'rola'; passo(p, DT);
  assert.equal(d.fase, 'pausa');
  assert.equal(d.aviso, 'Jogador 2 mais perto!');
  assert.equal(p.celular[1].texto, '1º lugar: 3 pontos. Total: 3');
  assert.equal(p.celular[0].texto, '2º lugar: 2 pontos. Total: 2');
  assert.equal(p.celular[2].texto, 'Seu disco caiu. Total: 0');
});

test('bocha-festa: vs devolve o indice de quem somou mais nas 3 rodadas (cada jogador, com 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < n; i++) {
    const p = partidaCom(jogo, undefined, vs(n));
    for (let r = 0; r < RODADAS; r++) fechaRodada(p, Array.from({ length: n }, (_, k) => (k === i ? 0.5 : 2 + k)));
    assert.equal(p.fase, 'resultado', `n ${n}, jogador ${i}`);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
    assert.equal(p.jogadores.filter(j => j.pontos).length, 1, 'so o vencedor pontua');
    assert.equal(p.dados.aviso, `Jogador ${i + 1} venceu!`);
    assert.equal(p.celular[i].texto, 'Você venceu!');
    assert.equal(p.celular[(i + 1) % n].texto, `Jogador ${i + 1} venceu`);
  }
});

test('bocha-festa: a rodada so acaba depois das 3 rodadas', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  fechaRodada(p, [1, 2]); fechaRodada(p, [1, 2]);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.rodada, 3);
  assert.deepEqual(p.dados.placar, [6, 4]);
});

test('bocha-festa: times somam os pontos dos dois, devolvem o time (0 ou 1) e os dois do time pontuam', () => {
  const a = partidaCom(jogo, undefined, times);        // time A: J1 e J3
  assert.deepEqual(fechaRodada(a, [1, 5, 2, 6]), [3, 1, 2, 0]);
  assert.deepEqual(a.dados.placar, [5, 1]);
  fechaRodada(a, [1, 5, 2, 6]); fechaRodada(a, [1, 5, 2, 6]);
  assert.equal(a.vencedor, 0);
  assert.deepEqual(a.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.equal(a.dados.aviso, 'Time laranja venceu!');
  assert.equal(a.celular[2].texto, 'Você venceu!');
  assert.equal(a.celular[1].texto, 'O outro time venceu');
  const b = partidaCom(jogo, undefined, times);        // time B: J2 e J4
  for (let r = 0; r < RODADAS; r++) fechaRodada(b, [5, 1, 6, 2]);
  assert.equal(b.vencedor, 1);
  assert.deepEqual(b.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('bocha-festa: empate no total devolve -1, em vs e em times', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  fechaRodada(p, [1, 2]); fechaRodada(p, [2, 1]); fechaRodada(p, [null, null]);
  assert.deepEqual(p.dados.placar, [5, 5]);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[0].texto, 'Empate!');
  const t = partidaCom(jogo, undefined, times);
  fechaRodada(t, [1, 2, 4, 3]); fechaRodada(t, [1, 2, 4, 3]); fechaRodada(t, [1, 2, 4, 3]);       // A: 3 + 0, B: 2 + 1
  assert.deepEqual(t.dados.placar, [9, 9]);
  assert.equal(t.vencedor, -1);
});

test('bocha-festa: parados, a rodada termina sozinha dentro do tempo, com resultado valido', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, () => {}, 5, o);
    assert.ok(segundos <= TEMPO + 0.1 && segundos > 15, 'durou ' + segundos);
    assert.equal(p.dados.rodada, RODADAS);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});

test('bocha-festa: o tempo maximo decide pelo placar mesmo no meio de uma rodada', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  fechaRodada(p, [5, 1, 3]);
  p.t = TEMPO; passo(p, DT);
  assert.equal(p.vencedor, 1);
});

test('bocha-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel', () => {
  const todos = [jogo.nome, jogo.dica, jogo.rotulo];
  const colhe = p => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    colhe(p); arrasta(p, [0], 0.5, 0.2); colhe(p);
    roda(p, T_MIRA - 2); colhe(p);
    while (p.fase === 'jogando') { passo(p, DT); if (Math.round(p.t * 60) % 30 === 0) colhe(p); }
    colhe(p);
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('bocha-festa: nenhum modificador de andar nem carta de movimento serve (controle de toque), e o resto roda ate o fim sem NaN', () => {
  assert.deepEqual(permitidos().map(m => m.id), ['ouro']);
  for (const mod of permitidos()) for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o); p.mod = mod;
    let s = 7; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let q = 0; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      for (const o2 of p.dados.discos ?? []) assert.ok([o2.x, o2.z, o2.vx, o2.vz].every(Number.isFinite));
    }
    assert.notEqual(p.fase, 'jogando');
    assert.deepEqual(p.erros, []);
  }
});

test('bocha-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores em vs e 4 em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('bocha-festa: com dedos aleatorios o vencedor varia e ninguem e favorecido pelo lugar', () => {
  const v = new Set();
  for (let s = 1; s <= 30; s++) v.add(rodada(jogo, aleatorio, s, vs(4)).p.vencedor);
  assert.ok([...v].filter(k => k >= 0).length >= 3, 'vencedores: ' + [...v]);
});
