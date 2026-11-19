// Cofre ganancioso: a coluna de moedas sobe cada vez mais rapido e explode num ponto oculto.
// Cada um aperta UMA vez por cofre para pegar o valor atual. Quem nao pegou antes da explosao fica com zero naquele cofre.
// Sao 3 cofres; as moedas somam e vence quem juntar mais.
import { posiciona, maiorPlacar, elimina } from '../logica.mjs';

export const COFRES = 3;
const X = 5, X_FORA = 7.2, VEL = 2.5, ACEL = 0.8, MIN = 20, MAX = 100, T_ENTRE = 2;
// Sem isto, pegar primeiro quase sempre perde (o outro pega um instante depois, um pouco mais).
// Quem pega primeiro trava o botao do outro por TRAVA segundos e o cofre passa a subir FURIA vezes mais rapido.
// Para a regra pura, ponha TRAVA = 0 e FURIA = 1.
const TRAVA = 1.5, FURIA = 2;
const ALTURA = 0.05, ALTURA_PILHA = 0.02, OURO = 0xffc93c;

function novoCofre(p) {
  const d = p.dados;
  d.cofre++; d.entre = 0;
  Object.assign(d, { valor: 0, vel: VEL, explode: MIN + p.rng() * (MAX - MIN), pego: [0, 0], saiu: [false, false], trava: [0, 0], furia: false, explodiu: false });
  d.aviso = '0'; d.avisoCor = '#ffd84d';
  p.jogadores.forEach((j, i) => { j.x = (i ? 1 : -1) * X; j.z = 0; p.celular[i] = { a: 'PEGA!', texto: `Cofre ${d.cofre} de ${COFRES}: aperte uma vez para pegar as moedas` }; });
}

// Fecha o cofre atual: guarda as moedas e mostra o resultado por um instante.
function fecha(p, aviso) {
  const d = p.dados;
  d.total = d.total.map((t, i) => t + d.pego[i]);
  d.placar = [...d.total]; d.entre = T_ENTRE; d.aviso = aviso; d.avisoCor = '#ffd84d';
  for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: `Neste cofre: ${d.pego[i]} moedas. Total: ${d.total[i]}` };
}

