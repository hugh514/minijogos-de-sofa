import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo from './gangorra.mjs';

const moeda = (s, valor = 1) => ({ s, vs: 0, h: 0, vh: 0, valor, giro: 0 });
const pula = (p, i) => { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); };
const parado = p => { p.dados.moedas = []; p.dados.espera = 999; };

test('gangorra: tem genero equilibrio, botao Pula e dica que cita o botao', () => {
  assert.equal(jogo.genero, 'equilibrio');
  assert.equal(jogo.controle.a, 'Pula');
  assert.ok(jogo.dica.includes('Pula'));
  assert.ok(!/[—–]/.test(jogo.dica + jogo.nome));
});

test('gangorra: o peso de quem esta mais longe do centro afunda a tabua do seu lado', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -6; p.dados.e[1].s = 2;
  roda(p, 1.5);
  assert.ok(p.dados.a > 0.1, 'lado esquerdo desce: a direita sobe');
  assert.ok(p.dados.e[0].s < -5.9 || p.dados.e[0].vs < 0, 'quem esta no lado baixo escorrega para a ponta');
});

test('gangorra: pegar a moeda soma o valor dela para quem pegou', () => {
  const p = partidaCom(jogo);
  p.dados.moedas = [moeda(p.dados.e[1].s, 2)]; p.dados.espera = 999;
  roda(p, 0.3);
  assert.deepEqual(p.dados.placar, [0, 2]);
  assert.equal(p.dados.moedas.length, 0);
});

test('gangorra: sempre aparece moeda nova depois de pegar uma', () => {
  const p = partidaCom(jogo);
  p.dados.moedas = [moeda(p.dados.e[0].s)];
  roda(p, 3);
  assert.equal(p.dados.moedas.length, 1);
});

test('gangorra: quem escorrega para fora cai na agua, o outro ganha 3 e o que caiu volta', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -8.45;          // passa da ponta esquerda
  roda(p, 1.5);
  assert.equal(p.dados.placar[1], 3);
  assert.ok(p.dados.e[0].caiu > 0, 'esta na agua');
  roda(p, 1.5);
  assert.ok(p.dados.e[0].caiu <= 0, 'voltou');
  assert.ok(p.dados.e[0].inv > 0 || p.dados.e[0].solo || p.dados.e[0].wy > 0);
});

test('gangorra: o dedo sozinho nao leva o boneco para fora da tabua', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -7; p.dados.e[1].s = 7;
  for (let k = 0; k < 60; k++) { entrada(p, 1, { x: 1, y: 0, d: false, n: 0 }); passo(p, DT); }
  assert.equal(p.dados.placar[0], 0);
  assert.ok(p.dados.e[1].caiu === 0);
});

test('gangorra: tranco joga para fora quem esta no chao longe do centro', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -5; p.dados.e[1].s = 5.5;
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 });
  pula(p, 0);
  roda(p, 2);
  assert.ok(p.dados.tranco.n >= 1, 'houve tranco');
  assert.ok(p.dados.placar[0] >= 3, 'o outro foi para a agua');
});

test('gangorra: tranco perto do centro nao derruba o outro', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -1.6; p.dados.e[1].s = 1.6;
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 });
  pula(p, 0);
  roda(p, 2.5);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('gangorra: quem esta no ar no momento do tranco nao e lancado', () => {
  const p = partidaCom(jogo);
  parado(p);
  p.dados.e[0].s = -5; p.dados.e[1].s = 5.5;
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 });
  entrada(p, 1, { x: 0, y: 0, d: false, n: 0 });
  pula(p, 0);
  for (let k = 0; k < 6; k++) passo(p, DT);
  pula(p, 1);
  roda(p, 2.5);
  assert.equal(p.dados.placar[0], 0, 'o que estava no ar nao foi para a agua');
  assert.ok(p.dados.tranco.n >= 1);
});

test('gangorra: os dois nao se atravessam na tabua', () => {
  const p = partidaCom(jogo);
  parado(p);
  for (let k = 0; k < 240; k++) {
    entrada(p, 0, { x: 1, y: 0, d: false, n: 0 }); entrada(p, 1, { x: -1, y: 0, d: false, n: 0 });
    passo(p, DT);
    assert.ok(p.dados.e[1].s - p.dados.e[0].s >= 3.19);
  }
});

test('gangorra: retorno 0 quando o jogador 1 esta na frente no fim do tempo', () => {
  const p = partidaCom(jogo);
  parado(p); p.dados.placar = [7, 4]; p.t = 34.9;
  roda(p, 0.3);
  assert.equal(p.vencedor, 0);
});

test('gangorra: retorno 1 quando o jogador 2 esta na frente no fim do tempo', () => {
  const p = partidaCom(jogo);
  parado(p); p.dados.placar = [2, 5]; p.t = 34.9;
  roda(p, 0.3);
  assert.equal(p.vencedor, 1);
});

test('gangorra: empate no tempo vira ponto de ouro: o proximo ponto vence', () => {
  const p = partidaCom(jogo);
  parado(p); p.dados.placar = [4, 4]; p.t = 34.9;
  roda(p, 0.3);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.ouro, true);
  p.dados.moedas = [moeda(p.dados.e[0].s)];
  roda(p, 0.3);
  assert.equal(p.vencedor, 0);
});

test('gangorra: retorno -1 quando o empate continua ate o limite do ouro', () => {
  const p = partidaCom(jogo);
  parado(p); p.dados.placar = [4, 4]; p.t = 34.9;
  roda(p, 16);
  assert.equal(p.vencedor, -1);
  assert.ok(p.dados.aviso && p.celular[0].texto);
});

test('gangorra: nem um toque sozinho decide a rodada em menos de 5 s', () => {
  const p = partidaCom(jogo);
  for (let k = 0; k < 4.9 * 60; k++) {
    if (k % 7 === 0) entrada(p, k % 2, { x: k % 3 - 1, y: 0, d: false, n: k });
    passo(p, DT);
  }
  assert.equal(p.fase, 'jogando');
});

test('gangorra: texto final nao tem undefined nem travessao', () => {
  const { p } = rodada(jogo, aleatorio, 3);
  const textos = [p.dados.aviso, ...p.celular.map(c => c.texto)].join(' ');
  assert.ok(!/undefined|NaN|[—–]/.test(textos), textos);
});

test('gangorra: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});
