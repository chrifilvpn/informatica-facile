// Test di LUPUS IN FABULA: i ruoli in base ai giocatori, chi vede che cosa (lupi tra loro, Veggente, fantasmi), la
// notte (branco, Veggente, Guardia che salva, notte minima), il giorno (pronti al voto, voto palese, ballottaggio,
// nessun condannato), il Cacciatore, il Medium, la chat (di notte solo i lupi, i fantasmi tra loro) e tante partite
// complete tra computer con l'orologio finto.
const assert = require('assert');
const { GIOCHI } = require('../../giochi');

const M = GIOCHI.lupus;
const { componi, quantiLupi, NOTTE_MIN_MS, MAX_NOTTI } = M._test;
assert.ok(M && M.bot, 'Lupus in fabula registrato, con il computer');
assert.strictEqual(M.meta.categoria, 'parole', 'nella categoria Parole e party');

const veroNow = Date.now;
let ora = veroNow();
Date.now = () => ora;
const passa = (ms) => { ora += ms; };

// ---- i ruoli ----
assert.strictEqual(quantiLupi(5, 'auto'), 1); assert.strictEqual(quantiLupi(8, 'auto'), 2); assert.strictEqual(quantiLupi(12, 'auto'), 3);
assert.strictEqual(quantiLupi(5, 3), 1, 'mai troppi lupi');
for (let n = 5; n <= 12; n++) {
  for (const ruoli of ['tutti', 'base']) for (const rivela of ['si', 'no']) {
    const r = componi(n, { lupi: 'auto', ruoli, rivela });
    assert.strictEqual(r.length, n);
    assert.strictEqual(r.filter((x) => x === 'lupo').length, quantiLupi(n, 'auto'));
    assert.strictEqual(r.filter((x) => x === 'veggente').length, 1, 'sempre una Veggente');
    assert.strictEqual(r.includes('guardia'), n >= 6);
    assert.strictEqual(r.includes('medium'), ruoli === 'tutti' && rivela === 'no' && n >= 8, 'il Medium solo con le carte segrete');
    assert.strictEqual(r.includes('cacciatore'), ruoli === 'tutti' && n >= 7);
  }
}
console.log('✓ Lupus: i ruoli giusti da 5 a 12 giocatori (lupi, Veggente, Guardia, Cacciatore, Medium, Indemoniato)');

