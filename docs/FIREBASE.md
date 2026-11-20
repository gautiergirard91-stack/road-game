# 🔥 Configuration Firebase (classement mondial + sauvegarde cloud + analytics)

Le code est déjà prêt : `js/leaderboard.js` (classement par difficulté), `js/cloudsave.js` (sauvegarde du profil), `js/analytics.js` (événements). Tout est **inactif tant que `js/config.js` est vide** — le jeu fonctionne 100 % hors ligne sinon.

> Je ne peux pas créer le projet Firebase à ta place (il faut ton compte Google) : voici la procédure exacte, puis il suffit de remplir `js/config.js`.

## 1. Créer le projet (console.firebase.google.com, compte Google)

1. « Ajouter un projet » → nom ex. `road-tap-racer` → désactiver Google Analytics (optionnel).
2. **Realtime Database** → « Créer une base de données » → région **europe-west1 (Belgique)** (RGPD) → démarrer en **mode test**.
3. Copier l'URL de la base : `https://<projet>-default-rtdb.<region>.firebasedatabase.app` (visible dans les paramètres du projet).

## 2. Règles de sécurité (important)

En production, remplacer les règles de test par :

```json
{
  "rules": {
    "scores": {
      ".read": true,
      "$mode": {
        ".write": "newData.exists() && newData.hasChildren(['pseudo','score','level','mode','date']) && newData.child('score').val() <= 1000000 && newData.child('pseudo').val().length <= 16"
      }
    },
    "players": {
      "$pseudo": {
        ".read": true,
        ".write": "auth == null && newData.exists()"
      }
    },
    "analytics": {
      ".read": false,
      ".write": true
    }
  }
}
```

Puis activer **Firebase App Check** ou au minimum limiter les écritures (les règles ci-dessus bornent score et taille du pseudo). Ne jamais commiter de secret : `FIREBASE_DB_SECRET` reste vide en ligne (les règles remplacent le secret).

## 3. Remplir la config

Projet de production : `realtime-database-5fd49`, instance `realtime-database-5fd49-default-rtdb` (région **europe-west1**, Belgique).

Dans `js/config.js` :

```js
export const FIREBASE_DB_URL = 'https://<projet>-default-rtdb.europe-west1.firebasedatabase.app';
export const FIREBASE_DB_SECRET = '';
```

## 4. Publier

- Bumper `CACHE` dans `sw.js`, commit, push, déployer (GitHub Pages), rebuild la TWA si besoin.
- Vérifier : classement 🏆 affiche « Classement en ligne (Firebase) », un score avec pseudo + opt-in apparaît, la sauvegarde cloud se synchronise entre 2 appareils avec le même pseudo.

## Données envoyées (à déclarer dans la Play Console + PRIVACY.md)

- `/scores/<mode>` : `{ pseudo, score, level, mode, date }` — public en lecture.
- `/players/<pseudo>` : snapshot du profil (pièces, achats, records, succès) — lisible publiquement, modifiable uniquement via l'app.
- `/analytics/<event>` : événements agrégés (level_start, game_over, purchase, ad_watched, continue_purchased) — écriture seule.
