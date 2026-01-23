// Cloud Run Function for remuxing MOV files with FFmpeg
// Deploy this to Cloud Run for actual FFmpeg remuxing
// Command: gcloud run deploy remux-video --source . --region us-central1

import { Request, Response } from '@google-cloud/functions-framework';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, createReadStream, unlinkSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';

export const remuxVideo = async (req: Request, res: Response) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const videoUrl = req.query.url as string;
  if (!videoUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    // Download the MOV file
    const upstream = await fetch(videoUrl);
    if (!upstream.ok) {
      res.status(502).send(`Upstream fetch failed: ${upstream.status}`);
      return;
    }

    const tempInput = join(tmpdir(), `input-${Date.now()}.mov`);
    const tempOutput = join(tmpdir(), `output-${Date.now()}.mp4`);

    // Write input to temp file
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

    // Remux using FFmpeg: move moov atom to front
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempInput,
        '-c', 'copy',              // Copy streams without re-encoding
        '-movflags', '+faststart', // Move moov atom to front for streaming
        '-f', 'mp4',
        '-y',                      // Overwrite output
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

    // Stream the remuxed output
    res.set('Content-Type', 'video/mp4');
    res.set('Cache-Control', 'public, max-age=3600');
    
    const outputStream = createReadStream(tempOutput);
    await pipeline(outputStream, res);

    // Cleanup
    try {
      if (existsSync(tempInput)) unlinkSync(tempInput);
      if (existsSync(tempOutput)) unlinkSync(tempOutput);
    } catch {}

  } catch (err: any) {
    console.error('Remux error:', err);
    res.status(500).send(`Error: ${err?.message || String(err)}`);
  }
};
