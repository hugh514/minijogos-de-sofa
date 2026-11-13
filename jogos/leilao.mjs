// Leilao cego: 10 fichas, 3 premios. Lances secretos e simultaneos: o maior leva e paga; no empate ninguem leva e os dois pagam metade.
import { elimina } from '../logica.mjs';

const FICHAS = 10, T_LANCE = 7, T_SUSPENSE = 0.8, T_VOA = 0.9, T_VOLTA = 1.5, T_REVELA = 3, T_FIM = 2.4;
const PREMIOS = ['a taça', 'a joia', 'a coroa'];
const X = 5.3, Z = 1.8, PILHA_X = 3.4, PILHA_Z = 2.5, MONTE_X = 1.5, MONTE_Z = 1.7, ALT = 0.14;

const fichas = n => (n === 1 ? '1 ficha' : `${n} fichas`);

// Ate 4 lances possiveis com o que o jogador tem: 0, 1, metade e tudo (completa com vizinhos se repetir).
export function lances(tem) {
  const v = new Set([0, 1, Math.floor(tem / 2), tem].filter(n => n <= tem));
  for (let n = 2; v.size < 4 && n < tem; n++) v.add(n);
  return [...v].sort((a, b) => a - b);
}

// Quem leva (0, 1 ou -1) e quanto cada um paga.
export function resolve(a, b) {
  if (a === b) return { dono: -1, pago: [Math.floor(a / 2), Math.floor(b / 2)] };
  return a > b ? { dono: 0, pago: [a, 0] } : { dono: 1, pago: [0, b] };
}

export function decide(d) {
  const [a, b] = d.placar, [fa, fb] = d.fichas;
  return a !== b ? (a > b ? 0 : 1) : fa !== fb ? (fa > fb ? 0 : 1) : -1;
}

function novoLeilao(p) {
  const d = p.dados;
  d.round++;
  d.fase = 'lance'; d.t = T_LANCE; d.k = 0; d.mostrou = false;
  d.lance = [-1, -1]; d.ops = d.fichas.map(lances); d.antes = [...d.fichas]; d.pago = [0, 0]; d.dono = -1;
  d.novo = true;                                  // os celulares so mudam com a rodada valendo (toque na intro se perderia)
}

function celulares(p) {
  const d = p.dados;
  d.novo = false;
  for (const i of [0, 1])
    p.celular[i] = {
      modo: 'opcoes', vibra: d.round,
      opcoes: d.ops[i].map(n => fichas(n) + (n === d.fichas[i] && n > 0 ? ' (tudo)' : '')),
      texto: `Você tem ${fichas(d.fichas[i])}. Lance secreto por ${PREMIOS[d.round]} (prêmio ${d.round + 1} de 3):`,
    };
}

