// App Check (reCAPTCHA v3) pour la Realtime Database — sans SDK RTDB (on parle en REST).
// Principe : on charge firebase-app + firebase-app-check depuis gstatic (import dynamique,
// zéro build), on initialise App Check avec la SITE KEY (publique), et on pose le token
// en header "X-Firebase-AppCheck" sur CHAQUE appel REST vers *.firebasedatabase.app.
// Dégradé gracieux : si App Check est indisponible (hors ligne, gstatic bloqué, pas de clé),
// on n'ajoute aucun header — les appels passent tant que l'enforce n'est pas activé côté console.
import { FIREBASE_WEB_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_CHECK_SITE_KEY, FIREBASE_APP_ID } from './config.js';

const FB_MOD = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
const AC_MOD = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';

let initPromise = null;
let appCheckInstance = null;
let tokenProvider = null; // injectable pour les tests (tests/appcheck.test.mjs)
let fetchInstalled = false;
// v1.3.58 : état de debug pour expliquer « serveur injoignable » dans ⚙️ Paramètres
let lastTokenOk = null; // null = jamais tenté, true/false sinon
let lastAppCheckError = null;
// v1.3.62 : un getToken qui bloque ne doit JAMAIS bloquer les requêtes RTDB (timeout borné)
let tokenTimeoutMs = 4000;
export function _setTokenTimeoutMs(ms) { tokenTimeoutMs = ms; } // tests uniquement

export function isAppCheckEnabled() {
  return Boolean(FIREBASE_APP_CHECK_SITE_KEY);
}

// pour les tests uniquement
export function _setTokenProvider(fn) {
  tokenProvider = fn;
}

export async function initAppCheck() {
  if (!isAppCheckEnabled()) return null;
  // v1.3.63 : sans appId, l'échange de jeton App Check échoue (400 → throttled → 401 sous Enforce).
  // On échoue proprement et le diagnostic l'affiche.
  if (!FIREBASE_APP_ID) {
    lastAppCheckError = "FIREBASE_APP_ID manquant — copier l'ID d'application de l'app web (Firebase → Paramètres du projet → Vos applications) dans js/config.js";
    console.warn('[appcheck]', lastAppCheckError);
    return null;
  }
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const appMod = await import(FB_MOD);
      const acMod = await import(AC_MOD);
      const app = appMod.getApps().length
        ? appMod.getApp()
        : appMod.initializeApp({ apiKey: FIREBASE_WEB_API_KEY, appId: FIREBASE_APP_ID, authDomain: FIREBASE_AUTH_DOMAIN, projectId: FIREBASE_PROJECT_ID });
      appCheckInstance = acMod.initializeAppCheck(app, {
        // v1.3.34 : reCAPTCHA ENTERPRISE (Fraud Defense) — l'onboarding v3 est déprécié par Firebase
        provider: new acMod.ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY), // site key Enterprise, publique
        isTokenAutoRefreshEnabled: true,
      });
      return appCheckInstance;
    } catch (e) {
      console.warn('[appcheck] init impossible (hors ligne / gstatic bloqué ?):', (e && e.message) || e);
      lastAppCheckError = String((e && e.message) || e); // v1.3.58
      appCheckInstance = null;
      return null;
    }
  })();
  return initPromise;
}

// v1.3.69 : préchauffe le jeton App Check (1er getToken = cold start reCAPTCHA, parfois > 1 s) —
// sinon le 1er ping au chargement part SANS header -> 401 sous Enforce alors que tout va bien.
export async function warmAppCheck() {
  await appCheckHeader();
  return appCheckDebug();
}

// v1.3.58 : état lisible par l'UI (diagnostic serveur) — jamais de throw
export function appCheckDebug() {
  return {
    configured: isAppCheckEnabled(),
    appIdMissing: !FIREBASE_APP_ID, // v1.3.63
    appId: FIREBASE_APP_ID ? FIREBASE_APP_ID.slice(0, 14) + '…' : '', // masqué dans l'UI
    initAttempted: Boolean(initPromise),
    initialized: Boolean(appCheckInstance),
    tokenOk: lastTokenOk,
    lastError: lastAppCheckError,
  };
}

// Renvoie { 'X-Firebase-AppCheck': token } ou {} (jamais de throw)
export async function appCheckHeader() {
  // v1.3.62 : timeout borné — sans jeton on envoie quand même la requête (Enforce OFF) au lieu de pendre
  const withTimeout = (p) => Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('appcheck timeout (' + tokenTimeoutMs + 'ms)')), tokenTimeoutMs)),
  ]);
  if (tokenProvider) {
    try {
      const t = await withTimeout(tokenProvider());
      lastTokenOk = Boolean(t); // v1.3.58
      if (!t) lastAppCheckError = 'token vide (provider de test)';
      return t ? { 'X-Firebase-AppCheck': t } : {};
    } catch (e) {
      lastTokenOk = false; // v1.3.58
      lastAppCheckError = String((e && e.message) || e);
      return {};
    }
  }
  if (!isAppCheckEnabled()) return {};
  const ac = await initAppCheck();
  if (!ac) return {};
  try {
    const acMod = await import(AC_MOD);
    let token = null;
    try {
      ({ token } = await withTimeout(acMod.getToken(ac, false)));
    } catch {
      // v1.3.59 : token caché rejeté (expiration, domaine non autorisé…) -> on force UN refresh
      ({ token } = await withTimeout(acMod.getToken(ac, true)));
    }
    lastTokenOk = Boolean(token); // v1.3.58
    if (!token) lastAppCheckError = 'getToken a renvoyé un token vide';
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch (e) {
    lastTokenOk = false; // v1.3.58 — typiquement « domain not authorized » (roadtap.uk absent des domaines autorisés)
    lastAppCheckError = String((e && e.message) || e);
    return {};
  }
}

// Enveloppe globalThis.fetch : ajoute le header App Check UNIQUEMENT aux URL RTDB.
// Appelé une seule fois au démarrage (main.js). Les autres services (auth REST, gstatic…)
// ne sont pas touchés.
export function installAppCheckFetch() {
  if (fetchInstalled || typeof globalThis.fetch !== 'function') return;
  fetchInstalled = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && url.includes('firebasedatabase.app')) {
      const h = await appCheckHeader();
      const headers = new Headers(init.headers || {});
      for (const [k, v] of Object.entries(h)) headers.set(k, v);
      init = { ...init, headers };
    }
    return orig(input, init);
  };
}
