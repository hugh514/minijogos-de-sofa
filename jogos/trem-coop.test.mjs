import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, criaPartida, pulaPara, registra, JOGOS, GENEROS } from '../logica.mjs';
import { roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, NS, SW, FRENTE0, XFIM, V_TREM, ARRANQUE, PILHAS, R_PILHA, T_PONTE, GRACA_PONTE, buracos, pontes, velocidade, solta } from './trem-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
// A noite precisa estar valendo antes de a rodada montar a linha, como no jogo de verdade.
function partida(n = 2, noite = 0, semente = 1) {
  if (!JOGOS.includes(jogo)) registra(jogo);
  const p = criaPartida(sorteio(semente), coop(n));
  p.noites.jogadas = noite;
  pulaPara(p, jogo);
  assert.equal(p.jogo, jogo, p.erros.join('; '));
  while (p.fase !== 'jogando') passo(p, DT);
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  return p;
}
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0, y: 0, vy: 0 });
// Cenario do teste: linha inteira pronta, e so os pedacos pedidos ficam quebrados.
function linha(p, quebrados = {}) {
  for (const s of p.dados.slots) Object.assign(s, { tipo: 'ok', pronto: true, ponte: false, hN: 0, hS: 0 });
  for (const [k, tipo] of Object.entries(quebrados)) Object.assign(p.dados.slots[k], { tipo, pronto: false, ponte: tipo === 'ponte' });
  return p;
}
const manivela = (s, lado) => [lado ? s.x1 + 0.9 : s.x0 - 0.9, -2.7];
function segura(p, ids, quadros, onde = {}) {
  for (let k = 0; k < quadros && p.fase === 'jogando'; k++) {
    for (const i of ids) { if (onde[i]) poe(p, i, ...onde[i]); entrada(p, i, { x: 0, y: 0, d: true, n: p.jogadores[i].n ?? 0, nb: 0 }); }
    passo(p, DT);
  }
}
const solta0 = (p, ids) => ids.forEach(i => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n ?? 0, nb: 0 }));
const quadros = s => Math.round(s * 60);
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
const longe = (p, n = p.jogadores.length) => { for (let i = 0; i < n; i++) poe(p, i, -9.5 + i, -5.5); return p; };       // fora da pilha, das manivelas e dos buracos

test('trem-coop: contrato da festa so cooperativo, de 2 a 4, genero da lista e tempo de 30 a 45 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.id, 'trem-coop');
  assert.ok(GENEROS.includes(jogo.genero));
  assert.deepEqual(jogo.semMod, ['espelho', 'foguete']);
  assert.ok(TEMPO >= 30 && TEMPO <= 45 && jogo.duracao === TEMPO);
  assert.equal(jogo.controle.a, 'Gira');
  assert.equal(jogo.controle.b, '');
  assert.match(jogo.dica, /Gira/);
  assert.ok(jogo.dica.length < 90, 'a dica cabe em uma frase curta');
});

test('trem-coop: a linha tem buracos e rios nos pedacos certos: o cais e a estacao ficam inteiros, rio nunca junto de rio', () => {
  for (const n of [2, 3, 4])
    for (const noite of [0, 2, 4])
      for (let s = 1; s <= 12; s++) {
        const p = partida(n, noite, s), sl = p.dados.slots;
        assert.equal(sl.length, NS);
        assert.ok(sl.slice(0, 3).every(q => q.pronto) && sl[NS - 1].pronto, 'cais e estacao prontos');
        assert.equal(sl.filter(q => !q.pronto).length, buracos(n, noite));
        const rios = sl.filter(q => q.tipo === 'ponte');
        assert.ok(rios.length >= 1 && rios.length <= pontes(n, noite));
        assert.ok(rios.every(q => q.k <= 6), 'rio so ate o penultimo pedaco');
        assert.ok(rios.every(q => !sl[q.k + 1]?.ponte), 'sem rio colado');
        assert.ok(sl.filter(q => !q.pronto).every(q => q.x0 > FRENTE0), 'tudo quebrado fica a frente do trem');
      }
});

test('trem-coop: o trem so sai depois de 2 s e depois anda sozinho', () => {
  const p = linha(partida());
  roda(p, ARRANQUE - 0.2);
  assert.equal(p.dados.trem.x, FRENTE0);
  roda(p, 1.5);
  assert.ok(p.dados.trem.x > FRENTE0 + 0.2);
  assert.match(p.dados.aviso || 'x', /partiu|x/);
});

