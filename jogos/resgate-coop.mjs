// Resgate dos Bichinhos (Festa, cooperativo de 2 a 4 jogadores).
// Objetivo unico: levar todos os filhotes perdidos para o cercado antes do tempo acabar. A barra de baixo do placar enche a cada filhote.
// Filhote pequeno: encostar pega, entrar no cercado entrega. Filhote grande: pesado demais, so sai do lugar quando DOIS chegam
// juntos nele (os dois o levam entre si e precisam andar perto um do outro). Uma raposa lenta acorda e vai atras de quem leva filhote:
// quem esta de maos livres toca ESPANTAR e ela foge. Dentro do cercado a raposa nao entra.
import { quem, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 7.2, TEMPO = 40;
export const PEN = { x0: 5.8, x1: 10.6, hz: 4.3 };            // cercado: retangulo na direita, aberto para a esquerda
export const R_PEGA = 1.9, R_GRANDE = 2.9, SOLTA = 5.6, R_ESPANTA = 7.5, R_ROUBA = 1.7;
export const T_ACORDA = 5;
const V_ANDA = 5.8, V_CARREGA = 5, V_DUPLA = 4.4;
const T_FOGE = 3.4, T_ESPERA_PEGA = 0.9;
const CORES = [0xf3e3bd, 0xcf8d4c, 0xeeeeee, 0x8a6a55];           // creme, caramelo, branco, marrom: nenhuma e cor de jogador

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);

// Quantos filhotes ha em cada noite: crescem com o numero de jogadores e, devagar, com a noite (0 a 4).
export function filhotes(n, noite) {
  return { pequenos: 3 + n + Math.floor(noite / 2), grandes: n >= 4 ? 2 : 1 };
}
export const totalDe = (n, noite) => { const f = filhotes(n, noite); return f.pequenos + 2 * f.grandes; };
export const velRaposa = (n, noite) => 2.1 + 0.25 * noite + 0.1 * (n - 2);

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

function espalha(p, qtd, x0, x1, z0, z1, evita, folga) {
  const pontos = [];
  for (let k = 0; k < qtd; k++) {
    let melhor = null, folgaMelhor = -1;
    for (let t = 0; t < 30; t++) {
      const q = { x: x0 + p.rng() * (x1 - x0), z: z0 + p.rng() * (z1 - z0) };
      const m = Math.min(...[...evita, ...pontos].map(o => dist(o, q)), 99);
      if (m > folgaMelhor) { folgaMelhor = m; melhor = q; }
      if (m >= folga) break;
    }
    pontos.push(melhor);
  }
  return pontos;
}

function novoFilhote(p, tipo, pos, k) {
  const casa = { x: PEN.x0 + 1.3 + p.rng() * (PEN.x1 - PEN.x0 - 2.6), z: (p.rng() * 2 - 1) * (PEN.hz - 1.4) };
  return { tipo, x: pos.x, z: pos.z, kx: 0, kz: 0, estado: 'livre', susto: 0, casa, fase: p.rng() * 6.28, cor: k % CORES.length, a: -1, b: -1 };
}

const valorDe = f => (f.tipo === 'g' ? 2 : 1);
const pequenoLivre = f => f.tipo === 'p' && f.estado === 'livre';

// O jogador i solta o que leva e o filhote volta a ficar livre, assustado.
function solta(p, d, f, i, fugirDe) {
  f.estado = 'livre'; f.a = -1; f.b = -1;
  if (i >= 0) d.leva[i] = -1;
  if (fugirDe) { const dx = f.x - fugirDe.x, dz = f.z - fugirDe.z, m = Math.hypot(dx, dz) || 1; f.kx = dx / m * 9; f.kz = dz / m * 9; f.susto = 1.4; }
}

function entrega(p, d, f) {
  f.estado = 'salvo'; d.salvos += valorDe(f);
  d.fx.push({ tipo: f.tipo === 'g' ? 'salvoGrande' : 'salvo', x: f.x, z: f.z });
  p.eventos.push(f.tipo === 'g' ? 'ponto' : 'moeda');
  const falta = d.total - d.salvos;
  if (falta > 0) aviso(d, f.tipo === 'g' ? 'O filhote grande está a salvo!' : 'Mais um a salvo! Faltam ' + falta + '.', '#6bff9a', 1.3);
}

