import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, GENEROS } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, T_FURO, T_GRANDE, MEIO, BALDE, BALDE_DUPLA, VAZA, VAZA_GRANDE, V_BARCO, LENTO, BALDE_POS, escala, maxFuros } from './barco-coop.mjs';

const coop = n => ({ n, modo: 'coop' });
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0, y: 0, vy: 0 });
// Partida sem furos sorteados: o teste monta o cenario. A noite vem do motor (p.noites.jogadas).
function partida(n = 2, noite = 0, semente = 1) {
  const p = partidaCom(jogo, sorteio(semente), coop(n));
  p.noites.jogadas = noite;
  for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
  p.dados.proxFuro = 1e9;
  return p;
}
const furo = (p, x, z, grande = false) => { const f = { id: 900 + p.dados.furos.length, x, z, grande, prog: 0, maos: 0 }; p.dados.furos.push(f); return f; };
// Segura A (um quadro) com o joystick parado; a posicao e posta pelo teste.
function segura(p, ids, quadros, onde = {}) {
  for (let k = 0; k < quadros && p.fase === 'jogando'; k++) {
    for (const i of ids) { if (onde[i]) poe(p, i, ...onde[i]); const j = p.jogadores[i]; entrada(p, i, { x: 0, y: 0, d: true, n: j.n ?? 0, nb: 0 }); }
    passo(p, DT);
  }
}
// Solta o botao A de todos (o motor guarda o botao segurado ate chegar outra mensagem).
const solta = (p, ids) => ids.forEach(i => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n ?? 0, nb: 0 }));
function jogaAte(p, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { passo(p, DT); t += DT; } return t; }
const quadros = s => Math.round(s * 60);

test('barco-coop: contrato da festa so cooperativo, de 2 a 4, genero da lista e tempo de 30 a 45 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['coop'] });
  assert.equal(jogo.id, 'barco-coop');
  assert.ok(GENEROS.includes(jogo.genero));
  assert.deepEqual(jogo.semMod, ['espelho', 'foguete']);
  assert.ok(TEMPO >= 30 && TEMPO <= 45 && jogo.duracao === TEMPO);
  assert.equal(jogo.controle.a, 'Ajuda');
  assert.equal(jogo.controle.b, '');
  assert.match(jogo.dica, /Ajuda/);
  assert.ok(jogo.dica.length < 90, 'a dica cabe em uma frase curta');
});

test('barco-coop: comeca seco, sem furo, no cais, e o primeiro furo so abre depois de 2 s', () => {
  const p = partidaCom(jogo, undefined, coop(2));
  assert.equal(p.dados.agua, 0);
  assert.equal(p.dados.prog, 0);
  assert.equal(p.dados.furos.length, 0);
  roda(p, 1.5);
  assert.equal(p.dados.furos.length, 0);
  roda(p, 1);
  assert.equal(p.dados.furos.length, 1);
});

test('barco-coop: furo pequeno um so tapa, segurando Ajuda por cerca de um segundo, e fica o remendo', () => {
  const p = partida();
  const f = furo(p, -3, -1.5);
  segura(p, [0], quadros(T_FURO - 0.2), { 0: [-3, -0.5] });
  assert.equal(p.dados.furos.length, 1, 'ainda aberto');
  assert.ok(f.prog > 0.6 && f.prog < 1);
  assert.match(p.celular[0].texto, /Tampando/);
  segura(p, [0], quadros(0.4), { 0: [-3, -0.5] });
  assert.equal(p.dados.furos.length, 0);
  assert.equal(p.dados.remendos.length, 1);
  assert.equal(p.dados.fechados, 1);
  assert.ok(p.eventos.includes('moeda'));
});

test('barco-coop: longe do furo nao tapa, e soltar o botao faz a barra voltar', () => {
  const p = partida();
  const f = furo(p, -3, -1.5);
  segura(p, [0], quadros(2), { 0: [3, 1] });
  assert.equal(f.prog, 0);
  segura(p, [0], quadros(0.5), { 0: [-3, -0.5] });
  assert.ok(f.prog > 0.3);
  solta(p, [0]);
  roda(p, 2);
  assert.equal(f.prog, 0, 'a barra desceu sozinha');
});

