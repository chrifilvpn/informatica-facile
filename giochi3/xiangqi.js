// SCACCHI CINESI (xiangqi): scacchiera di 9 colonne × 10 righe, i pezzi stanno sugli incroci. In mezzo c'è il FIUME,
// e ognuno ha un PALAZZO (3×3) da cui il generale e i consiglieri non escono. Pezzi: generale, 2 consiglieri, 2
// elefanti, 2 cavalli, 2 carri, 2 cannoni, 5 soldati. Il rosso muove per primo. Vince chi dà scacco matto, oppure
// chi lascia l'avversario senza mosse (nello xiangqi anche lo stallo è una sconfitta). I due generali non possono
// mai stare sulla stessa colonna senza pezzi in mezzo. Pareggio: stessa posizione tre volte, o 60 mosse a testa senza
// catture.
const ANN = require('../giochi/annulla');

const C = 9, R = 10, N = C * R;
const GEN = 1, CONS = 2, ELE = 3, CAV = 4, CAR = 5, CAN = 6, SOL = 7;
const NOMI = { 1: 'generale', 2: 'consigliere', 3: 'elefante', 4: 'cavallo', 5: 'carro', 6: 'cannone', 7: 'soldato' };
// il rosso ha i pezzi positivi e sta in basso (righe 5-9), il nero negativi in alto (righe 0-4)
function iniziale() {
  const b = new Int8Array(N);
  const fila = [CAR, CAV, ELE, CONS, GEN, CONS, ELE, CAV, CAR];
  fila.forEach((x, c) => { b[c] = -x; b[9 * C + c] = x; });
  for (const c of [1, 7]) { b[2 * C + c] = -CAN; b[7 * C + c] = CAN; }
  for (const c of [0, 2, 4, 6, 8]) { b[3 * C + c] = -SOL; b[6 * C + c] = SOL; }
  return b;
}
const lato = (v) => (v > 0 ? 0 : v < 0 ? 1 : -1); // 0 rosso, 1 nero
const nelPalazzo = (r, c, col) => c >= 3 && c <= 5 && (col === 0 ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
const oltreFiume = (r, col) => (col === 0 ? r <= 4 : r >= 5);
const dentro = (r, c) => r >= 0 && c >= 0 && r < R && c < C;

// mosse "possibili" (senza controllare lo scacco al proprio generale)
function pseudo(b, col) {
  const out = [];
  const amico = (v) => lato(v) === col;
  const add = (da, a) => { if (!amico(b[a])) out.push([da, a]); };
  for (let i = 0; i < N; i++) {
    const v = b[i]; if (lato(v) !== col) continue;
    const t = Math.abs(v), r = Math.floor(i / C), c = i % C;
    if (t === GEN) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (nelPalazzo(rr, cc, col)) add(i, rr * C + cc); }
    else if (t === CONS) for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const rr = r + dr, cc = c + dc; if (nelPalazzo(rr, cc, col)) add(i, rr * C + cc); }
    else if (t === ELE) for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const rr = r + dr, cc = c + dc;
      if (!dentro(rr, cc) || oltreFiume(rr, col) || b[(r + dr / 2) * C + c + dc / 2]) continue;
      add(i, rr * C + cc);
    } else if (t === CAV) for (const [dr, dc, br, bc] of [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (!dentro(rr, cc) || b[(r + br) * C + c + bc]) continue;
      add(i, rr * C + cc);
    } else if (t === CAR || t === CAN) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let rr = r + dr, cc = c + dc, schermo = false;
      while (dentro(rr, cc)) {
        const j = rr * C + cc, x = b[j];
        if (t === CAR) { if (!x) out.push([i, j]); else { if (!amico(x)) out.push([i, j]); break; } }
        else if (!schermo) { if (!x) out.push([i, j]); else schermo = true; }
        else if (x) { if (!amico(x)) out.push([i, j]); break; }
        rr += dr; cc += dc;
      }
    } else if (t === SOL) {
      const avanti = col === 0 ? -1 : 1;
      if (dentro(r + avanti, c)) add(i, (r + avanti) * C + c);
      if (oltreFiume(r, col)) for (const dc of [-1, 1]) if (dentro(r, c + dc)) add(i, r * C + c + dc);
    }
  }
  return out;
}
// il generale di col è sotto scacco? (anche "generali faccia a faccia")
function scacco(b, col) {
  const g = b.indexOf(col === 0 ? GEN : -GEN);
  if (g < 0) return true;
  const altro = b.indexOf(col === 0 ? -GEN : GEN);
  if (altro >= 0 && altro % C === g % C) {
    let libero = true;
    for (let i = Math.min(g, altro) + C; i < Math.max(g, altro); i += C) if (b[i]) { libero = false; break; }
    if (libero) return true;
  }
  for (const [, a] of pseudo(b, 1 - col)) if (a === g) return true;
  return false;
}
function legali(b, col) {
  const out = [];
  for (const [da, a] of pseudo(b, col)) {
    const preso = b[a]; b[a] = b[da]; b[da] = 0;
    if (!scacco(b, col)) out.push([da, a]);
    b[da] = b[a]; b[a] = preso;
  }
  return out;
}
const nomeCasa = (i) => `${'abcdefghi'[i % C]}${R - Math.floor(i / C)}`;