// una partita con i ruoli decisi da noi
function partita(ruoli, opzioni = {}) {
  const g = M.crea({ n: ruoli.length, opzioni, bot: new Array(ruoli.length).fill(null) });
  g.ruoli = [...ruoli];
  g.diario = ruoli.map(() => []);
  g.nomiGiocatori = ['Ada', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gino', 'Ivo'].slice(0, ruoli.length);
  assert.ok(g.inAttesa && g.fase === 'ruoli');
  g.avanza();
  return g;
}
const ok = (r) => assert.ok(r && r.ok, r && r.errore);

// ---- notte e giorno, passo per passo ----
{
  //            0       1       2           3          4            5            6
  const g = partita(['lupo', 'lupo', 'veggente', 'guardia', 'contadino', 'cacciatore', 'contadino']);
  assert.strictEqual(g.fase, 'notte'); assert.strictEqual(g.notteN, 1);
  // prima notte tranquilla: agisce solo la Veggente
  assert.deepStrictEqual(g.attesi(), [2]);
  // chi vede che cosa
  const v0 = g.vista(0), v4 = g.vista(4);
  assert.deepStrictEqual(v0.ruoli.map((x) => x === 'lupo'), [true, true, false, false, false, false, false], 'i lupi si vedono tra loro');
  assert.deepStrictEqual(v4.ruoli.filter(Boolean), ['contadino'], 'un contadino vede solo la sua carta');
  assert.ok(v0.diario.some((d) => d.testo.includes('@1')), 'il lupo sa chi è il compagno');
  assert.ok(g.azione(4, { tipo: 'notte', posto: 0 }).errore, 'di notte il contadino dorme');
  assert.ok(g.azione(2, { tipo: 'notte', posto: 2 }).errore, 'la Veggente non scruta sé stessa');
  ok(g.azione(2, { tipo: 'notte', posto: 1 }));
  assert.ok(g.vista(2).diario.some((d) => /@1 è un LUPO/.test(d.testo)), 'la Veggente scopre il lupo');
  assert.strictEqual(g.fase, 'notte', 'la notte dura almeno il minimo');
  assert.ok(g.scadenza() <= ora + NOTTE_MIN_MS);
  passa(NOTTE_MIN_MS); assert.ok(g.controllaTempo());
  assert.ok(g.inAttesa && g.fase === 'alba' && g.vivi.every(Boolean), 'prima notte: nessun morto');
  g.avanza();
  assert.strictEqual(g.fase, 'giorno');
  // la chat di giorno: si nomina qualcuno e diventa più sospetto
  const prima = g.sospetto[1];
  assert.deepStrictEqual(g.leggiChat(2, 'secondo me Bruno è un lupo'), {});
  assert.ok(g.sospetto[1] > prima, 'chi viene accusato in chat è più sospetto');
  // pronti al voto: tutti → si vota
  for (let p = 0; p < 7; p++) ok(g.azione(p, { tipo: 'pronto' }));
  assert.strictEqual(g.fase, 'voto');
  ok(g.azione(0, { tipo: 'vota', posto: 4 }));
  assert.ok(g.azione(1, { tipo: 'vota', posto: 1 }).errore, 'non si vota sé stessi');
  assert.deepStrictEqual(g.vista(5).voti.slice(0, 2), [4, -2], 'il voto è palese');
  ok(g.azione(0, { tipo: 'vota', posto: 2 })); // cambia idea
  // pareggio 3 a 3 tra 1 e 4 → ballottaggio
  for (const [p, k] of [[1, 4], [2, 1], [3, 1], [5, 1], [6, 4]]) ok(g.azione(p, { tipo: 'vota', posto: k }));
  ok(g.azione(4, { tipo: 'vota', posto: null }));
  // 1: tre voti (2,3,5); 4: due (1,6); 2: uno (0) → condannato 1
  assert.ok(g.inAttesa && g.fase === 'condanna' && g.condannato === 1 && !g.vivi[1]);
  assert.ok(g.racconto.some((r) => /Era un lupo/.test(r.testo)), 'la carta del condannato si scopre');
  g.avanza();
  // notte 2: lupo 0 caccia la Veggente, la Guardia la protegge
  assert.strictEqual(g.fase, 'notte'); assert.strictEqual(g.notteN, 2);
  assert.deepStrictEqual(g.attesi().sort(), [0, 2, 3]);
  assert.ok(g.azione(0, { tipo: 'notte', posto: 1 }).errore, 'i morti non si sbranano');
  ok(g.azione(0, { tipo: 'notte', posto: 2 }));
  assert.ok(g.azione(3, { tipo: 'notte', posto: 3 }).errore, 'la Guardia non protegge sé stessa');
  ok(g.azione(3, { tipo: 'notte', posto: 2 }));
  ok(g.azione(2, { tipo: 'notte', posto: 4 }));
  passa(NOTTE_MIN_MS); g.controllaTempo();
  assert.ok(g.vivi[2], 'la Guardia ha salvato la Veggente');
  assert.ok(g.vista(3).diario.some((d) => /Hai salvato @2/.test(d.testo)));
  g.avanza();
  // giorno 2: nessuno vota → nessun condannato
  for (let p = 0; p < 7; p++) if (g.vivi[p]) ok(g.azione(p, { tipo: 'pronto' }));
  for (let p = 0; p < 7; p++) if (g.vivi[p]) ok(g.azione(p, { tipo: 'vota', posto: null }));
  assert.ok(g.fase === 'condanna' && g.condannato === null && g.racconto.some((r) => /nessuno viene condannato/.test(r.testo)));
  g.avanza();
  // notte 3: la Guardia non può riproteggere la Veggente; i lupi uccidono il Cacciatore, che spara al lupo
  assert.ok(g.azione(3, { tipo: 'notte', posto: 2 }).errore, 'non la stessa persona due notti di fila');
  ok(g.azione(3, { tipo: 'notte', posto: 4 }));
  ok(g.azione(0, { tipo: 'notte', posto: 5 }));
  ok(g.azione(2, { tipo: 'notte', posto: 0 }));
  passa(NOTTE_MIN_MS); g.controllaTempo();
  assert.ok(!g.vivi[5]); g.avanza();
  assert.strictEqual(g.fase, 'cacciatore'); assert.strictEqual(g.turno, 5);
  assert.ok(g.azione(4, { tipo: 'spara', posto: 0 }).errore, 'spara solo il Cacciatore');
  ok(g.azione(5, { tipo: 'spara', posto: 0 }));
  assert.ok(!g.vivi[0] && g.inAttesa); g.avanza();
  assert.ok(g.inAttesa && g.fase === 'finale' && g.esito === 'villaggio', 'morti tutti i lupi: vince il villaggio');
  g.avanza();
  assert.ok(g.finita);
  assert.deepStrictEqual(g.risultato.vincitori, [2, 3, 4, 5, 6]);
  assert.deepStrictEqual(g.vista(4).ruoli, g.ruoli, 'alla fine si vedono tutte le carte');
  console.log('✓ Lupus: notte (Veggente, Guardia che salva, notte minima), giorno, voto palese, nessun condannato, Cacciatore, vittoria del villaggio');
}

// ---- ballottaggio, lupi che vincono, chat, Medium ----
{
  const g = partita(['lupo', 'contadino', 'contadino', 'medium', 'veggente'], { rivela: 'no', primaNotte: 'caccia' });
  assert.deepStrictEqual(g.attesi().sort(), [0, 4], 'si caccia dalla prima notte');
  // chat di notte
  assert.ok(g.leggiChat(1, 'ciao').nascondi, 'di notte il villaggio non scrive');
  assert.deepStrictEqual(g.leggiChat(0, 'chi mangiamo?').soloPer, [0], 'i lupi parlano tra loro');
  ok(g.azione(0, { tipo: 'notte', posto: 1 }));
  ok(g.azione(4, { tipo: 'notte', posto: 2 }));
  passa(NOTTE_MIN_MS); g.controllaTempo();
  assert.ok(!g.vivi[1] && !g.racconto.some((r) => /Era/.test(r.testo)), 'carte segrete: il ruolo del morto non si dice');
  assert.strictEqual(g.vista(2).ruoli[1], null);
  assert.deepStrictEqual(g.vista(1).ruoli, g.ruoli, 'il fantasma vede tutte le carte');
  assert.deepStrictEqual(g.leggiChat(1, 'buuu').soloPer, [1], 'i fantasmi parlano solo tra fantasmi');
  g.avanza();
  passa(200000); g.controllaTempo(); // la discussione finisce col tempo
  assert.strictEqual(g.fase, 'voto');
  ok(g.azione(0, { tipo: 'vota', posto: 2 })); ok(g.azione(2, { tipo: 'vota', posto: 0 }));
  ok(g.azione(3, { tipo: 'vota', posto: 2 })); ok(g.azione(4, { tipo: 'vota', posto: 0 }));
  assert.ok(g.ballottaggio && g.fase === 'voto' && g.candidati.join() === '0,2', 'pareggio → ballottaggio');
  assert.ok(g.azione(3, { tipo: 'vota', posto: 4 }).errore, 'al ballottaggio solo tra i più votati');
  ok(g.azione(0, { tipo: 'vota', posto: 2 })); ok(g.azione(3, { tipo: 'vota', posto: 2 }));
  passa(61000); g.controllaTempo(); // chi non vota si astiene
  assert.ok(!g.vivi[2] && g.condannato === 2);
  g.avanza();
  assert.ok(g.vista(3).diario.some((d) => /@2.*non era un lupo/.test(d.testo)), 'il Medium scopre il condannato');
  ok(g.azione(0, { tipo: 'notte', posto: 4 }));
  ok(g.azione(4, { tipo: 'notte', posto: 0 }));
  passa(NOTTE_MIN_MS); g.controllaTempo(); g.avanza();
  assert.ok(g.fase === 'finale' && g.esito === 'lupi', '1 lupo contro 1: vincono i lupi');
  g.avanza();
  assert.deepStrictEqual(g.risultato.vincitori, [0]);
  console.log('✓ Lupus: ballottaggio, carte segrete col Medium, chat di notte (solo lupi) e dei fantasmi, vittoria dei lupi');
}

// ---- !win ----
{
  const g = partita(['lupo', 'contadino', 'veggente', 'guardia', 'contadino']);
  assert.ok(/Veggente è Carla/.test(g.suggerimentoWin(0)) && /Guardia è Dario/.test(g.suggerimentoWin(0)));
  assert.ok(/lupo è Ada/.test(g.suggerimentoWin(1)));
}

// ---- partite complete tra computer ----
{
  let vinteV = 0, vinteL = 0, notti = 0, frasi = 0, partite = 0;
  for (let n = 5; n <= 12; n++) {
    for (let k = 0; k < 40; k++) {
      const livelli = ['facile', 'medio', 'difficile'];
      const opzioni = { rivela: k % 3 ? 'si' : 'no', ruoli: k % 4 ? 'tutti' : 'base', primaNotte: k % 5 ? 'tranquilla' : 'caccia', lupi: 'auto', discussione: 120 };
      const g = M.crea({ n, opzioni, bot: new Array(n).fill('medio') });
      g.nomiGiocatori = Array.from({ length: n }, (_, i) => `Bot${i}`);
      const liv = (p) => livelli[(p + k) % 3];
      let passi = 0;
      while (!g.finita) {
        assert.ok(++passi < 5000, `Lupus in ${n} non finisce`);
        if (g.inAttesa) { g.avanza(); continue; }
        const chi = g.turno != null ? [g.turno] : g.attesi();
        if (!chi.length) { passa(5000); assert.ok(g.scadenza() != null, `fase ${g.fase} senza scadenza e senza nessuno atteso`); g.controllaTempo(); continue; }
        for (const p of chi) {
          if (g.finita || g.inAttesa) break;
          const a = M.bot(g, p, liv(p));
          if (!a) continue;
          const r = g.azione(p, a);
          assert.ok(!r.errore, `mossa del computer rifiutata (${g.fase}, ${g.ruoli[p]}): ${r.errore}`);
        }
        frasi += g.chatDa.splice(0).length;
        for (let q = 0; q < n; q++) JSON.stringify(g.vista(q));
      }
      partite++; notti += g.notteN;
      if (g.esito === 'villaggio') vinteV++; else vinteL++;
      assert.ok(g.notteN <= MAX_NOTTI + 1);
      // i vincitori sono coerenti con l'esito
      for (const v of g.risultato.vincitori) assert.strictEqual(g.squadraLupi(v), g.esito !== 'villaggio');
    }
  }
  assert.ok(vinteV > partite * 0.15 && vinteL > partite * 0.15, `partite equilibrate (villaggio ${vinteV}, lupi ${vinteL})`);
  assert.ok(frasi > partite, 'i computer parlano in chat');
  console.log(`✓ Lupus: ${partite} partite tra computer da 5 a 12 senza errori (villaggio ${vinteV}, lupi ${vinteL}, in media ${(notti / partite).toFixed(1)} notti, ${frasi} frasi in chat)`);
}

Date.now = veroNow;
