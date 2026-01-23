# Quick Fix for CORS Errors - Step by Step

## ⚠️ You need to do TWO things:

### 1. Update Firebase Storage Rules (REQUIRED)

1. Go to: https://console.firebase.google.com/project/content-b7d4c/storage
2. Make sure you're viewing the bucket: **eu13657**
3. Click on the **Rules** tab
4. Find this line:
   ```javascript
   allow read, write: if false;
   ```
5. Change it to:
   ```javascript
   allow read, write: if true;
   ```
6. Click **Publish**

### 2. Set CORS Configuration (REQUIRED)

You have two options:

#### Option A: Using Command Line (Recommended)

1. **Install Google Cloud SDK** (if not installed):
   - Download: https://cloud.google.com/sdk/docs/install
   - Or: `npm install -g @google-cloud/storage`

2. **Open Terminal/Command Prompt** and run:
   ```bash
   gcloud auth login
   gcloud config set project content-b7d4c
   gsutil cors set cors.json gs://eu13657
   ```

3. **Verify it worked**:
   ```bash
   gsutil cors get gs://eu13657
   ```
   You should see the CORS configuration.

#### Option B: Using Firebase Console (if available)

1. Go to Firebase Console → Storage
2. Click on bucket **eu13657**
3. Look for **CORS** or **Permissions** settings
4. Add the configuration from `cors.json` file

---

## ✅ After completing both steps:

1. **Refresh your app** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. **Try uploading again**

The CORS errors should be gone!

---

## 🔍 Still having issues?

Check:
- [ ] Storage rules are set to `if true` (not `if false`)
- [ ] CORS configuration is applied (run `gsutil cors get gs://eu13657` to verify)
- [ ] You're using the correct bucket: `eu13657`
- [ ] Browser cache is cleared
