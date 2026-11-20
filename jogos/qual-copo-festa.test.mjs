import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { RODADAS, LIMITE, PRIMEIRO, DEPOIS, nCopos, durTroca } from './qual-copo-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const levanta = (p, i) => { const n = p.jogadores[i].n ?? 0; entrada(p, i, { n }); entrada(p, i, { n: n + 1 }); };
function ateFase(p, fase) { for (let k = 0; k < 3000 && p.fase === 'jogando' && p.dados.fase !== fase; k++) passo(p, DT); }
// Poe o jogador i colado na frente do copo dado, parado.
function poe(p, i, copo) { const c = p.dados.copos[copo], j = p.jogadores[i]; j.x = c.x; j.z = c.z + 2.3; j.vx = j.vz = 0; }
const errado = (p, k = 1) => (p.dados.estrela + k) % p.dados.copos.length;
function ateOFim(p) { for (let k = 0; k < 70 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }
// Joga uma rodada inteira: os jogadores da lista acham a estrela, nessa ordem (o primeiro leva mais).
function achaNaOrdem(p, ordem) {
  ateFase(p, 'escolhe');
  for (const i of ordem) { poe(p, i, p.dados.estrela); levanta(p, i); passo(p, DT); }
  ateFase(p, 'mostra');
}

test('qual-copo-festa: contrato da festa e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, LIMITE);
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
  assert.ok(PRIMEIRO > DEPOIS && DEPOIS > 0);
  assert.deepEqual(jogo.controle, { modo: 'padrao', a: 'Levanta', b: '' }, 'a acao principal no botao grande, sem segundo botao');
  assert.equal(jogo.semDash, true);
});

test('qual-copo-festa: comeca com 2, 3 e 4, placar zerado, copos na mesa e a estrela a mostra', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.placar, Array(n).fill(0));
    assert.equal(p.dados.copos.length, nCopos(0));
    assert.equal(p.dados.fase, 'mostra');
    assert.equal(new Set(p.jogadores.map(j => j.x + ',' + j.z)).size, n);
    for (let i = 0; i < n; i++) assert.match(p.celular[i].texto, /Pontos: 0/);
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [0, 0]);
});

test('qual-copo-festa: os copos embaralham e param cada um num lugar; a estrela segue no mesmo copo', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  const estrela = p.dados.estrela, antes = p.dados.copos.map(c => c.x);
  ateFase(p, 'escolhe');
  assert.equal(p.dados.estrela, estrela);
  assert.deepEqual(p.dados.copos.map(c => c.x).sort((a, b) => a - b), antes.slice().sort((a, b) => a - b));
  assert.equal(p.dados.nTrocas, 4, 'quatro trocas na primeira rodada');
  assert.equal(p.dados.copos[p.dados.estrela].x, antes[p.dados.ocupa.indexOf(p.dados.estrela)], 'o copo da estrela parou no lugar que a mesa diz');
});

test('qual-copo-festa: nenhum copo passa por dentro de outro, nem nas trocas duplas', () => {
  let duplas = 0;
  for (let s = 1; s <= 40; s++) {
    const p = partidaCom(jogo, sorteio(s), vs(2));
    for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) {
      passo(p, DT);
      const cs = p.dados.copos;
      if (p.dados.troca?.itens.length > 1) duplas++;
      for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++)
        assert.ok(Math.hypot(cs[a].x - cs[b].x, cs[a].z - cs[b].z) >= 2.7, `semente ${s}: copos ${a} e ${b} se atravessam`);
    }
  }
  assert.ok(duplas > 0, 'houve trocas duplas');
});

test('qual-copo-festa: no fim o celular fica em espera e dois que acham juntos saem no plural', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  ateFase(p, 'escolhe');
  poe(p, 1, p.dados.estrela); poe(p, 3, p.dados.estrela); levanta(p, 1); levanta(p, 3); passo(p, DT);
  assert.equal(p.dados.aviso, 'Jogador 2 e Jogador 4 acharam a estrela!');
  ateOFim(p);
  for (let i = 0; i < 4; i++) assert.equal(p.celular[i].modo, 'espera');
});

test('qual-copo-festa: o primeiro a levantar o copo certo leva mais; quem chega depois ainda pega menos, uma vez so', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ateFase(p, 'escolhe');
  poe(p, 2, p.dados.estrela); levanta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, PRIMEIRO]);
  assert.equal(p.dados.fase, 'revela');
  assert.match(p.dados.aviso, /Jogador 3 achou/);
  poe(p, 0, p.dados.estrela); levanta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [DEPOIS, 0, PRIMEIRO]);
  levanta(p, 0); levanta(p, 2); passo(p, DT);
  assert.deepEqual(p.dados.placar, [DEPOIS, 0, PRIMEIRO], 'cada um pontua uma vez por rodada');
  ateFase(p, 'mostra');
  assert.equal(p.dados.rodada, 1);
});

