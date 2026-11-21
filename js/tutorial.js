import * as store from './store.js';
import { sfx } from './audio.js';

export class Tutorial {
  constructor(game, els, onDone, onQuit) {
    this.game = game;
    this.textEl = els.text;
    this.dotsEl = els.dots;
    this.readEl = els.read;
    this.sliderEl = els.slider;
    this.onDone = onDone;
    this.onQuit = onQuit || (() => {});
    this.reading = false;
    this.i = 0;
    this.attempts = 0;
    this.missed = false;
    this.lastEvent = null;
    this.overtakes = 0;
    this.saw = { front: false, rear: false };
    this.stepStart = performance.now();
    this.finished = false;
    // v1.3.21 : le texte du tuto s'adapte aux zones (haut/bas ou gauche/droite)
    const zonesTxt = store.get().horizontalZones
      ? "Tap à GAUCHE de l'écran = roues AV, tap à DROITE = roues AR"
      : "Tap en HAUT de l'écran = roues AV, tap en BAS = roues AR";
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
        text: "🔥 Enchaîne 3 lignes d'affilée : le COMBO ne monte que sur PARFAIT (x3 ici) !",
        done: (t, e) => Boolean(e) && e.combo >= 3,
      },
      {
        text: "💥 Ligne manquée ou clic dans le vide = −1 ❤️ (3 vies en Auto école, 5 en Permis A/Pilote). Laisse passer une ligne volontairement : tu perds VRAIMENT un ❤️ et l'effet reste visible 0,5 s !",
        missStep: true,
      },
      {
        text: `🎚️ Permis A : chaque ligne se joue 2 fois, indépendamment ! ${zonesTxt}. Fais les deux sur une même ligne.`,
        enter: (g) => {
          g.mode = 'permisA';
          g.axles = ['front', 'rear'];
        },
        done: (t) => t.saw.front && t.saw.rear,
      },
      {
        text: '🚗 Pilote : une voiture lente est devant toi ! SWIPE vers la gauche (ou touche ⬅) pour doubler. (1er essai) — attends que ta voiture soit revenue à droite !',
        enter: (g) => {
          g.mode = 'pilote';
          g.axles = ['front', 'rear'];
          g.forceBlocker();
        },
        poll: true, // on laisse le temps de voir la voiture doubler ET revenir à droite
        done: (t) => t.overtakes >= 1 && t.game.laneTarget === 0.72 && t.game.carXFrac > 0.68,
      },
      {
        text: '🔁 Encore un dépassement ! (2ème) — puis laisse ta voiture revenir complètement dans la voie de droite avant de continuer.',
        enter: (g) => g.forceBlocker(),
        poll: true,
        done: (t) => t.overtakes >= 2 && t.game.laneTarget === 0.72 && t.game.carXFrac > 0.68,
      },
      {
        text: "🚶 En ville : le passage piéton (bandes blanches) est une ligne à cliquer comme les autres — et la voiture s'arrête seule pour laisser passer les piétons. Tape quand IL atteint les roues !",
        enter: (g) => g.spawnLine('crosswalk', 640),
        minTime: 2800,
        respawn: true, // v1.3.26 : si le joueur rate ce passage piéton, on lui en remet un (anti-blocage)
        done: (t, e) => Boolean(e) && e.type === 'crosswalk',
      },
      {
        text: "🪙🎓🏁 Chaque difficulté rapporte SA monnaie (🪙 Auto école, 🎓 Permis A, 🏁 Pilote) : les niveaux se débloquent dans l'ordre, avec la monnaie de leur palier. 🥇 Niveau full PARFAIT = médaille + gros bonus !",
        autoNext: true,
      },
      {
        text: '🏁 Tutoriel terminé ! +200 🪙 — à toi de jouer maintenant !',
        autoNext: true,
      },
    ];
    if (this.sliderEl) {
      this.sliderEl.addEventListener('input', () => {
        if (this.reading && Number(this.sliderEl.value) >= 100) this.endRead();
      });
      // v1.3.20 : drag tactile fiable — on calcule la valeur depuis la position du doigt
      // (le drag natif du <input type=range> est coupé sur mobile par le preventDefault global)
      const dragTo = (e) => {
        const r = this.sliderEl.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        this.sliderEl.value = String(Math.round(f * 100));
        this.sliderEl.dispatchEvent(new Event('input', { bubbles: true }));
      };
      this.sliderEl.addEventListener('pointerdown', (e) => {
        if (!this.reading) return;
        e.preventDefault(); // on prend le contrôle du drag (touch-action:none déjà en CSS)
        try {
          this.sliderEl.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        dragTo(e);
      });
      this.sliderEl.addEventListener('pointermove', (e) => {
        if (!this.reading || !(e.buttons & 1)) return;
        dragTo(e);
      });
    }
    if (els.quit) {
      els.quit.addEventListener('click', () => this.abort());
    }
    this.show();
  }

  // Phase de lecture : le jeu est mis EN PAUSE et le joueur doit glisser le
  // curseur jusqu'au bout (il a lu, il est prêt) pour continuer.
  // v1.3.22 : replier la bannière (le texte ne doit pas bloquer le haut de l'écran sur mobile)
  setFolded(f) {
    const banner = document.getElementById('tut-banner');
    const btn = document.getElementById('tut-fold');
    if (!banner) return;
    banner.classList.toggle('folded', f);
    if (btn) btn.textContent = f ? '▴' : '▾';
  }

  beginRead() {
    this.reading = true;
    this.game.tutHold = true;
    this.setFolded(false); // on déplie pour la phase de lecture (curseur visible)
    if (this.readEl) this.readEl.classList.remove('hidden');
    if (this.sliderEl) this.sliderEl.value = 0;
  }

  endRead() {
    if (!this.reading) return;
    this.reading = false;
    this.game.tutHold = false;
    if (this.readEl) this.readEl.classList.add('hidden');
    // sur téléphone, on replie la bannière pendant les phases d'action
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 760px)').matches) this.setFolded(true);
    this.stepStart = performance.now();
    const s = this.steps[this.i];
    if (s && (s.autoNext || this.i === this.steps.length - 1)) this.next();
  }

  // Quitter avant la fin : le tutoriel n'est PAS validé (reviendra à la prochaine partie)
  abort() {
    if (this.finished) return;
    this.finished = true;
    this.game.tutHold = false;
    if (this.readEl) this.readEl.classList.add('hidden');
    this.onQuit();
  }

  show() {
    const s = this.steps[this.i];
    this.textEl.textContent = s.text;
    this.dotsEl.textContent = `${this.i + 1}/${this.steps.length}`;
    this.beginRead();
  }

  next() {
    this.i++;
    this.attempts = 0;
    this.missed = false;
    this.lastEvent = null;
    this.saw = { front: false, rear: false };
    this.stepStart = performance.now();
    if (this.i >= this.steps.length) return this.finish();
    const s = this.steps[this.i];
    if (s.enter) s.enter(this.game, this);
    this.show();
  }

  onJudge(e) {
    if (this.finished || this.reading) return;
    this.attempts++;
    this.lastEvent = e;
    if (e.axle === 'front') this.saw.front = true;
    if (e.axle === 'rear') this.saw.rear = true;
    if (e.overtake) this.overtakes++;
    const s = this.steps[this.i];
    if (s.done && performance.now() - this.stepStart >= (s.minTime || 0) && s.done(this, e)) this.next();
  }

  onMiss() {
    if (this.finished || this.reading) return;
    const s = this.steps[this.i];
    if (s && s.missStep) {
      this.missed = true;
      // 0,5 s après la perte de ❤️ (l'effet RATÉ est bien visible), on met le jeu
      // en pause et on passe à l'étape suivante
      setTimeout(() => {
        if (this.finished || this.reading) return;
        const cur = this.steps[this.i];
        if (cur && cur.missStep) this.next();
      }, 500);
    }
  }

  tick() {
    if (this.finished || this.reading) return;
    const s = this.steps[this.i];
    const elapsed = performance.now() - this.stepStart;
    // repli : si le joueur tape tout parfaitement et ne rate jamais rien, on avance quand même après 12 s
    if (s && s.missStep && !this.missed && elapsed > 12000) return this.next();
    // v1.3.26 : passage piéton raté -> on en respawn un (sinon l'étape ne peut jamais finir)
    if (s && s.respawn && !this.game.lines.some((l) => l.type === 'crosswalk' && l.state === 'pending')) {
      this.game.spawnLine('crosswalk', 640);
    }
    // étapes sondées en continu (ex. dépassement : attendre le retour en file de droite)
    if (s && s.poll && elapsed >= (s.minTime || 0)) {
      try {
        if (s.done(this, this.lastEvent || null)) this.next();
      } catch {
        /* ignore */
      }
    }
    // v1.3.26 : garde-fou anti-blocage — aucune étape d'action ne dure plus de 45 s
    if (s && !s.autoNext && elapsed > 45000) return this.next();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    store.addCoins('auto', 200);
    store.setTutorialDone();
    sfx.win();
    this.onDone();
  }
}
