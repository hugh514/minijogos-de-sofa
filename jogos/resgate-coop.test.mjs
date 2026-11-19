import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entrada, passo, GENEROS } from '../logica.mjs';
import { partidaCom, sorteio, aleatorio, fumaca, rodada, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, TEMPO, PEN, R_PEGA, R_GRANDE, SOLTA, R_ESPANTA, T_ACORDA, filhotes, totalDe, velRaposa } from './resgate-coop.mjs';

// Partida cooperativa de n jogadores na noite dada (0 a 4), no primeiro quadro de jogo.
function partida(semente = 1, n = 2, noite = 0) {
  const p = partidaCom(jogo, sorteio(semente), { n, modo: 'coop' });
  p.noites.jogadas = noite; jogo.inicia(p);
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  p.toques = Array(n).fill(0);
  return p;
}
const roda = (p, s) => { for (let i = 0; i < s * 60 && p.fase === 'jogando'; i++) passo(p, DT); };
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
const toca = (p, i) => { p.toques[i]++; entrada(p, i, { x: 0, y: 0, d: false, n: p.toques[i] }); };
const pequeno = p => p.dados.filhotes.find(f => f.tipo === 'p' && f.estado === 'livre');
const grande = p => p.dados.filhotes.find(f => f.tipo === 'g');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Cenario limpo: todos os filhotes ja estao no cercado (so para nao atrapalhar) e os jogadores ficam em fila no meio do campo.
const limpa = p => { for (const f of p.dados.filhotes) { f.estado = 'salvo'; f.a = f.b = -1; Object.assign(f, { x: PEN.x0 + 2, z: 0 }); } p.jogadores.forEach((_, i) => poe(p, i, -8, -6 + 1.5 * i)); return p; };
const solta = (f, x, z) => Object.assign(f, { estado: 'livre', x, z, kx: 0, kz: 0, a: -1, b: -1 });

// Robo de dedos com intencao: os dois primeiros levam o filhote grande juntos, os outros pegam pequenos, quem esta de maos livres
// espanta a raposa quando ela corre atras de um amigo. "distrai" e a chance de, a cada 0,5 s, andar sem rumo.
function robo(distrai = 0.15) {
  const est = [];
  return (p, rng) => {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i] ??= { alvo: null, quando: -1, n: 0, a: false };
      if (p.t - e.quando > 0.5) {
        e.quando = p.t; e.a = false; let alvo = null;
        const k = d.leva[i], g = d.dupla[i], r = d.raposa;
        if (rng() < distrai) alvo = { x: j.x + (rng() * 2 - 1) * 5, z: j.z + (rng() * 2 - 1) * 5 };
        else if (k >= 0) alvo = { x: PEN.x0 + 1.5, z: j.z };
        else if (g >= 0) alvo = { x: PEN.x0 + 1.8, z: 0 };
        else {
          e.a = r.estado === 'ronda' && dist(r, j) < R_ESPANTA && p.jogadores.some((q, m) => m !== i && d.leva[m] >= 0 && dist(r, q) < 8);
          const gr = d.filhotes.filter(f => f.tipo === 'g' && f.estado === 'livre'), li = d.filhotes.filter(f => f.tipo === 'p' && f.estado === 'livre');
          if (i < 2 && gr.length) alvo = gr.sort((a, b) => dist(a, j) - dist(b, j))[0];
          else if (li.length) alvo = li.sort((a, b) => dist(a, j) - dist(b, j))[0];
          else if (gr.length) alvo = gr[0];
        }
        e.alvo = alvo;
      }
      let x = 0, y = 0; const al = e.alvo;
      if (al) { const dx = al.x - j.x, dz = al.z - j.z, m = Math.hypot(dx, dz) || 1; if (m > 0.3) { x = dx / m; y = dz / m; } }
      if (e.a) { e.n++; e.a = false; }
      entrada(p, i, { x, y, d: false, n: e.n, nb: 0 });
    });
  };
}
// Joga uma rodada inteira com o robo. Devolve o resultado e quantos segundos de jogo passaram.
function joga(n, noite, semente, distrai) {
  const p = partida(semente, n, noite), r = robo(distrai), rng = sorteio(semente + 77);
  let q = 0;
  while (p.fase === 'jogando') { r(p, rng); passo(p, DT); q++; }
  return { p, v: p.vencedor, seg: q * DT };
}
const vitorias = (n, noite, distrai, de = 24) => { let w = 0; for (let s = 1; s <= de; s++) if (joga(n, noite, s, distrai).v === 2) w++; return w / de; };

