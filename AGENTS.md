# AGENTS.md — consignes pour tout agent IA travaillant sur Road Tap Racer

Ce fichier est lu automatiquement par les outils d'IA (Claude Code, etc.). Le suivre strictement.

## Identité du projet
- **Road Tap Racer** : jeu d'arcade façon Piano Tiles — tap quand les roues touchent une ligne blanche pointillée.
- PWA 100 % vanilla : HTML5 Canvas + ES modules, **zéro dépendance, zéro build**.
- Publiable sur Google Play via TWA/Bubblewrap ; hébergé sur `https://roadtap.uk` (GitHub Pages, branche `main`, racine `/`, domaine Cloudflare DNS-only).
- **Monétisation 100 % cosmétique, jamais pay-to-win.** Ne jamais commiter de secret : les clés Firebase publiques (`FIREBASE_WEB_API_KEY`, `FIREBASE_OAUTH_CLIENT_ID`) sont OK, `FIREBASE_DB_SECRET` reste **vide** (les règles RTDB remplacent le secret).

## Workflow Git (obligatoire)
- Branche de travail unique : `vibe/road-tap-pwa-264a24`. Ne jamais créer de nouveau dépôt.
- Fusionner sur `main` UNIQUEMENT quand l'utilisateur le demande (« push sur main pour les testeurs ») :
  `git checkout main && git merge --no-ff vibe/road-tap-pwa-264a24 && git push origin main && git checkout vibe/road-tap-pwa-264a24`
- **À chaque déploiement** : bumper `VERSION` dans `js/config.js` (x.y.z), `CACHE` dans `sw.js` (`roadtap-vN`, +1 à chaque fois) ET `version.json` à la racine (même version que `VERSION`) — v1.3.30 : `version.json` sert de sonde anti-SW-obsolète (jamais caché par le SW, lu au démarrage ; si le serveur est plus récent, le jeu propose/force un reset SW une fois par session : unregister + caches vidés + reload). L'audit CI vérifie que `version.json` == `VERSION`.
- **Avant chaque commit** : `node --check` sur chaque fichier JS modifié + `node tests/core.test.mjs` + `node tests/game.smoke.test.mjs`. CI (`.github/workflows/ci.yml`) relance les deux suites.
- Ne jamais modifier le projet Google Cloud parasite (`project-f6b7d7eb`) ; le vrai projet est `realtime-database-5fd49` (ROADTAP, europe-west1).

## Conventions de code
- UI en **français**. Rendu Canvas 2D uniquement. Sauvegarde `localStorage` clé `roadtap_save_v1` (migrations dans `store.load()`).
- Économie : 3 monnaies (`CURRENCIES` dans `js/data.js`) — un niveau se débloque dans la monnaie de SA difficulté et seulement après avoir terminé le niveau précédent ; Survie ∞ verrouillée tant que les 15 niveaux n'ont pas `best > 0`.
- Voitures rendues **en vue de dessus** par `paintCar` (`js/game.js`) : 7 styles (`CAR_STYLES`) × 13 modèles (`MODELS`, `bodyH > w`). Aperçu boutique = mini canvas via `renderCarPreview`.
- `docs/QA.md` : ajouter une checklist par version. `docs/FIREBASE.md` : config Firebase + règles RTDB. `docs/MONETIZATION.md`, `docs/MARKETING.md`, `PRIVACY.md` à jour.

## Communication avec l'utilisateur
- Répondre en **français**, concis, avec des options concrètes plutôt que des questions ouvertes.
- **Après chaque push**, terminer le message par un bloc `🔔 BLOC DE TEST` : kill du serveur (`lsof -ti:8080 | xargs kill`), `git pull`, `python3 -m http.server 8080`, **Ctrl+Shift+R** obligatoire (bump CACHE), puis une checklist de vérification.
- Signaler tout blocage avec la cause exacte (ex: CORS, règles RTDB) et 2–3 pistes concrètes.

## Agents spécialisés (Mistral Vibe CLI)

Agents configurés au niveau projet dans `.vibe/agents/` :

**Sous-agents (délégation automatique par l'agent principal selon la description)** :
- **gameplay** (`.vibe/agents/gameplay.toml`) : mécaniques, physique, boucle de jeu — outils : read_file, search_replace, write_file, bash.
- **équilibrage** (`.vibe/agents/equilibrage.toml`) : valeurs numériques uniquement (js/data.js, bonus) — outils : read_file, search_replace, write_file.
- **contrôles** (`.vibe/agents/controles.toml`) : inputs, réactivité, feel, timing — outils : read_file, search_replace, write_file, bash.

**Agents sélectionnables (`vibe --agent <nom>` ou Shift+Tab)** :
- **polish** (`.vibe/agents/polish.toml`) : juice, feedback, UI/UX, perfs — en dernier, sur une version déjà jouable.
- **niveaux** (`.vibe/agents/niveaux.toml`) : design/génération des niveaux (js/data.js + js/core.js).
- **assets** (`.vibe/agents/assets.toml`) : intégration assets (canvas procédural, icônes PWA, sons) + prompts outils externes.

Pour rendre un agent sélectionnable en subagent (ou l'inverse) : changer `agent_type` dans son TOML.
