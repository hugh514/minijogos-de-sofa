import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo from './bola-neve.mjs';

const livre = (dono, x, z, vx, vz, r = 0.7) => ({ x, z, vx, vz, r, dono, preso: false, vivo: true, idade: 0, bolona: false });

function parada() {
  const p = partidaCom(jogo);
  p.jogadores[0].x = -7; p.jogadores[1].x = 7;
  return p;
}

test('bola-neve: segurar o botao andando faz a bola crescer e deixa o jogador mais lento', () => {
  const p = parada();
  entrada(p, 0, { x: 1, y: 0, d: true });
  roda(p, 0.3);
  const b = p.dados.preso[0];
  assert.ok(b, 'tem uma bola rolando');
  const r1 = b.r;
  roda(p, 1.5);
  assert.ok(b.r > r1 + 0.3, 'cresceu andando: ' + b.r);
  assert.ok(p.jogadores[0].turbo < 0.9, 'bola grande deixa lento');
  assert.ok(b.r <= 2.0 + 1e-9);
});

test('bola-neve: parado a bola nao cresce', () => {
  const p = parada();
  entrada(p, 0, { x: 0, y: 0, d: true });
  roda(p, 2);
  assert.ok(p.dados.preso[0].r < 0.75);
});

test('bola-neve: soltar o botao lanca a bola na direcao do rival e ela o empurra e marca 1', () => {
  const p = parada();
  entrada(p, 0, { x: 1, y: 0, d: true });
  roda(p, 0.2);
  entrada(p, 0, { x: 1, y: 0, d: false });
  roda(p, 1.2);
  assert.equal(p.dados.placar[0], 1);
  assert.ok(p.jogadores[1].vx > 3 || p.jogadores[1].x > 7.5, 'rival foi empurrado para tras');
  assert.equal(p.dados.bolas.filter(b => !b.preso).length, 0);
});

test('bola-neve: bola grande vale 2 pontos', () => {
  const p = parada();
  p.dados.bolas.push(livre(0, 3, 0, 14, 0, 1.6));
  roda(p, 0.6);
  assert.equal(p.dados.placar[0], 2);
});

test('bola-neve: bola do jogador 2 acerta o jogador 1', () => {
  const p = parada();
  p.dados.bolas.push(livre(1, -4, 0, -14, 0));
  roda(p, 0.6);
  assert.deepEqual(p.dados.placar, [0, 1]);
});

test('bola-neve: a bola nao acerta quem a lancou', () => {
  const p = parada();
  p.jogadores[0].x = 0;
  p.dados.bolas.push(livre(0, -1, 0, 10, 0));
  roda(p, 0.3);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('bola-neve: bola contra bola, a maior vence e fica menor; a pequena some', () => {
  const p = parada();
  p.jogadores[0].z = 5; p.jogadores[1].z = -5;           // fora do caminho
  const grande = livre(0, -2, 0, 8, 0, 1.4), pequena = livre(1, 2, 0, -8, 0, 0.6);
  p.dados.bolas.push(grande, pequena);
  roda(p, 0.4);
  assert.ok(!p.dados.bolas.includes(pequena));
  assert.ok(grande.r < 1.4 && grande.r > 1.2, 'ficou com a diferenca: ' + grande.r);
});

test('bola-neve: bolas iguais se desfazem juntas', () => {
  const p = parada();
  p.jogadores[0].z = 5; p.jogadores[1].z = -5;
  p.dados.bolas.push(livre(0, -1, 0, 8, 0, 0.8), livre(1, 1, 0, -8, 0, 0.8));
  roda(p, 0.4);
  assert.equal(p.dados.bolas.length, 0);
});

test('bola-neve: bola solta que bate no escudo (a bola rolada) encolhe o escudo', () => {
  const p = parada();
  p.jogadores[1].z = 5;
  entrada(p, 1, { x: -1, y: 0, d: true });
  roda(p, 1.5);                                          // o jogador 2 rola uma bola grande para a esquerda
  entrada(p, 1, { x: 0, y: 0, d: true });                // para de andar: a bola para de crescer
  roda(p, 0.5);
  const escudo = p.dados.preso[1];
  const r0 = escudo.r;
  p.dados.bolas.push(livre(0, escudo.x - 4, escudo.z, 14, 0, 0.6));
  roda(p, 0.5);
  assert.ok(escudo.r < r0 || !p.dados.bolas.includes(escudo));
  assert.equal(p.dados.placar[0], 0, 'a bola foi parada pelo escudo');
});

test('bola-neve: bola solta derrete ao parar e a parede a faz quicar', () => {
  const p = parada();
  p.jogadores[0].z = 5; p.jogadores[1].z = 5;
  const b = livre(0, 9, -3, 6, 0);
  p.dados.bolas.push(b);
  roda(p, 0.5);
  assert.ok(b.vx < 0, 'quicou na parede do fundo');
  roda(p, 4);
  assert.ok(!p.dados.bolas.includes(b), 'derreteu');
});

test('bola-neve: chegar a 7 pontos vence (jogador 1 e jogador 2)', () => {
  const p = parada();
  p.dados.placar = [6, 0];
  p.dados.bolas.push(livre(0, 3, 0, 14, 0));
  roda(p, 0.6);
  assert.equal(p.vencedor, 0);
  const q = parada();
  q.dados.placar = [0, 6];
  q.dados.bolas.push(livre(1, -4, 0, -14, 0));
  roda(q, 0.6);
  assert.equal(q.vencedor, 1);
});

test('bola-neve: no limite de tempo vence quem esta na frente', () => {
  const p = parada();
  p.dados.placar = [1, 3];
  roda(p, 46);
  assert.equal(p.vencedor, 1);
});

test('bola-neve: empate no limite vira morte subita; o proximo acerto decide', () => {
  const p = parada();
  p.dados.placar = [2, 2];
  roda(p, 46);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.aviso, 'Morte súbita!');
  p.dados.bolas.push(livre(0, 3, 0, 14, 0));
  roda(p, 0.6);
  assert.equal(p.vencedor, 0);
});

test('bola-neve: morte subita sem acerto termina em empate', () => {
  const p = parada();
  roda(p, 62);
  assert.equal(p.vencedor, -1);
});

test('bola-neve: estado final deixa aviso e celular prontos', () => {
  const p = parada();
  p.dados.placar = [6, 0];
  p.dados.bolas.push(livre(0, 3, 0, 14, 0));
  roda(p, 0.6);
  assert.match(p.dados.aviso, /venceu/);
  assert.match(p.celular[0].texto, /Fim/);
});

test('bola-neve: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('bola-neve: entrada aleatoria e frenetica nunca quebra nem estoura a bola', () => {
  for (let s = 20; s < 30; s++) {
    const { p } = rodada(jogo, (q, k, rng) => { aleatorio(q, k, rng); aleatorio(q, k + 6, rng); }, s);
    for (const b of p.dados.bolas) assert.ok(Number.isFinite(b.x) && b.r <= 2.0 + 1e-9);
  }
});
