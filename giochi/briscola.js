const { mazzo40, mescola, valore40, casuale, nomeCarta } = require('./carte');
const T = require('./trucco');

const ORDINE = [1, 3, 10, 9, 8, 7, 6, 5, 4, 2]; // asso, tre, re, donna, fante, 7 ... 2
const PUNTI = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 };
const forza = (c) => 10 - ORDINE.indexOf(valore40(c));
const punti = (c) => PUNTI[valore40(c)] || 0;

function vincitoreDi(tavolo, semeBriscola) {
  let m = tavolo[0];
  for (const g of tavolo.slice(1)) {
    if (g.carta.seme === m.carta.seme) { if (forza(g.carta) > forza(m.carta)) m = g; }
    else if (g.carta.seme === semeBriscola) m = g;
  }
  return m.posto;
}

class Briscola {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'briscola';
    this.n = n;
    // al buio: nessuno vede le proprie carte finché non le gioca (si sceglie solo la posizione); la briscola si vede
    this.alBuio = opzioni.carte === 'coperte';
    this.aSquadre = n === 4;
    let mazzo = mazzo40();
    if (n === 3) mazzo = mazzo.filter((c) => c.id !== '2c'); // in tre si toglie il 2 di cuori
    this.mazzo = mescola(mazzo);
    this.mani = Array.from({ length: n }, () => []);
    this.prese = Array.from({ length: n }, () => []);
    this.tavolo = [];
    this.turno = primo;
    this.inAttesa = false;
    this.pausaMs = 1500;
    this.finita = false;
    this.risultato = null;
    this.evento = null;
    this.nEv = 0;
    for (let g = 0; g < 3; g++) for (let k = 0; k < n; k++) this.mani[(primo + k) % n].push(this.mazzo.pop());
    this.briscola = this.mazzo.pop();
    this.mazzo.unshift(this.briscola); // scoperta sotto il mazzo: sarà l'ultima pescata
  }

  annuncia(posto, testo, testoIo, forte = false) {
    this.evento = { id: ++this.nEv, posto, testo, testoIo, forte };
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta che si raccolga la mano' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || a.tipo !== 'gioca') return { errore: 'Mossa non valida' };
    // al buio si gioca per posizione (con il nome della carta si potrebbe scoprire che cosa si ha in mano)
    const i = this.alBuio ? (Number.isInteger(a.pos) && a.pos >= 0 && a.pos < this.mani[p].length ? a.pos : -1) : this.mani[p].findIndex((c) => c.id === a.carta);
    if (i < 0) return { errore: 'Non hai questa carta' };
    const [c] = this.mani[p].splice(i, 1);
    this.tavolo.push({ posto: p, carta: c });
    if (this.tavolo.length === this.n) { this.inAttesa = true; this.turno = null; }
    else this.turno = (p + 1) % this.n;
    return { ok: true };
  }

  avanza() {
    if (!this.inAttesa) return;
    const v = vincitoreDi(this.tavolo, this.briscola.seme);
    const carte = this.tavolo.map((g) => g.carta);
    const pt = carte.reduce((s, c) => s + punti(c), 0);
    this.prese[v].push(...carte);
    this.annuncia(v, `prende ${pt} ${pt === 1 ? 'punto' : 'punti'}`, `prendi ${pt} ${pt === 1 ? 'punto' : 'punti'}`);
    this.tavolo = [];
    if (this.mazzo.length >= this.n) for (let k = 0; k < this.n; k++) {
      const q = (v + k) % this.n;
      if (T.consuma(this, q)) this.truccaPescata();
      else if (T.sfortuna(this, q)) this.pescataInutile();
      this.mani[q].push(this.mazzo.pop());
    }
    this.inAttesa = false;
    this.turno = v;
    if (this.mani.every((m) => m.length === 0)) this.chiudi();
  }

  // il trucco segreto (!win): in cima al mazzo la briscola più alta che c'è ancora (non quella scoperta sotto)
  truccaPescata() {
    const B = this.briscola.seme;
    const alte = this.mazzo.filter((c) => c.seme === B && c !== this.briscola);
    const c = T.migliore(alte, forza);
    if (c) T.inCima(this.mazzo, (x) => x === c);
  }

  // il trucco segreto (!lose): in cima al mazzo una scartina (niente punti, non di briscola)
  pescataInutile() {
    const B = this.briscola.seme;
    const lisce = this.mazzo.filter((c) => c.seme !== B && !punti(c) && c !== this.briscola);
    const c = T.migliore(lisce, (x) => -forza(x) + Math.random());
    if (c) T.inCima(this.mazzo, (x) => x === c);
  }

  // a mazzo finito non si pesca più: il trucco diventa il consiglio della carta da giocare
  suggerimentoWin(p) {
    if (this.mazzo.length >= this.n || this.turno !== p || this.inAttesa || !this.mani[p].length) return null;
    const a = bot(this, p, 'difficile', true);
    const k = this.mani[p].findIndex((x) => x.id === a.carta), c = this.mani[p][k];
    return c ? `💡 Gioca ${this.alBuio ? `la ${['prima', 'seconda', 'terza'][k] || `${k + 1}ª`} carta (${nomeCarta(c)})` : nomeCarta(c)}` : null;
  }

  chiudi() {
    this.finita = true;
    this.turno = null;
    const pg = this.prese.map((p) => p.reduce((s, c) => s + punti(c), 0));
    const fazioni = this.aSquadre
      ? [{ posti: [0, 2], punti: pg[0] + pg[2] }, { posti: [1, 3], punti: pg[1] + pg[3] }]
      : pg.map((x, i) => ({ posti: [i], punti: x }));
    const max = Math.max(...fazioni.map((f) => f.punti));
    const top = fazioni.filter((f) => f.punti === max);
    this.risultato = { fazioni, etichetta: 'punti', pareggio: top.length > 1, vincitori: top.length === 1 ? top[0].posti : [] };
  }

  vista(p) {
    return {
      gioco: this.id,
      n: this.n,
      aSquadre: this.aSquadre,
      // al buio la mano è fatta solo di dorsi: il server non manda nemmeno quali carte sono
      mano: this.alBuio ? (this.mani[p] || []).map((c, k) => ({ coperta: true, pos: k })) : this.mani[p] || [],
      alBuio: this.alBuio,
      carteInMano: this.mani.map((m) => m.length),
      tavolo: this.tavolo,
      briscola: this.briscola,
      mazzo: this.mazzo.length,
      turno: this.turno,
      inAttesa: this.inAttesa,
      maniPrese: this.prese.map((x) => x.length / this.n),
      finita: this.finita,
      risultato: this.risultato,
      evento: this.evento,
    };
  }
}

