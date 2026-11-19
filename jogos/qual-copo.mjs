// Qual copo?: a estrela fica escondida sob um copo, os copos se embaralham na mesa e, quando param, os dois correm
// para o copo certo e apertam Levanta. Copo errado deixa tonto e entrega o palpite ao rival. Primeiro a 3 estrelas.
import { posiciona, maiorPlacar, quem } from '../logica.mjs';

const META = 3, LIMITE = 38, EXTRA = 6, T_MOSTRA = 1.5, T_ESCOLHE = 4.2, T_REVELA = 1.3;
const Z0 = -1.2, ARCO = 2.9, R_COL = 2.0, ALCANCE = 3.0, T_TONTO_ERRO = 1.4, T_TONTO_CEDO = 1.0, ALTO = 3.4;
const SLOTS = { 3: [-4.6, 0, 4.6], 4: [-6.3, -2.1, 2.1, 6.3] };
const COR_COPO = [0x2ad4d9, 0xb6e234, 0xb784ff, 0xf2f2f2];

const nCopos = r => (r < 2 ? 3 : 4);
const durTroca = r => Math.max(0.3, 0.6 - 0.06 * r);
const suaveza = u => u * u * (3 - 2 * u);
const sorteia = (p, n) => Math.floor(p.rng() * n) % n;

function planeja(p, r) {
  const n = nCopos(r), passos = [];
  for (let k = 0; k < 4 + r; k++) {
    const a = sorteia(p, n), b = (a + 1 + sorteia(p, n - 1)) % n, passo = [[a, b]];
    if (n === 4 && r >= 3 && p.rng() < 0.5) passo.push([0, 1, 2, 3].filter(s => s !== a && s !== b));       // dois pares trocam juntos
    passos.push(passo);
  }
  return passos;
}

function novaRodada(p) {
  const d = p.dados, n = nCopos(d.rodada), xs = SLOTS[n];
  d.copos = xs.map((x, id) => ({ id, x, z: Z0, alt: 0, aberto: false }));
  d.ocupa = xs.map((_, id) => id);                       // quem esta em cada lugar
  d.estrela = sorteia(p, n);
  d.passos = planeja(p, d.rodada); d.troca = null;
  d.fase = 'mostra'; d.tempo = T_MOSTRA; d.vencedorRodada = -1; d.tonto = [0, 0];
  d.aviso = 'Olhe a estrela!'; d.avisoCor = '#ffd84d';
  celulares(p, 'Olhe onde está a estrela!');
}

function celulares(p, msg) {
  const d = p.dados;
  for (const i of [0, 1]) p.celular[i] = { texto: `${msg} Você ${d.placar[i]} x ${d.placar[1 - i]}`, vibra: d.vibra[i] };
}

function comecaTroca(d) {
  const passo = d.passos.shift();
  d.troca = { u: 0, itens: passo.map(([sa, sb]) => ({ a: d.ocupa[sa], b: d.ocupa[sb], sa, sb })) };
  d.nTrocas++;
}

function andaTroca(p, dt) {
  const d = p.dados, t = d.troca, xs = SLOTS[d.copos.length];
  t.u = Math.min(1, t.u + dt / durTroca(d.rodada));
  const e = suaveza(t.u), arco = Math.sin(Math.PI * e) * ARCO;
  for (const { a, b, sa, sb } of t.itens) {
    const ca = d.copos[a], cb = d.copos[b];
    ca.x = xs[sa] + (xs[sb] - xs[sa]) * e; ca.z = Z0 + arco;
    cb.x = xs[sb] + (xs[sa] - xs[sb]) * e; cb.z = Z0 - arco;
  }
  if (t.u < 1) return;
  for (const { a, b, sa, sb } of t.itens) { d.ocupa[sa] = b; d.ocupa[sb] = a; d.copos[a].z = d.copos[b].z = Z0; }
  d.troca = null;
}

