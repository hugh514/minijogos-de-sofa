import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { totalDe, metaDe, vidasDe, velocidade, R_POP, JANELA, LZ, LX } from './bolhas-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
function toca(p, i) {
  const j = p.jogadores[i];
  if (j.n === undefined) entrada(p, i, { n: 0 });
  entrada(p, i, { n: j.n + 1 });
  passo(p, DT);
}
// partida sem bolhas novas: so as que o teste poe
function vazia(n = 2, noite = 0) {
  const p = partidaCom(jogo, undefined, coop(n));
  p.noites = { jogadas: noite, vencidas: 0 }; jogo.inicia(p);
  p.dados.nasc = p.dados.total;
  return p;
}
const bolha = (p, tipo, x = 0, z = 0) => { const b = { id: 900 + p.dados.bolhas.length, x, z, tipo, pegou: p.jogadores.map(() => 0), sz: 0, fase: 0 }; p.dados.bolhas.push(b); return b; };
const SUJO = /[–—]|\p{Extended_Pictographic}/u;
function limpo(texto) {
  assert.ok(!SUJO.test(texto), 'travessao ou emoji: ' + texto);
  assert.ok(!/\b[A-Z]{4,}\b/.test(texto.replace(/Estourar/g, '')), 'caixa alta crua: ' + texto);
  assert.ok(!/undefined|NaN|null/.test(texto), texto);
}

test('bolhas-coop: contrato da festa so cooperativo, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.controle.a, 'Estourar');
  assert.match(jogo.dica, /Estourar/);
  limpo(jogo.dica); limpo(jogo.nome);
});

test('bolhas-coop: mais bolhas e meta maior com mais jogadores; nas noites a meta e a velocidade sobem', () => {
  assert.ok(totalDe(3) > totalDe(2) && totalDe(4) > totalDe(3));
  assert.ok(metaDe(3) > metaDe(2) && metaDe(4) > metaDe(3));
  for (const n of [2, 3, 4]) {
    for (let k = 1; k <= 4; k++) { assert.ok(metaDe(n, k) >= metaDe(n, k - 1)); assert.ok(vidasDe(n, k) <= vidasDe(n, k - 1)); assert.ok(velocidade(k) > velocidade(k - 1)); }
    assert.ok(metaDe(n, 4) > metaDe(n, 0));
    assert.ok(vidasDe(n) >= 5, 'a 1a noite perdoa alguns erros');
    const p = partidaCom(jogo, undefined, coop(n));
    assert.equal(p.dados.meta, metaDe(n)); assert.equal(p.dados.vidas, vidasDe(n)); assert.equal(p.dados.total, totalDe(n));
  }
  const q = vazia(2, 4);
  assert.equal(q.dados.meta, metaDe(2, 4)); assert.equal(q.dados.v, velocidade(4));
});

test('bolhas-coop: as bolhas nascem embaixo e sobem, cada jogador recebe a mesma quantidade da sua cor', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    p.dados.vidas = 99;       // o teste nao pode acabar no meio
    roda(p, 3);
    assert.ok(p.dados.bolhas.length >= 1);
    assert.ok(p.dados.bolhas.every(b => b.z <= LZ));
    const antes = p.dados.bolhas[0].z; roda(p, 1);
    assert.ok(p.dados.bolhas.find(b => b.id === 0)?.z < antes || !p.dados.bolhas.find(b => b.id === 0));
    roda(p, 20);
    const lista = p.dados.nascidas, singles = Array(n).fill(0);
    for (const t of lista) if (t.length === 1) singles[t[0]]++;
    assert.ok(Math.max(...singles) - Math.min(...singles) <= 1, `n ${n}: ${singles}`);
    assert.ok(lista.some(t => t.length === 2), 'sai bolha de duas cores');
    assert.ok(lista.filter(t => t.length === 2).every(t => t[0] !== t[1]));
  }
});

test('bolhas-coop: bolha de uma cor so estoura pelo dono, e o outro a empurra de volta', () => {
  const p = vazia(2);
  const b = bolha(p, [0], 0, 0); poe(p, 0, 1, 0); poe(p, 1, -1, 0);
  toca(p, 1);
  assert.equal(p.dados.estouradas, 0, 'o amigo nao estoura a bolha do outro');
  assert.ok(p.dados.bolhas.includes(b) && b.sz > 0, 'mas empurra de volta');
  toca(p, 0);
  assert.equal(p.dados.estouradas, 1);
  assert.deepEqual(p.dados.placar, [1]);
  assert.ok(!p.dados.bolhas.includes(b));
});

