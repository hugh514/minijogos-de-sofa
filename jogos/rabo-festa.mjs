// Rabo de caixas na festa (todos contra todos ou times). Cada um arrasta uma fila de 3 caixas. Encostar na última caixa do rabo
// de um rival (nunca de quem é do seu time) rouba a caixa. Quem fica sem caixas sai e espera. Vence o último de pé (ou a dupla
// que ainda tem alguém de pé), ou quem tiver mais caixas no fim do tempo; em times as caixas da dupla somam juntas.
import { posicionaRoda, pontoNoCirculo, timeDe, elimina, quem, RAIO } from '../logica.mjs';

const TEMPO = 35, ESPACO = 1.25, VEL_CAIXA = 26, PEGA = RAIO + 0.6, T_SOLTA = 6, T_IMUNE = 1, T_INICIO = 1.5, CAIXAS = 3;
const NOME_TIME = ['laranja', 'roxa'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem é a caixa no placar: do jogador ou da dupla
const rivais = (p, a, b) => a !== b && (p.modo !== 'times' || timeDe(p, a) !== timeDe(p, b));
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);

// A caixa anda atrás do alvo (o boneco ou a caixa da frente) mantendo a distância ESPACO.
function segue(caixa, alvo, dt) {
  const dx = alvo.x - caixa.x, dz = alvo.z - caixa.z, dist = Math.hypot(dx, dz);
  if (dist <= ESPACO) return;
  const anda = Math.min(dist - ESPACO, VEL_CAIXA * dt);
  caixa.x += dx / dist * anda; caixa.z += dz / dist * anda;
}

const perto = (j, caixa) => Math.hypot(j.x - caixa.x, j.z - caixa.z) < PEGA;

function somaCaixas(p) {
  const de = dono(p), totais = Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0);
  p.dados.caudas.forEach((c, i) => { totais[de(i)] += c.length; });
  return totais;
}

