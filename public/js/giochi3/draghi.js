// DRAGHI E SEGRETE: il tavolo. Tre colonne sul computer (il gruppo, il racconto o il campo di battaglia, il mondo),
// una alla volta sul telefono con la barra in basso. Il racconto è una pergamena: il master in corsivo con il
// capolettera, le azioni dei personaggi come fumetti col ritratto, i tiri con il d20. Sotto si scrive cosa si fa (o si
// tirano i dadi chiesti dal master). Il mondo: la mappa a pergamena con i luoghi scoperti, le missioni, i personaggi
// incontrati e il diario. La scheda completa di ogni personaggio si apre toccandolo. Chi fa il master al posto dell'IA
// ha la sua schermata (draghi-master.js).
(() => {
  const { esc, suono, primaVolta, trascorso } = window.Nuovi;
  const A = () => window.DraghiArte, MP = () => window.DraghiMappe, CR = () => window.DraghiCrea, CB = () => window.DraghiCampo, IN = () => window.DraghiIncubo, DM = () => window.DraghiMaster, MU = () => window.DraghiMusica, VO = () => window.DraghiVoce;
  const ATMOSFERA = { calma: ['🌙', 'Calma'], tensione: ['⚠️', 'Tensione'], battaglia: ['⚔️', 'Battaglia'], mistero: ['🔮', 'Mistero'], festa: ['🎉', 'Festa'], orrore: ['💀', 'Orrore'], viaggio: ['🧭', 'In viaggio'] };
  const AMBIENTI = { classica: 'Fantasy classico', oscura: 'Oscura e horror', pirati: 'Mari e pirati', citta: 'Intrighi in città', selvaggia: 'Terre selvagge' };
  const NOMI_CAR = { for: 'Forza', des: 'Destrezza', cos: 'Costituzione', int: 'Intelligenza', sag: 'Saggezza', car: 'Carisma' };
  const BREVI_CAR = { for: 'FOR', des: 'DES', cos: 'COS', int: 'INT', sag: 'SAG', car: 'CAR' };
  const NOMI_AB = { acrobazia: ['Acrobazia', 'des'], animali: ['Addestrare animali', 'sag'], arcano: ['Arcano', 'int'], atletica: ['Atletica', 'for'], furtivita: ['Furtività', 'des'], indagare: ['Indagare', 'int'], inganno: ['Inganno', 'car'], intimidire: ['Intimidire', 'car'], intrattenere: ['Intrattenere', 'car'], intuizione: ['Intuizione', 'sag'], medicina: ['Medicina', 'sag'], natura: ['Natura', 'int'], percezione: ['Percezione', 'sag'], persuasione: ['Persuasione', 'car'], rapidita: ['Rapidità di mano', 'des'], religione: ['Religione', 'int'], sopravvivenza: ['Sopravvivenza', 'sag'], storia: ['Storia', 'int'] };
  const NOMI_STIRPE = { umano: 'Umano', elfo: 'Alto elfo', nano: 'Nano', halfling: 'Halfling', gnomo: 'Gnomo', mezzelfo: 'Mezzelfo', mezzorco: 'Mezzorco', dragonide: 'Dragonide', tiefling: 'Tiefling' };
  const NOMI_CLASSE = { barbaro: 'Barbaro', bardo: 'Bardo', chierico: 'Chierico', druido: 'Druido', guerriero: 'Guerriero', ladro: 'Ladro', mago: 'Mago', monaco: 'Monaco', paladino: 'Paladino', ranger: 'Ranger', stregone: 'Stregone', warlock: 'Warlock' };
  const PX = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const ICONE_COND = { prono: '🛌', avvelenato: '🤢', spaventato: '😱', stordito: '💫', paralizzato: '⚡', privo: '💤', affascinato: '💕', accecato: '🙈', trattenuto: '🕸️', afferrato: '✊', invisibile: '👻', incapacitato: '😵', esausto: '😩', assordato: '🙉', pietrificato: '🗿' };
  const segno = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const telefono = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const colClasse = (cl) => (A().COLORE_CLASSE[cl] || ['#c8a060'])[0];
  // le classi delle ambientazioni horror hanno i loro nomi (li manda il gioco)
  let nomiTema = {};
  const NC = new Proxy(NOMI_CLASSE, { get: (o, k) => o[k] || nomiTema[k] || String(k) });
  const mioPg = (ctx) => ctx.partita.pg[ctx.mio] || null;
  const sonoHost = (ctx) => (ctx.partita.host === ctx.mio || ctx.locale) && !ctx.stato.spettatore;
  // chi dà i comandi del tavolo: chi l'ha aperto e il master umano
  const comanda = (ctx) => sonoHost(ctx) || DM().sonoDm(ctx);
  const nomeDm = (ctx) => (ctx.partita.dm != null ? ctx.nome(ctx.partita.dm) : '');

  // ---------- in più sullo stesso computer: ci si passa il computer ----------
  // Il gioco aspetta la mossa di uno dei posti "locali": il browser fa finta di essere lui (ctx.mio, le mosse partono
  // con "per") e prima mostra il sipario «passate il computer a…», così nessuno vede scheda e scelte degli altri.
  // Ognuno ha i suoi pezzi di ctx.ui (la creazione a metà, le selezioni), ma il testo che si sta scrivendo è uno solo.
  const UI_LOC = {};
  const condiviso = (k) => typeof k === 'string' && (k.startsWith('t_') || k === 'fuoco' || k === 'drVisto' || k === 'drChi');
  function chiTocca(p) {
    const L = p.locali;
    if (p.fase === 'creazione') return L.find((k) => !p.pg[k]);
    if (p.fase === 'avventura' && !p.attesaIA) return L.find((k) => p.pg[k] && !p.pg[k].morto && p.dichiarazioni[k] == null);
    if (p.fase === 'prove') return L.find((k) => p.prove.some((x) => x.posto === k && !x.esito));
    if (p.fase === 'combattimento' && p.combattimento) return L.find((k) => p.pg[k] && p.pg[k].uid === p.combattimento.attivo);
    return undefined;
  }
  function locale(ctx) {
    const p = ctx.partita;
    if (ctx.locale || !p || !p.locali || p.locali.length < 2 || ctx.stato.spettatore || ctx.mio !== p.host || p.fase === 'reale') return ctx;
    const ui = ctx.ui, ora = chiTocca(p);
    if (ora != null) ui.drChi = ora; else if (!p.locali.includes(ui.drChi)) ui.drChi = p.locali[0];
    const k = ui.drChi;
    if (!UI_LOC[k]) UI_LOC[k] = new Proxy({}, { get: (o, x) => (condiviso(x) || !(x in o) ? ui[x] : o[x]), set: (o, x, v) => { if (condiviso(x)) ui[x] = v; else o[x] = v; return true; }, has: (o, x) => x in o || x in ui });
    const partita = { ...p, ...((p.perPosto || {})[k] || {}) };
    return Object.create(ctx, { base: { value: ctx }, locale: { value: true }, mio: { value: k }, partita: { value: partita }, ui: { value: UI_LOC[k] }, invia: { value: (a) => ctx.invia({ ...a, per: k }) } });
  }
  const nomeLocale = (p, k) => (p.pg[k] ? p.pg[k].nome : `Giocatore ${p.locali.indexOf(k) + 1}`);
  function sipario(ctx) {
    const p = ctx.partita, k = ctx.mio;
    if (!ctx.locale || ctx.ui.drVisto === k || chiTocca(p) !== k) return '';
    const cosa = p.fase === 'creazione' ? 'crea il tuo personaggio' : p.fase === 'prove' ? 'tira i tuoi dadi' : p.fase === 'combattimento' ? 'è il tuo turno di combattimento' : 'scrivi cosa fa il tuo personaggio';
    return `<div class="dr-sipario"><div class="dr-sip-box"><span class="dr-sip-ic">🔄</span><h2>Tocca a ${esc(nomeLocale(p, k))}</h2><p>Passate il computer a <b>${esc(nomeLocale(p, k))}</b>: ${cosa}. Gli altri non guardino!</p>
      <button type="button" class="dr-bt dr-bt-oro dr-bt-grande" data-az="dr-sipario" data-id="${k}">Sono ${esc(nomeLocale(p, k))}: gioco</button>
      <small>Siete in ${p.locali.length} sullo stesso computer: ${p.locali.map((x) => esc(nomeLocale(p, x))).join(' · ')}</small></div></div>`;
  }

  // ---------- testo del master: paragrafi, dialoghi, grassetti, nomi dei personaggi ----------
  function formatta(testo, p) {
    let h = esc(testo);
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    h = h.replace(/(«[^»]{1,600}»|&quot;[^&]{1,600}?&quot;|“[^”]{1,600}”)/g, '<q>$1</q>');
    for (const pg of p.pg) if (pg && pg.nome && pg.nome.length > 2) { const n = esc(pg.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp(`(^|[^\\wÀ-ÿ>])(${n})(?![\\wÀ-ÿ])`, 'g'), `$1<b class="dr-nome-pg" style="color:${A().scurisci(colClasse(pg.classe), 0.85)}">$2</b>`); }
    return h.split(/\n{2,}|\n/).filter((x) => x.trim()).map((x) => `<p>${x}</p>`).join('');
  }

  // ---------- il gruppo ----------
  function cartaPg(ctx, pg, posto) {
    const p = ctx.partita, cb = p.combattimento, c = cb ? cb.creature.find((x) => x.id === pg.uid) : null;
    const pf = c ? c.pf : pg.pf, pfMax = c ? c.pfMax : pg.pfMax, q = Math.max(0, Math.min(1, pf / pfMax));
    const cond = (c ? c.condizioni : pg.condizioni).map((k) => ICONE_COND[k] ? `<span title="${k}">${ICONE_COND[k]}</span>` : '').join('');
    let stato = '';
    if (p.fase === 'avventura' && !pg.morto) stato = p.bot[posto] ? '<em class="dr-st bot" title="Compagno del computer">🤖</em>' : p.dichiarazioni[posto] != null ? '<em class="dr-st ok" title="Ha scritto">✓</em>' : '<em class="dr-st scrive" title="Sta pensando">✍️</em>';
    if (p.fase === 'prove') { const x = p.prove.filter((r) => r.posto === posto); if (x.length) stato = x.every((r) => r.esito) ? '<em class="dr-st ok">🎲</em>' : '<em class="dr-st scrive">🎲</em>'; }
    if (cb && cb.attivo === pg.uid) stato = '<em class="dr-st turno">⚔️</em>';
    const chi = p.bot[posto] ? 'computer' : esc(ctx.nome(posto));
    return `<button type="button" class="dr-pg ${posto === ctx.mio ? 'mio' : ''} ${pf <= 0 ? 'giu' : ''} ${pg.morto ? 'morto' : ''}" data-az="dr-scheda" data-id="${pg.uid}" style="--cc:${colClasse(pg.classe)}">
      <span class="dr-pg-ritr">${A().ritratto(pg, { cornice: false })}<i class="dr-pg-liv">${pg.livello}</i></span>
      <span class="dr-pg-info"><b>${esc(pg.nome)}</b><small>${NOMI_STIRPE[pg.stirpe]} ${NC[pg.classe].toLowerCase()} · ${chi}</small>
        <span class="dr-pf ${q <= 0.3 ? 'basso' : q <= 0.6 ? 'medio' : ''}"><i style="width:${q * 100}%"></i><span>${pg.morto ? '💀 morto' : `❤️ ${pf}/${pfMax}${pg.pfTemp ? ` +${pg.pfTemp}` : ''}`}</span></span>
        <span class="dr-pg-mini"><span title="Classe armatura">🛡️ ${pg.ca}</span>${pg.ispirazione ? '<span title="Ispirazione">✨</span>' : ''}${pg.concentrazione ? '<span title="Concentrazione">🔮</span>' : ''}${cond}</span></span>${stato}</button>`;
  }
  function gruppo(ctx) {
    const p = ctx.partita;
    return `<div class="dr-gruppo"><h3 class="dr-titoletto">La compagnia</h3>${p.pg.map((pg, i) => (pg ? cartaPg(ctx, pg, i) : '')).join('')}
      <div class="dr-info-tav"><span>${esc(AMBIENTI[p.ambientazione] || '')}</span>${p.pazza ? '<span title="Il master fa ridere">🤪 pazza</span>' : ''}<span>${{ normale: 'Normale', storia: 'Storia', mortale: 'Mortale' }[p.difficolta]}</span>${p.dm != null ? `<span title="Il master è una persona${p.dmAuto ? ' (adesso lascia raccontare l\'IA)' : ''}">🎩 master: ${esc(nomeDm(ctx))}${p.dmAuto ? ' 🤖' : ''}</span>` : p.iaAttiva ? '<span title="Il master è un\'intelligenza artificiale">🧠 master IA</span>' : '<span title="Manca la chiave dell\'IA: racconta il master di riserva">📕 master di riserva</span>'}</div>
      ${puoSalvare(ctx) ? '<button type="button" class="dr-link dr-chiudi-camp" data-az="dr-salva">💾 Salva la campagna</button>' : ''}${comanda(ctx) && !p.finita ? '<button type="button" class="dr-link dr-chiudi-camp" data-az="dr-termina">Chiudi la campagna</button>' : ''}</div>`;
  }

  // ---------- il racconto ----------
  function voce(ctx, v, nuovo) {
    const p = ctx.partita;
    const anim = nuovo ? `style="--t:${-Math.min(1200, trascorso(ctx.ui, `dr-v${v.id}`))}ms"` : '';
    if (v.tipo === 'master') return `<article class="dr-voce dr-master ${v.combattimento ? 'dr-cbv' : ''} ${nuovo ? 'nuova' : ''}" ${anim}>${formatta(v.testo, p)}</article>`;
    if (v.tipo === 'azione') {
      const pg = p.pg[v.posto];
      return `<div class="dr-voce dr-azione ${v.posto === ctx.mio ? 'mia' : ''} ${nuovo ? 'nuova' : ''}" ${anim} style="--cc:${pg ? colClasse(pg.classe) : '#888'}"><span class="dr-az-ritr">${pg ? A().ritratto(pg, { cornice: false }) : ''}</span><div><b>${esc(v.chi || '')}</b><p>${esc(v.testo)}</p></div></div>`;
    }
    if (v.tipo === 'tiro') return `<div class="dr-voce dr-tiro ${v.riuscita === true ? 'ok' : v.riuscita === false ? 'ko' : ''} ${nuovo ? 'nuova' : ''}" ${anim}>${v.dado ? `<span class="dr-tiro-d">${A().d20(v.dado, { dim: 30, colore: v.riuscita ? '#2a7a4a' : v.riuscita === false ? '#8a2a2a' : '#5a4a8a' })}</span>` : '<span class="dr-tiro-d">🩸</span>'}<span>${esc(v.testo)}</span></div>`;
    return `<div class="dr-voce dr-sistema ${nuovo ? 'nuova' : ''}" ${anim}><span>${esc(v.testo)}</span></div>`;
  }
  function racconto(ctx, { soloLettura = false } = {}) {
    const p = ctx.partita, ui = ctx.ui;
    const ultimo = ui.drUltimaVoce || 0;
    const voci = p.racconto.map((v) => voce(ctx, v, v.id > ultimo && trascorso(ctx.ui, `dr-v${v.id}`) < 1500)).join('');
    const vuoto = !p.racconto.length ? '<p class="dr-vuoto">La storia sta per cominciare…</p>' : '';
    return `<div class="dr-storia ${soloLettura ? 'compatta' : ''}" data-scorri="storia">${vuoto}${voci}${p.attesaIA && !soloLettura && !(p.attesaDM && DM().sonoDm(ctx)) ? '<div class="dr-voce dr-scrive"><span class="dr-piuma">🪶</span> Il master sta scrivendo<span class="dr-puntini"><i>.</i><i>.</i><i>.</i></span></div>' : ''}</div>`;
  }
  function luogoAttuale(p) { return p.mondo && p.mondo.luoghi.find((l) => l.id === p.mondo.posizione); }
  function testaStoria(ctx) {
    const p = ctx.partita, l = luogoAttuale(p), [ic, nome] = ATMOSFERA[p.atmosfera] || ['🧭', p.atmosfera || ''];
    const ar = p.incubo && p.incubo.aree && p.incubo.aree.find((a) => a.id === p.incubo.area);
    return `<header class="dr-testa-storia"><div class="dr-luogo-att">${ar ? `<span class="dr-in-luogo">${esc(p.incubo.icona)}</span><span><b>${esc(ar.nome)}</b><small>${esc(p.incubo.nome)}</small></span>` : l ? `<svg viewBox="-16 -16 32 32" width="30" height="30" aria-hidden="true">${A().iconaLuogo(l.tipo)}</svg><span><b>${esc(l.nome)}</b><small>${esc(l.tipo)}</small></span>` : '<span><b>Draghi e Segrete</b></span>'}</div>
      <span class="dr-atmosfera dr-atm-${esc(p.atmosfera)}" title="Atmosfera">${ic} ${esc(nome)}</span></header>`;
  }

  // ---------- sotto il racconto: scrivere, tirare, aspettare ----------
  function composer(ctx) {
    const p = ctx.partita, ui = ctx.ui, pg = mioPg(ctx);
    if (p.finita) return '<div class="dr-sotto"><p class="dr-fine-camp">🏁 La campagna è finita. Grazie per aver giocato!</p></div>';
    if (ctx.stato.spettatore) return '<div class="dr-sotto"><p class="dr-nota">Stai guardando la partita.</p></div>';
    if (p.erroreIA && !p.attesaIA) return `<div class="dr-sotto"><div class="dr-errore">⚠️ Il master non risponde (${esc(p.erroreIA)}). Riprovo da solo tra poco… <button type="button" class="dr-bt" data-az="dr-riprova">↻ Riprova ora</button></div></div>`;
    if (p.attesaIA) return `<div class="dr-sotto"><div class="dr-attende"><span class="dr-candela"></span>${p.attesaDM ? `🎩 ${esc(nomeDm(ctx))} sta preparando cosa succede…` : 'Il master sta pensando a cosa succede…'}</div></div>`;
    if (p.fase === 'prove') return prove(ctx);
    if (p.fase === 'caduti') return '<div class="dr-sotto"><p class="dr-fine-camp">💀 Siete tutti morti. Scrivete <b>!revive</b> in chat per tornare in vita con tutto quello che avevate (altrimenti la campagna si chiude tra 15 minuti).</p></div>';
    if (p.fase !== 'avventura') return '';
    if (!pg || pg.morto) return `<div class="dr-sotto"><p class="dr-nota">${pg ? `💀 ${esc(pg.nome)} è morto. Puoi continuare a seguire la storia.` : ''}</p></div>`;
    const altri = p.pg.map((x, i) => (x && !x.morto && !p.bot[i] && i !== ctx.mio ? i : -1)).filter((i) => i >= 0);
    const mancano = altri.filter((i) => p.dichiarazioni[i] == null);
    const scritto = p.dichiarazioni[ctx.mio];
    const conto = p.primaDichiarazione != null ? `<span class="dr-conto" data-fine="${Date.now() + p.primaDichiarazione}"></span>` : '';
    const chiAspetta = mancano.length ? `<small class="dr-aspetta">Aspettando: ${mancano.map((i) => esc(p.pg[i].nome)).join(', ')} ${conto}</small>` : '';
    const manda = sonoHost(ctx) && mancano.length && Object.values(p.dichiarazioni).some((x) => x) ? '<button type="button" class="dr-bt" data-az="dr-manda" title="Manda al master senza aspettare gli altri">⏩ Manda al master</button>' : '';
    if (scritto != null) return `<div class="dr-sotto"><div class="dr-scritto"><span>✓ Hai scritto${scritto ? `: <q>${esc(scritto)}</q>` : ' di seguire il gruppo'}</span><span class="dr-scritto-bt"><button type="button" class="dr-link" data-az="dr-cambia">✏️ Cambia</button>${manda}</span></div>${chiAspetta}</div>`;
    const sugg = (p.scelte || []).slice(0, 5).map((s, k) => `<button type="button" class="dr-sugg" data-az="dr-sugg" data-k="${k}">${esc(s)}</button>`).join('');
    const rapidi = [['🔍', 'Mi guardo intorno con attenzione'], ['🌙', 'Propongo di fermarci a riposare'], ['🎒', 'Controllo l\'equipaggiamento e le ferite']].map(([ic, t]) => `<button type="button" class="dr-sugg rapido" data-az="dr-rapido" data-t="${esc(t)}" title="${esc(t)}">${ic}</button>`).join('');
    return `<div class="dr-sotto"><div class="dr-scrivi" style="--cc:${colClasse(pg.classe)}"><span class="dr-scrivi-ritr">${A().ritratto(pg, { cornice: false })}</span>
      <textarea data-tieni="dich" maxlength="1500" rows="2" placeholder="Cosa fa ${esc(pg.nome)}? Scrivi azioni, parole, idee… (Invio per mandare)">${esc(ui.t_dich || '')}</textarea>
      <button type="button" class="dr-bt dr-bt-oro dr-invia" data-az="dr-dichiara" aria-label="Manda">➤</button></div>
      ${p.incubo ? IN().azioni(ctx) : ''}<div class="dr-suggerimenti"><span class="dr-sugg-tit">Idee del master — oppure scrivi tu qualsiasi cosa:</span>${sugg}<button type="button" class="dr-sugg tu" data-az="dr-scrivitu">✍️ Scegli tu</button>${rapidi}<button type="button" class="dr-sugg niente" data-az="dr-segui" title="Non fai niente di particolare">🚶 Seguo il gruppo</button></div>${chiAspetta}${manda && !mancano.includes(ctx.mio) ? '' : ''}</div>`;
  }
  function prove(ctx) {
    const p = ctx.partita, pg = mioPg(ctx);
    const carte = p.prove.map((x) => {
      const chi = p.pg[x.posto], mia = x.posto === ctx.mio && !ctx.stato.spettatore;
      const tag = `${x.vantaggio ? '<em class="v">vantaggio</em>' : ''}${x.svantaggio ? '<em class="s">svantaggio</em>' : ''}`;
      let destra;
      if (x.esito) {
        const nuovo = trascorso(ctx.ui, `dr-p-${x.id}-${x.esito.totale}-${x.esito.d20.valore}`) < 1400;
        destra = `<span class="dr-esito ${x.esito.riuscita ? 'ok' : 'ko'}">${A().d20(x.esito.d20.valore, { dim: 54, colore: x.esito.riuscita ? '#2a7a4a' : '#8a2a2a', animato: nuovo })}<b>${x.esito.totale}</b><small>${x.esito.riuscita ? 'Riuscita!' : 'Fallita'}${x.esito.naturale === 20 ? '<br>20 naturale!' : x.esito.naturale === 1 ? '<br>1 naturale' : ''}</small></span>`;
      } else if (mia) {
        const isp = pg && pg.ispirazione ? `<label class="dr-opz"><input type="checkbox" data-opz="isp" ${ctx.ui.usaIsp ? 'checked' : ''}> ✨ usa l'ispirazione (vantaggio)</label>` : '';
        const bard = pg && (pg.effetti || []).some((e) => e.effetto === 'ispirato') ? `<label class="dr-opz"><input type="checkbox" data-opz="bard" ${ctx.ui.usaBard ? 'checked' : ''}> 🎵 ispirazione bardica</label>` : '';
        destra = `<span class="dr-tira-bt"><button type="button" class="dr-bt dr-bt-oro dr-bt-grande" data-az="dr-tira" data-id="${x.id}">🎲 Tira!</button>${isp}${bard}</span>`;
      } else destra = `<span class="dr-esito dr-in-attesa">${p.bot[x.posto] ? '🤖' : '⏳'}</span>`;
      const bonus = chi ? (x.salvezza ? chi.bonusTs[x.tipo] : chi.bonusAb && chi.bonusAb[x.tipo] != null ? chi.bonusAb[x.tipo] : chi.mod[x.tipo]) : 0;
      return `<div class="dr-prova ${mia && !x.esito ? 'mia' : ''}"><span class="dr-prova-ritr">${chi ? A().ritratto(chi, { cornice: false }) : ''}</span>
        <span class="dr-prova-info"><b>${esc(chi ? chi.nome : '?')}</b><span class="dr-prova-nome">${esc(x.nome)} <i>${segno(bonus || 0)}</i></span><small>CD ${x.cd}${x.motivo ? ` · ${esc(x.motivo)}` : ''}</small>${tag}</span>${destra}</div>`;
    }).join('');
    return `<div class="dr-sotto"><div class="dr-prove"><h3>🎲 Il master chiede ${p.prove.length > 1 ? 'dei tiri' : 'un tiro'}</h3>${carte}</div></div>`;
  }

  // ---------- il mondo: mappa, missioni, diario ----------
  function mappa(ctx) {
    const p = ctx.partita, ui = ctx.ui;
    const chiave = JSON.stringify([p.mondo.luoghi.map((l) => [l.id, l.x, l.y, l.visitato, l.nome, l.tipo]), p.mondo.percorso, p.mondo.posizione, ui.drLuogo]);
    if (ui.drMappaChiave !== chiave) { ui.drMappaChiave = chiave; ui.drMappaHtml = MP().mondoHtml(p.mondo, { scala: 10, attivo: ui.drLuogo }); }
    // di solito si guarda da vicino la zona conosciuta (la nebbia copre il resto)
    let svg = ui.drMappaHtml;
    const L = p.mondo.luoghi;
    if (!ui.drMappaIntera && L.length) {
      const W = p.mondo.w, H = p.mondo.h;
      let x0 = Math.min(...L.map((l) => l.x)) - 16, x1 = Math.max(...L.map((l) => l.x)) + 16, y0 = Math.min(...L.map((l) => l.y)) - 11, y1 = Math.max(...L.map((l) => l.y)) + 11;
      let w = Math.max(48, x1 - x0), h = Math.max(32, y1 - y0);
      if (w / h > W / H) h = w / (W / H); else w = h * (W / H);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      x0 = Math.max(0, Math.min(W - w, cx - w / 2)); y0 = Math.max(0, Math.min(H - h, cy - h / 2));
      if (w < W - 1) svg = svg.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="${Math.round(x0 * 10)} ${Math.round(y0 * 10)} ${Math.round(Math.min(W, w) * 10)} ${Math.round(Math.min(H, h) * 10)}"`);
    }
    const l = p.mondo.luoghi.find((x) => x.id === ui.drLuogo) || luogoAttuale(p);
    const info = l ? `<div class="dr-luogo-info"><svg viewBox="-16 -16 32 32" width="34" height="34" aria-hidden="true">${A().iconaLuogo(l.tipo)}</svg><div><b>${esc(l.nome)}</b><small>${esc(l.tipo)}${l.id === p.mondo.posizione ? ' · siete qui' : l.visitato ? ' · visitato' : ' · se ne parla'}</small>${l.descrizione ? `<p>${esc(l.descrizione)}</p>` : ''}</div></div>` : '';
    return `<div class="dr-mappa">${svg}<button type="button" class="dr-mappa-zoom" data-az="dr-mappa-intera">${ui.drMappaIntera ? '🔍 Avvicina' : '🗺️ Mappa intera'}</button></div>${info}<p class="dr-nota">Per andare in un luogo, scrivilo nella tua azione: il master racconta il viaggio.</p>`;
  }
  function missioni(ctx) {
    const p = ctx.partita;
    const ST = { nuova: ['🆕', 'nuova'], aggiornata: ['📌', 'in corso'], completata: ['✅', 'completata'], fallita: ['❌', 'fallita'] };
    const m = p.missioni.length ? p.missioni.slice().reverse().map((x) => `<li class="dr-miss ${x.stato}"><span>${(ST[x.stato] || ST.nuova)[0]}</span><div><b>${esc(x.titolo)}</b><small>${(ST[x.stato] || ST.nuova)[1]}</small><p>${esc(x.descrizione)}</p></div></li>`).join('') : '<li class="dr-vuoto">Ancora nessuna missione.</li>';
    const ATT = { amico: '💚', neutrale: '🤍', ostile: '💢' };
    const png = p.png.length ? p.png.slice().reverse().map((x) => `<li class="dr-png ${x.atteggiamento}"><span>${ATT[x.atteggiamento] || '🤍'}</span><div><b>${esc(x.nome)}</b><p>${esc(x.descrizione)}</p></div></li>`).join('') : '<li class="dr-vuoto">Nessuno, per ora.</li>';
    return `<h4 class="dr-sez-tit">📜 Missioni</h4><ul class="dr-lista">${m}</ul><h4 class="dr-sez-tit">🎭 Personaggi incontrati</h4><ul class="dr-lista">${png}</ul>`;
  }
  function diario(ctx) {
    const p = ctx.partita;
    return `<h4 class="dr-sez-tit">📖 Diario della campagna</h4><div class="dr-diario">${p.diario ? formatta(p.diario, p) : '<p class="dr-vuoto">Il master lo scrive mentre giocate: è la memoria della campagna.</p>'}</div>${puoSalvare(ctx) ? '<div class="dr-salva"><button type="button" class="dr-bt" data-az="dr-salva">💾 Scarica la campagna</button><small class="dr-nota">Un file da tenere: per continuare un altro giorno, chi apre il tavolo lo riprende con «📂 Riprendi una campagna salvata» prima di cominciare.</small></div>' : ''}`;
  }

  // ---------- 💾 salvare e 📂 riprendere la campagna (giochi3/draghi/salva.js) ----------
  const puoSalvare = (ctx) => { const p = ctx.partita; return !ctx.stato.spettatore && !p.finita && p.fase !== 'creazione' && !p.reale; };
  let ultimoCtx = null, ultimoSalvato = null;
  // il server ha preparato il file chiesto con 💾: il browser lo scarica (una volta sola)
  function scaricaSalvataggio(ctx) {
    const s = ctx.partita.salvataggio;
    if (!s || ultimoSalvato === s.ora) return;
    ultimoSalvato = s.ora;
    setTimeout(() => {
      try {
        const url = URL.createObjectURL(new Blob([JSON.stringify(s.dati)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = s.nome; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        ctx.avviso('💾 Campagna scaricata: tienila per riprenderla');
      } catch (e) { ctx.avviso('Non riesco a scaricare il file'); }
    }, 0);
  }
  // 📂: il file scelto va al server (al massimo 100 kB, come ogni messaggio)
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('#panno input[data-dr-file]') || !el.files || !el.files[0] || !ultimoCtx) return;
    const ctx = ultimoCtx, f = el.files[0];
    el.value = '';
    if (f.size > 98000) { ctx.avviso('Il file è troppo grande: non è una campagna di Draghi e Segrete'); return; }
    f.text().then((t) => {
      let dati = null;
      try { dati = JSON.parse(t); } catch (err) { dati = null; }
      if (!dati || dati.formato !== 'draghi-e-segrete') { ctx.avviso('Questo non è un file di Draghi e Segrete'); return; }
      ctx.invia({ tipo: 'riprendi', dati });
    }).catch(() => ctx.avviso('Non riesco a leggere il file'));
  });
  function lato(ctx, schede) {
    const ui = ctx.ui;
    if (!schede.some((s) => s[0] === ui.drLato)) ui.drLato = schede[0][0];
    const corpo = { mappa, stazione: (c) => IN().pannello(c), missioni, diario, turno: (c) => CB().pannello(c), racconto: (c) => `${racconto(c, { soloLettura: true })}` }[ui.drLato](ctx);
    return `<aside class="dr-lato"><nav class="dr-schede">${schede.map(([id, ic, n]) => `<button type="button" class="${ui.drLato === id ? 'sel' : ''}" data-az="dr-lato" data-id="${id}">${ic}<span>${n}</span></button>`).join('')}</nav><div class="dr-lato-corpo" data-scorri="lato-${ui.drLato}">${corpo}</div></aside>`;
  }

  // ---------- la scheda del personaggio ----------
  function scheda(ctx, uid) {
    const p = ctx.partita, pg = p.pg.find((x) => x && x.uid === uid); if (!pg) return '';
    const mia = pg === mioPg(ctx) && !ctx.stato.spettatore;
    const prossimo = PX[pg.livello] || null, quota = prossimo ? Math.min(1, (pg.px - PX[pg.livello - 1]) / (prossimo - PX[pg.livello - 1])) : 1;
    const car = Object.keys(NOMI_CAR).map((k) => `<div class="dr-sc-car"><small>${BREVI_CAR[k]}</small><b>${segno(pg.mod[k])}</b><span>${pg.car[k]}</span><em title="Tiro salvezza" class="${pg.salvezze.includes(k) ? 'comp' : ''}">TS ${segno(pg.bonusTs ? pg.bonusTs[k] : pg.mod[k])}</em></div>`).join('');
    const ab = Object.entries(NOMI_AB).map(([k, [n, c]]) => `<li class="${pg.abilita.includes(k) ? 'comp' : ''} ${pg.maestria.includes(k) ? 'mae' : ''}"><i></i>${n} <small>${BREVI_CAR[c]}</small><b>${segno(pg.bonusAb ? pg.bonusAb[k] : pg.mod[c])}</b></li>`).join('');
    const att = pg.attacchi.map((a) => `<li><b>${esc(a.nome)}</b><span>${segno(a.colpire)}</span><span>${esc(a.danno)} ${esc(a.tipo)}</span><small>${a.gittata ? `${a.gittata[0]}/${a.gittata[1]} m` : a.portata > 1.5 ? 'portata 3 m' : 'mischia'}${a.magica ? ' · magica' : ''}</small></li>`).join('');
    let magia = '';
    if (pg.magia) {
      const inf = p.incantesimi || {};
      const per = {}; for (const id of [...new Set([...pg.magia.trucchetti, ...pg.magia.incantesimi, ...pg.magia.sempre])]) { const x = inf[id]; if (x) (per[x.liv] = per[x.liv] || []).push([id, x]); }
      magia = `<section class="dr-sc-sez"><h4>✨ Magia <small>${NOMI_CAR[pg.magia.car]} · CD ${pg.magia.cd} · attacco ${segno(pg.magia.attacco)}</small></h4>
        ${pg.magia.slot.length ? `<div class="dr-slot grande">${pg.magia.slot.map((n, i) => `<span><small>${i + 1}°</small>${Array.from({ length: n }, (_, k) => `<i class="${k < n - (pg.magia.slotUsati[i] || 0) ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</div>` : ''}
        ${Object.entries(per).map(([lv, l]) => `<h5>${Number(lv) ? `${lv}° livello` : 'Trucchetti'}</h5><ul class="dr-sc-inc">${l.map(([id, x]) => `<li><b>${esc(x.nome)}</b>${x.conc ? ' <i>C</i>' : ''}${pg.magia.sempre.includes(id) ? ' <i>sempre</i>' : ''}<small>${esc(x.tempo)} · ${esc(String(x.gittata))}${/^\d+$/.test(String(x.gittata)) ? ' m' : ''} · ${esc(x.durata)}</small><p>${esc(x.desc)}</p></li>`).join('')}</ul>`).join('')}</section>`;
    }
    const risorse = Object.values(pg.risorse || {}).map((r) => `<span class="dr-ris"><b>${esc(r.nome)}</b> ${r.punti ? `${r.max - r.usati}/${r.max}` : Array.from({ length: Math.min(r.max, 12) }, (_, k) => `<i class="${k < r.max - r.usati ? 'on' : ''}"></i>`).join('')}</span>`).join('');
    const priv = [...pg.privilegi.map((x) => ({ ...x, tipo: x.da === 'sottoclasse' ? pg.sottoclasse : NC[pg.classe] })), ...pg.tratti.map((x) => ({ ...x, tipo: NOMI_STIRPE[pg.stirpe] }))].map((x) => `<li><b>${esc(x.nome)}</b> <small>${esc(x.tipo)}</small><p>${esc(x.desc)}</p></li>`).join('');
    const nomiA = p.nomiArmature || {};
    const armature = [...new Set([...(pg.armatureAvute || []), ...(pg.armatura ? [pg.armatura] : [])])];
    const puoEquip = mia && p.fase === 'avventura' && !p.attesaIA;
    const equip = `<div class="dr-sc-equip"><span>🥋 ${pg.armatura ? esc(nomiA[pg.armatura] || pg.armatura) : 'Nessuna armatura'}</span>${pg.scudo ? '<span>🛡️ Scudo</span>' : ''}
      ${puoEquip && armature.length > 0 ? `<span class="dr-chips">${[null, ...armature].map((a) => `<button type="button" class="dr-chip ${pg.armatura === a ? 'sel' : ''}" data-az="dr-armatura" data-id="${a || ''}">${a ? esc(nomiA[a] || a) : 'senza'}</button>`).join('')}</span>` : ''}
      ${puoEquip && (pg.scudoAvuto || pg.scudo) ? `<button type="button" class="dr-chip ${pg.scudo ? 'sel' : ''}" data-az="dr-scudo">🛡️ ${pg.scudo ? 'togli lo scudo' : 'imbraccia lo scudo'}</button>` : ''}</div>`;
    const ogg = pg.oggetti.map((o) => `<li title="${esc(o.descrizione || '')}">${esc(o.nome)}${o.n > 1 ? ` <b>×${o.n}</b>` : ''}${o.descrizione ? ' <i>ⓘ</i>' : ''}</li>`).join('');
    const note = mia ? `<section class="dr-sc-sez"><h4>📝 I tuoi appunti</h4><textarea data-tieni="note" rows="4" maxlength="3000" placeholder="Nomi, indizi, sospetti…">${esc(ctx.ui.t_note != null ? ctx.ui.t_note : pg.note || '')}</textarea><button type="button" class="dr-bt" data-az="dr-note">Salva gli appunti</button></section>` : (pg.note ? `<section class="dr-sc-sez"><h4>📝 Appunti</h4><p>${esc(pg.note)}</p></section>` : '');
    const morte = pg.pf <= 0 && !pg.morto ? `<p class="dr-sc-morte">A terra! Tiri contro la morte: ${'✔'.repeat(pg.morte.successi)}${'·'.repeat(3 - pg.morte.successi)} / ${'✖'.repeat(pg.morte.fallimenti)}${'·'.repeat(3 - pg.morte.fallimenti)}${pg.stabile ? ' — stabile' : ''}</p>` : '';
    return `<div class="dr-velo" data-az="dr-chiudi-scheda"><div class="dr-scheda" data-az="dr-niente" style="--cc:${colClasse(pg.classe)}" role="dialog" aria-label="Scheda di ${esc(pg.nome)}">
      <button type="button" class="dr-x" data-az="dr-chiudi-scheda" aria-label="Chiudi">✕</button>
      <header class="dr-sc-testa"><span class="dr-sc-ritr">${A().ritratto(pg)}</span><div><h2>${esc(pg.nome)}</h2><p>${NOMI_STIRPE[pg.stirpe]} · ${NC[pg.classe]} ${pg.livello}° livello · ${esc(pg.sottoclasse)}</p>
        <p class="dr-sc-px"><span>⭐ ${pg.px} PX${prossimo ? ` / ${prossimo}` : ''}</span><i><b style="width:${quota * 100}%"></b></i></p>
        <div class="dr-sc-num"><span><small>CA</small><b>${pg.ca}</b></span><span><small>PF</small><b>${Math.max(0, pg.pf)}/${pg.pfMax}</b></span><span><small>Velocità</small><b>${String(pg.velocita).replace('.', ',')} m</b></span><span><small>Iniziativa</small><b>${segno(pg.iniziativa)}</b></span><span><small>Competenza</small><b>+${pg.comp}</b></span><span><small>Percezione</small><b>${pg.percezionePassiva}</b></span><span><small>Dadi vita</small><b>${pg.dadiVita.restanti}d${pg.dadiVita.dado}</b></span><span><small>Oro</small><b>${pg.oro}</b></span></div>${morte}</div></header>
      <div class="dr-sc-corpo"><div class="dr-sc-col"><div class="dr-sc-cars">${car}</div><section class="dr-sc-sez"><h4>🎯 Abilità</h4><ul class="dr-sc-ab">${ab}</ul></section>
        <section class="dr-sc-sez"><h4>🗣️ Lingue e competenze</h4><p>${esc(pg.lingue.join(', '))}</p><p><small>Armature: ${esc(pg.compArmature.join(', ') || 'nessuna')} · Armi: ${esc(pg.compArmi.join(', '))}${pg.attrezzi.length ? ` · Attrezzi: ${esc(pg.attrezzi.join(', '))}` : ''}</small></p></section></div>
        <div class="dr-sc-col"><section class="dr-sc-sez"><h4>⚔️ Attacchi</h4><ul class="dr-sc-att">${att}</ul></section>${risorse ? `<section class="dr-sc-sez"><h4>🔋 Risorse</h4><div class="dr-sc-ris">${risorse}</div></section>` : ''}${magia}
        <section class="dr-sc-sez"><h4>🌟 Privilegi e tratti</h4><ul class="dr-sc-priv">${priv}</ul></section></div>
        <div class="dr-sc-col"><section class="dr-sc-sez"><h4>🎒 Equipaggiamento</h4>${equip}<ul class="dr-sc-ogg">${ogg}</ul></section>${pg.storia ? `<section class="dr-sc-sez"><h4>📜 Storia</h4><p class="dr-sc-storia">${esc(pg.storia)}</p></section>` : ''}${note}</div></div></div></div>`;
  }

  // ---------- la creazione: chi è pronto e l'idea della campagna ----------
  function latoCreazione(ctx) {
    const p = ctx.partita;
    // il master umano: chi ha aperto il tavolo lo sceglie col 🎩 (o uno si propone), non al computer né a chi gioca sul computer passato
    const puoDm = (i) => p.modalita !== 'reale' && p.n > 1 && !p.bot[i] && !(p.locali || []).includes(i) && !ctx.stato.spettatore && (sonoHost(ctx) || (i === ctx.mio && p.dm == null));
    const tastoDm = (i) => (i === p.dm ? (sonoHost(ctx) || i === ctx.mio ? `<button type="button" class="dr-chip sel dr-cr-dm" data-az="dr-dm-lascia" title="Non fa più il master: torna l'IA">🎩 master ✕</button>` : '<span class="dr-chip sel dr-cr-dm">🎩 master</span>') : puoDm(i) ? `<button type="button" class="dr-chip dr-cr-dm" data-az="dr-dm-scegli" data-id="${i}" title="${i === ctx.mio ? 'Faccio io il master al posto dell\'IA' : 'Fa il master al posto dell\'IA'}">🎩${i === ctx.mio ? ' Faccio io il master' : ' master'}</button>` : '');
    const chi = p.pg.map((pg, i) => `<li class="${pg || i === p.dm ? 'pronto' : ''}">${pg ? `<span class="dr-mini-ritr">${A().ritratto(pg, { cornice: false })}</span>` : `<span class="dr-mini-ritr vuoto">${i === p.dm ? '🎩' : p.bot[i] ? '🤖' : '✍️'}</span>`}<span><b>${pg ? esc(pg.nome) : p.bot[i] ? 'Compagno del computer' : esc(ctx.nome(i))}</b><small>${i === p.dm ? 'il master' : pg ? `${NOMI_STIRPE[pg.stirpe]} ${NC[pg.classe].toLowerCase()}` : p.bot[i] ? 'lo crea il computer' : 'sta creando il personaggio…'}</small></span>${tastoDm(i)}</li>`).join('');
    const spiega = p.dm == null && p.modalita !== 'reale' && p.n > 1 && sonoHost(ctx) ? '<p class="dr-nota">🎩 Volete un master in carne e ossa? Tocca il cappello accanto a chi lo farà: non crea il personaggio e l\'IA gli fa da consigliere.</p>' : '';
    const idea = comanda(ctx)
      ? `<div class="dr-idea"><h4>💡 Idea per la campagna</h4><textarea data-tieni="idea" rows="4" maxlength="2000" placeholder="Facoltativa: un tema, un cattivo, un luogo… Es.: «Una città portuale dove spariscono i bambini e il culto della Marea Nera…». Vuota: inventa tutto il master.">${esc(ctx.ui.t_idea != null ? ctx.ui.t_idea : p.idea || '')}</textarea><button type="button" class="dr-bt" data-az="dr-idea">${p.idea ? '✓ Idea salvata · aggiorna' : 'Salva l\'idea'}</button></div>
        <button type="button" class="dr-bt dr-bt-oro dr-bt-grande dr-inizia" data-az="dr-inizia">⚔️ Inizia l'avventura</button><small class="dr-nota">Chi non ha finito il personaggio lo completa il computer.</small>
        ${p.modalita !== 'reale' && !ctx.stato.spettatore ? '<div class="dr-riprendi"><label class="dr-bt">📂 Riprendi una campagna salvata<input type="file" accept=".json,application/json" data-dr-file hidden></label><small class="dr-nota">Il file scaricato con 💾: i personaggi salvati prendono i posti in ordine, i posti in più ne creano uno nuovo.</small></div>' : ''}`
      : `${p.idea ? `<div class="dr-idea"><h4>💡 L'idea della campagna</h4><p>${esc(p.idea)}</p></div>` : ''}<p class="dr-nota">L'avventura comincia quando ${esc(ctx.nome(p.host))} preme «Inizia» (o quando tutti hanno il personaggio).</p>`;
    return `<div class="dr-cr-compagnia"><h4>La compagnia</h4><ul>${chi}</ul>${spiega}${idea}</div>`;
  }
  function pronto(ctx) {
    const p = ctx.partita, pg = mioPg(ctx);
    return `<div class="dr-pronto"><div class="dr-pronto-carta" style="--cc:${colClasse(pg.classe)}"><span class="dr-pronto-ritr">${A().ritratto(pg)}</span>
      <h2>${esc(pg.nome)}</h2><p>${NOMI_STIRPE[pg.stirpe]} · ${NC[pg.classe]} ${pg.livello}° livello</p>
      <div class="dr-ant-car">${Object.keys(NOMI_CAR).map((k) => `<span><small>${BREVI_CAR[k]}</small><b>${pg.car[k]}</b></span>`).join('')}</div>
      <p class="dr-righe"><span>❤️ <b>${pg.pfMax}</b> PF</span><span>🛡️ CA <b>${pg.ca}</b></span><span>🏃 <b>${String(pg.velocita).replace('.', ',')}</b> m</span></p>
      <div class="dr-pronto-bt"><button type="button" class="dr-bt" data-az="dr-scheda" data-id="${pg.uid}">📜 Scheda completa</button><button type="button" class="dr-bt" data-az="dr-rifai">↺ Rifai il personaggio</button></div></div>
      ${latoCreazione(ctx)}${p.combattimento ? '' : ''}</div>`;
  }

  // ---------- il tavolo ----------
  const tavolo = {
    libero: true,
    senzaFila: true,
    reset(ctx) {
      if (window.NuoviTesto) window.NuoviTesto(ctx);
      // prima di ridisegnare: dov'era lo scorrimento del racconto
      const ui = ctx.ui;
      ui.drScorri = {};
      for (const el of document.querySelectorAll('#panno [data-scorri]')) ui.drScorri[el.dataset.scorri] = { top: el.scrollTop, fondo: el.scrollHeight - el.scrollTop - el.clientHeight < 90 };
      const cr = document.querySelector('#panno .dr-cr-corpo'); if (cr) ui.drScorriCrea = { passo: cr.dataset.passo, top: cr.scrollTop };
    },
    panno(ctx) {
      ctx = locale(ctx);
      ultimoCtx = ctx.base || ctx;
      if (ctx.partita && ctx.partita.salvataggio) scaricaSalvataggio(ctx);
      const tenda = sipario(ctx);
      if (tenda) return `<div class="dr dr-fase-sipario dr-amb-${esc(ctx.partita.ambientazione || 'classica')}">${tenda}</div>`;
      const p = ctx.partita, ui = ctx.ui, tel = telefono();
      nomiTema = p.nomiClasse || {};
      if (!p.catalogo && p.fase === 'creazione') return '<div class="dr"><p class="dr-vuoto">Caricamento…</p></div>';
      const scheda1 = ui.drScheda ? scheda(ctx, ui.drScheda) : '';
      // lo scenario dello sfondo (sagome dell'ambientazione, modalità pazza)
      const scena = `dr-amb-${esc(p.ambientazione || 'classica')} ${p.pazza ? 'dr-pazza' : ''}`;
      if (p.fase === 'creazione' && DM().sonoDm(ctx)) return `<div class="dr dr-dm dr-fase-pronti ${scena}">${DM().creazione(ctx, latoCreazione(ctx))}${scheda1}</div>`;
      if (p.fase === 'creazione') {
        if (mioPg(ctx) || ctx.stato.spettatore) return `<div class="dr dr-fase-pronti ${scena}">${mioPg(ctx) ? pronto(ctx) : latoCreazione(ctx)}${scheda1}</div>`;
        // sul telefono la colonna della compagnia (con 📂) non si vede durante la creazione: una riga in cima
        const barra = comanda(ctx) && p.modalita !== 'reale' && !ctx.stato.spettatore ? '<label class="dr-riprendi-barra">📂 Avete una campagna salvata? <u>Riprendila</u><input type="file" accept=".json,application/json" data-dr-file hidden></label>' : '';
        // e la compagnia (il 🎩 del master, l'idea, «Inizia») si apre con un pulsante
        const pronti = p.pg.filter(Boolean).length;
        const compagnia = ctx.stato.spettatore ? '' : `<button type="button" class="dr-cr-comp-bt" data-az="dr-compagnia" aria-expanded="${ui.drCompagnia ? 'true' : 'false'}">👥 La compagnia${p.n > 1 ? ` (${pronti}/${p.n} pronti)` : ''}${comanda(ctx) ? ' · 🎩 master, idea, «Inizia»' : ''} <b>${ui.drCompagnia ? '▴' : '▾'}</b></button>`;
        return `<div class="dr dr-fase-crea ${scena} ${ui.drCompagnia ? 'dr-cr-comp-aperta' : ''}">${barra}${compagnia}${CR().html(ctx, latoCreazione(ctx))}${scheda1}</div>`;
      }
      if (p.reale && (p.fase === 'reale' || p.fase === 'caduti')) return `${IN().realeHtml(ctx)}${scheda1}`;
      if (DM().sonoDm(ctx)) return DM().panno(ctx, scena);
      const cb = p.combattimento;
      if (cb && ui.drCbVisto !== cb.scena.g.length + cb.scena.stile) { ui.drCbVisto = cb.scena.g.length + cb.scena.stile; ui.drTab = 'battaglia'; ui.drLato = 'turno'; }
      if (!cb && ui.drTab === 'battaglia') ui.drTab = 'storia';
      if (cb && CB().mioTurno(ctx) && primaVolta(ui, `dr-turno-${cb.round}-${cb.attivo}`)) { ui.drLato = 'turno'; if (tel) ui.drTab = 'battaglia'; }
      const tab = ui.drTab || (cb ? 'battaglia' : 'storia');
      let centro;
      if (cb) {
        // il racconto del master in battaglia si legge solo nella scheda «Racconto» a lato, non sotto la mappa
        centro = `<section class="dr-centro dr-centro-cb">${CB().filaIniziativa(ctx)}<div id="dr-campo-posto" class="dr-campo-posto"></div></section>`;
      } else centro = `<section class="dr-centro">${testaStoria(ctx)}${racconto(ctx)}${composer(ctx)}</section>`;
      const MAPPA = p.incubo ? ['stazione', '🛰️', 'Stazione'] : ['mappa', '🗺️', 'Mappa'];
      const schede = cb ? (tel ? [['turno', '🎲', 'Turno'], ['racconto', '💬', 'Racconto'], MAPPA, ['missioni', '📜', 'Missioni'], ['diario', '📖', 'Diario']] : [['turno', '🎲', 'Turno'], ['racconto', '💬', 'Racconto'], MAPPA, ['missioni', '📜', 'Missioni']])
        : [MAPPA, ['missioni', '📜', 'Missioni'], ['diario', '📖', 'Diario']];
      if (tel && cb && tab === 'battaglia') ui.drLato = 'turno';
      if (tel && tab === 'mondo' && cb && ui.drLato === 'turno') ui.drLato = 'racconto';
      const nav = (cb ? [['battaglia', '⚔️', 'Battaglia'], ['mondo', '🗺️', 'Mondo'], ['gruppo', '👥', 'Gruppo']] : [['storia', '📖', 'Storia'], ['mondo', '🗺️', 'Mondo'], ['gruppo', '👥', 'Gruppo']])
        .map(([id, ic, n]) => `<button type="button" class="${tab === id ? 'sel' : ''}" data-az="dr-tab" data-id="${id}"><span>${ic}</span>${n}${id === 'battaglia' && CB().mioTurno(ctx) ? '<i class="dr-pallino"></i>' : ''}${id === 'storia' && (p.fase === 'prove' && p.prove.some((x) => x.posto === ctx.mio && !x.esito)) ? '<i class="dr-pallino"></i>' : ''}</button>`).join('');
      return `<div class="dr ${scena} ${cb ? 'dr-in-cb' : ''} dr-tab-${tab} dr-atm-${esc(p.atmosfera || 'calma')}">${gruppo(ctx)}${centro}${lato(ctx, schede)}<nav class="dr-nav">${nav}</nav>${scheda1}</div>`;
    },
    dopo(ctx) {
      ctx = locale(ctx);
      MU().aggiorna(ctx);
      VO().aggiorna(ctx);
      if (sipario(ctx)) return;
      const p = ctx.partita, ui = ctx.ui;
      CB().dopo(ctx);
      IN().dopo(ctx);
      if (DM().sonoDm(ctx)) DM().dopo(ctx);
      // scorrimento: il racconto resta in fondo se lo era (o se c'è una voce nuova del master)
      const ultimo = p.racconto.length ? p.racconto[p.racconto.length - 1].id : 0;
      const nuove = ultimo > (ui.drUltimaVoce || 0);
      for (const el of document.querySelectorAll('#panno [data-scorri]')) {
        const prima = (ui.drScorri || {})[el.dataset.scorri];
        if (el.dataset.scorri.startsWith('lato-') && !el.dataset.scorri.endsWith('racconto')) { if (prima) el.scrollTop = prima.top; continue; }
        if (!prima || prima.fondo || (nuove && ui.drUltimaVoce == null)) el.scrollTop = el.scrollHeight;
        else if (nuove) { el.scrollTop = prima.top; } else el.scrollTop = prima.top;
      }
      if (nuove && ui.drUltimaVoce != null) {
        const nuova = p.racconto.filter((v) => v.id > ui.drUltimaVoce);
        if (nuova.some((v) => v.tipo === 'master')) suono([[330, 0.06], [392, 0.06], [494, 0.1]], { tipo: 'sine', volume: 0.03 });
        else if (nuova.some((v) => v.tipo === 'tiro')) suono([[200, 0.03], [260, 0.03], [230, 0.04]], { tipo: 'square', volume: 0.02 });
      }
      ui.drUltimaVoce = ultimo;
      const cr = document.querySelector('#panno .dr-cr-corpo');
      if (cr && ui.drScorriCrea && ui.drScorriCrea.passo === cr.dataset.passo) cr.scrollTop = ui.drScorriCrea.top;
      // il cursore torna dove si stava scrivendo
      const k = ui.fuoco;
      if (k && !(window.Boss && window.Boss.attivo)) { const el = document.querySelector(`#panno [data-tieni="${k}"]`); if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* niente */ } } }
      // il conto alla rovescia delle dichiarazioni
      clearInterval(ui.drTimer);
      const conto = document.querySelector('#panno .dr-conto');
      if (conto) { const fine = Number(conto.dataset.fine); const agg = () => { const s = Math.max(0, Math.round((fine - Date.now()) / 1000)); conto.textContent = `· si manda tra ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }; agg(); ui.drTimer = setInterval(() => { if (!conto.isConnected) clearInterval(ui.drTimer); else agg(); }, 1000); }
      if (p.evento && p.evento.forte && primaVolta(ui, `dr-ev-${p.evento.id}`)) suono([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) {
      ctx = locale(ctx);
      const p = ctx.partita;
      if (sipario(ctx)) return `🔄 Tocca a ${nomeLocale(p, ctx.mio)}`;
      if (p.finita) return null;
      if (DM().sonoDm(ctx)) return p.fase === 'creazione' ? '🎩 Sei il master' : DM().stato(ctx);
      if (p.fase === 'creazione') return mioPg(ctx) ? 'Personaggio pronto' : 'Crea il tuo personaggio';
      if (p.attesaIA) return 'Il master scrive…';
      if (p.fase === 'prove') return p.prove.some((x) => x.posto === ctx.mio && !x.esito) ? '🎲 Tira i dadi!' : 'Si tirano i dadi…';
      if (p.fase === 'combattimento') { const cb = p.combattimento; if (!cb) return 'Combattimento'; if (CB().mioTurno(ctx)) return '⚔️ Tocca a te!'; const a = cb.creature.find((c) => c.id === cb.attivo); return a ? `Tocca a ${a.nome}` : 'Combattimento'; }
      if (p.fase === 'avventura') return p.dichiarazioni[ctx.mio] != null ? 'Aspettando gli altri…' : 'Cosa fai?';
      if (p.fase === 'reale') return '⏱️ Tempo reale';
      if (p.fase === 'caduti') return '💀 Scrivete !revive';
      return null;
    },
    tick(ctx, d) { IN().tick(ctx, d); MU().tick(ctx, d); },
    statoAttesa() { return null; },
    punteggio() { return ''; },
    infoPosto(ctx, posto) { const pg = ctx.partita.pg[posto]; return pg ? `${esc(pg.nome)} · ${pg.pf}/${pg.pfMax} PF` : posto === ctx.partita.dm ? '🎩 il master' : 'crea il personaggio'; },
    clic(ctx, el) {
      ctx = locale(ctx);
      const az = el.dataset.az, id = el.dataset.id, ui = ctx.ui, p = ctx.partita;
      if (az === 'dr-sipario') { const base = ctx.base.ui; base.drVisto = Number(id); for (const x of Object.keys(base)) if (x.startsWith('t_')) base[x] = null; base.fuoco = null; return ctx.ridisegna(); }
      if (az.startsWith('dr-cr-')) return CR().clic(ctx, el);
      if (az.startsWith('dr-cb-')) return CB().clic(ctx, el);
      if (az.startsWith('dr-in-') || az.startsWith('dr-re-')) return IN().clic(ctx, el);
      if (az.startsWith('dr-dm-')) return DM().clic(ctx, el);
      switch (az) {
        case 'dr-niente': return undefined;
        case 'dr-scheda': ui.drScheda = id; ui.t_note = null; return ctx.ridisegna();
        case 'dr-chiudi-scheda': ui.drScheda = null; ui.t_note = null; return ctx.ridisegna();
        case 'dr-tab': ui.drTab = id; if (id === 'mondo' && (!ui.drLato || ui.drLato === 'turno')) ui.drLato = p.combattimento ? 'racconto' : 'mappa'; if (id === 'battaglia') ui.drLato = 'turno'; return ctx.ridisegna();
        case 'dr-lato': ui.drLato = id; return ctx.ridisegna();
        case 'dr-compagnia': ui.drCompagnia = !ui.drCompagnia; return ctx.ridisegna();
        case 'dr-mappa-intera': ui.drMappaIntera = !ui.drMappaIntera; return ctx.ridisegna();
        case 'dr-luogo': ui.drLuogo = Number(id) || id; if (telefono()) { ui.drTab = 'mondo'; ui.drLato = 'mappa'; } return ctx.ridisegna();
        case 'dr-dichiara': {
          const t = String(ui.t_dich || '').trim();
          if (!t) return ctx.avviso('Scrivi cosa fa il tuo personaggio (o tocca «Seguo il gruppo»)');
          ui.t_dich = ''; ui.fuoco = null;
          suono([[440, 0.05], [550, 0.07]], { tipo: 'sine', volume: 0.03 });
          return ctx.invia({ tipo: 'dichiara', testo: t });
        }
        case 'dr-scrivitu': { const el2 = document.querySelector('#panno [data-tieni="dich"]'); if (el2) { el2.focus(); el2.placeholder = 'Scrivi qualsiasi cosa: parlare, rubare, mentire, sedurre, uccidere, fuggire… il master risponde di conseguenza'; } return undefined; }
        case 'dr-segui': ui.t_dich = ''; return ctx.invia({ tipo: 'dichiara', testo: '' });
        case 'dr-sugg': { const s = (p.scelte || [])[Number(el.dataset.k)]; if (s) { ui.t_dich = ui.t_dich && ui.t_dich.trim() ? `${ui.t_dich.trim()} ${s}` : s; ui.fuoco = 'dich'; } return ctx.ridisegna(); }
        case 'dr-rapido': ui.t_dich = el.dataset.t; ui.fuoco = 'dich'; return ctx.ridisegna();
        case 'dr-cambia': { const prima = p.dichiarazioni[ctx.mio]; ui.t_dich = prima || ''; ui.fuoco = 'dich'; return ctx.invia({ tipo: 'cambia' }); }
        case 'dr-manda': return ctx.invia({ tipo: 'manda' });
        case 'dr-riprova': return ctx.invia({ tipo: 'riprova' });
        case 'dr-tira': {
          const isp = document.querySelector('#panno [data-opz="isp"]'), bard = document.querySelector('#panno [data-opz="bard"]');
          suono([[300, 0.03], [380, 0.03], [260, 0.03], [420, 0.05]], { tipo: 'square', volume: 0.025 });
          return ctx.invia({ tipo: 'tira', id: Number(id), ispirazione: !!(isp && isp.checked), bardica: !!(bard && bard.checked) });
        }
        case 'dr-idea': return ctx.invia({ tipo: 'idea', testo: String(ui.t_idea != null ? ui.t_idea : p.idea || '') });
        case 'dr-inizia': if (ui.t_idea != null && ui.t_idea !== p.idea) ctx.invia({ tipo: 'idea', testo: String(ui.t_idea) }); return ctx.invia({ tipo: 'inizia' });
        case 'dr-rifai': ui.drScheda = null; return ctx.invia({ tipo: 'rifai' });
        case 'dr-note': ctx.invia({ tipo: 'note', testo: String(ui.t_note != null ? ui.t_note : '') }); return ctx.avviso('Appunti salvati');
        case 'dr-armatura': return ctx.invia({ tipo: 'equip', armatura: id || null });
        case 'dr-scudo': { const pg = mioPg(ctx); return ctx.invia({ tipo: 'equip', scudo: !(pg && pg.scudo) }); }
        case 'dr-salva': return ctx.invia({ tipo: 'salva' });
        case 'dr-termina': if (window.confirm('Chiudere la campagna per tutti? Se non l\'avete salvata (💾) non si può riprendere.')) return ctx.invia({ tipo: 'termina' }); return undefined;
        default: return undefined;
      }
    },
  };
  // Invio nella casella dell'azione = manda (Maiusc+Invio per andare a capo)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || !e.target || !e.target.matches || !e.target.matches('#panno textarea[data-tieni="dich"], #panno textarea[data-tieni="libera"]')) return;
    e.preventDefault();
    const b = document.querySelector(`#panno [data-az="${e.target.dataset.tieni === 'libera' ? 'dr-cb-libera' : 'dr-dichiara'}"]`); if (b && !b.disabled) b.click();
  });
  // Esc chiude la scheda
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const x = document.querySelector('#panno .dr-scheda .dr-x'); if (x) x.click(); } });
  Object.assign(window.Tavoli, { draghi: tavolo });
  // i pezzi del tavolo che usa anche la schermata del master (draghi-master.js)
  window.DraghiTavolo = { formatta, gruppo, racconto, testaStoria, mappa, missioni, diario, scheda, telefono, NOMI_AB };
})();
