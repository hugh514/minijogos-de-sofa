import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { GRACA } from './ponte-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0, y: 0, vy: 0 });
// Roda parado ate a rodada acabar e devolve quantos segundos de jogo passaram.
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
// Um quadro com o joystick, A segurado e um toque de pulo opcional.
function dedo(p, i, { x = 0, y = 0, a = false, pula = false } = {}) {
  const j = p.jogadores[i], nb = (j.nb ?? 0) + (pula ? 1 : 0);
  entrada(p, i, { x, y, d: a, n: j.n ?? 0, b: false, nb });
}
const alinha = (p, xs, z = 0) => {
  xs.forEach((x, k) => Object.assign(p.dados.tabuas[k], { x, z, vx: 0, vz: 1.5, trava: 0 }));
  p.dados.tabuas.slice(xs.length).forEach(t => { t.z = 40; t.trava = 0; });
};

test('ponte-coop: contrato da festa so cooperativo, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
});

test('ponte-coop: todos comecam na margem esquerda, com 4 tabuas para 2 e 5 para 3 ou 4', () => {
  for (const [n, tabuas] of [[2, 4], [3, 5], [4, 5]]) {
    const p = partidaCom(jogo, undefined, coop(n));
    assert.equal(p.dados.tabuas.length, tabuas);
    assert.ok(p.jogadores.every(j => j.x < -6), 'todos a esquerda');
  }
});

test('ponte-coop: a porteira fechada segura todo mundo ate 5 s', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  alinha(p, [-1.6, 0.9]);
  poe(p, 0, 9, 0); poe(p, 1, 8, 2);
  roda(p, 1);
  assert.ok(p.jogadores.every(j => j.x < 4.3), 'preso antes da porteira: ' + p.jogadores[0].x);
  assert.deepEqual(p.dados.chegou, [false, false]);
  assert.equal(p.fase, 'jogando');
});

test('ponte-coop: termina pelo objetivo quando todos chegam a outra margem, 1 ponto para cada', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    roda(p, 5.2);
    p.jogadores.forEach((_, i) => poe(p, i, 7.5, (i - 1.5) * 2));
    roda(p, 0.2);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, 2);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
  }
});

test('ponte-coop: so um na outra margem nao basta, e quem chegou continua contando', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  roda(p, 5.2);
  poe(p, 0, 7.5, 0); roda(p, 0.1);
  assert.deepEqual(p.dados.placar, [1]);
  assert.equal(p.fase, 'jogando');
  poe(p, 0, -8, 0); roda(p, 0.1);
  assert.deepEqual(p.dados.chegou, [true, false, false]);
});

test('ponte-coop: termina pelo tempo com alguem faltando e a equipe perde', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  roda(p, 5.2);
  poe(p, 0, 7.5, 0); poe(p, 1, 7.5, 2);
  jogaAte(p);
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0]);
});

test('ponte-coop: todos parados perdem aos 40 s', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    const t = jogaAte(p);
    assert.equal(p.vencedor, -1);
    assert.ok(Math.abs(t - jogo.duracao) < 0.1, 'acabou aos ' + t);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
  }
});

test('ponte-coop: cair na agua nao elimina, volta para a margem esquerda em 1 s', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  alinha(p, []);
  poe(p, 0, 0, 0);
  roda(p, 0.1);
  assert.ok(p.dados.agua[0] > 0, 'caiu');
  assert.match(p.celular[0].texto, /^Na água! Volta em [12] s/);
  assert.equal(p.jogadores[0].vivo, true);
  roda(p, 1.7);
  assert.equal(p.dados.agua[0], 0);
  assert.ok(p.jogadores[0].x < -6, 'voltou para a esquerda: ' + p.jogadores[0].x);
  assert.equal(p.fase, 'jogando');
});

test('ponte-coop: em cima da tabua nao cai, e a correnteza leva a tabua e quem esta nela', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  alinha(p, [-1.6], -3);
  poe(p, 0, -1.6, -3);
  roda(p, 1);
  assert.equal(p.dados.agua[0], 0, 'nao caiu');
  assert.ok(p.jogadores[0].z > -2, 'foi junto com a correnteza: ' + p.jogadores[0].z);
});

test('ponte-coop: segurar A trava as tabuas ao alcance e elas soltam depois da graca', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  alinha(p, [-1.6], -3);
  const z0 = p.dados.tabuas[0].z;
  for (let k = 0; k < 60; k++) { dedo(p, 0, { a: true }); poe(p, 0, -5.5, -3); passo(p, DT); }
  assert.ok(Math.abs(p.dados.tabuas[0].z - z0) < 0.01, 'travada');
  assert.equal(p.dados.tabuas[0].segura, true);
  for (let k = 0; k < (GRACA + 1.5) * 60; k++) { dedo(p, 0, { a: false }); poe(p, 0, -5.5, -3); passo(p, DT); }
  assert.ok(p.dados.tabuas[0].z > z0 + 0.5, 'a graca acabou e ela soltou: ' + p.dados.tabuas[0].z);
  assert.equal(p.dados.tabuas[0].segura, false);
});

