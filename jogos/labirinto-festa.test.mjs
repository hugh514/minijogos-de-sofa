import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { COLS, LINS, VIDAS, LIMITE, T_BOMBA, celula, centro } from './labirinto-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const textos = p => [p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? '')];
const bomba = (p, i) => { const j = p.jogadores[i], n = (j.n ?? 0) + 1; entrada(p, i, { x: 0, y: 0, d: false, n: n - 1 }); entrada(p, i, { x: 0, y: 0, d: true, n }); };
const poe = (p, i, ci, ck) => { const [x, z] = centro(ci, ck); Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); };
const fogoEm = (p, ci, ck) => p.dados.fogo.push({ i: ci, k: ck, t: 0.3 });
// Queima o jogador i onde ele esta (um quadro).
const queima = (p, i) => { const c = celula(p.jogadores[i].x, p.jogadores[i].z); p.dados.protecao[i] = 0; fogoEm(p, c.i, c.k); passo(p, DT); };
const semCaixas = p => { for (const col of p.dados.grade) for (let k = 0; k < LINS; k++) if (col[k] === 2) col[k] = 0; };
const ateFim = p => { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); };

test('labirinto-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.equal(jogo.id, 'labirinto-festa');
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, LIMITE);
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(VIDAS, 2);
  assert.equal(jogo.controle.b, '', 'so o botao da bomba');
});

test('labirinto-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    todos.push(...textos(p), ...p.dados.inventario.flat());
    queima(p, 0); todos.push(...textos(p));
    roda(p, 2); todos.push(...textos(p));
    queima(p, 0); todos.push(...textos(p));
    ateFim(p); todos.push(...textos(p), ...p.dados.inventario.flat());
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('labirinto-festa: com 2, 3 e 4 cada um larga num canto diferente, com 2 vidas e o canto livre', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(2));
    assert.deepEqual(d.placar, o.modo === 'times' ? [4, 4] : Array(o.n).fill(2));
    assert.equal(d.grade.length, COLS); assert.equal(d.grade[0].length, LINS);
    const cantos = new Set();
    p.jogadores.forEach((j, i) => {
      const c = celula(j.x, j.z);
      assert.ok([0, COLS - 1].includes(c.i) && [0, LINS - 1].includes(c.k), `J${i + 1} num canto`);
      cantos.add(c.i + ',' + c.k);
      assert.equal(d.grade[c.i][c.k], 0);
      assert.equal(d.grade[c.i === 0 ? 1 : c.i - 1][c.k], 0, 'da para sair do canto');
      assert.equal(d.grade[c.i][c.k === 0 ? 1 : c.k - 1], 0);
    });
    assert.equal(cantos.size, o.n, 'um em cada canto');
    assert.ok(d.grade.flat().filter(x => x === 2).length > 20, 'tem caixas para quebrar');
    assert.equal(d.grade[1][1], 1, 'pilares fixos');
  }
  const p = partidaCom(jogo, undefined, times);
  assert.ok(p.jogadores[0].x < 0 && p.jogadores[2].x < 0 && p.jogadores[1].x > 0 && p.jogadores[3].x > 0, 'em times cada dupla de um lado');
  const q = partidaCom(jogo, undefined, vs(2));
  assert.ok(q.jogadores[0].x * q.jogadores[1].x < 0 && q.jogadores[0].z * q.jogadores[1].z < 0, 'com 2, cantos opostos');
});

test('labirinto-festa: A solta a bomba, ela explode em cruz, quebra caixa e para no pilar', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  semCaixas(p);
  d.grade[2][0] = 2; d.grade[3][0] = 2;
  bomba(p, 0); passo(p, DT);
  assert.equal(d.bombas.length, 1);
  assert.deepEqual([d.bombas[0].i, d.bombas[0].k, d.bombas[0].dono], [0, 0, 0]);
  bomba(p, 0); passo(p, DT);
  assert.equal(d.bombas.length, 1, 'uma bomba por casa');
  poe(p, 0, 4, 4);                                   // sai de perto
  roda(p, T_BOMBA - 0.2); assert.equal(d.fogo.length, 0, 'ainda nao explodiu');
  roda(p, 0.3);
  const fogo = d.fogo.map(f => f.i + ',' + f.k);
  for (const c of ['0,0', '1,0', '2,0', '0,1', '0,2']) assert.ok(fogo.includes(c), 'fogo em ' + c);
  assert.ok(!fogo.includes('3,0'), 'a caixa segura o fogo');
  assert.equal(d.grade[2][0], 0, 'caixa quebrou'); assert.equal(d.grade[3][0], 2);
  assert.equal(d.bombas.length, 0);
  roda(p, 1); assert.equal(d.fogo.length, 0, 'o fogo apaga');
  assert.deepEqual(d.vidas, [2, 2]);
});

