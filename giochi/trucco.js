// IL TRUCCO SEGRETO: chi scrive in chat "!win + parola segreta" (al tavolo, durante una partita) non manda nessun messaggio e
// nessuno viene avvisato: nella prossima mano / giro / round la fortuna gira dalla sua parte, oppure gli compare per
// qualche secondo un suggerimento segreto (la mossa migliore, la parola giusta, chi è l'alieno…) che poi sparisce.
//
// Come lo usa un gioco:
// - FORTUNA: nel punto in cui si mescola, si pesca, si tira o si gira, `T.consuma(this, posto)` dice se quel posto ha
//   il trucco attivo (e lo spegne: vale una volta sola). Se sì, il gioco trucca quel risultato.
//   `T.armato(this, posto)` lo guarda senza spegnerlo (es. nei giochi in tempo reale che lo usano per tutto un round).
// - SUGGERIMENTO: il gioco ha un metodo `suggerimentoWin(posto)` che restituisce il testo da mostrare (o null se in
//   quel momento non ha senso, per esempio non è il turno di quel giocatore). Il server lo chiama dopo ogni
//   aggiornamento finché il trucco è attivo; appena c'è un testo lo manda solo a quel giocatore e spegne il trucco.
// - In qualsiasi momento il gioco può mandare un messaggio segreto con `T.sussurra(this, posto, testo)`.
// - `trucco(posto)` (facoltativo) viene chiamato subito quando il comando arriva, per gli effetti immediati.

