// FRITTATA!: le carte, uguali per il server (require) e per il browser (window.FrittataCarte). Nomi, testi e battute
// sono originali del sito.
(function (radice, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea();
  else radice.FrittataCarte = crea();
}(typeof window !== 'undefined' ? window : globalThis, () => {
  // le carte: tipo azione (si gioca nel proprio turno), trappola (si piazza coperta), contro (si gioca in risposta)
  // bers: l'azione si fa contro un altro giocatore (e può far scattare le sue trappole "quando ti prendono di mira")
  const CARTE = {
    // ---- AZIONI ----
    piccione: { tipo: 'azione', nome: 'Piccione postino', emoji: '🐦', quante: 5, testo: 'Pesca 3 carte.', battuta: 'Porta la posta. Anche quella degli altri.' },
    calzini: { tipo: 'azione', nome: 'Ladro di calzini', emoji: '🧦', quante: 5, bers: true, testo: 'Ruba 2 carte a caso a un giocatore.', battuta: 'Ne prende sempre uno solo per paio.' },
    zia: { tipo: 'azione', nome: 'Zia Pina ha cucinato', emoji: '🍝', quante: 3, testo: 'Tutti gli altri pescano 2 carte.', battuta: '"Mangia, che sei sciupato."' },
    starnuto: { tipo: 'azione', nome: 'Starnuto atomico', emoji: '🤧', quante: 4, bers: true, testo: 'Un giocatore scarta 3 carte a caso.', battuta: 'Salute! Anche alle tue carte.' },
    cervelli: { tipo: 'azione', nome: 'Scambio di cervelli', emoji: '🧠', quante: 2, bers: true, testo: 'Scambia tutta la tua mano con quella di un giocatore.', battuta: 'Il tuo pensava solo ai criceti.' },
    regalo: { tipo: 'azione', nome: 'Pacco regalo sospetto', emoji: '🎁', quante: 4, bers: true, testo: 'Dai 3 carte a caso della tua mano a un giocatore.', battuta: 'Ticchetta. È normale.' },
    gatto: { tipo: 'azione', nome: 'Il gatto sul tavolo', emoji: '🐈', quante: 3, testo: 'Ogni altro giocatore scarta 1 carta a caso.', battuta: 'Guarda la carta. Guarda te. La butta giù.' },
    giostra: { tipo: 'azione', nome: 'Giro di giostra', emoji: '🎠', quante: 2, testo: 'Tutti passano la propria mano al giocatore che viene dopo.', battuta: 'Nessuno scende finché non vomita il cavallo.' },
    mucca: { tipo: 'azione', nome: 'Mucca in salotto', emoji: '🐄', quante: 4, bers: true, testo: 'Un giocatore pesca 3 carte.', battuta: 'Nessuno sa come sia entrata.' },
    bidone: { tipo: 'azione', nome: 'Rovista nel bidone', emoji: '🗑️', quante: 3, testo: 'Prendi in mano le ultime 3 carte scartate.', battuta: 'Era ancora buono. Più o meno.' },
    tornado: { tipo: 'azione', nome: 'Tornado di coriandoli', emoji: '🌪️', quante: 3, bers: true, testo: 'Tutte le trappole di un giocatore vengono scartate.', battuta: 'Carnevale non avvisa.' },
    dieta: { tipo: 'azione', nome: 'Dieta del criceto', emoji: '🐹', quante: 2, bers: true, testo: 'Un giocatore scarta metà delle sue carte (a caso).', battuta: 'Mezzo seme a pranzo, mezzo a cena.' },
    dentista: { tipo: 'azione', nome: 'Il dentista dice 5', emoji: '🦷', quante: 2, bers: true, testo: 'Un giocatore pesca o scarta (a caso) finché non ha esattamente 5 carte.', battuta: '"Apra bene. Di più. Ancora."' },
    // ---- TRAPPOLE (si piazzano coperte, massimo 3; scattano da sole) ----
    specchio: { tipo: 'trappola', nome: 'Specchio della nonna', emoji: '🪞', quante: 3, scatta: 'mira', testo: 'Quando un\'Azione ti prende di mira, colpisce invece chi l\'ha giocata.', battuta: 'Riflette tutto. Tranne sulle sue scelte.' },
    cane: { tipo: 'trappola', nome: 'Cane da guardia', emoji: '🐕', quante: 3, scatta: 'mira', testo: 'Quando un\'Azione ti prende di mira, viene annullata e chi l\'ha giocata pesca 2 carte.', battuta: 'Si chiama Fuffi. Morde lo stesso.' },
    padella: { tipo: 'trappola', nome: 'Padella bucata', emoji: '🍳', quante: 2, scatta: 'frittata', testo: 'Quando un altro grida "Frittata!", la frittata cola via: niente vittoria e scarta 2 carte a caso.', battuta: 'L\'uovo è passato di qui. Il resto no.' },
    retino: { tipo: 'trappola', nome: 'Retino acchiappatutto', emoji: '🥅', quante: 3, scatta: 'pesca', testo: 'Quando un altro pesca la carta del suo turno, finisce a te.', battuta: 'Acchiappa farfalle, carte e un gatto di passaggio.' },
    // ---- CONTRO (in risposta, anche fuori turno) ----
    nograzie: { tipo: 'contro', nome: 'No, grazie!', emoji: '🙅', quante: 8, testo: 'Annulla un\'Azione, una Trappola che scatta o un altro Contro.', battuta: 'Detto con educazione. Molta.' },
    gas: { tipo: 'contro', nome: 'Ho lasciato il gas acceso', emoji: '🔥', quante: 4, testo: 'Annulla un\'Azione, una Trappola o un Contro, e tu peschi 1 carta.', battuta: 'Corri a casa. Ma prima: no.' },
    avvocato: { tipo: 'contro', nome: 'Il mio avvocato è un criceto', emoji: '⚖️', quante: 4, testo: 'Annulla un\'Azione, una Trappola o un Contro, e chi l\'aveva giocata pesca 1 carta.', battuta: 'Obiezione! Squit.' },
    nonora: { tipo: 'contro', nome: 'Non è ancora ora!', emoji: '⏰', quante: 3, frittata: true, testo: 'Si gioca SOLO contro una "Frittata!": la annulla e chi l\'ha gridata pesca 1 carta.', battuta: 'Le uova sono ancora nella gallina.' },
  };
  return CARTE;
}));
