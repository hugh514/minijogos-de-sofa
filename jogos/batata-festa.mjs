// Batata Quente da Festa (todos contra todos ou times). Uma batata de fogo passa de mão em mão: encoste em outro jogador para jogá-la nele.
// O pavio é secreto; quando ele acaba a batata explode em quem está com ela e esse perde uma vida. Cada um tem 2 vidas e as
// rodadas de pavio ficam mais curtas. Vence quem sobrar (ou o time que ainda tiver alguém em pé); aos 45 s vence quem tiver mais vidas.
import { posicionaRoda, timeDe, elimina } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 2;
const R_ARENA = 8, PAUSA = 1.7, R_PASSA = 1.95, T_PASSA = 0.8, T_SEM_RECEBER = 1.5, TURBO = 1.15;
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem é a vida: do jogador ou do time

// Quanto dura o pavio da rodada: começa em cerca de 5 s e diminui até 2,8 s.
export const pavio = (rodada, sorteio) => Math.max(2.8, 4.8 - 0.25 * rodada) + sorteio * 1.2;

const vivos = (p, d) => p.jogadores.flatMap((j, i) => (j.vivo && d.vidas[i] > 0 ? [i] : []));

function totais(p, d) {
  const de = dono(p), t = p.modo === 'times' ? [0, 0] : d.vidas.map(() => 0);
  d.vidas.forEach((v, i) => { t[de(i)] += v; });
  return t;
}

function sorteiaDono(p, d) {
  const vs = vivos(p, d), outros = vs.filter(i => i !== d.ultimo);
  const lista = outros.length ? outros : vs;
  d.com = lista[Math.floor(p.rng() * lista.length)];
  d.pavio = d.pavioMax = pavio(d.rodada, p.rng());
  d.semPassar = T_PASSA;
  d.fx.push({ tipo: 'nova', x: p.jogadores[d.com].x, z: p.jogadores[d.com].z });
  p.eventos.push('troca');
  p.celular[d.com] = { ...p.celular[d.com], vibra: (p.celular[d.com].vibra ?? 0) + 1 };
}

function explode(p, d) {
  const j = p.jogadores[d.com], h = d.com;
  d.vidas[h]--; d.rodada++;
  d.fx.push({ tipo: 'boom', x: j.x, z: j.z, i: h });
  p.eventos.push('explosao');
  p.celular[h] = { ...p.celular[h], vibra: (p.celular[h].vibra ?? 0) + 1 };
  for (const o of p.jogadores) {                    // o estouro joga quem está perto
    if (o === j || !o.vivo) continue;
    const dx = o.x - j.x, dz = o.z - j.z, m = Math.hypot(dx, dz);
    if (m < 3.2) { const f = m > 1e-6 ? 9 / m : 0; o.vx += dx * f; o.vz += dz * f; }
  }
  if (d.vidas[h] <= 0) elimina(p, j, 11); else j.vy = 7;
  d.ultimo = h; d.com = -1; d.pausa = PAUSA;
}

function passa(p, d) {
  const h = p.jogadores[d.com];
  let i = -1, perto = R_PASSA;       // passa para o mais perto dentro do alcance, nao para o primeiro da lista
  for (const [k, o] of p.jogadores.entries()) {
    if (k === d.com || !o.vivo || d.vidas[k] <= 0 || d.semReceber[k] > 0) continue;
    const dist = Math.hypot(o.x - h.x, o.z - h.z);
    if (dist <= perto) { perto = dist; i = k; }
  }
  if (i >= 0) {
    const o = p.jogadores[i];
    d.semReceber[d.com] = T_SEM_RECEBER;
    d.fx.push({ tipo: 'passou', x: (h.x + o.x) / 2, z: (h.z + o.z) / 2, i });
    d.com = i; d.semPassar = T_PASSA;
    p.eventos.push('troca');
    p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    return;
  }
}

function texto(d, i) {
  if (d.vidas[i] <= 0) return 'Fora! Torça pelos outros';
  const vidas = 'Vidas: ' + d.vidas[i];
  if (d.com === i) return 'Você está com a batata! Encoste em alguém. ' + vidas;
  if (d.com < 0) return 'Nova batata vindo! ' + vidas;
  return 'Fuja da batata! ' + vidas;
}

