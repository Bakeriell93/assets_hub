
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Asset, UserRole, getAssetBrands, getAssetPlatforms, assetContainsMasterFile } from '../types';
import DownloadFormatModal from './DownloadFormatModal';
import JSZip from 'jszip';
import { storageService } from '../services/storageService';

// In-memory caches so switching filters/tabs doesn't regenerate thumbnails (survives unmount/remount)
const imageThumbCache = new Map<string, { thumbnail: string; updatedAt: number }>();
const imageThumbCacheByUrl = new Map<string, string>();
const videoThumbCache = new Map<string, string>();

const IMG_THUMB_URL_PREFIX = 'img_thumb_url_';

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h) + url.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function normalizeTimestamp(v: number | unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return 0;
}

function getCachedImageThumb(assetId: string, assetUpdatedAt: number | unknown): string | null {
  const ts = normalizeTimestamp(assetUpdatedAt);
  const mem = imageThumbCache.get(assetId);
  if (mem && mem.updatedAt === ts) return mem.thumbnail;
  try {
    const raw = localStorage.getItem(`img_thumb_${assetId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const parsedTs = normalizeTimestamp(parsed.updatedAt);
    if (parsedTs === ts && parsed.thumbnail) {
      imageThumbCache.set(assetId, { thumbnail: parsed.thumbnail, updatedAt: parsedTs });
      if (parsed.url) imageThumbCacheByUrl.set(parsed.url, parsed.thumbnail);
      return parsed.thumbnail;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Prefer memory; then localStorage by URL so cache survives refresh and filter/tab switches. */
function getCachedImageThumbByUrl(imageUrl: string): string | null {
  const fromMem = imageThumbCacheByUrl.get(imageUrl);
  if (fromMem) return fromMem;
  try {
    const key = IMG_THUMB_URL_PREFIX + hashUrl(imageUrl);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.thumbnail) {
      imageThumbCacheByUrl.set(imageUrl, parsed.thumbnail);
      return parsed.thumbnail;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Single read for initial state: id cache then URL cache (memory + localStorage). Never show loading if any has value. */
function getCachedImageThumbAny(assetId: string, assetUpdatedAt: number | unknown, imageUrl: string): string | null {
  return getCachedImageThumb(assetId, assetUpdatedAt) ?? getCachedImageThumbByUrl(imageUrl);
}

// Image Thumbnail Component - only loads thumbnail, full image on preview. Always from cache when available (no reload on filter/tab switch or refresh).
const ImageThumbnail: React.FC<{ imageUrl: string; assetId: string; assetUpdatedAt: number | unknown; title: string }> = ({ imageUrl, assetId, assetUpdatedAt, title }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    getCachedImageThumbAny(assetId, assetUpdatedAt, imageUrl)
  );
  const [isLoaded, setIsLoaded] = useState(() =>
    !!getCachedImageThumbAny(assetId, assetUpdatedAt, imageUrl)
  );

  useEffect(() => {
    const ts = normalizeTimestamp(assetUpdatedAt);
    const cacheKey = `img_thumb_${assetId}`;
    const fromMem = imageThumbCache.get(assetId);
    if (fromMem && fromMem.updatedAt === ts && fromMem.thumbnail) {
      setThumbnailUrl(fromMem.thumbnail);
      setIsLoaded(true);
      return;
    }
    const fromUrl = getCachedImageThumbByUrl(imageUrl);
    if (fromUrl) {
      setThumbnailUrl(fromUrl);
      setIsLoaded(true);
      imageThumbCache.set(assetId, { thumbnail: fromUrl, updatedAt: ts });
      return;
    }
    const cacheData = localStorage.getItem(cacheKey);
    if (cacheData) {
      try {
        const parsed = JSON.parse(cacheData);
        const cachedTs = normalizeTimestamp(parsed.updatedAt);
        if (cachedTs === ts && parsed.thumbnail) {
          imageThumbCache.set(assetId, { thumbnail: parsed.thumbnail, updatedAt: cachedTs });
          imageThumbCacheByUrl.set(imageUrl, parsed.thumbnail);
          setThumbnailUrl(parsed.thumbnail);
          setIsLoaded(true);
          return;
        }
      } catch {
        // Invalid cache, continue to generate
      }
    }

    // OPTIMIZATION: Use Firebase Storage URL directly - no Vercel proxying
    // Firebase Storage already has CDN, so direct access reduces Fast Origin Transfer
    // Only use proxy if CORS fails (fallback)
    const getThumbnailUrl = () => {
      try {
        const u = new URL(imageUrl);
        const isFirebaseStorage = u.hostname === 'firebasestorage.googleapis.com' ||
          u.hostname === 'storage.googleapis.com' ||
          u.hostname.endsWith('.firebasestorage.app') ||
          u.hostname.endsWith('.appspot.com');
        
        if (isFirebaseStorage) {
          // Use Firebase Storage URL directly - Firebase CDN handles caching
          // This avoids proxying through Vercel, reducing Fast Origin Transfer
          return imageUrl;
        }
        return imageUrl;
      } catch {
        return imageUrl;
      }
    };

    const thumbUrl = getThumbnailUrl();
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const applyFallback = () => {
      if (cancelled) return;
      setThumbnailUrl(thumbUrl);
      setIsLoaded(true);
    };

    img.onload = () => {
      if (cancelled) return;
      // Show the source image immediately; cache thumbnail generation can finish after.
      setThumbnailUrl(thumbUrl);
      setIsLoaded(true);
      try {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          const ts = normalizeTimestamp(assetUpdatedAt);
          imageThumbCache.set(assetId, { thumbnail, updatedAt: ts });
          imageThumbCacheByUrl.set(imageUrl, thumbnail);
          setThumbnailUrl(thumbnail);
          setIsLoaded(true);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ thumbnail, updatedAt: ts, url: imageUrl }));
            localStorage.setItem(IMG_THUMB_URL_PREFIX + hashUrl(imageUrl), JSON.stringify({ thumbnail }));
          } catch (e) {
            console.warn('Failed to cache thumbnail:', e);
          }
        } else {
          applyFallback();
        }
      } catch (err) {
        console.warn('Thumbnail generation failed:', err);
        applyFallback();
      }
    };

    img.onerror = applyFallback;

    const timeoutId = setTimeout(applyFallback, 5000);

    img.src = thumbUrl;

    return () => {
      cancelled = true;
      img.src = '';
      clearTimeout(timeoutId);
    };
  }, [imageUrl, assetId, assetUpdatedAt]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img 
      src={thumbnailUrl || imageUrl} 
      alt={title} 
      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src !== imageUrl) {
          el.src = imageUrl;
          el.onerror = null;
        }
      }}
    />
  );
};

interface AssetCardProps {
  asset: Asset;
  packageAssets?: Asset[]; // All assets in the package (if this is a package)
  userRole: UserRole;
  username?: string; // For download logs (shared account)
  onPreview: (asset: Asset, packageAssets?: Asset[]) => void;
  onShare?: (asset: Asset, packageAssets?: Asset[]) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  isTrashView?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, packageAssets = [asset], userRole, username, onPreview, onShare, onEdit, onDelete, onRestore, isTrashView = false, isSelected = false, onToggleSelect }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const isPackage = packageAssets.length > 1;
  const previewAsset = isPackage 
    ? (asset.packagePreviewAssetId 
        ? packageAssets.find(a => a.id === asset.packagePreviewAssetId) || packageAssets[0]
        : packageAssets[0])
    : asset;
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(() => {
    if (previewAsset.type === 'video' && previewAsset.url)
      return videoThumbCache.get(previewAsset.url) ?? localStorage.getItem(`video_thumb_${hashUrl(previewAsset.url)}`);
    return null;
  });
  const [packageSectionCollapsed, setPackageSectionCollapsed] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHighPerformer = (asset.ctr && asset.ctr > 2) || (asset.cr && asset.cr > 1.5);
  const isAdmin = userRole === 'Admin';
  const canEdit = userRole === 'Editor' || userRole === 'Admin';
  const canDelete = userRole === 'Editor' || userRole === 'Admin'; // Editor can now delete
  const associatedModels = [...new Set([asset.carModel, ...(asset.carModels || [])].filter(Boolean))];

  // Generate video thumbnail - cached in memory + localStorage; useLayoutEffect so ref is set, with retry and multiple fallbacks
  useLayoutEffect(() => {
    if (previewAsset.type !== 'video' || !previewAsset.url) return;
    const cacheKey = `video_thumb_${hashUrl(previewAsset.url)}`;
    const fromMem = videoThumbCache.get(previewAsset.url);
    if (fromMem) {
      setVideoThumbnail(fromMem);
      return;
    }
    const fromLs = localStorage.getItem(cacheKey);
    if (fromLs) {
      videoThumbCache.set(previewAsset.url, fromLs);
      setVideoThumbnail(fromLs);
      return;
    }
    setVideoThumbnail(null);

    let cleanupFn: (() => void) | undefined;

    const runGeneration = (videoEl: HTMLVideoElement) => {
      const videoUrl = getThumbnailVideoUrl(previewAsset.url);
      let isMov = false;
      try {
        const u = new URL(asset.url);
        isMov = u.pathname.toLowerCase().endsWith('.mov') || u.pathname.toLowerCase().endsWith('.qt') || u.pathname.toLowerCase().endsWith('.apcn');
      } catch {
        isMov = /\.(mov|qt|apcn)(\?|$)/i.test(asset.url || '');
      }
      videoEl.src = videoUrl;
      videoEl.preload = 'auto';
      videoEl.muted = true;
      videoEl.playsInline = true;
      if (videoUrl.startsWith('http') && !videoUrl.startsWith(window.location.origin)) {
        videoEl.crossOrigin = 'anonymous';
      }
      if (isMov) videoEl.type = 'video/mp4';

      const generateThumbnail = () => {
        try {
          if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            const canvas = document.createElement('canvas');
            // Keep card thumbnails lightweight for fast rendering and scrolling.
            const maxSize = 480;
            let width = videoEl.videoWidth;
            let height = videoEl.videoHeight;
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
            canvas.width = Math.max(1, Math.round(width));
            canvas.height = Math.max(1, Math.round(height));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
              videoThumbCache.set(previewAsset.url, thumbnailUrl);
              setVideoThumbnail(thumbnailUrl);
              try {
                localStorage.setItem(cacheKey, thumbnailUrl);
              } catch (e) {
                console.warn('Failed to cache thumbnail:', e);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to generate video thumbnail:', err);
        }
      };

      const trySeekAndCapture = () => {
        if (videoEl.readyState >= 2) {
          try {
            videoEl.currentTime = 0.5;
          } catch {
            generateThumbnail();
          }
        }
      };

      const onLoadedMetadata = () => trySeekAndCapture();
      videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.addEventListener('seeked', generateThumbnail, { once: true });
      videoEl.addEventListener('loadeddata', generateThumbnail, { once: true });
      videoEl.addEventListener('canplay', generateThumbnail, { once: true });

      const t1 = setTimeout(() => { if (videoEl.readyState >= 2) generateThumbnail(); }, 1500);
      const t2 = setTimeout(() => { if (videoEl.readyState >= 2) generateThumbnail(); }, 4000);
      const t3 = setTimeout(() => { if (videoEl.readyState >= 2) generateThumbnail(); }, 7000);
      videoEl.load();

      return () => {
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoEl.removeEventListener('seeked', generateThumbnail);
        videoEl.removeEventListener('loadeddata', generateThumbnail);
        videoEl.removeEventListener('canplay', generateThumbnail);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    };

    if (videoRef.current) {
      cleanupFn = runGeneration(videoRef.current);
    } else {
      const id = setTimeout(() => {
        if (videoRef.current) cleanupFn = runGeneration(videoRef.current);
      }, 0);
      return () => {
        clearTimeout(id);
        cleanupFn?.();
      };
    }
    return () => cleanupFn?.();
  }, [previewAsset.type, previewAsset.url]);

  const useStorageProxy = import.meta.env.VITE_STORAGE_PROXY === 'true';

  const isAllowedProxyHost = (u: URL) => {
    return (
      u.hostname === 'firebasestorage.googleapis.com' ||
      u.hostname === 'storage.googleapis.com' ||
      u.hostname.endsWith('.firebasestorage.app') ||
      u.hostname.endsWith('.appspot.com')
    );
  };

  const getThumbnailVideoUrl = (url: string) => {
    try {
      const u = new URL(url);
      if (!isAllowedProxyHost(u)) return url;
      const path = u.pathname.toLowerCase();
      const isMov = path.endsWith('.mov') || path.endsWith('.qt') || path.endsWith('.apcn');
      // Only proxy MOV files that need conversion - everything else use direct Firebase Storage URL
      if (isMov) {
        return `/api/convert-video?url=${encodeURIComponent(u.toString())}`;
      }
      // OPTIMIZATION: Use Firebase Storage URL directly for video thumbnails
      // Firebase Storage CDN handles caching, reducing Fast Origin Transfer
      return url;
    } catch {
      return url;
    }
  };

  const maybeProxyUrl = (url: string) => {
    try {
      const u = new URL(url);
      if (!isAllowedProxyHost(u)) return url;
      // For MOV/APCN files, use conversion endpoint for preview/thumbnails
      const path = u.pathname.toLowerCase();
      const isMov = path.endsWith('.mov') || path.endsWith('.qt') || path.endsWith('.apcn');
      if (isMov && asset.type === 'video') {
        return `/api/convert-video?url=${encodeURIComponent(u.toString())}`;
      }
      // OPTIMIZATION: Use Firebase Storage URL directly - no proxying through Vercel
      // Firebase Storage already has CDN, so direct access reduces Fast Origin Transfer
      // Only proxy if explicitly enabled via env var (for CORS issues)
      if (useStorageProxy) {
        return `/api/fetch-image?url=${encodeURIComponent(u.toString())}`;
      }
      // Default: use direct Firebase Storage URL
      return url;
    } catch {
      // ignore (data: urls, relative urls)
    }
    return url;
  };

  const guessFilename = (url: string, fallbackBase: string, format?: 'original' | 'webp' | 'png' | 'jpg') => {
    const cleaned = url.split('?')[0] || '';
    const last = cleaned.split('/').pop() || '';
    const extMatch = last.match(/\.([a-z0-9]+)(?:\?|$)/i);
    let ext = (extMatch?.[0] || '.jpg').toLowerCase();
    
    // Override extension if format conversion requested
    if (format && format !== 'original') {
      ext = `.${format}`;
    }
    
    const safeBase = (fallbackBase || 'asset')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 80) || 'asset';
    return safeBase.endsWith(ext) ? safeBase : `${safeBase}${ext}`;
  };

  // Extract original filename from URL for package list display
  const extractFilenameFromUrl = (url: string): string => {
    try {
      // Try to extract Firebase Storage path first (handles URL encoding properly)
      const storagePath = storageService.extractStoragePath(url);
      if (storagePath) {
        // Remove "content/" prefix if present
        const withoutPrefix = storagePath.replace(/^content\//, '');
        // Remove timestamp prefix (format: timestamp-filename.ext)
        const withoutTimestamp = withoutPrefix.replace(/^\d+-/, '');
        return withoutTimestamp || 'file';
      }
      
      // Fallback: try to extract from URL directly
      const cleaned = url.split('?')[0] || '';
      const last = cleaned.split('/').pop() || '';
      const decoded = decodeURIComponent(last);
      // Remove timestamp prefix if present
      const withoutTimestamp = decoded.replace(/^\d+-/, '');
      return withoutTimestamp || 'file';
    } catch {
      return 'file';
    }
  };

  // Get display filename - prefer originalFileName, fallback to URL extraction
  const getDisplayFilename = (asset: Asset): string => {
    if (asset.originalFileName) {
      return asset.originalFileName;
    }
    if (asset.url) {
      return extractFilenameFromUrl(asset.url);
    }
    return 'file';
  };

  // True if file is PSD, ZIP, RAR, etc. - show master file placeholder instead of trying image
  const isMasterFileExtension = (a: Asset): boolean => {
    const name = (a.originalFileName || a.url || '').toLowerCase();
    const ext = name.split('.').pop()?.replace(/\?.*$/, '') || '';
    return ['zip', 'rar', 'psd', 'ai', 'eps', 'pdf'].includes(ext);
  };

  const showMasterFilePlaceholder =
    previewAsset.type === 'design' ||
    assetContainsMasterFile(asset) ||
    isMasterFileExtension(previewAsset);

  const convertImageFormat = async (imageUrl: string, format: 'webp' | 'png' | 'jpg'): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        const mimeType = format === 'webp' ? 'image/webp' : format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpg' ? 0.92 : undefined;
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert image'));
            }
          },
          mimeType,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = maybeProxyUrl(imageUrl);
    });
  };

  const handleDownload = async (format: 'original' | 'webp' | 'png' | 'jpg', assetId?: string) => {
    const targetAsset = assetId ? packageAssets.find(a => a.id === assetId) : asset;
    if (!targetAsset || !targetAsset.url) {
      console.error('No asset or URL found for download');
      return;
    }

    const filename = guessFilename(targetAsset.url, targetAsset.title || 'asset', format);
    const fetchUrl = maybeProxyUrl(targetAsset.url);

    try {
      // For videos and design files: fetch as blob so browser downloads instead of opening in new tab
      if (targetAsset.type === 'video' || targetAsset.type === 'design') {
        const res = await fetch(fetchUrl, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(blobUrl);
        }, 200);
        storageService.logDownload(targetAsset.id, targetAsset.title, format, username);
        return;
      }
      
      // For images or if blob download failed
      let blob: Blob;
      
      if (format === 'original') {
        // Download original - single fetch, no conversion
        console.log('Fetching original file:', fetchUrl);
        const res = await fetch(fetchUrl, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
        console.log('Blob created, size:', blob.size);
      } else if (targetAsset.type === 'image') {
        // Convert format - fetch once, convert client-side (no extra API calls)
        console.log('Converting image format:', format);
        blob = await convertImageFormat(targetAsset.url, format);
        console.log('Image converted, blob size:', blob.size);
      } else {
        // For videos and design files, always download original
        const res = await fetch(fetchUrl, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }, 100);
      storageService.logDownload(targetAsset.id, targetAsset.title, format, username);
      console.log('Download triggered successfully');
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback to direct download link
      try {
        console.log('Trying direct download fallback:', targetAsset.url);
        const a = document.createElement('a');
        a.href = targetAsset.url;
        a.download = filename;
        a.rel = 'noopener';
        a.target = '_blank'; // Open in new tab as fallback
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
        storageService.logDownload(targetAsset.id, targetAsset.title, format, username);
        console.log('Direct download fallback triggered');
      } catch (fallbackErr) {
        console.error('Fallback download failed:', fallbackErr);
        // Last resort: open in new window
        window.open(targetAsset.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDownloadAll = async () => {
    // Download all assets in package individually (could be enhanced with ZIP later)
    try {
      for (const pkgAsset of packageAssets) {
        if (pkgAsset.url) {
          await handleDownload('original', pkgAsset.id);
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      console.error('Failed to download package:', err);
      alert('Some files in the package failed to download');
    }
  };

  const handleDownloadAllAsZip = async () => {
    try {
      const zip = new JSZip();
      const fetchUrl = (url: string) => maybeProxyUrl(url);

      // Fetch all files and add to ZIP
      for (const pkgAsset of packageAssets) {
        if (!pkgAsset.url) continue;

        try {
          const fileName = getDisplayFilename(pkgAsset);
          const url = fetchUrl(pkgAsset.url);
          
          // Fetch the file
          const response = await fetch(url, { method: 'GET' });
          if (!response.ok) {
            console.warn(`Failed to fetch ${fileName}:`, response.status);
            continue;
          }
          
          const blob = await response.blob();
          zip.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to add ${pkgAsset.title} to ZIP:`, err);
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      // Download ZIP
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${asset.title || 'package'}-${Date.now()}.zip`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      storageService.logDownload(asset.id, asset.title, 'zip', username);
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(zipUrl);
      }, 100);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      alert('Failed to create ZIP file. Please try downloading files individually.');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handlePreview = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onPreview(asset, isPackage ? packageAssets : undefined);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(asset.id);
    setIsConfirmingDelete(false);
  };

  return (
    <div 
      className={`group bg-white rounded-[32px] border-2 overflow-hidden transition-all duration-500 flex flex-col h-full relative cursor-pointer ${isSelected ? 'ring-2 ring-amber-500 ring-offset-2 border-amber-400' : ''} ${isHighPerformer ? 'border-blue-500 shadow-blue-100 shadow-2xl' : 'border-transparent hover:border-blue-200 shadow-xl shadow-gray-100 hover:shadow-2xl'}`}
      onClick={(e) => handlePreview(e)}
    >
      {onToggleSelect && !isTrashView && (
        <div className="absolute top-4 left-4 z-30" onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}>
          <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-5 h-5 rounded border-2 border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer pointer-events-none" />
        </div>
      )}
      {isPackage && (
        <div className={`absolute top-4 z-10 px-3 py-1 bg-purple-600 text-white text-[9px] font-black uppercase tracking-tighter rounded-full shadow-lg flex items-center gap-1.5 ${onToggleSelect ? 'left-14' : 'left-4'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
          Package
        </div>
      )}
      {isHighPerformer && !isPackage && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter rounded-full shadow-lg flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          Elite Asset
        </div>
      )}

      {canDelete && !isConfirmingDelete && !isTrashView && (
        <button 
          onClick={handleDelete}
          className="absolute top-4 right-4 z-20 p-2.5 bg-red-50 text-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white hover:scale-110 shadow-lg"
          title="Move to Trash"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      )}
      
      {isTrashView && (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {onRestore && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRestore(asset.id); }}
              className="p-2.5 bg-green-50 text-green-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-green-600 hover:text-white hover:scale-110 shadow-lg"
              title="Restore Asset"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={handleDelete}
              className="p-2.5 bg-red-50 text-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white hover:scale-110 shadow-lg"
              title="Permanently Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      )}

      {/* Confirmation Overlay for Sandbox compatibility */}
      {isConfirmingDelete && (
        <div className="absolute inset-0 z-40 bg-red-600/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-white text-xs font-black uppercase tracking-[0.2em] mb-4">
              {isTrashView ? 'Permanent Deletion?' : 'Move to Trash?'}
            </p>
            <div className="flex gap-3">
                <button onClick={confirmDelete} className="px-5 py-2.5 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Confirm</button>
                <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} className="px-5 py-2.5 bg-red-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
            </div>
        </div>
      )}

      {/* Visual Preview */}
      <div className="relative h-56 bg-gray-50 flex items-center justify-center overflow-hidden">
        {showMasterFilePlaceholder && (
          <div className="p-6 bg-orange-50/50 flex flex-col items-center justify-center gap-3 text-center min-h-full w-full">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">MASTER FILE</span>
            <span className="text-[10px] font-bold text-orange-700 truncate max-w-full px-2 break-all text-center" title={getDisplayFilename(previewAsset)}>{getDisplayFilename(previewAsset)}</span>
          </div>
        )}
        {!showMasterFilePlaceholder && previewAsset.type === 'image' && previewAsset.url && (
          <ImageThumbnail 
            imageUrl={previewAsset.url}
            assetId={previewAsset.id}
            assetUpdatedAt={previewAsset.createdAt}
            title={previewAsset.title}
          />
        )}
        {!showMasterFilePlaceholder && previewAsset.type === 'video' && previewAsset.url && (
            <div className="relative w-full h-full bg-gray-900">
               {videoThumbnail ? (
                 <img 
                   src={videoThumbnail} 
                   alt={asset.title} 
                   className="w-full h-full object-cover" 
                   loading="lazy"
                   decoding="async"
                   // OPTIMIZATION: Add fetchpriority for better resource hints
                   fetchPriority="low"
                 />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-gray-800">
                   <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                     <svg className="w-7 h-7 text-white ml-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                   </div>
                 </div>
               )}
              <video 
                ref={videoRef}
                src={getThumbnailVideoUrl(previewAsset.url)} 
                 className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
                 preload="metadata"
                 muted
                 playsInline
                crossOrigin="anonymous"
                 onError={(e) => {
                   const video = e.currentTarget;
                   const error = video.error;
                   console.warn('Video thumbnail generation failed:', {
                     code: error?.code,
                     message: error?.message,
                     url: previewAsset.url
                   });
                 }}
               >
                 {/* For MOV/APCN files, try as MP4 since many are H.264 compatible */}
                {(() => {
                  try {
                    const u = new URL(previewAsset.url);
                    const path = u.pathname.toLowerCase();
                    if (path.endsWith('.mov') || path.endsWith('.qt') || path.endsWith('.apcn')) {
                      return <source src={getThumbnailVideoUrl(previewAsset.url)} type="video/mp4" />;
                    }
                  } catch {
                    const lower = previewAsset.url.toLowerCase();
                    if (lower.endsWith('.mov') || lower.endsWith('.qt') || lower.endsWith('.apcn')) {
                      return <source src={getThumbnailVideoUrl(previewAsset.url)} type="video/mp4" />;
                    }
                  }
                  return null;
                })()}
               </video>
               <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                   <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                        <svg className="w-7 h-7 text-gray-900 ml-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                   </div>
               </div>
            </div>
        )}
        {!showMasterFilePlaceholder && asset.type === 'text' && (
          <div className="p-8 w-full h-full overflow-hidden relative bg-blue-50/50">
            <p className="text-gray-800 text-sm italic font-serif leading-relaxed line-clamp-5">"{asset.content}"</p>
          </div>
        )}
        
        {/* Hover Actions */}
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canEdit && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(asset); }}
                  className="bg-white px-4 py-2.5 rounded-2xl text-gray-900 hover:bg-blue-600 hover:text-white transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Modify
                </button>
              )}
              <button 
                onClick={(e) => handlePreview(e)}
                className="bg-gray-900 px-4 py-2.5 rounded-2xl text-white hover:bg-black transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
              >
                Preview
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onShare?.(asset, isPackage ? packageAssets : undefined); }}
                className="bg-purple-600 px-4 py-2.5 rounded-2xl text-white hover:bg-purple-700 transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
              >
                Share
              </button>
            </div>

            {(asset.type === 'image' || asset.type === 'video' || asset.type === 'design') && asset.url && (
              <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsDownloadModalOpen(true); }}
                  className="bg-white px-4 py-2.5 rounded-2xl text-gray-900 hover:bg-gray-100 transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap disabled:opacity-50"
                >
                  Download
                </button>
                {asset.type === 'image' && (
                  <>
                    <a
                      href="https://www.pxbee.com/ai-image-extender/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 px-4 py-2.5 rounded-2xl text-white hover:bg-blue-700 transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap"
                      title="Open PxBee AI Image Extender (Story resize/outpaint)"
                    >
                      Resize
                    </a>
                    <a
                      href="https://ai.studio/apps/drive/1RIQCDDeZ-toZvjsRMJU4JTQDQrO4xpSt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#111111] px-4 py-2.5 rounded-2xl text-white hover:bg-black transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap"
                      title="Open AI Studio image edit app"
                    >
                      Edit Image Text
                    </a>
                  </>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col bg-white">
        <div className="flex flex-wrap gap-2 mb-4">
            {getAssetBrands(asset).map(b => (
              <span key={b} className="px-2 py-1 rounded-lg bg-amber-50 text-[10px] font-black text-amber-700 uppercase tracking-tight">{b}</span>
            ))}
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-tight">{asset.market}</span>
            {getAssetPlatforms(asset).map(p => (
              <span key={p} className="px-2 py-1 rounded-lg bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-tight">{p}</span>
            ))}
        </div>

        <h3 className="text-sm font-bold text-gray-900 mb-1.5 tracking-tight leading-tight break-words">{asset.title}</h3>
        {assetContainsMasterFile(asset) && (
          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider border border-amber-200 mb-2">Contains master file</span>
        )}
        {asset.packageNote && (
          <p className="text-[10px] text-gray-500 mb-2 line-clamp-2" title={asset.packageNote}>{asset.packageNote}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {associatedModels.map((model, idx) => (
            <span key={idx} className="text-[10px] text-blue-500/60 font-black uppercase tracking-widest">{model}</span>
          ))}
        </div>
        
        {/* Objectives */}
        {asset.objectives && asset.objectives.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {asset.objectives.map(obj => (
              <span key={obj} className="px-2 py-0.5 rounded-md bg-green-50 text-[9px] font-black text-green-700 uppercase tracking-tight border border-green-100">
                {obj}
              </span>
            ))}
          </div>
        )}

        {/* Performance Metrics Summary */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {asset.ctr !== undefined && (
            <div className={`flex-1 min-w-[60px] p-2 rounded-xl text-center border ${asset.ctr > 2 ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-transparent'}`}>
              <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">CTR</p>
              <p className={`text-xs font-black ${asset.ctr > 2 ? 'text-green-700' : 'text-gray-900'}`}>{asset.ctr}%</p>
            </div>
          )}
          {asset.cr !== undefined && (
            <div className={`flex-1 min-w-[60px] p-2 rounded-xl text-center border ${asset.cr > 1.5 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent'}`}>
              <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">CR</p>
              <p className={`text-xs font-black ${asset.cr > 1.5 ? 'text-blue-700' : 'text-gray-900'}`}>{asset.cr}%</p>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              Uploaded {new Date(asset.createdAt).toLocaleDateString()}
            </div>
            <span className="truncate max-w-[80px] bg-gray-50 px-2 py-1 rounded-md">{asset.uploadedBy}</span>
        </div>

        {/* Package Info - Collapsible, slightly reduced size */}
        {isPackage && (
          <div className="mt-2 pt-2 border-t border-purple-200 bg-purple-50/40 px-4 pb-3 -mx-6 -mb-6 rounded-b-[32px]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPackageSectionCollapsed(prev => !prev); }}
              className="w-full flex items-center justify-between text-left py-1.5"
            >
              <span className="text-[9px] font-black text-purple-700 uppercase tracking-widest">
                {packageAssets.length} {packageAssets.length === 1 ? 'Asset' : 'Assets'} in Package
              </span>
              <svg className={`w-4 h-4 text-purple-600 transition-transform ${packageSectionCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {!packageSectionCollapsed && (
              <>
                <div className="space-y-1 max-h-28 overflow-y-auto mt-1">
                  {packageAssets.map((pkgAsset, idx) => {
                    const fileName = getDisplayFilename(pkgAsset);
                    return (
                      <div key={pkgAsset.id} className="flex items-center gap-1.5 group/item">
                        <span className="text-purple-600 font-black text-[7px] min-w-[14px]">{idx + 1}.</span>
                        <span className="text-gray-700 font-medium text-[7px] truncate flex-1" title={fileName}>
                          {fileName}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload('original', pkgAsset.id); }}
                          className="opacity-0 group-hover/item:opacity-100 p-1 bg-purple-100 hover:bg-purple-200 rounded transition-all flex-shrink-0"
                          title="Download"
                        >
                          <svg className="w-2.5 h-2.5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-purple-200/80">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadAllAsZip(); }}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                    title="Download all as ZIP"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download All as ZIP
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <DownloadFormatModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        asset={asset}
        packageAssets={isPackage ? packageAssets : undefined}
        onDownload={handleDownload}
        onDownloadAll={isPackage ? handleDownloadAll : undefined}
      />
    </div>
  );
};

export default AssetCard;
