// SETTE E MEZZO contro il banco (il banco è il computer, non occupa un posto), con le fiche. Da 1 a 6 giocatori.
// Carte napoletane da 40: semi denari (d), coppe (c), spade (s), bastoni (b); rango 1..7, 8 = fante, 9 = cavallo, 10 = re.
// Dall'asso al 7 valgono il loro numero, le figure mezzo punto; il re di denari è la matta (vale quello che serve).
// I punti si contano in mezzi (×2) per non avere numeri con la virgola: 7 e mezzo = 15.
const { Casino, puntataBot } = require('../giochi/casino');
const { mescola } = require('../giochi/carte');
const T = require('../giochi/trucco');

const SEMI = ['d', 'c', 's', 'b'];
const MATTA = '10d';
const MASSIMO = 15; // 7 e mezzo
const SECONDI_DECISIONE = 30;
const SOGLIE = [5, 6];

function mazzo40() {
  const m = [];
  for (const s of SEMI) for (let r = 1; r <= 10; r++) m.push({ id: `${r}${s}`, rango: r, seme: s });
  return m;
}
const eMatta = (c) => c.id === MATTA;
const mezzi = (c) => (c.rango <= 7 ? c.rango * 2 : 1); // valore in mezzi punti
const VALORI_MATTA = [1, 2, 4, 6, 8, 10, 12, 14]; // mezzo, 1, 2, …, 7

// miglior punteggio: la matta prende il valore che porta più vicino a 7 e mezzo senza superarlo
function contaMezzi(s, matta) {
  if (!matta) return s;
  let best = null;
  for (const v of VALORI_MATTA) if (s + v <= MASSIMO && (best === null || s + v > best)) best = s + v;
  return best === null ? s + 1 : best;
}
function conta(carte) {
  const s = carte.filter((c) => !eMatta(c)).reduce((x, c) => x + mezzi(c), 0);
  const tot = contaMezzi(s, carte.some(eMatta));
  return { mezzi: tot, punti: tot / 2, sballato: tot > MASSIMO, setteMezzo: tot === MASSIMO && carte.length === 2 };
}
// 15 → "7 e mezzo", 1 → "mezzo", 8 → "4"
const fmt = (m) => { const i = Math.floor(m / 2); return m % 2 ? (i ? `${i} e mezzo` : 'mezzo') : `${i}`; };

class SetteMezzo extends Casino {
  constructor(o) {
    super(o);
    this.id = 'settemezzo';
    this.soglia = SOGLIE.includes(Number(o.opzioni && o.opzioni.banco)) ? Number(o.opzioni.banco) : 5;
    this.pausaMs = 900;
    this.mazzo = mescola(mazzo40());
    this.apriPuntate();
  }

  apriPuntate() {
    super.apriPuntate();
    this.mani = Array.from({ length: this.n }, () => null);
    this.banco = [];
    this.bancoScoperto = false;
    this.esiti = null;
    this.mazzo = mescola(mazzo40()); // a ogni mano si mescola tutto il mazzo
  }

  pesca() {
    if (!this.mazzo.length) { // succede di rado: si rimescolano le carte che non sono in tavola
      const inGioco = new Set([...this.banco, ...this.mani.flatMap((m) => (m ? m.carte : []))].map((c) => c.id));
      this.mazzo = mescola(mazzo40().filter((c) => !inGioco.has(c.id)));
    }
    return this.mazzo.pop();
  }

