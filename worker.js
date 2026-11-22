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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (request.method === 'GET') {
      if (p === '/' || p === '/index.html' || p === '/app.html') {
        return resp(HTML, 'text/html;charset=UTF-8', 'public, max-age=3600');
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
