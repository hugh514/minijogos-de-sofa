// Noite dos Zumbis (Festa, cooperativo de 2 a 4 jogadores).
// Objetivo unico: aguentar ate o sol nascer. O sol anda numa faixa no alto da tela e o placar conta os segundos que faltam.
// Zumbis saem das covas e vao atras de quem esta em pe. Zumbi que encosta derruba o jogador.
// Uma acao so, o botao Luz: afasta e deixa tontos os zumbis perto. Se um amigo em pe esta perto, a luz dos dois destroi os zumbis.
// Quem caiu levanta quando um amigo encosta nele. Venceram se ainda houver alguem em pe quando o sol nascer; perdem se todos cairem.
import { posicionaRoda, quem, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 7.5;                 // meia largura e meia profundidade da arena
export const TEMPO = 40;
export const R_LUZ = 4.2, R_JUNTOS = 7, LIGA = 7.5;       // alcance da luz sozinho, alcance da luz em dupla, e distancia para contar como "juntos"
export const T_CARGA = 2, T_TONTO = 2.2, T_REVIVE = 1.2, R_REVIVE = 3.6, T_IMUNE = 3.5;
export const MAX_ZUMBIS = 18, ONDAS = [3, 10, 17, 24, 31], TAMANHO = [2, 3, 3, 4, 4];
const ZR = 0.55, CONTATO = ZR + RAIO - 0.3;     // raio do zumbi e distancia em que ele derruba
const R_SUSTO = 4.5, T_SUSTO_QUEDA = 3;
const V_ANDA = 7, T_NASCE = 1.6, T_MORRE = 0.45;
export const COVAS = [[-6.5, -6.3], [6.5, -6.3], [-6.5, 6.3], [6.5, 6.3], [-10, -2.4], [-10, 2.4], [10, -2.4], [10, 2.4]].map(([x, z]) => ({ x, z }));
export const MODELOS = ['graveyard-kit/fence', 'graveyard-kit/pine', 'graveyard-kit/pine-crooked', 'graveyard-kit/gravestone-cross',
  'graveyard-kit/gravestone-round', 'graveyard-kit/gravestone-broken', 'graveyard-kit/pumpkin', 'graveyard-kit/crypt-small'];

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);

// Quanto a dificuldade cresce com o numero de jogadores e com a noite (0 a 4).
export const escala = (n, noite) => (0.4 + 0.4 * (n - 2)) * (1 + 0.3 * noite);
export const velocidade = (noite, onda) => 1.5 + 0.25 * noite + 0.06 * onda;

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

function novoZumbi(p, d) {
  let melhor = -1, cova = 0;
  for (let n = 0; n < 6; n++) {                  // sai da cova mais longe de quem esta em pe (entre seis sorteadas)
    const k = Math.floor(p.rng() * COVAS.length);
    let perto = Infinity;
    p.jogadores.forEach((j, i) => { if (!d.caido[i]) perto = Math.min(perto, dist(j, COVAS[k])); });
    if (perto > melhor) { melhor = perto; cova = k; }
  }
  const c = COVAS[cova];
  d.covaT[cova] = T_NASCE; d.fx.push({ tipo: 'nasceu', x: c.x, z: c.z });
  return { x: c.x, z: c.z, kx: 0, kz: 0, ang: Math.atan2(-c.z, -c.x), v: velocidade(noiteDe(p), d.onda) + p.rng() * 0.4, atord: 0, pausa: 0, nasce: T_NASCE, morre: 0, re: 0, fase: p.rng() * 6.28, alvo: -1 };
}

// Quantos amigos em pe estao perto o bastante para a luz ser em dupla.
const parceiroPerto = (p, d, i) => p.jogadores.some((q, k) => k !== i && !d.caido[k] && dist(q, p.jogadores[i]) <= LIGA);
const emPe = d => d.caido.filter(c => !c).length;

