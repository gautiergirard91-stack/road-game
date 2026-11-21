export const WINDOWS = { perfect: 45, good: 100, passable: 160 };

export const MAX_MISSES = 3;
export const CONTINUE_BASE_COST = 100;

export const DIFFICULTIES = [
  { id: 'auto', name: 'Auto école', desc: "Tap n'importe où quand les roues touchent la ligne" },
  { id: 'permisA', name: 'Permis A', desc: "Haut de l'écran = roues avant (AV), bas de l'écran = roues arrière (AR)" },
  { id: 'pilote', name: 'Pilote', desc: 'Permis A + voitures devant : swipe vers la gauche pour doubler, sinon bouchon !' },
];

// Une monnaie par difficulté : on gagne celle du mode joué, et chaque niveau
// se débloque (dans l'ordre) avec la monnaie de son palier -> on progresse
// niveau par niveau et on ne peut pas acheter le dernier niveau directement.
export const CURRENCIES = {
  auto: { icon: '🪙', name: 'Pièces' },
  permisA: { icon: '🎓', name: 'Badges permis' },
  pilote: { icon: '🏁', name: 'Trophées' },
};

export const THEMES = {
  autoroute: {
    id: 'autoroute', name: 'Autoroute', scenery: 'trees', night: false,
    skyTop: '#6fb9f2', skyBottom: '#d8efff', shoulder: '#3f9e4d',
    road: '#3d4250', edge: '#e8e8e8', line: '#ffffff', lineEdge: '#23262e', centerLine: '#f7d154',
  },
  ville: {
    id: 'ville', name: 'Ville', scenery: 'buildings', night: false,
    skyTop: '#ffb46b', skyBottom: '#ffe3b8', shoulder: '#8d939e',
    road: '#484d59', edge: '#f2f2f2', line: '#ffffff', lineEdge: '#23262e', centerLine: '#f7d154',
  },
  desert: {
    id: 'desert', name: 'Désert', scenery: 'cacti', night: false,
    skyTop: '#ff9e5e', skyBottom: '#ffd9a1', shoulder: '#e3c188',
    road: '#6e6353', edge: '#fff6e0', line: '#ffffff', lineEdge: '#4a4034', centerLine: '#fff6e0',
  },
  neige: {
    id: 'neige', name: 'Neige', scenery: 'pines', night: false,
    skyTop: '#9fc6e8', skyBottom: '#eef7ff', shoulder: '#f6fbff',
    road: '#8fa3bd', edge: '#ffffff', line: '#ffffff', lineEdge: '#5c7186', centerLine: '#dfe9f5',
  },
  nuit: {
    id: 'nuit', name: 'Nuit', scenery: 'citynight', night: true,
    skyTop: '#070b1d', skyBottom: '#1c2b52', shoulder: '#10142a',
    road: '#151824', edge: '#3a4160', line: '#54f0ff', lineEdge: '#0a2a33', centerLine: '#2c3350',
  },
  neon: {
    id: 'neon', name: 'Néon', scenery: 'citynight', night: true,
    skyTop: '#160b2e', skyBottom: '#3b1160', shoulder: '#1a0f33',
    road: '#1c1030', edge: '#ff4fd8', line: '#ff4fd8', lineEdge: '#3a0a2e', centerLine: '#54f0ff',
  },
  sunset: {
    id: 'sunset', name: 'Coucher de soleil', scenery: 'trees', night: false,
    skyTop: '#ff7e5f', skyBottom: '#feb47b', shoulder: '#a05a78',
    road: '#4a3244', edge: '#ffd9a0', line: '#fff1d6', lineEdge: '#4a2438', centerLine: '#ffd9a0',
  },
};

