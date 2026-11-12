// CASELLE COLORATE: il pavimento è fatto di caselle di otto colori e ha una forma diversa a ogni round (cerchio,
// rombo, croce, anello, cuore, isole unite da ponti, macchia a caso). Esce un colore: prima che finisca il tempo
// bisogna stare su una casella di quel colore, perché tutte le altre spariscono e chi ci è sopra cade. Le caselle
// giuste non sono segnate: bisogna riconoscerle. Fuori dalla forma c'è il vuoto: chi ci mette piede cade subito,
// e lo stesso vale per le caselle sparite finché non tornano. Ci si può dare pugni e si raccolgono potenziamenti.
// L'ultimo che resta vince il round.
const { Arena, casuale } = require('./arena');
const T = require('./trucco');
// il trucco segreto (!win): un vantaggio per il resto del round (al massimo 25 secondi di gioco), poi si spegne
function conTrucco(g, p) {
  if (!T.armato(g, p) || g.fase !== 'gioco') return false;
  const da = (g._winDa = g._winDa || {});
  if (da[p] == null || da[p] > g.tempoRound) da[p] = g.tempoRound;
  if (g.tempoRound - da[p] < 25) return true;
  T.consuma(g, p); delete da[p];
  return false;
}
// a fine round si spegne (se è servito almeno un secondo; altrimenti vale anche per il prossimo round)
function fineTrucco(g, sempre = false) {
  for (let p = 0; p < g.n; p++) { const da = g._winDa && g._winDa[p]; if (da != null && (sempre || g.tempoRound - da >= 1)) T.consuma(g, p); if (g._winDa) delete g._winDa[p]; }
}
const W = 1000, H = 620, C = 60, COLS = 16, RIGHE = 10, OX = 20, OY = 10, R = 15, V = 250;
const NCOLORI = 8, NOMI = ['rosso', 'blu', 'verde', 'giallo', 'viola', 'arancione', 'rosa', 'azzurro'];
const CADUTA = 1.6, PUGNO_R = 60, PUGNO_SPINTA = 110, STORDITO = 0.9, RICARICA = 1.1;
// potenziamenti: si prendono passandoci sopra
const POTERI = {
  pugno: { peso: 3, nome: 'Super pugno', emoji: '🥊' },     // il prossimo pugno arriva il doppio più lontano e spinge il doppio
  gelo: { peso: 2, nome: 'Congelamento', emoji: '❄️' },     // l'avversario più vicino resta congelato 1,6 secondi
  velocita: { peso: 3, nome: 'Velocità', emoji: '⚡' },      // +50% di velocità per 4 secondi
  scudo: { peso: 2, nome: 'Scudo', emoji: '🛡️' },           // niente pugni né congelamento per 6 secondi
  piuma: { peso: 1, nome: 'Piuma', emoji: '🪶' },           // la prossima volta che cadresti, voli sulla casella buona più vicina
};
const GELO = 1.6, VELOCE = 4, SCUDO = 6, MAX_POTERI = 2;

