// ESCAPE ROOM: le ambientazioni e gli enigmi. Ogni enigma è "generato" a ogni partita (colori, cifre, parole e regole
// cambiano sempre) ed è diviso in PARTI: ogni parte la vede un solo giocatore, così per risolverlo bisogna parlarsi.
// Un enigma è { tipo, icona, titolo, testo, lucchetto, soluzione, parti: [{ titolo, icona, blocchi }], aiuti }.
// I blocchi che il browser sa disegnare: testo, fila (simboli grandi con didascalia), tabella (coppie), griglia, lista.

const caso = (n) => Math.floor(Math.random() * n);
const prendi = (a) => a[caso(a.length)];
const mescola = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = caso(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cifreDiverse = (k) => mescola([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, k);

// ---------------- le ambientazioni (4 stanze ciascuna) ----------------
const TEMI = {
  laboratorio: {
    nome: 'Il laboratorio di Ottavio', emoji: '⚗️',
    intro: 'Il professor Ottavio Brina, inventore un po\' svitato, è sparito da una settimana. Siete entrati nella sua villa per cercarlo… e la porta si è chiusa a chiave alle vostre spalle.',
    fine: 'Fuori dalla villa trovate Ottavio in giardino che innaffia i pomodori: «Ah, siete riusciti a uscire? Allora le mie serrature funzionano!»',
    stanze: [
      { nome: 'Lo studio', emoji: '🖋️', testo: 'Una scrivania sommersa di fogli, un pendolo fermo sulle tre e un odore di caffè bruciato.' },
      { nome: 'La biblioteca', emoji: '📚', testo: 'Scaffali fino al soffitto, una scala con le ruote e una poltrona che cigola da sola.' },
      { nome: 'Il laboratorio', emoji: '🧪', testo: 'Provette che fumano, una lavagna piena di formule e un robot spento che vi fissa.' },
      { nome: 'L\'osservatorio', emoji: '🔭', testo: 'Una cupola di vetro, un telescopio puntato sulla luna e una botola che porta al tetto.' },
    ],
    contenitori: ['la cassaforte dietro il quadro', 'il cassetto della scrivania', 'il baule sotto la finestra', 'l\'armadietto dei reagenti', 'la scatola di latta', 'il mappamondo che si apre', 'il frigorifero degli esperimenti', 'la vetrina degli attrezzi', 'il pannello del robot', 'il carillon gigante', 'la teca del telescopio', 'lo sportello nel pavimento'],
    carte: ['un post-it del professore', 'una pagina strappata dal diario', 'un biglietto dentro un libro', 'gli appunti sulla lavagna', 'un tovagliolo scarabocchiato', 'la ricevuta di una ferramenta', 'un foglio nel cestino', 'il retro di una cartolina'],
  },
  faro: {
    nome: 'Il faro di Punta Nera', emoji: '🗼',
    intro: 'Una tempesta vi ha costretti a ripararvi nel vecchio faro abbandonato di Punta Nera. Appena dentro, la porta di ferro si è bloccata e la marea sta salendo.',
    fine: 'Uscite sul ballatoio proprio mentre la tempesta si calma: la lanterna si riaccende da sola e illumina il porto. Siete salvi!',
    stanze: [
      { nome: 'La rimessa delle barche', emoji: '🛶', testo: 'Reti da pesca, remi rotti e una barca capovolta. L\'acqua entra già da sotto la porta.' },
      { nome: 'L\'alloggio del guardiano', emoji: '🛏️', testo: 'Un letto sfatto, una stufa ancora tiepida e un diario di bordo aperto sul tavolo.' },
      { nome: 'La sala radio', emoji: '📻', testo: 'Una radio gracchiante, cartine nautiche alle pareti e un barometro impazzito.' },
      { nome: 'La lanterna', emoji: '💡', testo: 'In cima alla scala a chiocciola: la grande lente del faro e uno sportello verso il ballatoio.' },
    ],
    contenitori: ['il forziere del guardiano', 'la cassetta degli attrezzi', 'l\'armadio delle cerate', 'il baule delle reti', 'lo scrigno sotto il letto', 'la cassetta del pronto soccorso', 'lo sportello della radio', 'il cofano della barca', 'la scatola dei segnali', 'la teca del sestante', 'il quadro elettrico', 'la botola della cisterna'],
    carte: ['una pagina del diario di bordo', 'un messaggio in bottiglia', 'una carta nautica strappata', 'un telegramma bagnato', 'un biglietto sotto il cuscino', 'il retro di una foto', 'un foglio inchiodato al muro', 'una lettera mai spedita'],
  },
  stazione: {
    nome: 'Stazione orbitale Ginestra', emoji: '🛰️',
    intro: 'Vi svegliate sulla stazione orbitale Ginestra: l\'equipaggio è sparito e il computer di bordo ha sigillato tutti i portelli. L\'ossigeno basta ancora per poco.',
    fine: 'Il portello della capsula si apre: vi allacciate le cinture e la Terra vi aspetta, blu e bellissima, fuori dal finestrino.',
    stanze: [
      { nome: 'Il modulo di attracco', emoji: '🚪', testo: 'Tute spaziali appese, caschi che fluttuano e una spia rossa che lampeggia.' },
      { nome: 'La serra', emoji: '🌱', testo: 'Piante che crescono sotto luci viola e un innaffiatore automatico impazzito.' },
      { nome: 'La sala macchine', emoji: '⚙️', testo: 'Tubi che sibilano, ingranaggi enormi e un reattore che ronza piano.' },
      { nome: 'Il ponte di comando', emoji: '🧑‍🚀', testo: 'Schermi ovunque, poltrone girevoli e una vista mozzafiato sulla Terra.' },
    ],
    contenitori: ['l\'armadietto delle tute', 'il vano dei rifornimenti', 'il portello di servizio', 'la cassa dei semi', 'il terminale bloccato', 'lo sportello del reattore', 'la capsula delle provviste', 'il cassetto del comandante', 'il frigorifero dei campioni', 'il pannello dei sensori', 'la teca del casco', 'il vano dei razzi di segnalazione'],
    carte: ['un messaggio sul tablet del comandante', 'un foglio di manutenzione', 'una nota vocale trascritta', 'il registro di bordo', 'un post-it sul monitor', 'un adesivo sul casco', 'una schermata di errore', 'il retro di un manuale'],
  },
  scuola: {
    nome: 'Chiusi a scuola', emoji: '🏫',
    intro: 'Siete rimasti a scuola dopo l\'ultima campanella per finire un progetto. Quando uscite dall\'aula, il bidello ha già chiuso tutto e le luci si spengono una dopo l\'altra.',
    fine: 'Il portone si apre e il bidello vi guarda stupito: «E voi da dove spuntate?» Domani, però, nessuno vi crederà.',
    stanze: [
      { nome: 'L\'aula', emoji: '📝', testo: 'Banchi in disordine, la lavagna piena di compiti e uno zaino dimenticato sotto la cattedra.' },
      { nome: 'Il laboratorio di scienze', emoji: '🔬', testo: 'Uno scheletro di plastica, microscopi in fila e un acquario che gorgoglia.' },
      { nome: 'La biblioteca', emoji: '📖', testo: 'Libri impilati ovunque, un mappamondo polveroso e il cartello «SILENZIO».' },
      { nome: 'La presidenza', emoji: '🗄️', testo: 'Una scrivania enorme, coppe dei tornei e la chiave del portone… chiusa in un armadio.' },
    ],
    contenitori: ['il cassetto della cattedra', 'l\'armadietto della palestra', 'lo zaino dimenticato', 'il mobile dei microscopi', 'la cassetta del pronto soccorso', 'l\'armadio dei registri', 'la vetrina delle coppe', 'la scatola degli oggetti smarriti', 'il distributore di merendine', 'la cassaforte della presidenza', 'il bauletto del teatro', 'il mobiletto del bidello'],
    carte: ['un biglietto passato sotto il banco', 'un compito di matematica', 'la pagina di un diario', 'un avviso in bacheca', 'un foglio sotto la cattedra', 'un appunto sul registro', 'il retro di una pagella', 'un post-it sul computer'],
  },
};
const NOMI_TEMI = Object.keys(TEMI);

// ---------------- gli enigmi ----------------
const COLORI = [['🟥', 'rosso'], ['🟦', 'blu'], ['🟩', 'verde'], ['🟨', 'giallo'], ['🟪', 'viola'], ['🟧', 'arancione'], ['⬛', 'nero'], ['⬜', 'bianco']];
const PAROLE = ['LUNA', 'MARE', 'ROSA', 'FARO', 'NAVE', 'LUCE', 'FUGA', 'PANE', 'SOLE', 'TOPO', 'GATTO', 'PORTA', 'TORRE', 'NOTTE', 'VENTO', 'PIANO', 'MONDO', 'LIBRO', 'TEMPO', 'SALVO', 'FUOCO', 'CIELO', 'STELLA', 'CHIAVE'];

// 1) QUADRI: colori in fila sulla parete + un biglietto che trasforma i colori in cifre
function quadri({ contenitore, carta }) {
  const scelti = mescola(COLORI).slice(0, 6);
  const cifre = cifreDiverse(6);
  const parete = mescola(scelti.map((c, i) => [c, cifre[i]])).slice(0, 4);
  const contrario = Math.random() < 0.35;
  const ordine = contrario ? [...parete].reverse() : parete;
  const soluzione = ordine.map(([, d]) => d).join('');
  const tabella = mescola(scelti.map((c, i) => [`${c[0]} ${c[1]}`, String(cifre[i])]));
  return {
    tipo: 'quadri', icona: '🖼️', titolo: maiuscola(contenitore), testo: 'Un lucchetto a 4 cifre.',
    lucchetto: { tipo: 'cifre', n: 4 }, soluzione,
    parti: [
      { titolo: 'Sulla parete', icona: '🖼️', blocchi: [{ t: 'testo', v: 'Quattro quadretti colorati appesi in fila, da sinistra a destra:' }, { t: 'fila', v: parete.map(([c]) => ({ s: c[0], n: c[1] })) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: 'Ci sono scritti dei colori, ognuno con un numero:' }, { t: 'tabella', v: tabella }, ...(contrario ? [{ t: 'testo', v: 'In fondo, sottolineato due volte: «i quadri si leggono da DESTRA verso sinistra!»' }] : [])] },
    ],
    aiuti: ['Chi ha il biglietto sa che cifra vale ogni colore: chi vede la parete deve dire i colori nell\'ordine in cui sono appesi.', `La prima cifra della combinazione è ${soluzione[0]}.`],
  };
}

// 2) GRIGLIA: una griglia di lettere + un foglio di coordinate
function griglia({ contenitore, carta, usate }) {
  const parola = prendi(PAROLE.filter((p) => p.length <= 5 && !usate.has(p))) || 'LUNA';
  usate.add(parola);
  const COL = ['A', 'B', 'C', 'D', 'E'];
  const lettere = 'ABCDEFGILMNOPRSTUVZ';
  const g = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => lettere[caso(lettere.length)]));
  const caselle = mescola(Array.from({ length: 25 }, (_, i) => i)).slice(0, parola.length);
  const coord = caselle.map((k, i) => { const r = Math.floor(k / 5), c = k % 5; g[r][c] = parola[i]; return `${COL[c]}${r + 1}`; });
  return {
    tipo: 'griglia', icona: '🔤', titolo: maiuscola(contenitore), testo: `Un lucchetto con ${parola.length} rotelle di lettere.`,
    lucchetto: { tipo: 'parola', n: parola.length }, soluzione: parola,
    parti: [
      { titolo: 'Una griglia incisa sul legno', icona: '🔠', blocchi: [{ t: 'testo', v: 'Lettere incise in una griglia: in alto le colonne, a sinistra le righe.' }, { t: 'griglia', col: COL, righe: g.map((r, i) => [String(i + 1), ...r]) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: 'Una fila di sigle, una dopo l\'altra:' }, { t: 'fila', v: coord.map((c) => ({ s: c })) }] },
    ],
    aiuti: ['La lettera della sigla è la colonna, il numero è la riga: chi ha la griglia legge la lettera di ogni casella detta da chi ha il foglio.', `La parola comincia con ${parola[0]}.`],
  };
}

