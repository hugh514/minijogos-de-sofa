import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, TRECHOS, BASE, LADO, BARRAS } from './corrida-revezamento.mjs';

const times = { n: 4, modo: 'times' };
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0, y: 0, vy: 0 });
function jogaAte(p, antes = () => {}, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { antes(p); passo(p, DT); t += DT; } return t; }
// Um quadro de dedo: joystick e um toque de pulo opcional.
function dedo(p, i, x, y, pula = false) { const j = p.jogadores[i]; entrada(p, i, { x, y, d: false, n: j.n ?? 0, b: false, nb: (j.nb ?? 0) + (pula ? 1 : 0) }); }
// Jogador automatico: corre para o alvo, mantem a pista e pula quando uma barra esta logo adiante.
function corre(p, i, alvoX, pistaZ) {
  const j = p.jogadores[i], sx = Math.sign(alvoX - j.x), perto = Math.abs(alvoX - j.x) < 0.4;
  const barra = BARRAS.some(h => Math.sign(h - j.x) === sx && Math.abs(h - j.x) < 2.0 && Math.abs(h - j.x) > 1.2);
  dedo(p, i, perto ? 0 : sx, Math.max(-1, Math.min(1, (pistaZ - j.z) * 0.8)), barra && j.y === 0);
}
// Quem faz o que no momento: o time t carrega com carrega, e o outro vai ate a base do fim do trecho.
function bots(p) {
  const d = p.dados;
  for (const t of [0, 1]) {
    const k = d.trecho[t], m = [t, t + 2], carrega = m[k % 2], espera = m[(k + 1) % 2], fim = k % 2 === 0 ? BASE : -BASE, z = t === 0 ? -LADO : LADO;
    corre(p, carrega, fim, z);
    corre(p, espera, fim, z);
  }
}

test('corrida-revezamento: contrato da festa so times com 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 4, max: 4, modos: ['times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(TEMPO, 50);
});

test('corrida-revezamento: J1 e J2 comecam com o bastao na esquerda, J3 e J4 esperam na direita, cada time na sua pista', () => {
  const p = partidaCom(jogo, undefined, times);
  assert.deepEqual(p.jogadores.map(j => Math.sign(j.x)), [-1, -1, 1, 1]);
  assert.deepEqual(p.jogadores.map(j => Math.sign(j.z)), [-1, 1, -1, 1]);
  assert.deepEqual(p.dados.trecho, [0, 0]);
  roda(p, 0.05);
  assert.match(p.celular[0].texto, /^Trecho 1 de 7. Você leva o bastão!/);
  assert.match(p.celular[2].texto, /^Trecho 1 de 7. Espere o Jogador 1 encostar em você/);
});

test('corrida-revezamento: o parceiro fica preso na zona ate o bastao chegar', () => {
  const p = partidaCom(jogo, undefined, times);
  poe(p, 2, 0, -LADO);
  roda(p, 0.1);
  assert.ok(p.jogadores[2].x > BASE - 2.1, 'puxado para a zona: ' + p.jogadores[2].x);
  for (let k = 0; k < 30; k++) { dedo(p, 3, -1, 0); passo(p, DT); }
  assert.ok(p.jogadores[3].x >= BASE - 1.9 - 0.01, 'nao saiu da zona: ' + p.jogadores[3].x);
});

test('corrida-revezamento: encostar no parceiro passa o bastao e o trecho seguinte e dele', () => {
  const p = partidaCom(jogo, undefined, times);
  poe(p, 0, BASE - 1.5, -LADO);
  roda(p, 0.1);
  assert.deepEqual(p.dados.trecho, [1, 0]);
  assert.match(p.celular[2].texto, /^Trecho 2 de 7. Você leva o bastão!/);
  assert.match(p.celular[0].texto, /^Trecho 2 de 7. Corra para a base do outro lado/);
});

