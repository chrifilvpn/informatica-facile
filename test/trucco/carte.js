// IL TRUCCO SEGRETO (!win + parola segreta) nei giochi di carte: controlli precisi gioco per gioco
const assert = require('assert');
process.env.TEST_VELOCE = '1';
const T = require('../../giochi/trucco');
const { GIOCHI } = require('../../giochi');
const { valore40 } = require('../../giochi/carte');

const crea = (id, n, opzioni = {}) => {
  const mod = GIOCHI[id], opz = {};
  for (const o of mod.meta.opzioni) opz[o.id] = o.predefinito;
  return mod.crea({ n, primo: 0, opzioni: { ...opz, ...opzioni }, bot: Array.from({ length: n }, () => 'medio') });
};
// il suggerimento segreto che arriva al posto p (e il trucco si spegne)
const suggerimento = (g, p = 0) => { T.controllaSuggerimenti(g); const s = T.prendiSussurri(g).filter((m) => m.posto === p); return s.length ? s[0].testo : null; };
// tutte le carte ci sono, una volta sola
const senzaDoppioni = (carte, quante, nome) => {
  const ids = carte.map((c) => (typeof c === 'string' ? c : c.id));
  assert.strictEqual(ids.length, quante, `${nome}: ${ids.length} carte invece di ${quante}`);
  assert.strictEqual(new Set(ids).size, quante, `${nome}: carte doppie`);
};

