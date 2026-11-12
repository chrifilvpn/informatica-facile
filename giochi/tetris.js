// TETRIS BATTLE in tempo reale: ognuno ha il suo tabellone 10×20, stessi pezzi nello stesso ordine per tutti.
// Niente righe spazzatura: vince chi resiste di più. Hold, pezzo fantasma, velocità che cresce. Da soli: maratona a punti.
const W = 10, H = 20;
const FORME = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
};
const TIPI = Object.keys(FORME);
const celle = (t, r) => FORME[t][r % FORME[t].length];
const PUNTI_RIGHE = [0, 100, 300, 500, 800];
const BLOCCO_MS = 500;
const VIA_MS = 3000;
const T = require('./trucco');
const WIN_MS = 25000; // il trucco segreto (!win): per 25 secondi pezzi comodi e caduta più lenta
// millisecondi per scendere di una riga, per livello (dal livello 1)
const gravita = (liv) => Math.max(45, Math.round(1000 * Math.pow(0.8 - (liv - 1) * 0.007, liv - 1)));

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Tabellone {
  constructor(serie) {
    this.g = new Array(W * H).fill(0);
    this.serie = serie; this.k = 0;
    this.hold = null; this.holdUsato = false;
    this.punti = 0; this.righe = 0; this.livello = 1;
    this.vivo = true; this.morto = null;
    this.nuovo();
  }
  libero(t, r, x, y) { return celle(t, r).every(([a, b]) => { const cx = x + a, cy = y + b; return cx >= 0 && cx < W && cy < H && (cy < 0 || !this.g[cy * W + cx]); }); }
  nuovo(t) {
    const s = t ? null : this.serie(this.k++);
    // col trucco segreto arriva il pezzo che sta meglio nel tabellone (la serie va avanti lo stesso)
    this.t = t || (this.comodo && this.comodo(this)) || s;
    this.r = 0; this.x = 3; this.y = this.t === 'I' ? -1 : 0;
    this.caduta = 0; this.bloccoDa = null; this.mosseBlocco = 0;
    if (!this.libero(this.t, this.r, this.x, this.y)) this.vivo = false;
  }
  prossimi() { return [0, 1, 2].map((i) => this.serie(this.k + i)); }
  muovi(dx, dy) {
    if (!this.libero(this.t, this.r, this.x + dx, this.y + dy)) return false;
    this.x += dx; this.y += dy;
    if (this.bloccoDa != null && this.mosseBlocco < 15) { this.bloccoDa = null; this.mosseBlocco++; }
    return true;
  }
  ruota(verso) {
    const r = (this.r + verso + 4) % 4;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]]) {
      if (this.libero(this.t, r, this.x + dx, this.y + dy)) { this.r = r; this.x += dx; this.y += dy; if (this.bloccoDa != null && this.mosseBlocco < 15) { this.bloccoDa = null; this.mosseBlocco++; } return true; }
    }
    return false;
  }
  fantasma() { let y = this.y; while (this.libero(this.t, this.r, this.x, y + 1)) y++; return y; }
  blocca() {
    for (const [a, b] of celle(this.t, this.r)) { const cy = this.y + b; if (cy < 0) { this.vivo = false; return 0; } this.g[cy * W + this.x + a] = TIPI.indexOf(this.t) + 1; }
    let tolte = 0;
    // per l'animazione nel browser: il tabellone prima di togliere le righe e quali righe spariscono
    const prima = this.g.join('');
    const piene = [];
    for (let y = 0; y < H; y++) if (this.g.slice(y * W, y * W + W).every(Boolean)) piene.push(y);
    if (piene.length) this.lampo = { k: (this.lampo ? this.lampo.k : 0) + 1, quando: Date.now(), g: prima, y: piene };
    for (let y = H - 1; y >= 0; y--) {
      if (this.g.slice(y * W, y * W + W).every(Boolean)) { this.g.splice(y * W, W); this.g.unshift(...new Array(W).fill(0)); tolte++; y++; }
    }
    this.righe += tolte;
    this.punti += PUNTI_RIGHE[tolte] * this.livello;
    this.livello = 1 + Math.floor(this.righe / 10);
    this.holdUsato = false;
    this.nuovo();
    return tolte;
  }
}

