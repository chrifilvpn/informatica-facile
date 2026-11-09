// UNO: da 2 a 10 giocatori, una mano sola (vince chi finisce le carte).
// Regole del sito: +2 si copre con +2 o +4, +4 si copre solo con +4 (le penalità si sommano);
// 0 e 7 senza effetti; chi non può giocare pesca finché non trova una carta giocabile e la gioca;
// si possono calare insieme più carte con lo stesso valore; chi resta con una carta senza aver detto UNO pesca 2.
const { mescola } = require('./carte');
const T = require('./trucco');

const COLORI = ['rosso', 'giallo', 'verde', 'blu'];
function mazzoUno() {
  const m = [];
  let k = 0;
  for (const c of COLORI) {
    m.push({ id: `u${k++}`, colore: c, valore: '0' });
    for (let d = 0; d < 2; d++) {
      for (let n = 1; n <= 9; n++) m.push({ id: `u${k++}`, colore: c, valore: String(n) });
      for (const v of ['salta', 'inverti', '+2']) m.push({ id: `u${k++}`, colore: c, valore: v });
    }
  }
  for (let d = 0; d < 4; d++) { m.push({ id: `u${k++}`, colore: null, valore: 'jolly' }); m.push({ id: `u${k++}`, colore: null, valore: '+4' }); }
  return mescola(m);
}
const PAUSA_PESCA = Number(process.env.UNO_PAUSA_PESCA) || 750; // tra una carta pescata e l'altra
const piu = (c) => c.valore === '+2' || c.valore === '+4';
const nera = (c) => c.valore === 'jolly' || c.valore === '+4';
const puntiCarta = (c) => (nera(c) ? 50 : /^\d$/.test(c.valore) ? Number(c.valore) : 20);

class Uno {
  constructor({ n, primo = 0 }) {
    this.id = 'uno';
    this.n = n;
    this.mazzo = mazzoUno();
    this.scarti = [];
    this.mani = Array.from({ length: n }, () => []);
    for (let k = 0; k < 7; k++) for (let i = 0; i < n; i++) this.mani[i].push(this.mazzo.pop());
    // la prima carta scoperta è sempre un numero
    let prima;
    do { prima = this.mazzo.pop(); if (!/^\d$/.test(prima.valore)) this.mazzo.unshift(prima); } while (!/^\d$/.test(prima.valore));
    this.scarti.push(prima);
    this.colore = prima.colore;
    this.verso = 1;
    this.turno = primo;
    this.accumulo = 0;         // carte da pescare per i +2/+4 accumulati
    this.tipoAccumulo = null;  // '+2' o '+4': cosa si può ancora mettere sopra
    this.pescata = null;       // id della carta pescata che si può giocare
    this.pescando = null;      // pesca in corso, una carta alla volta: { posto, resta (numero o 'giocabile') }
    this.inAttesa = false;
    this.pausaMs = PAUSA_PESCA;
    this.finita = false;
    this.risultato = null;
    this.evento = null;
    this.nEv = 0;
    this.ultima = null;
  }