test('bolhas-coop: tocar longe da bolha nao faz nada', () => {
  const p = vazia(2);
  const b = bolha(p, [0], 0, -3); poe(p, 0, 0, 3 + R_POP);
  toca(p, 0);
  assert.equal(p.dados.estouradas, 0); assert.equal(b.sz, 0);
});

test('bolhas-coop: a regra da cooperacao, bolha de duas cores pede os dois juntos', () => {
  const p = vazia(2);
  const b = bolha(p, [0, 1], 0, 0); poe(p, 0, 1, 0); poe(p, 1, -1, 0);
  toca(p, 0);
  assert.equal(p.dados.estouradas, 0, 'um so nao estoura');
  assert.ok(b.pegou[0] > 0, 'quem apertou segura a bolha');
  assert.match(p.celular[0].texto, /Segurando/);
  toca(p, 1);
  assert.equal(p.dados.estouradas, 1, 'o segundo completa');
  assert.ok(!p.dados.bolhas.includes(b));
});

test('bolhas-coop: o primeiro a apertar segura a bolha, quase parada, e o tempo do outro e curto', () => {
  const p = vazia(2);
  const solta = bolha(p, [1], 5, 3), presa = bolha(p, [0, 1], -5, 3); poe(p, 0, -5, 3); poe(p, 1, 9, -2);
  const z0 = [solta.z, presa.z]; toca(p, 0); roda(p, 0.5);
  assert.ok(z0[0] - solta.z > 3 * (z0[1] - presa.z), 'a presa quase parou');
  roda(p, JANELA);
  assert.equal(presa.pegou[0], 0, 'a janela fechou');
  poe(p, 1, presa.x + 1, presa.z); toca(p, 1);
  assert.equal(p.dados.estouradas, 0, 'tarde demais: o segundo sozinho so segura');
  assert.ok(presa.pegou[1] > 0);
  toca(p, 0);
  assert.equal(p.dados.estouradas, 1, 'de novo juntos');
});

test('bolhas-coop: quem tem a cor so conta se esta perto da bolha', () => {
  const p = vazia(2);
  const b = bolha(p, [0, 1], 0, 0); poe(p, 0, 1, 0); poe(p, 1, 8, 0);
  toca(p, 0); toca(p, 1);
  assert.equal(p.dados.estouradas, 0);
  assert.ok(b.pegou[0] > 0 && !(b.pegou[1] > 0));
});

test('bolhas-coop: com 3 e 4 jogadores a bolha de duas cores pede so os dois da cor', () => {
  for (const n of [3, 4]) {
    const p = vazia(n);
    bolha(p, [0, 2], 0, 0); poe(p, 0, 1, 0); poe(p, 2, -1, 0); poe(p, 1, 0.5, 0.5);
    toca(p, 1); assert.equal(p.dados.estouradas, 0, 'um de fora nao ajuda a estourar');
    toca(p, 0); toca(p, 2);
    assert.equal(p.dados.estouradas, 1);
  }
});

test('bolhas-coop: bolha que chega na grade escapa e conta', () => {
  const p = vazia(2);
  bolha(p, [0], 0, -LZ + 1);
  roda(p, 1);
  assert.equal(p.dados.escaparam, 1);
  assert.equal(p.dados.bolhas.length, 0);
});

test('bolhas-coop: derrota quando escapam bolhas demais, ninguem pontua', () => {
  for (const n of [2, 3, 4]) {
    const p = vazia(n);
    for (let k = 0; k < p.dados.vidas; k++) bolha(p, [0], -9 + k, -LZ + 1);
    roda(p, 1);
    assert.equal(p.fase, 'resultado'); assert.equal(p.vencedor, -1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
    assert.ok(p.dados.aviso.length > 0);
    p.jogadores.forEach((_, i) => limpo(p.celular[i].texto)); limpo(p.dados.aviso);
  }
});

test('bolhas-coop: vitoria ao chegar na meta, todos vencem e cada um leva 1 ponto', () => {
  for (const n of [2, 3, 4]) {
    const p = vazia(n);
    p.dados.estouradas = p.dados.meta - 1;
    bolha(p, [0], 0, 0); poe(p, 0, 1, 0);
    toca(p, 0);
    assert.equal(p.fase, 'resultado'); assert.equal(p.vencedor, 2);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
    p.jogadores.forEach((_, i) => limpo(p.celular[i].texto)); limpo(p.dados.aviso);
  }
});

test('bolhas-coop: termina pelo tempo limite quando a meta nao fecha', () => {
  const p = vazia(2);
  p.dados.vidas = 99; p.dados.meta = 99;
  const t = jogaAte(p);
  assert.equal(p.vencedor, -1);
  assert.ok(Math.abs(t - jogo.duracao) < 0.1, 'acabou aos ' + t);
});

test('bolhas-coop: todos parados com bolhas nascendo perdem sem pontos (2, 3 e 4 jogadores)', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, coop(n));
    const t = jogaAte(p);
    assert.equal(p.vencedor, -1);
    assert.ok(t > 5 && t <= jogo.duracao + 0.1, 'n ' + n + ' acabou aos ' + t);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
  }
});

