// Hoquei de mesa: cada um na sua metade, disco quase sem atrito que quica nas paredes. Primeiro a 3 gols.
import { posiciona, maiorPlacar, colide, RAIO } from '../logica.mjs';

const LX = 11, LZ = 6, GOL = 2.6, R_DISCO = 0.55, MASSA = 0.3;
const V_MAX = 18, V_LENTO = 1.2, T_LENTO = 3, V_EMPURRAO = 8, V_SAIDA = 6;
const META = 3, LIMITE = 50, T_SEGUNDO = 20, PAUSA = 0.8, QUIQUE = 0.95;
const AMARELO = 0xffd23f, CIANO = 0x3fe8ff;

// Disco novo no centro: fica um instante parado (pausa) e sai para o lado dado (-1 esquerda, 1 direita).
// Sai sempre na diagonal (2,5 a 4,5 de lado): chega ao fundo fora do vao do gol, entao o saque nunca e gol sozinho.
function novoDisco(p, lado) {
  return { x: 0, z: 0, vx: 0, vz: 0, pausa: PAUSA, lado, sz: (p.rng() < 0.5 ? -1 : 1) * (2.5 + p.rng() * 2), lento: 0, som: 0 };
}

export default {
  id: 'hoquei', genero: 'gol', nome: 'Hóquei de mesa', dica: 'Bata o disco no gol do outro. Tacada dá um arranque. Primeiro a 3 gols vence!',
  controle: { modo: 'padrao', a: 'TACADA', b: '' }, semPulo: true, rotulo: 'gols', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true, gol: GOL };
    posiciona(p, 6);
    p.dados = {
      discos: [novoDisco(p, p.rng() < 0.5 ? -1 : 1)], segundo: false, placar: [0, 0],
      aviso: '', avisoT: 0, gol: { n: 0, x: 0, z: 0, quem: 0 }, toque: { n: 0, x: 0, z: 0 },
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    p.jogadores.forEach((j, i) => {              // ninguem cruza a linha do meio
      const lado = i ? 1 : -1;
      if (j.x * lado < RAIO) { j.x = lado * RAIO; if (j.vx * lado < 0) j.vx = 0; }
    });

    if (!d.segundo && p.t >= T_SEGUNDO) {
      d.segundo = true;
      d.discos.push(novoDisco(p, p.rng() < 0.5 ? -1 : 1));
      d.aviso = 'Disco extra!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
      p.eventos.push('troca');
    }

    for (const b of d.discos) {
      if (b.pausa > 0) {                         // esperando no centro
        b.pausa -= dt;
        if (b.pausa <= 0) { b.vx = b.lado * V_SAIDA; b.vz = b.sz; }
        continue;
      }
      b.som -= dt;
      for (const j of p.jogadores) {
        if (!j.vivo || !colide(j, b, RAIO, R_DISCO, 1, MASSA)) continue;
        if (b.som <= 0) { b.som = 0.15; p.eventos.push('batida'); d.toque = { n: d.toque.n + 1, x: b.x, z: b.z }; }
      }
      for (const o of d.discos) if (o !== b && o.pausa <= 0) colide(b, o, R_DISCO, R_DISCO, 1, 1);

      const at = Math.pow(0.88, dt);
      b.vx *= at; b.vz *= at;
      let v = Math.hypot(b.vx, b.vz);
      if (v > V_MAX) { b.vx *= V_MAX / v; b.vz *= V_MAX / v; v = V_MAX; }

      // disco quase parado por 3 s (canto, trave, encostado na parede): empurrao para o centro
      b.lento = v < V_LENTO ? b.lento + dt : 0;
      if (b.lento >= T_LENTO) {
        b.lento = 0;
        const dist = Math.hypot(b.x, b.z);
        let dx = p.rng() < 0.5 ? -1 : 1, dz = p.rng() - 0.5;
        if (dist > 1) { dx = -b.x / dist; dz = -b.z / dist; }
        const len = Math.hypot(dx, dz) || 1;
        b.vx = dx / len * V_EMPURRAO; b.vz = dz / len * V_EMPURRAO;
        p.eventos.push('dash');
      }

      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.z) > LZ - R_DISCO) { b.z = Math.sign(b.z) * (LZ - R_DISCO); b.vz *= -QUIQUE; }
      if (Math.abs(b.x) > LX - R_DISCO) {
        if (Math.abs(b.z) < GOL) {
          if (Math.abs(b.x) > LX) {              // gol
            const quem = b.x > 0 ? 0 : 1;
            d.placar[quem]++;
            d.gol = { n: d.gol.n + 1, x: Math.sign(b.x) * LX, z: b.z, quem };
            d.aviso = 'Gol!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
            p.eventos.push('gol');
            const levou = 1 - quem;
            p.celular[levou] = { ...p.celular[levou], vibra: (p.celular[levou].vibra ?? 0) + 1 };
            Object.assign(b, novoDisco(p, levou ? 1 : -1));     // volta ao centro e sai para quem levou o gol
            if (d.placar[quem] >= META) return quem;
          }
        } else { b.x = Math.sign(b.x) * (LX - R_DISCO); b.vx *= -QUIQUE; }
      }
    }

    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.vistoGol = 0; pecas.vistoToque = 0; pecas.brilhoGol = [0, 0];
    pecas.gols = []; pecas.luzes = [[], []]; pecas.faixas = []; pecas.giro = [];

    // gelo
    const gelo = malha(new THREE.BoxGeometry(LX * 2, 0.04, LZ * 2), 0xcfeeff, { roughness: 0.12, metalness: 0.1, emissive: 0x16405e, emissiveIntensity: 0.5 });
    gelo.position.y = 0.02; gelo.castShadow = false; grupo.add(gelo);
    const chato = (geo, cor, y, extra = {}) => {
      const m = malha(geo, cor, { emissive: cor, emissiveIntensity: 0.8, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m);
      return m;
    };
    // linha do meio, circulo central e ponto de saida
    const meio = malha(new THREE.BoxGeometry(0.22, 0.02, LZ * 2), 0xff3355, { emissive: 0xff3355, emissiveIntensity: 0.9 });
    meio.position.y = 0.05; meio.castShadow = false; grupo.add(meio);
    chato(new THREE.RingGeometry(1.9, 2.1, 48), 0xff3355, 0.055);
    chato(new THREE.CircleGeometry(0.35, 20), 0xff3355, 0.06);
    // linhas azuis de cada metade
    for (const s of [-1, 1]) {
      const l = malha(new THREE.BoxGeometry(0.16, 0.02, LZ * 2), CIANO, { emissive: CIANO, emissiveIntensity: 0.7 });
      l.position.set(s * 4.2, 0.05, 0); l.castShadow = false; grupo.add(l);
      for (const k of [-1, 1]) {                 // pontos de enfeite
        const pt = chato(new THREE.RingGeometry(0.5, 0.62, 24), CIANO, 0.055);
        pt.position.set(s * 7.4, 0.055, k * 3.4);
      }
    }

    for (const i of [0, 1]) {
      const lado = i ? 1 : -1, cor = cores[i];
      // metade tingida com a cor do dono e area do gol
      const tinta = malha(new THREE.BoxGeometry(LX, 0.02, LZ * 2), cor, { transparent: true, opacity: 0.16 });
      tinta.position.set(lado * LX / 2, 0.045, 0); tinta.castShadow = false; grupo.add(tinta);
      const area = chato(new THREE.RingGeometry(GOL - 0.14, GOL + 0.06, 40, 1, i ? Math.PI / 2 : -Math.PI / 2, Math.PI), cor, 0.06);
      area.position.x = lado * LX;
      const miolo = chato(new THREE.CircleGeometry(GOL - 0.14, 40, i ? Math.PI / 2 : -Math.PI / 2, Math.PI), cor, 0.052, { transparent: true, opacity: 0.3 });
      miolo.position.x = lado * LX;

      // o gol: fundo, teto e duas traves, logo atras da linha
      const gol = new THREE.Group();
      const mat = { emissive: cor, emissiveIntensity: 0.7 };
      const fundoGol = malha(new THREE.BoxGeometry(0.2, 1.3, GOL * 2 + 0.4), cor, mat); fundoGol.position.set(lado * 1.3, 0.65, 0);
      const teto = malha(new THREE.BoxGeometry(1.3, 0.12, GOL * 2 + 0.4), cor, { ...mat, transparent: true, opacity: 0.45 }); teto.position.set(lado * 0.65, 1.3, 0);
      const piso = malha(new THREE.BoxGeometry(1.3, 0.1, GOL * 2), 0x101522); piso.position.set(lado * 0.65, -0.03, 0);
      gol.add(fundoGol, teto, piso);
      for (const k of [-1, 1]) {
        const trave = malha(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 12), 0xffffff, { emissive: cor, emissiveIntensity: 0.9 });
        trave.position.set(0.05 * lado, 0.7, k * (GOL + 0.1)); gol.add(trave);
        const lado2 = malha(new THREE.BoxGeometry(1.3, 1.3, 0.12), cor, { ...mat, transparent: true, opacity: 0.45 });
        lado2.position.set(lado * 0.65, 0.65, k * (GOL + 0.2)); gol.add(lado2);
      }
      // sirene giratoria em cima do gol
      const sirene = new THREE.Group();
      const cupula = malha(new THREE.SphereGeometry(0.3, 14, 10), 0xff3030, { emissive: 0xff2020, emissiveIntensity: 1 });
      const facho = malha(new THREE.BoxGeometry(1.1, 0.1, 0.16), 0xffe0a0, { emissive: 0xffc040, emissiveIntensity: 1.2 });
      sirene.add(cupula, facho); sirene.position.set(lado * 0.65, 1.62, 0); gol.add(sirene); pecas.giro.push(sirene);
      gol.position.x = lado * LX; grupo.add(gol);
      pecas.gols.push({ pecas: [fundoGol, teto], cupula });

      // placar de luzes: tres lampadas na mureta do fundo, do lado de cada um
      for (let k = 0; k < META; k++) {
        const poste = malha(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 8), 0x39425c);
        poste.position.set(lado * (2 + k * 1.5), 0.9, -LZ - 0.5); grupo.add(poste);
        const luz = malha(new THREE.SphereGeometry(0.42, 16, 12), 0x30343f, { emissive: cor, emissiveIntensity: 0 });
        luz.position.set(lado * (2 + k * 1.5), 1.7, -LZ - 0.5); grupo.add(luz); pecas.luzes[i].push(luz);
      }
    }

    // faixas de neon nas laterais (pulsam) e refletores nos quatro cantos
    for (const s of [-1, 1]) {
      const f = malha(new THREE.BoxGeometry(LX * 2 - 0.4, 0.1, 0.12), CIANO, { emissive: CIANO, emissiveIntensity: 1 });
      f.position.set(0, 0.86, s * (LZ + 0.15)); grupo.add(f); pecas.faixas.push(f);
      for (const sx of [-1, 1]) {
        const poste = malha(new THREE.CylinderGeometry(0.14, 0.2, 2.6, 10), 0x39425c);
        poste.position.set(sx * (LX + 0.9), 1.3, s * (LZ + 0.9)); grupo.add(poste);
        const refletor = malha(new THREE.SphereGeometry(0.4, 14, 10), 0xffffff, { emissive: 0xbfe9ff, emissiveIntensity: 1.2 });
        refletor.position.set(sx * (LX + 0.9), 2.7, s * (LZ + 0.9)); grupo.add(refletor); pecas.faixas.push(refletor);
      }
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;

    const ms = c.pool('discos', d.discos.length, () => {
      const g = new THREE.Group();
      const corpo = c.malha(new THREE.CylinderGeometry(R_DISCO, R_DISCO, 0.26, 28), 0x1b1e2b, { roughness: 0.3 });
      const topo = c.malha(new THREE.CylinderGeometry(R_DISCO * 0.72, R_DISCO * 0.72, 0.05, 28), AMARELO, { emissive: AMARELO, emissiveIntensity: 1 });
      topo.position.y = 0.15;
      const aro = c.malha(new THREE.TorusGeometry(R_DISCO, 0.07, 8, 28), AMARELO, { emissive: AMARELO, emissiveIntensity: 1.2 });
      aro.rotation.x = Math.PI / 2;
      const halo = c.malha(new THREE.CylinderGeometry(1, 1, 0.02, 28), AMARELO, { emissive: AMARELO, emissiveIntensity: 1, transparent: true, opacity: 0.3 });
      halo.position.y = -0.1; halo.castShadow = false;
      g.add(corpo, topo, aro, halo); g.userData = { halo, topo };
      return g;
    });
    d.discos.forEach((b, n) => {
      const g = ms[n], v = Math.hypot(b.vx, b.vz), parado = b.pausa > 0;
      g.position.set(b.x, 0.2, b.z);
      g.rotation.y += dt * (2 + v);
      g.visible = !parado || Math.floor(t * 12) % 2 === 0;            // pisca enquanto espera no centro
      g.userData.halo.scale.set(R_DISCO * (1.2 + v / V_MAX), 1, R_DISCO * (1.2 + v / V_MAX));
      g.userData.topo.material.emissiveIntensity = 0.6 + v / V_MAX;
    });

    for (const i of [0, 1]) {
      pecas.luzes[i].forEach((m, k) => {
        const aceso = k < d.placar[i];
        m.material.color.set(aceso ? c.cores[i] : 0x30343f);
        m.material.emissiveIntensity = aceso ? 1.1 + Math.sin(t * 6 + k) * 0.2 : 0;
      });
      // o gol que levou a bola pisca forte por um instante (pecas.gols[k] e o gol defendido por k)
      pecas.brilhoGol[i] = Math.max(0, pecas.brilhoGol[i] - dt);
      const forte = pecas.brilhoGol[i] > 0 && Math.floor(t * 16) % 2 === 0;
      for (const m of pecas.gols[i].pecas) m.material.emissiveIntensity = forte ? 2.2 : 0.7;
      pecas.giro[i].rotation.y += dt * (pecas.brilhoGol[i] > 0 ? 18 : 2.5);
    }
    pecas.faixas.forEach((m, k) => { m.material.emissiveIntensity = 0.9 + Math.sin(t * 3 + k * 1.3) * 0.35; });

    if (d.gol.n !== pecas.vistoGol) {
      pecas.vistoGol = d.gol.n;
      pecas.brilhoGol[1 - d.gol.quem] = 1.4;
      c.particulas(d.gol.x, 0.8, d.gol.z, c.cores[d.gol.quem], 30, 11);
      c.particulas(d.gol.x, 0.8, d.gol.z, AMARELO, 14, 8);
    }
    if (d.toque.n !== pecas.vistoToque) {
      pecas.vistoToque = d.toque.n;
      c.particulas(d.toque.x, 0.4, d.toque.z, 0xffffff, 6, 5);
    }
  },
};
