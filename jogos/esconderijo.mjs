// Quatro esconderijos: um esconde o tesouro em uma das 4 caixas e da uma dica (verdadeira ou falsa). O outro tem 2 palpites.
import { elimina } from '../logica.mjs';

const T_ESCONDE = 5, T_PALPITE = 7, T_REVELA = 2.5, T_FINAL = 1.6, PALPITES = 2;
const T_ESCONDE_RAPIDO = 3, T_PALPITE_RAPIDO = 4;             // round de desempate
const NOMES = ['Vermelha', 'Amarela', 'Verde', 'Roxa'], CORES = [0xff3b30, 0xffd60a, 0x34c759, 0xa259ff];
const CAIXA_X = [-6, -2, 2, 6], Z_ESCONDE = -3.6, Z_PROCURA = 3.4;

const rapido = d => d.round > 2;
const prefixo = d => (rapido(d) ? 'Desempate! ' : '');

function novoRound(p) {
  const d = p.dados;
  d.round++;
  d.esconde = d.round === 2 ? 1 - d.esconde : (p.rng() < 0.5 ? 0 : 1);   // rounds 1 e 3 sorteiam, o 2 troca
  d.tesouro = -1; d.abertas = [false, false, false, false]; d.palpites = PALPITES;
  d.fase = 'esconde'; d.t = rapido(d) ? T_ESCONDE_RAPIDO : T_ESCONDE; d.k = 0; d.alvoX = 0;
  const e = d.esconde;
  Object.assign(p.jogadores[e], { x: 0, z: Z_ESCONDE, vx: 0, vz: 0 });
  Object.assign(p.jogadores[1 - e], { x: 0, z: Z_PROCURA, vx: 0, vz: 0 });
  d.novo = true;                                  // os celulares so mudam com a rodada valendo (toque na intro se perderia)
}

function celulares(p) {
  const d = p.dados, e = d.esconde;
  d.novo = false;
  p.celular[e] = { modo: 'opcoes', opcoes: NOMES, texto: 'Só você vê: em qual caixa esconder o tesouro?', vibra: d.round };
  p.celular[1 - e] = { modo: 'espera', texto: 'O outro está escondendo o tesouro. Não vale espiar!' };
}

function celularProcura(p, texto) {
  const d = p.dados;
  p.celular[1 - d.esconde] = {
    modo: 'opcoes', texto, vibra: d.round * 10 + d.palpites,
    opcoes: NOMES.map((n, i) => (d.abertas[i] ? n + ' (vazia)' : n)),
  };
}

function termina(p, achou) {
  const d = p.dados, ganhou = achou ? 1 - d.esconde : d.esconde;
  const pontos = achou && d.palpites === PALPITES - 1 ? 2 : 1;     // achar de primeira vale 2
  d.achou = achou; d.ganhou = ganhou; d.pontos = pontos;
  d.placar[ganhou] += pontos;
  d.final = d.round >= 2 && d.placar[0] !== d.placar[1];
  d.fase = 'revela'; d.k = 0; d.t = d.final ? T_FINAL : T_REVELA;
  d.aviso = (achou ? 'Achou!' : 'Não achou!') + (pontos > 1 ? ` De primeira: 2 pontos do Jogador ${ganhou + 1}` : ` Ponto do Jogador ${ganhou + 1}`);
  d.avisoCor = achou ? '#ffd84d' : '#ff4a4a';
  p.eventos.push(achou ? 'gol' : 'explosao');
  p.jogadores[ganhou].vy = 8;
  if (d.final) {                                  // fim: quem perdeu a disputa sai voando
    const j = p.jogadores[d.placar[0] > d.placar[1] ? 1 : 0];
    j.vz = Math.sign(j.z || 1) * 4; elimina(p, j, 14);
  }
  for (const i of [0, 1])
    p.celular[i] = { modo: 'espera', texto: `O tesouro estava na caixa ${NOMES[d.tesouro]}.` + (i === ganhou ? (pontos > 1 ? ' 2 pontos seus!' : ' Ponto seu!') : (pontos > 1 ? ' 2 pontos do outro.' : ' Ponto do outro.')) };
}