// Susto: os zumbis colados em j tropecam para longe e ficam tontos um instante (quando alguem cai ou levanta).
function susto(d, j, tonto) {
  for (const z of d.zumbis) {
    const dx = z.x - j.x, dz = z.z - j.z, m = Math.hypot(dx, dz) || 1;
    if (m > R_SUSTO) continue;
    z.atord = Math.max(z.atord, tonto); z.kx = dx / m * 8; z.kz = dz / m * 8;
  }
}

function aterra(p, d, i) {                       // o zumbi pegou: o jogador cai
  const j = p.jogadores[i];
  d.caido[i] = true; d.rev[i] = 0; d.pos[i] = { x: j.x, z: j.z }; j.vx = j.vz = 0; d.quedas++;
  vibra(p, i); p.eventos.push('queda');
  d.fx.push({ tipo: 'caiu', x: j.x, z: j.z });
  susto(d, j, T_SUSTO_QUEDA);
  const sobra = emPe(d);
  if (sobra === 1) aviso(d, 'Só sobrou ' + quem(p, d.caido.indexOf(false)) + '! Salvem os amigos!', '#ff4a4a', 2.4);
  else if (sobra > 1) aviso(d, quem(p, i) + ' caiu! Encoste nele.', '#ff4a4a', 2.4);
}

function levanta(p, d, i) {
  const j = p.jogadores[i];
  d.caido[i] = false; d.rev[i] = 0; d.imune[i] = T_IMUNE; d.carga[i] = 1; d.salvos++;
  susto(d, j, 1.5);                              // o susto afasta os zumbis colados
  d.fx.push({ tipo: 'reviveu', x: j.x, z: j.z });
  p.eventos.push('troca');
  aviso(d, quem(p, i) + ' levantou!', '#6bff9a', 1.6);
}

// O botao Luz de i: sozinho afasta e deixa tontos; com um amigo em pe perto, destroi os zumbis.
function luz(p, d, i) {
  const j = p.jogadores[i], juntos = parceiroPerto(p, d, i), raio = juntos ? R_JUNTOS : R_LUZ;
  d.carga[i] = 0; d.pulsos.push({ x: j.x, z: j.z, idade: 0, juntos });
  let pegou = 0;
  for (const z of d.zumbis) {
    if (z.nasce > 0 || z.morre > 0) continue;
    const dx = z.x - j.x, dz = z.z - j.z, m = Math.hypot(dx, dz);
    if (m > raio) continue;
    pegou++;
    if (juntos) { z.morre = T_MORRE; d.destruidos++; d.fx.push({ tipo: 'po', x: z.x, z: z.z }); }
    else { z.atord = T_TONTO; const n = m || 1; z.kx = dx / n * 10; z.kz = dz / n * 10; }
  }
  p.eventos.push(juntos ? 'explosao' : 'batida');
  d.fx.push({ tipo: juntos ? 'luzDupla' : 'luz', x: j.x, z: j.z });
  if (juntos && pegou && d.t < d.semAvisoLuz) return;
  if (juntos && pegou) { aviso(d, 'Luz em dupla! Zumbis destruídos!', '#ffd23f', 1.4); d.semAvisoLuz = d.t + 4; }
}

// Passo de um zumbi: persegue, balanca, recebe empurrao e nunca sai da arena.
function andaZumbi(z, dt, alvo) {
  z.x += z.kx * dt; z.z += z.kz * dt;
  const f = Math.pow(0.02, dt); z.kx *= f; z.kz *= f;
  if (alvo && z.atord <= 0 && z.pausa <= 0) {
    const dx = alvo.x - z.x, dz = alvo.z - z.z, m = Math.hypot(dx, dz);
    if (m > 1e-6) {
      let da = Math.atan2(dz, dx) - z.ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      z.ang += limita(da, -4 * dt, 4 * dt);
      const v = z.v * (0.6 + 0.4 * Math.max(0, Math.cos(da)));      // vira devagar e anda enquanto vira
      z.x += Math.cos(z.ang) * v * dt; z.z += Math.sin(z.ang) * v * dt;
    }
  }
  z.x = limita(z.x, -LX + ZR, LX - ZR); z.z = limita(z.z, -LZ + ZR, LZ - ZR);
}

