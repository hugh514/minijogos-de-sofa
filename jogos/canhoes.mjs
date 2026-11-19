// Guerra de canhoes: estilingue no celular, bola em arco, derrube as caixas do outro.
import { posiciona, maiorPlacar, elimina } from '../logica.mjs';

const LX = 11, LZ = 6.5, CANHAO_X = 5, CAIXA_X = 8.8, COLUNAS = [-3.4, 0, 3.4], LADO = 1.4, MEIO = LADO / 2;
const G = 18, VY = 11, VH_MAX = 17, BOCA_Y = 1, R_BOLA = 0.45, RECARGA = 0.8, DURACAO = 40;
const ARRASTO_CHEIO = 1.1, ARRASTO_MIN = 0.08, SETA = 4;
// tempo de voo da boca do canhao ate o chao, para marcar onde a bola vai cair
const T_VOO = (VY + Math.sqrt(VY * VY + 2 * G * (BOCA_Y - R_BOLA))) / G;

// Estilingue: devolve { dx, dz, f } (direcao oposta ao arrasto, forca de 0 a 1) no quadro em que o dedo solta.
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

const ladoDe = i => (i ? 1 : -1);
const restantes = (d, dono) => d.caixas.filter(c => c.dono === dono && !c.caiu).length;

function atira(p, i, tiro) {
  const d = p.dados, x = ladoDe(i) * CANHAO_X;
  d.bolas.push({ x: x + tiro.dx * 0.9, y: BOCA_Y, z: tiro.dz * 0.9, vx: tiro.dx * tiro.f * VH_MAX, vy: VY, vz: tiro.dz * tiro.f * VH_MAX, dono: i });
  d.dir[i] = { dx: tiro.dx, dz: tiro.dz };
  d.recarga[i] = RECARGA;
  d.fx.push({ x: x + tiro.dx * 1.3, y: BOCA_Y + 0.5, z: tiro.dz * 1.3, cor: -1, q: 6, forca: 3 });
  p.eventos.push('dash');
}

function acertou(b, c) {
  const px = Math.max(c.x - MEIO, Math.min(c.x + MEIO, b.x));
  const py = Math.max(c.y - MEIO, Math.min(c.y + MEIO, b.y));
  const pz = Math.max(c.z - MEIO, Math.min(c.z + MEIO, b.z));
  return Math.hypot(b.x - px, b.y - py, b.z - pz) < R_BOLA;
}

