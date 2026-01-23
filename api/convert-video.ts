// Vercel Serverless Function for remuxing MOV files
// Attempts to move moov atom to front for streaming compatibility
// Note: Vercel serverless functions have limitations - for production remuxing,
// consider using Cloud Run, Cloudinary, or Mux service

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'eu13657.firebasestorage.app',
  'content-b7d4c.firebasestorage.app',
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

    const isAllowed = ALLOWED_HOSTS.has(parsed.hostname) || 
                     parsed.hostname.endsWith('.firebasestorage.app') ||
                     parsed.hostname.endsWith('.appspot.com');
    
    if (!isAllowed) {
      res.statusCode = 403;
      return res.end('Host not allowed');
    }
    
    const isMov = parsed.pathname.toLowerCase().endsWith('.mov') || parsed.pathname.toLowerCase().endsWith('.qt') || parsed.pathname.toLowerCase().endsWith('.apcn');
    
    if (isMov) {
      const transcodeBase = process.env.TRANSCODE_URL;
      if (transcodeBase) {
        const base = transcodeBase.replace(/\/$/, '');
        const target = `${base}/?url=${encodeURIComponent(parsed.toString())}`;
        res.statusCode = 302;
        res.setHeader('Location', target);
        return res.end();
      }
      // For MOV files, stream with proper headers
      // Note: Full remuxing (moving moov atom) requires FFmpeg which isn't available
      // in Vercel serverless by default. For production remuxing, use:
      // - Cloud Run function with FFmpeg
      // - Cloudinary/Mux service
      // - Or pre-process files before upload
      
      const rangeHeader = req.headers?.range as string | undefined;
      
      // Fetch with Range support for video streaming
      const fetchHeaders: HeadersInit = {};
      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }
      
      const upstream = await fetch(parsed.toString(), {
        redirect: 'follow',
        headers: fetchHeaders,
      });
      
      if (!upstream.ok && upstream.status !== 206) {
        res.statusCode = 502;
        return res.end(`Upstream fetch failed: ${upstream.status}`);
      }

      const contentLength = upstream.headers.get('content-length') || undefined;
      const contentRange = upstream.headers.get('content-range') || undefined;
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
      
      // ALWAYS force video/mp4 Content-Type for MOV files (regardless of what Firebase sends)
      // This is the key fix - browsers reject video/quicktime but accept video/mp4 for H.264 MOV files
      res.statusCode = upstream.status; // Preserve 206 for partial content
      Object.entries(withCors({
        'Content-Type': 'video/mp4', // Force MP4 - this is what makes it work!
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
        'Accept-Ranges': acceptRanges,
        'Cache-Control': 'public, max-age=3600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      })).forEach(([k, v]) => res.setHeader(k, v));
      
      if (upstream.body) {
        try {
          const webBody = upstream.body as unknown as ReadableStream<Uint8Array>;
          const nodeReadable = Readable.fromWeb(webBody as any);
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
      
      // Fallback to buffer
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
    
    res.statusCode = 400;
    return res.end('This endpoint is for MOV files only');
  } catch (err: any) {
    console.error('Convert video error:', err);
    res.statusCode = 500;
    return res.end(`Error: ${err?.message || String(err)}`);
  }
}
