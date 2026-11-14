// PROVA NEL BROWSER: apre il sito in un browser vero (Chromium, con Playwright), sia come telefono sia come computer,
// e per ogni gioco avvia una partita contro il computer e gioca "a caso" per qualche secondo (tocca i pulsanti, preme
// i tasti, trascina sul campo). Controlla che non ci siano errori nella pagina e che niente esca dallo schermo.
//   npm run test:browser                 tutti i giochi, telefono e computer
//   npm run test:browser -- tris uno     solo alcuni giochi
// Variabili: SECONDI (default 12), INSIEME (partite in parallelo, default 4), SOLO=telefono|orizzontale|computer.
// Serve Playwright con Chromium (npm i -D playwright && npx playwright install chromium); se manca, il test lo
// dice e finisce senza errori (così "npm test" su Render non si ferma).
const { spawn, execSync } = require('child_process');
const path = require('path');

function trovaPlaywright() {
  for (const tentativo of [() => require('playwright'), () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))]) {
    try { return tentativo(); } catch { /* prova il prossimo */ }
  }
  return null;
}
const pw = trovaPlaywright();
if (!pw) { console.log('test:browser saltato: manca Playwright (npm i -D playwright && npx playwright install chromium)'); process.exit(0); }
const { chromium, devices } = pw;