export default {
  id: 'batata-festa', genero: 'reflexo', nome: 'Batata Quente da Festa', dica: 'Encoste em alguém para passar a batata de fogo. Quem estiver com ela quando estourar perde uma vida!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'ARRANCA', b: '' }, semPulo: true, empurrao: 2.0,
  rotulo: 'vidas', duracao: TEMPO,

  // câmera um pouco mais perto: a arena preenche mais a tela e as peças ficam maiores na TV
  camera: () => ({ x: 0, y: 19.2, z: 15.8, ox: 0, oy: 0, oz: -0.9 }),

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    posicionaRoda(p, 5);
    const n = p.jogadores.length;
    p.dados = {
      placar: [], inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0, fx: [],
      vidas: Array(n).fill(VIDAS), com: -1, ultimo: -1, rodada: 0, pavio: 0, pavioMax: 1, pausa: 1.5, semPassar: 0, semReceber: Array(n).fill(0),
    };
    p.dados.placar = totais(p, p.dados);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.semReceber = d.semReceber.map(v => Math.max(0, v - dt));
    d.semPassar = Math.max(0, d.semPassar - dt);

    if (d.com < 0) {
      d.pausa -= dt;
      if (d.pausa <= 0 && vivos(p, d).length > 1) sorteiaDono(p, d);
    } else {
      d.pavio -= dt;
      if (d.semPassar <= 0) passa(p, d);
      if (d.pavio <= 0) explode(p, d);
    }
    js.forEach((j, i) => { j.turbo = d.com === i ? TURBO : 1; });
    for (const [i, j] of js.entries()) if (!j.vivo && d.vidas[i] > 0) d.vidas[i] = 0;       // caiu para fora por outro motivo: sem vida

    d.placar = totais(p, d);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    js.forEach((_, i) => { const t = texto(d, i); if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; });

    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return restam.length ? restam[0] : -1;
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return lideres.length === 1 ? lideres[0] : -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0;
    // arena de piso de madeira escura com um círculo de brasa pintado, bem diferente do sumô
    const piso = malha(new THREE.CylinderGeometry(R_ARENA - 0.2, R_ARENA - 0.2, 0.04, 44), 0x4a3a30, { roughness: 1 }); piso.position.y = 0.03; piso.castShadow = false; grupo.add(piso);
    const brasa = malha(new THREE.TorusGeometry(R_ARENA - 0.6, 0.12, 6, 60), 0xff7a2f, { emissive: 0xff5a1a, emissiveIntensity: 0.9 }); brasa.rotation.x = Math.PI / 2; brasa.position.y = 0.08; brasa.castShadow = false; grupo.add(brasa);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, t = malha(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), 0x2b2118);
      t.position.set(Math.cos(a) * (R_ARENA + 0.1), 0.45, Math.sin(a) * (R_ARENA + 0.1)); grupo.add(t);
      const chama = malha(new THREE.ConeGeometry(0.2, 0.5, 8), 0xffb13b, { emissive: 0xff8a1a, emissiveIntensity: 1.2 }); chama.position.set(t.position.x, 1.1, t.position.z); chama.castShadow = false; grupo.add(chama);
    }
    // a batata: corpo marrom amassado, olhinhos e pavio com faísca
    const g = new THREE.Group();
    const corpo = malha(new THREE.SphereGeometry(0.62, 16, 12), 0x9b6a3a, { roughness: 0.8 }); corpo.scale.set(1.15, 0.9, 1.3); corpo.position.y = 0;
    const mancha = malha(new THREE.SphereGeometry(0.2, 8, 6), 0x6e4a26); mancha.position.set(0.3, 0.2, 0.45); mancha.castShadow = false;
    const olhoE = malha(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, { emissive: 0xffffff }); olhoE.position.set(-0.22, 0.2, 0.7); olhoE.castShadow = false;
    const olhoD = malha(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, { emissive: 0xffffff }); olhoD.position.set(0.22, 0.2, 0.7); olhoD.castShadow = false;
    const haste = malha(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), 0x2b2118); haste.position.y = 0.72;
    const faisca = malha(new THREE.SphereGeometry(0.16, 8, 6), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 1.6 }); faisca.position.y = 0.98; faisca.castShadow = false;
    g.add(corpo, mancha, olhoE, olhoD, haste, faisca); g.visible = false; grupo.add(g);
    pecas.batata = { g, corpo, faisca };
    // anel vermelho no chão de quem está com a batata
    pecas.alvo = malha(new THREE.TorusGeometry(1.25, 0.14, 8, 28), 0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 1, transparent: true, opacity: 0.9 }); pecas.alvo.rotation.x = Math.PI / 2; pecas.alvo.castShadow = false; pecas.alvo.visible = false; grupo.add(pecas.alvo);
    // vidas: bolinhas vermelhas no chão, à frente de cada jogador
    pecas.vidas = c.bonecos.map(() => {
      const gv = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => { const m = malha(new THREE.SphereGeometry(0.36, 12, 8), 0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 0.8 }); m.castShadow = false; m.position.x = (k - (VIDAS - 1) / 2) * 0.95; gv.add(m); return m; });
      grupo.add(gv); return { g: gv, pips };
    });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    if (!pecas.batata) return;
    const b = pecas.batata, quente = d.com >= 0, calor = quente ? Math.min(1, Math.max(0, 1 - d.pavio / d.pavioMax)) : 0;
    b.g.visible = quente; pecas.alvo.visible = quente;
    if (quente) {
      const dono = c.bonecos[d.com], pulso = 1 + (0.06 + 0.22 * calor) * Math.sin(t * (8 + 26 * calor));
      b.g.position.set(dono.position.x, dono.position.y + 2.95, dono.position.z); b.g.scale.setScalar(1.35 * pulso); b.g.rotation.y = t * 2;
      b.corpo.material.color.setRGB(0.6 + 0.4 * calor, 0.42 * (1 - calor) + 0.1, 0.23 * (1 - calor) + 0.05);
      b.corpo.material.emissive.setRGB(calor * 0.8, calor * 0.12, 0);
      b.faisca.scale.setScalar(0.8 + 0.6 * Math.abs(Math.sin(t * 20)));
      pecas.alvo.position.set(dono.position.x, 0.12, dono.position.z); pecas.alvo.scale.setScalar(1 + 0.15 * calor * Math.sin(t * 14));
    }
    c.bonecos.forEach((bo, i) => {
      const v = pecas.vidas[i], vivo = d.vidas[i] > 0 && p.jogadores[i].vivo;
      v.g.visible = vivo;
      v.g.position.set(bo.position.x, 0.45, bo.position.z + 1.7);       // as vidas ficam no chão, à frente de cada um: nunca escondem a batata nem o nome
      v.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
      bo.visible = bo.position.y > -12;
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'boom') { c.particulas(e.x, 1.2, e.z, 0xff7a2f, 40, 12); c.particulas(e.x, 1.6, e.z, 0xffd23f, 20, 9); }
      else if (e.tipo === 'passou') c.particulas(e.x, 1.4, e.z, 0xffffff, 12, 6);
      else c.particulas(e.x, 2, e.z, 0xffd23f, 10, 5);
    }
  },
};
