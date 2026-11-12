// Giochi a tabellone (senza carte in mano). Si aggiungono a window.Tavoli come i giochi di carte.
// Con "libero: true" il tabellone occupa tutto il tavolo e gli avversari stanno in una fila in alto.
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ======================= TRIS =======================
  const SEGNO = {
    X: '<svg viewBox="0 0 100 100" class="segno segno-x" aria-hidden="true"><path d="M24 24 76 76"/><path d="M76 24 24 76"/></svg>',
    O: '<svg viewBox="0 0 100 100" class="segno segno-o" aria-hidden="true"><circle cx="50" cy="50" r="28"/></svg>',
  };
  const NOME_SEGNO = { X: '✕', O: '◯' };

  function casella(ctx, { valore, attiva, nuova, vince, dati, etichetta, svanisce, sparito }) {
    const p = ctx.partita;
    const s = valore !== null && valore !== undefined ? p.simboli[valore] : null;
    const cls = ['tr-cella', s ? 'piena' : '', attiva ? 'attiva' : '', nuova ? 'nuova' : '', vince ? 'vince' : '', svanisce ? 'svanisce' : '', sparito ? 'sparito' : ''].join(' ');
    if (attiva) return `<button type="button" class="${cls}" data-az="segna" ${dati} aria-label="${etichetta}"></button>`;
    return `<div class="${cls}" aria-label="${s ? NOME_SEGNO[s] : etichetta}">${s ? SEGNO[s] : ''}</div>`;
  }

  // "↶ Annulla mossa" contro il computer (tris, forza 4)
  const annullaMossa = (p) => (p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt f4-annulla" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '');
  const tris = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const mio = p.turno === ctx.mio && !p.finita;
      if (p.variante === 'ultimate') {
        const riq = [];
        for (let t = 0; t < 9; t++) {
          const w = p.vinte[t];
          const giocabile = w === null && (p.prossima === null || p.prossima === t) && !p.finita;
          const celle = [];
          for (let i = 0; i < 9; i++) {
            const v = p.tabs[t * 9 + i];
            celle.push(casella(ctx, {
              valore: v,
              attiva: mio && giocabile && v === null,
              nuova: p.ultima && p.ultima.tab === t && p.ultima.cella === i,
              dati: `data-tab="${t}" data-cella="${i}"`,
              etichetta: `Riquadro ${t + 1}, casella ${i + 1}`,
            }));
          }
          const sopra = w !== null && w !== 'pari' ? `<div class="tr-conquista">${SEGNO[p.simboli[w]]}</div>` : '';
          const cls = ['tr-riquadro', giocabile ? (mio ? 'giocabile mio' : 'giocabile') : '', w === 'pari' ? 'pari' : '', w !== null && w !== 'pari' ? 'conquistato' : '',
            p.linea && p.linea.includes(t) ? 'vince' : ''].join(' ');
          riq.push(`<div class="${cls}">${celle.join('')}${sopra}</div>`);
        }
        return `<div class="tr-tabellone tr-ultimate">${riq.join('')}</div>${annullaMossa(p)}`;
      }
      const lato = p.lato;
      const celle = p.celle.map((v, i) => casella(ctx, {
        valore: v,
        attiva: mio && v === null,
        nuova: p.ultima && p.ultima.cella === i,
        vince: p.linea && p.linea.includes(i),
        svanisce: p.fantasma && v !== null && p.prossimoVia[v] === i && !p.finita,
        sparito: p.fantasma && p.sparito === i && v === null,
        dati: `data-cella="${i}"`,
        etichetta: `Casella riga ${Math.floor(i / lato) + 1}, colonna ${(i % lato) + 1}`,
      }));
      const nota = p.fantasma ? `<p class="piccolo tr-nota">👻 Ghost Tris: massimo ${p.limite} segni a testa, il più vecchio (trasparente) sparisce alla prossima mossa · ${p.mosse}/${p.maxMosse} segni</p>` : '';
      return `<div class="tr-tabellone tr-lato-${lato}" style="--lato:${lato}">${celle.join('')}</div>${nota}${annullaMossa(p)}`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const s = NOME_SEGNO[p.simboli[p.turno]];
      if (p.turno === ctx.mio) {
        if (p.variante === 'ultimate' && p.prossima === null) return `Tocca a te (${s}): scegli un riquadro qualsiasi`;
        return `Tocca a te (${s})`;
      }
      return `Tocca a ${ctx.nome(p.turno)} (${s})`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return [ctx.mio, 1 - ctx.mio].map((posto) => {
        const riq = p.variante === 'ultimate' ? ` · ${p.vinte.filter((x) => x === posto).length} riquadri` : '';
        return `<span>${esc(ctx.nome(posto))} <b>${NOME_SEGNO[p.simboli[posto]]}</b>${riq}</span>`;
      }).join('');
    },
    infoPosto(ctx, posto) {
      return `gioca con ${NOME_SEGNO[ctx.partita.simboli[posto]]}`;
    },
    clic(ctx, el) {
      if (el.dataset.az === 'annullaMossa') return ctx.invia({ tipo: 'annulla' });
      if (el.dataset.az !== 'segna') return;
      const a = { tipo: 'segna', cella: Number(el.dataset.cella) };
      if (el.dataset.tab !== undefined) a.tab = Number(el.dataset.tab);
      el.disabled = true;
      ctx.invia(a);
    },
  };

  // ======================= FORZA 4 =======================
  const forza4 = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const mio = p.turno === ctx.mio && !p.finita;
      const colore = p.turno != null ? p.colori[p.turno] : '';
      const colonne = [];
      for (let c = 0; c < p.colonne; c++) {
        const piena = p.celle[c] !== null;
        const buchi = [];
        for (let r = 0; r < p.righe; r++) {
          const i = r * p.colonne + c;
          const v = p.celle[i];
          const nuova = p.ultima && p.ultima.cella === i;
          const vince = p.linea && p.linea.includes(i);
          buchi.push(`<div class="f4-buco">${v !== null ? `<span class="f4-pedina ${p.colori[v]} ${nuova ? 'nuova' : ''} ${vince ? 'vince' : ''}" style="--cade:${r + 1}"></span>` : ''}</div>`);
        }
        const attiva = mio && !piena;
        const inner = `<div class="f4-sopra"><span class="f4-pedina fantasma ${colore}"></span></div>${buchi.join('')}`;
        colonne.push(attiva
          ? `<button type="button" class="f4-col attiva" data-az="cala" data-col="${c}" aria-label="Cala nella colonna ${c + 1}">${inner}</button>`
          : `<div class="f4-col">${inner}</div>`);
      }
      const annulla = p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt f4-annulla" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '';
      return `<div class="f4" style="--col:${p.colonne};--rig:${p.righe}">${colonne.join('')}</div>${annulla}`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const col = p.colori[p.turno] === 'rosso' ? '🔴' : '🟡';
      return p.turno === ctx.mio ? `Tocca a te ${col}` : `Tocca a ${ctx.nome(p.turno)} ${col}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return [ctx.mio, 1 - ctx.mio].map((k) => `<span>${esc(ctx.nome(k))} ${p.colori[k] === 'rosso' ? '🔴' : '🟡'}</span>`).join('');
    },
    infoPosto(ctx, posto) { return ctx.partita.colori[posto] === 'rosso' ? 'pedine rosse' : 'pedine gialle'; },
    clic(ctx, el) {
      if (el.dataset.az === 'annullaMossa') return ctx.invia({ tipo: 'annulla' });
      if (el.dataset.az !== 'cala') return;
      el.disabled = true;
      ctx.invia({ tipo: 'cala', colonna: Number(el.dataset.col) });
    },
  };

  // ======================= BATTAGLIA NAVALE =======================
  const NR = window.NavaleRegole;
  const LETTERE = 'ABCDEFGHIJ';
  let ctxNavale = null; // l'ultimo contesto, per anteprima e tasto R

  const nomeCella = (i) => `${LETTERE[Math.floor(i / 10)]}${(i % 10) + 1}`;
  // forma della nave: estremi arrotondati nel verso giusto
  function formaNavi(navi) {
    const forma = new Map();
    for (const n of navi) {
      const cs = NR.celleNave(n);
      cs.forEach((k, j) => {
        const f = n.lung === 1 ? 'singola' : j === 0 ? (n.vert ? 'su' : 'sx') : j === cs.length - 1 ? (n.vert ? 'giu' : 'dx') : n.vert ? 'mezzo-v' : 'mezzo-o';
        forma.set(k, { f, n });
      });
    }
    return forma;
  }

  function griglia({ celle, titolo, sottotitolo, cls = '', attr = '' }) {
    const testa = `<div class="bn-ang"></div>${Array.from({ length: 10 }, (_, c) => `<div class="bn-lab">${c + 1}</div>`).join('')}`;
    let corpo = '';
    for (let r = 0; r < 10; r++) {
      corpo += `<div class="bn-lab">${LETTERE[r]}</div>`;
      for (let c = 0; c < 10; c++) corpo += celle(r * 10 + c);
    }
    return `<section class="bn-blocco ${cls}" ${attr}><header><b>${titolo}</b>${sottotitolo ? `<span>${sottotitolo}</span>` : ''}</header>
      <div class="bn-griglia">${testa}${corpo}</div></section>`;
  }

  function cellaGriglia(g, i, { mie, piazzate, cliccabile, ultimo, dati }) {
    const colpo = g ? g.colpi[i] : null;
    const cls = ['bn-cella'];
    let dentro = '';
    const forma = piazzate && piazzate.get(i);
    if (forma) cls.push('nave', `f-${forma.f}`);
    if (g && g.affondateMap && g.affondateMap.has(i)) cls.push('nave', 'affondata', `f-${g.affondateMap.get(i).f}`);
    if (colpo === 'x') { cls.push('colpita'); dentro = '<span class="bn-fuoco"></span>'; }
    else if (colpo === 'a') { cls.push('acqua'); dentro = '<span class="bn-spruzzo"></span>'; }
    else if (g && g.acquaSet && g.acquaSet.has(i)) cls.push('acqua-certa');
    if (ultimo) cls.push('ultimo');
    if (mie && !cliccabile) cls.push('mia');
    if (cliccabile) return `<button type="button" class="${cls.join(' ')} tiro" ${dati} aria-label="Spara in ${nomeCella(i)}"></button>`;
    return `<div class="${cls.join(' ')}" ${dati || ''}>${dentro}</div>`;
  }

  function prepara(g) { // mappe per disegnare più in fretta
    if (!g.affondateMap) { g.affondateMap = formaNavi(g.affondate); g.acquaSet = new Set(g.acquaCerta); }
    return g;
  }

  function naviRimaste(g) {
    return `<span class="bn-rimaste">${g.rimaste.map((l) => `<i style="--l:${l}"></i>`).join('')}</span>`;
  }

  const battaglia = {
    libero: true,
    reset(ctx) { ctxNavale = ctx; },
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const io = p.griglie[ctx.mio];
      if (!ui.navi) { ui.navi = []; ui.vert = false; ui.sel = 0; }

      // --------- schieramento ---------
      if (p.fase === 'schieramento' && !io.pronto) {
        const comp = p.composizione;
        const usate = new Set(ui.navi.map((n) => n.k));
        if (usate.has(ui.sel) || ui.sel == null) ui.sel = comp.findIndex((_, k) => !usate.has(k));
        const piazzate = formaNavi(ui.navi);
        const celle = (i) => `<div class="bn-cella piazza ${piazzate.has(i) ? `nave f-${piazzate.get(i).f}` : ''}" data-az="piazza" data-cella="${i}"></div>`;
        const lista = comp.map((l, k) => `<button type="button" class="bn-nave-bt ${usate.has(k) ? 'usata' : ''} ${ui.sel === k ? 'scelta' : ''}" data-az="scegli" data-k="${k}" ${usate.has(k) ? 'disabled' : ''}>
            <span class="bn-sagoma" style="--l:${l}"></span><small>${NR.NOMI[l]}</small></button>`).join('');
        const tutte = ui.navi.length === comp.length;
        return `<div class="bn bn-schiera">
          ${griglia({ celle, titolo: 'La tua flotta', sottotitolo: tutte ? 'Tutto pronto?' : `Mancano ${comp.length - ui.navi.length} navi`, cls: 'bn-mia' })}
          <aside class="bn-pannello">
            <p class="bn-istruzioni">Scegli una nave e clicca sulla griglia. <kbd>R</kbd> la gira. Clicca una nave già messa per toglierla. Le navi non possono toccarsi, nemmeno in diagonale.</p>
            <div class="bn-lista">${lista}</div>
            <div class="bn-comandi">
              <button type="button" class="bottone piccolo-bt" data-az="ruota">↻ Ruota (${ui.vert ? 'verticale' : 'orizzontale'})</button>
              <button type="button" class="bottone piccolo-bt" data-az="casuale">🎲 Casuale</button>
              <button type="button" class="bottone piccolo-bt" data-az="svuota" ${ui.navi.length ? '' : 'disabled'}>Svuota</button>
            </div>
            <button type="button" class="bottone primario-bt bn-pronto" data-az="pronto" ${tutte ? '' : 'disabled'}>Pronto!</button>
          </aside></div>`;
      }

      // --------- in attesa degli altri ---------
      const mie = formaNavi(io.navi || []);
      const mia = prepara(io);
      const ult = p.ultimo;
      const celleMie = (i) => cellaGriglia(mia, i, { mie: true, piazzate: mie, ultimo: ult && ult.su === ctx.mio && ult.cella === i });
      if (p.fase === 'schieramento') {
        const mancano = p.griglie.map((g, k) => (!g.pronto ? ctx.nome(k) : null)).filter(Boolean);
        return `<div class="bn">${griglia({ celle: celleMie, titolo: 'La tua flotta', sottotitolo: 'schierata', cls: 'bn-mia' })}
          <aside class="bn-pannello"><p class="bn-istruzioni">Flotta schierata ✓</p><p class="piccolo">Aspettiamo ${esc(mancano.join(', '))}…</p></aside></div>`;
      }

      // --------- battaglia ---------
      const mioTurno = p.turno === ctx.mio && !p.finita;
      const blocchi = [griglia({ celle: celleMie, titolo: 'La tua flotta', sottotitolo: io.vivo ? naviRimaste(io) : 'affondata', cls: `bn-mia ${io.vivo ? '' : 'fuori'}` })];
      for (let k = 0; k < p.n; k++) {
        if (k === ctx.mio) continue;
        const g = prepara(p.griglie[k]);
        const rivelate = p.finita && g.navi ? formaNavi(g.navi.filter((x) => !x.affondata)) : null;
        const celle = (i) => cellaGriglia(g, i, {
          piazzate: rivelate,
          cliccabile: mioTurno && g.vivo && g.colpi[i] === null && !g.acquaSet.has(i),
          ultimo: ult && ult.su === k && ult.cella === i,
          dati: `data-az="spara" data-b="${k}" data-cella="${i}"`,
        });
        blocchi.push(griglia({
          celle,
          titolo: esc(ctx.nome(k)),
          sottotitolo: g.vivo ? naviRimaste(g) : 'flotta affondata',
          cls: `bn-avv ${g.vivo ? '' : 'fuori'} ${mioTurno && g.vivo ? 'mira' : ''} ${p.turno === k ? 'di-turno' : ''}`,
        }));
      }
      return `<div class="bn bn-battaglia bn-n${p.n}">${blocchi.join('')}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.fase === 'schieramento') return p.griglie[ctx.mio].pronto ? 'Aspetta che gli altri schierino' : 'Schiera la tua flotta';
      if (p.turno === ctx.mio) return p.n > 2 ? 'Tocca a te: scegli chi colpire' : 'Tocca a te: spara!';
      return `Tocca a ${ctx.nome(p.turno)}`;
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      const g = p.griglie[posto];
      if (p.fase === 'schieramento') return g.pronto ? 'pronto ✓' : 'sta schierando…';
      return g.vivo ? `${g.rimaste.length} ${g.rimaste.length === 1 ? 'nave' : 'navi'} a galla` : '<span class="eliminato">affondato</span>';
    },
    clic(ctx, el) {
      const ui = ctx.ui;
      const p = ctx.partita;
      const az = el.dataset.az;
      if (az === 'spara') { el.disabled = true; return ctx.invia({ tipo: 'spara', bersaglio: Number(el.dataset.b), cella: Number(el.dataset.cella) }); }
      if (p.fase !== 'schieramento') return;
      if (az === 'scegli') ui.sel = Number(el.dataset.k);
      else if (az === 'ruota') ui.vert = !ui.vert;
      else if (az === 'svuota') { ui.navi = []; ui.sel = 0; }
      else if (az === 'casuale') ui.navi = assegnaIndici(NR.casuale(p.flotta), p.composizione);
      else if (az === 'pronto') { if (ui.navi.length === p.composizione.length) ctx.invia({ tipo: 'schiera', navi: ui.navi.map(({ r, c, lung, vert }) => ({ r, c, lung, vert })) }); return; }
      else if (az === 'piazza') {
        const i = Number(el.dataset.cella);
        const presa = ui.navi.findIndex((n) => NR.celleNave(n).includes(i));
        if (presa >= 0) { ui.sel = ui.navi[presa].k; ui.navi.splice(presa, 1); }
        else {
          const n = naveInCella(ctx, i);
          if (!n) return;
          if (!NR.puoMettere(ui.navi, n)) return ctx.avviso('Qui non ci sta: le navi non possono toccarsi', 1600);
          ui.navi.push(n);
          ui.sel = null;
        }
      }
      ctx.ridisegna();
      anteprima(ctxNavale, ultimaCella);
    },
  };

  // la nave scelta, messa con la prua in questa casella (se esce dalla griglia la sposta indietro)
  function naveInCella(ctx, i) {
    const ui = ctx.ui;
    const p = ctx.partita;
    if (ui.sel == null || ui.sel < 0) return null;
    const lung = p.composizione[ui.sel];
    let r = Math.floor(i / 10), c = i % 10;
    const vert = lung > 1 && ui.vert;
    if (vert) r = Math.min(r, 10 - lung); else c = Math.min(c, 10 - lung);
    return { r, c, lung, vert, k: ui.sel };
  }
  function assegnaIndici(navi, comp) {
    const libere = comp.map((l, k) => ({ l, k }));
    return navi.map((n) => { const j = libere.findIndex((x) => x.l === n.lung); const { k } = libere.splice(j, 1)[0]; return { ...n, k }; });
  }

  // anteprima della nave sotto il mouse (senza ridisegnare tutto)
  let ultimaCella = null;
  function anteprima(ctx, i) {
    document.querySelectorAll('.bn-cella.ante, .bn-cella.ante-no').forEach((el) => el.classList.remove('ante', 'ante-no'));
    if (!ctx || i == null || !ctx.partita || ctx.partita.gioco !== 'battaglia' || ctx.partita.fase !== 'schieramento') return;
    const n = naveInCella(ctx, i);
    if (!n || ctx.ui.navi.some((x) => NR.celleNave(x).includes(i))) return;
    const ok = NR.puoMettere(ctx.ui.navi, n);
    for (const k of NR.celleNave(n)) {
      const el = document.querySelector(`.bn-mia .bn-cella[data-cella="${k}"]`);
      if (el) el.classList.add(ok ? 'ante' : 'ante-no');
    }
  }
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('.bn-cella.piazza');
    ultimaCella = el ? Number(el.dataset.cella) : null;
    anteprima(ctxNavale, ultimaCella);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'r' && e.key !== 'R') || !ctxNavale || e.target.closest('input, textarea')) return;
    const p = ctxNavale.partita;
    if (!p || p.gioco !== 'battaglia' || p.fase !== 'schieramento' || p.griglie[ctxNavale.mio].pronto) return;
    ctxNavale.ui.vert = !ctxNavale.ui.vert;
    ctxNavale.ridisegna();
    anteprima(ctxNavale, ultimaCella);
  });

  // ======================= comuni a dama e scacchi =======================
  // pannello laterale con i due giocatori (avversario in alto, tu in basso)
  function schedaGiocatore(ctx, posto, { extra = '', colore = '', attivo = false }) {
    return `<div class="sc-giocatore ${attivo ? 'attivo' : ''} ${posto === ctx.mio ? 'sc-io' : ''}">
      <div class="sc-nome"><span class="sc-pallino ${colore}"></span><b>${esc(ctx.nome(posto))}</b></div>${extra}</div>`;
  }

  // ======================= DAMA =======================
  const CORONA = '<svg viewBox="0 0 40 40" class="dm-corona" aria-hidden="true"><path d="M9 27l-2-13 7 6 6-10 6 10 7-6-2 13z"/><rect x="9" y="28" width="22" height="4" rx="1.5"/></svg>';
  const dama = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const mioLato = p.lato[ctx.mio];
      const giro = mioLato === 1; // il nero vede la damiera girata
      const mio = p.turno === ctx.mio && !p.finita;
      const perc = ui.perc || [];
      const compatibili = mio ? p.mosse.filter((m) => perc.every((k, j) => m.percorso[j] === k)) : [];
      const partenze = new Set(mio && perc.length <= 1 ? p.mosse.map((m) => m.percorso[0]) : []); // si può cambiare pezzo finché non si è a metà presa
      const prossime = new Set(perc.length ? compatibili.map((m) => m.percorso[perc.length]).filter((x) => x !== undefined) : []);
      const daCatturare = new Set(perc.length ? compatibili.flatMap((m) => m.presi.slice(0, perc.length - 1)) : []);
      const ult = p.ultima ? new Set(p.ultima.percorso) : new Set();
      const caselle = [];
      for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
        const r = giro ? 7 - vr : vr, c = giro ? 7 - vc : vc, i = r * 8 + c;
        const scura = (r + c) % 2 === 0;
        const x = p.b[i];
        const cls = ['dm-casa', scura ? 'scura' : 'chiara', ult.has(i) ? 'ultima' : '', perc[perc.length - 1] === i ? 'scelta' : '',
          partenze.has(i) ? 'muovibile' : '', prossime.has(i) ? 'meta' : '', daCatturare.has(i) ? 'preda' : ''].join(' ');
        const pezzo = x ? `<span class="dm-pezzo ${x.l === 0 ? 'bianco' : 'nero'} ${x.d ? 'dama' : ''}">${x.d ? CORONA : ''}</span>` : '';
        const cliccabile = partenze.has(i) || prossime.has(i) || (perc.length && i === perc[0]);
        caselle.push(cliccabile
          ? `<button type="button" class="${cls}" data-az="casa" data-i="${i}" aria-label="Casella ${i}">${pezzo}</button>`
          : `<div class="${cls}">${pezzo}</div>`);
      }
      const conta = (l) => p.b.filter((x) => x && x.l === l).length;
      const altro = 1 - ctx.mio;
      const pannello = `<aside class="sc-pannello">
        ${schedaGiocatore(ctx, altro, { colore: p.lato[altro] === 0 ? 'bianco' : 'nero', attivo: p.turno === altro, extra: `<span class="piccolo">${conta(p.lato[altro])} pezzi</span>` })}
        <div class="sc-centro">${mio && p.obbligo ? '<p class="dm-obbligo">⚠ Devi catturare</p>' : ''}
          ${p.quiete >= 40 ? `<p class="piccolo">Patta tra ${Math.ceil((80 - p.quiete) / 2)} mosse senza catture o pedine</p>` : ''}
          ${p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : ''}
          ${!p.finita ? `<button type="button" class="bottone piccolo-bt" data-az="abbandona">${ui.confermaAbb ? 'Sicuro? Clicca ancora' : '🏳 Abbandona'}</button>` : ''}</div>
        ${schedaGiocatore(ctx, ctx.mio, { colore: mioLato === 0 ? 'bianco' : 'nero', attivo: mio, extra: `<span class="piccolo">${conta(mioLato)} pezzi</span>` })}
      </aside>`;
      return `<div class="sc-area"><div class="dm-damiera">${caselle.join('')}</div>${pannello}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const col = p.lato[p.turno] === 0 ? 'Bianco' : 'Nero';
      if (p.turno === ctx.mio) return p.obbligo ? `Tocca a te (${col}): devi catturare` : `Tocca a te (${col})`;
      return `Tocca a ${ctx.nome(p.turno)} (${col})`;
    },
    infoPosto(ctx, posto) { return ctx.partita.lato[posto] === 0 ? 'Bianco' : 'Nero'; },
    clic(ctx, el) {
      const ui = ctx.ui;
      const p = ctx.partita;
      if (el.dataset.az === 'abbandona') {
        if (!ui.confermaAbb) { ui.confermaAbb = true; ctx.ridisegna(); setTimeout(() => { ui.confermaAbb = false; }, 3000); return; }
        return ctx.invia({ tipo: 'abbandona' });
      }
      if (el.dataset.az === 'annullaMossa') { ui.perc = null; return ctx.invia({ tipo: 'annulla' }); }
      if (el.dataset.az !== 'casa') return;
      const i = Number(el.dataset.i);
      const perc = ui.perc || [];
      const passo = (pr) => p.mosse.some((m) => pr.every((k, j) => m.percorso[j] === k));
      if (perc.length === 1 && i === perc[0]) { ui.perc = []; return ctx.ridisegna(); } // deseleziona
      if (perc.length <= 1 && !passo([...perc, i]) && p.mosse.some((m) => m.percorso[0] === i)) { ui.perc = [i]; return ctx.ridisegna(); }
      const nuovo = [...perc, i];
      const comp = p.mosse.filter((m) => nuovo.every((k, j) => m.percorso[j] === k));
      if (!comp.length) return;
      const completa = comp.find((m) => m.percorso.length === nuovo.length);
      if (completa && comp.length === 1) { ui.perc = []; return ctx.invia({ tipo: 'muovi', percorso: completa.percorso }); }
      ui.perc = nuovo;
      ctx.ridisegna();
    },
  };

  // ======================= SCACCHI =======================
  // Pezzi disegnati apposta per il sito (vettoriali, uguali su ogni computer).
  const FORME = {
    1: '<path d="M22.5 8a5 5 0 0 0-3.2 8.8c-2 1.4-3.3 3.6-3.3 6.2 0 2 .9 3.8 2.3 5-3 1.3-6.8 5-6.8 11.5h22c0-6.5-3.8-10.2-6.8-11.5a6.5 6.5 0 0 0 2.3-5c0-2.6-1.3-4.8-3.3-6.2A5 5 0 0 0 22.5 8z"/>',
    2: '<path d="M13 39h21c0-7-.8-12.5-3.6-17.5l1.6-9.5-4.3 2.3L24.5 10l-2 4.2c-4.8 1-9.2 4.7-11.3 10.3l2.3 3.3 4.5-2.3 3.2-.8c-3.5 3.6-6.5 8-8.2 14.3z"/><circle cx="21.5" cy="18.5" r="1.3" class="dettaglio"/>',
    3: '<path d="M22.5 5.5a2.6 2.6 0 1 0 .01 0zM22.5 10c-5.3 4-7.8 8.2-7.8 12.3 0 3 1.9 5.1 4.2 6.2h7.2c2.3-1.1 4.2-3.2 4.2-6.2 0-4.1-2.5-8.3-7.8-12.3zM17.2 28.5h10.6l1.6 3.8H15.6zM12.5 35.3c0-1.7 1.3-3 3-3h14c1.7 0 3 1.3 3 3V39h-20z"/><path d="M22.5 15.5v6.5M19.3 18.7h6.4" class="linea"/>',
    4: '<path d="M11 39h23v-3.2H11zM13.2 35.8l1.6-5h15.4l1.6 5zM14.8 30.8V18.5h15.4v12.3zM12.2 18.5l2.6-3h15.4l2.6 3zM12.2 15.5V9h4.3v2.8h3.6V9h4.8v2.8h3.6V9h4.3v6.5z"/>',
    5: '<path d="M11.5 31 9 16.5l6.2 7.7 2.8-11 4.5 10.3 4.5-10.3 2.8 11 6.2-7.7L33.5 31zM12.2 31h20.6l1.2 4H11zM11 35h23v4H11z"/><circle cx="9" cy="15" r="2.2"/><circle cx="18" cy="11.5" r="2.2"/><circle cx="27" cy="11.5" r="2.2"/><circle cx="36" cy="15" r="2.2"/><circle cx="22.5" cy="10" r="2.2"/>',
    6: '<path d="M22.5 5.5v7M19 9h7" class="linea"/><path d="M22.5 13.5c-3.2 0-5.3 2.6-4.7 6.2-5.2-3-11.3-.9-10.3 5.2.7 4.1 4 6.1 5.1 8.1h19.8c1.1-2 4.4-4 5.1-8.1 1-6.1-5.1-8.2-10.3-5.2.6-3.6-1.5-6.2-4.7-6.2zM13 33h19l1.2 3H11.8zM11.8 36h21.4v3H11.8z"/>',
  };
  const NOME_PEZZO = { 1: 'pedone', 2: 'cavallo', 3: 'alfiere', 4: 'torre', 5: 'donna', 6: 're' };
  const svgPezzo = (x) => `<svg viewBox="0 0 45 45" class="sc-pezzo ${x > 0 ? 'bianco' : 'nero'}" aria-label="${NOME_PEZZO[Math.abs(x)]} ${x > 0 ? 'bianco' : 'nero'}">${FORME[Math.abs(x)]}</svg>`;
  const LET = 'abcdefgh';

  // orologio: il valore arriva dal server e il browser lo fa scorrere
  const ricevuto = new WeakMap();
  const fmt = (ms) => { const t = Math.ceil(ms / 1000); return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `0:${String(t).padStart(2, '0')}`; };
  function restoMostrato(p, lato) {
    const o = p.orologio;
    const base = lato === 1 ? o.bianco : o.nero;
    return o.corre === lato ? Math.max(0, base - (Date.now() - (ricevuto.get(p) || Date.now()))) : base;
  }
  let ctxScacchi = null;
  setInterval(() => {
    const p = ctxScacchi && ctxScacchi.stato && ctxScacchi.stato.partita;
    if (!p || p.gioco !== 'scacchi' || !p.orologio) return;
    for (const el of document.querySelectorAll('.sc-orologio[data-lato]')) {
      const ms = restoMostrato(p, Number(el.dataset.lato));
      el.textContent = fmt(ms);
      el.classList.toggle('poco', ms < 20000);
    }
  }, 200);

  const scacchi = {
    libero: true,
    reset(ctx) { ctxScacchi = ctx; if (ctx.partita && !ricevuto.has(ctx.partita)) ricevuto.set(ctx.partita, Date.now()); },
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const mioCol = p.colore[ctx.mio];
      const giro = mioCol === -1;
      const mio = p.turno === ctx.mio && !p.finita;
      if (!mio) { ui.sel = null; ui.promo = null; }
      const mete = ui.sel != null ? p.mosse.filter((m) => m.da === ui.sel) : [];
      const meta = new Set(mete.map((m) => m.a));
      const partenze = new Set(p.mosse.map((m) => m.da));
      const caselle = [];
      for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
        const r = giro ? 7 - vr : vr, c = giro ? 7 - vc : vc, i = r * 8 + c;
        const x = p.b[i];
        const cls = ['sc-casa', (r + c) % 2 === 0 ? 'chiara' : 'scura',
          p.ultima && (p.ultima.da === i || p.ultima.a === i) ? 'ultima' : '',
          p.scacco === i ? 'scacco' : '', ui.sel === i ? 'scelta' : '',
          meta.has(i) ? (x || (p.b[i] === 0 && mete.some((m) => m.a === i) && Math.abs(p.b[ui.sel]) === 1 && i % 8 !== ui.sel % 8) ? 'meta presa' : 'meta') : '',
          mio && partenze.has(i) ? 'muovibile' : ''].join(' ');
        const coord = `${vc === 0 ? `<span class="sc-rank">${8 - r}</span>` : ''}${vr === 7 ? `<span class="sc-file">${LET[c]}</span>` : ''}`;
        const cont = `${coord}${x ? svgPezzo(x) : ''}`;
        const cliccabile = mio && (partenze.has(i) || meta.has(i));
        caselle.push(cliccabile ? `<button type="button" class="${cls}" data-az="casa" data-i="${i}" aria-label="${LET[c]}${8 - r}">${cont}</button>` : `<div class="${cls}">${cont}</div>`);
      }
      // scelta della promozione
      let promo = '';
      if (ui.promo) {
        const pezzi = [5, 4, 3, 2].map((t) => `<button type="button" class="sc-promo-bt" data-az="promo" data-t="${t}" title="${NOME_PEZZO[t]}">${svgPezzo(t * mioCol)}</button>`).join('');
        promo = `<div class="sc-promo"><p>Promuovi il pedone in:</p><div>${pezzi}</div><button type="button" class="bottone piccolo-bt" data-az="annullaPromo">Annulla</button></div>`;
      }
      const altro = 1 - ctx.mio;
      const catture = (col) => { // pezzi presi da questo colore
        const lista = (p.catturati[-col] || []).slice().sort((a, b) => b - a);
        return `<span class="sc-presi">${lista.map((t) => svgPezzo(t * -col)).join('')}</span>`;
      };
      const materiale = (col) => (p.catturati[-col] || []).reduce((s, t) => s + [0, 1, 3, 3, 5, 9][t], 0);
      const diff = materiale(mioCol) - materiale(-mioCol);
      const orologio = (col) => (p.orologio ? `<span class="sc-orologio ${p.orologio.corre === col ? 'corre' : ''}" data-lato="${col}">${fmt(restoMostrato(p, col))}</span>` : '');
      let centro = '';
      if (!p.finita) {
        if (p.patta === altro) centro = `<div class="sc-proposta"><p>${esc(ctx.nome(altro))} propone la patta</p><button type="button" class="bottone piccolo-bt primario-bt" data-az="patta">Accetta</button><button type="button" class="bottone piccolo-bt" data-az="rifiutaPatta">Rifiuta</button></div>`;
        else if (p.patta === ctx.mio) centro = '<p class="piccolo">Hai proposto la patta: si aspetta la risposta.</p>';
        else centro = '<button type="button" class="bottone piccolo-bt" data-az="patta">½ Proponi patta</button>';
        if (p.puoAnnullare) centro += `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>`;
        centro += `<button type="button" class="bottone piccolo-bt" data-az="abbandona">${ui.confermaAbb ? 'Sicuro? Clicca ancora' : '🏳 Abbandona'}</button>`;
      }
      const pannello = `<aside class="sc-pannello">
        ${schedaGiocatore(ctx, altro, { colore: mioCol === 1 ? 'nero' : 'bianco', attivo: p.turno === altro, extra: `${orologio(-mioCol)}${catture(-mioCol)}${diff < 0 ? `<small>+${-diff}</small>` : ''}` })}
        <div class="sc-centro">${centro}</div>
        ${schedaGiocatore(ctx, ctx.mio, { colore: mioCol === 1 ? 'bianco' : 'nero', attivo: mio, extra: `${orologio(mioCol)}${catture(mioCol)}${diff > 0 ? `<small>+${diff}</small>` : ''}` })}
      </aside>`;
      return `<div class="sc-area"><div class="sc-scacchiera">${caselle.join('')}${promo}</div>${pannello}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const col = p.colore[p.turno] === 1 ? 'Bianco' : 'Nero';
      const scacco = p.scacco >= 0 ? 'Scacco! ' : '';
      return p.turno === ctx.mio ? `${scacco}Tocca a te (${col})` : `${scacco}Tocca a ${ctx.nome(p.turno)} (${col})`;
    },
    infoPosto(ctx, posto) { return ctx.partita.colore[posto] === 1 ? 'Bianco' : 'Nero'; },
    clic(ctx, el) {
      const ui = ctx.ui;
      const p = ctx.partita;
      const az = el.dataset.az;
      if (az === 'abbandona') {
        if (!ui.confermaAbb) { ui.confermaAbb = true; ctx.ridisegna(); setTimeout(() => { ui.confermaAbb = false; }, 3000); return; }
        return ctx.invia({ tipo: 'abbandona' });
      }
      if (az === 'patta' || az === 'rifiutaPatta') return ctx.invia({ tipo: az });
      if (az === 'annullaMossa') { ui.sel = null; return ctx.invia({ tipo: 'annulla' }); }
      if (az === 'annullaPromo') { ui.promo = null; return ctx.ridisegna(); }
      if (az === 'promo') { const { da, a } = ui.promo; ui.promo = null; ui.sel = null; return ctx.invia({ tipo: 'muovi', da, a, promo: Number(el.dataset.t) }); }
      if (az !== 'casa') return;
      const i = Number(el.dataset.i);
      if (ui.sel != null && p.mosse.some((m) => m.da === ui.sel && m.a === i)) {
        const ms = p.mosse.filter((m) => m.da === ui.sel && m.a === i);
        if (ms.some((m) => m.promo)) { ui.promo = { da: ui.sel, a: i }; return ctx.ridisegna(); }
        const da = ui.sel;
        ui.sel = null;
        return ctx.invia({ tipo: 'muovi', da, a: i });
      }
      ui.sel = ui.sel === i ? null : p.mosse.some((m) => m.da === i) ? i : null;
      ctx.ridisegna();
    },
  };

  // ======================= caselle di testo che sopravvivono ai ridisegni =======================
  // <input data-tieni="chiave">: il valore resta in ctx.ui e, se si stava scrivendo, il cursore torna lì.
  let ctxTesto = null;
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.tieni;
    if (k && ctxTesto) ctxTesto.ui[`t_${k}`] = e.target.value;
  });
  document.addEventListener('focusin', (e) => { const k = e.target.dataset && e.target.dataset.tieni; if (k && ctxTesto) ctxTesto.ui.fuoco = k; });
  document.addEventListener('focusout', (e) => { const k = e.target.dataset && e.target.dataset.tieni; if (k && ctxTesto && ctxTesto.ui.fuoco === k) setTimeout(() => { if (!document.activeElement || !document.activeElement.dataset || document.activeElement.dataset.tieni !== k) ctxTesto.ui.fuoco = null; }, 0); });
  // Invio in una casella = clic sul suo pulsante
  document.addEventListener('keydown', (e) => {
    const bt = e.key === 'Enter' && e.target.dataset && e.target.dataset.invio;
    if (!bt) return;
    e.preventDefault();
    const b = document.querySelector(`[data-az="${bt}"]`);
    if (b && !b.disabled) b.click();
  });
  const valore = (ctx, k) => esc(ctx.ui[`t_${k}`] || '');
  function rimettiFuoco(ctx) {
    ctxTesto = ctx;
    const k = ctx.ui.fuoco;
    if (!k || (Boss && Boss.attivo)) return;
    const el = document.querySelector(`[data-tieni="${k}"]`);
    if (el && !el.disabled) { el.focus({ preventScroll: true }); try { el.setSelectionRange(el.value.length, el.value.length); } catch {} }
  }
  function tabellaPunti(ctx, punti, extra = () => '') {
    const ordine = punti.map((x, i) => i).sort((a, b) => punti[b] - punti[a]);
    return `<ol class="im-classifica">${ordine.map((i) => `<li class="${i === ctx.mio ? 'io' : ''}"><span>${esc(ctx.nome(i))}${extra(i)}</span><b>${punti[i]}</b></li>`).join('')}</ol>`;
  }

  // ======================= IMPICCATO =======================
  const PEZZI_OMINO = [
    '<path d="M20 190h110"/>', '<path d="M45 190V20"/>', '<path d="M45 20h75"/>', '<path d="M120 20v22"/>',
    '<circle cx="120" cy="58" r="16"/>', '<path d="M120 74v52"/>', '<path d="M120 88l-22 20"/>', '<path d="M120 88l22 20"/>',
    '<path d="M120 126l-18 32"/>', '<path d="M120 126l18 32"/>',
  ];
  function omino(p, ui) {
    const pre = 10 - p.maxErrori;
    const visti = pre + p.errori;
    const nuovo = ui.erroriVisti !== undefined && p.errori > ui.erroriVisti ? visti - 1 : -1;
    ui.erroriVisti = p.errori;
    const impiccato = p.errori >= p.maxErrori;
    return `<svg viewBox="0 0 160 200" class="im-omino ${impiccato ? 'impiccato' : ''}" aria-label="${p.errori} errori su ${p.maxErrori}">
      ${PEZZI_OMINO.map((d, k) => (k < visti ? d.replace(/^<(\w+)/, `<$1 class="${k < 4 ? 'forca' : 'corpo'} ${k === nuovo ? 'nuovo' : ''}"`) : '')).join('')}
    </svg>`;
  }
  let ctxImp = null;
  const impiccato = {
    libero: true,
    reset(ctx) {
      ctxImp = ctx; ctxTesto = ctx;
      // il testo scritto resta finché il server non accetta la mossa (se la parola viene rifiutata non si riscrive):
      // si svuota quando cambia il giro, o dopo una prova accettata (lettere provate o errori cambiati)
      const p = ctx.partita, ui = ctx.ui, firma = `${p.round}:${p.fase}:${p.errori}:${p.provate.length}`;
      if (ui._imFirma !== undefined && ui._imFirma !== firma) { if (p.fase !== 'scelta') ui.t_parola = ''; ui.t_prova = ''; }
      ui._imFirma = firma;
    },
    dopo: rimettiFuoco,
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const sonoBoia = p.boia === ctx.mio;
      const testa = `<p class="im-giro">Giro ${p.round} di ${p.totaleRound} · la parola la sceglie <b>${sonoBoia ? 'tu' : esc(ctx.nome(p.boia))}</b></p>`;
      if (p.fase === 'scelta') {
        if (!sonoBoia) return `<div class="im">${testa}<div class="im-attesa"><span class="im-penna">✍️</span><p>${esc(ctx.nome(p.boia))} sta scegliendo la parola…</p></div></div>`;
        const vedi = ui.vediParola;
        return `<div class="im">${testa}<div class="im-scelta">
          <h3>Scegli la parola da far indovinare</h3>
          <p class="piccolo">Una sola parola, da 3 a 20 lettere. Gli altri vedranno solo quante lettere ha.</p>
          <div class="riga"><input type="${vedi ? 'text' : 'password'}" maxlength="20" autocomplete="off" spellcheck="false" placeholder="La tua parola segreta" data-tieni="parola" data-invio="conferma" value="${valore(ctx, 'parola')}">
            <button type="button" class="bottone" data-az="vedi" title="${vedi ? 'Nascondi' : 'Mostra'}">${vedi ? '🙈' : '👁'}</button></div>
          <button type="button" class="bottone primario-bt im-conferma" data-az="conferma">Conferma la parola</button></div></div>`;
      }
      const mio = p.turno === ctx.mio && !p.finita && !p.inAttesa;
      const lettere = p.maschera.map((l, k) => {
        const nascosta = sonoBoia && p.fase === 'gioco' && !p.provate.includes(l);
        return `<span class="im-lettera ${l ? 'vista' : ''} ${nascosta ? 'segreta' : ''}" style="--k:${k}">${l ? l.toUpperCase() : ''}</span>`;
      }).join('');
      const tasti = 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => {
        const provata = p.provate.includes(l);
        const giusta = provata && p.maschera.includes(l);
        return `<button type="button" class="im-tasto ${provata ? (giusta ? 'giusta' : 'sbagliata') : ''}" data-az="lettera" data-l="${l}" ${!mio || provata ? 'disabled' : ''}>${l.toUpperCase()}</button>`;
      }).join('');
      const turno = p.fase !== 'gioco' ? '' : mio ? '<p class="im-tuo">Tocca a te: scegli una lettera</p>'
        : sonoBoia ? '<p class="piccolo">Hai scelto tu la parola: guarda gli altri che provano a indovinarla.</p>'
          : `<p class="piccolo">Tocca a ${esc(ctx.nome(p.turno))}</p>`;
      return `<div class="im">${testa}
        <div class="im-gioco">
          <div class="im-sx">${omino(p, ui)}<p class="im-errori">Errori: <b>${p.errori}</b> / ${p.maxErrori}</p></div>
          <div class="im-dx">
            <div class="im-parola" aria-label="Parola da indovinare">${lettere}</div>
            ${turno}
            <div class="im-tastiera">${tasti}</div>
            ${mio ? `<div class="riga im-prova"><input maxlength="20" autocomplete="off" spellcheck="false" placeholder="Sai la parola? Scrivila qui" data-tieni="prova" data-invio="prova" value="${valore(ctx, 'prova')}">
              <button type="button" class="bottone" data-az="prova">Prova la parola</button></div>
              <p class="piccolo">Se è giusta prendi il bonus, se è sbagliata conta come un errore.</p>` : ''}
          </div>
        </div></div>`;
    },
    riepilogo(ctx) {
      const p = ctx.partita;
      const e = p.esitoRound;
      if (!e) return '';
      const titolo = e.esito === 'indovinata' ? `${e.chi === ctx.mio ? 'Hai' : `${esc(ctx.nome(e.chi))} ha`} ${e.parolaIntera ? 'indovinato' : 'completato'} la parola!`
        : e.esito === 'impiccato' ? `Impiccato! Il giro va a ${e.boia === ctx.mio ? 'te' : esc(ctx.nome(e.boia))}` : 'Giro annullato';
      return `<h2>${titolo}</h2><p class="im-svelata">${esc((e.parola || '').toUpperCase())}</p>${tabellaPunti(ctx, p.punti)}`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.inAttesa) return null;
      if (p.fase === 'scelta') return p.boia === ctx.mio ? 'Scegli la parola' : `${ctx.nome(p.boia)} sceglie la parola`;
      return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return p.punti.map((x, i) => `<span class="${p.fuori[i] ? 'barrato' : ''}">${esc(ctx.nome(i))} <b>${x}</b></span>`).join('');
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      if (p.fuori[posto]) return '<span class="eliminato">uscito</span>';
      return p.boia === posto ? '✍️ ha scelto la parola' : `${p.punti[posto]} punti`;
    },
    clic(ctx, el) {
      const ui = ctx.ui;
      const az = el.dataset.az;
      if (az === 'vedi') { ui.vediParola = !ui.vediParola; ui.fuoco = 'parola'; return ctx.ridisegna(); }
      if (az === 'conferma') {
        const w = (ui.t_parola || '').trim();
        if (!w) return ctx.avviso('Scrivi prima la parola');
        ui.fuoco = null;
        return ctx.invia({ tipo: 'parola', parola: w });
      }
      if (az === 'lettera') { el.disabled = true; return ctx.invia({ tipo: 'lettera', lettera: el.dataset.l }); }
      if (az === 'prova') {
        const w = (ui.t_prova || '').trim();
        if (!w) return ctx.avviso('Scrivi la parola che vuoi provare');
        ui.fuoco = null;
        return ctx.invia({ tipo: 'prova', parola: w });
      }
    },
  };
  // lettere anche dalla tastiera del computer
  document.addEventListener('keydown', (e) => {
    const ctx = ctxImp;
    if (!ctx || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !/^[a-z]$/i.test(e.key)) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const p = ctx.stato && ctx.stato.partita;
    if (!p || p.gioco !== 'impiccato' || p.fase !== 'gioco' || p.turno !== ctx.mio || p.inAttesa) return;
    const l = e.key.toLowerCase();
    if (p.provate.includes(l)) return ctx.avviso(`La ${l.toUpperCase()} è già stata provata`, 1400);
    ctx.invia({ tipo: 'lettera', lettera: l });
  });

  // ======================= SASSO CARTA FORBICE =======================
  const MANO = { sasso: '✊', carta: '✋', forbice: '✌️', lucertola: '🦎', spock: '🖖' };
  const NOME_MANO = { sasso: 'Sasso', carta: 'Carta', forbice: 'Forbici', lucertola: 'Lucertola', spock: 'Spock' };
  // MENO UNO (Squid Game): due mani a testa, poi ognuno ne ritira una
  function pannoMeno1(ctx, p, ui, io, altro, pallini, riga) {
    const r = p.rivela;
    const manina = (m, cls = '', attr = '') => `<div class="m1-mano ${cls}" ${attr}><span>${MANO[m]}</span><small>${NOME_MANO[m]}</small></div>`;
    let centro;
    if (r) {
      ui.visto = ui.visto || {};
      if (!ui.visto[r.id]) ui.visto[r.id] = Date.now();
      const t = Date.now() - ui.visto[r.id];
      const esito = r.vince === null ? 'pari' : r.vince === io ? 'vinta' : 'persa';
      const lato = (posto) => `<div class="m1-coppia ${posto === altro ? 'sopra' : ''}">${r.coppie[posto].map((m, k) => manina(m, `${k === r.tieni[posto] ? 'resta' : 'via'} ${k === r.tieni[posto] && r.vince !== null ? (r.vince === posto ? 'vince' : 'perde') : ''}`)).join('')}</div>`;
      centro = `<div class="m1-duello" style="--t:${-t}ms">${lato(altro)}<p class="m1-meno">MENO UNO!</p>
        <p class="rps-verdetto ${esito}">${esc(r.frase)}${r.vince === null ? '' : esito === 'vinta' ? ' · mano a te!' : ` · mano a ${esc(ctx.nome(altro))}`}</p>${lato(io)}</div>`;
    } else if (p.finita) {
      // fine: chi ha perso viene eliminato (macchia rossa stilizzata e nome grigio)
      const perde = p.risultato.vincitori[0] === io ? altro : io;
      ui.visto = ui.visto || {}; if (!ui.visto.fine) ui.visto.fine = Date.now();
      centro = `<div class="m1-fine" style="--t:${-(Date.now() - ui.visto.fine)}ms"><div class="sq-macchia"></div>
        <p class="m1-elim"><b class="sq-grigio">${esc(perde === io ? 'Tu' : ctx.nome(perde))}</b> ${perde === io ? 'sei eliminato' : 'è eliminato'}</p>
        <p class="piccolo">${esc(p.risultato.vincitori[0] === io ? 'Hai vinto la sfida del Reclutatore.' : `${ctx.nome(altro)} ha vinto la sfida.`)}</p></div>`;
    } else if (p.fase === 'scegli') {
      const scelte = ui.m1 || [];
      if (p.miaCoppia) centro = `<div class="rps-scegli"><div class="m1-coppia">${p.miaCoppia.map((m) => manina(m)).join('')}</div><p class="piccolo">Hai scelto le tue due mani. Aspetto ${esc(ctx.nome(altro))}…</p></div>`;
      else {
        centro = `<div class="rps-scegli"><p class="rps-dom">Scegli le tue due mani</p>
          <div class="m1-coppia">${[0, 1].map((k) => (scelte[k] ? manina(scelte[k], 'posata', `data-az="m1via" data-k="${k}" role="button" tabindex="0" title="Togli"`) : `<div class="m1-mano vuota">${k ? 'destra' : 'sinistra'}</div>`)).join('')}</div>
          <div class="rps-carte">${p.mosse.map((m) => `<button type="button" class="rps-carta" data-az="m1" data-m="${m}" ${scelte.length >= 2 ? 'disabled' : ''}><span>${MANO[m]}</span><small>${NOME_MANO[m]}</small></button>`).join('')}</div>
          <button type="button" class="bottone primario" data-az="m1mostra" ${scelte.length === 2 ? '' : 'disabled'}>Mostra le mani</button>
          <p class="piccolo">${esc(ctx.nome(altro))} ${p.altroHaScelto ? 'ha già scelto ✓' : 'sta scegliendo…'}</p></div>`;
      }
    } else {
      // tutte e quattro le mani in vista: ognuno ritira una delle sue
      const t = p.mioTieni;
      centro = `<div class="m1-duello aperto"><div class="m1-coppia sopra">${p.altraCoppia.map((m) => manina(m)).join('')}</div>
        <p class="m1-meno">MENO UNO! ${t === null ? 'Quale mano tieni?' : 'Aspetto…'}</p>
        <div class="m1-coppia">${p.miaCoppia.map((m, k) => manina(m, t === null ? 'sceglibile' : k === t ? 'resta' : 'via', t === null ? `data-az="m1tieni" data-k="${k}" role="button" tabindex="0"` : '')).join('')}</div>
        <p class="piccolo">${t === null ? 'Tocca la mano da TENERE: l\'altra la ritiri.' : `${esc(ctx.nome(altro))} ${p.altroHaScelto ? 'ha scelto ✓' : 'sta scegliendo…'}`}</p></div>`;
    }
    const storia = p.storia.length ? `<div class="rps-storia">${p.storia.map((s) => `<span class="${s.vince === null ? '' : s.vince === io ? 'si' : 'no'}">${MANO[s.scelte[io]]}<small>vs</small>${MANO[s.scelte[altro]]}</span>`).join('')}</div>` : '';
    const perdente = p.finita ? (p.risultato.vincitori[0] === io ? altro : io) : -1;
    const rigaSq = (posto) => `<div class="rps-riga"><b class="${posto === perdente ? 'sq-grigio' : ''}">${posto === perdente ? '💀 ' : ''}${esc(posto === io ? 'Tu' : ctx.nome(posto))}</b>${pallini(posto)}</div>`;
    return `<div class="rps m1">${rigaSq(altro)}${centro}${rigaSq(io)}${storia}</div>`;
  }
  const morra = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const ui = ctx.ui;
      const io = ctx.mio, altro = 1 - io;
      const pallini = (posto) => `<span class="rps-pallini">${Array.from({ length: p.serve }, (_, k) => `<i class="${k < p.punti[posto] ? 'pieno' : ''}"></i>`).join('')}</span>`;
      const riga = (posto) => `<div class="rps-riga"><b>${esc(posto === io ? 'Tu' : ctx.nome(posto))}</b>${pallini(posto)}</div>`;
      let centro;
      const r = p.rivela;
      if (p.meno1) return pannoMeno1(ctx, p, ui, io, altro, pallini, riga);
      if (r) {
        // la stessa rivelazione può essere ridisegnata (es. arriva un messaggio in chat): l'animazione riparte da dove era
        ui.visto = ui.visto || {};
        if (!ui.visto[r.id]) ui.visto[r.id] = Date.now();
        const t = Date.now() - ui.visto[r.id];
        const esito = r.vince === null ? 'pari' : r.vince === io ? 'vinta' : 'persa';
        const mano = (posto, sopra) => `<div class="rps-mano ${sopra ? 'sopra' : ''} ${r.vince === posto ? 'vince' : r.vince === null ? '' : 'perde'}">
            <span class="rps-pugno">✊</span><span class="rps-scelta">${MANO[r.scelte[posto]]}</span></div>`;
        centro = `<div class="rps-duello" style="--t:${-t}ms">${mano(altro, true)}
          <div class="rps-conta"><span>Sasso…</span><span>carta…</span><span>forbice!</span></div>
          <p class="rps-verdetto ${esito}">${esc(r.frase)}${r.vince === null ? '' : esito === 'vinta' ? ' · mano a te!' : ` · mano a ${esc(ctx.nome(altro))}`}</p>
          ${mano(io, false)}</div>`;
      } else if (p.finita) {
        const u = p.ultimaRivela;
        centro = u ? `<div class="rps-duello fermo"><div class="rps-mano sopra"><span class="rps-scelta">${MANO[u.scelte[altro]]}</span></div><p class="rps-verdetto">${esc(u.frase)}</p><div class="rps-mano"><span class="rps-scelta">${MANO[u.scelte[io]]}</span></div></div>` : '';
      } else if (!p.miaScelta) {
        centro = `<div class="rps-scegli"><p class="rps-dom">Cosa scegli?</p><div class="rps-carte">${p.mosse.map((m) => `<button type="button" class="rps-carta" data-az="scegli" data-m="${m}"><span>${MANO[m]}</span><small>${NOME_MANO[m]}</small></button>`).join('')}</div>
          <p class="piccolo">${esc(ctx.nome(altro))} ${p.altroHaScelto ? 'ha già scelto ✓' : 'sta scegliendo…'}</p></div>`;
      } else {
        centro = `<div class="rps-scegli"><div class="rps-carta scelta"><span>${MANO[p.miaScelta]}</span><small>${NOME_MANO[p.miaScelta]}</small></div>
          <p class="piccolo">Hai scelto. Aspetto ${esc(ctx.nome(altro))}…</p></div>`;
      }
      const storia = p.storia.length ? `<div class="rps-storia">${p.storia.map((s) => `<span class="${s.vince === null ? '' : s.vince === io ? 'si' : 'no'}" title="${NOME_MANO[s.scelte[io]]} contro ${NOME_MANO[s.scelte[altro]]}">${MANO[s.scelte[io]]}<small>vs</small>${MANO[s.scelte[altro]]}</span>`).join('')}</div>` : '';
      return `<div class="rps">${riga(altro)}${centro}${riga(io)}${storia}</div>`;
    },
    statoAttesa: () => 'Si rivela!',
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.rivela) return 'Si rivela!';
      if (p.meno1) return p.fase === 'scegli' ? (p.miaCoppia ? 'Aspetta l\'avversario' : 'Scegli due mani') : p.mioTieni === null ? 'Meno uno: quale tieni?' : 'Aspetta l\'avversario';
      return p.miaScelta ? 'Aspetta l\'avversario' : 'Scegli la tua mossa';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return `<span>Tu <b>${p.punti[ctx.mio]}</b></span><span>${esc(ctx.nome(1 - ctx.mio))} <b>${p.punti[1 - ctx.mio]}</b></span><span class="obiettivo">al meglio di ${p.meglio}</span>`;
    },
    clic(ctx, el) {
      const ui = ctx.ui, az = el.dataset.az;
      if (az === 'm1') { ui.m1 = [...(ui.m1 || []), el.dataset.m].slice(0, 2); return ctx.ridisegna(); }
      if (az === 'm1via') { ui.m1 = (ui.m1 || []).filter((_, k) => k !== Number(el.dataset.k)); return ctx.ridisegna(); }
      if (az === 'm1mostra') { const mosse = ui.m1; ui.m1 = []; return ctx.invia({ tipo: 'scegli2', mosse }); }
      if (az === 'm1tieni') return ctx.invia({ tipo: 'tieni', mano: Number(el.dataset.k) });
      if (az !== 'scegli') return;
      el.classList.add('premuta');
      ctx.invia({ tipo: 'scegli', mossa: el.dataset.m });
    },
  };

  // ======================= INDOVINA IL NUMERO =======================
  const numero = {
    libero: true,
    reset(ctx) { ctxTesto = ctx; },
    dopo: rimettiFuoco,
    panno(ctx) {
      const p = ctx.partita;
      const mio = p.turno === ctx.mio && !p.finita;
      const pc = (x) => ((x - 1) / Math.max(1, p.massimo - 1)) * 100;
      const segni = p.tentativi.map((t) => `<i class="nm-segno ${t.esito}" style="left:${pc(t.n)}%" title="${t.n}"></i>`).join('');
      const zona = `<div class="nm-zona" style="left:${pc(p.basso)}%;width:${Math.max(0.6, pc(p.alto) - pc(p.basso))}%"></div>`;
      const storia = [...p.tentativi].reverse().map((t) => `<li class="${t.esito}"><span>${esc(t.posto === ctx.mio ? 'Tu' : ctx.nome(t.posto))}</span><b>${t.n}</b><em>${t.esito === 'su' ? '⬆ più alto' : t.esito === 'giu' ? '⬇ più basso' : '🎯 giusto!'}</em></li>`).join('');
      const centro = p.finita
        ? `<p class="nm-grande">🎯 Era <b>${p.segreto}</b></p>`
        : `<p class="nm-grande">È tra <b>${p.basso}</b> e <b>${p.alto}</b></p>`;
      const input = mio ? `<div class="riga nm-prova"><input type="number" min="${p.basso}" max="${p.alto}" inputmode="numeric" placeholder="Il tuo numero" data-tieni="numero" data-invio="prova" value="${valore(ctx, 'numero')}">
          <button type="button" class="bottone primario-bt" data-az="prova">Prova</button></div>`
        : !p.finita ? `<p class="piccolo">Tocca a ${esc(ctx.nome(p.turno))}…</p>` : '';
      return `<div class="nm">
        <p class="nm-testa">Ho pensato un numero da <b>1</b> a <b>${p.massimo}</b></p>
        ${centro}
        <div class="nm-barra">${zona}${segni}<span class="nm-min">1</span><span class="nm-max">${p.massimo}</span></div>
        ${input}
        ${p.n === 1 ? `<p class="piccolo">Tentativi: <b>${p.conta[0]}</b></p>` : ''}
        <ol class="nm-storia">${storia}</ol></div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      return p.turno === ctx.mio ? (p.n === 1 ? 'Prova un numero' : 'Tocca a te') : `Tocca a ${ctx.nome(p.turno)}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      if (p.n === 1) return '';
      return p.conta.map((c, i) => `<span>${esc(ctx.nome(i))} <b>${c}</b> <small>tentativi</small></span>`).join('');
    },
    infoPosto(ctx, posto) { return `${ctx.partita.conta[posto]} tentativi`; },
    clic(ctx, el) {
      if (el.dataset.az !== 'prova') return;
      const v = (ctx.ui.t_numero || '').trim();
      if (!v) return ctx.avviso('Scrivi un numero');
      ctx.ui.t_numero = '';
      ctx.invia({ tipo: 'prova', numero: Number(v) });
    },
  };

  // ======================= CASINÒ: pezzi comuni =======================
  const ricevutoCasino = new WeakMap();
  const segnaRicevuto = (ctx) => { if (ctx.partita && !ricevutoCasino.has(ctx.partita)) ricevutoCasino.set(ctx.partita, Date.now()); };
  // conto alla rovescia: il tempo arriva dal server e il browser lo fa scorrere
  const contoAlla = (ctx, ms, testo) => (ms == null ? '' : `<span class="cs-conto" data-fine="${(ricevutoCasino.get(ctx.partita) || Date.now()) + ms}" data-testo="${esc(testo)}">${esc(testo)} ${Math.ceil(ms / 1000)}s</span>`);
  setInterval(() => {
    for (const el of document.querySelectorAll('.cs-conto[data-fine]')) {
      const s = Math.max(0, Math.ceil((Number(el.dataset.fine) - Date.now()) / 1000));
      el.textContent = `${el.dataset.testo} ${s}s`;
      el.classList.toggle('poco', s <= 5);
    }
  }, 250);
  const fmtFiche = (n) => Number(n).toLocaleString('it-IT');
  const GETTONI = [5, 25, 100, 500];
  const gettone = (v, cls = '') => `<span class="cs-gettone g${v >= 500 ? 500 : v >= 100 ? 100 : v >= 25 ? 25 : 5} ${cls}">${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}</span>`;
  // selettore: somma i gettoni in ctx.ui[chiave]
  function selettore(ctx, chiave, fiche) {
    const v = Math.min(ctx.ui[chiave] || 0, fiche);
    return `<div class="cs-selettore">
      <div class="cs-gettoni">${GETTONI.map((g) => `<button type="button" class="cs-gettone-bt" data-az="aggiungi" data-k="${chiave}" data-v="${g}" ${g > fiche - v ? 'disabled' : ''}>${gettone(g)}</button>`).join('')}
        <button type="button" class="bottone mini-bt" data-az="tutto" data-k="${chiave}">Tutto</button>
        <button type="button" class="bottone mini-bt" data-az="azzera" data-k="${chiave}" ${v ? '' : 'disabled'}>Azzera</button></div>
      <p class="cs-importo">Puntata: <b>${fmtFiche(v)}</b> <small>su ${fmtFiche(fiche)} fiche</small></p></div>`;
  }
  // clic comuni ai giochi con le fiche; restituisce true se l'ha gestito
  function clicFiche(ctx, el) {
    const ui = ctx.ui, p = ctx.partita, az = el.dataset.az, k = el.dataset.k;
    const fiche = p.fiche[ctx.mio];
    if (az === 'aggiungi') { ui[k] = Math.min(fiche, (ui[k] || 0) + Number(el.dataset.v)); ctx.ridisegna(); return true; }
    if (az === 'tutto') { ui[k] = fiche; ctx.ridisegna(); return true; }
    if (az === 'azzera') { ui[k] = 0; ctx.ridisegna(); return true; }
    if (az === 'passa') { ctx.invia({ tipo: 'passa' }); return true; }
    if (az === 'ricarica') { ctx.chat('!ricarica'); return true; }
    return false;
  }
  // stato di un giocatore durante le puntate
  function statoPuntata(ctx, posto) {
    const p = ctx.partita;
    if (p.fiche[posto] <= 0 && !p.puntato[posto]) return '<span class="cs-badge rosso">senza fiche</span>';
    if (p.fase !== 'puntate' || p.inAttesa) return '';
    if (p.puntato[posto]) return '<span class="cs-badge verde">ha puntato ✓</span>';
    if (p.passato[posto]) return '<span class="cs-badge">passa</span>';
    return '<span class="cs-badge">sta puntando…</span>';
  }
  // pannello "tocca a te puntare" comune; dentro va il contenuto specifico del gioco
  function pannelloPuntate(ctx, dentro) {
    const p = ctx.partita, io = ctx.mio;
    if (p.fase !== 'puntate' || p.inAttesa) return '';
    const conto = contoAlla(ctx, p.tempoPuntate, 'Puntate chiuse tra');
    if (p.fiche[io] <= 0 && !p.puntato[io]) {
      return `<div class="cs-pannello"><p><b>Hai finito le fiche.</b> Per averne altre 1000 scrivi <b>!ricarica</b> in chat.</p>
        <button type="button" class="bottone primario-bt" data-az="ricarica">💰 Ricarica 1000 fiche</button></div>`;
    }
    if (p.puntato[io] || p.passato[io]) return `<div class="cs-pannello"><p>${p.puntato[io] ? 'Puntata fatta ✓' : 'Salti questa mano'}. Aspettiamo gli altri… ${conto}</p></div>`;
    return `<div class="cs-pannello">${dentro}${conto ? `<p class="piccolo">${conto}</p>` : ''}</div>`;
  }
  // carte che entrano con un'animazione, ma solo la prima volta che si vedono
  function carta(ctx, c, extra = '') {
    const ui = ctx.ui;
    ui.carteViste = ui.carteViste || new Set();
    if (!c) return Carte.retro(`cs-carta ${extra}`);
    const nuova = !ui.carteViste.has(c.id);
    ui.carteViste.add(c.id);
    return Carte.fronte(c, `cs-carta ${nuova ? 'arriva' : ''} ${extra}`);
  }
  const infoFiche = (ctx, posto) => `${fmtFiche(ctx.partita.fiche[posto])} fiche ${statoPuntata(ctx, posto)}`;

  // ======================= BLACKJACK =======================
  const ESITO_BJ = { vince: 'Vinta', perde: 'Persa', pari: 'Pari', blackjack: 'Blackjack!', sballato: 'Sballato' };
  function manoBJ(ctx, m, attiva) {
    const tot = m.morbida && m.tot < 21 && m.stato === 'gioca' ? `${m.tot - 10}/${m.tot}` : m.tot;
    const badge = m.esito ? `<span class="cs-badge ${['vince', 'blackjack'].includes(m.esito) ? 'verde' : m.esito === 'pari' ? '' : 'rosso'}">${ESITO_BJ[m.esito]}${m.vincita ? ` ${m.vincita > 0 ? '+' : ''}${fmtFiche(m.vincita)}` : ''}</span>`
      : m.stato === 'blackjack' ? '<span class="cs-badge verde">Blackjack!</span>' : m.stato === 'sballato' ? '<span class="cs-badge rosso">Sballato</span>' : '';
    return `<div class="bj-mano ${attiva ? 'attiva' : ''}"><div class="cs-carte">${m.carte.map((c) => carta(ctx, c)).join('')}</div>
      <div class="bj-info"><span class="bj-tot">${m.carte.length ? tot : ''}</span>${gettone(m.puntata)}${m.raddoppiata ? '<small>×2</small>' : ''}${badge}</div></div>`;
  }
  // TABELLE DI STRATEGIA (blackjack e baccarat): si aprono con 📋 e si chiudono con ✕. Nel blackjack la tabella è la
  // strategia di base per 6 mazzi (la stessa del pulsante 💡) con evidenziata la situazione della mano in gioco.
  const VAL_BJ = (c) => (!c ? 0 : c.rango === 1 ? 11 : Math.min(10, c.rango));
  function cellaBJ(tipo, x, d) {
    // tipo: 'dura' (x = totale), 'morbida' (x = totale con l'asso da 11), 'coppia' (x = valore della carta)
    if (tipo === 'coppia') {
      if (x === 11 || x === 8) return 'P';
      if (x === 9) return [7, 10, 11].includes(d) ? 'S' : 'P';
      if (x === 7 || x === 3 || x === 2) return d <= 7 ? 'P' : 'H';
      if (x === 6) return d <= 6 ? 'P' : 'H';
      if (x === 4) return d === 5 || d === 6 ? 'P' : 'H';
      if (x === 5) return d <= 9 ? 'D' : 'H';
      return 'S'; // 10-10
    }
    if (tipo === 'morbida') {
      if (x >= 19) return 'S';
      if (x === 18) return d >= 3 && d <= 6 ? 'Ds' : d >= 9 ? 'H' : 'S';
      if (x === 17) return d >= 3 && d <= 6 ? 'D' : 'H';
      if (x >= 15) return d >= 4 && d <= 6 ? 'D' : 'H';
      return d >= 5 && d <= 6 ? 'D' : 'H';
    }
    if (x >= 17) return 'S';
    if (x >= 13) return d <= 6 ? 'S' : 'H';
    if (x === 12) return d >= 4 && d <= 6 ? 'S' : 'H';
    if (x === 11) return d <= 10 ? 'D' : 'H';
    if (x === 10) return d <= 9 ? 'D' : 'H';
    if (x === 9) return d >= 3 && d <= 6 ? 'D' : 'H';
    return 'H';
  }
  const SIGLE_BJ = { H: ['C', 'Carta'], S: ['S', 'Stai'], D: ['R', 'Raddoppia (se non puoi: carta)'], Ds: ['Rs', 'Raddoppia (se non puoi: stai)'], P: ['D', 'Dividi'] };
  function tabellaBJ(p, io) {
    // la situazione attuale (se tocca a me): riga e colonna da evidenziare
    let qui = null;
    const m = p.fase === 'turni' && p.turno === io && p.mani[io] && p.mani[io][p.manoAttiva];
    if (m && p.banco.carte[0]) {
      const d = VAL_BJ(p.banco.carte[0]);
      const v = m.carte.map(VAL_BJ);
      if (p.azioni && p.azioni.dividi && v.length === 2 && v[0] === v[1]) qui = { tipo: 'coppia', x: v[0], d };
      else if (m.morbida && m.tot <= 20) qui = { tipo: 'morbida', x: m.tot, d };
      else qui = { tipo: 'dura', x: Math.min(17, Math.max(8, m.tot)), d };
    }
    const colonne = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const testa = `<tr><th></th>${colonne.map((d) => `<th class="${qui && qui.d === d ? 'qui' : ''}">${d === 11 ? 'A' : d}</th>`).join('')}</tr>`;
    const riga = (tipo, x, nome) => `<tr class="${qui && qui.tipo === tipo && qui.x === x ? 'qui' : ''}"><th>${nome}</th>${colonne.map((d) => { const c = cellaBJ(tipo, x, d); return `<td class="t-${c} ${qui && qui.tipo === tipo && qui.x === x && qui.d === d ? 'cella-qui' : ''}">${SIGLE_BJ[c][0]}</td>`; }).join('')}</tr>`;
    const dure = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((x) => riga('dura', x, x === 8 ? '≤8' : x === 17 ? '17+' : x)).join('');
    const morbide = [13, 14, 15, 16, 17, 18, 19, 20].map((x) => riga('morbida', x, `A+${x - 11}`)).join('');
    const coppie = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => riga('coppia', x, x === 11 ? 'A-A' : `${x}-${x}`)).join('');
    return `<div class="cs-tabella" role="dialog" aria-label="Strategia di base del blackjack"><div class="cs-tab-scheda">
      <div class="cs-tab-testa"><b>📋 Strategia di base</b><button type="button" class="bottone mini-bt" data-az="tabellaBJ">✕ Chiudi</button></div>
      <p class="piccolo">Righe: le tue carte · colonne: la carta scoperta del banco. ${qui ? '<b>In giallo la tua mano adesso.</b>' : ''}</p>
      <div class="cs-tab-scorri"><table class="bj-tab"><thead>${testa}</thead>
        <tbody><tr class="sez"><th colspan="11">Totale "duro" (senza asso, o con l'asso che vale 1)</th></tr>${dure}
        <tr class="sez"><th colspan="11">Totale "morbido" (con un asso che vale 11)</th></tr>${morbide}
        <tr class="sez"><th colspan="11">Coppie (quando puoi dividere)</th></tr>${coppie}</tbody></table></div>
      <p class="cs-tab-leg">${Object.entries(SIGLE_BJ).map(([k, [sig, nome]]) => `<span class="t-${k}">${sig}</span> ${nome}`).join(' · ')}</p>
      <p class="piccolo">Vale per 6 mazzi, banco che sta su 17, raddoppio permesso dopo aver diviso. Seguendola sempre il banco ha un vantaggio di circa lo 0,5%: è il modo di giocare che perde meno, non un sistema per vincere.</p>
    </div></div>`;
  }
  // baccarat: le regole fisse della terza carta e quanto conviene ogni puntata
  function tabellaBC() {
    const col = ['—', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    // il banco pesca? (riga = punti del banco, colonna = terza carta del punto, "—" = il punto non ha pescato)
    const pesca = (b, t) => {
      if (t === '—') return b <= 5;
      if (b <= 2) return true;
      if (b === 3) return t !== 8;
      if (b === 4) return t >= 2 && t <= 7;
      if (b === 5) return t >= 4 && t <= 7;
      if (b === 6) return t === 6 || t === 7;
      return false;
    };
    const righe = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => `<tr><th>${b <= 2 ? `${b}` : b}</th>${col.map((t) => `<td class="${pesca(b, t) ? 't-H' : 't-S'}">${pesca(b, t) ? 'P' : 'S'}</td>`).join('')}</tr>`).join('');
    return `<div class="cs-tabella" role="dialog" aria-label="Tabella del baccarat"><div class="cs-tab-scheda">
      <div class="cs-tab-testa"><b>📋 Tabella del baccarat</b><button type="button" class="bottone mini-bt" data-az="tabellaBC">✕ Chiudi</button></div>
      <p>Al baccarat nessuno decide: le carte si pescano con regole fisse. <b>Punto</b>: pesca la terza carta con 0-5, sta con 6-7. Con 8 o 9 (naturale) nessuno pesca.</p>
      <p class="piccolo"><b>Banco</b> (righe: i suoi punti · colonne: la terza carta del Punto, "—" se il Punto non ha pescato): <span class="t-H">P</span> pesca, <span class="t-S">S</span> sta.</p>
      <div class="cs-tab-scorri"><table class="bj-tab"><thead><tr><th></th>${col.map((t) => `<th>${t}</th>`).join('')}</tr></thead><tbody>${righe}</tbody></table></div>
      <table class="bc-quote"><thead><tr><th>Puntata</th><th>Esce</th><th>Paga</th><th>Vantaggio del casinò</th></tr></thead><tbody>
        <tr><td>Banco</td><td>45,9%</td><td>1 a 1 −5%</td><td><b>1,06%</b> (la migliore)</td></tr>
        <tr><td>Punto</td><td>44,6%</td><td>1 a 1</td><td>1,24%</td></tr>
        <tr><td>Pareggio</td><td>9,5%</td><td>8 a 1</td><td>14,4% (la peggiore)</td></tr></tbody></table>
      <p class="piccolo">Con un pareggio le puntate su Punto e Banco tornano indietro. Le mani passate non cambiano le probabilità delle prossime: la "strada" è solo un ricordo.</p>
    </div></div>`;
  }

  // I POSTI INTORNO AL TAVOLO DEL CASINÒ: il banco sta in alto al centro e io proprio davanti a lui; gli altri metà a
  // sinistra e metà a destra, sempre più in alto verso i lati, come lungo il bordo curvo di un tavolo vero.
  // Le sedie ai lati sono anche un po' girate verso il banco (--giro). posto(k) disegna un posto; restituisce la fila
  // dei posti da mettere sotto il banco.
  function postiAlTavolo(n, io, posto) {
    const altri = Array.from({ length: n }, (_, k) => k).filter((k) => k !== io);
    const sx = altri.slice(0, Math.floor(altri.length / 2)).reverse(), dx = altri.slice(sx.length); // sx: dal più vicino a me
    const arco = (d) => (d * d * 0.55 + d * 0.9).toFixed(2); // quanto sale il posto (in rem) a d posti da me
    const lato = (l, cls) => { const s = l.map((k, j) => `<div class="cs-sedia" style="--arco:${arco(j + 1)};--giro:${(cls === 'sx' ? 1 : -1) * (j + 1) * 4}deg">${posto(k)}</div>`); return `<div class="cs-lato ${cls}">${(cls === 'sx' ? s.reverse() : s).join('')}</div>`; };
    const mio = io >= 0 && io < n ? `<div class="cs-sedia cs-mia">${posto(io)}</div>` : '';
    return `<div class="cs-posti">${lato(sx, 'sx')}<div class="cs-centro-posto">${mio}</div>${lato(dx, 'dx')}</div>`;
  }
  window.TavoloCasino = { postiAlTavolo };

  const blackjack = {
    libero: true,
    reset(ctx) { segnaRicevuto(ctx); if (ctx.ui.bjConsiglio === undefined) { try { ctx.ui.bjConsiglio = localStorage.getItem('if:bjConsiglio') === '1'; } catch { ctx.ui.bjConsiglio = false; } } },
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio, ui = ctx.ui;
      const banco = `<div class="bj-banco"><p class="cs-etichetta">Banco${p.banco.carte.length ? ` · <b>${p.banco.totale}</b>${p.banco.coperta ? ' + ?' : ''}` : ''}</p>
        <div class="cs-carte">${p.banco.carte.map((c) => carta(ctx, c)).join('')}</div>
        <p class="bj-regola">Il banco sta su 17 · Blackjack paga 3 a 2</p></div>`;
      const giocatori = postiAlTavolo(p.n, io, (k) => {
        const mani = p.mani[k];
        const turno = p.turno === k;
        const netto = p.esiti && p.esiti[k] && mani.length ? `<span class="cs-netto ${p.esiti[k].netto > 0 ? 'su' : p.esiti[k].netto < 0 ? 'giu' : ''}">${p.esiti[k].netto > 0 ? '+' : ''}${fmtFiche(p.esiti[k].netto)}</span>` : '';
        return `<div class="bj-posto ${k === io ? 'mio' : ''} ${turno ? 'di-turno' : ''}">
          <p class="cs-nome">${esc(k === io ? 'Tu' : ctx.nome(k))} <small>${fmtFiche(p.fiche[k])} fiche</small> ${netto} ${p.fase === 'puntate' ? statoPuntata(ctx, k) : ''}</p>
          <div class="bj-mani">${mani.map((m, j) => manoBJ(ctx, m, turno && j === p.manoAttiva && p.fase === 'turni')).join('')}</div></div>`;
      });
      let comandi = '';
      const az = p.azioni || {};
      if (az.carta) {
        // 💡 consiglio: la mossa della strategia di base (si accende e si spegne, il browser se lo ricorda)
        const cons = ui.bjConsiglio && p.consiglio ? p.consiglio : null;
        const NOMI = { carta: 'Carta', stai: 'Stai', raddoppia: 'Raddoppia', dividi: 'Dividi' };
        const bt = (k, cls) => `<button type="button" class="bottone ${cls} ${cons === k ? 'bj-consigliato' : ''}" data-az="${k}" ${k === 'raddoppia' || k === 'dividi' ? (az[k] ? '' : 'disabled') : ''}>${NOMI[k]}</button>`;
        comandi = `<div class="cs-pannello"><div class="bj-comandi">
          ${bt('carta', 'primario-bt')}${bt('stai', 'primario-bt')}${bt('raddoppia', '')}${bt('dividi', '')}</div>
          <p class="piccolo">${contoAlla(ctx, p.tempoDecisione, 'Tempo per decidere:')}
          <button type="button" class="bottone mini-bt bj-cons-bt" data-az="consiglio" aria-pressed="${!!ui.bjConsiglio}">💡 Consiglio${cons ? `: <b>${NOMI[cons]}</b>` : ''}</button></p></div>`;
      }
      const punta = pannelloPuntate(ctx, `${selettore(ctx, 'bj', p.fiche[io])}
        <div class="bj-comandi"><button type="button" class="bottone primario-bt" data-az="punta" ${(ui.bj || 0) > 0 ? '' : 'disabled'}>Punta ${fmtFiche(Math.min(ui.bj || 0, p.fiche[io]))}</button>
        <button type="button" class="bottone" data-az="passa">Passo questa mano</button></div>`);
      const scarpa = `<p class="cs-scarpa">Scarpa: ${p.carteScarpa} carte${p.mescolata ? ' · <b>rimescolata</b>' : ''}</p>`;
      const tab = `<p class="cs-tab-apri"><button type="button" class="bottone mini-bt" data-az="tabellaBJ">📋 Tabella della strategia</button></p>`;
      return `<div class="cs bj"><div class="cs-tavolo">${banco}${giocatori}</div>${comandi}${punta}${tab}${scarpa}${ui.tabBJ ? tabellaBJ(p, io) : ''}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.fase === 'puntate') return 'Fate le vostre puntate';
      if (p.fase === 'turni') return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`;
      return null;
    },
    statoAttesa(ctx) { return ctx.partita.fase === 'banco' ? 'Gioca il banco…' : 'Pagamenti'; },
    infoPosto: infoFiche,
    clic(ctx, el) {
      if (clicFiche(ctx, el)) return;
      const az = el.dataset.az, p = ctx.partita;
      if (az === 'punta') { const v = Math.min(ctx.ui.bj || 0, p.fiche[ctx.mio]); if (v > 0) ctx.invia({ tipo: 'punta', importo: v }); return; }
      if (az === 'tabellaBJ') { ctx.ui.tabBJ = !ctx.ui.tabBJ; return ctx.ridisegna(); }
      if (az === 'consiglio') { ctx.ui.bjConsiglio = !ctx.ui.bjConsiglio; try { localStorage.setItem('if:bjConsiglio', ctx.ui.bjConsiglio ? '1' : ''); } catch {} return ctx.ridisegna(); }
      if (['carta', 'stai', 'raddoppia', 'dividi'].includes(az)) { el.disabled = true; ctx.invia({ tipo: az }); }
    },
  };

  // ======================= BACCARAT =======================
  const ZONE = { punto: ['Punto', '1 a 1'], pareggio: ['Pareggio', '8 a 1'], banco: ['Banco', '1 a 1 −5%'] };
  const baccarat = {
    libero: true,
    reset: segnaRicevuto,
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio, ui = ctx.ui;
      ui.bc = ui.bc || { punto: 0, banco: 0, pareggio: 0 };
      if (!ui.gettoneBc) ui.gettoneBc = 25;
      const m = p.mano;
      const lato = (l) => {
        const carte = m ? m[l] : [];
        const pt = m ? (l === 'punto' ? m.puntiP : m.puntiB) : '';
        const vince = m && m.vince === l;
        return `<div class="bc-lato bc-${l} ${vince ? 'vince' : ''}"><p class="cs-etichetta">${l === 'punto' ? 'Punto' : 'Banco'} ${m ? `<b>${pt}</b>` : ''}</p>
          <div class="cs-carte">${carte.map((c, k) => carta(ctx, c, k === 2 ? 'terza' : '')).join('')}</div></div>`;
      };
      const esito = m && m.vince ? `<p class="bc-esito ${m.vince}">${m.vince === 'pareggio' ? 'Pareggio!' : `Vince il ${m.vince === 'punto' ? 'Punto' : 'Banco'}`}${m.naturale ? ' · naturale' : ''}</p>` : '';
      const mieP = p.puntate[io] || {};
      const tot = ui.bc.punto + ui.bc.banco + ui.bc.pareggio;
      const libere = p.fiche[io] - tot;
      const puoPuntare = p.fase === 'puntate' && !p.inAttesa && !p.puntato[io] && !p.passato[io] && p.fiche[io] > 0;
      const zone = Object.entries(ZONE).map(([k, [nome, paga]]) => {
        const mia = puoPuntare ? ui.bc[k] : mieP[k] || 0;
        const altri = p.puntate.reduce((s, q, i) => s + (i !== io && q ? q[k] : 0), 0);
        const tag = puoPuntare ? 'button' : 'div';
        return `<${tag} ${puoPuntare ? `type="button" data-az="zona" data-z="${k}" ${ui.gettoneBc > libere ? 'disabled' : ''}` : ''} class="bc-zona bc-z-${k} ${m && m.vince === k ? 'vince' : ''}">
          <b>${nome}</b><small>paga ${paga}</small>${mia ? gettone(mia, 'mio') : ''}${altri ? `<span class="bc-altri">altri: ${fmtFiche(altri)}</span>` : ''}</${tag}>`;
      }).join('');
      const scelta = puoPuntare ? `<div class="cs-gettoni">${GETTONI.map((g) => `<button type="button" class="cs-gettone-bt ${ui.gettoneBc === g ? 'scelto' : ''}" data-az="gettone" data-v="${g}">${gettone(g)}</button>`).join('')}
          <button type="button" class="bottone mini-bt" data-az="azzeraBc" ${tot ? '' : 'disabled'}>Azzera</button></div>
        <p class="cs-importo">Scegli un gettone e clicca su Punto, Banco o Pareggio · puntato <b>${fmtFiche(tot)}</b> su ${fmtFiche(p.fiche[io])}</p>
        <div class="bj-comandi"><button type="button" class="bottone primario-bt" data-az="puntaBc" ${tot ? '' : 'disabled'}>Conferma puntata</button>
        <button type="button" class="bottone" data-az="passa">Passo questa mano</button></div>` : '';
      const pannello = pannelloPuntate(ctx, scelta);
      // ognuno al suo posto intorno al tavolo (io davanti al croupier), con quanto ha puntato e su cosa
      const giocatori = postiAlTavolo(p.n, io, (k) => {
        const e = p.esiti && p.esiti[k], q = p.puntate[k] || {};
        const su = Object.keys(ZONE).filter((z) => q[z]).map((z) => `<span class="bc-su bc-su-${z}">${ZONE[z][0]} ${fmtFiche(q[z])}</span>`).join('');
        const stato = su || (p.fase === 'puntate' ? statoPuntata(ctx, k) : '');
        return `<div class="bj-posto bc-posto ${k === io ? 'mio' : ''}"><p class="cs-nome">${esc(k === io ? 'Tu' : ctx.nome(k))} <small>${fmtFiche(p.fiche[k])} fiche</small>${e && e.puntato ? ` <span class="cs-netto ${e.netto > 0 ? 'su' : e.netto < 0 ? 'giu' : ''}">${e.netto > 0 ? '+' : ''}${fmtFiche(e.netto)}</span>` : ''}</p><div class="bc-sue">${stato}</div></div>`;
      });
      const strada = `<div class="bc-strada" title="Ultime mani">${p.storia.map((x) => `<i class="${x}">${x === 'punto' ? 'P' : x === 'banco' ? 'B' : 'T'}</i>`).join('')}</div>`;
      return `<div class="cs bc"><div class="cs-tavolo"><p class="cs-etichetta bc-croupier">Croupier</p><div class="bc-carte">${lato('punto')}${lato('banco')}</div>${esito}
        <div class="bc-tavolo">${zone}</div>${giocatori}</div>${pannello}${strada}
        <p class="cs-tab-apri"><button type="button" class="bottone mini-bt" data-az="tabellaBC">📋 Regole della terza carta e probabilità</button></p>
        <p class="cs-scarpa">8 mazzi · ${p.carteScarpa} carte${p.mescolata ? ' · <b>rimescolate</b>' : ''}</p>${ui.tabBC ? tabellaBC() : ''}</div>`;
    },
    stato(ctx) { return ctx.partita.fase === 'puntate' ? 'Fate le vostre puntate' : null; },
    statoAttesa(ctx) { return ctx.partita.fase === 'carte' ? 'Si scoprono le carte…' : 'Pagamenti'; },
    infoPosto: infoFiche,
    clic(ctx, el) {
      if (clicFiche(ctx, el)) return;
      const ui = ctx.ui, p = ctx.partita, az = el.dataset.az;
      if (az === 'tabellaBC') { ui.tabBC = !ui.tabBC; return ctx.ridisegna(); }
      if (az === 'gettone') { ui.gettoneBc = Number(el.dataset.v); return ctx.ridisegna(); }
      if (az === 'zona') {
        const tot = ui.bc.punto + ui.bc.banco + ui.bc.pareggio;
        const v = Math.min(ui.gettoneBc, p.fiche[ctx.mio] - tot);
        if (v > 0) ui.bc[el.dataset.z] += v;
        return ctx.ridisegna();
      }
      if (az === 'azzeraBc') { ui.bc = { punto: 0, banco: 0, pareggio: 0 }; return ctx.ridisegna(); }
      if (az === 'puntaBc') { const q = ui.bc; ui.bc = { punto: 0, banco: 0, pareggio: 0 }; ctx.invia({ tipo: 'punta', puntate: q }); }
    },
  };

  // ======================= HIGHER OR LOWER =======================
  const hl = {
    libero: true,
    reset: segnaRicevuto,
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio, ui = ctx.ui;
      const q = p.quote;
      const u = p.fase === 'rivela' ? p.uscita : null;
      const perc = (x) => `${Math.round(x * 100)}%`;
      const centro = `<div class="hl-tavolo">
        <div class="hl-carta">${carta(ctx, u ? u.prima : p.carta, 'grande')}<small>carta scoperta</small></div>
        <div class="hl-carta prossima">${u ? carta(ctx, u.carta, 'grande gira') : Carte.retro('cs-carta grande')}<small>${u ? (u.esito === 'uguale' ? 'uguale' : `più ${u.esito}!`) : 'prossima'}</small></div></div>`;
      const mia = p.puntate[io];
      const puo = p.fase === 'puntate' && !p.inAttesa && !p.puntato[io] && !p.passato[io] && p.fiche[io] > 0;
      const importo = Math.min(ui.hl || 0, p.fiche[io]);
      const scelta = puo ? `${selettore(ctx, 'hl', p.fiche[io])}
        <div class="hl-scelte">
          <button type="button" class="hl-bt alta" data-az="alta" ${q.alta && importo ? '' : 'disabled'}>⬆ Più alta<small>${q.alta ? `×${q.alta.toFixed(2).replace('.', ',')} · ${perc(q.pAlta)}` : 'impossibile'}</small></button>
          <button type="button" class="hl-bt bassa" data-az="bassa" ${q.bassa && importo ? '' : 'disabled'}>⬇ Più bassa<small>${q.bassa ? `×${q.bassa.toFixed(2).replace('.', ',')} · ${perc(q.pBassa)}` : 'impossibile'}</small></button></div>
        <p class="piccolo">Carta uguale: ${perc(q.pUguale)} (ti restituiscono la puntata)</p>
        <button type="button" class="bottone mini-bt" data-az="passa">Passo questa carta</button>` : '';
      const pannello = pannelloPuntate(ctx, scelta);
      const tuaPuntata = mia && !mia.nascosta ? `<p class="hl-tua">La tua puntata: <b>${fmtFiche(mia.importo)}</b> su più ${mia.scelta} (×${String(mia.quota).replace('.', ',')})</p>` : '';
      const giocatori = Array.from({ length: p.n }, (_, k) => k).map((k) => {
        const e = p.esiti && p.esiti[k];
        const pu = p.puntate[k];
        const cosa = pu && !pu.nascosta ? `${pu.scelta === 'alta' ? '⬆' : '⬇'} ${fmtFiche(pu.importo)}` : pu ? 'ha puntato ✓' : '';
        return `<span class="bc-g ${k === io ? 'mio' : ''}">${esc(k === io ? 'Tu' : ctx.nome(k))} <small>${fmtFiche(p.fiche[k])}</small> ${cosa}${e ? `<span class="cs-netto ${e.netto > 0 ? 'su' : e.netto < 0 ? 'giu' : ''}">${e.netto > 0 ? '+' : ''}${fmtFiche(e.netto)}</span>` : ''}</span>`;
      }).join('');
      const storia = p.storia.length ? `<div class="hl-storia"><small>Uscite prima:</small>${p.storia.map((c) => `<span class="${c.seme === 'c' || c.seme === 'q' ? 'rossa' : ''}">${Carte.sigla(c)}${Carte.seme(c.seme)}</span>`).join('')}</div>` : '';
      return `<div class="cs hl">${centro}${tuaPuntata}${pannello}<div class="bc-giocatori">${giocatori}</div>${storia}
        <p class="cs-scarpa">Nel mazzo: ${p.carteMazzo} carte${p.mescolata ? ' · <b>rimescolato</b>' : ''}</p></div>`;
    },
    stato(ctx) { return ctx.partita.fase === 'puntate' ? 'Più alta o più bassa?' : null; },
    statoAttesa: () => 'Si gira la carta…',
    infoPosto: infoFiche,
    clic(ctx, el) {
      if (clicFiche(ctx, el)) return;
      const az = el.dataset.az;
      if (az === 'alta' || az === 'bassa') {
        const v = Math.min(ctx.ui.hl || 0, ctx.partita.fiche[ctx.mio]);
        if (v > 0) ctx.invia({ tipo: 'punta', scelta: az, importo: v });
      }
    },
  };

  // ======================= POKER (Texas Hold'em e 5 carte) =======================
  // FORZA DELLA MANO (aiuto facoltativo): probabilità di vincere stimata dal server con migliaia di mani a caso
  const mostraForza = () => { try { return localStorage.getItem('if:pkForza') !== '0'; } catch { return true; } };
  function forzaHtml(p) {
    if (!p.forza) return '';
    if (!mostraForza()) return '<p class="pk-forza spenta"><button type="button" class="bottone mini-bt" data-az="pk-forza">💪 Mostra la forza della mano</button></p>';
    const x = p.forza.percento, col = x >= 60 ? 'alta' : x >= 35 ? 'media' : 'bassa';
    return `<p class="pk-forza ${col}" title="Stima: quante volte vinceresti arrivando allo showdown contro ${p.forza.avversari} ${p.forza.avversari === 1 ? 'avversario' : 'avversari'} con carte a caso">
      <span class="pk-forza-barra"><i style="width:${x}%"></i></span><b>${x}%</b> <small>di vincere contro ${p.forza.avversari}</small>
      <button type="button" class="pk-forza-x" data-az="pk-forza" aria-label="Nascondi la forza della mano">✕</button></p>`;
  }

  function tavoloPoker(ctx, centro, extraMio) {
    const p = ctx.partita, io = ctx.mio, ui = ctx.ui;
    const fine = p.fase === 'fine';
    const vincenti = new Set(fine && p.mostrate ? Object.entries(p.mostrate).filter(([i]) => (p.esiti[i] || {}).vinto > 0).flatMap(([, m]) => m.carte) : []);
    const posti = Array.from({ length: p.n }, (_, k) => k).map((k) => {
      const rel = (k - io + p.n) % p.n;
      const ang = Math.PI / 2 + (2 * Math.PI * rel) / p.n;
      const x = 50 + 46 * Math.cos(ang), y = 50 + 43 * Math.sin(ang);
      const vinto = fine && p.esiti && p.esiti[k] && p.esiti[k].vinto > 0;
      const fuori = !p.seduti[k];
      const cls = ['pk-posto', k === io ? 'mio' : '', k !== io && y < 20 ? 'alto' : '', p.turno === k ? 'di-turno' : '', !p.inMano[k] && !fuori ? 'lasciato' : '', fuori ? 'fuori' : '', vinto ? 'vince' : ''].join(' ');
      const carte = k === io ? '' : `<div class="pk-carte-altri">${(p.carte[k] || []).map((c) => carta(ctx, c, `piccola ${c && vincenti.has(c.id) ? 'vincente' : ''}`)).join('')}</div>`;
      const mano = fine && p.mostrate && p.mostrate[k] ? `<span class="pk-nome-mano">${esc(p.mostrate[k].nome)}</span>` : '';
      const netto = fine && p.esiti && p.esiti[k] && p.contrib[k] + (p.esiti[k].vinto || 0) > 0 ? `<span class="cs-netto ${p.esiti[k].netto > 0 ? 'su' : p.esiti[k].netto < 0 ? 'giu' : ''}">${p.esiti[k].netto > 0 ? '+' : ''}${fmtFiche(p.esiti[k].netto)}</span>` : '';
      const azione = p.ultima && p.ultima[k] ? `<span class="pk-azione">${esc(p.ultima[k])}</span>` : '';
      const punt = p.puntataGiro && p.puntataGiro[k] ? `<span class="pk-puntata">${gettone(p.puntataGiro[k])}</span>` : '';
      return `<div class="${cls}" style="left:${x}%;top:${y}%">
        ${p.dealer === k ? '<span class="pk-dealer" title="Mazziere">D</span>' : ''}
        ${carte}<div class="pk-targa"><b>${esc(k === io ? 'Tu' : ctx.nome(k))}</b><small>${fuori ? 'senza fiche' : `${fmtFiche(p.fiche[k])} fiche`}</small></div>
        ${azione}${mano}${netto}${punt}${k !== io ? `<div class="bolla-posto" data-bolla="${k}"></div>` : ''}</div>`;
    }).join('');
    const piatto = `<div class="pk-piatto">${p.piatto ? `Piatto <b>${fmtFiche(p.piatto)}</b>` : ''}${fine && p.piatti && p.piatti.length > 1 ? `<small>${p.piatti.map((x, j) => `${j ? 'laterale' : 'principale'} ${fmtFiche(x.somma)}`).join(' · ')}</small>` : ''}</div>`;
    // le mie carte, grandi, sotto il tavolo
    const mie = (p.carte[io] || []);
    const cambio = p.puoCambiare;
    ui.scarti = ui.scarti || [];
    // le mie carte in ordine di valore (asso alto)
    const v14 = (c) => (c.rango === 1 ? 14 : c.rango);
    const mieOrd = mie.every(Boolean) ? [...mie].sort((a, b) => v14(b) - v14(a) || String(a.seme).localeCompare(String(b.seme))) : mie;
    const mieHtml = mie.length ? `<div class="pk-mie">${mieOrd.map((c) => {
      if (!c) return Carte.retro('cs-carta');
      const scelta = ui.scarti.includes(c.id);
      const inner = carta(ctx, c, `${scelta ? 'da-scartare' : ''} ${vincenti.has(c.id) ? 'vincente' : ''}`);
      return cambio ? `<button type="button" class="pk-carta-bt" data-az="scarta" data-id="${c.id}" aria-pressed="${scelta}">${inner}</button>` : inner;
    }).join('')}</div>${p.miaMano && p.inMano[io] ? `<p class="pk-mia-mano">${esc(p.miaMano)}</p>` : ''}${forzaHtml(p)}` : '';
    // comandi
    let comandi = '';
    const az = p.azioni;
    if (az) {
      const pt = az.punta;
      if (pt) ui.pk = Math.max(pt.min, Math.min(pt.max, ui.pk || pt.min));
      // all-in solo se sono davvero tutte le mie fiche: nel pot limit il massimo può essere meno (il piatto)
      const tutto = pt ? pt.max >= p.fiche[io] + (p.puntataGiro[io] || 0) : false;
      const rapidi = pt ? [['Min', pt.min], ['½ piatto', p.piatto / 2 + (az.vedi || 0) + p.puntataGiro[io]], ['Piatto', p.piatto + (az.vedi || 0) * 2 + p.puntataGiro[io]], [tutto ? 'All-in' : 'Massimo', pt.max]]
        .map(([t, v]) => [t, Math.max(pt.min, Math.min(pt.max, Math.round(v / 5) * 5))]) : [];
      comandi = `<div class="cs-pannello pk-comandi">
        <div class="bj-comandi">
          ${az.lascia ? '<button type="button" class="bottone" data-az="lascia">Lascia</button>' : ''}
          ${az.passa ? '<button type="button" class="bottone primario-bt" data-az="passa">Passa</button>' : ''}
          ${az.vedi ? `<button type="button" class="bottone primario-bt" data-az="vedi">Vedi ${fmtFiche(az.vedi)}${az.vedi >= p.fiche[io] ? ' (all-in)' : ''}</button>` : ''}
          ${pt ? `<button type="button" class="bottone primario-bt" data-az="punta">${tutto && pt.max === ui.pk ? 'All-in' : az.rilancio ? 'Rilancia a' : 'Punta'} ${fmtFiche(ui.pk)}</button>` : ''}
        </div>
        ${pt && pt.max > pt.min ? `<div class="pk-slider"><input type="range" min="${pt.min}" max="${pt.max}" step="5" value="${ui.pk}" data-az-range="pk" aria-label="Quanto puntare">
          <div class="cs-gettoni">${rapidi.map(([t, v]) => `<button type="button" class="bottone mini-bt" data-az="pkRapido" data-v="${v}">${t}</button>`).join('')}</div></div>` : ''}
        <p class="piccolo">${contoAlla(ctx, p.tempoDecisione, 'Tempo:')}</p></div>`;
    } else if (cambio) {
      const n = ui.scarti.length;
      comandi = `<div class="cs-pannello"><p>Clicca le carte da cambiare (da 0 a 5).</p>
        <button type="button" class="bottone primario-bt" data-az="cambia">${n ? `Cambia ${n} ${n === 1 ? 'carta' : 'carte'}` : 'Sono servito'}</button>
        <p class="piccolo">${contoAlla(ctx, p.tempoDecisione, 'Tempo:')}</p></div>`;
    } else if (p.fase === 'attesa') {
      comandi = `<div class="cs-pannello"><p>Servono almeno due giocatori con le fiche. Chi è a zero scriva <b>!ricarica</b>.</p>${p.fiche[io] <= 0 ? '<button type="button" class="bottone primario-bt" data-az="ricarica">💰 Ricarica 1000 fiche</button>' : ''}</div>`;
    } else if (!p.seduti[io]) {
      comandi = `<div class="cs-pannello"><p>Sei senza fiche: guardi questa mano.</p>${p.fiche[io] <= 0 ? '<button type="button" class="bottone primario-bt" data-az="ricarica">💰 Ricarica 1000 fiche (dalla prossima mano)</button>' : ''}</div>`;
    }
    // le mie carte e i comandi stanno in un blocco solo: sui portatili bassi vanno uno accanto all'altro, sul telefono i
    // comandi restano attaccati al fondo dello schermo (così si punta senza scorrere)
    const io2 = mieHtml || extraMio ? `<div class="pk-io">${mieHtml}${extraMio || ''}</div>` : '';
    return `<div class="cs pk"><div class="pk-ovale"><div class="pk-centro">${centro}${piatto}</div>${posti}</div><div class="pk-sotto">${io2}${comandi}</div></div>`;
  }
  const statoPoker = (ctx) => {
    const p = ctx.partita;
    if (p.fase === 'attesa') return 'In attesa di giocatori con le fiche';
    if (p.turno == null) return null;
    if (p.fase === 'cambio') return p.turno === ctx.mio ? 'Tocca a te: cambia le carte' : `${ctx.nome(p.turno)} cambia le carte`;
    return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`;
  };
  const clicPoker = (ctx, el) => {
    if (clicFiche(ctx, el)) return;
    const ui = ctx.ui, az = el.dataset.az;
    if (az === 'lascia' || az === 'passa' || az === 'vedi') { el.disabled = true; return ctx.invia({ tipo: az }); }
    if (az === 'punta') { el.disabled = true; return ctx.invia({ tipo: 'punta', fino: ui.pk }); }
    if (az === 'pkRapido') { ui.pk = Number(el.dataset.v); return ctx.ridisegna(); }
    if (az === 'pk-forza') { try { localStorage.setItem('if:pkForza', mostraForza() ? '0' : '1'); } catch { /* niente */ } return ctx.ridisegna(); }
    if (az === 'scarta') { const id = el.dataset.id; ui.scarti = ui.scarti.includes(id) ? ui.scarti.filter((x) => x !== id) : [...ui.scarti, id]; return ctx.ridisegna(); }
    if (az === 'cambia') { const c = ui.scarti; ui.scarti = []; return ctx.invia({ tipo: 'cambia', carte: c }); }
  };
  // la barra per scegliere quanto puntare aggiorna il numero sul pulsante senza ridisegnare tutto
  let ctxPoker = null;
  document.addEventListener('input', (e) => {
    if (!e.target.dataset || e.target.dataset.azRange !== 'pk' || !ctxPoker) return;
    ctxPoker.ui.pk = Number(e.target.value);
    const b = document.querySelector('[data-az="punta"]');
    const pt = ctxPoker.partita.azioni && ctxPoker.partita.azioni.punta;
    if (b && pt) b.textContent = `${pt.max === ctxPoker.ui.pk ? 'All-in' : ctxPoker.partita.azioni.rilancio ? 'Rilancia a' : 'Punta'} ${fmtFiche(ctxPoker.ui.pk)}`;
  });
  const infoPoker = (ctx, posto) => `${fmtFiche(ctx.partita.fiche[posto])} fiche`;

  const texas = {
    libero: true,
    senzaFila: true,
    reset(ctx) { segnaRicevuto(ctx); ctxPoker = ctx; if (ctx.ui.manoVista !== ctx.partita.nMano) { ctx.ui.manoVista = ctx.partita.nMano; ctx.ui.pk = 0; } },
    panno(ctx) {
      const p = ctx.partita;
      const fine = p.fase === 'fine';
      const vincenti = new Set(fine && p.mostrate ? Object.entries(p.mostrate).filter(([i]) => (p.esiti[i] || {}).vinto > 0).flatMap(([, m]) => m.carte) : []);
      const tavola = Array.from({ length: 5 }, (_, k) => (p.tavola[k] ? carta(ctx, p.tavola[k], vincenti.has(p.tavola[k].id) ? 'vincente' : '') : '<div class="pk-vuota"></div>')).join('');
      return tavoloPoker(ctx, `<div class="cs-carte pk-tavola">${tavola}</div><p class="pk-strada">${p.fase === 'attesa' ? '' : { preflop: 'Prima del flop', flop: 'Flop', turn: 'Turn', river: 'River' }[p.strada]}</p>`);
    },
    stato: statoPoker,
    statoAttesa(ctx) { return ctx.partita.fase === 'corsa' ? 'Tutti all-in: escono le carte…' : 'Fine della mano'; },
    infoPosto: infoPoker,
    clic: clicPoker,
  };
  const poker5 = {
    libero: true,
    senzaFila: true,
    reset: texas.reset,
    panno(ctx) {
      const p = ctx.partita;
      const fase = p.fase === 'cambio' ? 'Cambio delle carte' : p.fase === 'giro' ? (p.giro === 1 ? 'Primo giro di puntate' : 'Secondo giro di puntate') : p.fase === 'fine' ? 'Carte scoperte' : '';
      const cambi = p.fase !== 'attesa' && p.cambiate ? `<p class="pk-strada">${p.cambiate.map((x, i) => (x !== null && p.inMano[i] ? `${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))}: ${x ? `cambia ${x}` : 'servito'}` : null)).filter(Boolean).join(' · ')}</p>` : '';
      return tavoloPoker(ctx, `<p class="pk-fase">${fase}</p>${cambi}`);
    },
    stato: statoPoker,
    statoAttesa: () => 'Fine della mano',
    infoPosto: infoPoker,
    clic: clicPoker,
  };

  // ======================= UNO =======================
  const SIMBOLO_UNO = { salta: '⊘', inverti: '⇄', '+2': '+2', '+4': '+4', jolly: '' };
  const nomeColore = { rosso: 'Rosso', giallo: 'Giallo', verde: 'Verde', blu: 'Blu' };
  function cartaUno(c, extra = '', attr = '') {
    const nera = c.valore === 'jolly' || c.valore === '+4';
    const simbolo = SIMBOLO_UNO[c.valore] ?? c.valore;
    const centro = nera
      ? `<span class="uno-ruota"><i></i><i></i><i></i><i></i></span>${c.valore === '+4' ? '<b class="uno-sopra">+4</b>' : ''}`
      : `<b class="uno-grande ${/^\d$/.test(c.valore) ? '' : 'simbolo'}">${simbolo}</b>`;
    const titolo = nera ? (c.valore === '+4' ? 'Jolly +4' : 'Jolly cambia colore') : `${simbolo} ${nomeColore[c.colore]}`;
    return `<div class="uno-carta ${nera ? 'nera' : c.colore} ${extra}" data-id="${c.id}" title="${esc(titolo)}" ${attr}>
      <span class="uno-angolo">${nera ? (c.valore === '+4' ? '+4' : '★') : simbolo}</span><span class="uno-ovale">${centro}</span><span class="uno-angolo giu">${nera ? (c.valore === '+4' ? '+4' : '★') : simbolo}</span></div>`;
  }
  const retroUno = (extra = '') => `<div class="uno-carta retro ${extra}"><span class="uno-ovale"><b class="uno-logo">1!</b></span></div>`;
  const uno = {
    libero: true,
    statoAttesa: (ctx) => (ctx.partita.pescando === ctx.mio ? 'Stai pescando…' : `${ctx.nome(ctx.partita.pescando)} pesca…`),
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita;
      const cima = cartaUno(p.cima, `uno-cima ${p.ultima ? 'arriva' : ''}`);
      const mazzo = `<button type="button" class="uno-mazzo ${p.puoPescare ? 'attivo' : ''}" data-az="pesca" ${p.puoPescare ? '' : 'disabled'} title="Pesca">${retroUno()}${retroUno('dietro')}<small>${p.puoPescare ? (p.accumulo ? `Pesca ${p.accumulo}` : 'Pesca') : `${p.carteMazzo} carte`}</small></button>`;
      const info = `<div class="uno-info"><span class="uno-colore ${p.colore}">${nomeColore[p.colore]}</span>
        <span class="uno-verso ${p.verso < 0 ? 'antiorario' : ''}" title="Verso del gioco">⟳</span>
        ${p.accumulo ? `<span class="uno-accumulo">+${p.accumulo} da pescare${p.tipoAccumulo === '+4' ? ' · solo +4 per rispondere' : ' · rispondi con +2 o +4'}</span>` : ''}</div>`;
      let barra = '';
      if (mio && ui.sel && ui.sel.length) barra = `<div class="cs-pannello"><p>Carte scelte: <b>${ui.sel.length}</b> · clicca le altre carte uguali da aggiungere</p>
        <div class="bj-comandi"><button type="button" class="bottone primario-bt" data-az="giocaSel">Gioca ${ui.sel.length} ${ui.sel.length === 1 ? 'carta' : 'carte'}</button><button type="button" class="bottone" data-az="annullaSel">Annulla</button></div></div>`;
      if (mio && p.pescata) barra = p.puoTenere
        ? `<div class="cs-pannello"><p>Hai pescato un <b>${esc(p.mano.find((c) => c.id === p.pescata)?.valore || '')}</b>: puoi giocarlo oppure tenerlo per dopo.</p><div class="bj-comandi"><button type="button" class="bottone" data-az="tieni">Tienila e passa</button></div></div>`
        : `<div class="cs-pannello"><p>Hai pescato una carta giocabile: <b>giocala</b> (è evidenziata).</p></div>`;
      if (p.pescando != null) barra = `<div class="cs-pannello"><p>${p.pescando === ctx.mio ? 'Stai pescando' : `${esc(ctx.nome(p.pescando))} sta pescando`}… una carta alla volta</p></div>`;
      const colori = ui.sceltaColore ? `<div class="uno-scegli"><p>Scegli il colore</p><div>${['rosso', 'giallo', 'verde', 'blu'].map((c) => `<button type="button" class="uno-col-bt ${c}" data-az="colore" data-c="${c}">${nomeColore[c]}</button>`).join('')}</div>
        <button type="button" class="bottone mini-bt" data-az="annullaColore">Annulla</button></div>` : '';
      // il pulsante UNO! c'è sempre, in basso a destra; si illumina appena appena solo quando serve
      const restano = p.mano.length - (ui.sel && ui.sel.length ? ui.sel.length : 1);
      const serve = mio && p.mano.length >= 2 && restano === 1;
      const bottoneUno = p.finita ? '' : `<button type="button" class="uno-bt fisso ${serve ? 'serve' : ''} ${ui.uno ? 'detto' : ''}" data-az="uno" aria-pressed="${!!ui.uno}">${ui.uno ? 'UNO! ✓' : 'UNO!'}</button>`;
      return `<div class="uno-tavolo"><div class="uno-centro">${mazzo}${cima}</div>${info}${barra}${bottoneUno}${colori}</div>`;
    },
    mano(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const ok = new Set(p.giocabili);
      const sel = new Set(ui.sel || []);
      const valoreSel = ui.sel && ui.sel.length ? p.mano.find((c) => c.id === ui.sel[0])?.valore : null;
      // mano ordinata per colore e poi per valore; le nere in fondo
      const ORD_COL = ['rosso', 'giallo', 'verde', 'blu'], ORD_VAL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'salta', 'inverti', '+2', 'jolly', '+4'];
      const kc = (c) => (c.colore ? ORD_COL.indexOf(c.colore) : 9);
      const ordinata = [...p.mano].sort((a, b) => kc(a) - kc(b) || ORD_VAL.indexOf(a.valore) - ORD_VAL.indexOf(b.valore));
      return `<div class="uno-mano">${ordinata.map((c) => {
        const aggiungibile = valoreSel && c.valore === valoreSel && !sel.has(c.id);
        const attiva = ok.has(c.id) || aggiungibile || sel.has(c.id);
        return cartaUno(c, `${attiva ? 'giocabile' : 'spenta'} ${sel.has(c.id) ? 'alzata' : ''} ${p.pescata === c.id ? 'pescata' : ''}`, attiva ? `data-az="carta" role="button" tabindex="0"` : '');
      }).join('')}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      if (p.pescando != null) return p.pescando === ctx.mio ? 'Stai pescando…' : `${ctx.nome(p.pescando)} pesca…`;
      if (p.turno !== ctx.mio) return `Tocca a ${ctx.nome(p.turno)}`;
      if (p.puoTenere) return 'Gioca il +2/+4 o tienilo';
      if (p.accumulo) return p.puoPescare && !p.giocabili.length ? `Devi pescare ${p.accumulo} carte` : `Rispondi o pesca ${p.accumulo}`;
      return p.giocabili.length ? 'Tocca a te' : 'Nessuna carta giocabile: pesca';
    },
    infoPosto(ctx, posto) {
      const n = ctx.partita.carteInMano[posto];
      return `<span class="uno-conta">${n} ${n === 1 ? 'carta' : 'carte'}</span>${n === 1 ? ' <span class="cs-badge rosso">UNO!</span>' : ''}`;
    },
    clic(ctx, el) {
      const ui = ctx.ui, p = ctx.partita, az = el.dataset.az;
      const gioca = (carte) => {
        const prima = p.mano.find((c) => c.id === carte[0]);
        if (prima.valore === 'jolly' || prima.valore === '+4') { ui.sceltaColore = carte; return ctx.ridisegna(); }
        const u = ui.uno; ui.sel = []; ui.uno = false;
        ctx.invia({ tipo: 'gioca', carte, uno: u });
      };
      if (az === 'pesca') { ui.sel = []; return ctx.invia({ tipo: 'pesca' }); }
      if (az === 'tieni') { ui.sel = []; ui.uno = false; return ctx.invia({ tipo: 'tieni' }); }
      if (az === 'uno') { ui.uno = !ui.uno; return ctx.ridisegna(); }
      if (az === 'annullaSel') { ui.sel = []; return ctx.ridisegna(); }
      if (az === 'giocaSel') return gioca(ui.sel);
      if (az === 'annullaColore') { ui.sceltaColore = null; return ctx.ridisegna(); }
      if (az === 'colore') { const carte = ui.sceltaColore; const u = ui.uno; ui.sceltaColore = null; ui.sel = []; ui.uno = false; return ctx.invia({ tipo: 'gioca', carte, colore: el.dataset.c, uno: u }); }
      if (az !== 'carta') return;
      const id = el.dataset.id;
      const c = p.mano.find((x) => x.id === id);
      if (ui.sel && ui.sel.length) { // si stanno scegliendo più carte uguali
        if (ui.sel.includes(id)) ui.sel = ui.sel.filter((x) => x !== id);
        else if (c.valore === p.mano.find((x) => x.id === ui.sel[0]).valore) ui.sel.push(id);
        return ctx.ridisegna();
      }
      const uguali = p.pescata ? [] : p.mano.filter((x) => x.id !== id && x.valore === c.valore);
      if (uguali.length) { ui.sel = [id]; return ctx.ridisegna(); }
      gioca([id]);
    },
  };

  // ======================= CAMPO MINATO =======================
  const COLORI_GIOCATORI = ['#e8c16a', '#6aa8ff', '#ff7b6b', '#7fd1a8', '#c89bff', '#ffa94d', '#5fd0d0', '#f7a8d8'];
  let ctxCampo = null;
  const cursori = new Map(); // posto → cella
  function mettiCursori() {
    const griglia = document.querySelector('.ms-griglia');
    if (!griglia || !ctxCampo) return;
    griglia.querySelectorAll('.ms-cursore').forEach((e) => e.remove());
    const C = ctxCampo.partita.colonne;
    for (const [posto, cella] of cursori) {
      if (cella == null || posto === ctxCampo.mio) continue;
      const el = document.createElement('span');
      el.className = 'ms-cursore';
      el.style.cssText = `--x:${cella % C};--y:${Math.floor(cella / C)};--col:${COLORI_GIOCATORI[posto % 8]}`;
      el.textContent = ctxCampo.nome(posto);
      griglia.append(el);
    }
  }
  let ultimoInvio = 0, ultimaCellaInviata = null;
  document.addEventListener('pointermove', (e) => {
    if (!ctxCampo || !ctxCampo.partita || ctxCampo.partita.gioco !== 'campo' || ctxCampo.partita.n < 2) return;
    const el = e.target.closest && e.target.closest('.ms-cella');
    const cella = el ? Number(el.dataset.cella) : null;
    if (cella === ultimaCellaInviata || Date.now() - ultimoInvio < 90) return;
    ultimoInvio = Date.now(); ultimaCellaInviata = cella;
    ctxCampo.emetti('cursore', cella);
  });
  // clic destro = bandierina
  document.addEventListener('contextmenu', (e) => {
    const el = e.target.closest && e.target.closest('.ms-cella');
    if (!el || !ctxCampo) return;
    e.preventDefault();
    if (ctxCampo.partita.finita) return;
    ctxCampo.invia({ tipo: 'bandiera', cella: Number(el.dataset.cella) });
  });
  const ricevutoCampo = new WeakMap();
  const tempoCampo = (p) => p.tempo + (p.corre ? Date.now() - (ricevutoCampo.get(p) || Date.now()) : 0);
  setInterval(() => {
    const p = ctxCampo && ctxCampo.stato && ctxCampo.stato.partita;
    if (!p || p.gioco !== 'campo') return;
    const el = document.querySelector('.ms-tempo');
    if (el) el.textContent = fmtTempo(tempoCampo(p));
  }, 250);
  const fmtTempo = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // aggiorna il pulsante del modo senza aspettare il prossimo messaggio del server
  function modoCampo(el, ctx) { el.setAttribute('aria-pressed', String(!!ctx.ui.msBandiera)); el.textContent = ctx.ui.msBandiera ? '🚩 Bandierine' : '⛏ Scava'; }
  const campo = {
    libero: true,
    reset(ctx) { ctxCampo = ctx; if (!ricevutoCampo.has(ctx.partita)) ricevutoCampo.set(ctx.partita, Date.now()); },
    dopo: () => mettiCursori(),
    cursore(ctx, d) { cursori.set(d.posto, d.cella); mettiCursori(); },
    panno(ctx) {
      const p = ctx.partita;
      const g = p.griglia;
      const C = p.colonne;
      let celle = '';
      for (let i = 0; i < g.length; i++) {
        const x = g[i];
        const r = Math.floor(i / C), c = i % C;
        const pari = (r + c) % 2 === 0 ? 'a' : 'b';
        if (x === 'h' || x === 'f') {
          const chi = p.bandiere[i];
          celle += `<div class="ms-cella coperta ${pari}" data-az="apri" data-cella="${i}">${x === 'f' ? `<span class="ms-bandiera" style="--col:${p.n > 1 ? COLORI_GIOCATORI[chi % 8] : '#e2412f'}">⚑</span>` : ''}</div>`;
        } else if (x === 'm' || x === 'F' || x === 'W' || x === 'x') {
          const cls = x === 'x' ? 'esplosa' : x === 'F' ? 'giusta' : x === 'W' ? 'sbagliata' : 'mina';
          celle += `<div class="ms-cella ${x === 'W' ? 'coperta' : 'aperta'} ${pari} ${cls}" data-cella="${i}" style="--k:${(i * 7) % 23}">${x === 'W' ? '<span class="ms-bandiera">⚑</span><i class="ms-no">✕</i>' : x === 'F' ? '<span class="ms-bandiera">⚑</span>' : '<span class="ms-mina"></span>'}</div>`;
        } else celle += `<div class="ms-cella aperta ${pari} n${x}" data-cella="${i}">${x === '0' ? '' : x}</div>`;
      }
      const residue = p.mine - p.bandiereTot;
      const punti = p.modo === 'sfida' ? `<div class="ms-punti">${p.punti.map((x, k) => `<span style="--col:${COLORI_GIOCATORI[k % 8]}">${esc(k === ctx.mio ? 'Tu' : ctx.nome(k))} <b>${x}</b></span>`).join('')}</div>` : '';
      const rec = p.record.length ? `<div class="ms-record"><b>🏆 Migliori tempi · ${esc(p.nomeLivello)}${p.n === 1 ? '' : ' in squadra'}</b><ol>${p.record.map((x, k) => `<li class="${k === p.posizioneRecord ? 'nuovo' : ''}">${fmtTempo(x.ms)}${x.giocatori > 1 ? ` <small>(${x.giocatori} giocatori)</small>` : ''}</li>`).join('')}</ol></div>` : '';
      const fine = p.finita ? `<p class="ms-esito ${p.vinta ? 'si' : 'no'}">${p.modo === 'coop' ? (p.vinta ? `🎉 Campo sminato in ${fmtTempo(p.tempo)}!` : '💥 Boom! Una mina…') : '🏁 Campo pulito!'}</p>` : '';
      return `<div class="ms">
        <div class="ms-barra"><span title="Mine ancora da trovare">🚩 <b>${residue}</b></span><span title="Tempo">⏱ <b class="ms-tempo">${fmtTempo(tempoCampo(p))}</b></span>
          <span class="piccolo">${esc(p.nomeLivello)} · ${p.colonne}×${p.righe} · ${p.modo === 'coop' ? (p.n > 1 ? 'collaborazione' : 'da solo') : 'sfida'}</span>
          ${p.finita ? '' : `<button type="button" class="bottone mini-bt ms-modo" data-az="modo-bandiera" aria-pressed="${!!ctx.ui.msBandiera}" title="Sul telefono: tocca qui, poi tocca le caselle per mettere o togliere la bandierina">${ctx.ui.msBandiera ? '🚩 Bandierine' : '⛏ Scava'}</button>`}</div>
        ${punti}${fine}
        <div class="ms-scorri"><div class="ms-griglia ${p.finita ? 'finita' : ''}" style="--C:${C};--R:${p.righe}">${celle}</div></div>
        ${!p.mine || p.aperte === 0 ? '<p class="piccolo">Clic sinistro scopre, clic destro mette la bandierina (sul telefono: il pulsante ⛏/🚩 in alto cambia cosa fa il tocco). Il primo clic è sempre sicuro.</p>' : ''}${p.finita ? rec : ''}</div>`;
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      return p.aperte ? `${p.aperte} / ${p.daAprire} caselle scoperte` : 'Scopri la prima casella';
    },
    infoPosto(ctx, posto) { return ctx.partita.modo === 'sfida' ? `${ctx.partita.punti[posto]} punti` : ''; },
    clic(ctx, el) {
      if (el.dataset.az === 'modo-bandiera') { ctx.ui.msBandiera = !ctx.ui.msBandiera; return ctx.ridisegna ? ctx.ridisegna() : modoCampo(el, ctx); }
      if (el.dataset.az !== 'apri' || ctx.partita.finita) return;
      // modo bandierina (per il telefono, dove non c'è il clic destro): il tocco mette o toglie la bandierina
      if (ctx.ui.msBandiera) return ctx.invia({ tipo: 'bandiera', cella: Number(el.dataset.cella) });
      if (el.querySelector('.ms-bandiera')) return; // con la bandierina non si scopre
      ctx.invia({ tipo: 'apri', cella: Number(el.dataset.cella) });
    },
  };


  // ======================= ROULETTE MAGGIONI =======================
  // la ruota europea in SVG che gira (l'animazione riparte dal punto giusto anche se il tavolo si ridisegna),
  // il croupier Maggioni con la sua nuvoletta e il tappeto delle puntate (in orizzontale, in verticale sul telefono)
  const RL_ESTERNE = { rosso: 'Rosso', nero: 'Nero', pari: 'Pari', dispari: 'Dispari', basso: '1-18', alto: '19-36', d1: '1ª 12', d2: '2ª 12', d3: '3ª 12', c1: '2 a 1', c2: '2 a 1', c3: '2 a 1' };
  function rlRuota(p, ui) {
    const R = p.ruota, rossi = new Set(p.rossi), n = R.length, passo = 360 / n;
    const col = (x) => (x === 0 ? '#1d8a4c' : rossi.has(x) ? '#c8302a' : '#1b1b1f');
    const spicchi = R.map((x, i) => {
      const a0 = ((i - 0.5) * passo - 90) * Math.PI / 180, a1 = ((i + 0.5) * passo - 90) * Math.PI / 180, am = (i * passo - 90) * Math.PI / 180;
      const pt = (a, r) => `${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`;
      return `<path d="M${pt(a0, 96)} A96 96 0 0 1 ${pt(a1, 96)} L${pt(a1, 66)} A66 66 0 0 0 ${pt(a0, 66)}Z" fill="${col(x)}" stroke="#d9b45a" stroke-width=".6"/>
        <text x="${(100 + Math.cos(am) * 83).toFixed(1)}" y="${(100 + Math.sin(am) * 83).toFixed(1)}" transform="rotate(${i * passo} ${(100 + Math.cos(am) * 83).toFixed(1)} ${(100 + Math.sin(am) * 83).toFixed(1)})" class="rl-num">${x}</text>`;
    }).join('');
    // durante il giro: la ruota ruota fino a portare il numero uscito in alto, la pallina gira al contrario e ci cade
    let classe = '', stile = '';
    if (p.numero !== null && p.numero !== undefined) {
      const i = R.indexOf(p.numero), fine = -(i * passo) - 360 * 4;
      const chiave = `${p.nMano}`;
      if (ui.rlGiro !== chiave) { ui.rlGiro = chiave; ui.rlDa = Date.now(); }
      const trascorso = p.fase === 'giro' ? Math.min(p.giroMs, Date.now() - ui.rlDa) : p.giroMs;
      classe = 'gira'; stile = `--fine:${fine}deg;--durata:${p.giroMs}ms;--ritardo:-${trascorso}ms`;
    }
    return `<div class="rl-ruota ${classe}" style="${stile}"><svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="99" fill="#5a3418"/><g class="rl-disco">${spicchi}<circle cx="100" cy="100" r="66" fill="#7a4a24"/>
      <circle cx="100" cy="100" r="40" fill="#b8893b"/><path d="M100 64 L104 96 L136 100 L104 104 L100 136 L96 104 L64 100 L96 96Z" fill="#e8c46a"/></g>
      <g class="rl-orbita"><circle class="rl-palla" cx="100" cy="11" r="4.2"/></g><path d="M100 1 l-5 -1 h10z" fill="#e8c46a"/></svg></div>`;
  }
  function rlMaggioni(frase) {
    return `<div class="rl-croupier"><svg viewBox="0 0 90 110" aria-hidden="true">
      <rect x="18" y="62" width="54" height="48" rx="14" fill="#1f2433"/><path d="M34 62 L45 82 L56 62Z" fill="#f4f4f4"/><path d="M39 66 L45 70 L51 66 L51 74 L45 70 L39 74Z" fill="#b3202a"/>
      <rect x="24" y="80" width="16" height="12" rx="2" fill="#e8c46a"/><text x="32" y="89" class="rl-targa">M</text>
      <circle cx="45" cy="40" r="22" fill="#f1c7a0"/><path d="M23 36 Q26 14 45 15 Q66 14 67 36 Q60 24 45 24 Q31 24 23 36Z" fill="#3a2a1e"/>
      <circle cx="37" cy="41" r="2.6" fill="#222"/><circle cx="53" cy="41" r="2.6" fill="#222"/><path d="M36 51 Q45 57 54 51" stroke="#6b3a2a" stroke-width="2.4" fill="none"/>
      <path d="M33 47 Q45 44 57 47" stroke="#3a2a1e" stroke-width="3" fill="none"/></svg>
      <p class="rl-nome">Maggioni</p><p class="rl-frase">«${esc(frase || 'Fate il vostro gioco!')}»</p></div>`;
  }
  const roulette = {
    libero: true,
    reset: segnaRicevuto,
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio, ui = ctx.ui;
      ui.rl = ui.rl || {}; if (!ui.gettoneRl) ui.gettoneRl = 25;
      const rossi = new Set(p.rossi);
      const puo = p.fase === 'puntate' && !p.inAttesa && !p.puntato[io] && !p.passato[io] && p.fiche[io] > 0;
      const tot = Object.values(ui.rl).reduce((a, b) => a + b, 0), libere = p.fiche[io] - tot;
      const mie = puo ? ui.rl : p.puntate[io] || {};
      const esce = p.fase === 'pagamenti' ? p.numero : null;
      const vince = (k) => esce !== null && ((k === `n${esce}`) || (esce > 0 && ((k === 'rosso' && rossi.has(esce)) || (k === 'nero' && !rossi.has(esce)) || (k === 'pari' && esce % 2 === 0) || (k === 'dispari' && esce % 2 === 1) || (k === 'basso' && esce <= 18) || (k === 'alto' && esce >= 19) || (k === `d${Math.ceil(esce / 12)}`) || (k === `c${((esce - 1) % 3) + 1}`))));
      const cella = (k, testo, c, r, sc, sr, cls) => {
        const mia = mie[k] || 0, altri = p.puntate.reduce((a, q, i) => a + (i !== io && q && q[k] ? q[k] : 0), 0);
        const tag = puo ? 'button' : 'div';
        return `<${tag} ${puo ? `type="button" data-az="rlc" data-k="${k}" ${ui.gettoneRl > libere ? 'disabled' : ''}` : ''} class="rl-c ${cls} ${vince(k) ? 'vince' : ''} ${mia ? 'rl-puntata' : ''}" style="--c:${c};--r:${r};--sc:${sc};--sr:${sr}">
          <span>${testo}</span>${mia ? gettone(mia, 'mio') : ''}${altri ? `<i class="rl-altri" title="puntate degli altri">${fmtFiche(altri)}</i>` : ''}</${tag}>`;
      };
      let celle = cella('n0', '0', 1, 1, 1, 3, 'verde');
      for (let n = 1; n <= 36; n++) celle += cella(`n${n}`, String(n), 1 + Math.ceil(n / 3), 3 - ((n - 1) % 3), 1, 1, rossi.has(n) ? 'rosso' : 'nero');
      celle += cella('c3', '2 a 1', 14, 1, 1, 1, 'est') + cella('c2', '2 a 1', 14, 2, 1, 1, 'est') + cella('c1', '2 a 1', 14, 3, 1, 1, 'est');
      celle += cella('d1', '1ª 12', 2, 4, 4, 1, 'est') + cella('d2', '2ª 12', 6, 4, 4, 1, 'est') + cella('d3', '3ª 12', 10, 4, 4, 1, 'est');
      [['basso', '1-18'], ['pari', 'Pari'], ['rosso', '<b class="rombo rosso"></b>'], ['nero', '<b class="rombo nero"></b>'], ['dispari', 'Dispari'], ['alto', '19-36']].forEach(([k, t], j) => { celle += cella(k, t, 2 + j * 2, 5, 2, 1, `est ${k}`); });
      const scelta = puo ? `<div class="cs-gettoni">${GETTONI.map((g) => `<button type="button" class="cs-gettone-bt ${ui.gettoneRl === g ? 'scelto' : ''}" data-az="rlGettone" data-v="${g}">${gettone(g)}</button>`).join('')}
          <button type="button" class="bottone mini-bt" data-az="rlAzzera" ${tot ? '' : 'disabled'}>Azzera</button>
          ${ui.rlUltima ? `<button type="button" class="bottone mini-bt" data-az="rlRipeti">Ripeti l'ultima</button>` : ''}</div>
        <p class="cs-importo">Scegli un gettone e tocca le caselle del tappeto · puntato <b>${fmtFiche(tot)}</b> su ${fmtFiche(p.fiche[io])}</p>
        <div class="bj-comandi"><button type="button" class="bottone primario-bt" data-az="rlPunta" ${tot ? '' : 'disabled'}>Conferma puntata</button>
        <button type="button" class="bottone" data-az="passa">Passo questo giro</button></div>` : '';
      const giocatori = Array.from({ length: p.n }, (_, k) => k).map((k) => {
        const e = p.esiti && p.esiti[k];
        return `<span class="bc-g ${k === io ? 'mio' : ''}">${esc(k === io ? 'Tu' : ctx.nome(k))} <small>${fmtFiche(p.fiche[k])}</small>${e && e.puntato ? `<span class="cs-netto ${e.netto > 0 ? 'su' : e.netto < 0 ? 'giu' : ''}">${e.netto > 0 ? '+' : ''}${fmtFiche(e.netto)}</span>` : ''}</span>`;
      }).join('');
      const numCol = (x) => (x === 0 ? 'verde' : rossi.has(x) ? 'rosso' : 'nero');
      const storia = `<div class="rl-storia"><small>Ultimi numeri</small>${p.storia.slice().reverse().map((x) => `<i class="${numCol(x)}">${x}</i>`).join('') || '<small>—</small>'}</div>`;
      const uscito = esce !== null ? `<p class="rl-uscito ${numCol(esce)}">${esce}</p>` : '';
      return `<div class="cs rl"><div class="rl-testa">${rlMaggioni(p.frase)}${rlRuota(p, ui)}${uscito}</div>${storia}
        <div class="rl-tappeto">${celle}</div>${pannelloPuntate(ctx, scelta)}<div class="bc-giocatori">${giocatori}</div></div>`;
    },
    stato(ctx) { return ctx.partita.fase === 'puntate' ? 'Fate il vostro gioco' : null; },
    statoAttesa(ctx) { return ctx.partita.fase === 'giro' ? 'La ruota gira…' : 'Pagamenti'; },
    infoPosto: infoFiche,
    clic(ctx, el) {
      if (clicFiche(ctx, el)) return;
      const ui = ctx.ui, p = ctx.partita, az = el.dataset.az;
      const tot = () => Object.values(ui.rl).reduce((a, b) => a + b, 0);
      if (az === 'rlGettone') { ui.gettoneRl = Number(el.dataset.v); return ctx.ridisegna(); }
      if (az === 'rlc') { const v = Math.min(ui.gettoneRl, p.fiche[ctx.mio] - tot()); if (v > 0) ui.rl[el.dataset.k] = (ui.rl[el.dataset.k] || 0) + v; return ctx.ridisegna(); }
      if (az === 'rlAzzera') { ui.rl = {}; return ctx.ridisegna(); }
      if (az === 'rlRipeti') { const u = ui.rlUltima || {}, somma = Object.values(u).reduce((a, b) => a + b, 0); if (somma <= p.fiche[ctx.mio]) ui.rl = { ...u }; return ctx.ridisegna(); }
      if (az === 'rlPunta') { const q = ui.rl; ui.rlUltima = { ...q }; ui.rl = {}; ctx.invia({ tipo: 'punta', puntate: q }); }
    },
  };
  Object.assign(window.Tavoli, { tris, forza4, battaglia, dama, scacchi, impiccato, morra, numero, blackjack, baccarat, higherlower: hl, texas, poker5, uno, campo, roulette });
})();
