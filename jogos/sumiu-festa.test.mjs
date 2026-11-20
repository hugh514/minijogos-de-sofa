import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { RODADAS, LIMITE, FORMAS, CORES } from './sumiu-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
// Um toque na opcao "op" do celular do jogador i (vale no proximo passo).
function toca(p, i, op) { const j = p.jogadores[i], n = j.nop ?? 0; entrada(p, i, { op, nop: n }); entrada(p, i, { op, nop: n + 1 }); }
const acerta = (p, i) => toca(p, i, p.dados.perg.resp);
const erra = (p, i) => toca(p, i, (p.dados.perg.resp + 1) % 4);
function ateFase(p, fase) { for (let k = 0; k < 3000 && p.fase === 'jogando' && p.dados.fase !== fase; k++) passo(p, DT); }
function ateOFim(p) { for (let k = 0; k < 70 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }
// Joga uma rodada: os da lista acertam, nessa ordem (o primeiro leva o bonus); os outros nao respondem.
function acertamNaOrdem(p, ordem) {
  ateFase(p, 'pergunta');
  for (const i of ordem) { acerta(p, i); passo(p, DT); }
  ateFase(p, 'revela'); ateFase(p, 'mostra');
}

test('sumiu-festa: contrato da festa e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, LIMITE);
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
  assert.equal(CORES.length, 4, 'uma cor por botao do celular');
});

test('sumiu-festa: comeca com 2, 3 e 4, placar zerado, formas diferentes a mostra e o celular mandando olhar a TV', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.placar, Array(n).fill(0));
    assert.equal(p.dados.fase, 'mostra');
    assert.ok(p.dados.objs.length >= 3);
    assert.equal(new Set(p.dados.objs.map(o => o.forma)).size, p.dados.objs.length, 'cada forma aparece uma vez so');
    assert.equal(new Set(p.jogadores.map(j => j.x + ',' + j.z)).size, n);
    for (let i = 0; i < n; i++) { assert.equal(p.celular[i].modo, 'espera'); assert.match(p.celular[i].texto, /Pontos: 0/); }
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [0, 0]);
});

test('sumiu-festa: quando as formas somem, a mesma pergunta vai para a TV e para todos os celulares, com 4 opcoes', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ateFase(p, 'pergunta');
  assert.ok(p.t >= 2.5, 'houve tempo de decorar');
  assert.match(p.dados.aviso, /^Qual (cor|forma) era .+\?$/);
  for (let i = 0; i < 3; i++) {
    assert.equal(p.celular[i].modo, 'opcoes');
    assert.equal(p.celular[i].texto, p.dados.aviso);
    assert.equal(p.celular[i].opcoes.length, 4);
    assert.ok(p.celular[i].vibra > 0);
  }
});

test('sumiu-festa: a pergunta tem sempre uma resposta so, que confere com o que estava na tela', () => {
  const tipos = new Set();
  for (let s = 1; s <= 60; s++) {
    const p = partidaCom(jogo, sorteio(s), vs(2)), d = p.dados, q = d.perg, o = d.objs[q.alvo];
    tipos.add(q.tipo);
    for (const c of CORES.keys()) assert.ok(d.objs.filter(o => o.cor === c).length <= 2, 'no maximo duas formas da mesma cor');
    assert.equal(new Set(q.opcoes).size, 4);
    if (q.tipo === 'cor') {
      assert.equal(q.opcoes[q.resp], CORES[o.cor].nome);
      assert.match(q.texto, new RegExp(FORMAS[o.forma].nome));
    } else {
      assert.equal(q.opcoes[q.resp].toLowerCase(), FORMAS[o.forma].nome);
      assert.equal(d.objs.filter(x => x.cor === o.cor).length, 1, 'so uma forma tinha essa cor');
    }
  }
  assert.deepEqual([...tipos].sort(), ['cor', 'forma']);
});