  annuncia(posto, testo, testoIo, forte = false, bersaglio = null) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte, bersaglio }; }
  cima() { return this.scarti[this.scarti.length - 1]; }
  prossimo(da, passi = 1) { return (((da + this.verso * passi) % this.n) + this.n) % this.n; }

  pesca1() {
    if (!this.mazzo.length) {
      const cima = this.scarti.pop();
      this.mazzo = mescola(this.scarti);
      this.scarti = [cima];
    }
    return this.mazzo.pop() || null;
  }

  // il trucco segreto (!win), subito: le carte più scomode della mano (numeri alti che ora non si possono giocare)
  // tornano nel mazzo e al loro posto arrivano un +4, un jolly e un +2 (se nel mazzo ce ne sono ancora)
  trucco(p) {
    const mano = this.mani[p];
    if (this.finita || !mano || !mano.length || !T.consuma(this, p)) return;
    const peso = (c) => (this.giocabile(c) ? 0 : 100) + puntiCarta(c);
    for (const vuoi of ['+4', 'jolly', '+2']) {
      const scomode = mano.filter((c) => !nera(c) && c.valore !== '+2' && c.id !== this.pescata);
      const via = T.migliore(scomode, peso);
      const i = this.mazzo.findIndex((c) => c.valore === vuoi);
      if (!via || i < 0) continue;
      const nuova = this.mazzo[i];
      this.mazzo[i] = via;
      mano[mano.indexOf(via)] = nuova;
    }
    mescola(this.mazzo);
  }

  // il trucco segreto (!win !parola): la mano diventa quattro o cinque carte con lo stesso numero, di tutti e
  // quattro i colori: una si può sempre giocare e insieme si calano tutte (o un jolly per cambiare colore e un
  // gruppo di numeri). Poi sei tu a calarle al tuo turno.
  manoVincente(p) {
    const mano = this.mani[p];
    if (this.finita || !mano || this.inAttesa) return null;
    const pool = [...this.mazzo, ...mano];
    const valori = mescola(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    for (const v of valori) {
      const perColore = COLORI.map((c) => pool.filter((x) => x.valore === v && x.colore === c));
      if (perColore.some((l) => !l.length)) continue;
      let nuova = perColore.map((l) => l[0]);
      const r = Math.random();
      if (r < 0.35) { const extra = perColore.find((l) => l.length > 1); if (extra) nuova.push(extra[1]); }
      else if (r < 0.6) { const j = pool.find((x) => x.valore === 'jolly'); if (j) nuova = [...nuova.slice(0, 2 + Math.floor(Math.random() * 2)), j]; }
      const usate = new Set(nuova.map((x) => x.id));
      this.mani[p] = mescola(nuova);
      this.mazzo = mescola(pool.filter((x) => !usate.has(x.id)));
      if (this.turno === p) this.pescata = null;
      return '🃏 Mano cambiata: al tuo turno cala insieme le carte uguali';
    }
    return null;
  }

  giocabile(c) {
    if (this.accumulo) return this.tipoAccumulo === '+2' ? c.valore === '+2' || c.valore === '+4' : c.valore === '+4';
    if (nera(c)) return true;
    return c.colore === this.colore || c.valore === this.cima().valore;
  }
  puoGiocare(p) { return this.mani[p].some((c) => this.giocabile(c)); }
  // si può pescare anche avendo +2 o +4 giocabili: non sono obbligatori
  soloPiu(p) { return this.mani[p].filter((c) => this.giocabile(c)).every(piu); }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a) return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Stai pescando…' };
    if (a.tipo === 'pesca') return this.pesca(p);
    if (a.tipo === 'tieni') { // hai pescato un +2 o un +4: puoi tenerlo e passare
      const c = this.pescata && this.mani[p].find((x) => x.id === this.pescata);
      if (!c || !piu(c)) return { errore: 'Puoi tenere solo un +2 o un +4 appena pescato' };
      this.pescata = null;
      this.annuncia(p, 'tiene la carta pescata e passa', `tieni il ${c.valore} per dopo`);
      this.turno = this.prossimo(p);
      return { ok: true };
    }
    if (a.tipo !== 'gioca' || !Array.isArray(a.carte) || !a.carte.length) return { errore: 'Mossa non valida' };
    const mano = this.mani[p];
    const carte = a.carte.map((id) => mano.find((c) => c.id === id));
    if (carte.some((c) => !c) || new Set(a.carte).size !== carte.length) return { errore: 'Non hai queste carte' };
    if (this.pescata && !(carte.length === 1 && carte[0].id === this.pescata)) return { errore: 'Devi giocare la carta che hai pescato' };
    if (!this.giocabile(carte[0])) return { errore: this.accumulo ? `Devi rispondere con ${this.tipoAccumulo === '+2' ? 'un +2 o un +4' : 'un +4'}, oppure pescare ${this.accumulo} carte` : 'Questa carta non si può giocare' };
    if (carte.some((c) => c.valore !== carte[0].valore)) return { errore: 'Insieme puoi calare solo carte con lo stesso valore' };
    if (nera(carte[0]) && !COLORI.includes(a.colore)) return { errore: 'Scegli un colore' };

    // via dalla mano
    for (const c of carte) mano.splice(mano.indexOf(c), 1);
    this.scarti.push(...carte);
    this.pescata = null;
    const v = carte[0].valore;
    const n = carte.length;
    this.colore = nera(carte[0]) ? a.colore : carte[n - 1].colore;
    this.ultima = { posto: p, carte: carte.map((c) => c.id) };

    // UNO: chi resta con una carta deve averlo detto
    if (mano.length === 1 && !a.uno) {
      for (let k = 0; k < 2; k++) { const c = this.pesca1(); if (c) mano.push(c); }
      this.annuncia(p, 'non ha detto UNO: pesca 2 carte', 'non hai detto UNO: peschi 2 carte');
    } else if (mano.length === 1) this.annuncia(p, 'dice UNO!', 'UNO!', true);

    if (!mano.length) return this.chiudi(p);

    let passi = 1;
    if (v === '+2' || v === '+4') {
      this.accumulo += (v === '+2' ? 2 : 4) * n;
      this.tipoAccumulo = v;
      const vittima = this.prossimo(p);
      if (!this.evento || this.evento.posto !== p || !this.evento.forte) this.annuncia(p, `gioca ${n > 1 ? `${n} ` : ''}${v}: tocca a @ (+${this.accumulo})`, `${v}! @ deve rispondere o pescare ${this.accumulo}`, false, vittima);
    } else if (v === 'salta') passi = 1 + n;
    else if (v === 'inverti') {
      if (n % 2) this.verso *= -1;
      if (this.n === 2) passi = 2; // in due l'inverti vale come salta
    }
    this.turno = this.prossimo(p, passi);
    return { ok: true };
  }

  pesca(p) {
    if (this.pescata) {
      const c = this.mani[p].find((x) => x.id === this.pescata);
      return { errore: c && piu(c) ? 'Gioca la carta pescata oppure tienila' : 'Gioca la carta che hai pescato' };
    }
    if (this.accumulo) { // non si risponde al +2/+4: si pescano tutte, una alla volta, e si salta il turno
      this.pescando = { posto: p, resta: this.accumulo, totale: this.accumulo, prese: 0 };
      this.accumulo = 0; this.tipoAccumulo = null;
      this.annuncia(p, `pesca ${this.pescando.totale} carte`, `peschi ${this.pescando.totale} carte`);
      return this.passoPesca();
    }
    if (this.puoGiocare(p) && !this.soloPiu(p)) return { errore: 'Hai una carta giocabile: giocala' };
    // il trucco segreto (!lose): prima della carta buona ne arrivano due che non si possono giocare
    if (T.sfortuna(this, p)) for (let k = 0; k < 2; k++) T.inCima(this.mazzo, (c) => !nera(c) && !this.giocabile(c));
    this.pescando = { posto: p, resta: 'giocabile', prese: 0 };
    return this.passoPesca();
  }

  // una carta per volta: tra una e l'altra il server aspetta pausaMs (avanza)
  passoPesca() {
    const d = this.pescando;
    const mano = this.mani[d.posto];
    const c = this.pesca1();
    if (c) { mano.push(c); d.prese++; }
    const basta = !c || (d.resta === 'giocabile' ? this.giocabile(c) : --d.resta <= 0);
    if (!basta) { this.inAttesa = true; return { ok: true }; }
    this.inAttesa = false;
    this.pescando = null;
    if (d.resta !== 'giocabile' || !c) { this.turno = this.prossimo(d.posto); return { ok: true }; }
    this.pescata = c.id;
    this.annuncia(d.posto, `pesca ${d.prese} ${d.prese === 1 ? 'carta' : 'carte'}`, piu(c)
      ? `hai pescato un ${c.valore}: giocalo o tienilo`
      : `peschi ${d.prese} ${d.prese === 1 ? 'carta' : 'carte'}: gioca quella evidenziata`);
    return { ok: true };
  }
  avanza() { if (this.inAttesa && this.pescando) this.passoPesca(); }
  sblocca() { if (this.inAttesa) { while (this.inAttesa) this.passoPesca(); } }

  chiudi(v) {
    this.finita = true;
    this.turno = null;
    const punti = this.mani.map((m) => m.reduce((s, c) => s + puntiCarta(c), 0));
    this.annuncia(v, 'ha finito le carte!', 'hai finito le carte!', true);
    this.risultato = {
      fazioni: punti.map((x, i) => ({ posti: [i], punti: i === v ? punti.reduce((a, b) => a + b, 0) : 0 })),
      etichetta: 'punti',
      pareggio: false,
      vincitori: [v],
    };
    return { ok: true };
  }

  vista(p) {
    return {
      gioco: this.id, n: this.n, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs, pescando: this.pescando ? this.pescando.posto : null, finita: this.finita, risultato: this.risultato, evento: this.evento,
      mano: this.mani[p], carteInMano: this.mani.map((m) => m.length), cima: this.cima(), colore: this.colore, verso: this.verso,
      accumulo: this.accumulo, tipoAccumulo: this.tipoAccumulo, pescata: this.turno === p ? this.pescata : null,
      giocabili: this.turno === p ? this.mani[p].filter((c) => this.giocabile(c) && (!this.pescata || c.id === this.pescata)).map((c) => c.id) : [],
      puoPescare: this.turno === p && !this.inAttesa && !this.pescata && (this.accumulo > 0 || !this.puoGiocare(p) || this.soloPiu(p)),
      puoTenere: this.turno === p && !this.inAttesa && !!this.pescata && piu(this.mani[p].find((c) => c.id === this.pescata) || {}),
      carteMazzo: this.mazzo.length, ultima: this.ultima,
      maniFinali: this.finita ? this.mani : null,
    };
  }
}