export default {
  id: 'leilao', nome: 'Leilão cego', dica: 'Lance secreto com suas 10 fichas: o maior leva o prêmio e paga. Empatou, ninguém leva!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'prêmios', controle: { modo: 'espera' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    p.dados = { placar: [0, 0], fichas: [FICHAS, FICHAS], premios: [null, null, null], round: -1, aviso: '', avisoCor: '#ffffff' };
    novoLeilao(p);
    for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: `Você tem ${fichas(FICHAS)}. Prepare-se: olhe para a tela!` };
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => { if (j.vivo) { j.x = i ? X : -X; j.z = Z; j.vx = j.vz = 0; } });
    if (d.novo) celulares(p);
    d.t -= dt; d.k += dt;

    if (d.fase === 'lance') {
      for (const i of [0, 1]) {
        const op = p.jogadores[i].escolha;
        if (d.lance[i] < 0 && op >= 0 && op < d.ops[i].length) {
          d.lance[i] = d.ops[i][op]; p.eventos.push('troca');
          p.celular[i] = { modo: 'espera', texto: `Lance de ${fichas(d.lance[i])} feito. Disfarce! Você tem ${fichas(d.fichas[i])}.` };
        }
        if (d.lance[i] < 0 && d.t <= 0) d.lance[i] = 0;         // nao escolheu: lance zero
      }
      d.aviso = `Leilão ${d.round + 1} de 3: ${PREMIOS[d.round]}! Façam seus lances... ${Math.max(0, Math.ceil(d.t))}`;
      d.avisoCor = '#ffffff';
      if (d.lance[0] < 0 || d.lance[1] < 0) return;
      Object.assign(d, resolve(d.lance[0], d.lance[1]));
      d.fase = 'suspense'; d.k = 0; d.aviso = 'Lances fechados...';
      for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Olhe para a tela!' };
      return;
    }
    if (d.fase === 'suspense') {
      if (d.k < T_SUSPENSE) return;
      d.fase = 'revela'; d.k = 0; p.eventos.push('dash');
      d.aviso = `${fichas(d.lance[0])}  x  ${fichas(d.lance[1])}`; d.avisoCor = '#ffffff';
      return;
    }
    if (d.fase === 'revela') {
      if (!d.mostrou && d.k >= T_VOA) {             // as fichas chegaram ao centro: paga e entrega
        d.mostrou = true;
        for (const i of [0, 1]) d.fichas[i] -= d.pago[i];
        d.premios[d.round] = d.dono;
        if (d.dono >= 0) {
          d.placar[d.dono]++; p.jogadores[d.dono].vy = 8; p.eventos.push('gol');
          d.aviso = `${d.lance[0]} x ${d.lance[1]}: Jogador ${d.dono + 1} leva ${PREMIOS[d.round]}!`; d.avisoCor = '#ffd84d';
        } else {
          p.eventos.push('explosao');
          d.aviso = `EMPATE em ${d.lance[0]}! Ninguém leva` + (d.pago[0] ? ` e cada um paga ${d.pago[0]}` : ''); d.avisoCor = '#ff4a4a';
        }
        for (const i of [0, 1])
          p.celular[i] = { modo: 'espera', texto: `Você tem ${fichas(d.fichas[i])} e ${d.placar[i]} ${d.placar[i] === 1 ? 'prêmio' : 'prêmios'}.` };
      }
      if (d.k < T_REVELA) return;
      const faltam = PREMIOS.length - 1 - d.round;
      if (faltam > 0 && Math.abs(d.placar[0] - d.placar[1]) <= faltam) return void novoLeilao(p);
      d.fase = 'fim'; d.k = 0; d.vencedor = decide(d);
      const v = d.vencedor, porFichas = v >= 0 && d.placar[0] === d.placar[1];
      d.aviso = v < 0 ? 'EMPATE TOTAL!' : porFichas ? `Empate em prêmios: Jogador ${v + 1} vence com mais fichas!` : `Jogador ${v + 1} arrematou mais prêmios!`;
      d.avisoCor = '#ffd84d';
      if (v >= 0) {                                 // quem perdeu o leilao sai voando
        const j = p.jogadores[1 - v];
        j.vx = Math.sign(j.x || 1) * 5; elimina(p, j, 14); p.eventos.push('queda');
        p.jogadores[v].vy = 9;
      }
      return;
    }
    if (d.k >= T_FIM) return d.vencedor;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const brilho = (cor, forca = 0.6) => ({ emissive: cor, emissiveIntensity: forca });
    const OURO = 0xffc531;

    // tapete vermelho e pedestal no centro
    const tapete = malha(new THREE.BoxGeometry(3.2, 0.04, 9.4), 0xa3122a); tapete.position.set(0, 0.02, 0);
    const base = malha(new THREE.CylinderGeometry(1.0, 1.3, 1.2, 24), 0x3a3f5c); base.position.set(0, 0.6, 0);
    const tampo = malha(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 24), 0xf2f2f7); tampo.position.set(0, 1.27, 0);
    pecas.aro = malha(new THREE.TorusGeometry(1.45, 0.1, 8, 36), OURO, brilho(OURO, 0.8));
    pecas.aro.rotation.x = Math.PI / 2; pecas.aro.position.set(0, 0.08, 0);
    grupo.add(tapete, base, tampo, pecas.aro);

    // os tres premios
    const taca = () => {
      const g = new THREE.Group(), m = { metalness: 0.7, roughness: 0.25, ...brilho(0x7a5200, 0.5) };
      const pe = malha(new THREE.CylinderGeometry(0.34, 0.44, 0.12, 18), OURO, m); pe.position.y = 0.06;
      const haste = malha(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10), OURO, m); haste.position.y = 0.36;
      const copo = malha(new THREE.CylinderGeometry(0.58, 0.2, 0.75, 20), OURO, m); copo.position.y = 0.95;
      g.add(pe, haste, copo);
      for (const lado of [-1, 1]) {
        const alca = malha(new THREE.TorusGeometry(0.24, 0.06, 8, 16), OURO, m); alca.position.set(lado * 0.55, 1.0, 0); g.add(alca);
      }
      return g;
    };
    const joia = () => {
      const g = new THREE.Group();
      const pedra = malha(new THREE.OctahedronGeometry(0.62, 0), 0x35e0ff, { ...brilho(0x1aa7ff, 1), metalness: 0.3, roughness: 0.1 });
      pedra.scale.y = 1.35; pedra.position.y = 0.9;
      const anel = malha(new THREE.TorusGeometry(0.5, 0.06, 8, 24), 0xf2f2f7, brilho(0xffffff, 0.4)); anel.rotation.x = Math.PI / 2; anel.position.y = 0.9;
      g.add(pedra, anel); return g;
    };
    const coroa = () => {
      const g = new THREE.Group(), m = { metalness: 0.7, roughness: 0.25, ...brilho(0x7a5200, 0.5) };
      const aro = malha(new THREE.CylinderGeometry(0.6, 0.52, 0.42, 20), OURO, m); aro.position.y = 0.5;
      const forro = malha(new THREE.SphereGeometry(0.5, 16, 10), 0xc2185b); forro.scale.y = 0.6; forro.position.y = 0.75;
      g.add(aro, forro);
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, x = Math.cos(a) * 0.52, z = Math.sin(a) * 0.52;
        const ponta = malha(new THREE.ConeGeometry(0.14, 0.45, 8), OURO, m); ponta.position.set(x, 0.93, z);
        const rubi = malha(new THREE.SphereGeometry(0.09, 8, 6), 0xff2a4a, brilho(0xff2a4a, 1)); rubi.position.set(x, 1.2, z);
        g.add(ponta, rubi);
      }
      return g;
    };
    pecas.premios = [taca(), joia(), coroa()].map((g, k) => {
      g.position.set((k - 1) * 1.9, 0.9, -3.9); g.scale.setScalar(0.55); grupo.add(g);
      const apoio = malha(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 14), 0x4a4f6e); apoio.position.set((k - 1) * 1.9, 0.45, -3.9); grupo.add(apoio);
      return g;
    });

    // de cada jogador: vitrine dos premios ganhos, base da pilha de fichas, anel de "ja dei o lance"
    pecas.fichas = [[], []]; pecas.anel = [];
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1;
      const vitrine = malha(new THREE.BoxGeometry(3.8, 1.0, 1.2), 0x2b2e42); vitrine.position.set(lado * 6.3, 0.5, -1.9);
      const faixa = malha(new THREE.BoxGeometry(3.8, 0.12, 1.25), cores[i], brilho(cores[i], 0.7)); faixa.position.set(lado * 6.3, 1.02, -1.9);
      const prato = malha(new THREE.CylinderGeometry(0.62, 0.7, 0.1, 20), 0x23273a); prato.position.set(lado * PILHA_X, 0.05, PILHA_Z);
      const anel = malha(new THREE.TorusGeometry(1.2, 0.1, 8, 30), cores[i], brilho(cores[i], 0.3));
      anel.rotation.x = Math.PI / 2; anel.position.set(lado * X, 0.06, Z);
      grupo.add(vitrine, faixa, prato, anel); pecas.anel.push(anel);
      for (let k = 0; k < FICHAS; k++) {
        const f = malha(new THREE.CylinderGeometry(0.45, 0.45, ALT - 0.02, 18), k % 2 ? 0xffffff : cores[i], brilho(cores[i], k % 2 ? 0.35 : 0.2));
        grupo.add(f); pecas.fichas[i].push(f);
      }
    }

    // holofotes e postes de cordao
    pecas.holofotes = [];
    for (const lado of [-1, 1]) {
      const poste = malha(new THREE.CylinderGeometry(0.1, 0.16, 3.4, 8), 0x59627f); poste.position.set(lado * 2.9, 1.7, -2.6);
      const luz = malha(new THREE.SphereGeometry(0.42, 16, 12), 0xfff3c4, brilho(0xffe9a0, 1)); luz.position.set(lado * 2.9, 3.5, -2.6);
      grupo.add(poste, luz); pecas.holofotes.push(luz);
      for (const z of [-1.2, 3.6]) {
        const p1 = malha(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 8), OURO, { metalness: 0.6, roughness: 0.3 }); p1.position.set(lado * 1.9, 0.55, z);
        const bola = malha(new THREE.SphereGeometry(0.16, 10, 8), OURO, brilho(OURO, 0.5)); bola.position.set(lado * 1.9, 1.15, z);
        grupo.add(p1, bola);
      }
    }
    pecas.chave = '';
  },

  desenha(c, dt, t) {
    const { pecas: q, cores } = c, d = c.p.dados;
    const mix = (a, b, u) => a + (b - a) * u, lim = u => Math.max(0, Math.min(1, u));
    const revela = d.fase === 'revela', suspense = d.fase === 'suspense';

    // fichas: pilha ao lado do boneco; no lance voam ao centro, as pagas somem no pedestal e as outras voltam
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1, px = lado * PILHA_X, mx = lado * MONTE_X;
      const antes = revela ? d.antes[i] : d.fichas[i], lance = revela ? d.lance[i] : 0, fica = antes - lance;
      q.fichas[i].forEach((f, k) => {
        f.visible = k < antes;
        if (!f.visible) return;
        f.scale.setScalar(1);
        const treme = suspense ? Math.sin(t * 45 + k * 1.7) * 0.03 : 0;
        if (k < fica) return void f.position.set(px + treme, ALT / 2 + 0.1 + k * ALT, PILHA_Z);
        const b = k - fica, ida = lim((d.k - b * 0.04) / 0.55), volta = lim((d.k - T_VOLTA - b * 0.03) / 0.5);
        const my = ALT / 2 + b * ALT;
        let x = mix(px, mx, ida), y = mix(ALT / 2 + 0.1 + k * ALT, my, ida) + Math.sin(ida * Math.PI) * 1.6, z = mix(PILHA_Z, MONTE_Z, ida);
        if (volta > 0 && b < d.pago[i]) {           // paga: some dentro do pedestal
          x = mix(mx, 0, volta); y = mix(my, 1.0, volta) + Math.sin(volta * Math.PI) * 0.8; z = mix(MONTE_Z, 0, volta);
          f.scale.setScalar(Math.max(0.01, 1 - volta));
        } else if (volta > 0) {                     // nao pagou: volta para a pilha
          const kk = fica + b - d.pago[i];
          x = mix(mx, px, volta); y = mix(my, ALT / 2 + 0.1 + kk * ALT, volta) + Math.sin(volta * Math.PI) * 1.2; z = mix(MONTE_Z, PILHA_Z, volta);
        }
        f.position.set(x, y, z);
      });
      // anel: apagado pensando, branco pulsando com o lance feito
      const feito = d.fase === 'lance' && d.lance[i] >= 0;
      q.anel[i].material.emissive.set(feito ? 0xffffff : cores[i]);
      q.anel[i].material.emissiveIntensity = feito ? 0.8 + Math.sin(t * 8) * 0.3 : 0.25;
      q.anel[i].scale.setScalar(feito ? 1.08 : 1);
    }

    // premios: fila no fundo, o da vez gira no pedestal, os ganhos vao para a vitrine do dono, o empatado afunda
    const ganhos = [0, 0];
    q.premios.forEach((g, k) => {
      const dono = d.premios[k];
      let x = (k - 1) * 1.9, y = 0.9, z = -3.9, s = 0.55;
      if (dono === 0 || dono === 1) { x = (dono ? 1 : -1) * (5.1 + ganhos[dono]++ * 1.2); y = 1.08; z = -1.9; s = 0.62; }
      else if (dono === -1) { x = 0; y = 0.4; z = 0; s = 0.01; }
      else if (k === d.round) { x = 0; y = 1.5 + Math.sin(t * 2.5) * 0.12 + (suspense ? Math.abs(Math.sin(t * 20)) * 0.15 : 0); z = 0; s = 1.1; }
      const u = Math.min(1, dt * 6);
      g.position.set(mix(g.position.x, x, u), mix(g.position.y, y, u), mix(g.position.z, z, u));
      g.scale.setScalar(Math.max(0.01, mix(g.scale.x, s, u)));
      g.rotation.y += dt * (k === d.round && dono == null ? 2.2 : 0.5);
    });

    q.aro.material.emissiveIntensity = suspense ? (Math.sin(t * 40) > 0 ? 1.6 : 0.1) : 0.6 + Math.sin(t * 3) * 0.3;
    q.aro.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    q.holofotes.forEach((l, k) => {
      l.material.emissiveIntensity = suspense ? (Math.sin(t * 30 + k * 3) > 0 ? 1.8 : 0.1) : 0.8 + Math.sin(t * 2 + k * 2) * 0.2;
    });

    const chave = `${d.round}-${d.fase}-${d.mostrou}`;
    if (chave !== q.chave) {                        // sons e faiscas nas viradas
      q.chave = chave;
      if (suspense) for (let k = 0; k < 6; k++) c.som(180 + k * 25, 0.1, 'square', 0.12);
      if (revela && !d.mostrou) { c.som(700, 0.12, 'triangle', 0.25); c.som(900, 0.1, 'triangle', 0.15); }
      if (revela && d.mostrou) {
        for (const i of [0, 1]) if (d.lance[i] > 0) c.particulas((i ? 1 : -1) * MONTE_X, 0.4, MONTE_Z, cores[i], 6 + d.lance[i] * 2, 5);
        if (d.dono >= 0) {
          c.particulas(0, 2.2, 0, 0xffd84d, 50, 11); c.particulas(d.dono ? X : -X, 2, Z, cores[d.dono], 30, 9);
          c.som(523, 0.15, 'triangle', 0.25); c.som(784, 0.3, 'triangle', 0.25);
        } else { c.particulas(0, 1.8, 0, 0x8a8fa8, 40, 8); c.som(120, 0.4, 'sawtooth', 0.2); }
      }
      if (d.fase === 'fim' && d.vencedor >= 0) c.particulas(d.vencedor ? X : -X, 2.5, Z, 0xffd84d, 60, 12);
    }
  },
};