for (let giro = 0; giro < 20; giro++) {
  // ---- BRISCOLA: alla prossima pescata arriva la briscola più alta rimasta nel mazzo ----
  {
    const g = crea('briscola', 2);
    T.arma(g, 0);
    const B = g.briscola.seme, F = GIOCHI.briscola._test.forza;
    const alte = g.mazzo.filter((c) => c.seme === B && c !== g.briscola).sort((a, b) => F(b) - F(a));
    for (let k = 0; k < 2; k++) g.azione(g.turno, { tipo: 'gioca', carta: g.mani[g.turno][0].id });
    const prima = g.mani[0].slice();
    g.avanza();
    // (se prende l'avversario pesca prima lui, e la più alta può toccare a lui: allora al posto 0 va la seconda)
    const presa = g.mani[0].find((c) => !prima.includes(c));
    const restano = g.mazzo.filter((c) => c.seme === B && c !== g.briscola);
    if (alte.length > 1) assert.ok(presa.seme === B && restano.every((c) => F(c) < F(presa)), 'briscola: pesca la briscola più alta');
    assert.ok(!T.armato(g, 0));
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.prese.flat()], 40, 'briscola');
    // a mazzo finito: il consiglio della carta da giocare (quella del computer difficile)
    const h = crea('briscola', 2);
    h.mazzo = []; T.arma(h, 0);
    const s = suggerimento(h);
    assert.ok(/^💡 Gioca /.test(s), 'briscola: consiglio a fine mazzo');
  }

  // ---- SCOPA: nella mano data c'è la carta che fa scopa e il settebello ----
  {
    const g = crea('scopa', 2);
    const tutte = () => [...g.mazzo, ...g.mani.flat(), ...g.tavolo, ...g.prese.flat()];
    for (const m of g.mani) g.mazzo.unshift(...m.splice(0));
    T.arma(g, 0);
    g.distribuisci(3);
    senzaDoppioni(tutte(), 40, 'scopa');
    const P = require('../../giochi/scopa')._test.presePossibili;
    const somma = g.tavolo.reduce((s, c) => s + valore40(c), 0);
    const visibile = new Set(g.tavolo.map((c) => c.id));
    if (somma <= 10 && !g.tavolo.some((c) => valore40(c) === somma)) assert.ok(g.mani[0].some((c) => P(c, g.tavolo, false).some((o) => o.length === g.tavolo.length)), 'scopa: c\'è la carta che fa scopa');
    if (!visibile.has('7q')) assert.ok(g.mani[0].some((c) => c.id === '7q'), 'scopa: settebello in mano');
    assert.strictEqual(g.mani[0].length, 3);
  }
  // ---- SCOPONE: settebello e tutti i 7 in mano (presi agli avversari) ----
  {
    const g = crea('scopone', 4);
    T.arma(g, 0);
    g.nuovaSmazzata();
    senzaDoppioni(g.mani.flat(), 40, 'scopone');
    assert.ok(g.mani.every((m) => m.length === 10));
    assert.strictEqual(g.mani[0].filter((c) => c.rango === 7).length, 4, 'scopone: i quattro 7');
  }

  // ---- RUBAMAZZO: la carta per rubare il mazzetto più grosso ----
  {
    const g = crea('rubamazzo', 3);
    for (const m of g.mani) g.mazzo.unshift(...m.splice(0));
    const cima = g.mazzo.splice(0, 1)[0];
    g.mazzetti[2] = [cima];
    T.arma(g, 0);
    g.distribuisci();
    assert.ok(g.mani[0].some((c) => valore40(c) === valore40(cima)), 'rubamazzo: può rubare il mazzetto');
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.tavolo, ...g.mazzetti.flat()], 40, 'rubamazzo');
  }

  // ---- CIRULLA: decino in mano (+10 scope al suo turno) ----
  {
    const g = crea('cirulla', 2);
    T.arma(g, 0);
    g.nuovaSmazzata();
    const vs = g.mani[0].filter((c) => c.id !== GIOCHI.cirulla._test.MATTA).map(valore40);
    assert.ok(new Set(vs).size === 1 && vs.length === 3, `cirulla: tre carte uguali (${g.mani[0].map((c) => c.id)})`);
    assert.strictEqual(GIOCHI.cirulla._test.accuso(g.mani[0]).tipo, 'decino');
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.tavolo, ...g.prese.flat()], 40, 'cirulla');
  }

  // ---- ASSO PIGLIATUTTO: asso e settebello ----
  {
    const g = crea('assopiglia', 2);
    T.arma(g, 0);
    g.nuovaSmazzata();
    assert.ok(g.mani[0].some((c) => c.rango === 1) && (g.tavolo.some((c) => c.id === '7d') || g.mani[0].some((c) => c.id === '7d')), 'assopiglia: asso e settebello');
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.tavolo], 40, 'assopiglia');
  }

  // ---- SCALA 40: si pesca una carta che serve alla mano (non per forza un jolly) ----
  {
    const { candidati, migliore } = GIOCHI.scala40._test;
    const C = (id) => (id[0] === 'X' ? { id, jolly: true, rango: 0, seme: null } : { id, rango: Number(id.slice(0, -1)), seme: id.slice(-1) });
    // mano con 8c 9c e tre carte sciolte: deve uscire 7c o 10c (chiude la scala), non il jolly
    for (let volta = 0; volta < 5; volta++) {
      const h = crea('scala40', 2), q = h.turno;
      const tutte = [...h.mazzo, ...h.mani.flat(), ...h.pozzo];
      const mano = ['8c', '9c', '2q', '5f', '12p'].map((id) => tutte.find((c) => c.id === id) || C(id));
      const ids = new Set(mano.map((c) => c.id));
      h.mazzo = tutte.filter((c) => !ids.has(c.id) && !h.pozzo.includes(c));
      h.mani[q] = mano;
      h.mani[1 - q] = h.mazzo.splice(0, 13);
      T.arma(h, q);
      h.azione(q, { tipo: 'pesca', da: 'mazzo' });
      const presa = h.mani[q][h.mani[q].length - 1];
      assert.ok(!presa.jolly && presa.seme === 'c' && [7, 10].includes(presa.rango), `scala 40: !win dà una carta utile, non ${presa.id}`);
    }
    const g = crea('scala40', 2);
    const p = g.turno;
    const prima = migliore(candidati(g.mani[p]), g.mani[p].length).punti;
    T.arma(g, p);
    g.azione(p, { tipo: 'pesca', da: 'mazzo' });
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.pozzo], 108, 'scala 40');
    assert.ok(migliore(candidati(g.mani[p]), g.mani[p].length).punti >= prima, 'scala 40: !win non peggiora la mano');
  }
  {
    const g = crea('burraco', 2);
    const p = g.turno;
    T.arma(g, p);
    g.azione(p, { tipo: 'pesca', da: 'tallone' });
    if ([...g.tallone, g.mani[p][g.mani[p].length - 1]].some((c) => c.jolly)) assert.ok(g.mani[p][g.mani[p].length - 1].jolly, 'burraco: pesca un jolly');
    senzaDoppioni([...g.tallone, ...g.mani.flat(), ...g.scarti, ...g.pozzetti.flat()], 108, 'burraco');
  }

  // ---- UNO: subito un +4, un jolly e un +2 al posto delle carte scomode ----
  {
    const g = crea('uno', 3);
    T.arma(g, 1);
    const nelMazzo = ['+4', 'jolly', '+2'].filter((v) => g.mazzo.some((c) => c.valore === v));
    const normali = g.mani[1].filter((c) => !['+4', 'jolly', '+2'].includes(c.valore)).length;
    g.trucco(1);
    assert.ok(!T.armato(g, 1));
    if (normali >= 3) for (const v of nelMazzo) assert.ok(g.mani[1].some((c) => c.valore === v), `uno: ${v} in mano`);
    assert.strictEqual(g.mani[1].length, 7);
    senzaDoppioni([...g.mazzo, ...g.mani.flat(), ...g.scarti], 108, 'uno');
  }

  // ---- PEPPA: la carta pescata fa coppia (dal mazzo e dalla mano di un avversario) ----
  {
    const g = crea('peppa', 2);
    const p = g.turno;
    T.arma(g, p);
    const prima = g.punti[p];
    const si = g.mazzo.some((c) => c !== 'peppa' && g.mani[p].some((x) => x !== 'peppa' && x.split('-')[0] === c.split('-')[0]));
    g.azione(p, { tipo: 'pesca', da: 'mazzo' });
    if (si) assert.strictEqual(g.punti[p], prima + 1, 'peppa: coppia dal mazzo');
    else assert.notStrictEqual(g.mani[p][g.mani[p].length - 1], 'peppa', 'peppa: almeno non la Peppa');
    const h = crea('peppa', 2), q = h.turno;
    h.mazzo = [];
    h.mani[1 - q].push('peppa');
    h.mani[1 - q] = h.mani[1 - q].filter((c, i, a) => a.indexOf(c) === i);
    if (h.mani[q].length && h.mani[q].some((c) => c !== 'peppa' && h.mani[1 - q].some((x) => x.split('-')[0] === c.split('-')[0]))) {
      T.arma(h, q);
      const i = h.mani[1 - q].indexOf('peppa'), pr = h.punti[q];
      h.azione(q, { tipo: 'pesca', da: 1 - q, indice: i });
      assert.strictEqual(h.punti[q], pr + 1, 'peppa: niente Peppa, coppia dall\'avversario');
    }
  }

  // ---- DUBITO: sa se l'ultima giocata è una bugia; al round dopo, mano di sole carte giuste ----
  {
    const g = crea('dubito', 3);
    const p = g.turno, q = (p + 1) % 3;
    const buona = GIOCHI.dubito._test.buona;
    const c = g.mani[p][0];
    g.azione(p, { tipo: 'gioca', carte: [c.id] });
    T.arma(g, q);
    const s = suggerimento(g, q);
    assert.strictEqual(s, buona(c, g.carta) ? '💡 Dice la verità: non dubitare' : '💡 Sta mentendo: di\' DUBITO!');
    const h = crea('dubito', 3);
    T.arma(h, 0);
    h.nuovoRound(1);
    assert.ok(h.mani[0].every((x) => buona(x, h.carta)), 'dubito: solo carte giuste');
  }

  // ---- FLIP 7: per tutto il round solo numeri nuovi, poi il trucco si spegne ----
  {
    const g = crea('flip7', 2);
    T.arma(g, 0);
    const prima = g.g[0].numeri.length; // la prima carta è già stata data
    let guardia = 0;
    while (!g.finita && g.nRound === 1 && guardia++ < 200) {
      if (g.inAttesa) break;
      const p = g.turno;
      if (p == null) break;
      const a = p === 0 && !g.pendente ? { tipo: 'pesca' } : GIOCHI.flip7.bot(g, p, 'medio');
      g.azione(p, a);
      assert.notStrictEqual(g.g[0].stato, 'sballato', 'flip7: col trucco non si sballa');
    }
    assert.ok(g.riepilogo && g.riepilogo.round === 1);
    // (se l'hanno congelato prima che pescasse, il trucco resta per il round dopo)
    if (g.riepilogo.righe[0].numeri.length > prima) assert.ok(!T.armato(g, 0), 'flip7: finito il round il trucco è spento');
  }

  // ---- CUCÙ: al giro dopo arriva un re ----
  {
    const g = crea('cucu', 3);
    T.arma(g, 2);
    g.nuovoGiro();
    assert.strictEqual(g.originali[2].rango, 13, 'cucù: re in mano');
    assert.strictEqual(new Set(g.originali.filter(Boolean).map((c) => c.id)).size, 3);
  }

  // ---- TRESSETTE: napoletana, assi e tre; in due la pescata è la carta più forte ----
  {
    const g = crea('tressette', 2);
    T.arma(g, 0);
    g.nuovaSmazzata();
    const m = g.mani[0];
    assert.ok(['c', 'q', 'f', 'p'].some((s) => [1, 2, 3].every((r) => m.some((c) => c.rango === r && c.seme === s))), 'tressette: napoletana');
    assert.ok(g.accusiMano[0].some((a) => a.tipo === 'napoletana'), 'tressette: l\'accuso c\'è');
    senzaDoppioni([...g.mazzo, ...g.mani.flat()], 40, 'tressette');
  }

  // ---- BRISCOLA CHIAMATA: asso, tre, re e donna dello stesso seme ----
  {
    const g = crea('chiamata', 5);
    T.arma(g, 3);
    g.nuovaSmazzata();
    const m = g.mani[3];
    assert.ok(['c', 'q', 'f', 'p'].some((s) => [1, 3, 13, 12].every((r) => m.some((c) => c.rango === r && c.seme === s))), 'chiamata: mano da chiamante');
    assert.ok(g.mani.every((x) => x.length === 8));
    senzaDoppioni(g.mani.flat(), 40, 'chiamata');
  }
}

