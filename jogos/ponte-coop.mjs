// Ponte de Tábuas (Festa: cooperativo, 2 a 4). Um rio largo com tábuas boiando que a correnteza leva para baixo. Todos começam na
// margem esquerda e precisam chegar à direita em 40 s. Empurrem as tábuas (encostar), pulem de uma para a outra e segurem A para
// travar as tábuas que estão perto de vocês: quem segura mantém a ponte parada enquanto o outro passa. Cair na água manda de volta
// para a margem esquerda depois de 1 s. A porteira da outra margem só abre aos 5 s.
import { RAIO } from '../logica.mjs';

export const LX = 11, LZ = 7, RIO = 3.6, TEMPO = 40, ABRE = 5;
const PW = 2.5, PD = 2.0, HW = PW / 2, HD = PD / 2;          // tábua: 2,5 de comprimento (x) por 2 de largura (z)
export const GRACA = 3.5;
const CORRENTE = 0.8, V_ANDA = 7, ALCANCE = 3.6, MOLHADO = 1;
const X_PORTEIRA = 5, X_CHEGADA = 5.4, X_PARTIDA = -7.2;
const limita = (v, a, b) => Math.max(a, Math.min(b, v));

const quantasTabuas = n => (n >= 3 ? 5 : 4);

function novaTabua(p, k, z) {
  const lado = k % 2 ? 1 : -1;
  return { x: lado * (0.8 + p.rng() * 0.9), z, vx: 0, vz: CORRENTE, trava: 0, segura: false };
}

// Distância do ponto à tábua (zero se está em cima).
function distTabua(pk, x, z) { return Math.hypot(x - limita(x, pk.x - HW, pk.x + HW), z - limita(z, pk.z - HD, pk.z + HD)); }
const emCima = (pk, j) => Math.abs(j.x - pk.x) < HW + 0.7 && Math.abs(j.z - pk.z) < HD + 0.7;

function separaTabuas(tabuas) {
  for (let a = 0; a < tabuas.length; a++)
    for (let b = a + 1; b < tabuas.length; b++) {
      const A = tabuas[a], B = tabuas[b];
      const ox = PW - Math.abs(B.x - A.x), oz = PD - Math.abs(B.z - A.z);
      if (ox <= 0 || oz <= 0) continue;
      const fa = A.trava > 0 ? 0 : B.trava > 0 ? 1 : 0.5, fb = 1 - fa;
      if (ox < oz) { const s = Math.sign(B.x - A.x) || 1; A.x -= s * ox * fa; B.x += s * ox * fb; }
      else { const s = Math.sign(B.z - A.z) || 1; A.z -= s * oz * fa; B.z += s * oz * fb; }
    }
}

// O jogador encosta numa tábua solta e a empurra (só se sobe nela pulando); a tábua travada deixa subir andando.
function empurra(pk, j) {
  const dx = j.x - limita(j.x, pk.x - HW, pk.x + HW), dz = j.z - limita(j.z, pk.z - HD, pk.z + HD), m = Math.hypot(dx, dz);
  if (m >= RAIO || m === 0) return;
  const nx = dx / m, nz = dz / m, pen = RAIO - m;
  if (pk.trava > 0) return;                         // travada nao empurra nem segura: da para subir nela andando
  pk.x -= nx * pen; pk.z -= nz * pen;
  const chega = (j.vx - pk.vx) * nx + (j.vz - pk.vz) * nz;
  if (chega < 0) { pk.vx += nx * chega * 0.7; pk.vz += nz * chega * 0.7; }
}

function cai(p, d, i) {
  const j = p.jogadores[i];
  d.agua[i] = MOLHADO; j.vx = j.vz = 0;
  d.fx.push({ tipo: 'agua', x: j.x, z: j.z });
  p.eventos.push('queda');
  p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
}

function sai(p, d, i) {
  const j = p.jogadores[i];
  Object.assign(j, { x: X_PARTIDA - p.rng() * 1.6, z: (p.rng() - 0.5) * 2 * (LZ - 1.5), vx: 0, vz: 0, y: 0, vy: 0 });
  d.fx.push({ tipo: 'volta', x: j.x, z: j.z });
}

function textoDe(p, d, i) {
  if (d.agua[i] > 0) return 'Na água! Volta em ' + Math.ceil(d.agua[i]) + ' s';
  const quantos = d.chegou.filter(Boolean).length + ' de ' + d.chegou.length + ' na outra margem';
  if (d.chegou[i]) return 'Você atravessou! ' + quantos;
  if (p.t < ABRE) return 'A porteira abre em ' + Math.ceil(ABRE - p.t) + ' s. ' + quantos;
  return 'Segure A para travar as tábuas. ' + quantos;
}

