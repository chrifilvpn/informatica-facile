// CUCÙ (Asso che corre): i giocatori seduti in cerchio intorno al mazzo (io in basso, chi viene dopo di me alla
// mia destra), la carta di ognuno coperta (la mia scoperta, quelle che so dove sono con l'occhio), le vite a cuori.
// Gli scambi si vedono con le carte che volano da un posto all'altro, il re fa "cucù!" e alla fine si gira tutto.
(() => {
  const { esc, primaVolta, suono, ritardo, strato, calmo } = window.Nuovi;
  const valore = (c) => (c.rango <= 7 ? c.rango : c.rango - 3);
  // sulle figure il numerino col valore: fante 8, cavallo 9, re 10
  const F = (c, cls = '', attr = '') => Carte.fronte(c, cls, attr, c.rango > 10 ? { valore: c.rango - 3 } : {});
  const NOMI = { 1: 'asso', 11: 'fante', 12: 'cavallo', 13: 're' };
  const nomeCarta = (c) => `${NOMI[c.rango] || c.rango} di ${Carte.SEMI[c.seme]}`;
  const chi = (ctx, i) => (i === ctx.mio ? 'Tu' : ctx.nome(i));
  const dopoDi = (p, i) => { const k = p.ordine.indexOf(i); return k < 0 ? null : p.ordine[(k + 1) % p.ordine.length]; };
  const mioTurno = (ctx) => { const p = ctx.partita; return p.turno === ctx.mio && !p.inAttesa && !p.finita; };
  const cuori = (v, tot) => `${'<i class="cu-cuore">♥</i>'.repeat(Math.max(0, v))}${'<i class="cu-cuore vuoto">♥</i>'.repeat(Math.max(0, tot - v))}`;

  // l'ultima cosa che ha fatto ognuno in questo giro
  function azioniGiro(p) {
    const out = {};
    for (const e of p.storia) {
      if (e.tipo === 'tiene') out[e.posto] = { t: 'tiene', cls: '' };
      else if (e.tipo === 'scambia') { out[e.posto] = { t: '⇄ scambia', cls: 'scambio' }; out[e.con] = out[e.con] || { t: '⇄ ricevuta', cls: 'scambio' }; }
      else if (e.tipo === 'bloccato') { out[e.posto] = { t: '🚫 bloccato', cls: 'bloccato' }; out[e.con] = { t: 'cucù! 👑', cls: 'cucu' }; }
      else if (e.tipo === 'cucu') out[e.posto] = { t: 'cucù! 👑', cls: 'cucu' };
      else if (e.tipo === 'mazzo') out[e.posto] = { t: '⇄ col mazzo', cls: 'scambio' };
    }
    return out;
  }

  function messaggio(ctx) {
    const p = ctx.partita;
    if (p.finita) {
      const v = p.risultato.vincitori[0];
      return v === ctx.mio ? '🏆 Sei l\'ultimo rimasto: hai vinto!' : `🏆 Vince <b>${esc(ctx.nome(v))}</b>`;
    }
    if (p.fase === 'scoperta' && p.esito) {
      const e = p.esito;
      if (e.annullato) return 'Tutti con la stessa carta: il giro non conta';
      const nomi = e.perdenti.map((i) => `<b>${esc(chi(ctx, i))}</b>`).join(', ');
      const usciti = e.usciti.length ? ` · fuori: ${e.usciti.map((i) => esc(chi(ctx, i))).join(', ')} 💀` : '';
      return `Carta più bassa: <b>${{ 1: 'asso', 8: 'fante', 9: 'cavallo', 10: 're' }[e.minimo] || e.minimo}</b> → ${nomi} ${e.perdenti.length === 1 && e.perdenti[0] === ctx.mio ? 'perdi' : e.perdenti.length === 1 ? 'perde' : 'perdono'} una vita${usciti}`;
    }
    const u = p.ultimo;
    if (p.inAttesa && u) {
      if (u.tipo === 'scambia') return `<b>${esc(chi(ctx, u.da))}</b> ${u.da === ctx.mio ? 'scambi' : 'scambia'} con <b>${u.a === ctx.mio ? 'te' : esc(ctx.nome(u.a))}</b>`;
      if (u.tipo === 'bloccato') return `<b>${esc(chi(ctx, u.a))}</b> ${u.a === ctx.mio ? 'hai' : 'ha'} il re: cucù! Lo scambio salta`;
      if (u.tipo === 'cucu') return `<b>${esc(chi(ctx, u.da))}</b> ${u.da === ctx.mio ? 'hai' : 'ha'} il re: cucù! 👑`;
      if (u.tipo === 'mazzo') return `<b>${esc(chi(ctx, u.da))}</b> ${u.da === ctx.mio ? 'cambi' : 'cambia'} col mazzo`;
      if (u.tipo === 'tiene') return `<b>${esc(chi(ctx, u.da))}</b> ${u.da === ctx.mio ? 'tieni' : 'tiene'} la carta`;
    }
    if (mioTurno(ctx)) return p.mazziere === ctx.mio ? 'Tocca a te (sei il mazziere): tieni o cambi col mazzo?' : `Tocca a te: tieni o scambi con <b>${esc(ctx.nome(dopoDi(p, ctx.mio)))}</b>?`;
    if (p.turno != null) return `Decide <b>${esc(ctx.nome(p.turno))}</b>…`;
    return '&nbsp;';
  }

  const tavolo = {
    libero: true,
    senzaFila: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const n = p.n;
      const scoperta = p.fase === 'scoperta' || p.finita;
      const az = azioniGiro(p);
      const so = new Map(p.so.map((x) => [x.posto, x.carta]));
      const perdenti = new Set(p.esito && !p.esito.annullato ? p.esito.perdenti : []);
      const prossimo = mioTurno(ctx) && p.mazziere !== ctx.mio ? dopoDi(p, ctx.mio) : null;
      const u = p.ultimo;
      const posti = Array.from({ length: n }, (_, i) => {
        const rel = (i - ctx.mio + n) % n;
        const ang = Math.PI / 2 - (rel * 2 * Math.PI) / n; // io in basso, poi verso destra
        const x = 50 + 50 * Math.cos(ang), y = 50 + 50 * Math.sin(ang);
        const fuori = p.vite[i] <= 0;
        const c = p.carte[i];
        let carta = '';
        let anim = '';
        if (u && !calmo()) {
          if ((u.tipo === 'scambia' && (u.da === i || u.a === i)) || (u.tipo === 'mazzo' && u.da === i)) anim = 'cu-arriva';
          else if (u.tipo === 'bloccato' && u.da === i) anim = 'cu-scuoti';
          else if ((u.tipo === 'bloccato' && u.a === i) || (u.tipo === 'cucu' && u.da === i)) anim = 'cu-salta';
        }
        if (scoperta && c) anim = 'cu-gira';
        const st = anim ? `style="${ritardo(ui, `cu-${anim}-${u ? u.id : 0}-${p.giro}`)}"` : '';
        if (c) carta = F(c, `mini ${i === ctx.mio ? 'cu-mia-mini' : ''} ${c.rango === 13 ? 'cu-re' : ''}`);
        else if (p.coperte[i] && so.has(i)) carta = `<div class="cu-nota" title="Sai che ha ${esc(nomeCarta(so.get(i)))}">${F(so.get(i), 'mini')}<span>👁</span></div>`;
        else if (p.coperte[i]) carta = Carte.retro('mini');
        else carta = '<div class="carta mini vuota"></div>';
        const a = az[i];
        const cls = ['cu-posto', fuori ? 'fuori' : '', p.turno === i ? 'turno' : '', i === ctx.mio ? 'mio' : '', perdenti.has(i) ? 'perde' : '', prossimo === i ? 'bersaglio' : ''].join(' ');
        return `<div class="${cls}" data-posto="${i}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">
          <div class="cu-nome">${p.mazziere === i && !fuori ? '<span class="cu-m" title="Mazziere">M</span>' : ''}${fuori ? '💀 ' : ''}${esc(chi(ctx, i))}</div>
          <div class="cu-carta ${anim}" ${st}>${carta}${a && !fuori && !scoperta ? `<span class="cu-azione ${a.cls}">${a.t}</span>` : ''}${perdenti.has(i) ? `<span class="cu-meno" style="${ritardo(ui, `cu-meno-${p.giro}`)}">−1 ♥</span>` : ''}</div>
          <div class="cu-vite" title="${p.vite[i]} vite">${cuori(p.vite[i], p.viteIniziali)}</div>
          <div class="bolla-posto" data-bolla="${i}"></div>
        </div>`;
      }).join('');
      const centro = `<div class="cu-centro">
          <div class="cu-mazzo" title="Mazzo">${Carte.retro('mini')}<span>${p.mazzo}</span></div>
          ${p.scartata ? `<div class="cu-scarto" title="Carta lasciata dal mazziere">${F(p.scartata, 'mini')}<small>scartata</small></div>` : ''}
          <div class="cu-giro">giro ${p.giro}</div>
        </div>`;
      const conosco = p.so.length && !scoperta ? `<p class="cu-so">👁 Sai che ${p.so.map((x) => `<b>${esc(ctx.nome(x.posto))}</b> ha ${esc(nomeCarta(x.carta))}`).join(', ')}</p>` : '';
      return `<div class="cu">
        <div class="cu-tavolo ${n >= 7 ? 'affollato' : ''}" style="--n:${n}">${centro}<div class="cu-anello">${posti}</div></div>
        <p class="cu-msg ${p.fase === 'scoperta' ? 'esito' : ''}" aria-live="polite">${messaggio(ctx)}</p>
        ${conosco}
      </div>`;
    },
    mano(ctx) {
      const p = ctx.partita;
      if (p.vite[ctx.mio] <= 0) return '<p class="piccolo">Sei fuori: guarda come va a finire 💀</p>';
      const c = p.carte[ctx.mio];
      if (!c) return '';
      return `<div class="cu-mia ${mioTurno(ctx) ? 'attiva' : ''}">${F(c, 'cu-grande')}
        <div class="cu-mia-testo"><small>La tua carta</small><b>${esc(nomeCarta(c))}</b><span>vale ${valore(c)}${c.rango === 13 ? ' · cucù! 👑' : valore(c) <= 3 ? ' · bassa!' : ''}</span></div></div>`;
    },
    azioni(ctx) {
      const p = ctx.partita;
      if (!mioTurno(ctx)) return '';
      const q = dopoDi(p, ctx.mio);
      const mazziere = p.mazziere === ctx.mio;
      const reAccanto = !mazziere && p.mostrati.includes(q);
      return `<div class="cu-scelta">
        <button type="button" class="bottone" data-az="tieni">✋ Tengo</button>
        <button type="button" class="bottone primario" data-az="scambia" ${reAccanto ? 'disabled title="Ha il re: lo scambio salterebbe"' : ''}>⇄ ${mazziere ? 'Cambio col mazzo' : `Scambio con ${esc(ctx.nome(q))}`}</button>
      </div>`;
    },
    dopo(ctx) {
      const p = ctx.partita, ui = ctx.ui, u = p.ultimo;
      if (!u || !primaVolta(ui, `cu-u-${u.id}-${p.giro}`)) return;
      if (u.tipo === 'scambia' || u.tipo === 'mazzo') {
        suono([[392, 0.05], [523, 0.05], [659, 0.06]], { tipo: 'sine', volume: 0.05 });
        if (calmo()) return;
        const rett = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
        const da = rett(`.cu-posto[data-posto="${u.da}"] .cu-carta`);
        const a = u.tipo === 'scambia' ? rett(`.cu-posto[data-posto="${u.a}"] .cu-carta`) : rett('.cu-scarto') || rett('.cu-mazzo');
        const mazzo = rett('.cu-mazzo');
        if (!da || !a) return;
        const vola = (r1, r2, ritardoMs = 0) => {
          if (!r1 || !r2) return;
          const el = document.createElement('div');
          el.className = 'cu-volo';
          el.innerHTML = Carte.retro('mini');
          el.style.left = `${r1.left + r1.width / 2}px`; el.style.top = `${r1.top + r1.height / 2}px`;
          strato().append(el);
          const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2), dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
          const anim = el.animate([{ transform: 'translate(-50%, -50%) rotate(0deg)' }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx > 0 ? 200 : -200}deg)` }],
            { duration: 620, delay: ritardoMs, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
          anim.onfinish = () => el.remove();
          setTimeout(() => el.remove(), 1400);
        };
        vola(da, a);
        vola(u.tipo === 'scambia' ? a : mazzo, da, 60);
      } else if (u.tipo === 'cucu' || u.tipo === 'bloccato') {
        suono([[784, 0.2], [0, 0.06], [622, 0.34]], { tipo: 'sine', volume: 0.09 }); // cu-cù!
      } else if (u.tipo === 'scoperta') {
        const perdo = p.esito && !p.esito.annullato && p.esito.perdenti.includes(ctx.mio);
        if (perdo) suono([[330, 0.12], [247, 0.3]], { tipo: 'triangle', volume: 0.08 });
        else suono([[523, 0.07], [659, 0.07], [784, 0.12]], { volume: 0.05 });
      }
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.inAttesa || p.turno == null) return null;
      if (p.turno === ctx.mio) return p.mazziere === ctx.mio ? 'Tocca a te: tieni o cambi col mazzo?' : 'Tocca a te: tieni o scambi?';
      return `Decide ${ctx.nome(p.turno)}`;
    },
    statoAttesa(ctx) {
      const p = ctx.partita, u = p.ultimo;
      if (p.fase === 'scoperta') return 'Carte scoperte!';
      if (!u) return '…';
      return { scambia: 'Scambio…', mazzo: 'Cambio col mazzo…', bloccato: 'Cucù!', cucu: 'Cucù!', tiene: 'Tiene…' }[u.tipo] || '…';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      const vivi = p.vite.filter((v) => v > 0).length;
      const mie = p.vite[ctx.mio];
      return `<span>Tu <b class="cu-pv">${mie > 0 ? `${mie}<i class="cu-cuore">♥</i>` : '💀'}</b></span><span>In gioco <b>${vivi}</b>/${p.n}</span><span class="obiettivo">giro ${p.giro} · vince l'ultimo che resta</span>`;
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      return p.vite[posto] > 0 ? `${p.vite[posto]} ${p.vite[posto] === 1 ? 'vita' : 'vite'}${p.mazziere === posto ? ' · mazziere' : ''}` : '💀 fuori';
    },
    clic(ctx, el) {
      const az = el.dataset.az;
      if (az === 'tieni' || az === 'scambia') { el.classList.add('premuta'); return ctx.invia({ tipo: az }); }
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { cucu: tavolo });
})();
