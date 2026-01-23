import { db, storage, initError } from './firebase';

/**
 * AI Studio often blocks/doesn't provide Firestore, which causes:
 * "Service firestore is not available"
 *
 * To keep the app working, we fall back to a localStorage-backed store when
 * Firestore isn't available (db is null).
 */
const isCloudEnabled = !!db;

if (initError) console.error('Firebase initialization failed:', initError);
if (!isCloudEnabled) console.warn('Firestore unavailable; using localStorage fallback mode.');
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  where, 
  limit
} from "firebase/firestore";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Asset, AssetStatus, Market, CarModel, Platform, User, SystemConfig, MARKETS, CAR_MODELS, PLATFORMS, Collection } from '../types';

const ASSETS_COLLECTION = 'assets';
const CONFIG_COLLECTION = 'config';
const USERS_COLLECTION = 'users';
const COLLECTIONS_COLLECTION = 'collections';
const SECURITY_LOGS_COLLECTION = 'security_logs';
const CONFIG_DOC_ID = 'system_settings';

// -----------------------------
// Local fallback (no Firestore)
// -----------------------------
const LS_KEYS = {
  assets: 'byd_assets_hub_assets',
  config: 'byd_assets_hub_config',
  users: 'byd_assets_hub_users',
  collections: 'byd_assets_hub_collections',
  securityLogs: 'byd_assets_hub_security_logs',
} as const;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  // Notify same-tab listeners too
  window.dispatchEvent(new Event('byd_assets_hub_local_change'));
}

const DEFAULT_CONFIG: SystemConfig = { markets: MARKETS, models: CAR_MODELS, platforms: PLATFORMS };

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function sortByCreatedAtDesc<T extends { createdAt: number }>(arr: T[]) {
  return [...arr].sort((a, b) => b.createdAt - a.createdAt);
}

export interface SecurityLog {
  id: string;
  timestamp: number;
  event: string;
  ip: string;
  location: string;
  severity: 'low' | 'medium' | 'high';
  isActionLog?: boolean; // True for manually added action logs
  createdBy?: string; // Username who created this action log
}

const handleError = (context: string, error: any) => {
  console.error(`Storage Service Error (${context}):`, error);
  if (error?.code === 'permission-denied') {
    console.warn(`
      🚨 PERMISSION DENIED 🚨
      1. Go to Firebase Console > Firestore Database > Rules.
      2. Ensure rules allow read/write. For development, use:
         allow read, write: if true;
      3. Do the same for Storage > Rules.
    `);
  }
};

