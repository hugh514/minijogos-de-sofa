// Hélice na festa (todos contra todos ou times). Uma barra baixa gira no centro do disco e acelera: pule (B) ou seja arremessado.
// Aos 18 s desce uma segunda barra, alta e com um braço só: ela passa por cima de quem está no chão e pega quem está no ar,
// então o pulo tem hora certa. Quem é varrido para fora perde uma vida e volta 2 s depois, protegido. Cada um tem 3 vidas.
// Vence o último de pé (ou a dupla que ainda tem alguém), ou quem tiver mais vidas no fim do tempo (em times, vidas da dupla somadas).
import { posicionaRoda, timeDe, quem } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 3, T_ALTA = 18;
const VOLTA = 2, T_PROTECAO = 1.5, GOLPE = 15, T_TONTO = 0.7, T_PULOU = 0.8, MEIA_BARRA = 0.5;
const VEL_MAX = 3;                 // rad/s: acima disso a barra alta chega antes de o pulo da baixa acabar
const Y_PULO = 0.6, Y_ALTA = 0.9;  // altura do pulo que livra da barra baixa e a partir da qual a alta pega
const ALTURA_BRACO = 2.7, AVISO_ALTA = 2.5;
const NOME_TIME = ['laranja', 'roxa'];

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // de quem é a vida no placar: do jogador ou da dupla
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

function somaVidas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Volta atrás da barra baixa (ela acabou de passar ali), cada um num ponto, e protegido por um instante.
function renasce(p, d, i) {
  const j = p.jogadores[i], a = d.ang - 0.7 + (i % 2) * Math.PI, r = 2.2 + (i >> 1) * 1.4;
  Object.assign(j, { vivo: true, x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0, vx: 0, vy: 0, vz: 0 });
  d.fora[i] = false; d.imune[i] = T_PROTECAO; d.tonto[i] = 0; d.pulou[i] = 0;
  d.fx.push({ tipo: 'volta', i, x: j.x, z: j.z });
  p.eventos.push('troca');
}

// A barra pegou: arremessa no sentido do giro (dx, dz), mais forte longe do eixo, e deixa tonto (sem controle) para o joystick não anular o golpe.
function golpe(p, d, i, dx, dz, distEixo) {
  const j = p.jogadores[i], f = GOLPE * Math.min(1, Math.max(0.4, distEixo / 4));
  j.vx += dx * f; j.vz += dz * f;
  d.imune[i] = 0.5; d.tonto[i] = T_TONTO;
  d.fx.push({ tipo: 'golpe', i, x: j.x, z: j.z });
  p.eventos.push('batida');
  vibra(p, i);
}

