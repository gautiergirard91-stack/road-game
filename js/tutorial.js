import * as store from './store.js';
import { sfx } from './audio.js';

export class Tutorial {
  constructor(game, els, onDone) {
    this.game = game;
    this.textEl = els.text;
    this.dotsEl = els.dots;
    this.onDone = onDone;
    this.i = 0;
    this.attempts = 0;
    this.overtakes = 0;
    this.saw = { front: false, rear: false };
    this.stepStart = performance.now();
    this.finished = false;
    this.steps = [
      {
        text: "👆 Bienvenue ! Tape l'écran (ou Espace) quand la ligne blanche atteint les roues de la voiture.",
        done: (t, e) => Boolean(e),
      },
      {
        text: '🎯 Vise le PARFAIT (±45 ms) : tape pile au moment où la ligne touche les roues !',
        done: (t, e) => Boolean(e) && (e.result === 'perfect' || t.attempts >= 6),
      },
      {
        text: "🔥 Enchaîne 3 lignes d'affilée pour déclencher un COMBO x3 !",
        done: (t, e) => Boolean(e) && e.combo >= 3,
      },
      {
        text: "💥 Ligne manquée ou clic dans le vide = −1 ❤️ (3 vies en Auto école, 5 en Permis A/Pilote). Lis bien cette règle, puis essaie : laisse passer une ligne volontairement.",
        missDone: (t) => performance.now() - t.stepStart > 5000,
      },
      {
        text: "🎚️ Permis A : chaque ligne se joue 2 fois, indépendamment ! Tap en HAUT de l'écran = roues AV, tap en BAS = roues AR. Fais les deux sur une même ligne.",
        enter: (g) => {
          g.mode = 'permisA';
          g.axles = ['front', 'rear'];
        },
        done: (t) => t.saw.front && t.saw.rear,
      },
      {
        text: '🚗 Pilote : une voiture lente est devant toi ! SWIPE vers la gauche (ou touche ⬅) pour doubler. (1er essai)',
        enter: (g) => {
          g.mode = 'pilote';
          g.axles = ['front', 'rear'];
          g.forceBlocker();
        },
        done: (t) => t.overtakes >= 1,
      },
      {
        text: '🔁 Encore un dépassement ! (2ème) — puis laisse ta voiture revenir complètement dans la voie de droite avant de continuer.',
        enter: (g) => g.forceBlocker(),
        done: (t) => t.overtakes >= 2 && t.game.laneTarget === 0.72 && t.game.carXFrac > 0.68,
      },
      {
        text: "🚶 En ville : le passage piéton (bandes blanches) est une ligne à cliquer comme les autres — et la voiture s'arrête seule pour laisser passer les piétons. Tape quand il atteint les roues !",
        enter: (g) => g.spawnLine('crosswalk', 520),
        done: (t, e) => Boolean(e),
      },
      {
        text: '🏁 Tutoriel terminé ! +200 🪙 — à toi de jouer maintenant !',
        done: () => false,
      },
    ];
    this.show();
  }

  show() {
    const s = this.steps[this.i];
    this.textEl.textContent = s.text;
    this.dotsEl.textContent = `${this.i + 1}/${this.steps.length}`;
  }

  next() {
    this.i++;
    this.attempts = 0;
    this.saw = { front: false, rear: false };
    this.stepStart = performance.now();
    if (this.i >= this.steps.length) return this.finish();
    const s = this.steps[this.i];
    if (s.enter) s.enter(this.game, this);
    this.show();
    if (this.i === this.steps.length - 1) {
      setTimeout(() => this.finish(), 3000);
    }
  }

  onJudge(e) {
    if (this.finished) return;
    this.attempts++;
    if (e.axle === 'front') this.saw.front = true;
    if (e.axle === 'rear') this.saw.rear = true;
    if (e.overtake) this.overtakes++;
    const s = this.steps[this.i];
    if (s.done && s.done(this, e)) this.next();
  }

  onMiss() {
    if (this.finished) return;
    const s = this.steps[this.i];
    if (s.missDone && s.missDone(this)) this.next();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    store.addCoins(200);
    store.setTutorialDone();
    sfx.win();
    this.onDone();
  }
}