  azione(p, a) {
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Aspetta un momento' };
    if (this.fase === 'puntate') {
      if (a.tipo === 'passa') return this.passa(p);
      if (a.tipo !== 'punta') return { errore: 'Prima fai la tua puntata' };
      if (this.puntato[p] || this.passato[p]) return { errore: 'Hai già deciso per questa mano' };
      const r = this.controllaImporto(p, a.importo);
      if (r.errore) return r;
      this.fiche[p] -= r.importo;
      this.mani[p] = { carte: [], puntata: r.importo, stato: 'gioca' };
      this.segnaPuntata(p);
      return { ok: true };
    }
    if (this.fase !== 'turni') return { errore: 'Aspetta la prossima mano' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    const m = this.mani[p];
    if (a.tipo === 'carta') {
      if (this.serviti && this.serviti.has(p) && m.carte.length === 1) {
        this.serviti.delete(p);
        if (!T.inCima(this.mazzo, (c) => c.rango === 7)) T.inCima(this.mazzo, eMatta);
      }
      else if (T.sfortuna(this, p)) T.inCima(this.mazzo, (c) => !eMatta(c) && conta([...m.carte, c]).sballato); // !lose: si sballa
      m.carte.push(this.pesca());
      const t = conta(m.carte);
      if (t.sballato) { m.stato = 'sballato'; this.annuncia(p, `sballa con ${fmt(t.mezzi)}`, `hai sballato: ${fmt(t.mezzi)}`); return this.prossimo(p); }
      if (t.mezzi === MASSIMO) { m.stato = 'stai'; this.annuncia(p, 'fa sette e mezzo!', 'fai sette e mezzo!', t.setteMezzo); return this.prossimo(p); }
      return { ok: true };
    }
    if (a.tipo === 'stai') { m.stato = 'stai'; return this.prossimo(p); }
    return { errore: 'Mossa non valida' };
  }

  // il trucco segreto (!win !parola): la carta coperta diventa una figura e la prima carta chiesta sarà un 7
  // (sette e mezzo servito); poi sei tu a chiedere carta. Durante le puntate si aspetta la distribuzione.
  manoVincente(p) {
    const m = this.mani[p];
    if (this.fase !== 'turni' || !m || m.stato !== 'gioca' || m.carte.length !== 1) return null;
    const i = this.mazzo.findIndex((c) => c.rango >= 8 && !eMatta(c));
    if (i < 0) return null;
    const [f] = this.mazzo.splice(i, 1);
    this.mazzo.unshift(m.carte[0]);
    m.carte = [f];
    this.truccati = [...(this.truccati || []), p];
    this.serviti = this.serviti || new Set();
    this.serviti.add(p);
    return '🃏 Mano cambiata: chiedi una carta';
  }

  // ---- distribuzione: una carta coperta a testa, e una al banco ----
  gioca() {
    this.fase = 'turni';
    this.ordine = this.mani.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
    // il trucco segreto (!win): una figura coperta, poi alla prima carta chiesta un 7 → sette e mezzo servito
    this.truccati = this.ordine.filter((i) => T.consuma(this, i));
    this.serviti = new Set(this.truccati);
    for (const i of this.ordine) {
      if (this.serviti.has(i)) T.inCima(this.mazzo, (c) => c.rango >= 8 && !eMatta(c));
      this.mani[i].carte.push(this.pesca());
    }
    this.banco.push(this.pesca());
    this.turno = null;
    this.prossimo(-1);
    return { ok: true };
  }

  prossimo(da) {
    for (const i of this.ordine) {
      if (i <= da) continue;
      if (this.mani[i].stato === 'gioca') { this.turno = i; this.inizioDecisione = Date.now(); return { ok: true }; }
    }
    this.turno = null;
    this.fase = 'banco';
    this.bancoScoperto = true;
    this.pausaMs = 1000; // una carta del banco al secondo
    this.inAttesa = true;
    return { ok: true };
  }

  // il banco scopre la carta e pesca finché non arriva alla sua soglia (se c'è ancora qualcuno in gioco)
  avanza() {
    if (!this.inAttesa) return;
    if (this.fase === 'banco') {
      const vivi = this.ordine.some((i) => this.mani[i].stato === 'stai');
      const b = conta(this.banco);
      if (vivi && !b.sballato && b.mezzi < this.soglia * 2) {
        // col trucco il banco non pareggia il sette e mezzo servito con le sue prime due carte
        if (this.banco.length === 1 && (this.truccati || []).some((i) => this.mani[i].stato === 'stai' && conta(this.mani[i].carte).setteMezzo)) {
          T.inCima(this.mazzo, (c) => !conta([...this.banco, c]).setteMezzo);
        }
        this.banco.push(this.pesca());
        return;
      }
      this.paga();
      return;
    }
    if (this.fase === 'pagamenti') { this.inAttesa = false; this.apriPuntate(); }
  }

  paga() {
    this.fase = 'pagamenti';
    this.turno = null;
    const b = conta(this.banco);
    if (b.sballato) this.annuncia(null, `Il banco sballa con ${fmt(b.mezzi)}!`, '', true);
    this.esiti = Array.from({ length: this.n }, () => null);
    for (const i of this.ordine) {
      const m = this.mani[i];
      const t = conta(m.carte);
      let ritorno = 0;
      if (m.stato === 'sballato') m.esito = 'sballato';
      else if (t.setteMezzo && !b.setteMezzo) { m.esito = 'settemezzo'; ritorno = m.puntata * 3; } // paga doppio
      else if (b.sballato || t.mezzi > b.mezzi) { m.esito = 'vince'; ritorno = m.puntata * 2; }
      else m.esito = 'perde'; // il banco vince le parità
      m.vincita = ritorno - m.puntata;
      this.fiche[i] += ritorno;
      this.esiti[i] = { netto: m.vincita };
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
    this.mani[p].stato = 'stai';
    this.prossimo(p);
  }

  // carte che il posto p non ha visto (mazzo più le carte coperte degli altri e del banco)
  nonViste(p) {
    const viste = new Set();
    const vedo = (c) => viste.add(c.id);
    for (let i = 0; i < this.n; i++) {
      const m = this.mani[i];
      if (!m) continue;
      m.carte.forEach((c, k) => { if (k > 0 || i === p || this.copertaVisibile(i)) vedo(c); });
    }
    this.banco.forEach((c, k) => { if (k > 0 || this.bancoScoperto) vedo(c); });
    return mazzo40().filter((c) => !viste.has(c.id));
  }
  copertaVisibile(i) { return this.fase === 'pagamenti' || (this.mani[i] && this.mani[i].stato === 'sballato'); }

  // 💡 il consiglio: probabilità di sballare chiedendo un'altra carta, e cosa farebbe il computer difficile
  consiglio(p) {
    if (this.fase !== 'turni' || this.turno !== p) return null;
    const m = this.mani[p];
    const ignote = this.nonViste(p);
    const sballa = ignote.filter((c) => conta([...m.carte, c]).sballato).length;
    return { sballo: Math.round((sballa / ignote.length) * 100), mossa: sceltaDifficile(this, p) };
  }

  vista(p) {
    const fine = this.fase === 'pagamenti';
    const b = conta(this.banco);
    const bancoVisto = this.banco.map((c, k) => (k === 0 && !this.bancoScoperto ? null : c));
    const visibili = this.banco.filter((c, k) => k > 0 || this.bancoScoperto);
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, soglia: this.soglia,
      fiche: this.fiche, puntato: this.puntato, passato: this.passato,
      banco: { carte: bancoVisto, mezzi: this.bancoScoperto ? b.mezzi : conta(visibili).mezzi, coperta: !this.bancoScoperto, sballato: this.bancoScoperto && b.sballato },
      mani: this.mani.map((m, i) => {
        if (!m) return null;
        const vedo = i === p || fine || m.stato === 'sballato';
        const carte = m.carte.map((c, k) => (k === 0 && !vedo ? null : c));
        const t = conta(m.carte);
        const parz = conta(m.carte.slice(1));
        return { carte, puntata: m.puntata, stato: m.stato, esito: m.esito || null, vincita: m.vincita || 0,
          mezzi: vedo ? t.mezzi : parz.mezzi, coperta: !vedo && m.carte.length > 0, setteMezzo: vedo && t.setteMezzo };
      }),
      azioni: this.fase === 'turni' && this.turno === p && !this.inAttesa ? { carta: true, stai: true } : {},
      esiti: this.esiti, consiglio: this.consiglio(p),
      tempoPuntate: this.tempoPuntateMs(),
      tempoDecisione: this.scadenzaTurno() ? Math.max(0, this.scadenzaTurno() - Date.now()) : null,
      carteMazzo: this.mazzo.length, nMano: this.nMano,
      finita: false, risultato: null, evento: this.evento, pausaMs: this.pausaMs,
    };
  }
}

// =================== COMPUTER ===================
// distribuzione delle carte che il giocatore non ha visto, in mezzi punti (la matta a parte)
function distribuzione(ignote) {
  const tot = ignote.length;
  const d = new Map();
  let matta = 0;
  for (const c of ignote) { if (eMatta(c)) matta++; else d.set(mezzi(c), (d.get(mezzi(c)) || 0) + 1); }
  return { tot, valori: [...d.entries()].map(([v, k]) => [v, k / tot]), matta: matta / tot };
}

// Distribuzione dei punti finali del banco (che pesca finché non arriva a "soglia"), dalla carta coperta in poi.
function finaleBanco(dist, soglia2, visibili) {
  const out = new Map(); // mezzi (16 = sballato) → probabilità; chiave 'sm' per il sette e mezzo con due carte
  const memo = new Map();
  const giro = (s, matta, n) => {
    const k = `${s}|${matta}|${n}`;
    if (memo.has(k)) return memo.get(k);
    const t = contaMezzi(s, matta);
    let r;
    if (t > MASSIMO) r = new Map([[16, 1]]);
    else if (t >= soglia2 || n >= 12) r = new Map([[n === 2 && t === MASSIMO ? 'sm' : t, 1]]);
    else {
      r = new Map();
      const passo = (v, m, p) => { for (const [x, q] of giro(v, m, n + 1)) r.set(x, (r.get(x) || 0) + p * q); };
      for (const [v, p] of dist.valori) passo(s + v, matta, p);
      if (dist.matta && !matta) passo(s, true, dist.matta);
      else if (dist.matta) passo(s + 1, matta, dist.matta); // (non succede: c'è una matta sola)
    }
    memo.set(k, r);
    return r;
  };
  const s0 = visibili.filter((c) => !eMatta(c)).reduce((x, c) => x + mezzi(c), 0);
  const m0 = visibili.some(eMatta);
  // la carta coperta del banco è una delle carte non viste
  for (const [x, q] of giro(s0, m0, visibili.length)) out.set(x, (out.get(x) || 0) + q);
  return out;
}

// valore atteso (in puntate) di fermarsi con t mezzi (sm: sette e mezzo con due carte)
function evStai(banco, t, sm) {
  let ev = 0;
  for (const [x, q] of banco) {
    if (x === 16) ev += sm ? 2 * q : q;
    else if (x === 'sm') ev -= q;
    else if (sm) ev += 2 * q;
    else ev += t > x ? q : -q;
  }
  return ev;
}

// il difficile: confronta il valore atteso di fermarsi e di chiedere carta (guardando avanti di più carte)
function sceltaDifficile(g, p) {
  const m = g.mani[p];
  const dist = distribuzione(g.nonViste(p));
  const banco = finaleBanco(dist, g.soglia * 2, g.banco.filter((c, k) => k > 0 || g.bancoScoperto));
  const memo = new Map();
  const valore = (s, matta, n) => {
    const k = `${s}|${matta}|${n}`;
    if (memo.has(k)) return memo.get(k);
    const t = contaMezzi(s, matta);
    let r;
    if (t > MASSIMO) r = { v: -1 };
    else {
      const stai = evStai(banco, t, n === 2 && t === MASSIMO);
      if (t === MASSIMO || n >= 10) r = { v: stai, stai: true };
      else {
        let carta = 0;
        for (const [v, q] of dist.valori) carta += q * valore(s + v, matta, n + 1).v;
        if (dist.matta && !matta) carta += dist.matta * valore(s, true, n + 1).v;
        r = carta > stai ? { v: carta, stai: false } : { v: stai, stai: true };
      }
    }
    memo.set(k, r);
    return r;
  };
  const s = m.carte.filter((c) => !eMatta(c)).reduce((x, c) => x + mezzi(c), 0);
  return valore(s, m.carte.some(eMatta), m.carte.length).stai ? 'stai' : 'carta';
}

function bot(g, p, livello) {
  if (g.fase === 'puntate') return { tipo: 'punta', importo: puntataBot(g.fiche[p], livello) };
  const m = g.mani[p];
  const t = conta(m.carte).mezzi;
  if (livello === 'facile') {
    // chiede a caso finché è sotto il 5
    if (t <= 4) return { tipo: Math.random() < 0.85 ? 'carta' : 'stai' };
    if (t <= 10) return { tipo: Math.random() < 0.5 ? 'carta' : 'stai' };
    return { tipo: 'stai' };
  }
  // soglia fissa: sta da 5 in su (da 4 in su se il banco deve arrivare a 6, perché sballa più spesso)
  if (livello === 'medio') return { tipo: t < (g.soglia === 6 ? 8 : 10) ? 'carta' : 'stai' };
  return { tipo: sceltaDifficile(g, p) };
}

module.exports = {
  meta: {
    id: 'settemezzo',
    nome: 'Sette e mezzo',
    tipo: 'tabellone',
    fiche: true,
    saltaAssenti: true,
    giocatori: [1, 2, 3, 4, 5, 6],
    descrizione: 'Il classico con le carte napoletane contro il banco: avvicinati a 7 e mezzo senza sballare. Il re di denari è la matta.',
    alias: ['sette e mezzo', '7 e mezzo', 'settemezzo', 'carte napoletane', 'matta', 'banco'],
    opzioni: [
      { id: 'banco', nome: 'Il banco', valori: SOGLIE, etichette: ['Il banco sta a 5', 'Il banco sta a 6'], predefinito: 5 },
    ],
    regole: [
      'Si gioca con le 40 carte napoletane (denari, coppe, spade e bastoni) contro il banco, che è il computer. Ogni giocatore parte con 1000 fiche; quando le finisci puoi scrivere !ricarica in chat per averne altre 1000.',
      'Valori: dall\'asso al 7 le carte valgono il loro numero; fante, cavallo e re valgono mezzo punto. Il RE DI DENARI è la matta: vale quello che serve (mezzo punto o un numero intero da 1 a 7), sempre in modo da fare il punteggio migliore.',
      'Puntate: tutti puntano insieme quanto vogliono, scegliendo le fiche. Dopo la prima puntata gli altri hanno 20 secondi, poi chi non ha puntato salta la mano. Puoi anche passare.',
      'Ognuno riceve una carta coperta, che vede solo lui; anche il banco ne riceve una. Poi, a turno, si chiedono carte scoperte quante se ne vuole, per avvicinarsi a 7 e mezzo senza superarlo. Chi supera 7 e mezzo ha sballato e perde subito la puntata. Hai 30 secondi per decidere, poi stai automaticamente.',
      'Il banco gioca per ultimo con una regola fissa: scopre la sua carta e pesca finché non arriva almeno a 5 (oppure a 6, da scegliere prima della partita), poi si ferma. Se tutti hanno sballato non pesca.',
      'Pagamenti: se fai più punti del banco, o se il banco sballa, vinci quanto hai puntato. Se il banco fa gli stessi punti vince lui (il banco vince le parità).',
      'SETTE E MEZZO con due carte (un 7 e una figura, anche con la matta) paga doppio: vinci il doppio della puntata. Lo batte solo un sette e mezzo con due carte del banco.',
      'Si mescola tutto il mazzo a ogni mano. Il pulsante 💡 Consiglio mostra la probabilità di sballare chiedendo un\'altra carta, calcolata sulle carte che non hai ancora visto (il mazzo e le carte coperte), e cosa farebbe il computer difficile.',
      'Il computer facile chiede carte un po\' a caso finché è sotto il 5; il medio usa una soglia fissa (sta da 5 in su, da 4 in su se il banco sta a 6); il difficile calcola la probabilità di sballare e quanto rende fermarsi o chiedere, sapendo come gioca il banco e quali carte sono già uscite. I computer seduti al tavolo si ricaricano da soli quando finiscono le fiche.',
    ],
  },
  crea: (o) => new SetteMezzo(o),
  bot,
  _test: { conta, contaMezzi, mazzo40, sceltaDifficile, finaleBanco, distribuzione, evStai, fmt, MATTA },
};
