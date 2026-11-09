// BURRACO: due mazzi francesi più 4 jolly (108 carte); i jolly e i 2 (pinelle) sono matte.
// In 2 (uno contro uno) o in 4 a coppie (compagni di fronte: posti 0 e 2 contro 1 e 3, le combinazioni sono della coppia).
// 11 carte a testa e due pozzetti da 11. Al turno: pesca dal tallone OPPURE prendi tutti gli scarti, cala e attacca
// alle combinazioni della tua squadra, scarta una carta. Chi finisce le carte prende il pozzetto (al volo se finisce
// calando, al turno dopo se finisce scartando). Si chiude (100 punti) solo dopo aver preso il pozzetto e con almeno
// un burraco (combinazione di 7 o più carte), scartando l'ultima carta. Se il tallone finisce, la smazzata si chiude.
const { mazzoDoppio, mescola, casuale } = require('../giochi/carte');
const { SEMI, punti, eMatta, valuta, bonus } = require('./burraco-regole');
const T = require('../giochi/trucco');
const MV = require('../giochi/mano-vincente');

const CARTE_MANO = 11;
const OBIETTIVI = [2005, 1005, 1]; // 1 = una sola smazzata
const MAX_TURNI = 400; // rete di sicurezza: una smazzata che non finisce mai si chiude da sola
const MAX_SMAZZATE = 40;

const squadra = (p) => p % 2;

class Burraco {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'burraco';
    this.n = n === 4 ? 4 : 2;
    this.aSquadre = this.n === 4;
    this.obiettivo = OBIETTIVI.includes(Number(opzioni.obiettivo)) ? Number(opzioni.obiettivo) : 2005;
    this.totali = [0, 0];
    this.mazziere = (primo - 1 + this.n) % this.n;
    this.nSmazzata = 0;
    this.nEv = 0;
    this.nComb = 0;
    this.evento = null;
    this.finita = false;
    this.risultato = null;
    this.pausaMs = 15000;
    this.velocitaBot = 0.7; // un turno è fatto di tante piccole mosse
    this.storico = [];
    this.nuovaSmazzata();
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  prossimo(p) { return (p + 1) % this.n; }
  postiDi(t) { return Array.from({ length: this.n }, (_, i) => i).filter((i) => squadra(i) === t); }
  haBurraco(t, comb = this.combinazioni[t]) { return comb.some((m) => m.burraco); }

  // il trucco segreto (!win): si pesca un jolly, se nel tallone ce n'è ancora; se no la carta che rende di più alla
  // mano (quella che chiude una scala o una combinazione, o che si attacca a quelle in tavola)
  // il trucco segreto (!win !parola): la mano diventa scale e tris, con dentro un burraco pulito (scala di 7) se la
  // squadra non ne ha ancora uno. Al tuo turno cali tutto: senza pozzetto lo prendi al volo, con il pozzetto chiudi
  // scartando l'ultima carta. Le carte vengono dal tallone (la mano vecchia ci torna).
  manoVincente(p) {
    if (this.finita || this.inAttesa || !this.mani[p]) return null;
    const t = squadra(p), mano = this.mani[p];
    const inGioca = this.turno === p && this.fase === 'gioca';
    const n = inGioca ? mano.length - 1 : mano.length;
    const pool = [...this.tallone, ...mano];
    const puliti = pool.filter((c) => !eMatta(c));
    const v = (c) => valuta(c);
    let nuova = null;
    for (let prova = 0; prova < 30 && !nuova; prova++) {
      if (this.haBurraco(t)) {
        const gr = n >= 3 ? MV.costruisci(puliti, n, { valuta: v, conJolly: 0 }) : null;
        if (gr) nuova = gr.flat();
      } else if (n >= 7) {
        const L = n - 7 >= 3 ? 7 : n;
        const scala = MV.prendiScala(puliti, L, false, true);
        if (!scala || !valuta(scala)) continue;
        const resto = n - L ? MV.costruisci(puliti.filter((c) => !scala.includes(c)), n - L, { valuta: v, conJolly: 0 }) : [];
        if (resto) nuova = [...scala, ...resto.flat()];
      } else break;
    }
    if (n === 0) nuova = [];
    if (!nuova) return '🃏 Adesso non riesco a darti una mano vincente: riprova al prossimo turno';
    if (inGioca) {
      const scarto = puliti.filter((c) => !nuova.includes(c));
      if (!scarto.length) return null;
      nuova.push(casuale(scarto));
      this.tt.scarti = 0;
    }
    const usate = new Set(nuova.map((c) => c.id));
    this.mani[p] = mescola(nuova);
    this.tallone = mescola(pool.filter((c) => !usate.has(c.id)));
    return this.pozzettoPreso[t] ? '🃏 Mano cambiata: cala tutto e scarta l\'ultima carta per chiudere' : '🃏 Mano cambiata: cala tutto e prendi il pozzetto';
  }

