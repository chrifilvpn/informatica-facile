// CALCIO BALILLA: il biliardino visto dall'alto, in verticale (così sta bene sul telefono): le porte sono in alto e
// in basso, le stecche attraversano il campo e si muovono a destra e a sinistra. Ogni squadra ha 4 stecche: portiere
// (1 omino), difesa (2), centrocampo (5), attacco (3). In 2 ognuno comanda tutte le stecche della sua squadra (si
// muovono insieme e l'omino più vicino si mette dove punti); in 4 uno comanda portiere e difesa e il compagno
// centrocampo e attacco. Col tasto azione gli omini ruotano e calciano la pallina se è lì davanti.
const { Arena } = require('../giochi/arena');
const T = require('../giochi/trucco');
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

const W = 600, H = 1000, PORTA = 180, R_PALLA = 11, R_OMINO = 14, V_ASTA = 1100, V_TIRO = 1450;
const DURATA_TIRO = 0.26, TIRO_ATTIVO = 0.13, PAUSA_GOL = 1.6;
// le stecche dal basso verso l'alto: squadra (0 = in basso, attacca verso l'alto), ruolo, y, posizioni degli omini
const RUOLI = { portiere: [300], difesa: [190, 410], centrocampo: [80, 190, 300, 410, 520], attacco: [120, 300, 480] };
const STECCHE = [
  [0, 'portiere', 930], [0, 'difesa', 807], [1, 'attacco', 684], [0, 'centrocampo', 561],
  [1, 'centrocampo', 439], [0, 'attacco', 316], [1, 'difesa', 193], [1, 'portiere', 70],
].map(([sq, ruolo, y], i) => {
  const base = RUOLI[ruolo];
  let min = Math.max(...base.map((b) => R_OMINO + 4 - b)), max = Math.min(...base.map((b) => W - R_OMINO - 4 - b));
  if (ruolo === 'portiere') { min = -PORTA / 2 - 20; max = PORTA / 2 + 20; }
  return { i, sq, ruolo, y, base, min, max };
});
const verso = (sq) => (sq === 0 ? -1 : 1); // dove attacca la squadra
const LIV = {
  facile: { ogni: 0.26, rumore: 26, tira: 0.55, mira: 0, anticipa: 0 },
  medio: { ogni: 0.12, rumore: 10, tira: 0.85, mira: 0, anticipa: 0 },
  difficile: { ogni: 0.04, rumore: 2, tira: 1, mira: 1, anticipa: 0 },
};

class Calcetto extends Arena {
  constructor(o) {
    super(o, { id: 'calcetto', round: 1, tickMs: 25 });
    this.nRound = 1;
    this.W = W; this.H = H;
    this.obiettivo = [5, 10, 3].includes(Number(o.opzioni && o.opzioni.gol)) ? Number(o.opzioni.gol) : 5;
    this.aSquadre = this.n === 4;
    this.gol = [0, 0];
    this.etichettaPunti = 'gol';
    this.avvia();
  }
  squadra(p) { return p % 2; }
  // chi comanda la stecca: in 2 tutto, in 4 il primo della squadra fa portiere e difesa, il secondo il resto
  comandante(st) {
    if (!this.aSquadre) return st.sq;
    const dietro = st.ruolo === 'portiere' || st.ruolo === 'difesa';
    return st.sq + (dietro ? 0 : 2);
  }
  iniziaRound() {
    this.aste = STECCHE.map((st) => ({ ...st, s: 0, v: 0, meta: 0, tiro: 0, chi: this.comandante(st) }));
    this.mira = Array.from({ length: this.n }, () => W / 2);
    this.ultimoMx = new Array(this.n).fill(null);
    this.mente = {};
    this.metti(Math.random() < 0.5 ? 0 : 1);
    this.pausa = 0;
    this.fermo = 0;
    this.colpi = [];
  }
  // la pallina davanti al centrocampo di chi deve battere
  metti(sq) {
    const mid = this.aste.find((a) => a.sq === sq && a.ruolo === 'centrocampo');
    this.palla = { x: W / 2 + (Math.random() - 0.5) * 60, y: mid.y + verso(sq) * 30, vx: 0, vy: 0 };
    this.batte = sq;
  }
  omini(a) { return a.base.map((b) => b + a.s); }
  spostaTempi() {}

