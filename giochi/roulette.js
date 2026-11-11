// ROULETTE MAGGIONI: roulette europea (un solo zero) con le fiche, al tavolo del croupier Maggioni.
// Tutti puntano insieme (base comune in giochi/casino.js); poi Maggioni lancia la pallina, la ruota gira qualche
// secondo, esce il numero e si paga. Puntate: pieno su un numero (35 a 1), rosso/nero, pari/dispari, 1-18/19-36
// (1 a 1), dozzine e colonne (2 a 1). Con lo zero perdono tutte le puntate esterne.
const { Casino, puntataBot } = require('./casino');
const T = require('./trucco');

const ROSSI = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const RUOTA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]; // ordine vero della ruota europea
const colore = (n) => (n === 0 ? 'verde' : ROSSI.has(n) ? 'rosso' : 'nero');
// ogni puntata: chiave → [nome, quanto paga (oltre alla posta), vince(n)]
const PUNTATE = {
  rosso: ['Rosso', 1, (n) => colore(n) === 'rosso'], nero: ['Nero', 1, (n) => colore(n) === 'nero'],
  pari: ['Pari', 1, (n) => n > 0 && n % 2 === 0], dispari: ['Dispari', 1, (n) => n % 2 === 1],
  basso: ['1-18', 1, (n) => n >= 1 && n <= 18], alto: ['19-36', 1, (n) => n >= 19],
  d1: ['1ª dozzina', 2, (n) => n >= 1 && n <= 12], d2: ['2ª dozzina', 2, (n) => n >= 13 && n <= 24], d3: ['3ª dozzina', 2, (n) => n >= 25],
  c1: ['1ª colonna', 2, (n) => n > 0 && n % 3 === 1], c2: ['2ª colonna', 2, (n) => n > 0 && n % 3 === 2], c3: ['3ª colonna', 2, (n) => n > 0 && n % 3 === 0],
};
for (let n = 0; n <= 36; n++) PUNTATE[`n${n}`] = [`il ${n}`, 35, (x) => x === n];
// il numero che paga di più per queste puntate (a parità uno a caso tra i migliori)
function numeroMigliore(q) {
  const resa = (n) => Object.entries(q).reduce((t, [k, v]) => t + (PUNTATE[k][2](n) ? v * (PUNTATE[k][1] + 1) : 0), 0);
  const tutti = Array.from({ length: 37 }, (_, n) => n);
  const max = Math.max(...tutti.map(resa));
  const migliori = tutti.filter((n) => resa(n) === max);
  return migliori[Math.floor(Math.random() * migliori.length)];
}
const GIRO_MS = 5200, PAGA_MS = 4800;
// le frasi del croupier Maggioni
const FRASI = {
  apre: ['Fate il vostro gioco!', 'Prego, signori: puntate!', 'Il tavolo è aperto, puntate pure.'],
  lancia: ['Rien ne va plus: le puntate sono chiuse!', 'Pallina lanciata… niente più puntate!', 'Si gira! Non va più.'],
  zero: ['Zero! Il banco ringrazia.', 'Zero verde… capita anche ai migliori.'],
};
const aCaso = (a) => a[Math.floor(Math.random() * a.length)];

class Roulette extends Casino {
  constructor(o) {
    super(o);
    this.id = 'roulette';
    this.storia = [];
    this.pausaMs = GIRO_MS;
    this.frase = aCaso(FRASI.apre);
    this.apriPuntate();
  }
  apriPuntate() {
    super.apriPuntate();
    this.puntate = Array.from({ length: this.n }, () => ({}));
    this.numero = null; this.esiti = null;
    if (this.storia.length) this.frase = aCaso(FRASI.apre);
  }
  azione(p, a) {
    if (!a) return { errore: 'Mossa non valida' };
    if (this.inAttesa || this.fase !== 'puntate') return { errore: 'Maggioni ha già lanciato la pallina: aspetta il prossimo giro' };
    if (a.tipo === 'passa') return this.passa(p);
    if (a.tipo !== 'punta') return { errore: 'Mossa non valida' };
    if (this.puntato[p] || this.passato[p]) return { errore: 'Hai già deciso per questo giro' };
    const q = a.puntate && typeof a.puntate === 'object' ? a.puntate : {};
    const pulite = {};
    let tot = 0;
    for (const [k, v] of Object.entries(q)) {
      if (!Object.prototype.hasOwnProperty.call(PUNTATE, k)) return { errore: 'Puntata non valida' }; // niente "toString" e simili
      const x = Number(v);
      if (!Number.isInteger(x) || x < 0) return { errore: 'Puntata non valida' };
      if (x) { pulite[k] = x; tot += x; }
    }
    if (!tot) return { errore: 'Metti almeno una fiche sul tappeto' };
    if (tot > this.fiche[p]) return { errore: `Hai solo ${this.fiche[p]} fiche` };
    this.fiche[p] -= tot;
    this.puntate[p] = pulite;
    this.segnaPuntata(p);
    return { ok: true };
  }
  gioca() {
    this.fase = 'giro';
    this.numero = Math.floor(Math.random() * 37); // la ruota è onesta: ogni numero ha la stessa probabilità
    // …tranne col trucco segreto (!win): esce il numero che fa vincere di più il giocatore truccato
    const chi = this.puntate.findIndex((q, i) => this.puntato[i] && T.consuma(this, i));
    if (chi >= 0) this.numero = numeroMigliore(this.puntate[chi]);
    this.frase = aCaso(FRASI.lancia);
    this.inAttesa = true; this.pausaMs = GIRO_MS; // la ruota gira qualche secondo
    return { ok: true };
  }
  avanza() {
    if (!this.inAttesa) return;
    if (this.fase === 'giro') return this.paga();
    if (this.fase === 'pagamenti') { this.inAttesa = false; this.apriPuntate(); }
  }
  paga() {
    const n = this.numero;
    this.fase = 'pagamenti';
    this.storia.push(n); if (this.storia.length > 30) this.storia.shift();
    this.esiti = this.puntate.map((q, p) => {
      let ritorno = 0, puntato = 0;
      for (const [k, v] of Object.entries(q)) { puntato += v; const [, paga, vince] = PUNTATE[k]; if (vince(n)) ritorno += v * (paga + 1); }
      this.fiche[p] += ritorno;
      return { netto: ritorno - puntato, puntato };
    });
    const descr = n === 0 ? '0 verde' : `${n} ${colore(n)}, ${n % 2 ? 'dispari' : 'pari'}, ${n <= 18 ? 'manque' : 'passe'}`;
    this.frase = n === 0 ? aCaso(FRASI.zero) : `${n} ${colore(n)}!`;
    this.annuncia(null, `🎩 Maggioni: «Esce il ${descr}»`, '', true);
    this.pausaMs = PAGA_MS;
    return { ok: true };
  }
  vista() {
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: null, inAttesa: this.inAttesa,
      fiche: this.fiche, puntato: this.puntato, passato: this.passato, puntate: this.puntate,
      numero: this.fase === 'giro' || this.fase === 'pagamenti' ? this.numero : null, esiti: this.esiti,
      storia: this.storia.slice(-18), frase: this.frase, giroMs: GIRO_MS, ruota: RUOTA, rossi: [...ROSSI],
      tempoPuntate: this.tempoPuntateMs(), nMano: this.nMano,
      finita: false, risultato: null, evento: this.evento,
    };
  }
}

