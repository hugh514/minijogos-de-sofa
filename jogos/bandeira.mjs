// Pega-bandeira: pegue a bandeira do outro e leve ate a sua base. Encostar no portador derruba a bandeira.
import { posiciona, maiorPlacar, RAIO } from '../logica.mjs';

const LX = 11, LZ = 6.5, BASE_X = 9, R_BASE = 1.5, R_PEGA = RAIO + 0.5;
const META = 2, LIMITE = 55, T_VOLTA = 4, T_SEM_PEGAR = 1, LENTO = 0.85, EMPURRAO = 10, ALCANCE_DASH = RAIO * 2 + 0.7;
// Muros (centro e meia-medida), espelhados nos dois lados para ninguem levar vantagem.
export const MUROS = [
  { x: 0, z: 0, hx: 0.6, hz: 1.7 },
  { x: -4.6, z: -2.6, hx: 0.5, hz: 1.4 }, { x: 4.6, z: -2.6, hx: 0.5, hz: 1.4 },
  { x: -3, z: 3.4, hx: 1.4, hz: 0.5 }, { x: 3, z: 3.4, hx: 1.4, hz: 0.5 },
];

const baseDe = i => ({ x: i ? BASE_X : -BASE_X, z: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Circulo contra caixa: tira o jogador de dentro do muro e zera a velocidade contra ele.
function saiDoMuro(j, m) {
  const px = Math.max(m.x - m.hx, Math.min(m.x + m.hx, j.x)), pz = Math.max(m.z - m.hz, Math.min(m.z + m.hz, j.z));
  const dx = j.x - px, dz = j.z - pz, d = Math.hypot(dx, dz);
  if (d >= RAIO) return;
  if (d === 0) {                                  // centro dentro do muro: sai pelo lado mais perto
    if (m.hx - Math.abs(j.x - m.x) < m.hz - Math.abs(j.z - m.z)) {
      const s = j.x >= m.x ? 1 : -1; j.x = m.x + s * (m.hx + RAIO); if (j.vx * s < 0) j.vx = 0;
    } else {
      const s = j.z >= m.z ? 1 : -1; j.z = m.z + s * (m.hz + RAIO); if (j.vz * s < 0) j.vz = 0;
    }
    return;
  }
  const nx = dx / d, nz = dz / d, v = j.vx * nx + j.vz * nz;
  j.x = px + nx * RAIO; j.z = pz + nz * RAIO;
  if (v < 0) { j.vx -= v * nx; j.vz -= v * nz; }
}

function efeito(d, x, z, quem, forca) {
  d.fx.push({ n: ++d.fxN, x, z, quem, forca });
  if (d.fx.length > 8) d.fx.shift();
}

function paraBase(d, i) { Object.assign(d.band[i], baseDe(i), { estado: 'base', t: 0 }); }

export default {
  id: 'bandeira', genero: 'corrida', nome: 'Pega-bandeira', dica: 'Pegue a bandeira do outro e leve até a sua base. Encoste no ladrão para derrubar!',
  controle: { modo: 'padrao', a: 'EMPURRA', b: 'PULA' }, rotulo: 'bandeiras', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 7.5);
    p.dados = {
      band: [0, 1].map(i => ({ ...baseDe(i), estado: 'base', t: 0 })),      // band[i] e a bandeira DO jogador i
      semPegar: [0, 0], empAntes: [0, 0], janelaDash: [0, 0], placar: [0, 0], fx: [], fxN: 0, aviso: '', avisoT: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    for (const j of js) if (j.vivo) for (const m of MUROS) saiDoMuro(j, m);

    // o empurrao vale por 0,4 s depois que o contador de empurroes do motor sobe
    for (const k of [0, 1]) {
      d.janelaDash[k] = js[k].empurroes > d.empAntes[k] ? 0.4 : Math.max(0, d.janelaDash[k] - dt);
      d.empAntes[k] = js[k].empurroes;
    }
    // o portador i perde a bandeira se o outro encostar ou acertar o empurrao
    const derrubados = [0, 1].filter(i => {
      if (d.band[1 - i].estado !== 'levada') return false;
      const j = js[i], o = js[1 - i], dx = j.x - o.x, dz = j.z - o.z;
      const dash = d.janelaDash[1 - i] > 0 && Math.hypot(dx, dz) < ALCANCE_DASH && o.vx * dx + o.vz * dz > 0;
      return p.tocou || dash;
    });
    for (const i of derrubados) {
      const j = js[i], o = js[1 - i], f = d.band[1 - i];
      const dx = j.x - o.x, dz = j.z - o.z, len = Math.hypot(dx, dz) || 1;
      Object.assign(f, { x: j.x, z: j.z, estado: 'chao', t: T_VOLTA });
      j.vx += dx / len * EMPURRAO; j.vz += dz / len * EMPURRAO;
      d.semPegar[i] = T_SEM_PEGAR;
      efeito(d, f.x, f.z, 1 - i, 8);
      p.eventos.push('troca');
      p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    }

    for (const i of [0, 1]) {
      const j = js[i], minha = d.band[i], dele = d.band[1 - i];
      d.semPegar[i] = Math.max(0, d.semPegar[i] - dt);
      if (minha.estado === 'chao') {              // bandeira caida: o dono recolhe passando por cima, ou ela volta sozinha
        minha.t -= dt;
        if (minha.t <= 0 || dist(j, minha) < R_PEGA) {
          efeito(d, minha.x, minha.z, i, 5); paraBase(d, i); p.eventos.push('moeda');
        }
      }
      if (dele.estado !== 'levada' && d.semPegar[i] <= 0 && dist(j, dele) < R_PEGA) {
        dele.estado = 'levada'; p.eventos.push('moeda'); efeito(d, j.x, j.z, 1 - i, 5);
      }
      const leva = dele.estado === 'levada';
      j.turbo = leva ? LENTO : 1;
      if (leva) { dele.x = j.x; dele.z = j.z; }
    }

    const marcou = [0, 1].filter(i => d.band[1 - i].estado === 'levada' && dist(js[i], baseDe(i)) < R_BASE);
    if (marcou.length) {
      for (const i of marcou) { d.placar[i]++; efeito(d, js[i].x, js[i].z, i, 12); }
      paraBase(d, 0); paraBase(d, 1);
      js[0].turbo = js[1].turbo = 1;
      d.aviso = 'Bandeira capturada!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
      p.eventos.push('gol');
      const [a, b] = d.placar;
      if (a >= META || b >= META) return a === b ? -1 : a > b ? 0 : 1;
    }

    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0; pecas.band = []; pecas.marcas = []; pecas.halos = []; pecas.luzes = [[], []];
    pecas.rodas = []; pecas.chamas = [];

    // gramado em faixas, linha do meio e circulo central
    for (let k = 0; k < 8; k++) {
      const faixa = malha(new THREE.BoxGeometry(LX / 4, 0.04, LZ * 2), k % 2 ? 0x3f9a5b : 0x358a50);
      faixa.position.set(-LX + LX / 8 + k * LX / 4, 0.02, 0); faixa.castShadow = false; grupo.add(faixa);
    }
    const meio = malha(new THREE.BoxGeometry(0.14, 0.02, LZ * 2), 0xffffff, { emissive: 0x666666 });
    meio.position.y = 0.05; meio.castShadow = false; grupo.add(meio);

    for (const i of [0, 1]) {
      const lado = i ? 1 : -1, cor = cores[i], b = baseDe(i);
      // base: disco da cor do dono, com cubinhos luminosos girando em volta
      const base = malha(new THREE.CylinderGeometry(R_BASE, R_BASE + 0.15, 0.12, 36), cor, { emissive: cor, emissiveIntensity: 0.45 });
      base.position.set(b.x, 0.08, 0); grupo.add(base);
      const miolo = malha(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 20), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 });
      miolo.position.set(b.x, 0.16, 0); grupo.add(miolo);
      const roda = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const cubo = malha(new THREE.BoxGeometry(0.22, 0.22, 0.22), 0xffffff, { emissive: cor, emissiveIntensity: 1.2 });
        cubo.position.set(Math.cos(k * Math.PI / 4) * (R_BASE + 0.05), 0.25, Math.sin(k * Math.PI / 4) * (R_BASE + 0.05)); roda.add(cubo);
      }
      roda.position.set(b.x, 0, 0); grupo.add(roda); pecas.rodas.push(roda);
      // metade tingida de leve com a cor do dono
      const tinta = malha(new THREE.BoxGeometry(LX, 0.02, LZ * 2), cor, { transparent: true, opacity: 0.13 });
      tinta.position.set(lado * LX / 2, 0.05, 0); tinta.castShadow = false; grupo.add(tinta);

      // a bandeira do jogador i: mastro, pano que balanca e ponteira dourada
      const g = new THREE.Group();
      const mastro = malha(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), 0xf2f2f2); mastro.position.y = 0.95;
      const ponta = malha(new THREE.SphereGeometry(0.14, 10, 8), 0xffd23f, { emissive: 0xffa500, emissiveIntensity: 0.8 }); ponta.position.y = 1.95;
      const eixo = new THREE.Group(); eixo.position.y = 1.5;
      const pano = malha(new THREE.BoxGeometry(1, 0.65, 0.06), cor, { emissive: cor, emissiveIntensity: 0.7 }); pano.position.x = 0.55;
      eixo.add(pano); g.add(mastro, ponta, eixo); g.userData = { eixo };
      grupo.add(g); pecas.band.push(g);
      // marca no chao da bandeira caida (encolhe ate ela voltar) e halo embaixo de quem carrega
      const marca = malha(new THREE.CylinderGeometry(1, 1, 0.03, 28), cor, { emissive: cor, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 });
      marca.castShadow = false; marca.visible = false; grupo.add(marca); pecas.marcas.push(marca);
      const halo = malha(new THREE.TorusGeometry(RAIO + 0.35, 0.09, 8, 28), cor, { emissive: cor, emissiveIntensity: 1.2 });
      halo.rotation.x = Math.PI / 2; halo.visible = false; grupo.add(halo); pecas.halos.push(halo);

      // capturas: duas lanternas em postes atras da base
      for (let k = 0; k < META; k++) {
        const z = (k - 0.5) * 2.2;
        const poste = malha(new THREE.CylinderGeometry(0.09, 0.13, 1.5, 8), 0x5b4630);
        poste.position.set(lado * (LX + 0.8), 0.75, z); grupo.add(poste);
        const luz = malha(new THREE.SphereGeometry(0.4, 14, 10), 0x30343f, { emissive: cor, emissiveIntensity: 0 });
        luz.position.set(lado * (LX + 0.8), 1.75, z); grupo.add(luz); pecas.luzes[i].push(luz);
      }
    }

    // muros de pedra com ameias e faixa luminosa no topo
    for (const m of MUROS) {
      const muro = malha(new THREE.BoxGeometry(m.hx * 2, 1.2, m.hz * 2), 0x8c93a6, { roughness: 0.9 });
      muro.position.set(m.x, 0.6, m.z); grupo.add(muro);
      const topo = malha(new THREE.BoxGeometry(m.hx * 2 + 0.12, 0.14, m.hz * 2 + 0.12), 0xffd23f, { emissive: 0xffa500, emissiveIntensity: 0.6 });
      topo.position.set(m.x, 1.27, m.z); grupo.add(topo);
      const longoX = m.hx > m.hz, n = Math.max(2, Math.round(Math.max(m.hx, m.hz) * 2 / 0.9));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n * 2 - 1;
        const ameia = malha(new THREE.BoxGeometry(0.4, 0.3, 0.4), 0x737a8c, { roughness: 0.9 });
        ameia.position.set(m.x + (longoX ? u * m.hx : 0), 1.49, m.z + (longoX ? 0 : u * m.hz)); grupo.add(ameia);
      }
    }

    // enfeites fora do campo: tochas nos cantos e arbustos com flores no fundo
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const poste = malha(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 8), 0x5b4630);
      poste.position.set(sx * (LX + 0.8), 0.9, sz * (LZ + 0.8)); grupo.add(poste);
      const chama = malha(new THREE.ConeGeometry(0.32, 0.8, 8), 0xffa531, { emissive: 0xff5a00, emissiveIntensity: 1.6 });
      chama.position.set(sx * (LX + 0.8), 2.2, sz * (LZ + 0.8)); grupo.add(chama); pecas.chamas.push(chama);
    }
    const flores = [0xff5fa2, 0xffd23f, 0xffffff, 0xff7a2f];
    for (let k = 0; k < 7; k++) {
      const x = -9 + k * 3;
      const arbusto = malha(new THREE.SphereGeometry(0.75, 12, 9), k % 2 ? 0x2f7d46 : 0x3c9455, { roughness: 0.9 });
      arbusto.position.set(x, 0.45, -LZ - 1.2); arbusto.scale.y = 0.75; grupo.add(arbusto);
      for (let f = 0; f < 3; f++) {
        const flor = malha(new THREE.SphereGeometry(0.13, 8, 6), flores[(k + f) % 4], { emissive: flores[(k + f) % 4], emissiveIntensity: 0.5 });
        flor.position.set(x + (f - 1) * 0.42, 0.95 - Math.abs(f - 1) * 0.14, -LZ - 0.95); grupo.add(flor);
      }
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas } = c;
    for (const i of [0, 1]) {
      const f = d.band[i], g = pecas.band[i], ladrao = p.jogadores[1 - i];
      g.userData.eixo.rotation.y = Math.sin(t * 5 + i * 2) * 0.45 + (f.estado === 'levada' ? Math.PI : 0);
      g.rotation.set(0, 0, 0); g.visible = true; g.scale.setScalar(1);
      if (f.estado === 'levada') {                // vai na cabeca de quem roubou
        g.position.set(ladrao.x, RAIO * 2 + ladrao.y - 0.1, ladrao.z); g.scale.setScalar(0.85);
      } else if (f.estado === 'chao') {           // caida: torta e piscando
        g.position.set(f.x, 0.05, f.z); g.rotation.z = 0.55;
        g.visible = Math.floor(t * 10) % 2 === 0 || f.t > 1.2;
      } else g.position.set(f.x, 0.14 + Math.sin(t * 3 + i) * 0.05, f.z);

      const marca = pecas.marcas[i];
      marca.visible = f.estado === 'chao';
      if (marca.visible) { const s = 0.4 + 1.3 * Math.max(0, f.t) / T_VOLTA; marca.position.set(f.x, 0.07, f.z); marca.scale.set(s, 1, s); }
      const halo = pecas.halos[i];                // halo da cor da bandeira i embaixo de quem a carrega
      halo.visible = f.estado === 'levada' && ladrao.vivo;
      if (halo.visible) { halo.position.set(ladrao.x, 0.12, ladrao.z); halo.scale.setScalar(1 + Math.sin(t * 9) * 0.1); }

      pecas.rodas[i].rotation.y += dt * (f.estado === 'base' ? 1.2 : 5);     // a base gira rapido quando a bandeira sumiu
      pecas.luzes[i].forEach((m, k) => {
        const aceso = k < d.placar[i];
        m.material.color.set(aceso ? c.cores[i] : 0x30343f);
        m.material.emissiveIntensity = aceso ? 1.1 + Math.sin(t * 6 + k) * 0.2 : 0;
      });
    }
    pecas.chamas.forEach((m, k) => { const s = 1 + Math.sin(t * 13 + k * 2.1) * 0.18; m.scale.set(s, 1 + Math.sin(t * 17 + k) * 0.25, s); });

    for (const e of d.fx) {
      if (e.n <= pecas.visto) continue;
      pecas.visto = e.n;
      c.particulas(e.x, 1, e.z, c.cores[e.quem], Math.round(e.forca * 2.5), e.forca);
    }
  },
};