// O texto de cada celular: o que fazer agora.
function textoDe(p, d, i) {
  const j = p.jogadores[i];
  if (d.caido[i]) return 'Você caiu! Um amigo precisa encostar em você.';
  let achado = -1, melhor = Infinity;
  p.jogadores.forEach((q, k) => { if (d.caido[k] && dist(q, j) < melhor) { melhor = dist(q, j); achado = k; } });
  if (achado >= 0) return 'Corra até ' + quem(p, achado) + ' e encoste para levantar.';
  const zumbiPerto = d.zumbis.some(z => z.nasce <= 0 && z.morre <= 0 && z.atord <= 0 && dist(z, j) < R_LUZ + 1.5);
  if (zumbiPerto) return d.carga[i] >= 1 ? 'Zumbi perto! Aperte Luz.' : 'Fuja! A luz está recarregando.';
  if (p.jogadores.length > 1 && !parceiroPerto(p, d, i)) return 'Fiquem juntos: a luz de dois destrói os zumbis.';
  return 'Juntos! Aguente até o sol nascer.';
}

export default {
  id: 'zumbis-coop', genero: 'reflexo', nome: 'Noite dos Zumbis',
  dica: 'Aguentem até o sol nascer: a luz afasta os zumbis, e juntos ela os destrói!',
  semMod: ['espelho', 'foguete'],       // o raio da luz some com o espelho e o teto de velocidade anula o foguete
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Luz', b: '' }, semMovimento: false, semDash: true, semPulo: true, semNome: true,   // os bonecos se juntam para a luz dupla e para levantar: o nome cobria os zumbis; o disco da cor de cada um ja diz quem e
  rotulo: 'o sol nasce em', sufixo: 's', duracao: TEMPO, modelos: MODELOS,

  // camera alta: a arena inteira, os quatro cantos e a faixa do sol cabem
  camera: () => ({ x: 0, y: 20, z: 10.5, ox: 0, oy: 0, oz: 0.3 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaRoda(p, 4.2);
    const cada = f => p.jogadores.map((_, i) => f(i));       // um valor por jogador
    p.dados = {
      placar: [TEMPO], t: 0, onda: 0, aviso: 'Aguentem até o sol nascer!', avisoCor: '#ffd23f', avisoT: 3, semAvisoLuz: 0, avisou10: false,
      zumbis: [], fx: [], pulsos: [], covaT: COVAS.map(() => 0), fim: '', quedas: 0, salvos: 0, destruidos: 0,
      caido: cada(() => false), pos: cada(() => ({ x: 0, z: 0 })), rev: cada(() => 0), imune: cada(() => 0), carga: cada(() => 1),
      inventario: cada(() => ['Luz pronta']), texto: cada(() => ''), rotA: cada(() => ''),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    d.t = p.t;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.covaT = d.covaT.map(v => Math.max(0, v - dt));

    // ----- jogadores -----
    js.forEach((j, i) => {
      d.imune[i] = Math.max(0, d.imune[i] - dt);
      if (d.caido[i]) { j.x = d.pos[i].x; j.z = d.pos[i].z; j.vx = j.vz = 0; return; }
      d.carga[i] = Math.min(1, d.carga[i] + dt / T_CARGA);
      const v = Math.hypot(j.vx, j.vz);
      if (v > V_ANDA) { j.vx *= V_ANDA / v; j.vz *= V_ANDA / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
    });

    // ----- ondas de zumbis -----
    if (d.onda < ONDAS.length && p.t >= ONDAS[d.onda]) {
      const n = Math.min(Math.max(1, Math.round(TAMANHO[d.onda] * escala(js.length, noiteDe(p)))), MAX_ZUMBIS - d.zumbis.length);
      for (let k = 0; k < n; k++) d.zumbis.push(novoZumbi(p, d));
      d.onda++;
      if (d.onda === 1) aviso(d, 'Zumbis saindo das covas! Aperte Luz.', '#ffd23f', 2.4);
      else aviso(d, d.onda === ONDAS.length ? 'Última leva de zumbis!' : 'Mais zumbis chegando!', '#ffb13b', 1.6);
      p.eventos.push('troca');
    }
    if (!d.avisou10 && p.t >= TEMPO - 10) { d.avisou10 = true; aviso(d, 'Faltam 10 segundos para o sol nascer!', '#ffd23f', 2.2); }

    // ----- a luz de cada um -----
    js.forEach((j, i) => { if (!d.caido[i] && j.apertouA > 0 && d.carga[i] >= 1) luz(p, d, i); });
    for (const pu of d.pulsos) pu.idade += dt;
    d.pulsos = d.pulsos.filter(pu => pu.idade < 0.7);

    // ----- reviver: amigo em pe encostado no caido; dois amigos levantam mais rapido -----
    js.forEach((q, k) => {
      if (!d.caido[k]) return;
      const ajudantes = js.filter((a, i) => i !== k && !d.caido[i] && dist(a, q) < R_REVIVE).length;
      d.rev[k] = ajudantes ? d.rev[k] + dt * ajudantes : Math.max(0, d.rev[k] - dt * 0.5);
      if (d.rev[k] >= T_REVIVE) levanta(p, d, k);
    });

    // ----- zumbis -----
    const zs = d.zumbis;
    for (const z of zs) {
      z.re -= dt; z.atord -= dt; z.pausa -= dt;
      if (z.nasce > 0) { z.nasce -= dt; continue; }              // saindo da terra: nao faz nada
      if (z.morre > 0) { z.morre -= dt; if (z.morre <= 0) z.morreu = true; continue; }
      if (z.re <= 0 || z.alvo < 0 || d.caido[z.alvo]) {          // escolhe o jogador em pe mais perto
        let bi = -1, bm = Infinity;
        js.forEach((j, i) => { const m = dist(j, z); if (!d.caido[i] && m < bm) { bm = m; bi = i; } });
        z.alvo = bi; z.re = 0.4;
      }
      andaZumbi(z, dt, z.alvo >= 0 ? js[z.alvo] : null);
    }
    d.zumbis = zs.filter(z => !z.morreu);
    const vivos = d.zumbis;
    for (let a = 0; a < vivos.length; a++)             // zumbis nao se empilham
      for (let b = a + 1; b < vivos.length; b++) {
        const dx = vivos[b].x - vivos[a].x, dz = vivos[b].z - vivos[a].z, q = dx * dx + dz * dz, lim = ZR * 1.6;
        if (q >= lim * lim) continue;
        const m = Math.sqrt(q), n = m || 1, s = (lim - m) / 2, ux = m ? dx / n : 1, uz = m ? dz / n : 0;
        vivos[a].x -= ux * s; vivos[a].z -= uz * s; vivos[b].x += ux * s; vivos[b].z += uz * s;
      }
    for (const z of vivos) { z.x = limita(z.x, -LX + ZR, LX - ZR); z.z = limita(z.z, -LZ + ZR, LZ - ZR); }      // o empurrao entre zumbis nao tira ninguem da arena

    // ----- zumbi encosta no jogador -----
    for (const z of vivos) {
      if (z.atord > 0 || z.pausa > 0 || z.nasce > 0 || z.morre > 0) continue;
      for (const [i, j] of js.entries()) {
        if (d.caido[i] || (j.x - z.x) ** 2 + (j.z - z.z) ** 2 > CONTATO * CONTATO) continue;
        if (d.imune[i] > 0) { z.kx = (z.x - j.x) * 6; z.kz = (z.z - j.z) * 6; continue; }
        aterra(p, d, i); z.pausa = 1.2;
      }
    }

    // ----- placar e celulares: o que fazer agora -----
    d.placar = [Math.max(0, Math.ceil(TEMPO - p.t))];
    js.forEach((j, i) => {
      const a = d.caido[i] ? '' : d.carga[i] >= 1 ? 'Luz' : 'Carregando', texto = textoDe(p, d, i);
      d.inventario[i] = [d.caido[i] ? 'Caído' : d.carga[i] >= 1 ? 'Luz pronta' : 'Luz recarregando'];
      if (a !== d.rotA[i] || texto !== d.texto[i]) { d.rotA[i] = a; d.texto[i] = texto; p.celular[i] = { ...p.celular[i], a, texto }; }
    });

    // ----- fim -----
    if (d.caido.every(Boolean)) {
      d.fim = 'noite'; aviso(d, 'Todos caíram. Os zumbis venceram a noite.', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], a: '', texto: 'Todos caíram. Os zumbis venceram. Na próxima, fiquem juntos.' }; });
      return -1;
    }
    if (p.t >= TEMPO) {
      d.fim = 'dia'; aviso(d, 'O sol nasceu! Vocês venceram a noite!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], a: '', texto: 'O sol nasceu! Vocês aguentaram a noite juntos!' }; });
      return 2;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0;

    // gramado escuro e uma camada quente que aparece conforme o sol se aproxima
    const grama = sem(malha(caixa(LX * 2, 0.04, LZ * 2), 0x1f4030, { roughness: 1 })); grama.position.y = 0.02; grupo.add(grama);
    pecas.alvorada = sem(malha(caixa(LX * 2, 0.02, LZ * 2), 0xffb347, { emissive: 0xffa030, emissiveIntensity: 0.5, transparent: true, opacity: 0, depthWrite: false }));
    pecas.alvorada.position.y = 0.06; grupo.add(pecas.alvorada);

    // covas: de onde os zumbis saem; brilham de verde quando um esta saindo
    pecas.covas = COVAS.map(cv => {
      const monte = sem(malha(new THREE.SphereGeometry(0.95, 14, 8), 0x4a3524, { roughness: 1 })); monte.scale.set(1, 0.3, 1); monte.position.set(cv.x, 0.05, cv.z); grupo.add(monte);
      const lapide = malha(caixa(0.7, 0.9, 0.18), 0x9a9aa8, { roughness: 0.9 }); lapide.position.set(cv.x, 0.5, cv.z + (cv.z > 0 ? 0.9 : -0.9)); grupo.add(lapide);
      const brilho = sem(malha(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 20), 0x7dff6a, { emissive: 0x7dff6a, emissiveIntensity: 1, transparent: true, opacity: 0.5 }));
      brilho.position.set(cv.x, 0.09, cv.z); brilho.visible = false; grupo.add(brilho);
      return brilho;
    });

    // faixa do sol, no alto da arena: a lua anda da esquerda ate o sol parado na direita
    const x0 = -6.6, x1 = 6.6, zf = -LZ - 0.55;
    const trilha = sem(malha(caixa(x1 - x0, 0.2, 0.34), 0x2a3350, { emissive: 0x1a2240, emissiveIntensity: 0.6 })); trilha.position.set(0, 1.7, zf); grupo.add(trilha);
    pecas.preench = sem(malha(caixa(1, 0.24, 0.38), 0xffc531, { emissive: 0xffa800, emissiveIntensity: 0.8 })); pecas.preench.position.set(x0, 1.7, zf); grupo.add(pecas.preench);
    const solFim = sem(malha(new THREE.SphereGeometry(0.55, 14, 10), 0xffc531, { emissive: 0xff9a00, emissiveIntensity: 0.9 })); solFim.position.set(x1 + 0.9, 1.7, zf); grupo.add(solFim);
    pecas.astro = sem(malha(new THREE.SphereGeometry(0.8, 18, 12), 0xdfe6ff, { emissive: 0xb8c4ff, emissiveIntensity: 1 })); pecas.astro.position.set(x0, 1.7, zf); grupo.add(pecas.astro);
    pecas.faixa = { x0, x1 };

    // vila em volta (enfeite fora da arena), so com os modelos que chegaram
    const poe = (nome, x, z, op, giro = 0) => { const m = c.modelo(nome, op); if (!m) return; m.position.set(x, 0, z); m.rotation.y = giro; grupo.add(m); };
    for (let x = -LX + 1; x < LX; x += 2) poe('graveyard-kit/fence', x, LZ + 0.9, { escala: 2 });
    for (let z = -LZ + 1; z < LZ; z += 2) for (const lado of [-1, 1]) poe('graveyard-kit/fence', lado * (LX + 0.9), z, { escala: 2 }, Math.PI / 2);
    [[-10, -LZ - 3.4, 4, 0], [-4, -LZ - 3.8, 3.4, 1], [3, -LZ - 3.5, 4.2, 2], [9.5, -LZ - 3.4, 4.4, 3], [-LX - 2.2, -2, 3.8, 5], [LX + 2.2, -3, 3.6, 6], [LX + 2.4, 3.6, 4, 7], [-LX - 2.4, 4, 3.4, 8]]
      .forEach(([x, z, altura, k]) => poe(k % 2 ? 'graveyard-kit/pine-crooked' : 'graveyard-kit/pine', x, z, { altura }, k * 1.3));
    poe('graveyard-kit/crypt-small', 13.5, -LZ - 3, { altura: 3.6 }, -0.5);
    poe('graveyard-kit/pumpkin', -LX - 1.5, LZ + 1.4, { altura: 0.9 });

    // por jogador: alcance da luz (circulo fino), carga (disco embaixo do boneco), setinha e aneis de quem caiu
    pecas.jog = [...c.bonecos.keys()].map(i => {
      const cor = c.cores[i];
      const alcance = sem(malha(new THREE.RingGeometry(R_LUZ - 0.1, R_LUZ, 48), cor, { emissive: cor, emissiveIntensity: 0.8, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })); alcance.rotation.x = -Math.PI / 2;
      const carga = sem(malha(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 28), cor, { emissive: cor, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }));
      const anel = sem(malha(new THREE.CylinderGeometry(1.5, 1.5, 0.05, 28), 0xff4a4a, { emissive: 0xff4a4a, emissiveIntensity: 0.9, transparent: true, opacity: 0.55 }));
      const prog = sem(malha(new THREE.CylinderGeometry(1.4, 1.4, 0.07, 28), 0x6bff9a, { emissive: 0x6bff9a, emissiveIntensity: 0.9 }));
      const seta = sem(malha(new THREE.ConeGeometry(0.5, 1, 10), 0xff4a4a, { emissive: 0xff4a4a, emissiveIntensity: 1 })); seta.rotation.x = Math.PI;
      for (const m of [alcance, carga, anel, prog, seta]) { m.visible = false; grupo.add(m); }
      return { alcance, carga, anel, prog, seta };
    });
    pecas.geo = { braco: caixa(0.95, 0.2, 0.2), perna: caixa(0.28, 0.8, 0.3), tronco: caixa(0.55, 0.95, 0.85), cabeca: new THREE.SphereGeometry(0.34, 12, 10), olho: caixa(0.08, 0.1, 0.1), estrela: new THREE.TorusGeometry(0.4, 0.06, 6, 14) };
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c, g = pecas.geo;
    if (!g) return;
    const fimDia = d.fim === 'dia';
    if (p.fase === 'jogando') pecas.f = limita(p.t / TEMPO, 0, 1);       // ao fechar a rodada p.t volta a zero: o relogio guarda onde parou
    const f = fimDia ? 1 : pecas.f ?? 0;
    if (fimDia) pecas.tDia ??= t;

    // relogio: bola e barra andam da lua ao sol, e o chao esquenta perto do fim
    const { x0, x1 } = pecas.faixa, ax = x0 + (x1 - x0) * f;
    pecas.astro.position.x = ax; pecas.preench.scale.x = Math.max(0.001, ax - x0); pecas.preench.position.x = x0 + (ax - x0) / 2;
    const sol = limita((f - 0.55) / 0.4, 0, 1);
    pecas.astro.material.color.setRGB(0.87 + 0.13 * sol, 0.9 - 0.2 * sol, 1 - 0.8 * sol);
    pecas.astro.material.emissive.setRGB(0.72 + 0.28 * sol, 0.77 - 0.23 * sol, 1 - 0.9 * sol);
    pecas.astro.scale.setScalar(1 + 0.4 * sol + (fimDia ? 0.3 * Math.sin(t * 8) : 0));
    pecas.alvorada.material.opacity = 0.32 * sol * sol;
    d.covaT.forEach((v, k) => { pecas.covas[k].visible = v > 0; });

    // zumbis: verdes, de braco esticado, bamboleando
    const grupos = c.pool('zumbis', d.zumbis.length, () => {
      const o = new THREE.Group(), pele = 0x9be06a, camisa = 0x6b4f3a, calca = 0x3f4560;
      const perna = (z) => { const h = new THREE.Group(); h.position.set(0, 0.8, z); const m = c.malha(g.perna, calca); m.position.y = -0.4; h.add(m); return h; };
      const pE = perna(0.2), pD = perna(-0.2);
      const corpo = new THREE.Group(); corpo.position.y = 0.8;
      const tronco = c.malha(g.tronco, camisa, { roughness: 0.95 }); tronco.position.y = 0.48;
      const rasgo = c.malha(new THREE.BoxGeometry(0.58, 0.18, 0.5), 0x8c3a3a); rasgo.position.set(0.02, 0.3, 0); rasgo.castShadow = false;
      const cabeca = c.malha(g.cabeca, pele, { roughness: 0.8, emissive: 0x1d3a10, emissiveIntensity: 0.6 }); cabeca.position.set(0.12, 1.32, 0); cabeca.scale.set(1.05, 1.15, 1);
      const olhos = [0.1, -0.1].map(z => { const m = c.malha(g.olho, 0xffe14a, { emissive: 0xffd000, emissiveIntensity: 1.2 }); m.position.set(0.42, 1.38, z); m.castShadow = false; return m; });
      const boca = c.malha(new THREE.BoxGeometry(0.06, 0.07, 0.24), 0x2a1010); boca.position.set(0.44, 1.2, 0); boca.castShadow = false;
      const braco = (z) => { const h = new THREE.Group(); h.position.set(0.08, 0.92, z); const m = c.malha(g.braco, pele, { emissive: 0x1d3a10, emissiveIntensity: 0.5 }); m.position.x = 0.48; m.castShadow = false; h.add(m); return h; };
      const bE = braco(0.52), bD = braco(-0.52);
      const estrelas = new THREE.Group(); estrelas.position.set(0.1, 2.05, 0);
      const anel = c.malha(g.estrela, 0xffe14a, { emissive: 0xffd000, emissiveIntensity: 1.2 }); anel.rotation.x = Math.PI / 2; anel.castShadow = false; estrelas.add(anel); estrelas.visible = false;
      corpo.add(tronco, rasgo, cabeca, ...olhos, boca, bE, bD);
      o.add(pE, pD, corpo, estrelas); o.scale.setScalar(1.7);
      o.userData = { pE, pD, corpo, bE, bD, cabeca, estrelas };
      return o;
    });
    d.zumbis.forEach((z, n) => {
      const o = grupos[n], u = o.userData, tonto = z.atord > 0, nasce = z.nasce > 0, morre = z.morre > 0 || fimDia;
      const ba = Math.sin(t * 5 + z.fase), andando = !tonto && !nasce && !morre;
      o.position.set(z.x, nasce ? -4.2 * (z.nasce / T_NASCE) : 0, z.z); o.rotation.y = -z.ang;
      o.rotation.x = andando ? 0.07 * Math.sin(t * 2.5 + z.fase) : 0;           // balanca de um lado para o outro
      u.pE.rotation.z = andando ? 0.55 * ba : 0; u.pD.rotation.z = andando ? -0.55 * ba : 0;
      u.corpo.rotation.z = tonto ? 0.35 : -0.14 + 0.05 * ba;                       // inclinado para frente; tonto, para tras
      u.cabeca.rotation.z = tonto ? -0.5 : 0.12 * Math.sin(t * 3 + z.fase);
      u.bE.rotation.z = tonto ? -1.1 : 0.12 + 0.1 * ba; u.bD.rotation.z = tonto ? -1.1 : 0.12 - 0.1 * ba;       // bracos esticados na frente
      u.estrelas.visible = tonto; u.estrelas.rotation.y = t * 6;
      u.cabeca.material.color.set(tonto ? 0xd8f0c0 : 0x9be06a);
      o.scale.setScalar(1.7 * (z.morre > 0 ? Math.max(0.02, z.morre / T_MORRE) : fimDia ? Math.max(0.02, 1 - 2 * (t - pecas.tDia)) : 1));
    });

    // jogadores: alcance da luz, carga, ligacao entre amigos, caido deitado com anel e seta
    p.jogadores.forEach((j, i) => {
      const m = pecas.jog[i], caido = d.caido[i];
      c.bonecos[i].rotation.z = caido ? Math.PI / 2 : 0;
      if (!caido) c.bonecos[i].visible = d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;
      m.alcance.visible = !caido; m.alcance.position.set(j.x, 0.1, j.z); m.alcance.material.opacity = d.carga[i] >= 1 ? 0.55 : 0.15;
      m.carga.visible = !caido; m.carga.position.set(j.x, 0.08, j.z); m.carga.scale.set(0.25 + 0.75 * d.carga[i], 1, 0.25 + 0.75 * d.carga[i]); m.carga.material.opacity = d.carga[i] >= 1 ? 0.85 : 0.35;
      m.anel.visible = m.seta.visible = caido; m.prog.visible = caido && d.rev[i] > 0.02;
      if (caido) {
        m.anel.position.set(j.x, 0.08, j.z); m.anel.scale.setScalar(1 + 0.12 * Math.sin(t * 8));
        m.prog.position.set(j.x, 0.1, j.z); m.prog.scale.setScalar(Math.max(0.05, Math.min(1, d.rev[i] / T_REVIVE)));
        m.seta.position.set(j.x, 3.4 + 0.35 * Math.sin(t * 6), j.z);
      }
    });
    const pares = [];
    p.jogadores.forEach((a, i) => p.jogadores.forEach((b, k) => { if (k > i && !d.caido[i] && !d.caido[k] && dist(a, b) <= LIGA) pares.push([a, b]); }));
    const elos = c.pool('elos', pares.length, () => c.malha(new THREE.BoxGeometry(1, 0.14, 0.14), 0xffe27a, { emissive: 0xffc531, emissiveIntensity: 1.2 }));
    pares.forEach(([a, b], n) => {
      const e = elos[n], len = Math.max(0.01, dist(a, b));
      e.position.set((a.x + b.x) / 2, 0.55, (a.z + b.z) / 2); e.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      e.scale.set(len, 1 + 0.4 * Math.sin(t * 9), 1 + 0.4 * Math.sin(t * 9)); e.castShadow = false;
    });

    // pulso da luz: branco e pequeno sozinho; dourado e grande em dupla
    const pulsos = c.pool('pulsos', d.pulsos.length, () => c.malha(new THREE.CylinderGeometry(1, 1, 0.06, 40), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    d.pulsos.forEach((pu, n) => {
      const k = Math.min(1, pu.idade / 0.45), m = pulsos[n], r = (pu.juntos ? R_JUNTOS : R_LUZ) * k + 0.1;
      m.position.set(pu.x, 0.25, pu.z); m.scale.set(r, 1, r); m.castShadow = false;
      m.material.color.set(pu.juntos ? 0xffd23f : 0xfff6d0); m.material.emissive.set(pu.juntos ? 0xffa800 : 0xfff0b0); m.material.opacity = (pu.juntos ? 0.5 : 0.35) * (1 - k);
    });

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'caiu') c.particulas(e.x, 1, e.z, 0xff4a4a, 24, 8);
      else if (e.tipo === 'reviveu') c.particulas(e.x, 1, e.z, 0x6bff9a, 26, 8);
      else if (e.tipo === 'luz') c.particulas(e.x, 1, e.z, 0xfff2b0, 16, 7);
      else if (e.tipo === 'luzDupla') c.particulas(e.x, 1, e.z, 0xffc531, 30, 11);
      else if (e.tipo === 'po') c.particulas(e.x, 1.3, e.z, 0x9be06a, 18, 7);
      else if (e.tipo === 'nasceu') c.particulas(e.x, 0.3, e.z, 0x5a4030, 14, 4);
    }
  },
};