  // il trucco segreto (!lose): la carta del tallone che rende di meno (mai jolly o pinelle)
  pescataInutile(p) {
    const mano = this.mani[p], comb = this.combinazioni[squadra(p)];
    const cand = this.tallone.filter((c) => !eMatta(c));
    const c = T.migliore(cand, (x) => -valoreMano(this, p, [...mano, x], comb) + Math.random());
    if (c) T.inCima(this.tallone, (x) => x === c);
  }

  truccaPescata(p) {
    if (T.inCima(this.tallone, (c) => c.jolly)) return;
    const mano = this.mani[p], comb = this.combinazioni[squadra(p)];
    const visti = new Set();
    let best = null, bv = valoreMano(this, p, mano, comb);
    for (const c of this.tallone) {
      const k = `${c.rango}${c.seme}`;
      if (visti.has(k)) continue;
      visti.add(k);
      const v = valoreMano(this, p, [...mano, c], comb);
      if (v > bv) { bv = v; best = c; }
    }
    if (best) T.inCima(this.tallone, (c) => c === best);
  }

  nuovaSmazzata() {
    this.mazziere = this.prossimo(this.mazziere);
    const mazzo = mescola(mazzoDoppio());
    this.mani = Array.from({ length: this.n }, () => []);
    for (let g = 0; g < CARTE_MANO; g++) for (let k = 1; k <= this.n; k++) this.mani[(this.mazziere + k) % this.n].push(mazzo.pop());
    this.pozzetti = [mazzo.splice(-CARTE_MANO), mazzo.splice(-CARTE_MANO)];
    this.scarti = [mazzo.pop()];
    this.tallone = mazzo;
    this.combinazioni = [[], []];
    this.pozzettoPreso = [false, false];
    this.chiPozzetto = [null, null];
    this.presiDagliScarti = Array.from({ length: this.n }, () => []); // per il computer difficile (lo vedono tutti)
    this.nTurni = 0;
    this.turno = this.prossimo(this.mazziere);
    this.fase = 'pesca';
    this.tt = { scarti: 0 };
    this.inAttesa = false;
    this.riepilogo = null;
  }

  // dopo una calata/attacco restano "rimaste" carte: è permesso?
  // - senza pozzetto si può restare a zero (si prende il pozzetto al volo)
  // - con il pozzetto bisogna tenere una carta da scartare, e restare con una sola carta solo se si può chiudere
  controllaResto(p, rimaste, burracoDopo) {
    const t = squadra(p);
    if (!this.pozzettoPreso[t]) return null;
    if (rimaste < 1) return 'Devi tenere almeno una carta da scartare per chiudere';
    if (rimaste === 1 && !burracoDopo) return 'Non puoi restare con una carta sola: per chiudere serve almeno un burraco';
    return null;
  }

