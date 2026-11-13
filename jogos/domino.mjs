// Dominó: aperte A no ritmo da batida para pôr a próxima peça. Peça fora do ritmo sai torta e quebra a cascata ali.
// Ao fim de 20 s (ou quando você aperta B) a sua fileira é derrubada, uma peça por vez. Derrubou mais, ganhou.
const N = 26, OFF = 0.8, PER = 0.7, TOL = 0.12, TEMPO = 20;       // peças por fileira, primeira batida, intervalo, tolerância, tempo
const INT = 0.12, FINAL = 1, ESP = 0.68, X0 = -8.5, ZF = [-3, 3], X_BONECO = -10;
const SEGURA = 1;                                                  // segundos segurando B para derrubar a fileira
const S = 1.5;                                                     // tamanho das peças
const TOMBO = 1.25;                                                // inclinação final de uma peça caída (rad)

// Quantas peças caem se a fileira for derrubada agora: as retas antes da primeira torta.
const corteDe = fila => { const k = fila.findIndex(x => x.torta); return k < 0 ? fila.length : k; };

function vibra(p, i) { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; }

function derruba(d, i) {
  d.estado[i] = 'cai'; d.corte[i] = corteDe(d.fila[i]); d.tc[i] = 0; d.caiu[i] = 0;
}

// Um toque de A: confere se caiu perto de uma batida ainda não usada por este jogador.
function aperta(p, d, i) {
  const fila = d.fila[i], topo = fila[fila.length - 1];
  const k = Math.round((p.t - OFF) / PER);
  const noRitmo = k >= 0 && Math.abs(p.t - OFF - k * PER) <= TOL && k !== d.ult[i];
  if (noRitmo) {
    d.ult[i] = k;
    if (topo?.torta) { topo.torta = false; topo.t = p.t; d.fx.push({ tipo: 'conserta', i, k: fila.length - 1 }); }
    else if (fila.length < N) { fila.push({ torta: false, t: p.t }); d.fx.push({ tipo: 'poe', i, k: fila.length - 1 }); p.eventos.push('moeda'); }
  } else if (!topo?.torta && fila.length < N) {
    fila.push({ torta: true, t: p.t });
    d.fx.push({ tipo: 'torta', i, k: fila.length - 1 });
    p.eventos.push('queda'); vibra(p, i);
  }
}

