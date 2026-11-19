// Rei da Bandeira (Festa: todos contra todos ou times). Uma bandeira no meio da arena de torneio. Quem a segura soma 1 ponto por segundo
// (2 por segundo na reta final, nos últimos 10 s). O empurrão (A) de um adversário perto de quem a leva derruba a bandeira e ela voa
// para longe. Em times, os dois do time somam juntos e o empurrão do parceiro não derruba. Vence quem tiver mais em 40 s,
// ou quem chegar primeiro a 30 pontos.
import { posicionaRoda, timeDe } from '../logica.mjs';

export const TEMPO = 40, META = 30, DOBRO = 30;               // a partir dos 30 s os pontos valem em dobro
const R_ARENA = 8.5, ARMA = 1.5, R_PEGA = 1.7, R_DERRUBA = 2.8, T_SEM_PEGAR = 1.0, LENTO = 0.88;

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem são os pontos: do jogador ou do time
const adversarios = (p, a, b) => (p.modo === 'times' ? timeDe(p, a) !== timeDe(p, b) : a !== b);

function larga(p, d, causa) {
  const j = p.jogadores[d.com], k = causa.por, m = Math.hypot(j.x - p.jogadores[k].x, j.z - p.jogadores[k].z) || 1;
  const ux = (j.x - p.jogadores[k].x) / m, uz = (j.z - p.jogadores[k].z) / m, torce = (p.rng() - 0.5) * 3;
  Object.assign(d.bandeira, { x: j.x, z: j.z, vx: ux * 7 - uz * torce, vz: uz * 7 + ux * torce });
  d.nopega[d.com] = T_SEM_PEGAR;
  d.fx.push({ tipo: 'derrubou', x: j.x, z: j.z, i: k });
  p.eventos.push('queda');
  p.celular[d.com] = { ...p.celular[d.com], vibra: (p.celular[d.com].vibra ?? 0) + 1 };
  d.com = -1;
}

function pega(p, d, i) {
  d.com = i; d.bandeira.vx = d.bandeira.vz = 0;
  d.fx.push({ tipo: 'pegou', x: p.jogadores[i].x, z: p.jogadores[i].z, i });
  p.eventos.push('troca');
}

function moveBandeira(d, dt) {
  const b = d.bandeira, f = Math.exp(-3.2 * dt);
  b.x += b.vx * dt; b.z += b.vz * dt; b.vx *= f; b.vz *= f;
  const r = Math.hypot(b.x, b.z), max = R_ARENA - 0.8;
  if (r > max) { b.x *= max / r; b.z *= max / r; b.vx *= -0.4; b.vz *= -0.4; }
}

function texto(p, d, i) {
  if (p.t < ARMA) return 'A bandeira já vai subir. Corram para o meio!';
  if (d.com === i) return 'Você está com a bandeira! Fuja dos empurrões';
  if (d.com < 0) return 'Pegue a bandeira no chão!';
  if (adversarios(p, i, d.com)) return `Jogador ${d.com + 1} está com ela. Empurre!`;
  return 'Seu time está com a bandeira. Proteja!';
}