test('sumiu-festa: acerto vale 1, o primeiro a acertar leva mais 1 de bonus, e cada um responde uma vez', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ateFase(p, 'pergunta');
  acerta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 2, 0]);
  assert.equal(p.celular[1].modo, 'espera');
  assert.match(p.celular[1].texto, /bônus/);
  acerta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 2, 0]);
  acerta(p, 0); acerta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 2, 0]);
  assert.equal(p.dados.fase, 'pergunta', 'falta o J3');
});

test('sumiu-festa: erro nao pontua, vibra e nao tira o bonus de quem acerta depois', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ateFase(p, 'pergunta');
  const vibra = p.celular[0].vibra;
  erra(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.ok(p.celular[0].vibra > vibra);
  assert.match(p.celular[0].texto, /Errou/);
  acerta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0], 'so vale a primeira resposta');
  acerta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 2]);
});

test('sumiu-festa: dois acertos no mesmo quadro levam os dois o bonus', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  ateFase(p, 'pergunta');
  acerta(p, 0); acerta(p, 3); passo(p, DT);
  assert.deepEqual(p.dados.placar, [2, 0, 0, 2]);
});

test('sumiu-festa: com todos respondidos a resposta aparece na hora; sem resposta, o prazo fecha sozinho', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ateFase(p, 'pergunta');
  const t0 = p.t;
  acerta(p, 0); erra(p, 1); passo(p, DT);
  assert.equal(p.dados.fase, 'revela');
  assert.match(p.dados.aviso, /^Era /);
  assert.match(p.celular[1].texto, /^Era /);
  ateFase(p, 'mostra');
  assert.equal(p.dados.rodada, 1);
  ateFase(p, 'pergunta'); const t1 = p.t; ateFase(p, 'revela');
  assert.ok(p.t - t1 > 3 && p.t - t1 < 7, 'prazo da pergunta');
  assert.ok(t0 > 0);
  assert.deepEqual(p.dados.placar, [2, 0]);
});

test('sumiu-festa: a ultima rodada vale em dobro e a TV avisa', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let r = 0; r < RODADAS - 1; r++) acertamNaOrdem(p, []);
  assert.equal(p.dados.rodada, RODADAS - 1);
  assert.match(p.dados.aviso, /dobro/);
  ateFase(p, 'pergunta');
  acerta(p, 2); passo(p, DT); acerta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [2, 0, 4]);
});

test('sumiu-festa: em vs, depois da ultima rodada vence quem somou mais', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  acertamNaOrdem(p, [0, 1]); acertamNaOrdem(p, [0, 1]); acertamNaOrdem(p, [0, 1]);       // J1 6, J2 3
  ateFase(p, 'pergunta'); acerta(p, 1); passo(p, DT);                                      // dobro: J2 +4 e vira
  assert.deepEqual(p.dados.placar, [6, 7, 0, 0]);
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 0]);
  assert.match(p.celular[1].texto, /Você venceu/);
});

test('sumiu-festa: em times os pontos da dupla somam e o time vence', () => {
  const p = partidaCom(jogo, undefined, times);
  acertamNaOrdem(p, [1, 2, 0]);
  assert.deepEqual(p.dados.placar, [2, 2]);
  acertamNaOrdem(p, [2]);
  assert.deepEqual(p.dados.placar, [4, 2]);
  ateOFim(p);
  assert.equal(p.vencedor, 0, 'time A (J1 + J3)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('sumiu-festa: somas iguais dao empate, e parados tambem', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  acertamNaOrdem(p, [0]); acertamNaOrdem(p, [2]);
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  for (const o of [vs(2), times]) { const q = partidaCom(jogo, undefined, o); ateOFim(q); assert.equal(q.vencedor, -1); }
});

test('sumiu-festa: termina sozinho dentro do limite, com 2 a 4 e dedos aleatorios, sem NaN', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    assert.ok(rodada(jogo, () => {}, 1, o).segundos <= LIMITE + 0.1);
    const { p } = rodada(jogo, aleatorio, 5, o);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});

test('sumiu-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
