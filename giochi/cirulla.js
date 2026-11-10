// CIRULLA: la scopa ligure. Regole più diffuse: prese come nella scopa più la presa da 15, asso piglia tutto
// (vale scopa), 7 di cuori matta per gli accusi, quindici o trenta in tavola all'inizio, bàrsega e decino,
// Grande e Piccola di quadri, capotto. Si vince a 51.
const { mazzo40, mescola, valore40, SEMI } = require('./carte');
const T = require('./trucco');

const PRIMIERA = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 11: 10, 12: 10, 13: 10 };
const OBIETTIVI = [51, 31, 101];
const MATTA = '7c';
const val = (c) => (c.vale != null ? c.vale : valore40(c)); // la matta dichiarata tiene il valore scelto finché non viene presa
const eAsso = (c) => c.rango === 1; // solo un asso vero piglia tutto

// sottoinsiemi del tavolo (almeno "minimo" carte) la cui somma è s
function somme(tavolo, s, minimo) {
  const out = [];
  const rec = (i, tot, scelte) => {
    if (tot === s && scelte.length >= minimo) out.push(scelte.slice());
    if (tot >= s) return;
    for (let j = i; j < tavolo.length; j++) { scelte.push(tavolo[j].id); rec(j + 1, tot + val(tavolo[j]), scelte); scelte.pop(); }
  };
  rec(0, 0, []);
  return out;
}

// tutte le prese possibili giocando "carta" (ognuna è l'elenco delle carte prese in tavola)
function presePossibili(carta, tavolo) {
  if (!tavolo.length) return [];
  const v = val(carta);
  let ops;
  if (eAsso(carta) && carta.vale == null) {
    const assi = tavolo.filter((c) => eAsso(c) && c.vale == null);
    // senza assi in tavola l'asso prende tutto; con un asso in tavola prende quello oppure fa quindici
    if (!assi.length) return [tavolo.map((c) => c.id)];
    ops = [...assi.map((c) => [c.id]), ...somme(tavolo, 15 - v, 1)];
  } else {
    ops = [...tavolo.filter((c) => val(c) === v).map((c) => [c.id]), ...somme(tavolo, v, 2), ...somme(tavolo, 15 - v, 1)];
  }
  const viste = new Set();
  return ops.filter((o) => { const k = [...o].sort().join(); if (viste.has(k)) return false; viste.add(k); return true; });
}
const stessoInsieme = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// accuso con le tre carte in mano: decino (tre uguali, 10 scope) o bàrsega (somma sotto 10, 3 scope).
// La matta può valere quanto serve per l'accuso; se non serve resta un 7.
function accuso(mano) {
  if (mano.length !== 3) return null;
  const altre = mano.filter((c) => c.id !== MATTA);
  const matta = altre.length < 3;
  const vs = altre.map(valore40);
  if (!matta && vs[0] === vs[1] && vs[1] === vs[2]) return { tipo: 'decino', scope: 10 };
  if (matta && vs[0] === vs[1]) return { tipo: 'decino', scope: 10, matta: vs[0] };
  const somma = vs.reduce((a, b) => a + b, 0) + (matta ? 1 : 0);
  if (somma < 10) return { tipo: 'barsega', scope: 3, matta: matta ? 1 : undefined };
  return null;
}

// somma iniziale della tavola: 15 o 30, con la matta che può valere da 1 a 10
function quindiciIniziale(tavola) {
  const altre = tavola.filter((c) => c.id !== MATTA);
  const s = altre.reduce((a, c) => a + valore40(c), 0);
  if (altre.length === tavola.length) return s === 30 ? 2 : s === 15 ? 1 : 0;
  for (const obiettivo of [30, 15]) { const x = obiettivo - s; if (x >= 1 && x <= 10) return obiettivo === 30 ? 2 : 1; }
  return 0;
}

