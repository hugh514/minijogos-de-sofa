// Queimada: cada um na sua metade. Pegue a bola do chao, arremesse (A) e acerte o outro. B pula a bola rasteira.
import { posiciona, elimina, maiorPlacar, RAIO } from '../logica.mjs';

const LX = 11, LZ = 6.5, R_BOLA = 0.45, V_BOLA = 17, VIDAS = 3, LIMITE = 45, MAX_BOLAS = 6;
const T_REPOE = 2.5, T_IMUNE = 1, EMPURRAO = 10, ALTURA_DESVIO = 0.7, AMARELO = 0xffd23f;

function novaBola(p, lado) {
  return { x: lado * (1.5 + p.rng() * 8.5), z: (p.rng() * 2 - 1) * (LZ - 1), vx: 0, vz: 0, estado: 'chao', dono: -1, quiques: 0 };
}

// Direcao do arremesso: a do joystick; parado, reto para o campo do outro.
function mira(j, i, sinal = 1) {      // sinal -1 com o modificador espelho, igual ao andar
  const m = Math.hypot(j.ent.x, j.ent.y);
  return m > 0.3 ? [sinal * j.ent.x / m, sinal * j.ent.y / m] : [i ? -1 : 1, 0];
}

function quica(b, fundo) {          // bola arremessada: parede do fundo (ou a segunda lateral) mata o arremesso
  if (b.estado !== 'voo') return;
  b.quiques++;
  if (fundo || b.quiques >= 2) { b.estado = 'chao'; b.dono = -1; b.vx *= 0.45; b.vz *= 0.45; }
}