test('trem-coop: o trem para antes do buraco, avisa na tela e nao passa nem com o tempo correndo', () => {
  const p = longe(linha(partida(), { 5: 'falta' }));
  roda(p, 25);
  const s = p.dados.slots[5];
  assert.ok(p.dados.trem.x < s.x0, 'parou antes do buraco: ' + p.dados.trem.x);
  assert.ok(p.dados.trem.x > s.x0 - 0.4);
  assert.equal(p.dados.trem.parado, true);
  assert.equal(p.dados.trem.v, 0);
  assert.equal(p.fase, 'jogando');
  p.dados.avisoT = 1; p.dados.aviso = '';
  const q = longe(linha(partida(), { 5: 'falta' }));
  let achou = false;
  for (let k = 0; k < 60 * 20 && !achou; k++) { passo(q, DT); achou = /Falta trilho/.test(q.dados.aviso); }
  assert.ok(achou, 'a tela avisa que falta trilho');
});

test('trem-coop: encostar na pilha pega um trilho (um por vez) e fica visivel no celular', () => {
  const p = longe(linha(partida(), { 5: 'falta', 6: 'falta' }));
  poe(p, 0, PILHAS[0].x + 1, PILHAS[0].z); roda(p, 0.1);
  assert.equal(p.dados.leva[0], true);
  assert.equal(p.dados.leva[1], false);
  assert.match(p.celular[0].texto, /Leve o trilho/);
  assert.deepEqual(p.dados.inventario[0], ['Leva trilho']);
  assert.match(p.celular[1].texto, /Pegue um trilho/);
  poe(p, 1, PILHAS[1].x, PILHAS[1].z); roda(p, 0.1);
  assert.equal(p.dados.leva[1], true, 'a pilha da outra ponta tambem serve');
});

test('trem-coop: quem leva o trilho anda mais devagar que quem esta de maos livres', () => {
  const p = longe(linha(partida(), { 5: 'falta' }));
  poe(p, 0, -9.5, 1.5); poe(p, 1, -9.5, -1.5);
  p.dados.leva[1] = true;
  for (let k = 0; k < 45; k++) { entrada(p, 0, { x: 1, y: 0, n: 0, nb: 0 }); entrada(p, 1, { x: 1, y: 0, n: 0, nb: 0 }); passo(p, DT); }
  const v0 = Math.hypot(p.jogadores[0].vx, p.jogadores[0].vz), v1 = Math.hypot(p.jogadores[1].vx, p.jogadores[1].vz);
  assert.ok(v1 <= 6.01 && v0 > v1, `com trilho ${v1}, sem ${v0}`);
});

test('trem-coop: encostar no buraco com o trilho encaixa e o trem volta a andar; sem trilho nao encaixa', () => {
  const p = longe(linha(partida(), { 4: 'falta' }));
  const s = p.dados.slots[4];
  poe(p, 0, s.x, 0.8); roda(p, 0.3);
  assert.equal(s.pronto, false, 'de maos vazias nao encaixa');
  p.dados.leva[0] = true;
  poe(p, 0, s.x, 0.8); roda(p, 0.1);
  assert.equal(s.pronto, true);
  assert.equal(p.dados.leva[0], false);
  assert.equal(p.dados.colocados, 1);
  assert.ok(p.eventos.includes('moeda'));
  roda(p, 12);
  assert.ok(p.dados.trem.x > s.x1, 'o trem passou pelo pedaco consertado');
});

test('trem-coop: trilho nao encaixa no rio: o celular manda girar a manivela', () => {
  const p = longe(linha(partida(), { 4: 'ponte' }));
  const s = p.dados.slots[4];
  p.dados.leva[0] = true;
  poe(p, 0, s.x, 0.8); roda(p, 0.3);
  assert.equal(s.pronto, false);
  assert.equal(p.dados.leva[0], true, 'continua com o trilho');
  assert.match(p.celular[0].texto, /Só falta ponte/);
});

test('trem-coop: a ponte so fecha com os dois girando, cada um numa margem; um sozinho nao fecha', () => {
  const p = longe(linha(partida(), { 5: 'ponte' }));
  const s = p.dados.slots[5];
  segura(p, [0], quadros(T_PONTE * 3), { 0: manivela(s, 0) });
  assert.equal(s.hN, 1, 'o lado de quem gira ficou cheio');
  assert.equal(s.hS, 0);
  assert.equal(s.pronto, false, 'um sozinho nao fecha a ponte');
  assert.match(p.celular[0].texto, /Seu amigo precisa girar o outro lado/);
  assert.match(p.celular[1].texto, /^Ajude Jogador 1/);
  segura(p, [1], quadros(T_PONTE * 0.6), { 1: manivela(s, 1), 0: manivela(s, 0) });
  assert.equal(s.pronto, false, 'ainda falta tempo do outro lado');
  segura(p, [0, 1], quadros(T_PONTE * 0.6), { 0: manivela(s, 0), 1: manivela(s, 1) });
  assert.equal(s.pronto, true, 'os dois juntos fecharam');
  assert.equal(p.dados.pontesFeitas, 1);
  assert.ok(p.eventos.includes('ponto'));
  assert.match(p.dados.aviso, /Ponte pronta/);
});

