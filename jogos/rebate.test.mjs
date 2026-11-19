import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, rodada, aleatorio, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './rebate.mjs';

const LX = 6.5, LZ = 9;           // quadra deitada: gols nas laterais (z), a raquete corre no eixo x

// Bola pronta em movimento (sem pausa de saque).
const bola = (x, z, vx, vz) => ({ x, z, vx, vz, pausa: 0, dono: -1, som: 0 });

// Partida so com as bolas dadas, muitas vidas e sem entrada de bola nova.
function com(...bolas) {
  const p = partidaCom(jogo);
  p.dados.bolas = bolas; p.dados.placar = [99, 99]; p.dados.proxBola = Infinity;
  return p;
}

test('rebate: a quadra esta deitada: gols nas laterais da tela e a raquete sobe e desce com o joystick vertical', () => {
  const p = com();
  const z0 = p.jogadores[0].z;
  assert.ok(p.jogadores[0].z < -7 && p.jogadores[1].z > 7, 'o Jogador 1 defende a lateral esquerda (z negativo, camera em -x), o 2 a direita');
  entrada(p, 0, { x: 1, y: -1 });          // joystick para cima: a raquete sobe na tela (x cresce)
  roda(p, 3);
  assert.ok(p.jogadores[0].x > 3.5 && p.jogadores[0].x <= LX - 1.5 + 1e-9, 'subiu ate a parede: ' + p.jogadores[0].x);
  assert.equal(p.jogadores[0].z, z0, 'nao sai da linha de defesa');
  entrada(p, 0, { x: 0, y: 1 });
  roda(p, 4);
  assert.ok(p.jogadores[0].x < -3.5 && p.jogadores[0].x >= -(LX - 1.5) - 1e-9);
  const q = com();
  entrada(q, 0, { x: 1, y: 0 });           // so de lado no joystick nao mexe: o eixo agora e vertical
  roda(q, 1);
  assert.equal(q.jogadores[0].x, 0);
});

test('rebate: a camera olha a quadra de lado, com o Jogador 1 a esquerda', () => {
  const c = jogo.camera();
  assert.ok(c.x < -8 && Math.abs(c.z) < 1, 'camera no eixo dos gols, do lado do -x');
  assert.ok(c.y > 8, 'e alta o bastante para ver tudo');
});

test('rebate: a bola que bate na raquete volta e acelera', () => {
  const p = com(bola(0, -6, 0, -8));          // vai para o gol do jogador 1 (z negativo), raquete parada no centro
  roda(p, 0.5);
  const b = p.dados.bolas[0];
  assert.ok(b.vz > 0, 'voltou');
  assert.deepEqual(p.dados.placar, [99, 99]);
  assert.ok(Math.hypot(b.vx, b.vz) > 8, 'ficou mais rapida');
  assert.equal(b.dono, 0);
});

test('rebate: a bola que passa tira 1 vida de quem defendia e volta ao centro', () => {
  const p = com(bola(5.5, -6, 0, -10));          // longe da raquete
  roda(p, 0.6);
  assert.deepEqual(p.dados.placar, [98, 99]);
  const b = p.dados.bolas[0];
  assert.ok(b.pausa > 0 && b.x === 0 && b.z === 0, 'saque do centro');
  const q = com(bola(-5.5, 6, 0, 10));
  roda(q, 0.6);
  assert.deepEqual(q.dados.placar, [99, 98]);
});

test('rebate: o golpe forte (A) manda a bola bem mais rapido, so uma vez por recarga', () => {
  const p = com(bola(0, -6.6, 0, -8));
  entrada(p, 0, { x: 0, y: 0, n: 0 });
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  roda(p, 0.5);
  const forte = Math.hypot(p.dados.bolas[0].vx, p.dados.bolas[0].vz);
  const q = com(bola(0, -6.6, 0, -8));
  roda(q, 0.5);
  const normal = Math.hypot(q.dados.bolas[0].vx, q.dados.bolas[0].vz);
  assert.ok(forte > normal * 1.3, `forte ${forte} normal ${normal}`);
  assert.ok(forte <= 25 + 1e-9);
  // recarga: segundo toque logo depois nao dispara
  p.dados.bolas = [];
  entrada(p, 0, { x: 0, y: 0, n: 2 });
  passo(p, DT);
  assert.equal(p.dados.golpe[0], 0);
});

test('rebate: toque curto de A nao se perde (varios toques no mesmo quadro tambem)', () => {
  const p = com();
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  entrada(p, 1, { x: 0, y: 0, n: 1 });
  passo(p, DT);
  assert.ok(p.dados.golpe[1] > 0, 'golpe ativo apos um toque de um quadro');
  assert.equal(p.dados.golpe[0], 0);
});

