# Firebase Storage Rules for EU Bucket (eu13657)

## ⚠️ CRITICAL ISSUE
The new EU bucket has rules that block all access:
```
allow read, write: if false;
```

This prevents uploads and downloads from working. You **MUST** update these rules in Firebase Console.

## Solution - Quick Fix

Since you manage roles from the frontend (no Firebase Auth needed), simply change:

**FROM:**
```javascript
allow read, write: if false;
```

**TO:**
```javascript
allow read, write: if true;
```

### Complete Rules (Copy & Paste This):

Go to Firebase Console → Storage → Rules tab for bucket `eu13657`, then replace everything with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Allow all access (roles managed in frontend)
      allow read, write: if true;
    }
  }
}
```

Then click **Publish**.

### Alternative: Public Read, Authenticated Write:
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Allow public read, authenticated write
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## How to Update Rules:
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `content-b7d4c`
3. Navigate to: **Storage** → **Rules** tab
4. Make sure you're editing rules for the bucket: `eu13657.firebasestorage.app`
5. Paste the appropriate rules above
6. Click **Publish**

## CORS Configuration ⚠️ REQUIRED

**You MUST configure CORS or uploads will fail with CORS errors!**

### Option 1: Using gsutil (Recommended - Fastest)

1. **Install Google Cloud SDK** (if not already installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or use: `npm install -g @google-cloud/storage`

2. **Open Terminal/Command Prompt** and run these commands:
   ```bash
   # Authenticate with Google
   gcloud auth login
   
   # Set your project
   gcloud config set project content-b7d4c
   
   # Set CORS (the cors.json file is in your project root)
   gsutil cors set cors.json gs://eu13657
   
   # Verify it worked
   gsutil cors get gs://eu13657
   ```

   The `cors.json` file is already in your project root - just run the command!

### Option 2: Using Firebase Console (if available)

1. Go to Firebase Console → Storage
2. Click on the bucket `eu13657`
3. Go to **Permissions** or **Settings** tab
4. Look for **CORS configuration** section
5. Add the CORS configuration (see `cors.json` file in project root)

### CORS Configuration Details

The `cors.json` file contains:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "Content-Range", "Accept-Ranges"],
    "maxAgeSeconds": 3600
  }
]
```

**What this does:**
- `"origin": ["*"]` - Allows requests from any origin (your Vercel app)
- `"method"` - Allows all HTTP methods needed for uploads/downloads
- `"responseHeader"` - Allows necessary headers for video streaming and file operations
- `"maxAgeSeconds": 3600` - Caches CORS preflight responses for 1 hour

### Verify CORS is Set

After setting CORS, verify it's working:
```bash
gsutil cors get gs://eu13657
```

This should show your CORS configuration.
