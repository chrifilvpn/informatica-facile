// MACHIAVELLI: ramino con due mazzi francesi (104 carte, senza jolly). Ognuno riceve 10 carte (o 13). Al proprio turno
// si calano carte in tavola formando combinazioni (scale di almeno 3 carte dello stesso seme, oppure tris e poker di
// carte dello stesso valore e semi diversi) e si possono RIMESCOLARE liberamente tutte le combinazioni già in tavola,
// purché alla fine del turno ogni gruppo sia valido e si sia calata almeno una carta. Chi non cala pesca una carta.
// Vince chi resta senza carte. Le carte hanno id "7c" e "7cb" (secondo mazzo).
const { mescola } = require('../giochi/carte');
const T = require('../giochi/trucco');
const MV = require('../giochi/mano-vincente');
const { ora } = require('../giochi/orologio'); // orologio vero (nel sito) o finto (nei test)

const SEMI = ['c', 'q', 'f', 'p'];
const NOMI_SEMI = { c: 'cuori', q: 'quadri', f: 'fiori', p: 'picche' };
function mazzoDoppio() {
  const m = [];
  for (const d of ['', 'b']) for (const s of SEMI) for (let r = 1; r <= 13; r++) m.push({ id: `${r}${s}${d}`, rango: r, seme: s });
  return m;
}
const daId = (id) => { const x = String(id).match(/^(\d{1,2})([cqfp])(b?)$/); return x && Number(x[1]) >= 1 && Number(x[1]) <= 13 ? { id: String(id), rango: Number(x[1]), seme: x[2] } : null; };
const puntiCarta = (c) => (c.rango === 1 ? 11 : c.rango >= 11 ? 10 : c.rango);

// ---------- combinazioni ----------
// Una scala: almeno 3 carte dello stesso seme in fila. L'asso sta prima del 2 o dopo il re (con due mazzi anche
// tutti e due: A-2-…-K-A), mai in mezzo (niente K-A-2). Un tris o poker: 3 o 4 carte dello stesso valore, semi diversi.
// Restituisce { tipo, carte (in ordine) } oppure null.
function valuta(carte) {
  if (!Array.isArray(carte) || carte.length < 3) return null;
  const r0 = carte[0].rango;
  if (carte.every((c) => c.rango === r0)) {
    if (carte.length > 4) return null;
    if (new Set(carte.map((c) => c.seme)).size !== carte.length) return null;
    return { tipo: 'tris', carte: [...carte].sort((a, b) => SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme)) };
  }
  const s = carte[0].seme;
  if (!carte.every((c) => c.seme === s) || carte.length > 14) return null;
  const assi = carte.filter((c) => c.rango === 1), altre = carte.filter((c) => c.rango !== 1);
  if (new Set(altre.map((c) => c.rango)).size !== altre.length || assi.length > 2) return null;
  const prova = (posAssi) => {
    const pos = [...altre.map((c) => c.rango), ...posAssi].sort((a, b) => a - b);
    for (let i = 1; i < pos.length; i++) if (pos[i] !== pos[i - 1] + 1) return false;
    return true;
  };
  const ordina = (alto) => [...carte].sort((a, b) => {
    const pa = a.rango === 1 ? (alto(a) ? 14 : 1) : a.rango, pb = b.rango === 1 ? (alto(b) ? 14 : 1) : b.rango;
    return pa - pb;
  });
  if (assi.length === 0) return prova([]) ? { tipo: 'scala', carte: ordina(() => false) } : null;
  if (assi.length === 1) {
    if (prova([1])) return { tipo: 'scala', carte: ordina(() => false) };
    if (prova([14])) return { tipo: 'scala', carte: ordina(() => true) };
    return null;
  }
  if (prova([1, 14])) return { tipo: 'scala', carte: ordina((c) => c === assi[1]) };
  return null;
}

