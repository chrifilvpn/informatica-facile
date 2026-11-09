// GIOCO DELL'OCA: percorso a spirale di 63 caselle, si tirano due dadi e si avanza della somma.
// Caselle speciali classiche: le oche (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59) fanno avanzare ancora dello
// stesso numero; il ponte (6) porta al 12; la locanda (19) fa stare fermi un turno (o tre); il pozzo (31) e la
// prigione (52) tengono fermi finché un altro giocatore non ci arriva a liberare; il labirinto (42) fa tornare al 39;
// lo scheletro (58) fa ricominciare da capo. Al 63 si arriva col numero esatto: i punti in più si fanno all'indietro.
// Al primo tiro, chi fa 9 con 6 e 3 va al 26, chi fa 9 con 5 e 4 va al 53 (altrimenti rimbalzerebbe di oca in oca
// fino alla fine).
// A SQUADRE (4 o 6 giocatori): squadre di due, compagni uno di fronte all'altro. Vince la squadra che porta al 63
// tutte e due le pedine; chi è già arrivato tira i dadi per il compagno. Tra compagni non ci si manda via dalla
// casella, e chi arriva nel pozzo o in prigione dove c'è il compagno lo libera (come tutti).
const FINE = 63;
const OCHE = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
const PONTE = 6, LOCANDA = 19, POZZO = 31, LABIRINTO = 42, PRIGIONE = 52, SCHELETRO = 58;
const dado = () => 1 + Math.floor(Math.random() * 6);
const T = require('../giochi/trucco');

// dove arriva la pedina partendo da "da" con i dadi (stesse regole di tira, senza scrivere niente): serve al trucco
function arrivo(da, dadi, primoTiro) {
  const s = dadi[0] + dadi[1];
  if (primoTiro && da === 0 && s === 9) return Math.max(...dadi) === 6 ? 26 : 53;
  let c = da, dir = 1;
  const cammina = (k) => { for (let i = 0; i < k; i++) { if (c === FINE) dir = -1; c += dir; } };
  cammina(s);
  for (let giro = 0; giro < 20 && c !== FINE && OCHE.has(c); giro++) cammina(s);
  if (c === PONTE) return 12;
  if (c === LABIRINTO) return 39;
  if (c === SCHELETRO) return 0;
  return c;
}
// quanto vale arrivare sulla casella c (il 63 vince; locanda, pozzo e prigione fanno perdere tempo)
const valoreCasella = (c) => (c === FINE ? 1000 : c === POZZO || c === PRIGIONE ? c - 25 : c === LOCANDA ? c - 8 : c);

