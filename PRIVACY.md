# Politique de confidentialité — Road Tap Racer

**Dernière mise à jour : v1.3.29**

## Données de jeu (restent sur l'appareil)

Les données de jeu (pièces, niveaux débloqués, voitures, effets, records, succès, paramètres) sont stockées **uniquement sur l'appareil** du joueur, dans le stockage local du navigateur (`localStorage`). Elles ne quittent l'appareil que si le joueur choisit de se connecter à Google (sauvegarde cloud, voir ci-dessous). Le jeu fonctionne hors ligne après son premier chargement.

## Classement mondial (Firebase Realtime Database, europe-west1 Belgique)

Depuis la v1.3.29, un **pseudo est obligatoire** avant la première partie (modale forcée) et **tout score terminé est envoyé automatiquement** au classement public :

- `/scores/<mode>` : `{ pseudo, score, level, levelId, mode, date }` — **public en lecture**, écriture validée par les règles (pseudo ≤ 16 caractères, score borné). Le pseudo choisi est donc **visible publiquement** dans le classement. Aucun e-mail ni identifiant Google n'y est publié (sauf si le joueur les met dans son pseudo).
- `/challenges/<jour>` : idem pour le défi du jour.
- `/analytics/<event>` : événements agrégés et pseudonymes (démarrage de partie, fin de partie, achat cosmétique…) — écriture seule, jamais lus côté client.

Règles RTDB publiées dans `docs/FIREBASE.md` : la racine n'est pas lisible, les écritures sont validées/ bornées. Aucun secret n'est embarqué côté client (la clé API web Firebase est publique by design, restreinte aux API Firebase + domaines autorisés — voir `docs/SECURITY.md`).

## Sauvegarde cloud (optionnelle, via Google)

Si tu te connectes avec Google (bouton dans « ✏️ Mon pseudo »), nous recevons de Google ton **uid, e-mail et nom d'affichage** (via le jeton d'identification), utilisés uniquement pour keyer ta sauvegarde cloud (`players/<uid>`, lecture publique, écriture réservée au propriétaire) afin de la synchroniser entre tes appareils. Le jeton de rafraîchissement reste stocké **uniquement sur ton appareil** (localStorage) et n'est jamais transmis à la base. Tu peux te délier à tout moment (« 🔓 Se délier du compte Google »).

## Tes droits (RGPD)

- **Accès / rectification** : change ton pseudo dans le jeu ; tes scores sont visibles publiquement dans le classement.
- **Suppression** : vide les données du navigateur/appareil pour supprimer la sauvegarde locale ; pour supprimer `players/<uid>` et tes entrées de classement, ouvre une issue sur le dépôt GitHub (nous supprimons sous 30 jours). La suppression de l'app seule ne supprime pas les données serveur.
- **Aucune publicité comportementale, aucun traceur tiers, aucune vente de données.** Monétisation 100 % cosmétique, jamais pay-to-win.

Pour toute question : ouvrir une issue sur le dépôt GitHub du projet.
