// Test dell'ESCAPE ROOM: gli enigmi generati (soluzione coerente con gli indizi, pezzi divisi tra i giocatori), chi
// vede che cosa (niente soluzioni nella vista di chi non ha il pezzo), tentativi sbagliati e aiuti che tolgono tempo,
// la porta coi frammenti, il passaggio di stanza, il tempo che scade, la pausa delle dispense, chi esce dalla partita
// e il gioco da soli.
const assert = require('assert');
const { GIOCHI } = require('../../giochi');
const D = require('../../giochi3/escape-dati');

const M = GIOCHI.escape;
const { pulisci, PENA_ERRORE, PENA_AIUTO } = M._test;
assert.ok(M.meta.soloPersone && M.meta.pausaBoss && M.meta.giocatori[0] === 1 && M.meta.giocatori.includes(6), 'da 1 a 6 persone, niente computer');
assert.strictEqual(M.meta.categoria, 'rompicapo');

// ---- gli enigmi: 300 per tipo, la soluzione è sempre ricavabile dagli indizi ----
const testi = (e) => JSON.stringify(e.parti);
for (const [tipo, gen] of Object.entries(D.GENERATORI)) {
  for (let k = 0; k < 300; k++) {
    const e = gen({ contenitore: 'la cassa', carta: 'un foglio', usate: new Set() });
    assert.strictEqual(e.tipo, tipo);
    assert.ok(e.parti.length >= 2 && e.parti.length <= 3, `${tipo}: 2 o 3 pezzi`);
    assert.strictEqual(pulisci(e.lucchetto, e.soluzione), e.soluzione, `${tipo}: la soluzione ${e.soluzione} entra nel lucchetto`);
    assert.strictEqual(e.aiuti.length, 2, `${tipo}: due aiuti`);
    for (const pt of e.parti) assert.ok(pt.titolo && pt.blocchi.length, `${tipo}: pezzo con titolo e contenuto`);
    const t = testi(e);
    if (tipo === 'equazioni') {
      // le tre operazioni bastano: una sola terna di cifre le soddisfa
      const ops = e.parti.flatMap((pt) => pt.blocchi.filter((b) => b.t === 'lista').flatMap((b) => b.v));
      const frutti = [...new Set(ops.join(' ').match(/\p{Extended_Pictographic}/gu))];
      assert.strictEqual(frutti.length, 3);
      let soluzioni = 0;
      for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) {
        if (a === b || b === c || a === c) continue;
        const v = { [frutti[0]]: a, [frutti[1]]: b, [frutti[2]]: c };
        // eslint-disable-next-line no-new-func
        const vale = ops.every((op) => { const [sx, dx] = op.split('='); return Function(`return ${sx.replace(/\p{Extended_Pictographic}/gu, (f) => v[f]).replace(/×/g, '*')}`)() === Number(dx); });
        if (vale) soluzioni++;
      }
      assert.strictEqual(soluzioni, 1, `equazioni: una sola soluzione (${ops.join(' ; ')})`);
    }
    if (tipo === 'fili') assert.ok(Number(e.soluzione) >= 1 && Number(e.soluzione) <= e.lucchetto.n);
    if (tipo === 'leve') assert.ok(/1/.test(e.soluzione) && /0/.test(e.soluzione), 'leve: qualcuna su e qualcuna giù');
  }
}
console.log(`✓ Escape Room: ${Object.keys(D.GENERATORI).length} tipi di enigmi, 300 partite ciascuno, la soluzione entra sempre nel suo lucchetto (le equazioni hanno una sola soluzione)`);

// il lucchetto accetta solo il formato giusto
assert.strictEqual(pulisci({ tipo: 'cifre', n: 4 }, ' 12 34 '), '1234');
assert.strictEqual(pulisci({ tipo: 'cifre', n: 4 }, '12a4'), null);
assert.strictEqual(pulisci({ tipo: 'parola', n: 4 }, 'lùna'), 'LUNA');
assert.strictEqual(pulisci({ tipo: 'filo', n: 5 }, '6'), null);
assert.strictEqual(pulisci({ tipo: 'filo', n: 5 }, 3), '3');
for (const strano of [null, undefined, {}, [], true, 'x'.repeat(300), 'constructor']) assert.strictEqual(pulisci({ tipo: 'cifre', n: 3 }, strano), null);

