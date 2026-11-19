import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, contexto, sorteio, aleatorio, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, TEMPO, R_LUZ, R_JUNTOS, LIGA, T_CARGA, T_TONTO, T_REVIVE, R_REVIVE, T_IMUNE, MAX_ZUMBIS, ONDAS, TAMANHO, COVAS, MODELOS, escala, velocidade } from './zumbis-coop.mjs';

// Partida cooperativa de n jogadores (modo coop da Festa). O resultado vem do motor de verdade: p.fase e p.vencedor.
function partida(semente = 1, n = 2, noite = 0) {
  const p = partidaCom(jogo, sorteio(semente), { n, modo: 'coop' });
  p.noites.jogadas = noite;
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  Object.defineProperty(p, 'fim', { get() { return p.fase === 'jogando' ? undefined : p.vencedor; }, configurable: true });
  return p;
}
function quieta(p) { p.dados.onda = ONDAS.length; return p; }                 // sem novas ondas: cenario montado pelo teste
function roda(p, segundos) { for (let i = 0; i < segundos * 60 && p.fim === undefined; i++) passo(p, DT); }
function zumbi(x, z, extra = {}) { return { x, z, kx: 0, kz: 0, ang: 0, v: 2, atord: 0, pausa: 0, nasce: 0, morre: 0, re: 0, fase: 1, alvo: -1, ...extra }; }
function poe(p, i, x, z) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }
function derruba(p, i) { const j = p.jogadores[i]; p.dados.caido[i] = true; p.dados.pos[i] = { x: j.x, z: j.z }; }
const toques = [0, 0, 0, 0];
function luzDe(p, i) { toques[i]++; entrada(p, i, { x: 0, y: 0, d: false, n: toques[i] }); }
const longe = (p, ate = 4) => { for (let i = 0; i < p.n; i++) poe(p, i, -9 + 5 * i, i % 2 ? 5.5 : -5.5); return p; };

test('zumbis-coop: contrato da festa, tempo e controle (so Luz, sem botao B)', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.id, 'zumbis-coop');
  assert.equal(jogo.genero, 'reflexo');
  assert.deepEqual(jogo.semMod, ['espelho', 'foguete']);
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 30 && TEMPO <= 50, 'rodada de 30 a 50 s');
  assert.equal(jogo.controle.a, 'Luz');
  assert.equal(jogo.controle.b, '');
  assert.match(jogo.dica, /sol nascer/);
  assert.ok(jogo.dica.length < 90, 'a dica cabe em uma frase curta');
});

test('zumbis-coop: aguentar ate o sol nascer retorna 2 (vitoria em equipe) no tempo certo', () => {
  const p = quieta(partida());
  let quadros = 0;
  while (p.fim === undefined && quadros < 60 * (TEMPO + 2)) { passo(p, DT); quadros++; }
  assert.equal(p.fim, 2);
  assert.ok(Math.abs(quadros / 60 - TEMPO) < 0.1, 'terminou no tempo certo: ' + quadros / 60);
  assert.equal(p.dados.fim, 'dia');
  assert.match(p.dados.aviso, /sol nasceu/);
  p.celular.forEach(c => assert.match(c.texto, /sol nasceu/));
});

test('zumbis-coop: todos caidos retorna -1 na hora e o texto explica por que', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, 6, 0);
  p.dados.zumbis = [zumbi(-6, 0), zumbi(6, 0)];
  roda(p, 1);
  assert.equal(p.fim, -1);
  assert.deepEqual(p.dados.caido, [true, true]);
  assert.ok(p.t < 1.2, 'sem esperar o tempo acabar');
  assert.equal(p.dados.fim, 'noite');
  assert.match(p.dados.aviso, /Todos caíram/);
  p.celular.forEach(c => assert.match(c.texto, /Todos caíram/));
});

