// Sequencia venenosa: turnos alternados. Na vez, repita a sequencia inteira de cores e acrescente uma no fim.
// A tela nunca mostra a sequencia de novo: so pisca o que o jogador da vez toca.
// Limite de tempo: empate. A vez no instante do limite depende so da paridade dos turnos, entao
// dar a vitoria a um dos lados seria sorteio; quem chegou ate ali sem errar empatou de verdade.
import { posiciona, elimina } from '../logica.mjs';

const CORES = ['Vermelho', 'Azul', 'Verde', 'Amarelo'];
const HEX = [0xe5383b, 0x2f7df6, 0x35c26b, 0xffd23f];
const NOTAS = [262, 330, 392, 523];
const POS = [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]];   // grade 2x2 igual ao celular (1 2 / 3 4)
const PRAZO = 4, LIMITE = 55, LADO = 6.5, MAX_PINOS = 22;

function telas(p) {
  const d = p.dados, n = d.seq.length;
  const texto = d.pos < n ? `Sua vez! Repita a sequência: cor ${d.pos + 1} de ${n}`
    : n ? 'Agora acrescente uma cor NOVA' : 'Você começa: escolha a primeira cor';
  p.celular[d.vez] = { modo: 'opcoes', texto, opcoes: CORES, vibra: d.vibra[d.vez] };
  p.celular[1 - d.vez] = { modo: 'espera', texto: 'Vez do outro. Olhe a tela e decore as cores!', vibra: d.vibra[1 - d.vez] };
}

function perde(p, cor, aviso) {
  const d = p.dados;
  d.fx.push({ cor, ok: false, quem: d.vez });
  d.aviso = aviso; d.avisoCor = '#ff4a4a';
  p.eventos.push('explosao');
  elimina(p, p.jogadores[d.vez]);
  d.vibra[d.vez]++;
  p.celular[d.vez] = { modo: 'espera', texto: aviso, vibra: d.vibra[d.vez] };
  p.celular[1 - d.vez] = { modo: 'espera', texto: 'O outro errou. Ponto seu!', vibra: d.vibra[1 - d.vez] };
  return 1 - d.vez;
}

