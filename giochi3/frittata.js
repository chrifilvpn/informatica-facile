// FRITTATA! Gioco di carte caotico e assurdo, da 2 a 6. Vince chi, all'INIZIO del suo turno, ha in mano ESATTAMENTE
// 10 carte e grida "FRITTATA!". Nel proprio turno si fa UNA cosa sola: pescare una carta, giocare una carta Azione
// (pesca, ruba, scarta, scambia…) oppure piazzare coperta una Trappola, che scatta da sola quando succede quello che
// c'è scritto. Le carte Contro si giocano FUORI turno, in risposta: annullano un'Azione, una Trappola che scatta o un
// altro Contro (e si può rispondere al Contro con un altro Contro). La Frittata la ferma solo "Non è ancora ora!".
// Chi finisce il turno con più di 10 carte ne scarta fino a restare con 10: poi gli altri devono cambiargliele prima
// che tocchi di nuovo a lui. Carte, nomi e battute sono originali del sito.
const T = require('../giochi/trucco');

const VELOCE = !!process.env.TEST_VELOCE;
const MAX_TRAPPOLE = 3;
const OBIETTIVO = 10;

// le carte (nomi, testi e battute) stanno in public/js/giochi3/frittata-carte.js, uguali nel browser
const CARTE = require('../public/js/giochi3/frittata-carte');

const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const def = (c) => CARTE[c.k];
const NOME_K = (k) => `${CARTE[k].emoji} ${CARTE[k].nome}`;

