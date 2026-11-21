// Dança das cadeiras da festa (todos contra todos ou times). Há sempre uma cadeira a menos que os jogadores em pé.
// Com a música tocando todos ficam presos na pista do meio e as cadeiras giram em volta; quando ela para, em momento
// sorteado, cada um corre para uma cadeira (o empurrão do motor tira o rival do caminho). Quem sobra de pé perde uma vida.
// Todos contra todos: 2 vidas cada um, quem zera sai e o último de pé vence. Times: 3 vidas por time, sempre os 4 e 3 cadeiras.
// No fim do tempo vence quem (ou o time que) tem mais vidas; igual dá empate.
import { posicionaRoda, timeDe, quem, elimina } from '../logica.mjs';

export const TEMPO = 50, VIDAS_VS = 2, VIDAS_TIME = 3, R_PISTA = 3.4;
const R_ARENA = 9, R_CADEIRA = 6.6, ALCANCE = 1.5, FOLGA_PISTA = 0.6, PUXA = 14;
const T_MUSICA = 1.8, T_MUSICA_VAR = 2.2, T_FREIA = 0.6, VEL = 1.7;
const T_CORRE_MAX = 2.5, T_SENTADO = 1.2, T_BATIDA = 0.25;
const NOTAS = [262, 330, 392, 523, 392, 330, 294, 392];
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e a vida: do jogador ou do time
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

function novaRodada(p, d) {
  const n = p.jogadores.filter(j => j.vivo).length - 1, a0 = p.rng() * Math.PI * 2;
  d.cadeiras = Array.from({ length: n }, (_, k) => ({ base: a0 + k * Math.PI * 2 / n, a: 0, x: 0, z: 0, dono: -1 }));
  d.sentou = p.jogadores.map(() => -1);
  d.fase = 'musica'; d.tFase = 0; d.rot = 0; d.dePe = -1;
  d.dur = T_MUSICA + p.rng() * T_MUSICA_VAR;
  d.dir = d.rodada++ % 2 ? -1 : 1;
  giraCadeiras(d);
}

function giraCadeiras(d) {
  for (const ch of d.cadeiras) { ch.a = ch.base + d.rot; ch.x = Math.cos(ch.a) * R_CADEIRA; ch.z = Math.sin(ch.a) * R_CADEIRA; }
}

function musica(p, d, dt) {
  const resta = d.dur - d.tFase, lim = R_PISTA - FOLGA_PISTA;
  d.vel = resta <= 0 ? 0 : VEL * Math.min(1, resta / T_FREIA);        // freia no fim: a pista de que vai parar
  d.rot += d.dir * d.vel * dt;
  giraCadeiras(d);
  d.batidaT += dt * d.vel / VEL;
  if (d.batidaT >= T_BATIDA) { d.batidaT -= T_BATIDA; d.batida++; }
  for (const j of p.jogadores) {                                       // a cerca da pista: quem esta fora e puxado para dentro
    const r = Math.hypot(j.x, j.z);
    if (!j.vivo || r <= lim) continue;
    const novo = Math.max(lim, r - PUXA * dt);
    j.x *= novo / r; j.z *= novo / r;
  }
  if (resta > 0) return;
  d.fase = 'corre'; d.tFase = 0; d.vel = 0;
  d.aviso = 'Parou!'; d.avisoCor = '#ffd23f'; d.avisoT = 0.9;
  d.fx.push({ tipo: 'para' });
  p.eventos.push('troca');
  p.jogadores.forEach((j, i) => { if (j.vivo) vibra(p, i); });
}

function senta(p, d, i, k) {
  const ch = d.cadeiras[k];
  ch.dono = i; d.sentou[i] = k;
  d.fx.push({ tipo: 'senta', x: ch.x, z: ch.z, i });
  p.eventos.push('ponto');
}

