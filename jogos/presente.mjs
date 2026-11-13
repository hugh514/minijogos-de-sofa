// Bomba ou presente: so o Entregador sabe o que tem na caixa. Ele fala, o outro decide se aceita.
import { posiciona, elimina } from '../logica.mjs';

const T_FALA = 8, T_REVELA = 3, T_FINAL = 1.5, VITORIAS = 2;

function novoRound(p) {
  const d = p.dados;
  d.round++;
  d.entregador = d.round === 1 ? (p.rng() < 0.5 ? 0 : 1) : 1 - d.entregador;
  d.bomba = p.rng() < 0.5;
  d.fase = 'fala'; d.t = T_FALA; d.k = 0; d.aceitou = null;
  posiciona(p, 4);
  for (const j of p.jogadores) { j.vx = j.vz = 0; }
  d.novo = true;                                  // os celulares so mudam com a rodada valendo (toque na intro se perderia)
}

function celulares(p) {
  const d = p.dados, e = d.entregador;
  d.novo = false;
  p.celular[e] = {
    modo: 'espera',
    texto: d.bomba ? 'Só você vê: é uma BOMBA! Convença o outro a aceitar.' : 'Só você vê: é um PRESENTE! Convença o outro a recusar.',
    vibra: d.round,
  };
  p.celular[1 - e] = { modo: 'opcoes', texto: 'Bomba ou presente? Ouça o outro e decida.', opcoes: ['Aceitar', 'Recusar'] };
}

function resolve(p, aceitou) {
  const d = p.dados, e = d.entregador, r = 1 - e;
  const acertou = aceitou !== d.bomba;            // aceitar presente ou recusar bomba
  const ganhou = acertou ? r : e;
  d.aceitou = aceitou; d.ganhou = ganhou;
  d.placar[ganhou]++;
  const final = d.placar[ganhou] >= VITORIAS;
  d.fase = 'revela'; d.k = 0; d.t = final ? T_FINAL : T_REVELA;
  if (d.bomba) {                                  // a bomba estoura em quem errou: quem aceitou, ou o entregador que ficou com ela
    const j = p.jogadores[1 - ganhou];
    j.vx = Math.sign(j.x || 1) * 5;
    if (final) elimina(p, j, 16); else j.vy = 13;
    p.eventos.push('explosao');
  } else {
    p.jogadores[ganhou].vy = 8;                   // pulinho de comemoracao
    p.eventos.push('moeda');
  }
  d.aviso = (d.bomba ? 'BOMBA! ' : 'PRESENTE! ') + (aceitou ? 'Aceitou.' : 'Recusou.') + ` Ponto do Jogador ${ganhou + 1}`;
  d.avisoCor = d.bomba ? '#ff4a4a' : '#ffd84d';
  const texto = d.bomba ? 'Era uma BOMBA!' : 'Era um PRESENTE!';
  for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: texto + (i === ganhou ? ' Ponto seu!' : ' Ponto do outro.') };
}