function pegaSimples(p, d) {
  p.jogadores.forEach((j, i) => {
    if (d.leva[i] >= 0 || d.dupla[i] >= 0 || d.espera[i] > 0 || d.fim) return;
    let melhor = -1, md = R_PEGA;
    d.filhotes.forEach((f, k) => { const m = dist(f, j); if (pequenoLivre(f) && m < md) { md = m; melhor = k; } });
    if (melhor < 0) return;
    const f = d.filhotes[melhor];
    f.estado = 'levado'; f.a = i; d.leva[i] = melhor; f.kx = f.kz = 0;
    d.fx.push({ tipo: 'pegou', x: f.x, z: f.z }); p.eventos.push('troca');
  });
}

// Dois jogadores de maos livres juntos de um filhote grande: levantam e levam entre si.
function pegaGrande(p, d) {
  d.filhotes.forEach((f, k) => {
    if (f.tipo !== 'g' || f.estado !== 'livre') return;
    const perto = p.jogadores.map((j, i) => ({ i, m: dist(j, f) })).filter(o => o.m <= R_GRANDE && d.leva[o.i] < 0 && d.dupla[o.i] < 0 && d.espera[o.i] <= 0).sort((a, b) => a.m - b.m);
    f.querDois = perto.length === 1;
    if (perto.length < 2) return;
    f.estado = 'dupla'; f.a = perto[0].i; f.b = perto[1].i; d.dupla[f.a] = d.dupla[f.b] = k;
    d.fx.push({ tipo: 'levanta', x: f.x, z: f.z }); p.eventos.push('troca');
    aviso(d, 'Levantaram o filhote grande! Andem juntos.', '#ffd23f', 1.6);
  });
}

function moveGrande(p, d, f, k) {
  const a = p.jogadores[f.a], b = p.jogadores[f.b];
  f.x = (a.x + b.x) / 2; f.z = (a.z + b.z) / 2;
  if (f.x > PEN.x0 + 0.7) { d.dupla[f.a] = d.dupla[f.b] = -1; d.espera[f.a] = d.espera[f.b] = 0.5; entrega(p, d, f); return; }
  if (dist(a, b) > SOLTA) {                                      // se afastaram: escorrega e cai
    d.espera[f.a] = d.espera[f.b] = T_ESPERA_PEGA; d.dupla[f.a] = d.dupla[f.b] = -1;
    d.fx.push({ tipo: 'caiu', x: f.x, z: f.z }); p.eventos.push('queda'); vibra(p, f.a); vibra(p, f.b);
    f.estado = 'livre'; f.a = f.b = -1;
    aviso(d, 'O filhote grande escorregou! Peguem juntos de novo.', '#ffb13b', 1.8);
  }
}

// Raposa: dorme ate T_ACORDA, depois vai atras de quem leva filhote pequeno. Espantada, foge e volta depois.
function moveRaposa(p, d, dt) {
  const r = d.raposa, js = p.jogadores;
  r.cd = Math.max(0, r.cd - dt); r.t = Math.max(0, r.t - dt);
  if (r.estado === 'dorme') {
    if (p.t < T_ACORDA) return;
    r.estado = 'ronda'; p.eventos.push('troca');
    aviso(d, 'A raposa acordou! Quem está sem filhote toca Espantar.', '#ff8a3a', 2.6);
    return;
  }
  let alvo = null;
  if (r.estado === 'foge') {
    alvo = { x: r.fugaX, z: r.fugaZ };
    if (r.t <= 0) { r.estado = 'ronda'; r.cd = 1.2; }
  } else {
    let md = Infinity;
    js.forEach((j, i) => { const f = d.filhotes[d.leva[i]]; if (f && j.x < PEN.x0 - 1.2 && dist(j, r) < md) { md = dist(j, r); alvo = j; } });
    if (!alvo || r.cd > 0) {                                     // sem caca: rodeia o campo
      if (!r.ponto || dist(r, r.ponto) < 1) r.ponto = { x: -8 + p.rng() * 10, z: (p.rng() * 2 - 1) * 5.5 };
      alvo = r.ponto;
    }
  }
  const dx = alvo.x - r.x, dz = alvo.z - r.z, m = Math.hypot(dx, dz);
  const v = r.estado === 'foge' ? 6.5 : velRaposa(p.n, noiteDe(p));
  if (m > 0.05) { r.x += dx / m * Math.min(m, v * dt); r.z += dz / m * Math.min(m, v * dt); r.ang = Math.atan2(dz, dx); }
  r.x = limita(r.x, -LX + 0.8, PEN.x0 - 1.2); r.z = limita(r.z, -LZ + 0.8, LZ - 0.8);
  if (r.estado !== 'ronda' || r.cd > 0) return;
  js.forEach((j, i) => {                                         // encostou em quem leva filhote: ele escapa e a raposa corre
    const f = d.filhotes[d.leva[i]];
    if (!f || dist(j, r) > R_ROUBA || r.estado !== 'ronda') return;
    solta(p, d, f, i, r); d.espera[i] = T_ESPERA_PEGA; vibra(p, i);
    d.fx.push({ tipo: 'assusta', x: j.x, z: j.z }); p.eventos.push('queda');
    r.estado = 'foge'; r.t = T_FOGE; r.fugaX = -LX + 1; r.fugaZ = r.z < 0 ? -LZ + 1 : LZ - 1;
    aviso(d, 'A raposa assustou o filhote! Peguem de novo.', '#ff8a3a', 1.8);
  });
}