// 3) EQUAZIONI: tre frutti che valgono tre cifre, le operazioni sparse tra i giocatori
const FRUTTI = ['🍎', '🍌', '🍇', '🍒', '🍋', '🍐', '🥝', '🍑'];
function equazioni({ contenitore, carta }) {
  const [x, y, z] = mescola(FRUTTI).slice(0, 3);
  const [a, b, c] = mescola([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
  const valore = { [x]: a, [y]: b, [z]: c };
  const ordine = mescola([x, y, z]);
  const soluzione = ordine.map((f) => valore[f]).join('');
  const terza = Math.random() < 0.5 ? `${y} × ${z} = ${b * c}` : `${z} + ${z} + ${y} = ${2 * c + b}`;
  return {
    tipo: 'equazioni', icona: '🧮', titolo: maiuscola(contenitore), testo: 'Un lucchetto a 3 rotelle: sotto ogni rotella è disegnato un frutto.',
    lucchetto: { tipo: 'cifre', n: 3 }, soluzione,
    parti: [
      { titolo: 'Scritto col gesso', icona: '✏️', blocchi: [{ t: 'testo', v: 'Ogni frutto vale una cifra diversa (da 1 a 9):' }, { t: 'lista', v: [`${x} + ${x} = ${2 * a}`] }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'lista', v: [`${x} + ${y} = ${a + b}`] }] },
      { titolo: 'Sotto il lucchetto', icona: '🔍', blocchi: [{ t: 'lista', v: [terza] }, { t: 'testo', v: 'I frutti disegnati sotto le rotelle, da sinistra a destra:' }, { t: 'fila', v: ordine.map((f) => ({ s: f })) }] },
    ],
    aiuti: [`Si parte da ${x} + ${x}: è la metà del risultato. Poi ${y}, poi ${z}.`, `${x} vale ${a} e ${y} vale ${b}.`],
  };
}

// 4) LEVE: un pannello di leve con dei disegni + un biglietto che dice quali alzare
const CATEGORIE = [
  { frase: 'un animale', v: [['🐱', 'gatto'], ['🐟', 'pesce'], ['🦉', 'gufo'], ['🐸', 'rana'], ['🐴', 'cavallo'], ['🐢', 'tartaruga']] },
  { frase: 'un frutto', v: [['🍎', 'mela'], ['🍐', 'pera'], ['🍋', 'limone'], ['🍇', 'uva'], ['🍒', 'ciliegie'], ['🍉', 'anguria']] },
  { frase: 'uno strumento musicale', v: [['🎻', 'violino'], ['🥁', 'tamburo'], ['🎺', 'tromba'], ['🎸', 'chitarra'], ['🎹', 'pianoforte'], ['🪗', 'fisarmonica']] },
  { frase: 'un mezzo di trasporto', v: [['🚲', 'bicicletta'], ['🚗', 'auto'], ['⛵', 'barca a vela'], ['✈️', 'aereo'], ['🚂', 'treno'], ['🚁', 'elicottero']] },
  { frase: 'qualcosa del meteo', v: [['☀️', 'sole'], ['🌧️', 'pioggia'], ['❄️', 'neve'], ['⚡', 'fulmine'], ['🌈', 'arcobaleno'], ['🌪️', 'tornado']] },
];
function leve({ contenitore, carta }) {
  const [giusta, ...altre] = mescola(CATEGORIE);
  const k = 2 + caso(2); // 2 o 3 leve da alzare
  const su = mescola(giusta.v).slice(0, k);
  const giu = mescola(altre.flatMap((c) => c.v)).slice(0, 6 - k);
  const pannello = mescola([...su.map((x) => [x, 1]), ...giu.map((x) => [x, 0])]);
  const soluzione = pannello.map(([, s]) => s).join('');
  const prima = pannello.findIndex(([, s]) => s);
  return {
    tipo: 'leve', icona: '🎚️', titolo: maiuscola(contenitore), testo: 'Si apre con un pannello di 6 leve numerate: ognuna va su o giù.',
    lucchetto: { tipo: 'leve', n: 6 }, soluzione,
    parti: [
      { titolo: 'Il pannello delle leve', icona: '🎚️', blocchi: [{ t: 'testo', v: 'Su ogni leva è dipinto un disegno:' }, { t: 'fila', v: pannello.map(([x], i) => ({ s: x[0], n: `${i + 1}. ${x[1]}` })) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: `«Alza solo le leve con ${giusta.frase}. Tutte le altre restano giù.»` }] },
    ],
    aiuti: ['Chi ha il biglietto sa quali leve alzare, chi vede il pannello sa cosa c\'è disegnato su ogni leva.', `La leva numero ${prima + 1} va alzata.`],
  };
}

// 5) LAMPEGGI: una luce che lampeggia gruppi di punti e linee + una tabella che li traduce in cifre (sempre diversa)
function lampeggi({ contenitore, carta }) {
  const segni = mescola(Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, '0'))).slice(0, 10)
    .map((b) => b.split('').map((x) => (x === '1' ? '▬' : '●')).join(' '));
  const cifre = Array.from({ length: 4 }, () => caso(10));
  const soluzione = cifre.join('');
  return {
    tipo: 'lampeggi', icona: '💡', titolo: maiuscola(contenitore), testo: 'Un tastierino a 4 cifre. Accanto, una lampadina continua a lampeggiare.',
    lucchetto: { tipo: 'cifre', n: 4 }, soluzione,
    parti: [
      { titolo: 'La lampadina', icona: '💡', blocchi: [{ t: 'testo', v: 'Lampeggia sempre uguale: lampi corti (●) e lunghi (▬), con una pausa tra un gruppo e l\'altro.' }, { t: 'fila', v: cifre.map((c, i) => ({ s: segni[c], n: `${i + 1}º gruppo` })) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: 'Un codice segreto per le cifre:' }, { t: 'tabella', v: segni.map((s, d) => [s, String(d)]) }] },
    ],
    aiuti: ['Chi vede la lampadina detta i quattro gruppi di lampi, chi ha il codice li trasforma in cifre.', `La prima cifra è ${soluzione[0]}.`],
  };
}

