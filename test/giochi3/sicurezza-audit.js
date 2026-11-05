// AUDIT DI SICUREZZA (31/10/2026): controlli delle falle trovate e chiuse.
// - valori "constructor", "toString"… ripuliti dai dati del browser (pescavano funzioni di Object.prototype)
// - Serpenti: una direzione "constructor" bloccava il gioco per tutti a ogni tick
// - Backgammon: un passo vuoto nella sequenza faceva cadere la mossa con un errore
// - voce narrante: ?v=constructor faceva credere al server che Edge fosse giù (voce spenta per tutti)
// - archivio: chi riempie l'archivio di "sfida già fatta" non può più far sparire le classifiche
// - mosse e tick di tutti i giochi con dati strani: nessun errore e nessuna vista rotta
const assert = require('assert');
process.env.TEST_VELOCE = process.env.TEST_VELOCE || '1';
const S = require('../../sicurezza');
const { GIOCHI, pulisciOpzioni } = require('../../giochi');

// ---- pulisciDato: niente nomi di Object.prototype come valori ----
{
  const stato = { sospetto: false };
  const d = S.pulisciDato({ dir: 'constructor', a: ['toString', 'su'], b: { c: '__proto__', e: 'valueOf' }, f: 'hasOwnProperty' }, 0, stato);
  assert.deepStrictEqual(d, { dir: '', a: ['', 'su'], b: { c: '', e: '' }, f: '' });
  assert.ok(stato.sospetto, 'segnalato alla guardia');
  assert.strictEqual(S.pulisciDato('ciao'), 'ciao');
  assert.strictEqual(S.pulisciDato('costruttore'), 'costruttore', 'le parole normali restano');
  assert.ok(S.LIMITI_EVENTI.boss && S.LIMITI_EVENTI.boss[0] <= 1, 'le dispense non si aprono a raffica');
}

// ---- Serpenti: direzioni strane non entrano nella coda dei comandi ----
{
  const mod = GIOCHI.snake;
  const g = mod.crea({ n: 2, primo: 0, opzioni: pulisciOpzioni('snake', {}), fiche: [1000, 1000], bot: [null, null] });
  for (const dir of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) g.input(0, { dir });
  assert.strictEqual(g.serpenti[0].coda.length, 0, 'nessuna direzione finta in coda');
  for (let k = 0; k < 50; k++) g.tick(Date.now() + 10000 + k * 200); // non lancia
}

// ---- Backgammon: sequenza con passi vuoti ----
{
  const mod = GIOCHI.backgammon;
  const g = mod.crea({ n: 2, primo: 0, opzioni: pulisciOpzioni('backgammon', {}), fiche: [1000, 1000], bot: [null, null] });
  const t = g.turno != null ? g.turno : 0;
  const r = g.azione(t, { tipo: 'gioca', passi: [undefined, null, 3] });
  assert.ok(r && r.errore, 'mossa rifiutata senza errori');
}

// ---- voce: solo le voci dell'elenco ----
(async () => {
  const { Voce } = require('../../voce');
  let chiamate = 0;
  const v = new Voce({ chiedi: async () => { chiamate++; return Buffer.from('mp3'); } });
  for (const nome of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const r = await v.leggi('ciao', nome, '1.2.3.4');
    assert.strictEqual(r.stato, 400, `voce ${nome} rifiutata`);
  }
  assert.strictEqual(chiamate, 0, 'Edge non viene chiamato');
  assert.ok((await v.leggi('ciao', 'diego', '1.2.3.4')).audio, 'la voce vera funziona');
})().catch((e) => { console.error(e); process.exit(1); });

// ---- archivio: le classifiche restano anche con l'archivio pieno ----
{
  const A = require('../../archivio');
  const prima = new Map(A._dati);
  A._dati.clear();
  A.scrivi('sfida:2026-10-31:quiz', [{ nome: 'Ada', valore: 9 }]);
  for (let i = 0; i < 6000; i++) A.scrivi(`sfidaFatta:2026-10-31:quiz:id${i}`, 1);
  assert.ok(A.leggi('sfida:2026-10-31:quiz'), 'la classifica non è stata buttata');
  A._dati.clear();
  for (const [k, x] of prima) A._dati.set(k, x);
}

