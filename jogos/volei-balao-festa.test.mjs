import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS, T_SEGUNDO, R_ARENA, R_BALAO, setorDe, centro } from './volei-balao-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
const aperta = (p, i, x = 0, y = 0) => { const j = p.jogadores[i], n = (j.n ?? 0) + 1; entrada(p, i, { x, y, d: false, n: n - 1 }); entrada(p, i, { x, y, d: true, n }); };
// Deixa o balao b quase no chao do setor k, na beirada (longe dos bonecos), sem dar o passo.
function prepara(p, k, b = 0) {
  const c = centro(p, k);
  Object.assign(p.dados.baloes[b], { x: c.x * 7.6, z: c.z * 7.6, y: R_BALAO + 0.005, vx: 0, vz: 0, vy: -1, pausa: 0, espera: 0 });
}
const cai = (p, k, b = 0) => { prepara(p, k, b); passo(p, DT); };
// Balao b parado no ar em (x, z), na altura y, caindo.
const solta = (p, x, z, y, b = 0) => Object.assign(p.dados.baloes[b], { x, z, y, vx: 0, vz: 0, vy: -1, pausa: 0, espera: 0, toque: p.jogadores.map(() => 0), quer: [] });
// Passa o tempo sem nenhum balao cair (ficam esperando no alto).
function semCair(p, s) {
  for (let k = 0; k < s * 60 && p.fase === 'jogando'; k++) { for (const b of p.dados.baloes) { b.espera = 1; b.pausa = 0; b.y = 6; } passo(p, DT); }
}
const permitidos = () => MODIFICADORES.filter(m => (!m.pulo || !jogo.semPulo) && !jogo.semMod?.includes(m.id));

test('volei-balao-festa: contrato da festa, tempo de 20 a 50 s, genero, botao e dica em uma frase', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(VIDAS, 3);
  assert.equal(jogo.genero, 'reflexo');
  assert.equal(jogo.rotulo, 'vidas');
  assert.deepEqual(jogo.controle, { modo: 'padrao', a: 'Bate', b: '' });
  assert.ok(jogo.semDash && jogo.semPulo && !jogo.semMovimento);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('volei-balao-festa: comeca com 2, 3 e 4 (e em times), 3 vidas por setor, cada um dentro do proprio setor e um balao no alto', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, donos = o.modo === 'times' ? 2 : o.n;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.vidas, Array(donos).fill(VIDAS));
    assert.deepEqual(d.placar, d.vidas);
    assert.equal(d.baloes.length, 1);
    assert.ok(d.baloes[0].y > 5, 'o balao comeca no alto');
    p.jogadores.forEach((j, i) => {
      assert.equal(setorDe(p, j.x, j.z), o.modo === 'times' ? i % 2 : i, `J${i + 1} no proprio setor`);
      assert.ok(Math.hypot(j.x, j.z) < R_ARENA - 1);
      assert.match(p.celular[i].texto, /^Vidas( do time)?: 3\./);
    });
  }
});

test('volei-balao-festa: a quadra tem um setor por jogador (quadrantes com 4, tercos com 3) e meia quadra por time', () => {
  const q = partidaCom(jogo, undefined, vs(4));
  assert.deepEqual([[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([x, z]) => setorDe(q, x, z)), [0, 1, 2, 3]);
  const d = partidaCom(jogo, undefined, vs(2));
  assert.deepEqual([[-3, -5], [-3, 5], [3, -5], [3, 5]].map(([x, z]) => setorDe(d, x, z)), [0, 0, 1, 1]);
  const t = partidaCom(jogo, undefined, times);
  assert.deepEqual([[-3, -5], [-3, 5], [3, -5], [3, 5]].map(([x, z]) => setorDe(t, x, z)), [0, 0, 1, 1], 'time A na esquerda');
  const tr = partidaCom(jogo, undefined, vs(3));
  assert.deepEqual([[0, -5], [4, 3], [-4, 3]].map(([x, z]) => setorDe(tr, x, z)), [0, 1, 2]);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), donos = o.modo === 'times' ? 2 : o.n, conta = Array(donos).fill(0);
    for (let a = 0; a < 360; a++) conta[setorDe(p, Math.cos(a * Math.PI / 180 + 0.01) * 5, Math.sin(a * Math.PI / 180 + 0.01) * 5)]++;
    for (const v of conta) assert.equal(v, 360 / donos, 'setores do mesmo tamanho');
  }
});

