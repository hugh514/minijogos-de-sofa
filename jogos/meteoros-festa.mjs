// Chuva de fogo (Festa: todos contra todos ou times). Sombras vermelhas avisam onde a pedra vai cair.
// Cada um tem 3 vidas. Quem leva uma pedrada voa, perde uma vida e volta ao seu lugar com 1,5 s de proteção.
// Vence o último com vida (ou o último time com alguém de pé); aos 45 s vence quem tiver mais vidas. Em times as vidas dos dois se somam.
import { timeDe, posicionaRoda, pontoNoCirculo, elimina, quem } from '../logica.mjs';

export const VIDAS = 3, TEMPO = 45, T_METEORO = 1.3, R_METEORO = 1.8, PROTECAO = 1.5, INICIO = 1.5;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);
export const raioDe = n => 7 + n * 0.75;                              // 8,5 com 2, 9,25 com 3 e 10 com 4
const lugar = (p, i) => { const n = p.jogadores.length, a = -Math.PI / 2 + i * 2 * Math.PI / n, r = p.arena.raio * 0.5; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };

function somaVidas(p) {
  const d = p.dados, totais = p.modo === 'times' ? [0, 0] : d.vidas.map(() => 0), de = dono(p);
  d.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

function celulares(p, fim) {
  const d = p.dados;
  p.jogadores.forEach((_, i) => {
    const t = fim ? fim[i] : d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : d.caiu[i] ? 'Atingido! Já volta' : 'Vidas: ' + d.vidas[i];
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'meteoros-festa', genero: 'reflexo', nome: 'Chuva de fogo', dica: 'Fuja das sombras vermelhas: cada um tem 3 vidas e vence o último de pé.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Arranca', b: '' }, semPulo: true,
  rotulo: 'vidas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: raioDe(n), parede: true };
    posicionaRoda(p, p.arena.raio * 0.5);
    p.dados = { lista: [], prox: INICIO, vidas: Array(n).fill(VIDAS), protecao: Array(n).fill(PROTECAO + 0.5), caiu: Array(n).fill(false), placar: [], inventario: [], fx: [], aviso: '' };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    d.aviso = p.t < 2.5 ? 'Fuja das sombras!' : '';

    // mais jogadores, mais pedras; e elas caem cada vez mais rapido
    d.prox -= dt;
    if (d.prox <= 0) {
      const vivos = p.jogadores.filter(j => j.vivo);
      const alvo = vivos.length ? vivos[Math.floor(p.rng() * vivos.length)] : null;
      const ponto = alvo && p.rng() < 0.6 ? { x: alvo.x + (p.rng() - 0.5) * 3, z: alvo.z + (p.rng() - 0.5) * 3 } : pontoNoCirculo(p, p.arena.raio);
      d.lista.push({ ...ponto, t: T_METEORO, r: R_METEORO });
      d.prox = Math.max(0.25, 0.95 - p.t * 0.016) / (0.5 + 0.25 * n);
    }
    for (const m of d.lista) {
      const antes = m.t;
      m.t -= dt;
      if (antes > 0 && m.t <= 0) {
        p.eventos.push('batida');
        p.jogadores.forEach((j, i) => {
          if (!j.vivo || d.protecao[i] > 0 || Math.hypot(j.x - m.x, j.z - m.z) >= m.r) return;
          d.vidas[i]--; d.caiu[i] = true; elimina(p, j, 10);
          p.eventos.push('queda'); d.fx.push({ x: j.x, z: j.z, i });
        });
      }
    }
    d.lista = d.lista.filter(m => m.t > -0.3);

    p.jogadores.forEach((j, i) => {
      d.protecao[i] = Math.max(0, d.protecao[i] - dt);
      if (j.vivo || !d.caiu[i] || j.y >= -6 || d.vidas[i] <= 0) return;
      Object.assign(j, { vivo: true, y: 0, vy: 0, vx: 0, vz: 0, ...lugar(p, i) });      // voltou ao seu lugar, protegido
      d.caiu[i] = false; d.protecao[i] = PROTECAO; p.eventos.push('troca');
    });

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    celulares(p);

    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return fechaComo(p, restam.length ? restam[0] : -1);
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    // pedras soltas em volta da arena (so enfeite)
    const r = c.p.arena.raio + 1.5;
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5 + 0.2, s = 0.5 + (k % 3) * 0.25;
      const m = malha(new THREE.DodecahedronGeometry(s, 0), 0x5a4a44, { roughness: 0.95, flatShading: true });
      m.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r); m.rotation.set(k, k * 2, 0); grupo.add(m);
    }
    // vidas: bolinhas vermelhas acima do nome de cada um
    pecas.vidas = c.bonecos.map(() => {
      const g = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 14, 10), 0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 0.8 }); m.castShadow = false; m.position.x = (k - 1) * 0.8; g.add(m); return m;
      });
      grupo.add(g); return { g, pips };
    });
    pecas.visto = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, p, pecas } = c, d = p.dados, l = d.lista;
    const sombras = c.pool('sombras', l.length, () => {
      const m = malha(new THREE.CylinderGeometry(1, 1, 0.04, 28), 0xff2a2a, { transparent: true, opacity: 0.6, emissive: 0x7a0000 }); m.castShadow = false;
      const aro = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffd0a0 })); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.04; m.add(aro);
      return m;
    });
    const pedras = c.pool('pedras', l.length, () => malha(new THREE.IcosahedronGeometry(1, 1), 0x7a4a2a, { emissive: 0xff4a00, emissiveIntensity: 0.8, flatShading: true }));
    l.forEach((m, k) => {
      const caindo = m.t > 0, f = caindo ? 1 - m.t / T_METEORO : 1;
      sombras[k].position.set(m.x, 0.03, m.z); sombras[k].scale.set(m.r * (0.3 + 0.7 * f), 1, m.r * (0.3 + 0.7 * f));
      sombras[k].material.color.set(caindo ? 0xff2a2a : 0xffffff);
      pedras[k].visible = caindo; pedras[k].position.set(m.x, 0.8 + m.t * 16, m.z); pedras[k].rotation.x += dt * 5; pedras[k].rotation.z += dt * 3;
      if (!caindo && !m.viu) { m.viu = true; c.particulas(m.x, 0.5, m.z, 0xff7a2f, 18, 9); }
    });
    c.bonecos.forEach((b, i) => {
      const alvo = pecas.vidas[i];
      b.visible = b.position.y > -12 && (d.protecao[i] <= 0 || Math.floor(t * 10) % 2 === 0);       // pisca enquanto protegido
      alvo.g.visible = !d.caiu[i] && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, b.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, b.position.z);
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      c.particulas(e.x, 0.8, e.z, c.cores[e.i], 16, 8);
    }
  },
};
