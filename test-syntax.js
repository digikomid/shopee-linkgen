// Syntax-check semua <script> di app.html — run: node test-syntax.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/public/app.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error('no inline scripts found'); process.exit(1); }
let fail = 0;
scripts.forEach((src, i) => {
  try { new Function(src); console.log(`  ✓ script #${i + 1} (${src.length} chars) syntax OK`); }
  catch (e) { fail++; console.error(`  ✗ script #${i + 1}: ${e.message}`); }
});
console.log(fail ? `FAIL: ${fail} masalah` : 'SEMUA SYNTAX OK');
process.exit(fail ? 1 : 0);
