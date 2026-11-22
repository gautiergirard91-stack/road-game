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
