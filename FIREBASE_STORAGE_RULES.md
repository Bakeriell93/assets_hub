# Firebase Storage Rules for EU Bucket (eu13657)

## ⚠️ CRITICAL ISSUE
The new EU bucket has rules that block all access:
```
allow read, write: if false;
```

This prevents uploads and downloads from working. You **MUST** update these rules in Firebase Console.

## Solution
Update the Firebase Storage rules in Firebase Console for the bucket `eu13657.firebasestorage.app`.

### Step 1: Update Storage Rules

Go to Firebase Console → Storage → Rules tab for bucket `eu13657`

### Recommended Rules (matches your app's current setup - no auth required):
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Allow all access (matches your current app setup)
      allow read, write: if true;
    }
  }
}
```

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

## CORS Configuration
If you still get CORS errors after updating rules, you may also need to configure CORS for the bucket:

1. Go to Firebase Console → Storage
2. Click on the bucket `eu13657`
3. Go to **Permissions** tab
4. Add CORS configuration if needed

Or use `gsutil` command:
```bash
gsutil cors set cors.json gs://eu13657
```

Where `cors.json` contains:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```
