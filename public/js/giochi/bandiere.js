// INDOVINA LA BANDIERA: il tavolo nel browser. La bandiera arriva dal server già disegnata (SVG), senza il nome.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  let ctxB = null;

  // lo stesso tavolo serve anche agli altri quiz con lo stesso motore (capitali, sagome dei paesi, monumenti)
  const QUIZ = ['bandiere', 'capitali', 'sagome', 'monumenti'];
  const puoRispondere = (p) => p && QUIZ.includes(p.gioco) && !p.finita && !p.inAttesa && !p.mia;
  const figura = (b, cls = '') => (b ? `<svg class="${b.sagoma ? 'bd-sagoma' : ''} ${cls}" viewBox="0 0 ${b.w} ${b.h || 200}" role="img" aria-label="${b.sagoma ? 'Sagoma da indovinare' : 'Bandiera'}">${b.svg}</svg>` : '');

  // monumenti: il disegno fatto apposta (viewBox 200×160), arriva dal server già pronto
  const disegno = (svg) => `<svg viewBox="0 0 200 160">${svg}</svg>`;

  function bottoni(ctx) {
    const p = ctx.partita;
    const svela = p.giusta !== null && p.giusta !== undefined;
    return p.opzioni.map((nome, i) => {
      const cls = ['bd-scelta'];
      if (p.mia && p.mia.scelta === i) cls.push('mia');
      if (svela && i === p.giusta) cls.push('giusta');
      else if (svela && p.mia && p.mia.scelta === i) cls.push('sbagliata');
      // chi ha scelto cosa (solo dopo, in sfida)
      const chi = svela && p.n > 1 ? p.altri.map((a, k) => (a.scelta === i && k !== ctx.mio ? `<i title="${esc(ctx.nome(k))}">${esc(ctx.nome(k).slice(0, 1).toUpperCase())}</i>` : '')).join('') : '';
      return `<button type="button" class="${cls.join(' ')}" data-az="risposta" data-i="${i}" ${puoRispondere(p) ? '' : 'disabled'}><kbd>${i + 1}</kbd><span>${esc(nome)}</span>${chi ? `<b class="bd-chi">${chi}</b>` : ''}</button>`;
    }).join('');
  }

  function messaggio(ctx) {
    const p = ctx.partita;
    if (p.inAttesa || p.finita) {
      if (!p.mia || p.mia.scelta < 0) return '<p class="bd-msg no">⏰ Tempo scaduto!</p>';
      return p.mia.giusto ? `<p class="bd-msg si">✅ Giusto!${p.n > 1 ? ` +${p.mia.punti} punti` : ''}${p.serie > 1 ? ` · ${p.serie} di fila 🔥` : ''}</p>` : '<p class="bd-msg no">❌ Sbagliato</p>';
    }
    if (p.mia) return `<p class="bd-msg">Risposta data: ${p.n > 1 ? 'aspetta gli altri…' : 'vediamo…'}</p>`;
    return '';
  }

  // a partita finita: le bandiere sbagliate da ripassare
  function ripasso(p) {
    if (!p.finita || !p.ripasso) return '';
    if (!p.ripasso.length) return '<p class="bd-msg si">🏆 Nessun errore: tutte giuste!</p>';
    return `<section class="bd-ripasso" aria-label="Da ripassare"><h3>📚 Da ripassare (${p.ripasso.length})</h3><div class="bd-rip-elenco">${p.ripasso.map((x) => `
      <figure>${x.svg ? figura({ svg: x.svg, w: x.w, h: x.h, sagoma: x.sagoma }) : x.disegno ? `<span class="bd-rip-icona">${disegno(x.disegno)}</span>` : `<span class="bd-rip-icona">${esc(x.icona || '❓')}</span>`}<figcaption>${x.domanda ? `<small>${esc(x.domanda)}</small>` : ''}<b>${esc(x.nome)}</b>${x.detto ? `<small>avevi detto ${esc(x.detto)}</small>` : '<small>tempo scaduto</small>'}</figcaption></figure>`).join('')}</div></section>`;
  }

  const tavolo = {
    libero: true,
    reset(ctx) { ctxB = ctx; },
    panno(ctx) {
      const p = ctx.partita;
      const frazione = p.tempo ? p.resta / p.tempo : 0;
      const tempo = `<div class="bd-tempo" aria-hidden="true"><i style="--da:${frazione.toFixed(3)};--d:${p.resta}ms" class="${p.resta < 3500 ? 'poco' : ''}"></i></div>`;
      return `<div class="bd">
        <p class="pa-round">${esc(p.cosa || 'Bandiera')} ${p.domanda} di ${p.nDomande}${p.migliore > 1 ? ` · serie migliore: ${p.migliore}` : ''}</p>
        ${tempo}
        ${p.bandiera ? `<div class="bd-bandiera ${p.bandiera.sagoma ? 'sagoma' : ''}">${figura(p.bandiera)}</div>` : p.disegno ? `<div class="bd-icona bd-disegno" aria-hidden="true">${disegno(p.disegno)}</div>` : `<div class="bd-icona" aria-hidden="true">${esc(p.icona || '❓')}</div>`}
        <p class="bd-domanda">${esc(p.testo || 'Di che paese è questa bandiera?')}</p>
        ${p.indizio ? `<p class="bd-indizio">${esc(p.indizio)}</p>` : ''}
        ${messaggio(ctx)}
        <div class="bd-scelte">${bottoni(ctx)}</div>
        ${ripasso(p)}
      </div>`;
    },
    dopo(ctx) {
      ctxB = ctx;
      const p = ctx.partita;
      if ((p.inAttesa || p.finita) && p.mia && primaVolta(ctx.ui, `bd-${p.domanda}`)) {
        if (p.mia.giusto) suono([[660, 0.07], [880, 0.12]], { volume: 0.07 });
        else suono([[220, 0.12], [180, 0.18]], { tipo: 'sawtooth', volume: 0.04 });
      }
    },
    statoAttesa: (ctx) => (ctx.partita.domanda >= ctx.partita.nDomande ? 'Ultima domanda!' : 'Prossima domanda…'),
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      return p.mia ? 'Risposta data' : 'Scegli la risposta giusta';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      if (p.n === 1) return `<span>Giuste <b>${p.giuste[0]}</b><small>/${p.nDomande}</small></span>`;
      return p.punti.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + '<span class="obiettivo">punti</span>';
    },
    infoPosto(ctx, posto) {
      const a = ctx.partita.altri[posto];
      if (a.giusto === true) return '✅';
      if (a.giusto === false) return '❌';
      return a.risposto ? 'ha risposto' : '…';
    },
    clic(ctx, el) {
      if (el.dataset.az !== 'risposta' || !puoRispondere(ctx.partita)) return;
      ctx.invia({ tipo: 'risposta', scelta: Number(el.dataset.i) });
    },
  };

  // tasti 1-4 per rispondere
  document.addEventListener('keydown', (e) => {
    const ctx = ctxB;
    if (!ctx || !ctx.stato || !ctx.partita || !QUIZ.includes(ctx.partita.gioco)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    if (window.Boss && Boss.attivo) return;
    const n = Number(e.key);
    if (n >= 1 && n <= ctx.partita.opzioni.length && puoRispondere(ctx.partita)) ctx.invia({ tipo: 'risposta', scelta: n - 1 });
  });

  Object.assign(window.Tavoli, { bandiere: tavolo, capitali: tavolo, sagome: tavolo, monumenti: tavolo });
})();
