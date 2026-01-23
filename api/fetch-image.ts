// Vercel Serverless Function (works for Vite static deploys on Vercel)
// Purpose: proxy Firebase Storage images through same-origin and enable CDN caching.
//
// Call: /api/fetch-image?url=<encoded_image_url>
// Restricts allowed hosts to prevent SSRF.

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  // Allow Firebase Storage bucket hostnames
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

    const isAllowedHost = ALLOWED_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith('.firebasestorage.app') ||
      parsed.hostname.endsWith('.appspot.com');
    if (!isAllowedHost) {
      res.statusCode = 403;
      return res.end('Host not allowed');
    }

    const rangeHeader = req.headers?.range as string | undefined;
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });
    if (!upstream.ok) {
      res.statusCode = 502;
      return res.end(`Upstream fetch failed: ${upstream.status}`);
    }

    // Detect content type from URL if not provided or if it's generic
    let contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    
    // If content type is generic or missing, detect from file extension
    if (contentType === 'application/octet-stream' || !contentType.includes('/')) {
      const urlPath = parsed.pathname.toLowerCase();
      const extension = urlPath.split('.').pop() || '';
      
      // Video MIME types - comprehensive list
      const videoMimeTypes: Record<string, string> = {
        // MP4 variants (widely supported)
        'mp4': 'video/mp4',
        'm4v': 'video/mp4',
        'm4a': 'video/mp4', // Sometimes used for video
        // WebM (open format, good browser support)
        'webm': 'video/webm',
        // OGG (open format)
        'ogg': 'video/ogg',
        'ogv': 'video/ogg',
        'ogm': 'video/ogg',
        // QuickTime/MOV - ALWAYS serve as MP4 (browsers can play H.264 MOV as MP4)
        'mov': 'video/mp4', // Force MP4 MIME type - browsers can play H.264 MOV files
        'qt': 'video/mp4',
        // AVI variants (limited browser support)
        'avi': 'video/x-msvideo',
        'divx': 'video/x-msvideo',
        // Windows Media (limited support)
        'wmv': 'video/x-ms-wmv',
        'asf': 'video/x-ms-asf',
        // Flash Video (deprecated but still seen)
        'flv': 'video/x-flv',
        'f4v': 'video/x-flv',
        // Matroska (limited support)
        'mkv': 'video/x-matroska',
        'mk3d': 'video/x-matroska',
        'mka': 'video/x-matroska',
        'mks': 'video/x-matroska',
        // Mobile formats
        '3gp': 'video/3gpp',
        '3g2': 'video/3gpp2',
        '3gpp': 'video/3gpp',
        '3gpp2': 'video/3gpp2',
        // Other formats
        'ts': 'video/mp2t', // MPEG transport stream
        'mts': 'video/mp2t',
        'm2ts': 'video/mp2t',
        'vob': 'video/dvd', // DVD video
        'rm': 'application/vnd.rn-realmedia',
        'rmvb': 'application/vnd.rn-realmedia-vbr',
        'swf': 'application/x-shockwave-flash',
      };
      
      // Image MIME types
      const imageMimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'bmp': 'image/bmp',
        'ico': 'image/x-icon',
      };
      
      if (videoMimeTypes[extension]) {
        contentType = videoMimeTypes[extension];
      } else if (imageMimeTypes[extension]) {
        contentType = imageMimeTypes[extension];
      }
    }
    
    const contentLength = upstream.headers.get('content-length') || undefined;
    const contentRange = upstream.headers.get('content-range') || undefined;
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    
    // Set headers first
    res.statusCode = upstream.status;
    Object.entries(withCors({
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'public, max-age=3600',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    })).forEach(([k, v]) => res.setHeader(k, v));
    
    // For videos and large files, always stream to avoid memory issues
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
    const isLargeFile = fileSize > 10 * 1024 * 1024; // 10MB threshold
    const isVideo = contentType.startsWith('video/');
    
    // Always stream videos and large files
    if ((isLargeFile || isVideo) && upstream.body) {
      const reader = upstream.body.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              return;
            }
            // Write chunk to response
            if (!res.headersSent) {
              // Headers should already be set, but check just in case
              res.write(Buffer.from(value));
            } else {
              res.write(Buffer.from(value));
            }
          }
        } catch (streamErr: any) {
          console.error('Streaming error:', streamErr);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(`Streaming error: ${streamErr?.message || String(streamErr)}`);
          } else {
            res.end();
          }
        }
      };
      
      return pump();
    }
    
    // For smaller files, use buffer approach
    try {
      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.end(buffer);
    } catch (bufferErr: any) {
      console.error('Buffer approach failed:', bufferErr);
      res.statusCode = 500;
      return res.end(`Error: ${bufferErr?.message || String(bufferErr)}`);
    }
  } catch (err: any) {
    res.statusCode = 500;
    return res.end(`Error: ${err?.message || String(err)}`);
  }
}

