// Igual ou diferente: os dois escolhem uma cor em segredo. Um torce para sair igual, o outro para sair diferente.
import { posiciona, elimina, maiorPlacar } from '../logica.mjs';

const T_ESCOLHE = 4.5, T_DESEMPATE = 3.5, T_REVELA = 2.5, T_FINAL = 1.6, T_SUSPENSE = 0.5, META = 4, MAX_ROUNDS = 6;
const NOMES = ['Vermelho', 'Amarelo', 'Verde'], CORES = [0xff3b30, 0xffd60a, 0x34c759];

function novoRound(p) {
  const d = p.dados;
  d.round++;
  d.igual = d.round === 1 ? (p.rng() < 0.5 ? 0 : 1) : 1 - d.igual;
  d.esc = [-1, -1]; d.fase = 'escolhe'; d.t = d.round > MAX_ROUNDS ? T_DESEMPATE : T_ESCOLHE; d.k = 0; d.mostrou = false;
  posiciona(p, 5);
  for (const j of p.jogadores) { j.vx = j.vz = 0; }
  d.novo = true;                                  // os celulares so mudam com a rodada valendo (toque na intro se perderia)
}

function celulares(p) {
  const d = p.dados;
  d.novo = false;
  for (const i of [0, 1])
    p.celular[i] = {
      modo: 'opcoes', opcoes: NOMES, vibra: d.round,
      texto: i === d.igual ? 'Você é o Igual: 2 pontos se as cores saírem iguais.' : 'Você é o Diferente: 1 ponto se as cores saírem diferentes.',
    };
}

export default {
  id: 'igual', genero: 'blefe', nome: 'Igual ou diferente', dica: 'Escolha uma cor em segredo. Um quer igual, o outro diferente. Dá para ler as cores que o rival já usou!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'pontos', controle: { modo: 'espera' },

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    p.dados = { placar: [0, 0], round: 0, usos: [[0, 0, 0], [0, 0, 0]], inventario: [[], []] };
    novoRound(p);
    for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Prepare-se: olhe para a tela!' };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.novo) celulares(p);
    d.t -= dt;
    if (d.fase === 'escolhe') {
      for (const i of [0, 1]) {
        const op = p.jogadores[i].escolha;
        if (d.esc[i] < 0 && op >= 0 && op < CORES.length) {
          d.esc[i] = op; p.eventos.push('troca');
          p.celular[i] = { modo: 'espera', texto: `Você escolheu ${NOMES[op]}. Disfarce!` };
        }
        if (d.esc[i] < 0 && d.t <= 0) d.esc[i] = Math.floor(p.rng() * CORES.length);   // nao escolheu: sorteio
      }
      d.aviso = (d.round > MAX_ROUNDS ? 'Desempate! ' : '') + `Jogador ${d.igual + 1} quer igual, Jogador ${2 - d.igual} quer diferente. Escolham! ${Math.max(0, Math.ceil(d.t))}`;
      d.avisoCor = '#ffffff';
      if (d.esc[0] < 0 || d.esc[1] < 0) return;
      const iguais = d.esc[0] === d.esc[1];
      d.iguais = iguais; d.ganhou = iguais ? d.igual : 1 - d.igual;
      d.placar[d.ganhou] += iguais ? 2 : 1;
      d.final = d.placar[d.ganhou] >= META || d.round > MAX_ROUNDS || (d.round === MAX_ROUNDS && d.placar[0] !== d.placar[1]);   // empate no 6o round: um round de desempate
      for (const i of [0, 1]) d.usos[i][d.esc[i]]++;
      d.inventario = d.usos.map(u => u.map((n, c) => (n ? `${NOMES[c]} ${n}` : null)).filter(Boolean));   // cores ja usadas: da para ler o rival
      d.fase = 'revela'; d.k = 0; d.t = d.final ? T_FINAL : T_REVELA;
      d.aviso = 'E as cores são...';
      for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Olhe para a tela!' };
      return;
    }
    d.k += dt;
    if (!d.mostrou && d.k >= T_SUSPENSE) {          // os dois pedestais acendem juntos
      d.mostrou = true;
      d.aviso = (d.iguais ? 'Iguais!' : 'Diferentes!') + ` Jogador ${d.ganhou + 1} marca ${d.iguais ? 2 : 1}`;
      d.avisoCor = d.iguais ? '#ffd84d' : '#7ad7ff';
      p.eventos.push(d.iguais ? 'gol' : 'moeda');
      p.jogadores[d.ganhou].vy = 8;
      const perdeu = d.final ? maiorPlacar(p) : -1;
      if (perdeu >= 0) {                            // fim: quem perdeu a disputa sai voando
        const j = p.jogadores[1 - perdeu];
        j.vx = Math.sign(j.x || 1) * 5; elimina(p, j, 14); p.eventos.push('queda');
      }
    }
    if (d.t > 0) return;
    if (d.final) return maiorPlacar(p);
    novoRound(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.orbes = [];
    for (const i of [0, 1]) {
      const x = i ? 2.2 : -2.2;
      const base = malha(new THREE.CylinderGeometry(0.9, 1.2, 1.4, 20), 0x3a3f5c); base.position.set(x, 0.7, 0);
      const anel = malha(new THREE.TorusGeometry(1.3, 0.14, 8, 28), cores[i], { emissive: cores[i], emissiveIntensity: 0.6 });
      anel.rotation.x = Math.PI / 2; anel.position.set(x, 0.1, 0);
      const orbe = malha(new THREE.SphereGeometry(0.8, 20, 14), 0x6a708c, { emissive: 0x000000, emissiveIntensity: 1 });
      orbe.position.set(x, 2.3, 0);
      grupo.add(base, anel, orbe); pecas.orbes.push(orbe);
    }
    pecas.round = 0;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, q = c.pecas;
    const aceso = d.fase === 'revela' && d.k >= T_SUSPENSE;
    if (!aceso) q.estourou = false;
    q.orbes.forEach((o, i) => {
      const x = i ? 2.2 : -2.2;
      if (aceso) {
        const cor = CORES[d.esc[i]] ?? 0xffffff;
        o.material.color.set(cor); o.material.emissive.set(cor);
        o.scale.setScalar(1.25 + Math.sin(t * 8) * 0.08);
        o.position.set(x, 2.5, 0);
        if (!q.estourou) c.particulas(x, 2.5, 0, cor, 40, 9);
      } else if (d.fase === 'revela') {             // suspense: piscam rapido, sem cor
        const pisca = Math.sin(t * 40) > 0 ? 0xffffff : 0x222233;
        o.material.color.set(0x6a708c); o.material.emissive.set(pisca);
        o.scale.setScalar(1); o.position.set(x + Math.sin(t * 50 + i) * 0.06, 2.3, 0);
      } else {                                      // escolhendo: quem ja escolheu fica com o orbe branco pulsando
        const pronto = d.esc?.[i] >= 0;
        o.material.color.set(pronto ? 0xffffff : 0x6a708c); o.material.emissive.set(pronto ? 0x888888 : 0x000000);
        o.scale.setScalar(pronto ? 1.05 + Math.sin(t * 6) * 0.05 : 1);
        o.position.set(x, 2.3 + (pronto ? 0 : Math.sin(t * 2 + i * 2) * 0.1), 0);
      }
    });
    if (aceso && !q.estourou) {
      q.estourou = true;
      if (d.iguais) c.particulas(0, 3, 0, 0xffe14d, 60, 12);   // faiscas douradas no meio quando combinam
    }
  },
};
