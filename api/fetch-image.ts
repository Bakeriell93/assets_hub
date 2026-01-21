// Vercel Serverless Function (works for Vite static deploys on Vercel)
// Purpose: proxy Firebase Storage images through same-origin and enable CDN caching.
//
// Call: /api/fetch-image?url=<encoded_image_url>
// Restricts allowed hosts to prevent SSRF.

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function withCors(headers: Record<string, string>) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      Object.entries(withCors({})).forEach(([k, v]) => res.setHeader(k, v));
      return res.end();
    }

    const target = String(req.query?.url || '');
    if (!target) {
      res.statusCode = 400;
      return res.end('Missing url parameter');
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      res.statusCode = 400;
      return res.end('Invalid url');
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      res.statusCode = 403;
      return res.end('Host not allowed');
    }

    const upstream = await fetch(parsed.toString(), { redirect: 'follow' });
    if (!upstream.ok) {
      res.statusCode = 502;
      return res.end(`Upstream fetch failed: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // CDN caching on Vercel:
    // - Browser: cache for 1 hour
    // - Vercel Edge: cache for 1 day, SWR for 7 days
    res.statusCode = 200;
    Object.entries(withCors({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    })).forEach(([k, v]) => res.setHeader(k, v));

    return res.end(buffer);
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(`Error: ${err?.message || String(err)}`);
  }
}

