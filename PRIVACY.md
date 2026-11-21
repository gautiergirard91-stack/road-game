# Politique de confidentialité — Road Tap Racer

**Dernière mise à jour : 2025**

Road Tap Racer ne collecte, ne transmet et ne partage **aucune donnée personnelle**.

- Aucune création de compte, aucune connexion réseau sortante depuis le jeu.
- Les données de jeu (pièces, niveaux débloqués, voitures, effets, records) sont stockées **uniquement sur l'appareil** du joueur, dans le stockage local du navigateur (`localStorage`). Elles ne quittent jamais l'appareil.
- Aucun traceur, aucune publicité, aucune analyse d'utilisation.
- Le jeu fonctionne hors ligne après son premier chargement.

En supprimant l'application ou en vidant les données du navigateur, toutes les données du jeu sont supprimées.

Pour toute question : ouvrir une issue sur le dépôt GitHub du projet.

## Connexion avec un compte Google (optionnelle)

Si tu te connectes avec Google (bouton dans « ✏️ Mon pseudo »), nous recevons de Google ton **uid, e-mail et nom d'affichage** (via le jeton d'identification), utilisés uniquement pour :
- keyed ta sauvegarde cloud (`players/<uid>`) afin de la synchroniser entre tes appareils ;
- t'identifier dans le classement si tu as un pseudo.

Le jeton de rafraîchissement reste stocké **uniquement sur ton appareil** (localStorage) et n'est jamais transmis à notre base. Tu peux te délier à tout moment (« Se délier du compte Google ») : la sauvegarde repasse sur ton pseudo local. Suppression des données : nous contacter à l'e-mail indiqué ci-dessus (nous supprimons `players/<uid>` sous 30 jours).
