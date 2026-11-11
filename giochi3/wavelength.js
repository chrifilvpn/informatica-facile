// WAVELENGTH: sulla manopola c'è uno spettro tra due concetti opposti (Freddo ↔ Caldo) e un
// bersaglio nascosto che vede solo lo Psichico. Lo Psichico sceglie uno spettro tra due e dà un indizio (un esempio,
// niente numeri); la sua squadra discute in chat e gira la manopola dove pensa che sia il bersaglio. Centro pieno 4
// punti, vicino 3, nella zona 2. A squadre: gli avversari scommettono se il centro è a sinistra o a destra della
// manopola (1 punto se indovinano, tranne sul 4) e vince chi arriva per primo all'obiettivo; chi fa 4 restando
// indietro gioca ancora (rimonta). In cooperativa si gioca tutti insieme un numero di carte (un 4 ne regala una).
// Le squadre si formano alternando i posti (pari = Viola, dispari = Verdi); lo Psichico gira dentro la squadra.
// La manopola è una sola per la squadra: chiunque la gira e la blocca il primo che preme «Blocca»; con persone in
// squadra i computer non toccano la manopola ma lasciano un segno con il loro consiglio.
const { SPETTRI } = require('./wavelength-dati');

const VIOLA = 0, VERDI = 1;
const NOMI_SQ = ['Viola', 'Verdi'];
const PAUSA_RIVELA = Number(process.env.WAVELENGTH_PAUSA) || 6000; // il bersaglio scoperto resta qualche secondo
const MAX_TURNI = 60; // a squadre: oltre, vince chi è avanti (non succede mai davvero)
const MAX_BONUS = 3; // in cooperativa al massimo 3 carte in più
// le zone del bersaglio: distanza dal centro (in centesimi della manopola) → punti
const ZONE = [[2, 4], [5, 3], [8, 2]];

function puntiPer(manopola, bersaglio) {
  const d = Math.abs(manopola - bersaglio);
  for (const [lim, pt] of ZONE) if (d <= lim) return pt;
  return 0;
}

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// controlla l'indizio: null se va bene, altrimenti il motivo
function controllaIndizio(testo, spettro) {
  const t = String(testo ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!t) return 'Scrivi l\'indizio';
  if (t.length > 40) return 'L\'indizio è un esempio breve: al massimo 40 caratteri';
  if (/[0-9%]/.test(t) || /\b(percento|per cento)\b/i.test(t)) return 'Niente numeri o percentuali: dai un esempio, non una misura';
  if (!/[a-zà-ÿ]/i.test(t)) return 'L\'indizio deve contenere almeno una parola';
  if (spettro && [spettro.s, spettro.d].some((x) => norm(x) === norm(t))) return 'Non puoi usare come indizio uno dei due estremi';
  return null;
}

const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const limita = (v) => Math.max(0, Math.min(100, Math.round(v)));
// un rumore "a campana" (somma di tre casuali) largo ±ampiezza
const rumore = (ampiezza) => ((Math.random() + Math.random() + Math.random()) / 1.5 - 1) * ampiezza;

