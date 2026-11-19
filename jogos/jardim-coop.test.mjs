import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { metaDe, tempoBroto, FONTE, CANTEIROS, R_REGA, LX, LZ } from './jardim-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
// toque no botao Regar pelo contador, como o celular faz
function toca(p, i) {
  const j = p.jogadores[i];
  if (j.n === undefined) entrada(p, i, { n: 0 });
  entrada(p, i, { n: j.n + 1 });
  passo(p, DT);
}
const enche = (p, i) => { poe(p, i, FONTE.x + 1, FONTE.z); roda(p, 0.4); };
const regaFlor = (p, i, k) => { poe(p, i, CANTEIROS[k].x, CANTEIROS[k].z + 1.2); toca(p, i); };
// a equipe perfeita: um enche e rega, o outro enche e completa
function abre(p, k, a = 0, b = 1) { enche(p, a); regaFlor(p, a, k); enche(p, b); regaFlor(p, b, k); }
function novaNoite(p, noite) { p.noites = { jogadas: noite, vencidas: 0 }; jogo.inicia(p); return p; }
const SUJO = /[–—]|\p{Extended_Pictographic}/u;
function limpo(texto) {
  assert.ok(!SUJO.test(texto), 'travessao ou emoji: ' + texto);
  assert.ok(!/\b[A-Z]{4,}\b/.test(texto.replace(/Regar/g, '')), 'caixa alta crua: ' + texto);
  assert.ok(!/undefined|NaN|null/.test(texto), texto);
}

test('jardim-coop: contrato da festa so cooperativo, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.ok(['corrida', 'mira', 'reflexo'].includes(jogo.genero));
  limpo(jogo.dica); limpo(jogo.nome);
  assert.match(jogo.dica, /Regar/);
  assert.equal(jogo.controle.a, 'Regar');
});

test('jardim-coop: a meta cresce com os jogadores e com a noite, e o broto seca mais depressa', () => {
  assert.ok(metaDe(3) > metaDe(2) && metaDe(4) > metaDe(3));
  for (const n of [2, 3, 4]) {
    assert.ok(metaDe(n, 4) > metaDe(n, 0));
    for (let k = 1; k <= 4; k++) assert.ok(metaDe(n, k) >= metaDe(n, k - 1));
  }
  assert.ok(tempoBroto(4) < tempoBroto(0));
  for (const n of [2, 3, 4]) assert.equal(partidaCom(jogo, undefined, coop(n)).dados.meta, metaDe(n));
  for (const noite of [0, 2, 4]) assert.equal(novaNoite(partidaCom(jogo, undefined, coop(2)), noite).dados.meta, metaDe(2, noite));
});

test('jardim-coop: comeca com todos os canteiros secos e os regadores vazios', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  roda(p, 0.1);
  assert.equal(p.dados.flores.length, CANTEIROS.length);
  assert.ok(p.dados.flores.every(f => f.est === 0));
  assert.deepEqual(p.dados.agua, [false, false, false]);
  assert.match(p.celular[0].texto, /fonte/);
});

test('jardim-coop: encostar na fonte enche o regador', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  poe(p, 0, FONTE.x + 1, FONTE.z); roda(p, 0.5);
  assert.equal(p.dados.agua[0], true);
  assert.equal(p.dados.agua[1], false, 'o outro nao enche de longe');
});

test('jardim-coop: regar com o regador vazio nao faz nada', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  regaFlor(p, 0, 0);
  assert.equal(p.dados.flores[0].est, 0);
});

test('jardim-coop: a primeira agua deixa um broto da cor de quem regou e esvazia o regador', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  enche(p, 1); regaFlor(p, 1, 2);
  const f = p.dados.flores[2];
  assert.equal(f.est, 1); assert.equal(f.por, 1);
  assert.equal(p.dados.agua[1], false);
  assert.equal(p.dados.abertas, 0);
});

test('jardim-coop: a regra da cooperacao, quem regou nao completa a propria flor', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  enche(p, 0); regaFlor(p, 0, 1);
  enche(p, 0); regaFlor(p, 0, 1);
  assert.equal(p.dados.flores[1].est, 1, 'a mesma pessoa nao abre a flor sozinha');
  assert.equal(p.dados.abertas, 0);
  assert.equal(p.dados.agua[0], true, 'a agua nao foi gasta a toa');
});

test('jardim-coop: a agua do amigo abre a flor, conta no placar e as duas cores ficam guardadas', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  abre(p, 3);
  const f = p.dados.flores[3];
  assert.equal(f.est, 2); assert.equal(f.por, 0); assert.equal(f.por2, 1);
  assert.equal(p.dados.abertas, 1);
  assert.deepEqual(p.dados.placar, [1]);
  assert.deepEqual(p.dados.agua, [false, false]);
});

test('jardim-coop: o aperto vai para o broto do amigo antes de uma flor seca', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  enche(p, 0); regaFlor(p, 0, 0);
  enche(p, 1);
  poe(p, 1, (CANTEIROS[0].x + CANTEIROS[2].x) / 2, CANTEIROS[0].z + 1.4);        // entre o broto e um canteiro seco, perto dos dois
  assert.ok(Math.hypot(p.jogadores[1].x - CANTEIROS[2].x, p.jogadores[1].z - CANTEIROS[2].z) <= R_REGA);
  toca(p, 1);
  assert.equal(p.dados.flores[0].est, 2, 'completou o broto');
  assert.equal(p.dados.flores[2].est, 0);
});

