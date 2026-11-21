// Guerra de neve na festa (todos contra todos ou times). Segure Rolar e ande: a bola cresce (e deixa lento); solte para lançar.
// Todos arremessam ao mesmo tempo. Quem leva bolada perde uma vida (são 3), é empurrado e fica um instante protegido.
// Bola contra bola de rivais: a maior vence e sobra a diferença. Em times a bola não acerta o parceiro.
// Vence o último de pé (ou a dupla que ainda tem alguém), ou quem tiver mais vidas no fim do tempo (em times, vidas da dupla somadas).
import { posiciona, posicionaCantos, posicionaRoda, timeDe, elimina, quem, RAIO } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 3;
const LX = 11, R0 = 0.7, RMAX = 2.0, R_BOLONA = 1.4, R_MIN = 0.45, CRESCE = 0.06;
const V_MIN = 2.2, ATRITO_BOLA = 0.35, QUIQUE = 0.8, V_PARADO = 1.5;
const T_TONTO = 0.5, T_RECARGA = 0.5, T_IMUNE = 2, MAX_LIVRES = 2;
const NOME_TIME = ['laranja', 'roxa'];

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // de quem é a vida no placar: do jogador ou da dupla
const inimigos = (p, a, b) => a !== b && (!times(p) || timeDe(p, a) !== timeDe(p, b));
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);
const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
const velLanca = r => 16 - (r - R0) * 4;           // bola pequena sai rápida, bola grande sai pesada
const fxPush = (d, tipo, x, z, extra = {}) => { d.fx.push({ tipo, x, z, ...extra }); };

// Duas bolas se encontram: a maior fica com a diferença de área, a menor desfaz. Sobrou muito pouco, as duas somem.
function choque(a, b) {
  const A = a.r * a.r, B = b.r * b.r, menor = A < B ? a : b, maior = A < B ? b : a;
  menor.vivo = false;
  const r = Math.sqrt(Math.abs(A - B));
  if (r < R_MIN) maior.vivo = false; else maior.r = r;
}

// Segura, cresce e solta a bola de um jogador; define a lentidão de quem rola.
function cuidaDaBola(p, d, j, i, dt) {
  const f = d.face[i], len = Math.hypot(j.ent.x, j.ent.y), sinal = p.mod?.inverte ? -1 : 1;
  if (len > 0.3) { f.x = sinal * j.ent.x / len; f.z = sinal * j.ent.y / len; }
  d.tonto[i] = Math.max(0, d.tonto[i] - dt); d.imune[i] = Math.max(0, d.imune[i] - dt);
  d.recarga[i] -= dt;
  let b = d.preso[i];
  const quer = j.ent.d && d.tonto[i] <= 0;
  if (!b && quer && d.recarga[i] <= 0 && d.bolas.filter(o => o.dono === i && !o.preso).length < MAX_LIVRES) {
    b = d.preso[i] = { x: j.x, z: j.z, vx: 0, vz: 0, r: R0, dono: i, preso: true, vivo: true, idade: 0, bolona: false };
    d.bolas.push(b);
  }
  if (b && !quer) { solta(p, d, j, i, b); b = null; }
  if (b) {
    const v = Math.hypot(j.vx, j.vz), lz = p.arena.lz;
    if (v > V_PARADO) b.r = Math.min(RMAX, b.r + v * dt * CRESCE);
    if (!b.bolona && b.r >= R_BOLONA) { b.bolona = true; p.eventos.push('moeda'); fxPush(d, 'quebra', b.x, b.z); }
    const dist = RAIO + b.r + 0.1;
    b.x = Math.max(-LX + b.r, Math.min(LX - b.r, j.x + f.x * dist));
    b.z = Math.max(-lz + b.r, Math.min(lz - b.r, j.z + f.z * dist));
    b.vx = j.vx; b.vz = j.vz;
  }
  j.turbo = d.tonto[i] > 0 ? 0 : b ? Math.max(0.45, 1 - (b.r - R0) * 0.5) : 1;
}

// Lança na direção em que o jogador olha; se um rival está quase nessa direção, a bola vai nele (joystick de celular não tem mira fina).
function solta(p, d, j, i, b) {
  const f = d.face[i];
  let dir = { x: f.x, z: f.z }, melhor = 0.8;
  p.jogadores.forEach((o, k) => {
    if (!o.vivo || !inimigos(p, i, k)) return;
    const al = unit(o.x - j.x, o.z - j.z), cos = f.x * al.x + f.z * al.z;
    if (cos > melhor) { melhor = cos; dir = cos > 0.9 ? al : unit(f.x + al.x, f.z + al.z); }
  });
  const v = velLanca(b.r);
  b.preso = false; b.vx = dir.x * v; b.vz = dir.z * v; b.idade = 0;
  d.preso[i] = null; d.recarga[i] = T_RECARGA;
  p.eventos.push('dash');
  fxPush(d, 'lanca', b.x, b.z);
}

