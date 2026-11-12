// AFFARI IN CITTÀ: tabellone 11×11 in CSS (angoli grandi), con le fasce colorate dei gruppi, il padrone segnato col
// suo colore, case e alberghi, ipoteche, pedine. Al centro dadi, carta pescata, le decisioni (compra, asta,
// scambio) e il diario. A destra i giocatori e le tue proprietà, con costruire, vendere, ipotecare e lo scambio.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const COLORI_G = { marrone: '#8b5a2b', azzurro: '#8fd3f4', rosa: '#d65db1', arancione: '#f39c34', rosso: '#e0413a', giallo: '#f1d43a', verde: '#2fa35a', blu: '#2b5fb8' };
  const PEDINE = ['#e2483b', '#3b80e0', '#f0c030', '#3cab5b', '#9b59d0', '#f08a2a'];
  const ICONE = { via: '➡️', sorpresa: '❓', destino: '🎴', tassa: '💰', stazione: '🚆', prigione: '🔒', parcheggio: '🅿️', vaiprigione: '👮', societa: '💡' };
  // le caselle (stesso ordine del server): [tipo, nome, gruppo, prezzo, casa, affitti]
  const C = [
    ['via', 'Via'], ['terreno', 'Campobasso', 'marrone', 60, 50, [2, 10, 30, 90, 160, 250]], ['sorpresa', 'Sorpresa'], ['terreno', 'Potenza', 'marrone', 60, 50, [4, 20, 60, 180, 320, 450]],
    ['tassa', 'Tassa patrimoniale', null, 200], ['stazione', 'Stazione Nord', null, 200], ['terreno', 'Ancona', 'azzurro', 100, 50, [6, 30, 90, 270, 400, 550]], ['destino', 'Destino'],
    ['terreno', 'Perugia', 'azzurro', 100, 50, [6, 30, 90, 270, 400, 550]], ['terreno', 'L\'Aquila', 'azzurro', 120, 50, [8, 40, 100, 300, 450, 600]], ['prigione', 'Prigione'],
    ['terreno', 'Cagliari', 'rosa', 140, 100, [10, 50, 150, 450, 625, 750]], ['societa', 'Centrale elettrica', null, 150], ['terreno', 'Trento', 'rosa', 140, 100, [10, 50, 150, 450, 625, 750]],
    ['terreno', 'Bari', 'rosa', 160, 100, [12, 60, 180, 500, 700, 900]], ['stazione', 'Stazione Est', null, 200], ['terreno', 'Palermo', 'arancione', 180, 100, [14, 70, 200, 550, 750, 950]],
    ['sorpresa', 'Sorpresa'], ['terreno', 'Genova', 'arancione', 180, 100, [14, 70, 200, 550, 750, 950]], ['terreno', 'Bologna', 'arancione', 200, 100, [16, 80, 220, 600, 800, 1000]],
    ['parcheggio', 'Parcheggio'], ['terreno', 'Napoli', 'rosso', 220, 150, [18, 90, 250, 700, 875, 1050]], ['destino', 'Destino'], ['terreno', 'Firenze', 'rosso', 220, 150, [18, 90, 250, 700, 875, 1050]],
    ['terreno', 'Torino', 'rosso', 240, 150, [20, 100, 300, 750, 925, 1100]], ['stazione', 'Stazione Sud', null, 200], ['terreno', 'Venezia', 'giallo', 260, 150, [22, 110, 330, 800, 975, 1150]],
    ['terreno', 'Verona', 'giallo', 260, 150, [22, 110, 330, 800, 975, 1150]], ['societa', 'Acquedotto', null, 150], ['terreno', 'Trieste', 'giallo', 280, 150, [24, 120, 360, 850, 1025, 1200]],
    ['vaiprigione', 'In prigione!'], ['terreno', 'Taormina', 'verde', 300, 200, [26, 130, 390, 900, 1100, 1275]], ['terreno', 'Capri', 'verde', 300, 200, [26, 130, 390, 900, 1100, 1275]],
    ['sorpresa', 'Sorpresa'], ['terreno', 'Portofino', 'verde', 320, 200, [28, 150, 450, 1000, 1200, 1400]], ['stazione', 'Stazione Ovest', null, 200], ['destino', 'Destino'],
    ['terreno', 'Cortina', 'blu', 350, 200, [35, 175, 500, 1100, 1300, 1500]], ['tassa', 'Tassa di lusso', null, 100], ['terreno', 'Milano', 'blu', 400, 200, [50, 200, 600, 1400, 1700, 2000]],
  ];
  const acquistabile = (i) => ['terreno', 'stazione', 'societa'].includes(C[i][0]);
  // posizione nella griglia 11×11 e lato (per la fascia di colore)
  function cella(i) {
    if (i === 0) return [11, 11, 'angolo'];
    if (i < 10) return [11, 11 - i, 'giu'];
    if (i === 10) return [11, 1, 'angolo'];
    if (i < 20) return [11 - (i - 10), 1, 'sx'];
    if (i === 20) return [1, 1, 'angolo'];
    if (i < 30) return [1, i - 19, 'su'];
    if (i === 30) return [1, 11, 'angolo'];
    return [i - 29, 11, 'dx'];
  }
  const euro = (x) => `${Number(x).toLocaleString('it-IT')} €`;
  const DADO = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
  const dado = (v, k, st = '') => `<svg class="af-dado" viewBox="0 0 100 100" style="--k:${k};${st}"><rect x="5" y="5" width="90" height="90" rx="18"/>${DADO[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;

  function dettaglio(i, p) {
    const [tipo, nome, gr, prezzo, casa, aff] = C[i];
    const pad = p.padrone[i];
    let righe = '';
    if (tipo === 'terreno') righe = `<table class="af-aff"><tr><td>Affitto</td><td>${euro(aff[0])}</td></tr><tr><td>col gruppo</td><td>${euro(aff[0] * 2)}</td></tr>${[1, 2, 3, 4].map((k) => `<tr><td>${k} ${k === 1 ? 'casa' : 'case'}</td><td>${euro(aff[k])}</td></tr>`).join('')}<tr><td>albergo</td><td>${euro(aff[5])}</td></tr><tr class="af-pic"><td>una casa costa</td><td>${euro(casa)}</td></tr></table>`;
    else if (tipo === 'stazione') righe = '<table class="af-aff"><tr><td>1 stazione</td><td>25 €</td></tr><tr><td>2 stazioni</td><td>50 €</td></tr><tr><td>3 stazioni</td><td>100 €</td></tr><tr><td>4 stazioni</td><td>200 €</td></tr></table>';
    else if (tipo === 'societa') righe = '<p class="af-pic">4 volte i dadi; 10 volte con tutte e due le società</p>';
    return `<div class="af-carta-prop" style="--g:${gr ? COLORI_G[gr] : '#555'}"><div class="af-testa-prop">${gr ? '' : ICONE[tipo] || ''} ${esc(nome)}</div>
      ${prezzo ? `<p class="af-prezzo">Prezzo ${euro(prezzo)}</p>` : ''}${righe}
      ${acquistabile(i) ? `<p class="af-pic">${pad == null ? 'Libera' : `Di <b style="color:${PEDINE[pad]}">${esc(p._nome(pad))}</b>${p.ipoteca[i] ? ' · ipotecata' : ''}`}</p>` : ''}</div>`;
  }

  const tavolo = {
    libero: true,
    senzaFila: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui, io = ctx.mio;
      const nome = (k) => (k === io ? 'Tu' : ctx.nome(k));
      const stretto = window.matchMedia && window.matchMedia('(max-width: 620px)').matches;
      p._nome = nome;
      const conNomi = (t) => esc(t).replace(/@(\d)/g, (_, k) => `<b style="color:${PEDINE[k]}">${esc(nome(Number(k)))}</b>`);
      // ---- le 40 caselle ----
      let caselle = '';
      for (let i = 0; i < 40; i++) {
        const [r, c, lato] = cella(i);
        const [tipo, nm, gr, prezzo] = C[i];
        const pad = p.padrone[i];
        const pedine = p.pos.map((x, k) => (x === i && p.vivo[k] ? `<span class="af-pedina ${p.attivo === k ? 'attiva' : ''}" style="--c:${PEDINE[k]}" title="${esc(nome(k))}"></span>` : '')).join('');
        const casette = p.case[i] === 5 ? '<span class="af-albergo"></span>' : '<span class="af-casa"></span>'.repeat(p.case[i]);
        const fascia = gr ? `<div class="af-fascia" style="--g:${COLORI_G[gr]}">${casette}</div>` : '';
        const ic = !gr ? `<span class="af-ic">${ICONE[tipo] || ''}</span>` : '';
        caselle += `<div class="af-c af-${lato} ${tipo} ${pad != null ? 'posseduta' : ''} ${p.ipoteca[i] ? 'ipotecata' : ''} ${ui.afSel === i ? 'scelta' : ''}" style="grid-area:${r}/${c};${pad != null ? `--pad:${PEDINE[pad]}` : ''}" data-az="vedi" data-i="${i}" title="${esc(nm)}">
          ${fascia}<span class="af-nome">${esc(nm)}</span>${ic}${prezzo && acquistabile(i) ? `<span class="af-pr">${prezzo} €</span>` : ''}${pedine ? `<div class="af-pedine">${pedine}</div>` : ''}</div>`;
      }
      // ---- il centro ----
      const mio = p.turno === io && !p.finita;
      const st = `--t:0ms`;
      const dadi = p.dadi ? `<div class="af-dadi">${dado(p.dadi[0], 0, st)}${dado(p.dadi[1], 1, st)}</div>` : '';
      let decisione = '';
      const c = p.pos[p.attivo];
      if (p.fase === 'compra' && mio) decisione = `<div class="af-decidi"><p>Sei su <b>${esc(C[c][1])}</b>: la compri per <b>${euro(C[c][3])}</b>?</p>
        <button class="bottone primario-bt" data-az="compra" ${p.soldi[io] < C[c][3] ? 'disabled' : ''}>Compra</button><button class="bottone" data-az="asta">Mettila all'asta</button></div>`;
      else if (p.fase === 'compra') decisione = `<p class="af-attesa">${esc(ctx.nome(p.attivo))} decide se comprare ${esc(C[c][1])}…</p>`;
      else if (p.fase === 'asta' && p.asta) {
        const a = p.asta;
        const passi = [10, 50, 100].map((d) => a.offerta + d).filter((x) => x <= p.soldi[io]);
        decisione = `<div class="af-decidi"><p>Asta per <b>${esc(C[a.c][1])}</b> (prezzo ${euro(C[a.c][3])}): offerta più alta <b>${euro(a.offerta)}</b>${a.migliore != null ? ` di <b style="color:${PEDINE[a.migliore]}">${esc(nome(a.migliore))}</b>` : ''}</p>
          ${mio ? `${passi.map((x) => `<button class="bottone ${x === passi[0] ? 'primario-bt' : ''}" data-az="offri" data-x="${x}">Offri ${euro(x)}</button>`).join('')}<button class="bottone" data-az="passa">Lascio</button>` : `<p class="af-attesa">Tocca a ${esc(ctx.nome(p.turno))}…</p>`}
          <p class="af-pic">In gara: ${a.in.map((k) => esc(nome(k))).join(', ')}</p></div>`;
      } else if (p.fase === 'scambio' && p.scambio) {
        const s = p.scambio;
        const lista = (o) => [...o.caselle.map((k) => `<span class="af-tag" style="--g:${C[k][2] ? COLORI_G[C[k][2]] : '#666'}">${esc(C[k][1])}</span>`), o.soldi ? `<span class="af-tag soldi">${euro(o.soldi)}</span>` : ''].join(' ') || '—';
        decisione = `<div class="af-decidi"><p><b style="color:${PEDINE[s.da]}">${esc(nome(s.da))}</b> propone a <b style="color:${PEDINE[s.a]}">${esc(nome(s.a))}</b> uno scambio:</p>
          <p>dà: ${lista(s.dai)}</p><p>chiede: ${lista(s.chiedi)}</p>
          ${s.a === io ? '<button class="bottone primario-bt" data-az="accetta">Accetto</button><button class="bottone" data-az="rifiuta">Rifiuto</button>' : '<p class="af-attesa">In attesa della risposta…</p>'}</div>`;
      } else if (mio && p.fase === 'tira') {
        const inPr = p.inPrigione[io] >= 0;
        decisione = `<div class="af-decidi">${inPr ? `<p>Sei in prigione (tentativo ${p.inPrigione[io] + 1} di 3): esci pagando, con la carta o facendo doppio.</p>` : ''}
          <button class="bottone primario-bt af-tira" data-az="tira">🎲 ${inPr ? 'Prova il doppio' : p.doppi ? 'Doppio: tira ancora' : 'Tira i dadi'}</button>
          ${inPr ? `<button class="bottone" data-az="pagaPrigione" ${p.soldi[io] < 50 ? 'disabled' : ''}>Paga 50 €</button>${p.carteEsci[io] ? '<button class="bottone" data-az="usaCarta">Usa la carta</button>' : ''}` : ''}</div>`;
      } else if (mio && p.fase === 'fine') decisione = '<div class="af-decidi"><button class="bottone primario-bt" data-az="fine">✓ Fine turno</button><p class="af-pic">Prima puoi costruire, ipotecare o proporre scambi (a destra).</p></div>';
      else if (!p.finita) decisione = `<p class="af-attesa">Tocca a ${esc(ctx.nome(p.turno))}…</p>`;
      const cartaHtml = p.carta && p.carta.n === ui.afCarta ? `<div class="af-cartina ${p.carta.tipo}"><b>${p.carta.tipo === 'destino' ? '🎴 Destino' : '❓ Sorpresa'}</b><p>${esc(p.carta.testo)}</p></div>` : '';
      // nel diario anche il proprio nome (i testi sono in terza persona)
      const nomeVero = (k) => esc((ctx.stato.giocatori[k] && ctx.stato.giocatori[k].nome) || ctx.nome(k));
      const diario = !p.diario.length ? '' : `<ol class="af-diario">${p.diario.slice(-7).map((d) => `<li><span class="af-pal" style="background:${PEDINE[d.posto]}"></span>${nomeVero(d.posto)} ${conNomi(d.testo)}</li>`).join('')}</ol>`;
      // scheda della proprietà: se c'è una decisione con pulsanti (compra, asta…) sta ACCANTO ai pulsanti invece di
      // coprirli; mentre si compra o si fa l'asta compare da sola quella della casella in gioco
      const conPulsanti = /data-az=/.test(decisione);
      const inGioco = p.fase === 'compra' ? c : p.fase === 'asta' && p.asta ? p.asta.c : null;
      const schedaVista = ui.afSel != null ? ui.afSel : conPulsanti && inGioco != null ? inGioco : null;
      const chiudi = ui.afSel != null ? '<button class="bottone mini-bt" data-az="chiudi">✕</button>' : '';
      const sel = schedaVista == null ? '' : `<div class="af-sel ${conPulsanti ? 'accanto' : ''}">${dettaglio(schedaVista, p)}${chiudi}</div>`;
      const parteDecisione = conPulsanti && sel ? `<div class="af-riga">${decisione}${sel}</div>` : `${decisione}${sel}`;
      const centro = `<div class="af-centro"><div class="af-logo">AFFARI <small>IN CITTÀ</small></div>
        <p class="af-giro">Giro ${p.giro}${p.limiteGiri ? ` di ${p.limiteGiri}` : ''}${p.conParcheggio && p.piatto ? ` · 🅿️ ${euro(p.piatto)}` : ''}</p>${dadi}${stretto ? '' : `${cartaHtml}${parteDecisione}${diario}`}</div>`;
      // sul telefono il tabellone si ingrandisce (＋, −, due dita) e pulsanti, carte e diario stanno sotto, a grandezza normale
      const tabellone = stretto ? `<div class="af-cornice">${window.Lente.html('affari', `<div class="af-tab">${caselle}${centro}</div>`, { max: 2.6, alto: '62vh' })}</div><div class="af-sotto">${cartaHtml}${parteDecisione}${diario}</div>`
        : `<div class="af-tab">${caselle}${centro}</div>`;

      // ---- lato: giocatori e le mie proprietà ----
      const gioc = p.soldi.map((s, k) => `<div class="af-gioc ${p.turno === k ? 'di-turno' : ''} ${p.vivo[k] ? '' : 'fuori'}"><span class="af-pal" style="background:${PEDINE[k]}"></span><b>${esc(nome(k))}</b>
        <span class="af-soldi">${p.vivo[k] ? euro(s) : 'fallito'}</span><small>${p.padrone.filter((x) => x === k).length} proprietà · patrimonio ${euro(p.patrimonio[k])}${p.inPrigione[k] >= 0 ? ' · 🔒' : ''}${p.carteEsci[k] ? ' · 🎫' : ''}</small></div>`).join('');
      const gestire = mio && (p.fase === 'tira' || p.fase === 'fine');
      const mie = p.padrone.map((x, i) => (x === io ? i : -1)).filter((i) => i >= 0);
      const costr = new Set(p.costruibili);
      const prop = mie.map((i) => {
        const [, nm, gr, prezzo, casa] = C[i];
        const grCase = gr ? C.map((x, j) => (x[2] === gr ? p.case[j] : 0)) : [];
        const puoVendere = p.case[i] && p.case[i] === Math.max(...grCase);
        const libGr = !gr || !C.some((x, j) => x[2] === gr && p.case[j]);
        const bt = gestire ? [
          costr.has(i) ? `<button class="bottone mini-bt" data-az="costruisci" data-i="${i}" title="Costruisci (${euro(casa)})">🏠+</button>` : '',
          puoVendere ? `<button class="bottone mini-bt" data-az="vendi" data-i="${i}" title="Vendi una casa (+${euro(casa / 2)})">🏠−</button>` : '',
          !p.ipoteca[i] && libGr ? `<button class="bottone mini-bt" data-az="ipoteca" data-i="${i}" title="Ipoteca (+${euro(prezzo / 2)})">🏦</button>` : '',
          p.ipoteca[i] ? `<button class="bottone mini-bt" data-az="riscatta" data-i="${i}" title="Riscatta (${euro(Math.ceil(prezzo * 0.55))})">↩</button>` : '',
        ].join('') : '';
        return `<li class="${p.ipoteca[i] ? 'ipo' : ''}"><span class="af-fasc" style="--g:${gr ? COLORI_G[gr] : '#777'}"></span><span class="af-pn" data-az="vedi" data-i="${i}">${esc(nm)}${p.case[i] ? ` ${p.case[i] === 5 ? '🏨' : '🏠'.repeat(p.case[i])}` : ''}${p.ipoteca[i] ? ' <small>(ipot.)</small>' : ''}</span>${bt}</li>`;
      }).join('');
      // scambio
      let scambio = '';
      if (gestire && p.vivo.filter(Boolean).length > 1) {
        if (!ui.afSc) scambio = '<button class="bottone piccolo-bt" data-az="apriScambio">🤝 Proponi uno scambio</button>';
        else {
          const sc = ui.afSc;
          const altri = p.vivo.map((v, k) => (v && k !== io ? k : -1)).filter((k) => k >= 0);
          if (!altri.includes(sc.a)) sc.a = altri[0];
          const libera = (i) => !C[i][2] || !C.some((x, j) => x[2] === C[i][2] && p.case[j]);
          const scelte = (chi, lista) => p.padrone.map((x, i) => (x === chi && libera(i) ? i : -1)).filter((i) => i >= 0)
            .map((i) => `<label class="af-ck"><input type="checkbox" data-az="sc" data-l="${lista}" data-i="${i}" ${sc[lista].includes(i) ? 'checked' : ''}><span class="af-fasc" style="--g:${C[i][2] ? COLORI_G[C[i][2]] : '#777'}"></span>${esc(C[i][1])}</label>`).join('') || '<small>niente</small>';
          scambio = `<div class="af-scambio"><p>Scambio con ${altri.map((k) => `<button class="bottone mini-bt ${sc.a === k ? 'attivo' : ''}" data-az="scCon" data-k="${k}" style="border-color:${PEDINE[k]}">${esc(nome(k))}</button>`).join(' ')}</p>
            <div class="af-sc-col"><b>Dai</b>${scelte(io, 'dai')}<label class="af-ck">soldi <input type="number" min="0" step="10" max="${p.soldi[io]}" class="af-num" id="af-dai" value="${sc.daiSoldi || 0}"></label></div>
            <div class="af-sc-col"><b>Chiedi</b>${scelte(sc.a, 'chiedi')}<label class="af-ck">soldi <input type="number" min="0" step="10" max="${p.soldi[sc.a]}" class="af-num" id="af-chiedi" value="${sc.chiediSoldi || 0}"></label></div>
            <button class="bottone primario-bt piccolo-bt" data-az="manda">Proponi</button><button class="bottone piccolo-bt" data-az="chiudiScambio">Annulla</button></div>`;
        }
      }
      const lato = `<div class="af-lato">${gioc}<h3 class="af-tit">Le tue proprietà</h3><ul class="af-prop">${prop || '<li class="af-vuoto">Ancora nessuna</li>'}</ul>${scambio}</div>`;
      return `<div class="af">${tabellone}${lato}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      if (p.carta && primaVolta(ui, `af-c-${p.carta.n}`)) { ui.afCarta = p.carta.n; suono([[660, 0.05], [880, 0.08]], { volume: 0.04 }); setTimeout(() => { if (ui.afCarta === p.carta.n && ctx.stato) { ui.afCarta = null; } }, 6000); }
      if (p.dadi && primaVolta(ui, `af-d-${p.nTiro}`)) suono([[260, 0.03], [330, 0.03], [300, 0.04]], { tipo: 'square', volume: 0.025 });
      if (p.ultimoAffitto && primaVolta(ui, `af-a-${p.ultimoAffitto.n}`) && (p.ultimoAffitto.da === ctx.mio || p.ultimoAffitto.a === ctx.mio)) suono(p.ultimoAffitto.a === ctx.mio ? [[784, 0.06], [988, 0.09]] : [[220, 0.12]], { volume: 0.04 });
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.turno !== ctx.mio || p.finita) return null;
      return { tira: 'Tocca a te: tira', compra: 'Compri o asta?', asta: 'Asta: tocca a te', scambio: 'Scambio: rispondi', fine: 'Chiudi il turno' }[p.fase] || 'Tocca a te';
    },
    punteggio() { return ''; },
    infoPosto(ctx, k) { return euro(ctx.partita.soldi[k]); },
    clic(ctx, el) {
      const p = ctx.partita, ui = ctx.ui, az = el.dataset.az, i = Number(el.dataset.i);
      if (az === 'vedi') { ui.afSel = ui.afSel === i ? null : i; return ctx.ridisegna(); }
      if (az === 'chiudi') { ui.afSel = null; return ctx.ridisegna(); }
      if (['tira', 'compra', 'asta', 'passa', 'accetta', 'rifiuta', 'fine', 'pagaPrigione', 'usaCarta'].includes(az)) return ctx.invia({ tipo: az });
      if (az === 'offri') return ctx.invia({ tipo: 'offri', importo: Number(el.dataset.x) });
      if (['costruisci', 'vendi', 'ipoteca', 'riscatta'].includes(az)) return ctx.invia({ tipo: az, casella: i });
      if (az === 'apriScambio') { ui.afSc = { a: null, dai: [], chiedi: [] }; return ctx.ridisegna(); }
      if (az === 'chiudiScambio') { ui.afSc = null; return ctx.ridisegna(); }
      const leggiSoldi = () => { const d = document.getElementById('af-dai'), c = document.getElementById('af-chiedi'); if (d) ui.afSc.daiSoldi = Number(d.value) || 0; if (c) ui.afSc.chiediSoldi = Number(c.value) || 0; };
      if (az === 'scCon') { leggiSoldi(); ui.afSc = { a: Number(el.dataset.k), dai: ui.afSc.dai, chiedi: [], daiSoldi: ui.afSc.daiSoldi }; return ctx.ridisegna(); }
      if (az === 'sc') { leggiSoldi(); const l = ui.afSc[el.dataset.l]; ui.afSc[el.dataset.l] = l.includes(i) ? l.filter((x) => x !== i) : [...l, i]; return ctx.ridisegna(); }
      if (az === 'manda') {
        leggiSoldi();
        const s = ui.afSc;
        ui.afSc = null;
        return ctx.invia({ tipo: 'proponi', a: s.a, dai: { soldi: s.daiSoldi || 0, caselle: s.dai }, chiedi: { soldi: s.chiediSoldi || 0, caselle: s.chiedi } });
      }
      void p;
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { affari: tavolo });
})();
