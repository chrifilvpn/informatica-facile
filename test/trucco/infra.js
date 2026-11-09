// Il trucco segreto: il comando, l'arma/consuma, i suggerimenti e il blackjack servito.
const assert = require('assert');
const T = require('../../giochi/trucco');
const { GIOCHI } = require('../../giochi');

// la parola segreta viene da TRUCCO_PAROLA (su Render); senza, il trucco è spento
{
  const prima = process.env.TRUCCO_PAROLA;
  delete process.env.TRUCCO_PAROLA;
  assert.ok(!T.attivo() && !T.eComando('!win') && !T.eComando('!win banana') && !T.eComando('!win '), 'senza la variabile non scatta mai');
  process.env.TRUCCO_PAROLA = '  Pàtata  Fritta ';
  assert.ok(T.attivo() && T.eComando('!win patata fritta') && T.eComando('  !WIN   Patata   FRITTA ') && T.eComando('!win pàtata fritta'), 'maiuscole, accenti e spazi non contano');
  assert.ok(!T.eComando('!win') && !T.eComando('!win patata') && !T.eComando('!win banana') && !T.eComando('ciao !win patata fritta') && !T.eComando('!winpatata fritta'), 'solo la parola giusta');
  if (prima === undefined) delete process.env.TRUCCO_PAROLA; else process.env.TRUCCO_PAROLA = prima;
}
{
  const g = {};
  assert.ok(!T.armato(g, 0) && !T.consuma(g, 0));
  T.arma(g, 0);
  assert.ok(T.armato(g, 0) && T.consuma(g, 0) && !T.consuma(g, 0), 'vale una volta sola');
  // i suggerimenti arrivano solo quando il gioco ne ha uno da dare
  let pronto = false;
  const h = { suggerimentoWin: (p) => (pronto && p === 1 ? 'mossa giusta' : null) };
  T.arma(h, 1); T.controllaSuggerimenti(h);
  assert.deepStrictEqual(T.prendiSussurri(h), [], 'non ancora');
  pronto = true; T.controllaSuggerimenti(h);
  const s = T.prendiSussurri(h);
  assert.ok(s.length === 1 && s[0].posto === 1 && s[0].testo === 'mossa giusta' && !T.armato(h, 1));
  assert.deepStrictEqual(T.prendiSussurri(h), [], 'la coda si svuota');
  const m = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.strictEqual(T.inCima(m, (c) => c.id === 'a').id, 'a'); assert.strictEqual(m[m.length - 1].id, 'a');
  assert.strictEqual(T.inCima(m, (c) => c.id === 'c', { inizio: true }).id, 'c'); assert.strictEqual(m[0].id, 'c');
}
// blackjack: con il trucco si arriva a 21 (blackjack servito, oppure chiedendo carta) e il banco non fa 21
{
  const B = GIOCHI.blackjack;
  const { conta } = B._test;
  let dirette = 0, piano = 0;
  const combinazioni = {};
  for (let k = 0; k < 300; k++) {
    const g = B.crea({ n: 2, primo: 0, opzioni: {}, bot: [null, 'medio'] });
    const tutte = g.scarpa.length;
    T.arma(g, 0);
    g.azione(0, { tipo: 'punta', importo: 10 });
    g.azione(1, B.bot(g, 1, 'medio'));
    while (g.fase === 'puntate' && g.inAttesa) g.avanza();
    assert.ok(!T.armato(g, 0), 'trucco usato');
    const m = g.mani[0][0];
    assert.ok(!(g.banco.length === 2 && conta(g.banco).tot === 21), 'il banco non ha blackjack');
    if (m.stato === 'blackjack') dirette++;
    else {
      assert.notStrictEqual(conta(m.carte).tot, 21, 'le prime due non fanno già 21');
      assert.strictEqual(g.consiglio(0), 'carta', 'il consiglio dice di chiedere carta');
      assert.ok(!JSON.stringify(g.vista(0)).includes('codaTrucco'), 'la coda non si vede dal browser');
      while (g.turno === 0) {
        assert.ok(conta(m.carte).tot < 21, 'non sballa mai prima');
        g.azione(0, { tipo: 'carta' });
      }
      assert.strictEqual(conta(m.carte).tot, 21, '21 chiedendo carta');
      assert.ok(m.carte.length >= 3 && m.carte.length <= 6);
      const k = m.carte.map((c) => Math.min(10, c.rango)).sort((x, y) => x - y).join(',');
      combinazioni[k] = (combinazioni[k] || 0) + 1;
      piano++;
    }
    while (g.fase !== 'puntate') { if (g.turno === 1) g.azione(1, B.bot(g, 1, 'medio')); else g.avanza(); }
    assert.ok(['blackjack', 'vince'].includes(m.esito), 'mano vinta: ' + m.esito);
    const ids = new Set([...g.scarpa, ...g.banco, ...g.mani.flat().flatMap((x) => x.carte)].map((c) => c.id));
    assert.ok(ids.size > 0 && tutte > 0);
  }
  const diverse = Object.keys(combinazioni).length, piuUsata = Math.max(...Object.values(combinazioni));
  assert.ok(dirette > 5 && dirette < 70 && piano > 220, `quasi sempre piano piano: ${dirette} dirette, ${piano} piano piano`);
  assert.ok(diverse > 80 && piuUsata < 15, `mani varie: ${diverse} combinazioni diverse, la più usata ${piuUsata} volte`);
  assert.ok(Object.keys(combinazioni).some((k) => k.split(',').length >= 5), 'anche mani da 5-6 carte');
  // fermarsi prima: le carte del trucco tornano nella scarpa e il gioco va avanti normale
  for (let k = 0; k < 50; k++) {
    const g = B.crea({ n: 1, primo: 0, opzioni: {}, bot: [null] });
    T.arma(g, 0);
    g.azione(0, { tipo: 'punta', importo: 10 });
    while (g.fase === 'puntate' && g.inAttesa) g.avanza();
    if (g.turno !== 0) continue;
    const n = g.scarpa.length + Object.values(g.codaTrucco).flat().length;
    g.azione(0, { tipo: 'stai' });
    assert.strictEqual(g.scarpa.length, n, 'le carte non usate tornano nella scarpa');
  }
}
console.log('✓ Trucco segreto: comando, una volta sola, suggerimenti solo a chi li chiede, blackjack servito o 21 chiedendo carta');
