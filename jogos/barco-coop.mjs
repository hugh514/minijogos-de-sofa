// Barco Furado (Festa: cooperativo, 2 a 4). O barco atravessa o lago sozinho, mas o casco abre furos e a agua entra.
// Uma acao so, o botao Ajuda, segurado: perto de um furo ele tapa; perto do balde, tira agua do barco.
// Furo pequeno um tapa sozinho. Furo grande so fecha com dois segurando juntos (um sozinho so segura a metade da agua).
// Quanto mais agua, mais devagar o barco anda. Venceram se chegarem a outra margem; perdem se o barco afundar ou o tempo acabar.
import { quem, RAIO } from '../logica.mjs';

export const LX = 8, LZ = 5, TEMPO = 40;
export const V_BARCO = 4.2, LENTO = 0.45;                    // % da travessia por segundo, e quanto a agua enche o barco de lento
export const R_FURO = 1.9, R_GRANDE = 2.7, R_BALDE = 2.4;     // alcance da mao em cada coisa
export const T_FURO = 0.9, T_GRANDE = 1.3, MEIO = 0.4;        // tempo para tapar; sozinho num furo grande a barra para em 40%
export const BALDE = 8.5, BALDE_DUPLA = 3.5;                  // % de agua tirada por segundo por quem esta no balde; bonus quando ha dois
export const VAZA = 2, VAZA_GRANDE = 4;                  // % de agua que entra por segundo em cada furo
export const BALDE_POS = { x: 0, z: 3.3 };
const V_ANDA = 7, GRACA = 0.35;
const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);

// Quanto o barco sofre com o numero de jogadores e com a noite (0 a 4).
export const escala = (n, noite) => (1 + 0.22 * (n - 2)) * (1 + 0.07 * noite);
export const maxFuros = (n, noite) => 3 + (n > 2 ? 1 : 0) + (n > 3 && noite >= 3 ? 1 : 0);
const vaza = (f, noite) => (f.grande ? VAZA_GRANDE : VAZA) * (1 + 0.12 * noite);

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

function novoFuro(p, d, grande) {
  let x = 0, z = 0;
  for (let k = 0; k < 14; k++) {                       // lugar livre: longe do balde e dos outros furos
    x = (p.rng() * 2 - 1) * (LX - 2.4); z = (p.rng() * 2 - 1) * (LZ - 2);
    const longe = dist({ x, z }, BALDE_POS) > 2.8 && d.furos.every(f => dist(f, { x, z }) > 3);
    if (longe) break;
  }
  const f = { id: d.criados++, x, z, grande, prog: 0, maos: 0 };
  d.furos.push(f);
  d.fx.push({ tipo: 'furo', x, z, grande });
  p.eventos.push('batida');
  if (grande) { d.vistoGrande = true; aviso(d, 'Furo grande! Precisa de dois.', '#ffd23f', 2.4); }
  return f;
}

// O que a mao de i esta fazendo: o furo mais perto ao alcance, senao o balde, senao nada.
function alvoDe(d, j) {
  let melhor = null, m = Infinity;
  for (const f of d.furos) {
    const dd = dist(f, j) / (f.grande ? R_GRANDE : R_FURO);
    if (dd < 1 && dd < m) { m = dd; melhor = { tipo: 'furo', id: f.id }; }
  }
  if (melhor) return melhor;
  return dist(BALDE_POS, j) < R_BALDE ? { tipo: 'balde' } : null;
}

function tampou(p, d, f) {
  d.furos.splice(d.furos.indexOf(f), 1);
  d.remendos.push({ x: f.x, z: f.z, grande: f.grande, giro: p.rng() - 0.5 });
  d.fechados++;
  d.fx.push({ tipo: 'tampou', x: f.x, z: f.z, grande: f.grande });
  p.eventos.push(f.grande ? 'ponto' : 'moeda');
  if (f.grande) aviso(d, 'Furo grande fechado! Muito bem!', '#6bff9a', 1.6);
}