// ---- tutti i giochi: mosse e comandi con dati strani (come arrivano dopo pulisciDato) ----
{
  const STRANI = [-1, 1e9, 0.5, '', 'x', [], [1, 2], {}, true, '0', 'A'.repeat(300), 'constructor', 'toString'];
  let seme = 7; const rnd = () => ((seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const errori = [];
  for (const [id, mod] of Object.entries(GIOCHI)) {
    const n = mod.meta.giocatori[mod.meta.giocatori.length - 1];
    const g = mod.crea({ n, primo: 0, opzioni: pulisciOpzioni(id, {}), fiche: new Array(n).fill(1000), bot: new Array(n).fill(null) });
    for (let k = 0; k < 60 && !g.finita; k++) {
      const p = g.turno != null ? g.turno : Math.floor(rnd() * n);
      const a = S.pulisciDato({ tipo: pick(['gioca', 'punta', 'mossa', 'passa', 'gioca', pick(STRANI)]), carta: pick(STRANI), cella: pick(STRANI), x: pick(STRANI), y: pick(STRANI), passi: [pick(STRANI)], importo: pick(STRANI), dir: pick(STRANI) });
      try { if (typeof g.azione === 'function') g.azione(p, a); } catch (e) { errori.push(`${id} azione: ${e.message}`); break; }
      try { if (g.input) g.input(p, S.pulisciDato({ dir: pick(STRANI), tasto: pick(STRANI), x: pick(STRANI), y: pick(STRANI), tipo: pick(STRANI) })); } catch (e) { errori.push(`${id} input: ${e.message}`); break; }
      try { if (g.tick) g.tick(Date.now() + k * 100); } catch (e) { errori.push(`${id} tick: ${e.message}`); break; }
      try { for (let q = 0; q < n; q++) { JSON.stringify(g.vista(q)); if (g.vistaTick) JSON.stringify(g.vistaTick(q)); } } catch (e) { errori.push(`${id} vista: ${e.message}`); break; }
      if (g.ficheDi) for (let q = 0; q < n; q++) { const f = g.ficheDi(q); if (!Number.isFinite(f) || f < 0) errori.push(`${id}: fiche ${f}`); }
    }
  }
  assert.deepStrictEqual(errori, [], errori.join('\n'));
}

// ---- fantasIA: limite di domande per indirizzo ----
{
  const { FantasIA } = require('../../fantasia');
  let t = Date.parse('2026-11-05T10:00:00Z');
  const f = new FantasIA({ chiave: 'k', fetch: async () => ({}), ora: () => t, attesaMs: 0, maxInsieme: 99, limiteIp: 3, limiteIpFidato: 5 });
  for (let k = 0; k < 3; k++) assert.ok(f.prenota('1.1.1.1', 'ciao').ok);
  assert.ok(f.prenota('1.1.1.1', 'ciao').errore, 'oltre il limite per indirizzo');
  assert.ok(f.prenota('2.2.2.2', 'ciao').ok, 'gli altri indirizzi possono ancora');
  for (let k = 0; k < 5; k++) assert.ok(f.prenota('3.3.3.3', 'ciao', { fidato: true }).ok, 'a scuola di più');
  assert.ok(f.prenota('3.3.3.3', 'ciao', { fidato: true }).errore);
  t += 24 * 3600000;
  assert.ok(f.prenota('1.1.1.1', 'ciao').ok, 'il giorno dopo si riparte');
}

// ---- sfida del giorno: il primo tentativo conta anche per dispositivo ----
{
  const sfida = require('../../sfida');
  const A = require('../../archivio');
  const prima = new Map(A._dati);
  const gioco = Object.keys(sfida.SFIDE)[0], data = '2026-11-05';
  A.scrivi(`sfidaFatta:${data}:${gioco}:d:disp1`, 1);
  assert.ok(sfida.giaFatta(data, gioco, 'browser-nuovo', 'disp1'), 'stesso dispositivo, browser pulito: già fatta');
  assert.ok(!sfida.giaFatta(data, gioco, 'browser-nuovo', 'disp2'), 'altro dispositivo: no');
  assert.ok(!sfida.giaFatta(data, gioco, 'browser-nuovo', null), 'senza impronta (IP fidati): solo il browser');
  A._dati.clear();
  for (const [k, x] of prima) A._dati.set(k, x);
}

console.log('✓ Audit di sicurezza: valori di Object.prototype ripuliti, Serpenti, Backgammon, voce, archivio, mosse strane in tutti i giochi, limite di fantasIA per indirizzo, sfida del giorno per dispositivo');
