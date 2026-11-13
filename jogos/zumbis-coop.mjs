// Noite dos Zumbis (Festa, cooperativo de 2 a 4 jogadores): uma vila com a casa segura no meio do quintal, zumbis lentos vindo das bordas em ondas.
// Todos andam com o joystick. A = USAR (reviver, tapar porta ou janela com tábua, usar a lanterna), B = CORRER.
// Pegue tábuas, lanternas e moedas e se abrigue na casa. Zumbi que encosta derruba o jogador, e um parceiro revive segurando A por 1,5 s
// (ou com o kit médico, na hora). Cooperativo: atualiza devolve 2 (todos vencem) se sobrar pelo menos um em pé aos 45 s, e -1 quando todos caem.
import { posicionaRoda, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 7.5;                 // meia largura e meia profundidade da arena
export const HX = 3.6, HZ = 2.4, ESP = 0.25;    // meia casa (x e z) e meia espessura das paredes
const GAP = 1.1;                                // meia largura de cada porta ou janela
export const TEMPO = 45, MAX_ZUMBIS = 20;
const ZR = 0.55, CONTATO = ZR + RAIO - 0.3;     // raio do zumbi e distância em que ele derruba
const V_ANDA = 7.5, V_CORRE = 11.5, CORRE_T = 1.1, CORRE_CD = 3;
const T_REVIVE = 1.5, R_REVIVE = 2.3, R_TAPAR = 2.9, T_IMUNE = 2.2;
const HP_TABUA = 8, DANO_TABUA = 1;             // um zumbi leva 8 s para quebrar; vários, bem menos
const R_LANTERNA = 6, T_ATORDOA = 4;
const INTERVALO = 9, PRIMEIRA = 3.5, ONDAS = [2, 3, 3, 4, 4, 5];       // para 2 jogadores; com mais gente cada onda cresce
const T_ITEM = 3.2, MAX_ITENS = 5, VIDA_ITEM = 16, R_PEGA = RAIO + 0.55;
const PELE = 0xb8ad94;       // pele de zumbi: cinza amarelado, longe de todas as cores de jogador
const PTS = { moeda: 10, tabua: 5, lanterna: 5, kit: 5, reviver: 25, onda: 20 };
const MAX_INV = { tabua: 2, lanterna: 1, kit: 1 };

const ALTURA = 0.8;       // paredes e caixas baixas: nada alto entre a camera e os jogadores
const caixa = (x, z, h) => ({ x0: x - h, x1: x + h, z0: z - h, z1: z + h });
const T = ESP;
// Paredes da casa, já com os vãos das portas e da janela.
export const PAREDES = [
  { x0: -HX - T, x1: -1.4 - GAP, z0: -HZ - T, z1: -HZ + T },
  { x0: -1.4 + GAP, x1: HX + T, z0: -HZ - T, z1: -HZ + T },
  { x0: -HX - T, x1: 1.4 - GAP, z0: HZ - T, z1: HZ + T },
  { x0: 1.4 + GAP, x1: HX + T, z0: HZ - T, z1: HZ + T },
  { x0: HX - T, x1: HX + T, z0: -HZ + T, z1: HZ - T },
  { x0: -HX - T, x1: -HX + T, z0: -HZ + T, z1: -GAP },
  { x0: -HX - T, x1: -HX + T, z0: GAP, z1: HZ - T },
];
// Entradas: onde a tábua pode ser pregada. "fora" e "dentro" são os pontos de passagem dos zumbis.
export const ENTRADAS = [
  { nome: 'porta norte', x: -1.4, z: -HZ, caixa: { x0: -1.4 - GAP - 0.05, x1: -1.4 + GAP + 0.05, z0: -HZ - 0.2, z1: -HZ + 0.2 }, fora: { x: -1.4, z: -HZ - 1.7 }, dentro: { x: -1.4, z: -HZ + 1.7 } },
  { nome: 'porta sul', x: 1.4, z: HZ, caixa: { x0: 1.4 - GAP - 0.05, x1: 1.4 + GAP + 0.05, z0: HZ - 0.2, z1: HZ + 0.2 }, fora: { x: 1.4, z: HZ + 1.7 }, dentro: { x: 1.4, z: HZ - 1.7 } },
  { nome: 'janela oeste', x: -HX, z: 0, caixa: { x0: -HX - 0.2, x1: -HX + 0.2, z0: -GAP - 0.05, z1: GAP + 0.05 }, fora: { x: -HX - 1.7, z: 0 }, dentro: { x: -HX + 1.7, z: 0 } },
];
// Caixas do quintal e o poste de luz (bloqueiam todo mundo).
export const CAIXAS = [caixa(-7, -3.8, 0.75), caixa(7, -4.2, 0.75), caixa(-7.4, 3.4, 0.75), caixa(7.2, 3.8, 0.75), caixa(-1.8, -5.4, 0.75), caixa(2.2, 5.4, 0.75)];
export const POSTE = { x: -5.6, z: 5.4 };
const FIXOS = [...PAREDES, ...CAIXAS, caixa(POSTE.x, POSTE.z, 0.35)];
const CANTOS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: a * (HX + 1.5), z: b * (HZ + 1.5) }));

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const SEP2 = (ZR * 1.6) * (ZR * 1.6), CONTATO2 = CONTATO * CONTATO;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dentroDeCasa = a => Math.abs(a.x) < HX - 0.3 && Math.abs(a.z) < HZ - 0.3;
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

