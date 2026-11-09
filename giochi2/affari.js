// AFFARI IN CITTÀ: il classico gioco di compravendita di terreni con i dadi, da 2 a 6 giocatori.
// Si gira intorno al tabellone di 40 caselle, si comprano città, stazioni e società, si costruiscono case e alberghi
// sui gruppi completi e si fa pagare l'affitto a chi ci si ferma. Chi non riesce più a pagare fa bancarotta;
// vince l'ultimo rimasto (oppure, con il limite di giri, il più ricco).
// Tutto è pubblico tranne l'ordine delle carte. I soldi sono in "€".
const { CASELLE, GRUPPI, DESTINO, SORPRESA } = require('./affari-dati');
const { mescola } = require('../giochi/carte');
const T = require('../giochi/trucco');

const VIA = 200, INIZIO = 1500, PRIGIONE = 10, MULTA = 50, CASE_BANCA = 32, ALBERGHI_BANCA = 12;
const dado = () => 1 + Math.floor(Math.random() * 6);
const ACQUISTABILE = (c) => ['terreno', 'stazione', 'societa'].includes(CASELLE[c].tipo);
const DEL_GRUPPO = {};
CASELLE.forEach((x, i) => { if (x.gruppo) (DEL_GRUPPO[x.gruppo] = DEL_GRUPPO[x.gruppo] || []).push(i); });
const STAZIONI = CASELLE.map((x, i) => (x.tipo === 'stazione' ? i : -1)).filter((i) => i >= 0);
const SOCIETA = CASELLE.map((x, i) => (x.tipo === 'societa' ? i : -1)).filter((i) => i >= 0);
const euro = (x) => `${x} €`;

class Affari {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'affari';
    this.n = n;
    this.limiteGiri = [0, 25, 40].includes(Number(opzioni.giri)) ? Number(opzioni.giri) : 40;
    this.giriMassimi = this.limiteGiri || 150; // anche "fino all'ultimo" si ferma dopo 150 giri
    this.parcheggio = opzioni.parcheggio === true || opzioni.parcheggio === 'true';
    this.soldi = new Array(n).fill(INIZIO);
    this.pos = new Array(n).fill(0);
    this.vivo = new Array(n).fill(true);
    this.inPrigione = new Array(n).fill(-1); // -1 libero, altrimenti tentativi già fatti (0..2)
    this.carteEsci = new Array(n).fill(0);
    this.padrone = new Array(40).fill(null);
    this.case = new Array(40).fill(0);     // 5 = albergo
    this.ipoteca = new Array(40).fill(false);
    this.mazzi = { destino: mescola([...DESTINO.keys()]), sorpresa: mescola([...SORPRESA.keys()]) };
    this.piatto = 0; // soldi sul parcheggio (regola facoltativa)
    this.giro = 1; this.nTurno = 0;
    this.diario = [];
    this.carta = null; this.nCarta = 0;
    this.dadi = null; this.nTiro = 0;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.inAttesa = false; this.pausaMs = 0;
    this.scambio = null; this.asta = null;
    this.proposte = 0;
    this.iniziaTurno(primo % n);
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  scrivi(posto, testo) { this.diario.push({ posto, testo, n: this.diario.length ? this.diario[this.diario.length - 1].n + 1 : 1 }); if (this.diario.length > 12) this.diario.shift(); }
  vivi() { return this.vivo.map((v, i) => (v ? i : -1)).filter((i) => i >= 0); }

  iniziaTurno(p) {
    this.attivo = p; this.turno = p; this.doppi = 0; this.fase = 'tira'; this.tirato = false; this.proposte = 0;
    this.nTurno++;
  }
  prossimo() {
    const vivi = this.vivi();
    if (vivi.length <= 1) return this.chiudi();
    let q = this.attivo;
    do { q = (q + 1) % this.n; } while (!this.vivo[q]);
    if (q <= this.attivo) {
      this.giro++;
      if (this.giro > this.giriMassimi) return this.chiudi();
    }
    this.iniziaTurno(q);
    return { ok: true };
  }