// il computer: alla roulette nessuna puntata è migliore delle altre (il banco ha sempre il 2,7% di vantaggio).
// L'unica bravura è gestire le fiche: il facile punta tanto e spesso sui numeri pieni, il medio poco sulle
// puntate semplici, il difficile pochissimo, così perde meno (e resta al tavolo più a lungo).
function bot(g, p, livello) {
  const f = g.fiche[p], q = {};
  if (livello === 'facile') {
    const x = Math.max(1, Math.min(f, Math.round(f * (0.08 + Math.random() * 0.17))));
    const k = Math.random() < 0.5 ? `n${Math.floor(Math.random() * 37)}` : ['rosso', 'nero', 'd1', 'd2', 'd3'][Math.floor(Math.random() * 5)];
    q[k] = x;
  } else if (livello === 'medio') {
    q[['rosso', 'nero', 'pari', 'dispari', 'basso', 'alto'][Math.floor(Math.random() * 6)]] = Math.min(f, puntataBot(f, 'medio'));
  } else {
    q[['rosso', 'nero'][Math.floor(Math.random() * 2)]] = Math.max(1, Math.min(f, Math.round(f * 0.015)));
  }
  return { tipo: 'punta', puntate: q };
}

module.exports = {
  meta: {
    id: 'roulette',
    nome: 'Roulette Maggioni',
    tipo: 'tabellone',
    fiche: true,
    saltaAssenti: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'La roulette europea con le fiche, al tavolo del croupier Maggioni: numeri, colori, dozzine e colonne.',
    alias: ['roulette', 'maggioni', 'ruota', 'casino', 'rosso nero'],
    opzioni: [],
    regole: [
      'Ogni giocatore parte con 1000 fiche; quando le finisci puoi scrivere !ricarica in chat per averne altre 1000.',
      'Il croupier è Maggioni. Quando dice «Fate il vostro gioco» tutti puntano insieme: scegli un gettone e mettilo sul tappeto, anche su più caselle. Non ci sono minimo e massimo. Dopo la prima puntata gli altri hanno 20 secondi; puoi anche passare il giro.',
      'Poi Maggioni lancia la pallina: la ruota europea (numeri da 0 a 36, un solo zero) gira per qualche secondo e la pallina si ferma su un numero. Ogni numero ha la stessa probabilità.',
      'Pagamenti (oltre a riavere la tua puntata): numero pieno 35 a 1; rosso o nero, pari o dispari, 1-18 (manque) o 19-36 (passe) 1 a 1; dozzine (1-12, 13-24, 25-36) e colonne 2 a 1.',
      'Lo zero è verde: non è né rosso né nero, né pari né dispari. Quando esce, vince solo chi l\'ha puntato pieno (35 a 1); tutte le altre puntate vanno al banco.',
      'In alto vedi gli ultimi numeri usciti. Ricorda però che la ruota non ha memoria: un numero che non esce da tanto non è «in ritardo».',
      'I computer seduti al tavolo si ricaricano da soli. Alla roulette nessuna puntata conviene più delle altre: il facile punta tanto e spesso sui numeri pieni, il medio punta poco sui colori, il difficile punta pochissimo e così perde meno.',
    ],
  },
  crea: (o) => new Roulette(o),
  bot,
  _test: { Roulette, PUNTATE, RUOTA, colore, numeroMigliore },
};