export default {
  id: 'domino', nome: 'Dominó', dica: 'Aperte A no ritmo para pôr peças. Fora do ritmo, a peça entorta! Segure B para derrubar tudo.',
  controle: { modo: 'padrao', a: 'PEÇA', b: 'DERRUBA', joystick: false }, semMovimento: true, rotulo: 'peças', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 6.5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = X_BONECO; j.z = ZF[i]; });
    p.celular = [{ texto: 'A no ritmo da batida, segure B para derrubar' }, { texto: 'A no ritmo da batida, segure B para derrubar' }];
    p.dados = {
      placar: [0, 0], fila: [[], []], estado: ['monta', 'monta'], ult: [-1, -1], bat: -1,
      segB: [0, 0], caiu: [0, 0], corte: [0, 0], tc: [0, 0], qt: [[], []], fim: 0, fx: [],
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    const k = Math.floor((p.t - OFF) / PER);                       // marca a batida (som)
    if (k > d.bat) { d.bat = k; if (k >= 0) p.eventos.push('troca'); }

    p.jogadores.forEach((j, i) => {
      j.vx = j.vz = 0; j.x = X_BONECO; j.z = ZF[i];
      d.segB[i] = j.ent.b ? d.segB[i] + dt : 0;
      if (d.estado[i] !== 'monta') return;
      for (let n = 0; n < j.apertouA && d.estado[i] === 'monta'; n++) aperta(p, d, i);
      const fila = d.fila[i];
      if (d.segB[i] >= SEGURA || (fila.length >= N && !fila[N - 1].torta)) derruba(d, i);
    });

    for (const i of [0, 1]) {
      if (d.estado[i] === 'monta' && p.t >= TEMPO) derruba(d, i);
      if (d.estado[i] !== 'cai') continue;
      d.tc[i] += dt;
      while (d.caiu[i] < d.corte[i] && d.tc[i] >= (d.caiu[i] + 1) * INT) {
        d.qt[i][d.caiu[i]] = p.t; d.caiu[i]++;
        p.eventos.push('batida');
      }
      if (d.caiu[i] >= d.corte[i]) {
        d.estado[i] = 'fim';
        if (d.corte[i] < d.fila[i].length) {                       // travou na peça torta
          d.fx.push({ tipo: 'quebra', i, k: d.corte[i] });
          p.eventos.push('queda'); vibra(p, i);
        } else d.fx.push({ tipo: 'completa', i, k: d.corte[i] - 1 });
      }
      d.placar[i] = d.caiu[i];
    }
    for (const i of [0, 1]) if (d.estado[i] === 'monta') d.placar[i] = corteDe(d.fila[i]);

    if (d.estado.every(e => e === 'fim')) {
      d.fim += dt;
      if (d.fim >= FINAL) { const [a, b] = d.placar; return a === b ? -1 : a > b ? 0 : 1; }
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0; pecas.fantasmas = [];
    const chao = malha(new THREE.BoxGeometry(20, 0.04, 12.4), 0x1b2438, { roughness: 0.6 });
    chao.position.y = 0.02; chao.castShadow = false; grupo.add(chao);
    pecas.pulso = malha(new THREE.BoxGeometry(20, 0.03, 0.2), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.4 });
    pecas.pulso.position.y = 0.05; pecas.pulso.castShadow = false; grupo.add(pecas.pulso);
    for (const i of [0, 1]) {
      const trilho = malha(new THREE.BoxGeometry(N * ESP + 0.4, 0.03, 1.1), cores[i], { transparent: true, opacity: 0.25 });
      trilho.position.set(X0 + (N - 1) * ESP / 2, 0.05, ZF[i]); trilho.castShadow = false; grupo.add(trilho);
      const g = malha(new THREE.BoxGeometry(0.16 * S, 1.1 * S, 0.7 * S), cores[i], { transparent: true, opacity: 0.3 });   // onde vai a próxima
      g.castShadow = false; g.userData.vazio = true; grupo.add(g); pecas.fantasmas.push(g);
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { THREE, pecas } = c;
    const fase = ((p.t - OFF) / PER) % 1, batida = Math.max(0, 1 - Math.abs(fase < 0 ? fase + 1 : fase) * 6);
    pecas.pulso.material.emissiveIntensity = 0.3 + batida * 3;
    pecas.pulso.scale.z = 1 + batida * 2;

    for (const i of [0, 1]) {
      const fila = d.fila[i], z = ZF[i];
      const ms = c.pool('fila' + i, fila.length, () => {
        const g = new THREE.Group();
        const corpo = c.malha(new THREE.BoxGeometry(0.16 * S, 1.1 * S, 0.7 * S), c.cores[i], { roughness: 0.4 });
        const pinta = c.malha(new THREE.BoxGeometry(0.18 * S, 0.12 * S, 0.12 * S), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 });
        corpo.position.set(-0.08, 0.55 * S, 0); pinta.position.set(-0.08, 0.8 * S, 0);
        g.add(corpo, pinta); g.userData = { corpo };
        return g;
      });
      fila.forEach((pc, k) => {
        const m = ms[k], q = d.qt[i][k];
        const nasce = Math.min(1, (p.t - pc.t) / 0.12);
        const ang = q === undefined ? 0 : Math.min(1, ((p.t - q) / 0.22) ** 2) * TOMBO;
        m.position.set(X0 + k * ESP + 0.08, 0, z);
        m.scale.set(1, 0.2 + 0.8 * nasce, 1);
        m.rotation.set(0, pc.torta ? 0.7 : 0, -ang + (pc.torta ? 0.2 : 0));
        m.userData.corpo.material.color.set(pc.torta ? 0xff4a4a : c.cores[i]);
        if (d.estado[i] === 'fim' && pc.torta && k === d.corte[i]) m.position.y = Math.abs(Math.sin(t * 25)) * 0.05 * Math.max(0, 1 - (p.t - (d.qt[i][k - 1] ?? p.t)) * 2);
      });
      const gh = pecas.fantasmas[i];
      gh.visible = d.estado[i] === 'monta' && fila.length < N;
      gh.position.set(X0 + fila.length * ESP, 0.55 * S, z);
      gh.material.opacity = 0.15 + batida * 0.45;
    }

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto], x = X0 + e.k * ESP, z = ZF[e.i];
      if (e.tipo === 'poe') c.particulas(x, 0.2, z, c.cores[e.i], 4, 3);
      else if (e.tipo === 'conserta') c.particulas(x, 0.4, z, 0xffffff, 6, 4);
      else if (e.tipo === 'torta') c.particulas(x, 0.6, z, 0xff4a4a, 12, 6);
      else if (e.tipo === 'quebra') { c.particulas(x, 0.6, z, 0xff4a4a, 24, 9); c.particulas(x, 0.6, z, 0xffd23f, 12, 7); }
      else c.particulas(x, 0.8, z, 0xffd23f, 30, 10);
    }
  },
};
