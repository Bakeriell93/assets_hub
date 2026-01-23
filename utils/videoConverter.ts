// Client-side video conversion utility using FFmpeg WASM
// Converts MOV to MP4 for preview (downloads remain original format)

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

export async function getFFmpeg(): Promise<FFmpeg | null> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  try {
    const ffmpeg = new FFmpeg();
    
    // Load FFmpeg core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegInstance = ffmpeg;
    isLoaded = true;
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    return null;
  }
}

export async function convertMovToMp4(videoUrl: string): Promise<Blob | null> {
  try {
    const ffmpeg = await getFFmpeg();
    if (!ffmpeg) {
      console.warn('FFmpeg not available, cannot convert video');
      return null;
    }

    console.log('Starting MOV to MP4 conversion...');
    
    // Fetch the video file
    const videoData = await fetchFile(videoUrl);
    const inputFileName = 'input.mov';
    const outputFileName = 'output.mp4';
    
    // Write input file
    await ffmpeg.writeFile(inputFileName, videoData);
    
    // Convert MOV to MP4
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:v', 'libx264',      // H.264 video codec
      '-c:a', 'aac',          // AAC audio codec
      '-preset', 'fast',       // Fast encoding
      '-crf', '23',            // Quality (lower = better, 18-28 is good range)
      '-movflags', '+faststart', // Web optimization
      outputFileName
    ]);
    
    // Read output file
    const data = await ffmpeg.readFile(outputFileName);
    
    // Cleanup
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    console.log('Conversion complete');
    return new Blob([data], { type: 'video/mp4' });
  } catch (error) {
    console.error('Video conversion failed:', error);
    return null;
  }
}