  // ---------- soldi ----------
  patrimonio(p) {
    let v = this.soldi[p];
    for (let c = 0; c < 40; c++) {
      if (this.padrone[c] !== p) continue;
      const x = CASELLE[c];
      v += this.ipoteca[c] ? x.prezzo / 2 : x.prezzo;
      if (this.case[c]) v += this.case[c] * x.casa;
    }
    return v;
  }
  monopolio(c) {
    const g = CASELLE[c].gruppo;
    return !!g && DEL_GRUPPO[g].every((k) => this.padrone[k] === this.padrone[c]);
  }
  affitto(c, sommaDadi, doppio = false, dieciVolte = false) {
    const x = CASELLE[c], pad = this.padrone[c];
    if (x.tipo === 'terreno') return this.case[c] ? x.affitti[this.case[c]] : x.affitti[0] * (this.monopolio(c) ? 2 : 1);
    if (x.tipo === 'stazione') { const k = STAZIONI.filter((s) => this.padrone[s] === pad).length; return 25 * 2 ** (k - 1) * (doppio ? 2 : 1); }
    const k = SOCIETA.filter((s) => this.padrone[s] === pad).length;
    return sommaDadi * (dieciVolte || k === 2 ? 10 : 4);
  }
  casePrese() { let c = 0, a = 0; for (let i = 0; i < 40; i++) { if (this.case[i] === 5) a++; else c += this.case[i]; } return { case: c, alberghi: a }; }
  // vende case e ipoteca finché non ha "importo" in contanti (si toglie prima quello che vale meno)
  liquida(p, importo) {
    while (this.soldi[p] < importo) {
      // una casa da vendere: dalla proprietà con più case del gruppo (per tenerle pari), il gruppo più economico
      let scelta = -1;
      for (let c = 0; c < 40; c++) {
        if (this.padrone[c] !== p || !this.case[c]) continue;
        const max = Math.max(...DEL_GRUPPO[CASELLE[c].gruppo].map((k) => this.case[k]));
        if (this.case[c] !== max) continue;
        if (scelta < 0 || CASELLE[c].casa < CASELLE[scelta].casa) scelta = c;
      }
      if (scelta >= 0) { this.vendiCasa(p, scelta, true); continue; }
      let ip = -1;
      for (let c = 0; c < 40; c++) if (this.padrone[c] === p && !this.ipoteca[c] && (ip < 0 || CASELLE[c].prezzo < CASELLE[ip].prezzo)) ip = c;
      if (ip < 0) break;
      this.ipoteca[ip] = true; this.soldi[p] += CASELLE[ip].prezzo / 2;
      this.scrivi(p, `ipoteca ${CASELLE[ip].nome} per pagare`);
    }
  }
  // p paga importo a chi (null = banca). Se non ha contanti vende e ipoteca; se non basta, bancarotta.
  paga(p, importo, chi = null, alParcheggio = false) {
    if (importo <= 0) return;
    if (this.soldi[p] < importo) this.liquida(p, importo);
    if (this.soldi[p] < importo) return this.bancarotta(p, chi);
    this.soldi[p] -= importo;
    if (chi != null) this.soldi[chi] += importo;
    else if (alParcheggio && this.parcheggio) this.piatto += importo;
    return true;
  }
  bancarotta(p, chi) {
    const resto = this.soldi[p];
    this.soldi[p] = 0;
    this.vivo[p] = false;
    this.annuncia(p, `fa bancarotta! 💸${chi != null ? ` Tutto quello che ha va a @` : ''}`, `hai fatto bancarotta 💸`, true);
    if (chi != null) this.evento.bersaglio = chi;
    for (let c = 0; c < 40; c++) {
      if (this.padrone[c] !== p) continue;
      this.case[c] = 0;
      if (chi != null) this.padrone[c] = chi;
      else { this.padrone[c] = null; this.ipoteca[c] = false; }
    }
    if (chi != null) { this.soldi[chi] += resto; this.carteEsci[chi] += this.carteEsci[p]; }
    this.carteEsci[p] = 0;
    this.inPrigione[p] = -1;
    this.scrivi(p, 'fa bancarotta');
    if (this.vivi().length <= 1) { this.chiudi(); return false; }
    if (p === this.attivo) { this.fase = 'bancarotta'; this.turno = p; this.prossimo(); }
    return false;
  }

  // ---------- movimento ----------
  muovi(p, passi) {
    const da = this.pos[p];
    const a = (da + passi + 40) % 40;
    if (passi > 0 && a < da) { this.soldi[p] += VIA; this.scrivi(p, `passa dal Via: +${euro(VIA)}`); }
    this.pos[p] = a;
    return this.atterra(p);
  }
  vaiA(p, c, viaPagato = true) {
    if (viaPagato && c < this.pos[p]) { this.soldi[p] += VIA; this.scrivi(p, `passa dal Via: +${euro(VIA)}`); }
    this.pos[p] = c;
  }
  inCarcere(p) {
    this.pos[p] = PRIGIONE; this.inPrigione[p] = 0; this.doppi = 0;
    this.annuncia(p, 'va in prigione! 🚔', 'vai in prigione! 🚔');
    this.scrivi(p, 'va in prigione');
  }
  atterra(p, extra = {}) {
    const c = this.pos[p], x = CASELLE[c];
    if (ACQUISTABILE(c)) {
      const pad = this.padrone[c];
      if (pad == null) { this.fase = 'compra'; this.turno = p; return; }
      if (pad !== p && !this.ipoteca[c] && this.vivo[pad]) {
        const somma = this.dadi ? this.dadi[0] + this.dadi[1] : 7;
        const quanto = this.affitto(c, somma, extra.doppio, extra.dieci);
        this.scrivi(p, `paga ${euro(quanto)} di affitto a ${'@' + pad} per ${x.nome}`);
        this.ultimoAffitto = { da: p, a: pad, quanto, c, n: (this.ultimoAffitto ? this.ultimoAffitto.n : 0) + 1 };
        this.paga(p, quanto, pad);
      }
      return;
    }
    if (x.tipo === 'tassa') { this.scrivi(p, `paga ${euro(x.importo)}: ${x.nome}`); this.paga(p, x.importo, null, true); return; }
    if (x.tipo === 'vaiprigione') { this.inCarcere(p); return; }
    if (x.tipo === 'parcheggio' && this.parcheggio && this.piatto) { this.soldi[p] += this.piatto; this.scrivi(p, `prende ${euro(this.piatto)} dal parcheggio`); this.annuncia(p, `prende ${euro(this.piatto)} dal parcheggio! 🅿️`, `prendi ${euro(this.piatto)} dal parcheggio! 🅿️`); this.piatto = 0; return; }
    if (x.tipo === 'destino' || x.tipo === 'sorpresa') return this.pescaCarta(p, x.tipo);
  }
  pescaCarta(p, tipo) {
    const mazzo = this.mazzi[tipo];
    const k = mazzo.shift();
    const carta = (tipo === 'destino' ? DESTINO : SORPRESA)[k];
    this.carta = { tipo, testo: carta.testo, posto: p, n: ++this.nCarta };
    this.scrivi(p, `${tipo === 'destino' ? 'Destino' : 'Sorpresa'}: ${carta.testo}`);
    const e = carta.e;
    if (e.carta) { this.carteEsci[p]++; this.carteEsciDa = this.carteEsciDa || []; this.carteEsciDa.push({ tipo, k }); return; } // non torna nel mazzo finché non si usa
    mazzo.push(k);
    if (e.soldi > 0) this.soldi[p] += e.soldi;
    else if (e.soldi < 0) this.paga(p, -e.soldi, null, true);
    else if (e.vai != null) { this.vaiA(p, e.vai); return this.atterra(p); }
    else if (e.vicina) {
      const lista = e.vicina === 'stazione' ? STAZIONI : SOCIETA;
      const dove = lista.find((s) => s > this.pos[p]) ?? lista[0];
      this.vaiA(p, dove);
      return this.atterra(p, e.vicina === 'stazione' ? { doppio: true } : { dieci: true });
    } else if (e.indietro) { this.pos[p] = (this.pos[p] - e.indietro + 40) % 40; return this.atterra(p); }
    else if (e.prigione) this.inCarcere(p);
    else if (e.riparazioni) {
      let tot = 0;
      for (let c = 0; c < 40; c++) if (this.padrone[c] === p && this.case[c]) tot += this.case[c] === 5 ? e.riparazioni[1] : this.case[c] * e.riparazioni[0];
      this.paga(p, tot, null, true);
    } else if (e.aOgnuno) {
      for (const q of this.vivi()) {
        if (q === p) continue;
        if (e.aOgnuno < 0) { if (this.vivo[p]) this.paga(p, -e.aOgnuno, q); } else this.paga(q, e.aOgnuno, p);
      }
    }
  }
  // dopo una casella risolta: si tira ancora con il doppio, altrimenti si chiude il turno
  dopo() {
    if (this.finita || this.fase === 'compra' || this.fase === 'asta' || this.fase === 'bancarotta') return;
    if (!this.vivo[this.attivo]) return;
    this.turno = this.attivo;
    const doppio = this.dadi && this.dadi[0] === this.dadi[1];
    this.fase = doppio && this.inPrigione[this.attivo] < 0 && this.doppi > 0 ? 'tira' : 'fine';
  }

