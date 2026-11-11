// Test delle regole e migliaia di partite tra computer, controllando che nessuna carta sparisca.
const assert = require('assert');
process.env.TEST_VELOCE = '1'; // i computer pensano pochi millisecondi, così i test restano veloci
// LA FORTUNA DEI TEST È FISSATA (vedi test/fortuna.js): le partite tra computer escono sempre uguali, così i controlli
// tipo "il difficile batte il medio" non falliscono per una serie sfortunata; se un computer peggiora davvero, le sue
// partite cambiano e il test se ne accorge.
const { fissa } = require('./fortuna');
fissa('simula');
const { GIOCHI } = require('../giochi');
const { valuta } = require('../giochi/scala-regole');
const { _test: S } = require('../giochi/scopa');
const { _test: B } = require('../giochi/briscola');

const C = (id) => {
  if (id[0] === 'X') return { id, jolly: true, rango: 0, seme: null };
  const m = id.match(/^(\d+)([cqfp])(b?)$/);
  return { id, rango: Number(m[1]), seme: m[2] };
};
const Cs = (s) => s.split(' ').map(C);

// ---- scala 40: combinazioni ----
fissa('scala 40: combinazioni');
assert.strictEqual(valuta(Cs('5c 6c 7c')).punti, 18);
assert.strictEqual(valuta(Cs('1c 2c 3c')).punti, 6);
assert.strictEqual(valuta(Cs('12c 13c 1c')).punti, 31);
assert.strictEqual(valuta(Cs('13c 1c 2c')), null, 'niente giro dal re al 2');
assert.strictEqual(valuta(Cs('7c 7q 7f')).punti, 21);
assert.strictEqual(valuta(Cs('1c 1q 1f 1p')).punti, 44);
assert.strictEqual(valuta(Cs('7c 7c 7q')), null, 'tris con semi uguali');
assert.strictEqual(valuta(Cs('7c 7cb 7q')), null, 'tris con due carte dello stesso seme');
assert.strictEqual(valuta(Cs('7c 7q 7f 7p 7cb')), null, 'massimo 4 nel tris');
assert.strictEqual(valuta(Cs('5c X1 7c')).jolly.rango, 6);
assert.strictEqual(valuta(Cs('5c 6c X1')).jolly.rango, 7);
assert.strictEqual(valuta(Cs('12c 13c X1')).jolly.rango, 1);
assert.strictEqual(valuta(Cs('5c X1 X2')), null, 'i jolly non possono essere più delle carte vere');
assert.strictEqual(valuta(Cs('8c X1 X2 11c')).punti, 37, 'due jolly di fila: 8-jolly-jolly-J');
assert.deepStrictEqual(valuta(Cs('8c X1 X2 11c')).jollies.map((j) => j.rango), [9, 10]);
assert.strictEqual(valuta(Cs('5c 6c X1 X2')).punti, 26);
assert.strictEqual(valuta(Cs('5c X1 X2 X3 9c')), null, 'tre jolly e due carte vere');
assert.strictEqual(valuta(Cs('7c 7q X1 X2')).punti, 28);
assert.strictEqual(valuta(Cs('5c 6q 7c')), null);
assert.strictEqual(valuta(Cs('9f X2 9p')).punti, 27);
assert.strictEqual(valuta(Cs('11p 12p 13p')).punti, 30);

// ---- scopa: prese ----
fissa('scopa: prese');
const ids = (x) => JSON.stringify(x.map((o) => [...o].sort()).sort());
assert.strictEqual(ids(S.presePossibili(C('7c'), Cs('7q 3c 4f'), false)), ids([['7q']]), 'la presa singola è obbligatoria');
assert.strictEqual(ids(S.presePossibili(C('7c'), Cs('3c 4f 2q 5p'), false)), ids([['3c', '4f'], ['2q', '5p']]));
assert.strictEqual(S.presePossibili(C('13c'), Cs('3c 4f'), false).length, 0);
assert.strictEqual(ids(S.presePossibili(C('13c'), Cs('6c 4f 1q 3p'), false)), ids([['6c', '4f'], ['6c', '1q', '3p']]));
assert.strictEqual(ids(S.presePossibili(C('1c'), Cs('6c 4f'), true)), ids([['6c', '4f']]), 'asso piglia tutto');
assert.strictEqual(ids(S.presePossibili(C('1c'), Cs('6c 1f'), true)), ids([['1f']]), 'asso su asso');
// primiera
const r = S.contaSmazzata([Cs('7c 7q 7f 7p'), Cs('6c 6q 6f')], [0, 0]);
assert.strictEqual(r[0].primiera, 84);
assert.strictEqual(r[1].primiera, 0, 'senza un seme niente primiera');
assert.strictEqual(r[0].settebello, true);
assert.strictEqual(S.unico([5, 5]), -1);
// scopa 15: la carta giocata più quelle prese fanno 15
assert.strictEqual(ids(S.presePossibili(C('7c'), Cs('11q 7f 5p 3c'), false, true)), ids([['11q'], ['5p', '3c']]), 'scopa 15');
assert.strictEqual(S.presePossibili(C('13c'), Cs('6c 4f'), false, true).length, 0, 'scopa 15: il re prende solo carte che fanno 5');
assert.strictEqual(ids(S.presePossibili(C('13c'), Cs('1c 4f 2q'), false, true)), ids([['1c', '4f']]));

