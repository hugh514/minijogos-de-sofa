import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, rodada, aleatorio, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { BLOCOS } from './tanques.mjs';

const LX = 11, LZ = 6.5;

// Tiro pronto, ja contando como sem quique usado (quica: 1) e sem tempo vivido.
const tiro = (x, z, vx, vz, dono = 0, quica = 1) => ({ x, z, vx, vz, dono, quica, idade: 0, vivo: true });

// Toque em A pelo celular: o contador sobe uma vez.
function toca(p, i) {
  entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 });
}

test('tanques: o joystick anda com o tanque e ele gira para onde anda', () => {
  const p = partidaCom(jogo);
  const x0 = p.jogadores[0].x;
  entrada(p, 0, { x: 0, y: 1 });
  roda(p, 0.5);
  assert.ok(p.jogadores[0].z > 1, 'desceu na tela');
  assert.ok(Math.abs(p.jogadores[0].x - x0) < 0.01, 'nao saiu de lado');
  assert.ok(Math.abs(p.dados.ang[0] - Math.PI / 2) < 0.05, 'virou para baixo: ' + p.dados.ang[0]);
  assert.equal(p.jogadores[0].vx, 0);
});

test('tanques: nao atravessa bloco nem parede, mesmo empurrando por muito tempo', () => {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) { p.jogadores[i].x = 0; p.jogadores[i].z = -5.5; }
  p.jogadores[1].x = 6;
  for (const [x, y] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1]]) {
    entrada(p, 0, { x, y }); entrada(p, 1, { x: -y, y: x });
    for (let k = 0; k < 240; k++) {
      passo(p, DT);
      for (const j of p.jogadores) {
        assert.ok(Math.abs(j.x) <= LX && Math.abs(j.z) <= LZ, 'saiu da arena');
        for (const b of BLOCOS) assert.ok(Math.abs(j.x - b.x) > b.hx - 0.1 || Math.abs(j.z - b.z) > b.hz - 0.1, 'entrou no bloco');
      }
    }
  }
});

test('tanques: A atira para onde o tanque aponta e o toque curto nao se perde', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: 0, n: 0 });
  toca(p, 0);
  passo(p, DT);
  assert.equal(p.dados.tiros.length, 1);
  const t = p.dados.tiros[0];
  assert.equal(t.dono, 0);
  assert.ok(t.vx > 5 && Math.abs(t.vz) < 0.01, 'o jogador 1 olha para a direita');
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  toca(p, 1);
  passo(p, DT);
  assert.equal(p.dados.tiros.filter(s => s.dono === 1).length, 1);
  assert.ok(p.dados.tiros.find(s => s.dono === 1).vx < -5, 'o jogador 2 olha para a esquerda');
});

test('tanques: a recarga segura o segundo tiro, e um toque pouco antes do fim dela dispara quando liberar', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: 0, n: 0 });
  toca(p, 0); passo(p, DT);
  toca(p, 0); passo(p, DT);                      // dentro da recarga e longe do fim dela: perde
  assert.equal(p.dados.disparos[0], 1);
  roda(p, 0.55);
  toca(p, 0); passo(p, DT);                      // perto do fim da recarga: fica guardado
  assert.equal(p.dados.disparos[0], 1);
  roda(p, 0.4);
  assert.equal(p.dados.disparos[0], 2);
  // dois toques no mesmo quadro nao dao dois tiros
  const q = partidaCom(jogo);
  entrada(q, 0, { x: 0, y: 0, n: 0 });
  entrada(q, 0, { x: 0, y: 0, n: 2 });
  passo(q, DT);
  assert.equal(q.dados.disparos[0], 1);
});

test('tanques: o tiro quica uma vez na parede e some no segundo choque', () => {
  const p = partidaCom(jogo);
  p.jogadores[0].z = 5; p.jogadores[1].z = 5;     // fora da linha do tiro
  p.dados.tiros = [tiro(9, -5.5, 14, 0)];
  roda(p, 0.4);
  const t = p.dados.tiros[0];
  assert.ok(t.vx < 0 && t.quica === 0, 'voltou da parede');
  assert.ok(t.x <= LX);
  roda(p, 1.6);
  assert.equal(p.dados.tiros.length, 0, 'sumiu no segundo choque');
});