export const LEVELS = [
  { id: 1, name: 'Premiers tours', theme: 'autoroute', diff: 'auto', speed: 270, lines: 10, gapMin: 460, gapMax: 700, w: { dash: 1 }, pDouble: 0, cost: 0 },
  { id: 2, name: 'Accélération', theme: 'autoroute', diff: 'auto', speed: 300, lines: 18, gapMin: 420, gapMax: 620, w: { dash: 1 }, pDouble: 0.15, cost: 150 },
  { id: 3, name: 'Double file', theme: 'autoroute', diff: 'auto', speed: 340, lines: 20, gapMin: 400, gapMax: 560, w: { dash: 0.7, band: 0.3 }, pDouble: 0.3, cost: 300 },
  { id: 4, name: 'En ville', theme: 'ville', diff: 'auto', speed: 340, lines: 34, gapMin: 390, gapMax: 560, w: { dash: 0.6, chevron: 0.4 }, pDouble: 0.2, cost: 500, crosswalk: true },
  { id: 5, name: 'Heures de pointe', theme: 'ville', diff: 'auto', speed: 380, lines: 36, gapMin: 360, gapMax: 520, w: { dash: 0.5, band: 0.25, chevron: 0.25 }, pDouble: 0.3, cost: 800, crosswalk: true },
  { id: 6, name: 'Désert', theme: 'desert', diff: 'permisA', speed: 380, lines: 38, gapMin: 350, gapMax: 500, w: { dash: 0.5, band: 0.3, chevron: 0.2 }, pDouble: 0.25, cost: 1200 },
  { id: 7, name: 'Coucher de soleil', theme: 'desert', diff: 'permisA', speed: 420, lines: 40, gapMin: 330, gapMax: 480, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.35, cost: 1800 },
  { id: 8, name: 'Nuit', theme: 'nuit', diff: 'permisA', speed: 420, lines: 40, gapMin: 330, gapMax: 470, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.3, cost: 2600 },
  { id: 9, name: 'Néon', theme: 'nuit', diff: 'permisA', speed: 470, lines: 44, gapMin: 310, gapMax: 440, w: { dash: 0.35, band: 0.3, chevron: 0.35 }, pDouble: 0.4, cost: 3600 },
  { id: 10, name: 'Neige', theme: 'neige', diff: 'permisA', speed: 450, lines: 44, gapMin: 320, gapMax: 450, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.35, cost: 5000 },
  { id: 11, name: 'Tempête', theme: 'neige', diff: 'pilote', speed: 510, lines: 48, gapMin: 300, gapMax: 420, w: { dash: 0.35, band: 0.3, chevron: 0.35 }, pDouble: 0.45, cost: 7000 },
  { id: 12, name: 'Hyperdrive', theme: 'nuit', diff: 'pilote', speed: 580, lines: 55, gapMin: 280, gapMax: 380, w: { dash: 0.3, band: 0.35, chevron: 0.35 }, pDouble: 0.5, cost: 8000 },
  { id: 13, name: 'Néon', theme: 'neon', diff: 'pilote', speed: 620, lines: 50, gapMin: 270, gapMax: 360, w: { dash: 0.3, band: 0.35, chevron: 0.35 }, pDouble: 0.5, cost: 9000 },
  { id: 14, name: 'Golden hour', theme: 'sunset', diff: 'pilote', speed: 600, lines: 50, gapMin: 275, gapMax: 370, w: { dash: 0.3, band: 0.3, chevron: 0.4 }, pDouble: 0.45, cost: 11000 },
  { id: 15, name: 'Enfer', theme: 'nuit', diff: 'pilote', speed: 660, lines: 55, gapMin: 260, gapMax: 350, w: { dash: 0.25, band: 0.35, chevron: 0.4 }, pDouble: 0.5, cost: 13000 },
];

