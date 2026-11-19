// Cartas no chao: jogo da memoria em tamanho gigante. Os dois correm pela mesa, ficam em cima de uma carta e apertam Vira.
// Carta virada fica aberta uns segundos para os dois verem. Quem vira a carta que combina com uma aberta leva o par.
import { posiciona, maiorPlacar, quem } from '../logica.mjs';

const COLUNAS = 5, LINHAS = 3, PASSO = 3.8, LADO = 2.8, VAZIA = 7;       // a casa do meio fica vazia: 14 cartas, 7 pares
const PARES = 7, LIMITE = 40, T_ESPIA = 3.4, T_ABERTA = 3.2, T_ABERTA_MIN = 1.9, MAX_ABERTAS = 4;
const ALCANCE = 1.7, T_PAUSA = 0.35;
const COR_PAR = [0xe5383b, 0xff8a1f, 0xffd23f, 0x9bdc3c, 0x2ad4d9, 0x9a4dff, 0xf2f2f2];

function posicoes() {
  const lista = [];
  for (let r = 0; r < LINHAS; r++)
    for (let c = 0; c < COLUNAS; c++) {
      if (r * COLUNAS + c === VAZIA) continue;
      lista.push({ x: (c - (COLUNAS - 1) / 2) * PASSO, z: (r - (LINHAS - 1) / 2) * PASSO });
    }
  return lista;
}

function embaralha(rng, lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)) % (i + 1); [l[i], l[k]] = [l[k], l[i]]; }
  return l;
}

const restam = d => PARES - d.placar[0] - d.placar[1];
const tempoAberta = d => Math.max(T_ABERTA_MIN, T_ABERTA - 0.2 * (PARES - restam(d)));

// A carta (ainda virada para baixo) mais perto do jogador, se ele estiver em cima dela.
function cartaSob(d, j) {
  let melhor = -1, dist = Infinity;
  d.cartas.forEach((c, k) => {
    const dx = Math.abs(j.x - c.x), dz = Math.abs(j.z - c.z);
    if (dx > ALCANCE || dz > ALCANCE || c.estado !== 'baixo') return;
    const m = dx * dx + dz * dz;
    if (m < dist) { dist = m; melhor = k; }
  });
  return melhor;
}

function textoCelular(p, i) {
  const d = p.dados;
  if (d.espia > 0) return 'Decore onde está cada figura!';
  return `Pares: você ${d.placar[i]}, rival ${d.placar[1 - i]}`;
}

function atualizaCelulares(p) {
  for (const i of [0, 1]) p.celular[i] = { texto: textoCelular(p, i), vibra: p.dados.vibra[i] };
}

function aviso(d, texto, seg, cor = '#ffd84d') { d.aviso = texto; d.avisoCor = cor; d.avisoT = seg; }

// Vira a carta k para o jogador i. Se combina com uma aberta, leva as duas.
function vira(p, i, k) {
  const d = p.dados, c = d.cartas[k];
  const par = d.cartas.findIndex((o, n) => n !== k && o.estado === 'alto' && o.par === c.par);
  d.fx.push({ tipo: 'vira', k, quem: i });
  p.eventos.push('troca');
  if (par >= 0) {
    for (const o of [c, d.cartas[par]]) { o.estado = 'ganha'; o.dono = i; }
    d.placar[i]++; d.vibra[i]++;
    d.fx.push({ tipo: 'par', k, outra: par, quem: i });
    p.eventos.push('moeda'); p.eventos.push('ponto');
    aviso(d, `${quem(p, i)} fez um par!`, 1.2);
    atualizaCelulares(p);
    return;
  }
  c.estado = 'alto'; c.t = tempoAberta(d);
  const abertas = d.cartas.filter(o => o.estado === 'alto').sort((a, b) => a.t - b.t);
  if (abertas.length > MAX_ABERTAS) abertas[0].estado = 'baixo';           // a mais antiga fecha na hora
}

function fecha(p, v) {
  const d = p.dados;
  const texto = v < 0 ? 'Empate!' : `${quem(p, v)} venceu!`;
  aviso(d, texto, 99);
  for (const i of [0, 1]) p.celular[i] = { texto: v < 0 ? `Empate em ${d.placar[i]} x ${d.placar[1 - i]}` : v === i ? `Você venceu por ${d.placar[i]} x ${d.placar[1 - i]}!` : `Você perdeu por ${d.placar[i]} x ${d.placar[v]}`, vibra: d.vibra[i] };
  return v;
}