export default {
  id: 'ponte-coop', genero: 'equilibrio', nome: 'Ponte de Tábuas', dica: 'Empurrem as tábuas, pulem de uma para a outra e segurem A para travar a ponte. Todos na outra margem em 40 segundos!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'SEGURA', b: 'PULA' }, semDash: true,
  rotulo: 'na outra margem', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const n = p.jogadores.length, cada = f => p.jogadores.map((_, i) => f(i));
    p.jogadores.forEach((j, i) => { j.x = X_PARTIDA - 0.8 * (i % 2); j.z = (i - (n - 1) / 2) * 2.6; });       // todos na margem esquerda, em fila
    p.dados = {
      placar: [0], inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0, fx: [],
      tabuas: Array.from({ length: quantasTabuas(n) }, (_, k) => novaTabua(p, k, -6.5 + k * 13 / (quantasTabuas(n) - 1))),
      agua: cada(() => 0), chegou: cada(() => false), seg: cada(() => 0), aberta: false,
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, tabuas = d.tabuas;
    if (!d.aberta && p.t >= ABRE) { d.aberta = true; p.eventos.push('troca'); d.aviso = 'PORTEIRA ABERTA!'; d.avisoCor = '#6bff9a'; d.avisoT = 1.5; }
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    // quem segura A trava as tábuas ao alcance; depois de soltar elas ficam paradas por mais um tempo
    js.forEach((j, i) => { d.seg[i] = Math.max(0, d.seg[i] - dt); if (j.apertouA > 0) d.seg[i] = 0.3; });
    for (const pk of tabuas) {
      pk.segura = js.some((j, i) => d.agua[i] <= 0 && (j.ent.d || d.seg[i] > 0) && distTabua(pk, j.x, j.z) < ALCANCE);
      if (pk.segura) pk.trava = GRACA; else pk.trava = Math.max(0, pk.trava - dt);
    }

    // a correnteza leva as tábuas soltas; as que passam do fim voltam por cima com outro lugar
    tabuas.forEach((pk, k) => {
      if (pk.trava > 0) { pk.vx = 0; pk.vz = 0; return; }
      pk.vx *= Math.exp(-1.6 * dt); pk.vz += (CORRENTE - pk.vz) * (1 - Math.exp(-1.2 * dt));
      const vm = Math.hypot(pk.vx, pk.vz);
      if (vm > 6) { pk.vx *= 6 / vm; pk.vz *= 6 / vm; }
      pk.x += pk.vx * dt; pk.z += pk.vz * dt;
      if (pk.z - HD > LZ + 1) Object.assign(pk, novaTabua(p, k + (p.rng() < 0.5 ? 0 : 1), -LZ - 2 - p.rng() * 2));
    });
    separaTabuas(tabuas);
    for (const pk of tabuas) pk.x = limita(pk.x, -RIO + HW - 0.5, RIO - HW + 0.5);

    js.forEach((j, i) => {
      if (d.agua[i] > 0) {                           // dentro da água: parado e escondido até voltar
        d.agua[i] -= dt; j.vx = j.vz = 0;
        if (d.agua[i] <= 0) { d.agua[i] = 0; sai(p, d, i); }
        return;
      }
      const v = Math.hypot(j.vx, j.vz);
      if (v > V_ANDA) { j.vx *= V_ANDA / v; j.vz *= V_ANDA / v; }
      if (!d.aberta) j.x = Math.min(j.x, X_PORTEIRA - RAIO);       // a porteira fechada segura todo mundo
      const solo = j.y <= 0.05 && j.vy <= 0;
      let sobre = null;
      for (const pk of tabuas) {
        if (emCima(pk, j)) sobre = pk;
        else if (solo) empurra(pk, j);
      }
      if (sobre && solo) { j.x += sobre.vx * dt; j.z += sobre.vz * dt; }       // a tábua leva quem está nela
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
      if (solo && !sobre && Math.abs(j.x) < RIO - 1) cai(p, d, i);
      if (d.aberta && solo && j.x > X_CHEGADA && !d.chegou[i]) {
        d.chegou[i] = true; p.eventos.push('ponto');
        d.fx.push({ tipo: 'chegou', x: j.x, z: j.z, i });
      }
    });

    d.placar = [d.chegou.filter(Boolean).length];
    d.inventario = js.map((_, i) => [d.chegou[i] ? 'Atravessou' : d.agua[i] > 0 ? 'Na água' : 'Na margem esquerda']);
    js.forEach((_, i) => { const texto = textoDe(p, d, i); if (p.celular[i].texto !== texto) p.celular[i] = { ...p.celular[i], texto }; });

    if (d.chegou.every(Boolean)) { d.aviso = 'TODOS ATRAVESSARAM!'; d.avisoCor = '#6bff9a'; d.avisoT = 3; return 2; }
    if (p.t >= TEMPO) { d.aviso = 'O TEMPO ACABOU'; d.avisoCor = '#ff4a4a'; d.avisoT = 3; return -1; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    pecas.visto = 0;
    // margens de grama e o rio comprido (passa além da arena: as tábuas vêm de longe)
    for (const lado of [-1, 1]) {
      const m = malha(caixa(LX - RIO, 0.08, LZ * 2), lado < 0 ? 0x5f9b4a : 0x4f8a4f, { roughness: 1 });
      m.position.set(lado * (RIO + (LX - RIO) / 2), 0.04, 0); m.castShadow = false; grupo.add(m);
      for (let k = 0; k < 7; k++) {
        const pedra = malha(new THREE.DodecahedronGeometry(0.45, 0), 0x8a8f98, { roughness: 1 });
        pedra.position.set(lado * (RIO + 0.2), 0.3, -LZ + 1 + k * 2.1); pedra.castShadow = false; grupo.add(pedra);
      }
    }
    const agua = malha(caixa(RIO * 2, 0.06, 60), 0x2c7fd1, { roughness: 0.2, metalness: 0.1 });
    agua.position.set(0, 0.03, 0); agua.castShadow = false; grupo.add(agua);
    pecas.ondas = Array.from({ length: 16 }, (_, k) => {
      const o = malha(caixa(1.1 + (k % 3) * 0.4, 0.02, 0.12), 0xbfe3ff, { emissive: 0x5aa0d8, emissiveIntensity: 0.4 });
      o.position.set(-RIO + 0.8 + (k * 1.37) % (RIO * 2 - 1.6), 0.08, 0); o.castShadow = false; grupo.add(o); return o;
    });
    // porteira da outra margem (cai aos 5 s) e a bandeira de chegada
    pecas.porteira = new THREE.Group(); pecas.porteira.position.set(X_PORTEIRA, 0, 0);
    for (let k = 0; k < 8; k++) {
      const poste = malha(caixa(0.2, 1.5, 0.2), 0xe8e4d8); poste.position.set(0, 0.75, -LZ + 0.9 + k * (2 * LZ - 1.8) / 7); pecas.porteira.add(poste);
    }
    for (const y of [0.55, 1.2]) { const barra = malha(caixa(0.14, 0.14, LZ * 2 - 1.2), 0xd9301f); barra.position.y = y; barra.castShadow = false; pecas.porteira.add(barra); }
    grupo.add(pecas.porteira);
    const mastro = malha(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), 0xe8e4d8); mastro.position.set(9, 2, -LZ + 1.4); grupo.add(mastro);
    const bandeira = malha(caixa(1.9, 1.1, 0.06), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.5 }); bandeira.position.set(9 - 0.95, 3.4, -LZ + 1.4); bandeira.castShadow = false; grupo.add(bandeira);
    // tábuas: madeira com três réguas, e um aro amarelo quando estão travadas
    pecas.tabuas = [];
    for (let k = 0; k < 5; k++) {
      const g = new THREE.Group();
      const base = malha(caixa(PW, 0.14, PD), 0x9b6a3a, { roughness: 0.9 }); base.position.y = 0.13;
      for (const dz of [-0.62, 0, 0.62]) { const reg = malha(caixa(PW - 0.1, 0.05, 0.5), 0xb7864a, { roughness: 0.9 }); reg.position.set(0, 0.22, dz); reg.castShadow = false; g.add(reg); }
      const aro = malha(caixa(PW + 0.3, 0.05, PD + 0.3), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.9 }); aro.position.y = 0.09; aro.castShadow = false; aro.visible = false;
      g.add(base, aro); g.userData = { aro }; g.visible = false; grupo.add(g); pecas.tabuas.push(g);
    }
    // marcador de queda na água
    pecas.respingos = c.bonecos.map(() => { const m = malha(new THREE.TorusGeometry(0.9, 0.12, 8, 24), 0xdff3ff, { emissive: 0xdff3ff, emissiveIntensity: 0.7 }); m.rotation.x = Math.PI / 2; m.castShadow = false; m.visible = false; grupo.add(m); return m; });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    if (!pecas.tabuas) return;
    pecas.ondas.forEach((o, k) => { o.position.z = ((t * 1.8 + k * 3.7) % (LZ * 2 + 4)) - LZ - 2; });
    pecas.porteira.position.y = d.aberta ? Math.max(-1.6, pecas.porteira.position.y - dt * 4) : 0;
    pecas.tabuas.forEach((g, k) => {
      const pk = d.tabuas[k];
      g.visible = !!pk;
      if (!pk) return;
      g.position.set(pk.x, 0, pk.z + (pk.trava > 0 ? 0 : 0.05 * Math.sin(t * 2 + k)));
      g.rotation.z = pk.trava > 0 ? 0 : 0.03 * Math.sin(t * 1.7 + k);
      g.userData.aro.visible = pk.trava > 0 && (pk.segura || Math.floor(t * 6) % 2 === 0);
    });
    c.bonecos.forEach((b, i) => {
      const molhado = d.agua[i] > 0;
      b.visible = !molhado;
      const r = pecas.respingos[i], j = p.jogadores[i];
      r.visible = molhado; r.position.set(j.x, 0.1, j.z); r.scale.setScalar(0.6 + (MOLHADO - d.agua[i]) * 0.8);
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'agua') c.particulas(e.x, 0.5, e.z, 0xbfe3ff, 24, 9);
      else if (e.tipo === 'chegou') c.particulas(e.x, 1, e.z, 0xffd23f, 22, 8);
      else c.particulas(e.x, 1, e.z, 0xffffff, 12, 5);
    }
  },
};