// ---- MACHIAVELLI: al suo turno la mossa che cala più carte; senza mosse, la pescata utile ----
{
  let visti = 0;
  for (let k = 0; k < 30 && visti < 3; k++) {
    const g = crea('machiavelli', 2);
    T.arma(g, g.turno);
    const s = suggerimento(g, g.turno);
    if (s) { visti++; assert.ok(/^💡 Cala \d+ cart/.test(s), s); } else {
      const p = g.turno, n = g.mani[p].length;
      g.azione(p, { tipo: 'pesca' });
      assert.strictEqual(g.mani[p].length, n + 1);
      assert.ok(!T.armato(g, p));
    }
  }
  assert.ok(visti > 0, 'machiavelli: arriva il consiglio');
}

// ---- MEMORY: la coppia indicata è davvero una coppia ----
{
  const g = crea('memory', 2);
  T.arma(g, 0);
  const s = suggerimento(g);
  const [a, b] = [...s.matchAll(/riga (\d+), colonna (\d+)/g)].map((x) => (Number(x[1]) - 1) * 6 + Number(x[2]) - 1);
  assert.strictEqual(g.carte[a], g.carte[b], 'memory: coppia giusta');
  g.azione(0, { tipo: 'gira', carta: a });
  T.arma(g, 0);
  const s2 = suggerimento(g);
  const [c] = [...s2.matchAll(/riga (\d+), colonna (\d+)/g)].map((x) => (Number(x[1]) - 1) * 6 + Number(x[2]) - 1);
  assert.strictEqual(c, b, 'memory: la gemella');
}

