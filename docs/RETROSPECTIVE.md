# 📖 Rétrospective complète — Road Tap Racer (session "nuit du béton armé")

Rédigée en relisant le code **from first principles** (premiers principes), pas depuis la mémoire.
Objectif : comprendre chaque bug à sa racine, et poser des garde-fous structurels pour qu'il ne revienne plus.

---

## 1. Ce qui a été livré (v1.0 → v1.3.27)

### Le jeu
- **PWA 100 % vanilla** (HTML5 Canvas + ES modules, zéro dépendance, zéro build) : jouable sur PC et téléphone, installable, **hors-ligne** après la première visite.
- **Gameplay Piano-Tiles** : tap quand les roues atteignent une ligne blanche pointillée. Fenêtres de jugement en ms (`parfait 45 / bien 100 / passable 160`, élargies en accessibilité), 3 difficultés :
  - **Auto école** 🪙 : tap n'importe où, essieu arrière, 3 ❤️.
  - **Permis A** 🎓 : haut = roues AV, bas = roues AR, chaque ligne jouée 2× indépendamment, 5 ❤️.
  - **Pilote** 🏁 : swipe ⬅ pour doubler une voiture, sinon ralentissement puis bouchon = fin ; 5 ❤️.
- **15 niveaux** à débloquer (coût croissant, monnaie propre à la difficulté), **Survie ∞** verrouillée tant que les 15 niveaux d'une difficulté ne sont pas **terminés** (`cleared`, pas juste achetés), **Speedrun** (chrono, +30 px/s par PARFAIT plafonné à +80 %, raté = vitesse perdue, difficulté Pilote forcée, compte à rebours 10 s vers le niveau suivant avec option de sortie).
- **Tutorial interactif forcé** (9 étapes actionnables, pause entre chaque explication + curseur à tirer, quitter → popup au prochain lancement tant que non terminé).
- **Monde vivant** : trafic en sens inverse (voitures top-down), passages piétons (la voiture s'arrête **avant** le passage, le piéton traverse, pas de pénalité), dépassements (autorisé dès l'entrée à l'écran, plus de trafic inverse pendant le dépassement), météo (pluie/neige).
- **Économie 100 % cosmétique** (jamais pay-to-win) : 3 monnaies (🪙/🎓/🏁 par difficulté), boutique paginée (voitures 13 modèles × 7 styles de rendu / effets / thèmes / packs / packs sonores) avec **aperçus canvas temps réel** pour chaque catégorie, bonus de premier clear, bonus full-parfait (+pièces + 🥇 trophée), combo **uniquement sur PARFAIT**.
- **Rétention** : défi du jour, quêtes hebdomadaires, streak de connexion, classement du défi.
- **Classement** local + Firebase RTDB (REST, sans SDK), filtre difficulté + filtre niveau (3 lignes), pseudo optionnel + opt-in, **connexion Google** (GIS + échange de jeton en `form-urlencoded` pour éviter le preflight CORS).
- **Accessibilité** : fenêtres élargies, symboles daltonien, **zones horizontales** (gauche=AV / droite=AR) avec séparateur visuel AV/AR dessiné à l'écran, tutoriel repliable.
- **Sauvegarde** : localStorage + cloud Firebase (keyed par uid Google si lié, sinon pseudo), fusion tolérante.

### L'infrastructure
- Hébergement GitHub Pages + domaine `roadtap.uk` (Cloudflare DNS-only), `CNAME`, `.nojekyll`, `manifest.webmanifest`, service worker, `PRIVACY.md`, `docs/` façon studio (GAME_DESIGN, QA, MARKETING, LEGAL, MONETIZATION, FIREBASE), assets store (`store/`), `AGENTS.md` (consignes), CI GitHub Actions (4 tests + audit statique), `.well-known/assetlinks.json` (template TWA).

---

## 2. Problèmes rencontrés → cause racine → solution → prévention

| # | Symptôme | Cause racine (trouvée en relisant le code) | Solution | Prévention posée |
|---|----------|---------------------------------------------|----------|------------------|
| 1 | Page morte, « plus rien ne clique » | **SyntaxError** dans `tutorial.js` (template literal ouvert avec `` ` `` et fermé avec `"`) → le module ne parse pas → tout `main.js` est mort. Et `node --check file.js` **ne détecte PAS** les erreurs ESM (il parse en CommonJS). | Corrigé la quote ; l'audit parse désormais chaque module en ESM via `node --input-type=module --check`. | Parse ESM de **tous** les modules dans `tools/audit.mjs` exécuté en CI à chaque push + `window.onerror` affiche une boîte rouge visible (`#fatal-error`). |
| 2 | Mélange de versions après déploiement (vieux JS + nouveau HTML) | Le service worker servait le **code en cache-first** : un déploiement partiel laissait un HTML neuf avec un vieux JS. | SW en **network-first pour tout le code** (js/css/html/webmanifest), cache en repli hors-ligne ; `CACHE` bumpé à chaque deploy ; `clients.claim()`. | Règle AGENTS.md : bump `CACHE` + `VERSION` à **chaque** deploy ; SW réseau-d'abord pour le code. |
| 3 | Crash hors-ligne au premier lancement | `js/auth.js` ajouté au code mais **oublié dans `ASSETS`** du SW → fetch du module échoue hors-ligne → module graph mort. | Ajouté à `ASSETS`. | `tools/audit.mjs` vérifie que **chaque import JS du projet est dans `ASSETS`** (et inversement), en CI. |
| 4 | 37 clics morts silencieusement | `$('#id').addEventListener(...)` → TypeError si l'ID n'existe pas (HTML/JS désynchronisés) → toute la suite du wiring saute. | Helper `on(id, ev, fn)` null-safe + audit HTML↔JS. | Audit CI : tout ID référencé en JS doit exister dans le HTML (whitelist pour les éléments créés dynamiquement). |
| 5 | Crash au tap quand la voiture est arrêtée (piéton) | `effSpeed = 0` → `dtMs = dy/0 = NaN` (ou 0/0) → `judge(NaN)` retournait un jugement bidon → `RESULT_STYLE[null].label` → TypeError. | `judge()` renvoie `null` si `!Number.isFinite(dtMs)` ; `tap()` traite `!(speed>0)` et `!result` comme « clic dans le vide » (pendingStray, −1 ❤️ après 0,25 s). | **Test de régression** dans `tests/break.test.mjs` (tap à l'arrêt pile sur une ligne). |
| 6 | Portefeuille/score devenus `NaN` | `addCoins(diff, NaN)`, `pointsFor(null)`, `coinsForResult({})` propageaient NaN dans `localStorage`. | `num()` dans `addCoins`/`spend`, `BASE_POINTS[result] \|\| 0`, `coinsForResult` défensif. | `tests/break.test.mjs` : save corrompue + setters + `coinsForResult({})` → jamais NaN. |
| 7 | Sauvegarde corrompue = jeu qui ne démarre plus | `JSON.parse` cassé ou mauvais types (`trophies: 5`, `difficulty: 42`…) → crash au `load()`. | `sanitize()` sur **chaque champ** au `load()` + `setPseudo` stringifie à la volée. | Test adversarial : JSON cassé, `null`, `42`, `"string"`, mauvais types → `load()` ne throw jamais. |
| 8 | `mergeRemote` plantait sur données cloud bizarres | Champs distants non tableau/non objet (`packs: 5`, `quests: "x"`) → spread/entries qui throw. | Corps renommé `mergeRemoteBody` avec guards (`arr()`, `num()`, `typeof === 'object'`) + wrapper `mergeRemote` en **try/catch** qui retourne `false`. | Test : `mergeRemote(null/'garbage'/42/{...bizarre})` → jamais de throw. |
| 9 | Classement : « on ne voit que soi-même » | Cause multiple : (a) `orderBy` REST sans `.indexOn` → HTTP 400 silencieux → fallback local ; (b) règles RTDB non publiées / expirées (mode test 30 j) ; (c) écritures refusées (champ manquant) en silence. | v1.3.22 : lecture du **nœud entier + tri client** ; v1.3.27 : **diagnostic visible** (`getLbStatus()` → `#lb-source` affiche « N score(s) chargés » ou l'erreur exacte `⚠ HTTP 401 sur scores/auto`) + section « Diagnostic » dans `docs/FIREBASE.md` avec URLs de vérification copy-paste. | Tri client défensif (`cleanEntry` : entrées non-objets ignorées, score non fini → 0) + tests fetch cassé/401/403/données corrompues. |
| 10 | Tutoriel bloqué après le passage piéton (niveau qui défile indéfiniment) | L'étape attendait un événement `crosswalk` qui n'arrivait plus (piéton consommé, plus de respawn). | `respawn: true` sur l'étape + `tick()` qui respawn un passage piéton tant qu'aucun n'est en attente + **watchdog 45 s**. | `tests/tutorial.test.mjs` : drive headless **complet** du tutoriel (random seedé, temps simulé) exécuté en CI. |
| 11 | Slider du tutoriel inutilisable sur mobile | `touchmove` appelait `preventDefault()` sur toute la bannière → le doigt ne glissait pas. | `preventDefault` retiré hors contrôles + fallback de drag **pointer-based**. | Test headless du slider (pointer events). |
| 12 | Achat d'un niveau lançait la partie / niveau suivant débloqué en jouant | Achat et complétion confondus. | Achat ≠ start ; déblocage du niveau N exige `cleared(N-1)` = partie **terminée en entier**, synchronisé cloud. | Vérifié dans la logique `store` + smoke tests. |
| 13 | Voiture du joueur traversait les voitures en sens inverse pendant le dépassement | Spawn de trafic inverse non conditionné à la position du dépassement. | Plus de spawn tant que `carXFrac < 0.6` + clear du trafic inverse au dépassement. | Smoke test #9 (scénario dépassement). |
| 14 | Piéton : la voiture s'arrêtait **au milieu** du passage | Arrêt déclenché trop tard / branche `autoStop` mal placée. | `updateTraffic` restructuré : arrêt **avant** le crosswalk, le piéton traverse, reprise. | Smoke test #3 (ralentissement autoStop détecté). |
| 15 | Serveur « injoignable » en rouge alors que Firebase OK | `ping()` lisait la **racine** `/.json` — non lisible par design (règles) → 401 → pastille rouge. | Ping sur `/scores/.json?shallow=true` (nœud public). | Documenté dans FIREBASE.md : `/.json` → 401 = **normal**. |
| 16 | Connexion Google : page inchangée / erreurs CORS | Échange de jeton en JSON → preflight OPTIONS bloqué ; bloqueurs (uBlock/Privacy Badger) ; domaines non autorisés. | `form-urlencoded` (pas de preflight) + doc des 2 listes de domaines (Firebase + Cloud Console) + `getLastAuthError()`. | FIREBASE.md §5 étape par étape. |
| 17 | Boucle infinie potentielle dans `buildPattern` | `level.lines` non borné (NaN/Infinity/énorme) ou poids vides / gaps inversés. | `nLines` plafonné à 10000, fallback `dash`, `gapMax` recalé si < `gapMin`. | Tests : `lines: 1e9`, `lines: NaN`, `w: {}`, gaps inversés. |

---

## 3. Garde-fous structurels posés cette nuit (v1.3.27 « béton armé »)

1. **`sanitize()` au chargement** de la save (chaque champ typé) + setters défensifs (`setPseudo`, `addCoins`, `spend`).
2. **`mergeRemote` en try/catch** + guards internes → le cloud corrompu ne tue jamais le jeu.
3. **`judge(NaN) → null`**, `tap()` guard `speed > 0` et `!result` → régression du crash piéton couverte par un test.
4. **`fmtTime`, `pointsFor`, `coinsForResult`, `isPerfectClear`, `buildPattern`** : jamais de NaN, jamais de boucle infinie.
5. **Leaderboard résilient + bavard** : tri client défensif, fallback local, et **l'UI explique** pourquoi on ne voit que soi (source, count, erreur HTTP exacte).
6. **CI renforcée** : 4 suites de tests (core, smoke moteur, tutoriel headless complet, **adversarial break**) + audit statique (IDs, imports↔exports, assets SW, manifest, clés localStorage, **parse ESM réel** de chaque module).
7. **SW réseau-d'abord pour le code** + bump systématique de `CACHE`/`VERSION`.
8. **`on()` null-safe** pour les 37+ listeners + `window.onerror` → boîte d'erreur visible.

---

## 4. Leçons

- **Un fallback silencieux est un bug en puissance** : toujours remonter *pourquoi* on est en local (d'où `getLbStatus`).
- **`node --check` ne suffit pas pour de l'ESM** : le parse CI se fait en `--input-type=module`.
- **Un SyntaxError dans UN module tue TOUTE la page** (modules ES) : d'où l'audit de parse + `window.onerror` visible.
- **Ne jamais faire confiance à `localStorage` ni au réseau** : sanitize à l'entrée, try/catch aux frontières, tests adversarials qui cassent exprès.
- **Un test headless qui conduit le vrai moteur** (tutoriel, smoke) attrape ce que les tests unitaires ratent.
- **Bump `CACHE` à chaque deploy, toujours** — sinon les testeurs jouent une version fantôme.
