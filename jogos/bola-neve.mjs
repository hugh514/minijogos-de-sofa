// Guerra de neve: segure o botao e ande para rolar uma bola que cresce (e te deixa lento); solte para lancar.
// Bola acertando o rival empurra e marca; a bola maior vale 2. Bola contra bola: a maior vence e sobra o que for da diferenca.
import { quem } from '../logica.mjs';

const LX = 11, LZ = 6.5, RAIO_J = 0.8;
const R0 = 0.7, RMAX = 2.0, R_BOLONA = 1.4, R_MIN = 0.45, CRESCE = 0.06;
const V_MIN = 2.2, ATRITO_BOLA = 0.35, QUIQUE = 0.8, V_PARADO = 1.5;
const META = 7, LIMITE = 45, T_MORTE = 15, T_TONTO = 0.5, T_RECARGA = 0.3, MAX_LIVRES = 3;

const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
const velLanca = r => 16 - (r - R0) * 4;           // bola pequena sai rapida, bola grande sai pesada

// Duas bolas se encontram: a maior fica com a diferenca de area, a menor desfaz. Sobrou muito pouco, as duas somem.
function choque(a, b) {
  const A = a.r * a.r, B = b.r * b.r, menor = A < B ? a : b, maior = A < B ? b : a;
  menor.vivo = false;
  const r = Math.sqrt(Math.abs(A - B));
  if (r < R_MIN) maior.vivo = false; else maior.r = r;
}

function fxPush(d, tipo, x, z, extra = {}) { d.fx.push({ tipo, x, z, ...extra }); }