test('labirinto-festa: quem e pego perde uma vida, vibra, volta ao seu canto protegido; sem vidas, sai', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  const canto = celula(p.jogadores[1].x, p.jogadores[1].z);
  semCaixas(p); poe(p, 1, 4, 4);
  queima(p, 1);
  assert.deepEqual(d.vidas, [2, 1, 2]);
  assert.deepEqual(d.placar, [2, 1, 2]);
  assert.equal(p.jogadores[1].vivo, false);
  assert.equal(p.celular[1].vibra, 1);
  assert.match(p.celular[1].texto, /Volta/);
  bomba(p, 1); passo(p, DT);
  assert.equal(d.bombas.length, 0, 'fora da arena nao solta bomba');
  roda(p, 1.6);
  assert.equal(p.jogadores[1].vivo, true, 'voltou');
  assert.deepEqual(celula(p.jogadores[1].x, p.jogadores[1].z), canto, 'no proprio canto');
  assert.ok(d.protecao[1] > 0);
  fogoEm(p, canto.i, canto.k); passo(p, DT);
  assert.equal(d.vidas[1], 1, 'protegido ao voltar');
  assert.equal(p.celular[1].texto, 'Vidas: 1');
  queima(p, 1);
  assert.equal(d.vidas[1], 0);
  roda(p, 3);
  assert.equal(p.jogadores[1].vivo, false, 'sem vidas nao volta');
  assert.match(p.celular[1].texto, /Sem vidas/);
  assert.equal(p.fase, 'jogando', 'ainda ha dois na arena');
});

test('labirinto-festa: itens deixam mais forte e aparecem no inventario', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  const c = celula(p.jogadores[0].x, p.jogadores[0].z);
  d.itens.push({ i: c.i, k: c.k, tipo: 'fogo', t: 0 }, { i: c.i, k: c.k, tipo: 'bomba', t: 0 }, { i: c.i, k: c.k, tipo: 'patins', t: 0 }, { i: c.i, k: c.k, tipo: 'passa', t: 0 });
  const turbo = p.jogadores[0].turbo;
  passo(p, DT);
  assert.equal(d.itens.length, 0);
  assert.deepEqual(d.poder[0], { bombas: 3, fogo: 3, patins: 1, passa: true });
  assert.deepEqual(d.poder[1], { bombas: 2, fogo: 2, patins: 0, passa: false });
  assert.ok(p.jogadores[0].turbo > turbo);
  assert.deepEqual(d.inventario[0], ['Vidas 2', 'Bombas 3', 'Fogo 3', 'Patins 1', 'Atravessa']);
  assert.deepEqual(d.inventario[1], ['Vidas 2', 'Bombas 2', 'Fogo 2']);
  assert.ok(p.celular[0].vibra >= 1, 'vibra ao pegar');
});

test('labirinto-festa: em vs vence o ultimo com vida', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n)), d = p.dados;
    for (let i = 0; i < n; i++) if (i !== w) d.vidas[i] = 1;
    for (let i = 0; i < n; i++) if (i !== w) { assert.equal(p.fase, 'jogando'); queima(p, i); }
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.match(p.dados.aviso, /venceu/);
  }
});

test('labirinto-festa: em times a dupla so perde quando os dois ficam sem vidas, e os dois pontuam', () => {
  const p = partidaCom(jogo, undefined, times), d = p.dados;
  d.vidas = [1, 1, 1, 1];
  queima(p, 1); assert.equal(p.fase, 'jogando', 'J4 ainda segura a dupla B');
  assert.deepEqual(d.placar, [2, 1]);
  queima(p, 0); assert.equal(p.fase, 'jogando');
  queima(p, 3);
  assert.equal(p.vencedor, 0, 'o time, nunca o indice');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  const q = partidaCom(jogo, undefined, times);
  q.dados.vidas = [1, 2, 1, 2];
  queima(q, 0); queima(q, 2);
  assert.equal(q.vencedor, 1);
});

test('labirinto-festa: no fim do tempo vence quem (ou a dupla que) tem mais vidas', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  queima(p, 0); queima(p, 1); queima(p, 3);
  roda(p, LIMITE - 1); assert.equal(p.fase, 'jogando');
  roda(p, 1.2);
  assert.equal(p.vencedor, 2);
  const q = partidaCom(jogo, undefined, times);
  queima(q, 1);
  ateFim(q);
  assert.equal(q.vencedor, 0);
});

test('labirinto-festa: empate da -1 (tempo com vidas iguais, e os ultimos pegos na mesma explosao)', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    ateFim(p);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.match(p.dados.aviso, /Empate/);
  }
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  d.vidas = [1, 1]; semCaixas(p);
  poe(p, 0, 4, 4); poe(p, 1, 6, 4);
  d.protecao.fill(0); fogoEm(p, 4, 4); fogoEm(p, 6, 4); passo(p, DT);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, -1);
});

test('labirinto-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times, sem NaN', () => {
  for (const o of COMBOS) {
    const vencedores = fumaca(jogo, o);
    assert.equal(vencedores.length, 15);
  }
});

test('labirinto-festa: dedos aleatorios terminam no tempo, com placar finito', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, aleatorio, 5, o);
    assert.ok(segundos <= LIMITE + 0.1, 'durou ' + segundos);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});
