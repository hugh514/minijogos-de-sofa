// Guerra de canhões na festa (todos contra todos ou times). Cada um tem um canhão e, atrás dele, a sua pilha de 6 caixas:
// com 2, um de cada lado; com 3, dois nos lados e um embaixo; com 4, um em cada canto (em times, a dupla no mesmo lado).
// Estilingue no celular: arraste para trás e solte; a bola voa em arco para qualquer rival. A própria bola não derruba caixa do dono nem do parceiro.
// Quem perde todas as caixas sai. Vence o último com caixas (ou a dupla), ou quem tiver mais caixas no fim do tempo.
import { timeDe, elimina, quem } from '../logica.mjs';

export const LX = 11, LZ = 7.5, CAIXAS = 6, TEMPO = 45;
const LADO = 1.4, MEIO = LADO / 2, FUNDO = 1.8, D_CANHAO = 4.2, D_BONECO = 2.1;      // distâncias a partir da fileira de caixas, para o centro
const G = 18, VY = 11, VH_MAX = 17, BOCA_Y = 1, R_BOLA = 0.45, RECARGA = 0.8;
const ARRASTO_CHEIO = 1.1, ARRASTO_MIN = 0.08, SETA = 4;
const T_VOO = (VY + Math.sqrt(VY * VY + 2 * G * (BOCA_Y - R_BOLA))) / G;       // da boca do canhão até o chão, para marcar onde a bola cai
const NOME_TIME = ['laranja', 'roxa'];
const BRANCO = 0xffffff;

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // de quem é a caixa no placar: do jogador ou da dupla
const inimigos = (p, a, b) => a !== b && (!times(p) || timeDe(p, a) !== timeDe(p, b));
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);

// Lugar de cada jogador: centro da fileira de caixas (x, z), direção para a parede (nx, nz), espaço entre colunas e o canhão (cx, cz).
function montaBases(n) {
  const X = LX - FUNDO, Z = LZ - FUNDO;
  const lugares = n === 2 ? [[-X, 0, -1, 0, 3.4], [X, 0, 1, 0, 3.4]]
    : n === 3 ? [[-X, -2.5, -1, 0, 2.6], [X, -2.5, 1, 0, 2.6], [0, Z, 0, 1, 2.6]]
      : [[-X, -3.9, -1, 0, 2.2], [X, -3.9, 1, 0, 2.2], [-X, 3.9, -1, 0, 2.2], [X, 3.9, 1, 0, 2.2]];
  return lugares.map(([x, z, nx, nz, esp]) => ({ x, z, nx, nz, esp, cx: x - nx * D_CANHAO, cz: z - nz * D_CANHAO }));
}

// Estilingue: devolve { dx, dz, f } (direção oposta ao arrasto, força de 0 a 1) no quadro em que o dedo solta.
function estilingue(m, ent) {
  let tiro = null;
  if (ent.d && !m.d) { m.x0 = ent.x; m.y0 = ent.y; }
  if (ent.d) { m.ax = ent.x - m.x0; m.ay = ent.y - m.y0; }
  else if (m.d) { tiro = pontaria(m); m.ax = m.ay = 0; }
  m.d = ent.d;
  return tiro;
}
function pontaria(m) {
  const len = Math.hypot(m.ax, m.ay);
  if (!(len > ARRASTO_MIN)) return null;
  return { dx: -m.ax / len, dz: -m.ay / len, f: Math.max(0.15, Math.min(1, len / ARRASTO_CHEIO)) };
}

function atira(p, i, tiro) {
  const d = p.dados, b = d.bases[i];
  d.bolas.push({ x: b.cx + tiro.dx * 0.9, y: BOCA_Y, z: b.cz + tiro.dz * 0.9, vx: tiro.dx * tiro.f * VH_MAX, vy: VY, vz: tiro.dz * tiro.f * VH_MAX, dono: i });
  d.dir[i] = { dx: tiro.dx, dz: tiro.dz };
  d.recarga[i] = RECARGA;
  d.fx.push({ x: b.cx + tiro.dx * 1.3, y: BOCA_Y + 0.5, z: b.cz + tiro.dz * 1.3, i: -1, q: 6, forca: 3 });
  p.eventos.push('dash');
}

function acertou(b, c) {
  const px = Math.max(c.x - MEIO, Math.min(c.x + MEIO, b.x));
  const py = Math.max(c.y - MEIO, Math.min(c.y + MEIO, b.y));
  const pz = Math.max(c.z - MEIO, Math.min(c.z + MEIO, b.z));
  return Math.hypot(b.x - px, b.y - py, b.z - pz) < R_BOLA;
}

