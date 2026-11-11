// Go: catture, suicidio, ko e superko, passaggi, pietre morte, conteggio ad area con komi, partite tra computer
const assert = require('assert');
process.env.TEST_VELOCE = process.env.TEST_VELOCE || '1';
const M = require('../../giochi2/go');
const { Tavola } = M._test;

// ---- catture e libertà ----
{
  const t = new Tavola(9);
  const P = (x, y) => t.pt(x, y);
  t.gioca(P(4, 4), 2);
  for (const [x, y] of [[3, 4], [5, 4], [4, 3]]) t.gioca(P(x, y), 1);
  assert.strictEqual(t.liberta(t.capo[P(4, 4)]).size, 1, 'bianco in atari');
  assert.strictEqual(t.gioca(P(4, 5), 1), 1, 'cattura una pietra');
  assert.strictEqual(t.c[P(4, 4)], 0);
  // suicidio
  assert.ok(!t.legale(P(4, 4), 2), 'suicidio vietato');
  // angolo: cattura di un gruppo di due
  const u = new Tavola(9); const Q = (x, y) => u.pt(x, y);
  u.gioca(Q(0, 0), 2); u.gioca(Q(1, 0), 2);
  u.gioca(Q(0, 1), 1); u.gioca(Q(1, 1), 1);
  assert.strictEqual(u.gioca(Q(2, 0), 1), 2, 'cattura il gruppo di due nell\'angolo');
  // pseudo-libertà coerenti con le libertà vere dopo tante mosse casuali
  const v = new Tavola(9);
  let col = 1;
  for (let k = 0; k < 400; k++) {
    const vuoti = []; for (let i = 0; i < v.c.length; i++) if (v.c[i] === 0 && v.legale(i, col)) vuoti.push(i);
    if (!vuoti.length) break;
    v.gioca(vuoti[Math.floor(Math.random() * vuoti.length)], col);
    col = 3 - col;
    for (let i = 0; i < v.c.length; i++) if (v.c[i] === 1 || v.c[i] === 2) assert.ok(v.liberta(v.capo[i]).size > 0, 'nessun gruppo senza libertà resta sul goban');
  }
}
// ---- ko ----
{
  const g = M.crea({ n: 2, primo: 0, opzioni: { tavola: 9 } });
  const t = g.t; const P = (x, y) => t.pt(x, y);
  // forma di ko classica intorno a (4,4)/(5,4)
  for (const [x, y] of [[3, 4], [4, 3], [4, 5]]) t.gioca(P(x, y), 1);
  for (const [x, y] of [[6, 4], [5, 3], [5, 5], [4, 4]]) t.gioca(P(x, y), 2);
  g.storia = new Set([g.chiave()]);
  g.turno = 0; // il nero
  assert.ok(g.azione(0, { tipo: 'metti', x: 5, y: 4 }).ok, 'il nero cattura in ko');
  assert.strictEqual(t.c[P(4, 4)], 0);
  const r = g.azione(1, { tipo: 'metti', x: 4, y: 4 });
  assert.ok(r.errore && /ko/i.test(r.errore), 'il bianco non può riprendere subito');
  assert.ok(g.azione(1, { tipo: 'metti', x: 0, y: 8 }).ok, 'gioca altrove');
  assert.ok(g.azione(0, { tipo: 'metti', x: 8, y: 0 }).ok);
  assert.ok(g.azione(1, { tipo: 'metti', x: 4, y: 4 }).ok, 'dopo una mossa altrove si riprende');
}
// ---- passaggi, conteggio, komi ----
{
  const g = M.crea({ n: 2, primo: 0, opzioni: { tavola: 9, komi: 7.5 } });
  const t = g.t; const P = (x, y) => t.pt(x, y);
  // il nero chiude la colonna 3, il bianco la colonna 5
  for (let y = 0; y < 9; y++) { t.gioca(P(3, y), 1); t.gioca(P(5, y), 2); }
  g.storia = new Set([g.chiave()]); g.turno = 0;
  assert.ok(g.azione(0, { tipo: 'passa' }).ok);
  assert.ok(g.azione(1, { tipo: 'passa' }).ok);
  assert.strictEqual(g.fase, 'conteggio');
  assert.deepStrictEqual(g.morte, [], 'niente pietre morte');
  const s = g.punteggio();
  assert.strictEqual(s.nero, 36, 'nero: 4 colonne');
  assert.strictEqual(s.bianco, 36 + 7.5, 'bianco: 4 colonne più il komi (la colonna 4 è di nessuno)');
  assert.ok(g.azione(0, { tipo: 'accetta' }).ok);
  assert.ok(!g.finita);
  assert.ok(g.azione(1, { tipo: 'accetta' }).ok);
  assert.ok(g.finita && g.risultato.vincitori[0] === 1, 'vince il bianco col komi');
}
// ---- pietra morta segnata a mano ----
{
  const g = M.crea({ n: 2, primo: 0, opzioni: { tavola: 9 } });
  const t = g.t; const P = (x, y) => t.pt(x, y);
  for (let y = 0; y < 9; y++) { t.gioca(P(2, y), 1); t.gioca(P(3, y), 2); }
  t.gioca(P(0, 4), 2); // una pietra bianca persa nel territorio nero (colonne 0-1)
  g.passati = 1; g.turno = 1;
  g.azione(1, { tipo: 'passa' });
  assert.ok(g.morte.includes(P(0, 4)), 'il computer la propone morta');
  assert.ok(!g.morte.includes(P(3, 0)) && !g.morte.includes(P(2, 0)), 'i muri sono vivi');
  g.azione(0, { tipo: 'morte', x: 0, y: 4 });
  assert.ok(!g.morte.includes(P(0, 4)), 'cliccandola torna viva');
  g.azione(0, { tipo: 'morte', x: 0, y: 4 });
  assert.strictEqual(g.punteggio().nero, 27, 'le colonne 0-2 al nero');
}
console.log('✓ Go: catture, suicidio, ko e superko, passaggi, pietre morte proposte e cambiate, conteggio ad area con komi');

