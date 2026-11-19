// Torre da Horta (Festa: cooperativo, 2 a 4). Besouros chegam de todos os lados para roer a torre do meio. O empurrão (A) é uma onda
// de choque em volta de quem empurra: joga os besouros para longe e os deixa tontos; o segundo golpe derruba o besouro de vez.
// A torre tem vida: cada besouro que chega tira uma. Sobreviver 40 s é a vitória; torre sem vida é a derrota.
import { RAIO } from '../logica.mjs';

export const R_ARENA = 9.5, TEMPO = 40, TR = 1.3;          // raio da arena, duração e raio da torre
const V_ANDA = 7, V_RUSH = 13, T_RUSH = 0.35;
const R_ONDA = 4, KNOCK = 14, T_TONTO = 1.1;
const PRIMEIRO = 1.5, MAX_BICHOS = 44, R_SPAWN = R_ARENA - 0.6;
const ONDAS = [10, 20, 30];                                  // bandos de besouros vindos de um lado só

export const vidaDaTorre = n => 16 + 3 * n;
const intervalo = n => 1 / (0.25 + 0.17 * n);                 // segundos entre um besouro e outro

function novoBicho(p, d, ang) {
  const rapido = p.rng() < 0.2, a = ang + (p.rng() - 0.5) * 0.5;
  d.bichos.push({ x: Math.cos(a) * R_SPAWN, z: Math.sin(a) * R_SPAWN, kx: 0, kz: 0, hp: rapido ? 1 : 2, rapido, tonto: 0, fase: p.rng() * 6.28, ang: a + Math.PI });
}

function onda(p, d, n) {
  const lado = p.rng() * Math.PI * 2;
  for (let k = 0; k < 4 + n && d.bichos.length < MAX_BICHOS; k++) novoBicho(p, d, lado);
  d.aviso = 'BANDO DE BESOUROS!'; d.avisoCor = '#ffb13b'; d.avisoT = 1.4;
  p.eventos.push('troca');
}

// O empurrão de i: todo besouro perto leva um golpe, voa para longe e fica tonto.
function golpeia(p, d, i) {
  const j = p.jogadores[i];
  d.fx.push({ tipo: 'onda', x: j.x, z: j.z, i });
  for (const b of d.bichos) {
    const dx = b.x - j.x, dz = b.z - j.z, m = Math.hypot(dx, dz);
    if (m > R_ONDA) continue;
    const ux = m > 1e-6 ? dx / m : 1, uz = m > 1e-6 ? dz / m : 0;
    b.kx = ux * KNOCK; b.kz = uz * KNOCK; b.tonto = T_TONTO; b.hp--;
    if (b.hp <= 0) { d.derrubou[i]++; d.fx.push({ tipo: 'morreu', x: b.x, z: b.z, rapido: b.rapido }); p.eventos.push('explosao'); }
    else { d.fx.push({ tipo: 'acertou', x: b.x, z: b.z }); p.eventos.push('batida'); }
  }
  d.bichos = d.bichos.filter(b => b.hp > 0);
}

function andaBichos(p, d, dt) {
  const vel = 1.2 + 0.02 * p.t;
  for (const b of d.bichos) {
    b.tonto = Math.max(0, b.tonto - dt);
    b.x += b.kx * dt; b.z += b.kz * dt;
    const f = Math.pow(0.02, dt); b.kx *= f; b.kz *= f;
    if (b.tonto <= 0) {
      const m = Math.hypot(b.x, b.z) || 1, v = vel * (b.rapido ? 1.6 : 1);
      b.x -= b.x / m * v * dt; b.z -= b.z / m * v * dt; b.ang = Math.atan2(-b.z, -b.x);
    }
    const r = Math.hypot(b.x, b.z);
    if (r > R_ARENA - 0.3) { b.x *= (R_ARENA - 0.3) / r; b.z *= (R_ARENA - 0.3) / r; }          // não escapa da arena
  }
}

function roeTorre(p, d) {
  const chegaram = d.bichos.filter(b => Math.hypot(b.x, b.z) < TR + 0.55);
  if (!chegaram.length) return;
  for (const b of chegaram) d.fx.push({ tipo: 'roeu', x: b.x, z: b.z });
  d.torre = Math.max(0, d.torre - chegaram.length);
  d.tremor = 0.5; p.eventos.push('queda');
  d.bichos = d.bichos.filter(b => !chegaram.includes(b));
}

function textoDe(d, i) { return `Torre ${d.torre} de ${d.torreMax}. Você derrubou ${d.derrubou[i]}`; }

