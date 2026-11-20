# ✅ Assurance qualité

## Processus de test

1. **CI automatique** : `.github/workflows/ci.yml` lance `node tests/core.test.mjs` à chaque push/PR (jugement de timing, scoring, génération des niveaux, jouabilité des écarts, crosswalks, fenêtres élargies, vies par mode).
2. **Checklist manuelle** : `TESTING.md` (bloc de rappel à refaire après chaque mise à jour) — couvre gameplay, vies, difficultés, passages piétons, boutique, succès, classement, hors-ligne.
3. **Tests appareils** : au minimum 1 Android (Chrome) + 1 iPhone (Safari) + 1 desktop, en portrait, avec et sans service worker (hors ligne).
4. **Tests TWA** : avant chaque release, installer l'APK de test (`bubblewrap install`) et rejouer la checklist sur l'app installée.

## Critères de sortie d'une version (Definition of Done)

- [ ] CI verte
- [ ] Checklist TESTING.md passée sur mobile + desktop
- [ ] Aucun crash dans la console navigateur
- [ ] Temps de chargement < 3 s en 4G, jouable hors ligne après 1er chargement
- [ ] `CACHE` du service worker bumpé (`sw.js`) **et** `VERSION` bumpée (`js/config.js`) — toutes deux affichées dans le pied du menu (indicateur de version + statut serveur 🟢🟠🔴)
- [ ] PR reviewée et mergée sur `main`

## Signaler un bug

Ouvrir une issue GitHub avec : comportement attendu / observé, appareil + navigateur, niveau + difficulté, étapes pour reproduire.

## Checklist v1.3.4 (à refaire en entier)

- [ ] **Dépassement sur téléphone (Pilote)** : swipe ⬅ détecté dès 40 px en `pointermove`, même si un `pointercancel` arrive (geste rapide, bord d'écran) ; après le dépassement la voiture **revient seule en voie de droite**
- [ ] **Tutoriel** : chaque étape démarre le jeu **en pause** (`tutHold`) avec le curseur à 0 ; on ne peut pas avancer tant que le curseur n'est pas à 100 ; « ✖ Quitter le tutoriel » ferme SANS valider → au prochain « Jouer » le tutoriel revient ; finir = +200 🪙 (une seule fois) et plus de tuto forcé
- [ ] **3 monnaies** 🪙/🎓/🏁 affichées partout (menu, niveaux, boutique, HUD, écran de fin) ; gains crédités sur la monnaie du mode joué ; achat d'un niveau débité sur la monnaie de son palier ; niveau N bloqué tant que N-1 non débloqué (« 🔒 niveau précédent »)
- [ ] **Full PARFAIT** : niveau terminé 100 % PARFAIT → 🥇 sur la carte + message/bonus à l'écran de fin ; un seul BIEN/OK/raté casser le full parfait
- [ ] **Combo** : BIEN/OK ne montent pas le combo, PARFAIT si, raté = 0
- [ ] **Cloud** : `wallets` + `trophies` synchronisés (2 appareils, même pseudo)
- [ ] CI verte + `CACHE` sw bumpé + aucune erreur console