test('trem-coop: os dois na mesma margem nao fecham a ponte, e a ponte sobe de volta se ninguem gira', () => {
  const p = longe(linha(partida(3), { 5: 'ponte' }));
  const s = p.dados.slots[5];
  segura(p, [0, 1], quadros(T_PONTE * 3), { 0: manivela(s, 0), 1: [manivela(s, 0)[0] - 0.4, -2.2] });
  assert.equal(s.hN, 1);
  assert.equal(s.hS, 0);
  assert.equal(s.pronto, false);
  solta0(p, [0, 1]); poe(p, 0, -9, -5.5); poe(p, 1, -8, -5.5);
  roda(p, 1.5);
  assert.ok(s.hN < 1, 'o lado soltou: ' + s.hN);
  roda(p, 5);
  assert.equal(s.hN, 0);
});

test('trem-coop: longe da manivela girar nao adianta', () => {
  const p = longe(linha(partida(), { 5: 'ponte' }));
  const s = p.dados.slots[5];
  segura(p, [0, 1], quadros(3), { 0: [0, 5], 1: [5, 5] });
  assert.equal(s.hN + s.hS, 0);
});

test('trem-coop: linha livre a frente faz o trem correr, perto do buraco ele anda no ritmo normal', () => {
  const livre = linha(partida());
  const perto = longe(linha(partida(), { 3: 'falta' }));
  roda(livre, ARRANQUE + 0.5); roda(perto, ARRANQUE + 0.5);
  assert.ok(livre.dados.trem.v > perto.dados.trem.v * 1.3, `livre ${livre.dados.trem.v}, perto ${perto.dados.trem.v}`);
  assert.ok(perto.dados.trem.v < velocidade(2, 0) * 1.15, 'no ritmo normal: ' + perto.dados.trem.v);
  assert.ok(livre.dados.trem.v <= V_TREM * 1.7);
});

test('trem-coop: vitoria: o trem chega a estacao, retorna 2 pelo motor, 1 ponto cada, e o aviso final', () => {
  for (const n of [2, 3, 4]) {
    const p = longe(linha(partida(n)));
    const t = jogaAte(p);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, 2);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
    assert.equal(p.dados.fim, 'chegou');
    assert.ok(p.dados.trem.x >= XFIM - 0.01);
    assert.match(p.dados.aviso, /chegou à estação/);
    p.celular.forEach(c => assert.match(c.texto, /chegou à estação/));
    assert.ok(t >= 5, 'nunca fecha antes de 5 s: ' + t);
  }
});

test('trem-coop: derrota: parados com a linha quebrada o tempo acaba aos 40 s, e ninguem pontua', () => {
  for (const n of [2, 3, 4]) {
    const p = longe(partida(n));
    const t = jogaAte(p);
    assert.equal(p.vencedor, -1);
    assert.ok(Math.abs(t - TEMPO) < 0.1, 'acabou aos ' + t);
    assert.equal(p.dados.fim, 'tempo');
    assert.match(p.dados.aviso, /tempo acabou/);
    p.celular.forEach(c => assert.match(c.texto, /não chegou/));
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(0));
  }
});

test('trem-coop: o placar mostra o caminho andado de 0 a 100', () => {
  const p = longe(linha(partida()));
  assert.deepEqual(p.dados.placar, [0]);
  roda(p, 14);
  assert.ok(p.dados.placar[0] > 20 && p.dados.placar[0] < 100, '' + p.dados.placar[0]);
  assert.ok(p.dados.placar[0] === Math.floor((p.dados.trem.x - FRENTE0) / (XFIM - FRENTE0) * 100));
});