test('bolhas-coop: o celular diz o que fazer agora e cita o botao', () => {
  const p = vazia(2);
  roda(p, 0.1);
  assert.match(p.celular[0].texto, /Espere a próxima bolha/);
  bolha(p, [0], 0, 4); poe(p, 0, 6, 4); roda(p, 0.1);
  assert.match(p.celular[0].texto, /Chegue perto da sua bolha e aperte Estourar/);
  poe(p, 0, 0.5, 4); roda(p, 0.05);
  assert.match(p.celular[0].texto, /Aperte Estourar/);
  const q = vazia(2);
  bolha(q, [0, 1], 0, 0); roda(q, 0.1);
  assert.match(q.celular[0].texto, /duas cores/);
  const r = vazia(2);
  bolha(r, [0], 2, -LZ + 3); poe(r, 1, 2, -LZ + 4); roda(r, 0.05);
  assert.match(r.celular[1].texto, /vai escapar/);
  for (const x of [p, q, r]) for (const i of [0, 1]) limpo(x.celular[i].texto);
});

/// robo lento: decide a cada 0,5 s, em 40% das decisoes erra (anda sem rumo e nao aperta), nao otimiza a rota e aperta com atraso
function robo(rng, erra = 0.4) {
  const est = [];
  return p => {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i] ??= { alvo: null, dec: 0, erra: false };
      if (e.dec <= 0 || (!e.erra && !d.bolhas.includes(e.alvo))) {
        e.dec = 0.5; e.erra = rng() < erra;
        const minhas = d.bolhas.filter(b => b.tipo.includes(i)).sort((a, b) => a.z - b.z);
        e.alvo = e.erra ? { x: (rng() * 2 - 1) * LX, z: (rng() * 2 - 1) * LZ } : minhas[Math.floor(rng() * Math.min(2, minhas.length))] ?? null;
      }
      e.dec -= DT;
      if (!e.alvo) { entrada(p, i, { x: 0, y: 0, d: false, n: j.n }); return; }
      const dx = e.alvo.x - j.x, dz = e.alvo.z - j.z, m = Math.hypot(dx, dz) || 1;
      if (!e.erra && m < 1.9 && rng() < 0.07) { if (j.n === undefined) entrada(p, i, { n: 0 }); entrada(p, i, { x: 0, y: 0, d: false, n: j.n + 1 }); return; }
      entrada(p, i, { x: dx / m * 0.75, y: dz / m * 0.75, d: false, n: j.n });
    });
  };
}
function vitorias(noite, n = 2, total = 30) {
  let v = 0;
  for (let s = 1; s <= total; s++) {
    const p = partidaCom(jogo, sorteio(s), coop(n));
    p.noites = { jogadas: noite, vencidas: 0 }; jogo.inicia(p);
    const r = robo(sorteio(s * 31 + 5));
    for (let k = 0; k < 60 * 50 && p.fase === 'jogando'; k++) { r(p); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / total;
}

test('bolhas-coop: um robo lento com 2 jogadores vence quase sempre na 1a noite e na maioria na 5a, que segue mais dificil', () => {
  const primeira = vitorias(0, 2, 100), quinta = vitorias(4, 2, 100);
  if (process.env.MEDE) console.log('MEDE bolhas', primeira, quinta, vitorias(0, 3, 40), vitorias(4, 4, 40));
  assert.ok(primeira >= 0.85, 'noite 1: ' + primeira);
  assert.ok(quinta >= 0.6, 'noite 5: ' + quinta);
  assert.ok(quinta < primeira, `noite 5 (${quinta}) deveria ser mais dificil que a 1 (${primeira})`);
});

test('bolhas-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('bolhas-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

test('bolhas-coop: esconde o nome flutuante dos jogadores (semNome), os bonecos se juntam', () => {
  assert.equal(jogo.semNome, true);
});
