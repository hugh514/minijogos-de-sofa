import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entrada, passo, GENEROS } from '../logica.mjs';
import { partidaCom, sorteio, aleatorio, fumaca, rodada, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, RIO, ZB, IMPULSO, JUNTA, LIMITE_X, distanciaDe, padroesDe, assentos, ladoDe, ameaca } from './canoa-coop.mjs';

// Partida cooperativa de n jogadores na noite dada (0 a 4), no primeiro quadro de jogo.
function partida(semente = 1, n = 2, noite = 0) {
  const p = partidaCom(jogo, sorteio(semente), { n, modo: 'coop' });
  p.noites.jogadas = noite; jogo.inicia(p);
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  p.toques = Array(n).fill(0);
  return p;
}
const roda = (p, s) => { for (let i = 0; i < s * 60 && p.fase === 'jogando'; i++) passo(p, DT); };
const toca = (p, i) => { p.toques[i]++; entrada(p, i, { x: 0, y: 0, d: false, n: p.toques[i] }); };
const semPedras = p => { p.dados.pedras = []; p.dados.estrelas = []; return p; };

// Robo de dedos: cada jogador toca Remar a "hz" vezes por segundo (com variacao). Com "olha", o lado que nao precisa virar descansa
// quando ha pedra no caminho. "lento" e a chance de deixar de tocar. Devolve a rodada ja decidida.
function joga(n, noite, semente, { hz = 2.2, olha = true, lento = 0 } = {}) {
  const p = partida(semente, n, noite), rng = sorteio(semente + 31);
  const prox = Array(n).fill(0).map(() => rng() * 0.4);
  let q = 0;
  while (p.fase === 'jogando') {
    const t = q * DT, a = olha ? ameaca(p.dados) : null;
    for (let i = 0; i < n; i++) {
      if (t < prox[i]) continue;
      const descansa = a && a.quer !== 0 && ladoDe(i) !== -a.quer && rng() < 0.9;
      if (!descansa && rng() > lento) toca(p, i);
      prox[i] = t + (1 / hz) * (0.6 + rng() * 0.8);
    }
    passo(p, DT); q++;
  }
  return { p, v: p.vencedor, seg: q * DT };
}
const vitorias = (n, noite, opcoes, de = 24) => { let w = 0; for (let s = 1; s <= de; s++) if (joga(n, noite, s, opcoes).v === 2) w++; return w / de; };

test('canoa-coop: contrato da festa, botao unico Remar e dica curta citando o botao', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.id, 'canoa-coop');
  assert.ok(GENEROS.includes(jogo.genero));
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 30 && TEMPO <= 45);
  assert.equal(jogo.controle.modo, 'botao');
  assert.equal(jogo.controle.a, 'Remar');
  assert.match(jogo.dica, /Remar/);
  assert.ok(jogo.dica.length < 100 && !/[—–]/.test(jogo.dica));
  assert.equal(jogo.semMovimento, true, 'quem move o bote e o minijogo, nao o joystick');
});

test('canoa-coop: cada lugar rema de um lado (1o e 3o na esquerda, 2o e 4o na direita) e o bote tem lugar para todos', () => {
  assert.deepEqual([0, 1, 2, 3].map(ladoDe), [-1, 1, -1, 1]);
  for (const n of [2, 3, 4]) {
    const ass = assentos(n);
    assert.equal(ass.length, n);
    for (const [x, z] of ass) assert.ok(Math.abs(x) <= 1.1 && Math.abs(z) < 2.5, 'dentro do bote');
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) assert.ok(Math.hypot(ass[a][0] - ass[b][0], ass[a][1] - ass[b][1]) >= 1.6, 'ninguem sentado em cima do outro');
    const p = partida(1, n); semPedras(p);
    assert.deepEqual(p.dados.lado, [0, 1, 2, 3].slice(0, n).map(ladoDe));
  }
});

test('canoa-coop: remar de um lado so vira o bote para o lado contrario; os dois lados iguais seguem reto', () => {
  const e = semPedras(partida());
  toca(e, 0); roda(e, 0.05);
  assert.ok(e.dados.th > 0.1, 'remo esquerdo vira o bote para a direita: ' + e.dados.th);
  const d = semPedras(partida());
  toca(d, 1); roda(d, 0.05);
  assert.ok(d.dados.th < -0.1, 'remo direito vira para a esquerda: ' + d.dados.th);
  const r = semPedras(partida());
  for (let k = 0; k < 12; k++) { toca(r, 0); roda(r, 0.2); toca(r, 1); roda(r, 0.2); }
  assert.ok(Math.abs(r.dados.x) < 0.6 && Math.abs(r.dados.th) < 0.2, 'reto: x=' + r.dados.x + ' th=' + r.dados.th);
  assert.ok(r.dados.s > 10, 'andou');
});

