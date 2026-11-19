// Queimada na festa (todos contra todos ou times). Pegue uma bola do chão, arremesse (A) e acerte um rival; B pula a bola rasteira.
// Cada um tem 3 vidas. Com 2 jogadores, ou em times (2 contra 2), a quadra é dividida ao meio e ninguém cruza a linha. Com 3 ou 4
// em todos contra todos é uma quadra só. Parado, o arremesso vai no rival mais perto. Quem fica sem vidas sai e espera.
// Vence o último de pé (ou a dupla que ainda tem alguém), ou quem tiver mais vidas no fim do tempo (em times, vidas da dupla somadas).
import { posiciona, posicionaCantos, posicionaRoda, timeDe, elimina, quem, RAIO } from '../logica.mjs';

const LX = 11, R_BOLA = 0.45, V_BOLA = 17, VIDAS = 3, LIMITE = 40;
const T_REPOE = 2.5, T_IMUNE = 1, EMPURRAO = 10, ALTURA_DESVIO = 0.7, AMARELO = 0xffd23f;
const NOME_TIME = ['laranja', 'roxa'];

const times = p => p.modo === 'times';
const dividida = p => times(p) || p.jogadores.length === 2;                 // quadra com linha no meio
const dono = p => i => (times(p) ? timeDe(p, i) : i);                       // de quem é a vida no placar
const ladoDe = (p, i) => (!dividida(p) ? 0 : times(p) ? timeDe(p, i) * 2 - 1 : i * 2 - 1);      // -1 esquerda, 1 direita, 0 quadra livre
const inimigos = (p, a, b) => a !== b && (!times(p) || timeDe(p, a) !== timeDe(p, b));
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);

function novaBola(p, lado) {
  const lz = p.arena.lz;
  return {
    x: lado ? lado * (1.5 + p.rng() * 8.5) : (p.rng() * 2 - 1) * (LX - 1.5),
    z: (p.rng() * 2 - 1) * (lz - 1), vx: 0, vz: 0, estado: 'chao', dono: -1, quiques: 0,
  };
}

// Direção do arremesso: a do joystick; parado, no rival mais perto.
function mira(p, i, sinal = 1) {      // sinal -1 com o modificador espelho, igual ao andar
  const j = p.jogadores[i], m = Math.hypot(j.ent.x, j.ent.y);
  if (m > 0.3) return [sinal * j.ent.x / m, sinal * j.ent.y / m];
  let alvo = null, menor = Infinity;
  p.jogadores.forEach((o, k) => {
    const dist = Math.hypot(o.x - j.x, o.z - j.z);
    if (o.vivo && inimigos(p, i, k) && dist < menor) { menor = dist; alvo = o; }
  });
  return alvo && menor > 1e-6 ? [(alvo.x - j.x) / menor, (alvo.z - j.z) / menor] : [ladoDe(p, i) > 0 ? -1 : 1, 0];
}

function quica(b, fundo) {          // bola arremessada: parede do fundo (ou a segunda lateral) mata o arremesso
  if (b.estado !== 'voo') return;
  b.quiques++;
  if (fundo || b.quiques >= 2) { b.estado = 'chao'; b.dono = -1; b.vx *= 0.45; b.vz *= 0.45; }
}

// Nenhum lado (ou a quadra livre) fica sem bola no chão: aparece uma nova, ou uma de chão vem para lá.
function repoe(p) {
  const d = p.dados, js = p.jogadores, max = dividida(p) ? 6 : js.length + 3;
  for (const lado of dividida(p) ? [-1, 1] : [0]) {
    if (!js.some((j, i) => j.vivo && ladoDe(p, i) === lado)) continue;
    const tem = d.bolas.some(b => (b.estado === 'chao' && (!lado || b.x * lado > 0)) || (lado && b.estado === 'mao' && ladoDe(p, b.dono) === lado));
    if (tem) continue;
    if (d.bolas.length < max) d.bolas.push(novaBola(p, lado));
    else { const b = d.bolas.find(x => x.estado === 'chao'); if (b) Object.assign(b, novaBola(p, lado)); }
  }
}