test('resgate-coop: contrato da festa, controle e dica curta com o botao citado', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.id, 'resgate-coop');
  assert.ok(GENEROS.includes(jogo.genero));
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 30 && TEMPO <= 45, 'rodada de 30 a 45 s');
  assert.equal(jogo.controle.a, 'Espantar');
  assert.match(jogo.dica, /Espantar/);
  assert.ok(jogo.dica.length < 100 && !/[—–]/.test(jogo.dica), 'uma frase curta, sem travessao');
  assert.deepEqual(jogo.semMod, ['foguete']);
});

test('resgate-coop: quem encosta num filhote pequeno o leva, e ao entrar no cercado ele fica a salvo', () => {
  const p = limpa(partida()), f = p.dados.filhotes.find(q => q.tipo === 'p'), k = p.dados.filhotes.indexOf(f);
  solta(f, -3, 0); poe(p, 0, -3, 0); roda(p, 0.05);
  assert.equal(p.dados.leva[0], k);
  assert.equal(f.estado, 'levado');
  assert.match(p.celular[0].texto, /cercado/);
  assert.equal(p.celular[0].a, 'Carregando');
  poe(p, 0, PEN.x0 + 1.2, 0); roda(p, 0.05);
  assert.equal(f.estado, 'salvo');
  assert.equal(p.dados.leva[0], -1);
  assert.equal(p.dados.salvos, 1);
  assert.equal(p.dados.placar[0], 1);
});

test('resgate-coop: o filhote pequeno so e pego de perto e um jogador leva um de cada vez', () => {
  const p = limpa(partida()), [f, outro] = p.dados.filhotes.filter(q => q.tipo === 'p');
  solta(f, -3, 0); solta(outro, 2, 3);
  poe(p, 0, -3 + R_PEGA + 0.6, 0); roda(p, 0.05);
  assert.equal(p.dados.leva[0], -1, 'longe demais');
  poe(p, 0, -3, 0); roda(p, 0.05);
  assert.equal(p.dados.leva[0], p.dados.filhotes.indexOf(f));
  poe(p, 0, 2, 3); roda(p, 0.05);
  assert.equal(outro.estado, 'livre', 'maos ocupadas: nao pega o segundo');
  poe(p, 1, 2, 3); roda(p, 0.05);
  assert.equal(outro.estado, 'levado', 'o amigo de maos livres pega');
});

test('resgate-coop: o filhote grande nao sai do lugar com um so; com dois, os dois o levam e ele acompanha', () => {
  const p = limpa(partida()), g = solta(grande(p), -3, 0);
  poe(p, 0, -3 + 1.2, 0); roda(p, 1.5);
  assert.equal(g.estado, 'livre');
  assert.equal(g.querDois, true, 'a TV avisa que precisa de dois');
  assert.equal(g.x, -3); assert.equal(g.z, 0);
  assert.match(p.celular[0].texto, /grande/);
  poe(p, 1, -3 - 1.2, 0); roda(p, 0.05);
  assert.equal(g.estado, 'dupla');
  assert.deepEqual([g.a, g.b].sort(), [0, 1]);
  poe(p, 0, 0, 1); poe(p, 1, 2, 1); roda(p, 0.05);
  assert.ok(Math.abs(g.x - (p.jogadores[0].x + p.jogadores[1].x) / 2) < 0.2, 'o grande fica entre os dois');
  assert.match(p.celular[0].texto, /grande/);
  assert.match(p.celular[1].texto, /perto de/);
});

