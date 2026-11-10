// DUBITO (Liar's Bar): tavolo da bar, carte del Liar's Deck disegnate apposta, la pistola di ognuno con le 6 camere,
// carte che volano in mano a ogni round, carte che si girano al DUBITO e la Roulette Russa con il tamburo che gira.
(() => {
  const { esc, primaVolta, suono, ritardo } = window.Nuovi;
  let tConto = null;
  const SIMBOLO = {
    // picca per l'Asso, corona per il Re, tiara per la Regina, cappello da giullare per il Jolly (tutto SVG)
    A: '<svg viewBox="0 0 40 40"><path d="M20 4C14 13 5 17 5 25a7 7 0 0 0 12 4.5L15 36h10l-2-6.5A7 7 0 0 0 35 25C35 17 26 13 20 4z" fill="#1b1b1f"/></svg>',
    K: '<svg viewBox="0 0 40 40"><path d="M5 30L3 11l10 8 7-13 7 13 10-8-2 19z" fill="#d19a2a" stroke="#7a5510" stroke-width="1.5"/><rect x="5" y="30" width="30" height="5" rx="1.5" fill="#b8841f"/><circle cx="20" cy="22" r="2.6" fill="#c0392b"/><circle cx="12" cy="24" r="1.8" fill="#2f6fd8"/><circle cx="28" cy="24" r="1.8" fill="#2e9d57"/></svg>',
    Q: '<svg viewBox="0 0 40 40"><path d="M6 28c2-8 6-12 14-17 8 5 12 9 14 17z" fill="#c9cfd8" stroke="#6d7480" stroke-width="1.5"/><circle cx="20" cy="9" r="3.2" fill="#e07ab8"/><circle cx="12" cy="17" r="2" fill="#46c8e8"/><circle cx="28" cy="17" r="2" fill="#46c8e8"/><rect x="6" y="28" width="28" height="5" rx="2" fill="#9aa2ae"/></svg>',
    J: '<svg viewBox="0 0 40 40"><path d="M8 30C6 20 10 12 20 18 30 12 34 20 32 30z" fill="#8e55c9"/><path d="M20 18C18 10 12 6 5 8c4 3 5 8 5 13z" fill="#c0392b"/><path d="M20 18c2-8 8-12 15-10-4 3-5 8-5 13z" fill="#2e9d57"/><circle cx="5" cy="8" r="2.6" fill="#f2c230"/><circle cx="35" cy="8" r="2.6" fill="#f2c230"/><circle cx="20" cy="17" r="2.4" fill="#f2c230"/><rect x="7" y="29" width="26" height="5" rx="2" fill="#f2c230"/></svg>',
    // mazzo grande: berretto piumato per il Fante, poligoni con tanti lati quanto il numero (10, 9, 8, 7)
    F: '<svg viewBox="0 0 40 40"><path d="M7 27c0-9 6-15 14-15 6 0 11 4 12 10l-3 1c-1-4-5-7-9-7-6 0-10 5-10 11z" fill="#2f6fd8" stroke="#1c4590" stroke-width="1.3"/><path d="M22 12c3-6 9-9 15-8-4 2-7 5-9 9z" fill="#c0392b"/><path d="M26 11c2-3 5-5 8-5" stroke="#f2c230" stroke-width="1.2" fill="none"/><rect x="6" y="27" width="26" height="5" rx="2" fill="#d19a2a"/><circle cx="19" cy="21" r="2.2" fill="#f2c230"/></svg>',
    T: '<svg viewBox="0 0 40 40"><polygon points="20.0,5.0 28.8,7.9 34.3,15.4 34.3,24.6 28.8,32.1 20.0,35.0 11.2,32.1 5.7,24.6 5.7,15.4 11.2,7.9" fill="#2e9d57" stroke="#1d6b3a" stroke-width="1.6"/><text x="20" y="25.5" text-anchor="middle" font-size="14" font-weight="700" font-family="Georgia, serif" fill="#fff">10</text></svg>',
    9: '<svg viewBox="0 0 40 40"><polygon points="20.0,5.0 29.6,8.5 34.8,17.4 33.0,27.5 25.1,34.1 14.9,34.1 7.0,27.5 5.2,17.4 10.4,8.5" fill="#2f6fd8" stroke="#1c4590" stroke-width="1.6"/><text x="20" y="25.5" text-anchor="middle" font-size="16" font-weight="700" font-family="Georgia, serif" fill="#fff">9</text></svg>',
    8: '<svg viewBox="0 0 40 40"><polygon points="20.0,5.0 30.6,9.4 35.0,20.0 30.6,30.6 20.0,35.0 9.4,30.6 5.0,20.0 9.4,9.4" fill="#e07a1f" stroke="#9a4f0e" stroke-width="1.6"/><text x="20" y="25.5" text-anchor="middle" font-size="16" font-weight="700" font-family="Georgia, serif" fill="#fff">8</text></svg>',
    7: '<svg viewBox="0 0 40 40"><polygon points="20.0,5.0 31.7,10.6 34.6,23.3 26.5,33.5 13.5,33.5 5.4,23.3 8.3,10.6" fill="#c0392b" stroke="#7d231a" stroke-width="1.6"/><text x="20" y="25.5" text-anchor="middle" font-size="16" font-weight="700" font-family="Georgia, serif" fill="#fff">7</text></svg>',
  };
  const LETTERA = { A: 'A', K: 'K', Q: 'Q', F: 'F', T: '10', 9: '9', 8: '8', 7: '7', J: '★' };
  const NOME = { A: 'ASSO', K: 'RE', Q: 'REGINA', F: 'FANTE', T: 'DIECI', 9: 'NOVE', 8: 'OTTO', 7: 'SETTE', J: 'JOLLY' };
  const carta = (c, cls = '', attr = '') => `<div class="lb-carta ${c.t === 'J' ? 'jolly' : ''} ${cls}" data-id="${esc(c.id)}" ${attr}>
      <span class="lb-ang">${LETTERA[c.t]}</span><span class="lb-sim">${SIMBOLO[c.t]}</span><span class="lb-nome">${NOME[c.t]}</span><span class="lb-ang giu">${LETTERA[c.t]}</span></div>`;
  const retro = (cls = '', st = '') => `<div class="lb-carta retro ${cls}" style="${st}"><i></i></div>`;
  // la pistola: 6 camere, quelle già sparate grigie, il proiettile non si vede
  function tamburo(colpi, cls = '', st = '') {
    const camere = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${20 + Math.cos(a) * 11}" cy="${20 + Math.sin(a) * 11}" r="4.2" class="${k < colpi ? 'vuota' : 'piena'}"/>`; }).join('');
    return `<svg class="lb-tamburo ${cls}" style="${st}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" class="corpo"/>${camere}<circle cx="20" cy="20" r="3.5" class="perno"/></svg>`;
  }
  const pistola = `<svg class="lb-pistola" viewBox="0 0 120 70"><rect x="30" y="18" width="84" height="12" rx="3" fill="#5a5f6a"/><rect x="30" y="16" width="84" height="3" fill="#8a909c"/>
    <rect x="18" y="14" width="36" height="24" rx="5" fill="#6b717d"/><circle cx="36" cy="26" r="9" fill="#4b5059"/><path d="M20 36l-6 28h18l6-26z" fill="#6b3f22"/><path d="M34 38c4 8 10 10 16 8" stroke="#4b5059" stroke-width="4" fill="none"/><rect x="108" y="12" width="4" height="6" fill="#8a909c"/></svg>`;

  function contoRovescia(ctx) {
    clearInterval(tConto);
    const p = ctx.partita;
    if (!p.fineTurno || p.turno === null) return;
    const chiave = `lb-${p.round}-${p.fase}-${p.turno}-${p.tavolo}`;
    if (ctx.ui._lbChiave !== chiave) { ctx.ui._lbChiave = chiave; ctx.ui._lbFine = Date.now() + p.turnoMs - 150; }
    const aggiorna = () => {
      const x = document.querySelector('.lb-conto'); if (!x) return clearInterval(tConto);
      const resta = Math.max(0, ctx.ui._lbFine - Date.now());
      x.style.setProperty('--f', String(resta / p.turnoMs)); x.textContent = `${Math.ceil(resta / 1000)}`;
      x.classList.toggle('urgente', resta < 6000);
    };
    aggiorna(); tConto = setInterval(aggiorna, 200);
  }
  const chi = (ctx, i) => (i === ctx.mio ? 'Tu' : ctx.nome(i));
  // frasi con il verbo giusto: "Ada mentiva" ma "Tu mentivi"; dopo una preposizione "a te", non "a Tu"
  const sogg = (ctx, i, terza, seconda) => (i === ctx.mio ? `<b>Tu</b> ${seconda}` : `<b>${esc(ctx.nome(i))}</b> ${terza}`);
  const ate = (ctx, i) => (i === ctx.mio ? 'te' : esc(ctx.nome(i)));

  const tavolo = {
    libero: true,
    senzaFila: true,
    manoLarga: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      // i posti intorno al tavolo: nome (grigio se eliminato), carte coperte, pistola
      const posti = Array.from({ length: p.n }, (_, i) => {
        const vivo = p.vivi[i], turno = p.turno === i;
        const carte = vivo ? Array.from({ length: p.carteInMano[i] }, (_, k) => retro('mini', `--k:${k}`)).join('') : '';
        return `<div class="lb-posto ${vivo ? '' : 'morto'} ${turno ? 'turno' : ''} ${i === ctx.mio ? 'lb-mio' : ''}">
          <div class="lb-nomeposto">${vivo ? '' : '💀 '}${esc(chi(ctx, i))}</div>
          <div class="lb-mini">${carte || (vivo ? '<span class="piccolo">nessuna carta</span>' : '<span class="piccolo">eliminato</span>')}</div>
          <div class="lb-arma">${tamburo(p.colpi[i], 'piccolo')}<span>${vivo ? `${p.colpi[i]}/6` : ''}</span></div>
          <div class="bolla-posto" data-bolla="${i}"></div></div>`;
      }).join('');
      // la carta del tavolo
      const cartaTavolo = `<div class="lb-dichiarata" style="${ritardo(ui, `lb-dich-${p.round}`)}"><span class="piccolo">Round ${p.round} · carta del tavolo</span>${carta({ id: 'x', t: p.carta }, 'grande')}<b>${esc(p.nomi[p.carta])}</b></div>`;
      let centro = '';
      if (p.fase === 'roulette' || p.fase === 'sparo') {
        const r = p.roulette, s = p.svelate;
        const esito = p.fase === 'sparo' ? r.esito : null;
        centro = `<div class="lb-roulette ${esito || 'attesa'}" style="${ritardo(ui, `lb-rr-${p.round}-${esito || 'a'}`)}">
          ${s ? `<p class="piccolo">${s.mentiva ? sogg(ctx, s.accusato, 'mentiva', 'mentivi') : sogg(ctx, s.accusato, 'diceva la verità', 'dicevi la verità')}: Roulette Russa per <b>${ate(ctx, r.chi)}</b></p>` : ''}
          <div class="lb-arma-grande">${pistola}${tamburo(esito ? r.colpo : r.colpiPrima, `grande ${esito ? 'fermo' : 'gira'}`)}</div>
          ${esito === 'morto' ? `<p class="lb-bang">BANG!</p><p>${sogg(ctx, r.chi, 'è fuori dalla partita', 'sei fuori dalla partita')}</p>`
          : esito === 'salvo' ? `<p class="lb-click">click…</p><p>${sogg(ctx, r.chi, 'si salva', 'ti salvi')} (${r.colpo}/6 · la prossima volta 1 su ${6 - r.colpo})</p>`
          : `<p class="lb-prob">Probabilità che parta il colpo: <b>1 su ${6 - r.colpiPrima}</b></p>`}
        </div>${esito === 'morto' ? `<div class="lb-lampo" style="${ritardo(ui, `lb-lampo-${p.round}`)}"></div>` : ''}`;
      } else if (p.fase === 'svela' && p.svelate) {
        const s = p.svelate;
        centro = `<div class="lb-svela"><p>${sogg(ctx, s.dubitante, 'dice', 'dici')} DUBITO a <b>${ate(ctx, s.accusato)}</b>!</p>
          <div class="lb-girate">${s.carte.map((c, k) => `<div class="lb-gira" style="--k:${k};${ritardo(ui, `lb-sv-${p.round}-${s.dubitante}`)}">${retro()}${carta(c, c.t === s.carta || c.t === 'J' ? 'giusta' : 'bugia')}</div>`).join('')}</div>
          <p class="lb-verdetto ${s.mentiva ? 'bugia' : 'vero'}" style="${ritardo(ui, `lb-sv-${p.round}-${s.dubitante}`)}">${s.mentiva ? '🤥 Era una bugia!' : s.accusato === ctx.mio ? '😇 Dicevi la verità!' : '😇 Diceva la verità!'} La Roulette Russa tocca a <b>${ate(ctx, s.tira)}</b></p></div>`;
      } else {
        const pila = Array.from({ length: Math.min(p.tavolo, 15) }, (_, k) => retro('pila', `--k:${k};--r:${((k * 47) % 31) - 15}deg;--x:${((k * 29) % 21) - 10}px`)).join('');
        const u = p.ultima;
        const fumetto = u ? `<div class="lb-fumetto" style="${ritardo(ui, `lb-fu-${p.round}-${p.tavolo}`)}"><b>${esc(chi(ctx, u.posto))}</b>: "${esc(u.dichiarazione)}"${p.finale ? '<br><small>ultime carte!</small>' : ''}</div>` : '';
        centro = `<div class="lb-pila">${pila || '<span class="piccolo">Nessuna carta sul tavolo</span>'}</div>${fumetto}
          ${p.fase === 'finale' ? '<p class="lb-verdetto vero">Ci ha creduto: round finito, nessuno spara.</p>' : ''}`;
      }
      const tocca = p.turno !== null && !p.finita ? `<div class="lb-turno">${p.turno === ctx.mio ? (p.fase === 'roulette' ? 'Tocca a te premere il grilletto…' : 'Tocca a te') : `Tocca a ${esc(ctx.nome(p.turno))}`}<span class="lb-conto"></span></div>` : '';
      const grilletto = p.possoSparare ? '<button type="button" class="lb-grilletto" data-az="spara">🔫 Premi il grilletto</button>' : '';
      return `<div class="lb"><div class="lb-posti">${posti}</div>
        <div class="lb-tavolo">${cartaTavolo}<div class="lb-centro">${centro}</div></div>${tocca}${grilletto}</div>`;
    },
    mano(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      if (!p.vivi[ctx.mio]) return '<p class="piccolo">Sei stato eliminato: guarda come va a finire 💀</p>';
      const posso = p.possoGiocare;
      const ids = new Set(p.mano.map((c) => c.id));
      ui.sel = (ui.sel || []).filter((id) => ids.has(id));
      if (!posso) ui.sel = [];
      const st = ritardo(ui, `lb-dai-${p.round}`);
      return `<div class="lb-mano ${p.mano.length > 7 ? 'tante' : ''}">${p.mano.map((c, k) => carta(c, `vola ${posso ? 'giocabile' : ''} ${ui.sel.includes(c.id) ? 'alzata' : ''}`,
        `style="--k:${k};${st}" ${posso ? `data-az="sel" role="button" tabindex="0" aria-pressed="${ui.sel.includes(c.id)}"` : ''}`)).join('')}</div>`;
    },
    azioni(ctx) {
      const p = ctx.partita, ui = ctx.ui, out = [];
      if (p.possoDubitare) out.push(`<button type="button" class="lb-dubito" data-az="dubito">DUBITO!</button>`);
      if (p.possoAccettare) out.push('<button type="button" class="bottone" data-az="accetto">Ci credo</button>');
      if (p.possoGiocare) {
        const n = (ui.sel || []).length;
        out.push(`<span class="suggerimento">Scegli da 1 a 3 carte: dirai che sono tutte ${esc(p.plurali[p.carta])}</span>
          <button type="button" class="bottone primario" data-az="gioca" ${n >= 1 && n <= 3 ? '' : 'disabled'}>${n ? `"Sto giocando ${n === 1 && p.carta === 'Q' ? 'una' : ['', 'un', 'due', 'tre'][n]} ${esc(n === 1 ? p.nomi[p.carta] : p.plurali[p.carta])}"` : 'Metti giù le carte'}</button>`);
      }
      return out.join('');
    },
    dopo(ctx) {
      contoRovescia(ctx);
      const p = ctx.partita, ui = ctx.ui;
      if (primaVolta(ui, `lb-s-dai-${p.round}`)) suono([[520, 0.03], [620, 0.03], [720, 0.03], [820, 0.03], [920, 0.04]], { volume: 0.04 });
      if (p.fase === 'svela' && primaVolta(ui, `lb-s-sv-${p.round}`)) suono(p.svelate.mentiva ? [[330, 0.1], [220, 0.25]] : [[523, 0.08], [784, 0.16]], { volume: 0.08 });
      if (p.fase === 'roulette' && primaVolta(ui, `lb-s-rr-${p.round}`)) suono([[180, 0.04], [0, 0.05], [180, 0.04], [0, 0.05], [180, 0.04], [0, 0.05], [180, 0.04]], { tipo: 'square', volume: 0.05 });
      if (p.fase === 'sparo' && primaVolta(ui, `lb-s-sp-${p.round}`)) {
        if (p.roulette.esito === 'morto') suono([[90, 0.08], [60, 0.35], [40, 0.4]], { tipo: 'sawtooth', volume: 0.18 });
        else suono([[1200, 0.02], [0, 0.05], [800, 0.03]], { tipo: 'square', volume: 0.06 });
      }
    },
    statoAttesa: (ctx) => { const p = ctx.partita; return p.fase === 'svela' ? (p.svelate && p.svelate.mentiva ? 'Bugia scoperta!' : 'Diceva la verità!') : p.fase === 'sparo' ? (p.roulette && p.roulette.esito === 'morto' ? 'BANG!' : 'Click… salvo') : 'Nuovo round…'; },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.fase === 'roulette') return p.turno === ctx.mio ? 'Roulette Russa: tocca a te' : `Roulette Russa: ${ctx.nome(p.turno)}`;
      if (p.turno === ctx.mio) return p.possoAccettare ? 'Ultime carte: ci credi?' : p.possoDubitare ? `Dubiti o giochi? (${p.nomi[p.carta]})` : `Tocca a te: ${p.nomi[p.carta]}`;
      return p.turno === null ? '…' : `Tocca a ${ctx.nome(p.turno)}`;
    },
    punteggio(ctx) { const p = ctx.partita; return p.vivi.map((v, i) => `<span class="${v ? '' : 'lb-grigio'}">${esc(chi(ctx, i))} <b>${v ? `🔫 ${p.colpi[i]}/6` : '💀'}</b></span>`).join('') + '<span class="obiettivo">vince l\'ultimo rimasto</span>'; },
    infoPosto(ctx, posto) { const p = ctx.partita; return p.vivi[posto] ? `${p.carteInMano[posto]} carte · 🔫 ${p.colpi[posto]}/6` : '💀 eliminato'; },
    clic(ctx, el) {
      const ui = ctx.ui, az = el.dataset.az;
      if (az === 'sel') {
        const id = el.dataset.id;
        ui.sel = ui.sel.includes(id) ? ui.sel.filter((x) => x !== id) : ui.sel.length < 3 ? [...ui.sel, id] : ui.sel;
        return ctx.ridisegna();
      }
      if (az === 'gioca') { const carte = ui.sel; ui.sel = []; return ctx.invia({ tipo: 'gioca', carte }); }
      if (az === 'dubito' || az === 'accetto' || az === 'spara') return ctx.invia({ tipo: az });
    },
  };
  Object.assign(window.Tavoli, { dubito: tavolo });
})();
