// VIDEO POKER "Jacks or Better" (fanti o meglio), da soli contro la macchina, con le fiche del casinò.
// Si punta da 1 a 5 crediti (il valore di un credito in fiche si sceglie prima di iniziare), arrivano 5 carte,
// si tengono quelle che si vuole e si cambiano le altre una volta sola. Paga la tabella delle vincite.
// Il consiglio (e il computer difficile) calcola il valore atteso ESATTO di tutte le 32 scelte possibili,
// provando tutte le carte che possono arrivare (fino a 1,5 milioni di mani per la scelta "cambia tutto").
const { mescola } = require('../giochi/carte');
const T = require('../giochi/trucco');
const MV = require('../giochi/mano-vincente');

const SEMI = ['c', 'q', 'f', 'p'];
const CREDITI = [1, 5, 10, 25]; // fiche per credito
const MAX_CREDITI = 5;
// righe della tabella, dalla più alta: vincita per credito (9/6 = full 9, colore 6: la tabella "intera")
const RIGHE = ['royal', 'scalaColore', 'poker', 'full', 'colore', 'scala', 'tris', 'doppia', 'coppia'];
const NOMI = {
  royal: 'Scala reale', scalaColore: 'Scala colore', poker: 'Poker', full: 'Full', colore: 'Colore',
  scala: 'Scala', tris: 'Tris', doppia: 'Doppia coppia', coppia: 'Coppia di fanti o meglio', nulla: 'Niente',
};
const TABELLE = {
  96: { royal: 250, scalaColore: 50, poker: 25, full: 9, colore: 6, scala: 4, tris: 3, doppia: 2, coppia: 1 },
  85: { royal: 250, scalaColore: 50, poker: 25, full: 8, colore: 5, scala: 4, tris: 3, doppia: 2, coppia: 1 },
};
const ROYAL_5 = 800; // con 5 crediti la scala reale paga 800 per credito (4000)

function mazzo52() {
  const m = [];
  for (const s of SEMI) for (let r = 1; r <= 13; r++) m.push({ id: `${r}${s}`, rango: r, seme: s });
  return m;
}

// ---------- valutazione veloce (carte come numeri 0..51: valore = c % 13 con 0 = due … 12 = asso, seme = c / 13) ----------
const numero = (c) => SEMI.indexOf(c.seme) * 13 + (c.rango === 1 ? 12 : c.rango - 2);
const SCALE = new Uint8Array(8192);
for (let alto = 4; alto <= 12; alto++) { let m = 0; for (let k = 0; k < 5; k++) m |= 1 << (alto - k); SCALE[m] = 1; }
SCALE[(1 << 12) | 0b1111] = 1; // A-2-3-4-5
const MASCHERA_ROYAL = 0b1111100000000; // 10 J Q K A
const CAT = { nulla: 0, coppia: 1, doppia: 2, tris: 3, scala: 4, colore: 5, full: 6, poker: 7, scalaColore: 8, royal: 9 };
const NOME_CAT = Object.fromEntries(Object.entries(CAT).map(([k, v]) => [v, k]));

// categoria di 5 carte (numeri)
function categoria(cs) {
  const cnt = new Array(13).fill(0);
  let maschera = 0;
  const s0 = Math.floor(cs[0] / 13);
  let colore = true;
  for (const c of cs) { const r = c % 13; cnt[r]++; maschera |= 1 << r; if (Math.floor(c / 13) !== s0) colore = false; }
  let n2 = 0, n3 = 0, n4 = 0, alte = 0;
  for (let r = 0; r < 13; r++) { if (cnt[r] === 2) { n2++; if (r >= 9) alte++; } else if (cnt[r] === 3) n3++; else if (cnt[r] === 4) n4++; }
  if (n4) return CAT.poker;
  if (n3 && n2) return CAT.full;
  if (n3) return CAT.tris;
  if (n2 === 2) return CAT.doppia;
  if (n2 === 1) return alte ? CAT.coppia : CAT.nulla;
  const scala = SCALE[maschera] === 1;
  if (scala && colore) return maschera === MASCHERA_ROYAL ? CAT.royal : CAT.scalaColore;
  if (colore) return CAT.colore;
  if (scala) return CAT.scala;
  return CAT.nulla;
}

