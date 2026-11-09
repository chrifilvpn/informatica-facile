// CINQUE DADI: 13 turni, in ognuno si tirano fino a tre volte cinque dadi (tenendo quelli che si vuole) e si segna
// il risultato in una delle 13 caselle libere della propria scheda (anche a zero). Parte alta: uno, due, … sei
// (somma dei dadi di quel numero), bonus di 35 se arriva ad almeno 63. Parte bassa: tris e poker (somma di tutti i
// dadi), full (25), scala piccola (4 di fila, 30), scala grande (5 di fila, 40), cinque dadi uguali (50), somma.
// Ogni altro "cinque dadi uguali" dopo il primo da 50 vale 100 punti in più e fa da jolly. Da 1 a 6 giocatori.
const CAT = ['uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'tris', 'poker', 'full', 'scalaP', 'scalaG', 'cinque5', 'somma'];
const NOMI = {
  uno: 'Uno', due: 'Due', tre: 'Tre', quattro: 'Quattro', cinque: 'Cinque', sei: 'Sei', tris: 'Tris', poker: 'Poker',
  full: 'Full', scalaP: 'Scala piccola', scalaG: 'Scala grande', cinque5: 'Cinque dadi', somma: 'Somma',
};
const dado = () => 1 + Math.floor(Math.random() * 6);
const T = require('../giochi/trucco');

// punteggio dei dadi d in una casella, con la regola del jolly (jolly = cinque uguali con la casella 50 già usata)
function punteggio(d, cat, jolly = false) {
  const conta = [0, 0, 0, 0, 0, 0, 0];
  for (const x of d) conta[x]++;
  const tot = d.reduce((a, b) => a + b, 0);
  const max = Math.max(...conta);
  const i = CAT.indexOf(cat);
  if (i < 6) return conta[i + 1] * (i + 1);
  const ha = (k) => { for (let a = 1; a + k - 1 <= 6; a++) { let ok = true; for (let j = 0; j < k; j++) if (!conta[a + j]) ok = false; if (ok) return true; } return false; };
  switch (cat) {
    case 'tris': return max >= 3 ? tot : 0;
    case 'poker': return max >= 4 ? tot : 0;
    case 'full': return (conta.includes(3) && conta.includes(2)) || jolly ? 25 : 0;
    case 'scalaP': return ha(4) || jolly ? 30 : 0;
    case 'scalaG': return ha(5) || jolly ? 40 : 0;
    case 'cinque5': return max === 5 ? 50 : 0;
    case 'somma': return tot;
  }
  return 0;
}
const vuota = () => Object.fromEntries(CAT.map((c) => [c, null]));
const sommaAlta = (s) => CAT.slice(0, 6).reduce((t, c) => t + (s[c] || 0), 0);
function totale(s, extra) {
  const alta = sommaAlta(s);
  const bassa = CAT.slice(6).reduce((t, c) => t + (s[c] || 0), 0);
  return alta + (alta >= 63 ? 35 : 0) + bassa + extra;
}

class CinqueDadi {
  constructor({ n, primo = 0 }) {
    this.id = 'yahtzee';
    this.n = n;
    this.schede = Array.from({ length: n }, vuota);
    this.extra = new Array(n).fill(0); // bonus dei cinque dadi uguali in più (100 l'uno)
    this.turno = primo % n;
    this.primo = this.turno;
    this.round = 1;
    this.dadi = [1, 2, 3, 4, 5];
    this.tenuti = [false, false, false, false, false];
    this.tiri = 0;
    this.nTiro = 0;
    this.ultima = null; // ultima casella segnata: { posto, cat, punti, n }
    this.nSegnata = 0;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = 0;
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  // jolly: cinque uguali e la casella "cinque dadi" già usata (con 50 o con 0); la parte alta del numero deve essere
  // usata prima, se è libera
  statoJolly(p) {
    const s = this.schede[p];
    const cinque = this.dadi.every((x) => x === this.dadi[0]);
    if (!cinque || s.cinque5 === null) return { jolly: false, bonus: false, obbligo: null };
    const alta = CAT[this.dadi[0] - 1];
    return { jolly: s[alta] !== null, bonus: s.cinque5 === 50, obbligo: s[alta] === null ? alta : null };
  }
  // il trucco segreto (!win): cinque dadi uguali se servono ancora (casella libera o bonus da 100) e i dadi tenuti
  // lo permettono; altrimenti il tiro che vale di più secondo il computer
  // con `peggiori` (il trucco !lose) i dadi che fanno meno punti
  dadiMigliori(p, peggiori = false) {
    const s = this.schede[p];
    const tenuti = this.dadi.filter((_, i) => this.tenuti[i]);
    if (!peggiori && (s.cinque5 === null || s.cinque5 === 50) && new Set(tenuti).size <= 1) {
      const v = tenuti.length ? tenuti[0] : 6 - Math.floor(Math.random() * 3);
      return this.dadi.map(() => v);
    }
    const liberi = this.tenuti.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
    let best = this.dadi.slice(), bu = -Infinity;
    for (let k = 0; k < 6 ** liberi.length; k++) {
      const d = this.dadi.slice();
      let x = k;
      for (const i of liberi) { d[i] = 1 + (x % 6); x = Math.floor(x / 6); }
      let u = migliore(this, p, d).u + Math.random() * 0.01;
      if (peggiori) u = -u;
      if (u > bu) { bu = u; best = d; }
    }
    return best;
  }
  possibili(p) {
    if (!this.tiri) return null;
    const s = this.schede[p];
    const j = this.statoJolly(p);
    const out = {};
    for (const c of CAT) {
      if (s[c] !== null) continue;
      if (j.obbligo && c !== j.obbligo) continue;
      out[c] = punteggio(this.dadi, c, j.jolly);
    }
    return out;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (a.tipo === 'tira') {
      if (this.tiri >= 3) return { errore: 'Hai già tirato tre volte: segna il punteggio' };
      const tieni = this.tiri && Array.isArray(a.tieni) ? a.tieni.map(Number) : [];
      if (!tieni.every((i) => Number.isInteger(i) && i >= 0 && i < 5)) return { errore: 'Dadi non validi' };
      if (tieni.length === 5 && new Set(tieni).size === 5) return { errore: 'Tieni tutti i dadi? Allora segna' };
      this.tenuti = [0, 1, 2, 3, 4].map((i) => tieni.includes(i));
      this.dadi = T.consuma(this, p) ? this.dadiMigliori(p) : T.sfortuna(this, p) ? this.dadiMigliori(p, true) : this.dadi.map((x, i) => (this.tenuti[i] ? x : dado()));
      this.tiri++; this.nTiro++;
      if (this.dadi.every((x) => x === this.dadi[0])) this.annuncia(p, 'fa CINQUE DADI UGUALI! 🎲🎲🎲🎲🎲', 'cinque dadi uguali! 🎲🎲🎲🎲🎲', true);
      return { ok: true };
    }
    if (a.tipo === 'segna') {
      const pos = this.possibili(p);
      if (!pos) return { errore: 'Prima tira i dadi' };
      if (!(a.cat in pos)) return { errore: this.statoJolly(p).obbligo ? `Con cinque dadi uguali devi segnare prima ${NOMI[this.statoJolly(p).obbligo]}` : 'Casella non disponibile' };
      const j = this.statoJolly(p);
      if (j.bonus) { this.extra[p] += 100; this.annuncia(p, 'prende 100 punti di bonus!', '100 punti di bonus!', true); }
      const punti = pos[a.cat];
      this.schede[p][a.cat] = punti;
      this.ultima = { posto: p, cat: a.cat, punti, n: ++this.nSegnata, dadi: this.dadi.slice() };
      return this.prossimo();
    }
    return { errore: 'Mossa non valida' };
  }
  prossimo() {
    this.tiri = 0; this.tenuti = [false, false, false, false, false];
    this.turno = (this.turno + 1) % this.n;
    if (this.turno === this.primo) this.round++;
    if (this.round > 13) return this.chiudi();
    return { ok: true };
  }
  chiudi() {
    this.finita = true; this.turno = null;
    const tot = this.schede.map((s, i) => totale(s, this.extra[i]));
    const max = Math.max(...tot);
    const vincitori = tot.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0);
    this.risultato = { fazioni: tot.map((t, i) => ({ posti: [i], punti: t })), etichetta: 'punti', pareggio: vincitori.length > 1 && this.n > 1, vincitori };
    if (this.n === 1) this.annuncia(0, `chiude con ${max} punti`, `hai fatto ${max} punti!`, true);
    return { ok: true };
  }
  vista() {
    return {
      gioco: this.id, n: this.n, round: Math.min(this.round, 13), dadi: this.dadi, tenuti: this.tenuti, tiri: this.tiri, nTiro: this.nTiro,
      schede: this.schede, extra: this.extra, totali: this.schede.map((s, i) => totale(s, this.extra[i])), alte: this.schede.map(sommaAlta),
      possibili: this.turno != null ? this.possibili(this.turno) : null, jolly: this.turno != null && this.tiri ? this.statoJolly(this.turno) : null,
      ultima: this.ultima,
      turno: this.turno, inAttesa: false, pausaMs: 0, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
// Tutte le combinazioni ordinate di dadi (multinsiemi) e le probabilità dei tiri di k dadi.
const chiaveDi = (d) => d.slice().sort((a, b) => a - b).join('');
const ESITI = []; // ESITI[k] = [{ d: [..], p }] per k dadi tirati
for (let k = 0; k <= 5; k++) {
  const m = new Map();
  const tot = 6 ** k;
  const giro = (d) => {
    if (d.length === k) { const c = chiaveDi(d); m.set(c, (m.get(c) || 0) + 1); return; }
    for (let x = 1; x <= 6; x++) giro([...d, x]);
  };
  giro([]);
  ESITI[k] = [...m.entries()].map(([c, v]) => ({ d: c ? c.split('').map(Number) : [], p: v / tot }));
}
// quanto vale in media lasciare libera una casella (costo di usarla adesso), stimato con molte partite
const COSTO = { uno: 2.1, due: 5.3, tre: 8.6, quattro: 12.2, cinque: 15.7, sei: 19.2, tris: 21.7, poker: 13.1, full: 22.6, scalaP: 29.5, scalaG: 32.7, cinque5: 16.9, somma: 22.0 };

// utilità di segnare d nella casella c (punti, meno quello che si perde, più l'avvicinarsi al bonus)
function utilita(g, p, d, c, punti) {
  const s = g.schede[p];
  let u = punti - COSTO[c];
  const i = CAT.indexOf(c);
  const alta = sommaAlta(s);
  if (i < 6 && alta < 63) {
    // rispetto a "tre dadi di quel numero" (63 = 3 di ogni numero): sopra la media avvicina il bonus
    const libereAlte = CAT.slice(0, 6).filter((x) => s[x] === null).length;
    const manca = 63 - alta;
    const raggiungibile = manca <= CAT.slice(0, 6).reduce((t, x, k) => t + (s[x] === null ? 5 * (k + 1) : 0), 0);
    if (raggiungibile) u += (punti - 3 * (i + 1)) * (libereAlte <= 2 ? 1.2 : 0.6) + (punti >= manca ? 20 : 0);
  }
  if (c === 'cinque5' && punti === 0) u -= 8; // rinunciare ai cinque dadi toglie anche i bonus da 100
  if (c === 'somma' && punti < 20) u -= 4;
  return u;
}
// la migliore casella per i dadi d (con la regola del jolly)
function migliore(g, p, d) {
  const s = g.schede[p];
  const cinque = d.every((x) => x === d[0]);
  let jolly = false, obbligo = null, bonus = 0;
  if (cinque && s.cinque5 !== null) {
    const alta = CAT[d[0] - 1];
    if (s[alta] === null) obbligo = alta; else jolly = true;
    if (s.cinque5 === 50) bonus = 100;
  }
  let best = null, bu = -Infinity;
  for (const c of CAT) {
    if (s[c] !== null || (obbligo && c !== obbligo)) continue;
    const pt = punteggio(d, c, jolly);
    const u = utilita(g, p, d, c, pt) + bonus;
    if (u > bu) { bu = u; best = c; }
  }
  return { cat: best, u: bu };
}
// Tabelle preparate una volta sola: le 252 combinazioni di 5 dadi, tutte le "tenute" possibili (da 0 a 4 dadi) e,
// per ognuna, dove si arriva ritirando gli altri dadi e con che probabilità.
const MS = ESITI[5].map((o) => o.d);
const IDX = new Map(MS.map((d, i) => [chiaveDi(d), i]));
const TENUTE = []; const IDT = new Map();
const TENUTE_DI = MS.map((d) => {
  const ids = new Set();
  for (let m = 0; m < 31; m++) {
    const h = d.filter((_, i) => m & (1 << i));
    const k = chiaveDi(h);
    if (!IDT.has(k)) { IDT.set(k, TENUTE.length); TENUTE.push(h); }
    ids.add(IDT.get(k));
  }
  return [...ids];
});
const ARRIVI = TENUTE.map((h) => ESITI[5 - h.length].map((o) => ({ s: IDX.get(chiaveDi([...h, ...o.d])), p: o.p })));

// i dadi da tenere: per ogni scelta il valore atteso esatto dopo i tiri che restano (si può anche fermarsi prima)
function sceltaTenuti(g, p, tiriRestanti) {
  const fin = MS.map((d) => migliore(g, p, d).u);
  let V = fin; // valore di ogni combinazione con 0 tiri da fare
  let EH = null;
  for (let r = 1; r <= tiriRestanti; r++) {
    EH = ARRIVI.map((arr) => { let e = 0; for (const { s: x, p: q } of arr) e += q * V[x]; return e; });
    if (r < tiriRestanti) V = MS.map((_, i) => { let b = fin[i]; for (const h of TENUTE_DI[i]) if (EH[h] > b) b = EH[h]; return b; });
  }
  const i = IDX.get(chiaveDi(g.dadi));
  let best = { tieni: [0, 1, 2, 3, 4], e: fin[i] };
  for (const h of TENUTE_DI[i]) {
    if (EH[h] > best.e + 1e-9) {
      // dalla tenuta (valori) agli indici dei dadi
      const resto = [...TENUTE[h]], tieni = [];
      g.dadi.forEach((x, k) => { const j = resto.indexOf(x); if (j >= 0) { resto.splice(j, 1); tieni.push(k); } });
      best = { tieni, e: EH[h] };
    }
  }
  return best;
}

function bot(g, p, livello) {
  if (g.tiri === 0) return { tipo: 'tira' };
  const pos = g.possibili(p);
  if (livello === 'facile') {
    // tiene i dadi del numero più frequente (a volte niente) e segna dove fa più punti
    if (g.tiri < 3 && Math.random() < 0.85) {
      const conta = [0, 0, 0, 0, 0, 0, 0];
      for (const x of g.dadi) conta[x]++;
      const v = conta.indexOf(Math.max(...conta));
      const tieni = g.dadi.map((x, i) => (x === v ? i : -1)).filter((i) => i >= 0);
      if (tieni.length < 5 && Math.random() < 0.8) return { tipo: 'tira', tieni };
      if (tieni.length < 5) return { tipo: 'tira', tieni: [] };
    }
    const cats = Object.keys(pos);
    const best = cats.reduce((a, b) => (pos[b] > pos[a] ? b : a));
    return { tipo: 'segna', cat: pos[best] > 0 || Math.random() < 0.5 ? best : cats[Math.floor(Math.random() * cats.length)] };
  }
  if (livello === 'medio') {
    // segna subito se ha una combinazione buona, altrimenti tiene i dadi uguali (o una scala) e ritira
    const m = migliore(g, p, g.dadi);
    if (g.tiri === 3 || m.u >= 5) return { tipo: 'segna', cat: m.cat };
    const conta = [0, 0, 0, 0, 0, 0, 0];
    for (const x of g.dadi) conta[x]++;
    const s = g.schede[p];
    const unici = [...new Set(g.dadi)].sort((a, b) => a - b);
    let fila = [];
    for (let a = 1; a <= 3; a++) { const f = [a, a + 1, a + 2, a + 3].filter((x) => unici.includes(x)); if (f.length > fila.length) fila = f; }
    if (fila.length >= 3 && (s.scalaP === null || s.scalaG === null) && Math.max(...conta) < 3) {
      const tieni = []; for (const v of fila) tieni.push(g.dadi.indexOf(v));
      return { tipo: 'tira', tieni };
    }
    let v = 6; for (let x = 6; x >= 1; x--) if (conta[x] > conta[v]) v = x;
    const tieni = g.dadi.map((x, i) => (x === v ? i : -1)).filter((i) => i >= 0);
    if (tieni.length === 5) return { tipo: 'segna', cat: m.cat };
    return { tipo: 'tira', tieni };
  }
  // difficile: valore atteso esatto su tutte le scelte dei dadi da tenere
  if (g.tiri < 3) {
    const sc = sceltaTenuti(g, p, 3 - g.tiri);
    if (sc.tieni.length < 5) return { tipo: 'tira', tieni: sc.tieni };
  }
  return { tipo: 'segna', cat: migliore(g, p, g.dadi).cat };
}

module.exports = {
  meta: {
    id: 'yahtzee',
    nome: 'Cinque dadi',
    tipo: 'tabellone',
    giocatori: [1, 2, 3, 4, 5, 6],
    descrizione: 'Cinque dadi, tre tiri a turno e 13 caselle da riempire: tris, full, scale e cinque dadi uguali. Anche da soli.',
    alias: ['cinque dadi', 'yatzy', 'poker di dadi', 'dadi', 'generala', 'kniffel', 'scala di dadi'],
    opzioni: [],
    regole: [
      'Si gioca con 5 dadi, da soli o fino a 6 giocatori. Ognuno ha la sua scheda con 13 caselle; la partita dura 13 giri, in ogni giro ognuno riempie una casella.',
      'Al tuo turno tiri tutti i dadi; poi puoi ritirare quelli che vuoi, per due volte al massimo (tre tiri in tutto). Clicca un dado per tenerlo (o premi i tasti da 1 a 5): i dadi tenuti non si ritirano.',
      'Alla fine (anche dopo il primo o il secondo tiro) segni il risultato in una casella libera a scelta. Se i dadi non vanno bene per nessuna, devi comunque riempirne una con zero.',
      'PARTE ALTA: Uno, Due, Tre, Quattro, Cinque, Sei: la somma dei dadi di quel numero. Se la parte alta arriva almeno a 63 (cioè in media tre dadi per numero) prendi un bonus di 35 punti.',
      'PARTE BASSA: Tris (almeno 3 dadi uguali) e Poker (almeno 4 uguali): la somma di tutti i dadi. Full (3 uguali più 2 uguali): 25. Scala piccola (4 numeri di fila, per esempio 2-3-4-5): 30. Scala grande (5 di fila): 40. Cinque dadi (tutti e 5 uguali): 50. Somma: la somma di tutti i dadi, con qualsiasi combinazione.',
      'Altri cinque dadi uguali: se la casella Cinque dadi è già segnata con 50, ogni altro cinque dadi uguali vale 100 punti di bonus. Fa anche da JOLLY: va segnato nella casella alta di quel numero se è libera; altrimenti in qualsiasi casella libera, e full e scale valgono comunque i loro punti.',
      'Vince chi ha il totale più alto (parte alta, bonus, parte bassa e bonus da 100). Da soli si cerca il proprio record: una partita giocata benissimo fa in media circa 250 punti.',
      'Tasti: spazio per tirare, da 1 a 5 per tenere i dadi. Nella tua scheda vedi quanto faresti in ogni casella libera: cliccala per segnare.',
      'Il computer facile tiene i dadi uguali e segna dove fa più punti subito; il medio sa quando fermarsi, insegue tris e scale e pensa al bonus; il difficile calcola, per ogni scelta dei dadi da tenere, la media esatta su tutti i tiri possibili e valuta quanto vale tenere libera ogni casella.',
    ],
  },
  crea: (o) => new CinqueDadi(o),
  bot,
  _test: { punteggio, totale, sceltaTenuti, migliore, CAT, ESITI },
};