  carteDallaMano(p, ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 30) return null;
    const s = ids.map(String);
    if (new Set(s).size !== s.length) return null;
    const carte = s.map((id) => this.mani[p].find((c) => c.id === id));
    return carte.some((c) => !c) ? null : carte;
  }

  togli(p, carte) {
    const via = new Set(carte.map((c) => c.id));
    this.mani[p] = this.mani[p].filter((c) => !via.has(c.id));
  }

  // mano vuota dopo aver calato: si prende il pozzetto al volo e si continua a giocare
  forsePozzettoAlVolo(p) {
    if (this.mani[p].length) return;
    const t = squadra(p);
    this.prendiPozzetto(p);
    this.annuncia(p, 'prende il pozzetto al volo!', 'prendi il pozzetto al volo!', true);
    void t;
  }

  prendiPozzetto(p) {
    const t = squadra(p);
    this.pozzettoPreso[t] = true;
    this.chiPozzetto[t] = p;
    this.mani[p] = this.pozzetti.pop();
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta un attimo' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a !== 'object' || typeof a.tipo !== 'string') return { errore: 'Mossa non valida' };
    const t = squadra(p);

    if (a.tipo === 'pesca') {
      if (this.fase !== 'pesca') return { errore: 'Hai già pescato' };
      if (a.da === 'scarti') {
        if (!this.scarti.length) return { errore: 'Non ci sono scarti da prendere' };
        const presi = this.scarti;
        this.scarti = [];
        this.mani[p].push(...presi);
        this.presiDagliScarti[p].push(...presi.filter((c) => !eMatta(c)));
        this.tt.scarti = presi.length;
        this.annuncia(p, `prende gli scarti (${presi.length} ${presi.length === 1 ? 'carta' : 'carte'})`, `prendi gli scarti (${presi.length} ${presi.length === 1 ? 'carta' : 'carte'})`);
      } else {
        if (!this.tallone.length) return { errore: 'Il tallone è finito' };
        if (T.consuma(this, p)) this.truccaPescata(p);
        else if (T.sfortuna(this, p)) this.pescataInutile(p);
        this.mani[p].push(this.tallone.pop());
      }
      this.fase = 'gioca';
      return { ok: true };
    }

    if (this.fase !== 'gioca') return { errore: 'Prima devi pescare o prendere gli scarti' };

    if (a.tipo === 'cala') {
      const carte = this.carteDallaMano(p, a.carte);
      if (!carte) return { errore: 'Seleziona le carte da calare' };
      const v = valuta(carte);
      if (!v) return { errore: 'Queste carte non formano una scala o una combinazione valida' };
      const err = this.controllaResto(p, this.mani[p].length - carte.length, this.haBurraco(t) || !!v.burraco);
      if (err) return { errore: err };
      this.togli(p, carte);
      this.combinazioni[t].push({ id: `b${++this.nComb}`, squadra: t, ...v });
      if (v.burraco) this.annuncia(p, `fa un burraco ${v.burraco}!`, `fai un burraco ${v.burraco}!`, true);
      this.forsePozzettoAlVolo(p);
      return { ok: true };
    }

    if (a.tipo === 'attacca') {
      const m = this.combinazioni[t].find((x) => x.id === a.combinazione);
      if (!m) return { errore: 'Puoi attaccare solo alle combinazioni della tua squadra' };
      const carte = this.carteDallaMano(p, a.carte);
      if (!carte) return { errore: 'Seleziona le carte da attaccare' };
      const v = valuta([...m.carte, ...carte], m.tipo);
      if (!v) return { errore: 'Queste carte non si attaccano qui' };
      const err = this.controllaResto(p, this.mani[p].length - carte.length, this.haBurraco(t) || !!v.burraco);
      if (err) return { errore: err };
      const primaBurraco = m.burraco;
      this.togli(p, carte);
      Object.assign(m, v);
      if (v.burraco && v.burraco !== primaBurraco) this.annuncia(p, `fa un burraco ${v.burraco}!`, `fai un burraco ${v.burraco}!`, true);
      this.forsePozzettoAlVolo(p);
      return { ok: true };
    }

    if (a.tipo === 'scarta') {
      const c = this.mani[p].find((x) => x.id === String(a.carta));
      if (!c) return { errore: 'Scegli la carta da scartare' };
      const ultima = this.mani[p].length === 1;
      if (ultima && this.pozzettoPreso[t] && !this.haBurraco(t)) return { errore: 'Per chiudere serve almeno un burraco' };
      this.togli(p, [c]);
      this.scarti.push(c);
      if (ultima) {
        if (this.pozzettoPreso[t]) return this.fineSmazzata(p);
        this.prendiPozzetto(p);
        this.annuncia(p, 'scarta l\'ultima carta e prende il pozzetto', 'scarti l\'ultima carta e prendi il pozzetto', true);
      }
      return this.fineTurno();
    }
    return { errore: 'Mossa non valida' };
  }

  fineTurno() {
    this.nTurni++;
    if (!this.tallone.length || this.nTurni >= MAX_TURNI) {
      this.annuncia(null, 'Il tallone è finito: la smazzata si chiude', '', true);
      return this.fineSmazzata(null);
    }
    this.turno = this.prossimo(this.turno);
    this.fase = 'pesca';
    this.tt = { scarti: 0 };
    return { ok: true };
  }

  // conti di fine smazzata: chi = posto che ha chiuso (null se è finito il tallone)
  fineSmazzata(chi) {
    if (chi != null) this.annuncia(chi, 'chiude!', 'chiudi!', true);
    const righe = [0, 1].map((t) => {
      const comb = this.combinazioni[t];
      const tavolo = comb.reduce((s, m) => s + m.punti, 0);
      const puliti = comb.filter((m) => m.burraco === 'pulito').length;
      const sporchi = comb.filter((m) => m.burraco === 'sporco').length;
      const bur = comb.reduce((s, m) => s + bonus(m), 0);
      const chiusura = chi != null && squadra(chi) === t ? 100 : 0;
      const mano = -this.postiDi(t).reduce((s, q) => s + this.mani[q].reduce((x, c) => x + punti(c), 0), 0);
      const pozzetto = this.pozzettoPreso[t] ? 0 : -100;
      const totale = tavolo + bur + chiusura + mano + pozzetto;
      this.totali[t] += totale;
      return { squadra: t, posti: this.postiDi(t), tavolo, puliti, sporchi, burraco: bur, chiusura, mano, pozzetto, smazzata: totale, totale: this.totali[t] };
    });
    this.nSmazzata++;
    this.storico.push(righe.map((r) => r.smazzata));
    this.riepilogo = { chi, smazzata: this.nSmazzata, righe, tallone: chi == null, mani: this.mani.map((m) => m.slice()) };
    this.turno = null;
    this.fase = 'riepilogo';
    const [a, b] = this.totali;
    const fine = this.obiettivo === 1 || this.nSmazzata >= MAX_SMAZZATE || ((a >= this.obiettivo || b >= this.obiettivo) && a !== b);
    if (fine) {
      this.finita = true;
      const vince = a === b ? null : a > b ? 0 : 1;
      this.risultato = {
        fazioni: [0, 1].map((t) => ({ posti: this.postiDi(t), punti: this.totali[t] })),
        etichetta: 'punti',
        pareggio: vince === null,
        vincitori: vince === null ? [] : this.postiDi(vince),
      };
    } else this.inAttesa = true;
    return { ok: true };
  }

  avanza() { if (this.fase === 'riepilogo' && !this.finita) this.nuovaSmazzata(); }

  // se il computer si blocca: pesca, poi scarta la carta meno utile
  sblocca(p) {
    if (this.turno !== p || this.inAttesa) return;
    if (this.fase === 'pesca') { const r = this.azione(p, { tipo: 'pesca', da: this.tallone.length ? 'tallone' : 'scarti' }); if (r.errore) return; }
    const mano = [...this.mani[p]].sort((x, y) => eMatta(x) - eMatta(y));
    for (const c of mano) if (!this.azione(p, { tipo: 'scarta', carta: c.id }).errore) return;
  }

  vista(p) {
    const io = p != null && p >= 0 && p < this.n;
    const t = io ? squadra(p) : 0;
    const mio = io && this.turno === p && !this.inAttesa;
    return {
      gioco: this.id,
      n: this.n,
      aSquadre: this.aSquadre,
      squadra: t,
      mano: io ? this.mani[p] : [],
      carteInMano: this.mani.map((m) => m.length),
      tallone: this.tallone.length,
      scarti: this.scarti,
      combinazioni: this.combinazioni,
      pozzetti: this.pozzetti.length,
      pozzettoPreso: this.pozzettoPreso,
      chiPozzetto: this.chiPozzetto,
      totali: this.totali,
      obiettivo: this.obiettivo,
      storico: this.storico,
      nSmazzata: this.nSmazzata,
      fase: this.fase,
      turno: this.turno,
      mazziere: this.mazziere,
      mioTurno: mio ? {
        fase: this.fase,
        presiScarti: this.tt.scarti,
        burraco: this.haBurraco(t),
        pozzetto: this.pozzettoPreso[t],
      } : null,
      riepilogo: this.riepilogo,
      inAttesa: this.inAttesa,
      pausaMs: this.pausaMs,
      finita: this.finita,
      risultato: this.risultato,
      evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
const posScala = (c) => c.rango; // l'asso alto si gestisce a parte

// combinazioni nuove che si possono calare con la mano (conMatte: anche con una matta)
function candidati(mano, conMatte) {
  const out = [];
  const nat = mano.filter((c) => !eMatta(c));
  const matte = mano.filter(eMatta).sort((a, b) => (a.jolly ? 1 : 0) - (b.jolly ? 1 : 0)); // prima le pinelle
  const aggiungi = (carte) => { const v = valuta(carte); if (v) out.push({ carte, v }); };
  const perRango = {};
  for (const c of nat) (perRango[c.rango] = perRango[c.rango] || []).push(c);
  for (const L of Object.values(perRango)) {
    if (L.length >= 3) aggiungi(L.slice());
    else if (L.length === 2 && conMatte && matte.length) aggiungi([...L, matte[0]]);
  }
  for (const s of SEMI) {
    const perPos = {};
    const assi = [];
    for (const c of mano) {
      if (c.jolly || c.seme !== s) continue;
      if (c.rango === 1) assi.push(c);
      else if (!perPos[posScala(c)]) perPos[posScala(c)] = c;
    }
    if (assi[0]) perPos[1] = assi[0];
    if (assi.length) perPos[14] = assi[1] || assi[0];
    // tratti di carte consecutive
    const tratti = [];
    for (let x = 1; x <= 14; x++) {
      if (!perPos[x]) continue;
      if (tratti.length && tratti[tratti.length - 1].b === x - 1) tratti[tratti.length - 1].b = x;
      else tratti.push({ a: x, b: x });
    }
    const carteDi = (a, b) => { const r = []; for (let x = a; x <= b; x++) r.push(perPos[x]); return new Set(r.map((c) => c.id)).size === r.length ? r : null; };
    for (const tr of tratti) {
      if (tr.b - tr.a + 1 >= 3) { const r = carteDi(tr.a, tr.b); if (r) aggiungi(r); }
    }
    if (!conMatte) continue;
    const mattaFuori = (r) => matte.find((m) => !r.some((c) => c.id === m.id));
    for (let i = 0; i < tratti.length; i++) {
      const tr = tratti[i];
      const lung = tr.b - tr.a + 1;
      const dopo = tratti[i + 1];
      if (dopo && dopo.a === tr.b + 2 && lung + (dopo.b - dopo.a + 1) >= 2) {
        const r = [...(carteDi(tr.a, tr.b) || []), ...(carteDi(dopo.a, dopo.b) || [])];
        const m = mattaFuori(r);
        if (m && r.length >= 2) aggiungi([...r, m]);
      } else if (lung === 2) {
        const r = carteDi(tr.a, tr.b);
        const m = r && mattaFuori(r);
        if (m) aggiungi([...r, m]);
      }
    }
  }
  return out;
}

// attacchi possibili di una carta alle combinazioni della squadra
function attacchi(mano, comb, conMatte) {
  const out = [];
  for (const c of mano) {
    if (eMatta(c) && !conMatte) continue;
    for (const m of comb) {
      const v = valuta([...m.carte, c], m.tipo);
      if (v) out.push({ carta: c, m, v });
    }
  }
  return out;
}

// Simula di calare tutto il possibile (anche con le matte): quante carte restano e se ci sarebbe un burraco
function simulaTutto(mano, comb, conMatte = true) {
  let h = mano.slice();
  const cs = comb.map((m) => ({ ...m, carte: m.carte.slice() }));
  for (let giro = 0; giro < 40; giro++) {
    const at = attacchi(h, cs, false)[0] || null;
    if (at) { at.m.carte = at.v.carte; at.m.burraco = at.v.burraco; at.m.matta = at.v.matta; h = h.filter((c) => c !== at.carta); continue; }
    const nuove = candidati(h, false);
    if (nuove.length) { const x = nuove.sort((a, b) => b.carte.length - a.carte.length)[0]; cs.push({ ...x.v, carte: x.v.carte }); h = h.filter((c) => !x.carte.includes(c)); continue; }
    if (!conMatte) break;
    const conM = candidati(h, true);
    if (conM.length) { const x = conM[0]; cs.push({ ...x.v, carte: x.v.carte }); h = h.filter((c) => !x.carte.includes(c)); continue; }
    const atM = attacchi(h, cs, true)[0] || null;
    if (atM) { atM.m.carte = atM.v.carte; atM.m.burraco = atM.v.burraco; atM.m.matta = atM.v.matta; h = h.filter((c) => c !== atM.carta); continue; }
    break;
  }
  const puntiPiazzati = mano.filter((c) => !h.includes(c)).reduce((x, c) => x + punti(c), 0);
  return { resto: h.length, burraco: cs.some((m) => m.burraco), piazzate: mano.length - h.length, puntiPiazzati, rimaste: h, comb: cs };
}

// quante carte della mano finirebbero in tavola (per decidere se prendere gli scarti)
function utili(mano, comb) { return simulaTutto(mano, comb).piazzate; }

// carte che gli avversari possono attaccare alle loro combinazioni
function servonoAgliAltri(g, p, c) {
  const avv = g.combinazioni[1 - squadra(p)];
  return avv.some((m) => valuta([...m.carte, c], m.tipo));
}

// quanto è utile tenere una carta (più è alto, meno conviene scartarla)
function utilita(g, p, c, livello) {
  const mano = g.mani[p];
  if (eMatta(c)) return 100;
  let u = 0;
  for (const o of mano) {
    if (o === c || eMatta(o)) continue;
    if (o.rango === c.rango) u += 3;
    if (o.seme === c.seme) {
      const pc = c.rango === 1 ? [1, 14] : [c.rango];
      const po = o.rango === 1 ? [1, 14] : [o.rango];
      let d = 99;
      for (const x of pc) for (const y of po) d = Math.min(d, Math.abs(x - y));
      if (d === 1) u += 3; else if (d === 2) u += 1.5; else if (d === 0) u -= 0.5;
    }
  }
  if (attacchi([c], g.combinazioni[squadra(p)], false).length) u += 6;
  if (livello !== 'facile') {
    if (servonoAgliAltri(g, p, c)) {
      u += 9;
      const avv = g.combinazioni[1 - squadra(p)];
      if (avv.some((m) => m.carte.length === 6 && valuta([...m.carte, c], m.tipo))) u += 25; // gli faremmo fare burraco
    }
  }
  if (livello === 'difficile') {
    // ricorda le carte che gli avversari hanno preso dagli scarti: non dargli lo stesso valore o vicini di seme
    for (const q of g.postiDi(1 - squadra(p))) {
      for (const x of g.presiDagliScarti[q]) {
        if (x.rango === c.rango) u += 2.5;
        else if (x.seme === c.seme && Math.abs(x.rango - c.rango) <= 2) u += 1.5;
      }
    }
    // a fine smazzata le carte pesanti in mano costano: meglio liberarsene
    if (g.tallone.length < 12) u -= punti(c) * 0.12;
  }
  u -= punti(c) * 0.04;
  return u;
}

function sceltaScarto(g, p, livello) {
  const mano = g.mani[p];
  const nat = mano.filter((c) => !eMatta(c));
  if (!nat.length) return mano.sort((a, b) => punti(a) - punti(b))[0];
  const conU = nat.map((c) => ({ c, u: utilita(g, p, c, livello) })).sort((a, b) => a.u - b.u);
  if (livello === 'facile') {
    // a caso tra le carte inutili (senza coppie né vicine)
    const inutili = conU.filter((x) => x.u < 1.5);
    return casuale(inutili.length ? inutili : conU.slice(0, 3)).c;
  }
  if (livello === 'medio' && Math.random() < 0.15 && conU.length > 2) return conU[1].c;
  if (livello === 'difficile') {
    // il difficile scarta la carta che fa perdere meno valore alla mano, pesando il pericolo di darla agli
    // avversari (di più se la pila degli scarti è grossa: chi la prende prende tutto)
    const comb = g.combinazioni[squadra(p)];
    let best = null, bv = -Infinity;
    for (const c of nat) {
      let v = valoreMano(g, p, mano.filter((x) => x !== c), comb);
      v -= (utilita(g, p, c, livello) - (attacchi([c], comb, false).length ? 6 : 0)) * 8 * (1 + g.scarti.length * 0.1);
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }
  return conU[0].c;
}

// valore di una mano: punti che si possono calare (senza matte), burraco vicini, coppie e quasi-scale,
// meno il rischio di restare con carte pesanti in mano
function valoreMano(g, p, mano, comb) {
  const s = simulaTutto(mano, comb, false);
  let v = s.puntiPiazzati;
  for (const m of s.comb) { const L = m.carte.length; if (L >= 7) v += m.matta ? 100 : 200; else if (L >= 5) v += (L - 4) * 25; }
  const resto = s.rimaste;
  let pot = 0;
  for (let i = 0; i < resto.length; i++) {
    const c = resto[i];
    if (eMatta(c)) { pot += 25; continue; }
    for (let j = i + 1; j < resto.length; j++) {
      const o = resto[j];
      if (eMatta(o)) continue;
      if (o.rango === c.rango) pot += 6;
      else if (o.seme === c.seme && Math.abs(o.rango - c.rango) <= 2) pot += 4;
    }
  }
  const t = squadra(p), avv = 1 - t;
  let rischio = 0.25;
  if (g.tallone.length < 15) rischio += 0.25;
  if (g.pozzettoPreso[avv] && g.haBurraco(avv)) rischio += 0.4;
  const pesoResto = resto.filter((c) => !eMatta(c)).reduce((x, c) => x + punti(c), 0);
  return v + pot - pesoResto * rischio;
}
// il difficile prende gli scarti se il valore della mano cresce abbastanza
const valutaPila = (g, p, mano, comb, pila) => valoreMano(g, p, [...mano, ...pila], comb) - valoreMano(g, p, mano, comb) > 5;

function vuoleScarti(g, p, livello) {
  const pila = g.scarti;
  if (!pila.length) return false;
  if (!g.tallone.length) return true;
  const t = squadra(p);
  const comb = g.combinazioni[t];
  const mano = g.mani[p];
  const cima = pila[pila.length - 1];
  if (livello === 'facile') {
    const usaCima = attacchi([cima], comb, false).length || candidati([...mano, cima], false).some((x) => x.carte.includes(cima));
    return !!usaCima && pila.length <= 4 && Math.random() < 0.6;
  }
  if (livello === 'difficile') return valutaPila(g, p, mano, comb, pila);
  const prima = utili(mano, comb);
  const dopo = utili([...mano, ...pila], comb);
  const guadagno = dopo - prima;
  const inutiliPresi = pila.length - guadagno;
  const matteNellaPila = pila.filter(eMatta).length;
  // a fine tallone troppe carte in mano sono un rischio
  const soglia = g.tallone.length < 10 ? 3 : 2;
  return guadagno + matteNellaPila * 1.5 - inutiliPresi * 0.35 >= soglia;
}

function bot(g, p, livello = 'medio') {
  const t = squadra(p);
  if (g.fase === 'pesca') {
    if (!g.tallone.length) return { tipo: 'pesca', da: 'scarti' };
    return { tipo: 'pesca', da: vuoleScarti(g, p, livello) ? 'scarti' : 'tallone' };
  }
  const mano = g.mani[p];
  const comb = g.combinazioni[t];
  const burraco = g.haBurraco(t);
  const ok = (rimaste, burDopo) => !g.controllaResto(p, rimaste, burraco || burDopo);

  // si può uscire (pozzetto al volo o chiusura) in questo turno?
  const sim = simulaTutto(mano, comb);
  let tuttoDentro;
  if (!g.pozzettoPreso[t]) tuttoDentro = sim.resto <= 1 && livello !== 'facile';
  else tuttoDentro = (burraco || sim.burraco) && sim.resto <= 1;
  const conMatte = livello === 'facile' || tuttoDentro;

  // 1) attaccare carte naturali alle combinazioni della squadra (prima quelle che fanno burraco)
  const at = attacchi(mano, comb, false).filter((x) => ok(mano.length - 1, !!x.v.burraco))
    .sort((a, b) => (!!b.v.burraco - !!a.v.burraco) || (b.m.carte.length - a.m.carte.length));
  if (at.length) return { tipo: 'attacca', combinazione: at[0].m.id, carte: [at[0].carta.id] };

  // 2) calare combinazioni nuove senza matte (le più lunghe prima)
  const nuove = candidati(mano, false).filter((x) => ok(mano.length - x.carte.length, !!x.v.burraco))
    .sort((a, b) => b.carte.length - a.carte.length || b.v.punti - a.v.punti);
  if (nuove.length) return { tipo: 'cala', carte: nuove[0].carte.map((c) => c.id) };

  // 3) matte: per fare burraco (combinazione di 6 senza matta), o calando tutto per uscire
  const matte = mano.filter(eMatta);
  if (matte.length) {
    if (livello !== 'facile') {
      const perBurraco = attacchi(matte, comb, true).filter((x) => x.v.burraco && ok(mano.length - 1, !!x.v.burraco));
      if (perBurraco.length) return { tipo: 'attacca', combinazione: perBurraco[0].m.id, carte: [perBurraco[0].carta.id] };
    }
    if (conMatte || (livello === 'medio' && !comb.length && mano.length >= 12)) {
      const conM = candidati(mano, true).filter((x) => x.v.matta && ok(mano.length - x.carte.length, !!x.v.burraco));
      if (conM.length) return { tipo: 'cala', carte: conM[0].carte.map((c) => c.id) };
      const atM = attacchi(matte, comb, true).filter((x) => ok(mano.length - 1, !!x.v.burraco))
        .sort((a, b) => b.m.carte.length - a.m.carte.length);
      if (atM.length && (livello !== 'facile' || Math.random() < 0.5)) return { tipo: 'attacca', combinazione: atM[0].m.id, carte: [atM[0].carta.id] };
    }
  }

  // 4) scartare (l'ultima carta solo se è permesso)
  if (mano.length === 1) return { tipo: 'scarta', carta: mano[0].id };
  return { tipo: 'scarta', carta: sceltaScarto(g, p, livello).id };
}

module.exports = {
  meta: {
    id: 'burraco',
    nome: 'Burraco',
    tipo: 'carte',
    giocatori: [2, 4],
    descrizione: 'Due mazzi, jolly e pinelle: cala scale e combinazioni, fai burraco, prendi il pozzetto e chiudi. In 2 o in 4 a coppie.',
    alias: ['burraco', 'buraco', 'pinelle', 'pozzetto', 'carte a coppie'],
    opzioni: [
      { id: 'obiettivo', nome: 'Si vince a', valori: OBIETTIVI, etichette: ['2005 punti', '1005 punti (partita corta)', 'Una sola smazzata'], predefinito: 2005 },
    ],
    regole: [
      'Si gioca con due mazzi francesi da 52 carte più 4 jolly (108 carte). In 2 si gioca uno contro uno; in 4 a coppie, con il compagno di fronte: le combinazioni sono della coppia e ognuno può attaccare a quelle del compagno.',
      'Ognuno riceve 11 carte. Si mettono da parte due POZZETTI coperti da 11 carte ciascuno; una carta scoperta inizia gli scarti e il resto è il tallone. Gioca per primo chi sta dopo il mazziere, che cambia a ogni smazzata.',
      'Le MATTE sono i jolly e i 2 (le pinelle): sostituiscono qualsiasi carta, ma in ogni scala o combinazione ce ne può essere al massimo una. Un 2 del seme giusto messo al suo posto in una scala (A-2-3, 2-3-4) è una carta normale, non una matta.',
      'Al tuo turno: pesca la prima carta del tallone OPPURE prendi tutti gli scarti (tutta la pila). Poi puoi calare e attaccare quanto vuoi, e finisci scartando una carta.',
      'SCALA: almeno 3 carte dello stesso seme in fila; l\'asso può stare sotto il 2 (A-2-3) o sopra il re (Q-K-A). COMBINAZIONE (tris): almeno 3 carte dello stesso valore, di semi qualsiasi (non di soli 2). Si attacca solo alle combinazioni della propria squadra; quando metti la carta vera al posto della matta in una scala, la matta si sposta in fondo.',
      'BURRACO: una scala o combinazione di 7 o più carte. Pulito (senza matte) vale 200 punti, sporco (con una matta) 100.',
      'POZZETTO: chi finisce le carte prende il pozzetto della sua squadra. Se le finisce calando o attaccando lo prende al volo e continua a giocare; se le finisce scartando lo prende e lo gioca dal turno dopo. Ogni squadra prende un solo pozzetto.',
      'CHIUSURA: dopo aver preso il pozzetto, si chiude scartando l\'ultima carta, ma solo se la squadra ha almeno un burraco. Per questo con il pozzetto preso devi sempre tenere una carta da scartare, e non puoi restare con una carta sola se la squadra non ha un burraco. Chiudere vale 100 punti e ferma la smazzata.',
      'Se il tallone finisce, la smazzata si chiude dopo lo scarto di chi ha pescato l\'ultima carta (nessuno prende i 100 punti della chiusura).',
      'Punti delle carte: jolly 30, pinella (2) 20, asso 15, dall\'8 al re 10, dal 3 al 7 5. A fine smazzata ogni squadra somma le carte calate e i burraco, più la chiusura; si tolgono le carte rimaste in mano e 100 punti se non ha preso il pozzetto.',
      'Vince la squadra che per prima arriva a 2005 punti (oppure 1005, o chi ha più punti dopo una sola smazzata). Se le squadre sono pari si gioca un\'altra smazzata. Il riepilogo di ogni smazzata resta finché qualcuno preme "Continua".',
      'Come si gioca qui: tocca le carte della mano per selezionarle (puoi ordinarle per seme o per valore). Con 3 o più carte che formano una scala o una combinazione appare "Cala"; per attaccare tocca una combinazione della tua squadra (si illuminano quelle dove le carte selezionate si possono attaccare); con una carta sola selezionata puoi scartarla.',
      'Il computer facile cala appena può (anche con le matte) e scarta a caso tra le carte che non gli servono. Il medio valuta se prendere gli scarti, tiene le matte per fare burraco e non scarta le carte che servono agli avversari. Il difficile in più ricorda le carte che gli avversari hanno preso dagli scarti, punta a prendere il pozzetto al volo e a chiudere appena può, e a fine tallone si libera delle carte pesanti.',
    ],
  },
  crea: (o) => new Burraco(o),
  bot,
  _test: { Burraco, candidati, attacchi, simulaTutto, valuta, punti },
};