test('tanques: o tiro quica no bloco de cobertura', () => {
  const p = partidaCom(jogo);
  const b = BLOCOS[0];
  p.dados.tiros = [tiro(b.x - b.hx - 2, b.z, 14, 0)];
  roda(p, 0.3);
  const t = p.dados.tiros[0];
  assert.ok(t.vx < 0, 'voltou do bloco');
  assert.ok(t.x < b.x - b.hx, 'ficou do lado de fora do bloco');
});

test('tanques: o tiro tira 1 vida do outro, com imunidade curta, e o tanque nao morre com 1 acerto', () => {
  const p = partidaCom(jogo);
  const alvo = p.jogadores[1];
  p.dados.tiros = [tiro(alvo.x - 3, alvo.z + 0.2, 14, 0, 0)];
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [3, 2]);
  assert.equal(p.dados.tiros.length, 0);
  p.dados.tiros = [tiro(alvo.x - 3, alvo.z, 14, 0, 0)];
  roda(p, 0.3);
  assert.deepEqual(p.dados.placar, [3, 2], 'imune logo depois do acerto');
  assert.equal(p.fase, 'jogando');
});

test('tanques: o proprio tiro nao fere quem atirou', () => {
  const p = partidaCom(jogo);
  const eu = p.jogadores[0];
  p.dados.tiros = [tiro(eu.x + 1.2, eu.z, -14, 0, 0, 1)];   // vai bater na parede e voltar por cima de mim
  roda(p, 1.5);
  assert.deepEqual(p.dados.placar, [3, 3]);
});

test('tanques: a ultima vida zerada da a vitoria ao outro lado (jogador 1 vence)', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [3, 1];
  const alvo = p.jogadores[1];
  p.dados.tiros = [tiro(alvo.x - 3, alvo.z, 14, 0, 0)];
  roda(p, 0.5);
  assert.equal(p.vencedor, 0);
  assert.equal(alvo.vivo, false, 'o tanque derrotado voa');
});

test('tanques: a ultima vida zerada da a vitoria ao outro lado (jogador 2 vence)', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [1, 3];
  const alvo = p.jogadores[0];
  p.dados.tiros = [tiro(alvo.x + 3, alvo.z, -14, 0, 1)];
  roda(p, 0.5);
  assert.equal(p.vencedor, 1);
});

test('tanques: dois acertos na mesma ultima vida empatam', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [1, 1];
  p.dados.tiros = [tiro(p.jogadores[1].x - 3, 0, 14, 0, 0), tiro(p.jogadores[0].x + 3, 0, -14, 0, 1)];
  roda(p, 0.5);
  assert.equal(p.vencedor, -1);
});

test('tanques: no limite de tempo vence quem tem mais vida; igual empata', () => {
  let p = partidaCom(jogo);
  roda(p, 46);
  assert.equal(p.vencedor, -1);
  p = partidaCom(jogo);
  p.dados.placar = [2, 3];
  roda(p, 44);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo);
  p.dados.placar = [3, 1];
  roda(p, 46);
  assert.equal(p.vencedor, 0);
});

test('tanques: tiro nunca sai da arena nem entra em bloco, com dedos aleatorios', () => {
  for (let s = 1; s <= 8; s++) {
    let maior = 0;
    const { p } = rodada(jogo, (p, q, rng) => {
      aleatorio(p, q, rng);
      if (q % 20 === 0) for (const i of [0, 1]) entrada(p, i, { x: (rng() * 2 - 1), y: rng() * 2 - 1, n: (p.jogadores[i].n ?? 0) + 1 });
      for (const t of p.dados.tiros) {
        maior = Math.max(maior, t.vivo ? 1 : 0);
        assert.ok(Math.abs(t.x) <= LX && Math.abs(t.z) <= LZ, 'tiro fora da arena: ' + t.x + ', ' + t.z);
        for (const b of BLOCOS) assert.ok(Math.abs(t.x - b.x) > b.hx - 0.05 || Math.abs(t.z - b.z) > b.hz - 0.05, 'tiro dentro do bloco');
      }
    }, s);
    assert.ok(maior > 0 && p.dados.disparos[0] + p.dados.disparos[1] > 0, 'houve tiros');
  }
});

test('tanques: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});
