// POKER A 5 CARTE CON CAMBIO (five card draw) no-limit, senza puntate obbligatorie.
// Giro di puntate, cambio (da 0 a 5 carte), secondo giro di puntate, confronto.
const { Poker, migliore, nomeMano, equita, forzaMano, decidi, valuta5, v14 } = require('./poker-motore');
const T = require('./trucco');
const MV = require('./mano-vincente');
const aCaso = (l) => l[Math.floor(Math.random() * l.length)];

class Poker5 extends Poker {
  constructor(o) { super(o); this.id = 'poker5'; }

  distribuisci() {
    this.giro = 1;
    this.cambiate = new Array(this.n).fill(null);
    this.truccaMano();
    for (let giro = 0; giro < 5; giro++) for (let k = 1; k <= this.n; k++) {
      const i = (this.dealer + k) % this.n;
      if (this.inMano[i]) this.carte[i].push(this.pesca());
    }
  }
  valuta(i) { return migliore(this.carte[i]); }

  // il trucco segreto (!win): il giocatore truccato riceve già servito un colore, un full o (di rado) un poker, e
  // nessun altro ha una mano migliore. Le carte sono sempre le stesse 52: cambia solo l'ordine del mazzo.
  truccaMano() {
    let chi = -1;
    for (let i = 0; i < this.n && chi < 0; i++) if (this.inMano[i] && T.consuma(this, i)) chi = i;
    if (chi < 0) return false;
    const m = this.mazzo;
    const buona = manoServita(m);
    const resto = m.filter((c) => !buona.includes(c));
    // in che ordine si distribuisce: le posizioni (dalla cima) delle carte del truccato
    const ordine = [];
    for (let giro = 0; giro < 5; giro++) for (let k = 1; k <= this.n; k++) { const i = (this.dealer + k) % this.n; if (this.inMano[i]) ordine.push(i); }
    const mio = valuta5(buona).punti;
    for (let prova = 0; prova < 200; prova++) {
      for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
      const cima = [], altri = resto.slice(), mani = Array.from({ length: this.n }, () => []);
      let b = 0;
      for (const i of ordine) { const c = i === chi ? buona[b++] : altri.pop(); cima.push(c); mani[i].push(c); }
      if (prova < 199 && mani.some((x, i) => i !== chi && x.length && valuta5(x).punti >= mio)) continue;
      this.mazzo = [...altri, ...cima.reverse()]; // si pesca con pop: la prima carta data è l'ultima
      return true;
    }
    return true;
  }

