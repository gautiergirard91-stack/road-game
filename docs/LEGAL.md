# ⚖️ Protection juridique

## Documents fournis

- `LICENSE` (MIT) : code source ouvert.
- `PRIVACY.md` : politique de confidentialité à héberger et référencer dans la Play Console.

## À compléter avant publication (obligatoire côté Google Play)

1. **Politique de confidentialité** : héberger `PRIVACY.md` en ligne (ex. GitHub Pages : `https://<user>.github.io/road-game/PRIVACY.md`) et la référencer dans la Play Console. Points clés à maintenir à jour :
   - Données collectées : **pseudo** (si saisi) + **scores** envoyés sur Firebase (classement), **sauvegarde cloud** du profil (pièces, achats, records) si Firebase configuré.
   - Stockage local (`localStorage`) pour le reste ; aucun cookie, aucun traceur, aucune pub ciblée.
   - Hébergement Firebase : choisir la région **UE** (ex. `europe-west1`) pour le RGPD.
   - Droits RGPD : droit d'accès, de rectification et **à l'effacement** — prévoir une procédure (issue GitHub avec le pseudo, suppression sous 30 jours via la console Firebase).
2. **Conditions d'utilisation (CGU)** : à rédiger (âge minimum 3+ ou 7+, licence d'utilisation du jeu, achats cosmétiques non remboursables sauf obligation légale, comportement dans le classement : pseudo non conforme = modération/suppression).
3. **Classification d'âge** : via le questionnaire IARC de la Play Console → attendu **PEGI 3 / ESRB E** (aucune violence, aucun contenu sensible). Les pubs (si AdMob) doivent être adaptées à « tout public ».
4. **Monétisation conforme** : aucun achat influençant le gameplay (voir `docs/MONETIZATION.md`), achats in-app via Play Billing uniquement, pubs rewarded facultatives (jamais forcées), bannière jamais en jeu si ajoutée.
5. **Propriété intellectuelle** : nom « Road Tap Racer » et visuels sont originaux (générés) ; vérifier la disponibilité de la marque (recherche INPI / EUIPO) avant le lancement marketing.
6. **Mentions légales éditeur** : nom/prénom ou société, adresse, contact — à ajouter dans les CGU et la fiche store.

> Ce document est une check-list opérationnelle, pas un conseil juridique. Faire relire par un juriste avant mise en ligne publique si le projet monétise.