// ---------- Computer ----------
// (vede: il consiglio del trucco conosce le carte anche al buio)
function bot(g, p, livello, vede = false) {
  const mano = g.mani[p];
  // al buio anche il computer non sa che carte ha: ne gioca una a caso
  if (g.alBuio && !vede) return { tipo: 'gioca', pos: Math.floor(Math.random() * mano.length) };
  const gioca = (c) => ({ tipo: 'gioca', carta: c.id });
  if (livello === 'facile') return gioca(casuale(mano));

  const B = g.briscola.seme;
  const isB = (c) => c.seme === B;
  // "liscio": la carta che costa meno buttare
  const costo = (c) => (isB(c) ? 20 + forza(c) : 0) + punti(c) * 2 + forza(c) * 0.1;
  const perCosto = [...mano].sort((a, b) => costo(a) - costo(b));
  const liscio = perCosto[0];

  if (g.tavolo.length === 0) {
    if (livello === 'difficile' && g.mazzo.length === 0) {
      // a fine mazzo: se ho la briscola più alta rimasta, la gioco per prendere
      const giocate = new Set([...g.prese.flat(), ...mano].map((c) => c.id));
      const briscoleFuori = mazzo40().filter((c) => c.seme === B && !giocate.has(c.id));
      const mieB = mano.filter(isB).sort((a, b) => forza(b) - forza(a));
      if (mieB.length && briscoleFuori.every((c) => forza(c) < forza(mieB[0]))) return gioca(mieB[0]);
    }
    return gioca(liscio);
  }

  const puntiTavolo = g.tavolo.reduce((s, x) => s + punti(x.carta), 0);
  const vinceOra = vincitoreDi(g.tavolo, B);
  const compagnoVince = g.aSquadre && vinceOra % 2 === p % 2;
  const ultimo = g.tavolo.length === g.n - 1;

  if (compagnoVince) {
    // il compagno sta prendendo: se sono ultimo (o al difficile) gli carico punti
    if (ultimo || livello === 'difficile') {
      const carichi = mano.filter((c) => !isB(c) && punti(c) > 0).sort((a, b) => punti(b) - punti(a));
      if (carichi.length && (ultimo || forza(g.tavolo.find((x) => x.posto === vinceOra).carta) >= 8)) return gioca(carichi[0]);
    }
    return gioca(liscio);
  }

  const vincenti = mano.filter((c) => vincitoreDi([...g.tavolo, { posto: p, carta: c }], B) === p);
  const lisciVincenti = vincenti.filter((c) => !isB(c)).sort((a, b) => punti(b) - punti(a));
  const briscoleVincenti = vincenti.filter(isB).sort((a, b) => forza(a) - forza(b));

  if (lisciVincenti.length) return gioca(lisciVincenti[0]); // prendo senza sprecare briscole
  const soglia = livello === 'difficile' ? (ultimo ? 3 : 10) : 10;
  if (briscoleVincenti.length && puntiTavolo >= soglia) {
    const b = briscoleVincenti[0];
    // non sprecare asso o tre di briscola per pochi punti
    if (punti(b) < 10 || puntiTavolo >= 10) return gioca(b);
  }
  return gioca(liscio);
}