// ---------- forme del pavimento: una maschera di COLS × RIGHE caselle ----------
function forma(tipo) {
  const m = new Array(COLS * RIGHE).fill(false);
  const cx = (COLS - 1) / 2, cy = (RIGHE - 1) / 2;
  const metti = (f) => { for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLS; c++) if (f(c, r)) m[r * COLS + c] = true; };
  if (tipo === 'cerchio') metti((c, r) => ((c - cx) / 7.6) ** 2 + ((r - cy) / 4.9) ** 2 <= 1);
  else if (tipo === 'rombo') metti((c, r) => Math.abs(c - cx) / 8.2 + Math.abs(r - cy) / 5.2 <= 1);
  else if (tipo === 'croce') metti((c, r) => Math.abs(c - cx) <= 2.6 || Math.abs(r - cy) <= 1.6);
  else if (tipo === 'anello') metti((c, r) => { const d = ((c - cx) / 7.6) ** 2 + ((r - cy) / 4.9) ** 2; return d <= 1 && d >= 0.22; });
  else if (tipo === 'cuore') metti((c, r) => { const x = (c - cx) / 6.2, y = -(r - cy + 0.6) / 4.2; return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0; });
  else if (tipo === 'isole') {
    // tre o quattro isole rotonde unite da ponti larghi due caselle
    const n = Math.random() < 0.5 ? 3 : 4;
    const centri = n === 3 ? [[3, 3], [12, 3], [7.5, 7]] : [[3, 2.5], [12, 2.5], [3, 7], [12, 7]];
    for (const [x, y] of centri) metti((c, r) => ((c - x) / 3) ** 2 + ((r - y) / 2.3) ** 2 <= 1);
    for (let k = 0; k < centri.length; k++) {
      const [a, b] = [centri[k], centri[(k + 1) % centri.length]];
      for (let t = 0; t <= 1; t += 0.02) { const x = Math.round(a[0] + (b[0] - a[0]) * t), y = a[1] + (b[1] - a[1]) * t; for (const dy of [0, 1]) { const r = Math.round(y - 0.5 + dy); if (r >= 0 && r < RIGHE && x >= 0 && x < COLS) m[r * COLS + x] = true; } }
    }
  } else {
    // macchia a caso: passeggiate casuali che partono dal centro
    for (let p = 0; p < 7; p++) {
      let c = Math.round(cx), r = Math.round(cy);
      for (let k = 0; k < 40; k++) {
        for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const cc = c + dc, rr = r + dr; if (cc >= 0 && rr >= 0 && cc < COLS && rr < RIGHE) m[rr * COLS + cc] = true; }
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        c = Math.max(0, Math.min(COLS - 2, c + d[0])); r = Math.max(0, Math.min(RIGHE - 2, r + d[1]));
      }
    }
  }
  return tieniConnessa(m);
}
// tiene solo il pezzo più grande (così si può sempre arrivare dappertutto)
function tieniConnessa(m) {
  const vis = new Int32Array(m.length).fill(-1); let migliore = -1, dimMax = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || vis[i] >= 0) continue;
    let dim = 0; const coda = [i]; vis[i] = i;
    while (coda.length) { const k = coda.pop(); dim++; for (const j of vicine(k)) if (m[j] && vis[j] < 0) { vis[j] = i; coda.push(j); } }
    if (dim > dimMax) { dimMax = dim; migliore = i; }
  }
  return m.map((x, i) => x && vis[i] === migliore);
}
function vicine(k) { const c = k % COLS, r = Math.floor(k / COLS), out = []; if (c > 0) out.push(k - 1); if (c < COLS - 1) out.push(k + 1); if (r > 0) out.push(k - COLS); if (r < RIGHE - 1) out.push(k + COLS); return out; }
const FORME = ['cerchio', 'rombo', 'croce', 'anello', 'cuore', 'isole', 'macchia'];
const centro = (k) => ({ x: OX + (k % COLS) * C + C / 2, y: OY + Math.floor(k / COLS) * C + C / 2 });

