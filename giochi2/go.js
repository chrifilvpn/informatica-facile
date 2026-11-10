// GO: goban 9×9 o 13×13 (anche 19×19), nero e bianco a turno mettono una pietra su un incrocio libero. Un gruppo
// senza libertà viene catturato; il suicidio non è permesso; regola del ko (non si può ripetere la posizione di
// prima). Due passaggi di fila chiudono la partita: si segnano le pietre morte (proposte dal computer, si possono
// cambiare) e si conta ad area (pietre più territorio, regole cinesi) con il komi al bianco.
//
// Tavola interna: array di (N+2)² con il bordo; 0 vuoto, 1 nero, 2 bianco, 3 bordo. Le catene si tengono con liste
// circolari e "pseudo-libertà" (il conto delle adiacenze vuote), come nei programmi di go veloci.
const { ora } = require('../giochi/orologio'); // orologio vero (nel sito) o finto (nei test)

class Tavola {
  constructor(N) {
    this.N = N; this.W = N + 2;
    const T = this.W * this.W;
    this.c = new Uint8Array(T);
    this.capo = new Int32Array(T); this.dopo = new Int32Array(T);
    this.lib = new Int32Array(T); this.dim = new Int32Array(T);
    for (let i = 0; i < T; i++) { const x = i % this.W, y = (i / this.W) | 0; if (x === 0 || y === 0 || x === this.W - 1 || y === this.W - 1) this.c[i] = 3; }
    this.ko = -1;
    this.vicini = [-this.W, 1, this.W, -1];
    this.catturate = [0, 0, 0];
  }
  copia() {
    const t = Object.create(Tavola.prototype);
    t.N = this.N; t.W = this.W; t.vicini = this.vicini; t.ko = this.ko;
    t.c = this.c.slice(); t.capo = this.capo.slice(); t.dopo = this.dopo.slice(); t.lib = this.lib.slice(); t.dim = this.dim.slice();
    t.catturate = this.catturate.slice();
    return t;
  }
  pt(x, y) { return (y + 1) * this.W + (x + 1); }
  // la mossa è legale? (vuoto, non ko, non suicidio)
  legale(p, col) {
    if (this.c[p] !== 0 || p === this.ko) return false;
    const avv = 3 - col;
    for (const d of this.vicini) {
      const q = p + d, cq = this.c[q];
      if (cq === 0) return true;
      if (cq === 3) continue;
      const h = this.capo[q];
      let adj = 0;
      for (const e of this.vicini) if (this.c[p + e] === cq && this.capo[p + e] === h) adj++;
      if (cq === col ? this.lib[h] > adj : (cq === avv && this.lib[h] === adj)) return true;
    }
    return false;
  }
  // gioca (la mossa deve essere legale); restituisce le pietre catturate
  gioca(p, col) {
    const avv = 3 - col, W = this.vicini;
    this.c[p] = col; this.capo[p] = p; this.dopo[p] = p; this.dim[p] = 1;
    let l = 0;
    for (const d of W) if (this.c[p + d] === 0) l++;
    this.lib[p] = l;
    // la pietra toglie una pseudo-libertà a ogni catena vicina (una per ogni adiacenza)
    for (const d of W) { const q = p + d; if (this.c[q] === 1 || this.c[q] === 2) this.lib[this.capo[q]]--; }
    // unisce con le proprie catene vicine
    for (const d of W) {
      const q = p + d;
      if (this.c[q] === col && this.capo[q] !== this.capo[p]) this.unisci(this.capo[p], this.capo[q]);
    }
    // cattura le catene avversarie rimaste senza libertà
    let prese = 0, ultimaPresa = -1;
    for (const d of W) {
      const q = p + d;
      if (this.c[q] === avv && this.lib[this.capo[q]] === 0) { const n = this.dim[this.capo[q]]; ultimaPresa = q; prese += n; this.togli(this.capo[q]); }
    }
    this.catturate[col] += prese;
    const h = this.capo[p];
    this.ko = prese === 1 && this.dim[h] === 1 && this.lib[h] === 1 ? ultimaPresa : -1;
    return prese;
  }
  unisci(a, b) {
    // la catena più piccola entra nella più grande
    if (this.dim[a] < this.dim[b]) [a, b] = [b, a];
    let s = b;
    do { this.capo[s] = a; s = this.dopo[s]; } while (s !== b);
    const t = this.dopo[a]; this.dopo[a] = this.dopo[b]; this.dopo[b] = t;
    this.dim[a] += this.dim[b]; this.lib[a] += this.lib[b];
  }
  togli(h) {
    let s = h;
    do {
      const n = this.dopo[s];
      this.c[s] = 0;
      for (const d of this.vicini) { const q = s + d; if ((this.c[q] === 1 || this.c[q] === 2)) this.lib[this.capo[q]]++; }
      s = n;
    } while (s !== h);
  }
  // occhio "vero" semplice: tutti i vicini del colore (o bordo) e non più di una diagonale avversaria (zero sul bordo)
  occhio(p, col) {
    for (const d of this.vicini) { const cq = this.c[p + d]; if (cq !== col && cq !== 3) return false; }
    const W = this.W;
    let cattive = 0, bordo = false;
    for (const d of [-W - 1, -W + 1, W - 1, W + 1]) { const cq = this.c[p + d]; if (cq === 3) bordo = true; else if (cq === 3 - col) cattive++; }
    return bordo ? cattive === 0 : cattive <= 1;
  }
  // libertà vere di una catena (per i controlli e l'atari)
  liberta(h) {
    const viste = new Set();
    let s = h;
    do { for (const d of this.vicini) if (this.c[s + d] === 0) viste.add(s + d); s = this.dopo[s]; } while (s !== h);
    return viste;
  }
  // conteggio ad area: pietre + vuoti circondati da un colore solo
  area(morte = null) {
    const c = this.c.slice();
    if (morte) for (const p of morte) c[p] = 0;
    const pt = [0, 0, 0];
    const terr = new Int8Array(c.length);
    const visto = new Uint8Array(c.length);
    for (let p = 0; p < c.length; p++) {
      if (c[p] === 1 || c[p] === 2) { pt[c[p]]++; terr[p] = c[p]; continue; }
      if (c[p] !== 0 || visto[p]) continue;
      const zona = [p]; visto[p] = 1;
      let tocca = 0;
      for (let k = 0; k < zona.length; k++) {
        for (const d of this.vicini) {
          const q = zona[k] + d;
          if (c[q] === 0 && !visto[q]) { visto[q] = 1; zona.push(q); } else if (c[q] === 1 || c[q] === 2) tocca |= c[q];
        }
      }
      if (tocca === 1 || tocca === 2) { pt[tocca] += zona.length; for (const q of zona) terr[q] = tocca; }
    }
    return { nero: pt[1], bianco: pt[2], terr };
  }
}