test('trem-coop: escala com o numero de jogadores e com a noite', () => {
  assert.ok(buracos(2, 0) <= buracos(3, 0) && buracos(3, 0) <= buracos(4, 0) && buracos(2, 0) < buracos(4, 4));
  assert.ok(buracos(2, 0) < buracos(2, 4));
  assert.ok(buracos(4, 4) <= 5 && buracos(2, 0) >= 3, 'cabe nos cinco pedacos');
  assert.ok(pontes(2, 0) <= pontes(3, 1) && pontes(3, 1) <= pontes(4, 3));
  assert.ok(velocidade(2, 0) < velocidade(4, 0) && velocidade(2, 0) < velocidade(2, 4));
  assert.ok(solta(0) < solta(2) && solta(2) < solta(4));
  const q = partida(2, 0), r = partida(4, 4);
  assert.ok(r.dados.slots.filter(s => !s.pronto).length > q.dados.slots.filter(s => !s.pronto).length);
  // a manivela solta mais depressa nas noites tardias
  const a = longe(linha(partida(2, 0), { 5: 'ponte' })), b = longe(linha(partida(2, 4), { 5: 'ponte' }));
  for (const p of [a, b]) { p.dados.slots[5].hN = 1; roda(p, GRACA_PONTE + 1); }       // a metade da ponte espera um instante antes de subir
  assert.ok(b.dados.slots[5].hN < a.dados.slots[5].hN);
});

