// NON T'ARRABBIARE (la versione italiana del "Mensch ärgere dich nicht"): percorso di 40 caselle a croce, ogni
// colore ha 4 pedine nella sua casa (angolo), una casella di partenza e 4 caselle di arrivo verso il centro.
// Si esce dalla casa solo col 6; col 6 si tira ancora; chi finisce su una pedina avversaria la manda a casa;
// le pedine entrano nelle caselle di arrivo dopo un giro completo (senza scavalcare le proprie pedine già arrivate).
// Vince chi porta per primo tutte le pedine nelle caselle di arrivo.
//
// Posizioni delle pedine (relative al proprio colore): -1 = in casa, 0..39 = sul percorso (0 = casella di partenza),
// 40..43 = caselle di arrivo. La casella assoluta del percorso è (10 × colore + posizione) % 40.
const GIRO = 40;
const ARRIVO = 40;            // prima casella di arrivo
const ULTIMA = 43;            // ultima casella di arrivo
const COLORI = ['rosso', 'blu', 'giallo', 'verde'];
const NOMI_COLORE = ['rosso', 'blu', 'giallo', 'verde'];
const PAUSA_NIENTE = 1100;    // pausa quando un tiro non permette nessuna mossa
const dado = () => 1 + Math.floor(Math.random() * 6);
const T = require('../giochi/trucco');
const assoluta = (colore, rel) => (colore * 10 + rel) % GIRO;

// colori usati a seconda del numero di giocatori (in due ci si mette di fronte)
const coloriPer = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