// ---- UOMO NERO: la carta indicata fa coppia, l'uomo nero è dove dice ----
{
  for (let k = 0; k < 10; k++) {
    const g = crea('uomonero', 3);
    if (g.turno == null) continue;
    const p = g.turno, da = g.daChi(p);
    T.arma(g, p);
    const s = suggerimento(g, p);
    assert.ok(s && s.startsWith('💡 '));
    const pesca = s.match(/Pesca la (\d+)ª/), uomo = s.match(/uomo nero è la (\d+)ª/);
    const chiave = GIOCHI.uomonero._test.chiave;
    if (pesca) assert.ok(g.mani[p].some((c) => chiave(c) === chiave(g.mani[da][pesca[1] - 1])));
    if (uomo) assert.strictEqual(g.mani[da][uomo[1] - 1].id, '11p');
  }
}

// ---- SOLITARIO, FREECELL, PIRAMIDE: la prossima mossa giusta ----
{
  const g = crea('solitario', 1);
  T.arma(g, 0);
  const s = suggerimento(g);
  assert.ok(/^💡 /.test(s), 'solitario: suggerimento');
  assert.strictEqual(s, GIOCHI.solitario._test.consiglioWin(g.tavoli[0]));

  const f = crea('freecell', 1);
  T.arma(f, 0);
  const { descriviMossa, applica, copia } = GIOCHI.freecell._test;
  assert.strictEqual(suggerimento(f), descriviMossa(f.tavole[0].s, f.soluzione[0]));
  assert.strictEqual(applica(copia(f.tavole[0].s), f.soluzione[0]), null, 'freecell: mossa legale');

  const pi = crea('piramide', 1);
  T.arma(pi, 0);
  const sp = suggerimento(pi);
  assert.strictEqual(sp, GIOCHI.piramide._test.descriviMossa(pi.pir, pi.tal, pi.tavole[0], pi.soluzione[0]));
  const m = pi.soluzione[0];
  assert.ok(pi.azione(0, m).ok, 'piramide: mossa legale');
}

