# Verify Your Firebase Setup

## Storage Rules Check ✅

Go to: https://console.firebase.google.com/project/content-b7d4c/storage

1. Click on bucket: **eu13657**
2. Click **Rules** tab
3. It should show:
   ```javascript
   rules_version = '2';
   
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Make sure it says **"Published"** (not "Draft")

## Firestore Database (Doesn't Affect CORS)

Your Firestore can be in "test mode" - that's fine! It doesn't affect Storage CORS.

But if you want to check Firestore rules:
- Go to: https://console.firebase.google.com/project/content-b7d4c/firestore/rules
- Test mode is fine for now

## CORS Configuration Check

In Google Cloud Shell, verify CORS:
```bash
gsutil cors get gs://eu13657
```

Should show:
```json
[{
  "maxAgeSeconds": 3600,
  "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
  "origin": ["*"],
  "responseHeader": ["Content-Type", "Authorization", "Content-Length", "Content-Range", "Accept-Ranges"]
}]
```

## Common Issues

1. **Storage Rules not published** - Make sure you clicked "Publish" not just "Save"
2. **CORS not propagated** - Can take 5-10 minutes
3. **Wrong bucket** - Make sure you're editing `eu13657`, not the default bucket
