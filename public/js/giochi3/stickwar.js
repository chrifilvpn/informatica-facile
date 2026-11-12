// STICK WAR: il campo è lungo tre schermi e si scorre (trascinando, con A/D o le frecce, con la rotella o
// dalla minimappa in alto). Paesaggio a strati che scorrono a velocità diverse (montagne lontane, colline, terreno),
// diverso per ogni livello; stickman disegnati a mano con le loro armi e le pose (camminata, colpo, scavo); frecce,
// palle di veleno, magie e lo sguardo di Medusa. Sopra il campo lo strato HTML con gli ordini, l'armeria e i
// pulsanti per addestrare (con la barra di avanzamento). Clic su un proprio soldato = lo si comanda a mano.
(() => {
  const ICONE = { minatore: '⛏️', spada: '🗡️', arciere: '🏹', lanciere: '🔱', mago: '🔮', gigante: '👹', zombi: '🧟', strisciante: '🕷️', morto: '☠️', cavaliere: '🪓', medusa: '🐍' };
  const ORDINI = [['difesa', '🛡️', 'Difesa'], ['tieni', '✋', 'Tieni'], ['attacco', '⚔️', 'Attacco']];
  const CAOS = new Set(['zombi', 'strisciante', 'morto', 'cavaliere', 'medusa']);
  const SCALA = { gigante: 2.2, medusa: 2.3, cavaliere: 1.25, lanciere: 1.05 };
  const SUOLO = 318, BASE = 352, FONDO = 92; // dove inizia il terreno, la riga più lontana delle unità e la profondità
  let ex = null, ctxD = null, cam = null, camVoluta = null, scena = null, armeria = false;
  let colpi = [], morti = [], scritte = [], colpiti = new Map(), botti = [], scossa = 0, ultimoT = 0;
  const tasti = new Set();
  let trascina = null;
  const ora = () => performance.now() / 1000;
  const suono = (n, o) => window.Nuovi && window.Nuovi.suono && window.Nuovi.suono(n, o);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const attivo = () => ctxD && ctxD.partita && ctxD.partita.gioco === 'stickwar' && !ctxD.partita.finita && document.querySelector('.panno-stickwar');
  const ultimo = () => ctxD && ctxD.partita && ctxD.partita.stato && ctxD.partita.stato.s;
  const mioLato = () => (ex && ctxD ? ex.lati[ctxD.mio] || 0 : 0);
  const yDi = (z) => BASE + z * FONDO;
  const scalaDi = (tipo, z) => (SCALA[tipo] || 1) * (1.2 + z * 0.3);
  // larghezza della parte di campo che si vede: sul telefono in verticale se ne vede meno ma tutto più grande
  // (il campo intero è largo 960 e alto 540: in verticale diventava una striscia bassa)
  const verticale = () => window.Arena.touch() && window.innerHeight > window.innerWidth;
  const VW = () => (ex && verticale() ? Math.round(ex.W * 0.6) : ex ? ex.W : 960);
  const limCam = (x) => Math.max(0, Math.min(ex.L - VW(), x));
  const accento = (tipo, lato) => (CAOS.has(tipo) || (ex && ex.caos && lato === 1) ? '#a855f7' : lato ? '#e0453a' : '#f2c230');

  // ---------- comandi: scorrere il campo, scegliere un soldato ----------
  function suTela(e) { const t = e.target; return t && t.classList && t.classList.contains('ar-tela') ? t : null; }
  function mondo(e, tela) { const r = tela.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * VW(), ((e.clientY - r.top) / r.height) * ex.H]; }
  document.addEventListener('pointerdown', (e) => {
    if (!attivo() || !ex || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const b = e.target.closest && e.target.closest('[data-sw-dir]');
    if (b) { e.preventDefault(); ctxD.invia({ tipo: 'muovi', dir: Number(b.dataset.swDir) }); b.classList.add('sw-giu'); return; }
    const tela = suTela(e); if (!tela) return;
    const [x, y] = mondo(e, tela);
    // la minimappa: si salta lì
    if (y < 40 && x > mm.x && x < mm.x + mm.w) { camVoluta = limCam(((x - mm.x) / mm.w) * ex.L - VW() / 2); return; }
    trascina = { x0: e.clientX, cam0: cam, mosso: false, x, y, id: e.pointerId, tela };
  });
  document.addEventListener('pointermove', (e) => {
    if (!trascina || trascina.id !== e.pointerId) return;
    const r = trascina.tela.getBoundingClientRect(), dx = ((e.clientX - trascina.x0) / r.width) * VW();
    if (Math.abs(dx) > 6) trascina.mosso = true;
    if (trascina.mosso) { cam = camVoluta = limCam(trascina.cam0 - dx); }
  });
  const lascia = (e) => {
    const b = document.querySelector('.sw-giu');
    if (b && attivo()) { b.classList.remove('sw-giu'); ctxD.invia({ tipo: 'muovi', dir: 0 }); }
    if (!trascina || trascina.id !== e.pointerId) return;
    const t = trascina; trascina = null;
    if (!t.mosso && attivo()) scegli(t.x, t.y);
  };
  document.addEventListener('pointerup', lascia);
  document.addEventListener('pointercancel', lascia);
  document.addEventListener('wheel', (e) => { if (attivo() && ex && suTela(e)) { e.preventDefault(); camVoluta = limCam((camVoluta ?? cam) + (e.deltaX || e.deltaY)); } }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (!attivo() || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    const k = e.key.toLowerCase();
    if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) tasti.add(k);
    if (k === 'escape' && mioComando()) ctxD.invia({ tipo: 'lascia' });
    // scorciatoie: 1-6 addestrano, Q/W/E danno gli ordini
    const s = ultimo();
    if (s && /^[1-6]$/.test(k) && !e.repeat) { const t = s.es[mioLato()].tipi[Number(k) - 1]; if (t) ctxD.invia({ tipo: 'addestra', unita: t }); }
    const o = { q: 'difesa', w: 'tieni', e: 'attacco' }[k];
    if (o && !e.repeat && !mioComando()) ctxD.invia({ tipo: 'ordine', quale: o });
  });
  document.addEventListener('keyup', (e) => tasti.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => tasti.clear());
  const mioComando = () => { const s = ultimo(); return s && ctxD ? s.cm[ctxD.mio] : null; };
  // il soldato sotto il dito o il mouse (il più vicino tra quelli dell'esercito)
  function scegli(x, y) {
    const s = ultimo(); if (!s) return;
    const wx = x + cam;
    let best = null, bd = Infinity;
    for (const u of s.u) {
      if (u[2] !== mioLato() || u[1] === 'minatore') continue;
      const sc = scalaDi(u[1], u[4]), uy = yDi(u[4]);
      const d = Math.abs(u[3] - wx) / (14 * sc) + Math.max(0, Math.abs(uy - 22 * sc - y) - 26 * sc) / (20 * sc);
      if (d < 1.6 && d < bd) { bd = d; best = u; }
    }
    if (best) { ctxD.invia({ tipo: 'controlla', id: best[0] }); suono([[520, 0.04], [780, 0.06]], { volume: 0.04 }); }
  }

  // ---------- i paesaggi ----------
  const SCENE = {
    prato: { cielo: ['#7cc3f0', '#d8f0ff'], lontano: '#8fa9c4', colline: '#5f9a4a', suolo: ['#6aa84f', '#4f7f39'], sole: '#fff6c2' },
    bosco: { cielo: ['#8fc6d9', '#e3f3e8'], lontano: '#6f8f7c', colline: '#2f6b3a', suolo: ['#4d7d36', '#355a26'], alberi: true, sole: '#fff8d0' },
    colline: { cielo: ['#9cc9ef', '#f3f0d8'], lontano: '#a7b39a', colline: '#a3a95a', suolo: ['#9aa84f', '#7a8a3c'], sole: '#fff0b0' },
    deserto: { cielo: ['#f0a95a', '#fbe3b0'], lontano: '#c98c5a', colline: '#d9a663', suolo: ['#e2c07e', '#c9a160'], cactus: true, sole: '#fff3c4' },
    neve: { cielo: ['#a9c3d9', '#eef4fa'], lontano: '#c2cfdd', colline: '#e8eef5', suolo: ['#f4f8fc', '#d5e0ea'], neve: true, sole: '#ffffff' },
    palude: { cielo: ['#2d2a3e', '#55607a'], lontano: '#3b4253', colline: '#2f3d33', suolo: ['#3c4c34', '#2a3626'], nebbia: true, luna: true },
    tramonto: { cielo: ['#e66a5a', '#fbc27a'], lontano: '#9a5a6e', colline: '#6d4a5c', suolo: ['#7a6a4a', '#5e5038'], sole: '#ffd27a' },
    notte: { cielo: ['#0e1430', '#2d3a66'], lontano: '#232c4c', colline: '#1d2a3a', suolo: ['#2f3d3a', '#1f2a28'], luna: true, stelle: true },
    cimitero: { cielo: ['#141a2e', '#3a3f5c'], lontano: '#262b40', colline: '#232b2a', suolo: ['#3a4434', '#262e22'], luna: true, stelle: true, tombe: true, nebbia: true },
  };
  // numeri "a caso" sempre uguali (così il paesaggio non cambia a ogni partita)
  const rnd = (k) => ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;
  function preparaScena() {
    const S = SCENE[ex.scena] || SCENE.prato, W = ex.W, H = ex.H, L = ex.L;
    const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    // il cielo (fermo)
    const [cielo, gc] = tela(W, SUOLO + 10);
    const gr = gc.createLinearGradient(0, 0, 0, SUOLO); gr.addColorStop(0, S.cielo[0]); gr.addColorStop(1, S.cielo[1]);
    gc.fillStyle = gr; gc.fillRect(0, 0, W, SUOLO + 10);
    if (S.stelle) for (let k = 0; k < 90; k++) { gc.fillStyle = `rgba(255,255,255,${0.3 + rnd(k) * 0.6})`; gc.fillRect(rnd(k + 1) * W, rnd(k + 2) * 200, 1.5, 1.5); }
    if (S.luna) { gc.fillStyle = '#f4f1dc'; gc.shadowColor = '#f4f1dc'; gc.shadowBlur = 30; gc.beginPath(); gc.arc(W * 0.78, 70, 26, 0, Math.PI * 2); gc.fill(); gc.shadowBlur = 0; gc.fillStyle = 'rgba(0,0,0,.08)'; gc.beginPath(); gc.arc(W * 0.78 - 8, 64, 6, 0, Math.PI * 2); gc.arc(W * 0.78 + 7, 78, 4, 0, Math.PI * 2); gc.fill(); }
    if (S.sole) { const sg = gc.createRadialGradient(W * 0.2, 80, 5, W * 0.2, 80, 90); sg.addColorStop(0, S.sole); sg.addColorStop(0.3, S.sole); sg.addColorStop(1, 'rgba(255,255,255,0)'); gc.fillStyle = sg; gc.fillRect(0, 0, W, 220); }
    if (!S.stelle) for (let k = 0; k < 6; k++) { const x = rnd(k + 9) * W, y = 40 + rnd(k + 19) * 90; gc.fillStyle = 'rgba(255,255,255,.55)'; for (let j = 0; j < 4; j++) { gc.beginPath(); gc.ellipse(x + j * 18, y + (j % 2) * -6, 22, 11, 0, 0, Math.PI * 2); gc.fill(); } }
    // le montagne lontane (scorrono piano)
    const lw = Math.ceil(W + (L - W) * 0.25);
    const [lontano, gl] = tela(lw, SUOLO + 10);
    gl.fillStyle = S.lontano; gl.beginPath(); gl.moveTo(0, SUOLO + 10);
    for (let x = 0; x <= lw; x += 40) gl.lineTo(x, 190 + Math.sin(x * 0.011) * 40 + Math.sin(x * 0.037) * 18 + rnd(x) * 10);
    gl.lineTo(lw, SUOLO + 10); gl.fill();
    if (S.neve || ex.scena === 'colline') { gl.fillStyle = 'rgba(255,255,255,.7)'; for (let x = 0; x <= lw; x += 40) { const y = 190 + Math.sin(x * 0.011) * 40 + Math.sin(x * 0.037) * 18 + rnd(x) * 10; if (y < 175) { gl.beginPath(); gl.moveTo(x - 14, y + 12); gl.lineTo(x, y); gl.lineTo(x + 14, y + 12); gl.fill(); } } }
    // le colline (a metà velocità) con alberi o cactus
    const cw = Math.ceil(W + (L - W) * 0.6);
    const [colline, gh] = tela(cw, SUOLO + 10);
    gh.fillStyle = S.colline; gh.beginPath(); gh.moveTo(0, SUOLO + 10);
    for (let x = 0; x <= cw; x += 20) gh.lineTo(x, 262 + Math.sin(x * 0.006) * 22 + Math.sin(x * 0.019) * 9);
    gh.lineTo(cw, SUOLO + 10); gh.fill();
    for (let k = 0; k < cw / 70; k++) {
      const x = k * 70 + rnd(k) * 50, y = 266 + Math.sin(x * 0.006) * 22 + Math.sin(x * 0.019) * 9;
      if (S.alberi || (!S.cactus && !S.tombe && rnd(k + 3) < 0.35)) {
        gh.fillStyle = '#4a3a24'; gh.fillRect(x - 2, y - 14, 4, 16);
        gh.fillStyle = S.neve ? '#e2ebf3' : S.luna ? '#1f3326' : '#2e5a2a'; gh.beginPath(); gh.moveTo(x - 13, y - 8); gh.lineTo(x, y - 40 - rnd(k + 5) * 14); gh.lineTo(x + 13, y - 8); gh.fill();
      } else if (S.cactus && rnd(k + 3) < 0.5) {
        gh.fillStyle = '#5c8a3a'; gh.fillRect(x - 3, y - 26, 6, 28); gh.fillRect(x - 10, y - 18, 4, 10); gh.fillRect(x - 10, y - 12, 8, 4); gh.fillRect(x + 6, y - 22, 4, 10); gh.fillRect(x + 2, y - 15, 8, 4);
      } else if (S.tombe && rnd(k + 3) < 0.6) {
        gh.fillStyle = '#4b5060'; gh.beginPath(); gh.moveTo(x - 7, y + 2); gh.lineTo(x - 7, y - 12); gh.arc(x, y - 12, 7, Math.PI, 0); gh.lineTo(x + 7, y + 2); gh.fill();
      }
    }
    // il terreno (scorre con il campo): erba, sassi, miniere d'oro
    const [suolo, gs] = tela(L, H - SUOLO + 10);
    const gg = gs.createLinearGradient(0, 0, 0, H - SUOLO); gg.addColorStop(0, S.suolo[0]); gg.addColorStop(1, S.suolo[1]);
    gs.fillStyle = gg; gs.fillRect(0, 0, L, H - SUOLO + 10);
    gs.fillStyle = 'rgba(0,0,0,.12)'; gs.fillRect(0, 0, L, 4);
    for (let k = 0; k < L / 9; k++) {
      const x = rnd(k + 0.5) * L, y = 6 + rnd(k + 0.7) * (H - SUOLO - 10);
      gs.fillStyle = k % 9 === 0 ? 'rgba(120,110,100,.45)' : k % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)';
      gs.beginPath(); gs.ellipse(x, y, k % 9 === 0 ? 4 : 2 + (k % 4), k % 9 === 0 ? 2.5 : 1.5, 0, 0, Math.PI * 2); gs.fill();
    }
    if (!S.neve && !S.cactus) for (let k = 0; k < L / 6; k++) { const x = rnd(k + 0.2) * L, y = 8 + rnd(k + 0.9) * (H - SUOLO - 12); gs.strokeStyle = 'rgba(30,60,20,.35)'; gs.lineWidth = 1; gs.beginPath(); gs.moveTo(x, y); gs.lineTo(x - 2, y - 5); gs.moveTo(x, y); gs.lineTo(x + 2, y - 5); gs.stroke(); }
    // le miniere d'oro: rocce scure con le pepite
    for (const lato of [0, 1]) for (const f of ex.miniere) {
      if (lato === 1 && ex.modo === 'nonmorti') continue;
      const x = lato ? ex.L - ex.STATUA - f : ex.STATUA + f, y = 24;
      gs.fillStyle = 'rgba(0,0,0,.25)'; gs.beginPath(); gs.ellipse(x, y + 16, 34, 8, 0, 0, Math.PI * 2); gs.fill();
      gs.fillStyle = '#5b5148'; gs.beginPath(); gs.moveTo(x - 32, y + 14); gs.lineTo(x - 22, y - 10); gs.lineTo(x - 4, y - 20); gs.lineTo(x + 18, y - 12); gs.lineTo(x + 32, y + 14); gs.fill();
      gs.fillStyle = '#6f6458'; gs.beginPath(); gs.moveTo(x - 22, y - 10); gs.lineTo(x - 4, y - 20); gs.lineTo(x + 4, y - 4); gs.lineTo(x - 14, y + 2); gs.fill();
      for (let k = 0; k < 9; k++) { gs.fillStyle = k % 3 ? '#f5c518' : '#ffe680'; gs.beginPath(); gs.arc(x - 22 + rnd(k + f) * 44, y - 10 + rnd(k + f + 1) * 22, 2 + rnd(k) * 2.5, 0, Math.PI * 2); gs.fill(); }
    }
    scena = { cielo, lontano, colline, suolo, S, nome: ex.scena, fiocchi: Array.from({ length: S.neve ? 70 : 0 }, (_, k) => [rnd(k + 0.11) * W, rnd(k + 0.31) * H, 0.6 + rnd(k) * 1.6]) };
  }

  // ---------- gli stickman ----------
  // un braccio o una gamba in due pezzi
  const seg = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
  const pol = (a, l, x = 0, y = 0) => [x + Math.cos(a) * l, y + Math.sin(a) * l];
  // a che punto è il colpo: 0 = carica, 1 = colpo finito (dura 0,45 s)
  const fase = (dt) => (dt === null || dt > 0.45 ? null : dt / 0.45);
  function stickman(g, u, x, y, adesso) {
    const [id, tipo, lato, , z, vita, stato, verso, chi, oro, lento] = u;
    const s = scalaDi(tipo, z), acc = accento(tipo, lato);
    const at = colpiti.has(id) ? adesso - colpiti.get(id) : null, f = fase(at);
    const cammina = stato === 'c', ph = (adesso * (tipo === 'strisciante' ? 16 : tipo === 'gigante' || tipo === 'medusa' ? 5 : 9) + id) % (Math.PI * 2);
    // l'ombra
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + 1, 12 * s, 3.2 * s, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, y); g.scale(verso * s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // l'Order è nero, l'esercito di destra rosso scuro, il Chaos coi suoi colori
    const nero = CAOS.has(tipo) ? { zombi: '#3e5a3a', morto: '#33503a', strisciante: '#2b2236', cavaliere: '#262a33', medusa: '#2f4a33' }[tipo] : lato ? '#4a1512' : '#141414';
    g.strokeStyle = nero; g.fillStyle = nero; g.lineWidth = tipo === 'gigante' ? 3.4 : tipo === 'cavaliere' ? 3.2 : 2.7;
    if (tipo === 'strisciante') strisciante(g, ph, cammina, f, acc);
    else if (tipo === 'medusa') medusa(g, ph, f, adesso, id);
    else corpo(g, u, acc, f, ph, cammina, adesso);
    g.restore();
    if (lento) { g.fillStyle = 'rgba(150,160,150,.35)'; g.beginPath(); g.ellipse(x, y - 22 * s, 11 * s, 24 * s, 0, 0, Math.PI * 2); g.fill(); }
    // vita e comandato
    if (vita < 100) { const w = 22 * Math.min(1.8, s); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - w / 2, y - 52 * s, w, 3.5); g.fillStyle = vita > 50 ? '#5fd35f' : vita > 25 ? '#f2c230' : '#e8453c'; g.fillRect(x - w / 2, y - 52 * s, (w * vita) / 100, 3.5); }
    if (chi >= 0) {
      const io = chi === ctxD.mio, yy = y - 60 * s + Math.sin(adesso * 5) * 2;
      g.fillStyle = io ? '#ffd23f' : '#fff'; g.beginPath(); g.moveTo(x - 6, yy - 8); g.lineTo(x + 6, yy - 8); g.lineTo(x, yy); g.fill();
      g.strokeStyle = io ? 'rgba(255,210,63,.8)' : 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 1, 15 * s, 4.5 * s, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  // il corpo dritto (tutti tranne lo strisciante e Medusa) con la sua arma
  function corpo(g, u, acc, f, ph, cammina, adesso) {
    const [id, tipo, , , , , stato, , , oro] = u, nero = g.strokeStyle;
    const respiro = Math.sin(adesso * 2 + id) * 0.6;
    const curvo = tipo === 'zombi' || tipo === 'morto' ? 5 : 0;
    const anca = [0, -18], collo = [2 + curvo + (cammina ? 1.5 : 0), -33 + respiro + curvo * 0.4], testa = [collo[0] + 1.5, collo[1] - 6.5];
    // le gambe
    const passo = cammina ? Math.sin(ph) * (tipo === 'zombi' ? 0.35 : 0.55) : 0.12;
    for (const k of [1, -1]) { const a = Math.PI / 2 - passo * k; const gin = pol(a + 0.25 * Math.max(0, k * Math.sin(ph)), 9.5, anca[0], anca[1]); seg(g, [anca, gin, pol(a, 9.5, gin[0], gin[1])]); }
    seg(g, [anca, collo]);
    // la testa
    g.beginPath(); g.arc(testa[0], testa[1], 5.4, 0, Math.PI * 2); g.fill();
    const spalla = [collo[0] - 0.5, collo[1] + 3];
    const arma = ARMI[tipo] || ARMI.spada;
    arma(g, { spalla, testa, f, ph, cammina, acc, oro, stato, adesso, id, nero });
    if (CAOS.has(tipo)) { g.fillStyle = tipo === 'cavaliere' ? '#ff3b30' : '#c6ff6b'; g.beginPath(); g.arc(testa[0] + 2.5, testa[1] - 1, 1.2, 0, Math.PI * 2); g.fill(); }
  }
  // braccio con l'angolo a (0 = avanti, positivo = in giù) e il gomito un po' piegato
  const braccio = (g, sp, a, l = 12, pieg = 0.4) => { const go = pol(a + pieg, l / 2, sp[0], sp[1]), m = pol(a - pieg * 0.5, l / 2, go[0], go[1]); seg(g, [sp, go, m]); return m; };
  // dal riposo alla carica e al colpo
  const swing = (f, riposo, carica, colpo) => (f === null ? riposo : f < 0.45 ? riposo + (carica - riposo) * Math.sin((f / 0.45) * Math.PI / 2) : f < 0.65 ? carica + (colpo - carica) * ((f - 0.45) / 0.2) : colpo + (riposo - colpo) * ((f - 0.65) / 0.35));
  const ARMI = {
    spada(g, o) {
      const { spalla, f, ph, cammina, acc, testa } = o;
      braccio(g, spalla, 2.2 + (cammina ? Math.sin(ph) * 0.4 : 0));
      const a = swing(f, 0.7, -2.3, 1.0), m = braccio(g, spalla, a);
      const b = a - 1.3, punta = pol(b, 20, m[0], m[1]);
      g.save(); g.strokeStyle = '#d9dee4'; g.lineWidth = 2.4; seg(g, [m, punta]); g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; seg(g, [pol(b + Math.PI / 2, 3.5, m[0], m[1]), pol(b - Math.PI / 2, 3.5, m[0], m[1])]); g.restore();
      if (f !== null && f > 0.45 && f < 0.7) { g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(spalla[0], spalla[1], 26, -1.6, 0.9); g.stroke(); g.restore(); }
      // la fascia sulla fronte
      g.save(); g.strokeStyle = acc; g.lineWidth = 2; seg(g, [[testa[0] - 5, testa[1] - 2], [testa[0] + 5, testa[1] - 2]]); seg(g, [[testa[0] - 5, testa[1] - 2], [testa[0] - 10, testa[1] + 2 + Math.sin(o.adesso * 8) * 1.5]]); g.restore();
    },
    arciere(g, o) {
      const { spalla, f, acc, testa } = o;
      const tira = f === null ? 0 : f < 0.6 ? f / 0.6 : 0;
      const m = braccio(g, spalla, -0.15, 13, 0.1);
      const d = braccio(g, spalla, Math.PI - 0.1, 4 + 6 * (1 - tira), -0.3);
      g.save(); g.strokeStyle = '#7a4e22'; g.lineWidth = 2.2; g.beginPath(); g.arc(m[0] - 7, m[1], 12, -1.15, 1.15); g.stroke();
      const t1 = pol(-1.15, 12, m[0] - 7, m[1]), t2 = pol(1.15, 12, m[0] - 7, m[1]), corda = [Math.min(m[0] - 3, d[0]), d[1]];
      g.strokeStyle = 'rgba(240,240,240,.9)'; g.lineWidth = 0.8; seg(g, [t1, corda, t2]);
      if (f === null || f < 0.6) { g.strokeStyle = '#5a3a1a'; g.lineWidth = 1.4; seg(g, [corda, [m[0] + 6, m[1]]]); }
      // la faretra con le piume del colore dell'esercito
      g.fillStyle = '#6b4a2a'; g.fillRect(-9, testa[1] + 9, 4, 13); g.fillStyle = acc; g.fillRect(-10, testa[1] + 6, 6, 3);
      g.restore();
    },
    lanciere(g, o) {
      const { spalla, f, acc, testa } = o;
      const avanti = f === null ? 0 : f < 0.4 ? -4 * (f / 0.4) : f < 0.6 ? -4 + 14 * ((f - 0.4) / 0.2) : 10 * (1 - (f - 0.6) / 0.4);
      const m = braccio(g, spalla, 0.4, 11, 0.6);
      g.save(); g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.2; seg(g, [[m[0] - 18 + avanti, m[1] + 2], [m[0] + 18 + avanti, m[1] - 2]]);
      g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(m[0] + 18 + avanti, m[1] - 5); g.lineTo(m[0] + 27 + avanti, m[1] - 2.5); g.lineTo(m[0] + 18 + avanti, m[1] + 1); g.fill();
      // l'elmo con la cresta
      g.fillStyle = '#b08d57'; g.beginPath(); g.arc(testa[0], testa[1], 6.3, Math.PI, 0); g.fill(); g.fillRect(testa[0] - 6.3, testa[1] - 1, 3, 6);
      g.fillStyle = acc; g.beginPath(); g.moveTo(testa[0] - 7, testa[1] - 5); g.quadraticCurveTo(testa[0], testa[1] - 15, testa[0] + 5, testa[1] - 6); g.lineTo(testa[0] + 1, testa[1] - 5); g.fill();
      // lo scudo rotondo davanti
      g.fillStyle = '#b08d57'; g.strokeStyle = acc; g.lineWidth = 1.8; g.beginPath(); g.ellipse(spalla[0] + 8, spalla[1] + 7, 4.5, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = acc; g.beginPath(); g.arc(spalla[0] + 9, spalla[1] + 7, 1.8, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    mago(g, o) {
      const { spalla, f, acc, testa, adesso, id } = o;
      // la tunica e il cappello a punta
      g.save(); g.fillStyle = '#2a2140'; g.beginPath(); g.moveTo(spalla[0] - 2, spalla[1] - 1); g.lineTo(-8, 0); g.lineTo(9, 0); g.lineTo(spalla[0] + 3, spalla[1] - 1); g.fill();
      g.strokeStyle = acc; g.lineWidth = 1.5; seg(g, [[-8, -1], [9, -1]]);
      g.fillStyle = '#2a2140'; g.beginPath(); g.moveTo(testa[0] - 8, testa[1] - 3); g.lineTo(testa[0] + 8, testa[1] - 3); g.lineTo(testa[0] - 4, testa[1] - 20); g.fill();
      g.fillStyle = acc; g.fillRect(testa[0] - 6, testa[1] - 5, 12, 2);
      g.restore();
      const a = swing(f, 0.5, -1.2, -0.6), m = braccio(g, spalla, a, 12, 0.2);
      g.save(); g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; seg(g, [[m[0], m[1] + 14], [m[0], m[1] - 16]]);
      const r = 3.5 + (f !== null && f > 0.3 && f < 0.75 ? 4 : Math.sin(adesso * 4 + id) * 0.8);
      const gl = g.createRadialGradient(m[0], m[1] - 18, 0, m[0], m[1] - 18, r * 2.4); gl.addColorStop(0, '#fff'); gl.addColorStop(0.35, '#b78cff'); gl.addColorStop(1, 'rgba(150,90,255,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(m[0], m[1] - 18, r * 2.4, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    minatore(g, o) {
      const { spalla, f, ph, cammina, oro, stato, adesso, id, testa } = o;
      const scava = stato === 'm' ? Math.sin(adesso * 6 + id) : null;
      braccio(g, spalla, 1.9);
      const a = scava !== null ? -1.6 + (scava + 1) * 1.05 : swing(f, 0.9 + (cammina ? Math.sin(ph) * 0.3 : 0), -2, 0.9);
      const m = braccio(g, spalla, a, 11, 0.2), b = a - 1.5, cima = pol(b, 15, m[0], m[1]);
      g.save(); g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; seg(g, [m, cima]);
      g.strokeStyle = '#8d939a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(...pol(b + 1.4, 7, cima[0], cima[1])); g.quadraticCurveTo(cima[0] + Math.cos(b) * 2, cima[1] + Math.sin(b) * 2, ...pol(b - 1.4, 7, cima[0], cima[1])); g.stroke();
      // l'elmetto con la lampada e il sacco d'oro
      g.fillStyle = o.acc; g.beginPath(); g.arc(testa[0], testa[1] - 1, 5.8, Math.PI, 0); g.fill(); g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(testa[0] + 4, testa[1] - 4, 1.5, 0, Math.PI * 2); g.fill();
      if (oro) { g.fillStyle = '#c9a227'; g.beginPath(); g.arc(-7, spalla[1] + 2, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe066'; g.beginPath(); g.arc(-8, spalla[1] - 2, 2.2, 0, Math.PI * 2); g.fill(); }
      g.restore();
    },
    gigante(g, o) {
      const { spalla, f, ph, cammina, acc } = o;
      braccio(g, spalla, 1.8 + (cammina ? Math.sin(ph) * 0.3 : 0), 13);
      const a = swing(f, 0.9, -2.6, 1.2), m = braccio(g, spalla, a, 13, 0.25), b = a - 1.1, cima = pol(b, 18, m[0], m[1]);
      g.save(); g.strokeStyle = '#6b4a2a'; g.lineWidth = 4.5; seg(g, [m, cima]); g.fillStyle = '#5a3c20'; g.beginPath(); g.arc(cima[0], cima[1], 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#cfc4b0'; for (let k = 0; k < 4; k++) { const p = pol(b + k * 1.6, 5.5, cima[0], cima[1]); g.beginPath(); g.arc(p[0], p[1], 1.4, 0, Math.PI * 2); g.fill(); }
      // la cintura
      g.strokeStyle = acc; g.lineWidth = 2.5; seg(g, [[-3, -19], [5, -21]]);
      g.restore();
    },
    zombi(g, o) {
      const { spalla, f, ph } = o;
      const a = swing(f, -0.15 + Math.sin(ph) * 0.08, -0.6, 0.4);
      braccio(g, spalla, a, 12, 0.05); braccio(g, spalla, a + 0.25, 11, 0.05);
      g.save(); g.fillStyle = 'rgba(120,20,20,.6)'; g.fillRect(spalla[0] - 2, spalla[1] + 4, 3, 3); g.restore();
    },
    morto(g, o) {
      const { spalla, f, ph } = o;
      braccio(g, spalla, 0.1 + Math.sin(ph) * 0.1, 11, 0.1);
      const a = swing(f, 1.3, -2.4, -0.2), m = braccio(g, spalla, a, 12, 0.2);
      if (f === null || f < 0.55) { g.save(); g.fillStyle = '#9dff5c'; g.shadowColor = '#9dff5c'; g.shadowBlur = 8; g.beginPath(); g.arc(m[0], m[1], 3, 0, Math.PI * 2); g.fill(); g.restore(); }
    },
    cavaliere(g, o) {
      const { spalla, f, testa, acc } = o;
      g.save(); g.fillStyle = '#3b4250'; g.beginPath(); g.arc(testa[0], testa[1], 6.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#cfd6dd'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(testa[0] - 4, testa[1] - 4); g.quadraticCurveTo(testa[0] - 12, testa[1] - 8, testa[0] - 9, testa[1] - 15); g.moveTo(testa[0] + 4, testa[1] - 4); g.quadraticCurveTo(testa[0] + 12, testa[1] - 8, testa[0] + 9, testa[1] - 15); g.stroke();
      g.fillStyle = '#3b4250'; g.fillRect(-4, spalla[1] - 1, 9, 14);
      g.restore();
      const a = swing(f, 0.6, -2.4, 1.1), m = braccio(g, spalla, a, 12, 0.3), b = a - 1.2, cima = pol(b, 22, m[0], m[1]);
      g.save(); g.strokeStyle = '#4a3a2a'; g.lineWidth = 2.4; seg(g, [m, cima]);
      g.fillStyle = '#9aa3ad'; g.beginPath(); g.moveTo(...pol(b, -2, cima[0], cima[1])); g.lineTo(...pol(b + 1.57, 9, cima[0], cima[1])); g.lineTo(...pol(b, 6, cima[0], cima[1])); g.fill();
      g.strokeStyle = acc; g.lineWidth = 1.2; seg(g, [pol(b, -2, cima[0], cima[1]), pol(b + 1.57, 9, cima[0], cima[1])]);
      g.restore();
    },
  };
  function strisciante(g, ph, cammina, f, acc) {
    const b = cammina ? Math.sin(ph) * 2 : 0, salto = f !== null && f > 0.3 && f < 0.8 ? -6 : 0;
    const anca = [-9, -10 + salto], spalla = [8, -12 + b * 0.3 + salto], testa = [15, -14 + salto];
    seg(g, [anca, spalla]);
    for (const [p, k] of [[anca, 0], [spalla, Math.PI]]) for (const s of [1, -1]) { const a = Math.sin(ph + k + (s > 0 ? 0 : Math.PI)) * 0.6; const gin = [p[0] + Math.sin(a) * 6 + 2, p[1] - 3]; seg(g, [p, gin, [p[0] + Math.sin(a) * 9, 0]]); }
    g.beginPath(); g.arc(testa[0], testa[1], 4.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(testa[0] + 2, testa[1] - 1, 1.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = acc; g.lineWidth = 1.2; for (const k of [0, 1, 2]) seg(g, [[anca[0] + k * 5, anca[1] - 1], [anca[0] + k * 5 - 2, anca[1] - 6]]);
  }
  function medusa(g, ph, f, adesso, id) {
    // la coda di serpente, il busto, i capelli di serpenti e gli occhi che pietrificano
    g.save();
    g.lineWidth = 6; g.strokeStyle = '#3f6b3a'; g.beginPath(); g.moveTo(0, -16);
    for (let k = 1; k <= 8; k++) g.lineTo(-k * 3.2, -16 + k * 2 + Math.sin(ph + k * 0.8) * 1.5);
    g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#2f4a33';
    seg(g, [[0, -16], [2, -34]]);
    g.fillStyle = '#7da86e'; g.beginPath(); g.arc(3, -40, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4c8a43'; g.lineWidth = 1.4;
    for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.38; g.beginPath(); g.moveTo(...pol(a, 4.5, 3, -40)); const p = pol(a, 11, 3, -40); g.quadraticCurveTo(p[0] + Math.sin(adesso * 6 + k + id) * 3, p[1] + Math.cos(adesso * 6 + k) * 3, ...pol(a + 0.15, 14, 3, -40)); g.stroke(); }
    g.strokeStyle = '#2f4a33'; g.lineWidth = 2.4; braccio(g, [2, -31], f !== null && f < 0.7 ? -0.6 : 0.8, 11, 0.3); braccio(g, [2, -31], 1.6, 10, 0.3);
    const brilla = f !== null && f > 0.2 && f < 0.8;
    g.fillStyle = brilla ? '#eaff8a' : '#b8ff5c'; g.shadowColor = '#b8ff5c'; g.shadowBlur = brilla ? 14 : 4;
    g.beginPath(); g.arc(5.5, -41, brilla ? 1.8 : 1.1, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // una statua: l'Order (pietra con l'oro), la nazione nemica (pietra rossa) o il Chaos (obelisco viola)
  function statua(g, lato, es, adesso) {
    const x = (lato ? ex.L - ex.STATUA : ex.STATUA) - cam, y = BASE + 40;
    if (x < -160 || x > VW() + 160) return;
    const caos = ex.caos && lato === 1, d = 1 - es.st / es.max, verso = lato ? -1 : 1;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 6, 70, 14, 0, 0, Math.PI * 2); g.fill();
    if (caos) {
      const gr = g.createLinearGradient(x - 30, 0, x + 30, 0); gr.addColorStop(0, '#1b1426'); gr.addColorStop(0.5, '#3a2a52'); gr.addColorStop(1, '#1b1426');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 34, y); g.lineTo(x - 18, y - 170); g.lineTo(x, y - 200); g.lineTo(x + 18, y - 170); g.lineTo(x + 34, y); g.fill();
      const pulsa = 0.6 + Math.sin(adesso * 3) * 0.3;
      g.fillStyle = `rgba(190,110,255,${pulsa})`; g.shadowColor = '#b46bff'; g.shadowBlur = 20; g.beginPath(); g.moveTo(x, y - 150); g.lineTo(x + 8, y - 128); g.lineTo(x, y - 106); g.lineTo(x - 8, y - 128); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(190,110,255,.5)'; g.lineWidth = 1.5; for (const k of [0, 1, 2]) seg(g, [[x - 20 + k * 20, y - 20], [x - 14 + k * 14, y - 90]]);
    } else {
      // il piedistallo
      g.fillStyle = '#8f8a80'; g.fillRect(x - 52, y - 40, 104, 40); g.fillStyle = '#a7a196'; g.fillRect(x - 58, y - 48, 116, 10); g.fillRect(x - 46, y - 8, 92, 8);
      g.fillStyle = lato ? '#e0453a' : '#f2c230'; g.fillRect(x - 52, y - 30, 104, 5);
      // il guerriero di pietra con la spada alzata
      g.save(); g.translate(x, y - 48); g.scale(verso * 3.3, 3.3); g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = lato ? '#9b6b66' : '#b9b3a6'; g.fillStyle = g.strokeStyle; g.lineWidth = 3.2;
      seg(g, [[0, -18], [-5, -9], [-4, 0]]); seg(g, [[0, -18], [5, -9], [7, 0]]); seg(g, [[0, -18], [1, -33]]);
      g.beginPath(); g.arc(2, -39, 5.6, 0, Math.PI * 2); g.fill();
      seg(g, [[1, -30], [-5, -24], [-8, -18]]); seg(g, [[1, -30], [7, -36], [9, -44]]);
      g.strokeStyle = lato ? '#e0453a' : '#f2c230'; g.lineWidth = 2; seg(g, [[9, -44], [12, -64]]); seg(g, [[6, -45], [12, -43]]);
      g.restore();
    }
    // le crepe quando è danneggiata
    if (d > 0.25) { g.strokeStyle = 'rgba(30,20,20,.7)'; g.lineWidth = 1.5; for (let k = 0; k < Math.floor(d * 8); k++) { const cx = x - 40 + rnd(k + lato) * 80, cy = y - 15 - rnd(k + 3) * 150; seg(g, [[cx, cy], [cx + 6, cy + 9], [cx + 2, cy + 18]]); } }
    g.restore();
  }
  // in Notti dei non morti, a destra c'è la cripta da cui escono gli zombi
  function cripta(g, adesso) {
    const x = ex.L - 60 - cam, y = BASE + 40;
    if (x < -120 || x > VW() + 120) return;
    g.fillStyle = '#2b2f3a'; g.fillRect(x - 50, y - 110, 100, 110); g.beginPath(); g.moveTo(x - 60, y - 110); g.lineTo(x, y - 150); g.lineTo(x + 60, y - 110); g.fill();
    g.fillStyle = '#0b0d12'; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 22, y - 60); g.arc(x, y - 60, 22, Math.PI, 0); g.lineTo(x + 22, y); g.fill();
    g.fillStyle = `rgba(140,255,120,${0.25 + Math.sin(adesso * 2) * 0.15})`; g.fillRect(x - 20, y - 50, 40, 50);
  }

  // ---------- la minimappa e le barre delle statue ----------
  const mm = { x: 330, y: 8, w: 300, h: 22 };
  function minimappa(g, s) {
    mm.w = Math.min(300, VW() - 140); mm.x = Math.round((VW() - mm.w) / 2);
    g.fillStyle = 'rgba(10,15,25,.6)'; g.fillRect(mm.x - 3, mm.y - 3, mm.w + 6, mm.h + 22);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(mm.x, mm.y, mm.w, mm.h);
    const k = mm.w / ex.L;
    for (const u of s.u) { g.fillStyle = u[2] === mioLato() ? '#7fd3ff' : '#ff7a6a'; g.fillRect(mm.x + u[3] * k - 1, mm.y + 5 + u[4] * 12, u[1] === 'gigante' || u[1] === 'medusa' ? 4 : 2, 3); }
    g.fillStyle = '#fff'; g.fillRect(mm.x + ex.STATUA * k - 2, mm.y + 2, 4, mm.h - 4);
    if (ex.modo !== 'nonmorti') g.fillRect(mm.x + (ex.L - ex.STATUA) * k - 2, mm.y + 2, 4, mm.h - 4);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 1.5; g.strokeRect(mm.x + cam * k, mm.y, VW() * k, mm.h);
    // le statue
    s.es.forEach((e, lato) => {
      if (lato === 1 && ex.modo === 'nonmorti') return;
      const w = mm.w / 2 - 6, x0 = lato ? mm.x + mm.w / 2 + 6 : mm.x, y0 = mm.y + mm.h + 5, v = e.st / e.max;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x0, y0, w, 9);
      g.fillStyle = v > 0.5 ? '#5fd35f' : v > 0.25 ? '#f2c230' : '#e8453c'; g.fillRect(lato ? x0 + w * (1 - v) : x0, y0, w * v, 9);
      g.fillStyle = '#fff'; g.font = '700 8px system-ui'; g.textAlign = lato ? 'right' : 'left'; g.fillText(`🗿 ${e.st}`, lato ? x0 + w - 2 : x0 + 2, y0 + 8);
    });
  }

  // ---------- lo strato HTML: ordini, armeria, addestramento ----------
  function sopra(ctx, d) {
    if (!ex || (d.fase !== 'gioco' && d.fase !== 'via')) return '';
    const s = d.s, lato = mioLato(), e = s.es[lato], cm = s.cm[ctx.mio], touch = window.Arena.touch();
    const ordini = `<div class="sw-ordini">${ORDINI.map(([k, ic, nome]) => `<button type="button" class="sw-bt${e.o === k ? ' sw-si' : ''}" data-az="ordine" data-q="${k}" title="${nome}">${ic}<span> ${nome}</span></button>`).join('')}
      <button type="button" class="sw-bt${armeria ? ' sw-si' : ''}" data-az="armeria" title="Armeria">🛠️<span> Armeria</span></button></div>`;
    const arm = armeria ? `<div class="sw-armeria">${Object.entries(ex.pot).map(([k, p]) => `<button type="button" class="sw-pot" data-az="potenzia" data-q="${k}" ${e.pot.includes(k) || e.oro < p.costo ? 'disabled' : ''}><b>${esc(p.nome)}</b><small>${esc(p.testo)}</small><i>${e.pot.includes(k) ? '✔ fatto' : `${p.costo} 🪙`}</i></button>`).join('')}</div>` : '';
    const unita = `<div class="sw-unita">${e.tipi.map((t, i) => {
      const u = ex.unita[t], c = e.c[t];
      return `<button type="button" class="sw-u" data-az="addestra" data-u="${t}" ${e.oro < u.costo || (c && c[0] >= ex.CODA) ? 'disabled' : ''} title="${esc(u.nome)} (${i + 1})"><span class="sw-ic">${ICONE[t]}</span><span class="sw-nome">${esc(u.nome)}</span><b>${u.costo}</b>${c ? `<em data-az="annulla" data-u="${t}" title="Annulla uno">${c[0]}</em>` : ''}<i class="sw-bar" data-bar="${t}"></i></button>`;
    }).join('')}</div>`;
    const mano = cm ? `<div class="sw-mano">${touch ? '<button type="button" class="sw-bt sw-dir" data-sw-dir="-1">◀</button><button type="button" class="sw-bt sw-dir" data-sw-dir="1">▶</button><button type="button" class="sw-bt sw-colpo" data-az="colpisci">💥</button>' : '<span class="sw-aiuto">A/D o ◀ ▶ per muoverti · spazio per colpire</span>'}<button type="button" class="sw-bt" data-az="lascia">✋ Lascia</button></div>` : '';
    return ordini + arm + unita + mano;
  }
  // le barre di addestramento si aggiornano a ogni tick senza rifare i pulsanti
  function barre() {
    const s = ultimo(); if (!s || !ex) return;
    const e = s.es[mioLato()];
    for (const b of document.querySelectorAll('.panno-stickwar .sw-bar')) { const c = e.c[b.dataset.bar]; b.style.width = `${c ? c[1] : 0}%`; }
  }

  const tavolo = window.Arena.tavolo({
    id: 'stickwar',
    misura: (p) => [VW(), (p.extra || ex || { H: 540 }).H],
    mouse: null,
    clicAzione: false,
    comandi: 'nessuno',
    obiettivo: 'punti',
    istruzioni: () => `${window.Arena.touch() ? 'Trascina il campo per guardarti intorno, tocca' : 'Trascina il campo (o A/D, la rotella, la minimappa) per guardarti intorno, clicca'} un tuo soldato per comandarlo a mano. Addestra con i pulsanti in basso${window.Arena.touch() ? '' : ' (o i tasti 1-6), ordini con Q/W/E'}. Distruggi la statua nemica!`,
    statoGioco: (ctx, s) => (ex && ex.torneo ? `Crown of Inamorta, battaglia ${s.round} di ${ex.torneo}: ${ex.nomeLivello}` : ex && ex.modo === 'nonmorti' ? (s.s.gi ? `Giorno: la notte ${s.s.nt + 1} arriva tra ${s.s.gi} s` : `Notte ${s.s.nt} di ${ex.notti}`) : ex && ex.nomeLivello ? `Livello ${ex.livello}: ${ex.nomeLivello}` : 'Battaglia!'),
    hud: (ctx, s) => { const e = s.s.es[mioLato()]; return `<span>🪙 ${e.oro}</span><span>👥 ${e.pop}/${ex ? ex.POP : 40}</span><span>🗿 ${e.st}</span>${ex && ex.modo === 'nonmorti' ? `<span>🌙 ${s.s.nt}/${ex.notti}</span>` : ''}${s.s.w.includes(ctx.mio) ? '<span>✨ esercito potenziato</span>' : ''}`; },
    fineRound: (p) => (p.risultato && p.risultato.titolo) || '',
    sopra,
    dopoSopra: () => barre(),
    clic(ctx, el) {
      const a = el.dataset.az;
      if (el.blur) el.blur(); // lo spazio serve per colpire: non deve ripremere il pulsante
      if (a === 'ordine') { ctx.invia({ tipo: 'ordine', quale: el.dataset.q }); suono([[440, 0.05], [587, 0.08]], { tipo: 'triangle', volume: 0.04 }); }
      else if (a === 'armeria') { armeria = !armeria; const so = document.querySelector('.ar-sopra'); if (so) so._html = null; }
      else if (a === 'potenzia') { ctx.invia({ tipo: 'potenzia', quale: el.dataset.q }); suono([[523, 0.06], [659, 0.06], [784, 0.12]], { volume: 0.05 }); }
      else if (a === 'annulla') ctx.invia({ tipo: 'annulla', unita: el.dataset.u });
      else if (a === 'addestra') { ctx.invia({ tipo: 'addestra', unita: el.dataset.u }); suono([[392, 0.04], [523, 0.06]], { volume: 0.04 }); }
      else if (a === 'lascia') ctx.invia({ tipo: 'lascia' });
      else if (a === 'colpisci') ctx.invia({ tipo: 'colpisci' });
    },
    dopoTick(ctx, d) {
      ctxD = ctx; ex = ctx.partita.extra || ex;
      if (!ex) return;
      const adesso = ora(), s = d.s, pos = new Map(s.u.map((u) => [u[0], u]));
      const vedo = (x) => x > cam - 60 && x < cam + VW() + 60;
      for (const e of s.e || []) {
        if (e[0] === 'a') {
          colpiti.set(e[1], adesso);
          const u = pos.get(e[1]); if (!u) continue;
          const t = u[1], sc = scalaDi(t, u[4]), da = [u[3] + u[7] * 10 * sc, yDi(u[4]) - 30 * sc], bers = pos.get(e[3]);
          const a = [e[2], bers ? yDi(bers[4]) - 22 * scalaDi(bers[1], bers[4]) : e[3] === -1 ? BASE - 20 : yDi(u[4]) - 20];
          if (['arciere', 'morto', 'mago', 'medusa'].includes(t)) colpi.push({ k: t, da, a, t: adesso + (t === 'mago' ? 0.25 : t === 'medusa' ? 0.2 : 0.12), dur: t === 'medusa' ? 0.25 : t === 'mago' ? 0.4 : 0.38 });
          else if (e[3]) botti.push({ x: e[2], y: a[1], t: adesso + 0.2, k: t === 'gigante' ? 'tonfo' : 'colpo' });
          if (vedo(u[3])) {
            if (t === 'arciere') suono([[900, 0.02], [500, 0.03]], { tipo: 'triangle', volume: 0.015 });
            else if (t === 'gigante') { suono([[70, 0.15]], { tipo: 'square', volume: 0.04 }); scossa = adesso; }
            else if (t === 'mago') suono([[300, 0.06], [900, 0.1]], { tipo: 'sawtooth', volume: 0.02 });
            else if (e[3]) suono([[220 + (e[1] % 5) * 30, 0.03]], { tipo: 'square', volume: 0.012 });
          }
        } else if (e[0] === 'd') { morti.push({ id: e[1], tipo: e[2], lato: e[3], x: e[4], verso: e[5], t: adesso, z: (((e[1] * 37) % 100) / 100) }); if (vedo(e[4])) suono([[180, 0.05], [120, 0.08]], { tipo: 'triangle', volume: 0.02 }); }
        else if (e[0] === '$') { const u = pos.get(e[1]); if (u && u[2] === mioLato() && vedo(u[3])) { scritte.push({ x: u[3], y: yDi(u[4]) - 50, txt: '+🪙', t: adesso }); suono([[1320, 0.03], [1760, 0.05]], { volume: 0.015 }); } }
        else if (e[0] === 'n' && e[1] === mioLato()) suono([[660, 0.04]], { tipo: 'triangle', volume: 0.02 });
        else if (e[0] === 's') { scritte.push({ x: null, y: 120, txt: e[1] === mioLato() ? 'La tua statua è caduta!' : 'Statua nemica distrutta! 🏆', grande: true, t: adesso }); suono([[200, 0.2], [150, 0.2], [100, 0.4]], { tipo: 'sawtooth', volume: 0.06 }); scossa = adesso; }
        else if (e[0] === 'o') { scritte.push({ x: null, y: 120, txt: `Notte ${e[1]} 🌙`, grande: true, t: adesso }); suono([[220, 0.3], [208, 0.3], [196, 0.5]], { tipo: 'sawtooth', volume: 0.04 }); }
        else if (e[0] === 'g') { scritte.push({ x: null, y: 120, txt: `Alba: notte ${e[1]} superata! ☀️`, grande: true, t: adesso }); suono([[523, 0.1], [659, 0.1], [784, 0.2]], { volume: 0.05 }); }
        else if (e[0] === 'p' && e[1] === mioLato()) scritte.push({ x: null, y: 120, txt: `🛠️ ${ex.pot[e[2]].nome}!`, grande: true, t: adesso });
      }
      for (const [id, t] of colpiti) if (adesso - t > 1) colpiti.delete(id);
      barre();
    },
    disegna(g, p, st, prima, u, ctx) {
      ctxD = ctx; ex = p.extra || ex;
      if (!ex) return;
      // paesaggio nuovo (livello o battaglia del torneo): si riparte dalla propria statua
      if (!scena || scena.nome !== ex.scena) { preparaScena(); cam = null; }
      // lo strato dei pulsanti sta sopra il campo (non su tutta la larghezza della pagina)
      const so = g.canvas.parentElement && g.canvas.parentElement.querySelector('.ar-sopra');
      if (so) { const l = `${g.canvas.offsetLeft}px`, w = `${g.canvas.offsetWidth}px`, h = `${g.canvas.offsetHeight}px`; if (so.style.left !== l || so.style.width !== w || so.style.height !== h) Object.assign(so.style, { left: l, width: w, height: h, right: 'auto', bottom: 'auto' }); }
      const adesso = ora(), s = st.s, dt = Math.min(0.05, adesso - (ultimoT || adesso)); ultimoT = adesso;
      // la telecamera: segue il soldato comandato, altrimenti si muove con i tasti (parte dalla propria statua)
      if (cam === null) cam = camVoluta = limCam(mioLato() ? ex.L - VW() : 0);
      const pr = new Map(prima ? prima.s.u.map((q) => [q[0], q]) : []);
      const xDi = (q) => { const a = pr.get(q[0]); return a ? a[3] + (q[3] - a[3]) * u : q[3]; };
      const cm = s.cm[ctx.mio], mio = cm && s.u.find((q) => q[0] === cm);
      const dir = (tasti.has('d') || tasti.has('arrowright') ? 1 : 0) - (tasti.has('a') || tasti.has('arrowleft') ? 1 : 0);
      if (mio) camVoluta = limCam(xDi(mio) - VW() / 2 + mio[7] * 120);
      else if (dir) camVoluta = limCam((camVoluta ?? cam) + dir * 900 * dt);
      if (!trascina || !trascina.mosso) cam += ((camVoluta ?? cam) - cam) * Math.min(1, dt * (mio ? 6 : 12));
      cam = limCam(cam);
      const tr = scossa && adesso - scossa < 0.25 ? (Math.random() - 0.5) * 6 : 0;
      g.save(); g.translate(tr, 0);
      // il paesaggio a strati
      g.drawImage(scena.cielo, 0, 0);
      g.drawImage(scena.lontano, -cam * 0.25, 0);
      g.drawImage(scena.colline, -cam * 0.6, 0);
      g.drawImage(scena.suolo, cam, 0, VW(), ex.H - SUOLO + 10, 0, SUOLO, VW(), ex.H - SUOLO + 10);
      for (const [lato, e] of s.es.entries()) if (!(lato === 1 && ex.modo === 'nonmorti')) statua(g, lato, e, adesso);
      if (ex.modo === 'nonmorti') cripta(g, adesso);
      // i caduti (cadono e svaniscono)
      morti = morti.filter((m) => adesso - m.t < 2.2);
      for (const m of morti) {
        const k = Math.min(1, (adesso - m.t) / 0.35), x = m.x - cam, y = yDi(m.z), sc = scalaDi(m.tipo, m.z);
        if (x < -80 || x > VW() + 80) continue;
        g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, adesso - m.t - 1.2)); g.translate(x, y); g.rotate(-m.verso * k * Math.PI / 2 * 0.95); g.translate(-x, -y);
        stickman(g, [m.id, m.tipo, m.lato, m.x, m.z, 100, 'f', m.verso, -1, 0, 0], x, y, adesso - 5);
        g.restore();
      }
      // le unità, dalle più lontane alle più vicine
      const lista = s.u.slice().sort((a, b) => a[4] - b[4]);
      for (const q of lista) { const x = xDi(q) - cam; if (x < -90 || x > VW() + 90) continue; stickman(g, q, x, yDi(q[4]), adesso); }
      // i colpi in volo: frecce, veleno, magia, sguardo di Medusa
      colpi = colpi.filter((c) => adesso - c.t < c.dur + 0.35);
      for (const c of colpi) {
        const tt = adesso - c.t; if (tt < 0) continue;
        const f = Math.min(1, tt / c.dur), x = c.da[0] + (c.a[0] - c.da[0]) * f - cam, alto = c.k === 'medusa' ? 0 : Math.sin(f * Math.PI) * Math.min(70, Math.abs(c.a[0] - c.da[0]) * 0.18), y = c.da[1] + (c.a[1] - c.da[1]) * f - alto;
        if (c.k === 'medusa') { if (f < 1) { g.save(); g.strokeStyle = `rgba(200,255,120,${0.8 * (1 - f)})`; g.lineWidth = 5; g.shadowColor = '#b8ff5c'; g.shadowBlur = 16; seg(g, [[c.da[0] - cam, c.da[1] - 18], [c.a[0] - cam, c.a[1]]]); g.restore(); } else anello(g, c.a[0] - cam, c.a[1], (tt - c.dur) / 0.35, 'rgba(184,255,92,', 90); continue; }
        if (f < 1) {
          if (c.k === 'arciere') { const f0 = Math.max(0, f - 0.04), x0 = c.da[0] + (c.a[0] - c.da[0]) * f0 - cam, y0 = c.da[1] + (c.a[1] - c.da[1]) * f0 - Math.sin(f0 * Math.PI) * Math.min(70, Math.abs(c.a[0] - c.da[0]) * 0.18), an = Math.atan2(y - y0, x - x0); g.save(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.6; seg(g, [pol(an, -11, x, y), [x, y]]); g.fillStyle = '#ddd'; g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill(); g.restore(); }
          else if (c.k === 'morto') { g.save(); g.fillStyle = '#9dff5c'; g.shadowColor = '#9dff5c'; g.shadowBlur = 10; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.restore(); }
          else { g.save(); const gl = g.createRadialGradient(x, y, 0, x, y, 10); gl.addColorStop(0, '#fff'); gl.addColorStop(0.4, '#b78cff'); gl.addColorStop(1, 'rgba(150,90,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill(); g.restore(); }
        } else if (c.k === 'mago') anello(g, c.a[0] - cam, c.a[1], (tt - c.dur) / 0.35, 'rgba(183,140,255,', 75);
        else if (c.k === 'morto') anello(g, c.a[0] - cam, c.a[1], (tt - c.dur) / 0.35, 'rgba(157,255,92,', 18);
      }
      botti = botti.filter((b) => adesso - b.t < 0.3);
      for (const b of botti) { const k = (adesso - b.t) / 0.3; if (k < 0) continue; if (b.k === 'tonfo') anello(g, b.x - cam, b.y + 20, k, 'rgba(140,110,70,', 50); else { g.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; for (let j = 0; j < 4; j++) { const a = j * 1.57 + b.x; g.fillRect(b.x - cam + Math.cos(a) * k * 10, b.y + Math.sin(a) * k * 10, 2, 2); } } }
      // atmosfera: neve che cade, nebbia, buio della notte
      if (scena.S.neve) { g.fillStyle = 'rgba(255,255,255,.85)'; for (const f of scena.fiocchi) { const x = ((f[0] - cam * 0.8 + Math.sin(adesso + f[1]) * 10) % ex.W + ex.W) % ex.W, y = (f[1] + adesso * 30 * f[2]) % ex.H; g.beginPath(); g.arc(x, y, f[2], 0, Math.PI * 2); g.fill(); } }
      if (scena.S.nebbia) { for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(200,210,220,.07)'; g.beginPath(); g.ellipse(((k * 400 - cam * 0.9 + adesso * 12) % (ex.W + 400) + ex.W + 400) % (ex.W + 400) - 200, 400 + k * 25, 260, 40, 0, 0, Math.PI * 2); g.fill(); } }
      if (ex.modo === 'nonmorti' && !s.gi) { g.fillStyle = 'rgba(10,15,40,.22)'; g.fillRect(0, 0, VW(), ex.H); }
      // scritte
      scritte = scritte.filter((w) => adesso - w.t < (w.grande ? 2.2 : 1));
      g.textAlign = 'center';
      for (const w of scritte) {
        const tt = adesso - w.t, dur = w.grande ? 2.2 : 1, x = w.x === null ? VW() / 2 : w.x - cam;
        g.globalAlpha = Math.min(1, (dur - tt) * 3); g.font = `900 ${w.grande ? 34 : 14}px system-ui`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(w.txt, x, w.y - (w.grande ? 0 : tt * 30)); g.fillStyle = w.grande ? '#fff' : '#ffd23f'; g.fillText(w.txt, x, w.y - (w.grande ? 0 : tt * 30));
      }
      g.globalAlpha = 1;
      g.restore();
      minimappa(g, s);
      // frecce ai bordi: ci sono nemici fuori dallo schermo vicino alla propria statua
      const lato = mioLato(), pericolo = s.u.some((q) => q[2] !== lato && q[1] !== 'minatore' && Math.abs(q[3] - (lato ? ex.L - ex.STATUA : ex.STATUA)) < 700 && (q[3] < cam || q[3] > cam + VW()));
      if (pericolo && Math.floor(adesso * 3) % 2) { g.fillStyle = 'rgba(232,69,60,.85)'; g.font = '900 22px system-ui'; g.textAlign = lato ? 'right' : 'left'; g.fillText(lato ? '⚠️ ▶' : '◀ ⚠️', lato ? VW() - 10 : 10, 70); }
    },
  });
  function anello(g, x, y, k, col, r) { g.strokeStyle = `${col}${Math.max(0, 0.8 * (1 - k))})`; g.lineWidth = 4 * (1 - k) + 1; g.beginPath(); g.ellipse(x, y, r * (0.4 + k * 0.6), r * (0.4 + k * 0.6) * 0.45, 0, 0, Math.PI * 2); g.stroke(); }
  const reset0 = tavolo.reset;
  tavolo.reset = (ctx) => {
    const nuovo = ctx.partita && ctx.partita.extra;
    // partita nuova: telecamera dalla propria statua, paesaggio del livello
    if (nuovo && (!ex || nuovo.scena !== ex.scena || nuovo.modo !== ex.modo || nuovo.livello !== ex.livello || (ctx.partita.stato && ctx.partita.stato.fase === 'via'))) { if (!ctxD || ctxD.partita !== ctx.partita) { cam = null; camVoluta = null; armeria = false; } }
    ctxD = ctx; ex = nuovo || ex;
    reset0.call(tavolo, ctx);
  };
  Object.assign(window.Tavoli, { stickwar: tavolo });
})();
