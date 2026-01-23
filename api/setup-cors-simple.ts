// Simple endpoint that provides instructions and a direct link to configure CORS
// Since we can't easily get Google Cloud credentials in Vercel without setup,
// this provides the easiest path forward

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CORS_JSON = {
    cors: [
      {
        origin: ['*'],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
        maxAgeSeconds: 3600
      }
    ]
  };

  if (req.method === 'GET') {
    // Return instructions and the CORS config
    res.statusCode = 200;
    return res.json({
      message: 'CORS Configuration Helper',
      instructions: {
        method1: {
          title: 'Using Google Cloud Shell (Easiest - No Installation)',
          steps: [
            '1. Go to: https://shell.cloud.google.com/',
            '2. Run: gcloud config set project content-b7d4c',
            '3. Run: gcloud auth login',
            '4. Copy the CORS config below and save it to a file called cors.json',
            '5. Run: gsutil cors set cors.json gs://eu13657',
            '6. Verify: gsutil cors get gs://eu13657'
          ]
        },
        method2: {
          title: 'Using Firebase Console (If Available)',
          steps: [
            '1. Go to: https://console.firebase.google.com/project/content-b7d4c/storage',
            '2. Click on bucket: eu13657',
            '3. Go to Settings or Permissions tab',
            '4. Look for CORS configuration',
            '5. Add the configuration below'
          ]
        }
      },
      corsConfig: CORS_JSON,
      downloadLink: '/api/setup-cors-simple?download=1'
    });
  }

  if (req.query.download === '1') {
    // Return CORS JSON file for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="cors.json"');
    res.statusCode = 200;
    return res.end(JSON.stringify(CORS_JSON.cors, null, 2));
  }

  res.statusCode = 200;
  return res.json({ message: 'Use GET to see instructions' });
}
