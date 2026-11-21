// Connexion "Google" sans SDK Firebase : Google Identity Services (bouton officiel)
// + API REST Firebase (identitytoolkit / securetoken). Zéro dépendance ajoutée.
import { FIREBASE_WEB_API_KEY, FIREBASE_OAUTH_CLIENT_ID } from './config.js';

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

// Échange le jeton Google (ID token) contre une session Firebase (REST, zéro SDK)
async function exchangeGoogleToken(googleIdToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdToken?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
      requestUri: window.location.origin,
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  if (!res.ok) throw new Error("Échec de l'échange du jeton Google");
  const data = await res.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    email: data.email || '',
    displayName: data.displayName || '',
  };
}

// Rend le bouton officiel Google dans `container` ; la promesse est résolue avec la session
// { uid, idToken, refreshToken, email } au clic, ou null si annulé/erreur.
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
      window.google.accounts.id.initialize({
        client_id: FIREBASE_OAUTH_CLIENT_ID,
        callback: async (resp) => {
          if (!resp || !resp.credential) return done(null);
          try {
            done(await exchangeGoogleToken(resp.credential));
          } catch {
            done(null);
          }
        },
      });
      window.google.accounts.id.renderButton(container, { theme: 'filled_blue', size: 'large', text: 'continue_with', width: 260 });
      // sécurité : si le callback ne vient jamais (bouton non cliqué), ne bloque pas
      setTimeout(() => done(null), 120000);
    } catch {
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
