// Motore comune del poker (Texas Hold'em e poker a 5 carte con cambio).
// - Valutazione delle mani (la migliore da 5 carte su 5, 6 o 7).
// - Giri di puntate no-limit SENZA bui né puntate obbligatorie: chi apre decide quanto puntare (minimo 5).
// - Piatti laterali quando qualcuno va all-in, divisione a parità.
const { Casino, scarpa } = require('./casino');

const MINIMO = 5;
const SECONDI_DECISIONE = 30;
const v14 = (c) => (c.rango === 1 ? 14 : c.rango);

// ---------- valutazione ----------
const CATEGORIE = ['Carta alta', 'Coppia', 'Doppia coppia', 'Tris', 'Scala', 'Colore', 'Full', 'Poker', 'Scala colore'];
function valuta5(carte) {
  const v = carte.map(v14).sort((a, b) => b - a);
  const colore = carte.every((c) => c.seme === carte[0].seme);
  const uniche = [...new Set(v)];
  let scala = 0;
  if (uniche.length === 5) {
    if (v[0] - v[4] === 4) scala = v[0];
    else if (v[0] === 14 && v[1] === 5) scala = 5; // A-2-3-4-5
  }
  const conta = {};
  for (const x of v) conta[x] = (conta[x] || 0) + 1;
  const gruppi = Object.entries(conta).map(([x, n]) => [n, Number(x)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const forme = gruppi.map((g) => g[0]).join('');
  let cat, chiavi;
  if (scala && colore) { cat = 8; chiavi = [scala]; }
  else if (forme === '41') { cat = 7; chiavi = gruppi.map((g) => g[1]); }
  else if (forme === '32') { cat = 6; chiavi = gruppi.map((g) => g[1]); }
  else if (colore) { cat = 5; chiavi = v; }
  else if (scala) { cat = 4; chiavi = [scala]; }
  else if (forme === '311') { cat = 3; chiavi = gruppi.map((g) => g[1]); }
  else if (forme === '221') { cat = 2; chiavi = gruppi.map((g) => g[1]); }
  else if (forme === '2111') { cat = 1; chiavi = gruppi.map((g) => g[1]); }
  else { cat = 0; chiavi = v; }
  let punti = cat;
  for (let k = 0; k < 5; k++) punti = punti * 15 + (chiavi[k] || 0);
  return { punti, cat, chiavi };
}
function migliore(carte) {
  if (carte.length <= 5) return { ...valuta5(carte), carte };
  let best = null;
  const n = carte.length;
  const scelta = [];
  (function giro(da) {
    if (scelta.length === 5) {
      const cs = scelta.map((i) => carte[i]);
      const r = valuta5(cs);
      if (!best || r.punti > best.punti) best = { ...r, carte: cs };
      return;
    }
    for (let i = da; i < n; i++) { scelta.push(i); giro(i + 1); scelta.pop(); }
  })(0);
  return best;
}
const NOME_VAL = { 14: 'assi', 13: 're', 12: 'donne', 11: 'fanti', 10: 'dieci', 9: 'nove', 8: 'otto', 7: 'sette', 6: 'sei', 5: 'cinque', 4: 'quattro', 3: 'tre', 2: 'due' };
const NOME_UNO = { 14: 'asso', 13: 're', 12: 'donna', 11: 'fante' };
// "al 9", "al fante", "alla donna", "al re", "all'asso"
const al = (x) => (x === 14 ? "all'asso" : x === 12 ? 'alla donna' : `al ${NOME_UNO[x] || x}`);
function nomeMano(r) {
  const k = r.chiavi;
  switch (r.cat) {
    case 8: return k[0] === 14 ? 'Scala reale' : `Scala colore ${al(k[0])}`;
    case 7: return `Poker di ${NOME_VAL[k[0]]}`;
    case 6: return `Full di ${NOME_VAL[k[0]]} e ${NOME_VAL[k[1]]}`;
    case 5: return `Colore ${al(k[0])}`;
    case 4: return `Scala ${al(k[0])}`;
    case 3: return `Tris di ${NOME_VAL[k[0]]}`;
    case 2: return `Doppia coppia, ${NOME_VAL[k[0]]} e ${NOME_VAL[k[1]]}`;
    case 1: return `Coppia di ${NOME_VAL[k[0]]}`;
    default: return `Carta alta: ${NOME_UNO[k[0]] || k[0]}`;
  }
}

// ---------- probabilità di vincere (per i computer), stimata con partite a caso ----------
function equita(mie, tavola, avversari, { daCompletare = 5, giri = 250, cartePerMano = 2, conCambio = false } = {}) {
  if (process.env.TEST_VELOCE) giri = Math.min(giri, 25);
  const note = new Set([...mie, ...tavola].map((c) => `${c.rango}${c.seme}`));
  const resto = [];
  for (const s of ['c', 'q', 'f', 'p']) for (let r = 1; r <= 13; r++) if (!note.has(`${r}${s}`)) resto.push({ rango: r, seme: s });
  let vinte = 0;
  for (let g = 0; g < giri; g++) {
    // mescolata parziale: bastano poche carte
    const serve = avversari * cartePerMano + (daCompletare - tavola.length);
    for (let i = 0; i < serve; i++) { const j = i + Math.floor(Math.random() * (resto.length - i)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
    let k = 0;
    const board = [...tavola];
    while (board.length < daCompletare) board.push(resto[k++]);
    const mio = migliore([...mie, ...board]).punti;
    let meglio = true, pari = 0;
    for (let a = 0; a < avversari; a++) {
      const sua = resto.slice(k, k + cartePerMano); k += cartePerMano;
      const suo = migliore(conCambio ? sua : [...sua, ...board]).punti;
      if (suo > mio) { meglio = false; break; }
      if (suo === mio) pari++;
    }
    if (meglio) vinte += pari ? 1 / (pari + 1) : 1;
  }
  return vinte / giri;
}

// probabilità di vincere mostrata al giocatore (aiuto facoltativo nel browser): si ricalcola solo quando cambiano
// le sue carte, la tavola o il numero di avversari ancora in mano
function forzaMano(g, p, opz = {}) {
  if (!g.inMano || !g.inMano[p] || !g.carte || !g.carte[p] || !g.carte[p].length || g.carte[p].some((c) => !c)) return null;
  const avversari = g.inMano.filter((x, i) => x && i !== p).length;
  if (!avversari) return null;
  const tavola = opz.tavola || [];
  const chiave = `${g.carte[p].map((c) => c.id || `${c.rango}${c.seme}`).join(',')}|${tavola.map((c) => c.id || `${c.rango}${c.seme}`).join(',')}|${avversari}`;
  g._forza = g._forza || {};
  if (!g._forza[p] || g._forza[p].chiave !== chiave) {
    g._forza[p] = { chiave, v: Math.round(100 * equita(g.carte[p], tavola, avversari, { giri: 600, ...opz })), avversari };
  }
  return { percento: g._forza[p].v, avversari: g._forza[p].avversari };
}

// =================== PARTITA ===================
class Poker extends Casino {
  constructor(o) {
    super(o);
    this.dealer = (o.primo || 0) - 1;
    this.pausaMs = 900;
    this.nuovaMano();
  }

  // chi ha fiche all'inizio della mano gioca; gli altri guardano finché non si ricaricano
  nuovaMano() {
    this.inAttesa = false;
    this.seduti = this.fiche.map((f) => f > 0);
    this.esiti = null;
    this.mostrate = null;
    if (this.seduti.filter(Boolean).length < 2) { this.fase = 'attesa'; this.turno = null; return; }
    this.nMano++;
    do this.dealer = (this.dealer + 1) % this.n; while (!this.seduti[this.dealer]);
    this.mazzo = scarpa(1);
    this.scarti = [];
    this.carte = Array.from({ length: this.n }, () => []);
    this.inMano = [...this.seduti];
    this.allin = new Array(this.n).fill(false);
    this.contrib = new Array(this.n).fill(0);
    this.ultima = new Array(this.n).fill(null); // ultima azione, da mostrare
    this.distribuisci();
    this.iniziaGiro();
  }
  pesca() {
    if (!this.mazzo.length) { this.mazzo = this.scarti; this.scarti = []; for (let i = this.mazzo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.mazzo[i], this.mazzo[j]] = [this.mazzo[j], this.mazzo[i]]; } }
    return this.mazzo.pop();
  }
  ricarica(p, quante) {
    super.ricarica(p, quante);
    if (this.fase === 'attesa' && this.fiche.filter((f) => f > 0).length >= 2) this.nuovaMano();
  }

  // ---- puntate ----
  puoAgire(p) { return this.inMano[p] && !this.allin[p]; }
  ficheInGioco(p) { return this.fase !== 'fine' && this.fase !== 'attesa' && this.inMano && this.inMano[p] ? 1 : 0; }
  dopo(p) { for (let k = 1; k <= this.n; k++) { const i = (p + k) % this.n; if (this.puoAgire(i)) return i; } return null; }
  iniziaGiro() {
    this.fase = 'giro';
    this.puntataGiro = new Array(this.n).fill(0);
    this.massimo = 0;
    this.minRilancio = MINIMO;
    this.agito = new Array(this.n).fill(false);
    this.ultima = this.ultima.map((u, i) => (this.inMano[i] ? (this.allin[i] ? 'all-in' : null) : u));
    const chi = this.dopo(this.dealer);
    const possono = this.inMano.filter((x, i) => x && !this.allin[i]).length;
    if (chi === null || possono < 2) { this.turno = null; return this.fineGiro(); }
    this.turno = chi;
    this.inizioDecisione = Date.now();
  }
  piatto() { return this.contrib.reduce((a, b) => a + b, 0); }
  azioniPossibili(p) {
    if (this.fase !== 'giro' || this.turno !== p || this.inAttesa) return null;
    const deve = this.massimo - this.puntataGiro[p];
    const tutto = this.puntataGiro[p] + this.fiche[p];
    const minimo = Math.min(tutto, this.massimo === 0 ? MINIMO : this.massimo + this.minRilancio);
    return { lascia: deve > 0, passa: deve === 0, vedi: deve > 0 ? Math.min(deve, this.fiche[p]) : 0, punta: tutto > this.massimo ? { min: minimo, max: tutto } : null, rilancio: this.massimo > 0 };
  }
  metti(p, quanto) {
    const x = Math.min(quanto, this.fiche[p]);
    this.fiche[p] -= x;
    this.puntataGiro[p] += x;
    this.contrib[p] += x;
    if (this.fiche[p] === 0) this.allin[p] = true;
  }
  azioneGiro(p, a) {
    const az = this.azioniPossibili(p);
    if (!az) return { errore: 'Non è il tuo turno' };
    if (a.tipo === 'lascia') {
      this.inMano[p] = false; this.ultima[p] = 'lascia';
      this.annuncia(p, 'lascia', 'lasci');
    } else if (a.tipo === 'passa') {
      if (!az.passa) return { errore: 'Devi vedere, rilanciare o lasciare' };
      this.ultima[p] = 'passa';
    } else if (a.tipo === 'vedi') {
      if (!az.vedi) return { errore: 'Non c\'è niente da vedere' };
      this.metti(p, az.vedi);
      this.ultima[p] = this.allin[p] ? 'all-in' : `vede ${az.vedi}`;
    } else if (a.tipo === 'punta') {
      if (!az.punta) return { errore: 'Non puoi rilanciare' };
      const fino = Math.floor(Number(a.fino));
      if (!Number.isFinite(fino) || fino > az.punta.max) return { errore: 'Puntata non valida' };
      if (fino < az.punta.min) return { errore: az.rilancio ? `Il rilancio minimo è a ${az.punta.min}` : `La puntata minima è ${az.punta.min}` };
      const aumento = fino - this.massimo;
      this.metti(p, fino - this.puntataGiro[p]);
      if (aumento >= this.minRilancio) this.minRilancio = aumento;
      const eraApertura = this.massimo === 0;
      this.massimo = fino;
      for (let i = 0; i < this.n; i++) if (i !== p) this.agito[i] = false; // gli altri devono rispondere
      this.ultima[p] = this.allin[p] ? 'all-in' : eraApertura ? `punta ${fino}` : `rilancia a ${fino}`;
      this.annuncia(p, this.allin[p] ? `va all-in (${fino})` : eraApertura ? `punta ${fino}` : `rilancia a ${fino}`, this.allin[p] ? 'vai all-in' : eraApertura ? `punti ${fino}` : `rilanci a ${fino}`);
    } else return { errore: 'Mossa non valida' };
    this.agito[p] = true;
    return this.passaTurno(p);
  }
  passaTurno(p) {
    const rimasti = this.inMano.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    if (rimasti.length === 1) return this.vinceSenzaMostrare(rimasti[0]);
    const finito = this.inMano.every((x, i) => !x || this.allin[i] || (this.agito[i] && this.puntataGiro[i] === this.massimo));
    if (finito) { this.turno = null; return this.fineGiro(); }
    this.turno = this.dopo(p);
    this.inizioDecisione = Date.now();
    return { ok: true };
  }

  // ---- fine della mano ----
  vinceSenzaMostrare(v) {
    const tot = this.piatto();
    this.fiche[v] += tot;
    this.esiti = this.fiche.map((_, i) => ({ vinto: i === v ? tot : 0, netto: (i === v ? tot : 0) - this.contrib[i] }));
    this.vincitori = [v];
    const altri = this.seduti.filter(Boolean).length > 2 ? 'gli altri hanno lasciato' : 'l\'altro ha lasciato';
    this.annuncia(v, `vince ${tot} fiche: ${altri}`, `vinci ${tot} fiche: ${altri}`, true);
    return this.chiudiMano();
  }
  confronto() {
    const inGara = this.inMano.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    const val = {};
    for (const i of inGara) val[i] = this.valuta(i);
    // piatti laterali: a ogni livello di puntata partecipa chi ha messo almeno quel tanto
    const livelli = [...new Set(inGara.map((i) => this.contrib[i]))].sort((a, b) => a - b);
    const vinto = new Array(this.n).fill(0);
    let prima = 0;
    this.piatti = [];
    for (const liv of livelli) {
      let somma = 0;
      for (let i = 0; i < this.n; i++) somma += Math.max(0, Math.min(this.contrib[i], liv) - prima);
      const ammessi = inGara.filter((i) => this.contrib[i] >= liv);
      const top = Math.max(...ammessi.map((i) => val[i].punti));
      const vince = ammessi.filter((i) => val[i].punti === top);
      const quota = Math.floor(somma / vince.length);
      let resto = somma - quota * vince.length;
      // le fiche avanzate vanno a chi siede per primo dopo il mazziere
      const ordine = [...vince].sort((a, b) => ((a - this.dealer + this.n) % this.n) - ((b - this.dealer + this.n) % this.n));
      for (const i of ordine) { vinto[i] += quota + (resto > 0 ? 1 : 0); if (resto > 0) resto--; }
      this.piatti.push({ somma, vincitori: vince });
      prima = liv;
    }
    // le fiche messe oltre l'ultimo livello (da chi ha lasciato con più fiche) vanno all'ultimo piatto
    const avanzo = this.piatto() - vinto.reduce((a, b) => a + b, 0);
    if (avanzo > 0) { const u = this.piatti[this.piatti.length - 1]; vinto[u.vincitori[0]] += avanzo; u.somma += avanzo; }
    for (let i = 0; i < this.n; i++) this.fiche[i] += vinto[i];
    this.mostrate = {};
    for (const i of inGara) this.mostrate[i] = { nome: nomeMano(val[i]), carte: val[i].carte.map((c) => c.id) };
    this.esiti = this.fiche.map((_, i) => ({ vinto: vinto[i], netto: vinto[i] - this.contrib[i] }));
    this.vincitori = [...new Set(this.piatti.flatMap((x) => x.vincitori))];
    const principale = this.piatti[0];
    const nomi = principale.vincitori;
    this.annuncia(nomi.length === 1 ? nomi[0] : null, nomi.length === 1 ? `vince con ${this.mostrate[nomi[0]].nome}` : `Piatto diviso: ${this.mostrate[nomi[0]].nome}`,
      nomi.length === 1 ? `vinci con ${this.mostrate[nomi[0]].nome}!` : '', true);
    return this.chiudiMano();
  }
  chiudiMano() {
    this.fase = 'fine';
    this.turno = null;
    this.pausaMs = 6000;
    this.inAttesa = true;
    return { ok: true };
  }
  avanza() {
    if (!this.inAttesa) return;
    if (this.fase === 'fine') { this.pausaMs = 900; this.nuovaMano(); return; }
    this.avanzaCorsa(); // carte che escono da sole (tutti all-in)
  }

  // ---- tempo per decidere e assenti ----
  scadenzaTurno() { return this.turno != null && !this.inAttesa ? this.inizioDecisione + SECONDI_DECISIONE * 1000 : null; }
  tempoTurno() {
    if (this.turno == null || this.inAttesa || Date.now() < this.scadenzaTurno()) return false;
    this.saltaTurno(this.turno);
    return true;
  }
  saltaTurno(p) {
    if (p !== this.turno || this.inAttesa) return;
    if (this.fase === 'cambio') { this.azione(p, { tipo: 'cambia', carte: [] }); return; }
    const az = this.azioniPossibili(p);
    if (!az) return;
    this.annuncia(p, az.passa ? 'passa (tempo scaduto)' : 'lascia (tempo scaduto)', az.passa ? 'passi: tempo scaduto' : 'lasci: tempo scaduto');
    this.azioneGiro(p, { tipo: az.passa ? 'passa' : 'lascia' });
  }

  vistaComune(p) {
    const fine = this.fase === 'fine';
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, dealer: this.dealer,
      fiche: this.fiche, seduti: this.seduti, inMano: this.inMano, allin: this.allin, ultima: this.ultima,
      puntataGiro: this.puntataGiro || [], contrib: this.contrib || [], piatto: this.contrib ? this.piatto() : 0,
      carte: (this.carte || []).map((cs, i) => (i === p || (fine && this.mostrate && this.mostrate[i]) ? cs : cs.map(() => null))),
      mostrate: fine ? this.mostrate : null, esiti: this.esiti, piatti: fine ? this.piatti : null,
      azioni: this.azioniPossibili(p), tempoDecisione: this.scadenzaTurno() ? Math.max(0, this.scadenzaTurno() - Date.now()) : null,
      nMano: this.nMano, finita: false, risultato: null, evento: this.evento,
    };
  }
}

// =================== COMPUTER: decisione di puntata ===================
function decidi(g, p, livello, eq) {
  const az = g.azioniPossibili(p);
  const deve = az.vedi || 0;
  const pot = g.piatto();
  const quotaPiatto = deve / (pot + deve || 1);
  const a5 = (x) => Math.max(MINIMO, Math.round(x / 5) * 5);
  const punta = (quanto) => {
    if (!az.punta) return deve ? { tipo: 'vedi' } : { tipo: 'passa' };
    return { tipo: 'punta', fino: Math.max(az.punta.min, Math.min(az.punta.max, a5(quanto))) };
  };
  const base = Math.max(pot, 20);
  const r = Math.random();
  if (livello === 'facile') {
    if (eq > 0.75 && r < 0.4) return punta(g.massimo + base * 0.5);
    if (!deve) return r < 0.15 ? punta(base * 0.4) : { tipo: 'passa' };
    return eq > 0.2 || r < 0.5 ? { tipo: 'vedi' } : { tipo: 'lascia' };
  }
  if (livello === 'medio') {
    if (!deve) return eq > 0.6 ? punta(base * 0.6) : { tipo: 'passa' };
    if (eq > 0.78 && r < 0.6) return punta(g.massimo * 2.5 + base * 0.3);
    return eq > quotaPiatto + 0.08 ? { tipo: 'vedi' } : { tipo: 'lascia' };
  }
  // difficile: valore contro quota del piatto, rilanci proporzionati e qualche bluff
  if (!deve) {
    if (eq > 0.68) return punta(base * (0.6 + Math.random() * 0.4));
    if (eq < 0.3 && r < 0.08) return punta(base * 0.6); // bluff
    return { tipo: 'passa' };
  }
  if (eq > 0.85 && r < 0.3 && az.punta) return { tipo: 'punta', fino: az.punta.max };
  if (eq > 0.72) return punta(g.massimo * 2.5 + pot * 0.5);
  if (eq > quotaPiatto + 0.03) return { tipo: 'vedi' };
  return { tipo: 'lascia' };
}

module.exports = { Poker, valuta5, migliore, nomeMano, equita, forzaMano, decidi, CATEGORIE, MINIMO, v14 };