test('volei-balao-festa: ninguem sai do proprio setor, por mais que empurre o joystick', () => {
  for (const o of COMBOS) for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
    const p = partidaCom(jogo, undefined, o);
    p.jogadores.forEach((_, i) => entrada(p, i, { x, y, d: false, n: 0 }));
    for (let k = 0; k < 150; k++) {
      for (const b of p.dados.baloes) b.espera = 1;
      passo(p, DT);
      p.jogadores.forEach((j, i) => assert.equal(setorDe(p, j.x, j.z), o.modo === 'times' ? i % 2 : i, `J${i + 1} saiu do setor`));
    }
  }
});

test('volei-balao-festa: o balao cai devagar e, ao tocar o chao de um setor, o dono perde uma vida', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  p.jogadores.forEach((j, i) => { const c = centro(p, i); poe(p, i, c.x * 8, c.z * 8); });
  Object.assign(d.baloes[0], { x: 0, z: -2, vx: 0, vz: 0 });       // no setor do J1 (o de cima)
  let quadros = 0;
  while (d.vidas[0] === VIDAS && quadros < 600) { p.jogadores.forEach((j, i) => { const c = centro(p, i); poe(p, i, c.x * 8, c.z * 8); }); passo(p, DT); quadros++; }
  assert.ok(quadros > 90, 'leva mais de 1,5 s para cair: ' + quadros);
  assert.deepEqual(d.vidas, [2, 3, 3]);
  assert.deepEqual(d.placar, [2, 3, 3]);
  assert.equal(d.aviso, 'Jogador 1 perdeu uma vida!');
  assert.match(p.celular[0].texto, /^Vidas: 2\./);
  assert.ok(p.celular[0].vibra > 0);
  roda(p, 1.2);
  assert.ok(d.baloes[0].y > 5, 'o balao volta para o alto');
});

test('volei-balao-festa: Bate rebate o balao para cima, na direcao do joystick, ou para o meio da quadra sem joystick', () => {
  const p = partidaCom(jogo, undefined, vs(2)), b = p.dados.baloes[0];
  poe(p, 0, -5, 0); solta(p, -5, 1, 2.5);
  aperta(p, 0, 0, -1); passo(p, DT);
  assert.ok(b.vy > 3, 'sobe');
  assert.ok(b.vz < -4 && Math.abs(b.vx) < 1e-6, 'joystick para cima: vai para o fundo');
  const q = partidaCom(jogo, undefined, vs(2)), c = q.dados.baloes[0];
  poe(q, 0, -5, 0); solta(q, -5, 1, 2.5);
  aperta(q, 0); passo(q, DT);
  assert.ok(c.vy > 3 && c.vx > 4, 'sem joystick: atravessa para o lado do rival');
  const y0 = c.y;
  roda(q, 0.3);
  assert.ok(c.y > y0 && c.x > -4.5);
});

test('volei-balao-festa: Bate longe do balao, ou com ele muito alto, nao acerta', () => {
  const p = partidaCom(jogo, undefined, vs(2)), b = p.dados.baloes[0];
  poe(p, 0, -5, 0); solta(p, -5, 4, 2.5);
  aperta(p, 0); passo(p, DT);
  assert.ok(b.vy < 0);
  const q = partidaCom(jogo, undefined, vs(2)), c = q.dados.baloes[0];
  poe(q, 0, -5, 0); solta(q, -5, 0.5, 6);
  aperta(q, 0); passo(q, DT);
  assert.ok(c.vy < 0, 'alto demais para alcancar');
});

test('volei-balao-festa: encostar no balao baixo da um toquinho para cima, sem apertar nada', () => {
  const p = partidaCom(jogo, undefined, vs(2)), b = p.dados.baloes[0];
  poe(p, 1, 5, 0); solta(p, 5.6, 0, 2.3);
  passo(p, DT);
  assert.ok(b.vy > 2, 'sobe');
  assert.ok(b.vx > 0.5, 'para longe de quem encostou');
  const forte = partidaCom(jogo, undefined, vs(2)), c = forte.dados.baloes[0];
  poe(forte, 1, 5, 0); solta(forte, 5.6, 0, 2.3); aperta(forte, 1, 1, 0); passo(forte, DT);
  assert.ok(c.vy > b.vy && Math.hypot(c.vx, c.vz) > Math.hypot(b.vx, b.vz) * 2, 'Bate manda mais alto e bem mais longe que o toque');
});

