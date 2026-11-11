// POMPA IL PALLONE: un pallone per round, condiviso da tutti. A turno si pompa (+1 punto nel proprio piatto, ma il
// pallone può scoppiare) oppure si incassa (i punti del piatto diventano tuoi e esci dal round).
// Il punto di scoppio è segreto e casuale: tra 1 e il massimo scelto, ogni valore con la stessa probabilità.
// Chi fa scoppiare il pallone perde il piatto del round. Vince chi, alla fine dei round, ha incassato di più.
const PAUSA_SCOPPIO = 2400;

class Pallone {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'pallone';
    this.n = n;
    this.round = [3, 5, 8].includes(Number(opzioni.round)) ? Number(opzioni.round) : 5;
    this.massimo = [12, 20, 30].includes(Number(opzioni.massimo)) ? Number(opzioni.massimo) : 20;
    this.punti = new Array(n).fill(0);
    this.nRound = 0;
    this.apre = primo % n;
    this.inAttesa = false;
    this.pausaMs = PAUSA_SCOPPIO;
    this.finita = false;
    this.risultato = null;
    this.evento = null;
    this.nEv = 0;
    this.storia = []; // per round: a quante pompate è scoppiato (o null se nessuno l'ha fatto scoppiare)
    this.nuovoRound();
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  nuovoRound() {
    this.nRound++;
    this.pompate = 0;
    this.scoppio = 1 + Math.floor(Math.random() * this.massimo); // alla pompata numero "scoppio" il pallone esplode
    this.piatto = new Array(this.n).fill(0);
    this.stato = new Array(this.n).fill('dentro'); // dentro | incassato | scoppiato
    this.scoppiato = null;
    this.fase = 'gioco';
    this.turno = this.apre;
    this.apre = (this.apre + 1) % this.n;
  }

  prossimo(da) {
    for (let k = 1; k <= this.n; k++) { const i = (da + k) % this.n; if (this.stato[i] === 'dentro') return i; }
    return null;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta il prossimo pallone…' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || !['pompa', 'incassa'].includes(a.tipo)) return { errore: 'Scegli: pompa o incassa' };
    if (a.tipo === 'incassa') {
      this.punti[p] += this.piatto[p];
      this.stato[p] = 'incassato';
      this.annuncia(p, `incassa ${this.piatto[p]} ${this.piatto[p] === 1 ? 'punto' : 'punti'} 💰`, `hai incassato ${this.piatto[p]} ${this.piatto[p] === 1 ? 'punto' : 'punti'} 💰`);
      return this.dopo(p);
    }
    this.pompate++;
    if (this.pompate >= this.scoppio) {
      this.stato[p] = 'scoppiato';
      this.scoppiato = p;
      const perso = this.piatto[p];
      this.piatto[p] = 0;
      this.annuncia(p, `fa scoppiare il pallone! 💥 (perde ${perso})`, `hai fatto scoppiare il pallone! 💥 Perdi ${perso}`, true);
      return this.fineRound();
    }
    this.piatto[p]++;
    this.annuncia(p, 'pompa… regge! 🎈', 'regge! +1 🎈');
    return this.dopo(p);
  }

  dopo(p) {
    const t = this.prossimo(p);
    if (t === null) return this.fineRound();
    this.turno = t;
    return { ok: true };
  }