// partita casuale fino alla fine (per il computer e per capire le pietre morte); restituisce l'area finale
function partitaCasuale(t, col, maxMosse, vuoti) {
  let passati = 0;
  const lista = vuoti.slice();
  for (let m = 0; m < maxMosse && passati < 2; m++) {
    let n = lista.length, scelta = -1;
    while (n > 0) {
      const k = (Math.random() * n) | 0;
      const p = lista[k];
      if (t.c[p] === 0 && !t.occhio(p, col) && t.legale(p, col)) { scelta = p; break; }
      lista[k] = lista[n - 1]; lista[n - 1] = p; n--;
    }
    if (scelta < 0) passati++;
    else {
      passati = 0;
      t.gioca(scelta, col);
    }
    // aggiorna la lista dei vuoti ogni tanto (le catture liberano punti)
    if ((m & 15) === 15 || scelta < 0) { lista.length = 0; for (let i = 0; i < t.c.length; i++) if (t.c[i] === 0) lista.push(i); }
    col = 3 - col;
  }
  return t;
}

// ---------- ricerca Monte Carlo ad albero (UCT con RAVE) ----------
class Nodo {
  constructor(mossa, col, genitore) {
    this.mossa = mossa; this.col = col; this.genitore = genitore; // col = chi ha fatto la mossa per arrivare qui
    this.figli = null; this.v = 0; this.n = 0; this.rv = new Map(); // RAVE: mossa -> [vinte, giocate]
  }
}
// quanto "ha senso" un incrocio a prima vista (da -0,6 a +0,6): le linee 3 e 4 e i punti vicini alle pietre valgono di
// più, il bordo vuoto di meno. Serve sui goban grandi, dove le partite simulate sono poche rispetto agli incroci: senza,
// tutte le mosse restavano a pari merito e il computer metteva le pietre in fila sulla prima riga (A19, B19, C19…).
function sensato(t, q) {
  const W = t.W, N = t.N;
  const x = (q % W) - 1, y = ((q / W) | 0) - 1;
  const d = Math.min(x, y, N - 1 - x, N - 1 - y);
  let vicine = 0, attaccate = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= N || y + dy >= N) continue;
    const v = t.c[q + dy * W + dx];
    if (v === 1 || v === 2) { vicine++; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) attaccate++; }
  }
  let s = d === 0 ? (attaccate ? -0.15 : -0.6) : d === 1 ? (vicine ? 0 : -0.35) : d <= 3 ? 0.3 : 0.1;
  if (vicine) s += 0.3;
  return s;
}
function mcts(tav, col, ms, komi, maxPlayout = Infinity) {
  const fino = ora() + ms;
  const radice = new Nodo(-1, 3 - col, null);
  const N = tav.N;
  const maxM = N * N * 2;
  let giri = 0;
  const vuotiDi = (t) => { const v = []; for (let i = 0; i < t.c.length; i++) if (t.c[i] === 0) v.push(i); return v; };
  const espandi = (nodo, t, c) => {
    nodo.figli = [];
    for (let i = 0; i < t.c.length; i++) if (t.c[i] === 0 && !t.occhio(i, c) && t.legale(i, c)) { const f = new Nodo(i, c, nodo); f.pr = sensato(t, i); nodo.figli.push(f); }
    const passo = new Nodo(-1, c, nodo); passo.pr = 0; nodo.figli.push(passo); // passo
  };
  while ((giri & 15 || ora(0.9) < fino) && giri < maxPlayout) {
    giri++;
    const t = tav.copia();
    let nodo = radice, c = col, passi = 0;
    const percorso = [radice];
    // selezione
    while (nodo.figli && nodo.figli.length) {
      let best = null, bv = -Infinity;
      const lnN = Math.log(nodo.n + 1);
      for (const f of nodo.figli) {
        const r = nodo.rv.get(f.mossa);
        const rn = r ? r[1] : 0, rw = r ? r[0] / r[1] : 0.5;
        const beta = rn / (rn + f.n + rn * f.n / 300 + 1e-9);
        const q = f.n ? f.v / f.n : 0.5;
        let val = (1 - beta) * q + beta * rw + (f.n ? 0.35 * Math.sqrt(lnN / f.n) : 1.2) + 0.4 * f.pr / (f.n + 1);
        if (f.mossa < 0) val -= 0.25; // il passo si prova per ultimo
        if (val > bv) { bv = val; best = f; }
      }
      nodo = best;
      if (nodo.mossa >= 0) { t.gioca(nodo.mossa, c); passi = 0; } else passi++;
      percorso.push(nodo);
      c = 3 - c;
      if (passi >= 2) break;
    }
    if (passi < 2 && nodo.n >= 1 && !nodo.figli) { espandi(nodo, t, c); }
    // simulazione
    const prima = new Set();
    for (let i = 0; i < t.c.length; i++) if (t.c[i] === 0) prima.add(i);
    if (passi < 2) partitaCasuale(t, c, maxM, vuotiDi(t));
    const a = t.area();
    const vinceNero = a.nero - a.bianco - komi > 0;
    // mosse giocate nella simulazione (per il RAVE): i punti vuoti prima e occupati dopo, col colore che li ha
    // presi (approssimazione)
    // aggiornamento
    for (const x of percorso) {
      x.n++;
      if ((x.col === 1) === vinceNero) x.v++;
    }
    for (const x of percorso) {
      if (!x.figli) continue;
      const giocaQui = 3 - x.col; // chi muove da questo nodo
      const vinse = (giocaQui === 1) === vinceNero;
      for (const p of prima) {
        if (t.c[p] !== giocaQui) continue;
        let r = x.rv.get(p);
        if (!r) { r = [0, 0]; x.rv.set(p, r); }
        r[1]++; if (vinse) r[0]++;
      }
    }
  }
  if (!radice.figli) espandi(radice, tav, col);
  // la più visitata; a pari visite (succede sui goban grandi) quella che è andata meglio nelle simulazioni e ha più senso
  const voto = (f) => { const r = radice.rv.get(f.mossa); return (r && r[1] ? r[0] / r[1] : 0.5) + 0.5 * (f.pr || 0) - (f.mossa < 0 ? 1 : 0); };
  const ordinati = [...radice.figli].sort((x, y) => y.n - x.n || voto(y) - voto(x));
  const best = ordinati[0];
  return { mossa: best.mossa, vinte: best.n ? best.v / best.n : 0.5, giri, radice };
}