class Xiangqi {
  constructor({ n, primo = 0, opzioni = {}, bot = [] }) {
    this.id = 'xiangqi';
    this.n = n;
    this.rosso = primo;
    this.simboli = ['cinesi', 'italiani'].includes(opzioni.pezzi) ? opzioni.pezzi : 'disegni';
    this.b = Array.from(iniziale());
    this.turno = primo;
    this.nMosse = 0; this.ultima = null; this.senzaPrese = 0; this.posizioni = {}; this.catturati = [[], []];
    this.inAttesa = false; this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    ANN.prepara(this, bot, ['b', 'turno', 'nMosse', 'ultima', 'senzaPrese', 'posizioni', 'catturati']);
  }
  colore(p) { return p === this.rosso ? 0 : 1; }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (a && a.tipo === 'annulla') return ANN.annulla(this, p);
    if (p !== this.turno) return { errore: 'Non è il tuo turno' };
    if (!a || a.tipo !== 'muovi') return { errore: 'Mossa non valida' };
    const da = Number(a.da), dove = Number(a.a), col = this.colore(p);
    const b = Int8Array.from(this.b);
    if (!legali(b, col).some(([x, y]) => x === da && y === dove)) {
      const ps = pseudo(b, col).some(([x, y]) => x === da && y === dove);
      return { errore: ps ? 'Non puoi: lasceresti il tuo generale sotto scacco (o faccia a faccia con l\'altro)' : 'Mossa non valida per quel pezzo' };
    }
    ANN.salva(this, p);
    const preso = this.b[dove];
    this.b[dove] = this.b[da]; this.b[da] = 0;
    this.ultima = { da, a: dove }; this.nMosse++;
    this.senzaPrese = preso ? 0 : this.senzaPrese + 1;
    if (preso) this.catturati[col].push(Math.abs(preso));
    const altro = 1 - col, bb = Int8Array.from(this.b);
    const sottoScacco = scacco(bb, altro), mosseAltro = legali(bb, altro).length;
    this.turno = 1 - p;
    if (!mosseAltro) return this.chiudi(p, sottoScacco ? 'scacco matto' : 'l\'avversario non ha più mosse');
    if (sottoScacco) this.annuncia(p, 'dà scacco al generale!', 'scacco al generale!');
    else if (preso) this.annuncia(p, `mangia ${NOMI[Math.abs(preso)] === 'elefante' ? 'un elefante' : `un ${NOMI[Math.abs(preso)]}`}`, `mangi ${NOMI[Math.abs(preso)] === 'elefante' ? 'un elefante' : `un ${NOMI[Math.abs(preso)]}`}`);
    const k = `${this.b.join(',')}${this.turno}`;
    this.posizioni[k] = (this.posizioni[k] || 0) + 1;
    if (this.posizioni[k] >= 3) return this.chiudi(null, 'la stessa posizione per la terza volta');
    if (this.senzaPrese >= 120) return this.chiudi(null, '60 mosse a testa senza catture');
    return { ok: true };
  }
  chiudi(v, perche) {
    this.finita = true; this.turno = null;
    if (v === null) this.annuncia(null, `Pareggio: ${perche}`, '', true);
    else this.annuncia(v, `vince: ${perche}!`, `hai vinto: ${perche}!`, true);
    this.risultato = { fazioni: [0, 1].map((x) => ({ posti: [x], punti: x === v ? 1 : 0 })), etichetta: 'vittorie', pareggio: v === null, vincitori: v === null ? [] : [v] };
    return { ok: true };
  }
  // trucco segreto (!win): la mossa del computer difficile. La scacchiera non ha coordinate scritte: colonne a-i da
  // sinistra e righe 1-10 dal lato del giocatore (il nero la vede girata)
  suggerimentoWin(p) {
    if (this.finita || this.turno !== p) return null;
    const a = bot(this, p, 'difficile');
    const nero = this.colore(p) === 1;
    const casa = (i) => { const r = Math.floor(i / C), c = i % C; return nero ? `${'abcdefghi'[C - 1 - c]}${r + 1}` : nomeCasa(i); };
    const nomeP = NOMI[Math.abs(this.b[a.da])];
    return `💡 ${nomeP[0].toUpperCase()}${nomeP.slice(1)} ${casa(a.da)} ${this.b[a.a] ? '×' : '→'} ${casa(a.a)} (colonne a-i da sinistra, righe 1-10 dal tuo lato)`;
  }

  vista(p) {
    const mio = this.turno === p && !this.finita;
    const b = Int8Array.from(this.b);
    return {
      gioco: this.id, n: this.n, b: this.b, rosso: this.rosso, simboli: this.simboli, ultima: this.ultima, nMosse: this.nMosse,
      mosse: mio ? legali(b, this.colore(p)) : [], scacco: this.turno != null && scacco(b, this.colore(this.turno)) ? this.turno : null,
      catturati: this.catturati, puoAnnullare: ANN.puo(this, p), annullate: this.annullate,
      turno: this.turno, inAttesa: false, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// =================== COMPUTER ===================
const VAL = { 1: 0, 2: 200, 3: 200, 4: 400, 5: 900, 6: 450, 7: 100 };
function valuta(b, col) {
  let v = 0;
  for (let i = 0; i < N; i++) {
    const x = b[i]; if (!x) continue;
    const t = Math.abs(x), s = lato(x), r = Math.floor(i / C), c = i % C;
    let pv = VAL[t];
    if (t === SOL && oltreFiume(r, s)) pv += 90 + (c >= 2 && c <= 6 ? 20 : 0) - (s === 0 ? r === 0 : r === 9) * 60;
    if (t === CAV || t === CAN) pv += 4 * (4 - Math.abs(c - 4));
    if (t === CAV && oltreFiume(r, s)) pv += 20;
    if (t === CAR && (c === 3 || c === 5 || c === 4)) pv += 10;
    v += s === col ? pv : -pv;
  }
  return v;
}
const MATTO = 1e6;
function ordina(b, mosse) {
  return mosse.map((m) => ({ m, s: b[m[1]] ? 10 * VAL[Math.abs(b[m[1]])] - VAL[Math.abs(b[m[0]])] / 10 : 0 })).sort((x, y) => y.s - x.s).map((x) => x.m);
}
function negamax(b, col, prof, alfa, beta, ctx) {
  // nei test ci si ferma dopo un numero fisso di posizioni (così le partite tra computer vengono sempre uguali)
  if ((++ctx.nodi & 255) === 0 && (process.env.TEST_VELOCE ? ctx.nodi > ctx.maxNodi : Date.now() > ctx.fino)) ctx.stop = true;
  if (ctx.stop) return 0;
  if (prof <= 0) return quieta(b, col, alfa, beta, ctx, 0);
  const mosse = legali(b, col);
  if (!mosse.length) return -MATTO - prof;
  let best = -Infinity;
  for (const [da, a] of ordina(b, mosse)) {
    const preso = b[a]; b[a] = b[da]; b[da] = 0;
    const v = -negamax(b, 1 - col, prof - 1, -beta, -alfa, ctx);
    b[da] = b[a]; b[a] = preso;
    if (ctx.stop) return 0;
    if (v > best) best = v;
    if (best > alfa) alfa = best;
    if (alfa >= beta) break;
  }
  return best;
}
// ricerca "tranquilla": si continuano solo le catture, per non fermarsi a metà di uno scambio
function quieta(b, col, alfa, beta, ctx, d) {
  const fermo = valuta(b, col);
  if (fermo >= beta || d > 4) return fermo;
  if (fermo > alfa) alfa = fermo;
  const catture = pseudo(b, col).filter(([, a]) => b[a]);
  for (const [da, a] of ordina(b, catture)) {
    const preso = b[a]; b[a] = b[da]; b[da] = 0;
    if (scacco(b, col)) { b[da] = b[a]; b[a] = preso; continue; }
    const v = Math.abs(preso) === GEN ? MATTO : -quieta(b, 1 - col, -beta, -alfa, ctx, d + 1);
    b[da] = b[a]; b[a] = preso;
    if (v >= beta) return v;
    if (v > alfa) alfa = v;
  }
  return alfa;
}
// esatti: ogni mossa con la finestra piena (valori veri, servono per scegliere a caso tra le buone); altrimenti
// alfa-beta alla radice (le mosse peggiori hanno solo un limite superiore, ma la migliore è giusta)
function scegli(g, p, profMax, ms, esatti = false) {
  if (process.env.TEST_VELOCE) ms = Math.min(ms, 60);
  const col = g.colore(p), b = Int8Array.from(g.b);
  const fino = Date.now() + ms;
  const ctx = { nodi: 0, stop: false, fino: Infinity, maxNodi: Infinity }; // il primo giro si finisce sempre, il tempo vale dal secondo
  let lista = ordina(b, legali(b, col)).map((m) => ({ m, v: 0 }));
  for (let prof = 1; prof <= profMax; prof++) {
    if (prof === 2) { ctx.fino = fino; ctx.maxNodi = ctx.nodi + 6000; }
    const giro = [];
    let alfa = -Infinity;
    for (const { m } of lista) {
      const [da, a] = m, preso = b[a];
      b[a] = b[da]; b[da] = 0;
      const v = -negamax(b, 1 - col, prof - 1, -Infinity, esatti ? Infinity : -alfa, ctx);
      b[da] = b[a]; b[a] = preso;
      if (ctx.stop) break;
      giro.push({ m, v });
      if (v > alfa) alfa = v;
    }
    if (ctx.stop) break; // si tiene l'ultimo giro completo
    lista = giro.sort((x, y) => y.v - x.v);
  }
  return lista;
}
function bot(g, p, livello) {
  const muovi = ([da, a]) => ({ tipo: 'muovi', da, a });
  if (livello === 'facile') {
    const mosse = legali(Int8Array.from(g.b), g.colore(p));
    if (Math.random() < 0.5) return muovi(mosse[Math.floor(Math.random() * mosse.length)]);
    return muovi(scegli(g, p, 1, 100)[0].m);
  }
  if (livello === 'medio') {
    const l = scegli(g, p, 2, 500, true);
    const buone = l.filter((x) => x.v >= l[0].v - 12);
    return muovi(buone[Math.floor(Math.random() * buone.length)].m);
  }
  return muovi(scegli(g, p, 6, 1500)[0].m);
}

module.exports = {
  meta: {
    id: 'xiangqi',
    pensaLento: true, // il computer difficile pensa a lungo: lo fa in un thread a parte (giochi/pensatore.js)
    nome: 'Scacchi cinesi',
    tipo: 'tabellone',
    giocatori: [2],
    descrizione: 'Lo xiangqi: pezzi sugli incroci, il fiume in mezzo, i palazzi dei generali, i cannoni che mangiano saltando. Dai scacco matto al generale.',
    alias: ['scacchi cinesi', 'xiangqi', 'xiang qi', 'scacchi orientali', 'elefanti e cannoni'],
    opzioni: [
      { id: 'pezzi', nome: 'Pezzi', valori: ['disegni', 'italiani', 'cinesi'], etichette: ['Disegnati', 'Con i nomi italiani', 'Con i caratteri cinesi'], predefinito: 'disegni' },
    ],
    regole: [
      'Scacchiera di 9 colonne e 10 righe: i pezzi stanno sugli INCROCI delle linee. In mezzo c\'è il fiume; in basso e in alto ci sono i palazzi (3×3, con le diagonali). Il rosso muove per primo.',
      'Generale: un passo in orizzontale o verticale, solo dentro il palazzo. Consiglieri: un passo in diagonale, solo dentro il palazzo. I due generali non possono mai guardarsi sulla stessa colonna senza pezzi in mezzo.',
      'Elefanti: due passi esatti in diagonale, non attraversano il fiume e sono bloccati se c\'è un pezzo nel punto di mezzo. Cavalli: un passo dritto e poi uno in diagonale verso l\'esterno; sono bloccati se il punto del passo dritto è occupato.',
      'Carri: come la torre degli scacchi, quanto vogliono in orizzontale o verticale. Cannoni: si muovono come i carri, ma per MANGIARE devono saltare esattamente un pezzo (di qualsiasi colore) lungo la linea.',
      'Soldati: un passo in avanti; dopo aver attraversato il fiume anche un passo di lato. Non tornano mai indietro e non si trasformano.',
      'Si vince con lo scacco matto, oppure se l\'avversario non ha più mosse (nello xiangqi lo stallo è una sconfitta). Non si può fare una mossa che lascia il proprio generale sotto scacco. Pareggio: stessa posizione tre volte, o 60 mosse a testa senza catture.',
      'Comandi: tocca un tuo pezzo (i punti verdi sono le mosse possibili, quelli rossi le catture) e poi l\'incrocio d\'arrivo. I pezzi sono disegnati (corona = generale, ventaglio = consigliere, elefante, cavallo, carro con le ruote, cannone, soldato con scudo e lancia; il nome compare anche tenendo il dito o il mouse sul pezzo); con l\'opzione si possono avere invece le sigle italiane o i caratteri cinesi tradizionali.',
      'Il computer facile gioca quasi a caso; il medio guarda due mosse avanti; il difficile calcola molte mosse avanti seguendo gli scambi fino in fondo. Contro il computer c\'è "↶ Annulla mossa".',
    ],
  },
  crea: (o) => new Xiangqi(o),
  bot,
  _test: { iniziale, pseudo, legali, scacco, valuta, nomeCasa, scegli, C, R },
};
