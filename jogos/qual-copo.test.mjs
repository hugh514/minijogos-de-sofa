import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './qual-copo.mjs';

function nova(semente = 1) {
  const p = partidaCom(jogo, sorteio(semente));
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nb: 0 });
  return p;
}
function ate(p, fase) { for (let k = 0; k < 3000 && p.dados.fase !== fase && p.fase === 'jogando'; k++) passo(p, DT); assert.equal(p.dados.fase, fase); }
const perto = (p, i, id) => { const j = p.jogadores[i], c = p.dados.copos[id]; j.x = c.x; j.z = c.z + 2.3; j.vx = j.vz = 0; };
function levanta(p, i, id) {
  perto(p, i, id);
  entrada(p, i, { x: 0, y: 0, nb: p.jogadores[i].nb + 1 });
  passo(p, DT);
}
const errado = p => p.dados.copos.find(c => c.id !== p.dados.estrela && !c.aberto).id;
function ganha(p, i) { ate(p, 'escolhe'); levanta(p, i, p.dados.estrela); ate(p, 'revela'); }
function fimDaRodada(p) { const r = p.dados.rodada; for (let k = 0; k < 600 && p.dados.rodada === r && p.fase === 'jogando'; k++) passo(p, DT); }

test('qual-copo: 3 copos nas duas primeiras rodadas e 4 depois, a estrela sempre sob um deles', () => {
  const p = nova();
  const contagens = [];
  for (let r = 0; r < 4; r++) {
    contagens.push(p.dados.copos.length);
    assert.ok(p.dados.estrela >= 0 && p.dados.estrela < p.dados.copos.length);
    p.dados.fase = 'revela'; p.dados.tempo = 0; passo(p, DT);
  }
  assert.deepEqual(contagens, [3, 3, 4, 4]);
});

test('qual-copo: mostra a estrela, mistura e so depois libera, sem perder a estrela', () => {
  for (let s = 1; s <= 20; s++) {
    const p = nova(s), d = p.dados;
    assert.equal(d.fase, 'mostra');
    ate(p, 'mistura');
    ate(p, 'escolhe');
    const xs = d.copos.map(c => c.x).sort((a, b) => a - b);
    assert.equal(new Set(d.ocupa).size, d.copos.length, 'cada lugar tem um copo');
    d.ocupa.forEach((id, slot) => assert.equal(d.copos[id].x, xs[slot]));
    assert.ok(d.copos.every(c => c.z === -1.2), 'copos voltam para a fileira');
  }
});

test('qual-copo: a mistura acelera a cada rodada', () => {
  const tempoMistura = r => { const p = nova(3); p.dados.rodada = r; p.dados.fase = 'revela'; p.dados.tempo = 0; p.dados.rodada = r - 1; passo(p, DT); ate(p, 'mistura'); let t = 0; while (p.dados.fase === 'mistura') { passo(p, DT); t += DT; } return t / (4 + r); };
  assert.ok(tempoMistura(3) < tempoMistura(1), 'a troca por rodada fica mais rapida');
});

test('qual-copo: apertar Levanta antes da hora deixa o jogador tonto e nao vale', () => {
  const p = nova();
  perto(p, 0, p.dados.estrela);
  entrada(p, 0, { x: 0, y: 0, nb: 1 }); passo(p, DT);
  assert.ok(p.dados.tonto[0] > 0.8);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.match(p.celular[0].texto, /Cedo demais/);
  const x = p.jogadores[0].x;
  entrada(p, 0, { x: 1, y: 0, nb: 1 }); roda(p, 0.3);
  assert.ok(Math.abs(p.jogadores[0].x - x) < 0.5, 'tonto nao anda');
});

test('qual-copo: quem levanta o copo da estrela primeiro leva o ponto (retorno 0 e 1 vem do placar)', () => {
  for (const i of [0, 1]) {
    const p = nova(); ate(p, 'escolhe');
    levanta(p, i, p.dados.estrela);
    assert.equal(p.dados.placar[i], 1);
    assert.equal(p.dados.placar[1 - i], 0);
    assert.equal(p.dados.fase, 'revela');
    assert.match(p.dados.aviso, /achou a estrela/);
    assert.match(p.celular[i].texto, /Você achou a estrela/);
    assert.match(p.celular[1 - i].texto, /O rival achou/);
  }
});

