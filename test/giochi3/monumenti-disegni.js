// Test dei DISEGNI DEI MONUMENTI (quiz "Dove si trova?"): ogni disegno è di un monumento che esiste nei dati, è un
// SVG pulito (niente script, niente link esterni, tag bilanciati) e arriva al browser nella domanda della partita.
const assert = require('assert');
const { MONUMENTI } = require('../../giochi2/monumenti-dati');
const { DISEGNI_MONUMENTI: D } = require('../../giochi2/monumenti-disegni');
const { GIOCHI } = require('../../giochi');

const nomi = new Set(MONUMENTI.map((m) => m.nome));
assert.ok(Object.keys(D).length >= 20, 'almeno 20 disegni');
for (const [nome, svg] of Object.entries(D)) {
  assert.ok(nomi.has(nome), `${nome}: non è tra i monumenti`);
  assert.ok(!/<script|on\w+=|href|NaN|undefined/i.test(svg), `${nome}: SVG non pulito`);
  for (const tag of ['g', 'svg']) assert.strictEqual((svg.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (svg.match(new RegExp(`</${tag}>`, 'g')) || []).length, `${nome}: <${tag}> non chiuso`);
}
// nella partita: la domanda porta il disegno quando c'è (e l'emoji resta come riserva)
const g = GIOCHI.monumenti.crea({ n: 1, opzioni: {} });
let visti = 0;
for (let k = 0; k < 400 && visti < 3; k++) {
  const e = g.banca.elementi[k % g.banca.elementi.length];
  if (e.disegno) { visti++; assert.ok(e.icona, 'emoji di riserva'); }
}
assert.ok(visti >= 3, 'i monumenti hanno il disegno');
const v = g.vista(0);
assert.ok('disegno' in v, 'la vista manda il disegno');
console.log(`ok monumenti-disegni (${Object.keys(D).length} disegni)`);
