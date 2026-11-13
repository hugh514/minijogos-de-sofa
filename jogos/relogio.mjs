// Relogio cego: o cronometro some aos 3 s. Cada um aperta uma vez tentando parar o mais perto de 10,00 s.
import { posiciona, RAIO } from '../logica.mjs';

const ALVO = 10, VISIVEL = 3, LIMITE = 15, T_REVELA = 3.5, FOLGA = 0.02, X = 5.5, Z = 2;
const fmt = (s, casas) => s.toFixed(casas).replace('.', ',');
const erro = s => Math.abs(s - ALVO);

function fala(p, i, texto, vibra = 0) {
  p.celular[i] = { texto, vibra: (p.celular[i].vibra ?? 0) + vibra };
}

function decide(d) {
  const [a, b] = d.parou.map(erro);
  return Math.abs(a - b) < FOLGA ? -1 : a < b ? 0 : 1;
}

export default {
  id: 'relogio', nome: 'Relógio cego', dica: 'O relógio some aos 3 segundos. Aperte UMA vez quando achar que deu 10!',
  semMovimento: true, controle: { modo: 'botao', a: 'PARA!' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    posiciona(p, X, 0);
    for (const j of p.jogadores) j.z = Z;
    p.dados = { parou: [null, null], revela: -1, aviso: '0,0', avisoCor: '#ffffff' };
    for (const i of [0, 1]) fala(p, i, 'Pare o mais perto de 10 segundos. Só vale um aperto!');
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      j.x = i ? X : -X; j.z = Z; j.vx = j.vz = 0;
      if (d.parou[i] !== null) return;
      if (j.apertouA) {
        d.parou[i] = Math.min(p.t, LIMITE);
        j.vy = 9; p.eventos.push('pulo');           // o boneco pula quando para
        fala(p, i, 'Parou! Espere a revelação', 1);
      } else if (p.t >= LIMITE) d.parou[i] = LIMITE;   // nao apertou: fica com 15,00
    });

    if (d.revela < 0) {
      d.aviso = p.t < VISIVEL ? fmt(p.t, 1) : '?,?'; d.avisoCor = '#ffffff';
      if (d.parou[0] === null || d.parou[1] === null) return;
      d.revela = p.t; p.eventos.push('troca');
      const v = decide(d);
      if (v >= 0) p.jogadores[v].vy = 9;            // quem chegou mais perto comemora
      for (const i of [0, 1])
        fala(p, i, `Você parou em ${fmt(d.parou[i], 2)} s (erro de ${fmt(erro(d.parou[i]), 2)} s)`, 1);
    }
    d.aviso = `${fmt(d.parou[0], 2)} s  x  ${fmt(d.parou[1], 2)} s`; d.avisoCor = '#ffd84d';
    if (p.t - d.revela >= T_REVELA) return decide(d);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    // mostrador inclinado de frente para a camera; uma volta do ponteiro = 10 s, o alvo e a marca dourada no alto
    const relogio = new THREE.Group();
    relogio.position.set(0, 3.1, -2.4); relogio.rotation.x = 0.9;
    pecas.disco = malha(new THREE.CylinderGeometry(2.8, 2.8, 0.3, 48), 0x1d2233, { emissive: 0x6a4cff, emissiveIntensity: 0 });
    const aro = malha(new THREE.TorusGeometry(2.8, 0.15, 10, 48), 0xdfe6f5); aro.rotation.x = Math.PI / 2; aro.position.y = 0.15;
    relogio.add(pecas.disco, aro);
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5, alvo = k === 0;
      const marca = alvo
        ? malha(new THREE.BoxGeometry(0.34, 0.12, 0.9), 0xffd84d, { emissive: 0xffb000, emissiveIntensity: 1 })
        : malha(new THREE.BoxGeometry(0.12, 0.08, 0.45), 0xffffff);
      marca.position.set(Math.sin(a) * 2.25, 0.19, -Math.cos(a) * 2.25); marca.rotation.y = -a;
      relogio.add(marca);
    }
    const ponteiro = (cor, y, largura) => {
      const g = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(largura, 0.1, 2.1), cor, { emissive: cor, emissiveIntensity: 0.7, transparent: true });
      haste.position.set(0, y, -1.05); g.add(haste); g.userData.haste = haste;
      relogio.add(g); return g;
    };
    pecas.ponteiro = ponteiro(0xff4a4a, 0.24, 0.2);
    pecas.parados = [0, 1].map(i => ponteiro(cores[i], 0.34 + i * 0.12, 0.26));
    const pino = malha(new THREE.SphereGeometry(0.3, 16, 12), 0xdfe6f5); pino.position.y = 0.3; relogio.add(pino);
    const pe = malha(new THREE.BoxGeometry(0.5, 2.2, 0.5), 0x59627f); pe.position.set(0, 1.1, -3.2);
    grupo.add(relogio, pe);
    pecas.visto = [false, false];
  },

  desenha(c, dt, t) {
    const { pecas, cores } = c, p = c.p, d = p.dados;
    const cego = d.revela < 0 && p.t >= VISIVEL;
    // ponteiro vermelho: gira ate os 3 s e some junto com os numeros
    const some = Math.max(0, Math.min(1, (VISIVEL - p.t) / 0.4));
    pecas.ponteiro.visible = d.revela < 0 && some > 0 && p.fase === 'jogando';
    pecas.ponteiro.userData.haste.material.opacity = some;
    pecas.ponteiro.rotation.y = -p.t / ALVO * Math.PI * 2;
    pecas.disco.material.emissiveIntensity = cego ? 0.35 + Math.sin(t * 4) * 0.25 : 0;   // mostrador pulsa enquanto esta cego

    // na revelacao, um ponteiro da cor de cada jogador corre ate onde ele parou
    const anda = d.revela < 0 ? 0 : p.fase === 'jogando' ? Math.min(1, (p.t - d.revela) / 0.8) : 1;
    pecas.parados.forEach((g, i) => {
      g.visible = d.revela >= 0;
      g.rotation.y = -(d.parou[i] ?? 0) / ALVO * Math.PI * 2 * anda;
    });

    p.jogadores.forEach((j, i) => {                 // faiscas quando para
      const parou = d.parou[i] !== null;
      if (parou && !pecas.visto[i]) c.particulas(j.x, RAIO, j.z, cores[i], 14, 6);
      pecas.visto[i] = parou;
    });
  },
};
