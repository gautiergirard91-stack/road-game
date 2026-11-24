# 🗺️ Roadmap & étude détaillée des améliorations — Road Tap Racer

Étude de **tous les aspects du jeu** relus from first principles, avec pour chacun : état actuel, limites, et améliorations proposées (avec priorité P0/P1/P2).

Légende : **P0** = à faire avant/après le merge de la branche béton armé ; **P1** = avant la publication Play Store (2–3 semaines) ; **P2** = après, contenu/vivant.

---

## 1. Classement & social

**État** : local + Firebase (filtre difficulté + niveau, pseudo + opt-in, Google Sign-In, classement du défi du jour), diagnostic d'erreur visible (v1.3.27).
**Limites** : ✅ v1.3.37/v1.3.40 — jouer **sans compte OK** (100 % local) ; Google requis **uniquement** pour le cloud + le classement (règles `auth != null`, envois LB réservés aux comptes liés) ; synchro cloud réparée (clé uid non lowercasée + pull-merge-push + keepalive), fusion à la connexion, reset local à 0 à la déconnexion (clé uid non lowercasée + pull-merge-push + keepalive). Reste : pas de « défi tes amis » ; scores non signés (un tricheur peut poster 999 999 — la règle borne à 1 000 000 mais pas la crédibilité).
- **P0** Vérifier avec 2 testeurs que le classement affiche bien les autres joueurs (voir `docs/FIREBASE.md` §2bis : `scores.json` → 200, règles publiées). Le diagnostic v1.3.27 dira exactement ce qui bloque sinon.
- **✅ fait v1.3.31** Classement **speedrun** dédié : nœud `speedrun/<levelId>`, tri **croissant** (temps), même filtres. (Le score speedrun est un temps : le tri desc du classement global ne convient pas.)
- **P1** Anti-triche léger côté client : rejeter un `submitScore` si `score >` un plafond crédible pour le niveau (ex: `lines × 150 × combo max`), et ignorer les temps speedrun < temps théorique minimal (`sum(gaps) / vitesse max`).
- **✅ fait v1.3.36** Classement « amis » par **pseudo** (onglet 👥 Amis : ajout/retrait de pseudos, filtre client du classement mondial — on ne lit JAMAIS les contacts Google du téléphone, la People API demanderait une permission intrusive sur le Play Store). Reste P2 : « Défier un ami » (lien de partage), notifications de record d'un ami.
- **P2** Saisons de classement (reset mensuel, récompense cosmétique pour le top).

## 2. Boucle de jeu & rétention

