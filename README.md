# 🚗 Road Tap Racer

Jeu d'arcade de rythme **façon Piano Tiles** : une voiture roule sur une route et le joueur doit toucher l'écran au moment exact où les **roues atteignent une ligne blanche**. La précision (PARFAIT / BIEN / OK), le nombre de réussites et la rapidité de réaction sont récompensées par des points et des combos. Une ligne manquée = partie terminée.

Le jeu est une **PWA (Progressive Web App)** : jouable dans n'importe quel navigateur moderne, installable sur mobile, jouable hors ligne, et **publiable sur le Google Play Store** via une Trusted Web Activity (TWA).

## 🎮 Fonctionnalités

- **Gameplay timing** : jugement en millisecondes (PARFAIT ±45 ms, BIEN ±100 ms, OK ±160 ms), combo multiplicateur, vies dans le HUD (❤️) : une ligne manquée **ou un clic dans le vide** = −1 ❤️ — **3 vies en Auto école, 5 en Permis A / Pilote** ; au dernier raté, possibilité de **continuer contre des pièces** (100 🪙, doublé à chaque fois) **ou en regardant une pub** (simulée dans `js/ads.js`, à remplacer par AdMob en production). Écran de fin avec statistiques (précision %, réaction moyenne, meilleur combo, ratés, dépassements).
- **Voiture sur la voie de droite**, avec **circulation en sens inverse** (voie de gauche, purement visuelle) et, en mode Pilote, des voitures dans le même sens.
- **3 niveaux de difficulté** (sélecteur en haut de l'écran des niveaux) :
  - **Auto école** : tap n'importe où quand les roues touchent la ligne.
  - **Permis A** : deux essieux (AV = roues avant, AR = roues arrière). **Chaque ligne doit être touchée deux fois, indépendamment** : d'abord par l'essieu avant (tap **moitié haute** de l'écran quand la ligne atteint la ligne AV cyan), puis par l'essieu arrière (tap **moitié basse**, ligne AR). Chaque essieu est jugé séparément (son propre PARFAIT/BIEN/OK, prefixé AV/AR), et chaque essieu manqué coûte un ❤️.
  - **Pilote** : comme Permis A, plus des voitures devant : **swipe vers la gauche** (ou ⬅) pour doubler — c'est **ta voiture** qui se déplace sur la voie de gauche pendant le dépassement, la voiture doublée reste à droite. Sans dépassement, ta voiture ralentit (1 s de grâce, puis ralentissement progressif) jusqu'à l'arrêt complet = fin de partie « 🚦 bouchon ». Pendant le ralentissement : combos coupés et points ×0,2.
- **🚶 Passages piétons en ville** (niveaux 4–5) : une bande zébrée compte comme **une ligne à cliquer** ; quand un piéton traverse, la voiture **s'arrête seule** pour le laisser passer (pause sans pénalité de combo/points), puis repart.
- **Décor de bord de route selon le thème** : arbres, immeubles, cactus, sapins enneigés, skyline nocturne + **lampadaires** (éclairés la nuit).
- **🏆 Classement** : le joueur choisit un pseudo et peut apparaître dans le classement (opt-in). **Filtre par difficulté** (Tous / Auto école / Permis A / Pilote). Classement **local** par défaut, **en ligne via Firebase Realtime Database** si configuré (`docs/FIREBASE.md`), un nœud par difficulté. **Sauvegarde cloud** du profil et **analytics** via le même projet Firebase.
- **∞ Mode Survie** : génération procédurale infinie, vitesse croissante, écarts qui se resserrent.
- **👶 Tutoriel guidé** au premier lancement (réouvrable depuis le menu) ; **🏅 10 succès** avec récompenses en pièces ; **♿ accessibilité** (fenêtres élargies, symboles daltonien) ; **🎵 musique de fond** + vibrations ; **effets météo** achetables (pluie, neige) ; **thèmes de route déblocables** (Néon, Coucher de soleil) qui remplacent le décor de tous les niveaux ; **CI GitHub Actions** (tests auto à chaque push/PR).
- **12 niveaux déblocables** avec difficulté croissante : vitesse, espacement des lignes, et 3 types de balisage (ligne pointillée, bande continue, chevrons, doubles lignes rapprochées).
- **5 thèmes de route** : Autoroute, Ville, Désert, Neige, Nuit (scénarios animés, parallaxe, néons).
- **Économie de jeu** : pièces gagnées à chaque partie, dépensables pour débloquer les niveaux suivants.
- **Boutique de personnalisation** : 8 voitures réparties en **3 modèles dessinés différemment** (citadine, berline, sport avec aileron), toutes assez grandes et détaillées (carrosserie en dégradé, vitres encadrées, rétroviseurs, calandre, phares/feux, roues avec moyeu) + couleurs/or/arc-en-ciel. **Plus la voiture coûte cher, plus elle est détaillée** (jantes à bâtons, reflet de vitre, pare-chocs, aileron à 600 🪙+ ; bande de course à 1200 🪙+), et 4 effets visuels (traînée de particules, lignes lumineuses, secousse, confettis).
- **Sauvegarde locale** (`localStorage`) : pièces, achats, records.
- **PWA complète** : manifest, service worker (hors ligne), icônes 192/512/maskable, plein écran portrait, sons générés en WebAudio (aucun asset externe).
- **Contrôles** : tactile (tap) ou clavier (Espace / Flèche bas), pause (P ou ⏸).

## 📁 Structure

```
index.html               Page unique (écrans : menu, niveaux, boutique, succès, classement, fin, pause, aide, tutoriel, accessibilité)
css/style.css            Style de l'interface
js/data.js               Données : thèmes, 12 niveaux + Survie ∞, skins, effets, succès, difficultés
js/core.js               Logique pure (testable sous Node) : jugement, score, génération des niveaux
js/game.js               Moteur Canvas : route, voiture, trafic, piétons, lignes, météo, thèmes animés
js/store.js              Sauvegarde localStorage + fusion cloud (pièces, achats, records, succès)
js/audio.js              SFX WebAudio + boucle musicale
js/leaderboard.js        Classement local / Firebase (filtré par difficulté)
js/cloudsave.js          Sauvegarde cloud du profil (Firebase)
js/analytics.js          Événements analytics (Firebase, best-effort)
js/config.js             Config Firebase (vide = 100 % hors ligne) — voir docs/FIREBASE.md
js/ads.js                Pub rewarded simulée (remplacer par AdMob en prod)
manifest.webmanifest     Manifeste PWA
sw.js                    Service worker (cache, hors ligne) — bumper CACHE à chaque mise à jour
icons/                   Icônes (tools/make_icons.py, Python stdlib uniquement)
assetlinks.json          Template Digital Asset Links pour la TWA
docs/                    GAME_DESIGN (DA + level design), QA, MARKETING, LEGAL, MONETIZATION, FIREBASE
PRIVACY.md               Politique de confidentialité (à héberger et référencer dans la Play Console)
tests/core.test.mjs      Tests Node : node tests/core.test.mjs  (lancés aussi en CI : .github/workflows/ci.yml)
tools/make_icons.py      Régénère les icônes : python3 tools/make_icons.py
```

## ▶️ Lancer en local

Aucun build, aucune dépendance :

```bash
cd road-game
python3 tools/make_icons.py   # génère icons/ (une seule fois, Python stdlib uniquement)
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

> Un service worker nécessite un contexte sécurisé : `localhost` convient pour les tests. Pour Android/iOS, il faudra un vrai domaine en **HTTPS** (voir ci-dessous).

## 📱 Jouer dans le navigateur / installer la PWA

- **Android (Chrome)** : menu ⋮ → « Ajouter à l'écran d'accueil » → l'app s'installe en plein écran.
- **iPhone/iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Ordinateur** : barre d'adresse Chrome → icône « Installer » (ou ⋮ → Installer), puis jouer avec Espace.

## 🏪 Publier sur le Google Play Store (Trusted Web Activity)

Le principe : le jeu reste un site web, mais on l'empaquette en **AAB signé** qui ouvre le site en plein écran via une TWA. Étapes :

### 1. Compte développeur

- Créer un compte sur [Google Play Console](https://play.google.com/console) : frais uniques de **25 $**.
- Créer une nouvelle application (choisir « Jeu », nom réservé ex. « Road Tap Racer »).

### 2. Héberger le jeu en HTTPS public

La TWA exige un site en **HTTPS avec un domaine vérifié** (le `assetlinks.json` doit être servi à la **racine** du domaine : `https://<domaine>/.well-known/assetlinks.json`).

**Option A — GitHub Pages + domaine personnalisé (recommandé pour le TWA)** :

1. Merger la PR sur `main`, puis dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch → branche `main`, dossier `/ (root)` → Save**.
2. Acheter un nom de domaine (ex. chez Gandi/OVH/Namecheap, ~10 €/an) et le faire pointer vers GitHub Pages (CNAME `gautiergirard91-stack.github.io` + `CNAME` à la racine du dépôt). Le site sera alors servi sur `https://<ton-domaine>/` à la racine → le `assetlinks.json` pourra y être placé à `/.well-known/assetlinks.json`.
3. Sans domaine perso, le site reste accessible sur `https://gautiergirard91-stack.github.io/road-game/` (utile pour tester la PWA, mais **pas suffisant pour la vérification TWA** à cause du chemin `/road-game/`).

**Option B — Netlify ou Vercel** (plus simple pour le TWA) : connecter le dépôt GitHub, déploiement auto en HTTPS sur un sous-domaine gratuit, puis ajouter un domaine perso si besoin ; déposer `assetlinks.json` dans `public/.well-known/` (Netlify) ou à la racine (Vercel).

Vérifier que `https://<domaine>/manifest.webmanifest` et `https://<domaine>/sw.js` répondent bien, et que la PWA s'installe (Chrome ⋮ → « Installer »).

### 3. Vérifier la propriété du domaine (Digital Asset Links)

- Copier `assetlinks.json` à la racine du site déployé, **dans** `/.well-known/assetlinks.json` (ex. `https://<user>.github.io/road-game/.well-known/assetlinks.json`).
- Remplacer `package_name` par ton application ID (ex. `com.example.roadtap`) et `sha256_cert_fingerprints` par l'empreinte SHA-256 de ta clé de signature :
  - Play Console → Ton app → **Configurer → Intégrité de l'application** (App signing) → copier l'empreinte SHA-256 de la clé de signature de l'app, **ou**
  - en local : `keytool -list -printcert -jar app-release.aab` (Android Studio / keytool du JDK).
- Vérifier avec l'outil [Digital Asset Links](https://developers.google.com/digital-asset-links/tools/generator) ou `https://<domaine>/.well-known/assetlinks.json` dans un navigateur.

### 4. Générer le bundle AAB avec Bubblewrap

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<domaine>/manifest.webmanifest
# répondre aux questions : application ID (com.example.roadtap), nom, icônes (fournir icon-512.png), etc.
bubblewrap build
# produit ./app-release.aab (et app-release.apk pour tester), signé avec un keystore généré
```

Pour tester avant publication : `bubblewrap install` installe l'APK sur un téléphone Android connecté en USB (mode développeur + débogage USB).

### 5. Publier dans la Play Console

- Uploader `app-release.aab` dans **Production → Versions** (ou commencer par une **version de test interne/fermée**).
- Remplir la **fiche du Play Store** : titre, descriptions courte/longue, icône 512 px (`icons/icon-512.png`), captures d'écran (5,7" et 10"), éventuellement une vidéo YouTube.
- **Classification du contenu** : questionnaire (violence, etc. → tout public, jeu de réflexes sans contenu sensible).
- **Confidentialité** : déclarer « aucune donnée collectée » et fournir l'URL de la politique de confidentialité (héberger `PRIVACY.md`, ex. via GitHub Pages : `https://<user>.github.io/road-game/PRIVACY.md`).
- **Publicité / achats in-app** : le jeu n'en contient pas → déclarer « Non ».
- Soumettre pour validation (quelques heures à quelques jours), puis publier.

### 6. Monétisation (pubs récompensées)

La pub « continuer la partie » est actuellement **simulée** (compte à rebours de 5 s dans `js/ads.js`). Pour la production Play Store : créer une app sur [AdMob](https://admob.google.com), activer une unité **Rewarded**, et la brancher dans la TWA (les rewarded ads web fonctionnent dans une TWA via le SDK AdMob web + médiation). Remplacer alors l'appel à `watchRewarded()` dans `js/main.js` par le vrai chargement de la pub.

### 7. Mises à jour

- Modifier le code, bumper la constante `CACHE` dans `sw.js` (ex. `roadtap-v2`), commit, push.
- Le site se met à jour automatiquement ; si le manifest/domaine change, regénérer le bundle avec `bubblewrap update` puis `bubblewrap build`, et uploader le nouvel AAB dans la Play Console.

## 🏆 Classement en ligne (optionnel)

Par défaut le classement est **local** (stocké sur l'appareil). Pour un classement **mondial** :

1. Créer un projet gratuit sur [Firebase](https://console.firebase.google.com) → Realtime Database (mode test) → copier l'URL de la base (`https://<projet>-default-rtdb.firebaseio.com`).
2. Dans `js/config.js`, renseigner `FIREBASE_DB_URL` (et éventuellement `FIREBASE_DB_SECRET`).
3. Règles de la base en développement : `{"rules": {".read": true, ".write": true}}` — à **restreindre en production** (ex. limiter les écritures, utiliser Firebase Auth).
4. Bumper le `CACHE` du service worker et redéployer.

Sans config, tout fonctionne hors ligne en local. Le joueur choisit son pseudo (menu 🏆 → « Mon pseudo ») et coche « apparaître dans le classement » : seuls les joueurs inscrits y figurent. Chaque score est enregistré avec la difficulté jouée, et l'écran 🏆 permet de filtrer par difficulté.

## 💰 Monétisation — 100 % cosmétique, jamais pay-to-win

Règles suivies (et exigées par Google Play) : **aucun achat n'influence le gameplay** (pas de niveaux, vies, points ou avantages acheatables).

- **Boutique cosmétique** (déjà en place) : voitures de plus en plus détaillées, effets visuels — payés en pièces gagnées en jouant.
- **Pub rewarded optionnelle** : uniquement proposée au 3ᵉ raté pour continuer (jamais forcée, jamais de power-up). En production : AdMob (voir §6).
- **Packs cosmétiques premium** (idée) : thèmes de route supplémentaires, skins exclusifs — achat in-app Play Billing.
- **« Sans publicité » optionnel** (idée) : IAP qui supprime uniquement la pub de continue facultative.
- **Bannière** (idée) : uniquement dans les menus, jamais pendant une partie.

## 🧪 Tests

```bash
node tests/core.test.mjs
```

Vérifie le jugement de timing, le calcul des points/combo, la génération déterministe des niveaux et la jouabilité des écarts de lignes pour les 12 niveaux.

## 🛠 Régénérer les icônes

```bash
python3 tools/make_icons.py
```

## Licence

MIT — libre d'utilisation, modification et publication.