export default {
  id: 'bola-neve', genero: 'empurra', nome: 'Guerra de neve', dica: 'Segure Rolar e ande: a bola cresce. Solte para lançar e empurrar o rival!',
  controle: { modo: 'padrao', a: 'Rolar', b: '' }, semDash: true, semPulo: true, rotulo: 'acertos', duracao: LIMITE, tema: 2,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    p.jogadores[0].x = -7; p.jogadores[1].x = 7;
    p.jogadores.forEach(j => { j.z = 0; });
    p.dados = {
      placar: [0, 0], bolas: [], preso: [null, null], face: [{ x: 1, z: 0 }, { x: -1, z: 0 }],
      tonto: [0, 0], recarga: [0, 0], fx: [], aviso: '', avisoT: 0, morte: false, textos: ['', ''],
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0 && !d.morte) d.aviso = ''; }

    p.jogadores.forEach((j, i) => cuidaDaBola(p, d, j, i, dt));
    for (const b of d.bolas) if (!b.preso) voa(p, d, b, dt);
    encontros(d);
    for (const b of d.bolas) if (b.vivo && !b.preso) tentaAcertar(p, d, b);
    d.bolas = d.bolas.filter(b => {
      if (b.vivo) return true;
      if (b.preso) d.preso[b.dono] = null;
      return false;
    });
    p.jogadores.forEach((_, i) => { if (d.preso[i] && !d.bolas.includes(d.preso[i])) d.preso[i] = null; });

    atualizaCelulares(p, d);
    const [a, b] = d.placar;
    if (a >= META || b >= META) return fim(p, d, a > b ? 0 : 1);
    if (p.t >= LIMITE) {
      if (a !== b) return fim(p, d, a > b ? 0 : 1);
      if (!d.morte) { d.morte = true; d.aviso = 'Morte súbita!'; d.avisoCor = '#ffd23f'; p.eventos.push('troca'); }
      if (p.t >= LIMITE + T_MORTE) return fim(p, d, -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0;
    const neve = malha(new THREE.BoxGeometry(LX * 2, 0.04, LZ * 2), 0x8fbfe0, { roughness: 0.5, emissive: 0x1d3f66, emissiveIntensity: 0.45 });
    neve.position.y = 0.02; neve.castShadow = false; grupo.add(neve);
    for (const i of [0, 1]) {              // cada metade com a cor do dono
      const lado = i ? 1 : -1;
      const tinta = malha(new THREE.BoxGeometry(LX, 0.02, LZ * 2), cores[i], { transparent: true, opacity: 0.18 });
      tinta.position.set(lado * LX / 2, 0.05, 0); tinta.castShadow = false; grupo.add(tinta);
    }
    const meio = malha(new THREE.BoxGeometry(0.16, 0.02, LZ * 2), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 });
    meio.position.y = 0.06; meio.castShadow = false; grupo.add(meio);

    // muretas de neve em volta, baixas para nao esconder ninguem
    for (let x = -LX; x <= LX; x += 2.2) for (const z of [-LZ - 0.3, LZ + 0.3]) {
      const m = malha(new THREE.SphereGeometry(0.9, 10, 8), 0xf2f8ff, { roughness: 0.9 });
      m.scale.set(1.2, 0.55, 0.8); m.position.set(x, 0.2, z); grupo.add(m);
    }
    for (let z = -LZ; z <= LZ; z += 2.2) for (const x of [-LX - 0.3, LX + 0.3]) {
      const m = malha(new THREE.SphereGeometry(0.9, 10, 8), 0xf2f8ff, { roughness: 0.9 });
      m.scale.set(0.8, 0.55, 1.2); m.position.set(x, 0.2, z); grupo.add(m);
    }

    // setas de mira na cor de cada jogador
    pecas.setas = [0, 1].map(i => {
      const g = new THREE.Group();
      const geo = new THREE.ConeGeometry(0.45, 1.1, 3); geo.rotateZ(-Math.PI / 2);
      const m = malha(geo, cores[i], { emissive: cores[i], emissiveIntensity: 0.7 }); m.castShadow = false; m.position.y = 0.12;
      g.add(m); grupo.add(g); return g;
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { THREE, pecas } = c;

    p.jogadores.forEach((j, i) => {          // seta de mira e tombo de quem levou bolada
      const f = d.face[i], b = d.preso[i];
      const alcance = RAIO_J + 1.3 + (b ? b.r * 2 + 0.3 : 0);
      pecas.setas[i].position.set(j.x + f.x * alcance, 0, j.z + f.z * alcance);
      pecas.setas[i].rotation.y = -Math.atan2(f.z, f.x);
      c.bonecos[i].rotation.z = d.tonto[i] > 0 ? Math.sin(t * 40) * 0.3 : 0;
    });

    const ms = c.pool('bolas', d.bolas.length, () => {
      const g = new THREE.Group();
      const bola = c.malha(new THREE.IcosahedronGeometry(1, 1), 0xffffff, { roughness: 0.8, flatShading: true });
      const anel = c.malha(new THREE.TorusGeometry(0.97, 0.1, 6, 24), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.2; anel.castShadow = false;
      g.add(bola, anel); g.userData = { bola, anel }; return g;
    });
    d.bolas.forEach((b, k) => {
      const g = ms[k], { bola, anel } = g.userData, bolona = b.r >= R_BOLONA;
      g.position.set(b.x, b.r, b.z);
      bola.scale.setScalar(b.r); anel.scale.setScalar(b.r);
      bola.rotation.x += b.vz * dt / b.r; bola.rotation.z -= b.vx * dt / b.r;
      const cor = bolona && Math.floor(t * 8) % 2 ? 0xffd23f : c.cores[b.dono];
      anel.material.color.set(cor); anel.material.emissive.set(cor);
    });

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'acerto') {
        c.particulas(e.x, 1, e.z, 0xffffff, e.grande ? 36 : 22, e.grande ? 12 : 8);
        c.particulas(e.x, 1, e.z, c.cores[e.dono], 14, 7);
        c.som(e.grande ? 180 : 260, 0.22, 'square', 0.12);
      } else if (e.tipo === 'quebra') { c.particulas(e.x, 0.8, e.z, 0xffffff, 12, 5); c.som(520, 0.08, 'triangle', 0.06); }
      else if (e.tipo === 'derrete') c.particulas(e.x, 0.4, e.z, 0xbfe0ff, 6, 3);
      else if (e.tipo === 'lanca') c.particulas(e.x, 0.6, e.z, 0xffffff, 6, 4);
    }
  },
};

// Segura, cresce e solta a bola de um jogador; define a lentidao de quem rola.
function cuidaDaBola(p, d, j, i, dt) {
  const f = d.face[i], len = Math.hypot(j.ent.x, j.ent.y);
  if (len > 0.3) { f.x = j.ent.x / len; f.z = j.ent.y / len; }
  d.tonto[i] = Math.max(0, d.tonto[i] - dt);
  d.recarga[i] -= dt;
  let b = d.preso[i];
  const quer = j.ent.d && d.tonto[i] <= 0;
  if (!b && quer && d.recarga[i] <= 0 && d.bolas.filter(o => o.dono === i && !o.preso).length < MAX_LIVRES) {
    b = d.preso[i] = { x: j.x, z: j.z, vx: 0, vz: 0, r: R0, dono: i, preso: true, vivo: true, idade: 0, bolona: false };
    d.bolas.push(b);
  }
  if (b && !quer) { solta(p, d, j, i, b); b = null; }
  if (b) {
    const v = Math.hypot(j.vx, j.vz);
    if (v > V_PARADO) b.r = Math.min(RMAX, b.r + v * dt * CRESCE);
    if (!b.bolona && b.r >= R_BOLONA) { b.bolona = true; p.eventos.push('moeda'); fxPush(d, 'quebra', b.x, b.z); }
    const dist = RAIO_J + b.r + 0.1;
    b.x = Math.max(-LX + b.r, Math.min(LX - b.r, j.x + f.x * dist));
    b.z = Math.max(-LZ + b.r, Math.min(LZ - b.r, j.z + f.z * dist));
    b.vx = j.vx; b.vz = j.vz;
  }
  j.turbo = d.tonto[i] > 0 ? 0 : b ? Math.max(0.45, 1 - (b.r - R0) * 0.5) : 1;
}