// vincita per credito di ogni categoria (indice = CAT), con 5 crediti la scala reale vale di più
function pagamenti(tabella, crediti) {
  const t = TABELLE[tabella] || TABELLE[96];
  const v = new Array(10).fill(0);
  for (const k of RIGHE) v[CAT[k]] = t[k];
  if (crediti === MAX_CREDITI) v[CAT.royal] = ROYAL_5;
  return v;
}

// Valore atteso esatto (in crediti, per credito puntato) di tenere "tenute" (numeri) e pescare le altre dal resto.
// Si provano tutte le combinazioni con contatori aggiornati passo passo: niente oggetti creati nel ciclo.
function valoreAtteso(tenute, resto, paga) {
  const cnt = new Int8Array(13);
  const sc = new Int8Array(4);
  let maschera = 0, n2 = 0, n3 = 0, n4 = 0, alte = 0;
  const metti = (c) => {
    const r = c % 13;
    const x = cnt[r]++;
    if (x === 0) maschera |= 1 << r;
    else if (x === 1) { n2++; if (r >= 9) alte++; }
    else if (x === 2) { n2--; n3++; if (r >= 9) alte--; }
    else if (x === 3) { n3--; n4++; }
    sc[(c / 13) | 0]++;
  };
  const togli = (c) => {
    const r = c % 13;
    const x = --cnt[r];
    if (x === 0) maschera &= ~(1 << r);
    else if (x === 1) { n2--; if (r >= 9) alte--; }
    else if (x === 2) { n3--; n2++; if (r >= 9) alte++; }
    else if (x === 3) { n4--; n3++; }
    sc[(c / 13) | 0]--;
  };
  for (const c of tenute) metti(c);
  const pagaFoglia = () => {
    if (n4) return paga[7];
    if (n3) return n2 ? paga[6] : paga[3];
    if (n2 === 2) return paga[2];
    if (n2 === 1) return alte ? paga[1] : 0;
    const colore = sc[0] === 5 || sc[1] === 5 || sc[2] === 5 || sc[3] === 5;
    if (SCALE[maschera]) return colore ? (maschera === MASCHERA_ROYAL ? paga[9] : paga[8]) : paga[4];
    return colore ? paga[5] : 0;
  };
  const k = 5 - tenute.length;
  const n = resto.length;
  let somma = 0, casi = 0;
  const giro = (da, manca) => {
    if (manca === 0) { somma += pagaFoglia(); casi++; return; }
    for (let i = da; i <= n - manca; i++) { metti(resto[i]); giro(i + 1, manca - 1); togli(resto[i]); }
  };
  giro(0, k);
  return somma / casi;
}

// la scelta migliore: le 32 possibilità, ognuna con il suo valore atteso
function migliorScelta(carte, morte, paga) {
  const nums = carte.map(numero);
  const fuori = new Set([...nums, ...morte.map(numero)]);
  const resto = [];
  for (let c = 0; c < 52; c++) if (!fuori.has(c)) resto.push(c);
  const scelte = [];
  for (let m = 0; m < 32; m++) {
    const tenute = nums.filter((_, i) => m & (1 << i));
    scelte.push({ maschera: m, ev: valoreAtteso(tenute, resto, paga) });
  }
  scelte.sort((a, b) => b.ev - a.ev || bitCount(b.maschera) - bitCount(a.maschera));
  return { tieni: carte.filter((_, i) => scelte[0].maschera & (1 << i)).map((c) => c.id), ev: scelte[0].ev, scelte };
}
const bitCount = (m) => { let k = 0; while (m) { k += m & 1; m >>= 1; } return k; };