// ---- FAST WEST (niente computer): quando mancano solo le sue carte sa chi gli spara e cosa giocare ----
{
  const g = crea('fastwest', 2);
  for (const x of g.g) { x.pistolero = 'sceriffo'; x.pallottole = 2; }
  g.carta = { id: 'x', dir: 'destra', evento: 'salsola' };
  T.arma(g, 0);
  assert.strictEqual(suggerimento(g), null, 'fast west: finché gli altri non hanno scelto, niente');
  g.azione(1, { tipo: 'gioca', carta: 'revolver' });
  assert.strictEqual(suggerimento(g), '💡 Ti spara chi hai a destra (Revolver): gioca Schivata');
  const h = crea('fastwest', 3);
  h.carta = { id: 'x', dir: 'destra', evento: 'salsola' };
  T.arma(h, 0);
  h.azione(1, { tipo: 'gioca', carta: 'ricarica-1' });
  h.azione(2, { tipo: 'gioca', carta: 'ricarica-1' });
  assert.ok(/^💡 Nessuno ti spara/.test(suggerimento(h)));
  assert.ok(!T.armato(h, 0));
}

console.log('✓ Trucco segreto nei giochi di carte: briscola alta, scopa e settebello, decino, jolly, +4, coppie, re, napoletana, bugie scoperte, mosse giuste dei solitari, chi spara a Fast West');
