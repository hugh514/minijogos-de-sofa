// Trilha de luz: o boneco anda sozinho e o joystick so vira. Cada um deixa uma parede de luz que fica na arena.
// Bater em qualquer parede de luz ou na cerca da borda elimina. A: turbo (3 cargas). B: pulo por cima de uma parede (1 uso).
import { elimina, quemSobrou } from '../logica.mjs';

export const LX = 11, LZ = 8, BORDA = 0.5, LIMITE = 55, CARGAS = 3, PASSO = 0.4, FOLGA = 0.3;
const V0 = 5, ACELERA = 0.08, GIRO = 4, TURBO = 1.7, T_TURBO = 1, PULO = 9, ALTURA_LIVRE = 0.35;
const IGNORA = 8;            // os ultimos pontos da propria trilha nao contam (senao bateria na parede que acabou de soltar)
const MAX_PONTOS = 1400;     // sobra: o caminho inteiro de 55 s da uns 1050 pontos

// Distancia do ponto (x, z) ao segmento a-b.
export function distSeg(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
  return Math.hypot(x - a.x - dx * u, z - a.z - dz * u);
}

function bateNaLuz(d, i, x, z) {
  for (const k of [0, 1]) {
    const pts = d.trilhas[k], fim = k === i ? pts.length - IGNORA : pts.length;
    for (let n = 1; n < fim; n++) if (distSeg(x, z, pts[n - 1], pts[n]) < FOLGA) return true;
    if (k !== i && pts.length && distSeg(x, z, pts.at(-1), d.cobras[k]) < FOLGA) return true;   // pedaco ainda nao guardado, ate a cabeca do outro
  }
  return false;
}

const texto = c => `Turbo: ${c.cargas}   Pulo: ${c.pulos}`;

