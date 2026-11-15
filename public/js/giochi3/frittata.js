// FRITTATA!: la tovaglia a quadretti con il mazzo e gli scarti, il "palco" con la carta appena giocata (e la catena
// dei Contro, con la barra del tempo per rispondere), le mie trappole coperte, la mia mano. Si tocca una carta per
// vederla grande e giocarla; quando qualcuno gioca, chi ha un Contro adatto lo vede illuminato e può rispondere.
(() => {
  const { esc, primaVolta, suono, trascorso } = window.Nuovi;
  const C = () => window.FrittataCarte || {};
  const TIPO = { azione: 'Azione', trappola: 'Trappola', contro: 'Contro' };
  const chi = (ctx, i) => (i === ctx.mio && !ctx.stato.spettatore ? 'Tu' : ctx.nome(i));
  // nel diario i nomi veri (anche il mio: "Tu pesca" suonava male)
  const nomi = (ctx, t) => esc(t).replace(/@(\d+)/g, (_, i) => { const g = ctx.stato.giocatori[Number(i)]; return `<b>${esc(g ? g.nome : chi(ctx, Number(i)))}</b>`; });

  // una carta: piccola (nella mano) o grande (dettaglio, palco)
  function carta(k, { id, grande, cls = '', az } = {}) {
    const d = C()[k];
    if (!d) return '';
    const attr = az ? ` data-az="${az}" data-id="${esc(id)}" role="button" tabindex="0"` : '';
    return `<div class="frt-carta frt-${d.tipo} ${grande ? 'frt-grande' : ''} ${cls}"${attr} aria-label="${esc(d.nome)}">
      <span class="frt-tipo">${TIPO[d.tipo]}</span><span class="frt-emoji">${d.emoji}</span><b class="frt-nome">${esc(d.nome)}</b>
      <span class="frt-testo">${esc(d.testo)}</span>${grande ? `<i class="frt-battuta">${esc(d.battuta)}</i>` : ''}</div>`;
  }
  const retro = (cls = '') => `<div class="frt-carta frt-retro ${cls}"><span>🍳</span></div>`;

  // il palco: cosa si sta giocando adesso
  function palco(ctx) {
    const p = ctx.partita, P = p.pend, ui = ctx.ui;
    if (!P) return '';
    let titolo = '', base = '';
    if (P.k === 'frittata') { titolo = `${esc(chi(ctx, P.chi))} ${P.chi === ctx.mio ? 'gridi' : 'grida'} <b>FRITTATA!</b>`; base = '<div class="frt-urlo">🍳 FRITTATA!</div>'; }
    else if (P.k === 'azione') { titolo = `${esc(chi(ctx, P.chi))} ${P.chi === ctx.mio ? 'giochi' : 'gioca'}${P.bers != null ? ` su <b>${esc(P.bers === ctx.mio ? 'di te' : ctx.nome(P.bers))}</b>` : ''}`; base = carta(P.carta, { grande: true }); }
    else if (P.k === 'mira') { titolo = `Scatta la trappola di ${esc(chi(ctx, P.chi))} contro ${esc(C()[P.azione.carta].nome)}`; base = carta(P.carta, { grande: true, cls: 'frt-scattata' }); }
    else if (P.k === 'padella') { titolo = `${esc(chi(ctx, P.vittima))} ${P.vittima === ctx.mio ? 'gridi' : 'grida'} Frittata… ma scatta la trappola di ${esc(chi(ctx, P.chi))}!`; base = carta(P.carta, { grande: true, cls: 'frt-scattata' }); }
    else if (P.k === 'retino') { titolo = `${esc(chi(ctx, P.vittima))} ${P.vittima === ctx.mio ? 'peschi' : 'pesca'}… ma scatta il retino di ${esc(chi(ctx, P.chi))}!`; base = carta(P.carta, { grande: true, cls: 'frt-scattata' }); }
    const catena = P.catena.map((x, i) => `<div class="frt-anello" style="--i:${i}">${carta(x.carta, { grande: true })}<small>${esc(chi(ctx, x.chi))}</small></div>`).join('');
    // la barra del tempo: riparte a ogni Contro
    const chiave = `frt-t-${P.nFinestra}-${P.catena.length}`;
    if (primaVolta(ui, chiave)) ui[`${chiave}-ms`] = P.restaMs;
    const durata = ui[`${chiave}-ms`] || P.restaMs, passato = trascorso(ui, chiave);
    const vale = P.catena.length % 2 === 0;
    const rispondo = p.rispondi.length > 0;
    const attesa = p.attesi.length ? `<small class="frt-chi-attende">${rispondo ? 'Puoi rispondere con un Contro!' : `Può ancora rispondere: ${p.attesi.map((i) => esc(chi(ctx, i))).join(', ')}`}</small>` : '';
    return `<div class="frt-palco ${rispondo ? 'frt-tocca' : ''}">
      <p class="frt-titolo">${titolo}</p>
      <div class="frt-pila">${base}${catena}</div>
      <p class="frt-esito ${vale ? 'frt-vale' : 'frt-annullata'}">${P.catena.length ? (vale ? '↩️ Contro annullati: per ora vale!' : '✋ Per ora è annullata!') : ''}</p>
      <div class="frt-tempo"><span style="animation-duration:${durata}ms;animation-delay:-${passato}ms"></span></div>${attesa}
      ${rispondo ? `<div class="frt-risposte">${p.mano.filter((c, i, m) => p.rispondi.includes(c.id) && m.findIndex((x) => x.k === c.k && p.rispondi.includes(x.id)) === i).map((c) => carta(c.k, { id: c.id, az: 'contro', cls: 'frt-pronta' })).join('')}</div>
        <button type="button" class="bottone" data-az="passa">🤷 Lascia stare</button>` : ''}
    </div>`;
  }

  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui, io = ctx.mio, spett = ctx.stato.spettatore;
      const mio = p.turno === io && !p.finita && !spett;
      const mano = p.mano || [];
      if (ui.sel && !mano.some((c) => c.id === ui.sel)) ui.sel = null;
      ui.scarti = (ui.scarti || []).filter((id) => mano.some((c) => c.id === id));
      // in alto: mazzo, scarti, cosa è successo
      const tavola = `<div class="frt-tavola">
        <div class="frt-mucchio">${retro()}<small>Mazzo <b>${p.mazzo}</b></small></div>
        <div class="frt-mucchio">${p.cimaScarti ? carta(p.cimaScarti, { cls: 'frt-mini' }) : '<div class="frt-carta frt-vuota"></div>'}<small>Scarti <b>${p.scarti}</b></small></div>
        <ol class="frt-diario">${p.log.slice(-5).reverse().map((x) => `<li>${nomi(ctx, x.t)}</li>`).join('') || '<li>La partita comincia: tutti hanno le loro carte.</li>'}</ol>
      </div>`;
      // il centro: il palco se si sta giocando qualcosa, se no cosa devo fare
      let centro = palco(ctx);
      if (!centro && !p.finita) {
        if (p.fase === 'scarta' && mio) {
          const serve = mano.length - 10;
          centro = `<div class="frt-avviso"><p>Hai <b>${mano.length}</b> carte: scegline <b>${serve}</b> da scartare e resti con 10.</p>
            <button type="button" class="bottone primario-bt" data-az="scarta" ${ui.scarti.length === serve ? '' : 'disabled'}>🗑️ Scarta ${ui.scarti.length}/${serve}</button></div>`;
        } else if (mio) {
          const dieci = p.inizio && mano.length === 10;
          centro = `<div class="frt-avviso">${dieci ? '<button type="button" class="frt-grido" data-az="frittata">🍳 FRITTATA!</button><p>Hai esattamente 10 carte: gridalo prima di fare altro!</p>' : `<p>Tocca a te: <b>pesca</b> una carta, <b>gioca</b> un'Azione o <b>piazza</b> una Trappola.</p>`}
            <button type="button" class="bottone primario-bt" data-az="pesca">🃏 Pesca 1 carta</button></div>`;
        } else if (p.fase === 'scarta') centro = `<div class="frt-avviso"><p>${esc(ctx.nome(p.turnoDi))} sceglie cosa scartare…</p></div>`;
        else centro = `<div class="frt-avviso"><p>Tocca a <b>${esc(ctx.nome(p.turnoDi))}</b>${p.carte[p.turnoDi] === 10 && p.inizio ? ' — ha 10 carte! 😱' : ''}</p></div>`;
      }
      // la carta scelta, grande, con quello che si può fare
      let dettaglio = '';
      const scelta = ui.sel && mano.find((c) => c.id === ui.sel);
      if (scelta && p.fase !== 'scarta') {
        const d = C()[scelta.k];
        let bot = '';
        const puo = mio && p.fase === 'turno';
        if (d.tipo === 'azione' && puo) {
          bot = d.bers
            ? `<p class="frt-su">Su chi?</p><div class="frt-bersagli">${Array.from({ length: p.n }, (_, i) => i).filter((i) => i !== io).map((i) => `<button type="button" class="bottone primario-bt" data-az="gioca" data-id="${esc(scelta.id)}" data-bers="${i}">${esc(ctx.nome(i))} <small>${p.carte[i]}🃏</small></button>`).join('')}</div>`
            : `<button type="button" class="bottone primario-bt" data-az="gioca" data-id="${esc(scelta.id)}">▶️ Gioca</button>`;
        } else if (d.tipo === 'trappola' && puo) {
          const mie = Array.isArray(p.trappole[io]) ? p.trappole[io].length : 0;
          bot = mie >= 3 ? '<p class="frt-su">Hai già 3 trappole piazzate</p>' : `<button type="button" class="bottone primario-bt" data-az="gioca" data-id="${esc(scelta.id)}">🪤 Piazza coperta (${mie}/3)</button>`;
        } else if (d.tipo === 'contro') bot = '<p class="frt-su">I Contro si giocano quando qualcuno gioca una carta: si illuminano da soli.</p>';
        else bot = '<p class="frt-su">Aspetta il tuo turno per giocarla.</p>';
        dettaglio = `<div class="frt-dettaglio">${carta(scelta.k, { grande: true })}<div class="frt-comandi">${bot}<button type="button" class="bottone leggero" data-az="chiudi">Chiudi</button></div></div>`;
      }
      // le mie trappole e la mia mano
      const mieTrap = Array.isArray(p.trappole[io]) && p.trappole[io].length ? `<div class="frt-mie-trap"><small>Le tue trappole (gli altri le vedono coperte)</small><div>${p.trappole[io].map((c) => carta(c.k, { cls: 'frt-mini' })).join('')}</div></div>` : '';
      const scarto = p.fase === 'scarta' && mio;
      const manoHtml = spett ? '' : `<div class="frt-mano-box">
        <div class="frt-conteggio"><span>Le tue carte: <b>${mano.length}</b></span><span class="frt-pallini">${Array.from({ length: 10 }, (_, i) => `<i class="${i < mano.length ? 'pieno' : ''}"></i>`).join('')}${mano.length > 10 ? `<em>+${mano.length - 10}</em>` : ''}</span></div>
        <div class="frt-mano">${mano.map((c) => carta(c.k, { id: c.id, az: scarto ? 'segna' : 'scegli', cls: `${ui.sel === c.id && !scarto ? 'frt-scelta' : ''} ${scarto && ui.scarti.includes(c.id) ? 'frt-via' : ''} ${p.rispondi.includes(c.id) ? 'frt-pronta' : ''}` })).join('') || '<p class="frt-vuoto">Nessuna carta in mano</p>'}</div></div>`;
      return `<div class="frt">${tavola}${centro}${dettaglio}${mieTrap}${manoHtml}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.pend && primaVolta(ctx.ui, `frt-s-${p.pend.nFinestra}-${p.pend.catena.length}`)) {
        if (p.rispondi.length) {
          suono([[660, 0.07], [880, 0.1]], { tipo: 'square', volume: 0.05 });
          // il tempo è poco: i Contro devono essere sotto gli occhi (sul telefono si scorre fin lì)
          const el = document.querySelector('.frt-risposte');
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        else suono([[300, 0.06], [420, 0.08]], { tipo: 'triangle', volume: 0.05 });
      }
      // la barra del tempo deve scorrere anche senza aggiornamenti: si ridisegna quando scade
      clearTimeout(ctx.ui._frtT);
      if (p.pend && p.attesi.length) ctx.ui._frtT = setTimeout(() => { if (ctx.partita === p) ctx.ridisegna(); }, Math.max(300, p.pend.restaMs + 300));
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.pend) return p.rispondi.length ? 'Rispondi con un Contro?' : 'Si può rispondere…';
      if (p.fase === 'scarta') return p.turno === ctx.mio ? 'Scarta fino a 10' : `${ctx.nome(p.turnoDi)} scarta`;
      if (p.turno === ctx.mio) return p.inizio && p.mano.length === 10 ? 'Grida FRITTATA!' : 'Tocca a te';
      return `Tocca a ${ctx.nome(p.turnoDi)}`;
    },
    // sotto i nomi: quante carte (in rosso chi ne ha 10) e le trappole coperte
    infoPosto(ctx, posto) {
      const p = ctx.partita, t = Array.isArray(p.trappole[posto]) ? p.trappole[posto].length : p.trappole[posto];
      return `<span class="frt-info ${p.carte[posto] === 10 ? 'frt-dieci' : ''}"><b>${p.carte[posto]}</b>/10 carte${t ? ` · ${'🪤'.repeat(t)}` : ''}</span>`;
    },
    clic(ctx, el) {
      const az = el.dataset.az, ui = ctx.ui;
      if (az === 'scegli') { ui.sel = ui.sel === el.dataset.id ? null : el.dataset.id; return ctx.ridisegna(); }
      if (az === 'chiudi') { ui.sel = null; return ctx.ridisegna(); }
      if (az === 'segna') { const id = el.dataset.id; ui.scarti = ui.scarti.includes(id) ? ui.scarti.filter((x) => x !== id) : [...ui.scarti, id]; return ctx.ridisegna(); }
      if (az === 'scarta') { const c = ui.scarti; ui.scarti = []; return ctx.invia({ tipo: 'scarta', carte: c }); }
      if (az === 'pesca') { ui.sel = null; suono([[520, 0.05]], { tipo: 'sine', volume: 0.04 }); return ctx.invia({ tipo: 'pesca' }); }
      if (az === 'frittata') { suono([[523, 0.08], [659, 0.08], [784, 0.16]], { tipo: 'square', volume: 0.06 }); return ctx.invia({ tipo: 'frittata' }); }
      if (az === 'gioca') { ui.sel = null; const a = { tipo: 'gioca', carta: el.dataset.id }; if (el.dataset.bers != null) a.bers = Number(el.dataset.bers); return ctx.invia(a); }
      if (az === 'contro') return ctx.invia({ tipo: 'contro', carta: el.dataset.id });
      if (az === 'passa') return ctx.invia({ tipo: 'passa' });
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { frittata: tavolo });
})();
