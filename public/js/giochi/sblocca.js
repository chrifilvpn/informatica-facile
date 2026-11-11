// SBLOCCA IL BLOCCO (Unblock Me): griglia di legno 6×6 con i blocchi da trascinare (mouse o dito) lungo il loro verso.
// La griglia è un elemento che resta vivo tra un aggiornamento e l'altro (come il canvas dei giochi d'azione), così un
// trascinamento non si interrompe quando arrivano le mosse degli altri giocatori.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const L = 6;
  let tav = null, chiave = null, stato = null, ctxS = null, trascina = null;
  const celle = (b) => Array.from({ length: b.l }, (_, k) => (b.o === 'h' ? [b.r, b.c + k] : [b.r + k, b.c]));
  function griglia(bl) { const g = Array.from({ length: L }, () => new Array(L).fill(-1)); bl.forEach((b, i) => celle(b).forEach(([r, c]) => { g[r][c] = i; })); return g; }
  // quanto può scorrere il blocco i: da -indietro a +avanti caselle
  function corsa(bl, i) {
    const g = griglia(bl), b = bl[i]; let meno = 0, piu = 0;
    for (let s = 1; s < L; s++) { const r = b.o === 'v' ? b.r - s : b.r, c = b.o === 'h' ? b.c - s : b.c; if (r < 0 || c < 0 || g[r][c] !== -1) break; meno = s; }
    for (let s = 1; s < L; s++) { const r = b.o === 'v' ? b.r + b.l - 1 + s : b.r, c = b.o === 'h' ? b.c + b.l - 1 + s : b.c; if (r >= L || c >= L || g[r][c] !== -1) break; piu = s; }
    return [-meno, piu];
  }
  function crea() {
    tav = document.createElement('div'); tav.className = 'sbl-tavola';
    tav.innerHTML = `<div class="sbl-fondo">${'<i></i>'.repeat(L * L)}</div><div class="sbl-uscita" style="--r:2">➜</div><div class="sbl-blocchi"></div>`;
    tav.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.sbl-blocco'); if (!el || !stato || !puoi()) return;
      e.preventDefault();
      const i = Number(el.dataset.i), b = stato.blocchi[i], [meno, piu] = corsa(stato.blocchi, i);
      const lato = tav.querySelector('.sbl-blocchi').getBoundingClientRect().width / L;
      trascina = { i, el, b, x0: e.clientX, y0: e.clientY, meno, piu, lato, spost: 0 };
      el.classList.add('preso');
    });
    document.addEventListener('pointermove', (e) => {
      if (!trascina) return;
      const t = trascina, d = t.b.o === 'h' ? e.clientX - t.x0 : e.clientY - t.y0;
      t.spost = Math.max(t.meno * t.lato, Math.min(t.piu * t.lato, d));
      t.el.style.transform = t.b.o === 'h' ? `translateX(${t.spost}px)` : `translateY(${t.spost}px)`;
    });
    const lascia = () => {
      if (!trascina) return;
      const t = trascina; trascina = null;
      const passi = Math.round(t.spost / t.lato);
      t.el.classList.remove('preso'); t.el.style.transform = '';
      if (!passi || !puoi()) return;
      const r = t.b.o === 'v' ? t.b.r + passi : t.b.r, c = t.b.o === 'h' ? t.b.c + passi : t.b.c;
      stato.blocchi = stato.blocchi.map((x, j) => (j === t.i ? { ...x, r, c } : x)); // si sposta subito, il server conferma
      stato.mosse++;
      disponi();
      suono([[260 + passi * 20, 0.04]], { tipo: 'triangle', volume: 0.05 });
      ctxS.invia({ tipo: 'muovi', b: t.i, r, c });
    };
    document.addEventListener('pointerup', lascia); document.addEventListener('pointercancel', lascia);
  }
  const puoi = () => stato && !stato.fatto && !stato.finita && !stato.inAttesa;
  function disponi() {
    const box = tav.querySelector('.sbl-blocchi');
    const k = `${stato.round}`;
    if (chiave !== k) { chiave = k; box.innerHTML = stato.blocchi.map((b, i) => `<div class="sbl-blocco ${i === 0 ? 'rosso' : b.o} l${b.l}" data-i="${i}"><span></span></div>`).join(''); }
    stato.blocchi.forEach((b, i) => {
      const el = box.querySelectorAll('.sbl-blocco')[i]; if (!el || (trascina && trascina.i === i)) return;
      el.style.left = `${(b.c / L) * 100}%`; el.style.top = `${(b.r / L) * 100}%`;
      el.style.width = `${((b.o === 'h' ? b.l : 1) / L) * 100}%`; el.style.height = `${((b.o === 'v' ? b.l : 1) / L) * 100}%`;
    });
    tav.classList.toggle('risolto', !!stato.fatto);
    // l'aiuto: il blocco da spostare lampeggia e un'ombra tratteggiata mostra dove va
    box.querySelectorAll('.sbl-blocco').forEach((el, i) => el.classList.toggle('aiuto', !!(stato.aiuto && stato.aiuto.b === i)));
    let ombra = tav.querySelector('.sbl-ombra');
    const a = stato.aiuto, ba = a && stato.blocchi[a.b];
    if (ba && !stato.fatto) {
      if (!ombra) { ombra = document.createElement('div'); ombra.className = 'sbl-ombra'; box.append(ombra); }
      ombra.style.left = `${(a.c / L) * 100}%`; ombra.style.top = `${(a.r / L) * 100}%`;
      ombra.style.width = `${((ba.o === 'h' ? ba.l : 1) / L) * 100}%`; ombra.style.height = `${((ba.o === 'v' ? ba.l : 1) / L) * 100}%`;
    } else if (ombra) ombra.remove();
  }
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const altri = p.n > 1 ? `<div class="sbl-altri">${p.altri.map((x, i) => `<span class="${x.fatto !== null ? 'fatto' : ''}"><b>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))}</b> ${x.fatto !== null ? `✅ ${p.arrivi.indexOf(i) + 1}° · ${x.mosse} mosse` : `${x.mosse} mosse…`}</span>`).join('')}</div>` : '';
      const stelle = p.fatto !== null ? `<p class="sbl-stelle">${'⭐'.repeat(p.stelle)}${'☆'.repeat(3 - p.stelle)}</p>` : '';
      const msg = p.fatto !== null ? `Libero in ${p.mosse} mosse (minimo ${p.minimo})${p.n > 1 && p.attesi !== 0 ? ': aspetta gli altri' : ''}` : `<span class="sbl-guida">Trascina i blocchi e libera quello rosso · </span>mosse: <b>${p.mosse}</b> · minimo possibile: ${p.minimo}`;
      return `<div class="sbl"><p class="pa-round">Puzzle ${p.round} di ${p.nRound} · ${{ facile: 'facile', medio: 'medio', difficile: 'difficile' }[p.livello]}</p>
        <div class="sbl-posto"></div>${stelle}<p class="pa-msg">${msg}</p>${altri}</div>`;
    },
    azioni(ctx) {
      const p = ctx.partita;
      if (p.fatto !== null || p.finita || p.inAttesa) return '';
      return `<div class="sbl-comandi"><button type="button" class="bottone" data-az="annulla" ${p.puoAnnullare ? '' : 'disabled'}>↶ Annulla</button>
        <button type="button" class="bottone" data-az="aiuto" ${p.aiuto ? 'disabled' : ''} title="Mostra la prossima mossa giusta (costa 2 mosse)">💡 Aiuto <small>+2</small></button>
        <button type="button" class="bottone" data-az="ricomincia">↺ Ricomincia</button></div>`;
    },
    dopo(ctx) {
      ctxS = ctx;
      if (!tav) crea();
      const p = ctx.partita;
      // lo stato della mia griglia: quello del server, tranne mentre trascino
      if (!trascina) stato = { ...p, blocchi: p.blocchi.map((b) => ({ ...b })) };
      else stato = { ...p, blocchi: stato.blocchi };
      const posto = document.querySelector('.sbl-posto');
      if (posto && tav.parentElement !== posto) posto.append(tav);
      disponi();
      if (p.fatto !== null && primaVolta(ctx.ui, `sbl-f-${p.round}`)) suono([[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.25]], { volume: 0.08 });
    },
    statoAttesa: () => 'Prossimo puzzle…',
    stato(ctx) { const p = ctx.partita; if (p.finita) return null; return p.fatto !== null ? 'Risolto! ✅' : 'Libera il blocco rosso'; },
    punteggio(ctx) { const p = ctx.partita; return p.punti.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + `<span class="obiettivo">${p.n === 1 ? 'stelle' : 'punti'}</span>`; },
    infoPosto(ctx, posto) { const x = ctx.partita.altri[posto]; return x.fatto !== null ? `✅ ${x.mosse} mosse` : `${x.mosse} mosse`; },
    clic(ctx, el) { if (['ricomincia', 'annulla', 'aiuto'].includes(el.dataset.az)) ctx.invia({ tipo: el.dataset.az }); },
  };
  Object.assign(window.Tavoli, { sblocca: tavolo });
})();
