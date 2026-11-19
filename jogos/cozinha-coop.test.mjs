import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { metaDe } from './cozinha-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const NOMES = ['massa', 'tomate', 'queijo'];
const CAIXA_X = -8.3, CAIXA_Z = [-3.7, -0.4, 2.9], BALCAO = { x: 8.4, z: -0.6 };
// Roda parado ate a rodada acabar e devolve quantos segundos de jogo passaram (depois do fim o motor segue para a proxima rodada).
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// leva o jogador i até a caixa do ingrediente e depois ao balcão, andando pelo caminho real (a posição é posta e o motor roda)
function pegaEntrega(p, i, tipo) { poe(p, i, CAIXA_X + 0.6, CAIXA_Z[tipo]); roda(p, 0.1); poe(p, i, BALCAO.x - 0.5, BALCAO.z); roda(p, 0.1); }
function fecha(p, i = 0) {
  for (let k = 0; k < 400 && p.fase === 'jogando'; k++) {
    const o = p.dados.pedidos.find(q => q.feito.some(f => !f));
    if (!o) { roda(p, 0.5); continue; }
    pegaEntrega(p, i, o.total[o.feito.findIndex(f => !f)]);
  }
}

test('cozinha-coop: contrato da festa so cooperativo, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
});

test('cozinha-coop: a meta de pedidos cresce com o numero de jogadores', () => {
  assert.deepEqual([2, 3, 4].map(metaDe), [4, 5, 6]);
  for (const n of [2, 3, 4]) assert.equal(partidaCom(jogo, undefined, coop(n)).dados.meta, metaDe(n));
});

test('cozinha-coop: comeca com dois pedidos e chegam mais, no maximo quatro de uma vez', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  assert.equal(p.dados.pedidos.length, 2);
  roda(p, 30);
  assert.equal(p.dados.pedidos.length, 4);
});

test('cozinha-coop: encostar na caixa pega o ingrediente e encostar na outra troca', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  poe(p, 0, CAIXA_X + 0.6, CAIXA_Z[1]); roda(p, 0.1);
  assert.equal(p.dados.leva[0], 1);
  assert.match(p.celular[0].texto, /^Leva TOMATE/);
  roda(p, 0.6);
  poe(p, 0, CAIXA_X + 0.6, CAIXA_Z[2]); roda(p, 0.1);
  assert.equal(p.dados.leva[0], 2, 'trocou por queijo');
});

test('cozinha-coop: entrega o que o pedido pede e conta o pedido quando fica completo', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  const o = p.dados.pedidos[0];
  pegaEntrega(p, 0, o.total[0]);
  assert.equal(p.dados.leva[0], -1, 'entregou');
  assert.equal(o.feito[0], true);
  assert.equal(p.dados.entregues, 0, 'ainda falta um ingrediente');
  pegaEntrega(p, 1, o.total[1]);
  assert.equal(p.dados.entregues, 1);
  assert.deepEqual(p.dados.placar, [1]);
  assert.ok(!p.dados.pedidos.includes(o));
});

test('cozinha-coop: ingrediente que ninguem pediu fica na mao', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  p.dados.pedidos = [{ total: [1, 1], feito: [false, false], id: 99 }];
  p.dados.proximo = 99;
  pegaEntrega(p, 0, 2);
  assert.equal(p.dados.leva[0], 2, 'queijo continua na mao: nao tem pedido de queijo');
  assert.equal(p.dados.entregues, 0);
});

test('cozinha-coop: termina pelo objetivo, todos vencem e cada um leva 1 ponto', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    fecha(p);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, 2);
    assert.equal(p.dados.entregues, metaDe(n));
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
    assert.ok(p.dados.entregues >= metaDe(n));
  }
});

test('cozinha-coop: o objetivo nao fecha em menos de 5 s mesmo com a equipe perfeita', () => {
  const p = partidaCom(jogo, undefined, coop(4));
  fecha(p);
  assert.ok(p.dados.entregues >= metaDe(4));
  assert.ok(p.dados.criados >= metaDe(4), 'precisou esperar os pedidos chegarem: ' + p.dados.criados);
});

test('cozinha-coop: termina pelo tempo quando falta pedido', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  p.dados.entregues = metaDe(3) - 1;
  const t = jogaAte(p);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, -1);
  assert.ok(Math.abs(t - jogo.duracao) < 0.1, 'acabou aos ' + t);
});

test('cozinha-coop: todos parados perdem e ninguem pontua', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    jogaAte(p);
    assert.equal(p.vencedor, -1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
  }
});

test('cozinha-coop: a corrida do motor e limitada, o dash vira um arranque curto', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  Object.assign(p.jogadores[0], { vx: 30, vz: 0 });
  passo(p, DT);
  assert.ok(Math.hypot(p.jogadores[0].vx, p.jogadores[0].vz) <= 7.6);
});

test('cozinha-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('cozinha-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

// Robo lento (a crianca distraida): decide a cada 0,5 s e em 40% das vezes se distrai (anda a toa). Quando atento:
// leva o que o quadro pede ao balcao, ou vai a caixa do ingrediente que falta (sem repetir o que o amigo ja leva), em linha reta.
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ ate: 0, a: null }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 0.5;
        if (rng() < 0.4) e.a = { x: (rng() * 2 - 1) * 8, z: (rng() * 2 - 1) * 5 };
        else {
          const falta = [0, 0, 0];
          for (const o of d.pedidos) o.total.forEach((x, m) => { if (!o.feito[m]) falta[x]++; });
          d.leva.forEach((l, k) => { if (k !== i && l >= 0) falta[l]--; });
          const preciso = d.leva[i] >= 0 && d.pedidos.some(o => o.total.some((x, m) => x === d.leva[i] && !o.feito[m]));
          e.a = preciso ? BALCAO : { x: CAIXA_X, z: CAIXA_Z[Math.max(0, falta.findIndex(f => f > 0))] };
        }
      }
      const dx = e.a.x - j.x, dz = e.a.z - j.z, m = Math.hypot(dx, dz) || 1;
      entrada(p, i, { x: m < 0.5 ? 0 : dx / m, y: m < 0.5 ? 0 : dz / m, d: false, n: j.n ?? 0, nb: 0 });
    });
  };
}
function taxaLenta(n, partidas = 100) {
  let v = 0;
  for (let s = 1; s <= partidas; s++) {
    const p = partidaCom(jogo, sorteio(s), coop(n)), joga = roboLento(p, sorteio(s * 7 + 3));
    for (let q = 0; q < 75 * 60 && p.fase === 'jogando'; q++) { joga(q); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / partidas;
}

test('cozinha-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2, 3 e 4 jogadores', () => {
  assert.ok(taxaLenta(2) >= 0.85, 'n 2: ' + taxaLenta(2));
  for (const n of [3, 4]) assert.ok(taxaLenta(n, 40) >= 0.85, 'n ' + n);
});