// Quem ganhou: o último dono (jogador ou dupla) com alguém de pé; no tempo, o de mais caixas (igual dá empate).
function resultado(p) {
  const d = p.dados, de = dono(p), vivos = new Set(p.jogadores.flatMap((j, i) => (j.vivo ? [de(i)] : [])));
  if (vivos.size <= 1) return vivos.size ? [...vivos][0] : -1;
  if (p.t >= TEMPO) {
    const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  if (r !== undefined) {
    d.aviso = r < 0 ? 'Empate!' : times ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`;
    d.avisoCor = '#ffd23f'; d.avisoT = 0;
  }
  p.jogadores.forEach((j, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (!j.vivo) t = 'Você ficou sem caixas. Torça!';
    else t = `Suas caixas: ${d.caudas[i].length}.${times ? ` Dupla: ${d.placar[de(i)]}.` : ''} Roube a última de um rival!`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'rabo-festa', genero: 'empurra', nome: 'Rabo de caixas na festa', dica: 'Encoste na última caixa do rabo de um rival para roubar, e quem tiver mais caixas vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  rotulo: 'caixas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length, raio = 9 + (n - 2) * 0.75;      // a arena cresce com o número de jogadores
    p.arena = { tipo: 'circulo', raio, parede: true };
    posicionaRoda(p, raio * 0.5);
    p.dados = {
      caudas: p.jogadores.map(j => {                              // o rabo nasce atrás de cada um, para fora da roda
        const m = Math.hypot(j.x, j.z) || 1;
        return Array.from({ length: CAIXAS }, (_, k) => ({ x: j.x + j.x / m * (k + 1) * ESPACO, z: j.z + j.z / m * (k + 1) * ESPACO }));
      }),
      soltas: [], prox: T_SOLTA, imune: Array(n).fill(T_INICIO), placar: [], inventario: [],
      aviso: 'Roube a última caixa dos rivais!', avisoCor: '#ffffff', avisoT: 2.5,
      fx: { n: 0, x: 0, z: 0, quem: 0 },          // último roubo ou coleta, para as faíscas
    };
    p.dados.placar = somaCaixas(p);
    p.dados.inventario = p.dados.caudas.map(c => ['Caixas ' + c.length]);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, n = js.length;
    const efeito = (caixa, quem) => { d.fx = { n: d.fx.n + 1, x: caixa.x, z: caixa.z, quem }; };
    if (d.avisoT > 0 && (d.avisoT -= dt) <= 0) d.aviso = '';

    js.forEach((j, i) => {
      let alvo = j;
      for (const caixa of d.caudas[i]) { segue(caixa, alvo, dt); alvo = caixa; }
      d.imune[i] = Math.max(0, d.imune[i] - dt);
    });

    d.prox -= dt;
    if (d.prox <= 0) {
      d.prox = T_SOLTA;
      if (d.soltas.length < n + 1) { d.soltas.push(pontoNoCirculo(p, p.arena.raio - 1.5)); p.eventos.push('troca'); }
    }

    js.forEach((j, i) => {                        // caixa solta: quem encostar leva
      if (!j.vivo) return;
      for (let k = d.soltas.length - 1; k >= 0; k--)
        if (perto(j, d.soltas[k])) {
          const caixa = d.soltas.splice(k, 1)[0];
          d.caudas[i].push(caixa); efeito(caixa, i); p.eventos.push('moeda');
        }
    });

    const ordem = js.map((_, i) => [p.rng(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);      // quem tenta primeiro é sorteado
    for (const i of ordem) {                      // roubo: só a última caixa de um rival, e fora da imunidade; um roubo por quadro
      if (!js[i].vivo) continue;
      for (const o of ordem) {
        const ultima = d.caudas[o].at(-1);
        if (!ultima || !rivais(p, i, o) || !js[o].vivo || d.imune[o] > 0 || !perto(js[i], ultima)) continue;
        d.caudas[i].push(d.caudas[o].pop());
        d.imune[i] = d.imune[o] = T_IMUNE;        // sem roubo em rajada nem troco na hora
        efeito(ultima, i); p.eventos.push('batida');
        p.celular[o] = { ...p.celular[o], vibra: (p.celular[o].vibra ?? 0) + 1 };
        if (!d.caudas[o].length) { elimina(p, js[o], 12); p.eventos.push('queda'); }
        break;
      }
    }

    d.placar = somaCaixas(p);
    d.inventario = d.caudas.map(c => ['Caixas ' + c.length]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    c.pecas.fx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, pool, pecas } = c, d = c.p.dados, n = c.p.jogadores.length;
    const total = d.caudas.reduce((s, cauda) => s + cauda.length, 0) + d.soltas.length;
    const caixas = pool('caixas', total, () => malha(new THREE.BoxGeometry(0.9, 0.9, 0.9), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0 }));
    const setas = pool('setas', n, () => {
      const m = malha(new THREE.ConeGeometry(0.32, 0.7, 4), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
      m.rotation.x = Math.PI; return m;           // ponta para baixo, em cima da caixa que pode ser roubada
    });
    let k0 = 0;
    d.caudas.forEach((cauda, i) => {
      const imune = d.imune[i] > 0, cor = corDe(c, i);
      cauda.forEach((caixa, k) => {
        const m = caixas[k0++], ultima = k === cauda.length - 1;
        const pulso = ultima && !imune ? 1 + Math.sin(t * 9) * 0.12 : 1;
        m.position.set(caixa.x, 0.45 * pulso, caixa.z); m.rotation.set(0, 0, 0); m.scale.setScalar(pulso);
        m.material.color.set(cor); m.material.emissive.set(cor);
        m.material.emissiveIntensity = ultima && !imune ? 0.55 : 0.1;
        m.visible = !imune || Math.sin(t * 40) > -0.3;   // pisca enquanto não pode ser roubada
      });
      const ultima = cauda.at(-1);
      setas[i].visible = !!ultima && !imune;
      if (ultima) setas[i].position.set(ultima.x, 1.7 + Math.sin(t * 6 + i) * 0.18, ultima.z);
      setas[i].rotation.y = t * 3;
    });
    d.soltas.forEach((caixa, k) => {
      const m = caixas[k0++];
      m.position.set(caixa.x, 0.75 + Math.sin(t * 4 + k) * 0.15, caixa.z); m.rotation.set(0, t * 2.5, 0); m.scale.setScalar(1);
      m.material.color.set(0xffd84d); m.material.emissive.set(0xffb000); m.material.emissiveIntensity = 0.7;
      m.visible = true;
    });
    if (pecas.fx !== d.fx.n) { pecas.fx = d.fx.n; c.particulas(d.fx.x, 0.8, d.fx.z, corDe(c, d.fx.quem), 16, 8); }
  },
};