class Oca {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'oca';
    this.n = n;
    this.scambio = opzioni.scambio !== 'no';
    this.locanda = Number(opzioni.locanda) === 3 ? 3 : 1;
    this.aSquadre = opzioni.squadre === 'si' && (n === 4 || n === 6);
    // squadra di ogni posto: i compagni sono uno di fronte all'altro (0-2 e 1-3; con 6: 0-3, 1-4, 2-5)
    this.squadra = Array.from({ length: n }, (_, i) => (this.aSquadre ? i % (n / 2) : i));
    this.pos = new Array(n).fill(0);
    this.fermo = new Array(n).fill(0);           // turni da saltare (locanda)
    this.bloccato = new Array(n).fill(null);     // 'pozzo' | 'prigione' | null
    this.tiri = new Array(n).fill(0);
    this.turno = primo % n;
    this.dadi = null; this.nTiro = 0;
    this.ultimo = null;   // l'ultimo tiro: { n, posto, dadi, passi: [{ c, salto }], spostati: [{ posto, da, a }], righe: [testi] }
    this.saltati = [];    // chi ha saltato il turno prima di questo (per il messaggio)
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = 1000;
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Un attimo: la pedina sta camminando…' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || a.tipo !== 'tira') return { errore: 'Mossa non valida' };
    return this.tira(p, T.consuma(this, p) ? this.dadiMigliori(p) : T.sfortuna(this, p) ? this.dadiMigliori(p, true) : [dado(), dado()]);
  }
  // il trucco segreto (!win): i dadi che portano più avanti (o dritti al 63), evitando pozzo, prigione e locanda
  // con `peggiori` (il trucco !lose) i dadi che portano nella casella peggiore
  dadiMigliori(chi, peggiori = false) {
    const p = this.pedina(chi);
    let best = null, bv = -Infinity;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
      let v = valoreCasella(arrivo(this.pos[p], [a, b], this.tiri[p] === 0)) + Math.random() * 0.5;
      if (peggiori) v = -v;
      if (v > bv) { bv = v; best = [a, b]; }
    }
    return best;
  }
  compagno(p) { return this.aSquadre ? (p + this.n / 2) % this.n : p; }
  // la pedina che muove chi è di turno: la sua, o quella del compagno se la sua è già arrivata
  pedina(p) { return this.aSquadre && this.pos[p] === FINE ? this.compagno(p) : p; }

  // il tiro: cammino casella per casella, poi gli effetti delle caselle speciali (anche a catena)
  tira(chi, dadi) {
    const p = this.pedina(chi); // da qui in poi p è la pedina che si muove
    const s = dadi[0] + dadi[1];
    const passi = [], righe = [];
    const da = this.pos[p];
    let c = da, dir = 1, testoForte = null;
    const cammina = (k) => {
      for (let i = 0; i < k; i++) {
        if (c === FINE) dir = -1; // rimbalzo sul 63
        c += dir;
        passi.push({ c, salto: false });
      }
    };
    const salta = (dove) => { c = dove; passi.push({ c, salto: true }); };
    if (p !== chi) righe.push('tira per il compagno');
    righe.push(`${dadi[0]} + ${dadi[1]} = ${s}`);
    if (this.tiri[p] === 0 && da === 0 && s === 9) {
      const alto = Math.max(...dadi);
      salta(alto === 6 ? 26 : 53);
      righe.push(`9 al primo tiro con ${alto === 6 ? '6 e 3' : '5 e 4'}: vola al ${c}!`);
      testoForte = [`fa 9 al primo tiro e vola al ${c}! 🪽`, `hai fatto 9 al primo tiro: voli al ${c}! 🪽`];
    } else {
      cammina(s);
      if (c < da + s && dir === -1) righe.push(`rimbalza sul 63 e torna al ${c}`);
    }
    this.tiri[p]++;
    // effetti delle caselle (le oche possono andare a catena)
    for (let giro = 0; giro < 20; giro++) {
      if (c === FINE) break;
      if (OCHE.has(c)) {
        righe.push(`oca al ${c}: ${dir === 1 ? 'avanti' : 'indietro'} di altri ${s}`);
        const prima = c;
        cammina(s);
        if (dir === -1 && prima + s > FINE) righe.push(`rimbalza sul 63 e torna al ${c}`);
        continue;
      }
      if (c === PONTE) { salta(12); righe.push('il ponte porta al 12 🌉'); testoForte = testoForte || ['passa il ponte: va al 12 🌉', 'passi il ponte: vai al 12 🌉']; break; }
      if (c === LABIRINTO) { salta(39); righe.push('si perde nel labirinto: torna al 39 🌀'); testoForte = ['si perde nel labirinto: torna al 39 🌀', 'ti perdi nel labirinto: torni al 39 🌀']; break; }
      if (c === SCHELETRO) { salta(0); righe.push('lo scheletro! Si ricomincia da capo 💀'); testoForte = ['trova lo scheletro e ricomincia da capo! 💀', 'hai trovato lo scheletro: ricominci da capo! 💀']; break; }
      break;
    }
    this.pos[p] = c;
    const spostati = [];
    // effetti che restano: locanda, pozzo, prigione
    if (c === LOCANDA) {
      this.fermo[p] = this.locanda;
      righe.push(`si ferma alla locanda: salta ${this.locanda === 1 ? 'un turno' : '3 turni'} 🍺`);
      testoForte = testoForte || ['si ferma alla locanda 🍺', 'ti fermi alla locanda 🍺'];
    }
    if (c === POZZO || c === PRIGIONE) {
      const cosa = c === POZZO ? 'pozzo' : 'prigione';
      for (let q = 0; q < this.n; q++) if (q !== p && this.bloccato[q] === cosa) { this.bloccato[q] = null; righe.push(`libera chi era ${cosa === 'pozzo' ? 'nel pozzo' : 'in prigione'}`); }
      this.bloccato[p] = cosa;
      righe.push(cosa === 'pozzo' ? 'cade nel pozzo: resta lì finché qualcuno non arriva 🕳️' : 'finisce in prigione: resta lì finché qualcuno non arriva ⛓️');
      testoForte = cosa === 'pozzo' ? ['cade nel pozzo! 🕳️', 'sei caduto nel pozzo! 🕳️'] : ['finisce in prigione! ⛓️', 'sei finito in prigione! ⛓️'];
    }
    // casella occupata: chi c'era va dove era partito chi arriva
    if (this.scambio && c !== 0 && c !== FINE && c !== POZZO && c !== PRIGIONE && c !== da) {
      for (let q = 0; q < this.n; q++) {
        if (q === p || this.pos[q] !== c || this.squadra[q] === this.squadra[p]) continue;
        this.pos[q] = da;
        if (this.bloccato[q]) this.bloccato[q] = null;
        this.fermo[q] = 0;
        spostati.push({ posto: q, da: c, a: da });
      }
      if (spostati.length) righe.push(`casella occupata: ${spostati.length === 1 ? 'l\'altro va' : 'gli altri vanno'} al ${da}`);
    }
    this.dadi = dadi; this.nTiro++;
    this.ultimo = { n: this.nTiro, posto: p, chi, da, dadi, passi, spostati, righe };
    if (c === FINE && this.aSquadre && this.pos[this.compagno(p)] !== FINE) {
      righe.push('arriva al 63! Ora si tira per il compagno');
      this.annuncia(chi, p === chi ? 'arriva al 63! Ora tira per il compagno 🏁' : 'porta il compagno al 63! 🏁', p === chi ? 'sei arrivato al 63! Ora tiri per il compagno 🏁' : 'hai portato il compagno al 63! 🏁', true);
    } else if (c === FINE) {
      righe.push(this.aSquadre ? 'tutta la squadra è al 63: ha vinto! 🏆' : 'arriva al 63: ha vinto! 🏆');
      if (this.aSquadre) this.annuncia(chi, 'porta la squadra al 63 e vince! 🏆', 'tutta la tua squadra è al 63: avete vinto! 🏆', true);
      else this.annuncia(p, 'arriva al 63 e vince! 🏆', 'sei arrivato al 63: hai vinto! 🏆', true);
      return this.chiudi(p);
    }
    if (testoForte) this.annuncia(p, testoForte[0], testoForte[1]);
    // la pausa lascia camminare la pedina prima del turno dopo
    const nPassi = passi.filter((x) => !x.salto).length, nSalti = passi.length - nPassi;
    this.inAttesa = true;
    this.pausaMs = Math.min(9000, 900 + nPassi * 190 + nSalti * 650 + (spostati.length ? 600 : 0));
    return { ok: true };
  }
  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    this.prossimo();
  }
  // il turno passa al prossimo che può tirare: chi è alla locanda salta, chi è nel pozzo o in prigione aspetta
  prossimo() {
    this.saltati = [];
    if (this.bloccato.every((b, i) => b || this.pos[i] === FINE)) {
      // tutti bloccati (si può solo in due): si liberano tutti, altrimenti la partita non finirebbe mai
      this.bloccato.fill(null);
      this.annuncia(null, 'Tutti bloccati: si liberano tutti! 🔓', '');
    }
    let q = this.turno;
    for (let k = 0; k < this.n * 4; k++) {
      q = (q + 1) % this.n;
      const m = this.pedina(q); // conta la pedina che muoverebbe (la propria, o quella del compagno)
      if (this.pos[m] === FINE) continue;
      if (this.bloccato[m]) { this.saltati.push({ posto: q, perche: this.bloccato[m] }); continue; }
      if (this.fermo[m] > 0) { this.fermo[m]--; this.saltati.push({ posto: q, perche: 'locanda' }); continue; }
      this.turno = q;
      return;
    }
    this.turno = (this.turno + 1) % this.n; // non succede: qualcuno libero c'è sempre
  }
  chiudi(v) {
    this.finita = true; this.turno = null; this.inAttesa = false;
    if (this.aSquadre) {
      // per squadra: le caselle delle due pedine sommate
      const fazioni = [];
      for (let t = 0; t < this.n / 2; t++) fazioni.push({ posti: [t, t + this.n / 2], punti: this.pos[t] + this.pos[t + this.n / 2] });
      this.risultato = { fazioni, etichetta: 'caselle', pareggio: false, vincitori: fazioni[this.squadra[v]].posti };
    } else this.risultato = { fazioni: this.pos.map((x, i) => ({ posti: [i], punti: x })), etichetta: 'casella', pareggio: false, vincitori: [v] };
    return { ok: true };
  }
  vista() {
    return {
      gioco: this.id, n: this.n, pos: this.pos, fermo: this.fermo, bloccato: this.bloccato, dadi: this.dadi, nTiro: this.nTiro,
      ultimo: this.ultimo, saltati: this.saltati, locanda: this.locanda, primoTiro: this.tiri.map((t) => t === 0),
      aSquadre: this.aSquadre, squadra: this.squadra, pedina: this.turno == null ? null : this.pedina(this.turno),
      turno: this.turno, finita: this.finita, risultato: this.risultato, evento: this.evento, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
    };
  }
}

