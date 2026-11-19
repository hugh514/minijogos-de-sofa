import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio } from '../jogos/_teste.mjs';
import jogo from './cadeiras.mjs';

// Pula a musica: a rodada ja comeca com ela parando agora.
function paraAMusica(p) { p.dados.dur = 0; roda(p, 0.05); }
const musicaSemFim = p => { p.dados.dur = 1e9; };
const real = p => p.dados.cadeiras[p.dados.real];
const poeNaCadeira = (p, i) => { const c = real(p); p.jogadores[i].x = c.x; p.jogadores[i].z = c.z; };

test('cadeiras: a rodada comeca com 3 cadeiras girando, e a de verdade e uma so', () => {
  const p = partidaCom(jogo);
  assert.equal(p.dados.cadeiras.length, 3);
  const a0 = p.dados.cadeiras[0].a;
  roda(p, 0.5);
  assert.notEqual(p.dados.cadeiras[0].a, a0, 'girou');
  assert.ok(p.dados.real >= 0 && p.dados.real < 3);
  assert.equal(p.dados.fase, 'musica');
});

test('cadeiras: a musica freia no fim e depois para', () => {
  const p = partidaCom(jogo);
  p.dados.tFase = p.dados.dur - 0.5;
  roda(p, 0.1);
  assert.ok(p.dados.vel > 0 && p.dados.vel < 1.1, 'freando: ' + p.dados.vel);
  roda(p, 0.5);
  assert.equal(p.dados.fase, 'corre');
  assert.equal(p.dados.vel, 0);
});

test('cadeiras: durante a musica sentar nao vale', () => {
  const p = partidaCom(jogo);
  poeNaCadeira(p, 0);
  roda(p, 0.2);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('cadeiras: as cadeiras falsas somem depois que a musica para e a de verdade fica', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  p.jogadores[0].x = -8; p.jogadores[1].x = 8;
  roda(p, 0.7);
  const vivas = p.dados.cadeiras.filter(c => !c.sumida);
  assert.equal(vivas.length, 1);
  assert.equal(vivas[0], real(p));
});

test('cadeiras: quem chega primeiro na cadeira marca', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  poeNaCadeira(p, 1);
  roda(p, 0.1);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.dados.fase, 'sentado');
  assert.match(p.dados.aviso, /sentou/);
});

test('cadeiras: os dois no mesmo quadro, vale o mais perto', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  const c = real(p);
  p.jogadores[0].x = c.x + 1.2; p.jogadores[0].z = c.z;
  p.jogadores[1].x = c.x - 0.3; p.jogadores[1].z = c.z;
  roda(p, 0.02);
  assert.deepEqual(p.dados.placar, [0, 1]);
});

test('cadeiras: pisar numa cadeira falsa nao marca', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  const falsa = p.dados.cadeiras.find((_, k) => k !== p.dados.real);
  p.jogadores[0].x = falsa.x; p.jogadores[0].z = falsa.z;
  p.jogadores[1].x = 0; p.jogadores[1].z = 0;
  roda(p, 0.1);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('cadeiras: o empurrao tira o rival do caminho', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  p.jogadores[0].x = 0; p.jogadores[0].z = 0; p.jogadores[1].x = 1.6; p.jogadores[1].z = 0;
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 0.3);
  assert.ok(p.jogadores[1].x > 3, 'rival foi empurrado');
});

test('cadeiras: ninguem chega, vale o mais perto depois de 3,5 s', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  const c = real(p);
  p.jogadores[0].x = -c.x * 1.4; p.jogadores[0].z = -c.z * 1.4;
  p.jogadores[1].x = 0; p.jogadores[1].z = 0;
  roda(p, 3);
  assert.equal(p.dados.fase, 'corre');
  roda(p, 0.8);
  assert.equal(p.dados.placar[1], 1);
});

test('cadeiras: depois de sentar vem outra rodada, com cadeira em outro lugar e mais cadeiras', () => {
  const p = partidaCom(jogo);
  paraAMusica(p);
  poeNaCadeira(p, 0);
  const antes = real(p).base;
  roda(p, 1.9);
  assert.equal(p.dados.fase, 'musica');
  assert.equal(p.dados.cadeiras.length, 4);
  assert.notEqual(p.dados.cadeiras[0].base, antes);
  assert.ok(p.dados.cadeiras.every(c => !c.sumida));
});

test('cadeiras: o primeiro a 4 vence (jogador 1 e jogador 2)', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [3, 0];
  paraAMusica(p); poeNaCadeira(p, 0);
  roda(p, 2);
  assert.equal(p.vencedor, 0);
  const q = partidaCom(jogo);
  q.dados.placar = [0, 3];
  paraAMusica(q); poeNaCadeira(q, 1);
  roda(q, 2);
  assert.equal(q.vencedor, 1);
});

test('cadeiras: no limite de tempo vence quem esta na frente', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [2, 1]; musicaSemFim(p);
  roda(p, 46);
  paraAMusica(p); poeNaCadeira(p, 0);
  roda(p, 2);
  assert.equal(p.vencedor, 0);
});

test('cadeiras: empate no limite pede rodada decisiva e ela decide', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [1, 0]; musicaSemFim(p);
  roda(p, 46);
  paraAMusica(p); poeNaCadeira(p, 1);
  roda(p, 2);
  assert.equal(p.fase, 'jogando');
  assert.deepEqual(p.dados.placar, [1, 1]);
  assert.equal(p.dados.aviso, 'Rodada decisiva!');
  paraAMusica(p); poeNaCadeira(p, 1);
  roda(p, 2);
  assert.equal(p.vencedor, 1);
});

test('cadeiras: tudo empatado no tempo maximo termina em empate', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [1, 1];
  p.dados.fase = 'sentado'; p.dados.venceu = 0;                // rodada travada, sem ninguem marcando
  p.dados.tFase = -1000;
  roda(p, 59);
  assert.equal(p.vencedor, -1);
});

test('cadeiras: estado final deixa aviso e celular prontos', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [3, 0];
  paraAMusica(p); poeNaCadeira(p, 0);
  roda(p, 2);
  assert.match(p.dados.aviso, /venceu/);
  assert.match(p.celular[0].texto, /Fim/);
});

test('cadeiras: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});

test('cadeiras: entrada frenetica nunca quebra e a rodada sempre fecha', () => {
  for (let s = 40; s < 48; s++) {
    const { segundos } = rodada(jogo, (q, k, rng) => { aleatorio(q, k, rng); aleatorio(q, k + 6, rng); }, s);
    assert.ok(segundos <= 60);
  }
});
