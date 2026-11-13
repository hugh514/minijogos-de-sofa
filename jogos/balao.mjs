// Balao no limite: cada aperto enche o balao compartilhado e vale 1. Quem der o aperto que estoura, perde.
import { posiciona, maiorPlacar, elimina } from '../logica.mjs';

const X = 5.8, DURACAO = 25, T_PARADO = 3, MURCHA = 3, MIN = 25, MAX = 45;
const CORES = [0xffe14a, 0xff8a1f, 0xff2a2a];            // tensao 0, 1, 2
const raioDe = ar => 1 + ar * 0.06;

export default {
  id: 'balao', nome: 'Balão no limite', dica: 'Cada aperto enche o balão e vale 1. Quem estourar, PERDE!',
  semMovimento: true, controle: { modo: 'botao', a: 'ENCHE!' }, rotulo: 'sopros', duracao: DURACAO,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    posiciona(p, X);
    p.dados = {
      ar: 0, limite: MIN + Math.floor(p.rng() * (MAX - MIN + 1)), placar: [0, 0], parado: 0, tensao: 0,
      // os limiares de cor mudam a cada rodada, para a cor nao entregar o numero exato
      corte: [0.4 + p.rng() * 0.2, 0.7 + p.rng() * 0.2],
      estourou: -1, pulso: 0, bomba: [0, 0], murchou: 0, aviso: '', avisoCor: '#ffd21f',
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.pulso = Math.max(0, d.pulso - dt * 5); d.murchou = Math.max(0, d.murchou - dt);
    for (const i of [0, 1]) d.bomba[i] = Math.max(0, d.bomba[i] - dt * 6);
    const [a, b] = p.jogadores.map(j => j.apertouA);
    const ordem = a && b && p.rng() < 0.5 ? [1, 0] : [0, 1];      // no mesmo quadro, sorteia quem sopra antes
    for (const i of ordem) {
      for (let k = p.jogadores[i].apertouA; k > 0; k--) {
        d.ar++; d.placar[i]++; d.parado = 0; d.pulso = 1; d.bomba[i] = 1;
        p.eventos.push('pulo');
        if (d.ar >= d.limite) {
          const j = p.jogadores[i];
          d.estourou = i; d.aviso = '';
          j.vx = (i ? 1 : -1) * 9; elimina(p, j, 13);
          p.eventos.push('explosao');
          return 1 - i;
        }
      }
    }
    d.parado += dt;
    if (d.parado >= T_PARADO && d.ar > 0) { d.ar = Math.max(0, d.ar - MURCHA); d.parado = 0; d.murchou = 1; p.eventos.push('troca'); }
    const f = d.ar / d.limite;
    d.tensao = f >= d.corte[1] ? 2 : f >= d.corte[0] ? 1 : 0;
    d.aviso = d.murchou > 0 ? 'MURCHANDO...' : '';
    if (p.t >= DURACAO) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.balao = malha(new THREE.SphereGeometry(1, 28, 20), CORES[0], { emissive: CORES[0], emissiveIntensity: 0.25 });
    pecas.bico = malha(new THREE.ConeGeometry(0.3, 0.5, 12), CORES[0]);
    pecas.bico.position.y = 0.45;
    const base = malha(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 20), 0x555c70);
    base.position.y = 0.15;
    grupo.add(pecas.balao, pecas.bico, base);
    pecas.pistao = [];
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1, x = lado * (X - 1.3);
      const corpo = malha(new THREE.CylinderGeometry(0.35, 0.35, 1, 14), 0x555c70);     // bomba de ar de cada um
      corpo.position.set(x, 0.5, 0);
      const pistao = malha(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 14), cores[i], { emissive: cores[i], emissiveIntensity: 0.3 });
      pistao.position.set(x, 1.5, 0);
      const cano = malha(new THREE.BoxGeometry(X - 1.3, 0.12, 0.12), cores[i]);        // mangueira ate o balao
      cano.position.set(x / 2, 0.08, 0);
      grupo.add(corpo, pistao, cano);
      pecas.pistao[i] = pistao;
    }
    pecas.estourado = false;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, { pecas } = c, b = pecas.balao;
    if (d.estourou >= 0) {
      if (!pecas.estourado) {
        pecas.estourado = true; b.visible = pecas.bico.visible = false;
        const y = 0.7 + raioDe(d.ar);
        c.particulas(0, y, 0, CORES[2], 60, 16); c.particulas(0, y, 0, 0xffffff, 30, 10);
        c.particulas(0, y, 0, c.cores[d.estourou], 30, 12);
      }
      return;
    }
    const f = Math.min(1, d.ar / d.limite), cor = CORES[d.tensao];
    const r = raioDe(d.ar) * (1 + d.pulso * 0.08), treme = 0.01 + 0.3 * f * f * f;
    b.scale.set(r * (1 + Math.sin(t * 31) * treme * 0.3), r * (1 + Math.cos(t * 27) * treme * 0.3), r);
    b.position.set(Math.sin(t * 47) * treme, 0.7 + r + Math.sin(t * 61) * treme * 0.5, Math.cos(t * 53) * treme);
    for (const m of [b, pecas.bico]) { m.material.color.set(cor); m.material.emissive.set(cor); }
    b.material.emissiveIntensity = 0.25 + (d.tensao === 2 ? 0.35 + Math.sin(t * 18) * 0.3 : 0);
    for (const i of [0, 1]) pecas.pistao[i].position.y = 1.5 - d.bomba[i] * 0.6;
  },
};
