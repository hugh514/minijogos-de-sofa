// Jardim da Equipe (Festa: cooperativo, 2 a 4 jogadores).
// Os canteiros estao cheios de flores murchas. O regador de cada um so leva uma dose: encha na fonte (encostar enche) e aperte Regar
// perto de uma flor. Uma flor so abre com a agua de DOIS amigos diferentes: quem rega primeiro deixa uma gota da sua cor, e o outro
// precisa vir completar antes do broto secar de novo. A equipe tem que abrir a meta de flores antes do por do sol.
import { posicionaRoda, quem, RAIO } from '../logica.mjs';

export const LX = 10.5, LZ = 6.5, TEMPO = 40;
export const FONTE = { x: -8.2, z: 0 };
export const R_FONTE = 2.6, R_REGA = 2.7;
export const CANTEIROS = [-4.1, -0.7, 2.7, 6.1].flatMap(x => [-2.9, 2.9].map(z => ({ x, z })));
const V_ANDA = 7.5, T_ABERTA = 1.6, T_ENCHE = 0.25;
const SOL = 0xffa63a;

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

// Dificuldade: a meta cresce com o numero de jogadores e com a noite; o broto seca mais depressa nas noites seguintes.
export const metaDe = (n, noite = 0) => Math.round((5 + 2 * (n - 2)) * (1 + 0.06 * noite));
export const tempoBroto = noite => 10 - 0.9 * noite;

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

// Quem pode receber a agua de i: primeiro o broto que um amigo ja regou, depois a flor seca mais perto.
function alvoDe(d, j, i) {
  let melhor = null, nota = Infinity;
  for (const f of d.flores) {
    const m = dist(j, f);
    if (m > R_REGA || f.est === 2 || (f.est === 1 && f.por === i)) continue;
    const pontos = m + (f.est === 1 ? 0 : 100);
    if (pontos < nota) { nota = pontos; melhor = f; }
  }
  return melhor;
}

function rega(p, d, i, f) {
  d.agua[i] = false;
  p.eventos.push('moeda');
  if (f.est === 0) {
    f.est = 1; f.por = i; f.t = tempoBroto(noiteDe(p));
    d.fx.push({ tipo: 'gota', x: f.x, z: f.z, i });
    if (!d.avisouBroto) { d.avisouBroto = true; aviso(d, quem(p, i) + ' regou! Falta a água de um amigo.', '#7fd0ff', 2.2); }
    return;
  }
  f.est = 2; f.por2 = i; f.t = T_ABERTA; d.abertas++;
  d.fx.push({ tipo: 'abriu', x: f.x, z: f.z, i, k: f.por });
  p.eventos.push('ponto'); vibra(p, i); vibra(p, f.por);
  const meta = d.meta;
  if (d.abertas === Math.ceil(meta / 2)) aviso(d, 'Metade do jardim já floresceu!', '#ffd23f', 1.6);
  else if (d.abertas < meta) aviso(d, 'Flor aberta pelos dois!', '#6bff9a', 1);
}

function recusa(p, d, i, tipo) {
  if (d.recusa[i] > 0) return;
  d.recusa[i] = 0.9;
  const j = p.jogadores[i];
  d.fx.push({ tipo, x: j.x, z: j.z });
  p.eventos.push('queda');
}

// O texto de cada celular: o que fazer agora.
function textoDe(p, d, i) {
  const j = p.jogadores[i];
  if (!d.agua[i]) return dist(j, FONTE) <= R_FONTE ? 'Enchendo o regador...' : 'Regador vazio. Corra até a fonte.';
  const ajuda = d.flores.filter(f => f.est === 1 && f.por !== i).sort((a, b) => dist(a, j) - dist(b, j))[0];
  if (ajuda) return 'Regador cheio! Complete a flor de ' + quem(p, ajuda.por) + ' e aperte Regar.';
  const propria = d.flores.some(f => f.est === 1 && f.por === i && dist(f, j) <= R_REGA);
  const seca = d.flores.some(f => f.est === 0 && dist(f, j) <= R_REGA);
  if (propria && !seca) return 'Essa flor já tem a sua água. Pegue outra flor seca.';
  return 'Regador cheio! Aperte Regar perto de uma flor seca.';
}

