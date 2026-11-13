import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './bocha.mjs';

// encosta em (x0, y0), arrasta ate (x1, y1) e solta
function arrasta(p, i, x0, y0, x1, y1) {
  entrada(p, i, { x: x0, y: y0, d: true }); passo(p, DT);
  entrada(p, i, { x: x1, y: y1, d: true }); passo(p, DT);
  entrada(p, i, { x: x1, y: y1, d: false }); passo(p, DT);
}
const disco = (x, z, dono) => ({ x, z, vx: 0, vz: 0, dono, fora: false, cai: 0 });
function fimCom(discos) {
  const p = partidaCom(jogo);
  Object.assign(p.dados, { discos, jogados: [3, 3], fase: 'rola', tempo: 0 });
  roda(p, 0.1);
  return p;
}

test('bocha: soltar lanca o disco na direcao oposta ao arrasto, com forca proporcional', () => {
  const fraco = partidaCom(jogo), forte = partidaCom(jogo);
  arrasta(fraco, fraco.dados.vez, 0, 0, -0.3, 0);
  arrasta(forte, forte.dados.vez, 0, 0, -0.8, 0);
  const a = fraco.dados.discos[0], b = forte.dados.discos[0];
  assert.equal(fraco.dados.fase, 'rola');
  assert.ok(a.vx > 0 && Math.abs(a.vz) < 1e-9, 'arrastou para a esquerda, saiu para a direita');
  assert.ok(b.vx > a.vx * 2, 'arrasto maior, lancamento mais forte');
});

test('bocha: quem nao esta na vez nao lanca, e os turnos alternam', () => {
  const p = partidaCom(jogo), primeiro = p.dados.vez;
  arrasta(p, 1 - primeiro, 0, 0, 0.5, 0.5);
  assert.equal(p.dados.fase, 'mira');
  assert.deepEqual(p.dados.jogados, [0, 0]);
  arrasta(p, primeiro, 0, 0, primeiro ? 0.4 : -0.4, 0);
  roda(p, 4);
  assert.equal(p.dados.vez, 1 - primeiro);
  assert.equal(p.dados.fase, 'mira');
  assert.equal(p.dados.discos.length, 2);
});

test('bocha: estourou o tempo do turno, o disco sai sozinho', () => {
  const p = partidaCom(jogo), primeiro = p.dados.vez;
  roda(p, 6.2);
  assert.equal(p.dados.jogados[primeiro], 1);
  roda(p, 4);
  const o = p.dados.discos[0];
  assert.ok(Math.hypot(o.x, o.z) < 5, 'andou rumo ao centro');
  assert.ok(!o.fora);
});

test('bocha: disco bate no do adversario e o empurra', () => {
  const p = partidaCom(jogo), vez = p.dados.vez, lado = vez ? 1 : -1;
  p.dados.discos.push(disco(0, 0, 1 - vez));
  arrasta(p, vez, 0, 0, lado * 0.6, 0);
  roda(p, 3);
  const alvo = p.dados.discos[1];
  assert.ok(Math.abs(alvo.x) > 1, 'o disco do centro foi tirado do lugar');
});

test('bocha: disco que sai da arena cai e nao conta', () => {
  const p = fimCom([{ ...disco(7.9, 0, 0), vx: 6 }, disco(6, 0, 1)]);
  assert.ok(p.dados.discos[0].fora);
  assert.equal(p.vencedor, 1);
});

test('bocha: vence o disco mais perto do centro', () => {
  assert.equal(fimCom([disco(1, 0, 0), disco(0, 3, 1), disco(-5, 0, 1)]).vencedor, 0);
  assert.equal(fimCom([disco(4, 0, 0), disco(0, 3, 1), disco(-5, 0, 0)]).vencedor, 1);
});

test('bocha: mesma distancia ou ninguem na arena e empate', () => {
  assert.equal(fimCom([disco(2, 0, 0), disco(-2, 0, 1)]).vencedor, -1);
  assert.equal(fimCom([]).vencedor, -1);
});

test('bocha: parado, a rodada acaba sozinha em menos de 60 s', () => {
  const p = partidaCom(jogo);
  let s = 0;
  while (p.fase === 'jogando' && s < 70) { roda(p, 1); s++; }
  assert.ok(s <= 60, 'acabou em ' + s + ' s');
  assert.deepEqual(p.erros, []);
});

test('bocha: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
