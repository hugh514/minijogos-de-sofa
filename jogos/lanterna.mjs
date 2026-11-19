// Esconde no escuro: o Fugitivo fica invisivel na tela e so aparece dentro do cone de luz do Cacador,
// ou por um instante quando bate em algo. O rastro de pegadas dura 1 s. Na TV so um contorno fraco marca onde o Fugitivo esta
// (ele precisa se enxergar); o Fugitivo nao tem botao A, que so servia para se denunciar.
import { posiciona, elimina, RAIO } from '../logica.mjs';

const TEMPO = 30, RAIO_ARENA = 9;
const ALCANCE = 6, MEIO_CONE = Math.PI / 6;          // leque de 60 graus
const GIRO = 9;                                      // rad/s que a lanterna leva para virar
const R_PILAR = 0.7, N_PILARES = 5;
const T_PEGADA = 1, PASSO = 0.9;                     // pegada some em 1 s; uma a cada 0.9 de caminho
const T_FLAGRA = 0.6, BATIDA_MIN = 4;                // tempo que a faisca denuncia; velocidade minima da batida
const PERTO = 4.5, QUENTE = 5;
const T_QUIETO = 0.5, V_QUIETO = 0.6;               // parado por 0.5 s o Fugitivo some de vez (nem o contorno fica)
const TOQUES = 2, T_IMUNE = 1.5, T_PAPEIS = 2.5;    // toques para pegar; depois do 1o o Fugitivo fica imune e visivel