test('rebate: a cada 6 s entra uma bola, ate 4', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [999, 999];
  assert.equal(p.dados.bolas.length, 1);
  roda(p, 5.8);
  assert.equal(p.dados.bolas.length, 1);
  roda(p, 0.4);
  assert.equal(p.dados.bolas.length, 2);
  roda(p, 6);
  assert.equal(p.dados.bolas.length, 3);
  roda(p, 6);
  assert.equal(p.dados.bolas.length, 4);
  roda(p, 12);
  assert.equal(p.dados.bolas.length, 4, 'no maximo 4');
});

test('rebate: zerar as vidas do jogador 2 da a vitoria ao jogador 1 (e o contrario)', () => {
  const p = com(bola(5.5, 6, 0, 10));
  p.dados.placar = [5, 1];
  roda(p, 0.6);
  assert.equal(p.vencedor, 0);
  const q = com(bola(-5.5, -6, 0, -10));
  q.dados.placar = [1, 5];
  roda(q, 0.6);
  assert.equal(q.vencedor, 1);
});

test('rebate: duas bolas no gol no mesmo instante, ultima vida de cada um, empatam', () => {
  const p = com(bola(5.5, 6, 0, 10), bola(-5.5, -6, 0, -10));
  p.dados.placar = [1, 1];
  roda(p, 0.6);
  assert.equal(p.vencedor, -1);
});

test('rebate: no limite de tempo vence quem tem mais vidas; igual empata', () => {
  let p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.proxBola = Infinity;
  roda(p, 46);
  assert.equal(p.vencedor, undefined, 'igual: morte subita');
  roda(p, 10);
  assert.equal(p.vencedor, -1, 'sem gol na morte subita, empata');
  p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.proxBola = Infinity; p.dados.placar = [3, 5];
  roda(p, 44);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.proxBola = Infinity; p.dados.placar = [5, 4];
  roda(p, 46);
  assert.equal(p.vencedor, 0);
});

test('rebate: bola nunca sai da arena, com varias bolas e dedos aleatorios', () => {
  for (let s = 1; s <= 8; s++) {
    let max = 0;
    rodada(jogo, (p, q, rng) => {
      aleatorio(p, q, rng);
      if (q % 15 === 0) for (const i of [0, 1]) entrada(p, i, { x: rng() * 2 - 1, y: 0, n: (p.jogadores[i].n ?? 0) + 1 });
      max = Math.max(max, p.dados.bolas.length);
      for (const b of p.dados.bolas) {
        assert.ok(Math.abs(b.x) <= LX && Math.abs(b.z) <= LZ, `bola fora da arena: ${b.x}, ${b.z}`);
        assert.ok(Number.isFinite(b.vx) && Number.isFinite(b.vz));
      }
    }, s);
  }
});

test('rebate: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});

test('rebate: com as 4 bolas em jogo por muito tempo, nenhuma sai da arena nem fica parada', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [9999, 9999];
  const rng = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  let quatro = 0;
  for (let q = 0; q < 60 * 40; q++) {
    aleatorio(p, q, rng);
    passo(p, DT);
    if (p.dados.bolas.length === 4) quatro++;
    for (const b of p.dados.bolas) {
      assert.ok(Math.abs(b.x) <= LX && Math.abs(b.z) <= LZ, `bola fora da arena: ${b.x}, ${b.z}`);
      if (b.pausa <= 0) assert.ok(Math.hypot(b.vx, b.vz) >= 7.4 && Math.hypot(b.vx, b.vz) <= 25.01, 'velocidade ' + Math.hypot(b.vx, b.vz));
    }
  }
  assert.ok(quatro > 60 * 15, 'ficou com 4 bolas');
});

test('rebate: empate no tempo vai para morte subita: o proximo gol decide', () => {
  const p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.proxBola = Infinity;
  roda(p, 46);
  assert.equal(p.vencedor, undefined, 'empatado, nao fecha');
  assert.match(p.dados.aviso, /Morte súbita/);
  p.dados.bolas = [bola(0, -8.9, 0, -9)];      // gol sofrido pelo jogador 1 (raquete fora do caminho)
  p.jogadores[0].x = 5;
  roda(p, 1);
  assert.equal(p.vencedor, 1);
});

test('rebate: a morte subita tem fim e termina em empate se ninguem faz gol', () => {
  const p = partidaCom(jogo);
  p.dados.bolas = []; p.dados.proxBola = Infinity;
  roda(p, 54);
  assert.equal(p.vencedor, undefined);
  roda(p, 2);
  assert.equal(p.vencedor, -1);
});

test('rebate: o celular explica o controle em uma linha', () => {
  const p = partidaCom(jogo);
  assert.match(p.celular[0].texto, /sobe e desce/);
});
