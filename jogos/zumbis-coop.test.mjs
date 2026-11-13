import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, contexto, sorteio, aleatorio, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, HX, HZ, ENTRADAS, TEMPO } from './zumbis-coop.mjs';

// Partida cooperativa de n jogadores (modo coop da Festa). O resultado vem do motor de verdade: p.fase e p.vencedor.
function partida(semente = 1, n = 2) {
  const p = partidaCom(jogo, sorteio(semente), { n, modo: 'coop' });
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  Object.defineProperty(p, 'fim', { get() { return p.fase === 'jogando' ? undefined : p.vencedor; }, configurable: true });
  return p;
}
function quieta(p) {                                   // sem ondas nem itens: cenario montado pelo teste
  p.dados.proxOnda = Infinity; p.dados.proxItem = Infinity;
  return p;
}
function roda(p, segundos) { for (let i = 0; i < segundos * 60 && p.fim === undefined; i++) passo(p, DT); }
function zumbi(x, z, extra = {}) { return { x, z, kx: 0, kz: 0, ang: 0, v: 2.2, atord: 0, pausa: 0, re: 0, wp: null, fase: 1, alvo: 0, ...extra }; }
function poe(p, i, x, z) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }
let toque = [0, 0, 0, 0];
function toca(p, i) { toque[i]++; entrada(p, i, { x: 0, y: 0, d: false, n: toque[i] }); }
function segura(p, i, sim) { entrada(p, i, { x: 0, y: 0, d: sim, n: toque[i] }); }

test('zumbis-coop: sobreviver ate o fim retorna 2 (vitoria em equipe)', () => {
  const p = quieta(partida());
  let quadros = 0;
  while (p.fim === undefined && quadros < 60 * (TEMPO + 2)) { passo(p, DT); quadros++; }
  assert.equal(p.fim, 2);
  assert.ok(Math.abs(quadros / 60 - TEMPO) < 0.1, 'terminou no tempo certo: ' + quadros / 60);
  assert.ok(TEMPO <= 60, 'respeita o limite de 60 s do contrato');
});

test('zumbis-coop: os dois caidos retornam -1 na hora', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, 6, 0);
  p.dados.zumbis = [zumbi(-6, 0), zumbi(6, 0)];
  roda(p, 1);
  assert.equal(p.fim, -1);
  assert.deepEqual(p.dados.caido, [true, true]);
  assert.ok(p.t < 1, 'sem esperar o tempo acabar');
});

test('zumbis-coop: zumbi que encosta derruba um so, vibra o celular dele e o outro continua em pe', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, 6, 5);
  p.dados.zumbis = [zumbi(-6, 0)];
  roda(p, 0.2);
  assert.deepEqual(p.dados.caido, [true, false]);
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[1].vibra, undefined);
  assert.equal(p.fim, undefined);
});

test('zumbis-coop: segurar A perto do parceiro por 1,5 s revive (e menos tempo nao basta)', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, -4.8, 0);
  p.dados.caido[0] = true; p.dados.pos[0] = { x: -6, z: 0 };
  segura(p, 1, true);
  roda(p, 1.2);
  assert.equal(p.dados.caido[0], true, 'ainda caido com 1,2 s');
  assert.ok(p.dados.rev[0] > 1);
  roda(p, 0.5);
  assert.equal(p.dados.caido[0], false, 'revivido depois de 1,5 s');
  assert.ok(p.dados.imune[0] > 0, 'volta imune por um instante');
  assert.equal(p.dados.pontos, 25);
  assert.equal(p.fim, undefined);
});

test('zumbis-coop: soltar A zera aos poucos e longe nao revive', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, 6, 0);
  p.dados.caido[0] = true; p.dados.pos[0] = { x: -6, z: 0 };
  segura(p, 1, true);
  roda(p, 3);
  assert.equal(p.dados.caido[0], true);
  poe(p, 1, -4.8, 0);
  segura(p, 1, true); roda(p, 1);
  segura(p, 1, false); roda(p, 1);
  assert.equal(p.dados.rev[0], 0, 'perdeu o progresso ao soltar');
});

