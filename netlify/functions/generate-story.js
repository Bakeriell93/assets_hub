// Netlify Function: generate-story
// Uses Gemini API to generate a 9:16 story version with true generative fill/outpainting

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageUrl } = await request.json();
    if (!imageUrl) {
      return new Response('Missing imageUrl', { status: 400 });
    }

    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response('Failed to fetch image', { status: 502 });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Use Gemini API for image outpainting
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return new Response('GEMINI_API_KEY not configured', { status: 500 });
    }

    // Gemini 1.5 Pro/Flash can process images and generate extended versions
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `Extend this image to a 9:16 vertical format (1080x1920 pixels) for Instagram/Facebook Stories. Use generative fill to seamlessly extend the image on all sides, maintaining the original content in the center. The extension should be natural and seamless with no visible seams or lines. Generate a complete 1080x1920 image.`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64
              }
            },
            { text: prompt }
          ]
        }]
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      // Fallback to canvas-based approach
      return fallbackCanvasApproach(imageBuffer);
    }

    const geminiData = await geminiResponse.json();
    
    // Check if Gemini returned an image
    if (geminiData.candidates?.[0]?.content?.parts?.[0]?.inline_data) {
      const generatedImageBase64 = geminiData.candidates[0].content.parts[0].inline_data.data;
      const generatedImageBuffer = Buffer.from(generatedImageBase64, 'base64');
      
      return new Response(generatedImageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // If no image returned, fallback
    return fallbackCanvasApproach(imageBuffer);
  } catch (err) {
    console.error('Error:', err);
    return new Response(`Error: ${err?.message || String(err)}`, { status: 500 });
  }
};

// Fallback: Smart canvas-based seamless extension
async function fallbackCanvasApproach(imageBuffer) {
  // This would require canvas on server-side (node-canvas)
  // For now, return error and let client handle it
  return new Response('Gemini image generation not available, using client-side fallback', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'X-Fallback': 'true',
    },
  });
}

export const config = {
  path: '/.netlify/functions/generate-story',
};