// La parola segreta NON è nel codice: si legge da TRUCCO_PAROLA (variabile d'ambiente su Render, come GEMINI_API_KEY).
// Senza la variabile il trucco è spento. Maiuscole, accenti e spazi non contano: "!win  Parola" vale come "!win parola".
const semplice = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const parola = () => semplice(process.env.TRUCCO_PAROLA);
const attivo = () => parola().length > 0;
// Le forme del comando (il nome alla fine è facoltativo; se c'è, l'effetto va su quel giocatore, anche se scrive uno spettatore):
//   "!win parola [nome]"   il trucco di sempre (fortuna o suggerimento)
//   "!win !parola [nome]"  MANO VINCENTE: la mano cambia subito in una con cui si vince (Scala 40: si chiude al primo turno)
//   "!lose parola [nome]"  SFORTUNA: gli avversari (o solo quel giocatore) pescano carte inutili e tirano dadi brutti
//   "!fiche parola numero [nome]"  FICHE: nei giochi con le fiche porta le fiche (tue o di quel giocatore) a quel numero
const FICHE_MASSIME = 1000000000;
function leggi(testo) {
  const p = parola();
  if (!p) return null;
  const m = /^!(win|lose|fiche)\s+(!?)(.+)$/.exec(semplice(testo));
  if (!m) return null;
  const resto = m[3];
  if (resto !== p && !resto.startsWith(p + ' ')) return null;
  const bersaglio = resto.slice(p.length).trim() || null;
  if (m[1] === 'fiche') {
    if (m[2]) return null;
    // il numero subito dopo la parola (i punti delle migliaia vanno bene: 10.000), poi il nome facoltativo
    const f = /^([\d.'_]+)(?:\s+(.+))?$/.exec(bersaglio || '');
    const cifre = f ? f[1].replace(/[.'_]/g, '') : '';
    const quante = /^\d+$/.test(cifre) ? Math.min(FICHE_MASSIME, Number(cifre)) : null;
    return { tipo: 'fiche', quante, bersaglio: f ? f[2] || null : null };
  }
  const tipo = m[1] === 'lose' ? 'lose' : m[2] ? 'mano' : 'win';
  return { tipo, bersaglio };
}
const eComando = (testo) => !!leggi(testo);
// il posto del giocatore che si chiama così (maiuscole e accenti non contano; basta l'inizio del nome, se è uno solo)
function trovaPosto(nomi, bersaglio) {
  const b = semplice(bersaglio);
  if (!b) return -1;
  const uguali = [], inizio = [];
  nomi.forEach((n, i) => { const x = semplice(n); if (!n) return; if (x === b) uguali.push(i); else if (x.startsWith(b)) inizio.push(i); });
  if (uguali.length) return uguali[0];
  return inizio.length === 1 ? inizio[0] : -1;
}

function arma(g, posto) { g._win = g._win || {}; g._win[posto] = true; }
const armato = (g, posto) => !!(g && g._win && g._win[posto]);
function consuma(g, posto) {
  if (!armato(g, posto)) return false;
  delete g._win[posto];
  return true;
}
// MANO VINCENTE (!win !parola): il gioco ha `manoVincente(posto)`, che cambia la mano e restituisce un testo (o true);
// se in quel momento non si può (es. si stanno ancora facendo le puntate) restituisce null e ci si riprova dopo ogni
// aggiornamento, finché la mano arriva. Senza il metodo vale come il trucco normale.
function armaMano(g, posto) {
  if (typeof g.manoVincente !== 'function') return arma(g, posto);
  g._mano = g._mano || {}; g._mano[posto] = true;
}
// SFORTUNA (!lose): ogni posto colpito ha qualche "colpo" di sfortuna; il gioco, dove si pesca o si tira,
// chiede `T.sfortuna(this, posto)` (che ne consuma uno) e se è vero dà la carta o il tiro peggiore.
const COLPI = 5;
function maledici(g, posti, colpi = COLPI) {
  g._lose = g._lose || {};
  for (const q of posti) g._lose[q] = colpi;
}
const sfortunato = (g, posto) => !!(g && g._lose && g._lose[posto] > 0);
function sfortuna(g, posto) {
  if (!sfortunato(g, posto)) return false;
  if (--g._lose[posto] <= 0) delete g._lose[posto];
  return true;
}
function sussurra(g, posto, testo, durata = 4500) { (g._sussurri = g._sussurri || []).push({ posto, testo: String(testo), durata }); }
// i messaggi segreti da mandare (e li toglie dalla coda)
function prendiSussurri(g) { const s = (g && g._sussurri) || []; if (g) g._sussurri = []; return s; }
// dopo ogni aggiornamento: i suggerimenti che ora si possono dare
function controllaSuggerimenti(g) {
  if (!g || g.finita) return;
  if (g._mano && typeof g.manoVincente === 'function') {
    for (const posto of Object.keys(g._mano).map(Number)) {
      let t = null;
      try { t = g.manoVincente(posto); } catch (e) { t = null; console.warn(`[trucco] mano vincente: ${e.message}`); }
      if (t) { delete g._mano[posto]; if (typeof t === 'string') sussurra(g, posto, t); }
    }
  }
  if (!g._win || typeof g.suggerimentoWin !== 'function') return;
  for (const posto of Object.keys(g._win).map(Number)) {
    let t = null;
    try { t = g.suggerimentoWin(posto); } catch (e) { t = null; }
    if (t) { consuma(g, posto); sussurra(g, posto, t); }
  }
}

// ---- aiutini comuni ----
// mette in cima al mazzo (l'ultima carta, quella che si pesca con pop) la prima carta che soddisfa la condizione;
// restituisce la carta spostata o null. Con `inizio` vale per i giochi che pescano con shift.
function inCima(mazzo, condizione, { inizio = false } = {}) {
  const i = mazzo.findIndex(condizione);
  if (i < 0) return null;
  const [c] = mazzo.splice(i, 1);
  if (inizio) mazzo.unshift(c); else mazzo.push(c);
  return c;
}
// sceglie tra le carte quella col punteggio più alto secondo la funzione data
function migliore(lista, punteggio) { let best = null, bv = -Infinity; for (const x of lista) { const v = punteggio(x); if (v > bv) { bv = v; best = x; } } return best; }

module.exports = { FICHE_MASSIME, leggi, trovaPosto, armaMano, maledici, sfortunato, sfortuna, eComando, attivo, arma, armato, consuma, sussurra, prendiSussurri, controllaSuggerimenti, inCima, migliore };
