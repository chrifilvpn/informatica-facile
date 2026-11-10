// OCCHI NEL BUIO: nascondino in una casa al buio. Un giocatore è il Cercatore, gli altri si nascondono. Tutti vedono solo
// un piccolo cerchio intorno a sé (i muri fermano lo sguardo). Ogni tanto dove si trova il Cercatore compare una nuvola
// ROSSA che vedono tutti; e ogni tanto dove si trova ogni nascosto compare una nuvola AZZURRA che vede il Cercatore.
// Chi viene toccato dal Cercatore è preso e da quel momento guarda la partita con la casa tutta illuminata.
// Se qualcuno resiste fino alla fine, i nascosti vincono.
// Bilanciamento preso da giochi simili: in Among Us (Hide n Seek) i nascosti "pingano" ogni pochi secondi solo nella
// fase finale, quando il cercatore diventa più veloce; qui le nuvole azzurre arrivano ogni 15 s e negli ultimi 30 s
// ogni 6 s (con il Cercatore più veloce del 15%).
const { Arena, casuale } = require('./arena');
const T = require('./trucco');
// !win + parola segreta: un vantaggio per il round in corso (al massimo 25 secondi di gioco), poi il trucco si spegne
function aggiornaWin(g, dt) {
  const w = g.winOn || (g.winOn = {}), tw = g.winT || (g.winT = {});
  for (let p = 0; p < g.n; p++) {
    if (!(w[p] = T.armato(g, p))) { tw[p] = 0; continue; }
    tw[p] = (tw[p] || 0) + dt;
    if (tw[p] > 25) { T.consuma(g, p); w[p] = false; tw[p] = 0; }
  }
}
function fineWin(g) { for (let p = 0; p < g.n; p++) { T.consuma(g, p); if (g.winOn) g.winOn[p] = false; } }
const C = 40, COLS = 25, RIGHE = 15, W = COLS * C, H = RIGHE * C;
const R = 13, V_NASCOSTO = 200, V_CERCATORE = 185, DURATA = 100, BENDATO = 10, FINALE = 30;
const VISTA_C = 145, VISTA_N = 130, TOCCO = R * 2 + 4, SCOPRE = 32; // nei nascondigli ti vede solo chi ti arriva addosso
const OGNI_ROSSA = 7, OGNI_BLU = 15, OGNI_BLU_FINALE = 6, DURA_NUVOLA = 3;
// # muro, M mobile (non si passa, ma si vede sopra), N nascondiglio (armadio, tenda: ci si entra), . pavimento
const CASE = [
  ['#########################',
   '#N....#......N#........N#',
   '#.....#.......#.........#',
   '#..M..#...M...#....MM...#',
   '#.....#.......#.........#',
   '###.####.......####.#####',
   '#.......................#',
   '#N......MMM.......MM...N#',
   '#.......................#',
   '####.#######.#######.####',
   '#.......#.......#.......#',
   '#..MM...#...M...#...MM..#',
   '#.......#.......#.......#',
   '#N.....N#N......#......N#',
   '#########################'],
  ['#########################',
   '#N.......#.....#.......N#',
   '#...M....#.....#...M....#',
   '#........#..N..#........#',
   '#........##.#.##........#',
   '#.......................#',
   '####.#####..N..#####.####',
   '#.........#...#.........#',
   '#N..MM....#...#...MM...N#',
   '#.........#...#.........#',
   '###.####..........####.##',
   '#.......#...MM...#......#',
   '#..N....#........#....N.#',
   '#.......#N......N#......#',
   '#########################'],
  ['#########################',
   '#N..#.......N.......#..N#',
   '#...#...............#...#',
   '#...#....MMM.MMM....#...#',
   '#...............M.......#',
   '#####...#########...##.##',
   '#N......#.N...N.#......N#',
   '#.......#.......#.......#',
   '#...MM..#...M...#..MM...#',
   '#.......###...###.......#',
   '###.#.............#..####',
   '#...#....#.....#.....#..#',
   '#...N....#.....#.....N..#',
   '#N.......#..N..#.......N#',
   '#########################'],
];