test('canoa-coop: remada junta (os dois lados dentro de 0,3 s) rende mais que os mesmos toques separados', () => {
  const junto = semPedras(partida()), separado = semPedras(partida());
  toca(junto, 0); roda(junto, 0.1); toca(junto, 1); roda(junto, 0.05);
  toca(separado, 0); roda(separado, JUNTA + 0.4); toca(separado, 1); roda(separado, 0.05);
  assert.ok(junto.dados.juntas === 1 && separado.dados.juntas === 0);
  assert.ok(junto.dados.v > separado.dados.v * 1.15, `junto ${junto.dados.v} contra ${separado.dados.v}`);
  assert.ok(junto.dados.sinc > 0, 'a TV mostra o aro dourado da remada junta');
  assert.ok(junto.dados.v <= 2 * IMPULSO * 1.6 + 1e-9);
});

test('canoa-coop: sozinho nao da: um lado so gira, bate na margem e nao termina; os dois juntos terminam', () => {
  for (const lado of [0, 1]) {
    const p = semPedras(partida());
    let q = 0, nn = 0;
    while (p.fase === 'jogando') { if (q % 12 === 0) toca(p, lado); passo(p, DT); q++; }       // 5 toques por segundo, sem parar
    assert.equal(p.vencedor, -1, 'sozinho nao chega no lado ' + lado);
    assert.ok(p.dados.placar[0] < 90, 'ficou longe da chegada: ' + p.dados.placar[0]);
    assert.ok(Math.abs(p.dados.x) <= LIMITE_X + 1e-9);
  }
  const dois = joga(2, 0, 3, { olha: false });
  assert.equal(dois.v, 2);
});

test('canoa-coop: para desviar de uma pedra so um lado rema: o outro descansa', () => {
  const quer = (x, pedraX) => { const p = partida(); p.dados.pedras = [{ s: p.dados.s + 9, x: pedraX, bateu: false }]; p.dados.x = x; return ameaca(p.dados); };
  assert.equal(quer(0, 0).quer !== 0, true, 'pedra no meio: tem que escolher um lado');
  assert.equal(quer(-1, 0).quer, -1, 'o bote esta a esquerda da pedra: desvia para a esquerda');
  assert.equal(quer(1, 0).quer, 1);
  assert.equal(quer(-4, 0), null, 'ja livre da pedra: sem aviso');
  assert.equal(quer(-2.5, -4.2).quer, 1, 'pedra a esquerda: vai para a direita');
  assert.equal(quer(0, -4.2), null, 'pedra fora do caminho: sem aviso');
  // com a pedra bem no meio, so o lado esquerdo remando desvia (vira para a direita); remando juntos bate
  const montada = () => { const p = partida(); p.dados.estrelas = []; p.dados.pedras = [{ s: 22, x: 0.4, bateu: false }]; p.dados.s = 6; return p; };
  const so = montada(); let q = 0;
  while (so.fase === 'jogando' && so.dados.s < 30) { if (q % 12 === 0) toca(so, 0); passo(so, DT); q++; }
  assert.equal(so.dados.pedras[0].bateu, false, 'so o lado esquerdo remando desvia da pedra');
  const juntos = montada(); q = 0;
  while (juntos.fase === 'jogando' && juntos.dados.s < 30) { if (q % 8 === 0) { toca(juntos, 0); toca(juntos, 1); } passo(juntos, DT); q++; }
  assert.equal(juntos.dados.pedras[0].bateu, true, 'remando juntos sem desviar, bate');
});