  // ---------- azioni ----------
  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (this.fase === 'compra') {
      const c = this.pos[p], x = CASELLE[c];
      if (a.tipo === 'compra') {
        if (this.soldi[p] < x.prezzo) return { errore: 'Non hai abbastanza contanti' };
        this.soldi[p] -= x.prezzo; this.padrone[c] = p;
        this.scrivi(p, `compra ${x.nome} per ${euro(x.prezzo)}`);
        if (this.monopolio(c)) this.annuncia(p, `ha tutto il gruppo ${x.gruppo}!`, `hai tutto il gruppo ${x.gruppo}: ora puoi costruire!`);
        this.fase = 'risolto'; this.dopo();
        return { ok: true };
      }
      if (a.tipo === 'asta') return this.apriAsta(c);
      return { errore: 'Compra o metti all\'asta' };
    }
    if (this.fase === 'asta') return this.azioneAsta(p, a);
    if (this.fase === 'scambio') return this.rispondiScambio(p, a);
    // gestione: si può fare prima di tirare e a fine turno
    if (['costruisci', 'vendi', 'ipoteca', 'riscatta', 'proponi'].includes(a.tipo)) {
      if (this.fase !== 'tira' && this.fase !== 'fine') return { errore: 'Adesso non puoi' };
      return this.gestisci(p, a);
    }
    if (this.fase === 'tira') {
      if (this.inPrigione[p] >= 0 && a.tipo === 'pagaPrigione') {
        if (this.soldi[p] < MULTA) return { errore: 'Non hai abbastanza contanti' };
        this.soldi[p] -= MULTA; if (this.parcheggio) this.piatto += MULTA;
        this.inPrigione[p] = -1; this.scrivi(p, `paga ${euro(MULTA)} ed esce di prigione`);
        return { ok: true };
      }
      if (this.inPrigione[p] >= 0 && a.tipo === 'usaCarta') {
        if (!this.carteEsci[p]) return { errore: 'Non hai la carta' };
        this.carteEsci[p]--; this.inPrigione[p] = -1;
        const c = this.carteEsciDa && this.carteEsciDa.shift();
        if (c) this.mazzi[c.tipo].push(c.k);
        this.scrivi(p, 'usa la carta ed esce di prigione');
        return { ok: true };
      }
      if (a.tipo !== 'tira') return { errore: 'Tira i dadi' };
      return this.tira(p, T.consuma(this, p) ? this.dadiMigliori(p) : T.sfortuna(this, p) ? this.dadiMigliori(p, true) : undefined);
    }
    if (this.fase === 'fine') {
      if (a.tipo !== 'fine') return { errore: 'Chiudi il turno' };
      return this.prossimo();
    }
    return { errore: 'Mossa non valida' };
  }
  tira(p, dadi = [dado(), dado()]) {
    this.dadi = dadi; this.nTiro++;
    const somma = dadi[0] + dadi[1], doppio = dadi[0] === dadi[1];
    this.scrivi(p, `tira ${dadi[0]} e ${dadi[1]}`);
    if (this.inPrigione[p] >= 0) {
      if (doppio) {
        this.inPrigione[p] = -1; this.doppi = 0;
        this.scrivi(p, 'fa doppio ed esce di prigione');
        this.muovi(p, somma);
        if (this.attivo === p && !this.finita) this.dopoPrigione();
        return { ok: true };
      }
      this.inPrigione[p]++;
      if (this.inPrigione[p] < 3) { this.fase = 'fine'; return { ok: true }; }
      // al terzo tentativo si paga ed esce
      this.inPrigione[p] = -1;
      this.scrivi(p, `al terzo tentativo paga ${euro(MULTA)} ed esce`);
      this.paga(p, MULTA, null, true);
      if (!this.vivo[p] || this.attivo !== p) return { ok: true };
      this.muovi(p, somma);
      if (this.attivo === p && !this.finita) this.dopoPrigione();
      return { ok: true };
    }
    if (doppio) {
      this.doppi++;
      if (this.doppi === 3) { this.inCarcere(p); this.fase = 'fine'; return { ok: true }; }
    } else this.doppi = 0;
    this.muovi(p, somma);
    if (this.attivo === p && !this.finita) this.dopo(); // (se ha fatto bancarotta il turno è già passato)
    return { ok: true };
  }
  // il trucco segreto (!win): i dadi che portano p sulla casella migliore (una proprietà libera che gli conviene,
  // niente affitti, tasse o prigione; in prigione un doppio per uscire)
  // con `peggiori` (il trucco !lose) i dadi che portano nella casella peggiore
  dadiMigliori(p, peggiori = false) {
    let best = null, bv = -Infinity;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
      const doppio = a === b, s = a + b, c = (this.pos[p] + s) % 40, x = CASELLE[c];
      let v = Math.random();
      if (this.inPrigione[p] >= 0 && !doppio) v -= 500;
      else if (this.inPrigione[p] < 0 && doppio && this.doppi === 2) v -= 1000;
      else {
        if (doppio) v += 15;
        if (this.pos[p] + s >= 40) v += VIA / 4;
        if (ACQUISTABILE(c)) {
          const pad = this.padrone[c];
          if (pad == null) v += this.soldi[p] >= x.prezzo ? valore(this, p, c, 'difficile') : 0;
          else if (pad !== p && !this.ipoteca[c]) v -= this.affitto(c, s, false, false) * 2;
        } else if (x.tipo === 'tassa') v -= x.importo;
        else if (x.tipo === 'vaiprigione') v -= 400;
        else if (x.tipo === 'parcheggio' && this.parcheggio) v += this.piatto;
      }
      if (peggiori) v = -v;
      if (v > bv) { bv = v; best = [a, b]; }
    }
    return best;
  }
  // uscendo di prigione col doppio non si ritira
  dopoPrigione() {
    if (this.finita || this.fase === 'compra' || this.fase === 'asta' || !this.vivo[this.attivo] || this.fase === 'bancarotta') return;
    this.turno = this.attivo; this.fase = 'fine';
  }

  // ---------- asta ----------
  apriAsta(c) {
    const ordine = [];
    for (let k = 1; k <= this.n; k++) { const q = (this.attivo + k) % this.n; if (this.vivo[q]) ordine.push(q); }
    this.asta = { c, offerta: 0, migliore: null, in: ordine, i: 0, n: 0 };
    this.fase = 'asta'; this.turno = ordine[0];
    this.scrivi(this.attivo, `mette all'asta ${CASELLE[c].nome}`);
    return { ok: true };
  }
  azioneAsta(p, a) {
    const s = this.asta;
    if (a.tipo === 'offri') {
      const x = Number(a.importo);
      if (!Number.isInteger(x) || x <= s.offerta) return { errore: `Devi offrire più di ${euro(s.offerta)}` };
      if (x > this.soldi[p]) return { errore: 'Non hai abbastanza contanti' };
      s.offerta = x; s.migliore = p; s.n++;
      this.scrivi(p, `offre ${euro(x)}`);
    } else if (a.tipo === 'passa') {
      s.in = s.in.filter((q) => q !== p);
      s.i--;
    } else return { errore: 'Offri o passa' };
    if (!s.in.length || (s.in.length === 1 && s.migliore === s.in[0])) return this.chiudiAsta();
    s.i = (s.i + 1 + s.in.length) % s.in.length;
    this.turno = s.in[s.i];
    return { ok: true };
  }
  chiudiAsta() {
    const s = this.asta;
    if (s.migliore != null) {
      this.soldi[s.migliore] -= s.offerta; this.padrone[s.c] = s.migliore;
      this.scrivi(s.migliore, `vince l'asta di ${CASELLE[s.c].nome} con ${euro(s.offerta)}`);
      this.annuncia(s.migliore, `si aggiudica ${CASELLE[s.c].nome} per ${euro(s.offerta)}`, `ti aggiudichi ${CASELLE[s.c].nome} per ${euro(s.offerta)}`);
    } else this.scrivi(this.attivo, `nessuno vuole ${CASELLE[s.c].nome}`);
    this.asta = null;
    this.fase = 'risolto';
    this.turno = this.attivo;
    if (this.inPrigione[this.attivo] < 0 && this.dadi && this.dadi[0] === this.dadi[1] && this.doppi > 0) this.fase = 'tira'; else this.fase = 'fine';
    return { ok: true };
  }

  // ---------- costruire, ipotecare, scambiare ----------
  puoCostruire(p, c) {
    const x = CASELLE[c];
    if (x.tipo !== 'terreno' || this.padrone[c] !== p || !this.monopolio(c)) return 'Ti serve tutto il gruppo';
    const gr = DEL_GRUPPO[x.gruppo];
    if (gr.some((k) => this.ipoteca[k])) return 'Il gruppo ha una città ipotecata';
    if (this.case[c] >= 5) return 'C\'è già l\'albergo';
    if (this.case[c] > Math.min(...gr.map((k) => this.case[k]))) return 'Costruisci in modo pari sul gruppo';
    if (this.soldi[p] < x.casa) return 'Non hai abbastanza contanti';
    const b = this.casePrese();
    if (this.case[c] === 4 && b.alberghi >= ALBERGHI_BANCA) return 'La banca ha finito gli alberghi';
    if (this.case[c] < 4 && b.case >= CASE_BANCA) return 'La banca ha finito le case';
    return null;
  }
  vendiCasa(p, c, auto = false) {
    const x = CASELLE[c];
    if (this.case[c] === 5) {
      // vendendo l'albergo tornano 4 case: se la banca non le ha, si scende di più (e si incassa di più)
      const libere = CASE_BANCA - this.casePrese().case;
      const resta = Math.min(4, libere);
      this.soldi[p] += (5 - resta) * x.casa / 2;
      this.case[c] = resta;
    } else {
      this.case[c]--;
      this.soldi[p] += x.casa / 2;
    }
    if (!auto) this.scrivi(p, `vende una casa a ${x.nome}`);
    else this.scrivi(p, `vende una casa a ${x.nome} per pagare`);
  }
  gestisci(p, a) {
    const c = Number(a.casella);
    if (a.tipo !== 'proponi' && (!Number.isInteger(c) || c < 0 || c >= 40 || this.padrone[c] !== p)) return { errore: 'Non è tua' };
    const x = CASELLE[c];
    if (a.tipo === 'costruisci') {
      const e = this.puoCostruire(p, c);
      if (e) return { errore: e };
      this.soldi[p] -= x.casa; this.case[c]++;
      this.scrivi(p, `costruisce ${this.case[c] === 5 ? 'un albergo' : 'una casa'} a ${x.nome}`);
      return { ok: true };
    }
    if (a.tipo === 'vendi') {
      if (!this.case[c]) return { errore: 'Non ci sono case' };
      if (this.case[c] < Math.max(...DEL_GRUPPO[x.gruppo].map((k) => this.case[k]))) return { errore: 'Vendi in modo pari sul gruppo' };
      this.vendiCasa(p, c);
      return { ok: true };
    }
    if (a.tipo === 'ipoteca') {
      if (this.ipoteca[c]) return { errore: 'È già ipotecata' };
      if (x.gruppo && DEL_GRUPPO[x.gruppo].some((k) => this.case[k])) return { errore: 'Prima vendi le case del gruppo' };
      this.ipoteca[c] = true; this.soldi[p] += x.prezzo / 2;
      this.scrivi(p, `ipoteca ${x.nome} (+${euro(x.prezzo / 2)})`);
      return { ok: true };
    }
    if (a.tipo === 'riscatta') {
      if (!this.ipoteca[c]) return { errore: 'Non è ipotecata' };
      const costo = Math.ceil(x.prezzo * 0.55);
      if (this.soldi[p] < costo) return { errore: 'Non hai abbastanza contanti' };
      this.soldi[p] -= costo; this.ipoteca[c] = false;
      this.scrivi(p, `riscatta ${x.nome} (-${euro(costo)})`);
      return { ok: true };
    }
    // proponi uno scambio
    const q = Number(a.a);
    if (!Number.isInteger(q) || q < 0 || q >= this.n || q === p || !this.vivo[q]) return { errore: 'Scegli con chi scambiare' };
    if (this.proposte >= 3) return { errore: 'Basta proposte per questo turno' };
    const pulisci = (o) => ({ soldi: Math.max(0, Math.floor(Number(o && o.soldi) || 0)), caselle: [...new Set((o && Array.isArray(o.caselle) ? o.caselle : []).map(Number))] });
    const dai = pulisci(a.dai), chiedi = pulisci(a.chiedi);
    const valida = (o, chi) => o.caselle.every((k) => Number.isInteger(k) && k >= 0 && k < 40 && this.padrone[k] === chi && !(CASELLE[k].gruppo && DEL_GRUPPO[CASELLE[k].gruppo].some((j) => this.case[j]))) && o.soldi <= this.soldi[chi];
    if (!valida(dai, p)) return { errore: 'Puoi dare solo cose tue, senza case sul gruppo, e i soldi che hai' };
    if (!valida(chiedi, q)) return { errore: 'Puoi chiedere solo cose sue, senza case sul gruppo, e i soldi che ha' };
    if (!dai.caselle.length && !chiedi.caselle.length) return { errore: 'Nello scambio ci deve essere almeno una proprietà' };
    this.proposte++;
    this.scambio = { da: p, a: q, dai, chiedi, fase: this.fase, n: (this.scambio ? this.scambio.n : 0) + 1 };
    this.fase = 'scambio'; this.turno = q;
    this.scrivi(p, `propone uno scambio a @${q}`);
    return { ok: true };
  }
  rispondiScambio(p, a) {
    const s = this.scambio;
    if (a.tipo === 'accetta') {
      const ok = (o, chi) => o.caselle.every((k) => this.padrone[k] === chi) && o.soldi <= this.soldi[chi];
      if (ok(s.dai, s.da) && ok(s.chiedi, s.a)) {
        for (const k of s.dai.caselle) this.padrone[k] = s.a;
        for (const k of s.chiedi.caselle) this.padrone[k] = s.da;
        this.soldi[s.da] += s.chiedi.soldi - s.dai.soldi;
        this.soldi[s.a] += s.dai.soldi - s.chiedi.soldi;
        this.scrivi(p, 'accetta lo scambio');
        this.annuncia(p, 'accetta lo scambio 🤝', 'hai accettato lo scambio 🤝');
      }
    } else if (a.tipo === 'rifiuta') this.scrivi(p, 'rifiuta lo scambio');
    else return { errore: 'Accetta o rifiuta lo scambio' };
    this.ultimoScambio = { ...s, accettato: a.tipo === 'accetta' };
    this.fase = s.fase; this.turno = s.da; this.scambio = null;
    return { ok: true };
  }

  chiudi() {
    this.finita = true; this.turno = null; this.fase = 'finita';
    const pat = this.soldi.map((_, i) => (this.vivo[i] ? this.patrimonio(i) : 0));
    const vivi = this.vivi();
    let v;
    if (vivi.length === 1) v = vivi[0];
    else v = pat.indexOf(Math.max(...pat));
    this.annuncia(v, vivi.length === 1 ? 'è l\'ultimo rimasto e vince! 🏆' : `è il più ricco (${euro(pat[v])}) e vince! 🏆`, vivi.length === 1 ? 'sei l\'ultimo rimasto: hai vinto! 🏆' : 'sei il più ricco: hai vinto! 🏆', true);
    this.risultato = { fazioni: pat.map((x, i) => ({ posti: [i], punti: x })), etichetta: '€ di patrimonio', pareggio: false, vincitori: [v] };
    return { ok: true };
  }

  vista(p) {
    return {
      gioco: this.id, n: this.n, soldi: this.soldi, pos: this.pos, vivo: this.vivo, inPrigione: this.inPrigione, carteEsci: this.carteEsci,
      padrone: this.padrone, case: this.case, ipoteca: this.ipoteca, patrimonio: this.soldi.map((_, i) => this.patrimonio(i)),
      attivo: this.attivo, fase: this.fase, dadi: this.dadi, nTiro: this.nTiro, doppi: this.doppi,
      asta: this.asta, scambio: this.scambio, ultimoScambio: this.ultimoScambio || null, carta: this.carta, diario: this.diario,
      ultimoAffitto: this.ultimoAffitto || null,
      piatto: this.piatto, conParcheggio: this.parcheggio, giro: Math.min(this.giro, this.limiteGiri || this.giro), limiteGiri: this.limiteGiri,
      costruibili: this.turno === p && (this.fase === 'tira' || this.fase === 'fine') ? this.padrone.map((x, c) => (x === p && !this.puoCostruire(p, c) ? c : -1)).filter((c) => c >= 0) : [],
      banca: this.casePrese(),
      turno: this.turno, inAttesa: false, pausaMs: 0, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
// valore di una proprietà per p (per l'asta e gli scambi): prezzo, più molto se completa un gruppo, più se toglie
// un gruppo a un avversario
function valore(g, p, c, livello) {
  const x = CASELLE[c];
  let v = x.prezzo;
  if (livello === 'facile') return v * 0.9;
  const gruppo = x.gruppo ? DEL_GRUPPO[x.gruppo] : x.tipo === 'stazione' ? STAZIONI : SOCIETA;
  const mie = gruppo.filter((k) => k !== c && g.padrone[k] === p).length;
  const altri = gruppo.filter((k) => k !== c && g.padrone[k] != null && g.padrone[k] !== p);
  if (x.gruppo && mie === gruppo.length - 1) v *= livello === 'difficile' ? 2.2 : 1.6; // completa il gruppo
  else if (mie) v *= 1.25;
  // a uno solo manca questa: comprandola lo si blocca
  if (x.gruppo && altri.length === gruppo.length - 1 && new Set(altri.map((k) => g.padrone[k])).size === 1) v *= livello === 'difficile' ? 1.7 : 1.3;
  if (x.tipo === 'stazione') v *= 1 + 0.2 * mie;
  if (livello === 'difficile' && ['arancione', 'rosso'].includes(x.gruppo)) v *= 1.15; // i gruppi dove ci si ferma di più
  return v;
}
// riserva di contanti da tenere: quanto può costare il peggior affitto in giro
function riserva(g, p, livello) {
  if (livello === 'facile') return 0;
  let max = 0;
  for (let c = 0; c < 40; c++) if (g.padrone[c] != null && g.padrone[c] !== p && !g.ipoteca[c]) max = Math.max(max, g.affitto(c, 7));
  return Math.min(livello === 'difficile' ? 0.8 * max : max, 600) + (livello === 'medio' ? 50 : 0);
}
// piccola gestione: costruire (pari), riscattare; restituisce un'azione o null
function gestione(g, p, livello) {
  if (livello === 'facile' && Math.random() < 0.5) return null;
  const ris = riserva(g, p, livello);
  // costruire: prima i gruppi migliori, fino a 3 case (il salto di affitto più grande), poi oltre se avanza
  const ordine = ['arancione', 'rosso', 'giallo', 'azzurro', 'rosa', 'verde', 'blu', 'marrone'];
  const cand = [];
  for (let c = 0; c < 40; c++) if (!g.puoCostruire(p, c)) cand.push(c);
  cand.sort((a, b) => g.case[a] - g.case[b] || ordine.indexOf(CASELLE[a].gruppo) - ordine.indexOf(CASELLE[b].gruppo));
  for (const c of cand) {
    const limite = livello === 'difficile' ? (g.case[c] >= 3 ? ris + 150 : ris) : ris + 100;
    if (g.soldi[p] - CASELLE[c].casa >= limite) return { tipo: 'costruisci', casella: c };
  }
  // riscattare le ipoteche quando avanza tanto
  for (let c = 0; c < 40; c++) if (g.padrone[c] === p && g.ipoteca[c] && g.soldi[p] - CASELLE[c].prezzo * 0.55 > ris + 300) return { tipo: 'riscatta', casella: c };
  // per costruire su un gruppo completo conviene ipotecare le proprietà sparse (solo il difficile)
  if (livello === 'difficile' && cand.length === 0) {
    const gruppiCompleti = new Set();
    for (let c = 0; c < 40; c++) if (g.padrone[c] === p && CASELLE[c].gruppo && g.monopolio(c) && !DEL_GRUPPO[CASELLE[c].gruppo].some((k) => g.ipoteca[k]) && g.case[c] < 3) gruppiCompleti.add(CASELLE[c].gruppo);
    if (gruppiCompleti.size && g.soldi[p] < 300) {
      for (let c = 0; c < 40; c++) {
        if (g.padrone[c] !== p || g.ipoteca[c] || g.case[c]) continue;
        const x = CASELLE[c];
        if (x.gruppo && (gruppiCompleti.has(x.gruppo) || DEL_GRUPPO[x.gruppo].some((k) => g.case[k]))) continue;
        if (x.gruppo && DEL_GRUPPO[x.gruppo].filter((k) => g.padrone[k] === p).length > 1) continue; // quasi completo: si tiene
        return { tipo: 'ipoteca', casella: c };
      }
    }
  }
  return null;
}
// proposta di scambio per completare un gruppo: prima uno scambio alla pari in cui tutti e due completano un gruppo,
// altrimenti si compra la carta che manca
function propostaScambio(g, p, livello) {
  const manca = []; // [carta che manca, a chi]
  for (const lista of Object.values(DEL_GRUPPO)) {
    const mie = lista.filter((k) => g.padrone[k] === p);
    if (mie.length !== lista.length - 1 || lista.some((k) => g.case[k])) continue;
    const k = lista.find((j) => g.padrone[j] !== p);
    if (g.padrone[k] != null && g.vivo[g.padrone[k]]) manca.push([k, g.padrone[k]]);
  }
  for (const [k, q] of manca) {
    // a q manca una mia carta per completare un suo gruppo?
    for (const lista of Object.values(DEL_GRUPPO)) {
      const sue = lista.filter((j) => g.padrone[j] === q);
      if (sue.length !== lista.length - 1 || lista.some((j) => g.case[j])) continue;
      const mia = lista.find((j) => g.padrone[j] !== q);
      if (g.padrone[mia] !== p) continue;
      const diff = Math.max(0, Math.round((CASELLE[k].prezzo - CASELLE[mia].prezzo) / 10) * 10);
      if (g.soldi[p] < diff) continue;
      return { tipo: 'proponi', a: q, dai: { soldi: diff, caselle: [mia] }, chiedi: { soldi: 0, caselle: [k] } };
    }
    const offerta = Math.round(CASELLE[k].prezzo * (livello === 'difficile' ? 2.4 : 1.8) / 10) * 10;
    if (g.soldi[p] - offerta >= 150) return { tipo: 'proponi', a: q, dai: { soldi: offerta, caselle: [] }, chiedi: { soldi: 0, caselle: [k] } };
  }
  return null;
}
// risposta a uno scambio: valore di quello che si riceve meno quello che si dà
function valutaScambio(g, p, s, livello) {
  if (livello === 'facile') return Math.random() < 0.5;
  let v = s.dai.soldi - s.chiedi.soldi;
  for (const k of s.dai.caselle) v += valore(g, p, k, livello);
  // ricevo anch'io un gruppo completo? allora regalarne uno all'altro è accettabile
  const completoIo = s.dai.caselle.some((k) => CASELLE[k].gruppo && DEL_GRUPPO[CASELLE[k].gruppo].every((j) => j === k || g.padrone[j] === p));
  for (const k of s.chiedi.caselle) {
    v -= valore(g, p, k, livello);
    // il difficile non regala un gruppo completo all'altro (se non ne riceve uno anche lui)
    if (livello === 'difficile' && CASELLE[k].gruppo && !completoIo) {
      const lista = DEL_GRUPPO[CASELLE[k].gruppo];
      if (lista.every((j) => j === k || g.padrone[j] === s.da)) v -= CASELLE[k].prezzo * 2.5;
    }
  }
  return v > (livello === 'difficile' ? 40 : 0);
}

function bot(g, p, livello) {
  if (g.fase === 'scambio') return { tipo: valutaScambio(g, p, g.scambio, livello) ? 'accetta' : 'rifiuta' };
  if (g.fase === 'asta') {
    const s = g.asta;
    // il difficile in due alle aste non tiene riserva e non ha un tetto fisso: offre a scatti fino a poco più del prezzo
    // (provato con migliaia di partite, è il modo che vince di più in due; in più giocatori va meglio quello prudente);
    // il medio tiene metà della riserva
    const tetto = livello === 'difficile' && g.n === 2 ? Math.min(g.soldi[p], valore(g, p, s.c, 'facile') * (0.6 + Math.random() * 0.6))
      : Math.min(g.soldi[p] - (livello === 'facile' ? 0 : riserva(g, p, livello) * 0.5), valore(g, p, s.c, livello) * (livello === 'facile' ? 0.6 + Math.random() * 0.6 : 1));
    const passo = s.offerta < 100 ? 10 : 20;
    if (s.migliore !== p && s.offerta + passo <= tetto) return { tipo: 'offri', importo: s.offerta + passo };
    return { tipo: 'passa' };
  }
  if (g.fase === 'compra') {
    const c = g.pos[p], x = CASELLE[c];
    if (g.soldi[p] < x.prezzo) return { tipo: 'asta' };
    if (livello === 'facile') return { tipo: Math.random() < 0.7 ? 'compra' : 'asta' };
    const resta = g.soldi[p] - x.prezzo;
    const vale = valore(g, p, c, livello);
    // il difficile in due compra solo se gli resta la riserva intera (o se la carta vale molto): le altre vanno all'asta,
    // dove spesso si prendono a meno
    if (livello === 'difficile') return { tipo: resta >= riserva(g, p, livello) * (g.n === 2 ? 1.2 : 0.6) || vale > x.prezzo * 1.5 ? 'compra' : 'asta' };
    return { tipo: resta >= riserva(g, p, livello) ? 'compra' : 'asta' };
  }
  if (g.fase === 'tira' || g.fase === 'fine') {
    const m = gestione(g, p, livello);
    if (m) return m;
    if (g.fase === 'fine' && livello !== 'facile' && g.proposte < 1 && (livello === 'difficile' || Math.random() < 0.3)) { const s = propostaScambio(g, p, livello); if (s) return s; }
    if (g.fase === 'fine') return { tipo: 'fine' };
    if (g.inPrigione[p] >= 0) {
      // all'inizio conviene uscire subito; quando il tabellone è pieno di case conviene restare dentro
      const pericolo = g.case.reduce((s, x, c) => s + (x && g.padrone[c] !== p ? x : 0), 0);
      if (g.carteEsci[p] && (livello !== 'difficile' || pericolo < 8)) return { tipo: 'usaCarta' };
      if (g.soldi[p] >= MULTA + (livello === 'facile' ? 0 : 100) && (livello === 'facile' ? Math.random() < 0.5 : livello === 'medio' || pericolo < 8)) return { tipo: 'pagaPrigione' };
    }
    return { tipo: 'tira' };
  }
  return { tipo: 'fine' };
}

module.exports = {
  meta: {
    id: 'affari',
    nome: 'Affari in città',
    tipo: 'tabellone',
    giocatori: [2, 3, 4, 5, 6],
    descrizione: 'Compra le città d\'Italia, costruisci case e alberghi e fai pagare l\'affitto agli altri. Con aste, ipoteche, scambi e prigione.',
    alias: ['monopoli', 'monopoly', 'affari', 'compravendita', 'case e alberghi', 'tabellone', 'immobiliare'],
    opzioni: [
      { id: 'giri', nome: 'Durata', valori: [40, 25, 0], etichette: ['40 giri (vince il più ricco)', '25 giri (più veloce)', 'Fino all\'ultimo rimasto'], predefinito: 40 },
      { id: 'parcheggio', nome: 'Soldi sul parcheggio', valori: [false, true], etichette: ['No (regola classica)', 'Sì: tasse e multe al parcheggio'], predefinito: false },
    ],
    regole: [
      'Da 2 a 6 giocatori, ognuno parte dal Via con 1500 €. A turno si tirano due dadi e si avanza; ogni volta che passi (o ti fermi) sul Via ritiri 200 €.',
      'Se ti fermi su una città, una stazione o una società libera puoi comprarla al prezzo scritto. Se non la vuoi (o non hai i soldi) va all\'asta: tutti, anche tu, offrono a turno e se la prende chi offre di più.',
      'Se ti fermi su una proprietà di un altro paghi l\'affitto. Città: l\'affitto scritto, doppio se il padrone ha tutto il gruppo dello stesso colore, molto di più con case e albergo. Stazioni: 25, 50, 100 o 200 € a seconda di quante ne ha il padrone. Società: 4 volte i dadi (10 volte se ha tutte e due). Sulle proprietà ipotecate non si paga.',
      'Con tutto un gruppo puoi costruire case (fino a 4) e poi l\'albergo, in modo pari: una casa su ogni città prima di metterne una seconda. La banca ha solo 32 case e 12 alberghi. Le case si rivendono a metà prezzo; vendendo un albergo tornano 4 case (se la banca non le ha, se ne tengono di meno).',
      'Ipoteca: una proprietà senza case sul gruppo si può ipotecare per metà del prezzo; per riscattarla si paga la metà più il 10%.',
      'Doppio: tiri di nuovo. Tre doppi di fila e vai in prigione. Si va in prigione anche dalla casella "In prigione!" e con alcune carte. In prigione puoi pagare 50 € o usare la carta "Esci gratis", oppure provare a fare doppio: hai tre tentativi, poi paghi ed esci. Fermarsi sulla Prigione per caso non conta (sei in visita).',
      'Sorpresa e Destino: si pesca una carta e si fa quello che dice (vai a, paga, ritira, riparazioni…). Tasse: 200 € e 100 € alla banca (o sul parcheggio, se si sceglie quella regola: chi si ferma sul Parcheggio prende tutto).',
      'Scambi: al tuo turno, prima di tirare o alla fine, puoi proporre a un altro uno scambio di proprietà (senza case sul gruppo) e soldi; l\'altro accetta o rifiuta.',
      'Se devi pagare più di quello che hai in contanti, il gioco vende da solo le tue case e ipoteca le proprietà (prima quelle che valgono meno). Se non basta fai bancarotta: tutto quello che hai va a chi dovevi pagare (o torna alla banca) e sei fuori.',
      'Vince l\'ultimo rimasto; con il limite di giri (40 o 25) vince chi alla fine ha il patrimonio più alto (contanti, proprietà e case al loro prezzo, le ipotecate a metà). Anche "fino all\'ultimo rimasto" si ferma comunque dopo 150 giri.',
      'Il computer facile compra un po\' a caso, offre poco alle aste e costruisce quando capita; il medio tiene una riserva di contanti e costruisce sui gruppi completi; il difficile valuta ogni proprietà (gruppi da completare, gruppi da bloccare agli altri), costruisce subito fino a 3 case, ipoteca le proprietà sparse per costruire, propone scambi per completare i gruppi e non ne regala mai uno agli altri.',
    ],
  },
  crea: (o) => new Affari(o),
  bot,
  _test: { CASELLE, DEL_GRUPPO, valore },
};