test('zumbis-coop: kit medico revive na hora com um toque em A', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, -4.8, 0);
  p.dados.caido[0] = true; p.dados.pos[0] = { x: -6, z: 0 };
  p.dados.inv[1].kit = 1;
  toca(p, 1);
  roda(p, 0.1);
  assert.equal(p.dados.caido[0], false);
  assert.equal(p.dados.inv[1].kit, 0, 'o kit foi gasto');
});

test('zumbis-coop: toque curto (contador) nao se perde: tapa mesmo com o dedo ja solto', () => {
  const p = quieta(partida());
  const e = ENTRADAS[0];
  poe(p, 0, e.fora.x, e.fora.z);
  p.dados.inv[0].tabua = 1;
  toque[0] = 0; entrada(p, 0, { x: 0, y: 0, d: false, n: 0 });
  entrada(p, 0, { x: 0, y: 0, d: true, n: 1 });        // desceu
  entrada(p, 0, { x: 0, y: 0, d: false, n: 1 });       // e soltou antes do quadro
  passo(p, DT);
  assert.ok(p.dados.tabua[0] > 0, 'a tabua foi pregada');
  assert.equal(p.dados.inv[0].tabua, 0);
});

test('zumbis-coop: tabua bloqueia a entrada e demora para quebrar', () => {
  const montar = tabuado => {
    const p = quieta(partida());
    poe(p, 0, 0, 0); poe(p, 1, 0.8, 0.6);               // dentro da casa
    if (tabuado) p.dados.tabua = [0, 1, 2].map(() => 8);
    p.dados.zumbis = [zumbi(-1.4, -HZ - 1.8, { ang: Math.PI / 2 })];   // na frente da porta norte
    p.dados.zumbis[0].alvo = 0;
    return p;
  };
  const livre = montar(false);
  roda(livre, 6);
  assert.ok(Math.abs(livre.dados.zumbis[0].z) < HZ || livre.dados.caido.some(Boolean), 'sem tabua o zumbi entra');

  const fechada = montar(true);
  roda(fechada, 3);
  const z = fechada.dados.zumbis[0];
  assert.ok(z.z < -HZ, 'segue do lado de fora depois de 3 s: z=' + z.z);
  assert.ok(fechada.dados.tabua.some(h => h > 0 && h < 8), 'a tabua esta sendo quebrada');
  assert.deepEqual(fechada.dados.caido, [false, false]);
  roda(fechada, 12);
  assert.ok(fechada.dados.quebradas >= 1, 'no fim ela quebra');
});

test('zumbis-coop: o jogador tambem nao atravessa a tabua', () => {
  const p = quieta(partida());
  const e = ENTRADAS[2];
  p.dados.tabua[2] = 8;
  poe(p, 0, e.fora.x, 0);
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  roda(p, 1.5);
  assert.ok(p.jogadores[0].x < -HX, 'ficou do lado de fora: x=' + p.jogadores[0].x);
});

test('zumbis-coop: A perto da entrada, com tabua na mochila, tapa; sem tabua nao faz nada', () => {
  const p = quieta(partida());
  const e = ENTRADAS[1];
  poe(p, 1, e.fora.x, e.fora.z);
  toca(p, 1); roda(p, 0.1);
  assert.equal(p.dados.tabua[1], 0, 'sem tabua nada acontece');
  p.dados.inv[1].tabua = 1;
  toca(p, 1); roda(p, 0.1);
  assert.equal(p.dados.tabua[1], 8);
});

test('zumbis-coop: lanterna atordoa os zumbis perto e deixa os longe em paz', () => {
  const p = quieta(partida());
  poe(p, 0, 7, -5);
  p.dados.inv[0].lanterna = 1;
  p.dados.zumbis = [zumbi(5.6, -5), zumbi(7, -3.5), zumbi(-8, 5)];
  toca(p, 0); roda(p, 0.05);
  const [a, b, longe] = p.dados.zumbis;
  assert.ok(a.atord > 2 && b.atord > 2, 'os dois perto ficam tontos');
  assert.ok(longe.atord <= 0, 'o longe nao');
  assert.equal(p.dados.inv[0].lanterna, 0);
  const antes = { x: a.x, z: a.z };
  roda(p, 1);
  assert.ok(Math.hypot(a.x - antes.x, a.z - antes.z) < 3, 'tonto so desliza do empurrao, nao persegue');
  assert.deepEqual(p.dados.caido, [false, false], 'ninguem caiu enquanto estavam tontos');
});

