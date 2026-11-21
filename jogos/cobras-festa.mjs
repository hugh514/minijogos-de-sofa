// Trilha de luz na festa (todos contra todos ou times). Versao para 2 a 4 da Trilha de luz: todos andam sozinhos ao mesmo tempo
// e o joystick so vira. Cada um deixa uma parede de luz que fica na arena ate o fim da queda. Bater em qualquer luz, na cerca
// ou de frente em outro tira da queda. Quem sobra por ultimo (em times, a dupla que ainda tem alguem) leva a queda; se os
// ultimos batem juntos, ninguem leva. Melhor de 3: quem leva 2 quedas vence; no fim do tempo, quem tem mais quedas.
// A: turbo (3 cargas por queda). B: pulo por cima de uma parede (1 por queda). A velocidade sobe com o tempo da rodada.
import { timeDe, elimina, quem } from '../logica.mjs';

export const LX = 11, LZ = 8, BORDA = 0.5, LIMITE = 50, QUEDAS = 2, CARGAS = 3, PASSO = 0.4, FOLGA = 0.3;
export const T_LARGADA = 1, T_FIM_QUEDA = 1;
const V0 = 3, ACELERA = 0.08, GIRO = 4, TURBO = 1.7, T_TURBO = 1, PULO = 9, ALTURA_LIVRE = 0.35;
const CABECAS = 0.9;         // distancia entre duas cabecas que conta como batida de frente
const IGNORA = 8;            // os ultimos pontos da propria trilha nao contam (senao bateria na parede que acabou de soltar)
const MAX_PONTOS = 500;      // uns 200 m de luz por jogador: mais que uma queda inteira
// Cada um numa linha so sua (ninguem larga de frente para outro); J1 e J3 na esquerda, J2 e J4 na direita.
const LARGADAS = [[-9, -5.6, 0], [9, 5.6, Math.PI], [-9, 1.9, 0], [9, -1.9, Math.PI]];
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);
const nomeDe = (p, k) => (p.modo === 'times' ? NOMES_TIMES[k] : quem(p, k));

// Distancia do ponto (x, z) ao segmento a-b.
export function distSeg(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  const u = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
  return Math.hypot(x - a.x - dx * u, z - a.z - dz * u);
}

