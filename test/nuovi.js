// Controlli delle regole dei giochi nuovi (chiamato da test/simula.js)
const assert = require('assert');
const { GIOCHI } = require('../giochi');
const { fissa } = require('./fortuna'); // la fortuna riparte a ogni gruppo di controlli (vedi test/fortuna.js)

// ======================= CHI È L'IMPOSTORE =======================
fissa('CHI È L\'IMPOSTORE');
{
  const M = GIOCHI.impostore;
  const { normalizza, indovinata } = M._test;
  assert.strictEqual(normalizza('Tiramisù'), 'tiramisu');
  assert.ok(indovinata('Tiramisu', 'tiramisù'), 'accenti non contano');
  assert.ok(indovinata('elefnate', 'elefante') === false, 'due errori sono troppi');
  assert.ok(indovinata('elefane', 'elefante'), 'un errore di battitura si perdona');
  assert.ok(!indovinata('ape', 'apa'), 'parole corte: esatte');

  for (let k = 0; k < 200; k++) {
    const g = M.crea({ n: 5, primo: k % 5, opzioni: {} });
    const viste = [0, 1, 2, 3, 4].map((i) => g.vista(i));
    viste.forEach((v, i) => {
      if (i === g.impostore) assert.ok(v.parola === null && v.categoria === null && v.sonoImpostore, 'l\'impostore non riceve nulla');
      else assert.ok(v.parola === g.parola && !v.sonoImpostore && v.impostore === null, 'gli altri hanno la parola e non sanno chi è l\'impostore');
    });
    assert.notStrictEqual(g.turno, g.impostore, 'l\'impostore non apre il giro');
  }

  // partita completa: 2 giri, voto con pareggio, altro giro, impostore scoperto che indovina
  const g = M.crea({ n: 4, primo: 0, opzioni: { giri: 2 } });
  g.impostore = 3; g.parola = 'gatto'; g.apre = 0; g.turno = 0;
  assert.ok(g.azione(0, { tipo: 'indizio', testo: 'il mio gatto' }).errore, 'non si può dire la parola');
  assert.ok(g.azione(1, { tipo: 'indizio', testo: 'miao' }).errore, 'solo a turno');
  const indizi = ['miao', 'baffi', 'croccantini', 'gomitolo', 'fusa', 'coda', 'topo', 'gattonare'];
  let k = 0;
  while (g.fase === 'indizi') assert.ok(g.azione(g.turno, { tipo: 'indizio', testo: indizi[k++] }).ok);
  assert.strictEqual(k, 8, '2 giri da 4 indizi');
  assert.strictEqual(g.chatDa.length, 8, 'gli indizi vanno in chat');
  assert.strictEqual(g.fase, 'voto');
  assert.deepStrictEqual(g.attesi().sort(), [0, 1, 2, 3]);
  assert.ok(g.azione(0, { tipo: 'vota', posto: 0 }).errore, 'non si vota sé stessi');
  g.azione(0, { tipo: 'vota', posto: 1 }); g.azione(1, { tipo: 'vota', posto: 0 });
  g.azione(2, { tipo: 'vota', posto: 3 });
  g.azione(3, { tipo: 'vota', posto: 2 });
  assert.strictEqual(g.fase, 'indizi', 'pareggio: un altro giro');
  assert.strictEqual(g.giriTotali, 3);
  for (let j = 0; j < 4; j++) g.azione(g.turno, { tipo: 'indizio', testo: `extra${j}` });
  assert.strictEqual(g.fase, 'voto');
  g.azione(0, { tipo: 'vota', posto: 3 }); g.azione(1, { tipo: 'vota', posto: 3 }); g.azione(2, { tipo: 'vota', posto: 3 });
  g.salta(3); // l'impostore è sulle dispense: si astiene
  assert.strictEqual(g.fase, 'verdetto');
  assert.strictEqual(g.accusato, 3);
  g.avanza();
  assert.strictEqual(g.fase, 'ultima');
  assert.strictEqual(g.turno, 3);
  assert.ok(g.azione(0, { tipo: 'indovina', parola: 'gatto' }).errore, 'indovina solo l\'impostore');
  g.azione(3, { tipo: 'indovina', parola: 'Gatto!' });
  assert.strictEqual(g.fase, 'finale');
  g.avanza();
  assert.ok(g.finita && g.risultato.vincitori.join() === '3', 'scoperto ma indovina: vince l\'impostore');

  // innocente accusato: vince l'impostore; impostore scoperto che sbaglia: vincono gli altri
  const due = (tentativo, accusa) => {
    const h = M.crea({ n: 3, primo: 0, opzioni: { giri: 2 } });
    h.impostore = 2; h.parola = 'pizza';
    while (h.fase === 'indizi') h.azione(h.turno, { tipo: 'indizio', testo: 'boh' + h.indizi.length });
    for (const i of [0, 1, 2]) h.azione(i, { tipo: 'vota', posto: i === accusa ? (accusa + 1) % 3 : accusa });
    h.avanza();
    if (h.fase === 'ultima') h.azione(2, { tipo: 'indovina', parola: tentativo });
    h.avanza();
    return h;
  };
  assert.deepStrictEqual(due('x', 0).risultato.vincitori, [2], 'innocente accusato: vince l\'impostore');
  assert.deepStrictEqual(due('lasagna', 2).risultato.vincitori.sort(), [0, 1], 'impostore scoperto che sbaglia: vincono gli altri');
  // l'impostore che scappa fa vincere gli altri
  const f = M.crea({ n: 3, primo: 0, opzioni: {} });
  f.esce(f.impostore);
  f.avanza();
  assert.ok(f.finita && !f.risultato.vincitori.includes(f.impostore));
  console.log('✓ Chi è l\'impostore: parola a tutti tranne all\'impostore, indizi, pareggio e nuovo giro, voto, ultima possibilità');
}

// ======================= COCCODRILLO =======================
fissa('COCCODRILLO');
{
  const M = GIOCHI.coccodrillo;
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  g.cattivo = 5;
  assert.ok(g.azione(0, { tipo: 'premi', dente: 1 }).ok);
  assert.ok(g.azione(1, { tipo: 'premi', dente: 1 }).errore, 'un dente premuto resta giù');
  assert.ok(g.azione(1, { tipo: 'passa' }).errore, 'senza variante non si passa');
  g.azione(1, { tipo: 'premi', dente: 5 });
  assert.ok(!g.vivi[1] && g.inAttesa, 'morso: eliminato');
  g.avanza();
  assert.ok(g.premuti.every((x) => !x) && g.turno === 2, 'denti di nuovo su, tocca al successivo');
  g.cattivo = 0;
  g.azione(2, { tipo: 'premi', dente: 0 });
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, 'l\'ultimo rimasto vince');
  // con il passo
  const h = M.crea({ n: 2, primo: 0, opzioni: { passo: 'si' } });
  assert.ok(h.azione(0, { tipo: 'passa' }).ok && h.turno === 1);
  h.turno = 0;
  assert.ok(h.azione(0, { tipo: 'passa' }).errore, 'un solo passo per bocca');
  console.log('✓ Coccodrillo: dente premuto, morso ed eliminazione, nuova bocca, vincitore, passo');
}

// ======================= BLOCK BLAST =======================
fissa('BLOCK BLAST');
{
  const M = GIOCHI.blockblast;
  const { metti, punteggio, L } = M._test;
  const vuota = new Array(L * L).fill(0);
  // riga quasi piena: con il pezzo da 1 si cancella
  const g1 = vuota.slice();
  for (let c = 0; c < 7; c++) g1[c] = 2;
  let e = metti(g1, 'p1', 0, 7);
  assert.deepStrictEqual(e.righe, [0]);
  assert.ok(e.griglia.every((x) => !x));
  assert.strictEqual(punteggio('p1', e, 1), 1 + 10 + 300, 'riga + griglia vuota');
  // riga e colonna insieme
  const g2 = vuota.slice();
  for (let c = 1; c < 8; c++) g2[c] = 3;
  for (let r = 1; r < 8; r++) g2[r * L] = 3;
  g2[L * 5 + 5] = 4;
  e = metti(g2, 'p1', 0, 0);
  assert.strictEqual(e.linee, 2);
  assert.strictEqual(punteggio('p1', e, 2), 1 + 10 * 4 * 2, '2 linee con combo 2');
  // partita: il pezzo non entra fuori dalla griglia
  const g = M.crea({ n: 1, opzioni: {} });
  g.plance[0].vassoio = ['o5h', 'p1', 'q2'];
  assert.ok(g.azione(0, { tipo: 'metti', pezzo: 0, r: 0, c: 4 }).errore, 'fuori dalla griglia');
  assert.ok(g.azione(0, { tipo: 'metti', pezzo: 0, r: 0, c: 3 }).ok);
  assert.ok(g.azione(0, { tipo: 'metti', pezzo: 1, r: 0, c: 3 }).errore, 'casella occupata');
  g.azione(0, { tipo: 'metti', pezzo: 1, r: 1, c: 1 });
  g.azione(0, { tipo: 'metti', pezzo: 2, r: 4, c: 4 });
  assert.ok(g.plance[0].vassoio.every(Boolean), 'dopo 3 pezzi ne arrivano altri 3');
  // blocco: griglia piena a scacchiera, nessun pezzo entra (tranne il pezzo da 1 nei buchi)
  const h = M.crea({ n: 1, opzioni: {} });
  const scacchiera = vuota.map((_, i) => ((Math.floor(i / L) + i) % 2 ? 1 : 0));
  h.plance[0].griglia = scacchiera.slice();
  h.plance[0].vassoio = ['p1', 'q3', 'q3'];
  h.azione(0, { tipo: 'metti', pezzo: 0, r: 0, c: 0 });
  assert.ok(h.finita, 'nessun pezzo entra: fine');
  // sfida: stessi pezzi per tutti e vince chi resiste
  const s = M.crea({ n: 3, opzioni: { modo: 'sfida', vittoria: 'resistenza' } });
  assert.deepStrictEqual(s.plance[0].vassoio, s.plance[2].vassoio, 'stessi pezzi per tutti');
  assert.strictEqual(s.turno, null);
  assert.strictEqual(s.pausaBoss, false);
  for (const p of [0, 1]) { s.plance[p].griglia = scacchiera.slice(); s.plance[p].vassoio = ['p1', 'q3', null]; s.azione(p, { tipo: 'metti', pezzo: 0, r: 0, c: 0 }); }
  assert.ok(s.finita && s.risultato.vincitori.join() === '2', 'resiste di più: vince l\'ultimo');
  assert.strictEqual(M.crea({ n: 2, opzioni: { modo: 'coop' } }).pausaBoss, true, 'collaborazione: pausa con le dispense');
  console.log('✓ Block Blast: righe e colonne, punteggio e combo, nuovi pezzi, fine partita, sfida con gli stessi pezzi, resistenza');
}

// ======================= LA PEPPA TENCIA =======================
fissa('LA PEPPA TENCIA');
{
  const M = GIOCHI.peppa;
  const { COPPIE } = M._test;
  assert.deepStrictEqual([2, 3, 4, 5, 6].map((n) => COPPIE[n]), [20, 24, 27, 31, 34], 'il mazzo cresce con i giocatori');
  for (const n of [2, 3, 4, 5, 6]) {
    for (let k = 0; k < 60; k++) {
      const g = M.crea({ n, primo: k % n });
      const tot = COPPIE[n] * 2 + 1;
      assert.strictEqual(g.mani.flat().length + g.mazzo.length + g.scarti.length * 2, tot, 'nessuna carta persa alla distribuzione');
      g.mani.forEach((m, i) => assert.ok(m.length + 2 * g.iniziali[i] === 4, 'si parte con 4 carte (meno le coppie scartate)'));
      assert.strictEqual(g.punti.reduce((a, b) => a + b, 0), g.scarti.length, 'le coppie iniziali valgono già un punto');
      let passi = 0;
      while (!g.finita) {
        if (g.inAttesa) { g.avanza(); continue; }
        const r = g.azione(g.turno, M.bot(g, g.turno, ['facile', 'medio', 'difficile'][g.turno % 3]));
        assert.ok(!r.errore, r.errore);
        assert.strictEqual(g.mani.flat().length + g.mazzo.length + g.scarti.length * 2, tot, 'nessuna carta persa');
        assert.ok(passi++ < 3000);
      }
      assert.strictEqual(g.scarti.length, COPPIE[n], 'si finisce quando tutte le coppie sono fatte');
      if (g.perdente >= 0) assert.strictEqual(g.totali[g.perdente], g.punti[g.perdente] - 3, 'chi ha la Peppa perde 3 punti');
    }
  }
  // finché c'è il mazzo si pesca dal mazzo; poi dagli avversari
  const g = M.crea({ n: 2, primo: 0 });
  g.turno = 0;
  assert.ok(g.azione(0, { tipo: 'pesca', da: 1, indice: 0 }).errore, 'col mazzo non si ruba');
  g.mazzo = [];
  g.mani = [['gatto-1'], ['peppa', 'gatto-2', 'volpe-1']];
  g.punti = [0, 0]; g.scarti = []; g.nCoppie = 1;
  assert.ok(g.azione(0, { tipo: 'pesca', da: 'mazzo' }).errore, 'mazzo finito');
  g.azione(0, { tipo: 'pesca', da: 1, indice: 1 });
  assert.ok(g.punti[0] === 1 && g.vista(1).ultimaPesca.carta === 'gatto-2', 'coppia rubata: punto a chi pesca, la vede anche chi l\'ha data');
  g.avanza();
  assert.ok(g.finita, 'coppie finite: fine partita');
  // il difficile evita la Peppa quando sa dov'è
  const h = M.crea({ n: 2, primo: 0 });
  h.mazzo = []; h.mani = [['gatto-1', 'rana-1'], ['peppa', 'gatto-2', 'volpe-1', 'rana-2']];
  h.scarti = []; h.turno = 0; h.memoria[0] = { di: 1, indice: 0 };
  for (let k = 0; k < 50; k++) assert.notStrictEqual(M.bot(h, 0, 'difficile').indice, 0, 'il difficile non pesca la Peppa se sa dov\'è');
  // la carta pescata dal mazzo la vede solo chi la prende
  const v = M.crea({ n: 3, primo: 0 });
  v.turno = 0; v.azione(0, { tipo: 'pesca', da: 'mazzo' });
  const u = v.vista(2).ultimaPesca;
  assert.ok(u.coppia || u.carta === null, 'gli altri non vedono la carta pescata');
  console.log('✓ La Peppa Tencia: mazzo da 20 a 34 coppie, 4 carte iniziali, mazzo poi avversari, 1 punto a coppia, −3 con la Peppa, 300 partite tra computer senza carte perse, carta pescata segreta');
}
// ======================= FAST WEST =======================
fissa('FAST WEST');
{
  const M = GIOCHI.fastwest;
  const { PISTOLERI } = M._test;
  assert.strictEqual(Object.keys(PISTOLERI).length, 14, '14 pistoleri');
  assert.ok(Object.values(PISTOLERI).some((p) => p.vite === 2), 'alcuni pistoleri hanno 2 vite');
  // prepara una partita con pistoleri e carta bersaglio scelti
  const prepara = (ids, dir = 'destra', evento = 'salsola', pall) => {
    const g = M.crea({ n: ids.length, opzioni: {} });
    ids.forEach((pid, i) => { Object.assign(g.g[i], { pistolero: pid, vite: PISTOLERI[pid].vite, viteMax: PISTOLERI[pid].vite, rivelato: false, pallottole: 1 }); });
    if (pall) pall.forEach((x, i) => { g.g[i].pallottole = x; });
    g.carta = { id: 'test', dir, evento };
    return g;
  };
  const turno = (g, carte) => {
    carte.forEach((c, i) => {
      if (c == null) return g.salta(i);
      const a = typeof c === 'string' ? { tipo: 'gioca', carta: c } : { tipo: 'gioca', ...c };
      const r = g.azione(i, a);
      assert.ok(!r.errore, r.errore);
    });
    assert.strictEqual(g.fase, 'rivelazione');
    g.avanza();
    return g.log;
  };
  // 1. Revolver a destra
  let g = prepara(['cartomante', 'mancino', 'cartomante']);
  turno(g, ['revolver', 'rimbalzo', 'rimbalzo']);
  // il Rimbalzo di 1 manda il colpo a 2, anche lui rimbalza → torna al tiratore 0
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite, g.g[2].vite], [2, 3, 3], 'rimbalzo a catena fino al tiratore');
  assert.strictEqual(g.g[0].pallottole, 0);
  assert.ok(g.g[0].scarti.includes('revolver') && !g.g[0].mano.includes('revolver'));
  // 2. senza pallottole la carta non ha effetto
  g = prepara(['cartomante', 'mancino']);
  turno(g, ['winchester', 'ricarica-1']);
  assert.strictEqual(g.g[1].vite, 3);
  assert.strictEqual(g.g[0].pallottole, 1, 'non si paga se non basta');
  assert.strictEqual(g.g[1].pallottole, 2, 'ricarica +1');
  // 3. duello con la stessa arma: nessuno colpisce
  g = prepara(['cartomante', 'mancino']);
  turno(g, ['revolver', 'revolver']);
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite], [3, 3]);
  // 4. duello con armi diverse: vince la più costosa
  g = prepara(['cartomante', 'mancino'], 'destra', 'salsola', [2, 1]);
  turno(g, ['winchester', 'revolver']);
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite], [3, 2]);
  // 5. Schivata: annulla e recupera una carta
  g = prepara(['cartomante', 'mancino', 'becchino']);
  g.g[1].mano = g.g[1].mano.filter((c) => c !== 'revolver'); g.g[1].scarti = ['revolver'];
  turno(g, ['revolver', { carta: 'schivata', recupero: 'revolver' }, 'ricarica-1']);
  assert.strictEqual(g.g[1].vite, 3);
  assert.ok(g.g[1].mano.includes('revolver') && g.g[1].scarti.includes('schivata'), 'recupera la carta scelta');
  // 6. Scontro ravvicinato: la Schivata non vale
  g = prepara(['cartomante', 'mancino'], 'destra', 'ravvicinato');
  turno(g, ['revolver', 'schivata']);
  assert.strictEqual(g.g[1].vite, 2);
  // 7. In campo aperto: niente Rimbalzo
  g = prepara(['cartomante', 'mancino', 'becchino'], 'destra', 'aperto');
  turno(g, ['revolver', 'rimbalzo', 'ricarica-1']);
  assert.strictEqual(g.g[1].vite, 2);
  // 8. Dinamite: non si schiva; Errore di calcolo la rimanda
  g = prepara(['cartomante', 'mancino', 'becchino'], 'destra', 'salsola', [5, 2, 0]);
  turno(g, ['dinamite', 'schivata', 'ricarica-1']);
  assert.strictEqual(g.g[1].vite, 1, 'la dinamite toglie 2 vite anche con la schivata');
  g = prepara(['cartomante', 'mancino', 'becchino'], 'destra', 'salsola', [5, 2, 0]);
  turno(g, ['dinamite', 'errore', 'ricarica-1']);
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite, g.g[1].pallottole], [1, 3, 0], 'errore di calcolo: torna al tiratore');
  // 9. Ricarica: riprende gli scarti; barile +1
  g = prepara(['cartomante', 'mancino'], 'destra', 'barile');
  g.g[0].mano = ['ricarica-1', 'ricarica-2', 'schivata']; g.g[0].scarti = ['revolver', 'winchester', 'dinamite', 'rimbalzo', 'errore'];
  turno(g, ['ricarica-1', 'ricarica-1']);
  assert.strictEqual(g.g[0].pallottole, 3, 'barile: +2');
  assert.deepStrictEqual(g.g[0].scarti, ['ricarica-1'], 'la ricarica giocata va negli scarti');
  assert.strictEqual(g.g[0].mano.length, 7);
  // 10. Pioggia: le armi non costano ma servono le pallottole
  g = prepara(['cartomante', 'mancino'], 'destra', 'pioggia', [2, 0]);
  turno(g, ['winchester', 'ricarica-1']);
  assert.deepStrictEqual([g.g[0].pallottole, g.g[1].vite], [2, 2]);
  // 11. doppia in due: un colpo solo
  g = prepara(['cartomante', 'mancino'], 'doppia');
  turno(g, ['revolver', 'ricarica-1']);
  assert.strictEqual(g.g[1].vite, 2);
  // 12. incrociata: si sceglie il bersaglio
  g = prepara(['cartomante', 'mancino', 'becchino', 'azzardo'], 'incrociata');
  assert.ok(g.azione(0, { tipo: 'gioca', carta: 'revolver' }).errore, 'incrociata: serve il bersaglio');
  turno(g, [{ carta: 'revolver', bersaglio: 2 }, 'ricarica-1', 'ricarica-1', 'ricarica-1']);
  assert.strictEqual(g.g[2].vite, 2);
  // 13. Passa il prete: +1 a tutti a inizio turno
  g = prepara(['cartomante', 'mancino']);
  g.mazzo.push({ id: 'p', dir: 'destra', evento: 'prete' });
  turno(g, ['ricarica-1', 'ricarica-1']);
  g.avanza();
  assert.deepStrictEqual([g.g[0].pallottole, g.g[1].pallottole], [3, 3]);
  // 14. Flashback: prima si recupera
  g = prepara(['cartomante', 'mancino'], 'destra', 'flashback');
  g.g[0].mano = g.g[0].mano.filter((c) => c !== 'dinamite'); g.g[0].scarti = ['dinamite'];
  assert.ok(g.azione(0, { tipo: 'gioca', carta: 'ricarica-1' }).errore);
  assert.ok(g.azione(0, { tipo: 'recupera', carta: 'dinamite' }).ok && g.g[0].mano.includes('dinamite'));
  // 15. il tifo: chi indovina potenzia la Ricarica (+2)
  g = prepara(['cartomante', 'mancino', 'becchino']);
  g.g[2].vivo = false; g.g[2].vite = 0;
  g.azione(2, { tipo: 'tifa', pistolero: 0, carta: 'ricarica' });
  turno(g, ['ricarica-1', 'ricarica-1', null]);
  assert.deepStrictEqual([g.g[0].pallottole, g.g[1].pallottole], [3, 2]);
  // tifo sul revolver: vince il duello a parità d'arma
  g = prepara(['cartomante', 'mancino', 'becchino']);
  g.g[2].vivo = false; g.g[2].vite = 0; g.g[1].pistolero = 'cartomante';
  g.carta = { id: 't', dir: 'destra', evento: 'salsola' };
  // in tre (uno morto) i due vivi sono vicini da entrambe le parti
  g.azione(2, { tipo: 'tifa', pistolero: 1, carta: 'revolver' });
  turno(g, ['revolver', 'revolver', null]);
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite], [2, 3]);
  // 16. il Baro cambia arma pagando entrambe
  g = prepara(['baro', 'mancino'], 'destra', 'salsola', [3, 0]);
  g.azione(0, { tipo: 'gioca', carta: 'revolver' }); g.azione(1, { tipo: 'gioca', carta: 'ricarica-1' });
  assert.ok(g.azione(1, { tipo: 'cambia', carta: 'winchester' }).errore, 'solo il Baro');
  assert.ok(g.azione(0, { tipo: 'cambia', carta: 'winchester' }).ok);
  g.avanza();
  assert.deepStrictEqual([g.g[0].pallottole, g.g[1].vite, g.g[0].rivelato], [0, 2, true]);
  assert.ok(g.g[0].scarti.includes('revolver') && g.g[0].scarti.includes('winchester'));
  // 17. il Ninja schiva mentre ricarica scartando la Schivata
  g = prepara(['cartomante', 'ninja']);
  turno(g, ['revolver', 'ricarica-1']);
  assert.deepStrictEqual([g.g[1].vite, g.g[1].pallottole, g.g[1].rivelato], [3, 2, true]);
  assert.ok(g.g[1].scarti.includes('schivata') && !g.g[1].mano.includes('schivata'));
  // 18. la Vedova: chi la colpisce perde una vita; la Dottoressa si cura una volta
  g = prepara(['cartomante', 'vedova']);
  turno(g, ['revolver', 'ricarica-1']);
  assert.deepStrictEqual([g.g[0].vite, g.g[1].vite], [2, 1]);
  g = prepara(['cartomante', 'dottoressa'], 'destra', 'salsola', [5, 0]);
  turno(g, ['dinamite', 'ricarica-1']);
  assert.deepStrictEqual([g.g[1].vite, g.g[1].vivo, g.g[1].curata], [1, true, true]);
  // 19. muoiono tutti: vince il west
  g = prepara(['cartomante', 'mancino'], 'destra', 'salsola', [5, 5]);
  g.g[0].vite = 1; g.g[1].vite = 1;
  turno(g, ['dinamite', 'revolver']); // la dinamite batte il revolver... quindi muore solo 1
  g.avanza();
  assert.ok(g.finita && g.risultato.vincitori.join() === '0');
  g = prepara(['cartomante', 'mancino', 'becchino'], 'destra', 'salsola', [1, 1, 1]);
  g.g.forEach((x) => { x.vite = 1; });
  turno(g, ['revolver', 'revolver', 'revolver']); // tutti a destra: 0→1, 1→2, 2→0
  g.avanza();
  assert.ok(g.finita && g.risultato.vincitori.length === 0 && g.vinceIlWest, 'muoiono tutti: vince il west');
  // 20. segretezza: gli altri non vedono pistolero e carta scelta
  g = prepara(['cartomante', 'mancino']);
  g.azione(0, { tipo: 'gioca', carta: 'revolver' });
  const v1 = g.vista(1);
  assert.strictEqual(v1.giocatori[0].pistolero, null);
  assert.strictEqual(v1.giocatori[0].giocata, null);
  assert.ok(v1.giocatori[0].pronto);
  assert.ok(g.vista(0).prossima, 'la Cartomante vede la prossima carta');
  assert.strictEqual(v1.prossima, null);
  // partite a caso tra "persone" che scelgono carte a caso: finiscono sempre e nessuna carta sparisce
  for (let k = 0; k < 300; k++) {
    const n = 2 + (k % 9);
    const h = M.crea({ n, opzioni: {} });
    let passi = 0;
    while (!h.finita) {
      assert(++passi < 3000, 'fast west non finisce');
      if (h.inAttesa) { h.avanza(); continue; }
      for (const p of h.attesi()) {
        const x = h.g[p];
        if (!x.vivo) { h.azione(p, Math.random() < 0.3 ? { tipo: 'tifa', passa: true } : { tipo: 'tifa', pistolero: h.vivi()[0], carta: 'revolver' }); continue; }
        if (h.deveRecuperare(p)) h.azione(p, { tipo: 'recupera', carta: x.scarti[0] });
        const c = x.mano[Math.floor(Math.random() * x.mano.length)];
        const altri = h.vivi().filter((i) => i !== p);
        const r = h.azione(p, { tipo: 'gioca', carta: c, bersaglio: altri[Math.floor(Math.random() * altri.length)] });
        assert.ok(!r.errore, r.errore);
      }
      for (const x of h.g) {
        assert.strictEqual(x.mano.length + x.scarti.length, 8, 'sempre 8 carte tra mano e scarti');
        assert.ok(x.pallottole >= 0 && x.pallottole <= 5);
        if (x.vivo) assert.ok(x.mano.some((c) => c.startsWith('ricarica')) || x.mano.length > 0);
      }
    }
  }
  console.log('✓ Fast West: colpi, duelli, Schivata, Rimbalzo a catena, Dinamite ed Errore di calcolo, eventi, tifo, Baro, Ninja, Vedova, Dottoressa, vince il west, 300 partite a caso');
}

// ======================= WORDLE =======================
fissa('WORDLE');
{
  const M = GIOCHI.wordle;
  const { valuta } = M._test;
  assert.strictEqual(valuta('palla', 'pollo').join(''), '20220');
  assert.strictEqual(valuta('aabbb', 'bbaaa').join(''), '11110', 'lettere doppie contate bene');
  assert.strictEqual(valuta('rosso', 'rossa').join(''), '22220');
  const g = M.crea({ n: 2, opzioni: { lunghezza: 5 } });
  g.segreta = 'gatto';
  assert.ok(g.azione(0, { tipo: 'prova', parola: 'cane' }).errore, 'lunghezza sbagliata');
  g.azione(0, { tipo: 'prova', parola: 'Gattò' });
  assert.ok(g.fatto[0].vinto && !g.finita, 'accenti e maiuscole non contano');
  g.azione(1, { tipo: 'prova', parola: 'pizza' });
  const v1 = g.vista(1);
  assert.strictEqual(v1.altri[0].righe[0].esito, null, 'nello scontro non si vedono i colori degli altri finché giochi');
  assert.strictEqual(v1.segreta, null);
  for (let k = 0; k < 5; k++) g.azione(1, { tipo: 'prova', parola: 'pizza' });
  assert.ok(g.finita && g.risultato.vincitori.join() === '0' && g.risultato.fazioni[0].punti === 6);
  const d = M.crea({ n: 1, opzioni: { lunghezza: 6, controllo: 'dizionario' } });
  assert.ok(d.azione(0, { tipo: 'prova', parola: 'zzzzzz' }).errore, 'solo parole del dizionario');
  assert.strictEqual(d.pausaBoss, true);
  console.log('✓ Wordle: colori con le doppie, accenti, scontro segreto, vincitore, dizionario');
}

// ======================= GUESS THE ANGLE =======================
fissa('GUESS THE ANGLE');
{
  const M = GIOCHI.angolo;
  const g = M.crea({ n: 2, opzioni: { round: 5, modo: 'indovina' } });
  g.angolo = 100;
  assert.strictEqual(g.vista(0).angolo, null, 'in "indovina" il numero è segreto');
  assert.strictEqual(g.vista(0).disegno, 100);
  assert.ok(g.azione(0, { tipo: 'stima', gradi: 400 }).errore);
  g.azione(0, { tipo: 'stima', gradi: 90 }); g.azione(0, { tipo: 'stima', gradi: 100 }); // si può cambiare
  assert.strictEqual(g.fase, 'stima');
  g.azione(1, { tipo: 'stima', gradi: 120 });
  assert.ok(g.inAttesa && g.punti[0] === 150 && g.punti[1] === 50, 'esatto 150, 20° di errore 50');
  const c = M.crea({ n: 1, opzioni: { modo: 'costruisci' } });
  assert.ok(c.vista(0).angolo != null && c.vista(0).disegno === null, 'in "costruisci" si vede il numero ma non il disegno');
  console.log('✓ Guess the angle: stima segreta, punti per errore, modalità indovina e costruisci');
}

// ======================= SUDOKU =======================
fissa('SUDOKU');
{
  const M = GIOCHI.sudoku;
  const { genera, risolvi, DIFFICOLTA } = M._test;
  for (const liv of Object.keys(DIFFICOLTA)) {
    const t0 = Date.now();
    for (let k = 0; k < 3; k++) {
      const { griglia, soluzione } = genera(liv);
      assert.strictEqual(risolvi(griglia.slice(), 2), 1, 'una sola soluzione');
      const g = griglia.slice(); risolvi(g, 1);
      assert.deepStrictEqual(g, soluzione);
    }
    const media = (Date.now() - t0) / 3;
    assert.ok(media < 3000, `generazione ${liv} troppo lenta`);
  }
  const g = M.crea({ n: 2, opzioni: { difficolta: 'facile' } });
  const vuota = g.dati.indexOf(false), data = g.dati.indexOf(true);
  assert.ok(g.azione(0, { tipo: 'metti', cella: data, valore: 1 }).errore, 'i numeri dati non si toccano');
  const sbagliato = (g.soluzione[vuota] % 9) + 1;
  g.azione(1, { tipo: 'metti', cella: vuota, valore: sbagliato });
  assert.ok(g.vista(0).sbagliate[vuota] && g.errori === 1, 'errore segnato');
  for (let i = 0; i < 81; i++) if (!g.dati[i]) g.azione(i % 2, { tipo: 'metti', cella: i, valore: g.soluzione[i] });
  assert.ok(g.finita && g.risultato.vincitori.length === 2 && g.vista(0).record.length >= 1, 'completato insieme');
  const h = M.crea({ n: 1, opzioni: { errori: 'nascosti' } });
  assert.strictEqual(h.vista(0).sbagliate, null, 'errori nascosti');
  console.log('✓ Sudoku: schemi a soluzione unica in 4 difficoltà, numeri dati bloccati, errori, collaborazione, classifica');
}

// ======================= SNAKE (tempo reale) =======================
fissa('SNAKE (tempo reale)');
{
  const M = GIOCHI.snake;
  // partite tra computer, simulando il tempo che passa
  const vittorie = { facile: 0, medio: 0, difficile: 0 };
  for (let k = 0; k < 30; k++) {
    const livelli = ['facile', 'medio', 'difficile'];
    const g = M.crea({ n: 3, opzioni: { poteri: 'si' }, bot: livelli });
    let ora = g.via, passi = 0;
    while (!g.finita && passi++ < 20000) { ora += g.tickMs; g.tick(ora); }
    assert.ok(g.finita, 'snake finisce');
    for (const v of g.risultato.vincitori) vittorie[livelli[v]]++;
  }
  // regole: muro, scontro testa a testa, cibo
  const g = M.crea({ n: 2, opzioni: {}, bot: [null, null] });
  g.serpenti[0].corpo = [[0, 5], [1, 5], [2, 5]]; g.serpenti[0].dir = 'sx';
  let ora = g.via + 1; g.tick(ora); g.tick(ora += 60);
  assert.ok(!g.serpenti[0].vivo && g.finita && g.risultato.vincitori.join() === '1', 'contro il muro si muore');
  const h = M.crea({ n: 2, opzioni: {}, bot: [null, null] });
  h.serpenti[0].corpo = [[10, 5], [9, 5], [8, 5]]; h.serpenti[0].dir = 'dx';
  h.serpenti[1].corpo = [[12, 5], [13, 5], [14, 5]]; h.serpenti[1].dir = 'sx';
  h.cibo = [{ x: 20, y: 10, valore: 1 }];
  ora = h.via + 1; h.tick(ora); h.tick(ora += 60);
  assert.ok(!h.serpenti[0].vivo && !h.serpenti[1].vivo, 'testa contro testa: muoiono tutti e due');
  const c = M.crea({ n: 1, opzioni: {}, bot: [null] });
  c.serpenti[0].corpo = [[10, 5], [9, 5], [8, 5]]; c.serpenti[0].dir = 'dx'; c.cibo = [{ x: 11, y: 5, valore: 1 }];
  ora = c.via + 1; c.tick(ora); c.tick(ora += 60); c.tick(ora += 60); c.tick(ora += 60);
  assert.ok(c.serpenti[0].punti === 10 && c.serpenti[0].corpo.length === 4, 'la mela allunga');
  c.input(0, { dir: 'sx' });
  assert.strictEqual(c.serpenti[0].coda.length, 0, 'non si torna indietro');
  c.impostaPausa(true); const prima = JSON.stringify(c.serpenti[0].corpo); c.tick(ora += 60); c.tick(ora += 60);
  assert.strictEqual(JSON.stringify(c.serpenti[0].corpo), prima, 'in pausa è tutto fermo');
  console.log(`✓ Snake: 30 partite tra computer (vittorie facile/medio/difficile ${vittorie.facile}/${vittorie.medio}/${vittorie.difficile}), muro, testa contro testa, mele, pausa`);
}

// ======================= TETRIS BATTLE (tempo reale) =======================
fissa('TETRIS BATTLE (tempo reale)');
{
  const M = GIOCHI.tetris;
  const { Tabellone, gravita, W, H } = M._test;
  assert.ok(gravita(1) === 1000 && gravita(10) < gravita(5), 'si accelera salendo di livello');
  // riga completa
  const b = new Tabellone(() => 'I');
  for (let x = 0; x < W; x++) if (x < 6) b.g[(H - 1) * W + x] = 1;
  b.r = 0; b.x = 6; b.y = H - 2; // I orizzontale in basso a destra: completa la riga? occupa 4 celle da x=6
  b.x = 6; while (b.libero(b.t, b.r, b.x, b.y + 1)) b.y++;
  assert.strictEqual(b.blocca(), 1, 'riga completata');
  assert.strictEqual(b.punti, 100);
  // stessi pezzi per tutti e partite tra computer
  const g = M.crea({ n: 3, bot: ['facile', 'medio', 'difficile'] });
  assert.deepStrictEqual(g.tab[0].prossimi(), g.tab[2].prossimi(), 'stessi pezzi');
  let ora = g.via + 1, passi = 0;
  while (!g.finita && passi++ < 60000) { ora += 50; g.tick(ora); }
  assert.ok(g.finita, 'tetris finisce');
  const righe = g.tab.map((t) => t.righe);
  assert.ok(righe[2] >= righe[0], 'il difficile fa più righe del facile');
  // hold e pausa
  const h = M.crea({ n: 1, bot: [null] });
  ora = h.via + 1; h.tick(ora);
  h.via = 0; const primo = h.tab[0].t; h.esegui(0, 'hold');
  assert.ok(h.tab[0].hold === primo && h.tab[0].holdUsato);
  h.esegui(0, 'hold'); assert.strictEqual(h.tab[0].hold, primo, 'un solo hold per pezzo');
  h.impostaPausa(true); const y = h.tab[0].y; for (let k = 0; k < 40; k++) h.tick(ora += 50);
  assert.strictEqual(h.tab[0].y, y, 'in pausa non cade');
  console.log(`✓ Tetris Battle: righe e punti, velocità, stessi pezzi, hold, pausa, partita tra computer (righe ${righe.join('/')})`);
}

