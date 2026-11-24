# 📋 Rapport gameplay — Road Tap Racer (v1.3.77)

**Objectif** : un jeu **accessible à tout le monde** (débutants, enfants, seniors, handicaps moteurs/visuels/cognitifs, mobile bas de gamme) **et** avec une **profondeur compétitive** pour les joueurs de haut niveau (classements, speedrun, défis, anti-triche).
**Contrainte non négociable** : monétisation 100 % cosmétique (jamais pay-to-win).

**Méthode** : revue complète du gameplay par les 6 agents configurés dans `.vibe/agents/` — chaque section ci-dessous est le périmètre d'un agent (gameplay, contrôles, équilibrage, niveaux, polish, assets), avec pour chaque proposition : **quoi / pourquoi / différence vs actuel / priorité**.

Priorités : **P0** = faisable vite, fort impact accessibilité ou intégrité compétitive · **P1** = structurant, 1 PR chacun · **P2** = plus gros chantiers.

---

## 1. État des lieux (ce qui existe aujourd'hui)

| Domaine | Actuel (vérifié dans le code) |
|---|---|
| Boucle | Menu → niveaux (15 + Survie ∞ + Week-end) → partie (tap lignes aux roues) → écran de fin (score + chrono + double rang) → classements |
| Jugement | fenêtres `WINDOWS = { perfect: 45 ms, good: 100 ms, passable: 160 ms }`, combo sur PARFAIT, 3 vies (auto) / 5 (permisA/pilote), continuer = +2 s (v1.3.77) |
| Mode unique | score 🏁 + chrono ⏱ sur chaque partie ; raté = +0,5 s ; PARFAIT = +30 vitesse (plafond +80 %) (v1.3.77) |
| Voies | manuelles depuis v1.3.76 : swipe ←/⬅ = doubler, swipe →/➡ = revenir ; alerte ⚠ + crash « voiture de face » si on reste à gauche ; fenêtre d'action ~1,4 s+ (spawn lead ≥ 1050 px) |
| Classements | Firebase RTDB : score par difficulté/niveau, temps ⏱, réaction ⚡ ; tri Score/Temps/Réaction persisté ; amis ; rang affiché à l'écran de fin ; file hors-ligne |
| Progression | déblocage N après N-1 terminé, 3 monnaies (auto/permisA/pilote), boutique 100 % cosmétique (29 skins, 10 effets, 7 thèmes, 2 packs, 3 packs de sons), 27 succès, défi du jour, quêtes hebdo, série (streak), sauvegarde cloud |
| Accessibilité existante | mode daltonien (symboles sur lignes), fenêtres élargies (`wideWindows`, hors classement en ligne par diseño), zones tactiles haut/bas en option (défaut gauche/droite), touches/clavier personnalisables, sourdine musique/sons, pause auto quand l'onglet passe en arrière-plan |
| Tutoriel | 9 étapes (tap, PARFAIT, combo, raté, Permis A AV/AR, dépassement manuel, passage piéton, monnaies, fin) |
| Perf | canvas 60 fps, pas de shadowBlur en boucle (anti-freeze v1.3.65), SW network-first, musique ancrée sur les lignes (v1.3.76) |

**Constats transverses** : le jeu est solide et stable, mais (a) l'accessibilité est "optionnelle" et éparpillée, pas un mode pensé pour tous ; (b) la couche compétitive s'arrête au classement brut — pas de médailles, pas de tiers, pas de duel, et l'anti-triche reste global (score ≤ 1 000 000) sans validation par niveau.

---

## 2. Propositions par agent

### 🎮 Agent Gameplay

1. **Mode « Entraînement » (P0)** — un mode dédié, **hors classement** (comme `wideWindows`), avec vitesse réglable (0,5×/0,75×/1×) et vies infinies. *Pourquoi* : apprendre sans pression = accessibilité cognitive et moteur. *Différence* : aujourd'hui唯一 option d'aide = fenêtres élargies qui excluent du classement ; le mode entraînement est explicite,暂存 local, et n'affecte jamais le LB.
2. **Buffer d'input + coyote time (P1)** — garder en mémoire les 80–120 dernières ms de tap pour pardonner un tap légèrement tôt/tard (côté client uniquement, le jugement reste identique pour le LB). *Pourquoi* : latence tactile/écran variable = principale source de « ratés injustes » ressenties, surtout sur vieux téléphones. *Différence* : aujourd'hui un tap à 46 ms = BIEN même si le joueur visait PARFAIT ; avec buffer, le ressenti est juste sans changer les scores réels.
3. **Fantôme du record perso (P1)** — pendant la partie, afficher en transparence la position de ta meilleure tentative précédente sur le niveau (ligne fantôme du chrono/score). *Pourquoi* : objectif compétitif visible en permanence. *Différence* : aujourd'hui le record n'est visible qu'à l'écran de fin.
4. **Anti-triche par niveau (P0, règles RTDB)** — envoyer `lines` (nombre de lignes du niveau) dans l'entrée score, et ajouter dans `database.rules.json` : `newData.child('score').val() <= newData.child('lines').val() * 250` ; pour le temps : `timeMs >= lines * 400` (borne basse anti-bot). *Pourquoi* : le plafond global 1e6 est contournable sur un niveau court. *Différence* : validation par niveau côté serveur, sans changer le client.

