import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { vidaDaTorre, TR } from './defesa-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// Roda parado ate a rodada acabar e devolve quantos segundos de jogo passaram.
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
const bicho = (x, z, extra = {}) => ({ x, z, kx: 0, kz: 0, hp: 2, rapido: false, tonto: 0, fase: 0, ang: 0, ...extra });
// Guarda: anda ate o besouro mais perto da torre e empurra quando ele esta a menos de 2,5 m.
function guarda(p) {
  const d = p.dados;
  p.jogadores.forEach((j, i) => {
    const alvo = [...d.bichos].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[(i % 2)] ?? null;
    let x = 0, y = 0, a = false;
    if (alvo) {
      const dx = alvo.x - j.x, dz = alvo.z - j.z, m = Math.hypot(dx, dz) || 1;
      x = dx / m; y = dz / m; a = m < 2.4;
    }
    entrada(p, i, { x, y, d: a, n: (j.n ?? 0) + (a ? 1 : 0), b: false, nb: j.nb ?? 0 });
    if (a) j.n = (j.n ?? 0) + 1;
  });
}

test('defesa-coop: contrato da festa so cooperativo, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
});

test('defesa-coop: a vida da torre cresce com o numero de jogadores', () => {
  assert.deepEqual([2, 3, 4].map(vidaDaTorre), [22, 25, 28]);
  for (const n of [2, 3, 4]) assert.equal(partidaCom(jogo, undefined, coop(n)).dados.torre, vidaDaTorre(n));
});

test('defesa-coop: o empurrao joga o besouro para longe e deixa tonto; o segundo golpe derruba', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  p.dados.proximo = 99; p.dados.bichos = [bicho(5, 0)];
  poe(p, 0, 3.5, 0);
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 }); entrada(p, 0, { x: 0, y: 0, d: true, n: 1 });
  roda(p, 0.1);
  const b = p.dados.bichos[0];
  assert.equal(b.hp, 1);
  assert.ok(b.x > 5.5, 'voou para longe: ' + b.x);
  assert.ok(b.tonto > 0.5, 'tonto');
  roda(p, 1.2);
  entrada(p, 0, { x: 0, y: 0, d: false, n: 1 }); entrada(p, 0, { x: 0, y: 0, d: true, n: 2 });
  poe(p, 0, p.dados.bichos[0].x - 1.5, p.dados.bichos[0].z);
  roda(p, 0.1);
  assert.equal(p.dados.bichos.length, 0, 'derrubado');
  assert.equal(p.dados.derrubou[0], 1);
  assert.match(p.celular[0].texto, /Você derrubou 1$/);
});

test('defesa-coop: besouro que chega na torre tira uma vida e some', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  p.dados.proximo = 99; p.dados.bichos = [bicho(TR + 0.3, 0)];
  roda(p, 0.1);
  assert.equal(p.dados.torre, vidaDaTorre(2) - 1);
  assert.equal(p.dados.bichos.length, 0);
  assert.deepEqual(p.dados.placar, [vidaDaTorre(2) - 1]);
});

test('defesa-coop: a torre e solida para os jogadores', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  p.dados.proximo = 99; p.dados.bichos = [];
  poe(p, 0, 0.2, 0.1);
  roda(p, 0.1);
  assert.ok(Math.hypot(p.jogadores[0].x, p.jogadores[0].z) >= TR + 0.7);
});

test('defesa-coop: termina pelo objetivo, aguentar 40 s com a torre em pe vence para todos', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  p.dados.proximo = 999; p.dados.ondas = 3; p.dados.bichos = [];
  const t = jogaAte(p);
  assert.equal(p.vencedor, 2);
  assert.ok(Math.abs(t - jogo.duracao) < 0.1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1]);
});

test('defesa-coop: torre sem vida e derrota para todos', () => {
  const p = partidaCom(jogo, undefined, coop(4));
  p.dados.proximo = 99; p.dados.torre = 1; p.dados.bichos = [bicho(TR + 0.3, 0)];
  roda(p, 0.1);
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0]);
});

test('defesa-coop: todos parados perdem antes dos 40 s e nao antes de 5 s', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    const t = jogaAte(p);
    assert.equal(p.vencedor, -1, 'n ' + n);
    assert.ok(t > 5 && t < jogo.duracao, `n ${n}: caiu aos ${t}`);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
  }
});

test('defesa-coop: tres bandos chegam aos 10, 20 e 30 s', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  p.dados.torre = 999; p.dados.torreMax = 999;
  roda(p, 10.2);
  assert.equal(p.dados.ondas, 1);
  roda(p, 20);
  assert.equal(p.dados.ondas, 3);
});

test('defesa-coop: uma equipe que joga bem aguenta os 40 s (guardas automaticos, 12 sementes por tamanho)', () => {
  for (const n of [2, 3, 4]) {
    let vitorias = 0;
    for (let s = 1; s <= 12; s++) {
      const p = partidaCom(jogo, sorteio(s), coop(n));
      for (let q = 0; q < 60 * 41 && p.fase === 'jogando'; q++) { guarda(p); passo(p, DT); }
      if (p.vencedor === 2) vitorias++;
    }
    assert.ok(vitorias >= 8, `n ${n}: so ${vitorias} vitorias de 12`);
  }
});

test('defesa-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('defesa-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

// Robo lento (a crianca distraida): decide a cada 0,5 s e em 40% das vezes se distrai (para ou anda a toa).
// Quando atento: anda ate o besouro mais perto e empurra se ele esta a menos de 2,4 m, sem otimizar rota.
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ ate: 0, x: 0, y: 0, n: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 0.5; e.x = e.y = 0;
        if (rng() < 0.4) { if (rng() < 0.5) { const a = rng() * 6.283; e.x = Math.cos(a); e.y = Math.sin(a); } }
        else {
          const alvo = [...d.bichos].sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z))[0];
          if (alvo) {
            const dx = alvo.x - j.x, dz = alvo.z - j.z, m = Math.hypot(dx, dz) || 1;
            e.x = dx / m; e.y = dz / m;
            if (m < 2.4) e.n++;
          }
        }
      }
      entrada(p, i, { x: e.x, y: e.y, d: false, n: e.n, b: false, nb: 0 });
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

test('defesa-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2, 3 e 4 jogadores', () => {
  assert.ok(taxaLenta(2) >= 0.85, 'n 2: ' + taxaLenta(2));
  for (const n of [3, 4]) assert.ok(taxaLenta(n, 40) >= 0.85, 'n ' + n);
});
