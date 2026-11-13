// Kart Maluco: corrida de kart com itens em um circuito fechado, 3 voltas, em tela dividida com a câmera atrás de cada kart.
// Controle relativo ao kart: o x do joystick vira; qualquer toque no joystick acelera, puxar para baixo freia e dá ré.
// B segurado numa curva é a DERRAPAGEM: carrega faíscas (branca, azul, laranja) e ao soltar vem o turbo. A usa o item.
// O kart é controlado aqui (semMovimento): o motor só guarda a posição.
// Sentido da pista: reta de baixo para a direita, anti-horário visto de cima.
import { RAIO, tempoIntro } from '../logica.mjs';

export const VOLTAS = 3, LIMITE = 56, HALF = 3.2, PORTOES = 8, N = 400;
export const LX = 25, LZ = 17.5;
export const V_MAX = 13.5, T_AZUL = 0.8, T_LARANJA = 1.8;
const V_GRAMA = 5.5, V_RE = 5, ACEL = 14, FREIO = 26, MORTO = 0.2, GIRO = 2.5, GIRO_DRIFT = 1.95, CARGA_MAX = 3;
const TURBO_X = 1.42, T_RODA = 1.2, T_IMUNE = 1.2, T_ESCUDO = 15, T_PUXA = 1.2, PUXA = 30;
const V_MISSIL = 30, GIRO_MISSIL = 3.4, T_MISSIL = 4, R_POCA = 1.4, R_MISSIL = 1.4, R_CAIXA = 1.7, REAPARECE = 5;
export const R_KART = 1.15;

const limita = (v, m) => Math.max(-m, Math.min(m, v));
const volta = a => Math.atan2(Math.sin(a), Math.cos(a));
const zona = v => (Math.abs(v) < 0.12 ? 0 : Math.sign(v) * (Math.abs(v) - 0.12) / 0.88);

// ---------- a pista: curva suave por pontos de controle, reamostrada em N pontos a distâncias iguais ----------
// reta de largada embaixo, curva longa à direita, grampo no alto, um "U" que desce até o meio do mapa, outro grampo e a volta
const CONTROLE = [[-12, 12], [0, 12.5], [11, 12], [17.5, 8.5], [19.5, 1.5], [18.5, -5.5], [15.5, -11], [10, -13.2], [5.5, -10.5],
  [4.5, -5], [3, -1], [0, 1], [-3.5, 0.4], [-6, -3], [-7, -7], [-9, -11.5], [-13.5, -13.2], [-18, -10.5], [-20.5, -3.5], [-19.5, 5], [-16.5, 10.5]];

function catmull(p0, p1, p2, p3, t) {          // Catmull-Rom centrípeto (Barry e Goldman): não faz laço nem estica
  const d = (a, b) => Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1])) || 1e-4;
  const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => [0, 1].map(k => ((tb - u) * a[k] + (u - ta) * b[k]) / (tb - ta));
  const a1 = mix(p0, p1, 0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, 0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

function constroiPista() {
  const n = CONTROLE.length, denso = [];
  for (let i = 0; i < n; i++)
    for (let s = 0; s < 60; s++) denso.push(catmull(CONTROLE[(i - 1 + n) % n], CONTROLE[i], CONTROLE[(i + 1) % n], CONTROLE[(i + 2) % n], s / 60));
  const acum = [0];
  for (let i = 1; i <= denso.length; i++) {
    const a = denso[i - 1], b = denso[i % denso.length];
    acum.push(acum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const comp = acum[denso.length], pts = [];
  for (let i = 0, k = 0; i < N; i++) {
    const s = i / N * comp;
    while (acum[k + 1] < s) k++;
    const f = (s - acum[k]) / (acum[k + 1] - acum[k]), a = denso[k], b = denso[(k + 1) % denso.length];
    pts.push({ x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f });
  }
  // a linha de chegada fica na reta de baixo, perto de x = -5
  let ini = 0;
  const dist = q => Math.hypot(q.x + 5, q.z - 12.4);
  for (let i = 1; i < N; i++) if (dist(pts[i]) < dist(pts[ini])) ini = i;
  const lista = pts.slice(ini).concat(pts.slice(0, ini));
  lista.forEach((q, i) => {
    const a = lista[(i - 1 + N) % N], b = lista[(i + 1) % N], len = Math.hypot(b.x - a.x, b.z - a.z);
    q.tx = (b.x - a.x) / len; q.tz = (b.z - a.z) / len;
  });
  // curvatura com sinal (positiva = curva para a direita de quem corre), para as zebras e as setas
  lista.forEach((q, i) => {
    const a = lista[(i - 4 + N) % N], b = lista[(i + 4) % N];
    q.curva = volta(Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx)) / (8 * comp / N);
  });
  return { lista, comp };
}

const { lista: PISTA, comp: COMP } = constroiPista();
export { PISTA, COMP };
export const PORTAO = Array.from({ length: PORTOES }, (_, k) => ({ idx: k * N / PORTOES, ...PISTA[k * N / PORTOES] }));
const SEG = N / PORTOES;

// Ponto da pista: u de 0 a 1 ao longo da volta (0 = linha de chegada), lat = lado (positivo à direita de quem corre).
export function pontoPista(u, lat = 0) {
  const f = (((u % 1) + 1) % 1) * N, i = Math.floor(f), r = f - i, a = PISTA[i % N], b = PISTA[(i + 1) % N];
  let tx = a.tx + (b.tx - a.tx) * r, tz = a.tz + (b.tz - a.tz) * r;
  const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
  const x = a.x + (b.x - a.x) * r, z = a.z + (b.z - a.z) * r;
  return { x: x - tz * lat, z: z + tx * lat, tx, tz };
}

// Ponto mais perto da pista (índice da amostra, distância e lado). Com `ini` só olha `janela` amostras para os dois lados.
export function projeta(x, z, ini = 0, janela = N) {
  let melhor = 0, menor = Infinity;
  const n = Math.min(N, janela * 2 + 1);
  for (let s = 0; s < n; s++) {
    const i = janela >= N / 2 ? s : (ini - janela + s + N * 2) % N, q = PISTA[i], d = (x - q.x) ** 2 + (z - q.z) ** 2;
    if (d < menor) { menor = d; melhor = i; }
  }
  const q = PISTA[melhor];
  return { i: melhor, d: Math.sqrt(menor), lat: (x - q.x) * -q.tz + (z - q.z) * q.tx };
}

// ---------- itens ----------
// peso de cada item para quem lidera (frente) e para quem está muito atrás
const ITENS = [
  { id: 'turbo', nome: 'TURBO', frente: 3, atras: 3 },
  { id: 'oleo', nome: 'ÓLEO', frente: 3, atras: 1 },
  { id: 'missil', nome: 'MÍSSIL', frente: 1, atras: 4.5 },
  { id: 'escudo', nome: 'ESCUDO', frente: 3, atras: 1 },
  { id: 'ima', nome: 'ÍMÃ', frente: 1, atras: 3.5 },
];
export const NOME_ITEM = Object.fromEntries(ITENS.map(i => [i.id, i.nome]));

// atraso: quanto o jogador está atrás do outro, em voltas (negativo se está na frente). Quem está atrás tira item mais forte.
export function sorteiaItem(rng, atraso) {
  const u = (limita(atraso * 3, 1) + 1) / 2;
  const pesos = ITENS.map(i => i.frente + (i.atras - i.frente) * u);
  let r = rng() * pesos.reduce((a, b) => a + b, 0);
  for (let k = 0; k < ITENS.length; k++) if ((r -= pesos[k]) < 0) return ITENS[k].id;
  return ITENS[0].id;
}

// efeitos para o desenho: lista curta com contador absoluto (o desenho guarda até onde já viu)
const fx = (d, x, z, cor, tipo) => {
  d.fx.push({ x, z, cor, tipo });
  if (d.fx.length > 80) { d.fx.splice(0, 40); d.fxBase += 40; }
};
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i]?.vibra ?? 0) + 1 }; };

