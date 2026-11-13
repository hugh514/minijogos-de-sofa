// Tanques: arena vista de cima com blocos de cobertura. O tanque gira para onde anda, A atira um projétil que quica 1 vez.
// 3 vidas cada. Quem zerar a vida do outro vence; no tempo, quem tem mais vida. O próprio tiro não fere quem atirou.
import { posiciona, maiorPlacar, elimina, RAIO } from '../logica.mjs';

const LX = 11, LZ = 6.5, R_TIRO = 0.3, V_TIRO = 13, V_TANQUE = 7, GIRO = 14, ZONA_MORTA = 0.15;
const VIDAS = 3, RECARGA = 0.8, BUFFER = 0.25, T_IMUNE = 1.2, EMPURRAO = 9, T_TIRO = 6, LIMITE = 45;
const R_ACERTO = RAIO * 0.9 + R_TIRO;
const AMARELO = 0xffd23f;

// Blocos de cobertura (meia largura hx e meia profundidade hz). Simétricos, longe dos cantos de saída.
export const BLOCOS = [
  { x: 0, z: -3.3, hx: 1, hz: 1 }, { x: 0, z: 3.3, hx: 1, hz: 1 },
  { x: -4.8, z: 0, hx: 0.9, hz: 0.9 }, { x: 4.8, z: 0, hx: 0.9, hz: 0.9 },
];

// Empurra o círculo (a) para fora de qualquer bloco. Devolve o último bloco tocado (ou undefined).
function saiDosBlocos(a, raio) {
  let tocou;
  for (const b of BLOCOS) {
    const px = Math.max(b.x - b.hx, Math.min(b.x + b.hx, a.x)), pz = Math.max(b.z - b.hz, Math.min(b.z + b.hz, a.z));
    const dx = a.x - px, dz = a.z - pz, dist = Math.hypot(dx, dz);
    if (dist >= raio) continue;
    let nx, nz;
    if (dist > 1e-6) { nx = dx / dist; nz = dz / dist; a.x = px + nx * raio; a.z = pz + nz * raio; }
    else {                                       // centro dentro do bloco: sai pelo lado mais perto
      const ex = b.hx - Math.abs(a.x - b.x), ez = b.hz - Math.abs(a.z - b.z);
      if (ex < ez) { nx = Math.sign(a.x - b.x) || 1; nz = 0; a.x = b.x + nx * (b.hx + raio); }
      else { nx = 0; nz = Math.sign(a.z - b.z) || 1; a.z = b.z + nz * (b.hz + raio); }
    }
    tocou = { nx, nz };
  }
  return tocou;
}

const limita = (v, m) => Math.max(-m, Math.min(m, v));
const volta = a => Math.atan2(Math.sin(a), Math.cos(a));

// Um sub-passo do tiro: anda, quica (ou morre) na parede e no bloco, fere o tanque do outro.
function passoTiro(p, d, t, h) {
  t.idade += h;
  if (t.idade > T_TIRO) { t.vivo = false; return; }
  t.x += t.vx * h; t.z += t.vz * h;
  const bate = (nx, nz) => {                     // choque: quica se ainda pode, senão some
    d.fx.push({ x: t.x, z: t.z, cor: t.dono, tipo: 'quique' });
    p.eventos.push('batida');
    if (t.quica > 0) {
      t.quica--;
      const v = t.vx * nx + t.vz * nz;
      if (v < 0) { t.vx -= 2 * v * nx; t.vz -= 2 * v * nz; }
    } else t.vivo = false;
  };
  if (Math.abs(t.x) > LX - R_TIRO) { t.x = Math.sign(t.x) * (LX - R_TIRO); bate(-Math.sign(t.x), 0); }
  if (t.vivo && Math.abs(t.z) > LZ - R_TIRO) { t.z = Math.sign(t.z) * (LZ - R_TIRO); bate(0, -Math.sign(t.z)); }
  if (!t.vivo) return;
  const n = saiDosBlocos(t, R_TIRO);
  if (n) { bate(n.nx, n.nz); if (!t.vivo) return; }

  for (const [i, j] of p.jogadores.entries()) {
    if (i === t.dono || !j.vivo || d.imune[i] > 0 || Math.hypot(j.x - t.x, j.z - t.z) > R_ACERTO) continue;
    t.vivo = false;
    d.placar[i] = Math.max(0, d.placar[i] - 1);
    d.imune[i] = T_IMUNE;
    const len = Math.hypot(t.vx, t.vz) || 1;
    d.kb[i] = { x: t.vx / len * EMPURRAO, z: t.vz / len * EMPURRAO };
    d.fx.push({ x: j.x, z: j.z, cor: i, tipo: 'acerto' });
    p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    if (d.placar[i] <= 0) { elimina(p, j, 8); p.eventos.push('explosao'); d.aviso = 'DESTRUÍDO!'; d.avisoCor = '#ff4a4a'; d.avisoT = 1.5; }
    else p.eventos.push('batida');
    return;
  }
}

