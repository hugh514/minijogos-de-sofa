// Pula onda: o nucleo do centro solta aneis que varrem o chao. Quem estiver no chao quando o anel passa perde uma vida.
import { posiciona, quemSobrou, maiorPlacar, elimina, RAIO } from '../logica.mjs';

const R_NUCLEO = 1, LIMITE = 55, ALT_SALVA = 0.35, MEIA_FAIXA = 0.25, T_IMUNE = 1, T_DUPLA = 0.7, VIDAS = 2;
const COR_ONDA = 0x35e0ff, COR_DUPLA = 0xff4ad8;

const intervalo = t => Math.max(0.55, 2.6 - t * 0.045);   // os pulsos vem cada vez mais juntos
const velocidade = t => Math.min(12, 5 + t * 0.12);       // e cada vez mais rapidos

function solta(p, dupla) {
  p.dados.ondas.push({ r: R_NUCLEO, v: velocidade(p.t), dupla });
  p.eventos.push('dash');
}

export default {
  id: 'onda', nome: 'Pula onda', dica: 'B pula. Pule o anel que sai do centro! Cada um tem 2 vidas.',
  rotulo: 'vidas',

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    posiciona(p, 4.5);
    p.dados = { ondas: [], prox: 2.5, extra: 0, carga: 0, vidas: [VIDAS, VIDAS], placar: [VIDAS, VIDAS], imune: [0, 0], golpes: [] };
  },

  atualiza(p, dt) {
    const d = p.dados;

    p.jogadores.forEach((j, i) => {                 // o nucleo e solido: ninguem fica em cima dele
      d.imune[i] = Math.max(0, d.imune[i] - dt);
      const dist = Math.hypot(j.x, j.z), min = R_NUCLEO + RAIO;
      if (!j.vivo || dist >= min) return;
      if (dist === 0) j.x = i ? min : -min; else { j.x *= min / dist; j.z *= min / dist; }
    });

    d.prox -= dt;
    if (d.prox <= 0) {
      solta(p, false);
      d.prox = intervalo(p.t);
      if (p.t > 8 && p.rng() < Math.min(0.6, 0.1 + p.t * 0.012)) d.extra = T_DUPLA;   // pulso em dupla
    }
    if (d.extra > 0) { d.extra -= dt; if (d.extra <= 0) { d.extra = 0; solta(p, true); } }
    d.carga = Math.max(0, Math.min(1, 1 - d.prox / Math.min(1, intervalo(p.t))));     // o nucleo incha no ultimo segundo

    for (const o of d.ondas) {
      const antes = o.r;
      o.r += o.v * dt;
      p.jogadores.forEach((j, i) => {
        if (!j.vivo || d.imune[i] > 0 || j.y > ALT_SALVA) return;
        const dist = Math.hypot(j.x, j.z);
        if (dist < antes - MEIA_FAIXA || dist > o.r + MEIA_FAIXA) return;
        const nx = dist > 0 ? j.x / dist : i ? 1 : -1, nz = dist > 0 ? j.z / dist : 0;
        d.vidas[i]--; d.golpes.push({ x: j.x, z: j.z, quem: i });
        j.vx += nx * 10; j.vz += nz * 10;           // a onda joga o boneco para tras
        if (d.vidas[i] <= 0) { elimina(p, j, 12); p.eventos.push('explosao'); }
        else { d.imune[i] = T_IMUNE; j.vy = 5; p.eventos.push('batida'); }
        p.celular[i] = { vibra: (p.celular[i].vibra ?? 0) + 1 };
      });
    }
    d.ondas = d.ondas.filter(o => o.r < p.arena.raio + 0.3);

    d.placar = [...d.vidas];
    return quemSobrou(p) ?? (p.t >= LIMITE ? maiorPlacar(p) : undefined);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const base = malha(new THREE.CylinderGeometry(R_NUCLEO * 0.8, R_NUCLEO, 0.5, 28), 0x59627f); base.position.y = 0.25;
    pecas.nucleo = malha(new THREE.SphereGeometry(0.75, 24, 16), 0xffd84d, { emissive: 0xffa000, emissiveIntensity: 0.4 });
    pecas.nucleo.position.y = 1.1;
    grupo.add(base, pecas.nucleo);
    pecas.golpes = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, pool, pecas, cores, bonecos } = c, p = c.p, d = p.dados;

    // nucleo: incha, esquenta e treme antes de soltar a onda; fica rosa quando vem outra logo atras
    const k = d.extra > 0 ? 1 : d.carga, n = pecas.nucleo;
    n.scale.setScalar(0.75 + k * 0.7 + (k > 0.6 ? Math.sin(t * 50) * 0.04 : 0));
    n.material.color.set(d.extra > 0 ? COR_DUPLA : k > 0.6 ? 0xff5a2a : 0xffd84d);
    n.material.emissive.set(d.extra > 0 ? COR_DUPLA : 0xff5a00);
    n.material.emissiveIntensity = 0.3 + k * 1.4;

    // anel: uma faixa em pe (aparece desde pequeno) e um aro grosso rente ao chao
    const faixas = pool('faixas', d.ondas.length, () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.45, 72, 1, true),
        new THREE.MeshBasicMaterial({ color: COR_ONDA, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      m.position.y = 0.225; return m;
    });
    const aros = pool('aros', d.ondas.length, () => {
      const m = malha(new THREE.TorusGeometry(1, 0.05, 8, 72), COR_ONDA, { emissive: COR_ONDA, emissiveIntensity: 1.3 });
      m.rotation.x = Math.PI / 2; m.position.y = 0.15; return m;
    });
    d.ondas.forEach((o, i) => {
      const cor = o.dupla ? COR_DUPLA : COR_ONDA;
      faixas[i].scale.set(o.r, 1, o.r); faixas[i].material.color.set(cor);
      aros[i].scale.set(o.r, o.r, 3); aros[i].material.color.set(cor); aros[i].material.emissive.set(cor);
    });

    // vidas: bolinhas girando em volta de cada boneco; quem acabou de apanhar pisca
    const vidas = pool('vidas', 4, () => malha(new THREE.SphereGeometry(0.2, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
    p.jogadores.forEach((j, i) => {
      const b = bonecos[i];
      if (j.vivo) b.visible = !(d.imune[i] > 0 && Math.sin(t * 40) < 0);
      for (let v = 0; v < 2; v++) {
        const m = vidas[i * 2 + v], ang = t * 3 + v * Math.PI + i;
        m.visible = j.vivo && v < d.vidas[i];
        m.position.set(j.x + Math.cos(ang) * 1.2, RAIO + j.y, j.z + Math.sin(ang) * 1.2);
        m.material.color.set(cores[i]); m.material.emissive.set(cores[i]);
      }
    });

    for (; pecas.golpes < d.golpes.length; pecas.golpes++) {
      const g = d.golpes[pecas.golpes];
      c.particulas(g.x, 0.6, g.z, cores[g.quem], 18, 9);
    }
  },
};
