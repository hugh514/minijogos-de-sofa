import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, rodada, aleatorio, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { PISTA, N, COMP, HALF, LX, LZ, VOLTAS, LIMITE, V_MAX, T_AZUL, T_LARANJA, PORTOES, PORTAO, R_KART, CAM, pontoPista, projeta, sorteiaItem, acelerador } from './kart.mjs';

const volta = a => Math.atan2(Math.sin(a), Math.cos(a));
const limita = (v, m) => Math.max(-m, Math.min(m, v));

// Piloto automatico: mira um ponto a frente na pista, vira para ele e acelera (alivia nas curvas fechadas).
function pilota(p, i, extra = {}) {
  const j = p.jogadores[i], k = p.dados.k[i];
  const q = projeta(j.x, j.z), alvo = PISTA[(q.i + 20) % N];
  const dif = volta(Math.atan2(alvo.z - j.z, alvo.x - j.x) - k.ang);
  entrada(p, i, { x: limita(dif * 2.2, 1), y: Math.abs(dif) > 0.7 ? -0.4 : -1, ...extra });
}

// Toque curto no A ou no B: o contador sobe um e so.
function toca(p, i, botao = 'n') { entrada(p, i, { x: p.jogadores[i].ent.x, y: p.jogadores[i].ent.y, [botao]: (p.jogadores[i][botao] ?? 0) + 1 }); }

// Poe o kart no ponto u da pista (lat: lado, positivo a direita de quem corre), apontando para a frente, com velocidade vel.
function poe(p, i, u, lat = 0, vel = 0) {
  const j = p.jogadores[i], k = p.dados.k[i], q = pontoPista(u, lat);
  j.x = q.x; j.z = q.z; k.ang = Math.atan2(q.tz, q.tx); k.vx = q.tx * vel; k.vz = q.tz * vel;
  p.dados.idx[i] = projeta(j.x, j.z).i;
  p.dados.antes[i] = { x: j.x, z: j.z };
  return q;
}

const semCaixas = p => { for (const c of p.dados.caixas) c.t = 999; };
const velocidade = (p, i) => Math.hypot(p.dados.k[i].vx, p.dados.k[i].vz);

function corre(p, segundos, quem = () => {}) {
  for (let q = 0; q < segundos * 60 && p.fase === 'jogando'; q++) { quem(p, q); passo(p, DT); }
}

test('kart: a pista e fechada, cabe na arena e as partes dela nao se tocam', () => {
  assert.equal(N, PISTA.length);
  assert.ok(COMP > 110 && COMP < 220, 'comprimento ' + COMP);
  const passoMedio = COMP / N;
  for (let i = 0; i < N; i++) {
    const a = PISTA[i], b = PISTA[(i + 1) % N];
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - passoMedio) < passoMedio * 0.2, 'amostras desiguais em ' + i);
    assert.ok(Math.abs(Math.hypot(a.tx, a.tz) - 1) < 1e-6);
    assert.ok(Math.abs(a.x) + HALF + 0.5 <= LX && Math.abs(a.z) + HALF + 0.5 <= LZ, 'pista fora da arena em ' + i);
  }
  for (let i = 0; i < N; i += 2)
    for (let k = i + 1; k < N; k += 2) {
      if (Math.min(k - i, N - (k - i)) < N / PORTOES) continue;
      assert.ok(Math.hypot(PISTA[i].x - PISTA[k].x, PISTA[i].z - PISTA[k].z) > 2 * HALF + 1.5, 'trechos da pista muito perto');
    }
  const raioMin = Math.min(...PISTA.map(q => 1 / Math.max(1e-6, Math.abs(q.curva))));
  assert.ok(raioMin > HALF + 0.8, 'curva fechada demais: raio ' + raioMin.toFixed(2));
  assert.equal(PORTAO.length, PORTOES);
  assert.equal(PORTAO[0].idx, 0);
});

test('kart: a largada tem os dois karts lado a lado na pista, com o outro no mesmo ponto da volta', () => {
  const p = partidaCom(jogo);
  const [a, b] = p.jogadores.map(j => projeta(j.x, j.z));
  assert.ok(a.d <= HALF && b.d <= HALF, 'na pista');
  assert.equal(a.i, b.i);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.deepEqual(p.dados.voltas, [0, 0]);
  assert.equal(jogo.semMovimento, true);
});