// Golpe de um item no kart i. Imune ou rodando: ignora (devolve false e o item segue). Escudo: gasta e bloqueia.
function golpe(p, d, i, tipo) {
  const k = d.k[i], j = p.jogadores[i];
  if (tipo !== 'ima' && d.imune[i] > 0) return false;
  if (d.escudo[i] > 0) {
    d.escudo[i] = 0; d.imune[i] = 0.8;
    fx(d, j.x, j.z, i, 'escudo'); p.eventos.push('batida'); vibra(p, i);
    return true;
  }
  if (tipo === 'ima') { k.puxaT = T_PUXA; fx(d, j.x, j.z, i, 'ima'); vibra(p, i); return true; }
  k.spinT = T_RODA; k.drift = 0; k.carga = 0; k.turboT = 0;
  k.vx *= 0.35; k.vz *= 0.35;
  d.imune[i] = T_RODA + T_IMUNE;
  fx(d, j.x, j.z, i, tipo === 'missil' ? 'explosao' : 'rodou');
  p.eventos.push(tipo === 'missil' ? 'explosao' : 'queda'); vibra(p, i);
  return true;
}

function usaItem(p, d, i) {
  const item = d.item[i], j = p.jogadores[i], k = d.k[i], c = Math.cos(k.ang), s = Math.sin(k.ang);
  if (!item) return;
  d.item[i] = null; d.usou[i] = 0.8;
  if (item === 'turbo') {
    k.turboT = Math.max(k.turboT, 1.8); k.turboNivel = 2;
    const v = k.vx * c + k.vz * s;
    if (v < V_MAX) { k.vx += c * (V_MAX - v) * 0.5; k.vz += s * (V_MAX - v) * 0.5; }
    fx(d, j.x - c, j.z - s, i, 'turbo2'); p.eventos.push('dash');
  } else if (item === 'oleo') {
    d.pocas.push({ x: limita(j.x - c * 2.2, LX - 1), z: limita(j.z - s * 2.2, LZ - 1), t: 14, dono: i, grace: 1.2 });
    if (d.pocas.length > 5) d.pocas.shift();
    fx(d, j.x - c * 2.2, j.z - s * 2.2, i, 'oleo'); p.eventos.push('queda');
  } else if (item === 'missil') {
    d.misseis.push({ x: j.x + c * 1.8, z: j.z + s * 1.8, ang: k.ang, dono: i, idade: 0, vivo: true });
    fx(d, j.x + c * 1.8, j.z + s * 1.8, i, 'tiro'); p.eventos.push('dash');
  } else if (item === 'escudo') {
    d.escudo[i] = T_ESCUDO; fx(d, j.x, j.z, i, 'escudo'); p.eventos.push('troca');
  } else if (item === 'ima') {
    golpe(p, d, 1 - i, 'ima'); p.eventos.push('troca');
  }
}

// ---------- o kart ----------
// Acelerador: qualquer toque no joystick acelera (o dedo pode ir todo para o lado na curva sem perder o embalo);
// puxar para baixo freia e depois dá ré; soltar o joystick deixa o kart ir parando.
export function acelerador(ent) {
  if (Math.hypot(ent.x, ent.y) <= MORTO) return 0;
  return ent.y > 0.45 ? -1 : 1;
}

function guia(p, d, i, dt) {
  const j = p.jogadores[i], k = d.k[i], ent = j.ent;
  j.vx = 0; j.vz = 0;                              // o motor não move ninguém: a velocidade do kart é k.vx, k.vz
  d.imune[i] = Math.max(0, d.imune[i] - dt); d.escudo[i] = Math.max(0, d.escudo[i] - dt); d.usou[i] = Math.max(0, d.usou[i] - dt);
  k.turboT = Math.max(0, k.turboT - dt); k.spinT = Math.max(0, k.spinT - dt); k.puxaT = Math.max(0, k.puxaT - dt);
  if (j.apertouA > 0) usaItem(p, d, i);

  const livre = k.spinT <= 0;
  const gas = livre ? acelerador(ent) : 0, dir = livre ? zona(ent.x) : 0;
  d.bBuf[i] = j.apertouB > 0 ? 0.12 : Math.max(0, d.bBuf[i] - dt);
  const segura = ent.b || d.bBuf[i] > 0;
  const vf0 = k.vx * Math.cos(k.ang) + k.vz * Math.sin(k.ang);

  // derrapagem: começa segurando B virando em velocidade; ao soltar, a carga vira turbo
  if (!k.drift) {
    if (livre && segura && Math.abs(dir) > 0.3 && vf0 > 6) { k.drift = Math.sign(dir); k.carga = 0; p.eventos.push('pulo'); }
  } else if (!segura || vf0 < 3 || !livre) {
    if (livre && k.carga >= T_AZUL) {
      const laranja = k.carga >= T_LARANJA;
      k.turboT = Math.max(k.turboT, Math.min(1.6, 0.5 + 0.55 * (k.carga - T_AZUL)));
      k.turboNivel = laranja ? 2 : 1;
      fx(d, j.x, j.z, i, laranja ? 'turbo2' : 'turbo'); p.eventos.push('dash');
    }
    k.drift = 0; k.carga = 0;
  } else k.carga = Math.min(CARGA_MAX, k.carga + dt * (1 + 0.3 * Math.max(0, dir * k.drift)));
  k.nivel = k.drift ? (k.carga >= T_LARANJA ? 2 : k.carga >= T_AZUL ? 1 : 0) : 0;

  // direção: em ré o volante inverte; na derrapagem a curva segue o lado dela e o x aperta ou abre
  let giro = 0;
  if (livre) {
    if (k.drift) giro = k.drift * GIRO_DRIFT * (0.9 + 0.6 * dir * k.drift);
    else giro = dir * GIRO * Math.min(1, 0.45 + Math.abs(vf0) / 5) * (vf0 < -0.5 ? -1 : 1);   // parado ainda vira (sai da parede)
  }
  k.ang = volta(k.ang + giro * dt);

  const c = Math.cos(k.ang), s = Math.sin(k.ang);
  let vf = k.vx * c + k.vz * s, vl = -k.vx * s + k.vz * c;
  const turbo = k.turboT > 0, naPista = d.naPista[i];
  // curva fechada sem derrapar alivia um pouco o acelerador sozinha: dá para fazer, mas a derrapagem é mais rápida
  const alivio = k.drift ? 0.95 : 1 - 0.16 * Math.abs(dir);
  const vmax = (naPista ? V_MAX : V_GRAMA) * (turbo ? TURBO_X : 1) * alivio;
  if (!livre) vf *= Math.pow(0.04, dt);                                     // rodando: perde quase toda a velocidade
  else if (gas > 0) { if (vf < vmax) vf = Math.min(vmax, vf + ACEL * (turbo ? 2.2 : 1) * dt); }
  else if (gas < 0) vf = vf > 0.5 ? Math.max(0, vf - FREIO * dt) : Math.max(-V_RE, vf - ACEL * 0.7 * dt);
  else vf *= Math.pow(0.45, dt);
  if (turbo && livre && gas >= 0 && vf < vmax) vf = Math.min(vmax, vf + ACEL * 3 * dt);   // puxar para baixo freia até no turbo
  if (vf > vmax) vf = Math.max(vmax, vf - (naPista ? 9 : 40) * dt);
  vl *= Math.exp(-(k.drift ? 4.2 : naPista ? 9 : 6) * dt);
  k.vx = vf * c - vl * s; k.vz = vf * s + vl * c;

  if (k.puxaT > 0) {                               // ímã: arrasta para trás na direção da pista
    const q = PISTA[d.idx[i]];
    k.vx -= q.tx * PUXA * dt; k.vz -= q.tz * PUXA * dt;
  }

  j.x += k.vx * dt; j.z += k.vz * dt;
  const mx = LX - RAIO, mz = LZ - RAIO;            // paredes do mundo: encosta e rebate um pouco
  if (j.x > mx) { j.x = mx; if (k.vx > 0) k.vx *= -0.3; } else if (j.x < -mx) { j.x = -mx; if (k.vx < 0) k.vx *= -0.3; }
  if (j.z > mz) { j.z = mz; if (k.vz > 0) k.vz *= -0.3; } else if (j.z < -mz) { j.z = -mz; if (k.vz < 0) k.vz *= -0.3; }
  d.naPista[i] = projeta(j.x, j.z).d <= HALF + 0.35;
  // rumo da câmera: segue o kart com um pouco de atraso e não gira junto quando ele roda
  if (k.spinT <= 0) d.camAng[i] = volta(d.camAng[i] + volta(k.ang - d.camAng[i]) * Math.min(1, dt * 5));
}

