import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { pontoPista, distPista, R_DENTRO, R_FORA, R_MEIO, L } from './corrida.mjs';

// Piloto automatico: mira um ponto um pouco a frente no meio da pista. sentido -1 anda na contramao.
function pilota(p, i, sentido = 1) {
  const j = p.jogadores[i];
  let melhor = 0, menor = Infinity;
  for (let k = 0; k < 200; k++) {
    const q = pontoPista(k / 200), dist = Math.hypot(q.x - j.x, q.z - j.z);
    if (dist < menor) { menor = dist; melhor = k / 200; }
  }
  const alvo = pontoPista(melhor + sentido * 0.07);
  entrada(p, i, { x: alvo.x - j.x, y: alvo.z - j.z });
}

function corre(p, segundos, quem) {
  for (let q = 0; q < segundos * 60 && p.fase === 'jogando'; q++) { quem(p); passo(p, DT); }
}

const semManchas = p => { p.dados.manchas = []; };

test('corrida: a pista cabe na arena e os pontos da volta ficam no asfalto', () => {
  const p = partidaCom(jogo);
  assert.ok(L + R_FORA + 0.4 <= p.arena.lx && R_FORA + 0.4 <= p.arena.lz);
  for (let k = 0; k < 100; k++) {
    const q = pontoPista(k / 100);
    assert.ok(Math.abs(distPista(q.x, q.z) - R_MEIO) < 1e-9);
    assert.ok(Math.abs(Math.hypot(q.tx, q.tz) - 1) < 1e-9);
  }
  for (const m of p.dados.manchas) { const dist = distPista(m.x, m.z); assert.ok(dist > R_DENTRO && dist < R_FORA, 'mancha no asfalto'); }
  assert.deepEqual(p.dados.manchas.map(m => m.tipo).sort(), ['oleo', 'oleo', 'turbo']);
});

test('corrida: quem da 3 voltas vence e o placar conta as voltas', () => {
  const p = partidaCom(jogo); semManchas(p);
  let visto1 = false;
  corre(p, 50, p => { pilota(p, 1); visto1 ||= p.dados.placar[1] === 1; });
  assert.equal(p.vencedor, 1);
  assert.ok(visto1, 'passou por 1 volta antes de vencer');
  assert.deepEqual(p.dados.placar, [0, 3]);
  assert.equal(p.dados.progresso[1], 12);
});

test('corrida: andar na contramao nao conta volta', () => {
  const p = partidaCom(jogo); semManchas(p);
  corre(p, 20, p => pilota(p, 0, -1));
  assert.deepEqual(p.dados.progresso, [0, 0]);
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('corrida: cortar pelo miolo nao conta ponto de controle', () => {
  const p = partidaCom(jogo); semManchas(p);
  const j = p.jogadores[0];
  // atravessa o gramado do meio indo e voltando na vertical e na horizontal
  for (const [x, z] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    for (let q = 0; q < 240; q++) { entrada(p, 0, { x, y: z }); passo(p, DT); if (distPista(j.x, j.z) > R_DENTRO - 0.6) break; }
  }
  j.x = 2; j.z = 0; j.vx = j.vz = 0; p.dados.antes[0] = { x: 2, z: 0 };
  for (let volta = 0; volta < 3; volta++)
    for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) { j.x = x; j.z = z; j.vx = j.vz = 0; passo(p, DT); }
  assert.equal(p.dados.placar[0], 0);
  assert.ok(p.dados.progresso[0] <= 1, 'no maximo o primeiro ponto, pego ainda no asfalto');
});

test('corrida: a grama deixa bem mais lento que o asfalto', () => {
  const vel = (x, z) => {
    const p = partidaCom(jogo); semManchas(p);
    const j = p.jogadores[0];
    p.jogadores[1].x = -9; p.jogadores[1].z = -7.5;
    j.x = x; j.z = z; p.dados.antes[0] = { x, z };
    for (let q = 0; q < 30; q++) { entrada(p, 0, { x: 1, y: 0 }); passo(p, DT); }
    return j.vx;
  };
  const asfalto = vel(-3, R_MEIO), grama = vel(-3, 0);
  assert.ok(grama < asfalto * 0.6, `grama ${grama} asfalto ${asfalto}`);
});

test('corrida: oleo tira o controle e turbo empurra no sentido da pista', () => {
  const p = partidaCom(jogo);
  const j = p.jogadores[0];
  p.jogadores[1].x = -9; p.jogadores[1].z = -7.5;
  const q = pontoPista(0.5);                       // meio da reta de cima, sentido -x
  p.dados.manchas = [{ tipo: 'turbo', ...q }];
  j.x = q.x + 2.5; j.z = q.z; j.vx = -8; j.vz = 0; p.dados.antes[0] = { x: j.x, z: j.z };
  let maior = 0;
  for (let k = 0; k < 60; k++) { passo(p, DT); maior = Math.max(maior, -j.vx); }
  assert.ok(maior > 12, 'turbo acelerou: ' + maior);

  p.dados.manchas = [{ tipo: 'oleo', ...q }]; p.dados.sobre[0] = -1;
  j.x = q.x; j.z = q.z; j.vx = -4; j.vz = 0;
  entrada(p, 0, { x: 0, y: 1 });
  passo(p, DT); passo(p, DT);
  assert.ok(Math.abs(j.vx + 4) < 0.01, 'no oleo nao perde velocidade: ' + j.vx);
  assert.ok(j.turbo < 0.2, 'no oleo quase sem controle');
});

test('corrida: no limite de tempo vence quem tem mais progresso; parados empatam', () => {
  const p = partidaCom(jogo); semManchas(p);
  corre(p, 4, p => pilota(p, 0));
  assert.ok(p.dados.progresso[0] >= 1 && p.dados.placar[0] < 3);
  entrada(p, 0, { x: 0, y: 0 });
  roda(p, 52);
  assert.equal(p.vencedor, 0);

  const q = partidaCom(jogo);
  roda(q, 56);
  assert.equal(q.vencedor, -1);
});

test('corrida: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.ok(vencedores.length === 15);
});
