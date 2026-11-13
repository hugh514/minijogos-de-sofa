// Caca ao tesouro: um tesouro invisivel enterrado na areia. O celular de cada um vibra mais rapido quanto mais
// perto ELE esta, e a antena em cima do boneco pisca no mesmo ritmo (da para espionar o outro). A cava onde esta.
import { posiciona, maiorPlacar, pontoNoCirculo, RAIO } from '../logica.mjs';

const R_ARENA = 9, R_TESOURO = 6.8, ACHOU = 1.3, T_CAVA = 0.8, META = 3, TEMPO = 50, LONGE = 4, MAX_BURACOS = 30;

// segundos entre duas vibracoes: em cima do tesouro, 7 por segundo; do outro lado da ilha, 1 a cada 2 s
export function intervalo(dist) { return Math.min(2, 0.14 + dist * 0.17); }

function vibra(p, i) { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; }

function sorteia(p, antes) {
  let t = { x: 0, z: 0 };
  for (let k = 0; k < 30; k++) {
    t = pontoNoCirculo(p, R_TESOURO);
    const perto = p.jogadores.some(j => Math.hypot(j.x - t.x, j.z - t.z) < LONGE) || (antes && Math.hypot(antes.x - t.x, antes.z - t.z) < LONGE);
    if (!perto) break;
  }
  return t;
}