// =================== COMPUTER ===================
function bot(g, p, livello) {
  const mano = g.mani[p];
  const ok = mano.filter((c) => g.giocabile(c) && (!g.pescata || c.id === g.pescata));
  if (!ok.length) return { tipo: 'pesca' };
  // il facile a volte tiene il +2/+4 appena pescato
  if (g.pescata && livello === 'facile' && piu(ok[0]) && Math.random() < 0.4) return { tipo: 'tieni' };
  const coloreMigliore = () => {
    const conta = {};
    for (const c of mano) if (c.colore) conta[c.colore] = (conta[c.colore] || 0) + 1;
    return Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] || COLORI[Math.floor(Math.random() * 4)];
  };
  let scelta;
  if (livello === 'facile') scelta = ok[Math.floor(Math.random() * ok.length)];
  else {
    const prossimo = g.prossimo(p);
    const pericolo = g.mani[prossimo].length <= 2;
    const peso = (c) => {
      let w = 0;
      if (nera(c)) w -= 10;                                          // i jolly si tengono per dopo
      if (livello === 'difficile' && c.colore) w += mano.filter((x) => x.colore === c.colore).length * 2; // resta sul colore che ha di più
      if (c.valore === '+4') w -= 10;
      if (pericolo && ['+2', 'salta', '+4'].includes(c.valore)) w += 60; // ferma chi sta per vincere
      if (c.colore === g.colore) w += 5;
      if (!/^\d$/.test(c.valore) && !nera(c)) w += 8;                 // meglio liberarsi delle carte da 20
      else if (/^\d$/.test(c.valore)) w += Number(c.valore) / 2;
      return w + Math.random() * 3;
    };
    scelta = [...ok].sort((a, b) => peso(b) - peso(a))[0];
  }
  // carte uguali: il medio e il difficile le calano insieme
  let carte = [scelta];
  if (livello !== 'facile' && !g.pescata) carte = mano.filter((c) => c.valore === scelta.valore && (c === scelta || !nera(c) || nera(scelta)));
  carte = [scelta, ...carte.filter((c) => c !== scelta)];
  const restano = mano.length - carte.length;
  return { tipo: 'gioca', carte: carte.map((c) => c.id), colore: nera(scelta) ? coloreMigliore() : undefined, uno: restano === 1 && (livello !== 'facile' || Math.random() < 0.75) };
}

