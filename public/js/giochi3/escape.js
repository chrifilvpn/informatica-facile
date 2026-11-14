// ESCAPE ROOM: il tavolo nel browser. In alto la stanza e l'orologio; poi le schede degli enigmi (con i pezzi che vedo
// io, chi ha gli altri pezzi, il lucchetto e gli aiuti) e in fondo la porta con i frammenti trovati. I lucchetti a leve,
// frecce e tasti colorati si compongono qui e partono con «Prova»; cifre e lettere si scrivono nella casella.
(() => {
  const { esc, suono } = window.Nuovi;
  let ctxS = null;
  const FRECCE = { U: '↑', R: '→', D: '↓', L: '←' };

  const attivo = (ctx) => { const p = ctx.partita; return !p.finita && !p.inAttesa && !p.inPausa && !ctx.stato.spettatore; };
  const io = (ctx, i) => i === ctx.mio && !ctx.stato.spettatore;
  const nomeCorto = (ctx, i) => (io(ctx, i) ? 'tu' : ctx.nome(i));
  const daChi = (ctx, i) => (io(ctx, i) ? 'te' : ctx.nome(i)); // «aperto da te»
  const ceLha = (ctx, i) => (io(ctx, i) ? 'ce l\'hai <b>tu</b>' : `ce l'ha <b>${esc(ctx.nome(i))}</b>`);
  const chiave = (ctx, i) => `${ctx.partita.stanzaN}-${i}`;
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  // ---------------- l'orologio (si aggiorna da solo tra un messaggio del server e l'altro) ----------------
  let rif = null; // { resta, trascorso, alle, pausa }
  function orologio() {
    if (!rif) return '';
    const passati = rif.pausa || rif.fermo ? 0 : Date.now() - rif.alle;
    return rif.aTempo ? mmss(rif.resta - passati) : mmss(rif.trascorso + passati);
  }
  setInterval(() => {
    const el = document.querySelector('.er-orologio b');
    if (!el || !rif) return;
    el.textContent = orologio();
    const resta = rif.aTempo ? rif.resta - (rif.pausa || rif.fermo ? 0 : Date.now() - rif.alle) : Infinity;
    el.parentElement.classList.toggle('er-poco', resta < 120000);
  }, 250);

  // ---------------- i pezzi degli enigmi ----------------
  function blocco(b) {
    if (b.t === 'testo') return `<p class="er-testo">${esc(b.v)}</p>`;
    if (b.t === 'fila') return `<div class="er-fila">${b.v.map((x) => `<span class="er-tessera"><b>${esc(x.s)}</b>${x.n ? `<small>${esc(x.n)}</small>` : ''}</span>`).join('')}</div>`;
    if (b.t === 'tabella') return `<table class="er-tabella"><tbody>${b.v.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
    if (b.t === 'lista') return `<${b.numerata ? 'ol' : 'ul'} class="er-lista">${b.v.map((x) => `<li>${esc(x)}</li>`).join('')}</${b.numerata ? 'ol' : 'ul'}>`;
    if (b.t === 'griglia') return `<table class="er-griglia"><thead><tr><th></th>${b.col.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.righe.map(([r, ...x]) => `<tr><th>${esc(r)}</th>${x.map((l) => `<td>${esc(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return '';
  }
  function parti(ctx, e) {
    const mie = e.parti.filter((pt) => pt.blocchi);
    const altre = e.parti.filter((pt) => !pt.blocchi);
    let h = mie.map((pt) => `<div class="er-pezzo"><h4>${esc(pt.icona)} ${esc(pt.titolo)}</h4>${pt.blocchi.map(blocco).join('')}</div>`).join('');
    if (altre.length) {
      h += `<p class="er-altri">🗣️ ${mie.length ? 'Gli altri pezzi' : 'Qui non vedi niente'}: ${altre.map((pt) => `<b>${esc(pt.icona)} ${esc(pt.titolo)}</b> ${ceLha(ctx, pt.chi)}`).join(' · ')}${mie.length ? '' : '. Chiedetevi in chat che cosa vedete!'}</p>`;
    }
    return h;
  }

  // ---------------- i lucchetti ----------------
  function stato(ctx, k, n, vuoto) {
    const ui = ctx.ui;
    ui.er = ui.er || {};
    if (!ui.er[k]) ui.er[k] = vuoto(n);
    return ui.er[k];
  }
  function lucchetto(ctx, e, id) {
    const l = e.lucchetto, k = chiave(ctx, id), ok = attivo(ctx), dis = ok ? '' : 'disabled';
    const prova = `<button type="button" class="bottone primario-bt er-prova" data-az="er-prova-${id}" data-e="${id}" ${dis}>🔑 Prova</button>`;
    if (l.tipo === 'cifre' || l.tipo === 'parola') {
      const cifre = l.tipo === 'cifre';
      return `<div class="er-lucchetto"><input class="er-casella" data-tieni="er${k}" data-invio="er-prova-${id}" maxlength="${l.n}" size="${l.n}" autocomplete="off" spellcheck="false" ${cifre ? 'inputmode="numeric" pattern="[0-9]*"' : 'autocapitalize="characters"'} placeholder="${(cifre ? '0' : '_').repeat(l.n)}" aria-label="${cifre ? 'Combinazione' : 'Parola'} (${l.n} ${cifre ? 'cifre' : 'lettere'})" value="${esc(ctx.ui[`t_er${k}`] || '')}" style="--n:${l.n}" ${dis}>${prova}</div>`;
    }
    if (l.tipo === 'leve') {
      const s = stato(ctx, k, l.n, (n) => new Array(n).fill(0));
      return `<div class="er-lucchetto er-col"><div class="er-leve">${s.map((v, i) => `<button type="button" class="er-leva ${v ? 'su' : ''}" data-az="er-leva" data-e="${id}" data-i="${i}" aria-pressed="${!!v}" aria-label="Leva ${i + 1} ${v ? 'su' : 'giù'}" ${dis}><i></i><span>${i + 1}</span></button>`).join('')}</div>${prova}</div>`;
    }
    if (l.tipo === 'frecce' || l.tipo === 'colori') {
      const s = stato(ctx, k, l.n, () => []);
      const segno = (c) => (l.tipo === 'frecce' ? FRECCE[c] : l.colori[Number(c)].e);
      const slot = Array.from({ length: l.n }, (_, i) => `<span class="er-slot ${s[i] != null ? 'pieno' : ''}">${s[i] != null ? segno(s[i]) : ''}</span>`).join('');
      const tasti = l.tipo === 'frecce'
        ? ['L', 'U', 'D', 'R'].map((c) => `<button type="button" class="bottone er-tasto" data-az="er-metti" data-e="${id}" data-v="${c}" aria-label="Freccia ${c}" ${dis}>${FRECCE[c]}</button>`).join('')
        : l.colori.map((c, i) => `<button type="button" class="bottone er-tasto er-nota" data-az="er-metti" data-e="${id}" data-v="${i}" aria-label="Tasto ${esc(c.c)}" ${dis}>${c.e}</button>`).join('');
      return `<div class="er-lucchetto er-col"><div class="er-slots">${slot}<button type="button" class="bottone er-tasto er-canc" data-az="er-canc" data-e="${id}" aria-label="Cancella" ${dis}>⌫</button></div><div class="er-tasti">${tasti}</div>${prova}</div>`;
    }
    if (l.tipo === 'filo') {
      const sc = ctx.ui.er && ctx.ui.er[k];
      return `<div class="er-lucchetto er-col"><div class="er-fili">${Array.from({ length: l.n }, (_, i) => `<button type="button" class="er-filo ${sc === i + 1 ? 'scelto' : ''}" data-az="er-filo" data-e="${id}" data-i="${i + 1}" aria-pressed="${sc === i + 1}" ${dis}><span>${i + 1}</span><i></i></button>`).join('')}</div>
        <button type="button" class="bottone primario-bt er-prova" data-az="er-prova-${id}" data-e="${id}" ${sc && ok ? '' : 'disabled'}>✂️ Taglia ${sc ? `il filo ${sc}` : 'un filo'}</button></div>`;
    }
    return '';
  }
  function leggi(l, v) {
    if (l.tipo === 'frecce') return [...v].map((c) => FRECCE[c]).join('');
    if (l.tipo === 'leve') return [...v].map((c) => (c === '1' ? '↑' : '↓')).join('');
    if (l.tipo === 'colori') return [...v].map((c) => l.colori[Number(c)].e).join('');
    if (l.tipo === 'filo') return `filo ${v}`;
    return v;
  }
  function tentativi(ctx, l, t) {
    if (!t || !t.length) return '';
    return `<p class="er-tentativi">✘ Già provati: ${t.map((x) => `<span>${esc(leggi(l, x.valore))} <small>${esc(nomeCorto(ctx, x.posto))}</small></span>`).join('')}</p>`;
  }

  // ---------------- le schede ----------------
  function scheda(ctx, e) {
    const p = ctx.partita;
    if (e.risolto) {
      return `<article class="er-scheda aperta"><header><span class="er-ico">🔓</span><div><h3>${esc(e.titolo)}</h3><p>Aperto da <b>${esc(daChi(ctx, e.risoltoDa))}</b> con <b>${esc(e.soluzione)}</b></p></div>
        <span class="er-premio" title="Frammento">${esc(e.premio.simbolo)}<b>${e.premio.cifra}</b></span></header>
        <details class="er-dettagli"><summary>Rivedi gli indizi</summary>${e.parti.map((pt) => `<div class="er-pezzo"><h4>${esc(pt.icona)} ${esc(pt.titolo)} <small>(${esc(nomeCorto(ctx, pt.chi))})</small></h4>${(pt.blocchi || []).map(blocco).join('')}</div>`).join('')}</details></article>`;
    }
    const aiuti = e.aiuti.map((a) => `<p class="er-aiuto">💡 ${esc(a)}</p>`).join('');
    const altriAiuti = e.aiutiTot - e.aiuti.length;
    const btAiuto = altriAiuti > 0 && attivo(ctx) ? `<button type="button" class="bottone er-chiedi" data-az="er-aiuto" data-e="${e.i}">💡 Aiuto <small>(−${mmss(p.penaAiuto)})</small></button>` : '';
    const soluzione = p.finita && e.soluzione ? `<p class="er-aiuto">La combinazione era <b>${esc(e.soluzione)}</b></p>` : '';
    return `<article class="er-scheda"><header><span class="er-ico">${esc(e.icona)}</span><div><h3>${esc(e.titolo)}</h3><p>${esc(e.testo)}</p></div><span class="er-premio chiuso" title="Frammento ancora chiuso">🔒</span></header>
      <div class="er-pezzi">${parti(ctx, e)}</div>
      ${lucchetto(ctx, e, e.i)}${tentativi(ctx, e.lucchetto, e.tentativi)}${aiuti}${soluzione}${btAiuto}</article>`;
  }
  function porta(ctx) {
    const p = ctx.partita, pr = p.porta;
    const fram = p.frammenti.length ? p.frammenti.map((f) => `<span class="er-frammento">${esc(f.simbolo)}<b>${f.cifra}</b></span>`).join('') : '<span class="er-vuoto">ancora nessun frammento</span>';
    const sopra = pr.simboli
      ? `<div class="er-pezzo"><h4>🚪 Sopra la porta${pr.risolta || p.finita ? '' : ' <small>(lo vedi solo tu)</small>'}</h4><p class="er-testo">Tre incavi, da sinistra a destra:</p><div class="er-fila">${pr.simboli.map((s) => `<span class="er-tessera"><b>${esc(s)}</b></span>`).join('')}</div></div>`
      : `<p class="er-altri">🗣️ I simboli sopra la porta li vede <b>${esc(nomeCorto(ctx, pr.chi))}</b>: chiedeteglieli!</p>`;
    let sotto;
    if (pr.risolta) sotto = `<p class="er-aiuto">🚪 Aperta da <b>${esc(daChi(ctx, pr.risoltaDa))}</b> con <b>${esc(pr.soluzione)}</b></p>`;
    else if (!pr.pronta) sotto = `<p class="er-aiuto er-attesa">Aprite prima i tre enigmi: ognuno contiene un frammento con una cifra.</p>`;
    else sotto = lucchetto(ctx, { lucchetto: { tipo: 'cifre', n: 3 } }, 'porta') + tentativi(ctx, { tipo: 'cifre' }, pr.tentativi);
    if (p.finita && !pr.risolta && pr.soluzione) sotto += `<p class="er-aiuto">La combinazione era <b>${esc(pr.soluzione)}</b></p>`;
    return `<article class="er-scheda er-porta ${pr.risolta ? 'aperta' : ''}"><header><span class="er-ico">🚪</span><div><h3>La porta${p.stanzaN + 1 >= p.totStanze ? ' d\'uscita' : ''}</h3><p>Lucchetto a 3 cifre: le cifre dei frammenti nell'ordine dei simboli sopra la porta.</p></div></header>
      <div class="er-frammenti">${fram}</div>${sopra}${sotto}</article>`;
  }

  function testa(ctx) {
    const p = ctx.partita;
    const tappe = Array.from({ length: p.totStanze }, (_, i) => `<i class="${i < p.stanzaN || (i === p.stanzaN && p.porta.risolta) ? 'fatta' : i === p.stanzaN ? 'qui' : ''}"></i>`).join('');
    return `<header class="er-testa">
      <div class="er-dove"><small>${esc(p.tema.emoji)} ${esc(p.tema.nome)} · stanza ${p.stanzaN + 1} di ${p.totStanze}</small><h2>${esc(p.stanza.emoji)} ${esc(p.stanza.nome)}</h2><div class="er-tappe">${tappe}</div></div>
      <div class="er-orologio ${p.inPausa ? 'er-ferma' : ''}" role="timer" aria-label="${p.aTempo ? 'Tempo rimasto' : 'Tempo passato'}"><small>${p.aTempo ? 'tempo rimasto' : 'tempo'}</small><b>${orologio()}</b><span>❌ ${p.errori} · 💡 ${p.aiutiUsati}</span></div>
    </header>`;
  }

  function cartello(ctx) {
    const p = ctx.partita;
    if (p.finita) {
      return p.vinto ? `<div class="er-cartello vinto"><b>🎉 Siete liberi!</b><p>${esc(p.tema.fine || '')}</p></div>`
        : '<div class="er-cartello perso"><b>⏰ Tempo scaduto</b><p>Le luci si spengono e la porta resta chiusa. Riprovate: gli enigmi saranno diversi!</p></div>';
    }
    if (p.inAttesa && p.prossima) return `<div class="er-cartello porta-aperta"><b>🚪 La porta si apre…</b><p>Avanti: ${esc(p.prossima.emoji)} ${esc(p.prossima.nome)}</p></div>`;
    if (p.inPausa) return '<div class="er-cartello"><b>⏸ Orologio fermo</b><p>Qualcuno ha aperto le dispense.</p></div>';
    return '';
  }

  const tavolo = {
    libero: true,
    reset(ctx) {
      ctxS = ctx;
      window.NuoviTesto && window.NuoviTesto(ctx);
      const p = ctx.partita;
      rif = { aTempo: p.aTempo, resta: p.restaMs, trascorso: p.trascorsoMs, alle: Date.now(), pausa: p.inPausa, fermo: p.finita };
    },
    panno(ctx) {
      const p = ctx.partita;
      const intro = p.stanzaN === 0 && !p.enigmi.some((e) => e.risolto) && !p.finita ? `<p class="er-intro">${esc(p.tema.intro)}</p>` : '';
      return `<div class="er er-tema-${esc(p.tema.id)}">${testa(ctx)}${cartello(ctx)}${intro}<p class="er-stanza-testo">${esc(p.stanza.testo)}</p>
        <div class="er-schede">${p.enigmi.map((e) => scheda(ctx, e)).join('')}${porta(ctx)}</div></div>`;
    },
    dopo(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const k = ui.fuoco;
      if (k && !(window.Boss && Boss.attivo)) {
        const el = document.querySelector(`[data-tieni="${k}"]`);
        if (el && !el.disabled) { el.focus({ preventScroll: true }); try { el.setSelectionRange(el.value.length, el.value.length); } catch {} }
      }
      // suoni: un lucchetto si apre, una porta si apre, un errore
      const aperti = p.enigmi.filter((e) => e.risolto).length + (p.porta.risolta ? 10 : 0) + p.stanzaN * 100;
      const errori = p.errori;
      if (ui._erAperti !== undefined) {
        if (aperti > ui._erAperti) suono(p.porta.risolta ? [[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.25]] : [[660, 0.08], [990, 0.16]], { volume: 0.07 });
        else if (errori > ui._erErrori) suono([[220, 0.12], [165, 0.22]], { tipo: 'square', volume: 0.04 });
      }
      ui._erAperti = aperti; ui._erErrori = errori;
    },
    statoAttesa() { return 'La porta si apre…'; },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.inPausa) return 'Orologio fermo';
      return 'Uscite tutti insieme!';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      const aperti = p.enigmi.filter((e) => e.risolto).length;
      return `<span>Stanza <b>${p.stanzaN + 1}/${p.totStanze}</b></span><span>🔓 <b>${aperti}/3</b></span>`;
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      if (p.fuori && p.fuori[posto]) return '<span class="er-info">uscito</span>';
      const n = p.enigmi.filter((e) => !e.risolto).reduce((s, e) => s + e.parti.filter((pt) => pt.chi === posto).length, 0) + (!p.porta.risolta && p.porta.chi === posto ? 1 : 0);
      return `<span class="er-info">📜 ${n} ${n === 1 ? 'indizio' : 'indizi'}</span>`;
    },
    clic(ctx, el) {
      const ui = ctx.ui, az = el.dataset.az;
      const id = el.dataset.e === 'porta' ? 'porta' : Number(el.dataset.e);
      const p = ctx.partita;
      const e = id === 'porta' ? { lucchetto: { tipo: 'cifre', n: 3 } } : p.enigmi[id];
      if (!e || !attivo(ctx)) return;
      const k = chiave(ctx, id), l = e.lucchetto;
      ui.er = ui.er || {};
      if (az === 'er-aiuto') return ctx.invia({ tipo: 'aiuto', enigma: id });
      if (az === 'er-leva') { const s = stato(ctx, k, l.n, (n) => new Array(n).fill(0)); const i = Number(el.dataset.i); s[i] = s[i] ? 0 : 1; suono([[s[i] ? 300 : 240, 0.05]], { tipo: 'square', volume: 0.03 }); return ctx.ridisegna(); }
      if (az === 'er-metti') { const s = stato(ctx, k, l.n, () => []); if (s.length < l.n) s.push(el.dataset.v); if (l.tipo === 'colori') suono([[[262, 294, 330, 349, 392, 440][Number(el.dataset.v)] || 330, 0.18]], { volume: 0.06 }); return ctx.ridisegna(); }
      if (az === 'er-canc') { const s = stato(ctx, k, l.n, () => []); s.pop(); return ctx.ridisegna(); }
      if (az === 'er-filo') { ui.er[k] = Number(el.dataset.i); return ctx.ridisegna(); }
      if (az.startsWith('er-prova-')) {
        let valore;
        if (l.tipo === 'cifre' || l.tipo === 'parola') {
          valore = String(ui[`t_er${k}`] || '').trim();
          const pulito = l.tipo === 'cifre' ? valore.replace(/\D/g, '') : valore.replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ]/g, '');
          if (pulito.length !== l.n) return ctx.avviso(`Servono ${l.n} ${l.tipo === 'cifre' ? 'cifre' : 'lettere'}`);
          ui[`t_er${k}`] = '';
        } else if (l.tipo === 'leve') valore = stato(ctx, k, l.n, (n) => new Array(n).fill(0)).join('');
        else if (l.tipo === 'frecce' || l.tipo === 'colori') {
          const s = stato(ctx, k, l.n, () => []);
          if (s.length !== l.n) return ctx.avviso(`Servono ${l.n} ${l.tipo === 'frecce' ? 'frecce' : 'tasti'}`);
          valore = s.join('');
          ui.er[k] = [];
        } else if (l.tipo === 'filo') { if (!ui.er[k]) return ctx.avviso('Scegli prima un filo'); valore = String(ui.er[k]); ui.er[k] = null; }
        ctx.invia({ tipo: 'prova', enigma: id, valore });
        return ctx.ridisegna();
      }
    },
  };

  Object.assign(window.Tavoli, { escape: tavolo });
})();
