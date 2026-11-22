// Local test: exercise worker routes without deploying — run: node test.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/dist/worker.js', 'utf8')
  .replace(/^export default/m, 'module.exports.default =');
const worker = new Function('module', src + '\nreturn module.exports.default;')({exports:{}});

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

  // Exercise the actual parser from the served app, not a duplicate.
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const {parseShopee, shortToken} = new Function('document', 'addEventListener', script + '\nreturn {parseShopee,shortToken};')({addEventListener(){}}, () => {});
  const resolver = '/api/resolve?token=';
  const nativeFetch = globalThis.fetch;
  const seen = [];
  let upstream = () => new Response(null, {status:301, headers:{location:'https://shopee.co.id/opaanlp/516321247/57368594802?utm_source=an_old'}});
  globalThis.fetch = async (url, options) => { seen.push({url, options}); return upstream(url); };
  try {
    r = await get(resolver+'8fU7mHeCPv');
    const ids = await r.json();
    check('shortlink -> only the two product IDs', r.status === 200 && JSON.stringify(ids) === '{"shop":"516321247","item":"57368594802"}');
    check('uses fixed HTTPS origin and manual redirect', seen.length === 1 && seen[0].url === 'https://s.shopee.co.id/8fU7mHeCPv' && seen[0].options.redirect === 'manual');
    check('sends browser request headers without cache', seen[0].options.cache === 'no-store' && seen[0].options.headers['user-agent'].includes('Chrome/') && seen[0].options.headers.accept.includes('text/html'));
    check('resolver response is not cached', r.headers.get('cache-control') === 'no-store');
    r = await get(resolver+encodeURIComponent('https://example.com/'));
    check('rejects malformed token before fetching', r.status === 400 && seen.length === 1);
    upstream = () => new Response(null, {status:302, headers:{location:'https://example.com/product/11/22'}});
    r = await get(resolver+'abc');
    check('external redirect is not followed or parsed', r.status === 422 && seen.length === 2);
    upstream = url => new Response(null, {status:302, headers:{location:url.endsWith('/abc')?'/def':'https://shopee.co.id/product/11/22'}});
    r = await get(resolver+'abc');
    check('relative shortlink hop resolves', r.status === 200 && (await r.json()).item === '22' && seen.at(-1).url === 'https://s.shopee.co.id/def');
    upstream = () => new Response(null, {status:403});
    r = await get(resolver+'abc');
    check('upstream block has its own error', r.status === 502 && (await r.json()).error === 'shopee_unavailable');
  } finally { globalThis.fetch = nativeFetch; }
  check('recognizes a shortlink with extra query', shortToken('https://s.shopee.co.id/8fU7mHeCPv?x=1') === '8fU7mHeCPv');
  check('rejects lookalike as a shortlink', !shortToken('https://s.shopee.co.id.example.com/8fU7mHeCPv'));
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
