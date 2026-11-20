// Qual copo? em grupo (Festa: todos contra todos ou times). A estrela fica sob um copo, os copos (todos iguais) embaralham e, quando
// param, todos correm ao mesmo tempo ate o copo que acham certo e apertam Levanta. O primeiro a levantar o copo da estrela ganha 3
// pontos; com a estrela a mostra, quem ainda chegar nela e apertar Levanta em 2 s ganha 1. Copo errado abre vazio e atordoa por 1,4 s;
// apertar antes de os copos pararem tambem atordoa. Sao 4 rodadas, cada uma mais rapida (as duas ultimas com 5 copos). Vence a maior
// soma (em times, a soma da dupla); somas iguais empatam.
import { timeDe, quem } from '../logica.mjs';

export const RODADAS = 4, LIMITE = 45, PRIMEIRO = 3, DEPOIS = 1;
const T_MOSTRA = 1.3, T_ESCOLHE = 4.5, T_REVELA = 2;
const Z0 = -1.2, ARCO = 3.5, R_COL = 2.0, ALCANCE = 3.0, T_TONTO_ERRO = 1.4, T_TONTO_CEDO = 1.0, ALTO = 3.4, PASSO_X = 4.4, Z_LARGADA = 5;
const SLOTS = { 4: [-6.3, -2.1, 2.1, 6.3], 5: [-7.6, -3.8, 0, 3.8, 7.6] };
const COR_COPO = 0xf2ede0, COR_FAIXA = 0xd9363e, COR_ESTRELA = 0xffffff;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

export const nCopos = r => (r < 2 ? 4 : 5);
export const durTroca = r => Math.max(0.3, 0.6 - 0.08 * r);
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };
const suaveza = u => u * u * (3 - 2 * u);
const sorteia = (p, n) => Math.floor(p.rng() * n) % n;

function planeja(p, r) {
  const n = nCopos(r), passos = [];
  for (let k = 0; k < 4 + r; k++) {
    const a = sorteia(p, n), b = (a + 1 + sorteia(p, n - 1)) % n, passo = [[a, b]];
    // dois pares trocam juntos: o segundo fica inteiro de um lado do primeiro, para os copos nunca se cruzarem
    const lo = Math.min(a, b), hi = Math.max(a, b), livres = [];
    for (let c = 0; c < n; c++) for (let e = c + 1; e < n; e++) if (e < lo || c > hi) livres.push([c, e]);
    if (r >= 2 && livres.length && p.rng() < 0.5) passo.push(livres[sorteia(p, livres.length)]);
    passos.push(passo);
  }
  return passos;
}