// pietre morte: dopo tante partite casuali, i gruppi che finiscono quasi sempre all'avversario
function pietreMorte(tav, col, quante = 160) {
  const T = tav.c.length;
  const proprieta = new Float32Array(T); // + nero, - bianco
  const vuoti = []; for (let i = 0; i < T; i++) if (tav.c[i] === 0) vuoti.push(i);
  for (let k = 0; k < quante; k++) {
    const t = partitaCasuale(tav.copia(), (k & 1) ? col : 3 - col, tav.N * tav.N * 2, vuoti);
    const a = t.area();
    for (let i = 0; i < T; i++) proprieta[i] += a.terr[i] === 1 ? 1 : a.terr[i] === 2 ? -1 : 0;
  }
  const morte = [];
  const visto = new Set();
  for (let p = 0; p < T; p++) {
    if ((tav.c[p] !== 1 && tav.c[p] !== 2) || visto.has(p)) continue;
    const h = tav.capo[p];
    let s = h, somma = 0, n = 0;
    const pietre = [];
    do { pietre.push(s); visto.add(s); somma += proprieta[s]; n++; s = tav.dopo[s]; } while (s !== h);
    const media = somma / n / quante; // da -1 a 1
    if ((tav.c[p] === 1 && media < -0.4) || (tav.c[p] === 2 && media > 0.4)) morte.push(...pietre);
  }
  return morte;
}

