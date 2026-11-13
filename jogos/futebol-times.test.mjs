import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, DT } from '../jogos/_teste.mjs';
import jogo, { LX, GOL, RAIO_BOLA, V_MAX, GOLS, TEMPO } from './futebol-times.mjs';

const times = { n: 4, modo: 'times' };
const nova = () => partidaCom(jogo, undefined, times);
// Faz a bola entrar no gol da direita (gol de quem defende o lado B): o time A marca.
function golNaDireita(p) { Object.assign(p.dados.bola, { x: LX - 2, z: 0, vx: 12, vz: 0 }); roda(p, 0.5); }
function golNaEsquerda(p) { Object.assign(p.dados.bola, { x: -LX + 2, z: 0, vx: -12, vz: 0 }); roda(p, 0.5); }
const fim = p => { for (let k = 0; k < 60 * 80 && p.fase === 'jogando'; k++) passo(p, DT); assert.notEqual(p.fase, 'jogando'); };

test('futebol-times: contrato da festa (so times, so com 4), 50 s e gols no placar', () => {
  assert.deepEqual(jogo.festa, { min: 4, max: 4, modos: ['times'] });
  assert.equal(jogo.duracao, 50);
  assert.equal(TEMPO, 50);
  assert.equal(GOLS, 3);
  assert.equal(jogo.rotulo, 'gols');
  assert.deepEqual(jogo.controle, { modo: 'padrao', a: 'CHUTA', b: '' });
  assert.equal(jogo.semPulo, true);
});

test('futebol-times: o time A (J1 e J3) comeca na esquerda e o B (J2 e J4) na direita, bola no centro', () => {
  const p = nova();
  const x = p.jogadores.map(j => j.x);
  assert.ok(x[0] < -3 && x[2] < -3 && x[1] > 3 && x[3] > 3, 'lados: ' + x);
  assert.notEqual(p.jogadores[0].z, p.jogadores[2].z, 'a dupla nao nasce uma em cima da outra');
  assert.deepEqual([p.dados.bola.x, p.dados.bola.z], [0, 0]);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.arena.gol, GOL);
});

test('futebol-times: gol na direita vale para o time A, e o gol na esquerda para o B', () => {
  const p = nova();
  golNaDireita(p);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.fase, 'jogando', 'um gol nao acaba a rodada');
  roda(p, 2);
  golNaEsquerda(p);
  assert.deepEqual(p.dados.placar, [1, 1]);
});

test('futebol-times: depois do gol bola e jogadores voltam ao lugar e a bola espera o saque', () => {
  const p = nova();
  p.jogadores.forEach(j => Object.assign(j, { x: 0.3, z: 0.3, vx: 2, vz: 2 }));
  golNaDireita(p);
  assert.ok(p.jogadores[0].x < -3 && p.jogadores[1].x > 3, 'cada um no seu lado');
  assert.ok(p.dados.saque > 0, 'saque pendente');
  assert.deepEqual([p.dados.bola.x, p.dados.bola.z, p.dados.bola.vx, p.dados.bola.vz], [0, 0, 0, 0]);
  // jogador em cima da bola durante o saque nao a move
  Object.assign(p.jogadores[1], { x: 0.5, z: 0, vx: -9, vz: 0 });
  roda(p, 0.3);
  assert.ok(Math.abs(p.dados.bola.x) < 0.01, 'bola parada ate o saque');
  roda(p, 2);
  assert.equal(p.dados.saque, 0);
});