module.exports = {
  meta: {
    id: 'oca',
    nome: 'Gioco dell\'oca',
    tipo: 'tabellone',
    giocatori: [2, 3, 4, 5, 6],
    senzaLivelli: true,
    descrizione: 'Il percorso a spirale di 63 caselle con le oche, il ponte, la locanda, il pozzo, il labirinto, la prigione e lo scheletro. Tira i dadi e arriva per primo al 63!',
    alias: ['oca', 'gioco dell oca', 'spirale', 'dadi', 'percorso', '63'],
    opzioni: [
      { id: 'scambio', nome: 'Casella occupata', valori: ['si', 'no'], etichette: ['Chi c\'era torna dove sei partito', 'Si sta insieme'], predefinito: 'si' },
      { id: 'squadre', nome: 'Squadre', valori: ['no', 'si'], etichette: ['Ognuno per sé', 'A squadre di due (con 4 o 6 giocatori)'], predefinito: 'no' },
      { id: 'locanda', nome: 'Locanda', valori: [1, 3], etichette: ['Ferma un turno', 'Ferma tre turni'], predefinito: 1 },
    ],
    regole: [
      'Da 2 a 6 giocatori, ognuno con la sua pedina sulla partenza. A turno si tirano due dadi e si avanza lungo la spirale della somma dei due dadi. Vince chi arriva per primo alla casella 63.',
      'Le OCHE (caselle 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54 e 59): chi ci arriva avanza ancora dello stesso numero (anche più volte di fila, di oca in oca).',
      'Al primo tiro, chi fa 9 con 6 e 3 va subito al 26; chi fa 9 con 5 e 4 va al 53.',
      'Il PONTE (6) porta al 12. La LOCANDA (19) fa saltare un turno (o tre, con l\'opzione).',
      'Il POZZO (31) e la PRIGIONE (52): chi ci cade resta fermo finché un altro giocatore non ci arriva; allora il primo è libero e resta dentro il nuovo arrivato.',
      'Il LABIRINTO (42) fa tornare indietro al 39. Lo SCHELETRO (58) fa ricominciare dalla partenza.',
      'Al 63 si deve arrivare col numero esatto: i punti in più si contano all\'indietro (se così si finisce su un\'oca, si va indietro ancora).',
      'Casella occupata (opzione, attiva di solito): se arrivi dove c\'è già un altro giocatore, lui torna nella casella da cui sei partito tu. Non vale per la partenza, il pozzo e la prigione.',
      'A SQUADRE (con 4 o 6 giocatori): squadre di due, i compagni seduti uno di fronte all\'altro. Vince la squadra che porta al 63 tutte e due le pedine: chi arriva prima continua a tirare i dadi per il compagno. Tra compagni non ci si manda via dalla casella.',
      'Al tuo turno premi "Tira i dadi" (o la barra spaziatrice) e guarda la pedina camminare. Nel gioco dell\'oca decide solo la fortuna: il computer tira i dadi come tutti.',
    ],
  },
  crea: (o) => new Oca(o),
  bot: () => ({ tipo: 'tira' }),
  _test: { OCHE, FINE, arrivo },
};
