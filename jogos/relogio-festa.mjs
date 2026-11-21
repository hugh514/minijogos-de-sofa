// Relogio cego em grupo (Festa: todos contra todos ou times). Sao 3 rodadas, cada uma com um alvo (10, 7 e 12 s). O relogio corre a
// vista ate os 3 s e some; cada um aperta uma vez so quando achar que chegou no alvo. Ninguem ve quem ja parou. Na revelacao, cada um
// ganha 1 ponto por rival que ficou mais longe do alvo (com 4: 3, 2, 1, 0; em times o colega nao e rival); erro igual no centesimo que a tela mostra empata, e quem
// nao aperta fica em ultimo. Vence a maior soma das 3 rodadas (em times, a soma da dupla); somas iguais empatam.
// Sem "duracao": a contagem regressiva da TV seria um relogio a vista. A rodada fecha sozinha em no maximo 50 s (48 s no pior caso natural).
import { timeDe, quem, RAIO } from '../logica.mjs';

export const ALVOS = [10, 7, 12], VISIVEL = 3, CORTE = 2, LIMITE = 50;
const T_PREPARA = 1.5, T_REVELA = 2.8, T_CEDO = 1.5, PASSO_X = 4.4, Z = 3;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };
const fmt = (s, casas) => s.toFixed(casas).replace('.', ',');
const lugar = (p, i) => (i - (p.jogadores.length - 1) / 2) * PASSO_X;
const centesimos = s => Math.round(s * 100);                          // o tempo como a tela mostra: e por ele que se desempata

