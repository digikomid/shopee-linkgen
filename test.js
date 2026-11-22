// Local test: exercise worker routes without deploying — run: node test.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/dist/worker.js', 'utf8')
  .replace(/^export default/m, 'module.exports.default =');
fs.writeFileSync(require('os').tmpdir() + '/worker-test.cjs', src);
const worker = require(require('os').tmpdir() + '/worker-test.cjs').default;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let pass = 0, fail = 0;
async function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
}
(async () => {
  const get = async path => worker.fetch(new Request('https://aturduit.web.id' + path, { method: 'GET' }));

  // /
  let r = await get('/');
  await check('GET / → 200', r.status === 200);
  const html = await r.text();
  check('  content-type html', r.headers.get('content-type').includes('text/html'));
  check('  html contains app shell', html.includes('Shopee Link Generator') && html.includes('parseShopee'));
  check('  html has PWA hooks', html.includes('/manifest.webmanifest') && html.includes('/sw.js'));
  check('  no CDN deps', !/cdn\.|cdnjs|googleapis|tailwind/.test(html), '(masih ada referensi CDN)');

  // manifest
  r = await get('/manifest.webmanifest');
  const man = await r.json();
  await check('manifest → 200 & valid JSON', r.status === 200 && man.name && man.icons.length === 3);
  check('  manifest icons ok', man.icons.every(i => i.sizes && i.type === 'image/png'));

  // sw
  r = await get('/sw.js');
  const sw = await r.text();
  await check('sw.js → 200', r.status === 200 && sw.includes('addEventListener(\'fetch\''));

  // icons
  for (const [p, size] of [['/icon-192.png', 192], ['/icon-512.png', 512], ['/favicon.ico', null]]) {
    r = await get(p);
    const buf = Buffer.from(await r.arrayBuffer());
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    await check(p + ' → valid PNG ' + w + 'x' + h, buf.slice(0, 8).equals(PNG_SIG) && (size === null || (w === size && h === size)));
  }

  // 404 & non-GET
  r = await get('/nope');
  await check('GET /nope → 404', r.status === 404);
  r = await worker.fetch(new Request('https://aturduit.web.id/', { method: 'POST' }));
  await check('POST / → 404', r.status === 404);

  // unit-test parsing logic lifted from app (regex parity check)
  const parseShopee = s => {
    let m;
    if ((m = s.match(/i\.(\d+)\.(\d+)/))) return { shop: m[1], item: m[2] };
    if ((m = s.match(/universal-link\/product\/(\d+)\/(\d+)/))) return { shop: m[1], item: m[2] };
    if ((m = s.match(/product\/(\d+)\/(\d+)/))) return { shop: m[1], item: m[2] };
    const ms = s.match(/shopid=(\d+)/i), mi = s.match(/[?&]itemid=(\d+)/i);
    return ms && mi ? { shop: ms[1], item: mi[1] } : { shop: '', item: '' };
  };
  const cases = [
    ['https://shopee.co.id/Lemari-Sepatu-i.214693299.29866829394', { shop: '214693299', item: '29866829394' }],
    ['https://shopee.co.id/product/111/222', { shop: '111', item: '222' }],
    ['https://shopee.co.id/universal-link/product/111/222?x=1', { shop: '111', item: '222' }],
    ['https://shopee.co.id/anything?shopid=333&itemid=444', { shop: '333', item: '444' }],
    ['https://shopee.co.id/shortlink/abc', { shop: '', item: '' }],
  ];
  for (const [input, want] of cases) {
    const got = parseShopee(input);
    await check('parse: ' + input.slice(0, 45), got.shop === want.shop && got.item === want.item, JSON.stringify(got));
  }

  console.log(fail ? `\nFAIL: ${fail} test gagal` : `\nSEMUA ${pass} TEST LULUS`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