const LETTERE = 'ABCDEFGHJKLMNOPQRST';
class Go {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'go';
    this.n = 2;
    this.N = [9, 13, 19].includes(Number(opzioni.tavola)) ? Number(opzioni.tavola) : 9;
    this.komi = [5.5, 6.5, 7.5, 0.5].includes(Number(opzioni.komi)) ? Number(opzioni.komi) : 7.5;
    this.t = new Tavola(this.N);
    this.nero = primo % 2; // chi inizia ha il nero
    this.colori = []; this.colori[this.nero] = 1; this.colori[1 - this.nero] = 2;
    this.turno = this.nero;
    this.storia = new Set([this.chiave()]); // superko posizionale: niente posizioni già viste
    this.passati = 0;
    this.nMosse = 0;
    this.ultima = null;
    this.fase = 'gioco';
    this.morte = []; this.accettato = [false, false];
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = 0;
    void n;
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  // nel conteggio si aspetta chi non ha ancora accettato: così il server fa accettare anche il computer (e chi non c'è)
  attesi() { return this.finita || this.fase !== 'conteggio' ? [] : [0, 1].filter((p) => !this.accettato[p]); }
  chiave() { return String.fromCharCode(...this.t.c); }
  nomePunto(p) { const x = (p % this.t.W) - 1, y = ((p / this.t.W) | 0) - 1; return `${LETTERE[x]}${this.N - y}`; }
  // legale anche col superko (la posizione dopo la mossa non deve essere già comparsa)
  legaleSuper(p, col) {
    if (!this.t.legale(p, col)) return false;
    const c = this.t.copia(); c.gioca(p, col);
    return !this.storia.has(String.fromCharCode(...c.c));
  }