function voa(p, d, b, dt) {
  b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  const alvo = d.caixas.find(c => !c.caiu && inimigos(p, b.dono, c.dono) && acertou(b, c));
  if (alvo) {
    alvo.caiu = true; alvo.vx = b.vx * 0.5; alvo.vy = 7; alvo.vz = b.vz * 0.5; b.fim = true;
    d.fx.push({ x: alvo.x, y: alvo.y, z: alvo.z, i: alvo.dono, q: 26, forca: 7 });
    p.eventos.push('explosao');
    p.celular[alvo.dono] = { ...p.celular[alvo.dono], vibra: (p.celular[alvo.dono].vibra ?? 0) + 1 };
    for (const c of d.caixas) if (c.dono === alvo.dono && c.col === alvo.col && c.nivel > alvo.nivel) c.nivel--;   // a de cima desce
  } else if (b.y <= R_BOLA) {
    b.fim = true;
    if (Math.abs(b.x) < LX && Math.abs(b.z) < LZ) { d.fx.push({ x: b.x, y: 0.2, z: b.z, i: -1, q: 8, forca: 3 }); p.eventos.push('batida'); }
  } else if (Math.abs(b.x) > LX + 3 || Math.abs(b.z) > LZ + 3) b.fim = true;
}

function somaCaixas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  for (const c of p.dados.caixas) if (!c.caiu) totais[de(c.dono)]++;
  return totais;
}