test('jardim-coop: o broto que ninguem completa seca de novo', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  enche(p, 0); regaFlor(p, 0, 4);
  roda(p, tempoBroto(0) - 1); assert.equal(p.dados.flores[4].est, 1);
  roda(p, 1.5); assert.equal(p.dados.flores[4].est, 0);
});

test('jardim-coop: a flor aberta conta e depois volta a ser canteiro para a proxima', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  abre(p, 5); roda(p, 2);
  assert.equal(p.dados.flores[5].est, 0);
  assert.equal(p.dados.abertas, 1, 'a flor aberta nao perde o ponto');
});

test('jardim-coop: termina pelo objetivo, todos vencem e cada um leva 1 ponto (2, 3 e 4 jogadores)', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    for (let k = 0; p.fase === 'jogando' && k < 100; k++) abre(p, k % CANTEIROS.length, k % n, (k + 1) % n);
    assert.equal(p.fase, 'resultado', 'n ' + n);
    assert.equal(p.vencedor, 2);
    assert.equal(p.dados.abertas, metaDe(n));
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
    assert.ok(p.dados.aviso.length > 0);
    p.jogadores.forEach((_, i) => { assert.ok(p.celular[i].texto.length > 0); limpo(p.celular[i].texto); });
    limpo(p.dados.aviso);
  }
});

test('jardim-coop: termina pelo tempo quando faltam flores, e todos parados perdem sem pontos', () => {
  const p = partidaCom(jogo, undefined, coop(3));
  p.dados.abertas = metaDe(3) - 1;
  const t = jogaAte(p);
  assert.equal(p.fase, 'resultado'); assert.equal(p.vencedor, -1);
  assert.ok(Math.abs(t - jogo.duracao) < 0.1, 'acabou aos ' + t);
  for (const n of [2, 3, 4]) {
    const q = partidaCom(jogo, undefined, coop(n));
    jogaAte(q);
    assert.equal(q.vencedor, -1);
    assert.deepEqual(q.jogadores.map(j => j.pontos), Array(n).fill(0));
    q.jogadores.forEach((_, i) => limpo(q.celular[i].texto));
    limpo(q.dados.aviso);
  }
});

test('jardim-coop: o celular diz o que fazer agora e cita o botao', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  roda(p, 0.1);
  assert.match(p.celular[0].texto, /fonte/);
  enche(p, 0);
  assert.match(p.celular[0].texto, /Regar/);
  regaFlor(p, 0, 0);
  enche(p, 1);
  assert.match(p.celular[1].texto, /Complete a flor de/);
  const q = partidaCom(jogo, undefined, coop(2));
  enche(q, 0); regaFlor(q, 0, 0); enche(q, 0); poe(q, 0, CANTEIROS[0].x, CANTEIROS[0].z + 1.2); roda(q, 0.1);
  assert.match(q.celular[0].texto, /já tem a sua água/);
  for (const i of [0, 1]) limpo(p.celular[i].texto);
});

/// robo lento: decide a cada 0,5 s, em 40% das decisoes erra (anda sem rumo e nao aperta), nao otimiza a rota e aperta com atraso
function robo(rng, erra = 0.4) {
  const est = [];
  return p => {
    p.jogadores.forEach((j, i) => {
      const e = est[i] ??= { alvo: null, dec: 0, erra: false }, d = p.dados;
      if (e.dec <= 0) {
        e.dec = 0.5; e.erra = rng() < erra;
        if (e.erra) e.alvo = { x: (rng() * 2 - 1) * LX, z: (rng() * 2 - 1) * LZ };
        else if (!d.agua[i]) e.alvo = FONTE;
        else {
          const lista = d.flores.filter(f => f.est !== 2 && !(f.est === 1 && f.por === i)), ajuda = lista.filter(f => f.est === 1), pool = ajuda.length ? ajuda : lista;
          pool.sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z));
          e.alvo = pool[Math.floor(rng() * Math.min(2, pool.length))] ?? FONTE;
        }
      }
      e.dec -= DT;
      const dx = e.alvo.x - j.x, dz = e.alvo.z - j.z, m = Math.hypot(dx, dz) || 1;
      if (!e.erra && d.agua[i] && e.alvo !== FONTE && m < 2 && rng() < 0.08) { if (j.n === undefined) entrada(p, i, { n: 0 }); entrada(p, i, { x: 0, y: 0, d: false, n: j.n + 1 }); return; }
      entrada(p, i, { x: dx / m * 0.78, y: dz / m * 0.78, d: false, n: j.n });
    });
  };
}
function vitorias(noite, n = 2, total = 30) {
  let v = 0;
  for (let s = 1; s <= total; s++) {
    const p = novaNoite(partidaCom(jogo, sorteio(s), coop(n)), noite), r = robo(sorteio(s * 31 + 5));
    for (let k = 0; k < 60 * 50 && p.fase === 'jogando'; k++) { r(p); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / total;
}

test('jardim-coop: um robo lento com 2 jogadores vence quase sempre na 1a noite e na maioria na 5a, que segue mais dificil', () => {
  const primeira = vitorias(0, 2, 100), quinta = vitorias(4, 2, 100);
  if (process.env.MEDE) console.log('MEDE jardim', primeira, quinta, vitorias(0, 3, 40), vitorias(4, 4, 40));
  assert.ok(primeira >= 0.85, 'noite 1: ' + primeira);
  assert.ok(quinta >= 0.6, 'noite 5: ' + quinta);
  assert.ok(quinta < primeira, `noite 5 (${quinta}) deveria ser mais dificil que a 1 (${primeira})`);
});

test('jardim-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('jardim-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

test('jardim-coop: esconde o nome flutuante dos jogadores (semNome), os bonecos se juntam', () => {
  assert.equal(jogo.semNome, true);
});