**État** : 15 niveaux, survie ∞, speedrun, défi du jour, quêtes hebdo, streak, succès (13), tutoriel forcé.
**Limites** : peu de raisons de revenir après les 15 niveaux ; la survie ∞ n'a pas de fin ni de récompense de palier.
- **✅ fait v1.3.35** Paliers de Survie ∞ (10/25/50/100/150/200/300/500 lignes → pièces ; skin « 🏆 Survie d'or » + médaille à 50).
- **✅ fait v1.3.36** Événement week-end (samedi/dimanche via `core.isWeekend`) : bannière menu 🎉, **pièces ×2** sur toute la partie, niveau spécial gratuit « 🎉 Week-end doré » (id 100, hors `LEVELS` donc sans impact sur déblocages/succès) affiché uniquement le week-end.
- **P2** Mode « contre-la-montre quotidien » (= défi du jour mais avec classement temps, cf. §1).
- **✅ fait v1.3.35** Étoiles par niveau sur les cartes (1/2/3). Reste : carte du monde en chaîne.

## 3. Économie & boutique

**État** : 3 monnaies par difficulté, boutique paginée avec aperçus canvas, packs, sons ; 100 % cosmétique.
**Limites** : pas d'achat réel (AdMob/IAP) ; aperçus statiques ; pas de « nouveau » badge.
- **P1** AdMob **rewarded réel** dans `js/ads.js` (actuellement simulé 5 s) pour le « continuer » gratuit.
- **P1** IAP cosmétiques via **Play Billing** (packs de pièces) — optionnel, documented dans MONETIZATION.md.
- **✅ fait v1.3.36** Aperçus **animés** dans la boutique ET le garage (paramètre `t` sur les 5 `render*Preview` de game.js, boucle rAF active uniquement sur ces écrans et onglet visible ; rendu statique t=0 ailleurs).
- **✅ fait v1.3.36** **Garage** (écran purement visuel) : toutes les voitures possédées en grille, aperçus animés 72×84, tap = équiper.
- **P2** Badge « NOUVEAU » sur les items ajoutés depuis la dernière visite + « déjà possédé » grisé.
- **P2** Équilibrage continu via `tools/balance_sim.mjs` (simuler des milliers de parties pour ajuster les coûts/bonus).

## 4. Game feel & moteur

**État** : fenêtres ms, combos sur PARFAIT, speedrun +vitesse, effets visuels, sons WebAudio, vibrations, météo, trafic, piétons, dépassement.
**Limites** : peu de feedback d'erreur (le raté est brutal), pas de ralenti dramatique en fin de niveau, pas de « ghost » du meilleur run.
- **P1** Jauge de précision en fin de partie (répartition perfect/bien/passable/raté) + réaction moyenne (déjà calculé : `avgReaction`).
- **P2** Replay « ghost » du meilleur run sur le niveau (ligne fantôme).
- **P2** Screen shake / flash / ralenti au dernier cœur (déjà un shake sur raté : l'amplifier quand il reste 1 ❤️).
- **P2** Nouveaux types de lignes (zigzag, double bande, ligne « glissante » où le jugement se décale).

## 5. Tutoriel & onboarding

**État** : 9 étapes forcées, pause + curseur, quit → popup, repliable, zones AV/AR visibles.
**Limites** : un seul tuto ; pas de « astuces » contextuelles en jeu.
- **P0** Valider en conditions réelles (téléphone) que le slider fonctionne partout (test headless OK, mais valider le tactile réel).
- **P2** Bulle d'aide contextuelle la première fois dans chaque mode (speedrun, survie).

## 6. Accessibilité & confort

**État** : fenêtres élargies, daltonien, zones horizontales, tuto repliable.
- **P1** Option **taille des zones de tap** (S/M/L) + option « vibrations » on/off (actuellement toujours on).
- **P2** Mode « une main » (toute la largeur = même essieu selon la difficulté), lecteur d'écran (aria-live sur le HUD).

## 7. Technique & dette

- **P0** Merger `vibe/beton-arme-264a24` après revue ; vérifier que la CI passe sur main.
- **P0** Bump `CACHE`/`VERSION` à chaque deploy (déjà en règle AGENTS.md) ; demander aux testeurs de **désenregistrer le SW une fois** (F12 → Application → Service Workers → Unregister + Clear site data).
- **P1** Google Sign-In : finir le plan B si le flux GIS pose encore souci (charger firebase-app/auth depuis gstatic + `signInWithPopup`), puis **tester la synchro cloud entre 2 appareils**.
- **P1** Play Store (dans 2–3 semaines, cf. README) : créer l'app (`uk.roadtap.game`), récupérer **application ID + SHA-256**, remplir `.well-known/assetlinks.json`, Bubblewrap (`init` depuis `https://roadtap.uk/manifest.webmanifest`, `build`, test APK interne, upload AAB), fiche store (assets `store/` + textes ASO), classification IARC, héberger PRIVACY.md, **budget Cloud à 1 €** + supprimer le projet Cloud parasite `project-f6b7d7eb` + éventuellement repasser en plan Spark.
- **P2** Perf : profiler le render sur vieux téléphone (déjà render stoppé si `document.hidden`) ; pré-rendre les sprites de voiture en offscreen canvas.
- **P2** Analytics : exploiter `js/analytics.js` (funnel tuto, rétention J1/J7, niveau le plus raté) pour guider l'équilibrage.
- **P2** i18n : anglais (ASO déjà prêt dans MARKETING.md).

## 8. Qualité & processus

- **P0** Garder la CI à 4 tests + audit sur **chaque push de branche** (déjà le cas) ; ne merger que CI verte.
- **P1** Checklist manuelle `docs/QA.md` exécutée sur PC **et** téléphone avant chaque release (déjà le rituel 🔔 BLOC DE TEST).
- **P2** Tests E2E réels (Playwright) sur la TWA avant publication store.

---

## 9. Risques connus à surveiller

1. **Règles RTDB** : si le classement n'affiche que soi, lire la ligne de diagnostic dans le jeu + `docs/FIREBASE.md` §2bis (règles publiées ? `scores.json` → 200 ? écriture → 200 ?).
2. **Service worker fantôme** chez les testeurs : un seul Unregister + Clear site data règle 90 % des « la version n'a pas changé ».
3. **Bloqueurs de pub/trackers** (uBlock, Privacy Badger) cassent Google Sign-In : prévoir un message « désactive ton bloqueur pour la connexion Google » (déjà partiellement géré via `getLastAuthError`).
4. **Facturation Google Cloud** : projet parasite supprimé, budget à 1 €, plan Spark envisagé — RTDB + Auth restent gratuits à notre échelle.
5. **Données personnelles** : jamais de secret commité (`FIREBASE_DB_SECRET` vide, refresh token jamais envoyé à la DB) — relire `PRIVACY.md` avant chaque release store.


## v1.3.51 — niveaux déterministes (speedrun-friendly)

Le même niveau (id + difficulté) produit **exactement le même parcours à chaque partie** : seed fixe `levelSeed(id, mode)` (FNV hash), tronçons suivants seedés (`id#chunkN`), trafic et piétons sur le même PRNG seedé (`this.rand`, reset à chaque `start()`). Le décor et la météo restent aléatoires (cosmétique). Utile pour les speedruns (temps comparables) et pour apprendre le niveau par cœur avec le beat musical (v1.3.46).

## v1.3.54 — speedrun = Permis A uniquement

Le mode speedrun n'existe plus qu'en **Permis A** : verrouillé dans l'UI (picker de difficulté) et dans le moteur (`this.speedrun ? 'permisA' : opts.mode`). Les records et les envois leaderboard utilisent le mode réellement joué (`runMode = game.mode || save.difficulty`).

## v1.3.56 — check de nuit (cohérence / bugs / sécurité / nettoyage)

- Code mort retiré : modale accessibilité du menu principal (`access-modal` + handlers `btn-access`/`btn-access-close`), boutons son/musique du menu (`btn-sound`/`btn-music`), wiring préfixe `''`, CSS `.tagline`/`.pause-access`. **L'accessibilité est désormais 100 % dans ⚙️ Paramètres** (`s-opt-*`).
- Contrat speedrun corrigé dans `leaderboard.js` : fallback `mode` = `permisA` (cohérence avec v1.3.54).
- Vérification en profondeur du classement (contrat client ↔ règles RTDB : create-only, `auth != null`, `uid == auth.uid`, rejet `wideWindows`, `.indexOn`, échappement HTML des pseudos) : **conforme**, aucun trou trouvé côté client. À confirmer côté console Firebase que les règles publiées = `database.rules.json` (miroir `docs/FIREBASE.md` §2) et que App Check est passé en **Enforce** sur RTDB.
- Rappel sécurité : aucun secret hors `js/config.js` (audit §10), en-tête App Check limité aux URLs `firebasedatabase.app`.

## v1.3.57 — touches sauvegardées avec le compte

Les touches personnalisées (`save.keys`) ne vivent plus seulement dans `roadtap_save_v1` : elles sont **calées sur le compte** à deux niveaux — cloud (`players/<uid>.keys`, déjà en place) et **backup locale par compte** (`roadtap_keys_v1_<uid|pseudo>`), restaurée au chargement si la save principale a perdu les touches. Un CTRL+F5, un clear partiel ou une save corrompue n'efface plus la config. La déconnexion (`resetProgress`) remet la progression à 0 mais **conserve la config** (touches, zones, son/musique, accessibilité).

## v1.3.58 — diagnostic « serveur injoignable » avec la cause exacte

`ping()` détaille désormais le dernier échec (`getPingStatus()` : `ok` / `http-401` / `http-403` / `network` + latence ms), `appCheckDebug()` expose l'état du token App Check, et ⚙️ Paramètres teste **séparément** l'hébergement (sonde `version.json`) et Firebase. Causes typiques : App Check **Enforce** actif avec token indisponible (domaine `roadtap.uk` absent des domaines autorisés reCAPTCHA Enterprise → HTTP 401), règles RTDB modifiées (`scores` plus en `.read: true` → HTTP 403), ou réseau/CORS (extension bloqueuse). Voir `docs/FIREBASE.md` §9.

## v1.3.59 — sonde auth pour départager un HTTP 401

`ping(idToken)` rejoue la requête avec `?auth=` sur 401/403 (`authProbe` dans `getPingStatus()`) : sonde OK = les **règles** exigent une connexion en lecture ; sonde KO = **App Check Enforce** actif sans token valide. `appCheckHeader()` tente un `getToken(ac, true)` (force refresh) avant d'abandonner. L'UI ⚙️ Paramètres affiche la cause exacte.

## v1.3.60 — correction de la clé App Check (cause du 401)

`FIREBASE_APP_CHECK_SITE_KEY` passe à la clé Enterprise « roadtap ent » `6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW` — la seule avec `roadtap.uk` dans ses domaines autorisés. L'ancienne clé n'émettait aucun jeton (« configuration incomplète » côté Fraud Defense, 0 exécution) → HTTP 401 sous Enforce. Vérifier aussi que Firebase → App Check → Apps enregistre l'app web avec cette même clé.

## v1.3.61 — doc App Check

Précision : le bandeau Fraud Defense « demander des scores (évaluations) » vise la vérification **backend** (siteverify + clé secrète), que Road Tap Racer ne fait pas — Firebase App Check vérifie les jetons reCAPTCHA côté serveur. Seules les **exécutions** (jetons) comptent, et elles sont active depuis v1.3.60 (clé `6Lf7vCwu…`).

## v1.3.62 — diagnostic 401 « même connecté » : état du jeton App Check affiché + timeout borné

La sonde auth (v1.3.59) a prouvé que le 401 persistant venait d'**App Check Enforce sans jeton accepté** (pas des règles). v1.3.62 affiche l'état réel du jeton dans ⚙️ Paramètres (`token OK` vs `token KO + erreur exacte`) et borne `getToken` à 4 s pour ne jamais bloquer les requêtes. Cause n°1 restante : la clé `6Lf7vCwu…` doit être enregistrée telle quelle dans **Firebase → App Check → Apps** pour l'app web (provider reCAPTCHA Enterprise).

## v1.3.63 — FIREBASE_APP_ID (cause racine du 401 sous Enforce)

L'échange de jeton App Check exige l'**ID d'application** de l'app web (`1:…:web:…`, Firebase → Paramètres du projet → Vos applications) passé à `initializeApp`. Sans lui : `getToken` → 400 → throttled → 0 % de requêtes validées → RTDB Enforced renvoie 401 partout. `FIREBASE_APP_ID` est ajouté à `js/config.js` (à remplir), passé dans `appcheck.js` et `auth.js`, et le diagnostic ⚙️ Paramètres signale explicitement « FIREBASE_APP_ID manquant » si le placeholder est vide.

## v1.3.65 — liste du joueur (partie 1 : gameplay/UX)

- **Tutoriel raccourci** : 9 étapes (suppression du 2ᵉ dépassement) ; étape raté = texte court et **perte de ❤ réelle** (plus de game over en tuto) ; étape Permis A = **3 lignes réussies** avant d'avancer ; étape Pilote sans « 1er essai », précise que la voiture revient à droite seule.
- **Ville** : maximum **1 passage piéton** par niveau.
- **Classement** : filtres (mode/niveau/amis) **mémorisés** dans `roadtap_lb_filters_v1` et restaurés à la réouverture.
- **Musique** : démarre dès le lancement de la partie (`musicKick()` au clic « Jouer » — reprend l'AudioContext dans le geste utilisateur).
- **Perf** : suppression des `shadowBlur` sur les lignes/voiture en jeu (halos en alpha) → plus de freeze au tap sur mobile.

## v1.3.66 — liste du joueur (partie 2 : boutique / affichage / succès / hors-ligne)

- **Boutique** : prix des objets ×3 (arrondi au 50, gratuits inchangés) ; affichage réparé (commentaire `//` qui fuyait dans les cartes, canvas `#game` qui transparaissait sous les menus → `#game.hidden` hors écran de jeu, `show()` avant `render*` boutique/garage, conflit de taille `.shop-card .swatch` supprimé).
- **Succès** : 27 au total (+13 : dépassements, 1000 PARFAIT, combo x100, 🥇, speedrun, réaction ≤ 40 ms, streak 7 j, 10 000 pièces, ami, week-end, triple couronne).
- **Hors ligne → serveur** : les résultats faits hors ligne ou sans compte partent dans `roadtap_lb_queue_v1` et sont renvoyés automatiquement au retour en ligne + connexion (événement `online`, login Google, ouverture du classement, ping OK).

## v1.3.67 — classement : une seule entrée par joueur + filtres explicites

- `dedupeByPlayer()` : dans chaque vue (difficulté/niveau), un joueur n'apparaît **qu'une fois**, avec **son meilleur score** (min `timeMs` en speedrun, min `avgMs` en réaction). Clé d'identité = `uid` Google, sinon pseudo (insensible à la casse).
- Filtre niveau : option **🌐 Tous niveaux** explicite en tête → à l'ouverture un filtre est toujours visiblement sélectionné (les filtres mémorisés v1.3.65 restent restaurés).
- Lignes : nom du niveau résolu via `levelId` (plus de « L 1 » sur les vieilles entrées) ; statut « N chargé(s) — M affiché(s) ici » ; liste vide avec filtre niveau → message dédié « joue ce niveau pour passer 1er ».

## v1.3.68 — speedrun partout + classement en 2 colonnes (score + temps)

- Le mode **speedrun est disponible dans toutes les difficultés** (Auto école comprise) : le verrou « Permis A seule » (v1.3.54) est levé côté moteur (`game.mode = opts.mode`), UI (picker libre, plus de `setDifficulty('permisA')` forcé) et libellés.
- Page classement : l'onglet **⏱ Speedrun est supprimé** ; chaque onglet de difficulté affiche **deux colonnes** — score (meilleur, 1 entrée/joueur via v1.3.67) et **⏱ meilleur temps speedrun** du joueur sur ce filtre (niveau/difficulté), `—` sinon. La difficulté active filtre aussi quand un niveau est choisi.
- Fin de partie : si le résultat n'est **pas** envoyé en ligne (pas de compte Google, ou fenêtres élargies), un toast dit pourquoi (résultat gardé en local / file hors ligne v1.3.66).

## v1.3.69 — faux 401 au chargement (jeton App Check froid)

Au 1ᵉʳ chargement, le 1ᵉʳ ping partait avant que le jeton reCAPTCHA Enterprise soit prêt (cold start) → **401 sous Enforce** affiché en pastille, alors que ⚙️ Paramètres voyait tout vert ensuite. Fix : `warmAppCheck()` au boot (préchauffe le jeton) + `pingServer()` qui, sur un `http-401` initial, attend le jeton et re-tente **une fois** — utilisé par la pastille menu et par Paramètres.

## v1.3.70 — classement : colonnes Score/Temps triables indépendamment + rang du joueur en fin de partie

- Bouton **« Trier : 🏁 Score ⇄ ⏱ Temps »** au-dessus du classement, persisté (`roadtap_lb_filters_v1.sort`) : en tri Temps, les joueurs avec un temps speedrun passent d'abord (croissant), puis les autres par score. Chaque ligne garde ses **deux colonnes** (score + ⏱ temps) — on voit le meilleur score ET le meilleur temps en même temps.
- **Rang du joueur sur l'écran de fin** (`#over-rank`) : « 🏁 N pts → #i au classement — niveau (mode) » (ou ⏱ temps en speedrun), calculé sur le classement dédoublonné du mode+niveau joué.
- **Toast si l'envoi est refusé** (403 côté règles) — diagnostique du « niveau 2 auto école, rien n'apparaît » : causes principales = pas connecté (local uniquement) ou fenêtres élargies (exclu par les règles `wideWindows != true`).

## v1.3.71 — rang à l'écran de fin fiable (attente de l'envoi avant lecture)

Bug constaté : l'écran de fin affichait « 🏁 score pas encore visible en ligne (local ?) » alors que le score apparaissait ensuite dans le classement — le rang était **lu avant que l'écriture ne soit posée** (envoi fire-and-forget). Fix : le bloc `#over-rank` **attend la fin du POST** (`await submitP`/`submitSrP`), refait une **2e lecture après 1,2 s** si le joueur n'est pas trouvé, affiche « classement local (envoyé à la reconnexion) » hors ligne, et une ligne ⚠️ explicite si le serveur a refusé l'envoi.

## v1.3.72 — le service worker ne gère plus le cross-origin + lectures Firebase en `no-store`

Vu dans DevTools : les requêtes `realtime-database-…/scores/*.json` passaient par le service worker. Même si le SW ne *cache* que le same-origin, toute lecture RTDB passait par lui (et pouvait hériter du cache HTTP). Fix : `if (!sameOrigin) return;` en tête du handler `fetch` du SW (Firebase/gstatic contournent totalement le SW) + `cache: 'no-store'` sur **tous les GET RTDB** (leaderboard ×7, cloudsave players) → le classement et la sauvegarde cloud sont **toujours lus sur le réseau**, jamais depuis un cache. Non-régression : `version.json` toujours non intercepté, code toujours network-first, icônes toujours cache-first offline.

## v1.3.73 — speedrun débloqué par niveau + tri par temps de réaction

- **Speedrun verrouillé tant que le niveau n'a pas été terminé en mode normal** (comportement « feature » validé : un joueur qui ne fait que du speedrun n'apparaît pas dans le classement, puisque les lignes viennent des scores). `markCleared` ne compte plus que les completions **normal** (`stats.completed && !sr`) ; carte niveau « 🔒 ⏱ normal d’abord », toast explicite au clic, et garde en profondeur dans `startLevel`. Survie ∞ non concernée.
- **Bouton « Trier » en cycle à 3** : 🏁 Score → ⏱ Temps → **⚡ Réaction** (temps de réaction moyen croissant, persisté dans `roadtap_lb_filters_v1.sort`).

## v1.3.74 — temps speedrun conservés par niveau (fix dedupe global)

Bug : `getSpeedrunAll()` dédoubonnait **par joueur globalement** (meilleur temps tous niveaux confondus) avant le filtre de niveau → faire un temps au niveau 2 faisait disparaître celui du niveau 1 (colonne ⏱ et rang speedrun). Fix : `getSpeedrunAll` retourne toutes les entrées ; le dedupe 1 entrée/joueur se fait **après** le filtre par niveau (`getSpeedrunTop`, `buildTimeMap`). En vue « 🌐 Tous niveaux », la colonne ⏱ affiche désormais le niveau du temps affiché (« ⏱ 0:14.13 · niv. 1 »).

## v1.3.75 — saisie clavier dans les champs + suppression d'ami définitive

- **Clavier** : le handler `keydown` faisait `preventDefault()` dès qu'une touche correspondait à une action de jeu (flèches/Space/Entrée/KeyS/KeyR + touches custom), même dans un champ texte — et comme `e.repeat` court-circuitait, seules les **répétitions** (appui long) inséraient la lettre. Fix : garde « target = INPUT/TEXTAREA/SELECT/contentEditable → return » posée avant `keyToAction`, donc toutes les lettres s'inscrivent dès le 1er appui (modale pseudo, champ ami).
- **Amis** : `mergeRemote` faisait l'union local+remote des amis et `pushCloud` est en pull-merge-push → un ami supprimé revenait dès qu'on quittait/revenait. Fix : tombstones `deletedFriends` (persistés local + cloud) — `removeFriend` en pose un, `mergeRemote` exclut tout ami tombstoné, `addFriend` lève le tombstone.