// Último dono (jogador ou dupla) com caixas; no tempo, o de mais caixas (igual dá empate).
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
    else if (d.minhas[i] <= 0) t = times(p) ? 'Você saiu. Torça pela dupla!' : 'Você saiu. Torça!';
    else t = `Caixas: ${d.minhas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} Arraste para trás e solte.`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'canhoes-festa', genero: 'mira', nome: 'Canhões de todos', dica: 'Arraste para trás e solte para atirar nas caixas dos rivais: quem fica sem caixas sai.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  // Ninguém anda (controle de toque, semMovimento): gelo, foguete, espelho, lua e as cartas de andar não são sorteados.
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'caixas', duracao: TEMPO,
  controle: { modo: 'toque' },

  inicia(p) {
    const n = p.jogadores.length, bases = montaBases(n), caixas = [];
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    bases.forEach((b, dn) => {
      for (const col of [-1, 0, 1]) for (const nivel of [0, 1])       // a fileira corre ao longo da parede: 3 colunas de 2 caixas
        caixas.push({ dono: dn, col, x: b.x - b.nz * col * b.esp, y: MEIO + nivel * LADO, z: b.z + b.nx * col * b.esp, nivel, caiu: false, t: 0, vx: 0, vy: 0, vz: 0 });
      Object.assign(p.jogadores[dn], { x: b.x - b.nx * D_BONECO, z: b.z - b.nz * D_BONECO });
    });
    p.dados = {
      bases, caixas, bolas: [], fx: [], placar: [], minhas: Array(n).fill(CAIXAS), inventario: [],
      miras: bases.map(() => ({ d: false, x0: 0, y0: 0, ax: 0, ay: 0 })),
      recarga: Array(n).fill(0), fila: Array(n).fill(null), dir: bases.map(b => ({ dx: -b.nx, dz: -b.nz })),
      aviso: '', avisoCor: '#ffd23f', avisoT: 0,
    };
    p.dados.placar = somaCaixas(p);
    p.jogadores.forEach((_, i) => { p.celular[i] = { texto: `Caixas: ${CAIXAS}. Arraste para trás e solte.` }; });
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    p.jogadores.forEach((j, i) => {
      if (!j.vivo) return;
      const b = d.bases[i];
      j.x = b.x - b.nx * D_BONECO; j.z = b.z - b.nz * D_BONECO; j.vx = j.vz = 0;
      const tiro = estilingue(d.miras[i], j.ent);
      if (tiro) d.fila[i] = tiro;                            // soltou durante a recarga: o tiro sai assim que der
      d.recarga[i] -= dt;
      if (d.fila[i] && d.recarga[i] <= 0) { atira(p, i, d.fila[i]); d.fila[i] = null; }
    });

    for (const b of d.bolas) voa(p, d, b, dt);
    d.bolas = d.bolas.filter(b => !b.fim);
    for (const c of d.caixas) {
      if (c.caiu) { c.t += dt; c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; }
      else c.y = Math.max(MEIO + c.nivel * LADO, c.y - 9 * dt);
    }

    d.minhas = p.jogadores.map((_, i) => d.caixas.filter(c => c.dono === i && !c.caiu).length);
    d.placar = somaCaixas(p);
    d.inventario = d.minhas.map(v => ['Caixas ' + v]);
    p.jogadores.forEach((j, i) => {
      if (!j.vivo || d.minhas[i] > 0) return;
      elimina(p, j, 13); p.eventos.push('queda');
      d.aviso = `${quem(p, i)} saiu!`; d.avisoCor = '#ff4a4a'; d.avisoT = 1.5;
    });
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c, d = c.p.dados;
    pecas.nfx = 0;

    // caixas de madeira com a cor do dono (ou da dupla) e uma tampa clara
    pecas.caixas = d.caixas.map(cx => {
      const cor = corDe(c, cx.dono), g = new THREE.Group();
      const corpo = malha(new THREE.BoxGeometry(LADO - 0.08, LADO - 0.08, LADO - 0.08), cor, { emissive: cor, emissiveIntensity: 0.18, roughness: 0.7 });
      const cinta = malha(new THREE.BoxGeometry(LADO - 0.02, 0.22, LADO - 0.02), 0x3a2a1c, { roughness: 0.9 }); cinta.castShadow = false;
      g.add(corpo, cinta); grupo.add(g); return g;
    });

    pecas.canhoes = d.bases.map((b, i) => {
      const cor = corDe(c, i), g = new THREE.Group(); g.position.set(b.cx, 0, b.cz);
      // tapete da cor do dono, do canhão até as caixas: mostra de quem é cada pilha
      const tapete = malha(new THREE.BoxGeometry(b.nx ? D_CANHAO + 2.6 : b.esp * 2 + LADO + 0.8, 0.02, b.nx ? b.esp * 2 + LADO + 0.8 : D_CANHAO + 2.6), cor, { transparent: true, opacity: 0.22 });
      tapete.position.set(b.x - b.nx * (D_CANHAO - 1) / 2, 0.03, b.z - b.nz * (D_CANHAO - 1) / 2); tapete.castShadow = false; grupo.add(tapete);
      const base = malha(new THREE.CylinderGeometry(0.95, 1.1, 0.6, 20), cor); base.position.y = 0.3;
      const giro = new THREE.Group(); giro.position.y = 0.7;
      const cano = malha(new THREE.CylinderGeometry(0.4, 0.5, 2, 16), 0x2b2f3a, { emissive: cor, emissiveIntensity: 0.5, roughness: 0.4 });
      cano.rotation.z = -Math.PI / 2 + 0.6; cano.position.set(0.65, 0.45, 0);
      const corpo = malha(new THREE.SphereGeometry(0.7, 16, 12), 0x2b2f3a);
      giro.add(cano, corpo); g.add(base, giro); grupo.add(g);
      return { g, giro, cano };
    });

    const claro = { emissive: BRANCO, emissiveIntensity: 0.7 };
    pecas.setas = d.bases.map((b, i) => {
      const cor = corDe(c, i), seta = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(1, 0.1, 0.26), BRANCO, claro);
      const ponta = malha(new THREE.ConeGeometry(0.42, 0.85, 12), BRANCO, claro); ponta.rotation.z = -Math.PI / 2;
      seta.add(haste, ponta); seta.position.set(b.cx, 0.12, b.cz); grupo.add(seta);
      const marca = malha(new THREE.TorusGeometry(0.75, 0.1, 8, 28), cor, { emissive: cor, emissiveIntensity: 1 });
      marca.rotation.x = Math.PI / 2; marca.position.y = 0.1; grupo.add(marca);
      return { seta, haste, ponta, marca };
    });
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados;
    d.caixas.forEach((cx, n) => {
      const m = pecas.caixas[n];
      m.visible = cx.t < 0.9;
      m.position.set(cx.x, cx.y, cx.z);
      m.rotation.set(cx.t * 9, cx.t * 6, 0);
      m.scale.setScalar(Math.max(0.05, 1 - cx.t / 0.9));
    });

    const bolas = c.pool('bolas', d.bolas.length, () => c.malha(new THREE.SphereGeometry(R_BOLA, 16, 12), 0x20232b, { emissiveIntensity: 0.9, roughness: 0.3 }));
    d.bolas.forEach((b, n) => { bolas[n].position.set(b.x, b.y, b.z); bolas[n].material.emissive.set(corDe(c, b.dono)); });

    d.bases.forEach((b, i) => {
      const vivo = p.jogadores[i].vivo, m = d.miras[i], tiro = vivo && m.d ? pontaria(m) : null, dir = tiro ?? d.dir[i];
      const { g, giro, cano } = pecas.canhoes[i], { seta, haste, ponta, marca } = pecas.setas[i];
      giro.rotation.y = Math.atan2(-dir.dz, dir.dx);
      cano.material.emissiveIntensity = vivo && d.recarga[i] <= 0 ? 0.6 : 0.05;   // cano aceso: pronto para atirar
      g.rotation.z = vivo ? 0 : Math.min(0.5, g.rotation.z + dt * 2);             // canhão de quem saiu tomba
      seta.visible = marca.visible = !!tiro;
      if (!tiro) return;
      const comp = 0.8 + tiro.f * SETA;
      seta.rotation.y = giro.rotation.y;
      haste.scale.x = comp; haste.position.x = 1 + comp / 2; ponta.position.x = 1 + comp + 0.4;
      const alcance = 0.9 + tiro.f * VH_MAX * T_VOO;          // onde a bola vai cair
      marca.position.x = b.cx + tiro.dx * alcance; marca.position.z = b.cz + tiro.dz * alcance;
      marca.scale.setScalar(1 + 0.12 * Math.sin(t * 10));
    });

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.i < 0 ? BRANCO : corDe(c, f.i), f.q, f.forca);
      if (f.i >= 0) c.som(200, 0.18, 'square', 0.1);       // madeira quebrando
    }
  },
};