  // ---------- comandi ----------
  input(p, d) {
    super.input(p, d);
  }
  // le persone: col mouse o col dito l'omino più vicino va dove si punta; con le frecce le stecche scorrono
  comandaGiocatore(p, dt) {
    const i = this.inp[p], sq = this.squadra(p), giro = sq === 1 ? -1 : 1; // la squadra in alto vede il campo girato
    const mie = this.aste.filter((a) => a.chi === p);
    if (Math.abs(i.x) > 0.1) { for (const a of mie) a.meta = Math.max(a.min, Math.min(a.max, a.s + i.x * giro * V_ASTA * 1.2 * dt)); this.ultimoMx[p] = i.mx; return; }
    if (i.mx !== null && i.mx !== this.ultimoMx[p]) { this.ultimoMx[p] = i.mx; this.mira[p] = Math.max(0, Math.min(W, sq === 1 ? W - i.mx : i.mx)); for (const a of mie) a.meta = this.spostaPer(a, this.mira[p]); }
  }
  // lo spostamento della stecca che mette l'omino più adatto in x
  spostaPer(a, x) {
    let meglio = a.s, dm = Infinity;
    for (const b of a.base) {
      const s = Math.max(a.min, Math.min(a.max, x - b));
      const d = Math.abs(s + b - x) * 3 + Math.abs(s - a.s) * 0.2;
      if (d < dm) { dm = d; meglio = s; }
    }
    return meglio;
  }