class Ludo {
  constructor({ n, primo = 0, opzioni = {}, bot = [] }) {
    this.id = 'ludo';
    this.n = n;
    this.bot = bot;
    this.npd = [2, 3, 4].includes(Number(opzioni.pedine)) ? Number(opzioni.pedine) : 4;
    this.esatto = opzioni.esatto !== 'no';
    this.treTiri = opzioni.tretiri !== 'no';
    this.colore = coloriPer(n);
    this.pos = Array.from({ length: n }, () => new Array(this.npd).fill(-1));
    this.turno = primo % n;
    this.fase = 'tira';
    this.dado = null; this.tiroDi = null; this.nTiro = 0;
    this.tentativi = 0;       // tiri fatti in questo turno senza pedine sul percorso (massimo 3 per fare 6)
    this.mosse = [];          // mosse possibili col dado tirato: [{ k, a, mangia }]
    this.ultima = null;       // ultima mossa (per le animazioni): { n, posto, k, da, a, mangiata }
    this.nMossa = 0;
    this.passi = 0;           // lunghezza dell'ultima mossa (il computer aspetta che la pedina arrivi)
    this.mangiate = new Array(n).fill(0);
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = PAUSA_NIENTE;
  }
  // il computer aspetta che la pedina abbia finito di camminare prima di tirare
  get velocitaBot() { return this.fase === 'tira' && this.passi ? 1 + this.passi * 0.17 : 1; }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  // chi occupa la casella assoluta c del percorso: [posto, pedina] oppure null
  chiOccupa(c) {
    for (let p = 0; p < this.n; p++) for (let k = 0; k < this.npd; k++) {
      const r = this.pos[p][k];
      if (r >= 0 && r < GIRO && assoluta(this.colore[p], r) === c) return [p, k];
    }
    return null;
  }
  // dove arriverebbe la pedina k del posto p col numero d (null se non può muoversi)
  destinazione(p, k, d) {
    const r = this.pos[p][k], mie = this.pos[p];
    if (r === -1) {
      if (d !== 6) return null;
      const occ = this.chiOccupa(assoluta(this.colore[p], 0));
      return occ && occ[0] === p ? null : 0;
    }
    let t = r + d;
    if (t >= ARRIVO) {
      // nelle caselle di arrivo non si scavalcano le proprie pedine
      const libera = (s) => !mie.some((x, j) => j !== k && x === s);
      const da = Math.max(r + 1, ARRIVO);
      if (t > ULTIMA) {
        if (this.esatto) return null;
        t = ULTIMA; // senza numero esatto la pedina si ferma più avanti che può
      }
      let fin = da - 1;
      for (let s = da; s <= t && libera(s); s++) fin = s;
      if (fin < da) return null;
      if (fin !== t && this.esatto) return null;
      return fin;
    }
    const occ = this.chiOccupa(assoluta(this.colore[p], t));
    if (occ && occ[0] === p) return null;
    return t;
  }
  // mosse possibili con le regole classiche: col 6 si esce se si può; la casella di partenza va liberata
  mossePossibili(p, d) {
    const tutte = [];
    for (let k = 0; k < this.npd; k++) {
      const a = this.destinazione(p, k, d);
      if (a === null) continue;
      let mangia = null;
      if (a < GIRO) { const occ = this.chiOccupa(assoluta(this.colore[p], a)); if (occ && occ[0] !== p) mangia = occ; }
      tutte.push({ k, da: this.pos[p][k], a, mangia });
    }
    const inCasa = this.pos[p].some((r) => r === -1);
    if (d === 6 && inCasa) {
      const uscite = tutte.filter((m) => m.da === -1);
      if (uscite.length) return uscite;
    }
    if (inCasa) {
      const suPartenza = tutte.filter((m) => m.da === 0);
      if (suPartenza.length) return suPartenza;
    }
    return tutte;
  }
  sulPercorso(p) { return this.pos[p].some((r) => r >= 0 && r < GIRO); }
  arrivate(p) { return this.pos[p].filter((r) => r >= ARRIVO).length; }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Un attimo…' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (a.tipo === 'tira') {
      if (this.fase !== 'tira') return { errore: 'Prima muovi una pedina' };
      return this.tira(p);
    }
    if (a.tipo === 'muovi') {
      if (this.fase !== 'muovi') return { errore: 'Prima tira il dado' };
      const k = Number(a.pedina);
      if (!Number.isInteger(k) || k < 0 || k >= this.npd) return { errore: 'Pedina non valida' };
      const m = this.mosse.find((x) => x.k === k);
      if (!m) return { errore: 'Quella pedina non può muoversi: scegli una pedina evidenziata' };
      return this.muovi(p, m);
    }
    return { errore: 'Mossa non valida' };
  }
  // il trucco segreto (!win): il numero che permette la mossa migliore (mangiare, uscire col 6, entrare all'arrivo…)
  // con `peggiore` (il trucco !lose) il dado che serve di meno
  dadoMigliore(p, peggiore = false) {
    let best = dado(), bv = -Infinity;
    for (let d = 1; d <= 6; d++) {
      const mosse = this.mossePossibili(p, d);
      let v = mosse.length ? Math.max(...mosse.map((m) => valutaMossa(this, p, m) + (m.mangia ? 40 : 0) + (m.a >= ARRIVO && m.da < ARRIVO ? 25 : 0))) : -1e6;
      if (d === 6) v += 15; // col 6 si tira ancora
      v += Math.random() * 0.01;
      if (peggiore) v = -v;
      if (v > bv) { bv = v; best = d; }
    }
    return best;
  }
  tira(p) {
    const d = T.consuma(this, p) ? this.dadoMigliore(p) : T.sfortuna(this, p) ? this.dadoMigliore(p, true) : dado();
    this.dado = d; this.tiroDi = p; this.nTiro++; this.passi = 0;
    const senzaPercorso = !this.sulPercorso(p);
    if (senzaPercorso) this.tentativi++;
    this.mosse = this.mossePossibili(p, d);
    if (this.mosse.length) { this.fase = 'muovi'; return { ok: true }; }
    // nessuna mossa: col 6 si ritira; senza pedine sul percorso si hanno 3 tentativi per fare 6
    // (niente annunci: il messaggio accanto al dado lo dice già)
    if (d === 6) return { ok: true };
    if (senzaPercorso && this.treTiri && this.tentativi < 3) return { ok: true };
    this.fase = 'passa'; this.inAttesa = true; this.pausaMs = PAUSA_NIENTE;
    return { ok: true };
  }
  muovi(p, m) {
    const da = this.pos[p][m.k];
    this.pos[p][m.k] = m.a;
    let mangiata = null;
    if (m.mangia) {
      const [q, j] = m.mangia;
      mangiata = { posto: q, k: j, da: this.pos[q][j] };
      this.pos[q][j] = -1;
      this.mangiate[p]++;
      this.annuncia(p, `manda a casa una pedina di @! 💥`, 'hai mandato a casa una pedina di @! 💥');
      this.evento.bersaglio = q;
      this.evento.testoTe = 'ti ha mandato a casa una pedina! 😤';
    }
    this.passi = da === -1 ? 1 : m.a - da;
    this.ultima = { n: ++this.nMossa, posto: p, k: m.k, da, a: m.a, mangiata };
    this.mosse = [];
    if (this.arrivate(p) === this.npd) return this.chiudi(p);
    if (this.dado === 6) { this.fase = 'tira'; this.tentativi = 0; return { ok: true }; }
    this.passaTurno();
    return { ok: true };
  }
  passaTurno() {
    this.turno = (this.turno + 1) % this.n;
    this.fase = 'tira'; this.tentativi = 0; this.mosse = [];
  }
  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    this.passi = 0;
    this.passaTurno();
  }
  chiudi(v) {
    this.finita = true; this.turno = null; this.fase = 'finita'; this.inAttesa = false;
    this.annuncia(v, 'porta a casa tutte le pedine e vince! 🏆', 'hai portato tutte le pedine all\'arrivo: hai vinto! 🏆', true);
    // punti: pedine arrivate; a parità conta quanta strada hanno fatto (per la classifica)
    this.risultato = {
      fazioni: Array.from({ length: this.n }, (_, p) => ({ posti: [p], punti: this.arrivate(p) })),
      etichetta: 'pedine arrivate', pareggio: false, vincitori: [v],
    };
    return { ok: true };
  }
  vista() {
    return {
      gioco: this.id, n: this.n, npd: this.npd, colore: this.colore, pos: this.pos, fase: this.fase,
      dado: this.dado, tiroDi: this.tiroDi, nTiro: this.nTiro, tentativi: this.tentativi, treTiri: this.treTiri, esatto: this.esatto,
      mosse: this.fase === 'muovi' ? this.mosse.map((m) => ({ k: m.k, a: m.a, mangia: !!m.mangia })) : [],
      ultima: this.ultima, mangiate: this.mangiate, arrivate: this.pos.map((_, p) => this.arrivate(p)),
      turno: this.turno, finita: this.finita, risultato: this.risultato, evento: this.evento, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
    };
  }
}