test('zumbis-coop: tempo limite decide: com alguem em pe aos 40 s todos vencem; com todos caidos nao', () => {
  const p = quieta(partida(1, 4));
  [0, 1, 2].forEach(i => { poe(p, i, -9 + i, 6); derruba(p, i); });
  poe(p, 3, 0, 0);
  p.t = TEMPO - 0.6;                                          // como faz o teste de navegador
  roda(p, 2);
  assert.equal(p.fim, 2, 'tres caidos e um em pe: vitoria');
  const q = quieta(partida(2, 4));
  q.jogadores.forEach((_, i) => { poe(q, i, -9 + 3 * i, 6); derruba(q, i); });
  roda(q, TEMPO + 1);
  assert.equal(q.fim, -1, 'todos caidos: derrota');
});

test('zumbis-coop: vitoria de todos da 1 ponto para cada um, pelo motor', () => {
  const p = quieta(partida(1, 4));
  roda(p, TEMPO + 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1, 1]);
});

test('zumbis-coop: zumbi que encosta derruba um so, vibra so o celular dele e avisa na tela', () => {
  const p = quieta(partida(1, 3));
  longe(p); poe(p, 0, -6, 0);
  p.dados.zumbis = [zumbi(-6, 0)];
  roda(p, 0.2);
  assert.deepEqual(p.dados.caido, [true, false, false]);
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[1].vibra, undefined);
  assert.match(p.dados.aviso, /caiu/);
  assert.match(p.celular[0].texto, /Você caiu/);
  assert.equal(p.fim, undefined);
});

test('zumbis-coop: quando so sobra um em pe a tela avisa para salvar os amigos', () => {
  const p = quieta(partida(1, 3));
  longe(p); poe(p, 0, -6, 0); poe(p, 1, 6, 0); poe(p, 2, 0, 6);
  derruba(p, 1); p.dados.zumbis = [zumbi(-6, 0)];
  roda(p, 0.2);
  assert.deepEqual(p.dados.caido, [true, true, false]);
  assert.match(p.dados.aviso, /Só sobrou/);
  assert.match(p.celular[2].texto, /Corra até/);
});

test('zumbis-coop: jogador imune (d.imune) nao cai e o zumbi e empurrado', () => {
  const p = quieta(partida(1, 2));
  longe(p); poe(p, 0, -6, 0);
  p.dados.imune = p.dados.imune.map(() => 99);              // o teste de navegador faz isto
  p.dados.zumbis = [zumbi(-6, 0)];
  roda(p, 1);
  assert.deepEqual(p.dados.caido, [false, false]);
});

test('zumbis-coop: reviver e so encostar: amigo em pe perto pelo tempo de reviver levanta (menos tempo nao basta)', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); derruba(p, 0); poe(p, 1, -4.6, 0);
  roda(p, T_REVIVE - 0.4);
  assert.equal(p.dados.caido[0], true, 'ainda caido');
  assert.ok(p.dados.rev[0] > T_REVIVE * 0.6);
  roda(p, 0.6);
  assert.equal(p.dados.caido[0], false, 'levantou');
  assert.ok(p.dados.imune[0] > 0 && p.dados.imune[0] <= T_IMUNE, 'volta imune por um instante');
  assert.equal(p.dados.salvos, 1);
  assert.match(p.dados.aviso, /levantou/);
  assert.equal(p.fim, undefined);
});

test('zumbis-coop: longe nao revive e o progresso se perde aos poucos', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); derruba(p, 0); poe(p, 1, 6, 0);
  roda(p, 4);
  assert.equal(p.dados.caido[0], true);
  assert.equal(p.dados.rev[0], 0);
  poe(p, 1, -4.6, 0); roda(p, 1);
  assert.ok(p.dados.rev[0] > 0.8);
  poe(p, 1, 6, 0); roda(p, 3);
  assert.equal(p.dados.rev[0], 0, 'perdeu o progresso ao se afastar (devagar: crianca distraida nao perde tudo de uma vez)');
});

test('zumbis-coop: dois amigos levantam na metade do tempo', () => {
  const p = quieta(partida(1, 3));
  poe(p, 0, -6, 0); derruba(p, 0); poe(p, 1, -4.6, 0); poe(p, 2, -6, 1.4);
  roda(p, T_REVIVE / 2 + 0.1);
  assert.equal(p.dados.caido[0], false);
});