function criaCartas(c) {
  const { THREE, malha, grupo, pecas } = c;
  pecas.cartas = [];
  c.p.dados.cartas.forEach((carta, k) => {
    const cor = COR_PAR[carta.par];
    const lado = new THREE.MeshStandardMaterial({ color: 0xe8dcc0 });
    const topo = new THREE.MeshStandardMaterial({ color: 0xf4e6c4 });
    const frente = new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.22 });
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(LADO, 0.16, LADO), [lado, lado, topo, frente, lado, lado]);
    corpo.castShadow = true; corpo.receiveShadow = true;
    const losango = malha(new THREE.BoxGeometry(1.5, 0.03, 1.5), 0xb3263e); losango.rotation.y = Math.PI / 4; losango.position.y = 0.09; losango.castShadow = false;
    const miolo = malha(new THREE.BoxGeometry(0.7, 0.03, 0.7), 0xffd23f, { emissive: 0x6a4f00, emissiveIntensity: 0.6 }); miolo.rotation.y = Math.PI / 4; miolo.position.y = 0.11; miolo.castShadow = false;
    corpo.add(losango, miolo);
    const g = new THREE.Group(); g.add(corpo); g.position.set(carta.x, 0.3, carta.z);
    const haste = malha(new THREE.CylinderGeometry(0.07, 0.07, 3, 8), cor, { emissive: cor, emissiveIntensity: 0.4 }); haste.position.y = 1.6; haste.castShadow = false;
    const figura = malha(pecas.geos[carta.par], cor, { emissive: cor, emissiveIntensity: 0.3 }); figura.position.y = 3.6;
    const pino = new THREE.Group(); pino.add(haste, figura); pino.position.set(carta.x, 0, carta.z); pino.scale.setScalar(0.001);
    grupo.add(g, pino);
    pecas.cartas[k] = { g, pino, figura, frente, ang: Math.PI, esc: 0, ganhou: false };
  });
}

