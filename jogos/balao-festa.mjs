// Balão da Festa: cada aperto enche o balão e vale 1 sopro. Quem der o aperto que estoura, perde.
// Todos contra todos: um balão no meio da roda, todos sopram nele. Em duplas: cada dupla enche o seu balão (J1 e J3 de um lado,
// J2 e J4 do outro), os sopros dos dois valem para a dupla, e a dupla que estourar perde. O limite é o mesmo nos dois balões.
import { posicionaRoda, posicionaCantos, timeDe, quem, elimina } from '../logica.mjs';

export const DURACAO = 30;
const T_PARADO = 3, MURCHA = 3, MIN = 50, MAX = 90;
const CORES = [0xf4f1e6, 0xff8a1f, 0xff2a2a];            // tensão 0, 1, 2 (o balão calmo é branco: amarelo é a cor do J4)
const raioDe = f => 0.9 + 1.5 * Math.min(1, f);            // f: parte do limite já enchida (0 a 1); até 2,4 para não esconder o boneco de trás
const BX = { vs: [0], times: [-3.8, 3.8] };               // x de cada balão

const dupla = p => p.modo === 'times';
const balaoDe = (p, i) => (dupla(p) ? timeDe(p, i) : 0);

// Limite escondido: de 50 a 90 apertos por soprador do balão, para a rodada durar parecido com 2, 3 ou 4.
// Quatro dedos rápidos (6 apertos por segundo cada) levam mais de 8 s.
export const limiteDe = (n, modo, sorteio) => Math.round((MIN + sorteio * (MAX - MIN)) * (modo === 'times' ? 2 : n));

const novoBalao = corte => ({ ar: 0, parado: 0, tensao: 0, corte, pulso: 0, murchou: 0 });

function totais(p, d) {
  const t = dupla(p) ? [0, 0] : d.sopros.map(() => 0);
  d.sopros.forEach((s, i) => { t[dupla(p) ? timeDe(p, i) : i] += s; });
  return t;
}

// Resultado final (estouro ou tempo): deixa a tela e os celulares no estado final antes de devolver.
function encerra(p, d, res, estourou) {
  d.aviso = res === -1 ? 'Empate!' : estourou >= 0 ? `${quem(p, estourou)} estourou o balão!` : 'Fim do tempo!';
  d.avisoCor = '#ffd21f';
  p.jogadores.forEach((_, i) => {
    const meu = dupla(p) ? timeDe(p, i) : i;
    const texto = res === -1 ? 'Empate!'
      : i === estourou ? 'Você estourou o balão!'
      : meu === res ? 'Você venceu!'
      : estourou >= 0 && dupla(p) && balaoDe(p, i) === balaoDe(p, estourou) ? 'Sua dupla estourou o balão.'
      : 'Fim da rodada. Você não venceu.';
    p.celular[i] = { ...p.celular[i], texto };
  });
  return res;
}

// Quem tem o maior placar entre os índices dados, ou -1 se empatar no topo.
function lider(placar, indices) {
  const maior = Math.max(...indices.map(k => placar[k]));
  const topo = indices.filter(k => placar[k] === maior);
  return topo.length === 1 ? topo[0] : -1;
}

function texto(p, d, i) {
  const base = `Seus sopros: ${d.sopros[i]}.`;
  return (dupla(p) ? `${base} Sua dupla: ${d.placar[timeDe(p, i)]}.` : base) + ' Não estoure!';
}

