// INDOVINA LA BANDIERA: il classico quiz a scelta multipla. Compare una bandiera e 4 nomi di paesi: scegli quello
// giusto prima che finisca il tempo. Da soli (quante ne indovini?) o in sfida (tutti la stessa bandiera, nello stesso
// momento: chi risponde giusto e prima prende più punti). Le bandiere sono disegnate in SVG in bandiere-dati.js.
const { PAESI } = require('./bandiere-dati');

const OPZIONI = 4;
const PAUSA_MS = 2600; // la risposta giusta resta visibile prima della prossima bandiera

// famiglie di colori di una bandiera (per scegliere risposte sbagliate "simili": è più difficile)
function famiglia(hex) {
  const n = parseInt(hex.slice(1), 16);
  const R = ((n >> 16) & 255) / 255, G = ((n >> 8) & 255) / 255, Bl = (n & 255) / 255;
  const max = Math.max(R, G, Bl), min = Math.min(R, G, Bl), l = (max + min) / 2, d = max - min;
  if (l > 0.92) return 'bianco';
  if (l < 0.13) return 'nero';
  if (d < 0.12) return 'grigio';
  let h = max === R ? ((G - Bl) / d) % 6 : max === G ? (Bl - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 330) return 'rosso';
  if (h < 42) return 'arancio';
  if (h < 70) return 'giallo';
  if (h < 170) return 'verde';
  if (h < 205) return 'azzurro';
  if (h < 265) return 'blu';
  return 'rosso';
}
const COLORI = PAESI.map((p) => new Set((p.svg.match(/#[0-9a-f]{6}/gi) || []).map(famiglia)));
function somiglianza(a, b) {
  const A = COLORI[a], B = COLORI[b];
  let comuni = 0;
  for (const c of A) if (B.has(c)) comuni++;
  return comuni / (A.size + B.size - comuni || 1);
}

// le bandiere tra cui si pesca, secondo l'opzione
const MAZZI = {
  famose: PAESI.filter((p) => p.fama === 1).map((p) => p.id),
  tutte: PAESI.map((p) => p.id),
  difficili: PAESI.filter((p) => p.fama >= 2).map((p) => p.id),
};
const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 4 risposte: quella giusta + 3 sbagliate scelte tra le bandiere più simili (un po' a caso)
function scelte(giusta, mazzo) {
  const altre = mazzo.filter((i) => i !== giusta).map((i) => ({ i, s: somiglianza(giusta, i) + Math.random() * 0.35 }));
  altre.sort((a, b) => b.s - a.s);
  return mescola([giusta, ...altre.slice(0, OPZIONI - 1).map((x) => x.i)]);
}

// La BANCA delle domande: le bandiere (qui) oppure altri quiz che usano lo stesso motore (capitali, sagome dei paesi,
// monumenti: cartella giochi2). elementi[i] = { nome (la risposta), fama, svg?, W?, domanda? }; scelte(giusta, mazzo)
// prepara le 4 risposte.
const BANDIERE = { id: 'bandiere', elementi: PAESI, mazzi: MAZZI, scelte, chiaveMazzo: 'bandiere', domanda: 'Di che paese è questa bandiera?', cosa: 'Bandiera' };

class Bandiere {
  constructor({ n, opzioni = {}, bot = [] }, banca = BANDIERE) {
    this.banca = banca;
    this.id = banca.id;
    this.n = n;
    this.mazzo = banca.mazzi[opzioni[banca.chiaveMazzo]] ? opzioni[banca.chiaveMazzo] : 'tutte';
    this.nDomande = [10, 20, 30].includes(Number(opzioni.domande)) ? Number(opzioni.domande) : 10;
    this.tempoMs = [6, 10, 15].includes(Number(opzioni.tempo)) ? Number(opzioni.tempo) * 1000 : 10000;
    this.botLiv = Array.from({ length: n }, (_, i) => bot[i] || null);
    this.ordine = mescola([...banca.mazzi[this.mazzo]]).slice(0, this.nDomande);
    this.punti = new Array(n).fill(0);
    this.giuste = new Array(n).fill(0);
    this.serie = new Array(n).fill(0);     // risposte giuste di fila
    this.migliore = new Array(n).fill(0);  // la serie più lunga
    this.sbagliate = Array.from({ length: n }, () => []); // le bandiere sbagliate di ognuno: il ripasso alla fine
    this.k = -1;
    this.turno = null; this.inAttesa = false; this.pausaMs = PAUSA_MS;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.prossima();
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  prossima() {
    this.k++;
    this.giusta = this.ordine[this.k];
    this.opzioni = this.banca.scelte(this.giusta, this.banca.mazzi[this.mazzo]);
    this.risposte = new Array(this.n).fill(null); // { scelta, ms, giusto, punti }
    this.inizio = Date.now();
    this.fine = this.inizio + this.tempoMs;
    // quando risponde il computer
    this.oraBot = this.botLiv.map((l) => (l ? this.inizio + tempoBot(l, this.tempoMs) : null));
  }

  // si aspettano solo le persone: i computer rispondono da soli (controllaTempo)
  attesi() { return this.inAttesa || this.finita ? [] : this.risposte.map((x, i) => (x === null && !this.botLiv[i] ? i : -1)).filter((i) => i >= 0); }
  scadenza() {
    if (this.inAttesa || this.finita) return null;
    const bot = this.oraBot.filter((t, i) => t !== null && this.risposte[i] === null);
    return Math.min(this.fine, ...bot);
  }
  controllaTempo() {
    if (this.finita || this.inAttesa) return false;
    const ora = Date.now();
    let cambiato = false;
    for (let p = 0; p < this.n; p++) {
      if (!this.botLiv[p] || this.risposte[p] !== null || this.oraBot[p] > ora) continue;
      this.azione(p, bot(this, p, this.botLiv[p]));
      cambiato = true;
      if (this.inAttesa) return true;
    }
    if (ora >= this.fine) { this.chiudiDomanda(); return true; }
    return cambiato;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Un attimo: arriva la prossima bandiera' };
    if (this.risposte[p] !== null) return { errore: 'Hai già risposto' };
    if (!a || a.tipo !== 'risposta') return { errore: 'Mossa non valida' };
    const scelta = Number(a.scelta);
    if (!Number.isInteger(scelta) || scelta < 0 || scelta >= this.opzioni.length) return { errore: 'Risposta non valida' };
    const ms = Math.min(this.tempoMs, Date.now() - this.inizio);
    const giusto = this.opzioni[scelta] === this.giusta;
    // da soli 1 punto per risposta giusta; in sfida 10 punti + fino a 10 di bonus per la velocità
    const punti = !giusto ? 0 : this.n === 1 ? 1 : 10 + Math.round(10 * (1 - ms / this.tempoMs));
    this.risposte[p] = { scelta, ms, giusto, punti };
    if (this.risposte.every((x) => x !== null)) this.chiudiDomanda();
    return { ok: true };
  }

  // chi è assente non risponde: conta come risposta sbagliata
  salta(p) {
    if (this.finita || this.inAttesa || this.risposte[p] !== null) return;
    this.risposte[p] = { scelta: -1, ms: this.tempoMs, giusto: false, punti: 0 };
    if (this.risposte.every((x) => x !== null)) this.chiudiDomanda();
  }

  chiudiDomanda() {
    for (let p = 0; p < this.n; p++) {
      const x = this.risposte[p];
      if (x && x.giusto) { this.punti[p] += x.punti; this.giuste[p]++; this.serie[p]++; this.migliore[p] = Math.max(this.migliore[p], this.serie[p]); } else { this.serie[p] = 0; this.sbagliate[p].push({ giusta: this.giusta, scelta: x && x.scelta >= 0 ? this.opzioni[x.scelta] : null }); }
    }
    const nome = this.banca.elementi[this.giusta].nome;
    const primi = this.risposte.map((x, i) => (x && x.giusto ? i : -1)).filter((i) => i >= 0).sort((a, b) => this.risposte[a].ms - this.risposte[b].ms);
    if (this.n > 1 && primi.length) this.annuncia(primi[0], `è il più veloce: ${nome}!`, `il più veloce: ${nome}! ⚡`);
    else this.annuncia(null, `Era: ${nome}`, `Era: ${nome}`);
    this.ultima = { giusta: this.giusta, opzioni: this.opzioni, risposte: this.risposte };
    this.inAttesa = true;
  }

  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    if (this.k + 1 >= this.ordine.length) return this.chiudi();
    this.prossima();
  }

  chiudi() {
    this.finita = true; this.inAttesa = false;
    const max = Math.max(...this.punti);
    const v = this.punti.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
    this.risultato = {
      fazioni: this.punti.map((x, i) => ({ posti: [i], punti: x })),
      etichetta: this.n === 1 ? `giuste su ${this.nDomande}` : 'punti',
      pareggio: v.length > 1, vincitori: v.length > 1 ? [] : v,
    };
    return { ok: true };
  }

  // il trucco segreto (!win): finché non ha risposto gli sussurra la risposta giusta (vale anche per capitali, sagome, monumenti)
  suggerimentoWin(posto) { return !this.finita && !this.inAttesa && this.risposte[posto] === null ? `💡 ${this.banca.elementi[this.giusta].nome}` : null; }

  vista(p) {
    const svela = this.inAttesa || this.finita;
    const E = this.banca.elementi;
    const band = E[this.giusta];
    const mia = this.risposte[p];
    return {
      gioco: this.id, n: this.n, domanda: this.k + 1, nDomande: this.nDomande, tempo: this.tempoMs, mazzo: this.mazzo,
      cosa: this.banca.cosa, testo: band.domanda || this.banca.domanda, icona: band.icona || null, disegno: band.disegno || null, indizio: svela && band.indizio ? band.indizio : null,
      bandiera: band.svg ? { svg: band.svg, w: band.W || 300, h: band.H || 200, sagoma: !!band.sagoma } : null,
      opzioni: this.opzioni.map((i) => E[i].nome),
      resta: svela ? 0 : Math.max(0, this.fine - Date.now()),
      mia: mia ? { scelta: mia.scelta, giusto: svela ? mia.giusto : null, punti: svela ? mia.punti : null } : null,
      // la risposta giusta solo dopo (o quando hai già risposto non si dice: si aspetta la fine della domanda)
      giusta: svela ? this.opzioni.indexOf(this.giusta) : null,
      altri: this.risposte.map((x, i) => ({ risposto: x !== null, giusto: svela && x ? x.giusto : null, scelta: svela && x ? x.scelta : null, punti: this.punti[i], giuste: this.giuste[i], serie: this.serie[i] })),
      punti: this.punti, giuste: this.giuste, serie: this.serie[p], migliore: this.migliore[p],
      // a partita finita: le bandiere che hai sbagliato, con il nome giusto (e quello che avevi detto) per ripassarle
      ripasso: this.finita ? this.sbagliate[p].map((x) => ({ svg: E[x.giusta].svg || null, w: E[x.giusta].W || 300, h: E[x.giusta].H || 200, sagoma: !!E[x.giusta].sagoma, domanda: E[x.giusta].domanda || null, icona: E[x.giusta].icona || null, disegno: E[x.giusta].disegno || null, nome: E[x.giusta].nome, detto: x.scelta === null ? null : E[x.scelta].nome })) : null,
      turno: null, inAttesa: this.inAttesa, pausaMs: this.pausaMs, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
// quanto ci mette a rispondere (ms) e quanto spesso la sa: il difficile è veloce e conosce quasi tutte le bandiere
const LIV = {
  facile: { sa: [0.6, 0.35, 0.18], da: 0.4, a: 0.85 },
  medio: { sa: [0.85, 0.6, 0.4], da: 0.25, a: 0.6 },
  difficile: { sa: [0.98, 0.92, 0.82], da: 0.1, a: 0.32 },
};
const tempoBot = (l, tempo) => { const L = LIV[l] || LIV.medio; return Math.round(tempo * (L.da + Math.random() * (L.a - L.da))); };
function bot(g, posto, livello) {
  const L = LIV[livello] || LIV.medio;
  const sa = Math.random() < L.sa[(g.banca.elementi[g.giusta].fama || 2) - 1];
  if (sa) return { tipo: 'risposta', scelta: g.opzioni.indexOf(g.giusta) };
  // non la sa: tira a indovinare (ma una volta su 4 ci prende lo stesso)
  return { tipo: 'risposta', scelta: Math.floor(Math.random() * g.opzioni.length) };
}

module.exports = {
  meta: {
    id: 'bandiere',
    nome: 'Indovina la bandiera',
    tipo: 'tabellone',
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: `Il quiz delle bandiere: ne compare una e devi scegliere il paese giusto tra 4. ${PAESI.length} bandiere da tutto il mondo.`,
    alias: ['guess the flag', 'bandiere', 'bandiera', 'flag', 'flags', 'quiz', 'geografia', 'paesi', 'stati', 'nazioni'],
    opzioni: [
      { id: 'bandiere', nome: 'Bandiere', valori: ['tutte', 'famose', 'difficili'], etichette: [`Tutte (${MAZZI.tutte.length})`, `Solo le famose (${MAZZI.famose.length})`, `Solo le difficili (${MAZZI.difficili.length})`], predefinito: 'tutte' },
      { id: 'domande', nome: 'Domande', valori: [10, 20, 30], etichette: ['10 bandiere', '20 bandiere', '30 bandiere'], predefinito: 10 },
      { id: 'tempo', nome: 'Tempo', valori: [10, 15, 6], etichette: ['10 secondi', '15 secondi', '6 secondi (veloce)'], predefinito: 10 },
    ],
    regole: [
      `Compare una bandiera e sotto 4 nomi di paesi: tocca quello giusto prima che finisca il tempo (la barra in alto). Le bandiere sono ${PAESI.length}, da tutto il mondo: Europa, Americhe, Africa, Asia e Oceania.`,
      'Le risposte sbagliate non sono a caso: sono paesi con bandiere dei colori simili, quindi guarda bene i dettagli (l\'ordine delle strisce, le stelle, lo stemma…).',
      'Si può rispondere una volta sola. Quando hanno risposto tutti, o quando finisce il tempo, si vede la risposta giusta (in verde) e quella sbagliata (in rosso), poi arriva la prossima bandiera.',
      'Da soli: 1 punto per ogni bandiera indovinata; si tiene anche la serie di risposte giuste di fila.',
      'Sfida (da 2 a 8): tutti vedono la stessa bandiera nello stesso momento. Una risposta giusta vale 10 punti più un bonus fino a 10 per la velocità (più rispondi presto, più prendi). Le risposte sbagliate valgono 0. Vince chi ha più punti alla fine.',
      'Prima di iniziare si sceglie quante bandiere (10, 20 o 30), il tempo per ognuna (10, 15 o 6 secondi) e quali bandiere: tutte, solo le famose o solo le difficili.',
      'Gli stemmi più complicati sono disegnati in modo semplificato, ma colori e disposizione sono quelli veri.',
      'A fine partita compare il ripasso: le bandiere che hai sbagliato, con il nome giusto e quello che avevi scelto.',
      'Il computer facile conosce solo le bandiere famose ed è lento; il medio ne sa di più; il difficile le conosce quasi tutte e risponde in fretta.',
    ],
  },
  crea: (o) => new Bandiere(o),
  bot,
  Bandiere, mescola, OPZIONI,
  _test: { PAESI, MAZZI, scelte, somiglianza, famiglia, COLORI, LIV },
};