export default {
  id: 'cartas-chao', genero: 'memoria', nome: 'Cartas no chão',
  dica: 'Fique sobre uma carta e aperte Vira. Achou o par de uma carta aberta? O ponto é seu!',
  controle: { modo: 'padrao', a: 'EMPURRA', b: 'VIRA' }, semPulo: true, semNome: true, tema: 2, rotulo: 'pares', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 7.2, parede: true };
    posiciona(p, 9.9, 0);
    const lugares = posicoes();
    const figuras = embaralha(p.rng, Array.from({ length: PARES * 2 }, (_, k) => k % PARES));
    p.dados = {
      placar: [0, 0], vibra: [0, 0], fx: [], cd: [0, 0], sob: [-1, -1], prio: 0, espia: T_ESPIA, avisoT: 0,
      cartas: lugares.map((l, k) => ({ ...l, par: figuras[k], estado: 'alto', t: 0, dono: -1 })),
    };
    aviso(p.dados, 'Decore as figuras!', T_ESPIA);
    atualizaCelulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0 && p.t < LIMITE) d.aviso = ''; }
    d.cd = d.cd.map(c => Math.max(0, c - dt));

    if (d.espia > 0) {
      d.espia -= dt;
      if (d.espia <= 0) {
        for (const c of d.cartas) c.estado = 'baixo';
        aviso(d, 'Vai!', 1); p.eventos.push('dash'); atualizaCelulares(p);
      }
    } else {
      for (const c of d.cartas) if (c.estado === 'alto') { c.t -= dt; if (c.t <= 0) c.estado = 'baixo'; }
      d.prio = 1 - d.prio;                                       // quem vira primeiro no mesmo quadro alterna
      for (const i of [d.prio, 1 - d.prio]) {
        const j = p.jogadores[i];
        if (!j.apertouB || d.cd[i] > 0) continue;
        const k = cartaSob(d, j);
        if (k < 0) continue;
        d.cd[i] = T_PAUSA;
        vira(p, i, k);
      }
    }
    d.sob = p.jogadores.map(j => (d.espia > 0 ? -1 : cartaSob(d, j)));

    if (restam(d) === 0 || p.t >= LIMITE) return fecha(p, maiorPlacar(p));
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const mesa = malha(new THREE.BoxGeometry(23, 0.2, 15.2), 0x1c2a4d, { roughness: 0.9 });
    mesa.position.y = 0.02; mesa.castShadow = false; grupo.add(mesa);
    const borda = [[0, -7.7, 23, 0.5], [0, 7.7, 23, 0.5], [-11.7, 0, 0.5, 16.2], [11.7, 0, 0.5, 16.2]];
    for (const [x, z, w, h] of borda) { const b = malha(new THREE.BoxGeometry(w, 0.5, h), 0x8a5a2b); b.position.set(x, 0.1, z); grupo.add(b); }
    pecas.geos = [
      new THREE.SphereGeometry(0.95, 22, 16), new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.ConeGeometry(0.95, 1.9, 22),
      new THREE.TorusGeometry(0.75, 0.32, 14, 28), new THREE.OctahedronGeometry(1.1), new THREE.CylinderGeometry(0.5, 0.5, 1.9, 18),
      new THREE.TorusKnotGeometry(0.62, 0.24, 56, 8),
    ];
    for (const l of posicoes()) {                                // moldura de cada carta
      const m = malha(new THREE.BoxGeometry(LADO + 0.5, 0.06, LADO + 0.5), 0x121c38);
      m.position.set(l.x, 0.14, l.z); m.castShadow = false; grupo.add(m);
    }
    const meio = malha(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 28), 0xffd23f, { emissive: 0x6a4f00, emissiveIntensity: 0.6 });
    meio.position.set(0, 0.16, 0); grupo.add(meio);
    pecas.aneis = [0, 1].map(i => {
      const a = malha(new THREE.RingGeometry(1.0 - i * 0.26, 1.28 - i * 0.26, 36), cores[i], { emissive: cores[i], emissiveIntensity: 0.9, side: THREE.DoubleSide });
      a.rotation.x = -Math.PI / 2; a.castShadow = false; grupo.add(a); return a;
    });
    pecas.cartas = null; pecas.visto = 0;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, pc = c.pecas;
    if (!pc.cartas) criaCartas(c);
    d.cartas.forEach((carta, k) => {
      const v = pc.cartas[k], alvo = carta.estado === 'baixo' ? 0 : Math.PI;
      v.ang += (alvo - v.ang) * Math.min(1, dt * 14);
      v.g.rotation.x = v.ang;
      v.g.position.y = (carta.estado === 'ganha' ? 0.2 : 0.3) + Math.sin(Math.min(Math.PI, Math.max(0, v.ang))) * 0.9;
      const grande = carta.estado === 'alto' ? 1 : 0;
      v.esc += (grande - v.esc) * Math.min(1, dt * 12);
      const pisca = carta.estado === 'alto' && carta.t < 0.8 && d.espia <= 0 && Math.floor(t * 10) % 2 === 0;
      v.pino.visible = v.esc > 0.04 && !pisca;
      v.pino.scale.setScalar(Math.max(0.001, v.esc));
      v.figura.rotation.y += dt * 1.6; v.figura.position.y = 3.6 + Math.sin(t * 3 + k) * 0.12;
      if (carta.estado === 'ganha' && !v.ganhou) {
        v.ganhou = true; const cor = c.cores[carta.dono];
        v.frente.color.set(cor); v.frente.emissive.set(cor); v.frente.emissiveIntensity = 0.5;
      }
      v.g.scale.setScalar(carta.estado === 'ganha' ? 0.86 : 1);
    });
    pc.aneis.forEach((a, i) => {
      const k = d.sob[i];
      a.visible = k >= 0;
      if (k >= 0) a.position.set(d.cartas[k].x, 0.42, d.cartas[k].z);
    });
    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto], carta = d.cartas[f.k];
      if (f.tipo === 'vira') { c.som(420 + carta.par * 40, 0.12, 'triangle', 0.14); c.particulas(carta.x, 0.6, carta.z, COR_PAR[carta.par], 10, 4); continue; }
      const cor = c.cores[f.quem], o = d.cartas[f.outra];
      c.som(660, 0.15, 'triangle', 0.2); c.som(990, 0.3, 'triangle', 0.2);
      for (const m of [carta, o]) { c.particulas(m.x, 1.2, m.z, cor, 24, 8); c.particulas(m.x, 2.4, m.z, 0xffd23f, 16, 7); }
    }
  },
};