export default {
  id: 'queimada', genero: 'mira', nome: 'Queimada', dica: 'Passe por cima de uma bola para pegar e aperte Joga para acertar o outro. Pula desvia. 3 vidas cada!',
  controle: { modo: 'padrao', a: 'JOGA', b: 'PULA' }, semDash: true, rotulo: 'vidas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 6);
    p.dados = {
      bolas: [novaBola(p, -1), novaBola(p, 1), novaBola(p, -1), novaBola(p, 1)],
      placar: [VIDAS, VIDAS], imune: [0, 0], repoe: T_REPOE, acerto: { n: 0, x: 0, z: 0, quem: 0 },
    };
  },

  atualiza(p, dt) {
    const d = p.dados;

    // nenhuma metade fica sem bola: aparece uma nova (ou vem uma parada do outro lado)
    d.repoe -= dt;
    if (d.repoe <= 0) {
      d.repoe = T_REPOE;
      for (const lado of [-1, 1]) {
        const i = lado < 0 ? 0 : 1;
        if (d.bolas.some(b => (b.estado === 'chao' && b.x * lado > 0) || (b.estado === 'mao' && b.dono === i))) continue;
        if (d.bolas.length < MAX_BOLAS) d.bolas.push(novaBola(p, lado));
        else { const b = d.bolas.find(x => x.estado === 'chao'); if (b) Object.assign(b, novaBola(p, lado)); }
      }
    }

    p.jogadores.forEach((j, i) => {
      if (!j.vivo) return;
      const lado = i ? 1 : -1;
      if (j.x * lado < RAIO) { j.x = lado * RAIO; if (j.vx * lado < 0) j.vx = 0; }     // ninguem cruza a linha
      d.imune[i] = Math.max(0, d.imune[i] - dt);
      let minha = d.bolas.find(b => b.estado === 'mao' && b.dono === i);
      if (!minha) {
        minha = d.bolas.find(b => b.estado === 'chao' && Math.hypot(b.x - j.x, b.z - j.z) < RAIO + R_BOLA + 0.15);
        if (minha) { minha.estado = 'mao'; minha.dono = i; minha.vx = minha.vz = 0; p.eventos.push('moeda'); }
      } else if (j.apertouA) {
        const [dx, dz] = mira(j, i, p.mod?.inverte ? -1 : 1);
        Object.assign(minha, { estado: 'voo', quiques: 0, x: j.x + dx * 0.9, z: j.z + dz * 0.9, vx: dx * V_BOLA, vz: dz * V_BOLA });
        p.eventos.push('dash');
      }
      if (minha?.estado === 'mao') { minha.x = j.x; minha.z = j.z; }
    });

    for (const b of d.bolas) {
      if (b.estado === 'mao') continue;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.estado === 'chao') { const at = Math.pow(0.05, dt); b.vx *= at; b.vz *= at; }
      if (Math.abs(b.z) > LZ - R_BOLA) { b.z = Math.sign(b.z) * (LZ - R_BOLA); b.vz *= -1; quica(b, false); }
      if (Math.abs(b.x) > LX - R_BOLA) { b.x = Math.sign(b.x) * (LX - R_BOLA); b.vx *= -1; quica(b, true); }
      if (b.estado !== 'voo') continue;
      const alvo = 1 - b.dono, o = p.jogadores[alvo];
      if (!o.vivo || d.imune[alvo] > 0 || o.y > ALTURA_DESVIO || Math.hypot(b.x - o.x, b.z - o.z) > RAIO + R_BOLA) continue;
      const v = Math.hypot(b.vx, b.vz) || 1;
      d.placar[alvo]--; d.imune[alvo] = T_IMUNE;
      o.vx += b.vx / v * EMPURRAO; o.vz += b.vz / v * EMPURRAO;
      d.acerto = { n: d.acerto.n + 1, x: o.x, z: o.z, quem: alvo };
      b.estado = 'chao'; b.dono = -1; b.vx *= -0.3; b.vz *= 0.3;
      p.eventos.push('batida');
      p.celular[alvo] = { ...p.celular[alvo], vibra: (p.celular[alvo].vibra ?? 0) + 1 };
      if (d.placar[alvo] <= 0) { elimina(p, o, 12); p.eventos.push('queda'); }
    }

    const [a, b] = d.placar;
    if (a <= 0 || b <= 0) return a <= 0 && b <= 0 ? -1 : a <= 0 ? 1 : 0;
    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0; pecas.vidas = [[], []]; pecas.setas = [];
    const linha = malha(new THREE.BoxGeometry(0.25, 0.3, LZ * 2), 0xffffff, { emissive: 0x888888 });
    linha.position.y = 0.15; grupo.add(linha);
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1;
      const metade = malha(new THREE.BoxGeometry(LX - 0.2, 0.02, LZ * 2), cores[i], { transparent: true, opacity: 0.22 });
      metade.position.set(lado * (LX / 2 + 0.05), 0.01, 0); grupo.add(metade);
      for (let k = 0; k < VIDAS; k++) {           // vidas: tres discos no fundo do campo de cada um
        const m = malha(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20), cores[i], { emissive: cores[i], emissiveIntensity: 0.6 });
        m.position.set(lado * (LX - 0.8), 0.06, (k - 1) * 1.4); grupo.add(m); pecas.vidas[i].push(m);
      }
      const seta = malha(new THREE.ConeGeometry(0.28, 0.8, 10), cores[i], { emissive: cores[i], emissiveIntensity: 0.5 });
      seta.rotation.z = -Math.PI / 2; seta.visible = false; grupo.add(seta); pecas.setas.push(seta);
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;
    const ms = c.pool('bolas', d.bolas.length, () => c.malha(new THREE.SphereGeometry(R_BOLA, 18, 12), AMARELO, { emissive: AMARELO, emissiveIntensity: 0.3, roughness: 0.35 }));
    d.bolas.forEach((b, n) => {
      const m = ms[n], voo = b.estado === 'voo', cor = b.dono >= 0 ? c.cores[b.dono] : AMARELO;
      const y = b.estado === 'mao' ? RAIO * 2 + R_BOLA + 0.15 + p.jogadores[b.dono].y : voo ? 0.6 : R_BOLA;
      m.position.set(b.x, y, b.z);
      m.material.color.set(cor); m.material.emissive.set(cor); m.material.emissiveIntensity = voo ? 0.9 : 0.3;
      m.scale.setScalar(voo ? 1.2 : 1);
    });
    for (const i of [0, 1]) {
      const j = p.jogadores[i];
      pecas.vidas[i].forEach((m, k) => {
        const tem = k < d.placar[i];
        m.material.color.set(tem ? c.cores[i] : 0x30343f); m.material.emissiveIntensity = tem ? 0.6 : 0;
      });
      if (j.vivo) c.bonecos[i].visible = p.fase !== 'jogando' || d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;     // pisca enquanto imune (no resultado fica aceso)
      const seta = pecas.setas[i], naMao = j.vivo && p.fase === 'jogando' && d.bolas.some(b => b.estado === 'mao' && b.dono === i);
      seta.visible = naMao;
      if (naMao) {
        const [dx, dz] = mira(j, i, p.mod?.inverte ? -1 : 1);
        seta.position.set(j.x + dx * 1.6, 0.35, j.z + dz * 1.6); seta.rotation.y = -Math.atan2(dz, dx);
      }
    }
    if (d.acerto.n !== pecas.visto) {
      pecas.visto = d.acerto.n;
      c.particulas(d.acerto.x, 1, d.acerto.z, c.cores[d.acerto.quem], 18, 8);
    }
  },
};