// ---- briscola: prese ----
fissa('briscola: prese');
assert.strictEqual(B.vincitoreDi([{ posto: 0, carta: C('2c') }, { posto: 1, carta: C('1c') }], 'q'), 1);
assert.strictEqual(B.vincitoreDi([{ posto: 0, carta: C('1c') }, { posto: 1, carta: C('2q') }], 'q'), 1);
assert.strictEqual(B.vincitoreDi([{ posto: 0, carta: C('4c') }, { posto: 1, carta: C('1f') }], 'q'), 0);
assert.strictEqual(B.vincitoreDi([{ posto: 0, carta: C('13c') }, { posto: 1, carta: C('3c') }], 'q'), 1);
console.log('✓ regole di base');

// ---- partite complete tra computer ----
fissa('partite complete tra computer');
const LIVELLI = ['facile', 'medio', 'difficile'];
function totaleCarte(g) {
  switch (g.id) {
    case 'briscola': return g.mazzo.length + g.mani.flat().length + g.prese.flat().length + g.tavolo.length;
    case 'scopa': case 'scopone':
      return g.mazzo.length + g.mani.flat().length + g.prese.flat().length + g.tavolo.length + (g.inCorso ? 1 : 0);
    case 'rubamazzo': return g.mazzo.length + g.mani.flat().length + g.mazzetti.flat().length + g.tavolo.length + (g.inCorso ? 1 : 0);
    case 'scala40': return g.mazzo.length + g.mani.flat().length + g.pozzo.length + g.combinazioni.reduce((s, m) => s + m.carte.length, 0);
  }
}

const quante = { briscola: 1500, scopa: 250, scopone: 150, rubamazzo: 1500, scala40: 120, tris: 45, forza4: 30, battaglia: 120, dama: 20, scacchi: 12, morra: 300, numero: 300, uno: 400, coccodrillo: 300, blockblast: 3, peppa: 400, wordle: 60, angolo: 60 };
for (const [id, mod] of Object.entries(GIOCHI)) {
  if (!quante[id]) continue; // giochi solo tra persone: hanno i loro controlli più sotto
  for (const n of mod.meta.giocatori) {
    fissa(`${id} in ${n}`);
    let errori = 0;
    let sblocchi = 0;
    let vittorie = [0, 0, 0];
    const t0 = Date.now();
    for (let k = 0; k < quante[id]; k++) {
      const opzioni = {};
      for (const o of mod.meta.opzioni) opzioni[o.id] = o.valori[k % o.valori.length];
      if (id === 'scala40') opzioni.limite = 101;
      const g = mod.crea({ n, primo: k % n, opzioni });
      const livelli = Array.from({ length: n }, (_, i) => LIVELLI[(i + k) % 3]);
      const attese = totaleCarte(g);
      let passi = 0;
      while (!g.finita) {
        assert(++passi < 200000, `${id} non finisce`);
        if (g.inAttesa) { g.avanza(); continue; }
        if (g.turno == null && g.attesi) { // fase in cui agiscono tutti insieme
          for (const posto of g.attesi()) { if (g.finita) break; const r = g.azione(posto, mod.bot(g, posto, livelli[posto])); if (r.errore) throw new Error(r.errore); }
          continue;
        }
        const t = g.turno;
        const r = g.azione(t, mod.bot(g, t, livelli[t]));
        if (r.errore) {
          errori++;
          if (errori < 4) console.log(`  errore bot ${id}/${livelli[t]}: ${r.errore}`);
          if (g.sblocca) { g.sblocca(t); sblocchi++; } else throw new Error(r.errore);
        }
        if (g.id !== 'scala40' || g.fase !== 'riepilogo') assert.strictEqual(totaleCarte(g), attese, `${id}: carte perse`);
        if (g.id === 'scala40') for (const m of g.combinazioni) assert(valuta(m.carte), 'combinazione non valida in tavola');
      }
      if (g.id === 'briscola') assert.strictEqual(g.risultato.fazioni.reduce((s, f) => s + f.punti, 0), n === 3 ? 120 : 120);
      for (const v of g.risultato.vincitori) vittorie[LIVELLI.indexOf(livelli[v])]++;
    }
    console.log(`✓ ${mod.meta.nome} in ${n}: ${quante[id]} partite, errori dei bot ${errori}, vittorie facile/medio/difficile ${vittorie.join('/')} (${Date.now() - t0} ms)`);
    assert.strictEqual(errori, 0, 'i bot non devono fare mosse illegali');
  }
}

// ---- tris: regole ----
fissa('tris: regole');
{
  const T = GIOCHI.tris;
  const g = T.crea({ n: 2, primo: 0, opzioni: { variante: 'classico' } });
  for (const [p, c] of [[0, 0], [1, 3], [0, 1], [1, 4]]) assert.ok(g.azione(p, { tipo: 'segna', cella: c }).ok);
  assert.ok(g.azione(1, { tipo: 'segna', cella: 2 }).errore, 'non è il suo turno');
  assert.ok(g.azione(0, { tipo: 'segna', cella: 3 }).errore, 'casella occupata');
  g.azione(0, { tipo: 'segna', cella: 2 });
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, 'tris in prima riga');
  const u = T.crea({ n: 2, primo: 0, opzioni: { variante: 'ultimate' } });
  u.azione(0, { tipo: 'segna', tab: 4, cella: 2 });
  assert.strictEqual(u.vista().prossima, 2, 'la casella decide il riquadro');
  assert.ok(u.azione(1, { tipo: 'segna', tab: 5, cella: 0 }).errore, 'riquadro sbagliato');
  // il bot difficile nel classico non perde contro il facile quasi mai
  let perse = 0;
  for (let k = 0; k < 100; k++) {
    const t = T.crea({ n: 2, primo: k % 2, opzioni: { variante: 'classico' } });
    while (!t.finita) t.azione(t.turno, T.bot(t, t.turno, t.turno === 0 ? 'difficile' : 'facile'));
    if (t.risultato.vincitori[0] === 1) perse++;
  }
  assert.ok(perse <= 12, `il difficile perde troppo: ${perse}/100`);
  console.log(`✓ Tris: regole e forza del computer (il difficile perde ${perse}/100 contro il facile)`);
}

