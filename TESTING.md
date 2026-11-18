# 🔔 BLOC DE RAPPEL — à exécuter après CHAQUE mise à jour du jeu

> Ce fichier est le rappel permanent : dès qu'un commit est poussé sur
> `vibe/road-tap-pwa-264a24` (visible dans la PR #1), refais ce test rapide.

## 1. Arrêter l'ancien serveur

- Terminal encore ouvert → `Ctrl+C`
- Sinon, tuer le process sur le port 8080 :
  - **Windows (PowerShell)** : `Get-NetTCPConnection -LocalPort 8080 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`
  - **Mac/Linux** : `lsof -ti:8080 | xargs kill` (ou `pkill -f "http.server 8080"`)

## 2. Récupérer la dernière version et relancer

```bash
cd road-game
git pull origin vibe/road-tap-pwa-264a24
python3 -m http.server 8080
```

## 3. Ouvrir et vider le cache

- Navigateur : `http://localhost:8080` puis **Ctrl+Shift+R** (reload forcé, indispensable à cause du service worker)
- Téléphone (même Wi-Fi) : `http://<IP-du-PC>:8080` puis menu ⋮ → recharger la page / vider le cache du navigateur

## 4. Checklist de test (2 min)

- [ ] Le jeu se lance, le menu s'affiche
- [ ] Niveau 1 : tap sur les lignes → PARFAIT/BIEN/OK + combo
- [ ] Cœurs ❤️ dans le HUD : chaque ligne manquée en enlève un
- [ ] Au 3ᵉ raté → overlay « Continuer » (pièces 🪙 / pub 🎬 / abandonner)
- [ ] Après continue : ❤️ remis à fond, la partie reprend
- [ ] Boutique : acheter/équiper une voiture → les 3 modèles (citadine/berline/sport) ont une silhouette différente
- [ ] Effets visuels activés → traînée/confettis visibles en jeu
- [ ] Pièces et achats persistent après rechargement de la page
- [ ] Hors ligne : couper le réseau après 1er chargement → le jeu se relance
- [ ] Thèmes des niveaux débloqués (Ville, Désert, Nuit, Neige) : pas de bug d'affichage

## 5. Remonter un bug

Noter : comportement attendu / observé, appareil + navigateur, niveau concerné → je corrige sur la branche et la PR #1 se met à jour.