// ---------- strategia semplice (computer medio): la lista classica in ordine di priorità ----------
const alta = (c) => c.rango === 1 || c.rango >= 11;
const v14 = (c) => (c.rango === 1 ? 14 : c.rango);
function strategiaSemplice(carte) {
  const ids = (cs) => cs.map((c) => c.id);
  const cat = categoria(carte.map(numero));
  const perValore = {};
  for (const c of carte) (perValore[v14(c)] = perValore[v14(c)] || []).push(c);
  const gruppi = Object.values(perValore).filter((g) => g.length >= 2);
  const perSeme = SEMI.map((s) => carte.filter((c) => c.seme === s));
  const verso = (n, filtro) => { for (const g of perSeme) { const x = g.filter(filtro); if (x.length >= n) return x.slice(0, n); } return null; };
  const royal = (n) => verso(n, (c) => v14(c) >= 10);
  // n carte dello stesso seme dentro una finestra di 5 valori (progetto di scala colore)
  const versoScalaColore = (n) => {
    for (const g of perSeme) {
      if (g.length < n) continue;
      for (let basso = 1; basso <= 10; basso++) {
        const dentro = g.filter((c) => { const v = basso === 1 && c.rango === 1 ? 1 : v14(c); return v >= basso && v < basso + 5; });
        if (dentro.length >= n) return dentro.slice(0, n);
      }
    }
    return null;
  };
  // 4 carte di scala aperta (4 valori di fila, non A-2-3-4 né J-Q-K-A)
  const scalaAperta = () => {
    const vs = [...new Set(carte.map(v14))];
    for (let basso = 2; basso <= 10; basso++) if ([0, 1, 2, 3].every((k) => vs.includes(basso + k))) return [0, 1, 2, 3].map((k) => carte.find((c) => v14(c) === basso + k));
    return null;
  };
  if (cat >= CAT.full || cat === CAT.poker) return cat === CAT.poker ? ids(carte.filter((c) => perValore[v14(c)].length === 4)) : ids(carte);
  let x = royal(4); if (x) return ids(x);
  if (cat >= CAT.scala) return ids(carte);
  if (cat === CAT.tris) return ids(gruppi[0]);
  x = versoScalaColore(4); if (x) return ids(x);
  if (cat === CAT.doppia) return ids(gruppi.flat());
  if (cat === CAT.coppia) return ids(gruppi[0]);
  x = royal(3); if (x) return ids(x);
  x = verso(4, () => true); if (x) return ids(x);
  if (gruppi.length) return ids(gruppi[0]); // coppia bassa
  x = scalaAperta(); if (x) return ids(x);
  x = verso(2, alta); if (x) return ids(x);
  x = versoScalaColore(3); if (x) return ids(x);
  const alteCarte = carte.filter(alta).sort((a, b) => v14(a) - v14(b));
  if (alteCarte.length >= 2) return ids(alteCarte.slice(0, 2));
  x = verso(2, (c) => v14(c) >= 10); if (x) return ids(x);
  if (alteCarte.length) return ids(alteCarte.slice(0, 1));
  return [];
}
// facile: tiene le combinazioni fatte e le carte alte, niente progetti
function strategiaFacile(carte) {
  const cat = categoria(carte.map(numero));
  if (cat >= CAT.scala) return carte.map((c) => c.id);
  const perValore = {};
  for (const c of carte) (perValore[v14(c)] = perValore[v14(c)] || []).push(c);
  const doppie = Object.values(perValore).filter((g) => g.length >= 2).flat();
  if (doppie.length) return doppie.map((c) => c.id);
  return carte.filter(alta).map((c) => c.id);
}