function telas(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const pontos = `Pontos: ${d.placar[de(i)]}`, parou = d.parou[i];
    const texto = fim ? fim[i]
      : d.fase === 'revela' ? (parou === null ? `Você não parou: +0. ${pontos}` : `Você parou em ${fmt(centesimos(parou) / 100, 2)} s (erro de ${fmt(Math.abs(centesimos(parou) - d.alvo * 100) / 100, 2)} s): +${d.ganho[i]}. ${pontos}`)
      : parou !== null ? 'Parou! Espere a revelação.'
      : d.cedo[i] > 0 && d.t < VISIVEL ? 'Ainda não vale: espere o relógio sumir.'
      : `Rodada ${d.rodada + 1} de ${ALVOS.length}: pare em ${d.alvo} s. ${pontos}`;
    const modo = !fim && d.fase !== 'revela' && parou === null ? 'botao' : 'espera';
    p.celular[i] = { modo, a: 'Para!', texto, vibra: d.vibra[i] };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

function novaRodada(p) {
  const d = p.dados, n = p.jogadores.length;
  d.alvo = ALVOS[d.rodada]; d.fase = 'prepara'; d.t = 0; d.tFase = T_PREPARA;
  d.parou = Array(n).fill(null); d.ganho = Array(n).fill(0); d.melhores = [];
  d.aviso = `Pare em ${d.alvo} segundos`; d.avisoCor = '#ffd84d'; d.visor = '0,0';
}

// Fecha a contagem: 1 ponto por rival que ficou mais longe do alvo; quem nao parou nao pontua.
function revela(p) {
  const d = p.dados, de = dono(p);
  const erro = d.parou.map(s => (s === null ? Infinity : Math.abs(centesimos(s) - d.alvo * 100)));
  const melhor = Math.min(...erro);
  const rival = (i, k) => p.modo !== 'times' || timeDe(p, i) !== timeDe(p, k);       // em times o colega nao conta
  d.ganho = erro.map((e, i) => (e === Infinity ? 0 : erro.filter((o, k) => o > e && rival(i, k)).length));
  d.ganho.forEach((g, i) => { d.placar[de(i)] += g; });
  d.melhores = melhor === Infinity ? [] : erro.flatMap((e, i) => (e === melhor ? [i] : []));
  d.fase = 'revela'; d.tFase = T_REVELA; d.avisoCor = '#ffd84d';
  d.aviso = !d.melhores.length ? 'Ninguém parou!' : d.melhores.length > 1 ? 'Empate na rodada!'
    : `${quem(p, d.melhores[0])} chegou mais perto: ${fmt(centesimos(d.parou[d.melhores[0]]) / 100, 2)} s`;
  d.inventario = d.parou.map(s => [s === null ? 'Não parou' : `Parou em ${fmt(centesimos(s) / 100, 2)} s`]);
  p.eventos.push('troca');
  if (d.melhores.length === 1) p.eventos.push('ponto');
  for (const i of d.melhores) { d.vibra[i]++; if (p.jogadores[i].y === 0) p.jogadores[i].vy = 9; }      // quem chegou mais perto comemora
}

export default {
  id: 'relogio-festa', genero: 'ritmo', nome: 'Relógio cego em grupo',
  dica: 'O relógio some aos 3 segundos. Aperte uma vez só quando achar que chegou no alvo.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'botao', a: 'Para!' }, rotulo: 'pontos',
  tema: 2,              // noite: o mostrador claro e os ponteiros nas cores dos jogadores aparecem bem

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lugar(p, i); j.z = Z; });
    p.dados = { placar: Array(p.modo === 'times' ? 2 : n).fill(0), rodada: 0, vibra: Array(n).fill(0), cedo: Array(n).fill(0), inventario: [] };
    novaRodada(p);
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => { j.x = lugar(p, i); j.z = Z; j.vx = j.vz = 0; });
    d.cedo = d.cedo.map(c => Math.max(0, c - dt));
    if (p.t >= LIMITE) return fechaComo(p, lider(d.placar));
    if (d.fase === 'conta') {
      d.t += dt;
      p.jogadores.forEach((j, i) => {
        if (!j.apertouA || d.parou[i] !== null) return;
        if (d.t < VISIVEL) { d.cedo[i] = T_CEDO; return; }       // com o relogio a vista o aperto nao vale (toque sem querer)
        d.parou[i] = d.t; d.vibra[i]++;                          // so o celular de quem parou avisa: a TV nao entrega a hora
      });
      d.visor = d.t < VISIVEL ? fmt(Math.floor(d.t * 10 + 1e-6) / 10, 1) : '?,?';       // o aviso grande fica parado: trocar o texto a cada decimo pisca na TV
      if (d.parou.every(s => s !== null) || d.t >= d.alvo + CORTE) revela(p);
    } else {
      d.tFase -= dt;
      if (d.tFase <= 0 && d.fase === 'prepara') d.fase = 'conta';
      else if (d.tFase <= 0) {
        if (++d.rodada >= ALVOS.length) { d.rodada = ALVOS.length - 1; return fechaComo(p, lider(d.placar)); }
        d.inventario = []; novaRodada(p);
      }
    }
    telas(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    // mostrador inclinado de frente para a camera; uma volta do ponteiro = o alvo da rodada, que e a marca grande no alto
    const relogio = new THREE.Group();
    relogio.position.set(0, 3.1, -2.6); relogio.rotation.x = 0.9;
    pecas.disco = malha(new THREE.CylinderGeometry(3.3, 3.3, 0.3, 48), 0xe9e4d4, { emissive: 0x8a7a4a, emissiveIntensity: 0 });
    const aro = malha(new THREE.TorusGeometry(3.3, 0.22, 10, 48), 0x5b3a1c); aro.rotation.x = Math.PI / 2; aro.position.y = 0.15;
    relogio.add(pecas.disco, aro);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, alvo = k === 0;
      const marca = alvo
        ? malha(new THREE.BoxGeometry(0.5, 0.14, 1.1), 0xd81e1e, { emissive: 0xff2a2a, emissiveIntensity: 0.9 })
        : malha(new THREE.BoxGeometry(0.14, 0.08, 0.5), 0x2a2420);
      marca.position.set(Math.sin(a) * 2.6, 0.19, -Math.cos(a) * 2.6); marca.rotation.y = -a;
      relogio.add(marca);
    }
    const ponteiro = (cor, y, largura) => {
      const g = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(largura, 0.1, 2.5), cor, { emissive: cor, emissiveIntensity: 0.6, transparent: true });
      haste.position.set(0, y, -1.25); g.add(haste); g.userData.haste = haste;
      relogio.add(g); return g;
    };
    pecas.ponteiro = ponteiro(0x2a2420, 0.24, 0.2);
    pecas.parados = p.jogadores.map((_, i) => ponteiro(corDe(i), 0.34 + i * 0.1, 0.3));
    const pino = malha(new THREE.SphereGeometry(0.34, 16, 12), 0x5b3a1c); pino.position.y = 0.3; relogio.add(pino);
    const pe = malha(new THREE.BoxGeometry(0.6, 2.4, 0.6), 0x5b3a1c); pe.position.set(0, 1.2, -3.6);
    grupo.add(relogio, pe);

    // de cada jogador: um tapete na cor dele (do time, em times) e, na revelacao, uma placa com o tempo em que parou
    pecas.placas = p.jogadores.map((j, i) => {
      const tapete = malha(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 28), corDe(i)); tapete.position.set(j.x, 0.04, j.z); grupo.add(tapete);
      if (typeof document === 'undefined') return null;       // o node de teste nao tem canvas
      const tela = document.createElement('canvas'); tela.width = 512; tela.height = 256;
      const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace;
      const placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, toneMapped: false }));
      placa.scale.set(3.9, 1.95, 1); placa.position.set(j.x, 0.95, j.z + 2.2); placa.visible = false; placa.renderOrder = 5;
      grupo.add(placa); return { tela, tex, placa, texto: '' };
    });
    // dois letreiros ao lado do mostrador: o visor que conta (e some aos 3 s) e o alvo da rodada
    pecas.letreiros = typeof document === 'undefined' ? [] : [-6.1, 6.1].map(x => {
      const tela = document.createElement('canvas'); tela.width = 512; tela.height = 256;
      const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace;
      const placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, toneMapped: false }));
      placa.scale.set(4.6, 2.3, 1); placa.position.set(x, 2.3, -2.6); placa.renderOrder = 5;
      grupo.add(placa); return { tela, tex, placa, texto: '' };
    });
    pecas.fase = ''; pecas.tRevela = 0;
  },

  desenha(c, dt, t) {
    const { pecas } = c, p = c.p, d = p.dados, revela = d.fase === 'revela';
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    const cego = d.fase === 'conta' && d.t >= VISIVEL, volta = s => -s / d.alvo * Math.PI * 2;
    if (pecas.fase !== d.fase) {
      pecas.fase = d.fase; pecas.tRevela = 0;
      if (d.fase === 'conta') c.som(660, 0.12, 'triangle', 0.15);
      if (revela) {
        c.som(523, 0.15, 'triangle', 0.15); c.som(784, 0.3, 'triangle', 0.15);
        for (const i of d.melhores) c.particulas(p.jogadores[i].x, RAIO + 1, p.jogadores[i].z, corDe(i), 30, 9);
      }
    }
    // ponteiro escuro: gira ate os 3 s e some junto com os numeros
    const some = Math.max(0, Math.min(1, (VISIVEL - d.t) / 0.4));
    pecas.ponteiro.visible = d.fase !== 'revela' && some > 0;
    pecas.ponteiro.userData.haste.material.opacity = some;
    pecas.ponteiro.rotation.y = volta(d.t);
    pecas.disco.material.emissiveIntensity = cego ? 0.3 + Math.sin(t * 4) * 0.2 : 0;       // o mostrador pulsa enquanto esta cego

    [['relógio', revela ? '' : d.visor, '#ffffff'], ['alvo', d.alvo + ' s', '#ffd84d']].forEach(([titulo, valor, cor], k) => {
      const f = pecas.letreiros[k];
      if (!f || f.texto === valor) return;
      f.texto = valor; f.placa.visible = !!valor;
      const x = f.tela.getContext('2d');
      x.clearRect(0, 0, 512, 256);
      x.fillStyle = '#0a0d1ee6'; x.beginPath(); x.roundRect(6, 6, 500, 244, 36); x.fill();
      x.lineWidth = 8; x.strokeStyle = '#ffffff55'; x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#c9d2ea'; x.font = '700 50px "Segoe UI", Arial, sans-serif'; x.fillText(titulo, 256, 52);
      x.fillStyle = cor; x.font = '900 140px "Segoe UI Black", "Arial Black", Impact, sans-serif'; x.fillText(valor, 256, 160);
      f.tex.needsUpdate = true;
    });

    // na revelacao, um ponteiro da cor de cada jogador corre ate onde ele parou, e a placa mostra o tempo e os pontos da rodada
    if (revela) pecas.tRevela = Math.min(1, pecas.tRevela + dt / 0.7);
    pecas.parados.forEach((g, i) => {
      g.visible = revela && d.parou[i] !== null;
      g.rotation.y = volta(d.parou[i] ?? 0) * pecas.tRevela;
    });
    pecas.placas.forEach((f, i) => {
      if (!f) return;
      const s = d.parou[i], txt = !revela ? '' : (s === null ? 'Não parou' : fmt(centesimos(s) / 100, 2) + ' s') + '|+' + d.ganho[i];
      if (f.texto === txt) return;
      f.texto = txt; f.placa.visible = !!txt;
      if (!txt) return;
      const x = f.tela.getContext('2d'), [tempo, ganho] = txt.split('|');
      x.clearRect(0, 0, 512, 256);
      x.fillStyle = '#0a0d1ee6'; x.beginPath(); x.roundRect(6, 6, 500, 244, 36); x.fill();
      x.lineWidth = 10; x.strokeStyle = '#' + corDe(i).toString(16).padStart(6, '0'); x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff';
      x.font = `900 ${s === null ? 74 : 96}px "Segoe UI Black", "Arial Black", Impact, sans-serif`; x.fillText(tempo, 256, 92);
      x.fillStyle = d.melhores.includes(i) ? '#ffd84d' : '#c9d2ea';
      x.font = '900 76px "Segoe UI Black", "Arial Black", Impact, sans-serif'; x.fillText(ganho, 256, 190);
      f.tex.needsUpdate = true;
    });
  },
};
