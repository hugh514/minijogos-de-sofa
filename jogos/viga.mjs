// A viga: os dois carregam uma viga por um caminho suspenso. Quem pisa fora derruba a viga: os dois voltam
// para a ultima curva e o outro vai na frente. So um cabe na meta; no fim do tempo vence quem esta na frente.
import { RAIO } from '../logica.mjs';

const VIGA = 4, H = 2.1, FOLGA = 0.15, LIMITE = 50, R_META = 0.9, TOQUE = RAIO + 0.5, T_VOLTA = 1;
const PTS = [[-7.6, -5.8], [8, -5.8], [8, 0], [-8, 0], [-8, 5.8], [8, 5.8]];      // caminho em zigue-zague
const SAIDA = { x: PTS[0][0], z: PTS[0][1], r: 2.7 }, META = { x: PTS[5][0], z: PTS[5][1] };

function distTrecho(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, comp = dx * dx + dz * dz;
  const k = comp ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / comp)) : 0;
  return Math.hypot(x - ax - dx * k, z - az - dz * k);
}

// Quanto do caminho ja foi andado ate o ponto mais perto de (x, z).
export function progresso(x, z) {
  let melhor = Infinity, prog = 0, soma = 0;
  for (let i = 0; i < PTS.length - 1; i++) {
    const [ax, az] = PTS[i], [bx, bz] = PTS[i + 1], comp = Math.hypot(bx - ax, bz - az);
    const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (comp * comp)));
    const dist = distTrecho(x, z, PTS[i], PTS[i + 1]);
    if (dist < melhor - 1e-9) { melhor = dist; prog = soma + k * comp; }
    soma += comp;
  }
  return prog;
}

// Fim do tempo: vence quem esta mais adiante no caminho.
function porProgresso(p) {
  const [pa, pb] = p.jogadores.map(j => progresso(j.x, j.z));
  return Math.abs(pa - pb) < 0.5 ? -1 : pa > pb ? 0 : 1;
}

// Os dois voltam para a curva cp, alinhados com o trecho seguinte; "frente" fica 4 passos adiante.
function volta(p, frente) {
  const d = p.dados, [ax, az] = PTS[d.cp], [bx, bz] = PTS[d.cp + 1], comp = Math.hypot(bx - ax, bz - az);
  const pos = [{ x: ax, z: az }, { x: ax, z: az }];
  pos[frente] = { x: ax + (bx - ax) / comp * VIGA, z: az + (bz - az) / comp * VIGA };
  d.volta = pos; d.tVolta = T_VOLTA;
}

export function temChao(x, z) {
  if (Math.hypot(x - SAIDA.x, z - SAIDA.z) <= SAIDA.r + FOLGA) return true;
  for (let i = 0; i < PTS.length - 1; i++) if (distTrecho(x, z, PTS[i], PTS[i + 1]) <= H + FOLGA) return true;
  return false;
}