export default {
  id: 'esconderijo', genero: 'blefe', nome: 'Quatro esconderijos', dica: 'Um esconde o tesouro e dá uma dica, verdadeira ou falsa. O outro tem 2 palpites, e achar de primeira vale 2 pontos!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'rounds', controle: { modo: 'espera' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5.5, parede: true };
    p.dados = { placar: [0, 0], round: 0, esconde: 0 };
    novoRound(p);
    for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Prepare-se: olhe para a tela!' };
  },

  atualiza(p, dt) {
    const d = p.dados, e = d.esconde, r = 1 - e;
    if (d.novo) celulares(p);
    d.t -= dt;
    if (d.fase === 'esconde') {
      let op = p.jogadores[e].escolha;
      if (d.t <= 0) op = Math.floor(p.rng() * 4);             // nao escondeu: sorteio
      if (op >= 0 && op < 4) {
        d.tesouro = op; d.fase = 'procura'; d.t = rapido(d) ? T_PALPITE_RAPIDO : T_PALPITE;
        p.eventos.push('troca');
        p.celular[e] = { modo: 'espera', texto: `Só você vê: o tesouro está na caixa ${NOMES[op]}. Dê uma dica, verdadeira ou falsa!` };
        celularProcura(p, 'Onde está o tesouro? Você tem 2 palpites.');
      } else { d.aviso = `${prefixo(d)}Jogador ${e + 1} está escondendo o tesouro... ${Math.ceil(d.t)}`; d.avisoCor = '#ffffff'; }
      return;
    }
    if (d.fase === 'procura') {
      const j = p.jogadores[r];
      j.x += (d.alvoX - j.x) * Math.min(1, dt * 8);           // o boneco vai ate a caixa do palpite
      let op = j.escolha;
      if (d.t <= 0) {                                         // nao palpitou: sorteio entre as fechadas
        const fechadas = [0, 1, 2, 3].filter(i => !d.abertas[i]);
        op = fechadas[Math.floor(p.rng() * fechadas.length)];
      }
      if (op >= 0 && op < 4 && !d.abertas[op]) {
        d.abertas[op] = true; d.palpites--; d.alvoX = CAIXA_X[op];
        if (op === d.tesouro) return void termina(p, true);
        if (d.palpites <= 0) return void termina(p, false);
        d.t = rapido(d) ? T_PALPITE_RAPIDO : T_PALPITE;
        p.eventos.push('queda');
        celularProcura(p, 'Vazia! Último palpite.');
      }
      d.aviso = prefixo(d) + (d.palpites === PALPITES
        ? `Jogador ${e + 1} dá a dica. Jogador ${r + 1}: 2 palpites! `
        : `Vazia! Último palpite, Jogador ${r + 1}! `) + Math.ceil(d.t);
      d.avisoCor = '#ffffff';
      return;
    }
    d.k += dt;
    const j = p.jogadores[r];
    if (j.vivo) j.x += (d.alvoX - j.x) * Math.min(1, dt * 8);
    if (d.t > 0) return;
    if (d.final) return d.placar[0] > d.placar[1] ? 0 : 1;
    novoRound(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.caixas = CAIXA_X.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, 0);
      const corpo = malha(new THREE.BoxGeometry(2.2, 1.8, 2.2), CORES[i]); corpo.position.y = 0.9;
      const fundo = malha(new THREE.BoxGeometry(1.9, 0.05, 1.9), 0x1a1a22); fundo.position.y = 1.81;   // "buraco" escuro visto de cima
      const tampa = new THREE.Group(); tampa.position.set(0, 1.8, -1.2);                                // gira pela aresta de tras
      const t1 = malha(new THREE.BoxGeometry(2.4, 0.35, 2.4), CORES[i], { emissive: CORES[i], emissiveIntensity: 0.25 }); t1.position.set(0, 0.18, 1.2);
      const puxador = malha(new THREE.SphereGeometry(0.28, 12, 8), 0xffffff); puxador.position.set(0, 0.5, 1.2);
      tampa.add(t1, puxador); g.add(corpo, fundo, tampa); grupo.add(g);
      return { g, tampa, aberta: false };
    });
    pecas.tesouro = malha(new THREE.IcosahedronGeometry(0.7, 0), 0xffe14d, { emissive: 0xffb300, emissiveIntensity: 1 });
    pecas.tesouro.visible = false;
    grupo.add(pecas.tesouro);
  },

  desenha(c, dt, t) {
    const d = c.p.dados, q = c.pecas, revela = d.fase === 'revela';
    q.caixas.forEach((cx, i) => {
      const aberta = !!d.abertas?.[i] || (revela && i === d.tesouro);   // no fim a caixa do tesouro abre de qualquer jeito
      if (aberta && !cx.aberta) {
        if (i === d.tesouro) { c.particulas(CAIXA_X[i], 2.4, 0, 0xffe14d, 70, 12); c.particulas(CAIXA_X[i], 2.4, 0, CORES[i], 30, 8); }
        else c.particulas(CAIXA_X[i], 2, 0, 0x9aa0b5, 22, 6);           // poeira: vazia
      }
      cx.aberta = aberta;
      const alvo = aberta ? -2.1 : 0;
      cx.tampa.rotation.x += (alvo - cx.tampa.rotation.x) * Math.min(1, dt * 12);
      // escondendo: todas balancam igual, para nao dar pista
      cx.g.position.y = d.fase === 'esconde' ? Math.abs(Math.sin(t * 6)) * 0.25 : 0;
      cx.g.rotation.z = d.fase === 'procura' && !aberta ? Math.sin(t * 3 + i) * 0.03 : 0;
    });
    q.tesouro.visible = revela;
    if (revela) {
      q.tesouro.position.set(CAIXA_X[d.tesouro] ?? 0, 1.2 + Math.min(1, d.k / 0.6) * 2 + Math.sin(t * 4) * 0.12, 0);
      q.tesouro.rotation.y = t * 3;
    }
  },
};
