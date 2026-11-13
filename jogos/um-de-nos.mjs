// Um de nos: 8 esferas iguais, 6 robos e 2 jogadores. Cada jogador tem um tiro so.
// No comeco as esferas pulam uma por vez; o celular vibra na hora em que a sua pula.
import { posiciona } from '../logica.mjs';

const TEMPO = 35, LX = 10, LZ = 6.5;
const N = 8, R = 0.7, VEL = 5, RESPOSTA = 8;         // todas andam igual: mesma velocidade, mesma inercia
const ALCANCE = 2.5;
const SEQ_INI = 0.5, SEQ_ESPACO = 0.5, SEQ_FIM = SEQ_INI + N * SEQ_ESPACO, T_SALTO = 0.4;
const T_RAIO = 0.3, T_AVISO = 1.3;
const NEUTRA = 0xcfd6e6;

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
  id: 'um-de-nos', nome: 'Um de nós',
  dica: 'Você é uma das esferas. Descubra qual é o outro jogador e acerte seu único tiro!',
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
      esf, dono: [a, b], ordem, vez: 0, tiro: [true, true], revelado: [false, false],
      raios: [], faiscas: [], tAviso: 0, aviso: 'QUAL É VOCÊ? SINTA O CELULAR', avisoCor: '#ffd84d',
    };
    for (const i of [0, 1]) p.celular[i] = { texto: 'Sua esfera pula quando o celular vibrar', vibra: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados, livre = p.t >= SEQ_FIM;

    // abertura: uma esfera pula por vez; o celular do dono vibra junto
    while (d.vez < N && p.t >= SEQ_INI + d.vez * SEQ_ESPACO) {
      const k = d.ordem[d.vez++];
      d.esf[k].salto = T_SALTO; p.eventos.push('pulo');
      const i = d.dono.indexOf(k);
      if (i >= 0) vibra(p, i);
    }
    if (livre && !d.liberou) {
      d.liberou = true; d.aviso = '';
      for (const i of [0, 1]) p.celular[i] = { ...p.celular[i], texto: 'Você tem 1 tiro: chegue perto do outro e ATIRE' };
    }
    d.tAviso -= dt;
    if (d.liberou && d.tAviso <= 0) d.aviso = '';
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
      d.tiro[i] = false; d.revelado[i] = true;
      p.eventos.push('dash');
      if (alvo < 0) {                                  // tiro no vazio: gastou e se entregou
        d.faiscas.push({ x: eu.x, z: eu.z, de: i, n: 10 });
        d.aviso = 'TIRO NO VAZIO!'; d.tAviso = T_AVISO;
      } else {
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
        d.aviso = 'ERA UM ROBÔ!'; d.tAviso = T_AVISO;
      }
      p.celular[i] = { ...p.celular[i], texto: 'Sem tiro e revelado: fuja do outro!' };
    }

    if ((!d.tiro[0] && !d.tiro[1]) || p.t >= TEMPO) { d.revelado = [true, true]; d.aviso = ''; return -1; }
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
    for (const f of d.faiscas.splice(0)) c.particulas(f.x, R, f.z, f.de < 0 ? NEUTRA : cores[f.de], f.n, f.n > 20 ? 11 : 8);
  },
};
