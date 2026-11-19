// Bocha de discos: estilingue no celular, em turnos. Quem deixar um disco mais perto do centro vence.
import { colide, posiciona } from '../logica.mjs';

const R_ARENA = 8, R_DISCO = 0.65, SAIDA = 5.6, N = 3, V_MAX = 12, T_TURNO = 6, T_ROLA = 3.2, LIMITE = 58;
const ATRITO_K = 1.2, ATRITO_C = 1.5, ARRASTO_CHEIO = 0.9, ARRASTO_MIN = 0.08, SETA = 4.5;

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
  return { dx: -m.ax / len, dz: -m.ay / len, f: Math.max(0.2, Math.min(1, len / ARRASTO_CHEIO)) };
}

function desliza(o, dt) {
  const v = Math.hypot(o.vx, o.vz);
  if (v < 0.05) { o.vx = o.vz = 0; return; }
  const nv = Math.max(0, v * Math.exp(-ATRITO_K * dt) - ATRITO_C * dt);
  o.vx *= nv / v; o.vz *= nv / v; o.x += o.vx * dt; o.z += o.vz * dt;
}

function texto(p, i, t) { if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; }

function novoTurno(p, vez) {
  const d = p.dados, lado = vez ? 1 : -1;
  d.vez = vez; d.fase = 'mira'; d.tempo = T_TURNO; d.mira = { d: false, x0: 0, y0: 0, ax: 0, ay: 0 };
  d.discos.push({ x: lado * SAIDA, z: 0, vx: 0, vz: 0, dono: vez, fora: false, cai: 0 });
  d.atual = d.discos.length - 1;
  p.jogadores[vez].vy = 7;                                   // quem vai jogar da um pulinho
  p.celular[vez] = { ...p.celular[vez], texto: 'Sua vez! Arraste para trás e solte', vibra: (p.celular[vez].vibra ?? 0) + 1 };
  texto(p, 1 - vez, 'Vez do outro. Olhe para a tela');
  p.eventos.push('troca');
}

function lanca(p, tiro) {
  const d = p.dados, o = d.discos[d.atual];
  o.vx = tiro.dx * tiro.f * V_MAX; o.vz = tiro.dz * tiro.f * V_MAX;
  d.jogados[d.vez]++; d.fase = 'rola'; d.tempo = 0; d.aviso = '';
  p.eventos.push('dash');
}

function maisPerto(d, dono) {
  let melhor = Infinity;
  for (const o of d.discos) if (o.dono === dono && !o.fora) melhor = Math.min(melhor, Math.hypot(o.x, o.z));
  return melhor;
}

// Placar ao vivo: distancia (cm) do disco mais perto do centro de cada um; sem disco valido, 999. Os discos que restam vao nos selos.
function placar(p) {
  const d = p.dados;
  d.placar = [0, 1].map(i => { const m = maisPerto(d, i); return m === Infinity ? 999 : Math.min(999, Math.round(m * 100)); });
  d.inventario = [0, 1].map(i => ['Discos ' + (N - d.jogados[i])]);
}

function resultado(d) {
  const a = maisPerto(d, 0), b = maisPerto(d, 1);
  if (a === b || Math.abs(a - b) < 1e-6) return -1;
  return a < b ? 0 : 1;
}

