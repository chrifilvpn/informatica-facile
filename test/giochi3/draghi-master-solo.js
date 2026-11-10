// DRAGHI E SEGRETE: l'unica persona fa il master e i compagni sono tutti del computer. Prima, al primo racconto del
// master, il gioco non trovava «personaggi dei giocatori» vivi e dichiarava tutti morti con la compagnia in piedi.
const assert = require('assert');
const G = require('../../giochi3/draghi');

const g = G.crea({ n: 3, bot: [null, 'medio', 'medio'], opzioni: {} });
g.chiave = '';
assert.ok(!g.azione(0, { tipo: 'dm-scegli', posto: 0 }).errore, 'chi ha aperto il tavolo fa il master');
assert.ok(!g.azione(0, { tipo: 'inizia' }).errore, 'il master fa partire: i compagni li crea il computer');
assert.ok(!g.pg[0] && g.pg[1] && g.pg[2], 'personaggi solo per i compagni del computer');
assert.strictEqual(g.umaniVivi().length, 2, 'senza personaggi di persone contano i compagni');
assert.ok(!g.azione(0, { tipo: 'dm-rispondi', risposta: { narrazione: 'La compagnia arriva al villaggio.' } }).errore);
assert.notStrictEqual(g.fase, 'caduti', 'il racconto del master non uccide la compagnia');
assert.ok(!g.finita);
// se muoiono davvero tutti, allora sì
g.pg[1].morto = true; g.pg[2].morto = true;
assert.strictEqual(g.umaniVivi().length, 0);
// con un personaggio di una persona, i soli compagni vivi non bastano (come prima)
const h = G.crea({ n: 2, bot: [null, 'medio'], opzioni: {} });
h.chiave = '';
h.azione(0, { tipo: 'crea', casuale: true, scelte: {} });
h.azione(0, { tipo: 'inizia' });
h.pg[0].morto = true;
assert.strictEqual(h.umaniVivi().length, 0, 'morto il personaggio della persona, il compagno da solo non conta');
console.log('✓ Draghi e Segrete: master umano con soli compagni del computer');
