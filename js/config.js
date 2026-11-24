export const FIREBASE_DB_URL = 'https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app';
export const FIREBASE_DB_SECRET = '';
// Google Sign-In (voir docs/FIREBASE.md §5) — clés publiques, sans danger à commiter :
export const FIREBASE_WEB_API_KEY = 'AIzaSyCIFhp4tI-8pL9HG-fD9XIJfNLln5dBG9g'; // config de l'app web (AIzaSy…), publique
export const FIREBASE_OAUTH_CLIENT_ID = '804737015370-g2bocn49qv0hsjk00jd0pu84j4bpdg53.apps.googleusercontent.com'; // Auth → Google → Web SDK configuration → Web client ID (public)
// v1.3.33 : config de l'app Firebase pour le repli signInWithPopup (SDK chargé depuis gstatic, zéro build)
export const FIREBASE_PROJECT_ID = 'realtime-database-5fd49'; // Project settings → General → Project ID (public)
export const FIREBASE_AUTH_DOMAIN = 'realtime-database-5fd49.firebaseapp.com'; // Project settings → General → App → authDomain (public)
// v1.3.63 : ID D'APPLICATION de l'app web — OBLIGATOIRE pour App Check (l'échange de jeton reCAPTCHA
// se fait sur /projects/<project>/apps/<APP_ID> : sans lui, getToken renvoie 400 → throttled → 401 sous
// Enforce). À copier dans : Firebase console → ⚙️ Paramètres du projet → « Vos applications » →
// l'app web (realtime-database-5fd49.firebaseapp.com) → « ID d'application » (format 1:804737015370:web:…).
// Valeur publique (comme apiKey), commitable.
export const FIREBASE_APP_ID = '1:804737015370:web:52b8a2d52f7413127790b3'; // ID d'application de l'app web (renseigné v1.3.64 — public, comme l'apiKey)
export const VERSION = '1.3.71';
// App Check reCAPTCHA v3 — SITE KEY (publique, commitable ; la secret key reste côté console uniquement)
// App Check = reCAPTCHA ENTERPRISE (Fraud Defense) — Firebase ne prend plus les nouvelles clés v3.
// Site key Enterprise (publique) créée dans Cloud Console > reCAPTCHA Enterprise/Fraud Defense, type "score-based website", domaines: roadtap.uk, gautiergirard91-stack.github.io, localhost
// v1.3.60 : clé « roadtap ent » 6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW — c'est CELLE qui a
// roadtap.uk / gautiergirard91-stack.github.io / localhost dans ses domaines autorisés
// (Cloud Console > Sécurité > Fraud Defense > roadtap ent). L'ancienne clé 6LecyCwu… n'avait
// aucun domaine autorisé -> aucun jeton émis -> HTTP 401 sous Enforce (« configuration incomplète »).
// Elle doit AUSSI être la clé enregistrée dans Firebase > App Check > Apps pour l'app web.
export const FIREBASE_APP_CHECK_SITE_KEY = '6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW'; // site key ENTERPRISE « roadtap ent » (Fraud Defense), domaines autorisés OK