test('kart: acelerador do celular: qualquer toque acelera, puxar para baixo freia, solto nao acelera', () => {
  assert.equal(acelerador({ x: 0, y: -1 }), 1);
  assert.equal(acelerador({ x: 1, y: 0 }), 1, 'todo para o lado na curva continua acelerando');
  assert.equal(acelerador({ x: -0.7, y: 0.3 }), 1);
  assert.equal(acelerador({ x: 0, y: 1 }), -1);
  assert.equal(acelerador({ x: 0.3, y: 0.8 }), -1);
  assert.equal(acelerador({ x: 0.05, y: 0.1 }), 0, 'zona morta');
  // solto, o kart vai parando
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, V_MAX);
  entrada(p, 0, { x: 0, y: 0 });
  roda(p, 1);
  assert.ok(velocidade(p, 0) < V_MAX * 0.6 && velocidade(p, 0) > 1, 'desacelerou sem parar seco: ' + velocidade(p, 0));
});

test('kart: joystick para frente acelera, para tras freia e da re, x vira', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02);
  entrada(p, 0, { x: 0, y: -1 });
  roda(p, 1.5);
  const v1 = p.dados.k[0].vx;
  assert.ok(v1 > V_MAX * 0.8 && v1 <= V_MAX + 0.5, 'velocidade ' + v1);
  entrada(p, 0, { x: 0, y: 1 });
  roda(p, 0.3);
  assert.ok(p.dados.k[0].vx < v1 - 4, 'freou');
  roda(p, 2);
  assert.ok(p.dados.k[0].vx < -1, 'engatou a re');
  const q = partidaCom(jogo); semCaixas(q);
  poe(q, 0, 0.02, 0, 8);
  const ang0 = q.dados.k[0].ang;
  entrada(q, 0, { x: 1, y: -1 });
  roda(q, 0.3);
  assert.ok(volta(q.dados.k[0].ang - ang0) > 0.3, 'virou para a direita (horario na tela)');
  entrada(q, 0, { x: -1, y: -1 });
  roda(q, 0.8);
  assert.ok(volta(q.dados.k[0].ang - ang0) < 0.3, 'virou para a esquerda');
});

test('kart: parado de frente para a parede ainda consegue virar e sair', () => {
  const p = partidaCom(jogo); semCaixas(p);
  const j = p.jogadores[0], k = p.dados.k[0];
  j.x = 0; j.z = -LZ + 1; k.ang = -Math.PI / 2; k.vx = k.vz = 0;      // encostado no muro de cima, olhando para ele
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 2.5);
  assert.ok(j.z > -LZ + 4, 'saiu da parede: z ' + j.z.toFixed(1));
});

test('kart: fora da pista a grama deixa o kart lento', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, 12);
  p.jogadores[0].x = 10; p.jogadores[0].z = 0; p.dados.k[0].vx = 12; p.dados.k[0].vz = 0; p.dados.k[0].ang = 0;   // miolo: grama
  assert.ok(projeta(10, 0).d > HALF + 3);
  entrada(p, 0, { x: 0, y: -1 });
  roda(p, 0.5);
  assert.ok(velocidade(p, 0) < 6, 'lento na grama: ' + velocidade(p, 0));
  assert.equal(p.dados.naPista[0], false);
});

test('kart: 3 voltas vencem, para cada lado, e o placar conta as voltas', () => {
  for (const quem of [0, 1]) {
    const p = partidaCom(jogo); semCaixas(p);
    const vistas = new Set();
    let fim = 0;
    corre(p, 55, p => { pilota(p, quem); vistas.add(p.dados.placar[quem]); fim = p.t; });
    assert.equal(p.vencedor, quem, 'vencedor ' + p.vencedor + ' em ' + p.t.toFixed(1) + ' s, voltas ' + p.dados.voltas);
    vistas.add(p.dados.placar[quem]);
    assert.deepEqual([...vistas].sort(), [0, 1, 2, 3]);
    assert.equal(p.dados.voltas[quem], VOLTAS);
    assert.equal(p.dados.voltas[1 - quem], 0);
    assert.ok(fim > 25 && fim < LIMITE - 4, 'tempo da corrida ' + fim);
    const t = p.dados.tempos[quem], voltas = t.map((v, k) => v - (t[k - 1] ?? 0));
    for (const v of voltas) assert.ok(v > 9.5 && v < 16, 'volta do piloto automatico em ' + v.toFixed(1) + ' s');
  }
});

