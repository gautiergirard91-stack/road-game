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
      "$id": {
        ".read": true,
        ".write": "(auth == null && newData.exists()) || (auth != null && auth.uid == $id)"
      }
    },
    "analytics": {
      ".read": false,
      ".write": true
    },
    "challenges": {
      "$day": {
        ".read": true,
        ".write": "newData.exists() && newData.hasChildren(['pseudo','score','mode','date']) && newData.child('score').val() <= 1000000 && newData.child('pseudo').val().length <= 16"
      }
    }
  }
}
```

Puis activer **Firebase App Check** ou au minimum limiter les écritures (les règles ci-dessus bornent score et taille du pseudo). Ne jamais commiter de secret : `FIREBASE_DB_SECRET` reste vide en ligne (les règles remplacent le secret).

> Note : la racine `/.json` n'est **pas** lisible publiquement avec ces règles (c'est voulu). La pastille « serveur » du jeu teste donc la connexion via `/scores/.json?shallow=true` (nœud public) — ne pas « corriger » les règles en ouvrant la racine.

> Note classement : le jeu lit le nœud **entier** `/scores/<mode>.json` et trie côté client. **Ne pas utiliser `orderBy` en REST** : sans `.indexOn: ["score"]` dans les règles, Firebase renvoie **400** et le jeu retombe en mode local (symptôme : « on ne voit que son propre score »). Si tu veux un vrai tri serveur plus tard, ajoute `"scores": { ".indexOn": ["score"] }` dans les règles.

## 2bis. Diagnostic : « on ne voit que son propre score »

Symptôme : chaque joueur ne voit que ses scores (fallback local silencieux). Causes possibles, dans l'ordre :

0. **Aucun joueur n'a rempli pseudo + opt-in** : le jeu n'envoie un score au serveur que si un pseudo est défini ET la case « participer au classement » est cochée (modale pseudo). Sans ça, AUCUNE écriture n'est tentée et la base reste vide → tout le monde voit du local. Vérifier que les testeurs ont bien un pseudo + opt-in.

1. **Règles jamais publiées** : dans l'éditeur de règles RTDB, cliquer sur **Publier** (les règles « mode test » expirent après 30 jours et bloquent tout : lecture ET écriture).
2. **Lecture refusée** : ouvrir dans le navigateur `https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores.json` → doit répondre **200** (objet avec des données, ou `null` si vide). Si **401** : `".read": true` n'est pas effectif sur `scores`.
3. **Écriture refusée** : le jeu envoie `{pseudo, score, level, levelId, mode, date}` ; la règle exige `hasChildren(['pseudo','score','level','mode','date'])` + `score <= 1000000` + `pseudo <= 16` caractères. Un champ manquant ou un score > 1 000 000 → **403/400** → le score reste en local. Tester : `POST https://...app/scores/auto/test.json` avec ce JSON → 200 attendu.
4. **Racine non lisible = NORMAL** : `https://...app/.json` doit renvoyer **401** (c'est voulu, la racine n'est pas publique). Le jeu pingue `/scores/.json?shallow=true`.
5. **Depuis v1.3.27, le jeu affiche le diagnostic** : la ligne sous les filtres du classement indique `N score(s) chargé(s)` (source Firebase) ou l'erreur exacte (`⚠ HTTP 401 sur scores/auto — affichage local`). **Depuis v1.3.28**, si les envois sont refusés, la ligne affiche aussi `⚠ écriture HTTP 403 sur scores/auto — score gardé en local` (l'erreur d'écriture reste visible même après une lecture réussie). Plus besoin de deviner.

Vérification rapide en console (F12) : `fetch('https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores/auto.json').then(r=>r.status)` → `200` attendu.

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
- `/challenges/<dayKey>` : `{ pseudo, score, mode, date }` — classement du défi du jour (écriture validée, lecture publique).
- `/analytics/<event>` : événements agrégés (level_start, game_over, purchase, ad_watched, continue_purchased) — écriture seule.

## 5. Connexion avec un compte Google (sauvegarde cloud liée à un vrai compte)

