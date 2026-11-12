// KAKURO: caselle nere con le somme (in alto a destra la fila orizzontale, in basso a sinistra quella verticale),
// caselle bianche con cifre e appunti, riquadro delle combinazioni possibili per le due file della casella scelta.
// Tastiera: frecce, cifre, N/spazio = appunti, Canc/0 = cancella, Ctrl+Z / Ctrl+Y = annulla / ripeti.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const R = () => window.Rompicapo;
  let ctxK = null;
  const cifre = (m) => { const o = []; for (let v = 1; v < 10; v++) if (m & (1 << v)) o.push(v); return o; };
  // COMBO[k][s]: le combinazioni di k cifre diverse con somma s (maschere di bit)
  const COMBO = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
  for (let m = 2; m < 1024; m += 2) { const c = cifre(m); COMBO[c.length][c.reduce((a, b) => a + b, 0)].push(m); }

  // le file dello schema (si calcolano una volta per partita)
  const cacheFile = new WeakMap();
  function fileDi(p) {
    const chiave = p.somme;
    if (cacheFile.has(chiave)) return cacheFile.get(chiave);
    const L = p.L, out = [], diCella = Array.from({ length: L * L }, () => []);
    for (const [capo, [so, sv]] of Object.entries(p.somme)) {
      const i0 = Number(capo), r0 = Math.floor(i0 / L), c0 = i0 % L;
      for (const [s, dr, dc, dir] of [[so, 0, 1, 'o'], [sv, 1, 0, 'v']]) {
        if (!s) continue;
        const celle = [];
        for (let r = r0 + dr, c = c0 + dc; r < L && c < L && !p.nere[r * L + c]; r += dr, c += dc) celle.push(r * L + c);
        celle.forEach((i) => diCella[i].push(out.length));
        out.push({ celle, somma: s, dir });
      }
    }
    const x = { file: out, diCella };
    cacheFile.set(chiave, x);
    return x;
  }

  function locale(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    if (!ui.loc || R().allineato(ctx)) ui.loc = { valori: p.valori.slice(), note: p.note.slice() };
    return ui.loc;
  }
  const puoi = (ctx) => { const p = ctx.partita; return !p.finita && p.fatto == null && !p.ritirato && !ctx.stato.spettatore; };

  function scrivi(ctx, v, nota) {
    const p = ctx.partita, ui = ctx.ui, i = ui.sel;
    if (i == null || p.nere[i] || !puoi(ctx)) return;
    const L = locale(ctx);
    if (nota && v) {
      if (L.valori[i]) return;
      L.note[i] ^= 1 << v;
      R().invia(ctx, { tipo: 'nota', i, v });
    } else {
      if (L.valori[i] === v && v) return;
      if (!v && !L.valori[i] && !L.note[i]) return;
      if (!v && !L.valori[i]) { L.note[i] = 0; R().invia(ctx, { tipo: 'nota', i, v: 0 }); return ctx.ridisegna(); }
      L.valori[i] = v;
      if (!v) L.note[i] = 0;
      if (v) {
        const F = fileDi(p);
        for (const k of F.diCella[i]) for (const j of F.file[k].celle) if (j !== i) L.note[j] &= ~(1 << v);
        suono([[300 + v * 35, 0.04]], { tipo: 'triangle', volume: 0.04 });
      }
      R().invia(ctx, { tipo: 'metti', i, v });
    }
    ctx.ridisegna();
  }
  function scegli(ctx, i) { ctx.ui.sel = i; ctx.ridisegna(); }

  function misura(L) {
    const largo = document.documentElement.clientWidth;
    const W = largo >= 900 ? Math.min(700, largo - 440) : largo - 20;
    // sul telefono la griglia lascia posto sotto a tastierino, comandi e combinazioni (tutto senza scorrere)
    const H = largo >= 900 ? window.innerHeight - 290 : window.innerHeight - 385;
    // L caselle, L − 1 spazi da 2 pixel e il bordo da 2 per parte
    return Math.max(26, Math.min(70, Math.floor((Math.min(W, H) - 4 - 2 * (L - 1)) / L)));
  }

  function controlli(p, valori) {
    const F = fileDi(p), doppi = new Set(), fileKo = new Set();
    F.file.forEach((f, k) => {
      const v = f.celle.map((i) => valori[i]);
      for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) if (v[a] && v[a] === v[b]) { doppi.add(f.celle[a]); doppi.add(f.celle[b]); }
      const s = v.reduce((x, y) => x + y, 0);
      if ((v.every(Boolean) && s !== f.somma) || s > f.somma) fileKo.add(k);
    });
    return { doppi, fileKo, F };
  }

  // riquadro delle combinazioni per una fila: le cifre già scritte devono stare nella combinazione
  function combinazioni(f, valori, dir) {
    let messe = 0, doppie = false;
    for (const i of f.celle) if (valori[i]) { if (messe & (1 << valori[i])) doppie = true; messe |= 1 << valori[i]; }
    const lista = COMBO[f.celle.length][f.somma] || [];
    const voci = lista.map((m) => {
      const ok = !doppie && (m & messe) === messe;
      return `<span class="kk-combo ${ok ? '' : 'no'}">${cifre(m).map((x) => (messe & (1 << x) ? `<b>${x}</b>` : x)).join('')}</span>`;
    }).join('');
    return `<div class="kk-cf"><div class="kk-cf-t">${dir === 'o' ? '↔ Orizzontale' : '↕ Verticale'}: <b>${f.somma}</b> in ${f.celle.length} caselle${lista.length === 1 ? ' <em>· una sola!</em>' : ''}</div><div class="kk-cf-l">${voci}</div></div>`;
  }

  const tavolo = {
    libero: true,
    reset(ctx) { ctxK = ctx; R().attiva(ctx); },
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui, L = p.L;
      const Lc = locale(ctx);
      const { doppi, fileKo, F } = controlli(p, Lc.valori);
      let sel = ui.sel != null && ui.sel < L * L && !p.nere[ui.sel] ? ui.sel : null;
      const fileSel = sel != null ? F.diCella[sel] : [];
      const inFila = new Set(fileSel.flatMap((k) => F.file[k].celle));
      const capiKo = new Set();
      fileKo.forEach((k) => { const f = F.file[k]; const i0 = f.celle[0]; capiKo.add(`${f.dir === 'o' ? i0 - 1 : i0 - L}:${f.dir}`); });
      const finito = p.fatto != null || p.finita;
      let celle = '';
      for (let i = 0; i < L * L; i++) {
        const r = Math.floor(i / L), c = i % L;
        if (p.nere[i]) {
          const s = p.somme[i];
          if (!s) { celle += '<div class="kk-n"></div>'; continue; }
          celle += `<div class="kk-n kk-somma">${s[0] ? `<span class="kk-so ${capiKo.has(`${i}:o`) ? 'ko' : ''}">${s[0]}</span>` : ''}${s[1] ? `<span class="kk-sv ${capiKo.has(`${i}:v`) ? 'ko' : ''}">${s[1]}</span>` : ''}</div>`;
          continue;
        }
        const v = Lc.valori[i];
        const cls = ['kk-c', sel === i ? 'scelta' : inFila.has(i) ? 'zona' : '', doppi.has(i) ? 'doppia' : '',
          p.sbagliate && p.sbagliate[i] ? 'sbagliata' : '', p.ultimoAiuto && p.ultimoAiuto.cella === i && !finito ? 'aiutata' : ''].filter(Boolean).join(' ');
        const note = !v && Lc.note[i] ? `<span class="kk-note">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => `<i>${Lc.note[i] & (1 << x) ? x : ''}</i>`).join('')}</span>` : '';
        celle += `<div class="${cls}" data-az="cella" data-i="${i}" role="button" aria-label="Riga ${r + 1}, colonna ${c + 1}${v ? `: ${v}` : ''}">${v ? `<b class="kk-v">${v}</b>` : ''}${note}</div>`;
      }
      const tasti = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => `<button type="button" class="kk-tasto" data-az="num" data-v="${x}">${x}</button>`).join('');
      const nomeLiv = { facile: 'Facile', medio: 'Media', difficile: 'Difficile' }[p.livello];
      const combo = sel != null && !finito ? fileSel.map((k) => combinazioni(F.file[k], Lc.valori, F.file[k].dir)).join('')
        : finito ? '' : '<div class="kk-cf vuoto">Scegli una casella bianca: qui vedi le combinazioni possibili delle sue due somme.</div>';
      const rec = p.finita && p.record && p.record.length ? `<div class="bb-record"><b>🏆 Tempi migliori · ${L}×${L} ${nomeLiv.toLowerCase()}</b><ol>${p.record.map((x, k) => `<li class="${k === p.posizioneRecord ? 'nuovo' : ''}">${R().fmt(x.ms)}${x.aiuti ? ` <small>(${x.aiuti} aiuti)</small>` : ''}</li>`).join('')}</ol></div>` : '';
      const comandi = finito ? '' : `<div class="kk-combinazioni"><div class="kk-cf-titolo">🧮 Combinazioni</div>${combo}</div>
        <div class="kk-tasti">${tasti}<button type="button" class="kk-tasto canc" data-az="num" data-v="0" title="Cancella (Canc)">⌫</button></div>
        <div class="kk-comandi">
          <button type="button" class="bottone ${ui.appunti ? 'attivo-bt' : ''}" data-az="appunti" aria-pressed="${!!ui.appunti}" title="Tasto N o barra spaziatrice">✏️ Appunti ${ui.appunti ? 'sì' : 'no'}</button>
          <button type="button" class="bottone" data-az="aiuto" title="Scrive una cifra giusta: +30 secondi">💡 Aiuto${p.aiuti ? ` <small>(${p.aiuti})</small>` : ''}</button>
          <button type="button" class="bottone" data-az="annulla" ${p.puoAnnullare ? '' : 'disabled'} title="Ctrl+Z">↶ Annulla</button>
          <button type="button" class="bottone" data-az="ripeti" ${p.puoRipetere ? '' : 'disabled'} title="Ctrl+Y">↷ Ripeti</button>
          <button type="button" class="bottone" data-az="ricomincia" title="Svuota la griglia (si può annullare)">↺ Svuota</button>
          ${p.sfida ? '<button type="button" class="bottone leggero" data-az="arrenditi">🏳️ Mi ritiro</button>' : ''}
        </div>`;
      const extra = `<span>${L}×${L} · ${esc(nomeLiv)}</span>`;
      return `<div class="kk ${finito ? 'finito' : ''}" style="--c:${misura(L)}px;--n:${L}">
        <div class="kk-sx">${R().barra(ctx, extra)}<div class="kk-griglia ${finito ? 'completa' : ''} ${ui.appunti ? 'in-appunti' : ''}">${celle}</div></div>
        <div class="kk-dx">${R().attesa(ctx)}${comandi}${R().arrivo(ctx)}${rec}</div></div>`;
    },
    dopo(ctx) {
      ctxK = ctx; R().attiva(ctx);
      if (ctx.partita.fatto != null && primaVolta(ctx.ui, 'kk-fatto')) suono([[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.3]], { volume: 0.08 });
    },
    stato(ctx) { const p = ctx.partita; if (p.finita) return null; return p.fatto != null ? 'Finito! ✅' : p.sfida ? 'Sfida: chi finisce prima?' : 'Completa le somme'; },
    punteggio(ctx) { const p = ctx.partita; return p.sfida ? p.altri.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x.fatto != null ? '✅' : `${x.prog}%`}</b></span>`).join('') : ''; },
    infoPosto(ctx, posto) { return R().infoPosto(ctx, posto); },
    clic(ctx, el) {
      const az = el.dataset.az, ui = ctx.ui;
      if (az === 'cella') return scegli(ctx, Number(el.dataset.i));
      if (az === 'num') return scrivi(ctx, Number(el.dataset.v), !!ui.appunti);
      if (az === 'appunti') { ui.appunti = !ui.appunti; return ctx.ridisegna(); }
      if (['annulla', 'ripeti', 'aiuto', 'ricomincia', 'arrenditi'].includes(az)) {
        if (az === 'arrenditi' && !confirm('Vuoi ritirarti dalla sfida?')) return;
        if (az === 'ricomincia' && !confirm('Svuotare tutta la griglia? (puoi annullare)')) return;
        R().invia(ctx, { tipo: az });
      }
    },
  };

  // spostamento con le frecce: si salta alla prossima casella bianca in quella direzione
  function sposta(p, i, dr, dc) {
    const L = p.L;
    let r = Math.floor(i / L), c = i % L;
    for (;;) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= L || c >= L) return i;
      if (!p.nere[r * L + c]) return r * L + c;
    }
  }
  setTimeout(() => window.Rompicapo.tastiera('kakuro', () => ctxK, (e, ctx) => {
    const p = ctx.partita, ui = ctx.ui;
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); return R().invia(ctx, { tipo: e.shiftKey ? 'ripeti' : 'annulla' }); }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); return R().invia(ctx, { tipo: 'ripeti' }); }
    if (e.ctrlKey) return;
    const primaBianca = p.nere.findIndex((x) => !x);
    const muovi = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (muovi) {
      e.preventDefault();
      if (ui.sel == null || p.nere[ui.sel]) return scegli(ctx, primaBianca);
      return scegli(ctx, sposta(p, ui.sel, ...muovi));
    }
    const cifra = /^Digit[1-9]$|^Numpad[1-9]$/.test(e.code) ? Number(e.code.slice(-1)) : /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
    if (cifra) { e.preventDefault(); if (ui.sel == null || p.nere[ui.sel]) ui.sel = primaBianca; return scrivi(ctx, cifra, !!ui.appunti || e.shiftKey); }
    if (['0', 'Backspace', 'Delete'].includes(e.key)) { e.preventDefault(); return scrivi(ctx, 0, false); }
    if (e.key === 'n' || e.key === 'N' || e.key === ' ') { e.preventDefault(); ui.appunti = !ui.appunti; return ctx.ridisegna(); }
  }), 0);

  Object.assign(window.Tavoli, { kakuro: tavolo });
})();