class VideoPoker {
  constructor({ n = 1, fiche, opzioni = {} }) {
    this.id = 'videopoker';
    this.n = 1;
    this.fiche = [fiche && Number.isFinite(fiche[0]) ? fiche[0] : 1000];
    this.credito = CREDITI.includes(Number(opzioni.credito)) ? Number(opzioni.credito) : 5;
    this.tabella = TABELLE[opzioni.tabella] ? String(opzioni.tabella) : '96';
    this.fase = 'puntata';
    this.turno = 0;
    this.finita = false;
    this.risultato = null;
    this.inAttesa = false;
    this.pausaMs = 0;
    this.evento = null;
    this.nEv = 0;
    this.nMano = 0;
    this.carte = [];
    this.tenute = [];
    this.crediti = Math.min(MAX_CREDITI, Math.max(1, Math.floor(this.fiche[0] / this.credito))) || 1;
    this.puntata = 0; // fiche puntate nella mano in corso
    this.esito = null;
    this.storia = []; // ultime mani: { cat, vinto }
    this.conti = { mani: 0, puntate: 0, vinte: 0, perRiga: {} };
    this.consiglio = null;
  }

  annuncia(testo, forte = false) { this.evento = { id: ++this.nEv, posto: null, testo, testoIo: testo, forte }; }
  ficheDi() { return this.fiche[0]; }
  ricarica(p, quante) { this.fiche[0] += quante; }
  ficheInGioco() { return this.fase === 'cambio' ? 1 : 0; }
  paga() { return pagamenti(this.tabella, this.puntata && this.creditiMano); }

