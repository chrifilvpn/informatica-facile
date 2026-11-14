// PROVA A PIÙ GIOCATORI DAL TELEFONO: per ogni gioco apre un tavolo con 2-4 telefoni (iPhone in verticale, Android
// piccolo 360 px, iPhone in orizzontale), gli altri entrano col codice, si avvia la partita e tutti toccano "a caso".
// Segnala errori nella pagina, pagina più larga dello schermo e tabellone che finisce sotto il nome/la mano.
//   npm run test:telefono                 tutti i giochi
//   npm run test:telefono -- uno scopone  solo alcuni
// Variabili: SECONDI (default 10), INSIEME (default 2), SHOT=cartella per le schermate, RIQ=1 stampa i riquadri,
// EVAL=espressione da valutare in ogni telefono a partita avviata (per indagare).
const { spawn } = require('child_process');
const path = require('path');
const { chromium, devices } = require('playwright');
const PORTA = 4100 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORTA}`;
const SECONDI = Number(process.env.SECONDI || 10);
const SHOT = process.env.SHOT || '';
const IP = devices['iPhone 13'];
const DISP = [IP, { ...IP, viewport: { width: 360, height: 640 } }, { ...IP, viewport: { width: IP.viewport.height, height: IP.viewport.width } }];
const NOMI_D = ['vert', 'piccolo', 'oriz'];

async function nuovo(browser, d) {
  const ctx = await browser.newContext({ ...DISP[d] });
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', (e) => errori.push(`[${NOMI_D[d]}] errore JS: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/socket|favicon|fonts|ERR_|Failed to load resource/.test(m.text())) errori.push(`[${NOMI_D[d]}] console: ${m.text().slice(0, 200)}`); });
  await p.goto(URL);
  await p.evaluate(() => { Boss.config({ grigia: false }); Boss.disattiva(); });
  await p.fill('#nome-ingresso', `G${d}${Math.random().toString(36).slice(2, 6)}`);
  await p.click('#form-nome button');
  return { ctx, p, errori, d };
}
async function aCaso(g) {
  const { p } = g;
  const r = Math.random();
  if (r < 0.6) {
    const punto = await p.evaluate(() => {
      const vis = (e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && !e.disabled && !e.closest('[hidden]'); };
      const els = [...document.querySelectorAll('#tavolo [data-az], #azioni button, #tavolo .carta.giocabile, #tavolo button')].filter(vis)
        .filter((e) => !/abbandona|arrenditi|esci/.test(e.dataset.az || ''));
      if (!els.length) return null;
      const e = els[Math.floor(Math.random() * els.length)];
      e.scrollIntoView({ block: 'nearest' });
      const q = e.getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    }).catch(() => null);
    if (punto) await p.mouse.click(punto.x, punto.y).catch(() => {});
  } else if (r < 0.7) {
    const campo = await p.$('#tavolo input:not([type=hidden]):not([disabled])');
    if (campo && await campo.isVisible().catch(() => false)) { await campo.fill('ciao1').catch(() => {}); await campo.press('Enter').catch(() => {}); }
  } else {
    const tela = await p.$('#tavolo canvas');
    const q = tela && await tela.boundingBox().catch(() => null);
    if (q) { await p.mouse.move(q.x + q.width * Math.random(), q.y + q.height * Math.random()); await p.mouse.down(); await p.mouse.move(q.x + q.width * Math.random(), q.y + q.height * Math.random(), { steps: 4 }); await p.mouse.up(); }
  }
}
async function prova(browser, id, meta) {
  const quanti = meta.giocatori.includes(3) ? 3 : meta.giocatori.find((n) => n >= 2);
  if (!quanti) return { id, saltato: 'solo 1' };
  const gs = [];
  const errori = [];
  let partita = false;
  try {
    for (let i = 0; i < quanti; i++) gs.push(await nuovo(browser, i % 3));
    const h = gs[0].p;
    await h.waitForSelector(`[data-gioco="${id}"]`, { state: 'attached', timeout: 8000 });
    await h.evaluate((g) => document.querySelector(`[data-gioco="${g}"]`).click(), id);
    await h.waitForTimeout(150);
    const bt = await h.$(`#scelta-posti [data-posti="${quanti}"]`);
    if (bt) await bt.click();
    await h.evaluate(() => document.querySelector('#crea').click());
    await h.waitForSelector('#schermo-attesa:not([hidden])', { timeout: 8000 });
    const codice = (await h.textContent('#codice-grande')).trim().slice(0, 4);
    for (const g of gs.slice(1)) {
      await g.p.fill('#codice', codice);
      await g.p.evaluate(() => document.querySelector('#entra').click());
      await g.p.waitForSelector('#schermo-attesa:not([hidden]), #schermo-gioco:not([hidden])', { timeout: 8000 });
    }
    await h.waitForTimeout(300);
    if (await h.$('#inizia:not([hidden])')) await h.evaluate(() => document.querySelector('#inizia').click());
    for (const g of gs) await g.p.waitForSelector('#schermo-gioco:not([hidden])', { timeout: 8000 });
    partita = true;
    await h.waitForTimeout(800);
    if (process.env.RIQ) for (const g of gs) console.log(NOMI_D[g.d], await g.p.evaluate(() => ['.tavolo', '#panno', '#panno > *', '#mio-nome', '#mano', '#azioni', '#tavolo .pos-alto'].map((s) => { const e = document.querySelector(s); if (!e) return s + ' -'; const q = e.getBoundingClientRect(); return `${s} ${Math.round(q.top)}-${Math.round(q.bottom)} sh${e.scrollHeight} ch${e.clientHeight}`; }).join(' | ')));
    if (process.env.EVAL) for (const g of gs) console.log(NOMI_D[g.d], await g.p.evaluate(process.env.EVAL).catch((e) => e.message));
    if (SHOT) for (const g of gs) await g.p.screenshot({ path: path.join(SHOT, `${id}-${NOMI_D[g.d]}.png`) }).catch(() => {});
    const fine = Date.now() + SECONDI * 1000;
    while (Date.now() < fine) {
      await Promise.all(gs.map((g) => aCaso(g)));
      await h.waitForTimeout(120);
    }
    for (const g of gs) {
      const sov = await g.p.evaluate(() => {
        const q = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.height > 2 && r.width > 2 && getComputedStyle(e).display !== 'none' ? r : null; };
        const pan = q(document.querySelector('#panno'));
        const out = [];
        if (!pan) return out;
        const sotto = ['#mio-nome', '#azioni', '#mano'].map((s) => q(document.querySelector(s))).filter(Boolean);
        const primo = sotto.sort((x, y) => x.top - y.top)[0];
        if (primo && pan.bottom > primo.top + 4) out.push(`tabellone sotto il nome/la mano di ${Math.round(pan.bottom - primo.top)}px`);
        const alto = document.querySelector('#tavolo .pos-alto'), qa = alto && alto.textContent.trim() && q(alto);
        if (qa && qa.bottom > pan.top + 4) out.push(`avversari sopra il tabellone di ${Math.round(qa.bottom - pan.top)}px`);
        return out;
      }).catch(() => []);
      for (const x of sov) errori.push(`[${NOMI_D[g.d]}] ${x}`);
      const vista = DISP[g.d].viewport.width;
      const [largo, interno] = await g.p.evaluate(() => [document.documentElement.scrollWidth - innerWidth, innerWidth]);
      if (largo > 4) errori.push(`[${NOMI_D[g.d]}] la pagina esce di lato di ${largo}px`);
      if (interno > vista + 4 || largo > 4) {
        const chi = await g.p.evaluate((v) => [...document.querySelectorAll('#schermo-gioco *')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.right > v + 2 && !e.closest('[hidden]'); })
          .filter((e) => !e.parentElement || e.parentElement.getBoundingClientRect().right <= v + 2).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}#${e.id}→${Math.round(e.getBoundingClientRect().right)}`).join(', '), vista);
        errori.push(`[${NOMI_D[g.d]}] pagina più larga dello schermo (${interno} su ${vista}) per: ${chi}`);
      }
    }
  } catch (e) { errori.push(`prova interrotta: ${e.message.split('\n')[0]}`); }
  for (const g of gs) { errori.push(...g.errori); await g.ctx.close().catch(() => {}); }
  return { id, quanti, errori: [...new Set(errori)], partita };
}
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORTA), MAX_TAVOLI_PER_IP: '100000', MAX_CONNESSIONI_PER_IP: '100000', ARCHIVIO_CARTELLA: path.join(require('os').tmpdir(), `if-multi-${PORTA}`) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
  for (let k = 0; k < 50 && !/in ascolto/.test(log); k++) await new Promise((r) => setTimeout(r, 200));
  const { GIOCHI } = require('../giochi');
  const scelti = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GIOCHI);
  const browser = await chromium.launch();
  const INSIEME = Number(process.env.INSIEME || 2);
  const ris = [];
  for (let i = 0; i < scelti.length; i += INSIEME) {
    const r = await Promise.all(scelti.slice(i, i + INSIEME).map((id) => prova(browser, id, GIOCHI[id].meta)));
    for (const x of r) console.log(`${x.errori && x.errori.length ? '✗' : '·'} ${x.id}${x.saltato ? ' saltato' : ''}${x.errori && x.errori.length ? ': ' + x.errori.join(' · ') : ''}`);
    ris.push(...r);
  }
  await browser.close(); server.kill();
  const dal = log.split('\n').filter((l) => /rifiutata|errore|Error/.test(l) && !/fantasIA|avviso/.test(l));
  for (const l of [...new Set(dal)].slice(0, 40)) console.log(`✗ server: ${l}`);
  console.log(`fine: ${ris.filter((r) => r.errori && r.errori.length).length} giochi con problemi su ${ris.length}`);
  process.exit(0);
})();
