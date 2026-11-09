// SHUT THE BOX: tessere da 1 a 9 (o fino a 12). Al tuo turno tiri i dadi e abbassi tessere ancora alzate che sommate
// fanno il risultato (una o più, per esempio con 8: l'8, oppure 5+3, oppure 1+2+5). Poi ritiri, finché puoi.
// Quando non c'è nessuna combinazione possibile il turno finisce e prendi come punti la somma delle tessere rimaste
// alzate: meno punti è meglio. Chi abbassa tutte le tessere ("chiude la scatola") vince subito.
// Quando le tessere alzate sommano 6 o meno si può tirare un dado solo.
const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dado = () => 1 + Math.floor(Math.random() * 6);
const T = require('./trucco');
const PAUSA = 1800;

// tutti i modi di fare "somma" con le tessere alzate della maschera (bit k = tessera k+1)
function combinazioni(maschera, somma, max) {
  const out = [];
  const giro = (k, resto, scelta) => {
    if (resto === 0) { out.push(scelta); return; }
    for (let t = k; t <= max && t <= resto; t++) if (maschera & (1 << (t - 1))) giro(t + 1, resto - t, scelta | (1 << (t - 1)));
  };
  giro(1, somma, 0);
  return out;
}
const sommaDi = (m) => { let s = 0; for (let k = 0; m; k++, m >>= 1) if (m & 1) s += k + 1; return s; };
const elenco = (m) => { const out = []; for (let k = 0; m >> k; k++) if ((m >> k) & 1) out.push(k + 1); return out; };
// probabilità delle somme con uno o due dadi
const P1 = Object.fromEntries([1, 2, 3, 4, 5, 6].map((r) => [r, 1 / 6]));
const P2 = (() => { const p = {}; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) p[a + b] = (p[a + b] || 0) + 1 / 36; return p; })();

// il computer difficile: punteggio finale atteso giocando al meglio da ogni situazione (calcolato una volta sola)
const MEMO = {};
function atteso(max, m) {
  const memo = MEMO[max] || (MEMO[max] = new Map());
  if (memo.has(m)) return memo.get(m);
  if (m === 0) { memo.set(m, 0); return 0; }
  const valore = (P) => { let e = 0; for (const [r, p] of Object.entries(P)) { const cs = combinazioni(m, Number(r), max); e += p * (cs.length ? Math.min(...cs.map((c) => atteso(max, m & ~c))) : sommaDi(m)); } return e; };
  let e = valore(P2);
  if (sommaDi(m) <= 6) e = Math.min(e, valore(P1));
  memo.set(m, e);
  return e;
}

