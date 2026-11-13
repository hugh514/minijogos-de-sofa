import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { TIPOS, TEMPO, BARRA_INICIAL } from './pesca.mjs';

const tipo = id => TIPOS.findIndex(x => x.id === id);

function aperta(p, i, vezes = 1) {
  for (let k = 0; k < vezes; k++) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }
}

// Partida com os dois celulares ja "conectados" (contador de toques em 0) e sem mordida sozinha.
function partida() {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) { entrada(p, i, { x: 0, y: 0, n: 0 }); p.dados.pesc[i].t = 99; }
  return p;
}

const fisga = (p, i, id) => { p.dados.pesc[i] = { fase: 'luta', t: 0, tipo: tipo(id), barra: BARRA_INICIAL }; };

test('pesca: as chances somam 1 e os pesos sao 1, 2, 4 e 0', () => {
  assert.ok(Math.abs(TIPOS.reduce((s, x) => s + x.chance, 0) - 1) < 1e-9);
  assert.deepEqual(TIPOS.map(x => x.peso), [1, 2, 4, 0]);
});

test('pesca: a boia de cada um afunda em momento diferente', () => {
  const p = partidaCom(jogo);
  assert.notEqual(p.dados.pesc[0].t, p.dados.pesc[1].t);
});

test('pesca: a boia afunda, o celular vibra e apertar na janela fisga', () => {
  const p = partida();
  p.dados.pesc[0].t = 0.1;
  roda(p, 0.2);
  assert.equal(p.dados.pesc[0].fase, 'mordida');
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[1].vibra, undefined, 'so o celular de quem teve a mordida vibra');
  aperta(p, 0);
  assert.equal(p.dados.pesc[0].fase, 'luta');
  assert.ok(p.dados.pesc[0].tipo >= 0 && p.dados.pesc[0].tipo < TIPOS.length);
});

test('pesca: demorar mais de 0,6 s perde a mordida', () => {
  const p = partida();
  p.dados.pesc[0].t = 0.1;
  roda(p, 0.5);
  assert.equal(p.dados.pesc[0].fase, 'mordida');
  roda(p, 0.4);
  assert.equal(p.dados.pesc[0].fase, 'espera');
});

test('pesca: apertar antes da hora espanta os peixes por 2 s', () => {
  const p = partida();
  aperta(p, 0);
  assert.equal(p.dados.pesc[0].fase, 'susto');
  assert.ok(p.jogadores[0].vy > 0, 'o boneco leva um susto');
  aperta(p, 0, 5);
  roda(p, 1.5);
  assert.equal(p.dados.pesc[0].fase, 'susto', 'apertar de novo nao encurta o susto');
  roda(p, 0.6);
  assert.equal(p.dados.pesc[0].fase, 'espera');
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('pesca: martelar o botao puxa o peixe e soma o peso', () => {
  for (const [id, peso] of [['pequeno', 1], ['medio', 2], ['grande', 4]]) {
    const p = partida();
    fisga(p, 1, id);
    aperta(p, 1, 30);
    assert.deepEqual(p.dados.placar, [0, peso], id);
    assert.deepEqual(p.dados.pegos[1], [tipo(id)]);
    assert.equal(p.dados.pesc[1].fase, 'espera');
  }
});

test('pesca: peixe maior exige mais toques', () => {
  const toques = id => {
    const p = partida();
    fisga(p, 0, id);
    let n = 0;
    while (p.dados.pesc[0].fase === 'luta' && n < 100) { aperta(p, 0); n++; }
    return n;
  };
  const [a, b, c] = ['pequeno', 'medio', 'grande'].map(toques);
  assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
});

test('pesca: sem apertar, o peixe puxa de volta e escapa', () => {
  const p = partida();
  fisga(p, 0, 'grande');
  roda(p, 2);
  assert.equal(p.dados.pesc[0].fase, 'espera');
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('pesca: a bota velha vale zero e aparece o aviso', () => {
  const p = partida();
  fisga(p, 0, 'bota');
  aperta(p, 0, 10);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.aviso, 'BOTA VELHA!');
  assert.deepEqual(p.dados.pegos[0], [tipo('bota')]);
  roda(p, 2);
  assert.equal(p.dados.aviso, '', 'o aviso some');
});

test('pesca: aos 35 s vence o maior peso', () => {
  const p = partida();
  fisga(p, 1, 'medio');
  aperta(p, 1, 30);
  roda(p, TEMPO - 1);
  assert.equal(p.fase, 'jogando');
  roda(p, 1.2);
  assert.equal(p.vencedor, 1);
});

test('pesca: pesos iguais (ninguem aperta) da empate', () => {
  const p = partidaCom(jogo);
  roda(p, TEMPO + 0.5);
  assert.equal(p.vencedor, -1);
});

test('pesca: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