test('zumbis-coop: itens valem pontos de equipe e a mochila tem limite', () => {
  const p = quieta(partida());
  poe(p, 0, -6, 0); poe(p, 1, 6, 5);
  p.dados.itens = [{ tipo: 'moeda', x: -6, z: 0, vida: 9 }, { tipo: 'tabua', x: -6.2, z: 0, vida: 9 }, { tipo: 'kit', x: 6, z: 5, vida: 9 }];
  roda(p, 0.1);
  assert.equal(p.dados.pontos, 10 + 5 + 5);
  assert.deepEqual(p.dados.placar.slice(0, 1), [20]);
  assert.equal(p.dados.inv[0].tabua, 1);
  assert.equal(p.dados.inv[1].kit, 1);
  p.dados.inv[0].tabua = 2;
  p.dados.itens = [{ tipo: 'tabua', x: -6, z: 0, vida: 9 }];
  roda(p, 0.1);
  assert.equal(p.dados.itens.length, 1, 'mochila cheia: o item fica');
});

test('zumbis-coop: B corre e a corrida tem recarga', () => {
  const p = quieta(partida());
  poe(p, 0, -9, -6); poe(p, 1, 6, 5);
  entrada(p, 0, { x: 1, y: 0, nb: 1 });
  roda(p, 0.3);
  assert.ok(p.dados.corre[0] > 0 && p.dados.cdCorre[0] > 0);
  const v = Math.hypot(p.jogadores[0].vx, p.jogadores[0].vz);
  assert.ok(v > 7.6 && v <= 11.6, 'mais rapido que andar: ' + v);
});

test('zumbis-coop: nunca mais de 20 zumbis e as ondas crescem', () => {
  const p = partida(3);
  p.dados.zumbis = Array.from({ length: 17 }, (_, i) => zumbi(-10 + i, 6.8));    // quase cheio: a onda nova so completa ate 20
  let max = 0;
  const n = []; let ultima = 0;
  for (let i = 0; i < 50 * 60 && p.fim === undefined; i++) {
    passo(p, DT); max = Math.max(max, p.dados.zumbis.length);
    p.dados.imune = [1e9, 1e9];                        // imortais, so para contar
    if (p.dados.onda !== ultima) { ultima = p.dados.onda; n.push(p.dados.zumbis.length); }
  }
  assert.ok(max <= 20, 'no maximo 20: ' + max);
  assert.ok(n.length >= 5 && n.every((v, k) => k === 0 || v >= n[k - 1]), 'crescem: ' + n);
});

test('zumbis-coop: zumbi nunca sai da arena nem vira NaN', () => {
  const p = partida(4);
  const r = sorteio(9);
  for (let i = 0; i < 55 * 60 && p.fim === undefined; i++) {
    if (i % 20 === 0) for (const k of [0, 1]) entrada(p, k, { x: r() * 2 - 1, y: r() * 2 - 1, d: r() < 0.3, n: toque[k] });
    if (i % 300 === 0) for (const z of p.dados.zumbis) { z.kx = (r() - 0.5) * 80; z.kz = (r() - 0.5) * 80; }   // empurroes violentos
    p.dados.imune = [1e9, 1e9];
    passo(p, DT);
    for (const z of p.dados.zumbis) {
      assert.ok(Number.isFinite(z.x) && Number.isFinite(z.z), 'posicao valida');
      assert.ok(Math.abs(z.x) <= LX && Math.abs(z.z) <= LZ, `fora da arena: ${z.x}, ${z.z}`);
    }
  }
  assert.ok(p.dados.zumbis.length > 10);
});

