// Vercel Serverless Function to proxy uploads to Firebase Storage
// This bypasses CORS issues by uploading from the server side

import type { VercelRequest, VercelResponse } from '@vercel/node';

const BUCKET_NAME = 'eu13657';
const PROJECT_ID = 'content-b7d4c';

function withCors(headers: Record<string, string>) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      Object.entries(withCors({})).forEach(([k, v]) => res.setHeader(k, v));
      return res.end();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'Method not allowed' });
    }

    // Get file data from request
    const formData = req.body;
    const fileName = req.headers['x-file-name'] as string;
    const contentType = req.headers['x-content-type'] as string || 'application/octet-stream';
    const filePath = req.headers['x-file-path'] as string || `content/${Date.now()}-${fileName}`;

    if (!fileName || !formData) {
      res.statusCode = 400;
      return res.json({ error: 'Missing file name or data' });
    }

    // For now, return instructions on how to use Firebase Admin SDK
    // This would require setting up Firebase Admin SDK with service account
    res.statusCode = 501;
    return res.json({
      error: 'Server-side upload not yet implemented',
      message: 'CORS should be working now. Try:',
      steps: [
        '1. Wait 2-3 minutes for CORS to propagate',
        '2. Hard refresh browser (Ctrl+Shift+R)',
        '3. Clear browser cache',
        '4. Try uploading again'
      ],
      alternative: 'If still not working, we can implement server-side upload with Firebase Admin SDK'
    });

  } catch (err: any) {
    console.error('Upload proxy error:', err);
    res.statusCode = 500;
    return res.json({ error: err?.message || String(err) });
  }
}