// Batida entre os karts (círculos de raio R_KART): separa, troca o embalo no eixo da batida e dá um empurrão.
function batida(p, d) {
  const [a, b] = p.jogadores, ka = d.k[0], kb = d.k[1];
  const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), soma = R_KART * 2;
  if (dist >= soma) { d.encosta = false; return false; }
  const nx = dist > 1e-6 ? dx / dist : 1, nz = dist > 1e-6 ? dz / dist : 0, sobra = soma - dist;
  a.x -= nx * sobra / 2; a.z -= nz * sobra / 2; b.x += nx * sobra / 2; b.z += nz * sobra / 2;
  const rel = (ka.vx - kb.vx) * nx + (ka.vz - kb.vz) * nz;
  const imp = Math.max(0, rel) * 0.8 + 2.2;                  // sempre um empurrãozinho, mais forte quanto mais rápido bateu
  ka.vx -= nx * imp; ka.vz -= nz * imp; kb.vx += nx * imp; kb.vz += nz * imp;
  for (const j of [a, b]) { j.x = limita(j.x, LX - RAIO); j.z = limita(j.z, LZ - RAIO); }   // o empurrão não atravessa o muro
  if (!d.encosta || rel > 3) {
    p.eventos.push('batida'); fx(d, (a.x + b.x) / 2, (a.z + b.z) / 2, -1, 'batida');
    d.k[0].tranco = d.k[1].tranco = 0.3;
  }
  d.encosta = true;
  return true;
}

const cruzou = (a, b, g) => {
  const sa = (a.x - g.x) * g.tx + (a.z - g.z) * g.tz, sb = (b.x - g.x) * g.tx + (b.z - g.z) * g.tz;
  return sa < 0 && sb >= 0 && Math.abs((b.x - g.x) * -g.tz + (b.z - g.z) * g.tx) < 9;
};

// Câmeras da tela dividida: atrás e acima de cada kart, olhando para a frente dele (metade esquerda = jogador 1).
export const CAM = { atras: 8.4, alto: 5.4, frente: 10, olhoY: 0 };
export function persegue(j, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: j.x - c * CAM.atras, y: CAM.alto, z: j.z - s * CAM.atras, ox: j.x + c * CAM.frente, oy: CAM.olhoY, oz: j.z + s * CAM.frente };
}

