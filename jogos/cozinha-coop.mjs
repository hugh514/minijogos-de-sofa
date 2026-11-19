// Cozinha da Equipe (Festa: cooperativo, 2 a 4). Pedidos de pizza aparecem no quadro do chão. Cada um leva um ingrediente por vez
// das caixas da esquerda até o balcão da direita (encostar pega, encostar no balcão entrega). A equipe precisa fechar a meta de
// pedidos em 45 s; a meta cresce com o número de jogadores. Quem pega outro ingrediente larga o que levava.
import { posicionaRoda, RAIO } from '../logica.mjs';

export const LX = 10, LZ = 6.5, TEMPO = 45;
const V_ANDA = 7.5, V_RUSH = 14, T_RUSH = 0.35;           // o motor aceleraria muito mais: a cozinha pede corrida, não voo
const R_PEGA = 2.6, R_BALCAO = 1.8;
const NOMES = ['massa', 'tomate', 'queijo'];
const CORES = [0xf3e6c4, 0xd9301f, 0xf0861a];              // creme, vermelho, laranja: nenhuma é cor de jogador
const CAIXAS = [{ x: -8.3, z: -3.7, t: 0 }, { x: -8.3, z: -0.4, t: 1 }, { x: -8.3, z: 2.9, t: 2 }];
const BALCAO = { x0: 7.3, x1: 9.7, z0: -4.6, z1: 3.2 };
const QUADRO = { z: 5.2, xs: [-4.8, -1.6, 1.6, 4.8] };      // quatro pedidos visíveis, na faixa de baixo (o placar fica em cima)
const MAX_PEDIDOS = 4;

export const metaDe = n => n + 2;
const entreChegadas = n => 5 - 0.4 * n;                     // segundos entre um pedido novo e outro

const dist = (j, a, b) => Math.hypot(j.x - a, j.z - b);
const noBalcao = j => Math.hypot(j.x - Math.max(BALCAO.x0, Math.min(BALCAO.x1, j.x)), j.z - Math.max(BALCAO.z0, Math.min(BALCAO.z1, j.z))) < R_BALCAO;

function novoPedido(p, d) {
  const total = [Math.floor(p.rng() * 3), Math.floor(p.rng() * 3)].sort();
  d.pedidos.push({ total, feito: total.map(() => false), id: d.criados++ });
}

function limitaVelocidade(d, j, i, dt) {
  if (j.empurroes > d.emp[i]) { d.emp[i] = j.empurroes; d.rush[i] = T_RUSH; }
  d.rush[i] = Math.max(0, d.rush[i] - dt);
  const vmax = d.rush[i] > 0 ? V_RUSH : V_ANDA, v = Math.hypot(j.vx, j.vz);
  if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
}

function entrega(p, d, i) {
  const t = d.leva[i], achado = d.pedidos.find(o => o.total.some((x, m) => x === t && !o.feito[m]));
  if (!achado) {                                           // ninguém pediu isso: volta para a mão, sem perder o ingrediente
    if (d.recusa[i] <= 0) { d.recusa[i] = 1.2; d.fx.push({ tipo: 'nao', x: p.jogadores[i].x, z: p.jogadores[i].z }); p.eventos.push('queda'); }
    return;
  }
  achado.feito[achado.total.findIndex((x, m) => x === t && !achado.feito[m])] = true;
  d.leva[i] = -1;
  d.fx.push({ tipo: 'entrega', x: BALCAO.x0, z: p.jogadores[i].z, t });
  p.eventos.push('moeda');
  if (!achado.feito.every(Boolean)) return;
  d.pedidos.splice(d.pedidos.indexOf(achado), 1);
  d.entregues++;
  d.aviso = 'PEDIDO PRONTO!'; d.avisoCor = '#6bff9a'; d.avisoT = 0.9;
  d.fx.push({ tipo: 'pronto', x: BALCAO.x0 - 1, z: p.jogadores[i].z });
  p.eventos.push('ponto');
}

function textoCelular(d, i, meta) {
  const leva = d.leva[i] >= 0 ? 'Leva ' + NOMES[d.leva[i]].toUpperCase() : 'Mãos livres';
  return `${leva}. Pedidos ${d.entregues} de ${meta}`;
}