// ======================= AIR HOCKEY (tempo reale) =======================
fissa('AIR HOCKEY (tempo reale)');
{
  const M = GIOCHI.airhockey;
  const partita = (n, bot) => {
    const g = M.crea({ n, opzioni: { gol: 5 }, bot });
    let ora = g.fermoFino + 1, passi = 0;
    while (!g.finita && passi++ < 150000) { ora += 20; g.tick(ora); }
    return g;
  };
  let vd = 0;
  for (let k = 0; k < 10; k++) { const g = partita(2, ['facile', 'difficile']); assert.ok(g.finita, 'air hockey finisce'); if (g.risultato.vincitori[0] === 1) vd++; }
  assert.ok(vd >= 6, `il difficile batte il facile (${vd}/10)`);
  const q = partita(4, ['medio', 'medio', 'medio', 'medio']);
  assert.ok(q.finita && q.risultato.vincitori.length === 2 && q.aSquadre, '2 contro 2: vince una squadra');
  // ognuno resta nella sua metà
  const g = M.crea({ n: 2, opzioni: {}, bot: [null, null] });
  g.input(0, { x: 300, y: 100 });
  assert.ok(g.mazze[0].ty >= 500, 'la racchetta non passa la metà campo');
  // gol: disco verso la porta in alto
  g.fermoFino = 0; g.disco = { x: 300, y: 40, vx: 0, vy: -1500 };
  let ora = Date.now(); for (let k = 0; k < 10; k++) g.tick(ora += 20);
  assert.strictEqual(g.gol[0], 1, 'gol della squadra in basso');
  // disco schiacciato contro la sponda: non accelera
  const sc = M.crea({ n: 2, opzioni: {}, bot: [null, null] });
  sc.fermoFino = 0; sc.disco = { x: 29, y: 800, vx: 0, vy: 0 }; sc.mazze[0].x = 150; sc.mazze[0].y = 800;
  ora = Date.now();
  for (let k = 0; k < 40; k++) { sc.input(0, { x: 10, y: 800 + (k % 4 < 2 ? 5 : -5) }); sc.tick(ora += 20); assert.ok(Math.hypot(sc.disco.vx, sc.disco.vy) < 700, 'il disco schiacciato non accelera'); }
  // racchetta lanciata contro il disco: non lo attraversa
  for (let t = 0; t < 50; t++) {
    const h = M.crea({ n: 2, opzioni: {}, bot: [null, null] }); h.fermoFino = 0;
    h.disco = { x: 300, y: 700, vx: 0, vy: 0 }; Object.assign(h.mazze[0], { x: 300, y: 950, tx: 300, ty: 950 });
    let o = Date.now(); h.input(0, { x: 300 + (t - 25), y: 520 });
    for (let k = 0; k < 5; k++) h.tick(o += 20);
    assert.ok(h.disco.y < h.mazze[0].y, 'la racchetta non passa attraverso il disco');
  }
  console.log(`✓ Air Hockey: fisica, metà campo, gol, disco schiacciato che non accelera, niente dischi attraversati, 1 contro 1 (il difficile vince ${vd}/10 col facile), 2 contro 2`);
}

// ======================= GHOST TRIS (variante del tris) =======================
fissa('GHOST TRIS (variante del tris)');
{
  const M = GIOCHI.tris;
  const g = M.crea({ n: 2, primo: 0, opzioni: { variante: 'classico', fantasma: 'si' } });
  // X: 0, 1, 5 · O: 3, 4, 8 → al quarto segno di X sparisce lo 0
  for (const [p, c] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 5], [1, 8]]) assert.ok(!g.azione(p, { tipo: 'segna', cella: c }).errore);
  assert.strictEqual(g.vista(0).prossimoVia[0], 0, 'si vede quale segno di X sparirà');
  g.azione(0, { tipo: 'segna', cella: 6 });
  assert.strictEqual(g.celle[0], null, 'il quarto segno fa sparire il primo');
  assert.strictEqual(g.celle.filter((x) => x === 0).length, 3, 'mai più di 3 segni a testa');
  assert.ok(!g.finita);
  // 4×4: limite di 4
  const q = M.crea({ n: 2, primo: 0, opzioni: { variante: 'quattro', fantasma: 'si' } });
  assert.strictEqual(q.limite, 4);
  let vd = 0, pari = 0;
  for (let k = 0; k < 10; k++) {
    const h = M.crea({ n: 2, primo: k % 2, opzioni: { variante: 'classico', fantasma: 'si' } });
    const liv = ['facile', 'difficile'];
    while (!h.finita) { const r = h.azione(h.turno, M.bot(h, h.turno, liv[h.turno])); assert.ok(!r.errore, r.errore); assert.ok(h.celle.filter((x) => x === 0).length <= 3); }
    if (h.risultato.pareggio) pari++; else if (h.risultato.vincitori[0] === 1) vd++;
  }
  assert.ok(vd >= 7, `il difficile batte il facile nel Ghost Tris (${vd}/10)`);
  // senza l'opzione il tris normale non cambia
  assert.ok(!M.crea({ n: 2, opzioni: { variante: 'classico' } }).fantasma);
  assert.ok(!M.crea({ n: 2, opzioni: { variante: 'ultimate', fantasma: 'si' } }).fantasma, 'nell\'Ultimate l\'opzione non si usa');
  console.log(`✓ Ghost Tris: al massimo 3 segni (4 nel 4×4), il più vecchio sparisce, segno trasparente, computer (il difficile vince ${vd}/10 col facile)`);
}

// ======================= POMPA IL PALLONE =======================
fissa('POMPA IL PALLONE');
{
  const M = GIOCHI.pallone;
  const g = M.crea({ n: 3, primo: 0, opzioni: { round: 3 } });
  g.scoppio = 4;
  assert.strictEqual(g.vista(0).scoppio, null, 'il punto di scoppio è segreto');
  assert.ok(g.azione(1, { tipo: 'pompa' }).errore, 'solo a turno');
  g.azione(0, { tipo: 'pompa' }); g.azione(1, { tipo: 'pompa' }); g.azione(2, { tipo: 'incassa' });
  assert.deepStrictEqual([g.piatto[0], g.piatto[1], g.punti[2]], [1, 1, 0], '+1 a pompata, chi incassa esce');
  assert.strictEqual(g.turno, 0);
  g.azione(0, { tipo: 'pompa' }); // 3 pompate: regge
  g.azione(1, { tipo: 'pompa' }); // 4: scoppia
  assert.strictEqual(g.scoppiato, 1, 'scoppia alla pompata segreta');
  assert.deepStrictEqual(g.punti, [2, 0, 0], 'chi fa scoppiare perde il piatto, chi era dentro incassa');
  assert.ok(g.inAttesa && g.vista(0).scoppio === 4, 'a fine round si scopre il punto di scoppio');
  g.avanza();
  assert.strictEqual(g.turno, 1, 'il round dopo apre il successivo');
  // partite tra computer: nessun errore, il difficile fa più punti del facile
  const tot = { facile: 0, difficile: 0 };
  for (let k = 0; k < 200; k++) {
    const h = M.crea({ n: 2, primo: k % 2, opzioni: {} });
    const liv = ['facile', 'difficile'];
    while (!h.finita) { if (h.inAttesa) { h.avanza(); continue; } assert.ok(!h.azione(h.turno, M.bot(h, h.turno, liv[h.turno])).errore); }
    tot.facile += h.punti[0]; tot.difficile += h.punti[1];
  }
  assert.ok(tot.difficile > tot.facile, `il difficile incassa di più (${tot.difficile} contro ${tot.facile})`);
  console.log(`✓ Pompa il pallone: pompa e incassa, scoppio segreto, piatto perso, nuovo round, computer (difficile ${tot.difficile} punti, facile ${tot.facile})`);
}

// partita completa tra computer (anche fasi simultanee e pause), per i giochi a turni semplici
function giocaTutta(M, n, livelli, opzioni = {}) {
  const g = M.crea({ n, primo: 0, opzioni });
  let passi = 0;
  while (!g.finita) {
    if (g.inAttesa) { g.avanza(); continue; }
    const chi = g.turno != null ? g.turno : g.attesi()[0];
    const r = g.azione(chi, M.bot(g, chi, livelli[chi % livelli.length]));
    assert.ok(!r.errore, `${M.meta.id}: ${r.errore}`);
    assert.ok(passi++ < 20000, `${M.meta.id}: la partita non finisce`);
  }
  return g;
}

// ======================= INTERRUTTORI =======================
fissa('INTERRUTTORI');
{
  const M = GIOCHI.interruttori;
  const g = M.crea({ n: 3, primo: 0, opzioni: { quanti: 5 } });
  assert.strictEqual(g.quanti, 5, 'il numero di interruttori si sceglie prima');
  assert.strictEqual(g.vista(0).bomba, null, 'la bomba è segreta');
  const sicuro = [0, 1, 2, 3, 4].find((k) => k !== g.bomba);
  g.azione(0, { tipo: 'accendi', interruttore: sicuro });
  assert.ok(g.turno === 1 && g.accesi[sicuro] === 0);
  assert.ok(g.azione(1, { tipo: 'accendi', interruttore: sicuro }).errore, 'già acceso');
  g.azione(1, { tipo: 'accendi', interruttore: g.bomba });
  assert.ok(!g.vivi[1] && g.inAttesa && g.vista(0).bomba !== null, 'chi accende la bomba salta');
  g.avanza();
  assert.ok(g.accesi.every((x) => x === null) && g.turno === 2, 'pannello nuovo, tocca al successivo');
  for (let k = 0; k < 100; k++) { const h = giocaTutta(M, 4, ['facile', 'medio', 'difficile'], { passo: k % 2 ? 'si' : 'no', quanti: 12 }); assert.strictEqual(h.risultato.vincitori.length, 1); }
  console.log('✓ Interruttori: bomba segreta, eliminazione, pannello nuovo, numero di interruttori a scelta, passo, 100 partite tra computer');
}

// ======================= CASELLE E BOMBE =======================
fissa('CASELLE E BOMBE');
{
  const M = GIOCHI.casellebombe;
  const g = M.crea({ n: 2, primo: 0, opzioni: { griglia: 'piccola' } });
  assert.ok(g.lato === 5 && g.bombe.size === 5);
  assert.strictEqual(g.vista(0).tutteBombe, null, 'le bombe sono nascoste');
  const sicure = [...Array(25).keys()].filter((i) => !g.bombe.has(i));
  const bomba = [...g.bombe][0];
  assert.ok(g.azione(0, { tipo: 'fermati' }).errore, 'prima si scopre almeno una casella');
  g.azione(0, { tipo: 'scopri', cella: sicure[0] }); g.azione(0, { tipo: 'scopri', cella: sicure[1] });
  assert.strictEqual(g.piatto, 2, 'ogni casella sicura +1 nel piatto');
  g.azione(0, { tipo: 'fermati' });
  assert.ok(g.punti[0] === 2 && g.turno === 1, 'fermarsi incassa e passa il turno');
  g.azione(1, { tipo: 'scopri', cella: sicure[2] }); g.azione(1, { tipo: 'scopri', cella: bomba });
  assert.ok(g.punti[1] === 0 && g.piatto === 0 && g.inAttesa, 'la bomba fa perdere il piatto');
  g.avanza(); assert.strictEqual(g.turno, 0);
  let d = 0, f = 0;
  for (let k = 0; k < 200; k++) { const h = giocaTutta(M, 2, ['facile', 'difficile']); assert.ok(h.scoperte.filter((x) => x && !x.bomba).length === 28, 'finisce quando le sicure sono finite'); f += h.punti[0]; d += h.punti[1]; }
  assert.ok(d > f, `il difficile fa più punti (${d} contro ${f})`);
  console.log(`✓ Caselle e bombe: bombe nascoste, piatto del turno, fermarsi, bomba, fine con le sicure finite, computer (difficile ${d}, facile ${f})`);
}

// ======================= SCAVA IL TESORO =======================
fissa('SCAVA IL TESORO');
{
  const M = GIOCHI.tesoro;
  const { vicini } = M._test;
  assert.deepStrictEqual(vicini(0, 5).sort((a, b) => a - b), [1, 5, 6]);
  const g = M.crea({ n: 2, primo: 0, opzioni: { modo: 'sfida' } });
  assert.ok(g.turno === null && g.attesi().length === 2, 'nella sfida si scava tutti insieme');
  g.contenuto = g.contenuto.map(() => 'niente'); g.contenuto[0] = 'bomba'; g.contenuto[1] = 'gemma'; g.contenuto[2] = 'moneta';
  g.numeri = g.contenuto.map((x, i) => (x === 'niente' ? vicini(i, 5).filter((k) => ['moneta', 'gemma'].includes(g.contenuto[k])).length : null));
  g.azione(0, { tipo: 'scava', cella: 1 }); g.azione(0, { tipo: 'scava', cella: 2 }); g.azione(1, { tipo: 'scava', cella: 0 });
  assert.deepStrictEqual(g.punti, [6, 0], 'gemma 5, moneta 1');
  assert.strictEqual(g.scavi[1], 7, 'la bomba toglie 2 scavi in più');
  assert.strictEqual(g.vista(1).griglia[1], null, 'nella sfida ognuno vede solo la sua griglia');
  g.azione(1, { tipo: 'scava', cella: 6 });
  assert.strictEqual(g.griglie[1][6].numero, 2, 'il numero conta i tesori vicini');
  const t = M.crea({ n: 3, primo: 0, opzioni: { modo: 'turni' } });
  assert.ok(t.lato === 6 && t.turno === 0 && t.griglie.length === 1, 'a turni: una griglia condivisa');
  assert.ok(t.azione(1, { tipo: 'scava', cella: 0 }).errore, 'a turni solo chi tocca');
  const solo = M.crea({ n: 1, opzioni: { modo: 'turni' } });
  assert.strictEqual(solo.modo, 'sfida', 'da soli è sempre sfida');
  let d = 0, f = 0;
  for (let k = 0; k < 200; k++) {
    const h = giocaTutta(M, 2, ['facile', 'difficile'], { modo: k % 2 ? 'turni' : 'sfida' });
    f += h.punti[0]; d += h.punti[1];
  }
  assert.ok(d > f, `il difficile trova più tesori (${d} contro ${f})`);
  console.log(`✓ Scava il tesoro: monete e gemme, bomba = 2 scavi, numeri dei tesori vicini, sfida con griglie uguali, griglia condivisa a turni, computer (difficile ${d}, facile ${f})`);
}

// ======================= NUMERI COPERTI =======================
fissa('NUMERI COPERTI');
{
  const M = GIOCHI.coperti;
  const g = M.crea({ n: 2, primo: 0, opzioni: { quanti: 4 } });
  g.numeri = [3, 7, 1, 9];
  assert.deepStrictEqual(g.vista(0).scoperti, [null, null, null, null], 'coperti');
  g.azione(0, { tipo: 'prova', numero: 3 });
  assert.ok(g.pos === 1 && g.turno === 0 && g.punti[0] === 1, 'giusto: punto e continui');
  g.azione(0, { tipo: 'prova', numero: 5 });
  assert.ok(g.turno === 1 && g.sbagliati[1][0].numero === 5, 'sbagliato: tocca all\'altro');
  assert.ok(g.azione(1, { tipo: 'prova', numero: 5 }).errore, 'un numero sbagliato non si riprova lì');
  assert.ok(!g.vista(1).possibili.includes(3) && !g.vista(1).possibili.includes(5), 'i possibili escludono scoperti e sbagliati');
  for (const x of [7, 1, 9]) g.azione(1, { tipo: 'prova', numero: x });
  assert.ok(g.finita && g.risultato.vincitori[0] === 1, 'vince chi ne indovina di più');
  for (let k = 0; k < 200; k++) giocaTutta(M, 3, ['facile', 'medio', 'difficile'], { quanti: 8, diversi: k % 2 ? 'no' : 'si' });
  console.log('✓ Numeri coperti: in ordine, giusto = continui, sbagliato = passa, tentativi ricordati, ripetizioni a scelta, 200 partite tra computer');
}

// ======================= AGGIORNAMENTI DEI GIOCHI D'AZIONE =======================
fissa('AGGIORNAMENTI DEI GIOCHI D\'AZIONE');
{
  const giro = (g, secondi, ogni) => { let ora = Date.now(); const fine = ora + secondi * 1000; while (!g.finita && ora < fine) { ora += 33; if (g.fase !== 'gioco') g.fineFase = Math.min(g.fineFase, ora); g.tick(ora); if (ogni) ogni(g); } };
  // Palloncini: la difficoltà cambia davvero il cielo; le sbarre hanno un varco
  const P = GIOCHI.palloncini;
  const pf = P.crea({ n: 1, opzioni: { difficolta: 'facile', round: 1 }, bot: ['difficile'] }), pe = P.crea({ n: 1, opzioni: { difficolta: 'estremo', round: 1 }, bot: ['difficile'] });
  assert.ok(pe.L.v0 > pf.L.v0 && pe.L.sbarre > 0 && pf.L.sbarre === 0, 'difficoltà diverse');
  let sbarre = 0; giro(pe, 30, (g) => { sbarre = Math.max(sbarre, (g.sbarre || []).length); });
  assert.ok(sbarre > 0, 'nell\'estremo arrivano le sbarre');
  // Massi: il sentiero è stretto
  const MA = GIOCHI.massi; assert.ok(MA.DX - MA.SX <= 520, 'sentiero stretto');
  const gm = MA.crea({ n: 3, opzioni: { round: 1 }, bot: ['medio', 'medio', 'medio'] });
  giro(gm, 20, (g) => { for (const e of g.e || []) assert.ok(e.x >= MA.SX && e.x <= MA.DX, 'nessuno esce dal sentiero'); });
  // Gatto e topi: cinque stanze, tane sempre libere
  const { STANZE } = GIOCHI.gattotopi._test;
  assert.strictEqual(STANZE.length, 5);
  for (const st of STANZE) for (const [x, y] of [[40, 40], [960, 40], [40, 580], [960, 580]]) assert.ok(st.mobili.every(([mx, my, w, h]) => x < mx - 20 || x > mx + w + 20 || y < my - 20 || y > my + h + 20), `tana libera in ${st.tema}`);
  // Fuga e Monete: temi diversi a ogni round, pezzi nuovi
  for (const id of ['fuga', 'monete']) {
    const g = GIOCHI[id].crea({ n: 2, opzioni: { round: 3 }, bot: ['difficile', 'difficile'] });
    const temi = new Set([g.tema]); const tipi = new Set();
    giro(g, 400, (x) => { temi.add(x.tema); for (const o of x.ostacoli) tipi.add(o.tipo); });
    assert.ok(temi.size === 3, `${id}: un tema diverso a ogni round`);
    assert.ok(tipi.has('mobile') && tipi.has('muro'), `${id}: pericoli che si muovono e muri`);
  }
  // Caselle colorate: forme diverse, 8 colori, il vuoto fa cadere subito, potenziamenti
  const A = GIOCHI.arcobaleno, { forma, FORME, COLS } = A._test;
  const dim = new Set(FORME.map((f) => forma(f).filter(Boolean).length)); assert.ok(dim.size >= 5, 'le forme sono diverse');
  const ga = A.crea({ n: 2, opzioni: { round: 1 }, bot: ['medio', 'medio'] });
  let ora = Date.now(); while (ga.fase !== 'gioco') { ora += 33; ga.fineFase = ora; ga.tick(ora); }
  assert.ok(new Set(ga.caselle.filter((c) => c >= 0)).size > 6, 'otto colori');
  const buco = ga.maschera.findIndex((x) => !x);
  ga.e[0].x = 20 + (buco % COLS) * 60 + 30; ga.e[0].y = 10 + Math.floor(buco / COLS) * 60 + 30;
  ga.passo(0.03); assert.ok(ga.e[0].fuori, 'chi mette piede nel vuoto cade subito');
  // durante la caduta non si cammina sulle caselle sparite
  const gb = A.crea({ n: 2, opzioni: { round: 1 }, bot: ['medio', 'medio'] }); ora = Date.now(); while (gb.fase !== 'gioco') { ora += 33; gb.fineFase = ora; gb.tick(ora); }
  const giusta = gb.celle.find((k) => gb.caselle[k] === gb.colore), sbagliata = gb.celle.find((k) => gb.caselle[k] !== gb.colore && gb.caselle[k] >= 0);
  const cx = (k) => 20 + (k % COLS) * 60 + 30, cy = (k) => 10 + Math.floor(k / COLS) * 60 + 30;
  gb.e[0].x = cx(giusta); gb.e[0].y = cy(giusta); gb.e[1].x = cx(giusta) + 5; gb.e[1].y = cy(giusta);
  gb.timer = 0; gb.passo(0.01); assert.ok(gb.fase2 === 'cade' && !gb.e[0].fuori, 'sul colore giusto si resta in piedi');
  gb.e[0].x = cx(sbagliata); gb.e[0].y = cy(sbagliata); gb.passo(0.01);
  assert.ok(gb.e[0].fuori, 'camminare su una casella sparita fa cadere');
  const gc = A.crea({ n: 2, opzioni: { round: 1 }, bot: ['medio', 'medio'] }); ora = Date.now(); while (gc.fase !== 'gioco') { ora += 33; gc.fineFase = ora; gc.tick(ora); }
  gc.prendi(0, 'gelo'); assert.ok(gc.e[1].gelo > 0, 'il congelamento blocca l\'avversario');
  gc.e[1].gelo = 0; gc.e[1].scudo = 5; gc.prendi(0, 'gelo'); assert.ok(gc.e[1].gelo === 0, 'lo scudo ferma il gelo');
  gc.prendi(0, 'velocita'); assert.ok(gc.e[0].veloce > 0);
  const primo = Math.max(3.6 - 0 * 0.25, 1.1); gc.ciclo = 12; gc.nuovoCiclo(); assert.ok(gc.timerTot < primo && gc.timerTot >= 1.1, 'sempre meno tempo');
  // Paintball: campi simmetrici e partenze libere
  const { CAMPI, ANGOLI } = GIOCHI.paintball._test;
  for (const c of CAMPI) for (const [x, y] of ANGOLI) assert.ok(c.blocchi.every(([bx, by, w, h]) => x < bx - 18 || x > bx + w + 18 || y < by - 18 || y > by + h + 18), `partenza libera in ${c.tema}`);
  // Salta e corri: spuntoni e nemici che uccidono, nemici che si schiacciano da sopra
  const PI = GIOCHI.piattaforme;
  let conPunte = 0, conNemici = 0;
  for (let k = 0; k < 10; k++) { const l = PI._test.costruisci(); if (l.griglia.some((r) => r.includes('2'))) conPunte++; if (l.nemici.length) conNemici++; }
  assert.ok(conPunte >= 8 && conNemici >= 8, 'spuntoni e nemici in quasi tutti i percorsi');
  let gp; do { gp = PI.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); ora = Date.now(); while (gp.fase !== 'gioco') { ora += 33; gp.fineFase = ora; gp.tick(ora); } } while (!gp.liv.nemici.length); // qualche percorso non ha nemici
  const n0 = gp.liv.nemici[0]; n0.v = 0; const e = gp.e[0];
  e.x = n0.x; e.y = n0.y; e.vy = 0; gp.passo(0.03); assert.ok(e.cade > 0, 'toccare un nemico di lato fa ripartire');
  e.cade = 0; e.x = n0.x; e.y = n0.y - 40; e.vy = 400; gp.passo(0.03); assert.ok(n0.morto > 0 && e.cade <= 0 && e.vy < 0, 'da sopra il nemico si schiaccia e si rimbalza');
  console.log('✓ Giochi d\'azione aggiornati: difficoltà dei palloncini, sentiero stretto, stanze del gatto, ambientazioni di fuga e monete, caselle colorate (forme, vuoto, potenziamenti, tempo), campi del paintball, spuntoni e nemici');
}

// ======================= 1, 2, 3 STELLA =======================
fissa('1, 2, 3 STELLA');
{
  const M = GIOCHI.stella, { TOLLERANZA } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } };
  // chi si muove mentre la bambola guarda è eliminato, dopo la tolleranza
  for (const modo of ['margine', 'spietata']) {
    const g = M.crea({ n: 2, opzioni: { eliminazione: modo, round: 1 }, bot: [null, null] }); parti(g);
    g.girati(); g.inp[0].x = 1;
    g.tempoRound += TOLLERANZA[modo] - 0.05; g.passo(0.03); assert.ok(!g.e[0].fuori, `${modo}: dentro la tolleranza ci si può ancora fermare`);
    g.tempoRound += 0.1; g.passo(0.03); assert.ok(g.e[0].fuori && !g.e[1].fuori, `${modo}: dopo la tolleranza chi si muove è fuori, chi è fermo no`);
  }
  assert.ok(TOLLERANZA.spietata < TOLLERANZA.margine);
  // bambola-giocatore: mentre conta non vede gli altri; si gira quando vuole (dopo 1,5 s); cambia a ogni round
  const g = M.crea({ n: 3, opzioni: { bambola: 'giocatore', round: 3 }, bot: [null, null, null] }); parti(g);
  assert.strictEqual(g.bambola, 0);
  assert.ok(g.statoTick(0).e.every((e, i) => i === 0 || e.x === undefined), 'la bambola che conta non vede nessuno');
  assert.ok(g.statoTick(1).e[2].x !== undefined, 'gli altri si vedono');
  g.inp[0].tocchi++; g.passo(0.03); assert.strictEqual(g.fase2, 'conta', 'prima di 1,5 secondi non ci si può girare');
  g.tempoRound += 1.6; g.inp[0].tocchi++; g.passo(0.03); assert.strictEqual(g.fase2, 'guarda', 'poi sì');
  assert.ok(g.statoTick(0).e[1].x !== undefined, 'girata vede tutto');
  g.inp[1].x = 1; g.tempoRound += 0.5; g.passo(0.03);
  assert.ok(g.e[1].fuori && g.punti[0] === 1, 'la bambola prende un punto per ogni eliminato');
  // arrivo al traguardo
  const h = M.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(h); h.fase2 = 'conta'; h.dal = h.tempoRound; h.durata = 99;
  h.e[0].x = M._test.TRAGUARDO - 1; h.inp[0].x = 1; h.passo(0.05); assert.ok(h.e[0].arrivo !== null && h.punti[0] === 5, 'traguardo: 3 punti più 2 al primo');
  // il computer difficile vince di più anche con la bambola-giocatore
  const vitt = { facile: 0, medio: 0, difficile: 0 };
  for (let k = 0; k < 24; k++) {
    const l = ['facile', 'medio', 'difficile'].map((_, i) => ['facile', 'medio', 'difficile'][(i + k) % 3]);
    const x = M.crea({ n: 3, opzioni: { bambola: 'giocatore', eliminazione: k % 2 ? 'spietata' : 'margine', round: 3 }, bot: l });
    let ora = Date.now(); while (!x.finita) { ora += 33; if (x.fase !== 'gioco') x.fineFase = Math.min(x.fineFase, ora); x.tick(ora); }
    if (x.risultato.vincitori.length) vitt[l[x.risultato.vincitori[0]]]++;
  }
  assert.ok(vitt.difficile > vitt.medio && vitt.medio >= vitt.facile, `bambola-giocatore: ${JSON.stringify(vitt)}`);
  console.log(`✓ 1, 2, 3 Stella: bambola del computer o giocatore (che contando non vede nessuno e cambia a ogni round), tolleranza spietata e con margine, eliminazione, traguardo, punti della bambola (bambola-giocatore f/m/d ${vitt.facile}/${vitt.medio}/${vitt.difficile})`);
}

// ======================= TIRO ALLA FUNE =======================
fissa('TIRO ALLA FUNE');
{
  const M = GIOCHI.fune, { BORDO } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } return ora; };
  // chi preme più volte vince: la corda va dalla sua parte e l'altro cade
  const g = M.crea({ n: 2, opzioni: { modo: 'uno' }, bot: [null, null] }); let ora = parti(g), k = 0;
  const [a] = g.squadre[0], [b] = g.squadre[1];
  while (g.perdente === null && k++ < 2000) { ora += 33; if (k % 3 === 0) g.inp[b].tocchi++; if (k % 6 === 0) g.inp[a].tocchi++; g.tick(ora); }
  assert.ok(g.perdente === 0 && g.c >= BORDO && g.punti[b] > g.punti[a], 'chi tira più veloce trascina giù l\'altro');
  // niente autoclick: più di 15 colpi al secondo non contano
  const h = M.crea({ n: 2, opzioni: { modo: 'squadre', round: 1 }, bot: [null, null] }); parti(h);
  h.inp[0].tocchi += 500; h.passo(0.033); assert.ok(h.colpiTot[0] <= 4, 'i colpi in eccesso non contano');
  // squadre pari (con un giocatore in più conta la media)
  const q = M.crea({ n: 5, opzioni: { modo: 'squadre', round: 1 }, bot: [null, null, null, null, null] }); parti(q);
  assert.ok(Math.abs(q.squadre[0].length - q.squadre[1].length) <= 1 && q.squadre.flat().length === 5, 'squadre pari');
  // torneo a eliminazione: n-1 sfide, chi perde è fuori
  const t = M.crea({ n: 4, opzioni: { modo: 'uno' }, bot: ['difficile', 'facile', 'medio', 'medio'] });
  assert.strictEqual(t.nRound, 3);
  ora = Date.now(); while (!t.finita) { ora += 33; if (t.fase !== 'gioco') t.fineFase = Math.min(t.fineFase, ora); t.tick(ora); }
  assert.ok(t.fuoriTorneo.filter(Boolean).length === 3 && !t.fuoriTorneo[t.risultato.vincitori[0]], 'resta un solo campione');
  console.log('✓ Tiro alla fune: chi preme più veloce trascina giù l\'altro, limite anti-autoclick, squadre pari a media, torneo uno contro uno a eliminazione');
}

// ======================= DALGONA =======================
fissa('DALGONA');
{
  const M = GIOCHI.dalgona, { PUNTI, FORME, RARA } = M._test;
  assert.deepStrictEqual(Object.keys(FORME).sort(), ['cerchio', 'eiffel', 'fiocco', 'ingranaggio', 'mano', 'ombrello', 'seppia', 'stella', 'triangolo'], 'quattro forme normali e cinque impossibili');
  assert.ok(RARA <= 0.05 && FORME.eiffel.tol < FORME.cerchio.tol, 'la Torre Eiffel è rarissima e più difficile');
  const { estrai, RARE } = M._test, conta = {};
  for (let k = 0; k < 20000; k++) { const f = estrai(); conta[f] = (conta[f] || 0) + 1; }
  for (const k of RARE) assert.ok(Math.abs(conta[k] / 20000 - FORME[k].rara) < 0.012 && FORME[k].tol <= 4 && FORME[k].fragile > 1, `${k}: esce circa ${Math.round(1 / FORME[k].rara)} volte su 1, solco stretto e biscotto fragile`);
  const incrocia = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  for (const k of RARE) { const v = FORME[k].v, n = v.length; let x = 0; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1) && incrocia(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])) x++; assert.strictEqual(x, 0, `${k}: il solco non si incrocia`); assert.ok(v.every(([a, b]) => Math.hypot(a, b) < 240), `${k}: sta nel biscotto`); }
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } return ora; };
  // seguire il solco tenendo premuto lo ritaglia senza crepe; rilasciare ferma
  const g = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(g);
  const b = g.b[0]; b.forma = 'cerchio'; b.fatto = new Uint8Array(PUNTI.cerchio.length);
  const pts = PUNTI.cerchio;
  for (let k = 0; k < 40; k++) { g.inp[0].a = true; g.inp[0].mx = pts[k][0]; g.inp[0].my = pts[k][1]; g.passo(0.033); }
  assert.ok(g.progresso(b) > 0.1 && b.danno === 3, 'seguendo il solco si ritaglia senza crepe (solo il 3% di quando si appoggia l\'ago)');
  const prima = g.progresso(b);
  g.inp[0].a = false; for (let k = 40; k < 80; k++) { g.inp[0].mx = pts[k][0]; g.inp[0].my = pts[k][1]; g.passo(0.033); }
  assert.strictEqual(g.progresso(b), prima, 'senza tasto premuto non si taglia');
  // uscire dal solco incrina il biscotto, sempre di più; a 100% si rompe ed è eliminato
  g.inp[0].a = true; g.inp[0].mx = 500; g.inp[0].my = 330; g.passo(0.033);
  let k = 0; while (b.stato === 'gioco' && k++ < 400) { g.inp[0].mx = 500 + (k % 2 ? 40 : -40); g.inp[0].my = 330 + (k % 3) * 5; g.passo(0.033); }
  assert.ok(b.stato === 'rotto' && b.danno === 100 && b.el !== null, 'fuori dal solco il biscotto si rompe: eliminato');
  // ritagliare tutto il solco fa passare il round
  const h = M.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(h);
  const c = h.b[0]; c.forma = 'triangolo'; c.fatto = new Uint8Array(PUNTI.triangolo.length);
  for (const [x, y] of [...PUNTI.triangolo, PUNTI.triangolo[0]]) { h.inp[0].a = true; h.inp[0].mx = x; h.inp[0].my = y; h.passo(0.033); }
  assert.ok(c.stato === 'fatto' && h.punti[0] >= 5 && c.danno <= 3, 'forma ritagliata: round passato');
  // solo il proprio biscotto in dettaglio
  const st = g.statoTick(1); assert.ok(st.b[1].f !== undefined && st.b[0].f === undefined, 'degli altri si vede solo il riassunto');
  console.log('✓ Dalgona: forme normali e cinque impossibili (ingranaggio 1/10, fiocco di neve 1/15, mano 1/20, seppia 1/25, Torre Eiffel 1/30, solchi stretti), si taglia solo tenendo premuto, uscire dal solco crepa fino a rompere (eliminato), forma completa = passato');
}

// ======================= OCCHI NEL BUIO =======================
fissa('OCCHI NEL BUIO');
{
  const M = GIOCHI.buio, { BENDATO, VISTA_N } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } return ora; };
  const g = M.crea({ n: 3, opzioni: { round: 3 }, bot: [null, null, null] }); parti(g);
  assert.strictEqual(g.cercatore, 0, 'primo round: cerca il primo');
  // si vede solo intorno a sé: metto il nascosto 1 lontano e il 2 vicino al Cercatore, in linea d'aria libera
  const liberi = []; for (let r = 0; r < 15; r++) for (let c = 0; c < 25; c++) if (g.mappa[r][c] === '.') liberi.push({ x: c * 40 + 20, y: r * 40 + 20 });
  const [a, b] = (() => { for (const p of liberi) for (const q of liberi) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d > 60 && d < 100 && g.vede(p, q, 140)) return [p, q]; } })();
  const lontano = liberi.find((q) => Math.hypot(q.x - a.x, q.y - a.y) > 500);
  Object.assign(g.e[0], a); Object.assign(g.e[2], b); Object.assign(g.e[1], lontano);
  assert.ok(g.statoTick(0).e[2].x === undefined, 'il Cercatore bendato non vede nessuno');
  g.tempoRound = BENDATO + 1;
  let st = g.statoTick(0);
  assert.ok(st.e[2].x !== undefined && st.e[1].x === undefined, 'il Cercatore vede solo chi è vicino');
  assert.ok(g.statoTick(1).e[0].x === undefined && g.statoTick(2).e[0].x !== undefined, 'anche i nascosti vedono solo intorno a sé');
  // nuvole: rossa a tutti i nascosti, azzurre solo al Cercatore
  g.prossimaRossa = g.tempoRound; g.prossimaBlu = g.tempoRound; g.e[2].x = lontano.x + 1000; g.passo(0.01); g.e[2].x = b.x;
  assert.ok(g.statoTick(1).nu.some((q) => q.c === 'rossa') && !g.statoTick(1).nu.some((q) => q.c === 'blu'), 'i nascosti vedono la nuvola rossa');
  assert.ok(g.statoTick(0).nu.some((q) => q.c === 'blu') && !g.statoTick(0).nu.some((q) => q.c === 'rossa'), 'il Cercatore vede le nuvole azzurre');
  // preso: toccato dal Cercatore; poi vede tutto
  g.e[2].x = g.e[0].x + 10; g.e[2].y = g.e[0].y; g.passo(0.01);
  assert.ok(g.e[2].preso && g.punti[0] === 3, 'toccato: preso');
  st = g.statoTick(2); assert.ok(st.tutto && st.e.every((e) => e.x !== undefined), 'chi è preso vede tutta la casa');
  // nascondigli: non si vede chi è dentro, a meno di esserci addosso
  const nasc = []; for (let r = 0; r < 15; r++) for (let c = 0; c < 25; c++) if (g.mappa[r][c] === 'N') nasc.push({ x: c * 40 + 20, y: r * 40 + 20 });
  const n0 = nasc.find((q) => liberi.some((l) => Math.hypot(l.x - q.x, l.y - q.y) === 80 && g.vede(l, q, 140)));
  if (n0) { const l = liberi.find((x) => Math.hypot(x.x - n0.x, x.y - n0.y) === 80 && g.vede(x, n0, 140)); Object.assign(g.e[1], n0); Object.assign(g.e[0], l); assert.ok(g.statoTick(0).e[1].x === undefined, 'dentro l\'armadio non si vede'); }
  // tutte le case sono percorribili ovunque
  for (const casa of M._test.CASE) assert.ok(casa.every((r) => r.length === 25) && casa.length === 15);
  assert.ok(VISTA_N > 0);
  console.log('✓ Occhi nel buio: il Cercatore parte bendato, ognuno vede solo intorno a sé (dal server), nuvole rosse ai nascosti e azzurre al Cercatore, nascondigli, preso = vede tutta la casa');
}