// Bola solta: desliza, quica na parede e derrete quando para.
function voa(p, d, b, dt) {
  const lz = p.arena.lz, at = Math.pow(ATRITO_BOLA, dt);
  b.idade += dt;
  b.vx *= at; b.vz *= at;
  b.x += b.vx * dt; b.z += b.vz * dt;
  if (Math.abs(b.x) > LX - b.r) { b.x = Math.sign(b.x) * (LX - b.r); b.vx *= -QUIQUE; }
  if (Math.abs(b.z) > lz - b.r) { b.z = Math.sign(b.z) * (lz - b.r); b.vz *= -QUIQUE; }
  if (Math.hypot(b.vx, b.vz) < V_MIN) { b.vivo = false; fxPush(d, 'derrete', b.x, b.z); }
}

// Bolas de rivais que se tocam (soltas ou ainda rolando).
function encontros(p, d) {
  const bs = d.bolas;
  for (let a = 0; a < bs.length; a++) for (let k = a + 1; k < bs.length; k++) {
    const u = bs[a], v = bs[k];
    if (!u.vivo || !v.vivo || !inimigos(p, u.dono, v.dono)) continue;
    if (Math.hypot(u.x - v.x, u.z - v.z) >= u.r + v.r) continue;
    fxPush(d, 'quebra', (u.x + v.x) / 2, (u.z + v.z) / 2);
    choque(u, v);
  }
}

// Bolada: tira uma vida do primeiro rival em pé e sem proteção que a bola tocar.
function tentaAcertar(p, d, b) {
  const k = p.jogadores.findIndex((j, q) => j.vivo && inimigos(p, b.dono, q) && d.imune[q] <= 0 && Math.hypot(j.x - b.x, j.z - b.z) < RAIO + b.r * 0.9);
  if (k < 0) return;
  const j = p.jogadores[k], dir = unit(b.vx, b.vz), forca = 11 + b.r * 9;
  j.vx += dir.x * forca; j.vz += dir.z * forca;
  d.tonto[k] = T_TONTO * (0.7 + b.r * 0.5); d.imune[k] = T_IMUNE; d.vidas[k]--;
  if (d.preso[k]) { d.preso[k].vivo = false; fxPush(d, 'quebra', d.preso[k].x, d.preso[k].z); }     // a bola que ele rolava se desfaz
  b.vivo = false;
  fxPush(d, 'acerto', j.x, j.z, { quem: k, grande: b.r >= R_BOLONA });
  p.eventos.push('explosao');
  p.celular[k] = { ...p.celular[k], vibra: (p.celular[k].vibra ?? 0) + 1 };
  if (d.vidas[k] <= 0) { elimina(p, j, 12); j.turbo = 1; p.eventos.push('queda'); }
}

