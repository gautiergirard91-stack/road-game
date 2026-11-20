# 🚗 Road Tap Racer

Jeu d'arcade de rythme **façon Piano Tiles** : une voiture roule sur une route et le joueur doit toucher l'écran au moment exact où les **roues atteignent une ligne blanche**. La précision (PARFAIT / BIEN / OK), le nombre de réussites et la rapidité de réaction sont récompensées par des points et des combos. Une ligne manquée = partie terminée.

Le jeu est une **PWA (Progressive Web App)** : jouable dans n'importe quel navigateur moderne, installable sur mobile, jouable hors ligne, et **publiable sur le Google Play Store** via une Trusted Web Activity (TWA).

## 🎮 Fonctionnalités

- **Gameplay timing** : jugement en millisecondes (PARFAIT ±45 ms, BIEN ±100 ms, OK ±160 ms), combo multiplicateur (**le combo ne monte que sur PARFAIT**), vies dans le HUD (❤️) : une ligne manquée **ou un clic dans le vide** = −1 ❤️ — **3 vies en Auto école, 5 en Permis A / Pilote** ; au dernier raté, possibilité de **continuer contre des pièces** (100 🪙, doublé à chaque fois) **ou en regardant une pub** (simulée dans `js/ads.js`, à remplacer par AdMob en production). Écran de fin avec statistiques (précision %, réaction moyenne, meilleur combo, ratés, dépassements).
- **Voiture sur la voie de droite**, avec **circulation en sens inverse** (voie de gauche, purement visuelle) et, en mode Pilote, des voitures dans le même sens.
- **3 niveaux de difficulté** (sélecteur en haut de l'écran des niveaux) :
  - **Auto école** : tap n'importe où quand les roues touchent la ligne.
  - **Permis A** : deux essieux (AV = roues avant, AR = roues arrière). **Chaque ligne doit être touchée deux fois, indépendamment** : d'abord par l'essieu avant (tap **moitié haute** de l'écran quand la ligne atteint la ligne AV cyan), puis par l'essieu arrière (tap **moitié basse**, ligne AR). Chaque essieu est jugé séparément (son propre PARFAIT/BIEN/OK, prefixé AV/AR), et chaque essieu manqué coûte un ❤️.
  - **Pilote** : comme Permis A, plus des voitures devant : **swipe vers la gauche** (ou ⬅) pour doubler — c'est **ta voiture** qui se déplace sur la voie de gauche pendant le dépassement, la voiture doublée reste à droite. Sans dépassement, ta voiture ralentit (1 s de grâce, puis ralentissement progressif) jusqu'à l'arrêt complet = fin de partie « 🚦 bouchon ». Pendant le ralentissement : combos coupés et points ×0,2.
- **🚶 Passages piétons en ville** (niveaux 4–5) : une bande zébrée compte comme **une ligne à cliquer** ; quand un piéton traverse, la voiture **s'arrête seule** pour le laisser passer (pause sans pénalité de combo/points), puis repart.
- **Décor de bord de route selon le thème** : arbres, immeubles, cactus, sapins enneigés, skyline nocturne + **lampadaires** (éclairés la nuit).
- **🏆 Classement** : le joueur choisit un pseudo et peut apparaître dans le classement (opt-in). **Filtre par difficulté** (Tous / Auto école / Permis A / Pilote). Classement **local** par défaut, **en ligne via Firebase Realtime Database** si configuré (`docs/FIREBASE.md`), un nœud par difficulté. **Sauvegarde cloud** du profil et **analytics** via le même projet Firebase.
- **∞ Mode Survie** : génération procédurale infinie, vitesse croissante, écarts qui se resserrent.
- **👶 Tutoriel interactif FORCÉ** au premier lancement (réouvrable depuis le menu) : 8 étapes où le joueur doit exécuter chaque mécanique (tap, PARFAIT, combo x3, raté volontaire, tap AV puis AR, swipe de dépassement, passage piéton) pour avancer — chaque étape démarre **en pause** avec un **curseur à glisser** jusqu'au bout quand on a lu (et « ✖ Quitter » = le tutoriel n'est pas validé, il revient à la prochaine partie) — +200 🪙 de récompense ; **🏅 13 succès** avec récompenses en pièces ; **♿ accessibilité** (fenêtres élargies, symboles daltonien) ; **🎵 musique de fond** + vibrations ; **effets météo** achetables (pluie, neige) ; **thèmes de route déblocables** (Néon, Coucher de soleil) qui remplacent le décor de tous les niveaux ; **CI GitHub Actions** (tests auto à chaque push/PR).
- **15 niveaux déblocables** avec difficulté croissante (bonus de premier clear 🎉) : vitesse, espacement des lignes, 3 types de balisage (pointillé, bande continue, chevrons, doubles lignes) + **passages piétons** en ville.
- **5 thèmes de route** : Autoroute, Ville, Désert, Neige, Nuit (scénarios animés, parallaxe, néons).
- **Économie de jeu — 3 monnaies** : 🪙 (Auto école), 🎓 (Permis A), 🏁 (Pilote). On gagne la monnaie du **mode joué** ; les niveaux se débloquent **dans l'ordre** avec la monnaie de leur palier (1-5 🪙, 6-10 🎓, 11-15 🏁) — impossible d'acheter le dernier niveau directement. Boutique (voitures/effets/thèmes) en 🪙. On ne peut **acheter le niveau N** qu'après avoir **terminé le niveau N-1** au moins une fois, et la **Survie ∞** se débloque quand les **15 niveaux** sont terminés. Gains volontairement sobres (anti-farm). **Full PARFAIT** (niveau terminé sans BIEN/OK/raté) = 🥇 médaille du niveau + gros bonus (300 + 60×n°).
- **Boutique de personnalisation** (chaque article a **sa propre monnaie** 🪙/🎓/🏁) : 14 voitures en **5 modèles** (citadine, berline, sport, 4x4, F1), + **10 effets visuels** (traînée, glow, secousse, confettis, pluie 🌧, neige ❄, **lignes arc-en-ciel 🌈**, **vignette 🎥**, feu 🔥 à combo ≥ 10, **voiture fantôme 👻**), 2 thèmes de route premium, **2 packs** (ex: Pack Sport = 2 voitures + 2 effets à prix réduit) et **3 packs de sons** (standard, Arcade 8-bit 🕹️, Synthwave 🌆).
- **Game feel & perfs** : halo pulsant sur la ligne qui approche, lignes de vitesse à haute vélocité, transitions en fondu, tutoriel in-game (3 premières lignes surlignées + astuce), pastille version + statut serveur dans le menu, rendu stoppé quand l'onglet est caché (batterie), cap de particules.
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
tools/make_store_assets.py  Assets Play Store (store/) : python3 tools/make_store_assets.py
store/                   Bannière 1024x500 + captures placeholder (à remplacer par de vraies captures)
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

**Option A — GitHub Pages + domaine perso `roadtap.uk` (déjà en place côté dépôt)** :

1. Merger la PR sur `main`, puis dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch → branche `main`, dossier `/ (root)` → Save**.
2. DNS chez **Cloudflare** (panneau DNS de `roadtap.uk`) : un seul enregistrement suffit grâce au CNAME flattening de Cloudflare à la racine :
   - **Type CNAME**, **Nom `@`**, **Contenu `gautiergirard91-stack.github.io`**, **Proxy status : DNS only (nuage gris)** — PAS « Proxied » (orange), GitHub Pages a besoin du DNS direct — TTL Auto.
3. Côté GitHub : **Settings → Pages → Custom domain** → `roadtap.uk` → **Save** → cocher **Enforce HTTPS** (certificat émis en ~15 min–1 h).
4. Le dépôt contient déjà : `CNAME` (roadtap.uk), `.nojekyll` (pour servir `.well-known/` tel quel) et `.well-known/assetlinks.json` → servi automatiquement à **`https://roadtap.uk/.well-known/assetlinks.json`** (obligatoire pour la vérification TWA). Remplir `package_name` (défaut `uk.roadtap.game`) et l'empreinte SHA-256 de la clé de signature (Play Console → Intégrité de l'app).
5. Vérifier : `https://roadtap.uk/` charge le jeu, cadenas HTTPS vert, `https://roadtap.uk/manifest.webmanifest` et `/sw.js` répondent 200. L'ancienne URL `gautiergirard91-stack.github.io/road-game/` redirige vers `roadtap.uk`.

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
