import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, timeDe } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo from './rabo-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

function poeEm(p, i, caixa) { const j = p.jogadores[i]; j.x = caixa.x; j.z = caixa.z; j.vx = j.vz = 0; }
// Sem imunidade de largada e sem caixa solta, para o teste controlar tudo.
function limpa(opcoes) { const p = partidaCom(jogo, undefined, opcoes); p.dados.imune.fill(0); p.dados.prox = 999; return p; }
// O jogador i encosta na última caixa do jogador o e rouba (um quadro).
function rouba(p, i, o) { poeEm(p, i, p.dados.caudas[o].at(-1)); passo(p, DT); }
function deixaCom1(p, ...quais) { for (const o of quais) p.dados.caudas[o].length = 1; }

test('rabo-festa: contrato, tempo de 20 a 50 s e rotulo', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.rotulo, 'caixas');
  assert.equal(jogo.genero, 'empurra');
});

test('rabo-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel', () => {
  const todos = [jogo.nome, jogo.dica];
  for (const o of COMBOS) {
    const p = limpa(o);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    p.jogadores.forEach((_, i) => deixaCom1(p, i));
    roda(p, 0.2);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.equal(jogo.dica.split(/[.!?]\s/).length, 1, 'dica em uma frase');
});

test('rabo-festa: a arena e as posicoes escalam com n e cada um comeca com 3 caixas', () => {
  const raios = [2, 3, 4].map(n => partidaCom(jogo, undefined, vs(n)).arena.raio);
  assert.ok(raios[0] < raios[1] && raios[1] < raios[2], 'arena cresce: ' + raios);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.caudas.map(c => c.length), Array(o.n).fill(3));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    for (const cauda of d.caudas) for (const k of cauda) assert.ok(Math.hypot(k.x, k.z) < p.arena.raio, 'caixa dentro da arena');
    for (let i = 0; i < o.n; i++) for (let k = i + 1; k < o.n; k++)
      assert.ok(Math.hypot(p.jogadores[i].x - p.jogadores[k].x, p.jogadores[i].z - p.jogadores[k].z) > 4, 'largam separados');
  }
});

test('rabo-festa: na largada a cauda e imune por 1,5 s', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  rouba(p, 0, 1);
  assert.deepEqual(p.dados.placar, [3, 3]);
});

test('rabo-festa: encostar na ultima caixa do rival rouba e ela vai para o fim da propria cauda', () => {
  const p = limpa(vs(3)), d = p.dados, ultima = d.caudas[2].at(-1);
  rouba(p, 0, 2);
  assert.deepEqual(d.placar, [4, 3, 2]);
  assert.equal(d.caudas[0].at(-1), ultima);
  assert.equal(p.celular[2].vibra, 1);
});

test('rabo-festa: caixa que nao e a ultima nao rouba, e depois de um roubo ha 1 s de imunidade', () => {
  const p = limpa(vs(3)), d = p.dados;
  poeEm(p, 0, d.caudas[1][0]); passo(p, DT);
  assert.deepEqual(d.placar, [3, 3, 3]);
  rouba(p, 0, 1);
  for (let k = 0; k < 50; k++) rouba(p, 0, 1);
  assert.deepEqual(d.placar, [4, 2, 3], 'ainda imune');
  for (let k = 0; k < 15; k++) rouba(p, 0, 1);
  assert.deepEqual(d.placar, [5, 1, 3], 'passou 1 s, rouba de novo');
});

test('rabo-festa: em times o parceiro nao rouba do parceiro, mas rouba da dupla rival', () => {
  const p = limpa(times), d = p.dados;
  rouba(p, 0, 2);                                   // J1 e J3 sao a mesma dupla
  assert.deepEqual(d.placar, [6, 6]);
  assert.equal(d.caudas[2].length, 3);
  rouba(p, 0, 1);                                   // J2 e da outra
  assert.deepEqual(d.placar, [7, 5]);
});

test('rabo-festa: caixa solta aparece a cada 6 s, no maximo n + 1, e quem encosta leva', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  roda(p, 5.9); assert.equal(d.soltas.length, 0);
  roda(p, 0.2); assert.equal(d.soltas.length, 1);
  p.jogadores.forEach(j => { j.x = 0; j.z = 0; });  // ninguem no caminho de cima da caixa
  poeEm(p, 1, d.soltas[0]); passo(p, DT);
  assert.deepEqual(d.placar, [3, 4, 3]);
  assert.equal(d.soltas.length, 0);
  d.imune.fill(9);                                  // ninguem rouba ninguem enquanto o tempo corre
  for (let k = 0; k < 8; k++) { d.prox = 0; passo(p, DT); p.jogadores.forEach((j, i) => { j.x = 20 * (i + 1); j.z = 20; j.vx = j.vz = 0; }); }
  assert.ok(d.soltas.length <= 4);
});