class Wavelength {
  constructor({ n, primo = 0, opzioni = {}, bot = [] }) {
    this.id = 'wavelength';
    this.n = n;
    this.bot = Array.from({ length: n }, (_, i) => bot[i] || null);
    // a squadre servono almeno due giocatori per squadra (Psichico + chi indovina): sotto i 4 si gioca insieme
    this.modo = opzioni.modo === 'cooperativa' || n < 4 ? 'cooperativa' : 'squadre';
    this.obiettivo = [6, 10].includes(Number(opzioni.obiettivo)) ? Number(opzioni.obiettivo) : 10;
    this.totCarte = [7, 10].includes(Number(opzioni.carte)) ? Number(opzioni.carte) : 7;
    this.coop = this.modo === 'cooperativa';
    this.membri = this.coop ? [Array.from({ length: n }, (_, i) => i)] : [[], []];
    if (!this.coop) for (let i = 0; i < n; i++) this.membri[i % 2].push(i);
    const k = Math.max(0, Number(primo) || 0);
    this.giro = this.membri.map((m) => k % m.length); // chi fa lo Psichico, dentro ogni squadra
    this.mazzo = mescola(SPETTRI.map((_, i) => i));
    this.punti = this.coop ? [0] : [0, 0];
    this.sq = this.coop ? 0 : (k % 2);
    this.carteGiocate = 0;
    this.bonus = 0;
    this.storia = []; // { squadra, psichico, spettro, indizio, bersaglio, manopola, punti, lato, latoOk, rimonta }
    this.usati = new Set();
    this.finita = false;
    this.risultato = null;
    this.vincitore = null;
    this.evento = null;
    this.nEv = 0;
    this.inAttesa = false;
    this.pausaMs = PAUSA_RIVELA;
    this.nuovoTurno();
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  squadraDi(p) { return this.coop ? 0 : p % 2; }
  get avversari() { return this.coop ? null : 1 - this.sq; }
  indovini() { return this.membri[this.sq].filter((i) => i !== this.psichico); }
  get velocitaBot() { return this.fase === 'indizio' ? 2.5 : 2; }

  pesca() {
    if (!this.mazzo.length) this.mazzo = mescola(SPETTRI.map((_, i) => i));
    return this.mazzo.pop();
  }

  nuovoTurno() {
    const m = this.membri[this.sq];
    this.psichico = m[this.giro[this.sq] % m.length];
    this.giro[this.sq]++;
    this.carte = [this.pesca(), this.pesca()];
    this.spettro = null;
    this.indizio = null;
    this.bersaglio = 3 + Math.floor(Math.random() * 95); // da 3 a 97
    this.manopola = 50;
    this.lato = null;
    this.consigli = new Array(this.n).fill(null); // { valore } o { lato } dei computer, con persone in squadra
    this.mossaDa = null; // chi ha girato la manopola per ultimo
    this.fase = 'indizio';
    this.turno = this.psichico;
    this.rivelato = null;
  }

  // chi deve ancora agire nelle fasi "tutti insieme" (il server fa muovere i computer tra questi)
  attesi() {
    if (this.finita || this.inAttesa || (this.fase !== 'manopola' && this.fase !== 'previsione')) return [];
    const chi = this.fase === 'manopola' ? this.indovini() : this.membri[this.avversari];
    const persone = chi.filter((i) => !this.bot[i]);
    // con persone in squadra il computer dà solo un consiglio e lascia decidere a loro
    return chi.filter((i) => !this.bot[i] || !persone.length || !this.consigli[i]);
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!Number.isInteger(p) || p < 0 || p >= this.n) return { errore: 'Posto non valido' };
    if (this.inAttesa) return { errore: 'Un attimo…' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (a.tipo === 'indizio') {
      if (this.fase !== 'indizio') return { errore: 'L\'indizio è già stato dato' };
      if (p !== this.psichico) return { errore: 'L\'indizio lo dà lo Psichico' };
      const c = Number(a.carta ?? 0);
      if (c !== 0 && c !== 1) return { errore: 'Scegli uno dei due spettri' };
      const spettro = SPETTRI[this.carte[c]];
      const motivo = controllaIndizio(a.testo, spettro);
      if (motivo) return { errore: motivo };
      this.spettro = this.carte[c];
      this.indizio = String(a.testo).normalize('NFC').trim().replace(/\s+/g, ' ');
      this.usati.add(norm(this.indizio));
      this.fase = 'manopola';
      this.turno = null;
      this.annuncia(p, `dà l'indizio «${this.indizio}» (${spettro.s} ↔ ${spettro.d})`, `hai dato l'indizio «${this.indizio}»`);
      return { ok: true };
    }
    if (a.tipo === 'gira' || a.tipo === 'blocca' || (a.tipo === 'consiglia' && this.fase === 'manopola')) {
      if (this.fase !== 'manopola') return { errore: this.fase === 'indizio' ? 'Aspetta l\'indizio dello Psichico' : 'La manopola è già bloccata' };
      if (p === this.psichico) return { errore: 'Lo Psichico non può toccare la manopola (e nemmeno dare suggerimenti!)' };
      if (this.squadraDi(p) !== this.sq) return { errore: 'La manopola la gira l\'altra squadra' };
      if (a.valore !== undefined && a.valore !== null) {
        const v = Number(a.valore);
        if (!Number.isFinite(v) || v < 0 || v > 100) return { errore: 'Posizione non valida' };
        if (a.tipo === 'consiglia') { this.consigli[p] = { valore: limita(v) }; return { ok: true }; }
        this.manopola = limita(v);
        this.mossaDa = p;
      } else if (a.tipo !== 'blocca') return { errore: 'Posizione non valida' };
      if (a.tipo === 'blocca') this.blocca(p);
      return { ok: true };
    }
    if (a.tipo === 'lato' || a.tipo === 'consiglia') {
      if (this.fase !== 'previsione') return { errore: 'Adesso non si scommette' };
      if (this.squadraDi(p) !== this.avversari) return { errore: 'Scommettono gli avversari' };
      if (!['sinistra', 'destra'].includes(a.lato)) return { errore: 'Scegli sinistra o destra' };
      if (a.tipo === 'consiglia') { this.consigli[p] = { lato: a.lato }; return { ok: true }; }
      this.lato = a.lato;
      if (a.conferma) this.chiudiTurno(p);
      return { ok: true };
    }
    if (a.tipo === 'confermaLato') {
      if (this.fase !== 'previsione') return { errore: 'Adesso non si scommette' };
      if (this.squadraDi(p) !== this.avversari) return { errore: 'Scommettono gli avversari' };
      if (!this.lato) return { errore: 'Scegli prima sinistra o destra' };
      this.chiudiTurno(p);
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }

  blocca(p) {
    this.consigli.fill(null);
    if (p != null) this.annuncia(p, `blocca la manopola`, 'hai bloccato la manopola');
    if (this.coop) return this.chiudiTurno(null);
    this.fase = 'previsione';
    this.annuncia(p, `blocca la manopola: ora i ${NOMI_SQ[this.avversari]} scommettono, sinistra o destra?`, `hai bloccato la manopola: ora scommettono i ${NOMI_SQ[this.avversari]}`);
  }

  // si scopre il bersaglio e si contano i punti
  chiudiTurno(p) {
    const pt = puntiPer(this.manopola, this.bersaglio);
    let latoOk = null;
    if (!this.coop && this.lato) {
      latoOk = pt !== 4 && (this.lato === 'sinistra' ? this.bersaglio < this.manopola : this.bersaglio > this.manopola);
    }
    this.punti[this.sq] += pt;
    if (latoOk) this.punti[this.avversari] += 1;
    this.carteGiocate++;
    // rimonta: chi fa centro pieno restando indietro gioca ancora
    const rimonta = !this.coop && pt === 4 && this.punti[this.sq] < this.punti[this.avversari];
    if (this.coop && pt === 4 && this.bonus < MAX_BONUS) this.bonus++;
    const r = { squadra: this.sq, psichico: this.psichico, spettro: this.spettro, indizio: this.indizio, bersaglio: this.bersaglio, manopola: this.manopola, punti: pt, lato: this.coop ? null : this.lato, latoOk, rimonta, bonus: this.coop && pt === 4 };
    this.storia.push(r);
    this.rivelato = r;
    this.consigli.fill(null);
    const parti = [pt === 4 ? 'CENTRO PIENO! 🎯 4 punti' : pt ? `${pt} punti` : 'fuori dal bersaglio, 0 punti'];
    if (!this.coop) parti.push(latoOk ? `i ${NOMI_SQ[this.avversari]} indovinano il lato: +1` : this.lato ? `i ${NOMI_SQ[this.avversari]} sbagliano il lato` : '');
    if (rimonta) parti.push(`rimonta: i ${NOMI_SQ[this.sq]} giocano ancora!`);
    if (r.bonus) parti.push('carta bonus!');
    this.annuncia(null, `Bersaglio a ${this.bersaglio}: ${parti.filter(Boolean).join(' · ')}`, '', pt === 4);
    this.turno = null;
    this.fase = 'rivela';
    // fine partita?
    if (this.coop) {
      if (this.carteGiocate >= this.totCarte + this.bonus) return this.chiudi();
    } else {
      const [a, b] = this.punti;
      if ((a >= this.obiettivo || b >= this.obiettivo) && a !== b) return this.chiudi();
      if (this.storia.length >= MAX_TURNI) return this.chiudi();
    }
    this._prossima = rimonta ? this.sq : this.coop ? 0 : 1 - this.sq;
    this.inAttesa = true;
    this.pausaMs = PAUSA_RIVELA;
  }

  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    this.sq = this._prossima;
    this.nuovoTurno();
  }

  // tavolo senza computer: chi manca viene saltato
  salta(posto) {
    if (this.finita || this.inAttesa) return;
    if (this.fase === 'indizio' && posto === this.psichico) {
      this.annuncia(posto, 'non c\'è: si passa al prossimo Psichico', '');
      this.carte = [this.pesca(), this.pesca()];
      const m = this.membri[this.sq];
      this.psichico = m[this.giro[this.sq]++ % m.length];
      this.turno = this.psichico;
      return;
    }
    if (this.fase === 'manopola') return this.blocca(null);
    if (this.fase === 'previsione') return this.chiudiTurno(null);
  }

  chiudi() {
    this.finita = true;
    this.inAttesa = false;
    this.turno = null;
    this.fase = 'fine';
    if (this.coop) {
      const tot = this.punti[0];
      const media = tot / Math.max(1, this.carteGiocate);
      const giudizio = media >= 3.2 ? 'Telepatia pura! 🧠' : media >= 2.5 ? 'Sulla stessa lunghezza d\'onda! 📡' : media >= 1.8 ? 'Buona sintonia 📻' : media >= 1 ? 'Qualche interferenza… 📶' : 'Fuori frequenza 🙉';
      this.risultato = {
        fazioni: [{ posti: this.membri[0], punti: tot }],
        etichetta: 'punti', pareggio: false, vincitori: this.membri[0],
        titolo: `${tot} punti in ${this.carteGiocate} carte · ${giudizio}`,
      };
      this.giudizio = giudizio;
      return;
    }
    const [a, b] = this.punti;
    this.vincitore = a === b ? null : a > b ? VIOLA : VERDI;
    this.risultato = {
      fazioni: [VIOLA, VERDI].map((s) => ({ posti: this.membri[s], punti: this.punti[s] })),
      etichetta: 'punti', pareggio: this.vincitore == null,
      vincitori: this.vincitore == null ? [] : this.membri[this.vincitore],
    };
  }

  // la chat: lo Psichico conosce il bersaglio, quindi finché non si scopre non può suggerire (il messaggio resta suo)
  leggiChat(p, testo) {
    if (this.finita || this.inAttesa || p !== this.psichico || this.fase === 'rivela') return {};
    return { soloPer: [p], privato: '🤐 Sei lo Psichico: finché il bersaglio non si scopre gli altri non leggono i tuoi messaggi' };
  }
  puoReagire(p) { return !(this.leggiChat(p, '').soloPer); } // lo Psichico non manda emoji finché non si scopre
  // il trucco segreto (!win): allo Psichico l'indizio del computer difficile, a chi gira la manopola dov'è il centro,
  // agli avversari da che parte scommettere
  suggerimentoWin(posto) {
    if (this.finita || this.inAttesa) return null;
    if (this.fase === 'indizio' && posto === this.psichico) {
      const a = psichicoComputer(this, 'difficile');
      const sp = SPETTRI[this.carte[a.carta]];
      return `💡 ${sp.s} ↔ ${sp.d}: «${a.testo}»`;
    }
    if (this.fase === 'manopola' && this.indovini().includes(posto)) {
      const sp = SPETTRI[this.spettro];
      return `🎯 Il centro è a ${this.bersaglio} (0 = ${sp.s}, 100 = ${sp.d})`;
    }
    if (this.fase === 'previsione' && this.squadraDi(posto) === this.avversari) {
      if (Math.abs(this.bersaglio - this.manopola) <= ZONE[0][0]) return '🤫 Hanno fatto centro: la scommessa non conta';
      return this.bersaglio < this.manopola ? '⬅️ Scommetti a SINISTRA' : '➡️ Scommetti a DESTRA';
    }
    return null;
  }

  vista(posto) {
    const sp = this.spettro != null ? SPETTRI[this.spettro] : null;
    const aperto = this.finita || this.fase === 'rivela';
    const psichico = posto === this.psichico;
    return {
      gioco: this.id, n: this.n, modo: this.modo, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      aSquadre: !this.coop, membri: this.membri, sq: this.sq, psichico: this.psichico,
      obiettivo: this.obiettivo, totCarte: this.totCarte + this.bonus, carteGiocate: this.carteGiocate, punti: this.punti,
      // le due carte tra cui scegliere le vede solo lo Psichico
      carte: psichico && this.fase === 'indizio' ? this.carte.map((i) => ({ s: SPETTRI[i].s, d: SPETTRI[i].d })) : null,
      spettro: sp ? { s: sp.s, d: sp.d } : null,
      indizio: this.indizio,
      // il bersaglio lo vede solo lo Psichico (e tutti quando si scopre)
      bersaglio: psichico || aperto ? this.bersaglio : null,
      manopola: this.manopola, mossaDa: this.mossaDa, lato: this.lato,
      consigli: this.consigli,
      rivelato: aperto ? this.rivelato : null,
      storia: this.storia.map((r) => ({ ...r, spettro: { s: SPETTRI[r.spettro].s, d: SPETTRI[r.spettro].d } })),
      vincitore: this.vincitore, giudizio: this.giudizio || null,
      finita: this.finita,
      risultato: this.risultato && !this.coop && this.vincitore != null && !this.membri[this.vincitore].includes(posto) ? { ...this.risultato, titolo: `Vincono i ${NOMI_SQ[this.vincitore]}!` } : this.risultato,
      evento: this.evento,
    };
  }
}

// ---------------- computer ----------------
// quanto "sbaglia" il computer a capire un indizio e a sceglierne uno
const INCERTEZZA = { facile: 16, medio: 11, difficile: 8 };

// lo Psichico computer: tra i due spettri, l'esempio più vicino al bersaglio (il facile si accontenta)
function psichicoComputer(g, livello) {
  const L = INCERTEZZA[livello] ? livello : 'medio';
  const tutti = [];
  g.carte.forEach((idx, carta) => {
    for (const [testo, pos] of SPETTRI[idx].e) if (!g.usati.has(norm(testo))) tutti.push({ carta, testo, d: Math.abs(pos - g.bersaglio) });
  });
  if (!tutti.length) return { tipo: 'indizio', carta: 0, testo: g.bersaglio < 50 ? `abbastanza ${SPETTRI[g.carte[0]].s.toLowerCase()}` : `abbastanza ${SPETTRI[g.carte[0]].d.toLowerCase()}` };
  tutti.sort((a, b) => a.d - b.d);
  const tolleranza = { facile: 14, medio: 5, difficile: 0 }[L];
  const buoni = tutti.filter((x) => x.d <= tutti[0].d + tolleranza);
  const x = buoni[Math.floor(Math.random() * buoni.length)];
  return { tipo: 'indizio', carta: x.carta, testo: x.testo };
}

// dove pensa il computer che sia il bersaglio, dato l'indizio
function stima(g, livello) {
  const sp = SPETTRI[g.spettro];
  const w = norm(g.indizio);
  const amp = INCERTEZZA[livello] || INCERTEZZA.medio;
  // 1) l'indizio è uno degli esempi che conosce (o ci somiglia molto)
  let trovato = sp.e.find(([t]) => norm(t) === w);
  if (!trovato) trovato = sp.e.find(([t]) => { const n = norm(t); return Math.min(n.length, w.length) >= 4 && (n.includes(w) || w.includes(n)); });
  if (trovato) return limita(trovato[1] + rumore(amp));
  // 2) parole in comune con gli esempi: la media delle loro posizioni
  const parole = w.split(' ').filter((x) => x.length >= 4);
  const simili = sp.e.filter(([t]) => norm(t).split(' ').some((x) => x.length >= 4 && parole.some((y) => y.slice(0, 5) === x.slice(0, 5))));
  if (simili.length) return limita(simili.reduce((s, [, pos]) => s + pos, 0) / simili.length + rumore(amp * 1.5));
  // 3) l'indizio nomina un estremo o una via di mezzo
  const sx = norm(sp.s), dx = norm(sp.d);
  const molto = /\b(molto|super|estremamente|tantissimo|troppo)\b/.test(w) ? 6 : 0;
  if (w.includes(sx.slice(0, 5))) return limita(14 - molto + rumore(amp * 1.5));
  if (w.includes(dx.slice(0, 5))) return limita(86 + molto + rumore(amp * 1.5));
  if (/\b(medio|media|normale|cosi cosi|via di mezzo|meta|neutro|tiepido|abbastanza)\b/.test(w)) return limita(50 + rumore(amp * 1.5));
  // 4) non lo capisce: tira a indovinare, un po' verso il centro
  return limita(50 + rumore(32));
}

// che cosa fa un computer nelle fasi di squadra (le sue stime restano le stesse per tutto il turno)
function bot(g, p, livello) {
  if (g.fase === 'indizio') return g.turno === p ? psichicoComputer(g, livello) : null;
  if (!g.attesi().includes(p)) return null;
  const chiave = `${g.storia.length}:${g.fase}`;
  g._stime = g._stime || {};
  let s = g._stime[p];
  if (!s || s.chiave !== chiave) {
    let v = stima(g, livello);
    // una squadra di soli computer (Psichico compreso) si capisce "a memoria" (stessi esempi): contro persone
    // sbaglia un po' di più, così una squadra di persone se la gioca alla pari
    const sq = g.fase === 'manopola' ? g.sq : g.avversari;
    const soliComputer = (k) => g.membri[k].every((i) => g.bot[i]);
    if (!g.coop && g.fase === 'manopola' && soliComputer(sq) && !soliComputer(1 - sq)) v = limita(v + rumore(9));
    s = g._stime[p] = { chiave, v };
  }
  const squadra = g.fase === 'manopola' ? g.indovini() : g.coop ? [] : g.membri[g.avversari];
  const persone = squadra.filter((i) => !g.bot[i] && i !== p);
  if (g.fase === 'manopola') {
    if (g.bot[p] && persone.length) return { tipo: 'consiglia', valore: s.v };
    // tra computer: la manopola va sulla media dei consigli dei compagni computer, se ce ne sono
    const altri = g.consigli.filter((c) => c && c.valore != null).map((c) => c.valore);
    const v = altri.length ? limita((s.v + altri.reduce((a, b) => a + b, 0)) / (altri.length + 1)) : s.v;
    return { tipo: 'blocca', valore: v };
  }
  if (g.fase === 'previsione') {
    // da che parte sta il bersaglio secondo me, rispetto alla manopola bloccata (a parità, verso il centro)
    const lato = s.v === g.manopola ? (g.manopola > 50 ? 'sinistra' : 'destra') : s.v < g.manopola ? 'sinistra' : 'destra';
    if (g.bot[p] && persone.length) return { tipo: 'consiglia', lato };
    return { tipo: 'lato', lato, conferma: true };
  }
  return null;
}

module.exports = {
  meta: {
    id: 'wavelength',
    squadreSala: { nomi: ['🟣 Viola', '🟢 Verdi'], min: 4, se: { modo: ['squadre'] } },
    nome: 'Wavelength',
    tipo: 'tabellone',
    giocatori: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    passaTelefono: true, // si può giocare tutti da un solo dispositivo (server.js: posti locali)
    descrizione: 'Lo Psichico vede il bersaglio su uno spettro (Freddo ↔ Caldo) e dà un indizio: la squadra gira la manopola dove pensa che sia. A squadre o tutti insieme.',
    alias: ['wavelength', 'sintonia', 'lunghezza d\'onda', 'onda', 'psichico', 'spettro', 'manopola'],
    opzioni: [
      { id: 'telefono', nome: 'Dispositivi', valori: ['no', 'si'], etichette: ['Ognuno col suo dispositivo', 'Un solo dispositivo: ci si passa il telefono'], predefinito: 'no' },
      { id: 'modo', nome: 'Modalità', valori: ['squadre', 'cooperativa'], etichette: ['A squadre (da 4 giocatori)', 'Cooperativa (tutti insieme)'], predefinito: 'squadre' },
      { id: 'obiettivo', nome: 'A squadre si vince a', valori: [10, 6], etichette: ['10 punti', '6 punti (partita corta)'], predefinito: 10 },
      { id: 'carte', nome: 'In cooperativa', valori: [7, 10], etichette: ['7 carte', '10 carte'], predefinito: 7 },
    ],
    regole: [
      'Sulla manopola c\'è uno spettro tra due concetti opposti, per esempio Freddo ↔ Caldo, e un bersaglio nascosto. Solo lo Psichico vede dov\'è il bersaglio.',
      'Lo Psichico sceglie uno dei due spettri che gli capitano e dà un indizio: un esempio che secondo lui sta in quel punto. Se il bersaglio è quasi tutto a destra su Freddo ↔ Caldo potrebbe dire «caffè appena fatto»; se è al centro, «primavera».',
      'Regole dell\'indizio: un solo concetto, niente numeri o percentuali («costa 250.000 euro» non vale, «una Ferrari» sì), non uno dei due estremi, e lo Psichico resta in silenzio: finché il bersaglio non si scopre i suoi messaggi in chat non li legge nessuno.',
      'La squadra discute in chat e gira la manopola (trascinala, o usa − e +). La manopola è una sola per tutta la squadra: la blocca il primo che preme «Blocca». Non conta quanto sia caldo un caffè in assoluto, ma quanto lo è per lo Psichico.',
      'Si scopre il bersaglio: centro pieno 4 punti, vicino 3, nella zona 2, fuori 0.',
      'A squadre (da 4 giocatori; le squadre si formano alternando i posti, 1º Viola, 2º Verdi…): dopo che la manopola è bloccata, gli avversari scommettono se il centro del bersaglio è a sinistra o a destra della manopola. Se indovinano prendono 1 punto, tranne quando la squadra ha fatto centro pieno.',
      'A squadre si gioca a turno e lo Psichico cambia a ogni turno della squadra. Vince chi arriva per primo a 10 punti (o 6 nella partita corta); se si arriva insieme a pari punti si continua finché qualcuno passa avanti. Rimonta: chi fa centro pieno ed è ancora indietro gioca subito un altro turno.',
      'Cooperativa (anche in 2 o 3): tutti nella stessa squadra, lo Psichico gira tra tutti e si giocano 7 o 10 carte. Ogni centro pieno regala una carta in più (al massimo 3). Alla fine il giudizio dipende dalla media dei punti: da «Fuori frequenza» a «Telepatia pura».',
      `Il computer sa fare lo Psichico e sa girare la manopola: conosce più di ${Math.floor(SPETTRI.reduce((n, x) => n + x.e.length, 0) / 50) * 50} esempi su ${SPETTRI.length} spettri. Se gli dai un indizio che non conosce tira a indovinare (meglio giocare con amici!). Il facile capisce e spiega in modo più approssimativo, il difficile è molto preciso. Se in squadra ci sono persone, i computer non toccano la manopola: lasciano un segno con il loro consiglio.`,
      'Con l\'opzione «Un solo dispositivo» si gioca tutti dallo stesso telefono o computer: chi apre il tavolo scrive i nomi degli amici nei posti liberi e, quando tocca a un altro, compare il sipario «Passa il telefono a…»: solo quando chi deve giocare tocca «Sono io» si vede il suo schermo (la parola, il bersaglio o la mappa).',
    ],
  },
  crea: (o) => new Wavelength(o),
  bot,
  _test: { puntiPer, controllaIndizio, psichicoComputer, stima, norm, SPETTRI, ZONE, VIOLA, VERDI },
};