  // trucco segreto (!win): la mossa del computer difficile, con le coordinate scritte sul goban
  suggerimentoWin(p) {
    if (this.finita || this.fase !== 'gioco' || this.turno !== p) return null;
    const a = bot(this, p, 'difficile');
    if (a.tipo === 'passa') return '💡 Passa: la partita è già tua, conviene contare';
    return `💡 Metti la pietra in ${this.nomePunto(this.t.pt(a.x, a.y))}`;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (this.fase === 'conteggio') return this.azioneConteggio(p, a);
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    const col = this.colori[p];
    if (a.tipo === 'passa') {
      this.passati++; this.nMosse++;
      this.ultima = { posto: p, passo: true, n: this.nMosse };
      this.t.ko = -1;
      this.annuncia(p, 'passa', 'passi');
      if (this.passati >= 2) return this.apriConteggio();
      this.turno = 1 - p;
      return { ok: true };
    }
    if (a.tipo === 'abbandona') return this.chiudi(1 - p, 'abbandono');
    if (a.tipo !== 'metti') return { errore: 'Mossa non valida' };
    const x = Number(a.x), y = Number(a.y);
    if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < this.N)) return { errore: 'Incrocio non valido' };
    const q = this.t.pt(x, y);
    if (this.t.c[q] !== 0) return { errore: 'Lì c\'è già una pietra' };
    if (q === this.t.ko) return { errore: 'Ko: non puoi riprendere subito, gioca prima altrove' };
    if (!this.t.legale(q, col)) return { errore: 'Suicidio: la pietra resterebbe senza libertà' };
    if (!this.legaleSuper(q, col)) return { errore: 'Ko: questa mossa ripeterebbe una posizione già vista' };
    const prese = this.t.gioca(q, col);
    this.storia.add(this.chiave());
    this.passati = 0; this.nMosse++;
    this.ultima = { posto: p, x, y, prese, n: this.nMosse };
    if (prese >= 3) this.annuncia(p, `cattura ${prese} pietre!`, `catturi ${prese} pietre!`);
    if (this.nMosse >= this.N * this.N * 3) return this.apriConteggio();
    this.turno = 1 - p;
    return { ok: true };
  }

  apriConteggio() {
    this.fase = 'conteggio';
    this.turno = null;
    this.morte = pietreMorte(this.t, this.colori[0], process.env.TEST_VELOCE ? 80 : 200);
    this.accettato = [false, false];
    this.annuncia(null, 'Due passaggi: si contano i punti', '', true);
    return { ok: true };
  }
  // durante il conteggio: si cambiano i gruppi morti (clic su una pietra) e si accetta
  azioneConteggio(p, a) {
    if (a.tipo === 'morte') {
      const x = Number(a.x), y = Number(a.y);
      if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < this.N)) return { errore: 'Incrocio non valido' };
      const q = this.t.pt(x, y);
      if (this.t.c[q] !== 1 && this.t.c[q] !== 2) return { errore: 'Lì non ci sono pietre' };
      const h = this.t.capo[q];
      const gruppo = []; let s = h; do { gruppo.push(s); s = this.t.dopo[s]; } while (s !== h);
      const morto = this.morte.includes(q);
      this.morte = morto ? this.morte.filter((m) => !gruppo.includes(m)) : [...this.morte, ...gruppo];
      this.accettato = [false, false];
      return { ok: true };
    }
    if (a.tipo === 'accetta') {
      this.accettato[p] = true;
      if (this.accettato.every(Boolean)) return this.conta();
      return { ok: true };
    }
    if (a.tipo === 'riprendi') { // non d'accordo: si torna a giocare
      this.fase = 'gioco'; this.passati = 0; this.morte = []; this.turno = this.ultima ? 1 - this.ultima.posto : this.nero;
      this.annuncia(p, 'vuole continuare a giocare', 'si continua a giocare');
      return { ok: true };
    }
    return { errore: 'Segna le pietre morte o accetta il conteggio' };
  }
  punteggio() {
    const a = this.t.area(this.morte);
    return { nero: a.nero, bianco: a.bianco + this.komi, terr: a.terr };
  }
  conta() {
    const s = this.punteggio();
    const vinceCol = s.nero > s.bianco ? 1 : 2;
    const v = this.colori.indexOf(vinceCol);
    const scarto = Math.abs(s.nero - s.bianco);
    return this.chiudi(v, `di ${String(scarto).replace('.', ',')} punti`, s);
  }
  chiudi(v, come, s = this.punteggio()) {
    this.finita = true; this.turno = null; this.fase = 'finita';
    this.annuncia(v, `vince ${come === 'abbandono' ? 'per abbandono' : come}!`, `vinci ${come === 'abbandono' ? 'per abbandono' : come}!`, true);
    const pt = [0, 1].map((k) => (this.colori[k] === 1 ? s.nero : s.bianco));
    this.risultato = { fazioni: [0, 1].map((k) => ({ posti: [k], punti: pt[k] })), etichetta: 'punti', pareggio: false, vincitori: [v] };
    return { ok: true };
  }

  vista(p) {
    const N = this.N, celle = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) celle.push(this.t.c[this.t.pt(x, y)]);
    const conteggio = this.fase === 'conteggio' || this.finita;
    let terr = null, punti = null;
    if (conteggio) {
      const s = this.punteggio();
      terr = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) terr.push(s.terr[this.t.pt(x, y)]);
      punti = { nero: s.nero, bianco: s.bianco };
    }
    const morte = this.morte.map((q) => [(q % this.t.W) - 1, ((q / this.t.W) | 0) - 1]);
    const ko = this.t.ko >= 0 && this.fase === 'gioco' ? [(this.t.ko % this.t.W) - 1, ((this.t.ko / this.t.W) | 0) - 1] : null;
    return {
      gioco: this.id, n: 2, N, celle, colori: this.colori, komi: this.komi, fase: this.fase, ko,
      catturate: [0, 1].map((k) => this.t.catturate[this.colori[k]]), passati: this.passati, nMosse: this.nMosse,
      ultima: this.ultima, morte, terr, punti, accettato: this.accettato,
      turno: this.turno, inAttesa: false, pausaMs: 0, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
function bot(g, p, livello) {
  if (g.fase === 'conteggio') return { tipo: 'accetta' };
  const col = g.colori[p], t = g.t, N = g.N;
  const komiNero = g.komi;
  const daPunto = (q) => ({ tipo: 'metti', x: (q % t.W) - 1, y: ((q / t.W) | 0) - 1 });
  const legali = [];
  for (let q = 0; q < t.c.length; q++) if (t.c[q] === 0 && !t.occhio(q, col) && g.legaleSuper(q, col)) legali.push(q);
  if (!legali.length) return { tipo: 'passa' };
  // se l'avversario ha passato e sono in vantaggio contando l'area così com'è (morte stimate), passo anch'io
  if (g.passati === 1 && livello !== 'facile') {
    const morte = pietreMorte(t, col, process.env.TEST_VELOCE ? 16 : 60);
    const a = t.area(morte);
    const mio = col === 1 ? a.nero - a.bianco - komiNero : a.bianco + komiNero - a.nero;
    if (mio > 0) return { tipo: 'passa' };
  }
  if (livello === 'facile') {
    // da principiante: a volte cattura, all'inizio preferisce le linee 3 e 4, per il resto gioca a caso
    if (Math.random() < 0.5) for (const q of legali) { const c = t.copia(); if (c.gioca(q, col) > 0) return daPunto(q); }
    if (g.nMosse < N && Math.random() < 0.6) {
      const buone = legali.filter((q) => { const x = (q % t.W) - 1, y = ((q / t.W) | 0) - 1; const d = Math.min(x, y, N - 1 - x, N - 1 - y); return d >= 2 && d <= 3; });
      if (buone.length) return daPunto(buone[Math.floor(Math.random() * buone.length)]);
    }
    return daPunto(legali[Math.floor(Math.random() * legali.length)]);
  }
  const veloce = process.env.TEST_VELOCE;
  // sui goban grandi una partita simulata dura molto di più: il tempo cresce con gli incroci (si pensa in un thread a parte)
  const grande = veloce ? 1 : (N * N) / 81;
  const ms = (livello === 'medio' ? (veloce ? 15 : 60) : (veloce ? 35 : 280)) * grande;
  const r = mcts(t, col, ms, komiNero, livello === 'medio' ? (veloce ? 140 : 500) : Infinity);
  if (r.mossa < 0 || !legali.includes(r.mossa)) {
    // il passo conviene solo se la partita è decisa; altrimenti la mossa legale più visitata
    // (mai a goban ancora mezzo vuoto, a meno che l'altro non abbia già passato)
    if (r.mossa < 0 && (g.nMosse > N * N || (r.vinte > 0.5 && (g.passati === 1 || g.nMosse > N * N * 0.6)))) return { tipo: 'passa' };
    const figli = [...r.radice.figli].filter((f) => f.mossa >= 0 && legali.includes(f.mossa)).sort((a, b) => b.n - a.n);
    if (!figli.length) return { tipo: 'passa' };
    return daPunto(figli[0].mossa);
  }
  return daPunto(r.mossa);
}

module.exports = {
  meta: {
    id: 'go',
    pensaLento: true, // il computer difficile pensa a lungo: lo fa in un thread a parte (giochi/pensatore.js)
    nome: 'Go',
    tipo: 'tabellone',
    giocatori: [2],
    descrizione: 'L\'antico gioco di territorio: circonda le zone vuote, cattura le pietre avversarie. Goban 9×9, 13×13 o 19×19, conteggio ad area con komi.',
    alias: ['go', 'weiqi', 'baduk', 'igo', 'pietre', 'goban', 'territorio'],
    opzioni: [
      { id: 'tavola', nome: 'Goban', valori: [9, 13, 19], etichette: ['9×9 (veloce)', '13×13', '19×19 (lunga)'], predefinito: 9 },
      { id: 'komi', nome: 'Komi al bianco', valori: [7.5, 6.5, 5.5, 0.5], etichette: ['7,5', '6,5', '5,5', '0,5'], predefinito: 7.5 },
    ],
    regole: [
      'Si gioca in due sugli incroci di una griglia (il goban): chi inizia ha il nero, l\'altro il bianco. A turno si mette una pietra su un incrocio libero; le pietre non si spostano più.',
      'Le pietre dello stesso colore che si toccano in orizzontale o in verticale formano un gruppo. Gli incroci vuoti accanto a un gruppo sono le sue libertà. Un gruppo che perde l\'ultima libertà viene catturato: le pietre si tolgono dal goban.',
      'Non puoi mettere una pietra dove resterebbe subito senza libertà (suicidio), a meno che così non catturi.',
      'KO: non puoi fare una mossa che ripete una posizione già vista (per esempio riprendere subito una pietra appena catturata in un ko): prima devi giocare altrove. L\'incrocio vietato è segnato.',
      'Al tuo turno puoi anche passare. Quando tutti e due passano di fila la partita finisce: il computer propone quali gruppi sono morti (circondati senza speranza, segnati con una croce); cliccando un gruppo lo cambi da vivo a morto e viceversa. Quando siete d\'accordo premete "Accetta"; se non vi trovate d\'accordo si può riprendere a giocare.',
      'Conteggio ad area (regole cinesi): ogni giocatore ha un punto per ogni sua pietra viva sul goban e per ogni incrocio vuoto circondato solo dalle sue pietre. Il bianco riceve in più il komi (7,5 punti di base) per compensare il vantaggio di chi inizia. Vince chi ha più punti.',
      'Puoi anche abbandonare la partita (pulsante in basso).',
      'Il computer facile gioca da principiante (a volte cattura, all\'inizio sta sulle linee 3 e 4, poi un po\' a caso); il medio usa una breve ricerca Monte Carlo (poche centinaia di partite simulate); il difficile fa una ricerca Monte Carlo ad albero con migliaia di partite simulate a mossa.',
    ],
  },
  crea: (o) => new Go(o),
  bot,
  _test: { Tavola, mcts, pietreMorte, partitaCasuale },
};
