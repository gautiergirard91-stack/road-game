# 🔒 Sécurité — Road Tap Racer

## L'alerte GitHub « Google API Key — public leak » sur `js/config.js` : faux positif (mais on verrouille quand même)

La clé `FIREBASE_WEB_API_KEY` (`AIzaSy…`) commitée dans `js/config.js` est **publique by design** :
toute app web Firebase embarque sa clé dans le bundle client (doc Firebase officielle :
« API keys for Firebase services only *identify* your project and app — authorization is handled
through IAM, Security Rules and App Check »). **Elle n'accorde aucun accès aux données.**
GitHub Secret Scanning la signale quand même (pattern `AIzaSy…`) — c'est un faux positif connu.

### Ce qu'on a mis en place dans le dépôt
- `.github/secret_scanning.yml` → `paths-ignore: ["js/config.js"]` : l'alerte se ferme automatiquement
  (« ignored by configuration »). L'alerte déjà ouverte se ferme à la main :
  **Security and quality → Secret scanning → alerte → Close as → False positive**, avec le commentaire :
  « Firebase web API key, public by design. Restricted to Firebase APIs + HTTP referrers in Cloud Console. See docs/SECURITY.md »
- `tools/audit.mjs` (section 10, en CI) : **échoue** si un vrai secret apparaît dans le code
  (clé privée `-----BEGIN … PRIVATE KEY-----`, `"private_key"`, `"type": "service_account"`,
  ou une clé `AIzaSy…` ailleurs que dans `js/config.js`).

### Ce qu'il faut faire côté consoles (toi, une fois)

1. **Restreindre la clé** (le vrai verrou anti-abus) : console.cloud.google.com (projet `804737015370`,
   lié à `realtime-database-5fd49`) → **API & Services → Credentials** → ta clé `AIzaSyCIFhp4tI-…` :
   - **API restrictions** → « Restrict key » → laisser uniquement les API Firebase utiles :
     `Firebase Realtime Database API` (firebasedatabase.googleapis.com),
     `Identity Toolkit API` (identitytoolkit.googleapis.com),
     `Secure Token API` (securetoken.googleapis.com).
     (Les clés créées par Firebase sont déjà restreintes aux API Firebase par défaut — vérifier quand même.)
   - **Application restrictions** → « HTTP referrers » → ajouter :
     `https://roadtap.uk/*`, `https://gautiergirard91-stack.github.io/*`, `http://localhost:*/*`.
     ⚠️ Pour la future TWA Android, il faudra aussi ajouter `android-app://uk.roadtap.game`.
2. **Ne PAS rotater aveuglément** : pour une clé web Firebase, la rotation ne protège rien
   (la sécurité vient des règles, pas du secret de la clé). On peut créer une clé neuve plus tard
   si tu veux repartir de zéro — mais la restriction ci-dessus est ce qui compte.
3. **Budget Cloud à 1 €** (déjà noté dans FIREBASE.md §6) pour détecter toute conso anormale.
4. **App Check** (optionnel, recommandé avant le Play Store) : Firebase → App Check → enregistrer
   l'app web (reCAPTCHA v3) → passer RTDB en mode « enforce » après test. Ça bloque les scripts
   automatisés même avec la clé publique.

## Ce qui est public by design (commitable)
- `FIREBASE_WEB_API_KEY`, `FIREBASE_OAUTH_CLIENT_ID`, `FIREBASE_DB_URL` (identifiants projet/app).
- Le contenu de `scores`/`players`/`challenges` (lecture publique voulue, écriture validée par les règles).

## Ce qui ne doit JAMAIS être commité (vrai secret)
- `FIREBASE_DB_SECRET` (database secret admin) → **vide** dans `js/config.js`, reste vide en ligne.
- Toute clé de compte de service (`"type": "service_account"`, `private_key`, `-----BEGIN … PRIVATE KEY-----`).
- Les `refreshToken` Google des joueurs : stockés uniquement en `localStorage` local, **jamais** envoyés
  à la base (exclusion volontaire dans `store.snapshot()`).
- Clés de paiement/admob, tokens CI, etc.

Vérification rapide (déjà faite, propre) :
```bash
grep -rn "private_key\|BEGIN.*PRIVATE KEY\|service_account" js/ sw.js tests/ tools/ .github/ index.html
# -> aucune correspondance (seul "grant_type=refresh_token" = nom de paramètre OAuth, pas un token)
```

