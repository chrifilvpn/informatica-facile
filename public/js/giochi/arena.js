// MOTORE COMUNE (browser) dei giochi d'azione: canvas che resta vivo, comandi da tastiera, mouse e dito,
// interpolazione tra un tick e l'altro, conto alla rovescia e riepilogo del round. Ogni gioco passa:
//   { id, disegna(g, p, s, u, extra), istruzioni, comandi: 'movimento' | 'tasto', mouse: null | 'mira' | 'bersaglio',
//     accetta(x, y): facoltativo, false = il clic o il tocco in quel punto non si manda }
// dove s = stato del tick (interpolato con u tra 0 e 1 rispetto al precedente, vedi Arena.lerp).
window.Arena = (() => {
  const { esc, suono } = window.Nuovi;
  const COLORI = ['#e8453c', '#2f7fd8', '#2e9d57', '#e0a91c', '#8e55c9', '#e36fa5', '#1fa3a3', '#e07b2c'];
  const touch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  // interpolazione di un elenco di oggetti con id e x, y (gli altri campi si prendono dall'ultimo)
  function lerp(prima, dopo, u) {
    if (!prima) return dopo;
    const m = new Map(prima.map((o) => [o.id, o]));
    return dopo.map((o) => { const a = m.get(o.id); if (!a || a.salto !== o.salto || Math.hypot(a.x - o.x, a.y - o.y) > 200) return o; return { ...o, x: a.x + (o.x - a.x) * u, y: a.y + (o.y - a.y) * u }; });
  }

  // MOVIMENTO FLUIDO. Gli aggiornamenti del server arrivano a scatti (la rete non è regolare, soprattutto su Render):
  // (1) si tiene una piccola scorta di aggiornamenti con l'ora del server e si disegna un attimo nel passato, sempre
  //     tra due aggiornamenti veri, così uno in ritardo non ferma niente;
  // (2) nei giochi con cfg.predici il proprio omino si muove subito nel browser (stessi muri e velocità del server)
  //     e il browser manda la sua posizione: il server la raggiunge con le sue regole (Arena.verso); se i due si
  //     separano troppo (teletrasporto, muro diverso) il browser si rimette dove dice il server.
  function tavolo(cfg) {
    let ctxA = null, tela = null, ultimo = null, prima = null, arrivo = 0, passoMs = 33;
    let scorta = [], scarti = [], scarto = null, intervallo = 50; // aggiornamenti con l'ora del server, differenza tra gli orologi
    // quanto in ritardo arrivano gli aggiornamenti rispetto al più veloce (la rete non è regolare): si disegna un po' nel
    // passato, quanto basta perché l'aggiornamento successivo sia quasi sempre già arrivato (niente fermo-e-salto)
    let ritardi = [], attesa = 110;
    let pred = null, lontano = 0, ultimoFotogramma = 0, erroreVisto = false;
    const tasti = new Set();
    const inp = { x: 0, y: 0, a: false, t: 0, mx: null, my: null };
    let inviato = '', ultimoInvio = 0, attesaInvio = null;
    const joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
    let azioneId = null; // il dito che tiene premuto il pulsante dell'azione
    const attiva = () => ctxA && ctxA.stato && ctxA.partita && ctxA.partita.gioco === cfg.id && !ctxA.partita.finita;

    function aggiornaDaTasti() {
      if (joy.id !== null) return;
      const x = (tasti.has('d') || tasti.has('arrowright') ? 1 : 0) - (tasti.has('a') || tasti.has('arrowleft') ? 1 : 0);
      const y = (tasti.has('s') || tasti.has('arrowdown') ? 1 : 0) - (tasti.has('w') || tasti.has('arrowup') ? 1 : 0);
      // cfg.tasti(x, y): un gioco può girare il senso dei tasti (Calcio balilla col campo in orizzontale)
      const [xx, yy] = cfg.tasti ? cfg.tasti(x, y) : [x, y];
      const l = Math.hypot(xx, yy) || 1;
      inp.x = xx / l; inp.y = yy / l;
    }
    function invia(forza = false) {
      if (!attiva()) return;
      const ora = performance.now();
      const pacco = { x: Math.round(inp.x * 100) / 100, y: Math.round(inp.y * 100) / 100, a: inp.a, t: inp.t };
      if (pred) { pacco.px = Math.round(pred.x * 10) / 10; pacco.py = Math.round(pred.y * 10) / 10; } else if (cfg.predici) pacco.px = null;
      if (inp.mx !== null) { pacco.mx = Math.round(inp.mx); pacco.my = Math.round(inp.my); }
      const k = JSON.stringify(pacco);
      if (!forza && k === inviato && ora - ultimoInvio < 250) return;
      if (!forza && ora - ultimoInvio < 40 && k !== inviato) { if (!attesaInvio) attesaInvio = setTimeout(() => { attesaInvio = null; invia(); }, 45); return; }
      inviato = k; ultimoInvio = ora;
      ctxA.emetti('input', pacco);
    }
    setInterval(() => invia(), 120);
    const premi = () => { inp.t++; inp.a = true; invia(true); if (cfg.suonoAzione) suono(cfg.suonoAzione, { volume: 0.04 }); };

    document.addEventListener('keydown', (e) => {
      if (!attiva() || (window.Boss && Boss.attivo) || (e.target.closest && e.target.closest('input, textarea, select'))) return;
      const k = e.key.toLowerCase();
      if ([' ', 'enter', 'j', 'k'].includes(k)) { e.preventDefault(); if (!e.repeat) premi(); return; }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); tasti.add(k); aggiornaDaTasti(); invia(); }
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'enter', 'j', 'k'].includes(k)) { inp.a = false; invia(); }
      if (tasti.delete(k)) { aggiornaDaTasti(); invia(); }
    });
    window.addEventListener('blur', () => { tasti.clear(); inp.x = inp.y = 0; inp.a = false; invia(true); });

    function coordMondo(e) {
      const r = tela.getBoundingClientRect(), p = ctxA.partita;
      if (cfg.coordMondo) return cfg.coordMondo(e, r, p); // il gioco disegna il campo girato
      return [((e.clientX - r.left) / r.width) * p.W, ((e.clientY - r.top) / r.height) * p.H];
    }
    // mouse: mira o bersaglio (il gatto segue il puntatore); click = azione
    function preparaTela() {
      tela = document.createElement('canvas');
      tela.className = 'ar-tela';
      // "traccia" (Dalgona): tasto sinistro o dito tenuto premuto = si traccia, rilasciato = ci si ferma
      if (cfg.mouse === 'traccia') {
        tela.style.touchAction = 'none';
        tela.addEventListener('pointerdown', (e) => {
          if (!attiva() || (e.pointerType === 'mouse' && e.button !== 0)) return;
          e.preventDefault(); try { tela.setPointerCapture(e.pointerId); } catch (_) { /* niente */ }
          [inp.mx, inp.my] = coordMondo(e); inp.a = true; invia(true);
        });
        tela.addEventListener('pointermove', (e) => { if (!attiva()) return; [inp.mx, inp.my] = coordMondo(e); invia(); });
        const su = () => { if (!inp.a) return; inp.a = false; invia(true); };
        tela.addEventListener('pointerup', su); tela.addEventListener('pointercancel', su); tela.addEventListener('lostpointercapture', su);
        return;
      }
      tela.addEventListener('pointermove', (e) => {
        if (!attiva() || !cfg.mouse || e.pointerType === 'touch') return;
        [inp.mx, inp.my] = coordMondo(e); invia();
      });
      tela.addEventListener('pointerdown', (e) => {
        if (!attiva()) return;
        if (e.pointerType === 'touch') return; // il dito usa i comandi sullo schermo
        if (cfg.mouse) [inp.mx, inp.my] = coordMondo(e);
        if (cfg.accetta && cfg.mouse && !cfg.accetta(inp.mx, inp.my)) return; // il gioco può ignorare i clic nel vuoto
        if (cfg.clicAzione !== false) premi();
      });
      tela.addEventListener('pointerup', () => { inp.a = false; invia(); });
    }

    // comandi per il dito: joystick a sinistra, pulsante a destra; per chi usa il "bersaglio" basta toccare il campo
    function comandiTouch() {
      if (!touch() || cfg.comandi === 'nessuno') return ''; // 'nessuno': si gioca solo toccando il campo (Dalgona)
      if (cfg.comandi === 'tasto') return `<div class="ar-touch"><button type="button" class="ar-bt grande" data-ar="azione">${esc(cfg.nomeAzione || 'Spingi')}</button></div>`;
      return `<div class="ar-touch"><div class="ar-joy" data-ar="joy"><i></i></div>${cfg.nomeAzione ? `<button type="button" class="ar-bt" data-ar="azione">${esc(cfg.nomeAzione)}</button>` : ''}</div>`;
    }
    document.addEventListener('pointerdown', (e) => {
      if (!attiva()) return;
      const b = e.target.closest && e.target.closest('[data-ar="azione"]');
      if (b) { e.preventDefault(); azioneId = e.pointerId; premi(); return; }
      const j = e.target.closest && e.target.closest('[data-ar="joy"]');
      if (j) {
        e.preventDefault();
        const r = j.getBoundingClientRect();
        joy.id = e.pointerId; joy.x0 = r.left + r.width / 2; joy.y0 = r.top + r.height / 2; joy.el = j;
        muoviJoy(e);
      } else if (e.target === tela && e.pointerType === 'touch' && cfg.mouse && cfg.mouse !== 'traccia') {
        [inp.mx, inp.my] = coordMondo(e);
        if (cfg.accetta && !cfg.accetta(inp.mx, inp.my)) return; // il gioco può ignorare i tocchi nel vuoto
        if (cfg.mouse === 'mira') premi(); else invia(true);
      }
    }, { passive: false });
    function muoviJoy(e) {
      const dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, l = Math.hypot(dx, dy), max = 45;
      const k = l > max ? max / l : 1;
      inp.x = l > 8 ? (dx * k) / max : 0; inp.y = l > 8 ? (dy * k) / max : 0;
      const pomo = joy.el && joy.el.querySelector('i');
      if (pomo) pomo.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      invia();
    }
    document.addEventListener('pointermove', (e) => {
      if (joy.id === e.pointerId) { e.preventDefault(); muoviJoy(e); return; }
      if (attiva() && cfg.mouse === 'bersaglio' && e.pointerType === 'touch' && e.target === tela) { [inp.mx, inp.my] = coordMondo(e); invia(); }
    }, { passive: false });
    const lascia = (e) => {
      if (joy.id !== e.pointerId) {
        // il dito che teneva il pulsante (anche se è scivolato fuori) o il mouse lasciato fuori dal campo: azione finita
        if (inp.a && cfg.mouse !== 'traccia' && (e.pointerId === azioneId || e.pointerType === 'mouse' || (e.target && e.target.closest && e.target.closest('[data-ar="azione"]')))) { inp.a = false; invia(true); }
        if (e.pointerId === azioneId) azioneId = null;
        return;
      }
      joy.id = null; inp.x = inp.y = 0; const pomo = joy.el && joy.el.querySelector('i'); if (pomo) pomo.style.transform = ''; invia(true);
    };
    document.addEventListener('pointerup', lascia);
    document.addEventListener('pointercancel', lascia);

    function disegna() {
      requestAnimationFrame(disegna);
      if (!ctxA || !ctxA.partita || ctxA.partita.gioco !== cfg.id || !tela || !tela.isConnected || !ultimo) return;
      const p = ctxA.partita;
      const box = tela.parentElement;
      // il campo prende l'altezza che resta sotto la barra e il punteggio, lasciando in vista i comandi per il dito
      // (sul telefono il joystick finiva mezzo fuori dallo schermo nei campi alti come Mangiatutto)
      const sopra = Math.max(0, box.getBoundingClientRect().top + (window.scrollY || 0));
      const comandi = box.parentElement && box.parentElement.querySelector('.ar-touch, .st-frecce');
      // in orizzontale sul telefono i comandi stanno ai lati, sopra il campo (vedi .ar-touch nel CSS): non tolgono altezza
      const ai_lati = comandi && getComputedStyle(comandi).position === 'fixed';
      // telefono in orizzontale: l'altezza è poca, si tiene solo un filo sotto il campo (anche nei giochi senza joystick)
      const sdraiato = touch() && window.innerWidth > window.innerHeight && window.innerHeight <= 520;
      // sul computer le istruzioni sotto il campo possono andare su due righe (finivano sotto la targhetta col nome): si misura
      const istr = box.parentElement && box.parentElement.querySelector('.ar-istr');
      const spazioSotto = (comandi && !ai_lati ? comandi.offsetHeight + 16 : 0) + (touch() ? (ai_lati || sdraiato ? 14 : 52) : Math.max(70, 50 + (istr ? istr.offsetHeight : 0)));
      // sul telefono, se le istruzioni finirebbero sotto la targhetta, restano su una riga sola (il resto è nelle Regole)
      if (istr && touch() && performance.now() - (istr._visto || 0) > 1200) {
        istr._visto = performance.now();
        istr.classList.remove('ar-corta');
        const io = document.querySelector('#mio-nome');
        const limite = io && io.offsetParent ? io.getBoundingClientRect().top : window.innerHeight;
        if (istr.offsetParent && istr.getBoundingClientRect().bottom > limite + 2) istr.classList.add('ar-corta');
      }
      // cfg.pieno(): il gioco occupa tutto lo schermo (il riquadro è fisso sopra la pagina); cfg.misura(): la misura
      // della tela in "punti del gioco" se non è quella del server (Alien Isolation sul telefono segue lo schermo)
      const pieno = !!(cfg.pieno && cfg.pieno());
      const [LW, LH] = cfg.misura ? cfg.misura(p, pieno) : [p.W, p.H];
      const scala = pieno ? Math.min(box.clientWidth / LW, box.clientHeight / LH) : Math.min(box.clientWidth / LW, Math.max(140, window.innerHeight - sopra - spazioSotto) / LH);
      const dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDpr || 8), w = Math.round(LW * scala), h = Math.round(LH * scala);
      if (tela.width !== Math.round(w * dpr) || tela.height !== Math.round(h * dpr)) { tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr); tela.style.width = `${w}px`; tela.style.height = `${h}px`; }
      const g = tela.getContext('2d');
      g.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
      let [dopo, primaD, u] = coppia();
      // il mio omino previsto
      const oraF = performance.now(), dtF = Math.min(0.05, (oraF - (ultimoFotogramma || oraF)) / 1000); ultimoFotogramma = oraF;
      if (cfg.predici && !window.__arenaVecchio) {
        const srv = attiva() && ultimo.fase === 'gioco' && !ultimo.pausa ? cfg.predici.prendi(ultimo, ctxA) : null;
        if (!srv) pred = null;
        else {
          // mentre si cammina il server è sempre un po' indietro (il tempo della rete): si controlla solo da fermi.
          // Da fermi il server deve raggiungerci in un attimo; se dopo mezzo secondo è ancora lontano (un muro che il
          // browser non conosceva) ci si riavvicina dolcemente a lui. Un salto enorme (teletrasporto) si segue subito.
          const d = pred ? Math.hypot(srv.x - pred.x, srv.y - pred.y) : Infinity;
          const fermo = Math.hypot(inp.x, inp.y) < 0.05;
          lontano = fermo && d > 12 ? lontano + dtF : 0;
          if (!pred || d > 260) { pred = { x: srv.x, y: srv.y }; lontano = 0; }
          else if (lontano > 0.5) { const k = Math.min(1, dtF * 8); pred = { ...pred, x: pred.x + (srv.x - pred.x) * k, y: pred.y + (srv.y - pred.y) * k }; }
          pred = cfg.predici.muovi(pred, { x: inp.x, y: inp.y }, dtF, ctxA, ultimo) || pred;
          dopo = cfg.predici.metti(dopo, ctxA, pred); if (primaD) primaD = cfg.predici.metti(primaD, ctxA, pred);
          invia();
        }
      }
      if (window.__arenaTraccia) window.__arenaTraccia(dopo, primaD, u, pred); // solo per le prove automatiche
      try { cfg.disegna(g, p, dopo, primaD, u, ctxA); } catch (err) { if (!erroreVisto) { erroreVisto = true; console.error(`[${cfg.id}] errore nel disegno`, err); } } // un fotogramma perso non ferma il gioco
      // scritte sopra: conto alla rovescia, pausa, fine round
      let scritta = '', sotto = '';
      if (ultimo.pausa) {
        scritta = '⏸ In pausa';
        const gg = (ctxA.stato && ctxA.stato.giocatori) || [];
        const via = gg.map((x, i) => (x && x.nascosto && i !== ctxA.mio ? ctxA.nome(i) : null)).filter(Boolean);
        sotto = via.length ? `${via.join(', ')} ${via.length > 1 ? 'sono' : 'è'} sulle dispense: si riparte appena ${via.length > 1 ? 'tornano' : 'torna'} (al massimo 45 s)` : 'Si riparte tra un attimo';
      }
      else if (ultimo.fase === 'via') { scritta = String(Math.max(1, Math.ceil(ultimo.via / 1000))); sotto = `Round ${ultimo.round} di ${p.nRound}${cfg.ruolo ? ` · ${cfg.ruolo(p, ultimo, ctxA)}` : ''}`; }
      else if (ultimo.fase === 'pausaRound') { scritta = 'Fine round'; sotto = cfg.fineRound ? cfg.fineRound(p, ultimo, ctxA) : ''; }
      if (scritta === 'Fine round' && classificaRound(g, p, LW, LH, sotto)) scritta = '';
      if (scritta) {
        g.fillStyle = 'rgba(10,20,30,.55)'; g.fillRect(0, 0, LW, LH);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `400 ${scritta.length > 3 ? 64 : 120}px "Young Serif", Georgia, serif`; g.fillText(scritta, LW / 2, LH / 2 - 10);
        if (sotto) { g.font = '600 24px system-ui, sans-serif'; g.fillText(sotto, LW / 2, LH / 2 + 60); }
      }
    }
    requestAnimationFrame(disegna);
    // fine round con più giocatori: una piccola classifica del round (chi ha fatto di più, quanto, e il totale) al
    // posto della sola scritta «Punti totali». I punti del round sono la differenza tra gli ultimi due totali salvati.
    function classificaRound(g, p, LW, LH, sotto) {
      const st = p.storico || [];
      if (p.n < 2 || !st.length || st.length !== ultimo.round) return false;
      const ora = st[st.length - 1], prima = st[st.length - 2] || ora.map(() => 0);
      const righe = ora.map((x, i) => ({ i, piu: Math.round(x - prima[i]), tot: Math.round(x) })).sort((a, b) => b.piu - a.piu || b.tot - a.tot).slice(0, 8);
      const extra = sotto && !/^Punti totali/.test(sotto) ? sotto : '';
      // scritte in proporzione al campo, ma sul telefono (campo rimpicciolito) almeno leggibili, se ci stanno
      const scala = (tela.clientWidth || LW) / LW, unita = 64 + (extra ? 34 : 0) + righe.length * 34 + 24;
      const k = Math.min(Math.max(0.55, Math.min(1.25, Math.min(LW, LH) / 560), 0.68 / scala), (LH - 12) / unita, (LW - 12) / 460);
      const rH = 34 * k, titoloH = 64 * k;
      const alto = titoloH + (extra ? 34 * k : 0) + righe.length * rH + 24 * k, largo = Math.min(LW - 10, 460 * k);
      const x0 = (LW - largo) / 2, y0 = Math.max(6, (LH - alto) / 2);
      g.save();
      g.fillStyle = 'rgba(10,20,30,.55)'; g.fillRect(0, 0, LW, LH);
      g.fillStyle = 'rgba(12,22,34,.88)'; g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
      g.beginPath(); if (g.roundRect) g.roundRect(x0, y0, largo, alto, 16 * k); else g.rect(x0, y0, largo, alto); g.fill(); g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = `400 ${Math.round(38 * k)}px "Young Serif", Georgia, serif`;
      g.fillText(`Fine round ${ultimo.round}${p.nRound > 1 ? ` di ${p.nRound}` : ''}`, LW / 2, y0 + titoloH / 2 + 4 * k);
      let y = y0 + titoloH;
      if (extra) { g.font = `600 ${Math.round(20 * k)}px system-ui, sans-serif`; g.fillStyle = '#f2d27a'; g.fillText(extra, LW / 2, y + 12 * k); y += 34 * k; }
      const migliore = righe[0] && righe[0].piu;
      righe.forEach((r, n) => {
        const yy = y + n * rH + rH / 2;
        if (r.i === ctxA.mio) { g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x0 + 8 * k, yy - rH / 2 + 2, largo - 16 * k, rH - 4); }
        g.font = `700 ${Math.round(20 * k)}px system-ui, sans-serif`;
        g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(r.piu === migliore && migliore > 0 ? '🏆' : `${n + 1}.`, x0 + 18 * k, yy);
        g.fillStyle = COLORI[r.i % COLORI.length];
        const nome = r.i === ctxA.mio ? 'Tu' : ctxA.nome(r.i);
        g.fillText(nome.length > 14 ? `${nome.slice(0, 13)}…` : nome, x0 + 58 * k, yy);
        g.textAlign = 'right'; g.fillStyle = r.piu > 0 ? '#7fe0a0' : r.piu < 0 ? '#ff8a7a' : 'rgba(255,255,255,.6)';
        g.fillText(`${r.piu > 0 ? '+' : ''}${r.piu}`, x0 + largo - 110 * k, yy);
        g.font = `500 ${Math.round(16 * k)}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,.7)';
        g.fillText(`tot. ${r.tot}`, x0 + largo - 18 * k, yy);
      });
      g.restore();
      return true;
    }
    // i due aggiornamenti tra cui disegnare adesso (un attimo nel passato) e a che punto siamo tra i due
    function coppia() {
      if (scarto === null || scorta.length < 2 || window.__arenaVecchio) return [ultimo, prima, Math.min(1, (performance.now() - arrivo) / passoMs)];
      // l'attesa giusta: un intervallo tra due aggiornamenti più il ritardo che la rete supera solo 1 volta su 20;
      // sale subito quando la rete peggiora e scende piano quando migliora (così il movimento non accelera di colpo)
      const ord = ritardi.slice().sort((a, b) => a - b), p95 = ord.length ? ord[Math.floor(ord.length * 0.95)] : 30;
      const voluta = Math.max(60, Math.min(400, intervallo + p95 + 15));
      attesa = voluta > attesa ? attesa + Math.min(voluta - attesa, 4) : attesa - Math.min(attesa - voluta, 0.3);
      const rt = Date.now() - scarto - attesa;
      let i = scorta.length - 1; while (i > 0 && scorta[i].ts > rt) i--;
      if (i === scorta.length - 1) return [scorta[i].d, scorta[i - 1].d, 1];
      const a = scorta[i], b = scorta[i + 1];
      if (a.ts > rt) return [a.d, null, 1];
      return [b.d, a.d, Math.max(0, Math.min(1, (rt - a.ts) / Math.max(1, b.ts - a.ts)))];
    }
    function inScorta(d) {
      if (!d || !d.ts) { scorta = []; scarto = null; ritardi = []; return; }
      const ultimoS = scorta[scorta.length - 1];
      if (ultimoS && (ultimoS.d.round !== d.round || ultimoS.d.fase !== d.fase)) scorta = []; // round o fase nuova: si riparte
      if (ultimoS && d.ts <= ultimoS.ts) return;
      // l'orologio del server rispetto al nostro: la differenza più piccola vista di recente (quella senza ritardi)
      scarti.push(Date.now() - d.ts); if (scarti.length > 40) scarti.shift();
      scarto = Math.min(...scarti);
      ritardi.push(Date.now() - d.ts - scarto); if (ritardi.length > 80) ritardi.shift();
      if (ultimoS) intervallo = intervallo * 0.9 + Math.min(300, d.ts - ultimoS.ts) * 0.1;
      scorta.push({ ts: d.ts, d }); if (scorta.length > 14) scorta.shift();
    }

    return {
      libero: true,
      senzaFila: true,
      reset(ctx) {
        ctxA = ctx;
        if (!tela) preparaTela();
        // anche quando la partita va in pausa o riparte: durante la pausa il server non manda più i tick, quindi
        // senza questo restava sullo schermo l'ultimo numero del conto alla rovescia (sembrava bloccata sull'1)
        const st = ctx.partita.stato;
        if (!ultimo || ultimo.round !== st.round || ultimo.fase !== st.fase || !!ultimo.pausa !== !!st.pausa) { prima = null; ultimo = ctx.partita.stato; arrivo = performance.now(); inScorta(ultimo); }
      },
      tick(ctx, d) {
        ctxA = ctx;
        const ora = performance.now();
        passoMs = Math.max(20, Math.min(120, ora - arrivo));
        prima = ultimo && ultimo.round === d.round ? ultimo : null; ultimo = d; arrivo = ora;
        inScorta(d);
        ctx.partita.stato = d;
        if (cfg.dopoTick) cfg.dopoTick(ctx, d, prima);
        const st = document.getElementById('stato-turno');
        const testo = this.stato(ctx);
        if (st && testo && st.textContent !== testo) st.textContent = testo;
        const h = document.querySelector('.ar-hud');
        if (h && cfg.hud) { const html = cfg.hud(ctx, d); if (h._html !== html) { h._html = html; h.innerHTML = html; } }
        aggiornaSopra(ctx, d);
        // i giochi che hanno un valore del round in corso (monete, punti provvisori) lo mostrano in alto mentre si gioca
        if (cfg.delRound && Date.now() - (ctx.ui._puntiDal || 0) > 300) { ctx.ui._puntiDal = Date.now(); const el = document.getElementById('punteggio'); if (el) { const html = this.punteggio(ctx); if (el._html !== html) { el._html = html; el.innerHTML = html; } } }
      },
      panno(ctx) {
        const p = ctx.partita;
        return `<div class="ar">
          <p class="pa-round">Round ${p.stato.round} di ${p.nRound}${(cfg.sottotitolo && cfg.sottotitolo(p, ctx)) ? ` · ${cfg.sottotitolo(p, ctx)}` : ''}</p>
          <div class="ar-hud"></div>
          <div class="ar-box"><div class="ar-sopra"></div></div>
          ${comandiTouch()}
          ${touch() && p.W / p.H > 1.45 ? '<p class="piccolo ar-gira">📱 Gira il telefono in orizzontale: il campo diventa più grande</p>' : ''}
          <p class="piccolo ar-istr">${cfg.istruzioni(ctx)}</p>
        </div>`;
      },
      dopo(ctx) {
        const box = document.querySelector('.ar-box'); if (box && tela && tela.parentElement !== box) box.prepend(tela);
        const h = document.querySelector('.ar-hud'); if (h) h._html = null;
        const so = document.querySelector('.ar-sopra'); if (so) so._html = null;
        if (ctx && ultimo) aggiornaSopra(ctx, ultimo);
      },
      stato(ctx) {
        const p = ctx.partita, s = (ultimo || p.stato);
        if (p.finita) return null;
        if (s.pausa) return 'In pausa';
        if (s.fase === 'via') return 'Pronti…';
        if (s.fase === 'pausaRound') return 'Fine round';
        return cfg.statoGioco ? cfg.statoGioco(ctx, s) : 'Via!';
      },
      punteggio(ctx) {
        const p = ctx.partita;
        const s = ultimo || p.stato;
        const inRound = cfg.delRound && s && s.s && !p.finita && s.fase === 'gioco';
        const extra = (i) => { if (!inRound) return ''; const v = cfg.delRound(ctx, s, i); return v == null || v === '' ? '' : ` <small class="ar-round">${esc(String(v))}</small>`; };
        return p.punti.map((x, i) => `<span style="color:${COLORI[i % COLORI.length]}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b>${extra(i)}</span>`).join('') + `<span class="obiettivo">${esc(cfg.obiettivo || 'punti')}</span>`;
      },
      infoPosto(ctx, posto) { return `${ctx.partita.punti[posto]} punti`; },
      // i giochi con uno strato HTML sopra il canvas (cfg.sopra) ricevono i clic sui loro pulsanti [data-az]
      clic(ctx, el) { if (cfg.clic) cfg.clic(ctx, el); },
    };
    // strato HTML sopra il canvas (compiti, votazioni…): si ridisegna solo quando cambia
    function aggiornaSopra(ctx, d) {
      const so = document.querySelector('.ar-sopra');
      if (!so) return;
      const html = cfg.sopra ? cfg.sopra(ctx, d) || '' : '';
      if (so._html === html) return;
      so._html = html; so.innerHTML = html; so.hidden = !html;
      if (cfg.dopoSopra) cfg.dopoSopra(ctx, so);
    }
  }
  // disegni ricorrenti
  function omino(g, x, y, r, colore, nome, opz = {}) {
    g.save();
    g.globalAlpha = opz.alfa ?? 1;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = colore; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = opz.io ? 3 : 2; g.strokeStyle = opz.io ? '#fff' : 'rgba(0,0,0,.45)'; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2); g.arc(x + r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.18, r * 0.1, 0, Math.PI * 2); g.arc(x + r * 0.32, y - r * 0.18, r * 0.1, 0, Math.PI * 2); g.fill();
    if (nome) { g.fillStyle = opz.coloreNome || '#fff'; g.font = '600 13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.strokeText(nome, x, y - r - 6); g.fillText(nome, x, y - r - 6); }
    if (opz.stordito) { g.font = '16px system-ui'; g.fillText('💫', x, y - r - 20); }
    g.restore();
  }
  return { tavolo, lerp, COLORI, omino, touch };
})();