test('corrida-revezamento: o bastao so passa com o parceiro dentro da zona', () => {
  const p = partidaCom(jogo, undefined, times);
  p.dados.trecho[0] = 1;                                // trecho 2: J3 leva da direita para a esquerda, J1 espera na esquerda
  poe(p, 2, -2, -LADO); poe(p, 0, -1, -LADO);          // J1 ainda no meio da pista, fora da zona
  roda(p, 0.1);
  assert.equal(p.dados.trecho[0], 1, 'sem passar: o parceiro ainda nao chegou a base');
  poe(p, 0, -BASE, -LADO); poe(p, 2, -BASE + 1.4, -LADO);
  roda(p, 0.1);
  assert.equal(p.dados.trecho[0], 2);
});

test('corrida-revezamento: sem pular a barra o corredor tropeca e perde tempo, e pulando ele passa direto', () => {
  const p = partidaCom(jogo, undefined, times);
  poe(p, 1, -2.5, LADO);
  let lento = false;
  for (let k = 0; k < 40; k++) { dedo(p, 1, 1, 0); passo(p, DT); if (p.dados.tropeco[1] > 0) lento = true; }
  assert.ok(lento, 'tropecou');
  assert.ok(p.dados.caida[1] > 0, 'a barra do meio caiu');
  const q = partidaCom(jogo, undefined, times);
  poe(q, 1, -2.5, LADO);
  let pulou = false;
  for (let k = 0; k < 40; k++) { const pula = !pulou && q.jogadores[1].x > -1.6; if (pula) pulou = true; dedo(q, 1, 1, 0, pula); passo(q, DT); }
  assert.equal(q.dados.tropeco[1], 0, 'pulou sem tropecar');
  assert.ok(q.jogadores[1].x > p.jogadores[1].x, 'chegou mais longe que quem tropecou');
});

test('corrida-revezamento: termina pelo objetivo, o time que completa os 7 trechos vence e os dois pontuam', () => {
  const p = partidaCom(jogo, undefined, times);
  p.dados.trecho[1] = TRECHOS - 1;                      // o time B no ultimo trecho: J2 leva da esquerda para a direita
  poe(p, 1, BASE - 1.5, LADO);
  roda(p, 0.1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('corrida-revezamento: termina pelo tempo, vence quem esta mais adiante e igual da -1', () => {
  const p = partidaCom(jogo, undefined, times);
  p.dados.trecho = [2, 1];
  const t = jogaAte(p);
  assert.ok(Math.abs(t - TEMPO) < 0.1, 'acabou aos ' + t);
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  const q = partidaCom(jogo, undefined, times);
  jogaAte(q);
  assert.equal(q.vencedor, -1, 'todos parados: empate');
});

test('corrida-revezamento: o placar mostra a porcentagem da prova e muda durante o trecho', () => {
  const p = partidaCom(jogo, undefined, times);
  assert.deepEqual(p.dados.placar, [0, 0]);
  poe(p, 0, 0, -LADO);
  roda(p, 0.1);
  assert.ok(p.dados.placar[0] >= 7 && p.dados.placar[0] <= 9, 'meio do primeiro trecho: ' + p.dados.placar[0]);
  p.dados.trecho[1] = 2; roda(p, 0.1);
  assert.ok(p.dados.placar[1] >= 28, 'dois trechos feitos: ' + p.dados.placar[1]);
});

test('corrida-revezamento: um time de jogadores automaticos completa a prova em mais de 20 s e antes dos 50 s', () => {
  const p = partidaCom(jogo, undefined, times);
  const t = jogaAte(p, bots);
  assert.ok(p.vencedor === 0 || p.vencedor === 1, 'alguem completou: ' + p.vencedor + ' trechos ' + p.dados.trecho);
  assert.ok(t > 20, 'o percurso inteiro tem 120 m: durou ' + t);
  assert.ok(t < TEMPO, 'cabe no tempo: ' + t);
  assert.ok(p.dados.fim[p.vencedor]);
});

test('corrida-revezamento: dedos aleatorios nunca acabam em menos de 5 s (40 sementes)', () => {
  for (let s = 1; s <= 40; s++) {
    const { p, segundos } = rodada(jogo, aleatorio, s, times);
    assert.ok(segundos >= 5, `semente ${s}: ${segundos}`);
    assert.ok([-1, 0, 1].includes(p.vencedor));
  }
});

test('corrida-revezamento: fumaca em times com 4', () => {
  assert.equal(fumaca(jogo, times).length, 15);
});
