# ✅ Assurance qualité

> **Note (v1.3.77)** : les checklists ci-dessous sont un *historique* — l'état courant du jeu est **v1.3.90**. Chaque version ajoute sa checklist en bas du fichier ; ne pas modifier les anciennes.

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

## Checklist v1.3.4 (progression/économie)

- [ ] **Survie ∞ verrouillée** au début (« 🔒 15 niveaux à finir ») ; débloquée quand les 15 niveaux ont un record > 0
- [ ] **Niveau N achetable seulement si le niveau N-1 terminé au moins 1 fois** (« 🔒 finis le niveau N-1 ») ; achat toujours débité dans la monnaie du palier du niveau
- [ ] **Gains réduits** : vérifier à l'écran de fin `+X monnaie` plus faible qu'avant (score/8 + 3×PARFAIT + 100+20×n° si terminé)
- [ ] Full PARFAIT = 🥇 + bonus 300+60×n° ; premier clear = 150+30×n°
- [ ] CI verte

## Checklist v1.3.5 (défis & rétention)

- [ ] **Écran 🎯 Défis** : série de connexion affichée ; défi du jour identique pour tous (tester 2 jours différents) ; quêtes hebdo avec barres de progression
- [ ] Finir une partie correspondant au défi du jour → toast + récompense dans la monnaie du mode + score envoyé au classement du défi (Firebase, nœud `challenges` — **mettre à jour les règles RTDB avec celles de docs/FIREBASE.md**)
- [ ] Quêtes : la progression monte après chaque partie ; quête terminée = +🪙 et ✅
- [ ] Streak : fermer/rouvrir le même jour = rien ; lendemain = +1 jour et +N 🪙 (max x7) ; trou > 1 jour = remise à 1
- [ ] CI verte + CACHE sw bumpé

## Checklist v1.3.6 (classement par niveau + Google Sign-In)

- [ ] Classement : second filtre « par niveau » (Tous + 1..15 + ∞) qui combine avec le filtre difficulté ; les anciens scores (sans levelId) sont matchés par nom de niveau
- [ ] Pseudo modal : bouton Google rendu si clés configurées ; clic → compte lié (uid + email affiché) → sauvegarde cloud keyed par uid ; rechargement → session restaurée silencieusement (refreshToken local)
- [ ] « Se délier » → retour au pseudo local ; le refreshToken n'apparaît JAMAIS dans le snapshot cloud (vérifier dans Firebase `players/<uid>`)
- [ ] Règles RTDB mises à jour (nœud players : `auth.uid == $id`) ; domaines autorisés : roadtap.uk + github.io
- [ ] CI verte + CACHE sw bumpé

## Checklist v1.3.7 (dépassement propre : plus de trafic en sens inverse)

- [ ] Mode Pilote : swipe ⬅ devant une voiture → **l'entre-sens est vidé** devant la voiture du joueur (aucun chevauchement visuel) et **aucun spawn en sens inverse** tant que la voiture est à gauche (carXFrac < 0.6)
- [ ] Le trafic en sens inverse **reprend** une fois la voiture revenue dans la voie de droite
- [ ] Le dépassement reste autorisé dès que la voiture à doubler entre à l'écran ; la voiture revient bien à droite après (laneTarget 0.72)
- [ ] Tuto : l'étape dépassement se termine bien quand la voiture est revenue dans la file (pas de défilement infini)
- [ ] CI verte + CACHE sw bumpé (roadtap-v15) + VERSION 1.3.7

## Checklist v1.3.8 (Google Sign-In : échange du jeton sans preflight CORS)