// =================== COMPUTER ===================
// Probabilità che una pedina sulla casella assoluta c venga mangiata al prossimo giro degli avversari:
// chi sta da 1 a 6 caselle dietro la prende con 1/6, da 7 a 12 con un 6 e poi il resto (circa 1/36);
// chi ha pedine in casa la prende col 6 se c è la sua casella di partenza.
function pericolo(n, colore, pos, p, c) {
  let rischio = 0;
  for (let q = 0; q < n; q++) {
    if (q === p) continue;
    const col = colore[q];
    let casa = false;
    for (const r of pos[q]) {
      if (r === -1) { casa = true; continue; }
      if (r >= GIRO) continue;
      const dist = (c - assoluta(col, r) + GIRO) % GIRO;
      if (dist === 0 || r + dist > GIRO - 1) continue; // dovrebbe superare il suo arrivo
      if (dist <= 6) rischio += 1 / 6;
      else if (dist <= 12) rischio += 1 / 36;
    }
    if (casa && c === assoluta(col, 0)) rischio += 1 / 6;
  }
  return Math.min(rischio, 0.9);
}
// quanto "vale" la situazione di un giocatore: strada fatta dalle pedine, meno quella che rischiano di perdere
// pesi trovati con migliaia di partite di prova: la strada vale sempre di più verso la fine (KQ), entrare
// nell'arrivo vale un bonus (KA) e conviene andare in fondo (KS: una pedina ferma all'ingresso blocca le altre);
// il rischio di essere mangiati pesa KR volte il valore della pedina, gli avversari KO
const KQ = 1.5, KS = 10, KA = 20, KR = 0.7, KO = 1;
const vPerc = (r) => 12 + r + KQ * r * r / 40;
const valorePedina = (r) => (r === -1 ? 0 : r >= ARRIVO ? vPerc(39) + KA + (r - ARRIVO) * KS : vPerc(r));
function valoreGiocatore(n, colore, pos, q) {
  let v = 0;
  for (const r of pos[q]) {
    v += valorePedina(r);
    if (r >= 0 && r < GIRO) v -= pericolo(n, colore, pos, q, assoluta(colore[q], r)) * valorePedina(r) * KR;
  }
  return v;
}
// valutazione della posizione dopo una mossa: il mio valore meno quello degli avversari (pesato sul più avanti)
function valutaMossa(g, p, m) {
  const pos = g.pos.map((x) => x.slice());
  pos[p][m.k] = m.a;
  if (m.mangia) pos[m.mangia[0]][m.mangia[1]] = -1;
  const val = pos.map((_, q) => valoreGiocatore(g.n, g.colore, pos, q));
  let somma = 0, max = -Infinity;
  for (let q = 0; q < g.n; q++) if (q !== p) { somma += val[q]; max = Math.max(max, val[q]); }
  return val[p] - KO * (0.5 * somma / (g.n - 1) + 0.5 * max);
}

