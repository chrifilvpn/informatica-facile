// BACKGAMMON: 24 punte, 15 pedine a testa, due dadi. Regole complete: tiro d'apertura, doppi giocati quattro volte,
// obbligo di usare tutti e due i dadi se si può (altrimenti il più alto), pedine colpite sulla barra e rientro
// obbligatorio, uscita (bear off) solo con tutte le pedine in casa, gammon e backgammon, cubo del raddoppio facoltativo
// con regola Crawford, partite a 1, 3, 5 o 7 punti.
//
// Ogni giocatore ragiona nella SUA prospettiva: punte 1..24 dalla propria casa (1-6) a quella avversaria (19-24),
// 25 = barra, 0 = fuori. La punta i del giocatore 0 è la punta 25 - i del giocatore 1.
// Il tavolo si tiene come due array (uno per giocatore, ognuno nella sua prospettiva) di 26 numeri.

const CASA = 6;
const dado = () => 1 + Math.floor(Math.random() * 6);
const T = require('../giochi/trucco');
function iniziale() {
  const m = new Array(26).fill(0);
  m[24] = 2; m[13] = 5; m[8] = 3; m[6] = 5;
  return m;
}
const somma = (a) => a.reduce((s, x) => s + x, 0);
const pip = (m) => { let s = 0; for (let i = 1; i <= 25; i++) s += m[i] * i; return s; };

// un passo con il dado d dalla punta s (prospettiva di chi muove). Restituisce la destinazione o -1 se non si può.
function passoLegale(mie, sue, s, d) {
  if (mie[s] <= 0) return -1;
  if (mie[25] > 0 && s !== 25) return -1; // prima si rientra dalla barra
  const t = s - d;
  if (t >= 1) return sue[25 - t] >= 2 ? -1 : t;
  // uscita: tutte le pedine in casa
  for (let i = CASA + 1; i <= 25; i++) if (mie[i] > 0) return -1;
  if (t === 0) return 0;
  // con un numero più alto si esce solo dalla punta più lontana
  for (let i = s + 1; i <= CASA; i++) if (mie[i] > 0) return -1;
  return 0;
}
// applica un passo (modifica gli array); restituisce true se ha colpito
function applica(mie, sue, s, t) {
  mie[s]--;
  if (t === 0) { mie[0]++; return false; }
  mie[t]++;
  if (sue[25 - t] === 1) { sue[25 - t] = 0; sue[25]++; return true; }
  return false;
}

// Tutte le sequenze legali per i dadi: [{ passi: [{ da, a, d }], mie, sue }]. Si tengono solo quelle che usano
// più dadi possibile; se si può usare un solo dado (non doppio) e vanno bene tutti e due, si deve usare il più alto.
function sequenze(mie0, sue0, dadi) {
  const lista = dadi[0] === dadi[1] ? [dadi[0], dadi[0], dadi[0], dadi[0]] : [dadi[0], dadi[1]];
  const out = [];
  const giro = (mie, sue, restanti, passi) => {
    let mosso = false;
    const provati = new Set();
    for (let j = 0; j < restanti.length; j++) {
      const d = restanti[j];
      if (provati.has(d)) continue;
      provati.add(d);
      const altri = restanti.slice(0, j).concat(restanti.slice(j + 1));
      for (let s = 25; s >= 1; s--) {
        if (mie[s] <= 0) continue;
        const t = passoLegale(mie, sue, s, d);
        if (t < 0) continue;
        mosso = true;
        const m2 = mie.slice(), s2 = sue.slice();
        const colpo = applica(m2, s2, s, t);
        giro(m2, s2, altri, [...passi, { da: s, a: t, d, colpo }]);
      }
    }
    if (!mosso) out.push({ passi, mie, sue });
  };
  giro(mie0.slice(), sue0.slice(), lista, []);
  const max = Math.max(0, ...out.map((x) => x.passi.length));
  let buone = out.filter((x) => x.passi.length === max);
  if (max === 1 && dadi[0] !== dadi[1]) {
    const alto = Math.max(...dadi);
    if (buone.some((x) => x.passi[0].d === alto)) buone = buone.filter((x) => x.passi[0].d === alto);
  }
  return buone;
}
// le stesse, una per posizione finale diversa (per il computer)
function posizioniFinali(mie, sue, dadi) {
  const visti = new Map();
  for (const x of sequenze(mie, sue, dadi)) {
    const k = `${x.mie.join(',')}|${x.sue.join(',')}`;
    if (!visti.has(k)) visti.set(k, x);
  }
  return [...visti.values()];
}