function espanta(p, d) {
  const r = d.raposa;
  p.jogadores.forEach((j, i) => {
    if (j.apertouA <= 0 || d.leva[i] >= 0 || d.dupla[i] >= 0 || d.fim) return;
    if (r.estado === 'foge' || dist(j, r) > R_ESPANTA) { d.fx.push({ tipo: 'sopro', x: j.x, z: j.z, i }); return; }
    r.estado = 'foge'; r.t = T_FOGE + 0.6; r.fugaX = -LX + 1; r.fugaZ = r.z < 0 ? -LZ + 1 : LZ - 1; r.cd = 0;
    d.fx.push({ tipo: 'sopro', x: j.x, z: j.z, i }, { tipo: 'espantou', x: r.x, z: r.z });
    p.eventos.push('batida');
    aviso(d, quem(p, i) + ' espantou a raposa!', '#6bff9a', 1.4);
  });
}

function textoDe(p, d, i) {
  const j = p.jogadores[i], r = d.raposa, k = d.leva[i];
  if (d.dupla[i] >= 0) { const f = d.filhotes[d.dupla[i]], outro = f.a === i ? f.b : f.a; return 'Levem o filhote grande ao cercado. Fique perto de ' + quem(p, outro) + '.'; }
  if (k >= 0) return r.estado === 'ronda' && dist(r, j) < 8 && p.t >= T_ACORDA ? 'A raposa vem aí! Um amigo toca Espantar.' : 'Leve o filhote até o cercado.';
  const caca = p.jogadores.findIndex((q, m) => m !== i && d.leva[m] >= 0 && r.estado === 'ronda' && dist(r, q) < 9);
  if (caca >= 0) return 'A raposa vai atrás de ' + quem(p, caca) + '! Toque Espantar.';
  const grande = d.filhotes.find(f => f.tipo === 'g' && f.estado === 'livre');
  const pequenos = d.filhotes.some(pequenoLivre);
  if (!pequenos && grande) return 'Só falta o filhote grande. Cheguem juntos nele.';
  if (pequenos) return 'Encoste num filhote para pegar. O grande é a dois.';
  return 'Ajude a levar o filhote grande ao cercado.';
}

