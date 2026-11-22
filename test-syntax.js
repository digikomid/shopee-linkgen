// Syntax-check semua <script> di app.html + cek handler onclick terdefinisi — run: node test-syntax.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/public/app.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error('no inline scripts found'); process.exit(1); }
let fail = 0;
const defined = new Set(['open', 'event']); // built-in
scripts.forEach((src, i) => {
  try { new Function(src); console.log(`  ✓ script #${i + 1} (${src.length} chars) syntax OK`); }
  catch (e) { fail++; console.error(`  ✗ script #${i + 1}: ${e.message}`); }
  for (const m of src.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/g)) defined.add(m[1] || m[2]);
});
// semua handler on* di HTML harus ada definisinya (kecuali built-in)
for (const m of html.matchAll(/on(?:click|input|change|keydown)="(?:if\(event[^)]*\))?([A-Za-z_$][\w$]*)\(/g)) {
  if (!defined.has(m[1])) { fail++; console.error(`  ✗ handler "${m[1]}" dipakai di HTML tapi tidak terdefinisi`); }
}
console.log(fail ? `FAIL: ${fail} masalah` : 'SEMUA SYNTAX & HANDLER OK');
process.exit(fail ? 1 : 0);
