import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    try {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'User-Agent': 'BYD-Assets-Hub/1.0' }
      });
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.city && geoData.country_name) {
          location = `${geoData.city}, ${geoData.country_code}`;
        } else if (geoData.country_name) {
          location = geoData.country_name;
        }
      }
    } catch (geoErr) {
      // Fallback to ip-api.com
      try {
        const fallbackResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,city,countryCode`);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.city && fallbackData.countryCode) {
            location = `${fallbackData.city}, ${fallbackData.countryCode}`;
          }
        }
      } catch {
        // If both fail, use IP as location identifier
        location = `IP: ${ip}`;
      }
    }

    return res.status(200).json({ ip, location });
  } catch (error) {
    console.error('IP info error:', error);
    return res.status(500).json({ 
      ip: 'unknown', 
      location: 'Unknown Location' 
    });
  }
}