// 6) FILI: al buio, uno vede i colori dei fili e un altro ha il manuale con le regole per sapere quale tagliare
const FILI = [['🟥', 'rosso'], ['🟦', 'blu'], ['🟨', 'giallo'], ['⬜', 'bianco'], ['⬛', 'nero'], ['🟩', 'verde']];
const PLURALE = { rosso: 'rossi', blu: 'blu', giallo: 'gialli', bianco: 'bianchi', nero: 'neri', verde: 'verdi' };
const ORD = ['primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto'];
function regoleFili(n) {
  const col = () => prendi(FILI)[1];
  const kk = () => caso(n);
  const modelli = [
    () => { const c = col(), k = kk(); return { t: `Se non c'è nessun filo ${c}, taglia il ${ORD[k]} filo.`, f: (w) => (!w.includes(c) ? k : null) }; },
    () => { const c = col(); return { t: `Se l'ultimo filo è ${c}, taglia il primo filo.`, f: (w) => (w[w.length - 1] === c ? 0 : null) }; },
    () => { const c = col(); return { t: `Se c'è più di un filo ${c}, taglia l'ultimo filo ${c}.`, f: (w) => (w.filter((x) => x === c).length > 1 ? w.lastIndexOf(c) : null) }; },
    () => { const c = col(), k = kk(); return { t: `Se il primo filo è ${c}, taglia il ${ORD[k]} filo.`, f: (w) => (w[0] === c ? k : null) }; },
    () => { const c = col(); return { t: `Se c'è esattamente un filo ${c}, taglia proprio quello.`, f: (w) => (w.filter((x) => x === c).length === 1 ? w.indexOf(c) : null) }; },
    () => { const a = col(); let b = col(); while (b === a) b = col(); return { t: `Se ci sono più fili ${PLURALE[a]} che fili ${PLURALE[b]}, taglia l'ultimo filo.`, f: (w) => (w.filter((x) => x === a).length > w.filter((x) => x === b).length ? w.length - 1 : null) }; },
  ];
  const regole = mescola(modelli).slice(0, 4).map((m) => m());
  const k = kk();
  regole.push({ t: `Altrimenti taglia il ${ORD[k]} filo.`, f: () => k });
  return regole;
}
function fili({ contenitore }) {
  const n = 4 + caso(3);
  let w, regole, scelta, quale;
  // si cerca una combinazione in cui non vale sempre la stessa regola (meglio se non l'ultima)
  for (let tent = 0; tent < 30; tent++) {
    w = Array.from({ length: n }, () => prendi(FILI)[1]);
    regole = regoleFili(n);
    quale = regole.findIndex((r) => r.f(w) !== null);
    scelta = regole[quale].f(w);
    if (quale < regole.length - 1 || tent > 20) break;
  }
  const emoji = Object.fromEntries(FILI.map(([e, c]) => [c, e]));
  return {
    tipo: 'fili', icona: '✂️', titolo: maiuscola(contenitore), testo: `Un congegno elettrico con ${n} fili blocca la serratura. È buio: senza torcia i fili sembrano tutti grigi. Taglia quello giusto: sbagliare costa caro!`,
    lucchetto: { tipo: 'filo', n }, soluzione: String(scelta + 1), penalita: 2,
    parti: [
      { titolo: 'La torcia', icona: '🔦', blocchi: [{ t: 'testo', v: 'Con la torcia vedi i colori dei fili, dall\'alto in basso:' }, { t: 'fila', v: w.map((c, i) => ({ s: emoji[c], n: `${i + 1}. ${c}` })) }] },
      { titolo: 'Il manuale degli artificieri', icona: '📕', blocchi: [{ t: 'testo', v: 'Leggi le regole in ordine e fermati alla prima che vale:' }, { t: 'lista', v: regole.map((r) => r.t), numerata: true }] },
    ],
    aiuti: ['Chi ha il manuale legge una regola alla volta, chi ha la torcia dice se vale guardando i colori. Ci si ferma alla prima vera.', `La regola che vale è la numero ${quale + 1}.`],
  };
}