test('zumbis-coop: quem caiu nao ajuda ninguem e o amigo caido nao levanta sozinho', () => {
  const p = quieta(partida(1, 3));
  poe(p, 0, -6, 0); derruba(p, 0); poe(p, 1, -4.6, 0); derruba(p, 1); poe(p, 2, 6, 5);
  roda(p, 5);
  assert.deepEqual(p.dados.caido, [true, true, false]);
});

test('zumbis-coop: ao levantar o susto afasta os zumbis colados', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); derruba(p, 0); poe(p, 1, -4.6, 0);
  p.dados.zumbis = [zumbi(-6.8, 0.4, { pausa: 100 })];
  roda(p, T_REVIVE + 0.1);
  assert.equal(p.dados.caido[0], false);
  assert.ok(p.dados.zumbis[0].atord > 0, 'zumbi tonto');
});

test('zumbis-coop: Luz sozinha afasta e deixa tonto o zumbi perto, e nao mexe no longe', () => {
  const p = quieta(partida(1, 2));
  poe(p, 0, 0, 0); poe(p, 1, 9, 6);
  p.dados.zumbis = [zumbi(2, 0), zumbi(R_LUZ + 2, 0)];
  const antes = p.dados.zumbis[0].x;
  luzDe(p, 0); roda(p, 0.1);
  const [perto, distante] = p.dados.zumbis;
  assert.ok(perto.atord > T_TONTO - 0.3, 'tonto');
  assert.ok(perto.x > antes, 'empurrado para longe');
  assert.ok(distante.atord <= 0, 'o de longe nao sentiu');
  assert.equal(p.dados.zumbis.length, 2, 'sozinha nao destroi');
  assert.equal(p.dados.pulsos.length, 1);
});

test('zumbis-coop: zumbi tonto nao derruba ninguem', () => {
  const p = quieta(partida(1, 2));
  longe(p); poe(p, 0, 0, 0);
  p.dados.zumbis = [zumbi(1, 0, { atord: 1 })];
  roda(p, 0.5);
  assert.equal(p.dados.caido[0], false);
});

test('zumbis-coop: a luz recarrega, e sem carga o botao nao faz nada', () => {
  const p = quieta(partida(1, 2));
  poe(p, 0, 0, 0); poe(p, 1, 9, 6);
  p.dados.zumbis = [zumbi(2, 0, { pausa: 100 })];
  luzDe(p, 0); roda(p, 0.1);
  assert.ok(p.dados.carga[0] < 0.2);
  assert.equal(p.celular[0].a, 'Carregando');
  assert.deepEqual(p.dados.inventario[0], ['Luz recarregando']);
  p.dados.zumbis.push(zumbi(2.2, 0.3, { pausa: 100 }));
  luzDe(p, 0); roda(p, 0.1);
  assert.ok(p.dados.zumbis[1].atord <= 0, 'sem carga: nada acontece');
  roda(p, T_CARGA);
  assert.equal(p.dados.carga[0], 1);
  assert.equal(p.celular[0].a, 'Luz');
  assert.deepEqual(p.dados.inventario[0], ['Luz pronta']);
});

test('zumbis-coop: toque curto no A (so o contador) vale como apertar', () => {
  const p = quieta(partida(1, 2));
  poe(p, 0, 0, 0); poe(p, 1, 9, 6);
  p.dados.zumbis = [zumbi(2, 0, { pausa: 100 })];
  luzDe(p, 0);                                               // chega e o dedo ja soltou
  roda(p, 0.1);
  assert.ok(p.dados.zumbis[0].atord > 0);
});

test('zumbis-coop: com um amigo em pe perto a luz dos dois DESTROI os zumbis, num raio maior', () => {
  const p = quieta(partida(1, 2));
  poe(p, 0, 0, 0); poe(p, 1, 3.5, 0);
  assert.ok(3.5 <= LIGA);
  p.dados.zumbis = [zumbi(R_LUZ + 1.5, 3, { pausa: 100 }), zumbi(-4, 1, { pausa: 100 }), zumbi(-R_JUNTOS - 3, 0, { pausa: 100 })];
  luzDe(p, 0); roda(p, 0.1);
  assert.equal(p.dados.pulsos[0].juntos, true);
  assert.equal(p.dados.destruidos, 2, 'os dois dentro do raio maior');
  roda(p, 1);
  assert.equal(p.dados.zumbis.length, 1, 'os destruidos saem da tela e o de longe fica');
  assert.match(p.dados.aviso, /Luz em dupla/);
});