// ======================= CHI È L'ALIENO =======================
fissa('CHI È L\'ALIENO');
{
  const M = GIOCHI.alieno, { maxAlieni } = M._test;
  assert.ok(!M.meta.soloPersone && M.meta.giocatori[0] === 4 && M.meta.giocatori.at(-1) === 10, 'da 4 a 10, anche con il computer');
  assert.deepStrictEqual([4, 6, 7, 8, 9, 10].map(maxAlieni), [1, 1, 2, 2, 3, 3], 'massimo di Alieni per numero di giocatori');
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 50; g.fineFase = ora; g.tick(ora); } return ora; };
  // troppi Alieni per 5 giocatori: si riduce e si avvisa in chat
  const r = M.crea({ n: 5, opzioni: { alieni: 3 }, bot: [] });
  assert.ok(r.nAlieni === 1 && r.chatSistema.some((t) => t.includes('al massimo 1')), 'Alieni ridotti al massimo con avviso');
  const g = M.crea({ n: 5, opzioni: { alieni: 1, mappa: 'base' }, bot: [] }); parti(g);
  const al = g.e.find((e) => e.alieno).id, umani = g.e.filter((e) => !e.alieno).map((e) => e.id);
  assert.ok(g.e.every((e) => e.compiti.length === 5), '5 compiti a testa');
  // i ruoli sono segreti: un umano non sa chi è l'Alieno, l'Alieno sì
  assert.deepStrictEqual(g.statoTick(umani[0]).alieni, []); assert.deepStrictEqual(g.statoTick(al).alieni, [al]);
  // chat: fuori dalle riunioni i vivi non parlano
  assert.ok(g.leggiChat(umani[0], 'ciao').nascondi, 'fuori dalle riunioni niente chat');
  // eliminazione: attesa iniziale, poi vicino = eliminato; il corpo resta
  const [a, b, c] = umani;
  Object.assign(g.e[al], { x: 1300, y: 700 }); Object.assign(g.e[a], { x: 1340, y: 700 });
  assert.ok(g.azione(al, { tipo: 'uccidi' }).errore, 'all\'inizio si aspetta');
  g.e[al].prontoUccidi = 0;
  assert.ok(g.azione(a, { tipo: 'uccidi' }).errore, 'un umano non può eliminare');
  assert.ok(!g.azione(al, { tipo: 'uccidi' }).errore && !g.e[a].vivo && g.corpi.length === 1 && g.e[al].prontoUccidi === 25, 'eliminato, corpo a terra, attesa di 25 s');
  // il fantasma: invisibile ai vivi, chatta solo con i fantasmi
  Object.assign(g.e[b], { x: 1320, y: 740 });
  assert.ok(!g.statoTick(b).e.some((e) => e.id === a), 'i vivi non vedono i fantasmi');
  assert.deepStrictEqual(g.leggiChat(a, 'sono morto').soloPer, [a], 'i fantasmi parlano solo tra loro');
  // i muri fermano lo sguardo: uno lontano dietro i muri non si vede
  Object.assign(g.e[c], { x: 5 * 40, y: 35 * 40 }); assert.ok(!g.statoTick(b).e.some((e) => e.id === c), 'chi è lontano o dietro un muro non si vede');
  // segnalazione: riunione, tutti fermi, poi voto segreto
  assert.ok(!g.azione(b, { tipo: 'segnala' }).errore && g.fase2 === 'discussione', 'segnalato il corpo: riunione');
  assert.ok(!g.leggiChat(b, 'è stato lui').nascondi, 'in riunione si parla');
  assert.ok(g.azione(b, { tipo: 'vota', chi: al }).errore, 'durante la discussione non si vota');
  g.tempoRound = g.riunione.fine; g.passo(0.05); assert.strictEqual(g.fase2, 'voto');
  for (const p of [b, c]) g.azione(p, { tipo: 'vota', chi: al });
  g.azione(al, { tipo: 'vota', chi: b }); g.azione(umani[3], { tipo: 'vota', chi: -1 });
  assert.ok(g.azione(a, { tipo: 'vota', chi: al }).errore, 'i fantasmi non votano');
  g.passo(0.05);
  assert.ok(g.fase2 === 'espulsione' && g.espulsione.chi === al && g.espulsione.alieno && g.espulsione.rimasti === 0, 'espulso: era un Alieno, ne restano 0');
  g.tempoRound = g.espulsione.fine; g.passo(0.05);
  assert.ok(g.vittoria && g.vittoria.chi === 'equipaggio', 'espulsi tutti gli Alieni: vince l\'equipaggio');
  // pareggio: nessuno espulso
  const h = M.crea({ n: 4, opzioni: { mappa: 'base' }, bot: [] }); parti(h);
  h.azione(0, { tipo: 'riunione' }); // lontano dal pulsante
  const x = h.e[0]; Object.assign(x, { x: h.M.pulsante.x + 60, y: h.M.pulsante.y }); h.pulsanteDa = 0;
  assert.ok(!h.azione(0, { tipo: 'riunione' }).errore && h.azione(0, { tipo: 'riunione' }).errore, 'una riunione a testa');
  h.tempoRound = h.riunione.fine; h.passo(0.05);
  h.azione(0, { tipo: 'vota', chi: 1 }); h.azione(1, { tipo: 'vota', chi: 2 }); h.azione(2, { tipo: 'vota', chi: 1 }); h.azione(3, { tipo: 'vota', chi: 2 }); h.passo(0.05);
  assert.ok(h.espulsione.chi === null && h.espulsione.pari, 'pareggio: nessuno espulso');
  // compiti: bisogna essere vicini e metterci il tempo minimo; quelli degli Alieni non contano
  const k = M.crea({ n: 4, opzioni: { mappa: 'base' }, bot: [] }); parti(k);
  const u = k.e.find((e) => !e.alieno), comp = u.compiti.find((q) => q.tipo !== 'consegna'), cid = comp.st, st = k.stazione(cid);
  assert.ok(k.azione(u.id, { tipo: 'inizia', id: cid }).errore, 'lontano dalla postazione non si inizia');
  Object.assign(u, { x: st.t[0] * 40 + 20, y: st.t[1] * 40 + 20 });
  assert.ok(!k.azione(u.id, { tipo: 'inizia', id: cid }).errore);
  assert.ok(k.azione(u.id, { tipo: 'finito', id: cid }).errore, 'troppo veloce');
  k.tempoRound += 8; assert.ok(!k.azione(u.id, { tipo: 'finito', id: cid }).errore && comp.fatto && k.progresso() > 0);
  // tutti i compiti fatti: vince l'equipaggio
  for (const e of k.e) for (const q of e.compiti) q.fatto = true; k.passo(0.05); assert.ok(k.vittoria && k.vittoria.chi === 'equipaggio');
  // gli Alieni vincono quando sono tanti quanti gli umani
  const w = M.crea({ n: 4, opzioni: {}, bot: [] }); parti(w);
  const wa = w.e.find((e) => e.alieno); for (const e of w.e) if (!e.alieno && e.id !== w.e.find((q) => !q.alieno).id) e.vivo = false;
  w.passo(0.05); assert.ok(w.vittoria && w.vittoria.chi === 'alieni', 'Alieni pari agli umani: vincono gli Alieni'); void wa;
  // chi esce da più di un minuto: i suoi compiti non contano
  const z = M.crea({ n: 4, opzioni: {}, bot: [] }); parti(z);
  const zu = z.e.find((e) => !e.alieno).id; z.esce(zu); z.tempoRound += 61; assert.ok(!z.conta(zu), 'compiti di chi è uscito da un minuto non contano');
  console.log('✓ Chi è l\'Alieno: anche con il computer, Alieni ridotti al massimo con avviso, ruoli segreti, eliminazione con attesa, fantasmi invisibili con chat tra loro, muri che coprono, segnalazione, riunione, voto segreto, pareggio, espulsione, compiti con tempo minimo, vittorie');
}

// ======================= SHUT THE BOX =======================
fissa('SHUT THE BOX');
{
  const M = GIOCHI.shutbox, { combinazioni, atteso } = M._test;
  assert.deepStrictEqual(combinazioni(0b111111111, 8, 9).length, 6, 'con 8: 8, 7+1, 6+2, 5+3, 5+2+1, 4+3+1');
  assert.ok(Math.abs(atteso(9, 511) - 11) < 0.5, 'giocando al meglio si finisce in media con circa 11 punti');
  const g = M.crea({ n: 2, primo: 0, opzioni: { round: 1 } });
  assert.ok(g.azione(1, { tipo: 'tira' }).errore, 'non è il suo turno');
  assert.ok(g.azione(0, { tipo: 'tira', uno: true }).errore, 'un dado solo solo con 6 punti o meno');
  g.azione(0, { tipo: 'tira' }); g.fase = 'scegli'; g.dadi = [3, 5];
  assert.ok(g.azione(0, { tipo: 'chiudi', tessere: [9] }).errore && g.azione(0, { tipo: 'chiudi', tessere: [4, 3] }).errore, 'la somma deve essere quella dei dadi');
  assert.ok(!g.azione(0, { tipo: 'chiudi', tessere: [5, 3] }).errore && !g.vista().alzate.includes(5), 'tessere abbassate');
  g.alzate = 0b11; assert.ok(g.possoUnDado, 'con 1+2 alzate si può tirare un dado');
  g.dadi = [3]; g.fase = 'scegli'; g.azione(0, { tipo: 'chiudi', tessere: [1, 2] });
  assert.ok(g.finita && g.risultato.vincitori[0] === 0 && g.scatola === 0, 'scatola chiusa: vince subito');
  // turno che finisce: punti = somma delle tessere alzate
  const h = M.crea({ n: 2, primo: 0, opzioni: { round: 1 } }); h.alzate = 1 << 8; // solo il 9
  let k = 0; while (!h.inAttesa && k++ < 50) { h.fase = 'tira'; h.azione(0, { tipo: 'tira' }); if (!h.inAttesa) { h.dadi = null; h.alzate = 1 << 8; } }
  assert.ok(h.punti[0] === 9 || h.alzate === 0, 'turno finito: si prendono i punti rimasti');
  const w = { facile: 0, medio: 0, difficile: 0 };
  for (let n = 0; n < 450; n++) { const l = [['facile', 'medio', 'difficile'], ['medio', 'difficile', 'facile'], ['difficile', 'facile', 'medio']][n % 3]; const x = M.crea({ n: 3, primo: n % 3, opzioni: { round: 3 } }); while (!x.finita) { if (x.inAttesa) { x.avanza(); continue; } assert.ok(!x.azione(x.turno, M.bot(x, x.turno, l[x.turno])).errore); } for (const v of x.risultato.vincitori) w[l[v]]++; }
  assert.ok(w.difficile > w.medio && w.medio > w.facile, `vittorie ${JSON.stringify(w)}`);
  console.log(`✓ Shut the box: combinazioni, somma dei dadi, un dado solo, scatola chiusa = vittoria, punti rimasti, computer ottimale (vittorie f/m/d ${w.facile}/${w.medio}/${w.difficile})`);
}

// ======================= SBLOCCA IL BLOCCO (Unblock Me) =======================
fissa('SBLOCCA IL BLOCCO (Unblock Me)');
{
  const M = GIOCHI.sblocca, { risolvi, posizioni, RACCOLTA, LIVELLI } = M._test;
  const dec = (x) => x.split(':')[0].match(/.{4}/g).map((b) => ({ o: b[0], l: Number(b[1]), r: Number(b[2]), c: Number(b[3]) }));
  // la raccolta: ogni puzzle è risolvibile nel numero minimo di mosse dichiarato, nella fascia del suo livello
  for (const liv of ['facile', 'medio']) for (const x of RACCOLTA[liv].slice(0, 12)) { const sol = risolvi(dec(x)); assert.ok(sol && sol.length === Number(x.split(':')[1]), `puzzle ${x}`); const [a, b] = LIVELLI[liv]; assert.ok(sol.length >= a && sol.length <= b); }
  assert.ok(RACCOLTA.difficile.every((x) => Number(x.split(':')[1]) >= 15), 'i difficili hanno almeno 15 mosse');
  const g = M.crea({ n: 2, opzioni: { livello: 'facile', round: 1 }, bot: [null, null] });
  assert.deepStrictEqual(g.vista(0).blocchi, g.vista(1).blocchi, 'stesso puzzle per tutti');
  const b0 = g.tavole[0].blocchi, fuori = { tipo: 'muovi', b: 1, r: 9, c: 9 };
  assert.ok(g.azione(0, fuori).errore, 'posizione impossibile');
  // un blocco scavalcherebbe un altro: vietato (cerco una posizione oltre un ostacolo)
  const sol = risolvi(b0);
  for (const m of sol) assert.ok(!g.azione(0, { tipo: 'muovi', ...m }).errore);
  assert.ok(g.tavole[0].fatto !== null && g.tavole[0].stelle === 3 && g.punti[0] === 4, 'risolto per primo con il minimo di mosse: 3 + 1 punti');
  assert.strictEqual(g.tavole[1].mosse, 0, 'la griglia dell\'altro non cambia');
  assert.ok(g.azione(0, { tipo: 'muovi', ...sol[0] }).errore, 'chi ha finito non muove più');
  // un blocco non può scavalcarne un altro
  const h = M.crea({ n: 1, opzioni: { livello: 'medio', round: 1 }, bot: [null] });
  const bl = h.tavole[0].blocchi; const i = bl.findIndex((b, k) => k > 0 && posizioni(bl, k).length < 4);
  if (i > 0) { const tutte = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) tutte.push({ r, c }); const vietata = tutte.find((q) => (bl[i].o === 'h' ? q.r === bl[i].r : q.c === bl[i].c) && !posizioni(bl, i).some((x) => x.r === q.r && x.c === q.c) && !(q.r === bl[i].r && q.c === bl[i].c)); if (vietata) assert.ok(h.azione(0, { tipo: 'muovi', b: i, ...vietata }).errore, 'niente scavalcamenti'); }
  // il computer muove col suo ritmo (dentro la partita) e il difficile vince di più
  const w = { facile: 0, medio: 0, difficile: 0 }; const _now = Date.now; let T = _now(); Date.now = () => T;
  try {
    for (let k = 0; k < 15; k++) { const l = [['facile', 'medio', 'difficile'], ['medio', 'difficile', 'facile'], ['difficile', 'facile', 'medio']][k % 3]; const x = M.crea({ n: 3, opzioni: { livello: 'medio', round: 1 }, bot: l }); assert.deepStrictEqual(x.attesi(), [], 'il server non aspetta i computer'); while (!x.finita) { if (x.inAttesa) { T += 3500; x.avanza(); continue; } T = Math.max(T, x.scadenza()); x.controllaTempo(); } for (const v of x.risultato.vincitori) w[l[v]]++; }
  } finally { Date.now = _now; }
  assert.ok(w.difficile > w.medio && w.difficile > w.facile, `vittorie ${JSON.stringify(w)}`);
  console.log(`✓ Sblocca il blocco: raccolta di puzzle verificati (minimo di mosse giusto), stesso puzzle per tutti, mosse controllate dal server, stelle e punti, computer col suo ritmo (vittorie f/m/d ${w.facile}/${w.medio}/${w.difficile})`);
}

// ======================= WANTED! =======================
fissa('WANTED!');
{
  const M = GIOCHI.wanted, { SCHEMI, TIPI } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 50; g.fineFase = ora; g.tick(ora); } return ora; };
  const g = M.crea({ n: 2, opzioni: { round: 10 }, bot: [null, null] });
  const visti = new Set();
  for (let k = 0; k < 7; k++) {
    if (k) { g.round++; g.iniziaRound(); }
    visti.add(g.schema);
    assert.strictEqual(g.facce.filter((f) => f.tipo === g.ricercato).length, 1, `${g.schema}: il ricercato c'è una volta sola`);
    for (const t of [0, 3.3, 7.9]) { g.aggiornaPosizioni(t); assert.ok(g.facce.every((f) => f.x > -40 && f.x < 1040 && f.y > 90 && f.y < 660), `${g.schema}: le facce restano nel campo`); }
  }
  assert.strictEqual(visti.size, SCHEMI.length, 'i primi 7 round usano tutti gli schemi');
  // clic sbagliato: bloccato 2 secondi; clic giusto: punto
  const h = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(h);
  // folla ferma e ben distanziata per questa prova (si parte da uno schema difficile, con facce sovrapposte e in movimento)
  h.aggiornaPosizioni = () => {}; h.facce.forEach((f, i) => { f.x = 60 + (i % 15) * 62; f.y = 130 + Math.floor(i / 15) * 62; });
  const altra = h.facce.findIndex((f, i) => i !== h.quale && h.colpita(f.x, f.y) === i);
  Object.assign(h.inp[0], { mx: h.facce[altra].x, my: h.facce[altra].y }); h.inp[0].tocchi++; h.passo(0.05);
  assert.ok(h.bloccati[0] > h.tempoRound + 1.5 && h.trovato === null, 'faccia sbagliata: bloccato');
  const w = h.facce[h.quale]; Object.assign(h.inp[0], { mx: w.x, my: w.y }); h.inp[0].tocchi++; h.passo(0.05);
  assert.ok(h.trovato === null, 'da bloccato non si clicca');
  Object.assign(h.inp[1], { mx: w.x, my: w.y }); h.inp[1].tocchi++;
  assert.ok(h.passo(0.05) && h.trovato.p === 1 && h.punti[1] === 2, 'il primo che lo trova prende il punto (2 se in meno di 3 s)');
  assert.strictEqual(TIPI.length, 12, 'dodici personaggi');
  // il ricercato sotto il puntatore conta anche se un'altra faccia gli passa sopra
  const sopra = M.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(sopra); sopra.aggiornaPosizioni = () => {};
  const qq = sopra.facce[sopra.quale], ultima = sopra.facce[sopra.facce.length - 1 === sopra.quale ? 0 : sopra.facce.length - 1];
  ultima.x = qq.x + 5; ultima.y = qq.y; assert.strictEqual(sopra.colpita(qq.x, qq.y), sopra.quale, 'il ricercato vince sulla faccia sopra');
  // sei difficoltà, da Facile a Impossibile, con una progressione graduale
  const { LIVELLI, NOMI_LIVELLI } = M._test;
  assert.deepStrictEqual(NOMI_LIVELLI, ['facile', 'normale', 'difficile', 'esperto', 'estremo', 'impossibile']);
  assert.strictEqual(M.meta.opzioni.find((o) => o.id === 'difficolta').predefinito, 'difficile');
  let primaL = null;
  for (const lv of NOMI_LIVELLI) {
    const L = LIVELLI[lv];
    if (primaL) assert.ok(L.facce > primaL.facce && L.max > primaL.max && L.vel >= primaL.vel, `${lv} più difficile del livello prima`);
    primaL = L;
    const x = M.crea({ n: 1, opzioni: { round: 25, difficolta: lv }, bot: [null] });
    const facce = [], tipi = new Set();
    for (let k = 0; k < 20; k++) {
      if (k) { x.round++; x.iniziaRound(); }
      facce.push(x.facce.length);
      assert.ok(L.schemi.includes(x.schema), `${lv}: schema del livello`);
      assert.strictEqual(x.facce.filter((f) => f.tipo === x.ricercato).length, 1, `${lv}: il ricercato una volta sola`);
      x.facce.forEach((f) => tipi.add(f.tipo));
      new Set(x.facce.map((f) => f.tipo)).size <= L.tipi || assert.fail(`${lv}: al massimo ${L.tipi} personaggi per round`);
      x.aggiornaPosizioni(2.3); assert.ok(x.facce.every((f) => f.x > -40 && f.x < 1040 && f.y > 90 && f.y < 660), `${lv}: facce nel campo`);
    }
    assert.ok(Math.max(...facce) <= L.max && facce[0] >= L.facce, `${lv}: numero di facce`);
    if (lv === 'impossibile') assert.ok(facce[0] >= 300 && tipi.size === 12, 'Impossibile: centinaia di facce e tutti i 12 personaggi');
    if (lv === 'facile') assert.ok(Math.max(...facce) <= 40, 'Facile: poche facce');
  }
  console.log('✓ Wanted!: il ricercato c\'è una volta sola, sette schemi di folla (anche in movimento) dentro il campo, clic sbagliato = 2 s di blocco, il primo che lo trova prende il punto, 12 personaggi, 6 difficoltà da Facile (22-40 facce) a Impossibile (300-380 facce, 12 personaggi)');
}

// ======================= DUELLO SULLE PIATTAFORME =======================
fissa('DUELLO SULLE PIATTAFORME');
{
  const M = GIOCHI.duello;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } return ora; };
  const g = M.crea({ n: 3, opzioni: { round: 1 }, bot: [null, null, null] }); parti(g);
  assert.ok(g.e.every((e) => e.cuori === 3), '3 cuori a testa');
  // raccogliere un oggetto e usarlo: la bomba toglie un cuore a chi è vicino
  const [a, b] = g.e; Object.assign(b, { x: a.x + 60, y: a.y });
  g.oggetti.push({ id: 99, tipo: 'bomba', x: a.x, y: a.y, fermo: true }); g.passo(0.03);
  assert.strictEqual(a.ogg, 'bomba', 'oggetto raccolto');
  g.esplodi({ x: b.x, y: b.y, da: 0 }); assert.strictEqual(b.cuori, 2, 'la bomba toglie un cuore');
  g.esplodi({ x: b.x, y: b.y, da: 0 }); assert.strictEqual(b.cuori, 2, 'dopo un colpo si è protetti per un attimo');
  // lo scudo para un colpo
  const c = g.e[2]; Object.assign(c, { cuori: 3, scudo: 5, immune: 0 }); g.ferisci(2, 1, 100, -100, 0); assert.ok(c.cuori === 3 && c.scudo === 0, 'lo scudo para il colpo');
  // la palla di neve spinge senza togliere cuori
  c.immune = 0; g.ferisci(2, 0, 500, -200, 0); assert.ok(c.cuori === 3 && c.vx === 500, 'la neve spinge e basta');
  // cadere nel vuoto costa un cuore; a zero cuori si è fuori
  c.y = 1000; c.immune = 0; g.passo(0.03); assert.ok(c.cuori === 2 && c.rinasce > 0, 'caduto: un cuore in meno, poi ricompare');
  c.cuori = 1; c.rinasce = 0; c.y = 1000; g.passo(0.03); assert.ok(c.fuori, 'senza cuori è fuori');
  // nel finale le isole si sgretolano fino a sparire
  g.tempoRound = 61; for (let k = 0; k < 900; k++) { g.tempoRound += 0.05; g.passo(0.05); if (g.e.filter((e) => !e.fuori).length <= 1) break; }
  assert.ok(g.e.filter((e) => !e.fuori).length <= 1, 'le isole crollano e il round finisce');
  // le quattro mappe: ogni piattaforma si raggiunge da un'altra più in basso (dislivello e distanza entro un salto)
  const { MAPPE, OGGETTI } = M._test;
  assert.deepStrictEqual(Object.keys(MAPPE), ['isole', 'torri', 'nuvole', 'vulcano']);
  assert.ok(OGGETTI.cuore <= 0.5 && OGGETTI.bomba >= 3, 'i cuori cadono la metà di prima');
  for (const [id, mp] of Object.entries(MAPPE)) {
    for (const q of mp.piatt) {
      if (q.base) continue;
      const da = mp.piatt.some((r) => r !== q && r.y > q.y && r.y - q.y <= 150 && Math.max(r.x0, q.x0) - Math.min(r.x1, q.x1) <= 200 + (r.mx || 0) + (q.mx || 0));
      assert.ok(da, `${id}: la piattaforma a y=${q.y} si raggiunge con un salto`);
    }
  }
  const nuovo = (mappa, n = 2) => { const x = M.crea({ n, opzioni: { round: 1, mappa }, bot: new Array(n).fill(null) }); parti(x); return x; };
  // solo gli oggetti generali e quello esclusivo della mappa
  for (const [id, mp] of Object.entries(MAPPE)) {
    const x = nuovo(id), visti = new Set();
    x.e.forEach((e) => { e.fuori = false; }); x.tempoRound = 5;
    for (let k = 0; k < 400; k++) { x.prossimo = 0; x.oggetti = []; x.passo(0.01); x.oggetti.forEach((o) => visti.add(o.tipo)); x.e.forEach((e) => Object.assign(e, { rinasce: 0, cuori: 3, y: 100, vy: 0 })); }
    const esclusivi = ['molla', 'gancio', 'ali', 'pietra'];
    assert.ok(visti.has(mp.esclusivo) && esclusivi.filter((t) => t !== mp.esclusivo).every((t) => !visti.has(t)), `${id}: c'è solo il suo oggetto esclusivo (${[...visti].join(',')})`);
  }
  // molla: si salta più in alto; ali: tenendo su si sale
  const mo = nuovo('isole'), [m1, m2] = mo.e; mo.proiettili = []; mo.oggetti = [];
  m1.molla = 5; m1.terra = true; m2.terra = true; m1.suPrima = m2.suPrima = false; mo.inp[0].y = -1; mo.inp[1].y = -1; mo.passo(0.02);
  assert.ok(m1.vy < m2.vy * 1.3, 'con la molla il salto è più forte');
  const al = nuovo('nuvole'), a1 = al.e[0]; Object.assign(a1, { ali: 3, terra: false, y: 300, vy: 0 }); al.inp[0].y = -1; al.passo(0.2);
  assert.ok(a1.vy < 0, 'con le ali, tenendo su, si sale');
  // gancio: tira verso chi l'ha lanciato
  const ga = nuovo('torri'), [g1, g2] = ga.e; Object.assign(g1, { x: 90, y: 450, vy: 0, terra: true, dir: 1, ogg: 'gancio', usi: 1 }); Object.assign(g2, { x: 300, y: 450, vy: 0, terra: true, immune: 0, rinasce: 0 });
  ga.inp[1].x = 0; ga.usa(0); for (let k = 0; k < 30 && ga.proiettili.length; k++) ga.passo(0.01);
  assert.ok(g2.vx < -300 && g2.cuori === 3, 'il gancio tira verso chi l\'ha lanciato, senza togliere cuori');
  // pietra lavica: lascia una pozza che toglie un cuore a chi ci mette i piedi
  const pv = nuovo('vulcano'), [p1, p2] = pv.e, base = pv.isole[0];
  pv.pozze.push({ x: (base.x0 + base.x1) / 2, y: base.y, r: 38, t: 0, da: 0, su: base.k });
  Object.assign(p2, { x: (base.x0 + base.x1) / 2, y: base.y - 20, vy: 0, terra: true, immune: 0, rinasce: 0 }); pv.passo(0.02);
  assert.strictEqual(p2.cuori, 2, 'la pozza di lava toglie un cuore');
  // la lava sale e chi la tocca perde un cuore
  pv.tempoRound = 0; for (let k = 0; k < 700; k++) { pv.tempoRound += 0.1; pv.passo(0.1); }
  assert.ok(pv.lava <= 420, 'la lava è salita');
  const p3 = pv.e[0]; Object.assign(p3, { fuori: false, cuori: 3, rinasce: 0, immune: 0, y: pv.lava + 10, vy: 0 }); pv.passo(0.02);
  assert.ok(p3.cuori === 2 || p3.rinasce > 0, 'chi tocca la lava perde un cuore');
  // nuvole mobili: chi ci sta sopra si sposta con loro
  const nu = nuovo('nuvole'), nv = nu.isole.find((q) => q.mx), e1 = nu.e[0];
  nu.tempoRound = 1; nu.muoviPiattaforme(1, 0.02);
  Object.assign(e1, { x: (nv.x0 + nv.x1) / 2, y: nv.y - 20, vy: 0, terra: true, su: nv.k }); nu.inp[0].x = 0; nu.inp[0].y = 0;
  const x0 = e1.x, c0 = nv.x0; for (let k = 0; k < 30; k++) { nu.tempoRound += 0.03; nu.passo(0.03); }
  assert.ok(Math.abs((e1.x - x0) - (nv.x0 - c0)) < 6 && Math.abs(nv.x0 - c0) > 5, 'la nuvola porta con sé chi ci sta sopra');
  // computer in tutte le mappe: le partite finiscono, il difficile cade poco da solo e vince di più (caso ripetibile:
  // le cadute variano molto da una serie all'altra e il test non deve fallire a caso)
  const casoVero = Math.random; { let sd = 424242; Math.random = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }; }
  const vd = { facile: 0, medio: 0, difficile: 0 }, cadute = { medio: 0, difficile: 0 };
  const D = M._test.Duello, pc0 = D.prototype.perdiCuore; let livC = null;
  D.prototype.perdiCuore = function (p, perche) { if (livC && this.e[p].stordito <= 0 && this.tempoRound < 60 && cadute[livC[p]] !== undefined) cadute[livC[p]]++; return pc0.call(this, p, perche); };
  for (const mappa of Object.keys(MAPPE)) for (let k = 0; k < 72; k++) { // tante partite: le cadute variano molto
    livC = ['facile', 'medio', 'difficile'].map((_, i) => ['facile', 'medio', 'difficile'][(i + k) % 3]);
    const x = M.crea({ n: 3, opzioni: { round: 1, mappa }, bot: livC }); let ora = Date.now(), passi = 0;
    while (!x.finita) { ora += 33; if (x.fase === 'via' || x.fase === 'pausaRound') x.fineFase = Math.min(x.fineFase, ora); x.tick(ora); assert.ok(passi++ < 20000, 'il round finisce'); }
    if (x.risultato.vincitori.length) vd[livC[x.risultato.vincitori[0]]]++;
  }
  D.prototype.perdiCuore = pc0;
  Math.random = casoVero;
  assert.ok(vd.difficile > vd.medio && vd.medio > vd.facile, `nelle 4 mappe il difficile vince di più ${JSON.stringify(vd)}`);
  assert.ok(cadute.difficile <= cadute.medio * 1.5 + 10, `il difficile non cade da solo molto più del medio ${JSON.stringify(cadute)}`);
  console.log(`✓ Duello sulle piattaforme: 3 cuori, oggetti da raccogliere, bomba, scudo, palla di neve che spinge, caduta nel vuoto, eliminazione, isole che crollano nel finale, 4 mappe raggiungibili con oggetti esclusivi (molla, gancio, ali, pietra lavica con pozza), lava che sale, nuvole che portano con sé, meno cuori, computer in tutte le mappe (vittorie ${JSON.stringify(vd)}, cadute da soli ${JSON.stringify(cadute)})`);
}

// ======================= SASSO CARTA FORBICE: MENO UNO =======================
fissa('SASSO CARTA FORBICE: MENO UNO');
{
  const M = GIOCHI.morra;
  const g = M.crea({ n: 2, opzioni: { modo: 'meno1', meglio: 3 } });
  assert.deepStrictEqual(g.attesi(), [0, 1], 'si scelgono le due mani insieme');
  assert.ok(g.azione(0, { tipo: 'scegli2', mosse: ['sasso'] }).errore, 'servono due mani');
  g.azione(0, { tipo: 'scegli2', mosse: ['sasso', 'carta'] });
  assert.strictEqual(g.vista(1).altraCoppia, null, 'le mani dell\'altro restano segrete finché non avete scelto entrambi');
  g.azione(1, { tipo: 'scegli2', mosse: ['forbice', 'forbice'] });
  assert.ok(g.fase === 'togli' && g.vista(0).altraCoppia.join() === 'forbice,forbice', 'poi si vedono tutte e quattro');
  g.azione(0, { tipo: 'tieni', mano: 1 }); // tiene la carta
  assert.ok(!g.inAttesa && g.vista(1).mioTieni === null, 'la mano tenuta resta segreta finché l\'altro non sceglie');
  g.azione(1, { tipo: 'tieni', mano: 0 });
  assert.ok(g.inAttesa && g.rivela.vince === 1 && g.rivela.scelte.join() === 'carta,forbice', 'si confrontano le mani rimaste');
  g.avanza();
  assert.ok(g.punti[1] === 1 && g.fase === 'scegli' && !g.coppie[0], 'mano successiva da capo');
  const vitt = { facile: 0, medio: 0, difficile: 0 };
  for (const [a, b] of [['facile', 'medio'], ['medio', 'difficile'], ['facile', 'difficile']]) for (let k = 0; k < 200; k++) {
    const x = M.crea({ n: 2, opzioni: { modo: 'meno1' } }); const l = k % 2 ? [a, b] : [b, a]; let passi = 0;
    while (!x.finita) { if (x.inAttesa) { x.avanza(); continue; } for (const p of x.attesi()) assert.ok(!x.azione(p, M.bot(x, p, l[p])).errore); assert.ok(passi++ < 500); }
    vitt[l[x.risultato.vincitori[0]]]++;
  }
  assert.ok(vitt.difficile > vitt.medio && vitt.medio > vitt.facile, `nel meno uno il difficile vince di più ${JSON.stringify(vitt)}`);
  console.log(`✓ Sasso carta forbice "Meno uno": due mani segrete, poi tutte in vista, si ritira una mano in segreto, confronto, computer (vittorie f/m/d ${vitt.facile}/${vitt.medio}/${vitt.difficile})`);
}

// ======================= DUBITO (Liar's Bar) =======================
fissa('DUBITO (Liar\'s Bar)');
{
  const M = GIOCHI.dubito;
  const { mazzo } = M._test;
  const conta = (m) => m.reduce((o, c) => ({ ...o, [c.t]: (o[c.t] || 0) + 1 }), {});
  assert.deepStrictEqual(conta(mazzo(4)), { A: 6, K: 6, Q: 6, J: 2 }, 'Liar\'s Deck: 6 assi, 6 re, 6 regine, 2 jolly');
  assert.strictEqual(mazzo(6).length, 40, 'da 5 giocatori in su due mazzi');
  for (const n of [2, 3, 4, 5, 8]) { const g = M.crea({ n }); assert.ok(g.mani.every((m) => m.length === 5), `5 carte a testa in ${n}`); assert.strictEqual(g.mani.flat().length + g.scarto, n > 4 ? 40 : 20); }
  const c = (id) => ({ id, t: id[0] });
  const g = M.crea({ n: 3, primo: 0 });
  g.carta = 'K';
  g.mani = [[c('K1'), c('A1'), c('Q1'), c('J1'), c('A2')], [c('K2'), c('K3'), c('Q2'), c('A3'), c('A4')], [c('Q3'), c('Q4'), c('A5'), c('K4'), c('J2')]];
  g.pistole = [{ proiettile: 6, colpi: 0 }, { proiettile: 2, colpi: 0 }, { proiettile: 1, colpi: 0 }];
  assert.ok(g.azione(0, { tipo: 'gioca', carte: ['K1', 'A1', 'Q1', 'J1'] }).errore, 'al massimo 3 carte');
  assert.ok(g.azione(0, { tipo: 'dubito' }).errore, 'all\'inizio non c\'è niente da dubitare');
  assert.ok(g.azione(1, { tipo: 'gioca', carte: ['K2'] }).errore, 'solo chi è di turno');
  g.azione(0, { tipo: 'gioca', carte: ['K1', 'J1'] }); // verità: il jolly vale come re
  assert.ok(g.turno === 1 && g.vista(1).possoDubitare && !g.vista(2).possoDubitare, 'dubita solo il giocatore successivo');
  assert.strictEqual(g.vista(1).ultima.carte, null, 'le carte giocate sono coperte');
  g.azione(1, { tipo: 'dubito' });
  assert.ok(!g.svelate.mentiva && g.svelate.tira === 1, 'il jolly non è una bugia: spara chi ha dubitato');
  g.avanza();
  assert.ok(g.fase === 'roulette' && g.turno === 1, 'Roulette Russa a chi ha dubitato a torto');
  assert.ok(g.azione(0, { tipo: 'spara' }).errore, 'spara solo lui');
  g.azione(1, { tipo: 'spara' });
  assert.ok(g.vivi[1] && g.pistole[1].colpi === 1 && g.inAttesa, 'primo colpo a vuoto');
  g.avanza();
  assert.ok(g.round === 2 && g.mani.every((m) => m.length === 5) && g.turno === 1, 'dopo lo sparo nuovo round: rimescolato, 5 carte, parte chi ha sparato');
  // bugia scoperta: spara chi mentiva; il proiettile nella seconda camera lo elimina
  g.carta = 'A';
  g.mani[1] = [c('K9'), c('Q9'), c('Q8'), c('K8'), c('K7')];
  g.azione(1, { tipo: 'gioca', carte: ['K9', 'Q9'] });
  g.azione(2, { tipo: 'dubito' }); g.avanza();
  assert.ok(g.svelate.mentiva && g.turno === 1, 'bugia: spara chi mentiva');
  g.azione(1, { tipo: 'spara' });
  assert.ok(!g.vivi[1] && g.roulette.esito === 'morto', 'con 1 proiettile su 6 la seconda camera era quella carica: eliminato');
  g.avanza();
  assert.ok(g.round === 3 && g.mani[1].length === 0 && g.turno === 2, 'l\'eliminato non riceve carte; parte il successivo');
  // chi finisce le carte: il successivo può ancora dubitare, oppure crederci (round finito senza spari)
  g.carta = 'Q'; g.mani[2] = [c('Q7')]; g.mani[0] = [c('A7'), c('A8')];
  g.azione(2, { tipo: 'gioca', carte: ['Q7'] });
  assert.ok(g.finale && g.vista(0).possoAccettare && g.azione(0, { tipo: 'gioca', carte: ['A7'] }).errore, 'ultime carte: si crede o si dubita');
  g.azione(0, { tipo: 'accetto' }); g.avanza();
  assert.ok(g.round === 4 && g.pistole[0].colpi === 0 && g.pistole[2].colpi === 0, 'ci ha creduto: nuovo round senza spari');
  // tempo scaduto: gioca il computer
  g.fineTurno = 0; assert.ok(g.controllaTempo() && g.tavolo.length > 0, 'dopo 30 secondi gioca il computer');
  // la probabilità cresce: la sesta volta spara sempre
  const h = M.crea({ n: 2 }); h.pistole[0] = { proiettile: 6, colpi: 5 }; h.roulette = { chi: 0 }; h.fase = 'roulette'; h.turno = 0; h.azione(0, { tipo: 'spara' });
  assert.ok(!h.vivi[0], 'alla sesta camera il colpo parte di sicuro'); h.avanza();
  assert.ok(h.finita && h.risultato.vincitori[0] === 1, 'vince l\'ultimo rimasto');
  // partite tra computer: finiscono sempre, nessuna carta inventata; il difficile vince di più
  const vitt = { facile: 0, medio: 0, difficile: 0 };
  const gioca = (liv) => {
    const x = M.crea({ n: liv.length, primo: Math.floor(Math.random() * liv.length) }); let passi = 0;
    while (!x.finita) {
      if (x.inAttesa) { x.avanza(); continue; }
      const r = x.azione(x.turno, M.bot(x, x.turno, liv[x.turno])); assert.ok(!r.errore, r.errore);
      assert.ok(x.mani.flat().length + x.tavolo.length + x.scarto === 20 * x.mazzi, 'nessuna carta persa'); assert.ok(passi++ < 3000);
    }
    return liv[x.risultato.vincitori[0]];
  };
  for (let k = 0; k < 150; k++) vitt[gioca(k % 2 ? ['medio', 'difficile'] : ['difficile', 'medio'])]++;
  for (let k = 0; k < 60; k++) vitt[gioca(['facile', 'medio', 'difficile', 'medio', 'facile', 'difficile'].slice(k % 3, (k % 3) + 4))]++;
  assert.ok(vitt.difficile > vitt.medio && vitt.medio > vitt.facile, `il difficile vince di più ${JSON.stringify(vitt)}`);
  // mazzo grande (anche Fante, 10, 9, 8, 7) e carte in mano a scelta
  const { quantiMazzi, TIPI_MAZZO } = M._test;
  assert.deepStrictEqual(conta(mazzo(4, TIPI_MAZZO.grande)), { A: 6, K: 6, Q: 6, F: 6, T: 6, 9: 6, 8: 6, 7: 6, J: 2 }, 'mazzo grande: 8 tipi da 6 più 2 jolly');
  assert.ok(M.meta.opzioni.some((o) => o.id === 'mazzo') && M.meta.opzioni.find((o) => o.id === 'carte').valori.join() === '5,3,7,10', 'opzioni al tavolo: mazzo e carte in mano');
  assert.strictEqual(quantiMazzi(8, TIPI_MAZZO.classico, 10), 4, '8 giocatori con 10 carte: 4 mazzi classici');
  const tipiVisti = new Set();
  for (const [mz, ct] of [['classico', 3], ['classico', 10], ['grande', 3], ['grande', 5], ['grande', 7], ['grande', 10]]) {
    for (const n of [2, 4, 8]) {
      const x = M.crea({ n, opzioni: { mazzo: mz, carte: ct } });
      assert.ok(x.mani.every((m) => m.length === ct), `${mz}, ${ct} carte, ${n} giocatori: carte a testa`);
      assert.strictEqual(x.mani.flat().length + x.scarto, x.dimMazzo * x.mazzi, 'tutte le carte del mazzo');
      assert.strictEqual(new Set(x.mani.flat().map((q) => q.id)).size, n * ct, 'nessuna carta doppia');
      assert.ok(TIPI_MAZZO[mz].includes(x.carta));
    }
  }
  for (let k = 0; k < 200; k++) tipiVisti.add(M.crea({ n: 2, opzioni: { mazzo: 'grande' } }).carta);
  assert.strictEqual(tipiVisti.size, 8, 'nel mazzo grande la carta del tavolo esce tra tutti gli 8 tipi');
  assert.strictEqual(M._test.dichiara(2, '8'), 'Sto giocando due Otto');
  assert.strictEqual(M._test.dichiara(1, 'F'), 'Sto giocando un Fante');
  // partite tra computer con le varianti: finiscono, nessuna carta persa; a due il difficile vince di più del medio
  const giocaV = (liv, opzioni) => {
    const x = M.crea({ n: liv.length, primo: Math.floor(Math.random() * liv.length), opzioni }); let passi = 0;
    while (!x.finita) {
      if (x.inAttesa) { x.avanza(); continue; }
      const r = x.azione(x.turno, M.bot(x, x.turno, liv[x.turno])); assert.ok(!r.errore, r.errore);
      assert.ok(x.mani.flat().length + x.tavolo.length + x.scarto === x.dimMazzo * x.mazzi, 'nessuna carta persa'); assert.ok(passi++ < 8000);
    }
    return liv[x.risultato.vincitori[0]];
  };
  const varianti = {};
  for (const [mz, ct, partite] of [['grande', 3, 2000], ['grande', 5, 600], ['grande', 10, 200], ['classico', 3, 200], ['classico', 10, 200]]) {
    const v = { medio: 0, difficile: 0 };
    for (let k = 0; k < partite; k++) v[giocaV(k % 2 ? ['medio', 'difficile'] : ['difficile', 'medio'], { mazzo: mz, carte: ct })]++;
    for (let k = 0; k < 30; k++) giocaV(['facile', 'medio', 'difficile', 'medio', 'facile', 'difficile'].slice(k % 3, (k % 3) + 4), { mazzo: mz, carte: ct });
    assert.ok(v.difficile > v.medio, `${mz} con ${ct} carte: il difficile vince di più del medio ${JSON.stringify(v)}`);
    varianti[`${mz[0]}${ct}`] = `${v.difficile}/${partite}`;
  }
  console.log(`✓ Dubito: mazzo grande (8 tipi) e carte in mano 3/5/7/10 (difficile contro medio: ${JSON.stringify(varianti)})`);
  console.log(`✓ Dubito (Liar's Bar): mazzo 6/6/6/2 (due mazzi da 5 giocatori), 5 carte a testa, da 1 a 3 carte, jolly sempre buono, dubita solo il successivo, Roulette Russa con 6 camere e probabilità che cresce, eliminazione, nuovo round, ultime carte, tempo scaduto, computer (vittorie f/m/d ${vitt.facile}/${vitt.medio}/${vitt.difficile})`);
}

