// Vercel Serverless Function for converting MOV to MP4
// Uses FFmpeg WASM for client-side conversion (runs in browser)
// For server-side, we'll use a simpler approach: direct streaming with proper headers

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'eu13657.firebasestorage.app',
  'content-b7d4c.firebasestorage.app',
  // Allow both old and new bucket hostnames
  '*.firebasestorage.app',
]);

function withCors(headers: Record<string, string>) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      Object.entries(withCors({})).forEach(([k, v]) => res.setHeader(k, v));
      return res.end();
    }

    const videoUrl = String(req.query?.url || '');
    if (!videoUrl) {
      res.statusCode = 400;
      return res.end('Missing url parameter');
    }

    let parsed: URL;
    try {
      parsed = new URL(videoUrl);
    } catch {
      res.statusCode = 400;
      return res.end('Invalid url');
    }

    // Check if hostname is allowed (support wildcard for firebasestorage.app)
    const isAllowed = ALLOWED_HOSTS.has(parsed.hostname) || 
                     parsed.hostname.endsWith('.firebasestorage.app') ||
                     parsed.hostname.endsWith('.appspot.com');
    
    if (!isAllowed) {
      res.statusCode = 403;
      return res.end('Host not allowed');
    }

    // For now, return the original URL with instructions to use a conversion service
    // Real-time conversion requires FFmpeg which is heavy for serverless
    // Alternative: Use a service like Cloudinary, or client-side conversion
    
    // Check if it's a MOV file
    const isMov = parsed.pathname.toLowerCase().endsWith('.mov') || parsed.pathname.toLowerCase().endsWith('.qt');
    
    if (isMov) {
      // For MOV files, we'll serve them with MP4 MIME type and let the browser try
      // Many MOV files are H.264/MP4 compatible
      const rangeHeader = req.headers?.range as string | undefined;
      const upstream = await fetch(parsed.toString(), {
        redirect: 'follow',
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      });
      
      if (!upstream.ok) {
        res.statusCode = 502;
        return res.end(`Upstream fetch failed: ${upstream.status}`);
      }

      const contentLength = upstream.headers.get('content-length') || undefined;
      const contentRange = upstream.headers.get('content-range') || undefined;
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
      
      // Serve as MP4 (many MOV files are H.264 compatible)
      res.statusCode = upstream.status;
      Object.entries(withCors({
        'Content-Type': 'video/mp4', // Force MP4 MIME type
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
        'Accept-Ranges': acceptRanges,
        'Cache-Control': 'public, max-age=3600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      })).forEach(([k, v]) => res.setHeader(k, v));
      
      // Always stream video files to avoid memory issues
      if (upstream.body) {
        try {
          const webBody = upstream.body as unknown as ReadableStream<Uint8Array>;
          const nodeReadable = typeof (webBody as any).getReader === 'function'
            ? Readable.fromWeb(webBody as any)
            : (upstream.body as any);
          await pipeline(nodeReadable, res);
          return;
        } catch (streamErr: any) {
          console.error('Streaming error in convert-video:', streamErr);
          if (!res.headersSent) {
            res.statusCode = 500;
            return res.end(`Streaming error: ${streamErr?.message || String(streamErr)}`);
          }
          return res.end();
        }
      }
      
      // Fallback to buffer (shouldn't happen for videos, but just in case)
      try {
        const arrayBuffer = await upstream.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.end(buffer);
      } catch (bufferErr: any) {
        console.error('Buffer approach failed in convert-video:', bufferErr);
        res.statusCode = 500;
        return res.end(`Error: ${bufferErr?.message || String(bufferErr)}`);
      }
    }
    
    // Not a MOV file, return error
    res.statusCode = 400;
    return res.end('This endpoint is for MOV to MP4 conversion only');
  } catch (err: any) {
    console.error('Convert video error:', err);
    res.statusCode = 500;
    return res.end(`Error: ${err?.message || String(err)}`);
  }
}
