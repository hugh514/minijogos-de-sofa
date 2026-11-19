// Trem da Estacao (Festa: cooperativo, 2 a 4). Um trenzinho anda sozinho pelos trilhos, mas a linha tem buracos e rios.
// Rapido: encostem na pilha para pegar um trilho (um por vez) e encostem no buraco a frente do trem para encaixar.
// Ponte: o rio so se atravessa se os dois girarem as manivelas, uma de cada margem, segurando Gira ao mesmo tempo.
// O trem para quando falta linha e corre quando ha linha pronta a frente. Venceram se ele chegar a estacao antes do tempo.
import { quem, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 6.5, TEMPO = 40;
export const NS = 9, SW = 2 * LX / NS;                          // nove pedacos de linha, do cais ate a estacao
export const FRENTE0 = -6, XFIM = LX - 1.6;                     // onde o nariz do trem comeca e onde ele para na estacao
export const V_TREM = 0.65, ARRANQUE = 2;                       // velocidade normal (unidades por segundo) e quando ele sai
export const PILHAS = [{ x: -7, z: 4.3 }, { x: 9.4, z: -3.9 }], R_PILHA = 2.1;      // uma pilha em cada ponta da linha, fora de onde cabe um rio
export const R_MANIVELA = 2.1, T_PONTE = 1.3, SOLTA = 0.35, GRACA_PONTE = 1.2;     // a metade da ponte so comeca a subir GRACA_PONTE s depois que a mao saiu (distracao curta nao desfaz)
const V_ANDA = 7, V_CARGA = 6, GRACA = 0.35, ZMANI = -2.7;
const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);

// Quantos buracos e quantas pontes: cresce com o numero de jogadores e com a noite (0 a 4).
export const buracos = (n, noite) => limita(Math.round(2.6 + 0.8 * (n - 2) + 0.5 * noite), 3, 5);
export const pontes = (n, noite) => 1 + (n >= 3 && noite >= 1 ? 1 : 0) + (n >= 4 && noite >= 3 ? 1 : 0);
export const solta = noite => SOLTA * (1 + 0.9 * noite);                 // a manivela solta mais depressa nas noites tardias: os dois precisam girar juntos
export const velocidade = (n, noite) => V_TREM * (1 + 0.05 * (n - 2)) * (1 + 0.03 * noite);

const xDe = k => -LX + k * SW;
const manivela = (s, lado) => ({ x: lado ? s.x1 + 0.9 : s.x0 - 0.9, z: ZMANI });

// Uma metade da ponte: desce enquanto alguem gira; solta, espera um instante e so entao sobe devagar.
function giraLado(s, lado, gira, dt, noite) {
  const h = 'h' + lado, g = 'g' + lado;
  if (gira) { s[h] = Math.min(1, s[h] + dt / T_PONTE); s[g] = 0; return; }
  s[g] = (s[g] ?? 0) + dt;
  if (s[g] > GRACA_PONTE) s[h] = Math.max(0, s[h] - dt * solta(noite));
}

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

// Sorteia quais pedacos (3 a 7) ficam sem linha e quais deles sao rios (3 a 6). Rios nunca ficam um do lado do outro.
function montaLinha(p, n, noite) {
  const slots = Array.from({ length: NS }, (_, k) => ({ k, x0: xDe(k), x1: xDe(k + 1), x: xDe(k) + SW / 2, tipo: 'ok', pronto: true, hN: 0, hS: 0, gN: 0, gS: 0, tPronto: -9 }));
  const livres = [3, 4, 5, 6, 7];
  for (let q = livres.length - 1; q > 0; q--) { const r = Math.floor(p.rng() * (q + 1)); [livres[q], livres[r]] = [livres[r], livres[q]]; }
  const falhas = livres.slice(0, buracos(n, noite)).sort((a, b) => a - b);
  let ponte = 0;
  for (const k of [...falhas].sort(() => p.rng() - 0.5)) {
    const rio = k <= 6 && ponte < pontes(n, noite) && !slots[k - 1].ponte && !slots[k + 1]?.ponte;       // o ultimo pedaco nunca e rio: ali fica a pilha da direita
    Object.assign(slots[k], { tipo: rio ? 'ponte' : 'falta', pronto: false, ponte: rio });
    if (rio) ponte++;
  }
  return slots;
}

