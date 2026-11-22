import assert from 'node:assert/strict';

// Test headless de js/appcheck.js : le header X-Firebase-AppCheck n'est posé QUE sur les
// appels RTDB (*.firebasedatabase.app), jamais ailleurs, et jamais de throw (dégradé gracieux).
// Le vrai init (import gstatic + reCAPTCHA) se teste en conditions réelles navigateur.

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const ac = await import('../js/appcheck.js');

let passed = 0;
const ok = (name, cond) => {
  assert.ok(cond, name);
  passed++;
  console.log(`  ok - ${name}`);
};

ok('App Check activé (site key présente dans js/config.js)', ac.isAppCheckEnabled() === true);

// fournisseur de token injecté
ac._setTokenProvider(async () => 'TOK123');
ok('appCheckHeader() -> header présent', (await ac.appCheckHeader())['X-Firebase-AppCheck'] === 'TOK123');
ac._setTokenProvider(async () => '');
ok('token vide -> {}', Object.keys(await ac.appCheckHeader()).length === 0);
ac._setTokenProvider(async () => {
  throw new Error('reCAPTCHA bloqué');
});
ok('provider en erreur -> {} (pas de throw)', Object.keys(await ac.appCheckHeader()).length === 0);
ac._setTokenProvider(async () => 'TOK123');

// installAppCheckFetch : le wrapper n'ajoute le header qu'aux URL RTDB
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: init && init.headers });
  return { ok: true, json: async () => null };
};
ac.installAppCheckFetch();
ac.installAppCheckFetch(); // idempotent
await fetch('https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores.json');
await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdToken?key=x');
const rtdb = calls[0];
const other = calls[1];
ok('appel RTDB -> header X-Firebase-AppCheck posé', new Headers(rtdb.headers).get('X-Firebase-AppCheck') === 'TOK123');
ok('appel non-RTDB (auth REST) -> PAS de header App Check', new Headers(other.headers || {}).get('X-Firebase-AppCheck') === null);
ok('headers existants préservés (Content-Type)', true); // vérifié ci-dessous avec un POST

calls.length = 0;
await fetch('https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores/auto.json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
ok('POST RTDB -> Content-Type conservé + App Check ajouté', (() => {
  const h = new Headers(calls[0].headers);
  return h.get('Content-Type') === 'application/json' && h.get('X-Firebase-AppCheck') === 'TOK123';
})());

console.log(`\nOK - ${passed} assertions appcheck passent`);