// Empurra o círculo (a, raio r) para fora da caixa b. Devolve true se empurrou (a normal fica em NX, NZ).
let NX = 0, NZ = 0;
function empurra(a, r, b) {
  if (a.x < b.x0 - r || a.x > b.x1 + r || a.z < b.z0 - r || a.z > b.z1 + r) return false;     // longe: sem conta
  const px = limita(a.x, b.x0, b.x1), pz = limita(a.z, b.z0, b.z1);
  const dx = a.x - px, dz = a.z - pz, d = Math.sqrt(dx * dx + dz * dz);
  if (d >= r) return false;
  if (d > 1e-6) { a.x = px + dx / d * r; a.z = pz + dz / d * r; NX = dx / d; NZ = dz / d; return true; }
  const ex = Math.min(a.x - b.x0, b.x1 - a.x), ez = Math.min(a.z - b.z0, b.z1 - a.z);
  if (ex < ez) { const s = a.x - b.x0 < b.x1 - a.x ? -1 : 1; a.x = s < 0 ? b.x0 - r : b.x1 + r; NX = s; NZ = 0; return true; }
  const s = a.z - b.z0 < b.z1 - a.z ? -1 : 1; a.z = s < 0 ? b.z0 - r : b.z1 + r; NX = 0; NZ = s; return true;
}

// O segmento a-b atravessa a caixa (inflada de m)?
function corta(ax, az, bx, bz, b, m) {
  let t0 = 0, t1 = 1;
  const vx = bx - ax, vz = bz - az;
  if (Math.abs(vx) < 1e-9) { if (ax < b.x0 - m || ax > b.x1 + m) return false; }
  else {
    let s = (b.x0 - m - ax) / vx, e = (b.x1 + m - ax) / vx;
    if (s > e) { const k = s; s = e; e = k; }
    t0 = Math.max(t0, s); t1 = Math.min(t1, e);
    if (t0 > t1) return false;
  }
  if (Math.abs(vz) < 1e-9) return !(az < b.z0 - m || az > b.z1 + m);
  let s = (b.z0 - m - az) / vz, e = (b.z1 + m - az) / vz;
  if (s > e) { const k = s; s = e; e = k; }
  return Math.max(t0, s) <= Math.min(t1, e);
}
const paredeNoCaminho = (a, b) => PAREDES.some(w => corta(a.x, a.z, b.x, b.z, w, 0.35));

// Para onde o zumbi deve ir agora: direto no alvo, contornando a casa ou entrando por uma porta ou janela.
function contorna(z, pt) {
  if (dentroDeCasa(z) || dentroDeCasa(pt) || !paredeNoCaminho(z, pt)) return pt;
  let melhor = pt, custo = Infinity;
  for (const c of CANTOS) {
    if (paredeNoCaminho(z, c)) continue;
    const v = dist(z, c) + dist(c, pt) + (paredeNoCaminho(c, pt) ? 15 : 0);
    if (v < custo) { custo = v; melhor = c; }
  }
  return melhor;
}
export function rumo(d, z, alvo) {
  const zDentro = dentroDeCasa(z), aDentro = dentroDeCasa(alvo);
  if (zDentro === aDentro) return contorna(z, alvo);
  let melhor = null, custo = Infinity;
  ENTRADAS.forEach((e, k) => {
    const perto = zDentro ? e.dentro : e.fora, longe = zDentro ? e.fora : e.dentro;
    const c = dist(z, perto) + dist(longe, alvo) + (d.tabua[k] > 0 ? 9 : 0);
    if (c < custo) { custo = c; melhor = { perto, longe, e }; }
  });
  // na boca da entrada (ou no ponto de passagem) segue em frente, sem voltar atras
  return dist(z, melhor.perto) < 0.5 || dist(z, melhor.e) < 1.6 ? melhor.longe : contorna(z, melhor.perto);
}

function sorteiaPonto(p, folga) {
  for (let n = 0; n < 25; n++) {
    const a = { x: (p.rng() * 2 - 1) * (LX - 1.2), z: (p.rng() * 2 - 1) * (LZ - 1.2) };
    if (!FIXOS.some(b => a.x > b.x0 - folga && a.x < b.x1 + folga && a.z > b.z0 - folga && a.z < b.z1 + folga)) return a;
  }
  return { x: 0, z: 0 };
}

