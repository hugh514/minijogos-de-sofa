// Um de nos: 8 esferas iguais, 6 robos e 2 jogadores. Cada jogador tem um tiro por vez; o tiro volta 6 s depois de gasto.
// Quem atira se revela (a esfera ganha a sua cor), entao errar vira cacada: o outro ja sabe quem voce e.
// No comeco as esferas pulam uma por vez; o celular vibra na hora em que a sua pula. Sem vibracao (iPhone) tambem da:
// a TV conta os pulos (PULO 3 DE 8) e o celular diz em que pulo esta a sua esfera e avisa quando ela pula.
import { posiciona } from '../logica.mjs';

const TEMPO = 35, LX = 10, LZ = 6.5;
const N = 8, R = 0.7, VEL = 5, RESPOSTA = 8;         // todas andam igual: mesma velocidade, mesma inercia
const ALCANCE = 2.5;
const SEQ_INI = 0.5, SEQ_ESPACO = 0.5, SEQ_FIM = SEQ_INI + N * SEQ_ESPACO, T_SALTO = 0.4;
const T_RAIO = 0.3, T_AVISO = 1.3, T_RECARGA = 6;
const NEUTRA = 0xcfd6e6, T_PULSO = 0.6;

function vibra(p, i) { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; }

// Passeio do robo: anda, para, muda de direcao, como alguem mexendo no joystick.
function decide(p, e) {
  if (p.rng() < 0.25) { e.ix = e.iz = 0; e.t = 0.3 + p.rng() * 1.0; return; }
  const atual = Math.atan2(e.iz, e.ix);
  const ang = (e.ix || e.iz) && p.rng() < 0.5 ? atual + (p.rng() - 0.5) * 2.2 : p.rng() * Math.PI * 2;
  const forca = p.rng() < 0.7 ? 1 : 0.5 + p.rng() * 0.5;
  e.ix = Math.cos(ang) * forca; e.iz = Math.sin(ang) * forca;
  e.t = 0.35 + p.rng() * 1.5;
}

