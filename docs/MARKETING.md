# 📣 Marketing & lancement

## Positionnement

« Le jeu de réflexes façon Piano Tiles, mais au volant. » — 15 secondes pour comprendre, parties de 1–3 min, rejouabilité infinie (Survie ∞ + classement).

## Fiche Play Store (ASO) — textes prêts à copier

- **Titre** (30 car.) : `Road Tap Racer`
- **Description courte** (80 car.) :
  > FR : « Tape au bon moment quand les roues touchent la ligne ! 15 niveaux, 3 difficultés, classement. »
- **Description longue** :
  > FR : « 🚗 Road Tap Racer — le jeu de réflexes façon Piano Tiles, mais au volant !
  > 👆 Tape l'écran au moment exact où les roues de ta voiture atteignent la ligne blanche : PARFAIT ±45 ms, BIEN ±100 ms, OK ±160 ms. Enchaîne les combos pour multiplier tes points.
  > 🎚️ 3 difficultés : Auto école (tap partout), Permis A (haut de l'écran = roues avant, bas = roues arrière, chaque ligne se joue 2 fois !), Pilote (swipe ⬅ pour doubler les voitures lentes, sinon bouchon !).
  > 🗺️ 15 niveaux sur 7 thèmes (autoroute, ville avec passages piétons 🚶, désert, neige, nuit, néon, coucher de soleil) + mode Survie ∞ à vitesse croissante.
  > 🪙 Gagne des pièces, débloque de nouveaux niveaux et personnalise ta voiture (10 modèles de plus en plus détaillés) et des effets (traînée de feu 🔥, pluie, neige, confettis…).
  > 🏆 Choisis un pseudo et grimpe au classement (filtré par difficulté). 🏅 13 succès à débloquer.
  > 📴 100 % jouable hors ligne. Aucune donnée personnelle collectée.
  >
  > EN short: "Tap when the wheels hit the line! 15 levels, 3 difficulties, leaderboard, offline play."
- **Mots-clés ASO** : jeu de rythme, réflexes, arcade, score, voiture, conduite, classement, hors ligne / rhythm game, reflexes, arcade, driving, leaderboard, offline.

## Assets déjà générés (`store/`, régénérés via `python3 tools/make_store_assets.py`)

- `feature-graphic-1024x500.png` — bannière (spécifique Play : 1024×500, JPEG/PNG, sans transparence)
- `screenshot-menu-1080x1920.png`, `screenshot-gameplay-1080x1920.png` — **placeholders** à remplacer par de vraies captures :
  - sur téléphone : `adb shell screencap -p /sdcard/shot.png && adb pull /sdcard/shot.png`
  - ou Chrome DevTools (F12 → icône appareil → capture screenshot) sur `https://roadtap.uk`
  - capturer : menu, gameplay avec popup PARFAIT, mode Pilote (swipe), passage piéton, boutique, succès, classement = 5–8 captures portrait
- icône 512 px : `icons/icon-512.png` (déjà prête)

## Vidéo 30 s (script)

| Temps | Plan | Texte/son |
|-------|------|-----------|
| 0–3 s | Logo + « Road Tap Racer » | musique du jeu |
| 3–10 s | Gameplay niveau 1, tap PARFAIT | « Tape quand les roues touchent la ligne » |
| 10–16 s | Combo x10, popup PARFAIT | « Enchaîne les combos ! » |
| 16–22 s | Mode Pilote, swipe ⬅, dépassement | « Pilote : double ou ralentis ! » |
| 22–27 s | Passage piéton, voiture s'arrête | « En ville, laisse passer les piétons » |
| 27–30 s | Boutique + classement + icône | « Débloque voitures, effets, succès — et monte au classement ! » |

## Canaux

1. **Lancement** : post Reddit r/AndroidGaming + r/WebGames, Product Hunt, Hacker News "Show HN".
2. **Contenu** : 3 vidéos courtes (TikTok/Reels/Shorts) : « 60 s de gameplay Pilote », « toutes les voitures débloquées », « top 1 du classement ».
3. **Communauté** : classement mondial (Firebase) + partage de score (Web Share API) comme levier viral.
4. **Presse indé** : kit presse (captures, GIF, communiqué 1 page, contact) → sites type Pocket Gamer / JeuxVideo.com (section indés).
5. **Mise à jour régulière** : 1 nouveau niveau ou thème tous les ~2 semaines = push de notif « nouveautés » côté store.

## Rétention (sans gêner)

Succès avec récompenses, records, classement — 100 % gratuits. Aucune mécanique de rétention agressive (pas de énergie/timers bloquants).
