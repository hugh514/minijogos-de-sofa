// Rei da colina na festa (todos contra todos ou times). Uma zona amarela muda de lugar a cada 6 s.
// Soma segundos quem está sozinho nela; em times, só gente da mesma dupla (os dois dentro somam uma vez só). Com rivais dentro
// ninguém soma: empurre (A) os outros para fora. Vence quem chegar a 12 s, ou quem tiver mais segundos no fim do tempo.
import { posicionaRoda, timeDe, pontoNoCirculo, quem } from '../logica.mjs';

export const TEMPO = 40, META = 12;
const R_ZONA = 2.6, T_MUDA = 6, PRIMEIRA = 5, V_ZONA = 4, AMARELO = 0xffe35a;       // amarelo-limão, mais claro que o amarelo de jogador
const NOME_TIME = ['laranja', 'roxa'];

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // para quem vai o segundo: o jogador ou a dupla
const corDono = (c, k) => (times(c.p) ? c.times[k] : c.cores[k]);
const naZona = (p, j) => j.vivo && Math.hypot(j.x - p.dados.zona.x, j.z - p.dados.zona.z) < p.dados.zona.r;

// Próximo lugar da zona: dentro da arena e longe do lugar atual (tenta algumas vezes).
function novoAlvo(p) {
  const z = p.dados.zona;
  let ponto;
  for (let k = 0; k < 8; k++) {
    ponto = pontoNoCirculo(p, p.arena.raio - z.r);
    if (Math.hypot(ponto.x - z.x, ponto.z - z.z) > 4.5) break;
  }
  return ponto;
}

function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) { d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`; d.avisoCor = '#ffd23f'; }
  p.jogadores.forEach((j, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else {
      const cab = `${times(p) ? 'Dupla' : 'Você'}: ${Math.floor(d.placar[de(i)])} de ${META} s.`;
      t = cab + (!naZona(p, j) ? ' Corra para a zona amarela.' : d.disputa ? ' Disputa! Empurre o rival para fora.' : ' Na zona, somando!');
    }
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'colina-festa', genero: 'empurra', nome: 'Reis da colina', dica: 'Some segundos na zona amarela e empurre os rivais para fora dela.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: 'Pula' }, rotulo: 'segundos na zona', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: 8 + n * 0.5, parede: true };       // 9 com 2, 9,5 com 3 e 10 com 4
    posicionaRoda(p, p.arena.raio * 0.62);       // todos à mesma distância da primeira zona, que nasce no centro
    p.dados = {
      zona: { x: 0, z: 0, r: R_ZONA }, alvo: { x: 0, z: 0 }, muda: PRIMEIRA, trocas: 0,
      placar: Array(times(p) ? 2 : n).fill(0), dono: -1, disputa: false, aviso: '', avisoCor: '#ffffff',
    };
    textos(p);
  },

  atualiza(p, dt) {
    const d = p.dados, z = d.zona, de = dono(p);
    d.muda -= dt;
    if (d.muda <= 0) {
      d.alvo = novoAlvo(p); d.muda = T_MUDA; d.trocas++;
      p.eventos.push('troca');
      p.jogadores.forEach((_, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; });
    }
    const dx = d.alvo.x - z.x, dz = d.alvo.z - z.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) { const anda = Math.min(dist, V_ZONA * dt); z.x += dx / dist * anda; z.z += dz / dist * anda; }

    const donos = new Set(p.jogadores.flatMap((j, i) => (naZona(p, j) ? [de(i)] : [])));
    d.disputa = donos.size > 1;
    d.dono = donos.size === 1 ? [...donos][0] : -1;
    let r;
    if (d.dono >= 0) {
      const antes = Math.floor(d.placar[d.dono]);
      d.placar[d.dono] += dt;
      if (Math.floor(d.placar[d.dono]) > antes) p.eventos.push('ponto');
      if (d.placar[d.dono] >= META) r = d.dono;
    }
    if (r === undefined && p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      r = lideres.length === 1 ? lideres[0] : -1;
    }
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    // a zona: disco amarelo opaco, aro que ganha a cor de quem está somando e estacas na borda
    const g = pecas.zona = new THREE.Group();
    pecas.disco = malha(new THREE.CylinderGeometry(1, 1, 0.1, 40), AMARELO, { emissive: AMARELO, emissiveIntensity: 0.45, roughness: 0.6 });
    pecas.disco.castShadow = false;
    pecas.aro = malha(new THREE.TorusGeometry(1, 0.07, 8, 48), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
    pecas.aro.rotation.x = Math.PI / 2; pecas.aro.position.y = 0.12; pecas.aro.castShadow = false;
    g.add(pecas.disco, pecas.aro);
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5, e = malha(new THREE.ConeGeometry(0.05, 0.6, 5), 0xfff3a0, { emissive: 0xb89600, flatShading: true });
      e.position.set(Math.cos(a), 0.3, Math.sin(a)); g.add(e);
    }
    grupo.add(g);
    // para onde a zona está indo
    pecas.destino = malha(new THREE.TorusGeometry(R_ZONA, 0.1, 6, 40), AMARELO, { emissive: AMARELO, emissiveIntensity: 0.9 });
    pecas.destino.rotation.x = Math.PI / 2; pecas.destino.position.y = 0.08; pecas.destino.castShadow = false; grupo.add(pecas.destino);
    // coroa em cima de quem está somando
    pecas.coroas = c.bonecos.map(() => {
      const k = new THREE.Group(), ouro = { emissive: 0xb07a00, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3, flatShading: true };
      const base = malha(new THREE.CylinderGeometry(0.55, 0.5, 0.3, 10, 1, true), 0xffc21a, { ...ouro, side: THREE.DoubleSide });
      k.add(base);
      for (let q = 0; q < 5; q++) {
        const a = q * 2 * Math.PI / 5, ponta = malha(new THREE.ConeGeometry(0.17, 0.45, 4), 0xffc21a, ouro);
        ponta.position.set(Math.cos(a) * 0.5, 0.36, Math.sin(a) * 0.5); k.add(ponta);
      }
      k.scale.setScalar(1.25); k.visible = false; grupo.add(k); return k;
    });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados, z = d.zona, de = dono(p);
    const r = z.r * (1 + Math.sin(t * 5) * 0.03);
    pecas.zona.position.set(z.x, 0.03, z.z); pecas.zona.scale.set(r, 1, r);
    // somando: acesa; vazia: meia luz; disputada: pisca apagada (ninguém soma)
    pecas.disco.material.emissiveIntensity = d.dono >= 0 ? 0.75 + Math.sin(t * 10) * 0.15 : d.disputa ? (Math.floor(t * 6) % 2 ? 0.05 : 0.4) : 0.4;
    const corAro = d.dono >= 0 ? corDono(c, d.dono) : 0xffffff;
    pecas.aro.material.color.set(corAro); pecas.aro.material.emissive.set(corAro);
    pecas.destino.visible = Math.hypot(d.alvo.x - z.x, d.alvo.z - z.z) > 0.4;
    pecas.destino.position.set(d.alvo.x, 0.08, d.alvo.z);
    c.bonecos.forEach((b, i) => {
      const k = pecas.coroas[i];
      k.visible = d.dono === de(i) && naZona(p, p.jogadores[i]);
      k.position.set(b.position.x, b.position.y + 3.3 + Math.sin(t * 4 + i) * 0.08, b.position.z);      // logo acima da plaquinha do nome
      k.rotation.y = t * 1.5;
    });
  },
};