export default {
  id: 'defesa-coop', genero: 'empurra', nome: 'Torre da Horta', dica: 'Os besouros vêm roer a torre! Empurre com A para jogá-los longe e derrubá-los. Aguentem 40 segundos!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'EMPURRA', b: '' }, semPulo: true,
  rotulo: 'vida da torre', duracao: TEMPO,

  // câmera bem alta e fechada na torre: nada fica escondido atrás dela
  camera: () => ({ x: 0, y: 22, z: 10.5, ox: 0, oy: 0, oz: 0.4 }),

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    const n = p.jogadores.length, cada = f => p.jogadores.map((_, i) => f(i));
    p.jogadores.forEach((j, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; j.x = Math.cos(a) * 4; j.z = Math.sin(a) * 4; });
    p.dados = {
      placar: [vidaDaTorre(n)], inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0, fx: [], tremor: 0,
      torre: vidaDaTorre(n), torreMax: vidaDaTorre(n), bichos: [], proximo: PRIMEIRO, ondas: 0,
      derrubou: cada(() => 0), emp: cada(() => 0), rush: cada(() => 0),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.tremor = Math.max(0, d.tremor - dt);

    p.jogadores.forEach((j, i) => {
      if (j.empurroes > d.emp[i]) { d.emp[i] = j.empurroes; d.rush[i] = T_RUSH; golpeia(p, d, i); }
      d.rush[i] = Math.max(0, d.rush[i] - dt);
      const vmax = d.rush[i] > 0 ? V_RUSH : V_ANDA, v = Math.hypot(j.vx, j.vz);
      if (v > vmax) { j.vx *= vmax / v; j.vz *= vmax / v; }
      const m = Math.hypot(j.x, j.z), minimo = TR + RAIO;
      if (m < minimo) {                                // a torre é sólida
        const ux = m > 1e-6 ? j.x / m : 1, uz = m > 1e-6 ? j.z / m : 0;
        j.x = ux * minimo; j.z = uz * minimo;
        const para = j.vx * ux + j.vz * uz;
        if (para < 0) { j.vx -= para * ux; j.vz -= para * uz; }
      }
    });

    // chegada de besouros: um a um, e três bandos
    d.proximo -= dt;
    while (d.proximo <= 0) {
      d.proximo += intervalo(n);
      if (p.t >= PRIMEIRO && d.bichos.length < MAX_BICHOS) novoBicho(p, d, p.rng() * Math.PI * 2);
    }
    if (d.ondas < ONDAS.length && p.t >= ONDAS[d.ondas]) { d.ondas++; onda(p, d, n); }

    andaBichos(p, d, dt);
    roeTorre(p, d);

    d.placar = [d.torre];
    d.inventario = p.jogadores.map((_, i) => ['Derrubou ' + d.derrubou[i]]);
    p.jogadores.forEach((_, i) => { const texto = textoDe(d, i); if (p.celular[i].texto !== texto) p.celular[i] = { ...p.celular[i], texto }; });

    if (d.torre <= 0) { d.aviso = 'A TORRE CAIU...'; d.avisoCor = '#ff4a4a'; d.avisoT = 3; return -1; }
    if (p.t >= TEMPO) { d.aviso = 'AMANHECEU! A TORRE AGUENTOU'; d.avisoCor = '#6bff9a'; d.avisoT = 3; return 2; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0;
    // terra batida em volta da torre e as pedras da borda
    const terra = malha(new THREE.CylinderGeometry(R_ARENA - 0.2, R_ARENA - 0.2, 0.04, 40), 0x8b6b45, { roughness: 1 }); terra.position.y = 0.03; terra.castShadow = false; grupo.add(terra);
    const canteiro = malha(new THREE.CylinderGeometry(3, 3, 0.05, 32), 0x6f5236, { roughness: 1 }); canteiro.position.y = 0.06; canteiro.castShadow = false; grupo.add(canteiro);
    for (let k = 0; k < 18; k++) {
      const a = k * Math.PI * 2 / 18, pedra = malha(new THREE.DodecahedronGeometry(0.4, 0), 0x8a8f98, { roughness: 1 });
      pedra.position.set(Math.cos(a) * (R_ARENA - 0.25), 0.25, Math.sin(a) * (R_ARENA - 0.25)); pedra.castShadow = false; grupo.add(pedra);
    }
    // a torre: pedra, ameias e telhado vermelho (baixa, para não esconder ninguém)
    const torre = new THREE.Group();
    const corpo = malha(new THREE.CylinderGeometry(TR, TR + 0.15, 2.2, 18), 0xb5b9c2, { roughness: 0.9 }); corpo.position.y = 1.1;
    torre.add(corpo);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, m = malha(new THREE.BoxGeometry(0.5, 0.4, 0.4), 0x9ea3ad); m.position.set(Math.cos(a) * TR, 2.4, Math.sin(a) * TR); m.rotation.y = -a; torre.add(m); }
    const telhado = malha(new THREE.ConeGeometry(TR * 0.75, 1.2, 14), 0xc4372a, { roughness: 0.7 }); telhado.position.y = 3.0; torre.add(telhado);
    const mastro = malha(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), 0xe8e4d8); mastro.position.y = 4.0; torre.add(mastro);
    const bandeira = malha(new THREE.BoxGeometry(0.7, 0.4, 0.04), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.6 }); bandeira.position.set(0.4, 4.25, 0); bandeira.castShadow = false; torre.add(bandeira);
    grupo.add(torre); pecas.torre = torre;
    // a vida da torre: uma lâmpada por ponto em volta do pé dela
    const max = vidaDaTorre(c.bonecos.length);
    pecas.lampadas = Array.from({ length: max }, (_, k) => {
      const a = -Math.PI / 2 + k * Math.PI * 2 / max;
      const m = malha(new THREE.SphereGeometry(0.34, 12, 8), 0x6bff9a, { emissive: 0x6bff9a, emissiveIntensity: 1.2 });
      m.position.set(Math.cos(a) * (TR + 0.75), 0.4, Math.sin(a) * (TR + 0.75)); m.castShadow = false; grupo.add(m); return m;
    });
    // anel da onda de choque de cada jogador
    pecas.ondas = c.bonecos.map(() => { const m = malha(new THREE.TorusGeometry(1, 0.1, 6, 36), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }); m.rotation.x = Math.PI / 2; m.castShadow = false; m.visible = false; grupo.add(m); return m; });
    pecas.ondaT = c.bonecos.map(() => 9);
  },

  desenha(c, dt, t) {
    const { p, pecas, THREE } = c, d = p.dados;
    if (!pecas.torre) return;
    pecas.torre.position.x = d.tremor > 0 ? 0.08 * Math.sin(t * 60) : 0;
    pecas.lampadas.forEach((m, k) => {
      const viva = k < d.torre;
      m.material.color.set(viva ? (d.torre <= 4 ? 0xff5a3a : 0x6bff9a) : 0x2a2f38);
      m.material.emissive.set(viva ? (d.torre <= 4 ? 0xff5a3a : 0x6bff9a) : 0x000000);
    });
    const bichos = c.pool('bichos', d.bichos.length, () => {
      const g = new THREE.Group();
      const casco = c.malha(new THREE.SphereGeometry(0.55, 14, 10), 0x2f6b3a, { roughness: 0.5 }); casco.scale.set(1.25, 0.8, 1); casco.position.y = 0.5;
      const cabeca = c.malha(new THREE.SphereGeometry(0.3, 10, 8), 0xc9632a); cabeca.position.set(0.75, 0.45, 0);
      const olhos = c.malha(new THREE.BoxGeometry(0.1, 0.1, 0.4), 0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 1 }); olhos.position.set(0.98, 0.58, 0); olhos.castShadow = false;
      g.add(casco, cabeca, olhos);
      const pernas = [];
      for (const dz of [-1, 1]) for (const dx of [-0.4, 0, 0.4]) {
        const pe = c.malha(new THREE.BoxGeometry(0.1, 0.1, 0.7), 0x1b2a1e); pe.position.set(dx, 0.2, dz * 0.65); pe.castShadow = false; g.add(pe); pernas.push(pe);
      }
      g.scale.setScalar(1.35); g.userData = { casco, pernas };
      return g;
    });
    d.bichos.forEach((b, k) => {
      const g = bichos[k], u = g.userData;
      g.position.set(b.x, 0, b.z); g.rotation.y = -b.ang;
      u.casco.material.color.set(b.rapido ? 0xd6402a : b.hp < 2 ? 0x8a9b3a : 0x2f6b3a);
      u.casco.material.emissive.set(b.tonto > 0 ? 0x666666 : 0x000000);
      g.scale.setScalar(b.rapido ? 1.05 : 1.45);
      u.pernas.forEach((pe, m) => { pe.rotation.y = b.tonto > 0 ? 0 : 0.5 * Math.sin(t * 16 + b.fase + m * 2); });
      g.rotation.z = b.tonto > 0 ? 0.35 * Math.sin(t * 24 + b.fase) : 0;
    });
    // ondas de choque
    d.fx.slice(pecas.visto).forEach(e => {
      if (e.tipo === 'onda') { pecas.ondaT[e.i] = 0; pecas.ondas[e.i].position.set(e.x, 0.3, e.z); pecas.ondas[e.i].material.color.set(c.cores[e.i]); pecas.ondas[e.i].material.emissive.set(c.cores[e.i]); }
      else if (e.tipo === 'morreu') c.particulas(e.x, 0.8, e.z, e.rapido ? 0xd6402a : 0x8fd14f, 16, 8);
      else if (e.tipo === 'acertou') c.particulas(e.x, 0.8, e.z, 0xffffff, 8, 5);
      else if (e.tipo === 'roeu') c.particulas(e.x, 1, e.z, 0xff5a3a, 16, 7);
    });
    pecas.visto = d.fx.length;
    pecas.ondas.forEach((m, i) => {
      pecas.ondaT[i] += dt;
      const f = Math.min(1, pecas.ondaT[i] / 0.35);
      m.visible = f < 1; m.scale.setScalar(0.4 + R_ONDA * f); m.material.opacity = 0.85 * (1 - f);
    });
  },
};