function difAng(a, b) {                              // menor diferenca entre dois angulos, de -PI a PI
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function vibra(p, i) { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; }

export default {
  id: 'lanterna', genero: 'blefe', nome: 'Esconde no escuro',
  dica: 'O Caçador tem 30 s para encostar 2 vezes no Fugitivo invisível. Parado, o Fugitivo some de vez!',
  controle: { modo: 'padrao', a: 'EMPURRA', b: '' }, semPulo: true, duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: RAIO_ARENA, parede: true };
    posiciona(p, 6);
    const cac = p.rng() < 0.5 ? 0 : 1, fug = 1 - cac;
    const pilares = [];
    for (let k = 0; k < N_PILARES; k++) {            // em roda, longe da largada dos dois
      const ang = Math.PI / 2 + k * Math.PI * 2 / N_PILARES + (p.rng() - 0.5) * 0.3, r = 3.6 + p.rng() * 1.2;
      pilares.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
    }
    const c = p.jogadores[cac];
    p.dados = {
      cac, fug, pilares,
      ang: Math.atan2(-c.z, -c.x),                   // a lanterna comeca apontada para o centro
      visto: false, flagra: 0, quieto: 0, pegadas: [], caminho: 0, lado: 1, faiscas: [],
      vibraFug: 0, vibraCac: 2, velAntes: { vx: 0, vz: 0 },
      pegou: 0, imune: 0, aviso: '', avisoCor: '#ffffff', inventario: [[], []],
    };
    p.dados.inventario[cac] = [`Faltam ${TOQUES}`];
    p.jogadores[fug].cd = 1e9;                       // sem empurrao para o Fugitivo (a recarga nunca zera)
    p.jogadores[cac].turbo = 0.9; p.jogadores[fug].turbo = 0.8;
    p.celular[cac] = { texto: 'Você é o CAÇADOR: ilumine e encoste 2 vezes no outro!', vibra: 0 };
    p.celular[fug] = { texto: 'Você é o FUGITIVO: parado você some de vez, mas andando deixa o contorno!', a: '', vibra: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados, c = p.jogadores[d.cac], f = p.jogadores[d.fug];
    d.imune -= dt;
    if (p.t < T_PAPEIS) { d.aviso = `Jogador ${d.cac + 1} caça! Jogador ${d.fug + 1} foge!`; d.avisoCor = '#ffe066'; }
    else if (d.imune <= 0) d.aviso = '';
    if (p.tocou && d.imune <= 0) {
      d.pegou++; d.inventario[d.cac] = [`Falta ${TOQUES - d.pegou}`];
      d.visto = true; d.faiscas.push({ x: f.x, z: f.z, n: 24 });
      if (d.pegou >= TOQUES) { elimina(p, f, 12); p.eventos.push('explosao'); return d.cac; }
      d.imune = T_IMUNE; d.flagra = T_IMUNE;      // pisca e foge: o toque seguinte so vale depois
      const dx = f.x - c.x, dz = f.z - c.z, n = Math.hypot(dx, dz) || 1;
      f.vx = dx / n * 9; f.vz = dz / n * 9;
      d.aviso = 'Pegou 1! Falta 1'; d.avisoCor = '#ff8a3d';
      p.eventos.push('batida'); vibra(p, d.fug);
    }

    // pilares: seguram os dois; batida forte do Fugitivo solta faisca
    let bateu = false;
    for (const [i, j] of p.jogadores.entries())
      for (const pl of d.pilares) {
        const dx = j.x - pl.x, dz = j.z - pl.z, dist = Math.hypot(dx, dz), min = RAIO + R_PILAR;
        if (dist >= min || dist === 0) continue;
        const nx = dx / dist, nz = dz / dist, v = j.vx * nx + j.vz * nz;
        j.x = pl.x + nx * min; j.z = pl.z + nz * min;
        if (v < 0) { j.vx -= 1.5 * v * nx; j.vz -= 1.5 * v * nz; }
        if (i === d.fug && v < -BATIDA_MIN) bateu = true;
      }
    // parede: o motor ja segurou; a batida se ve pela velocidade que ele tinha indo para fora
    const distF = Math.hypot(f.x, f.z);
    if (distF >= RAIO_ARENA - RAIO - 0.01 && (d.velAntes.vx * f.x + d.velAntes.vz * f.z) / distF > BATIDA_MIN) bateu = true;
    d.flagra -= dt;
    if (bateu && d.flagra < T_FLAGRA - 0.3) {
      d.flagra = T_FLAGRA; d.faiscas.push({ x: f.x, z: f.z, n: 12 });
      p.eventos.push('batida');
    }
    d.velAntes = { vx: f.vx, vz: f.vz };

    // lanterna: vira para onde o Cacador anda
    const vel = Math.hypot(c.vx, c.vz);
    if (vel > 0.8) {
      const dif = difAng(Math.atan2(c.vz, c.vx), d.ang), max = GIRO * dt;
      d.ang += Math.max(-max, Math.min(max, dif));
    }
    const dx = f.x - c.x, dz = f.z - c.z, dist = Math.hypot(dx, dz);
    const folga = dist > RAIO ? Math.asin(RAIO / dist) * 0.6 : Math.PI;     // o corpo do boneco conta, nao so o centro
    const naLuz = dist < ALCANCE + RAIO * 0.5 && Math.abs(difAng(Math.atan2(dz, dx), d.ang)) < MEIO_CONE + folga;
    d.visto = naLuz || d.flagra > 0;

    // pegadas do Fugitivo
    for (const pg of d.pegadas) pg.t += dt;
    d.pegadas = d.pegadas.filter(pg => pg.t < T_PEGADA);
    const velF = Math.hypot(f.vx, f.vz);
    d.quieto = velF < V_QUIETO ? d.quieto + dt : 0;
    d.caminho += velF * dt;
    if (d.caminho >= PASSO && velF > 0.01) {
      d.caminho = 0; d.lado = -d.lado;
      d.pegadas.push({ x: f.x - f.vz / velF * 0.25 * d.lado, z: f.z + f.vx / velF * 0.25 * d.lado, t: 0 });
    }

    // celulares: o do Fugitivo treme com o Cacador perto; o do Cacador da um toque raro quando esta quente
    d.vibraFug -= dt; d.vibraCac -= dt;
    if (dist < PERTO && d.vibraFug <= 0) { vibra(p, d.fug); d.vibraFug = 0.4 + dist / PERTO * 0.8; }
    if (dist < QUENTE && !d.visto && d.vibraCac <= 0) { vibra(p, d.cac); d.vibraCac = 4; }

    if (p.t >= TEMPO) {
      elimina(p, c, 9); p.eventos.push('queda');
      d.visto = true;
      return d.fug;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores, p } = c, d = p.dados;
    const plano = (geo, cor, extra) => {             // peca chata no chao, sem sombra
      const m = malha(geo, cor, { transparent: true, depthWrite: false, ...extra });
      m.castShadow = m.receiveShadow = false;
      return m;
    };
    pecas.breu = plano(new THREE.CylinderGeometry(RAIO_ARENA, RAIO_ARENA, 0.02, 64), 0x04050a, { opacity: 0.72 });
    pecas.breu.position.y = 0.02;
    // leque de luz: gira em torno do Cacador
    pecas.cone = new THREE.Group();
    const leque = plano(new THREE.CircleGeometry(ALCANCE, 24, -MEIO_CONE, MEIO_CONE * 2), 0xfff2a8,
      { opacity: 0.55, emissive: 0xffe066, emissiveIntensity: 0.9, side: THREE.DoubleSide });
    leque.rotation.x = -Math.PI / 2;
    const borda = plano(new THREE.RingGeometry(ALCANCE - 0.15, ALCANCE, 24, 1, -MEIO_CONE, MEIO_CONE * 2), cores[d.cac],
      { opacity: 0.9, emissive: cores[d.cac], emissiveIntensity: 0.8, side: THREE.DoubleSide });
    borda.rotation.x = -Math.PI / 2; borda.position.y = 0.01;
    pecas.cone.add(leque, borda); pecas.cone.position.y = 0.05;
    pecas.leque = leque;
    grupo.add(pecas.breu, pecas.cone);
    // contorno fraco do Fugitivo: arame da esfera e anel no chao, na cor dele. Some quando a luz o revela.
    pecas.contorno = new THREE.Group();
    const arame = new THREE.Mesh(new THREE.SphereGeometry(RAIO * 1.05, 14, 10), new THREE.MeshBasicMaterial({ color: cores[d.fug], wireframe: true, transparent: true, opacity: 0.3, depthWrite: false }));
    const aro = new THREE.Mesh(new THREE.TorusGeometry(RAIO * 1.25, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: cores[d.fug], transparent: true, opacity: 0.4, depthWrite: false }));
    aro.rotation.x = Math.PI / 2; aro.position.y = -RAIO + 0.08;
    pecas.contorno.add(arame, aro); grupo.add(pecas.contorno);
    const CORES_PILAR = [0xffc531, 0x35c26b, 0x9b5cf6, 0xff7a2f, 0x22c7d6];
    d.pilares.forEach((pl, k) => {
      const cor = CORES_PILAR[k % CORES_PILAR.length];
      const m = malha(new THREE.CylinderGeometry(R_PILAR, R_PILAR, 1.8, 20), cor, { emissive: cor, emissiveIntensity: 0.45 });
      m.position.set(pl.x, 0.9, pl.z); grupo.add(m);
    });
  },

  desenha(c, dt, t) {
    const { THREE, p, pecas, cores } = c, d = p.dados, cac = p.jogadores[d.cac];
    const jogando = p.fase === 'jogando';
    c.bonecos[d.fug].visible = !jogando || d.visto;          // na intro e no resultado todo mundo aparece
    const fug = p.jogadores[d.fug];
    pecas.contorno.visible = jogando && !d.visto && fug.vivo && d.quieto < T_QUIETO;
    pecas.contorno.position.set(fug.x, RAIO + fug.y, fug.z);
    pecas.contorno.rotation.y = t * 0.8;
    pecas.breu.material.opacity = jogando ? 0.72 : 0.35;
    pecas.cone.visible = cac.vivo;
    pecas.cone.position.set(cac.x, 0.05, cac.z);
    pecas.cone.rotation.y = -d.ang;
    pecas.leque.material.opacity = (d.visto && jogando ? 0.8 : 0.5) + Math.sin(t * 9) * 0.04;
    const ps = c.pool('pegadas', d.pegadas.length, () => {
      const m = c.malha(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12), cores[d.fug],
        { transparent: true, depthWrite: false, emissive: cores[d.fug], emissiveIntensity: 0.7 });
      m.castShadow = m.receiveShadow = false;
      return m;
    });
    d.pegadas.forEach((pg, n) => {
      const k = Math.max(0, 1 - pg.t / T_PEGADA);
      ps[n].position.set(pg.x, 0.08, pg.z); ps[n].material.opacity = k; ps[n].scale.set(0.5 + k * 0.5, 1, 0.5 + k * 0.5);
    });
    for (const f of d.faiscas.splice(0)) c.particulas(f.x, 0.8, f.z, f.n > 12 ? cores[d.fug] : 0xfff2a8, f.n, 8);
  },
};
