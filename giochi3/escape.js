// ESCAPE ROOM collaborativa: tutti insieme contro il tempo. Si attraversano 2, 3 o 4 stanze; in ogni stanza ci sono
// tre enigmi chiusi da un lucchetto (cifre, lettere, leve, frecce, tasti colorati o fili da tagliare) e una porta.
// Ogni enigma è diviso in parti e OGNI PARTE LA VEDE UN SOLO GIOCATORE (chi ha il biglietto, chi vede la parete, chi
// ha la torcia…): per aprire bisogna parlarsi in chat. Chiunque può provare una combinazione; un tentativo sbagliato
// toglie tempo, un aiuto anche. Ogni enigma aperto dà un frammento (simbolo + cifra): la porta si apre mettendo le
// cifre nell'ordine dei simboli disegnati sopra di lei, che vede uno solo. Da soli si vede tutto.
// Niente computer (soloPersone): chi esce lascia i suoi indizi a un compagno.
const D = require('./escape-dati');

const MIN_STANZA = { normale: 12, stretto: 8 }; // minuti per stanza (rilassato = senza tempo)
const PENA_ERRORE = 20000; // un tentativo sbagliato
const PENA_AIUTO = 60000; // un aiuto
const ATTESA_PROVA = 1200; // tra due tentativi dello stesso giocatore
const PAUSA_PORTA = Number(process.env.ESCAPE_PAUSA) || 4500;

const tempo = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const senzaAccenti = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// il valore provato, ripulito secondo il tipo di lucchetto (null = non valido)
function pulisci(lucchetto, valore) {
  const v = typeof valore === 'number' ? String(valore) : typeof valore === 'string' ? valore : null;
  if (v == null || v.length > 40) return null;
  const { tipo, n } = lucchetto;
  let r;
  if (tipo === 'cifre') r = v.replace(/\s+/g, '');
  else if (tipo === 'parola') r = senzaAccenti(v).toUpperCase().replace(/[^A-Z]/g, '');
  else if (tipo === 'leve') r = v.replace(/[^01]/g, '');
  else if (tipo === 'frecce') r = v.toUpperCase().replace(/[^UDLR]/g, '');
  else if (tipo === 'colori') r = v.replace(/[^0-5]/g, '');
  else if (tipo === 'filo') { const k = Number(v); return Number.isInteger(k) && k >= 1 && k <= n ? String(k) : null; }
  else return null;
  if (tipo === 'cifre' && !/^[0-9]+$/.test(r)) return null;
  return r.length === n ? r : null;
}

class EscapeRoom {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'escape';
    this.n = n;
    const t = opzioni.tema && D.TEMI[opzioni.tema] ? opzioni.tema : D.prendi(D.NOMI_TEMI);
    this.temaId = t;
    this.tema = D.TEMI[t];
    this.nStanze = [2, 3, 4].includes(Number(opzioni.stanze)) ? Number(opzioni.stanze) : 3;
    this.ritmo = MIN_STANZA[opzioni.tempo] ? opzioni.tempo : opzioni.tempo === 'rilassato' ? 'rilassato' : 'normale';
    this.aTempo = this.ritmo !== 'rilassato';
    this.fuori = new Array(n).fill(false);
    this.giro = Math.max(0, Number(primo) || 0); // chi riceve la prossima parte (gira tra i giocatori)
    this.stanze = this.creaStanze();
    this.stanza = 0;
    this.inizio = Date.now();
    this.durata = this.aTempo ? MIN_STANZA[this.ritmo] * 60000 * this.nStanze : null;
    this.fineAlle = this.aTempo ? this.inizio + this.durata : null;
    this.pausaDal = null;
    this.pausaTot = 0;
    this.penalita = 0;
    this.errori = 0;
    this.aiutiUsati = 0;
    this.ultimaProva = new Array(n).fill(0);
    this.turno = null;
    this.finita = false;
    this.risultato = null;
    this.evento = null;
    this.nEv = 0;
    this.inAttesa = false;
    this.pausaMs = PAUSA_PORTA;
    this.annuncia(null, `${this.tema.emoji} ${this.tema.nome}: siete chiusi dentro! Prima stanza: ${this.stanze[0].nome}`, '', true);
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  // a chi tocca la prossima parte: si gira tra i giocatori, così ognuno ha qualcosa da dire
  prossimo() { const p = this.giro % this.n; this.giro++; return p; }

