# Quick Fix for CORS Errors - Step by Step

## ⚠️ You need to do TWO things:

### 1. Update Firebase Storage Rules (REQUIRED - 2 minutes)

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

### 2. Set CORS Configuration (REQUIRED - Easiest Method)

#### 🚀 EASIEST: Use Google Cloud Shell (No Installation Needed!)

1. **Go to Google Cloud Shell** (browser-based, no install):
   - Open: https://shell.cloud.google.com/
   - It opens in your browser - no installation needed!

2. **Run these commands** (copy-paste one by one):
   ```bash
   gcloud config set project content-b7d4c
   gcloud auth login
   ```

3. **Create the CORS file**:
   ```bash
   cat > cors.json << 'EOF'
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
       "responseHeader": ["Content-Type", "Authorization", "Content-Length", "Content-Range", "Accept-Ranges"],
       "maxAgeSeconds": 3600
     }
   ]
   EOF
   ```

4. **Set CORS**:
   ```bash
   gsutil cors set cors.json gs://eu13657
   ```

5. **Verify it worked**:
   ```bash
   gsutil cors get gs://eu13657
   ```

That's it! No downloads, no installations - just use the browser!

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