test('volei-balao-festa: dois batendo no mesmo balao no mesmo quadro, vale quem esta mais perto, e na mesma distancia ninguem e favorecido pelo lugar', () => {
  for (const [x0, x1, vence] of [[-1, 1.6, 0], [-1.6, 1, 1]]) {
    const p = partidaCom(jogo, undefined, vs(2)), b = p.dados.baloes[0];
    poe(p, 0, x0, 0); poe(p, 1, x1, 0); solta(p, 0, 0, 3);
    aperta(p, 0, 1, 0); aperta(p, 1, -1, 0); passo(p, DT);
    assert.equal(Math.sign(b.vx), vence ? -1 : 1, 'rebateu o J' + (vence + 1));
  }
  const lados = new Set();
  for (let s = 1; s <= 30; s++) {
    const p = partidaCom(jogo, sorteio(s), vs(2)), b = p.dados.baloes[0];
    poe(p, 0, -1, 0); poe(p, 1, 1, 0); solta(p, 0, 0, 3);
    aperta(p, 0, 1, 0); aperta(p, 1, -1, 0); passo(p, DT);
    lados.add(Math.sign(b.vx));
  }
  assert.deepEqual([...lados].sort(), [-1, 1]);
});

test('volei-balao-festa: De ponta-cabeca inverte a mira junto com o andar', () => {
  const p = partidaCom(jogo, undefined, vs(2)), b = p.dados.baloes[0];
  p.mod = MODIFICADORES.find(m => m.id === 'espelho');
  poe(p, 0, -5, 0); solta(p, -5, 1, 2.5);
  aperta(p, 0, 1, 0); passo(p, DT);
  assert.ok(b.vx < -4);
});

test('volei-balao-festa: sem vidas o jogador sai, e o setor dele vira trampolim: o balao quica e ninguem perde vida', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  cai(p, 1); cai(p, 1);
  assert.ok(p.jogadores[1].vivo);
  cai(p, 1);
  assert.deepEqual(d.vidas, [3, 0, 3]);
  assert.ok(!p.jogadores[1].vivo, 'saiu');
  assert.equal(p.celular[1].texto, 'Você ficou sem vidas');
  assert.equal(p.fase, 'jogando');
  cai(p, 1);
  assert.deepEqual(d.vidas, [3, 0, 3]);
  assert.ok(d.baloes[0].vy > 3, 'quicou');
});

test('volei-balao-festa: vs devolve o indice do ultimo com vida (cada jogador, com 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < n; i++) {
    const p = partidaCom(jogo, undefined, vs(n));
    for (let k = 0; k < n; k++) if (k !== i) for (let v = 0; v < VIDAS; v++) { assert.equal(p.fase, 'jogando'); cai(p, k); }
    assert.equal(p.fase, 'resultado', `n ${n}, jogador ${i}`);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
    assert.equal(p.jogadores.filter(j => j.pontos).length, 1, 'so o vencedor pontua');
    assert.equal(p.dados.aviso, `Jogador ${i + 1} venceu!`);
    assert.equal(p.celular[i].texto, 'Você venceu!');
    assert.equal(p.celular[(i + 1) % n].texto, `Jogador ${i + 1} venceu`);
  }
});

test('volei-balao-festa: no fim do tempo vence quem tem mais vidas, e vidas iguais na frente dao empate', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  cai(p, 0); cai(p, 1); cai(p, 1); cai(p, 3);
  semCair(p, TEMPO + 1);
  assert.equal(p.vencedor, 2);
  const e = partidaCom(jogo, undefined, vs(3));
  cai(e, 2);
  semCair(e, TEMPO + 1);
  assert.equal(e.vencedor, -1, 'dois com 3 vidas');
  assert.equal(e.dados.aviso, 'Empate!');
  assert.equal(e.celular[2].texto, 'Empate!');
  const z = partidaCom(jogo, undefined, vs(2));
  semCair(z, TEMPO + 1);
  assert.equal(z.vencedor, -1);
});