export default {
  id: 'um-de-nos', genero: 'blefe', nome: 'Um de nós',
  dica: 'Uma esfera é sua, outra é do rival e as demais são robôs. Atire no rival! Errar te revela.',
  controle: { modo: 'padrao', a: 'ATIRAR', b: '' },
  semMovimento: true, semDash: true, semPulo: true, duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 3);                                 // os bonecos ficam escondidos e parados; quem joga sao as esferas
    const esf = [];
    for (let k = 0; k < N; k++)                      // 4 colunas por 2 linhas, com folga
      esf.push({
        x: (k % 4 - 1.5) * 4.6 + (p.rng() - 0.5) * 2, z: (k < 4 ? -3 : 3) + (p.rng() - 0.5) * 2.4,
        vx: 0, vz: 0, ix: 0, iz: 0, t: p.rng() * 0.5, salto: 0, morta: false,
      });
    const a = Math.floor(p.rng() * N), b = (a + 1 + Math.floor(p.rng() * (N - 1))) % N;
    const ordem = esf.map((_, k) => k);
    for (let i = N - 1; i > 0; i--) { const k = Math.floor(p.rng() * (i + 1)); [ordem[i], ordem[k]] = [ordem[k], ordem[i]]; }
    p.dados = {
      esf, dono: [a, b], ordem, vez: 0, tiro: [true, true], recarga: [0, 0], revelado: [false, false],
      raios: [], faiscas: [], pulsos: [], tAviso: 0, aviso: 'Qual é você? Conte os pulos', avisoCor: '#ffd84d',
    };
    for (const i of [0, 1]) p.celular[i] = { texto: `Sua esfera é a ${ordem.indexOf(p.dados.dono[i]) + 1}ª a pular. Conte os pulos na TV`, vibra: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados, livre = p.t >= SEQ_FIM;

    // abertura: uma esfera pula por vez; o celular do dono vibra junto
    while (d.vez < N && p.t >= SEQ_INI + d.vez * SEQ_ESPACO) {
      const k = d.ordem[d.vez++];
      d.esf[k].salto = T_SALTO; p.eventos.push('pulo');
      d.pulsos.push({ x: d.esf[k].x, z: d.esf[k].z, t: 0 });
      d.aviso = `Pulo ${d.vez} de ${N}`; d.avisoCor = '#ffd84d';
      for (const j of [0, 1]) {                        // so o dono recebe o "é você", e o texto fica igual para quem nao tem vibracao
        const meu = d.ordem.indexOf(d.dono[j]) + 1;
        p.celular[j] = { ...p.celular[j], texto: meu === d.vez ? 'É você! Guarde onde ela está' : `Pulo ${d.vez} de ${N}. A sua é a ${meu}ª` };
      }
      const i = d.dono.indexOf(k);
      if (i >= 0) vibra(p, i);
    }
    if (livre && !d.liberou) {
      d.liberou = true; d.aviso = '';
      for (const i of [0, 1]) p.celular[i] = { ...p.celular[i], texto: 'Você tem 1 tiro: chegue perto do outro e atire' };
    }
    d.tAviso -= dt;
    for (const i of [0, 1]) {                        // o tiro gasto volta depois de T_RECARGA
      if (!livre || d.tiro[i]) continue;
      d.recarga[i] -= dt;
      if (d.recarga[i] <= 0) { d.tiro[i] = true; p.celular[i] = { ...p.celular[i], texto: 'Tiro de volta! Cace o outro, ele já foi revelado' }; vibra(p, i); }
    }
    if (d.liberou && d.tAviso <= 0) d.aviso = '';
    for (const o of d.pulsos) o.t += dt;
    d.pulsos = d.pulsos.filter(o => o.t < T_PULSO);
    for (const r of d.raios) r.t -= dt;
    d.raios = d.raios.filter(r => r.t > 0);

    // movimento: o mesmo para robo e jogador, so muda de onde vem o comando
    for (const [k, e] of d.esf.entries()) {
      e.salto = Math.max(0, e.salto - dt);
      if (e.morta) continue;
      const i = d.dono.indexOf(k);
      if (!livre) { e.ix = e.iz = 0; }
      else if (i >= 0) { e.ix = p.jogadores[i].ent.x; e.iz = p.jogadores[i].ent.y; }
      else {
        e.t -= dt;
        const naParede = (Math.abs(e.x) >= LX - R - 0.01 && e.ix * e.x > 0) || (Math.abs(e.z) >= LZ - R - 0.01 && e.iz * e.z > 0);
        if (e.t <= 0 || (naParede && e.t > 0.25)) {
          decide(p, e);
          if (naParede) { e.ix = -Math.sign(e.x) * Math.abs(e.ix); e.iz = -Math.sign(e.z) * Math.abs(e.iz); }   // volta para dentro
        }
      }
      const k2 = Math.min(1, RESPOSTA * dt);
      e.vx += (e.ix * VEL - e.vx) * k2; e.vz += (e.iz * VEL - e.vz) * k2;
      e.x += e.vx * dt; e.z += e.vz * dt;
    }
    const vivas = d.esf.filter(e => !e.morta);
    for (let a = 0; a < vivas.length; a++)             // esferas nao se atravessam (sem som, para nao entregar ninguem)
      for (let b = a + 1; b < vivas.length; b++) {
        const A = vivas[a], B = vivas[b], dx = B.x - A.x, dz = B.z - A.z, dist = Math.hypot(dx, dz);
        if (dist >= R * 2 || dist === 0) continue;
        const s = (R * 2 - dist) / 2 / dist;
        A.x -= dx * s; A.z -= dz * s; B.x += dx * s; B.z += dz * s;
      }
    for (const e of vivas) {
      e.x = Math.max(-LX + R, Math.min(LX - R, e.x)); e.z = Math.max(-LZ + R, Math.min(LZ - R, e.z));
    }

    // tiro: um so por jogador, pega a esfera mais proxima dentro do alcance
    for (const i of [0, 1]) {
      if (!livre || !d.tiro[i] || !p.jogadores[i].apertouA) continue;
      const eu = d.esf[d.dono[i]];
      let alvo = -1, menor = ALCANCE;
      for (const [k, e] of d.esf.entries()) {
        const dist = Math.hypot(e.x - eu.x, e.z - eu.z);
        if (e !== eu && !e.morta && dist <= menor) { menor = dist; alvo = k; }
      }
      if (alvo < 0) {                                  // ninguem no alcance: o tiro nao sai (toque sem querer nao gasta nem entrega)
        p.celular[i] = { ...p.celular[i], texto: 'Ninguém perto: chegue em outra esfera e atire' };
        vibra(p, i);
        continue;
      }
      d.tiro[i] = false; d.recarga[i] = T_RECARGA; d.revelado[i] = true;
      p.eventos.push('dash');
      const e = d.esf[alvo];
      d.raios.push({ x1: eu.x, z1: eu.z, x2: e.x, z2: e.z, t: T_RAIO, de: i });
      e.morta = true; p.eventos.push('explosao');
      if (alvo === d.dono[1 - i]) {                  // acertou o outro jogador
        d.revelado = [true, true]; d.aviso = '';
        d.faiscas.push({ x: e.x, z: e.z, de: 1 - i, n: 30 });
        vibra(p, 1 - i);
        const j = p.jogadores[i]; j.x = eu.x; j.z = eu.z;      // a festa do vencedor sai da esfera dele
        return i;
      }
      d.faiscas.push({ x: e.x, z: e.z, de: -1, n: 18 });
      d.aviso = 'Era um robô!'; d.tAviso = T_AVISO;
      p.celular[i] = { ...p.celular[i], texto: 'Você foi revelado! Fuja do outro: o tiro volta em 6 s' };
    }

    if (p.t >= TEMPO) { d.revelado = [true, true]; d.aviso = ''; return -1; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.esf = c.p.dados.esf.map(() => {
      const m = malha(new THREE.SphereGeometry(R, 28, 20), NEUTRA, { roughness: 0.35, emissive: 0x000000 });
      grupo.add(m);
      return m;
    });
  },

  desenha(c) {
    const { THREE, p, pecas, cores } = c, d = p.dados;
    for (const b of c.bonecos) b.visible = false;
    d.esf.forEach((e, k) => {
      const m = pecas.esf[k], i = d.dono.indexOf(k), mostra = i >= 0 && d.revelado[i];
      m.visible = !e.morta;
      m.position.set(e.x, R + Math.sin(Math.PI * (1 - e.salto / T_SALTO)) * (e.salto > 0 ? 1.4 : 0), e.z);
      m.material.color.set(mostra ? cores[i] : NEUTRA);
      m.material.emissive.set(mostra ? cores[i] : 0x000000);
      m.material.emissiveIntensity = mostra ? 0.45 : 0;
      m.scale.setScalar(mostra ? 1.12 : 1);
    });
    const rs = c.pool('raios', d.raios.length, () => {
      const m = c.malha(new THREE.BoxGeometry(1, 0.22, 0.22), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.2 });
      m.castShadow = false;
      return m;
    });
    d.raios.forEach((r, n) => {
      const dx = r.x2 - r.x1, dz = r.z2 - r.z1, m = rs[n];
      m.position.set((r.x1 + r.x2) / 2, R, (r.z1 + r.z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      m.scale.set(Math.max(0.1, Math.hypot(dx, dz)), 1, 1);
      m.material.color.set(cores[r.de]); m.material.emissive.set(cores[r.de]);
    });
    // anel branco no chao a cada pulo da abertura: ajuda a contar, sem entregar de quem e a esfera
    const os = c.pool('pulsos', d.pulsos.length, () => {
      const m = c.malha(new THREE.RingGeometry(0.8, 1, 36), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
    });
    d.pulsos.forEach((o, n) => {
      const f = o.t / T_PULSO, r = 0.9 + f * 1.6;
      os[n].position.set(o.x, 0.06, o.z); os[n].scale.set(r, r, 1); os[n].material.opacity = 0.9 * (1 - f);
    });
    for (const f of d.faiscas.splice(0)) c.particulas(f.x, R, f.z, f.de < 0 ? NEUTRA : cores[f.de], f.n, f.n > 20 ? 11 : 8);
  },
};