function solta(p, d, j, i, b) {
  const o = p.jogadores[1 - i], f = d.face[i];
  let dir = { x: f.x, z: f.z };
  const al = unit(o.x - j.x, o.z - j.z), cos = f.x * al.x + f.z * al.z;     // ajuda a mirar: perto da direcao do rival, a bola vai nele
  if (cos > 0.9) dir = al; else if (cos > 0.8) dir = unit(f.x + al.x, f.z + al.z);
  const v = velLanca(b.r);
  b.preso = false; b.vx = dir.x * v; b.vz = dir.z * v; b.idade = 0;
  d.recarga[i] = T_RECARGA;
  p.eventos.push('dash');
  fxPush(d, 'lanca', b.x, b.z);
}

// Bola solta: desliza, quica na parede e derrete quando para.
function voa(p, d, b, dt) {
  b.idade += dt;
  const at = Math.pow(ATRITO_BOLA, dt);
  b.vx *= at; b.vz *= at;
  b.x += b.vx * dt; b.z += b.vz * dt;
  if (Math.abs(b.x) > LX - b.r) { b.x = Math.sign(b.x) * (LX - b.r); b.vx *= -QUIQUE; }
  if (Math.abs(b.z) > LZ - b.r) { b.z = Math.sign(b.z) * (LZ - b.r); b.vz *= -QUIQUE; }
  if (Math.hypot(b.vx, b.vz) < V_MIN) { b.vivo = false; fxPush(d, 'derrete', b.x, b.z); }
}

// Bolas de donos diferentes que se tocam (soltas ou ainda rolando).
function encontros(d) {
  const bs = d.bolas;
  for (let a = 0; a < bs.length; a++) for (let k = a + 1; k < bs.length; k++) {
    const u = bs[a], v = bs[k];
    if (!u.vivo || !v.vivo || u.dono === v.dono) continue;
    if (Math.hypot(u.x - v.x, u.z - v.z) >= u.r + v.r) continue;
    fxPush(d, 'quebra', (u.x + v.x) / 2, (u.z + v.z) / 2);
    choque(u, v);
  }
}

function tentaAcertar(p, d, b) {
  const k = 1 - b.dono, j = p.jogadores[k];
  if (Math.hypot(j.x - b.x, j.z - b.z) >= RAIO_J + b.r * 0.9) return;
  const dir = unit(b.vx, b.vz), forca = 11 + b.r * 9, grande = b.r >= R_BOLONA;
  j.vx += dir.x * forca; j.vz += dir.z * forca;
  d.tonto[k] = T_TONTO * (0.7 + b.r * 0.5);
  if (d.preso[k]) { d.preso[k].vivo = false; fxPush(d, 'quebra', d.preso[k].x, d.preso[k].z); }     // a bola que ele rolava se desfaz
  b.vivo = false;
  d.placar[b.dono] += grande ? 2 : 1;
  d.aviso = grande ? 'Bolona! 2 pontos' : 'Acertou!'; d.avisoCor = grande ? '#ffd23f' : '#ffffff'; d.avisoT = 1.1;
  fxPush(d, 'acerto', j.x, j.z, { dono: b.dono, grande });
  p.eventos.push('explosao');
  p.celular[k] = { ...p.celular[k], vibra: (p.celular[k].vibra ?? 0) + 1 };
}

function atualizaCelulares(p, d) {
  p.jogadores.forEach((_, i) => {
    const texto = `Você ${d.placar[i]} x ${d.placar[1 - i]} ${quem(p, 1 - i)}. Segure Rolar e ande, solte para lançar.`;
    if (d.textos[i] !== texto) { d.textos[i] = texto; p.celular[i] = { ...p.celular[i], texto }; }
  });
}

function fim(p, d, vencedor) {
  d.aviso = vencedor === -1 ? 'Empate!' : `${quem(p, vencedor)} venceu!`; d.avisoCor = '#ffffff'; d.avisoT = 0;
  p.jogadores.forEach((_, i) => {
    p.celular[i] = { ...p.celular[i], texto: `Fim: você ${d.placar[i]} x ${d.placar[1 - i]}.` };
  });
  return vencedor;
}
