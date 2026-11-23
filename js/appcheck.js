// App Check (reCAPTCHA v3) pour la Realtime Database — sans SDK RTDB (on parle en REST).
// Principe : on charge firebase-app + firebase-app-check depuis gstatic (import dynamique,
// zéro build), on initialise App Check avec la SITE KEY (publique), et on pose le token
// en header "X-Firebase-AppCheck" sur CHAQUE appel REST vers *.firebasedatabase.app.
// Dégradé gracieux : si App Check est indisponible (hors ligne, gstatic bloqué, pas de clé),
// on n'ajoute aucun header — les appels passent tant que l'enforce n'est pas activé côté console.
import { FIREBASE_WEB_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_CHECK_SITE_KEY } from './config.js';

const FB_MOD = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
const AC_MOD = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';

let initPromise = null;
let appCheckInstance = null;
let tokenProvider = null; // injectable pour les tests (tests/appcheck.test.mjs)
let fetchInstalled = false;
// v1.3.58 : état de debug pour expliquer « serveur injoignable » dans ⚙️ Paramètres
let lastTokenOk = null; // null = jamais tenté, true/false sinon
let lastAppCheckError = null;

export function isAppCheckEnabled() {
  return Boolean(FIREBASE_APP_CHECK_SITE_KEY);
}

// pour les tests uniquement
export function _setTokenProvider(fn) {
  tokenProvider = fn;
}

export async function initAppCheck() {
  if (!isAppCheckEnabled()) return null;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const appMod = await import(FB_MOD);
      const acMod = await import(AC_MOD);
      const app = appMod.getApps().length
        ? appMod.getApp()
        : appMod.initializeApp({ apiKey: FIREBASE_WEB_API_KEY, authDomain: FIREBASE_AUTH_DOMAIN, projectId: FIREBASE_PROJECT_ID });
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

// v1.3.58 : état lisible par l'UI (diagnostic serveur) — jamais de throw
export function appCheckDebug() {
  return {
    configured: isAppCheckEnabled(),
    initAttempted: Boolean(initPromise),
    initialized: Boolean(appCheckInstance),
    tokenOk: lastTokenOk,
    lastError: lastAppCheckError,
  };
}

// Renvoie { 'X-Firebase-AppCheck': token } ou {} (jamais de throw)
export async function appCheckHeader() {
  if (tokenProvider) {
    try {
      const t = await tokenProvider();
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
      ({ token } = await acMod.getToken(ac, false));
    } catch {
      // v1.3.59 : token caché rejeté (expiration, domaine non autorisé…) -> on force UN refresh
      ({ token } = await acMod.getToken(ac, true));
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