function bot(g, p, livello) {
  if (g.fase === 'tira') return { tipo: 'tira' };
  const mosse = g.mosse;
  if (!mosse.length) return { tipo: 'tira' };
  if (mosse.length === 1) return { tipo: 'muovi', pedina: mosse[0].k };
  if (livello === 'facile') return { tipo: 'muovi', pedina: mosse[Math.floor(Math.random() * mosse.length)].k };
  if (livello === 'medio') {
    // mangia se può, altrimenti esce, altrimenti porta avanti la pedina più avanzata (ogni tanto a caso)
    if (Math.random() < 0.15) return { tipo: 'muovi', pedina: mosse[Math.floor(Math.random() * mosse.length)].k };
    const punteggio = (m) => (m.mangia ? 1000 : 0) + (m.da === -1 ? 500 : 0) + (m.a >= ARRIVO && m.da < ARRIVO ? 300 : 0) + m.da;
    return { tipo: 'muovi', pedina: mosse.reduce((x, y) => (punteggio(y) > punteggio(x) ? y : x)).k };
  }
  let meglio = mosse[0], vm = -Infinity;
  for (const m of mosse) { const v = valutaMossa(g, p, m); if (v > vm) { vm = v; meglio = m; } }
  return { tipo: 'muovi', pedina: meglio.k };
}

module.exports = {
  meta: {
    id: 'ludo',
    nome: 'Non t\'arrabbiare',
    tipo: 'tabellone',
    giocatori: [2, 3, 4],
    descrizione: 'Il classico gioco delle pedine col dado: esci col 6, fai il giro e mandi a casa gli avversari. Porta per primo tutte le pedine all\'arrivo!',
    alias: ['non t arrabbiare', 'ludo', 'mensch', 'mensch ärgere dich nicht', 'pedine', 'dado', 'percorso', 'tombola pedine'],
    opzioni: [
      { id: 'esatto', nome: 'Arrivo', valori: ['si', 'no'], etichette: ['Col numero esatto', 'Basta arrivarci'], predefinito: 'si' },
      { id: 'pedine', nome: 'Pedine', valori: [4, 3, 2], etichette: ['4 pedine a testa', '3 pedine (più veloce)', '2 pedine (velocissimo)'], predefinito: 4 },
      { id: 'tretiri', nome: 'Senza pedine in giro', valori: ['si', 'no'], etichette: ['3 tentativi per fare 6', '1 solo tentativo'], predefinito: 'si' },
    ],
    regole: [
      'Ogni giocatore ha 4 pedine (o 3, o 2 con l\'opzione) del suo colore, all\'inizio tutte nella sua casa, nell\'angolo. Si gioca a turno, in senso orario; si tira un dado.',
      'Per far uscire una pedina dalla casa serve un 6: la pedina va sulla casella di partenza del suo colore (quella colorata accanto alla casa). Col 6 si tira di nuovo, sempre.',
      'Se fai 6 e hai ancora pedine in casa devi farne uscire una (se la tua partenza non è occupata da una tua pedina). Se una tua pedina è sulla tua partenza e ne hai altre in casa, devi prima spostare quella.',
      'Le pedine girano in senso orario lungo il percorso di 40 caselle. Non puoi fermarti su una casella dove c\'è già una tua pedina, ma puoi scavalcare tutte le pedine.',
      'Se arrivi esattamente su una casella con una pedina avversaria, la "mangi": torna nella sua casa e dovrà uscire di nuovo col 6. Mangiare non è obbligatorio.',
      'Dopo un giro completo la pedina entra nelle 4 caselle di arrivo del suo colore, verso il centro. Lì non può più essere mangiata, ma non si possono scavalcare le proprie pedine.',
      'Con "Col numero esatto" (la regola classica) bisogna fare il numero giusto per entrare nell\'arrivo: se è troppo alto quella pedina non si muove. Con "Basta arrivarci" la pedina si ferma nella casella di arrivo libera più avanti.',
      'Quando non hai pedine sul percorso (sono tutte in casa o già arrivate) hai 3 tentativi per fare 6 (o uno solo, con l\'opzione). Se il dado non permette nessuna mossa, il turno passa.',
      'Al tuo turno premi "Tira il dado" (o la barra spaziatrice), poi clicca la pedina da muovere: quelle che possono muoversi sono evidenziate e passandoci sopra col mouse vedi dove arrivano. Se ce n\'è una sola si muove da sola.',
      'Vince chi porta per primo tutte le sue pedine nelle caselle di arrivo.',
      'Il computer facile muove una pedina a caso; il medio mangia quando può, altrimenti esce o porta avanti la pedina più avanzata; il difficile valuta la posizione dopo ogni mossa possibile: la strada fatta da tutti, le pedine che restano esposte (quanti avversari possono raggiungerle col prossimo tiro), le catture delle pedine più avanzate, e porta le pedine in fondo all\'arrivo per non bloccare le altre.',
    ],
  },
  crea: (o) => new Ludo(o),
  bot,
  _test: { assoluta, pericolo, valutaMossa, coloriPer, COLORI, NOMI_COLORE },
};