test('zumbis-coop: amigo longe ou caido nao conta: a luz so afasta', () => {
  for (const caido of [false, true]) {
    const p = quieta(partida(1, 2));
    poe(p, 0, 0, 0); poe(p, 1, LIGA + 1, 0);
    if (caido) { poe(p, 1, 2, 0); derruba(p, 1); }
    p.dados.zumbis = [zumbi(-2, 0, { pausa: 100 })];
    luzDe(p, 0); roda(p, 0.1);
    assert.equal(p.dados.pulsos[0].juntos, false);
    assert.equal(p.dados.destruidos, 0);
    assert.ok(p.dados.zumbis[0].atord > 0);
  }
});

test('zumbis-coop: zumbi saindo da cova nao e atingido nem derruba, e depois anda', () => {
  const p = quieta(partida(1, 2));
  poe(p, 0, 0, 0); poe(p, 1, 3, 0);
  p.dados.zumbis = [zumbi(0.3, 0, { nasce: 1 })];
  luzDe(p, 0); roda(p, 0.5);
  assert.equal(p.dados.zumbis.length, 1);
  assert.equal(p.dados.caido[0], false, 'nao derruba enquanto sai da terra');
  roda(p, 1);
  assert.equal(p.dados.zumbis[0].nasce <= 0, true);
});

test('zumbis-coop: ondas saem das covas, avisam na tela e crescem com a noite', () => {
  const p = partida(1, 2);
  longe(p);
  p.dados.imune = p.dados.imune.map(() => 99);
  roda(p, ONDAS[0] + 0.2);
  assert.equal(p.dados.onda, 1);
  assert.ok(p.dados.zumbis.length >= 1);
  assert.match(p.dados.aviso, /covas/);
  const k = COVAS.map(c => `${c.x},${c.z}`);
  assert.ok(p.dados.zumbis.every(z => k.includes(`${z.x},${z.z}`) || z.nasce < 1.2), 'saem das covas');
  assert.ok(p.dados.covaT.some(v => v > 0), 'a cova brilha enquanto o zumbi sai');
});

test('zumbis-coop: a dificuldade escala com o numero de jogadores e com a noite', () => {
  for (const noite of [0, 2, 4]) assert.ok(escala(2, noite) < escala(3, noite) && escala(3, noite) < escala(4, noite), 'mais gente, mais zumbis');
  for (const n of [2, 3, 4]) assert.ok(escala(n, 0) < escala(n, 2) && escala(n, 2) < escala(n, 4), 'noites mais dificeis');
  assert.ok(velocidade(0, 0) < velocidade(4, 4));
  const tamanho = (n, noite) => { const p = partida(5, n, noite); longe(p); p.dados.imune = p.dados.imune.map(() => 99); roda(p, ONDAS[1] + 0.1); return p.dados.zumbis.length; };
  assert.ok(tamanho(2, 0) < tamanho(4, 0), 'com 4 vem mais zumbis que com 2');
  assert.ok(tamanho(3, 0) < tamanho(3, 4), 'a quinta noite traz mais que a primeira');
});

test('zumbis-coop: com 4 jogadores passa de 4 zumbis nos primeiros 15 s (exigencia do teste de navegador)', () => {
  const p = partida(1, 4);
  longe(p); p.dados.imune = p.dados.imune.map(() => 99);
  let maior = 0;
  for (let q = 0; q < 15 * 60; q++) { passo(p, DT); maior = Math.max(maior, p.dados.zumbis.length); }
  assert.ok(maior >= 4, 'chegou a ' + maior);
});