class Tetris {
  constructor({ n, bot = [] }) {
    this.id = 'tetris';
    this.n = n;
    const rnd = mulberry((Math.random() * 2 ** 32) >>> 0);
    const pezzi = [];
    this.serie = (k) => { while (pezzi.length <= k) { const sac = [...TIPI]; for (let i = 6; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sac[i], sac[j]] = [sac[j], sac[i]]; } pezzi.push(...sac); } return pezzi[k]; };
    this.tab = Array.from({ length: n }, (_, p) => { const b = new Tabellone(this.serie); b.comodo = (x) => (this.conTrucco(p, Date.now()) ? pezzoComodo(x) : null); return b; });
    this.bot = bot.slice();
    this.piani = new Array(n).fill(null);
    this.tickMs = 50;
    this.via = Date.now() + VIA_MS;
    this.ultimo = null;
    this.morti = [];
    this.inPausa = false; this.pausaDal = null;
    this.turno = null; this.inAttesa = false; this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  impostaBot(p, livello) { this.bot[p] = livello; }
  impostaPausa(si) {
    if (si === this.inPausa || this.finita) return;
    if (si) this.pausaDal = Date.now(); else if (this.pausaDal) { this.via += Date.now() - this.pausaDal; this.ultimo = null; }
    this.inPausa = si;
  }

  input(p, d) {
    const b = this.tab[p];
    if (!b || !b.vivo || this.finita || Date.now() < this.via) return;
    this.esegui(p, d.az);
  }
  esegui(p, az) {
    const b = this.tab[p];
    if (az === 'sx') b.muovi(-1, 0);
    else if (az === 'dx') b.muovi(1, 0);
    else if (az === 'giu') { if (b.muovi(0, 1)) b.punti += 1; }
    else if (az === 'ruota') b.ruota(1);
    else if (az === 'ruotaSx') b.ruota(-1);
    else if (az === 'caduta') { const y = b.fantasma(); b.punti += 2 * (y - b.y); b.y = y; this.fissa(p); }
    else if (az === 'hold' && !b.holdUsato) { const t = b.t; const h = b.hold; b.hold = t; b.nuovo(h || undefined); b.holdUsato = true; this.piani[p] = null; this.controllaMorte(p); }
  }
  fissa(p) {
    const b = this.tab[p];
    const tolte = b.blocca();
    this.piani[p] = null;
    if (tolte === 4) this.annuncia(p, 'fa TETRIS!', 'TETRIS! 🎉');
    this.controllaMorte(p);
  }
  controllaMorte(p) {
    const b = this.tab[p];
    if (b.vivo || b.morto) return;
    b.morto = Date.now();
    this.morti.push(p);
    this.cambiato = true;
    if (this.n > 1) this.annuncia(p, 'è arrivato in cima: fuori!', 'sei arrivato in cima!', true);
  }

  tick(ora) {
    if (this.finita || this.inPausa || ora < this.via) { this.ultimo = null; return false; }
    const dt = this.ultimo ? Math.min(200, ora - this.ultimo) : this.tickMs;
    this.ultimo = ora;
    this.cambiato = false;
    this.tab.forEach((b, p) => {
      if (!b.vivo) return;
      if (this.bot[p]) this.muoviBot(p, dt);
      if (!b.vivo) return;
      b.caduta += dt;
      const g = gravita(b.livello) * (this.conTrucco(p, ora) ? 2 : 1);
      while (b.caduta >= g) { b.caduta -= g; if (!b.muovi(0, 1)) break; }
      if (!b.libero(b.t, b.r, b.x, b.y + 1)) {
        if (b.bloccoDa == null) b.bloccoDa = 0;
        b.bloccoDa += dt;
        if (b.bloccoDa >= BLOCCO_MS) this.fissa(p);
      } else b.bloccoDa = null;
    });
    const vivi = this.tab.filter((b) => b.vivo).length;
    if (this.n === 1 ? vivi === 0 : vivi <= 1) { this.chiudi(); return true; }
    return this.cambiato;
  }