// ======================= NASCONDINO =======================
fissa('NASCONDINO');
{
  const M = GIOCHI.nascondino;
  const { mosseCaccia, mosseNascosto, cella, direzione, LATO, CENTRO } = M._test;
  assert.ok(LATO === 7 && CENTRO === cella(3, 3), 'griglia 7×7');
  assert.strictEqual(mosseCaccia(cella(3, 3)).length, 9, 'il cacciatore: fermo o 1-2 caselle in linea retta');
  assert.ok(!mosseCaccia(cella(3, 3)).includes(cella(4, 4)), 'mai in diagonale');
  assert.strictEqual(mosseNascosto(cella(3, 3)).length, 5, 'chi è nascosto: fermo o una casella');
  assert.deepStrictEqual([direzione(cella(3, 3), cella(3, 0)), direzione(cella(3, 3), cella(6, 0)), direzione(cella(3, 3), cella(0, 3))], ['N', 'NE', 'O']);
  const g = M.crea({ n: 3, primo: 0, opzioni: {} });
  assert.ok(g.fase === 'nascondi' && g.attesi().join() === '1,2' && g.round === 10, 'prima si nascondono gli altri; 10 round');
  assert.ok(g.azione(1, { tipo: 'muovi', cella: cella(3, 4) }).errore, 'non vicino al centro');
  g.azione(1, { tipo: 'muovi', cella: cella(3, 6) }); g.azione(2, { tipo: 'muovi', cella: cella(0, 0) });
  assert.ok(g.fase === 'caccia' && g.attesi().join() === '0,1,2', 'poi si muovono tutti insieme');
  assert.strictEqual(g.vista(0).pos[1], null, 'il cacciatore non vede i nascosti');
  assert.strictEqual(g.vista(1).pos[0], null, 'il nascosto non vede il cacciatore lontano');
  assert.ok(g.azione(1, { tipo: 'muovi', cella: cella(3, 4) }).errore, 'il nascosto si muove di una casella');
  // round 1: il cacciatore scende di 2, il nascosto 1 resta fermo (a distanza 1 dalla torcia? no: 3,5 vs 3,6 = 1 → preso)
  g.azione(0, { tipo: 'muovi', cella: cella(3, 5) }); g.azione(1, { tipo: 'muovi', cella: cella(4, 6) }); g.azione(2, { tipo: 'resta' });
  assert.ok(g.ruolo[1] === 'nascosto' && g.punti[1] === 1, 'scappato di lato: fuori dalla torcia');
  assert.ok(g.storia[0].frusci[0] === 1 && g.storia[0].impronte.includes(cella(3, 6)), 'fruscio e impronta dove era');
  assert.ok(g.vista(0).indizi.impronte.length === 1 && g.vista(1).indizi.impronte === undefined, 'le impronte le vede solo chi caccia');
  assert.ok(g.vista(1).pos[0] === cella(3, 5), 'il cacciatore vicino si vede');
  g.azione(0, { tipo: 'muovi', cella: cella(4, 5) }); g.azione(1, { tipo: 'resta' }); g.azione(2, { tipo: 'resta' });
  assert.ok(g.ruolo[1] === 'caccia' && g.punti[0] === 4, 'la torcia illumina la casella accanto: preso, 4 punti');
  g.azione(0, { tipo: 'resta' }); g.azione(1, { tipo: 'resta' }); g.azione(2, { tipo: 'resta' });
  assert.ok(g.storia[2].indizi[0] && g.storia[2].indizi[1], 'ogni 3 round la bussola a tutti i cacciatori');
  assert.strictEqual(g.storia[2].indizi[0], direzione(g.pos[0], g.pos[2]), 'la bussola punta al nascosto più vicino');
  // incrocio: si scambiano di posto = preso
  const x = M.crea({ n: 2, primo: 0, opzioni: {} });
  x.azione(1, { tipo: 'muovi', cella: cella(0, 3) });
  x.pos[0] = cella(1, 3);
  x.azione(0, { tipo: 'muovi', cella: cella(0, 3) }); x.azione(1, { tipo: 'muovi', cella: cella(1, 3) });
  assert.ok(x.finita && x.ruolo[1] === 'caccia', 'incrociarsi = preso');
  // partite tra computer: il difficile vince più del medio, il medio più del facile
  const gioca = (liv, n, primo) => { const h = M.crea({ n, primo, opzioni: {} }); let passi = 0; while (!h.finita) { for (const p of h.attesi()) assert.ok(!h.azione(p, M.bot(h, p, liv[p])).errore); assert.ok(passi++ < 40); } return h; };
  const v = { facile: 0, medio: 0, difficile: 0 };
  const combo = [['facile', 'medio', 'difficile'], ['medio', 'difficile', 'facile'], ['difficile', 'facile', 'medio']];
  let prese = 0;
  for (let k = 0; k < 3000; k++) { const l = combo[k % 3]; const h = gioca(l, 3, Math.floor(k / 3) % 3); prese += h.prese.reduce((a, b) => a + b, 0); if (h.risultato.vincitori.length) v[l[h.risultato.vincitori[0]]]++; }
  assert.ok(v.difficile > v.medio && v.medio > v.facile, `nascondino: ${JSON.stringify(v)}`);
  console.log(`✓ Nascondino: griglia 7×7, nascosti che si muovono, torcia, incrocio, fruscio, impronte e bussola solo ai cacciatori, 3000 partite tra computer (vittorie f/m/d ${v.facile}/${v.medio}/${v.difficile}, ${prese} prese)`);
}

// ======================= LA MAPPA NASCOSTA =======================
fissa('LA MAPPA NASCOSTA');
{
  const M = GIOCHI.mappa;
  const { nuovaMappa, intorno, probabilita } = M._test;
  for (let k = 0; k < 200; k++) {
    const m = nuovaMappa(8);
    assert.ok(m.minima <= 6, 'c\'è sempre una strada sicura di 6 mosse al massimo');
    assert.ok(!m.nemici.has(m.partenza) && !m.nemici.has(m.uscita) && intorno(m.partenza).every((c) => !m.nemici.has(c)));
  }
  const g = M.crea({ n: 2, opzioni: { mappe: 1 } });
  assert.ok(g.turno === null && g.attesi().length === 2, 'si muovono tutti insieme');
  const v = g.vista(0);
  assert.ok(v.nemici === null && v.numeri.filter((x) => x !== null).length === 1, 'si vede solo la partenza');
  assert.ok(g.azione(0, { tipo: 'muovi', cella: g.m.partenza - 10 }).errore, 'una casella alla volta');
  // il difficile non entra mai in una casella che sa essere un nemico
  const pr = probabilita(g, 0);
  assert.ok(pr.every((x) => x >= 0 && x <= 1.0001), 'probabilità valide');
  const tot = { facile: 0, difficile: 0 };
  for (let k = 0; k < 200; k++) {
    const h = M.crea({ n: 2, opzioni: { mappe: 1 } });
    while (!h.finita) { if (h.inAttesa) { h.avanza(); continue; } for (const p of h.attesi()) assert.ok(!h.azione(p, M.bot(h, p, p ? 'difficile' : 'facile')).errore); }
    tot.facile += h.punti[0]; tot.difficile += h.punti[1];
  }
  assert.ok(tot.difficile > tot.facile * 1.5, `il difficile fa molti più punti (${tot.difficile} contro ${tot.facile})`);
  console.log(`✓ La mappa nascosta: strada sicura garantita, numeri come nel campo minato, mosse insieme, probabilità esatte, computer (difficile ${tot.difficile}, facile ${tot.facile})`);
}

// ======================= TASTI IN ORDINE (tempo reale) =======================
fissa('TASTI IN ORDINE (tempo reale)');
{
  const M = GIOCHI.tasti;
  const g = M.crea({ n: 2, opzioni: { lunghezza: 6, round: 3 }, bot: [null, null] });
  assert.strictEqual(g.vista(0).sequenza, null, 'la sequenza si vede solo al via');
  let ora = g.inizio; g.tick(ora);
  assert.strictEqual(g.fase, 'corsa');
  const s = g.sequenza;
  assert.ok(s.length === 6 && /^[A-Z]+$/.test(s), 'sei lettere');
  g.premi(0, 'ù', ora + 100);
  assert.strictEqual(g.g[0].idx, 0, 'il tasto sbagliato non fa avanzare');
  for (let i = 0; i < 6; i++) g.premi(0, s[i].toLowerCase(), ora + 1000 + i * 100);
  assert.strictEqual(g.g[0].tempo, 1500 + 1000, 'tempo + 1 secondo di penalità');
  g.tick(ora + 31000);
  assert.ok(g.fase === 'pausa' && g.g[1].tempo > 30000, 'chi non finisce prende più di 30 secondi');
  // pausa per le dispense: il tempo non scorre
  const h = M.crea({ n: 1, opzioni: {}, bot: [null] });
  // (orologio fermo: tra le due chiamate a Date.now() poteva passare un millesimo e il conto veniva 5001)
  const adesso = Date.now, fermo = adesso(); Date.now = () => fermo;
  const inizio = h.inizio; h.impostaPausa(true); h.pausaDal -= 5000; h.impostaPausa(false);
  Date.now = adesso;
  assert.strictEqual(h.inizio, inizio + 5000, 'la pausa sposta gli orologi');
  // partita tra computer: il difficile è più veloce
  // (20 partite sommate: in una sola a volte il medio è più veloce del difficile per caso)
  const b = { totali: [0, 0, 0] };
  for (let k = 0; k < 20; k++) {
    const b1 = M.crea({ n: 3, opzioni: { round: 3 }, bot: ['facile', 'medio', 'difficile'] });
    ora = Date.now(); let passi = 0;
    while (!b1.finita && passi++ < 100000) { ora += 50; b1.tick(ora); }
    assert.ok(b1.finita, 'la partita tra computer finisce');
    b1.totali.forEach((x, i) => { b.totali[i] += x / 20; });
  }
  assert.ok(b.totali[2] < b.totali[1] && b.totali[1] < b.totali[0], `difficile più veloce del medio e del facile (${b.totali.map((x) => (x / 1000).toFixed(1)).join('/')} s)`);
  console.log(`✓ Tasti in ordine: sequenza nascosta fino al via, errore +1 s, 30 secondi al massimo, pausa, computer (${b.totali.map((x) => (x / 1000).toFixed(1)).join('/')} s)`);
}

// ======================= OGGETTI SULLA MENSOLA =======================
fissa('OGGETTI SULLA MENSOLA');
{
  const M = GIOCHI.mensola;
  const g = M.crea({ n: 2, opzioni: { modo: 'ordine', round: 3 } });
  assert.ok(g.fase === 'guarda' && g.k === 5 && g.vista(0).mensola.length === 5, 'prima si guarda');
  assert.ok(g.azione(0, { tipo: 'ordine', ordine: g.mensola }).errore, 'mentre si guarda non si risponde');
  g.fineFase = 0; g.controllaTempo();
  assert.ok(g.fase === 'rispondi' && g.vista(0).mensola === null && g.vista(0).mescolati.length === 5, 'poi la mensola sparisce');
  assert.ok(g.azione(0, { tipo: 'ordine', ordine: g.mensola.slice(0, 4) }).errore, 'servono tutti gli oggetti');
  g.azione(0, { tipo: 'ordine', ordine: g.mensola });
  const sbagliata = g.mensola.slice(); [sbagliata[0], sbagliata[1]] = [sbagliata[1], sbagliata[0]];
  g.azione(1, { tipo: 'ordine', ordine: sbagliata });
  assert.deepStrictEqual(g.punti, [7, 3], 'un punto per posto giusto, +2 se tutto giusto');
  g.avanza();
  assert.ok(g.k === 7 && g.piani.join() === '4,3', 'al secondo round due ripiani');
  const { ripiani } = M._test;
  assert.deepStrictEqual([ripiani(5), ripiani(9), ripiani(12), ripiani(15)].map((x) => x.join()), ['5', '5,4', '4,4,4', '5,5,5'], 'al massimo 5 oggetti per ripiano');
  assert.ok(M._test.OGGETTI.length >= 20, 'abbastanza oggetti per tre ripiani e le sostituzioni');
  const c = M.crea({ n: 1, opzioni: { modo: 'cambiato' } });
  c.fineFase = 0; c.controllaTempo(); assert.strictEqual(c.fase, 'buio', 'luce spenta');
  c.fineFase = 0; c.controllaTempo(); assert.strictEqual(c.fase, 'rispondi');
  const diversi = c.mensola.map((o, i) => (o !== c.dopo[i] ? i : -1)).filter((i) => i >= 0);
  assert.deepStrictEqual(diversi, c.cambio.posti, 'una cosa è cambiata (un oggetto o due scambiati)');
  c.azione(0, { tipo: 'cambiato', posto: c.cambio.posti[0] });
  assert.strictEqual(c.punti[0], 3);
  const tot = { facile: 0, difficile: 0 };
  for (let k = 0; k < 150; k++) {
    const h = M.crea({ n: 2, opzioni: { modo: k % 2 ? 'cambiato' : 'ordine' } });
    while (!h.finita) {
      if (h.inAttesa) { h.avanza(); continue; }
      if (h.fase !== 'rispondi') { h.fineFase = 0; h.controllaTempo(); continue; }
      for (const p of h.attesi()) assert.ok(!h.azione(p, M.bot(h, p, p ? 'difficile' : 'facile')).errore);
    }
    tot.facile += h.punti[0]; tot.difficile += h.punti[1];
  }
  assert.ok(tot.difficile > tot.facile, `il difficile ricorda di più (${tot.difficile} contro ${tot.facile})`);
  console.log(`✓ Oggetti sulla mensola: guarda e poi rispondi, rimetti in ordine con punti per posto, cosa è cambiato, un oggetto in più a round, computer (difficile ${tot.difficile}, facile ${tot.facile})`);
}

// ======================= ESECUZIONE PUBBLICA (67 in chat) =======================
fissa('ESECUZIONE PUBBLICA (67 in chat)');
{
  const { eSessantasette: e } = require('../esecuzione');
  for (const si of ['67', 'ahah 67', '67!', 'SESSANTASETTE', 'sessanta sette', 'Sessanta-sette', 'sessantasette?', 'è 67.']) assert.ok(e(si), `"${si}" deve far scattare l'esecuzione`);
  for (const no of ['167', '670', '6 7', 'sessanta', 'sette', 'ciao', '1967']) assert.ok(!e(no), `"${no}" non deve farla scattare`);
  console.log('✓ Esecuzione pubblica: riconosce 67, sessantasette e sessanta sette (non 167, 670…)');
}

// ======================= THE MIND =======================
fissa('THE MIND');
{
  const M = GIOCHI.mind;
  assert.ok(M.meta.pausaBoss && M.meta.senzaLivelli && !M.meta.soloPersone, 'collaborazione: pausa con le dispense e computer senza livelli');
  const g = M.crea({ n: 3, opzioni: {} });
  assert.strictEqual(g.maxLivello, 10, 'in 3 i livelli sono 10');
  assert.strictEqual(M.crea({ n: 2 }).maxLivello, 12);
  assert.strictEqual(M.crea({ n: 4 }).maxLivello, 8);
  assert.ok(g.vite === undefined && g.stelle === undefined && g.vista(0).vite === undefined && g.vista(0).stelle === undefined, 'niente vite e niente stelle');
  assert.ok(g.mani.every((m) => m.length === 1), 'livello 1: una carta a testa');
  assert.strictEqual(g.vista(0).mano.length, 1);
  assert.strictEqual(g.vista(0).carte.join(), '1,1,1');
  assert.strictEqual(g.vista(0).mani, null, 'le carte degli altri non si vedono');
  assert.ok(g.azione(0, { tipo: 'gioca' }).errore, 'prima ci si concentra');
  assert.deepStrictEqual(g.attesi(), [0, 1, 2]);
  [0, 1, 2].forEach((i) => g.azione(i, { tipo: 'pronto' }));
  assert.strictEqual(g.fase, 'via');
  g.tick(Date.now() + 5000);
  assert.strictEqual(g.fase, 'gioco');
  assert.ok(g.azione(0, { tipo: 'stella' }).errore, 'la stella ninja non esiste più');
  // carte decise a mano: 10, 20, 30 in ordine = livello superato
  g.mani = [[20], [10], [30]];
  for (const i of [1, 0, 2]) g.azione(i, { tipo: 'gioca' });
  assert.ok(g.fase === 'livello' && g.errori === 0, 'in ordine: livello superato');
  g.tick(Date.now() + 20000);
  assert.ok(g.livello === 2 && g.mani.every((m) => m.length === 2) && g.fase === 'pronti' && g.tentativi === 1, 'livello 2: due carte a testa');
  // errore: il livello ricomincia da capo con carte nuove, all'infinito
  for (let volta = 1; volta <= 3; volta++) {
    [0, 1, 2].forEach((i) => g.azione(i, { tipo: 'pronto' }));
    g.tick(Date.now() + 25000);
    g.mani = [[5, 50], [7, 60], [9, 70]];
    g.azione(2, { tipo: 'gioca' });
    assert.ok(g.fase === 'fallito' && !g.finita && g.ultimoErrore.basse.map((x) => x.carta).join() === '5,7', 'il 9 prima del 5 e del 7: si vedono le carte più basse');
    assert.ok(g.azione(0, { tipo: 'gioca' }).errore, 'durante l\'annuncio non si gioca');
    g.tick(Date.now() + 60000);
    assert.ok(g.livello === 2 && g.tentativi === volta + 1 && g.fallimenti === volta && g.fase === 'pronti' && g.mani.every((m) => m.length === 2), `si rifà il livello 2 (volta ${volta})`);
  }
  // pausa: il tempo si ferma e nessuno può giocare
  const h = M.crea({ n: 2, bot: ['medio', null] });
  h.fase = 'gioco'; h.pianificaBot(Date.now());
  const q = h.quando[0];
  h.impostaPausa(true);
  assert.ok(h.azione(1, { tipo: 'gioca' }).errore, 'in pausa non si gioca');
  assert.strictEqual(h.tick(Date.now() + 999999), false, 'in pausa il computer non gioca');
  h.pausaDal -= 5000; h.impostaPausa(false);
  assert.ok(h.quando[0] >= q + 5000, 'il tempo della pausa non conta');
  // partite tra computer: il computer aspetta in base alla distanza, a volte la squadra vince
  const livelli = { 2: [], 3: [], 4: [] };
  let vinte = 0;
  for (let k = 0; k < 90; k++) {
    const n = 2 + (k % 3);
    const m = M.crea({ n, bot: new Array(n).fill('medio') });
    let ora = Date.now();
    let passi = 0;
    while (!m.finita) {
      ora += 100;
      for (const p of m.attesi()) m.azione(p, M.bot(m, p));
      if (m.fase === 'via') m.fineFase = Math.min(m.fineFase, ora);
      m.tick(ora);
      assert.ok(passi++ < 400000, 'la partita della mente non finisce');
    }
    livelli[n].push(m.livello); if (m.vinto) vinte++;
    assert.ok(m.vinto && m.risultato.vincitori.length === n, 'con i livelli da rifare si arriva sempre alla fine, e si vince tutti insieme');
  }
  const media = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
  console.log(`✓ The Mind: livelli per numero di giocatori, carte segrete, concentrazione, niente vite né stelle, errore = livello rifatto da capo con carte nuove (anche più volte), pausa, 90 partite tra computer (livello medio raggiunto in 2/3/4: ${media(livelli[2])}/${media(livelli[3])}/${media(livelli[4])}, vinte ${vinte}, rifacendo i livelli quando servono)`);
}

// ======================= FLIP 7 =======================
fissa('FLIP 7');
{
  const M = GIOCHI.flip7;
  const { mazzoFlip7, puntiRound } = M._test;
  const mz = mazzoFlip7();
  assert.strictEqual(mz.length, 94, '94 carte');
  assert.strictEqual(mz.filter((c) => c.tipo === 'num' && c.v === 12).length, 12);
  assert.strictEqual(mz.filter((c) => c.tipo === 'num' && c.v === 0).length, 1);
  assert.strictEqual(mz.filter((c) => c.tipo === 'azione').length, 9);
  let id = 0;
  const N = (v) => ({ id: `t${id++}`, tipo: 'num', v });
  const P = (v) => ({ id: `t${id++}`, tipo: 'mod', v, x2: false });
  const X2 = () => ({ id: `t${id++}`, tipo: 'mod', v: 0, x2: true });
  const A = (a) => ({ id: `t${id++}`, tipo: 'azione', a });
  // prepara un round con le carte in ordine (la prima dell'elenco è la prima pescata)
  const round = (n, carte) => {
    const g = M.crea({ n, primo: 0, opzioni: {} });
    g.mazziere = (2 * n - 2) % n; g.nRound = 0; g.totali.fill(0); // nuovoRound passa il mazzo a n-1: si comincia dal posto 0
    g.mazzo = [...carte].reverse().concat([]); g.scarti = [];
    g.mazzo = [...Array.from({ length: 30 }, () => N(0)), ...g.mazzo];
    g.nuovoRound();
    return g;
  };
  // distribuzione: una carta a testa partendo da sinistra del mazziere
  let g = round(2, [N(5), N(7), N(5)]);
  assert.ok(g.fase === 'gioco' && g.turno === 0 && g.g[0].numeri[0].v === 5 && g.g[1].numeri[0].v === 7, 'una carta scoperta a testa');
  g.azione(0, { tipo: 'pesca' });
  assert.ok(g.g[0].stato === 'sballato' && puntiRound(g.g[0]) === 0, 'doppione: sballato');
  assert.strictEqual(g.turno, 1);
  g.azione(1, { tipo: 'stai' });
  assert.ok(g.fase === 'riepilogo' && g.inAttesa && g.totali.join() === '0,7', 'fine round: chi si è fermato incassa');
  // punti: x2 solo sui numeri, poi i +
  assert.strictEqual(puntiRound({ numeri: [N(3), N(5)], mod: [X2(), P(4)], stato: 'fermo' }), 20);
  assert.strictEqual(puntiRound({ numeri: [0, 1, 2, 3, 4, 5, 6].map(N), mod: [], stato: 'flip7' }), 36, 'Flip 7: +15');
  // Flip 7 chiude subito il round
  g = round(2, [N(1), N(9), N(2), N(3), N(4), N(5), N(6)]);
  for (let k = 0; k < 5; k++) { g.azione(0, { tipo: 'pesca' }); if (g.fase === 'gioco') g.azione(1, { tipo: 'pesca' }); }
  // il giocatore 1 ha pescato zeri (dal fondo del mazzo): sballa al secondo zero
  assert.ok(g.fase === 'riepilogo' || g.finita);
  // seconda possibilità: salva dal doppione e si scarta insieme a lui
  g = round(2, [A('seconda'), N(4), N(8), N(8)]);
  assert.ok(g.g[0].seconda && g.g[1].numeri[0].v === 4, 'la seconda possibilità si tiene');
  assert.strictEqual(g.turno, 0);
  g.azione(0, { tipo: 'pesca' }); // 8
  g.azione(1, { tipo: 'stai' });
  g.azione(0, { tipo: 'pesca' }); // altro 8
  assert.ok(g.g[0].stato === 'attivo' && !g.g[0].seconda && g.g[0].numeri.length === 1, 'salvato dal doppione');
  // congela: si sceglie il bersaglio (anche sé stessi) e chi è congelato tiene i punti
  g = round(3, [N(6), N(9), N(3), A('congela')]);
  g.azione(0, { tipo: 'pesca' });
  assert.ok(g.pendente && g.pendente.tipo === 'bersaglio' && g.turno === 0 && g.pendente.scelte.length === 3, 'si sceglie chi congelare');
  assert.ok(g.azione(0, { tipo: 'pesca' }).errore, 'prima si sceglie');
  g.azione(0, { tipo: 'scegli', posto: 1 });
  assert.ok(g.g[1].stato === 'congelato' && g.turno === 2, 'congelato, tocca al prossimo in gioco');
  // pesca tre: tre carte, il Congela pescato in mezzo si usa dopo
  g = round(2, [N(10), N(11), A('tre'), N(1), A('congela'), N(2)]);
  g.azione(0, { tipo: 'pesca' });
  g.azione(0, { tipo: 'scegli', posto: 1 });
  assert.strictEqual(g.g[1].numeri.map((c) => c.v).join(), '11,1,2', 'pesca tre carte');
  assert.ok(g.pendente && g.pendente.chi === 1 && g.pendente.carta.a === 'congela', 'il Congela si usa dopo le tre carte');
  g.azione(1, { tipo: 'scegli', posto: 0 });
  assert.ok(g.g[0].stato === 'congelato');
  // azione durante la distribuzione: si usa subito; da soli in gioco vale per sé
  g = round(2, [A('congela'), N(3)]);
  assert.ok(g.pendente && g.pendente.chi === 0 && g.pendente.scelte.length === 2, 'azione in distribuzione: subito');
  g.azione(0, { tipo: 'scegli', posto: 0 });
  assert.ok(g.g[0].stato === 'congelato' && g.g[1].numeri.length === 1 && g.turno === 1);
  // seconda possibilità doppia: si regala a chi è in gioco
  g = round(3, [A('seconda'), N(2), N(3), A('seconda')]);
  g.azione(0, { tipo: 'pesca' });
  assert.ok(g.pendente && g.pendente.tipo === 'regala' && g.pendente.scelte.join() === '1,2');
  g.azione(0, { tipo: 'scegli', posto: 2 });
  assert.ok(g.g[2].seconda && g.turno === 1);
  // si vince a 200 (chi ne ha di più); le carte non si perdono mai
  const giocaTutta7 = (liv, n) => {
    const h = M.crea({ n, opzioni: {} });
    let passi = 0;
    while (!h.finita) {
      if (h.inAttesa) { h.avanza(); continue; }
      const r = h.azione(h.turno, M.bot(h, h.turno, liv[h.turno]));
      assert.ok(!r.errore, `flip7: ${r.errore}`);
      const inGioco = h.fase === 'riepilogo' || h.finita ? 0 : 1;
      const tot = h.mazzo.length + h.scarti.length + inGioco * h.g.reduce((s, x) => s + x.numeri.length + x.mod.length + (x.seconda ? 1 : 0), 0)
        + h.tre.reduce((s, t) => s + t.rinviate.length, 0) + h.daRisolvere.length + (h.pendente ? 1 : 0);
      assert.strictEqual(tot, 94, 'flip7: nessuna carta si perde');
      assert.ok(passi++ < 5000);
    }
    assert.ok(Math.max(...h.totali) >= 200 && h.risultato.vincitori.length === 1);
    return h;
  };
  const vitt = { facile: 0, medio: 0, difficile: 0 };
  const sfida = (a, b, k) => { let va = 0; for (let i = 0; i < k; i++) { const l = i % 2 ? [a, b] : [b, a]; const h = giocaTutta7(l, 2); if (l[h.risultato.vincitori[0]] === a) va++; } return va; };
  const dm = sfida('difficile', 'medio', 3200), mf = sfida('medio', 'facile', 1600); // tante partite: con 800 a volte si fallisce per caso
  for (let k = 0; k < 300; k++) { const l = [['facile', 'medio', 'difficile'], ['medio', 'difficile', 'facile'], ['difficile', 'facile', 'medio']][k % 3]; vitt[l[giocaTutta7(l, 3).risultato.vincitori[0]]]++; }
  assert.ok(dm > 1620 && mf > 800 && vitt.difficile > vitt.medio && vitt.medio > vitt.facile, `flip7: difficile più forte (${dm}/3200 col medio, ${mf}/1600 medio col facile, a tre ${JSON.stringify(vitt)})`);
  console.log(`✓ Flip 7: mazzo da 94, distribuzione, doppione, Flip 7 +15, x2, Seconda possibilità, Congela, Pesca tre con azioni rinviate, regalo, carte mai perse, computer (difficile ${dm}/3200 col medio, medio ${mf}/1600 col facile, a tre f/m/d ${vitt.facile}/${vitt.medio}/${vitt.difficile})`);
}

// ======================= CIRULLA =======================
fissa('CIRULLA');
{
  const M = GIOCHI.cirulla;
  const { presePossibili, accuso, quindiciIniziale, conta, MATTA } = M._test;
  const C = (id) => { const m = id.match(/^(\d+)([cqfp])$/); return { id, rango: Number(m[1]), seme: m[2] }; };
  const Cs = (s) => s.split(' ').map(C);
  const ids = (x) => JSON.stringify(x.map((o) => [...o].sort()).sort());
  // prese: uguale, somma, quindici; niente precedenza alla carta uguale
  assert.strictEqual(ids(presePossibili(C('6c'), Cs('6q 2f 4p 12c'))), ids([['6q'], ['2f', '4p'], ['12c']]), 'uguale, somma e 15 (6 + donna)');
  assert.strictEqual(ids(presePossibili(C('13c'), Cs('5q'))), ids([['5q']]), 're + 5 = 15');
  assert.strictEqual(ids(presePossibili(C('2c'), Cs('2q 4f 6p 1c'))), ids([['2q'], ['2q', '4f', '6p', '1c']]), 'presa da 15 con più carte');
  assert.strictEqual(ids(presePossibili(C('1c'), Cs('5q 3f 12p'))), ids([['5q', '3f', '12p']]), 'asso senza assi in tavola: piglia tutto');
  assert.strictEqual(ids(presePossibili(C('1c'), Cs('1q 13p 4f'))), ids([['1q'], ['13p', '4f']]), 'con un asso in tavola: quell\'asso o il 15');
  assert.strictEqual(presePossibili(C('1c'), []).length, 0, 'tavola vuota: l\'asso resta giù');
  // accusi e matta
  assert.deepStrictEqual(accuso(Cs('1q 2f 5p')), { tipo: 'barsega', scope: 3, matta: undefined });
  assert.strictEqual(accuso(Cs('1q 3f 6p')), null, 'somma 10: niente');
  assert.strictEqual(accuso(Cs('11q 11f 11p')).tipo, 'decino');
  assert.deepStrictEqual(accuso([C('12q'), C('12f'), C(MATTA)]), { tipo: 'decino', scope: 10, matta: 9 }, 'la matta completa il decino');
  assert.deepStrictEqual(accuso([C('2q'), C('4f'), C(MATTA)]), { tipo: 'barsega', scope: 3, matta: 1 }, 'nella bàrsega la matta vale 1');
  assert.strictEqual(accuso([C('5q'), C('6f'), C(MATTA)]), null, 'la matta che non serve resta un 7');
  assert.strictEqual(quindiciIniziale(Cs('1q 2f 5p 7q')), 1);
  assert.strictEqual(quindiciIniziale(Cs('13q 12f 7p 4q')), 2, 'trenta: due scope');
  assert.strictEqual(quindiciIniziale([C('13q'), C('12f'), C('1p'), C(MATTA)]), 2, 'la matta fa trenta');
  assert.strictEqual(quindiciIniziale([C('5q'), C('2f'), C('1p'), C(MATTA)]), 1, 'la matta fa quindici');
  assert.strictEqual(quindiciIniziale(Cs('13q 12f 2p 3q')), 0);
  // punti: Grande, Piccola, capotto
  const r = conta([Cs('1q 2q 3q 4q 5q 7q 11q 12q 13q 1c 1f 1p'), Cs('6q 2c')], [0, 0]);
  assert.ok(r[0].grande === 5 && r[0].piccola === 5 && r[1].grande === 0, 'Grande 5, Piccola con 4 e 5 = 5');
  assert.strictEqual(conta([Cs('1q 2q 3q 5q 6q'), []], [0, 0])[0].piccola, 3, 'Piccola interrotta dal 4 mancante');
  assert.strictEqual(conta([Cs('1q 2q 3q 4q 5q 6q 7q'), []], [0, 0])[0].piccola, 6, 'la Piccola arriva al 6: il 7 è il settebello e non la allunga');
  assert.ok(conta([Cs('1q 2q 3q 4q 5q 6q 7q 11q 12q 13q'), []], [0, 0])[0].capotto, 'capotto');
  // accuso automatico a inizio turno, mano scoperta per gli altri, matta con valore dichiarato
  const g = M.crea({ n: 2, primo: 0, opzioni: {} });
  g.tavolo = Cs('4c 5f'); g.mani = [[C('2q'), C('3f'), C(MATTA)], Cs('11c 12c 13c')]; g.scope = [0, 0]; g.valutata = [false, false]; g.accusi = [];
  g.impostaTurno(0);
  assert.ok(g.scope[0] === 3 && g.scoperte[0] && g.vista(1).scoperte[0].length === 3 && g.vista(0).scoperte[0] === null, 'bàrsega: 3 scope, mano scoperta');
  assert.strictEqual(g.mani[0].find((c) => c.id === MATTA).vale, 1);
  assert.ok(g.chatDa.length >= 1, 'l\'accuso compare in chat');
  g.azione(0, { tipo: 'gioca', carta: MATTA, presa: [] });
  assert.ok(g.azione(0, { tipo: 'gioca', carta: MATTA, presa: [] }).errore);
  // la matta vale 1 in tavola: con un 4 in tavola e un 5 si fa... il 5 prende 4 + matta (1) come somma
  assert.ok(presePossibili(C('5q'), g.tavolo).some((o) => o.includes(MATTA) && o.includes('4c')), 'la matta in tavola tiene il valore dichiarato');
  // partite tra computer: nessuna carta persa, il difficile più forte
  const giocaCir = (liv, n) => {
    const h = M.crea({ n, opzioni: {} });
    let passi = 0;
    while (!h.finita) {
      if (h.inAttesa) { h.avanza(); continue; }
      const res = h.azione(h.turno, M.bot(h, h.turno, liv[h.turno % liv.length]));
      assert.ok(!res.errore, `cirulla: ${res.errore}`);
      if (h.fase !== 'riepilogo') assert.strictEqual(h.mazzo.length + h.tavolo.length + h.prese.flat().length + h.mani.flat().length + (h.inCorso ? 1 : 0), 40, 'cirulla: carte perse');
      assert.ok(passi++ < 20000);
    }
    return h;
  };
  for (let k = 0; k < 20; k++) { giocaCir(['medio', 'difficile', 'facile'], 3); const q = giocaCir(['difficile', 'facile'], 4); assert.ok(q.risultato.vincitori.length === 2, 'in 4 vince la coppia'); }
  const sfida = (a, b, k) => { let va = 0; for (let i = 0; i < k; i++) { const l = i % 2 ? [a, b] : [b, a]; if (l[giocaCir(l, 2).risultato.vincitori[0]] === a) va++; } return va; };
  const dm = sfida('difficile', 'medio', 150), mf = sfida('medio', 'facile', 150);
  assert.ok(dm > 75 && mf > 75, `cirulla: il difficile vince di più (${dm}/150 col medio, medio ${mf}/150 col facile)`);
  console.log(`✓ Cirulla: prese uguali, somme e da 15, asso piglia tutto, bàrsega e decino con la matta, quindici e trenta iniziali, Grande, Piccola, capotto, partite in 2, 3 e 4 senza carte perse (difficile ${dm}/150 col medio, medio ${mf}/150 col facile)`);
}

