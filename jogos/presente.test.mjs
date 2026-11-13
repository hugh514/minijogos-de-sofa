import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './presente.mjs';

function escolhe(p, i, op) {
  const j = p.jogadores[i];
  if (j.nop === undefined) entrada(p, i, { nop: 0 });
  entrada(p, i, { op, nop: j.nop + 1 });
  passo(p, DT);
}

test('presente: segredo so no celular do entregador, opcoes so no do receptor', () => {
  const p = partidaCom(jogo), d = p.dados, e = d.entregador;
  assert.equal(p.celular[1 - e].opcoes, undefined, 'sem botoes antes de valer');
  passo(p, DT);
  assert.equal(p.celular[e].modo, 'espera');
  assert.match(p.celular[e].texto, d.bomba ? /BOMBA/ : /PRESENTE/);
  assert.deepEqual(p.celular[1 - e].opcoes, ['Aceitar', 'Recusar']);
  assert.doesNotMatch(p.celular[1 - e].texto, /BOMBA|PRESENTE/);
  passo(p, DT);
  assert.doesNotMatch(d.aviso, /BOMBA|PRESENTE/, 'a tela nao entrega o segredo antes da hora');
});

test('presente: os quatro desfechos pontuam certo', () => {
  for (const [bomba, op, pontoDoReceptor] of [[false, 0, true], [false, 1, false], [true, 0, false], [true, 1, true]]) {
    const p = partidaCom(jogo), d = p.dados, e = d.entregador, r = 1 - e;
    d.bomba = bomba;
    escolhe(p, r, op);
    assert.equal(d.fase, 'revela');
    assert.equal(d.placar[r], pontoDoReceptor ? 1 : 0, `bomba=${bomba} op=${op}`);
    assert.equal(d.placar[e], pontoDoReceptor ? 0 : 1);
    if (bomba) assert.ok(p.jogadores[pontoDoReceptor ? e : r].vy > 0, 'quem errou voa');
  }
});

test('presente: entregador alterna e melhor de 3 termina com 2 pontos', () => {
  const p = partidaCom(jogo), d = p.dados, primeiro = d.entregador, r = 1 - primeiro;
  d.bomba = true; escolhe(p, r, 1);                 // receptor recusa a bomba: 1 x 0 para ele
  roda(p, 3.1);
  assert.equal(d.fase, 'fala');
  assert.equal(d.entregador, 1 - primeiro, 'trocou o entregador');
  assert.equal(p.vencedor, undefined);
  d.bomba = true; escolhe(p, primeiro, 0);          // agora "r" entrega e o outro aceita a bomba: 2 x 0
  assert.deepEqual(d.placar[r], 2);
  roda(p, 2);
  assert.equal(p.vencedor, r);
});

test('presente: ninguem decide, o tempo decide e a rodada termina', () => {
  const p = partidaCom(jogo);
  roda(p, 8.1);
  assert.equal(p.dados.fase, 'revela');
  for (let i = 0; i < 40 * 60 && p.fase === 'jogando'; i++) passo(p, DT);
  assert.ok(p.t < 1 && p.fase !== 'jogando', 'terminou sozinha em menos de 40 s');
  assert.ok(p.vencedor === 0 || p.vencedor === 1);
});

test('presente: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => v === 0 || v === 1));
});