// ---------- ricerca delle mosse (il computer e il consiglio) ----------
// Conti per seme (0..3) e valore (1..13): tav = carte della tavola (vanno usate tutte), man = carte della mano (facoltative).
// Si cerca come dividere tav + una parte di man in combinazioni valide usando più carte della mano possibile.
const K = (s, r) => s * 14 + r;
function contiDa(carte) { const c = new Int8Array(56); for (const x of carte) c[K(SEMI.indexOf(x.seme), x.rango)]++; return c; }

function cercaMossa(tavolo, mano, ms, conRimescolo = true) {
  const tav = contiDa(tavolo.flat()), man = contiDa(mano);
  const fino = ora() + ms;
  let nodi = 0, scaduto = false;
  const memo = new Map();
  // prende una carta (s, r): prima dalla tavola, poi dalla mano. Ritorna 't' o 'm' o null
  const prendi = (s, r) => { const k = K(s, r); if (tav[k] > 0) { tav[k]--; return 't'; } if (man[k] > 0) { man[k]--; return 'm'; } return null; };
  const rendi = (s, r, da) => { if (da === 't') tav[K(s, r)]++; else man[K(s, r)]++; };
  const soloMano = (s, r) => { const k = K(s, r); if (man[k] > 0) { man[k]--; return 'm'; } return null; };

  // gruppi che contengono la carta (s, r) già presa; per ognuno chiama fn(gruppo, presiDallaMano)
  function gruppiCon(s, r, preso, fn, pren) {
    // tris e poker: altri semi dello stesso valore
    const altri = [0, 1, 2, 3].filter((x) => x !== s);
    for (let maschera = 1; maschera < 8; maschera++) {
      const scelti = altri.filter((_, i) => maschera & (1 << i));
      if (scelti.length < 2) continue;
      const presi = [];
      let ok = true;
      for (const x of scelti) { const d = pren(x, r); if (!d) { ok = false; break; } presi.push([x, r, d]); }
      if (ok) fn([[s, r, preso], ...presi]);
      for (const [x, rr, d] of presi) rendi(x, rr, d);
      if (scaduto) return;
    }
    // scale nel seme s: posizioni 1..14 (14 = asso alto)
    for (const pos of r === 1 ? [1, 14] : [r]) {
      for (let a = pos; a >= Math.max(1, pos - 12); a--) {
        // prendi le carte da a a pos-1
        const presi = [];
        let ok = true;
        for (let q = a; q < pos; q++) { const rr = q === 14 ? 1 : q; const d = pren(s, rr); if (!d) { ok = false; break; } presi.push([s, rr, d]); }
        if (ok) {
          const dopo = [];
          for (let b = pos; b <= Math.min(14, a + 13); b++) {
            if (b > pos) { const rr = b === 14 ? 1 : b; const d = pren(s, rr); if (!d) break; dopo.push([s, rr, d]); }
            if (b - a + 1 >= 3) fn([...presi, [s, r, preso], ...dopo]);
            if (scaduto) break;
          }
          for (const [x, rr, d] of dopo) rendi(x, rr, d);
        }
        for (const [x, rr, d] of presi) rendi(x, rr, d);
        if (!ok || scaduto) break; // se manca una carta più in basso, partire ancora più in basso non serve
      }
    }
  }

  // migliore copertura dallo stato attuale: { v: carte della mano usate, g: gruppi } oppure null se impossibile
  function risolvi(fase2) {
    if ((++nodi & 255) === 0 && ora(0.5) > fino) scaduto = true;
    if (scaduto) return null;
    let k = -1;
    if (!fase2) for (let i = 0; i < 56; i++) if (tav[i] > 0) { k = i; break; }
    if (k < 0) {
      // tavola tutta sistemata: con le carte rimaste in mano si possono fare combinazioni nuove
      if (!fase2) return risolvi(true);
      let j = -1;
      for (let i = 0; i < 56; i++) if (man[i] > 0) { j = i; break; }
      if (j < 0) return { v: 0, g: [] };
      const chiave = `m${man.join('')}`;
      if (memo.has(chiave)) return memo.get(chiave);
      const s = Math.floor(j / 14), r = j % 14;
      man[j]--;
      // o la carta resta in mano…
      let best = risolvi(true);
      if (best) best = { v: best.v, g: best.g };
      // …o entra in una combinazione nuova fatta solo di carte della mano
      gruppiCon(s, r, 'm', (gr) => {
        const res = risolvi(true);
        if (res && (!best || res.v + gr.length > best.v)) best = { v: res.v + gr.length, g: [gr, ...res.g] };
      }, soloMano);
      man[j]++;
      if (!scaduto) memo.set(chiave, best);
      return best;
    }
    const chiave = `${tav.join('')}|${man.join('')}`;
    if (memo.has(chiave)) return memo.get(chiave);
    const s = Math.floor(k / 14), r = k % 14;
    tav[k]--;
    let best = null;
    gruppiCon(s, r, 't', (gr) => {
      const res = risolvi(false);
      if (!res) return;
      const v = res.v + gr.filter((x) => x[2] === 'm').length;
      if (!best || v > best.v) best = { v, g: [gr, ...res.g] };
    }, prendi);
    tav[k]++;
    if (!scaduto) memo.set(chiave, best);
    return best;
  }

  let ris = null;
  if (conRimescolo) ris = risolvi(false);
  // senza rimescolare (o se il tempo non è bastato): la tavola resta com'è, si calano combinazioni nuove e si attacca
  const base = mossaSemplice(tavolo, mano, fino + 40);
  if (!ris || base.usate > ris.v) return base.usate ? base : null;
  if (!ris.v) return null;
  // dai conti alle carte vere
  const pool = {};
  const metti = (c, da) => { const k = `${K(SEMI.indexOf(c.seme), c.rango)}${da}`; (pool[k] = pool[k] || []).push(c.id); };
  for (const c of tavolo.flat()) metti(c, 't');
  for (const c of mano) metti(c, 'm');
  const gruppi = ris.g.map((gr) => gr.map(([s, r, da]) => pool[`${K(s, r)}${da}`].pop()));
  return { gruppi, usate: ris.v, completo: !scaduto };
}