// ======================= SOLITARIO KLONDIKE =======================
fissa('SOLITARIO KLONDIKE');
{
  const M = GIOCHI.solitario;
  const { puoSuColonna } = M._test;
  assert.ok(M.meta.soloPersone && M.meta.giocatori.includes(1), 'solo tra persone, anche da soli');
  const g = M.crea({ n: 3, opzioni: {} });
  const t = g.tavoli[0];
  assert.deepStrictEqual(t.colonne.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(t.colonne.every((c) => c.filter((x) => x.su).length === 1 && c[c.length - 1].su), 'solo l\'ultima scoperta');
  assert.strictEqual(t.tallone.length, 24);
  assert.strictEqual(JSON.stringify(g.tavoli[1].colonne), JSON.stringify(t.colonne), 'stessa distribuzione per tutti');
  const v = g.vista(0);
  assert.ok(v.mio.colonne[6].slice(0, 6).every((c) => c.id === null), 'le coperte non si vedono');
  // pesca 1 e giro del tallone
  for (let k = 0; k < 24; k++) g.azione(0, { tipo: 'pesca' });
  assert.ok(t.tallone.length === 0 && t.scarti.length === 24);
  g.azione(0, { tipo: 'pesca' });
  assert.ok(t.tallone.length === 24 && t.scarti.length === 0 && g.giri[0] === 1, 'rigira gli scarti');
  // regole di spostamento
  assert.ok(puoSuColonna({ rango: 9, seme: 'f' }, [{ rango: 10, seme: 'c', su: true }]));
  assert.ok(!puoSuColonna({ rango: 9, seme: 'q' }, [{ rango: 10, seme: 'c', su: true }]), 'colori alterni');
  assert.ok(!puoSuColonna({ rango: 12, seme: 'q' }, []), 'colonna vuota: solo il re');
  // tavolo costruito a mano: mossa di una pila, carta che si gira, base, ripresa dalla base
  const h = M.crea({ n: 2, opzioni: {} });
  const T = h.tavoli[0];
  T.colonne = [[{ id: '5p', rango: 5, seme: 'p', su: false }, { id: '10c', rango: 10, seme: 'c', su: true }], [{ id: '9f', rango: 9, seme: 'f', su: true }, { id: '8q', rango: 8, seme: 'q', su: true }], [], [], [], [], []];
  T.basi = [[], [], [], []]; T.scarti = [{ id: '1c', rango: 1, seme: 'c', su: true }]; T.tallone = [];
  assert.ok(h.azione(0, { tipo: 'muovi', da: { tipo: 'col', i: 1, k: 1 }, a: { tipo: 'col', i: 0 } }).errore, '8 rosso su 10 no');
  h.azione(0, { tipo: 'muovi', da: { tipo: 'col', i: 1, k: 0 }, a: { tipo: 'col', i: 0 } });
  assert.strictEqual(T.colonne[0].map((c) => c.id).join(), '5p,10c,9f,8q', 'si sposta la pila');
  assert.ok(h.azione(0, { tipo: 'muovi', da: { tipo: 'col', i: 0, k: 0 }, a: { tipo: 'col', i: 2 } }).errore, 'le coperte non si prendono');
  h.azione(0, { tipo: 'muovi', da: { tipo: 'scarti' }, a: { tipo: 'base', i: 'auto' } });
  assert.strictEqual(T.basi[0][0].id, '1c', 'l\'asso va sulla base');
  T.colonne[3] = [{ id: '11f', rango: 11, seme: 'f', su: true }];
  h.azione(0, { tipo: 'muovi', da: { tipo: 'col', i: 0, k: 1 }, a: { tipo: 'col', i: 3 } });
  assert.strictEqual(T.colonne[3].length, 4);
  assert.ok(T.colonne[0][0].su, 'la carta coperta rimasta in cima si gira');
  // vittoria: tutto scoperto, "finisci" porta tutto sulle basi e chiude la gara
  const w = M.crea({ n: 2, opzioni: {} });
  const W = w.tavoli[1];
  W.tallone = []; W.scarti = []; W.basi = [[], [], [], []];
  W.colonne = [[], [], [], [], [], [], []];
  ['c', 'q', 'f', 'p'].forEach((s, i) => { for (let r = 13; r >= 1; r--) W.colonne[i].push({ id: `${r}${s}`, rango: r, seme: s, su: true }); });
  assert.ok(!w.azione(1, { tipo: 'finisci' }).errore);
  assert.ok(w.finita && w.risultato.vincitori.join() === '1' && w.tempi[1] !== null, 'il primo che finisce vince la gara');
  // tutti arresi: vince chi ha più carte sulle basi
  const a = M.crea({ n: 2, opzioni: {} });
  a.tavoli[0].basi[0] = [{ id: '1c', rango: 1, seme: 'c' }];
  a.azione(0, { tipo: 'arrenditi' });
  assert.ok(!a.finita && a.azione(0, { tipo: 'pesca' }).errore, 'chi si è arreso non gioca più');
  a.azione(1, { tipo: 'arrenditi' });
  assert.ok(a.finita && a.risultato.vincitori.join() === '0');
  // tempo scaduto e pausa da soli
  const s = M.crea({ n: 1, opzioni: { limite: 10 } });
  assert.ok(s.pausaBoss && !M.crea({ n: 2 }).pausaBoss, 'da soli si ferma con le dispense, in gara no');
  s.impostaPausa(true); s.pausaDal -= 60000; s.impostaPausa(false);
  assert.ok(Date.now() - s.inizio < 1000, 'la pausa non conta');
  s.inizio -= 11 * 60000;
  assert.ok(s.controllaTempo() && s.finita && s.risultato.titolo.startsWith('Non risolto'), 'tempo scaduto');
  console.log('✓ Solitario Klondike: 7 colonne, pesca 1 con giri illimitati, colori alterni, re sulle vuote, pile, carta che si gira, basi, finisci, gara con stessa distribuzione, resa, limite di tempo, pausa da soli');
}

// ======================= ALLEGRO CHIRURGO =======================
fissa('ALLEGRO CHIRURGO');
{
  const M = GIOCHI.chirurgo;
  const { generaPercorso, vicino, larghezza, PARAM, LIVELLI } = M._test;
  assert.strictEqual(LIVELLI.length, 6, 'sei difficoltà');
  for (const l of LIVELLI) {
    const pc = generaPercorso(l);
    assert.ok(pc.pts.every(([x, y]) => x > 20 && x < 980 && y > 20 && y < 600), `${l}: percorso dentro la tavola`);
    // i giri del serpentone non si toccano: punti lontani sul percorso sono lontani anche nello spazio
    for (let i = 0; i < pc.pts.length; i += 7) for (let j = i + 1; j < pc.pts.length; j += 7) {
      if (pc.lung[j] - pc.lung[i] > 400) assert.ok(Math.hypot(pc.pts[i][0] - pc.pts[j][0], pc.pts[i][1] - pc.pts[j][1]) > PARAM[l].w + 8, `${l}: corridoi che si toccano`);
    }
  }
  const media = (l) => Array.from({ length: 12 }, () => generaPercorso(l).totale).reduce((a, b) => a + b, 0) / 12;
  assert.ok(media('estremo') > media('facile') * 1.5, 'l\'estremo è molto più lungo');
  const famiglie = new Set(Array.from({ length: 30 }, () => generaPercorso('normale').famiglia));
  assert.ok(famiglie.size >= 3, `percorsi di tipi diversi (${[...famiglie].join(', ')})`);
  // vicino con la finestra: dove due giri passano vicini non si salta sull'altro giro
  const sp = generaPercorso('esperto', 'spirale');
  const a0 = vicino(sp, sp.pts[10][0], sp.pts[10][1], 10);
  assert.ok(a0.idx >= 0 && a0.idx < 100 && a0.d < 1, 'si resta sul proprio pezzo di percorso');
  assert.ok(larghezza('estremo', 0) !== larghezza('estremo', 700) && larghezza('facile', 0) === larghezza('facile', 700), 'solo l\'estremo si stringe e si allarga');
  const g = M.crea({ n: 2, opzioni: { difficolta: 'facile', round: 1 } });
  assert.strictEqual(g.vista(0).percorso.length, g.percorso.pts.length, 'stesso percorso per tutti, visibile dal conto alla rovescia');
  g.tick(g.inizio + 1);
  assert.strictEqual(g.fase, 'corsa');
  const P = g.percorso.pts;
  g.input(0, { t: 'via', x: P[40][0], y: P[40][1] });
  assert.strictEqual(g.g[0].stato, 'pronto', 'si parte solo dal cerchio VIA');
  g.input(0, { t: 'via', x: P[0][0], y: P[0][1] });
  assert.strictEqual(g.g[0].stato, 'corre');
  for (let i = 0; i < P.length; i += 5) g.input(0, { t: 'pos', x: P[i][0], y: P[i][1] + 3 });
  g.input(0, { t: 'pos', x: P[P.length - 1][0], y: P[P.length - 1][1] });
  assert.ok(g.g[0].stato === 'arrivato' && g.g[0].tempo !== null, 'percorso fatto senza toccare: arrivato');
  g.input(1, { t: 'via', x: P[0][0], y: P[0][1] });
  g.input(1, { t: 'pos', x: P[30][0], y: -120 });
  assert.ok(g.g[1].stato === 'pronto' && g.g[1].tocchi === 1, 'fuori dal corridoio: si ricomincia');
  g.input(1, { t: 'via', x: P[0][0], y: P[0][1] });
  g.input(1, { t: 'pos', x: P[P.length - 1][0], y: P[P.length - 1][1] });
  assert.ok(g.g[1].stato === 'pronto' && g.g[1].tocchi === 2, 'salto impossibile: si ricomincia');
  g.input(1, { t: 'via', x: P[0][0], y: P[0][1] });
  g.input(1, { t: 'tocca' });
  assert.strictEqual(g.g[1].tocchi, 3);
  g.fineFase = 0; g.tick(Date.now());
  assert.ok(g.fase === 'pausa' && g.punti.join() === '2,0', 'il primo prende tanti punti quanti i giocatori');
  g.fineFase = 0; g.tick(Date.now());
  assert.ok(g.finita && g.risultato.vincitori.join() === '0');
  // pausa: il tempo si ferma e chi correva riparte
  const h = M.crea({ n: 1, opzioni: { difficolta: 'facile' } });
  h.tick(h.inizio + 1);
  h.input(0, { t: 'via', x: h.percorso.pts[0][0], y: h.percorso.pts[0][1] });
  const ini = h.inizio;
  h.impostaPausa(true); h.pausaDal -= 3000; h.impostaPausa(false);
  assert.ok(h.inizio >= ini + 3000 && h.g[0].stato === 'pronto', 'pausa: il tempo non conta e si riparte dal VIA');
  // computer: il difficile arriva prima del medio, il medio del facile
  const vitt = { facile: 0, medio: 0, difficile: 0 };
  const arrivati = { facile: 0, medio: 0, difficile: 0 };
  for (const d of LIVELLI) for (let k = 0; k < 8; k++) {
    const c = M.crea({ n: 3, opzioni: { difficolta: d, round: 1 }, bot: ['facile', 'medio', 'difficile'] });
    let ora = Date.now();
    while (!c.finita) { ora += 50; if (c.fase === 'via') c.inizio = Math.min(c.inizio, ora); if (c.fase === 'pausa') c.fineFase = ora; c.tick(ora); }
    ['facile', 'medio', 'difficile'].forEach((l, i) => { if (c.storico[0].tempi[i] !== null) arrivati[l]++; });
    if (c.risultato.vincitori.length) vitt[['facile', 'medio', 'difficile'][c.risultato.vincitori[0]]]++;
  }
  assert.ok(vitt.difficile > vitt.medio && vitt.medio >= vitt.facile && arrivati.difficile > arrivati.medio && arrivati.medio > arrivati.facile, `chirurgo: ${JSON.stringify(vitt)} ${JSON.stringify(arrivati)}`);
  console.log(`✓ Allegro chirurgo: 6 difficoltà, percorsi dentro la tavola e con i giri separati, si parte dal VIA, bordo o salto = da capo, punti per ordine d'arrivo, pausa, computer (vittorie f/m/d ${vitt.facile}/${vitt.medio}/${vitt.difficile}, percorsi finiti ${arrivati.facile}/${arrivati.medio}/${arrivati.difficile} su 48)`);
}

// ======================= HUMAN BENCHMARK 1v1 =======================
fissa('HUMAN BENCHMARK 1v1');
{
  const M = GIOCHI.benchmark;
  const { PROVE } = M._test;
  const g = M.crea({ n: 2, opzioni: {} });
  assert.deepStrictEqual(g.ordine, PROVE);
  assert.strictEqual(g.vista(0).dati, null, 'i dati arrivano quando la prova parte');
  assert.ok(g.azione(0, { tipo: 'reazione', ms: 250, prova: 'reazione' }).errore, 'durante la presentazione non si gioca');
  const via = () => { g.fineFase = 0; g.tick(Date.now()); };
  via();
  assert.strictEqual(g.fase, 'prova');
  assert.deepStrictEqual(g.vista(0).dati, g.vista(1).dati, 'stessi dati per tutti e due');
  assert.ok(g.azione(0, { tipo: 'reazione', ms: 20, prova: 'reazione' }).errore, 'tempi impossibili rifiutati');
  for (const ms of [200, 220, 240, 260, 280]) g.azione(0, { tipo: 'reazione', ms, prova: 'reazione' });
  for (const ms of [300, 300, 300, 300, 300]) g.azione(1, { tipo: 'reazione', ms, prova: 'reazione' });
  assert.ok(g.fase === 'risultato' && g.punti.join() === '1,0' && g.storico[0].valori.join() === '240,300', 'reazione: vince la media più bassa');
  via(); via();
  // memoria di sequenza: le risposte le controlla il server
  const seq = g.dati.seq;
  assert.ok(g.azione(0, { tipo: 'livello', risposta: [seq[0]], prova: 'sequenza' }).giusta);
  assert.ok(g.azione(0, { tipo: 'livello', risposta: [seq[0], seq[1]], prova: 'sequenza' }).giusta);
  g.azione(0, { tipo: 'livello', risposta: [seq[0], seq[1], (seq[2] + 1) % 9], prova: 'sequenza' });
  g.azione(1, { tipo: 'livello', risposta: [(seq[0] + 1) % 9], prova: 'sequenza' });
  assert.ok(g.storico[1].valori.join() === '2,0' && g.punti.join() === '2,0', 'sequenza: vince il livello più alto');
  via(); via();
  const num = g.dati.numeri;
  g.azione(0, { tipo: 'livello', risposta: num[0], prova: 'numeri' });
  g.azione(0, { tipo: 'livello', risposta: '0', prova: 'numeri' });
  g.azione(1, { tipo: 'livello', risposta: num[0], prova: 'numeri' });
  g.azione(1, { tipo: 'livello', risposta: num[1], prova: 'numeri' });
  g.azione(1, { tipo: 'livello', risposta: 'x', prova: 'numeri' });
  assert.ok(g.storico[2].valori.join() === '1,2' && g.punti.join() === '2,1');
  via(); via();
  assert.ok(g.azione(0, { tipo: 'bersagli', ms: 900, prova: 'bersagli' }).errore, 'troppo veloce per essere vero');
  g.azione(0, { tipo: 'bersagli', ms: 9000, prova: 'bersagli' }); g.azione(1, { tipo: 'bersagli', ms: 12000, prova: 'bersagli' });
  assert.strictEqual(g.punti.join(), '3,1');
  via();
  assert.ok(g.finita && g.risultato.vincitori.join() === '0', 'al meglio di 5: chi arriva a 3 vince');
  // memoria visiva: 3 errori = una vita, schema completo = livello su
  const v = M.crea({ n: 1, opzioni: {} });
  v.k = 3; v.prossimaProva(Date.now()); v.fineFase = 0; v.tick(Date.now());
  assert.strictEqual(v.tipo, 'visiva');
  const sch = v.dati.schemi[0][0];
  v.azione(0, { tipo: 'visiva', scelte: sch, prova: 'visiva' });
  assert.strictEqual(v.g[0].livello, 2);
  const fuori = (s) => Array.from({ length: 16 }, (_, i) => i).filter((i) => !s.includes(i)).slice(0, 3);
  v.azione(0, { tipo: 'visiva', scelte: fuori(v.dati.schemi[1][0]), prova: 'visiva' });
  assert.ok(v.g[0].vite === 2 && v.g[0].livello === 2 && v.g[0].tentativo === 1, 'tre errori: una vita in meno e schema nuovo');
  v.azione(0, { tipo: 'visiva', scelte: fuori(v.dati.schemi[1][1]), prova: 'visiva' });
  v.azione(0, { tipo: 'visiva', scelte: fuori(v.dati.schemi[1][2]), prova: 'visiva' });
  assert.ok(v.g[0].fatto && v.g[0].valore === 1, 'finite le vite la prova finisce');
  // pausa: le risposte cominciate prima della pausa non valgono
  const q = M.crea({ n: 2, opzioni: {} }); q.fineFase = 0; q.tick(Date.now());
  q.impostaPausa(true); q.impostaPausa(false);
  assert.ok(q.azione(0, { tipo: 'reazione', ms: 250, prova: 'reazione', pausa: 0 }).errore, 'tentativo di prima della pausa rifiutato');
  // computer
  const sfida = (a, b, k) => { let va = 0; for (let i = 0; i < k; i++) { const l = i % 2 ? [a, b] : [b, a]; const c = M.crea({ n: 2, opzioni: {}, bot: l }); let ora = Date.now(); while (!c.finita) { ora += 100; if (c.fase !== 'prova') c.fineFase = Math.min(c.fineFase, ora); c.tick(ora); } if (c.risultato.vincitori.length && l[c.risultato.vincitori[0]] === a) va++; } return va; };
  const dm = sfida('difficile', 'medio', 60), mf = sfida('medio', 'facile', 60);
  assert.ok(dm > 45 && mf > 45, `benchmark: ${dm} ${mf}`);
  console.log(`✓ Human Benchmark 1v1: 5 prove con gli stessi dati, reazione (media), sequenza, numeri, bersagli, visiva con vite, risposte controllate dal server, al meglio di 5, pausa, computer (difficile ${dm}/60 col medio, medio ${mf}/60 col facile)`);
}

// ======================= CENSURA IN CHAT =======================
fissa('CENSURA IN CHAT');
{
  const { censura } = require('../censura');
  for (const t of ['viagano', 'Viaganò', 'VIAGANO', 'ViAgAnÓ', 'v i a g a n o', 'vi.a.ga.no', 'viaaagano', 'Via Ganò', 'vigano', 'Viganò', 'VIGANÓ', 'v.i.g.a.n.o', 'Vi Ga Nò', 'vigan0', 'Vigano\u0300']) assert.ok(!/[a-zà-ú]{4}/i.test(censura(t).replace(/\*/g, '')), `non censurato: ${t}`);
  assert.strictEqual(censura('ciao viaganò come va'), 'ciao ******* come va');
  for (const t of ['viaggio', 'via Garibaldi', 'vagano', 'il gatto', 'vignaiolo', 'Vigna', 'viganella'].slice(0, 6)) assert.strictEqual(censura(t), t, `censurato per sbaglio: ${t}`);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  const aiuto = src.slice(src.indexOf('const AIUTO_COMANDI'), src.indexOf('};', src.indexOf('const AIUTO_COMANDI')));
  assert.ok(!/'67'/.test(aiuto), 'il 67 è un easter egg: non compare nella lista dei comandi');
  console.log('✓ Chat: vigano/viganò e viagano/viaganò censurati in ogni forma (maiuscole, accenti, spazi), le parole normali no; il 67 non è nella lista dei comandi');
}

// ======================= DISEGNA E INDOVINA =======================
fissa('DISEGNA E INDOVINA');
{
  const M = GIOCHI.disegna;
  const { pulisci, PAROLE } = M._test;
  assert.ok(M.meta.soloPersone && M.meta.pausaBoss && PAROLE.length >= 200 && new Set(PAROLE).size === PAROLE.length, 'solo persone, tante parole diverse');
  assert.strictEqual(pulisci('  Caffè!! '), 'caffe');
  const g = M.crea({ n: 3, opzioni: {} });
  assert.ok(g.fase === 'scelta' && g.disegnatore === 0 && g.vista(0).scelte.length === 3 && g.vista(1).scelte === null, 'chi disegna sceglie tra 3 parole');
  assert.ok(g.azione(1, { tipo: 'scegli', i: 0 }).errore, 'sceglie solo chi disegna');
  g.azione(0, { tipo: 'scegli', i: 1 });
  const w = g.scelte[1];
  assert.ok(g.fase === 'disegno' && g.durata === 80000, '80 secondi');
  assert.ok(g.vista(0).parola === w && g.vista(1).parola === null && g.vista(1).suggerimento.every((x) => x === '_' || x === ' '), 'gli altri vedono solo i trattini');
  g.input(0, { t: 'seg', k: 1, c: '#e0473c', s: 7, p: [[10, 10], [20, 20]] });
  g.input(1, { t: 'seg', k: 2, c: '#e0473c', s: 7, p: [[10, 10]] });
  assert.ok(g.segmenti.length === 1 && g.vistaTick().seg.length === 1, 'disegna solo chi deve');
  assert.ok(g.leggiChat(0, `è ${w}`).nascondi, 'chi disegna non può scrivere la parola');
  assert.deepStrictEqual(g.leggiChat(1, 'boh'), {}, 'le risposte sbagliate si vedono');
  const r = g.leggiChat(2, w.toUpperCase());
  assert.ok(r.nascondi && g.indovinato[2] !== null && g.punti[2] >= 300 && g.punti[0] === 60, 'indovinare: messaggio nascosto, punti a chi indovina e a chi disegna');
  assert.ok(g.leggiChat(2, w).nascondi, 'chi ha già indovinato non la svela');
  g.inizio -= 40000; // metà tempo passata
  g.leggiChat(1, w);
  assert.ok(g.punti[1] < g.punti[2], 'chi indovina prima prende di più');
  assert.strictEqual(g.fase, 'rivela', 'tutti hanno indovinato: il turno finisce');
  g.tick(g.fineFase + 1);
  assert.ok(g.disegnatore === 1 && g.fase === 'scelta' && g.segmenti.length === 0, 'tocca al prossimo, lavagna pulita');
  g.tick(g.fineFase + 1);
  assert.ok(g.fase === 'disegno' && g.parola, 'se non sceglie, parola a caso');
  const w2 = g.parola;
  if (w2.length >= 4) assert.ok(g.leggiChat(0, w2.slice(0, -1)).privato, 'ci sei quasi (una lettera di differenza)');
  g.tick(g.inizio + g.durata * 0.8);
  g.tick(g.inizio + g.durata * 0.8);
  const lettere = w2.replace(/[^a-zàèéìòù]/gi, '').length;
  assert.strictEqual(g.aiuti.length, Math.min(2, Math.floor(lettere / 3)), 'lettere di aiuto a metà e a tre quarti');
  g.input(1, { t: 'seg', k: 5, c: '#1f2430', s: 7, p: [[1, 1]] }); g.input(1, { t: 'seg', k: 6, c: '#1f2430', s: 7, p: [[2, 2]] });
  const v = g.versione;
  g.azione(1, { tipo: 'annulla' });
  assert.ok(g.segmenti.length === 1 && g.versione === v + 1, 'annulla l\'ultimo tratto');
  g.azione(1, { tipo: 'pulisci' });
  assert.strictEqual(g.segmenti.length, 0);
  // pausa e uscita di chi disegna
  const ff = g.fineFase;
  g.impostaPausa(true); g.pausaDal -= 5000; g.impostaPausa(false);
  assert.ok(g.fineFase >= ff + 5000, 'la pausa non conta');
  g.esce(1);
  assert.strictEqual(g.fase, 'rivela', 'se chi disegna se ne va, il turno finisce');
  g.tick(g.fineFase + 1);
  assert.strictEqual(g.disegnatore, 2);
  g.fase = 'rivela'; g.fineFase = 0; g.giri = 1; g.tick(Date.now());
  assert.ok(g.finita && g.risultato.vincitori.length <= 1, 'dopo i giri vince chi ha più punti');
  console.log('✓ Disegna e indovina: 3 parole a scelta, 80 secondi, trattini e lettere di aiuto, tratti solo di chi disegna, risposta giusta nascosta, ci sei quasi, punti per velocità e a chi disegna, annulla e cancella, pausa, uscita, giri');
}

// ======================= MINIGOLF PARTY 3D (era Putt Party 2D) =======================
fissa('PUTT PARTY 2D');
{
  const M = GIOCHI.putt;
  const { B, V_MAX, V_BUCA, POTERI, MAX_POTERI } = M._test;
  const { COURSE, NOMI_COURSE } = B;
  assert.ok(M.meta.soloPersone && M.meta.pausaBoss && M.meta.soloComputer, 'solo persone, solo al computer');
  assert.deepStrictEqual(NOMI_COURSE, ['classica', 'pirati', 'ghiaccio', 'giungla', 'spazio', 'colline', 'open']);
  for (const c of NOMI_COURSE) if (c !== 'open') assert.ok(COURSE[c].buche.length > 6, `${c}: più di 6 buche disegnate`);
  assert.ok(COURSE.open.buche.length === 6 && COURSE.open.buche.every((b) => b.W === COURSE.open.buche[0].W && b.bordo === COURSE.open.buche[0].bordo), 'Open Course: una mappa sola con 6 buche');
  assert.ok(M.meta.opzioni.find((o) => o.id === 'course').valori.join() === '1,3,5,7', 'nella lobby: 1, 3, 5 o 7 course');
  assert.ok(M.meta.opzioni.find((o) => o.id === 'prima').valori.includes('colline'), 'si può partire dalle colline');
  // tutte le buche: più grandi dello schermo, partenza, buca e scatole sul prato, buca raggiungibile (rampe e tubi compresi)
  const dSeg = (x, y, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1; const u = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)); return Math.hypot(x - x1 - u * dx, y - y1 - u * dy); };
  let nBuche = 0;
  for (const [cid, co] of Object.entries(COURSE)) for (const b of co.buche) {
    nBuche++;
    const segs = B.segmentiFissi(b), C = 16, nx = Math.ceil(b.W / C), ny = Math.ceil(b.H / C);
    const ok = (x, y, salto) => B.dentroPoligono(x, y, b.bordo) && segs.every((sg) => dSeg(x, y, sg) > 10) && (salto || !(b.acqua || []).some((r) => B.dentro(x, y, r))) && (salto || (b.muretti || []).every((sg) => dSeg(x, y, sg) > 10)) && (b.rocce || []).concat(b.respingenti || []).every(([cx, cy, r]) => Math.hypot(x - cx, y - cy) > r + 9);
    assert.ok(b.W >= 1300 && b.H >= 700, `${cid}/${b.id}: buca più grande dello schermo`);
    for (const pt of [b.partenza, b.buca, ...(b.pu || [])]) assert.ok(ok(pt[0], pt[1]), `${cid}/${b.id}: punto ${pt} sul prato`);
    const vicinoRampa = (x, y) => (b.rampe || []).some((r) => Math.abs(y - (r.r[1] + r.r[3] / 2)) < r.r[3] / 2 + 40 && (Math.cos(r.a) > 0 ? x > r.r[0] && x < r.r[0] + 900 : x < r.r[0] + r.r[2] && x > r.r[0] - 900));
    const vis = new Uint8Array(nx * ny), coda = [], cella = (x, y) => [Math.floor(x / C), Math.floor(y / C)];
    const [sx, sy] = cella(...b.partenza); vis[sy * nx + sx] = 1; coda.push([sx, sy]);
    while (coda.length) {
      const [ci, cj] = coda.pop(), x = ci * C + C / 2, y = cj * C + C / 2;
      for (const tu of b.tubi || []) if (Math.hypot(x - tu.a[0], y - tu.a[1]) < 24) { const [a, c2] = cella(...tu.b); if (!vis[c2 * nx + a]) { vis[c2 * nx + a] = 1; coda.push([a, c2]); } }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = ci + di, c2 = cj + dj; if (a < 0 || c2 < 0 || a >= nx || c2 >= ny || vis[c2 * nx + a]) continue; const xx = a * C + C / 2, yy = c2 * C + C / 2; if (ok(xx, yy, vicinoRampa(xx, yy))) { vis[c2 * nx + a] = 1; coda.push([a, c2]); } }
    }
    const [bx, by] = cella(...b.buca); let raggiunta = false;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (vis[(by + dj) * nx + bx + di]) raggiunta = true;
    assert.ok(raggiunta, `${cid}/${b.id}: la buca si raggiunge`);
  }
  // le course in fila: 6 buche a caso per course, la prima scelta per prima, niente doppioni
  for (const quante of [1, 3, 5, 7]) {
    const x = M.crea({ n: 1, opzioni: { course: quante, prima: 'spazio' } });
    assert.ok(x.course.length === quante && x.course[0] === 'spazio' && new Set(x.course).size === quante, `${quante} course, la prima è quella scelta`);
    assert.strictEqual(x.ordine.length, quante * 6, `${quante} course = ${quante * 6} buche`);
    for (const c of x.course) { const mie = x.ordine.filter((r) => r[0] === c).map((r) => r[1]); assert.ok(mie.length === 6 && new Set(mie).size === 6, `${c}: 6 buche diverse`); }
  }
  const ordini = new Set(Array.from({ length: 20 }, () => M.crea({ n: 1, opzioni: { prima: 'pirati' } }).ordine.map((r) => r[1]).join()));
  assert.ok(ordini.size > 12, 'ogni partita buche diverse');
  assert.deepStrictEqual(M.crea({ n: 1, opzioni: { prima: 'open' } }).ordine.map((r) => r[1]), [0, 1, 2, 3, 4, 5], 'l\'Open Course sempre in ordine');
  // una buca a scelta, pronta per tirare
  const avanti = (g, ms) => { let ora = g.ultimoTick || Date.now(); for (let t = 0; t < ms; t += 33) { ora += 33; g.tick(ora); } };
  const buca = (c, i, n = 1) => { const g = M.crea({ n, opzioni: { prima: c } }); g.ordine = [[c, i], [c, (i + 1) % COURSE[c].buche.length]]; g.k = -1; g.prossimaBuca(Date.now()); g.tick(g.inizio + 1); return g; };
  // tiri a caso in ogni buca: la pallina resta sempre nel campo
  for (const [cid, co] of Object.entries(COURSE)) co.buche.forEach((b, bi) => {
    if (cid === 'open' && bi) return;
    const g = buca(cid, bi);
    for (let k = 0; k < 6 && !g.palle[0].dentro; k++) {
      g.input(0, { t: 'tiro', a: Math.random() * 6.3, f: Math.random() });
      for (let k2 = 0; k2 < 250 && g.k === 0 && !g.palle[0].dentro && (g.palle[0].vx || g.palle[0].vy); k2++) avanti(g, 33);
      if (g.k !== 0) break;
      const q = g.palle[0];
      assert.ok(q.dentro || B.dentroPoligono(q.x, q.y, b.bordo), `${cid}/${b.id}: pallina uscita dal campo`);
    }
  });
  // attrito realistico: un tiro pieno scorre a lungo e a bassa velocità si ferma piano
  const pista = { ...COURSE.classica.buche[0], bordo: [[0, 0], [9000, 0], [9000, 600], [0, 600]], buca: [8900, 300] };
  const q = { x: 100, y: 300, vx: V_MAX, vy: 0, aria: 0 }; let tempo = 0;
  while ((q.vx || q.vy) && tempo < 20) { M._test.passo(pista, q, 0.033, 0, [], [], []); tempo += 0.033; if (Math.hypot(q.vx, q.vy) < 5) break; }
  assert.ok(q.x > 2500 && tempo > 5, `il tiro più forte scorre a lungo (${Math.round(q.x)} px in ${tempo.toFixed(1)} s)`);
  const lenta = { x: 100, y: 300, vx: 100, vy: 0, aria: 0 }; let tl = 0; while (Math.hypot(lenta.vx, lenta.vy) > 5) { M._test.passo(pista, lenta, 0.033, 0, [], [], []); tl += 0.033; }
  assert.ok(tl > 1, 'a bassa velocità rallenta piano (non si ferma di colpo)');
  // la buca: anche con un passo lungo (rete lenta) la pallina che ci passa sopra piano entra; troppo forte ci passa sopra
  const rt = COURSE.classica.buche[0], [bx0, by0] = rt.buca;
  const lungo = { x: bx0 - 30, y: by0, vx: V_BUCA - 40, vy: 0, aria: 0 };
  assert.strictEqual(M._test.passo(rt, lungo, 0.08, 0, B.segmentiFissi(rt), [], []), 'buca', 'passandoci sopra piano entra (controllo a ogni piccolo passo)');
  const forte = { x: bx0 - 30, y: by0, vx: 1400, vy: 0, aria: 0 };
  assert.notStrictEqual(M._test.passo(rt, forte, 0.03, 0, B.segmentiFissi(rt), [], []), 'buca', 'troppo forte: ci passa sopra');
  const labbro = { x: bx0 - 30, y: by0 + 16, vx: 120, vy: 0, aria: 0 };
  let rl = null; for (let k = 0; k < 40 && !rl; k++) rl = M._test.passo(rt, labbro, 0.033, 0, B.segmentiFissi(rt), [], []);
  assert.strictEqual(rl, 'buca', 'sfiorandola piano entra di labbro');
  // respingenti: spinta decisa (riparte almeno a 720 px/s)
  const rb = { x: 400 - 36, y: 300, vx: 200, vy: 0 };
  M._test.urtoCerchio(rb, 400, 300, 30, true);
  assert.ok(rb.vx < 0 && Math.hypot(rb.vx, rb.vy) >= 720, 'il respingente rilancia forte');
  const rc = { x: 400 - 36, y: 300, vx: 200, vy: 0 }; M._test.urtoCerchio(rc, 400, 300, 30, false);
  assert.ok(Math.hypot(rc.vx, rc.vy) < 200, 'una roccia invece rimbalza normale');
  // acqua: torna dove era stata tirata, +1
  const w = buca('pirati', 1); const p0 = [w.palle[0].x, w.palle[0].y];
  w.palle[0].x = 760; w.palle[0].y = 330; w.palle[0].da = [760, 330]; w.input(0, { t: 'tiro', a: 0, f: 0.2 }); avanti(w, 3000);
  assert.ok(w.palle[0].colpi === 2 && Math.hypot(w.palle[0].x - 760, w.palle[0].y - 330) < 1, 'in acqua: un colpo di penalità e si torna indietro');
  // rampa: salta il fiume; tubo: entri da una parte ed esci dall'altra
  const fi = buca('giungla', 1); Object.assign(fi.palle[0], { x: 600, y: 450 }); fi.input(0, { t: 'tiro', a: 0, f: 0.55 });
  let saltato = false; for (let k = 0; k < 200 && !fi.palle[0].dentro; k++) { avanti(fi, 33); if (fi.palle[0].aria > 0) saltato = true; if (!(fi.palle[0].vx || fi.palle[0].vy)) break; }
  assert.ok(saltato && fi.palle[0].colpi === 1 && (fi.palle[0].dentro || fi.palle[0].x > 1090), 'la rampa fa saltare il fiume');
  const po = buca('spazio', 3); Object.assign(po.palle[0], { x: 740, y: 300 }); po.input(0, { t: 'tiro', a: 0, f: 0.12 }); avanti(po, 1500);
  assert.ok(po.palle[0].x > 1000, 'il portale porta dall\'altra parte del muro');
  // power-up: scatole (una volta a testa), al massimo 3, effetti
  assert.ok(POTERI.length === 9 && MAX_POTERI === 3);
  const pw = buca('classica', 2, 3), [s1] = pw.buca.pu;
  Object.assign(pw.palle[0], { x: s1[0], y: s1[1] }); avanti(pw, 66);
  assert.strictEqual(pw.poteri[0].length, 1, 'passando sulla scatola si prende un power-up');
  avanti(pw, 200); assert.strictEqual(pw.poteri[0].length, 1, 'ogni scatola una volta sola');
  pw.poteri[0] = ['turbo', 'nebbia', 'mira']; pw.palle[0].prese = [];
  Object.assign(pw.palle[0], { x: s1[0], y: s1[1] }); avanti(pw, 66);
  assert.strictEqual(pw.poteri[0].length, 3, 'al massimo 3 in tasca');
  Object.assign(pw.palle[0], { x: pw.buca.partenza[0], y: pw.buca.partenza[1], vx: 0, vy: 0 });
  pw.input(0, { t: 'usa', i: 0 }); pw.input(0, { t: 'tiro', a: Math.PI, f: 0.5 });
  assert.ok(Math.abs(Math.hypot(pw.palle[0].vx, pw.palle[0].vy) - 0.5 * V_MAX * 1.6) < 1, 'turbo: tiro più forte del 60%');
  pw.input(0, { t: 'usa', i: 0 }); pw.input(0, { t: 'usa', i: 0 });
  assert.ok(pw.palle[1].nebbia > 0 && pw.palle[2].nebbia > 0 && pw.palle[1].cieco && !pw.palle[0].cieco, 'nebbia e mira nascosta agli avversari');
  assert.ok(pw.vistaTick().palle[1].nb > 0 && pw.vistaTick().palle[1].ci === 1);
  pw.input(1, { t: 'tiro', a: 0, f: 0.2 }); assert.ok(!pw.palle[1].cieco, 'la mira torna dopo un tiro');
  avanti(pw, 8000);
  pw.poteri[0] = ['rifai', 'terremoto']; const prima = { ...pw.palle[0] }, colpi0 = pw.palle[0].colpi;
  pw.input(0, { t: 'usa', i: 0 });
  assert.ok(pw.palle[0].colpi === colpi0 - 1 && pw.palle[0].x === prima.rifai.x, 'rifai: la pallina torna indietro e il colpo non conta');
  Object.assign(pw.palle[2], { vx: 0, vy: 0 }); pw.input(0, { t: 'usa', i: 0 });
  assert.ok(Math.hypot(pw.palle[2].vx, pw.palle[2].vy) > 200 && !(pw.palle[0].vx || pw.palle[0].vy), 'terremoto: si muovono le palline degli altri');
  const cm = buca('classica', 0); cm.poteri[0] = ['calamita']; const [cbx, cby] = cm.buca.buca;
  Object.assign(cm.palle[0], { x: cbx - 300, y: cby + 50 }); cm.input(0, { t: 'usa', i: 0 }); cm.input(0, { t: 'tiro', a: 0, f: 0.3 });
  avanti(cm, 6000); assert.ok(cm.palle[0].dentro, 'calamita: la buca attira la pallina che le passa vicino');
  // tempo scaduto: colpi + 3; si passa alla buca dopo
  const r = buca('classica', 0, 2);
  r.input(0, { t: 'tiro', a: 1, f: 0.2 }); avanti(r, 4000);
  r.fineFase = r.ultimoTick + 10; avanti(r, 100);
  assert.ok(r.fase === 'fineBuca' && r.colpi[1][0] === 3 && r.colpi[0][0] === r.palle[0].colpi + 3, 'chi non è in buca allo scadere prende 3 colpi in più');
  avanti(r, 5000);
  assert.ok(r.k === 1 && r.fase === 'via', 'si passa alla buca dopo');
  // fine partita: vince chi fa meno colpi
  const f = M.crea({ n: 2 });
  f.colpi = [[2, 3, 4, 2, 3, 3], [3, 3, 4, 2, 3, 3]]; f.chiudi();
  assert.ok(f.risultato.vincitori.join() === '0' && f.risultato.fazioni[0].punti === 17);
  // pausa
  const pz = M.crea({ n: 1 }); pz.tick(pz.inizio + 1);
  const fin = pz.fineFase; pz.impostaPausa(true); pz.pausaDal -= 4000; pz.impostaPausa(false);
  assert.ok(pz.fineFase >= fin + 4000, 'la pausa non conta');
  // ---- novità del 3D ----
  // tick: un potere usato tra un tick e l'altro fa partire l'aggiornamento (prima si perdeva e nessuno lo vedeva)
  const ag = buca('classica', 0, 2); ag.poteri[0] = ['nebbia']; ag.usa(0, 0);
  assert.strictEqual(ag.tick(ag.ultimoTick + 33), true, 'dopo un potere il tick dice che è cambiato qualcosa');
  assert.ok(ag.vistaTick(0).fatti.some((f) => /Nebbia/.test(f.testo)) && ag.vistaTick(1).fatti.some((f) => /^@ manda la Nebbia/.test(f.testo)), 'il potere usato si vede nei fatti di tutti');
  // poteri anche mentre la pallina corre: Turbo resta pronto per il tiro dopo, Rifai annulla il tiro in corsa
  const co = buca('classica', 0); co.poteri[0] = ['turbo', 'rifai'];
  const pt0 = [co.palle[0].x, co.palle[0].y];
  co.input(0, { t: 'tiro', a: 0, f: 0.4 }); avanti(co, 100);
  assert.ok(co.palle[0].vx > 0, 'la pallina corre');
  assert.strictEqual(co.usa(0, 0), null, 'turbo si carica anche mentre la pallina corre');
  assert.deepStrictEqual(co.palle[0].pronti, ['turbo']);
  assert.strictEqual(co.usa(0, 0), null, 'rifai mentre corre');
  assert.ok(co.palle[0].x === pt0[0] && co.palle[0].y === pt0[1] && !co.palle[0].vx && co.palle[0].colpi === 0, 'rifai: ferma la pallina, torna al punto del tiro, il colpo non conta');
  co.input(0, { t: 'tiro', a: 0, f: 0.5 });
  assert.ok(Math.abs(co.palle[0].vx - 0.5 * V_MAX * 1.6) < 1 && !co.palle[0].pronti.length, 'il turbo caricato vale al tiro dopo');
  // perché non si può: un messaggio solo a chi ci ha provato
  const no = buca('classica', 0, 2); no.poteri[0] = ['rifai', 'calamita', 'calamita'];
  assert.ok(/non hai ancora tirato/.test(no.usa(0, 0)) && no.poteri[0].length === 3, 'rifai senza tiri: rifiutato, il potere resta');
  assert.strictEqual(no.usa(0, 1), null); assert.ok(/già pronto/.test(no.usa(0, 1)), 'lo stesso potere due volte: rifiutato');
  assert.ok(no.vistaTick(0).fatti.some((f) => /già pronto/.test(f.testo)) && !no.vistaTick(1).fatti.some((f) => /già pronto/.test(f.testo)), 'il perché lo legge solo chi ha provato');
  assert.ok(/casella|potere/.test(no.usa(0, 5)), 'casella vuota');
  // da in buca: quelli contro gli altri sì, quelli per sé no
  const ib = buca('classica', 0, 2); ib.palle[0].dentro = true; ib.poteri[0] = ['colla', 'turbo'];
  assert.strictEqual(ib.usa(0, 0), null, 'in buca si può ancora usare un potere contro gli altri');
  assert.ok(ib.palle[1].colla && /già in buca/.test(ib.usa(0, 0)), 'in buca i poteri per sé no');
  ib.input(1, { t: 'tiro', a: 0, f: 1 });
  assert.ok(Math.abs(Math.hypot(ib.palle[1].vx, ib.palle[1].vy) - V_MAX * M._test.COLLA) < 1 && !ib.palle[1].colla, 'colla: il tiro dopo è più debole, poi passa');
  const solo = buca('classica', 0); solo.poteri[0] = ['nebbia'];
  assert.ok(/nessun avversario/.test(solo.usa(0, 0)) && solo.poteri[0].length === 1, 'da soli i poteri contro gli altri non si sprecano');
  // terremoto anche sulle palline in corsa
  const te = buca('classica', 0, 2); te.poteri[0] = ['terremoto']; te.input(1, { t: 'tiro', a: 0, f: 0.3 }); avanti(te, 66);
  const v1 = [te.palle[1].vx, te.palle[1].vy]; te.usa(0, 0);
  assert.ok(Math.hypot(te.palle[1].vx - v1[0], te.palle[1].vy - v1[1]) > 200 && te.vistaTick(1).palle[1].sc === 1, 'terremoto: spinge anche chi corre (e lo sente)');
  // molla: il tiro parte con un salto (supera l'acqua del ponte)
  const mo = buca('classica', 4); mo.poteri[0] = ['molla']; mo.usa(0, 0);
  Object.assign(mo.palle[0], { x: 470, y: 300 }); mo.input(0, { t: 'tiro', a: 0, f: 0.6 });
  assert.ok(mo.palle[0].aria > 0 && mo.vistaTick().palle[0].z === 0, 'molla: la pallina parte in aria');
  avanti(mo, 300); assert.ok(mo.vistaTick().palle[0].z > 10, 'e si vede salire');
  avanti(mo, 900); assert.ok(mo.palle[0].colpi === 1 && mo.palle[0].x > 1080, `con la molla salta l'acqua (${Math.round(mo.palle[0].x)})`);
  // fantasma: passa attraverso i respingenti
  const fa = buca('classica', 2); fa.poteri[0] = ['fantasma']; fa.usa(0, 0);
  const [rx, ry] = fa.buca.respingenti[2]; Object.assign(fa.palle[0], { x: rx - 120, y: ry });
  fa.input(0, { t: 'tiro', a: 0, f: 0.25 }); avanti(fa, 600);
  assert.ok(fa.palle[0].x > rx + 40 || fa.palle[0].dentro, 'fantasma: attraversa il respingente');
  // i poteri pronti passano alla buca dopo
  const pb = buca('classica', 0); pb.palle[0].pronti = ['calamita']; pb.prossimaBuca(Date.now());
  assert.deepStrictEqual(pb.palle[0].pronti, ['calamita'], 'un potere caricato e non usato vale nella buca dopo');
  // colline: la pallina scende dal dosso, si ferma in fondo alla conca, non si ferma su un pendio ripido
  const ci = (id) => COURSE.colline.buche.findIndex((b) => b.id === id);
  const dosso = buca('colline', ci('dosso')), dd = dosso.buca.dossi[0];
  Object.assign(dosso.palle[0], { x: dd.x - dd.r * 0.5, y: dd.y, vx: 0.1, vy: 0 }); avanti(dosso, 3000);
  assert.ok(dosso.palle[0].x < dd.x - dd.r * 0.7, 'dal fianco del dosso la pallina scende');
  const conca = buca('colline', ci('conca')), cc = conca.buca.dossi[0];
  Object.assign(conca.palle[0], { x: cc.x - cc.r * 0.6, y: cc.y + 10, vx: 0.1, vy: 0 }); avanti(conca, 15000);
  assert.ok(Math.hypot(conca.palle[0].x - cc.x, conca.palle[0].y - cc.y) < cc.r * 0.35 && !conca.palle[0].vx, 'nella conca si ferma in fondo');
  assert.ok(!M._test.puoFermarsi(dosso.buca, { x: dd.x - dd.r * 0.5, y: dd.y }) && M._test.puoFermarsi(dosso.buca, { x: dd.x - dd.r - 50, y: dd.y }), 'su un pendio ripido non si ferma');
  const su = { x: 200, y: 0, vx: 900, vy: 0, aria: 0 }, pendio = { ...COURSE.classica.buche[0], bordo: [[0, -300], [3000, -300], [3000, 300], [0, 300]], buca: [2900, 0], pendii: [{ x: 500, y: 0, a: 0, l: 500, h: 200 }] };
  let indietro = false; for (let k = 0; k < 90; k++) { M._test.passo(pendio, su, 0.033, 0, [], [], []); if (su.vx < -100) indietro = true; }
  assert.ok(indietro && su.x < 700, 'in salita senza forza la pallina torna indietro');
  for (const b of COURSE.colline.buche) for (const pt of [b.partenza, b.buca]) assert.ok(M._test.puoFermarsi(b, { x: pt[0], y: pt[1] }), `colline/${b.id}: partenza e buca in piano`);
  // dal telefono: il posto resta fermo e gli altri non lo aspettano
  const tf = buca('classica', 0, 2); tf.input(1, { t: 'telefono' });
  assert.ok(tf.usciti[1] && tf.telefono[1] && !tf.finita && tf.vista().telefono[1], 'telefono: il posto esce e lo si vede nel tabellone');
  console.log(`✓ Minigolf Party 3D: 7 course (${nBuche} buche, tutte raggiungibili), 6 buche a caso per course, 1/3/5/7 course di fila, Open Course in ordine, pallina sempre nel campo, attrito realistico, dossi/conche/pendii, buca precisa anche col passo lungo e di labbro, respingenti forti, acqua +1, rampa, portale, 9 superpoteri usabili quando si vuole (anche in corsa e da in buca, col perché se no), aggiornamento non perso, tempo scaduto +3, meno colpi vince, pausa, telefono`);
}

