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
    
    const isMov = parsed.pathname.toLowerCase().endsWith('.mov') || parsed.pathname.toLowerCase().endsWith('.qt');
    
    if (isMov) {
      // For MOV files, stream with proper headers
      // Note: Full remuxing (moving moov atom) requires FFmpeg which isn't available
      // in Vercel serverless by default. For production remuxing, use:
      // - Cloud Run function with FFmpeg
      // - Cloudinary/Mux service
      // - Or pre-process files before upload
      
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
      
      // Get actual Content-Type from Firebase, but override to video/mp4 for MOV
      const upstreamContentType = upstream.headers.get('content-type') || '';
      const finalContentType = upstreamContentType.includes('quicktime') || upstreamContentType.includes('x-quicktime') 
        ? 'video/mp4' 
        : 'video/mp4'; // Always force MP4 for MOV files
      
      // Serve as MP4 - browsers can play H.264 MOV files as MP4
      res.statusCode = upstream.status;
      Object.entries(withCors({
        'Content-Type': finalContentType,
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