export default {
  id: 'jardim-coop', genero: 'corrida', nome: 'Jardim da Equipe',
  dica: 'Cada flor só abre com a água de dois amigos: encham o regador na fonte e apertem Regar!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Regar', b: '' }, semPulo: true, semDash: true,
  semMod: ['espelho'],                  // com a esquerda trocada pela direita ninguem acerta a fonte nem o canteiro
  rotulo: 'flores abertas', duracao: TEMPO, semNome: true,   // os bonecos se juntam na fonte e nas flores: o nome flutuante cobria o canteiro, a cor do regador e do broto ja diz quem e

  camera: () => ({ x: 0, y: 19.2, z: 15.8, ox: 0, oy: 0, oz: -0.9 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaRoda(p, 2.4);
    const n = p.jogadores.length, cada = f => p.jogadores.map((_, i) => f(i));
    p.dados = {
      placar: [0], aviso: 'Encham o regador na fonte e reguem as flores!', avisoCor: '#7fd0ff', avisoT: 3.2, fx: [], avisou10: false, avisouBroto: false,
      meta: metaDe(n, noiteDe(p)), abertas: 0, noite: noiteDe(p),
      flores: CANTEIROS.map(c => ({ x: c.x, z: c.z, est: 0, por: -1, por2: -1, t: 0 })),
      agua: cada(() => false), cdEnche: cada(() => 0), recusa: cada(() => 0), inventario: cada(() => []),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    if (!d.avisou10 && p.t >= TEMPO - 10) { d.avisou10 = true; aviso(d, 'Faltam 10 segundos para o pôr do sol!', '#ffb13b', 2); }

    js.forEach((j, i) => {
      d.recusa[i] -= dt;
      const v = Math.hypot(j.vx, j.vz);
      if (v > V_ANDA) { j.vx *= V_ANDA / v; j.vz *= V_ANDA / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
      if (!d.agua[i] && dist(j, FONTE) <= R_FONTE) {          // encostar na fonte enche, em um instante
        d.cdEnche[i] += dt;
        if (d.cdEnche[i] >= T_ENCHE) { d.agua[i] = true; d.cdEnche[i] = 0; d.fx.push({ tipo: 'enche', x: FONTE.x, z: FONTE.z, i }); p.eventos.push('troca'); }
      } else d.cdEnche[i] = 0;
      if (j.apertouA <= 0) return;
      if (!d.agua[i]) return recusa(p, d, i, 'nao');
      const f = alvoDe(d, j, i);
      if (f) rega(p, d, i, f);
      else {
        const propria = d.flores.find(q => q.est === 1 && q.por === i && dist(q, j) <= R_REGA);
        if (propria) propria.tremor = 0.7;
        recusa(p, d, i, 'nao');
      }
    });

    for (const f of d.flores) {
      if (f.tremor > 0) f.tremor -= dt;
      if (f.est === 0) continue;
      f.t -= dt;
      if (f.t > 0) continue;
      if (f.est === 1) d.fx.push({ tipo: 'seca', x: f.x, z: f.z });
      Object.assign(f, { est: 0, por: -1, por2: -1, t: 0 });      // broto que secou, ou flor aberta que volta a ser canteiro para a proxima
    }

    d.placar = [d.abertas];
    js.forEach((_, i) => {
      d.inventario[i] = [d.agua[i] ? 'Regador cheio' : 'Regador vazio', 'Flores ' + d.abertas + ' de ' + d.meta];
      const texto = textoDe(p, d, i);
      if (p.celular[i].texto !== texto) p.celular[i] = { ...p.celular[i], texto };
    });

    if (d.abertas >= d.meta) {
      aviso(d, 'O jardim floresceu! Vocês conseguiram!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O jardim floresceu! Vocês regaram juntos!' }; });
      return 2;
    }
    if (p.t >= TEMPO) {
      aviso(d, 'O sol se pôs. Faltaram flores.', '#ff8a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O sol se pôs. Na próxima, regarem mais rápido, um depois do outro.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0; pecas.flor = []; pecas.t0 = null;

    // chao de terra batida, com ladrilhos de caminho claros entre os canteiros
    const chao = sem(malha(caixa(LX * 2, 0.04, LZ * 2), 0xd9c79a, { roughness: 1 })); chao.position.y = 0.02; grupo.add(chao);
    for (let x = -LX + 1; x < LX; x += 2) for (const z of [0]) { const l = sem(malha(caixa(1.5, 0.03, 1.5), 0xc9b585, { roughness: 1 })); l.position.set(x, 0.05, z); grupo.add(l); }
    pecas.luzDia = sem(malha(caixa(LX * 2, 0.02, LZ * 2), SOL, { emissive: SOL, emissiveIntensity: 0.5, transparent: true, opacity: 0, depthWrite: false })); pecas.luzDia.position.y = 0.08; grupo.add(pecas.luzDia);

    // cerca baixa de madeira atras e dos lados
    for (let x = -LX + 0.6; x < LX; x += 1.2) { const e = malha(caixa(0.5, 1.1, 0.25), 0xb07a45, { roughness: 0.9 }); e.position.set(x, 0.55, -LZ - 0.15); grupo.add(e); }
    const trave = malha(caixa(LX * 2 + 0.4, 0.22, 0.2), 0x8d5f33); trave.position.set(0, 0.8, -LZ - 0.15); grupo.add(trave);

    // prateleira de vasos: um vaso por flor da meta; o vaso ganha uma flor dourada a cada flor aberta
    const prat = malha(caixa(19.5, 0.3, 1.5), 0x9b6a3a, { roughness: 0.9 }); prat.position.set(0, 1.2, -LZ - 1.5); grupo.add(prat);
    pecas.vasos = [];
    for (let k = 0; k < 20; k++) {
      const g = new THREE.Group(); g.visible = false;
      const vaso = malha(new THREE.CylinderGeometry(0.5, 0.36, 0.7, 14), 0xc4623a, { roughness: 0.8 }); vaso.position.y = 0.35;
      const cab = malha(new THREE.SphereGeometry(0.42, 12, 10), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.7 }); cab.position.y = 1.0; cab.visible = false;
      g.add(vaso, cab); grupo.add(g); pecas.vasos.push({ g, cab });
    }

    // fonte de pedra com agua e um esguicho
    const f = new THREE.Group(); f.position.set(FONTE.x, 0, FONTE.z);
    const borda = malha(new THREE.CylinderGeometry(1.9, 2.1, 0.8, 24), 0x9aa0a8, { roughness: 0.9 }); borda.position.y = 0.4;
    const agua = sem(malha(new THREE.CylinderGeometry(1.65, 1.65, 0.1, 24), 0x39a8ff, { emissive: 0x1a78d8, emissiveIntensity: 0.7 })); agua.position.y = 0.82;
    const pilar = malha(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 12), 0xb6bcc4, { roughness: 0.8 }); pilar.position.y = 1.3;
    const bacia = malha(new THREE.CylinderGeometry(0.95, 0.45, 0.3, 18), 0xb6bcc4, { roughness: 0.8 }); bacia.position.y = 2.1;
    f.add(borda, agua, pilar, bacia); grupo.add(f);
    pecas.gotas = [0, 1, 2, 3, 4, 5].map(k => { const m = sem(malha(new THREE.SphereGeometry(0.2, 8, 6), 0x7fd0ff, { emissive: 0x39a8ff, emissiveIntensity: 1 })); grupo.add(m); return m; });
    pecas.zona = sem(malha(new THREE.RingGeometry(R_FONTE - 0.2, R_FONTE, 40), 0x39a8ff, { emissive: 0x39a8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    pecas.zona.rotation.x = -Math.PI / 2; pecas.zona.position.set(FONTE.x, 0.1, FONTE.z); grupo.add(pecas.zona);

    // sol que desce atras da cerca
    pecas.sol = sem(malha(new THREE.SphereGeometry(1.2, 20, 14), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 1 })); pecas.sol.position.set(9, 6, -LZ - 4); grupo.add(pecas.sol);

    // canteiros: terra, haste, folhas, botao, petalas de duas cores e duas gotas que mostram quem ja regou
    CANTEIROS.forEach(cn => {
      const g = new THREE.Group(); g.position.set(cn.x, 0, cn.z);
      const terra = malha(caixa(2.9, 0.4, 2.5), 0x6b4a2f, { roughness: 1 }); terra.position.y = 0.2;
      const aro = malha(caixa(3.1, 0.3, 2.7), 0x9b6a3a, { roughness: 0.9 }); aro.position.y = 0.1;
      const haste = new THREE.Group(); haste.position.y = 0.4; haste.scale.setScalar(1.5);
      const talo = malha(new THREE.CylinderGeometry(0.1, 0.13, 1.7, 8), 0x4c9a3a); talo.position.y = 0.85;
      const folhaE = malha(new THREE.SphereGeometry(0.5, 10, 8), 0x58b046); folhaE.scale.set(1.2, 0.22, 0.6); folhaE.position.set(-0.55, 0.6, 0); folhaE.rotation.z = 0.5;
      const folhaD = malha(new THREE.SphereGeometry(0.5, 10, 8), 0x58b046); folhaD.scale.set(1.2, 0.22, 0.6); folhaD.position.set(0.55, 0.8, 0); folhaD.rotation.z = -0.5;
      const cab = new THREE.Group(); cab.position.y = 1.75;
      const botao = malha(new THREE.SphereGeometry(0.5, 14, 10), 0x8a7440, { roughness: 0.8 }); botao.scale.set(1, 1.15, 1);
      const petalas = new THREE.Group();
      const lista = [];
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, pt = malha(new THREE.SphereGeometry(0.5, 10, 8), 0xffffff, { emissive: 0x222222 });
        pt.scale.set(0.95, 0.3, 0.55); pt.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75); pt.rotation.y = -a; pt.castShadow = false;
        petalas.add(pt); lista.push(pt);
      }
      const miolo = malha(new THREE.SphereGeometry(0.42, 12, 10), 0xffc531, { emissive: 0xff9a00, emissiveIntensity: 0.6 }); miolo.position.y = 0.12;
      petalas.add(miolo); petalas.rotation.x = 0.35;
      cab.add(botao, petalas); haste.add(talo, folhaE, folhaD, cab);
      const slots = [-0.75, 0.75].map(dx => { const m = sem(malha(new THREE.SphereGeometry(0.5, 12, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 })); m.position.set(dx, 4.8, 0); return m; });
      const seta = sem(malha(new THREE.ConeGeometry(0.4, 0.8, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 })); seta.rotation.x = Math.PI; seta.visible = false;
      g.add(aro, terra, haste, ...slots, seta); grupo.add(g);
      pecas.flor.push({ g, haste, cab, botao, petalas, lista, miolo, talo, folhas: [folhaE, folhaD], slots, seta, a: 0, h: 0 });
    });

    // regador de cada jogador, acima do boneco
    pecas.latas = c.bonecos.map(() => {
      const g = new THREE.Group();
      const corpo = malha(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 14), 0x8e99a8, { metalness: 0.4, roughness: 0.5 }); corpo.position.y = 0.4;
      const alca = malha(new THREE.TorusGeometry(0.42, 0.07, 6, 14), 0x8e99a8); alca.position.set(0, 0.85, 0);
      const bico = malha(new THREE.CylinderGeometry(0.1, 0.16, 0.7, 8), 0x8e99a8); bico.position.set(0.65, 0.6, 0); bico.rotation.z = -1.0;
      const agua = sem(malha(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 14), 0x39a8ff, { emissive: 0x39a8ff, emissiveIntensity: 1 })); agua.position.y = 0.78;
      g.add(corpo, alca, bico, agua); g.scale.setScalar(1.5); grupo.add(g);
      return { g, corpo, agua };
    });
  },

  desenha(c, dt, t) {
    const { p, pecas, THREE } = c, d = p.dados;
    if (!pecas.flor) return;
    if (p.fase === 'jogando') pecas.f = limita(p.t / TEMPO, 0, 1);
    const f = pecas.f ?? 0, fim = d.abertas >= d.meta;

    // por do sol: o sol desce e o chao esquenta
    pecas.sol.position.y = 6 - 5.2 * f; pecas.sol.scale.setScalar(1 + 0.25 * f);
    pecas.luzDia.material.opacity = 0.3 * f * f;
    pecas.zona.material.opacity = d.agua.every(Boolean) ? 0.15 : 0.45 + 0.25 * Math.sin(t * 5);
    pecas.gotas.forEach((m, k) => { const ph = (t * 1.3 + k / 6) % 1; m.position.set(FONTE.x + Math.cos(k * 2.1) * 0.9 * ph, 2.2 + 1.6 * Math.sin(Math.PI * ph) , FONTE.z + Math.sin(k * 2.1) * 0.9 * ph); });

    // vasos da meta
    pecas.vasos.forEach((v, k) => {
      v.g.visible = k < d.meta;
      v.g.position.set((k - (d.meta - 1) / 2) * Math.min(1.3, 17 / Math.max(1, d.meta)), 1.35, -LZ - 1.5);
      v.cab.visible = k < d.abertas; v.cab.scale.setScalar(k === d.abertas - 1 ? 1 + 0.25 * Math.sin(t * 8) : 1);
    });

    // canteiros
    const cor = i => c.cores[i] ?? 0xffffff;
    d.flores.forEach((fl, k) => {
      const m = pecas.flor[k];
      const alvoA = fl.est === 2 ? 1 : 0, alvoH = fl.est === 0 ? 0 : 1;
      m.a += (alvoA - m.a) * Math.min(1, dt * 9); m.h += (alvoH - m.h) * Math.min(1, dt * 7);
      const tr = fl.tremor > 0 ? 0.08 * Math.sin(t * 40) : 0;
      m.haste.rotation.z = (1 - m.h) * 1.15 + tr; m.haste.rotation.x = (1 - m.h) * 0.2;
      m.talo.material.color.setRGB(0.55 - 0.25 * m.h, 0.45 + 0.17 * m.h, 0.25 + 0.0 * m.h);
      m.folhas.forEach(l => l.material.color.setRGB(0.55 - 0.2 * m.h, 0.42 + 0.3 * m.h, 0.28));
      m.cab.scale.setScalar((0.7 + 0.3 * m.h) * (1 + 0.45 * m.a + (fl.est === 2 ? 0.08 * Math.sin(t * 9 + k) : 0)));
      m.botao.visible = m.a < 0.6; m.petalas.visible = m.a >= 0.3; m.petalas.scale.setScalar(Math.max(0.05, m.a));
      const bc = fl.est === 0 ? [0.54, 0.46, 0.25] : new THREE.Color(cor(fl.por)).toArray();
      m.botao.material.color.setRGB(bc[0], bc[1], bc[2]);
      if (fl.est === 2) m.lista.forEach((pt, n) => pt.material.color.set(cor(n % 2 ? fl.por2 : fl.por)));
      m.petalas.rotation.y = t * (fl.est === 2 ? 1.2 : 0);
      // gotas: a primeira da cor de quem regou, a segunda piscando enquanto espera o amigo
      const ok0 = fl.est >= 1, ok1 = fl.est === 2;
      m.slots[0].visible = m.slots[1].visible = fl.est !== 0;
      m.slots[0].material.color.set(ok0 ? cor(fl.por) : 0x555555); m.slots[0].material.emissive.set(ok0 ? cor(fl.por) : 0x000000);
      m.slots[1].material.color.set(ok1 ? cor(fl.por2) : 0xffffff); m.slots[1].material.emissive.set(ok1 ? cor(fl.por2) : 0xffffff);
      m.slots[1].material.emissiveIntensity = ok1 ? 0.9 : 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 7));
      m.slots[1].scale.setScalar(ok1 ? 1 : 0.7 + 0.25 * Math.sin(t * 7));
      m.slots.forEach((s, n) => { s.position.y = 4.8 + 0.15 * Math.sin(t * 4 + n); });
      m.seta.visible = fl.est === 1;
      if (fl.est === 1) { m.seta.position.set(0, 6.1 + 0.35 * Math.sin(t * 7), 0); m.seta.material.color.set(cor(fl.por)); m.seta.material.emissive.set(cor(fl.por)); m.seta.scale.setScalar(0.6 + 0.4 * (fl.t / tempoBroto(d.noite))); }
    });

    // regadores acima dos bonecos
    c.bonecos.forEach((b, i) => {
      const l = pecas.latas[i], cheia = d.agua[i];
      l.g.position.set(b.position.x, b.position.y + 3.3 + 0.1 * Math.sin(t * 5 + i), b.position.z);
      l.agua.visible = cheia; l.corpo.material.color.set(cheia ? 0x5aa8ff : 0x8e99a8);
      l.g.rotation.y = fim ? t * 4 : 0;
    });

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'enche') c.particulas(e.x, 1.6, e.z, 0x7fd0ff, 10, 5);
      else if (e.tipo === 'gota') c.particulas(e.x, 1.8, e.z, cor(e.i), 12, 5);
      else if (e.tipo === 'abriu') { c.particulas(e.x, 2.2, e.z, cor(e.i), 14, 8); c.particulas(e.x, 2.2, e.z, cor(e.k), 14, 8); c.particulas(e.x, 2.4, e.z, 0xffd23f, 10, 6); }
      else if (e.tipo === 'seca') c.particulas(e.x, 1.5, e.z, 0x8a7440, 10, 4);
      else c.particulas(e.x, 2.2, e.z, 0xff4a4a, 6, 3);
    }
  },
};