// 7) IMPRONTE: simboli sul pavimento + una rosa dei venti (a volte allo specchio) → frecce
const DIREZIONI = [['U', '↑', 'nord'], ['R', '→', 'est'], ['D', '↓', 'sud'], ['L', '←', 'ovest']];
function impronte({ contenitore, carta }) {
  const simboli = mescola(['☾', '✦', '◆', '✿', '♣', '☀']).slice(0, 4);
  const dir = mescola(DIREZIONI);
  const specchio = Math.random() < 0.3;
  const seq = Array.from({ length: 5 }, () => caso(4));
  const vera = (d) => (specchio && d[0] === 'R' ? 'L' : specchio && d[0] === 'L' ? 'R' : d[0]);
  const soluzione = seq.map((i) => vera(dir[i])).join('');
  const prima = DIREZIONI.find((d) => d[0] === soluzione[0]);
  return {
    tipo: 'impronte', icona: '🧭', titolo: maiuscola(contenitore), testo: 'Un lucchetto a frecce: 5 spinte, su, giù, a sinistra o a destra.',
    lucchetto: { tipo: 'frecce', n: 5 }, soluzione,
    parti: [
      { titolo: 'Sul pavimento', icona: '🐾', blocchi: [{ t: 'testo', v: 'Una fila di simboli dipinti sul pavimento, uno dopo l\'altro:' }, { t: 'fila', v: seq.map((i) => ({ s: simboli[i] })) }] },
      { titolo: maiuscola(carta), icona: '🧭', blocchi: [{ t: 'testo', v: 'Una rosa dei venti con un simbolo su ogni punta:' }, { t: 'tabella', v: simboli.map((s, i) => [s, `${dir[i][2]} ${dir[i][1]}`]) }, ...(specchio ? [{ t: 'testo', v: 'Sotto, a matita: «Attenzione! La rosa è disegnata allo specchio: est e ovest sono scambiati.»' }] : [])] },
    ],
    aiuti: ['Ogni simbolo del pavimento è una direzione: chi ha la rosa dei venti la traduce in frecce (nord = su, sud = giù…).', `La prima freccia è ${prima[1]} (${prima[2]}).`],
  };
}