export default {
  id: 'balao-festa', genero: 'blefe', nome: 'Balão da Festa', dica: 'Aperte para encher o balão e somar sopros, mas quem estourar perde.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'botao', a: 'Encher' }, rotulo: 'sopros', duracao: DURACAO,

  inicia(p) {
    const n = p.jogadores.length, t = dupla(p);
    if (t) { p.arena = { tipo: 'ret', lx: 10.5, lz: 7, parede: true }; posicionaCantos(p, 6.2, 3.4); }
    else { p.arena = { tipo: 'circulo', raio: 8, parede: true }; posicionaRoda(p, 6.3); }
    const baloes = (t ? [0, 1] : [0]).map(() => novoBalao([0.4 + p.rng() * 0.2, 0.7 + p.rng() * 0.2]));   // os limiares de cor mudam a cada rodada
    p.dados = {
      baloes, limite: limiteDe(n, p.modo, p.rng()), sopros: Array(n).fill(0), placar: [], bomba: Array(n).fill(0),
      estourou: -1, estourouQuem: -1, aviso: '', avisoCor: '#ffd21f',
    };
    p.dados.placar = totais(p, p.dados);
    p.jogadores.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: texto(p, p.dados, i) }; });
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    for (const b of d.baloes) { b.pulso = Math.max(0, b.pulso - dt * 5); b.murchou = Math.max(0, b.murchou - dt); }
    for (let i = 0; i < n; i++) d.bomba[i] = Math.max(0, d.bomba[i] - dt * 6);
    const ordem = [...Array(n).keys()];
    for (let k = n - 1; k > 0; k--) { const m = Math.floor(p.rng() * (k + 1)); [ordem[k], ordem[m]] = [ordem[m], ordem[k]]; }   // no mesmo quadro, sorteia quem sopra antes
    for (const i of ordem) {
      const b = d.baloes[balaoDe(p, i)];
      for (let k = p.jogadores[i].apertouA; k > 0; k--) {
        b.ar++; d.sopros[i]++; b.parado = 0; b.pulso = 1; d.bomba[i] = 1;
        p.eventos.push('pulo');
        if (b.ar >= d.limite) {
          const j = p.jogadores[i];
          d.estourou = balaoDe(p, i); d.estourouQuem = i;
          j.vx = (j.x < 0 ? -1 : 1) * 9; elimina(p, j, 13);
          p.eventos.push('explosao');
          d.placar = totais(p, d);
          const res = dupla(p) ? 1 - timeDe(p, i) : lider(d.sopros, [...Array(n).keys()].filter(q => q !== i));
          return encerra(p, d, res, i);
        }
      }
    }
    let murchando = false;
    for (const b of d.baloes) {
      b.parado += dt;
      if (b.parado >= T_PARADO && b.ar > 0) { b.ar = Math.max(0, b.ar - MURCHA); b.parado = 0; b.murchou = 1; p.eventos.push('troca'); }
      const f = b.ar / d.limite;
      b.tensao = f >= b.corte[1] ? 2 : f >= b.corte[0] ? 1 : 0;
      murchando ||= b.murchou > 0;
    }
    d.aviso = murchando ? 'Murchando...' : '';
    d.placar = totais(p, d);
    p.jogadores.forEach((_, i) => { const t = texto(p, d, i); if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; });
    if (p.t >= DURACAO) return encerra(p, d, lider(d.placar, d.placar.map((_, k) => k)), -1);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, t = dupla(p);
    const corDe = i => (t ? c.times[timeDe(p, i)] : c.cores[i]);
    pecas.baloes = BX[t ? 'times' : 'vs'].map(x => {
      const balao = malha(new THREE.SphereGeometry(1, 28, 20), CORES[0], { emissive: CORES[0], emissiveIntensity: 0.25 });
      const bico = malha(new THREE.ConeGeometry(0.3, 0.5, 12), CORES[0]);
      bico.position.set(x, 0.45, 0);
      const base = malha(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 20), 0x555c70);
      base.position.set(x, 0.15, 0);
      grupo.add(balao, bico, base);
      return { x, balao, bico, estourado: false };
    });
    pecas.pistao = p.jogadores.map((j, i) => {
      const x0 = pecas.baloes[balaoDe(p, i)].x, dx = x0 - j.x, dz = -j.z, m = Math.hypot(dx, dz) || 1;
      const bx = j.x + dx / m * 1.4, bz = j.z + dz / m * 1.4;                              // a bomba de ar fica entre o jogador e o balão
      const corpo = malha(new THREE.CylinderGeometry(0.35, 0.35, 1, 14), 0x555c70);
      corpo.position.set(bx, 0.5, bz);
      const pistao = malha(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 14), corDe(i), { emissive: corDe(i), emissiveIntensity: 0.3 });
      pistao.position.set(bx, 1.5, bz);
      const cano = malha(new THREE.BoxGeometry(Math.hypot(x0 - bx, bz), 0.12, 0.12), corDe(i));       // mangueira até o balão
      cano.position.set((bx + x0) / 2, 0.08, bz / 2); cano.rotation.y = Math.atan2(bz, x0 - bx);
      grupo.add(corpo, pistao, cano);
      return pistao;
    });
  },

  desenha(c, dt, t) {
    const d = c.p.dados, { pecas } = c;
    pecas.baloes.forEach((o, k) => {
      const b = d.baloes[k];
      if (d.estourou === k) {
        if (!o.estourado) {
          o.estourado = true; o.balao.visible = o.bico.visible = false;
          const y = 0.7 + raioDe(b.ar / d.limite);
          const cor = (c.p.modo === 'times' ? c.times[k] : c.cores[d.estourouQuem]) ?? CORES[0];
          c.particulas(o.x, y, 0, CORES[2], 60, 16); c.particulas(o.x, y, 0, 0xffffff, 30, 10);
          c.particulas(o.x, y, 0, cor, 30, 12);
        }
        return;
      }
      const f = Math.min(1, b.ar / d.limite), cor = CORES[b.tensao];
      const r = raioDe(f) * (1 + b.pulso * 0.08), treme = 0.01 + 0.3 * f * f * f;
      o.balao.scale.set(r * (1 + Math.sin(t * 31) * treme * 0.3), r * (1 + Math.cos(t * 27) * treme * 0.3), r);
      o.balao.position.set(o.x + Math.sin(t * 47) * treme, 0.7 + r + Math.sin(t * 61) * treme * 0.5, Math.cos(t * 53) * treme);
      for (const m of [o.balao, o.bico]) { m.material.color.set(cor); m.material.emissive.set(cor); }
      o.balao.material.emissiveIntensity = 0.25 + (b.tensao === 2 ? 0.35 + Math.sin(t * 18) * 0.3 : 0);
    });
    pecas.pistao.forEach((m, i) => { m.position.y = 1.5 - d.bomba[i] * 0.6; });
  },
};