// ---- una partita in 3, passo per passo ----
const veroNow = Date.now;
let ora = veroNow();
Date.now = () => ora;
try {
  const g = M.crea({ n: 3, primo: 0, opzioni: { tema: 'scuola', stanze: 2, tempo: 'normale' } });
  assert.strictEqual(g.nStanze, 2); assert.strictEqual(g.temaId, 'scuola');
  assert.strictEqual(g.restaMs(), 2 * 12 * 60000);
  const st = g.attuale;
  // ogni pezzo lo vede solo il suo giocatore; i pezzi di un enigma stanno a giocatori diversi
  for (const e of st.enigmi) {
    assert.strictEqual(new Set(e.parti.map((pt) => pt.di)).size, e.parti.length, 'pezzi a giocatori diversi');
    for (let p = 0; p < 3; p++) {
      const v = g.vista(p).enigmi[st.enigmi.indexOf(e)];
      v.parti.forEach((pt, j) => assert.strictEqual(!!pt.blocchi, e.parti[j].di === p, 'il pezzo lo vede solo chi ce l\'ha'));
      assert.strictEqual(v.soluzione, null);
    }
  }
  // la vista non contiene mai le soluzioni (né i pezzi degli altri)
  for (let p = 0; p < 3; p++) assert.ok(!JSON.stringify(g.vista(p)).includes('"soluzione":"'), 'niente soluzioni nella vista');
  const portaDi = st.porta.di;
  for (let p = 0; p < 3; p++) assert.strictEqual(!!g.vista(p).porta.simboli, p === portaDi, 'i simboli della porta li vede uno solo');
  // il primo enigma della prima stanza è facile
  assert.ok(st.enigmi.every((e) => D.FACILI[e.tipo]), 'prima stanza: enigmi facili');

  // tentativo sbagliato: −20 secondi, resta tra i tentativi
  const e0 = st.enigmi[0];
  const sbagliato = e0.lucchetto.tipo === 'filo' ? String((Number(e0.soluzione) % e0.lucchetto.n) + 1)
    : e0.lucchetto.tipo === 'leve' ? [...e0.soluzione].map((c) => (c === '1' ? '0' : '1')).join('')
    : e0.lucchetto.tipo === 'parola' ? 'Z'.repeat(e0.lucchetto.n)
    : e0.lucchetto.tipo === 'frecce' ? [...e0.soluzione].map((c) => (c === 'U' ? 'D' : 'U')).join('')
    : e0.lucchetto.tipo === 'colori' ? [...e0.soluzione].map((c) => String((Number(c) + 1) % 6)).join('')
    : [...e0.soluzione].map((c) => String((Number(c) + 1) % 10)).join('');
  const prima = g.restaMs();
  assert.ok(g.azione(1, { tipo: 'prova', enigma: 0, valore: sbagliato }).ok);
  assert.strictEqual(prima - g.restaMs(), PENA_ERRORE * (e0.penalita || 1), 'un errore toglie tempo');
  assert.strictEqual(g.errori, 1);
  assert.strictEqual(g.vista(2).enigmi[0].tentativi.length, 1, 'i tentativi li vedono tutti');
  assert.ok(g.azione(1, { tipo: 'prova', enigma: 0, valore: e0.soluzione }).errore, 'un tentativo alla volta');
  ora += 2000;
  // aiuto: −1 minuto, lo vedono tutti, al massimo due
  const r0 = g.restaMs();
  assert.ok(g.azione(2, { tipo: 'aiuto', enigma: 0 }).ok);
  assert.strictEqual(r0 - g.restaMs(), PENA_AIUTO);
  assert.strictEqual(g.vista(0).enigmi[0].aiuti.length, 1);
  assert.ok(g.azione(2, { tipo: 'aiuto', enigma: 0 }).ok);
  assert.ok(g.azione(2, { tipo: 'aiuto', enigma: 0 }).errore, 'solo due aiuti');
  // la porta non si prova senza i frammenti
  assert.ok(g.azione(0, { tipo: 'prova', enigma: 'porta', valore: st.porta.soluzione }).errore);
  // si aprono i tre enigmi
  st.enigmi.forEach((e, i) => { ora += 2000; assert.ok(g.azione(i % 3, { tipo: 'prova', enigma: i, valore: e.soluzione }).aperto); });
  assert.ok(g.vista(0).enigmi.every((e) => e.parti.every((pt) => pt.blocchi)), 'aperto un enigma, i pezzi li vedono tutti');
  assert.strictEqual(g.vista(1).frammenti.length, 3);
  assert.ok(g.azione(0, { tipo: 'aiuto', enigma: 0 }).errore, 'niente aiuti su un enigma aperto');
  ora += 2000;
  assert.ok(g.azione(1, { tipo: 'prova', enigma: 'porta', valore: '12' }).errore, 'servono 3 cifre');
  assert.ok(g.azione(1, { tipo: 'prova', enigma: 'porta', valore: st.porta.soluzione }).aperto);
  assert.ok(g.inAttesa && !g.finita, 'si passa alla stanza dopo');
  assert.ok(g.azione(0, { tipo: 'aiuto', enigma: 1 }).errore, 'mentre la porta si apre non si gioca');
  g.avanza();
  assert.strictEqual(g.stanza, 1);
  // pausa delle dispense: l'orologio si ferma
  const r1 = g.restaMs();
  g.impostaPausa(true);
  ora += 60000;
  assert.strictEqual(g.restaMs(), r1, 'in pausa il tempo non passa');
  assert.strictEqual(g.scadenza(), null);
  assert.ok(g.azione(0, { tipo: 'aiuto', enigma: 0 }).errore, 'in pausa non si gioca');
  g.impostaPausa(false);
  assert.strictEqual(g.restaMs(), r1);
  // chi esce lascia i suoi pezzi a un compagno
  const st2 = g.attuale;
  g.esce(0);
  for (const e of st2.enigmi) e.parti.forEach((pt, j) => { if (pt.di === 0) assert.ok(g.vista(1).enigmi[st2.enigmi.indexOf(e)].parti[j].blocchi, 'il pezzo passa al compagno'); });
  g.rientra(0);
  // il tempo scade: si perde
  ora = g.fineAlle + 10;
  assert.ok(g.controllaTempo());
  assert.ok(g.finita && !g.vinto && g.risultato.vincitori.length === 0);
  assert.ok(g.vista(0).enigmi.every((e) => e.soluzione), 'a fine partita si vedono le soluzioni');
  console.log('✓ Escape Room: pezzi segreti, errori −20 s, aiuti −1 min, porta coi frammenti, cambio stanza, pausa, chi esce, tempo scaduto');

  // da soli si vede tutto e si vince
  const s = M.crea({ n: 1, primo: 0, opzioni: { stanze: 3, tempo: 'rilassato' } });
  assert.strictEqual(s.restaMs(), null); assert.strictEqual(s.scadenza(), null);
  for (let k = 0; k < 3; k++) {
    const v = s.vista(0);
    assert.ok(v.enigmi.every((e) => e.parti.every((pt) => pt.blocchi)) && v.porta.simboli, 'da soli si vede tutto');
    s.attuale.enigmi.forEach((e, i) => { ora += 2000; assert.ok(s.azione(0, { tipo: 'prova', enigma: i, valore: e.soluzione }).aperto); });
    ora += 2000;
    assert.ok(s.azione(0, { tipo: 'prova', enigma: 'porta', valore: s.attuale.porta.soluzione }).aperto);
    s.avanza();
  }
  assert.ok(s.finita && s.vinto && s.risultato.vincitori[0] === 0 && s.risultato.crescente);
  assert.ok(/Siete fuggiti in/.test(s.risultato.titolo));
  assert.ok(s.vista(0).tema.fine, 'il finale della storia');
  // 4 stanze: 12 enigmi, nessun tipo ripetuto finché ce ne sono
  const q = M.crea({ n: 4, primo: 1, opzioni: { stanze: 4 } });
  const tipi = q.stanze.flatMap((x) => x.enigmi.map((e) => e.tipo));
  assert.strictEqual(tipi.length, 12);
  assert.ok(new Set(tipi.slice(0, 11)).size === 11, 'i primi 11 enigmi tutti diversi');
  // in 6 tutti hanno qualcosa da fare
  const sei = M.crea({ n: 6, primo: 0, opzioni: { stanze: 4 } });
  const conta = new Array(6).fill(0);
  for (const x of sei.stanze) for (const e of x.enigmi) for (const pt of e.parti) conta[pt.di]++;
  assert.ok(conta.every((c) => c >= 3), `in 6 ognuno ha dei pezzi (${conta.join(' ')})`);
  console.log('✓ Escape Room: da soli si vede tutto, 4 stanze senza enigmi ripetuti, in 6 ognuno ha i suoi pezzi');
} finally {
  Date.now = veroNow;
}
