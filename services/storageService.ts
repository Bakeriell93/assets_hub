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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Asset, Market, CarModel, Platform, User, SystemConfig, MARKETS, CAR_MODELS, PLATFORMS, Collection } from '../types';

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

  logSecurityEvent: async (event: string, severity: 'low' | 'medium' | 'high') => {
    const mockIPs = ['192.168.1.1', '45.12.33.2', '104.28.14.12', '185.22.14.99'];
    const mockLocs = ['Frankfurt, DE', 'Shenzhen, CN', 'St. Petersburg, RU', 'San Jose, US'];
    
    try {
      const payload = {
        id: `log_${Date.now()}`,
        event,
        timestamp: Date.now(),
        ip: mockIPs[Math.floor(Math.random() * mockIPs.length)],
        location: mockLocs[Math.floor(Math.random() * mockLocs.length)],
        severity
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

  addAsset: async (asset: Omit<Asset, 'id' | 'createdAt' | 'size' | 'status'>, file?: File): Promise<void> => {
    let publicUrl = asset.url;
    let size = 0;

    try {
      if (file) {
        size = file.size;

        if (!isCloudEnabled || !storage) {
          // Local fallback: store file as data URL (works in AI Studio too)
          publicUrl = await fileToDataUrl(file);
        } else {
          const storageRef = ref(storage, `content/${Date.now()}-${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          publicUrl = await getDownloadURL(snapshot.ref);
        }
      } else if (asset.content) {
        size = new Blob([asset.content]).size;
      }

      const payload = { 
        ...asset, 
        url: publicUrl || '', 
        createdAt: Date.now(),
        size: size,
        status: 'Approved' 
      };

      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const id = `asset_${Date.now()}`;
        writeLS(LS_KEYS.assets, [{ ...(payload as any), id } as Asset, ...existing]);
        await storageService.logSecurityEvent(`Asset Published (local): ${asset.title}`, 'low');
        return;
      }

      await addDoc(collection(db!, ASSETS_COLLECTION), payload);
      await storageService.logSecurityEvent(`Asset Published: ${asset.title}`, 'low');
    } catch (error) {
      handleError('addAsset', error);
      throw error;
    }
  },

  updateAsset: async (id: string, updates: Partial<Asset>): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        const next = existing.map(a => a.id === id ? ({ ...a, ...updates } as Asset) : a);
        writeLS(LS_KEYS.assets, next);
        return;
      }
      await updateDoc(doc(db!, ASSETS_COLLECTION, id), updates);
    } catch (error) {
      handleError('updateAsset', error);
      throw error;
    }
  },

  deleteAsset: async (id: string): Promise<void> => {
    try {
      if (!isCloudEnabled) {
        const existing = readLS<Asset[]>(LS_KEYS.assets, []);
        writeLS(LS_KEYS.assets, existing.filter(a => a.id !== id));
        await storageService.logSecurityEvent(`Asset Deleted (local): ${id}`, 'medium');
        return;
      }

      await deleteDoc(doc(db!, ASSETS_COLLECTION, id));
      await storageService.logSecurityEvent(`Asset Deleted: ${id}`, 'medium');
    } catch (error) {
      handleError('deleteAsset', error);
      throw error;
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