test('canoa-coop: bater numa pedra so atrasa (perde velocidade, uma vez so, e o celular vibra); estrela da impulso', () => {
  const p = partida(); p.dados.estrelas = [];
  p.dados.pedras = [{ s: 3, x: 0, bateu: false }]; p.dados.v = 5; p.dados.s = 0.5;
  const vibra0 = p.celular.map(c => c.vibra ?? 0);
  roda(p, 0.3);
  assert.equal(p.dados.pedras[0].bateu, true);
  assert.equal(p.dados.batidas, 1);
  assert.ok(p.dados.v < 3, 'perdeu velocidade: ' + p.dados.v);
  assert.ok(p.celular.every((c, i) => (c.vibra ?? 0) > vibra0[i]));
  assert.equal(p.fase, 'jogando', 'pedra nao encerra a rodada');
  roda(p, 2); assert.equal(p.dados.batidas, 1, 'a mesma pedra nao bate de novo');
  const q = partida(); roda(q, 3.1); q.dados.pedras = []; q.dados.estrelas = [{ s: q.dados.s + 2, x: q.dados.x, pegou: false }];
  roda(q, 1);
  assert.equal(q.dados.estrelas[0].pegou, true);
  assert.ok(q.dados.boost > 0 && q.dados.estrelasPegas === 1);
  assert.match(q.celular[0].texto, /Estrela/);
});

test('canoa-coop: chegar ao fim do rio retorna 2 (vitoria em equipe), nunca antes de 5 s, com aviso e celulares no estado final', () => {
  const r = joga(2, 0, 4);
  assert.equal(r.v, 2);
  assert.ok(r.seg > 5 && r.seg < TEMPO, 'levou um tempo: ' + r.seg);
  assert.equal(r.p.dados.fim, 'chegou');
  assert.equal(r.p.dados.placar[0], 100);
  assert.match(r.p.dados.aviso, /Chegaram/);
  r.p.celular.forEach(c => assert.match(c.texto, /Chegaram/));
});

test('canoa-coop: sem remar ninguem chega: retorna -1 so aos 40 s, com aviso e celulares no estado final', () => {
  const p = partida();
  let q = 0; while (p.fase === 'jogando' && q < 60 * (TEMPO + 3)) { passo(p, DT); q++; }
  assert.equal(p.vencedor, -1);
  assert.ok(Math.abs(q / 60 - TEMPO) < 0.1, 'terminou no tempo certo: ' + q / 60);
  assert.equal(p.dados.fim, 'tempo');
  assert.match(p.dados.aviso, /tempo acabou/);
  p.celular.forEach(c => assert.match(c.texto, /tempo acabou/));
  assert.ok(p.dados.s > 30, 'a correnteza leva o bote um pouco mesmo sem remar, mas nao ate o fim');
});

test('canoa-coop: o rio e longo, o bote nao passa do limite e os jogadores ficam sentados no bote', () => {
  const p = partida(3, 4);
  const r = sorteio(5);
  let q = 0;
  while (p.fase === 'jogando') {
    if (q % 9 === 0) toca(p, Math.floor(r() * 4));
    passo(p, DT); q++;
    if (p.fase !== 'jogando') break;
    const d = p.dados;
    assert.ok(Math.abs(d.x) <= LIMITE_X + 1e-9, 'dentro do rio');
    assert.ok(Math.abs(d.x) + 3 < RIO + 2);
    p.jogadores.forEach(j => assert.ok(Math.hypot(j.x - d.x, j.z - ZB) < 3.2, 'sentado no bote'));
  }
});

test('canoa-coop: escala com o numero de jogadores (a forca total e a mesma) e com a noite (rio mais longo, mais tipos de pedra)', () => {
  const forca = n => { const p = semPedras(partida(1, n)); for (let i = 0; i < n; i++) toca(p, i); roda(p, 0.02); return p.dados.v; };
  assert.ok(Math.abs(forca(2) - forca(4)) < 0.05, `n=2 ${forca(2)} e n=4 ${forca(4)}`);
  assert.deepEqual([partida(1, 3).dados.peso[-1], partida(1, 3).dados.peso[1]], [0.5, 1]);
  for (let noite = 0; noite < 4; noite++) {
    assert.ok(distanciaDe(2, noite + 1) > distanciaDe(2, noite), 'rio mais longo a cada noite');
    assert.ok(padroesDe(noite + 1).length >= padroesDe(noite).length);
  }
  assert.deepEqual(padroesDe(0), ['uma']);
  assert.ok(padroesDe(4).includes('vaivem') && padroesDe(4).includes('portao'));
  const pedras = noite => { let t = 0; for (let s = 1; s <= 10; s++) t += partida(s, 2, noite).dados.pedras.length; return t / 10; };
  assert.ok(pedras(4) > pedras(0) * 1.3, `mais pedras na 5a noite: ${pedras(4)} contra ${pedras(0)}`);
  for (const n of [2, 3, 4]) assert.equal(partida(1, n, 2).dados.D, distanciaDe(n, 2));
});