test('kart: atalho nao conta volta (portao pulado, linha de chegada pelo miolo e contramao)', () => {
  // pula o portao 4 de teleporte e termina a volta: nao conta
  let p = partidaCom(jogo); semCaixas(p);
  let pulou = false, depois = 0;
  corre(p, 45, p => {
    if (!pulou && p.dados.prox[0] === 4) { poe(p, 0, (PORTAO[4].idx + 12) / N, 0, 10); pulou = true; }
    if (pulou && ++depois > 6.5 * 60) p.t = 1e9;    // 6,5 s depois do pulo: passou pela linha mas ainda nao deu outra volta
    pilota(p, 0);
  });
  assert.ok(pulou);
  assert.ok(p.dados.idx[0] < PORTAO[3].idx || p.dados.idx[0] > PORTAO[4].idx, 'chegou perto da linha');
  assert.equal(p.dados.voltas[0], 0, 'portao pulado nao vale');
  assert.equal(p.dados.prox[0], 4);

  // cruzar a linha de chegada direto depois da largada, sem passar pelos outros portoes
  p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.97, 0, 10);
  corre(p, 2, p => pilota(p, 0));
  assert.equal(p.dados.voltas[0], 0);

  // contramao: dar a volta ao contrario nao soma
  p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.1, 0, 0);
  p.dados.k[0].ang += Math.PI;
  corre(p, 12, p => {
    const j = p.jogadores[0], q = projeta(j.x, j.z), alvo = PISTA[(q.i - 20 + N) % N];
    const dif = volta(Math.atan2(alvo.z - j.z, alvo.x - j.x) - p.dados.k[0].ang);
    entrada(p, 0, { x: limita(dif * 2.2, 1), y: -1 });
  });
  assert.equal(p.dados.voltas[0], 0);
  assert.equal(p.dados.cruz[0], 0);
});

test('kart: no limite de tempo vence quem esta mais a frente no circuito; igual empata', () => {
  assert.ok(LIMITE <= 60);
  for (const quem of [0, 1]) {
    const p = partidaCom(jogo); semCaixas(p);
    corre(p, LIMITE - 1, (p, q) => { if (q < 18 * 60) pilota(p, quem); else entrada(p, quem, { x: 0, y: 0 }); });
    assert.equal(p.fase, 'jogando', 'ainda nao acabou');
    assert.ok(p.dados.progresso[quem] > p.dados.progresso[1 - quem] + 1);
    roda(p, 2);
    assert.equal(p.vencedor, quem);
    assert.ok(p.dados.voltas[quem] < VOLTAS, 'ganhou por progresso, nao por voltas');
  }
  const p = partidaCom(jogo); semCaixas(p);
  roda(p, LIMITE + 1);
  assert.equal(p.vencedor, -1);
});