function telas(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const msg = fim ? fim[i]
      : d.tonto[i] > 0 ? (d.cedo[i] ? 'Cedo demais! Espere os copos pararem.' : 'Copo vazio! Você ficou tonto.')
      : d.fase === 'mostra' ? 'Olhe onde está a estrela!'
      : d.fase === 'mistura' ? 'Acompanhe o copo da estrela!'
      : d.fase === 'escolhe' ? 'Já! Corra até o copo e aperte Levanta.'
      : !d.achou ? 'Ninguém achou a estrela.'
      : d.pegou[i] ? `Você achou: +${d.pegou[i]}!` : `Corra até a estrela e aperte Levanta: +${DEPOIS}!`;
    const texto = fim ? msg : `${msg} Pontos: ${d.placar[de(i)]}`;
    if (p.celular[i].texto !== texto || p.celular[i].vibra !== d.vibra[i]) p.celular[i] = { ...(fim ? { modo: 'espera' } : {}), texto, vibra: d.vibra[i] };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

function novaRodada(p) {
  const d = p.dados, n = nCopos(d.rodada), xs = SLOTS[n];
  d.copos = xs.map((x, id) => ({ id, x, z: Z0, alt: 0, aberto: false }));
  d.ocupa = xs.map((_, id) => id);                       // quem esta em cada lugar
  d.estrela = sorteia(p, n);
  d.passos = planeja(p, d.rodada); d.troca = null;
  d.fase = 'mostra'; d.tempo = T_MOSTRA; d.achou = false; d.pegou = p.jogadores.map(() => 0);
  d.aviso = d.rodada === RODADAS - 1 ? 'Última rodada: olhe a estrela!' : 'Olhe a estrela!'; d.avisoCor = '#ffd84d';
}

function comecaTroca(d) {
  const passo = d.passos.shift();
  d.troca = { u: 0, itens: passo.map(([sa, sb]) => ({ a: d.ocupa[sa], b: d.ocupa[sb], sa, sb })) };
  d.nTrocas++;
}

function andaTroca(p, dt) {
  const d = p.dados, t = d.troca, xs = SLOTS[d.copos.length];
  t.u = Math.min(1, t.u + dt / durTroca(d.rodada));
  const e = suaveza(t.u), arco = Math.sqrt(Math.sin(Math.PI * e)) * ARCO;       // arco de topo largo: passa longe do copo parado no meio do caminho
  for (const { a, b, sa, sb } of t.itens) {
    const ca = d.copos[a], cb = d.copos[b];
    ca.x = xs[sa] + (xs[sb] - xs[sa]) * e; ca.z = Z0 + arco;
    cb.x = xs[sb] + (xs[sa] - xs[sb]) * e; cb.z = Z0 - arco;
  }
  if (t.u < 1) return;
  for (const { a, b, sa, sb } of t.itens) { d.ocupa[sa] = b; d.ocupa[sb] = a; d.copos[a].x = xs[sb]; d.copos[b].x = xs[sa]; d.copos[a].z = d.copos[b].z = Z0; }
  d.troca = null;
}

const longe = (j, c) => Math.hypot(j.x - c.x, j.z - c.z);
// O copo fechado mais perto do jogador, se ele estiver ao alcance.
function copoAoAlcance(d, j) {
  let melhor = -1, dist = ALCANCE;
  for (const c of d.copos) {
    const m = longe(j, c);
    if (!c.aberto && m < dist) { dist = m; melhor = c.id; }
  }
  return melhor;
}

function empurraParaFora(d, j) {                        // o copo e solido: ninguem entra nele
  for (const c of d.copos) {
    const dx = j.x - c.x, dz = j.z - c.z, dist = Math.hypot(dx, dz);
    if (dist >= R_COL) continue;
    const nx = dist > 1e-6 ? dx / dist : 0, nz = dist > 1e-6 ? dz / dist : 1;
    j.x = c.x + nx * R_COL; j.z = c.z + nz * R_COL;
    const v = j.vx * nx + j.vz * nz;
    if (v < 0) { j.vx -= v * nx; j.vz -= v * nz; }
  }
}

function atordoa(p, i, tempo, cedo, copo) {
  const d = p.dados;
  d.tonto[i] = tempo; d.cedo[i] = cedo; d.vibra[i]++;
  d.fx.push({ tipo: cedo ? 'cedo' : 'erra', quem: i, copo });
  p.eventos.push(cedo ? 'queda' : 'batida');
}

function pontua(p, i, pontos) {
  const d = p.dados;
  d.placar[dono(p)(i)] += pontos; d.pegou[i] = pontos; d.vibra[i]++;
  d.fx.push({ tipo: 'ganha', quem: i, copo: d.estrela });
  if (p.jogadores[i].y === 0) p.jogadores[i].vy = 8;
}

// quem: os que levantaram o copo certo neste quadro (lista vazia: o tempo acabou e ninguem achou).
function revela(p, quem_) {
  const d = p.dados;
  d.fase = 'revela'; d.tempo = T_REVELA; d.achou = quem_.length > 0;
  d.copos[d.estrela].aberto = true;
  if (!d.achou) { d.aviso = 'Ninguém achou!'; d.avisoCor = '#ff8a4a'; p.eventos.push('queda'); return; }
  for (const i of quem_) pontua(p, i, PRIMEIRO);
  d.aviso = `${quem_.map(i => quem(p, i)).join(' e ')} ${quem_.length > 1 ? 'acharam' : 'achou'} a estrela!`; d.avisoCor = '#ffd84d';
  p.eventos.push('moeda'); p.eventos.push('ponto');
}

export default {
  id: 'qual-copo-festa', genero: 'memoria', nome: 'Qual copo? em grupo',
  dica: 'Acompanhe o copo da estrela. Quando parar, corra até ele e aperte Levanta antes dos outros.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Levanta', b: '' }, semDash: true, semPulo: true,       // um botao so, o grande: levantar e a acao do jogo
  semNome: true,        // o nome flutuante ficaria em cima dos copos
  rotulo: 'pontos', duracao: LIMITE, tema: 2,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 11, lz: 7.2, parede: true };
    p.jogadores.forEach((j, i) => { j.x = (i - (n - 1) / 2) * PASSO_X; j.z = Z_LARGADA; });
    p.dados = { placar: Array(p.modo === 'times' ? 2 : n).fill(0), vibra: Array(n).fill(0), tonto: Array(n).fill(0), cedo: Array(n).fill(false), sob: Array(n).fill(-1), fx: [], rodada: 0, nTrocas: 0 };
    novaRodada(p);
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tonto = d.tonto.map(t => Math.max(0, t - dt));

    if (d.fase === 'mostra') {
      d.tempo -= dt;
      if (d.tempo <= 0) { d.fase = 'mistura'; d.aviso = 'Acompanhe o copo!'; }
    } else if (d.fase === 'mistura') {
      if (!d.troca && d.passos.length) { comecaTroca(d); p.eventos.push('troca'); }
      if (d.troca) andaTroca(p, dt);
      if (!d.troca && !d.passos.length) {
        d.fase = 'escolhe'; d.tempo = T_ESCOLHE; d.aviso = 'Já!'; d.avisoCor = '#6dff9a';
        d.vibra = d.vibra.map(v => v + 1); p.eventos.push('dash');
      }
    } else {
      d.tempo -= dt;
      if (d.fase === 'escolhe' && d.tempo <= 0) revela(p, []);
    }

    const certos = [];
    p.jogadores.forEach((j, i) => {
      if (!j.apertouA || d.tonto[i] > 0) return;
      if (d.fase === 'escolhe') {
        const id = copoAoAlcance(d, j);
        if (id === d.estrela) certos.push(i);
        else if (id >= 0) { d.copos[id].aberto = true; atordoa(p, i, T_TONTO_ERRO, false, id); }
      } else if (d.fase !== 'revela') atordoa(p, i, T_TONTO_CEDO, true, -1);       // antes da hora: fica tonto
      else if (d.achou && !d.pegou[i] && longe(j, d.copos[d.estrela]) < ALCANCE) { pontua(p, i, DEPOIS); p.eventos.push('moeda'); }
    });
    if (certos.length) revela(p, certos);       // no mesmo quadro, todos os que acertaram levam o premio de primeiro

    p.jogadores.forEach((j, i) => { j.turbo = d.tonto[i] > 0 ? 0 : 1; });
    for (const j of p.jogadores) empurraParaFora(d, j);
    for (const c of d.copos) {                           // levanta o copo que esta aberto (ou o da estrela, na mostra)
      const alvo = c.aberto || (d.fase === 'mostra' && c.id === d.estrela && d.tempo > 0.4) ? ALTO : 0;
      c.alt += (alvo - c.alt) * Math.min(1, dt * 10);
    }
    d.sob = p.jogadores.map((j, i) => (d.fase === 'escolhe' && !(d.tonto[i] > 0) ? copoAoAlcance(d, j) : -1));

    if (d.fase === 'revela' && d.tempo <= 0) {
      if (d.rodada + 1 >= RODADAS) return fechaComo(p, lider(d.placar));
      d.rodada++; novaRodada(p);
    }
    if (p.t >= LIMITE) return fechaComo(p, lider(d.placar));
    telas(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    // mesa de feltro escuro com uma faixa mais clara onde os copos param
    const mesa = malha(new THREE.BoxGeometry(23, 0.2, 15.2), 0x10262c, { roughness: 0.9 });
    mesa.position.y = 0.02; mesa.castShadow = false; grupo.add(mesa);
    const pano = malha(new THREE.BoxGeometry(22, 0.06, 5.6), 0x1b5a52, { roughness: 1 });
    pano.position.set(0, 0.15, Z0); pano.castShadow = false; grupo.add(pano);
    for (const s of [-1, 1]) { const f = malha(new THREE.BoxGeometry(22, 0.04, 0.16), COR_COPO); f.position.set(0, 0.19, Z0 + s * 2.7); f.castShadow = false; grupo.add(f); }
    for (const s of [-1, 1]) { const b = malha(new THREE.BoxGeometry(0.5, 0.5, 16.2), 0x6b4423); b.position.set(s * 11.7, 0.1, 0); grupo.add(b); }
    for (const s of [-1, 1]) { const b = malha(new THREE.BoxGeometry(23, 0.5, 0.5), 0x6b4423); b.position.set(0, 0.1, s * 7.7); grupo.add(b); }

    const forma = new THREE.Shape();                    // estrela de cinco pontas
    for (let k = 0; k < 10; k++) {
      const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.34 : 0.85;
      if (k === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r); else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    forma.closePath();
    pecas.estrela = malha(new THREE.ExtrudeGeometry(forma, { depth: 0.3, bevelEnabled: false }), COR_ESTRELA, { emissive: 0xfff0a0, emissiveIntensity: 0.9 });
    pecas.estrela.rotation.x = -Math.PI / 2; pecas.estrela.scale.setScalar(1.5); grupo.add(pecas.estrela);
    // de cada jogador: o anel que marca o copo ao alcance (na cor dele, ou do time) e as bolinhas que giram na cabeca de quem esta tonto
    pecas.aneis = p.jogadores.map((_, i) => {
      const r = 1.5 + i * 0.26;
      const a = malha(new THREE.RingGeometry(r, r + 0.2, 40), corDe(i), { emissive: corDe(i), emissiveIntensity: 0.9, side: THREE.DoubleSide });
      a.rotation.x = -Math.PI / 2; a.castShadow = false; grupo.add(a); return a;
    });
    pecas.tontos = p.jogadores.map(() => {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) { const b = malha(new THREE.SphereGeometry(0.22, 10, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }); b.position.set(Math.cos(k * 2.094) * 0.8, 0, Math.sin(k * 2.094) * 0.8); g.add(b); }
      g.visible = false; grupo.add(g); return g;
    });
    pecas.visto = 0; pecas.trocas = 0; pecas.copos = [];
  },

  desenha(c, dt, t) {
    const { THREE, pecas } = c, p = c.p, d = p.dados;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    if (pecas.copos.length !== d.copos.length) {         // muda o numero de copos: copos novos
      for (const g of pecas.copos) { c.grupo.remove(g); g.traverse(o => { o.material?.dispose?.(); o.geometry?.dispose?.(); }); }
      pecas.copos = d.copos.map(() => {
        const g = new THREE.Group();
        const corpo = c.malha(new THREE.CylinderGeometry(0.8, 1.15, 2, 28), COR_COPO, { roughness: 0.35, metalness: 0.1 }); corpo.position.y = 1;
        const aro = c.malha(new THREE.TorusGeometry(1.15, 0.13, 10, 28), COR_FAIXA); aro.rotation.x = Math.PI / 2; aro.position.y = 0.13;
        const faixa = c.malha(new THREE.TorusGeometry(0.99, 0.11, 10, 28), COR_FAIXA); faixa.rotation.x = Math.PI / 2; faixa.position.y = 1.0;
        const bola = c.malha(new THREE.SphereGeometry(0.32, 14, 10), COR_FAIXA); bola.position.y = 2.15;
        g.add(corpo, aro, faixa, bola); g.scale.setScalar(1.2); c.grupo.add(g); return g;
      });
    }
    d.copos.forEach((cp, k) => {
      const g = pecas.copos[k], movendo = d.troca?.itens.some(it => it.a === cp.id || it.b === cp.id);
      g.position.set(cp.x, cp.alt, cp.z - cp.alt / ALTO * 1.3);       // o copo levantado recua um pouco: a estrela aparece de frente
      g.rotation.z = cp.alt > 0.3 ? Math.sin(t * 9) * 0.12 : movendo ? Math.sin(t * 16 + k) * 0.05 : 0;
    });
    const e = d.copos[d.estrela];
    pecas.estrela.position.set(e.x, 0.3, e.z); pecas.estrela.rotation.z += dt * 2;
    pecas.estrela.visible = d.fase === 'mostra' || d.fase === 'revela' || e.alt > 0.5;
    pecas.aneis.forEach((a, i) => {
      const id = d.sob[i]; a.visible = id >= 0;
      if (id >= 0) a.position.set(d.copos[id].x, 0.4, d.copos[id].z);
    });
    pecas.tontos.forEach((g, i) => {
      const j = p.jogadores[i];
      g.visible = d.tonto[i] > 0; g.position.set(j.x, 2.5 + j.y, j.z); g.rotation.y = t * 9;
    });
    if (pecas.trocas !== d.nTrocas) { pecas.trocas = d.nTrocas; c.som(300 + 40 * d.rodada, 0.08, 'triangle', 0.1); }
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const f = d.fx[pecas.visto], j = p.jogadores[f.quem], cp = d.copos[f.copo];
      if (f.tipo === 'ganha') { c.som(660, 0.15, 'triangle', 0.2); c.som(990, 0.3, 'triangle', 0.2); c.particulas(cp.x, 1.2, cp.z, 0xfff0a0, 30, 10); c.particulas(j.x, 2, j.z, corDe(f.quem), 24, 8); }
      else if (f.tipo === 'erra' && cp) { c.som(160, 0.3, 'sawtooth', 0.18); c.particulas(cp.x, 1.5, cp.z, 0x9aa0b5, 18, 6); }
      else { c.som(120, 0.2, 'square', 0.12); c.particulas(j.x, 1.8, j.z, 0xff4a4a, 14, 5); }
    }
  },
};