// Robo casual: decide de uns 1,3 s em 1,3 s, pega trilho se faltar, leva ao buraco, e vai a uma manivela quando so falta ponte; as vezes se distrai.
function robo(p, rng) {
  const est = p.jogadores.map(() => ({ alvo: null, ate: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 1.3 * (0.6 + rng() * 0.9);
        const pend = d.slots.filter(s => !s.pronto), faltas = pend.filter(s => s.tipo === 'falta'), pontesP = pend.filter(s => s.tipo === 'ponte');
        const levando = d.leva.filter(Boolean).length;
        if (rng() < 0.3) e.alvo = { x: (rng() * 2 - 1) * 8, z: (rng() * 2 - 1) * 4, parado: true };
        else if (d.leva[i] && faltas.length) e.alvo = { x: faltas[0].x, z: 0.8, ok: 1 };
        else if (!d.leva[i] && faltas.length > levando) e.alvo = { ...PILHAS.reduce((a, b) => (Math.hypot(a.x - j.x, a.z - j.z) < Math.hypot(b.x - j.x, b.z - j.z) ? a : b)), ok: 1.2 };
        else if (pontesP.length) {
          const s = pontesP[0], outro = p.jogadores.findIndex((_, q) => q !== i && est[q].alvo?.mani === s.k);
          const lado = outro >= 0 ? 1 - est[outro].alvo.lado : i % 2;
          e.alvo = { x: lado ? s.x1 + 0.9 : s.x0 - 0.9, z: -2.7, ok: 1.2, mani: s.k, lado, gira: true };
        } else e.alvo = { x: j.x, z: j.z, parado: true };
      }
      const a = e.alvo, dx = a.x - j.x, dz = a.z - j.z, m = Math.hypot(dx, dz) || 1, perto = m < (a.ok ?? 0.4);
      entrada(p, i, { x: perto ? 0 : dx / m, y: perto ? 0 : dz / m, d: perto && !!a.gira, n: j.n ?? 0, nb: 0 });
    });
  };
}
// Robo lento (a crianca distraida): decide a cada 0,5 s e em 40% das vezes se distrai (anda a toa, sem girar).
// Quando atento: pega trilho se faltar, leva ao buraco e vai a uma manivela quando so falta ponte, em linha reta, sem otimizar rota.
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ alvo: null, ate: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 0.5;
        const pend = d.slots.filter(s => !s.pronto), faltas = pend.filter(s => s.tipo === 'falta'), pontesP = pend.filter(s => s.tipo === 'ponte');
        const levando = d.leva.filter(Boolean).length;
        if (rng() < 0.4) e.alvo = { x: (rng() * 2 - 1) * 8, z: (rng() * 2 - 1) * 4, parado: true };
        else if (d.leva[i] && faltas.length) e.alvo = { x: faltas[0].x, z: 0.8, ok: 1 };
        else if (!d.leva[i] && faltas.length > levando) e.alvo = { ...PILHAS.reduce((a, b) => (Math.hypot(a.x - j.x, a.z - j.z) < Math.hypot(b.x - j.x, b.z - j.z) ? a : b)), ok: 1.2 };
        else if (pontesP.length) {
          const s = pontesP[0], outro = p.jogadores.findIndex((_, q) => q !== i && est[q].alvo?.mani === s.k);
          const lado = outro >= 0 ? 1 - est[outro].alvo.lado : i % 2;
          e.alvo = { x: lado ? s.x1 + 0.9 : s.x0 - 0.9, z: -2.7, ok: 1.2, mani: s.k, lado, gira: true };
        } else e.alvo = { x: j.x, z: j.z, parado: true };
      }
      const a = e.alvo, dx = a.x - j.x, dz = a.z - j.z, m = Math.hypot(dx, dz) || 1, perto = m < (a.ok ?? 0.4);
      entrada(p, i, { x: perto ? 0 : dx / m, y: perto ? 0 : dz / m, d: perto && !!a.gira, n: j.n ?? 0, nb: 0 });
    });
  };
}
function taxaLenta(n, noite, partidas = 100) {
  let v = 0;
  for (let s = 1; s <= partidas; s++) {
    const p = partida(n, noite, s), joga = roboLento(p, sorteio(s * 7 + 3));
    for (let q = 0; q < 75 * 60 && p.fase === 'jogando'; q++) { joga(q); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / partidas;
}

test('trem-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil', () => {
  const a = taxaLenta(2, 0), b = taxaLenta(2, 4);
  assert.ok(a >= 0.85, 'noite 1: ' + a);
  assert.ok(b >= 0.6, 'noite 5: ' + b);
  assert.ok(b < a, `noite 5 (${b}) deveria ser mais dificil que a 1 (${a})`);
});

test('trem-coop: com 3 e 4 jogadores o robo lento vence a maioria na 1a noite e boa parte na 5a, mas parados nunca chegam', () => {
  for (const n of [3, 4]) {
    assert.ok(taxaLenta(n, 0, 40) >= 0.8, 'n ' + n + ' noite 1');
    assert.ok(taxaLenta(n, 4, 40) >= 0.4, 'n ' + n + ' noite 5');
    for (const noite of [0, 4]) { const p = partida(n, noite, 3); jogaAte(p); assert.equal(p.vencedor, -1, `${n} parados na noite ${noite + 1}`); }
  }
});

test('trem-coop: a metade da ponte aguenta uma distracao curta (GRACA_PONTE) e depois sobe devagar', () => {
  const p = longe(linha(partida(), { 5: 'ponte' }));
  const s = p.dados.slots[5];
  segura(p, [0], quadros(T_PONTE * 2), { 0: manivela(s, 0) });
  assert.equal(s.hN, 1);
  solta0(p, [0]); poe(p, 0, -9, -5.5);
  roda(p, GRACA_PONTE - 0.2);
  assert.equal(s.hN, 1, 'ainda inteira durante a espera');
  roda(p, 1.5);
  assert.ok(s.hN < 1 && s.hN > 0, 'depois da espera sobe aos poucos: ' + s.hN);
});

function taxa(n, noite, partidas = 40) {
  let v = 0;
  for (let s = 1; s <= partidas; s++) {
    const p = partida(n, noite, s), joga = robo(p, sorteio(s * 7 + 3));
    for (let q = 0; q < 75 * 60 && p.fase === 'jogando'; q++) { joga(q); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / partidas;
}

test('trem-coop: um robo casual vence bem mais da metade na 1a noite com 2 jogadores, e na 5a noite e mais dificil', () => {
  const a = taxa(2, 0), b = taxa(2, 4);
  assert.ok(a > 0.75, 'noite 1: ' + a);
  assert.ok(b < a, `noite 5 (${b}) deveria ser mais dificil que a 1 (${a})`);
  assert.ok(b > 0.3, 'a 5a noite nao e impossivel: ' + b);
});

test('trem-coop: com 3 e 4 jogadores o robo casual tambem vence a maioria na 1a noite', () => {
  assert.ok(taxa(3, 0, 25) > 0.7);
  assert.ok(taxa(4, 0, 25) > 0.7);
});

test('trem-coop: o texto do celular e da tela e em portugues claro: sem travessao, emoji, caixa alta crua nem nome de variavel', () => {
  const p = partida(3, 2, 9), joga = robo(p, sorteio(5)), textos = [];
  for (let q = 0; q < 60 * 40 && p.fase === 'jogando'; q++) {
    joga(q); passo(p, DT);
    if (q % 20 === 0) textos.push(...p.celular.map(c => c.texto), p.dados.aviso, ...p.dados.inventario.flat());
  }
  textos.push(...p.celular.map(c => c.texto), p.dados.aviso);
  for (const t of textos.filter(Boolean).concat(jogo.dica, jogo.nome)) {
    assert.doesNotMatch(t, /[—–]/, t);
    assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, t);
    assert.doesNotMatch(t, /undefined|NaN|null|\[object/, t);
    assert.doesNotMatch(t.replace(/Gira|Jogador \d/g, ''), /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}/, 'caixa alta crua: ' + t);
  }
});

test('trem-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('trem-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});

test('trem-coop: esconde o nome flutuante (semNome): os bonecos se juntam na pilha e no buraco', () => {
  assert.equal(jogo.semNome, true);
});
