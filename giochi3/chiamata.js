// BRISCOLA CHIAMATA (in cinque): tutte le 40 carte, 8 a testa. Prima l'ASTA: a turno si "chiama" una carta, dall'asso
// in giù (asso, tre, re, donna, fante, 7 … 2); ogni chiamata deve essere più bassa della precedente, e dopo il 2 si
// alzano i punti da fare (2 a 62, 2 a 63…). Chi passa è fuori dall'asta. Chi resta (il CHIAMANTE) sceglie il seme di
// briscola: chi ha in mano la carta chiamata di quel seme è il suo SOCIO segreto (si scopre quando la gioca). Chiamante
// e socio devono fare almeno i punti chiamati (61 o di più) contro gli altri tre. Le prese come nella briscola (si può
// giocare qualsiasi carta). Punteggio di ogni mano: chiamante ±2, socio ±1, gli altri ∓1; chi chiama una carta che ha
// già in mano gioca da solo contro quattro (±4). Si gioca un numero fisso di mani: vince chi ha il totale più alto.
const { mazzo40, mescola, casuale } = require('../giochi/carte');
const T = require('../giochi/trucco');

const ORDINE = [1, 3, 13, 12, 11, 7, 6, 5, 4, 2]; // dalla più forte alla più debole
const NOMI_RANGO = { 1: 'Asso', 3: 'Tre', 13: 'Re', 12: 'Donna', 11: 'Fante', 7: 'Sette', 6: 'Sei', 5: 'Cinque', 4: 'Quattro', 2: 'Due' };
const NOMI_SEMI = { c: 'cuori', q: 'quadri', f: 'fiori', p: 'picche' };
const SEMI = ['c', 'q', 'f', 'p'];
const PUNTI = { 1: 11, 3: 10, 13: 4, 12: 3, 11: 2 };
const forza = (c) => 10 - ORDINE.indexOf(c.rango);
const punti = (c) => PUNTI[c.rango] || 0;
const MAX_LIVELLO = 9 + 59; // 2 a 120
// il livello dell'asta: 0..9 = una carta (asso … due) a 61 punti; 10.. = il due con più punti (62, 63 … 120)
const daLivello = (L) => (L < 10 ? { rango: ORDINE[L], soglia: 61 } : { rango: 2, soglia: 61 + (L - 9) });
const nomeLivello = (L) => { const { rango, soglia } = daLivello(L); return soglia > 61 ? `il ${NOMI_RANGO[rango].toLowerCase()} a ${soglia}` : `${rango === 1 ? 'l\'asso' : `il ${NOMI_RANGO[rango].toLowerCase()}`}`; };
const nomeCarta = (c) => `${NOMI_RANGO[c.rango]} di ${NOMI_SEMI[c.seme]}`;

function vincitoreDi(tavolo, B) {
  let m = tavolo[0];
  for (const g of tavolo.slice(1)) {
    if (g.carta.seme === m.carta.seme) { if (forza(g.carta) > forza(m.carta)) m = g; } else if (g.carta.seme === B) m = g;
  }
  return m.posto;
}

