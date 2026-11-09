// Come si disegna e come si gioca il tavolo di ogni gioco.
// Ogni gioco fornisce: panno, mano, azioni, infoPosto, punteggio, riepilogo, stato, clic.
window.Tavoli = (() => {
  const F = (c, cls = '', attr = '') => Carte.fronte(c, cls, attr);
  // giochi da 40 carte con le somme (scopa, scopone): sulle figure un numerino col valore (fante 8, donna 9, re 10)
  const F40 = (c, cls = '', attr = '') => Carte.fronte(c, cls, attr, c.rango > 10 ? { valore: c.rango - 3 } : {});
  // ordinamento della mano nei giochi da 40 carte: per valore (asso, 2…7, fante, donna, re), a parità per seme
  const ORD_SEMI_40 = ['c', 'q', 'f', 'p'];
  const val40 = (c) => (c.rango <= 7 ? c.rango : c.rango - 3);
  const ordina40 = (mano) => [...mano].sort((a, b) => val40(a) - val40(b) || ORD_SEMI_40.indexOf(a.seme) - ORD_SEMI_40.indexOf(b.seme));
  // la mano si può ordinare per valore (predefinito) o per seme; la scelta resta per le partite successive
  let modoOrdine = 'valore';
  try { modoOrdine = localStorage.getItem('ordine-mano-40') === 'seme' ? 'seme' : 'valore'; } catch {}
  const ordinaMano40 = (mano, val = val40) => [...mano].sort((a, b) => (modoOrdine === 'seme'
    ? ORD_SEMI_40.indexOf(a.seme) - ORD_SEMI_40.indexOf(b.seme) || val(a) - val(b)
    : val(a) - val(b) || ORD_SEMI_40.indexOf(a.seme) - ORD_SEMI_40.indexOf(b.seme)));
  const bottoneOrdine = (n) => (n > 1 ? `<button class="bottone piccolo-bt bt-ordina" data-az="ordina" title="Cambia l'ordine delle carte in mano">↕ Ordina per ${modoOrdine === 'seme' ? 'valore' : 'seme'}</button>` : '');
  const cambiaOrdine = (ctx) => { modoOrdine = modoOrdine === 'seme' ? 'valore' : 'seme'; try { localStorage.setItem('ordine-mano-40', modoOrdine); } catch {} ctx.ridisegna(); };
  // briscola: numerino con i punti della carta (asso 11, tre 10, re 4, donna 3, fante 2); le lisce niente
  const PUNTI_BRISCOLA = { 1: 11, 3: 10, 13: 4, 12: 3, 11: 2 };
  const FB = (c, cls = '', attr = '') => Carte.fronte(c, cls, attr, PUNTI_BRISCOLA[c.rango] ? { valore: PUNTI_BRISCOLA[c.rango] } : {});
  // briscola: per seme (la briscola in fondo), poi dalla più debole alla più forte
  const FORZA_BRISCOLA = { 2: 1, 4: 2, 5: 3, 6: 4, 7: 5, 11: 6, 12: 7, 13: 8, 3: 9, 1: 10 };
  const ordinaBriscola = (mano, semeB) => [...mano].sort((a, b) => ((a.seme === semeB) - (b.seme === semeB))
    || ORD_SEMI_40.indexOf(a.seme) - ORD_SEMI_40.indexOf(b.seme) || FORZA_BRISCOLA[a.rango] - FORZA_BRISCOLA[b.rango]);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plur = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

  function mazzoPiccolo(n, etichetta = 'Carte nel mazzo') {
    if (!n) return '';
    return `<div class="mazzo-mini" title="${etichetta}">${Carte.retro()}<span>${n}</span></div>`;
  }

  // nomi delle fazioni: in coppia "Voi"/"Loro", altrimenti i nomi dei giocatori
  function nomeFazione(ctx, posti) {
    const p = ctx.partita;
    if (p.aSquadre) return posti.includes(ctx.mio) ? 'Voi' : 'Loro';
    return ctx.nome(posti[0]);
  }

  // ======================= BRISCOLA =======================
  const briscola = {
    panno(ctx) {
      const p = ctx.partita;
      const giocate = p.tavolo.map((g, i) =>
        `<div class="giocata slot-${ctx.slot(g.posto)}" style="z-index:${i + 1}">${FB(g.carta)}</div>`).join('');
      return `<div class="area-mazzo">
          ${p.mazzo > 0 ? `<div class="briscola-sotto">${FB(p.briscola)}</div>` : ''}
          ${p.mazzo > 1 ? `<div class="mazzo-grande">${Carte.retro()}<span>${p.mazzo - 1}</span></div>` : ''}
          <div class="etichetta-briscola">${Carte.seme(p.briscola.seme)} briscola a ${Carte.SEMI[p.briscola.seme]}</div>
        </div>
        <div class="croce">${giocate}</div>`;
    },
    mano(ctx) {
      const p = ctx.partita;
      const attiva = p.turno === ctx.mio;
      // al buio: solo dorsi, si sceglie la posizione (il server non dice nemmeno quali carte sono)
      if (p.alBuio) {
        const posto = ['prima', 'seconda', 'terza'];
        return p.mano.map((c) => `<div class="carta retro ${attiva ? 'giocabile' : ''}" data-pos="${c.pos}" ${attiva ? `data-az="gioca" role="button" tabindex="0" aria-label="Gioca la ${posto[c.pos] || 'carta'} carta (coperta)"` : 'aria-label="Carta coperta"'}></div>`).join('');
      }
      return ordinaBriscola(p.mano, p.briscola.seme).map((c) =>
        FB(c, `${c.seme === p.briscola.seme ? 'segnata' : ''} ${attiva ? 'giocabile' : ''}`,
          attiva ? `data-az="gioca" role="button" tabindex="0" aria-label="Gioca ${Carte.nome(c)}"` : '')).join('');
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      return plur(p.maniPrese[posto], 'mano presa', 'mani prese');
    },
    clic(ctx, el) {
      if (el.dataset.az !== 'gioca') return;
      el.classList.add('via');
      ctx.invia(el.dataset.pos != null ? { tipo: 'gioca', pos: Number(el.dataset.pos) } : { tipo: 'gioca', carta: el.dataset.id });
    },
  };

  // ======================= SCOPA e SCOPONE =======================
  const scopa = {
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      // si possono toccare solo le carte delle prese ancora compatibili con quelle già scelte
      const compatibili = ui.scelta ? ui.scelta.opzioni.filter((o) => ui.scelta.sel.every((x) => o.includes(x))) : [];
      const selezionabili = new Set(compatibili.flat());
      const carte = ordina40(p.tavolo).map((c) => {
        let cls = '';
        if (p.inCorso && p.inCorso.presa.includes(c.id)) cls = 'presa';
        else if (selezionabili.has(c.id)) cls = ui.scelta.sel.includes(c.id) ? 'scelta' : 'selezionabile';
        return F40(c, cls, selezionabili.has(c.id) ? 'data-az="tavola" role="button" tabindex="0"' : '');
      });
      if (p.inCorso) carte.push(F40(p.inCorso.carta, `appena da-${ctx.slot(p.inCorso.posto)}`));
      const vuota = !carte.length ? '<p class="tavola-vuota">Tavola vuota</p>' : '';
      return `${mazzoPiccolo(p.mazzo)}<div class="tavola-carte">${carte.join('')}${vuota}</div>`;
    },
    mano(ctx) {
      const p = ctx.partita;
      const attiva = !!p.opzioni;
      const figure = ctx.partita.gioco !== 'rubamazzo'; // nel rubamazzo il valore delle figure non serve
      return ordinaMano40(p.mano).map((c) => {
        const cls = [attiva ? 'giocabile' : '', ctx.ui.scelta && ctx.ui.scelta.carta === c.id ? 'alzata' : ''].join(' ');
        const puoPrendere = attiva && p.opzioni[c.id] && p.opzioni[c.id].length;
        return (figure ? F40 : F)(c, `${cls} ${puoPrendere ? 'prende' : ''}`, attiva ? `data-az="mano" role="button" tabindex="0" aria-label="Gioca ${Carte.nome(c)}"` : '');
      }).join('');
    },
    azioni(ctx) {
      if (!ctx.ui.scelta) return bottoneOrdine(ctx.partita.mano.length);
      return `<span class="suggerimento">Tocca le carte in tavola che vuoi prendere</span>
        <button class="bottone piccolo-bt" data-az="annulla">Annulla</button>`;
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      const f = p.aSquadre ? posto % 2 : posto;
      const s = p.scope[f];
      return `${plur(p.preseCarte[f], 'carta', 'carte')}${s ? `, <b class="scope">${plur(s, 'scopa', 'scope')}</b>` : ''}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      const fazioni = p.totali.map((t, f) => `<span>${esc(nomeFazione(ctx, p.aSquadre ? [f, f + 2] : [f]))} <b>${t}</b></span>`);
      return `${fazioni.join('')}<span class="obiettivo">si vince a ${p.obiettivo}${p.quindici ? ' · scopa 15' : ''}${p.assoPigliaTutto ? ', asso piglia tutto' : ''}</span>`;
    },
    riepilogo(ctx) {
      const p = ctx.partita;
      const r = p.riepilogo;
      if (!r) return null;
      const nomi = r.righe.map((x) => esc(nomeFazione(ctx, x.posti)));
      const riga = (titolo, chiave, fmt) => `<tr><th>${titolo}</th>${r.righe.map((x, f) =>
        `<td class="${r.assegnati[chiave] === f ? 'vinto' : ''}">${fmt(x)}</td>`).join('')}</tr>`;
      return `<h2>Fine smazzata ${r.smazzata}</h2>
        <div class="tabella-scorre"><table class="conti">
          <thead><tr><th></th>${nomi.map((n) => `<th>${n}</th>`).join('')}</tr></thead>
          <tbody>
            ${riga('Carte', 'carte', (x) => x.carte)}
            ${riga('Quadri', 'quadri', (x) => x.quadri)}
            ${riga('Settebello', 'settebello', (x) => (x.settebello ? 'sì' : ''))}
            ${riga('Primiera', 'primiera', (x) => x.primiera || '–')}
            <tr><th>Scope</th>${r.righe.map((x) => `<td class="${x.scope ? 'vinto' : ''}">${x.scope}</td>`).join('')}</tr>
            <tr class="somma"><th>Punti fatti</th>${r.righe.map((x) => `<td>${x.punti}</td>`).join('')}</tr>
            <tr class="somma"><th>Totale</th>${r.righe.map((x) => `<td>${x.totale}</td>`).join('')}</tr>
          </tbody>
        </table></div>
        ${r.avanzo ? `<p class="piccolo">Le ${r.avanzo} carte rimaste in tavola sono andate a ${r.ultimaPresa === ctx.mio ? 'te' : esc(ctx.nome(r.ultimaPresa))}.</p>` : ''}`;
    },
    clic(ctx, el) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const az = el.dataset.az;
      if (az === 'annulla') { ui.scelta = null; return ctx.ridisegna(); }
      if (az === 'ordina') return cambiaOrdine(ctx);
      if (az === 'mano') {
        const id = el.dataset.id;
        const op = (p.opzioni && p.opzioni[id]) || [];
        if (ui.scelta && ui.scelta.carta === id) { ui.scelta = null; return ctx.ridisegna(); }
        if (op.length <= 1) { ui.scelta = null; el.classList.add('via'); return ctx.invia({ tipo: 'gioca', carta: id, presa: op[0] || [] }); }
        ui.scelta = { carta: id, opzioni: op, sel: [] };
        return ctx.ridisegna();
      }
      if (az === 'tavola' && ui.scelta) {
        const id = el.dataset.id;
        const s = ui.scelta;
        s.sel = s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id];
        if (!s.opzioni.some((o) => s.sel.every((x) => o.includes(x)))) s.sel = [id];
        const trovata = s.opzioni.find((o) => o.length === s.sel.length && o.every((x) => s.sel.includes(x)));
        if (trovata) { ui.scelta = null; ctx.invia({ tipo: 'gioca', carta: s.carta, presa: trovata }); }
        ctx.ridisegna();
      }
    },
    reset(ctx) { if (!ctx.partita.opzioni) ctx.ui.scelta = null; },
  };

  // ======================= RUBAMAZZO =======================
  const stessoBersaglio = (a, b) => a.tipo === b.tipo && (a.tipo === 'tavolo' ? a.id === b.id : a.posto === b.posto);
  const rubamazzo = {
    panno(ctx) {
      const p = ctx.partita;
      const ops = ctx.ui.scelta ? ctx.ui.scelta.opzioni : [];
      const carte = p.tavolo.map((c) => {
        const bersaglio = ops.some((o) => o.tipo === 'tavolo' && o.id === c.id);
        const presa = p.inCorso && p.inCorso.bersaglio.tipo === 'tavolo' && p.inCorso.bersaglio.id === c.id;
        return F(c, presa ? 'presa' : bersaglio ? 'selezionabile' : '', bersaglio ? 'data-az="bersaglio" data-tipo="tavolo" role="button" tabindex="0"' : '');
      });
      if (p.inCorso) carte.push(F(p.inCorso.carta, `appena da-${ctx.slot(p.inCorso.posto)}`));
      const vuota = !carte.length ? '<p class="tavola-vuota">Tavola vuota</p>' : '';
      return `${mazzoPiccolo(p.mazzo)}<div class="tavola-carte">${carte.join('')}${vuota}</div>`;
    },
    mano: (ctx) => scopa.mano(ctx),
    azioni: scopa.azioni,
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      const m = p.mazzetti[posto];
      const ops = ctx.ui.scelta ? ctx.ui.scelta.opzioni : [];
      const bersaglio = ops.some((o) => o.tipo === 'mazzo' && o.posto === posto);
      const rubato = p.inCorso && p.inCorso.bersaglio.tipo === 'mazzo' && p.inCorso.bersaglio.posto === posto;
      if (!m.conteggio) return '<span class="mazzetto-vuoto">nessuna carta</span>';
      return `<div class="mazzetto ${bersaglio ? 'selezionabile' : ''} ${rubato ? 'presa' : ''}" ${bersaglio ? `data-az="bersaglio" data-tipo="mazzo" data-posto="${posto}" role="button" tabindex="0"` : ''}>
        ${F(m.cima, 'mini')}<span>${m.conteggio}</span></div>`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return p.mazzetti.map((m, i) => `<span>${esc(ctx.nome(i))} <b>${m.conteggio}</b></span>`).join('') + '<span class="obiettivo">vince chi ha più carte</span>';
    },
    clic(ctx, el) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const az = el.dataset.az;
      if (az === 'annulla') { ui.scelta = null; return ctx.ridisegna(); }
      if (az === 'ordina') return cambiaOrdine(ctx);
      if (az === 'mano') {
        const id = el.dataset.id;
        const op = (p.opzioni && p.opzioni[id]) || [];
        if (ui.scelta && ui.scelta.carta === id) { ui.scelta = null; return ctx.ridisegna(); }
        if (op.length <= 1) { ui.scelta = null; el.classList.add('via'); return ctx.invia({ tipo: 'gioca', carta: id, bersaglio: op[0] || null }); }
        ui.scelta = { carta: id, opzioni: op };
        return ctx.ridisegna();
      }
      if (az === 'bersaglio' && ui.scelta) {
        const b = el.dataset.tipo === 'tavolo' ? { tipo: 'tavolo', id: el.dataset.id } : { tipo: 'mazzo', posto: Number(el.dataset.posto) };
        const s = ui.scelta;
        if (s.opzioni.some((o) => stessoBersaglio(o, b))) { ui.scelta = null; ctx.invia({ tipo: 'gioca', carta: s.carta, bersaglio: b }); }
        ctx.ridisegna();
      }
    },
    reset: scopa.reset,
  };
  rubamazzo.azioni = (ctx) => (ctx.ui.scelta
    ? `<span class="suggerimento">Scegli: una carta in tavola o il mazzetto di un avversario</span><button class="bottone piccolo-bt" data-az="annulla">Annulla</button>`
    : '');

  // ======================= SCALA 40 =======================
  const R = window.ScalaRegole;
  const ORD_SEMI = ['c', 'q', 'f', 'p'];
  function ordina(mano, modo) {
    const k = (c) => (c.jolly ? 99 : c.rango === 1 ? 14 : c.rango);
    return [...mano].sort((a, b) => {
      if (a.jolly !== b.jolly) return a.jolly ? 1 : -1;
      if (modo === 'valore') return k(a) - k(b) || ORD_SEMI.indexOf(a.seme) - ORD_SEMI.indexOf(b.seme);
      return ORD_SEMI.indexOf(a.seme) - ORD_SEMI.indexOf(b.seme) || k(a) - k(b);
    });
  }
  function statoUi(ctx) {
    const ui = ctx.ui;
    const ids = new Set(ctx.partita.mano.map((c) => c.id));
    ui.sel = (ui.sel || []).filter((id) => ids.has(id));
    ui.prep = (ui.prep || []).map((g) => g.filter((id) => ids.has(id))).filter((g) => g.length >= 3);
    ui.ordine = ui.ordine || 'seme';
    return ui;
  }
  const carteDi = (ctx, ids) => ids.map((id) => ctx.partita.mano.find((c) => c.id === id)).filter(Boolean);

  const scala40 = {
    panno(ctx) {
      const p = ctx.partita;
      const mt = p.mioTurno;
      const pesca = mt && mt.fase === 'pesca';
      const ui = statoUi(ctx);
      const puoAttaccare = mt && mt.fase === 'gioca' && p.aperto[ctx.mio] && ui.sel.length;
      const perGiocatore = {};
      for (const m of p.combinazioni) (perGiocatore[m.posto] = perGiocatore[m.posto] || []).push(m);
      const gruppi = Object.keys(perGiocatore).map(Number).sort((a, b) => ctx.slot(a) - ctx.slot(b)).map((posto) => `
        <div class="giochi-di"><div class="giochi-nome">${esc(ctx.nome(posto))}</div>
          <div class="giochi-riga">${perGiocatore[posto].map((m) => {
            const cliccabile = puoAttaccare; // ai giochi di tutti, anche nel turno in cui si apre
            return `<div class="comb ${cliccabile ? 'selezionabile' : ''}" ${cliccabile ? `data-az="comb" data-comb="${m.id}" role="button" tabindex="0"` : ''} title="${m.tipo === 'scala' ? 'Scala' : 'Tris'} da ${m.punti} punti">
              ${m.carte.map((c) => (c.jolly && cliccabile && ui.sel.length === 1
                ? F(c, 'mini', `data-az="comb-jolly" data-comb="${m.id}" data-jolly="${c.id}" title="Scambia il jolly"`)
                : F(c, 'mini'))).join('')}</div>`;
          }).join('')}</div></div>`).join('');
      return `<div class="scala-banco">
          <div class="scala-mazzi">
            <div class="mazzo-grande ${pesca ? 'selezionabile' : ''}" ${pesca ? 'data-az="pesca" data-da="mazzo" role="button" tabindex="0" title="Pesca dal mazzo"' : ''}>${Carte.retro()}<span>${p.mazzo}</span></div>
            <div class="pozzo ${pesca && p.pozzo ? 'selezionabile' : ''}" ${pesca && p.pozzo ? 'data-az="pesca" data-da="pozzo" role="button" tabindex="0" title="Prendi lo scarto"' : ''}>
              ${p.pozzo ? F(p.pozzo) : '<div class="carta vuota"></div>'}<small>scarti</small></div>
          </div>
          <div class="scala-giochi">${gruppi || '<p class="tavola-vuota">Ancora nessuna combinazione in tavola</p>'}</div>
        </div>`;
    },
    mano(ctx) {
      const p = ctx.partita;
      const ui = statoUi(ctx);
      const preparate = new Set(ui.prep.flat());
      const daUsare = new Set(p.mioTurno ? p.mioTurno.daUsare : []);
      return `<div class="mano-scala">${ordina(p.mano, ui.ordine).filter((c) => !preparate.has(c.id)).map((c) =>
        F(c, `giocabile ${ui.sel.includes(c.id) ? 'alzata' : ''} ${daUsare.has(c.id) ? 'da-usare' : ''}`, 'data-az="sel" role="button" tabindex="0"')).join('')}</div>`;
    },
    azioni(ctx) {
      const p = ctx.partita;
      const mt = p.mioTurno;
      const ui = statoUi(ctx);
      const aperto = p.aperto[ctx.mio];
      const b = [];
      if (p.eliminati[ctx.mio]) return '<span class="suggerimento">Sei stato eliminato: puoi guardare come finisce o uscire.</span>';
      if (ui.prep.length) {
        const tot = ui.prep.reduce((s, g) => s + (R.valuta(carteDi(ctx, g)) || { punti: 0 }).punti, 0);
        b.push(`<div class="preparate">${ui.prep.map((g) => `<div class="comb">${carteDi(ctx, g).map((c) => F(c, 'mini')).join('')}</div>`).join('')}</div>`);
        const ok = aperto || tot >= 40;
        b.push(`<button class="bottone piccolo-bt primario-bt" data-az="cala" ${mt && mt.fase === 'gioca' && ok ? '' : 'disabled'}>Cala${aperto ? '' : ` (${tot}/40)`}</button>`);
        b.push('<button class="bottone piccolo-bt" data-az="annulla-prep">Riprendi in mano</button>');
      }
      if (ui.sel.length >= 3) {
        const v = R.valuta(carteDi(ctx, ui.sel));
        b.push(v
          ? `<button class="bottone piccolo-bt" data-az="prepara">Prepara ${v.tipo === 'scala' ? 'scala' : 'tris'} (${v.punti})</button>`
          : '<span class="suggerimento">Queste carte non formano una combinazione</span>');
      }
      if (mt && mt.fase === 'pesca') b.push('<span class="suggerimento">Pesca dal mazzo o prendi lo scarto</span>');
      if (mt && mt.fase === 'gioca') {
        if (ui.sel.length === 1) b.push('<button class="bottone piccolo-bt primario-bt" data-az="scarta">Scarta e passa</button>');
        if (ui.sel.length && aperto) b.push('<span class="suggerimento">oppure tocca un gioco in tavola per attaccare</span>');
        if (mt.puoRestituire) b.push('<button class="bottone piccolo-bt" data-az="restituisci">Rimetti lo scarto</button>');
        if (!ui.sel.length && !ui.prep.length) b.push(`<span class="suggerimento">${aperto ? 'Seleziona carte per calare, attaccare o scartare' : 'Seleziona le carte per le combinazioni: servono 40 punti per aprire'}</span>`);
      }
      b.push(`<span class="ordina">Ordina <button class="bottone mini-bt ${ui.ordine === 'seme' ? 'attivo' : ''}" data-az="ordina" data-modo="seme">seme</button><button class="bottone mini-bt ${ui.ordine === 'valore' ? 'attivo' : ''}" data-az="ordina" data-modo="valore">valore</button></span>`);
      return b.join('');
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      if (p.eliminati[posto]) return '<span class="eliminato">eliminato</span>';
      return `${p.penalita[posto]} penalità, <span class="${p.aperto[posto] ? 'aperto' : ''}">${p.aperto[posto] ? 'ha aperto' : 'deve aprire'}</span>`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return p.penalita.map((x, i) => `<span class="${p.eliminati[i] ? 'barrato' : ''}">${esc(ctx.nome(i))} <b>${x}</b></span>`).join('') + `<span class="obiettivo">penalità, eliminato a ${p.limite}</span>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.mioTurno) return p.mioTurno.fase === 'pesca' ? 'Tocca a te: pesca' : 'Tocca a te: gioca';
      return null;
    },
    riepilogo(ctx) {
      const r = ctx.partita.riepilogo;
      if (!r) return null;
      return `<h2>${r.nulla ? 'Smazzata annullata' : `${esc(ctx.nome(r.vincitore))} ${r.vincitore === ctx.mio ? 'hai chiuso' : 'ha chiuso'}`}</h2>
        <div class="tabella-scorre"><table class="conti">
          <thead><tr><th></th><th>Penalità</th><th>Totale</th></tr></thead>
          <tbody>${r.righe.map((x) => `<tr class="${x.eliminato ? 'fuori' : ''}"><th>${esc(ctx.nome(x.posto))}</th>
            <td>${x.penalita}${!x.aperto && x.posto !== r.vincitore && !r.nulla ? ' <small>(non aperto)</small>' : ''}</td>
            <td>${x.totale}${x.eliminato ? ' <small>eliminato</small>' : ''}</td></tr>`).join('')}</tbody>
        </table></div>`;
    },
    clic(ctx, el) {
      const p = ctx.partita;
      const ui = statoUi(ctx);
      const az = el.dataset.az;
      const id = el.dataset.id;
      switch (az) {
        case 'pesca': return ctx.invia({ tipo: 'pesca', da: el.dataset.da });
        case 'sel': ui.sel = ui.sel.includes(id) ? ui.sel.filter((x) => x !== id) : [...ui.sel, id]; return ctx.ridisegna();
        case 'ordina': ui.ordine = el.dataset.modo; return ctx.ridisegna();
        case 'prepara': ui.prep.push(ui.sel); ui.sel = []; return ctx.ridisegna();
        case 'annulla-prep': ui.prep = []; return ctx.ridisegna();
        case 'cala': ctx.invia({ tipo: 'cala', combinazioni: ui.prep }); ui.prep = []; return ctx.ridisegna();
        case 'scarta': ctx.invia({ tipo: 'scarta', carta: ui.sel[0] }); ui.sel = []; return ctx.ridisegna();
        case 'restituisci': return ctx.invia({ tipo: 'restituisci' });
        case 'comb-jolly': ctx.invia({ tipo: 'jolly', combinazione: el.dataset.comb, carta: ui.sel[0], jollyId: el.dataset.jolly }); ui.sel = []; return ctx.ridisegna();
        case 'comb': ctx.invia({ tipo: 'attacca', combinazione: el.dataset.comb, carte: ui.sel }); ui.sel = []; return ctx.ridisegna();
      }
      return undefined;
    },
    reset() {},
    manoLarga: true,
  };

  return { briscola, scopa, scopone: scopa, rubamazzo, scala40, _ordinaMano40: ordinaMano40, _bottoneOrdine: bottoneOrdine, _cambiaOrdine: cambiaOrdine };
})();