### ⌨️ Agent Contrôles

5. **Calibration de latence (P1)** — écran de calibration : le joueur tape au rythme d'un métronome, le jeu mesure l'offset moyen et décale les fenêtres de jugement d'autant (stocké localement, jamais envoyé). *Pourquoi* : TV/écran tactile avec lag = ressenti injuste. *Différence* : aujourd'hui les fenêtres sont fixes (45/100/160 ms) pour tout le monde.
6. **Seuil de swipe réglable + zones tactiles agrandies (P0)** — option « gros doigts » (zones 60/40 au lieu de 50/50, seuil de swipe 25 px au lieu de 40). *Pourquoi* : accessibilité moteur. *Différence* : seuils hardcodés aujourd'hui.
7. **Vibration on/off + motifs haptiques (P1)** — réglage global + patterns distincts (PARFAIT = double pulsation, raté = longue). *Pourquoi* : certains utilisateurs désactivent la vibration (confort/santé), d'autres veulent du feedback. *Différence* : aujourd'hui vibration fixe (50 ms au raté).
8. **Mode gaucher (P2)** — inverse gauche/droite (zones et swipes). *Pourquoi* : ~10 % de gauchers. *Différence* : aujourd'hui pas d'option.

### ⚖️ Agent Équilibrage

9. **Courbe de difficulté lissée (P1)** — niveaux 6–15 : `gapMin` descend trop vite (350 → ~230) et `pDouble` monte à 0,4 ; lisser la courbe (ex. pDouble max 0,35, gapMin plancher 260) + playtests. *Pourquoi* : le « mur » du niveau 9-10 est la cause de départ classique. *Différence* : courbe actuelle plus raide en milieu de partie.
10. **Récompenses de paliers visibles (P2)** — afficher sur la carte du niveau la récompense de premier clear + les paliers de Survie ∞ (50 lignes = skin or…) pour donner des objectifs. *Pourquoi* : lisibilité de la progression. *Différence* : les bonus existent mais sont invisibles avant de les avoir.
11. **Fenêtres de jugement adaptatives (P2, option hors LB)** — en plus de `wideWindows`, un réglage 3 niveaux (standard / large / très large), toujours exclu du classement en ligne. *Pourquoi* : granularité au lieu du binaire. *Différence* : aujourd'hui binaire.

### 🗺️ Agent Niveaux

12. **Mini-« boss » tous les 5 niveaux (P2)** — niveaux 5/10/15 avec un pattern spécial (ex. densité maximale courte, ou slalom de voitures). *Pourquoi* : respiration et moments forts dans la progression. *Différence* : progression linéaire aujourd'hui.
13. **Niveau thématique hebdomadaire en plus du week-end (P2)** — un niveau supplémentaire samedi/dimanche avec un thème inédit (ex. pluie, néon intense) et un classement dédié. *Pourquoi* : rendez-vous hebdo compétitif. *Différence* : seul le « Week-end doré » existe (pièces ×2).
14. **Défis du jour plus variés (P1)** — ajouter 2 types : « 0 raté sur N lignes » (précision pure) et « combo max ≥ X ». *Pourquoi* : variété compétitive quotidienne. *Différence* : 5 types aujourd'hui (score/perfects/combo/overtakes/complete).

### ✨ Agent Polish