export const storageService = {
  subscribeToAssets: (onUpdate: (assets: Asset[]) => void): (() => void) => {
    if (!isCloudEnabled) {
      const emit = () => onUpdate(sortByCreatedAtDesc(readLS<Asset[]>(LS_KEYS.assets, [])));
      emit();
      const handler = () => emit();
      window.addEventListener('storage', handler);
      window.addEventListener('byd_assets_hub_local_change', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('byd_assets_hub_local_change', handler);
      };
    }

    const q = query(collection(db!, ASSETS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const assets: Asset[] = [];
      snapshot.forEach((doc) => {
        assets.push({ id: doc.id, ...doc.data() } as Asset);
      });
      onUpdate(assets);
    }, (error) => handleError('subscribeToAssets', error));
  },

  subscribeToConfig: (onUpdate: (config: SystemConfig) => void): (() => void) => {
    if (!isCloudEnabled) {
      const emit = () => onUpdate(readLS<SystemConfig>(LS_KEYS.config, DEFAULT_CONFIG));
      emit();
      const handler = () => emit();
      window.addEventListener('storage', handler);
      window.addEventListener('byd_assets_hub_local_change', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('byd_assets_hub_local_change', handler);
      };
    }

    const defaults: SystemConfig = DEFAULT_CONFIG;
    return onSnapshot(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as SystemConfig);
      } else {
        setDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), defaults).catch(e => handleError('initSystemConfig', e));
        onUpdate(defaults);
      }
    }, (error) => {
      handleError('subscribeToConfig', error);
      onUpdate(defaults);
    });
  },

  subscribeToUsers: (onUpdate: (users: User[]) => void): (() => void) => {
    if (!isCloudEnabled) {
      const emit = () => onUpdate(readLS<User[]>(LS_KEYS.users, []));
      emit();
      const handler = () => emit();
      window.addEventListener('storage', handler);
      window.addEventListener('byd_assets_hub_local_change', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('byd_assets_hub_local_change', handler);
      };
    }

    return onSnapshot(collection(db!, USERS_COLLECTION), (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() } as User));
      onUpdate(users);
    }, (error) => handleError('subscribeToUsers', error));
  },

  subscribeToCollections: (onUpdate: (collections: Collection[]) => void): (() => void) => {
    if (!isCloudEnabled) {
      const emit = () => onUpdate(sortByCreatedAtDesc(readLS<Collection[]>(LS_KEYS.collections, [])));
      emit();
      const handler = () => emit();
      window.addEventListener('storage', handler);
      window.addEventListener('byd_assets_hub_local_change', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('byd_assets_hub_local_change', handler);
      };
    }

    const q = query(collection(db!, COLLECTIONS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const colls: Collection[] = [];
      snapshot.forEach((doc) => colls.push({ id: doc.id, ...doc.data() } as Collection));
      onUpdate(colls);
    }, (error) => handleError('subscribeToCollections', error));
  },

  subscribeToSecurityLogs: (onUpdate: (logs: SecurityLog[]) => void): (() => void) => {
    if (!isCloudEnabled) {
      const emit = () => {
        const logs = readLS<SecurityLog[]>(LS_KEYS.securityLogs, []);
        onUpdate([...logs].sort((a, b) => b.timestamp - a.timestamp));
      };
      emit();
      const handler = () => emit();
      window.addEventListener('storage', handler);
      window.addEventListener('byd_assets_hub_local_change', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('byd_assets_hub_local_change', handler);
      };
    }

    const q = query(collection(db!, SECURITY_LOGS_COLLECTION), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const logs: SecurityLog[] = [];
      snapshot.forEach((doc) => logs.push({ id: doc.id, ...doc.data() } as SecurityLog));
      onUpdate(logs);
    }, (error) => handleError('subscribeToSecurityLogs', error));
  },

  logSecurityEvent: async (event: string, severity: 'low' | 'medium' | 'high', ip?: string, location?: string) => {
    try {
      // Get real IP and location if not provided
      let realIp = ip;
      let realLocation = location;

      if (!realIp || !realLocation) {
        try {
          const ipInfo = await fetch('/api/get-ip-info').then(r => r.json());
          realIp = ipInfo.ip || 'unknown';
          realLocation = ipInfo.location || 'Unknown Location';
        } catch {
          // Fallback if API fails
          realIp = realIp || 'unknown';
          realLocation = realLocation || 'Unknown Location';
        }
      }

      const payload = {
        id: `log_${Date.now()}`,
        event,
        timestamp: Date.now(),
        ip: realIp,
        location: realLocation,
        severity,
        isActionLog: false
      };

      if (!isCloudEnabled) {
        const existing = readLS<SecurityLog[]>(LS_KEYS.securityLogs, []);
        writeLS(LS_KEYS.securityLogs, [payload, ...existing].slice(0, 200));
        return;
      }

      await addDoc(collection(db!, SECURITY_LOGS_COLLECTION), payload);
    } catch (e) {
      // Don't loop logs on failure
      console.warn("Could not log security event:", e);
    }
  },

  addActionLog: async (event: string, severity: 'low' | 'medium' | 'high', createdBy: string, ip?: string, location?: string): Promise<void> => {
    try {
      let realIp = ip;
      let realLocation = location;

      if (!realIp || !realLocation) {
        try {
          const ipInfo = await fetch('/api/get-ip-info').then(r => r.json());
          realIp = ipInfo.ip || 'unknown';
          realLocation = ipInfo.location || 'Unknown Location';
        } catch {
          realIp = realIp || 'unknown';
          realLocation = realLocation || 'Unknown Location';
        }
      }

      const payload = {
        id: `action_${Date.now()}`,
        event,
        timestamp: Date.now(),
        ip: realIp,
        location: realLocation,
        severity,
        isActionLog: true,
        createdBy
      };

      if (!isCloudEnabled) {
        const existing = readLS<SecurityLog[]>(LS_KEYS.securityLogs, []);
        writeLS(LS_KEYS.securityLogs, [payload, ...existing].slice(0, 200));
        return;
      }

      await addDoc(collection(db!, SECURITY_LOGS_COLLECTION), payload);
    } catch (error) {
      handleError('addActionLog', error);
      throw error;
    }
  },

  updateActionLog: async (logId: string, updates: Partial<SecurityLog>): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<SecurityLog[]>(LS_KEYS.securityLogs, []);
        const next = existing.map(log => 
          log.id === logId && log.isActionLog 
            ? { ...log, ...updates } as SecurityLog 
            : log
        );
        writeLS(LS_KEYS.securityLogs, next);
        return;
      }

      const logRef = doc(db!, SECURITY_LOGS_COLLECTION, logId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) {
        throw new Error('Action log not found');
      }
      const logData = logSnap.data() as SecurityLog;
      if (!logData.isActionLog) {
        throw new Error('Only action logs can be modified');
      }

      await updateDoc(logRef, updates);
    } catch (error) {
      handleError('updateActionLog', error);
      throw error;
    }
  },

  deleteActionLog: async (logId: string): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<SecurityLog[]>(LS_KEYS.securityLogs, []);
        const log = existing.find(l => l.id === logId);
        if (!log || !log.isActionLog) {
          throw new Error('Only action logs can be deleted');
        }
        writeLS(LS_KEYS.securityLogs, existing.filter(l => l.id !== logId));
        return;
      }

      const logRef = doc(db!, SECURITY_LOGS_COLLECTION, logId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) {
        throw new Error('Action log not found');
      }
      const logData = logSnap.data() as SecurityLog;
      if (!logData.isActionLog) {
        throw new Error('Only action logs can be deleted');
      }

      await deleteDoc(logRef);
    } catch (error) {
      handleError('deleteActionLog', error);
      throw error;
    }
  },

  clearAllSecurityLogs: async (): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        writeLS(LS_KEYS.securityLogs, []);
        return;
      }

      // Delete all logs from Firestore
      const q = query(collection(db!, SECURITY_LOGS_COLLECTION));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleError('clearAllSecurityLogs', error);
      throw error;
    }
  },

  addAsset: async (asset: Omit<Asset, 'id' | 'createdAt' | 'size' | 'status'>, file?: File, onProgress?: (progress: number) => void): Promise<void> => {
    let publicUrl = asset.url;
    let size = 0;

    try {
      if (file) {
        size = file.size;

        if (!isCloudEnabled || !storage) {
          // Local fallback: store file as data URL (works in AI Studio too)
          if (onProgress) onProgress(50); // Simulate progress
          publicUrl = await fileToDataUrl(file);
          if (onProgress) onProgress(100);
        } else {
          try {
            // Preserve original filename for videos and other files
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storageRef = ref(storage, `content/${Date.now()}-${sanitizedFileName}`);
            
            // Upload with metadata to preserve content type (important for videos)
            // For MOV/APCN files, force video/mp4 so browsers can play them
            let contentType = file.type || 'application/octet-stream';
            const fileNameLower = file.name.toLowerCase();
            if (fileNameLower.endsWith('.mov') || fileNameLower.endsWith('.qt') || fileNameLower.endsWith('.apcn') || file.type === 'video/quicktime') {
              contentType = 'video/mp4'; // Force MP4 MIME type for MOV/APCN files
            }
            
            const metadata = {
              contentType: contentType,
              customMetadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString()
              }
            };
            
            const useResumable = file.size >= 5 * 1024 * 1024;
            let uploadedRef = storageRef;
            if (useResumable) {
              // Use uploadBytesResumable for large files with progress tracking
              const uploadTask = uploadBytesResumable(storageRef, file, metadata);
              
              // Track upload progress
              await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                  (snapshot) => {
                    // Calculate progress percentage
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) {
                      onProgress(progress);
                    }
                  },
                  (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                  },
                  async () => {
                    // Upload completed successfully
                    const snapshot = await uploadTask;
                    uploadedRef = snapshot.ref;
                    publicUrl = await getDownloadURL(snapshot.ref);
                    if (onProgress) onProgress(100);
                    resolve();
                  }
                );
              });
            } else {
              // Small files: faster direct upload, no resumable overhead
              const snapshot = await uploadBytes(storageRef, file, metadata);
              uploadedRef = snapshot.ref;
              publicUrl = await getDownloadURL(snapshot.ref);
              if (onProgress) onProgress(100);
            }
            
            console.log('File uploaded successfully:', {
              type: file.type,
              size: file.size,
              fileName: file.name,
              url: publicUrl.substring(0, 100) + '...',
              storagePath: uploadedRef.fullPath
            });
          } catch (uploadError) {
            console.error('Firebase Storage upload failed:', uploadError);
            // Fallback to data URL if Firebase Storage fails
            if (onProgress) onProgress(50);
            publicUrl = await fileToDataUrl(file);
            if (onProgress) onProgress(100);
            console.warn('Using data URL fallback for asset');
          }
        }
      } else if (asset.content) {
        size = new Blob([asset.content]).size;
        if (onProgress) onProgress(100);
      }

      // Filter out undefined values (Firestore doesn't allow undefined)
      const cleanAsset = Object.fromEntries(
        Object.entries(asset).filter(([_, v]) => v !== undefined)
      ) as Omit<Asset, 'id' | 'createdAt' | 'size' | 'status'>;

      const payload: any = { 
        ...cleanAsset, 
        url: publicUrl || '', 
        createdAt: Date.now(),
        size: size,
        status: 'Approved' as AssetStatus,
        market: asset.market,
        platform: asset.platform,
        carModel: asset.carModel,
        ...(asset.carModels ? { carModels: asset.carModels } : {}),
        objectives: asset.objectives || [],
        uploadedBy: asset.uploadedBy || 'Anonymous'
      };

      // Final filter to remove any undefined values from the payload
      const finalPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined)
      ) as Omit<Asset, 'id'>;

      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAsset = { ...finalPayload, id } as Asset;
        writeLS(LS_KEYS.assets, [newAsset, ...existing]);
        await storageService.logSecurityEvent(`Asset Published (local): ${asset.title}`, 'low');
        return;
      }

      const docRef = await addDoc(collection(db!, ASSETS_COLLECTION), finalPayload);
      console.log('Asset saved successfully with ID:', docRef.id);
      await storageService.logSecurityEvent(`Asset Published: ${asset.title}`, 'low');
    } catch (error) {
      console.error('addAsset error:', error);
      handleError('addAsset', error);
      throw error;
    }
  },

  updateAsset: async (id: string, updates: Partial<Asset>): Promise<void> => {
    try {
      // Filter out undefined values (Firestore doesn't like undefined)
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      ) as Partial<Asset>;

      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const next = existing.map(a => a.id === id ? ({ ...a, ...cleanUpdates } as Asset) : a);
        writeLS(LS_KEYS.assets, next);
        return;
      }
      await updateDoc(doc(db!, ASSETS_COLLECTION, id), cleanUpdates);
    } catch (error) {
      handleError('updateAsset', error);
      throw error;
    }
  },

  // Helper function to extract storage path from Firebase Storage URL
  extractStoragePath: (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname === 'firebasestorage.googleapis.com' || u.hostname === 'storage.googleapis.com') {
        // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH%2FTO%2FFILE?alt=media&token=...
        const pathMatch = u.pathname.match(/\/o\/(.+)/);
        if (pathMatch) {
          return decodeURIComponent(pathMatch[1]);
        }
      }
    } catch {
      // Not a Firebase Storage URL (could be data URL or other)
    }
    return null;
  },

  // Helper function to delete a file from Storage
  deleteFileFromStorage: async (url: string, assetId: string): Promise<void> => {
    if (!url || !storage) return;
    
    const storagePath = storageService.extractStoragePath(url);
    if (storagePath) {
      try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
        console.log(`File deleted from Storage: ${storagePath} (asset: ${assetId})`);
      } catch (storageError: any) {
        // If file doesn't exist in storage (already deleted or never existed), log but don't fail
        if (storageError.code !== 'storage/object-not-found') {
          console.warn(`Failed to delete file from Storage (asset: ${assetId}):`, storageError);
        }
      }
    }
  },

  // Soft delete - moves asset to trash (sets deletedAt timestamp)
  deleteAsset: async (id: string): Promise<void> => {
    try {
      const now = Date.now();
      
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const updated = existing.map(a => 
          a.id === id ? { ...a, deletedAt: now } : a
        );
        writeLS(LS_KEYS.assets, updated);
        await storageService.logSecurityEvent(`Asset Moved to Trash (local): ${id}`, 'low');
        return;
      }

      // Get the asset to check for package
      const assetRef = doc(db!, ASSETS_COLLECTION, id);
      const assetSnap = await getDoc(assetRef);
      
      if (!assetSnap.exists()) {
        throw new Error('Asset not found');
      }

      const asset = { id: assetSnap.id, ...assetSnap.data() } as Asset;
      const packageId = asset.packageId;

      // If this is part of a package, move all package assets to trash
      if (packageId) {
        const packageQuery = query(
          collection(db!, ASSETS_COLLECTION),
          where('packageId', '==', packageId)
        );
        const packageSnapshot = await getDocs(packageQuery);
        
        // Filter out already deleted assets
        const nonDeletedDocs = packageSnapshot.docs.filter(docSnap => !docSnap.data().deletedAt);
        
        // Soft delete all package assets
        const updatePromises = nonDeletedDocs.map(docSnap => 
          updateDoc(docSnap.ref, { deletedAt: now })
        );
        
        await Promise.all(updatePromises);
        await storageService.logSecurityEvent(`Package Moved to Trash: ${packageId} (${nonDeletedDocs.length} assets)`, 'low');
      } else {
        // Single asset - soft delete
        await updateDoc(assetRef, { deletedAt: now });
        await storageService.logSecurityEvent(`Asset Moved to Trash: ${id}`, 'low');
      }
    } catch (error) {
      handleError('deleteAsset', error);
      throw error;
    }
  },

  // Restore asset from trash (removes deletedAt)
  restoreAsset: async (id: string): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const updated = existing.map(a => 
          a.id === id ? { ...a, deletedAt: undefined } : a
        );
        writeLS(LS_KEYS.assets, updated);
        await storageService.logSecurityEvent(`Asset Restored (local): ${id}`, 'low');
        return;
      }

      // Get the asset to check for package
      const assetRef = doc(db!, ASSETS_COLLECTION, id);
      const assetSnap = await getDoc(assetRef);
      
      if (!assetSnap.exists()) {
        throw new Error('Asset not found');
      }

      const asset = { id: assetSnap.id, ...assetSnap.data() } as Asset;
      const packageId = asset.packageId;

      // If this is part of a package, restore all package assets
      if (packageId) {
        const packageQuery = query(
          collection(db!, ASSETS_COLLECTION),
          where('packageId', '==', packageId)
        );
        const packageSnapshot = await getDocs(packageQuery);
        
        // Restore all package assets (only those that are deleted)
        const deletedDocs = packageSnapshot.docs.filter(docSnap => docSnap.data().deletedAt);
        const updatePromises = deletedDocs.map(docSnap => {
          const updateData: any = { deletedAt: null };
          return updateDoc(docSnap.ref, updateData);
        });
        
        await Promise.all(updatePromises);
        await storageService.logSecurityEvent(`Package Restored: ${packageId}`, 'low');
      } else {
        // Single asset - restore
        await updateDoc(assetRef, { deletedAt: null });
        await storageService.logSecurityEvent(`Asset Restored: ${id}`, 'low');
      }
    } catch (error) {
      handleError('restoreAsset', error);
      throw error;
    }
  },

  // Permanently delete asset (removes from Storage and Firestore)
  permanentlyDeleteAsset: async (id: string): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        writeLS(LS_KEYS.assets, existing.filter(a => a.id !== id));
        await storageService.logSecurityEvent(`Asset Permanently Deleted (local): ${id}`, 'medium');
        return;
      }

      // First, get the asset to retrieve its URL and check for package
      const assetRef = doc(db!, ASSETS_COLLECTION, id);
      const assetSnap = await getDoc(assetRef);
      
      if (!assetSnap.exists()) {
        throw new Error('Asset not found');
      }

      const asset = { id: assetSnap.id, ...assetSnap.data() } as Asset;
      const packageId = asset.packageId;

      // If this is part of a package, permanently delete all package assets
      if (packageId) {
        const packageQuery = query(
          collection(db!, ASSETS_COLLECTION),
          where('packageId', '==', packageId)
        );
        const packageSnapshot = await getDocs(packageQuery);
        
        // Permanently delete all package assets from Storage and Firestore
        const deletePromises = packageSnapshot.docs.map(async (docSnap) => {
          const pkgAsset = { id: docSnap.id, ...docSnap.data() } as Asset;
          
          // Delete file from Storage
          await storageService.deleteFileFromStorage(pkgAsset.url, pkgAsset.id);
          
          // Delete Firestore document
          return deleteDoc(docSnap.ref);
        });
        
        await Promise.all(deletePromises);
        await storageService.logSecurityEvent(`Package Permanently Deleted: ${packageId} (${packageSnapshot.docs.length} assets)`, 'medium');
      } else {
        // Single asset - delete file from Storage first, then Firestore document
        await storageService.deleteFileFromStorage(asset.url, asset.id);
        await deleteDoc(assetRef);
        await storageService.logSecurityEvent(`Asset Permanently Deleted: ${id}`, 'medium');
      }
    } catch (error) {
      handleError('permanentlyDeleteAsset', error);
      throw error;
    }
  },

  // Cleanup deleted assets older than 3 days (auto-permanent delete)
  cleanupDeletedAssets: async (): Promise<void> => {
    try {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days in milliseconds
      
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const toDelete = existing.filter(a => a.deletedAt && a.deletedAt < threeDaysAgo);
        const remaining = existing.filter(a => !a.deletedAt || a.deletedAt >= threeDaysAgo);
        writeLS(LS_KEYS.assets, remaining);
        
        if (toDelete.length > 0) {
          console.log(`Auto-deleted ${toDelete.length} assets from trash (local)`);
          await storageService.logSecurityEvent(`Auto-cleanup: ${toDelete.length} assets permanently deleted`, 'low');
        }
        return;
      }

      // Find all assets (we'll filter by deletedAt in code since Firestore can't query null efficiently)
      const allAssetsQuery = query(collection(db!, ASSETS_COLLECTION));
      const snapshot = await getDocs(allAssetsQuery);
      
      const assetsToDelete: Asset[] = [];
      snapshot.forEach((docSnap) => {
        const asset = { id: docSnap.id, ...docSnap.data() } as Asset;
        if (asset.deletedAt && asset.deletedAt < threeDaysAgo) {
          assetsToDelete.push(asset);
        }
      });

      if (assetsToDelete.length === 0) {
        return; // Nothing to clean up
      }

      // Group by packageId to avoid duplicate package deletions
      const packageIds = new Set<string>();
      const standaloneAssets: Asset[] = [];

      assetsToDelete.forEach(asset => {
        if (asset.packageId) {
          packageIds.add(asset.packageId);
        } else {
          standaloneAssets.push(asset);
        }
      });

      // Permanently delete standalone assets
      for (const asset of standaloneAssets) {
        await storageService.permanentlyDeleteAsset(asset.id);
      }

      // Permanently delete packages (one call per package will delete all assets in it)
      for (const packageId of packageIds) {
        const packageAssets = assetsToDelete.filter(a => a.packageId === packageId);
        if (packageAssets.length > 0) {
          // Delete the first asset in the package, which will delete the whole package
          await storageService.permanentlyDeleteAsset(packageAssets[0].id);
        }
      }

      console.log(`Auto-deleted ${assetsToDelete.length} assets from trash`);
      await storageService.logSecurityEvent(`Auto-cleanup: ${assetsToDelete.length} assets permanently deleted`, 'low');
    } catch (error) {
      handleError('cleanupDeletedAssets', error);
      // Don't throw - this is a background cleanup task
      console.error('Cleanup error (non-fatal):', error);
    }
  },

  saveSystemConfig: async (config: SystemConfig): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        writeLS(LS_KEYS.config, config);
        return;
      }
      await setDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), config);
    } catch (error) {
      handleError('saveSystemConfig', error);
      throw error;
    }
  },

  saveUser: async (user: User): Promise<void> => {
    try {
      const userId = user.id || user.username.toLowerCase();
      const payload = { ...user, id: userId };
      if (!isCloudEnabled) {
        const existing = readLS<User[]>(LS_KEYS.users, []);
        const next = existing.some(u => u.id === userId)
          ? existing.map(u => u.id === userId ? (payload as User) : u)
          : [...existing, payload as User];
        writeLS(LS_KEYS.users, next);
        return;
      }
      await setDoc(doc(db!, USERS_COLLECTION, userId), payload);
    } catch (error) {
      handleError('saveUser', error);
      throw error;
    }
  },

  removeUser: async (userId: string): Promise<void> => {
    // Prevent removing super admin (fakhri)
    if (userId === 'admin_001' || userId === 'fakhri') {
      throw new Error('Cannot remove super admin. Super admin access is permanent.');
    }
    
    try {
      if (!isCloudEnabled) {
        const existing = readLS<User[]>(LS_KEYS.users, []);
        const userToRemove = existing.find(u => u.id === userId);
        if (userToRemove?.isSuperAdmin) {
          throw new Error('Cannot remove super admin. Super admin access is permanent.');
        }
        writeLS(LS_KEYS.users, existing.filter(u => u.id !== userId && !u.isSuperAdmin));
        return;
      }
      
      // Check if user is super admin in Firestore
      const userDocRef = doc(db!, USERS_COLLECTION, userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        if (userData.isSuperAdmin || userId === 'admin_001' || userId === 'fakhri') {
          throw new Error('Cannot remove super admin. Super admin access is permanent.');
        }
      }
      
      await deleteDoc(doc(db!, USERS_COLLECTION, userId));
    } catch (error: any) {
      if (error.message?.includes('super admin')) {
        throw error;
      }
      handleError('removeUser', error);
      throw error;
    }
  },

  saveCollection: async (collectionData: Omit<Collection, 'id'>): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<Collection[]>(LS_KEYS.collections, []);
        const id = `collection_${Date.now()}`;
        writeLS(LS_KEYS.collections, [{ ...(collectionData as any), id } as Collection, ...existing]);
        return;
      }
      await addDoc(collection(db!, COLLECTIONS_COLLECTION), collectionData);
    } catch (error) {
      handleError('saveCollection', error);
      throw error;
    }
  },

  verifyCloudUser: async (username: string): Promise<User | null> => {
    try {
      const uname = username.toLowerCase();
      if (!isCloudEnabled) {
        const users = readLS<User[]>(LS_KEYS.users, []);
        return users.find(u => u.username?.toLowerCase() === uname) || null;
      }

      const q = query(collection(db!, USERS_COLLECTION), where("username", "==", uname));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) return snapshot.docs[0].data() as User;
      return null;
    } catch (error) {
      handleError('verifyCloudUser', error);
      return null;
    }
  }
};