const PORTA = 3900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORTA}`;
const SECONDI = Number(process.env.SECONDI || 12);
const INSIEME = Number(process.env.INSIEME || 4);
const DISPOSITIVI = { telefono: devices['iPhone 13'], computer: devices['Desktop Chrome'],
  orizzontale: { ...devices['iPhone 13'], viewport: { width: devices['iPhone 13'].viewport.height, height: devices['iPhone 13'].viewport.width } } };
const TASTI = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'Enter', '1', '2', '3'];

async function gioca(browser, id, nomeDisp) {
  const ctx = await browser.newContext({ ...DISPOSITIVI[nomeDisp] });
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', (e) => errori.push(`errore JS: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/socket|favicon|fonts|ERR_/.test(m.text())) errori.push(`console: ${m.text()}`); });
  let partita = false;
  try {
    await p.goto(URL);
    await p.evaluate(() => { Boss.config({ grigia: false }); Boss.disattiva(); });
    await p.fill('#nome-ingresso', `T${Math.random().toString(36).slice(2, 8)}`);
    await p.click('#form-nome button');
    await p.waitForSelector(`[data-gioco="${id}"]`, { state: 'attached', timeout: 8000 }); // l'elenco arriva dopo il nome (con tante prove insieme può tardare)
    await p.evaluate((g) => document.querySelector(`[data-gioco="${g}"]`).click(), id);
    await p.waitForTimeout(150);
    // giochi solo tra persone: si prova da soli (se si può)
    if (await p.evaluate(() => document.querySelector('#strada-computer').hidden)) {
      const uno = await p.$('#scelta-posti [data-posti="1"]');
      if (!uno) { await ctx.close(); return { id, nomeDisp, saltato: 'solo tra persone' }; }
      await uno.click();
    }
    await p.evaluate(() => document.querySelector('#gioca-solo').click());
    await p.waitForSelector('#schermo-gioco:not([hidden])', { timeout: 8000 });
    partita = true;
    const fine = Date.now() + SECONDI * 1000;
    while (Date.now() < fine) {
      if (await p.$('#fine:not([hidden])')) break;
      const r = Math.random();
      if (r < 0.55) {
        const punto = await p.evaluate(() => {
          const vis = (e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && !e.disabled && !e.closest('[hidden]'); };
          const els = [...document.querySelectorAll('#tavolo [data-az], #azioni button, #tavolo .carta.giocabile, #tavolo button')].filter(vis)
            .filter((e) => !/abbandona|arrenditi|esci/.test(e.dataset.az || ''));
          if (!els.length) return null;
          const e = els[Math.floor(Math.random() * els.length)];
          e.scrollIntoView({ block: 'nearest' });
          const q = e.getBoundingClientRect();
          return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
        });
        if (punto) await p.mouse.click(punto.x, punto.y).catch(() => {});
      } else if (r < 0.65) {
        const campo = await p.$('#tavolo input:not([type=hidden]):not([disabled])');
        if (campo && await campo.isVisible()) { await campo.fill('ciao1').catch(() => {}); await campo.press('Enter').catch(() => {}); }
      } else if (r < 0.85) {
        const k = TASTI[Math.floor(Math.random() * TASTI.length)];
        await p.keyboard.down(k); await p.waitForTimeout(60 + Math.random() * 200); await p.keyboard.up(k);
      } else {
        const tela = await p.$('#tavolo canvas');
        const q = tela && await tela.boundingBox();
        if (q) { await p.mouse.move(q.x + q.width * Math.random(), q.y + q.height * Math.random()); await p.mouse.down(); await p.mouse.move(q.x + q.width * Math.random(), q.y + q.height * Math.random(), { steps: 4 }); await p.mouse.up(); }
      }
      await p.waitForTimeout(110);
    }
    // il tabellone non deve finire sotto il nome o la mano (succedeva sul telefono in orizzontale)
    const sotto = await p.evaluate(() => {
      const q = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.height > 2 && r.width > 2 && getComputedStyle(e).display !== 'none' ? r : null; };
      const pan = q(document.querySelector('#panno'));
      const primo = ['#mio-nome', '#azioni', '#mano'].map((s) => q(document.querySelector(s))).filter(Boolean).sort((x, y) => x.top - y.top)[0];
      return pan && primo && pan.bottom > primo.top + 4 ? Math.round(pan.bottom - primo.top) : 0;
    }).catch(() => 0);
    if (sotto) errori.push(`il tabellone finisce sotto il nome/la mano di ${sotto} pixel`);
    // niente deve uscire di lato dallo schermo
    const largo = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (largo > 4) errori.push(`la pagina esce di lato di ${largo} pixel`);
    // sul telefono una pagina più larga dello schermo fa rimpicciolire tutto (innerWidth cresce invece di scorrere)
    const vista = DISPOSITIVI[nomeDisp].viewport.width, interno = await p.evaluate(() => innerWidth);
    if (interno > vista + 4) errori.push(`la pagina è più larga dello schermo (${interno} invece di ${vista}): il telefono la rimpicciolisce`);
  } catch (e) { errori.push(`prova interrotta: ${e.message.split('\n')[0]}`); }
  await ctx.close();
  return { id, nomeDisp, errori: [...new Set(errori)], partita };
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORTA), MAX_TAVOLI_PER_IP: '100000', MAX_CONNESSIONI_PER_IP: '100000', ARCHIVIO_CARTELLA: path.join(require('os').tmpdir(), `if-prova-${PORTA}`) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logServer = '';
  server.stdout.on('data', (d) => { logServer += d; }); server.stderr.on('data', (d) => { logServer += d; });
  for (let k = 0; k < 50 && !/in ascolto/.test(logServer); k++) await new Promise((r) => setTimeout(r, 200));
  const { GIOCHI } = require('../giochi');
  const scelti = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GIOCHI);
  const disp = process.env.SOLO ? [process.env.SOLO] : ['telefono', 'orizzontale', 'computer'];
  const lavori = scelti.flatMap((id) => disp.map((d) => [id, d]));
  const browser = await chromium.launch();
  const risultati = [];
  for (let i = 0; i < lavori.length; i += INSIEME) {
    risultati.push(...await Promise.all(lavori.slice(i, i + INSIEME).map(([id, d]) => gioca(browser, id, d))));
    process.stdout.write(`\r${Math.min(i + INSIEME, lavori.length)}/${lavori.length} partite provate`);
  }
  console.log('');
  await browser.close();
  server.kill();
  const problemi = risultati.filter((r) => r.errori && r.errori.length);
  // errori del server durante le prove (mosse del computer rifiutate, eccezioni)
  const dalServer = logServer.split('\n').filter((l) => /rifiutata|errore|Error/.test(l) && !/fantasIA|avviso/.test(l));
  for (const r of problemi) console.log(`✗ ${r.id} (${r.nomeDisp}): ${r.errori.join(' · ')}`);
  for (const l of [...new Set(dalServer)].slice(0, 20)) console.log(`✗ server: ${l}`);
  const saltati = risultati.filter((r) => r.saltato).map((r) => r.id);
  console.log(`${problemi.length || dalServer.length ? '✗' : '✓'} Prova nel browser: ${risultati.length - saltati.length} partite (telefono e computer)${saltati.length ? `, saltati perché solo tra persone: ${[...new Set(saltati)].join(', ')}` : ''}`);
  process.exit(problemi.length || dalServer.length ? 1 : 0);
})();
