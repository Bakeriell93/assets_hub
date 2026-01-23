# FFmpeg Remux Setup - Quick Steps

## Remux MOV files locally (before upload)

```bash
ffmpeg -i input.mov -c copy -movflags +faststart output.mp4
```

Then upload the MP4 instead of MOV.

## Deploy Cloud Run function for automatic remuxing

1. **Set project**:
   ```bash
   gcloud config set project content-b7d4c
   ```

2. **Deploy function**:
   ```bash
   gcloud run deploy remux-video \
     --source . \
     --region us-central1 \
     --memory 2Gi \
     --timeout 300 \
     --max-instances 10 \
     --allow-unauthenticated
   ```

3. **Get the URL** from the output and update `api/convert-video.ts` to call it.

## Test locally

```bash
ffmpeg -i test.mov -c copy -movflags +faststart test-remuxed.mp4
```

**Note**: Vercel serverless functions can't run FFmpeg. Use Cloud Run or remux files before upload.