// ---- forza 4: regole ----
fissa('forza 4: regole');
{
  const F = GIOCHI.forza4;
  const g = F.crea({ n: 2, primo: 0 });
  for (let k = 0; k < 3; k++) { g.azione(0, { tipo: 'cala', colonna: 0 }); g.azione(1, { tipo: 'cala', colonna: 1 }); }
  assert.strictEqual(g.vista().celle[5 * 7], 0, 'la pedina cade in fondo');
  g.azione(0, { tipo: 'cala', colonna: 0 });
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, 'quattro in verticale');
  const h = F.crea({ n: 2, primo: 0 });
  for (let k = 0; k < 6; k++) h.azione(h.turno, { tipo: 'cala', colonna: 6 });
  assert.ok(h.azione(h.turno, { tipo: 'cala', colonna: 6 }).errore, 'colonna piena');
  // il difficile vede la vittoria immediata e blocca quella avversaria
  const v = F.crea({ n: 2, primo: 0 });
  for (const c of [0, 6, 1, 6, 2]) v.azione(v.turno, { tipo: 'cala', colonna: c });
  assert.strictEqual(F.bot(v, 1, 'difficile').colonna, 3, 'deve bloccare');
  console.log('✓ Forza 4: regole e blocco del computer');
}

// ---- battaglia navale: regole ----
fissa('battaglia navale: regole');
{
  const B = GIOCHI.battaglia;
  const NR = require('../giochi/navale-regole');
  assert.ok(NR.valida([{ r: 0, c: 0, lung: 5, vert: false }, { r: 1, c: 0, lung: 4, vert: false }, { r: 5, c: 0, lung: 3 }, { r: 7, c: 0, lung: 3 }, { r: 9, c: 0, lung: 2 }], 'classica'), 'navi che si toccano');
  assert.strictEqual(NR.valida([{ r: 0, c: 0, lung: 5 }, { r: 2, c: 0, lung: 4 }, { r: 4, c: 0, lung: 3 }, { r: 6, c: 0, lung: 3 }, { r: 8, c: 0, lung: 2 }], 'classica'), null);
  assert.ok(NR.valida([{ r: 0, c: 7, lung: 5 }, { r: 2, c: 0, lung: 4 }, { r: 4, c: 0, lung: 3 }, { r: 6, c: 0, lung: 3 }, { r: 8, c: 0, lung: 2 }], 'classica'), 'fuori griglia');
  for (let k = 0; k < 300; k++) assert.strictEqual(NR.valida(NR.casuale('italiana'), 'italiana'), null, 'schieramento casuale valido');
  const g = B.crea({ n: 3, primo: 0, opzioni: { flotta: 'classica' } });
  assert.ok(g.azione(0, { tipo: 'spara', bersaglio: 1, cella: 0 }).errore, 'prima si schiera');
  for (let p = 0; p < 3; p++) g.azione(p, { tipo: 'schiera', navi: NR.casuale('classica') });
  assert.strictEqual(g.fase, 'battaglia');
  assert.strictEqual(g.vista(1).griglie[0].navi, null, 'le navi degli altri non si vedono');
  assert.ok(g.vista(0).griglie[0].navi.length === 5, 'le mie sì');
  assert.ok(g.azione(0, { tipo: 'spara', bersaglio: 0, cella: 0 }).errore, 'non si spara a se stessi');
  g.azione(0, { tipo: 'spara', bersaglio: 1, cella: 0 });
  assert.strictEqual(g.turno, 1, 'il turno passa anche se colpisci');
  // il difficile deve affondare una flotta con molti meno colpi del facile
  const colpiPer = (liv) => {
    let tot = 0;
    for (let k = 0; k < 60; k++) {
      // flotta classica: con quella italiana i 4 sommergibili da una casella si trovano solo a caso
      const t = B.crea({ n: 2, primo: 0, opzioni: { flotta: 'classica' } });
      t.azione(0, { tipo: 'schiera', navi: NR.casuale('classica') });
      t.azione(1, { tipo: 'schiera', navi: NR.casuale('classica') });
      let n = 0;
      while (t.vivo[1]) { t.turno = 0; t.azione(0, B.bot(t, 0, liv)); n++; }
      tot += n;
    }
    return tot / 60;
  };
  const f = colpiPer('facile'), m = colpiPer('medio'), d = colpiPer('difficile');
  assert.ok(d < m && m < f, `colpi medi facile/medio/difficile ${f}/${m}/${d}`);
  console.log(`✓ Battaglia navale: regole; colpi medi per affondare tutto facile ${f.toFixed(0)}, medio ${m.toFixed(0)}, difficile ${d.toFixed(0)}`);
}

