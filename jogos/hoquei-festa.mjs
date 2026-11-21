// Hóquei de mesa na festa (todos contra todos ou times). Cada jogador defende o seu gol: com 2, frente a frente; com 3, três lados;
// com 4, um gol em cada lado da mesa. Em times os dois gols da dupla ficam na mesma parede e as vidas somam.
// O disco quica pela mesa (um segundo disco entra aos 15 s). Quem leva gol perde uma vida (são 3); sem vidas o gol fecha e o dono sai.
// Vence o último com vida (ou a dupla), ou quem tiver mais vidas no fim do tempo. Anda-se pela mesa toda; a Tacada é o empurrão do motor.
import { timeDe, elimina, colide, quem, RAIO } from '../logica.mjs';

export const LX = 9.5, LZ = 7, VIDAS = 3, TEMPO = 50, T_SEGUNDO = 15;
const GOL = 2.3, GOL_DUPLA = 1.9, C_DUPLA = 3.4, FRENTE = 2.4;
const R_DISCO = 0.7, MASSA = 0.3, V_MAX = 18, V_LENTO = 1.2, T_LENTO = 3, V_EMPURRAO = 8, V_SAIDA = 7, PAUSA = 1, QUIQUE = 0.95;
const NOME_TIME = ['laranja', 'roxa'];
const MESA = 0x14304f, LINHA = 0x9fd6ff, BRANCO = 0xffffff, APAGADO = 0x30343f;

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // de quem é a vida no placar: do jogador ou da dupla
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);
// Centro da boca do gol e a direção para fora da mesa.
const boca = g => (g.eixo === 'x' ? { x: g.s * LX, z: g.c, nx: g.s, nz: 0 } : { x: g.c, z: g.s * LZ, nx: 0, nz: g.s });

// Um gol por jogador. eixo 'x': parede da esquerda (s -1) ou da direita (s 1), boca ao longo de z com centro c e meia largura h.
function montaGols(p) {
  const n = p.jogadores.length;
  if (times(p)) return p.jogadores.map((_, i) => ({ dono: i, eixo: 'x', s: i % 2 ? 1 : -1, c: i < 2 ? -C_DUPLA : C_DUPLA, h: GOL_DUPLA }));
  return [['x', -1], ['x', 1], ['z', -1], ['z', 1]].slice(0, n).map(([eixo, s], i) => ({ dono: i, eixo, s, c: 0, h: GOL }));
}

// Disco novo no centro: espera um instante e sai na direção de um canto (nunca direto para um gol).
function novoDisco(p) {
  const sx = p.rng() < 0.5 ? -1 : 1, sz = p.rng() < 0.5 ? -1 : 1, a = Math.atan2(LZ, LX) + (p.rng() - 0.5) * 0.16;
  return { x: 0, z: 0, vx: 0, vz: 0, pausa: PAUSA, sx: sx * Math.cos(a) * V_SAIDA, sz: sz * Math.sin(a) * V_SAIDA, lento: 0, som: 0 };
}

// Parede ou gol: devolve o gol aberto em que o disco entrou, ou undefined (quicou ou segue).
function bordas(d, b) {
  for (const [eixo, t, limite] of [['x', 'z', LX], ['z', 'x', LZ]]) {
    if (Math.abs(b[eixo]) <= limite - R_DISCO) continue;
    const s = Math.sign(b[eixo]), v = 'v' + eixo;
    const g = d.gols.find(o => o.eixo === eixo && o.s === s && d.vidas[o.dono] > 0 && Math.abs(b[t] - o.c) < o.h);
    if (!g) { b[eixo] = s * (limite - R_DISCO); if (b[v] * s > 0) b[v] *= -QUIQUE; } else if (Math.abs(b[eixo]) > limite) return g;
  }
}

function levaGol(p, d, g, b) {
  const i = g.dono, j = p.jogadores[i], m = boca(g);
  d.vidas[i]--;
  d.fx.push({ tipo: 'gol', x: m.x, z: m.z, i });
  d.aviso = `${quem(p, i)} levou gol!`; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
  p.eventos.push('gol');
  p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
  if (d.vidas[i] <= 0) { elimina(p, j, 12); p.eventos.push('queda'); d.aviso = `${quem(p, i)} saiu!`; d.avisoCor = '#ff4a4a'; d.avisoT = 1.5; }
  Object.assign(b, novoDisco(p));
}