test('volei-balao-festa: times dividem as vidas e a meia quadra, devolvem o time (0 ou 1) e os dois do time pontuam', () => {
  const a = partidaCom(jogo, undefined, times);        // time A: J1 e J3, na esquerda
  cai(a, 1);
  assert.deepEqual(a.dados.vidas, [3, 2]);
  assert.equal(a.dados.aviso, 'Time roxo perdeu uma vida!');
  assert.match(a.celular[3].texto, /^Vidas do time: 2\./);
  assert.ok(a.celular[1].vibra > 0 && a.celular[3].vibra > 0);
  cai(a, 1); cai(a, 1);
  assert.equal(a.vencedor, 0);
  assert.deepEqual(a.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.equal(a.dados.aviso, 'Time laranja venceu!');
  assert.equal(a.celular[2].texto, 'Você venceu!');
  assert.equal(a.celular[1].texto, 'O outro time venceu');
  const b = partidaCom(jogo, undefined, times);
  cai(b, 0);
  semCair(b, TEMPO + 1);
  assert.equal(b.vencedor, 1, 'no tempo, o time com mais vidas');
  assert.deepEqual(b.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  const e = partidaCom(jogo, undefined, times);
  cai(e, 0); cai(e, 1);
  semCair(e, TEMPO + 1);
  assert.equal(e.vencedor, -1);
});

test('volei-balao-festa: o segundo balao chega mais tarde, e dois baloes tirando a ultima vida dos dois no mesmo quadro dao empate', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  semCair(p, T_SEGUNDO - 1);
  assert.equal(p.dados.baloes.length, 1);
  semCair(p, 1.2);
  assert.equal(p.dados.baloes.length, 2);
  cai(p, 0); cai(p, 0); cai(p, 1); cai(p, 1);
  assert.deepEqual(p.dados.vidas, [1, 1]);
  prepara(p, 0, 0); prepara(p, 1, 1); passo(p, DT);
  assert.deepEqual(p.dados.vidas, [0, 0]);
  assert.equal(p.vencedor, -1);
});

test('volei-balao-festa: parados, a rodada termina sozinha dentro do tempo', () => {
  for (const o of COMBOS) {
    const { segundos, p } = rodada(jogo, () => {}, 5, o);
    assert.ok(segundos <= TEMPO + 0.1 && segundos >= 5, 'durou ' + segundos);
    assert.ok(p.dados.vidas.every(v => Number.isInteger(v) && v >= 0 && v <= VIDAS));
  }
});

test('volei-balao-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel', () => {
  const todos = [jogo.nome, jogo.dica, jogo.rotulo, jogo.controle.a];
  const colhe = p => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    colhe(p); roda(p, 1); colhe(p); cai(p, 0); colhe(p); cai(p, 1); cai(p, 1); colhe(p); semCair(p, T_SEGUNDO); colhe(p); cai(p, 1); colhe(p);
    semCair(p, TEMPO); colhe(p);
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('volei-balao-festa: com cada modificador permitido (ouro, gelo, foguete, espelho) e com Turbo roda ate o fim sem NaN e sem sair do setor', () => {
  assert.deepEqual(permitidos().map(m => m.id), ['ouro', 'gelo', 'foguete', 'espelho'], 'lua nao sai: nao ha pulo');
  for (const mod of permitidos()) for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o); p.mod = mod;
    p.jogadores[0].carta = 'turbo';
    let s = 5; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let q = 0; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      for (const j of p.jogadores) assert.ok([j.x, j.y, j.z, j.vx, j.vz].every(Number.isFinite));
      for (const b of p.dados.baloes) { assert.ok([b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)); assert.ok(Math.hypot(b.x, b.z) <= R_ARENA + 1e-6 && b.y <= 8); }
      p.jogadores.forEach((j, i) => { if (j.vivo && p.fase === 'jogando') assert.equal(setorDe(p, j.x, j.z), o.modo === 'times' ? i % 2 : i); });
    }
    assert.notEqual(p.fase, 'jogando');
    assert.deepEqual(p.erros, []);
  }
});

test('volei-balao-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores em vs e 4 em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('volei-balao-festa: com dedos aleatorios termina no tempo e o vencedor varia', () => {
  const v = new Set();
  for (let s = 1; s <= 24; s++) { const r = rodada(jogo, aleatorio, s, vs(4)); v.add(r.p.vencedor); assert.ok(r.segundos <= TEMPO + 0.1); }
  assert.ok([...v].filter(k => k >= 0).length >= 3, 'vencedores: ' + [...v]);
});