Difficulté : **modérée** — aucun SDK ajouté : on utilise le bouton officiel **Google Identity Services** + l'API REST Firebase (`identitytoolkit` / `securetoken`), voir `js/auth.js`.

1. Console Firebase → **Authentication → Get started → Sign-in method → Google → Activer**. Copier le **Web client ID** (bloc « Web SDK configuration »).
2. **Project settings → Général** → copier la **Web API key**.
3. **Deux listes de domaines à remplir** (sinon erreur 400 `origin_mismatch` au clic sur le bouton Google) :
   - Firebase : Authentication → **Settings → Authorized domains** → ajouter `roadtap.uk` et `gautiergirard91-stack.github.io` ;
   - **Google Cloud Console** (console.cloud.google.com, même projet) → **API & Services → Credentials** → clic sur le client OAuth `…apps.googleusercontent.com` → **Authorized JavaScript origins** → ajouter `https://roadtap.uk`, `https://gautiergirard91-stack.github.io` (et `http://localhost:8080` pour les tests locaux). Les redirect URIs ne sont pas nécessaires (flux ID-token). Propagation : quelques minutes.
4. Remplir `FIREBASE_WEB_API_KEY` et `FIREBASE_OAUTH_CLIENT_ID` dans `js/config.js` (clés publiques, commitables).
5. Règles RTDB : le nœud `players` accepte désormais `(auth != null && auth.uid == $id)` (voir §2) — la sauvegarde cloud est keyed par **uid** quand Google est lié, sinon par pseudo (rétrocompatible).

Données reçues de Google : **uid, email, displayName** (dans le jeton). Le `refreshToken` reste en `localStorage` uniquement et n'est **jamais** envoyé à la base de données. Voir `PRIVACY.md`.

## 6. Facturation : rester à 0 €

- Les crédits d'essai (≈ 269 €) ne sont pas une facture ; la facturation à l'usage ne démarre qu'au-delà des quotas gratuits.
- **Gratuit à notre échelle** : RTDB (1 Gio stocké, 10 Gio/mois), Firebase Auth Google (quota mensuel gratuit), credentials OAuth (gratuits).
- **Verrouiller** : Cloud Console → Billing → Budgets & alerts → budget à **1 €** avec alerte e-mail (50 %/100 %).
- Option : repasser le projet en plan **Spark** (Firebase → Project settings → Usage and billing → Modify plan) — RTDB + Auth continuent gratuitement.
- Supprimer tout projet Cloud parasite créé par erreur (sélecteur de projet → Shut down) — ne JAMAIS arrêter `realtime-database-5fd49`.
- L'édition des origines OAuth se fait dans le projet Cloud **lié à `realtime-database-5fd49`** (n° 804737015370), pas dans un autre projet.

## 7. Sécurité de la clé API web (alerte GitHub « public leak »)

La clé `FIREBASE_WEB_API_KEY` (`AIzaSy…`) dans `js/config.js` est **publique by design** (elle identifie le projet, elle n'ouvre aucun accès — l'autorisation passe par les règles RTDB + App Check). GitHub Secret Scanning la signale quand même : c'est un faux positif connu.

- Le dépôt contient `.github/secret_scanning.yml` (`paths-ignore: ["js/config.js"]`) pour fermer l'alerte automatiquement ; fermer l'alerte déjà ouverte en **False positive** avec un lien vers `docs/SECURITY.md`.
- **Restreindre la clé quand même** (vrai verrou anti-abus) : Cloud Console (projet 804737015370) → API & Services → Credentials → clé `AIzaSy…` → API restrictions = API Firebase uniquement (Realtime Database, Identity Toolkit, Secure Token) + **HTTP referrers** : `https://roadtap.uk/*`, `https://gautiergirard91-stack.github.io/*`, `http://localhost:*/*` (ajouter `android-app://uk.roadtap.game` pour la future TWA).
- Ne JAMAIS commiter : `FIREBASE_DB_SECRET` (vide), compte de service (`private_key`), tokens. L'audit CI (section 10 de `tools/audit.mjs`) bloque tout vrai secret. Voir `docs/SECURITY.md`.