class Buio extends Arena {
  constructor(o) { super(o, { id: 'buio', round: 3 }); this.W = W; this.H = H; this.avvia(); }
  iniziaRound() {
    // la casa: una a caso, specchiata a caso
    const base = CASE[Math.floor(Math.random() * CASE.length)];
    let righe = base.map((r) => r.padEnd(COLS, '#').slice(0, COLS));
    if (Math.random() < 0.5) righe = righe.map((r) => [...r].reverse().join(''));
    if (Math.random() < 0.5) righe = [...righe].reverse();
    this.mappa = righe;
    this.cercatore = (this.round - 1) % this.n;
    // partenze: il Cercatore al centro, gli altri sparsi
    const libere = [];
    for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLS; c++) if (this.mappa[r][c] === '.') libere.push([c, r]);
    const centro = libere.reduce((m, q) => (Math.hypot(q[0] - COLS / 2, q[1] - RIGHE / 2) < Math.hypot(m[0] - COLS / 2, m[1] - RIGHE / 2) ? q : m));
    this.e = Array.from({ length: this.n }, (_, i) => {
      const lontane = libere.filter((l) => Math.hypot(l[0] - centro[0], l[1] - centro[1]) > 4);
      const q = i === this.cercatore ? centro : lontane[Math.floor(Math.random() * lontane.length)] || centro;
      return { id: i, x: q[0] * C + C / 2, y: q[1] * C + C / 2, preso: false, quando: null };
    });
    this.nuvole = []; this.nNuv = 0;
    this.prossimaRossa = BENDATO + OGNI_ROSSA; this.prossimaBlu = BENDATO + OGNI_BLU;
    this.mente = {}; this.catture = [];
  }
  cella(x, y) { const c = Math.floor(x / C), r = Math.floor(y / C); return r < 0 || c < 0 || r >= RIGHE || c >= COLS ? '#' : this.mappa[r][c]; }
  solido(x, y) { const k = this.cella(x, y); return k === '#' || k === 'M'; }
  nascosto(e) { return this.cella(e.x, e.y) === 'N'; }
  // si vede in linea retta? (solo i muri fermano lo sguardo, i mobili sono bassi)
  vede(a, b, raggio) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > raggio) return false;
    const n = Math.ceil(d / 8);
    for (let k = 1; k < n; k++) if (this.cella(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n) === '#') return false;
    return true;
  }
  muovi(e, dx, dy, v, dt) {
    const l = Math.hypot(dx, dy); if (l < 0.05) return;
    const k = Math.min(1.25, l); // oltre 1 solo per recuperare il ritardo della rete (Arena.verso)
    const mx = (dx / l) * k * v * dt, my = (dy / l) * k * v * dt;
    // prima in orizzontale poi in verticale, così si scivola lungo i muri
    const nx = e.x + mx; if (![-R, R].some((o) => this.solido(nx + Math.sign(mx) * R, e.y + o * 0.8))) e.x = nx;
    const ny = e.y + my; if (![-R, R].some((o) => this.solido(e.x + o * 0.8, ny + Math.sign(my) * R))) e.y = ny;
  }
  get finale() { return this.tempoRound >= DURATA - FINALE; }
  passo(dt) {
    aggiornaWin(this, dt);
    const t = this.tempoRound, cer = this.e[this.cercatore];
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p], i = this.inp[p];
      if (e.preso) continue;
      const v = (p === this.cercatore ? V_CERCATORE * (this.finale ? 1.15 : 1) : V_NASCOSTO) * (this.winOn[p] ? 1.25 : 1);
      if (p === this.cercatore && t < BENDATO) continue;
      const d = this.verso(p, e, v, dt); this.muovi(e, d.x, d.y, v, dt);
    }
    // il Cercatore tocca qualcuno: preso
    if (t >= BENDATO) for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (p === this.cercatore || e.preso || Math.hypot(e.x - cer.x, e.y - cer.y) > TOCCO * (this.winOn[this.cercatore] ? 1.6 : 1)) continue;
      e.preso = true; e.quando = t; this.punti[this.cercatore] += 3; this.cambiato = true;
      this.catture.push([Math.round(e.x), Math.round(e.y)]);
      this.annuncia(this.cercatore, 'ha trovato @! 🔦', 'hai trovato @! 🔦', false, { bersaglio: p, testoTe: 'ti ha trovato! Ora vedi tutta la casa 💡' });
    }
    // le nuvole
    if (t >= this.prossimaRossa) { if (!this.winOn[this.cercatore]) this.nuvole.push({ id: ++this.nNuv, c: 'rossa', x: Math.round(cer.x), y: Math.round(cer.y), t }); this.prossimaRossa += OGNI_ROSSA; this.cambiato = true; }
    if (t >= this.prossimaBlu) {
      for (const e of this.e) if (e.id !== this.cercatore && !e.preso && !this.winOn[e.id]) this.nuvole.push({ id: ++this.nNuv, c: 'blu', x: Math.round(e.x), y: Math.round(e.y), t, di: e.id });
      this.prossimaBlu += this.finale ? OGNI_BLU_FINALE : OGNI_BLU; this.cambiato = true;
    }
    if (this.finale && this.prossimaBlu - t > OGNI_BLU_FINALE) this.prossimaBlu = t + OGNI_BLU_FINALE;
    this.nuvole = this.nuvole.filter((q) => t - q.t < DURA_NUVOLA);
    const liberi = this.e.filter((e) => e.id !== this.cercatore && !e.preso).length;
    return liberi === 0 || t >= DURATA;
  }
  fineRound() {
    fineWin(this);
    const liberi = this.e.filter((e) => e.id !== this.cercatore && !e.preso);
    for (const e of this.e) if (e.id !== this.cercatore) this.punti[e.id] += e.preso ? Math.floor((e.quando - BENDATO) / 20) : 5;
    if (!liberi.length) { this.punti[this.cercatore] += 5; this.annuncia(this.cercatore, 'ha trovato tutti! 🔦', 'hai trovato tutti! 🔦', true); }
    else this.annuncia(null, `${liberi.length === 1 ? 'Un nascosto ha resistito' : `${liberi.length} nascosti hanno resistito`} fino alla fine: vincono loro! 🌑`, 'i nascosti hanno resistito!', true);
  }
  // ---------------- computer ----------------
  // strada più corta sulla griglia della casa (muri e mobili non si attraversano)
  strada(da, a, evita = null) {
    const cella = (x, y) => Math.max(0, Math.min(RIGHE - 1, Math.floor(y / C))) * COLS + Math.max(0, Math.min(COLS - 1, Math.floor(x / C)));
    const s = cella(da.x, da.y), f = cella(a.x, a.y);
    if (s === f) return { x: a.x - da.x, y: a.y - da.y };
    const prec = new Int32Array(COLS * RIGHE).fill(-1); prec[s] = s;
    const coda = [s];
    for (let q = 0; q < coda.length && prec[f] < 0; q++) {
      const k = coda[q], r = Math.floor(k / COLS), c = k % COLS;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= RIGHE || cc >= COLS) continue; const kk = rr * COLS + cc; const ch = this.mappa[rr][cc]; if (prec[kk] >= 0 || ch === '#' || ch === 'M') continue;
        if (evita && Math.hypot(cc * C + C / 2 - evita.x, rr * C + C / 2 - evita.y) < 95) continue; // lontano dal Cercatore
        prec[kk] = k; coda.push(kk); }
    }
    if (prec[f] < 0) return evita ? this.strada(da, a) : { x: a.x - da.x, y: a.y - da.y }; // nessuna strada lontana dal Cercatore: si prova la più corta
    let k = f; while (prec[k] !== s) k = prec[k];
    const tx = (k % COLS) * C + C / 2, ty = Math.floor(k / COLS) * C + C / 2;
    const cx = (s % COLS) * C + C / 2, cy = Math.floor(s / COLS) * C + C / 2;
    // si resta al centro del corridoio: ci si muove lungo un asse e intanto ci si allinea sull'altro (niente spigoli)
    const allinea = (d) => Math.max(-0.8, Math.min(0.8, d / 8));
    if (tx !== cx) return { x: Math.sign(tx - da.x) || Math.sign(tx - cx), y: allinea(cy - da.y) };
    return { x: allinea(cx - da.x), y: Math.sign(ty - da.y) || Math.sign(ty - cy) };
  }
  distanze(da) {
    const d = new Int32Array(COLS * RIGHE).fill(9999), s0 = Math.floor(da.y / C) * COLS + Math.floor(da.x / C);
    d[s0] = 0; const coda = [s0];
    for (let q = 0; q < coda.length; q++) {
      const k = coda[q], r = Math.floor(k / COLS), c = k % COLS;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= RIGHE || cc >= COLS) continue; const kk = rr * COLS + cc, ch = this.mappa[rr][cc]; if (d[kk] < 9999 || ch === '#' || ch === 'M') continue; d[kk] = d[k] + 1; coda.push(kk); }
    }
    return d;
  }
  celle(tipo) { const out = []; for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLS; c++) if (this.mappa[r][c] === tipo) out.push({ x: c * C + C / 2, y: r * C + C / 2 }); return out; }
  pensa(p, liv) {
    const e = this.e[p], t = this.tempoRound;
    if (e.preso) return {};
    const m = this.mente[p] || (this.mente[p] = { meta: null, fino: 0 });
    const vai = (q) => { if (Math.hypot(q.x - e.x, q.y - e.y) < 4) return {}; const d = this.strada(e, q); const l = Math.hypot(d.x, d.y) || 1; return { x: d.x / l, y: d.y / l }; };
    const lento = { facile: 0.8, medio: 0.92, difficile: 1 }[liv];
    const scala = (d) => (d.x === undefined ? d : { x: d.x * lento, y: d.y * lento });
    if (p === this.cercatore) {
      if (t < BENDATO) return {};
      // vede qualcuno? lo insegue
      const visti = this.e.filter((o) => o.id !== p && !o.preso && this.vede(e, o, VISTA_C) && (!this.nascosto(o) || Math.hypot(o.x - e.x, o.y - e.y) < SCOPRE));
      if (visti.length) { const o = visti.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0]; m.meta = { x: o.x, y: o.y }; m.fino = t + 1.5; return scala(vai(o)); }
      // nuvole azzurre recenti: il difficile va alla più vicina, il medio a una a caso, il facile spesso le ignora
      const blu = this.nuvole.filter((q) => q.c === 'blu' && t - q.t < 0.2);
      if (blu.length && (liv !== 'facile' || Math.random() < 0.4)) {
        const q = liv === 'difficile' ? blu.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0] : blu[Math.floor(Math.random() * blu.length)];
        m.meta = { x: q.x, y: q.y }; m.fino = t + 12;
      }
      // arrivato alla meta (o finita la voglia): il difficile controlla i nascondigli vicini, gli altri girano a caso
      if (!m.meta || t > m.fino || Math.hypot(m.meta.x - e.x, m.meta.y - e.y) < 20) {
        const nas = this.celle('N').filter((q) => Math.hypot(q.x - e.x, q.y - e.y) < 260 && Math.hypot(q.x - e.x, q.y - e.y) > 30);
        const pav = this.celle('.');
        m.meta = liv === 'difficile' && nas.length && Math.random() < 0.7 ? nas[Math.floor(Math.random() * nas.length)] : pav[Math.floor(Math.random() * pav.length)];
        m.fino = t + 8;
      }
      return scala(vai(m.meta));
    }
    // nascosto: all'inizio corre a un nascondiglio (il difficile il più lontano dal Cercatore, il facile un posto qualunque)
    const cer = this.e[this.cercatore];
    const vistoC = this.vede(e, cer, VISTA_N);
    const rossa = this.nuvole.filter((q) => q.c === 'rossa').pop();
    if (vistoC) m.ultimoC = { x: cer.x, y: cer.y, t };
    else if (rossa) m.ultimoC = { x: rossa.x, y: rossa.y, t: rossa.t };
    const noto = m.ultimoC && t - m.ultimoC.t < 4 ? m.ultimoC : null; // dove si sa che è il Cercatore
    const vicino = noto && Math.hypot(noto.x - e.x, noto.y - e.y) < { facile: 120, medio: 200, difficile: 260 }[liv];
    const mioBlu = this.nuvole.some((q) => q.c === 'blu' && q.di === p && t - q.t < 0.2);
    const cambia = () => {
      const occupati = this.e.filter((o) => o.id !== p && !o.preso).map((o) => this.mente[o.id] && this.mente[o.id].meta).filter(Boolean);
      const da = noto || cer;
      let posti = liv === 'facile' ? this.celle('.') : this.celle('N');
      posti = posti.filter((q) => !occupati.some((o) => o.x === q.x && o.y === q.y) && Math.hypot(q.x - e.x, q.y - e.y) > 30);
      // basta sparire dal punto segnalato: meglio un nascondiglio non troppo lontano (meno strada allo scoperto)
      // e lontano da dove si sa che è il Cercatore
      const viaggio = (q) => Math.hypot(q.x - e.x, q.y - e.y);
      posti = posti.filter((q) => viaggio(q) > 110);
      if (liv === 'difficile') posti.sort((a, b) => (Math.hypot(b.x - da.x, b.y - da.y) - viaggio(b) * 1.3) - (Math.hypot(a.x - da.x, a.y - da.y) - viaggio(a) * 1.3));
      else if (liv === 'medio') posti.sort((a, b) => viaggio(a) - viaggio(b));
      m.meta = liv === 'facile' ? posti[Math.floor(Math.random() * posti.length)] : posti[Math.floor(Math.random() * Math.min(liv === 'difficile' ? 2 : 4, posti.length))];
      m.cambiato = t;
    };
    if (!m.meta) cambia();
    // il Cercatore ti vede da vicino: scappa verso il punto raggiungibile più lontano da lui, girandogli alla larga
    if (vistoC && Math.hypot(cer.x - e.x, cer.y - e.y) < 140 && liv !== 'facile' && (!this.nascosto(e) || Math.hypot(cer.x - e.x, cer.y - e.y) < 45)) {
      if (!m.fuga || t - m.fugaT > 0.6) {
        // distanze vere (a passi nella casa) dal Cercatore e da sé: si scappa dove si arriva molto prima di lui,
        // evitando i vicoli ciechi
        const dS = this.distanze(cer), dH = this.distanze(e);
        let meglio = null, dm = -Infinity;
        for (let k = 0; k < dS.length; k++) {
          if (dH[k] < 2 || dH[k] > 9 || dS[k] <= dH[k]) continue;
          const r = Math.floor(k / COLS), c = k % COLS;
          const aperte = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => { const ch = this.mappa[r + dr] && this.mappa[r + dr][c + dc]; return ch === '.' || ch === 'N'; }).length;
          const v = dS[k] - dH[k] * 0.6 + (aperte <= 1 ? -6 : 0);
          if (v > dm) { dm = v; meglio = { x: c * C + C / 2, y: r * C + C / 2 }; }
        }
        m.fuga = meglio; m.fugaT = t;
      }
      if (m.fuga) { const d = this.strada(e, m.fuga, cer); const l = Math.hypot(d.x, d.y) || 1; m.meta = m.fuga; m.cambiato = t; return scala({ x: d.x / l, y: d.y / l }); }
    }
    // pericolo vicino o appena "segnalato" dalla nuvola azzurra: si cambia posto, ma non di continuo
    if (((vicino && !this.nascosto(e)) || (mioBlu && liv !== 'facile' && (liv === 'difficile' || Math.random() < 0.35))) && t - (m.cambiato || 0) > 2.5) {
      if (liv !== 'facile' || Math.random() < 0.4) cambia();
    }
    if (!m.meta) return {};
    if (Math.hypot(m.meta.x - e.x, m.meta.y - e.y) < 4) return {}; // arrivato: fermo nel nascondiglio
    const d = this.strada(e, m.meta, liv === 'facile' ? null : noto);
    const l = Math.hypot(d.x, d.y) || 1;
    return scala({ x: d.x / l, y: d.y / l });
  }
  vistaExtra() { return { mappa: this.mappa, c: C, vistaC: VISTA_C, vistaN: VISTA_N, bendato: BENDATO, durata: DURATA, finale: FINALE, r: R, vn: V_NASCOSTO, vc: V_CERCATORE }; }
  statoTick(posto) {
    const t = this.tempoRound, io = this.e[posto], cer = this.e[this.cercatore];
    const spettatore = posto === undefined || !io || io.preso || this.fase !== 'gioco';
    const soCercatore = io && posto === this.cercatore;
    const catture = this.catture; this.catture = [];
    // chi vedi: tutti se sei stato preso (o guardi), altrimenti solo chi è nel tuo cerchio (i muri coprono)
    const vedi = (o) => {
      if (spettatore || o.id === posto) return true;
      if (o.preso) return false;
      if (soCercatore && t < BENDATO) return false;
      const r = soCercatore ? VISTA_C : VISTA_N;
      if (!this.vede(io, o, r)) return false;
      if (soCercatore && this.nascosto(o) && Math.hypot(o.x - io.x, o.y - io.y) > SCOPRE) return false;
      return true;
    };
    return {
      cer: this.cercatore, bendato: t < BENDATO ? Math.ceil(BENDATO - t) : 0, resta: Math.max(0, Math.round(DURATA - t)), fin: this.finale ? 1 : 0, tutto: spettatore ? 1 : 0,
      e: this.e.map((o) => (vedi(o) ? { id: o.id, x: Math.round(o.x), y: Math.round(o.y), p: o.preso ? 1 : 0, n: this.nascosto(o) ? 1 : 0 } : { id: o.id, p: o.preso ? 1 : 0 })),
      // nuvole rosse: le vedono tutti tranne il Cercatore (sa dov'è); azzurre: solo il Cercatore (e chi guarda)
      nu: this.nuvole.filter((q) => spettatore || (q.c === 'rossa' ? !soCercatore : soCercatore)).map((q) => ({ id: q.id, c: q.c, x: q.x, y: q.y, e: Math.round((t - q.t) * 100) / 100 })),
      ca: spettatore || soCercatore ? catture : [],
      prossima: soCercatore ? Math.max(0, Math.round(this.prossimaBlu - t)) : Math.max(0, Math.round(this.prossimaRossa - t)),
      cx: spettatore ? Math.round(cer.x) : undefined,
    };
  }
}