L'audit CI (section 10) refait ce scan à chaque push et bloque la PR si un vrai secret apparaît.

## Usurpation de pseudo & triche (audit v1.3.32)

**Avant v1.3.32** : le pseudo n'était qu'une chaîne libre — n'importe qui pouvait poster un score sous le pseudo d'un autre, et comme les push IDs sont publics (lecture ouverte), on pouvait même écraser (PUT) une entrée existante. `/players/<pseudo>` était aussi modifiable par n'importe qui (pseudo public).

**Depuis v1.3.32** (`database.rules.json`, à publier) :
- `.write` en **création seule** (`!data.exists()`) sur `scores`/`speedrun`/`challenges`/`analytics` : plus d'écrasement ni de suppression d'entrées existantes.
- Si le joueur est connecté Google, le client envoie `uid` + `?auth=<idToken>` et la règle exige `uid == auth.uid` : **usurpation impossible** pour les comptes liés.
- `players/<uid>` : lecture/écriture **uniquement** `auth.uid == $id` (plus de cloud keyed par pseudo).
- `.indexOn` posé pour de futurs tris serveur.
- App Check (reCAPTCHA v3) en mode **enforce** recommandé avant le Play Store pour bloquer les scripts même avec la clé publique.

**Risque résiduel** : un joueur anonyme peut encore ajouter une *nouvelle* ligne sous un pseudo existant (visible en doublon dans le classement). Parade si ça arrive : rendre l'auth Google obligatoire pour écrire (nœuds keyed par uid uniquement).

## Quand un joueur perd-il sa progression ?

- La sauvegarde vit en `localStorage` (clé `roadtap_save_v1`). **Perdue si** : effacement des données du navigateur/appareil, désinstallation sans cloud, navigation privée — **sauf si** compte Google lié : au démarrage, `players/<uid>` est rechargé et fusionné (max par champ, jamais de rollback).
- Le reset SW automatique (v1.3.30) ne touche **pas** `localStorage` : la progression survit.
- Sans Google : aucun backup cloud (volontaire, v1.3.32) — l'UI invite à lier Google pour la synchro.
- Changer de pseudo ne perd rien en local ; côté cloud, la sauvegarde est keyed par **uid** (stable même si le pseudo change).

## App Check (reCAPTCHA v3) sur RTDB — procédure (v1.3.34)

**Côté code (déjà en place)** : `js/appcheck.js` charge `firebase-app` + `firebase-app-check` depuis gstatic (import dynamique, zéro build), initialise App Check avec la **site key v3** (`FIREBASE_APP_CHECK_SITE_KEY` dans `js/config.js`, publique), et `installAppCheckFetch()` pose le header **`X-Firebase-AppCheck`** sur **chaque appel REST vers `*.firebasedatabase.app`** (scores/speedrun/challenges/players/analytics/ping). Dégradé gracieux : hors ligne ou gstatic bloqué → aucun header, aucun crash (tant que l'enforce n'est pas actif).

**Côté consoles (à faire une fois)** :
1. reCAPTCHA admin (google.com/recaptcha/admin) : clé **v3**, domaines `roadtap.uk`, `gautiergirard91-stack.github.io`, `localhost` → site key (dans le code) + **secret key (secrète, jamais commitée — l'audit CI la bloque)**.
2. Firebase console → Security > App Check → onglet **Apps** → enregistrer l'app web avec le provider **reCAPTCHA v3** + la secret key. (Si tu as enregistré la clé *Enterprise/Fraud Defense* à la place, utilise `ReCaptchaEnterpriseProvider` dans `appcheck.js` et la clé Enterprise — ne mélange pas les deux.)
3. Déployer le code (v1.3.34+) → les testeurs l'obtiennent automatiquement (sonde `version.json` + reset SW auto).
4. Firebase console → App Check → onglet **APIs** → vérifier que le trafic RTDB est « verified » (les vieux clients sans token apparaissent « unverified »).
5. **Enforce** : App Check → APIs → **Realtime Database** → Enforce (propagation ~15 min). Après : toute requête RTDB sans token valide est rejetée. Les règles `database.rules.json` ne changent pas (l'enforce RTDB est côté console).
6. localhost : enregistrer un *debug token* (App Check → Apps) et poser `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` en local.
7. Future TWA Android : enregistrer un 2ᵉ provider **Play Integrity** dans App Check → Apps avant d'enforcer pour Android.