test('futebol-times: 3 gols decidem e o time devolve 0 ou 1 (todos do time pontuam)', () => {
  const p = nova();
  for (let k = 0; k < GOLS - 1; k++) { golNaDireita(p); roda(p, 2); }
  assert.equal(p.fase, 'jogando', 'com 2 a 0 ainda nao acabou');
  golNaDireita(p);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('futebol-times: da virada, 2 a 0 vira 3 a 2', () => {
  const p = nova();
  golNaDireita(p); roda(p, 2); golNaDireita(p); roda(p, 2);
  golNaEsquerda(p); roda(p, 2); golNaEsquerda(p); roda(p, 2); golNaEsquerda(p);
  assert.deepEqual(p.dados.placar, [2, 3]);
  assert.equal(p.vencedor, 1);
});

test('futebol-times: no fim dos 50 s vence quem esta na frente e empate da -1', () => {
  const p = nova();
  golNaEsquerda(p);
  fim(p);
  assert.equal(p.vencedor, 1);
  assert.ok(p.t < 1 && p.jogo === jogo);
  const q = nova();
  fim(q);
  assert.equal(q.vencedor, -1, '0 a 0 e empate');
  const r = nova();
  golNaDireita(r); roda(r, 2); golNaEsquerda(r);
  fim(r);
  assert.equal(r.vencedor, -1, '1 a 1 e empate');
});

test('futebol-times: a bola nunca passa da velocidade maxima, mesmo depois de uma pancada forte', () => {
  const p = nova();
  Object.assign(p.dados.bola, { x: 0, z: 0, vx: 0, vz: 0 });
  Object.assign(p.jogadores[0], { x: -1.4, z: 0, vx: 30, vz: 0 });
  let maior = 0;
  for (let k = 0; k < 90; k++) { passo(p, DT); maior = Math.max(maior, Math.hypot(p.dados.bola.vx, p.dados.bola.vz)); }
  assert.ok(maior > 5, 'a pancada mexeu na bola: ' + maior);
  assert.ok(maior <= V_MAX + 1e-9, 'limite: ' + maior);
  assert.ok(V_MAX <= 14);
});

test('futebol-times: a bola quica nas paredes laterais e fica dentro do campo', () => {
  const p = nova();
  Object.assign(p.dados.bola, { x: 0, z: 0, vx: 0, vz: 12 });
  roda(p, 3);
  assert.ok(Math.abs(p.dados.bola.z) <= p.arena.lz);
  assert.ok(Math.abs(p.dados.bola.x) <= LX);
  assert.equal(p.fase, 'jogando');
});

test('futebol-times: bola na quina fora da boca do gol quica e nao conta', () => {
  const p = nova();
  Object.assign(p.dados.bola, { x: LX - 2, z: GOL + 1.5, vx: 12, vz: 0 });
  roda(p, 0.6);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.ok(p.dados.bola.vx <= 0.01, 'voltou: ' + p.dados.bola.vx);
});

test('futebol-times: gol aos 49 s, o tempo vale no quadro certo mesmo no meio do saque (nunca passa de 50 s)', () => {
  const p = nova();
  p.t = 49;
  golNaDireita(p);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.fase, 'jogando', 'aos 49,5 s ainda falta meio segundo');
  assert.ok(p.dados.saque > 0.5, 'o saque ainda duraria mais que o tempo que falta');
  roda(p, 0.6);
  assert.equal(p.fase, 'resultado', 'o jogo acabou aos 50 s, sem esperar o saque');
  assert.equal(p.vencedor, 0);
});

test('futebol-times: o celular repete o placar e o time de cada um', () => {
  const p = nova();
  passo(p, DT);
  assert.equal(p.celular[0].texto, 'Time A 0 x 0 Time B');
  golNaDireita(p);
  assert.equal(p.celular[3].texto, 'Time A 1 x 0 Time B');
});

test('futebol-times: ninguem mexendo nao decide a partida cedo', () => {
  const p = nova();
  roda(p, 5);
  assert.equal(p.fase, 'jogando');
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('futebol-times: botao A empurra (motor) e nao quebra a bola', () => {
  const p = nova();
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 }); entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 1);
  assert.ok(p.jogadores[0].empurroes >= 1);
  assert.ok(Number.isFinite(p.dados.bola.x));
});

test('futebol-times: fumaca (monta e desenha de verdade) em times com 4', () => {
  assert.equal(fumaca(jogo, times).length, 15);
});

test('futebol-times: dedos aleatorios, a rodada termina em ate 50 s', () => {
  const { segundos } = rodada(jogo, undefined, 4, times);
  assert.ok(segundos <= TEMPO + 0.1, 'durou ' + segundos);
  assert.ok(RAIO_BOLA >= 0.8, 'bola grande o bastante para a TV');
});
