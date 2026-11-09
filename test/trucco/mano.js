// IL TRUCCO SEGRETO, le forme nuove: "!win !parola" (MANO VINCENTE: la mano cambia in una con cui si vince, poi
// gioca il giocatore), "!lose parola" (SFORTUNA per gli avversari) e il nome di un giocatore alla fine (l'effetto va a lui).
const assert = require('assert');
process.env.TEST_VELOCE = '1';
const T = require('../../giochi/trucco');
const MV = require('../../giochi/mano-vincente');
const { GIOCHI } = require('../../giochi');

const crea = (id, n, opzioni = {}) => {
  const mod = GIOCHI[id], opz = {};
  for (const o of mod.meta.opzioni) opz[o.id] = o.predefinito;
  return mod.crea({ n, primo: 0, opzioni: { ...opz, ...opzioni }, bot: Array.from({ length: n }, () => 'medio') });
};
// la mano vincente arriva subito (o appena si può) con un messaggio segreto per quel posto
const daiMano = (g, p) => { T.armaMano(g, p); T.controllaSuggerimenti(g); return T.prendiSussurri(g).filter((m) => m.posto === p).map((m) => m.testo); };
// le carte si possono dividere tutte in combinazioni valide? (prova tutti i gruppi da 3 a 5 carte)
function copertura(carte, valuta) {
  const gruppi = [];
  const sotto = (da, acc) => {
    if (acc.length >= 3 && valuta(acc)) gruppi.push(acc.slice());
    if (acc.length === 5) return;
    for (let i = da; i < carte.length; i++) { acc.push(carte[i]); sotto(i + 1, acc); acc.pop(); }
  };
  sotto(0, []);
  const usati = new Set(), out = [];
  const dfs = () => {
    const c = carte.find((x) => !usati.has(x.id));
    if (!c) return true;
    for (const gr of gruppi) {
      if (!gr.includes(c) || gr.some((x) => usati.has(x.id))) continue;
      gr.forEach((x) => usati.add(x.id)); out.push(gr);
      if (dfs()) return true;
      out.pop(); gr.forEach((x) => usati.delete(x.id));
    }
    return false;
  };
  return dfs() ? out : null;
}

// ---- il comando: forme, parola, nome del bersaglio ----
{
  const prima = process.env.TRUCCO_PAROLA;
  process.env.TRUCCO_PAROLA = 'Patata';
  assert.deepStrictEqual(T.leggi('!win patata'), { tipo: 'win', bersaglio: null });
  assert.deepStrictEqual(T.leggi('!WIN !Pàtata'), { tipo: 'mano', bersaglio: null });
  assert.deepStrictEqual(T.leggi('!lose patata'), { tipo: 'lose', bersaglio: null });
  assert.deepStrictEqual(T.leggi('!win !patata  Mario Rossi'), { tipo: 'mano', bersaglio: 'mario rossi' });
  assert.deepStrictEqual(T.leggi('!lose patata luca'), { tipo: 'lose', bersaglio: 'luca' });
  for (const t of ['!win', '!win !', '!win patate', '!win patatina', '!lose', '!lose banana', 'ciao !lose patata', '!win !!patata']) assert.strictEqual(T.leggi(t), null, t);
  assert.ok(T.eComando('!lose patata') && T.eComando('!win !patata Luca'), 'anche le forme nuove non si vedono in chat');
  // !fiche parola numero [nome]
  assert.deepStrictEqual(T.leggi('!fiche patata 5000'), { tipo: 'fiche', quante: 5000, bersaglio: null });
  assert.deepStrictEqual(T.leggi('!FICHE Patata 10.000 Luca'), { tipo: 'fiche', quante: 10000, bersaglio: 'luca' });
  assert.deepStrictEqual(T.leggi('!fiche patata 0'), { tipo: 'fiche', quante: 0, bersaglio: null });
  assert.strictEqual(T.leggi('!fiche patata 99999999999999').quante, T.FICHE_MASSIME, 'tetto alle fiche');
  assert.strictEqual(T.leggi('!fiche patata').quante, null, 'senza numero: avviso segreto, niente in chat');
  for (const t of ['!fiche 5000', '!fiche banana 5000', '!fiche !patata 5000', '!fiche patatina 5000']) assert.strictEqual(T.leggi(t), null, t);
  delete process.env.TRUCCO_PAROLA;
  assert.strictEqual(T.leggi('!win !patata'), null, 'senza la variabile non scatta mai');
  if (prima === undefined) delete process.env.TRUCCO_PAROLA; else process.env.TRUCCO_PAROLA = prima;
  const nomi = ['Mario', 'Lucia', null, 'Luca Bianchi', 'Computer 1'];
  assert.strictEqual(T.trovaPosto(nomi, 'mario'), 0);
  assert.strictEqual(T.trovaPosto(nomi, 'LÙCIA'), 1);
  assert.strictEqual(T.trovaPosto(nomi, 'luca'), 3, 'basta l\'inizio, se è uno solo');
  assert.strictEqual(T.trovaPosto(nomi, 'lu'), -1, 'inizio di due nomi: nessuno');
  assert.strictEqual(T.trovaPosto(nomi, 'giovanni'), -1);
  // la sfortuna: qualche colpo per ogni posto colpito, poi passa
  const g = {};
  T.maledici(g, [1, 2], 2);
  assert.ok(!T.sfortuna(g, 0) && T.sfortuna(g, 1) && T.sfortuna(g, 1) && !T.sfortuna(g, 1) && T.sfortunato(g, 2));
  // senza manoVincente vale come il trucco normale
  const h = {};
  T.armaMano(h, 3);
  assert.ok(T.armato(h, 3));
}