class Frittata {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'frittata';
    this.n = n;
    this.iniziali = Number(opzioni.iniziali) === 5 ? 5 : 3;
    this.finestraMs = VELOCE ? 400 : (Number(opzioni.tempo) || 8) * 1000;
    let k = 0;
    this.mazzo = [];
    for (const [nome, d] of Object.entries(CARTE)) for (let q = 0; q < d.quante; q++) this.mazzo.push({ id: `f${++k}`, k: nome });
    mescola(this.mazzo);
    this.scarti = [];
    this.mani = Array.from({ length: n }, () => []);
    this.trappole = Array.from({ length: n }, () => []);
    for (let p = 0; p < n; p++) this.pesca(p, this.iniziali, true);
    this.turnoDi = ((primo % n) + n) % n;
    this.turno = this.turnoDi;
    this.inizio = true; // il giocatore di turno non ha ancora fatto niente (solo ora si può gridare "Frittata!")
    this.fase = 'turno'; // turno | risposta | scarta
    this.pend = null; this.passati = new Set(); this.scade = 0;
    this.nTurni = 0; this.limiteTurni = 100 * n;
    this.log = [];
    this.nEv = 0; this.evento = null; this.finita = false; this.risultato = null;
  }

  // ---- piccoli aiuti ----
  annuncia(posto, testo, testoIo, { forte = false, bersaglio, testoTe } = {}) {
    this.evento = { id: ++this.nEv, posto, testo, testoIo, forte };
    if (bersaglio != null) { this.evento.bersaglio = bersaglio; if (testoTe) this.evento.testoTe = testoTe; }
  }
  scrivi(t) { this.log.push({ id: (this.log.length ? this.log[this.log.length - 1].id : 0) + 1, t }); if (this.log.length > 14) this.log.shift(); }
  nomeP(p) { return `@${p}`; } // nel registro i nomi li mette il browser
  pesca(p, k = 1, silenzio = false) {
    let fatte = 0;
    for (let i = 0; i < k; i++) {
      if (!this.mazzo.length) {
        if (!this.scarti.length) break;
        this.mazzo = mescola(this.scarti); this.scarti = [];
        if (!silenzio) this.scrivi('🔄 Il mazzo è finito: si rimescolano gli scarti');
      }
      // sfortuna (!lose): in cima va un "Non è ancora ora!", che serve a poco
      if (!silenzio && T.sfortuna(this, p)) T.inCima(this.mazzo, (c) => c.k === 'nonora');
      this.mani[p].push(this.mazzo.pop()); fatte++;
    }
    return fatte;
  }
  togliCaso(p, k) {
    const m = this.mani[p], via = [];
    for (let i = 0; i < k && m.length; i++) via.push(m.splice(Math.floor(Math.random() * m.length), 1)[0]);
    return via;
  }
  scartaCaso(p, k) { const via = this.togliCaso(p, k); this.scarti.push(...via); return via.length; }
  autore(P = this.pend) { return P.catena.length ? P.catena[P.catena.length - 1].chi : P.chi; }
  // la carta Contro c si può giocare adesso sulla cima della catena?
  controValido(c) {
    const d = def(c), P = this.pend;
    if (!P || d.tipo !== 'contro') return false;
    const suFrittata = P.k === 'frittata' && !P.catena.length;
    return suFrittata ? !!d.frittata : !d.frittata;
  }
  puoRispondere(p) { return this.fase === 'risposta' && p !== this.autore() && this.mani[p].some((c) => this.controValido(c)); }
  attesi() { if (this.fase !== 'risposta' || this.finita) return []; return Array.from({ length: this.n }, (_, i) => i).filter((i) => !this.passati.has(i) && this.puoRispondere(i)); }
  scadenza() { return this.fase === 'risposta' && !this.finita ? this.scade : null; }
  controllaTempo() {
    if (this.fase !== 'risposta' || this.finita || Date.now() < this.scade) return false;
    this.risolvi();
    return true;
  }

  // ---- finestra di risposta: tutti quelli con un Contro adatto possono annullare ----
  apri(P) {
    P.catena = [];
    this.pend = P;
    this.fase = 'risposta';
    this.turno = null;
    this.passati = new Set();
    this.scade = Date.now() + this.finestraMs;
    this.nFinestra = (this.nFinestra || 0) + 1;
    if (!this.attesi().length) this.risolvi();
  }
  risolvi() {
    const P = this.pend;
    this.pend = null; this.fase = 'turno'; this.turno = this.turnoDi; this.passati = new Set();
    // ogni Contro annulla quello prima: valgono quelli in posizione dispari contando dall'ultimo
    const L = P.catena.length;
    for (let i = L - 1; i >= 0; i -= 2) {
      const x = P.catena[i], prima = i ? P.catena[i - 1].chi : P.chi;
      if (x.carta.k === 'gas') this.pesca(x.chi, 1);
      if (x.carta.k === 'avvocato' || x.carta.k === 'nonora') this.pesca(prima, 1);
    }
    for (const x of P.catena) this.scarti.push(x.carta);
    const annullato = L % 2 === 1;
    if (L) this.scrivi(annullato ? `✋ ${NOME_K(P.catena[L - 1].carta.k)} di ${this.nomeP(P.catena[L - 1].chi)}: annullato!` : `↩️ Contro annullati a catena: ${NOME_K(P.carta ? P.carta.k : 'nonora')} vale`);
    switch (P.k) {
      case 'frittata':
        if (!annullato) return this.vinci(P.chi);
        this.annuncia(P.chi, 'non fa la frittata: le uova non erano pronte!', 'niente frittata: le uova non erano pronte!', { forte: true });
        this.inizio = false;
        return undefined;
      case 'padella':
        this.scarti.push(P.carta);
        if (!annullato) {
          this.scartaCaso(P.vittima, 2);
          this.inizio = false;
          this.scrivi(`🍳 Padella bucata di ${this.nomeP(P.chi)}: la frittata di ${this.nomeP(P.vittima)} cola via (scarta 2 carte)`);
          this.annuncia(P.chi, 'fa scattare la Padella bucata: la frittata cola via! 🍳', 'fai scattare la Padella bucata: la frittata cola via! 🍳', { forte: true });
          return undefined;
        }
        return this.apri({ k: 'frittata', chi: P.vittima });
      case 'azione': {
        if (annullato) { this.scarti.push(P.carta); return this.fineTurno(); }
        const d = def(P.carta);
        if (d.bers && P.bers !== P.chi) {
          const i = this.trappole[P.bers].findIndex((c) => def(c).scatta === 'mira');
          if (i >= 0) {
            const t = this.trappole[P.bers].splice(i, 1)[0];
            this.scrivi(`💥 Scatta la trappola di ${this.nomeP(P.bers)}: ${NOME_K(t.k)}`);
            this.annuncia(P.bers, `fa scattare una trappola: ${NOME_K(t.k)}!`, `fai scattare la tua trappola: ${NOME_K(t.k)}!`, { forte: true });
            return this.apri({ k: 'mira', chi: P.bers, carta: t, azione: P });
          }
        }
        this.esegui(P);
        this.scarti.push(P.carta);
        return this.fineTurno();
      }
      case 'mira': {
        const A = P.azione;
        this.scarti.push(P.carta);
        if (annullato) this.esegui(A);
        else if (P.carta.k === 'specchio') { this.scrivi(`🪞 Lo specchio rimanda ${NOME_K(A.carta.k)} a ${this.nomeP(A.chi)}`); this.esegui({ ...A, chi: A.bers, bers: A.chi }); }
        else { this.pesca(A.chi, 2); this.scrivi(`🐕 Il cane ferma ${NOME_K(A.carta.k)}: ${this.nomeP(A.chi)} pesca 2 carte`); }
        this.scarti.push(A.carta);
        return this.fineTurno();
      }
      case 'retino':
        this.scarti.push(P.carta);
        if (!annullato) { this.pesca(P.chi, 1); this.scrivi(`🥅 Il retino di ${this.nomeP(P.chi)} acchiappa la carta pescata da ${this.nomeP(P.vittima)}`); }
        else this.pesca(P.vittima, 1);
        return this.fineTurno();
      default:
        return this.fineTurno();
    }
  }

  // l'effetto di un'Azione (chi = chi la fa, bers = il bersaglio)
  esegui({ carta, chi, bers }) {
    const k = carta.k, n = this.n, altri = Array.from({ length: n }, (_, i) => i).filter((i) => i !== chi);
    const io = this.nomeP(chi), lui = bers != null ? this.nomeP(bers) : '';
    let t = '';
    switch (k) {
      case 'piccione': t = `pesca ${this.pesca(chi, 3)} carte`; break;
      case 'calzini': { const via = this.togliCaso(bers, 2); this.mani[chi].push(...via); t = `ruba ${via.length} carte a ${lui}`; break; }
      case 'zia': for (const i of altri) this.pesca(i, 2); t = 'fa pescare 2 carte a tutti gli altri'; break;
      case 'starnuto': t = `fa scartare ${this.scartaCaso(bers, 3)} carte a ${lui}`; break;
      case 'cervelli': [this.mani[chi], this.mani[bers]] = [this.mani[bers], this.mani[chi]]; t = `scambia la mano con ${lui}`; break;
      case 'regalo': { const via = this.togliCaso(chi, 3); this.mani[bers].push(...via); t = `regala ${via.length} carte a ${lui}`; break; }
      case 'gatto': for (const i of altri) this.scartaCaso(i, 1); t = 'fa scartare 1 carta a tutti gli altri'; break;
      case 'giostra': { const prima = this.mani.slice(); for (let i = 0; i < n; i++) this.mani[(i + 1) % n] = prima[i]; t = 'fa girare tutte le mani di un posto'; break; }
      case 'mucca': t = `fa pescare ${this.pesca(bers, 3)} carte a ${lui}`; break;
      case 'bidone': { const via = this.scarti.splice(Math.max(0, this.scarti.length - 3)); this.mani[chi].push(...via); t = `riprende ${via.length} carte dagli scarti`; break; }
      case 'tornado': { const q = this.trappole[bers].length; this.scarti.push(...this.trappole[bers]); this.trappole[bers] = []; t = q ? `spazza via ${q} trappol${q === 1 ? 'a' : 'e'} di ${lui}` : `spazza il posto di ${lui}, ma non c'erano trappole`; break; }
      case 'dieta': t = `fa scartare ${this.scartaCaso(bers, Math.floor(this.mani[bers].length / 2))} carte a ${lui}`; break;
      case 'dentista': { const m = this.mani[bers].length; if (m > 5) this.scartaCaso(bers, m - 5); else this.pesca(bers, 5 - m); t = `porta ${lui} a ${this.mani[bers].length} carte`; break; }
      default: break;
    }
    this.scrivi(`${NOME_K(k)}: ${io} ${t}`);
  }

  fineTurno() {
    if (this.finita) return;
    const p = this.turnoDi;
    if (this.mani[p].length > OBIETTIVO) { this.fase = 'scarta'; this.turno = p; return; }
    this.passaTurno();
  }
  passaTurno() {
    this.nTurni++;
    if (this.nTurni >= this.limiteTurni) return this.chiudiLimite();
    this.turnoDi = (this.turnoDi + 1) % this.n;
    this.turno = this.turnoDi; this.fase = 'turno'; this.inizio = true;
    return undefined;
  }
  vinci(p) {
    this.finita = true; this.turno = null; this.fase = 'fine';
    this.scrivi(`🍳 ${this.nomeP(p)} grida FRITTATA! con 10 carte in mano`);
    this.annuncia(p, 'grida FRITTATA! con 10 carte in mano: vince! 🍳', 'FRITTATA! Hai 10 carte in mano: hai vinto! 🍳', { forte: true });
    this.risultato = { fazioni: this.classifica(p), etichetta: 'carte', pareggio: false, vincitori: [p] };
  }
  // le carte in mano a fine partita (chi vince ne aveva 10 quando ha gridato), dalla più vicina a 10; i punti sono
  // scritte tipo "8/10" così il sito non li prende per un record da battere
  classifica(v) {
    const n = this.mani.map((m, i) => (i === v ? OBIETTIVO : m.length));
    return Array.from({ length: this.n }, (_, i) => i).sort((a, b) => Math.abs(n[a] - OBIETTIVO) - Math.abs(n[b] - OBIETTIVO)).map((i) => ({ posti: [i], punti: `${n[i]}/10` }));
  }
  // partita infinita (succede quasi mai): vince chi è più vicino a 10
  chiudiLimite() {
    const d = this.mani.map((m) => Math.abs(m.length - OBIETTIVO));
    const min = Math.min(...d);
    const v = d.map((x, i) => (x === min ? i : -1)).filter((i) => i >= 0);
    this.finita = true; this.turno = null; this.fase = 'fine';
    this.risultato = { fazioni: this.classifica(-1), etichetta: 'carte', pareggio: v.length > 1, vincitori: v, titolo: 'Troppi turni: vince chi è più vicino a 10' };
  }

  // ---- mosse ----
  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!a || typeof a.tipo !== 'string') return { errore: 'Mossa non valida' };
    if (!Number.isInteger(p) || p < 0 || p >= this.n) return { errore: 'Posto non valido' };
    const mano = this.mani[p];
    const trova = (id) => mano.findIndex((c) => c.id === id);
    if (a.tipo === 'contro' || a.tipo === 'passa') {
      if (this.fase !== 'risposta') return { errore: 'Adesso non c\'è niente da annullare' };
      if (!this.attesi().includes(p)) return { errore: p === this.autore() ? 'Non puoi annullare la tua carta' : 'Non hai Contro da giocare adesso' };
      if (a.tipo === 'passa') { this.passati.add(p); if (!this.attesi().length) this.risolvi(); return { ok: true }; }
      const i = trova(a.carta);
      if (i < 0) return { errore: 'Non hai questa carta' };
      if (!this.controValido(mano[i])) return { errore: this.pend.k === 'frittata' && !this.pend.catena.length ? 'Una Frittata si ferma solo con "Non è ancora ora!"' : '"Non è ancora ora!" serve solo contro una Frittata' };
      const c = mano.splice(i, 1)[0];
      const prima = this.autore();
      this.pend.catena.push({ chi: p, carta: c });
      this.annuncia(p, `risponde con ${NOME_K(c.k)}`, `rispondi con ${NOME_K(c.k)}`, { bersaglio: prima });
      this.passati = new Set();
      this.scade = Date.now() + this.finestraMs;
      if (!this.attesi().length) this.risolvi();
      return { ok: true };
    }
    if (this.fase === 'risposta') return { errore: 'Aspetta: si può ancora rispondere con un Contro' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (a.tipo === 'scarta') {
      if (this.fase !== 'scarta') return { errore: 'Non devi scartare' };
      const serve = mano.length - OBIETTIVO;
      const ids = Array.isArray(a.carte) ? [...new Set(a.carte)] : [];
      if (ids.length !== serve) return { errore: `Devi scartare ${serve} ${serve === 1 ? 'carta' : 'carte'}` };
      if (ids.some((id) => trova(id) < 0)) return { errore: 'Non hai queste carte' };
      for (const id of ids) this.scarti.push(mano.splice(trova(id), 1)[0]);
      this.scrivi(`🗑️ ${this.nomeP(p)} scarta ${serve} ${serve === 1 ? 'carta' : 'carte'} e resta con 10`);
      this.passaTurno();
      return { ok: true };
    }
    if (this.fase !== 'turno') return { errore: 'Mossa non valida adesso' };
    if (a.tipo === 'frittata') {
      if (!this.inizio) return { errore: 'La Frittata si grida solo all\'inizio del turno' };
      if (mano.length !== OBIETTIVO) return { errore: `Servono esattamente 10 carte (ne hai ${mano.length})` };
      this.inizio = false;
      this.annuncia(p, 'grida FRITTATA!!! 🍳', 'gridi FRITTATA!!! 🍳', { forte: true });
      this.scrivi(`📣 ${this.nomeP(p)} grida FRITTATA!`);
      // prima le padelle bucate degli altri (la prima che si trova, a partire da chi viene dopo)
      for (let k = 1; k < this.n; k++) {
        const q = (p + k) % this.n, i = this.trappole[q].findIndex((c) => c.k === 'padella');
        if (i >= 0) return this.apri({ k: 'padella', chi: q, vittima: p, carta: this.trappole[q].splice(i, 1)[0] }), { ok: true };
      }
      this.apri({ k: 'frittata', chi: p });
      return { ok: true };
    }
    if (a.tipo === 'pesca') {
      this.inizio = false;
      for (let k = 1; k < this.n; k++) {
        const q = (p + k) % this.n, i = this.trappole[q].findIndex((c) => c.k === 'retino');
        if (i >= 0) {
          const t = this.trappole[q].splice(i, 1)[0];
          this.annuncia(q, 'fa scattare il Retino acchiappatutto! 🥅', 'fai scattare il tuo Retino acchiappatutto! 🥅', { forte: true });
          this.apri({ k: 'retino', chi: q, vittima: p, carta: t });
          return { ok: true };
        }
      }
      this.pesca(p, 1);
      this.scrivi(`🃏 ${this.nomeP(p)} pesca una carta`);
      this.annuncia(p, 'pesca una carta', 'peschi una carta');
      this.fineTurno();
      return { ok: true };
    }
    if (a.tipo === 'gioca') {
      const i = trova(a.carta);
      if (i < 0) return { errore: 'Non hai questa carta' };
      const d = def(mano[i]);
      if (d.tipo === 'contro') return { errore: 'I Contro si giocano solo in risposta, quando qualcuno gioca una carta' };
      if (d.tipo === 'trappola') {
        if (this.trappole[p].length >= MAX_TRAPPOLE) return { errore: `Hai già ${MAX_TRAPPOLE} trappole piazzate` };
        this.inizio = false;
        this.trappole[p].push(mano.splice(i, 1)[0]);
        this.scrivi(`🪤 ${this.nomeP(p)} piazza una trappola coperta`);
        this.annuncia(p, 'piazza una trappola coperta… 🪤', 'piazzi una trappola coperta 🪤');
        this.fineTurno();
        return { ok: true };
      }
      let bers = null;
      if (d.bers) {
        bers = Number(a.bers);
        if (!Number.isInteger(bers) || bers < 0 || bers >= this.n || bers === p) return { errore: 'Scegli un altro giocatore' };
      }
      this.inizio = false;
      const c = mano.splice(i, 1)[0];
      this.scrivi(`▶️ ${this.nomeP(p)} gioca ${NOME_K(c.k)}${bers != null ? ` su ${this.nomeP(bers)}` : ''}`);
      this.annuncia(p, `gioca ${NOME_K(c.k)}${bers != null ? ' su @' : ''}`, `giochi ${NOME_K(c.k)}${bers != null ? ' su @' : ''}`, { bersaglio: bers == null ? undefined : bers, testoTe: `gioca ${NOME_K(c.k)} su di te!` });
      this.apri({ k: 'azione', chi: p, carta: c, bers });
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }
  // un posto bloccato (per sicurezza): si va avanti
  sblocca(p) {
    if (this.fase === 'risposta') { this.passati.add(p); if (!this.attesi().length) this.risolvi(); return; }
    if (p === this.turno) { if (this.fase === 'scarta') { const m = this.mani[p]; this.scarti.push(...m.splice(OBIETTIVO)); } this.passaTurno(); }
  }

  // ---- trucco segreto ----
  suggerimentoWin(p) {
    if (this.finita) return null;
    const m = this.mani[p];
    if (this.fase === 'risposta' && this.attesi().includes(p)) {
      const c = m.find((x) => this.controValido(x));
      return c ? `💡 Rispondi con ${NOME_K(c.k)}: ${this.pend.chi === p ? 'difendi la tua carta' : 'annulla la carta di chi gioca'}` : null;
    }
    if (this.turno !== p || this.fase !== 'turno') return null;
    if (this.inizio && m.length === OBIETTIVO) return '💡 Hai 10 carte: premi FRITTATA! adesso';
    const pericolo = this.mani.map((x, i) => (i !== p && x.length === OBIETTIVO ? i : -1)).filter((i) => i >= 0);
    if (pericolo.length) {
      const c = m.find((x) => ['starnuto', 'mucca', 'dieta', 'dentista', 'calzini'].includes(x.k));
      if (c) return `💡 Qualcuno ha 10 carte: gioca ${NOME_K(c.k)} su di lui`;
    }
    const pad = m.find((x) => x.k === 'padella');
    if (pad && this.trappole[p].length < MAX_TRAPPOLE && !this.trappole[p].some((x) => x.k === 'padella')) return '💡 Piazza la Padella bucata: ferma la prossima Frittata degli altri';
    if (m.length >= 9) return '💡 Pesca: a fine turno scarti fino a 10 e al prossimo turno puoi gridare Frittata';
    const pic = m.find((x) => x.k === 'piccione');
    return pic ? '💡 Gioca il Piccione postino: 3 carte in più' : '💡 Pesca una carta';
  }
  // mano vincente: 10 carte, con due Contro e un "Non è ancora ora!" per difendersi
  // (arriva all'inizio del proprio turno, così nessuno fa in tempo a cambiarla)
  manoVincente(p) {
    if (this.finita || this.fase !== 'turno' || this.turno !== p || !this.inizio) return null;
    const m = this.mani[p];
    const prendi = (k) => { const i = this.mazzo.findIndex((c) => c.k === k); if (i >= 0) { m.push(this.mazzo.splice(i, 1)[0]); return true; } const j = this.scarti.findIndex((c) => c.k === k); if (j >= 0) { m.push(this.scarti.splice(j, 1)[0]); return true; } return false; };
    if (!m.some((c) => c.k === 'nograzie')) prendi('nograzie');
    if (m.filter((c) => def(c).tipo === 'contro' && c.k !== 'nonora').length < 2) prendi('gas');
    while (m.length > OBIETTIVO) { const i = m.findIndex((c) => def(c).tipo === 'azione'); this.scarti.push(m.splice(i >= 0 ? i : 0, 1)[0]); }
    while (m.length < OBIETTIVO && this.pesca(p, 1, true)) { /* fino a 10 */ }
    return m.length === OBIETTIVO ? '🍳 Hai 10 carte (con qualche Contro per difenderti): grida FRITTATA! adesso' : null;
  }

  vista(p) {
    const io = p >= 0 && p < this.n;
    const P = this.pend;
    return {
      gioco: this.id, n: this.n,
      mano: io ? this.mani[p].map((c) => ({ id: c.id, k: c.k })) : [],
      carte: this.mani.map((m) => m.length),
      // le trappole degli altri sono coperte: si vede solo quante sono
      trappole: this.trappole.map((t, i) => (i === p ? t.map((c) => ({ id: c.id, k: c.k })) : t.length)),
      mazzo: this.mazzo.length, scarti: this.scarti.length, cimaScarti: this.scarti.length ? this.scarti[this.scarti.length - 1].k : null,
      fase: this.fase, turno: this.turno, turnoDi: this.turnoDi, inizio: this.inizio,
      pend: P ? { k: P.k, chi: P.chi, carta: P.carta ? P.carta.k : null, bers: P.bers, vittima: P.vittima, azione: P.azione ? { chi: P.azione.chi, carta: P.azione.carta.k, bers: P.azione.bers } : null, catena: P.catena.map((x) => ({ chi: x.chi, carta: x.carta.k })), restaMs: Math.max(0, this.scade - Date.now()), finestraMs: this.finestraMs, nFinestra: this.nFinestra } : null,
      rispondi: io && this.fase === 'risposta' && this.attesi().includes(p) ? this.mani[p].filter((c) => this.controValido(c)).map((c) => c.id) : [],
      attesi: this.attesi(),
      log: this.log,
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
const VALORE = { nonora: 9, nograzie: 8, gas: 8, avvocato: 7, padella: 7, specchio: 6, cane: 5, retino: 4, starnuto: 5, dieta: 5, dentista: 5, mucca: 4, calzini: 4, piccione: 3, cervelli: 3, tornado: 3, regalo: 2, bidone: 2, zia: 2, gatto: 2, giostra: 1 };
function bot(g, p, livello = 'medio') {
  const m = g.mani[p], n = g.n;
  const caso = (a) => a[Math.floor(Math.random() * a.length)];
  // ---- risposta con un Contro ----
  if (g.fase === 'risposta') {
    const P = g.pend, utili = m.filter((c) => g.controValido(c));
    if (!utili.length) return { tipo: 'passa' };
    const autore = g.autore();
    // voglio che la carta in fondo alla catena abbia effetto? true sì, false no, null non mi importa
    let voglio = null;
    if (P.k === 'frittata') voglio = P.chi === p;
    else if (P.k === 'padella') voglio = P.vittima !== p;
    else if (P.k === 'azione') {
      if (P.chi === p) voglio = true;
      else if (P.bers === p || (P.bers == null && ['zia', 'gatto', 'giostra'].includes(P.carta.k))) voglio = false;
      else if (livello === 'difficile' && g.mani[P.chi].length >= 8 && ['piccione', 'bidone', 'calzini'].includes(P.carta.k)) voglio = false;
    } else if (P.k === 'mira') voglio = P.chi === p ? true : P.azione.chi === p ? false : null;
    else if (P.k === 'retino') voglio = P.chi === p ? true : P.vittima === p ? false : null;
    if (voglio == null) return { tipo: 'passa' };
    const passaOra = P.catena.length % 2 === 0; // adesso la carta in fondo passerebbe?
    const contro = voglio !== passaOra;
    if (!contro || autore === p) return { tipo: 'passa' };
    if (livello === 'facile' && Math.random() < 0.5) return { tipo: 'passa' };
    if (livello === 'medio' && P.k === 'frittata' && P.chi !== p && Math.random() < 0.35) return { tipo: 'passa' };
    // il medio tiene i Contro per le cose importanti
    if (livello === 'medio' && P.k === 'azione' && P.bers !== p && P.chi !== p && Math.random() < 0.5) return { tipo: 'passa' };
    utili.sort((a, b) => VALORE[a.k] - VALORE[b.k]);
    return { tipo: 'contro', carta: utili[0].id };
  }
  // ---- scartare fino a 10: via le carte che valgono meno ----
  if (g.fase === 'scarta') {
    const serve = m.length - OBIETTIVO;
    const ord = [...m].sort((a, b) => (livello === 'facile' ? Math.random() - 0.5 : VALORE[a.k] - VALORE[b.k]));
    return { tipo: 'scarta', carte: ord.slice(0, serve).map((c) => c.id) };
  }
  // ---- il mio turno ----
  if (g.inizio && m.length === OBIETTIVO) return { tipo: 'frittata' };
  const altri = Array.from({ length: n }, (_, i) => i).filter((i) => i !== p);
  const azioni = m.filter((c) => def(c).tipo === 'azione');
  const trap = m.filter((c) => def(c).tipo === 'trappola');
  const gioca = (c, bers) => ({ tipo: 'gioca', carta: c.id, ...(bers != null ? { bers } : {}) });
  if (livello === 'facile') {
    const r = Math.random();
    if (r < 0.4 || (!azioni.length && !trap.length)) return { tipo: 'pesca' };
    if (trap.length && g.trappole[p].length < MAX_TRAPPOLE && r < 0.6) return gioca(caso(trap));
    if (azioni.length) { const c = caso(azioni); return gioca(c, def(c).bers ? caso(altri) : null); }
    return { tipo: 'pesca' };
  }
  const trova = (...ks) => azioni.find((c) => ks.includes(c.k));
  // 1) qualcuno ha 10 carte (o le avrà): va fermato, a partire da chi gioca prima
  const minaccia = altri.map((i) => ({ i, d: (i - p + n) % n })).filter((x) => g.mani[x.i].length === OBIETTIVO).sort((a, b) => a.d - b.d)[0];
  // (non sempre: il medio se ne accorge una volta su due, il difficile quasi sempre)
  if (minaccia && Math.random() < (livello === 'difficile' ? 0.8 : 0.45)) {
    const q = minaccia.i;
    const c = trova('calzini', 'starnuto', 'dieta', 'dentista', 'mucca', 'regalo', 'cervelli') || (livello === 'difficile' ? trova('gatto', 'zia', 'giostra') : null);
    if (c) {
      // scambio di cervelli solo se ci conviene davvero (prendo io le sue 10)
      if (c.k !== 'cervelli' || m.length - 1 !== OBIETTIVO) return gioca(c, def(c).bers ? q : null);
    }
  }
  // 2) la padella bucata è la difesa migliore: piazzarla presto
  const haTrap = (k) => g.trappole[p].some((c) => c.k === k);
  if (g.trappole[p].length < MAX_TRAPPOLE) {
    const pad = trap.find((c) => c.k === 'padella' && !haTrap('padella'));
    if (pad) return gioca(pad);
  }
  // 3) arrivare a 10 (o più: a fine turno si scarta): con tante carte basta pescare
  const dopo = m.length; // carte che avrò (pescare: +1)
  if (dopo + 1 >= OBIETTIVO) {
    // con 9 carte pescare porta a 10; con più si scarta comunque a 10
    if (livello === 'difficile' && trap.length && g.trappole[p].length < MAX_TRAPPOLE && m.length > OBIETTIVO) return gioca(trap.sort((a, b) => VALORE[b.k] - VALORE[a.k])[0]);
    return { tipo: 'pesca' };
  }
  // pochi: il piccione e il bidone fanno salire in fretta; ladro di calzini sul più ricco
  const ricco = altri.slice().sort((a, b) => g.mani[b].length - g.mani[a].length)[0];
  const c = trova('piccione') || (g.scarti.length >= 3 ? trova('bidone') : null) || (g.mani[ricco].length >= 2 ? trova('calzini') : null);
  if (c) return gioca(c, def(c).bers ? ricco : null);
  // una trappola di difesa, se c'è posto
  const t = trap.find((x) => !haTrap(x.k));
  if (t && g.trappole[p].length < MAX_TRAPPOLE && Math.random() < 0.6) return gioca(t);
  return { tipo: 'pesca' };
}

module.exports = {
  meta: {
    id: 'frittata',
    nome: 'Frittata!',
    giocatori: [2, 3, 4, 5, 6],
    tipo: 'tabellone',
    descrizione: 'Gioco di carte caotico e assurdo: vince chi inizia il turno con ESATTAMENTE 10 carte e grida "Frittata!". Azioni, trappole nascoste e Contro per annullare tutto.',
    alias: ['frittata', 'muffin time', 'muffin', 'dieci carte', 'gioco caotico', 'carte assurde', 'frittata time'],
    opzioni: [
      { id: 'iniziali', nome: 'Carte iniziali', valori: [3, 5], etichette: ['3 carte (classico)', '5 carte (partita veloce)'], predefinito: 3 },
      { id: 'tempo', nome: '⏱️ Tempo per i Contro', valori: [8, 5, 12], etichette: ['8 secondi', '5 secondi (frenetico)', '12 secondi (con calma)'], predefinito: 8 },
    ],
    regole: [
      'Ognuno parte con 3 carte. VINCE chi, all\'INIZIO del suo turno, ha in mano ESATTAMENTE 10 carte e preme "FRITTATA!".',
      'Nel tuo turno fai UNA sola cosa: pesca 1 carta, OPPURE gioca una carta AZIONE (gialla), OPPURE piazza coperta una TRAPPOLA (viola, massimo 3 davanti a te).',
      'Le AZIONI fanno pescare, rubare, scartare, regalare, scambiare mani… Quelle con un bersaglio si giocano su un altro giocatore.',
      'Le TRAPPOLE restano coperte e scattano da sole quando succede quello che c\'è scritto: un\'Azione ti prende di mira (Specchio, Cane da guardia), un altro pesca (Retino), un altro grida Frittata (Padella bucata).',
      'I CONTRO (rossi) si giocano FUORI turno: quando qualcuno gioca un\'Azione o scatta una Trappola hai qualche secondo per annullarla. Si può annullare anche un Contro con un altro Contro, a catena.',
      'La "Frittata!" si ferma solo con il Contro "Non è ancora ora!" (o con la Padella bucata). Se viene fermata, il turno continua normalmente.',
      'Se a fine turno hai più di 10 carte, scegli quali scartare e resti con 10: gli altri hanno un giro per cambiartele, se no al tuo turno gridi Frittata!',
      'Quando il mazzo finisce si rimescolano gli scarti. Il computer facile gioca a caso, il medio ferma chi ha 10 carte, il difficile usa meglio trappole e Contro.',
    ],
  },
  crea: (o) => new Frittata(o),
  bot,
  _test: { CARTE, OBIETTIVO, MAX_TRAPPOLE },
};