  // il computer calcola dove mettere il pezzo e poi ci arriva un passo alla volta, con la sua velocità
  muoviBot(p, dt) {
    const b = this.tab[p], liv = this.bot[p];
    const veloce = { facile: 380, medio: 170, difficile: 70 }[liv] || 170;
    if (!this.piani[p]) this.piani[p] = { ...pianoBot(b, liv), attesa: veloce };
    const piano = this.piani[p];
    piano.attesa -= dt;
    if (piano.attesa > 0) return;
    piano.attesa = veloce;
    if (b.r !== piano.r) { if (!b.ruota(1)) piano.r = b.r; return; }
    if (b.x < piano.x) { if (!b.muovi(1, 0)) piano.x = b.x; return; }
    if (b.x > piano.x) { if (!b.muovi(-1, 0)) piano.x = b.x; return; }
    this.esegui(p, 'caduta');
  }

  // il trucco segreto: true per i primi 25 secondi di gioco dopo il comando, poi si spegne
  conTrucco(p, ora) {
    if (!T.armato(this, p) || ora < this.via) return false;
    const da = (this._winDa = this._winDa || {});
    if (da[p] == null) da[p] = ora;
    if (ora - da[p] < WIN_MS) return true;
    T.consuma(this, p); delete da[p];
    return false;
  }

  chiudi() {
    this.finita = true;
    for (let p = 0; p < this.n; p++) T.consuma(this, p);
    const punti = this.tab.map((b) => b.punti);
    let vincitori;
    if (this.n === 1) vincitori = [0];
    else { const v = this.tab.findIndex((b) => b.vivo); vincitori = v >= 0 ? [v] : [this.morti[this.morti.length - 1]]; }
    if (this.n > 1) this.annuncia(vincitori[0], 'resiste più di tutti!', 'hai resistito più di tutti!', true);
    this.risultato = { fazioni: punti.map((x, i) => ({ posti: [i], punti: x })), etichetta: 'punti', pareggio: false, vincitori };
  }

  vistaTick(p) {
    const ora = Date.now();
    return {
      t: this.tab.map((b, i) => ({
        g: b.g.join(''), v: b.vivo, p: b.punti, r: b.righe, l: b.livello,
        // il pezzo in caduta, il fantasma e i prossimi servono in grande solo a chi gioca; agli altri basta il pezzo
        pz: b.vivo ? { t: b.t, r: b.r, x: b.x, y: b.y } : null,
        // righe appena tolte: si mandano per mezzo secondo (i messaggi possono perdersi), il browser le anima una volta
        ...(b.lampo && ora - b.lampo.quando < 500 ? { lp: { k: b.lampo.k, g: b.lampo.g, y: b.lampo.y } } : {}),
        ...(i === p ? { f: b.vivo ? b.fantasma() : null, h: b.hold, hu: b.holdUsato, nx: b.prossimi() } : {}),
      })),
      via: Math.max(0, this.via - ora), pausa: this.inPausa,
    };
  }
  vista(p) {
    return { gioco: this.id, n: this.n, W, H, forme: FORME, tipi: TIPI, stato: this.vistaTick(p), turno: null, inAttesa: false, finita: this.finita, risultato: this.risultato, evento: this.evento };
  }
}

