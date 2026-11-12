// SNAKE: il tavolo nel browser. Il canvas resta lo stesso per tutta la partita: il tavolo si ridisegna, il canvas no.
(() => {
  const { esc } = window.Nuovi;
  const COLORI = ['#ffd166', '#6aa8ff', '#ff7b6b', '#7fd1a8', '#c89bff', '#ffa94d', '#5fd0d0', '#f7a8d8'];
  const TASTI = { ArrowUp: 'su', ArrowDown: 'giu', ArrowLeft: 'sx', ArrowRight: 'dx', w: 'su', s: 'giu', a: 'sx', d: 'dx', W: 'su', S: 'giu', A: 'sx', D: 'dx' };
  let ctxS = null, tela = null, stato = null, partitaDi = null;
  // movimento fluido: per ogni serpente il corpo di prima e quando è partito il passo; il disegno scorre tra i due
  let anim = [];
  function segnaMossa(d, ctx) {
    const passo = (ctx && ctx.partita && ctx.partita.passoMs) || 120;
    const ora = performance.now();
    (d.s || []).forEach((s, i) => {
      const a = anim[i];
      const c = s.c || [];
      if (!a || !a.ora || !a.ora.length || !c.length) { anim[i] = { da: null, ora: c, t0: ora, dur: passo, ultimo: ora }; return; }
      const [hx, hy] = c[0], [px, py] = a.ora[0];
      if (hx === px && hy === py) { a.ora = c; return; }
      // un passo solo (la testa nuova sta accanto alla vecchia e il corpo è scorso di uno): si anima; se no si salta
      const vicino = Math.abs(hx - px) + Math.abs(hy - py) === 1 && c.length > 1 && c[1][0] === px && c[1][1] === py;
      const dur = Math.max(passo / 2 - 5, Math.min(passo + 20, ora - a.ultimo));
      anim[i] = { da: vicino ? a.ora : null, ora: c, t0: ora, dur, ultimo: ora };
    });
  }
  // dove disegnare il pezzo k del serpente i in questo momento (in caselle, anche a metà)
  function corpoFluido(i, c) {
    const a = anim[i];
    if (!a || !a.da || a.ora !== c || (stato && (stato.pausa || stato.via > 0))) return c;
    const t = Math.min(1, (performance.now() - a.t0) / a.dur);
    if (t >= 1) return c;
    return c.map(([x, y], k) => {
      const [x0, y0] = a.da[Math.min(k, a.da.length - 1)];
      // passando dal bordo (senza muri) non si scorre attraverso tutto il campo: si salta
      if (Math.abs(x - x0) > 1 || Math.abs(y - y0) > 1) return [x, y];
      return [x0 + (x - x0) * t, y0 + (y - y0) * t];
    });
  }

  function assicuraTela(ctx) {
    const p = ctx.partita;
    if (!tela || partitaDi !== p.W * 100 + p.H) {
      tela = document.createElement('canvas');
      tela.className = 'sn-tela';
      tela.setAttribute('aria-label', 'Arena di Snake');
      partitaDi = p.W * 100 + p.H;
    }
    return tela;
  }

  function disegna() {
    const ctx = ctxS;
    if (!ctx || !ctx.stato || !ctx.partita || ctx.partita.gioco !== 'snake' || !tela || !stato) return;
    const p = ctx.partita;
    const box = tela.parentElement;
    if (!box) return;
    // l'altezza che resta sotto la barra (sul telefono in orizzontale è poca: si usa tutta quella libera)
    const libera = window.innerHeight - Math.max(0, box.getBoundingClientRect().top + (window.scrollY || 0)) - 40;
    const lato = Math.max(6, Math.floor(Math.min(box.clientWidth / p.W, (matchMedia('(pointer: coarse)').matches ? Math.max(window.innerHeight * 0.5, libera) : window.innerHeight * 0.66) / p.H)));
    const dpr = window.devicePixelRatio || 1;
    if (tela.width !== p.W * lato * dpr) { tela.width = p.W * lato * dpr; tela.height = p.H * lato * dpr; tela.style.width = `${p.W * lato}px`; tela.style.height = `${p.H * lato}px`; }
    const g = tela.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fondo a scacchiera leggera
    g.fillStyle = '#14352b'; g.fillRect(0, 0, p.W * lato, p.H * lato);
    g.fillStyle = '#173d31';
    for (let y = 0; y < p.H; y++) for (let x = (y % 2); x < p.W; x += 2) g.fillRect(x * lato, y * lato, lato, lato);
    if (p.muri) { g.strokeStyle = '#8fb8a4'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, p.W * lato - 3, p.H * lato - 3); }
    // mele
    for (const [x, y] of stato.m) {
      g.fillStyle = '#e8453c'; g.beginPath(); g.arc((x + 0.5) * lato, (y + 0.55) * lato, lato * 0.36, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5fbf4a'; g.fillRect((x + 0.5) * lato, (y + 0.08) * lato, lato * 0.16, lato * 0.22);
    }
    // power-up: dischi con simbolo
    const SIMBOLI = { oro: ['#f2c94c', '★'], scudo: ['#6aa8ff', '⛨'], fantasma: ['#dfe6ee', '◌'], turbo: ['#ff9f43', '»'] };
    for (const [x, y, t] of stato.q) {
      const [c, s] = SIMBOLI[t];
      const pulsa = 0.42 + Math.sin(Date.now() / 180) * 0.05;
      g.fillStyle = c; g.beginPath(); g.arc((x + 0.5) * lato, (y + 0.5) * lato, lato * pulsa, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1b1b'; g.font = `700 ${Math.round(lato * 0.62)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s, (x + 0.5) * lato, (y + 0.55) * lato);
    }
    // serpenti
    stato.s.forEach((s, i) => {
      if (!s.v) return;
      const col = COLORI[i % 8];
      g.globalAlpha = s.fa ? 0.45 : 1;
      const corpo = corpoFluido(i, s.c);
      // un nastro sotto i cerchi: il serpente sembra un corpo unico anche mentre scorre
      if (corpo.length > 1) {
        g.strokeStyle = shade(col); g.lineWidth = lato * 0.62; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        corpo.forEach(([x, y], k) => {
          const salto = k > 0 && (Math.abs(x - corpo[k - 1][0]) > 1.5 || Math.abs(y - corpo[k - 1][1]) > 1.5);
          if (k === 0 || salto) g.moveTo((x + 0.5) * lato, (y + 0.5) * lato); else g.lineTo((x + 0.5) * lato, (y + 0.5) * lato);
        });
        g.stroke();
      }
      corpo.forEach(([x, y], k) => {
        const r = k === 0 ? 0.48 : 0.42 - Math.min(0.12, k * 0.004);
        g.fillStyle = k === 0 ? col : k % 2 ? col : shade(col);
        g.beginPath(); g.arc((x + 0.5) * lato, (y + 0.5) * lato, lato * r, 0, Math.PI * 2); g.fill();
      });
      const [hx, hy] = corpo[0];
      const off = { su: [0, -1], giu: [0, 1], sx: [-1, 0], dx: [1, 0] }[s.d];
      const perp = [off[1], off[0]];
      for (const k of [-1, 1]) {
        const ex = (hx + 0.5 + off[0] * 0.15 + perp[0] * k * 0.22) * lato, ey = (hy + 0.5 + off[1] * 0.15 + perp[1] * k * 0.22) * lato;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, lato * 0.13, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(ex + off[0] * lato * 0.05, ey + off[1] * lato * 0.05, lato * 0.07, 0, Math.PI * 2); g.fill();
      }
      if (s.sc) { g.strokeStyle = '#6aa8ff'; g.lineWidth = 2.5; g.beginPath(); g.arc((hx + 0.5) * lato, (hy + 0.5) * lato, lato * 0.75, 0, Math.PI * 2); g.stroke(); }
      if (i === ctx.mio) { g.fillStyle = '#fff'; g.font = `600 ${Math.max(10, lato * 0.7)}px sans-serif`; g.textAlign = 'center'; g.fillText('tu', (hx + 0.5) * lato, (hy - 0.55) * lato); }
      g.globalAlpha = 1;
    });
    // conto alla rovescia e pausa
    const scritta = stato.pausa ? '⏸ In pausa' : stato.via > 0 ? String(Math.ceil(stato.via / 1000)) : '';
    if (scritta) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, p.W * lato, p.H * lato);
      g.fillStyle = '#f7f0de'; g.font = `400 ${lato * 5}px "Young Serif", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(scritta, (p.W * lato) / 2, (p.H * lato) / 2);
    }
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.round(v * 0.82)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  (function giro() { disegna(); requestAnimationFrame(giro); })();

  const snake = {
    libero: true,
    reset(ctx) {
      ctxS = ctx;
      // nuova partita (o rivincita): si riparte dallo stato completo
      if (ctx.ui._snakeVisto !== true || ctx.partita.finita) { stato = ctx.partita.stato; ctx.ui._snakeVisto = true; anim = []; if (stato) segnaMossa(stato, ctx); }
    },
    tick(ctx, d) {
      segnaMossa(d, ctx);
      stato = d;
      // i punti in alto si aggiornano anche tra un messaggio e l'altro
      if (Date.now() - (ctx.ui._puntiDal || 0) > 400) { ctx.ui._puntiDal = Date.now(); const el = document.getElementById('punteggio'); if (el) el.innerHTML = snake.punteggio(ctx); }
    },
    panno(ctx) {
      const p = ctx.partita;
      const mio = stato && stato.s[ctx.mio];
      const nota = !p.finita && mio && !mio.v ? '<p class="sn-nota">Sei fuori! Guarda come va a finire.</p>' : '<p class="sn-nota piccolo">Frecce o W A S D per girare · sul telefono scorri il dito sull\'arena</p>';
      return `<div class="sn"><div class="sn-box" data-rt="snake"></div>${nota}</div>`;
    },
    dopo(ctx) {
      const box = document.querySelector('.sn-box');
      const t = assicuraTela(ctx);
      if (box && t.parentElement !== box) box.append(t);
    },
    stato(ctx) { const p = ctx.partita; if (p.finita) return null; const m = stato && stato.s[ctx.mio]; return m && !m.v ? 'Eliminato' : 'Resisti fino alla fine'; },
    punteggio(ctx) {
      const p = ctx.partita;
      const s = stato ? stato.s : [];
      return s.map((x, i) => `<span class="${x.v ? '' : 'barrato'}" style="color:${COLORI[i % 8]}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x.p}</b></span>`).join('') + (p.n > 1 ? '<span class="obiettivo">vince l\'ultimo in gioco</span>' : '');
    },
    infoPosto(ctx, posto) { const x = stato && stato.s[posto]; return x ? (x.v ? `lungo ${x.c.length}` : '<span class="eliminato">fuori</span>') : ''; },
    clic() {},
  };

  const manda = (dir) => { if (ctxS && ctxS.stato && ctxS.partita && ctxS.partita.gioco === 'snake' && !ctxS.partita.finita) ctxS.emetti('input', { dir }); };
  document.addEventListener('keydown', (e) => {
    if (!ctxS || !ctxS.stato || !ctxS.partita || ctxS.partita.gioco !== 'snake' || (window.Boss && Boss.attivo)) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const d = TASTI[e.key];
    if (!d) return;
    e.preventDefault();
    manda(d);
  });
  // dito: si gira appena il dito ha strisciato abbastanza (non quando si stacca) e, senza staccarlo, si può girare
  // ancora strisciando da un'altra parte; vale tutta la zona del gioco, non solo il campo
  let inizio = null;
  const inGioco = () => ctxS && ctxS.partita && ctxS.partita.gioco === 'snake' && !ctxS.partita.finita;
  document.addEventListener('pointerdown', (e) => {
    if (!inGioco() || !(e.target === tela || (e.target.closest && e.target.closest('.sn')))) return;
    inizio = [e.clientX, e.clientY, e.pointerId]; e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!inizio || e.pointerId !== inizio[2]) return;
    const dx = e.clientX - inizio[0], dy = e.clientY - inizio[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    manda(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dx' : 'sx') : (dy > 0 ? 'giu' : 'su'));
    inizio = [e.clientX, e.clientY, e.pointerId];
  });
  const lascia = (e) => { if (inizio && e.pointerId === inizio[2]) inizio = null; };
  document.addEventListener('pointerup', lascia);
  document.addEventListener('pointercancel', lascia);

  Object.assign(window.Tavoli, { snake });
})();
