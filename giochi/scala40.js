const { mazzoDoppio, mescola, casuale } = require('./carte');
const { valuta, penalita, sostituisceJolly } = require('./scala-regole');
const T = require('./trucco');
const MV = require('./mano-vincente');

const APERTURA = 40;

class Scala40 {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'scala40';
    this.n = n;
    this.aSquadre = false;
    this.limite = Number(opzioni.limite) || 101;
    this.penalita = new Array(n).fill(0);
    this.eliminati = new Array(n).fill(false);
    this.mazziere = (primo - 1 + n) % n;
    this.nSmazzata = 0;
    this.nEv = 0;
    this.evento = null;
    this.finita = false;
    this.risultato = null;
    this.pausaMs = 14000;
    this.nMeld = 0;
    this.nuovaSmazzata();
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  prossimo(p) { let q = p; do q = (q + 1) % this.n; while (this.eliminati[q] && q !== p); return q; }

  nuovaSmazzata() {
    this.mazziere = this.prossimo(this.mazziere);
    this.mazzo = mescola(mazzoDoppio());
    this.mani = Array.from({ length: this.n }, () => []);
    const primo = this.prossimo(this.mazziere);
    for (let g = 0; g < 13; g++) {
      let q = primo;
      for (let k = 0; k < this.n; k++) { if (!this.eliminati[q]) this.mani[q].push(this.mazzo.pop()); q = (q + 1) % this.n; }
    }
    this.pozzo = [this.mazzo.pop()];
    this.combinazioni = [];
    this.aperto = new Array(this.n).fill(false);
    this.turno = primo;
    this.fase = 'pesca';
    this.nuovoTurno();
    this.inAttesa = false;
    this.riepilogo = null;
    this.rimescolate = 0;
  }

  nuovoTurno() {
    this.fase = 'pesca';
    this.tt = { presoDalPozzo: null, daUsare: [], apertoOra: false, azioni: 0, jollyDa: null };
  }

  // il trucco segreto (!win): in cima al mazzo va una carta che serve davvero alla mano, scelta guardando
  // le carte rimaste nel mazzo. Prima quella che chiude o allunga una scala o un tris (o che si attacca ai
  // giochi in tavola, se hai già aperto), poi quella che avvicina una combinazione (coppia, carta vicina
  // dello stesso seme). Il jolly esce solo se nessuna carta vera aiuta. Tra le carte ugualmente buone si
  // sceglie a caso, così non esce sempre la stessa.
  truccaPescata(p) {
    const mano = this.mani[p];
    const aperto = this.aperto[p];
    const punteggio = (b) => (aperto ? b.carte * 100 + b.punti : b.punti * 100 + b.carte);
    const base = migliore(candidati(mano), mano.length);
    const inGioco = new Set(base.gruppi.flat().map((c) => c.id));
    const sciolte = mano.filter((c) => !c.jolly && !inGioco.has(c.id));
    const visti = new Set();
    let primi = [], bestGain = 0, secondi = [], bestVicine = 0;
    for (const c of this.mazzo) {
      if (c.jolly) continue;
      const k = `${c.rango}${c.seme}`;
      if (visti.has(k)) continue;
      visti.add(k);
      let gain = punteggio(migliore(candidati([...mano, c]), mano.length + 1)) - punteggio(base);
      if (aperto && this.combinazioni.some((m) => attaccabile(m, c))) gain = Math.max(gain, 100);
      if (gain > bestGain) { bestGain = gain; primi = [c]; } else if (gain > 0 && gain === bestGain) primi.push(c);
      if (bestGain > 0) continue;
      // nessuna combinazione nuova: conta le carte sciolte che questa carta avvicinerebbe a un gioco
      const pos = (x) => x.rango;
      const vicine = sciolte.filter((x) => (x.rango === c.rango && x.seme !== c.seme)
        || (x.seme === c.seme && x.rango !== c.rango && (Math.abs(pos(x) - pos(c)) <= 2
          || (c.rango === 1 && x.rango >= 12) || (x.rango === 1 && c.rango >= 12)))).length;
      if (vicine > bestVicine) { bestVicine = vicine; secondi = [c]; } else if (vicine > 0 && vicine === bestVicine) secondi.push(c);
    }
    const scelte = primi.length ? primi : secondi;
    if (scelte.length) {
      const scelta = scelte[Math.floor(Math.random() * scelte.length)];
      T.inCima(this.mazzo, (c) => c === scelta);
      return;
    }
    T.inCima(this.mazzo, (c) => c.jolly);
  }