test('barco-coop: furo grande so fecha com dois segurando juntos; um sozinho para na metade e vaza menos', () => {
  const p = partida();
  const f = furo(p, 0, -2, true);
  segura(p, [0], quadros(T_GRANDE * 3), { 0: [-1, -1.5] });
  assert.equal(p.dados.furos.length, 1, 'um sozinho nao fecha');
  assert.ok(Math.abs(f.prog - MEIO) < 0.02, 'parou na metade: ' + f.prog);
  assert.equal(f.maos, 1);
  assert.match(p.celular[0].texto, /Chame um amigo/);
  // quem esta livre e orientado a ajudar quem segura
  assert.match(p.celular[1].texto, /^Ajude Jogador 1/);
  segura(p, [0, 1], quadros(T_GRANDE * 0.7), { 0: [-1, -1.5], 1: [1, -1.5] });
  assert.equal(p.dados.furos.length, 0, 'os dois juntos fecharam');
  assert.equal(p.dados.remendos[0].grande, true);
  assert.ok(p.eventos.includes('ponto'));
});

test('barco-coop: o amigo sozinho tambem nao fecha: so quem segura junto conta', () => {
  const p = partida(3);
  const f = furo(p, 0, -2, true);
  segura(p, [0], quadros(1), { 0: [-1, -1.5] });
  const antes = f.prog;
  solta(p, [0]);
  roda(p, 4);                                       // ninguem segura: a barra desce
  assert.ok(f.prog < antes);
  segura(p, [1, 2], quadros(T_GRANDE + 0.3), { 1: [-1, -1.5], 2: [1, -1.5] });
  assert.equal(p.dados.furos.length, 0);
});

test('barco-coop: um furo deixa entrar agua e o grande entra mais; segurar sozinho no grande corta pela metade', () => {
  const p = partida();
  furo(p, -3, -1.5);
  roda(p, 5);
  assert.ok(Math.abs(p.dados.agua - 5 * VAZA) < 0.1, 'agua ' + p.dados.agua);
  const q = partida();
  furo(q, 0, -2, true);
  roda(q, 5);
  assert.ok(Math.abs(q.dados.agua - 5 * VAZA_GRANDE) < 0.1);
  const r = partida();
  furo(r, 0, -2, true);
  segura(r, [0], quadros(5), { 0: [-1, -1.5] });
  assert.ok(r.dados.agua < q.dados.agua * 0.7, 'segurar sozinho vaza menos: ' + r.dados.agua);
});

test('barco-coop: o balde tira agua, e dois no balde tiram mais que o dobro de um', () => {
  const p = partida();
  p.dados.agua = 60;
  segura(p, [0], quadros(2), { 0: [BALDE_POS.x - 1, BALDE_POS.z] });
  assert.ok(Math.abs(p.dados.agua - (60 - 2 * BALDE)) < 0.6, 'um: ' + p.dados.agua);
  assert.match(p.celular[0].texto, /Tirando água/);
  const q = partida();
  q.dados.agua = 60;
  segura(q, [0, 1], quadros(2), { 0: [BALDE_POS.x - 1, BALDE_POS.z], 1: [BALDE_POS.x + 1, BALDE_POS.z] });
  assert.ok(60 - q.dados.agua > 2 * (60 - p.dados.agua), 'dois: ' + q.dados.agua);
  assert.ok(Math.abs(q.dados.agua - (60 - 2 * (2 * BALDE + BALDE_DUPLA))) < 1);
  roda(q, 10);
  assert.ok(q.dados.agua >= 0, 'nunca negativa');
});

test('barco-coop: a agua deixa o barco mais lento', () => {
  const seco = partida(), cheio = partida();
  cheio.dados.agua = 80;
  roda(seco, 3); roda(cheio, 3);
  assert.ok(Math.abs(seco.dados.prog - 3 * V_BARCO) < 0.2);
  assert.ok(cheio.dados.prog < seco.dados.prog * 0.7);
  assert.ok(cheio.dados.velocidade >= V_BARCO * (1 - LENTO) - 0.01 && cheio.dados.velocidade < V_BARCO);
});

