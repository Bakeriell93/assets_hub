// Cloud Run HTTP service for remuxing MOV files with FFmpeg
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, createReadStream, unlinkSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';

const PORT = process.env.PORT || 8080;

async function remuxVideo(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const videoUrl = requestUrl.searchParams.get('url');
  if (!videoUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const upstream = await fetch(videoUrl);
    if (!upstream.ok) {
      res.status(502).send(`Upstream fetch failed: ${upstream.status}`);
      return;
    }

    const tempInput = join(tmpdir(), `input-${Date.now()}.mov`);
    const tempOutput = join(tmpdir(), `output-${Date.now()}.mp4`);

    const inputStream = createWriteStream(tempInput);
    const bodyStream = upstream.body;
    if (bodyStream) {
      const reader = bodyStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        inputStream.write(Buffer.from(value));
      }
      inputStream.end();
    }

    await new Promise((resolve, reject) => {
      inputStream.on('finish', resolve);
      inputStream.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempInput,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-f', 'mp4',
        '-y',
        tempOutput
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      let ffmpegError = '';
      ffmpeg.stderr.on('data', (data) => {
        ffmpegError += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && existsSync(tempOutput)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed: ${ffmpegError}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });

    res.set('Content-Type', 'video/mp4');
    res.set('Cache-Control', 'public, max-age=3600');
    
    const outputStream = createReadStream(tempOutput);
    await pipeline(outputStream, res);

    try {
      if (existsSync(tempInput)) unlinkSync(tempInput);
      if (existsSync(tempOutput)) unlinkSync(tempOutput);
    } catch {}
  } catch (err: any) {
    console.error('Remux error:', err);
    res.status(500).send(`Error: ${err?.message || String(err)}`);
  }
}

// Simple HTTP server for Cloud Run
import { createServer } from 'http';

const server = createServer(async (req, res) => {
  await remuxVideo(req, res);
});

server.listen(PORT, () => {
  console.log(`Remux service listening on port ${PORT}`);
});