// Primeiro pedaco sem linha que o trem ainda vai pisar.
const proximoBuraco = d => d.slots.find(s => !s.pronto && s.x1 > d.trem.x - 0.2);

function encaixa(p, d, i, s) {
  s.pronto = true; s.tPronto = p.t; d.leva[i] = false; d.pega[i] = 0.5; d.colocados++;
  d.fx.push({ tipo: 'encaixou', x: s.x, z: 0 });
  p.eventos.push('moeda');
}

function terminaPonte(p, d, s) {
  s.pronto = true; s.tPronto = p.t; d.pontesFeitas++;
  d.fx.push({ tipo: 'ponte', x: s.x, z: 0 });
  p.eventos.push('ponto');
  aviso(d, 'Ponte pronta! Os dois juntos!', '#6bff9a', 1.8);
}

// O texto de cada celular: o que fazer agora.
function textoDe(p, d, i) {
  const m = d.mani[i], pendentes = d.slots.filter(s => !s.pronto);
  if (m) {
    const s = d.slots[m.k], outro = m.lado ? s.hN : s.hS;
    return outro > 0.15 ? 'Os dois girando! A ponte está descendo.' : 'Girando! Seu amigo precisa girar o outro lado.';
  }
  const faltas = pendentes.filter(s => s.tipo === 'falta').length, carregando = d.leva.filter(Boolean).length;
  if (d.leva[i]) return faltas ? 'Leve o trilho até o buraco à frente do trem.' : 'Só falta ponte: solte o trilho e gire a manivela.';
  const ajuda = p.jogadores.findIndex((_, q) => q !== i && d.mani[q]);
  if (ajuda >= 0) return 'Ajude ' + quem(p, ajuda) + ': segure Gira na outra manivela.';
  if (faltas > carregando) return 'Pegue um trilho: encoste na pilha.';
  if (pendentes.some(s => s.tipo === 'ponte')) return 'Rio à frente! Vá a uma manivela e segure Gira.';
  return pendentes.length ? 'Um amigo já leva o trilho. Fique pronto para ajudar.' : 'Linha pronta! O trem está correndo.';
}