test('resgate-coop: o filhote grande so se leva a dois: se um se afasta ele escorrega e cai', () => {
  const p = limpa(partida()), g = solta(grande(p), -3, 0);
  poe(p, 0, -2, 0); poe(p, 1, -4, 0); roda(p, 0.05);
  assert.equal(g.estado, 'dupla');
  poe(p, 0, 1, 0); poe(p, 1, -7, 0); roda(p, 0.02);
  assert.ok(dist(p.jogadores[0], p.jogadores[1]) > SOLTA);
  assert.equal(g.estado, 'livre');
  assert.deepEqual([p.dados.dupla[0], p.dados.dupla[1]], [-1, -1]);
  assert.match(p.dados.aviso, /escorregou/);
  poe(p, 0, g.x + 1, g.z); poe(p, 1, g.x - 1, g.z); roda(p, 0.3);
  assert.equal(g.estado, 'livre', 'depois da queda ha uma espera antes de levantar de novo');
  roda(p, 1);
  assert.equal(g.estado, 'dupla', 'passada a espera, levantam outra vez');
});

test('resgate-coop: levar o grande ao cercado vale dois pontos', () => {
  const p = limpa(partida()), g = solta(grande(p), -3, 0);
  poe(p, 0, -2, 0); poe(p, 1, -4, 0); roda(p, 0.05);
  poe(p, 0, PEN.x0 + 1.8, 0.5); poe(p, 1, PEN.x0 + 1.4, -0.5); roda(p, 0.05);
  assert.equal(g.estado, 'salvo');
  assert.equal(p.dados.salvos, 2);
  assert.match(p.dados.aviso, /grande/);
});

test('resgate-coop: com 4 jogadores ha dois grandes, cada um precisa de uma dupla', () => {
  const p = limpa(partida(1, 4)), gs = p.dados.filhotes.filter(f => f.tipo === 'g');
  assert.equal(gs.length, 2);
  solta(gs[0], -4, -3); solta(gs[1], -4, 3);
  poe(p, 0, -3, -3); poe(p, 1, -5, -3); poe(p, 2, -3, 3); poe(p, 3, -5, 3); roda(p, 0.05);
  assert.deepEqual(gs.map(g => g.estado), ['dupla', 'dupla']);
  assert.equal(new Set([...gs.map(g => g.a), ...gs.map(g => g.b)]).size, 4);
});

test('resgate-coop: a raposa dorme, acorda aos 5 s e avisa quem esta sem filhote a tocar Espantar', () => {
  const p = limpa(partida());
  assert.equal(p.dados.raposa.estado, 'dorme');
  roda(p, T_ACORDA - 0.5); assert.equal(p.dados.raposa.estado, 'dorme');
  roda(p, 1); assert.equal(p.dados.raposa.estado, 'ronda');
  assert.match(p.dados.aviso, /raposa acordou/);
  assert.match(p.dados.aviso, /Espantar/);
});

test('resgate-coop: a raposa que encosta em quem leva um filhote o assusta; o filhote escapa e ela foge', () => {
  const p = limpa(partida()); roda(p, T_ACORDA + 0.1);
  const f = p.dados.filhotes.find(q => q.tipo === 'p'); solta(f, -3, 0); poe(p, 0, -3, 0); roda(p, 0.05);
  assert.equal(f.estado, 'levado');
  const r = p.dados.raposa; r.x = p.jogadores[0].x + 0.5; r.z = p.jogadores[0].z; r.cd = 0;
  roda(p, 0.05);
  assert.equal(f.estado, 'livre');
  assert.equal(p.dados.leva[0], -1);
  assert.equal(r.estado, 'foge');
  assert.ok(p.dados.espera[0] > 0, 'quem perdeu o filhote nao o repega no mesmo instante');
  assert.match(p.dados.aviso, /raposa/);
});

test('resgate-coop: Espantar afasta a raposa, mas so de quem esta de maos livres e perto dela', () => {
  const p = limpa(partida()); roda(p, T_ACORDA + 0.1);
  const r = p.dados.raposa; r.x = -2; r.z = 0; r.cd = 5;
  poe(p, 1, -2 + R_ESPANTA + 2, 0); toca(p, 1); roda(p, 0.05);
  assert.equal(r.estado, 'ronda', 'longe demais');
  poe(p, 1, -2 + 3, 0); toca(p, 1); roda(p, 0.05);
  assert.equal(r.estado, 'foge');
  assert.match(p.dados.aviso, /espantou/);
  const q = limpa(partida(2)); roda(q, T_ACORDA + 0.1);       // quem leva filhote nao espanta
  const f = q.dados.filhotes.find(o => o.tipo === 'p'); solta(f, -3, 0); poe(q, 0, -3, 0); roda(q, 0.05);
  const r2 = q.dados.raposa; r2.x = -3; r2.z = 3; r2.cd = 5;
  toca(q, 0); roda(q, 0.05);
  assert.equal(r2.estado, 'ronda', 'com as maos ocupadas o botao nao faz nada');
  assert.equal(q.celular[0].a, 'Carregando');
});