export default {
  id: 'cobras', nome: 'Trilha de luz', dica: 'Você anda sozinho: só vire! Bateu em parede de luz ou na cerca, perdeu. A dá turbo, B pula uma parede.',
  controle: { modo: 'padrao', a: 'TURBO', b: 'PULO' }, semMovimento: true, semDash: true, semPulo: true, duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const cobras = [-1, 1].map(lado => ({ x: lado * 8, z: lado * 3, ang: lado < 0 ? 0 : Math.PI, turbo: 0, cargas: CARGAS, pulos: 1 }));
    p.dados = { cobras, trilhas: cobras.map(c => [{ x: c.x, z: c.z }]), fx: [] };
    p.jogadores.forEach((j, i) => { j.x = cobras[i].x; j.z = cobras[i].z; p.celular[i] = { texto: texto(cobras[i]) }; });
  },

  atualiza(p, dt) {
    const d = p.dados;
    dt = Math.min(dt, 0.05);
    const base = V0 + ACELERA * p.t;
    const bateu = [false, false];

    p.jogadores.forEach((j, i) => {
      const c = d.cobras[i], pts = d.trilhas[i];
      if (!j.vivo) return;
      if (j.apertouA && c.cargas > 0 && c.turbo <= 0) { c.cargas--; c.turbo = T_TURBO; p.eventos.push('dash'); p.celular[i] = { ...p.celular[i], texto: texto(c) }; }
      if (j.apertouB && c.pulos > 0 && j.y === 0) { c.pulos--; j.vy = PULO; p.eventos.push('pulo'); p.celular[i] = { ...p.celular[i], texto: texto(c) }; }

      const forca = Math.hypot(j.ent.x, j.ent.y);
      if (forca > 0.3) {                                       // vira aos poucos para o lado do joystick
        const alvo = Math.atan2(j.ent.y, j.ent.x) - c.ang, dif = Math.atan2(Math.sin(alvo), Math.cos(alvo));
        c.ang += Math.max(-GIRO * dt, Math.min(GIRO * dt, dif));
      }
      const anda = base * (c.turbo > 0 ? TURBO : 1) * dt, partes = Math.ceil(anda / 0.2) || 1;
      c.turbo = Math.max(0, c.turbo - dt);
      for (let n = 0; n < partes && !bateu[i]; n++) {          // em pedacos curtos, para nunca atravessar uma parede
        c.x += Math.cos(c.ang) * anda / partes; c.z += Math.sin(c.ang) * anda / partes;
        const cerca = Math.abs(c.x) > LX - BORDA || Math.abs(c.z) > LZ - BORDA;
        bateu[i] = cerca || (j.y < ALTURA_LIVRE && bateNaLuz(d, i, c.x, c.z));
      }
      const ultimo = pts.at(-1);
      if (pts.length < MAX_PONTOS && Math.hypot(c.x - ultimo.x, c.z - ultimo.z) >= PASSO) pts.push({ x: c.x, z: c.z });
      j.x = c.x; j.z = c.z;
      j.vx = Math.cos(c.ang) * 0.6; j.vz = Math.sin(c.ang) * 0.6;   // so para o boneco olhar para onde vai
    });

    p.jogadores.forEach((j, i) => {
      if (!bateu[i]) return;
      const c = d.cobras[i];
      elimina(p, j, 12); j.vx = -Math.cos(c.ang) * 5; j.vz = -Math.sin(c.ang) * 5;
      d.fx.push({ x: c.x, z: c.z, i });
      p.eventos.push('explosao');
      p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    });

    return quemSobrou(p) ?? (p.t >= LIMITE ? -1 : undefined);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); m.castShadow = false; grupo.add(m);
      return m;
    };
    const piso = caixa(LX * 2, 0.02, LZ * 2, 0x0b1026, 0, 0.01, 0, { roughness: 0.6 });          // chao escuro, para a luz aparecer
    piso.receiveShadow = true;
    for (let x = -LX + 1; x < LX; x += 2) caixa(0.05, 0.02, LZ * 2, 0x2ee6ff, x, 0.025, 0, { emissive: 0x2ee6ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.35 });
    for (let z = -LZ + 1; z < LZ; z += 2) caixa(LX * 2, 0.02, 0.05, 0x2ee6ff, 0, 0.025, z, { emissive: 0x2ee6ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.35 });

    // cerca eletrica: a faixa vermelha da borda e onde se morre
    pecas.cerca = [];
    const fio = { emissive: 0xff2a3d, emissiveIntensity: 1 };
    for (const s of [-1, 1]) {
      pecas.cerca.push(caixa(LX * 2, 0.14, BORDA, 0xff2a3d, 0, 0.07, s * (LZ - BORDA / 2), fio));
      pecas.cerca.push(caixa(BORDA, 0.14, LZ * 2, 0xff2a3d, s * (LX - BORDA / 2), 0.07, 0, fio));
    }
    // torres nos cantos com um anel que gira e uma lampada que pulsa
    pecas.aneis = []; pecas.lampadas = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (LX + 0.1), z = sz * (LZ + 0.1);
      caixa(0.7, 2.6, 0.7, 0x242a45, x, 1.3, z);
      const anel = malha(new THREE.TorusGeometry(0.75, 0.09, 8, 24), 0x2ee6ff, { emissive: 0x2ee6ff, emissiveIntensity: 0.9 });
      anel.position.set(x, 2.1, z); anel.rotation.x = Math.PI / 2; grupo.add(anel); pecas.aneis.push(anel);
      const lampada = malha(new THREE.SphereGeometry(0.4, 14, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
      lampada.position.set(x, 2.9, z); grupo.add(lampada); pecas.lampadas.push(lampada);
    }
    // marca de largada de cada um
    c.p.dados.cobras.forEach((cobra, i) => {
      const marca = malha(new THREE.RingGeometry(0.9, 1.15, 28), cores[i], { emissive: cores[i], emissiveIntensity: 0.7, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      marca.rotation.x = -Math.PI / 2; marca.position.set(cobra.x, 0.04, cobra.z); marca.castShadow = false; grupo.add(marca);
    });

    // paredes de luz: uma malha instanciada por jogador (um pedaco por segmento da trilha)
    const geo = new THREE.BoxGeometry(1, 0.6, 0.16); geo.translate(0, 0.32, 0);
    pecas.luz = cores.map(cor => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 1.1, roughness: 0.3 }), MAX_PONTOS);
      m.count = 0; m.frustumCulled = false; grupo.add(m);
      return m;
    });
    pecas.feitos = [0, 0];
    pecas.aux = { m: new THREE.Matrix4(), pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), eixo: new THREE.Vector3(0, 1, 0) };

    // cargas em cima da cabeca: 3 raios amarelos (turbo) e 1 seta branca (pulo)
    pecas.cargas = cores.map(() => {
      const g = new THREE.Group();
      for (let k = 0; k < CARGAS; k++) {
        const m = malha(new THREE.OctahedronGeometry(0.2), 0xffe14d, { emissive: 0xffc400, emissiveIntensity: 1 });
        m.position.set((k - 1) * 0.5, 0, 0); m.castShadow = false; g.add(m);
      }
      const seta = malha(new THREE.ConeGeometry(0.22, 0.45, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
      seta.position.set(0, 0.5, 0); seta.castShadow = false; g.add(seta);
      grupo.add(g);
      return g;
    });
  },

  desenha(c, dt, t) {
    const { pecas, cores, p } = c, d = p.dados, a = pecas.aux;
    const poe = (malha, n, de, ate) => {                       // estica o pedaco n da parede entre dois pontos
      const dx = ate.x - de.x, dz = ate.z - de.z;
      a.pos.set((de.x + ate.x) / 2, 0, (de.z + ate.z) / 2);
      a.q.setFromAxisAngle(a.eixo, -Math.atan2(dz, dx));
      a.s.set(Math.hypot(dx, dz) + 0.08, 1, 1);
      malha.setMatrixAt(n, a.m.compose(a.pos, a.q, a.s));
    };
    d.trilhas.forEach((pts, i) => {
      const luz = pecas.luz[i], cobra = d.cobras[i];
      for (let n = Math.max(0, pecas.feitos[i] - 1); n < pts.length - 1; n++) poe(luz, n, pts[n], pts[n + 1]);
      poe(luz, pts.length - 1, pts.at(-1), cobra);             // pedaco vivo, ate o boneco
      pecas.feitos[i] = pts.length; luz.count = pts.length;
      luz.instanceMatrix.needsUpdate = true;
      luz.material.emissiveIntensity = 0.95 + Math.sin(t * 6 + i * 2) * 0.25;

      const j = p.jogadores[i], g = pecas.cargas[i];
      g.visible = j.vivo;
      g.position.set(j.x, 2.5 + j.y + Math.sin(t * 5 + i) * 0.08, j.z);
      g.children.forEach((m, k) => { m.visible = k < CARGAS ? k < cobra.cargas : cobra.pulos > 0; m.rotation.y = t * 4; });
      if (j.vivo && cobra.turbo > 0) {                         // rastro de fogo do turbo
        c.particulas(j.x - Math.cos(cobra.ang) * 0.9, 0.5, j.z - Math.sin(cobra.ang) * 0.9, 0xffe14d, 2, 4);
        c.particulas(j.x, 0.4, j.z, cores[i], 1, 3);
      }
    });
    const pulso = 0.7 + Math.abs(Math.sin(t * 5)) * 0.6;
    for (const m of pecas.cerca) m.material.emissiveIntensity = pulso;
    pecas.aneis.forEach((m, k) => { m.rotation.z = t * 2 * (k % 2 ? 1 : -1); m.position.y = 2.1 + Math.sin(t * 2 + k) * 0.25; });
    pecas.lampadas.forEach((m, k) => { m.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 3 + k * 1.3)) * 0.8; });

    for (const f of d.fx.splice(0)) {
      c.particulas(f.x, 0.8, f.z, cores[f.i], 34, 12); c.particulas(f.x, 0.8, f.z, 0xffffff, 16, 9);
      c.som(90, 0.4, 'sawtooth', 0.25);
    }
  },
};