  fineRound() {
    // chi non ha incassato e non ha fatto scoppiare il pallone... non esiste: il round finisce solo quando
    // tutti hanno incassato o quando il pallone scoppia. Se scoppia, chi era ancora dentro incassa da solo.
    for (let i = 0; i < this.n; i++) if (this.stato[i] === 'dentro') { this.punti[i] += this.piatto[i]; this.stato[i] = 'incassato'; }
    this.storia.push({ scoppio: this.scoppio, pompate: this.pompate, scoppiato: this.scoppiato });
    this.turno = null;
    if (this.nRound >= this.round) return this.chiudi();
    this.fase = 'scoppio';
    this.inAttesa = true;
    return { ok: true };
  }

  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    this.nuovoRound();
  }

  // il trucco segreto (!win): al suo turno gli si dice quante pompate regge ancora il pallone
  suggerimentoWin(p) {
    if (this.finita || this.inAttesa || this.fase !== 'gioco' || this.turno !== p) return null;
    const resta = this.scoppio - this.pompate - 1; // pompate che reggono ancora (di chiunque)
    if (resta <= 0) return '💡 Incassa subito: la prossima pompata lo fa scoppiare!';
    return `💡 Il pallone regge ancora ${resta} ${resta === 1 ? 'pompata' : 'pompate'}: scoppia alla ${this.scoppio}ª`;
  }

  salta(p) { if (this.turno === p) return this.azione(p, { tipo: 'incassa' }); return { ok: true }; }

  chiudi() {
    this.finita = true;
    this.inAttesa = false;
    this.fase = 'fine';
    this.turno = null;
    const max = Math.max(...this.punti);
    const vincitori = this.punti.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
    this.risultato = {
      fazioni: this.punti.map((x, i) => ({ posti: [i], punti: x })),
      etichetta: 'punti', pareggio: vincitori.length > 1, vincitori: vincitori.length > 1 ? [] : vincitori,
    };
    if (vincitori.length > 1) this.risultato.titolo = 'Pareggio';
    return { ok: true };
  }

  vista() {
    const aperto = this.fase !== 'gioco' || this.finita;
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      round: this.round, nRound: this.nRound, massimo: this.massimo, punti: this.punti, piatto: this.piatto, stato: this.stato,
      pompate: this.pompate, scoppiato: this.scoppiato, storia: this.storia,
      scoppio: aperto ? this.scoppio : null, // il punto di scoppio si scopre solo a fine round
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
// Nessuno conosce il punto di scoppio. Dopo k pompate che hanno retto, la prossima fa scoppiare con probabilità 1/(massimo-k).
function bot(g, p, livello) {
  const piatto = g.piatto[p];
  const rischio = 1 / Math.max(1, g.massimo - g.pompate);
  if (livello === 'facile') {
    // un po' a caso: incassa di solito tra 2 e 6 punti
    g._soglie = g._soglie || {};
    const chiave = `${g.nRound}-${p}`;
    if (!g._soglie[chiave]) g._soglie[chiave] = 2 + Math.floor(Math.random() * 5);
    const soglia = g._soglie[chiave];
    return { tipo: piatto >= soglia || Math.random() < 0.08 ? 'incassa' : 'pompa' };
  }
  if (livello === 'medio') return { tipo: rischio > 0.25 || piatto >= 5 ? 'incassa' : 'pompa' };
  // difficile: conviene pompare se il guadagno atteso supera la perdita attesa (1-q)·1 > q·piatto,
  // tenendo conto della classifica: se è indietro all'ultimo round rischia di più
  const ultimo = g.nRound >= g.round;
  const mioTot = g.punti[p] + piatto;
  const altri = g.punti.map((x, i) => (i === p ? -1 : x + (g.stato[i] === 'dentro' ? g.piatto[i] : 0)));
  const indietro = ultimo && Math.max(...altri) >= mioTot;
  if (indietro && rischio < 0.6) return { tipo: 'pompa' };
  return { tipo: (1 - rischio) * 1 > rischio * piatto ? 'pompa' : 'incassa' };
}

module.exports = {
  meta: {
    id: 'pallone',
    nome: 'Pompa il pallone',
    tipo: 'tabellone',
    giocatori: [2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Pompa o incassa? Ogni pompata vale un punto, ma il pallone può scoppiare da un momento all\'altro.',
    opzioni: [
      { id: 'round', nome: 'Round', valori: [5, 3, 8], etichette: ['5 palloni', '3 palloni', '8 palloni'], predefinito: 5 },
      { id: 'massimo', nome: 'Pallone', valori: [20, 12, 30], etichette: ['Normale (scoppia entro 20)', 'Fragile (entro 12)', 'Robusto (entro 30)'], predefinito: 20 },
    ],
    regole: [
      'A ogni round c\'è un pallone nuovo, lo stesso per tutti. A turno ognuno sceglie: POMPA oppure INCASSA.',
      'Pompa: il pallone si gonfia e, se regge, guadagni 1 punto nel tuo piatto del round. Poi tocca al prossimo.',
      'Incassa: i punti del tuo piatto diventano tuoi per sempre ed esci dal round; gli altri continuano a pompare senza di te.',
      'Il pallone scoppia a un numero di pompate segreto e casuale (contando le pompate di tutti), tra 1 e 20 (oppure tra 1 e 12, o tra 1 e 30, secondo il pallone scelto prima di iniziare). Tutti i numeri hanno la stessa probabilità, e il numero cambia a ogni pallone.',
      'Chi fa scoppiare il pallone perde tutto il piatto del round. Chi era ancora dentro in quel momento incassa da solo il suo piatto.',
      'Il round finisce quando il pallone scoppia o quando tutti hanno incassato. A fine round si scopre a quante pompate sarebbe scoppiato. Il round dopo apre il giocatore successivo.',
      'Dopo 5 round (o 3, o 8) vince chi ha incassato più punti. A parità è pareggio.',
      'Più pompate ha già retto il pallone, più è rischioso: in basso vedi le pompate fatte e il rischio della prossima.',
      'Il computer facile incassa un po\' a caso, il medio si ferma quando il rischio sale, il difficile fa i conti e all\'ultimo round, se è indietro, rischia.',
    ],
  },
  crea: (o) => new Pallone(o),
  bot,
  _test: { Pallone },
};