export default {
  id: 'tanques', nome: 'Tanques', dica: 'Ande com o tanque e atire com A. O tiro quica uma vez na parede. 3 vidas cada!',
  controle: { modo: 'padrao', a: 'ATIRAR', b: '' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'vidas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 8.5);
    p.dados = {
      placar: [VIDAS, VIDAS], ang: [0, Math.PI], cd: [0, 0], quer: [0, 0], imune: [0, 0], kb: [{ x: 0, z: 0 }, { x: 0, z: 0 }],
      disparos: [0, 0], tiros: [], fx: [], aviso: '', avisoT: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    p.jogadores.forEach((j, i) => {
      j.vx = 0; j.vz = 0;
      if (!j.vivo) return;
      d.cd[i] -= dt; d.quer[i] -= dt; d.imune[i] -= dt;
      const { x, y } = j.ent, mag = Math.hypot(x, y);
      let vx = 0, vz = 0;
      if (mag > ZONA_MORTA) {
        vx = x * V_TANQUE; vz = y * V_TANQUE;
        const dif = volta(Math.atan2(y, x) - d.ang[i]);
        d.ang[i] = volta(d.ang[i] + limita(dif, GIRO * dt));
      }
      const kb = d.kb[i], fator = Math.pow(0.02, dt);
      j.x += (vx + kb.x) * dt; j.z += (vz + kb.z) * dt;
      kb.x *= fator; kb.z *= fator;
      saiDosBlocos(j, RAIO);
      j.x = limita(j.x, LX - RAIO); j.z = limita(j.z, LZ - RAIO);

      if (j.apertouA > 0) d.quer[i] = BUFFER;    // toque guardado por um instante, se ainda estiver recarregando
      if (d.quer[i] > 0 && d.cd[i] <= 0) {
        d.quer[i] = 0; d.cd[i] = RECARGA; d.disparos[i]++;
        const dx = Math.cos(d.ang[i]), dz = Math.sin(d.ang[i]);
        const t = { x: j.x + dx * 1.1, z: j.z + dz * 1.1, vx: dx * V_TIRO, vz: dz * V_TIRO, dono: i, quica: 1, idade: 0, vivo: true };
        t.x = limita(t.x, LX - R_TIRO); t.z = limita(t.z, LZ - R_TIRO);
        d.tiros.push(t);
        d.fx.push({ x: t.x, z: t.z, cor: i, tipo: 'tiro' });
        p.eventos.push('dash');
      }
    });

    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / n;   // passos curtos: o tiro nunca atravessa nada
    for (let s = 0; s < n; s++) for (const t of d.tiros) if (t.vivo) passoTiro(p, d, t, h);
    d.tiros = d.tiros.filter(t => t.vivo);

    const [a, b] = d.placar;
    if (a <= 0 || b <= 0) return a <= 0 && b <= 0 ? -1 : a <= 0 ? 1 : 0;
    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0; pecas.tanques = [];

    // metades levemente tingidas com a cor do dono, para saber de quem é cada lado
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1;
      const tinta = malha(new THREE.BoxGeometry(3.4, 0.02, LZ * 2), cores[i], { transparent: true, opacity: 0.18 });
      tinta.position.set(lado * (LX - 1.7), 0.03, 0); tinta.castShadow = false; grupo.add(tinta);
    }
    const meio = malha(new THREE.BoxGeometry(0.12, 0.02, LZ * 2), 0x6b7799, { emissive: 0x6b7799, emissiveIntensity: 0.5 });
    meio.position.y = 0.04; meio.castShadow = false; grupo.add(meio);

    // blocos de cobertura
    for (const b of BLOCOS) {
      const corpo = malha(new THREE.BoxGeometry(b.hx * 2, 1.1, b.hz * 2), 0x56607f, { roughness: 0.6 });
      corpo.position.set(b.x, 0.55, b.z); grupo.add(corpo);
      const topo = malha(new THREE.BoxGeometry(b.hx * 2 + 0.1, 0.12, b.hz * 2 + 0.1), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.5 });
      topo.position.set(b.x, 1.14, b.z); topo.castShadow = false; grupo.add(topo);
    }

    // tanques low-poly
    for (const i of [0, 1]) {
      const cor = cores[i], g = new THREE.Group(), escuro = 0x1d2233;
      const casco = malha(new THREE.BoxGeometry(1.5, 0.5, 1.1), cor, { roughness: 0.5 }); casco.position.y = 0.45;
      const frente = malha(new THREE.BoxGeometry(0.5, 0.36, 0.9), cor, { roughness: 0.5 }); frente.position.set(0.55, 0.5, 0);
      const esteiraA = malha(new THREE.BoxGeometry(1.7, 0.4, 0.28), escuro), esteiraB = esteiraA.clone();
      esteiraA.position.set(0, 0.28, 0.62); esteiraB.position.set(0, 0.28, -0.62);
      const torre = malha(new THREE.CylinderGeometry(0.4, 0.46, 0.34, 8), cor, { roughness: 0.4 }); torre.position.y = 0.88;
      const canoGrupo = new THREE.Group(); canoGrupo.position.set(0.2, 0.9, 0);
      const cano = malha(new THREE.BoxGeometry(1.0, 0.17, 0.17), 0xe9edf7, { emissive: cor, emissiveIntensity: 0.2 });
      cano.position.x = 0.6; canoGrupo.add(cano);
      g.add(casco, frente, esteiraA, esteiraB, torre, canoGrupo);
      grupo.add(g); pecas.tanques.push({ g, cano });
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;

    p.jogadores.forEach((j, i) => {
      c.bonecos[i].visible = false;
      const { g, cano } = pecas.tanques[i];
      g.position.set(j.x, j.y, j.z);
      g.rotation.y = -d.ang[i];
      if (!j.vivo) { g.rotation.x += dt * 6; g.rotation.z += dt * 4; }
      g.visible = !j.vivo || !(d.imune[i] > 0 && Math.floor(t * 14) % 2 === 0);    // pisca depois de levar tiro
      const pronto = d.cd[i] <= 0;
      cano.material.emissiveIntensity = pronto ? 0.35 : 0;
    });

    // tiros com rastro (sem estado: pontinhos que encolhem para trás da velocidade)
    const ts = d.tiros;
    const ms = c.pool('tiros', ts.length, () => {
      const m = c.malha(new THREE.SphereGeometry(R_TIRO, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
      m.castShadow = false; return m;
    });
    const NR = 5;
    const rs = c.pool('rastro', ts.length * NR, () => {
      const m = c.malha(new THREE.SphereGeometry(R_TIRO, 8, 6), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1, transparent: true, opacity: 0.5 });
      m.castShadow = false; return m;
    });
    ts.forEach((s, k) => {
      const cor = c.cores[s.dono];
      ms[k].position.set(s.x, 0.8, s.z);
      ms[k].material.color.set(0xffffff); ms[k].material.emissive.set(cor);
      const len = Math.hypot(s.vx, s.vz) || 1;
      for (let r = 0; r < NR; r++) {
        const m = rs[k * NR + r], f = 1 - (r + 1) / (NR + 1);
        m.position.set(s.x - s.vx / len * (r + 1) * 0.4, 0.8, s.z - s.vz / len * (r + 1) * 0.4);
        m.scale.setScalar(f); m.material.color.set(cor); m.material.emissive.set(cor); m.material.opacity = 0.55 * f;
      }
    });

    // faíscas: tiro saindo, quique e acerto
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto], cor = c.cores[e.cor] ?? AMARELO;
      if (e.tipo === 'acerto') { c.particulas(e.x, 0.8, e.z, cor, 26, 10); c.particulas(e.x, 0.8, e.z, AMARELO, 12, 8); }
      else if (e.tipo === 'quique') c.particulas(e.x, 0.7, e.z, AMARELO, 8, 5);
      else c.particulas(e.x, 0.9, e.z, 0xffffff, 4, 3);
    }
  },
};