test('kart: drift carrega com faiscas que mudam de cor e solta turbo proporcional', () => {
  assert.ok(T_AZUL < T_LARANJA);
  const solta = segura => {
    const p = partidaCom(jogo); semCaixas(p);
    poe(p, 0, 0.02, 0, V_MAX);
    const niveis = new Set();
    for (let q = 0; q < segura * 60; q++) {
      entrada(p, 0, { x: -0.7, y: -1, b: true });
      passo(p, DT); niveis.add(p.dados.k[0].nivel);
    }
    const k = p.dados.k[0], estava = k.drift;
    entrada(p, 0, { x: -0.7, y: -1, b: false });
    passo(p, DT); passo(p, DT); passo(p, DT);
    return { turbo: k.turboT, niveis, estava, k };
  };
  const curto = solta(0.4), medio = solta(1.3), longo = solta(2.4);
  assert.equal(curto.estava, -1, 'entrou em drift para a esquerda');
  assert.equal(curto.turbo, 0, 'drift curto nao da turbo');
  assert.deepEqual([...curto.niveis], [0]);
  assert.ok(medio.turbo > 0.3, 'azul da turbo: ' + medio.turbo);
  assert.ok(medio.niveis.has(1) && !medio.niveis.has(2), 'so azul');
  assert.ok(longo.niveis.has(2), 'laranja');
  assert.ok(longo.turbo > medio.turbo + 0.2, 'turbo proporcional: ' + medio.turbo + ' < ' + longo.turbo);
  assert.equal(longo.k.drift, 0, 'soltou o drift');
  assert.equal(longo.k.carga, 0);

  // o turbo de verdade acelera acima da velocidade normal
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, V_MAX); p.dados.k[0].turboT = 1;
  entrada(p, 0, { x: 0, y: -1 });
  roda(p, 0.5);
  assert.ok(velocidade(p, 0) > V_MAX * 1.2, 'turbo: ' + velocidade(p, 0));
  // com turbo, puxar para baixo ainda freia
  const f = partidaCom(jogo); semCaixas(f);
  poe(f, 0, 0.02, 0, V_MAX); f.dados.k[0].turboT = 1.6;
  entrada(f, 0, { x: 0, y: 1 });
  roda(f, 0.3);
  assert.ok(velocidade(f, 0) < V_MAX - 4, 'freou mesmo no turbo: ' + velocidade(f, 0));
});

test('kart: drift sem virar ou parado nao comeca', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, V_MAX);
  entrada(p, 0, { x: 0, y: -1, b: true });
  roda(p, 0.5);
  assert.equal(p.dados.k[0].drift, 0, 'reto nao e drift');
  const q = partidaCom(jogo); semCaixas(q);
  entrada(q, 0, { x: 1, y: 1, b: true });             // virando e segurando o freio: fica parado
  roda(q, 0.5);
  assert.equal(q.dados.k[0].drift, 0, 'parado nao e drift');
});

test('kart: item turbo (A) da arrancada', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, V_MAX); p.dados.item[0] = 'turbo';
  entrada(p, 0, { x: 0, y: -1, n: 0 });
  toca(p, 0);
  passo(p, DT);
  assert.equal(p.dados.item[0], null);
  assert.ok(p.dados.k[0].turboT > 1);
  roda(p, 0.6);
  assert.ok(velocidade(p, 0) > V_MAX * 1.2, 'arrancada: ' + velocidade(p, 0));
});

test('kart: poca de oleo larga atras e quem passa roda (o dono so depois de sair dela)', () => {
  const p = partidaCom(jogo); semCaixas(p);
  const q = poe(p, 0, 0.1, 0, 8); poe(p, 1, 0.5, 0, 0);
  p.dados.item[0] = 'oleo';
  entrada(p, 0, { x: 0, y: -1, n: 0 }); toca(p, 0);
  passo(p, DT);
  assert.equal(p.dados.pocas.length, 1);
  const poca = p.dados.pocas[0];
  assert.ok((poca.x - p.jogadores[0].x) * q.tx + (poca.z - p.jogadores[0].z) * q.tz < -1, 'ficou atras');
  assert.equal(p.dados.k[0].spinT, 0, 'o dono nao roda na propria poca ao largar');
  // o outro passa por cima
  p.jogadores[1].x = poca.x; p.jogadores[1].z = poca.z;
  passo(p, DT);
  assert.ok(p.dados.k[1].spinT > 0.5, 'rodou');
  assert.equal(p.dados.pocas.length, 0, 'a poca some depois de pegar alguem');
  assert.ok(p.celular[1].vibra >= 1, 'celular vibra');
  // rodando, ele perde a velocidade
  p.dados.k[1].vx = 10;
  roda(p, 1);
  assert.ok(velocidade(p, 1) < 1.5);
});