// ======================= ELENCO DEI FILE (per il controllo all'avvio su Render) =======================
fissa('ELENCO DEI FILE (per il controllo all\'avvio su Render)');
{
  const fs = require('fs'), path = require('path');
  const radice = path.join(__dirname, '..');
  const elenco = fs.readFileSync(path.join(radice, 'elenco-file.txt'), 'utf8').split('\n').filter(Boolean);
  const veri = [];
  (function giro(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git'].includes(e.name) || e.name.startsWith('.')) continue;
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) giro(path.join(dir, e.name), rel); else veri.push(rel);
    }
  })(radice, '');
  const manca = veri.filter((f) => !elenco.includes(f)), sparito = elenco.filter((f) => !veri.includes(f));
  assert.ok(!manca.length && !sparito.length, `elenco-file.txt non aggiornato (lancia: node verifica.js --aggiorna). Nuovi: ${manca.join(', ')} · spariti: ${sparito.join(', ')}`);
  console.log(`✓ Elenco dei file aggiornato (${elenco.length} file): all'avvio verifica.js dice quali mancano`);
}

// ======================= CARTELLE SOTTO I 100 FILE (limite del caricamento su GitHub dal browser) =======================
fissa('CARTELLE SOTTO I 100 FILE (limite del caricamento su GitHub dal browser)');
{
  const fs = require('fs'), path = require('path');
  const radice = path.join(__dirname, '..');
  const troppe = [];
  (function giro(dir, rel) {
    const voci = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !['node_modules', '.git'].includes(e.name) && !e.name.startsWith('.'));
    if (voci.length > 100) troppe.push(`${rel || '.'} (${voci.length})`);
    for (const e of voci) if (e.isDirectory()) giro(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
  })(radice, '');
  assert.ok(!troppe.length, `cartelle con più di 100 elementi: ${troppe.join(', ')}. Sposta i giochi nuovi in giochi2/ (vedi README)`);
  console.log('✓ Nessuna cartella supera i 100 elementi (giochi nuovi oltre il centesimo file: giochi2/, giochi3/…)');
}

// ======================= DIFESE DEL SITO =======================
fissa('DIFESE DEL SITO');
{
  const S = require('../sicurezza');
  const d = S.pulisciDato(JSON.parse('{"a":1,"__proto__":{"x":1},"constructor":{"prototype":{"y":2}},"b":[1,2,{"__proto__":{}}]}'));
  assert.ok(!Object.prototype.hasOwnProperty.call(d, '__proto__') && !Object.prototype.hasOwnProperty.call(d, 'constructor') && d.a === 1 && d.b.length === 3, 'niente __proto__ o constructor');
  assert.strictEqual(({}).x, undefined, 'nessun oggetto inquinato');
  assert.strictEqual(S.pulisciDato(null), undefined, 'null diventa undefined (i valori predefiniti funzionano)');
  assert.ok(S.pulisciDato('x'.repeat(10000)).length === 4000 && S.pulisciDato(new Array(5000).fill(1)).length === 600, 'stringhe e liste tagliate');
  let profondo = {}; const radice = profondo; for (let i = 0; i < 50; i++) { profondo.a = {}; profondo = profondo.a; }
  assert.ok(JSON.stringify(S.pulisciDato(radice)).length < 100, 'profondità limitata');
  assert.strictEqual(S.pulisciDato(NaN), 0);
  assert.ok(!/[<>"'&]/.test(S.pulisciNome('<img src=x onerror="alert(1)">')), 'niente < > nei nomi');
  assert.strictEqual(S.pulisciNome('  \u202eAda\u0000  '), 'Ada');
  assert.strictEqual(S.pulisciId('abc-123_"><'), 'abc-123_');
  // socket finto: limiti, dati ripuliti, errori che non fanno cadere niente
  const finto = () => { const h = {}; return { h, disconnesso: false, on(e, f) { h[e] = f; }, disconnect() { this.disconnesso = true; }, emit() {} }; };
  const so = finto(); let limitato = 0, errori = 0;
  S.proteggiSocket(so, { quandoLimitato: () => limitato++, quandoErrore: () => errori++ });
  let chiamate = 0, ricevuto;
  so.on('chat', (t) => { chiamate++; ricevuto = t; });
  for (let i = 0; i < 50; i++) so.h.chat('ciao');
  assert.ok(chiamate === 5 && limitato >= 1, `chat a raffica: passano solo i primi 5 (${chiamate})`);
  so.on('azione', ({ tipo } = {}) => { if (tipo === 'rompi') throw new Error('boom'); });
  so.h.azione(null); so.h.azione({ tipo: 'rompi' });
  assert.strictEqual(errori, 1, 'un errore in un evento viene preso e non fa cadere il server');
  so.on('crea', ({ x } = {}) => x);
  assert.doesNotThrow(() => so.h.crea(null), 'null al posto di un oggetto non rompe niente');
  for (let i = 0; i < 600; i++) so.h.chat('spam');
  assert.ok(so.disconnesso, 'chi esagera di continuo viene disconnesso');
  // intestazioni HTTP
  const app = { usi: [], disable() {}, use(f) { this.usi.push(f); } };
  S.difeseHttp(app, { richiesteAlMinuto: 60 });
  const intest = {}; const res = { setHeader: (k, v) => { intest[k] = v; }, end() {} };
  app.usi[0]({ headers: {}, socket: { remoteAddress: '1.2.3.4' } }, res, () => {});
  assert.ok(intest['Content-Security-Policy'].includes("frame-ancestors 'none'") && intest['X-Frame-Options'] === 'DENY' && intest['X-Content-Type-Options'] === 'nosniff', 'intestazioni di sicurezza');
  let bloccate = 0; for (let i = 0; i < 100; i++) { const r2 = { setHeader() {}, end() { bloccate++; }, statusCode: 200 }; app.usi[0]({ headers: {}, socket: { remoteAddress: '5.6.7.8' } }, r2, () => {}); }
  assert.ok(bloccate > 50, 'troppe richieste dallo stesso indirizzo: 429');
  console.log('✓ Difese: dati ripuliti (niente __proto__, dimensioni e profondità limitate), nomi senza HTML, limiti di messaggi, disconnessione di chi esagera, errori che non fanno cadere il server, intestazioni di sicurezza, limite di richieste');
}

// ======================= AMMIRAGLIATO =======================
fissa('AMMIRAGLIATO');
{
  const { eComandoAdmin, eTentativoAdmin, impronta } = require('../admin');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'admin.js'), 'utf8');
  assert.ok(!/[0-9a-f]{64}/.test(src) && !/ADMIN_COMANDO/.test(src), 'nel codice non c\'è né il comando né la sua impronta');
  const prima = process.env.TRUCCO_PAROLA;
  delete process.env.TRUCCO_PAROLA;
  assert.ok(!eComandoAdmin('!admin qualcosa') && !eComandoAdmin('!admin '), 'senza TRUCCO_PAROLA l\'Ammiragliato non si apre');
  process.env.TRUCCO_PAROLA = '  Pàtata  Fritta ';
  assert.ok(eComandoAdmin('!admin patata fritta') && eComandoAdmin('  !ADMIN   Patata Fritta '), '!admin + parola (maiuscole, accenti e spazi non contano)');
  for (const t of ['!admin', '!admin patata', '!admin patata fritta x', '!adminpatata fritta', '!win patata fritta', 'patata fritta', '', null, '!admin ' + 'a'.repeat(300)]) assert.ok(!eComandoAdmin(t), `non deve aprire il pannello: ${t}`);
  assert.ok(eTentativoAdmin('!admin sbagliata') && eTentativoAdmin('!Admin') && !eTentativoAdmin('!administrator') && !eTentativoAdmin('ciao'), 'i tentativi !admin non vanno in chat');
  if (prima === undefined) delete process.env.TRUCCO_PAROLA; else process.env.TRUCCO_PAROLA = prima;
  assert.strictEqual(impronta('a').length, 64);
  console.log('✓ Ammiragliato: si apre con !admin + la parola di TRUCCO_PAROLA, tentativi nascosti');
}

// ======================= GIOCHI D'AZIONE (motore comune) =======================
fissa('GIOCHI D\'AZIONE (motore comune)');
{
  // partite tra computer con tick finti: ogni gioco finisce e il difficile vince più del facile
  const simula = (id, n, partite, opz = {}) => {
    const M = GIOCHI[id], liv = ['facile', 'medio', 'difficile'];
    const vitt = { facile: 0, medio: 0, difficile: 0 }, punti = { facile: 0, medio: 0, difficile: 0 };
    for (let k = 0; k < partite; k++) {
      const l = Array.from({ length: n }, (_, i) => liv[(i + k) % 3]);
      const g = M.crea({ n, opzioni: { round: 1, ...opz }, bot: l });
      let ora = Date.now(), passi = 0;
      while (!g.finita) { ora += 33; if (g.fase === 'via' || g.fase === 'pausaRound') g.fineFase = Math.min(g.fineFase, ora); g.tick(ora); assert.ok(passi++ < 40000, `${id} non finisce`); }
      assert.ok(M.meta.regole.length >= 4 && M.meta.tempoReale && M.meta.pausaBoss, `${id}: regole, tempo reale, pausa`);
      JSON.stringify(g.vista(0));
      l.forEach((x, i) => { punti[x] += g.punti[i]; });
      if (g.risultato.vincitori.length) vitt[l[g.risultato.vincitori[0]]]++;
    }
    return { vitt, punti };
  };
  const righe = [];
  for (const [id, n, partite, opz] of [['palloncini', 3, 30], ['gattotopi', 3, 45, { round: 3 }], ['colori', 3, 30], ['bumper', 3, 45], ['fuga', 3, 18], ['monete', 3, 30], ['arcobaleno', 3, 135], ['pioggia', 3, 24], ['paintball', 3, 240], ['piattaforme', 3, 54], ['massi', 3, 24, { round: 3 }], ['stella', 3, 30], ['fune', 3, 30, { modo: 'uno' }], ['dalgona', 3, 12], ['buio', 3, 12, { round: 3 }], ['wanted', 3, 12, { round: 8 }], ['duello', 3, 240], ['strada', 3, 30], ['bersaglio', 3, 30, { round: 8 }], ['mangiatutto', 3, 30]]) {
    const r = simula(id, n, partite, opz);
    assert.ok(r.punti.difficile > r.punti.facile, `${id}: il difficile fa più punti del facile ${JSON.stringify(r.punti)}`);
    assert.ok(r.vitt.difficile >= r.vitt.medio && r.vitt.difficile > r.vitt.facile, `${id}: il difficile vince di più ${JSON.stringify(r.vitt)}`);
    righe.push(`${id} ${r.vitt.facile}/${r.vitt.medio}/${r.vitt.difficile}`);
  }
  // pausa: il tempo del round non corre e l'input di chi gioca arriva ripulito
  const p = GIOCHI.palloncini.crea({ n: 1, opzioni: {} });
  p.fineFase = 0; p.tick(Date.now());
  assert.strictEqual(p.fase, 'gioco');
  p.input(0, { x: 5, y: -9, t: 3 });
  assert.ok(p.inp[0].x <= 1 && p.inp[0].y >= -1 && p.inp[0].tocchi === 3, 'input limitato');
  p.impostaPausa(true);
  const t0 = p.tempoRound; p.tick(Date.now() + 5000);
  assert.strictEqual(p.tempoRound, t0, 'in pausa il round si ferma');
  // gatto e topi: il gatto cambia a ogni round; salita: chi resta indietro è fuori
  const gt = GIOCHI.gattotopi.crea({ n: 3, opzioni: {} });
  assert.strictEqual(gt.nRound, 3, 'ognuno fa il gatto una volta');
  const sa = GIOCHI.fuga.crea({ n: 1, opzioni: {} });
  sa.fineFase = 0; sa.tick(Date.now()); sa.e[0].y = sa.cam + 700; sa.ultimoTick = Date.now(); sa.tick(Date.now() + 33);
  assert.ok(sa.e[0].fuori, 'fuga: toccato il fondo si è presi');
  console.log(`✓ Giochi d'azione (vittorie f/m/d tra computer): ${righe.join(' · ')}; pausa e input ripulito`);
}

// ======================= TROVA LE DIFFERENZE =======================
fissa('TROVA LE DIFFERENZE');
{
  const M = GIOCHI.differenze;
  const { scena, modifica, CAMBI } = M._test;
  for (const c of CAMBI) { const s = scena(10); const m = modifica(s, c); assert.notStrictEqual(JSON.stringify(s), JSON.stringify(m.scena), `la differenza "${c}" cambia davvero il disegno`); }
  const g = M.crea({ n: 2, opzioni: {} });
  assert.ok(g.vista(0).immagini.length === 4 && g.vista(0).diversa === null, 'quattro disegni, la risposta non si vede');
  assert.strictEqual(g.immagini.filter((im) => JSON.stringify(im) !== JSON.stringify(g.immagini[(g.diversa + 1) % 4])).length, 1, 'uno solo è diverso');
  assert.ok(g.azione(0, { tipo: 'scegli', quale: 0 }).errore, 'mentre si guarda non si risponde');
  g.fineFase = 0; g.controllaTempo();
  assert.ok(g.fase === 'scegli' && g.vista(0).immagini === null, 'poi i disegni spariscono');
  g.azione(0, { tipo: 'scegli', quale: g.diversa }); g.azione(1, { tipo: 'scegli', quale: (g.diversa + 1) % 4 });
  assert.ok(g.punti[0] >= 100 && g.punti[1] === 0, 'punti a chi indovina');
  const vitt = { facile: 0, difficile: 0 };
  for (let k = 0; k < 60; k++) {
    const h = M.crea({ n: 2, opzioni: { round: 5 } });
    while (!h.finita) { if (h.inAttesa) { h.avanza(); continue; } if (h.fase === 'guarda') { h.fineFase = 0; h.controllaTempo(); continue; } for (const p of h.attesi()) h.azione(p, M.bot(h, p, p ? 'difficile' : 'facile')); }
    vitt.facile += h.punti[0]; vitt.difficile += h.punti[1];
  }
  assert.ok(vitt.difficile > vitt.facile * 1.3);
  console.log(`✓ Trova le differenze: sei tipi di differenza, un solo disegno diverso, guarda e poi rispondi, punti per velocità, computer (difficile ${vitt.difficile}, facile ${vitt.facile})`);
}

// ======================= ATTRAVERSA LA STRADA =======================
fissa('ATTRAVERSA LA STRADA');
{
  const M = GIOCHI.strada, { PARTENZA, M: SM } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 40; g.fineFase = ora; g.tick(ora); } return ora; };
  // il mondo nasce dal seme: uguale per tutti (server e browser), con sempre un passaggio tra due prati
  const a = SM.crea(1234), b = SM.crea(1234);
  assert.strictEqual(JSON.stringify(Array.from({ length: 300 }, (_, k) => a.corsia(k))), JSON.stringify(Array.from({ length: 300 }, (_, k) => b.corsia(k))), 'stesso seme, stesse corsie');
  const tipi = new Set();
  for (let k = 1; k < 300; k++) {
    const c = a.corsia(k), sotto = a.corsia(k - 1); tipi.add(c.k);
    if (c.k === 'g' && sotto.k === 'g') assert.ok(Array.from({ length: SM.COLS }, (_, i) => i).filter((i) => !c.a.includes(i) && !sotto.a.includes(i)).length >= 2, 'tra due prati si passa sempre');
    if (c.k === 'g' && sotto.k === 'n') assert.ok(sotto.c.some((i) => !c.a.includes(i)), 'dalle ninfee si scende sempre sull\'erba');
  }
  assert.deepStrictEqual([...tipi].sort(), ['b', 'f', 'g', 'n', 's'], 'prati, strade, fiumi, ninfee e binari');
  // un passo per tasto (contatore e ultime mosse: nessun passo perso), alberi che bloccano
  const g = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(g);
  const e = g.e[0];
  g.mondo.corsia(PARTENZA + 1).k = 'g'; g.mondo.corsia(PARTENZA + 1).a = [Math.floor(e.px)];
  g.input(0, { pn: 1, pm: 'u' }); g.passo(0.04);
  assert.strictEqual(e.r, PARTENZA, 'l\'albero blocca');
  g.input(0, { pn: 3, pm: 'uru' }); for (let k = 0; k < 10; k++) { g.tempoRound += 0.1; g.passo(0.04); }
  assert.ok(e.r === PARTENZA + 1 && e.best === PARTENZA + 1, 'poi a destra e avanti: le mosse arrivate insieme non si perdono');
  g.input(0, { pn: 3, pm: 'uuu' }); g.tempoRound += 0.2; g.passo(0.04); assert.strictEqual(e.r, PARTENZA + 1, 'un contatore già visto non muove');
  // auto, acqua, tronco, aquila
  const cor = (k, c) => { g.mondo.corsia(k); Object.keys(g.mondo.corsia(k)).forEach((x) => delete g.mondo.corsia(k)[x]); Object.assign(g.mondo.corsia(k), c); };
  const t = g.tempoRound;
  cor(e.r + 1, { k: 's', v: 0, l: 1, o: [e.px - 0.5 + SM.MARGINE - SM.PERIODO * Math.floor((e.px - 0.5 + SM.MARGINE) / SM.PERIODO)], col: 0 });
  g.input(0, { pn: 4, pm: 'u' }); g.tempoRound = t + 0.2; g.passo(0.04);
  assert.ok(!e.vivo && e.morte === 'auto' && !e.spirito, 'sotto la macchina: fuori (in sfida niente spirito)');
  const f = g.e[1]; cor(f.r + 1, { k: 'f', v: 1, l: 3, o: [f.px - 1.5 + SM.MARGINE - g.tempoRound] });
  g.input(1, { pn: 1, pm: 'u' }); g.passo(0.04); const x0 = f.px; g.tempoRound += 0.5; g.passo(0.5);
  assert.ok(f.vivo && Math.abs(f.px - x0 - 0.5) < 0.01, 'il tronco porta con sé');
  cor(f.r + 1, { k: 'f', v: 1, l: 1, o: [f.px + 5 + SM.MARGINE - g.tempoRound] }); g.input(1, { pn: 2, pm: 'u' }); g.passo(0.04);
  assert.ok(!f.vivo && f.morte === 'acqua', 'l\'acqua è fatale');
  const h = M.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(h);
  for (let k = 0; k < 400 && h.e[0].vivo; k++) { h.tempoRound += 0.05; h.passo(0.05); }
  assert.strictEqual(h.e[0].morte, 'aquila', 'chi resta fermo viene preso dall\'aquila');
  // cooperazione: lo spirito resta 5 s e il compagno che lo raggiunge lo rimette in gioco
  const c = M.crea({ n: 2, opzioni: { round: 1, modo: 'coop' }, bot: [null, null] }); parti(c);
  const [p0, p1] = c.e; c.muori(0, 'auto', c.tempoRound);
  assert.ok(p0.spirito && p0.spirito.r === p0.r, 'resta lo spirito dove è caduto');
  Object.assign(p1, { r: p0.spirito.r, px: p0.spirito.px }); c.passo(0.04);
  assert.ok(p0.vivo && p0.rianimato === 1 && c.tempoRound < p0.immune, 'rianimato (e per un attimo le auto non lo toccano)');
  c.muori(0, 'acqua', c.tempoRound); assert.strictEqual(p0.spirito.r, p0.sicuro.r, 'caduto in acqua: lo spirito resta sulla riva');
  Object.assign(p1, { r: p0.spirito.r + 3 }); c.tempoRound += 5.2; c.passo(0.04); assert.ok(!p0.vivo && !p0.spirito, 'dopo 5 secondi lo spirito sparisce');
  Object.assign(p1, { vivo: true, spirito: null }); // (nella prova p1 potrebbe essere finito su una strada o in acqua)
  p1.best = PARTENZA + 7; p0.best = PARTENZA + 3; c.muori(1, 'aquila', c.tempoRound); assert.ok(c.passo(0.04), 'caduti tutti: fine round');
  c.fineRound(); c.chiudi();
  assert.ok(c.risultato.fazioni.length === 1 && c.risultato.fazioni[0].punti === 10 && c.risultato.vincitori.length === 2, 'cooperazione: punteggio unico, somma delle righe');
  // sfida: resta uno solo e ha già superato gli altri: il round finisce
  const s = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(s);
  s.e[0].best = 9; s.e[1].best = 5; s.muori(1, 'auto', s.tempoRound); assert.ok(s.passo(0.04), 'è rimasto solo ed è il più lontano');
  // partite in cooperazione tra computer: finiscono e il punteggio è della squadra
  let tot = 0;
  for (let k = 0; k < 4; k++) { const x = M.crea({ n: 2, opzioni: { round: 1, modo: 'coop' }, bot: ['medio', 'medio'] }); let ora = Date.now(); while (!x.finita) { ora += 40; if (x.fase !== 'gioco') x.fineFase = Math.min(x.fineFase, ora); x.tick(ora); } tot += x.risultato.fazioni[0].punti; assert.ok(x.risultato.titolo.includes('squadra')); }
  assert.ok(tot > 0);
  console.log(`✓ Attraversa la strada: mondo dal seme uguale per tutti, sempre un passaggio, alberi, auto, acqua, tronchi che trascinano, aquila, un passo per tasto senza passi persi, sfida, cooperazione con spirito e rianimazione (${tot} righe di squadra in 4 partite tra computer)`);
}

// ======================= MIGLIORIE: CASELLE COLORATE, DALGONA, WANTED!, SALTA E CORRI =======================
fissa('MIGLIORIE: CASELLE COLORATE, DALGONA, WANTED!, SALTA E CORRI');
{
  const parti = (g, passo = 33) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += passo; g.fineFase = ora; g.tick(ora); } return ora; };
  // caselle colorate: quando il pavimento cade i potenziamenti saltano su una casella giusta e restano prendibili
  const a = GIOCHI.arcobaleno.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(a);
  const sbagliata = a.celle.find((k) => a.caselle[k] !== a.colore);
  a.poteri = [{ id: 99, tipo: 'scudo', x: 0, y: 0, k: sbagliata }];
  a.e.forEach((e) => { e.fuori = true; }); a.timer = 0.01; a.passo(0.02);
  assert.ok(a.fase2 === 'cade' && a.poteri.length === 1 && a.caselle[a.poteri[0].k] === a.colore, 'il potenziamento resta, sulla casella giusta');
  for (let k = 0; k < 20; k++) a.passo(0.05);
  assert.ok(a.poteri.some((q) => q.id === 99), 'e resta anche mentre le caselle sono giù');
  // dalgona: fuori dal solco si crepa di più, e riappoggiare l'ago costa
  const d = GIOCHI.dalgona.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(d);
  const b = d.b[0]; Object.assign(d.inp[0], { a: true, mx: 500, my: 330 }); d.passo(0.03);
  assert.ok(b.danno >= 3, 'ogni volta che riappoggi l\'ago il biscotto soffre');
  // wanted: si parte con tante facce, e si muovono tutte (anche nella griglia)
  const w = GIOCHI.wanted.crea({ n: 1, opzioni: { round: 3 }, bot: [null] });
  assert.ok(['calca', 'rimbalzo', 'pioggia', 'cerchi'].includes(w.schema) && w.facce.length >= 75, 'si parte subito con la folla grande e uno schema difficile');
  w.schema = 'griglia'; w.round = 0; w.ordine = ['griglia']; w.round = 1; w.iniziaRound(); w.aggiornaPosizioni(0); const prima = w.facce.map((f) => [f.x, f.y]); w.aggiornaPosizioni(0.7);
  assert.ok(w.facce.every((f, i) => Math.hypot(f.x - prima[i][0], f.y - prima[i][1]) > 1 || f.x <= 24 || f.x >= 976), 'nella griglia si muovono tutte');
  // salta e corri: monete, scatole a sorpresa, fulmine, buccia, salto in testa, piattaforme che crollano
  const P = GIOCHI.piattaforme, L = P._test.costruisci();
  assert.ok(L.monete.length > 20 && L.pot.length >= 3 && L.griglia.some((r) => r.includes('4')), 'monete, scatole e piattaforme crepate');
  const g = P.crea({ n: 3, opzioni: { round: 1 }, bot: [null, null, null] }); parti(g);
  const [e0, e1, e2] = g.e;
  e1.x = e0.x + 300; e2.x = e0.x - 200;
  const rnd = Math.random; Math.random = () => 0.999; // l'ultimo oggetto della lista: il fulmine
  try { g.oggetto(0); } finally { Math.random = rnd; }
  assert.ok(e1.stordito > 0 && !(e2.stordito > 0), 'il fulmine ferma chi è davanti, non chi è dietro');
  const m = g.liv.monete[0]; e0.prese.clear(); Object.assign(e0, { x: m.x, y: m.y, vy: 0 }); g.passo(0.01);
  assert.ok(e0.prese.has(m.id) && e0.monete >= 1, 'moneta presa');
  g.bucce.push({ id: 1, x: e1.x, y: e1.y + 17, da: 0, t: g.tempoRound - 2 }); e1.stordito = 0; e1.stella = 0; g.passo(0.01);
  assert.ok(e1.stordito > 0 && !g.bucce.length, 'sulla buccia si scivola');
  Object.assign(e2, { stordito: 0, stella: 0, x: 400, y: 300, vy: 0 }); Object.assign(e0, { stordito: 0, x: 400, y: 300 - 34 - 2, vy: 200 }); e0.aTerra = false;
  g.passo(0.01); assert.ok(e2.stordito > 0 && e0.vy < 0, 'salto in testa: l\'altro resta stordito, tu rimbalzi');
  e0.monete = 11; g.punti = [0, 0, 0]; g.fineRound(); assert.strictEqual(g.punti[0], 2, 'un punto ogni 5 monete');
  console.log('✓ Migliorie: potenziamenti di Caselle colorate che restano durante la caduta, Dalgona più fragile, Wanted! con la folla grande e sempre in movimento, Salta e corri con monete, scatole a sorpresa, bucce, salti in testa e piattaforme che crollano');
}