export default {
  id: 'cozinha-coop', genero: 'corrida', nome: 'Cozinha da Equipe', dica: 'Levem os ingredientes das caixas até o balcão e fechem os pedidos antes do tempo acabar!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'CORRE', b: '' }, semPulo: true,
  rotulo: 'pedidos prontos', duracao: TEMPO,

  // câmera um pouco mais perto: a arena preenche mais a tela e as peças ficam maiores na TV
  camera: () => ({ x: 0, y: 19.2, z: 15.8, ox: 0, oy: 0, oz: -0.9 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaRoda(p, 2.6);
    const cada = f => p.jogadores.map((_, i) => f(i));
    p.dados = {
      placar: [0], inventario: [], aviso: '', avisoCor: '#6bff9a', avisoT: 0, fx: [],
      meta: metaDe(p.jogadores.length), entregues: 0, pedidos: [], criados: 0, proximo: entreChegadas(p.jogadores.length),
      leva: cada(() => -1), cdPega: cada(() => 0), recusa: cada(() => 0), emp: cada(() => 0), rush: cada(() => 0),
    };
    novoPedido(p, p.dados); novoPedido(p, p.dados);
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.proximo -= dt;
    if (d.proximo <= 0) { d.proximo += entreChegadas(n); if (d.pedidos.length < MAX_PEDIDOS) novoPedido(p, d); }

    p.jogadores.forEach((j, i) => {
      d.cdPega[i] -= dt; d.recusa[i] -= dt;
      limitaVelocidade(d, j, i, dt);
      for (const c of CAIXAS) {
        if (d.cdPega[i] > 0 || d.leva[i] === c.t || dist(j, c.x, c.z) > R_PEGA) continue;
        d.leva[i] = c.t; d.cdPega[i] = 0.5;
        d.fx.push({ tipo: 'pegou', x: c.x, z: c.z, t: c.t });
        p.eventos.push('troca');
      }
      if (d.leva[i] >= 0 && noBalcao(j)) entrega(p, d, i);
    });

    d.placar = [d.entregues];
    d.inventario = p.jogadores.map((_, i) => [d.leva[i] >= 0 ? 'Leva ' + NOMES[d.leva[i]] : 'Mãos livres', 'Faltam ' + Math.max(0, d.meta - d.entregues)]);
    p.jogadores.forEach((_, i) => {
      const texto = textoCelular(d, i, d.meta);
      if (p.celular[i].texto !== texto) p.celular[i] = { ...p.celular[i], texto };
    });

    if (d.entregues >= d.meta) { d.aviso = 'TODOS OS PEDIDOS SAÍRAM!'; d.avisoCor = '#6bff9a'; d.avisoT = 3; return 2; }
    if (p.t >= TEMPO) { d.aviso = 'O TEMPO ACABOU'; d.avisoCor = '#ff4a4a'; d.avisoT = 3; return -1; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    pecas.visto = 0;
    // piso de ladrilho xadrez
    const ladoX = LX / 4, ladoZ = LZ / 3;                         // 4 por 3 ladrilhos em cada quarto do piso
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < 3; k++)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const ladrilho = malha(caixa(ladoX, 0.03, ladoZ), (i + k + (sx + sz) / 2) % 2 ? 0xc3cad2 : 0xe4e8ec, { roughness: 0.6 });
          ladrilho.position.set(sx * (i + 0.5) * ladoX, 0.03, sz * (k + 0.5) * ladoZ); ladrilho.castShadow = false; grupo.add(ladrilho);
        }
    // caixas de ingrediente: madeira com o ingrediente em cima, bem grande
    CAIXAS.forEach(cx => {
      const g = new THREE.Group(); g.position.set(cx.x, 0, cx.z);
      const base = malha(caixa(2.3, 0.9, 2.3), 0x9b6a3a, { roughness: 0.9 }); base.position.y = 0.45;
      const faixa = malha(caixa(2.36, 0.18, 2.36), CORES[cx.t], { emissive: CORES[cx.t], emissiveIntensity: 0.35 }); faixa.position.y = 0.72; faixa.castShadow = false;
      g.add(base, faixa);
      for (let k = 0; k < 3; k++) { const f = fruta(c, cx.t, 1.15); f.position.set((k - 1) * 0.6, 1.2 + (k === 1 ? 0.35 : 0), (k - 1) * 0.15); g.add(f); }
      grupo.add(g);
    });
    // balcão de entrega, com a luz verde e o sino
    const balcao = malha(caixa(BALCAO.x1 - BALCAO.x0, 1, BALCAO.z1 - BALCAO.z0), 0x8d98a6, { roughness: 0.4, metalness: 0.4 });
    balcao.position.set((BALCAO.x0 + BALCAO.x1) / 2, 0.5, (BALCAO.z0 + BALCAO.z1) / 2); grupo.add(balcao);
    const luz = malha(caixa(0.35, 0.06, BALCAO.z1 - BALCAO.z0 - 0.4), 0x4dff88, { emissive: 0x4dff88, emissiveIntensity: 1.1 });
    luz.position.set(BALCAO.x0 + 0.2, 1.03, (BALCAO.z0 + BALCAO.z1) / 2); luz.castShadow = false; grupo.add(luz);
    const sino = malha(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xffd23f, { metalness: 0.6, roughness: 0.3 });
    sino.position.set((BALCAO.x0 + BALCAO.x1) / 2 + 0.4, 1.0, BALCAO.z0 + 0.8); grupo.add(sino);
    // quadro de pedidos no chão: um prato por pedido
    pecas.pratos = QUADRO.xs.map(x => {
      const g = new THREE.Group(); g.position.set(x, 0, QUADRO.z);
      const prato = malha(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 28), 0xffffff, { roughness: 0.4 }); prato.position.y = 0.08; prato.castShadow = false;
      const aro = malha(new THREE.CylinderGeometry(1.55, 1.55, 0.05, 28), 0x3a4452); aro.position.y = 0.06; aro.castShadow = false;
      const icones = [-0.55, 0.55].map(dx => {
        const ic = new THREE.Group(); ic.position.set(dx, 0.5, 0);
        const lista = [0, 1, 2].map(t => { const f = fruta(c, t, 1.1); f.visible = false; ic.add(f); return f; });
        g.add(ic); return { ic, lista };
      });
      g.add(aro, prato); g.visible = false; grupo.add(g);
      return { g, icones };
    });
    // ingrediente na mão de cada jogador, acima do nome
    pecas.maos = c.bonecos.map(() => {
      const g = new THREE.Group();
      const lista = [0, 1, 2].map(t => { const f = fruta(c, t, 1.5); f.visible = false; g.add(f); return f; });
      grupo.add(g); return { g, lista };
    });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    if (!pecas.pratos) return;
    pecas.pratos.forEach((slot, k) => {
      const o = d.pedidos[k];
      slot.g.visible = !!o;
      if (!o) return;
      slot.icones.forEach((ic, m) => {
        const faltando = m < o.total.length && !o.feito[m];
        ic.ic.visible = m < o.total.length;
        ic.lista.forEach((f, tipo) => { f.visible = ic.ic.visible && o.total[m] === tipo; f.scale.setScalar(faltando ? 1 : 0.55); f.position.y = faltando ? 0.1 * Math.sin(t * 3 + k + m) : -0.15; });
      });
    });
    c.bonecos.forEach((b, i) => {
      const mao = pecas.maos[i];
      mao.g.visible = d.leva[i] >= 0;
      mao.g.position.set(b.position.x, b.position.y + 3.15 + 0.1 * Math.sin(t * 5 + i), b.position.z);
      mao.lista.forEach((f, tipo) => { f.visible = d.leva[i] === tipo; f.rotation.y = t * 2; });
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'pegou') c.particulas(e.x, 1.4, e.z, CORES[e.t], 8, 4);
      else if (e.tipo === 'entrega') c.particulas(e.x, 1.4, e.z, CORES[e.t], 10, 5);
      else if (e.tipo === 'pronto') c.particulas(e.x, 1.6, e.z, 0x6bff9a, 26, 8);
      else c.particulas(e.x, 2.4, e.z, 0xff4a4a, 8, 4);
    }
  },
};

// Desenho de cada ingrediente: silhueta própria (disco, bola, cunha) além da cor.
function fruta(c, tipo, escala) {
  const { THREE, malha } = c, g = new THREE.Group();
  if (tipo === 0) { const m = malha(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 20), CORES[0], { roughness: 0.8 }); m.position.y = 0.2; g.add(m); }
  else if (tipo === 1) { const m = malha(new THREE.SphereGeometry(0.45, 16, 12), CORES[1], { roughness: 0.4, emissive: 0x440800 }); m.position.y = 0.4; g.add(m); }
  else { const m = malha(new THREE.ConeGeometry(0.55, 0.7, 3), CORES[2], { roughness: 0.5, emissive: 0x442200 }); m.rotation.z = Math.PI / 2; m.position.y = 0.35; g.add(m); }
  g.scale.setScalar(escala);
  return g;
}