// la tavola non si tocca: combinazioni nuove dalla mano (le più lunghe possibili) e carte attaccate alle combinazioni
function mossaSemplice(tavolo, mano, fino = ora() + 30, soloNuove = false) {
  const gruppi = tavolo.map((g) => g.map((c) => c.id));
  let resto = [...mano];
  // nuove combinazioni: ricerca con la tavola vuota
  const nuove = resto.length >= 3 ? cercaNuove(resto, fino) : [];
  for (const g of nuove) { gruppi.push(g); resto = resto.filter((c) => !g.includes(c.id)); }
  let usate = mano.length - resto.length;
  if (!soloNuove) {
    // attacchi: una carta alla volta, finché se ne trova una che sta bene in una combinazione
    for (let giro = true; giro;) {
      giro = false;
      for (const c of resto) {
        const i = gruppi.findIndex((g) => valuta([...g.map(daId), c]));
        if (i >= 0) { gruppi[i] = [...gruppi[i], c.id]; resto = resto.filter((x) => x !== c); usate++; giro = true; break; }
      }
    }
  }
  return { gruppi: gruppi.map((g) => valuta(g.map(daId)).carte.map((c) => c.id)), usate };
}
// combinazioni fatte solo con carte della mano (il maggior numero di carte possibile)
function cercaNuove(mano, fino) { return cercaMossaInterna(mano, Math.max(1, fino - ora())).g; }
// versione della ricerca che restituisce direttamente i gruppi di id (senza la mossa semplice di riserva)
function cercaMossaInterna(mano, ms) {
  const man = contiDa(mano);
  const fino = ora() + ms;
  let nodi = 0, scaduto = false;
  const memo = new Map();
  const soloMano = (s, r) => { const k = K(s, r); if (man[k] > 0) { man[k]--; return 'm'; } return null; };
  const rendi = (s, r) => { man[K(s, r)]++; };
  function gruppiCon(s, r, fn) {
    const altri = [0, 1, 2, 3].filter((x) => x !== s);
    for (let maschera = 1; maschera < 8; maschera++) {
      const scelti = altri.filter((_, i) => maschera & (1 << i));
      if (scelti.length < 2) continue;
      const presi = [];
      let ok = true;
      for (const x of scelti) { if (!soloMano(x, r)) { ok = false; break; } presi.push([x, r]); }
      if (ok) fn([[s, r], ...presi]);
      for (const [x, rr] of presi) rendi(x, rr);
    }
    for (const pos of r === 1 ? [1, 14] : [r]) {
      const dopo = [];
      // la carta è la più bassa rimasta: la scala parte da lei (o, se è un asso alto, finisce con lei: Q-K-A)
      const passo = pos === 14 ? -1 : 1;
      for (let b = pos + passo; b >= 1 && b <= 14; b += passo) { const rr = b === 14 ? 1 : b; if (!soloMano(s, rr)) break; dopo.push([s, rr]); if (dopo.length >= 2) fn([[s, r], ...dopo]); }
      for (const [x, rr] of dopo) rendi(x, rr);
    }
  }
  function risolvi() {
    if ((++nodi & 255) === 0 && ora(0.5) > fino) scaduto = true;
    if (scaduto) return { v: 0, g: [] };
    let j = -1;
    for (let i = 0; i < 56; i++) if (man[i] > 0) { j = i; break; }
    if (j < 0) return { v: 0, g: [] };
    const chiave = man.join('');
    if (memo.has(chiave)) return memo.get(chiave);
    const s = Math.floor(j / 14), r = j % 14;
    man[j]--;
    let best = risolvi();
    gruppiCon(s, r, (gr) => {
      const res = risolvi();
      if (res.v + gr.length > best.v) best = { v: res.v + gr.length, g: [gr, ...res.g] };
    });
    man[j]++;
    if (!scaduto) memo.set(chiave, best);
    return best;
  }
  const ris = risolvi();
  const pool = {};
  for (const c of mano) (pool[K(SEMI.indexOf(c.seme), c.rango)] = pool[K(SEMI.indexOf(c.seme), c.rango)] || []).push(c.id);
  return { v: ris.v, g: ris.g.map((gr) => gr.map(([s, r]) => pool[K(s, r)].pop())) };
}

