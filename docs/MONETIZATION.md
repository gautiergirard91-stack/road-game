# 💰 Modèle de revenus — 100 % cosmétique, conforme Google Play

**Règle d'or** : aucun achat ne donne d'avantage en jeu (pas de niveaux, vies, points, power-ups acheatables). Le gameplay reste identique pour tous.

## Revenus actuels (gratuits)

- **Pièces gagnées en jouant** → boutique cosmétique (voitures détaillées par paliers, effets visuels, météo, thèmes de route).
- **Succès** avec récompenses en pièces (rétention gratuite).
- **Classement** (local ou Firebase) : rétention compétitive gratuite.

## Revenus payants / pubs (à activer avant ou après le lancement)

1. **Pub rewarded facultative** (déjà câblée) : proposée uniquement au dernier raté pour continuer la partie. En production : unité AdMob « Rewarded » branchée dans `js/ads.js` (voir §Firebase ci-dessous pour la config). Jamais forcée, jamais de power-up — seulement la survie.
2. **Achats in-app cosmétiques (Play Billing)** : packs premium — ex. « Pack Sport » (2 voitures détaillées + effet confettis), « Pack Météo » (pluie + neige), « Thème Néon/Coucher de soleil » (déjà en boutique à pièces ; version IAP directe pour les joueurs qui ne grind pas). Prix indicatifs : 0,99 € – 4,99 €.
3. **« Sans publicité » (IAP ~2,99 €)** : supprime uniquement la proposition de pub rewarded (le continue devient payant en pièces uniquement). Autorisé par Google car la pub reste facultative.
4. **Bannière** (optionnel, à éviter au lancement) : uniquement dans les menus, jamais pendant une partie.

## Projection très simple

Hypothèses prudentes : 10 000 téléchargements, 25 % de joueurs actifs jour 30, ARPPU 0,30 € (mix IAP + pubs) → ~750 €/mois à maturité. Le levier principal = rétention (succès, classement, Survie ∞) plutôt que monétisation agressive.

## Conformité

- Play Billing obligatoire pour tout achat numérique dans l'app Android.
- Politique « Designed for Families » si ciblage < 13 ans : pubs non ciblées, pas de collecte de données d'enfants.
- Remboursements gérés par Google ; CGU à jour (voir `docs/LEGAL.md`).