function somaVidas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Último dono (jogador ou dupla) com vida; no tempo, o de mais vidas (igual dá empate).
function resultado(p) {
  const pl = p.dados.placar, restam = pl.flatMap((v, k) => (v > 0 ? [k] : []));
  if (restam.length <= 1) return restam.length ? restam[0] : -1;
  if (p.t >= TEMPO) {
    const maior = Math.max(...pl), lideres = pl.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) { d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`; d.avisoCor = '#ffd23f'; }
  p.jogadores.forEach((_, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (d.vidas[i] <= 0) t = times(p) ? 'Você saiu. Torça pela dupla!' : 'Você saiu. Torça!';
    else t = `Vidas: ${d.vidas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} Segure Rolar, ande e solte.`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'bola-neve-festa', genero: 'mira', nome: 'Guerra de neve geral', dica: 'Segure Rolar e ande, depois solte nos rivais: bolada tira uma vida.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Rolar', b: '' }, semDash: true, semPulo: true, rotulo: 'vidas', duracao: TEMPO, tema: 2,

  inicia(p) {
    const n = p.jogadores.length, lz = 6.5 + (n - 2) * 0.75;       // a quadra cresce com o número de jogadores
    p.arena = { tipo: 'ret', lx: LX, lz, parede: true };
    if (n === 2) posiciona(p, 7);
    else if (n === 3) { posicionaRoda(p, 1); p.jogadores.forEach(j => { j.x *= 7; j.z *= lz - 2.5; }); }
    else posicionaCantos(p, 7, lz * 0.55);                          // em times, dupla A à esquerda e dupla B à direita
    p.dados = {
      bolas: [], preso: Array(n).fill(null), face: p.jogadores.map(j => unit(-j.x, -j.z)),      // todos começam olhando para o centro
      vidas: Array(n).fill(VIDAS), tonto: Array(n).fill(0), imune: Array(n).fill(0), recarga: Array(n).fill(0),
      fx: [], placar: [], inventario: [], aviso: '', avisoCor: '#ffffff',
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => { if (j.vivo) cuidaDaBola(p, d, j, i, dt); });
    for (const b of d.bolas) if (!b.preso) voa(p, d, b, dt);
    encontros(p, d);
    for (const b of d.bolas) if (b.vivo && !b.preso) tentaAcertar(p, d, b);
    p.jogadores.forEach((j, i) => { if (d.preso[i] && (!j.vivo || !d.preso[i].vivo)) { d.preso[i].vivo = false; d.preso[i] = null; } });
    d.bolas = d.bolas.filter(b => b.vivo);

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, lz = p.arena.lz;
    pecas.visto = 0;
    const neve = malha(new THREE.BoxGeometry(LX * 2, 0.04, lz * 2), 0x8fbfe0, { roughness: 0.5, emissive: 0x1d3f66, emissiveIntensity: 0.45 });
    neve.position.y = 0.02; neve.castShadow = false; grupo.add(neve);
    if (times(p)) for (const lado of [-1, 1]) {       // cada metade com a cor da dupla que começa nela (a quadra é uma só: pode cruzar)
      const tinta = malha(new THREE.BoxGeometry(LX, 0.02, lz * 2), c.times[lado < 0 ? 0 : 1], { transparent: true, opacity: 0.16 });
      tinta.position.set(lado * LX / 2, 0.05, 0); tinta.castShadow = false; grupo.add(tinta);
    }
    // muretas de neve em volta, baixas para não esconder ninguém
    const monte = (x, z, sx, sz) => { const m = malha(new THREE.IcosahedronGeometry(0.9, 1), 0xf2f8ff, { roughness: 0.9, flatShading: true }); m.scale.set(sx, 0.55, sz); m.position.set(x, 0.2, z); grupo.add(m); };
    for (let x = -LX; x <= LX; x += 2.2) for (const z of [-lz - 0.3, lz + 0.3]) monte(x, z, 1.2, 0.8);
    for (let z = -lz; z <= lz; z += 2.2) for (const x of [-LX - 0.3, LX + 0.3]) monte(x, z, 0.8, 1.2);
    // por jogador: seta de mira e vidas (bolinhas acima do nome), na cor dele ou da dupla
    pecas.setas = []; pecas.pips = [];
    c.bonecos.forEach((_, i) => {
      const cor = corDe(c, i), s = new THREE.Group();
      const geo = new THREE.ConeGeometry(0.45, 1.1, 3); geo.rotateZ(-Math.PI / 2);
      const m = malha(geo, cor, { emissive: cor, emissiveIntensity: 0.7 }); m.castShadow = false; m.position.y = 0.12;
      s.add(m); grupo.add(s); pecas.setas.push(s);
      const g = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const q = malha(new THREE.SphereGeometry(0.3, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.8 });
        q.castShadow = false; q.position.x = (k - 1) * 0.8; g.add(q); return q;
      });
      grupo.add(g); pecas.pips.push({ g, pips });
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { THREE, pecas } = c;
    p.jogadores.forEach((j, i) => {
      const f = d.face[i], b = d.preso[i], bo = c.bonecos[i], alvo = pecas.pips[i];
      const alcance = RAIO + 1.3 + (b ? b.r * 2 + 0.3 : 0);
      pecas.setas[i].visible = j.vivo;
      pecas.setas[i].position.set(j.x + f.x * alcance, 0, j.z + f.z * alcance);
      pecas.setas[i].rotation.y = -Math.atan2(f.z, f.x);
      bo.rotation.z = j.vivo && d.tonto[i] > 0 ? Math.sin(t * 40) * 0.3 : 0;       // tombo de quem levou bolada
      if (j.vivo) bo.visible = d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;     // pisca enquanto protegido
      alvo.g.visible = j.vivo && d.vidas[i] > 0;
      alvo.g.position.set(bo.position.x, bo.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, bo.position.z);      // acima da plaquinha do nome
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });

    const ms = c.pool('bolas', d.bolas.length, () => {
      const g = new THREE.Group();
      const bola = c.malha(new THREE.IcosahedronGeometry(1, 1), 0xffffff, { roughness: 0.8, flatShading: true });
      const anel = c.malha(new THREE.TorusGeometry(0.97, 0.1, 6, 24), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.2; anel.castShadow = false;
      g.add(bola, anel); g.userData = { bola, anel }; return g;
    });
    d.bolas.forEach((b, k) => {
      const g = ms[k], { bola, anel } = g.userData;
      g.position.set(b.x, b.r, b.z);
      bola.scale.setScalar(b.r); anel.scale.setScalar(b.r);
      bola.rotation.x += b.vz * dt / b.r; bola.rotation.z -= b.vx * dt / b.r;
      const cor = corDe(c, b.dono);       // o anel diz de quem é a bola
      anel.material.color.set(cor); anel.material.emissive.set(cor);
    });

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'acerto') {
        c.particulas(e.x, 1, e.z, 0xffffff, e.grande ? 36 : 22, e.grande ? 12 : 8);
        c.particulas(e.x, 1, e.z, corDe(c, e.quem), 14, 7);
        c.som(e.grande ? 180 : 260, 0.22, 'square', 0.12);
      } else if (e.tipo === 'quebra') { c.particulas(e.x, 0.8, e.z, 0xffffff, 12, 5); c.som(520, 0.08, 'triangle', 0.06); }
      else if (e.tipo === 'derrete') c.particulas(e.x, 0.4, e.z, 0xbfe0ff, 6, 3);
      else if (e.tipo === 'lanca') c.particulas(e.x, 0.6, e.z, 0xffffff, 6, 4);
    }
  },
};