module.exports = {
  meta: {
    id: 'briscola',
    nome: 'Briscola',
    giocatori: [2, 3, 4],
    descrizione: 'Il classico: prendi più punti degli altri. In quattro si gioca in coppia.',
    opzioni: [
      { id: 'carte', nome: 'Carte in mano', valori: ['scoperte', 'coperte'], etichette: ['Normali: vedi le tue carte', 'Al buio: le scopri solo quando le giochi'], predefinito: 'scoperte' },
    ],
    regole: [
      'Si gioca con 40 carte: dall\'asso al 7, più fante, donna e re. In tre si toglie il 2 di cuori.',
      'Ognuno riceve 3 carte. Una carta scoperta sotto il mazzo indica il seme di briscola, e sarà l\'ultima pescata.',
      'A turno ognuno gioca una carta. Prende la briscola più alta; se non ci sono briscole prende la carta più alta del seme giocato per primo.',
      'Ordine di forza: asso, tre, re, donna, fante, 7, 6, 5, 4, 2.',
      'Punti: asso 11, tre 10, re 4, donna 3, fante 2. In tutto sono 120: vince chi ne fa almeno 61.',
      'Chi prende pesca per primo e gioca per primo la mano successiva.',
      'In quattro giocano in coppia i giocatori seduti uno di fronte all\'altro.',
      'Al buio (opzione "Carte in mano"): hai sempre 3 carte ma sono coperte, anche per te. Scegli quale giocare (prima, seconda o terza) e la scopri solo quando arriva sul tavolo. La briscola sotto il mazzo resta scoperta. Anche il computer gioca senza guardare.',
      'Le carte in mano sono in ordine di seme (la briscola in fondo) e dalla più debole alla più forte. Sulle carte che valgono punti c\'è un numerino in alto a destra: asso 11, tre 10, re 4, donna 3, fante 2.',
    ],
  },
  crea: (o) => new Briscola(o),
  bot,
  _test: { vincitoreDi, punti, forza },
};