test('kart: missil teleguiado vai atras do outro kart e faz ele rodar', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.05, 0, 0);
  poe(p, 1, 0.05 + 14 / COMP, 0, 0);
  p.dados.item[0] = 'missil';
  entrada(p, 0, { x: 0, y: 0, n: 0 }); toca(p, 0);
  passo(p, DT);
  assert.equal(p.dados.misseis.length, 1);
  assert.equal(p.dados.item[0], null);
  let rodou = false;
  corre(p, 3, p => { rodou ||= p.dados.k[1].spinT > 0; });
  assert.ok(rodou, 'o missil acertou');
  assert.equal(p.dados.misseis.length, 0);
  assert.ok(p.celular[1].vibra >= 1);
  assert.equal(p.dados.k[0].spinT, 0, 'o dono nao e atingido');

  // faz a curva atras do alvo que se mexe (alvo corre pela pista, o missil e mais rapido)
  const r = partidaCom(jogo); semCaixas(r);
  poe(r, 0, 0.3, 0, 0); poe(r, 1, 0.35, 0, V_MAX);
  r.dados.item[0] = 'missil';
  entrada(r, 0, { x: 0, y: 0, n: 0 }); toca(r, 0);
  let acertou = false;
  corre(r, 5, (r) => { pilota(r, 1); acertou ||= r.dados.k[1].spinT > 0; });
  assert.ok(acertou, 'alcancou o alvo em movimento');
});

test('kart: escudo bloqueia exatamente 1 golpe', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.1, 0, 0); poe(p, 1, 0.5, 0, 0);
  p.dados.item[0] = 'escudo';
  entrada(p, 0, { x: 0, y: 0, n: 0 }); toca(p, 0);
  passo(p, DT);
  assert.ok(p.dados.escudo[0] > 5);
  const poca = () => ({ x: p.jogadores[0].x, z: p.jogadores[0].z, t: 10, dono: 1, grace: 0 });
  p.dados.pocas.push(poca());
  passo(p, DT);
  assert.equal(p.dados.k[0].spinT, 0, 'bloqueou');
  assert.equal(p.dados.escudo[0], 0, 'o escudo gastou');
  assert.ok(p.celular[0].vibra >= 1);
  roda(p, 1.5);
  p.dados.pocas.push(poca());
  passo(p, DT);
  assert.ok(p.dados.k[0].spinT > 0.5, 'o segundo golpe pega');
  // missil no escudo tambem e bloqueado
  const q = partidaCom(jogo); semCaixas(q);
  poe(q, 0, 0.05, 0, 0); poe(q, 1, 0.05 + 10 / COMP, 0, 0);
  q.dados.escudo[1] = 10; q.dados.item[0] = 'missil';
  entrada(q, 0, { x: 0, y: 0, n: 0 }); toca(q, 0);
  corre(q, 2);
  assert.equal(q.dados.k[1].spinT, 0);
  assert.equal(q.dados.escudo[1], 0);
});

test('kart: ima puxa o outro para tras', () => {
  const corrida = comIma => {
    const p = partidaCom(jogo); semCaixas(p);
    poe(p, 0, 0.1, 0, V_MAX); poe(p, 1, 0.1 + 8 / COMP, 0, V_MAX);
    if (comIma) p.dados.item[0] = 'ima';
    entrada(p, 0, { x: 0, y: 0, n: 0 });
    let puxou = 0;
    corre(p, 2.5, (p, q) => {
      pilota(p, 0); pilota(p, 1);
      if (comIma && q === 20) toca(p, 0);
      puxou = Math.max(puxou, p.dados.k[1].puxaT);
    });
    return { prog: p.dados.idx[1], puxou, item: p.dados.item[0] };
  };
  const sem = corrida(false), com = corrida(true);
  assert.ok(com.puxou > 0.3, 'puxando');
  assert.equal(com.item, null);
  assert.ok(com.prog < sem.prog - 20, `o outro andou menos (amostras da pista): ${com.prog} contra ${sem.prog}`);
});

