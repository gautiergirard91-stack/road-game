export const WINDOWS = { perfect: 45, good: 100, passable: 160 };

export const MAX_MISSES = 3;
export const CONTINUE_BASE_COST = 100;

export const DIFFICULTIES = [
  { id: 'auto', name: 'Auto école', desc: "Tap n'importe où quand les roues touchent la ligne" },
  { id: 'permisA', name: 'Permis A', desc: "Haut de l'écran = roues avant (AV), bas de l'écran = roues arrière (AR)" },
  { id: 'pilote', name: 'Pilote', desc: 'Permis A + voitures devant : swipe vers la gauche pour doubler, sinon bouchon !' },
];

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
};

export const LEVELS = [
  { id: 1, name: 'Premiers tours', theme: 'autoroute', speed: 250, lines: 25, gapMin: 460, gapMax: 700, w: { dash: 1 }, pDouble: 0, cost: 0 },
  { id: 2, name: 'Accélération', theme: 'autoroute', speed: 300, lines: 30, gapMin: 420, gapMax: 620, w: { dash: 1 }, pDouble: 0.15, cost: 150 },
  { id: 3, name: 'Double file', theme: 'autoroute', speed: 340, lines: 32, gapMin: 400, gapMax: 560, w: { dash: 0.7, band: 0.3 }, pDouble: 0.3, cost: 300 },
  { id: 4, name: 'En ville', theme: 'ville', speed: 340, lines: 34, gapMin: 390, gapMax: 560, w: { dash: 0.6, chevron: 0.4 }, pDouble: 0.2, cost: 500 },
  { id: 5, name: 'Heures de pointe', theme: 'ville', speed: 380, lines: 36, gapMin: 360, gapMax: 520, w: { dash: 0.5, band: 0.25, chevron: 0.25 }, pDouble: 0.3, cost: 800 },
  { id: 6, name: 'Désert', theme: 'desert', speed: 380, lines: 38, gapMin: 350, gapMax: 500, w: { dash: 0.5, band: 0.3, chevron: 0.2 }, pDouble: 0.25, cost: 1200 },
  { id: 7, name: 'Coucher de soleil', theme: 'desert', speed: 420, lines: 40, gapMin: 330, gapMax: 480, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.35, cost: 1800 },
  { id: 8, name: 'Nuit', theme: 'nuit', speed: 420, lines: 40, gapMin: 330, gapMax: 470, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.3, cost: 2600 },
  { id: 9, name: 'Néon', theme: 'nuit', speed: 470, lines: 44, gapMin: 310, gapMax: 440, w: { dash: 0.35, band: 0.3, chevron: 0.35 }, pDouble: 0.4, cost: 3600 },
  { id: 10, name: 'Neige', theme: 'neige', speed: 450, lines: 44, gapMin: 320, gapMax: 450, w: { dash: 0.4, band: 0.3, chevron: 0.3 }, pDouble: 0.35, cost: 5000 },
  { id: 11, name: 'Tempête', theme: 'neige', speed: 510, lines: 48, gapMin: 300, gapMax: 420, w: { dash: 0.35, band: 0.3, chevron: 0.35 }, pDouble: 0.45, cost: 7000 },
  { id: 12, name: 'Hyperdrive', theme: 'nuit', speed: 580, lines: 55, gapMin: 280, gapMax: 380, w: { dash: 0.3, band: 0.35, chevron: 0.35 }, pDouble: 0.5, cost: 10000 },
];

export const SKINS = [
  { id: 'default', name: 'Berline grise', color: '#9aa3b2', cost: 0, model: 'berline' },
  { id: 'rouge', name: 'Berline rouge', color: '#e0393e', cost: 200, model: 'berline' },
  { id: 'bleue', name: 'Citadine bleue', color: '#2f7de1', cost: 200, model: 'citadine' },
  { id: 'verte', name: 'Berline verte', color: '#2fae5f', cost: 300, model: 'berline' },
  { id: 'jaune', name: 'Citadine jaune', color: '#f2c230', cost: 400, model: 'citadine' },
  { id: 'sport', name: 'Sport orange', color: '#ffb020', cost: 600, model: 'sport' },
  { id: 'or', name: 'Berline or', color: '#f5c542', cost: 1200, model: 'berline', shine: true },
  { id: 'arc', name: 'Sport arc-en-ciel', color: '#ff5c8a', cost: 2000, model: 'sport', rainbow: true },
];

export const EFFECTS = [
  { id: 'trail', name: 'Traînée de particules', desc: 'La voiture laisse une traînée derrière elle.', cost: 400 },
  { id: 'glow', name: 'Lignes lumineuses', desc: 'Les lignes brillent quand tu les réussis.', cost: 400 },
  { id: 'shake', name: 'Secousse', desc: "L'écran vibre à chaque PARFAIT.", cost: 600 },
  { id: 'confetti', name: 'Confettis', desc: 'Des confettis explosent à chaque PARFAIT.', cost: 1000 },
];