class Arcobaleno extends Arena {
  constructor(o) { super(o, { id: 'arcobaleno', round: 3 }); this.W = W; this.H = H; this.formeUsate = []; this.avvia(); }
  iniziaRound() {
    // forma nuova a ogni round (a caso tra quelle non ancora uscite), con almeno 60 caselle
    let liberi = FORME.filter((f) => !this.formeUsate.includes(f)); if (!liberi.length) { this.formeUsate = []; liberi = FORME; }
    do { this.nomeForma = liberi[Math.floor(Math.random() * liberi.length)]; this.maschera = forma(this.nomeForma); } while (this.maschera.filter(Boolean).length < 60);
    this.formeUsate.push(this.nomeForma);
    this.celle = this.maschera.map((x, k) => (x ? k : -1)).filter((k) => k >= 0);
    this.mescola();
    this.ciclo = 0;
    // si parte sparsi sulla forma, lontani l'uno dall'altro
    const partenze = [];
    for (let i = 0; i < this.n; i++) {
      let meglio = this.celle[0], dm = -1;
      for (let t = 0; t < 40; t++) { const k = this.celle[Math.floor(Math.random() * this.celle.length)], c = centro(k); const d = Math.min(1e9, ...partenze.map((q) => Math.hypot(q.x - c.x, q.y - c.y))); if (d > dm) { dm = d; meglio = k; } }
      partenze.push(centro(meglio));
    }
    this.e = partenze.map((c, i) => ({ id: i, x: c.x, y: c.y, fuori: false, stordito: 0, ricarica: 0, cade: 0, vx: 0, vy: 0, gelo: 0, veloce: 0, scudo: 0, superPugno: false, piuma: false, salto: 0 }));
    this.poteri = []; this.nPot = 0; this.prossimoPotere = casuale(3, 5);
    this.ordine = [];
    this.mente = {};
    this.pugni = []; this.geli = [];
    this.nuovoCiclo();
  }
  mescola() { this.caselle = this.maschera.map((x) => (x ? Math.floor(Math.random() * NCOLORI) : -1)); }
  nuovoCiclo() {
    this.ciclo++;
    this.mescola();
    this.colore = Math.floor(Math.random() * NCOLORI);
    // le caselle giuste diminuiscono turno dopo turno (da circa un ottavo della forma fino a 3)
    const voluti = Math.max(3, Math.round(this.celle.length / 8) + 2 - this.ciclo);
    const giuste = () => this.celle.filter((k) => this.caselle[k] === this.colore);
    let g = giuste();
    while (g.length > voluti) { const k = g[Math.floor(Math.random() * g.length)]; this.caselle[k] = (this.colore + 1 + Math.floor(Math.random() * (NCOLORI - 1))) % NCOLORI; g = giuste(); }
    while (g.length < voluti) { this.caselle[this.celle[Math.floor(Math.random() * this.celle.length)]] = this.colore; g = giuste(); }
    this.fase2 = 'corri';
    // sempre meno tempo: da 3,6 secondi fino a 1,1
    this.timer = Math.max(1.1, 3.6 - (this.ciclo - 1) * 0.25);
    this.timerTot = this.timer;
  }
  casellaDi(x, y) { const c = Math.floor((x - OX) / C), r = Math.floor((y - OY) / C); return c < 0 || r < 0 || c >= COLS || r >= RIGHE ? -1 : r * COLS + c; }
  // c'è pavimento sotto i piedi? (fuori dalla forma mai; durante la caduta solo sulle caselle del colore giusto)
  pieno(k) { if (k < 0 || !this.maschera[k]) return false; return this.fase2 !== 'cade' || this.caselle[k] === this.colore; }
  cade(p) {
    const e = this.e[p];
    const win = conTrucco(this, p); // il trucco segreto: come una piuma che non finisce mai, e senza dirlo a nessuno
    if (e.piuma || win) {
      // la piuma salva una volta: si vola sulla casella buona più vicina
      let meglio = -1, dm = Infinity;
      for (const k of this.celle) if (this.pieno(k)) { const c = centro(k), d = Math.hypot(c.x - e.x, c.y - e.y); if (d < dm) { dm = d; meglio = k; } }
      if (meglio >= 0) { const c = centro(meglio); e.x = c.x; e.y = c.y; e.vx = e.vy = 0; e.salto++; this.cambiato = true; if (win) return; e.piuma = false; this.annuncia(p, 'si salva con la piuma! 🪶', 'la piuma ti ha salvato! 🪶'); return; }
    }
    e.fuori = true; this.ordine.push(p); this.cambiato = true;
    this.annuncia(p, 'cade nel vuoto! 😱', 'sei caduto nel vuoto! 😱');
  }
  passo(dt) {
    // potenziamenti che compaiono
    this.prossimoPotere -= dt;
    if (this.prossimoPotere <= 0) {
      this.prossimoPotere = casuale(4.5, 7);
      if (this.poteri.length < MAX_POTERI) {
        const tipi = Object.keys(POTERI), tot = tipi.reduce((a, t) => a + POTERI[t].peso, 0);
        let r = Math.random() * tot, tipo = tipi[0]; for (const t of tipi) { r -= POTERI[t].peso; if (r <= 0) { tipo = t; break; } }
        // mentre le caselle sono giù compaiono solo sulle caselle rimaste, e mai negli ultimi istanti prima della caduta
        const buone = this.fase2 === 'cade' ? this.celle.filter((j) => this.caselle[j] === this.colore) : this.celle;
        const k = buone[Math.floor(Math.random() * buone.length)], c = centro(k);
        if (k !== undefined && !(this.fase2 === 'corri' && this.timer < 1.5) && !this.poteri.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < C)) this.poteri.push({ id: ++this.nPot, tipo, x: c.x, y: c.y, k });
      }
    }
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (e.fuori) { e.cade += dt; continue; }
      e.ricarica = Math.max(0, e.ricarica - dt);
      e.veloce = Math.max(0, e.veloce - dt); e.scudo = Math.max(0, e.scudo - dt);
      const i = this.inp[p];
      const bloccato = e.stordito > 0 || e.gelo > 0;
      if (e.stordito > 0) e.stordito -= dt;
      if (e.gelo > 0) e.gelo -= dt;
      if (bloccato) this.nuoviTocchi(p);
      else {
        const v = V * (e.veloce > 0 ? 1.5 : 1) * (conTrucco(this, p) ? 1.3 : 1);
        e.x += i.x * v * dt; e.y += i.y * v * dt;
        if (this.nuoviTocchi(p) && e.ricarica <= 0) this.pugno(p);
      }
      // la spinta del pugno si smorza
      e.x += e.vx * dt; e.y += e.vy * dt; const k = Math.exp(-6 * dt); e.vx *= k; e.vy *= k;
      e.x = Math.max(OX - C, Math.min(OX + COLS * C + C, e.x)); e.y = Math.max(OY - C, Math.min(OY + RIGHE * C + C, e.y));
      // potenziamenti raccolti
      for (const q of this.poteri) if (!q.preso && Math.hypot(q.x - e.x, q.y - e.y) < R + 18) { q.preso = true; this.prendi(p, q.tipo); }
      // sul vuoto si cade subito (fuori dalla forma, o sulle caselle sparite durante la caduta)
      if (!this.pieno(this.casellaDi(e.x, e.y))) this.cade(p);
    }
    this.poteri = this.poteri.filter((q) => !q.preso);
    this.timer -= dt;
    if (this.fase2 === 'corri' && this.timer <= 0) {
      this.fase2 = 'cade'; this.timer = CADUTA; this.cambiato = true;
      this.salvaPoteri();
      // chi non è su una casella del colore giusto cade (e per tutta la caduta le altre caselle restano vuote)
      for (let p = 0; p < this.n; p++) if (!this.e[p].fuori && !this.pieno(this.casellaDi(this.e[p].x, this.e[p].y))) this.cade(p);
    } else if (this.fase2 === 'cade' && this.timer <= 0) {
      const vivi = this.e.filter((e) => !e.fuori).length;
      if (vivi <= (this.n === 1 ? 0 : 1)) return true;
      this.nuovoCiclo(); this.cambiato = true;
    }
    return this.tempoRound > 180;
  }
  // i potenziamenti non spariscono con le caselle: saltano sulla casella giusta libera più vicina e restano lì
  salvaPoteri() {
    for (const q of this.poteri) {
      if (this.caselle[q.k] === this.colore) continue;
      let meglio = -1, dm = Infinity;
      for (const k of this.celle) {
        if (this.caselle[k] !== this.colore) continue;
        const c = centro(k), d = Math.hypot(c.x - q.x, c.y - q.y);
        if (d < dm && !this.poteri.some((z) => z !== q && z.k === k)) { dm = d; meglio = k; }
      }
      if (meglio < 0) { q.preso = true; continue; }
      const c = centro(meglio); Object.assign(q, { k: meglio, x: c.x, y: c.y, salta: (q.salta || 0) + 1 });
    }
    this.poteri = this.poteri.filter((q) => !q.preso);
  }
  prendi(p, tipo) {
    const e = this.e[p], P = POTERI[tipo];
    this.cambiato = true;
    if (tipo === 'pugno') e.superPugno = true;
    else if (tipo === 'velocita') e.veloce = VELOCE;
    else if (tipo === 'scudo') e.scudo = SCUDO;
    else if (tipo === 'piuma') e.piuma = true;
    else if (tipo === 'gelo') {
      let bers = null, db = Infinity;
      for (let q = 0; q < this.n; q++) { if (q === p || this.e[q].fuori) continue; const d = Math.hypot(this.e[q].x - e.x, this.e[q].y - e.y); if (d < db) { db = d; bers = q; } }
      if (bers !== null) {
        const b = this.e[bers];
        this.geli.push([Math.round(e.x), Math.round(e.y), Math.round(b.x), Math.round(b.y)]);
        if (b.scudo > 0) { this.annuncia(p, `prova a congelare @, ma lo scudo tiene! 🛡️`, 'lo scudo di @ ha fermato il gelo 🛡️', false, { bersaglio: bers, testoTe: 'lo scudo ti ha salvato dal gelo! 🛡️' }); return; }
        b.gelo = GELO;
        this.annuncia(p, 'congela @! ❄️', 'hai congelato @! ❄️', false, { bersaglio: bers, testoTe: 'ti hanno congelato! ❄️' });
        return;
      }
    }
    this.annuncia(p, `prende ${P.nome} ${P.emoji}`, `hai preso ${P.nome} ${P.emoji}`);
  }
  pugno(p) {
    const e = this.e[p];
    e.ricarica = RICARICA;
    const forte = e.superPugno, raggio = forte ? PUGNO_R * 2 : PUGNO_R;
    let bers = null, db = raggio;
    for (let q = 0; q < this.n; q++) { if (q === p || this.e[q].fuori) continue; const d = Math.hypot(this.e[q].x - e.x, this.e[q].y - e.y); if (d < db) { db = d; bers = q; } }
    this.pugni.push([Math.round(e.x), Math.round(e.y), bers === null ? 0 : 1, forte ? 1 : 0]);
    if (bers === null) return;
    e.superPugno = false;
    const b = this.e[bers];
    if (conTrucco(this, bers)) return; // col trucco segreto i pugni non lo spostano
    if (b.scudo > 0) { this.annuncia(p, 'colpisce lo scudo di @ 🛡️', 'lo scudo di @ para il pugno 🛡️', false, { bersaglio: bers, testoTe: 'lo scudo ha parato un pugno 🛡️' }); return; }
    const dx = b.x - e.x, dy = b.y - e.y, l = Math.hypot(dx, dy) || 1, sp = PUGNO_SPINTA * 6 * (forte ? 2 : 1);
    b.vx = (dx / l) * sp; b.vy = (dy / l) * sp; b.stordito = STORDITO;
    this.annuncia(p, forte ? 'SUPER PUGNO a @! 🥊' : 'tira un pugno a @! 👊', forte ? 'super pugno a @! 🥊' : 'pugno a @! 👊', false, { bersaglio: bers, testoTe: forte ? 'ti ha tirato un super pugno! 💫' : 'ti ha tirato un pugno! 💫' });
  }
  fineRound() {
    fineTrucco(this);
    this.ordine.forEach((p, k) => { this.punti[p] += k; });
    const vivi = this.e.map((e, p) => (e.fuori ? -1 : p)).filter((p) => p >= 0);
    for (const p of vivi) this.punti[p] += this.ordine.length + 2;
    if (this.n === 1) this.punti[0] += this.ciclo - 1;
    if (vivi.length === 1 && this.n > 1) this.annuncia(vivi[0], 'è l\'ultimo in piedi! 🌈', 'sei l\'ultimo in piedi! 🌈', true);
  }
  // distanze in caselle sulla forma (solo camminando sul pavimento), da una casella a tutte le altre
  distanze(da) {
    const d = new Int32Array(this.caselle.length).fill(-1), prec = new Int32Array(this.caselle.length).fill(-1);
    if (da < 0 || !this.maschera[da]) return { d, prec };
    d[da] = 0; const coda = [da];
    for (let q = 0; q < coda.length; q++) { const k = coda[q]; for (const j of vicine(k)) if (this.maschera[j] && d[j] < 0) { d[j] = d[k] + 1; prec[j] = k; coda.push(j); } }
    return { d, prec };
  }
  pensa(p, liv) {
    const e = this.e[p];
    if (e.fuori || e.stordito > 0 || e.gelo > 0) return {};
    const m = this.mente[p] || (this.mente[p] = { ciclo: 0, bersaglio: null, dal: 0 });
    const ritardo = { facile: 0.7, medio: 0.35, difficile: 0.1 }[liv];
    if (m.ciclo !== this.ciclo) { m.ciclo = this.ciclo; m.dal = this.tempoRound; m.bersaglio = null; }
    if (this.fase2 !== 'corri') return {};
    const qui = this.casellaDi(e.x, e.y);
    const { d, prec } = this.distanze(qui);
    if (this.tempoRound - m.dal < ritardo) return {}; // il tempo di riconoscere il colore
    if (!m.bersaglio || this.caselle[m.bersaglio.k] !== this.colore) {
      let meglio = null, vm = Infinity;
      for (const k of this.celle) {
        if (this.caselle[k] !== this.colore) continue;
        const c = centro(k);
        // il facile va dritto (e rischia di finire nel vuoto); gli altri contano la strada sul pavimento
        let v = liv === 'facile' ? Math.hypot(c.x - e.x, c.y - e.y) : (d[k] < 0 ? 1e6 : d[k] * C);
        if (liv !== 'facile') for (let q = 0; q < this.n; q++) if (q !== p && !this.e[q].fuori && Math.hypot(this.e[q].x - c.x, this.e[q].y - c.y) < 60) v += liv === 'difficile' ? 120 : 50;
        if (liv === 'facile') v += casuale(0, 200);
        if (v < vm) { vm = v; meglio = { k, x: c.x, y: c.y }; }
      }
      m.bersaglio = meglio;
    }
    let meta = m.bersaglio;
    // deviazione per un potenziamento, se è sulla strada e il tempo basta (il difficile li cerca apposta)
    if (liv !== 'facile' && meta) {
      const tempoResta = this.timer - (d[meta.k] >= 0 ? d[meta.k] * C : 0) / V;
      for (const q of this.poteri) {
        const dq = d[q.k]; if (dq < 0) continue;
        const giro = dq * C + (this.distanze(q.k).d[meta.k] || 0) * C;
        if (giro / V < this.timer - (liv === 'difficile' ? 0.5 : 0.9) && (liv === 'difficile' || tempoResta > 1.2)) { meta = { k: q.k, x: q.x, y: q.y }; break; }
      }
    }
    if (!meta) return {};
    // la prossima casella della strada (per non tagliare sopra il vuoto)
    let tx = meta.x, ty = meta.y;
    if (liv !== 'facile' && d[meta.k] > 1) {
      let k = meta.k; while (prec[k] >= 0 && prec[k] !== qui) k = prec[k];
      const c = centro(k); tx = c.x; ty = c.y;
    }
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
    // pugno: se qualcuno è vicino (il difficile quando manca poco, per buttarlo fuori dalla casella)
    let tocco = false;
    const raggio = e.superPugno ? PUGNO_R * 2 : PUGNO_R;
    if (e.ricarica <= 0) for (let q = 0; q < this.n; q++) {
      if (q === p || this.e[q].fuori || this.e[q].scudo > 0) continue;
      if (Math.hypot(this.e[q].x - e.x, this.e[q].y - e.y) < raggio - 8) {
        const quando = liv === 'difficile' ? this.timer < 0.8 : liv === 'medio' ? Math.random() < 0.08 : Math.random() < 0.03;
        if (quando) tocco = true;
      }
    }
    const lento = { facile: 0.8, medio: 0.95, difficile: 1 }[liv];
    return l < 10 ? { tocco } : { x: (dx / l) * lento, y: (dy / l) * lento, tocco };
  }
  vistaExtra() { return { poteri: Object.fromEntries(Object.entries(POTERI).map(([k, v]) => [k, v.nome + ' ' + v.emoji])) }; }
  statoTick() {
    const pugni = this.pugni; this.pugni = [];
    const geli = this.geli; this.geli = [];
    return {
      // punti del round fin qui: chi è caduto ha già i suoi, chi è in piedi ne ha uno per ogni caduto
      pr: this.n === 1 ? [Math.max(0, this.ciclo - 1)] : this.e.map((e, p) => { const k = this.ordine.indexOf(p); return k >= 0 ? k : e.fuori ? 0 : this.ordine.length; }),
      fo: this.nomeForma, c: this.caselle, col: this.colore, f2: this.fase2, tm: Math.max(0, Math.round(this.timer * 10) / 10), tt: this.timerTot, ci: this.ciclo, pu: pugni, ge: geli,
      po: this.poteri.map((q) => ({ id: q.id, t: q.tipo, x: q.x, y: q.y })),
      e: this.e.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), f: e.fuori ? Math.min(1, e.cade) : 0, st: e.stordito > 0 ? 1 : 0, ri: e.ricarica > 0 ? 1 : 0, g: e.gelo > 0 ? 1 : 0, v: e.veloce > 0 ? 1 : 0, sc: e.scudo > 0 ? 1 : 0, sp: e.superPugno ? 1 : 0, pi: e.piuma ? 1 : 0, salto: e.salto })),
    };
  }
}