class Chiamata {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'chiamata';
    this.n = n;
    this.nMani = [5, 3, 1, 10].includes(Number(opzioni.mani)) ? Number(opzioni.mani) : 5;
    this.totali = new Array(n).fill(0);
    this.mazziere = (primo - 1 + n) % n;
    this.nSmazzata = 0;
    this.nEv = 0; this.evento = null;
    this.finita = false; this.risultato = null;
    this.nGiocate = 0;
    this.storicoMani = [];
    this.nuovaSmazzata();
  }

  annuncia(posto, testo, testoIo, forte = false, extra = {}) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte, ...extra }; }

  nuovaSmazzata() {
    const n = this.n;
    this.mazziere = (this.mazziere + 1) % n;
    this.primo = (this.mazziere + 1) % n;
    const mazzo = mescola(mazzo40());
    this.mani = Array.from({ length: n }, () => []);
    for (let k = 0; k < 40; k++) this.mani[(this.primo + k) % n].push(mazzo.pop());
    for (let p = 0; p < n; p++) if (T.consuma(this, p)) this.truccaMano(p);
    this.prese = Array.from({ length: n }, () => []);
    this.maniVinte = new Array(n).fill(0);
    this.tavolo = [];
    this.ultimaMano = null;
    this.asta = { livello: -1, chi: null, attivi: new Array(n).fill(true), storia: [] };
    this.chiamata = null; // { rango, seme, soglia, chiamante, carta }
    this.socio = null; this.rivelato = false;
    this.fase = 'asta';
    this.turno = this.primo;
    this.inAttesa = false;
    this.riepilogo = null;
    this.pausaMs = 1300;
  }

  // il trucco segreto (!win): una mano da chiamante, scambiata con le carte più deboli: asso, tre, re e donna dello
  // stesso seme (da chiamare come briscola) più gli altri assi che si trovano
  truccaMano(p) {
    const mano = this.mani[p];
    const altre = this.mani.filter((m) => m !== mano);
    const tieni = new Set();
    // il seme: quello in cui ha già più punti
    const puntiSeme = (s) => mano.filter((c) => c.seme === s).reduce((t, c) => t + punti(c) + 1, 0);
    const s = [...SEMI].sort((a, b) => puntiSeme(b) - puntiSeme(a))[0];
    const vuoi = [...[1, 3, 13, 12].map((r) => (c) => c.rango === r && c.seme === s), (c) => c.rango === 1, (c) => c.rango === 1];
    for (const f of vuoi) {
      const gia = mano.find((c) => f(c) && !tieni.has(c));
      if (gia) { tieni.add(gia); continue; }
      const via = T.migliore(mano.filter((c) => !tieni.has(c)), (c) => -(punti(c) * 10 + forza(c)));
      const m = altre.find((x) => x.some(f));
      if (!via || !m) continue;
      const i = m.findIndex(f), c = m[i];
      m[i] = via; mano[mano.indexOf(via)] = c; tieni.add(c);
    }
  }

  attivi() { return this.asta.attivi.map((x, i) => (x ? i : -1)).filter((i) => i >= 0); }
  prossimoAttivo(p) { for (let k = 1; k <= this.n; k++) { const q = (p + k) % this.n; if (this.asta.attivi[q]) return q; } return null; }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta un attimo' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a.tipo !== 'string') return { errore: 'Mossa non valida' };
    if (this.fase === 'asta') return this.mossaAsta(p, a);
    if (this.fase === 'seme') return this.mossaSeme(p, a);
    if (this.fase === 'gioco') return this.gioca(p, a);
    return { errore: 'Mossa non valida' };
  }

  mossaAsta(p, a) {
    const A = this.asta;
    if (a.tipo === 'chiama') {
      const L = Number(a.livello);
      if (!Number.isInteger(L) || L <= A.livello || L > MAX_LIVELLO) return { errore: 'Devi chiamare più in basso (o più punti) di chi ha chiamato prima' };
      A.livello = L; A.chi = p;
      A.storia.push({ posto: p, livello: L });
      this.annuncia(p, `chiama ${nomeLivello(L)}`, `chiami ${nomeLivello(L)}`);
    } else if (a.tipo === 'passo') {
      A.attivi[p] = false;
      A.storia.push({ posto: p, passo: true });
      this.annuncia(p, 'passa', 'passi');
    } else return { errore: 'Mossa non valida' };
    const att = this.attivi();
    if (!att.length) {
      // tutti hanno passato senza chiamare: si rimescola (il mazziere passa al prossimo)
      this.annuncia(null, 'Tutti passano: si rimescola', 'Tutti passano: si rimescola', true);
      this.fase = 'rimescola'; this.turno = null; this.inAttesa = true; this.pausaMs = 2200;
      return { ok: true };
    }
    if (att.length === 1 && A.chi === att[0]) {
      this.fase = 'seme'; this.turno = A.chi;
      return { ok: true };
    }
    this.turno = this.prossimoAttivo(p);
    return { ok: true };
  }

  mossaSeme(p, a) {
    if (a.tipo !== 'seme' || !SEMI.includes(a.seme)) return { errore: 'Scegli il seme di briscola' };
    const { rango, soglia } = daLivello(this.asta.livello);
    const carta = `${rango}${a.seme}`;
    const socio = this.mani.findIndex((m) => m.some((c) => c.id === carta));
    this.chiamata = { rango, seme: a.seme, soglia, chiamante: p, carta };
    this.socio = socio;
    this.solo = socio === p;
    this.annuncia(p, `chiama il ${NOMI_RANGO[rango]} di ${NOMI_SEMI[a.seme]}: briscola ${NOMI_SEMI[a.seme]}, deve fare ${soglia} punti${this.solo ? '' : ' con il socio'}`,
      `chiami il ${NOMI_RANGO[rango]} di ${NOMI_SEMI[a.seme]}${this.solo ? ': ce l\'hai tu, giochi da solo contro tutti!' : ''}`, true);
    this.fase = 'gioco';
    this.turno = this.primo;
    return { ok: true };
  }

  gioca(p, a) {
    if (a.tipo !== 'gioca' || typeof a.carta !== 'string') return { errore: 'Mossa non valida' };
    const mano = this.mani[p];
    const i = mano.findIndex((c) => c.id === a.carta);
    if (i < 0) return { errore: 'Non hai questa carta' };
    const [carta] = mano.splice(i, 1);
    this.tavolo.push({ posto: p, carta });
    this.nGiocate++;
    if (carta.id === this.chiamata.carta && !this.rivelato) {
      this.rivelato = true;
      if (!this.solo) this.annuncia(p, `gioca il ${nomeCarta(carta)}: è il socio! 🤝`, `giochi il ${nomeCarta(carta)}: ora tutti sanno che sei il socio`, true);
    }
    if (this.tavolo.length === this.n) { this.inAttesa = true; this.turno = null; this.pausaMs = 1500; } else this.turno = (p + 1) % this.n;
    return { ok: true };
  }

  avanza() {
    if (this.fase === 'rimescola') { this.nuovaSmazzata(); return; }
    if (this.fase === 'riepilogo') { if (!this.finita) this.nuovaSmazzata(); return; }
    if (this.tavolo.length < this.n) { this.inAttesa = false; return; }
    const v = vincitoreDi(this.tavolo, this.chiamata.seme);
    const carte = this.tavolo.map((g) => g.carta);
    const pt = carte.reduce((s, c) => s + punti(c), 0);
    this.prese[v].push(...carte);
    this.maniVinte[v]++;
    this.ultimaMano = { tavolo: this.tavolo, vincitore: v, punti: pt };
    this.tavolo = [];
    this.inAttesa = false;
    if (this.mani.every((m) => !m.length)) { this.fineSmazzata(); return; }
    if (pt) this.annuncia(v, `prende ${pt} punti`, `prendi ${pt} punti`);
    this.turno = v;
  }

  squadra(p) { return p === this.chiamata.chiamante || p === this.socio; }

  fineSmazzata() {
    const ch = this.chiamata.chiamante;
    const pg = this.prese.map((x) => x.reduce((s, c) => s + punti(c), 0));
    const fatti = pg.reduce((s, x, i) => s + (this.squadra(i) ? x : 0), 0);
    const vinto = fatti >= this.chiamata.soglia;
    const segno = vinto ? 1 : -1;
    const unita = new Array(this.n).fill(0).map((_, i) => {
      if (this.solo) return i === ch ? 4 * segno : -segno;
      if (i === ch) return 2 * segno;
      if (i === this.socio) return segno;
      return -segno;
    });
    unita.forEach((u, i) => { this.totali[i] += u; });
    this.nSmazzata++;
    this.storicoMani.push({ chiamante: ch, socio: this.socio, vinto, fatti });
    this.riepilogo = {
      smazzata: this.nSmazzata, di: this.nMani, chiamante: ch, socio: this.socio, solo: this.solo, carta: this.chiamata.carta,
      rango: this.chiamata.rango, seme: this.chiamata.seme, soglia: this.chiamata.soglia, fatti, vinto,
      righe: pg.map((x, i) => ({ punti: x, prese: this.maniVinte[i], unita: unita[i], totale: this.totali[i], squadra: this.squadra(i) })),
    };
    const nome = this.solo ? 'Il chiamante, da solo,' : 'Chiamante e socio';
    this.annuncia(ch, `${vinto ? 'vince' : 'perde'} la mano: ${fatti} punti su ${this.chiamata.soglia}`, `${vinto ? 'vinci' : 'perdi'} la mano: ${fatti} punti su ${this.chiamata.soglia}`, true);
    void nome;
    if (this.nSmazzata >= this.nMani) {
      this.finita = true;
      const max = Math.max(...this.totali);
      const top = this.totali.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0);
      this.risultato = { fazioni: this.totali.map((t, i) => ({ posti: [i], punti: t })), etichetta: 'punti', pareggio: top.length > 1, vincitori: top.length === 1 ? top : [] };
    }
    this.fase = 'riepilogo';
    this.turno = null;
    this.inAttesa = !this.finita;
    this.pausaMs = 15000;
  }

  // chi è il socio, visto da p: lo sanno il socio stesso, tutti dopo che ha giocato la carta, e tutti a fine mano
  socioPer(p) { return this.chiamata && (this.rivelato || p === this.socio || this.fase === 'riepilogo' || this.finita) ? this.socio : null; }

  vista(p) {
    const mio = this.turno === p && !this.inAttesa && !this.finita;
    return {
      gioco: this.id, n: this.n,
      mano: this.mani[p] || [],
      carteInMano: this.mani.map((m) => m.length),
      fase: this.fase,
      asta: { livello: this.asta.livello, chi: this.asta.chi, attivi: this.asta.attivi, storia: this.asta.storia },
      chiamata: this.chiamata, socio: this.socioPer(p), rivelato: this.rivelato, solo: this.chiamata && (this.rivelato || p === this.socio || this.fase === 'riepilogo') ? this.solo : null,
      tavolo: this.tavolo, vince: this.tavolo.length && this.chiamata ? vincitoreDi(this.tavolo, this.chiamata.seme) : null,
      giocate: this.nGiocate, ultimaMano: this.ultimaMano, maniVinte: this.maniVinte,
      totali: this.totali, nSmazzata: this.nSmazzata, nMani: this.nMani, mazziere: this.mazziere, primo: this.primo,
      mioTurno: mio, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      riepilogo: this.riepilogo, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ======================= COMPUTER =======================
// forza di una mano se si gioca con briscola s: briscole (tante e alte) e carichi degli altri semi
function valuta(mano, s) {
  const br = mano.filter((c) => c.seme === s);
  let v = br.reduce((t, c) => t + 3 + forza(c) * 0.9 + punti(c) * 0.6, 0);
  for (const c of mano) if (c.seme !== s) v += punti(c) * 0.45 + (c.rango === 1 ? 3 : 0);
  // la carta che si chiamerebbe: la più alta di quel seme che non si ha
  const manca = ORDINE.find((r) => !br.some((c) => c.rango === r));
  return { v, manca: manca == null ? 2 : manca, seme: s };
}
function migliore(mano) { return SEMI.map((s) => valuta(mano, s)).sort((a, b) => b.v - a.v)[0]; }

function botAsta(g, p, livello) {
  const mano = g.mani[p], A = g.asta;
  const m = migliore(mano);
  // fin dove si spinge: la carta che chiamerebbe (se la mano è buona), poi qualche punto in più col 2 se è fortissima
  const soglia = { facile: 30, medio: 33, difficile: 33 }[livello];
  if (m.v < soglia - (A.chi == null && g.attivi().length === 1 ? 12 : 0)) return { tipo: 'passo' };
  let max = ORDINE.indexOf(m.manca);
  if (m.v > 48) max = Math.max(max, 9 + Math.round((m.v - 48) * (livello === 'difficile' ? 1.2 : 1)));
  if (livello === 'facile') max += Math.floor(Math.random() * 3) - 1;
  const prossimo = A.livello + 1;
  if (prossimo > Math.min(max, MAX_LIVELLO)) return { tipo: 'passo' };
  // si chiama la carta più alta possibile (il livello più basso che basta), oppure direttamente la propria
  const L = A.livello < 0 ? Math.min(max, Math.max(prossimo, livello === 'facile' ? 0 : Math.max(0, ORDINE.indexOf(m.manca) - 2))) : prossimo;
  return { tipo: 'chiama', livello: L };
}
function botSeme(g, p) {
  const { rango } = daLivello(g.asta.livello);
  const mano = g.mani[p];
  // tra i semi in cui NON si ha la carta chiamata, il più forte; se la si ha in tutti, il più forte (si gioca da soli)
  const val = SEMI.map((s) => ({ s, v: valuta(mano, s).v, ho: mano.some((c) => c.rango === rango && c.seme === s) }));
  const senza = val.filter((x) => !x.ho).sort((a, b) => b.v - a.v);
  return { tipo: 'seme', seme: (senza[0] || val.sort((a, b) => b.v - a.v)[0]).s };
}

// chi è amico di p, per quello che p sa: true, false oppure null (non si sa ancora)
function amico(g, p, q) {
  if (p === q) return true;
  const ch = g.chiamata.chiamante;
  const soc = g.socioPer(p);
  const ioSquadra = p === ch || p === g.socio;
  if (soc != null || g.rivelato) { const lui = q === ch || q === g.socio; return lui === ioSquadra; }
  // il socio non si sa ancora
  if (p === ch) return null;
  // io sono difensore (se fossi il socio lo saprei): il chiamante è nemico, gli altri non si sa
  return q === ch ? false : null;
}

function botGioco(g, p, livello) {
  const mano = g.mani[p];
  const gioca = (c) => ({ tipo: 'gioca', carta: c.id });
  if (livello === 'facile' && Math.random() < 0.55) return gioca(casuale(mano));
  const B = g.chiamata.seme;
  const isB = (c) => c.seme === B;
  const costo = (c) => (isB(c) ? 20 + forza(c) : 0) + punti(c) * 2 + forza(c) * 0.1 + (c.id === g.chiamata.carta && !g.rivelato ? 6 : 0);
  const perCosto = [...mano].sort((a, b) => costo(a) - costo(b));
  const liscio = perCosto[0];
  if (!g.tavolo.length) {
    // apre lisciando. Il difficile decide l'apertura con le simulazioni (simula), che provano anche le briscole: una regola
    // fissa "il chiamante con 3 briscole alte apre di briscola" l'abbiamo provata in 3000 mani tra computer e faceva vincere
    // il chiamante difficile meno spesso (73% invece di 79%), quindi non c'è.
    return gioca(liscio);
  }
  const puntiTavolo = g.tavolo.reduce((s, x) => s + punti(x.carta), 0);
  const vince = vincitoreDi(g.tavolo, B);
  const ultimo = g.tavolo.length === g.n - 1;
  // dopo di me giocano amici o nemici?
  const dopo = Array.from({ length: g.n - 1 - g.tavolo.length }, (_, k) => (p + 1 + k) % g.n);
  const nemiciDopo = dopo.some((q) => amico(g, p, q) !== true);
  const am = amico(g, p, vince);
  // il difficile conta le carte: quali possono ancora uscire (non giocate e non in mano mia)
  const viste = new Set([...g.prese.flat(), ...g.tavolo.map((x) => x.carta), ...mano].map((c) => c.id));
  const fuori = livello === 'difficile' ? mazzo40().filter((c) => !viste.has(c.id)) : null;
  // una carta messa ora resterebbe la vincente anche dopo le carte che possono ancora uscire?
  const imbattibile = (tav, posto) => fuori && fuori.every((c) => vincitoreDi([...tav, { posto: -1, carta: c }], B) === posto);
  if (am === true) {
    // sta prendendo un amico: gli si caricano punti se è sicuro (sono l'ultimo, o dopo di me solo amici, o nessuna carta
    // rimasta può batterlo)
    if (!nemiciDopo || ultimo || imbattibile(g.tavolo, vince)) {
      const carichi = mano.filter((c) => !isB(c) && punti(c) > 0 && c.id !== g.chiamata.carta).sort((a, b) => punti(b) - punti(a));
      if (carichi.length) return gioca(carichi[0]);
    }
    return gioca(liscio);
  }
  const vincenti = mano.filter((c) => vincitoreDi([...g.tavolo, { posto: p, carta: c }], B) === p);
  const lisciVincenti = vincenti.filter((c) => !isB(c)).sort((a, b) => punti(b) - punti(a));
  const briscoleVincenti = vincenti.filter(isB).sort((a, b) => forza(a) - forza(b));
  // se dopo di me ci sono nemici, una carta non di briscola che vince ora può essere superata: va bene solo se è alta
  // (il difficile sa se è davvero imbattibile)
  if (fuori && nemiciDopo) {
    const sicure = vincenti.filter((c) => imbattibile([...g.tavolo, { posto: p, carta: c }], p)).sort((a, b) => costo(a) - costo(b));
    if (sicure.length && puntiTavolo >= 3 && (!isB(sicure[0]) || puntiTavolo >= 8)) return gioca(sicure[0]);
  }
  if (lisciVincenti.length && (!nemiciDopo || forza(lisciVincenti[0]) >= 9 || puntiTavolo < 4)) return gioca(lisciVincenti[0]);
  const soglia = livello === 'difficile' ? (ultimo ? 2 : 8) : 10;
  if (briscoleVincenti.length && (puntiTavolo >= soglia || (am === false && puntiTavolo >= 4))) {
    const b = nemiciDopo ? briscoleVincenti[briscoleVincenti.length - 1] : briscoleVincenti[0];
    if (punti(b) < 10 || puntiTavolo >= 10 || !nemiciDopo) return gioca(b);
    return gioca(briscoleVincenti[0]);
  }
  return gioca(liscio);
}

// DIFFICILE: per ogni carta che può giocare immagina tante distribuzioni delle carte che non vede (coerenti con quello
// che sa: chi ha il socio, quante carte ha ognuno), gioca la mano fino in fondo con il computer medio e sceglie la
// carta che fa vincere più spesso la sua squadra (e con più punti).
function simula(g, p, prove = 14) {
  const mano = g.mani[p];
  if (mano.length === 1) return null;
  const viste = new Set([...g.prese.flat(), ...g.tavolo.map((x) => x.carta), ...mano].map((c) => c.id));
  const ignote = mazzo40().filter((c) => !viste.has(c.id));
  const socioNoto = g.socioPer(p);
  const altri = Array.from({ length: g.n }, (_, i) => i).filter((i) => i !== p);
  const punteggio = new Map(mano.map((c) => [c.id, 0]));
  for (let k = 0; k < prove; k++) {
    // distribuzione a caso: se il socio è noto, la carta chiamata (se non è ancora uscita) resta a lui
    const pool = mescola(ignote.slice());
    const mani = g.mani.map((m) => m.slice());
    const chiamataFuori = pool.findIndex((c) => c.id === g.chiamata.carta);
    for (const q of altri) mani[q] = [];
    if (chiamataFuori >= 0 && socioNoto != null && socioNoto !== p) { mani[socioNoto].push(pool[chiamataFuori]); pool.splice(chiamataFuori, 1); }
    for (const q of altri) while (mani[q].length < g.mani[q].length) mani[q].push(pool.pop());
    const socio = mani.findIndex((m) => m.some((c) => c.id === g.chiamata.carta));
    for (const c of mano) {
      const s = Object.create(Chiamata.prototype);
      Object.assign(s, g, { mani: mani.map((m) => m.slice()), prese: g.prese.map((x) => x.slice()), tavolo: g.tavolo.slice(), totali: g.totali.slice(), maniVinte: g.maniVinte.slice(), storicoMani: [], nMani: Infinity, evento: null });
      if (socio >= 0) { s.socio = socio; s.solo = socio === g.chiamata.chiamante; }
      s.annuncia = () => {};
      s.azione(p, { tipo: 'gioca', carta: c.id });
      let giri = 0;
      while (s.fase === 'gioco' && giri++ < 60) {
        if (s.inAttesa) { s.avanza(); continue; }
        s.azione(s.turno, botGioco(s, s.turno, 'medio'));
      }
      if (!s.riepilogo) continue;
      const mia = s.squadra(p), r = s.riepilogo;
      const vinto = mia ? r.vinto : !r.vinto;
      const pt = mia ? r.fatti : 120 - r.fatti;
      punteggio.set(c.id, punteggio.get(c.id) + (vinto ? 1 : 0) + pt / 240);
    }
  }
  let meglio = null, v = -Infinity;
  for (const c of mano) if (punteggio.get(c.id) > v) { v = punteggio.get(c.id); meglio = c; }
  return meglio ? { tipo: 'gioca', carta: meglio.id } : null;
}

function bot(g, p, livello) {
  if (g.fase === 'asta') return botAsta(g, p, livello);
  if (g.fase === 'seme') return botSeme(g, p, livello);
  if (livello === 'difficile') { const m = simula(g, p); if (m) return m; }
  return botGioco(g, p, livello);
}

module.exports = {
  meta: {
    id: 'chiamata',
    nome: 'Briscola chiamata',
    giocatori: [5],
    descrizione: 'La briscola in cinque: all\'asta si chiama una carta, chi la ha è il socio segreto. Chiamante e socio contro gli altri tre.',
    alias: ['briscola chiamata', 'briscola in cinque', 'briscola a 5', 'chiamata', 'briscolone', 'briscola bastarda'],
    opzioni: [
      { id: 'mani', nome: 'Mani', valori: [5, 3, 1, 10], etichette: ['5 mani (una a testa come mazziere)', '3 mani', '1 mano', '10 mani'], predefinito: 5 },
    ],
    regole: [
      'Si gioca in cinque con tutte le 40 carte: 8 carte a testa. Ordine di forza: asso, tre, re, donna, fante, 7, 6, 5, 4, 2. Punti: asso 11, tre 10, re 4, donna 3, fante 2 (120 in tutto).',
      'L\'ASTA: a turno, partendo da chi sta dopo il mazziere, si chiama una carta (senza dire il seme) oppure si passa. Ogni chiamata deve essere più bassa della precedente: asso, poi tre, re… fino al 2. Dopo il 2 si alzano i punti da fare: "2 a 62", "2 a 63"… Chi passa non rientra.',
      'Chi resta da solo nell\'asta è il CHIAMANTE: sceglie il seme di briscola. La carta chiamata, in quel seme, decide il SOCIO: chi la ha in mano gioca con il chiamante, ma non lo dice! Si scopre quando la gioca.',
      'Chiamante e socio devono fare insieme almeno i punti chiamati (61, o di più se si è andati oltre il 2). Gli altri tre giocano insieme contro di loro.',
      'Le prese come nella briscola: si può giocare qualsiasi carta; prende la briscola più alta, o se non ce ne sono la carta più alta del seme giocato per primo. Chi prende gioca per primo la presa dopo.',
      'Punti della mano: se chiamante e socio ce la fanno, il chiamante prende 2, il socio 1 e gli altri perdono 1 ciascuno; se non ce la fanno è il contrario. Se il chiamante chiama una carta che ha già in mano gioca da solo contro quattro: ±4 per lui, ∓1 agli altri.',
      'Se tutti passano senza chiamare si rimescola. Si giocano le mani scelte (di solito 5, una a testa come mazziere): vince chi ha il totale più alto.',
      'Il computer facile chiama e gioca un po\' a caso; il medio sa quando conviene chiamare; il difficile tiene conto di chi è amico, carica i punti al compagno e tira fuori le briscole quando serve.',
    ],
  },
  crea: (o) => new Chiamata(o),
  bot,
  _test: { vincitoreDi, punti, forza, daLivello, nomeLivello, valuta, ORDINE, MAX_LIVELLO, amico },
};