15. **Réduire les animations (P0)** — option « animations réduites » : pas de shake, pas de particules, pas de flash (photosensibilité), transitions raccourcies. *Pourquoi* : accessibilité visuelle/santé (épilepsie photosensible). *Différence* : aujourd'hui shake/popups/particules systématiques.
16. **Contraste élevé (P0)** — thème « contraste élevé » (fond noir pur, lignes blanches épaisses, texte plus gros). *Pourquoi* : basse vision. *Différence* : 7 thèmes existent, aucun haut contraste dédié.
17. **Taille de texte UI réglable (P0)** — petit/moyen/grand (scale CSS sur les textes d'interface, pas sur le canvas de jeu). *Pourquoi* : presbytie/petits écrans. *Différence* : taille fixe aujourd'hui.
18. **Écran de fin amélioré (P1)** — rang animé qui compte jusqu'à #N, confettis sur record, carte de score partageable (texte/image copiable : « 3136 pts · 0:14.13 · #2 sur Accélération 🏁 »). *Pourquoi* : viralité organique + satisfaction. *Différence* : écran de fin statique aujourd'hui.
19. **ARIA / lecteur d'écran (P1)** — labels ARIA sur les boutons/écrans clés et annonces des événements importants (record, palier). *Pourquoi* : le jeu est 100 % canvas → invisible aux lecteurs d'écran aujourd'hui. *Différence* : aujourd'hui quasi aucune sémantique.

### 🖼️ Agent Assets

20. **Saisons cosmétiques (P2)** — skins/thèmes d Halloween, Noël, été (via l'agent assets + prompts Flux/Scenario), vendus ou gagnés — toujours cosmétiques. *Pourquoi* : rétention + événements. *Différence* : 29 skins statiques aujourd'hui.
21. **Icône PWA saisonnière + jingle de victoire** (P2) — manifest dynamique selon la saison, jingle distinct. *Pourquoi* : identité. *Différence* : icône fixe, victoire = arpège générique.

---

## 3. Couche compétitive (haut niveau)

22. **Médailles 🥇🥈🥉 par niveau/difficulté (P0)** — déduites du rang dans le classement affiché (top 3 = médailles sur la carte du niveau + profil). *Pourquoi* : reconnaissance immédiate. *Différence* : aujourd'hui seul le rang brut à l'écran de fin.
23. **Tiers de rang (P1)** — Bronze → Argent → Or → Platine → Diamant → Légende, calculés sur la somme des rangs ou un score ELO-like simple (gain selon rang battu). *Pourquoi* : meta compétitive long terme. *Différence* : pas de tier aujourd'hui.
24. **Défis asynchrones entre amis (P1)** — « bats mon score sur le niveau X » : notification + bouton direct. *Pourquoi* : social compétitif sans temps réel. *Différence* : onglet amis en lecture seule aujourd'hui.
25. **Saison hebdomadaire (P2)** — classement hebdo à part (reset lundi), récompense cosmétique exclusive pour le top 10 %. *Pourquoi* : rendez-vous compétitif régulier. *Différence* : classements permanents aujourd'hui.
26. **Anti-triche renforcé (P0, avec #4)** — ajouter `lines` dans les entrées + bornes par niveau dans les règles ; logger les entrées wideWindows côté client déjà fait. *Pourquoi* : intégrité du classement = condition du compétitif sérieux. *Différence* : plafond global 1e6 seul aujourd'hui.

---

## 4. Roadmap proposée

| Priorité | Propositions | Impact |
|---|---|---|
| **P0** (rapide, fort impact) | #4 anti-triche par niveau (règles RTDB), #22 médailles, #6 gros doigts/swipe réglable, #15 animations réduites, #16 contraste élevé, #17 taille de texte | accessibilité immédiate + intégrité compétitive |
| **P1** (structurant) | #1 mode entraînement, #2 buffer d'input, #3 fantôme de record, #5 calibration latence, #7 vibration, #9 courbe lissée, #14 défis variés, #18 écran de fin + partage, #19 ARIA, #23 tiers, #24 duels amis | profondeur compétitive + accessibilité avancée |
| **P2** (chantiers) | #8 mode gaucher, #10 récompenses visibles, #11 fenêtres adaptatives, #12 boss tous les 5 niveaux, #13 niveau hebdo, #20 saisons cosmétiques, #21 icônes saisonnières, #25 saison hebdo | rétention long terme |

**Principes directeurs** : (1) toute aide à la difficulté (entraînement, ralenti, fenêtres larges, calibration) reste **hors classement en ligne** — l'accessibilité ne pénalise jamais la compétitivité et inversement ; (2) monétisation 100 % cosmétique (saisons = skins/thèmes/sons) ; (3) chaque changement passe les tests (`core`, `game.smoke`, `tutorial`, `break`, `audit`) + un 🔔 BLOC DE TEST manuel ; (4) incrémental : une PR par proposition P0/P1.

---

*Rapport produit le 2026-11-24 à partir de l'état v1.3.77 (main = v1.3.75 + PR #59 v1.3.76 et #60 v1.3.77 en attente de merge), par les agents gameplay / contrôles / équilibrage / niveaux / polish / assets (`.vibe/agents/`).*