  // il trucco segreto (!lose): in cima al mazzo una carta che non serve a niente (né combinazioni né carte vicine),
  // meglio se pesa tanto (figure, assi); mai un jolly
  pescataInutile(p) {
    const mano = this.mani[p];
    const base = migliore(candidati(mano), mano.length);
    const inutili = this.mazzo.filter((c) => {
      if (c.jolly) return false;
      if (this.aperto[p] && this.combinazioni.some((m) => attaccabile(m, c))) return false;
      if (mano.some((x) => !x.jolly && ((x.rango === c.rango && x.seme !== c.seme) || (x.seme === c.seme && Math.abs(x.rango - c.rango) <= 2)))) return false;
      return true;
    });
    const lista = inutili.length ? inutili : this.mazzo.filter((c) => !c.jolly && migliore(candidati([...mano, c]), mano.length + 1).punti <= base.punti);
    if (!lista.length) return;
    const max = Math.max(...lista.map(penalita));
    const pesanti = lista.filter((c) => penalita(c) >= max - 1);
    const scelta = pesanti[Math.floor(Math.random() * pesanti.length)];
    T.inCima(this.mazzo, (c) => c === scelta);
  }

  // il trucco segreto (!win !parola): la mano diventa scale e tris che valgono almeno 40 punti. Se tocca a te
  // e hai già pescato, avanza una carta da scartare; altrimenti tutte le carte sono in gioco e scarti quella che
  // peschi. Poi sei tu a calare e chiudere quando vuoi. Le carte vengono dal mazzo (la mano vecchia ci torna).
  manoVincente(p) {
    if (this.finita || this.inAttesa || this.eliminati[p] || !this.mani[p]) return null;
    const mano = this.mani[p];
    const inGioca = this.turno === p && this.fase === 'gioca';
    const n = inGioca ? mano.length - 1 : mano.length;
    const pool = [...this.mazzo, ...mano];
    let nuova = null;
    if (n === 0) nuova = [];
    else if (n >= 3) {
      const gruppi = MV.costruisci(pool, n, { valuta, minPunti: APERTURA, conJolly: 0.25 });
      if (gruppi) nuova = gruppi.flat();
    } else if (this.aperto[p]) {
      // poche carte: quelle che si attaccano ai giochi in tavola (nel turno in cui apri, solo ai tuoi)
      const tavola = this.combinazioni.filter((m) => !(inGioca && this.tt.apertoOra && m.posto !== p));
      const buone = pool.filter((c) => !c.jolly && tavola.some((m) => attaccabile(m, c)));
      const viste = new Set();
      nuova = [];
      for (const c of mescola(buone)) {
        if (nuova.length >= n) break;
        const k = `${c.rango}${c.seme}`;
        if (viste.has(k)) continue;
        viste.add(k); nuova.push(c);
      }
      if (nuova.length < n) nuova = null;
    }
    if (!nuova) return '🃏 Adesso non riesco a darti una mano vincente: riprova al prossimo turno';
    if (inGioca) {
      const usate = new Set(nuova.map((c) => c.id));
      const scarto = pool.filter((c) => !c.jolly && !usate.has(c.id));
      if (!scarto.length) return '🃏 Adesso non riesco a darti una mano vincente: riprova al prossimo turno';
      nuova.push(scarto[Math.floor(Math.random() * scarto.length)]);
      this.tt.presoDalPozzo = null;
      this.tt.daUsare = [];
    }
    const usate = new Set(nuova.map((c) => c.id));
    this.mani[p] = mescola(nuova);
    this.mazzo = mescola(pool.filter((c) => !usate.has(c.id)));
    return inGioca
      ? '🃏 Mano cambiata: cala tutto e scarta l\'ultima carta per chiudere'
      : '🃏 Mano cambiata: al tuo turno pesca, cala tutto e scarta per chiudere';
  }

  puoRestituire() {
    const tt = this.tt;
    if (!tt.presoDalPozzo || this.fase !== 'gioca') return false;
    const mano = this.mani[this.turno];
    if (!mano.some((c) => c.id === tt.presoDalPozzo)) return false;
    return tt.azioni === 0 || mano.length >= 2; // dopo aver calato serve ancora una carta da scartare
  }