// 8) LIBRI: chi vede le cifre sui dorsi, chi le altezze, chi la regola per metterli in fila
const LIBRI = [['📕', 'rosso'], ['📗', 'verde'], ['📘', 'blu'], ['📙', 'arancione'], ['📓', 'nero']];
function libri({ carta }) {
  const cifre = cifreDiverse(5);
  const altezze = mescola([18, 20, 22, 24, 26, 28, 30, 32, 34]).slice(0, 5);
  const alti = Math.random() < 0.5;
  const crescente = Math.random() < 0.5;
  // i 4 più alti (o più bassi), poi in fila dal più basso al più alto (o il contrario)
  const ord = LIBRI.map((_, i) => i).sort((a, b) => (alti ? altezze[b] - altezze[a] : altezze[a] - altezze[b])).slice(0, 4);
  ord.sort((a, b) => (crescente ? altezze[a] - altezze[b] : altezze[b] - altezze[a]));
  const soluzione = ord.map((i) => cifre[i]).join('');
  return {
    tipo: 'libri', icona: '📚', titolo: 'La libreria segreta', testo: 'Un lucchetto a 4 cifre nascosto dietro una fila di libri.',
    lucchetto: { tipo: 'cifre', n: 4 }, soluzione,
    parti: [
      { titolo: 'I dorsi dei libri', icona: '📚', blocchi: [{ t: 'testo', v: 'Su ogni dorso è scritta una cifra:' }, { t: 'tabella', v: LIBRI.map(([e, c], i) => [`${e} libro ${c}`, String(cifre[i])]) }] },
      { titolo: 'Il metro da sarta', icona: '📏', blocchi: [{ t: 'testo', v: 'Qualcuno ha misurato i libri e ha scritto le altezze:' }, { t: 'tabella', v: LIBRI.map(([e, c], i) => [`${e} ${c}`, `${altezze[i]} cm`]) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: `«La combinazione: le cifre dei 4 libri più ${alti ? 'alti' : 'bassi'}, messi in fila ${crescente ? 'dal più basso al più alto' : 'dal più alto al più basso'}.»` }] },
    ],
    aiuti: ['Servono tutti e tre: la regola dice quali libri prendere, le misure dicono in che ordine, i dorsi danno le cifre.', `La prima cifra è ${soluzione[0]}.`],
  };
}

