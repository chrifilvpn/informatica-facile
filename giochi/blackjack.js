// BLACKJACK contro il banco (il banco è il computer, non occupa un posto). Da 1 a 6 giocatori.
// 6 mazzi, il banco sta su tutti i 17 (anche soft 17), blackjack pagato 3:2, niente assicurazione né resa.
// Raddoppio su due carte (anche dopo lo split), split fino a 4 mani; gli assi divisi ricevono una carta sola.
// Il banco controlla subito se ha blackjack quando mostra un asso o una figura/10.
const { Casino, scarpa, puntataBot } = require('./casino');
const T = require('./trucco');

const MAZZI = 6;
const TAGLIO = 0.25; // si rimescola quando resta meno di un quarto della scarpa
const SECONDI_DECISIONE = 30;

const valoreCarta = (c) => (c.rango === 1 ? 11 : Math.min(10, c.rango));
function conta(carte) {
  let tot = 0, assi = 0;
  for (const c of carte) { tot += valoreCarta(c); if (c.rango === 1) assi++; }
  while (tot > 21 && assi) { tot -= 10; assi--; }
  return { tot, morbida: assi > 0 };
}
const isBlackjack = (m) => m.carte.length === 2 && !m.daSplit && conta(m.carte).tot === 21;

class Blackjack extends Casino {
  constructor(o) {
    super(o);
    this.id = 'blackjack';
    this.scarpa = scarpa(MAZZI);
    this.totaleScarpa = this.scarpa.length;
    this.pausaMs = 900;
    this.apriPuntate();
    this.mani = Array.from({ length: this.n }, () => []);
    this.banco = [];
    this.coperta = true;
    this.codaTrucco = {};
    this.truccati = [];
  }

  serviBlackjack(m) {
    if (this.scarpa.length < 20) this.scarpa.unshift(...scarpa(1));
    this.scarpa.unshift(...m.carte); // le carte di prima tornano in fondo alla scarpa
    const asso = this.scarpa.findIndex((c) => c.rango === 1);
    const [a] = this.scarpa.splice(asso, 1);
    const dieci = this.scarpa.findIndex((c) => valoreCarta(c) === 10);
    const [d] = this.scarpa.splice(dieci, 1);
    m.carte = Math.random() < 0.5 ? [a, d] : [d, a];
  }

  // il trucco, versione "che non si nota": due carte normali, e le carte che arrivano chiedendo carta portano a 21 piano piano
  // (5+3+9+4, 2+A+8+10, 6+4+3+2+6…). Le carte successive aspettano in this.codaTrucco[posto], che il browser non vede.
  // Se non trova una sequenza adatta (scarpa quasi finita) serve il blackjack.
  serviVentuno(p) {
    const m = this.mani[p][0];
    if (this.scarpa.length < 20) this.scarpa.unshift(...scarpa(1));
    this.scarpa.unshift(...m.carte);
    this.ultimeTrucco = this.ultimeTrucco || [];
    const seq = sequenzaVentuno(this.scarpa, this.ultimeTrucco);
    if (!seq) { m.carte = []; this.serviBlackjack(m); return; }
    this.ultimeTrucco = [seq.map(valoreCarta).sort((x, y) => x - y).join(','), ...this.ultimeTrucco].slice(0, 12);
    for (const c of seq) this.scarpa.splice(this.scarpa.indexOf(c), 1);
    m.carte = seq.slice(0, 2);
    this.codaTrucco[p] = seq.slice(2);
  }

  // la carta per una mano: se c'è una coda del trucco si prende da lì
  pescaPer(p, m) {
    const coda = this.codaTrucco[p];
    if (coda && coda.length && this.mani[p][0] === m) return coda.shift();
    return this.pesca();
  }
  // le carte del trucco non usate (si è fermato prima, ha diviso…) tornano in fondo alla scarpa
  rendiCoda(p) {
    const coda = this.codaTrucco[p];
    if (coda && coda.length) this.scarpa.unshift(...coda);
    delete this.codaTrucco[p];
  }

