// Connexion "Google" sans SDK Firebase : Google Identity Services (bouton officiel)
// + API REST Firebase (identitytoolkit / securetoken). Zéro dépendance ajoutée.
import { FIREBASE_WEB_API_KEY, FIREBASE_OAUTH_CLIENT_ID, FIREBASE_PROJECT_ID, FIREBASE_AUTH_DOMAIN } from './config.js';

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

let gsiPromise = null;
function loadGsi() {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('chargement GIS impossible'));
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}

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

let gsiInitialized = false;
let lastAuthError = null;

export function getLastAuthError() {
  return lastAuthError;
}

// Rend le bouton officiel Google dans `container` ; la promesse est résolue avec la session
// { uid, idToken, refreshToken, email } au choix du compte, ou null si annulé/erreur.
export async function renderGoogleButton(container) {
  if (!isGoogleAuthConfigured() || !container) return Promise.resolve(null);
  await loadGsi();
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      if (!gsiInitialized) {
        gsiInitialized = true;
        window.google.accounts.id.initialize({
          client_id: FIREBASE_OAUTH_CLIENT_ID,
          callback: async (resp) => {
            if (!resp || !resp.credential) return done(null);
            try {
              done(await exchangeGoogleToken(resp.credential));
            } catch (err) {
              console.error('[auth] échange du jeton échoué:', err);
              done(null);
            }
          },
          error_callback: (err) => {
            console.error('[gis] erreur:', err);
            done(null);
          },
          cancel_on_tap_outside: true,
          auto_select: false,
        });
      }
      if (!container.dataset.rendered) {
        container.dataset.rendered = '1';
        window.google.accounts.id.renderButton(container, { theme: 'filled_blue', size: 'large', text: 'continue_with', width: 260 });
      }
      // PAS de timeout : on attend vraiment le choix du compte dans la popup
    } catch (err) {
      console.error('[auth] renderButton:', err);
      done(null);
    }
  });
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

// v1.3.33 : repli "popup" si le bouton GIS est bloqué (uBlock Origin, Privacy Badger, réseau
// d'entreprise…) : on charge le SDK Firebase officiel depuis gstatic par import dynamique
// d'URL (zéro build, zéro dépendance) et on fait signInWithPopup. Le jeton Firebase est
// obtenu directement via getIdToken() — plus besoin d'échange REST dans ce chemin.
let fbApp = null;
export async function signInWithPopupGoogle() {
  if (!isGoogleAuthConfigured()) throw new Error('Google Sign-In non configuré (clés manquantes dans js/config.js — voir docs/FIREBASE.md §5)');
  const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  if (!fbApp) {
    fbApp = appMod.initializeApp({
      apiKey: FIREBASE_WEB_API_KEY,
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