// ---- dama: regole di presa ----
fissa('dama: regole di presa');
{
  const { mosseLegali } = GIOCHI.dama._test;
  const vuota = () => new Array(64).fill(null);
  let b = vuota(); b[45] = { l: 0, d: false }; b[36] = { l: 1, d: true };
  assert.ok(mosseLegali(b, 0).every((m) => !m.presi.length), 'la pedina non cattura la dama');
  b = vuota(); b[27] = { l: 0, d: false }; b[36] = { l: 1, d: false };
  assert.ok(mosseLegali(b, 0).every((m) => !m.presi.length), 'la pedina non cattura all\'indietro');
  b = vuota(); b[27] = { l: 0, d: true }; b[36] = { l: 1, d: false };
  assert.deepStrictEqual(mosseLegali(b, 0).map((m) => m.percorso), [[27, 45]], 'la dama cattura all\'indietro');
  b = vuota(); b[45] = { l: 0, d: false }; b[36] = { l: 1, d: false }; b[47] = { l: 0, d: true }; b[38] = { l: 1, d: false }; b[52] = { l: 1, d: false };
  // la pedina può prendere un solo pezzo, la dama tre (38, 36, 52): è obbligatoria la presa più lunga
  assert.deepStrictEqual(mosseLegali(b, 0).map((m) => m.percorso), [[47, 29, 43, 61]], 'obbligo della presa più lunga');
  b = vuota(); b[45] = { l: 0, d: false }; b[36] = { l: 1, d: false }; b[43] = { l: 0, d: true }; b[34] = { l: 1, d: false };
  assert.deepStrictEqual(mosseLegali(b, 0).map((m) => m.percorso), [[43, 25], [43, 29]], 'a parità di pezzi si prende con la dama, non con la pedina');
  console.log('✓ Dama: regole di presa italiane');
}

// ---- scacchi: generatore di mosse (perft) e regole speciali ----
fissa('scacchi: generatore di mosse (perft) e regole speciali');
{
  const S = GIOCHI.scacchi._test;
  const MAP = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  const fen = (f) => {
    const [pos, lato, arr, ep] = f.split(' ');
    const b = new Int8Array(64); let i = 0;
    for (const ch of pos) { if (ch === '/') continue; if (/\d/.test(ch)) { i += +ch; continue; } const t = MAP[ch.toLowerCase()]; b[i++] = ch === ch.toUpperCase() ? t : -t; }
    let a = 0; if (arr.includes('K')) a |= 1; if (arr.includes('Q')) a |= 2; if (arr.includes('k')) a |= 4; if (arr.includes('q')) a |= 8;
    return { b, lato: lato === 'w' ? 1 : -1, arrocco: a, ep: ep === '-' ? -1 : (8 - +ep[1]) * 8 + 'abcdefgh'.indexOf(ep[0]), mezze: 0 };
  };
  const perft = (s, d) => { const m = S.legali(s); if (d === 1) return m.length; let n = 0; for (const x of m) n += perft(S.applica(s, x), d - 1); return n; };
  const casi = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', [20, 400, 8902]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -', [44, 1486, 62379]],
  ];
  for (const [f, att] of casi) att.forEach((v, k) => assert.strictEqual(perft(fen(f), k + 1), v, `perft ${f} profondità ${k + 1}`));
  const casa = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);
  const gioca = (g, ...mosse) => mosse.forEach((m) => { const r = g.azione(g.turno, { tipo: 'muovi', da: casa(m.slice(0, 2)), a: casa(m.slice(2, 4)), promo: m[4] ? MAP[m[4]] : undefined }); assert.ok(r.ok, `${m}: ${r.errore}`); });
  let g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  gioca(g, 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7');
  assert.ok(g.finita && g.motivo === 'matto' && g.risultato.vincitori[0] === 0, 'matto del barbiere');
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  gioca(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
  assert.strictEqual(g.s.b[casa('d5')], 0, 'en passant toglie il pedone');
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  gioca(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
  assert.ok(g.finita && g.motivo === 'ripetizione', 'patta per ripetizione');
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  g.s = fen('7k/8/6QK/8/8/8/8/8 w - -'); g.legaliOra = S.legali(g.s);
  gioca(g, 'g6f7');
  assert.ok(g.finita && g.motivo === 'stallo', 'stallo');
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  g.s = fen('8/P6k/8/8/8/8/8/K7 w - -'); g.legaliOra = S.legali(g.s);
  gioca(g, 'a7a8n');
  assert.strictEqual(g.s.b[0], 2, 'promozione a cavallo');
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  g.s = fen('4k3/8/8/8/8/8/8/R3K2r w Q -'); g.legaliOra = S.legali(g.s);
  assert.ok(!g.legaliOra.some((m) => m.speciale), 'niente arrocco sotto scacco');
  // orologio: il tempo scade
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: { tempo: '3+2' } });
  gioca(g, 'e2e4');
  g.orologio.dal -= 200000;
  assert.ok(g.controllaTempo() && g.motivo === 'tempo' && g.risultato.vincitori[0] === 0, 'bandierina del Nero');
  // patta proposta e accettata
  g = GIOCHI.scacchi.crea({ n: 2, primo: 0, opzioni: {} });
  g.azione(0, { tipo: 'patta' }); g.azione(1, { tipo: 'patta' });
  assert.ok(g.finita && g.risultato.pareggio, 'patta d\'accordo');
  console.log('✓ Scacchi: perft corretto, matto, en passant, promozione, arrocco, stallo, ripetizione, orologio, patta');
}