// ---- il costruttore delle mani: tutte le carte in combinazioni valide, e mani diverse ----
{
  const { valuta } = require('../../giochi/scala-regole');
  const { mazzoDoppio, mescola } = require('../../giochi/carte');
  const viste = new Set();
  for (let k = 0; k < 200; k++) {
    const pool = mescola(mazzoDoppio()).slice(0, 60);
    const gr = MV.costruisci(pool, 13, { valuta, minPunti: 40 });
    assert.ok(gr, 'si trova sempre una mano');
    const ids = gr.flat().map((c) => c.id);
    assert.strictEqual(new Set(ids).size, 13);
    assert.ok(gr.every((x) => valuta(x)) && gr.reduce((s, x) => s + valuta(x).punti, 0) >= 40);
    viste.add(ids.sort().join());
  }
  assert.ok(viste.size > 150, 'mani varie');
  const tipi = new Set();
  for (let k = 0; k < 300; k++) {
    const m = MV.manoPoker(mescola(require('../../giochi/carte').mazzoDoppio().filter((c) => !c.jolly && !c.id.endsWith('b'))));
    assert.ok(m && m.length === 5 && new Set(m.map((c) => c.id)).size === 5);
    tipi.add(GIOCHI.poker5 ? m.map((c) => c.rango).sort((a, b) => a - b).join() : '');
  }
  assert.ok(tipi.size > 50);
}

