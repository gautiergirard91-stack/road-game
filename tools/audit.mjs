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

console.log(problems === 0 ? '✅ AUDIT STATIQUE: aucun problème trouvé' : `❌ ${problems} problème(s) trouvé(s)`);
process.exit(problems === 0 ? 0 : 1);