// Cada cadeira livre e do jogador em pe mais perto dela (sem favorecer o J1); passado o tempo, vale o mais perto a qualquer distancia.
function corre(p, d) {
  const alcance = d.tFase >= T_CORRE_MAX ? Infinity : ALCANCE;
  d.cadeiras.forEach((ch, k) => {
    if (ch.dono >= 0) return;
    let melhor = -1, dist = alcance;
    p.jogadores.forEach((j, i) => {
      const r = Math.hypot(j.x - ch.x, j.z - ch.z);
      if (j.vivo && d.sentou[i] < 0 && r < dist) { dist = r; melhor = i; }
    });
    if (melhor >= 0) senta(p, d, melhor, k);
  });
  if (d.cadeiras.some(ch => ch.dono < 0)) return;
  const i = p.jogadores.findIndex((j, q) => j.vivo && d.sentou[q] < 0), de = dono(p)(i);
  d.dePe = i; d.fase = 'sentado'; d.tFase = 0;
  d.vidas[de] = Math.max(0, d.vidas[de] - 1);
  d.aviso = `${quem(p, i)} ficou de pé!`; d.avisoCor = '#ffffff'; d.avisoT = T_SENTADO;
  d.fx.push({ tipo: 'dePe', x: p.jogadores[i].x, z: p.jogadores[i].z, i });
  p.eventos.push('queda'); vibra(p, i);
  if (p.modo !== 'times' && d.vidas[i] <= 0) elimina(p, p.jogadores[i], 13);       // sem vidas: voa para fora da festa
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  p.jogadores.forEach((j, i) => {
    const vidas = `${times ? 'Vidas do time' : 'Vidas'}: ${d.vidas[de(i)]}.`;
    const t = fim ? fim[i] : !j.vivo ? 'Sem vidas. Torça!'
      : d.fase === 'musica' ? `${vidas} Dance no meio.`
      : d.fase === 'corre' ? (d.sentou[i] >= 0 ? `${vidas} Sentou!` : `${vidas} Corra para uma cadeira!`)
      : `${vidas} ${d.dePe === i ? 'Ficou de pé.' : 'Sentou!'}`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff'; d.avisoT = 0;
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'cadeiras-festa', genero: 'ritmo', nome: 'Dança das cadeiras da festa',
  dica: 'Dance no meio e, quando a música parar, corra para uma cadeira, porque quem sobra de pé perde uma vida.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: '' }, semPulo: true, rotulo: 'vidas', duracao: TEMPO, tema: 1,

  inicia(p) {
    const n = p.jogadores.length, times = p.modo === 'times';
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    posicionaRoda(p, 1.8);
    p.dados = {
      vidas: times ? [VIDAS_TIME, VIDAS_TIME] : Array(n).fill(VIDAS_VS), placar: [], inventario: [],
      fase: 'musica', rodada: 0, tFase: 0, dur: 0, rot: 0, vel: VEL, dir: 1, batidaT: 0, batida: 0,
      cadeiras: [], sentou: [], dePe: -1, fx: [], aviso: '', avisoT: 0,
    };
    novaRodada(p, p.dados);
    p.dados.placar = [...p.dados.vidas];
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tFase += dt;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    if (d.fase === 'musica') musica(p, d, dt);
    else if (d.fase === 'corre') corre(p, d);
    else if (d.tFase >= T_SENTADO) novaRodada(p, d);
    p.jogadores.forEach((j, i) => {                                    // quem sentou fica na cadeira
      const ch = d.cadeiras[d.sentou[i]];
      if (ch) Object.assign(j, { x: ch.x, z: ch.z, vx: 0, vz: 0, vy: 0, y: 0.6 });
    });
    d.placar = [...d.vidas];
    if (p.modo !== 'times') d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    celulares(p);

    const restam = d.vidas.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return fechaComo(p, restam.length ? restam[0] : -1);
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.vidas), lideres = d.vidas.flatMap((v, k) => (v === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    pecas.visto = 0; pecas.vistaBatida = 0;

    const palco = malha(new THREE.CylinderGeometry(R_ARENA, R_ARENA, 0.05, 56), 0x4a2f6b, { roughness: 0.5, emissive: 0x1d0f33, emissiveIntensity: 0.5 });
    palco.position.y = 0.025; palco.castShadow = false; grupo.add(palco);
    const borda = malha(new THREE.TorusGeometry(R_ARENA - 0.25, 0.12, 6, 64), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.7 });
    borda.rotation.x = Math.PI / 2; borda.position.y = 0.08; borda.castShadow = false; grupo.add(borda);

    // pista de danca no meio: 12 fatias que piscam com a batida e a cerca de luz que prende todo mundo enquanto toca
    pecas.fatias = Array.from({ length: 12 }, (_, k) => {
      const f = malha(new THREE.CylinderGeometry(R_PISTA, R_PISTA, 0.06, 6, 1, false, k * Math.PI / 6, Math.PI / 6), 0xffffff, { roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.2 });
      f.position.y = 0.06; f.castShadow = false; grupo.add(f); return f;
    });
    pecas.cerca = malha(new THREE.TorusGeometry(R_PISTA + 0.1, 0.16, 8, 48), 0xffffff, { emissive: 0x9ff6ff, emissiveIntensity: 1 });
    pecas.cerca.rotation.x = Math.PI / 2; pecas.cerca.position.y = 0.2; pecas.cerca.castShadow = false; grupo.add(pecas.cerca);

    // notas musicais (cabeca e haste) que rodam em volta da pista enquanto a musica toca
    pecas.notas = [0xfff3c4, 0xd8f7ff, 0xffe0f0, 0xe9ffd8, 0xfff3c4, 0xd8f7ff].map(cor => {
      const g = new THREE.Group(), mat = { emissive: cor, emissiveIntensity: 0.7 };
      const cabeca = malha(new THREE.SphereGeometry(0.3, 10, 8), cor, mat); cabeca.scale.set(1.2, 0.85, 1);
      const haste = malha(new THREE.BoxGeometry(0.09, 1, 0.09), cor, mat); haste.position.set(0.3, 0.5, 0);
      const rabo = malha(new THREE.BoxGeometry(0.4, 0.16, 0.09), cor, mat); rabo.position.set(0.48, 0.95, 0); rabo.rotation.z = -0.5;
      g.add(cabeca, haste, rabo); g.children.forEach(m => { m.castShadow = false; });
      grupo.add(g); return g;
    });

    // cadeiras de madeira: assento, encosto baixo (de costas para fora, sem tapar quem senta) e quatro pernas
    pecas.cadeiras = Array.from({ length: p.jogadores.length - 1 }, () => {
      const g = new THREE.Group(), madeira = 0xb5733a, assento = 0xe8c07a;
      const seat = malha(new THREE.BoxGeometry(1.7, 0.26, 1.7), assento, { roughness: 0.6 }); seat.position.y = 0.95;
      const encosto = malha(new THREE.BoxGeometry(1.7, 0.9, 0.22), madeira, { roughness: 0.6 }); encosto.position.set(0, 1.5, 0.74);
      g.add(seat, encosto);
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.7, 0.7]) {
        const perna = malha(new THREE.BoxGeometry(0.2, 0.95, 0.2), madeira); perna.position.set(sx, 0.47, sz); g.add(perna);
      }
      const seta = malha(new THREE.ConeGeometry(0.8, 1.6, 4), 0xffffff, { emissive: 0xffe27a, emissiveIntensity: 1 });
      seta.rotation.x = Math.PI; seta.position.y = 3.6; seta.castShadow = false;
      const anel = malha(new THREE.TorusGeometry(1.6, 0.17, 8, 32), 0xffffff, { emissive: 0xffe27a, emissiveIntensity: 1 });
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.12; anel.castShadow = false;
      g.add(seta, anel); g.userData = { seat, seta, anel, assento };
      grupo.add(g); return g;
    });

    // vidas: bolinhas vermelhas acima de cada um (em times a vida e do time e fica no placar)
    pecas.vidas = c.bonecos.map(() => {
      const g = new THREE.Group();
      const pips = Array.from({ length: VIDAS_VS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 14, 10), 0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 0.8 }); m.castShadow = false; m.position.x = (k - (VIDAS_VS - 1) / 2) * 0.8; g.add(m); return m;
      });
      grupo.add(g); return { g, pips };
    });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados, times = p.modo === 'times';
    const tocando = d.fase === 'musica', cor = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);

    pecas.fatias.forEach((f, k) => {
      const acesa = tocando && (k + d.batida) % 2 === 0;
      f.material.color.set(k % 2 ? 0x8a6bd6 : 0xe9e4ff);
      f.material.emissive.set(k % 2 ? 0x8a6bd6 : 0xe9e4ff);
      f.material.emissiveIntensity = acesa ? 0.75 : tocando ? 0.25 : 0.05;
    });
    pecas.cerca.visible = tocando;
    pecas.cerca.material.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 12);
    pecas.notas.forEach((g, k) => {
      const a = d.rot * 1.4 + k * Math.PI / 3;
      g.visible = tocando;
      g.position.set(Math.cos(a) * (R_PISTA + 1.2), 1.1 + Math.abs(Math.sin(t * 6 + k)) * 0.7, Math.sin(a) * (R_PISTA + 1.2));
      g.rotation.z = Math.sin(t * 5 + k) * 0.25;
    });

    pecas.cadeiras.forEach((g, k) => {
      const ch = d.cadeiras[k], u = g.userData;
      g.visible = !!ch;
      if (!ch) return;
      g.position.set(ch.x, 0, ch.z);
      g.rotation.y = Math.PI / 2 - ch.a;
      const livre = !tocando && ch.dono < 0;
      u.seta.visible = u.anel.visible = livre;
      u.seta.position.y = 3.6 + Math.sin(t * 8) * 0.3; u.seta.rotation.y = t * 3;
      u.seat.material.color.set(ch.dono >= 0 ? cor(ch.dono) : u.assento);
    });

    c.bonecos.forEach((b, i) => {
      const alvo = pecas.vidas[i], j = p.jogadores[i];
      b.visible = b.position.y > -12;
      alvo.g.visible = !times && j.vivo && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, b.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, b.position.z);
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });

    // musica: uma nota por batida, mais lenta quando freia
    for (; pecas.vistaBatida < d.batida; pecas.vistaBatida++) c.som(NOTAS[pecas.vistaBatida % NOTAS.length], 0.14, 'triangle', 0.07);
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'para') c.som(110, 0.4, 'square', 0.12);
      else if (e.tipo === 'senta') { c.particulas(e.x, 1.6, e.z, cor(e.i), 18, 7); c.som(660, 0.18, 'square', 0.08); }
      else { c.particulas(e.x, 1.2, e.z, 0xffffff, 22, 9); c.som(150, 0.3, 'sawtooth', 0.1); }
    }
  },
};
