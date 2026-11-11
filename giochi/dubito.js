// DUBITO (regole di Liar's Bar, "Liar's Deck", modalità classica).
// Mazzo da 20 carte: 6 Assi, 6 Re, 6 Regine e 2 Jolly (da 5 a 8 giocatori si usano due mazzi uguali, 40 carte).
// A ogni round il tavolo sceglie la Carta Dichiarata (Asso, Re o Regina), si rimescola e ognuno riceve 5 carte.
// Al tuo turno metti giù coperte da 1 a 3 carte dicendo che sono tutte la Carta Dichiarata (puoi mentire; il Jolly
// vale sempre come carta giusta). Il giocatore successivo sceglie: ci crede e gioca a sua volta, oppure dice DUBITO.
// Si girano le carte: se c'era anche una sola carta sbagliata l'accusato ha mentito e fa la Roulette Russa,
// altrimenti la fa chi ha dubitato. Ogni giocatore ha la sua pistola: 6 camere e 1 proiettile, e a ogni colpo andato
// a vuoto la probabilità che il prossimo parta cresce (1/6, 1/5, 1/4…). Chi viene colpito è eliminato.
// Il round ricomincia (nuova carta, mazzo rimescolato, 5 carte a testa) appena qualcuno preme il grilletto o finisce
// le carte. Vince l'ultimo rimasto al tavolo.
// Mazzo classico: Asso, Re, Regina (+ Jolly). Mazzo grande (opzione): anche Fante, 10, 9, 8, 7 (codici F, T, 9, 8, 7).
const TIPI_MAZZO = { classico: ['A', 'K', 'Q'], grande: ['A', 'K', 'Q', 'F', 'T', '9', '8', '7'] };
const NOMI = { A: 'Asso', K: 'Re', Q: 'Regina', F: 'Fante', T: 'Dieci', 9: 'Nove', 8: 'Otto', 7: 'Sette', J: 'Jolly' };
const PLURALI = { A: 'Assi', K: 'Re', Q: 'Regine', F: 'Fanti', T: 'Dieci', 9: 'Nove', 8: 'Otto', 7: 'Sette', J: 'Jolly' };
const CARTE_OPZIONI = [5, 3, 7, 10], MAX_CARTE = 3;
const PER_TIPO = 6, JOLLY = 2; // in ogni mazzo: 6 carte per tipo e 2 Jolly
const TURNO_MS = 30000;        // tempo per decidere (poi il computer gioca per te)
const GRILLETTO_MS = 12000;    // tempo per premere il grilletto
const PAUSA_SVELA = 2800, PAUSA_SPARO = 3400, PAUSA_FINALE = 2200;
const numeri = ['', 'un', 'due', 'tre'];
const dichiara = (q, t) => `Sto giocando ${q === 1 && t === 'Q' ? 'una' : numeri[q]} ${q === 1 ? NOMI[t] : PLURALI[t]}`;
const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// quanti mazzi uguali servono: come in Liar's Bar (da 5 giocatori due mazzi), e di più se le carte in mano
// di tutti non ci stanno
function quantiMazzi(n, tipi = TIPI_MAZZO.classico, aTesta = 5) {
  const dim = tipi.length * PER_TIPO + JOLLY;
  return Math.max(n > 4 ? 2 : 1, Math.ceil((n * aTesta) / dim));
}
// il mazzo di Liar's Bar: 6 Assi, 6 Re, 6 Regine, 2 Jolly (nel mazzo grande anche 6 Fanti, 6 Dieci, 6 Nove, 6 Otto, 6 Sette)
function mazzo(n, tipi = TIPI_MAZZO.classico, aTesta = 5) {
  const m = [];
  const mazzi = quantiMazzi(n, tipi, aTesta);
  for (let d = 0; d < mazzi; d++) {
    for (const t of tipi) for (let k = 1; k <= PER_TIPO; k++) m.push({ id: `${t}${k}${d ? `m${d}` : ''}`, t });
    for (let k = 1; k <= JOLLY; k++) m.push({ id: `J${k}${d ? `m${d}` : ''}`, t: 'J' });
  }
  return m;
}
const buona = (c, carta) => c.t === carta || c.t === 'J';
const T = require('./trucco');

