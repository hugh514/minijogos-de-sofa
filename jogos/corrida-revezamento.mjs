// Revezamento na Pista (Festa: só times 2x2, com 4). Cada time tem um bastão e sete trechos de uma ponta à outra da pista.
// Quem leva o bastão corre até a outra base e o parceiro, que espera lá dentro da zona, só sai quando ele encosta. Quem acabou de
// entregar corre para a base do outro lado para o próximo trecho. Barras no caminho: pule (B) ou tropece e perca tempo. Vence o primeiro time que
// completar os sete trechos (o último termina ao entrar na zona da base), ou o que estiver mais adiante aos 50 s.
import { timeDe } from '../logica.mjs';

export const LX = 11, LZ = 7, TEMPO = 50, TRECHOS = 7;
export const BASE = 8.6, LADO = 3.8;                                 // centro das bases (x) e das duas pistas (z)
const ZONA_X = 2.2, ZONA_Z = 2.9, CERCA_Z = 2.6, CERCA_X = 1.9;       // a zona onde o parceiro espera, e o quanto ele anda lá dentro
const R_TOCA = 2.0, V_ANDA = 5, V_TROPECO = 1.6, T_TROPECO = 0.9, T_CAIDA = 2;
export const BARRAS = [-4, 0, 4], R_BARRA = 0.35, ALTURA = 0.7, MARGEM = 0.05;       // barras de x fixo, de uma parede à outra; j.y > ALTURA passa
const pistaDe = t => (t === 0 ? -LADO : LADO);
const membros = t => [t, t + 2];                                      // time A: J1 e J3; time B: J2 e J4
const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const inicioDoTrecho = k => (k % 2 === 0 ? -BASE : BASE);             // trechos pares vão da esquerda para a direita

const emZona = (j, bx, t) => Math.abs(j.x - bx) < ZONA_X && Math.abs(j.z - pistaDe(t)) < ZONA_Z;

function papeis(d, t) {
  const k = d.trecho[t], m = membros(t);
  return { k, carrega: m[k % 2], espera: m[(k + 1) % 2], baseFim: k % 2 === 0 ? BASE : -BASE };
}

// Passar rente à barra tropeça: o corredor fica lento por um instante e a barra cai por 2 s (para todos), sem travar ninguém.
function barras(p, d, i) {
  const j = p.jogadores[i];
  BARRAS.forEach((hx, k) => {
    if (d.caida[k] > 0 || j.y > ALTURA + MARGEM || Math.abs(j.x - hx) >= R_BARRA + 0.4) return;
    d.caida[k] = T_CAIDA; d.tropeco[i] = T_TROPECO;
    d.fx.push({ tipo: 'tropeco', x: hx, z: j.z, i }); p.eventos.push('batida');
  });
}

function avanca(p, d, t) {
  const { k, carrega, espera, baseFim } = papeis(d, t), js = p.jogadores;
  d.preso[carrega] = false;
  if (k === TRECHOS - 1) { return emZona(js[carrega], BASE, t) ? 'fim' : null; }
  if (!d.preso[espera] && emZona(js[espera], baseFim, t)) d.preso[espera] = true;
  if (!d.preso[espera]) return null;
  const e = js[espera], c = js[carrega];
  e.x = limita(e.x, baseFim - CERCA_X, baseFim + CERCA_X);
  e.z = limita(e.z, pistaDe(t) - CERCA_Z, pistaDe(t) + CERCA_Z);
  if (Math.hypot(e.x - c.x, e.z - c.z) < R_TOCA) return 'passa';
  return null;
}

function progresso(p, d, t) {
  if (d.fim[t]) return TRECHOS;
  const { k, carrega } = papeis(d, t);
  return k + limita(Math.abs(p.jogadores[carrega].x - inicioDoTrecho(k)) / (2 * BASE), 0, 1);
}