test('zumbis-coop: zumbi contorna a casa e entra pela porta aberta para chegar ao jogador', () => {
  const p = quieta(partida());
  poe(p, 0, 0, 0); poe(p, 1, 0.6, 0.5);
  p.dados.imune = [99, 99];
  p.dados.zumbis = [zumbi(HX + 2.5, 0, { v: 3 })];      // do lado leste, a parede leste fecha o caminho
  let entrou = false;
  for (let i = 0; i < 20 * 60 && !entrou; i++) { passo(p, DT); entrou = Math.abs(p.dados.zumbis[0].x) < HX - 0.5 && Math.abs(p.dados.zumbis[0].z) < HZ - 0.5; }
  assert.ok(entrou, 'o zumbi chegou dentro da casa');
});

test('zumbis-coop: justo, sempre mais lentos que o jogador e nunca nascem em cima de quem esta em pe', () => {
  for (const s of [11, 12, 13]) {
    const p = partida(s);
    p.dados.imune = [1e9, 1e9];
    let vistos = 0, maisLento = 0, maisPerto = Infinity;
    for (let i = 0; i < TEMPO * 60 && p.fim === undefined; i++) {
      const antes = p.dados.zumbis.length;
      passo(p, DT);
      for (const z of p.dados.zumbis.slice(antes)) {
        maisPerto = Math.min(maisPerto, ...p.jogadores.map(j => Math.hypot(j.x - z.x, j.z - z.z)));
        assert.ok(z.pausa > 0, 'nasce levantando, sem atacar de imediato');
      }
      for (const z of p.dados.zumbis) { maisLento = Math.max(maisLento, z.v); vistos++; }
    }
    assert.ok(vistos > 0 && maisLento < 3.2 && maisLento < 7.5 / 2, 'zumbi bem mais lento que o jogador: ' + maisLento);
    assert.ok(maisPerto > 4, 'nasce longe dos jogadores parados: ' + maisPerto.toFixed(1));
  }
  const parada = partida(11); roda(parada, TEMPO + 3);
  assert.equal(parada.fim, -1, 'parados no meio do quintal, os dois caem');
});

test('zumbis-coop: desempenho, 20 zumbis por 60 s em menos de 400 ms de logica (isolado leva uns 130 ms; a folga cobre a maquina ocupada)', () => {
  const p = quieta(partida(5));
  p.dados.zumbis = [];
  for (let i = 0; i < 20; i++) p.dados.zumbis.push(zumbi(-10 + i, i % 2 ? 7 : -7, { v: 3, fase: i }));
  p.dados.imune = [1e9, 1e9];
  for (const j of p.jogadores) j.ent = { x: 0, y: 0, d: false, b: false };
  const t0 = process.cpuUsage();
  for (let i = 0; i < 60 * 60; i++) {
    p.t = i * DT;
    const a = i * DT * 0.9;                              // jogadores dando voltas, os zumbis perseguem
    p.jogadores[0].x = Math.cos(a) * 6; p.jogadores[0].z = Math.sin(a) * 4;
    p.jogadores[1].x = -Math.cos(a) * 6; p.jogadores[1].z = -Math.sin(a) * 4;
    jogo.atualiza(p, DT);
  }
  const c = process.cpuUsage(t0), ms = (c.user + c.system) / 1000;
  console.log('cpu de logica: ' + ms.toFixed(1) + ' ms');
  assert.ok(ms < 400, 'cpu ' + ms.toFixed(1) + ' ms');
  assert.equal(p.dados.zumbis.length, 20);
});

test('zumbis-coop: contrato da festa (so coop, de 2 a 4) e 45 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.duracao, 45);
  assert.equal(TEMPO, 45);
});

test('zumbis-coop: roda inteiro com 2, 3 e 4 jogadores, parado e com dedos aleatorios, desenhando, sem erro', () => {
  for (const n of [2, 3, 4]) {
    const vencedores = fumaca(jogo, { n, modo: 'coop' });
    assert.equal(vencedores.length, 15);
    assert.ok(vencedores.every(v => v === 2 || v === -1), 'so 2 ou -1: ' + vencedores);
  }
});

test('zumbis-coop: vitoria de todos da 1 ponto para cada um, pelo motor', () => {
  const p = quieta(partida(1, 4));
  roda(p, TEMPO + 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1, 1]);
});