- [ ] `js/auth.js` envoie `accounts:signInWithIdToken` en **form-urlencoded** → plus de requête `OPTIONS` dans F12→Réseau, seulement le POST
- [ ] Clé API (projet `realtime-database-5fd49`) : restrictions d'application = **Aucun**, Identity Toolkit API + Token Service API **cochées**, **Enregistrer** cliqué, attendre ~5 min
- [ ] Popup autorisée pour roadtap.uk dans Chrome (icône popup de la barre d'adresse)
- [ ] Retest : POST `signInWithIdToken` → **200 + `access-control-allow-origin: *`** → modale « 🔗 Compte Google lié » + nœud `players/<uid>` dans RTDB
- [ ] Si 403 : le toast affiche le vrai message Google → vérifier la clé (Afficher la clé == `AIzaSyCIFhp4tI-8pL9HG-fD9XIJfNLln5dBG9g`)
- [ ] CI verte + CACHE sw bumpé (roadtap-v16) + VERSION 1.3.8

## Checklist v1.3.9 (pastille serveur)

- [ ] La pastille pingue `/scores/.json?shallow=true` (nœud public) au lieu de la racine `/.json` (401 à cause des règles) → affiche **🟢 En ligne — serveur OK** quand la RTDB est atteignable
- [ ] Règles RTDB bien enregistrées dans la console Firebase (onglet Règles) ; URL de la base = `realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app`
- [ ] Classement : les scores envoyés apparaissent bien sous `/scores/<mode>` dans Firebase
- [ ] CI verte + CACHE sw bumpé (roadtap-v17) + VERSION 1.3.9

## Checklist v1.3.11 (boutique : boutons texte par catégorie, sans flèches)

- [ ] Onglets texte « 🚗 Voitures / ✨ Effets / 🎨 Thèmes / 🎁 Packs / 🔊 Sons » en haut de la boutique (sticky), **plus de flèches ◀ ▶**
- [ ] Une seule catégorie visible à la fois ; le bouton actif est surligné ; la page remonte en haut au changement
- [ ] Mobile 390 px : les 5 boutons tiennent (retour à la ligne autorisé si besoin)
- [ ] Achat/équipement depuis n'importe quelle page → re-render OK, on reste sur la même catégorie
- [ ] CI verte + CACHE sw bumpé (roadtap-v19) + VERSION 1.3.11

## Checklist v1.3.12 (voiture : plusieurs styles de rendu + boutons boutique plus gros)

- [ ] 7 styles de voiture : **photo réaliste** (défaut), **blocs** (ancien look, skin « Classique »), néon, pixel 8-bit, rétro 80s, jouet plastique, hologramme — nouveaux skins dans la page 🚗 Voitures, label du style affiché sur la carte
- [ ] La voiture par défaut (Berline grise) utilise le rendu « photo » (dégradés, reflets, jantes à rayons, phares à halo)
- [ ] Boutons de catégories boutique plus gros (16 px, padding 10×14) et toujours lisibles à 390 px
- [ ] Effet fantôme (changement de voie) + badge de lignes restantes toujours visibles avec tous les styles
- [ ] CI verte + CACHE sw bumpé (roadtap-v20) + VERSION 1.3.12

## Checklist v1.3.13 (boutique : aperçu réel de la voiture à la place du carré de couleur)

- [ ] Page 🚗 Voitures : chaque carte affiche un **mini canvas 64×48** rendu avec le vrai moteur (`paintCar`) → aperçu fidèle au style (photo/blocs/néon/pixel/rétro/jouet/holo) et à la couleur
- [ ] Aperçu redessiné à chaque `renderShop()` (achat OK) ; ombre au sol visible
- [ ] Les autres catégories (Effets/Thèmes/Packs/Sons) gardent leur pastille emoji
- [ ] CI verte + CACHE sw bumpé (roadtap-v21) + VERSION 1.3.13

## Checklist v1.3.14 (voitures en VUE DE DESSUS, comme les illustrations top-down)

- [ ] Voiture du joueur : vue de dessus (capot, pare-brise, toit, lunette, coffre, 4 roues aux coins, phares devant, feux derrière, becquet sur sport/F1) — les 7 styles (photo/blocs/néon/pixel/rétro/jouet/holo) sont adaptés à la vue de dessus
- [ ] Modèles plus longs que larges (citadine 46×92 … F1 64×122) ; essieu avant recalculé (`frontAxleY`) → le gameplay AV/AR reste correct
- [ ] Trafic (sens inverse + même sens) aussi rendu en vue de dessus via paintCar
- [ ] Badge de lignes restantes bien au-dessus du nez de la voiture ; effet fantôme OK
- [ ] Aperçu boutique : canvas 56×64 (portrait), voiture top-down bien cadrée
- [ ] CI verte + CACHE sw bumpé (roadtap-v22) + VERSION 1.3.14

## Checklist v1.3.15 (8 nouveaux modèles de voiture top-down)

- [ ] 13 modèles au total : + Camion, Fourgon (caisse `box`), Décapotable, Kart (cockpit ouvert `open`), Limousine (150 px), 2CV, Monster truck (grosses roues), Supercar (becquet) — tous en vue de dessus
- [ ] 8 nouveaux skins boutique avec prix/monnaies cohérents ; labels affichés sur les cartes ; aperçus canvas OK
- [ ] Jouer avec chaque nouveau modèle : caisse/cockpit/grosses roues bien rendus dans les 7 styles
- [ ] CI verte + CACHE sw bumpé (roadtap-v23) + VERSION 1.3.15

## Checklist v1.3.16 (boutique : aperçu réel des effets, comme les voitures)

- [ ] Page ✨ Effets : chaque carte affiche un **mini canvas 56×64** montrant l'effet réel (mini route + ligne + voiture + pluie/neige/confettis/traînée/feu/vignette/arc-en-ciel/halo/fantôme/secousse)
- [ ] Voitures (🚗) : aperçu inchangé ; Thèmes/Packs/Sons gardent leur emoji
- [ ] Aperçus re-rendus à chaque renderShop()
- [ ] CI verte + CACHE sw bumpé (roadtap-v24) + VERSION 1.3.16

## Checklist v1.3.17 (aperçus boutique partout + déblocage des niveaux corrigé)

- [ ] Boutique : les 5 catégories ont un aperçu canvas (🚗 voiture, ✨ effet **sans voiture**, 🎨 mini-route aux vraies couleurs du thème, 🎁 cadeau, 🔊 haut-parleur + ondes)
- [ ] **Bug niveau 1** : cliquer sur « 🔒 payer » débloque le niveau SANS lancer la partie (bouton passe à « ▶ Jouer »)
- [ ] **Bug niveau 2** : acheter le niveau N exige d'avoir TERMINÉ EN ENTIER le niveau N-1 (`cleared`, pas juste un score) ; Survie ∞ exige les 15 niveaux terminés
- [ ] `cleared` persisté + synchro cloud (snapshot/mergeRemote)
- [ ] CI verte + CACHE sw bumpé (roadtap-v25) + VERSION 1.3.17

## Checklist v1.3.18 (aperçu canvas aussi sur les cartes des NIVEAUX)

- [ ] Écran des niveaux : chaque carte affiche un **mini canvas 52×52** du thème du niveau (vraies couleurs : autoroute/ville/désert/neige/nuit/néon/sunset) à la place du dégradé CSS ; Survie ∞ aussi
- [ ] La bordure/bouton « ▶ Jouer » / cadenas restent alignés (carte de même hauteur)
- [ ] CI verte + CACHE sw bumpé (roadtap-v26) + VERSION 1.3.18

## Checklist v1.3.19 (mode ⏱ Speedrun)

- [ ] Écran Niveaux : sélecteur **Mode de jeu** (🏁 Standard / ⏱ Speedrun) ; activer Speedrun force la difficulté **Pilote** ; changer de difficulté en speedrun désactive le mode
- [ ] En partie speedrun : le HUD affiche le **chrono** (m:ss.cc) à la place du score ; chaque PARFAIT (et dépassement) ajoute +30 de vitesse (plafond +80 %), popup « ⚡ VITESSE PERDUE ! » et remise à zéro sur un raté
- [ ] Fin de niveau **terminé** en speedrun : écran de fin avec le temps + **compte à rebours 10 s** (barre + chiffre) qui lance automatiquement le niveau suivant ; boutons « ▶ Continuer maintenant », « Niveaux » (annule le compte à rebours), « Menu »
- [ ] Niveau 15 terminé en speedrun → « 🏁 Speedrun terminé » (pas de compte à rebours) ; niveau raté → écran normal sans compte à rebours
- [ ] Record de temps `⏱` affiché sur la carte du niveau ; `bestTime` + `speedrun` persistés et synchro cloud ; pas d'envoi au classement global en speedrun
- [ ] CI verte + CACHE sw bumpé (roadtap-v27) + VERSION 1.3.19

## Checklist v1.3.20 (fix slider du tutoriel sur mobile)

- [ ] Le `touchmove` global ne fait plus `preventDefault` quand le doigt est sur un contrôle (`input/button/…`) → le drag natif du slider n'est plus coupé
- [ ] Fallback pointer dans tutorial.js : pointerdown/move sur `#tut-slider` calcule la valeur depuis la position X (atteint 100 % à droite, débloque l'étape)
- [ ] Toucher le slider ne déclenche plus de tap dans le jeu (`closest('button, input, …')`)
- [ ] `#tut-read` centré dans la bannière ; slider bien large sur 390 px
- [ ] PC : le slider fonctionne toujours à la souris ; tuto complet jouable jusqu'au bout
- [ ] CI verte + CACHE sw bumpé (roadtap-v28) + VERSION 1.3.20

## Checklist v1.3.21 (option zones gauche/droite)

- [ ] Accessibilité (♿) : case « 🔄 Zones gauche/droite » — gauche = roues AV, droite = roues AR (au lieu de haut/bas), persistée + synchro cloud
- [ ] En partie Permis A/Pilote avec l'option ON : tap à gauche de l'écran = AV, à droite = AR ; le swipe ⬅ (dépassement) fonctionne toujours
- [ ] Clavier : ← = AV et → = AR quand l'option est ON (↑ reste AV)
- [ ] Le texte du tutoriel (étape Permis A) s'adapte à l'option
- [ ] Option OFF = comportement haut/bas inchangé
- [ ] CI verte + CACHE sw bumpé (roadtap-v29) + VERSION 1.3.21

## Checklist v1.3.22 (classement global, Google sur mobile, bannière tuto repliable, délimitation des zones)

- [ ] **Classement** : `getTop` lit `/scores/<mode>.json` entier + tri côté client (plus d'`orderBy` = plus de 400 sans `.indexOn`) → on voit **tous les joueurs**, pas que soi ; idem classement du défi du jour
- [ ] **Modale pseudo sur mobile** : le panneau scrolle (`overflow-y:auto`) et le bouton **Google est en haut**, visible sans scroller
- [ ] **Bannière tuto** : bouton ▾/▴ pour replier le texte ; sur mobile (<760 px) elle est compacte et **repliée automatiquement pendant les phases d'action**, dépliée pendant la lecture (curseur visible)
- [ ] **Délimitation des zones** : en Permis A/Pilote, une ligne pointillée au milieu de l'écran avec « ▲ AV / ▼ AR » (haut/bas) ou « AV ⬅ / ➡ AR » verticale (option gauche/droite) ; rien en Auto école
- [ ] CI verte + CACHE sw bumpé (roadtap-v30) + VERSION 1.3.22

## Checklist v1.3.23 (audit anti-bugs)

- [ ] `tools/audit.mjs` (lancé aussi en CI) : aucun ID JS sans élément HTML, aucun import sans export, tous les assets du SW existent, icônes du manifest OK
- [ ] **fix** : `js/auth.js` ajouté à la liste ASSETS du service worker (sinon le jeu plantait hors-ligne)
- [ ] Mode hors-ligne : recharger roadtap.uk sans réseau → le jeu se lance (menu jouable)
- [ ] CI verte (tests + audit) + CACHE sw bumpé (roadtap-v31) + VERSION 1.3.23

## Checklist v1.3.24 (page morte / clics inactifs — anti mélange de versions)

- [ ] **SW** : le code (js/css/html/manifest) est servi **network-first** (cache en repli hors-ligne) → plus de mélange « nouveau HTML + vieux JS » ; `clients.claim()` actif
- [ ] **main.js** : les 37 listeners passent par `on(id, …)` null-safe ; cases à cocher protégées ; gestionnaire `window.onerror` qui affiche l'erreur en bas de l'écran (`#fatal-error`)
- [ ] **Reset dur côté testeur** : F12 → Application → Service Workers → Unregister + Clear site data, puis Ctrl+Shift+R → la v1.3.24 charge proprement, tous les clics répondent
- [ ] Hors-ligne après ça : le jeu se lance toujours depuis le cache
- [ ] CI verte (tests + audit) + CACHE sw bumpé (roadtap-v32) + VERSION 1.3.24

## Checklist v1.3.25 (fix SyntaxError tutorial.js + parse ESM dans l'audit)

- [ ] **fix** : `tutorial.js` ligne 44 — template literal ouverte en backtick mais fermée en `"` (SyntaxError « missing } », page morte) → fermée proprement en backtick
- [ ] `tools/audit.mjs` fait maintenant un **parse ESM fiable** (`node --input-type=module --check` via stdin) de tous les modules + sw.js + tests — `node --check file.js` seul ne suffit pas (il a raté ce bug) ; lancé en CI
- [ ] Le jeu démarre, tous les clics répondent, le tutoriel se lance et le texte de l'étape Permis A s'affiche (avec haut/bas ou gauche/droite selon l'option)
- [ ] CI verte (core + smoke + audit incl. parse ESM) + CACHE sw bumpé (roadtap-v33) + VERSION 1.3.25

## Note bloqueurs de pub (Google Sign-In)

- uBlock Origin / Privacy Badger bloquent `accounts.google.com` (popup GIS) et `identitytoolkit.googleapis.com` (échange du jeton) → erreurs « popup bloquée » / CORS. **Mettre `roadtap.uk` en liste blanche** dans les deux extensions + autoriser les popups pour le site. Le bouton affiche alors « Continuer en tant que … » quand le navigateur est déjà connecté à un compte Google.

## Checklist v1.3.27 (branche `vibe/beton-arme-264a24` — « béton armé »)

- [ ] **Classement bavard** : la ligne sous les filtres affiche « N score(s) chargé(s) » (Firebase) ou l'erreur exacte (⚠ HTTP 401/403, réseau…) + fallback local ; liste vide en ligne → indice sur les règles RTDB (voir `docs/FIREBASE.md` §2bis : `scores.json` doit répondre 200)
- [ ] **Save blindée** : `sanitize()` au chargement (JSON cassé / mauvais types tolérés), `mergeRemote` en try/catch, `setPseudo`/`addCoins`/`spend` anti-NaN — couvert par `tests/break.test.mjs` (42 assertions) lancé en CI
- [ ] **Régression crash piéton** : tap quand la voiture est à l'arrêt pile sur une ligne → plus de crash (`judge(NaN)` → null, tap → clic dans le vide) — test de régression dans break.test.mjs
- [ ] **buildPattern** : jamais de boucle infinie (lines plafonné à 10000, poids vides → dash, gaps inversés corrigés)
- [ ] **Tutoriel** : se termine jusqu'au bout même après le passage piéton (respawn + watchdog 45 s) — `tests/tutorial.test.mjs` headless complet en CI
- [ ] CI verte (core + smoke + tutorial + **break** + audit avec parse ESM) + CACHE sw bumpé (roadtap-v35) + VERSION 1.3.27
- [ ] Reset dur côté testeur (Unregister SW + Clear site data) puis Ctrl+Shift+R : vérifier que la v1.3.27 charge et que tous les écrans répondent
- [ ] Rétro + roadmap à jour : `docs/RETROSPECTIVE.md`, `docs/ROADMAP.md`

## Checklist v1.3.28 (fix CI YAML + zones gauche/droite + effets jamais auto-activés + diagnostic écriture LB)

- [ ] **CI verte** : le `name:` du step break.test dans `.github/workflows/ci.yml` est quoté (un `": "` non quoté casse tout le workflow = 0 jobs) ; `tools/audit.mjs` v1.3.28 bloque désormais ce cas (section 9)
- [ ] **Zones gauche/droite** : option activée → tap gauche = AV, droite = AR (tactile ET clavier ←/→) ; au clavier, ← ne fait PLUS swipe en même temps (swipe = ↓ ou S en mode horizontal) ; libellé de l'option précise « utile en Permis A / Pilote »
- [ ] **Effets** : acheter un effet ou un pack ne l'active PLUS automatiquement (bouton « Activer » après achat) ; la secousse n'est plus « activée par défaut »
- [ ] **Classement** : si les envois sont refusés, la ligne de statut affiche aussi « ⚠ écriture HTTP 403 … » même après une lecture OK ; si la base est vide, vérifier que les testeurs ont pseudo + opt-in (cause n°0, docs/FIREBASE.md §2bis)
- [ ] `node tests/break.test.mjs` : 64 assertions (mapping zones, keyToAction, effets non auto-activés, writeError persistante)
- [ ] CI verte (core + smoke + tutorial + break + audit) + CACHE sw bumpé (roadtap-v36) + VERSION 1.3.28

## Checklist v1.3.29 (pseudo obligatoire + classement par défaut + fix règles RTDB push)

- [ ] **Pseudo obligatoire** : première partie (tuto ou niveau) sans pseudo → modale forcée (bouton Annuler caché, champ vide refusé) ; après validation la partie démarre ; « ✏️ Mon pseudo » permet de le changer ensuite
- [ ] **Plus d'opt-in** : case « apparaître dans le classement » retirée ; tout score terminé est envoyé automatiquement si un pseudo existe (global + défi du jour)
- [ ] **Règles RTDB corrigées dans la console** (docs/FIREBASE.md §2, validation au niveau `$mode/$id` et `$day/$id`) → **Publier** ; puis `POST https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores/auto/test.json` avec `{"pseudo":"Test","score":1,"level":"L","mode":"auto","date":1}` → **200** attendu (avant : 403, nœud `scores` jamais créé)
- [ ] Classement : après 2 testeurs avec pseudo, `scores.json` → 200 avec données, et le jeu affiche « N score(s) chargé(s) » + les autres joueurs
- [ ] `node tests/break.test.mjs` : contrat du POST (5 champs + bornes) + nœud null → fallback local
- [ ] CI verte + CACHE sw bumpé (roadtap-v37) + VERSION 1.3.29 ; PRIVACY.md à jour (pseudo public obligatoire)

## Checklist v1.3.30 (reset SW automatique si version obsolète)

- [ ] `version.json` (racine) = `VERSION` de `js/config.js` (vérifié par l'audit CI, section 11) ; `sw.js` n'intercepte JAMAIS `version.json` (sonde toujours fraîche)
- [ ] Test du reset auto : charger une vieille version en cache (ou simuler), ouvrir roadtap.uk → bannière « 🔄 Mise à jour dispo » → **reset auto une fois par session** (sessionStorage `roadtap_sw_reset_once`) : unregister SW + `caches.delete` + reload → la page rechargée affiche la bonne version, **sauvegarde conservée** (localStorage non vidé)
- [ ] Bouton « 🔄 Réinitialiser et recharger » de la bannière fait le reset manuel à tout moment
- [ ] Hors ligne : la sonde échoue silencieusement, aucun crash
- [ ] `node tests/break.test.mjs` : 76 assertions (parseVersion/isNewerVersion, pas de boucle quand versions égales)
- [ ] CI verte + CACHE sw bumpé (roadtap-v38) + VERSION 1.3.30 + version.json 1.3.30

## Checklist v1.3.31 (classement ⏱ Speedrun dédié)

- [ ] Filtre du classement : chip « ⏱ Speedrun » après les difficultés → affiche les temps (tri croissant, format `m:ss.cc`), filtre par niveau actif
- [ ] Finir un niveau en mode ⏱ Speedrun avec un pseudo → temps envoyé au nœud `/speedrun/<levelId>` (POST) ; statut « ⏱ Classement speedrun en ligne — N temps chargé(s) » ou ⚠ écriture HTTP xxx
- [ ] Règles RTDB : nœud `speedrun` copié depuis `docs/FIREBASE.md` §2 (validation `$level/$id`, `timeMs` entre 1000 et 3600000) → **Publier** ; test : POST `…/speedrun/1.json` avec `{"pseudo":"Test","timeMs":45000,"level":"L","date":1}` → 200 attendu
- [ ] Le classement global /scores ne contient toujours pas les temps speedrun
- [ ] Hors ligne / 403 → fallback local (clé `roadtap_speedrun_local_v1`), aucun crash
- [ ] `node tests/break.test.mjs` : contrat POST speedrun + tri croissant + filtre niveau + nœud null
- [ ] CI verte + CACHE sw bumpé (roadtap-v39) + VERSION 1.3.31 + version.json 1.3.31

## Checklist v1.3.32 (règles RTDB verrouillées — anti-usurpation, anti-écrasement)

- [ ] **Publier `database.rules.json`** dans la console RTDB (onglet Règles → coller → Publier) ; l'audit CI (section 12) vérifie que le fichier reste verrouillé (!data.exists, uid==auth.uid, players auth-only, .indexOn)
- [ ] Test écriture anonyme OK (création) : `POST …/scores/auto.json {"pseudo":"Test","score":1,"level":"L","mode":"auto","date":1}` → 200 ; **écrasement refusé** : `PUT …/scores/auto/<pushIdExistant>.json` → 403 ; `DELETE` → 403
- [ ] Test connecté Google : le jeu envoie `?auth=<idToken>` + `uid` → 200 ; sans uid → 403 (règle)
- [ ] `players` : anonyme → 401/403 ; avec jeton du bon uid → 200. **Sans Google = plus de cloud** (local uniquement), l'UI l'indique
- [ ] `analytics` : POST OK, DELETE/PUT d'un événement existant → 403
- [ ] `node tests/break.test.mjs` : 88 assertions (contrat ?auth= + uid)
- [ ] CI verte + CACHE sw bumpé (roadtap-v40) + VERSION 1.3.32 + version.json 1.3.32

## Checklist v1.3.33 (Google Sign-In robuste : repli popup + synchro cloud immédiate)

- [ ] Modale pseudo : bouton GIS officiel + bouton « 🔑 Connexion Google (popup) » (caché une fois connecté)
- [ ] Connexion via GIS **ou** popup → compte lié, jeton en mémoire, **sauvegarde cloud téléchargée et fusionnée immédiatement** (plus de « page inchangée ») → toast « ☁️ Progression synchronisée »
- [ ] uBlock/Privacy Badger activés → le bouton GIS échoue proprement, le popup fonctionne (gstatic non bloqué ou whitelister)
- [ ] Au redémarrage avec `googleRefresh` en localStorage : session restaurée silencieusement (securetoken), cloud rechargé
- [ ] `database.rules.json` publié (v1.3.32) : `players/<uid>` 200 avec jeton, 401 anonyme ; scores avec `?auth=` + uid → 200, sans uid → 403
- [ ] `node tests/auth.test.mjs` (nouveau step CI) + `node tests/break.test.mjs` (89) : tout vert
- [ ] CI verte + CACHE sw bumpé (roadtap-v41) + VERSION 1.3.33 + version.json 1.3.33

## Checklist v1.3.34 (App Check reCAPTCHA v3 côté client — prêt pour l'enforce)

- [ ] `FIREBASE_APP_CHECK_SITE_KEY` (v3, publique) dans `js/config.js` ; `js/appcheck.js` dans ASSETS du SW (audit 3b vérifie que tous les js/ y sont)
- [ ] Au démarrage : init App Check + `installAppCheckFetch()` → header `X-Firebase-AppCheck` sur tous les appels `*.firebasedatabase.app` UNIQUEMENT (vérifié par `tests/appcheck.test.mjs`)
- [ ] Hors ligne / gstatic bloqué → aucun header, aucun crash (dégradé gracieux)
- [ ] Console : app web enregistrée dans App Check (provider reCAPTCHA v3 + secret key), métriques RTDB « verified » OK après déploiement
- [ ] **Enforce RTDB ensuite seulement** (App Check → APIs → Realtime Database → Enforce, ~15 min) ; après, les requêtes sans token sont rejetées
- [ ] `node tests/appcheck.test.mjs` (nouveau step CI) + break 89 + auth 13 : tout vert ; audit OK
- [ ] CI verte + CACHE sw bumpé (roadtap-v42) + VERSION 1.3.34 + version.json 1.3.34

## Checklist v1.3.35 (gameplay : étoiles par niveau + paliers Survie ∞)

- [ ] Carte niveau : ⭐ à côté du nom (1 terminé / 2 ≥60 % PARFAIT / 3 full parfait 🥇), on garde le max entre les parties ; synchro cloud (stars dans snapshot/merge)
- [ ] Écran de fin : cellule « ⭐ Étoiles du niveau » (niveaux) ou « Lignes (record) » en Survie ∞
- [ ] Survie ∞ : paliers 10/25/50/100/150/200/300/500 lignes → +5×palier 🪙 + toast ; à 50 lignes → skin « 🏆 Survie d'or » + médaille ∞ débloquées (boutique : label « 🏆 Survie ∞ 50 lignes », non achetable)
- [ ] `buySkin` refuse les skins coût 0 (hors 'default') — pas d'achat gratuit déguisé
- [ ] `node tests/break.test.mjs` : +12 assertions (starsFor, endlessMilestones, setStars/setEndlessBest max, buySkin garde, sanitize/snapshot/merge)
- [ ] CI verte + CACHE sw bumpé (roadtap-v43) + VERSION 1.3.35 + version.json 1.3.35

## Checklist v1.3.36 (garage + événement week-end + classement amis + aperçus animés)

- [ ] **Garage** : bouton 🚗 Garage dans le menu → écran `screen-garage` avec toutes les voitures possédées (`save.skins`), aperçus canvas animés 72×84, tap sur une carte = équiper (`store.selectSkin`), carte équipée bordée cyan
- [ ] **Week-end** : samedi/dimanche uniquement — bannière 🎉 sur le menu, carte « 🎉 100. Week-end doré » dans ▶ Jouer (gratuit, jouable direct), pièces de la partie ×2 sur l'écran de fin (`weekendCoinMultiplier`, testé avec dates fixes dans break.test.mjs section N) ; en semaine : rien ne s'affiche
- [ ] **Classement amis** : onglets 🌍 Tous / 👥 Amis dans le classement ; ajout d'un ami par pseudo (input + Entrée, dédup insensible à la casse, pas soi-même), puces ✕ pour retirer, liste synchro cloud (`friends` dans snapshot/mergeRemote) ; la vue amis récupère TOUT le classement (`getAll`/`getSpeedrunAll`, sans limite TOP) puis filtre par pseudo (`core.filterFriendsByPseudo`) — fonctionne aussi en speedrun et avec les filtres difficulté/niveau
- [ ] **Aperçus animés** : boutique + garage — les 5 previews recoivent `t` (voiture qui flotte + reflet qui balaie, pluie/neige/confettis/flammes/tracé qui bougent, ligne centrale qui défile, cadeau qui pulse, ondes sonores qui oscillent) ; animation active UNIQUEMENT sur ces 2 écrans et si l'onglet est visible (`document.hidden`), rendu statique t=0 ailleurs (cartes de niveaux inchangées)
- [ ] `node tests/break.test.mjs` : section N (132 assertions au total) — isWeekend dates fixes + invalides, WEEKEND_LEVEL hors LEVELS, filterFriendsByPseudo, store friends (sanitize/add/remove/snapshot/merge), getAll/getSpeedrunAll (25 entrées sans limite, tri, repli hors ligne)
- [ ] CI verte + CACHE sw bumpé (roadtap-v44) + VERSION 1.3.36 + version.json 1.3.36

## Checklist v1.3.37 (compte Google obligatoire + synchro cloud réparée)

- [ ] **Règles RTDB re-publiées** dans la console Firebase (Règles → Publier) : `scores`/`speedrun`/`challenges` exigent `auth != null && newData.child('uid').val() == auth.uid` — **plus d'écriture anonyme** (miroir à jour dans `docs/FIREBASE.md` §2)
- [ ] **Cause racine synchro** : `cloudsave.js` ne lowercase plus la clé (`/players/<uid>` tel quel, sinon `auth.uid == $id` → 403 systématique) + `save()` en `keepalive: true`
- [ ] **pushCloud en pull-merge-push** (main.js) : lecture cloud → `mergeRemote` → PUT du snapshot fusionné ; push aussi sur `pagehide` et `visibilitychange` hidden → deux appareils ne s'écrasent plus
- [ ] Modale pseudo **forcée** : bouton Enregistrer désactivé tant que pas (Google + pseudo) ; pseudo pré-rempli depuis displayName/email ; repli popup toujours proposé
- [ ] Avant de jouer (`btn-play`, tuto, carte niveau) : `ensureAccountThen` exige `pseudo` + `uid`
- [ ] Envois classement (`scores`, `speedrun`, `challenges`) uniquement si `save.uid` ; sans jeton → repli local + `writeError` « Google requis » ; écran classement : avis « connecte Google pour apparaître » si anonyme
- [ ] `node tests/break.test.mjs` : section O (règles auth != null, URL cloudsave sans lowercase + keepalive, submit anonyme = 0 POST + repli local)
- [ ] Testeur : même compte Google sur tel + PC → joue sur les deux → progrès communs (vérifier `players/<uid>` dans la console : un seul nœud, `updatedAt` qui monte)
- [ ] CI verte + CACHE sw bumpé (roadtap-v45) + VERSION 1.3.37 + version.json 1.3.37

## Checklist v1.3.38 (un seul bouton « Connexion Google » — le GIS « Continuer en tant que » est retiré)

- [ ] Modale pseudo : **un seul** bouton « 🔑 Connexion Google » (sans « (popup) »), plus de bouton GIS one-tap, plus de conteneur `gsi-btn`
- [ ] `js/auth.js` : `renderGoogleButton`/`loadGsi`/`getLastAuthError` supprimés ; `signInWithPopupGoogle` (SDK gstatic, import dynamique) reste l'unique chemin
- [ ] Connexion → pseudo pré-rempli depuis le compte, bouton Enregistrer activé, cloud chargé + fusionné immédiatement
- [ ] `node tests/break.test.mjs` : section P (plus de « (popup) »/gsi-btn/continue_with dans HTML/JS, popup SDK toujours câblé)
- [ ] CI verte + CACHE sw bumpé (roadtap-v46) + VERSION 1.3.38 + version.json 1.3.38

## Checklist v1.3.39 (options d'accessibilité dans le menu pause)

- [ ] Menu pause (⏸) : section « ♿ Accessibilité » sous les boutons, avec les 3 mêmes options que la modale menu (fenêtres élargies, symboles daltonien, zones gauche/droite) — IDs `p-opt-*`, panneau scrollable si petit écran
- [ ] Les cases pause sont synchronisées à l'ouverture de la pause ; changer une option dans la pause met aussi à jour la modale menu (et inversement), effet immédiat + toast
- [ ] `node tests/break.test.mjs` : section Q (IDs `p-opt-*` uniques et dans `pause-overlay`, câblage préfixe `p-`, persistance des setters + snapshot cloud)
- [ ] CI verte + CACHE sw bumpé (roadtap-v47) + VERSION 1.3.39 + version.json 1.3.39

## Checklist v1.3.40 (jouer sans compte — Google facultatif, requis seulement pour cloud + classement)

- [ ] ▶ Jouer / Tutoriel / carte niveau ne demandent QUE le pseudo (`ensurePseudoThen`) : jouer sans compte Google fonctionne, progression 100 % locale
- [ ] Modale pseudo : bouton Enregistrer actif dès qu'un pseudo est saisi (Google plus requis) ; hint « facultatif : Connexion Google pour cloud + classement »
- [ ] Classement : envois (scores/speedrun/challenges) toujours réservés à `save.uid` ; sans compte, l'écran affiche « connecte Google pour apparaître » (règles `auth != null` inchangées, PAS de re-publication nécessaire)
- [ ] Connexion Google : save locale (anonyme) **fusionnée** avec `players/<uid>` (mergeRemote max/union) puis renvoyée (pull-merge-push) — aucun profil anonyme côté serveur (players = uid auth-only)
- [ ] Déconnexion (« 🔓 Se délier ») : `store.resetProgress()` → progression locale à 0 (prefs son/musique/accessibilité conservées), cloud conservé ; reconnexion → fusion, progression cloud retrouvée
- [ ] `node tests/break.test.mjs` : section R (jouer = pseudo seul, LB = uid requis, resetProgress à 0 + prefs gardées + persisté, reconnexion = fusion cloud)
- [ ] CI verte + CACHE sw bumpé (roadtap-v48) + VERSION 1.3.40 + version.json 1.3.40

## Checklist v1.3.41 (dépassement retravaillé + speedrun dans toutes les difficultés)

- [ ] Dépassement : z-order `drawTraffic('ahead')` avant / `('behind')` après la voiture du joueur (plus de traversée visuelle) ; la voiture doublée **continue de rouler** (plus gelée) et retombe derrière ; retour de voie plus franc (laneRate 6)
- [ ] Speedrun : dispo en Auto école / Permis A / Pilote (`btn-mode-speedrun` ne force plus Pilote, on peut changer de difficulté avec speedrun actif, `mode` transmis au classement speedrun = vraie difficulté jouée)
- [ ] `node tests/game.smoke.test.mjs` (speedrun garde le mode choisi) + `break.test.mjs` section S (177 assertions : z-order, swipe, voiture doublée qui roule, modes, POST speedrun mode=auto)
- [ ] CI verte + CACHE sw bumpé (roadtap-v49) + VERSION 1.3.41 + version.json 1.3.41

## Checklist v1.3.42 (musique adaptative réactive — WebAudio procédurale, zéro asset)

- [ ] `js/audio.js` : sequencer 16 pas/mesure (lookahead 25 ms/0.15 s), progression Am-F-C-G ; **tempo 96→160 BPM** et couches (kick/hats/caisse/basse/pad/arpège) selon `comboIntensity(combo)` ; filtre du bus musique qui s'ouvre avec l'intensité
- [ ] **bit à chaque pression** : `sfx.tap` = `tapBeat()` dont la hauteur monte avec le combo (300→1200 Hz) + mini-kick
- [ ] **combo → musique** : `setMusicCombo(e.combo)` dans onJudge (partie + tuto) ; **raté** = `musicSting()` (3 notes descendantes dissonantes + boom) + combo 0 ; **fin** : victoire = `musicVictory()` (arpège Am montant), défaite = sting
- [ ] Robuste headless : `ac()` null-safe, `startMusic()` ne crée pas de timer sans AudioContext ; musique stoppée si onglet caché ou son OFF
- [ ] `node tests/break.test.mjs` : section T (comboIntensity/musicTempo/tapFreq/musicLayers purs, setMusicCombo clamp, sting reset, pas de crash headless)
- [ ] Écoute : chaque tap = bit ; combo de PARFAIT = musique qui accélère/devient plus intense ; raté = sting puis calme ; niveau terminé = arpège de victoire
- [ ] CI verte + CACHE sw bumpé (roadtap-v50) + VERSION 1.3.42 + version.json 1.3.42

## Checklist v1.3.43 (passage piéton à haute vitesse : arrêt AVANT le passage, pas de cœur perdu)

- [ ] `game.js` : clamp autoStop — tant que la voiture cède le passage, `lineY(crosswalk) <= frontAxleY - 6` (la voiture s'arrête AVANT le passage, même en speedrun à haute vitesse)
- [ ] `update()` : une ligne `crosswalk` ne fait **pas** perdre de cœur pendant l'arrêt piéton (`autoStop && effSpeed <= 1`)
- [ ] `tap()` à l'arrêt (effSpeed = 0) avec autoStop : la ligne piéton pending dans ±320 px est validée « good » (popup « PASSAGE CÉDÉ », onJudge type=crosswalk) au lieu d'un clic-vide ; sans piéton, le stray reste (régression testée)
- [ ] `node tests/break.test.mjs` : section U (clamp, tap validé à l'arrêt, stray sans piéton, miss normal sans autoStop)
- [ ] Test manuel : niveau ville en speedrun (vitesse max) -> la voiture s'arrête avant le passage, roues AV PAS dessus ; tap AV à l'arrêt = validé, 0 cœur perdu
- [ ] CI verte + CACHE sw bumpé (roadtap-v51) + VERSION 1.3.43 + version.json 1.3.43

## Checklist v1.3.44 (score/record isolé par difficulté)

- [ ] `js/store.js` : records `best`/`bestTime` keyés `"mode:levelId"` (`bestKey`, `getBest/setBest(mode,…)`, `getBestTime/setBestTime(mode,…)`), `bestFlat()` pour les succès ; migration des anciennes clés `levelId` copiées dans les 3 modes au `sanitize`
- [ ] `main.js` : carte niveau + `onGameEnd` utilisent `save.difficulty` comme mode ; `checkAchievements` reçoit `bestFlat()`
- [ ] `mergeRemote`/`snapshot` inchangés (max/min génériques sur les clés composites)
- [ ] `node tests/break.test.mjs` : section V (migration, isolation, max/min, mergeRemote, bestFlat)
- [ ] Test manuel : record niveau 3 en Auto école ≠ record en Pilote (cartes selon la difficulté choisie) ; ancienne save migrée sans perte
- [ ] CI verte + CACHE sw bumpé (roadtap-v52) + VERSION 1.3.44 + version.json 1.3.44

## Checklist v1.3.45 (wideWindows hors classement + « Recommencer » dans la pause)

- [ ] `core.canSubmitToLeaderboard(save)` = pseudo + uid + !wideWindows, utilisé aux **3** envois (score / speedrun / défi du jour) dans `onGameEnd`
- [ ] Classement : entrées `wideWindows: true` filtrées à l'affichage (`cleanEntry`/`cleanTimeEntry`) + avis « ♿ fenêtres élargies actives… » dans `#lb-source`
- [ ] Règles RTDB : `newData.child('wideWindows').val() != true` ajouté aux 3 `.write` (scores/speedrun/challenges) — **À RE-PUBLIER dans la console Firebase** (miroir docs/FIREBASE.md §2 à jour)
- [ ] Menu pause : nouveau bouton « 🔄 Recommencer » (`btn-pause-retry`) → `startLevel(currentLevel)`
- [ ] `node tests/break.test.mjs` : section W (garde pur, 3 sites, filtres local+speedrun, règles, bouton pause)
- [ ] CI verte + CACHE sw bumpé (roadtap-v53) + VERSION 1.3.45 + version.json 1.3.45

## Checklist v1.3.46 (beat musical façon Geometry Dash + week-end visible dans le classement)

- [ ] `audio.js` : `scheduleLineBeat(tSec, key)` joue un tic EXACTEMENT à `currentTime + t` (re-calé si la vitesse change, `clearLineBeats()` au lancement d'un niveau) ; `game.js` appelle `audio.lineBeat(t, dist:axle)` pour chaque ligne/essieu pending à t < 0.7 s
- [ ] Écoute : chaque ligne = un tic au moment exact où il faut taper → jouable à l'oreille (comme GD) ; la musique adaptative v1.3.42 reste en fond
- [ ] Classement : filtre de niveau inclut « 🎉 Week-end » (WEEKEND_LEVEL id 100) — les scores de l'événement week-end sont filtrables
- [ ] `node tests/break.test.mjs` : section X (beats AV/AR calés, essieu tapé = plus de beat, headless sans crash, filtre 100)
- [ ] CI verte + CACHE sw bumpé (roadtap-v54) + VERSION 1.3.46 + version.json 1.3.46

## Checklist v1.3.47 (menu Paramètres + touches personnalisables)

- [ ] Menu : nouveau bouton « ⚙️ Paramètres » → écran `screen-settings` (accessibilité s-*, son/musique, touches, version, état serveur avec `leaderboard.ping()` + « 🔄 Revérifier »)
- [ ] Accessibilité : 3e panneau synchronisé avec modale et pause (`wireAccessCheckboxes('s-')`)
- [ ] Touches : `save.keys {front,rear,swipe}` persisté + cloud ; UI de capture (clic → keydown, Échap annule, doublon refusé) ; `keyToAction(code, horizontal, save.keys)` — touches perso prioritaires, repli sur le mapping intégré
- [ ] `node tests/break.test.mjs` : section Y (helpers purs, bindKey doublon, setKey persist, sanitize/mergeRemote/snapshot keys, 15 IDs HTML, câblage)
- [ ] Test manuel : Paramètres → rebind « Roues AV » sur A → en partie, A = tap AV ; doublon refusé ; Échap annule ; version + pastille serveur affichées
- [ ] CI verte + CACHE sw bumpé (roadtap-v55) + VERSION 1.3.47 + version.json 1.3.47

## Checklist v1.3.48 (fin de partie : combo retiré, récompense réactivité, onglet ⚡ Réaction)

- [ ] Écran de fin : **« Meilleur combo » supprimé** (redondant avec Parfaits) ; « Réaction moy. » et « Précision » conservées
- [ ] `core.reactionBonus(coins, stats)` : +25% si avg ≤ 40 ms, +15% ≤ 70, +5% ≤ 110, +10% si précision 100% — appliqué aux pièces AVANT le wallet, affiché « ⚡ réactivité +X% (Y ms moy., Z%) »
- [ ] Classement : `avgMs` envoyé avec le score (champ optionnel, `hasChildren` l'autorise — **pas besoin de re-publier les règles**) ; lignes affichent `score · ⚡Xms` ; nouvel onglet **⚡ Réaction** (tri croissant avgMs, meilleur temps de réaction de tout le monde, filtre niveau + amis OK)
- [ ] `node tests/break.test.mjs` : section Z (tiers reactionBonus, NaN, combo supprimé, POST avgMs, onglet)
- [ ] Test manuel : full parfait + réaction rapide = plus de pièces (label ⚡) ; classement → ⚡ Réaction → top = meilleurs temps moyens
- [ ] CI verte + CACHE sw bumpé (roadtap-v56) + VERSION 1.3.48 + version.json 1.3.48

## Checklist v1.3.49 (touche « recommencer » + souris bindable + garage enrichi)

- [ ] Paramètres : 4e action « Recommencer le niveau » (défaut `R`) ; en jeu, la touche relance le niveau direct (même en pause)
- [ ] Boutons de souris bindables (`MouseLeft/Middle/Right`) : capture dans Paramètres (clic = bind) + en jeu, le clic bindé déclenche l'action sans double-tap de zone (capture pointerdown)
- [ ] Garage : sections « Effets achetés » (activer/désactiver) et « Thèmes achetés » (activer) avec aperçus animés
- [ ] `node tests/break.test.mjs` : section AA (retry/souris purs, setKey/sanitize, IDs HTML, câblage)
- [ ] CI verte + CACHE sw bumpé (roadtap-v57) + VERSION 1.3.49 + version.json 1.3.49

## Checklist v1.3.50 (UI : textes retirés, filtres « Tous » supprimés, bug filtre niveau)

- [ ] Partout (boutique + garage) : plus de « Photo réaliste » — la carte n'affiche que le modèle (label `photo` vidé, templates `filter(Boolean)`)
- [ ] Écran principal : tagline sous le logo ROAD TAP supprimée ; bouton « ♿ Accessibilité » retiré du menu (les options sont dans ⚙️ Paramètres)
- [ ] Paramètres : options d'accessibilité plus lisibles (16px, fond, bordure, case ×1.3, accent cyan)
- [ ] Classement : options « Tous » (difficulté) et « Tous niveaux » (niveau) supprimées — ouverture = difficulté courante, aucun filtre niveau ; **filtre par niveau 2 « Accélération » : on balaie désormais tous les modes + `levelId` string/number accepté** (bug testeur corrigé)
- [ ] `node tests/break.test.mjs` : section AB (textes/filtres/CSS + filterLevel fonctionnel)
- [ ] CI verte + CACHE sw bumpé (roadtap-v58) + VERSION 1.3.50 + version.json 1.3.50

## Checklist v1.3.51 (niveaux déterministes — speedrun-friendly)

- [ ] `core.levelSeed(levelId, mode)` = hash fixe ; `game.start()` utilise cette seed (plus `Date.now()`) et reset `this.rand` + `chunkN` → **le même niveau (id+mode) est identique à chaque partie**
- [ ] Tronçons suivants (`extendPattern`) seedés (`id#chunkN`) ; trafic + piétons passent sur `this.rand` (seedé) — décor/météo restent cosmétiques (`Math.random`)
- [ ] `node tests/break.test.mjs` : section AC (levelSeed stable/mode, buildPattern identique, 2 parties = mêmes lignes + mêmes tronçons, trafic déterministe)
- [ ] Test manuel : niveau 3 en Permis A deux fois → mêmes lignes au même endroit ; en speedrun, le parcours est reproductible (temps comparables) ; « 🔄 Recommencer »/touche R -> parcours identique aussi
- [ ] CI verte + CACHE sw bumpé (roadtap-v59) + VERSION 1.3.51 + version.json 1.3.51

## Checklist v1.3.52 (pause = Paramètres en entier + anti clic droit)

- [ ] Menu pause : bloc accessibilité supprimé, remplacé par « ⚙️ Paramètres » (`btn-pause-settings`) qui ouvre le **menu Paramètres complet** ; retour = on revient à la pause (partie toujours en pause)
- [ ] Plus de `p-opt-*` (HTML ni JS) ; panneaux restants : modale (`opt-*`) + Paramètres (`s-*`)
- [ ] `contextmenu` bloqué en écran de jeu → binder le **clic droit** ne ouvre plus le menu contextuel Windows (ni appui long mobile)
- [ ] `node tests/break.test.mjs` : section AD (pause/settings HTML, plus de p-, câblage retour pause, contextmenu)
- [ ] Test manuel : en jeu, clic droit bindé = action de jeu, plus de menu Windows ; ⏸ → ⚙️ Paramètres → retour → toujours en pause
- [ ] CI verte + CACHE sw bumpé (roadtap-v60) + VERSION 1.3.52 + version.json 1.3.52

## Checklist v1.3.53 (menu principal allégé + retry sur l'écran de fin)

- [ ] Menu principal : boutons « 🔊 Son » et « 🎵 Musique » supprimés (les réglages restent dans ⚙️ Paramètres → `btn-set-sound`/`btn-set-music`)
- [ ] Touche « recommencer » (`save.keys.retry`, défaut R) fonctionne en jeu (même en pause) **et sur l'écran de fin de partie** (`screen-over`) → relance le niveau direct
- [ ] `node tests/break.test.mjs` : section AE (menu sans son/musique, settings conservé, retry sur screen-over)
- [ ] CI verte + CACHE sw bumpé (roadtap-v61) + VERSION 1.3.53 + version.json 1.3.53

## Checklist v1.3.54 (speedrun = une seule difficulté : Permis A)

- [ ] Moteur : `speedrun -> mode = 'permisA'` (quel que soit le mode demandé) ; `startLevel` idem côté UI
- [ ] UI : bouton ⏱ cale `difficulty='permisA'` ; picker de difficulté verrouillé sur Permis A tant que speedrun actif (toast explicite) ; title du bouton à jour
- [ ] Records + envois speedrun utilisent le **mode réellement joué** (`runMode = game.mode`) — clé `permisA:levelId`
- [ ] `node tests/game.smoke.test.mjs` (speedrun force permisA) + `break.test.mjs` section AF (276+ assertions)
- [ ] Test manuel : ⏱ Speedrun depuis n'importe quelle difficulté → partie en Permis A ; classement ⏱ enregistre permisA ; changer de difficulté en speedrun → reste Permis A
- [ ] CI verte + CACHE sw bumpé (roadtap-v62) + VERSION 1.3.54 + version.json 1.3.54

## Checklist v1.3.55 (scroll des écrans longs — garage, boutique, niveaux…)

- [ ] CSS : `.screen.active { overflow-y: auto; justify-content: safe center; }` (centré si ça tient, scrollable sinon) + `.topbar { position: sticky; top: 0; background: #0d1226; }` → le bouton ← reste cliquable même avec beaucoup de contenu
- [ ] `node tests/break.test.mjs` : section AG (regex CSS)
- [ ] Test manuel : téléphone petit écran → Garage avec plein de voitures/effets/thèmes → on peut scroller et le bouton ← reste visible en haut ; idem boutique/niveaux/paramètres
- [ ] CI verte + CACHE sw bumpé (roadtap-v63) + VERSION 1.3.55 + version.json 1.3.55

## Checklist v1.3.56 (check de nuit : nettoyage + cohérence, branche `vibe/check-nuit-v1356-264a24`)

- [ ] Code mort supprimé : modale `access-modal` (index.html), handlers `btn-access` / `btn-access-close` / `btn-sound` / `btn-music` + wiring `wireAccessCheckboxes('')` / `syncAccessCheckboxes('')` (main.js), CSS `.tagline` / `.pause-access` → l'accessibilité vit UNIQUEMENT dans ⚙️ Paramètres (`s-opt-*`)
- [ ] `leaderboard.js` : fallback mode speedrun = `permisA` (cohérence v1.3.54), plus de `'pilote'` en fallback
- [ ] `node tests/break.test.mjs` : section AH (8 assertions : absences HTML/JS/CSS + POST speedrun avec `mode: "permisA"`)
- [ ] Test manuel : menu principal sans tagline ni boutons ♿/🔊/🎵 ; ⚙️ Paramètres ouvre bien l'accessibilité (s-opt-*) ; pause → ⚙️ Paramètres fonctionne et revient à la pause ; aucun `id` orphelin (audit §1)
- [ ] Check de nuit complet : 6 fichiers de tests + `node tools/audit.mjs` verts ; triple bump cohérent (VERSION 1.3.56 = version.json, CACHE roadtap-v64)
- [ ] CI verte + CACHE sw bumpé (roadtap-v64) + VERSION 1.3.56 + version.json 1.3.56

## Checklist v1.3.57 (touches sauvegardées avec le compte — branche `vibe/touches-compte-264a24`)

- [ ] `store.js` : backup locale par compte `roadtap_keys_v1_<uid|pseudo>` écrite à chaque `setKey`/`setKeys` et à chaque connexion (`backupKeysForAccount()` dans main.js, x3 sites) ; restaurée au chargement via `restoreKeysForAccount()` dans `load()` si la save principale a perdu les touches
- [ ] `resetProgress()` (déconnexion) conserve désormais `keys` + `horizontalZones` : seule la **progression** repart de 0, la **config** reste
- [ ] Cloud : `snapshot()`/`mergeRemote()` continuent de porter `keys` dans `players/<uid>.keys` (règle players = `auth.uid == $id && newData.exists()`, aucun champ imposé -> OK)
- [ ] `node tests/break.test.mjs` : section AI (7 assertions : backup écrite, restore au load, resetProgress garde la config, snapshot/mergeRemote cloud, wiring main.js)
- [ ] Test manuel : compte Google connecté → changer une touche dans ⚙️ Paramètres → vérifier `localStorage["roadtap_keys_v1_<uid>"]` → **CTRL+F5** → la touche est toujours là ; supprimer `roadtap_save_v1` seul → recharger → les touches reviennent depuis la backup ; se déconnecter → touches conservées, progression à 0 ; se reconnecter → touches du cloud fusionnées
- [ ] Joueur anonyme : touches dans `roadtap_save_v1` (survit au CTRL+F5, localStorage n'est jamais vidé par un rechargement)
- [ ] CI verte + CACHE sw bumpé (roadtap-v65) + VERSION 1.3.57 + version.json 1.3.57

## Checklist v1.3.58 (diagnostic « serveur injoignable » avec la cause — branche `vibe/diag-serveur-264a24`)

- [ ] `leaderboard.js` : `ping()` enregistre `lastPing { ok, status, reason: ok|http-XXX|network|unconfigured, ms, error? }` + `getPingStatus()` exporté (retour booléen inchangé)
- [ ] `appcheck.js` : `appCheckDebug()` exporté (`configured/initAttempted/initialized/tokenOk/lastError`) ; `appCheckHeader()` met à jour `tokenOk`/`lastError` (succès, token vide, exception « domain not authorized »…)
- [ ] `main.js` : `updateServerStatus()` async teste **l'hébergement** (`version.json` no-store, ligne `#set-host`) **puis Firebase** (`serverStatusText` : 🟢 ms + App Check / 🟠 HTTP 401 App Check Enforce sans token / 🟠 HTTP 403 règles / 🔴 réseau) ; pilule réseau affiche aussi HTTP xxx ou ms
- [ ] `index.html` : nouvelle ligne `id="set-host"` dans ⚙️ Paramètres
- [ ] `docs/FIREBASE.md` §9 : dépannage « Serveur injoignable » (domaines autorisés roadtap.uk, Enforce, règles `.read: true`, extensions bloqueuses, curl de contrôle)
- [ ] `node tests/break.test.mjs` : section AJ (10 assertions : ping ok/401/réseau, appCheckDebug, wiring HTML/JS)
- [ ] Test manuel : ⚙️ Paramètres → « 🔃 Revérifier le serveur » affiche hébergement + Firebase avec cause ; couper le réseau → 🔴 réseau/hors ligne ; bloquer firebasedatabase.app (uBlock) → 🔴 réseau
- [ ] CI verte + CACHE sw bumpé (roadtap-v66) + VERSION 1.3.58 + version.json 1.3.58

## Checklist v1.3.59 (sonde auth sur 401/403 — branche `vibe/diag-401-264a24`)

- [ ] `leaderboard.js` : `ping(idToken)` — sur 401/403, 2ᵉ requête avec `?auth=<idToken>` et `lastPing.authProbe { status, ok, reason }` enregistré ; sans jeton → pas de sonde ; retour booléen = 1ʳᵉ tentative (inchangé)
- [ ] `appcheck.js` : si `getToken(ac, false)` échoue, UN retry avec `getToken(ac, true)` (force refresh) avant d'abandonner
- [ ] `main.js` : `ping(getAuthToken())` dans `updateServerStatus()` ET `refreshStatus()` ; `serverStatusText` départage : 401 + sonde OK → **règles exigent auth** (republier rules) ; 401 + sonde KO → **App Check Enforce sans token** (domaines autorisés)
- [ ] `node tests/break.test.mjs` : section AK (8 assertions : ping+authProbe 3 scénarios, wiring main.js, textes 401 désambigués)
- [ ] Test manuel : connecté, si le serveur répond 401 → ⚙️ Paramètres affiche la cause exacte (règles vs App Check)
- [ ] CI verte + CACHE sw bumpé (roadtap-v67) + VERSION 1.3.59 + version.json 1.3.59

## Checklist v1.3.60 (bonne clé App Check Enterprise « roadtap ent » — branche `vibe/cle-appcheck-264a24`)

- [ ] `js/config.js` : `FIREBASE_APP_CHECK_SITE_KEY = '6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW'` (clé avec roadtap.uk/github.io/localhost autorisés) — plus aucune trace de l'ancienne `6LecyCwu…` hors commentaire explicatif
- [ ] `docs/FIREBASE.md` §8 : cause racine documentée (« configuration incomplète » = mauvaise clé côté site)
- [ ] `node tests/break.test.mjs` : section AL (4 assertions : clé = 6Lf7…, ancienne clé absente du code, isAppCheckEnabled, doc)
- [ ] Côté console (à faire) : Firebase → App Check → Apps : l'app web `realtime-database-5fd49.firebaseapp.com` doit utiliser le provider reCAPTCHA Enterprise avec **la même clé 6Lf7vCwu…** ; puis attendre « verified » avant de garder Enforce
- [ ] Test manuel après déploiement : ⚙️ Paramètres → serveur 🟢 avec « App Check 🟢 token OK » ; Fraud Defense → la clé « roadtap ent » affiche des exécutions/scores (>0)
- [ ] CI verte + CACHE sw bumpé (roadtap-v68) + VERSION 1.3.60 + version.json 1.3.60

## Checklist v1.3.61 (doc : le bandeau « demander des scores » ne concerne pas App Check — branche `vibe/doc-scores-appcheck-264a24`)

- [ ] `docs/FIREBASE.md` §8 : note v1.3.61 — « scores (évaluations) » = siteverify backend avec clé secrète, **pas utilisé** (Firebase App Check vérifie le jeton côté serveur) ; seule compte la présence d'**exécutions** de jetons
- [ ] Vérifs post-déploiement v1.3.60 : Fraud Defense « roadtap ent » exécutions > 0 ; App Check → APIs RTDB « verified » ; site ⚙️ Paramètres 🟢 « App Check 🟢 token OK » ; classement en ligne
- [ ] Aucun changement de code fonctionnel (docs uniquement) + triple bump v1.3.61/roadtap-v69
- [ ] CI verte + 6 tests + audit ✅

## Checklist v1.3.62 (401 même connecté → état du token App Check affiché + timeout du jeton — branche `vibe/diag-token-401-264a24`)

- [ ] `appcheck.js` : `appCheckHeader()` avec **timeout borné** (4 s, `_setTokenTimeoutMs` pour tests, timer `unref`) — un getToken qui pend ne bloque plus les requêtes RTDB
- [ ] `main.js` `serverStatusText()` : TOUTES les branches d'erreur (401/403/http/network) suffixées par `· App Check 🟢 token OK / 🔴 token KO (lastError) / 🟡 non testé` ; branche 401 cite la clé `6Lf7vCwu…` + « Firebase → App Check → Apps »
- [ ] `docs/FIREBASE.md` §9 : mise à jour v1.3.62 (4 causes ordonnées du « 401 même connecté » + filet de sécurité Unprotected)
- [ ] `node tests/break.test.mjs` : section AM (4 assertions : acTxt dans les branches, message 401, timeout borné avec provider qui pend < 1 s)
- [ ] Test manuel : ⚙️ Paramètres → serveur en 401 affiche « App Check 🔴 token KO (…) » ou « 🟢 token OK » → on sait si le jeton est obtenu
- [ ] CI verte + 6 tests + audit ✅ + CACHE roadtap-v70 + VERSION 1.3.62 + version.json 1.3.62

## Checklist v1.3.63 (FIREBASE_APP_ID requis pour l'échange de jeton App Check — branche `vibe/appid-appcheck-264a24`)

- [ ] ⚠️ **Action manuelle requise** : copier l'**ID d'application** de l'app web (Firebase → ⚙️ Paramètres du projet → Vos applications → app web → « ID d'application », format `1:804737015370:web:…`) dans `FIREBASE_APP_ID` dans `js/config.js`, commit, push
- [ ] `js/config.js` : `FIREBASE_APP_ID` exporté (placeholder + commentaire avec l'emplacement exact)
- [ ] `js/appcheck.js` : `initializeApp({ ..., appId: FIREBASE_APP_ID })` ; sans appId → init null + `lastError` explicite ; `appCheckDebug()` expose `appIdMissing` + appId masqué
- [ ] `js/auth.js` : `initializeApp` reçoit aussi `appId`
- [ ] `main.js` : `serverStatusText` affiche « 🔴 FIREBASE_APP_ID manquant — … » si appId vide
- [ ] `node tests/break.test.mjs` : section AN (6 assertions : wiring appId ×2, init propre sans appId, appIdMissing cohérent, hint UI)
- [ ] Post-déploiement : App Check → APIs → RTDB « verified » > 0 % ; site ⚙️ Paramètres 🟢 « App Check 🟢 token OK » ; plus de 401
- [ ] CI verte + 6 tests + audit ✅ + CACHE roadtap-v71 + VERSION 1.3.63 + version.json 1.3.63

## Checklist v1.3.65 (liste du joueur : tuto, musique, freeze, ville, filtres LB — branche `vibe/todo-liste-264a24`)

- [ ] **Tutoriel** : 9 étapes (le « 2ème dépassement » supprimé) ; étape raté = texte court + **perte de ❤ réelle** (`stats.misses++` + HUD, mais pas de game over en tuto) ; étape Permis A = **3 lignes réussies** (`okLines >= 3`) ; étape Pilote sans « 1er essai », « revient à droite toute seule » ; `tests/tutorial.test.mjs` MAJ (index piéton 7→6) + 4 nouvelles assertions
- [ ] **Ville** : max **1 passage piéton** par niveau (`crosswalks < 1` dans `buildPattern`, test sur 40 seeds)
- [ ] **Filtres classement mémorisés** : `roadtap_lb_filters_v1` (filter/level/scope), restaurés à l'ouverture ; défaut = difficulté courante si jamais mémorisé
- [ ] **Musique au lancement** : `startLevel` → `unlockAudio()` + `setMusicEnabled(...)` + `musicKick()` (reprend le contexte au clic « Jouer » = geste, resync du séquenceur)
- [ ] **Anti-freeze au tap** : plus de `shadowBlur` 18/22 dans le rendu des lignes (pulse/glow → passes alpha) ni dans la voiture néon ; `AudioContext` créé au clic « Jouer » plutôt qu'au 1er tap
- [ ] `node tests/break.test.mjs` : section AO (8 assertions)
- [ ] Test manuel : tuto fluide (étape 4 perd bien un ❤, étape 5 avance après 3 lignes) ; musique dès le 1er écran de jeu ; aucun freeze au tap sur téléphone ; filtres LB retrouvés après être sorti de la page ; niveau 4/5 = 1 seul passage piéton
- [ ] CI verte + CACHE sw bumpé (roadtap-v73) + VERSION 1.3.65 + version.json 1.3.65

## Checklist v1.3.66 (liste du joueur, partie 2 : boutique/affichage/succès/offline — branche `vibe/todo-liste2-264a24`)

- [ ] **Prix boutique ×3** (arrondi au 50, `cost: 0` préservé) sur SKINS/EFFECTS/PACKS/THEME_SHOP/SOUND_PACKS — coûts de déblocage des NIVEAUX inchangés
- [ ] **Affichage réparé** (vu sur les photos) : plus de fuite du commentaire `// v1.3.50…` dans les templates de cartes boutique/garage ; canvas `#game` caché hors écran de jeu (`#game.hidden` + toggle dans `show()`) → plus de frame/popup fantôme sous les menus ; ouverture boutique/garage = `show()` AVANT `render*` ; `.shop-card .swatch` n'impose plus 52×52 (conflit de taille avec les canvas 56×64/72×84)
- [ ] **+13 succès** (27 au total) : dépassements 1/25/100, 1000 PARFAIT, combo x100, 1ère 🥇, speedrun, réaction ≤40 ms, streak 7j, 10 000 🪙, 1 ami, week-end, record dans les 3 modes — `checkAchievements` enrichi (bestTime/wallets/friends/streak), aucun `test()` ne plante sur ctx minimal
- [ ] **File hors-ligne** : `roadtap_lb_queue_v1` (plafond 200, anti-doublon) alimentée par submitScore/submitSpeedrun/submitChallengeScore hors ligne ou sans jeton ; `flushQueue(idToken, uid)` rejoué au `online`, à la connexion Google, à l'ouverture du classement et après un ping OK ; refus HTTP (règles) PAS remis en file ; `uid` rattaché au compte à l'envoi
- [ ] `node tests/break.test.mjs` : section AP (16 assertions, dont test fonctionnel de la file)
- [ ] Test manuel : cartes boutique/garage sans texte parasite, plus rien du jeu sous le garage ; prix affichés x3 ; succès débloquables ; jouer hors ligne sans compte → revenir en ligne + connecté → toast « N résultat(s) envoyé(s) »
- [ ] CI verte + CACHE sw bumpé (roadtap-v74) + VERSION 1.3.66 + version.json 1.3.66

## Checklist v1.3.67 (classement : 1 entrée/joueur + filtre niveau visible + libellés — branche `vibe/classement-264a24`)

- [ ] **1 entrée par joueur** : `dedupeByPlayer(arr, kind)` dans leaderboard.js (clé = `uid` sinon pseudo minuscule ; garde max score / min timeMs / min avgMs) — intégré à `sortDesc` et `sortAscTimeUnbounded`, + branches réaction/amis dans main.js
- [ ] **Filtre niveau toujours sélectionné à l'ouverture** : option `🌐 Tous niveaux` (`id: 'all'`) en tête de la liste (les filtres mémorisés v1.3.65 restent restaurés)
- [ ] **Libellés de niveau fiables** : `levelLabel(e)` = nom via `levelId`, sinon champ `level` brut (plus de « L 1 »)
- [ ] **Statut** : « N chargé(s) — M affiché(s) ici » quand un filtre est actif ; liste vide + filtre niveau → « Aucun score pour « niveau » — joue ce niveau pour passer 1er ! » (plus l'indice règles trompeur)
- [ ] `node tests/break.test.mjs` : section AQ (11 assertions, dont getTop en ligne dédoublonné + wideWindows filtré)
- [ ] Test manuel : ouvrir le classement → « 🌐 Tous niveaux » surligné ; choisir un niveau → scores filtrés, 1 ligne par joueur (meilleur score) ; un joueur avec 2 scores n'apparaît qu'une fois
- [ ] CI verte + CACHE sw bumpé (roadtap-v75) + VERSION 1.3.67 + version.json 1.3.67

## Checklist v1.3.68 (speedrun en Auto école + colonnes score/temps au classement — branche `vibe/speedrun-auto-264a24`)

- [ ] **Speedrun dispo dans TOUTES les difficultés** (Auto école comprise) : plus de `this.speedrun ? 'permisA'`, plus de `store.setDifficulty('permisA')` forcé, picker non verrouillé, title du bouton MAJ ; `runMode` inchangé (records/envois utilisent le mode joué) ; fallback `submitSpeedrun` = `'auto'`
- [ ] **Onglet « ⏱ Speedrun » retiré** du filtre difficulté du classement ; un filtre persisté `speedrun` retombe sur la difficulté courante à l'ouverture
- [ ] **Colonnes score + ⏱ temps** dans chaque difficulté : `buildTimeMap(getSpeedrunAll(), lbFilter, lbLevelFilter)` (meilleur temps par joueur, filtré par difficulté + niveau) + cellule `lb-time` (`⏱ 0:14.65` ou `—`), CSS `.lb-time` ; `getTop(lbFilter, lbLevelFilter)` — la difficulté filtre même avec un niveau choisi
- [ ] **Diagnostic d'envoi** : en fin de partie, toast explicite si le résultat n'est pas envoyé en ligne (wideWindows actives / pas de compte Google → gardé en local + file hors ligne)
- [ ] `node tests/break.test.mjs` : section AR (11 assertions) + MAJ sections J/AH/AF/682 + `game.smoke` (mode conservé en speedrun)
- [ ] Test manuel : speedrun ON en Auto école → niveau 2 → temps apparaît dans la colonne ⏱ de l'onglet Auto école (niveau 2) ; plus d'onglet Speedrun ; si pas connecté → toast « 🔒 Connecte Google… » en fin de partie
- [ ] CI verte + CACHE sw bumpé (roadtap-v76) + VERSION 1.3.68 + version.json 1.3.68

## Checklist v1.3.69 (faux 401 au 1er ping — jeton App Check froid au chargement — branche `vibe/ping-401-boot-264a24`)

- [ ] `appcheck.js` : `warmAppCheck()` exporté (préchauffe le jeton via `appCheckHeader()`, jamais de throw)
- [ ] `main.js` : `warmAppCheck()` appelé au boot (fire-and-forget, après `installAppCheckFetch()`)
- [ ] `main.js` : `pingServer()` — sur `http-401` au 1er ping, attend `warmAppCheck()` puis **re-tente UNE fois** ; utilisé par `refreshStatus()` (pastille menu) ET `updateServerStatus()` (⚙️ Paramètres)
- [ ] `node tests/break.test.mjs` : section AS (4 assertions : export, boot, retry 401, pingServer aux 2 endroits + warmAppCheck headless sans throw)
- [ ] Test manuel : recharger roadtap.uk à froid (cache vidé) → la pastille passe directement 🟢 (plus de « HTTP 401 (mode local) » transitoire) ; ⚙️ Paramètres idem
- [ ] CI verte + CACHE sw bumpé (roadtap-v77) + VERSION 1.3.69 + version.json 1.3.69

## Checklist v1.3.70 (classement : 2 colonnes triables Score ⇄ Temps + rang du joueur en fin de partie — branche `vibe/classement-2col-264a24`)

- [ ] **Bouton de tri** `#lb-sort` au-dessus de la liste (« Trier : 🏁 Score » ⇄ « ⏱ Temps »), persistant dans `roadtap_lb_filters_v1` (`sort: 'score'|'time'`) : on retrouve le même tri en revenant sur la page
- [ ] **Deux colonnes visibles en même temps** : chaque ligne affiche `.lb-score` (score) ET `.lb-time` (⏱ meilleur temps speedrun du joueur ou —) — on voit le joueur au meilleur score ET celui au meilleur temps
- [ ] `sortLbRows(arr, sort, timeByPlayer)` dans leaderboard.js : tri score = décroissant ; tri temps = joueurs AVEC temps d'abord (croissant), puis les autres par score décroissant
- [ ] `renderLeaderboard` : branches via `getAll(lbFilter)` + `filterLevel(all, lbLevelFilter)` + `dedupeByPlayer`, puis `sortLbRows(top, lbSort, timeByPlayer).slice(0, 50)` hors réaction
- [ ] **Rang en fin de partie** : bloc `#over-rank` sur l'écran de fin — score → « 🏁 N pts → #i au classement — niveau (mode) » ; speedrun → « ⏱ t → #i au classement speedrun » ; ignoré si non éligible (pas de compte Google / fenêtres élargies)
- [ ] **Toast si envoi refusé** : après `submitScore`, si `writeError` → toast « ⚠️ Envoi refusé : … » (diagnostique « rien n'apparaît » niveau 2 auto école)
- [ ] `node tests/break.test.mjs` : section AT (7 assertions : sortLbRows fonctionnel score/temps, HTML #lb-sort/#over-rank, persistance lbSort, câblage renderLeaderboard, bloc over-rank, toast writeError) + MAJ AR (getAll+filterLevel) et lignes 984-986 — **390 assertions**
- [ ] Test manuel : classement → cliquer « Trier » → l'ordre change (meilleur temps en 1er en tri Temps) et persiste après fermeture/réouverture ; finir le niveau 2 en Auto école connecté → ligne de rang affichée sur l'écran de fin ; si pas connecté ou wideWindows → toast + pas de rang
- [ ] CI verte + CACHE sw bumpé (roadtap-v78) + VERSION 1.3.70 + version.json 1.3.70

## Checklist v1.3.71 (rang écran de fin fiable : attendre l'envoi avant de lire le classement — branche `vibe/over-rank-await-264a24`)

- [ ] `main.js` : promesses d'envoi capturées (`let submitP = null;` / `let submitSrP = null;`, assignées sur `leaderboard.submitScore` / `submitSpeedrun`)
- [ ] Bloc `#over-rank` : **await** de l'envoi (`await submitP` / `await submitSrP`) AVANT toute lecture du rang — corrige « 🏁 score pas encore visible en ligne » alors que le score apparaissait ensuite dans le classement (course lecture/écriture)
- [ ] Si rang non trouvé : **2e lecture après 1,2 s** (`readRank` + `setTimeout(r, 1200)`) avant le message de repli
- [ ] Rang trouvé hors ligne → suffixe « — classement local (envoyé à la reconnexion) » ; `writeError` → ligne « ⚠️ envoi refusé par le serveur — hors classement en ligne (…) »
- [ ] `node tests/break.test.mjs` : section AU (5 assertions) — **395 assertions**
- [ ] Test manuel : finir un niveau connecté (Auto école, niveau 2) → l'écran de fin affiche directement « 🏁 N pts → #k au classement — Accélération (Auto école) » (plus de « pas encore visible ») ; speedrun → « ⏱ t → #k au classement speedrun » ; si envoi refusé (fenêtres élargies) → ligne ⚠️ explicite
- [ ] CI verte + CACHE sw bumpé (roadtap-v79) + VERSION 1.3.71 + version.json 1.3.71

## Checklist v1.3.72 (SW ne touche plus au cross-origin + no-store sur les GET Firebase — classement toujours frais — branche `vibe/sw-firebase-bypass-264a24`)

- [ ] `sw.js` : `if (!sameOrigin) return;` **avant** tout `respondWith` (navigate compris) → les requêtes Firebase/gstatic ne passent plus du tout par le SW (DevTools n'affiche plus « service worker » dessus) et ne sont jamais dans le cache SW
- [ ] `sw.js` : un seul calcul `url`/`sameOrigin` ; `version.json` toujours non intercepté (v1.3.30) ; code toujours network-first (v1.3.24) — non-régression
- [ ] `js/leaderboard.js` : `cache: 'no-store'` sur les **7 GET RTDB** (ping ×2, scores ×2, challenges, speedrun ×2) → aucune lecture servie depuis le cache HTTP du navigateur
- [ ] `js/cloudsave.js` : GET `players/<uid>` en `no-store` (sauvegarde cloud fraîche)
- [ ] `node tests/break.test.mjs` : section AV (6 assertions) — **401 assertions**
- [ ] Test manuel : DevTools → Réseau → ouvrir le classement : les requêtes `realtime-database-…/*.json` n'ont plus « service worker » dans la colonne transfert et renvoient 200 avec données à jour ; finir un niveau connecté → le rang écran de fin reflète le score qui vient d'être envoyé (v1.3.71 + v1.3.72)
- [ ] Hors ligne : le classement local s'affiche toujours (repli `isOnline()` inchangé) ; reconnexion → file hors ligne vidée (v1.3.66)
- [ ] CI verte + CACHE sw bumpé (roadtap-v80) + VERSION 1.3.72 + version.json 1.3.72

## Checklist v1.3.73 (speedrun verrouillé par niveau + tri ⚡ Réaction — branche `vibe/speedrun-gate-reaction-sort-264a24`)

- [ ] **Verrou speedrun** : `markCleared` appelé seulement si `stats.completed && !sr` (« terminé » = mode normal uniquement)
- [ ] Carte niveau : badge `srLocked` + bouton « 🔒 ⏱ normal d’abord » quand le mode Speedrun est actif et le niveau non terminé ; `renderLevels()` appelé aux 2 toggles du mode
- [ ] Garde au clic « Jouer » **et** en profondeur dans `startLevel` → toast « ⏱ Speedrun verrouillé : termine d'abord le niveau N « … » en mode normal ! » ; Survie ∞ non concernée
- [ ] **Tri ⚡ Réaction** : bouton `#lb-sort` cycle 🏁 Score → ⏱ Temps → ⚡ Réaction → … (persisté, `sort: 'reaction'` accepté), `lbSortLabel()` aussi à l'ouverture ; `sortLbRows(arr,'reaction')` = avgMs croissant d'abord, puis score décroissant
- [ ] `node tests/break.test.mjs` : section AW (8 assertions) + regex startLevel assouplie — **409 assertions**
- [ ] Test manuel : toggle Speedrun → niveaux non terminés affichent « 🔒 ⏱ normal d’abord », clic → toast et pas de départ ; terminer un niveau en normal → le speedrun se débloque ; classement → 3 clics sur Trier = Score/Temps/Réaction, persisté
- [ ] CI verte + CACHE sw bumpé (roadtap-v81) + VERSION 1.3.73 + version.json 1.3.73

## Checklist v1.3.74 (temps speedrun conservés PAR NIVEAU — plus de dedupe global — branche `vibe/speedrun-per-level-264a24`)

- [ ] `leaderboard.js` : `sortAscTimeUnbounded` ne dédoublonne **plus** globalement → `getSpeedrunAll()` retourne TOUTES les entrées (tous niveaux), triées croissant
- [ ] `getSpeedrunTop(levelFilter)` : filtre par niveau **AVANT** `dedupeByPlayer(...,'speedrun')` → 1 meilleur temps par joueur **par niveau**
- [ ] `buildTimeMap` inchangé (filtre niveau puis min/joueur) — fonctionne maintenant grâce à getSpeedrunAll non dédoublonné ; nouveau `buildTimeLevelMap` (joueur → { timeMs, levelId })
- [ ] `main.js` : colonne ⏱ = « ⏱ 0:14.13 · niv. 1 » en vue « 🌐 Tous niveaux » (suffixe `niv. N` seulement si `lbLevelFilter === 'all'`), « ⏱ 0:20.38 » avec un filtre niveau
- [ ] Bloc `#over-rank` speedrun : `getAll`-équivalent corrigé → le rang du niveau joué est trouvé même si le meilleur temps global du joueur est sur un autre niveau
- [ ] `node tests/break.test.mjs` : section AX (8 assertions : 4 entrées conservées pour 1 joueur sur 3 niveaux, buildTimeMap par niveau/all, buildTimeLevelMap, getSpeedrunTop('1'/'2')) + MAJ 2 assertions — **417 assertions**
- [ ] Test manuel : speedrun niveaux 1, 2, 3 → classement, vue « Tous niveaux » : ⏱ affiche le meilleur temps global + son niveau (« · niv. 1 ») ; filtre niveau 2 → ⏱ = temps du niveau 2 ; filtre niveau 1 → temps du niveau 1 (plus « — »)
- [ ] CI verte + CACHE sw bumpé (roadtap-v82) + VERSION 1.3.74 + version.json 1.3.74

## Checklist v1.3.75 (saisie clavier dans les champs + ami supprimé ne revient plus — branche `vibe/pseudo-clavier-amis-264a24`)

- [ ] **Clavier/pseudo** : garde « champ de saisie » (INPUT/TEXTAREA/SELECT/contentEditable) dans le handler `keydown`, posée après `e.repeat` et le bloc `keyCapture`, **avant** `keyToAction`/`preventDefault` → R/M/W/X/C/V/B/N (et Space/flèches) s'insèrent dès le 1er appui dans la modale pseudo et le champ ami
- [ ] **Amis** : tombstones `deletedFriends` (minuscules) — `removeFriend` pose un tombstone, `addFriend` le lève, `sanitize` nettoie, `snapshot` l'envoie au cloud, `mergeRemote` fusionne les tombstones (local + remote) et **exclut** les amis tombstonés de l'union
- [ ] `pushCloud` (pull-merge-push) ne fait plus revenir un ami supprimé au pagehide/quitter la page
- [ ] `node tests/break.test.mjs` : section AY (8 assertions : garde avant keyToAction, tombstone add/remove/merge/re-ajout, snapshot) — **425 assertions**
- [ ] Test manuel : modale pseudo → taper vite « RMWXCVBN » lettre par lettre → tout s'affiche immédiatement ; supprimer un ami (✕) → quitter la page classement → revenir → l'ami n'est plus là ; le remettre → OK
- [ ] CI verte + CACHE sw bumpé (roadtap-v83) + VERSION 1.3.75 + version.json 1.3.75

## Checklist v1.3.76 (voies manuelles + musique calée sur les lignes + touches Z/S — branche `vibe/voies-manuelles-musique-264a24`)

- [ ] **Voies manuelles** : plus de retour auto (`lastOvertaken` ne remet plus `laneTarget=CAR_LANE`) ; `swipeRight()` (swipe → / ➡) pour revenir à droite ; au dépassement, `tOncoming ≥ 1,4 s` + entre-sens vidé
- [ ] **Danger sens inverse** : spawn oncoming même quand le joueur est à gauche, avec lead ≥ 1050 px (~1,5-2,5 s = fenêtre d'action) ; collision `finish('oncoming')` si joueur à gauche et |distance - c.p| < 58 ; alerte `danger` 0..1 + texte ⚠ clignotant « VOITURE DE FACE — SWIPE → / ➡ » ; pas de mort en tutoriel
- [ ] **Spawn** : jamais 2 voitures même file à < 520 px (`c.p > distance-400 && c.p < distance+520` bloque le spawn)
- [ ] **Touches** : `DEFAULT_KEYS = Z/S/←/R` ; `keyToAction` : Z/↑=front, S/Space/↓/Enter=rear, ←=swipe, →=swipeRight (toutes orientations) ; `trySwipe` gère dx<-40 (gauche) et dx>+40 (droite) ; branches swipeRight clavier+souris
- [ ] **Zones tactiles** : défaut = gauche/droite (gauche=AV, droite=AR) via `verticalZones=false` ; migration `horizontalZones` dans `load()` ; option accessibilité = « zones haut/bas » ; `keyToAction(..., !save.verticalZones, ...)`
- [ ] **Musique** : `musicLineAnchor()` (pas séquenceur + kick pile sur la ligne, re-ancrage lookahead) appelé par le jeu quand une ligne atteint les roues (rear, `line.anchored`, une fois/ligne)
- [ ] **Tutoriel** : textes MAJ (Z/S, SWIPE ← puis →, alerte ⚠, plus de « revient toute seule »), `zonesTxt` via verticalZones
- [ ] Écran de fin : raison `oncoming` → « 💥 Voiture de face ! Reviens à droite avec → »
- [ ] `node tests/break.test.mjs` : section AZ (13 assertions) + MAJ keyToAction/DEFAULT_KEYS/bindKey/zones ; `game.smoke` : 4 nouveaux scénarios (collision de face, danger, garde spawn, swipeRight) — **438 assertions**, 9 scénarios smoke
- [ ] Test manuel : Pilote → doubler (swipe ←/⬅), la voiture RESTE à gauche ; ⚠ clignote si une voiture de face approche ; swipe →/➡ pour revenir ; rester à gauche jusqu'à la collision = 💥 écran de fin ; PC : Z=AV, S=AR, ⬅/➡ = voies ; musique : chaque ligne = un beat audible
- [ ] CI verte + CACHE sw bumpé (roadtap-v84) + VERSION 1.3.76 + version.json 1.3.76

## Checklist v1.3.77 (MODE UNIQUE : standard+speedrun fusionnés + pénalités de temps — branche `vibe/mode-unique-264a24`, empilée sur #59)

- [ ] **Plus de sélecteur de mode** : `btn-mode-normal`/`btn-mode-speedrun` supprimés du HTML, handlers + `renderModePicker` supprimés ; label « Mode unique : score 🏁 + chrono ⏱ » ; plus aucun `save.speedrun` dans main.js
- [ ] **Chrono partout** : `startLevel` passe `speedrun: true` (chrono + bonus vitesse PARFAIT toujours actifs) ; HUD `#hud-time` rafraîchi toutes les 100 ms (elapsed + penaltyMs) ; écran de fin = score (#over-score) + chrono (#over-time, « 🏆 nouveau record » si record)
- [ ] **Pénalités de temps** : raté = `penaltyMs += 500` (popup « RATÉ +0,5 s ») ; `timeMs final = elapsed + penaltyMs` ; **continuer = +2 s** (`penaltyMs += 2000`, label « Continuer — +2 s ⏱ », plus de coût en pièces, `continueCost` retiré)
- [ ] **Classement** : score envoyé à chaque fin (si éligible), temps envoyé si niveau terminé ; `#over-rank` affiche les 2 rangs « 🏁 … · ⏱ … » ; gate v1.3.73 supprimée (plus de verrou speedrun) ; `markCleared` sans condition de mode
- [ ] `node tests/break.test.mjs` : section BA (7 assertions) + MAJ AW/AR — **444 assertions** ; `game.smoke` : +1 scénario pénalités (10 au total)
- [ ] Test manuel : une seule partie = score + chrono live ; rater une ligne → « RATÉ +0,5 s » et chrono +0,5 s ; 3 ratés → « Continuer — +2 s ⏱ » (gratuit en temps, plus de pièces) ; écran de fin : score + ⏱ temps + 2 rangs ; classement : colonnes 🏁 et ⏱ remplies par la même partie
- [ ] CI verte + CACHE sw bumpé (roadtap-v85) + VERSION 1.3.77 + version.json 1.3.77


## v1.3.78 — fondations esport : mesure au dernier tap, départage des égalités, anti-triche par niveau, ±ms

- **Mesure (#28a)** : `timeMs` figé au moment de la résolution de la dernière ligne (`lastResolveMs`), plus à la frame du +80 px — les égalités exactes au minimum théorique deviennent quasi impossibles ; le repli = ancien comportement.
- **Départage (#28b/c)** : `compareEntries` (score/time/réaction) avec chaîne officielle : score desc → avgMs asc → timeMs asc → misses asc → date asc (et symétrique pour le temps). Appliqué au classement (tri Score/Temps/Réaction) ET au rang affiché écran de fin. Entrées speedrun enrichies : `lines`, `avgMs`, `misses`, `score`, `biasMs`.
- **Anti-triche par niveau (#4/#26)** : champ `lines` obligatoire + bornes serveur : `score <= lines*250`, `timeMs >= lines*400`, `avgMs` 0–2000, `biasMs` ±1000, `misses` 0–1000, `hash` 64 hex optionnel (replay). **ACTION REQUISE : déployer `database.rules.json` dans la console Firebase** (les anciennes entrées en file sans `lines` seront abandonnées automatiquement — `flushQueue` ne bloque plus).
- **Indicateur ±ms (#31)** : `biasReaction` (moyenne signée des dtMs) affiché à l'écran de fin : « 38 ms (−6 ms trop tôt) ».
- Tests : core (biasReaction), smoke (timeMs au dernier tap), break section BB (461 assertions au total) ; audit §12 OK.


## v1.3.79 — replays vérifiables (#30) + rate-limit client

- Chaque run terminé enregistre un **replay** (`{seed, mode, lines, score, timeMs, taps}` — taps signés dtMs + instant) ; le meilleur par niveau est gardé en local (`roadtap_save_v1.replays`).
- **Hash SHA-256** du replay (repli FNV 64 hex si `crypto.subtle` indispo) envoyé dans les entrées score/speedrun (champ `hash`, validé 64 hex par les règles).
- Bouton **▶ Voir mon replay** à l'écran de fin : rejoue le run en mode lecture (badge ▶ REPLAY, entrées ignorées, rien n'est envoyé au classement).
- **Rate-limit doux client** : min 3 s entre 2 écritures en ligne (trop tôt = mis en file hors-ligne).
- Tests : break section BC (470 assertions), smoke 11ᵉ scénario (replay rejoué, entrée joueur ignorée) ; audit OK.


## v1.3.80 — accessibilité P0 (#6/#15/#16/#17/#19/#27/#29)

- **#6 Gros doigts** : zones tactiles 60/40 (ratio `zoneFromPoint`) + seuil de swipe 25 px (option Paramètres).
- **#15 Animations réduites** : plus de shake/particules/flash en jeu + transitions CSS coupées (`body.reduce-anims`) — photosensibilité.
- **#16 Contraste élevé** : thème `highcontrast` (fond noir pur, lignes blanches) prioritaire sur le thème du niveau.
- **#17 Taille du texte** : petit/moyen/grand via `html[data-textsize]` (UI uniquement, pas le canvas).
- **#19 ARIA** : `#sr-live` (aria-live) alimenté par chaque toast, dialog `aria-modal` pour la modale d'aide.
- **#27 Marqueur du 0 ms** : flash de la ligne quand elle passe exactement sous l'essieu — **hors classement** (`canSubmitToLeaderboard` refuse, règle `aids != true` ajoutée à scores/speedrun/challenges — **redéployer les règles**).
- **#29 Infobulle « 0 ms »** : modale avec schéma SVG (boutons ❓ en jeu, niveaux, paramètres) — explique le 0 ms, la fenêtre symétrique ±45 ms, le beat audio, la stat ⚡.
- Tests : break section BD (483 assertions) ; audit OK ; triple bump v1.3.80/roadtap-v88.


## v1.3.81 — compétition visible + niveaux (#22/#23/#25/#18/#14/#13/#20/#21/#10/#9/#12)

- **#22 Médailles** 🥇🥈🥉 déduites du rang au classement (top 3), stockées par `mode:niveau`, affichées sur les cartes de niveaux.
- **#23 Tiers** Bronze→Légende (`tierOf` sur les médailles), affiché dans le menu (`#menu-tier`).
- **#25 Saison hebdo** : onglet 🗓️ Saison (nœud `/seasons/<weekKey>/…`, mêmes règles que scores — **redéployer les règles**), envoi auto à la fin de chaque partie.
- **#18 Écran de fin** : rang animé (compte jusqu'à #N) + bouton 📤 Partager (Web Share API, repli presse-papiers).
- **#14 Défis du jour** : +2 types (« 0 raté sur N lignes », « combo max xN »).
- **#13 Niveau hebdo 🗓️** « Orage hebdo » (id 900) affiché samedi/dimanche en plus du Week-end doré.
- **#20 Thèmes saisonniers cosmétiques** : Halloween 🎃, Noël 🎄, Été 🏖️ dans la boutique.
- **#21 Icône PWA saisonnière** : favicon swap selon le mois (3 SVG dans le manifest + SW).
- **#10 Récompenses visibles** sur les cartes (bonus 1er clear, paliers Survie 25/50/100).
- **#9 Courbe lissée** : `gapMin` plancher 260 px, `pDouble` plafonné à 0,35. **#12 Boss** 👹 niveaux 5/10/15 (densité 0,45 min).
- Tests : break section BE (496 assertions) ; audit OK ; triple bump v1.3.81/roadtap-v89.


## v1.3.82 — feel & social (#1/#2/#3/#5/#7/#8/#11/#24)

- **#1 Mode entraînement** : vies infinies + vitesse 0,5×/0,75×/1×, badge 🎓, **hors classement** (toast explicite).
- **#2 Buffer d'input (coyote 120 ms)** : un tap jusqu'à 120 ms avant la fenêtre est rejugé à son instant réel — la latence du téléphone pardonne, les fenêtres ne changent pas.
- **#3 Fantôme du record** : repère translucide sur chaque ligne à la position exacte du meilleur run (replay local).
- **#5 Calibration latence** : 4 pulsations, 4 taps, offset moyen clampé ±100 ms, appliqué au jugement — **hors classement si ≠ 0**.
- **#7 Vibration** on/off + patterns (PARFAIT = double pulsation, raté = longue).
- **#8 Mode gaucher** : zones, swipes et flèches inversés.
- **#11 Fenêtres adaptatives** : standard / larges (60/130/210) / très larges (90/200/320) — hors classement si ≠ standard.
- **#24 Duels asynchrones entre amis** : bouton ⚔️ dans l'onglet Amis du classement → défi stocké (`/challenges/duels`, mode `duel`) → l'ami le voit dans Défis > « ⚔️ Duels reçus » avec « Relever ».
- Tests : break section BF (507 assertions) ; audit OK ; triple bump v1.3.82/roadtap-v90.


## v1.3.83 — le pseudo est récupéré du cloud à la reconnexion

- `snapshot()` inclut désormais `pseudo` → écrit dans `players/<uid>` à chaque `pushCloud`.
- `mergeRemote` restaure le pseudo **uniquement s'il est vide en local** (jamais d'écrasement d'un pseudo choisi localement).
- Si la modale pseudo était ouverte à la connexion et que le cloud fournit le pseudo : modale fermée + action en attente (lancer la partie) exécutée automatiquement. Idem à la restauration de session au démarrage.
- Tests : break section BG (512 assertions, dont test fonctionnel mergeRemote) ; audit OK ; triple bump v1.3.83/roadtap-v91.


## v1.3.84 — pseudo uniquement APRÈS connexion Google + tutoriel lancé une seule fois

- « Jouer » exige désormais **compte Google connecté (uid) + pseudo** : la modale pseudo bloque le bouton Enregistrer tant que pas connecté (texte 🔑 explicite), pré-remplie le pseudo depuis l'email Google, et `btn-pseudo-save` refuse hors connexion.
- Le **tutoriel ne se lance qu'une fois** (`setTutorialDone` au lancement, plus à la fin) — rejouable à volonté via le bouton 👶 Tutoriel du menu.
- Tests : break section BH (518 assertions) ; audit OK ; triple bump v1.3.84/roadtap-v92.


## v1.3.85 — jeu libre sans compte/pseudo ; connexion demandée seulement pour le classement

- « Jouer » et le tutoriel ne demandent plus rien : partie directe (tutoriel une seule fois, rejouable via 👶).
- Le **classement** (bouton 🏆) déclenche la modale connexion Google + pseudo ; à la connexion, `flushQueue(uid, pseudo)` envoie les scores/temps faits en local et les **rattache au compte** (uid + pseudo posés sur les entrées anonymes, y compris les payload speedrun/challenge).
- Toast de fin de partie (anonyme) : « ce résultat sera envoyé à ta connexion et lié à ton compte ».
- Tests : break section BI (525 assertions, dont test fonctionnel flushQueue uid+pseudo) ; audit OK ; triple bump v1.3.85/roadtap-v93.

## v1.3.86 — demandes d'amis (envoyer / accepter / refuser) + sweep de cohérence post-fusion

- **Amis = demandes vérifiées** : le pseudo saisi doit exister en ligne (résolu en uid via les scores/speedrun publics), puis envoi d'une demande (`POST /friendRequests/<toUid>/<fromUid>`, statut `pending`). Le destinataire voit 📨 avec ✅ accepter / ❌ refuser (`PATCH status`) ; l'émetteur suit le statut de ses demandes envoyées 📤 (accepted → ami ajouté des deux côtés, refused → retirée).
- Nœud `friendRequests` ajouté à `database.rules.json` (read destinataire+émetteur, write create pending / PATCH accepted|refused / delete par le destinataire) — **⚠ à re-publier dans la console Firebase (Database → Règles → Publier)** après merge.
- Demandes envoyées persistées localement (`friendRequestsOut`) et synchronisées avec le cloud (union au merge).
- **Sweep de cohérence** (bugs du gros batch v1.3.78–v1.3.84, rapportés après les merges) :
  - fix crash **Tutoriel** : `startTutorial` lisait `level.id` (variable inexistante dans ce scope → `ReferenceError: level is not defined`, main.js:436 au clic 👶) → `TUT_LEVEL.id`.
  - fix `unlockAudio();` noyé dans un commentaire `//` dans `startLevel` (jamais exécuté) → restauré sur sa propre ligne.
  - fix clé `training:` dupliquée dans les options `Game` de `startLevel` → une seule occurrence.
  - vérifié SANS bug : suppression d'ami qui revenait (tombstones `deletedFriends`, v1.3.75), saisie du pseudo (garde champ INPUT, v1.3.75), ids HTML↔JS, handlers en double, assets du SW, triple bump — 6 tests + audit 0 problème sur main ET sur la branche.
- Tests : break sections BJ (demandes d'amis, dont fonctionnel resolve/envoi/PATCH avec fetch mocké) + BK (sweep) → 540 assertions ; audit OK ; triple bump v1.3.86/roadtap-v94.

## v1.3.87 — fix règles RTDB : l'opérateur `in` est interdit (erreur de publication)

- `database.rules.json` (nœud `friendRequests`, v1.3.86) utilisait `status in ['accepted','refused']` → la console refuse : **« Erreur lors de l'enregistrement des règles - Line 54: Rule expressions may not contain 'in' operator »**. Remplacé par `(status == 'accepted' || status == 'refused')`.
- Garde-fou : `tools/audit.mjs` §12 bloque désormais toute règle contenant ` in [` ; test BJ mis à jour + section BL ajoutée.
- **⚠ re-publier les règles** dans la console Firebase après merge (le nœud `friendRequests` n'est donc PAS encore actif en ligne côté serveur).
- Tests : 6/6 OK (break 543 assertions) ; audit OK ; triple bump v1.3.87/roadtap-v95.

## v1.3.88 — diag classement + détail des refus de demandes d'amis

- **« 16 chargé(s) — 0 affiché(s) ici »** : le compteur affiché pouvait être celui de la lecture speedrun (`getSpeedrunAll` écrasait le statut après `getAll`) → snapshot `stScores` pris juste après la lecture des scores ; le message explique désormais pourquoi 0 affiché (onglet 👥 Amis sans ami / filtre niveau « … »).
- **« Envoi impossible (hors ligne ou refus serveur) »** sur une demande d'ami : le toast affiche la vraie cause (`HTTP 401/403` → **publie les règles `friendRequests` dans la console Firebase, v1.3.87+** ; `réseau` → connexion). `getLastFrError()` exposé par leaderboard.js.
- Tests : section BM (compteur + lastFrError fonctionnel) ; audit OK ; triple bump v1.3.88/roadtap-v96.

## v1.3.89 — reconnexion : le pseudo revient du cloud (et le push ne l'écrase plus)

- **Cause racine** : `pushCloud()` faisait pull-merge-push, mais si le PULL échouait (401 App Check pas encore prêt juste après le popup, ou réseau), le PUT partait quand même et **écrasait tout `players/<uid>`** — dont le pseudo → à la reconnexion suivante, plus rien à restaurer (« le pseudo ne remonte pas »).
- Nouveau `cloudsave.loadRaw()` ({ok, data, error}) qui distingue « nœud vide » d'une erreur ; `pushCloud()` **ne pousse plus après un pull en échec**.
- `completeGoogleSignIn` + restauration au boot : **2e essai de lecture après 1,2 s** si la 1re échoue ; si le pseudo revient du cloud → toast « ✏️ Pseudo « … » récupéré du cloud », champ pré-rempli, modale fermée (v1.3.83) via `noteRestoredPseudo()`.
- Tests : section BN (loadRaw fonctionnel 401 / 200-null / 200-data ; mergeRemote restaure le pseudo après resetProgress ; snapshot le conserve) ; audit OK ; triple bump v1.3.89/roadtap-v97.

## v1.3.90 — plus de délai auto « niveau suivant » + menu 🎞 Replays (10 dernières parties, téléchargeables)

- **Délai auto supprimé** : plus de compte à rebours de 10 s vers le niveau suivant (`startNextCountdown`/`cancelNextCountdown`, bloc `#over-next`, CSS retirés). Avance **manuelle** via le bouton « ▶ Niveau suivant » (affiché seulement si niveau terminé + suivant existe), Rejouer, Niveaux ou Menu.
- **Replay corrigé** : à la fin d'un replay, plus de redémarrage auto — titre « ▶ Replay terminé » ; un replay ne touche plus à RIEN (records, totaux, étoiles, cleared, pièces, défi du jour, quêtes, succès — guards `!isReplay`) ; pas d'overlay « continuer » ni de vitesse entraînement pendant un replay ; le mode rejoué est celui d'origine (`replayRep.mode`).
- **Menu 🎞 Replays** (bouton accueil) : les **10 dernières parties** (clé `roadtap_replays_v1`, plus récente en tête) avec ▶ voir (mode lecture), 💾 télécharger en `.json` (`roadtap-replay-<date>-nivX-<score>pts.json` via Blob), ✕ supprimer.
- Tests : section BO (suppression countdown, guards, cap 10 fonctionnel, ids HTML) ; audit OK ; triple bump v1.3.90/roadtap-v98.