for (let giro = 0; giro < 15; giro++) {
  // ---- SCALA 40: al tuo turno peschi, cali tutto (almeno 40) e chiudi scartando ----
  {
    const { valuta } = require('../../giochi/scala-regole');
    const g = crea('scala40', 3);
    const p = (g.turno + 1) % 3; // anche se non è il suo turno: lo vale quando tocca a lui
    const t = daiMano(g, p);
    assert.ok(t.length && /Mano cambiata/.test(t[0]), 'scala40: messaggio segreto');
    assert.strictEqual(g.mani[p].length, 13);
    const tutte = [...g.mazzo, ...g.pozzo, ...g.mani.flat()];
    assert.strictEqual(new Set(tutte.map((c) => c.id)).size, 108, 'scala40: nessuna carta persa o doppia');
    const gr = copertura(g.mani[p], valuta);
    assert.ok(gr && gr.reduce((s, x) => s + valuta(x).punti, 0) >= 40, 'scala40: tutta la mano in combinazioni da almeno 40');
    // e se tocca a lui e ha già pescato: avanza una carta da scartare, e chiude
    g.turno = p; g.nuovoTurno();
    g.azione(p, { tipo: 'pesca', da: 'mazzo' });
    daiMano(g, p);
    assert.strictEqual(g.mani[p].length, 14);
    let ok = null;
    for (const c of g.mani[p]) { const gg = copertura(g.mani[p].filter((x) => x !== c), valuta); if (gg) { ok = { gg, c }; break; } }
    assert.ok(ok, 'scala40: 13 carte in combinazioni e una da scartare');
    assert.ok(!g.azione(p, { tipo: 'cala', combinazioni: ok.gg.map((x) => x.map((c) => c.id)) }).errore, 'scala40: si cala tutto');
    assert.ok(!g.azione(p, { tipo: 'scarta', carta: ok.c.id }).errore);
    assert.ok(g.riepilogo || g.finita, 'scala40: chiude');
  }
  // ---- SCALA 40 con !lose: la carta pescata non serve a niente ----
  {
    const g = crea('scala40', 2);
    const p = g.turno;
    T.maledici(g, [p]);
    const prima = g.mani[p].slice();
    g.azione(p, { tipo: 'pesca', da: 'mazzo' });
    const c = g.mani[p].find((x) => !prima.includes(x));
    assert.ok(!c.jolly, 'scala40 !lose: niente jolly');
    assert.ok(!prima.some((x) => !x.jolly && x.rango === c.rango && x.seme !== c.seme), 'scala40 !lose: non fa tris');
  }
  // ---- MACHIAVELLI ----
  {
    const g = crea('machiavelli', 2);
    const p = g.turno;
    daiMano(g, p);
    const gr = copertura(g.mani[p], GIOCHI.machiavelli._test.valuta);
    assert.ok(gr, 'machiavelli: tutta la mano in combinazioni');
    assert.ok(!g.azione(p, { tipo: 'gioca', tavolo: gr.map((x) => x.map((c) => c.id)) }).errore);
    assert.ok(g.finita && g.risultato.vincitori.includes(p), 'machiavelli: vince calando tutto');
  }
  // ---- UNO: carte uguali di tutti i colori (o con un jolly) ----
  {
    const g = crea('uno', 3);
    const p = g.turno;
    daiMano(g, p);
    const mano = g.mani[p];
    const numeri = mano.filter((c) => /^\d$/.test(c.valore));
    assert.ok(new Set(numeri.map((c) => c.valore)).size === 1 && mano.length >= 3, 'uno: numeri tutti uguali');
    if (mano.length === numeri.length) {
      const prima = numeri.find((c) => g.giocabile(c));
      assert.ok(prima, 'uno: una si gioca sempre');
      const r = g.azione(p, { tipo: 'gioca', carte: [prima.id, ...numeri.filter((c) => c !== prima).map((c) => c.id)] });
      assert.ok(!r.errore && g.finita, 'uno: cala tutto e vince');
    }
  }
  // ---- BURRACO: scale e tris con un burraco ----
  {
    const g = crea('burraco', 2);
    const p = g.turno;
    daiMano(g, p);
    const { valuta } = require('../../giochi2/burraco-regole');
    const mano = g.mani[p];
    assert.strictEqual(mano.length, 11);
    const sem = mano.reduce((m, c) => ((m[c.seme] = (m[c.seme] || 0) + 1), m), {});
    assert.ok(Object.values(sem).some((x) => x >= 7), 'burraco: c\'è una scala lunga');
    void valuta;
  }
  // ---- BLACKJACK e SETTE E MEZZO: si aspetta la distribuzione, poi le carte del trucco ----
  {
    const g = crea('blackjack', 1);
    T.armaMano(g, 0);
    T.controllaSuggerimenti(g);
    assert.ok(g._mano[0], 'blackjack: durante le puntate aspetta');
    g.azione(0, { tipo: 'punta', importo: 10 });
    if (g.fase === 'puntate' && g.gioca) g.gioca();
    T.controllaSuggerimenti(g);
    const m = g.mani[0][0];
    if (g.fase === 'turni') {
      assert.ok(!g._mano[0], 'blackjack: mano data');
      let k = 0;
      while (m.stato === 'gioca' && k++ < 10) g.azione(0, { tipo: 'carta' });
      assert.strictEqual(GIOCHI.blackjack._test.conta(m.carte).tot, 21, 'blackjack: 21');
    }
  }
  {
    const g = crea('settemezzo', 1);
    g.azione(0, { tipo: 'punta', importo: 10 });
    if (g.fase === 'puntate' && g.gioca) g.gioca();
    if (g.fase === 'turni') {
      daiMano(g, 0);
      g.azione(0, { tipo: 'carta' });
      assert.ok(g.mani[0].stato === 'stai' && g.mani[0].carte.length === 2, 'sette e mezzo servito');
    }
  }
  // ---- VIDEO POKER e POKER A 5 CARTE: mano forte ----
  {
    const g = crea('videopoker', 1);
    g.azione(0, { tipo: 'distribuisci', crediti: 1 });
    daiMano(g, 0);
    const r = g.azione(0, { tipo: 'cambia', tieni: g.carte.map((c) => c.id) });
    assert.ok(!r.errore && g.esito.vinto >= g.puntata * 4, 'videopoker: almeno una scala');
  }
  {
    const g = crea('poker5', 3);
    const p = g.turno;
    daiMano(g, p);
    const { valuta5 } = require('../../giochi/poker-motore');
    const mia = valuta5(g.carte[p]).punti;
    assert.ok(g.carte.every((x, i) => i === p || !x.length || valuta5(x).punti < mia), 'poker5: la mano migliore del tavolo');
    assert.strictEqual(new Set([...g.mazzo, ...g.carte.flat()].map((c) => c.id)).size, 52);
  }
  // ---- !lose con i dadi: il tiro peggiore ----
  {
    const g = crea('backgammon', 2);
    const p = g.turno;
    T.maledici(g, [p]);
    if (g.fase === 'tira') { g.azione(p, { tipo: 'tira' }); assert.ok(!T.sfortunato(g, p) || g._lose[p] === 4); }
  }
}
console.log('trucco: mano vincente e sfortuna ok');