test('zumbis-coop: com 4, basta um em pe no fim para todos vencerem; so perdem se todos cairem', () => {
  const p = quieta(partida(1, 4));
  [0, 1, 2].forEach(i => { p.dados.caido[i] = true; p.dados.pos[i] = { x: -9 + i, z: 6 }; poe(p, i, -9 + i, 6); });
  poe(p, 3, 0, 0);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 2, 'tres caidos e um em pe: vitoria');
  const q = quieta(partida(1, 4));
  q.jogadores.forEach((j, i) => { poe(q, i, -6 + i * 4, -5); });
  q.dados.zumbis = q.jogadores.map(j => zumbi(j.x, j.z));
  roda(q, 1);
  assert.deepEqual(q.dados.caido, [true, true, true, true]);
  assert.equal(q.vencedor, -1);
  assert.ok(q.t < 1);
});

test('zumbis-coop: com 3 o zumbi derruba so um e so o celular dele vibra', () => {
  const p = quieta(partida(1, 3));
  poe(p, 0, -6, 4); poe(p, 1, 6, 4); poe(p, 2, 0, -5.5);
  p.dados.zumbis = [zumbi(6, 4)];
  roda(p, 0.2);
  assert.deepEqual(p.dados.caido, [false, true, false]);
  assert.equal(p.celular[1].vibra, 1);
  assert.equal(p.celular[0].vibra, undefined);
  assert.equal(p.celular[2].vibra, undefined);
});

test('zumbis-coop: o parceiro mais perto e quem socorre e o botao A mostra REVIVER so para quem esta perto', () => {
  const p = quieta(partida(1, 4));
  poe(p, 0, -6, 4); poe(p, 1, -4.9, 4); poe(p, 2, 6, 4); poe(p, 3, 6, -5);
  p.dados.caido[0] = true; p.dados.pos[0] = { x: -6, z: 4 };
  segura(p, 1, true);
  roda(p, 0.2);
  assert.equal(p.celular[1].a, 'REVIVER');
  assert.equal(p.celular[2].a, 'USAR');
  assert.equal(p.celular[0].a, '', 'quem caiu nao tem botao');
  roda(p, 1.4);
  assert.equal(p.dados.caido[0], false);
});

test('zumbis-coop: dois socorristas revivem na metade do tempo', () => {
  const p = quieta(partida(1, 4));
  poe(p, 0, -6, 4); poe(p, 1, -4.9, 4); poe(p, 2, -6, 2.9); poe(p, 3, 6, -5);
  p.dados.caido[0] = true; p.dados.pos[0] = { x: -6, z: 4 };
  segura(p, 1, true); segura(p, 2, true);
  roda(p, 0.85);
  assert.equal(p.dados.caido[0], false, 'dois juntos: menos de 0,85 s');
});

test('zumbis-coop: com mais jogadores as ondas trazem mais zumbis (e continuam no maximo de 20)', () => {
  const primeira = n => { const p = partida(2, n); p.dados.imune = p.dados.imune.map(() => 1e9); roda(p, 4); return p.dados.zumbis.length; };
  assert.ok(primeira(4) > primeira(2), primeira(4) + ' contra ' + primeira(2));
  const p = partida(3, 4);
  p.dados.imune = p.dados.imune.map(() => 1e9);
  let max = 0;
  for (let i = 0; i < 44 * 60; i++) { passo(p, DT); max = Math.max(max, p.dados.zumbis.length); p.dados.imune = p.dados.imune.map(() => 1e9); }
  assert.ok(max <= 20);
});

test('zumbis-coop: o placar mostra so os pontos da equipe (a onda nao e placar de disputa)', () => {
  const p = quieta(partida(1, 3));
  assert.deepEqual(p.dados.placar, [0]);
  assert.equal(jogo.rotulo, 'pontos da equipe');
  p.dados.itens = [{ tipo: 'moeda', x: p.jogadores[0].x, z: p.jogadores[0].z, vida: 9 }];
  roda(p, 0.1);
  assert.deepEqual(p.dados.placar, [10]);
});

test('zumbis-coop: a camera mostra a vila inteira, de cima', () => {
  const cam = jogo.camera();
  assert.ok(cam.y >= 18 && cam.y > cam.z, 'olha de cima');
  assert.ok(Number.isFinite(cam.ox + cam.oy + cam.oz));
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