test('resgate-coop: o celular de quem esta livre manda ajudar quem a raposa persegue', () => {
  const p = limpa(partida()); roda(p, T_ACORDA + 0.1);
  const f = p.dados.filhotes.find(q => q.tipo === 'p'); solta(f, -3, 0); poe(p, 0, -3, 0); roda(p, 0.05);
  const r = p.dados.raposa; r.x = -7; r.z = 0; r.cd = 0; poe(p, 1, -3, 5); roda(p, 0.02);
  assert.match(p.celular[1].texto, /Espantar/);
  assert.match(p.celular[0].texto, /raposa/);
});

test('resgate-coop: salvar todos retorna 2 (vitoria em equipe), com aviso e celulares no estado final', () => {
  const p = limpa(partida());
  const ultimo = p.dados.filhotes.find(f => f.tipo === 'p'); solta(ultimo, -3, 0);
  p.dados.salvos = p.dados.total - 1;
  poe(p, 0, -3, 0); roda(p, 0.05);
  poe(p, 0, PEN.x0 + 1.2, 0); roda(p, 0.05);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.equal(p.dados.fim, 'salvos');
  assert.match(p.dados.aviso, /a salvo/);
  p.celular.forEach(c => assert.match(c.texto, /a salvo/));
});

test('resgate-coop: tempo esgotado sem ter salvado todos retorna -1, e so aos 40 s', () => {
  const p = partida();
  let q = 0; while (p.fase === 'jogando' && q < 60 * (TEMPO + 3)) { passo(p, DT); q++; }
  assert.equal(p.vencedor, -1);
  assert.ok(Math.abs(q / 60 - TEMPO) < 0.1, 'terminou no tempo certo: ' + q / 60);
  assert.equal(p.dados.fim, 'tempo');
  assert.match(p.dados.aviso, /tempo acabou/);
  p.celular.forEach(c => assert.match(c.texto, /tempo acabou/));
});

test('resgate-coop: um robo de dedos com intencao vence, e nunca em menos de 5 s', () => {
  for (const [n, noite] of [[2, 0], [3, 1], [4, 2]]) {
    const r = joga(n, noite, 3 + n, 0.1);
    assert.equal(r.v, 2, `n=${n} noite=${noite}`);
    assert.ok(r.seg > 5 && r.seg < TEMPO, 'a vitoria leva um tempo: ' + r.seg);
  }
});

test('resgate-coop: robo lento (reage a cada 0,5 s e se distrai 40% do tempo) vence quase sempre com 2 jogadores na 1a noite e na maioria na 5a, que segue mais dificil', () => {
  const primeira = vitorias(2, 0, 0.4, 100), quinta = vitorias(2, 4, 0.4, 100);
  if (process.env.MEDE) console.log('MEDE resgate', primeira, quinta, vitorias(3, 0, 0.4, 40), vitorias(4, 4, 0.4, 40));
  assert.ok(primeira >= 0.85, 'primeira noite: ' + primeira);
  assert.ok(quinta >= 0.6, 'quinta noite: ' + quinta);
  assert.ok(quinta < primeira, 'a quinta noite e mais dificil: ' + quinta + ' contra ' + primeira);
});