// 9) INIZIALI: oggetti con un cartellino numerato + l'ordine dei cartellini → una parola con le iniziali
const OGGETTI = {
  A: ['🪝 amo da pesca', '🐝 ape di peluche', '🪁 aquilone'], B: ['🍾 bottiglia', '🧭 bussola', '🪣 bidone'], C: ['🕯️ candela', '🗝️ chiave', '🪢 corda'],
  D: ['🎲 dado', '💎 diamante'], E: ['🪖 elmo', '🌿 edera'], F: ['🌸 fiore', '✂️ forbici', '🔦 faro tascabile'],
  G: ['🧤 guanto', '🦒 giraffa di legno'], I: ['🧪 imbuto', '🪪 identikit'], L: ['🏮 lanterna', '📖 libro', '🔍 lente'],
  M: ['🗺️ mappa', '🔨 martello', '🧩 mattoncino'], N: ['🎀 nastro', '🪺 nido'], O: ['⏰ orologio', '☂️ ombrello', '🐻 orsacchiotto'],
  P: ['🖌️ pennello', '🪶 piuma', '🍐 pera di legno'], R: ['📻 radio', '📏 righello', '🌹 rosa finta'], S: ['🪑 sedia', '🪞 specchio', '🧦 sacchetto'],
  T: ['☕ tazza', '🥁 tamburo', '🪀 trottola'], U: ['🥚 uovo', '🦉 uccellino di legno'], V: ['🏺 vaso', '🎻 violino'], Z: ['🎒 zaino', '🪵 zoccolo'],
};
function iniziali({ carta, usate }) {
  const adatte = PAROLE.filter((p) => p.length <= 6 && !usate.has(p) && [...p].every((l) => OGGETTI[l]));
  const parola = prendi(adatte.length ? adatte : ['LUNA']);
  usate.add(parola);
  const presi = new Set();
  const oggetti = [...parola].map((l) => { const o = prendi(OGGETTI[l].filter((x) => !presi.has(x)).length ? OGGETTI[l].filter((x) => !presi.has(x)) : OGGETTI[l]); presi.add(o); return o; });
  // due oggetti in più che non servono (con un cartellino che non compare nell'ordine)
  const extra = mescola(Object.values(OGGETTI).flat().filter((o) => !presi.has(o))).slice(0, 2);
  const cartellini = mescola([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, oggetti.length + extra.length);
  const elenco = mescola([...oggetti, ...extra].map((o, i) => [o, cartellini[i]]));
  return {
    tipo: 'iniziali', icona: '🏷️', titolo: 'Il baule degli oggetti smarriti', testo: `Un lucchetto con ${parola.length} rotelle di lettere.`,
    lucchetto: { tipo: 'parola', n: parola.length }, soluzione: parola,
    parti: [
      { titolo: 'Gli oggetti sul tavolo', icona: '🏷️', blocchi: [{ t: 'testo', v: 'Ogni oggetto ha un cartellino con un numero:' }, { t: 'tabella', v: elenco.map(([o, n]) => [o, `cartellino ${n}`]) }] },
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: '«Segui i cartellini in quest\'ordine e prendi la PRIMA lettera di ogni oggetto»:' }, { t: 'fila', v: cartellini.slice(0, oggetti.length).map((n) => ({ s: String(n) })) }] },
    ],
    aiuti: ['Chi ha l\'ordine dei cartellini li dice uno alla volta; chi vede gli oggetti dice come si chiama l\'oggetto con quel cartellino.', `La parola comincia con ${parola[0]}.`],
  };
}

