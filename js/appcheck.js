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
      appCheckInstance = null;
      return null;
    }
  })();
  return initPromise;
}

// Renvoie { 'X-Firebase-AppCheck': token } ou {} (jamais de throw)
export async function appCheckHeader() {
  if (tokenProvider) {
    try {
      const t = await tokenProvider();
      return t ? { 'X-Firebase-AppCheck': t } : {};
    } catch {
      return {};
    }
  }
  if (!isAppCheckEnabled()) return {};
  const ac = await initAppCheck();
  if (!ac) return {};
  try {
    const acMod = await import(AC_MOD);
    const { token } = await acMod.getToken(ac, false);
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
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