function textoDe(p, d, i) {
  const t = timeDe(p, i), { k, carrega, espera } = papeis(d, t), par = membros(t).find(m => m !== i);
  if (d.fim[t]) return 'Seu time terminou a prova!';
  const trecho = `Trecho ${k + 1} de ${TRECHOS}.`;
  if (i === carrega) return `${trecho} Você leva o bastão! Pule as barras${k === TRECHOS - 1 ? ' e chegue à base' : ' e encoste no Jogador ' + (par + 1)}`;
  if (i === espera && d.preso[i]) return `${trecho} Espere o Jogador ${carrega + 1} encostar em você`;
  return `${trecho} Corra para a base do outro lado e espere o bastão`;
}

export default {
  id: 'corrida-revezamento', genero: 'corrida', nome: 'Revezamento na Pista', dica: 'Levem o bastão de uma base à outra e passem ao parceiro encostando. Pule as barras! O primeiro time a completar 7 trechos vence.',
  festa: { min: 4, max: 4, modos: ['times'] },
  controle: { modo: 'padrao', a: '', b: 'PULA' }, semDash: true,
  rotulo: 'da prova', sufixo: '%', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const cada = f => p.jogadores.map((_, i) => f(i));
    for (const t of [0, 1]) {
      const [a, b] = membros(t);
      Object.assign(p.jogadores[a], { x: -BASE, z: pistaDe(t) });
      Object.assign(p.jogadores[b], { x: BASE, z: pistaDe(t) });
    }
    p.dados = {
      placar: [0, 0], inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0, fx: [],
      trecho: [0, 0], fim: [false, false], preso: cada(i => i >= 2), tropeco: cada(() => 0), caida: BARRAS.map(() => 0),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.caida = d.caida.map(v => Math.max(0, v - dt));
    js.forEach((j, i) => {
      d.tropeco[i] = Math.max(0, d.tropeco[i] - dt);
      const vmax = d.tropeco[i] > 0 ? V_TROPECO : V_ANDA, v = Math.hypot(j.vx, j.vz);
      if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
      barras(p, d, i);
    });

    for (const t of [0, 1]) {
      if (d.fim[t]) continue;
      const r = avanca(p, d, t);
      if (r === 'passa') {
        const { carrega, espera } = papeis(d, t);
        d.trecho[t]++; d.preso[espera] = false;
        d.fx.push({ tipo: 'passa', x: (js[carrega].x + js[espera].x) / 2, z: js[carrega].z, t });
        p.eventos.push('troca');
        for (const i of [carrega, espera]) p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
      } else if (r === 'fim') {
        d.fim[t] = true; d.aviso = (t === 0 ? 'Laranja' : 'Roxo') + ' chegou!'; d.avisoCor = '#ffffff'; d.avisoT = 3;
        p.eventos.push('gol');
      }
    }

    const prog = [0, 1].map(t => progresso(p, d, t));
    d.placar = prog.map(v => Math.round(v / TRECHOS * 100));
    d.inventario = js.map((_, i) => { const t = timeDe(p, i), { carrega } = papeis(d, t); return [d.fim[t] ? 'Chegou' : carrega === i ? 'Com o bastão' : 'Trecho ' + (d.trecho[t] + 1)]; });
    js.forEach((_, i) => { const tx = textoDe(p, d, i); if (p.celular[i].texto !== tx) p.celular[i] = { ...p.celular[i], texto: tx }; });

    if (d.fim[0] || d.fim[1]) return d.fim[0] ? 0 : 1;
    if (p.t >= TEMPO) return prog[0] === prog[1] ? -1 : prog[0] > prog[1] ? 0 : 1;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    pecas.visto = 0;
    // pista de saibro, com a faixa de cada time e as zonas de passagem nas pontas
    const saibro = malha(caixa(LX * 2 - 0.2, 0.04, LZ * 2 - 0.2), 0xb4603c, { roughness: 1 }); saibro.position.y = 0.03; saibro.castShadow = false; grupo.add(saibro);
    for (const t of [0, 1]) {
      const faixa = malha(caixa(BASE * 2, 0.02, 0.35), c.times[t], { emissive: c.times[t], emissiveIntensity: 0.35 }); faixa.position.set(0, 0.06, pistaDe(t)); faixa.castShadow = false; grupo.add(faixa);
    }
    pecas.zonas = [];
    for (const t of [0, 1]) for (const lado of [-1, 1]) {
      const z = malha(caixa(ZONA_X * 2, 0.04, ZONA_Z * 2), c.times[t], { emissive: c.times[t], emissiveIntensity: 0.25, roughness: 0.8 });
      z.position.set(lado * BASE, 0.07, pistaDe(t)); z.castShadow = false; grupo.add(z); pecas.zonas.push({ z, t, lado });
    }
    // barras de salto: vermelho e branco, de uma parede à outra
    pecas.barras = BARRAS.map(hx => {
      const g = new THREE.Group(); g.position.x = hx;
      for (let k = 0; k < 7; k++) {
        const seg = malha(caixa(0.6, 0.34, 2), k % 2 ? 0xffffff : 0xd9301f, { roughness: 0.5 });
        seg.position.set(0, ALTURA - 0.17, -LZ + 1 + k * 2); g.add(seg);
      }
      grupo.add(g);
      for (const z of [-LZ + 0.1, 0, LZ - 0.1]) { const poste = malha(caixa(0.18, ALTURA + 0.2, 0.18), 0x2b2118); poste.position.set(hx, (ALTURA + 0.2) / 2, z); grupo.add(poste); }
      return g;
    });
    // bastão de cada time e o anel do parceiro que espera
    pecas.bastoes = [0, 1].map(t => {
      const g = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10), c.times[t], { emissive: c.times[t], emissiveIntensity: 0.7 }); haste.rotation.z = Math.PI / 2;
      const ponta = malha(new THREE.SphereGeometry(0.28, 10, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }); ponta.position.x = 1.15; ponta.castShadow = false;
      g.add(haste, ponta); grupo.add(g); return g;
    });
    pecas.esperas = [0, 1].map(t => { const m = malha(new THREE.TorusGeometry(1.1, 0.12, 8, 28), c.times[t], { emissive: c.times[t], emissiveIntensity: 1 }); m.rotation.x = Math.PI / 2; m.castShadow = false; grupo.add(m); return m; });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    if (!pecas.bastoes) return;
    pecas.barras.forEach((g, k) => { g.position.y = d.caida[k] > 0 ? -ALTURA + 0.12 : 0; g.rotation.z = d.caida[k] > 0 ? 0.08 : 0; });
    for (const tm of [0, 1]) {
      const { k, carrega, espera, baseFim } = papeis(d, tm), fim = d.fim[tm];
      const bastao = pecas.bastoes[tm], dono = c.bonecos[carrega];
      bastao.position.set(dono.position.x, dono.position.y + 3.1 + 0.08 * Math.sin(t * 7), dono.position.z);
      bastao.rotation.set(0, t * 1.5, 0.35 * Math.sin(t * 6));
      const anel = pecas.esperas[tm], ee = c.bonecos[espera];
      anel.visible = !fim && k < TRECHOS - 1 && d.preso[espera];
      anel.position.set(ee.position.x, 0.12, ee.position.z); anel.scale.setScalar(1 + 0.12 * Math.sin(t * 8));
      pecas.zonas.filter(z => z.t === tm).forEach(z => {
        const alvo = !fim && z.lado * BASE === baseFim;
        z.z.material.emissiveIntensity = alvo ? 0.55 + 0.4 * Math.sin(t * 6) : 0.2;
      });
    }
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'passa') c.particulas(e.x, 1.4, e.z, c.times[e.t], 20, 8);
      else c.particulas(e.x, 0.6, e.z, 0xb4603c, 10, 5);
    }
  },
};