  creaStanze() {
    const usate = new Set();
    const contenitori = D.mescola(this.tema.contenitori), carte = D.mescola(this.tema.carte);
    let ic = 0, ik = 0;
    // prima stanza con enigmi facili, poi tutti gli altri mescolati (senza ripetere finché si può)
    const facili = D.mescola(Object.keys(D.FACILI));
    const ordine = [...facili.slice(0, 3), ...D.mescola([...facili.slice(3), ...Object.keys(D.DIFFICILI)])];
    while (ordine.length < this.nStanze * 3) ordine.push(...D.mescola(Object.keys(D.GENERATORI)));
    const stanze = [];
    for (let s = 0; s < this.nStanze; s++) {
      const base = this.tema.stanze[s];
      const simboli = D.mescola(D.SIMBOLI_PORTA).slice(0, 3);
      const enigmi = [];
      for (let k = 0; k < 3; k++) {
        const tipo = ordine[s * 3 + k];
        const e = D.GENERATORI[tipo]({ contenitore: contenitori[ic++ % contenitori.length], carta: carte[ik++ % carte.length], usate });
        // le parti girano tra i giocatori; la prima parte va ogni volta a uno diverso
        const da = this.prossimo();
        e.parti.forEach((pt, j) => { pt.di = (da + j) % this.n; });
        e.premio = { simbolo: simboli[k], cifra: Math.floor(Math.random() * 10) };
        e.risolto = false; e.risoltoDa = null; e.aiutiVisti = 0; e.tentativi = [];
        enigmi.push(e);
      }
      // la porta: le cifre dei frammenti nell'ordine dei simboli sopra la porta (li vede uno solo)
      const ordinePorta = D.mescola([0, 1, 2]);
      const porta = {
        simboli: ordinePorta.map((k) => simboli[k]),
        soluzione: ordinePorta.map((k) => enigmi[k].premio.cifra).join(''),
        di: this.prossimo(), risolta: false, risoltaDa: null, tentativi: [],
        lucchetto: { tipo: 'cifre', n: 3 },
      };
      stanze.push({ ...base, enigmi, porta });
    }
    return stanze;
  }

  // chi vede una parte: il suo giocatore, o (se è uscito) il primo compagno ancora in partita dopo di lui
  vedeChi(di) {
    for (let k = 0; k < this.n; k++) { const p = (di + k) % this.n; if (!this.fuori[p]) return p; }
    return di;
  }
  ora() { return this.pausaDal || Date.now(); }
  restaMs() { return this.aTempo ? Math.max(0, this.fineAlle - this.ora()) : null; }
  // tempo passato (senza le pause delle dispense) + le penalità
  trascorsoMs() { return Math.max(0, this.ora() - this.inizio - this.pausaTot) + this.penalita; }
  get attuale() { return this.stanze[this.stanza]; }

