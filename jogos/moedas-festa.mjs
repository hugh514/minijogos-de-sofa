// Corrida do ouro (Festa: todos contra todos ou times). Moedas de prata espalhadas pela arena e, de vez em quando, uma moeda grande que vale 3.
// Vence quem (ou o time) chegar primeiro à meta; se ninguém chegar, quem tiver mais moedas aos 40 s. Em times as moedas dos dois do time se somam.
// A arena e o número de moedas no chão crescem com os jogadores, e o empurrão do motor serve para atrapalhar quem está com a moeda quase na mão.
import { posicionaRoda, timeDe, pontoNoCirculo, quem, RAIO } from '../logica.mjs';

export const TEMPO = 40;
export const META_VS = 30, META_TIMES = 45;
const VALOR_GRANDE = 3, T_GRANDE = 7, ENTRE_GRANDES = 8, PRIMEIRA_GRANDE = 6;
const ALCANCE = RAIO + 0.65;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e a moeda: do jogador ou do time
export const metaDe = p => (p.modo === 'times' ? META_TIMES : META_VS);
export const raioDe = n => 7 + n * 0.75;                              // 8,5 com 2, 9,25 com 3 e 10 com 4
export const qtdMoedas = n => n + 1;                                  // moedas de prata no chao ao mesmo tempo

// Nova moeda: num ponto sorteado que nao esteja debaixo dos pes de ninguem (tenta algumas vezes).
function nova(p, valor = 1) {
  let ponto;
  for (let k = 0; k < 12; k++) {
    ponto = pontoNoCirculo(p, p.arena.raio - 1.5);
    const livre = p.jogadores.every(j => Math.hypot(j.x - ponto.x, j.z - ponto.z) > 2.5) && p.dados.moedas.every(m => Math.hypot(m.x - ponto.x, m.z - ponto.z) > 2 * ALCANCE);
    if (livre) break;
  }
  return { ...ponto, valor, t: valor > 1 ? T_GRANDE : Infinity };
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p), meta = metaDe(p);
  p.jogadores.forEach((_, i) => {
    const t = fim ? fim[i] : p.modo === 'times' ? `Seu time: ${d.placar[de(i)]} de ${meta} (você: ${d.pessoais[i]})` : `Você: ${d.placar[i]} de ${meta} moedas`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'moedas-festa', genero: 'corrida', nome: 'Corrida do ouro', dica: 'Pegue as moedas, a grande vale 3, e chegue primeiro à meta ou termine com mais.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: 'Pula' },
  rotulo: 'moedas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length, donos = p.modo === 'times' ? 2 : n;
    p.arena = { tipo: 'circulo', raio: raioDe(n), parede: true };
    posicionaRoda(p, p.arena.raio * 0.5);
    p.dados = { moedas: [], placar: Array(donos).fill(0), pessoais: Array(n).fill(0), proxGrande: PRIMEIRA_GRANDE, fx: [], aviso: '' };
    for (let k = 0; k < qtdMoedas(n); k++) p.dados.moedas.push(nova(p));
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, de = dono(p), meta = metaDe(p);
    d.aviso = p.t < 2.5 ? 'Pegue as moedas!' : '';

    // moeda grande: uma por vez, some se ninguem pegar
    const grande = d.moedas.findIndex(m => m.valor > 1);
    if (grande >= 0) {
      d.moedas[grande].t -= dt;
      if (d.moedas[grande].t <= 0) { d.moedas.splice(grande, 1); d.proxGrande = 4; }
    } else {
      d.proxGrande -= dt;
      if (d.proxGrande <= 0) { d.moedas.push(nova(p, VALOR_GRANDE)); p.eventos.push('troca'); }
    }

    // cada moeda e de quem esta mais perto dela neste quadro (sem favorecer o J1 quando dois chegam juntos)
    for (let k = d.moedas.length - 1; k >= 0; k--) {
      const m = d.moedas[k];
      let melhor = -1, dist = ALCANCE;
      p.jogadores.forEach((j, i) => {
        const r = Math.hypot(j.x - m.x, j.z - m.z);
        if (j.vivo && j.y < 1.2 && r < dist) { dist = r; melhor = i; }
      });
      if (melhor < 0) continue;
      d.placar[de(melhor)] += m.valor; d.pessoais[melhor] += m.valor;
      d.fx.push({ x: m.x, z: m.z, grande: m.valor > 1 });
      p.eventos.push('moeda');
      if (m.valor > 1) { d.moedas.splice(k, 1); d.proxGrande = ENTRE_GRANDES; }
      else d.moedas[k] = nova(p);
    }
    celulares(p);

    const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
    if (maior >= meta || p.t >= TEMPO) return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    // baus do tesouro em volta da arena (so enfeite)
    const r = c.p.arena.raio + 1.6;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + 0.3, g = new THREE.Group();
      const corpo = malha(new THREE.BoxGeometry(1.6, 0.9, 1.1), 0x8a5a2b, { roughness: 0.85 });
      const tampa = malha(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 12, 1, false, 0, Math.PI), 0x6f4521, { roughness: 0.85 });
      tampa.rotation.z = Math.PI / 2; tampa.rotation.y = Math.PI / 2; tampa.position.y = 0.45;
      const fecho = malha(new THREE.BoxGeometry(0.25, 0.35, 0.12), 0xe0b43a, { metalness: 0.5, roughness: 0.3 }); fecho.position.set(0, 0.5, 0.58);
      g.add(corpo, tampa, fecho); g.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r); g.rotation.y = -a + Math.PI / 2; grupo.add(g);
    }
    pecas.visto = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, p, pecas } = c, d = p.dados;
    const fichas = c.pool('fichas', d.moedas.length, () => {
      const g = new THREE.Group();
      const aro = malha(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 24), 0xc9d1dc, { metalness: 0.7, roughness: 0.25 });
      const miolo = malha(new THREE.CylinderGeometry(0.36, 0.36, 0.17, 20), 0xeef2f7, { metalness: 0.6, roughness: 0.25, emissive: 0x333a44 });
      const face = new THREE.Group(); face.add(aro, miolo); face.rotation.x = -0.3; face.rotation.order = 'XZY';
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = -0.7; halo.visible = false;
      g.add(face, halo); g.userData = { face, aro, miolo, halo };
      return g;
    });
    d.moedas.forEach((m, k) => {
      const f = fichas[k], u = f.userData, grande = m.valor > 1;
      f.visible = !(grande && m.t < 2 && Math.floor(t * 8) % 2 === 0);       // a grande pisca antes de sumir
      f.scale.setScalar(grande ? 1.9 : 1.4);
      u.aro.material.color.set(grande ? 0xe8a900 : 0xc9d1dc); u.miolo.material.color.set(grande ? 0xffe27a : 0xeef2f7);
      u.aro.material.emissive.set(grande ? 0x6b4a00 : 0x2a3340);
      u.halo.visible = grande;
      f.position.set(m.x, (grande ? 1.3 : 0.95) + Math.sin(t * 3 + k) * 0.15, m.z);
      u.face.rotation.z = Math.sin(t * 2.5 + k * 2) * 0.2; u.face.rotation.y = grande ? t * 2.5 : 0;
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      c.particulas(e.x, 1, e.z, e.grande ? 0xffd84d : 0xdfe6f0, e.grande ? 24 : 8, e.grande ? 9 : 5);
    }
  },
};