export const SKINS = [
  { id: 'default', name: 'Berline grise', color: '#9aa3b2', cost: 0, currency: 'auto', model: 'berline', style: 'photo' },
  { id: 'rouge', name: 'Berline rouge', color: '#e0393e', cost: 200, currency: 'auto', model: 'berline' },
  { id: 'bleue', name: 'Citadine bleue', color: '#2f7de1', cost: 200, currency: 'auto', model: 'citadine' },
  { id: 'verte', name: 'Berline verte', color: '#2fae5f', cost: 300, currency: 'auto', model: 'berline' },
  { id: 'jaune', name: 'Citadine lime', color: '#a8c93a', cost: 400, currency: 'auto', model: 'citadine' },
  { id: 'sport', name: 'Sport orange', color: '#ffb020', cost: 600, currency: 'permisA', model: 'sport' },
  { id: 'taxi', name: 'Taxi', color: '#f7d117', cost: 800, currency: 'permisA', model: 'citadine' },
  { id: 'suv', name: '4x4 vert', color: '#3f7d4e', cost: 2500, currency: 'permisA', model: 'suv' },
  { id: 'suvnoir', name: '4x4 noir mat', color: '#23262e', cost: 3200, currency: 'permisA', model: 'suv', shine: true },
  { id: 'or', name: 'Berline or', color: '#f5c542', cost: 1200, currency: 'pilote', model: 'berline', shine: true },
  { id: 'arc', name: 'Sport arc-en-ciel', color: '#ff5c8a', cost: 2000, currency: 'pilote', model: 'sport', rainbow: true },
  { id: 'police', name: 'Police', color: '#eef2f7', cost: 3000, currency: 'pilote', model: 'berline' },
  { id: 'f1rouge', name: 'F1 rouge', color: '#d21f2b', cost: 5000, currency: 'pilote', model: 'f1' },
  { id: 'f1noire', name: 'F1 noire', color: '#15171c', cost: 6500, currency: 'pilote', model: 'f1', shine: true },
  // v1.3.12 : styles de rendu variés (du photoréaliste aux blocs)
  { id: 'blocs', name: 'Classique (blocs)', color: '#8a93a6', cost: 0, currency: 'auto', model: 'citadine', style: 'flat' },
  { id: 'pixel', name: 'Pixel 8-bit', color: '#54f0ff', cost: 1200, currency: 'auto', model: 'citadine', style: 'pixel' },
  { id: 'retro', name: 'Rétro 80s', color: '#e05c9a', cost: 1800, currency: 'auto', model: 'berline', style: 'retro' },
  { id: 'toy', name: 'Jouet plastique', color: '#ff8a3d', cost: 2200, currency: 'permisA', model: 'citadine', style: 'toy' },
  { id: 'neoncar', name: 'Néon', color: '#54f0ff', cost: 3500, currency: 'permisA', model: 'sport', style: 'neon' },
  { id: 'holo', name: 'Hologramme', color: '#9ef0ff', cost: 5500, currency: 'pilote', model: 'sport', style: 'holo' },
  // v1.3.15 : nouveaux modèles top-down
  { id: 'kart', name: 'Kart', color: '#ff6b35', cost: 1500, currency: 'auto', model: 'kart' },
  { id: 'deuxcv', name: '2CV vintage', color: '#7fb3d5', cost: 2000, currency: 'auto', model: '2cv', style: 'retro' },
  { id: 'van', name: 'Fourgon', color: '#e8e8e8', cost: 2800, currency: 'permisA', model: 'van' },
  { id: 'decab', name: 'Décapotable', color: '#d21f2b', cost: 3200, currency: 'permisA', model: 'decapotable' },
  { id: 'camion', name: 'Camion benne', color: '#f39c12', cost: 4500, currency: 'pilote', model: 'camion' },
  { id: 'monster', name: 'Monster truck', color: '#8e44ad', cost: 6000, currency: 'pilote', model: 'monster' },
  { id: 'limo', name: 'Limousine', color: '#1a1a22', cost: 8000, currency: 'pilote', model: 'limo', shine: true },
  { id: 'supercar', name: 'Supercar', color: '#00c2ff', cost: 9500, currency: 'pilote', model: 'supercar' },
];

export const EFFECTS = [
  { id: 'trail', name: 'Traînée de particules', desc: 'La voiture laisse une traînée derrière elle.', cost: 400, currency: 'auto' },
  { id: 'glow', name: 'Lignes lumineuses', desc: 'Les lignes brillent quand tu les réussis.', cost: 400, currency: 'auto' },
  { id: 'shake', name: 'Secousse', desc: "L'écran vibre à chaque PARFAIT.", cost: 600, currency: 'auto' },
  { id: 'confetti', name: 'Confettis', desc: 'Des confettis explosent à chaque PARFAIT.', cost: 1000, currency: 'auto' },
  { id: 'rain', name: '🌧 Pluie', desc: "Il pleut sur la route (effet météo).", cost: 800, currency: 'permisA' },
  { id: 'snowfall', name: '❄ Neige qui tombe', desc: 'Des flocons tombent (effet météo).', cost: 800, currency: 'permisA' },
  { id: 'rainbow', name: '🌈 Lignes arc-en-ciel', desc: 'Les lignes changent de couleur en continu.', cost: 1500, currency: 'permisA' },
  { id: 'vignette', name: '🎥 Vignette cinéma', desc: "Assombrit les bords de l'écran.", cost: 900, currency: 'permisA' },
  { id: 'fire', name: '🔥 Traînée de feu', desc: 'La voiture crache des flammes quand ton combo atteint 10.', cost: 1500, currency: 'pilote' },
  { id: 'ghost', name: '👻 Voiture fantôme', desc: 'Une silhouette fantôme marque les changements de voie.', cost: 2000, currency: 'pilote' },
];

export const THEME_SHOP = [
  { id: 'neon', name: '🌃 Thème Néon', desc: 'Remplace le décor de tous les niveaux par la ville néon.', cost: 2500, currency: 'permisA' },
  { id: 'sunset', name: '🌇 Thème Coucher de soleil', desc: 'Remplace le décor de tous les niveaux.', cost: 2500, currency: 'permisA' },
];