test('kart: toque curto no A usa o item e nao se perde; sem item nao faz nada', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.02, 0, 5);
  p.dados.item[0] = 'turbo';
  entrada(p, 0, { x: 0, y: 0, d: false, n: 0 });
  entrada(p, 0, { x: 0, y: 0, d: false, n: 1 });     // apertou e soltou antes do quadro: so o contador mostra
  passo(p, DT);
  assert.equal(p.dados.item[0], null);
  assert.ok(p.dados.k[0].turboT > 0);
  // dois toques em quadros seguidos com um item so: usa uma vez
  p.dados.item[0] = 'escudo';
  toca(p, 0); passo(p, DT);
  toca(p, 0); passo(p, DT);
  assert.equal(p.dados.item[0], null);
  assert.ok(p.dados.escudo[0] > 0);
  // sem item
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  toca(p, 1); passo(p, DT);
  assert.ok(p.jogadores[1].n >= 1, 'o toque chegou');
  assert.equal(p.dados.item[1], null);
  assert.equal(p.dados.pocas.length + p.dados.misseis.length, 0);
  assert.equal(p.dados.k[1].turboT, 0);
  assert.equal(p.dados.escudo[1], 0);
  // toque curto no B comeca o drift
  const q = partidaCom(jogo); semCaixas(q);
  poe(q, 0, 0.02, 0, V_MAX);
  entrada(q, 0, { x: 0.8, y: -1, nb: 0 });
  entrada(q, 0, { x: 0.8, y: -1, b: false, nb: 1 });
  passo(q, DT);
  assert.equal(q.dados.k[0].drift, 1, 'toque rapido no B nao se perde');
});

test('kart: caixas de item dao item, reaparecem e quem ja tem item nao pega outro', () => {
  const p = partidaCom(jogo);
  assert.ok(p.dados.caixas.length >= 4);
  const c = p.dados.caixas[0];
  assert.ok(c.t <= 0);
  p.jogadores[0].x = c.x; p.jogadores[0].z = c.z; p.dados.k[0].vx = p.dados.k[0].vz = 0;
  passo(p, DT);
  assert.ok(['turbo', 'oleo', 'missil', 'escudo', 'ima'].includes(p.dados.item[0]), 'pegou ' + p.dados.item[0]);
  assert.ok(c.t > 3, 'a caixa sumiu');
  const item = p.dados.item[0];
  // sai de cima e espera reaparecer
  poe(p, 0, 0.9, 0, 0);
  roda(p, 6);
  assert.ok(c.t <= 0, 'reapareceu');
  // quem tem item passa por cima e nao troca nem gasta a caixa
  p.jogadores[0].x = c.x; p.jogadores[0].z = c.z; p.dados.k[0].vx = p.dados.k[0].vz = 0;
  passo(p, DT);
  assert.equal(p.dados.item[0], item);
  assert.ok(c.t <= 0, 'a caixa continua la');
});

test('kart: quem esta atras recebe itens mais fortes (equilibrio)', () => {
  const conta = atraso => {
    const rng = sorteio(7), n = {};
    for (let k = 0; k < 5000; k++) { const it = sorteiaItem(rng, atraso); n[it] = (n[it] ?? 0) + 1; }
    return n;
  };
  const atras = conta(0.6), frente = conta(-0.6), meio = conta(0);
  for (const it of ['turbo', 'oleo', 'missil', 'escudo', 'ima']) assert.ok(atras[it] > 0 && frente[it] > 0 && meio[it] > 0, it + ' nunca sai');
  assert.ok(atras.missil > frente.missil * 2, 'missil: atras ' + atras.missil + ' frente ' + frente.missil);
  assert.ok(atras.ima > frente.ima, 'ima');
  assert.ok(frente.escudo > atras.escudo, 'escudo para quem lidera');
  assert.ok(frente.oleo > atras.oleo, 'oleo para quem lidera');
});

test('kart: batida entre os karts nao os junta nem os joga para fora', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.1, 0, V_MAX); poe(p, 1, 0.1, 0.5, 0);
  entrada(p, 0, { x: 0, y: -1 });
  roda(p, 1);
  const [a, b] = p.jogadores;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2 * R_KART - 0.05, 'karts separados');

  // batida por tras: quem estava na frente ganha um empurrao e o celular dos dois sente a pancada
  const q = partidaCom(jogo); semCaixas(q);
  poe(q, 0, 0.1, 0, V_MAX); poe(q, 1, 0.1 + 2.4 / COMP, 0, 4);
  q.eventos.length = 0;
  passo(q, DT); passo(q, DT);
  assert.ok(velocidade(q, 1) > 6, 'empurrou o da frente: ' + velocidade(q, 1));
  assert.ok(velocidade(q, 0) < V_MAX - 2, 'o de tras perdeu embalo: ' + velocidade(q, 0));
  assert.ok(q.eventos.includes('batida'));
});

