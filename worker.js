// Cloudflare Worker: Shopee Link Generator (aturduit.web.id)
// Semua asset inline — satu file worker, tanpa KV/R2.
const HTML = `__APP_HTML__`;
const MANIFEST = `__MANIFEST__`;
const SW = `__SW__`;

function png(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const ICON192 = png(`__ICON192__`);
const ICON512 = png(`__ICON512__`);

const resp = (body, type, cache = 'public, max-age=86400') =>
  new Response(body, {
    headers: {
      'content-type': type,
      'cache-control': cache,
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });

const SHORT_ORIGIN = 'https://s.shopee.co.id';
const SHORT_PATH = /^\/([a-zA-Z0-9]{1,64})\/?$/;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
// Shopee sends server-like requests to an error page; this matches the browser redirect path.
const SHOPEE_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'id-ID,id;q=0.9',
};
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

async function resolveShortlink(token) {
  if (!token || !/^[a-zA-Z0-9]{1,64}$/.test(token)) return json({ error: 'invalid_token' }, 400);
  const signal = AbortSignal.timeout(5000);
  try {
    for (let hop = 0; hop < 3; hop++) {
      const source = SHORT_ORIGIN + '/' + token;
      const response = await fetch(source, { redirect: 'manual', signal, headers: SHOPEE_HEADERS, cache: 'no-store' });
      const location = response.headers.get('location');
      if (response.body) void response.body.cancel().catch(() => {});
      if (response.status >= 500 || response.status === 429 || response.status === 403) {
        return json({ error: 'shopee_unavailable' }, 502);
      }
      if (!REDIRECTS.has(response.status) || !location) break;
      const target = new URL(location, source);
      if (target.username || target.password) break;
      if (target.origin === 'https://shopee.co.id' || target.origin === 'https://www.shopee.co.id') {
        const ids = target.pathname.match(/^\/(?:universal-link\/product|product|opaanlp)\/(\d+)\/(\d+)\/?$/)
          || target.pathname.match(/(?:^|[-/])i\.(\d+)\.(\d+)\/?$/);
        const shop = ids?.[1] ?? target.searchParams.get('shopid');
        const item = ids?.[2] ?? target.searchParams.get('itemid');
        if (shop && item && /^\d{1,24}$/.test(shop) && /^\d{1,24}$/.test(item)) return json({ shop, item });
        break;
      }
      const next = target.origin === SHORT_ORIGIN && target.pathname.match(SHORT_PATH);
      if (!next || next[1] === token) break;
      token = next[1];
    }
    return json({ error: 'product_not_found' }, 422);
  } catch {
    return json({ error: 'shopee_unavailable' }, signal.aborted ? 504 : 502);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/api/resolve') {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      return resolveShortlink(url.searchParams.get('token'));
    }

    if (request.method === 'GET') {
      if (p === '/' || p === '/index.html' || p === '/app.html') {
        return resp(HTML, 'text/html;charset=UTF-8', 'no-cache');
      }
      if (p === '/manifest.webmanifest') return resp(MANIFEST, 'application/manifest+json');
      if (p === '/sw.js') return resp(SW, 'application/javascript', 'no-cache');
      if (p === '/icon-192.png') return resp(ICON192, 'image/png', 'public, max-age=604800');
      if (p === '/icon-512.png') return resp(ICON512, 'image/png', 'public, max-age=604800');
      if (p === '/favicon.ico') return resp(ICON192, 'image/png', 'public, max-age=604800');
    }

    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
};