export default {
  id: 'kart', nome: 'Kart Maluco',
  dica: 'Joystick vira e acelera, puxar para baixo freia. Segure B na curva e solte para o turbo. A usa o item. 3 voltas!',
  controle: { modo: 'padrao', a: 'ITEM', b: 'DERRAPA' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'voltas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const lados = p.rng() < 0.5 ? [-1.6, 1.6] : [1.6, -1.6];
    const k = [], idx = [];
    p.jogadores.forEach((j, i) => {
      const q = pontoPista(-0.018, lados[i]);
      j.x = q.x; j.z = q.z;
      k.push({ ang: Math.atan2(q.tz, q.tx), vx: 0, vz: 0, drift: 0, carga: 0, nivel: 0, turboT: 0, turboNivel: 1, spinT: 0, puxaT: 0, tranco: 0 });
      idx.push(projeta(j.x, j.z).i);
    });
    const caixas = [];
    for (const u of [0.16, 0.41, 0.63, 0.86])
      for (const lat of [-1.7, 0, 1.7]) caixas.push({ ...pontoPista(u, lat), t: 0 });
    p.dados = {
      placar: [0, 0], k, idx, item: [null, null], escudo: [0, 0], imune: [0, 0], usou: [0, 0], bBuf: [0, 0], naPista: [true, true],
      voltas: [0, 0], prox: [1, 1], cruz: [0, 0], progresso: [0, 0], pos: [1, 1], tempos: [[], []], encosta: false,
      antes: p.jogadores.map(j => ({ x: j.x, z: j.z })),
      caixas, pocas: [], misseis: [], fx: [], fxBase: 0, aviso: '', avisoT: 0, camAng: k.map(q => q.ang),
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0 && (d.avisoT -= dt) <= 0) d.aviso = '';
    p.jogadores.forEach((_, i) => guia(p, d, i, dt));
    batida(p, d);
    for (const k of d.k) k.tranco = Math.max(0, k.tranco - dt);

    // caixas de item: pega quem passa sem item na mão; volta depois de alguns segundos
    for (const cx of d.caixas) {
      if (cx.t > 0) { cx.t -= dt; continue; }
      p.jogadores.forEach((j, i) => {
        if (cx.t > 0 || d.item[i] || Math.hypot(j.x - cx.x, j.z - cx.z) > R_CAIXA) return;
        d.item[i] = sorteiaItem(p.rng, (d.progresso[1 - i] - d.progresso[i]) / PORTOES);
        cx.t = REAPARECE; fx(d, cx.x, cx.z, i, 'pega'); p.eventos.push('moeda'); vibra(p, i);
      });
    }

    // poças de óleo
    for (const o of d.pocas) {
      o.t -= dt; o.grace -= dt;
      p.jogadores.forEach((j, i) => {
        if (o.t <= 0 || (i === o.dono && o.grace > 0) || Math.hypot(j.x - o.x, j.z - o.z) > R_POCA) return;
        if (golpe(p, d, i, 'oleo')) o.t = 0;
      });
    }
    d.pocas = d.pocas.filter(o => o.t > 0);

    // mísseis: voam atrás do outro kart, em passos curtos para nunca atravessá-lo
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / n;
    for (let s = 0; s < n; s++)
      for (const m of d.misseis) {
        if (!m.vivo) continue;
        const alvo = p.jogadores[1 - m.dono];
        m.ang = volta(m.ang + limita(volta(Math.atan2(alvo.z - m.z, alvo.x - m.x) - m.ang), GIRO_MISSIL * h));
        m.x += Math.cos(m.ang) * V_MISSIL * h; m.z += Math.sin(m.ang) * V_MISSIL * h; m.idade += h;
        if (m.idade > T_MISSIL || Math.abs(m.x) > LX - 0.5 || Math.abs(m.z) > LZ - 0.5) {
          m.vivo = false; m.x = limita(m.x, LX - 0.5); m.z = limita(m.z, LZ - 0.5); fx(d, m.x, m.z, m.dono, 'poof');
        } else if (Math.hypot(alvo.x - m.x, alvo.z - m.z) < R_MISSIL && golpe(p, d, 1 - m.dono, 'missil')) m.vivo = false;
      }
    d.misseis = d.misseis.filter(m => m.vivo);

    // portões em ordem: só vale cruzar o próximo, no sentido certo
    let venceu;
    p.jogadores.forEach((j, i) => {
      const a = d.antes[i];
      if (cruzou(a, j, PORTAO[d.prox[i]])) {
        d.cruz[i]++;
        if (d.prox[i] === 0) {
          d.voltas[i]++; d.placar[i] = d.voltas[i]; d.tempos[i].push(p.t); p.eventos.push('moeda'); fx(d, j.x, j.z, i, 'volta');
          if (d.voltas[i] >= VOLTAS) venceu = venceu === undefined ? i : -1;
          else if (d.voltas[i] === VOLTAS - 1 && d.voltas[1 - i] < VOLTAS - 1) { d.aviso = 'ÚLTIMA VOLTA!'; d.avisoCor = '#ffd84d'; d.avisoT = 1.5; }
        }
        d.prox[i] = (d.prox[i] + 1) % PORTOES;
      }
      a.x = j.x; a.z = j.z;
      // andamento: portões já cruzados mais a fração do trecho atual (só olha perto do último ponto, atalho não avança)
      d.idx[i] = projeta(j.x, j.z, d.idx[i], 40).i;
      const base = PORTAO[(d.prox[i] + PORTOES - 1) % PORTOES].idx, dif = ((d.idx[i] - base + N + N / 2) % N) - N / 2;
      d.progresso[i] = d.cruz[i] + Math.max(0, Math.min(0.999, dif / SEG));
    });
    const [pa, pb] = d.progresso;
    d.pos = [pb > pa + 1e-9 ? 2 : 1, pa > pb + 1e-9 ? 2 : 1];

    p.jogadores.forEach((_, i) => {                  // celular: posição, volta e item (escreve só quando muda)
      const item = d.item[i] ? NOME_ITEM[d.item[i]] : '';
      const texto = `${d.pos[i]}º lugar | Volta ${Math.min(VOLTAS, d.voltas[i] + 1)}/${VOLTAS}` + (item ? ` | Item: ${item}` : ' | Sem item');
      const a = item || 'ITEM', cel = p.celular[i] ?? {};
      if (cel.texto !== texto || cel.a !== a) p.celular[i] = { ...cel, texto, a };
    });

    if (venceu !== undefined) { p.eventos.push('gol'); return venceu; }
    if (p.t > LIMITE) return pa > pb + 1e-9 ? 0 : pb > pa + 1e-9 ? 1 : -1;
  },

  cameras(p) {
    const d = p.dados, js = p.jogadores;
    if (!js?.every(j => Number.isFinite(j?.x) && Number.isFinite(j?.z))) return null;
    return js.map((j, i) => persegue(j, d?.camAng?.[i] ?? d?.k?.[i]?.ang ?? 0));
  },

  monta(c) { montaCena(c); },
  desenha(c, dt, t) { desenhaCena(c, dt, t); },
};

// ---------- desenho ----------
const COR_ITEM = { turbo: 0xff9a1f, oleo: 0x7a4fe0, missil: 0xff3b3b, escudo: 0x3fb8ff, ima: 0xe04fd0 };
const css = n => '#' + n.toString(16).padStart(6, '0');

// Fita colada no chão ao longo da pista, do lado latA ao lado latB, com cor por trecho (corDe devolve null para pular).
function fita(THREE, latA, latB, y, corDe) {
  const pos = [], cor = [], ind = [], C = new THREE.Color();
  let v = 0;
  for (let i = 0; i < N; i++) {
    const hex = corDe(i);
    if (hex == null) continue;
    const a = PISTA[i], b = PISTA[(i + 1) % N];
    const la = typeof latA === 'function' ? latA(i) : latA, lb = typeof latB === 'function' ? latB(i) : latB;
    for (const [q, l] of [[a, la], [a, lb], [b, lb], [b, la]]) {
      pos.push(q.x - q.tz * l, y, q.z + q.tx * l);
      C.set(hex); cor.push(C.r, C.g, C.b);
    }
    ind.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  return geometria(THREE, pos, cor, ind);
}

function geometria(THREE, pos, cor, ind) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: pos.length }, (_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(ind);
  return g;
}

// retângulos soltos no chão (listras da grama, quadriculado, setas): lista de [x, z, meiaLarg, meiaFundo, ang, cor]
function placas(THREE, lista, y) {
  const pos = [], cor = [], ind = [], C = new THREE.Color();
  let v = 0;
  for (const [x, z, a, b, ang, hex] of lista) {
    const c = Math.cos(ang), s = Math.sin(ang);
    for (const [u, w] of [[-a, -b], [a, -b], [a, b], [-a, b]]) { pos.push(x + u * c - w * s, y, z + u * s + w * c); C.set(hex); cor.push(C.r, C.g, C.b); }
    ind.push(v, v + 2, v + 1, v, v + 3, v + 2); v += 4;
  }
  return geometria(THREE, pos, cor, ind);
}