  // la carta del banco: se un giocatore col trucco è arrivato a 21, il banco non ci arriva anche lui
  pescaBanco() {
    if (!this.scarpa.length) this.scarpa = scarpa(MAZZI);
    const protetto = this.truccati.some((p) => this.mani[p].some((m) => m.stato === 'stai' && conta(m.carte).tot === 21));
    if (protetto) {
      const fa21 = (c) => conta([...this.banco, c]).tot === 21;
      if (fa21(this.scarpa[this.scarpa.length - 1])) {
        const j = this.scarpa.findIndex((c) => !fa21(c));
        if (j >= 0) [this.scarpa[j], this.scarpa[this.scarpa.length - 1]] = [this.scarpa[this.scarpa.length - 1], this.scarpa[j]];
      }
    }
    return this.scarpa.pop();
  }

  pesca() {
    if (!this.scarpa.length) this.scarpa = scarpa(MAZZI);
    return this.scarpa.pop();
  }

  apriPuntate() {
    super.apriPuntate();
    this.mani = Array.from({ length: this.n }, () => []);
    this.banco = [];
    this.coperta = true;
    this.codaTrucco = {};
    this.truccati = [];
    this.esiti = null;
    this.mescolata = false;
    if (this.scarpa && this.scarpa.length < this.totaleScarpa * TAGLIO) { this.scarpa = scarpa(MAZZI); this.mescolata = true; }
  }