// 10) TELEFONO: un messaggio con una parola + un vecchio telefono con le lettere sui tasti (sempre mescolate)
function telefono({ contenitore, carta, usate }) {
  const parola = prendi(PAROLE.filter((p) => p.length <= 5 && !usate.has(p))) || 'MARE';
  usate.add(parola);
  const lettere = mescola('ABCDEFGHILMNOPQRSTUVZ'.split(''));
  const tasti = {};
  lettere.forEach((l, i) => { const d = 2 + (i % 8); (tasti[d] = tasti[d] || []).push(l); });
  const di = {}; for (const [d, ls] of Object.entries(tasti)) for (const l of ls) di[l] = d;
  const soluzione = [...parola].map((l) => di[l]).join('');
  return {
    tipo: 'telefono', icona: '☎️', titolo: maiuscola(contenitore), testo: `Un tastierino da telefono: servono ${parola.length} cifre.`,
    lucchetto: { tipo: 'cifre', n: parola.length }, soluzione,
    parti: [
      { titolo: maiuscola(carta), icona: '📝', blocchi: [{ t: 'testo', v: `«Per aprire, chiama ${parola}.»` }] },
      { titolo: 'Il vecchio telefono', icona: '☎️', blocchi: [{ t: 'testo', v: 'Un telefono a tasti con le lettere tutte mescolate:' }, { t: 'tabella', v: Object.entries(tasti).map(([d, ls]) => [`tasto ${d}`, ls.sort().join(' ')]) }] },
    ],
    aiuti: ['Ogni lettera della parola è su un tasto del telefono: il numero del tasto è la cifra.', `La parola da "chiamare" comincia con ${parola[0]}: è sul tasto ${soluzione[0]}.`],
  };
}