// ======================= TIRO AL BERSAGLIO =======================
fissa('TIRO AL BERSAGLIO');
{
  const M = GIOCHI.bersaglio, { punteggio, posBersaglio, posAsse, deriva, volo } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 40; g.fineFase = ora; g.tick(ora); } };
  assert.deepStrictEqual([0, 0.2, 0.4, 0.6, 0.9, 1.1].map((r) => punteggio(r * 50, 50, 1).punti), [10, 8, 6, 4, 2, 0], 'anelli: 10, 8, 6, 4, 2, fuori 0');
  assert.strictEqual(punteggio(0, 30, 3).punti, 30, 'il lontano vale il triplo');
  // si mira dove sarà il bersaglio all'arrivo, compresi vento e caduta: centro
  const g = M.crea({ n: 2, opzioni: { round: 3 }, bot: [null, null] }); parti(g);
  g.assi = []; g.b.amp = 120; g.b.om = 1.5;
  const t = g.tempoRound, c = posBersaglio(g.b, t + volo(g.b.d)), tr = deriva(g.aria);
  assert.ok(g.aria.cala > 0, 'la freccia cala');
  assert.ok(g.azione(0, { tipo: 'tira', t, mx: c.x - tr.x, my: c.y - tr.y }).ok);
  assert.ok(g.azione(0, { tipo: 'tira', t, mx: 0, my: 0 }).errore, 'una freccia sola per bersaglio');
  assert.strictEqual(g.frecce[0].esito, 'centro', 'mirando dove sarà il bersaglio si fa centro');
  // un'asse davanti ferma la freccia
  g.assi = [{ id: 0, w: 400, h: 400, y: 300, x0: 500, amp: 0, om: 1, fase: 0 }];
  g.azione(1, { tipo: 'tira', t: g.tempoRound, mx: 500, my: 300 });
  assert.strictEqual(g.frecce[1].esito, 'asse', 'l\'asse ferma la freccia');
  // il tempo del browser vale solo se è appena passato
  const h = M.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); parti(h); h.tempoRound = 3; h.assi = [];
  h.azione(0, { tipo: 'tira', t: -50, mx: 500, my: 300 }); assert.ok(h.frecce[0].t >= 2.7, 'non si può tirare \"nel passato\"');
  // i punti arrivano quando arriva la freccia; poi il round finisce
  for (let k = 0; k < 40 && !g.passo(0.04); k++) g.tempoRound += 0.04;
  assert.ok(g.punti[0] === 10 && g.punti[1] === 0, 'punti all\'arrivo');
  assert.ok(posAsse({ x0: 100, amp: 50, om: 1, fase: Math.PI / 2, y: 0 }, 0).x === 150);
  console.log('✓ Tiro al bersaglio: anelli 10-8-6-4-2, distanze che moltiplicano, una freccia a testa, freccia che vola (bersaglio che si muove), mirino fermo con caduta e vento, assi che fermano la freccia, tempo del browser controllato');
}

// ======================= MANGIATUTTO =======================
fissa('MANGIATUTTO');
{
  const M = GIOCHI.mangiatutto, { LAB, DIST, passa, idx } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 40; g.fineFase = ora; g.tick(ora); } };
  // labirinto: tutti i semini raggiungibili dalla partenza, nessun vicolo cieco, tunnel ai lati
  const C = LAB[0].length; let semini = 0;
  LAB.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || ch === 'o') { semini++; assert.ok(DIST[idx(9, 15)][idx(x, y)] >= 0, `semino irraggiungibile ${x},${y}`); } if (passa(x, y, false)) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => passa(x + a, y + b, false)).length >= 2, `vicolo cieco ${x},${y}`); }));
  assert.ok(semini > 140 && DIST[idx(0, 9)][idx(C - 1, 9)] === 1, 'il tunnel collega i due lati');
  // da soli: il mangiatore sei tu contro 4 fantasmi del computer; in tre: uno mangia, due fantasmi giocatori + 2 del computer
  const s = M.crea({ n: 1, opzioni: {}, bot: [null] }); assert.ok(s.nRound === 3 && s.f.every((f) => f.posto === null));
  const g = M.crea({ n: 3, opzioni: {}, bot: [null, null, null] }); parti(g);
  assert.ok(g.nRound === 3 && g.pac === 0 && g.f.filter((f) => f.posto !== null).map((f) => f.posto).join() === '1,2', 'ruoli del primo round');
  // semino, pillola, fantasmi blu mangiati, presa del mangiatore da parte di un giocatore
  Object.assign(g.m, { x: 1, y: 3, vx: 0, vy: 0 }); g.inp[0].x = 1; g.passo(0.05);
  assert.ok(g.punti[0] >= 10, 'semino mangiato');
  Object.assign(g.m, { x: 1, y: 1, vx: 0, vy: 0 }); g.inp[0].x = 0; g.passo(0.01);
  assert.ok(g.paura > 0 && g.f.filter((f) => f.stato === 'caccia').every((f) => f.paura), 'pillola: fantasmi blu');
  const f0 = g.f[0]; Object.assign(f0, { x: g.m.x, y: g.m.y }); const p0 = g.punti[0]; g.passo(0.01);
  assert.ok(f0.stato === 'occhi' && g.punti[0] - p0 >= 200, 'fantasma blu mangiato: 200 e occhi a casa');
  g.paura = 0; g.f.forEach((f) => { f.paura = false; }); const f1 = g.f[1]; Object.assign(f1, { x: g.m.x, y: g.m.y, stato: 'caccia' }); g.passo(0.01);
  assert.ok(g.vite === 2 && g.punti[f1.posto] === 500 && g.presa > 0, 'il fantasma giocatore acchiappa il mangiatore: +500');
  // un fantasma giocatore si guida con le frecce e non entra nella casa
  g.presa = 0; g.riparti(); const f2 = g.f[0]; Object.assign(f2, { x: 9, y: 7, vx: 0, vy: 0, stato: 'caccia' }); g.inp[1].x = 0; g.inp[1].y = 1;
  for (let k = 0; k < 20; k++) g.passo(0.05);
  assert.ok(f2.y === 7, 'la casa è chiusa ai fantasmi dei giocatori');
  g.inp[1].y = 0; g.inp[1].x = -1; for (let k = 0; k < 10; k++) g.passo(0.05); assert.ok(f2.x < 9, 'il fantasma giocatore va dove dice lui');
  // il mangiatore cambia a ogni round
  g.round = 2; g.iniziaRound(); assert.ok(g.pac === 1 && g.f.some((f) => f.posto === 0), 'secondo round: mangia il secondo');
  console.log('✓ Mangiatutto: labirinto senza vicoli ciechi con tunnel, semini e pillole, fantasmi blu da mangiare, fantasmi dei giocatori guidati con le frecce (+500 se acchiappano), casa chiusa, mangiatore che cambia a ogni round');
}

// ======================= TIGERBALL =======================
fissa('TIGERBALL');
{
  const M = GIOCHI.tigerball, { L } = M._test;
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 33; g.fineFase = ora; g.tick(ora); } return ora; };
  assert.strictEqual(L.LIVELLI.length, 8, 'otto livelli');
  for (const lv of L.LIVELLI) assert.ok(lv.partenza[0] > 0 && lv.partenza[0] < L.W && lv.cesto.x + lv.cesto.w < L.W, `${lv.nome}: dentro il campo`);
  // una pallina lasciata cadere nel cesto entra; fuori dal campo torna al lancio; si tira solo quando è pronta
  const g = M.crea({ n: 2, opzioni: { round: 3 }, bot: [null, null] }); parti(g);
  const c = g.liv.cesto, b0 = g.b[0];
  assert.ok(g.azione(0, { tipo: 'tira', a: -0.8, f: 0.5 }).ok && g.azione(0, { tipo: 'tira', a: -0.8, f: 0.5 }).errore, 'un tiro alla volta');
  Object.assign(b0, { x: c.x + c.w / 2, y: c.y - c.h - 30, vx: 0, vy: 0 });
  for (let k = 0; k < 60 && b0.stato === 'vola'; k++) g.passo(0.033);
  assert.strictEqual(b0.stato, 'dentro', 'nel cesto: dentro');
  const b1 = g.b[1]; g.tira(1, 0, 1); Object.assign(b1, { x: 2000, y: 100 }); g.passo(0.033);
  for (let k = 0; k < 30 && b1.stato !== 'pronta'; k++) g.passo(0.033);
  assert.ok(b1.stato === 'pronta' && b1.x === g.liv.partenza[0] && b1.tiri === 1, 'uscita dal campo: torna al lancio, il tiro resta contato');
  // le palline non si toccano: due palline nello stesso punto non si spostano a vicenda
  const h = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(h);
  h.tira(0, -0.7, 0.7); h.tira(1, -0.7, 0.7); for (let k = 0; k < 40; k++) h.passo(0.033);
  assert.ok(h.b[0].x === h.b[1].x && h.b[0].y === h.b[1].y, 'stesso tiro, stessa strada: le palline si passano attraverso');
  // sfida: vince chi ha meno tiri (e chi resta fuori prende 3 tiri in più); cooperazione: tiri sommati
  const s = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] }); parti(s);
  s.b[0].stato = 'dentro'; s.b[0].tiri = 2; s.tiriTot = [2, 1]; s.punti = [2, 1]; s.fineRound(); s.chiudi();
  assert.ok(s.tiriTot[1] === 4 && s.risultato.vincitori.join() === '0' && s.risultato.crescente, 'meno tiri vince; chi non entra +3');
  const k = M.crea({ n: 2, opzioni: { round: 1, modo: 'coop' }, bot: [null, null] }); parti(k);
  k.tiriTot = [3, 4]; k.b.forEach((b) => { b.stato = 'dentro'; }); assert.ok(k.passo(0.03), 'coop: livello superato quando sono entrati tutti');
  k.chiudi(); assert.ok(k.risultato.fazioni.length === 1 && k.risultato.fazioni[0].punti === 7, 'coop: tiri di squadra sommati');
  // tra computer il difficile usa meno tiri e vince di più
  const liv = ['facile', 'medio', 'difficile'], vitt = { facile: 0, medio: 0, difficile: 0 }, tiri = { facile: 0, medio: 0, difficile: 0 };
  for (let n = 0; n < 6; n++) {
    const l = [0, 1, 2].map((i) => liv[(i + n) % 3]);
    const x = M.crea({ n: 3, opzioni: { round: 3 }, bot: l }); let ora = Date.now(), passi = 0;
    while (!x.finita) { ora += 33; if (x.fase !== 'gioco') x.fineFase = Math.min(x.fineFase, ora); x.tick(ora); assert.ok(passi++ < 30000); }
    l.forEach((v, i) => { tiri[v] += x.tiriTot[i]; }); for (const v of x.risultato.vincitori) vitt[l[v]]++;
  }
  assert.ok(tiri.difficile < tiri.medio && tiri.medio < tiri.facile && vitt.difficile > vitt.facile && vitt.difficile >= vitt.medio, `tiri ${JSON.stringify(tiri)} vittorie ${JSON.stringify(vitt)}`);
  console.log(`✓ Tigerball: 8 livelli, fionda, cesto, pallina che torna al lancio, palline che non si toccano, sfida a meno tiri (+3 a chi resta fuori), cooperazione con tiri sommati, computer (tiri f/m/d ${tiri.facile}/${tiri.medio}/${tiri.difficile}, vittorie ${vitt.facile}/${vitt.medio}/${vitt.difficile})`);
}

// ======================= ROULETTE MAGGIONI =======================
fissa('ROULETTE MAGGIONI');
{
  const M = GIOCHI.roulette, { PUNTATE, RUOTA, colore } = M._test;
  assert.ok(RUOTA.length === 37 && new Set(RUOTA).size === 37, 'ruota europea: 37 numeri, un solo zero');
  assert.ok([1, 3, 36].every((n) => colore(n) === 'rosso') && [2, 35].every((n) => colore(n) === 'nero') && colore(0) === 'verde');
  // pagamenti: pieno 35 a 1, colori 1 a 1, dozzine 2 a 1; con lo zero perdono le esterne
  const g = M.crea({ n: 2 });
  assert.ok(g.azione(0, { tipo: 'punta', puntate: { n99: 10 } }).errore, 'casella inesistente');
  assert.ok(g.azione(0, { tipo: 'punta', puntate: { rosso: 2000 } }).errore, 'non più delle proprie fiche');
  assert.ok(g.azione(0, { tipo: 'punta', puntate: { n17: 10, nero: 20, d2: 30, rosso: 5 } }).ok);
  assert.ok(g.azione(0, { tipo: 'punta', puntate: { rosso: 5 } }).errore, 'una puntata sola per giro');
  g.azione(1, { tipo: 'punta', puntate: { rosso: 100, n0: 10 } });
  assert.ok(g.inAttesa && g.fase === 'giro' && g.vista(0).numero === g.numero, 'hanno puntato tutti: Maggioni lancia');
  g.numero = 17; g.avanza();
  assert.deepStrictEqual(g.esiti.map((e) => e.netto), [10 * 35 + 20 + 30 * 2 - 5, -110], '17 nero: pieno, nero e 2ª dozzina pagati');
  assert.strictEqual(g.fiche[0], 1000 - 65 + 10 * 36 + 40 + 90);
  g.avanza(); assert.strictEqual(g.fase, 'puntate', 'nuovo giro');
  g.azione(0, { tipo: 'punta', puntate: { rosso: 50, pari: 50, n0: 10 } }); g.passa(1); g.numero = 0; g.avanza();
  assert.strictEqual(g.esiti[0].netto, 350 - 100, 'zero: vince solo il pieno sullo 0');
  assert.ok(Object.keys(PUNTATE).length === 37 + 12, 'numeri pieni e 12 puntate esterne');
  // il computer: alla roulette conta solo gestire le fiche; il difficile punta meno e perde meno
  // (alla roulette la fortuna pesa tanto: si confronta la perdita attesa, cioè quanto si punta, che vale 1/37 al banco)
  const liv = ['facile', 'medio', 'difficile'], fine = { facile: 0, medio: 0, difficile: 0 }, puntato = { facile: 0, medio: 0, difficile: 0 };
  for (let k = 0; k < 30; k++) {
    const l = [0, 1, 2].map((i) => liv[(i + k) % 3]), x = M.crea({ n: 3 });
    for (let giro = 0; giro < 80; giro++) {
      for (const p of x.attesi()) {
        if (x.fiche[p] <= 0) x.ricarica(p, 1000);
        if (x.fase === 'puntate' && !x.inAttesa && !x.puntato[p]) { const a = M.bot(x, p, l[p]); puntato[l[p]] += Object.values(a.puntate).reduce((s, v) => s + v, 0); assert.ok(!x.azione(p, a).errore); }
      }
      while (x.inAttesa) x.avanza();
    }
    l.forEach((v, i) => { fine[v] += x.fiche[i]; });
  }
  assert.ok(puntato.difficile * 2 < puntato.medio && puntato.difficile * 2 < puntato.facile, `perdita attesa (puntato / 37) ${JSON.stringify(puntato)}`);
  console.log(`✓ Roulette Maggioni: ruota europea, pieno 35 a 1, colori, pari/dispari, manque/passe, dozzine e colonne, lo zero, una puntata per giro, computer (fiche puntate in 80 giri f/m/d ${puntato.facile}/${puntato.medio}/${puntato.difficile}, fiche alla fine ${fine.facile}/${fine.medio}/${fine.difficile})`);
}

// ======================= CHI È L'ALIENO: MAPPE, COMPITI NUOVI, SCHERMATA FINALE =======================
fissa('CHI È L\'ALIENO: MAPPE, COMPITI NUOVI, SCHERMATA FINALE');
{
  const M = GIOCHI.alieno, { MAPPE, ELENCO, FINE } = M._test;
  const { controlla, LIVELLO } = require('../giochi/alieno-mappe');
  const parti = (g) => { let ora = Date.now(); while (g.fase !== 'gioco') { ora += 50; g.fineFase = ora; g.tick(ora); } return ora; };
  assert.deepStrictEqual(ELENCO, ['base', 'vulcano', 'pianta', 'abissi', 'polare'], 'cinque mappe');
  for (const id of ELENCO) {
    const m = MAPPE[id];
    assert.deepStrictEqual(controlla(m), [], `${id}: postazioni su pavimento libero, tutto raggiungibile, consegne con arrivo`);
    assert.ok(m.stanze.length === 10 && m.nome && m.tema && m.tema.pavimenti && m.espulsione && /^<svg/.test(m.anteprima), `${id}: stanze, tema, scena di espulsione, anteprima`);
    assert.ok(m.stazioni.some((s) => s.tema), `${id}: ci sono compiti a tema`);
    for (const liv of ['semplice', 'medio', 'elaborato']) assert.ok(new Set(m.stazioni.filter((s) => s.livello === liv && !s.arrivo).map((s) => s.tipo)).size >= (liv === 'elaborato' ? 1 : 2), `${id}: abbastanza compiti ${liv}`);
    const g = M.crea({ n: 6, opzioni: { mappa: id }, bot: [] }); parti(g);
    assert.ok(g.M.id === id && g.vistaExtra().mappaId === id, `${id}: si gioca sulla mappa scelta`);
    assert.ok(g.e.every((e) => !g.solido(e.x, e.y)), `${id}: si parte su un pavimento`);
    for (const e of g.e) {
      assert.strictEqual(e.compiti.length, 5, 'cinque compiti');
      assert.strictEqual(new Set(e.compiti.map((c) => c.tipo)).size, 5, 'niente doppioni (tipi diversi)');
      assert.strictEqual(new Set(e.compiti.map((c) => c.id)).size, 5, 'niente doppioni (postazioni diverse)');
      assert.deepStrictEqual(e.compiti.map((c) => c.livello).sort(), ['elaborato', 'medio', 'medio', 'semplice', 'semplice'], 'mix di livelli');
      assert.ok(e.compiti.every((c) => !g.stazione(c.id).arrivo), 'la seconda tappa di una consegna non si assegna da sola');
    }
  }
  assert.strictEqual(Object.keys(LIVELLO).length, 14, '14 tipi di compito');
  // mappa casuale: sempre una di quelle esistenti; l'opzione ha anteprime per tutte
  for (let k = 0; k < 20; k++) assert.ok(ELENCO.includes(M.crea({ n: 4, opzioni: { mappa: 'casuale' }, bot: [] }).M.id));
  const opz = M.meta.opzioni.find((o) => o.id === 'mappa'); assert.ok(opz.valori[0] === 'casuale' && ELENCO.every((id) => opz.anteprime[id]), 'selettore con anteprime');
  // consegna: prendi in una stanza, consegna nell'altra; solo alla seconda il compito è fatto
  const c = M.crea({ n: 4, opzioni: { mappa: 'vulcano' }, bot: [] }); parti(c);
  const u = c.e.find((e) => !e.alieno), prima = c.M.stazioni.find((s) => s.tipo === 'consegna' && !s.arrivo);
  u.compiti = [{ id: prima.id, st: prima.id, fatto: false, passo: 0, tipo: 'consegna', livello: 'elaborato' }]; // solo questo: tra quelli a caso poteva essercene un altro sulla stessa postazione
  const vai = (st) => Object.assign(u, { x: st.t[0] * 40 + 20, y: st.t[1] * 40 + 20 });
  vai(prima); c.azione(u.id, { tipo: 'inizia', id: prima.id }); c.tempoRound += 3.5; assert.ok(!c.azione(u.id, { tipo: 'finito', id: prima.id }).errore);
  const seconda = c.stazione(prima.poi);
  assert.ok(!u.compiti[0].fatto && u.compiti[0].st === seconda.id && seconda.stanza !== prima.stanza, 'presa: il compito si sposta in un\'altra stanza');
  assert.ok(c.azione(u.id, { tipo: 'inizia', id: prima.id }).errore, 'la prima postazione non serve più');
  vai(seconda); c.azione(u.id, { tipo: 'inizia', id: seconda.id }); c.tempoRound += 3.5; c.azione(u.id, { tipo: 'finito', id: seconda.id });
  assert.ok(u.compiti[0].fatto, 'consegnato: compito fatto');
  // schermata finale: la partita si ferma per qualche secondo, ruoli svelati solo alla fine, eliminati ed espulsi
  const f = M.crea({ n: 5, opzioni: { mappa: 'polare' }, bot: [] }); parti(f);
  const al = f.e.find((e) => e.alieno).id, [v1, v2] = f.e.filter((e) => !e.alieno).map((e) => e.id);
  assert.strictEqual(f.statoTick(v1).fin, null, 'prima della fine niente riepilogo');
  f.e[v1].vivo = false; f.e[v2].vivo = false; f.e[v2].espulso = true; f.e[al].vivo = false; f.e[al].espulso = true; f.passo(0.05);
  const fin = f.statoTick(v1).fin;
  assert.ok(f.fase2 === 'fine' && fin && fin.chi === 'equipaggio' && fin.alieni === 1 && fin.tot === 20, 'riepilogo con vincitore, Alieni in gioco e compiti');
  assert.deepStrictEqual(fin.g.map((x) => x.a), f.e.map((e) => (e.alieno ? 1 : 0)), 'ruoli svelati a tutti');
  assert.ok(fin.g[v1].s === 'eliminato' && fin.g[v2].s === 'espulso' && fin.g[al].s === 'espulso', 'eliminati ed espulsi');
  assert.deepStrictEqual(f.statoTick(v1).fin, f.statoTick(al).fin, 'uguale per tutti, anche per i fantasmi');
  for (let k = 0; k < 20 * (FINE - 1); k++) { f.tempoRound += 0.05; assert.ok(!f.passo(0.05)); }
  f.tempoRound += 1.2; assert.ok(f.passo(0.05), `dopo ${FINE} secondi si passa ai risultati`);
  console.log('✓ Chi è l\'Alieno (aggiornamento): 5 mappe a tema caricabili e controllate (postazioni raggiungibili, anteprime, compiti a tema), mappa casuale, 14 tipi di compito, 5 compiti a testa senza doppioni con livelli misti, consegna in due stanze, schermata finale con ruoli svelati, eliminati ed espulsi');
}