  penalizza(ms) {
    this.penalita += ms;
    if (this.aTempo) this.fineAlle -= ms;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!Number.isInteger(p) || p < 0 || p >= this.n) return { errore: 'Posto non valido' };
    if (this.inAttesa) return { errore: 'La porta si sta aprendo…' };
    if (this.pausaDal) return { errore: 'Partita in pausa' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    const st = this.attuale;
    const qualePorta = a.enigma === 'porta';
    const e = qualePorta ? null : Number.isInteger(a.enigma) ? st.enigmi[a.enigma] : null;
    if (!qualePorta && !e) return { errore: 'Enigma non valido' };
    if (a.tipo === 'aiuto') {
      if (qualePorta) return { errore: 'Per la porta non ci sono aiuti: chiedete a chi vede i simboli sopra la porta' };
      if (e.risolto) return { errore: 'Questo è già aperto' };
      if (e.aiutiVisti >= e.aiuti.length) return { errore: 'Gli aiuti di questo enigma sono finiti' };
      e.aiutiVisti++;
      this.aiutiUsati++;
      this.penalizza(PENA_AIUTO);
      this.annuncia(p, `chiede un aiuto per «${e.titolo}» (−1:00)`, `hai chiesto un aiuto per «${e.titolo}» (−1:00)`);
      return { ok: true };
    }
    if (a.tipo !== 'prova') return { errore: 'Mossa non valida' };
    const ora = Date.now();
    if (ora - this.ultimaProva[p] < ATTESA_PROVA) return { errore: 'Piano: un tentativo alla volta!' };
    if (qualePorta) {
      const porta = st.porta;
      if (porta.risolta) return { errore: 'La porta è già aperta' };
      if (st.enigmi.some((x) => !x.risolto)) return { errore: 'Vi mancano ancora dei frammenti: aprite prima tutti e tre gli enigmi' };
      const v = pulisci(porta.lucchetto, a.valore);
      if (v == null) return { errore: 'Servono 3 cifre' };
      this.ultimaProva[p] = ora;
      if (v === porta.soluzione) return this.apriPorta(p);
      porta.tentativi = [...porta.tentativi, { posto: p, valore: v }].slice(-3);
      this.sbagliato(p, 'la porta', PENA_ERRORE);
      return { ok: true };
    }
    if (e.risolto) return { errore: 'Questo è già aperto' };
    const v = pulisci(e.lucchetto, a.valore);
    if (v == null) return { errore: messaggioFormato(e.lucchetto) };
    this.ultimaProva[p] = ora;
    if (v === e.soluzione) {
      e.risolto = true; e.risoltoDa = p;
      this.annuncia(p, `apre «${e.titolo}»! Dentro c'è un frammento: ${e.premio.simbolo} ${e.premio.cifra}`, `hai aperto «${e.titolo}»! Dentro c'è un frammento: ${e.premio.simbolo} ${e.premio.cifra}`, true);
      return { ok: true, aperto: true };
    }
    e.tentativi = [...e.tentativi, { posto: p, valore: v }].slice(-3);
    this.sbagliato(p, `«${e.titolo}»`, PENA_ERRORE * (e.penalita || 1));
    return { ok: true };
  }

  sbagliato(p, cosa, ms) {
    this.errori++;
    this.penalizza(ms);
    const meno = `−${tempo(ms)}`;
    this.annuncia(p, `prova ${cosa}: sbagliato! (${meno})`, `sbagliato! (${meno})`);
    if (this.aTempo && this.restaMs() <= 0) this.perdi();
  }

  apriPorta(p) {
    const st = this.attuale;
    st.porta.risolta = true; st.porta.risoltaDa = p;
    if (this.stanza + 1 >= this.nStanze) return this.vinci(p);
    this.inAttesa = true;
    this.pausaMs = PAUSA_PORTA;
    this.annuncia(p, `apre la porta! 🚪 Avanti: ${this.stanze[this.stanza + 1].nome}`, `hai aperto la porta! 🚪 Avanti: ${this.stanze[this.stanza + 1].nome}`, true);
    return { ok: true, aperto: true };
  }

  avanza() {
    if (!this.inAttesa || this.finita) return;
    this.inAttesa = false;
    this.stanza++;
  }

  vinci(p) {
    this.finita = true; this.vinto = true; this.inAttesa = false;
    const ms = this.trascorsoMs();
    this.tempoFinale = ms;
    const tutti = Array.from({ length: this.n }, (_, i) => i);
    this.risultato = {
      fazioni: [{ posti: tutti, punti: Math.round(ms / 1000) }], etichetta: 'secondi', crescente: true,
      pareggio: false, vincitori: tutti,
      titolo: `Siete fuggiti in ${tempo(ms)}! 🎉`,
    };
    this.annuncia(p, 'apre l\'ultima porta: SIETE LIBERI! 🎉', 'hai aperto l\'ultima porta: SIETE LIBERI! 🎉', true);
    return { ok: true, aperto: true };
  }

  perdi() {
    if (this.finita) return;
    this.finita = true; this.vinto = false; this.inAttesa = false;
    const aperti = this.stanze.reduce((s, st) => s + st.enigmi.filter((e) => e.risolto).length + (st.porta.risolta ? 1 : 0), 0);
    this.risultato = {
      fazioni: [{ posti: Array.from({ length: this.n }, (_, i) => i), punti: aperti }], etichetta: 'lucchetti aperti',
      pareggio: false, vincitori: [], titolo: '⏰ Tempo scaduto: siete rimasti chiusi dentro!',
    };
    this.annuncia(null, '⏰ Tempo scaduto! Le luci si spengono…', '', true);
  }