export default {
  id: 'detector', nome: 'Caça ao tesouro',
  dica: 'O celular vibra mais rápido perto do tesouro. Aperte CAVAR em cima dele! Primeiro a 3 vence.',
  controle: { modo: 'padrao', a: 'CAVAR', b: '' }, semDash: true, semPulo: true, rotulo: 'tesouros', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    posiciona(p, 5);
    p.dados = {
      placar: [0, 0], tesouro: null, buracos: [], baus: [], fx: [],
      pulso: [0.6, 0.6], desde: [9, 9], iv: [2, 2], cava: [0, 0], onde: [null, null], areia: [0, 0],
      aviso: '', avisoCor: '#ffd84d', tAviso: 0,
    };
    p.dados.tesouro = sorteia(p, null);
    for (const i of [0, 1]) p.celular[i] = { texto: 'Vibrou mais rápido? Está perto. Aperte CAVAR!', vibra: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tAviso -= dt;
    if (d.tAviso <= 0) d.aviso = '';
    for (const b of d.baus) b.t += dt;
    d.baus = d.baus.filter(b => b.t < 2);

    for (const [i, j] of p.jogadores.entries()) {
      // detector: vibra e pisca no ritmo da distancia
      const dist = Math.hypot(j.x - d.tesouro.x, j.z - d.tesouro.z);
      d.iv[i] = intervalo(dist);
      d.pulso[i] = Math.min(d.pulso[i] - dt, d.iv[i]);
      d.desde[i] += dt;
      if (d.pulso[i] <= 0) { d.pulso[i] = d.iv[i]; d.desde[i] = 0; vibra(p, i); }

      if (d.cava[i] > 0) {                                   // cavando: parado no lugar
        const o = d.onde[i];
        j.x = o.x; j.z = o.z; j.vx = j.vz = 0;
        d.cava[i] -= dt; d.areia[i] -= dt;
        if (d.areia[i] <= 0) { d.areia[i] = 0.18; d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: -1, q: 5, forca: 4 }); }
        if (d.cava[i] > 0) continue;
        d.buracos.push({ x: o.x, z: o.z, dono: i });
        if (d.buracos.length > MAX_BURACOS) d.buracos.shift();
        if (Math.hypot(o.x - d.tesouro.x, o.z - d.tesouro.z) < ACHOU) {
          d.placar[i]++;
          d.baus.push({ x: d.tesouro.x, z: d.tesouro.z, t: 0, dono: i });
          d.fx.push({ x: d.tesouro.x, y: 1, z: d.tesouro.z, cor: -2, q: 30, forca: 8 }, { x: d.tesouro.x, y: 1.4, z: d.tesouro.z, cor: i, q: 14, forca: 5 });
          p.eventos.push('moeda', 'gol');
          j.vy = 8; vibra(p, i);
          d.aviso = 'TESOURO!'; d.tAviso = 1.1;
          if (d.placar[i] >= META) return i;
          d.tesouro = sorteia(p, d.tesouro);
          d.pulso = [0.5, 0.5];
        } else {
          p.eventos.push('batida');
          d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: -1, q: 10, forca: 3 });
        }
      } else if (j.apertouA && j.vivo) {
        d.cava[i] = T_CAVA; d.onde[i] = { x: j.x, z: j.z }; d.areia[i] = 0;
        j.vx = j.vz = 0;
        p.eventos.push('dash');
      }
    }
    if (p.t >= TEMPO) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const plano = (geo, cor, y, extra) => {
      const m = malha(geo, cor, { roughness: 1, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m); return m;
    };
    // ilha de areia cercada de mar
    plano(new THREE.CircleGeometry(R_ARENA, 64), 0xecd08a, 0.03);
    for (let k = 0; k < 14; k++) {                           // manchas de areia mais escura e mais clara
      const ang = k * 2.4, r = 1.5 + (k * 1.37) % 6.2;
      plano(new THREE.CircleGeometry(0.5 + (k % 3) * 0.3, 14), k % 2 ? 0xdcbb70 : 0xf6e2a6, 0.04).position.set(Math.cos(ang) * r, 0.04, Math.sin(ang) * r);
    }
    plano(new THREE.RingGeometry(R_ARENA + 0.2, R_ARENA + 6, 64), 0x1fa3d6, -0.02, { emissive: 0x0b5f8a, emissiveIntensity: 0.5, roughness: 0.3, side: THREE.DoubleSide });
    pecas.ondas = [0, 1].map(() => plano(new THREE.RingGeometry(R_ARENA + 0.3, R_ARENA + 0.65, 64), 0xffffff, 0.0,
      { transparent: true, opacity: 0.6, emissive: 0xffffff, emissiveIntensity: 0.5, side: THREE.DoubleSide }));

    // palmeiras atras e dos lados, fora da arena (nao tapam a visao)
    pecas.copas = [];
    for (let k = 0; k < 6; k++) {
      const ang = -Math.PI * (0.08 + k * 0.168), r = R_ARENA + 1.3 + (k % 2) * 0.7, h = 3 + (k % 3) * 0.5;
      const g = new THREE.Group(); g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      const tronco = malha(new THREE.CylinderGeometry(0.16, 0.28, h, 8), 0x9a6a3a); tronco.position.y = h / 2;
      const copa = new THREE.Group(); copa.position.y = h;
      for (let f = 0; f < 6; f++) {
        const folha = malha(new THREE.SphereGeometry(1, 8, 6), f % 2 ? 0x2fae58 : 0x35c26b);
        const a = f * Math.PI / 3;
        folha.scale.set(1.1, 0.07, 0.36); folha.position.set(Math.cos(a) * 0.95, -0.12, Math.sin(a) * 0.95);
        folha.rotation.y = -a; folha.rotation.z = -0.35;
        copa.add(folha);
      }
      for (let n = 0; n < 2; n++) { const coco = malha(new THREE.SphereGeometry(0.2, 8, 6), 0x5a3a1c); coco.position.set(n ? 0.22 : -0.2, -0.22, n ? 0.1 : -0.12); copa.add(coco); }
      g.add(tronco, copa); g.rotation.z = (k % 2 ? 1 : -1) * 0.08; grupo.add(g); pecas.copas.push(copa);
    }
    // pedras, conchas e estrelas do mar na beirada (so enfeite)
    for (let k = 0; k < 7; k++) {
      const ang = 0.5 + k * 0.9, r = 7.9 + (k % 2) * 0.5, s = 0.3 + (k % 3) * 0.12;
      const pedra = malha(new THREE.DodecahedronGeometry(s), k % 2 ? 0x8d9199 : 0xa7abb3, { roughness: 1 });
      pedra.position.set(Math.cos(ang) * r, s * 0.5, Math.sin(ang) * r); pedra.rotation.set(k, k * 2, 0); grupo.add(pedra);
    }
    for (let k = 0; k < 8; k++) {
      const ang = 0.2 + k * 0.79, r = 5.6 + (k * 0.83) % 2.4, estrela = k % 2 === 0;
      const m = malha(estrela ? new THREE.CylinderGeometry(0.3, 0.3, 0.06, 5) : new THREE.ConeGeometry(0.2, 0.3, 8), estrela ? 0xff7a2f : 0xffd9e6, { roughness: 0.6 });
      m.position.set(Math.cos(ang) * r, estrela ? 0.07 : 0.14, Math.sin(ang) * r); m.rotation.y = k; m.castShadow = false; grupo.add(m);
    }
    // caranguejo que passeia pela beirada
    pecas.siri = new THREE.Group();
    const casco = malha(new THREE.SphereGeometry(0.3, 12, 8), 0xe5352b, { emissive: 0x7a1010, emissiveIntensity: 0.4 }); casco.scale.y = 0.55;
    pecas.siri.add(casco);
    pecas.garras = [-1, 1].map(s => { const g = malha(new THREE.SphereGeometry(0.13, 8, 6), 0xff5a4a); g.position.set(0.2, 0.12, s * 0.3); pecas.siri.add(g); return g; });
    grupo.add(pecas.siri);

    // antena detectora, radar no chao e pa de cada jogador
    pecas.kit = [0, 1].map(i => {
      const antena = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), 0xdddddd); haste.position.y = 0.4;
      const luz = malha(new THREE.SphereGeometry(0.24, 14, 10), cores[i], { emissive: cores[i], emissiveIntensity: 0.2 }); luz.position.y = 0.9;
      antena.add(haste, luz);
      const radar = plano(new THREE.RingGeometry(0.85, 1, 32), cores[i], 0.07, { transparent: true, opacity: 0, emissive: cores[i], emissiveIntensity: 1, side: THREE.DoubleSide, depthWrite: false });
      const pa = new THREE.Group();
      const cabo = malha(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), 0x8a5a2b); cabo.position.y = 0.75;
      const lamina = malha(new THREE.BoxGeometry(0.42, 0.5, 0.06), 0xc8ccd4, { metalness: 0.6, roughness: 0.3 }); lamina.position.y = 0.2;
      pa.add(cabo, lamina);
      grupo.add(antena, pa);
      return { antena, luz, radar, pa };
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, cores, p } = c, d = p.dados;
    pecas.ondas.forEach((m, k) => { const s = 1 + 0.035 * (0.5 + 0.5 * Math.sin(t * 1.3 + k * Math.PI)); m.scale.set(s, s, 1); m.material.opacity = 0.25 + 0.35 * (0.5 + 0.5 * Math.cos(t * 1.3 + k * Math.PI)); });
    pecas.copas.forEach((copa, k) => { copa.rotation.z = 0.07 * Math.sin(t * 1.4 + k); copa.rotation.y = 0.2 * Math.sin(t * 0.6 + k * 2); });
    const as = -0.6 + 0.5 * Math.sin(t * 0.35);              // o caranguejo anda de lado pela frente da ilha
    pecas.siri.position.set(Math.cos(as + Math.PI / 2) * 8.3, 0.2 + 0.04 * Math.abs(Math.sin(t * 9)), Math.sin(as + Math.PI / 2) * 8.3);
    pecas.siri.rotation.y = -as;
    pecas.garras.forEach((g, k) => { g.position.y = 0.14 + 0.08 * Math.sin(t * 6 + k * 2); });

    for (const i of [0, 1]) {
      const j = p.jogadores[i], { antena, luz, radar, pa } = pecas.kit[i];
      const k = Math.max(0, 1 - d.desde[i] / Math.min(0.5, d.iv[i] * 0.6));     // 1 no instante do pulso, apaga ate o proximo
      antena.visible = j.vivo;
      antena.position.set(j.x, RAIO * 2 + j.y - 0.1, j.z);
      luz.material.emissiveIntensity = 0.15 + k * 2.2;
      luz.scale.setScalar(1 + k * 0.7);
      const s = 1 + (1 - k) * 1.6;
      radar.position.set(j.x, 0.07, j.z); radar.scale.set(s, s, 1); radar.material.opacity = k * 0.8;
      pa.visible = d.cava[i] > 0;
      if (pa.visible) {
        const fase = Math.sin(t * 22);
        pa.position.set(j.x + (i ? -0.95 : 0.95), 0.25 + 0.3 * Math.max(0, fase), j.z + 0.3);
        pa.rotation.z = (i ? -1 : 1) * (0.5 + 0.35 * fase);
      }
    }

    const buracos = c.pool('buracos', d.buracos.length, () => {
      const g = new THREE.Group();
      const fundo = c.malha(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 18), 0x4a3216, { roughness: 1 }); fundo.castShadow = false;
      const monte = c.malha(new THREE.TorusGeometry(0.68, 0.13, 6, 18), 0xcfa85c, { roughness: 1 }); monte.rotation.x = Math.PI / 2;
      g.add(fundo, monte); return g;
    });
    d.buracos.forEach((b, n) => {
      buracos[n].position.set(b.x, 0.06, b.z);
      buracos[n].children[1].material.color.set(0xcfa85c).lerp(new THREE.Color(cores[b.dono]), 0.45);
    });

    const baus = c.pool('baus', d.baus.length, () => {
      const g = new THREE.Group();
      const caixa = c.malha(new THREE.BoxGeometry(1.2, 0.7, 0.8), 0x9a5a22);
      const tampa = c.malha(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI), 0xb06a2a); tampa.rotation.set(0, 0, Math.PI / 2); tampa.position.y = 0.35;
      const faixa = c.malha(new THREE.BoxGeometry(0.22, 0.86, 0.84), 0xffd84d, { emissive: 0xffc531, emissiveIntensity: 0.8, metalness: 0.6 }); faixa.position.y = 0.06;
      const ouro = c.malha(new THREE.SphereGeometry(0.34, 12, 8), 0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 1.4 }); ouro.position.y = 1;
      g.add(caixa, tampa, faixa, ouro); return g;
    });
    d.baus.forEach((b, n) => {
      const sobe = Math.min(1, b.t / 0.45), some = Math.max(0, (b.t - 1.6) / 0.4);
      baus[n].position.set(b.x, -0.6 + sobe * 1.9 + 0.15 * Math.sin(t * 6), b.z);
      baus[n].rotation.y = b.t * 3;
      baus[n].scale.setScalar(Math.max(0.01, (0.4 + 0.6 * sobe) * (1 - some)));
    });

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor === -1 ? 0xe2c074 : f.cor === -2 ? 0xffd84d : cores[f.cor], f.q, f.forca);
    }
  },
};