function conta(prese, scope) {
  return prese.map((pr, f) => {
    const q = new Set(pr.filter((c) => c.seme === 'q').map((c) => c.rango));
    const migliori = SEMI.map((s) => Math.max(0, ...pr.filter((c) => c.seme === s).map((c) => PRIMIERA[c.rango])));
    let piccola = 0;
    if (q.has(1) && q.has(2) && q.has(3)) { piccola = 3; for (let r = 4; r <= 6 && q.has(r); r++) piccola++; }
    return {
      carte: pr.length,
      quadri: q.size,
      settebello: q.has(7),
      primiera: migliori.every((x) => x > 0) ? migliori.reduce((a, b) => a + b, 0) : 0,
      grande: q.has(11) && q.has(12) && q.has(13) ? 5 : 0,
      piccola,
      capotto: q.size === 10,
      scope: scope[f],
      punti: 0,
    };
  });
}
// il trucco segreto (!win): porta nella mano la prima carta che va bene, presa da una delle fonti (mazzo o mani degli
// altri), dando in cambio la carta peggiore tra quelle non da tenere: niente doppioni, il numero di carte non cambia
function prendiCarta(mano, fonti, vuoi, tieni, peggiore) {
  const gia = mano.find((c) => vuoi(c) && !tieni.has(c));
  if (gia) { tieni.add(gia); return gia; }
  const via = peggiore(mano.filter((c) => !tieni.has(c)));
  if (!via) return null;
  for (const f of fonti) {
    const i = f.findIndex(vuoi);
    if (i < 0) continue;
    const c = f[i];
    f[i] = via;
    mano[mano.indexOf(via)] = c;
    tieni.add(c);
    return c;
  }
  return null;
}

function unico(valori) {
  const m = Math.max(...valori);
  if (m <= 0) return -1;
  return valori.filter((x) => x === m).length === 1 ? valori.indexOf(m) : -1;
}