export default {
  id: 'presente', nome: 'Bomba ou presente', dica: 'Só o Entregador sabe o que tem na caixa. Ele fala, o outro aceita ou recusa!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'rounds', controle: { modo: 'espera' },

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    p.dados = { placar: [0, 0], round: 0 };
    novoRound(p);
    for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Prepare-se: olhe para a tela!' };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.novo) celulares(p);
    d.t -= dt;
    if (d.fase === 'fala') {
      const r = 1 - d.entregador;
      let op = p.jogadores[r].escolha;
      if (d.t <= 0) op = p.rng() < 0.5 ? 0 : 1;   // nao decidiu: o jogo decide na sorte
      if (op === 0 || op === 1) resolve(p, op === 0);
      else { d.aviso = `Jogador ${d.entregador + 1} entrega. Jogador ${r + 1}: aceita ou recusa? ${Math.ceil(d.t)}`; d.avisoCor = '#ffffff'; }
      return;
    }
    d.k += dt;
    if (d.t > 0) return;
    if (d.placar[d.ganhou] >= VITORIAS) return d.ganhou;
    novoRound(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const caixa = pecas.caixa = new THREE.Group();
    caixa.add(malha(new THREE.BoxGeometry(1.8, 1.6, 1.8), 0x8e44ff));
    caixa.children[0].position.y = 0.8;
    const fita = malha(new THREE.BoxGeometry(0.4, 1.62, 1.84), 0xffd84d); fita.position.y = 0.8; caixa.add(fita);
    const tampa = pecas.tampa = new THREE.Group();          // gira pela aresta de tras
    tampa.position.set(0, 1.6, -1);
    const t1 = malha(new THREE.BoxGeometry(2, 0.35, 2), 0xa56bff); t1.position.set(0, 0.17, 1);
    const t2 = malha(new THREE.BoxGeometry(0.4, 0.37, 2.04), 0xffd84d); t2.position.set(0, 0.17, 1);
    const laco = malha(new THREE.SphereGeometry(0.32, 12, 8), 0xffd84d); laco.position.set(0, 0.5, 1);
    tampa.add(t1, t2, laco); caixa.add(tampa);
    pecas.presente = malha(new THREE.IcosahedronGeometry(0.7, 0), 0xffe14d, { emissive: 0xffb300, emissiveIntensity: 1 });
    pecas.bomba = malha(new THREE.SphereGeometry(0.7, 16, 12), 0x1b1b1f);
    pecas.fogo = malha(new THREE.SphereGeometry(1, 16, 12), 0xff7a2f, { emissive: 0xff5a00, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 });
    pecas.anel = malha(new THREE.TorusGeometry(1.15, 0.12, 8, 28), cores[0], { emissive: cores[0], emissiveIntensity: 0.6 });
    pecas.anel.rotation.x = Math.PI / 2; pecas.anel.position.y = 0.08;
    grupo.add(caixa, pecas.presente, pecas.bomba, pecas.fogo, pecas.anel);
    pecas.estouros = 0;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, q = c.pecas, e = d.entregador;
    q.anel.position.x = e ? 4 : -4;                          // anel marca quem e o Entregador
    q.anel.material.color.set(c.cores[e]); q.anel.material.emissive.set(c.cores[e]);
    q.anel.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
    if (d.fase === 'fala') {
      const nervoso = 0.02 + 0.06 * (1 - Math.max(0, d.t) / T_FALA);   // a caixa treme mais perto do fim
      q.caixa.visible = true; q.caixa.rotation.z = Math.sin(t * 22) * nervoso; q.caixa.position.y = Math.abs(Math.sin(t * 3)) * 0.15;
      q.tampa.rotation.x = 0;
      q.presente.visible = q.bomba.visible = q.fogo.visible = false;
      q.estouros = 0;
      return;
    }
    const k = d.k;
    q.caixa.rotation.z = 0; q.caixa.position.y = 0;
    q.tampa.rotation.x = -2.1 * Math.min(1, k / 0.35);
    if (d.bomba) {
      q.bomba.visible = k < 0.5; q.bomba.position.set(0, 1 + Math.min(k, 0.5) * 3, 0);
      const f = (k - 0.5) / 0.6;                             // bola de fogo cresce e some
      q.fogo.visible = f > 0 && f < 1;
      q.fogo.position.set(0, 2, 0); q.fogo.scale.setScalar(0.5 + Math.max(0, f) * 4); q.fogo.material.opacity = 0.85 * (1 - Math.min(1, Math.max(0, f)));
      q.caixa.visible = k < 0.5;                             // a caixa vai pelos ares
      if (k >= 0.5 && !q.estouros) {
        q.estouros = 1;
        c.particulas(0, 1.5, 0, 0xff7a2f, 70, 14); c.particulas(0, 1.5, 0, 0xffe14d, 40, 10); c.particulas(0, 1, 0, 0x8e44ff, 30, 12);
        const v = c.bonecos[1 - d.ganhou].position;
        c.particulas(v.x, 1, v.z, 0x555555, 25, 8);
      }
    } else {
      q.presente.visible = true;
      q.presente.position.set(0, 1 + Math.min(1, k / 0.6) * 2.2 + Math.sin(t * 4) * 0.12, 0);
      q.presente.rotation.y = t * 3;
      const n = Math.min(4, 1 + Math.floor(k / 0.3));        // faiscas em sequencia, uma cor por vez
      if (q.estouros < n) c.particulas(0, 2.5, 0, [0xffe14d, c.cores[0], c.cores[1], 0x35c26b][q.estouros++], 35, 9);
    }
  },
};
