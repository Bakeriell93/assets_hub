// API endpoint to update Firebase Storage metadata for MOV files
// Call: /api/update-mov-metadata?path=content/filename.mov

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already done
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'content-b7d4c',
      // Note: You'll need to set these in Vercel environment variables
      // Or use Application Default Credentials in Cloud Run
    }),
    storageBucket: 'eu13657',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  const filePath = req.body?.path || req.query?.path;
  if (!filePath) {
    res.statusCode = 400;
    return res.end('Missing path parameter');
  }

  try {
    const storage = getStorage();
    const bucket = storage.bucket('eu13657');
    const file = bucket.file(filePath);

    // Update metadata
    await file.setMetadata({
      contentType: 'video/mp4',
      metadata: {
        ...(await file.getMetadata()).metadata,
        updatedAt: new Date().toISOString(),
      },
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, path: filePath }));
  } catch (err: any) {
    console.error('Update metadata error:', err);
    res.statusCode = 500;
    return res.end(`Error: ${err?.message || String(err)}`);
  }
}