// Último dono (jogador ou dupla) com vida; no tempo, o de mais vidas (igual dá empate).
function resultado(p) {
  const pl = p.dados.placar, restam = pl.flatMap((v, k) => (v > 0 ? [k] : []));
  if (restam.length <= 1) return restam.length ? restam[0] : -1;
  if (p.t >= TEMPO) {
    const maior = Math.max(...pl), lideres = pl.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) { d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`; d.avisoCor = '#ffd23f'; }
  p.jogadores.forEach((_, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (d.vidas[i] <= 0) t = times(p) ? 'Sem vidas. Torça pela dupla!' : 'Sem vidas. Torça!';
    else if (d.fora[i]) t = 'Caiu! Volta em ' + Math.ceil(Math.max(0.01, d.volta[i])) + ' s';
    else t = `Vidas: ${d.vidas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} ${d.alta ? 'Pule a baixa, não a alta.' : 'Pule a barra baixa.'}`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  // Na lua e com a Mola o pulo dura mais que o intervalo entre a barra baixa e a alta: pular a baixa vira levar a alta.
  semMod: ['lua'], semCarta: ['pulo'],
  id: 'helice-festa', genero: 'equilibrio', nome: 'Hélice maluca', dica: 'Pule a barra baixa e não pule na alta, senão você é varrido para fora.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  // sem empurrão, como na Hélice de 2: quem derruba é a barra
  semDash: true, controle: { modo: 'padrao', a: '', b: 'Pula' }, rotulo: 'vidas', duracao: TEMPO, tema: 0,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: n > 2 ? 7.6 : 7, parede: false };
    posicionaRoda(p, 3);       // perto do eixo: o primeiro golpe arremessa, mas ainda não derruba
    p.dados = {
      ang: -Math.PI / 2 + Math.PI / (n % 2 ? 2 * n : n),      // a barra começa no meio do vão entre dois jogadores
      vel: 0, alta: false, vidas: Array(n).fill(VIDAS), volta: Array(n).fill(0), fora: Array(n).fill(false),
      tonto: Array(n).fill(0), imune: Array(n).fill(0), pulou: Array(n).fill(0), fx: [], placar: [], inventario: [], aviso: '', avisoCor: '#ffffff', avisoT: 0,
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados, R = p.arena.raio;
    d.vel = Math.min(VEL_MAX, 0.9 + p.t * 0.05) * Math.min(1, p.t / 2);       // arranca devagar nos 2 primeiros segundos
    d.ang += d.vel * dt;
    if (!d.alta && p.t >= T_ALTA) {
      d.alta = true; d.aviso = 'Barra alta: não pule nela!'; d.avisoCor = '#ffffff'; d.avisoT = 2.2;
      p.eventos.push('troca');
      p.jogadores.forEach((_, i) => vibra(p, i));
    }
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    const cos = Math.cos(d.ang), sin = Math.sin(d.ang);
    p.jogadores.forEach((j, i) => {
      if (d.fora[i]) {
        if (d.vidas[i] <= 0) return;
        d.volta[i] -= dt;
        if (d.volta[i] <= 0) renasce(p, d, i);
        return;
      }
      if (!j.vivo) {       // o motor já tirou o chão dele: foi varrido (ou saiu andando)
        d.fora[i] = true; d.vidas[i]--; d.volta[i] = VOLTA; d.tonto[i] = 0; j.turbo = 1;
        d.fx.push({ tipo: 'caiu', i, x: j.x, z: j.z });
        vibra(p, i);
        return;
      }
      d.imune[i] = Math.max(0, d.imune[i] - dt); d.tonto[i] = Math.max(0, d.tonto[i] - dt); d.pulou[i] = Math.max(0, d.pulou[i] - dt);
      j.turbo = d.tonto[i] > 0 ? 0 : 1;
      if (d.imune[i] > 0) return;
      const ao = j.x * cos + j.z * sin, atraves = -j.x * sin + j.z * cos;       // ao longo e através da barra baixa
      if (Math.abs(atraves) <= MEIA_BARRA && Math.abs(ao) <= R && d.pulou[i] <= 0) {
        if (j.y > Y_PULO) d.pulou[i] = T_PULOU;      // pulou por cima: esta passada não pega mais (perto do eixo ela demora a passar)
        else { const s = Math.sign(ao) || 1; golpe(p, d, i, -sin * s, cos * s, Math.abs(ao)); }       // a barra anda em sentidos opostos de cada lado do eixo
      } else if (d.alta && atraves > 0 && Math.abs(ao) <= MEIA_BARRA && j.y > Y_ALTA) golpe(p, d, i, -cos, -sin, atraves);     // braço alto: 90 graus à frente da baixa
    });

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, R = p.arena.raio;
    // Barra listrada: gomos de duas cores ao longo do comprimento (de x0 a x1).
    const listrada = (x0, x1, alt, larg, corA, corB, gomos) => {
      const g = new THREE.Group(), passo = (x1 - x0) / gomos;
      for (let k = 0; k < gomos; k++) {
        const m = malha(new THREE.BoxGeometry(passo, alt, larg), k % 2 ? corA : corB, { emissive: k % 2 ? corA : corB, emissiveIntensity: 0.25, roughness: 0.5 });
        m.position.x = x0 + passo * (k + 0.5); g.add(m);
      }
      return g;
    };
    pecas.baixa = listrada(-R, R, 0.55, 0.5, 0xe5352b, 0xffffff, 14);
    pecas.baixa.position.y = 0.32;
    const eixo = malha(new THREE.CylinderGeometry(0.5, 0.65, 0.9, 8), 0xdfe6f5, { metalness: 0.4, roughness: 0.3, flatShading: true }); eixo.position.y = 0.45;
    const mastro = malha(new THREE.CylinderGeometry(0.2, 0.26, ALTURA_BRACO, 8), 0x9aa3b8, { metalness: 0.5, roughness: 0.35, flatShading: true }); mastro.position.y = ALTURA_BRACO / 2 + 0.6;
    const luz = malha(new THREE.SphereGeometry(0.34, 10, 8), 0xff4a4a, { emissive: 0xff2a2a, emissiveIntensity: 1.2, flatShading: true }); luz.position.y = ALTURA_BRACO + 0.95;
    // braço alto: preto e branco, com pontas penduradas para se ver de cima que ele está no alto
    pecas.alta = new THREE.Group(); pecas.alta.position.y = ALTURA_BRACO;
    pecas.braco = listrada(0, R, 0.5, 0.5, 0x1d2230, 0xffffff, 8);
    for (let k = 1; k <= 3; k++) {
      const tira = malha(new THREE.BoxGeometry(0.16, 0.7, 0.16), 0x1d2230); tira.position.set(R * k / 3 - 0.2, -0.55, 0); pecas.braco.add(tira);
    }
    pecas.alta.add(pecas.braco);
    grupo.add(pecas.baixa, eixo, mastro, luz, pecas.alta);
    pecas.luz = luz;
    // vidas: bolinhas da cor do jogador (ou da dupla) acima do nome
    pecas.pips = c.bonecos.map((_, i) => {
      const cor = corDe(c, i), g = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.8 });
        m.castShadow = false; m.position.x = (k - 1) * 0.8; g.add(m); return m;
      });
      grupo.add(g); return { g, pips };
    });
    pecas.visto = 0;
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    pecas.baixa.rotation.y = -d.ang;
    pecas.alta.rotation.y = -(d.ang + Math.PI / 2);
    // o braço alto sai do mastro, esticando, nos segundos antes de valer (a luz pisca para avisar)
    const falta = d.alta ? 0 : Math.min(1, Math.max(0, (T_ALTA - p.t) / AVISO_ALTA));
    pecas.braco.visible = falta < 1;
    pecas.braco.scale.x = Math.max(0.02, 1 - falta);
    pecas.luz.material.emissiveIntensity = falta < 1 && d.avisoT >= 0 && (falta > 0 || d.avisoT > 0) ? 0.4 + (Math.floor(t * 8) % 2) * 1.6 : 1.2;
    c.bonecos.forEach((b, i) => {
      const alvo = pecas.pips[i], emPe = !d.fora[i];
      b.visible = emPe ? d.imune[i] <= 0.5 || d.tonto[i] > 0 || Math.floor(t * 14) % 2 === 0 : b.position.y > -12;      // pisca enquanto protegido
      b.rotation.z = emPe && d.tonto[i] > 0 ? Math.sin(t * 40) * 0.3 : 0;
      alvo.g.visible = emPe && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, b.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, b.position.z);      // acima da plaquinha do nome
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'golpe') { c.particulas(e.x, 1, e.z, 0xffffff, 14, 7); c.som(170, 0.16, 'square', 0.1); }
      else if (e.tipo === 'caiu') c.particulas(e.x, 0.6, e.z, corDe(c, e.i), 16, 8);
      else {
        c.particulas(e.x, 1, e.z, 0xffffff, 20, 7);
        const u = c.bonecos[e.i].userData;
        if (u?.corpo) u.corpo.rotation.x = 0;       // acabou de rodopiar na queda
      }
    }
  },
};