  togliDallaMano(p, ids) {
    const mano = this.mani[p];
    if (new Set(ids).size !== ids.length) return null;
    const carte = ids.map((id) => mano.find((c) => c.id === id));
    if (carte.some((c) => !c)) return null;
    return carte;
  }

  usa(p, ids) {
    this.mani[p] = this.mani[p].filter((c) => !ids.includes(c.id));
    this.tt.daUsare = this.tt.daUsare.filter((id) => !ids.includes(id));
    this.tt.azioni++;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Aspetta un attimo' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || typeof a.tipo !== 'string') return { errore: 'Mossa non valida' };
    const mano = this.mani[p];
    const tt = this.tt;

    if (a.tipo === 'pesca') {
      if (this.fase !== 'pesca') return { errore: 'Hai già pescato' };
      if (a.da === 'pozzo') {
        if (!this.pozzo.length) return { errore: 'Non ci sono scarti' };
        const c = this.pozzo.pop();
        mano.push(c);
        tt.presoDalPozzo = c.id;
        tt.daUsare.push(c.id);
      } else {
        if (!this.mazzo.length) this.rimescola();
        // se il mazzo è stato rigirato troppe volte senza che nessuno chiuda, la smazzata si annulla
        if (!this.mazzo.length || this.rimescolate > 3) return this.annulla();
        if (T.consuma(this, p)) this.truccaPescata(p);
        else if (T.sfortuna(this, p)) this.pescataInutile(p);
        mano.push(this.mazzo.pop());
      }
      this.fase = 'gioca';
      return { ok: true };
    }

    if (this.fase !== 'gioca') return { errore: 'Prima devi pescare' };

    // la carta presa dagli scarti per sbaglio si può sempre rimettere, così non si resta mai bloccati:
    // se non hai ancora fatto nulla torni a pescare; se hai già calato o attaccato, perdi la pescata e scarti
    if (a.tipo === 'restituisci') {
      if (!this.puoRestituire()) return { errore: 'Non puoi rimettere la carta negli scarti' };
      const i = mano.findIndex((c) => c.id === tt.presoDalPozzo);
      this.pozzo.push(...mano.splice(i, 1));
      if (tt.azioni === 0) { this.nuovoTurno(); return { ok: true }; }
      tt.daUsare = tt.daUsare.filter((id) => id !== tt.presoDalPozzo);
      tt.presoDalPozzo = null;
      return { ok: true };
    }

    if (a.tipo === 'cala') {
      const gruppi = Array.isArray(a.combinazioni) ? a.combinazioni : [];
      if (!gruppi.length) return { errore: 'Seleziona almeno una combinazione' };
      const tutti = gruppi.flat().map(String);
      const carte = this.togliDallaMano(p, tutti);
      if (!carte) return { errore: 'Carte non valide' };
      const valutate = [];
      for (const gr of gruppi) {
        const v = valuta(gr.map((id) => mano.find((c) => c.id === String(id))));
        if (!v) return { errore: 'Una delle combinazioni non è valida' };
        valutate.push(v);
      }
      if (mano.length - tutti.length < 1) return { errore: 'Devi tenere almeno una carta da scartare' };
      const totale = valutate.reduce((s, v) => s + v.punti, 0);
      if (!this.aperto[p] && totale < APERTURA) return { errore: `Per aprire servono almeno ${APERTURA} punti: ne hai ${totale}` };
      for (const v of valutate) this.combinazioni.push({ id: `m${++this.nMeld}`, posto: p, ...v });
      this.usa(p, tutti);
      if (!this.aperto[p]) {
        this.aperto[p] = true;
        tt.apertoOra = true;
        this.annuncia(p, `apre con ${totale} punti`, `apri con ${totale} punti`);
      }
      return { ok: true };
    }

    if (a.tipo === 'attacca' || a.tipo === 'jolly') {
      if (!this.aperto[p]) return { errore: 'Prima devi aprire' };
      const m = this.combinazioni.find((x) => x.id === a.combinazione);
      if (!m) return { errore: 'Combinazione non trovata' };

      if (a.tipo === 'jolly') {
        const [c] = this.togliDallaMano(p, [String(a.carta)]) || [];
        if (!c) return { errore: 'Carta non valida' };
        const scelto = sostituisceJolly(m, c, a.jollyId != null ? String(a.jollyId) : undefined) || sostituisceJolly(m, c);
        if (!scelto) return { errore: 'Questa carta non sostituisce il jolly' };
        const jolly = m.carte.find((x) => x.id === scelto.id);
        const v = valuta([...m.carte.filter((x) => x.id !== jolly.id), c]);
        if (!v) return { errore: 'Sostituzione non valida' };
        Object.assign(m, v);
        this.mani[p] = mano.filter((x) => x.id !== c.id);
        this.mani[p].push(jolly);
        tt.daUsare.push(jolly.id); // il jolly recuperato va usato subito
        tt.jollyDa = m.id;
        tt.azioni++;
        return { ok: true };
      }

      const ids = (Array.isArray(a.carte) ? a.carte : []).map(String);
      const carte = this.togliDallaMano(p, ids);
      if (!carte || !carte.length) return { errore: 'Seleziona le carte da attaccare' };
      if (mano.length - ids.length < 1) return { errore: 'Devi tenere almeno una carta da scartare' };
      const v = valuta([...m.carte, ...carte]);
      if (!v || v.tipo !== m.tipo) return { errore: 'Queste carte non si attaccano qui' };
      Object.assign(m, v);
      this.usa(p, ids);
      return { ok: true };
    }

    if (a.tipo === 'scarta') {
      const c = mano.find((x) => x.id === String(a.carta));
      if (!c) return { errore: 'Carta non valida' };
      const rimaste = tt.daUsare.filter((id) => mano.some((x) => x.id === id));
      if (rimaste.length) {
        const cosa = rimaste.includes(tt.presoDalPozzo) ? 'la carta presa dagli scarti' : 'il jolly recuperato';
        return { errore: `Devi usare subito ${cosa}${rimaste.includes(tt.presoDalPozzo) && this.puoRestituire() ? ', oppure rimetterla negli scarti col pulsante «Rimetti lo scarto»' : ''}` };
      }
      this.mani[p] = mano.filter((x) => x.id !== c.id);
      this.pozzo.push(c);
      if (this.mani[p].length === 0) return this.chiudi(p);
      this.turno = this.prossimo(p);
      this.nuovoTurno();
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }

  rimescola() {
    if (this.pozzo.length <= 1) return;
    this.rimescolate++;
    const cima = this.pozzo.pop();
    this.mazzo = mescola(this.pozzo);
    this.pozzo = [cima];
  }

  chiudi(v) {
    const righe = [];
    for (let q = 0; q < this.n; q++) {
      if (this.eliminati[q]) continue;
      const pen = q === v ? 0 : this.aperto[q] ? this.mani[q].reduce((s, c) => s + penalita(c), 0) : 100;
      this.penalita[q] += pen;
      righe.push({ posto: q, penalita: pen, aperto: this.aperto[q], carte: this.mani[q].length, totale: this.penalita[q] });
    }
    for (const r of righe) if (r.totale >= this.limite) { this.eliminati[r.posto] = true; r.eliminato = true; }
    this.nSmazzata++;
    this.riepilogo = { vincitore: v, righe, smazzata: this.nSmazzata };
    this.annuncia(v, 'chiude!', 'chiudi!', true);
    this.turno = null;
    this.fase = 'riepilogo';
    const attivi = this.eliminati.map((e, i) => (e ? -1 : i)).filter((i) => i >= 0);
    if (attivi.length <= 1) {
      this.finita = true;
      this.risultato = {
        fazioni: this.penalita.map((x, i) => ({ posti: [i], punti: x })),
        etichetta: 'penalità',
        pareggio: false,
        vincitori: attivi.length ? attivi : [v],
      };
    } else this.inAttesa = true;
    return { ok: true };
  }

  annulla() {
    this.nSmazzata++;
    this.riepilogo = { vincitore: null, nulla: true, smazzata: this.nSmazzata,
      righe: this.eliminati.map((e, q) => (e ? null : { posto: q, penalita: 0, aperto: this.aperto[q], carte: this.mani[q].length, totale: this.penalita[q] })).filter(Boolean) };
    this.annuncia(null, 'Smazzata annullata: nessuno è riuscito a chiudere', 'Smazzata annullata: nessuno è riuscito a chiudere');
    this.turno = null;
    this.fase = 'riepilogo';
    this.inAttesa = true;
    return { ok: true };
  }

  avanza() {
    if (this.fase === 'riepilogo' && !this.finita) this.nuovaSmazzata();
  }

  // se un giocatore automatico si blocca, fa comunque procedere il turno
  sblocca(p) {
    if (this.turno !== p) return;
    if (this.fase === 'pesca') return this.azione(p, { tipo: 'pesca', da: 'mazzo' });
    if (this.tt.presoDalPozzo && this.tt.azioni === 0) this.azione(p, { tipo: 'restituisci' });
    if (this.fase === 'pesca') return this.azione(p, { tipo: 'pesca', da: 'mazzo' });
    this.tt.daUsare = [];
    const c = [...this.mani[p]].sort((a, b) => penalita(b) - penalita(a))[0];
    return this.azione(p, { tipo: 'scarta', carta: c.id });
  }

  vista(p) {
    const mioTurno = this.turno === p;
    return {
      gioco: this.id,
      n: this.n,
      aSquadre: false,
      mano: this.mani[p] || [],
      carteInMano: this.mani.map((m) => m.length),
      mazzo: this.mazzo.length,
      pozzo: this.pozzo[this.pozzo.length - 1] || null,
      pozzoN: this.pozzo.length,
      combinazioni: this.combinazioni,
      aperto: this.aperto,
      penalita: this.penalita,
      eliminati: this.eliminati,
      limite: this.limite,
      fase: this.fase,
      turno: this.turno,
      mazziere: this.mazziere,
      inAttesa: this.inAttesa,
      mioTurno: mioTurno ? {
        fase: this.fase,
        presoDalPozzo: this.tt.presoDalPozzo,
        daUsare: this.tt.daUsare,
        apertoOra: this.tt.apertoOra,
        puoRestituire: this.puoRestituire(),
      } : null,
      riepilogo: this.riepilogo,
      pausaMs: this.pausaMs,
      finita: this.finita,
      risultato: this.risultato,
      evento: this.evento,
    };
  }
}

// ---------- Computer ----------
function candidati(mano) {
  const jolly = mano.filter((c) => c.jolly);
  const nat = mano.filter((c) => !c.jolly);
  const out = [];
  const aggiungi = (carte) => { const v = valuta(carte); if (v) out.push({ carte, punti: v.punti }); };
  const sottoinsiemi = (arr, k, da = 0, acc = [], res = []) => {
    if (acc.length === k) { res.push(acc.slice()); return res; }
    for (let i = da; i < arr.length; i++) { acc.push(arr[i]); sottoinsiemi(arr, k, i + 1, acc, res); acc.pop(); }
    return res;
  };
  // tris e poker (una carta per seme)
  for (let r = 1; r <= 13; r++) {
    const perSeme = {};
    for (const c of nat) if (c.rango === r && !perSeme[c.seme]) perSeme[c.seme] = c;
    const L = Object.values(perSeme);
    if (L.length >= 3) { for (const s of sottoinsiemi(L, 3)) aggiungi(s); if (L.length === 4) aggiungi(L); }
    for (const j of jolly) {
      if (L.length >= 2) for (const s of sottoinsiemi(L, 2)) aggiungi([...s, j]);
      if (L.length >= 3) for (const s of sottoinsiemi(L, 3)) aggiungi([...s, j]);
    }
    if (L.length >= 2) for (const jj of sottoinsiemi(jolly, 2)) for (const s of sottoinsiemi(L, 2)) aggiungi([...s, ...jj]);
  }
  // scale
  for (const s of ['c', 'q', 'f', 'p']) {
    const perPos = {};
    for (const c of nat) if (c.seme === s && !perPos[c.rango]) perPos[c.rango] = c;
    if (perPos[1]) perPos[14] = perPos[1];
    for (let da = 1; da <= 12; da++) {
      for (let a = da + 2; a <= 14; a++) {
        if (da === 1 && a === 14) break;
        const pos = [];
        for (let x = da; x <= a; x++) pos.push(x);
        const mancanti = pos.filter((x) => !perPos[x]);
        if (mancanti.length > Math.min(2, jolly.length)) break;
        const carte = pos.filter((x) => perPos[x]).map((x) => perPos[x]);
        if (!mancanti.length) aggiungi(carte);
        else if (mancanti.length === 1) for (const j of jolly) aggiungi([...carte, j]);
        else for (const jj of sottoinsiemi(jolly, 2)) aggiungi([...carte, ...jj]);
      }
    }
  }
  return out;
}

function migliore(cands, maxCarte) {
  cands.sort((a, b) => b.punti - a.punti);
  let best = { gruppi: [], punti: 0, carte: 0 };
  let nodi = 0;
  const usati = new Set();
  const gruppi = [];
  const dfs = (i, punti, carte) => {
    if (++nodi > 15000) return;
    if (punti > best.punti || (punti === best.punti && carte > best.carte)) best = { gruppi: gruppi.slice(), punti, carte };
    for (let j = i; j < cands.length; j++) {
      const c = cands[j];
      if (carte + c.carte.length > maxCarte || c.carte.some((x) => usati.has(x.id))) continue;
      c.carte.forEach((x) => usati.add(x.id));
      gruppi.push(c.carte);
      dfs(j + 1, punti + c.punti, carte + c.carte.length);
      gruppi.pop();
      c.carte.forEach((x) => usati.delete(x.id));
    }
  };
  dfs(0, 0, 0);
  return best;
}

const attaccabile = (m, c) => { const v = valuta([...m.carte, c]); return !!v && v.tipo === m.tipo; };

function vuoleScarto(g, p) {
  const cima = g.pozzo[g.pozzo.length - 1];
  const mano2 = [...g.mani[p], cima];
  if (mano2.length < 3) return false;
  const best = migliore(candidati(mano2), mano2.length - 1);
  const usaCima = best.gruppi.some((gr) => gr.some((c) => c.id === cima.id));
  if (!g.aperto[p]) return best.punti >= APERTURA && usaCima;
  if (usaCima) return true;
  return mano2.length >= 3 && g.combinazioni.some((m) => attaccabile(m, cima));
}

function sceltaScarto(g, p, livello, vietate) {
  const mano = g.mani[p].filter((c) => !vietate.has(c.id));
  if (!mano.length) return g.mani[p][0];
  const naturali = mano.filter((c) => !c.jolly);
  if (!naturali.length) return mano[0];
  if (livello === 'facile' && Math.random() < 0.5) return casuale(naturali);
  const best = migliore(candidati(g.mani[p]), g.mani[p].length - 1);
  const inGioco = new Set(best.gruppi.flat().map((c) => c.id));
  let scelta = null;
  let min = Infinity;
  for (const c of naturali) {
    let u = inGioco.has(c.id) ? 12 : 0;
    for (const o of g.mani[p]) {
      if (o === c || o.jolly) continue;
      if (o.rango === c.rango && o.seme !== c.seme) u += 3;
      if (o.seme === c.seme) {
        const d = Math.min(Math.abs(o.rango - c.rango), Math.abs((o.rango === 1 ? 14 : o.rango) - (c.rango === 1 ? 14 : c.rango)));
        if (d === 1) u += 3;
        else if (d === 2) u += 1.5;
      }
    }
    if (livello === 'difficile' && g.combinazioni.some((m) => attaccabile(m, c))) u += 4; // non regalarla agli altri
    u -= penalita(c) * 0.08; // a parità meglio scartare le carte che pesano di più
    if (u < min) { min = u; scelta = c; }
  }
  return scelta;
}

function bot(g, p, livello) {
  const tt = g.tt;
  if (g.fase === 'pesca') {
    if (livello !== 'facile' && g.pozzo.length && vuoleScarto(g, p)) return { tipo: 'pesca', da: 'pozzo' };
    return { tipo: 'pesca', da: 'mazzo' };
  }
  const mano = g.mani[p];
  const daUsare = new Set(tt.daUsare);
  const aperto = g.aperto[p];
  const puoAttaccare = (m, c) => !(c.jolly && m.id === tt.jollyDa) && attaccabile(m, c);

  // 1) carte da usare per forza (presa dagli scarti o jolly recuperato)
  if (aperto && mano.length > 1) {
    for (const id of daUsare) {
      const c = mano.find((x) => x.id === id);
      if (!c) continue;
      const m = g.combinazioni.find((x) => puoAttaccare(x, c));
      if (m) return { tipo: 'attacca', combinazione: m.id, carte: [c.id] };
    }
  }
  // 2) calare combinazioni
  const best = migliore(candidati(mano), mano.length - 1);
  if (!aperto) {
    if (best.punti >= APERTURA) return { tipo: 'cala', combinazioni: best.gruppi.map((gr) => gr.map((c) => c.id)) };
    if (tt.presoDalPozzo && tt.azioni === 0) return { tipo: 'restituisci' };
  } else if (best.gruppi.length) {
    return { tipo: 'cala', combinazioni: best.gruppi.map((gr) => gr.map((c) => c.id)) };
  }
  // 3) attaccare le carte ai giochi in tavola
  if (aperto && mano.length > 1) {
    for (const c of mano) {
      if (c.jolly && !daUsare.has(c.id) && mano.length > 3) continue; // i jolly si tengono, tranne a fine mano
      const m = g.combinazioni.find((x) => puoAttaccare(x, c));
      if (m) return { tipo: 'attacca', combinazione: m.id, carte: [c.id] };
    }
    // 4) recuperare un jolly (solo al difficile), se poi si può riusare subito altrove
    if (livello === 'difficile' && !tt.apertoOra && mano.length >= 2 && !daUsare.size) {
      for (const m of g.combinazioni) {
        if (!m.jolly) continue;
        const c = mano.find((x) => sostituisceJolly(m, x));
        const j = c && m.carte.find((x) => x.id === sostituisceJolly(m, c).id);
        if (c && g.combinazioni.some((m2) => m2.id !== m.id && attaccabile(m2, j))) return { tipo: 'jolly', combinazione: m.id, carta: c.id };
      }
    }
  }
  // 5) scartare
  return { tipo: 'scarta', carta: sceltaScarto(g, p, livello, daUsare).id };
}

module.exports = {
  meta: {
    id: 'scala40',
    nome: 'Scala 40',
    giocatori: [2, 3, 4],
    descrizione: 'Due mazzi e quattro jolly: cala scale e tris, apri con 40 punti e chiudi per primo.',
    opzioni: [{ id: 'limite', nome: 'Eliminato a', valori: [101, 201], predefinito: 101 }],
    regole: [
      'Si gioca con due mazzi da 52 carte più 4 jolly. Ognuno riceve 13 carte; una carta scoperta inizia gli scarti.',
      'Al tuo turno peschi una carta, dal mazzo oppure l\'ultima degli scarti, poi puoi calare o attaccare, e finisci scartando una carta.',
      'Combinazioni: la scala è di almeno 3 carte consecutive dello stesso seme (l\'asso può stare prima del 2 o dopo il re, non in mezzo); il tris o poker è di 3 o 4 carte dello stesso valore e di semi diversi. Si possono usare più jolly, anche uno accanto all\'altro (per esempio 8, jolly, jolly, J), ma in ogni combinazione i jolly non possono essere più delle carte vere.',
      'Per aprire la prima volta devi calare combinazioni per almeno 40 punti in un turno. Valori: dal 2 al 10 quanto indicano, figure 10, asso 11 (1 se è nella scala A-2-3), il jolly vale la carta che sostituisce.',
      'La carta presa dagli scarti va usata subito nello stesso turno. Se non l\'hai ancora aperto, devi aprire usando proprio quella carta. Se l\'hai presa per sbaglio puoi sempre rimetterla con «Rimetti lo scarto»: se non hai ancora calato nulla torni a pescare, altrimenti perdi la pescata e scarti un\'altra carta.',
      'Dopo aver aperto puoi calare nuove combinazioni e attaccare carte ai giochi di tutti, anche nello stesso turno in cui apri.',
      'Se hai la carta che il jolly sostituisce in un gioco in tavola, puoi scambiarla col jolly (dopo aver aperto), ma il jolly va riusato subito.',
      'Chiude chi resta senza carte con l\'ultimo scarto. Gli altri prendono penalità pari alle carte in mano (jolly 25, asso 11, figure 10); chi non ha aperto prende 100.',
      'Chi arriva al limite di penalità è eliminato. Vince l\'ultimo rimasto.',
    ],
  },
  crea: (o) => new Scala40(o),
  bot,
  _test: { candidati, migliore },
};
