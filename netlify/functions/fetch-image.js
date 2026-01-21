// Netlify Function: fetch-image
// Server-side proxy to fetch Firebase Storage images and return them with permissive CORS.
// This avoids browser CORS restrictions when we need the raw bytes for canvas processing.

export default async (request) => {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing url parameter', { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid url', { status: 400 });
    }

    // Allowlist: only proxy Firebase Storage download URLs for security.
    const allowedHosts = new Set([
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
    ]);

    if (!allowedHosts.has(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403 });
    }

    const upstream = await fetch(parsed.toString(), { redirect: 'follow' });
    if (!upstream.ok) {
      return new Response(`Upstream fetch failed: ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstream.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Cache a bit to reduce repeated fetches
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(`Error: ${err?.message || String(err)}`, { status: 500 });
  }
};

export const config = {
  path: '/.netlify/functions/fetch-image',
};