function fazKart(c, i) {
  const { THREE, malha } = c, cor = c.cores[i], escuro = 0x1b1f2b, metal = 0xc9d0de;
  const g = new THREE.Group(), corpo = new THREE.Group();
  const peca = (geo, cc, x, y, z, extra) => { const m = malha(geo, cc, extra); m.position.set(x, y, z); corpo.add(m); return m; };
  const caixa = (lx, ly, lz, cc, x, y, z, extra) => peca(new THREE.BoxGeometry(lx, ly, lz), cc, x, y, z, extra);
  const brilho = { roughness: 0.35, metalness: 0.1 };
  // chassi baixo e largo, com bico, laterais e para-choque (frente = +x)
  caixa(2.5, 0.22, 1.5, escuro, 0, 0.32, 0);
  caixa(1.9, 0.36, 1.2, cor, -0.05, 0.56, 0, brilho);
  const bico = peca(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 4, 1), cor, 1.15, 0.55, 0, brilho);
  bico.rotation.set(0, Math.PI / 4, Math.PI / 2); bico.scale.set(1, 1, 0.72);
  caixa(0.25, 0.26, 1.75, escuro, 1.6, 0.42, 0);                                  // para-choque da frente
  for (const s of [-1, 1]) caixa(1.3, 0.3, 0.32, cor, -0.15, 0.48, s * 0.82, brilho);   // laterais
  caixa(0.95, 0.06, 0.9, 0xffffff, 0.55, 0.75, 0, { roughness: 0.4 });           // faixa branca no capô
  caixa(0.5, 0.07, 0.9, cor, 0.55, 0.785, 0, brilho);
  caixa(0.55, 0.55, 1.0, escuro, -0.55, 0.85, 0);                                  // encosto do banco
  // aerofólio baixo atrás (não tapa nada) e escapamentos
  caixa(0.35, 0.08, 1.7, cor, -1.3, 1.05, 0, brilho);
  for (const s of [-1, 1]) caixa(0.12, 0.38, 0.1, escuro, -1.25, 0.82, s * 0.6);
  const canos = [-1, 1].map(s => { const m = peca(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10), metal, -1.35, 0.5, s * 0.32, { metalness: 0.6, roughness: 0.3 }); m.rotation.z = Math.PI / 2; return m; });
  // rodas gordas com calota
  for (const [x, z, r, l] of [[0.85, 0.86, 0.36, 0.36], [0.85, -0.86, 0.36, 0.36], [-0.85, 0.9, 0.44, 0.46], [-0.85, -0.9, 0.44, 0.46]]) {
    const w = peca(new THREE.CylinderGeometry(r, r, l, 16), 0x14161d, x, r, z, { roughness: 0.9 }); w.rotation.x = Math.PI / 2;
    const cal = peca(new THREE.CylinderGeometry(r * 0.5, r * 0.5, l + 0.02, 12), metal, x, r, z, { metalness: 0.5, roughness: 0.3 });
    cal.rotation.x = Math.PI / 2; cal.castShadow = false;
  }
  // volante
  const volante = peca(new THREE.TorusGeometry(0.22, 0.05, 6, 16), escuro, 0.2, 1.0, 0); volante.rotation.y = Math.PI / 2; volante.rotation.z = 0.5;
  // chamas do turbo saindo dos canos
  const chamas = [-1, 1].map(s => {
    const m = malha(new THREE.ConeGeometry(0.2, 1.1, 10), 0xffa21f, { emissive: 0xff6a00, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
    m.rotation.z = Math.PI / 2; m.position.set(-2.1, 0.5, s * 0.32); m.castShadow = false; m.visible = false; corpo.add(m); return m;
  });
  // brilho das rodas de trás na derrapagem
  const brasas = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    m.position.set(-0.95, 0.18, s * 0.95); m.visible = false; corpo.add(m); return m;
  });
  // escudo: bolha
  const bolha = malha(new THREE.SphereGeometry(1.9, 22, 16), 0x66ccff, { emissive: 0x2a8fd0, emissiveIntensity: 0.6, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
  bolha.position.y = 0.9; bolha.castShadow = false; bolha.visible = false;
  // anel no chão na cor do jogador: acha o próprio kart de relance, mesmo no meio da confusão
  const anel = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.85, 40), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.75, depthWrite: false }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = 0.09;
  g.add(corpo, bolha, anel);
  // placa sobre o kart: posição e item (só no navegador)
  let placa = null;
  if (typeof document !== 'undefined') {
    const tela = document.createElement('canvas'); tela.width = 256; tela.height = 128;
    const textura = new THREE.CanvasTexture(tela);
    if (THREE.SRGBColorSpace) textura.colorSpace = THREE.SRGBColorSpace;
    placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false, transparent: true, toneMapped: false, fog: false, sizeAttenuation: false }));
    placa.scale.set(0.15, 0.075, 1);             // tamanho fixo na tela: não cresce quando o kart passa perto da câmera
    placa.position.set(0, 3.0, 0); placa.renderOrder = 12;
    placa.userData = { tela, textura, chave: '' };
    g.add(placa);
  }
  c.grupo.add(g);
  return { g, corpo, chamas, brasas, bolha, anel, placa, canos };
}

// pictograma do item, desenhado no canvas da placa (cx, cy no centro, r raio)
function pictograma(x, item, cx, cy, r) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = css(COR_ITEM[item]); x.strokeStyle = '#11131a'; x.lineWidth = 6;
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  const k = r / 40;
  x.scale(k, k);
  if (item === 'turbo') {                        // duas setas para a frente
    x.lineWidth = 9;
    for (const dx of [-12, 8]) { x.beginPath(); x.moveTo(dx - 8, -18); x.lineTo(dx + 8, 0); x.lineTo(dx - 8, 18); x.stroke(); }
  } else if (item === 'oleo') {                  // gota
    x.beginPath(); x.moveTo(0, -24); x.bezierCurveTo(14, -6, 18, 4, 18, 10); x.arc(0, 10, 18, 0, Math.PI); x.bezierCurveTo(-18, 4, -14, -6, 0, -24); x.fill();
  } else if (item === 'missil') {                // foguete deitado
    x.beginPath(); x.moveTo(24, 0); x.lineTo(8, -10); x.lineTo(-16, -10); x.lineTo(-24, -18); x.lineTo(-22, 0); x.lineTo(-24, 18); x.lineTo(-16, 10); x.lineTo(8, 10); x.closePath(); x.fill();
  } else if (item === 'escudo') {                // escudo
    x.beginPath(); x.moveTo(0, -24); x.lineTo(20, -16); x.lineTo(18, 6); x.quadraticCurveTo(12, 20, 0, 26); x.quadraticCurveTo(-12, 20, -18, 6); x.lineTo(-20, -16); x.closePath(); x.fill();
  } else if (item === 'ima') {                   // ferradura
    x.lineWidth = 12; x.beginPath(); x.arc(0, 2, 15, 0, Math.PI); x.moveTo(15, 2); x.lineTo(15, -18); x.moveTo(-15, 2); x.lineTo(-15, -18); x.stroke();
  }
  x.restore();
}

function desenhaPlaca(K, pos, item, cor, usou) {
  const u = K.placa.userData, chave = `${pos}|${item}|${usou}`;
  if (u.chave === chave) return;
  u.chave = chave;
  const x = u.tela.getContext('2d');
  x.clearRect(0, 0, 256, 128);
  // pílula escura com a posição na cor do jogador
  const larg = item ? 236 : 124, x0 = (256 - larg) / 2;
  x.fillStyle = 'rgba(14,16,24,0.82)'; x.strokeStyle = cor; x.lineWidth = 6;
  x.beginPath(); x.roundRect(x0, 14, larg, 100, 50); x.fill(); x.stroke();
  x.font = '900 64px "Segoe UI", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = pos === 1 ? '#ffd84d' : '#ffffff';
  x.fillText(`${pos}º`, x0 + 62, 68);
  if (item) pictograma(x, item, x0 + larg - 60, 64, 40);
  u.textura.needsUpdate = true;
}