export default {
  id: 'bocha', genero: 'mira', nome: 'Bocha de discos', dica: 'Na sua vez, arraste para trás e solte. Vence o disco mais perto do centro!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'mais perto (cm)',
  controle: { modo: 'toque' },

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: false };
    p.dados = { discos: [], jogados: [0, 0], placar: [999, 999], fx: [], lider: -1, aviso: '', avisoCor: '#ffd84d' };
    novoTurno(p, p.rng() < 0.5 ? 0 : 1);
    p.eventos.length = 0;                                    // o som e o pulo do primeiro turno ficam para a hora do jogo
    for (const j of p.jogadores) j.vy = 0;
    posiciona(p, 7.2);
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => { j.x = (i ? 1 : -1) * 7.2; j.z = 0; j.vx = j.vz = 0; });

    if (d.fase === 'mira') {
      d.tempo -= dt;
      const lado = d.vez ? 1 : -1;
      let tiro = estilingue(d.mira, p.jogadores[d.vez].ent);
      if (!tiro && d.tempo <= 0) {                           // estourou o tempo: sai com a mira atual ou fraco, rumo ao centro
        const ang = (p.rng() - 0.5) * 0.5;
        tiro = pontaria(d.mira) ?? { dx: -lado * Math.cos(ang), dz: Math.sin(ang), f: 0.39 };
      }
      d.aviso = d.tempo <= 3 && d.tempo > 0 ? String(Math.ceil(d.tempo)) : '';
      if (tiro) lanca(p, tiro);
    } else d.tempo += dt;

    // fisica dos discos
    const vivos = d.discos.filter(o => !o.fora);
    for (const o of vivos) desliza(o, dt);
    for (let i = 0; i < vivos.length; i++)
      for (let k = i + 1; k < vivos.length; k++) {
        const a = vivos[i], b = vivos[k];
        const forca = Math.hypot(a.vx - b.vx, a.vz - b.vz);
        if (colide(a, b, R_DISCO, R_DISCO, 1, 1) && forca > 0.5) {
          p.eventos.push('batida');
          d.fx.push({ x: (a.x + b.x) / 2, y: 0.4, z: (a.z + b.z) / 2, cor: -1, q: 10, forca: Math.min(6, 2 + forca * 0.3) });
        }
      }
    for (const o of d.discos) {
      if (o.fora) { o.cai += dt; o.x += o.vx * dt; o.z += o.vz * dt; continue; }
      if (Math.hypot(o.x, o.z) > R_ARENA) {
        o.fora = true; p.eventos.push('queda');
        d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: o.dono, q: 16, forca: 5 });
      }
    }

    placar(p);
    // quem esta ganhando agora (so para o destaque)
    d.lider = -1;
    let menor = Infinity;
    d.discos.forEach((o, n) => {
      if (o.fora || (d.fase === 'mira' && n === d.atual)) return;
      const dist = Math.hypot(o.x, o.z);
      if (dist < menor) { menor = dist; d.lider = n; }
    });

    if (d.fase === 'rola') {
      const parado = vivos.every(o => o.vx === 0 && o.vz === 0);
      if (parado || d.tempo > T_ROLA) {
        for (const o of vivos) o.vx = o.vz = 0;
        if (d.jogados[0] + d.jogados[1] >= 2 * N) return resultado(d);
        novoTurno(p, d.jogados[1 - d.vez] < N ? 1 - d.vez : d.vez);
      }
    }
    if (p.t > LIMITE) return resultado({ discos: d.discos.filter((o, n) => !(d.fase === 'mira' && n === d.atual)) });
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const anel = (r0, r1, cor, y, extra) => {
      const m = malha(new THREE.RingGeometry(r0, r1, 48), cor, { side: THREE.DoubleSide, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; grupo.add(m); return m;
    };
    anel(3.3, 3.5, 0xffffff, 0.03, { transparent: true, opacity: 0.5 });
    anel(1.9, 2.1, 0xffffff, 0.03, { transparent: true, opacity: 0.7 });
    anel(0, 0.75, 0xffd84d, 0.04, { emissive: 0xffd84d, emissiveIntensity: 0.6 });
    for (const i of [0, 1]) anel(R_DISCO + 0.1, R_DISCO + 0.3, cores[i], 0.03, {}).position.x = (i ? 1 : -1) * SAIDA;

    pecas.vez = malha(new THREE.TorusGeometry(R_DISCO + 0.25, 0.09, 8, 32), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
    pecas.vez.rotation.x = Math.PI / 2;
    pecas.lider = malha(new THREE.TorusGeometry(R_DISCO + 0.2, 0.1, 8, 32), 0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 1 });
    pecas.lider.rotation.x = Math.PI / 2;

    pecas.seta = new THREE.Group();
    pecas.haste = malha(new THREE.BoxGeometry(1, 0.12, 0.28), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
    pecas.ponta = malha(new THREE.ConeGeometry(0.45, 0.9, 12), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
    pecas.ponta.rotation.z = -Math.PI / 2;
    pecas.seta.add(pecas.haste, pecas.ponta);
    grupo.add(pecas.vez, pecas.lider, pecas.seta);
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, cores } = c, d = c.p.dados;
    const discos = c.pool('discos', d.discos.length, () => c.malha(new THREE.CylinderGeometry(R_DISCO, R_DISCO, 0.3, 28), 0xffffff, { roughness: 0.35 }));
    d.discos.forEach((o, n) => {
      const m = discos[n];
      m.material.color.set(cores[o.dono]);
      m.position.set(o.x, 0.15 - 12 * o.cai * o.cai, o.z);
      m.rotation.x = o.fora ? o.cai * 6 : 0;
      m.visible = o.cai < 1.5;
    });

    const mirando = d.fase === 'mira', atual = d.discos[d.atual];
    pecas.vez.visible = mirando && !!atual;
    if (pecas.vez.visible) {
      pecas.vez.position.set(atual.x, 0.12, atual.z);
      pecas.vez.scale.setScalar(1 + 0.15 * Math.sin(t * 8));
      pecas.vez.material.color.set(cores[d.vez]); pecas.vez.material.emissive.set(cores[d.vez]);
    }
    const lider = d.discos[d.lider];
    pecas.lider.visible = !!lider;
    if (lider) pecas.lider.position.set(lider.x, 0.36, lider.z);

    const tiro = mirando && d.mira.d ? pontaria(d.mira) : null;
    pecas.seta.visible = !!tiro;
    if (tiro) {
      const comp = 0.8 + tiro.f * SETA;
      pecas.seta.position.set(atual.x, 0.5, atual.z);
      pecas.seta.rotation.y = Math.atan2(-tiro.dz, tiro.dx);
      pecas.haste.scale.x = comp; pecas.haste.position.x = R_DISCO + comp / 2;
      pecas.ponta.position.x = R_DISCO + comp + 0.4;
      const cor = tiro.f > 0.85 ? 0xff4a4a : 0xffffff;       // vermelho: forca quase no maximo
      for (const m of [pecas.haste, pecas.ponta]) { m.material.color.set(cor); m.material.emissive.set(cor); }
    }

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor < 0 ? 0xffffff : cores[f.cor], f.q, f.forca);
    }
  },
};