  // il trucco segreto (!win !parola): le tue cinque carte diventano una mano forte (full, colore, scala, poker…)
  // migliore di quelle degli altri; poi sei tu a puntare (e a decidere se cambiare). Tra una mano e l'altra si aspetta.
  manoVincente(p) {
    if (!['giro', 'cambio'].includes(this.fase) || this.inAttesa || !this.inMano[p] || !this.carte[p] || this.carte[p].length !== 5) return null;
    const pool = [...this.mazzo, ...this.carte[p]];
    const altri = this.carte.map((x, i) => (i !== p && this.inMano[i] && x.length === 5 ? valuta5(x).punti : -1));
    for (let t = 0; t < 30; t++) {
      const nuove = MV.manoPoker(pool);
      if (!nuove || altri.some((v) => v >= valuta5(nuove).punti)) continue;
      this.mazzo = pool.filter((c) => !nuove.includes(c));
      for (let i = this.mazzo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.mazzo[i], this.mazzo[j]] = [this.mazzo[j], this.mazzo[i]]; }
      this.carte[p] = nuove;
      return '🃏 Mano cambiata: ora punta tu';
    }
    return null;
  }

  // il trucco segreto (!lose): le carte nuove del cambio non si abbinano a niente (rango diverso, niente vicine)
  cartaInutile(p) {
    const mano = this.carte[p];
    const ok = (c) => !mano.some((x) => x.rango === c.rango || Math.abs(x.rango - c.rango) <= 1) && mano.filter((x) => x.seme === c.seme).length < 2;
    T.inCima(this.mazzo, ok);
  }

  fineGiro() {
    if (this.giro === 2) return this.confronto();
    // cambio: a turno, partendo da sinistra del mazziere (anche chi è all-in cambia)
    this.fase = 'cambio';
    this.turno = this.prossimoCambio(this.dealer);
    this.inizioDecisione = Date.now();
    if (this.turno === null) return this.dopoCambio();
    return { ok: true };
  }
  prossimoCambio(da) {
    for (let k = 1; k <= this.n; k++) { const i = (da + k) % this.n; if (this.inMano[i] && this.cambiate[i] === null) return i; }
    return null;
  }
  dopoCambio() {
    this.giro = 2;
    this.iniziaGiro();
    return { ok: true };
  }

  azione(p, a) {
    if (!a) return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Aspetta un momento' };
    if (this.fase === 'attesa') return { errore: 'Servono almeno due giocatori con le fiche' };
    if (this.fase === 'cambio') {
      if (p !== this.turno) return { errore: 'Non è il tuo turno di cambiare' };
      if (a.tipo !== 'cambia' || !Array.isArray(a.carte)) return { errore: 'Scegli le carte da cambiare' };
      const ids = [...new Set(a.carte.map(String))];
      if (ids.length > 5) return { errore: 'Puoi cambiare al massimo 5 carte' };
      if (!ids.every((id) => this.carte[p].some((c) => c.id === id))) return { errore: 'Non hai queste carte' };
      this.carte[p] = this.carte[p].filter((c) => { if (ids.includes(c.id)) { this.scarti.push(c); return false; } return true; });
      const sfiga = ids.length && T.sfortuna(this, p);
      while (this.carte[p].length < 5) { if (sfiga && this.mazzo.length) this.cartaInutile(p); this.carte[p].push(this.pesca()); }
      this.cambiate[p] = ids.length;
      this.ultima[p] = ids.length ? `cambia ${ids.length}` : 'servito';
      this.annuncia(p, ids.length ? `cambia ${ids.length} ${ids.length === 1 ? 'carta' : 'carte'}` : 'è servito', ids.length ? `cambi ${ids.length} ${ids.length === 1 ? 'carta' : 'carte'}` : 'sei servito');
      this.turno = this.prossimoCambio(p);
      this.inizioDecisione = Date.now();
      if (this.turno === null) return this.dopoCambio();
      return { ok: true };
    }
    return this.azioneGiro(p, a);
  }

  avanzaCorsa() {}

  vista(p) {
    const v = this.vistaComune(p);
    v.giro = this.giro;
    v.cambiate = this.cambiate;
    v.miaMano = this.carte && this.carte[p] && this.carte[p].length === 5 ? nomeMano(valuta5(this.carte[p])) : null;
    v.forza = this.finita || this.fase !== 'giro' && this.fase !== 'cambio' ? null : forzaMano(this, p, { daCompletare: 0, cartePerMano: 5, conCambio: true });
    v.puoCambiare = this.fase === 'cambio' && this.turno === p;
    return v;
  }
}

// cinque carte del mazzo che formano un colore, un full o un poker (in ordine sparso)
function manoServita(m) {
  const x = Math.random();
  let cs;
  if (x < 0.4) { // colore, ma non scala colore
    const seme = aCaso(['c', 'q', 'f', 'p']);
    do cs = m.filter((c) => c.seme === seme).sort(() => Math.random() - 0.5).slice(0, 5); while (valuta5(cs).cat !== 5);
  } else {
    const ranghi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].sort(() => Math.random() - 0.5);
    const di = (r, n) => m.filter((c) => c.rango === r).sort(() => Math.random() - 0.5).slice(0, n);
    cs = x < 0.9 ? [...di(ranghi[0], 3), ...di(ranghi[1], 2)] : [...di(ranghi[0], 4), ...di(ranghi[1], 1)];
  }
  return cs.sort(() => Math.random() - 0.5);
}

