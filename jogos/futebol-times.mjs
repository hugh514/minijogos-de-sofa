// Futebol de Duplas (Festa, só times com 4 jogadores). 2 contra 2: o time A (J1 e J3) defende o gol da esquerda e o time B (J2 e J4) o da direita.
// Até 3 gols, ou quem estiver na frente aos 50 s. A bola tem velocidade máxima, o gol reinicia o saque e o botão A é o empurrão do motor.
import { posicionaCantos, colide, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 6.5, GOL = 2.5, RAIO_BOLA = 0.85, V_MAX = 13, GOLS = 3, TEMPO = 50;
const SAQUE = 1.8, ATRITO = 0.3;

function texto(p, t) {       // o celular repete o placar em texto
  p.jogadores.forEach((_, i) => { if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; });
}

function saca(p) {      // bola no centro e cada um no seu canto
  const d = p.dados;
  Object.assign(d.bola, { x: 0, z: 0, vx: 0, vz: 0 });
  posicionaCantos(p, 6, 2.5);
  for (const j of p.jogadores) { j.vx = 0; j.vz = 0; }
}

export default {
  id: 'futebol-times', genero: 'gol', nome: 'Futebol de Duplas', dica: 'Dois contra dois! Chute a bola no gol de cor do outro time. Vence quem fizer 3 gols.',
  festa: { min: 4, max: 4, modos: ['times'] },
  controle: { modo: 'padrao', a: 'CHUTA', b: '' }, semPulo: true,       // o empurrao do motor e o chute
  rotulo: 'gols', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true, gol: GOL };
    p.dados = { bola: { x: 0, z: 0, vx: 0, vz: 0 }, placar: [0, 0], saque: 0, tocando: p.jogadores.map(() => false), fx: [], aviso: '', avisoCor: '#ffffff' };
    saca(p);
    p.dados.bola.vz = 0;
  },

  atualiza(p, dt) {
    const d = p.dados, b = d.bola, a = p.arena;
    texto(p, `Laranja ${d.placar[0]} x ${d.placar[1]} Roxo`);
    if (p.t >= TEMPO) return d.placar[0] === d.placar[1] ? -1 : d.placar[0] > d.placar[1] ? 0 : 1;       // o tempo vale mesmo no meio do saque
    if (d.saque > 0) {
      d.saque -= dt;
      if (d.saque <= 0) { d.saque = 0; d.aviso = ''; b.vz = (p.rng() - 0.5) * 4; }       // saque: um empurraozinho para o lado
      else return undefined;
    }
    p.jogadores.forEach((j, i) => {
      const bateu = j.y < 0.9 && colide(j, b, RAIO, RAIO_BOLA, 1, 0.3);
      if (bateu && !d.tocando[i]) p.eventos.push('batida');
      d.tocando[i] = bateu;
    });
    const at = Math.pow(ATRITO, dt), v = Math.hypot(b.vx, b.vz);
    if (v > V_MAX) { b.vx *= V_MAX / v; b.vz *= V_MAX / v; }      // bola limitada: nenhuma pancada passa disso
    b.vx *= at; b.vz *= at; b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.z) > a.lz - RAIO_BOLA) { b.z = Math.sign(b.z) * (a.lz - RAIO_BOLA); b.vz *= -0.8; }
    if (Math.abs(b.x) > a.lx - RAIO_BOLA) {
      if (Math.abs(b.z) < GOL) {
        if (Math.abs(b.x) > a.lx) {
          const time = b.x > 0 ? 0 : 1;                // a bola no gol da direita e ponto do time A
          d.placar[time]++; d.fx.push({ tipo: 'gol', time, x: b.x, z: b.z }); p.eventos.push('gol');
          if (d.placar[time] >= GOLS) return time;
          d.aviso = time ? 'GOL DO TIME B!' : 'GOL DO TIME A!'; d.avisoCor = time ? '#c9a3ff' : '#ffa552'; d.golDe = time;
          d.saque = SAQUE; saca(p);
          return undefined;
        }
      } else { b.x = Math.sign(b.x) * (a.lx - RAIO_BOLA); b.vx *= -0.8; }
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, a = p.arena, branco = { emissive: 0x666666 };
    const linha = malha(new THREE.BoxGeometry(0.15, 0.02, a.lz * 2), 0xffffff, branco); linha.position.y = 0.01; linha.castShadow = false;
    const circulo = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.45, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    circulo.rotation.x = -Math.PI / 2; circulo.position.y = 0.015;
    grupo.add(linha, circulo);
    for (const s of [-1, 1]) {      // o gol da esquerda e do time A, o da direita e do time B: a cor do time marca quem defende
      const cor = c.times[s > 0 ? 1 : 0];
      const rede = malha(new THREE.BoxGeometry(1.2, 1.6, a.gol * 2), cor, { transparent: true, opacity: 0.55, emissive: cor, emissiveIntensity: 0.3 });
      rede.position.set(s * (a.lx + 0.6), 0.8, 0); rede.castShadow = false; grupo.add(rede);
      const area = new THREE.Mesh(new THREE.PlaneGeometry(3.2, a.gol * 2 + 1.6), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.4 }));
      area.rotation.x = -Math.PI / 2; area.position.set(s * (a.lx - 1.6), 0.012, 0); grupo.add(area);
      for (const t of [-1, 1]) {
        const trave = malha(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 10), 0xffffff, branco); trave.position.set(s * (a.lx + 0.15), 0.95, t * a.gol); grupo.add(trave);
      }
      const travessao = malha(new THREE.CylinderGeometry(0.14, 0.14, a.gol * 2, 10), 0xffffff, branco);
      travessao.rotation.x = Math.PI / 2; travessao.position.set(s * (a.lx + 0.15), 1.9, 0); grupo.add(travessao);
    }
    // bola de futebol: esfera branca com 12 gomos pretos (pentagonos) nos vertices de um icosaedro
    const bola = pecas.bola = new THREE.Group();
    bola.add(malha(new THREE.SphereGeometry(RAIO_BOLA, 28, 18), 0xffffff, { roughness: 0.35 }));
    const verts = new THREE.IcosahedronGeometry(1, 0).attributes.position, visto = new Set(), gomoGeo = new THREE.CircleGeometry(RAIO_BOLA * 0.36, 5);
    for (let k = 0; k < verts.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(verts, k).normalize(), chave = v.toArray().map(x => x.toFixed(3)).join();
      if (visto.has(chave)) continue;
      visto.add(chave);
      const gomo = malha(gomoGeo, 0x15181f, { roughness: 0.5, side: THREE.DoubleSide }); gomo.castShadow = false;
      gomo.position.copy(v).multiplyScalar(RAIO_BOLA * 1.004); gomo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
      bola.add(gomo);
    }
    grupo.add(bola);
    pecas.visto = 0;
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados, b = d.bola, m = pecas.bola;
    m.position.set(b.x, RAIO_BOLA, b.z); m.rotation.z -= b.vx * dt / RAIO_BOLA; m.rotation.x += b.vz * dt / RAIO_BOLA;
    if (d.saque > 0) m.position.y = RAIO_BOLA + Math.abs(Math.sin(t * 8)) * 0.25;       // quica esperando o saque
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      c.particulas(e.x, 1, e.z, c.times[e.time], 50, 12); c.particulas(e.x, 1.5, e.z, 0xffffff, 20, 9);
    }
    if (p.fase === 'resultado' && p.vencedor >= 0 && Math.random() < dt * 30) c.particulas((Math.random() - 0.5) * 14, 2 + Math.random() * 2, (Math.random() - 0.5) * 8, c.times[p.vencedor], 2, 3);
  },
};