test('canoa-coop: o rio sempre tem passagem (pedras nunca fecham o caminho) em todas as noites', () => {
  for (let s = 1; s <= 20; s++) for (const noite of [0, 2, 4]) {
    const d = partida(s, 2, noite).dados, xs = p => Math.abs(p.x);
    for (const pe of d.pedras) {
      const mesmoTrecho = d.pedras.filter(o => Math.abs(o.s - pe.s) < 1);
      assert.ok(mesmoTrecho.length <= 2);
      if (mesmoTrecho.length === 2) assert.ok(Math.abs(mesmoTrecho[0].x - mesmoTrecho[1].x) >= 6, 'o portao deixa um vao no meio');
      assert.ok(xs(pe) <= LIMITE_X);
    }
    assert.ok(d.pedras.every(pe => pe.s > 15 && pe.s < d.D - 8), 'nada no comeco nem colado na chegada');
  }
});

test('canoa-coop: robo lento (falha 40% dos toques) vence quase sempre com 2 jogadores na 1a noite e na maioria na 5a, que segue mais dificil', () => {
  const lento = { hz: 2.2, olha: true, lento: 0.4 };
  const primeira = vitorias(2, 0, lento, 100), quinta = vitorias(2, 4, lento, 100);
  if (process.env.MEDE) console.log('MEDE canoa', primeira, quinta, vitorias(3, 0, lento, 40), vitorias(4, 4, lento, 40));
  assert.ok(primeira >= 0.85, 'primeira noite: ' + primeira);
  assert.ok(quinta >= 0.6, 'quinta noite: ' + quinta);
  assert.ok(quinta < primeira, 'a quinta noite e mais dificil: ' + quinta + ' contra ' + primeira);
  assert.ok(vitorias(3, 0, lento, 12) >= 0.6 && vitorias(4, 0, lento, 12) >= 0.6, 'com 3 e 4 tambem da para vencer');
});

test('canoa-coop: textos em portugues claro, sem travessao, emoji, caixa alta crua nem nome interno', () => {
  const textos = new Set([jogo.nome, jogo.dica, jogo.controle.a]);
  const ruim = t => /[—–]/.test(t) || /\p{Extended_Pictographic}/u.test(t) || /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b/.test(t) || /undefined|NaN|null|coop|[a-z]+[A-Z]\w*/.test(t);
  for (const [n, noite, semente] of [[2, 0, 4], [3, 2, 5], [4, 4, 6]]) {
    const p = partida(semente, n, noite), rng = sorteio(semente + 31);
    let q = 0;
    while (p.fase === 'jogando') {
      if (q % 15 === 0) for (let i = 0; i < n; i++) if (rng() < 0.7) toca(p, i);
      passo(p, DT); q++;
      textos.add(p.dados.aviso);
      p.celular.forEach(c => { textos.add(c.texto); textos.add(c.a); });
      p.dados.inventario.forEach(l => l.forEach(t => textos.add(t)));
    }
    textos.add(p.dados.aviso); p.celular.forEach(c => textos.add(c.texto));
  }
  for (const t of textos) if (t) assert.ok(!ruim(t), 'texto ruim: ' + t);
  assert.ok(textos.size > 6, 'o teste viu varios textos');
});

test('canoa-coop: o desenho usa so formas do three.js do proprio arquivo', () => {
  const codigo = readFileSync(new URL('./canoa-coop.mjs', import.meta.url), 'utf8');
  assert.ok(!/\.glb|c\.modelo\(/.test(codigo));
  assert.deepEqual([...codigo.matchAll(/^import .* from '(.+)';$/gm)].map(m => m[1]), ['../logica.mjs']);
});

test('canoa-coop: fumaca com 2, 3 e 4 jogadores (parado e 15 rodadas de dedos aleatorios, desenhando de verdade)', () => {
  for (const n of [2, 3, 4]) {
    const vencedores = fumaca(jogo, { n, modo: 'coop' });
    assert.equal(vencedores.length, 15);
    assert.ok(vencedores.every(v => v === 2 || v === -1));
  }
});

test('canoa-coop: entrada aleatoria nao quebra e a rodada sempre termina sozinha', () => {
  for (let s = 20; s < 26; s++) for (const n of [2, 3, 4]) {
    const { p, segundos } = rodada(jogo, aleatorio, s, { n, modo: 'coop' });
    assert.deepEqual(p.erros, []);
    assert.ok(segundos <= TEMPO + 0.1, 'terminou por tempo ou chegada: ' + segundos);
  }
});
