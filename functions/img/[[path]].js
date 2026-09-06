// Pages Function: proxy /img/* to R2 with global edge cache + WebP negotiation
// Cache key includes Accept header so webp and original responses are cached separately.
const DAY = 86400;

async function shaHex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const key = (context.params.path || []).join('/');
  if (!key) return new Response('Not found', { status: 404 });

  const accept = (context.request.headers.get('accept') || '');
  const wantWebp = accept.includes('image/webp');
  const cache = caches.default;

  const cacheKey = new Request(context.request.url + (wantWebp ? '?__fmt=webp' : '?__fmt=orig'), {
    method: 'GET',
  });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let obj = null;
  let contentType = '';
  const ext = key.split('.').pop().toLowerCase();
  const raster = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];

  if (wantWebp && raster.includes(ext)) {
    const webpKey = key.replace(/\.[^.]+$/, '.webp');
    const alt = await context.env.IMAGES.get(webpKey);
    if (alt) { obj = alt; contentType = 'image/webp'; }
  }

  if (!obj) {
    obj = await context.env.IMAGES.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'avif') contentType = 'image/avif';
    else if (ext === 'svg') contentType = 'image/svg+xml';
    else contentType = 'application/octet-stream';
  }

  const buf = await obj.arrayBuffer();
  const etag = `"${await shaHex(new Uint8Array(buf))}"`;

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', `public, max-age=${DAY}, immutable`);
  headers.set('ETag', etag);
  if (contentType.startsWith('image/')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  const resp = new Response(buf, { headers });
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}