// valutazione di un tabellone (pesi alla Dellacherie semplificati)
function valuta(g) {
  const alt = new Array(W).fill(0);
  let buchi = 0;
  for (let x = 0; x < W; x++) {
    let visto = false;
    for (let y = 0; y < H; y++) { if (g[y * W + x]) { if (!visto) { alt[x] = H - y; visto = true; } } else if (visto) buchi++; }
  }
  let buca = 0;
  for (let x = 0; x < W - 1; x++) buca += Math.abs(alt[x] - alt[x + 1]);
  return -0.51 * alt.reduce((a, c) => a + c, 0) - 0.36 * buchi * 2 - 0.18 * buca - (Math.max(...alt) > 14 ? 5 : 0);
}
function pianoBot(b, liv) {
  let meglio = { r: b.r, x: b.x }, vm = -Infinity;
  for (let r = 0; r < FORME[b.t].length; r++) {
    for (let x = -2; x < W; x++) {
      if (!b.libero(b.t, r, x, b.y) && !b.libero(b.t, r, x, Math.max(b.y, 0))) continue;
      let y = b.y;
      if (!b.libero(b.t, r, x, y)) continue;
      while (b.libero(b.t, r, x, y + 1)) y++;
      const g = b.g.slice();
      let fuori = false;
      for (const [a, c] of celle(b.t, r)) { if (y + c < 0) fuori = true; else g[(y + c) * W + x + a] = 1; }
      if (fuori) continue;
      let righe = 0;
      for (let yy = 0; yy < H; yy++) if (g.slice(yy * W, yy * W + W).every(Boolean)) righe++;
      let v = valuta(g) + righe * 0.76 * 3;
      if (liv === 'facile') v += Math.random() * 6; else if (liv === 'medio') v += Math.random() * 1.2;
      if (v > vm) { vm = v; meglio = { r, x }; }
    }
  }
  return { ...meglio, v: vm };
}
// il pezzo che si incastra meglio (per il trucco segreto): si prova ogni forma con il computer difficile
function pezzoComodo(b) {
  let meglio = null, vm = -Infinity;
  for (const t of TIPI) {
    const prova = Object.assign(Object.create(b), { t, r: 0, x: 3, y: t === 'I' ? -1 : 0 });
    if (!b.libero(t, 0, 3, prova.y)) continue;
    const { v } = pianoBot(prova, 'difficile');
    if (v > vm) { vm = v; meglio = t; }
  }
  return meglio;
}

module.exports = {
  meta: {
    id: 'tetris',
    nome: 'Tetris Battle',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Pezzi che cadono sempre più veloci: resisti più degli altri. Da soli è una maratona a punti.',
    opzioni: [],
    regole: [
      'Ognuno ha il suo tabellone di 10 colonne per 20 righe. I pezzi (le 7 forme classiche) cadono dall\'alto: spostali e ruotali per completare righe intere, che spariscono.',
      'Tutti ricevono gli stessi pezzi nello stesso ordine (a gruppi di 7, ognuno una volta sola per gruppo). Non ci sono righe spazzatura: ognuno pensa al suo tabellone.',
      'Comandi: ← → per spostare, ↓ per scendere più veloce, ↑ o X per ruotare in senso orario, Z per ruotare al contrario, Spazio per far cadere subito il pezzo, C o Shift per il Hold (metti da parte il pezzo e prendi quello tenuto; una volta per pezzo). Sul telefono ci sono i pulsanti sotto il tabellone.',
      'Il pezzo fantasma (in trasparenza) mostra dove cadrà il pezzo. Quando tocca giù hai mezzo secondo per sistemarlo prima che si blocchi.',
      'Punti: 100, 300, 500 o 800 per 1, 2, 3 o 4 righe insieme (4 righe = Tetris), moltiplicati per il livello; +1 per ogni riga scesa con ↓ e +2 con la caduta istantanea. Ogni 10 righe si sale di livello e i pezzi cadono più veloci.',
      'Si perde quando un nuovo pezzo non entra più. In più giocatori vince l\'ultimo che resiste; da soli è una maratona: fai più punti che puoi.',
      'La partita parte dopo 3 secondi. È in tempo reale: se qualcuno apre le dispense (Esc) si ferma per tutti.',
      'Il computer facile è lento e sbaglia spesso, il medio è ordinato, il difficile è veloce e lascia pochissimi buchi.',
    ],
  },
  crea: (o) => new Tetris(o),
  bot: () => ({}),
  _test: { Tabellone, gravita, pezzoComodo, W, H },
};