test('zumbis-coop: nunca mais de 18 zumbis, nunca sai da arena nem vira NaN, e a logica e leve', () => {
  const p = partida(3, 4, 4);
  p.dados.imune = p.dados.imune.map(() => 99);
  const rng = sorteio(9);
  const t0 = performance.now();
  let maior = 0;
  for (let q = 0; q < 60 * 60 && p.fim === undefined; q++) {
    aleatorio(p, q, rng); passo(p, DT);
    maior = Math.max(maior, p.dados.zumbis.length);
    for (const z of p.dados.zumbis) {
      assert.ok(Number.isFinite(z.x) && Number.isFinite(z.z));
      assert.ok(Math.abs(z.x) <= LX && Math.abs(z.z) <= LZ, 'dentro da arena');
    }
  }
  assert.ok(maior <= MAX_ZUMBIS);
  assert.ok(performance.now() - t0 < 1500, 'leve');
});

test('zumbis-coop: justo: o zumbi e sempre mais lento que o jogador', () => {
  for (const noite of [0, 4]) for (let onda = 0; onda < ONDAS.length; onda++) assert.ok(velocidade(noite, onda) + 0.4 < 6, 'mais lento que quem corre');
  const p = quieta(partida(1, 2));
  poe(p, 0, -9, 0); poe(p, 1, 9, 5);
  p.dados.zumbis = [zumbi(0, 0, { v: velocidade(4, 4) })];
  const antes = Math.hypot(p.dados.zumbis[0].x + 9, p.dados.zumbis[0].z);
  roda(p, 2);
  assert.ok(Math.hypot(p.dados.zumbis[0].x + 9, p.dados.zumbis[0].z) < antes, 'ele anda para o jogador');
});

test('zumbis-coop: o placar conta os segundos que faltam para o sol nascer', () => {
  const p = quieta(partida());
  assert.equal(jogo.rotulo, 'o sol nasce em');
  roda(p, 10.5);
  assert.deepEqual(p.dados.placar, [TEMPO - 10]);
  roda(p, TEMPO);
  assert.deepEqual(p.dados.placar.length, 1);
});

test('zumbis-coop: o celular de cada um diz o que fazer agora', () => {
  const p = quieta(partida(1, 3));
  poe(p, 0, 0, 0); poe(p, 1, 9, 6); poe(p, 2, -9, 6);
  roda(p, 0.1);
  assert.match(p.celular[0].texto, /Fiquem juntos/);
  poe(p, 1, 2, 0); roda(p, 0.1);
  assert.match(p.celular[0].texto, /Juntos/);
  p.dados.zumbis = [zumbi(2.5, 0, { pausa: 100 })]; roda(p, 0.1);
  assert.equal(p.celular[0].texto, 'Zumbi perto! Aperte Luz.');
  luzDe(p, 0); roda(p, 0.1);
  p.dados.zumbis = [zumbi(1.5, 0, { atord: 0, pausa: 100 })]; roda(p, 0.1);
  assert.match(p.celular[0].texto, /recarregando/);
  derruba(p, 2); roda(p, 0.1);
  assert.match(p.celular[2].texto, /Você caiu/);
  assert.equal(p.celular[2].a, '');
  assert.match(p.celular[1].texto, /Corra até .* e encoste para levantar/);
});

