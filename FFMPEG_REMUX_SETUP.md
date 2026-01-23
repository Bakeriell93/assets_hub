# FFmpeg Remux Setup for MOV Files

This guide explains how to set up FFmpeg remuxing to move the moov atom to the front of MOV files for streaming compatibility.

## Problem

MOV files often have the moov atom (metadata) at the end of the file, which prevents browsers from streaming them. The browser must download the entire file before playback can begin.

## Solution

Use FFmpeg to remux the file: `ffmpeg -i input.mov -c copy -movflags +faststart output.mp4`

This moves the moov atom to the front without re-encoding, enabling progressive playback.

## Options

### Option 1: Cloud Run Function (Recommended)

Deploy a Cloud Run function that handles remuxing:

1. **Create the function** (see `api/remux-video.ts`)

2. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy remux-video \
     --source . \
     --region us-central1 \
     --memory 2Gi \
     --timeout 300 \
     --max-instances 10
   ```

3. **Update `api/convert-video.ts`** to call the Cloud Run function when remuxing is needed.

### Option 2: Use a Service

- **Cloudinary**: Has built-in video transformation
- **Mux**: Video API with remuxing
- **Transloadit**: File processing service

### Option 3: Pre-process Files

Remux files before uploading to Firebase Storage using FFmpeg locally:

```bash
ffmpeg -i input.mov -c copy -movflags +faststart output.mp4
```

Then upload the remuxed MP4 file instead of the original MOV.

## Current Implementation

The current `api/convert-video.ts` endpoint streams MOV files directly without remuxing. This works for files that already have the moov atom at the front, but may require full download for others.

To enable remuxing:
1. Set up Cloud Run function (Option 1)
2. Update the endpoint to call it when `?remux=true` is passed
3. Or use a service (Option 2)

## Testing

Test remuxing locally:
```bash
ffmpeg -i test.mov -c copy -movflags +faststart test-remuxed.mp4
```

Compare file sizes (should be identical) and playback behavior.
