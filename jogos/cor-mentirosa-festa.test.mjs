import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { META, LIMITE } from './cor-mentirosa-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
// Um toque na opcao "op" do celular do jogador i (vale no proximo passo).
function toca(p, i, op) { const j = p.jogadores[i], n = j.nop ?? 0; entrada(p, i, { op, nop: n }); entrada(p, i, { op, nop: n + 1 }); }
// Avanca ate haver um desafio valendo e devolve a resposta certa.
function desafio(p) {
  for (let k = 0; k < 600 && p.dados.pausa > 0; k++) passo(p, DT);
  const d = p.dados;
  assert.ok(!(d.pausa > 0), 'ha um desafio valendo');
  return d.modoTinta ? d.tinta : d.palavra;
}
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }

test('cor-mentirosa-festa: contrato da festa e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, LIMITE);
});

test('cor-mentirosa-festa: comeca com 2, 3 e 4, placar zerado e 4 cores no celular de todos', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.deepEqual(p.dados.placar, Array(n).fill(0));
    for (let i = 0; i < n; i++) { assert.equal(p.celular[i].modo, 'opcoes'); assert.equal(p.celular[i].opcoes.length, 4); }
    assert.equal(new Set(p.jogadores.map(j => j.x + ',' + j.z)).size, n, 'cada um no seu lugar');
  }
  assert.deepEqual(partidaCom(jogo, undefined, times).dados.placar, [0, 0]);
});

test('cor-mentirosa-festa: a palavra e a tinta sao sempre diferentes e o comando alterna', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  let antes;
  for (let k = 0; k < 5; k++) {
    desafio(p);
    assert.notEqual(p.dados.palavra, p.dados.tinta);
    if (antes !== undefined) assert.notEqual(p.dados.modoTinta, antes);
    antes = p.dados.modoTinta;
    roda(p, 6.2);       // ninguem responde: o prazo vence e vem outro
  }
});

test('cor-mentirosa-festa: quem acerta primeiro leva o ponto e o desafio fecha para os outros', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  const certa = desafio(p);
  toca(p, 2, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 1]);
  toca(p, 0, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 1], 'chegou depois: nao pontua');
});

test('cor-mentirosa-festa: dois acertos no mesmo quadro pontuam os dois', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  const certa = desafio(p);
  toca(p, 1, certa); toca(p, 3, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1, 0, 1]);
});

test('cor-mentirosa-festa: erro tira 1 ponto (nunca abaixo de zero), congela e vibra', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  let certa = desafio(p);
  toca(p, 0, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [1, 0, 0]);
  certa = desafio(p);
  const vibraAntes = p.celular[0].vibra ?? 0;
  toca(p, 0, (certa + 1) % 4); toca(p, 1, (certa + 1) % 4); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 0]);
  assert.ok(p.dados.gelo[0] > 0 && p.dados.gelo[1] > 0);
  assert.equal(p.celular[0].modo, 'espera');
  assert.ok(p.celular[0].vibra > vibraAntes);
  toca(p, 0, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 0], 'congelado nao responde');
  toca(p, 2, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0, 1], 'o desafio segue para quem nao errou');
});

test('cor-mentirosa-festa: em vs quem chega a meta vence na hora', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  const certa = desafio(p);
  p.dados.placar = [1, 2, META - 1, 0];
  toca(p, 2, certa); passo(p, DT);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 1, 0]);
});

test('cor-mentirosa-festa: em times os pontos somam por time e o time que chega a meta vence', () => {
  const p = partidaCom(jogo, undefined, times);
  let certa = desafio(p);
  toca(p, 1, certa); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1]);
  certa = desafio(p);
  toca(p, 3, (certa + 1) % 4); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0], 'o erro tira do time');
  p.dados.placar = [0, META - 1];
  toca(p, 1, certa); passo(p, DT);
  assert.equal(p.vencedor, 1, 'time B (J2 + J4)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('cor-mentirosa-festa: no fim do tempo vence quem esta na frente sozinho', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 2); p.dados.placar = [1, 3, 2];
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo, undefined, times);
  roda(q, 2); q.dados.placar = [2, 1];
  ateOFim(q);
  assert.equal(q.vencedor, 0);
});

test('cor-mentirosa-festa: lideres iguais no fim do tempo da empate', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  roda(p, 2); p.dados.placar = [2, 0, 2, 1];
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  const q = partidaCom(jogo, undefined, vs(2));
  ateOFim(q);
  assert.equal(q.vencedor, -1, 'todos parados');
});

test('cor-mentirosa-festa: o celular mostra o comando e os pontos', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  desafio(p); passo(p, DT);
  assert.match(p.celular[0].texto, /^Toque a (PALAVRA|TINTA)\. Pontos: 0$/);
});

test('cor-mentirosa-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