test('zumbis-coop: textos em portugues claro, sem travessao, sem emoji e sem nome de variavel', () => {
  const fonte = readFileSync(new URL('./zumbis-coop.mjs', import.meta.url), 'utf8');
  assert.ok(!/[–—]/.test(fonte), 'sem travessao');
  assert.ok(!/\p{Extended_Pictographic}/u.test(fonte), 'sem emoji');
  const p = quieta(partida(1, 3));
  poe(p, 0, 0, 0); poe(p, 1, 2, 0); poe(p, 2, 9, 6);
  const vistos = new Set();
  p.dados.zumbis = [zumbi(1, 0, { pausa: 100 })];
  for (let k = 0; k < 600; k++) {
    if (k === 60) luzDe(p, 0);
    if (k === 200) derruba(p, 2);
    passo(p, DT);
    [p.dados.aviso, ...p.celular.map(c => c.texto), ...p.dados.inventario.flat(), p.celular[0].a].forEach(t => t && vistos.add(String(t)));
  }
  for (const t of vistos) {
    assert.ok(!/undefined|NaN|null|\[object|[a-z]+[A-Z]|_/.test(t), 'texto com cara de variavel: ' + t);
    assert.ok(!/[–—]/.test(t));
  }
  assert.ok(vistos.size >= 5);
});

test('zumbis-coop: com 2, 3 e 4 jogadores roda inteiro, parado e com dedos aleatorios, desenhando, sem erro', () => {
  for (const n of [2, 3, 4]) {
    const vencedores = fumaca(jogo, { n, modo: 'coop' });
    assert.equal(vencedores.length, 15);
    assert.ok(vencedores.every(v => v === 2 || v === -1), 'so 2 ou -1: ' + vencedores);
  }
});

test('zumbis-coop: com 2 jogadores e dedos aleatorios, nenhuma de 200 rodadas acaba em menos de 5 s', () => {
  let menor = Infinity;
  for (let s = 1; s <= 200; s++) {
    const p = partida(s, 2), rng = sorteio(s + 500);
    let q = 0;
    for (; q < 60 * 60 && p.fase === 'jogando'; q++) { aleatorio(p, q, rng); passo(p, DT); }
    menor = Math.min(menor, q * DT);
  }
  assert.ok(menor >= 5, 'a mais curta durou ' + menor.toFixed(2) + ' s');
});

// Jogador com intencao: foge do zumbi perto, acende a luz, ajuda quem caiu e fica perto de um amigo.
function jogadorAtento(p, k, est, rng) {
  const d = p.dados;
  p.jogadores.forEach((j, i) => {
    const e = est[i] ??= { n: 0, x: 0, y: 0 };
    if (d.caido[i]) { entrada(p, i, { x: 0, y: 0, d: false, n: e.n }); return; }
    if (k % 12 === 0) {
      let z0 = null, m0 = Infinity;
      for (const z of d.zumbis) { const m = Math.hypot(z.x - j.x, z.z - j.z); if (z.nasce <= 0 && m < m0) { m0 = m; z0 = z; } }
      const alvoDe = f => { let b = null, mb = Infinity; p.jogadores.forEach((q, a) => { const m = Math.hypot(q.x - j.x, q.z - j.z); if (a !== i && f(a) && m < mb) { mb = m; b = q; } }); return b && { q: b, m: mb }; };
      const cai = alvoDe(a => d.caido[a]), amigo = alvoDe(a => !d.caido[a]);
      let ox = 0, oz = 0;
      if (z0 && m0 < 4) { ox = (j.x - z0.x) / m0; oz = (j.z - z0.z) / m0; }
      else if (cai) { ox = (cai.q.x - j.x) / (cai.m || 1); oz = (cai.q.z - j.z) / (cai.m || 1); }
      else if (amigo && amigo.m > 3) { ox = (amigo.q.x - j.x) / amigo.m; oz = (amigo.q.z - j.z) / amigo.m; }
      if (Math.abs(j.x) > 9.5) ox -= Math.sign(j.x);
      if (Math.abs(j.z) > 6) oz -= Math.sign(j.z);
      e.x = ox; e.y = oz;
      if (z0 && m0 < 3.2 && d.carga[i] >= 1) e.n++;
    }
    entrada(p, i, { x: e.x, y: e.y, d: false, n: e.n });
  });
}

test('zumbis-coop: familia atenta (foge, usa a luz, fica junta e ajuda) vence quase sempre na 1a noite, com 2, 3 e 4', () => {
  for (const n of [2, 3, 4]) {
    let vitorias = 0;
    const total = 12;
    for (let s = 1; s <= total; s++) {
      const p = partida(s * 3, n, 0), est = [], rng = sorteio(s);
      for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) { jogadorAtento(p, k, est, rng); passo(p, DT); }
      if (p.vencedor === 2) vitorias++;
    }
    assert.ok(vitorias >= total * 0.75, `n=${n}: so ${vitorias} de ${total}`);
  }
});