test('qual-copo: os dois apertando no mesmo quadro no copo certo, so um pontua', () => {
  const p = nova(); ate(p, 'escolhe');
  perto(p, 0, p.dados.estrela); perto(p, 1, p.dados.estrela);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nb: 1 });
  passo(p, DT);
  assert.equal(p.dados.placar[0] + p.dados.placar[1], 1);
});

test('qual-copo: copo errado fica aberto, deixa tonto e o rival ainda pode acertar', () => {
  const p = nova(); ate(p, 'escolhe');
  const id = errado(p);
  levanta(p, 0, id);
  assert.equal(p.dados.copos[id].aberto, true);
  assert.ok(p.dados.tonto[0] > 1);
  assert.equal(p.dados.fase, 'escolhe');
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.match(p.celular[1].texto, /rival errou/);
  roda(p, 0.5);
  levanta(p, 0, p.dados.estrela);
  assert.deepEqual(p.dados.placar, [0, 0], 'tonto nao levanta');
  levanta(p, 1, p.dados.estrela);
  assert.deepEqual(p.dados.placar, [0, 1]);
});

test('qual-copo: longe de qualquer copo o botao nao faz nada', () => {
  const p = nova(); ate(p, 'escolhe');
  const j = p.jogadores[0]; j.x = -9; j.z = 6; j.vx = j.vz = 0;
  entrada(p, 0, { x: 0, y: 0, nb: 1 }); passo(p, DT);
  assert.equal(p.dados.fase, 'escolhe');
  assert.ok(p.dados.copos.every(c => !c.aberto));
});

test('qual-copo: ninguem acha, a estrela aparece e a rodada segue sem ponto', () => {
  const p = nova(); ate(p, 'escolhe');
  roda(p, 4.3);
  assert.equal(p.dados.fase, 'revela');
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.copos[p.dados.estrela].aberto, true);
  assert.match(p.dados.aviso, /Ninguém achou/);
});

test('qual-copo: 3 estrelas vencem a rodada para cada lado (retorno 0 e 1) e o placar aparece', () => {
  for (const i of [0, 1]) {
    const p = nova();
    for (let r = 0; r < 3; r++) { ganha(p, i); if (r < 2) { assert.ok(p.fase === 'jogando'); fimDaRodada(p); } }
    for (let k = 0; k < 120 && p.fase === 'jogando'; k++) passo(p, DT);
    assert.equal(p.vencedor, i);
    assert.match(p.dados.aviso, /venceu/);
    assert.match(p.celular[i].texto, /Você venceu por 3 x 0/);
  }
});

test('qual-copo: no tempo limite vence quem tem mais estrelas', () => {
  const p = nova();
  ganha(p, 1);
  for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.equal(p.vencedor, 1);
});

test('qual-copo: empatado no limite, joga mais ate alguem pontuar; sem ponto, empate', () => {
  const p = nova();
  for (let k = 0; k < 60 * 39 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.equal(p.fase, 'jogando', 'empatado, passa do limite');
  for (let k = 0; k < 60 * 8 && p.fase === 'jogando'; k++) passo(p, DT);
  assert.equal(p.vencedor, -1);
  assert.match(p.dados.aviso, /Empate/);
  const q = nova();
  for (let k = 0; k < 60 * 38.2 && q.fase === 'jogando'; k++) passo(q, DT);
  ate(q, 'escolhe'); levanta(q, 0, q.dados.estrela);
  for (let k = 0; k < 120 && q.fase === 'jogando'; k++) passo(q, DT);
  assert.equal(q.vencedor, 0);
});

test('qual-copo: nao decide em menos de 5 s e a dica cita o botao', () => {
  const p = nova(); ganha(p, 0);
  assert.equal(p.fase, 'jogando');
  assert.match(jogo.dica, /Levanta/);
  assert.equal(jogo.controle.b, 'LEVANTA');
  assert.equal(jogo.duracao, 38);
  assert.doesNotMatch(jogo.dica + jogo.nome, /[–—]/);
});

test('qual-copo: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});