module.exports = {
  meta: {
    id: 'uno',
    nome: 'UNO',
    tipo: 'tabellone',
    giocatori: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    descrizione: 'Il classico: +2 su +2, +4 su +4, pesca finché non puoi giocare.',
    opzioni: [],
    regole: [
      'Da 2 a 10 giocatori, 7 carte a testa. Si gioca una mano sola: vince chi finisce per primo le carte.',
      'Al tuo turno giochi una carta dello stesso colore o dello stesso valore di quella scoperta, oppure un Jolly o un +4 (e scegli il nuovo colore).',
      'Puoi calare insieme più carte con lo stesso valore (per esempio due 5, anche di colori diversi): la prima deve essere giocabile, il colore diventa quello dell\'ultima.',
      'Salta: il prossimo giocatore salta il turno. Inverti: cambia il verso del gioco (in due vale come Salta). 0 e 7 sono carte normali, senza effetti.',
      '+2: il prossimo pesca 2 carte e salta il turno, a meno che non risponda con un altro +2 o con un +4: in quel caso le carte si sommano e passano al giocatore dopo. +4: si può coprire solo con un altro +4. Chi non risponde pesca tutte le carte accumulate e salta il turno.',
      'Se non hai carte giocabili premi Pesca: peschi una carta alla volta (le vedi arrivare una per una) finché non trovi una carta giocabile, e poi devi giocarla. Anche le carte di penalità dei +2 e +4 arrivano una alla volta.',
      'I +2 e i +4 non sono mai obbligatori. Se la carta giocabile che peschi è un +2 o un +4 puoi giocarla oppure tenerla (pulsante "Tienila") e passare il turno. E se le uniche carte giocabili che hai in mano sono +2 o +4, puoi comunque scegliere di pescare.',
      'UNO: quando ti resta una sola carta devi dirlo. Il pulsante UNO! è sempre in basso a destra: premilo prima di giocare la penultima carta; se te ne dimentichi peschi 2 carte. Quando serve si illumina appena appena, quindi stai attento.',
      'Alla fine il vincitore prende i punti delle carte rimaste agli altri: numeri il loro valore, Salta/Inverti/+2 20 punti, Jolly e +4 50 punti.',
    ],
  },
  crea: (o) => new Uno(o),
  bot,
  _test: { mazzoUno },
};
