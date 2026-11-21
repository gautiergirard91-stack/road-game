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

## Note bloqueurs de pub (Google Sign-In)

- uBlock Origin / Privacy Badger bloquent `accounts.google.com` (popup GIS) et `identitytoolkit.googleapis.com` (échange du jeton) → erreurs « popup bloquée » / CORS. **Mettre `roadtap.uk` en liste blanche** dans les deux extensions + autoriser les popups pour le site. Le bouton affiche alors « Continuer en tant que … » quand le navigateur est déjà connecté à un compte Google.