  // orologio: il server richiama controllaTempo allo scadere
  scadenza() { return this.aTempo && !this.finita && !this.pausaDal ? this.fineAlle : null; }
  controllaTempo() {
    if (!this.aTempo || this.finita || this.pausaDal) return false;
    if (Date.now() < this.fineAlle) return false;
    this.perdi();
    return true;
  }
  // qualcuno è sulle dispense: l'orologio si ferma per tutti
  impostaPausa(si) {
    if (this.finita) return;
    if (si && !this.pausaDal) this.pausaDal = Date.now();
    else if (!si && this.pausaDal) {
      const d = Date.now() - this.pausaDal;
      this.pausaTot += d;
      if (this.aTempo) this.fineAlle += d;
      this.pausaDal = null;
    }
  }

  esce(p) { if (p >= 0 && p < this.n) this.fuori[p] = true; }
  rientra(p) { if (p >= 0 && p < this.n) this.fuori[p] = false; }
  salta() {}

  // il trucco segreto (!win): la soluzione del primo lucchetto ancora chiuso
  suggerimentoWin() {
    if (this.finita || this.inAttesa) return null;
    const st = this.attuale;
    const e = st.enigmi.find((x) => !x.risolto);
    if (e) return `🔓 ${e.titolo}: ${leggibile(e.lucchetto, e.soluzione)}`;
    return `🚪 La porta: ${st.porta.soluzione}`;
  }

  vistaParte(pt, posto, aperto) {
    const chi = this.vedeChi(pt.di);
    const vedo = aperto || chi === posto;
    return { titolo: pt.titolo, icona: pt.icona, chi, blocchi: vedo ? pt.blocchi : null };
  }

  vista(posto) {
    const st = this.attuale;
    const fine = this.finita;
    const enigmi = st.enigmi.map((e, i) => ({
      i, tipo: e.tipo, icona: e.icona, titolo: e.titolo, testo: e.testo, lucchetto: e.lucchetto,
      risolto: e.risolto, risoltoDa: e.risoltoDa, premio: e.risolto ? e.premio : null,
      parti: e.parti.map((pt) => this.vistaParte(pt, posto, e.risolto || fine)),
      aiuti: e.aiuti.slice(0, e.aiutiVisti), aiutiTot: e.aiuti.length,
      tentativi: e.tentativi,
      soluzione: e.risolto || fine ? leggibile(e.lucchetto, e.soluzione) : null,
    }));
    const pv = st.porta;
    const chiPorta = this.vedeChi(pv.di);
    return {
      gioco: this.id, n: this.n, turno: null, finita: fine, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      tema: { id: this.temaId, nome: this.tema.nome, emoji: this.tema.emoji, intro: this.tema.intro, fine: this.vinto ? this.tema.fine : null },
      stanzaN: this.stanza, totStanze: this.nStanze,
      stanza: { nome: st.nome, emoji: st.emoji, testo: st.testo },
      prossima: this.inAttesa ? { nome: this.stanze[this.stanza + 1].nome, emoji: this.stanze[this.stanza + 1].emoji } : null,
      enigmi,
      porta: {
        chi: chiPorta, simboli: chiPorta === posto || pv.risolta || fine ? pv.simboli : null,
        risolta: pv.risolta, risoltaDa: pv.risoltaDa, tentativi: pv.tentativi, pronta: st.enigmi.every((e) => e.risolto),
        soluzione: pv.risolta || fine ? pv.soluzione : null,
      },
      frammenti: st.enigmi.filter((e) => e.risolto).map((e) => e.premio),
      aTempo: this.aTempo, ritmo: this.ritmo, restaMs: this.restaMs(), trascorsoMs: this.trascorsoMs(), inPausa: !!this.pausaDal,
      errori: this.errori, aiutiUsati: this.aiutiUsati, penaErrore: PENA_ERRORE, penaAiuto: PENA_AIUTO,
      fuori: this.fuori, vinto: !!this.vinto,
      risultato: this.risultato, evento: this.evento,
    };
  }
}