export default {
  id: 'resgate-coop', genero: 'corrida', nome: 'Resgate dos Bichinhos',
  dica: 'Levem os filhotes ao cercado: o grande é a dois, e o botão Espantar afasta a raposa.',
  semMod: ['foguete'],       // o limite de velocidade do resgate anula o foguete
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Espantar', b: '' }, semDash: true, semPulo: true,
  rotulo: 'a salvo', duracao: TEMPO, semNome: true,   // a dupla anda junto com o filhote grande: os nomes se sobrepunham e o cobriam

  camera: () => ({ x: 0, y: 20, z: 10.5, ox: 0, oy: 0, oz: 0.3 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const n = p.jogadores.length, noite = noiteDe(p), cada = f => p.jogadores.map((_, i) => f(i));
    p.jogadores.forEach((j, i) => { j.x = -2.5 + 1.9 * (i % 2); j.z = (i - (n - 1) / 2) * 2.3; });
    const f = filhotes(n, noite), fixos = p.jogadores.map(j => ({ x: j.x, z: j.z }));
    const grandes = espalha(p, f.grandes, -5.5, 0.5, -4.8, 4.8, fixos, 5);
    const pequenos = espalha(p, f.pequenos, -9.6, 3.6, -5.0, 6.3, [...fixos, ...grandes], 3);
    const lista = [...grandes.map((q, k) => novoFilhote(p, 'g', q, k)), ...pequenos.map((q, k) => novoFilhote(p, 'p', q, k))];
    p.dados = {
      placar: [0], inventario: cada(() => ['Mãos livres']), aviso: 'Levem os filhotes ao cercado!', avisoCor: '#ffd23f', avisoT: 3, fx: [],
      filhotes: lista, total: lista.reduce((s, q) => s + valorDe(q), 0), salvos: 0, fim: '',
      leva: cada(() => -1), dupla: cada(() => -1), espera: cada(() => 0), texto: cada(() => ''), rotA: cada(() => ''),
      raposa: { x: -9.4, z: -5.2, ang: 0, estado: 'dorme', t: 0, cd: 0, ponto: null, fugaX: 0, fugaZ: 0 },
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    js.forEach((j, i) => {
      d.espera[i] = Math.max(0, d.espera[i] - dt);
      const vmax = d.dupla[i] >= 0 ? V_DUPLA : d.leva[i] >= 0 ? V_CARREGA : V_ANDA, v = Math.hypot(j.vx, j.vz);
      if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
    });

    espanta(p, d);
    moveRaposa(p, d, dt);
    pegaSimples(p, d);
    pegaGrande(p, d);

    d.filhotes.forEach((f, k) => {
      f.susto = Math.max(0, f.susto - dt);
      if (f.estado === 'levado') {
        const j = js[f.a];
        f.x = j.x; f.z = j.z;
        if (j.x > PEN.x0 + 0.5) { d.leva[f.a] = -1; entrega(p, d, f); }
      } else if (f.estado === 'dupla') moveGrande(p, d, f, k);
      else if (f.estado === 'livre') {
        f.x += f.kx * dt; f.z += f.kz * dt;
        const frea = Math.pow(0.03, dt); f.kx *= frea; f.kz *= frea;
        f.x = limita(f.x, -LX + 1, PEN.x0 - 1.2); f.z = limita(f.z, -LZ + 1, LZ - 1);
      } else if (f.estado === 'salvo') {                         // passeia em volta de casa
        f.x += (f.casa.x - f.x) * Math.min(1, 2.5 * dt); f.z += (f.casa.z - f.z) * Math.min(1, 2.5 * dt);
      }
    });

    d.placar = [d.salvos];
    js.forEach((j, i) => {
      const k = d.leva[i], g = d.dupla[i], texto = textoDe(p, d, i), a = k >= 0 || g >= 0 ? 'Carregando' : 'Espantar';
      d.inventario[i] = [g >= 0 ? 'Filhote grande' : k >= 0 ? 'Leva um filhote' : 'Mãos livres'];
      if (a !== d.rotA[i] || texto !== d.texto[i]) { d.rotA[i] = a; d.texto[i] = texto; p.celular[i] = { ...p.celular[i], a, texto }; }
    });

    if (d.salvos >= d.total) {
      d.fim = 'salvos'; aviso(d, 'Todos os filhotes estão a salvo!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], a: 'Espantar', texto: 'Todos os filhotes estão a salvo! Vocês foram ótimos!' }; });
      return 2;
    }
    if (p.t >= TEMPO) {
      d.fim = 'tempo'; aviso(d, 'O tempo acabou. Faltaram ' + (d.total - d.salvos) + ' no campo.', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], a: 'Espantar', texto: 'O tempo acabou. Na próxima, levem o grande a dois logo no começo.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0;

    const grama = sem(malha(caixa(LX * 2, 0.04, LZ * 2), 0x6dbb55, { roughness: 1 })); grama.position.y = 0.02; grupo.add(grama);
    const flores = [0xffffff, 0xffd23f, 0xff8fb8, 0xb28cff];
    for (let k = 0; k < 46; k++) {                                // flores espalhadas, sempre nos mesmos lugares
      const x = ((k * 7.31) % (PEN.x0 + LX - 1.5)) - LX + 0.7, z = ((k * 3.77) % (LZ * 2 - 1.4)) - LZ + 0.7;
      const flor = sem(malha(new THREE.SphereGeometry(0.17, 8, 6), flores[k % 4], { roughness: 0.8 })); flor.position.set(x, 0.12, z); grupo.add(flor);
    }
    // cercado de madeira: chao de palha, cerca em tres lados e dois portais na entrada
    const palha = sem(malha(caixa(PEN.x1 - PEN.x0, 0.05, PEN.hz * 2), 0xe3c66a, { roughness: 1 })); palha.position.set((PEN.x0 + PEN.x1) / 2, 0.06, 0); grupo.add(palha);
    const madeira = 0x9b6a3a;
    const trilho = (x, z, w, l) => { const t = malha(caixa(w, 0.2, l), madeira, { roughness: 0.9 }); t.position.set(x, 0.85, z); grupo.add(t); };
    trilho(PEN.x1 + 0.1, 0, 0.2, PEN.hz * 2 + 0.4); trilho((PEN.x0 + PEN.x1) / 2, -PEN.hz - 0.1, PEN.x1 - PEN.x0 + 0.4, 0.2); trilho((PEN.x0 + PEN.x1) / 2, PEN.hz + 0.1, PEN.x1 - PEN.x0 + 0.4, 0.2);
    for (let k = 0; k <= 8; k++) {
      const z = -PEN.hz + k * (PEN.hz * 2 / 8);
      const poste = malha(caixa(0.28, 1.5, 0.28), 0x7a5128); poste.position.set(PEN.x1 + 0.1, 0.75, z); grupo.add(poste);
    }
    for (let k = 0; k <= 4; k++) {
      const x = PEN.x0 + k * ((PEN.x1 - PEN.x0) / 4);
      for (const s of [-1, 1]) { const poste = malha(caixa(0.28, 1.5, 0.28), 0x7a5128); poste.position.set(x, 0.75, s * (PEN.hz + 0.1)); grupo.add(poste); }
    }
    for (const s of [-1, 1]) {                                    // dois marcos vermelhos nos cantos da entrada e um tapete verde no chao
      const marco = malha(caixa(0.45, 1.9, 0.45), 0xc9402f); marco.position.set(PEN.x0, 0.95, s * PEN.hz); grupo.add(marco);
      const tampa = sem(malha(new THREE.SphereGeometry(0.36, 10, 8), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.6 })); tampa.position.set(PEN.x0, 2.1, s * PEN.hz); grupo.add(tampa);
    }
    pecas.tapete = sem(malha(caixa(0.7, 0.04, PEN.hz * 2 - 0.5), 0x6bff9a, { emissive: 0x2ed36a, emissiveIntensity: 0.7, transparent: true, opacity: 0.7 })); pecas.tapete.position.set(PEN.x0 + 0.35, 0.1, 0); grupo.add(pecas.tapete);
    pecas.seta = sem(malha(new THREE.ConeGeometry(0.85, 1.8, 12), 0x6bff9a, { emissive: 0x2ed36a, emissiveIntensity: 0.9 })); pecas.seta.rotation.z = -Math.PI / 2; grupo.add(pecas.seta);

    // arvores e arbustos em volta
    const arvore = (x, z, h) => {
      const g = new THREE.Group(), tronco = malha(new THREE.CylinderGeometry(0.28, 0.38, h * 0.4, 8), 0x7a5230); tronco.position.y = h * 0.2;
      const copa = malha(new THREE.ConeGeometry(h * 0.34, h * 0.75, 9), 0x2f8a46, { roughness: 1 }); copa.position.y = h * 0.62;
      g.add(tronco, copa); g.position.set(x, 0, z); grupo.add(g);
    };
    for (let x = -LX + 1; x < PEN.x1; x += 3.6) arvore(x + (x % 2) * 0.4, -LZ - 2.3 - (x * 3 % 1.3), 3.4 + (x * 7 % 1.6));
    for (let z = -LZ + 1.5; z < LZ; z += 4) arvore(-LX - 1.8, z, 3.6 + (z * 5 % 1.4));
    for (let z = -LZ + 2; z < LZ; z += 4.4) arvore(LX + 1.8, z, 3.4);

    // barra de resgate no alto: um quadro por ponto; enche de verde quando o filhote chega ao cercado
    pecas.quadros = [];
    pecas.moldura = sem(malha(caixa(1, 0.1, 1), 0x7a5128)); pecas.moldura.position.set(0, 0.07, -LZ + 0.75); grupo.add(pecas.moldura);

    // raposa
    const r = new THREE.Group();
    const laranja = 0xe8742a, branco = 0xfff4e6;
    const corpo = malha(new THREE.SphereGeometry(0.75, 14, 10), laranja, { roughness: 0.85 }); corpo.scale.set(1.25, 0.85, 0.9); corpo.position.y = 0.85;
    const peito = malha(new THREE.SphereGeometry(0.5, 12, 8), branco); peito.scale.set(0.9, 0.8, 0.85); peito.position.set(0.7, 0.72, 0);
    const cabeca = malha(new THREE.SphereGeometry(0.52, 14, 10), laranja, { roughness: 0.85 }); cabeca.position.set(1.15, 1.25, 0);
    const foci = malha(new THREE.ConeGeometry(0.28, 0.7, 10), branco); foci.rotation.z = -Math.PI / 2; foci.position.set(1.65, 1.17, 0);
    const nariz = sem(malha(new THREE.SphereGeometry(0.1, 8, 6), 0x222222)); nariz.position.set(2.0, 1.17, 0);
    const orelhas = [-0.28, 0.28].map(z => { const o = malha(new THREE.ConeGeometry(0.2, 0.55, 8), 0xc85a1a); o.position.set(1.02, 1.85, z); return o; });
    const olhos = [-0.22, 0.22].map(z => { const o = sem(malha(new THREE.SphereGeometry(0.07, 8, 6), 0x111111)); o.position.set(1.52, 1.38, z); return o; });
    const cauda = malha(new THREE.SphereGeometry(0.5, 12, 8), laranja); cauda.scale.set(1.5, 0.6, 0.6); cauda.position.set(-1.35, 1.0, 0); cauda.rotation.z = 0.5;
    const ponta = malha(new THREE.SphereGeometry(0.28, 10, 8), branco); ponta.position.set(-2.1, 1.2, 0);
    const pernas = [[0.55, 0.3], [0.55, -0.3], [-0.55, 0.3], [-0.55, -0.3]].map(([x, z]) => { const l = malha(new THREE.CylinderGeometry(0.11, 0.1, 0.55, 8), 0x3a2418); l.position.set(x, 0.28, z); return l; });
    r.add(corpo, peito, cabeca, foci, nariz, ...orelhas, ...olhos, cauda, ponta, ...pernas);
    r.scale.setScalar(1.05); r.visible = false; grupo.add(r); pecas.raposa = { grupo: r, cauda, cabeca };
    pecas.zzz = sem(malha(new THREE.TorusGeometry(0.4, 0.08, 6, 14), 0xbfe3ff, { emissive: 0x5aa0d8, emissiveIntensity: 0.8 })); pecas.zzz.visible = false; grupo.add(pecas.zzz);
    pecas.alcance = sem(malha(new THREE.RingGeometry(R_ESPANTA - 0.12, R_ESPANTA, 56), 0xffb13b, { emissive: 0xff8a3a, emissiveIntensity: 0.5, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    pecas.alcance.rotation.x = -Math.PI / 2; pecas.alcance.visible = false; grupo.add(pecas.alcance);

    // marcas por jogador: aro de cor no chao e elo da dupla que carrega o grande
    pecas.aro = [...c.bonecos.keys()].map(i => { const m = sem(malha(new THREE.TorusGeometry(1.15, 0.1, 6, 28), c.cores[i], { emissive: c.cores[i], emissiveIntensity: 0.8 })); m.rotation.x = Math.PI / 2; grupo.add(m); return m; });
  },

  desenha(c, dt, t) {
    const { THREE, pecas } = c, p = c.p, d = p.dados;
    if (!pecas.raposa || !d.filhotes) return;
    const jog = p.jogadores;

    // barra de resgate: quadros acesos de acordo com os pontos salvos
    if (pecas.quadros.length !== d.total) {
      pecas.quadros.forEach(m => { c.grupo.remove(m); });
      pecas.quadros = Array.from({ length: d.total }, (_, k) => {
        const m = c.malha(new THREE.BoxGeometry(1.0, 0.16, 1.0), 0xf4efe0, { roughness: 0.9 });
        m.castShadow = false; m.position.set((k - (d.total - 1) / 2) * 1.25 - 2.2, 0.12, -LZ + 0.75); c.grupo.add(m); return m;
      });
      pecas.moldura.scale.set(d.total * 1.25 + 0.3, 1, 1.5); pecas.moldura.position.set(-2.2, 0.07, -LZ + 0.75);
    }
    pecas.quadros.forEach((m, k) => {
      const aceso = k < d.salvos;
      m.material.color.set(aceso ? 0x6bff9a : 0xf4efe0); m.material.emissive.set(aceso ? 0x2ed36a : 0x000000); m.material.emissiveIntensity = aceso ? 0.8 : 0;
      m.scale.y = aceso ? 1 + 0.6 * Math.max(0, Math.sin(t * 5 + k)) : 1;
    });

    // filhotes
    const faz = (grande) => () => {
      const g = new THREE.Group();
      const cor = grande ? 0x9fb3d0 : 0xf3e3bd;
      const s = grande ? 1.65 : 1;
      const corpo = c.malha(new THREE.SphereGeometry(0.62, 14, 10), cor, { roughness: 0.9 }); corpo.scale.set(1.15, 0.9, 0.95); corpo.position.y = 0.72 * s; corpo.scale.multiplyScalar(s);
      const cabeca = c.malha(new THREE.SphereGeometry(0.46, 14, 10), cor, { roughness: 0.9 }); cabeca.position.set(0.7 * s, 1.15 * s, 0); cabeca.scale.setScalar(s);
      const focinho = c.malha(new THREE.SphereGeometry(0.2, 10, 8), 0xffffff); focinho.position.set(1.05 * s, 1.03 * s, 0); focinho.scale.setScalar(s);
      const nariz = c.malha(new THREE.SphereGeometry(0.08, 8, 6), 0x222222); nariz.position.set(1.22 * s, 1.08 * s, 0); nariz.castShadow = false; nariz.scale.setScalar(s);
      const olhos = [-0.18, 0.18].map(z => { const o = c.malha(new THREE.SphereGeometry(0.07, 8, 6), 0x111111); o.position.set(0.98 * s, 1.32 * s, z * s); o.castShadow = false; o.scale.setScalar(s); return o; });
      const orelhas = [-1, 1].map(z => {
        const o = c.malha(grande ? new THREE.SphereGeometry(0.6, 12, 8) : new THREE.ConeGeometry(0.17, 0.46, 8), grande ? 0x8296b4 : 0xc89a6a);
        if (grande) { o.scale.set(0.22, 1, 1); o.position.set(0.62 * s, 1.2 * s, z * 0.66 * s); o.rotation.y = z * 0.7; }
        else { o.position.set(0.55, 1.5, z * 0.34); o.rotation.x = z * 0.8; }
        return o;
      });
      const rabo = c.malha(new THREE.SphereGeometry(0.2, 8, 6), cor); rabo.position.set(-0.78 * s, 0.9 * s, 0); rabo.scale.setScalar(s);
      const pes = [[0.4, 0.28], [0.4, -0.28], [-0.4, 0.28], [-0.4, -0.28]].map(([x, z]) => { const l = c.malha(new THREE.CylinderGeometry(0.14 * s, 0.13 * s, 0.4 * s, 8), grande ? 0x7488a6 : 0xb8885a); l.position.set(x * s, 0.2 * s, z * s); return l; });
      g.add(corpo, cabeca, focinho, nariz, ...olhos, ...orelhas, rabo, ...pes);
      if (grande) {
        const tromba = c.malha(new THREE.CylinderGeometry(0.15, 0.1, 1.2, 8), 0x8296b4); tromba.rotation.z = -Math.PI / 2.6; tromba.position.set(1.65, 1.35, 0);
        const aro = c.malha(new THREE.TorusGeometry(2.5, 0.09, 6, 32), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }); aro.rotation.x = Math.PI / 2; aro.position.y = 0.08; aro.castShadow = false;
        g.add(tromba, aro); g.userData.aro = aro;
      }
      g.userData.corpo = corpo; g.userData.rabo = rabo;
      return g;
    };
    const pequenos = d.filhotes.filter(f => f.tipo === 'p'), grandes = d.filhotes.filter(f => f.tipo === 'g');
    const gp = c.pool('pequenos', pequenos.length, faz(false)), gg = c.pool('grandes', grandes.length, faz(true));
    const posiciona = (m, f, k, grande) => {
      const levado = f.estado === 'levado', alto = f.estado === 'dupla';
      const pulo = f.estado === 'livre' ? Math.max(0, Math.sin(t * 3 + f.fase)) * 0.12 : f.estado === 'salvo' ? Math.max(0, Math.sin(t * 4 + f.fase * 2)) * 0.25 : 0;
      const sacode = f.susto > 0 ? Math.sin(t * 40) * 0.08 : 0;
      m.position.set(f.x + sacode, levado ? 2.35 + 0.1 * Math.sin(t * 8) : alto ? 1.6 : pulo, f.z);
      m.scale.setScalar(levado ? 0.8 : alto ? 0.8 : 1);
      m.rotation.y = f.estado === 'salvo' ? Math.sin(t * 0.8 + f.fase) * 0.8 + 0.2 : f.estado === 'livre' ? Math.sin(t * 0.7 + f.fase) * 0.5 : 0;
      m.userData.rabo.rotation.z = Math.sin(t * 10 + f.fase) * 0.5;
      if (grande && m.userData.aro) { m.userData.aro.visible = f.estado === 'livre'; m.userData.aro.material.opacity = 0.35 + 0.3 * Math.sin(t * 5); m.userData.aro.scale.setScalar(f.querDois ? 1 + 0.05 * Math.sin(t * 9) : 0.9); m.userData.aro.material.color.set(f.querDois ? 0xffd23f : 0xffffff); }
      m.visible = true;
    };
    pequenos.forEach((f, k) => posiciona(gp[k], f, k, false));
    grandes.forEach((f, k) => posiciona(gg[k], f, k, true));
    // cor de cada filhote pequeno
    pequenos.forEach((f, k) => { const cor = CORES[f.cor]; gp[k].userData.corpo.material.color.set(cor); });

    // setas ligando a dupla ao filhote grande
    const elos = [];
    grandes.forEach(f => { if (f.estado === 'dupla') elos.push([jog[f.a], f], [jog[f.b], f]); });
    const barras = c.pool('elos', elos.length, () => c.malha(new THREE.BoxGeometry(1, 0.16, 0.16), 0xffe27a, { emissive: 0xffc531, emissiveIntensity: 1.2 }));
    elos.forEach(([a, f], k) => {
      const e = barras[k], len = Math.max(0.01, dist(a, f));
      e.position.set((a.x + f.x) / 2, 1.0, (a.z + f.z) / 2); e.rotation.y = -Math.atan2(f.z - a.z, f.x - a.x); e.scale.set(len, 1, 1); e.castShadow = false;
    });

    // aro de cor do jogador no chao
    jog.forEach((j, i) => { const a = pecas.aro[i]; a.position.set(j.x, 0.1, j.z); a.visible = true; });

    // seta do cercado: pula quando alguem leva filhote
    const alguem = d.leva.some(k => k >= 0) || d.filhotes.some(f => f.estado === 'dupla');
    pecas.seta.position.set(PEN.x0 - 1.1 - (alguem ? 0.6 * Math.abs(Math.sin(t * 5)) : 0), 2.6, 0); pecas.seta.visible = d.salvos < d.total;
    pecas.tapete.material.opacity = alguem ? 0.55 + 0.3 * Math.sin(t * 6) : 0.35;

    // raposa
    const r = d.raposa, g = pecas.raposa.grupo;
    g.visible = true; g.position.set(r.x, r.estado === 'dorme' ? -0.25 : Math.abs(Math.sin(t * 8)) * 0.12, r.z);
    g.rotation.y = r.estado === 'dorme' ? 2.2 : -r.ang;
    g.scale.set(1.05, r.estado === 'dorme' ? 0.7 : 1.05, 1.05);
    pecas.zzz.visible = r.estado === 'dorme'; pecas.zzz.position.set(r.x + 0.4, 2.6 + 0.4 * Math.sin(t * 2), r.z); pecas.zzz.scale.setScalar(1 + 0.2 * Math.sin(t * 2));
    const perto = r.estado === 'ronda' && jog.some((j, i) => d.leva[i] < 0 && dist(j, r) <= R_ESPANTA);
    pecas.alcance.visible = r.estado === 'ronda' && d.fim === ''; pecas.alcance.position.set(r.x, 0.12, r.z); pecas.alcance.material.opacity = perto ? 0.55 : 0.2;

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'salvo') c.particulas(e.x, 1, e.z, 0x6bff9a, 22, 8);
      else if (e.tipo === 'salvoGrande') c.particulas(e.x, 1.5, e.z, 0xffd23f, 40, 11);
      else if (e.tipo === 'pegou') c.particulas(e.x, 1, e.z, 0xffffff, 10, 5);
      else if (e.tipo === 'levanta') c.particulas(e.x, 1.4, e.z, 0xffd23f, 24, 8);
      else if (e.tipo === 'caiu') c.particulas(e.x, 0.6, e.z, 0xb9a98c, 16, 6);
      else if (e.tipo === 'assusta') c.particulas(e.x, 1.6, e.z, 0xff8a3a, 20, 7);
      else if (e.tipo === 'espantou') c.particulas(e.x, 1.2, e.z, 0xffb13b, 26, 9);
      else if (e.tipo === 'sopro') c.particulas(e.x, 1.2, e.z, c.cores[e.i] ?? 0xffffff, 12, 6);
    }
  },
};