function montaCena(c) {
  const { THREE, malha, grupo, pecas, p } = c;
  const mat = { vertexColors: true, roughness: 0.9 };
  const chao = (geo, y = 0) => { const m = malha(geo, 0xffffff, mat); m.castShadow = false; m.receiveShadow = true; m.position.y = y; grupo.add(m); return m; };

  // campo em volta (bem maior que a arena, para a câmera nunca ver o vazio) e grama listrada de campo aparado
  const fora = malha(new THREE.PlaneGeometry(400, 400), 0x3a8f43, { roughness: 1 });
  fora.rotation.x = -Math.PI / 2; fora.position.y = -0.09; fora.castShadow = false; fora.receiveShadow = true; grupo.add(fora);
  const listras = [];
  for (let k = 0, x = -LX; x < LX; k++, x += 2.5) listras.push([x + 1.25, 0, 1.25, LZ, 0, k % 2 ? 0x4fb453 : 0x45a64b]);
  chao(placas(THREE, listras, 0.012));

  // pista: margem de areia nas curvas, zebras dos dois lados, asfalto, faixas brancas e linha de chegada
  const naCurva = i => Math.abs(PISTA[i].curva) > 0.07;
  const lado = (i, s) => (s * PISTA[i].curva < 0 ? 1 : 0);          // 1 = lado de fora da curva
  chao(fita(THREE, i => -HALF - (naCurva(i) && lado(i, -1) ? 2.2 : 0.9), i => HALF + (naCurva(i) && lado(i, 1) ? 2.2 : 0.9), 0.02, () => 0xd9c38a));
  chao(fita(THREE, -HALF - 0.75, HALF + 0.75, 0.03, i => (Math.floor(i / 3) % 2 ? 0xf4f4f4 : 0xe0303a)));
  chao(fita(THREE, -HALF, HALF, 0.04, i => (Math.floor(i / 2) % 2 ? 0x4a4f5c : 0x474c58)));
  chao(fita(THREE, -HALF + 0.12, -HALF + 0.3, 0.05, () => 0xe8ebf2));
  chao(fita(THREE, HALF - 0.3, HALF - 0.12, 0.05, () => 0xe8ebf2));
  // quadriculado da largada e marcas do grid
  const L = pontoPista(0), angL = Math.atan2(L.tz, L.tx), quad = [];
  const casa = (HALF * 2) / 10;
  for (let a = 0; a < 10; a++) for (let b = 0; b < 3; b++) {
    const lat = -HALF + (a + 0.5) * casa, av = (b - 1) * casa;
    quad.push([L.x + L.tx * av - L.tz * lat, L.z + L.tz * av + L.tx * lat, casa / 2, casa / 2, angL, (a + b) % 2 ? 0x111111 : 0xffffff]);
  }
  for (const lat of [-1.6, 1.6]) {
    const q = pontoPista(-0.018, lat), ang = Math.atan2(q.tz, q.tx);
    quad.push([q.x + q.tx * 1.5, q.z + q.tz * 1.5, 0.1, 1.1, ang, 0xffffff]);
  }
  // setas brancas pintadas no asfalto antes das curvas fortes, apontando para dentro da curva: mostram o caminho
  const barra = (x1, z1, x2, z2) => quad.push([(x1 + x2) / 2, (z1 + z2) / 2, Math.hypot(x2 - x1, z2 - z1) / 2 + 0.1, 0.14, Math.atan2(z2 - z1, x2 - x1), 0xffffff]);
  for (let i = 0; i < N; i += 4) {
    const q = PISTA[i], frente = PISTA[(i + 14) % N];
    if (Math.abs(frente.curva) < 0.12 || Math.abs(PISTA[(i + N - 8) % N].curva) > 0.06) continue;
    const s = Math.sign(frente.curva);                       // 1 = curva para a direita
    const mundo = (u, w) => [q.x + q.tx * u - q.tz * w, q.z + q.tz * u + q.tx * w];
    for (const w0 of [-1.3, 0.2]) {
      const ponta = mundo(0, w0 + s * 0.55), a1 = mundo(-0.65, w0 - s * 0.2), a2 = mundo(0.65, w0 - s * 0.2);
      barra(a1[0], a1[1], ponta[0], ponta[1]); barra(a2[0], a2[1], ponta[0], ponta[1]);
    }
  }
  chao(placas(THREE, quad, 0.06));

  // semáforo da largada: painel baixo ao lado da pista, do lado de cima da tela (não tapa nada)
  const sem = new THREE.Group(), qs = pontoPista(0.004, -(HALF + 2.0));
  sem.position.set(qs.x, 0, qs.z); sem.rotation.y = -angL;
  const poste = malha(new THREE.BoxGeometry(0.2, 1.1, 0.2), 0x2a2f3d); poste.position.y = 0.55; sem.add(poste);
  const painel = malha(new THREE.BoxGeometry(2.6, 0.9, 0.35), 0x1b1f2b); painel.position.y = 1.4; sem.add(painel);
  pecas.luzes = [-0.8, 0, 0.8].map(x => {
    const m = malha(new THREE.SphereGeometry(0.3, 14, 10), 0x441111, { emissive: 0x000000 }); m.position.set(x, 1.45, 0.2); m.castShadow = false; sem.add(m); return m;
  });
  grupo.add(sem);

  // enfeites baixos, longe da pista: árvores redondas, arbustos e pilhas de pneus (posições fixas, sem sorteio)
  let semente = 11, n = 0;
  const sorteio = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  const coloca = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const tipo = sorteio();
    if (tipo < 0.55) {
      const alt = 0.9 + sorteio() * 0.6;
      const tronco = malha(new THREE.CylinderGeometry(0.16, 0.22, alt, 7), 0x7a5230); tronco.position.y = alt / 2;
      const copa = malha(new THREE.IcosahedronGeometry(0.85 + sorteio() * 0.35, 0), sorteio() < 0.5 ? 0x2f8a3c : 0x3aa04a, { roughness: 0.9, flatShading: true });
      copa.position.y = alt + 0.5; g.add(tronco, copa);
    } else if (tipo < 0.8) {
      for (let b = 0; b < 3; b++) {
        const m = malha(new THREE.IcosahedronGeometry(0.45 + sorteio() * 0.25, 0), 0x2e7d36, { flatShading: true });
        m.position.set((sorteio() - 0.5) * 1.2, 0.35, (sorteio() - 0.5) * 1.2); g.add(m);
      }
      const flor = malha(new THREE.SphereGeometry(0.16, 8, 6), sorteio() < 0.5 ? 0xffd84d : 0xff6fa8); flor.position.set(0.2, 0.8, 0.1); g.add(flor);
    } else {
      for (let b = 0; b < 3; b++) {
        const pneu = malha(new THREE.TorusGeometry(0.42, 0.18, 8, 16), b % 2 ? 0xe0303a : 0x1b1f2b); pneu.rotation.x = Math.PI / 2; pneu.position.y = 0.18 + b * 0.34; g.add(pneu);
      }
    }
    grupo.add(g); n++;
  };
  for (let tentativa = 0; tentativa < 900 && n < 70; tentativa++) {
    const x = (sorteio() * 2 - 1) * (LX + 14), z = (sorteio() * 2 - 1) * (LZ + 10);
    if (projeta(x, z).d < HALF + 3.8) continue;
    if (Math.abs(x) > LX - 1 && Math.abs(x) < LX + 1.5) continue;         // nem em cima do muro da arena
    if (Math.abs(z) > LZ - 1 && Math.abs(z) < LZ + 1.5) continue;
    coloca(x, z);
  }

  // peças vivas
  pecas.visto = 0; pecas.acum = [0, 0, 0, 0, 0, 0, 0, 0];
  pecas.karts = [0, 1].map(i => fazKart(c, i));
  // cápsulas de item: cristal girando sobre um anel no chão
  pecas.caixas = p.dados.caixas.map((cx, n) => {
    const g = new THREE.Group(); g.position.set(cx.x, 0, cx.z);
    const cristal = malha(new THREE.OctahedronGeometry(0.55, 0), 0x7df9ff, { emissive: 0x1aa6c8, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
    cristal.scale.set(1, 1.3, 1); cristal.position.y = 1.3; cristal.castShadow = false;
    const miolo = malha(new THREE.OctahedronGeometry(0.24, 0), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }); miolo.position.y = 1.3; miolo.castShadow = false;
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.7, depthWrite: false }));
    aro.rotation.x = -Math.PI / 2; aro.position.y = 0.07;
    g.add(cristal, miolo, aro); grupo.add(g);
    return { g, cristal, miolo, aro, fase: n * 0.7, volta: 1 };
  });
  // poeira, marcas de pneu e linhas de vento
  const bola = new THREE.SphereGeometry(0.35, 8, 6);
  pecas.poeira = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(bola, new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; grupo.add(m); return { m, idade: 99, vida: 1 };
  });
  const risco = new THREE.PlaneGeometry(0.5, 0.26);
  pecas.marcas = Array.from({ length: 160 }, () => {
    const m = new THREE.Mesh(risco, new THREE.MeshBasicMaterial({ color: 0x15171c, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.order = 'YXZ'; m.visible = false; grupo.add(m); return { m, idade: 99 };
  });
  pecas.marcaN = 0;
  const linha = new THREE.BoxGeometry(2.2, 0.05, 0.05);
  pecas.vento = Array.from({ length: 30 }, () => {
    const m = new THREE.Mesh(linha, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; grupo.add(m); return { m, idade: 99 };
  });
  pecas.ventoN = 0; pecas.poeiraN = 0;
}

const VIDA_MARCA = 2.6, VIDA_VENTO = 0.28;

function desenhaCena(c, dt, t) {
  const { THREE, pecas, p } = c, d = p.dados;
  // semáforo: acende um vermelho por segundo na contagem e fica verde na largada
  const resta = p.fase === 'intro' ? tempoIntro(p) : 0, acesas = p.fase === 'intro' ? Math.max(0, Math.min(3, Math.floor(3.5 - resta + 0.5))) : 0;
  pecas.luzes.forEach((m, k) => {
    const verde = p.fase !== 'intro', liga = verde || k < acesas;
    m.material.color.set(verde ? 0x3dff7a : liga ? 0xff3030 : 0x441111);
    m.material.emissive.set(verde ? 0x22cc55 : liga ? 0xff1a1a : 0x000000);
  });

  p.jogadores.forEach((j, i) => {
    const k = d.k[i], K = pecas.karts[i], v = Math.hypot(k.vx, k.vz), cor = c.cores[i];
    const giroVis = k.spinT > 0 ? (1 - k.spinT / T_RODA) * Math.PI * 4 : 0;
    const ang = k.ang + giroVis - k.drift * 0.38 + Math.sin(t * 40) * k.tranco * 0.15;
    K.g.position.set(j.x, 0, j.z);
    K.g.rotation.y = -ang;
    K.corpo.rotation.x = k.drift * 0.08;
    K.corpo.position.y = (k.spinT > 0 ? Math.sin((1 - k.spinT / T_RODA) * Math.PI) * 0.9 : 0) + (v > 1 ? Math.sin(t * 30 + i) * 0.02 : 0);
    K.g.visible = !(d.imune[i] > 0 && k.spinT <= 0 && Math.floor(t * 14) % 2 === 0);
    const turbo = k.turboT > 0, corTurbo = k.turboNivel === 2 ? 0xff8a1f : 0x44b4ff;
    for (const m of K.chamas) {
      m.visible = turbo;
      if (turbo) { m.scale.set(1, 0.8 + Math.random() * 0.6, 1); m.material.color.set(corTurbo); m.material.emissive.set(corTurbo); }
    }
    const corFaisca = k.nivel === 2 ? 0xff8a1f : k.nivel === 1 ? 0x44b4ff : 0xfff2b0;
    for (const m of K.brasas) { m.visible = !!k.drift; m.material.color.set(corFaisca); m.scale.setScalar(0.7 + Math.random() * 0.5 + k.nivel * 0.3); }
    K.bolha.visible = d.escudo[i] > 0 && (d.escudo[i] > 3 || Math.floor(t * 10) % 2 === 0);
    K.bolha.material.opacity = 0.22 + Math.sin(t * 6) * 0.06;
    K.anel.material.opacity = 0.55 + Math.sin(t * 5 + i * 2) * 0.2;
    if (K.placa) {
      desenhaPlaca(K, d.pos[i], d.item[i], css(cor), 0);
      K.placa.position.y = 3.0 + (d.usou[i] > 0 ? Math.sin(d.usou[i] * 20) * 0.2 : 0);
    }

    // o boneco do jogador senta no kart (a tela o põe no chão a cada quadro; aqui ele vai para o banco)
    const b = c.bonecos[i], co = Math.cos(ang), si = Math.sin(ang);
    b.visible = K.g.visible;
    b.scale.setScalar(0.6);
    b.position.set(j.x - co * 0.3, K.corpo.position.y + 0.95 + RAIO * 0.6, j.z - si * 0.3);
    b.rotation.set(0, Math.PI / 2 - ang, 0);

    // pontos do kart no mundo (a = para a frente, l = para o lado direito)
    const ponto = (a, l) => [j.x + co * a - si * l, j.z + si * a + co * l];
    // faíscas da derrapagem
    if (k.drift && (pecas.acum[i] -= dt) <= 0) {
      pecas.acum[i] = 0.06;
      for (const l of [-0.95, 0.95]) { const [x, z] = ponto(-1.0, l); c.particulas(x, 0.25, z, corFaisca, k.nivel ? 2 : 1, k.nivel ? 5 : 3); }
    }
    if (turbo && (pecas.acum[2 + i] -= dt) <= 0) { pecas.acum[2 + i] = 0.07; const [x, z] = ponto(-2.1, 0); c.particulas(x, 0.5, z, corTurbo, 2, 5); }
    // marcas de pneu na derrapagem e na rodada
    if ((k.drift || k.spinT > 0) && v > 3 && (pecas.acum[4 + i] -= dt) <= 0) {
      pecas.acum[4 + i] = 0.03;
      for (const l of [-0.9, 0.9]) {
        const mk = pecas.marcas[pecas.marcaN++ % pecas.marcas.length], [x, z] = ponto(-0.85, l);
        mk.idade = 0; mk.m.position.set(x, 0.07, z); mk.m.rotation.y = -Math.atan2(k.vz, k.vx);
      }
    }
    // poeira: cinza no asfalto em velocidade, marrom e farta na grama
    const naGrama = !d.naPista[i];
    if (v > 2 && (naGrama || k.drift) && (pecas.acum[6 + i] -= dt) <= 0) {
      pecas.acum[6 + i] = 0.05;
      const pz = pecas.poeira[pecas.poeiraN++ % pecas.poeira.length], [x, z] = ponto(-1.3, (Math.random() - 0.5) * 1.6);
      pz.idade = 0; pz.vida = naGrama ? 0.9 : 0.6; pz.m.position.set(x, 0.3, z);
      pz.m.material.color.set(naGrama ? 0xa8814a : k.drift ? 0xf4f4f4 : 0xcfd3dc);
    }
    // linhas de vento perto do kart quando ele vai rápido
    if ((v > V_MAX * 0.8 || turbo) && Math.random() < dt * (turbo ? 40 : 18)) {
      const ln = pecas.vento[pecas.ventoN++ % pecas.vento.length], lat = (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 1.2);
      const [x, z] = ponto(1.5 + Math.random() * 2, lat);
      ln.idade = 0; ln.m.position.set(x, 0.5 + Math.random() * 1.6, z); ln.m.rotation.y = -Math.atan2(k.vz, k.vx);
    }
  });

  for (const pz of pecas.poeira) {
    pz.idade += dt; pz.m.visible = pz.idade < pz.vida;
    if (pz.m.visible) { const f = pz.idade / pz.vida; pz.m.scale.setScalar(0.5 + f * 1.6); pz.m.position.y += dt * 0.7; pz.m.material.opacity = 0.4 * (1 - f); }
  }
  for (const mk of pecas.marcas) {
    mk.idade += dt; mk.m.visible = mk.idade < VIDA_MARCA;
    if (mk.m.visible) mk.m.material.opacity = 0.55 * (1 - mk.idade / VIDA_MARCA);
  }
  for (const ln of pecas.vento) {
    ln.idade += dt; ln.m.visible = ln.idade < VIDA_VENTO;
    if (ln.m.visible) { const f = ln.idade / VIDA_VENTO; ln.m.material.opacity = 0.75 * (1 - f); ln.m.scale.set(1 + f, 1, 1); }
  }

  pecas.caixas.forEach((K, n) => {
    const cx = d.caixas[n], ativa = cx.t <= 0, cresce = ativa ? Math.min(1, (K.volta += dt * 3)) : (K.volta = 0);
    K.cristal.visible = K.miolo.visible = ativa;
    K.aro.material.opacity = ativa ? 0.7 : 0.18;
    K.cristal.rotation.y = t * 1.8 + K.fase; K.miolo.rotation.y = -t * 3;
    const y = 0.95 + Math.sin(t * 3 + K.fase) * 0.12;
    K.cristal.position.y = K.miolo.position.y = y;
    K.cristal.scale.set(cresce, cresce * 1.3, cresce);
    K.cristal.material.emissive.setHSL((t * 0.25 + K.fase * 0.1) % 1, 0.8, 0.35);
  });

  const pocas = c.pool('pocas', d.pocas.length, () => {
    const g = new THREE.Group();
    for (const [dx, dz, r] of [[0, 0, 0.9], [0.6, 0.35, 0.5], [-0.55, -0.4, 0.55], [0.1, -0.7, 0.4]]) {
      const m = c.malha(new THREE.CylinderGeometry(R_POCA * r, R_POCA * r, 0.03, 18), 0x1a1033, { roughness: 0.05, metalness: 0.8, emissive: 0x4a2a9a, emissiveIntensity: 0.6 });
      m.position.set(dx, 0, dz); m.castShadow = false; g.add(m);
    }
    return g;
  });
  d.pocas.forEach((o, n) => { pocas[n].position.set(o.x, 0.08, o.z); pocas[n].rotation.y = t * 0.3; });

  const misseis = c.pool('misseis', d.misseis.length, () => {
    const g = new THREE.Group();
    const corpo = c.malha(new THREE.CylinderGeometry(0.26, 0.26, 1.4, 12), 0xe9edf7); corpo.rotation.z = Math.PI / 2;
    const ponta = c.malha(new THREE.ConeGeometry(0.28, 0.6, 12), 0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 0.7 }); ponta.rotation.z = -Math.PI / 2; ponta.position.x = 1.0;
    for (const s of [-1, 1]) { const asa = c.malha(new THREE.BoxGeometry(0.4, 0.06, 0.5), 0xff3b3b); asa.position.set(-0.55, 0, s * 0.3); g.add(asa); }
    g.add(corpo, ponta); return g;
  });
  d.misseis.forEach((m, n) => {
    misseis[n].position.set(m.x, 0.9, m.z); misseis[n].rotation.y = -m.ang;
    c.particulas(m.x - Math.cos(m.ang) * 1, 0.9, m.z - Math.sin(m.ang) * 1, Math.random() < 0.5 ? 0xff9a3c : 0xffffff, 1, 2);
  });

  // ímã: raio roxo ligando os karts enquanto puxa
  const puxando = d.k.filter(k => k.puxaT > 0).length;
  const raios = c.pool('raios', puxando ? 1 : 0, () => {
    const m = c.malha(new THREE.BoxGeometry(1, 0.14, 0.14), 0xe04fd0, { emissive: 0xe04fd0, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }); m.castShadow = false; return m;
  });
  if (puxando) {
    const [a, b] = p.jogadores, len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    raios[0].position.set((a.x + b.x) / 2, 1.1, (a.z + b.z) / 2); raios[0].scale.set(len, 1 + Math.sin(t * 40) * 0.5, 1);
    raios[0].rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  }

  for (; pecas.visto < d.fxBase + d.fx.length; pecas.visto++) {
    const e = d.fx[pecas.visto - d.fxBase];
    if (!e) continue;
    const cor = c.cores[e.cor] ?? 0xffffff;
    if (e.tipo === 'rodou') { c.particulas(e.x, 0.8, e.z, 0x8a5cff, 22, 8); c.particulas(e.x, 0.5, e.z, 0x222222, 10, 5); }
    else if (e.tipo === 'explosao') { c.particulas(e.x, 0.9, e.z, 0xff7a2f, 36, 11); c.particulas(e.x, 0.9, e.z, 0xffd84d, 18, 8); }
    else if (e.tipo === 'pega') c.particulas(e.x, 1, e.z, 0x7df9ff, 9, 5);
    else if (e.tipo === 'escudo') c.particulas(e.x, 1, e.z, 0x66ccff, 18, 7);
    else if (e.tipo === 'ima') c.particulas(e.x, 1, e.z, 0xe04fd0, 16, 6);
    else if (e.tipo === 'turbo' || e.tipo === 'turbo2') c.particulas(e.x, 0.5, e.z, e.tipo === 'turbo2' ? 0xff8a1f : 0x44b4ff, 12, 7);
    else if (e.tipo === 'volta') { c.particulas(e.x, 1, e.z, cor, 26, 9); c.particulas(e.x, 1, e.z, 0xffffff, 12, 7); }
    else if (e.tipo === 'batida') c.particulas(e.x, 0.7, e.z, 0xffe9a0, 14, 7);
    else if (e.tipo === 'poof') c.particulas(e.x, 0.8, e.z, 0xcccccc, 10, 4);
    else c.particulas(e.x, 0.8, e.z, cor, 8, 4);
  }
}