  // ---------- fisica ----------
  passo(dt) {
    aggiornaWin(this, dt);
    if (this.pausa > 0) {
      this.pausa -= dt;
      if (this.pausa <= 0) { if (Math.max(...this.gol) >= this.obiettivo) return true; this.metti(this.ultimoSubito); }
      return false;
    }
    // le persone: dove puntano; i computer hanno già messo la loro meta in pensa()
    for (let p = 0; p < this.n; p++) {
      if (this.bot[p]) continue;
      this.comandaGiocatore(p, dt);
      if (this.nuoviTocchi(p) > 0) for (const a of this.aste) if (a.chi === p && a.tiro <= 0) a.tiro = DURATA_TIRO;
    }
    for (let p = 0; p < this.n; p++) if (this.bot[p] && this.nuoviTocchi(p) > 0) for (const a of this.aste) if (a.chi === p && a.tiro <= 0) a.tiro = DURATA_TIRO;
    // passi piccoli: la pallina è veloce
    const passi = Math.ceil(dt / 0.004);
    for (let k = 0; k < passi; k++) if (this.fisica(dt / passi)) break; // dopo un gol si aspetta
    return false;
  }
  fisica(dt) {
    for (const a of this.aste) {
      const d = a.meta - a.s, max = V_ASTA * dt;
      const ns = a.s + Math.max(-max, Math.min(max, d));
      a.v = (ns - a.s) / dt; a.s = ns;
      a.tiro = Math.max(0, a.tiro - dt);
    }
    const b = this.palla;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const k = Math.exp(-0.32 * dt); b.vx *= k; b.vy *= k;
    // sponde
    if (b.x < R_PALLA) { b.x = R_PALLA; b.vx = Math.abs(b.vx) * 0.82; }
    if (b.x > W - R_PALLA) { b.x = W - R_PALLA; b.vx = -Math.abs(b.vx) * 0.82; }
    const inPorta = Math.abs(b.x - W / 2) < PORTA / 2 - 2;
    if (!inPorta) {
      if (b.y < R_PALLA) { b.y = R_PALLA; b.vy = Math.abs(b.vy) * 0.82; }
      if (b.y > H - R_PALLA) { b.y = H - R_PALLA; b.vy = -Math.abs(b.vy) * 0.82; }
    } else {
      // i pali della porta
      for (const px of [W / 2 - PORTA / 2, W / 2 + PORTA / 2]) for (const py of [0, H]) {
        const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
        if (d < R_PALLA + 4 && d > 0) { const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } b.x = px + nx * (R_PALLA + 4); b.y = py + ny * (R_PALLA + 4); }
      }
      if (b.y < -R_PALLA * 1.5) return this.segna(0);
      if (b.y > H + R_PALLA * 1.5) return this.segna(1);
    }
    // gli omini: calcio (se la stecca sta ruotando) o rimbalzo
    for (const a of this.aste) {
      if (Math.abs(b.y - a.y) > R_OMINO + R_PALLA + 22) continue;
      const dir = verso(a.sq), attivo = a.tiro > DURATA_TIRO - TIRO_ATTIVO;
      for (const x of this.omini(a)) {
        const dx = b.x - x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        // il calcio: la pallina davanti (o sotto) all'omino che ruota parte verso la porta avversaria
        if (attivo && Math.abs(dx) < R_OMINO + R_PALLA + 2 && dy * dir > -R_PALLA && dy * dir < R_OMINO + R_PALLA + 20) {
          const lato = dx / (R_OMINO + R_PALLA) * 0.55 + (a.v / V_ASTA) * 0.25 + (Math.random() - 0.5) * 0.06;
          const l = Math.hypot(lato, 1);
          b.vx = (lato / l) * V_TIRO; b.vy = (dir / l) * V_TIRO;
          b.y = a.y + dir * (R_OMINO + R_PALLA + 3);
          if (this.winOn[a.chi]) {
            // !win + parola segreta: il tiro parte forte verso l'angolo della porta lontano dal portiere
            const port = this.aste.find((q) => q.sq !== a.sq && q.ruolo === 'portiere'), px = port.base[0] + port.s;
            const tx = W / 2 + (px > W / 2 ? -1 : 1) * (PORTA / 2 - R_PALLA - 10), ty = dir < 0 ? -40 : H + 40;
            const dx2 = tx - b.x, dy2 = ty - b.y, l2 = Math.hypot(dx2, dy2) || 1;
            b.vx = (dx2 / l2) * V_TIRO * 1.25; b.vy = (dy2 / l2) * V_TIRO * 1.25;
          }
          a.tiro = DURATA_TIRO - TIRO_ATTIVO; // un calcio solo per rotazione
          this.colpo(b, 1);
          this.ultimoTocco = a;
          break;
        }
        if (d < R_OMINO + R_PALLA && d > 0) {
          const nx = dx / d, ny = dy / d;
          const rvx = b.vx - a.v, rvy = b.vy, vn = rvx * nx + rvy * ny;
          if (vn < 0) { b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny; if (-vn > 250) this.colpo(b, 0); }
          b.x = x + nx * (R_OMINO + R_PALLA); b.y = a.y + ny * (R_OMINO + R_PALLA);
          this.ultimoTocco = a;
        }
      }
    }
    const v = Math.hypot(b.vx, b.vy);
    if (v > 1900) { b.vx *= 1900 / v; b.vy *= 1900 / v; }
    // pallina ferma dove nessuno ci arriva: il campo è un po' in pendenza verso le stecche; se resta ferma troppo
    // a lungo si rimette in gioco dal centrocampo
    let piu = null, dm = Infinity; for (const a of this.aste) { const d = Math.abs(b.y - a.y); if (d < dm) { dm = d; piu = a; } }
    if (v < 60 && dm > R_OMINO + R_PALLA - 4) { b.vy += Math.sign(piu.y - b.y) * 140 * dt; }
    this.fermo = v < 25 ? this.fermo + dt : 0;
    if (this.fermo > 3.5) { this.fermo = 0; this.metti(Math.random() < 0.5 ? 0 : 1); this.annuncia(null, 'pallina ferma: si rimette in gioco ⚽', 'pallina ferma: si rimette in gioco ⚽'); this.cambiato = true; }
    return false;
  }
  // i colpi alla pallina (per il suono e il lampo): numerati e tenuti per un attimo, così arrivano a tutti
  colpo(b, forte) { this.nC = (this.nC || Math.floor(Date.now() / 10) % 1e9) + 1; this.colpi.push([this.nC, Math.round(b.x), Math.round(b.y), forte, this.tempoRound]); }
  segna(sq) {
    this.gol[sq]++;
    for (let p = 0; p < this.n; p++) if (this.squadra(p) === sq && T.consuma(this, p) && this.winOn) this.winOn[p] = false; // il trucco vale fino al gol
    for (let p = 0; p < this.n; p++) this.punti[p] = this.gol[this.squadra(p)];
    this.ultimoSubito = 1 - sq;
    this.pausa = PAUSA_GOL;
    this.palla.vx = this.palla.vy = 0; this.palla.y = sq === 0 ? -30 : H + 30;
    const autore = this.ultimoTocco && this.ultimoTocco.sq === sq ? this.ultimoTocco.chi : null;
    const ris = `${this.gol[0]}–${this.gol[1]}`;
    if (autore !== null && autore < this.n) this.annuncia(autore, `GOOOL! ⚽ ${ris}`, `GOOOL! ⚽ ${ris}`, true);
    else this.annuncia(null, `Gol ${this.aSquadre ? `della squadra ${sq === 0 ? 'blu' : 'rossa'}` : ''}! ⚽ ${ris}`, `Gol! ⚽ ${ris}`, true);
    this.cambiato = true;
    return 'gol';
  }
  fineRound() { fineWin(this); }
  chiudi() {
    this.finita = true; this.fase = 'fine';
    const vince = this.gol[0] > this.gol[1] ? 0 : this.gol[1] > this.gol[0] ? 1 : null;
    const posti = (sq) => Array.from({ length: this.n }, (_, i) => i).filter((i) => this.squadra(i) === sq);
    this.risultato = {
      fazioni: this.aSquadre ? [0, 1].map((sq) => ({ posti: posti(sq), punti: this.gol[sq] })) : [0, 1].map((sq) => ({ posti: [sq], punti: this.gol[sq] })),
      etichetta: 'gol', pareggio: vince === null, vincitori: vince === null ? [] : posti(vince),
    };
  }

  // ---------- il computer ----------
  pensa(p, liv) {
    const L = LIV[liv] || LIV.medio, sq = this.squadra(p), dir = verso(sq);
    const m = this.mente[p] || (this.mente[p] = { fino: -1, visto: null, tocco: 0 });
    if (this.pausa > 0) return {};
    // vede la pallina solo ogni tanto (tempo di reazione) e con un po' di errore
    if (this.tempoRound >= m.fino) { m.fino = this.tempoRound + L.ogni * (0.7 + Math.random() * 0.6); m.visto = { ...this.palla, x: this.palla.x + (Math.random() - 0.5) * L.rumore }; }
    const b = m.visto;
    let tira = false;
    // dove sarà la pallina quando arriva all'altezza y (con i rimbalzi sulle sponde), se ci va
    const arrivo = (yy) => {
      if (Math.abs(b.vy) < 40) return b.x;
      const t = (yy - b.y) / b.vy;
      if (t < 0 || t > 1.2) return b.x;
      const L0 = R_PALLA, span = W - 2 * R_PALLA;
      let u = (b.x + b.vx * t - L0) % (2 * span); if (u < 0) u += 2 * span;
      return L0 + (u > span ? 2 * span - u : u);
    };
    // la porta avversaria: si mira dalla parte lasciata scoperta dal portiere
    const portiere = this.aste.find((a) => a.sq !== sq && a.ruolo === 'portiere');
    const xPortiere = portiere ? portiere.base[0] + portiere.s : W / 2;
    const bersaglio = W / 2 + (xPortiere > W / 2 ? -1 : 1) * PORTA * 0.32;
    for (const a of this.aste) {
      if (a.chi !== p) continue;
      const davanti = (b.y - a.y) * dir; // > 0: la pallina è nella metà verso cui calcia questa stecca
      let x = L.anticipa ? b.x + (arrivo(a.y) - b.x) * L.anticipa : b.x;
      // portiere e difesa: quando la pallina è lontana stanno tra la pallina e la porta
      if ((a.ruolo === 'portiere' || a.ruolo === 'difesa') && davanti > 60) { const porta = sq === 0 ? H : 0; x = W / 2 + (x - W / 2) * Math.min(1, Math.abs(a.y - porta) / Math.max(60, Math.abs(b.y - porta))) * 1.1; }
      // il difficile sceglie il tiro con la strada più libera verso la porta (niente omini in mezzo, lontano dal portiere)
      if (L.mira >= 1 && davanti > -R_PALLA && davanti < 70) {
        const o = this.scegliTiro(a, b, sq);
        x = b.x - o;
      } else if (L.mira && davanti > -R_PALLA && davanti < 70) {
      // mirare: colpire la pallina un po' di lato per mandarla verso il centro della porta avversaria
        const porta = sq === 0 ? 0 : H, D = Math.max(80, Math.abs(b.y - porta));
        const voglio = ((L.mira >= 1 ? bersaglio : W / 2) - b.x) / D; // vx/vy che serve
        x = b.x - Math.max(-14, Math.min(14, (voglio / 0.55) * (R_OMINO + R_PALLA))) * Math.min(1, L.mira);
      }
      a.meta = this.spostaPer(a, x);
      // tira se la pallina è davanti a uno dei suoi omini
      if (davanti > -R_PALLA && davanti < R_OMINO + R_PALLA + 16 && a.tiro <= 0) {
        for (const ox of this.omini(a)) {
          if (Math.abs(this.palla.x - ox) >= R_OMINO + R_PALLA) continue;
          tira = true; break;
        }
      }
    }
    const tocco = tira && this.tempoRound > m.tocco && Math.random() < L.tira;
    if (tira) m.tocco = this.tempoRound + 0.3;
    return { tocco };
  }

  // il punto d'impatto (scostamento dell'omino rispetto alla pallina) che dà il tiro migliore: si segue la traiettoria
  // dritta (con i rimbalzi sulle sponde) fino alla porta e si contano gli omini che la tagliano
  scegliTiro(a, b, sq) {
    const dir = verso(sq), portaY = sq === 0 ? 0 : H;
    const portiere = this.aste.find((q) => q.sq !== sq && q.ruolo === 'portiere');
    const xp = portiere ? portiere.base[0] + portiere.s : W / 2;
    let meglio = 0, mv = -Infinity;
    for (let o = -13; o <= 13; o += 2.6) {
      const lato = (o / (R_OMINO + R_PALLA)) * 0.55;
      const pend = lato / dir; // dx per ogni dy (dy con il segno della direzione)
      const xa = (yy) => {
        const L0 = R_PALLA, span = W - 2 * R_PALLA;
        let u = (b.x + pend * (yy - b.y) - L0) % (2 * span); if (u < 0) u += 2 * span;
        return L0 + (u > span ? 2 * span - u : u);
      };
      let v = 0;
      for (const q of this.aste) {
        if ((q.y - a.y) * dir <= 0) continue; // solo le stecche davanti
        const xq = xa(q.y);
        const tocca = this.omini(q).some((ox) => Math.abs(ox - xq) < R_OMINO + R_PALLA - 2);
        if (tocca) v -= q.sq === sq ? 3 : q.ruolo === 'portiere' ? 6 : 2;
      }
      const xf = xa(portaY);
      if (Math.abs(xf - W / 2) < PORTA / 2 - R_PALLA) v += 4 + Math.min(3, Math.abs(xf - xp) / 30); else v -= 2;
      v -= Math.abs(o) * 0.02;
      if (v > mv) { mv = v; meglio = o; }
    }
    return meglio;
  }

  vistaExtra() { return { aste: this.aste.map((a) => ({ sq: a.sq, ruolo: a.ruolo, y: a.y, base: a.base, chi: a.chi, min: a.min, max: a.max })), PORTA, R_PALLA, R_OMINO, V_ASTA, DURATA_TIRO, obiettivo: this.obiettivo, aSquadre: this.aSquadre }; }
  statoTick() {
    const t = this.tempoRound; this.colpi = this.colpi.filter((c) => t - c[4] < 0.4 && c[4] <= t);
    const colpi = this.colpi.map((c) => c.slice(0, 4));
    return {
      b: { id: 0, x: Math.round(this.palla.x * 10) / 10, y: Math.round(this.palla.y * 10) / 10 },
      a: this.aste.map((a) => [Math.round(a.s * 10) / 10, a.tiro > 0 ? Math.round((a.tiro / DURATA_TIRO) * 100) / 100 : 0]),
      g: this.gol, gp: this.pausa > 0 ? 1 : 0, c: colpi,
    };
  }
}