// Packs : plusieurs cosmétiques à prix réduit, payés dans une seule monnaie
export const PACKS = [
  {
    id: 'pack_debutant', name: '🎁 Pack Débutant', currency: 'auto', cost: 500,
    desc: 'Berline rouge + lignes lumineuses + secousse (économie de 300 🪙).',
    items: [
      { type: 'skin', id: 'rouge' },
      { type: 'effect', id: 'glow' },
      { type: 'effect', id: 'shake' },
    ],
  },
  {
    id: 'pack_sport', name: '🏎️ Pack Sport', currency: 'pilote', cost: 6500,
    desc: 'Sport orange + F1 rouge + confettis + traînée de feu.',
    items: [
      { type: 'skin', id: 'sport' },
      { type: 'skin', id: 'f1rouge' },
      { type: 'effect', id: 'confetti' },
      { type: 'effect', id: 'fire' },
    ],
  },
];

// Packs de sons : remplacent les bruitages du jeu (100 % cosmétiques)
export const SOUND_PACKS = [
  { id: 'default', name: '🔊 Sons standard', desc: 'Les sons de base du jeu.', cost: 0, currency: 'auto' },
  { id: 'arcade', name: '🕹️ Pack Arcade 8-bit', desc: 'Bruitages rétro pour PARFAIT, ratés, pièces…', cost: 1200, currency: 'permisA' },
  { id: 'synthwave', name: '🌆 Pack Synthwave', desc: 'Sons futuristes avec montées en fréquence.', cost: 2500, currency: 'pilote' },
];

export const ENDLESS_LEVEL = {
  id: 99, name: 'Survie ∞', theme: 'autoroute', diff: 'auto', speed: 300, lines: 60,
  gapMin: 400, gapMax: 600, w: { dash: 0.7, band: 0.15, chevron: 0.15 }, pDouble: 0.2, cost: 0, endless: true,
};

export const ACHIEVEMENTS = [
  { id: 'first_perfect', name: 'Premier PARFAIT', desc: 'Réussir un PARFAIT', reward: 50, test: (c) => c.stats.perfects >= 1 },
  { id: 'combo10', name: 'Combo x10', desc: 'Atteindre un combo de 10', reward: 100, test: (c) => c.stats.bestCombo >= 10 },
  { id: 'combo25', name: 'Combo x25', desc: 'Atteindre un combo de 25', reward: 250, test: (c) => c.stats.bestCombo >= 25 },
  { id: 'finish1', name: 'Premier niveau terminé', desc: 'Terminer le niveau 1', reward: 150, test: (c) => c.stats.completed && c.level.id === 1 },
  { id: 'finish12', name: 'Pilote confirmé', desc: 'Terminer le niveau 12', reward: 1000, test: (c) => c.stats.completed && c.level.id === 12 },
  { id: 'overtake5', name: 'Roi de la route', desc: '5 dépassements au total', reward: 200, test: (c) => c.totals.overtakes >= 5 },
  { id: 'perfects100', name: 'Doigts de fée', desc: '100 PARFAIT au total', reward: 300, test: (c) => c.totals.perfects >= 100 },
  { id: 'survie500', name: 'Survivant', desc: '500 points en mode Survie ∞', reward: 200, test: (c) => c.level.endless && c.stats.score >= 500 },
  { id: 'permisA_win', name: 'Permis A obtenu', desc: 'Terminer un niveau en Permis A', reward: 300, test: (c) => c.stats.completed && c.mode === 'permisA' },
  { id: 'pilote_win', name: 'Grand permis', desc: 'Terminer un niveau en Pilote', reward: 500, test: (c) => c.stats.completed && c.mode === 'pilote' },
  { id: 'combo50', name: 'Machine', desc: 'Atteindre un combo de 50', reward: 500, test: (c) => c.stats.bestCombo >= 50 },
  { id: 'survie1000', name: 'Légende de la survie', desc: '1000 points en mode Survie ∞', reward: 500, test: (c) => c.level.endless && c.stats.score >= 1000 },
  { id: 'champion', name: 'Champion', desc: 'Terminer les 12 niveaux', reward: 2000, test: (c) => LEVELS.filter((l) => !l.endless).every((l) => (c.best[l.id] || 0) > 0) },
  { id: 'trophy_all', name: 'Collectionneur', desc: 'Médaille 🥇 (full parfait) sur tous les niveaux', reward: 3000, test: (c) => Object.keys(c.trophies || {}).length >= LEVELS.filter((l) => !l.endless).length },
];