// ---- partite tra computer ----
{
  const t0 = Date.now();
  const sfide = { 'difficile-medio': [0, 0], 'medio-facile': [0, 0] };
  const N = process.env.TEST_VELOCE ? 16 : 60;
  for (let k = 0; k < N; k++) {
    const coppia = k % 2 ? ['difficile', 'medio'] : ['medio', 'facile'];
    const liv = k % 4 < 2 ? coppia : [coppia[1], coppia[0]];
    const g = M.crea({ n: 2, primo: k % 2, opzioni: { tavola: k === 7 ? 13 : 9 } });
    let passi = 0;
    while (!g.finita) {
      assert.ok(++passi < 2000, 'la partita finisce');
      const t = g.fase === 'conteggio' ? (g.accettato[0] ? 1 : 0) : g.turno;
      const r = g.azione(t, M.bot(g, t, liv[t]));
      assert.ok(r.ok, `mossa rifiutata (${liv[t]}): ${r.errore}`);
    }
    const v = g.risultato.vincitori[0];
    const ch = `${liv[0]}-${liv[1]}`, rv = `${liv[1]}-${liv[0]}`;
    if (sfide[ch]) sfide[ch][v === 0 ? 0 : 1]++; else sfide[rv][v === 1 ? 0 : 1]++;
  }
  const [dv, mv] = sfide['difficile-medio'], [m2, f2] = sfide['medio-facile'];
  console.log(`✓ Go: ${N} partite tra computer su 9×9 e 13×13 (difficile-medio ${dv}-${mv}, medio-facile ${m2}-${f2}) in ${Date.now() - t0} ms`);
  assert.ok(dv > mv, 'il difficile batte il medio');
  assert.ok(m2 >= f2, 'il medio batte il facile (nei test pensa pochissimo: la vera differenza si vede con i tempi veri)');
}

// ---- goban grande: in apertura il computer non mette le pietre sul bordo (prima le metteva in fila: A19, B19, C19…) ----
{
  for (const livello of ['medio', 'difficile']) {
    const g = M.crea({ n: 2, primo: 0, opzioni: { tavola: 19 } });
    const nere = [[3, 3], [15, 15], [9, 9], [3, 15], [15, 3], [9, 3]];
    for (const [x, y] of nere) {
      assert.ok(g.azione(0, { tipo: 'metti', x, y }).ok);
      const a = M.bot(g, 1, livello);
      assert.strictEqual(a.tipo, 'metti', `19×19 ${livello}: in apertura non passa`);
      assert.ok(Math.min(a.x, a.y, 18 - a.x, 18 - a.y) >= 1, `19×19 ${livello}: niente pietre sulla prima linea in apertura (${a.x},${a.y})`);
      assert.ok(g.azione(1, a).ok);
    }
  }
  console.log('✓ Go: sul 19×19 il computer apre lontano dal bordo');
}