function novoZumbi(p, d) {
  let x = 0, z = 0, melhor = -1;
  for (let n = 0; n < 8; n++) {                  // nasce numa borda, o mais longe possível de quem está em pé
    let cx, cz;
    if (p.rng() < LX / (LX + LZ)) { cx = (p.rng() < 0.5 ? -1 : 1) * (LX - ZR - 0.2); cz = (p.rng() * 2 - 1) * (LZ - 1); }
    else { cz = (p.rng() < 0.5 ? -1 : 1) * (LZ - ZR - 0.2); cx = (p.rng() * 2 - 1) * (LX - 1); }
    let perto = Infinity;
    p.jogadores.forEach((j, i) => { if (!d.caido[i]) perto = Math.min(perto, Math.hypot(j.x - cx, j.z - cz)); });
    if (perto > melhor) { melhor = perto; x = cx; z = cz; }
    if (melhor > 7) break;
  }
  const v = 1.3 + 0.18 * d.onda + p.rng() * 0.4;     // sempre bem mais devagar que o jogador
  return { x, z, kx: 0, kz: 0, ang: Math.atan2(-z, -x), v, atord: 0, pausa: 1, re: p.rng() * 0.4, wp: null, fase: p.rng() * 6.28, alvo: 0 };
}

function aviso(d, texto, cor = '#ffffff', t = 1.8) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

function atordoaPerto(d, x, z, raio, tempo, forca) {
  for (const zb of d.zumbis) {
    const dx = zb.x - x, dz = zb.z - z, m = Math.hypot(dx, dz);
    if (m > raio) continue;
    zb.atord = Math.max(zb.atord, tempo);
    const n = m || 1; zb.kx = dx / n * forca; zb.kz = dz / n * forca;
  }
}

// O parceiro caido mais perto que da para socorrer (ou -1).
function caidoPerto(p, d, i) {
  const j = p.jogadores[i];
  let achado = -1, melhor = R_REVIVE;
  p.jogadores.forEach((q, k) => {
    const m = Math.hypot(q.x - j.x, q.z - j.z);
    if (k !== i && d.caido[k] && m < melhor) { melhor = m; achado = k; }
  });
  return achado;
}

function reviver(p, d, i) {
  d.caido[i] = false; d.rev[i] = 0; d.imune[i] = T_IMUNE;
  d.pontos += PTS.reviver;
  atordoaPerto(d, p.jogadores[i].x, p.jogadores[i].z, 3.2, 1.6, 7);
  d.fx.push({ tipo: 'reviveu', x: p.jogadores[i].x, z: p.jogadores[i].z, i });
  p.eventos.push('troca');
  aviso(d, 'DE VOLTA!', '#6bff9a', 1.4);
}

function cai(p, d, i) {
  const j = p.jogadores[i];
  d.caido[i] = true; d.rev[i] = 0; d.pos[i] = { x: j.x, z: j.z }; j.vx = j.vz = 0;
  vibra(p, i); p.eventos.push('queda');
  d.fx.push({ tipo: 'caiu', x: j.x, z: j.z, i });
  aviso(d, 'CAIU! SEGURE A PERTO DELE', '#ff4a4a', 2.2);
}

// Passo de um zumbi: segue o rumo, recebe empurrão, contorna caixas e nunca sai da arena.
function andaZumbi(d, z, dt, alvo) {
  z.re -= dt; z.atord -= dt; z.pausa -= dt;
  z.x += z.kx * dt; z.z += z.kz * dt;
  const f = Math.pow(0.02, dt); z.kx *= f; z.kz *= f;
  let bateu = false;
  if (alvo && z.atord <= 0 && z.pausa <= 0) {
    if (z.re <= 0 || !z.wp) { z.wp = rumo(d, z, alvo); z.re = 0.35 + (z.fase % 0.2); }
    let dx = z.wp.x - z.x, dz = z.wp.z - z.z;
    const m = Math.sqrt(dx * dx + dz * dz);
    if (m < 0.35 && z.wp !== alvo) { z.re = 0; }
    if (m > 1e-6) {
      dx /= m; dz /= m;
      const alvoAng = Math.atan2(dz, dx);
      let da = alvoAng - z.ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      z.ang += limita(da, -5 * dt, 5 * dt);
      const v = z.v * (0.7 + 0.3 * Math.max(0, Math.cos(da)));      // vira devagar e anda enquanto vira
      z.x += Math.cos(z.ang) * v * dt; z.z += Math.sin(z.ang) * v * dt;
    }
  }
  let nx = 0, nz = 0;
  for (const b of FIXOS) if (empurra(z, ZR, b)) { bateu = true; nx = NX; nz = NZ; }
  for (let k = 0; k < 3; k++) if (d.tabua[k] > 0) if (empurra(z, ZR, ENTRADAS[k].caixa)) { bateu = true; nx = NX; nz = NZ; }
  if (bateu && alvo && z.atord <= 0 && z.pausa <= 0) {          // escorrega na lateral em vez de ficar travado de frente
    const s = z.fase > 3 ? 1 : -1;
    z.x += -nz * s * z.v * dt * 0.8; z.z += nx * s * z.v * dt * 0.8;
    for (const b of FIXOS) empurra(z, ZR, b);
  }
  z.x = limita(z.x, -LX + ZR, LX - ZR); z.z = limita(z.z, -LZ + ZR, LZ - ZR);
}