module.exports = {
  meta: {
    id: 'buio',
    nome: 'Occhi nel buio',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Nascondino in una casa al buio: vedi solo intorno a te. Nuvole rosse tradiscono il Cercatore, nuvole azzurre tradiscono chi si nasconde.',
    alias: ['buio', 'occhi nel buio', 'nascondino', 'nascondino al buio', 'caccia alle ombre', 'predatore', 'hide and seek'],
    opzioni: [{ id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 }],
    regole: [
      'Una casa al buio con stanze, mobili e nascondigli (armadi e tende). Un giocatore è il Cercatore, gli altri si nascondono; il Cercatore cambia a ogni round. Ci si muove con WASD o le frecce (sul telefono col joystick). Il Cercatore è un po\' più lento dei nascosti, tranne nella caccia finale.',
      'Tutti vedono solo un piccolo cerchio intorno a sé (il Cercatore un po\' più grande); i muri fermano lo sguardo, i mobili no. Chi è dentro un nascondiglio non si vede, a meno che il Cercatore non gli arrivi proprio accanto.',
      'All\'inizio il Cercatore è bendato per 10 secondi: gli altri corrono a nascondersi. Il round dura 100 secondi.',
      'Ogni 7 secondi nel punto dove si trova il Cercatore compare una nuvola ROSSA, che vedono tutti i nascosti. Ogni 15 secondi nel punto dove si trova ogni nascosto compare una nuvola AZZURRA, che vede solo il Cercatore: conviene spostarsi subito dopo!',
      'Caccia finale: negli ultimi 30 secondi le nuvole azzurre arrivano ogni 6 secondi e il Cercatore diventa un po\' più veloce.',
      'Il Cercatore prende un nascosto toccandolo. Chi è preso da quel momento guarda la partita con la casa tutta illuminata e vede tutti.',
      'Punti: il Cercatore 3 per ogni preso, più 5 se li trova tutti. Chi resiste fino alla fine prende 5 punti (i nascosti vincono il round); chi è preso prende 1 punto ogni 20 secondi resistiti. Dopo 3 round (o 1, o 5) vince chi ha più punti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile si nasconde dove capita e spesso ignora le nuvole; il medio usa i nascondigli e scappa quando la nuvola rossa è vicina; il difficile sceglie il nascondiglio più lontano, cambia posto dopo la nuvola azzurra e, da Cercatore, va dritto alle nuvole e controlla gli armadi.',
    ],
  },
  crea: (o) => new Buio(o),
  bot: () => ({}),
  _test: { Buio, CASE, COLS, RIGHE, VISTA_C, VISTA_N, BENDATO },
};