test('resgate-coop: escala com o numero de jogadores e com a noite', () => {
  for (let noite = 0; noite < 4; noite++) for (let n = 2; n <= 4; n++) {
    assert.ok(totalDe(n, noite + 1) >= totalDe(n, noite), `mais filhotes a cada noite (n=${n})`);
    assert.ok(velRaposa(n, noite + 1) > velRaposa(n, noite), 'raposa mais rapida a cada noite');
  }
  for (let n = 2; n < 4; n++) assert.ok(totalDe(n + 1, 0) > totalDe(n, 0), 'mais jogadores, mais filhotes');
  assert.ok(velRaposa(3, 0) > velRaposa(2, 0));
  assert.deepEqual([2, 3, 4].map(n => filhotes(n, 0).grandes), [1, 1, 2]);
  for (const [n, noite] of [[2, 0], [3, 2], [4, 4]]) {
    const p = partida(5, n, noite), f = filhotes(n, noite);
    assert.equal(p.dados.filhotes.filter(q => q.tipo === 'p').length, f.pequenos);
    assert.equal(p.dados.filhotes.filter(q => q.tipo === 'g').length, f.grandes);
    assert.equal(p.dados.total, totalDe(n, noite));
  }
});

test('resgate-coop: filhotes e jogadores comecam dentro do campo, longe do cercado e uns dos outros', () => {
  for (let s = 1; s <= 12; s++) for (const n of [2, 3, 4]) {
    const p = partida(s, n, s % 5);
    for (const f of p.dados.filhotes) {
      assert.ok(Math.abs(f.x) < LX && Math.abs(f.z) < LZ && f.x < PEN.x0 - 1, 'filhote fora do campo');
      for (const j of p.jogadores) assert.ok(dist(f, j) > 1.5, 'filhote em cima de um jogador');
    }
  }
});

test('resgate-coop: textos em portugues claro, sem travessao, emoji, caixa alta crua nem nome interno', () => {
  const textos = new Set([jogo.nome, jogo.dica, jogo.controle.a, 'Carregando']);
  const ruim = t => /[—–]/.test(t) || /\p{Extended_Pictographic}/u.test(t) || /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b/.test(t) || /undefined|NaN|null|coop|[a-z]+[A-Z]\w*/.test(t);
  for (const [n, noite, distrai] of [[2, 0, 0.1], [3, 2, 0.2], [4, 4, 0.1]]) {
    const p = partida(7, n, noite), r = robo(distrai), rng = sorteio(9);
    while (p.fase === 'jogando') {
      r(p, rng); passo(p, DT);
      textos.add(p.dados.aviso);
      p.celular.forEach(c => { textos.add(c.texto); textos.add(c.a); });
      p.dados.inventario.forEach(l => l.forEach(t => textos.add(t)));
    }
    textos.add(p.dados.aviso); p.celular.forEach(c => textos.add(c.texto));
  }
  for (const t of textos) if (t) assert.ok(!ruim(t), 'texto ruim: ' + t);
  assert.ok(textos.size > 8, 'o teste viu varios textos');
});

test('resgate-coop: o desenho (monta e desenha) usa so o proprio arquivo e nao quebra com modelos de mentira nem sem eles', () => {
  const codigo = readFileSync(new URL('./resgate-coop.mjs', import.meta.url), 'utf8');
  assert.ok(!/\.glb|c\.modelo\(/.test(codigo), 'formas do three.js no proprio arquivo');
  assert.deepEqual([...codigo.matchAll(/^import .* from '(.+)';$/gm)].map(m => m[1]), ['../logica.mjs']);
});

test('resgate-coop: fumaca com 2, 3 e 4 jogadores (parado e 15 rodadas de dedos aleatorios, desenhando de verdade)', () => {
  for (const n of [2, 3, 4]) {
    const vencedores = fumaca(jogo, { n, modo: 'coop' });
    assert.equal(vencedores.length, 15);
    assert.ok(vencedores.every(v => v === 2 || v === -1));
  }
});

test('resgate-coop: entrada aleatoria nao quebra e a rodada sempre termina sozinha', () => {
  for (let s = 20; s < 26; s++) for (const n of [2, 3, 4]) {
    const { p, segundos } = rodada(jogo, aleatorio, s, { n, modo: 'coop' });
    assert.deepEqual(p.erros, []);
    assert.ok(segundos <= TEMPO + 0.1, 'terminou por tempo ou vitoria: ' + segundos);
  }
});

test('resgate-coop: esconde o nome flutuante dos jogadores (semNome), os bonecos se juntam', () => {
  assert.equal(jogo.semNome, true);
});