class Dubito {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'dubito';
    this.n = n;
    this.tipoMazzo = opzioni.mazzo === 'grande' ? 'grande' : 'classico';
    this.tipi = TIPI_MAZZO[this.tipoMazzo];
    this.aTesta = CARTE_OPZIONI.includes(Number(opzioni.carte)) ? Number(opzioni.carte) : 5;
    this.mazzi = quantiMazzi(n, this.tipi, this.aTesta);
    this.dimMazzo = this.tipi.length * PER_TIPO + JOLLY;
    this.vivi = new Array(n).fill(true);
    // la pistola di ognuno: il proiettile sta in una camera a caso (da 1 a 6); "colpi" = quante volte ha già sparato
    this.pistole = Array.from({ length: n }, () => ({ proiettile: 1 + Math.floor(Math.random() * 6), colpi: 0 }));
    this.round = 0;
    this.inAttesa = false; this.pausaMs = PAUSA_SVELA;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.storia = [];
    this.nuovoRound(primo % n);
  }
  annuncia(posto, testo, testoIo, forte = false, extra = {}) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte, ...extra }; }
  prossimoVivo(p) { for (let k = 1; k <= this.n; k++) { const q = (p + k) % this.n; if (this.vivi[q]) return q; } return p; }

  nuovoRound(primo) {
    this.round++;
    this.carta = this.tipi[Math.floor(Math.random() * this.tipi.length)];
    const m = mescola(mazzo(this.n, this.tipi, this.aTesta));
    this.mani = Array.from({ length: this.n }, () => []);
    let k = 0;
    for (let p = 0; p < this.n; p++) if (this.vivi[p]) this.mani[p] = m.slice(k, (k += this.aTesta));
    this.scarto = m.length - k;   // carte rimaste coperte da parte: nessuno sa quali sono
    // il trucco segreto (!win): una mano di sole carte giuste, scambiate con quelle rimaste coperte da parte (e, se
    // non bastano, con quelle appena date agli altri)
    const resto = m.slice(k);
    for (let p = 0; p < this.n; p++) {
      if (!this.vivi[p] || !T.consuma(this, p)) continue;
      const mano = this.mani[p];
      const fonti = [resto, ...this.mani.filter((x) => x !== mano)];
      for (let i = 0; i < mano.length; i++) {
        if (buona(mano[i], this.carta)) continue;
        const f = fonti.find((x) => x.some((c) => buona(c, this.carta)));
        if (!f) break;
        const j = f.findIndex((c) => buona(c, this.carta));
        [mano[i], f[j]] = [f[j], mano[i]];
      }
    }
    this.tavolo = [];              // carte giocate in questo round (coperte)
    this.tavoloDa = [];
    this.ultima = null;            // { posto, carte, quante } l'ultima giocata, che il successivo può mettere in dubbio
    this.finale = false;           // l'ultima giocata ha svuotato la mano: il successivo dubita o accetta
    this.svelate = null;
    this.roulette = null;          // { chi, perche, esito }
    this.fase = 'gioco';
    this.turno = this.vivi[primo] ? primo : this.prossimoVivo(primo);
    this.fineTurno = Date.now() + TURNO_MS;
    this.annuncia(null, `Round ${this.round}: la carta del tavolo è ${NOMI[this.carta].toUpperCase()}`, `Round ${this.round}: carta del tavolo ${NOMI[this.carta].toUpperCase()}`, true);
  }
  ordina(p) { const o = { A: 0, K: 1, Q: 2, F: 3, T: 4, 9: 5, 8: 6, 7: 7, J: 8 }; this.mani[p].sort((a, b) => (buona(b, this.carta) - buona(a, this.carta)) || o[a.t] - o[b.t] || (a.id < b.id ? -1 : 1)); }

  attesi() { return []; }
  scadenza() { if (this.finita || this.inAttesa) return null; if (this.fase === 'gioco' || this.fase === 'roulette') return this.fineTurno; return null; }
  controllaTempo() {
    if (this.finita || this.inAttesa || Date.now() < this.fineTurno || this.turno === null) return false;
    const p = this.turno;
    const r = this.azione(p, this.fase === 'roulette' ? { tipo: 'spara' } : bot(this, p, 'medio'));
    if (r && r.errore) this.azione(p, this.fase === 'roulette' ? { tipo: 'spara' } : bot(this, p, 'facile'));
    return true;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!a) return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Un attimo…' };
    if (p !== this.turno) return { errore: this.fase === 'roulette' ? 'Non tocca a te sparare' : 'Non è il tuo turno' };
    if (this.fase === 'roulette') { if (a.tipo !== 'spara') return { errore: 'Devi premere il grilletto' }; return this.spara(p); }
    if (a.tipo === 'dubito') {
      if (!this.ultima) return { errore: 'Non c\'è niente da mettere in dubbio' };
      return this.dubita(p);
    }
    if (a.tipo === 'accetto') {
      if (!this.finale) return { errore: 'Devi giocare o dubitare' };
      // ci si crede: chi ha finito le carte l'ha fatta franca, si ricomincia
      const u = this.ultima;
      this.annuncia(p, `crede a @: round finito, nessuno spara`, 'ci credi: round finito', false, { bersaglio: u.posto, testoTe: 'ti crede: l\'hai fatta franca! 😏' });
      this.storia.push({ round: this.round, tipo: 'accetto', chi: p, di: u.posto });
      return this.finisciRound(u.posto, PAUSA_FINALE);
    }
    if (a.tipo !== 'gioca') return { errore: 'Metti giù da 1 a 3 carte o di\' DUBITO' };
    if (this.finale) return { errore: 'Ha finito le carte: credi o dubiti?' };
    const ids = Array.isArray(a.carte) ? [...new Set(a.carte.map(String))] : [];
    if (ids.length < 1 || ids.length > MAX_CARTE) return { errore: 'Puoi mettere giù da 1 a 3 carte' };
    const carte = ids.map((id) => this.mani[p].find((c) => c.id === id));
    if (carte.some((c) => !c)) return { errore: 'Non hai queste carte' };
    this.mani[p] = this.mani[p].filter((c) => !ids.includes(c.id));
    this.tavolo.push(...carte); this.tavoloDa.push(...carte.map(() => p));
    // davanti a una giocata ha giocato invece di dubitare: serve al computer difficile per capire quanto dubita ognuno
    if (this.ultima) this.storia.push({ round: this.round, tipo: 'crede', chi: p, quante: this.ultima.quante });
    this.ultima = { posto: p, carte, quante: carte.length };
    this.finale = this.mani[p].length === 0;
    this.annuncia(p, `mette giù ${carte.length} ${carte.length === 1 ? 'carta' : 'carte'}: "${dichiara(carte.length, this.carta)}"${this.finale ? ' (ultime carte!)' : ''}`, `hai detto: "${dichiara(carte.length, this.carta)}"`);
    this.turno = this.prossimoVivo(p);
    this.fineTurno = Date.now() + TURNO_MS;
    return { ok: true };
  }

  // il trucco segreto (!win): quando tocca a lui e c'è una giocata da credere o no, sa se è una bugia
  suggerimentoWin(p) {
    const u = this.ultima;
    if (this.fase !== 'gioco' || this.turno !== p || this.inAttesa || !u || u.posto === p) return null;
    return u.carte.some((c) => !buona(c, this.carta)) ? '💡 Sta mentendo: di\' DUBITO!' : '💡 Dice la verità: non dubitare';
  }

  dubita(p) {
    const u = this.ultima;
    const mentiva = u.carte.some((c) => !buona(c, this.carta));
    const tira = mentiva ? u.posto : p;
    this.svelate = { carte: u.carte, dubitante: p, accusato: u.posto, mentiva, tira, carta: this.carta };
    this.storia.push({ round: this.round, tipo: 'dubito', chi: p, di: u.posto, mentiva, quante: u.quante });
    this.annuncia(p, `dice DUBITO a @! ${mentiva ? 'Era una bugia: @ fa la Roulette Russa' : 'Diceva la verità: la Roulette Russa tocca a chi ha dubitato'}`,
      `hai detto DUBITO! ${mentiva ? 'Era una bugia: spara lui' : 'Diceva la verità: tocca a te sparare'}`, true,
      { bersaglio: u.posto, testoTe: mentiva ? 'dice DUBITO e ti scopre: Roulette Russa! 🔫' : 'dice DUBITO, ma dicevi la verità: la Roulette Russa tocca a chi ha dubitato 😏' });
    this.fase = 'svela';
    this.turno = null;
    this.inAttesa = true; this.pausaMs = PAUSA_SVELA;
    return { ok: true };
  }

  // la pistola: ogni volta che si spara il tamburo gira di una camera
  spara(p) {
    const pi = this.pistole[p];
    pi.colpi++;
    const morto = pi.colpi >= pi.proiettile;
    this.roulette.esito = morto ? 'morto' : 'salvo';
    this.roulette.colpo = pi.colpi;
    this.storia.push({ round: this.round, tipo: 'sparo', chi: p, colpo: pi.colpi, morto });
    if (morto) {
      this.vivi[p] = false;
      this.annuncia(p, 'preme il grilletto… BANG! 💥 È fuori dalla partita', 'BANG! 💥 Sei fuori dalla partita', true);
    } else {
      const resta = 6 - pi.colpi;
      this.annuncia(p, `preme il grilletto… click. Si salva! (${pi.colpi}/6)`, `click… sei salvo! La prossima volta: 1 su ${resta}`, true);
    }
    this.fase = 'sparo';
    this.turno = null;
    // il round ricomincia comunque: parte chi ha sparato (o, se è fuori, il successivo)
    return this.finisciRound(p, PAUSA_SPARO);
  }

  finisciRound(prossimo, pausa) {
    this.prossimoPrimo = prossimo;
    this.inAttesa = true; this.pausaMs = pausa;
    if (this.fase !== 'sparo') this.fase = 'finale';
    this.turno = null;
    return { ok: true };
  }

  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    if (this.fase === 'svela') {
      // tocca a chi ha perso la sfida: la Roulette Russa
      const s = this.svelate;
      this.roulette = { chi: s.tira, colpiPrima: this.pistole[s.tira].colpi, esito: null };
      this.fase = 'roulette';
      this.turno = s.tira;
      this.fineTurno = Date.now() + GRILLETTO_MS;
      return;
    }
    const vivi = this.vivi.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (vivi.length <= 1) return this.chiudi(vivi[0] ?? 0);
    this.nuovoRound(this.vivi[this.prossimoPrimo] ? this.prossimoPrimo : this.prossimoVivo(this.prossimoPrimo));
  }

  chiudi(vincitore) {
    this.finita = true; this.turno = null; this.fase = 'fine'; this.inAttesa = false;
    this.annuncia(vincitore, 'è l\'ultimo rimasto al tavolo e vince! 🏆', 'sei l\'ultimo rimasto: hai vinto! 🏆', true);
    // classifica: chi è uscito dopo sta più in alto
    const uscite = this.storia.filter((x) => x.tipo === 'sparo' && x.morto).map((x) => x.chi);
    this.risultato = {
      fazioni: Array.from({ length: this.n }, (_, i) => ({ posti: [i], punti: i === vincitore ? this.n : Math.max(0, uscite.indexOf(i)) + 1 })),
      etichetta: 'posizione (più alto = resistito di più)', pareggio: false, vincitori: [vincitore],
    };
    return { ok: true };
  }

  vista(p) {
    if (p >= 0 && p < this.n) this.ordina(p);
    const u = this.ultima;
    const mio = p === this.turno && !this.inAttesa;
    return {
      gioco: this.id, n: this.n, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs, round: this.round,
      carta: this.carta, nomi: NOMI, plurali: PLURALI, mazzi: this.mazzi, scarto: this.scarto, tipi: this.tipi, tipoMazzo: this.tipoMazzo, aTesta: this.aTesta,
      mano: this.mani[p] || [], carteInMano: this.mani.map((m) => m.length), vivi: this.vivi, colpi: this.pistole.map((x) => x.colpi),
      tavolo: this.tavolo.length,
      ultima: u ? { posto: u.posto, quante: u.quante, dichiarazione: dichiara(u.quante, this.carta), carte: u.posto === p ? u.carte : null } : null,
      finale: this.finale, svelate: this.svelate && (this.fase === 'svela' || this.fase === 'roulette' || this.fase === 'sparo') ? this.svelate : null,
      roulette: this.roulette && (this.fase === 'roulette' || this.fase === 'sparo') ? this.roulette : null,
      possoDubitare: mio && this.fase === 'gioco' && !!u, possoGiocare: mio && this.fase === 'gioco' && !this.finale, possoAccettare: mio && this.fase === 'gioco' && this.finale,
      possoSparare: mio && this.fase === 'roulette',
      fineTurno: this.scadenza(), turnoMs: this.fase === 'roulette' ? GRILLETTO_MS : TURNO_MS,
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
// Quante carte "buone" (Carta Dichiarata o Jolly) non si vedono ancora, dal punto di vista di p
function buoneNascoste(g, p) {
  const tot = (PER_TIPO + JOLLY) * g.mazzi; // 6 della carta + 2 jolly per mazzo
  const mie = g.mani[p].filter((c) => buona(c, g.carta)).length;
  // le carte che p stesso ha messo sul tavolo in questo round le conosce
  const mieSulTavolo = g.tavolo.filter((c, i) => g.tavoloDa[i] === p && buona(c, g.carta)).length;
  return tot - mie - mieSulTavolo;
}
function nascoste(g, p) {
  // tutte le carte che p non ha mai visto: mazzo intero meno la sua mano e quello che ha giocato lui
  const mieSulTavolo = g.tavoloDa.filter((x) => x === p).length;
  return g.dimMazzo * g.mazzi - g.mani[p].length - mieSulTavolo;
}
function probVerita(g, p) {
  // probabilità che le carte dell'ultima giocata siano tutte buone, se l'altro avesse carte "a caso" dalle nascoste
  const u = g.ultima, B = buoneNascoste(g, p), N = nascoste(g, p);
  if (u.quante > B) return 0;
  let pr = 1;
  for (let k = 0; k < u.quante; k++) pr *= (B - k) / (N - k);
  // ma chi ha carte buone tende a giocarle: la verità è più probabile di così
  return Math.min(1, pr * 2.2);
}
// il difficile ragiona come un giocatore attento: stima quante carte buone poteva avere l'altro (le carte che non ha
// mai visto sono "a caso") e quanto è probabile che dica la verità, sapendo che di solito si gioca la verità quando la
// si ha e si mente con una carta sola quando non la si ha
function lnC(n, r) { if (r < 0 || r > n) return -Infinity; let v = 0; for (let i = 1; i <= r; i++) v += Math.log((n - r + i) / i); return v; }
function ipergeom(N, B, h, x) { return Math.exp(lnC(B, x) + lnC(N - B, h - x) - lnC(N, h)); }
function verita(g, p) {
  const u = g.ultima, k = u.quante, B = buoneNascoste(g, p), N = nascoste(g, p);
  if (k > B) return 0;
  const h = Math.min(N, g.mani[u.posto].length + k); // carte che aveva prima di giocare
  let onestoV = 0, onestoF = 0, casoV = 0, casoF = 0;
  for (let x = 0; x <= Math.min(h, B); x++) {
    const px = ipergeom(N, B, h, x); if (!px) continue;
    // giocatore "onesto": gioca le sue carte buone (fino a 3), se non ne ha mente con una carta
    const quante = x === 0 ? 1 : Math.min(x, MAX_CARTE);
    if (quante === k) { if (x === 0) onestoF += px; else onestoV += px; }
    // giocatore "a caso": numero di carte a caso, carte a caso
    const kk = Math.min(MAX_CARTE, h);
    if (k <= kk) { const pv = k <= x ? Math.exp(lnC(x, k) - lnC(h, k)) : 0; casoV += (px / kk) * pv; casoF += (px / kk) * (1 - pv); }
  }
  // quanto crediamo che l'altro giochi "onesto": si parte da 0,7 e si impara dalle carte girate ai Dubito di prima
  // (chi gioca "onesto" mente solo con una carta: una bugia con due o tre carte è da giocatore che va a caso)
  const girate = g.storia.filter((x) => x.tipo === 'dubito' && x.di === u.posto && x.quante >= 2), strane = girate.filter((x) => x.mentiva).length;
  const a = Math.max(0.15, Math.min(0.9, 0.7 - (strane - 0.3 * (girate.length - strane)) * 0.2));
  const V = a * onestoV + (1 - a) * casoV, F = a * onestoF + (1 - a) * casoF;
  return V + F > 0 ? V / (V + F) : 0.5;
}
// quanto spesso q dice DUBITO quando ha davanti una giocata di una carta sola, cioè come sono le bugie
// (all'inizio si suppone PD.presoBluff, poi si impara giocando)
function quantoDubita(g, q) {
  let d = 0, n = 0;
  for (const x of g.storia) if (x.chi === q && x.quante === 1 && (x.tipo === 'dubito' || x.tipo === 'crede')) { n++; if (x.tipo === 'dubito') d++; }
  return (d + PD.presoBluff * 4) / (n + 4);
}
const PD = { pesoAltri: 0.5, presoBluff: 0.1, jollyInsieme: true };
const PG = { conCarte: 0.2, senzaCarte: 0.9, finale: 0.5 }; // soglie del difficile nel mazzo grande (provate con migliaia di partite)
function bot(g, p, livello) {
  const caso = (a) => a[Math.floor(Math.random() * a.length)];
  if (g.fase === 'roulette') return { tipo: 'spara' };
  const mano = g.mani[p];
  const giuste = mano.filter((c) => buona(c, g.carta)), sbagliate = mano.filter((c) => !buona(c, g.carta));
  const u = g.ultima;
  // ---- decidere se dubitare ----
  if (u) {
    const pv = probVerita(g, p);
    if (pv === 0) return { tipo: 'dubito' }; // bugia sicura: le carte buone non bastano
    if (livello === 'difficile' && g.tipoMazzo === 'grande') {
      // mazzo grande: le carte buone sono poche e chi non le ha preferisce dubitare piuttosto che mentire (una bugia
      // da una carta viene quasi sempre scoperta). Il difficile dubita se la giocata è poco credibile per il suo modello,
      // quasi sempre quando non ha carte buone, e alle ultime carte se è più probabile la bugia
      const pvd = verita(g, p);
      if (g.finale) return { tipo: pvd < PG.finale ? 'dubito' : 'accetto' };
      if (pvd < (giuste.length ? PG.conCarte : PG.senzaCarte)) return { tipo: 'dubito' };
      return giocaDifficile(g, p, giuste, sbagliate);
    }
    if (livello === 'difficile') {
      // conviene dubitare se il rischio di sparare io (se dice il vero) vale meno del rischio che spari lui (se mente),
      // tenendo conto che se non dubito devo giocare, e senza carte buone dovrò mentire anch'io
      const pvd = verita(g, p);
      const mio = 1 / (6 - g.pistole[p].colpi), suo = 1 / (6 - g.pistole[u.posto].colpi);
      const peso = g.vivi.filter(Boolean).length === 2 ? 1 : PD.pesoAltri;
      const costoDubbio = pvd * mio - (1 - pvd) * suo * peso;
      // se non ho carte buone devo mentire: il rischio è quanto spesso chi mi segue dubita (lo si impara giocando)
      const costoGioco = g.finale || giuste.length ? 0 : quantoDubita(g, g.prossimoVivo(p)) * mio;
      return costoDubbio < costoGioco ? { tipo: 'dubito' } : g.finale ? { tipo: 'accetto' } : giocaDifficile(g, p, giuste, sbagliate);
    }
    if (livello === 'facile') {
      if (g.finale) return { tipo: Math.random() < 0.35 ? 'dubito' : 'accetto' };
      if (Math.random() < 0.28) return { tipo: 'dubito' };
    } else {
      // medio: dubita quando la giocata è poco probabile (e un po' di più se, senza carte buone, dovrebbe mentire anche lui)
      if (g.finale) return { tipo: pv < 0.35 ? 'dubito' : 'accetto' };
      if (pv < (giuste.length ? 0.3 : 0.42)) return { tipo: 'dubito' };
    }
  }
  if (g.finale) return { tipo: 'accetto' };
  if (livello === 'difficile') return giocaDifficile(g, p, giuste, sbagliate);
  // ---- giocare ----
  if (livello === 'facile') {
    const n = Math.min(mano.length, 1 + Math.floor(Math.random() * 3));
    return { tipo: 'gioca', carte: [...mano].sort(() => Math.random() - 0.5).slice(0, n).map((c) => c.id) };
  }
  if (giuste.length) {
    // verità: le carte giuste (i jolly li tiene per quando non ha altro)
    const vere = giuste.filter((c) => c.t !== 'J'), jolly = giuste.filter((c) => c.t === 'J');
    return { tipo: 'gioca', carte: (vere.length ? vere : jolly).slice(0, MAX_CARTE).map((c) => c.id) };
  }
  // solo carte sbagliate: bisogna mentire, con meno carte possibile
  return { tipo: 'gioca', carte: [livello === 'difficile' ? sbagliate[0] : caso(sbagliate)].map((c) => c.id) };
}

function giocaDifficile(g, p, giuste, sbagliate) {
  if (giuste.length) {
    const vere = giuste.filter((c) => c.t !== 'J'), jolly = giuste.filter((c) => c.t === 'J');
    // tutte le carte vere (fino a 3); i jolly si aggiungono solo per finire la mano o se non c'è altro
    let scelte = vere.slice(0, MAX_CARTE);
    if (!scelte.length) scelte = jolly.slice(0, MAX_CARTE);
    else if (PD.jollyInsieme && scelte.length < MAX_CARTE) scelte = [...scelte, ...jolly].slice(0, MAX_CARTE);
    return { tipo: 'gioca', carte: scelte.map((c) => c.id) };
  }
  return { tipo: 'gioca', carte: [sbagliate[0].id] };
}

module.exports = {
  meta: {
    id: 'dubito',
    nome: 'Dubito',
    tipo: 'carte',
    giocatori: [2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Il Dubito di Liar\'s Bar: carte coperte, bluff e Roulette Russa. Chi viene scoperto a mentire (o dubita a torto) preme il grilletto.',
    alias: ['bugia', 'bluff', 'cheat', 'liar', 'liars bar', 'liar\'s bar', 'roulette', 'roulette russa'],
    opzioni: [
      { id: 'mazzo', nome: 'Mazzo', valori: ['classico', 'grande'], etichette: ['Classico (Asso, Re, Regina)', 'Grande (anche Fante, 10, 9, 8, 7)'], predefinito: 'classico' },
      { id: 'carte', nome: 'Carte in mano', valori: [5, 3, 7, 10], etichette: ['5 carte', '3 carte', '7 carte', '10 carte'], predefinito: 5 },
    ],
    regole: [
      'Si gioca con il mazzo di Liar\'s Bar: 20 carte, cioè 6 Assi, 6 Re, 6 Regine e 2 Jolly. Da 5 a 8 giocatori si usano due mazzi uguali (40 carte), così ci sono carte per tutti.',
      'Mazzo grande (opzione del tavolo): oltre ad Asso, Re e Regina ci sono anche Fante, 10, 9, 8 e 7, sei per tipo, più 2 Jolly (50 carte). La Carta Dichiarata esce tra tutti gli 8 tipi, quindi dire la verità è più difficile e i bluff sono di più.',
      'Carte in mano (opzione del tavolo): 3, 5 (come in Liar\'s Bar), 7 o 10 a testa. Se le carte di tutti non stanno in un mazzo, si aggiungono altri mazzi uguali.',
      'A ogni round il tavolo sceglie a caso la Carta Dichiarata (Asso, Re o Regina; nel mazzo grande anche Fante, 10, 9, 8 o 7), il mazzo si rimescola e ognuno riceve le sue carte coperte, che vede solo lui. Le carte che avanzano restano coperte da parte: nessuno sa quali sono.',
      'Al tuo turno metti giù coperte da 1 a 3 carte e dichiari che sono tutte la Carta Dichiarata ("Sto giocando due Re"). Puoi dire la verità o mentire mettendo giù carte diverse.',
      'Il Jolly vale sempre come carta giusta, qualunque sia la Carta Dichiarata: giocarlo non è mai una bugia, anche insieme ad altre carte.',
      'Solo il giocatore successivo può mettere in dubbio la tua giocata, come nel gioco vero: può crederci e giocare a sua volta, oppure dire DUBITO. Ha 30 secondi per decidere, poi gioca il computer per lui.',
      'Se dice DUBITO le carte si girano. Se anche una sola non era né la Carta Dichiarata né un Jolly, l\'accusato ha mentito e fa la Roulette Russa; se erano tutte giuste, la Roulette Russa tocca a chi ha dubitato.',
      'Roulette Russa: ognuno ha la sua pistola, con 6 camere e 1 solo proiettile in una camera a caso. Ogni volta che spari il tamburo gira: la prima volta la probabilità che parta il colpo è 1 su 6, poi 1 su 5, 1 su 4… fino alla sesta, che spara di sicuro. Accanto a ogni nome si vede quante volte ha già sparato. Chi viene colpito è eliminato.',
      'Il round ricomincia (nuova Carta Dichiarata, mazzo rimescolato, carte nuove a testa) appena qualcuno preme il grilletto, che si salvi o no, oppure appena qualcuno finisce le carte. Se metti giù le tue ultime carte, il successivo può ancora dire DUBITO; se ci crede, il round finisce senza spari.',
      'Il nuovo round lo comincia chi ha appena sparato (o, se è stato eliminato, il giocatore dopo di lui), oppure chi ha finito le carte. Vince l\'ultimo rimasto in vita al tavolo.',
      'Il computer facile gioca carte a caso e dubita a caso. Il medio dice la verità quando può e dubita quando la giocata è poco probabile, contando le carte buone che non vede. Nel mazzo grande il difficile dubita quasi sempre quando non ha carte buone, perché una bugia da una carta viene scoperta quasi sempre. Il difficile tiene i Jolly per quando servono, ogni tanto nasconde una bugia in mezzo a carte vere e decide se dubitare anche guardando quanto sono cariche le pistole.',
    ],
  },
  crea: (o) => new Dubito(o),
  bot,
  _test: { NOMI, mazzo, quantiMazzi, TIPI_MAZZO, buona, dichiara, TURNO_MS, PD, PG },
};