test('ponte-coop: encostar numa tabua solta a empurra', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  alinha(p, [-1.9], 0); p.dados.tabuas[0].vz = 0;
  poe(p, 0, -4.7, 0);
  for (let k = 0; k < 30; k++) { dedo(p, 0, { x: 1 }); passo(p, DT); }
  assert.ok(p.dados.tabuas[0].x > -1.8, 'a tabua andou para a direita: ' + p.dados.tabuas[0].x);
});

test('ponte-coop: um segura enquanto o outro passa (ponte de duas tabuas, pulo no fim)', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  roda(p, 5.2);
  alinha(p, [-1.6, 0.9]);
  poe(p, 0, -1.6, -0.9);   // quem segura fica em cima da primeira tabua, de lado para nao travar o caminho
  poe(p, 1, -6, 0.9);
  let pulou = false;
  for (let k = 0; k < 60 * 6 && !p.dados.chegou[1]; k++) {
    dedo(p, 0, { a: true });
    const pula = !pulou && p.jogadores[1].x > 1.9;
    if (pula) pulou = true;
    dedo(p, 1, { x: 1, pula });
    passo(p, DT);
  }
  assert.equal(p.dados.chegou[1], true, 'o jogador 2 atravessou: x ' + p.jogadores[1].x);
  assert.equal(p.dados.agua[1], 0);
  assert.equal(p.fase, 'jogando', 'o jogador 1 ainda precisa passar');
  // solta A e corre: a graca de 2 s trava a ponte enquanto ele passa
  let pulou0 = false;
  for (let k = 0; k < 60 * 4 && p.fase === 'jogando'; k++) {
    const pula = !pulou0 && p.jogadores[0].x > 1.9;
    if (pula) pulou0 = true;
    dedo(p, 0, { x: 1, pula }); dedo(p, 1, {});
    passo(p, DT);
  }
  assert.equal(p.vencedor, 2);
});

test('ponte-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('ponte-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

// Robo lento (a crianca distraida): decide a cada 0,5 s e em 40% das vezes se distrai (anda a toa, sem segurar A).
// Quando atento: segura A, sobe na tabua mais perto da margem e vai de tabua em tabua para a direita, pulando os vaos.
const emCimaDe = (pk, j) => Math.abs(j.x - pk.x) < 1.95 && Math.abs(j.z - pk.z) < 1.7;
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ ate: 0, a: null, nb: 0, pula: false, solta: false }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (d.agua[i] > 0 || d.chegou[i]) { entrada(p, i, { x: 0, y: 0, d: false, n: 0, b: false, nb: e.nb }); return; }
      if (t >= e.ate) {
        e.ate = t + 0.5; e.a = null; e.pula = false; e.solta = false;
        if (rng() < 0.4) { e.a = { x: j.x + (rng() * 2 - 1) * 3, z: j.z + (rng() * 2 - 1) * 3 }; e.solta = true; }
        else {
          const atual = d.tabuas.find(pk => emCimaDe(pk, j)), perto = (pk, m) => Math.hypot(pk.x - j.x, pk.z - j.z) < m;
          if (j.x > 3.0) e.a = { x: 7, z: j.z };
          else if (atual) {
            const seguintes = d.tabuas.filter(pk => pk !== atual && pk.x >= atual.x + 0.5).sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z));
            if (seguintes.length) { e.a = { x: seguintes[0].x, z: seguintes[0].z }; e.pula = !perto(seguintes[0], 1.2) && perto(seguintes[0], 5); }
            else if (atual.x > 0.3) { e.a = { x: 5, z: atual.z }; e.pula = true; }
            else e.a = { x: j.x, z: j.z };
          } else {
            const melhor = d.tabuas.filter(pk => pk.x < 1.9).sort((a, b) => (Math.abs(a.z - j.z) + Math.abs(a.x + 3) * 0.3) - (Math.abs(b.z - j.z) + Math.abs(b.x + 3) * 0.3))[0];
            const alinhado = melhor && Math.abs(melhor.z - j.z) < 1;
            e.a = !melhor ? { x: -4.3, z: j.z } : alinhado ? { x: melhor.x, z: melhor.z } : { x: -4.3, z: melhor.z };
            e.pula = !!alinhado && j.x > -5;
          }
        }
        if (e.pula) e.nb++;
      }
      const dx = e.a.x - j.x, dz = e.a.z - j.z, m = Math.hypot(dx, dz) || 1;
      entrada(p, i, { x: m < 0.3 ? 0 : dx / m, y: m < 0.3 ? 0 : dz / m, d: !e.solta, n: j.n ?? 0, b: false, nb: e.nb });
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

test('ponte-coop: robo lento (distraido 40% do tempo) vence 85% ou mais com 2 jogadores e a maioria com 3 e 4', () => {
  assert.ok(taxaLenta(2) >= 0.85, 'n 2: ' + taxaLenta(2));
  for (const n of [3, 4]) assert.ok(taxaLenta(n, 40) >= 0.7, 'n ' + n);
});