export default {
  id: 'pega-bandeira-festa', genero: 'corrida', nome: 'Rei da Bandeira', dica: 'Segure a bandeira para somar pontos. Empurre quem a leva para derrubá-la!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'DERRUBA', b: '' }, semPulo: true,
  rotulo: 'pontos', duracao: TEMPO,

  // câmera um pouco mais perto: a arena preenche mais a tela e as peças ficam maiores na TV
  camera: () => ({ x: 0, y: 19.2, z: 15.8, ox: 0, oy: 0, oz: -0.9 }),

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    posicionaRoda(p, 5.6);
    const n = p.jogadores.length, donos = p.modo === 'times' ? 2 : n;
    p.dados = {
      placar: Array(donos).fill(0), pontos: Array(donos).fill(0), inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0, fx: [],
      bandeira: { x: 0, z: 0, vx: 0, vz: 0 }, com: -1, dobrou: false,
      nopega: Array(n).fill(0), emp: Array(n).fill(0), segurou: Array(n).fill(0),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, de = dono(p);
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    if (!d.dobrou && p.t >= DOBRO) { d.dobrou = true; d.aviso = 'PONTOS EM DOBRO!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.6; p.eventos.push('ponto'); }
    d.nopega = d.nopega.map(v => Math.max(0, v - dt));

    // empurrão de um adversário perto de quem leva a bandeira derruba
    js.forEach((j, i) => {
      if (j.empurroes <= d.emp[i]) return;
      d.emp[i] = j.empurroes;
      if (d.com < 0 || d.com === i || !adversarios(p, i, d.com)) return;
      const c = js[d.com];
      if (Math.hypot(c.x - j.x, c.z - j.z) < R_DERRUBA) larga(p, d, { por: i });
    });

    if (d.com < 0) {
      moveBandeira(d, dt);
      if (p.t >= ARMA) {
        let melhor = -1, mm = R_PEGA;
        js.forEach((j, i) => { const m = Math.hypot(j.x - d.bandeira.x, j.z - d.bandeira.z); if (d.nopega[i] <= 0 && m < mm) { mm = m; melhor = i; } });
        if (melhor >= 0) pega(p, d, melhor);
      }
    } else {
      const c = js[d.com];
      d.bandeira.x = c.x; d.bandeira.z = c.z;
      d.pontos[de(d.com)] += dt * (p.t >= DOBRO ? 2 : 1);
      d.segurou[d.com] += dt;
    }
    js.forEach((_, i) => { js[i].turbo = d.com === i ? LENTO : 1; });       // quem leva a bandeira corre um pouco menos: dá para alcançar

    d.placar = d.pontos.map(v => Math.floor(v));
    d.inventario = js.map((_, i) => [d.com === i ? 'Com a bandeira' : 'Segurou ' + Math.floor(d.segurou[i]) + ' s']);
    js.forEach((_, i) => { const t = texto(p, d, i); if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; });

    const maior = Math.max(...d.pontos), lideres = d.pontos.flatMap((v, k) => (v === maior ? [k] : []));
    if (maior >= META) return lideres[0];
    if (p.t >= TEMPO) return lideres.length === 1 ? lideres[0] : -1;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0;
    // arena de torneio: areia, anel pintado no meio e pedestal
    const areia = malha(new THREE.CylinderGeometry(R_ARENA - 0.2, R_ARENA - 0.2, 0.04, 44), 0xc9ad78, { roughness: 1 }); areia.position.y = 0.03; areia.castShadow = false; grupo.add(areia);
    const anel = malha(new THREE.TorusGeometry(2.1, 0.08, 6, 44), 0xf1ead6, { roughness: 1 }); anel.rotation.x = Math.PI / 2; anel.position.y = 0.07; anel.castShadow = false; grupo.add(anel);
    const pedestal = malha(new THREE.CylinderGeometry(0.9, 1.05, 0.3, 20), 0x8d8f98, { roughness: 0.8 }); pedestal.position.y = 0.17; grupo.add(pedestal);
    for (let k = 0; k < 16; k++) {                                // estacas da cerca da arena
      const a = k * Math.PI * 2 / 16, e = malha(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 8), 0x6b4a2f);
      e.position.set(Math.cos(a) * (R_ARENA - 0.1), 0.45, Math.sin(a) * (R_ARENA - 0.1)); grupo.add(e);
    }
    // a bandeira: mastro escuro e pano branco com faixa preta (cor que não é de jogador)
    const g = new THREE.Group();
    const mastro = malha(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 8), 0x2b2118); mastro.position.y = 1.8;
    const pano = malha(new THREE.BoxGeometry(2.1, 1.3, 0.06), 0xffffff, { emissive: 0x888888, emissiveIntensity: 0.6 }); pano.position.set(1.1, 3.0, 0); pano.castShadow = false;
    const faixa = malha(new THREE.BoxGeometry(2.1, 0.3, 0.08), 0x1a1a22); faixa.position.set(1.1, 3.0, 0); faixa.castShadow = false;
    g.add(mastro, pano, faixa); grupo.add(g);
    pecas.bandeira = { g, pano, faixa };
    // anel no chão embaixo de quem leva
    pecas.coroa = malha(new THREE.TorusGeometry(1.3, 0.14, 8, 28), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }); pecas.coroa.rotation.x = Math.PI / 2; pecas.coroa.castShadow = false; grupo.add(pecas.coroa);
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    if (!pecas.bandeira) return;
    const b = pecas.bandeira, armada = p.t >= ARMA, levando = d.com >= 0;
    b.g.visible = true;
    b.g.position.set(d.bandeira.x, levando ? 0.9 + 0.1 * Math.sin(t * 6) : armada ? 0.3 : -2.2 + 2.5 * Math.min(1, p.t / ARMA), d.bandeira.z);
    b.g.scale.setScalar(levando ? 0.9 : 1.1);
    b.pano.rotation.y = 0.25 * Math.sin(t * 5); b.faixa.rotation.y = b.pano.rotation.y;
    pecas.coroa.visible = levando;
    if (levando) {
      const cor = p.modo === 'times' ? c.times[timeDe(p, d.com)] : c.cores[d.com];
      pecas.coroa.position.set(d.bandeira.x, 0.12, d.bandeira.z); pecas.coroa.scale.setScalar(1 + 0.08 * Math.sin(t * 9));
      pecas.coroa.material.color.set(cor); pecas.coroa.material.emissive.set(cor);
    }
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'derrubou') c.particulas(e.x, 1.2, e.z, 0xffffff, 22, 9);
      else c.particulas(e.x, 1.2, e.z, 0xffd23f, 14, 6);
    }
  },
};