export default {
  id: 'cofre', genero: 'blefe', nome: 'Cofre ganancioso', dica: 'Aperte uma vez para pegar as moedas do cofre. Explodiu antes? Zero! São 3 cofres.',
  semMovimento: true, controle: { modo: 'botao', a: 'PEGA!' }, rotulo: 'moedas',

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    posiciona(p, X);
    p.dados = { cofre: 0, total: [0, 0], placar: [0, 0] };
    novoCofre(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.entre > 0) {                                           // intervalo entre um cofre e outro
      d.entre -= dt;
      if (d.entre > 0) return;
      if (d.cofre < COFRES) { novoCofre(p); return; }
      const v = maiorPlacar(p);
      if (v >= 0) { const j = p.jogadores[1 - v]; j.vx = (v ? -1 : 1) * 9; elimina(p, j, 13); }   // o mais pobre sai voando
      return v;
    }
    const pegam = [0, 1].filter(i => p.jogadores[i].apertouA > 0 && !d.saiu[i] && d.trava[i] <= 0);
    for (const i of pegam) {
      const j = p.jogadores[i];
      d.saiu[i] = true; d.pego[i] = Math.floor(d.valor);
      j.x = (i ? 1 : -1) * X_FORA; j.vy = 7;                       // sai de perto do cofre com um pulinho
      p.celular[i] = { modo: 'espera', texto: `Você garantiu ${d.pego[i]} moedas. Torça pela explosão!` };
      p.eventos.push('moeda');
    }
    d.placar = d.total.map((t, i) => t + d.pego[i]);
    if (d.saiu[0] && d.saiu[1]) { fecha(p, 'Os dois pegaram!'); return; }     // nao tem explosao para torcer
    for (const i of [0, 1]) {
      if (d.saiu[i]) continue;
      if (pegam.length && TRAVA > 0) { d.trava[i] = TRAVA; p.celular[i] = { a: 'TRAVADO!', vibra: 1 }; p.eventos.push('troca'); }
      else if (d.trava[i] > 0 && (d.trava[i] -= dt) <= 0) p.celular[i] = { a: 'PEGA!', vibra: 2 };
    }
    if (pegam.length) d.furia = true;

    d.vel += ACEL * dt;
    d.valor += d.vel * (d.furia ? FURIA : 1) * dt;
    if (d.valor >= d.explode) {
      d.valor = d.explode; d.explodiu = true;
      for (const i of [0, 1]) if (!d.saiu[i]) { const j = p.jogadores[i]; j.vy = 10; j.vx = (i ? 1 : -1) * 3; }   // susto de quem ficou
      p.eventos.push('explosao');
      fecha(p, 'Explodiu!');
      return;
    }
    d.aviso = String(Math.floor(d.valor)); d.avisoCor = d.furia ? '#ff4a4a' : '#ffd84d';
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.cofre = malha(new THREE.BoxGeometry(2.8, 1.2, 2.8), 0x4a5568, { emissive: 0xff2a2a, emissiveIntensity: 0 });
    pecas.cofre.position.y = 0.6;
    const boca = malha(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 24), 0x1c2130);
    boca.position.y = 1.22;
    pecas.coluna = malha(new THREE.CylinderGeometry(0.8, 0.8, 1, 24), OURO, { emissive: OURO, emissiveIntensity: 0.35 });
    pecas.topo = malha(new THREE.CylinderGeometry(1, 1, 0.18, 24), 0xfff2a8, { emissive: OURO, emissiveIntensity: 0.6 });
    grupo.add(pecas.cofre, boca, pecas.coluna, pecas.topo);
    pecas.pilha = []; pecas.fora = []; pecas.trava = [];
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1;
      const base = malha(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 24), cores[i]);                 // onde cada um espera
      base.position.set(lado * X, 0.03, 0);
      pecas.trava[i] = malha(new THREE.TorusGeometry(1.35, 0.14, 8, 28), 0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 1 });
      pecas.trava[i].rotation.x = Math.PI / 2; pecas.trava[i].position.set(lado * X, 0.2, 0);
      pecas.fora[i] = malha(new THREE.BoxGeometry(2.6, 0.08, 5), 0x2a3040, { emissive: cores[i], emissiveIntensity: 0 });   // area de quem ja saiu
      pecas.fora[i].position.set(lado * X_FORA, 0.04, -0.6);
      pecas.pilha[i] = malha(new THREE.CylinderGeometry(0.6, 0.6, 1, 20), OURO, { emissive: OURO, emissiveIntensity: 0.35 });
      pecas.pilha[i].position.set(lado * X_FORA, 0, -2);
      grupo.add(base, pecas.trava[i], pecas.fora[i], pecas.pilha[i]);
    }
    pecas.viuSaida = [false, false]; pecas.viuExplosao = false;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, { pecas, cores } = c;
    if (pecas.cofreVisto !== d.cofre) {                          // cofre novo: fecha e limpa o que o anterior mostrou
      pecas.cofreVisto = d.cofre;
      pecas.viuSaida = [false, false]; pecas.viuExplosao = false;
      pecas.cofre.rotation.z = 0; pecas.cofre.material.color.set(0x4a5568);
    }
    for (const i of [0, 1]) {
      const pilha = pecas.pilha[i], h = d.placar[i] * ALTURA_PILHA;
      pilha.visible = h > 0;
      pilha.scale.y = Math.max(0.01, h); pilha.position.y = h / 2;
      pecas.fora[i].material.emissiveIntensity = d.saiu[i] ? 0.7 : 0;
      pecas.trava[i].visible = d.trava[i] > 0 && !d.saiu[i] && !d.explodiu;
      pecas.trava[i].scale.setScalar(1 + Math.sin(t * 16) * 0.06);
      if (d.saiu[i] && !pecas.viuSaida[i]) {
        pecas.viuSaida[i] = true;
        c.particulas(pilha.position.x, h + 0.3, pilha.position.z, OURO, 24, 7);
        c.particulas(pilha.position.x, 0.5, 0, cores[i], 14, 6);
      }
    }
    const h = Math.max(0.02, d.valor * ALTURA), forca = d.vel * (d.furia ? 2 : 1), treme = Math.min(0.12, forca * 0.006);
    const dx = Math.sin(t * 43) * treme, dz = Math.cos(t * 37) * treme;
    pecas.coluna.visible = pecas.topo.visible = !d.explodiu;
    pecas.coluna.scale.y = h; pecas.coluna.position.set(dx, 1.25 + h / 2, dz);
    pecas.topo.position.set(dx, 1.34 + h, dz); pecas.topo.rotation.y = t * 3;
    pecas.cofre.position.x = dx * 0.5; pecas.cofre.position.z = dz * 0.5;
    pecas.cofre.material.emissiveIntensity = d.explodiu ? 0 : d.furia ? 0.5 + Math.sin(t * 14) * 0.3 : 0;
    if (d.explodiu && !pecas.viuExplosao) {
      pecas.viuExplosao = true;
      pecas.cofre.rotation.z = 0.25; pecas.cofre.material.color.set(0x1c2130);
      c.particulas(0, 1.5 + h / 2, 0, OURO, 70, 16);
      c.particulas(0, 1.5, 0, 0xff2a2a, 40, 12);
      c.particulas(0, 1.5 + h, 0, 0xffffff, 20, 9);
    }
  },
};