class ShutBox {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'shutbox';
    this.n = n;
    this.max = Number(opzioni.tessere) === 12 ? 12 : 9;
    this.nRound = [1, 3, 5].includes(Number(opzioni.round)) ? Number(opzioni.round) : 3;
    this.round = 1;
    this.punti = new Array(n).fill(0);
    this.storico = [];               // [round][posto] punti presi
    this.primo = primo % n;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = PAUSA;
    this.nuovoTurno(this.primo);
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  nuovoTurno(p) {
    this.turno = p;
    this.alzate = (1 << this.max) - 1;   // tutte le tessere alzate
    this.dadi = null;                    // il tiro da usare
    this.nTiri = 0;
    this.fase = 'tira';
  }
  get possoUnDado() { return sommaDi(this.alzate) <= 6; }
  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Un attimo…' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a) return { errore: 'Mossa non valida' };
    if (a.tipo === 'tira') {
      if (this.fase !== 'tira') return { errore: 'Prima abbassa le tessere' };
      const uno = !!a.uno;
      if (uno && !this.possoUnDado) return { errore: 'Un dado solo si tira quando le tessere alzate fanno 6 o meno' };
      // il trucco segreto (!win): da qui alla fine del turno i dadi danno sempre il tiro migliore
      if (T.consuma(this, p)) this.truccato = p;
      this.dadi = this.truccato === p ? this.dadiMigliori(uno) : T.sfortuna(this, p) ? this.dadiMigliori(uno, true) : uno ? [dado()] : [dado(), dado()];
      this.nTiri++;
      const s = this.dadi.reduce((x, y) => x + y, 0);
      if (!combinazioni(this.alzate, s, this.max).length) return this.fineTurno(`ha tirato ${s}: nessuna combinazione possibile`);
      this.fase = 'scegli';
      return { ok: true };
    }
    if (a.tipo === 'chiudi') {
      if (this.fase !== 'scegli') return { errore: 'Prima tira i dadi' };
      const t = Array.isArray(a.tessere) ? [...new Set(a.tessere.map(Number))] : [];
      if (!t.length || t.some((k) => !Number.isInteger(k) || k < 1 || k > this.max || !(this.alzate & (1 << (k - 1))))) return { errore: 'Scegli tessere ancora alzate' };
      const s = this.dadi.reduce((x, y) => x + y, 0);
      if (t.reduce((x, y) => x + y, 0) !== s) return { errore: `Le tessere devono fare ${s}` };
      for (const k of t) this.alzate &= ~(1 << (k - 1));
      this.dadi = null; this.fase = 'tira';
      if (this.alzate === 0) {
        this.annuncia(p, 'CHIUDE LA SCATOLA! 📦 Vince subito', 'hai CHIUSO LA SCATOLA! 📦 Hai vinto', true);
        this.punti[p] += 0;
        return this.chiudi([p], true);
      }
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }
  // i dadi che permettono di abbassare tessere lasciando la situazione migliore (meno punti attesi)
  // con `peggiori` (il trucco !lose) i dadi che lasciano più numeri alzati
  dadiMigliori(uno, peggiori = false) {
    let best = null, bv = Infinity;
    const tiri = uno ? [1, 2, 3, 4, 5, 6].map((a) => [a]) : [].concat(...[1, 2, 3, 4, 5, 6].map((a) => [1, 2, 3, 4, 5, 6].map((b) => [a, b])));
    for (const d of tiri) {
      const cs = combinazioni(this.alzate, d.reduce((x, y) => x + y, 0), this.max);
      let v = (cs.length ? Math.min(...cs.map((c) => atteso(this.max, this.alzate & ~c))) : 1000 + sommaDi(this.alzate)) + Math.random() * 0.01;
      if (peggiori) v = -v;
      if (v < bv) { bv = v; best = d; }
    }
    return best;
  }
  fineTurno(perche) {
    const p = this.turno, resto = sommaDi(this.alzate);
    this.truccato = null; // il trucco vale un turno
    this.punti[p] += resto;
    (this.storico[this.round - 1] || (this.storico[this.round - 1] = new Array(this.n).fill(null)))[p] = resto;
    this.annuncia(p, `${perche}: prende ${resto} punti`, `${perche.replace('ha tirato', 'hai tirato')}: prendi ${resto} punti`);
    this.fase = 'fine'; this.inAttesa = true; this.pausaMs = PAUSA;
    return { ok: true };
  }
  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    const prossimo = (this.turno + 1) % this.n;
    if (prossimo === this.primo) {
      if (this.round >= this.nRound) return this.chiudi();
      this.round++;
      this.primo = (this.primo + 1) % this.n; // a ogni round comincia un altro
      return this.nuovoTurno(this.primo);
    }
    this.nuovoTurno(prossimo);
  }
  chiudi(vincitori = null, scatola = false) {
    this.finita = true; this.turno = null; this.inAttesa = false; this.fase = 'finita'; this.scatola = scatola ? vincitori[0] : null;
    const min = Math.min(...this.punti);
    const v = vincitori || this.punti.map((x, i) => (x === min ? i : -1)).filter((i) => i >= 0);
    this.risultato = { fazioni: this.punti.map((x, i) => ({ posti: [i], punti: x })), etichetta: 'punti (meno è meglio)', crescente: true, pareggio: !scatola && v.length > 1, vincitori: v.length > 1 && !scatola ? [] : v };
    return { ok: true };
  }
  vista() {
    return {
      gioco: this.id, n: this.n, max: this.max, round: this.round, nRound: this.nRound, turno: this.turno, fase: this.fase,
      alzate: elenco(this.alzate), dadi: this.dadi, nTiri: this.nTiri, possoUnDado: this.possoUnDado && this.fase === 'tira',
      somma: this.dadi ? this.dadi.reduce((x, y) => x + y, 0) : null, punti: this.punti, storico: this.storico,
      scatola: this.scatola ?? null, inAttesa: this.inAttesa, pausaMs: this.pausaMs, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
function bot(g, p, livello) {
  if (g.fase === 'tira') {
    // un dado solo: il difficile sceglie quello che conviene davvero; gli altri quando mancano 6 punti o meno, a volte
    if (!g.possoUnDado) return { tipo: 'tira' };
    if (livello === 'difficile') {
      const m = g.alzate, val = (P) => Object.entries(P).reduce((e, [r, q]) => { const cs = combinazioni(m, Number(r), g.max); return e + q * (cs.length ? Math.min(...cs.map((c) => atteso(g.max, m & ~c))) : sommaDi(m)); }, 0);
      return { tipo: 'tira', uno: val(P1) < val(P2) };
    }
    return { tipo: 'tira', uno: livello === 'medio' ? true : Math.random() < 0.5 };
  }
  const cs = combinazioni(g.alzate, g.dadi.reduce((x, y) => x + y, 0), g.max);
  let scelta;
  if (livello === 'facile') scelta = cs[Math.floor(Math.random() * cs.length)];
  else if (livello === 'medio' && Math.random() < 0.3) scelta = cs[Math.floor(Math.random() * cs.length)]; // ogni tanto si distrae
  else if (livello === 'medio') {
    // abbassa prima le tessere alte, con meno tessere possibile
    scelta = [...cs].sort((a, b) => elenco(a).length - elenco(b).length || Math.max(...elenco(b)) - Math.max(...elenco(a)))[0];
  } else scelta = cs.reduce((m, c) => (atteso(g.max, g.alzate & ~c) < atteso(g.max, g.alzate & ~m) ? c : m));
  return { tipo: 'chiudi', tessere: elenco(scelta) };
}

module.exports = {
  meta: {
    id: 'shutbox',
    nome: 'Shut the box',
    tipo: 'tabellone',
    giocatori: [1, 2, 3, 4],
    descrizione: 'Tira i dadi e abbassa le tessere che fanno la stessa somma. Chiudi tutta la scatola per vincere subito!',
    alias: ['shut the box', 'chiudi la scatola', 'tessere', 'dadi', 'canoga'],
    opzioni: [
      { id: 'tessere', nome: 'Tessere', valori: [9, 12], etichette: ['Da 1 a 9', 'Da 1 a 12'], predefinito: 9 },
      { id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 },
    ],
    regole: [
      'Nella scatola ci sono le tessere da 1 a 9 (o da 1 a 12), tutte alzate. Si gioca a turno, da 1 a 4.',
      'Al tuo turno tiri due dadi e abbassi tessere alzate la cui somma è uguale al tiro: una sola o più di una (con 8 puoi abbassare l\'8, oppure 5 e 3, oppure 1, 2 e 5…). Poi ritiri e continui.',
      'Quando le tessere ancora alzate sommano 6 o meno puoi scegliere di tirare un dado solo.',
      'Se dopo un tiro non c\'è nessuna combinazione possibile, il turno finisce: prendi come punti la somma delle tessere rimaste alzate (per esempio 2 + 7 = 9 punti). Meno punti è meglio.',
      'Se abbassi tutte le tessere hai "chiuso la scatola" e vinci subito la partita.',
      'Dopo 3 round (o 1, o 5), ognuno con un turno a testa, vince chi ha meno punti in totale. A ogni round comincia un giocatore diverso.',
      'Il computer facile abbassa tessere a caso; il medio di solito abbassa prima quelle alte con meno tessere possibile; il difficile calcola in anticipo la mossa che in media lascia meno punti (anche se tirare uno o due dadi).',
    ],
  },
  crea: (o) => new ShutBox(o),
  bot,
  _test: { combinazioni, atteso, sommaDi },
};