test('qual-copo-festa: dois no copo certo no mesmo quadro levam os dois o premio de primeiro', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  ateFase(p, 'escolhe');
  poe(p, 1, p.dados.estrela); poe(p, 3, p.dados.estrela); levanta(p, 1); levanta(p, 3); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, PRIMEIRO, 0, PRIMEIRO]);
});

test('qual-copo-festa: copo errado abre vazio, deixa atordoado e vibra; depois da para tentar de novo', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ateFase(p, 'escolhe');
  const e = errado(p), vibra = p.celular[0].vibra ?? 0;
  poe(p, 0, e); levanta(p, 0); passo(p, DT);
  assert.equal(p.dados.copos[e].aberto, true);
  assert.ok(p.dados.tonto[0] > 0);
  assert.equal(p.jogadores[0].turbo, 0, 'atordoado nao anda');
  assert.ok(p.celular[0].vibra > vibra);
  assert.deepEqual(p.dados.placar, [0, 0]);
  poe(p, 0, p.dados.estrela); levanta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0], 'atordoado nao levanta');
  roda(p, 1.6);
  poe(p, 0, p.dados.estrela); levanta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [PRIMEIRO, 0]);
});

test('qual-copo-festa: apertar antes de os copos pararem atordoa, e longe dos copos nada acontece', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ateFase(p, 'mistura');
  levanta(p, 1); passo(p, DT);
  assert.ok(p.dados.tonto[1] > 0);
  ateFase(p, 'escolhe');
  p.jogadores[0].x = 0; p.jogadores[0].z = 6.5; levanta(p, 0); passo(p, DT);
  assert.equal(p.dados.tonto[0], 0);
  assert.ok(p.dados.copos.every(c => !c.aberto));
});

test('qual-copo-festa: se ninguem acha, a estrela aparece, ninguem pontua e vem a rodada seguinte', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ateFase(p, 'escolhe'); ateFase(p, 'revela');
  assert.deepEqual(p.dados.placar, [0, 0, 0]);
  assert.equal(p.dados.copos[p.dados.estrela].aberto, true);
  poe(p, 0, p.dados.estrela); levanta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 0], 'depois do tempo ninguem pega');
  ateFase(p, 'mostra');
  assert.equal(p.dados.rodada, 1);
});

test('qual-copo-festa: as rodadas ficam mais rapidas e ganham um copo', () => {
  for (let r = 1; r < RODADAS; r++) assert.ok(durTroca(r) < durTroca(r - 1));
  assert.ok(nCopos(RODADAS - 1) > nCopos(0));
  const p = partidaCom(jogo, undefined, vs(2));
  for (let r = 0; r < RODADAS - 1; r++) achaNaOrdem(p, [0]);
  assert.equal(p.dados.copos.length, nCopos(RODADAS - 1));
});

test('qual-copo-festa: em vs, depois da ultima rodada vence quem somou mais', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  achaNaOrdem(p, [3, 1]); achaNaOrdem(p, [3]); achaNaOrdem(p, [0, 3]);
  assert.deepEqual(p.dados.placar, [PRIMEIRO, DEPOIS, 0, 2 * PRIMEIRO + DEPOIS]);
  ateOFim(p);
  assert.equal(p.vencedor, 3);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 1]);
  assert.match(p.celular[3].texto, /Você venceu/);
});

test('qual-copo-festa: em times os pontos da dupla somam e o time vence', () => {
  const p = partidaCom(jogo, undefined, times);
  achaNaOrdem(p, [1, 3, 0]);
  assert.deepEqual(p.dados.placar, [DEPOIS, PRIMEIRO + DEPOIS]);
  ateOFim(p);
  assert.equal(p.vencedor, 1, 'time B (J2 + J4)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('qual-copo-festa: somas iguais dao empate, e parados tambem', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  achaNaOrdem(p, [0]); achaNaOrdem(p, [2]);
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  for (const o of [vs(2), times]) { const q = partidaCom(jogo, undefined, o); ateOFim(q); assert.equal(q.vencedor, -1); }
});

test('qual-copo-festa: termina sozinho dentro do limite, com 2 a 4 e dedos aleatorios, sem NaN', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    assert.ok(rodada(jogo, () => {}, 1, o).segundos <= LIMITE + 0.1);
    const { p } = rodada(jogo, aleatorio, 5, o);
    assert.ok(p.dados.placar.every(Number.isFinite));
    assert.ok(p.dados.copos.every(c => Number.isFinite(c.x) && Number.isFinite(c.z)));
  }
});

test('qual-copo-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