test('kart: nunca sai do mundo, nem batendo na parede por muito tempo nem com dedos aleatorios', () => {
  const dentro = p => {
    for (const j of p.jogadores) assert.ok(Math.abs(j.x) <= LX && Math.abs(j.z) <= LZ, `kart fora: ${j.x}, ${j.z}`);
    for (const m of p.dados.misseis) assert.ok(Math.abs(m.x) <= LX && Math.abs(m.z) <= LZ, 'missil fora');
    for (const o of p.dados.pocas) assert.ok(Math.abs(o.x) <= LX && Math.abs(o.z) <= LZ, 'poca fora');
  };
  for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7, 2.4]) {
    const p = partidaCom(jogo); semCaixas(p);
    poe(p, 0, 0.5, 0, 0); poe(p, 1, 0.3, 0, 0);
    p.dados.k[0].ang = ang; p.dados.k[1].ang = ang + 1;
    p.dados.item[0] = 'oleo'; p.dados.item[1] = 'missil';
    for (let q = 0; q < 8 * 60; q++) {
      for (const i of [0, 1]) entrada(p, i, { x: i ? 0.2 : 0, y: -1, n: q === 30 ? 1 : 0 });
      passo(p, DT); dentro(p);
    }
  }
  for (let s = 1; s <= 6; s++) rodada(jogo, (p, q, rng) => { aleatorio(p, q, rng); dentro(p); }, s);
});

test('kart: tela dividida, cada camera atras do proprio kart olhando para a frente dele', () => {
  assert.equal(typeof jogo.cameras, 'function');
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.3, 0, V_MAX); poe(p, 1, 0.7, 0, V_MAX);
  roda(p, 2);                                      // o rumo da camera alcanca o kart
  const cams = jogo.cameras(p, 1);
  assert.equal(cams.length, 2);
  cams.forEach((c, i) => {
    for (const k of ['x', 'y', 'z', 'ox', 'oy', 'oz']) assert.ok(Number.isFinite(c[k]), k + ' invalido');
    const j = p.jogadores[i], k = p.dados.k[i], fx = Math.cos(k.ang), fz = Math.sin(k.ang);
    const atras = (j.x - c.x) * fx + (j.z - c.z) * fz, frente = (c.ox - j.x) * fx + (c.oz - j.z) * fz;
    assert.ok(atras > 4 && atras < 10, 'camera atras do kart ' + i + ': ' + atras);
    assert.ok(frente > 2, 'olha para a frente do kart');
    assert.ok(c.y > 2 && c.y < 6 && c.oy < c.y, 'um pouco acima, olhando para baixo');
  });
  // rodando (oleo ou missil) a camera nao gira junto
  const antes = jogo.cameras(p, 1)[1];
  p.dados.k[1].spinT = 1; p.dados.k[1].ang += 2;
  roda(p, 0.3);
  p.dados.k[1].ang -= 2;                           // volta o kart ao rumo: so a camera importa aqui
  const depois = jogo.cameras(p, 1)[1];
  assert.ok(Math.hypot(depois.x - antes.x, depois.z - antes.z) < 0.5);
  // fora de jogo (sem dados ainda) nao quebra
  assert.doesNotThrow(() => jogo.cameras({ jogadores: [{ x: 0, z: 0 }, { x: 0, z: 0 }], dados: {} }, 0));
  assert.ok(CAM.atras > CAM.frente * 0.5);
});

test('kart: celular mostra posicao, volta e item; placar e rotulo de voltas', () => {
  const p = partidaCom(jogo); semCaixas(p);
  poe(p, 0, 0.1); poe(p, 1, 0.05);
  p.dados.item[0] = 'missil';
  passo(p, DT);
  assert.match(p.celular[0].texto, /1º/);
  assert.match(p.celular[1].texto, /2º/);
  assert.match(p.celular[0].texto, /Volta 1\/3/);
  assert.match(p.celular[0].a, /MÍSSIL/);
  assert.match(p.celular[0].texto, /MÍSSIL/);
  assert.equal(p.celular[1].a, 'ITEM');
  assert.equal(jogo.rotulo, 'voltas');
  assert.ok(jogo.duracao <= 60);
});

test('kart: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});