module.exports = {
  meta: {
    id: 'calcetto',
    nome: 'Calcio balilla',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [2, 4],
    descrizione: 'Il biliardino: muovi le stecche, fai girare gli omini e tira in porta. Uno contro uno o due contro due.',
    alias: ['biliardino', 'calciobalilla', 'calcio balilla', 'foosball', 'calcetto', 'calcio', 'stecche'],
    opzioni: [{ id: 'gol', nome: 'Si vince a', valori: [5, 10, 3], etichette: ['5 gol', '10 gol', '3 gol'], predefinito: 5 }],
    regole: [
      'Il calcio balilla visto dall\'alto: in verticale la tua porta è sempre quella in basso; sugli schermi larghi (computer, telefono in orizzontale) il tavolo si gira e la tua porta è quella a sinistra. Ogni squadra ha 4 stecche: portiere (1 omino), difesa (2), centrocampo (5) e attacco (3); le stecche delle due squadre sono una in mezzo all\'altra come nel biliardino vero.',
      'In 2 (uno contro uno) comandi tutte le stecche della tua squadra; in 4 (due contro due, compagni i posti 1 e 3 contro 2 e 4) il primo della squadra comanda portiere e difesa, il secondo centrocampo e attacco.',
      'Muovi le stecche con il mouse o col dito sul campo (l\'omino più vicino si mette dove punti), oppure con le frecce destra e sinistra (A e D; col tavolo in orizzontale su e giù, W e S) o il joystick. Le stecche non vanno più veloci di così: bisogna anticipare.',
      'Per tirare premi spazio, clicca o tocca il pulsante ⚽ Tira: tutti gli omini delle tue stecche ruotano e quello che ha la pallina davanti (o sotto) la calcia verso la porta avversaria. Colpendola di lato la si manda di lato.',
      'La pallina rimbalza sulle sponde, sugli omini e sui pali. Gol quando entra nella porta; dopo un gol batte, dal suo centrocampo, chi l\'ha subito. Se la pallina resta ferma dove nessuno ci arriva si rimette in gioco.',
      'Vince la squadra che arriva per prima a 5 gol (o 10, o 3, se scelto prima di iniziare).',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer segue la pallina con la stecca giusta e tira quando gli arriva davanti: il facile reagisce tardi, sbaglia la posizione e a volte non tira; il medio è più svelto e preciso; il difficile reagisce subito e colpisce la pallina un po\' di lato per mandarla verso il centro della porta. Tutti tengono portiere e difesa tra la pallina e la porta.',
    ],
  },
  crea: (o) => new Calcetto(o),
  bot: () => ({}),
  _test: { Calcetto, STECCHE, W, H, PORTA, V_TIRO, DURATA_TIRO, LIV },
};