test('barco-coop: vitoria: chega a outra margem, retorna 2 pelo motor, 1 ponto para cada e o aviso final', () => {
  for (const n of [2, 3, 4]) {
    const p = partida(n);
    p.dados.prog = 99;
    roda(p, 1);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, 2);
    assert.deepEqual(p.jogadores.map(j => j.pontos), Array(n).fill(1));
    assert.equal(p.dados.fim, 'chegou');
    assert.match(p.dados.aviso, /outra margem/);
    p.celular.forEach(c => assert.match(c.texto, /Chegaram/));
  }
});

test('barco-coop: parados, o barco chega sozinho? nao: furos afundam ou o tempo acaba, e a equipe perde sem ponto', () => {
  const p = partidaCom(jogo, sorteio(5), coop(2));
  const t = jogaAte(p);
  assert.equal(p.vencedor, -1);
  assert.ok(t < TEMPO + 0.1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0]);
  assert.ok(p.dados.aviso && p.celular.every(c => c.texto));
});

test('barco-coop: afundar retorna -1 na hora e explica', () => {
  const p = partida();
  furo(p, -3, -1.5); p.dados.agua = 99.9;
  roda(p, 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.fim, 'afundou');
  assert.match(p.dados.aviso, /afundou/);
  p.celular.forEach(c => assert.match(c.texto, /afundou/));
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0]);
});

test('barco-coop: tempo limite: com o barco lento demais o tempo acaba aos 40 s e a equipe perde', () => {
  const p = partida();
  let t = 0;
  while (p.fase === 'jogando' && t < 75) { p.dados.agua = 98; passo(p, DT); t += DT; }
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.fim, 'tempo');
  assert.ok(Math.abs(t - TEMPO) < 0.1, 'acabou aos ' + t);
  assert.match(p.dados.aviso, /tempo acabou/);
});

test('barco-coop: a rodada seca nao decide antes de 5 s nem em 29 s, com qualquer numero de jogadores', () => {
  for (const n of [2, 3, 4]) {
    const p = partida(n);
    roda(p, 5);
    assert.equal(p.fase, 'jogando');
    assert.ok(p.dados.prog < 25);
  }
});

test('barco-coop: escala com o numero de jogadores e com a noite', () => {
  assert.ok(escala(2, 0) < escala(3, 0) && escala(3, 0) < escala(4, 0));
  assert.ok(escala(2, 0) < escala(2, 2) && escala(2, 2) < escala(2, 4));
  assert.ok(maxFuros(2, 0) <= maxFuros(4, 0) && maxFuros(4, 0) < maxFuros(4, 4));
  // ninguem tapa: o teste varre os furos para contar so quantos nascem em 28 s (o limite de furos abertos nao atrapalha)
  const furos = (n, noite) => { let total = 0; for (let s = 1; s <= 6; s++) { const p = partidaCom(jogo, sorteio(s), coop(n)); p.noites.jogadas = noite; for (let k = 0; k < 28 * 60 && p.fase === 'jogando'; k++) { passo(p, DT); p.dados.furos = []; p.dados.agua = 0; } total += p.dados.criados; } return total; };
  assert.ok(furos(4, 0) > furos(2, 0), 'mais jogadores, mais furos');
  assert.ok(furos(2, 4) > furos(2, 0), 'mais tarde na partida, mais furos');
  const q = partida(2, 4), r = partida(2, 0);
  furo(q, -3, -1.5); furo(r, -3, -1.5); roda(q, 4); roda(r, 4);
  assert.ok(q.dados.agua > r.dados.agua, 'furos de noites tardias vazam mais');
});

test('barco-coop: aparece um furo grande por volta dos 10 s, e nunca mais de um grande aberto', () => {
  for (const s of [1, 2, 3, 4, 5]) {
    const p = partidaCom(jogo, sorteio(s), coop(2));
    let viu = false;
    for (let k = 0; k < 60 * 25; k++) { passo(p, DT); if (p.fase !== 'jogando') break; if (p.dados.furos.filter(f => f.grande).length > 1) assert.fail('dois grandes'); if (p.dados.furos.some(f => f.grande)) viu = true; if (p.dados.furos.length > maxFuros(2, 0)) assert.fail('furos demais'); }
    assert.ok(viu || p.fase !== 'jogando', 'semente ' + s);
  }
});