// ---- impiccato (solo persone) ----
fissa('impiccato (solo persone)');
{
  const I = GIOCHI.impiccato;
  assert.ok(I.meta.soloPersone && !I.bot, 'niente computer');
  const g = I.crea({ n: 3, primo: 0, opzioni: { errori: 6, giri: 1 } });
  assert.strictEqual(g.turno, 0, 'il primo sceglie la parola');
  assert.ok(g.azione(0, { tipo: 'parola', parola: 'ab' }).errore, 'parola troppo corta');
  assert.ok(g.azione(0, { tipo: 'parola', parola: 'due parole' }).errore, 'una sola parola');
  g.azione(0, { tipo: 'parola', parola: 'Perché' });
  assert.strictEqual(g.parola, 'perche', 'accenti e maiuscole non contano');
  assert.strictEqual(g.vista(1).maschera.filter(Boolean).length, 0, 'gli altri non vedono la parola');
  assert.strictEqual(g.vista(0).parolaIntera, 'perche', 'chi l\'ha scelta sì');
  g.azione(1, { tipo: 'lettera', lettera: 'e' });
  assert.strictEqual(g.punti[1], 2, '+1 per ogni E');
  assert.strictEqual(g.turno, 1, 'lettera giusta: continua');
  g.azione(1, { tipo: 'lettera', lettera: 'z' });
  assert.strictEqual(g.turno, 2, 'lettera sbagliata: turno al prossimo (salta chi ha scelto)');
  assert.ok(g.azione(2, { tipo: 'lettera', lettera: 'z' }).errore, 'lettera già provata');
  g.azione(2, { tipo: 'prova', parola: 'perche' });
  assert.ok(g.inAttesa && g.fase === 'riepilogo' && g.punti[2] === 3 + 5, 'parola intera indovinata con bonus');
  g.avanza();
  assert.strictEqual(g.boia, 1, 'al giro dopo sceglie il prossimo');
  g.azione(1, { tipo: 'parola', parola: 'gatto' });
  for (const l of 'qwxyzk') g.azione(g.turno, { tipo: 'lettera', lettera: l });
  assert.strictEqual(g.punti[1], 2 + 5, 'omino impiccato: punti a chi ha scelto');
  g.avanza();
  g.esce(0); // esce chi deve scegliere
  assert.ok(g.boia !== 0 || g.finita, 'chi è uscito non sceglie');
  console.log('✓ Impiccato: scelta della parola, lettere, bonus, impiccato, uscita');
}

// ---- sasso carta forbice ----
fissa('sasso carta forbice');
{
  const M = GIOCHI.morra;
  const { vince } = M._test;
  assert.strictEqual(vince('sasso', 'forbice'), 0); assert.strictEqual(vince('carta', 'forbice'), 1); assert.strictEqual(vince('spock', 'sasso'), 0);
  assert.strictEqual(vince('lucertola', 'spock'), 0); assert.strictEqual(vince('carta', 'carta'), null);
  const g = M.crea({ n: 2, opzioni: { meglio: 3 } });
  g.azione(0, { tipo: 'scegli', mossa: 'sasso' });
  assert.strictEqual(g.vista(1).rivela, null, 'la scelta resta segreta');
  assert.ok(g.vista(1).altroHaScelto && !g.vista(1).miaScelta);
  assert.ok(g.azione(0, { tipo: 'scegli', mossa: 'carta' }).errore, 'non si cambia idea');
  assert.ok(g.azione(1, { tipo: 'scegli', mossa: 'lucertola' }).errore, 'lucertola solo nella variante estesa');
  g.azione(1, { tipo: 'scegli', mossa: 'forbice' });
  assert.ok(g.inAttesa && g.rivela.vince === 0);
  g.avanza();
  g.azione(0, { tipo: 'scegli', mossa: 'sasso' }); g.azione(1, { tipo: 'scegli', mossa: 'forbice' }); g.avanza();
  assert.ok(g.finita && g.risultato.vincitori[0] === 0, '2 su 3');
  // il difficile batte chi gioca sempre uguale
  let v = 0;
  for (let k = 0; k < 50; k++) {
    const t = M.crea({ n: 2, opzioni: { meglio: 5 } });
    while (!t.finita) { t.azione(0, { tipo: 'scegli', mossa: 'sasso' }); t.azione(1, M.bot(t, 1, 'difficile')); t.avanza(); }
    if (t.risultato.vincitori[0] === 1) v++;
  }
  assert.ok(v >= 45, `il difficile deve accorgersi delle abitudini: ${v}/50`);
  console.log(`✓ Sasso carta forbice: regole, segretezza, il difficile batte chi ripete la mossa ${v}/50`);
}

// ---- indovina il numero ----
fissa('indovina il numero');
{
  const Nm = GIOCHI.numero;
  let max = 0;
  for (let k = 0; k < 200; k++) {
    const g = Nm.crea({ n: 1, opzioni: {} });
    assert.ok(g.massimo >= 50 && g.massimo <= 1000 && g.segreto >= 1 && g.segreto <= g.massimo);
    let n = 0;
    while (!g.finita) { g.azione(0, Nm.bot(g, 0, 'difficile')); n++; }
    max = Math.max(max, n);
  }
  assert.ok(max <= 10, `la ricerca binaria trova il numero in al massimo 10 tentativi fino a 1000 (${max})`);
  const g = Nm.crea({ n: 2, primo: 0, opzioni: {} });
  assert.ok(g.azione(0, { tipo: 'prova', numero: 0 }).errore && g.azione(0, { tipo: 'prova', numero: 2.5 }).errore);
  console.log(`✓ Indovina il numero: il difficile trova sempre il numero in ≤ ${max} tentativi`);
}