// Robo lento (a crianca distraida): reage a cada 0,5 s, em 40% das vezes se distrai (parado ou andando a toa), foge do zumbi perto,
// aperta Luz, vai ao amigo caido e ao amigo em pe, sem otimizar rota.
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ ate: 0, x: 0, y: 0, n: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (d.caido[i]) { entrada(p, i, { x: 0, y: 0, d: false, n: e.n }); return; }
      if (t >= e.ate) {
        e.ate = t + 0.5; e.x = e.y = 0;
        if (rng() < 0.4) { if (rng() < 0.5) { const a = rng() * 6.283; e.x = Math.cos(a); e.y = Math.sin(a); } }
        else {
          let z0 = null, m0 = Infinity, cai = null, mc = Infinity, am = null, ma = Infinity;
          for (const z of d.zumbis) { const m = Math.hypot(z.x - j.x, z.z - j.z); if (z.nasce <= 0 && m < m0) { m0 = m; z0 = z; } }
          p.jogadores.forEach((o, k) => {
            const m = Math.hypot(o.x - j.x, o.z - j.z);
            if (k === i) return;
            if (d.caido[k] && m < mc) { mc = m; cai = o; }
            if (!d.caido[k] && m < ma) { ma = m; am = o; }
          });
          const rumo = (q, m) => { e.x = (q.x - j.x) / (m || 1); e.y = (q.z - j.z) / (m || 1); };
          if (z0 && m0 < 4) { e.x = (j.x - z0.x) / m0; e.y = (j.z - z0.z) / m0; }
          else if (cai) rumo(cai, mc);
          else if (am && ma > 3) rumo(am, ma);
          if (Math.abs(j.x) > 9.5) e.x -= Math.sign(j.x);
          if (Math.abs(j.z) > 6) e.y -= Math.sign(j.z);
          if (z0 && m0 < 3.2 && d.carga[i] >= 1) e.n++;
        }
      }
      entrada(p, i, { x: e.x, y: e.y, d: false, n: e.n });
    });
  };
}
function taxaLenta(n, noite, total = 100) {
  let v = 0;
  for (let s = 1; s <= total; s++) {
    const p = partida(s, n, noite), joga = roboLento(p, sorteio(s * 7 + 3));
    for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) { joga(k); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / total;
}

test('zumbis-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil', () => {
  const a = taxaLenta(2, 0), b = taxaLenta(2, 4);
  assert.ok(a >= 0.85, 'noite 1: ' + a);
  assert.ok(b >= 0.6, 'noite 5: ' + b);
  assert.ok(b < a, `noite 5 (${b}) deveria ser mais dificil que a 1 (${a})`);
});

test('zumbis-coop: com 3 e 4 jogadores o robo lento tambem vence a maioria nas duas noites, mas parados perdem sempre', () => {
  for (const n of [3, 4]) {
    assert.ok(taxaLenta(n, 0, 40) >= 0.7, 'n ' + n + ' noite 1');
    assert.ok(taxaLenta(n, 4, 40) >= 0.6, 'n ' + n + ' noite 5');
    for (const noite of [0, 4]) { const p = partida(2, n, noite); roda(p, TEMPO + 2); assert.equal(p.fim, -1, `${n} parados na noite ${noite + 1}`); }
  }
});

test('zumbis-coop: esconde o nome flutuante (semNome): os bonecos se juntam e a cor do disco diz quem e quem', () => {
  assert.equal(jogo.semNome, true);
});

test('zumbis-coop: ficar parado nao basta: com 4 parados os zumbis vencem a noite', () => {
  const p = partida(1, 4, 0);
  roda(p, TEMPO + 2);
  assert.equal(p.fim, -1);
});

test('zumbis-coop: a camera mostra a arena inteira, de cima', () => {
  const cam = jogo.camera();
  assert.ok(cam.y >= 18 && cam.y > cam.z, 'olha de cima');
  assert.ok(Number.isFinite(cam.ox + cam.oy + cam.oz));
});

test('zumbis-coop: desenho: zumbi com bracos, cabeca verde, nasce da terra, fica tonto com estrelas e some ao ser destruido', () => {
  for (const comModelos of [false, true]) {
    const p = partidaCom(jogo, sorteio(3), { n: 4, modo: 'coop' });
    const c = contexto(p, comModelos);
    jogo.monta(c);
    p.dados.zumbis.length = 0;
    p.dados.zumbis.push(zumbi(2, 2, { ang: 0.5 }), zumbi(-2, 2, { atord: 2 }), zumbi(0, -2, { nasce: 1.2 }), zumbi(3, -3, { morre: 0.2 }));
    jogo.desenha(c, DT, 1);
    const [anda, tonto, nasce, morre] = c.pecas.zumbis;
    for (const o of [anda, tonto]) for (const parte of ['pE', 'pD', 'corpo', 'bE', 'bD', 'cabeca', 'estrelas']) assert.ok(o.userData[parte], parte);
    assert.ok(Math.abs(anda.rotation.y + 0.5) < 1e-9, 'vira para onde anda');
    assert.equal(anda.userData.estrelas.visible, false);
    assert.equal(tonto.userData.estrelas.visible, true);
    assert.ok(nasce.position.y < -1, 'saindo da terra');
    assert.ok(morre.scale.x < anda.scale.x, 'encolhe ao ser destruido');
    assert.ok(anda.scale.x >= 1.6, 'grande o bastante para a TV');
    assert.ok(c.pecas.covas.length === COVAS.length);
    assert.ok(c.pecas.jog.length === 4);
  }
});

test('zumbis-coop: desenho do relogio: a bola do sol anda da esquerda para a direita e o chao esquenta', () => {
  const p = partidaCom(jogo, sorteio(3), { n: 2, modo: 'coop' });
  const c = contexto(p, false);
  jogo.monta(c);
  p.t = 0; jogo.desenha(c, DT, 0);
  const x0 = c.pecas.astro.position.x, op0 = c.pecas.alvorada.material.opacity;
  p.t = TEMPO * 0.95; jogo.desenha(c, DT, 1);
  assert.ok(c.pecas.astro.position.x > x0 + 8);
  assert.ok(c.pecas.alvorada.material.opacity > op0);
});

test('zumbis-coop: desenho de caido, alcance da luz e elo entre amigos', () => {
  const p = quieta(partidaCom(jogo, sorteio(3), { n: 3, modo: 'coop' }));
  const c = contexto(p, false);
  jogo.monta(c);
  poe(p, 0, 0, 0); poe(p, 1, 2, 0); poe(p, 2, -8, 5); derruba(p, 2); p.dados.rev[2] = 1;
  jogo.desenha(c, DT, 1);
  assert.equal(c.pecas.elos.filter(e => e.visible).length, 1, 'um elo entre os dois em pe');
  assert.equal(c.pecas.jog[2].seta.visible, true);
  assert.equal(c.pecas.jog[2].prog.visible, true);
  assert.equal(c.pecas.jog[0].alcance.visible, true);
  assert.equal(c.bonecos[2].rotation.z, Math.PI / 2, 'deitado');
});

test('zumbis-coop: os modelos pedidos existem em modelos/ com nome valido e licenca CC0 ao lado', () => {
  assert.deepEqual(jogo.modelos, MODELOS);
  for (const nome of MODELOS) {
    assert.match(nome, /^[a-z0-9_-]+\/[a-z0-9_-]+$/, nome);
    assert.ok(existsSync(new URL(`../modelos/${nome}.glb`, import.meta.url)), nome + ' nao existe');
  }
  for (const pacote of new Set(MODELOS.map(n => n.split('/')[0])))
    assert.match(readFileSync(new URL(`../modelos/${pacote}/License.txt`, import.meta.url), 'utf8'), /Creative Commons Zero, CC0/, pacote);
});

test('zumbis-coop: tamanho das ondas e limites coerentes', () => {
  assert.equal(ONDAS.length, TAMANHO.length);
  assert.ok(ONDAS.every((t, k) => k === 0 || t > ONDAS[k - 1]));
  assert.ok(ONDAS[0] >= 2.5, 'ninguem cai antes de entender o jogo');
  assert.ok(ONDAS.at(-1) < TEMPO - 5);
  assert.ok(R_LUZ < R_JUNTOS && R_REVIVE > 1.5 && LIGA > R_LUZ);
});