// =================== COMPUTER ===================
// quali carte tenere: le combinazioni fatte, altrimenti i progetti di colore/scala, altrimenti le carte alte
function daCambiare(carte, livello) {
  const r = valuta5(carte);
  const ids = (f) => carte.filter(f).map((c) => c.id);
  if (r.cat >= 4 && r.cat !== 7) return [];                 // scala, colore, full, scala colore: servito
  if (r.cat === 7) return ids((c) => v14(c) !== r.chiavi[0]).slice(0, livello === 'difficile' ? 0 : 1); // poker
  if (r.cat === 3 || r.cat === 2 || r.cat === 1) {
    const tieni = new Set(r.cat === 2 ? [r.chiavi[0], r.chiavi[1]] : [r.chiavi[0]]);
    let via = carte.filter((c) => !tieni.has(v14(c)));
    // con una coppia il difficile a volte tiene un asso di accompagnamento
    if (r.cat === 1 && livello !== 'facile') { const asso = via.find((c) => v14(c) === 14); if (asso && Math.random() < 0.3) via = via.filter((c) => c !== asso); }
    return via.map((c) => c.id);
  }
  // quattro dello stesso seme: si cambia la quinta
  for (const s of ['c', 'q', 'f', 'p']) if (carte.filter((c) => c.seme === s).length === 4) return ids((c) => c.seme !== s);
  // quattro in scala (anche con un buco): si cambia quella fuori
  const valori = [...new Set(carte.map(v14))].sort((a, b) => a - b);
  for (const fuori of carte) {
    const altre = carte.filter((c) => c !== fuori).map(v14).sort((a, b) => a - b);
    if (new Set(altre).size === 4 && altre[3] - altre[0] <= 4 && livello !== 'facile') return [fuori.id];
  }
  void valori;
  // niente: si tengono le due più alte (il facile ne cambia 3 a caso)
  const ordinate = [...carte].sort((a, b) => v14(b) - v14(a));
  if (livello === 'facile') return ordinate.slice(2).map((c) => c.id);
  return ordinate.slice(v14(ordinate[0]) >= 13 ? 1 : 2).map((c) => c.id).slice(0, 4);
}

function bot(g, p, livello) {
  if (g.fase === 'cambio') return { tipo: 'cambia', carte: daCambiare(g.carte[p], livello) };
  const avversari = g.inMano.filter((x, i) => x && i !== p).length;
  // prima del cambio la mano vale un po' meno (gli altri miglioreranno)
  const eq = equita(g.carte[p], [], Math.max(1, avversari), { daCompletare: 0, cartePerMano: 5, conCambio: true, giri: livello === 'facile' ? 60 : 200 })
    * (g.giro === 1 ? 0.9 : 1);
  return decidi(g, p, livello, eq);
}

module.exports = {
  meta: {
    id: 'poker5',
    nome: 'Poker a 5 carte',
    tipo: 'tabellone',
    fiche: true,
    saltaAssenti: true,
    giocatori: [2, 3, 4, 5, 6],
    descrizione: 'Poker classico con cambio: 5 carte, cambi quelle che vuoi. Con le fiche.',
    opzioni: [],
    regole: [
      'Ogni giocatore parte con 1000 fiche; chi le finisce guarda le mani successive finché non scrive !ricarica in chat (1000 fiche, solo quando è a zero). I computer si ricaricano da soli.',
      'Non ci sono puntate obbligatorie e non serve una coppia per aprire: chi vuole punta, altrimenti si passa. Il mazziere (bottone D) gira a ogni mano.',
      'Ognuno riceve 5 carte coperte. Primo giro di puntate: Passa, Punta (almeno 5), Vedi, Rilancia o Lascia. No-limit: si può puntare tutto (all-in).',
      'Cambio: a turno ognuno sceglie da 0 a 5 carte da scartare e ne riceve altrettante nuove. Chi non cambia è "servito". Tutti vedono quante carte ha cambiato ognuno.',
      'Secondo giro di puntate, poi chi è rimasto mostra le carte e vince la mano migliore.',
      'Mani dalla più forte: scala reale, scala colore, poker, full, colore, scala, tris, doppia coppia, coppia, carta alta. Il full batte il colore. L\'asso vale anche nella scala A-2-3-4-5. A parità conta la carta più alta; se è tutto uguale il piatto si divide.',
      'Se tutti gli altri lasciano, vinci il piatto senza mostrare. Chi va all-in con meno fiche vince solo la sua parte; il resto forma un piatto laterale. Hai 30 secondi per ogni decisione.',
    ],
  },
  crea: (o) => new Poker5(o),
  bot,
  _test: { daCambiare, manoServita },
};
