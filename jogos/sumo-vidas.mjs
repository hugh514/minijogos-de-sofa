// Sumô de três vidas (Festa: todos contra todos ou times). Uma arena de palha que encolhe devagar e três vidas para cada um.
// Quem cai perde uma vida e volta 2 s depois no centro, se ainda tiver vida. Vence o último (ou o time) com vida,
// ou quem tiver mais vidas no fim do tempo. Os dois botões são os do motor: A empurra, B pula.
import { posicionaRoda, timeDe } from '../logica.mjs';

const VIDAS = 3, VOLTA = 2, TEMPO = 45;
const R0 = 9, R_MIN = 4.6, INICIO = 5, FIM_ENCOLHE = 42;
const ENCOLHE = (R0 - R_MIN) / (FIM_ENCOLHE - INICIO);       // metros por segundo (cerca de 0,12)
const N_FARDOS = 24;

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e a vida de i: do proprio jogador ou do time

// Vidas por dono do placar (jogador ou time) e quem ainda tem vida.
function somaVidas(p) {
  const d = p.dados, totais = p.modo === 'times' ? [0, 0] : d.vidas.map(() => 0), de = dono(p);
  d.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

function renasce(p, d, i) {
  const j = p.jogadores[i], n = p.jogadores.length, a = i * 2 * Math.PI / n;
  Object.assign(j, { vivo: true, x: Math.cos(a) * 2, z: Math.sin(a) * 2, y: 0, vx: 0, vy: 0, vz: 0 });      // cada um num ponto: dois no mesmo lugar nao se empurram
  d.fora[i] = false;
  d.fx.push({ tipo: 'volta', i, x: j.x, z: j.z });
  p.eventos.push('troca');
}

export default {
  id: 'sumo-vidas', genero: 'empurra', nome: 'Sumô de três vidas', dica: 'Empurre os outros para fora! Cada um tem 3 vidas e a arena encolhe.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  rotulo: 'vidas', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R0, parede: false };
    posicionaRoda(p, 5);
    const n = p.jogadores.length;
    p.dados = { vidas: Array(n).fill(VIDAS), volta: Array(n).fill(0), fora: Array(n).fill(false), fx: [], placar: [], inventario: [] };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (p.t > INICIO) p.arena.raio = Math.max(R_MIN, p.arena.raio - ENCOLHE * dt);
    p.jogadores.forEach((j, i) => {
      if (d.fora[i]) {
        if (d.vidas[i] <= 0) return;
        d.volta[i] -= dt;
        if (d.volta[i] <= 0) renasce(p, d, i);
        return;
      }
      if (j.vivo) return;
      d.fora[i] = true; d.vidas[i]--; d.volta[i] = VOLTA;      // o motor ja tirou o chao dele: caiu
      d.fx.push({ tipo: 'caiu', i, x: j.x, z: j.z });
    });
    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    p.jogadores.forEach((_, i) => {       // o celular repete as vidas
      const t = d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : d.fora[i] ? 'Caiu! Volta em ' + Math.ceil(Math.max(0, d.volta[i])) + ' s' : 'Vidas: ' + d.vidas[i];
      if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
    });

    // acabou quando sobra um dono (jogador ou time) com vida
    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return restam.length ? restam[0] : -1;
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return lideres.length === 1 ? lideres[0] : -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    // anel de fardos de palha na borda, que acompanha a arena encolhendo
    pecas.fardos = Array.from({ length: N_FARDOS }, () => {
      const g = new THREE.Group();
      const f = malha(new THREE.CylinderGeometry(0.3, 0.3, 1, 10), 0xd9b66a, { roughness: 0.95 }); f.rotation.z = Math.PI / 2;
      const corda = malha(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10), 0x8a5a2b, { roughness: 0.9 }); corda.rotation.z = Math.PI / 2; corda.castShadow = false;
      g.add(f, corda); g.userData = { f, corda }; grupo.add(g);
      return g;
    });
    // as duas linhas de largada do sumô no centro
    for (const s of [-1, 1]) {
      const l = malha(new THREE.BoxGeometry(0.22, 0.03, 1.6), 0xffffff, { emissive: 0x777777 }); l.position.set(s * 0.8, 0.02, 0); l.castShadow = false; grupo.add(l);
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
    const { p, pecas } = c, d = p.dados, r = p.arena.raio;
    const comp = (2 * Math.PI * r / N_FARDOS) * 1.02;
    pecas.fardos.forEach((g, k) => {
      const a = k * 2 * Math.PI / N_FARDOS;
      g.position.set(Math.cos(a) * (r + 0.2), 0.26, Math.sin(a) * (r + 0.2));
      g.rotation.y = -a - Math.PI / 2;
      g.userData.f.scale.y = comp; g.userData.corda.scale.y = 1;
      g.userData.corda.position.x = comp * 0.2; g.userData.f.position.x = 0;
    });
    c.bonecos.forEach((b, i) => {
      const alvo = pecas.vidas[i], vivo = !d.fora[i];
      b.visible = b.position.y > -12;
      alvo.g.visible = vivo && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, b.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, b.position.z);      // acima da plaquinha do nome
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'caiu') c.particulas(e.x, 0.6, e.z, c.cores[e.i], 16, 8);
      else {
        c.particulas(e.x, 1, e.z, 0xffffff, 20, 7);
        const u = c.bonecos[e.i].userData;
        if (u?.corpo) u.corpo.rotation.x = 0;       // acabou de rodopiar na queda
      }
    }
  },
};