class Cirulla {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'cirulla';
    this.n = n;
    this.aSquadre = n === 4;
    this.nFazioni = this.aSquadre ? 2 : n;
    this.obiettivo = OBIETTIVI.includes(Number(opzioni.punti)) ? Number(opzioni.punti) : 51;
    this.totali = new Array(this.nFazioni).fill(0);
    this.mazziere = (primo - 1 + n) % n;
    this.nSmazzata = 0;
    this.nEv = 0; this.evento = null;
    this.finita = false; this.risultato = null;
    this.chatDa = [];
    this.pausaMs = 1300;
    this.nuovaSmazzata();
  }

  fazione(p) { return this.aSquadre ? p % 2 : p; }
  postiFazione(f) { return this.aSquadre ? [f, f + 2] : [f]; }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  nuovaSmazzata() {
    const n = this.n;
    this.mazziere = (this.mazziere + 1) % n;
    // due o più assi in tavola: si ridà
    do {
      this.mazzo = mescola(mazzo40());
      this.tavolo = this.mazzo.splice(-4);
    } while (this.tavolo.filter(eAsso).length >= 2);
    this.mani = Array.from({ length: n }, () => []);
    this.prese = Array.from({ length: this.nFazioni }, () => []);
    this.scope = new Array(this.nFazioni).fill(0);
    this.accusi = []; // storico della smazzata: { posto, tipo, scope, carte }
    this.scoperte = new Array(n).fill(false); // mano accusata: resta scoperta per tutti
    this.valutata = new Array(n).fill(false);
    this.ultimaPresa = null;
    this.fase = 'gioco';
    this.inAttesa = false;
    this.inCorso = null;
    this.riepilogo = null;
    this.quindici = null;
    // quindici o trenta in tavola: il mazziere prende tutto e segna una o due scope
    const q = quindiciIniziale(this.tavolo);
    if (q) {
      const f = this.fazione(this.mazziere);
      this.quindici = { posto: this.mazziere, scope: q, carte: this.tavolo.slice() };
      this.prese[f].push(...this.tavolo);
      this.scope[f] += q;
      this.tavolo = [];
      this.ultimaPresa = this.mazziere;
      this.annuncia(this.mazziere, `trova ${q === 2 ? 'trenta' : 'quindici'} in tavola: prende tutto e segna ${q === 2 ? 'due scope' : 'una scopa'}!`, `trovi ${q === 2 ? 'trenta' : 'quindici'} in tavola: prendi tutto e segni ${q === 2 ? 'due scope' : 'una scopa'}!`, true);
    }
    this.distribuisci();
    this.impostaTurno((this.mazziere + 1) % n);
  }

  distribuisci() {
    const da = (this.mazziere + 1) % this.n;
    for (let g = 0; g < 3; g++) for (let i = 0; i < this.n; i++) this.mani[(da + i) % this.n].push(this.mazzo.pop());
    this.scoperte.fill(false);
    this.valutata.fill(false);
    for (let p = 0; p < this.n; p++) if (T.consuma(this, p)) this.truccaMano(p);
  }

  // il trucco segreto (!win): la mano appena data diventa un DECINO (tre carte uguali: +10 scope quando tocca a lui),
  // con le carte prese dal mazzo o dalle mani appena date agli avversari; se non si può, asso (piglia tutto) e settebello
  truccaMano(p) {
    const mano = this.mani[p];
    const altri = this.mani.filter((m, q) => m !== mano && this.fazione(q) !== this.fazione(p));
    const fonti = [this.mazzo, ...altri];
    const tutte = [mano, ...fonti].flat();
    const quante = (v) => tutte.filter((c) => valore40(c) === v && c.id !== MATTA).length;
    // il valore da triplicare: uno che c'è già in mano, se ne restano abbastanza in giro (meglio i 7 per la primiera)
    const valori = [7, 6, 1, 5, 4, 3, 2, 8, 9, 10].filter((v) => quante(v) >= 3);
    const inMano = (v) => mano.filter((c) => valore40(c) === v && c.id !== MATTA).length;
    valori.sort((a, b) => inMano(b) - inMano(a));
    const tieni = new Set();
    const peggiore = (cs) => T.migliore(cs, (c) => -pregio(c));
    if (valori.length) {
      const v = valori[0];
      for (let k = 0; k < 3; k++) prendiCarta(mano, fonti, (c) => valore40(c) === v && c.id !== MATTA, tieni, peggiore);
      return;
    }
    prendiCarta(mano, fonti, (c) => c.rango === 1, tieni, peggiore);
    prendiCarta(mano, fonti, (c) => c.id === '7q', tieni, peggiore);
  }

  // all'inizio del proprio turno, con tre carte in mano, l'accuso si fa da solo (si "bussa")
  impostaTurno(p) {
    this.turno = p;
    const mano = this.mani[p];
    if (this.valutata[p] || mano.length !== 3) return;
    this.valutata[p] = true;
    const a = accuso(mano);
    if (!a) return;
    const f = this.fazione(p);
    this.scope[f] += a.scope;
    this.scoperte[p] = true;
    const matta = mano.find((c) => c.id === MATTA);
    if (matta && a.matta != null) matta.vale = a.matta;
    const nome = a.tipo === 'decino' ? 'DECINO' : 'BÀRSEGA';
    this.accusi.push({ posto: p, tipo: a.tipo, scope: a.scope, carte: mano.map((c) => ({ ...c })) });
    this.annuncia(p, `bussa: ${nome}! +${a.scope} scope 👊`, `bussi: ${nome}! +${a.scope} scope 👊`, true);
    this.chatDa.push({ posto: p, testo: `👊 ${nome}! (${a.tipo === 'decino' ? 'tre carte uguali' : 'somma sotto 10'}: +${a.scope} scope)` });
  }

  opzioniDi(p) {
    const o = {};
    for (const c of this.mani[p]) o[c.id] = presePossibili(c, this.tavolo);
    return o;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta un attimo' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || a.tipo !== 'gioca') return { errore: 'Mossa non valida' };
    const mano = this.mani[p];
    const i = mano.findIndex((c) => c.id === a.carta);
    if (i < 0) return { errore: 'Non hai questa carta' };
    const carta = mano[i];
    const ops = presePossibili(carta, this.tavolo);
    const scelta = Array.isArray(a.presa) ? a.presa.map(String) : [];
    let presa = null;
    if (ops.length) {
      if (scelta.length) presa = ops.find((o) => stessoInsieme(o, scelta));
      else if (ops.length === 1) presa = ops[0];
      if (!presa) return { errore: ops.length > 1 && !scelta.length ? 'Scegli quali carte prendere' : 'Questa presa non è valida' };
    } else if (scelta.length) return { errore: 'Con questa carta non puoi prendere nulla' };
    mano.splice(i, 1);
    if (!presa) {
      this.tavolo.push(carta);
      this.passa(p);
      return { ok: true };
    }
    this.inCorso = { posto: p, carta, presa };
    this.inAttesa = true;
    this.turno = null;
    this.pausaMs = 1300;
    return { ok: true };
  }

  avanza() {
    if (this.fase === 'riepilogo') { if (!this.finita) this.nuovaSmazzata(); return; }
    if (!this.inCorso) return;
    const { posto: p, carta, presa } = this.inCorso;
    this.inCorso = null;
    const prese = this.tavolo.filter((c) => presa.includes(c.id));
    this.tavolo = this.tavolo.filter((c) => !presa.includes(c.id));
    for (const c of [carta, ...prese]) delete c.vale; // la matta presa torna un 7
    const f = this.fazione(p);
    this.prese[f].push(carta, ...prese);
    this.ultimaPresa = p;
    const ultimaGiocata = this.mazzo.length === 0 && this.mani.every((m) => m.length === 0);
    if (this.tavolo.length === 0 && !ultimaGiocata) {
      this.scope[f]++;
      this.annuncia(p, eAsso(carta) && prese.length > 1 ? 'piglia tutto con l\'asso: scopa!' : 'fa scopa!', eAsso(carta) && prese.length > 1 ? 'pigli tutto con l\'asso: scopa!' : 'fai scopa!', true);
    }
    this.inAttesa = false;
    this.passa(p);
  }

  passa(p) {
    if (this.mani.every((m) => m.length === 0)) {
      if (this.mazzo.length) { this.distribuisci(); this.impostaTurno((p + 1) % this.n); } else this.fineSmazzata();
    } else this.impostaTurno((p + 1) % this.n);
  }

  fineSmazzata() {
    if (this.tavolo.length && this.ultimaPresa != null) this.prese[this.fazione(this.ultimaPresa)].push(...this.tavolo);
    const avanzo = this.tavolo.length;
    this.tavolo = [];
    const righe = conta(this.prese, this.scope);
    const assegnati = {
      carte: unico(righe.map((r) => r.carte)),
      quadri: unico(righe.map((r) => r.quadri)),
      settebello: righe.findIndex((r) => r.settebello),
      primiera: unico(righe.map((r) => r.primiera)),
    };
    for (const k of Object.keys(assegnati)) if (assegnati[k] >= 0) righe[assegnati[k]].punti++;
    righe.forEach((r, f) => {
      r.punti += r.scope + r.grande + r.piccola;
      this.totali[f] += r.punti;
      r.totale = this.totali[f];
      r.posti = this.postiFazione(f);
    });
    this.nSmazzata++;
    const capotto = righe.findIndex((r) => r.capotto);
    this.riepilogo = { righe, assegnati, smazzata: this.nSmazzata, avanzo, ultimaPresa: this.ultimaPresa, accusi: this.accusi, quindici: this.quindici, capotto };
    const max = Math.max(...this.totali);
    let vince = -1;
    if (capotto >= 0) vince = capotto; // tutte e dieci le quadri: partita vinta subito
    else if (max >= this.obiettivo && this.totali.filter((t) => t === max).length === 1) vince = this.totali.indexOf(max);
    if (vince >= 0) {
      this.finita = true;
      this.risultato = { fazioni: this.totali.map((t, f) => ({ posti: this.postiFazione(f), punti: t })), etichetta: 'punti', pareggio: false, vincitori: this.postiFazione(vince) };
      if (capotto >= 0) this.risultato.titolo = 'Capotto! Tutte e dieci le quadri';
    }
    this.fase = 'riepilogo';
    this.turno = null;
    this.inAttesa = !this.finita;
  }

  vista(p) {
    const mioTurno = this.turno === p && !this.inAttesa;
    return {
      gioco: this.id, n: this.n, aSquadre: this.aSquadre,
      mano: this.mani[p] || [], carteInMano: this.mani.map((m) => m.length),
      scoperte: this.mani.map((m, i) => (this.scoperte[i] && i !== p ? m : null)), // le mani accusate si vedono
      accusi: this.accusi, quindici: this.quindici,
      tavolo: this.tavolo,
      inCorso: this.inCorso ? { posto: this.inCorso.posto, carta: this.inCorso.carta, presa: this.inCorso.presa } : null,
      opzioni: mioTurno ? this.opzioniDi(p) : null,
      mazzo: this.mazzo.length, turno: this.turno, inAttesa: this.inAttesa, fase: this.fase, mazziere: this.mazziere,
      preseCarte: this.prese.map((x) => x.length), scope: this.scope, totali: this.totali, obiettivo: this.obiettivo,
      riepilogo: this.riepilogo, pausaMs: this.pausaMs, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
// quanto vale prendere una carta (per i punti di fine smazzata)
function pregio(c) {
  let s = 1;
  if (c.seme === 'q') {
    s += 1.2;
    if (c.rango === 7) s += 7;
    if (c.rango <= 3 || c.rango >= 11) s += 1.6; // Piccola e Grande
  }
  if (c.rango === 7) s += 2.5;
  else if (c.rango === 6) s += 1.2;
  else if (c.rango === 1) s += 0.8;
  return s;
}
const somma = (cs) => cs.reduce((a, c) => a + pregio(c), 0);
const SCOPA = 12;

function bot(g, p, livello) {
  const mano = g.mani[p];
  const mosse = [];
  for (const c of mano) {
    const ops = presePossibili(c, g.tavolo);
    if (ops.length) for (const o of ops) mosse.push({ carta: c, presa: o });
    else mosse.push({ carta: c, presa: [] });
  }
  const az = (m) => ({ tipo: 'gioca', carta: m.carta.id, presa: m.presa });
  if (livello === 'facile') {
    const prese = mosse.filter((m) => m.presa.length);
    if (prese.length && Math.random() < 0.6) return az(prese[Math.floor(Math.random() * prese.length)]);
    return az(mosse[Math.floor(Math.random() * mosse.length)]);
  }
  const ultimaGiocata = g.mazzo.length === 0 && g.mani.reduce((s, m) => s + m.length, 0) === 1;
  const viste = new Set([...mano, ...g.tavolo, ...g.prese.flat(), ...g.mani.flatMap((m, i) => (g.scoperte[i] ? m : []))].map((c) => c.id));
  const ignote = mazzo40().filter((c) => !viste.has(c.id));
  const prossimo = (p + 1) % g.n;
  const amico = (i) => g.fazione(i) === g.fazione(p);
  const carteProssimo = Math.max(1, g.mani[prossimo].length);

  // il meglio che può prendere chi gioca dopo di me con una certa carta
  const guadagno = (carta, tavolo) => {
    let best = 0;
    for (const o of presePossibili(carta, tavolo)) {
      const presi = tavolo.filter((t) => o.includes(t.id));
      let s = somma([carta, ...presi]);
      if (presi.length === tavolo.length) s += SCOPA;
      best = Math.max(best, s);
    }
    return best;
  };
  const rischio = (tavolo) => {
    if (!tavolo.length || amico(prossimo)) return 0;
    if (livello === 'medio') {
      // a occhio: tavola piccola (somma bassa o che fa 15 con una carta) = scopa facile; senza assi in tavola l'asso piglia tutto
      const s = tavolo.reduce((a, c) => a + val(c), 0);
      let r = s <= 10 || (s >= 5 && s <= 14) ? 8 : 0;
      if (!tavolo.some(eAsso)) r += 4;
      if (tavolo.some((c) => c.id === '7q')) r += 4;
      return r;
    }
    // difficile: per ogni carta che l'avversario potrebbe avere, probabilità per guadagno
    const perValore = new Map();
    for (const c of ignote) { const k = `${valore40(c)}-${eAsso(c)}`; if (!perValore.has(k)) perValore.set(k, { esempio: c, k: 0 }); perValore.get(k).k++; }
    let r = 0;
    for (const { esempio, k } of perValore.values()) {
      const prob = 1 - Math.pow(1 - k / ignote.length, carteProssimo);
      r = Math.max(r, prob * guadagno(esempio, tavolo));
    }
    return r;
  };

  let migliore = null, punteggio = -Infinity;
  for (const m of mosse) {
    let s, dopo;
    if (m.presa.length) {
      const presi = g.tavolo.filter((t) => m.presa.includes(t.id));
      dopo = g.tavolo.filter((t) => !m.presa.includes(t.id));
      s = somma([m.carta, ...presi]);
      if (!dopo.length && !ultimaGiocata) s += SCOPA;
    } else {
      dopo = [...g.tavolo, m.carta];
      s = -pregio(m.carta) * 0.6;
      if (m.carta.id === MATTA) s -= 1;
    }
    if (!ultimaGiocata && ignote.length) s -= rischio(dopo);
    if (livello === 'medio') s += Math.random() * 1.5;
    if (s > punteggio) { punteggio = s; migliore = m; }
  }
  return az(migliore);
}

module.exports = {
  meta: {
    id: 'cirulla',
    nome: 'Cirulla',
    giocatori: [2, 3, 4],
    descrizione: 'La scopa ligure: prese da 15, asso piglia tutto, matta, bàrsega e decino. Si vince a 51.',
    alias: ['cirulla', 'ciapachinze', 'scopa ligure', 'barsega', 'decino', 'scopa genovese'],
    opzioni: [
      { id: 'punti', nome: 'Si vince a', valori: OBIETTIVI, etichette: ['51 punti', '31 punti (partita corta)', '101 punti'], predefinito: 51 },
    ],
    regole: [
      'Si gioca con 40 carte francesi: dall\'asso al 7 più fante, donna e re, che valgono da 1 a 10 (fante 8, donna 9, re 10). Sulle figure c\'è un numerino in alto a destra con il loro valore; le carte in mano e in tavola sono in ordine. I quadri fanno da denari.',
      'Si gioca in 2, in 3 o in 4 (a coppie, con chi sta di fronte). Il mazziere cambia a ogni smazzata: dà 3 carte a testa e ne mette 4 scoperte in tavola. Finite le carte in mano se ne danno altre 3, fino alla fine del mazzo. Gioca per primo chi sta dopo il mazziere.',
      'Se in tavola all\'inizio ci sono due o più assi si ridà. Se le quattro carte in tavola fanno 15, il mazziere le prende tutte e segna una scopa; se fanno 30, due scope.',
      'Con la carta giocata si può prendere: una carta dello stesso valore, oppure più carte la cui somma è uguale alla carta giocata (come nella scopa), oppure una o più carte che sommate alla carta giocata fanno 15 (presa da 15: per esempio un 6 prende una donna, un re prende un 5).',
      'Se puoi prendere devi prendere; tra più prese possibili scegli tu quale (qui la carta uguale non ha la precedenza).',
      'Asso piglia tutto: l\'asso giocato quando in tavola non ci sono assi prende tutte le carte e fa scopa. Se in tavola c\'è un asso, puoi prendere quell\'asso oppure fare una presa da 15. Se la tavola è vuota l\'asso resta giù.',
      'Scopa: prendere tutte le carte in tavola vale un punto (anche con l\'asso). La scopa fatta con l\'ultima carta della smazzata non conta. A fine smazzata le carte rimaste in tavola vanno a chi ha preso per ultimo.',
      'Accusi (si fanno da soli all\'inizio del tuo turno, con le tre carte appena ricevute, e le carte restano scoperte per tutti): BÀRSEGA se la somma delle tre carte è meno di 10, vale 3 scope; DECINO se hai tre carte dello stesso valore, vale 10 scope.',
      'Il 7 di cuori è la MATTA: vale quanto serve per fare un accuso (nella bàrsega vale 1, nel decino il valore delle altre due) o per fare 15 o 30 con le carte in tavola all\'inizio. Se serve per un accuso, giocata in tavola continua a valere il numero scelto finché qualcuno non la prende; altrimenti è un normale 7. Nella primiera conta sempre come 7.',
      'Punti a fine smazzata: 1 per chi ha più carte, 1 per chi ha più quadri, 1 per il settebello (7 di quadri), 1 per la primiera, più tutte le scope (anche quelle degli accusi e del quindici iniziale). A parità carte, quadri e primiera non si assegnano.',
      'Primiera: per ogni seme la carta migliore (7 = 21, 6 = 18, asso = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, figure = 10); serve almeno una carta per seme.',
      'La GRANDE (fante, donna e re di quadri) vale 5 punti. La PICCOLA (asso, 2 e 3 di quadri) vale 3 punti, più uno per ogni altra quadri in fila fino al 6: con asso, 2, 3, 4 e 5 di quadri vale 5, con anche il 6 vale 6 (il 7 non conta: è già il settebello).',
      'Capotto: chi prende tutte e dieci le quadri in una smazzata vince subito la partita.',
      'Vince chi arriva per primo a 51 punti (oppure 31 o 101, da scegliere prima). Se in cima sono pari si gioca un\'altra smazzata. Il riepilogo di ogni smazzata resta finché qualcuno preme "Continua".',
      'Il computer facile prende un po\' a caso, il medio guarda quanto vale la presa e se lascia la tavola facile, il difficile calcola cosa può prendere l\'avversario con le carte che non ha ancora visto (compresi l\'asso piglia tutto e le prese da 15).',
    ],
  },
  crea: (o) => new Cirulla(o),
  bot,
  _test: { presePossibili, accuso, quindiciIniziale, conta, Cirulla, MATTA },
};