  azione(p, a) {
    if (p !== 0) return { errore: 'Qui si gioca da soli' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (a.tipo === 'distribuisci') {
      if (this.fase === 'cambio') return { errore: 'Prima scegli le carte da tenere e cambia' };
      const crediti = Number(a.crediti);
      if (!Number.isInteger(crediti) || crediti < 1 || crediti > MAX_CREDITI) return { errore: 'Puoi puntare da 1 a 5 crediti' };
      let puntata = crediti * this.credito;
      if (puntata > this.fiche[0]) {
        // ultime fiche: se non basta nemmeno un credito si possono giocare tutte come puntata da un credito
        if (crediti === 1 && this.fiche[0] > 0) puntata = this.fiche[0];
        else return { errore: this.fiche[0] > 0 ? `Hai solo ${this.fiche[0]} fiche` : 'Hai finito le fiche: scrivi !ricarica in chat' };
      }
      this.fiche[0] -= puntata;
      this.puntata = puntata;
      this.crediti = crediti;
      this.creditiMano = crediti;
      this.mazzo = mescola(mazzo52());
      if (T.consuma(this, 0)) this.servi(); // il trucco segreto (!win): poker o scala reale servita
      this.carte = this.mazzo.splice(-5);
      this.tenute = [];
      this.esito = null;
      this.fase = 'cambio';
      this.nMano++;
      this.consiglio = null; // si calcola solo se serve (vista con il consiglio acceso, o computer)
      return { ok: true };
    }
    if (a.tipo === 'cambia') {
      if (this.fase !== 'cambio') return { errore: 'Prima distribuisci le carte' };
      if (!Array.isArray(a.tieni) || a.tieni.length > 5) return { errore: 'Scegli le carte da tenere' };
      const tieni = [...new Set(a.tieni.map(String))];
      if (!tieni.every((id) => this.carte.some((c) => c.id === id))) return { errore: 'Queste carte non sono tue' };
      this.carte = this.carte.map((c) => (tieni.includes(c.id) ? c : this.mazzo.pop()));
      this.tenute = tieni;
      return this.chiudi();
    }
    return { errore: 'Mossa non valida' };
  }

  // il trucco segreto (!win !parola): le cinque carte servite diventano una mano forte (full, colore, scala, poker…);
  // poi sei tu a scegliere cosa tenere. Prima di distribuire si aspetta la mano.
  manoVincente() {
    if (this.fase !== 'cambio') return null;
    const pool = [...this.mazzo, ...this.carte];
    const nuove = MV.manoPoker(pool);
    if (!nuove) return null;
    this.mazzo = mescola(pool.filter((c) => !nuove.includes(c)));
    this.carte = nuove;
    this.consiglio = null;
    return '🃏 Mano cambiata: tieni le carte giuste e cambia';
  }

  // mette in cima al mazzo un poker (con una quinta carta a caso) oppure, una volta su cinque, una scala reale
  servi() {
    const seme = SEMI[Math.floor(Math.random() * 4)], rango = 1 + Math.floor(Math.random() * 13);
    const buone = Math.random() < 0.2
      ? this.mazzo.filter((c) => c.seme === seme && (c.rango === 1 || c.rango >= 10))
      : this.mazzo.filter((c) => c.rango === rango);
    if (buone.length === 4) buone.push(this.mazzo.find((c) => c.rango !== rango));
    const resto = this.mazzo.filter((c) => !buone.includes(c));
    this.mazzo = [...resto, ...mescola(buone)];
  }

  chiudi() {
    const cat = categoria(this.carte.map(numero));
    const nome = NOME_CAT[cat];
    const perCredito = this.paga()[cat];
    // la puntata di un credito "ridotta" (ultime fiche) vale come un credito di quel valore
    const unita = this.puntata / this.creditiMano;
    const vinto = Math.round(perCredito * unita * this.creditiMano);
    this.fiche[0] += vinto;
    this.esito = { riga: cat ? nome : null, nome: NOMI[nome], vinto, netto: vinto - this.puntata, creditiVinti: perCredito * this.creditiMano };
    this.conti.mani++;
    this.conti.puntate += this.puntata;
    this.conti.vinte += vinto;
    if (cat) this.conti.perRiga[nome] = (this.conti.perRiga[nome] || 0) + 1;
    this.storia.unshift({ nome: cat ? nome : null, vinto: vinto - this.puntata });
    this.storia = this.storia.slice(0, 8);
    this.fase = 'esito';
    if (cat >= CAT.full) this.annuncia(`${NOMI[nome]}! Vinci ${vinto} fiche`, true);
    else if (vinto) this.annuncia(`${NOMI[nome]}: vinci ${vinto} fiche`);
    // la puntata resta quella di prima, se ci sono le fiche
    while (this.crediti > 1 && this.crediti * this.credito > this.fiche[0]) this.crediti--;
    return { ok: true };
  }

  calcolaConsiglio() {
    if (this.fase !== 'cambio') return null;
    if (!this.consiglio) {
      const m = migliorScelta(this.carte, [], this.paga());
      // le alternative più vicine, per far vedere quanto si perde con le altre scelte
      const altre = m.scelte.slice(1, 4).map((s) => ({ tieni: this.carte.filter((_, i) => s.maschera & (1 << i)).map((c) => c.id), ev: s.ev }));
      this.consiglio = { tieni: m.tieni, ev: m.ev, altre, tutte: m.scelte.map((s) => ({ m: s.maschera, ev: s.ev })) };
    }
    return this.consiglio;
  }

  // assente (dispense): nel cambio gioca il consiglio
  salta() { if (this.fase === 'cambio') this.azione(0, { tipo: 'cambia', tieni: this.calcolaConsiglio().tieni }); }

  vista(p, opz = {}) {
    const paga = pagamenti(this.tabella, MAX_CREDITI);
    const t = TABELLE[this.tabella];
    const c = this.calcolaConsiglio();
    return {
      gioco: this.id, n: 1, fase: this.fase, turno: this.turno, inAttesa: false, pausaMs: 0,
      fiche: this.fiche, credito: this.credito, crediti: this.crediti, creditiMano: this.creditiMano || this.crediti, puntata: this.puntata,
      carte: this.carte, tenute: this.tenute, esito: this.esito, storia: this.storia, nMano: this.nMano,
      tabella: RIGHE.map((k) => ({ k, nome: NOMI[k], paga: [1, 2, 3, 4, 5].map((n) => (k === 'royal' && n === 5 ? ROYAL_5 * 5 : t[k] * n)) })),
      nomeTabella: this.tabella === '96' ? '9/6' : '8/5',
      consiglio: c ? { tieni: c.tieni, ev: Math.round(c.ev * 1000) / 1000, altre: c.altre.map((x) => ({ tieni: x.tieni, ev: Math.round(x.ev * 1000) / 1000 })), tutte: c.tutte.map((x) => ({ m: x.m, ev: Math.round(x.ev * 1000) / 1000 })) } : null,
      conti: this.conti, rendimento: paga && this.conti.puntate ? Math.round((this.conti.vinte / this.conti.puntate) * 1000) / 10 : null,
      finita: false, risultato: null, evento: this.evento,
    };
  }
}

function bot(g, p, livello) {
  if (g.fase !== 'cambio') {
    const crediti = Math.max(1, Math.min(MAX_CREDITI, Math.floor(g.fiche[0] / g.credito)));
    return { tipo: 'distribuisci', crediti: livello === 'facile' ? Math.max(1, Math.min(crediti, 1 + Math.floor(Math.random() * 3))) : crediti };
  }
  if (livello === 'facile') return { tipo: 'cambia', tieni: strategiaFacile(g.carte) };
  if (livello === 'medio') return { tipo: 'cambia', tieni: strategiaSemplice(g.carte) };
  return { tipo: 'cambia', tieni: g.calcolaConsiglio().tieni };
}

module.exports = {
  meta: {
    id: 'videopoker',
    nome: 'Video poker',
    tipo: 'tabellone',
    fiche: true,
    soloPersone: true,
    giocatori: [1],
    descrizione: 'Jacks or Better come alla macchinetta del casinò: tieni le carte buone, cambia le altre e guarda la tabella delle vincite.',
    alias: ['video poker', 'videopoker', 'jacks or better', 'fanti o meglio', 'macchinetta', 'poker da bar', 'slot poker'],
    opzioni: [
      { id: 'credito', nome: 'Valore di un credito', valori: CREDITI, etichette: ['1 fiche', '5 fiche', '10 fiche', '25 fiche'], predefinito: 5 },
      { id: 'tabella', nome: 'Tabella delle vincite', valori: ['96', '85'], etichette: ['9/6 (intera: full 9, colore 6)', '8/5 (full 8, colore 5)'], predefinito: '96' },
    ],
    regole: [
      'Si gioca da soli contro la macchina, con un mazzo da 52 carte che si rimescola a ogni mano. Parti con 1000 fiche; quando le finisci scrivi !ricarica in chat per averne altre 1000.',
      'Scegli quanti crediti puntare, da 1 a 5 (prima di iniziare si sceglie quante fiche vale un credito). Premi Distribuisci: arrivano 5 carte scoperte.',
      'Clicca le carte che vuoi tenere (sul computer puoi usare anche i tasti da 1 a 5): sotto compare TENUTA. Poi premi Cambia: le carte non tenute vengono sostituite, una volta sola. Invio o la barra spaziatrice fanno Distribuisci e Cambia.',
      'Si vince con la mano finale secondo la tabella in alto (vincite per credito con la tabella 9/6): coppia di fanti o meglio (fanti, donne, re o assi) 1, doppia coppia 2, tris 3, scala 4, colore 6, full 9, poker 25, scala colore 50, scala reale 250. Con 5 crediti la scala reale paga 800 per credito (4000 crediti): per questo conviene puntare il massimo.',
      'La coppia di 10 o più bassa non paga. L\'asso vale sia come carta più alta sia nella scala A-2-3-4-5. La tabella 8/5 paga il full 8 e il colore 5.',
      'Nella tabella la colonna della tua puntata è evidenziata e, a fine mano, la riga vinta si illumina.',
      'Il pulsante 💡 Consiglio mostra quali carte tenere secondo la strategia ottimale: per ognuna delle 32 scelte possibili si calcola il valore atteso esatto, provando tutte le carte che possono arrivare. Con la tabella 9/6 e la strategia perfetta la macchina restituisce il 99,5% di quanto si punta.',
      'Il computer non gioca contro di te. Se apri le dispense durante il cambio, la mano viene chiusa con le carte consigliate.',
    ],
  },
  crea: (o) => new VideoPoker(o),
  bot,
  _test: { categoria, numero, valoreAtteso, migliorScelta, pagamenti, strategiaSemplice, strategiaFacile, CAT, mazzo52 },
};