function moveDisco(p, d, b, dt) {
  if (b.pausa > 0) {                         // esperando no centro
    b.pausa -= dt;
    if (b.pausa <= 0) { b.vx = b.sx; b.vz = b.sz; }
    return;
  }
  b.som -= dt;
  for (const j of p.jogadores) {
    if (!j.vivo || !colide(j, b, RAIO, R_DISCO, 1, MASSA)) continue;
    if (b.som <= 0) { b.som = 0.15; p.eventos.push('batida'); d.fx.push({ tipo: 'toque', x: b.x, z: b.z }); }
  }
  for (const o of d.discos) if (o !== b && o.pausa <= 0) colide(b, o, R_DISCO, R_DISCO, 1, 1);

  const at = Math.pow(0.88, dt);
  b.vx *= at; b.vz *= at;
  const v = Math.hypot(b.vx, b.vz);
  if (v > V_MAX) { b.vx *= V_MAX / v; b.vz *= V_MAX / v; }
  // disco quase parado por 3 s (canto, trave, encostado na parede): empurrão para o centro
  b.lento = v < V_LENTO ? b.lento + dt : 0;
  if (b.lento >= T_LENTO) {
    b.lento = 0;
    const dist = Math.hypot(b.x, b.z);
    let dx = p.rng() < 0.5 ? -1 : 1, dz = p.rng() - 0.5;
    if (dist > 1) { dx = -b.x / dist; dz = -b.z / dist; }
    const len = Math.hypot(dx, dz) || 1;
    b.vx = dx / len * V_EMPURRAO; b.vz = dz / len * V_EMPURRAO;
    p.eventos.push('dash');
  }
  b.x += b.vx * dt; b.z += b.vz * dt;
  const g = bordas(d, b);
  if (g) levaGol(p, d, g, b);
}

