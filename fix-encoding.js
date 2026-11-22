// Terapkan fix pada app.html dengan encoding UTF-8 aman — run: node fix-encoding.js
const fs = require('fs');
const P = 'public/app.html';
let s = fs.readFileSync(P, 'utf8');

// Fix 1: rename const san -> sanitize (hindari duplicate identifier dengan function san)
s = s.replace('const san=v=>v.replace(/[\\s-]+/g,\'\').replace(/[^a-zA-Z0-9_]/g,\'\');',
              'const sanitize=v=>v.replace(/[\\s-]+/g,\'\').replace(/[^a-zA-Z0-9_]/g,\'\');');
s = s.replace('function san(el){const c=san(el.value);',
              'function san(el){const c=sanitize(el.value);');
s = s.split('san($(\'t\'+i).value)').join('sanitize($(\'t\'+i).value)');
s = s.split('san($(\'bT\'+i).value)').join('sanitize($(\'bT\'+i).value)');
s = s.split('parts[1]?san(parts[1])').join('parts[1]?sanitize(parts[1])');
s = s.split('parts[2]?san(parts[2])').join('parts[2]?sanitize(parts[2])');
s = s.split('parts[3]?san(parts[3])').join('parts[3]?sanitize(parts[3])');

// Fix 2: onclick handler match dengan nama fungsi
s = s.replace('onclick="saveAffiliateId()"', 'onclick="saveAffId()"');

fs.writeFileSync(P, s);

const ok = {
  'const sanitize=': s.includes('const sanitize=v=>'),
  'san(el) pakai sanitize': s.includes('function san(el){const c=sanitize'),
  'sanitize t+i': s.includes("sanitize($('t'+i).value)"),
  'sanitize bT+i': s.includes("sanitize($('bT'+i).value)"),
  'sanitize parts': s.includes('parts[1]?sanitize(parts[1])'),
  'saveAffId onclick': s.includes('onclick="saveAffId()"'),
  'const san hilang': !s.includes('const san=v=>'),
  'saveAffiliateId hilang': !s.includes('saveAffiliateId'),
  'emoji ok': /[\u{1F300}-\u{1FAFF}]/u.test(s),
  'em-dash ok': s.includes('\u2014'),
  'tanpa mojibake': !s.includes('\u00E2\u20AC\u201D'),
};
console.log(ok);
const fail = Object.values(ok).filter(v => !v).length;
process.exit(fail ? 1 : 0);
