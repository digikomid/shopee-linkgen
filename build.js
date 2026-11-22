// Build: embed assets into worker.js → dist/worker.js — run: node build.js
const fs = require('fs');
const path = require('path');

const root = __dirname;
const pub = path.join(root, 'public');
const read = f => fs.readFileSync(path.join(pub, f), 'utf8');

const html = read('app.html');
const manifest = read('manifest.webmanifest');
const sw = read('sw.js');
const i192 = fs.readFileSync(path.join(pub, 'icon-192.png')).toString('base64');
const i512 = fs.readFileSync(path.join(pub, 'icon-512.png')).toString('base64');

const tpl = fs.readFileSync(path.join(root, 'worker.js'), 'utf8');
// placeholder tokens are on their own line; safe embed even if content contains backticks/$
const out = tpl
  .replace(/`__APP_HTML__`/g, JSON.stringify(html))
  .replace(/`__MANIFEST__`/g, JSON.stringify(manifest))
  .replace(/`__SW__`/g, JSON.stringify(sw))
  .replace(/`__ICON192__`/g, JSON.stringify(i192))
  .replace(/`__ICON512__`/g, JSON.stringify(i512));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'worker.js'), out);
console.log('dist/worker.js', (out.length / 1024).toFixed(1) + ' KB');

// sanity: no leftover placeholders, valid-ish JS syntax check
if (/__APP_HTML__|__MANIFEST__|__SW__|__ICON192__|__ICON512__/.test(out)) {
  console.error('ERROR: leftover placeholder!'); process.exit(1);
}
new Function(out.replace(/^export default/m, 'const __d =')); // throws on syntax error
console.log('syntax OK');