// ---- giochi da casinò: tante mani tra computer, fiche mai negative ----
fissa('giochi da casinò: tante mani tra computer, fiche mai negative');
{
  for (const id of ['blackjack', 'baccarat', 'higherlower']) {
    const mod = GIOCHI[id];
    const g = mod.crea({ n: 4, primo: 0, opzioni: {}, fiche: [1000, 1000, 1000, 1000] });
    const liv = ['facile', 'medio', 'difficile', 'difficile'];
    let mani = 0, passi = 0;
    while (mani < 400) {
      assert(++passi < 200000, `${id} bloccato`);
      if (g.inAttesa) { const prima = g.nMano; g.avanza(); if (!g.inAttesa && g.fase === 'puntate' && g.nMano > prima) mani++; continue; }
      if (g.fase === 'puntate') {
        const att = g.attesi();
        if (!att.length) { for (let i = 0; i < 4; i++) if (g.fiche[i] <= 0) g.ricarica(i, 1000); continue; }
        for (const i of att) { const r = g.azione(i, mod.bot(g, i, liv[i])); if (r.errore) throw new Error(`${id}: ${r.errore}`); }
        continue;
      }
      const r = g.azione(g.turno, mod.bot(g, g.turno, liv[g.turno]));
      if (r.errore) throw new Error(`${id}: ${r.errore}`);
      assert.ok(g.fiche.every((f) => f >= 0), `${id}: fiche negative`);
    }
    console.log(`✓ ${mod.meta.nome}: 400 mani tra computer senza errori, fiche finali ${g.fiche.join('/')}`);
  }
  // blackjack: pagamenti
  const BJ = GIOCHI.blackjack;
  const C = (r, s = 'c') => ({ id: `${r}${s}-${Math.random()}`, rango: r, seme: s });
  let g = BJ.crea({ n: 1, fiche: [1000] });
  g.scarpa.push(C(5), C(9), C(10), C(1)); // si pesca dalla fine: giocatore A, banco 10, giocatore 9... in ordine: A, 10, 9, 5
  g.azione(0, { tipo: 'punta', importo: 100 }); // giocatore: A + 9 = 20? no: giocatore A e 9 → soft 20; banco 10 e 5
  assert.strictEqual(g.fiche[0], 900);
  g.scarpa.push(C(7)); // il banco a 15 pesca 7 → 22 sballa
  g.azione(0, { tipo: 'stai' });
  while (g.inAttesa && g.fase === 'banco') g.avanza();
  assert.strictEqual(g.fiche[0], 1100, 'vittoria 1:1');
  g.avanza();
  g.scarpa.push(C(8), C(10), C(9), C(1));
  g.azione(0, { tipo: 'punta', importo: 100 }); // giocatore A + 10 = blackjack; banco 9 + 8
  while (g.inAttesa) { if (g.fase === 'pagamenti') break; g.avanza(); }
  assert.strictEqual(g.fiche[0], 1100 + 150, 'blackjack 3:2');
  // il banco sta su soft 17
  const { conta } = BJ._test;
  assert.deepStrictEqual(conta([C(1), C(6)]), { tot: 17, morbida: true });
  g = BJ.crea({ n: 1, fiche: [1000] });
  g.scarpa.push(C(6), C(9), C(1), C(10));
  g.azione(0, { tipo: 'punta', importo: 100 }); // giocatore 10 + 9 = 19, banco A + 6 = soft 17
  g.azione(0, { tipo: 'stai' });
  while (g.inAttesa && g.fase === 'banco') g.avanza();
  assert.strictEqual(g.banco.length, 2, 'il banco non pesca su soft 17');
  assert.strictEqual(g.fiche[0], 1100);
  // baccarat: commissione e pareggio
  const BC = GIOCHI.baccarat;
  const b = BC.crea({ n: 1, fiche: [1000] });
  b.azione(0, { tipo: 'punta', puntate: { banco: 100, punto: 0, pareggio: 10 } });
  while (b.inAttesa && b.fase === 'carte') b.avanza();
  const v = b.mano.vince;
  assert.strictEqual(b.fiche[0], 890 + (v === 'banco' ? 195 : v === 'pareggio' ? 100 + 90 : 0), `pagamento baccarat (${v})`);
  // higher or lower: carta uguale restituita, tempo delle puntate
  const HL = GIOCHI.higherlower;
  const h = HL.crea({ n: 2, fiche: [1000, 1000] });
  h.carta = C(7); h.mazzo.push(C(7, 'q')); h.quote = HL._test.quote(h.mazzo, h.carta);
  h.azione(0, { tipo: 'punta', scelta: 'alta', importo: 100 });
  assert.ok(h.chiusuraPuntate, 'dopo la prima puntata parte il tempo');
  h.chiusuraPuntate = Date.now() - 1;
  assert.ok(h.controllaTempo() && h.passato[1], 'allo scadere chi non ha puntato salta');
  assert.strictEqual(h.fiche[0], 1000, 'carta uguale: puntata restituita');
  // chi punta tutto mentre gli altri stanno ancora puntando non è "senza fiche": le sue fiche sono sul tavolo
  const h2 = HL.crea({ n: 2, fiche: [1000, 1000] });
  assert.strictEqual(h2.ficheInGioco(0), 0, 'prima di puntare niente in gioco');
  h2.azione(0, { tipo: 'punta', scelta: 'alta', importo: 1000 });
  assert.ok(h2.fase === 'puntate' && h2.fiche[0] === 0 && h2.ficheInGioco(0) > 0, 'puntato tutto: le fiche sono in gioco, niente consiglio di ricarica');
  // roulette: una puntata con un nome che non esiste ("toString") è rifiutata
  const rl = GIOCHI.roulette.crea({ n: 1, fiche: [1000] });
  assert.ok(rl.azione(0, { tipo: 'punta', puntate: { toString: 5 } }).errore, 'puntata inventata rifiutata');
  assert.ok(rl.azione(0, { tipo: 'punta', puntate: { rosso: 5 } }).ok, 'puntata vera accettata');
  console.log('✓ Casinò: pagamenti del blackjack (1:1, 3:2, soft 17), baccarat, higher or lower e tempo delle puntate');
}