// 11) SPARTITO: le note di una melodia + i colori dei tasti → si suonano i tasti colorati nell'ordine giusto
const NOTE = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];
const TASTI_COLORE = [['🔴', 'rosso'], ['🔵', 'blu'], ['🟢', 'verde'], ['🟡', 'giallo'], ['🟣', 'viola'], ['🟠', 'arancione']];
function spartito({ contenitore, carta }) {
  const note = mescola(NOTE).slice(0, 6);
  const colori = mescola(TASTI_COLORE.map((_, i) => i));
  const melodia = Array.from({ length: 5 }, () => caso(6));
  const soluzione = melodia.map((i) => colori[i]).join('');
  return {
    tipo: 'spartito', icona: '🎼', titolo: maiuscola(contenitore), testo: 'Un piccolo pianoforte con 6 tasti colorati: bisogna suonare la melodia giusta (5 note).',
    lucchetto: { tipo: 'colori', n: 5, colori: TASTI_COLORE.map(([e, c]) => ({ e, c })) }, soluzione,
    parti: [
      { titolo: 'Lo spartito', icona: '🎼', blocchi: [{ t: 'testo', v: 'Uno spartito sul leggio, con le note scritte in grande:' }, { t: 'fila', v: melodia.map((i) => ({ s: note[i] })) }] },
      { titolo: maiuscola(carta), icona: '🎹', blocchi: [{ t: 'testo', v: 'Che nota suona ogni tasto colorato:' }, { t: 'tabella', v: note.map((n, i) => [n, `${TASTI_COLORE[colori[i]][0]} ${TASTI_COLORE[colori[i]][1]}`]) }] },
    ],
    aiuti: ['Chi ha lo spartito legge le note in ordine, chi sa i colori dei tasti dice quale tasto premere.', `Il primo tasto è ${TASTI_COLORE[colori[melodia[0]]][1]}.`],
  };
}

const FACILI = { quadri, griglia, leve, telefono, impronte, spartito };
const DIFFICILI = { equazioni, lampeggi, fili, libri, iniziali };
const GENERATORI = { ...FACILI, ...DIFFICILI };

// la porta di ogni stanza: ogni enigma risolto dà un frammento con un simbolo e una cifra; sulla porta ci sono gli incavi
const SIMBOLI_PORTA = ['◆', '●', '▲', '■', '★', '✚', '☾', '♥'];

module.exports = { TEMI, NOMI_TEMI, GENERATORI, FACILI, DIFFICILI, SIMBOLI_PORTA, mescola, caso, prendi };
