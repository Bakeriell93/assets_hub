import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'If-None-Match');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get real IP from request headers (Vercel provides this)
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwarded) 
      ? forwarded[0] 
      : forwarded?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] 
      || req.socket.remoteAddress 
      || 'unknown';

    // Use free IP geolocation API (ipapi.co)
    // Fallback to ip-api.com if needed
    let location = 'Unknown Location';
    let ip = String(realIp);

    // Try multiple geolocation services for better reliability
    const geoApis = [
      // ipapi.co (free tier: 1000/day)
      async () => {
        const res = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { 'User-Agent': 'BYD-Assets-Hub/1.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.city && data.country_code) {
            return `${data.city}, ${data.country_code}`;
          }
          if (data.country_name) return data.country_name;
        }
        return null;
      },
      // ip-api.com (free tier: 45/min)
      async () => {
        const res = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,city,countryCode`, {
          headers: { 'User-Agent': 'BYD-Assets-Hub/1.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.city && data.countryCode) {
            return `${data.city}, ${data.countryCode}`;
          }
        }
        return null;
      },
      // ipgeolocation.io (free tier: 1000/month)
      async () => {
        const res = await fetch(`https://api.ipgeolocation.io/ipgeo?ip=${ip}&apiKey=free`, {
          headers: { 'User-Agent': 'BYD-Assets-Hub/1.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.city && data.country_code2) {
            return `${data.city}, ${data.country_code2}`;
          }
        }
        return null;
      }
    ];

    for (const geoApi of geoApis) {
      try {
        const result = await geoApi();
        if (result) {
          location = result;
          break;
        }
      } catch {
        // Continue to next API
        continue;
      }
    }

    // If all APIs fail, use IP as fallback
    if (location === 'Unknown Location') {
      location = ip !== 'unknown' ? `IP: ${ip}` : 'Unknown Location';
    }

    // Create response data (minimal - only necessary fields)
    const responseData = { ip, location };
    
    // Generate ETag from response content for conditional requests
    const etag = createHash('md5').update(JSON.stringify(responseData)).digest('hex');
    const ifNoneMatch = req.headers['if-none-match'];
    
    // Support conditional requests (If-None-Match / ETag)
    if (ifNoneMatch === `"${etag}"` || ifNoneMatch === etag) {
      res.setHeader('ETag', `"${etag}"`);
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(304).end();
    }

    // Set caching headers to reduce Fast Origin Transfer
    // Cache for 5 minutes (IP location doesn't change frequently)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('IP info error:', error);
    // Minimal error response
    const errorResponse = { ip: 'unknown', location: 'Unknown Location' };
    res.setHeader('Cache-Control', 'public, max-age=60'); // Short cache for errors
    return res.status(500).json(errorResponse);
  }
}
