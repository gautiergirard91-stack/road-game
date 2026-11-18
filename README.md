# 🚗 Road Tap Racer

Jeu d'arcade de rythme **façon Piano Tiles** : une voiture roule sur une route et le joueur doit toucher l'écran au moment exact où les **roues atteignent une ligne blanche**. La précision (PARFAIT / BIEN / OK), le nombre de réussites et la rapidité de réaction sont récompensées par des points et des combos. Une ligne manquée = partie terminée.

Le jeu est une **PWA (Progressive Web App)** : jouable dans n'importe quel navigateur moderne, installable sur mobile, jouable hors ligne, et **publiable sur le Google Play Store** via une Trusted Web Activity (TWA).

## 🎮 Fonctionnalités

- **Gameplay timing** : jugement en millisecondes (PARFAIT ±45 ms, BIEN ±100 ms, OK ±160 ms), combo multiplicateur, **3 vies** (compteur ❤️ dans le HUD) : au 3ᵉ raté, possibilité de **continuer contre des pièces** (100 🪙, doublé à chaque fois) **ou en regardant une pub** (simulée dans `js/ads.js`, à remplacer par AdMob en production). Écran de fin avec statistiques (précision %, réaction moyenne, meilleur combo, lignes manquées).
- **12 niveaux déblocables** avec difficulté croissante : vitesse, espacement des lignes, et 3 types de balisage (ligne pointillée, bande continue, chevrons, doubles lignes rapprochées).
- **5 thèmes de route** : Autoroute, Ville, Désert, Neige, Nuit (scénarios animés, parallaxe, néons).
- **Économie de jeu** : pièces gagnées à chaque partie, dépensables pour débloquer les niveaux suivants.
- **Boutique de personnalisation** : 8 voitures réparties en **3 modèles dessinés différemment** (citadine, berline, sport avec aileron) + couleurs/or/arc-en-ciel, et 4 effets visuels (traînée de particules, lignes lumineuses, secousse, confettis).
- **Sauvegarde locale** (`localStorage`) : pièces, achats, records.
- **PWA complète** : manifest, service worker (hors ligne), icônes 192/512/maskable, plein écran portrait, sons générés en WebAudio (aucun asset externe).
- **Contrôles** : tactile (tap) ou clavier (Espace / Flèche bas), pause (P ou ⏸).

## 📁 Structure

```
index.html               Page unique (écrans : menu, niveaux, boutique, fin, pause, aide)
css/style.css            Style de l'interface
js/data.js               Données : thèmes, 12 niveaux, skins, effets, fenêtres de timing
js/core.js               Logique pure (testable sous Node) : jugement, score, génération des niveaux
js/game.js               Moteur Canvas : route, voiture, lignes, particules, thèmes animés
js/store.js              Sauvegarde localStorage (pièces, achats, records)
js/audio.js              Effets sonores synthétisés en WebAudio
js/main.js               Navigation entre écrans, boucle de jeu, entrées tactiles/clavier
manifest.webmanifest     Manifeste PWA
sw.js                    Service worker (cache, hors ligne) — penser à bumper CACHE à chaque mise à jour
icons/                   Icônes générées (tools/make_icons.py, Python stdlib uniquement)
assetlinks.json          Template Digital Asset Links pour la TWA (voir ci-dessous)
PRIVACY.md               Politique de confidentialité (à héberger et référencer dans la Play Console)
tools/make_icons.py      Régénère les icônes : python3 tools/make_icons.py
tests/core.test.mjs      Tests Node de la logique de jeu : node tests/core.test.mjs
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

La TWA exige un site en **HTTPS avec un domaine vérifié**. Options gratuites :

- **GitHub Pages** : Settings → Pages → déployer la branche `main` ; l'URL sera `https://<user>.github.io/road-game/`.
- **Netlify** ou **Vercel** : connecter le dépôt, déploiement automatique en HTTPS.

Vérifier que `https://<domaine>/manifest.webmanifest` et `https://<domaine>/sw.js` répondent bien.

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
