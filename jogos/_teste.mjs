// Apoio para testar minijogos no node, sem navegador. Nao e servido para a tela.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { criaPartida, passo, entrada, pulaPara, registra, elegiveis, JOGOS, ehCoop } from '../logica.mjs';

export const DT = 1 / 60;

export function sorteio(semente) {      // gerador fixo, para teste que se repete igual
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Partida ja no primeiro quadro de jogo do minijogo dado.
// Minijogo de festa: partidaCom(jogo, rng, { n: 3, modo: 'vs' }) (n de 2 a 4; modo 'vs', 'times' ou 'coop'). Sem opcoes e o Classico com 2.
export function partidaCom(jogo, rng = sorteio(1), opcoes = {}) {
  if (opcoes.modo && opcoes.modo !== 'classico' && !JOGOS.includes(jogo)) registra(jogo);     // a rotacao da festa so sorteia o que esta registrado
  if (opcoes.modo && opcoes.modo !== 'classico') assert.ok(jogo.festa?.min <= opcoes.n && opcoes.n <= jogo.festa.max && jogo.festa.modos.includes(opcoes.modo), `${jogo.id} nao declara festa para ${opcoes.n} jogadores em ${opcoes.modo}`);
  const p = criaPartida(rng, opcoes);
  pulaPara(p, jogo);
  assert.equal(p.jogo, jogo, 'o minijogo nao iniciou: ' + p.erros.join('; '));
  while (p.fase !== 'jogando') passo(p, DT);
  return p;
}

export function roda(p, segundos) { for (let i = 0; i < segundos * 60; i++) passo(p, DT); }
// Roda ate a rodada fechar (com comMinimo, a rodada so fecha aos 5 s de jogo), no maximo 6 s.
export function ateFechar(p) { for (let i = 0; i < 6 * 60 && p.fase === 'jogando'; i++) passo(p, DT); }

// Contexto de desenho igual ao da tela (mesmos nomes), com three de verdade e sem WebGL.
// comModelos: c.modelo devolve um grupo de mentira (como a tela com o glb carregado); sem, devolve null (modelo ainda nao chegou ou falhou: o minijogo usa a forma simples).
export function contexto(p, comModelos = false) {
  const malha = (geo, cor, extra = {}) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cor, ...extra }));
  const c = {
    THREE, grupo: new THREE.Group(), pecas: {}, base: {}, p, malha,
    modelo: (nome, { altura, escala = 1 } = {}) => {
      if (!comModelos) return null;
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
      g.scale.setScalar(altura ?? escala); g.userData.toca = (anim, vel) => (g.userData.chamadas ??= []).push([anim, vel]);       // guarda o que o minijogo pediu
      return g;
    },
    mixers: [], particulas() {}, som() {}, cores: [0x2f7df6, 0xf0458f, 0x35c26b, 0xffc531].slice(0, p.n), times: [0xff7a1a, 0x9a4dff],
    bonecos: p.jogadores.map(() => new THREE.Group()),
    pool(nome, n, cria) {
      const lista = c.pecas[nome] ??= [];
      while (lista.length < n) { const m = cria(lista.length); c.grupo.add(m); lista.push(m); }
      lista.forEach((m, i) => { m.visible = i < n; });
      return lista;
    },
  };
  return c;
}

function confere(p, jogo) {
  assert.deepEqual(p.erros, [], jogo.id + ': erro durante a rodada');
  for (const j of p.jogadores)
    for (const campo of ['x', 'y', 'z', 'vx', 'vy', 'vz'])
      assert.ok(Number.isFinite(j[campo]), `${jogo.id}: jogador com ${campo} invalido`);
}

// Roda uma rodada inteira desenhando cada quadro. "aperta(p, quadro, rng)" simula os jogadores.
// Falha se der erro, se alguma posicao ficar invalida ou se a rodada nao acabar em 75 s.
export function rodada(jogo, aperta = () => {}, semente = 1, opcoes = {}) {
  const rng = sorteio(semente), p = partidaCom(jogo, sorteio(semente + 1000), opcoes);
  const c = contexto(p, semente % 2 === 0);       // sementes pares desenham com modelos, as impares com as formas simples
  jogo.monta?.(c);
  let quadro = 0;
  for (; quadro < 75 * 60 && p.fase === 'jogando'; quadro++) {
    aperta(p, quadro, rng);
    passo(p, DT);
    if (p.jogo === jogo) jogo.desenha?.(c, DT, quadro * DT);
    confere(p, jogo);
  }
  assert.notEqual(p.fase, 'jogando', jogo.id + ': a rodada nao terminou sozinha em 75 s');
  const validos = ehCoop(p) ? [-1, 2] : p.modo === 'times' ? [-1, 0, 1] : [-1, ...p.jogadores.keys()];      // coop: 2 = vitoria em equipe; times: 0 ou 1 (o time)
  assert.ok(validos.includes(p.vencedor), jogo.id + ': vencedor invalido ' + p.vencedor);
  return { p, segundos: quadro * DT };
}

// Dedos aleatorios em todos os tipos de controle (joystick/toque, A, B e escolhas).
export function aleatorio(p, quadro, rng) {
  if (quadro % 12) return;
  for (const [i, j] of p.jogadores.entries()) {
    const m = { x: rng() * 2 - 1, y: rng() * 2 - 1, d: rng() < 0.4, b: rng() < 0.2, n: j.n ?? 0, nb: j.nb ?? 0, op: Math.floor(rng() * 4), nop: j.nop ?? 0 };
    if (rng() < 0.4) m.n++;
    if (rng() < 0.2) m.nb++;
    if (rng() < 0.3) m.nop++;
    entrada(p, i, m);
  }
}

// Teste de fumaca completo: parados e com 15 partidas de dedos aleatorios. Devolve quem ganhou em cada uma.
// Minijogo de festa: fumaca(jogo, { n: 4, modo: 'times' }) roda com n jogadores naquele modo.
export function fumaca(jogo, opcoes = {}) {
  rodada(jogo, () => {}, 1, opcoes);
  const vencedores = [];
  for (let s = 1; s <= 15; s++) vencedores.push(rodada(jogo, aleatorio, s, opcoes).p.vencedor);
  return vencedores;
}