  azione(p, a) {
    if (!a) return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Aspetta un momento' };
    if (this.fase === 'puntate') {
      if (a.tipo === 'passa') return this.passa(p);
      if (a.tipo !== 'punta') return { errore: 'Prima fai la tua puntata' };
      if (this.puntato[p] || this.passato[p]) return { errore: 'Hai già deciso per questa mano' };
      const r = this.controllaImporto(p, a.importo);
      if (r.errore) return r;
      this.fiche[p] -= r.importo;
      this.mani[p] = [{ carte: [], puntata: r.importo, stato: 'gioca', daSplit: false }];
      this.segnaPuntata(p);
      return { ok: true };
    }
    if (this.fase !== 'turni') return { errore: 'Aspetta la prossima mano' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    const m = this.mani[p][this.manoAttiva];
    const possibili = this.azioniPossibili(p);
    if (!possibili[a.tipo]) return { errore: 'Adesso non puoi farlo' };
    if (a.tipo === 'carta') {
      m.carte.push(this.pescaPer(p, m));
      const t = conta(m.carte).tot;
      if (t > 21) { m.stato = 'sballato'; this.annuncia(p, 'sballa', 'hai sballato'); return this.prossimaMano(); }
      if (t === 21) { m.stato = 'stai'; return this.prossimaMano(); }
      return { ok: true };
    }
    if (a.tipo === 'stai') { m.stato = 'stai'; this.rendiCoda(p); return this.prossimaMano(); }
    if (a.tipo === 'raddoppia') {
      this.fiche[p] -= m.puntata;
      m.puntata *= 2;
      m.carte.push(this.pescaPer(p, m));
      this.rendiCoda(p);
      m.raddoppiata = true;
      m.stato = conta(m.carte).tot > 21 ? 'sballato' : 'stai';
      this.annuncia(p, 'raddoppia', 'raddoppi');
      return this.prossimaMano();
    }
    if (a.tipo === 'dividi') {
      this.rendiCoda(p);
      this.fiche[p] -= m.puntata;
      const [c1, c2] = m.carte;
      const assi = c1.rango === 1;
      const nuova = { carte: [c2], puntata: m.puntata, stato: 'gioca', daSplit: true, assiDivisi: assi };
      m.carte = [c1]; m.daSplit = true; m.assiDivisi = assi;
      this.mani[p].splice(this.manoAttiva + 1, 0, nuova);
      m.carte.push(this.pesca());
      nuova.carte.push(this.pesca());
      this.annuncia(p, 'divide la coppia', 'dividi la coppia');
      if (assi) { m.stato = 'stai'; nuova.stato = 'stai'; return this.prossimaMano(); } // assi divisi: una carta sola
      if (conta(m.carte).tot === 21) { m.stato = 'stai'; return this.prossimaMano(); }
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }

  azioniPossibili(p) {
    if (this.fase !== 'turni' || p !== this.turno || this.inAttesa) return {};
    const m = this.mani[p][this.manoAttiva];
    if (!m || m.stato !== 'gioca') return {};
    const due = m.carte.length === 2;
    const soldi = this.fiche[p] >= m.puntata;
    const coppia = due && valoreCarta(m.carte[0]) === valoreCarta(m.carte[1]);
    return {
      carta: true,
      stai: true,
      raddoppia: due && soldi && !m.assiDivisi,
      dividi: coppia && soldi && this.mani[p].length < 4,
    };
  }

  // ---- distribuzione ----
  gioca() {
    this.fase = 'turni';
    const inGioco = this.mani.map((m, i) => (m.length ? i : -1)).filter((i) => i >= 0);
    for (let giro = 0; giro < 2; giro++) {
      for (const i of inGioco) this.mani[i][0].carte.push(this.pesca());
      this.banco.push(this.pesca());
    }
    // il trucco segreto (!win): di rado blackjack servito, quasi sempre 21 che arriva chiedendo carta; il banco non fa 21
    const truccati = inGioco.filter((i) => T.consuma(this, i));
    this.truccati = truccati;
    for (const i of truccati) { if (Math.random() < 0.1) this.serviBlackjack(this.mani[i][0]); else this.serviVentuno(i); }
    if (truccati.length && conta(this.banco).tot === 21) { const j = this.scarpa.findIndex((c) => valoreCarta(c) <= 6); if (j >= 0) [this.banco[1], this.scarpa[j]] = [this.scarpa[j], this.banco[1]]; }
    for (const i of inGioco) if (isBlackjack(this.mani[i][0])) this.mani[i][0].stato = 'blackjack';
    // il banco controlla la carta coperta se mostra asso o 10
    if (valoreCarta(this.banco[0]) >= 10 && conta(this.banco).tot === 21) {
      this.coperta = false;
      this.annuncia(null, 'Il banco ha blackjack!', '', true);
      return this.paga();
    }
    this.ordine = inGioco;
    this.turno = null;
    this.manoAttiva = 0;
    this.prossimoGiocatore(-1);
    return { ok: true };
  }

  prossimoGiocatore(da) {
    for (const i of this.ordine) {
      if (i <= da) continue;
      const k = this.mani[i].findIndex((m) => m.stato === 'gioca');
      if (k >= 0) { this.turno = i; this.manoAttiva = k; this.inizioDecisione = Date.now(); return; }
    }
    this.turno = null;
    this.giocaBanco();
  }

  prossimaMano() {
    const p = this.turno;
    for (const m of this.mani[p]) if (m.stato === 'gioca' && conta(m.carte).tot === 21) m.stato = 'stai'; // 21 dopo lo split: ci si ferma
    const k = this.mani[p].findIndex((m) => m.stato === 'gioca');
    if (k >= 0) { this.manoAttiva = k; this.inizioDecisione = Date.now(); return { ok: true }; }
    this.prossimoGiocatore(p);
    return { ok: true };
  }

  // ---- il banco: scopre la carta e pesca una carta alla volta (con una pausa, per vederle arrivare) ----
  giocaBanco() {
    this.fase = 'banco';
    this.turno = null;
    this.coperta = false;
    this.pausaMs = 900; // una carta del banco ogni 0,9 secondi
    this.inAttesa = true;
  }
  avanza() {
    if (!this.inAttesa) return;
    if (this.fase === 'banco') {
      const vivi = this.mani.some((ms) => ms.some((m) => m.stato === 'stai'));
      if (vivi && conta(this.banco).tot < 17) { this.banco.push(this.pescaBanco()); return; }
      this.paga();
      return;
    }
    if (this.fase === 'pagamenti') { this.inAttesa = false; this.apriPuntate(); }
  }

  paga() {
    this.fase = 'pagamenti';
    this.turno = null;
    this.coperta = false;
    const b = conta(this.banco).tot;
    const bancoBJ = this.banco.length === 2 && b === 21;
    this.esiti = Array.from({ length: this.n }, () => ({ netto: 0 }));
    for (let p = 0; p < this.n; p++) {
      for (const m of this.mani[p]) {
        const t = conta(m.carte).tot;
        let ritorno = 0;
        if (m.stato === 'blackjack') { m.esito = bancoBJ ? 'pari' : 'blackjack'; ritorno = bancoBJ ? m.puntata : m.puntata + Math.floor(m.puntata * 1.5); }
        else if (m.stato === 'sballato') m.esito = 'sballato';
        else if (bancoBJ) m.esito = 'perde';
        else if (b > 21 || t > b) { m.esito = 'vince'; ritorno = m.puntata * 2; }
        else if (t === b) { m.esito = 'pari'; ritorno = m.puntata; }
        else m.esito = 'perde';
        m.vincita = ritorno - m.puntata;
        this.fiche[p] += ritorno;
        this.esiti[p].netto += m.vincita;
      }
    }
    this.pausaMs = 4500;
    this.inAttesa = true;
    return { ok: true };
  }

  // ---- tempo per decidere: allo scadere si sta ----
  scadenzaTurno() { return this.fase === 'turni' && this.turno != null ? this.inizioDecisione + SECONDI_DECISIONE * 1000 : null; }
  tempoTurno() {
    if (this.fase !== 'turni' || this.turno == null || Date.now() < this.scadenzaTurno()) return false;
    this.saltaTurno(this.turno);
    return true;
  }
  saltaTurno(p) {
    if (this.fase !== 'turni' || p !== this.turno) return;
    this.annuncia(p, 'sta (tempo scaduto)', 'stai: tempo scaduto');
    this.mani[p][this.manoAttiva].stato = 'stai';
    this.rendiCoda(p);
    this.prossimaMano();
  }

  // la mossa della strategia di base per la mano che sto giocando (il pulsante 💡 nel browser la mostra a chi la vuole)
  consiglio(p) {
    if (this.fase !== 'turni' || this.turno !== p) return null;
    const m = this.mani[p] && this.mani[p][this.manoAttiva];
    if (!m || !this.banco[0]) return null;
    const az = this.azioniPossibili(p);
    if (!az.carta) return null;
    if (this.codaTrucco[p] && this.codaTrucco[p].length && this.manoAttiva === 0) return 'carta'; // col trucco conviene chiedere carta
    let x = strategia(m, this.banco[0], az.raddoppia, az.dividi);
    if (!az[x]) x = x === 'raddoppia' ? 'carta' : 'stai';
    return x;
  }

  vista(p) {
    const bancoVisto = this.coperta ? [this.banco[0], null].filter((x, k) => k < this.banco.length) : this.banco;
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: this.turno, manoAttiva: this.manoAttiva, inAttesa: this.inAttesa,
      fiche: this.fiche, puntato: this.puntato, passato: this.passato,
      banco: { carte: bancoVisto, totale: this.coperta ? (this.banco[0] ? conta([this.banco[0]]).tot : 0) : conta(this.banco).tot, coperta: this.coperta },
      mani: this.mani.map((ms) => ms.map((m) => ({ ...m, ...conta(m.carte) }))),
      azioni: this.azioniPossibili(p), esiti: this.esiti, mescolata: this.mescolata, consiglio: this.consiglio(p),
      tempoPuntate: this.tempoPuntateMs(),
      tempoDecisione: this.scadenzaTurno() ? Math.max(0, this.scadenzaTurno() - Date.now()) : null,
      carteScarpa: this.scarpa.length, totaleScarpa: this.totaleScarpa, nMano: this.nMano,
      finita: false, risultato: null, evento: this.evento,
    };
  }
}

// Il trucco: da 3 a 6 carte prese dalla scarpa che arrivano a 21 solo all'ultima (prima mai 21 né sballato).
// Le prime due stanno tra 4 e 15, così chiedere carta viene naturale. I valori si scelgono tutti con la stessa
// probabilità (asso, 2…9, 10/figura), così le figure non escono più delle altre, e le combinazioni usate di recente
// (`evita`, chiavi come "2,5,6,8") non si ripetono: ogni mano truccata è diversa dalle ultime.
function sequenzaVentuno(carte, evita = []) {
  const chiave = (seq) => seq.map(valoreCarta).sort((x, y) => x - y).join(',');
  const ok = (seq) => {
    for (let k = 2; k < seq.length; k++) if (conta(seq.slice(0, k)).tot >= 21) return false;
    const due = conta(seq.slice(0, 2)).tot;
    return due >= 4 && due <= 15 && conta(seq).tot === 21;
  };
  for (let prova = 0; prova < 4000; prova++) {
    const n = [3, 3, 4, 4, 4, 5, 5, 6][Math.floor(Math.random() * 8)];
    const usate = new Set();
    const seq = [];
    for (let k = 0; k < n; k++) {
      const v = 1 + Math.floor(Math.random() * 10); // 1 = asso, 10 = dieci o figura
      const adatte = [];
      carte.forEach((c, i) => { if (!usate.has(i) && (v === 1 ? c.rango === 1 : v === 10 ? valoreCarta(c) === 10 : c.rango === v)) adatte.push(i); });
      if (!adatte.length) break;
      const i = adatte[Math.floor(Math.random() * adatte.length)];
      usate.add(i);
      seq.push(carte[i]);
    }
    if (seq.length !== n || !ok(seq)) continue;
    if (prova < 3000 && evita.includes(chiave(seq))) continue;
    return seq;
  }
  return null;
}

// =================== COMPUTER ===================
// Strategia di base per 6 mazzi, banco che sta su soft 17, raddoppio dopo lo split permesso.
function strategia(m, banco, puoRaddoppiare, puoDividere) {
  const d = valoreCarta(banco); // 2..11
  const { tot, morbida } = conta(m.carte);
  if (puoDividere) {
    const v = valoreCarta(m.carte[0]);
    if (v === 11 || v === 8) return 'dividi';
    if (v === 9 && ![7, 10, 11].includes(d)) return 'dividi';
    if ((v === 7 || v === 3 || v === 2) && d <= 7) return 'dividi';
    if (v === 6 && d <= 6) return 'dividi';
    if (v === 4 && (d === 5 || d === 6)) return 'dividi';
  }
  const raddoppia = (cond) => (cond && puoRaddoppiare ? 'raddoppia' : null);
  if (morbida && tot <= 20) {
    if (tot >= 19) return 'stai';
    if (tot === 18) return raddoppia(d >= 3 && d <= 6) || (d >= 9 ? 'carta' : 'stai');
    if (tot === 17) return raddoppia(d >= 3 && d <= 6) || 'carta';
    if (tot >= 15) return raddoppia(d >= 4 && d <= 6) || 'carta';
    return raddoppia(d >= 5 && d <= 6) || 'carta';
  }
  if (tot >= 17) return 'stai';
  if (tot >= 13) return d <= 6 ? 'stai' : 'carta';
  if (tot === 12) return d >= 4 && d <= 6 ? 'stai' : 'carta';
  if (tot === 11) return raddoppia(d <= 10) || 'carta';
  if (tot === 10) return raddoppia(d <= 9) || 'carta';
  if (tot === 9) return raddoppia(d >= 3 && d <= 6) || 'carta';
  return 'carta';
}

function bot(g, p, livello) {
  if (g.fase === 'puntate') return { tipo: 'punta', importo: puntataBot(g.fiche[p], livello) };
  const m = g.mani[p][g.manoAttiva];
  const az = g.azioniPossibili(p);
  if (livello === 'facile') {
    const t = conta(m.carte).tot;
    if (az.raddoppia && t >= 10 && t <= 11 && Math.random() < 0.5) return { tipo: 'raddoppia' };
    return { tipo: t < 15 || (t < 17 && Math.random() < 0.4) ? 'carta' : 'stai' };
  }
  let scelta = strategia(m, g.banco[0], az.raddoppia, az.dividi);
  if (livello === 'medio' && Math.random() < 0.12) scelta = conta(m.carte).tot < 16 ? 'carta' : 'stai'; // qualche imprecisione
  if (!az[scelta]) scelta = scelta === 'raddoppia' ? 'carta' : 'stai';
  return { tipo: scelta };
}

module.exports = {
  meta: {
    id: 'blackjack',
    nome: 'Blackjack',
    tipo: 'tabellone',
    fiche: true,
    saltaAssenti: true,
    giocatori: [1, 2, 3, 4, 5, 6],
    descrizione: 'Contro il banco, con le fiche. Split, raddoppio e banco che sta su 17.',
    opzioni: [],
    regole: [
      'Si gioca contro il banco, che è il computer. Ogni giocatore parte con 1000 fiche; quando le finisci puoi scrivere !ricarica in chat per averne altre 1000.',
      'Puntate: tutti puntano insieme, quanto vogliono (non c\'è minimo né massimo). Dopo la prima puntata gli altri hanno 20 secondi, poi chi non ha puntato salta la mano. Puoi anche passare.',
      'Valori: le carte dal 2 al 10 valgono il loro numero, fante, donna e re valgono 10, l\'asso vale 11 oppure 1 (come conviene). Una mano con un asso contato 11 si dice "soft".',
      'Ognuno riceve due carte scoperte; il banco una scoperta e una coperta. L\'obiettivo è avvicinarsi a 21 più del banco senza superarlo.',
      'Blackjack: asso più una carta da 10 con le prime due carte. Paga 3 a 2 (punti 10, ne ricevi 15 di vincita). Se anche il banco ha blackjack è pari.',
      'Al tuo turno: Carta (ne prendi un\'altra), Stai (ti fermi), Raddoppia (raddoppi la puntata, ricevi una sola carta e ti fermi; solo con due carte), Dividi (se hai due carte dello stesso valore le separi in due mani, ognuna con la sua puntata; fino a 4 mani). Si può raddoppiare anche dopo aver diviso. Gli assi divisi ricevono una carta sola ciascuno, e 21 dopo una divisione non è blackjack.',
      'Se superi 21 hai sballato e perdi subito, anche se poi sballa il banco. Hai 30 secondi per decidere, poi stai automaticamente.',
      'Il banco, se mostra un asso o una carta da 10, controlla subito se ha blackjack. Alla fine scopre la carta coperta e pesca finché non arriva almeno a 17; su 17 si ferma sempre, anche soft.',
      'Pagamenti: se batti il banco (o il banco sballa) vinci quanto hai puntato; a parità di punti riprendi la puntata. Niente assicurazione e niente resa.',
      'Il pulsante 💡 Consiglio fa vedere cosa farebbe la strategia di base (la mossa che in media fa perdere meno) con le tue carte e la carta scoperta del banco.',
      'Si gioca con 6 mazzi; quando ne resta meno di un quarto si rimescola. I computer seduti al tavolo si ricaricano da soli quando finiscono le fiche.',
    ],
  },
  crea: (o) => new Blackjack(o),
  bot,
  _test: { conta, strategia, isBlackjack, sequenzaVentuno },
};