// O texto de cada celular: o que fazer agora.
function textoDe(p, d, i) {
  const alvo = d.alvo[i];
  if (alvo?.tipo === 'balde') return 'Tirando água! Continue segurando Ajuda.';
  if (alvo?.tipo === 'furo') {
    const f = d.furos.find(q => q.id === alvo.id);
    if (!f.grande) return 'Tampando o furo! Continue segurando.';
    return f.maos >= 2 ? 'Os dois juntos! Quase fechou.' : 'Furo grande! Chame um amigo para segurar junto.';
  }
  const grande = d.furos.find(f => f.grande && f.maos === 1);
  if (grande) {
    const k = p.jogadores.findIndex((_, q) => q !== i && d.alvo[q]?.tipo === 'furo' && d.alvo[q].id === grande.id);
    return 'Ajude ' + quem(p, k) + ': corra até o furo grande e segure Ajuda.';
  }
  if (d.furos.length) return 'Furo aberto! Corra até ele e segure Ajuda.';
  if (d.agua >= 20) return 'Água no barco! Vá ao balde e segure Ajuda.';
  return 'Tudo seco! Fiquem de olho nos furos novos.';
}

export default {
  id: 'barco-coop', genero: 'equilibrio', nome: 'Barco Furado',
  dica: 'Cheguem à outra margem: segurem Ajuda perto dos furos e do balde!',
  semMod: ['espelho', 'foguete'],       // o barco pede parar em cima do furo: espelho confunde e foguete escorrega
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Ajuda', b: '' }, semMovimento: false, semDash: true, semPulo: true,
  rotulo: 'da travessia', sufixo: '%', duracao: TEMPO, tema: 0, semNome: true,   // dois bonecos juntos no mesmo furo ou no balde: o nome flutuante cobria o furo; a cor do boneco ja diz quem e

  camera: () => ({ x: 0, y: 18.5, z: 10.4, ox: 0, oy: 0, oz: -0.6 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const n = p.jogadores.length;
    p.jogadores.forEach((j, i) => { j.x = (i - (n - 1) / 2) * 2.6; j.z = 0.6; });
    p.dados = {
      placar: [0], aviso: 'Segurem Ajuda nos furos e no balde!', avisoCor: '#ffd23f', avisoT: 3, fx: [], t: 0,
      agua: 0, prog: 0, furos: [], remendos: [], criados: 0, fechados: 0, vistoGrande: false, proxFuro: 2, tBalde: 0, avisouAgua: 0, avisouTerra: false, fim: '',
      seg: p.jogadores.map(() => 0), alvo: p.jogadores.map(() => null), baldeando: 0, inventario: p.jogadores.map(() => ['Livre']),
      texto: p.jogadores.map(() => ''), velocidade: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, n = js.length, noite = noiteDe(p);
    d.t = p.t;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.avisouAgua = Math.max(0, d.avisouAgua - dt);

    // ----- jogadores: andam no convés e seguram Ajuda -----
    js.forEach((j, i) => {
      const v = Math.hypot(j.vx, j.vz);
      if (v > V_ANDA) { j.vx *= V_ANDA / v; j.vz *= V_ANDA / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
      d.seg[i] = Math.max(0, d.seg[i] - dt);
      if (j.apertouA > 0) d.seg[i] = GRACA;                       // um toque curto vale por um instante
      d.alvo[i] = j.ent.d || d.seg[i] > 0 ? alvoDe(d, j) : null;
    });

    // ----- furos: quantas maos tem cada um, tapam, e a agua entra -----
    let vazamento = 0;
    for (const f of [...d.furos]) {
      f.maos = d.alvo.filter(a => a?.tipo === 'furo' && a.id === f.id).length;
      if (f.grande) {
        if (f.maos >= 2) f.prog = Math.min(1, f.prog + dt / T_GRANDE);
        else if (f.maos === 1) f.prog = f.prog < MEIO ? Math.min(MEIO, f.prog + dt / T_GRANDE) : Math.max(MEIO, f.prog - dt * 0.2);
        else f.prog = Math.max(0, f.prog - dt * 0.15);
      } else if (f.maos > 0) f.prog = Math.min(1, f.prog + dt / T_FURO * (1 + 0.8 * (f.maos - 1)));
      else f.prog = Math.max(0, f.prog - dt * 0.6);
      if (f.prog >= 1) { tampou(p, d, f); continue; }
      vazamento += vaza(f, noite) * (f.grande && f.maos === 1 ? 0.5 : 1);
    }

    d.alvo = d.alvo.map(a => (a?.tipo === 'furo' && !d.furos.some(f => f.id === a.id) ? null : a));       // o furo que acabou de fechar nao e mais alvo

    // ----- novos furos -----
    d.proxFuro -= dt;
    if (d.proxFuro <= 0 && d.furos.length < maxFuros(n, noite)) {
      const grandeAberto = d.furos.some(f => f.grande);
      const grande = !grandeAberto && p.t >= 9 && (!d.vistoGrande || p.rng() < 0.14 + 0.03 * noite);
      novoFuro(p, d, grande);
      d.proxFuro = (2.5 + p.rng() * 1.2) / escala(n, noite);
    } else if (d.proxFuro <= 0) d.proxFuro = 0.6;

    // ----- balde: quem esta nele tira agua; dois tiram mais ainda -----
    const baldeiros = d.alvo.filter(a => a?.tipo === 'balde').length;
    d.baldeando = baldeiros;
    const tira = baldeiros ? BALDE * baldeiros + (baldeiros > 1 ? BALDE_DUPLA : 0) : 0;
    d.tBalde -= dt;
    if (tira && d.tBalde <= 0) { d.tBalde = 0.25; d.fx.push({ tipo: 'balde' }); }
    d.agua = limita(d.agua + (vazamento - tira) * dt, 0, 100);

    // ----- o barco anda; com agua, devagar -----
    d.velocidade = V_BARCO * (1 - LENTO * d.agua / 100);
    d.prog = Math.min(100, d.prog + d.velocidade * dt);
    if (d.agua >= 70 && d.avisouAgua <= 0 && !d.fim) { aviso(d, 'Água demais! Tirem no balde!', '#ff4a4a', 1.8); d.avisouAgua = 6; }
    if (!d.avisouTerra && d.prog >= 80) { d.avisouTerra = true; aviso(d, 'Terra à vista! Mais um pouco!', '#6bff9a', 2); }

    // ----- placar e celulares -----
    d.placar = [Math.floor(d.prog)];
    js.forEach((_, i) => {
      const a = d.alvo[i];
      d.inventario[i] = [a?.tipo === 'balde' ? 'Tirando água' : a?.tipo === 'furo' ? 'Tapando furo' : 'Livre'];
      const texto = textoDe(p, d, i);
      if (texto !== d.texto[i]) { d.texto[i] = texto; p.celular[i] = { ...p.celular[i], texto }; }
    });

    // ----- fim -----
    if (d.prog >= 100) {
      d.fim = 'chegou'; aviso(d, 'Chegaram à outra margem!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'Chegaram à outra margem! Vocês salvaram o barco juntos!' }; });
      d.fx.push({ tipo: 'chegada' });
      p.eventos.push('ponto');
      return 2;
    }
    if (d.agua >= 100) {
      d.fim = 'afundou'; aviso(d, 'O barco afundou!', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O barco afundou. Na próxima, tampem os furos e tirem a água juntos.' }; });
      p.eventos.push('queda');
      return -1;
    }
    if (p.t >= TEMPO) {
      d.fim = 'tempo'; aviso(d, 'O tempo acabou antes de chegar.', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O tempo acabou. Na próxima, mantenham o barco seco para ir mais rápido.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0;

    // lago: um mar largo, com riscos de espuma que descem quando o barco sobe
    const mar = sem(malha(caixa(120, 0.04, 120), 0x2a78c4, { roughness: 0.25, metalness: 0.1 })); mar.position.y = -0.1; grupo.add(mar);
    pecas.ondas = Array.from({ length: 34 }, (_, k) => {
      const o = sem(malha(caixa(1.6 + (k % 4) * 0.5, 0.03, 0.14), 0xcfe9ff, { emissive: 0x6aa8e0, emissiveIntensity: 0.35 }));
      o.position.set(-24 + (k * 7.31) % 48, -0.04, -16 + (k * 3.77) % 34); grupo.add(o); return o;
    });

    // casco e convé: tábuas no sentido do comprimento e uma proa pontuda
    const casco = sem(malha(caixa(LX * 2 + 1.1, 0.5, LZ * 2 + 0.7), 0x6b4a2a, { roughness: 0.9 })); casco.position.set(0, -0.5, 0); grupo.add(casco);
    const proaBase = new THREE.Group(); proaBase.position.set(0, 0, -LZ); proaBase.scale.set(1, 1, 0.42);
    const diamanteEscuro = sem(malha(caixa(LX * 1.52, 0.5, LX * 1.52), 0x6b4a2a, { roughness: 0.9 })); diamanteEscuro.rotation.y = Math.PI / 4; diamanteEscuro.position.y = -0.5;
    const diamante = sem(malha(caixa(LX * 1.38, 0.1, LX * 1.38), 0xa77a48, { roughness: 0.9 })); diamante.rotation.y = Math.PI / 4; diamante.position.y = 0.0;
    proaBase.add(diamanteEscuro, diamante); grupo.add(proaBase);
    for (let k = 0; k < 10; k++) {
      const tabua = sem(malha(caixa(LX * 2 / 10 - 0.06, 0.08, LZ * 2), k % 2 ? 0xb98a56 : 0xa77a48, { roughness: 0.95 }));
      tabua.position.set(-LX + LX / 10 + k * LX / 5, 0.07, 0); grupo.add(tabua);
    }

    // balde de lata e a roda no chão que mostra onde a mão alcança
    const balde = new THREE.Group(); balde.position.set(BALDE_POS.x, 0, BALDE_POS.z);
    const corpo = malha(new THREE.CylinderGeometry(0.95, 0.72, 1.2, 20, 1, true), 0x7f9ec0, { metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }); corpo.position.y = 0.7;
    const fundo = sem(malha(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 18), 0x2d6aa8)); fundo.position.y = 0.2;
    const agua = sem(malha(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 18), 0x4aa0f0, { emissive: 0x2a6ab0, emissiveIntensity: 0.5 })); agua.position.y = 1.0;
    const alca = sem(malha(new THREE.TorusGeometry(0.85, 0.07, 6, 18, Math.PI), 0x4a5a70)); alca.position.y = 1.3;
    balde.add(corpo, fundo, agua, alca); grupo.add(balde); pecas.balde = balde;
    pecas.roda = sem(malha(new THREE.RingGeometry(R_BALDE - 0.12, R_BALDE, 48), 0xffffff, { emissive: 0xbfe3ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    pecas.roda.rotation.x = -Math.PI / 2; pecas.roda.position.set(BALDE_POS.x, 0.16, BALDE_POS.z); grupo.add(pecas.roda);

    // água no convé: uma lâmina azul que fica mais forte conforme enche
    pecas.lamina = sem(malha(caixa(LX * 2, 0.04, LZ * 2), 0x2f8fe8, { emissive: 0x1a5fa8, emissiveIntensity: 0.5, transparent: true, opacity: 0, depthWrite: false }));
    pecas.lamina.position.y = 0.3; grupo.add(pecas.lamina);

    // margem de chegada (de frente, aproxima) e cais de partida (atrás, afasta)
    const margem = (x0) => {
      const g = new THREE.Group();
      const terra = sem(malha(caixa(60, 0.6, 9), 0xd8c58a, { roughness: 1 })); terra.position.set(0, 0, 0);
      const mato = sem(malha(caixa(60, 0.5, 5), 0x4f9a4a, { roughness: 1 })); mato.position.set(0, 0.15, -2.6);
      const pier = malha(caixa(5, 0.35, 5), 0x9b6a3a, { roughness: 0.9 }); pier.position.set(0, 0.34, 3.4); pier.castShadow = false;
      for (const dx of [-2.2, 2.2]) for (const dz of [1.4, 5]) { const est = malha(caixa(0.4, 1.4, 0.4), 0x6b4a2a); est.position.set(dx, 0.4, dz); g.add(est); }
      g.add(terra, mato, pier);
      for (let k = 0; k < 9; k++) {
        const tronco = sem(malha(caixa(0.5, 1.6, 0.5), 0x6b4a2a)); tronco.position.set(-22 + k * 5.4 + (k % 2) * 1.2, 1.2, -2.6);
        const copa = malha(new THREE.ConeGeometry(1.6 + (k % 3) * 0.3, 3.4 + (k % 2), 8), 0x2f7a3a, { roughness: 1 }); copa.position.set(tronco.position.x, 3.5, -2.6);
        g.add(tronco, copa);
      }
      g.position.set(0, 0, x0); grupo.add(g); return g;
    };
    pecas.destino = margem(-30);
    const bandeira = new THREE.Group(); bandeira.position.set(0, 0, 4.4);
    const mastro = malha(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), 0xe8e4d8); mastro.position.y = 2.7;
    const pano = sem(malha(caixa(2.2, 1.3, 0.08), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.6 })); pano.position.set(1.15, 4.6, 0);
    bandeira.add(mastro, pano); pecas.destino.add(bandeira);
    pecas.partida = margem(12);
    pecas.partida.rotation.y = Math.PI;

    // faixas dos lados: travessia (esquerda, o barquinho sobe) e água no barco (direita, o nível sobe)
    const zb = LZ - 0.4, zt = -LZ + 0.4, comp = zb - zt, xs = LX + 4.6;
    const trilho = sem(malha(caixa(1.5, 0.3, comp + 1.2), 0x3d2a18, { roughness: 1 })); trilho.position.set(-xs, 0.15, (zb + zt) / 2); grupo.add(trilho);
    pecas.fillT = sem(malha(caixa(1.1, 0.4, 1), 0xffc531, { emissive: 0xffa800, emissiveIntensity: 0.8 })); pecas.fillT.position.set(-xs, 0.25, zb); grupo.add(pecas.fillT);
    pecas.miniBarco = new THREE.Group();
    const mcasco = malha(caixa(1.3, 0.6, 2.0), 0xf5ecd8, { roughness: 0.7 }); mcasco.position.y = 0.7;
    const mproa = malha(new THREE.ConeGeometry(0.65, 1, 4), 0xf5ecd8); mproa.rotation.x = -Math.PI / 2; mproa.rotation.y = Math.PI / 4; mproa.position.set(0, 0.7, -1.45);
    pecas.miniBarco.add(mcasco, mproa); pecas.miniBarco.position.set(-xs, 0, zb); grupo.add(pecas.miniBarco);
    const bandTopo = malha(caixa(1.4, 0.8, 0.12), 0x6bff9a, { emissive: 0x6bff9a, emissiveIntensity: 0.9 }); bandTopo.position.set(-xs, 0.5, zt - 1); grupo.add(bandTopo);
    pecas.faixaT = { zb, zt };
    const tanque = sem(malha(caixa(1.6, 0.3, comp + 1.2), 0x233049, { roughness: 0.8 })); tanque.position.set(xs, 0.15, (zb + zt) / 2); grupo.add(tanque);
    pecas.fillA = sem(malha(caixa(1.2, 0.5, 1), 0x4aa0f0, { emissive: 0x2a6ab0, emissiveIntensity: 0.8 })); pecas.fillA.position.set(xs, 0.3, zb); grupo.add(pecas.fillA);
    const perigo = sem(malha(caixa(1.9, 0.45, 0.25), 0xff4a4a, { emissive: 0xff4a4a, emissiveIntensity: 0.9 })); perigo.position.set(xs, 0.3, zt - 0.5); grupo.add(perigo);
    const gota = malha(new THREE.SphereGeometry(0.55, 14, 10), 0x4aa0f0, { emissive: 0x2a6ab0, emissiveIntensity: 0.8 }); gota.position.set(xs, 0.7, zb + 1.5); grupo.add(gota);
    pecas.faixaA = { zb, zt, xs };

    pecas.jog = [...c.bonecos.keys()].map(i => {
      const cor = c.cores[i];
      const roda = sem(malha(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 28), cor, { emissive: cor, emissiveIntensity: 0.9, transparent: true, opacity: 0.7 }));
      const elo = sem(malha(new THREE.BoxGeometry(1, 0.16, 0.16), cor, { emissive: cor, emissiveIntensity: 1 }));
      roda.visible = elo.visible = false; grupo.add(roda, elo);
      return { roda, elo };
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;
    if (!pecas.jog) return;
    const prog = d.prog / 100, agua = d.agua / 100;

    // mar andando, margens aproximando e afastando
    pecas.ondas.forEach(o => { o.position.z += (3 + d.velocidade) * dt; if (o.position.z > 18) o.position.z -= 34; });
    pecas.destino.position.z = -LZ - 4.7 - (1 - prog) * 46;
    pecas.partida.position.z = LZ + 4.5 + prog * 46;

    // faixas: barquinho sobe e a água sobe
    const { zb, zt } = pecas.faixaT, zp = zb + (zt - zb) * prog, hT = Math.max(0.01, zb - zp);
    pecas.fillT.scale.z = hT; pecas.fillT.position.z = zb - hT / 2; pecas.miniBarco.position.z = zp;
    const za = zb + (zt - zb) * agua, hA = Math.max(0.01, zb - za);
    pecas.fillA.scale.z = hA; pecas.fillA.position.z = zb - hA / 2;
    const quente = Math.min(1, agua * 2), perigo = Math.max(0, agua * 2 - 1);       // azul, depois amarelo, depois vermelho
    pecas.fillA.material.color.setRGB(0.29 + 0.71 * quente, 0.63 + 0.12 * quente - 0.55 * perigo, 0.94 - 0.74 * quente);
    pecas.fillA.material.emissive.setRGB(0.1 + 0.5 * quente, 0.3 + 0.1 * quente - 0.35 * perigo, 0.5 - 0.4 * quente);
    pecas.lamina.material.opacity = Math.min(0.38, agua * 0.5);
    pecas.balde.rotation.z = d.baldeando ? 0.18 * Math.sin(t * 14) : 0;
    pecas.roda.material.opacity = d.baldeando ? 0.8 : 0.4 + 0.15 * Math.sin(t * 4);

    // furos
    const pool = c.pool('furos', d.furos.length, () => {
      const g = new THREE.Group();
      const aro = c.malha(new THREE.TorusGeometry(1, 0.17, 8, 24), 0x4a2f16, { roughness: 1 }); aro.rotation.x = Math.PI / 2; aro.position.y = 0.17;
      const buraco = c.malha(new THREE.CylinderGeometry(1, 1, 0.06, 24), 0x0b0b10); buraco.position.y = 0.13; buraco.castShadow = false;
      const jato = c.malha(new THREE.ConeGeometry(0.55, 1.6, 12), 0x8fd0ff, { emissive: 0x4aa0f0, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }); jato.position.y = 0.95; jato.castShadow = false;
      const prog = c.malha(new THREE.CylinderGeometry(1, 1, 0.09, 24), 0x6bff9a, { emissive: 0x6bff9a, emissiveIntensity: 0.9 }); prog.position.y = 0.22; prog.castShadow = false;
      const pads = [-1, 1].map(s => { const m = c.malha(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.6 }); m.castShadow = false; m.position.y = 0.16; m.userData.s = s; return m; });
      g.add(aro, buraco, jato, prog, ...pads); g.userData = { aro, buraco, jato, prog, pads }; return g;
    });
    d.furos.forEach((f, k) => {
      const g = pool[k], u = g.userData, r = f.grande ? 1.45 : 0.95;
      g.position.set(f.x, 0, f.z);
      u.aro.scale.setScalar(r + 0.15); u.buraco.scale.set(r, 1, r);
      const pulso = 1 + 0.12 * Math.sin(t * 9 + f.id);
      u.jato.scale.set(r * pulso, 0.6 + 0.4 * pulso, r * pulso); u.jato.visible = f.prog < 0.5;
      u.prog.scale.set(Math.max(0.02, f.prog * r), 1, Math.max(0.02, f.prog * r));
      u.pads.forEach((m, q) => {
        m.visible = f.grande; m.position.set(m.userData.s * (r + 1.0), 0.16, 0);
        const aceso = f.maos > q;
        m.material.color.set(aceso ? 0x6bff9a : 0xffd23f); m.material.emissive.set(aceso ? 0x1fa050 : 0xffa800);
        m.scale.setScalar(aceso ? 1.1 : 1 + 0.12 * Math.sin(t * 7 + q));
      });
    });

    // remendos que ficam (progresso visivel)
    const rem = c.pool('remendos', d.remendos.length, () => {
      const g = new THREE.Group();
      const tabua = c.malha(new THREE.BoxGeometry(1, 0.1, 0.8), 0xd9a35c, { roughness: 0.9 }); tabua.position.y = 0.18; tabua.castShadow = false;
      const prego = c.malha(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8), 0x555555); prego.position.set(0.3, 0.25, 0.2); prego.castShadow = false;
      const prego2 = prego.clone(); prego2.position.set(-0.3, 0.25, -0.2);
      g.add(tabua, prego, prego2); g.userData = { tabua }; return g;
    });
    d.remendos.forEach((r, k) => { const g = rem[k]; g.position.set(r.x, 0, r.z); g.rotation.y = r.giro; g.scale.set(r.grande ? 3 : 2, 1, r.grande ? 1.9 : 1.4); });

    // maos: roda embaixo de quem ajuda e uma ligacao ate o furo ou o balde
    p.jogadores.forEach((j, i) => {
      const m = pecas.jog[i], a = d.alvo[i];
      m.roda.visible = m.elo.visible = !!a;
      if (!a) return;
      const alvo = a.tipo === 'balde' ? BALDE_POS : d.furos.find(f => f.id === a.id);
      m.roda.position.set(j.x, 0.14, j.z); m.roda.scale.setScalar(0.8 + 0.2 * Math.sin(t * 10 + i));
      const len = Math.max(0.01, dist(j, alvo));
      m.elo.position.set((j.x + alvo.x) / 2, 0.5, (j.z + alvo.z) / 2); m.elo.rotation.y = -Math.atan2(alvo.z - j.z, alvo.x - j.x); m.elo.scale.set(len, 1, 1);
    });

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'furo') c.particulas(e.x, 0.6, e.z, 0x8fd0ff, e.grande ? 30 : 18, 8);
      else if (e.tipo === 'tampou') c.particulas(e.x, 0.8, e.z, 0x6bff9a, e.grande ? 34 : 20, 9);
      else if (e.tipo === 'chegada') c.particulas(0, 1.5, 0, 0xffd23f, 40, 12);
      else if (e.tipo === 'balde') c.particulas(BALDE_POS.x, 1.6, BALDE_POS.z, 0x8fd0ff, 10, 7);
    }
  },
};
