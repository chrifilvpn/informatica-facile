// ASSO PIGLIATUTTO: il tavolo della scopa (stessa scelta delle prese) con le carte napoletane disegnate in SVG.
// Gli assi in mano hanno un bagliore dorato quando possono pigliare tutto; sopra la tavola si vede quanti assi sono
// già usciti. Le carte usano gli stessi stili delle napoletane del Sette e mezzo (classi sm-…).
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const S = window.Tavoli.scopa; // scelta della presa toccando le carte in tavola: come nella scopa

  // ---------- carte napoletane ----------
  const NOMI_SEMI = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
  const NOMI_RANGHI = { 1: 'Asso', 8: 'Fante', 9: 'Cavallo', 10: 'Re' };
  const SIGLE = { 8: 'F', 9: 'C', 10: 'R' };
  const ORDINE_SEMI = ['d', 'c', 's', 'b'];
  const nomeCarta = (c) => `${NOMI_RANGHI[c.rango] || c.rango} di ${NOMI_SEMI[c.seme]}`;
  const SIMBOLI = {
    d: '<circle cx="50" cy="50" r="42" fill="#e3b437" stroke="#8a6410" stroke-width="5"/><circle cx="50" cy="50" r="29" fill="none" stroke="#8a6410" stroke-width="3"/><path d="M50 28 L56 44 L72 50 L56 56 L50 72 L44 56 L28 50 L44 44 Z" fill="#b5322a" stroke="#8a6410" stroke-width="2"/><circle cx="50" cy="50" r="5" fill="#f6e3a1"/>',
    c: '<path d="M18 16 H82 C82 44 70 58 50 60 C30 58 18 44 18 16 Z" fill="#c8362c" stroke="#7a1b14" stroke-width="4"/><path d="M18 16 H82" stroke="#e3b437" stroke-width="7" stroke-linecap="round"/><path d="M44 60 H56 V76 H44 Z" fill="#e3b437" stroke="#8a6410" stroke-width="3"/><path d="M28 88 C30 78 70 78 72 88 Z" fill="#e3b437" stroke="#8a6410" stroke-width="3"/><path d="M30 30 C33 42 40 48 46 50" stroke="#f3a097" stroke-width="4" fill="none" stroke-linecap="round"/>',
    s: '<path d="M50 4 L59 18 V66 H41 V18 Z" fill="#cfe0f5" stroke="#2b5a9e" stroke-width="4" stroke-linejoin="round"/><path d="M50 14 V62" stroke="#7fa6d8" stroke-width="3"/><path d="M24 66 H76 V74 H24 Z" fill="#e3b437" stroke="#8a6410" stroke-width="3"/><path d="M45 74 H55 V92 H45 Z" fill="#2b5a9e"/><circle cx="50" cy="94" r="5" fill="#e3b437" stroke="#8a6410" stroke-width="2"/>',
    b: '<path d="M36 92 C34 70 44 40 58 10 C62 4 72 6 70 14 C62 40 54 70 52 92 Z" fill="#a8743a" stroke="#5d3a14" stroke-width="4" stroke-linejoin="round"/><path d="M48 60 L36 54 M54 38 L66 32 M44 78 L56 74" stroke="#5d3a14" stroke-width="4" stroke-linecap="round"/><path d="M58 10 C60 6 66 4 69 8" stroke="#3f8f3a" stroke-width="6" fill="none" stroke-linecap="round"/>',
  };
  function definisciSimboli() {
    if (document.getElementById('sm-simboli')) return; // già definiti (anche dal Sette e mezzo)
    const d = document.createElement('div');
    d.innerHTML = `<svg id="sm-simboli" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(SIMBOLI).map(([s, x]) => `<symbol id="sm-${s}" viewBox="0 0 100 100">${x}</symbol>`).join('')}</svg>`;
    document.body.append(d.firstChild);
  }
  const seme = (s, cls = '') => `<svg class="sm-seme ${cls}" aria-hidden="true"><use href="#sm-${s}"/></svg>`;
  const POS = {
    1: [[50, 50]], 2: [[50, 26], [50, 74]], 3: [[50, 20], [50, 50], [50, 80]], 4: [[30, 26], [70, 26], [30, 74], [70, 74]],
    5: [[30, 22], [70, 22], [50, 50], [30, 78], [70, 78]], 6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
    7: [[30, 18], [70, 18], [50, 34], [30, 52], [70, 52], [30, 82], [70, 82]],
  };
  const FIGURE = {
    8: '<circle cx="50" cy="26" r="12" fill="#f2c9a0" stroke="#3b2a1a" stroke-width="2.5"/><path d="M38 20 Q50 6 62 20 Z" fill="#7a3fa0"/><path d="M30 92 L36 46 Q50 38 64 46 L70 92 Z" fill="currentColor" opacity=".85"/><path d="M36 46 Q50 56 64 46" stroke="#e3b437" stroke-width="3" fill="none"/>',
    9: '<path d="M22 90 L28 60 Q30 42 46 36 L54 18 Q60 12 66 18 L74 34 Q80 42 74 46 L66 44 L62 56 Q72 64 74 90 Z" fill="#8a5a2b" stroke="#3b2a1a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="64" cy="26" r="2.6" fill="#1b130b"/><path d="M50 22 Q44 30 46 38" stroke="#3b2a1a" stroke-width="4" fill="none"/>',
    10: '<path d="M34 22 L38 8 L45 18 L50 6 L55 18 L62 8 L66 22 Z" fill="#e3b437" stroke="#8a6410" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="34" r="12" fill="#f2c9a0" stroke="#3b2a1a" stroke-width="2.5"/><path d="M40 40 Q50 52 60 40 L58 48 Q50 54 42 48 Z" fill="#d9d2c4"/><path d="M28 94 L34 52 Q50 44 66 52 L72 94 Z" fill="currentColor" opacity=".85"/><path d="M34 52 Q50 62 66 52" stroke="#e3b437" stroke-width="3" fill="none"/>',
  };
  // stessa firma di Carte.fronte: (carta, classi, attributi)
  function F(c, cls = '', attr = '') {
    definisciSimboli();
    const sigla = SIGLE[c.rango] || c.rango;
    const centro = c.rango <= 7
      ? `<div class="sm-pip ${c.rango === 1 ? 'asso' : ''}">${POS[c.rango].map(([x, y]) => `<span style="left:${x}%;top:${y}%">${seme(c.seme)}</span>`).join('')}</div>`
      : `<div class="sm-figura"><svg class="sm-fig-disegno" viewBox="18 2 64 96" aria-hidden="true">${FIGURE[c.rango]}</svg>${seme(c.seme, 'sm-fig-seme')}</div>`;
    const bello = c.id === '7d' ? '<span class="ap-bello" title="Settebello">★</span>' : '';
    return `<div class="carta sm-carta sm-${c.seme} ${c.rango === 1 ? 'ap-asso' : ''} ${cls}" data-id="${esc(c.id)}" title="${nomeCarta(c)}" ${attr}>
      <span class="sm-indice"><b>${sigla}</b>${seme(c.seme)}</span>${centro}${bello}</div>`;
  }

  // la mano: per valore (asso, 2 … re) oppure per seme; la scelta resta per le partite successive
  let perSeme = false;
  try { perSeme = localStorage.getItem('ap-ordine') === 'seme'; } catch { /* niente */ }
  const ordina = (cs) => [...cs].sort((a, b) => (perSeme
    ? ORDINE_SEMI.indexOf(a.seme) - ORDINE_SEMI.indexOf(b.seme) || a.rango - b.rango
    : a.rango - b.rango || ORDINE_SEMI.indexOf(a.seme) - ORDINE_SEMI.indexOf(b.seme)));
  const plur = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
  const nomeF = (ctx, posti) => (ctx.partita.aSquadre ? (posti.includes(ctx.mio) ? 'Voi' : 'Loro') : posti[0] === ctx.mio ? 'Tu' : ctx.nome(posti[0]));

  const tavolo = {
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const compatibili = ui.scelta ? ui.scelta.opzioni.filter((o) => ui.scelta.sel.every((x) => o.includes(x))) : [];
      const sel = new Set(compatibili.flat());
      const carte = ordina(p.tavolo).map((c) => {
        let cls = '';
        if (p.inCorso && p.inCorso.presa.includes(c.id)) cls = 'presa';
        else if (sel.has(c.id)) cls = ui.scelta.sel.includes(c.id) ? 'scelta' : 'selezionabile';
        return F(c, cls, sel.has(c.id) ? 'data-az="tavola" role="button" tabindex="0"' : '');
      });
      const tutto = p.inCorso && p.inCorso.carta.rango === 1 && p.inCorso.presa.length > 1;
      if (p.inCorso) carte.push(F(p.inCorso.carta, `appena da-${ctx.slot(p.inCorso.posto)} ${tutto ? 'ap-piglia' : ''}`));
      const vuota = !carte.length ? '<p class="tavola-vuota">Tavola vuota</p>' : '';
      const mazzo = p.mazzo ? `<div class="mazzo-mini" title="Carte nel mazzo">${Carte.retro('ap-retro')}<span>${p.mazzo}</span></div>` : '';
      const assi = Array.from({ length: 4 }, (_, i) => `<i class="${i < p.assiUsciti ? 'uscito' : ''}"></i>`).join('');
      const info = `<div class="ap-info" title="Assi già giocati in questa smazzata"><span class="ap-assi">${assi}</span> assi usciti: <b>${p.assiUsciti}/4</b></div>`;
      return `${mazzo}${info}<div class="tavola-carte ${tutto ? 'ap-tutta' : ''}">${carte.join('')}${vuota}</div>`;
    },
    mano(ctx) {
      const p = ctx.partita, attiva = !!p.opzioni;
      return ordina(p.mano).map((c) => {
        const op = attiva && p.opzioni[c.id];
        const tuttoIl = attiva && c.rango === 1 && op && op.length === 1 && op[0].length > 1;
        const cls = [attiva ? 'giocabile' : '', ctx.ui.scelta && ctx.ui.scelta.carta === c.id ? 'alzata' : '', op && op.length ? 'prende' : '', tuttoIl ? 'ap-pronto' : ''].join(' ');
        return F(c, cls, attiva ? `data-az="mano" role="button" tabindex="0" aria-label="Gioca ${nomeCarta(c)}${tuttoIl ? ' (piglia tutto)' : ''}"` : '');
      }).join('');
    },
    azioni(ctx) {
      if (ctx.ui.scelta) return S.azioni(ctx);
      return ctx.partita.mano.length > 1 ? `<button class="bottone piccolo-bt" data-az="ordina" title="Cambia l'ordine delle carte in mano">↕ Ordina per ${perSeme ? 'valore' : 'seme'}</button>` : '';
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita, f = p.aSquadre ? posto % 2 : posto, s = p.scope[f];
      const bello = p.settebello === f ? ' <span class="ap-mini-bello" title="Ha il settebello">★7</span>' : '';
      return `${plur(p.preseCarte[f], 'carta presa', 'carte prese')} · ${p.preseDenari[f]} den.${bello}${s ? `, <b class="scope">${plur(s, 'scopa', 'scope')}</b>` : ''}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      const regole = [p.assoSuAsso === 'tutto' ? 'asso prende sempre tutto' : '', p.scopaAsso ? 'pigliatutto = scopa' : '', p.conNapola ? 'napola' : ''].filter(Boolean).join(', ');
      return p.totali.map((t, f) => `<span>${esc(nomeF(ctx, p.aSquadre ? [f, f + 2] : [f]))} <b>${t}</b></span>`).join('')
        + `<span class="obiettivo">si vince a ${p.obiettivo}${regole ? ` · ${regole}` : ''}</span>`;
    },
    riepilogo(ctx) {
      const p = ctx.partita, r = p.riepilogo;
      if (!r) return null;
      const riga = (titolo, chiave, fmt) => `<tr><th>${titolo}</th>${r.righe.map((x, f) => `<td class="${r.assegnati[chiave] === f ? 'vinto' : ''}">${fmt(x)}</td>`).join('')}</tr>`;
      return `<h2>Fine smazzata ${r.smazzata}</h2>
        <div class="tabella-scorre"><table class="conti">
          <thead><tr><th></th>${r.righe.map((x) => `<th>${esc(nomeF(ctx, x.posti))}</th>`).join('')}</tr></thead>
          <tbody>
            ${riga('Carte', 'carte', (x) => x.carte)}
            ${riga('Denari', 'denari', (x) => x.denari)}
            ${riga('Settebello', 'settebello', (x) => (x.settebello ? 'sì' : ''))}
            ${riga('Primiera', 'primiera', (x) => x.primiera || '–')}
            ${r.napola ? `<tr><th>Napola</th>${r.righe.map((x) => `<td class="${x.napola ? 'vinto' : ''}">${x.napola || ''}</td>`).join('')}</tr>` : ''}
            <tr><th>Scope</th>${r.righe.map((x) => `<td class="${x.scope ? 'vinto' : ''}">${x.scope}</td>`).join('')}</tr>
            <tr class="somma"><th>Punti fatti</th>${r.righe.map((x) => `<td>${x.punti}</td>`).join('')}</tr>
            <tr class="somma"><th>Totale</th>${r.righe.map((x) => `<td>${x.totale}</td>`).join('')}</tr>
          </tbody></table></div>
        ${r.avanzo ? `<p class="piccolo">Le ${r.avanzo} carte rimaste in tavola sono andate a ${r.ultimaPresa === ctx.mio ? 'te' : esc(ctx.nome(r.ultimaPresa))}.</p>` : ''}`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (ctx.ui.scelta) return 'Scegli le carte da prendere';
      if (p.turno === ctx.mio && p.opzioni && p.mano.some((c) => c.rango === 1 && p.opzioni[c.id] && p.opzioni[c.id][0] && p.opzioni[c.id][0].length > 1)) return 'Tocca a te · il tuo asso piglia tutto!';
      return null;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.inCorso && p.inCorso.carta.rango === 1 && p.inCorso.presa.length > 1 && primaVolta(ctx.ui, `ap-tutto-${p.mazzo}-${p.inCorso.carta.id}`)) {
        suono([[392, 0.06], [523, 0.06], [659, 0.06], [784, 0.14]], { volume: 0.05 });
      }
    },
    clic(ctx, el) {
      if (el.dataset.az === 'ordina') {
        perSeme = !perSeme;
        try { localStorage.setItem('ap-ordine', perSeme ? 'seme' : 'valore'); } catch { /* niente */ }
        return ctx.ridisegna();
      }
      return S.clic(ctx, el);
    },
    reset: S.reset,
  };
  Object.assign(window.Tavoli, { assopiglia: tavolo });
})();
