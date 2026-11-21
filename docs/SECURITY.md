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