export default {
  id: 'sequencia', nome: 'Sequência venenosa',
  dica: 'Na sua vez, repita todas as cores e acrescente uma. Segundo erro, ou 4 s sem tocar, perde!',
  semMovimento: true, controle: { modo: 'espera' }, duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 6, parede: true };
    posiciona(p, LADO);
    // fx: toques para a tela piscar e tocar som (a tela guarda ate onde ja viu)
    p.dados = { seq: [], vez: p.rng() < 0.5 ? 0 : 1, pos: 0, prazo: PRAZO, fx: [], vibra: [0, 0], aviso: '', vida: [1, 1], tAviso: 0 };
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados, e = p.jogadores[d.vez].escolha;
    d.prazo -= dt; d.tAviso -= dt;
    if (d.tAviso <= 0 && d.aviso && d.avisoCor === '#ffd84d') d.aviso = '';
    if (e >= 0 && e < 4) {
      const nova = d.pos >= d.seq.length;
      if (!nova && e !== d.seq[d.pos]) {
        if (!d.vida[d.vez]) return perde(p, e, 'ERROU A COR!');
        d.vida[d.vez] = 0;                          // cada um tem uma vida extra: o primeiro erro só avisa
        d.fx.push({ cor: -1, ok: false, quem: d.vez }); d.prazo = PRAZO; d.aviso = 'ERROU! Última chance'; d.avisoCor = '#ffd84d'; d.tAviso = 1.5;
        p.eventos.push('queda'); telas(p);
        return;
      }
      d.fx.push({ cor: e, ok: true });
      d.prazo = PRAZO;
      if (nova) { d.seq.push(e); d.vez = 1 - d.vez; d.pos = 0; d.vibra[d.vez]++; p.eventos.push('troca'); }
      else d.pos++;
      telas(p);
    } else if (d.prazo <= 0) return perde(p, -1, 'DEMOROU!');
    if (p.t > LIMITE) return -1;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const base = malha(new THREE.BoxGeometry(7.4, 0.2, 7.4), 0x23233a); base.position.y = 0.1; grupo.add(base);
    pecas.blocos = HEX.map((cor, i) => {
      const m = malha(new THREE.BoxGeometry(3, 1, 3), cor, { emissive: cor, emissiveIntensity: 0.15 });
      m.position.set(POS[i][0], 0.7, POS[i][1]); grupo.add(m); return m;
    });
    pecas.brilho = [0, 0, 0, 0]; pecas.visto = 0;
    // disco e seta marcam de quem e a vez
    pecas.disco = malha(new THREE.CylinderGeometry(1.5, 1.5, 0.08, 28), cores[0], { emissive: cores[0], emissiveIntensity: 0.6 });
    pecas.seta = malha(new THREE.ConeGeometry(0.5, 1, 14), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
    pecas.seta.rotation.x = Math.PI;
    // barra do prazo de 4 s, na frente
    pecas.barra = malha(new THREE.BoxGeometry(8, 0.3, 0.5), 0x35c26b, { emissive: 0x35c26b, emissiveIntensity: 0.6 });
    pecas.barra.position.set(0, 0.15, 5.2);
    grupo.add(pecas.disco, pecas.seta, pecas.barra);
  },

  desenha(c, dt, t) {
    const d = c.p.dados, pc = c.pecas, THREE = c.THREE;
    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto];
      if (f.cor >= 0) {
        pc.brilho[f.cor] = 1;
        c.som(NOTAS[f.cor], 0.3, 'sine', 0.25);
        c.particulas(POS[f.cor][0], 1.4, POS[f.cor][1], HEX[f.cor], 14, 5);
      }
      if (!f.ok) {
        const j = c.p.jogadores[f.quem];
        c.som(110, 0.6, 'sawtooth', 0.25);
        c.particulas(j.x, 1.2, j.z, 0xff2a2a, 40, 10);
      }
    }
    pc.blocos.forEach((m, i) => {
      pc.brilho[i] = Math.max(0, pc.brilho[i] - dt * 2.5);
      m.material.emissiveIntensity = 0.15 + pc.brilho[i] * 1.6;
      m.scale.y = 1 - pc.brilho[i] * 0.45;            // afunda como botao apertado
      m.position.y = 0.2 + 0.5 * m.scale.y;
    });
    const x = d.vez ? LADO : -LADO, cor = c.cores[d.vez];
    pc.disco.position.set(x, 0.05, 0); pc.disco.material.color.set(cor); pc.disco.material.emissive.set(cor);
    pc.seta.position.set(x, 3.4 + Math.sin(t * 6) * 0.25, 0);
    const f = Math.max(0, Math.min(1, d.prazo / PRAZO)), corBarra = f > 0.5 ? 0x35c26b : f > 0.25 ? 0xffd23f : 0xff2a2a;
    pc.barra.scale.x = Math.max(0.001, f); pc.barra.material.color.set(corBarra); pc.barra.material.emissive.set(corBarra);
    // pinos no fundo: um por cor da sequencia (sem revelar a cor), acendem conforme o jogador avanca; o dourado e a cor nova
    const n = Math.min(d.seq.length, MAX_PINOS) + 1;
    const pinos = c.pool('pino', n, () => c.malha(new THREE.SphereGeometry(0.28, 12, 8), 0x555566, { emissive: 0x000000 }));
    for (let i = 0; i < n; i++) {
      const m = pinos[i], novo = i === n - 1, feito = i < d.pos;
      m.position.set((i - (n - 1) / 2) * 0.75, 0.5, -5.2);
      m.material.color.set(novo ? 0xffc93c : feito ? 0xffffff : 0x555566);
      m.material.emissive.set(novo ? 0xffc93c : feito ? 0xffffff : 0x000000);
      m.scale.setScalar(novo ? 1 + Math.sin(t * 8) * 0.2 : 1);
    }
  },
};