export default {
  id: 'viga', genero: 'equilibrio', nome: 'A viga', dica: 'Levem a viga juntos pelo caminho. Quem pisar fora volta atrás. O primeiro a encostar na meta vence!',
  controle: { modo: 'padrao', a: '', b: '' }, semPulo: true, semDash: true, duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 9, parede: false };
    const [a, b] = p.jogadores;
    a.x = b.x = SAIDA.x; a.z = SAIDA.z - VIGA / 2; b.z = SAIDA.z + VIGA / 2;
    for (const j of p.jogadores) j.turbo = 0.6;
    p.dados = { aviso: '', avisoCor: '#ffd84d', tAviso: 1.8, cp: 0, quedas: 0, tVolta: 0, volta: null, fx: [] };
  },

  atualiza(p, dt) {
    const d = p.dados, [a, b] = p.jogadores;

    if (d.tVolta > 0) {                           // viga caiu: os dois ficam parados no lugar da volta
      d.tVolta -= dt;
      p.jogadores.forEach((j, i) => Object.assign(j, d.volta[i], { vx: 0, vz: 0, vy: 0, y: 0 }));
      if (d.tVolta <= 0) d.aviso = '';
      return p.t > LIMITE ? porProgresso(p) : undefined;
    }

    // a viga e rigida: os dois sao puxados igualmente para ficarem sempre a mesma distancia
    let dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
    if (dist < 1e-6) { dx = 0; dz = 1; dist = 1; }
    const nx = dx / dist, nz = dz / dist, sobra = (dist - VIGA) / 2;
    a.x += nx * sobra; a.z += nz * sobra; b.x -= nx * sobra; b.z -= nz * sobra;
    const rel = ((b.vx - a.vx) * nx + (b.vz - a.vz) * nz) / 2;
    a.vx += nx * rel; a.vz += nz * rel; b.vx -= nx * rel; b.vz -= nz * rel;

    const naMeta = p.jogadores.map(j => Math.hypot(j.x - META.x, j.z - META.z));
    for (const i of naMeta[0] <= naMeta[1] ? [0, 1] : [1, 0])
      if (naMeta[i] < TOQUE) { p.eventos.push('gol'); return i; }

    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;  // curva alcancada vira ponto de volta
    for (let k = d.cp + 1; k < PTS.length - 1; k++) if (Math.hypot(mx - PTS[k][0], mz - PTS[k][1]) < H) d.cp = k;

    const caiu = p.jogadores.findIndex(j => !temChao(j.x, j.z));
    if (caiu >= 0) {                              // um pisou fora: a viga cai, os dois voltam e o outro vai na frente
      const j = p.jogadores[caiu];
      d.quedas++; d.fx.push({ x: j.x, z: j.z });
      volta(p, 1 - caiu);
      d.aviso = `Caiu! Jogador ${2 - caiu} vai na frente`; d.avisoCor = '#ff8a3d';
      p.eventos.push('queda');
      for (const i of [0, 1]) p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
      return;
    }

    if (Math.min(...naMeta) < 6 && d.tAviso > 0) { d.tAviso -= dt; d.aviso = d.tAviso > 0 ? 'Só cabe um!' : ''; }
    if (p.t > LIMITE) return porProgresso(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    for (const m of grupo.children) { m.position.y -= 4; m.material?.color?.set(0x0e1118); }   // o chao padrao vira o fundo do abismo
    const COR = 0x5b6ea8, ALT = 0.6;
    for (let i = 0; i < PTS.length - 1; i++) {
      const [ax, az] = PTS[i], [bx, bz] = PTS[i + 1], comp = Math.hypot(bx - ax, bz - az);
      const trecho = malha(new THREE.BoxGeometry(comp, ALT, H * 2), COR);
      trecho.position.set((ax + bx) / 2, -ALT / 2, (az + bz) / 2); trecho.rotation.y = -Math.atan2(bz - az, bx - ax);
      const faixa = malha(new THREE.BoxGeometry(comp, 0.02, 0.18), 0xdfe6f5, { transparent: true, opacity: 0.5 });   // risco no meio do caminho
      faixa.position.set((ax + bx) / 2, 0.012, (az + bz) / 2); faixa.rotation.y = trecho.rotation.y;
      grupo.add(trecho, faixa);
    }
    for (const [x, z] of PTS.slice(1)) {          // cantos e pontas arredondados
      const canto = malha(new THREE.CylinderGeometry(H, H, ALT, 40), COR);
      canto.position.set(x, -ALT / 2 - 0.004, z); grupo.add(canto);
    }
    const saida = malha(new THREE.CylinderGeometry(SAIDA.r, SAIDA.r, ALT, 40), 0x7388c4);
    saida.position.set(SAIDA.x, -ALT / 2 - 0.004, SAIDA.z); grupo.add(saida);

    pecas.meta = malha(new THREE.CylinderGeometry(R_META, R_META, 0.1, 32), 0xffd84d, { emissive: 0xffb300, emissiveIntensity: 0.8 });
    pecas.meta.position.set(META.x, 0.06, META.z);
    pecas.facho = malha(new THREE.CylinderGeometry(R_META * 0.8, R_META * 0.8, 5, 24, 1, true), 0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 1, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    pecas.facho.position.set(META.x, 2.5, META.z); pecas.facho.castShadow = false;
    pecas.viga = malha(new THREE.BoxGeometry(0.34, 0.34, VIGA), 0xc98a4b, { emissive: 0x3a2208 });
    grupo.add(pecas.meta, pecas.facho, pecas.viga);
  },

  desenha(c, dt, t) {
    const [a, b] = c.p.jogadores, { pecas } = c;
    const pulso = 1 + Math.sin(t * 6) * 0.08;
    pecas.meta.scale.set(pulso, 1, pulso); pecas.facho.material.opacity = 0.2 + Math.sin(t * 6) * 0.06;
    const v = pecas.viga, ya = RAIO + a.y, yb = RAIO + b.y;
    v.position.set((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2);
    v.scale.z = Math.max(0.05, Math.hypot(b.x - a.x, yb - ya, b.z - a.z) / VIGA);       // na queda os dois se afastam: a viga acompanha
    v.lookAt(b.x, yb, b.z);
    for (const f of c.p.dados.fx.splice(0)) { c.particulas(f.x, 0.4, f.z, 0xc98a4b, 24, 8); c.particulas(f.x, 0.4, f.z, 0xffffff, 12, 5); }
  },
};