export default {
  id: 'trem-coop', genero: 'reflexo', nome: 'Trem da Estação',
  dica: 'Levem trilhos aos buracos e, nos rios, os dois segurem Gira juntos!',
  semMod: ['espelho', 'foguete'],       // espelho confunde quem carrega o trilho e foguete passa direto dos buracos
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Gira', b: '' }, semMovimento: false, semDash: true, semPulo: true,
  rotulo: 'do caminho', sufixo: '%', duracao: TEMPO, tema: 0, semNome: true,   // os bonecos se juntam na pilha e no buraco: o nome flutuante cobria o trilho; a cor do boneco ja diz quem e

  camera: () => ({ x: 0, y: 20, z: 11, ox: 0, oy: 0, oz: 0.3 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const n = p.jogadores.length;
    p.jogadores.forEach((j, i) => { j.x = -4.6 + i * 2.2; j.z = 3; });
    const cada = f => p.jogadores.map((_, i) => f(i));
    p.dados = {
      placar: [0], aviso: 'Levem trilhos aos buracos!', avisoCor: '#ffd23f', avisoT: 3, fx: [], t: 0,
      slots: montaLinha(p, n, noiteDe(p)), trem: { x: FRENTE0, v: 0, parado: false }, partiu: false, avisouParada: false, avisouRio: false, fim: '',
      leva: cada(() => false), pega: cada(() => 0), seg: cada(() => 0), mani: cada(() => null), colocados: 0, pontesFeitas: 0,
      inventario: cada(() => ['Mãos livres']), texto: cada(() => ''),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, noite = noiteDe(p);
    d.t = p.t;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    // ----- jogadores: andam, pegam trilho na pilha, encaixam no buraco, giram a manivela -----
    const seguraM = new Map();        // 'k:lado' -> quantos seguram essa manivela
    js.forEach((j, i) => {
      const vmax = d.leva[i] ? V_CARGA : V_ANDA, v = Math.hypot(j.vx, j.vz);
      if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
      d.pega[i] = Math.max(0, d.pega[i] - dt);
      d.seg[i] = Math.max(0, d.seg[i] - dt);
      if (j.apertouA > 0) d.seg[i] = GRACA;
      if (!d.leva[i] && d.pega[i] <= 0 && PILHAS.some(q => dist(j, q) < R_PILHA)) { d.leva[i] = true; d.fx.push({ tipo: 'pegou', x: j.x, z: j.z }); p.eventos.push('troca'); }
      else if (d.leva[i] && d.pega[i] <= 0) {
        const s = d.slots.find(q => q.tipo === 'falta' && !q.pronto && Math.abs(j.x - q.x) < SW / 2 + 0.6 && Math.abs(j.z) < 2.6);
        if (s) encaixa(p, d, i, s);
      }
      d.mani[i] = null;
      if (j.ent.d || d.seg[i] > 0) {
        let melhor = Infinity;
        for (const s of d.slots) {
          if (s.pronto || s.tipo !== 'ponte') continue;
          for (const lado of [0, 1]) { const m = dist(j, manivela(s, lado)); if (m < R_MANIVELA && m < melhor) { melhor = m; d.mani[i] = { k: s.k, lado }; } }
        }
        if (d.mani[i]) { const c = d.mani[i].k + ':' + d.mani[i].lado; seguraM.set(c, (seguraM.get(c) ?? 0) + 1); }
      }
    });

    // ----- pontes: cada lado desce enquanto alguem gira; solta, sobe devagar; os dois cheios, a ponte fecha -----
    for (const s of d.slots) {
      if (s.pronto || s.tipo !== 'ponte') continue;
      giraLado(s, 'N', seguraM.has(s.k + ':0'), dt, noite);
      giraLado(s, 'S', seguraM.has(s.k + ':1'), dt, noite);
      if (s.hN >= 1 && s.hS >= 1) terminaPonte(p, d, s);
    }
    js.forEach((_, i) => { if (d.mani[i] && d.slots[d.mani[i].k].pronto) d.mani[i] = null; });

    // ----- o trem -----
    const t = d.trem;
    if (!d.partiu && p.t >= ARRANQUE) { d.partiu = true; p.eventos.push('troca'); aviso(d, 'O trem partiu! Consertem a linha à frente.', '#ffd23f', 2.2); }
    if (d.partiu) {
      const prox = proximoBuraco(d), livre = (prox ? prox.x0 - 0.15 : XFIM) - t.x;
      t.parado = !!prox && livre <= 0.02;
      const fator = t.parado ? 0 : Math.max(0.35, 1 + 0.6 * limita((livre - 1.5) / 5, 0, 1));       // na reta final o trem nao empaca: chega devagar
      t.v = velocidade(js.length, noite) * fator;
      t.x = Math.min(t.x + t.v * dt, prox ? Math.max(t.x, prox.x0 - 0.15) : XFIM);
      if (t.parado && !d.avisouParada) {
        d.avisouParada = true; p.eventos.push('batida');
        aviso(d, prox.tipo === 'ponte' ? 'Rio na frente! Os dois giram Gira.' : 'O trem parou! Falta trilho.', '#ff9a3a', 2);
      } else if (!t.parado) d.avisouParada = false;
    }

    // ----- placar e celulares -----
    const pct = limita((d.trem.x - FRENTE0) / (XFIM - FRENTE0), 0, 1);
    d.placar = [Math.floor(pct * 100)];
    js.forEach((_, i) => {
      d.inventario[i] = [d.mani[i] ? 'Girando' : d.leva[i] ? 'Leva trilho' : 'Mãos livres'];
      const texto = textoDe(p, d, i);
      if (texto !== d.texto[i]) { d.texto[i] = texto; p.celular[i] = { ...p.celular[i], texto }; }
    });

    // ----- fim -----
    if (t.x >= XFIM - 0.001) {
      d.fim = 'chegou'; aviso(d, 'O trem chegou à estação!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O trem chegou à estação! Vocês consertaram a linha juntos!' }; });
      d.fx.push({ tipo: 'chegada' }); p.eventos.push('ponto');
      return 2;
    }
    if (p.t >= TEMPO) {
      d.fim = 'tempo'; aviso(d, 'O tempo acabou. O trem não chegou.', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O trem não chegou a tempo. Na próxima, deixem a linha pronta antes dele.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    const d = c.p.dados;
    if (!d?.slots) return;
    pecas.visto = 0;

    // campo: grama em faixas, com arvores e pedras fora da arena
    const grama = sem(malha(caixa(LX * 2, 0.04, LZ * 2), 0x5f9b4a, { roughness: 1 })); grama.position.y = 0.02; grupo.add(grama);
    for (let k = 0; k < 6; k++) { const f = sem(malha(caixa(LX * 2, 0.02, 1.6), 0x6aa853, { roughness: 1 })); f.position.set(0, 0.05, -LZ + 1.2 + k * 2.4); grupo.add(f); }
    for (let k = 0; k < 9; k++) {
      const x = -LX + 1.2 + k * 2.6, tronco = sem(malha(caixa(0.45, 1.3, 0.45), 0x6b4a2a)); tronco.position.set(x, 0.65, -LZ - 1.5 - (k % 2) * 0.8);
      const copa = malha(new THREE.ConeGeometry(1.2 + (k % 3) * 0.25, 3.0, 8), k % 2 ? 0x2f7a3a : 0x3c8f47, { roughness: 1 }); copa.position.set(x, 2.6, tronco.position.z);
      grupo.add(tronco, copa);
    }

    // cada pedaco da linha: cascalho, trilhos prontos, rio com as duas metades da ponte, manivelas e marcador de falta
    pecas.slots = d.slots.map(s => {
      const g = new THREE.Group(); g.position.set(s.x, 0, 0);
      const ps = { g };
      if (s.ponte) {
        const rio = sem(malha(caixa(SW, 0.05, LZ * 2), 0x2c7fd1, { roughness: 0.2, metalness: 0.1 })); rio.position.y = 0.06;
        const margemE = sem(malha(caixa(0.3, 0.3, LZ * 2), 0x8a8f98, { roughness: 1 })); margemE.position.set(-SW / 2 - 0.15, 0.17, 0);
        const margemD = sem(malha(caixa(0.3, 0.3, LZ * 2), 0x8a8f98, { roughness: 1 })); margemD.position.set(SW / 2 + 0.15, 0.17, 0);
        const espuma = Array.from({ length: 6 }, (_, q) => { const o = sem(malha(caixa(1.2, 0.03, 0.14), 0xcfe9ff, { emissive: 0x6aa8e0, emissiveIntensity: 0.4 })); o.position.set((q % 2 - 0.5) * 0.9, 0.1, 0); g.add(o); return o; });
        g.add(rio, margemE, margemD); ps.espuma = espuma;
        // as duas metades da ponte: tabuas que saem de cada margem
        ps.meias = [0, 1].map(lado => {
          const m = new THREE.Group();
          const tabua = malha(caixa(SW / 2, 0.16, 2.0), 0xb98a56, { roughness: 0.9 }); tabua.position.set(lado ? -SW / 4 : SW / 4, 0.2, 0);
          const t1 = sem(malha(caixa(SW / 2, 0.1, 0.14), 0xcfd6dd, { metalness: 0.6, roughness: 0.4 })); t1.position.set(lado ? -SW / 4 : SW / 4, 0.34, 0.6);
          const t2 = t1.clone(); t2.position.z = -0.6;
          m.add(tabua, t1, t2); m.position.x = lado ? SW / 2 : -SW / 2; g.add(m); return m;
        });
        ps.manis = [0, 1].map(lado => {
          const mn = manivela(s, lado), w = new THREE.Group(); w.position.set(mn.x - s.x, 0, mn.z);
          const base = sem(malha(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 20), 0x4a4f58, { roughness: 0.8 })); base.position.y = 0.08;
          const poste = malha(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10), 0x6b4a2a); poste.position.y = 0.7;
          const roda = new THREE.Group(); roda.position.y = 1.4;
          const aro = sem(malha(new THREE.TorusGeometry(0.75, 0.1, 8, 20), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.5 })); roda.add(aro);
          for (const a of [0, Math.PI / 2]) { const r = sem(malha(caixa(1.5, 0.12, 0.12), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.5 })); r.rotation.y = a; roda.add(r); }
          roda.rotation.x = Math.PI / 2.6;
          const anel = sem(malha(new THREE.RingGeometry(R_MANIVELA - 0.12, R_MANIVELA, 40), 0xffffff, { emissive: 0xffe9a0, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
          anel.rotation.x = -Math.PI / 2; anel.position.y = 0.16;
          w.add(base, poste, roda, anel); g.add(w); w.userData = { roda, anel }; return w;
        });
      } else {
        const bal = sem(malha(caixa(SW, 0.12, 2.6), 0x8a8478, { roughness: 1 })); bal.position.y = 0.1; g.add(bal);
      }
      // trilhos: duas barras de aco e dormentes
      const trilhos = new THREE.Group();
      if (!s.ponte) {
        const nd = 4;
        for (let q = 0; q < nd; q++) { const dm = sem(malha(caixa(0.3, 0.1, 1.9), 0x7a4f2b, { roughness: 1 })); dm.position.set(-SW / 2 + SW / (nd * 2) + q * SW / nd, 0.2, 0); trilhos.add(dm); }
        for (const z of [-0.6, 0.6]) { const b = malha(caixa(SW, 0.14, 0.16), 0xcfd6dd, { metalness: 0.6, roughness: 0.35 }); b.position.set(0, 0.32, z); trilhos.add(b); }
        g.add(trilhos);
      }
      ps.trilhos = trilhos;
      // marcador: contorno amarelo e seta que pula, para o buraco ou o rio
      const marca = new THREE.Group();
      if (!s.pronto || s.tipo !== 'ok') {
        for (const [w, l, x, z] of [[SW, 0.14, 0, -1.4], [SW, 0.14, 0, 1.4], [0.14, 2.8, -SW / 2, 0], [0.14, 2.8, SW / 2, 0]]) { const b = sem(malha(caixa(w, 0.08, l), 0xffa01a, { emissive: 0xff8a00, emissiveIntensity: 0.9 })); b.position.set(x, 0.26, z); marca.add(b); }
        const seta = malha(new THREE.ConeGeometry(0.6, 1.1, 4), 0xffa01a, { emissive: 0xff8a00, emissiveIntensity: 0.9 }); seta.rotation.x = Math.PI; seta.position.y = 2.4; seta.castShadow = false; marca.add(seta); marca.userData = { seta };
        g.add(marca);
      }
      ps.marca = marca;
      grupo.add(g); return ps;
    });

    // estacao no fim da linha
    const plat = sem(malha(caixa(2.2, 0.4, 5.4), 0xd8d2c4, { roughness: 0.9 })); plat.position.set(LX - 1.1, 0.2, 2.9); grupo.add(plat);
    const casa = malha(caixa(1.8, 1.6, 2.2), 0xe4d8b8, { roughness: 0.9 }); casa.position.set(LX - 1.0, 1.2, 3.2); grupo.add(casa);
    const teto = malha(caixa(2.4, 0.3, 2.8), 0xc1442e, { roughness: 0.8 }); teto.position.set(LX - 1.0, 2.15, 3.2); grupo.add(teto);
    const mastro = malha(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), 0xe8e4d8); mastro.position.set(LX - 0.6, 1.8, 5.6); grupo.add(mastro);
    const pano = sem(malha(caixa(1.6, 0.9, 0.06), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.5 })); pano.position.set(LX - 1.4, 3.1, 5.6); grupo.add(pano);

    // pilha de trilhos: duas, uma em cada ponta
    pecas.aneisPilha = [];
    for (const pos of PILHAS) {
      const pilha = new THREE.Group(); pilha.position.set(pos.x, 0, pos.z);
      const estrado = sem(malha(caixa(3.4, 0.2, 2.2), 0x6b4a2a, { roughness: 1 })); estrado.position.y = 0.12; pilha.add(estrado);
      for (let k = 0; k < 3; k++) {
        for (const z of [-0.45, 0.45]) { const b = malha(caixa(3.0, 0.16, 0.18), 0xcfd6dd, { metalness: 0.6, roughness: 0.35 }); b.position.set(0, 0.32 + k * 0.28, z); pilha.add(b); }
        const dm = sem(malha(caixa(0.3, 0.12, 1.5), 0x7a4f2b, { roughness: 1 })); dm.position.set(-1 + k, 0.24 + k * 0.28, 0); pilha.add(dm);
      }
      const anel = sem(malha(new THREE.RingGeometry(R_PILHA - 0.12, R_PILHA, 48), 0xffffff, { emissive: 0xffe9a0, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
      anel.rotation.x = -Math.PI / 2; anel.position.y = 0.1; pilha.add(anel); pecas.aneisPilha.push(anel);
      grupo.add(pilha);
    }

    // trem: locomotiva vermelha e um vagao com um passageiro de cada cor
    const tr = new THREE.Group(); pecas.trem = tr;
    const loco = new THREE.Group();
    const chassi = malha(caixa(2.8, 0.5, 1.7), 0x2a2f3a, { roughness: 0.7 }); chassi.position.y = 0.55;
    const caldeira = malha(new THREE.CylinderGeometry(0.7, 0.7, 1.9, 16), 0xc1272d, { roughness: 0.5 }); caldeira.rotation.z = Math.PI / 2; caldeira.position.set(0.45, 1.2, 0);
    const cabine = malha(caixa(1.0, 1.5, 1.6), 0xa11f25, { roughness: 0.6 }); cabine.position.set(-0.95, 1.5, 0);
    const teto2 = malha(caixa(1.2, 0.15, 1.8), 0x2a2f3a); teto2.position.set(-0.95, 2.3, 0);
    const chamine = malha(new THREE.CylinderGeometry(0.28, 0.2, 0.9, 12), 0x2a2f3a); chamine.position.set(1.0, 2.1, 0);
    const farol = sem(malha(new THREE.SphereGeometry(0.22, 10, 8), 0xfff2b0, { emissive: 0xffe27a, emissiveIntensity: 1.1 })); farol.position.set(1.45, 1.4, 0);
    const para = malha(new THREE.ConeGeometry(0.9, 0.9, 4), 0xffd23f, { roughness: 0.6 }); para.rotation.z = -Math.PI / 2; para.rotation.x = Math.PI / 4; para.position.set(1.75, 0.45, 0);
    loco.add(chassi, caldeira, cabine, teto2, chamine, farol, para);
    pecas.rodas = [];
    for (const x of [-0.9, 0.2, 1.2]) for (const z of [-0.95, 0.95]) { const r = malha(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), 0x1d2028); r.rotation.x = Math.PI / 2; r.position.set(x, 0.42, z); loco.add(r); pecas.rodas.push(r); }
    loco.position.x = 1.1; tr.add(loco);
    const vagao = new THREE.Group(); vagao.position.x = -2.2;
    const caixaV = malha(caixa(2.0, 0.9, 1.7), 0x8a5a2b, { roughness: 0.8 }); caixaV.position.y = 0.9;
    const borda = malha(caixa(2.1, 0.12, 1.8), 0x5a3a1c); borda.position.y = 1.4;
    vagao.add(caixaV, borda);
    for (const x of [-0.6, 0.6]) for (const z of [-0.95, 0.95]) { const r = malha(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 14), 0x1d2028); r.rotation.x = Math.PI / 2; r.position.set(x, 0.36, z); vagao.add(r); pecas.rodas.push(r); }
    const cabecas = c.bonecos.map((_, i) => { const m = malha(new THREE.SphereGeometry(0.42, 14, 10), c.cores[i], { emissive: c.cores[i], emissiveIntensity: 0.3 }); m.position.set(-0.7 + (i % 2) * 1.0, 1.75, (i < 2 ? -0.35 : 0.35)); vagao.add(m); return m; });
    pecas.cabecas = cabecas;
    tr.add(vagao); tr.position.set(FRENTE0 - 1.75, 0, 0); grupo.add(tr);
    pecas.fumaca = Array.from({ length: 5 }, () => { const m = sem(malha(new THREE.SphereGeometry(0.45, 10, 8), 0xffffff, { transparent: true, opacity: 0.6, depthWrite: false })); grupo.add(m); return m; });

    // por jogador: aro no pe quando segura, ligacao ate a manivela
    pecas.jog = [...c.bonecos.keys()].map(i => {
      const cor = c.cores[i];
      const roda = sem(malha(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 28), cor, { emissive: cor, emissiveIntensity: 0.9, transparent: true, opacity: 0.7 }));
      const elo = sem(malha(new THREE.BoxGeometry(1, 0.16, 0.16), cor, { emissive: cor, emissiveIntensity: 1 }));
      const carga = new THREE.Group();
      for (const z of [-0.28, 0.28]) { const b = malha(caixa(2.0, 0.12, 0.14), 0xcfd6dd, { metalness: 0.6, roughness: 0.35 }); b.position.z = z; carga.add(b); }
      for (const x of [-0.7, 0, 0.7]) { const dm = malha(caixa(0.22, 0.1, 0.95), 0x7a4f2b); dm.position.set(x, -0.1, 0); carga.add(dm); }
      const cintilha = sem(malha(new THREE.TorusGeometry(0.5, 0.07, 6, 16), cor, { emissive: cor, emissiveIntensity: 1 })); cintilha.rotation.x = Math.PI / 2; cintilha.position.y = -0.4; carga.add(cintilha);
      roda.visible = elo.visible = carga.visible = false; grupo.add(roda, elo, carga);
      return { roda, elo, carga };
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas } = c;
    if (!pecas.jog) return;
    const tr = d.trem;

    // trem: o nariz em tr.x; o corpo vem atras
    pecas.trem.position.x = tr.x - 3.0;
    pecas.trem.position.y = tr.v > 0.05 ? 0.04 * Math.abs(Math.sin(t * 14)) : 0;
    pecas.rodas.forEach(r => { r.rotation.y += tr.v * dt * 2.2; });
    pecas.fumaca.forEach((m, k) => {
      const f = (t * (tr.parado ? 0.7 : 1.1) + k / pecas.fumaca.length) % 1;
      m.position.set(pecas.trem.position.x + 2.1 - f * (tr.v + 0.6) * 1.2, 2.6 + f * 2.2, 0); m.scale.setScalar(0.5 + f * 1.1);
      m.material.opacity = (1 - f) * 0.65; m.material.color.set(tr.parado ? 0x8c8c94 : 0xffffff);
    });

    // linha: o que ja esta pronto aparece (com um tranco), o que falta pisca; rio e pontes
    d.slots.forEach((s, k) => {
      const ps = pecas.slots[k], pop = limita((d.t - s.tPronto) / 0.35, 0, 1);
      if (!s.ponte) { ps.trilhos.visible = s.pronto; ps.trilhos.position.y = s.pronto && s.tPronto > 0 ? (1 - pop) * 1.2 : 0; }
      if (ps.marca.userData.seta) {
        ps.marca.visible = !s.pronto;
        ps.marca.userData.seta.position.y = 2.2 + 0.4 * Math.abs(Math.sin(t * 5 + k));
      }
      if (s.ponte) {
        ps.espuma.forEach((o, q) => { o.position.z = ((t * 2.2 + q * 2.3) % (LZ * 2)) - LZ; });
        ps.meias.forEach((m, lado) => { const h = s.pronto ? 1 : (lado ? s.hS : s.hN); m.scale.x = Math.max(0.02, h); });
        ps.manis.forEach((w, lado) => {
          w.visible = !s.pronto;
          const aceso = d.mani.some(a => a && a.k === s.k && a.lado === lado);
          w.userData.roda.rotation.z += (aceso ? 6 : 0) * dt; w.userData.anel.material.opacity = aceso ? 0.9 : 0.35 + 0.15 * Math.sin(t * 4 + lado);
        });
      }
    });
    pecas.aneisPilha.forEach((a, k) => { a.material.opacity = 0.35 + 0.15 * Math.sin(t * 4 + k); });

    // jogadores: trilho nas maos, aro e ligacao na manivela
    p.jogadores.forEach((j, i) => {
      const m = pecas.jog[i], mn = d.mani[i];
      m.carga.visible = d.leva[i];
      if (d.leva[i]) { m.carga.position.set(j.x, 2.7 + 0.12 * Math.sin(t * 6 + i), j.z); m.carga.rotation.y = 0.25 * Math.sin(t * 3 + i); m.carga.scale.setScalar(1.3); }
      m.roda.visible = m.elo.visible = !!mn;
      if (!mn) return;
      const alvo = manivela(d.slots[mn.k], mn.lado), len = Math.max(0.01, dist(j, alvo));
      m.roda.position.set(j.x, 0.14, j.z); m.roda.scale.setScalar(0.8 + 0.2 * Math.sin(t * 10 + i));
      m.elo.position.set((j.x + alvo.x) / 2, 0.6, (j.z + alvo.z) / 2); m.elo.rotation.y = -Math.atan2(alvo.z - j.z, alvo.x - j.x); m.elo.scale.set(len, 1, 1);
    });

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'pegou') c.particulas(e.x, 1.2, e.z, 0xcfd6dd, 10, 5);
      else if (e.tipo === 'encaixou') c.particulas(e.x, 0.8, e.z, 0xffd23f, 24, 8);
      else if (e.tipo === 'ponte') c.particulas(e.x, 0.8, e.z, 0x6bff9a, 34, 10);
      else if (e.tipo === 'chegada') c.particulas(LX - 2, 1.5, 0, 0xffd23f, 40, 12);
    }
  },
};