module.exports = {
  meta: {
    id: 'arcobaleno',
    nome: 'Caselle colorate',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Esce un colore: corri su una casella di quel colore prima che le altre spariscano. Pavimento di forma diversa a ogni round, pugni e potenziamenti!',
    alias: ['caselle', 'colori', 'pavimento', 'arcobaleno', 'pugni', 'mario party', 'potenziamenti'],
    opzioni: [{ id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 }],
    regole: [
      'Il pavimento è fatto di caselle di otto colori (rosso, blu, verde, giallo, viola, arancione, rosa, azzurro) e ha una forma diversa a ogni round: cerchio, rombo, croce, anello, cuore, isole unite da ponti o una macchia a caso. Intorno c\'è il vuoto.',
      'A ogni turno in alto compare un colore e parte il conto alla rovescia. Le caselle giuste non sono segnate: devi riconoscerle tu. Prima che il tempo finisca devi stare su una casella di quel colore: tutte le altre spariscono per un momento. Poi le caselle cambiano colore e si ricomincia, ogni volta con meno tempo (da 3,6 secondi fino a poco più di 1) e meno caselle giuste (fino a 3).',
      'Il vuoto non perdona: chi mette piede fuori dalla forma, o su una casella sparita mentre le altre sono giù, cade subito ed è fuori per il resto del round.',
      'Ti muovi con WASD o le frecce (sul telefono col joystick). Con spazio (o il pulsante "Pugno") dai un pugno a chi ti sta vicino: viene spinto via e resta stordito per quasi un secondo. Dopo un pugno bisogna aspettare un attimo per darne un altro.',
      'Potenziamenti (compaiono ogni tanto sul pavimento, se ne prende uno passandoci sopra): 🥊 Super pugno (il prossimo pugno arriva il doppio più lontano e spinge il doppio), ❄️ Congelamento (l\'avversario più vicino resta bloccato 1,6 secondi), ⚡ Velocità (corri il 50% più veloce per 4 secondi), 🛡️ Scudo (per 6 secondi pugni e gelo non ti fanno niente), 🪶 Piuma (la prossima volta che cadresti voli sulla casella buona più vicina; è la più rara). I potenziamenti non spariscono mai con le caselle: quando il pavimento cade saltano sulla casella giusta più vicina e restano lì, così si possono prendere anche mentre le altre caselle sono giù (e ne possono comparire di nuovi sulle caselle rimaste).',
      'Punti del round: uno per ogni giocatore caduto prima di te; chi resta in piedi fino alla fine prende 2 punti in più. Dopo 3 round (o 1, o 5) vince chi ha più punti. Da soli conta quanti turni resisti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile parte tardi, sceglie male e va dritto (anche sopra il vuoto); il medio va alla casella giusta più vicina camminando sul pavimento; il difficile parte subito, sceglie una casella libera, prende i potenziamenti quando c\'è tempo e tira pugni proprio quando manca poco.',
    ],
  },
  crea: (o) => new Arcobaleno(o),
  bot: () => ({}),
  _test: { Arcobaleno, forma, FORME, POTERI, COLS, RIGHE },
};
