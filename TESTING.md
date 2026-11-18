# 🔔 BLOC DE RAPPEL — checklist de test après CHAQUE mise à jour

> Dès qu'un commit est poussé sur `vibe/road-tap-pwa-264a24` (PR #1), refais ce test.

## 1. Arrêter l'ancien serveur

- Terminal encore ouvert → `Ctrl+C`
- Sinon : Windows PowerShell → `Get-NetTCPConnection -LocalPort 8080 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }` ; Mac/Linux → `lsof -ti:8080 | xargs kill`

## 2. Dernière version + serveur

```bash
cd road-game
git pull origin vibe/road-tap-pwa-264a24
python3 -m http.server 8080
```

## 3. Ouvrir + vider le cache

`http://localhost:8080` puis **Ctrl+Shift+R**. Téléphone (même Wi-Fi) : `http://<IP-du-PC>:8080`.

## 4. Checklist complète (~5 min)

### Base
- [ ] Menu s'affiche, boutons Jouer / Boutique / Classement / Aide / Son
- [ ] Niveau 1 : tap sur les lignes → PARFAIT/BIEN/OK + combo + popup de points
- [ ] **Clic dans le vide = −1 ❤️** (compteur en haut)
- [ ] Vies : **3 ❤️ en Auto école, 5 ❤️ en Permis A / Pilote**
- [ ] Au dernier raté → overlay Continuer (pièces 🪙 / pub 🎬 simulée / abandonner) ; après continue, les ❤️ sont remis à fond
- [ ] Pièces gagnées à la fin + achats persistants après rechargement
- [ ] Hors ligne : couper le réseau après 1er chargement → le jeu se relance

### Voiture & route
- [ ] Voiture sur la **voie de droite**, plus grosse et détaillée (dégradé, vitres, rétroviseurs, roues)
- [ ] **Voitures en sens inverse** sur la voie de gauche (visuelles)
- [ ] **Décor des côtés selon le thème** : arbres (autoroute), immeubles (ville), cactus (désert), sapins (neige), skyline + étoiles/lune (nuit), **lampadaires** partout (éclairés la nuit)

### Difficultés (sélecteur en haut de l'écran des niveaux)
- [ ] **Auto école** : tap n'importe où fonctionne
- [ ] **Permis A** : guides AV (cyan, haut) / AR (bas) ; **chaque ligne se joue 2 fois** : tap haut quand la ligne atteint AV, tap bas quand elle atteint AR — les deux sont indépendants (un seul touché = raté pour cet essieu, prefixé AV/AR dans le popup)
- [ ] **Pilote** : voiture devant → **swipe ⬅ (ou touche ⬅)** = **ta voiture glisse à gauche**, la doublée reste à droite, bonus DÉPASSEMENT ; sinon 1 s de grâce puis ralentissement (combos off, points ×0,2, « RALENTI ») puis 🚦 bouchon = fin de partie

### Ville (niveaux 4–5)
- [ ] **Passage piéton zébré** qui défile = **ligne à cliquer** comme les autres
- [ ] Piéton qui traverse → la voiture **s'arrête seule** (« 🚶 Laisse passer le piéton… »), aucune pénalité de combo/points, puis repart

### Boutique
- [ ] 8 voitures, 3 modèles (citadine/berline/sport) avec silhouettes différentes
- [ ] Paliers de détails : jantes à bâtons + reflet + pare-chocs + aileron à 600 🪙+, bande à 1200 🪙+
- [ ] 4 effets visuels (traînée, glow, secousse, confettis) activables

### Classement 🏆
- [ ] Pseudo (✏️) + case « apparaître dans le classement » : sans pseudo rien n'est soumis
- [ ] Après une partie (opt-in + pseudo) : le score apparaît dans la liste, soi-même surligné en cyan
- [ ] **Filtre par difficulté** (Tous / Auto école / Permis A / Pilote) : le score va dans la bonne section

### Correctifs récents
- [ ] **Menu principal scrollable** sur petit écran Firefox (tous les boutons visibles)
- [ ] Niveaux autoroute (1–3) plus courts → parties plus rapides
- [ ] **Bonus de premier clear** : finir un niveau pour la 1ʳᵉ fois crédite un bonus affiché « premier clear 🎉 »
- [ ] Permis A / Pilote : guides **AV et AR bien écartés** — impossible de valider les deux en même temps

### Nouveautés (tutoriel, succès, survie, météo, thèmes, accessibilité)
- [ ] **Tutoriel** au 1er lancement (4 étapes) + bouton 👶 Tutoriel dans le menu
- [ ] **🏅 Succès** : finir le niveau 1 → succès débloqué + pièces créditées (toast)
- [ ] **∞ Survie** en haut de la liste des niveaux : vitesse qui monte, le jeu continue indéfiniment
- [ ] Boutique : **effets météo** (🌧 pluie / ❄ neige) et **thèmes** (Néon, Coucher de soleil) achetables et appliquables
- [ ] Menu : 🎵 musique ON/OFF, ♿ accessibilité (fenêtres élargies → PARFAIT plus facile ; symboles sur les lignes en mode daltonien)
- [ ] CI : onglet « Actions » de la PR → le job `CI / test` est vert

## 5. Remonter un bug

Noter : attendu / observé, appareil + navigateur, niveau + difficulté → correction sur la branche, la PR #1 se met à jour.