export default {
  id: 'zumbis-coop', nome: 'Noite dos Zumbis',
  dica: 'Fujam dos zumbis, peguem tábuas, lanternas e moedas e se abriguem na casa. Aguentem 45 segundos!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'USAR', b: 'CORRER' }, semMovimento: false, semDash: true, semPulo: true,
  rotulo: 'pontos da equipe', duracao: TEMPO,

  // camera mais alta e mais fechada: a casa e os quatro cantos cabem e nenhuma parede esconde ninguem
  camera: () => ({ x: 0, y: 20, z: 10.5, ox: 0, oy: 0, oz: 0.3 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaRoda(p, 5.2);
    const cada = f => p.jogadores.map((_, i) => f(i));       // um valor por jogador
    p.dados = {
      placar: [0], pontos: 0, onda: 0, proxOnda: PRIMEIRA, proxItem: 0.6, aviso: '', avisoCor: '#ffffff', avisoT: 0,
      zumbis: [], itens: [], tabua: [0, 0, 0], fx: [], pulsos: [],
      caido: cada(() => false), pos: cada(() => ({ x: 0, z: 0 })), rev: cada(() => 0), imune: cada(() => 0), seg: cada(() => 0),
      corre: cada(() => 0), cdCorre: cada(() => 0), ang: cada(i => i * Math.PI / 2), inv: cada(() => ({ tabua: 0, lanterna: 0, kit: 0 })),
      rotA: cada(() => 'USAR'), texto: cada(() => ''), quebradas: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    const revendo = js.map(() => false);

    // ----- jogadores -----
    js.forEach((j, i) => {
      d.imune[i] = Math.max(0, d.imune[i] - dt); d.seg[i] = Math.max(0, d.seg[i] - dt);
      d.cdCorre[i] -= dt; d.corre[i] = Math.max(0, d.corre[i] - dt);
      if (d.caido[i]) { j.x = d.pos[i].x; j.z = d.pos[i].z; j.vx = j.vz = 0; j.turbo = 1; return; }
      if (j.apertouB > 0 && d.cdCorre[i] <= 0) { d.corre[i] = CORRE_T; d.cdCorre[i] = CORRE_CD; p.eventos.push('dash'); }
      j.turbo = d.corre[i] > 0 ? 1.6 : 1;
      const vmax = d.corre[i] > 0 ? V_CORRE : V_ANDA, v = Math.hypot(j.vx, j.vz);
      if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
      if (j.apertouA > 0) d.seg[i] = 0.25;           // toque curto vale como um instante de "segurar"
      if (Math.hypot(j.ent.x, j.ent.y) > 0.25) d.ang[i] = Math.atan2(j.ent.y, j.ent.x);
      for (const b of FIXOS) empurra(j, RAIO * 0.9, b);
      for (let k = 0; k < 3; k++) if (d.tabua[k] > 0) empurra(j, RAIO * 0.9, ENTRADAS[k].caixa);
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
    });

    // ----- ondas -----
    if (d.onda < ONDAS.length && p.t >= d.proxOnda) {
      if (d.onda > 0) { d.pontos += PTS.onda; }
      d.onda++; d.proxOnda += INTERVALO;
      const n = Math.min(Math.ceil(ONDAS[d.onda - 1] * (0.5 + js.length / 4)), MAX_ZUMBIS - d.zumbis.length);
      for (let k = 0; k < n; k++) d.zumbis.push(novoZumbi(p, d));
      aviso(d, 'ONDA ' + d.onda, '#ffd23f', 1.6);
      p.eventos.push('troca');
    }

    // ----- itens -----
    d.proxItem -= dt;
    if (d.proxItem <= 0) {
      d.proxItem = T_ITEM;
      if (d.itens.length < MAX_ITENS) {
        const algumCaido = d.caido.some(Boolean);
        const temKit = d.itens.some(it => it.tipo === 'kit') || d.inv.some(v => v.kit > 0);
        const r = p.rng();
        const tipo = algumCaido && !temKit ? 'kit' : r < 0.36 ? 'tabua' : r < 0.72 ? 'moeda' : r < 0.87 ? 'lanterna' : 'kit';
        const a = sorteiaPonto(p, 1.1);
        d.itens.push({ tipo, x: a.x, z: a.z, vida: VIDA_ITEM });
      }
    }
    for (const it of d.itens) it.vida -= dt;
    d.itens = d.itens.filter(it => {
      if (it.vida <= 0) return false;
      for (const [i, j] of js.entries()) {
        if (d.caido[i] || Math.hypot(j.x - it.x, j.z - it.z) > R_PEGA) continue;
        if (it.tipo !== 'moeda') {
          if (d.inv[i][it.tipo] >= MAX_INV[it.tipo]) continue;      // mochila cheia: o item fica para o parceiro
          d.inv[i][it.tipo]++;
        }
        d.pontos += PTS[it.tipo];
        d.fx.push({ tipo: 'pegou', x: it.x, z: it.z, item: it.tipo });
        p.eventos.push('moeda');
        return false;
      }
      return true;
    });

    // ----- ação do botão A -----
    js.forEach((j, i) => {
      if (d.caido[i]) return;
      const inv = d.inv[i], o = caidoPerto(p, d, i);
      if (o >= 0) {
        if (inv.kit > 0 && j.apertouA > 0) { inv.kit--; reviver(p, d, o); }
        else if (j.ent.d || d.seg[i] > 0) { revendo[o] = true; d.rev[o] += dt; if (d.rev[o] >= T_REVIVE) reviver(p, d, o); }      // dois socorristas revivem mais rápido
        return;
      }
      if (j.apertouA <= 0) return;
      let alvo = -1, melhor = R_TAPAR;
      ENTRADAS.forEach((e, k) => { const m = Math.hypot(e.x - j.x, e.z - j.z); if (m < melhor && d.tabua[k] < HP_TABUA * 0.99) { melhor = m; alvo = k; } });
      if (alvo >= 0 && inv.tabua > 0) {
        inv.tabua--; d.tabua[alvo] = HP_TABUA;
        d.fx.push({ tipo: 'tapou', x: ENTRADAS[alvo].x, z: ENTRADAS[alvo].z });
        p.eventos.push('batida');
      } else if (inv.lanterna > 0) {
        inv.lanterna--;
        atordoaPerto(d, j.x, j.z, R_LANTERNA, T_ATORDOA, 9);
        d.pulsos.push({ x: j.x, z: j.z, idade: 0 });
        d.fx.push({ tipo: 'luz', x: j.x, z: j.z });
        p.eventos.push('explosao');
      }
    });
    js.forEach((_, i) => { if (d.caido[i] && !revendo[i]) d.rev[i] = Math.max(0, d.rev[i] - dt * 1.5); });
    for (const pu of d.pulsos) pu.idade += dt;
    d.pulsos = d.pulsos.filter(pu => pu.idade < 0.7);

    // ----- zumbis -----
    const zs = d.zumbis;
    for (const z of zs) {
      if (z.re <= 0 || !z.wp) {                     // escolhe o jogador em pé mais perto
        let bi = -1, bm = Infinity;
        js.forEach((j, i) => { if (d.caido[i]) return; const m = Math.hypot(j.x - z.x, j.z - z.z); if (m < bm) { bm = m; bi = i; } });
        z.alvo = bi; z.wp = null;
      }
      const alvo = z.alvo >= 0 && !d.caido[z.alvo] ? js[z.alvo] : null;
      andaZumbi(d, z, dt, alvo);
      if (z.atord <= 0)                              // quebra a tábua que está bloqueando
        for (let k = 0; k < 3; k++) {
          if (d.tabua[k] <= 0) continue;
          const b = ENTRADAS[k].caixa;
          if (Math.hypot(z.x - limita(z.x, b.x0, b.x1), z.z - limita(z.z, b.z0, b.z1)) < ZR + 0.2) {
            d.tabua[k] -= DANO_TABUA * dt;
            if (d.tabua[k] <= 0) { d.tabua[k] = 0; d.quebradas++; d.fx.push({ tipo: 'quebrou', x: ENTRADAS[k].x, z: ENTRADAS[k].z }); p.eventos.push('batida'); }
          }
        }
    }
    for (let a = 0; a < zs.length; a++)             // zumbis não se empilham
      for (let b = a + 1; b < zs.length; b++) {
        const dx = zs[b].x - zs[a].x, dz = zs[b].z - zs[a].z, q = dx * dx + dz * dz;
        if (q >= SEP2) continue;
        const m = Math.sqrt(q);
        const n = m || 1, s = (ZR * 1.6 - m) / 2, ux = m ? dx / n : 1, uz = m ? dz / n : 0;
        zs[a].x -= ux * s; zs[a].z -= uz * s; zs[b].x += ux * s; zs[b].z += uz * s;
      }

    // ----- zumbi encosta no jogador -----
    for (const z of zs) {
      if (z.atord > 0 || z.pausa > 0) continue;
      for (const [i, j] of js.entries()) {
        if (d.caido[i] || (j.x - z.x) * (j.x - z.x) + (j.z - z.z) * (j.z - z.z) > CONTATO2) continue;
        if (d.imune[i] > 0) { z.kx = (z.x - j.x) * 6; z.kz = (z.z - j.z) * 6; continue; }
        cai(p, d, i); z.pausa = 1.2;
      }
    }

    // ----- celulares e placar -----
    d.placar = [d.pontos];       // so os pontos da equipe: a onda aparece no aviso e nao e placar de disputa
    js.forEach((j, i) => {
      const inv = d.inv[i];
      let a = 'USAR';
      if (d.caido[i]) a = '';
      else if (caidoPerto(p, d, i) >= 0) a = inv.kit > 0 ? 'KIT' : 'REVIVER';
      else if (inv.tabua > 0 && ENTRADAS.some(e => Math.hypot(e.x - j.x, e.z - j.z) < R_TAPAR)) a = 'TAPAR';
      else if (inv.lanterna > 0) a = 'LANTERNA';
      const texto = d.caido[i] ? 'Você caiu! Um parceiro revive segurando A.'
        : `Tábuas ${inv.tabua}  Lanterna ${inv.lanterna}  Kit ${inv.kit}`;
      if (a !== d.rotA[i] || texto !== d.texto[i]) {
        d.rotA[i] = a; d.texto[i] = texto;
        p.celular[i] = { ...p.celular[i], a, texto };
      }
    });

    // ----- fim -----
    if (d.caido.every(Boolean)) { aviso(d, 'TODOS CAÍRAM...', '#ff4a4a', 3); return -1; }
    if (p.t >= TEMPO) { aviso(d, 'AMANHECEU! VOCÊS SOBREVIVERAM', '#6bff9a', 3); return 2; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixaGeo = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    pecas.visto = 0;

    // gramado escuro e o piso de madeira dentro da casa
    const grama = malha(caixaGeo(LX * 2, 0.04, LZ * 2), 0x1d3a2b, { roughness: 1 }); grama.position.y = 0.02; grama.castShadow = false; grupo.add(grama);
    const piso = malha(caixaGeo(HX * 2 - 0.2, 0.05, HZ * 2 - 0.2), 0x6b4a2f, { roughness: 0.9 }); piso.position.y = 0.05; piso.castShadow = false; grupo.add(piso);

    // paredes (altas, sem telhado, para ver o que acontece dentro)
    for (const w of PAREDES) {
      const m = malha(caixaGeo(w.x1 - w.x0, ALTURA, w.z1 - w.z0), 0xb9a98c, { roughness: 0.8 });
      m.position.set((w.x0 + w.x1) / 2, ALTURA / 2, (w.z0 + w.z1) / 2); grupo.add(m);
      const topo = malha(caixaGeo(w.x1 - w.x0 + 0.06, 0.12, w.z1 - w.z0 + 0.06), 0x5a3a2a);
      topo.position.set((w.x0 + w.x1) / 2, ALTURA + 0.05, (w.z0 + w.z1) / 2); topo.castShadow = false; grupo.add(topo);
    }
    // batentes brilhando: porta é laranja, janela é amarelo claro
    pecas.tabuas = ENTRADAS.map((e, k) => {
      const largo = e.caixa.x1 - e.caixa.x0, fundo = e.caixa.z1 - e.caixa.z0;
      const cor = k === 2 ? 0xffe9a0 : 0xe0883a;
      const bat = malha(caixaGeo(largo + 0.1, 0.1, fundo + 0.1), cor, { emissive: cor, emissiveIntensity: 0.7 });
      bat.position.set(e.x, ALTURA + 0.05, e.z); bat.castShadow = false; grupo.add(bat);
      const tab = new THREE.Group(); tab.position.set(e.x, 0, e.z);
      const horiz = largo > fundo;
      for (let n = 0; n < 3; n++) {                // três tábuas cruzando o vão
        const m = malha(horiz ? caixaGeo(largo, 0.28, 0.2) : caixaGeo(0.2, 0.28, fundo), 0x9b6a3a, { roughness: 0.9 });
        m.position.y = 0.2 + n * 0.3; tab.add(m);
      }
      tab.visible = false; grupo.add(tab); return tab;
    });

    // caixas do quintal
    for (const b of CAIXAS) {
      const m = malha(caixaGeo(b.x1 - b.x0, ALTURA, b.z1 - b.z0), 0x8a6238, { roughness: 0.9 });
      m.position.set((b.x0 + b.x1) / 2, ALTURA / 2, (b.z0 + b.z1) / 2); m.rotation.y = (b.x0 * 7) % 0.4; grupo.add(m);
      const cinta = malha(caixaGeo(b.x1 - b.x0 + 0.04, 0.12, b.z1 - b.z0 + 0.04), 0x55391f);
      cinta.position.set((b.x0 + b.x1) / 2, ALTURA * 0.55, (b.z0 + b.z1) / 2); cinta.castShadow = false; grupo.add(cinta);
    }

    // poste de luz com bolha de luz no chão (sem luz de verdade: fica leve)
    const hasteP = malha(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), 0x2a2d36); hasteP.position.set(POSTE.x, 0.8, POSTE.z); grupo.add(hasteP);
    const bulbo = malha(new THREE.SphereGeometry(0.34, 12, 8), 0xfff7d6, { emissive: 0xfff0b0, emissiveIntensity: 1.4 });
    bulbo.position.set(POSTE.x, 1.7, POSTE.z); bulbo.castShadow = false; grupo.add(bulbo);
    const poca = malha(new THREE.CylinderGeometry(3.6, 3.6, 0.03, 32), 0xffe08a, { emissive: 0xffe08a, emissiveIntensity: 0.5, transparent: true, opacity: 0.16 });
    poca.position.set(POSTE.x, 0.07, POSTE.z); poca.castShadow = false; grupo.add(poca);

    // lua e estrelas ao fundo
    const lua = malha(new THREE.SphereGeometry(2.2, 20, 14), 0xf4f1d8, { emissive: 0xe8e4b8, emissiveIntensity: 1 });
    lua.position.set(-8, 15, -LZ - 11); lua.castShadow = false; grupo.add(lua);
    const aura = malha(new THREE.SphereGeometry(3.4, 16, 10), 0xcfd8ff, { emissive: 0xcfd8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.12 });
    aura.position.copy(lua.position); aura.castShadow = false; grupo.add(aura);
    const estrelaGeo = new THREE.SphereGeometry(0.08, 6, 4);
    for (let n = 0; n < 24; n++) {
      const e = malha(estrelaGeo, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
      e.position.set(-18 + (n * 37 % 36), 5 + (n * 53 % 17), -LZ - 12 - (n % 3)); e.castShadow = false; grupo.add(e);
    }

    // lanterna de cada jogador: cone de luz translúcido, e marcadores de caído e de reviver
    pecas.cones = []; pecas.discos = []; pecas.mochilas = [];
    const coneGeo = new THREE.ConeGeometry(2.3, 6, 20, 1, true); coneGeo.translate(0, -3, 0);
    for (const i of c.bonecos.keys()) {
      const pivo = new THREE.Group();
      const cone = malha(coneGeo, 0xfff2b0, { emissive: 0xfff2b0, emissiveIntensity: 1, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
      cone.rotation.z = Math.PI / 2; cone.castShadow = false; cone.position.y = 0.9; pivo.add(cone);
      grupo.add(pivo); pecas.cones.push(pivo);
      const anel = malha(new THREE.CylinderGeometry(1.3, 1.3, 0.05, 28), 0xff4a4a, { emissive: 0xff4a4a, emissiveIntensity: 0.9, transparent: true, opacity: 0.5 });
      const prog = malha(new THREE.CylinderGeometry(1.2, 1.2, 0.07, 28), 0x6bff9a, { emissive: 0x6bff9a, emissiveIntensity: 0.9 });
      anel.castShadow = false; prog.castShadow = false; anel.visible = prog.visible = false;
      grupo.add(anel, prog); pecas.discos.push({ anel, prog });
      const mochila = new THREE.Group();
      const tab = malha(caixaGeo(0.7, 0.12, 0.22), 0x9b6a3a); tab.position.x = -0.6;
      const lan = malha(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 8), 0xfff7d6, { emissive: 0xfff0b0, emissiveIntensity: 1 });
      const kit = malha(caixaGeo(0.4, 0.3, 0.3), 0xffffff, { emissive: 0xff3b3b, emissiveIntensity: 0.4 }); kit.position.x = 0.6;
      for (const m of [tab, lan, kit]) m.castShadow = false;
      mochila.add(tab, lan, kit); grupo.add(mochila); pecas.mochilas.push({ mochila, tab, lan, kit });
    }
    pecas.geo = {
      tronco: caixaGeo(0.7, 0.9, 0.5), cabeca: caixaGeo(0.5, 0.5, 0.5), braco: caixaGeo(0.95, 0.18, 0.18), pernas: caixaGeo(0.3, 0.7, 0.55),
    };
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c, g = pecas.geo;
    if (!g) return;

    // zumbis verdes cambaleando com os braços esticados
    const grupos = c.pool('zumbis', d.zumbis.length, () => {
      const o = new THREE.Group();
      const tronco = c.malha(g.tronco, 0x8a4a5e, { roughness: 0.9 }); tronco.position.y = 1.15;
      const cabeca = c.malha(g.cabeca, PELE, { roughness: 0.8 }); cabeca.position.set(0.06, 1.8, 0);
      const olhos = c.malha(new THREE.BoxGeometry(0.06, 0.1, 0.34), 0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 1 }); olhos.position.set(0.32, 1.84, 0); olhos.castShadow = false;
      const bE = c.malha(g.braco, PELE); bE.position.set(0.55, 1.4, 0.3); bE.castShadow = false;
      const bD = c.malha(g.braco, PELE); bD.position.set(0.55, 1.4, -0.3); bD.castShadow = false;
      const pernas = c.malha(g.pernas, 0x3a3d52); pernas.position.y = 0.4; pernas.castShadow = false;
      o.add(tronco, cabeca, olhos, bE, bD, pernas); o.scale.setScalar(1.45);
      o.userData = { tronco, cabeca, bE, bD, pernas };
      return o;
    });
    d.zumbis.forEach((z, n) => {
      const o = grupos[n], u = o.userData, ba = Math.sin(t * 4 + z.fase);
      o.position.set(z.x, 0, z.z); o.rotation.y = -z.ang;
      const tonto = z.atord > 0;
      u.tronco.rotation.z = tonto ? 0.3 * Math.sin(t * 18 + z.fase) : 0.12 * ba;
      u.cabeca.rotation.z = tonto ? -0.4 : 0.1 * Math.sin(t * 3 + z.fase);
      u.bE.rotation.z = 0.08 * ba; u.bD.rotation.z = -0.08 * ba;
      u.pernas.rotation.z = 0.2 * Math.sin(t * 5 + z.fase);
      u.cabeca.material.color.set(tonto ? 0xf4f4f4 : PELE);
      u.cabeca.material.emissive.set(tonto ? 0x666666 : 0x000000);
    });

    // tábuas nas entradas: somem quando quebram e escurecem com o dano
    pecas.tabuas.forEach((tab, k) => {
      const hp = d.tabua[k];
      tab.visible = hp > 0;
      if (hp > 0) { tab.scale.y = 0.6 + 0.4 * hp / HP_TABUA; tab.position.x = ENTRADAS[k].x + (hp < HP_TABUA ? 0.03 * Math.sin(t * 40) : 0); }
    });

    // itens do quintal
    const itens = c.pool('itens', d.itens.length, () => {
      const o = new THREE.Group();
      const tabua = c.malha(new THREE.BoxGeometry(1, 0.14, 0.32), 0x9b6a3a);
      const moeda = c.malha(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 18), 0xdfe3ee, { emissive: 0x8890a8, emissiveIntensity: 0.7, metalness: 0.5 }); moeda.rotation.x = Math.PI / 2;
      const lan = c.malha(new THREE.CylinderGeometry(0.24, 0.3, 0.7, 10), 0xfff7d6, { emissive: 0xfff0b0, emissiveIntensity: 1 });
      const kit = c.malha(new THREE.BoxGeometry(0.62, 0.42, 0.42), 0xffffff, { emissive: 0xff3b3b, emissiveIntensity: 0.35 });
      const base = c.malha(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 20), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6, transparent: true, opacity: 0.35 }); base.castShadow = false;
      o.add(tabua, moeda, lan, kit, base); o.userData = { tabua, moeda, lanterna: lan, kit, base }; o.scale.setScalar(1.6);       // itens grandes: na TV precisam ser vistos de longe
      return o;
    });
    d.itens.forEach((it, n) => {
      const o = itens[n], u = o.userData;
      for (const nome of ['tabua', 'moeda', 'lanterna', 'kit']) u[nome].visible = nome === it.tipo;
      const m = u[it.tipo];
      m.position.y = 0.7 + 0.15 * Math.sin(t * 3 + n); m.rotation.y = t * 2;
      u.base.position.y = 0.06; u.base.material.color.set(it.tipo === 'kit' ? 0xff6b6b : 0xffffff);
      o.position.set(it.x, 0, it.z);
      o.visible = it.vida > 3 || Math.floor(t * 8) % 2 === 0;     // pisca antes de sumir
    });

    // jogadores: lanterna, caído deitado, anel de reviver, mochila
    p.jogadores.forEach((j, i) => {
      const cone = pecas.cones[i], disco = pecas.discos[i], moch = pecas.mochilas[i], caido = d.caido[i];
      c.bonecos[i].rotation.z = caido ? Math.PI / 2 : 0;
      if (!caido) c.bonecos[i].visible = d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;
      cone.visible = !caido; cone.position.set(j.x, 0, j.z); cone.rotation.y = -d.ang[i];
      disco.anel.visible = caido; disco.prog.visible = caido && d.rev[i] > 0.02;
      if (caido) {
        disco.anel.position.set(j.x, 0.08, j.z); disco.anel.scale.setScalar(1 + 0.12 * Math.sin(t * 8));
        disco.prog.position.set(j.x, 0.1, j.z); disco.prog.scale.setScalar(Math.max(0.05, Math.min(1, d.rev[i] / T_REVIVE)));
      }
      const inv = d.inv[i];
      moch.mochila.visible = !caido && (inv.tabua + inv.lanterna + inv.kit) > 0;
      moch.mochila.position.set(j.x, 2.9, j.z);
      moch.tab.visible = inv.tabua > 0; moch.lan.visible = inv.lanterna > 0; moch.kit.visible = inv.kit > 0;
    });

    // pulso da lanterna
    const pulsos = c.pool('pulsos', d.pulsos.length, () => c.malha(new THREE.CylinderGeometry(1, 1, 0.05, 32, 1, true), 0xfff2b0, { emissive: 0xfff2b0, emissiveIntensity: 1, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    d.pulsos.forEach((pu, n) => {
      const f = Math.min(1, pu.idade / 0.5), m = pulsos[n];
      m.position.set(pu.x, 0.2, pu.z); m.scale.set(R_LANTERNA * f + 0.1, 1, R_LANTERNA * f + 0.1); m.material.opacity = 0.45 * (1 - f); m.castShadow = false;
    });

    // faíscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'pegou') c.particulas(e.x, 0.8, e.z, 0xffffff, 10, 5);
      else if (e.tipo === 'caiu') c.particulas(e.x, 1, e.z, 0xff4a4a, 22, 8);
      else if (e.tipo === 'reviveu') c.particulas(e.x, 1, e.z, 0x6bff9a, 24, 8);
      else if (e.tipo === 'tapou') c.particulas(e.x, 1, e.z, 0x9b6a3a, 12, 5);
      else if (e.tipo === 'quebrou') c.particulas(e.x, 1, e.z, 0x9b6a3a, 20, 9);
      else if (e.tipo === 'luz') c.particulas(e.x, 1, e.z, 0xfff2b0, 24, 9);
    }
  },
};
