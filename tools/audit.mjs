import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js'));

let problems = 0;

// 1) IDs référencés en JS mais absents du HTML
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/\$\('#([\w-]+)'\)/g)) {
    if (!ids.has(m[1])) { console.log(`❌ ${f}: $('#${m[1]}') sans élément dans index.html`); problems++; }
  }
  for (const m of src.matchAll(/getElementById\('([\w-]+)'\)/g)) {
    if (m[1] === 'fatal-error') continue; // créé dynamiquement par le gestionnaire d'erreur global (v1.3.24)
    if (!ids.has(m[1])) { console.log(`❌ ${f}: getElementById('${m[1]}') sans élément`); problems++; }
  }
  for (const m of src.matchAll(/querySelector\('#([\w-]+)/g)) {
    if (!ids.has(m[1])) { console.log(`❌ ${f}: querySelector('#${m[1]}') sans élément`); problems++; }
  }
}

// 2) imports { ... } vs exports du module cible
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/import\s+(?:type\s+)?{([^}]+)}\s*from\s*'(\.\/[\w./-]+)'/g)) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const targetPath = path.join(root, 'js', m[2]);
    if (!fs.existsSync(targetPath)) { console.log(`❌ ${f}: importe depuis ${m[2]} qui n'existe pas`); problems++; continue; }
    const target = fs.readFileSync(targetPath, 'utf8');
    for (const n of names) {
      const ok = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${n}\\b`).test(target)
        || new RegExp(`export\\s*{[^}]*\\b${n}\\b[^}]*}`).test(target);
      if (!ok) { console.log(`❌ ${f}: '${n}' importé depuis ${m[2]} mais pas exporté`); problems++; }
    }
  }
}

// 3) assets listés dans sw.js existent-ils ?
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assetMatch = sw.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\]/);
if (assetMatch) {
  for (const m of assetMatch[1].matchAll(/'([^']+)'/g)) {
    const p = m[1].replace(/^\//, '');
    if (!fs.existsSync(path.join(root, p))) { console.log(`❌ sw.js: asset manquant '${m[1]}'`); problems++; }
  }
}

// 3b) chaque module js/ doit être dans ASSETS du SW (sinon crash hors-ligne, cf v1.3.23 auth.js)
for (const f of jsFiles) {
  if (!sw.includes(`'./js/${f}'`)) {
    console.log(`❌ sw.js ASSETS: js/${f} manquant (le jeu planterait hors-ligne)`);
    problems++;
  }
}

// 4) fichiers référencés par index.html (script/link/manifest) existent
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const p = m[1];
  if (p.startsWith('http') || p.startsWith('data:')) continue;
  if (!fs.existsSync(path.join(root, p))) { console.log(`❌ index.html référence un fichier absent: ${p}`); problems++; }
}

// 5) manifeste : icônes existantes
const mani = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const ic of mani.icons || []) {
  if (!fs.existsSync(path.join(root, ic.src.replace(/^\//, '')))) { console.log(`❌ manifest icône manquante: ${ic.src}`); problems++; }
}

// 6) TODO/FIXME/console.log oubliés
for (const f of [...jsFiles.map((f) => 'js/' + f), 'sw.js']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/\/\/\s*(TODO|FIXME|XXX)/g)) { console.log(`⚠️ ${f}: ${m[0]}`); }
}

// 7) clés localStorage cohérentes
const keys = new Set();
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\('([^']+)'/g)) keys.add(m[1]);
  // clés passées via une constante (ex: const KEY = '...')
  const consts = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*'([^']+)'/g)) consts[m[1]] = m[2];
  for (const m of src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\((\w+)\)/g)) {
    if (consts[m[1]]) keys.add(consts[m[1]]);
  }
}
console.log('🔑 clés localStorage:', [...keys].join(', '));

// 8) parse ESM fiable de chaque module — `node --check file.js` rate des SyntaxError ESM,
//    donc on parse via stdin en mode module (attrape les template literals cassés, etc.)
const parseFiles = [
  ...jsFiles.map((f) => 'js/' + f),
  'sw.js',
  ...fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.mjs')).map((f) => 'tests/' + f),
];
for (const f of parseFiles) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: fs.readFileSync(path.join(root, f), 'utf8'),
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    const first = String(r.stderr).split('\n').find((l) => l.trim()) || '';
    console.log(`❌ ${f}: SyntaxError ESM — ${first}`);
    problems++;
  }
}

// 9) workflows GitHub : un `name:` non quoté contenant ": " casse tout le workflow
//    (v1.3.28 : la CI est devenue rouge à cause d'un name avec ": " — plus de jobs lancés)
const wfDir = path.join(root, '.github', 'workflows');
if (fs.existsSync(wfDir)) {
  for (const f of fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const src = fs.readFileSync(path.join(wfDir, f), 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      const m = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
      if (!m) continue;
      const v = m[1];
      const quoted = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
      if (!quoted && /:\s/.test(v)) {
        console.log(`❌ .github/workflows/${f}:${i + 1}: name non quoté contenant ": " -> workflow invalide (${v.slice(0, 60)}...)`);
        problems++;
      }
    }
  }
}

// 10) vrais secrets jamais commités — la clé web Firebase (AIzaSy…) dans js/config.js est
//     PUBLIQUE BY DESIGN (docs/SECURITY.md, .github/secret_scanning.yml) ; tout le reste échoue.
{
  const codeFiles = [
    ...jsFiles.map((f) => 'js/' + f),
    'sw.js',
    ...fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.mjs')).map((f) => 'tests/' + f),
    ...fs.readdirSync(path.join(root, 'tools')).filter((f) => f.endsWith('.mjs') && f !== 'audit.mjs').map((f) => 'tools/' + f),
  ];
  const wf = path.join(root, '.github', 'workflows');
  if (fs.existsSync(wf)) for (const f of fs.readdirSync(wf)) codeFiles.push('.github/workflows/' + f);
  const keyRe = /AIzaSy[\w-]{30,}/g;
  const secretRes = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"private_key"\s*:/, /"type"\s*:\s*"service_account"/];
  for (const f of codeFiles) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(keyRe)) {
      if (f !== 'js/config.js') {
        console.log(`❌ ${f}: clé API Google hors js/config.js (${m[0].slice(0, 10)}…)`);
        problems++;
      }
    }
    for (const re of secretRes) {
      if (re.test(src)) {
        console.log(`❌ ${f}: VRAI SECRET détecté (${re.source.slice(0, 40)}…) — ne jamais commiter ça`);
        problems++;
      }
    }
  }
}

// 11) version.json (sonde anti-SW-obsolète, JAMAIS cachée par le SW) doit matcher VERSION de js/config.js
try {
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  const cfg = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
  const m = cfg.match(/VERSION\s*=\s*'([^']+)'/);
  if (!m || vj.version !== m[1]) {
    console.log(`❌ version.json (${vj.version}) != VERSION de js/config.js (${m ? m[1] : '??'}) — bumper les deux ensemble à chaque déploiement`);
    problems++;
  }
} catch (e) {
  console.log(`❌ version.json illisible: ${e.message}`);
  problems++;
}

// 12) database.rules.json : règles RTDB verrouillées (anti-usurpation v1.3.32) — vérifiées en CI
try {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8')).rules;
  for (const node of ['scores', 'speedrun', 'challenges']) {
    const child = Object.keys(rules[node] || {}).find((k) => k.startsWith('$'));
    const idLevel = child && rules[node][child] ? Object.keys(rules[node][child]).find((k) => k.startsWith('$')) : null;
    const write = idLevel && rules[node][child][idLevel] && rules[node][child][idLevel]['.write'];
    if (!write || !write.includes('!data.exists()')) {
      console.log(`❌ database.rules.json: ${node} — .write au niveau $id doit contenir "!data.exists()" (création seule, anti-écrasement)`);
      problems++;
    }
    if (!write || !write.includes('auth.uid')) {
      console.log(`❌ database.rules.json: ${node} — .write doit lier uid à auth.uid quand connecté (anti-usurpation)`);
      problems++;
    }
  }
  const pWrite = rules.players && rules.players.$id && rules.players.$id['.write'];
  if (!pWrite || !pWrite.includes('auth != null') || !pWrite.includes('auth.uid == $id')) {
    console.log('❌ database.rules.json: players doit exiger auth != null && auth.uid == $id');
    problems++;
  }
  const idx = rules.scores && rules.scores.$mode && rules.scores.$mode['.indexOn'];
  if (!idx || !idx.includes('score')) {
    console.log('❌ database.rules.json: scores.$mode doit avoir .indexOn ["score"]');
    problems++;
  }
} catch (e) {
  console.log(`❌ database.rules.json illisible/invalide: ${e.message}`);
  problems++;
}

console.log(problems === 0 ? '✅ AUDIT STATIQUE: aucun problème trouvé' : `❌ ${problems} problème(s) trouvé(s)`);
process.exit(problems === 0 ? 0 : 1);