test('rabo-festa: vs, cada jogador pode ser o ultimo de pe (n 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = limpa(vs(n)), outros = [...Array(n).keys()].filter(i => i !== w);
    deixaCom1(p, ...outros);
    for (const o of outros) {
      assert.equal(p.fase, 'jogando', `n ${n}: ainda ha rival de pe`);
      rouba(p, w, o);
      assert.equal(p.jogadores[o].vivo, false, 'sem caixas, sai');
    }
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('rabo-festa: com 3 ou mais, quem sai espera e a rodada segue ate sobrar um', () => {
  const p = limpa(vs(4)), d = p.dados;
  deixaCom1(p, 1);
  rouba(p, 0, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.equal(p.fase, 'jogando');
  assert.equal(d.caudas[1].length, 0);
  assert.match(p.celular[1].texto, /sem caixas/);
  assert.deepEqual(d.placar, [4, 0, 3, 3]);
});

test('rabo-festa: times devolve o time e so acaba quando os dois do outro time estao fora', () => {
  for (const [ganha, perde] of [[0, [1, 3]], [1, [0, 2]]]) {
    const p = limpa(times);
    deixaCom1(p, ...perde);
    rouba(p, ganha, perde[0]);
    assert.equal(p.fase, 'jogando', 'o parceiro ainda segura a dupla');
    rouba(p, ganha, perde[1]);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, ganha, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), ganha === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
    assert.equal(timeDe(p, ganha), ganha);
  }
});

test('rabo-festa: no tempo vence quem tem mais caixas em vs', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = limpa(vs(n));
    p.dados.caudas[w].push({ x: 0, z: 0 });
    roda(p, 34); assert.equal(p.fase, 'jogando', 'antes do tempo segue');
    roda(p, 1.2);
    assert.equal(p.vencedor, w, `n ${n}`);
  }
});

test('rabo-festa: no tempo, a dupla com mais caixas somadas vence', () => {
  for (const time of [0, 1]) {
    const p = limpa(times);
    p.dados.caudas[time].push({ x: 0, z: 0 });
    roda(p, 36);
    assert.equal(p.vencedor, time);
  }
});

test('rabo-festa: empate no tempo da -1 em vs (2, 3 e 4), em lideres empatados e em times', () => {
  for (const o of COMBOS) {
    const p = limpa(o);
    roda(p, 36);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
  }
  const p = limpa(vs(3));
  p.dados.caudas[0].push({ x: 0, z: 0 }); p.dados.caudas[2].push({ x: 0, z: 0 });
  roda(p, 36);
  assert.equal(p.vencedor, -1, 'dois lideres empatados e um atras');
});

test('rabo-festa: o resultado deixa aviso e celular finais prontos', () => {
  let p = limpa(vs(3));
  deixaCom1(p, 1, 2); rouba(p, 0, 1); rouba(p, 0, 2);
  assert.equal(p.vencedor, 0);
  assert.equal(p.dados.aviso, 'Jogador 1 venceu!');
  assert.equal(p.celular[0].texto, 'Você venceu!');
  assert.equal(p.celular[1].texto, 'Você perdeu. Boa tentativa!');
  p = limpa(times); p.dados.caudas[1].push({ x: 0, z: 0 }); roda(p, 36);
  assert.equal(p.dados.aviso, 'A dupla roxa venceu!');
  assert.equal(p.celular[2].texto, 'Você perdeu. Boa tentativa!');
  p = limpa(vs(2)); roda(p, 36);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[0].texto, 'Empate!');
});

test('rabo-festa: o celular repete as caixas e, em times, as da dupla', () => {
  const p = limpa(times);
  passo(p, DT);
  assert.equal(p.celular[0].texto, 'Suas caixas: 3. Dupla: 6. Roube a última de um rival!');
});

test('rabo-festa: as caixas seguem o boneco sem se afastar', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados, j = p.jogadores[0];
  for (let k = 0; k < 40; k++) { j.vx = 0; j.vz = 4; passo(p, DT); }
  const c = d.caudas[0];
  assert.ok(Math.hypot(c[0].x - j.x, c[0].z - j.z) < 1.6, 'primeira caixa colada no boneco');
  assert.ok(Math.hypot(c[2].x - c[1].x, c[2].z - c[1].z) < 1.6, 'ultima caixa colada na anterior');
});

test('rabo-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('rabo-festa: dedos aleatorios sempre terminam em ate 50 s, com 2, 3 e 4', () => {
  for (const o of COMBOS) for (const semente of [3, 4]) {
    const { segundos } = rodada(jogo, aleatorio, semente, o);
    assert.ok(segundos <= 50, `${JSON.stringify(o)} durou ${segundos}`);
  }
});
