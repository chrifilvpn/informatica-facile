// LUPUS IN FABULA: il tavolo nel browser. Il cielo cambia con la fase (notte stellata con la luna, alba, giorno),
// in alto la fase con il tempo che resta, poi il narratore (le ultime frasi grandi, il racconto intero a scomparsa e
// la voce narrante), la carta del ruolo da girare, il riquadro "cosa devi fare", il villaggio (una tessera per
// abitante: chi è vivo, i voti, chi è pronto, le carte che conosci) e il taccuino segreto (Veggente, Guardia…).
// Pensato prima di tutto per il telefono: ognuno guarda la sua carta sul suo schermo.
(() => {
  const { esc, ritardo, suono } = window.Nuovi;
  const RUOLI = {
    lupo: ['🐺', 'Lupo mannaro', 'Di notte scegli con il branco chi sbranare. Di giorno fingi di essere un innocente.'],
    veggente: ['🔮', 'Veggente', 'Ogni notte scegli una persona e scopri se è un lupo mannaro.'],
    guardia: ['🛡️', 'Guardia', 'Ogni notte proteggi una persona dai lupi (non te stessa, non la stessa due notti di fila).'],
    medium: ['🕯️', 'Medium', 'Ogni notte scopri se il condannato del giorno era un lupo.'],
    cacciatore: ['🏹', 'Cacciatore', 'Quando muori spari un ultimo colpo: porti con te chi vuoi.'],
    indemoniato: ['😈', 'Indemoniato', 'Sei umano ma tifi per i lupi: vinci se vincono loro. Non sai chi sono.'],
    contadino: ['🌾', 'Contadino', 'Niente poteri: ascolta, ragiona e smaschera i lupi col tuo voto.'],
  };
  const notturna = (f) => f === 'ruoli' || f === 'notte';
  let ctxL = null;

  const nomeCorto = (ctx, i) => (i === ctx.mio && !ctx.stato.spettatore ? 'Tu' : ctx.nome(i));
  const conNomi = (ctx, t) => esc(t).replace(/@(\d+)/g, (_m, k) => `<b>${esc(ctx.nome(Number(k)))}</b>`);
  const soloTesto = (ctx, t) => String(t).replace(/@(\d+)/g, (_m, k) => ctx.nome(Number(k)));
  const vivo = (ctx) => !ctx.stato.spettatore && ctx.partita.vivi[ctx.mio];
  const attivo = (ctx) => !ctx.partita.finita && !ctx.partita.inAttesa && vivo(ctx);

  // ---------- il tempo che resta (la fine si calcola una volta per ogni stato arrivato dal server) ----------
  const fini = new WeakMap();
  function fineDi(p) {
    if (p.resta == null) return null;
    if (!fini.has(p)) fini.set(p, Date.now() + p.resta);
    return fini.get(p);
  }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  setInterval(() => {
    for (const el of document.querySelectorAll('[data-lp-fine]')) {
      const resta = Number(el.dataset.lpFine) - Date.now();
      el.textContent = mmss(resta);
      el.classList.toggle('lp-poco', resta < 10500);
    }
  }, 500);

  // ---------- la voce narrante (voce neurale del sito, riserva: la voce del browser) ----------
  let voglia = true;
  try { voglia = localStorage.getItem('if:lpVoce') !== 'no'; } catch (e) { /* niente */ }
  const coda = [];
  let parlando = false, audioEl = null;
  function puoParlare() {
    const b = document.getElementById('suono');
    return voglia && !(window.Boss && window.Boss.attivo) && !(b && b.getAttribute('aria-pressed') === 'false') && !!document.querySelector('#panno .lp');
  }
  function zitto() {
    coda.length = 0;
    if (audioEl) { try { audioEl.pause(); } catch (e) { /* niente */ } audioEl = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    parlando = false;
  }
  function parlaBrowser(t, poi) {
    const sy = window.speechSynthesis;
    if (!sy) return poi();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'it-IT'; u.rate = 0.98; u.pitch = 0.9;
    const v = (sy.getVoices() || []).find((x) => /^it/i.test(x.lang));
    if (v) u.voice = v;
    u.onend = poi; u.onerror = poi;
    sy.speak(u);
  }
  function prossima() {
    if (!coda.length || !puoParlare()) { parlando = false; if (!puoParlare()) coda.length = 0; return; }
    parlando = true;
    const t = coda.shift();
    const poi = () => { audioEl = null; setTimeout(prossima, 250); };
    try {
      const a = new Audio(`/voce?v=diego&t=${encodeURIComponent(t.slice(0, 590))}`);
      audioEl = a;
      a.onended = poi;
      a.onerror = () => { audioEl = null; parlaBrowser(t, poi); };
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => { audioEl = null; parlaBrowser(t, poi); });
    } catch (e) { parlaBrowser(t, poi); }
  }
  function leggi(testi) {
    if (!testi.length || !puoParlare()) return;
    coda.push(...testi.map((t) => t.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    if (!parlando) prossima();
  }

  // ---------- suoni ----------
  function suonoFase(f) {
    if (f === 'notte') suono([[294, 0.35], [392, 0.55], [466, 0.9], [440, 0.7], [392, 1.1]], { tipo: 'sine', volume: 0.06 }); // l'ululato
    else if (f === 'alba') suono([[523, 0.12], [659, 0.12], [784, 0.3]], { tipo: 'triangle', volume: 0.07 });
    else if (f === 'voto') suono([[440, 0.1], [440, 0.1], [587, 0.25]], { tipo: 'square', volume: 0.04 });
    else if (f === 'condanna' || f === 'sparo') suono([[196, 0.3], [147, 0.6]], { tipo: 'sawtooth', volume: 0.05 });
    else if (f === 'finale') suono([[392, 0.15], [523, 0.15], [659, 0.15], [784, 0.5]], { tipo: 'triangle', volume: 0.07 });
  }

  // ---------- le parti del tavolo ----------
  function titoloFase(p) {
    if (p.finita || p.fase === 'finale') return ['🏁', 'Fine della partita'];
    switch (p.fase) {
      case 'ruoli': return ['🃏', 'Guardate la vostra carta'];
      case 'notte': return ['🌙', `Notte ${p.notteN}`];
      case 'alba': return ['🌅', `Alba del giorno ${p.notteN}`];
      case 'giorno': return ['☀️', `Giorno ${p.notteN} · discussione`];
      case 'voto': return ['🗳️', p.ballottaggio ? `Giorno ${p.notteN} · ballottaggio` : `Giorno ${p.notteN} · si vota`];
      case 'condanna': return ['🔥', 'Il verdetto'];
      case 'cacciatore': return ['🏹', 'Il Cacciatore prende la mira'];
      case 'sparo': return ['💥', 'Il colpo del Cacciatore'];
      default: return ['🌾', 'Borgo Nebbioso'];
    }
  }

  function testa(ctx) {
    const p = ctx.partita;
    const [ic, tit] = titoloFase(p);
    const fine = fineDi(p);
    const tempo = fine ? `<span class="lp-orologio" data-lp-fine="${fine}">${mmss(fine - Date.now())}</span>` : '';
    const barra = fine && p.durata ? `<div class="lp-barra"><i style="animation-duration:${p.durata}ms;animation-delay:-${Math.max(0, p.durata - (fine - Date.now()))}ms"></i></div>` : '';
    return `<header class="lp-testa"><div class="lp-fase"><span class="lp-icona" aria-hidden="true">${ic}</span><b>${esc(tit)}</b>${tempo}</div>${barra}</header>`;
  }

  function narratore(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    const r = p.racconto || [];
    // le frasi grandi: quelle dell'ultimo blocco (stessa notte/giorno, ultime 3)
    const recenti = r.slice(-3);
    const grandi = recenti.map((x) => `<p class="lp-frase lp-t-${x.tipo}" style="${ritardo(ui, `lp-r${x.id}`)}">${conNomi(ctx, x.testo)}</p>`).join('');
    const tutto = ui.lpTutto ? `<ol class="lp-storia">${r.map((x) => `<li class="lp-t-${x.tipo}">${conNomi(ctx, x.testo)}</li>`).join('')}</ol>` : '';
    return `<section class="lp-narratore" aria-live="polite"><div class="lp-gufo" aria-hidden="true">🦉</div>
      <button type="button" class="lp-voce ${voglia ? 'on' : ''}" data-az="voce" aria-pressed="${voglia}" title="${voglia ? 'Spegni' : 'Accendi'} la voce del narratore">${voglia ? '🗣️' : '🔇'}<span>voce</span></button><div class="lp-frasi">${grandi || ''}</div>
      ${r.length > 3 ? `<button type="button" class="lp-link" data-az="tutto" aria-expanded="${!!ui.lpTutto}">${ui.lpTutto ? 'Nascondi il racconto' : 'Tutto il racconto'}</button>` : ''}${tutto}</section>`;
  }

  function carta(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    if (ctx.stato.spettatore || !p.mioRuolo) return '';
    const [ic, nome, desc] = RUOLI[p.mioRuolo] || RUOLI.contadino;
    const aperta = p.fase === 'ruoli' ? ui.lpCarta !== false : !!ui.lpCarta;
    const branco = p.mioRuolo === 'lupo' ? p.ruoli.map((r, i) => (r === 'lupo' && i !== ctx.mio ? ctx.nome(i) : null)).filter(Boolean) : [];
    return `<button type="button" class="lp-carta ${aperta ? 'aperta' : ''} ${p.mioRuolo === 'lupo' || p.mioRuolo === 'indemoniato' ? 'lp-rossa' : ''}" data-az="carta" aria-pressed="${aperta}">
      <span class="lp-dorso"><span class="lp-luna" aria-hidden="true">🌕</span><span><b>La tua carta</b><small>tocca per guardarla (di nascosto!)</small></span></span>
      <span class="lp-fronte"><span class="lp-grande" aria-hidden="true">${ic}</span><span><b>${esc(nome)}</b><small>${esc(desc)}</small>
      ${branco.length ? `<small class="lp-branco">Il tuo branco: ${esc(branco.join(', '))}</small>` : ''}<small class="lp-nascondi">tocca per nasconderla</small></span></span></button>`;
  }

  // cosa devo fare adesso
  function compito(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    if (p.finita || p.fase === 'finale') return finale(ctx);
    if (ctx.stato.spettatore) return '<div class="lp-compito"><p>Stai guardando la partita.</p></div>';
    if (p.fantasma) return '<div class="lp-compito lp-morto"><p>💀 <b>Sei un fantasma.</b> Vedi tutte le carte; quello che scrivi in chat lo leggono solo gli altri fantasmi.</p></div>';
    const r = p.mioRuolo;
    switch (p.fase) {
      case 'ruoli': return '<div class="lp-compito"><p>Guarda la tua carta e tienila segreta. Tra poco cala la notte…</p></div>';
      case 'notte': {
        if (!p.devoAgire) return `<div class="lp-compito lp-dormi"><p><span class="lp-zz" aria-hidden="true">💤</span> Dormi… ${r === 'lupo' && p.primaTranquilla ? 'Stanotte il branco si riconosce soltanto: guarda chi sono gli altri lupi.' : 'Chiudi gli occhi e aspetta l\'alba.'}</p></div>`;
        if (r === 'lupo') {
          const scelte = p.sceltaLupi || {};
          const altri = Object.entries(scelte).filter(([l, v]) => Number(l) !== ctx.mio && v != null).map(([l, v]) => `${esc(ctx.nome(Number(l)))} → ${esc(ctx.nome(v))}`);
          return `<div class="lp-compito lp-caccia"><p>🐺 <b>Scegli chi sbranare</b> toccando una tessera. ${p.miaScelta != null ? `Hai scelto <b>${esc(ctx.nome(p.miaScelta))}</b> (puoi cambiare finché non hanno scelto tutti).` : ''}</p>
            ${altri.length ? `<p class="lp-piccolo">Il branco: ${altri.join(' · ')}</p>` : ''}<p class="lp-piccolo">In chat, stanotte, ti leggono solo gli altri lupi.</p></div>`;
        }
        if (p.fatto) return `<div class="lp-compito"><p>${r === 'veggente' ? '🔮 Hai interrogato le carte: guarda il taccuino qui sotto.' : '🛡️ Stanotte veglierai su <b>' + esc(ctx.nome(p.miaScelta)) + '</b>.'} Ora dormi fino all'alba.</p></div>`;
        const sel = ui.lpScelta;
        const verbo = r === 'veggente' ? 'Scruta' : 'Proteggi';
        return `<div class="lp-compito"><p>${r === 'veggente' ? '🔮 <b>Chi vuoi scrutare?</b> Scoprirai se è un lupo.' : `🛡️ <b>Chi vuoi proteggere stanotte?</b>${p.protettoIeri != null ? ` (non ${esc(ctx.nome(p.protettoIeri))}, l'hai protetto ieri)` : ''}`}</p>
          <button type="button" class="bottone primario-bt lp-conferma" data-az="conferma" ${sel == null ? 'disabled' : ''}>${sel == null ? 'Tocca una tessera' : `${verbo} ${esc(ctx.nome(sel))}`}</button></div>`;
      }
      case 'alba': return '<div class="lp-compito"><p>Il villaggio si sveglia…</p></div>';
      case 'giorno': {
        const pronto = p.pronti && p.pronti[ctx.mio];
        const quanti = p.pronti ? p.pronti.filter((x, i) => x && p.vivi[i]).length : 0;
        const vivi = p.vivi.filter(Boolean).length;
        return `<div class="lp-compito"><p>☀️ <b>Discutete in chat</b>: chi sono i lupi? Accusate, difendetevi, fate domande.</p>
          <button type="button" class="bottone ${pronto ? '' : 'primario-bt'} lp-conferma" data-az="pronto">${pronto ? '✓ Pronto (tocca per aspettare)' : '🗳️ Pronti al voto'}</button><p class="lp-piccolo">${quanti} su ${vivi} pronti: quando lo sono tutti si vota subito.</p></div>`;
      }
      case 'voto': {
        const mio = p.voti ? p.voti[ctx.mio] : -2;
        return `<div class="lp-compito lp-votazione"><p>🗳️ <b>${p.ballottaggio ? 'Ballottaggio: scegli tra i più votati' : 'Chi mandiamo al rogo?'}</b> Tocca una tessera: il voto è palese e puoi cambiarlo finché non hanno votato tutti.</p>
          <p>${mio >= 0 ? `Il tuo voto: <b>${esc(ctx.nome(mio))}</b>` : mio === -1 ? 'Ti sei astenuto' : 'Non hai ancora votato'} · <button type="button" class="lp-link" data-az="astieniti">mi astengo</button></p></div>`;
      }
      case 'condanna': return '<div class="lp-compito"><p>Il villaggio ha deciso…</p></div>';
      case 'cacciatore': {
        if (p.cacciaDa !== ctx.mio) return `<div class="lp-compito"><p>🏹 <b>${esc(ctx.nome(p.cacciaDa))}</b> era il Cacciatore e sta prendendo la mira…</p></div>`;
        const sel = ui.lpScelta;
        return `<div class="lp-compito lp-caccia"><p>🏹 <b>Sei il Cacciatore e stai morendo.</b> Hai un ultimo colpo: tocca la tessera di chi vuoi portare con te.</p>
          <div class="lp-riga"><button type="button" class="bottone primario-bt lp-conferma" data-az="spara" ${sel == null ? 'disabled' : ''}>${sel == null ? 'Tocca una tessera' : `Spara a ${esc(ctx.nome(sel))}`}</button>
          <button type="button" class="bottone" data-az="nonSparo">Non sparo</button></div></div>`;
      }
      default: return '';
    }
  }

  // cosa succede se tocco la tessera k
  function tessereCliccabili(ctx) {
    const p = ctx.partita;
    if (!attivo(ctx) && !(p.fase === 'cacciatore' && p.cacciaDa === ctx.mio && !ctx.stato.spettatore && !p.inAttesa)) return () => false;
    if (p.fase === 'notte' && p.devoAgire && !(p.fatto && p.mioRuolo !== 'lupo')) {
      return (k) => p.vivi[k] && (p.mioRuolo === 'lupo' ? p.ruoli[k] !== 'lupo' : k !== ctx.mio && !(p.mioRuolo === 'guardia' && k === p.protettoIeri));
    }
    if (p.fase === 'voto') return (k) => p.vivi[k] && k !== ctx.mio && (!p.candidati || p.candidati.includes(k));
    if (p.fase === 'cacciatore' && p.cacciaDa === ctx.mio) return (k) => p.vivi[k] && k !== ctx.mio;
    return () => false;
  }

  function villaggio(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    const puo = tessereCliccabili(ctx);
    const votiPer = (k) => (p.voti || []).map((v, i) => (v === k ? i : -1)).filter((i) => i >= 0);
    const scelteLupi = p.sceltaLupi || {};
    const tessere = Array.from({ length: p.n }, (_, k) => {
      const morto = !p.vivi[k];
      const r = p.ruoli[k];
      const voti = p.fase === 'voto' || p.fase === 'condanna' ? votiPer(k) : [];
      const preda = Object.entries(scelteLupi).filter(([, v]) => v === k).map(([l]) => Number(l));
      const scelto = ui.lpScelta === k || (p.miaScelta === k && p.fase === 'notte') || (p.voti && p.voti[ctx.mio] === k && !ctx.stato.spettatore);
      const cl = puo(k);
      const cand = p.candidati && p.candidati.includes(k) && p.fase === 'voto';
      const classi = ['lp-abitante', morto ? 'morto' : '', cl ? 'tocca' : '', scelto ? 'scelto' : '', k === ctx.mio ? 'io' : '', r === 'lupo' && !morto ? 'lp-lupo' : '', cand ? 'cand' : '', p.condannato === k ? 'condannato' : ''].join(' ');
      const ic = r ? RUOLI[r][0] : morto ? '💀' : '';
      const sotto = morto ? (r ? RUOLI[r][1] : 'morto') : p.fase === 'giorno' && p.pronti ? (p.pronti[k] ? '✓ pronto' : '💬 discute') : r && k !== ctx.mio ? RUOLI[r][1] : '';
      return `<${cl ? 'button type="button"' : 'div'} class="${classi}" ${cl ? `data-az="scegli" data-posto="${k}" aria-pressed="${!!scelto}"` : ''}>
        <span class="lp-faccia">${esc(ctx.nome(k).slice(0, 1).toUpperCase())}${ic ? `<i class="lp-segno" aria-hidden="true">${ic}</i>` : ''}</span>
        <b>${esc(nomeCorto(ctx, k))}</b><small>${esc(sotto)}</small>
        ${voti.length ? `<span class="lp-voti" title="${esc(voti.map((i) => ctx.nome(i)).join(', '))}">${voti.length}<em>${esc(voti.map((i) => nomeCorto(ctx, i)).join(', '))}</em></span>` : ''}
        ${preda.length ? `<span class="lp-preda" title="scelto dal branco">🐾 ${preda.length}</span>` : ''}
      </${cl ? 'button' : 'div'}>`;
    }).join('');
    return `<section class="lp-villaggio" aria-label="Il villaggio">${tessere}</section>`;
  }

  function diario(ctx) {
    const p = ctx.partita;
    if (!p.diario || !p.diario.length || ctx.stato.spettatore) return '';
    return `<section class="lp-diario"><h4>📜 Il tuo taccuino segreto</h4><ul>${[...p.diario].reverse().map((d) => `<li>${conNomi(ctx, d.testo)}</li>`).join('')}</ul></section>`;
  }

  function finale(ctx) {
    const p = ctx.partita;
    const mio = p.ruoli[ctx.mio];
    const branco = mio === 'lupo' || mio === 'indemoniato';
    const villaggio = p.esito === 'villaggio';
    const vinto = !ctx.stato.spettatore && (branco ? !villaggio : villaggio);
    return `<div class="lp-finale ${villaggio ? 'lp-vince-villaggio' : 'lp-vince-lupi'}" style="${ritardo(ctx.ui, 'lp-finale')}">
      <div class="lp-grande" aria-hidden="true">${villaggio ? '🌾☀️' : '🐺🌕'}</div>
      <h3>${villaggio ? 'Vince il villaggio!' : 'Vincono i lupi mannari!'}</h3>
      ${ctx.stato.spettatore ? '' : `<p>${vinto ? 'Hai vinto! 🎉' : 'Hai perso…'}</p>`}
      <p class="lp-piccolo">Ecco tutte le carte qui sotto.</p></div>`;
  }

  const tavolo = {
    libero: true,
    senzaFila: true,
    panno(ctx) {
      const p = ctx.partita;
      const cielo = p.finita || p.fase === 'finale' ? (p.esito === 'villaggio' ? 'giorno' : 'notte') : notturna(p.fase) ? 'notte' : p.fase === 'alba' ? 'alba' : 'giorno';
      return `<div class="lp lp-${cielo} lp-f-${esc(p.fase)}">
        <div class="lp-cielo" aria-hidden="true"><i class="lp-astro"></i><i class="lp-stelle"></i><i class="lp-colline"></i></div>
        ${testa(ctx)}
        <div class="lp-corpo"><div class="lp-col">${narratore(ctx)}${carta(ctx)}${compito(ctx)}</div>
        <div class="lp-col">${villaggio(ctx)}${diario(ctx)}</div></div></div>`;
    },
    reset(ctx) {
      ctxL = ctx;
      const p = ctx.partita, ui = ctx.ui;
      // cambio di fase: la scelta da confermare si azzera, la carta si chiude, suono
      const chiave = `${p.fase}-${p.notteN}-${p.ballottaggio}`;
      if (ui.lpFase !== chiave) {
        if (ui.lpFase !== undefined) suonoFase(p.fase);
        ui.lpFase = chiave; ui.lpScelta = null;
        if (p.fase !== 'ruoli' && ui.lpCarta == null) ui.lpCarta = false;
      }
      // il narratore legge le frasi nuove (non quelle di prima che arrivassi)
      const r = p.racconto || [];
      const ultimo = r.length ? r[r.length - 1].id : 0;
      if (ui.lpLetto == null || ultimo < ui.lpLetto) ui.lpLetto = ultimo;
      else if (ultimo > ui.lpLetto) {
        leggi(r.filter((x) => x.id > ui.lpLetto).map((x) => soloTesto(ctx, x.testo)));
        ui.lpLetto = ultimo;
      }
    },
    statoAttesa(ctx) { const p = ctx.partita; return p.fase === 'ruoli' ? 'Guardate la carta' : p.fase === 'finale' ? 'Fine della partita' : 'Il narratore racconta…'; },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (!vivo(ctx) && !ctx.stato.spettatore) return 'Sei un fantasma 👻';
      if (p.fase === 'notte') return p.devoAgire && !p.fatto ? (p.mioRuolo === 'lupo' ? 'Scegli la vittima' : 'Usa il tuo potere') : 'È notte: dormi';
      if (p.fase === 'giorno') return 'Discussione';
      if (p.fase === 'voto') return p.voti && p.voti[ctx.mio] === -2 ? 'Vota!' : 'Aspetta gli altri voti';
      if (p.fase === 'cacciatore') return p.cacciaDa === ctx.mio ? 'Spara!' : 'Il Cacciatore mira…';
      return null;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return `<span>Vivi <b>${p.vivi.filter(Boolean).length}</b>/${p.n}</span><span>${p.notteN ? `${notturna(p.fase) ? 'Notte' : 'Giorno'} <b>${p.notteN}</b>` : ''}</span>`;
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      if (!p.vivi[posto]) return '<span class="eliminato">💀 morto</span>';
      return '';
    },
    clic(ctx, el) {
      const p = ctx.partita, ui = ctx.ui, az = el.dataset.az;
      if (az === 'voce') {
        voglia = !voglia;
        try { localStorage.setItem('if:lpVoce', voglia ? 'si' : 'no'); } catch (e) { /* niente */ }
        if (!voglia) zitto();
        else { const r = p.racconto || []; if (r.length) leggi([soloTesto(ctx, r[r.length - 1].testo)]); }
        return ctx.ridisegna();
      }
      if (az === 'tutto') { ui.lpTutto = !ui.lpTutto; return ctx.ridisegna(); }
      if (az === 'carta') { ui.lpCarta = !(p.fase === 'ruoli' ? ui.lpCarta !== false : !!ui.lpCarta); return ctx.ridisegna(); }
      if (az === 'scegli') {
        const k = Number(el.dataset.posto);
        if (p.fase === 'notte' && p.mioRuolo === 'lupo') return ctx.invia({ tipo: 'notte', posto: k });
        if (p.fase === 'voto') return ctx.invia({ tipo: 'vota', posto: k });
        ui.lpScelta = ui.lpScelta === k ? null : k;
        return ctx.ridisegna();
      }
      if (az === 'conferma' && ui.lpScelta != null) { const k = ui.lpScelta; ui.lpScelta = null; return ctx.invia({ tipo: 'notte', posto: k }); }
      if (az === 'spara' && ui.lpScelta != null) { const k = ui.lpScelta; ui.lpScelta = null; return ctx.invia({ tipo: 'spara', posto: k }); }
      if (az === 'nonSparo') return ctx.invia({ tipo: 'spara', posto: -1 });
      if (az === 'pronto') return ctx.invia({ tipo: p.pronti && p.pronti[ctx.mio] ? 'nonPronto' : 'pronto' });
      if (az === 'astieniti') return ctx.invia({ tipo: 'vota', posto: -1 });
    },
  };
  // se si esce dal tavolo la voce si ferma
  setInterval(() => { if (parlando && !document.querySelector('#panno .lp')) zitto(); }, 1500);
  Object.assign(window.Tavoli, { lupus: tavolo });
  window.LupusVoce = { coda, zitto, _ctx: () => ctxL };
})();
