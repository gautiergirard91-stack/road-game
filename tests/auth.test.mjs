import assert from 'node:assert/strict';

// Test headless de js/auth.js : échange de jeton (form-urlencoded = pas de preflight CORS),
// restauration de session, set/get du jeton. Le popup SDK (import dynamique gstatic) est
// testé manuellement en conditions réelles (bloqueur de pub, domaines autorisés…).

Object.defineProperty(globalThis, 'window', {
  value: { location: { origin: 'https://roadtap.uk' } },
  configurable: true,
});
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.document = {
  createElement: () => ({ async: true, defer: true, onload: null, onerror: null }),
  head: { appendChild() {} },
};

const auth = await import('../js/auth.js');

let passed = 0;
const ok = (name, cond) => {
  assert.ok(cond, name);
  passed++;
  console.log(`  ok - ${name}`);
};

ok('configuré (clés présentes dans js/config.js)', auth.isGoogleAuthConfigured() === true);

// --- exchangeGoogleToken : succès ---
let captured = null;
globalThis.fetch = async (url, opts) => {
  captured = { url: String(url), opts };
  return { ok: true, json: async () => ({ localId: 'uid1', idToken: 'fbtok', refreshToken: 'ref', email: 'a@b.c', displayName: 'A' }) };
};
const sess = await auth.exchangeGoogleToken('GOOGLE_CRED');
ok('échange OK -> session mappée (uid/idToken/refreshToken/email)', sess.uid === 'uid1' && sess.idToken === 'fbtok' && sess.refreshToken === 'ref' && sess.email === 'a@b.c');
ok('URL = identitytoolkit signInWithIdToken + clé API', captured.url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithIdToken?key='));
ok('body form-urlencoded (requête "simple" CORS, AUCUN preflight OPTIONS)', captured.opts.headers['Content-Type'] === 'application/x-www-form-urlencoded' && captured.opts.body.includes('postBody=') && captured.opts.body.includes('requestUri='));
ok('requestUri = origine du site (domaines autorisés requis)', captured.opts.body.includes(encodeURIComponent('https://roadtap.uk')));
ok('id_token présent et échappé dans le postBody', decodeURIComponent(captured.opts.body).includes('id_token=GOOGLE_CRED&providerId=google.com'));

// --- exchangeGoogleToken : erreur serveur -> throw avec le message Firebase ---
globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }) });
let threw = null;
try {
  await auth.exchangeGoogleToken('x');
} catch (e) {
  threw = e;
}
ok('échange KO -> throw avec le message serveur', threw && threw.message.includes('INVALID_ID_TOKEN'));

// --- restoreGoogleSession ---
globalThis.fetch = async () => ({ ok: true, json: async () => ({ user_id: 'uid9', id_token: 'tok', refresh_token: 'ref2', email: 'x@y.z' }) });
const r = await auth.restoreGoogleSession('REF');
ok('restore OK -> session mappée', r && r.uid === 'uid9' && r.idToken === 'tok' && r.refreshToken === 'ref2');
globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({}) });
ok('restore HTTP KO -> null', (await auth.restoreGoogleSession('REF')) === null);
globalThis.fetch = async () => {
  throw new Error('network down');
};
ok('restore réseau down -> null (pas de crash)', (await auth.restoreGoogleSession('REF')) === null);
ok('restore sans refreshToken -> null', (await auth.restoreGoogleSession('')) === null);

// --- jeton en mémoire ---
auth.setAuthToken('T');
ok('set/getAuthToken', auth.getAuthToken() === 'T');
auth.signOutGoogle();
ok('signOut vide le jeton', auth.getAuthToken() === null);

console.log(`\nOK - ${passed} assertions auth passent`);