class Backgammon {
  constructor({ n, primo = 0, opzioni = {} }) {
    this.id = 'backgammon';
    this.n = 2;
    this.lunghezza = [1, 3, 5, 7].includes(Number(opzioni.punti)) ? Number(opzioni.punti) : 3;
    this.conCubo = !(opzioni.cubo === false || opzioni.cubo === 'false' || opzioni.cubo === 'no');
    this.punti = [0, 0];
    this.nPartita = 0;
    this.crawfordFatta = false;
    this.primo = primo;
    this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.storia = []; // risultati delle partite: { vince, punti, tipo }
    void n;
    this.nuovaPartita();
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  nuovaPartita() {
    this.nPartita++;
    this.t = [iniziale(), iniziale()];
    this.cubo = 1;
    this.padroneCubo = null; // null = al centro (tutti e due possono raddoppiare)
    // Crawford: la partita subito dopo che qualcuno è arrivato a un punto dalla fine si gioca senza cubo
    const crawford = this.conCubo && this.lunghezza > 1 && !this.crawfordFatta && this.punti.some((x) => x === this.lunghezza - 1);
    if (crawford) this.crawfordFatta = true;
    this.crawford = crawford;
    this.fase = 'muovi';
    this.offerta = null;
    this.ultima = null; this.nMossa = 0;
    this.inAttesa = false; this.pausaMs = 1200;
    this.riepilogo = null;
    // tiro d'apertura: un dado a testa, chi fa di più inizia giocando i due numeri
    let a, b;
    do { a = dado(); b = dado(); } while (a === b);
    this.turno = a > b ? 0 : 1;
    this.apertura = { dadi: [a, b] };
    this.iniziaTurno([Math.max(a, b), Math.min(a, b)]);
  }

  puoRaddoppiare(p) {
    return this.conCubo && !this.crawford && !this.finita && this.fase === 'tira' && this.turno === p
      && (this.padroneCubo === null || this.padroneCubo === p) && this.cubo < 64
      && this.punti[p] + this.cubo < this.lunghezza; // inutile raddoppiare se si vince già la sfida col cubo com'è
  }

  iniziaTurno(dadi) {
    const p = this.turno;
    this.dadi = dadi;
    this.base = [this.t[0].slice(), this.t[1].slice()];
    this.passi = [];
    this.legali = sequenze(this.t[p], this.t[1 - p], dadi);
    this.fase = 'muovi';
    if (!this.legali[0].passi.length) {
      // nessuna mossa possibile: il turno passa
      this.annuncia(p, `non può muovere con ${dadi[0]} e ${dadi[1]}`, `non puoi muovere con ${dadi[0]} e ${dadi[1]}`);
      this.fase = 'bloccato';
      this.inAttesa = true; this.pausaMs = 1500;
    }
  }
  // il trucco segreto (!win): tra i 21 tiri possibili quello che, giocato al meglio, lascia la posizione migliore
  // secondo la rete del computer difficile
  // con `peggiori` (il trucco !lose) i dadi che lasciano la posizione peggiore
  dadiMigliori(p, peggiori = false) {
    let best = null, bv = -Infinity;
    for (const { a, b } of TIRI) {
      const fine = posizioniFinali(this.t[p], this.t[1 - p], [a, b]);
      let v = (fine.length && fine[0].passi.length ? Math.max(...fine.map((x) => (x.mie[0] === 15 ? 2 : rete(x.mie, x.sue)))) : -1) + Math.random() * 1e-3;
      if (peggiori) v = -v;
      if (v > bv) { bv = v; best = Math.random() < 0.5 ? [a, b] : [b, a]; }
    }
    return best;
  }
  // passi ancora possibili dopo quelli già fatti
  prossimi() {
    const out = [];
    const k = this.passi.length;
    for (const s of this.legali) {
      if (s.passi.length <= k) continue;
      if (!this.passi.every((x, i) => x.da === s.passi[i].da && x.a === s.passi[i].a && x.d === s.passi[i].d)) continue;
      const q = s.passi[k];
      if (!out.some((y) => y.da === q.da && y.a === q.a && y.d === q.d)) out.push({ da: q.da, a: q.a, d: q.d, colpo: q.colpo });
    }
    return out;
  }

  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (this.inAttesa) return { errore: 'Un attimo…' };
    if (this.fase === 'offerta') {
      if (p !== this.offerta.a) return { errore: 'Aspetta la risposta al raddoppio' };
      if (a.tipo === 'accetta') {
        this.cubo *= 2; this.padroneCubo = p; this.fase = 'tira'; this.turno = this.offerta.da; this.offerta = null;
        this.annuncia(p, `accetta: il cubo vale ${this.cubo}`, `accetti: il cubo vale ${this.cubo}`);
        return { ok: true };
      }
      if (a.tipo === 'rifiuta') {
        this.annuncia(p, 'rifiuta il raddoppio', 'rifiuti il raddoppio');
        return this.fineGioco(1 - p, 1, 'rifiuto');
      }
      return { errore: 'Accetta o rifiuta il raddoppio' };
    }
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (a.tipo === 'raddoppia') {
      if (!this.puoRaddoppiare(p)) return { errore: 'Adesso non puoi raddoppiare' };
      this.fase = 'offerta'; this.offerta = { da: p, a: 1 - p }; this.turno = 1 - p; // risponde l'avversario
      this.annuncia(p, `raddoppia a ${this.cubo * 2}!`, `raddoppi a ${this.cubo * 2}`, true);
      return { ok: true };
    }
    if (a.tipo === 'tira') {
      if (this.fase !== 'tira') return { errore: 'Hai già tirato' };
      this.iniziaTurno(T.consuma(this, p) ? this.dadiMigliori(p) : T.sfortuna(this, p) ? this.dadiMigliori(p, true) : [dado(), dado()]);
      return { ok: true };
    }
    if (this.fase !== 'muovi') return { errore: 'Prima tira i dadi' };
    if (a.tipo === 'passo') {
      const da = Number(a.da), aa = Number(a.a);
      const scelte = this.prossimi().filter((x) => x.da === da && x.a === aa).sort((x, y) => x.d - y.d);
      if (!scelte.length) return { errore: 'Mossa non permessa' };
      this.faiPasso(p, scelte[0]);
      return { ok: true };
    }
    if (a.tipo === 'annulla') {
      if (!this.passi.length) return { errore: 'Niente da annullare' };
      const resto = this.passi.slice(0, -1);
      this.t = [this.base[0].slice(), this.base[1].slice()];
      this.passi = [];
      for (const x of resto) this.faiPasso(p, x);
      return { ok: true };
    }
    if (a.tipo === 'conferma') {
      if (this.prossimi().length) return { errore: 'Devi usare tutti i dadi che puoi' };
      return this.fineTurno(p);
    }
    if (a.tipo === 'gioca') { // la sequenza intera (il computer)
      if (!Array.isArray(a.passi)) return { errore: 'Mossa non valida' };
      for (const x of a.passi) {
        if (!x || typeof x !== 'object') return { errore: 'Mossa non valida' };
        const r = this.azione(p, { tipo: 'passo', da: x.da, a: x.a });
        if (r.errore) return r;
      }
      return this.azione(p, { tipo: 'conferma' });
    }
    return { errore: 'Mossa non valida' };
  }
  faiPasso(p, x) {
    applica(this.t[p], this.t[1 - p], x.da, x.a);
    this.passi.push({ da: x.da, a: x.a, d: x.d });
  }
  fineTurno(p) {
    this.ultima = { n: ++this.nMossa, posto: p, passi: this.passi.slice(), dadi: this.dadi };
    if (this.t[p][0] === 15) return this.vinceGioco(p);
    this.turno = 1 - p;
    this.fase = 'tira';
    this.passi = [];
    return { ok: true };
  }
  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    if (this.fase === 'bloccato') {
      this.ultima = { n: ++this.nMossa, posto: this.turno, passi: [], dadi: this.dadi };
      this.turno = 1 - this.turno; this.fase = 'tira'; this.passi = [];
      return;
    }
    if (this.fase === 'fineGioco') this.nuovaPartita();
  }
  vinceGioco(p) {
    const sue = this.t[1 - p];
    let molt = 1, tipo = 'semplice';
    if (sue[0] === 0) {
      // gammon: l'avversario non ha portato fuori nessuna pedina; backgammon: in più ne ha sulla barra o nella casa del vincitore
      const nellaCasa = sue[25] > 0 || [19, 20, 21, 22, 23, 24].some((i) => sue[i] > 0);
      molt = nellaCasa ? 3 : 2; tipo = nellaCasa ? 'backgammon' : 'gammon';
    }
    return this.fineGioco(p, molt, tipo);
  }
  fineGioco(p, molt, tipo) {
    const vinti = this.cubo * molt;
    this.punti[p] += vinti;
    this.storia.push({ vince: p, punti: vinti, tipo });
    this.riepilogo = { vince: p, punti: vinti, tipo, cubo: this.cubo };
    const nomi = { semplice: '', gammon: ' (gammon!)', backgammon: ' (backgammon!)', rifiuto: '' };
    this.turno = null;
    if (this.punti[p] >= this.lunghezza) {
      this.finita = true; this.fase = 'finita';
      this.annuncia(p, `vince ${vinti} ${vinti === 1 ? 'punto' : 'punti'}${nomi[tipo]} e la sfida!`, `vinci ${vinti} ${vinti === 1 ? 'punto' : 'punti'}${nomi[tipo]} e la sfida!`, true);
      this.risultato = { fazioni: [0, 1].map((i) => ({ posti: [i], punti: this.punti[i] })), etichetta: 'punti', pareggio: false, vincitori: [p] };
      return { ok: true };
    }
    this.annuncia(p, `vince ${vinti} ${vinti === 1 ? 'punto' : 'punti'}${nomi[tipo]}`, `vinci ${vinti} ${vinti === 1 ? 'punto' : 'punti'}${nomi[tipo]}`, tipo !== 'semplice');
    this.fase = 'fineGioco'; this.inAttesa = true; this.pausaMs = 4500;
    return { ok: true };
  }

  vista(p) {
    const io = p === 1 ? 1 : 0;
    const mio = this.turno === io && this.fase === 'muovi' && !this.inAttesa;
    return {
      gioco: this.id, n: 2,
      mie: this.t[io], sue: this.t[1 - io], // ognuno nella sua prospettiva (sue[i] = pedine avversarie sulla SUA punta i)
      dadi: this.dadi, passi: this.turno === io ? this.passi : [], usati: this.passi.map((x) => x.d),
      prossimi: mio ? this.prossimi() : [],
      puoConfermare: mio && !this.prossimi().length,
      puoRaddoppiare: this.puoRaddoppiare(io),
      fase: this.fase, offerta: this.offerta, cubo: this.cubo, padroneCubo: this.padroneCubo, conCubo: this.conCubo, crawford: this.crawford,
      punti: this.punti, lunghezza: this.lunghezza, nPartita: this.nPartita, apertura: this.nMossa === 0 ? this.apertura : null,
      pip: [pip(this.t[0]), pip(this.t[1])],
      ultima: this.ultima, riepilogo: this.riepilogo, storia: this.storia,
      turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
// Colpi diretti e indiretti: le 36 combinazioni di dadi, quante colpiscono la pedina sola sulla punta b (prospettiva
// di chi è colpito) partendo dalle pedine avversarie. Si controllano anche i passaggi intermedi bloccati.
const TIRI = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) TIRI.push({ a, b, peso: a === b ? 1 : 2 });

// probabilità (su 36) che l'avversario colpisca almeno una delle mie pedine sole
function colpibili(mie, sue) {
  // le mie pedine sole fuori casa avversaria… tutte quelle sole sulle punte 1..24
  const sole = [];
  for (let i = 1; i <= 24; i++) if (mie[i] === 1) sole.push(i);
  if (!sole.length) return 0;
  // l'avversario vede la mia punta i come la sua punta 25 - i
  const bersagli = new Set(sole.map((i) => 25 - i));
  const bloccata = (j) => j >= 1 && j <= 24 && mie[25 - j] >= 2; // punta (dell'avversario) j coperta da me
  let colpi = 0;
  for (const { a, b, peso } of TIRI) {
    let colpisce = false;
    const passi = a === b ? [a, a, a, a] : null;
    for (let s = 25; s >= 1 && !colpisce; s--) {
      if (sue[s] <= 0) continue;
      if (sue[25] > 0 && s !== 25) break; // con pedine sulla barra si colpisce solo rientrando
      if (passi) {
        let c = s;
        for (let k = 0; k < 4; k++) { c -= a; if (c < 1 || bloccata(c)) break; if (bersagli.has(c)) { colpisce = true; break; } }
      } else {
        for (const [x, y] of [[a, b], [b, a]]) {
          const c1 = s - x;
          if (c1 >= 1 && !bloccata(c1)) {
            if (bersagli.has(c1)) { colpisce = true; break; }
            if (sue[25] <= 1 || s !== 25) { const c2 = c1 - y; if (c2 >= 1 && !bloccata(c2) && bersagli.has(c2)) { colpisce = true; break; } }
          }
        }
      }
    }
    if (colpisce) colpi += peso;
  }
  return colpi / 36;
}
// c'è ancora contatto (le pedine possono ancora incontrarsi)?
function contatto(mie, sue) {
  let mioMax = 0; for (let i = 25; i >= 1; i--) if (mie[i] > 0) { mioMax = i; break; }
  let suoMax = 0; for (let i = 25; i >= 1; i--) if (sue[i] > 0) { suoMax = i; break; }
  return mioMax + suoMax > 25;
}
// valutazione della posizione per chi ha appena mosso (l'avversario tira); più alto = meglio.
// I pesi (W) sono stati scelti facendo giocare tra loro migliaia di partite con pesi diversi.
const PESI = {
  medio: { pip: 0.8, punte: 1, mucchio: 1.2, fila: 1, barra: 1, miaBarra: 6, soleN: 3, soleL: 1.5, colpi: 0, colpiPip: 0, colpiCasa: 0 },
  // il difficile usa la rete imparata (più sotto); questi pesi con il conteggio esatto dei colpi restano per le prove
  colpi: { pip: 0.8, punte: 1, mucchio: 1.2, fila: 1, barra: 1, miaBarra: 6, soleN: 0, soleL: 0, colpi: 10, colpiPip: 2, colpiCasa: 2 },
};
const PESO_PUNTA = [0, 3, 4, 6, 9, 10, 10, 9, 4, 3, 2, 2, 2, 1.5, 1, 1, 1, 1, 2, 3, 3.5, 4, 4, 3, 2];
const FILA = [0, 0, 1, 4, 9, 16, 25, 25];
function valuta(mie, sue, livello, W = PESI[livello] || PESI.medio) {
  const pm = pip(mie), ps = pip(sue);
  if (!contatto(mie, sue)) {
    // corsa: conta la strada, più un po' le pedine già fuori e quelle ammucchiate male
    let spreco = 0;
    for (let i = 1; i <= 6; i++) if (mie[i] > 3) spreco += (mie[i] - 3) * 0.6;
    return (ps - pm) * 1.0 + mie[0] * 1.5 - spreco - (mie[25] + somma(mie.slice(7, 25))) * 0.2;
  }
  let v = (ps - pm) * W.pip;
  let fila = 0, filaMax = 0;
  for (let i = 1; i <= 24; i++) {
    if (mie[i] >= 2) { v += PESO_PUNTA[i] * W.punte; fila++; filaMax = Math.max(filaMax, fila); } else fila = 0;
    if (mie[i] > 4) v -= (mie[i] - 4) * W.mucchio; // troppe pedine sulla stessa punta
  }
  v += FILA[Math.min(filaMax, 7)] * W.fila; // blocchi di punte di fila (prime)
  // avversario sulla barra con la mia casa chiusa
  if (sue[25] > 0) { let chiuse = 0; for (let i = 1; i <= 6; i++) if (mie[i] >= 2) chiuse++; v += sue[25] * (4 + chiuse * 3) * W.barra; }
  v -= mie[25] * W.miaBarra;
  // pedine sole: quante sono (più pesano quelle vicine alla casa) e quanto rischiano davvero
  for (let i = 1; i <= 24; i++) if (mie[i] === 1) v -= i <= 12 ? W.soleN : W.soleL;
  if (W.colpi) {
    const rischio = colpibili(mie, sue);
    if (rischio) {
      let peggio = 0;
      for (let i = 1; i <= 24; i++) if (mie[i] === 1) peggio = Math.max(peggio, 25 - i);
      let casaSua = 0; for (let i = 19; i <= 24; i++) if (sue[25 - i] >= 2) casaSua++;
      v -= rischio * (W.colpi + peggio * W.colpiPip + casaSua * W.colpiCasa);
    }
  }
  return v;
}
// valutazione imparata (computer difficile): probabilità di vincere di chi ha appena mosso
const RETE = require('./backgammon-pesi');
function rete(mie, sue) {
  const w = contatto(mie, sue) ? RETE.contatto : RETE.corsa;
  let z = 0, k = 0;
  for (let i = 1; i <= 24; i++) {
    for (const a of [mie[i], sue[i]]) {
      if (a >= 1) z += w[k]; if (a >= 2) z += w[k + 1]; if (a >= 3) z += w[k + 2]; if (a > 3) z += w[k + 3] * (a - 3) / 2;
      k += 4;
    }
  }
  z += w[k] * mie[25] / 2 + w[k + 1] * sue[25] / 2 + w[k + 2] * mie[0] / 15 + w[k + 3] * sue[0] / 15 + w[k + 4];
  return 1 / (1 + Math.exp(-z));
}
// probabilità di vincere stimata (per il cubo)
function stimaVittoria(mie, sue, livello, toccaAMe = true) {
  const pm = pip(mie) - (toccaAMe ? 4 : 0), ps = pip(sue);
  if (!contatto(mie, sue)) {
    const x = (ps - pm) / Math.max(10, 0.12 * pm + 4);
    return 1 / (1 + Math.exp(-x * 2.2));
  }
  if (livello === 'difficile') return toccaAMe ? 1 - rete(sue, mie) : rete(mie, sue);
  const v = valuta(mie, sue, livello) - valuta(sue, mie, livello);
  return 1 / (1 + Math.exp(-v / 30));
}

function bot(g, p, livello) {
  if (g.fase === 'offerta') {
    // risponde al raddoppio: accetta se crede di vincere abbastanza spesso
    const pr = stimaVittoria(g.t[p], g.t[1 - p], livello, false);
    const soglia = livello === 'difficile' ? 0.24 : livello === 'medio' ? 0.3 : 0;
    return { tipo: pr >= soglia ? 'accetta' : 'rifiuta' };
  }
  if (g.fase === 'tira') {
    if (livello !== 'facile' && g.puoRaddoppiare(p)) {
      const pr = stimaVittoria(g.t[p], g.t[1 - p], livello, true);
      if ((livello === 'difficile' && pr > 0.7 && pr < 0.95) || (livello === 'medio' && pr > 0.78)) return { tipo: 'raddoppia' };
    }
    return { tipo: 'tira' };
  }
  // tutte le posizioni finali possibili dalla posizione di inizio turno
  const fine = posizioniFinali(g.base[p], g.base[1 - p], g.dadi);
  if (!fine.length || !fine[0].passi.length) return { tipo: 'conferma' };
  let scelta;
  if (livello === 'facile') {
    // a caso, ma colpisce volentieri
    const colpi = fine.filter((x) => x.passi.some((q) => q.colpo));
    scelta = colpi.length && Math.random() < 0.5 ? colpi[Math.floor(Math.random() * colpi.length)] : fine[Math.floor(Math.random() * fine.length)];
  } else if (livello === 'medio') {
    let vm = -Infinity;
    for (const x of fine) { const v = valuta(x.mie, x.sue, livello) + Math.random() * 2; if (v > vm) { vm = v; scelta = x; } }
  } else {
    // difficile: la rete sceglie le mosse migliori, poi per queste guarda un tiro avanti (la risposta migliore
    // dell'avversario su ognuno dei 21 tiri possibili)
    const valori = fine.map((x) => ({ x, v: rete(x.mie, x.sue) })).sort((a, b) => b.v - a.v);
    scelta = valori[0].x;
    const K = Math.min(valori.length, process.env.TEST_VELOCE ? 3 : 5);
    if (K > 1) {
      let vm = -Infinity;
      for (const { x } of valori.slice(0, K)) {
        let atteso = 0;
        for (const { a, b, peso } of TIRI) {
          let best = -1;
          for (const y of posizioniFinali(x.sue, x.mie, [a, b])) { const v = rete(y.mie, y.sue); if (v > best) best = v; }
          if (best < 0) best = 1 - rete(x.mie, x.sue);
          atteso += peso * best;
        }
        const v = 1 - atteso / 36;
        if (v > vm) { vm = v; scelta = x; }
      }
    }
  }
  if (g.passi.length) return { tipo: 'annulla' }; // ricomincia il turno da capo, poi giocherà la sequenza intera
  return { tipo: 'gioca', passi: scelta.passi.map((q) => ({ da: q.da, a: q.a })) };
}

module.exports = {
  meta: {
    id: 'backgammon',
    nome: 'Backgammon',
    tipo: 'tabellone',
    giocatori: [2],
    descrizione: 'Il classico con 15 pedine e due dadi: colpisci, rientra, porta fuori. Con il cubo del raddoppio e le sfide a punti.',
    alias: ['backgammon', 'tavola reale', 'tric trac', 'dadi', 'tavla', 'cubo del raddoppio'],
    opzioni: [
      { id: 'punti', nome: 'Sfida a', valori: [3, 1, 5, 7], etichette: ['3 punti', '1 punto (una partita)', '5 punti', '7 punti'], predefinito: 3 },
      { id: 'cubo', nome: 'Cubo del raddoppio', valori: [true, false], etichette: ['Sì', 'No'], predefinito: true },
    ],
    regole: [
      'Si gioca in due su una tavola di 24 punte, con 15 pedine a testa e due dadi. Le tue pedine girano verso la tua casa, le sei punte in basso a destra (1-6); quelle dell\'avversario nel verso opposto.',
      'Apertura: ognuno tira un dado, chi fa di più inizia giocando i due numeri usciti. Poi si tira a turno.',
      'Ogni dado è una mossa: sposti una pedina di tanti punti quanto il numero (puoi muovere la stessa pedina due volte). Con un doppio giochi quel numero quattro volte. Si deve usare tutti e due i dadi se si può; se si può usarne uno solo, si deve usare il più alto (quando possibile).',
      'Non puoi fermarti su una punta con due o più pedine avversarie. Se ti fermi su una punta con UNA sola pedina avversaria la colpisci: va sulla barra al centro.',
      'Chi ha pedine sulla barra deve prima farle rientrare nella casa avversaria (la punta corrispondente al dado: con il 3 la punta 22), se la punta non è chiusa. Finché non rientrano non può muovere altro.',
      'Quando hai tutte le pedine nella tua casa puoi portarle fuori: con un numero esce la pedina da quella punta; con un numero più alto di tutte le tue pedine esce quella più lontana.',
      'Vince chi porta fuori per primo tutte le pedine: 1 punto; GAMMON (2 punti) se l\'avversario non ne ha portata fuori nessuna, BACKGAMMON (3 punti) se in più ha ancora pedine sulla barra o nella tua casa.',
      'CUBO DEL RADDOPPIO (se attivo): prima di tirare puoi raddoppiare la posta. L\'avversario rifiuta (e perde la partita col valore attuale) o accetta: la posta raddoppia e solo lui potrà raddoppiare la prossima volta. Regola Crawford: la partita subito dopo che uno è arrivato a un punto dalla vittoria si gioca senza cubo.',
      'Sfida a più punti: si giocano partite finché qualcuno arriva ai punti scelti (3 di base, oppure 1, 5, 7).',
      'Come si gioca: premi "Tira" (o la barra spaziatrice), poi clicca una pedina e poi la punta dove portarla (le possibili sono evidenziate). "Annulla" rimette l\'ultima pedina mossa; quando hai usato i dadi premi "Fine turno".',
      'Il computer facile muove quasi a caso (ma colpisce volentieri) e non raddoppia mai; il medio sceglie la mossa che fa più punte e lascia meno pedine sole; il difficile usa una valutazione imparata giocando 80 000 partite contro se stesso, guarda un tiro avanti (la risposta migliore dell\'avversario per ognuno dei 21 tiri possibili) e usa il cubo stimando le sue probabilità di vincere.',
    ],
  },
  crea: (o) => new Backgammon(o),
  bot,
  _test: { PESI, iniziale, sequenze, posizioniFinali, passoLegale, pip, colpibili, valuta, stimaVittoria, contatto, rete },
};