class Machiavelli {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'machiavelli';
    this.n = n;
    this.nCarte = [10, 13].includes(Number(opzioni.carte)) ? Number(opzioni.carte) : 10;
    this.mazzo = mescola(mazzoDoppio());
    this.mani = Array.from({ length: n }, () => this.mazzo.splice(-this.nCarte));
    this.tavolo = []; // combinazioni: array di array di carte
    this.turno = primo;
    this.passati = 0;        // turni di fila senza calare con il mazzo finito
    this.nMossa = 0;
    this.ultima = null;      // { posto, tipo: 'cala'|'pesca'|'passa', nuove: [id], rimescolato }
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = 0;
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (a.tipo === 'pesca') {
      if (!this.mazzo.length) return { errore: 'Il mazzo è finito: puoi solo calare o passare' };
      if (T.consuma(this, p)) this.truccaPescata(p);
      else if (T.sfortuna(this, p)) this.truccaPescata(p, true);
      this.mani[p].push(this.mazzo.pop());
      this.ultima = { posto: p, tipo: 'pesca', nuove: [], n: ++this.nMossa };
      return this.passaTurno(p);
    }
    if (a.tipo === 'passa') {
      if (this.mazzo.length) return { errore: 'Se non cali devi pescare' };
      this.passati++;
      this.ultima = { posto: p, tipo: 'passa', nuove: [], n: ++this.nMossa };
      if (this.passati >= this.n) return this.chiudi(null);
      return this.passaTurno(p, true);
    }
    if (a.tipo !== 'gioca') return { errore: 'Mossa non valida' };
    if (!Array.isArray(a.tavolo) || a.tavolo.length > 60) return { errore: 'Tavola non valida' };
    const vecchie = new Map(this.tavolo.flat().map((c) => [c.id, c]));
    const mano = new Map(this.mani[p].map((c) => [c.id, c]));
    const visti = new Set();
    const nuove = [];
    const gruppi = [];
    for (const g of a.tavolo) {
      if (!Array.isArray(g)) return { errore: 'Tavola non valida' };
      const carte = [];
      for (const raw of g) {
        const id = String(raw);
        if (visti.has(id)) return { errore: 'Una carta compare due volte' };
        visti.add(id);
        const c = vecchie.get(id) || mano.get(id);
        if (!c) return { errore: 'Questa carta non è né in tavola né nella tua mano' };
        if (!vecchie.has(id)) nuove.push(c);
        carte.push(c);
      }
      const v = valuta(carte);
      if (!v) return { errore: 'C\'è un gruppo che non è una combinazione valida' };
      gruppi.push(v.carte);
    }
    for (const id of vecchie.keys()) if (!visti.has(id)) return { errore: 'Le carte della tavola non si possono riprendere in mano' };
    if (!nuove.length) return { errore: 'Devi calare almeno una carta dalla tua mano' };
    // le combinazioni si tengono in ordine: prima le scale per seme, poi i tris per valore
    const rimescolato = !this.tavolo.every((g) => gruppi.some((h) => h.length >= g.length && g.every((c) => h.some((x) => x.id === c.id))));
    this.tavolo = gruppi.sort(ordineGruppi);
    const usate = new Set(nuove.map((c) => c.id));
    this.mani[p] = this.mani[p].filter((c) => !usate.has(c.id));
    this.passati = 0;
    this.ultima = { posto: p, tipo: 'cala', nuove: [...usate], rimescolato, n: ++this.nMossa };
    if (!this.mani[p].length) return this.chiudi(p);
    if (this.mani[p].length === 1) this.annuncia(p, 'ha solo una carta!', 'ti resta una carta sola!');
    return this.passaTurno(p);
  }
  // il trucco segreto (!win): al suo turno, la mossa che cala più carte (cercata come il computer difficile, anche
  // rimescolando la tavola); se non c'è niente da calare, la carta pescata è quella che serve di più
  suggerimentoWin(p) {
    if (this.turno !== p || this.finita) return null;
    const m = cercaMossa(this.tavolo, this.mani[p], process.env.TEST_VELOCE ? 30 : 300, true);
    if (!m || !m.usate) return null;
    const mie = new Set(this.mani[p].map((c) => c.id));
    const nuovi = m.gruppi.filter((g) => g.some((id) => mie.has(id)));
    const tutte = m.usate === this.mani[p].length ? ' e chiudi!' : '';
    return `💡 Cala ${m.usate} ${m.usate === 1 ? 'carta' : 'carte'}${tutte}: ${nuovi.map((g) => g.map(sigla).join(' ')).join(' · ')}`;
  }

  // il trucco segreto (!win !parola): tutte le carte della mano diventano scale e tris (con poche carte, carte che
  // si attaccano ai gruppi in tavola): al tuo turno cali tutto e vinci. Le carte vengono dal mazzo.
  manoVincente(p) {
    const mano = this.mani[p];
    if (this.finita || !mano) return null;
    const pool = [...this.mazzo, ...mano];
    let nuova = null;
    if (mano.length >= 3) {
      const gruppi = MV.costruisci(pool, mano.length, { valuta, conJolly: 0 });
      if (gruppi) nuova = gruppi.flat();
    } else if (mano.length) {
      const buone = mescola(pool.filter((c) => this.tavolo.some((g) => valuta([...g, c]))));
      const r = new Set();
      nuova = buone.filter((c) => { const k = `${c.rango}${c.seme}`; if (r.has(k)) return false; r.add(k); return true; }).slice(0, mano.length);
      if (nuova.length < mano.length) nuova = null;
    }
    if (!nuova) return '🃏 Adesso non riesco a darti una mano vincente: riprova più tardi';
    const usate = new Set(nuova.map((c) => c.id));
    this.mani[p] = mescola(nuova);
    this.mazzo = mescola(pool.filter((c) => !usate.has(c.id)));
    return '🃏 Mano cambiata: al tuo turno cala tutte le carte';
  }

  // con `peggiore` (il trucco !lose) la carta pescata è quella che serve di meno
  truccaPescata(p, peggiore = false) {
    const mano = this.mani[p], tav = this.tavolo;
    const punteggio = (c) => {
      let v = 0;
      for (const x of mano) {
        if (x.rango === c.rango && x.seme !== c.seme) v += 2;
        else if (x.seme === c.seme && Math.abs(x.rango - c.rango) <= 2 && x.rango !== c.rango) v += 2;
      }
      if (tav.some((g) => valuta([...g, c]))) v += 3; // si attacca subito a una combinazione in tavola
      return v + Math.random();
    };
    const c = T.migliore(this.mazzo, peggiore ? (x) => -punteggio(x) : punteggio);
    if (c) T.inCima(this.mazzo, (x) => x === c);
  }

  passaTurno(p) { this.turno = (p + 1) % this.n; return { ok: true }; }

  chiudi(vincitore) {
    this.finita = true;
    this.turno = null;
    const resti = this.mani.map((m) => m.reduce((s, c) => s + puntiCarta(c), 0));
    let vincitori;
    if (vincitore != null) vincitori = [vincitore];
    else {
      // mazzo finito e nessuno cala più: vince chi ha meno punti in mano
      const min = Math.min(...resti);
      vincitori = resti.map((x, i) => (x === min ? i : -1)).filter((i) => i >= 0);
    }
    if (vincitore != null) this.annuncia(vincitore, 'cala l\'ultima carta e vince!', 'hai calato tutto: vinci!', true);
    else this.annuncia(null, 'Nessuno può più calare: vince chi ha meno punti in mano', '', true);
    this.risultato = { fazioni: resti.map((x, i) => ({ posti: [i], punti: x })), etichetta: 'punti in mano', crescente: true, pareggio: vincitori.length > 1, vincitori };
    return { ok: true };
  }

  vista(p) {
    return {
      gioco: this.id, n: this.n,
      tavolo: this.tavolo, mano: this.mani[p] || [],
      carteInMano: this.mani.map((m) => m.length),
      mazzo: this.mazzo.length, passati: this.passati, ultima: this.ultima, nMossa: this.nMossa,
      puntiFine: this.finita ? this.mani.map((m) => m.reduce((s, c) => s + puntiCarta(c), 0)) : null,
      maniFine: this.finita ? this.mani : null,
      turno: this.turno, inAttesa: false, pausaMs: 0,
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}
// "7♥": una carta in breve, per i consigli
const SIMBOLI = { c: '♥', q: '♦', f: '♣', p: '♠' };
const sigla = (id) => { const c = daId(id); return `${({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[c.rango] || c.rango}${SIMBOLI[c.seme]}`; };

function ordineGruppi(a, b) {
  const sa = a[0].rango === a[1].rango, sb = b[0].rango === b[1].rango;
  if (sa !== sb) return sa ? 1 : -1;
  if (!sa) return SEMI.indexOf(a[0].seme) - SEMI.indexOf(b[0].seme) || (a[0].rango === 1 && a[1].rango !== 2 ? 14 : a[0].rango) - (b[0].rango === 1 && b[1].rango !== 2 ? 14 : b[0].rango);
  return (a[0].rango === 1 ? 14 : a[0].rango) - (b[0].rango === 1 ? 14 : b[0].rango);
}

// =================== COMPUTER ===================
function bot(g, p, livello) {
  const mano = g.mani[p];
  const nessuna = () => (g.mazzo.length ? { tipo: 'pesca' } : { tipo: 'passa' });
  const tav = g.tavolo;
  const veloce = !!process.env.TEST_VELOCE;
  let m;
  if (livello === 'facile') {
    // una sola combinazione nuova per turno, fatta con le sue carte; ogni tanto attacca una carta. Niente rimescolamenti
    const nuove = mano.length >= 3 ? cercaNuove(mano, ora() + 5) : [];
    const gruppi = tav.map((x) => x.map((c) => c.id));
    let usate = 0;
    if (nuove.length) { const scelta = nuove[Math.floor(Math.random() * nuove.length)]; gruppi.push(scelta); usate = scelta.length; }
    else if (Math.random() < 0.4) {
      for (const c of mano) {
        const i = gruppi.findIndex((x) => valuta([...x.map(daId), c]));
        if (i >= 0) { gruppi[i] = valuta([...gruppi[i].map(daId), c]).carte.map((x) => x.id); usate = 1; break; }
      }
    }
    m = { gruppi, usate };
  } else if (livello === 'medio') {
    m = mossaSemplice(tav, mano, ora() + (veloce ? 5 : 60));
  } else {
    m = cercaMossa(tav, mano, veloce ? 6 : 220, true);
  }
  if (!m || !m.usate) return nessuna();
  return { tipo: 'gioca', tavolo: m.gruppi };
}

module.exports = {
  meta: {
    id: 'machiavelli',
    nome: 'Machiavelli',
    tipo: 'carte',
    giocatori: [2, 3, 4, 5],
    descrizione: 'Ramino con due mazzi: cala scale e tris e rimescola come vuoi tutte le combinazioni in tavola. Vince chi finisce le carte.',
    alias: ['machiavelli', 'ramino', 'rummy', 'rimescola', 'scale e tris', 'carte francesi'],
    opzioni: [
      { id: 'carte', nome: 'Carte a testa', valori: [10, 13], etichette: ['10 carte', '13 carte'], predefinito: 10 },
    ],
    regole: [
      'Si gioca con due mazzi francesi da 52 carte, senza jolly (104 carte). Ognuno riceve 10 carte (o 13); le altre formano il mazzo, coperto.',
      'Le combinazioni sono di due tipi. SCALA: almeno 3 carte dello stesso seme in fila (per esempio 5-6-7 di cuori). L\'asso va prima del 2 (A-2-3) o dopo il re (Q-K-A), mai in mezzo (niente K-A-2); con due mazzi una scala può andare dall\'asso all\'asso. TRIS o POKER: 3 o 4 carte dello stesso valore, tutte di semi diversi.',
      'Al tuo turno puoi calare in tavola quante carte vuoi: in combinazioni nuove, attaccandole alle combinazioni che ci sono già, oppure RIMESCOLANDO le combinazioni in tavola: le puoi spezzare, spostare carte da una all\'altra e ricomporle come vuoi. Alla fine del turno ogni gruppo in tavola deve essere una combinazione valida e devi aver calato almeno una carta tua. Le carte della tavola non tornano mai in mano.',
      'Se non cali niente peschi una carta dal mazzo e il turno passa. Quando il mazzo è finito chi non cala passa; se nessuno riesce più a calare per un giro intero la partita finisce e vince chi ha meno punti in mano (asso 11, figure 10, le altre il loro numero).',
      'Vince chi cala la sua ultima carta.',
      'Come si gioca nel sito: tocca (o trascina) le carte per sceglierle, sia dalla mano sia dalla tavola, poi tocca una combinazione per aggiungerle lì oppure "Nuova combinazione". I gruppi non validi hanno il bordo rosso. "Rimetti in mano" riporta in mano le tue carte calate in questo turno, "Ricomincia" annulla tutto. Quando tutto è a posto premi "Conferma".',
      'Il computer facile cala solo combinazioni fatte con le sue carte e ogni tanto ne attacca qualcuna; il medio cala tutto quello che può e attacca alle combinazioni in tavola senza toccarle; il difficile cerca tra tutti i modi di rimescolare la tavola quello che gli fa calare più carte.',
    ],
  },
  crea: (o) => new Machiavelli(o),
  bot,
  _test: { valuta, cercaMossa, mossaSemplice, mazzoDoppio, daId, cercaMossaInterna, puntiCarta },
};