function somaVidas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Último dono (jogador ou dupla) com vida; no tempo, o de mais vidas (igual dá empate).
function resultado(p) {
  const pl = p.dados.placar, restam = pl.flatMap((v, k) => (v > 0 ? [k] : []));
  if (restam.length <= 1) return restam.length ? restam[0] : -1;
  if (p.t >= TEMPO) {
    const maior = Math.max(...pl), lideres = pl.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) { d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`; d.avisoCor = '#ffd23f'; }
  p.jogadores.forEach((_, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (d.vidas[i] <= 0) t = times(p) ? 'Você saiu. Torça pela dupla!' : 'Você saiu. Torça!';
    else t = `Vidas: ${d.vidas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} Defenda o seu gol!`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'hoquei-festa', genero: 'gol', nome: 'Hóquei de todos', dica: 'Defenda o gol da sua cor e mande o disco no gol dos outros: cada gol tira uma vida.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  // semPulo: pular por cima do disco não é defesa (e com isso a lua não sai aqui). Gelo, foguete, espelho, turbo e dash só mexem no andar: valem.
  controle: { modo: 'padrao', a: 'Tacada', b: '' }, semPulo: true, rotulo: 'vidas', duracao: TEMPO, tema: 2,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    p.dados = { gols: [], vidas: Array(n).fill(VIDAS), discos: [novoDisco(p)], segundo: false, fx: [], placar: [], inventario: [], aviso: '', avisoCor: '#ffd23f', avisoT: 0 };
    p.dados.gols = montaGols(p);
    p.dados.gols.forEach((g, i) => { const m = boca(g), j = p.jogadores[i]; j.x = m.x - m.nx * FRENTE; j.z = m.z - m.nz * FRENTE; });      // cada um na frente do seu gol
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    if (!d.segundo && p.t >= T_SEGUNDO) {
      d.segundo = true;
      d.discos.push(novoDisco(p));
      d.aviso = 'Disco extra!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
      p.eventos.push('troca');
    }
    for (const b of d.discos) moveDisco(p, d, b, dt);

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, d = p.dados;
    pecas.visto = 0; pecas.brilho = d.gols.map(() => 0);
    const chato = (geo, cor, y, extra = {}) => {
      const m = malha(geo, cor, { emissive: cor, emissiveIntensity: 0.7, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m);
      return m;
    };
    // a mesa: tampo escuro (o disco branco aparece de longe), linhas claras e círculo central
    const mesa = malha(new THREE.BoxGeometry(LX * 2, 0.04, LZ * 2), MESA, { roughness: 0.25, metalness: 0.1, emissive: 0x0a1c33, emissiveIntensity: 0.6 });
    mesa.position.y = 0.02; mesa.castShadow = false; grupo.add(mesa);
    for (const [lx, lz] of [[0.14, LZ * 2], [LX * 2, 0.14]]) {
      const l = malha(new THREE.BoxGeometry(lx, 0.02, lz), LINHA, { emissive: LINHA, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 });
      l.position.y = 0.05; l.castShadow = false; grupo.add(l);
    }
    chato(new THREE.RingGeometry(1.9, 2.1, 48), LINHA, 0.055);
    chato(new THREE.CircleGeometry(0.35, 20), LINHA, 0.06);

    // um gol por jogador, na cor dele (ou da dupla). Grupo virado para fora da mesa: +x local é o fundo do gol.
    pecas.gols = d.gols.map((g, i) => {
      const cor = corDe(c, i), m = boca(g), gg = new THREE.Group();
      gg.position.set(m.x, 0, m.z); gg.rotation.y = Math.atan2(-m.nz, m.nx);
      const area = malha(new THREE.RingGeometry(g.h - 0.16, g.h + 0.06, 40, 1, Math.PI / 2, Math.PI), cor, { emissive: cor, emissiveIntensity: 0.8 });
      area.rotation.x = -Math.PI / 2; area.position.y = 0.06; area.castShadow = false;
      const miolo = malha(new THREE.CircleGeometry(g.h - 0.16, 40, Math.PI / 2, Math.PI), cor, { transparent: true, opacity: 0.32 });
      miolo.rotation.x = -Math.PI / 2; miolo.position.y = 0.052; miolo.castShadow = false;
      const vao = malha(new THREE.BoxGeometry(1.3, 0.95, g.h * 2), 0x0b0f18); vao.position.set(0.66, 0.47, 0); vao.castShadow = false;      // cobre o muro: a boca do gol
      const fundo = malha(new THREE.BoxGeometry(0.22, 1.5, g.h * 2 + 0.5), cor, { emissive: cor, emissiveIntensity: 0.7 }); fundo.position.set(1.4, 0.75, 0);
      const traves = [-1, 1].map(k => {
        const t = malha(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12), BRANCO, { emissive: cor, emissiveIntensity: 0.9 });
        t.position.set(0.05, 0.8, k * (g.h + 0.12)); return t;
      });
      const portao = malha(new THREE.BoxGeometry(0.4, 1.3, g.h * 2), 0x7c8698, { roughness: 0.6 }); portao.position.set(0.1, 0.65, 0); portao.visible = false;
      // as vidas: três lâmpadas em cima do fundo do gol
      const luzes = Array.from({ length: VIDAS }, (_, k) => {
        const l = malha(new THREE.SphereGeometry(0.42, 16, 12), cor, { emissive: cor, emissiveIntensity: 1 });
        l.position.set(1.4, 1.95, (k - 1) * Math.min(1.25, g.h * 0.6)); l.castShadow = false; return l;
      });
      gg.add(area, miolo, vao, fundo, portao, ...traves, ...luzes); grupo.add(gg);
      return { fundo, traves, portao, luzes, area, miolo, cor };
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;

    const ms = c.pool('discos', d.discos.length, () => {
      const g = new THREE.Group();
      const corpo = c.malha(new THREE.CylinderGeometry(R_DISCO, R_DISCO, 0.3, 28), 0x10131c, { roughness: 0.3 });
      const topo = c.malha(new THREE.CylinderGeometry(R_DISCO * 0.74, R_DISCO * 0.74, 0.06, 28), BRANCO, { emissive: BRANCO, emissiveIntensity: 1 });
      topo.position.y = 0.17;
      const aro = c.malha(new THREE.TorusGeometry(R_DISCO, 0.08, 8, 28), BRANCO, { emissive: BRANCO, emissiveIntensity: 1.1 });
      aro.rotation.x = Math.PI / 2;
      g.add(corpo, topo, aro); g.userData = { topo };
      return g;
    });
    d.discos.forEach((b, n) => {
      const g = ms[n], v = Math.hypot(b.vx, b.vz);
      g.position.set(b.x, 0.22, b.z);
      g.rotation.y += dt * (2 + v);
      g.visible = !(b.pausa > 0) || Math.floor(t * 12) % 2 === 0;            // pisca enquanto espera no centro
      g.userData.topo.material.emissiveIntensity = 0.7 + v / V_MAX;
    });

    pecas.gols.forEach((g, i) => {
      const aberto = d.vidas[i] > 0;
      pecas.brilho[i] = Math.max(0, pecas.brilho[i] - dt);
      const forte = pecas.brilho[i] > 0 && Math.floor(t * 16) % 2 === 0;       // o gol que levou o disco pisca forte por um instante
      g.fundo.material.emissiveIntensity = !aberto ? 0.1 : forte ? 2.2 : 0.7;
      for (const tr of g.traves) tr.material.emissiveIntensity = aberto ? 0.9 : 0.1;
      g.portao.visible = !aberto; g.area.visible = g.miolo.visible = aberto;
      g.luzes.forEach((l, k) => {
        const acesa = k < d.vidas[i];
        l.material.color.set(acesa ? g.cor : APAGADO);
        l.material.emissiveIntensity = acesa ? 1 + Math.sin(t * 6 + k) * 0.2 : 0;
      });
    });

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'gol') {
        pecas.brilho[e.i] = 1.4;
        c.particulas(e.x, 0.8, e.z, corDe(c, e.i), 30, 11);
        c.particulas(e.x, 0.8, e.z, BRANCO, 14, 8);
        c.som(150, 0.35, 'sawtooth', 0.12);       // sirene do gol
      } else { c.particulas(e.x, 0.4, e.z, BRANCO, 6, 5); c.som(880, 0.04, 'square', 0.04); }
    }
  },
};
