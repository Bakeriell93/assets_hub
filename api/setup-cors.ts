// Vercel Serverless Function to automatically configure CORS for Firebase Storage bucket
// This can be called once to set up CORS configuration

import type { VercelRequest, VercelResponse } from '@vercel/node';

const BUCKET_NAME = 'eu13657';
const PROJECT_ID = 'content-b7d4c';

// CORS configuration
const CORS_CONFIG = [
  {
    origin: ['*'],
    method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
    maxAgeSeconds: 3600
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'Method not allowed. Use POST.' });
    }

    // Get access token from environment or use service account
    // For now, we'll use the REST API approach
    const accessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
    
    if (!accessToken) {
      // Try to get token using service account or default credentials
      res.statusCode = 500;
      return res.json({ 
        error: 'Google Cloud access token not configured',
        instructions: [
          '1. Go to Google Cloud Console: https://console.cloud.google.com/',
          '2. Select project: content-b7d4c',
          '3. Go to IAM & Admin > Service Accounts',
          '4. Create or select a service account with Storage Admin role',
          '5. Create a key (JSON) and add it to Vercel environment variables',
          '6. Or use: gcloud auth print-access-token and set GOOGLE_CLOUD_ACCESS_TOKEN'
        ]
      });
    }

    // Use Google Cloud Storage REST API to set CORS
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}?fields=cors`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cors: CORS_CONFIG
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.statusCode = response.status;
      return res.json({ 
        error: 'Failed to set CORS',
        details: errorText,
        status: response.status
      });
    }

    const result = await response.json();
    
    res.statusCode = 200;
    return res.json({
      success: true,
      message: 'CORS configuration set successfully',
      bucket: BUCKET_NAME,
      cors: result.cors || CORS_CONFIG
    });

  } catch (err: any) {
    console.error('CORS setup error:', err);
    res.statusCode = 500;
    return res.json({ 
      error: 'Internal server error',
      message: err?.message || String(err)
    });
  }
}