// Robo casual: cada um decide de uns 0,8 s em 0,8 s, vai ao furo mais perto sem dono, senao ao balde, e as vezes se distrai.
function robo(p, rng) {
  const est = p.jogadores.map(() => ({ alvo: null, ate: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 0.9 * (0.6 + rng() * 0.9);
        if (rng() < 0.2) e.alvo = { x: (rng() * 2 - 1) * 6, z: (rng() * 2 - 1) * 3, parado: true };
        else {
          let melhor = null, m = 1e9;
          for (const f of d.furos) {
            const ocupado = p.jogadores.some((_, k) => k !== i && est[k].alvo?.id === f.id);
            const dd = Math.hypot(f.x - j.x, f.z - j.z) + (ocupado && !f.grande ? 99 : 0) - (f.grande && ocupado ? 6 : 0);
            if (dd < m) { m = dd; melhor = { x: f.x, z: f.z, id: f.id, furo: true }; }
          }
          e.alvo = melhor && d.agua < 55 ? melhor : d.agua > 8 ? { ...BALDE_POS, balde: true } : melhor ?? { x: j.x, z: j.z, parado: true };
        }
      }
      const a = e.alvo, dx = a.x - j.x, dz = a.z - j.z, m = Math.hypot(dx, dz) || 1;
      const perto = a.furo ? m < 1 : a.balde ? m < 1.4 : true;
      entrada(p, i, { x: perto ? 0 : dx / m, y: perto ? 0 : dz / m, d: perto && !a.parado, n: j.n ?? 0, nb: 0 });
    });
  };
}
function taxa(n, noite, partidas = 30) {
  let v = 0;
  for (let s = 1; s <= partidas; s++) {
    const p = partidaCom(jogo, sorteio(s), coop(n));
    p.noites.jogadas = noite;
    for (let i = 0; i < n; i++) entrada(p, i, { x: 0, y: 0, n: 0, nb: 0 });
    const joga = robo(p, sorteio(s * 7 + 3));
    for (let q = 0; q < 75 * 60 && p.fase === 'jogando'; q++) { joga(q); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / partidas;
}

test('barco-coop: um robo casual vence bem mais da metade na 1a noite com 2 jogadores, e a 5a noite e mais dificil', () => {
  const a = taxa(2, 0), b = taxa(2, 4);
  assert.ok(a > 0.8, 'noite 1: ' + a);
  assert.ok(b <= a, `noite 5 (${b}) nao pode ser mais facil que a 1 (${a})`);
  assert.ok(b > 0.25, 'a 5a noite nao e impossivel: ' + b);
});

// Robo lento (a crianca distraida): decide a cada 0,5 s e em 40% das vezes se distrai (anda a toa, sem apertar Ajuda).
// Quando atento, vai ao furo mais perto sem dono, senao ao balde, em linha reta, sem otimizar rota.
function roboLento(p, rng) {
  const est = p.jogadores.map(() => ({ alvo: null, ate: 0 }));
  return quadro => {
    const t = quadro * DT, d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = est[i];
      if (t >= e.ate) {
        e.ate = t + 0.5;
        if (rng() < 0.4) e.alvo = { x: (rng() * 2 - 1) * 6, z: (rng() * 2 - 1) * 3, parado: true };
        else {
          let melhor = null, m = 1e9;
          for (const f of d.furos) {
            const ocupado = p.jogadores.some((_, k) => k !== i && est[k].alvo?.id === f.id);
            const dd = Math.hypot(f.x - j.x, f.z - j.z) + (ocupado && !f.grande ? 99 : 0) - (f.grande && ocupado ? 6 : 0);
            if (dd < m) { m = dd; melhor = { x: f.x, z: f.z, id: f.id, furo: true }; }
          }
          e.alvo = melhor && d.agua < 55 ? melhor : d.agua > 8 ? { ...BALDE_POS, balde: true } : melhor ?? { x: j.x, z: j.z, parado: true };
        }
      }
      const a = e.alvo, dx = a.x - j.x, dz = a.z - j.z, m = Math.hypot(dx, dz) || 1;
      const perto = a.furo ? m < 1 : a.balde ? m < 1.4 : true;
      entrada(p, i, { x: perto ? 0 : dx / m, y: perto ? 0 : dz / m, d: perto && !a.parado, n: j.n ?? 0, nb: 0 });
    });
  };
}
function taxaLenta(n, noite, partidas = 100) {
  let v = 0;
  for (let s = 1; s <= partidas; s++) {
    const p = partida(n, noite, s);
    p.dados.proxFuro = 2;      // com furos sorteados, como no jogo de verdade
    const joga = roboLento(p, sorteio(s * 7 + 3));
    for (let q = 0; q < 75 * 60 && p.fase === 'jogando'; q++) { joga(q); passo(p, DT); }
    if (p.vencedor === 2) v++;
  }
  return v / partidas;
}

