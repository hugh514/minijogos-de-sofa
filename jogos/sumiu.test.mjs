import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './sumiu.mjs';

function nova(semente = 1) {
  const p = partidaCom(jogo, sorteio(semente));
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nop: 0 });
  return p;
}
function toca(p, i, op) { entrada(p, i, { x: 0, y: 0, op, nop: p.jogadores[i].nop + 1 }); passo(p, DT); }
const certa = (p, i) => p.dados.perg[i].opcoes.indexOf(String(p.dados.perg[i].resp));
const errada = (p, i) => (certa(p, i) + 1) % 4;
function ateFase(p, fase) { for (let k = 0; k < 1200 && p.dados.fase !== fase && p.fase === 'jogando'; k++) passo(p, DT); assert.equal(p.dados.fase, fase); }

test('sumiu: 6 a 10 objetos, perguntas diferentes com a resposta entre 4 opcoes', () => {
  for (let s = 1; s <= 40; s++) {
    const d = nova(s).dados;
    assert.ok(d.objs.length >= 6 && d.objs.length <= 10);
    for (const o of d.objs) assert.ok(Math.abs(o.x) < 7 && Math.abs(o.z) < 3.2 && o.forma >= 0 && o.forma < 3 && o.cor >= 0 && o.cor < 3);
    assert.notEqual(d.perg[0].texto, d.perg[1].texto);
    for (const q of d.perg) {
      assert.equal(new Set(q.opcoes).size, 4);
      assert.ok(q.opcoes.includes(String(q.resp)));
    }
  }
});

test('sumiu: pergunta conta certo', () => {
  const d = nova().dados;
  for (const q of d.perg) {
    if (q.texto === 'Quantos objetos ao todo?') assert.equal(q.resp, d.objs.length);
    if (q.texto === 'Quantos cones?') assert.equal(q.resp, d.objs.filter(o => o.forma === 2).length);
    assert.ok(q.resp >= 0 && q.resp <= d.objs.length);
  }
});

test('sumiu: mostra por 5 s, so entao pergunta; toque antes nao vale', () => {
  const p = nova();
  assert.equal(p.celular[0].modo, 'espera');
  toca(p, 0, certa(p, 0));
  roda(p, 4.5);
  assert.equal(p.dados.fase, 'mostra'); assert.deepEqual(p.dados.placar, [0, 0]);
  roda(p, 0.6);
  assert.equal(p.dados.fase, 'pergunta');
  assert.equal(p.celular[0].modo, 'opcoes');
  assert.equal(p.celular[0].texto, p.dados.perg[0].texto);
  assert.notEqual(p.celular[0].texto, p.celular[1].texto);
});

test('sumiu: os dois acertam, bonus para quem respondeu primeiro; revela por 1,5 s', () => {
  const p = nova();
  ateFase(p, 'pergunta');
  toca(p, 1, certa(p, 1));
  toca(p, 1, errada(p, 1));                         // segunda resposta nao conta
  roda(p, 1);
  toca(p, 0, certa(p, 0));
  assert.deepEqual(p.dados.placar, [1, 2]);
  assert.equal(p.dados.fase, 'revela');
  roda(p, 1.4);
  assert.equal(p.dados.fase, 'revela');
  roda(p, 0.2);
  assert.equal(p.dados.fase, 'mostra'); assert.equal(p.dados.rodada, 1);
});

test('sumiu: quem erra nao pontua e nao ha bonus', () => {
  const p = nova();
  ateFase(p, 'pergunta');
  toca(p, 0, errada(p, 0));
  toca(p, 1, certa(p, 1));
  assert.deepEqual(p.dados.placar, [0, 1]);
});

test('sumiu: sem resposta em 7 s a rodada segue; 3 rodadas e maior placar vence', () => {
  const p = nova();
  ateFase(p, 'pergunta');
  toca(p, 0, certa(p, 0));
  roda(p, 5.5);
  assert.equal(p.dados.fase, 'pergunta');
  roda(p, 0.6);
  assert.equal(p.dados.fase, 'revela');
  roda(p, 13.5 * 2 + 2);
  assert.equal(p.vencedor, 0);
});

test('sumiu: ninguem responde, empata', () => {
  const p = nova();
  roda(p, 38);
  assert.equal(p.dados.rodada, 3, 'empatou: rodada de desempate');
  assert.match(p.dados.aviso, /Desempate/);
  for (let k = 0; k < 1200 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.equal(p.vencedor, -1, 'sem ninguem responder o empate fica');
});

test('sumiu: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});

test('sumiu: a ultima rodada vale em dobro e avisa na tela', () => {
  const p = nova();
  roda(p, 13 * 2);
  assert.equal(p.dados.rodada, 2);
  assert.match(p.dados.aviso, /vale em dobro/);
  ateFase(p, 'pergunta');
  toca(p, 0, certa(p, 0));
  assert.equal(p.dados.placar[0], 2);
  assert.match(jogo.dica, /dobro/);
});

test('sumiu: empate depois das 3 rodadas leva a uma rodada de desempate', () => {
  const p = nova();
  roda(p, 13 * 3);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.rodada, 3);
});