// O copo fechado mais perto do jogador, se ele estiver ao alcance.
function copoAoAlcance(d, j) {
  let melhor = -1, dist = ALCANCE;
  for (const c of d.copos) {
    const m = Math.hypot(j.x - c.x, j.z - c.z);
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

function revela(p, vencedor) {
  const d = p.dados;
  d.fase = 'revela'; d.tempo = T_REVELA; d.vencedorRodada = vencedor;
  d.copos[d.estrela].aberto = true;
  if (vencedor < 0) { d.aviso = 'Ninguém achou!'; d.avisoCor = '#ff8a4a'; p.eventos.push('queda'); celulares(p, 'Ninguém achou a estrela.'); return; }
  d.aviso = `${quem(p, vencedor)} achou a estrela!`; d.avisoCor = '#ffd84d';
  p.eventos.push('moeda'); p.eventos.push('ponto');
  d.vibra[vencedor]++;
  for (const i of [0, 1]) p.celular[i] = { texto: `${i === vencedor ? 'Você achou a estrela!' : 'O rival achou a estrela.'} Você ${d.placar[i]} x ${d.placar[1 - i]}`, vibra: d.vibra[i] };
}

function aperta(p, i) {
  const d = p.dados, j = p.jogadores[i];
  if (d.tonto[i] > 0 || d.fase === 'revela') return;
  if (d.fase !== 'escolhe') {                           // antes da hora: fica tonto
    d.tonto[i] = T_TONTO_CEDO; d.fx.push({ tipo: 'cedo', quem: i }); d.vibra[i]++; p.eventos.push('queda');
    p.celular[i] = { texto: 'Cedo demais! Espere o copo parar.', vibra: d.vibra[i] };
    return;
  }
  const id = copoAoAlcance(d, j);
  if (id < 0) return;
  if (id === d.estrela) { d.placar[i]++; d.fx.push({ tipo: 'ganha', quem: i, copo: id }); revela(p, i); return; }
  d.copos[id].aberto = true; d.tonto[i] = T_TONTO_ERRO; d.vibra[i]++;
  d.fx.push({ tipo: 'erra', quem: i, copo: id }); p.eventos.push('batida');
  p.celular[i] = { texto: 'Copo vazio! Espere um instante.', vibra: d.vibra[i] };
  p.celular[1 - i] = { texto: 'O rival errou um copo! Corra!', vibra: p.celular[1 - i].vibra };
}

function fecha(p, v) {
  const d = p.dados;
  d.aviso = v < 0 ? 'Empate!' : `${quem(p, v)} venceu!`; d.avisoCor = '#ffd84d';
  for (const i of [0, 1]) p.celular[i] = { texto: v < 0 ? `Empate em ${d.placar[i]} x ${d.placar[1 - i]}` : v === i ? `Você venceu por ${d.placar[i]} x ${d.placar[1 - i]}!` : `Você perdeu por ${d.placar[i]} x ${d.placar[v]}`, vibra: d.vibra[i] };
  return v;
}

export default {
  id: 'qual-copo', genero: 'memoria', nome: 'Qual copo?',
  dica: 'Acompanhe o copo da estrela. Quando parar, corra até ele e aperte Levanta!',
  controle: { modo: 'padrao', a: 'EMPURRA', b: 'LEVANTA' }, semPulo: true, semNome: true, rotulo: 'estrelas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 7.2, parede: true };
    posiciona(p, 9.4, 0);
    for (const j of p.jogadores) j.z = 4.4;
    p.dados = { placar: [0, 0], vibra: [0, 0], fx: [], rodada: 0, nTrocas: 0, prio: 0, sob: [-1, -1], tonto: [0, 0] };
    novaRodada(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.prio = 1 - d.prio;
    d.tonto = d.tonto.map(t => Math.max(0, t - dt));
    p.jogadores.forEach((j, i) => { j.turbo = d.tonto[i] > 0 ? 0 : 1; });

    if (d.fase === 'mostra') {
      d.tempo -= dt;
      if (d.tempo <= 0) { d.fase = 'mistura'; d.aviso = 'Acompanhe o copo!'; celulares(p, 'Acompanhe o copo da estrela!'); }
    } else if (d.fase === 'mistura') {
      if (!d.troca && d.passos.length) { comecaTroca(d); p.eventos.push('troca'); }
      if (d.troca) andaTroca(p, dt);
      if (!d.troca && !d.passos.length) {
        d.fase = 'escolhe'; d.tempo = T_ESCOLHE; d.aviso = 'Já!'; d.avisoCor = '#6dff9a';
        p.eventos.push('dash'); celulares(p, 'Já! Corra até o copo e aperte Levanta.');
      }
    } else if (d.fase === 'escolhe') {
      d.tempo -= dt;
      if (d.tempo <= 0) revela(p, -1);
    } else {
      d.tempo -= dt;
    }

    for (const i of [d.prio, 1 - d.prio]) if (p.jogadores[i].apertouB) aperta(p, i);
    for (const j of p.jogadores) empurraParaFora(d, j);
    for (const c of d.copos) {                           // levanta o copo que esta aberto (ou o da estrela, na mostra)
      const alvo = c.aberto || (d.fase === 'mostra' && c.id === d.estrela && d.tempo > 0.45) ? ALTO : 0;
      c.alt += (alvo - c.alt) * Math.min(1, dt * 10);
    }
    d.sob = p.jogadores.map(j => (d.fase === 'escolhe' ? copoAoAlcance(d, j) : -1));

    if (d.fase === 'revela' && d.tempo <= 0) {
      if (Math.max(...d.placar) >= META) return fecha(p, maiorPlacar(p));
      d.rodada++; novaRodada(p);
    }
    if (p.t >= LIMITE && (d.placar[0] !== d.placar[1] || p.t >= LIMITE + EXTRA)) return fecha(p, maiorPlacar(p));
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const mesa = malha(new THREE.BoxGeometry(23, 0.2, 15.2), 0x241a3a, { roughness: 0.9 });
    mesa.position.y = 0.02; mesa.castShadow = false; grupo.add(mesa);
    const pano = malha(new THREE.BoxGeometry(22, 0.06, 5.6), 0x7b1e3a, { roughness: 1 });
    pano.position.set(0, 0.15, Z0); pano.castShadow = false; grupo.add(pano);
    for (const s of [-1, 1]) { const f = malha(new THREE.BoxGeometry(22, 0.04, 0.16), 0xffd23f, { emissive: 0x6a4f00, emissiveIntensity: 0.6 }); f.position.set(0, 0.19, Z0 + s * 2.7); f.castShadow = false; grupo.add(f); }
    for (const s of [-1, 1]) { const b = malha(new THREE.BoxGeometry(0.5, 0.5, 16.2), 0x8a5a2b); b.position.set(s * 11.7, 0.1, 0); grupo.add(b); }
    for (const s of [-1, 1]) { const b = malha(new THREE.BoxGeometry(23, 0.5, 0.5), 0x8a5a2b); b.position.set(0, 0.1, s * 7.7); grupo.add(b); }

    const forma = new THREE.Shape();                    // estrela de cinco pontas
    for (let k = 0; k < 10; k++) {
      const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.34 : 0.85;
      if (k === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r); else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    forma.closePath();
    pecas.geoEstrela = new THREE.ExtrudeGeometry(forma, { depth: 0.3, bevelEnabled: false });
    pecas.estrela = malha(pecas.geoEstrela, 0xffd23f, { emissive: 0xffb300, emissiveIntensity: 0.8 });
    pecas.estrela.rotation.x = -Math.PI / 2; pecas.estrela.scale.setScalar(1.5); grupo.add(pecas.estrela);
    pecas.luzes = [[], []];                              // as estrelas ganhas de cada um, no fundo da mesa
    for (const i of [0, 1]) for (let k = 0; k < META; k++) {
      const l = malha(pecas.geoEstrela, 0x3a4260, { emissive: cores[i], emissiveIntensity: 0 });
      l.rotation.x = -Math.PI / 2; l.scale.setScalar(0.9); l.position.set((i ? 1 : -1) * (3 + k * 2.2), 0.3, -6.2);
      grupo.add(l); pecas.luzes[i].push(l);
    }
    pecas.aneis = [0, 1].map(i => {
      const a = malha(new THREE.RingGeometry(1.35 - i * 0.28, 1.65 - i * 0.28, 40), cores[i], { emissive: cores[i], emissiveIntensity: 0.9, side: THREE.DoubleSide });
      a.rotation.x = -Math.PI / 2; a.castShadow = false; grupo.add(a); return a;
    });
    pecas.visto = 0; pecas.trocas = 0; pecas.copos = [];
  },

  desenha(c, dt, t) {
    const { THREE, pecas } = c, d = c.p.dados;
    if (pecas.copos.length !== d.copos.length) {         // rodada nova: copos novos
      for (const g of pecas.copos) { c.grupo.remove(g); g.traverse(o => o.material?.dispose?.()); }
      pecas.copos = d.copos.map(cp => {
        const cor = COR_COPO[cp.id], g = new THREE.Group();
        const corpo = c.malha(new THREE.CylinderGeometry(0.8, 1.15, 2, 28), cor, { roughness: 0.35, metalness: 0.15 }); corpo.position.y = 1;
        const aro = c.malha(new THREE.TorusGeometry(1.15, 0.13, 10, 28), 0xffd23f, { emissive: 0x6a4f00, emissiveIntensity: 0.6 }); aro.rotation.x = Math.PI / 2; aro.position.y = 0.13;
        const faixa = c.malha(new THREE.TorusGeometry(0.99, 0.09, 10, 28), 0xffffff); faixa.rotation.x = Math.PI / 2; faixa.position.y = 1.0;
        const bola = c.malha(new THREE.SphereGeometry(0.32, 14, 10), 0xffd23f, { emissive: 0x6a4f00, emissiveIntensity: 0.6 }); bola.position.y = 2.15;
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
    pecas.luzes.forEach((l, i) => l.forEach((m, k) => { const on = k < d.placar[i]; m.material.emissiveIntensity = on ? 1 : 0; m.material.color.set(on ? c.cores[i] : 0x3a4260); m.rotation.z = on ? t * 1.5 : 0; }));
    pecas.aneis.forEach((a, i) => {
      const id = d.sob[i]; a.visible = id >= 0;
      if (id >= 0) a.position.set(d.copos[id].x, 0.4, d.copos[id].z);
    });
    if (pecas.trocas !== d.nTrocas) { pecas.trocas = d.nTrocas; c.som(300 + 30 * Math.min(d.rodada, 6), 0.08, 'triangle', 0.1); }
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const f = d.fx[pecas.visto], j = c.p.jogadores[f.quem];
      if (f.tipo === 'ganha') { const cp = d.copos[f.copo]; c.som(660, 0.15, 'triangle', 0.2); c.som(990, 0.3, 'triangle', 0.2); c.particulas(cp.x, 1.2, cp.z, 0xffd23f, 36, 10); c.particulas(cp.x, 2, cp.z, c.cores[f.quem], 24, 8); }
      else if (f.tipo === 'erra') { const cp = d.copos[f.copo]; c.som(160, 0.3, 'sawtooth', 0.18); c.particulas(cp.x, 1.5, cp.z, 0x9aa0b5, 18, 6); }
      else { c.som(120, 0.2, 'square', 0.12); c.particulas(j.x, 1.8, j.z, 0xff4a4a, 14, 5); }
    }
  },
};