function bateNaLuz(d, i, x, z) {
  for (let k = 0; k < d.trilhas.length; k++) {
    const pts = d.trilhas[k], fim = k === i ? pts.length - IGNORA : pts.length;
    for (let n = 1; n < fim; n++) if (distSeg(x, z, pts[n - 1], pts[n]) < FOLGA) return true;
    if (k !== i && pts.length && distSeg(x, z, pts.at(-1), d.cobras[k]) < FOLGA) return true;   // pedaco ainda nao guardado, ate a cabeca do outro
  }
  return false;
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((j, i) => {
    const c = d.cobras[i];
    const t = fim ? fim[i] : !j.vivo ? 'Você bateu! Espere a próxima queda' : `Quedas: ${d.placar[de(i)]} de ${QUEDAS}. Turbo: ${c.cargas}. Pulo: ${c.pulos}`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Poe todos de pe na linha de largada, com cargas novas e a arena limpa.
function larga(p) {
  const d = p.dados;
  d.cobras = p.jogadores.map((_, i) => { const [x, z, ang] = LARGADAS[i]; return { x, z, ang, turbo: 0, cargas: CARGAS, pulos: 1 }; });
  d.trilhas = d.cobras.map(c => [{ x: c.x, z: c.z }]);
  p.jogadores.forEach((j, i) => { const c = d.cobras[i]; Object.assign(j, { vivo: true, x: c.x, z: c.z, y: 0, vy: 0, vx: Math.cos(c.ang) * 0.6, vz: 0 }); });
  d.espera = T_LARGADA; d.fimQueda = 0;
  d.aviso = 'Queda ' + d.queda; d.avisoCor = '#9ff3ff';
  celulares(p);
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : nomeDe(p, v) + ' venceu!'; d.avisoCor = '#ffd23f';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

function noTempo(p) {
  if (p.t < LIMITE) return;
  const pl = p.dados.placar, maior = Math.max(...pl), lideres = pl.flatMap((v, k) => (v === maior ? [k] : []));
  return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
}

export default {
  id: 'cobras-festa', genero: 'reflexo', nome: 'Trilha de luz na festa',
  dica: 'Só vire: quem bate na luz ou na cerca sai, e vence quem sobrar por último em 2 quedas.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Turbo', b: 'Pulo' }, semMovimento: true, semDash: true, semPulo: true,
  rotulo: 'quedas', duracao: LIMITE, tema: 2,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    p.dados = { cobras: [], trilhas: [], placar: Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0), queda: 1, espera: 0, fimQueda: 0, fx: [], aviso: '', avisoCor: '#9ff3ff' };
    larga(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, de = dono(p);
    dt = Math.min(dt, 0.05);
    if (d.fimQueda > 0 || d.espera > 0) js.forEach((j, i) => { if (j.vivo) { j.x = d.cobras[i].x; j.z = d.cobras[i].z; } });       // parado de verdade: o motor ainda desliza com a velocidade de enfeite
    if (d.fimQueda > 0) {                                      // a queda acabou: um instante para ver quem sobrou, e larga a proxima
      d.fimQueda -= dt;
      if (d.fimQueda <= 0) { d.queda++; larga(p); }
      return noTempo(p);
    }
    if (d.espera > 0) {                                        // largada: todos parados, olhando para onde vao
      d.espera -= dt;
      if (d.espera <= 0) d.aviso = '';
      return noTempo(p);
    }
    const base = V0 + ACELERA * p.t, bateu = js.map(() => false);

    js.forEach((j, i) => {
      const c = d.cobras[i], pts = d.trilhas[i];
      if (!j.vivo) return;
      if (j.apertouA && c.cargas > 0 && c.turbo <= 0) { c.cargas--; c.turbo = T_TURBO; p.eventos.push('dash'); }
      if (j.apertouB && c.pulos > 0 && j.y === 0) { c.pulos--; j.vy = PULO; p.eventos.push('pulo'); }

      if (Math.hypot(j.ent.x, j.ent.y) > 0.3) {                // vira aos poucos para o lado do joystick
        const alvo = Math.atan2(j.ent.y, j.ent.x) - c.ang, dif = Math.atan2(Math.sin(alvo), Math.cos(alvo));
        c.ang += Math.max(-GIRO * dt, Math.min(GIRO * dt, dif));
      }
      const anda = base * (c.turbo > 0 ? TURBO : 1) * dt, partes = Math.ceil(anda / 0.2) || 1;
      c.turbo = Math.max(0, c.turbo - dt);
      for (let n = 0; n < partes && !bateu[i]; n++) {          // em pedacos curtos, para nunca atravessar uma parede
        c.x += Math.cos(c.ang) * anda / partes; c.z += Math.sin(c.ang) * anda / partes;
        bateu[i] = Math.abs(c.x) > LX - BORDA || Math.abs(c.z) > LZ - BORDA || (j.y < ALTURA_LIVRE && bateNaLuz(d, i, c.x, c.z));
      }
      const ultimo = pts.at(-1);
      if (Math.hypot(c.x - ultimo.x, c.z - ultimo.z) >= PASSO) { pts.push({ x: c.x, z: c.z }); if (pts.length > MAX_PONTOS) pts.shift(); }
      j.x = c.x; j.z = c.z;
      j.vx = Math.cos(c.ang) * 0.6; j.vz = Math.sin(c.ang) * 0.6;   // so para o boneco olhar para onde vai
    });

    for (let a = 0; a < js.length; a++) for (let b = a + 1; b < js.length; b++)       // de cabeca um no outro: os dois batem (sem depender de quem anda primeiro)
      if (js[a].vivo && js[b].vivo && Math.hypot(d.cobras[a].x - d.cobras[b].x, d.cobras[a].z - d.cobras[b].z) < CABECAS) bateu[a] = bateu[b] = true;

    js.forEach((j, i) => {
      if (!bateu[i]) return;
      const c = d.cobras[i];
      elimina(p, j, 12); j.vx = -Math.cos(c.ang) * 5; j.vz = -Math.sin(c.ang) * 5;
      d.fx.push({ x: c.x, z: c.z, i });
      p.eventos.push('explosao');
      p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    });

    const vivos = [...new Set(js.flatMap((j, i) => (j.vivo ? [de(i)] : [])))];
    if (vivos.length <= 1) {                                   // a queda acabou: quem sobrou leva; se ninguem sobrou, ninguem leva
      const k = vivos[0];
      if (k !== undefined) { d.placar[k]++; p.eventos.push('ponto'); }
      if (k !== undefined && d.placar[k] >= QUEDAS) return fechaComo(p, k);
      d.aviso = k === undefined ? 'Ninguém sobrou!' : nomeDe(p, k) + ' venceu a queda!'; d.avisoCor = '#ffd23f';
      d.fimQueda = T_FIM_QUEDA;
    }
    celulares(p);
    return noTempo(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); m.castShadow = false; grupo.add(m);
      return m;
    };
    const piso = caixa(LX * 2, 0.02, LZ * 2, 0x0b1026, 0, 0.01, 0, { roughness: 0.6 });          // chao escuro, para a luz aparecer
    piso.receiveShadow = true;
    const fio = { emissive: 0x9fb4d8, emissiveIntensity: 0.5, transparent: true, opacity: 0.3 };
    for (let x = -LX + 1; x < LX; x += 2) caixa(0.05, 0.02, LZ * 2, 0x9fb4d8, x, 0.025, 0, fio);
    for (let z = -LZ + 1; z < LZ; z += 2) caixa(LX * 2, 0.02, 0.05, 0x9fb4d8, 0, 0.025, z, fio);

    // cerca eletrica: a faixa vermelha da borda e onde se bate
    pecas.cerca = [];
    const choque = { emissive: 0xff2a3d, emissiveIntensity: 1 };
    for (const s of [-1, 1]) {
      pecas.cerca.push(caixa(LX * 2, 0.14, BORDA, 0xff2a3d, 0, 0.07, s * (LZ - BORDA / 2), choque));
      pecas.cerca.push(caixa(BORDA, 0.14, LZ * 2, 0xff2a3d, s * (LX - BORDA / 2), 0.07, 0, choque));
    }
    // torres nos cantos com um anel que gira e uma lampada que pulsa
    pecas.aneis = []; pecas.lampadas = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (LX + 0.1), z = sz * (LZ + 0.1);
      caixa(0.7, 2.6, 0.7, 0x242a45, x, 1.3, z);
      const anel = malha(new THREE.TorusGeometry(0.75, 0.09, 8, 24), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
      anel.position.set(x, 2.1, z); anel.rotation.x = Math.PI / 2; grupo.add(anel); pecas.aneis.push(anel);
      const lampada = malha(new THREE.SphereGeometry(0.4, 14, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
      lampada.position.set(x, 2.9, z); grupo.add(lampada); pecas.lampadas.push(lampada);
    }
    // marca de largada de cada um, na cor do dono (ou do time)
    p.jogadores.forEach((_, i) => {
      const cor = corDe(c, i), [x, z] = LARGADAS[i];
      const marca = malha(new THREE.RingGeometry(0.9, 1.15, 28), cor, { emissive: cor, emissiveIntensity: 0.7, side: THREE.DoubleSide });
      marca.rotation.x = -Math.PI / 2; marca.position.set(x, 0.04, z); marca.castShadow = false; grupo.add(marca);
    });

    // paredes de luz: uma malha instanciada por jogador (um pedaco por segmento da trilha)
    const geo = new THREE.BoxGeometry(1, 0.6, 0.18); geo.translate(0, 0.32, 0);
    pecas.luz = p.jogadores.map((_, i) => {
      const cor = corDe(c, i);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 1.1, roughness: 0.3 }), MAX_PONTOS + 2);
      m.count = 0; m.frustumCulled = false; grupo.add(m);
      return m;
    });
    pecas.aux = { m: new THREE.Matrix4(), pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), eixo: new THREE.Vector3(0, 1, 0) };

    // cargas em cima da cabeca: 3 raios amarelos (turbo) e 1 seta branca (pulo)
    pecas.cargas = p.jogadores.map(() => {
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
    const { pecas, p } = c, d = p.dados, a = pecas.aux;
    const poe = (malha, n, de, ate) => {                       // estica o pedaco n da parede entre dois pontos
      const dx = ate.x - de.x, dz = ate.z - de.z;
      a.pos.set((de.x + ate.x) / 2, 0, (de.z + ate.z) / 2);
      a.q.setFromAxisAngle(a.eixo, -Math.atan2(dz, dx));
      a.s.set(Math.hypot(dx, dz) + 0.08, 1, 1);
      malha.setMatrixAt(n, a.m.compose(a.pos, a.q, a.s));
    };
    d.trilhas.forEach((pts, i) => {
      const luz = pecas.luz[i], cobra = d.cobras[i], j = p.jogadores[i], g = pecas.cargas[i];
      for (let n = 0; n < pts.length - 1; n++) poe(luz, n, pts[n], pts[n + 1]);
      poe(luz, pts.length - 1, pts.at(-1), cobra);             // pedaco vivo, ate o boneco
      luz.count = pts.length;
      luz.instanceMatrix.needsUpdate = true;
      luz.material.emissiveIntensity = 0.95 + Math.sin(t * 6 + i * 2) * 0.25;

      c.bonecos[i].visible = c.bonecos[i].position.y > -12;
      g.visible = j.vivo;
      g.position.set(j.x, 2.5 + j.y + Math.sin(t * 5 + i) * 0.08, j.z);
      g.children.forEach((m, k) => { m.visible = k < CARGAS ? k < cobra.cargas : cobra.pulos > 0; m.rotation.y = t * 4; });
      if (j.vivo && cobra.turbo > 0) {                         // rastro de fogo do turbo
        c.particulas(j.x - Math.cos(cobra.ang) * 0.9, 0.5, j.z - Math.sin(cobra.ang) * 0.9, 0xffe14d, 2, 4);
        c.particulas(j.x, 0.4, j.z, corDe(c, i), 1, 3);
      }
    });
    const pulso = 0.7 + Math.abs(Math.sin(t * 5)) * 0.6;
    for (const m of pecas.cerca) m.material.emissiveIntensity = pulso;
    pecas.aneis.forEach((m, k) => { m.rotation.z = t * 2 * (k % 2 ? 1 : -1); m.position.y = 2.1 + Math.sin(t * 2 + k) * 0.25; });
    pecas.lampadas.forEach((m, k) => { m.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 3 + k * 1.3)) * 0.8; });

    for (const f of d.fx.splice(0)) {
      c.particulas(f.x, 0.8, f.z, corDe(c, f.i), 34, 12); c.particulas(f.x, 0.8, f.z, 0xffffff, 16, 9);
      c.som(90, 0.4, 'sawtooth', 0.25);
    }
  },
};
