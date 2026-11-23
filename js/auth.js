// Connexion "Google" sans SDK Firebase : Google Identity Services (bouton officiel)
// + API REST Firebase (identitytoolkit / securetoken). Zéro dépendance ajoutée.
import { FIREBASE_WEB_API_KEY, FIREBASE_OAUTH_CLIENT_ID, FIREBASE_PROJECT_ID, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_ID } from './config.js';

let memIdToken = null; // jeton Firebase en mémoire (jamais persisté en clair côté cloud)

export function setAuthToken(t) {
  memIdToken = t || null;
}

export function getAuthToken() {
  return memIdToken;
}

export function isGoogleAuthConfigured() {
  return Boolean(FIREBASE_WEB_API_KEY && FIREBASE_OAUTH_CLIENT_ID);
}

// v1.3.38 : le bouton GIS one-tap (« Continuer en tant que … ») est RETIRÉ — il ne fonctionnait
// pas (et pouvait être bloqué par les extensions). UN SEUL bouton « 🔑 Connexion Google » :
// signInWithPopupGoogle() ci-dessous (SDK Firebase chargé depuis gstatic, zéro build).

// Échange le jeton Google (ID token) contre une session Firebase (REST, zéro SDK).
// exporté pour les tests (tests/auth.test.mjs).
// En form-urlencoded = requête "simple" CORS : AUCUN preflight OPTIONS (celui-ci renvoyait
// 404 sans Access-Control-Allow-Origin). La réponse POST renvoie ACAO:* si la clé est valide.
export async function exchangeGoogleToken(googleIdToken) {
  const body = new URLSearchParams({
    postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
    requestUri: window.location.origin,
    returnIdpCredential: 'true',
    returnSecureToken: 'true',
  });
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdToken?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const e = await res.json();
      if (e && e.error && e.error.message) msg = e.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Échange du jeton Google: ${msg} (clé API invalide ou API Identity Toolkit non activée ?)`);
  }
  const data = await res.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    email: data.email || '',
    displayName: data.displayName || '',
  };
}

// Restaure la session depuis le refreshToken (appelé au démarrage de l'app)
export async function restoreGoogleSession(refreshToken) {
  if (!isGoogleAuthConfigured() || !refreshToken) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      uid: data.user_id,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      email: data.email || '',
    };
  } catch {
    return null;
  }
}

export function signOutGoogle() {
  try {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  } catch {
    /* ignore */
  }
  memIdToken = null;
}

// v1.3.38 : UNIQUE chemin de connexion Google — on charge le SDK Firebase officiel depuis gstatic
// par import dynamique d'URL (zéro build, zéro dépendance) et on fait signInWithPopup.
// Le jeton Firebase est obtenu directement via getIdToken().
let fbApp = null;
export async function signInWithPopupGoogle() {
  if (!isGoogleAuthConfigured()) throw new Error('Google Sign-In non configuré (clés manquantes dans js/config.js — voir docs/FIREBASE.md §5)');
  const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  if (!fbApp) {
    fbApp = appMod.initializeApp({
      apiKey: FIREBASE_WEB_API_KEY,
      appId: FIREBASE_APP_ID || undefined, // v1.3.63 : ID d'application de l'app web (public)
      authDomain: FIREBASE_AUTH_DOMAIN,
      projectId: FIREBASE_PROJECT_ID,
    });
  }
  const auth = authMod.getAuth(fbApp);
  try {
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  } catch {
    /* persistance best-effort */
  }
  const cred = await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
  const user = cred.user;
  const idToken = await user.getIdToken();
  return {
    uid: user.uid,
    idToken,
    refreshToken: user.refreshToken || '',
    email: user.email || '',
    displayName: user.displayName || '',
  };
}