export default {
  id: 'canhoes', genero: 'mira', nome: 'Guerra de canhões', dica: 'Arraste para trás e solte para atirar. Derrube todas as caixas do outro!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'caixas', duracao: DURACAO,
  controle: { modo: 'toque' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 6.7);
    const caixas = [];
    for (const dono of [0, 1])
      for (const z of COLUNAS)
        for (const nivel of [0, 1])
          caixas.push({ dono, col: z, x: ladoDe(dono) * CAIXA_X, y: MEIO + nivel * LADO, z, nivel, caiu: false, t: 0, vx: 0, vy: 0, vz: 0 });
    p.dados = {
      caixas, bolas: [], fx: [], placar: [caixas.length / 2, caixas.length / 2],
      miras: [0, 1].map(() => ({ d: false, x0: 0, y0: 0, ax: 0, ay: 0 })),
      recarga: [0, 0], fila: [null, null], dir: [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }],
    };
    for (const i of [0, 1]) p.celular[i] = { texto: 'Arraste para trás e solte para atirar' };
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      if (j.vivo) { j.x = ladoDe(i) * 6.7; j.z = 0; j.vx = j.vz = 0; }
      const tiro = estilingue(d.miras[i], j.ent);
      if (tiro) d.fila[i] = tiro;                            // soltou durante a recarga: o tiro sai assim que der
      d.recarga[i] -= dt;
      if (d.fila[i] && d.recarga[i] <= 0) { atira(p, i, d.fila[i]); d.fila[i] = null; }
    });

    for (const b of d.bolas) {
      b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const alvo = d.caixas.find(c => !c.caiu && acertou(b, c));
      if (alvo) {
        alvo.caiu = true; alvo.vx = b.vx * 0.5; alvo.vy = 7; alvo.vz = b.vz * 0.5; b.fim = true;
        d.fx.push({ x: alvo.x, y: alvo.y, z: alvo.z, cor: alvo.dono, q: 26, forca: 7 });
        p.eventos.push('explosao');
        p.celular[alvo.dono] = { ...p.celular[alvo.dono], vibra: (p.celular[alvo.dono].vibra ?? 0) + 1 };
        for (const c of d.caixas) if (c.dono === alvo.dono && c.col === alvo.col && c.nivel > alvo.nivel) c.nivel--;   // a de cima desce
      } else if (b.y <= R_BOLA) {
        b.fim = true;
        if (Math.abs(b.x) < LX && Math.abs(b.z) < LZ) { d.fx.push({ x: b.x, y: 0.2, z: b.z, cor: -1, q: 8, forca: 3 }); p.eventos.push('batida'); }
      } else if (Math.abs(b.x) > LX + 3 || Math.abs(b.z) > LZ + 3) b.fim = true;
    }
    d.bolas = d.bolas.filter(b => !b.fim);

    for (const c of d.caixas) {
      if (c.caiu) { c.t += dt; c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; }
      else c.y = Math.max(MEIO + c.nivel * LADO, c.y - 9 * dt);
    }

    d.placar = [restantes(d, 0), restantes(d, 1)];
    const [a, b] = d.placar;
    if (!a || !b) {
      for (const i of [0, 1]) if (!d.placar[i]) { elimina(p, p.jogadores[i], 13); p.eventos.push('queda'); }
      return !a && !b ? -1 : a ? 0 : 1;
    }
    if (p.t > DURACAO) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c, d = c.p.dados;
    const meio = malha(new THREE.BoxGeometry(0.15, 0.02, LZ * 2), 0xffffff, { transparent: true, opacity: 0.4 });
    meio.position.y = 0.01; grupo.add(meio);

    pecas.caixas = d.caixas.map(cx => {
      const m = malha(new THREE.BoxGeometry(LADO - 0.08, LADO - 0.08, LADO - 0.08), cores[cx.dono], { emissive: cores[cx.dono], emissiveIntensity: 0.15 });
      grupo.add(m); return m;
    });

    pecas.canhoes = [0, 1].map(i => {
      const g = new THREE.Group(); g.position.set(ladoDe(i) * CANHAO_X, 0, 0);
      const base = malha(new THREE.CylinderGeometry(0.8, 0.95, 0.6, 20), cores[i]); base.position.y = 0.3;
      const giro = new THREE.Group(); giro.position.y = 0.7;
      const cano = malha(new THREE.CylinderGeometry(0.34, 0.42, 1.7, 16), 0x2b2f3a, { emissive: cores[i], emissiveIntensity: 0.5, roughness: 0.4 });
      cano.rotation.z = -Math.PI / 2 + 0.6; cano.position.set(0.55, 0.4, 0);
      const corpo = malha(new THREE.SphereGeometry(0.6, 16, 12), 0x2b2f3a);
      giro.add(cano, corpo); g.add(base, giro); grupo.add(g);
      return { giro, cano };
    });

    const branco = { emissive: 0xffffff, emissiveIntensity: 0.7 };
    pecas.setas = [0, 1].map(i => {
      const seta = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(1, 0.1, 0.26), 0xffffff, branco);
      const ponta = malha(new THREE.ConeGeometry(0.42, 0.85, 12), 0xffffff, branco); ponta.rotation.z = -Math.PI / 2;
      seta.add(haste, ponta); seta.position.set(ladoDe(i) * CANHAO_X, 0.12, 0); grupo.add(seta);
      const marca = malha(new THREE.TorusGeometry(0.75, 0.1, 8, 28), cores[i], { emissive: cores[i], emissiveIntensity: 1 });
      marca.rotation.x = Math.PI / 2; marca.position.y = 0.1; grupo.add(marca);
      return { seta, haste, ponta, marca };
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, cores } = c, d = c.p.dados;
    d.caixas.forEach((cx, n) => {
      const m = pecas.caixas[n];
      m.visible = cx.t < 0.9;
      m.position.set(cx.x, cx.y, cx.z);
      m.rotation.set(cx.t * 9, cx.t * 6, 0);
      m.scale.setScalar(Math.max(0.05, 1 - cx.t / 0.9));
    });

    const bolas = c.pool('bolas', d.bolas.length, () => c.malha(new THREE.SphereGeometry(R_BOLA, 16, 12), 0x20232b, { emissiveIntensity: 0.9, roughness: 0.3 }));
    d.bolas.forEach((b, n) => { bolas[n].position.set(b.x, b.y, b.z); bolas[n].material.emissive.set(cores[b.dono]); });

    for (const i of [0, 1]) {
      const m = d.miras[i], tiro = m.d ? pontaria(m) : null, dir = tiro ?? d.dir[i];
      const { giro, cano } = pecas.canhoes[i], { seta, haste, ponta, marca } = pecas.setas[i];
      giro.rotation.y = Math.atan2(-dir.dz, dir.dx);
      cano.material.emissiveIntensity = d.recarga[i] <= 0 ? 0.6 : 0.05;   // cano aceso: pronto para atirar
      seta.visible = marca.visible = !!tiro;
      if (!tiro) continue;
      const comp = 0.8 + tiro.f * SETA;
      seta.rotation.y = giro.rotation.y;
      haste.scale.x = comp; haste.position.x = 1 + comp / 2; ponta.position.x = 1 + comp + 0.4;
      const alcance = 0.9 + tiro.f * VH_MAX * T_VOO;          // onde a bola vai cair
      marca.position.x = ladoDe(i) * CANHAO_X + tiro.dx * alcance; marca.position.z = tiro.dz * alcance;
      marca.scale.setScalar(1 + 0.12 * Math.sin(t * 10));
    }

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor < 0 ? 0xffffff : cores[f.cor], f.q, f.forca);
    }
  },
};