function somaVidas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Último dono (jogador ou dupla) com alguém de pé; no tempo, o de mais vidas (igual dá empate).
function resultado(p) {
  const d = p.dados, de = dono(p), vivos = new Set(p.jogadores.flatMap((j, i) => (j.vivo ? [de(i)] : [])));
  if (vivos.size <= 1) return vivos.size ? [...vivos][0] : -1;
  if (p.t >= LIMITE) {
    const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) {
    d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`;
    d.avisoCor = '#ffd23f';
  }
  p.jogadores.forEach((j, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (!j.vivo) t = 'Você saiu. Torça pelos outros!';
    else {
      const naMao = d.bolas.some(b => b.estado === 'mao' && b.dono === i);
      t = `Vidas: ${d.vidas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} ${naMao ? 'Você está com a bola, jogue!' : 'Pegue uma bola no chão.'}`;
    }
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'queimada-festa', genero: 'mira', nome: 'Queimada na festa', dica: 'Pegue a bola e arremesse nos rivais, e quem sobrar com vidas vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Joga', b: 'Pula' }, semDash: true, rotulo: 'vidas', duracao: LIMITE,

  inicia(p) {
    const n = p.jogadores.length, lz = 6.5 + (n - 2);           // a quadra cresce com o número de jogadores
    p.arena = { tipo: 'ret', lx: LX, lz, parede: true };
    if (times(p)) posicionaCantos(p, 6, lz * 0.5);              // dupla A à esquerda, dupla B à direita
    else if (n === 2) posiciona(p, 6);
    else { posicionaRoda(p, 1); p.jogadores.forEach(j => { j.x *= 5.5; j.z *= lz - 2.5; }); }
    const bolas = dividida(p) ? [-1, 1, -1, 1].map(l => novaBola(p, l)) : Array.from({ length: n + 1 }, () => novaBola(p, 0));
    p.dados = {
      bolas, vidas: Array(n).fill(VIDAS), imune: Array(n).fill(0), repoe: T_REPOE, acerto: { n: 0, x: 0, z: 0, quem: 0 },
      placar: [], inventario: [], aviso: '', avisoCor: '#ffffff',
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, sinal = p.mod?.inverte ? -1 : 1;

    d.repoe -= dt;
    if (d.repoe <= 0) { d.repoe = T_REPOE; repoe(p); }

    js.forEach((j, i) => {
      if (!j.vivo) return;
      const lado = ladoDe(p, i);
      if (lado && j.x * lado < RAIO) { j.x = lado * RAIO; if (j.vx * lado < 0) j.vx = 0; }     // ninguém cruza a linha
      d.imune[i] = Math.max(0, d.imune[i] - dt);
      let minha = d.bolas.find(b => b.estado === 'mao' && b.dono === i);
      if (!minha) {
        minha = d.bolas.find(b => b.estado === 'chao' && Math.hypot(b.x - j.x, b.z - j.z) < RAIO + R_BOLA + 0.15);
        if (minha) { minha.estado = 'mao'; minha.dono = i; minha.vx = minha.vz = 0; p.eventos.push('moeda'); }
      } else if (j.apertouA) {
        const [dx, dz] = mira(p, i, sinal);
        Object.assign(minha, { estado: 'voo', quiques: 0, x: j.x + dx * 0.9, z: j.z + dz * 0.9, vx: dx * V_BOLA, vz: dz * V_BOLA });
        p.eventos.push('dash');
      }
      if (minha?.estado === 'mao') { minha.x = j.x; minha.z = j.z; }
    });

    for (const b of d.bolas) {
      if (b.estado === 'mao') continue;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.estado === 'chao') { const at = Math.pow(0.05, dt); b.vx *= at; b.vz *= at; }
      if (Math.abs(b.z) > p.arena.lz - R_BOLA) { b.z = Math.sign(b.z) * (p.arena.lz - R_BOLA); b.vz *= -1; quica(b, false); }
      if (Math.abs(b.x) > LX - R_BOLA) { b.x = Math.sign(b.x) * (LX - R_BOLA); b.vx *= -1; quica(b, true); }
      if (b.estado !== 'voo') continue;
      const k = js.findIndex((o, q) => o.vivo && inimigos(p, b.dono, q) && d.imune[q] <= 0 && o.y <= ALTURA_DESVIO && Math.hypot(b.x - o.x, b.z - o.z) <= RAIO + R_BOLA);
      if (k < 0) continue;
      const o = js[k], v = Math.hypot(b.vx, b.vz) || 1;
      d.vidas[k]--; d.imune[k] = T_IMUNE;
      o.vx += b.vx / v * EMPURRAO; o.vz += b.vz / v * EMPURRAO;
      d.acerto = { n: d.acerto.n + 1, x: o.x, z: o.z, quem: k };
      b.estado = 'chao'; b.dono = -1; b.vx *= -0.3; b.vz *= 0.3;
      p.eventos.push('batida');
      p.celular[k] = { ...p.celular[k], vibra: (p.celular[k].vibra ?? 0) + 1 };
      if (d.vidas[k] <= 0) {
        elimina(p, o, 12); p.eventos.push('queda');
        for (const x of d.bolas) if (x.estado === 'mao' && x.dono === k) Object.assign(x, { estado: 'chao', dono: -1, vx: 0, vz: 0 });     // largou a bola que levava
      }
    }

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, lz = p.arena.lz;
    pecas.visto = 0; pecas.pips = []; pecas.setas = [];
    if (dividida(p)) {
      const linha = malha(new THREE.BoxGeometry(0.25, 0.3, lz * 2), 0xffffff, { emissive: 0x888888 });
      linha.position.y = 0.15; grupo.add(linha);
      for (const lado of [-1, 1]) {
        const cor = times(p) ? c.times[lado < 0 ? 0 : 1] : c.cores[lado < 0 ? 0 : 1];
        const metade = malha(new THREE.BoxGeometry(LX - 0.2, 0.02, lz * 2), cor, { transparent: true, opacity: 0.22 });
        metade.position.set(lado * (LX / 2 + 0.05), 0.01, 0); grupo.add(metade);
      }
    }
    c.bonecos.forEach((_, i) => {
      const cor = corDe(c, i), g = new THREE.Group();          // vidas: bolinhas da cor do jogador (ou da dupla) acima do nome
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.8 });
        m.castShadow = false; m.position.x = (k - 1) * 0.8; g.add(m); return m;
      });
      grupo.add(g); pecas.pips.push({ g, pips });
      const seta = malha(new THREE.ConeGeometry(0.28, 0.8, 10), cor, { emissive: cor, emissiveIntensity: 0.5 });
      seta.rotation.z = -Math.PI / 2; seta.visible = false; grupo.add(seta); pecas.setas.push(seta);
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c, sinal = p.mod?.inverte ? -1 : 1;
    const ms = c.pool('bolas', d.bolas.length, () => c.malha(new THREE.SphereGeometry(R_BOLA, 18, 12), AMARELO, { emissive: AMARELO, emissiveIntensity: 0.3, roughness: 0.35 }));
    d.bolas.forEach((b, n) => {
      const m = ms[n], voo = b.estado === 'voo';
      const y = b.estado === 'mao' ? RAIO * 2 + R_BOLA + 0.4 + p.jogadores[b.dono].y : voo ? 0.9 : R_BOLA * 1.5;
      m.position.set(b.x, y, b.z);
      m.material.emissiveIntensity = voo ? 0.9 : 0.3;
      m.scale.setScalar(voo ? 1.9 : 1.5);       // a bola é pequena para o sofá: o desenho é maior que o círculo de colisão
    });
    p.jogadores.forEach((j, i) => {
      const alvo = pecas.pips[i], bo = c.bonecos[i];
      alvo.g.visible = j.vivo && d.vidas[i] > 0;
      alvo.g.position.set(bo.position.x, bo.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, bo.position.z);
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
      if (j.vivo) bo.visible = d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;     // pisca enquanto imune
      const seta = pecas.setas[i], naMao = j.vivo && p.fase === 'jogando' && d.bolas.some(b => b.estado === 'mao' && b.dono === i);
      seta.visible = naMao;
      if (naMao) {
        const [dx, dz] = mira(p, i, sinal);
        seta.position.set(j.x + dx * 1.6, 0.35, j.z + dz * 1.6); seta.rotation.y = -Math.atan2(dz, dx);
      }
    });
    if (d.acerto.n !== pecas.visto) {
      pecas.visto = d.acerto.n;
      c.particulas(d.acerto.x, 1, d.acerto.z, corDe(c, d.acerto.quem), 18, 8);
    }
  },
};