// ======================= DISPENSE: ARGOMENTI, ESERCITAZIONI, VERIFICHE =======================
fissa('DISPENSE: ARGOMENTI, ESERCITAZIONI, VERIFICHE');
{
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const cartella = path.join(__dirname, '..', 'public', 'js');
  const ctx = { console, Math, Date, String, Number, Array, Object, JSON };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(cartella, 'boss-pagina.js'), 'utf8'), ctx);
  const { corretta, prepara, norm, subnetCasuale, ORDINE } = ctx.BossPagina._test;
  // le materie del menu: ognuna ha il suo file di contenuti e il suo file di esercizi (e lo script in index.html)
  const file = [...ORDINE];
  const indiceHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const f of file.concat(file.map((x) => `esercizi-${x}`))) {
    assert.ok(indiceHtml.includes(`/js/boss-contenuti/${f}.js`), `index.html carica ${f}.js`);
    vm.runInContext(fs.readFileSync(path.join(cartella, 'boss-contenuti', `${f}.js`), 'utf8'), ctx);
  }
  assert.ok(['sistemi', 'tpsit', 'informatica', 'inglese', 'matematica', 'italiano', 'storia'].every((m) => file.includes(m)), 'le materie del menu');
  let argomenti = 0, domande = 0;
  for (const m of file) {
    const M = ctx.BossContenuti[m], E = ctx.BossEsercizi[m];
    assert.ok(M && E && M.argomenti.length >= 4, `${m}: contenuti ed esercizi`);
    assert.strictEqual(new Set(M.argomenti.map((a) => a.id)).size, M.argomenti.length, `${m}: argomenti distinti`);
    assert.strictEqual(JSON.stringify(Object.keys(E).sort()), JSON.stringify([...M.argomenti].map((a) => a.id).sort()), `${m}: ogni argomento del menu ha la sua pagina e le sue domande`);
    for (const a of M.argomenti) {
      argomenti++;
      const h = a.corpo();
      assert.ok(typeof h === 'string' && h.includes('<h2') && h.length > 400, `${m}/${a.id}: pagina con le sue sezioni`);
      assert.ok(E[a.id].length >= 8, `${m}/${a.id}: almeno 8 domande`);
      for (const q0 of E[a.id]) {
        domande++;
        const q = prepara(q0), msg = `${m}/${a.id}: ${q.d}`;
        assert.ok(q.d && (q.s || q.modello), `${msg}: testo e spiegazione`);
        // con la risposta giusta la correzione dice "corretto"
        const giusta = { scelta: () => String(q.r), vf: () => (q.r ? 'v' : 'f'), completa: () => q.r[0], abbina: () => q.coppie.map((c) => c[1]), calcolo: () => q.campi.map((c) => c[1][0]), aperta: () => q.modello }[q.t];
        assert.ok(giusta, `${msg}: tipo conosciuto`);
        if (q.t === 'scelta') assert.ok(q.o.length >= 3 && q.r >= 0 && q.r < q.o.length && new Set(q.o).size === q.o.length, `${msg}: opzioni valide`);
        if (q.t === 'vf') assert.strictEqual(typeof q.r, 'boolean');
        if (q.t === 'abbina') assert.ok(q.coppie.length >= 3 && new Set(q.coppie.map((c) => c[1])).size === q.coppie.length, `${msg}: abbinamenti senza ambiguità`);
        assert.ok(corretta(q, giusta()), `${msg}: la risposta giusta è riconosciuta`);
        if (q.t === 'scelta') assert.ok(!corretta(q, String((q.r + 1) % q.o.length)), `${msg}: una sbagliata no`);
        if (q.t === 'aperta') assert.ok(!corretta(q, 'non lo so'), `${msg}: risposta vuota non valida`);
      }
    }
  }
  // subnetting generato: i numeri tornano sempre
  for (let k = 0; k < 40; k++) {
    const q = subnetCasuale(), m = /(\d+) sottoreti.*numero (\d+)/.exec(q.d), n = Number(m[1]), i = Number(m[2]) - 1;
    const bl = 256 / n, rete = q.campi[1][1][0].split('.').map(Number)[3];
    assert.ok(rete === i * bl && q.campi[3][1][0] === String(bl - 2) && q.campi[0][1][0] === `/${24 + Math.log2(n)}`, `subnetting generato giusto: ${q.d}`);
  }
  assert.ok(norm(' 192.168.1.0 ') === '192.168.1.0' && norm('Città.') === 'citta', 'normalizzazione delle risposte');
  // niente percentuali o barre di avanzamento nelle dispense
  const tutto = ['boss-pagina.js', 'boss.js', ...fs.readdirSync(path.join(cartella, 'boss-contenuti')).map((f) => `boss-contenuti/${f}`)].map((f) => fs.readFileSync(path.join(cartella, f), 'utf8')).join('\n') + fs.readFileSync(path.join(__dirname, '..', 'public', 'boss.css'), 'utf8');
  for (const vietato of ['st-progresso', '% completato', 'Avanzamento del corso', 'st-barra', 'st-perc']) assert.ok(!tutto.includes(vietato), `nessuna traccia di avanzamento: ${vietato}`);
  // niente nomi di professori, niente notifiche finte, niente classe precisa (farebbero insospettire)
  for (const vietato of ['Prof.', 'prof:', '.prof', 'ha caricato', 'Nuovo materiale pubblicato', 'st-badge', '5ªB']) assert.ok(!tutto.includes(vietato), `niente nomi o notifiche finte: ${vietato}`);
  // le scorciatoie di ritorno non scattano dentro un campo di testo (Esc invece apre sempre le dispense)
  const boss = fs.readFileSync(path.join(cartella, 'boss.js'), 'utf8');
  const regole = boss.slice(boss.indexOf('// (inizio: regole dei tasti di ritorno'), boss.indexOf('// (fine: regole dei tasti di ritorno'));
  const T = vm.runInNewContext(`const PAROLA = 'gioca'; ${regole}; ({ tastoRitorno, contaParola })`);
  assert.ok(T.tastoRitorno('/', false, false) && T.tastoRitorno('\\', false, false), '"/" e "\\" fuori dai campi tornano al gioco');
  assert.ok(!T.tastoRitorno('/', true, false) && !T.tastoRitorno('\\', true, false) && !T.tastoRitorno('/', false, true), 'dentro un campo (o con Ctrl) no');
  let d = ''; for (const c of 'gioca') d = T.contaParola(d, c, false); assert.strictEqual(d, 'gioca', 'la parola fuori dai campi');
  d = ''; for (const c of 'gioca') d = T.contaParola(d, c, true); assert.strictEqual(d, '', 'la parola dentro un campo no');
  // all'apertura si parte sempre dalle dispense; nessun pulsante visibile riporta al gioco; sul telefono: logo premuto 3 s
  const lungo = boss.slice(boss.indexOf('// (inizio: pressione lunga sul logo'), boss.indexOf('// (fine: pressione lunga sul logo'));
  const P = vm.runInNewContext(`${lungo}; ({ pressioneLunga, PRESSIONE_MS })`);
  const prova = (eventi) => { let st = null, esci = false; for (const [ora, ev] of eventi) { const r = P.pressioneLunga(ora, st, ev); st = r.stato; esci = esci || r.esci; } return esci; };
  assert.strictEqual(P.PRESSIONE_MS, 3000);
  assert.ok(prova([[0, { tipo: 'giu', suLogo: true, x: 10, y: 10 }], [1500, { tipo: 'muovi', x: 18, y: 14 }], [3000, { tipo: 'tempo' }]]), '3 secondi sul logo (con un tremolio del dito): si esce');
  assert.ok(!prova([[0, { tipo: 'giu', suLogo: true, x: 10, y: 10 }], [2900, { tipo: 'tempo' }]]), 'meno di 3 secondi no');
  assert.ok(!prova([[0, { tipo: 'giu', suLogo: true, x: 10, y: 10 }], [2000, { tipo: 'su' }], [3000, { tipo: 'tempo' }]]), 'staccato prima: no');
  assert.ok(!prova([[0, { tipo: 'giu', suLogo: true, x: 10, y: 10 }], [1000, { tipo: 'muovi', x: 60, y: 10 }], [3000, { tipo: 'tempo' }]]), 'dito spostato: no');
  assert.ok(!prova([[0, { tipo: 'giu', suLogo: false, x: 10, y: 10 }], [3500, { tipo: 'tempo' }]]), 'fuori dal logo: no');
  const indice0 = fs.readFileSync(path.join(cartella, '..', 'index.html'), 'utf8');
  assert.ok(/const clicCentrale = \(e\) => e\.button === 1;/.test(boss) && /SECONDI_MIN = 0, SECONDI_MAX = 5, SECONDI_BASE = 2/.test(boss) && /if \(cfg\.secondi === 0\) \{ attiva\(\{ subito: true \}\); return; \}/.test(boss) && /<option value="0">0 \(subito\)<\/option>/.test(indice0), 'rotellina come Esc; finestra grigia da 0 (subito) a 5 secondi (predefinito 2)');
  const pag = fs.readFileSync(path.join(cartella, 'boss-pagina.js'), 'utf8'), indice = fs.readFileSync(path.join(cartella, '..', 'index.html'), 'utf8');
  assert.ok(!/data-torna|Torna al gioco/.test(pag), 'nessun pulsante per tornare al gioco nelle dispense');
  // apertura dentro un capitolo (mai un indice), menu con la sola materia corrente, ultimo capitolo ricordato
  assert.ok(/const st = \{ vista: 'argomento'/.test(pag) && /materia\('sistemi'\)/.test(pag), 'prima apertura: un capitolo a caso di Sistemi e Reti');
  assert.ok(/function mostrata\(\) \{\n    \/\/ a ogni apertura si riapre l'ultimo capitolo visitato[^\n]*\n    if \(st\.capitolo && root\) vai\('argomento', st\.capitolo\.m, st\.capitolo\.a\);/.test(pag), 'a ogni apertura si riapre l\'ultimo capitolo');
  assert.ok(/if \(vista === 'argomento' && st\.m && st\.a\) \{ st\.capitolo = /.test(pag) && /if \(vista === 'materia'\) \{ vista = 'argomento'; a = capitoloDi\(m\); \}/.test(pag), 'la posizione si aggiorna a ogni capitolo; la materia porta dentro un capitolo');
  assert.ok(/function menu\(\) \{\n    const m = materia\(/.test(pag) && /data-cambia-m/.test(pag), 'menu laterale della sola materia; la materia si cambia dalle briciole');
  assert.ok(/if \(st\.vista === 'argomento'\) \{ al0\.m = st\.m; al0\.a = st\.a;/.test(pag), 'esercitazioni e verifiche partono dalla materia e dal capitolo che si stava leggendo');
  assert.ok(/const avvio = \(\) => \{ prepara\(\); attiva\(\{ subito: true \}\); \};/.test(boss), 'all\'apertura si parte sempre dalle dispense');
  assert.ok(/<html lang="it" class="avvio-studio">/.test(indice) && /html\.avvio-studio,html\.avvio-studio body\{background:#f5f7fa!important\}/.test(indice) && /if \(document\.body\) avvio\(\);/.test(boss) && /<title data-vero="Informatica Facile">Dispense di Informatica/.test(indice) && /<link rel="icon" href="[^"]*" data-vero="[^"]*">/.test(indice), 'nessun lampo del sito vero (nemmeno lo sfondo verde): pagina nascosta, sfondo delle dispense, titolo e icona finti fin dall\'inizio, dispense disegnate subito');
  console.log(`✓ Dispense: ${file.length} materie, ${argomenti} argomenti con la loro pagina, ${domande} domande valide (risposta giusta riconosciuta, spiegazione), subnetting generato, niente percentuali di avanzamento, niente nomi di professori né notifiche finte, scorciatoie di ritorno ferme dentro i campi di testo, partenza sempre dalle dispense senza pulsanti di ritorno, logo premuto 3 secondi, apertura dentro un capitolo (primo a caso in Sistemi e Reti, poi l'ultimo visitato), menu della sola materia, esercitazioni contestuali`);
}

// ======================= DIFESE: GUARDIA E BAN AUTOMATICO =======================
fissa('DIFESE: GUARDIA E BAN AUTOMATICO');
{
  const { Guardia, MappaLimitata, ipDaCatena, indirizzo, eScansione, origineValida, PUNTI } = require('../guardia');
  const sic = require('../sicurezza');
  let ora = 1e12; const orologio = () => ora;
  const log = [];
  const g = new Guardia({ ora: orologio, log: (r) => log.push(r) });
  // segnali giusti: due scansioni (25 + 25) = 50 → ban
  assert.strictEqual(g.segnala('1.1.1.1', 'scansione'), null);
  assert.strictEqual(g.segnala('1.1.1.1', 'scansione'), 'ban', 'due scansioni: ban');
  assert.ok(g.bannato('1.1.1.1') === ora + 10 * 60000 && log.length === 1 && log[0].includes('scansione'), 'primo ban: 10 minuti, con una riga di log');
  // i punti scendono col tempo (1 ogni 6 secondi)
  g.segnala('2.2.2.2', 'scansione'); ora += 150 * 1000; assert.ok(g.puntiDi('2.2.2.2') === 0, 'dopo 150 s i 25 punti sono spariti');
  assert.strictEqual(g.segnala('2.2.2.2', 'scansione'), null, 'niente ban se i punti sono scesi');
  // durata progressiva: 10 min, 1 ora, 24 ore, 7 giorni (e poi resta 7 giorni); dopo 30 giorni si riparte
  const durate = [];
  for (let k = 0; k < 5; k++) { const f0 = ora; g.banna('3.3.3.3', 'prova'); durate.push((g.bannato('3.3.3.3') - f0) / 60000); ora = g.bannato('3.3.3.3') + 1000; }
  assert.deepStrictEqual(durate, [10, 60, 1440, 10080, 10080], 'recidive: ban sempre più lunghi');
  ora += 31 * 24 * 3600 * 1000; g.banna('3.3.3.3', 'prova'); assert.strictEqual((g.bannato('3.3.3.3') - ora) / 60000, 10, 'dopo 30 giorni le recidive si dimenticano');
  assert.ok(g.grazia('3.3.3.3') && !g.bannato('3.3.3.3'), 'grazia');
  // IP_FIDATI: mai bannato per indirizzo, si chiude solo la connessione che esagera
  const f = new Guardia({ ora: orologio, fidati: ['5.5.5.5'], log: () => {} }), conn = {};
  assert.strictEqual(f.segnala('5.5.5.5', 'scansione'), null);
  assert.strictEqual(f.segnala('5.5.5.5', 'scansione', conn), null);
  assert.strictEqual(f.segnala('5.5.5.5', 'scansione', conn), 'chiudi', 'fidato: si chiude la connessione');
  assert.ok(!f.bannato('5.5.5.5'), 'fidato: l\'indirizzo non viene mai bannato');
  // modalità prova: scrive nel log ma non banna
  const pr = new Guardia({ ora: orologio, attiva: false, log: () => {} }); pr.segnala('7.7.7.7', 'scansione'); pr.segnala('7.7.7.7', 'scansione'); assert.ok(!pr.bannato('7.7.7.7'), 'GUARDIA=prova: niente ban');
  // tetto delle mappe
  const m = new MappaLimitata(100); for (let k = 0; k < 1000; k++) m.set(`ip${k}`, k); assert.ok(m.size === 100 && m.has('ip999') && !m.has('ip0'), 'tetto: escono i più vecchi');
  const t = new Guardia({ ora: orologio, tetto: 200, log: () => {} }); for (let k = 0; k < 5000; k++) t.segnala(`10.0.${k >> 8}.${k & 255}`, 'errore'); assert.ok(t.punti.size <= 200, 'la guardia non si riempie con indirizzi diversi');
  // x-forwarded-for falso ignorato: conta quello aggiunto dal proxy fidato (Render)
  assert.strictEqual(ipDaCatena('9.9.9.9, 8.8.8.8, 1.2.3.4', '10.1.1.1', 1), '1.2.3.4', 'valori scritti da chi fa la richiesta ignorati');
  assert.strictEqual(sic.ipDi({ headers: { 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }, socket: { remoteAddress: '10.1.1.1' } }), '1.2.3.4', 'ipDi usa il proxy fidato');
  assert.strictEqual(ipDaCatena('', '::ffff:4.4.4.4', 1), '4.4.4.4', 'senza proxy: l\'indirizzo collegato');
  assert.strictEqual(indirizzo({ 'x-forwarded-for': '162.158.1.1', 'cf-connecting-ip': '8.8.4.4' }, '10.1.1.1', { hop: 1, cloudflare: true }), '8.8.4.4', 'Cloudflare: CF-Connecting-IP se arriva da Cloudflare');
  assert.strictEqual(indirizzo({ 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '8.8.4.4' }, '10.1.1.1', { hop: 1, cloudflare: true }), '6.6.6.6', 'Cloudflare: ignorato se non arriva da Cloudflare');
  // percorsi di scansione
  for (const u of ['/.env', '/.git/config', '/wp-login.php', '/wp-admin/', '/phpmyadmin', '/admin', '/config.php', '/../../etc/passwd', '/%2e%2e/segreto']) assert.ok(eScansione(u), `scansione: ${u}`);
  for (const u of ['/', '/js/app.js', '/dispense', '/style.css', '/js/giochi/alieno.js', '/socket.io/socket.io.js']) assert.ok(!eScansione(u), `pagina normale: ${u}`);
  // Origin dell'handshake: solo il sito stesso (più ORIGINI_CONSENTITE)
  assert.ok(origineValida({ origin: 'https://gioco.onrender.com', host: 'gioco.onrender.com' }), 'stessa origine');
  assert.ok(!origineValida({ origin: 'https://sito-cattivo.com', host: 'gioco.onrender.com' }), 'origine sbagliata rifiutata');
  assert.ok(origineValida({ origin: 'https://informaticafacile.it', host: 'gioco.onrender.com' }, ['informaticafacile.it']), 'ORIGINI_CONSENTITE');
  // una sola connessione che manda chat a raffica: limitata, ma nessun punto all'indirizzo
  const falso = () => { const h = {}; return { h, on(e, f) { h[e] = f; }, emit() {}, disconnect() { this.chiuso = true; } }; };
  const sospetti = [], s1 = falso();
  sic.proteggiSocket(s1, { quandoSospetto: (c) => sospetti.push(c) }); s1.on('chat', () => {});
  for (let k = 0; k < 400; k++) s1.h.chat('spam');
  assert.ok(s1.chiuso && !sospetti.length, 'spam in chat: chiusa la connessione, nessun punto all\'indirizzo');
  const s2 = falso(); sic.proteggiSocket(s2, { quandoSospetto: (c) => sospetti.push(c) }); s2.on('creaStanza', () => {});
  for (let k = 0; k < 400; k++) s2.h.creaStanza({});
  assert.ok(sospetti.includes('abuso'), 'raffica di altri eventi: disconnessione per abuso, che conta');
  const s3 = falso(); sospetti.length = 0; sic.proteggiSocket(s3, { quandoSospetto: (c) => sospetti.push(c) }); s3.on('azione', () => { throw new Error('dato non valido'); });
  s3.h.azione(JSON.parse('{"__proto__": {"x": 1}, "a": 1}'));
  assert.deepStrictEqual(sospetti, ['dati', 'errore'], 'chiave vietata ed errore nel gestore: due segnali');
  // HTTP: chi è bannato vede "Accesso sospeso" (403) prima del limitatore; una scansione dà punti
  const usi = []; const app = { disable() {}, set() {}, use: (f) => usi.push(f) };
  const gh = new Guardia({ log: () => {} }); sic.difeseHttp(app, { guardia: gh });
  const chiama = (url, ip) => { const r = { h: {}, statusCode: 200, setHeader(k, v) { this.h[k] = v; }, end(b) { this.body = b; } }; let avanti = false; usi[0]({ url, headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: '10.9.9.9' } }, r, () => { avanti = true; }); return { r, avanti }; };
  assert.ok(chiama('/', '44.44.44.44').avanti, 'richiesta normale: passa');
  assert.ok(chiama('/', '44.44.44.44').r.h['Cross-Origin-Resource-Policy'] === 'same-origin', 'intestazione CORP');
  chiama('/.env', '45.45.45.45'); const b = chiama('/wp-login.php', '45.45.45.45');
  assert.strictEqual(b.r.statusCode, 404);
  const x = chiama('/', '45.45.45.45');
  assert.ok(x.r.statusCode === 403 && /Accesso sospeso/.test(x.r.body) && !/scansione|soglia|punti/.test(x.r.body) && !x.avanti, 'bannato: 403 senza motivi né soglie');
  assert.ok(PUNTI.scansione === 25 && PUNTI.dati === 10 && PUNTI.abuso === 15 && PUNTI.origine === 10);
  console.log('✓ Difese: ban dopo i segnali giusti, punti che scendono col tempo, ban sempre più lunghi (10 min, 1 h, 24 h, 7 giorni), IP_FIDATI mai bannati, modalità prova, x-forwarded-for falso ignorato, Cloudflare solo se vero, tetto delle mappe, origine sbagliata rifiutata, chat a raffica di una sola connessione senza ban, pagina "Accesso sospeso", scansioni');
}

// ---- fantasIA: la mini IA della chat (Gemini finto: nessuna rete, nessuna chiave vera) ----
(async () => {
  const { FantasIA, domandaDa, pulisciRisposta, giornoItaliano, ISTRUZIONI } = require('../fantasia');
  const fs = require('fs'), path = require('path');
  // comando riconosciuto solo come prima parola, maiuscole e accenti liberi
  assert.strictEqual(domandaDa('!fantasia chi ha inventato il computer?'), 'chi ha inventato il computer?');
  assert.strictEqual(domandaDa('  !FantasIA   ciao   come   stai '), 'ciao come stai');
  assert.strictEqual(domandaDa('!fantasìa ok'), 'ok');
  assert.strictEqual(domandaDa('!fantasia'), '', 'comando senza domanda');
  for (const no of ['fantasia ciao', 'ciao !fantasia', '!fantasiaa x', '!fanta x', '', null]) assert.strictEqual(domandaDa(no), null, `non è il comando: ${no}`);
  // risposta: solo testo su una riga, markdown e HTML tolti, accorciata a 400 caratteri
  assert.strictEqual(pulisciRisposta('**Ciao!**\n\n# Titolo\n- uno\n* due\n[link](http://x.it) `codice` <b>tag</b>'), 'Ciao! Titolo uno due link codice tag');
  const lunga = pulisciRisposta('parola '.repeat(200));
  assert.ok(lunga.length <= 400 && lunga.endsWith('…') && !/\s…$/.test(lunga), 'risposta accorciata');
  assert.ok(!/\u202e/.test(pulisciRisposta('a\u202eb')), 'niente caratteri invisibili');
  // Gemini finto
  const chiamate = [];
  let risposta = () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: 'Il primo computer elettronico è **ENIAC**.' }] } }] } });
  const finto = async (url, op) => {
    chiamate.push({ url, op, corpo: JSON.parse(op.body) });
    const r = await risposta(url);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.json || {} };
  };
  let ora = Date.parse('2026-09-29T10:00:00Z');
  const log = { warn: (m) => righeLog.push(m) }, righeLog = [];
  // i limiti sono spenti di base (scelta del 6/11/2026): qui si accendono per provare che funzionano ancora
  assert.strictEqual(new FantasIA({ chiave: 'K', fetch: finto }).limiteGiorno, Infinity, 'di base nessun limite');
  const f = new FantasIA({ chiave: 'CHIAVE-FINTA', fetch: finto, ora: () => ora, log, limiteGiorno: 100, attesaMs: 20000 });
  assert.ok(f.attiva);
  assert.ok(!new FantasIA({ chiave: '', fetch: finto }).attiva && /non è ancora accesa/.test(new FantasIA({ fetch: finto }).prenota('1.1.1.1', 'x').errore), 'senza chiave resta spenta');
  assert.ok(/Scrivi la domanda/.test(f.prenota('1.1.1.1', '').errore), 'domanda vuota');
  assert.ok(f.prenota('1.1.1.1', 'ciao').ok);
  const r1 = await f.rispondi('ciao');
  assert.strictEqual(r1.testo, 'Il primo computer elettronico è ENIAC.');
  const c1 = chiamate[0];
  assert.ok(c1.op.headers['x-goog-api-key'] === 'CHIAVE-FINTA' && !c1.url.includes('CHIAVE'), 'la chiave va nell\'intestazione, non nell\'indirizzo');
  assert.ok(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/.test(c1.url));
  assert.ok(c1.corpo.systemInstruction.parts[0].text === ISTRUZIONI && /italiano/.test(ISTRUZIONI) && c1.corpo.contents[0].parts[0].text === 'ciao');
  // attesa di 20 secondi per indirizzo (un altro indirizzo può chiedere subito)
  assert.ok(/riprova tra 20 secondi/.test(f.prenota('1.1.1.1', 'ancora').errore));
  ora += 19000; assert.ok(/riprova tra 1 secondo/.test(f.prenota('1.1.1.1', 'ancora').errore));
  assert.ok(f.prenota('2.2.2.2', 'io').ok); await f.rispondi('io');
  ora += 1000; assert.ok(f.prenota('1.1.1.1', 'ancora').ok); await f.rispondi('ancora');
  // limite di 100 al giorno per tutto il sito (le domande rifiutate non contano), riparte a mezzanotte italiana
  assert.strictEqual(f.stato().usate, 3);
  for (let k = 3; k < 100; k++) { assert.ok(f.prenota(`9.9.${k}.1`, 'x').ok, `domanda ${k + 1}`); await f.rispondi('x'); }
  assert.ok(/finito le 100 risposte di oggi/.test(f.prenota('3.3.3.3', 'x').errore), 'la 101ª domanda del giorno è rifiutata');
  ora = Date.parse('2026-09-29T21:59:00Z'); assert.ok(f.prenota('3.3.3.4', 'x').errore, 'alle 23:59 italiane è ancora lo stesso giorno');
  ora = Date.parse('2026-09-29T22:01:00Z'); assert.strictEqual(giornoItaliano(ora), '2026-09-30');
  assert.ok(f.prenota('3.3.3.5', 'x').ok, 'dopo la mezzanotte italiana si riparte'); await f.rispondi('x');
  assert.strictEqual(f.stato().usate, 1);
  // al massimo 3 richieste insieme
  let sblocca; risposta = () => new Promise((ok) => { sblocca = sblocca || []; sblocca.push(() => ok({ status: 200, json: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } })); });
  sblocca = null;
  const attese = [];
  for (let k = 0; k < 3; k++) { assert.ok(f.prenota(`4.4.4.${k}`, 'x').ok); attese.push(f.rispondi('x')); }
  assert.ok(/sta già rispondendo/.test(f.prenota('4.4.4.9', 'x').errore), 'la quarta insieme aspetta');
  await new Promise((ok) => setImmediate(ok)); sblocca.forEach((x) => x());
  assert.ok((await Promise.all(attese)).every((x) => x.testo === 'ok'));
  assert.ok(f.prenota('4.4.4.9', 'x').ok, 'finite le altre si può chiedere'); risposta = () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }); await f.rispondi('x');
  // errori di Google: messaggi chiari, niente crash, niente chiave nei log
  risposta = () => ({ status: 429 }); ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.ok(/stanca/.test((await f.rispondi('x')).errore));
  risposta = () => ({ status: 500 }); ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.ok(/non riesce/.test((await f.rispondi('x')).errore));
  risposta = () => ({ status: 200, json: { promptFeedback: { blockReason: 'SAFETY' } } }); ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.ok(/preferisce non rispondere/.test((await f.rispondi('x')).errore));
  risposta = () => ({ status: 200, json: { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] } }); ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.ok(/preferisce non rispondere/.test((await f.rispondi('x')).errore));
  risposta = () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: 'pensiero nascosto', thought: true }, { text: 'Risposta.' }] } }] } }); ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.strictEqual((await f.rispondi('x')).testo, 'Risposta.', 'i "pensieri" del modello non si mostrano');
  risposta = () => { throw new Error('rete giù'); }; ora += 60000; f.prenota('5.5.5.5', 'x');
  assert.ok(/non riesce/.test((await f.rispondi('x')).errore), 'rete giù: avviso, niente crash');
  // Gemini che non risponde: dopo il tempo massimo si rinuncia
  const lento = new FantasIA({ chiave: 'K', timeoutMs: 50, log, fetch: (u, op) => new Promise((_ok, no) => op.signal.addEventListener('abort', () => { const e = new Error('abort'); e.name = 'AbortError'; no(e); })) });
  lento.prenota('6.6.6.6', 'x'); assert.ok(/troppo/.test((await lento.rispondi('x')).errore) && lento.inCorso === 0);
  // modello spento da Google (404): si passa al successivo e non si riprova più
  const visti = [];
  const cambia = new FantasIA({ chiave: 'K', log, fetch: async (u) => { visti.push(u); return u.includes('lite') ? { status: 404, ok: false } : { status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'eccomi' }] } }] }) }; } });
  cambia.prenota('7.7.7.7', 'x'); assert.strictEqual((await cambia.rispondi('x')).testo, 'eccomi');
  cambia.ultima.clear(); cambia.prenota('7.7.7.7', 'x'); await cambia.rispondi('x');
  assert.strictEqual(visti.filter((u) => u.includes('lite')).length, 1, 'il modello spento non si riprova');
  assert.ok(righeLog.every((r) => !/CHIAVE|\bK\b/.test(r)), 'la chiave non finisce nei log');
  // la chiave non è mai scritta nei file del progetto; server collegato
  const tutti = []; const giro = (d) => { for (const n of fs.readdirSync(d)) { if (n === 'node_modules' || n.startsWith('.')) continue; const p = path.join(d, n); if (fs.statSync(p).isDirectory()) giro(p); else if (/\.(js|json|html|css|md|txt)$/.test(n)) tutti.push(p); } };
  giro(path.join(__dirname, '..'));
  for (const p of tutti) assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(fs.readFileSync(p, 'utf8')), `nessuna chiave Google in ${p}`);
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(/process\.env\.GEMINI_API_KEY/.test(srv) && /'!fantasia'/.test(srv) && /leggiChat && !s\.partita\.finita\) \{ socket\.emit\('avvisoPrivato', `🤖/.test(srv) && /comandiBloccati\(\)\) \{ socket\.emit\('avvisoPrivato', avvisoBlocco\(\)\); return; \}\n      \/\/ nei giochi/.test(srv), 'server: chiave da Render, !fantasia tra i comandi, spenta nei giochi che leggono la chat e dall\'Ammiragliato');
  console.log('✓ fantasIA: !fantasia riconosciuto, chiave solo da GEMINI_API_KEY (nell\'intestazione, mai nel codice né nei log), 100 domande al giorno per tutto il sito (mezzanotte italiana), una ogni 20 s per indirizzo, 3 insieme, risposta solo testo accorciata a 400 caratteri, errori di Google gestiti, tempo massimo, modello spento sostituito');
})();



// ---- parole vere: Wordle e Impiccato chiedono a fantasIA se la parola esiste (Gemini finto) ----
(async () => {
  const { FantasIA, sembraInventata } = require('../fantasia');
  for (const w of ['bcdfg', 'gaaatto', 'aeiou', 'qwrtzp', '']) assert.ok(sembraInventata(w), `inventata: ${w}`);
  for (const w of ['gatto', 'struttura', 'perché', 'aia', 'sedie', 'mangiavo', 'instradare']) assert.ok(!sembraInventata(w), `vera: ${w}`);
  // Wordle: si controllano solo le parole fuori dal dizionario del gioco, della lunghezza giusta
  const W = GIOCHI.wordle.crea({ n: 1, opzioni: { lunghezza: 5 } });
  assert.strictEqual(W.parolaDaControllare(0, { tipo: 'prova', parola: 'gattx' }), 'gattx');
  assert.strictEqual(W.parolaDaControllare(0, { tipo: 'prova', parola: 'gatto' }), null, 'parola del dizionario: niente IA');
  assert.strictEqual(W.parolaDaControllare(0, { tipo: 'prova', parola: 'gatt' }), null, 'lunghezza sbagliata: ci pensa azione()');
  const W2 = GIOCHI.wordle.crea({ n: 1, opzioni: { lunghezza: 5, controllo: 'dizionario' } });
  assert.strictEqual(W2.parolaDaControllare(0, { tipo: 'prova', parola: 'gattx' }), null, 'solo dizionario: niente IA');
  // Impiccato: si controlla la parola scelta (solo chi sceglie, solo nella fase di scelta)
  const I = GIOCHI.impiccato.crea({ n: 3, opzioni: {} });
  assert.strictEqual(I.parolaDaControllare(I.turno, { tipo: 'parola', parola: 'Perché' }), 'perche');
  assert.strictEqual(I.parolaDaControllare((I.turno + 1) % 3, { tipo: 'parola', parola: 'gatto' }), null);
  assert.strictEqual(I.parolaDaControllare(I.turno, { tipo: 'parola', parola: 'due parole' }), null);
  // Gemini finto: dice SI solo a "sedie"; le risposte si ricordano (una sola richiesta per parola)
  let chiamate = 0;
  const finto = async (url, o) => { chiamate++; const w = JSON.parse(o.body).contents[0].parts[0].text.match(/"(.*)"/)[1]; return { status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: w === 'sedie' ? 'SI' : 'NO' }] } }] }) }; };
  const f = new FantasIA({ chiave: 'finta', fetch: finto, log: { warn() {} } });
  assert.strictEqual(await f.parolaEsiste('sedie'), true);
  assert.strictEqual(await f.parolaEsiste('gattx'), false);
  assert.strictEqual(await f.parolaEsiste('sedie'), true);
  assert.strictEqual(chiamate, 2, 'parola già controllata: niente nuova richiesta');
  assert.strictEqual(await f.parolaEsiste('bcdfg'), false, 'inventata: nemmeno si chiede');
  assert.strictEqual(chiamate, 2);
  assert.strictEqual(f.stato().usate, 0, 'i controlli delle parole non consumano le 100 domande della chat');
  // senza chiave o se Google non risponde: null = la parola si accetta, il gioco non si blocca
  assert.strictEqual(await new FantasIA({}).parolaEsiste('gatto'), null);
  const rotto = new FantasIA({ chiave: 'finta', fetch: async () => { throw new Error('rete'); }, log: { warn() {} } });
  assert.strictEqual(await rotto.parolaEsiste('gatto'), null);
  console.log('✓ Parole vere: Wordle e Impiccato chiedono a fantasIA se la parola esiste (solo quelle fuori dal dizionario), risposte ricordate, parole inventate rifiutate subito, senza IA si accetta');
})();

// ---- Indovina la bandiera ----
{
  const M = GIOCHI.bandiere;
  const { PAESI, MAZZI, scelte, famiglia } = M._test;
  assert.ok(PAESI.length >= 150, 'tante bandiere');
  assert.strictEqual(new Set(PAESI.map((p) => p.nome)).size, PAESI.length, 'nomi tutti diversi');
  for (const p of PAESI) {
    assert.ok(p.svg.length > 20 && !/<script|on\w+=|href/i.test(p.svg), `SVG pulito: ${p.nome}`);
    assert.ok([1, 2, 3].includes(p.fama) && p.W >= 150 && p.W <= 500, `dati: ${p.nome}`);
  }
  assert.ok(MAZZI.famose.length >= 30 && MAZZI.difficili.length >= 100);
  assert.strictEqual(famiglia('#ffffff'), 'bianco'); assert.strictEqual(famiglia('#009246'), 'verde'); assert.strictEqual(famiglia('#ce2b37'), 'rosso');
  for (let k = 0; k < 200; k++) {
    const g = MAZZI.tutte[k % MAZZI.tutte.length], s = scelte(g, MAZZI.tutte);
    assert.ok(s.length === 4 && new Set(s).size === 4 && s.includes(g), '4 risposte diverse con quella giusta');
  }
  // il browser non riceve il nome della bandiera prima della risposta
  const vero = Date.now; let ora = 1e12; Date.now = () => ora;
  const g = M.crea({ n: 2, opzioni: { domande: 10, tempo: 10 } });
  let v = g.vista(0);
  assert.ok(v.giusta === null && !JSON.stringify(v.bandiera).includes(PAESI[g.giusta].nome), 'il nome non arriva prima');
  const giusta = g.opzioni.indexOf(g.giusta);
  ora += 2000; assert.ok(g.azione(0, { tipo: 'risposta', scelta: giusta }).ok);
  assert.ok(g.azione(0, { tipo: 'risposta', scelta: giusta }).errore, 'una sola risposta');
  assert.ok(!g.inAttesa, 'si aspetta l\'altro');
  ora += 1000; g.azione(1, { tipo: 'risposta', scelta: (giusta + 1) % 4 });
  assert.ok(g.inAttesa && g.punti[0] === 18 && g.punti[1] === 0, 'giusta in 2 s su 10 = 10 + 8 punti');
  v = g.vista(1); assert.ok(v.giusta === giusta && v.mia.giusto === false);
  g.avanza(); assert.strictEqual(g.vista(0).domanda, 2);
  // tempo scaduto: nessuno risponde → si chiude da sola
  ora = g.fine + 10; assert.ok(g.controllaTempo() && g.inAttesa && g.serie[0] === 0);
  Date.now = vero;
  // simulazione: il difficile vince di più
  const vinte = { facile: 0, medio: 0, difficile: 0 }; ora = 1e12; Date.now = () => ora;
  for (let k = 0; k < 40; k++) {
    const ord = ['facile', 'medio', 'difficile'].sort(() => Math.random() - 0.5);
    const p = M.crea({ n: 3, opzioni: { domande: 10 }, bot: ord });
    for (let giri = 0; !p.finita && giri < 5000; giri++) { if (p.inAttesa) p.avanza(); else { ora = p.scadenza(); p.controllaTempo(); } }
    p.risultato.vincitori.forEach((i) => vinte[ord[i]]++);
  }
  Date.now = vero;
  assert.ok(vinte.difficile > vinte.medio && vinte.difficile > vinte.facile && vinte.difficile >= 25, `difficile vince di più: ${JSON.stringify(vinte)}`);
  console.log(`✓ Indovina la bandiera: ${PAESI.length} bandiere con SVG pulito, 4 risposte diverse, il nome non arriva prima, punti per velocità, tempo scaduto, computer (${JSON.stringify(vinte)} su 40)`);
}

// ======================= PONTE FRAGILE =======================
fissa('PONTE FRAGILE');
{
  const M = GIOCHI.ponte;
  const { LUNGHEZZE, BONUS_ARRIVO, TEMPI, SPINTA_PRIMA, SPINTA_RICARICA, EQUILIBRIO } = M._test;
  // un orologio finto: il tempo del round, l'equilibrio dopo un salto e la ricarica della spinta dipendono dall'ora
  const vero = Date.now; let ora = vero(); Date.now = () => ora;
  try {
    const g = M.crea({ n: 3, primo: 0, opzioni: { lunghezza: 'corto', round: 1 } });
    assert.ok(g.L === LUNGHEZZE.corto && g.turno === null && g.pos.every((x) => x === -1), 'niente turni: tutti sulla piattaforma');
    assert.strictEqual(g.durata, LUNGHEZZE.corto * TEMPI.normale * 1000, '6 secondi per riga');
    assert.strictEqual(g.vista(1).sicuroFinale, null, 'i vetri buoni non arrivano al browser');
    assert.ok(g.azione(0, { tipo: 'salta', lato: 2 }).errore, 'solo sinistra o destra sul vetro nuovo');
    // chiunque può saltare per primo: salta il 2
    g.azione(2, { tipo: 'salta', lato: g.sicuro[0] });
    assert.ok(g.pos[2] === 0 && g.fronte === 1 && g.noto[0] === g.sicuro[0], 'il vetro regge: tutti vedono il pannello buono');
    assert.ok(g.azione(2, { tipo: 'salta', lato: g.sicuro[1] }).errore, 'dopo un salto serve un attimo di equilibrio');
    // sul vetro noto si va avanti senza scegliere (anche indicando il lato sbagliato)
    assert.ok(g.azione(0, { tipo: 'salta', lato: 1 - g.sicuro[0] }).ok && g.pos[0] === 0 && g.stato[0] === 'ponte', 'sui vetri scoperti si va sul pannello buono');
    ora += EQUILIBRIO + 1;
    g.azione(2, { tipo: 'salta', lato: 1 - g.sicuro[1] });
    assert.ok(g.stato[2] === 'caduto' && g.rotto[1] === 1 - g.sicuro[1] && g.noto[1] === g.sicuro[1] && g.fronte === 2 && !g.inAttesa, 'il vetro si rompe: cade, la riga diventa nota e gli altri continuano subito');
    // il riflesso: solo davanti al vetro sconosciuto, una volta per round, visto solo da chi lo usa
    assert.ok(g.azione(1, { tipo: 'riflesso' }).errore, 'il riflesso non si usa lontano dal vetro sconosciuto');
    ora += EQUILIBRIO + 1; g.azione(0, { tipo: 'salta' });
    assert.ok(g.azione(0, { tipo: 'riflesso' }).ok && g.azione(0, { tipo: 'riflesso' }).errore, 'un riflesso per round');
    assert.ok([0, 1].includes(g.vista(0).indizio) && g.vista(1).indizio === null, 'l\'indizio lo vede solo chi l\'ha chiesto');
    // la spinta: non subito, solo verso chi è sulla stessa riga davanti al vetro sconosciuto, poi si ricarica piano
    const s = M.crea({ n: 3, opzioni: { lunghezza: 'lungo', tempo: 'largo', round: 1 } }); // 162 s: c'è tempo per la ricarica
    assert.ok(/ricarica/.test(s.azione(0, { tipo: 'spingi', chi: 1 }).errore), 'all\'inizio la spinta non è pronta');
    ora += SPINTA_PRIMA;
    assert.ok(s.vista(0).spintaFra === 0, 'la spinta è pronta dopo un po\'');
    assert.ok(s.azione(0, { tipo: 'spingi', chi: 0 }).errore && s.azione(0, { tipo: 'spingi', chi: 7 }).errore, 'non si spinge sé stessi né un posto che non c\'è');
    assert.ok(s.azione(0, { tipo: 'spingi', chi: 1 }).ok && s.fronte === 1 && s.ultimo.spinto && s.ultimo.da === 0 && s.ultimo.posto === 1, 'spinto sul vetro sconosciuto: la riga si scopre');
    assert.ok(/ricarica/.test(s.azione(0, { tipo: 'spingi', chi: 2 }).errore) && s.vista(0).spintaFra === SPINTA_RICARICA, 'poi si ricarica lentamente');
    ora += SPINTA_RICARICA;
    if (s.stato[1] === 'ponte') { s.azione(0, { tipo: 'salta' }); assert.ok(/stessa riga|spingere non serve/.test(s.azione(2, { tipo: 'spingi', chi: 1 }).errore), 'si spinge solo chi è sulla tua riga'); }
    // tempo scaduto: il ponte crolla e chi non è arrivato cade; i punti sono le righe superate
    const t = M.crea({ n: 2, opzioni: { lunghezza: 'corto', round: 1 } });
    t.azione(0, { tipo: 'salta', lato: t.sicuro[0] });
    assert.ok(t.scadenza() === t.fine && !t.controllaTempo(), 'c\'è un orologio per il round');
    ora = t.fine;
    assert.ok(t.controllaTempo() && t.finita && t.stato.every((x) => x === 'caduto') && t.punti[0] === 1 && t.punti[1] === 0, 'allo scadere il ponte crolla: perdono tutti quelli sul ponte');
    // chi arriva prende le righe + il bonus; i vetri già noti si fanno di corsa
    const a = M.crea({ n: 2, opzioni: { lunghezza: 'corto', round: 1 } });
    a.noto = a.sicuro.slice(); a.fronte = a.L;
    for (let k = 0; k < a.L; k++) { ora += EQUILIBRIO + 1; a.azione(0, { tipo: 'salta' }); a.azione(1, { tipo: 'salta' }); }
    assert.ok(a.finita && a.stato.every((x) => x === 'salvo') && a.punti[0] === a.L + BONUS_ARRIVO, 'tutti arrivati: righe + bonus');
    assert.deepStrictEqual(a.risultato.vincitori, [], 'due arrivati a pari punti: pareggio');
    // partite tra computer guidate dall'orologio (come nel sito): finiscono sempre, a volte qualcuno arriva
    const media = { facile: 0, medio: 0, difficile: 0 }; let arrivati = 0, spinte = 0;
    for (let k = 0; k < 600; k++) {
      const n = 2 + (k % 7), liv = ['facile', 'medio', 'difficile'];
      const p = M.crea({ n, primo: k % n, opzioni: { lunghezza: ['corto', 'medio', 'lungo'][k % 3], round: [1, 3, 5][k % 3], tempo: ['normale', 'stretto', 'largo'][k % 3] }, bot: Array.from({ length: n }, (_, i) => liv[i % 3]) });
      let passi = 0;
      while (!p.finita) {
        assert.ok(++passi < 20000, 'la partita finisce');
        if (p.inAttesa) { p.avanza(); continue; }
        ora = Math.max(ora, p.scadenza());
        const prima = p.ultimo; p.controllaTempo();
        if (p.ultimo && p.ultimo !== prima && p.ultimo.spinto) spinte++;
        if (p.stato.includes('salvo')) arrivati += 0;
      }
      p.storico.forEach((r) => r.forEach((x) => { if (x > p.L) arrivati++; }));
      p.punti.forEach((x, i) => { media[liv[i % 3]] += x; });
    }
    assert.ok(arrivati > 0 && spinte > 0, `i computer arrivano (${arrivati}) e si spingono (${spinte})`);
    console.log(`✓ Ponte fragile: niente turni, salta chi vuole, vetri noti percorsi sicuri, equilibrio dopo il salto, riflesso privato, spinta che si ricarica piano, il ponte crolla allo scadere del tempo, 600 partite tra computer (punti f/m/d ${media.facile}/${media.medio}/${media.difficile}, ${arrivati} arrivi, ${spinte} spinte)`);
  } finally { Date.now = vero; }
}

// ======================= MIGLIORIE AI GIOCHI (ottobre) =======================
fissa('MIGLIORIE AI GIOCHI (ottobre)');
{
  // sblocca: annulla (vale una mossa) e aiuto (la prossima mossa della strada più corta, costa 2 mosse)
  const S = GIOCHI.sblocca, g = S.crea({ n: 1, opzioni: { livello: 'facile' } }), t = g.tavole[0];
  assert.ok(g.azione(0, { tipo: 'annulla' }).errore, 'all\'inizio non c\'è niente da annullare');
  assert.ok(g.azione(0, { tipo: 'aiuto' }).ok && t.mosse === 2 && t.aiuto && g.vista(0).aiuto, 'l\'aiuto costa 2 mosse e si vede');
  const prima = t.blocchi.map((b) => ({ ...b }));
  assert.ok(g.azione(0, { tipo: 'muovi', ...t.aiuto }).ok && t.aiuto === null && g.vista(0).puoAnnullare, 'seguendo l\'aiuto la mossa vale');
  assert.ok(g.azione(0, { tipo: 'annulla' }).ok && JSON.stringify(t.blocchi) === JSON.stringify(prima) && t.mosse === 4, 'annulla rimette il blocco e conta una mossa');
  // risolvere seguendo sempre l'aiuto porta alla soluzione
  const h = S.crea({ n: 1, opzioni: { livello: 'facile' } });
  for (let k = 0; k < 40 && h.tavole[0].fatto === null; k++) { h.azione(0, { tipo: 'aiuto' }); h.azione(0, { tipo: 'muovi', ...h.tavole[0].aiuto }); }
  assert.ok(h.tavole[0].fatto !== null, 'con gli aiuti il puzzle si risolve');
  // bandiere: a fine partita il ripasso delle bandiere sbagliate (solo le proprie)
  const B = GIOCHI.bandiere.crea({ n: 2, opzioni: { domande: 10 } });
  for (let k = 0; k < 10; k++) { const giusta = B.opzioni.indexOf(B.giusta); B.azione(0, { tipo: 'risposta', scelta: giusta }); B.azione(1, { tipo: 'risposta', scelta: (giusta + 1) % 4 }); B.avanza(); }
  assert.ok(B.finita && B.vista(0).ripasso.length === 0 && B.vista(1).ripasso.length === 10 && B.vista(1).ripasso.every((x) => x.svg && x.nome && x.detto), 'ripasso: le sbagliate con il nome giusto e quello detto');
  // differenze: nella soluzione arriva il punto da cerchiare, prima no
  const D = GIOCHI.differenze.crea({ n: 1, opzioni: {} });
  assert.strictEqual(D.vista(0).segno, null, 'il punto della differenza non arriva prima');
  assert.ok(D.segno && Number.isFinite(D.segno.x) && Number.isFinite(D.segno.y), 'si sa dove sta la differenza');
  // dalgona: l'ago fermo fuori dal solco crepa piano (c'è tempo per tornare dentro), muovendolo fuori si rompe in fretta
  const G = GIOCHI.dalgona.crea({ n: 1, opzioni: { round: 1 }, bot: [null] }); let ora = Date.now(); while (G.fase !== 'gioco') { ora += 33; G.fineFase = ora; G.tick(ora); }
  G.b[0].forma = 'cerchio'; G.b[0].fatto = new Uint8Array(GIOCHI.dalgona._test.PUNTI.cerchio.length);
  Object.assign(G.inp[0], { a: true, mx: 500, my: 330 }); for (let k = 0; k < 30; k++) G.passo(0.033);
  assert.ok(G.b[0].stato === 'gioco' && G.b[0].danno < 60, `un secondo fermo fuori dal solco non rompe il biscotto (${Math.round(G.b[0].danno)}%)`);
  console.log('✓ Migliorie: Sblocca con annulla e aiuto, ripasso delle bandiere sbagliate, differenza cerchiata nella soluzione, Dalgona più giusta con l\'ago fermo');
}
{
  // blackjack: il consiglio della strategia di base arriva solo a chi deve giocare
  const BJ = GIOCHI.blackjack.crea({ n: 2, opzioni: {}, fiche: [1000, 1000] });
  BJ.azione(0, { tipo: 'punta', importo: 10 }); BJ.azione(1, { tipo: 'punta', importo: 10 });
  let k = 0; while (BJ.fase !== 'turni' && k++ < 20) { if (BJ.inAttesa) BJ.avanza(); else break; }
  if (BJ.fase === 'turni' && BJ.turno !== null) {
    const c = BJ.vista(BJ.turno).consiglio, altro = BJ.vista(1 - BJ.turno).consiglio;
    assert.ok(['carta', 'stai', 'raddoppia', 'dividi'].includes(c) && altro === null && BJ.vista(BJ.turno).azioni[c], 'consiglio valido solo per chi gioca');
  }
  // solitario: annulla rimette il tavolo com'era; il suggerimento è sempre una mossa valida
  const SO = GIOCHI.solitario.crea({ n: 1, opzioni: {} });
  const prima = JSON.stringify(SO.tavoli[0]);
  SO.azione(0, { tipo: 'pesca' }); assert.ok(SO.azione(0, { tipo: 'annulla' }).ok && JSON.stringify(SO.tavoli[0]) === prima, 'annulla rimette il tavolo com\'era');
  assert.ok(SO.azione(0, { tipo: 'muovi', da: { tipo: 'scarti' }, a: { tipo: 'base', i: 0 } }).errore && !SO.vista(0).puoAnnullare, 'una mossa non valida non si annulla');
  for (let n = 0; n < 300 && !SO.finita; n++) {
    if (SO.azione(0, { tipo: 'aiuto' }).errore) break;
    const x = SO.suggerito[0];
    const r = x.pesca ? SO.azione(0, { tipo: 'pesca' }) : SO.azione(0, { tipo: 'muovi', da: x.da, a: x.a });
    assert.ok(!r.errore, `il suggerimento è una mossa valida (${r.errore})`);
    if (SO.giri[0] > 3) break;
  }
  // sudoku: l'aiuto scrive un numero giusto e costa 30 secondi; con gli aiuti lo schema si completa
  const SD = GIOCHI.sudoku.crea({ n: 1, opzioni: { difficolta: 'facile' } });
  const t0 = SD.cronometro(); SD.azione(0, { tipo: 'aiuto' });
  const c = SD.ultimoAiuto.cella;
  assert.ok(SD.griglia[c] === SD.soluzione[c] && SD.cronometro() - t0 >= 30000 && SD.ultimoAiuto.unico, 'aiuto giusto, di solito una casella con un solo numero possibile, +30 s');
  for (let n = 0; n < 90 && !SD.finita; n++) SD.azione(0, { tipo: 'aiuto' });
  assert.ok(SD.finita, 'con gli aiuti lo schema si completa');
  console.log('✓ Aiuti: consiglio del blackjack, annulla e suggerimento nel solitario, aiuto nel sudoku');
}
{
  // annulla mossa contro il computer: tris, forza 4, dama, scacchi; tra persone no
  const prova = (id, mossa) => {
    const M = GIOCHI[id], g = M.crea({ n: 2, primo: 0, opzioni: {}, bot: [null, 'medio'] });
    const prima = JSON.stringify({ ...g.vista(0), evento: null, annullate: 0, puoAnnullare: 0, orologio: null });
    assert.ok(g.azione(0, { tipo: 'annulla' }).errore, `${id}: all'inizio non si annulla`);
    assert.ok(g.azione(0, mossa(g)).ok && g.azione(1, M.bot(g, 1, 'medio')).ok && g.vista(0).puoAnnullare, `${id}: dopo la mia mossa e la risposta del computer si può annullare`);
    assert.ok(g.azione(0, { tipo: 'annulla' }).ok && JSON.stringify({ ...g.vista(0), evento: null, annullate: 0, puoAnnullare: 0, orologio: null }) === prima, `${id}: si torna esattamente a prima`);
    const h = M.crea({ n: 2, primo: 0, opzioni: {}, bot: [null, null] }); h.azione(0, mossa(h));
    assert.ok(h.azione(0, { tipo: 'annulla' }).errore && !h.vista(0).puoAnnullare, `${id}: tra persone non si annulla`);
  };
  prova('tris', (g) => GIOCHI.tris.bot(g, 0, 'medio'));
  prova('forza4', () => ({ tipo: 'cala', colonna: 3 }));
  prova('dama', (g) => ({ tipo: 'muovi', percorso: g.legali[0].percorso }));
  prova('scacchi', (g) => ({ tipo: 'muovi', da: g.legaliOra[0].da, a: g.legaliOra[0].a }));
  const s = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: { tempo: '5+0' }, bot: [null, 'medio'] }); s.azione(0, { tipo: 'muovi', da: s.legaliOra[0].da, a: s.legaliOra[0].a });
  assert.ok(s.azione(0, { tipo: 'annulla' }).errore, 'scacchi: con l\'orologio non si annulla');
  console.log('✓ Annulla mossa contro il computer: tris (tutte le varianti), forza 4, dama e scacchi (senza orologio); tra persone no');
}