function messaggioFormato(l) {
  if (l.tipo === 'cifre') return `Servono ${l.n} cifre`;
  if (l.tipo === 'parola') return `Servono ${l.n} lettere`;
  if (l.tipo === 'leve') return 'Imposta tutte le leve';
  if (l.tipo === 'frecce') return `Servono ${l.n} frecce`;
  if (l.tipo === 'colori') return `Servono ${l.n} tasti`;
  if (l.tipo === 'filo') return 'Scegli un filo';
  return 'Combinazione non valida';
}
// la soluzione come la si legge (frecce, leve e colori in simboli)
function leggibile(l, s) {
  if (l.tipo === 'frecce') return [...s].map((c) => ({ U: '↑', D: '↓', L: '←', R: '→' }[c])).join(' ');
  if (l.tipo === 'leve') return [...s].map((c, i) => `${i + 1}${c === '1' ? '↑' : '↓'}`).join(' ');
  if (l.tipo === 'colori') return [...s].map((c) => l.colori[Number(c)].e).join(' ');
  if (l.tipo === 'filo') return `filo ${s}`;
  return s;
}

module.exports = {
  meta: {
    id: 'escape',
    nome: 'Escape Room',
    tipo: 'tabellone',
    giocatori: [1, 2, 3, 4, 5, 6],
    soloPersone: true,
    pausaBoss: true,
    descrizione: 'Chiusi dentro, tutti insieme contro il tempo: ognuno vede indizi diversi e per aprire lucchetti e porte bisogna parlarsi.',
    alias: ['escape', 'escape room', 'fuga dalla stanza', 'stanza chiusa', 'enigmi', 'lucchetti'],
    opzioni: [
      { id: 'tema', nome: '🗝️ Ambientazione', valori: ['caso', 'laboratorio', 'faro', 'stazione', 'scuola'], etichette: ['🎲 A sorpresa', '⚗️ Il laboratorio di Ottavio', '🗼 Il faro di Punta Nera', '🛰️ Stazione orbitale Ginestra', '🏫 Chiusi a scuola'], predefinito: 'caso' },
      { id: 'stanze', nome: '🚪 Stanze', valori: [3, 2, 4], etichette: ['3 stanze', '2 stanze (partita corta)', '4 stanze (partita lunga)'], predefinito: 3 },
      { id: 'tempo', nome: '⏱️ Tempo', valori: ['normale', 'stretto', 'rilassato'], etichette: ['12 minuti per stanza', '8 minuti per stanza (difficile)', 'Senza tempo'], predefinito: 'normale' },
    ],
    regole: [
      'Siete chiusi dentro e dovete uscire tutti insieme prima che finisca il tempo. Si gioca in squadra, da 1 a 6 persone: si vince o si perde insieme.',
      'Ogni stanza ha tre enigmi chiusi da un lucchetto (a cifre, a lettere, a leve, a frecce, un pianoforte a tasti colorati o dei fili da tagliare) e una porta per passare alla stanza dopo.',
      'Il trucco: ogni enigma è diviso in pezzi e OGNI PEZZO LO VEDE UNO SOLO di voi (chi ha il biglietto, chi vede la parete, chi ha la torcia…). Sulla scheda di ogni enigma c\'è scritto chi ha gli altri pezzi: parlatevi in chat e mettete insieme le informazioni.',
      'Chiunque può provare una combinazione. Un tentativo sbagliato costa 20 secondi (tagliare il filo sbagliato 40), e sotto il lucchetto restano gli ultimi tentativi, così sapete già cosa non funziona.',
      'Bloccati? «💡 Aiuto» dà un suggerimento a tutti, ma costa 1 minuto. Ogni enigma ha due aiuti.',
      'Ogni enigma aperto contiene un frammento con un simbolo e una cifra. Sopra la porta ci sono tre simboli in fila, ma li vede uno solo di voi: mettete le cifre dei frammenti nell\'ordine dei simboli e la porta si apre.',
      'Gli enigmi cambiano a ogni partita (colori, numeri, parole e regole sono sempre diversi). Quattro ambientazioni: il laboratorio di un inventore, un faro nella tempesta, una stazione spaziale e la scuola di notte.',
      'Da soli si vedono tutti i pezzi. Se qualcuno esce dalla partita, i suoi pezzi passano a un compagno. Se qualcuno apre le dispense l\'orologio si ferma per tutti.',
    ],
  },
  crea: (o) => new EscapeRoom(o),
  _test: { pulisci, leggibile, tempo, PENA_ERRORE, PENA_AIUTO, ATTESA_PROVA },
};