// ---- poker: le fiche non si creano e non spariscono mai ----
fissa('poker: le fiche non si creano e non spariscono mai');
{
  const PM = require('../giochi/poker-motore');
  const C = (x) => x.split(' ').map((t) => ({ id: t, rango: { A: 1, K: 13, Q: 12, J: 11, T: 10 }[t[0]] || +t[0], seme: t[1] }));
  assert.ok(PM.valuta5(C('6c 5q 4f 3p 2c')).punti > PM.valuta5(C('Ac 2q 3f 4p 5c')).punti, 'scala al 6 > scala al 5');
  assert.ok(PM.valuta5(C('Kc Kq Kf 2p 2c')).punti > PM.valuta5(C('Qc 9c 5c 3c 2c')).punti, 'full > colore');
  assert.ok(PM.valuta5(C('Ac Aq Kf 4p 2c')).punti > PM.valuta5(C('Ac Aq Qf Jp Tc')).punti, 'kicker');
  for (const id of ['texas', 'poker5']) {
    const mod = GIOCHI[id];
    for (const n of [2, 3, 5]) {
      const f0 = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 37 : 400));
      const g = mod.crea({ n, primo: 0, fiche: [...f0] });
      let totale = f0.reduce((a, b) => a + b, 0), mani = 0, laterali = 0, passi = 0;
      const liv = ['facile', 'medio', 'difficile'];
      while (mani < 120) {
        assert(++passi < 100000, `${id} bloccato`);
        if (g.fase === 'attesa') { for (let i = 0; i < n; i++) if (g.fiche[i] <= 0) { g.ricarica(i, 400); totale += 400; } continue; }
        if (g.inAttesa) {
          if (g.fase === 'fine') {
            mani++;
            if (g.piatti && g.piatti.length > 1) laterali++;
            assert.strictEqual(g.fiche.reduce((a, b) => a + b, 0), totale, `${id} in ${n}: fiche create o perse`);
          }
          g.avanza();
          continue;
        }
        const r = g.azione(g.turno, mod.bot(g, g.turno, liv[g.turno % 3]));
        if (r.errore) throw new Error(`${id}: ${r.errore}`);
        assert.ok(g.fiche.every((f) => f >= 0));
      }
      console.log(`✓ ${mod.meta.nome} in ${n}: 120 mani, fiche sempre conservate (piatti laterali: ${laterali})`);
    }
  }
  // piatto laterale costruito a mano: A (37... no: 50 fiche) va all-in con la mano migliore, B e C con 200
  const T = GIOCHI.texas;
  const g = T.crea({ n: 3, primo: 0, fiche: [50, 200, 200] });
  assert.strictEqual(g.dealer, 0, 'mazziere 0: parla per primo B');
  g.carte = [C('7c 4s'), C('Kc Kd'), C('9c 9d')];
  g.mazzo = C('3h 9s 5h 8s 4c Jh Qs 6d').reverse(); // brucia, flop 9 5 8, brucia, turn J, brucia, river 6
  g.azione(g.turno, { tipo: 'punta', fino: 200 }); // B all-in 200
  g.azione(g.turno, { tipo: 'vedi' });             // C vede (all-in)
  g.azione(g.turno, { tipo: 'vedi' });             // A vede con 50 (all-in)
  while (g.inAttesa && g.fase === 'corsa') g.avanza();
  // tavola 9 5 8 J 6: A ha la scala 5-9, C il tris di 9, B la coppia di re
  assert.strictEqual(g.fiche[0], 150, 'piatto principale (50 × 3) ad A');
  assert.strictEqual(g.fiche[2], 300, 'piatto laterale (150 × 2) a C');
  assert.strictEqual(g.fiche[1], 0);
  console.log('✓ Poker: valutazione delle mani, piatto laterale e scala sul river');
}

