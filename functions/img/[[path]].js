// Pages Function: proxy /img/* to R2 bucket via IMAGES binding
export async function onRequestGet(context) {
  const key = (context.params.path || []).join('/');
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await context.env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400, immutable');
  return new Response(obj.body, { headers });
}
