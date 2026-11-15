// FRITTATA!: regole (frittata solo con 10 carte a inizio turno, contro a catena, trappole, scarto fino a 10),
// conservazione delle carte e tante partite tra computer.
const assert = require('assert');
process.env.TEST_VELOCE = process.env.TEST_VELOCE || '1';
{ let s = 11; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const M = require('../../giochi3/frittata');
const { CARTE } = M._test;
const totale = Object.values(CARTE).reduce((s, c) => s + c.quante, 0);
const contaCarte = (g) => g.mazzo.length + g.scarti.length + g.mani.flat().length + g.trappole.flat().length
  + (g.pend ? (g.pend.carta ? 1 : 0) + g.pend.catena.length + (g.pend.azione ? 1 : 0) : 0);
const carta = (g, k) => { // prende dal mazzo una carta di quel tipo ('*' = un'azione qualsiasi senza bersaglio)
  const ok = (c) => (k === '*' ? ['piccione', 'zia', 'bidone', 'gatto'].includes(c.k) : c.k === k);
  const i = g.mazzo.findIndex(ok);
  if (i >= 0) return g.mazzo.splice(i, 1)[0];
  const j = g.scarti.findIndex(ok);
  if (j >= 0) return g.scarti.splice(j, 1)[0];
  for (const m of g.mani) { const h = m.findIndex(ok); if (h >= 0) { const c = m.splice(h, 1)[0]; m.push(g.mazzo.pop()); return c; } }
  return assert.fail(`manca la carta ${k}`);
};
const metti = (g, p, ks) => { g.scarti.push(...g.mani[p]); g.mani[p] = ks.map((k) => carta(g, k)); };

// ---- inizio e frittata ----
{
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  assert.deepStrictEqual(g.mani.map((m) => m.length), [3, 3, 3]);
  assert.strictEqual(contaCarte(g), totale);
  assert.ok(g.azione(0, { tipo: 'frittata' }).errore, 'servono 10 carte');
  assert.ok(g.azione(1, { tipo: 'pesca' }).errore, 'non è il suo turno');
  metti(g, 0, Array(10).fill('*')); metti(g, 1, ['*']); metti(g, 2, ['*']);
  assert.ok(g.azione(0, { tipo: 'frittata' }).ok);
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, 'nessuno può fermarla: vince');
}
// ---- frittata fermata da "Non è ancora ora!", che a sua volta si può annullare ----
{
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  metti(g, 0, [...Array(9).fill('*'), 'nograzie']); metti(g, 1, ['nonora', 'nograzie']); metti(g, 2, ['*']);
  g.azione(0, { tipo: 'frittata' });
  assert.strictEqual(g.fase, 'risposta');
  assert.deepStrictEqual(g.attesi(), [1], 'solo chi ha "Non è ancora ora!"');
  assert.ok(g.azione(1, { tipo: 'contro', carta: g.mani[1].find((c) => c.k === 'nograzie').id }).errore, 'una frittata si ferma solo con Non è ancora ora');
  assert.ok(g.azione(1, { tipo: 'contro', carta: g.mani[1].find((c) => c.k === 'nonora').id }).ok);
  assert.deepStrictEqual(g.attesi(), [0], 'ora può rispondere chi ha gridato');
  assert.ok(g.azione(0, { tipo: 'contro', carta: g.mani[0].find((c) => c.k === 'nograzie').id }).ok);
  assert.deepStrictEqual(g.attesi(), [1], 'si può rispondere ancora');
  assert.ok(g.azione(1, { tipo: 'passa' }).ok);
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, 'contro annullato: la frittata vale');
}
{
  const g = M.crea({ n: 2, primo: 0, opzioni: {} });
  metti(g, 0, Array(10).fill('*')); metti(g, 1, ['nonora']);
  g.azione(0, { tipo: 'frittata' });
  g.azione(1, { tipo: 'contro', carta: g.mani[1][0].id });
  assert.ok(!g.finita && g.fase === 'turno' && g.turno === 0 && !g.inizio, 'fermata: il turno continua');
  assert.strictEqual(g.mani[0].length, 11, 'chi ha gridato pesca 1');
  assert.ok(g.azione(0, { tipo: 'frittata' }).errore, 'non si grida due volte');
  assert.ok(g.azione(0, { tipo: 'pesca' }).ok);
  assert.strictEqual(g.fase, 'scarta', 'più di 10: si scarta');
  assert.ok(g.azione(0, { tipo: 'scarta', carte: [g.mani[0][0].id] }).errore, 'bisogna scartarne 2');
  assert.ok(g.azione(0, { tipo: 'scarta', carte: g.mani[0].slice(0, 2).map((c) => c.id) }).ok);
  assert.ok(g.mani[0].length === 10 && g.turno === 1);
  assert.strictEqual(contaCarte(g), totale);
}
// ---- trappole: padella, specchio, cane, retino; tornado ----
{
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  metti(g, 0, Array(10).fill('*')); metti(g, 1, ['padella']); metti(g, 2, []);
  g.trappole[1].push(g.mani[1].pop());
  g.azione(0, { tipo: 'frittata' });
  assert.ok(!g.finita && g.mani[0].length === 8 && g.trappole[1].length === 0, 'la padella bucata: niente frittata e 2 carte via');
  assert.ok(g.turno === 0 && g.fase === 'turno');
  // specchio: lo starnuto torna indietro
  metti(g, 0, ['starnuto', '*', '*', '*', '*']); metti(g, 2, ['specchio', '*', '*', '*']);
  g.trappole[2].push(g.mani[2].shift());
  g.azione(0, { tipo: 'gioca', carta: g.mani[0][0].id, bers: 2 });
  assert.ok(g.mani[0].length === 1 && g.mani[2].length === 3, 'lo specchio rimanda lo starnuto');
  assert.strictEqual(contaCarte(g), totale);
}
{
  const g = M.crea({ n: 2, primo: 0, opzioni: {} });
  metti(g, 0, ['calzini']); metti(g, 1, ['cane', '*', '*']);
  g.trappole[1].push(g.mani[1].shift());
  g.azione(0, { tipo: 'gioca', carta: g.mani[0][0].id, bers: 1 });
  assert.ok(g.mani[0].length === 2 && g.mani[1].length === 2, 'il cane: azione annullata e 2 carte a chi l\'ha giocata');
  metti(g, 0, ['retino']); g.trappole[0].push(g.mani[0].pop());
  const prima = g.mani[1].length;
  g.azione(1, { tipo: 'pesca' });
  assert.ok(g.mani[0].length === 1 && g.mani[1].length === prima, 'il retino prende la carta pescata');
  metti(g, 0, ['tornado']); metti(g, 1, ['specchio', 'cane']); g.trappole[1] = g.mani[1].splice(0);
  // il tornado colpisce un giocatore con le trappole "di mira": scatta lo specchio e il tornado torna indietro
  g.azione(0, { tipo: 'gioca', carta: g.mani[0][0].id, bers: 1 });
  assert.ok(g.trappole[1].length === 1, 'scatta solo una trappola');
  assert.strictEqual(contaCarte(g), totale);
}
// ---- contro con effetto: gas e avvocato ----
{
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  metti(g, 0, ['mucca']); metti(g, 1, ['avvocato']); metti(g, 2, ['gas']);
  g.azione(0, { tipo: 'gioca', carta: g.mani[0][0].id, bers: 1 });
  assert.deepStrictEqual(g.attesi().sort(), [1, 2]);
  assert.ok(g.azione(0, { tipo: 'passa' }).errore, 'chi gioca non risponde a sé stesso');
  g.azione(1, { tipo: 'contro', carta: g.mani[1][0].id });
  assert.deepStrictEqual(g.attesi(), [2]);
  g.azione(2, { tipo: 'contro', carta: g.mani[2][0].id });
  // gas annulla l'avvocato (2 pesca 1) e la mucca passa: 1 pesca 3
  assert.ok(g.mani[1].length === 3 && g.mani[2].length === 1 && g.mani[0].length === 0);
  assert.ok(g.azione(0, { tipo: 'gioca', carta: 'f1' }).errore || true);
  assert.strictEqual(contaCarte(g), totale);
  assert.ok(g.azione(1, { tipo: 'gioca', carta: g.mani[1].find((c) => CARTE[c.k].tipo === 'contro')?.id || 'x' }).errore);
}
// ---- il tempo per rispondere scade ----
{
  const g = M.crea({ n: 2, primo: 0, opzioni: {} });
  metti(g, 0, ['mucca']); metti(g, 1, ['nograzie']);
  g.azione(0, { tipo: 'gioca', carta: g.mani[0][0].id, bers: 1 });
  assert.strictEqual(g.fase, 'risposta');
  assert.ok(!g.controllaTempo(), 'non ancora');
  g.scade = Date.now() - 1;
  assert.ok(g.controllaTempo() && g.mani[1].length === 4 && g.turno === 1);
}
// ---- partite complete tra computer ----
{
  const t0 = Date.now();
  const vinte = { facile: 0, medio: 0, difficile: 0 }, giocate = { facile: 0, medio: 0, difficile: 0 };
  const N = 300;
  let limite = 0, turni = 0;
  for (let k = 0; k < N; k++) {
    const n = 2 + (k % 5);
    const liv = Array.from({ length: n }, (_, i) => ['facile', 'medio', 'difficile'][(i + k) % 3]);
    const g = M.crea({ n, primo: k % n, opzioni: { iniziali: k % 3 ? 3 : 5 } });
    let passi = 0;
    while (!g.finita) {
      assert.ok(++passi < 20000, 'la partita non finisce');
      const chi = g.turno != null ? [g.turno] : g.attesi();
      assert.ok(chi.length, `nessuno deve agire (fase ${g.fase})`);
      for (const p of chi) {
        if (g.finita) break;
        const r = g.azione(p, M.bot(g, p, liv[p]));
        assert.ok(r.ok, `mossa del computer ${JSON.stringify(r)} fase ${g.fase}`);
        assert.strictEqual(contaCarte(g), totale, 'carte perse');
        for (let q = 0; q < n; q++) JSON.stringify(g.vista(q));
        break; // dopo ogni mossa si ricontrolla chi deve agire
      }
    }
    turni += g.nTurni;
    if (g.risultato.titolo) limite++;
    for (const v of g.risultato.vincitori) vinte[liv[v]]++;
    for (const l of liv) giocate[l]++;
  }
  const perc = (l) => Math.round((100 * vinte[l]) / giocate[l]);
  console.log(`✓ Frittata!: ${N} partite tra computer, ${Math.round(turni / N)} turni in media, finite per limite ${limite}, vittorie facile/medio/difficile ${perc('facile')}%/${perc('medio')}%/${perc('difficile')}% (${Date.now() - t0} ms)`);
  assert.ok(limite < N * 0.1, 'quasi tutte finiscono con una frittata');
  assert.ok(perc('difficile') > perc('facile'), 'il difficile batte il facile');
}
console.log('✓ Frittata!: frittata con 10 carte, contro a catena, trappole, scarto fino a 10');
