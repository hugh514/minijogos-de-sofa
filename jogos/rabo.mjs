// Rabo de caixas: cada um arrasta uma fila de caixas. Encostar na ULTIMA caixa do outro rouba a caixa.
import { posiciona, pontoNoCirculo, maiorPlacar, elimina, RAIO } from '../logica.mjs';

const TEMPO = 30, ESPACO = 1.25, VEL_CAIXA = 26, PEGA = RAIO + 0.6, T_SOLTA = 6, T_IMUNE = 1, MAX_SOLTAS = 3;

// A caixa anda atras do alvo (o boneco ou a caixa da frente) mantendo a distancia ESPACO.
function segue(caixa, alvo, dt) {
  const dx = alvo.x - caixa.x, dz = alvo.z - caixa.z, dist = Math.hypot(dx, dz);
  if (dist <= ESPACO) return;
  const anda = Math.min(dist - ESPACO, VEL_CAIXA * dt);
  caixa.x += dx / dist * anda; caixa.z += dz / dist * anda;
}

const perto = (j, caixa) => Math.hypot(j.x - caixa.x, j.z - caixa.z) < PEGA;

export default {
  id: 'rabo', nome: 'Rabo de caixas', dica: 'Encoste na ÚLTIMA caixa do rabo do outro para roubar. Quem tiver mais caixas vence!',
  rotulo: 'caixas', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 9, parede: true };
    posiciona(p, 4);
    p.dados = {
      caudas: [-1, 1].map(lado => [1, 2, 3].map(k => ({ x: lado * (4 + k * ESPACO), z: 0 }))),
      soltas: [], prox: T_SOLTA, imune: [0, 0], placar: [3, 3],
      fx: { n: 0, x: 0, z: 0, quem: 0 },          // ultimo roubo ou coleta, para as faiscas
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    const efeito = (caixa, quem) => { d.fx = { n: d.fx.n + 1, x: caixa.x, z: caixa.z, quem }; };

    p.jogadores.forEach((j, i) => {
      let alvo = j;
      for (const caixa of d.caudas[i]) { segue(caixa, alvo, dt); alvo = caixa; }
      d.imune[i] = Math.max(0, d.imune[i] - dt);
    });

    d.prox -= dt;
    if (d.prox <= 0) {
      d.prox = T_SOLTA;
      if (d.soltas.length < MAX_SOLTAS) { d.soltas.push(pontoNoCirculo(p, p.arena.raio - 1.5)); p.eventos.push('troca'); }
    }

    p.jogadores.forEach((j, i) => {               // caixa solta: quem encostar leva
      for (let k = d.soltas.length - 1; k >= 0; k--)
        if (perto(j, d.soltas[k])) {
          const caixa = d.soltas.splice(k, 1)[0];
          d.caudas[i].push(caixa); efeito(caixa, i); p.eventos.push('moeda');
        }
    });

    for (const i of p.rng() < 0.5 ? [0, 1] : [1, 0]) {   // roubo: so a ultima caixa do outro, e fora da imunidade
      const o = 1 - i, ultima = d.caudas[o].at(-1);
      if (!ultima || d.imune[o] > 0 || !perto(p.jogadores[i], ultima)) continue;
      d.caudas[i].push(d.caudas[o].pop());
      d.imune[0] = d.imune[1] = T_IMUNE;            // sem roubo em rajada nem troco na hora
      efeito(ultima, i); p.eventos.push('batida');
      p.celular[o] = { vibra: (p.celular[o].vibra ?? 0) + 1 };
    }

    d.placar = d.caudas.map(cauda => cauda.length);
    for (const i of [0, 1])
      if (!d.caudas[i].length) { elimina(p, p.jogadores[i], 12); p.eventos.push('queda'); return 1 - i; }
    if (p.t >= TEMPO) return maiorPlacar(p);
  },

  monta(c) {
    c.pecas.fx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, pool, cores, pecas } = c, d = c.p.dados;
    const total = d.caudas[0].length + d.caudas[1].length + d.soltas.length;
    const caixas = pool('caixas', total, () => malha(new THREE.BoxGeometry(0.9, 0.9, 0.9), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0 }));
    const setas = pool('setas', 2, () => {
      const m = malha(new THREE.ConeGeometry(0.32, 0.7, 4), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
      m.rotation.x = Math.PI; return m;           // ponta para baixo, em cima da caixa que pode ser roubada
    });
    let n = 0;
    d.caudas.forEach((cauda, i) => {
      const imune = d.imune[i] > 0;
      cauda.forEach((caixa, k) => {
        const m = caixas[n++], ultima = k === cauda.length - 1;
        const pulso = ultima && !imune ? 1 + Math.sin(t * 9) * 0.12 : 1;
        m.position.set(caixa.x, 0.45 * pulso, caixa.z); m.rotation.set(0, 0, 0); m.scale.setScalar(pulso);
        m.material.color.set(cores[i]); m.material.emissive.set(cores[i]);
        m.material.emissiveIntensity = ultima && !imune ? 0.55 : 0.1;
        m.visible = !imune || Math.sin(t * 40) > -0.3;   // pisca enquanto nao pode ser roubada
      });
      const ultima = cauda.at(-1);
      setas[i].visible = !!ultima && !imune;
      if (ultima) setas[i].position.set(ultima.x, 1.7 + Math.sin(t * 6 + i) * 0.18, ultima.z);
      setas[i].rotation.y = t * 3;
    });
    d.soltas.forEach((caixa, k) => {
      const m = caixas[n++];
      m.position.set(caixa.x, 0.75 + Math.sin(t * 4 + k) * 0.15, caixa.z); m.rotation.set(0, t * 2.5, 0); m.scale.setScalar(1);
      m.material.color.set(0xffd84d); m.material.emissive.set(0xffb000); m.material.emissiveIntensity = 0.7;
    });
    if (pecas.fx !== d.fx.n) { pecas.fx = d.fx.n; c.particulas(d.fx.x, 0.8, d.fx.z, cores[d.fx.quem], 16, 8); }
  },
};