// ---- UNO: accumulo e UNO dimenticato ----
fissa('UNO: accumulo e UNO dimenticato');
{
  const U = GIOCHI.uno;
  const g = U.crea({ n: 3, primo: 0 });
  const C = (valore, colore, id) => ({ id, valore, colore });
  g.mani = [[C('+2', 'rosso', 'a'), C('3', 'blu', 'a2')], [C('+4', null, 'b'), C('5', 'verde', 'b2'), C('6', 'verde', 'b3')], [C('+2', 'blu', 'c'), C('7', 'giallo', 'c2')]];
  g.scarti = [C('4', 'rosso', 'z')]; g.colore = 'rosso';
  assert.ok(g.azione(0, { tipo: 'gioca', carte: ['a'], uno: true }).ok);
  assert.strictEqual(g.accumulo, 2);
  assert.ok(g.azione(1, { tipo: 'gioca', carte: ['b2'] }).errore, 'sul +2 serve un +2 o un +4');
  assert.ok(g.azione(1, { tipo: 'gioca', carte: ['b'], colore: 'blu' }).ok, '+4 sopra un +2');
  assert.strictEqual(g.accumulo, 6);
  assert.ok(g.azione(2, { tipo: 'gioca', carte: ['c'] }).errore, 'un +2 non copre un +4');
  g.azione(2, { tipo: 'pesca' });
  assert.ok(g.inAttesa && g.mani[2].length === 3, 'le carte arrivano una alla volta');
  assert.ok(g.azione(2, { tipo: 'pesca' }).errore, 'mentre pesca non si fa altro');
  while (g.inAttesa) g.avanza();
  assert.strictEqual(g.mani[2].length, 8, 'pesca le 6 accumulate');
  assert.strictEqual(g.turno, 0, 'e salta il turno');
  // UNO dimenticato
  const h = U.crea({ n: 2, primo: 0 });
  h.mani[0] = [C('5', 'rosso', 'x'), C('9', 'blu', 'y')]; h.scarti = [C('5', 'verde', 'w')]; h.colore = 'verde';
  h.azione(0, { tipo: 'gioca', carte: ['x'] });
  assert.strictEqual(h.mani[0].length, 3, 'senza UNO: +2 carte');
  // più carte uguali insieme
  const k = U.crea({ n: 2, primo: 0 });
  k.mani[0] = [C('8', 'rosso', 'p'), C('8', 'blu', 'q'), C('2', 'giallo', 'r'), C('1', 'giallo', 's')]; k.scarti = [C('3', 'rosso', 'w')]; k.colore = 'rosso';
  assert.ok(k.azione(0, { tipo: 'gioca', carte: ['p', 'q'] }).ok && k.colore === 'blu', 'due 8 insieme, il colore è quello dell\'ultima');
  // i +2/+4 non sono obbligatori: con solo un +2 giocabile si può pescare, e un +4 pescato si può tenere
  const m = U.crea({ n: 2, primo: 0 });
  m.mani[0] = [C('+2', 'rosso', 'd'), C('9', 'blu', 'e')]; m.scarti = [C('5', 'rosso', 'w')]; m.colore = 'rosso';
  m.mazzo.push(C('+4', null, 'f'), C('8', 'verde', 'g'));
  assert.ok(m.azione(0, { tipo: 'pesca' }).ok, 'si può pescare anche con un +2 giocabile');
  while (m.inAttesa) m.avanza();
  assert.ok(m.mani[0].some((c) => c.id === 'f') && m.pescata === 'f', 'pesca fino al +4 (giocabile)');
  assert.ok(m.azione(0, { tipo: 'tieni' }).ok && m.turno === 1, 'il +4 pescato si può tenere');
  console.log('✓ UNO: +2 su +2/+4, +4 solo su +4, penalità una carta alla volta, +2/+4 facoltativi, UNO dimenticato, carte uguali insieme');
}

// ---- campo minato ----
fissa('campo minato');
{
  const M = GIOCHI.campo;
  for (let k = 0; k < 200; k++) {
    const g = M.crea({ n: 1, opzioni: { difficolta: 'normale' } });
    const primo = Math.floor(Math.random() * g.C * g.R);
    g.azione(0, { tipo: 'apri', cella: primo });
    assert.ok(!g.finita && g.aperteTot >= 1 && g.numeri[primo] === 0, 'il primo clic è sicuro e apre una zona');
    assert.strictEqual(g.mine.reduce((a, b) => a + b, 0), 45);
  }
  // collaborazione: una mina fa perdere tutti; sfida: penalità
  let g = M.crea({ n: 2, opzioni: { difficolta: 'facile', modo: 'coop' } });
  g.azione(0, { tipo: 'apri', cella: 0 });
  const mina = g.mine.indexOf(1);
  g.azione(1, { tipo: 'bandiera', cella: mina });
  assert.ok(g.azione(0, { tipo: 'apri', cella: mina }).ok && !g.finita, 'la bandierina protegge');
  g.azione(0, { tipo: 'bandiera', cella: mina });
  g.azione(0, { tipo: 'apri', cella: mina });
  assert.ok(g.finita && g.risultato.vincitori.length === 0, 'mina in collaborazione: perdono tutti');
  g = M.crea({ n: 2, opzioni: { difficolta: 'facile', modo: 'sfida' } });
  g.azione(0, { tipo: 'apri', cella: 55 });
  const m2 = g.mine.indexOf(1);
  const prima = g.punti[1];
  g.azione(1, { tipo: 'apri', cella: m2 });
  assert.ok(!g.finita && g.punti[1] === prima - 15, 'mina in sfida: −15 e si continua');
  // vittoria: aprendo tutte le caselle sicure
  g = M.crea({ n: 1, opzioni: { difficolta: 'facile' } });
  g.azione(0, { tipo: 'apri', cella: 0 });
  for (let i = 0; i < g.C * g.R; i++) if (!g.mine[i]) g.azione(0, { tipo: 'apri', cella: i });
  assert.ok(g.finita && g.risultato.vincitori[0] === 0 && g.vista().record.length >= 1, 'campo sminato e tempo in classifica');
  // pausa: il cronometro si ferma
  g = M.crea({ n: 1, opzioni: {} });
  g.azione(0, { tipo: 'apri', cella: 0 });
  g.impostaPausa(true);
  const t = g.cronometro();
  assert.ok(g.azione(0, { tipo: 'apri', cella: 5 }).errore, 'in pausa non si gioca');
  const fermo = Date.now(); while (Date.now() - fermo < 30);
  assert.strictEqual(g.cronometro(), t, 'cronometro fermo in pausa');
  console.log('✓ Campo minato: primo clic sicuro, bandierine, collaborazione, sfida, classifica, pausa');
}

// ---- giochi nuovi: impostore, coccodrillo, block blast, peppa tencia, fast west ----
fissa('giochi nuovi: impostore, coccodrillo, block blast, peppa tencia, fast west');
fissa('nuovi'); require('./nuovi');
fissa('serate'); require('./serate');
fissa('migliorie3'); require('./migliorie3');
fissa('giochi2'); require('./giochi2');
fissa('novita'); require('./novita');
fissa('trucco'); require('./trucco');
fissa('fotocamera'); require('./fotocamera');
