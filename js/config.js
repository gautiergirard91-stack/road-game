export const FIREBASE_DB_URL = 'https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app';
export const FIREBASE_DB_SECRET = '';
// Google Sign-In (voir docs/FIREBASE.md §5) — clés publiques, sans danger à commiter :
export const FIREBASE_WEB_API_KEY = 'AIzaSyCIFhp4tI-8pL9HG-fD9XIJfNLln5dBG9g'; // config de l'app web (AIzaSy…), publique
export const FIREBASE_OAUTH_CLIENT_ID = '804737015370-g2bocn49qv0hsjk00jd0pu84j4bpdg53.apps.googleusercontent.com'; // Auth → Google → Web SDK configuration → Web client ID (public)
// v1.3.33 : config de l'app Firebase pour le repli signInWithPopup (SDK chargé depuis gstatic, zéro build)
export const FIREBASE_PROJECT_ID = 'realtime-database-5fd49'; // Project settings → General → Project ID (public)
export const FIREBASE_AUTH_DOMAIN = 'realtime-database-5fd49.firebaseapp.com'; // Project settings → General → App → authDomain (public)
export const VERSION = '1.3.41';
// App Check reCAPTCHA v3 — SITE KEY (publique, commitable ; la secret key reste côté console uniquement)
// App Check = reCAPTCHA ENTERPRISE (Fraud Defense) — Firebase ne prend plus les nouvelles clés v3.
// Site key Enterprise (publique) créée dans Cloud Console > reCAPTCHA Enterprise/Fraud Defense, type "score-based website", domaines: roadtap.uk, gautiergirard91-stack.github.io, localhost
export const FIREBASE_APP_CHECK_SITE_KEY = '6LecyCwuAAAAAAjFj7BPiUGf7raomYz2mvjYOWxw'; // site key ENTERPRISE (Fraud Defense), enregistrée aussi dans Firebase > App Check > Apps