test('barco-coop: robo lento (distraido 40% do tempo) com 2 jogadores vence 85% ou mais na 1a noite e 60% ou mais na 5a, que e mais dificil', () => {
  const a = taxaLenta(2, 0), b = taxaLenta(2, 4);
  assert.ok(a >= 0.85, 'noite 1: ' + a);
  assert.ok(b >= 0.6, 'noite 5: ' + b);
  assert.ok(b < a, `noite 5 (${b}) deveria ser mais dificil que a 1 (${a})`);
});

test('barco-coop: com 3 e 4 jogadores o robo lento vence a maioria nas duas noites, mas parados afundam ou nao chegam', () => {
  for (const n of [3, 4]) {
    assert.ok(taxaLenta(n, 0, 40) >= 0.8, 'n ' + n + ' noite 1');
    assert.ok(taxaLenta(n, 4, 40) >= 0.6, 'n ' + n + ' noite 5');
    for (const noite of [0, 4]) {
      const p = partida(n, noite, 3);
      p.dados.proxFuro = 2;
      jogaAte(p);
      assert.equal(p.vencedor, -1, `${n} parados na noite ${noite + 1}`);
    }
  }
});

test('barco-coop: esconde o nome flutuante (semNome): os bonecos se juntam no furo e no balde', () => {
  assert.equal(jogo.semNome, true);
});

test('barco-coop: com 3 e 4 jogadores o robo casual tambem vence a maioria na 1a noite', () => {
  assert.ok(taxa(3, 0, 20) > 0.6);
  assert.ok(taxa(4, 0, 20) > 0.6);
});

test('barco-coop: o texto do celular e da tela e em portugues claro: sem travessao, emoji, caixa alta crua nem nome de variavel', () => {
  const p = partidaCom(jogo, sorteio(9), coop(3));
  const textos = [];
  for (let k = 0; k < 60 * 30 && p.fase === 'jogando'; k++) {
    for (let i = 0; i < 3; i++) entrada(p, i, { x: Math.sin(k / 30 + i), y: Math.cos(k / 40), d: k % 90 < 45, n: 0, nb: 0 });
    passo(p, DT);
    if (k % 20 === 0) textos.push(...p.celular.map(c => c.texto), p.dados.aviso, ...p.dados.inventario.flat());
  }
  for (const t of textos.filter(Boolean).concat(jogo.dica, jogo.nome)) {
    assert.doesNotMatch(t, /[—–]/, t);
    assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, t);
    assert.doesNotMatch(t, /undefined|NaN|null|\[object/, t);
    assert.doesNotMatch(t.replace(/Ajuda|Jogador \d/g, ''), /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}/, 'caixa alta crua: ' + t);
  }
});

test('barco-coop: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, n = 2, 3 e 4)', () => {
  for (const n of [2, 3, 4])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, coop(n));
      assert.ok(segundos >= 5, `n ${n} semente ${s}: ${segundos}`);
      assert.ok([2, -1].includes(p.vencedor));
    }
});

test('barco-coop: fumaca com 2, 3 e 4 jogadores', () => {
  for (const n of [2, 3, 4]) assert.equal(fumaca(jogo, coop(n)).length, 15);
});
