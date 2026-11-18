# 🎨 Direction artistique & Level design

## Direction artistique

**Concept** : jeu de rythme minimaliste façon Piano Tiles, transposé à la conduite. Lisibilité avant tout : la ligne à toucher doit se lire en < 100 ms.

**Palette & style**
- Fond sombre UI (`#0d1226`) pour faire ressortir les éléments de jeu ; accents or `#ffd54a` (score, pièces) et cyan `#54f0ff` (éléments "système" : essieu AV, dépassement, pseudo).
- Route en aplats avec dégradé vertical subtil ; lignes blanches avec liseré sombre pour la lisibilité sur tous les thèmes.
- 7 thèmes de route : Autoroute, Ville, Désert, Neige, Nuit + déblocables Néon et Coucher de soleil. Chaque thème = ciel (dégradé), bas-côtés, décor latéral animé (arbres / immeubles / cactus / sapins / skyline + lampadaires), couleur de ligne.
- Voiture dessinée en vectoriel Canvas, 3 modèles (citadine / berline / sport) avec paliers de détail croissants selon le prix (dégradé carrosserie → rétroviseurs/jantes → bande de course), reflétant la progression cosmétique.
- Feedback instantané : popup coloré (PARFAIT or / BIEN vert / OK bleu / RATÉ rouge), flash de la ligne, secousse optionnelle, confettis, vibrations (15 ms PARFAIT, 50 ms raté), sons synthétisés WebAudio + musique 8-bit en boucle.

**Accessibilité** : fenêtres de timing élargies (±70/150/240 ms), symboles sur les lignes (triangle/rectangle/losange/cercle) pour le mode daltonien, pas de dépendance à la couleur seule.

## Level design

**Courbe de difficulté** (12 niveaux + Survie ∞) :

| Niv | Thème | Vitesse | Particularités |
|-----|-------|---------|----------------|
| 1–3 | Autoroute | 250→340 | parties courtes (15–20 lignes), lignes simples, doubles lignes |
| 4–5 | Ville | 340→380 | chevrons + **passages piétons** (piéton = arrêt auto) |
| 6–7 | Désert | 380→420 | bandes continues, doubles |
| 8–9 | Nuit | 420→470 | néons, trafic dense |
| 10–11 | Neige | 450→510 | tout type de balisage, espacement réduit |
| 12 | Nuit | 580 | Hyperdrive, doubles systématiques |
| ∞ | Survie | 300→720 (rampe) | génération procédurale infinie, écarts qui se resserrent |

**Difficultés** (s'appliquent à tous les niveaux) :
- **Auto école** : 3 vies, tap n'importe où.
- **Permis A** : 5 vies, chaque ligne se joue 2× indépendamment (roues AV = tap haut, AR = tap bas) — les guides AV/AR sont suffisamment écartés pour que les deux taps soient bien séparés dans le temps (pas de validation simultanée).
- **Pilote** : 5 vies, Permis A + voitures lentes devant : swipe ⬅ pour doubler (1 s de grâce, puis ralentissement, combos off, points ×0,2, arrêt = fin).

**Règles communes** : jugement PARFAIT ±45 / BIEN ±100 / OK ±160 ms ; combo ×(1 + 0,05·combo, max ×3) ; raté (ligne manquée ou clic vide) = −1 ❤️, 3ᵉ/5ᵉ raté = overlay continuer (pièces ou pub) ; pièces gagnées = score/8 + 3×PARFAIT + bonus complétion + **bonus de premier clear** (250 + 50×n° niveau) la première fois qu'un niveau est terminé.

**Rétention** : 10 succès avec récompenses en pièces, records par niveau, classement filtré par difficulté, sauvegarde cloud (Firebase) si pseudo défini.
