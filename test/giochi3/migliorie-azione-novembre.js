// MIGLIORIE dei giochi d'azione e Squid Game (novembre 2026): righe del Tetris animate, punti del round in corso di
// Caselle colorate, conto alla rovescia di Monete in salita dopo il primo arrivato, mini classifica a fine round.
const assert = require('assert');
process.env.TEST_VELOCE = process.env.TEST_VELOCE || '1';
const fs = require('fs');
const path = require('path');
const { GIOCHI } = require('../../giochi');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

// ---- Tetris: le righe tolte arrivano al browser (tabellone di prima e quali righe) per mezzo secondo ----
{
  const g = GIOCHI.tetris.crea({ n: 1, opzioni: {}, bot: [null] });
  const b = g.tab[0];
  const { W, H } = GIOCHI.tetris._test;
  // l'ultima riga piena tranne le colonne 3-6: un pezzo I sdraiato la completa
  b.g.fill(0);
  for (let x = 0; x < W; x++) if (x < 3 || x > 6) b.g[(H - 1) * W + x] = 2;
  b.t = 'I'; b.r = 0; b.x = 3; b.y = b.fantasma();
  b.blocca();
  assert.strictEqual(b.righe, 1, 'riga tolta');
  const v = g.vistaTick(0).t[0];
  assert.ok(v.lp && v.lp.y.length === 1 && v.lp.y[0] === H - 1, 'il browser sa quale riga è sparita');
  assert.strictEqual(v.lp.g.length, W * H, 'e com\'era il tabellone prima');
  b.lampo.quando -= 600;
  assert.ok(!g.vistaTick(0).t[0].lp, 'dopo mezzo secondo non si manda più');
}

// ---- Caselle colorate: i punti provvisori del round (un punto per ogni caduto prima di te) ----
{
  const g = GIOCHI.arcobaleno.crea({ n: 3, opzioni: { round: 1 }, bot: [null, null, null] });
  g.ordine = [2];
  g.e[2].fuori = true;
  assert.deepStrictEqual(g.statoTick().pr, [1, 1, 0], 'chi è in piedi ha un punto per ogni caduto');
}

// ---- Monete in salita: dopo il primo arrivato gli altri hanno 15 secondi ----
{
  const M = GIOCHI.monete, { LUNGHEZZA } = M._test;
  const g = M.crea({ n: 2, opzioni: { round: 1 }, bot: [null, null] });
  g.fase = 'gioco';
  g.cam = -LUNGHEZZA - 40;
  const tieni = () => { g.ostacoli = []; Object.assign(g.e[1], { x: 500, y: g.cam + 300, vx: 0, vy: 0 }); };
  tieni();
  Object.assign(g.e[0], { x: 500, y: -LUNGHEZZA - 5, vx: 0, vy: 0 });
  assert.ok(!g.passo(0.02), 'il primo arriva: il round non finisce subito');
  assert.deepStrictEqual(g.arrivi, [0]);
  assert.ok(/15 secondi/.test(g.evento.testo), 'lo si dice a tutti');
  let t = 0, finito = false;
  while (!finito && t < 30) { tieni(); g.tempoRound += 0.05; t += 0.05; finito = g.passo(0.05); assert.ok(finito || g.statoTick().cd > 0); }
  assert.ok(finito && t > 14.8 && t < 15.2, `il round finisce dopo 15 secondi (${t.toFixed(2)})`);
  assert.ok(M.meta.regole.some((r) => /15 secondi/.test(r)), 'le regole lo dicono');
}

// ---- Fine round dei giochi d'azione: mini classifica del round al posto di «Punti totali» ----
{
  const js = leggi('public/js/giochi/arena.js');
  assert.ok(/classificaRound/.test(js), 'arena.js disegna la classifica del round');
}
console.log('✓ Migliorie azione (novembre): righe del Tetris animate, punti del round di Caselle colorate, 15 secondi dopo il primo in Monete in salita, classifica di fine round');
