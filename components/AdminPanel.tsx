
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Asset, SystemConfig, Brand, BRANDS, Market, MARKETS, CAR_MODELS, DENZA_MODELS, getAssetBrands } from '../types';
import { storageService, SecurityLog, DownloadLog, LoginLog } from '../services/storageService';
import { storage } from '../services/firebase';
import { getMetadata, ref as storageRef } from 'firebase/storage';

interface AdminPanelProps {
  onClose: () => void;
  assets: Asset[];
  config: SystemConfig;
  users: User[];
  currentUser: User;
}

// Helper to check if user is super admin
const isSuperAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.id === 'admin_001' || user.username === 'fakhri' || user.isSuperAdmin === true;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, assets, config, users, currentUser }) => {
  const isEditor = currentUser.role === 'Editor';
  const isAdmin = currentUser.role === 'Admin';
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'stats' | 'security' | 'downloads'>(isEditor ? 'config' : 'users');
  type ActivityRange = '7' | '14' | '30' | '90' | 'all';
  const [activityRange, setActivityRange] = useState<ActivityRange>('30');
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingConfig, setIsAddingConfig] = useState<keyof SystemConfig | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  // Backfill cache for older assets that may not have `size` stored in Firestore.
  const [resolvedAssetSizes, setResolvedAssetSizes] = useState<Record<string, number>>({});

  // Action logs management (super admin only)
  const [isAddingActionLog, setIsAddingActionLog] = useState(false);
  const [editingActionLog, setEditingActionLog] = useState<SecurityLog | null>(null);
  const [newActionLog, setNewActionLog] = useState({ event: '', severity: 'medium' as 'low' | 'medium' | 'high' });

  // Form states
  const [newUser, setNewUser] = useState<{ fullName: string; username: string; password: string; role: UserRole; allowedMarkets: Market[] }>({ fullName: '', username: '', password: '', role: 'Viewer', allowedMarkets: [] });
  const [newConfigValue, setNewConfigValue] = useState('');
  const [editingConfigItem, setEditingConfigItem] = useState<{ type: 'markets' | 'platforms'; oldValue: string } | null>(null);
  const [editingConfigNewValue, setEditingConfigNewValue] = useState('');
  const [addingModelForBrand, setAddingModelForBrand] = useState<Brand | null>(null);
  const [newModelValue, setNewModelValue] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubLogs = storageService.subscribeToSecurityLogs(setSecurityLogs);
    return () => unsubLogs();
  }, []);

  useEffect(() => {
    const unsubDownloads = storageService.subscribeToDownloadLogs(setDownloadLogs);
    return () => unsubDownloads();
  }, []);

  useEffect(() => {
    const unsubLogins = storageService.subscribeToLoginLogs(setLoginLogs);
    return () => unsubLogins();
  }, []);

  // Initialize action log form when editing
  useEffect(() => {
    if (editingActionLog) {
      setNewActionLog({ event: editingActionLog.event, severity: editingActionLog.severity });
    }
  }, [editingActionLog]);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tryResolveRemoteFileSize = async (url: string): Promise<number | null> => {
    // Prefer Firebase Storage metadata (most reliable).
    try {
      if (storage) {
        // firebase/storage ref() can handle gs:// and (in many cases) download URLs.
        const r = storageRef(storage, url);
        const meta = await getMetadata(r);
        if (typeof meta.size === 'number' && meta.size > 0) return meta.size;
      }
    } catch {
      // ignore and fall back
    }

    // Best effort only. Firebase Storage download URLs usually allow HEAD, but if not,
    // fallback to GET with Range and parse Content-Range.
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const len = head.headers.get('content-length');
      if (len) return Number(len);
    } catch {
      // ignore
    }

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });
      const contentRange = resp.headers.get('content-range'); // "bytes 0-0/12345"
      if (contentRange && contentRange.includes('/')) {
        const total = contentRange.split('/').pop();
        if (total) return Number(total);
      }
      const len = resp.headers.get('content-length');
      if (len) return Number(len);
    } catch {
      // ignore
    }

    return null;
  };

  // Backfill missing sizes from URL headers (so "Cloud Storage Load" is accurate).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const missing = assets.filter(a => !a.size && a.url && !resolvedAssetSizes[a.id]);
      if (missing.length === 0) return;

      const updates: Record<string, number> = {};
      await Promise.all(
        missing.map(async (a) => {
          const bytes = await tryResolveRemoteFileSize(a.url!);
          if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0) {
            updates[a.id] = bytes;
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setResolvedAssetSizes(prev => ({ ...prev, ...updates }));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [assets, resolvedAssetSizes]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.fullName && newUser.username) {
      await storageService.saveUser({
        id: newUser.username.toLowerCase(),
        username: newUser.username.toLowerCase(),
        fullName: newUser.fullName,
        role: newUser.role,
        password: newUser.password,
        createdAt: Date.now(),
        allowedMarkets: newUser.allowedMarkets.length > 0 ? newUser.allowedMarkets : undefined,
      });
      setIsAddingUser(false);
      setNewUser({ fullName: '', username: '', password: '', role: 'Viewer', allowedMarkets: [] });
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    
    const userToEdit = users.find(u => u.id === editingUserId);
    if (!userToEdit) return;

    // Prevent editing super admin
    if (isSuperAdmin(userToEdit)) {
      alert('Super admin details cannot be modified.');
      setEditingUserId(null);
      setNewUser({ fullName: '', username: '', password: '', role: 'Viewer' });
      return;
    }

    try {
      await storageService.saveUser({
        ...userToEdit,
        fullName: newUser.fullName,
        username: newUser.username.toLowerCase(),
        role: newUser.role,
        password: newUser.password || userToEdit.password, // Keep existing password if not changed
        allowedMarkets: newUser.allowedMarkets.length > 0 ? newUser.allowedMarkets : undefined,
      });
      await storageService.logSecurityEvent(`User updated: ${userToEdit.username} by ${currentUser.username}`, 'low');
      setEditingUserId(null);
      setNewUser({ fullName: '', username: '', password: '', role: 'Viewer', allowedMarkets: [] });
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  };

  // Initialize edit form when editing user
  useEffect(() => {
    if (editingUserId) {
      const userToEdit = users.find(u => u.id === editingUserId);
      if (userToEdit) {
        setNewUser({
          fullName: userToEdit.fullName,
          username: userToEdit.username,
          password: '', // Don't pre-fill password for security
          role: userToEdit.role,
          allowedMarkets: userToEdit.allowedMarkets && userToEdit.allowedMarkets.length > 0 ? [...userToEdit.allowedMarkets] : [],
        });
      }
    }
  }, [editingUserId, users]);

  const handleAddConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingConfig && newConfigValue && !config[isAddingConfig].includes(newConfigValue)) {
      await storageService.saveSystemConfig({
        ...config,
        [isAddingConfig]: [...config[isAddingConfig], newConfigValue]
      });
      setIsAddingConfig(null);
      setNewConfigValue('');
    }
  };

  const handleRenameConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfigItem || !editingConfigNewValue.trim()) return;
    const newVal = editingConfigNewValue.trim();
    const { type, oldValue } = editingConfigItem;
    if (newVal === oldValue) {
      setEditingConfigItem(null);
      setEditingConfigNewValue('');
      return;
    }
    if (config[type].includes(newVal)) {
      alert(`"${newVal}" already exists in ${type}.`);
      return;
    }
    const nextList = config[type].map(v => v === oldValue ? newVal : v);
    await storageService.saveSystemConfig({ ...config, [type]: nextList });
    if (type === 'platforms') {
      const toUpdate = assets.filter(a => a.platform === oldValue);
      for (const a of toUpdate) {
        await storageService.updateAsset(a.id, { platform: newVal });
      }
    } else if (type === 'markets') {
      const toUpdate = assets.filter(a => a.market === oldValue);
      for (const a of toUpdate) {
        await storageService.updateAsset(a.id, { market: newVal });
      }
    }
    setEditingConfigItem(null);
    setEditingConfigNewValue('');
  };

  const buildModelsByBrandMap = (): Record<string, string[]> => {
    const brandsList = config.brands ?? BRANDS;
    const hasBrandSpecificModels = !!config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0;
    const nextByBrand: Record<string, string[]> = {};
    brandsList.forEach(b => {
      nextByBrand[b] = hasBrandSpecificModels
        ? [...(config.modelsByBrand?.[b] ?? [])]
        : [...config.models];
    });
    return nextByBrand;
  };

  const modelsForBrand = (b: Brand): string[] => {
    const hasBrandSpecificModels = !!config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0;
    return hasBrandSpecificModels ? (config.modelsByBrand?.[b] ?? []) : config.models;
  };

  const handleAddModelForBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingModelForBrand || !newModelValue.trim()) return;
    const trimmed = newModelValue.trim();
    const list = modelsForBrand(addingModelForBrand);
    if (list.includes(trimmed)) {
      setNewModelValue('');
      setAddingModelForBrand(null);
      return;
    }
    const nextByBrand = buildModelsByBrandMap();
    nextByBrand[addingModelForBrand] = [...(nextByBrand[addingModelForBrand] ?? []), trimmed];
    const allModels = [...new Set([...Object.values(nextByBrand).flat(), ...config.models])];
    await storageService.saveSystemConfig({
      ...config,
      models: allModels,
      modelsByBrand: nextByBrand,
    });
    setNewModelValue('');
    setAddingModelForBrand(null);
  };

  const handleRemoveModelFromBrand = async (brand: Brand, model: string) => {
    const brandsList = config.brands ?? BRANDS;
    const nextByBrand = buildModelsByBrandMap();
    nextByBrand[brand] = (nextByBrand[brand] ?? []).filter(m => m !== model);
    const inOther = brandsList.some(b => b !== brand && (nextByBrand[b] ?? []).includes(model));
    const allModels = inOther ? config.models : config.models.filter(m => m !== model);
    await storageService.saveSystemConfig({
      ...config,
      models: allModels,
      modelsByBrand: nextByBrand,
    });
  };

  const handleMoveModelInBrand = async (brand: Brand, model: string, direction: 'up' | 'down') => {
    const nextByBrand = buildModelsByBrandMap();
    const list = [...(nextByBrand[brand] ?? [])];
    const idx = list.indexOf(model);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    [list[idx], list[targetIdx]] = [list[targetIdx], list[idx]];
    nextByBrand[brand] = list;
    await storageService.saveSystemConfig({
      ...config,
      modelsByBrand: nextByBrand,
    });
  };

  /** Recover markets and models from existing assets (adds missing; does not remove). */
  const handleRecoverFromAssets = async () => {
    const active = assets.filter(a => !a.deletedAt);
    const inferredMarkets = [...new Set(active.map(a => a.market).filter(Boolean))];
    const inferredModels = [...new Set(active.flatMap(a => [a.carModel, ...(a.carModels || [])].filter(Boolean)))];
    const byBrand: Record<string, string[]> = {};
    active.forEach(a => {
      const brands = getAssetBrands(a);
      const models = [a.carModel, ...(a.carModels || [])].filter(Boolean);
      brands.forEach(b => {
        if (!byBrand[b]) byBrand[b] = [];
        models.forEach(m => { if (m && !byBrand[b].includes(m)) byBrand[b].push(m); });
      });
    });
    const nextMarkets = [...new Set([...config.markets, ...inferredMarkets])];
    const nextModels = [...new Set([...config.models, ...inferredModels])];
    const brandsList = config.brands ?? BRANDS;
    const nextByBrand = buildModelsByBrandMap();
    brandsList.forEach(b => {
      const existing = nextByBrand[b] ?? [];
      const fromAssets = byBrand[b] ?? [];
      nextByBrand[b] = [...new Set([...existing, ...fromAssets])];
    });
    Object.keys(byBrand).forEach(b => {
      if (!brandsList.includes(b)) brandsList.push(b);
      const existing = nextByBrand[b] ?? [];
      nextByBrand[b] = [...new Set([...existing, ...(byBrand[b] ?? [])])];
    });
    await storageService.saveSystemConfig({
      ...config,
      markets: nextMarkets,
      models: nextModels,
      brands: [...new Set(brandsList)],
      modelsByBrand: nextByBrand,
    });
  };

  /** Default model list per brand (BYD vs Denza get different lists). */
  const getDefaultModelsForBrand = (brand: Brand): string[] =>
    brand === 'Denza' ? [...DENZA_MODELS] : [...CAR_MODELS];

  /** Download current config as JSON backup file. */
  const handleBackupMetadata = () => {
    const payload = { ...config, _backupAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_metadata_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Restore config from a previously backed-up JSON file. */
  const handleImportMetadata = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(parsed.markets) || !Array.isArray(parsed.models) || !Array.isArray(parsed.platforms)) {
        alert('Invalid backup file: must contain markets, models, and platforms arrays.');
        return;
      }
      const restored: SystemConfig = {
        markets: parsed.markets as Market[],
        models: parsed.models as string[],
        platforms: parsed.platforms as string[],
        brands: Array.isArray(parsed.brands) ? (parsed.brands as Brand[]) : config.brands,
        modelsByBrand: parsed.modelsByBrand && typeof parsed.modelsByBrand === 'object' && !Array.isArray(parsed.modelsByBrand)
          ? (parsed.modelsByBrand as SystemConfig['modelsByBrand']) : config.modelsByBrand,
      };
      await storageService.saveSystemConfig(restored);
      alert('Metadata restored from backup.');
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Invalid file'));
    }
  };

  /** Restore default markets, models, and fill empty brand model lists (Denza gets Denza models, not BYD). */
  const handleRestoreDefaults = async () => {
    const nextMarkets = [...new Set([...config.markets, ...MARKETS])];
    const defaultModelsUnion = [...new Set([...CAR_MODELS, ...DENZA_MODELS])];
    const nextModels = [...new Set([...config.models, ...defaultModelsUnion])];
    const brandsList = config.brands ?? BRANDS;
    const nextByBrand = { ...(config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0 ? config.modelsByBrand : {}) };
    brandsList.forEach(b => {
      const defaults = getDefaultModelsForBrand(b);
      const current = nextByBrand[b];
      if (b === 'Denza') {
        // Denza gets only Denza models (fix BYD models duplicated under Denza)
        nextByBrand[b] = [...DENZA_MODELS];
      } else if (!current || current.length === 0) {
        nextByBrand[b] = [...defaults];
      } else {
        nextByBrand[b] = [...new Set([...current, ...defaults])];
      }
    });
    await storageService.saveSystemConfig({
      ...config,
      markets: nextMarkets,
      models: nextModels,
      modelsByBrand: nextByBrand,
    });
  };

  const totalBytes = assets.reduce((acc, asset) => acc + (asset.size || resolvedAssetSizes[asset.id] || 0), 0);
  const storageFormatted = formatSize(totalBytes);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xl" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[85vh] border border-white/20">
        
        {/* Header */}
        <div className="px-12 py-10 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Command Center</h2>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mt-1">BYD Infrastructure Hub • Live State</p>
          </div>
          <button onClick={onClose} className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group">
            <svg className="w-6 h-6 text-gray-900 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-80 bg-gray-50/50 border-r border-gray-100 p-10 space-y-4">
            {([
              { id: 'users', label: 'Team Identities', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { id: 'config', label: 'System Metadata', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
              { id: 'stats', label: 'Live Telemetry', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 01-2 2h22a2 2 0 01-2-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6' },
              { id: 'downloads', label: 'Usage & Activity', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
              { id: 'security', label: 'Threat Monitor', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }
            ] as const).filter(tab => !isEditor || tab.id === 'config' || tab.id === 'downloads').map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-5 px-6 py-5 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                  activeTab === tab.id ? 'bg-gray-900 text-white shadow-2xl' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                {tab.label}
              </button>
            ))}
          </aside>

          <main className="flex-1 p-12 overflow-y-auto bg-white">
            {activeTab === 'users' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">Access Control Registry</h3>
                  {!isAddingUser && (
                    <button 
                      onClick={() => { setNewUser({ fullName: '', username: '', password: '', role: 'Viewer', allowedMarkets: [] }); setEditingUserId(null); setIsAddingUser(true); }} 
                      className="px-8 py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                      Provision New User
                    </button>
                  )}
                </div>

                {(isAddingUser || editingUserId) && (
                  <form onSubmit={editingUserId ? handleEditUserSubmit : handleAddUserSubmit} className="bg-gray-50 p-10 rounded-[48px] border border-gray-100 space-y-8 animate-in zoom-in-95 duration-300">
                    <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                      {editingUserId ? 'Edit User Identity' : 'Provision New User'}
                    </h4>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                        <input required type="text" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm" placeholder="e.g. Fakhri Ashour" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unique Username</label>
                        <input required type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} disabled={!!editingUserId} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm disabled:bg-gray-100 disabled:text-gray-500" placeholder="fakhri_admin" />
                        {editingUserId && (
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight mt-1">Username cannot be changed</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                          Secure Key (Password) {editingUserId && <span className="text-gray-400 normal-case">(leave blank to keep current)</span>}
                        </label>
                        <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required={!editingUserId} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm" placeholder={editingUserId ? "•••••••• (optional)" : "••••••••"} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Permission Tier</label>
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm">
                          <option value="Viewer">Viewer (Read-Only Access)</option>
                          <option value="Editor">Editor (Creative Upload/Modify)</option>
                          <option value="Admin">Admin (Full Node Control)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned markets (view access)</label>
                      <p className="text-xs text-gray-600">Choose which markets this user can see. Leave &quot;All markets&quot; checked for full access, or uncheck it and select specific markets.</p>
                      <div className="p-5 bg-white rounded-2xl border border-gray-200 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUser.allowedMarkets.length === 0}
                            onChange={(e) => setNewUser({ ...newUser, allowedMarkets: e.target.checked ? [] : (config.markets.length ? [config.markets[0]] : ['Global']) })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-sm font-bold">All markets</span>
                        </label>
                        {['Global', ...config.markets].map(m => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newUser.allowedMarkets.length > 0 && newUser.allowedMarkets.includes(m)}
                              onChange={() => {
                                if (newUser.allowedMarkets.length === 0) {
                                  setNewUser({ ...newUser, allowedMarkets: [m] });
                                } else if (newUser.allowedMarkets.includes(m)) {
                                  const next = newUser.allowedMarkets.filter(x => x !== m);
                                  setNewUser({ ...newUser, allowedMarkets: next });
                                } else {
                                  setNewUser({ ...newUser, allowedMarkets: [...newUser.allowedMarkets, m] });
                                }
                              }}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <span className="text-sm font-bold">{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button type="submit" className="px-10 py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-blue-200">
                        {editingUserId ? 'Update Identity' : 'Commit Identity'}
                      </button>
                      <button type="button" onClick={() => {
                        setIsAddingUser(false);
                        setEditingUserId(null);
                        setNewUser({ fullName: '', username: '', password: '', role: 'Viewer', allowedMarkets: [] });
                      }} className="px-10 py-5 bg-white text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl border border-gray-200">
                        Abort
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-gray-50/50 rounded-[48px] overflow-hidden border border-gray-100 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-100/30">
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Authorized Identity</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Permission</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Market access</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white transition-all group">
                          <td className="px-10 py-8">
                            <p className="text-gray-900 font-black text-base">{u.fullName}</p>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">@{u.username}</p>
                          </td>
                          <td className="px-10 py-8">
                            {isSuperAdmin(u) ? (
                              <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 shadow-sm">
                                Super Admin
                              </span>
                            ) : (
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                  u.role === 'Admin' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                                  u.role === 'Editor' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                  'bg-gray-100 border-gray-200 text-gray-500'
                              }`}>{u.role}</span>
                            )}
                          </td>
                          <td className="px-10 py-8">
                            {!u.allowedMarkets || u.allowedMarkets.length === 0 ? (
                              <span className="text-[10px] font-bold text-gray-500">All markets</span>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-700">{u.allowedMarkets.join(', ')}</span>
                            )}
                          </td>
                          <td className="px-10 py-8">
                            {isSuperAdmin(u) ? (
                              <span className="text-gray-300 text-[10px] font-black uppercase tracking-widest italic">Protected</span>
                            ) : revokingUserId === u.id ? (
                                <div className="flex items-center gap-3">
                                    <button onClick={async () => { 
                                      try {
                                        // Only super admin can remove other admins
                                        if (u.role === 'Admin' && !isSuperAdmin(currentUser)) {
                                          await storageService.logSecurityEvent(`BLOCKED: Non-super admin attempted to revoke admin access: ${u.username}`, 'high');
                                          alert('Only super admin can revoke other admins.');
                                          setRevokingUserId(null);
                                          return;
                                        }
                                        await storageService.removeUser(u.id);
                                        await storageService.logSecurityEvent(`User access revoked: ${u.username} (${u.role}) by ${currentUser.username}`, 'medium');
                                        setRevokingUserId(null);
                                      } catch (err: any) {
                                        await storageService.logSecurityEvent(`Failed to revoke access: ${u.username} - ${err.message}`, 'high');
                                        alert(err.message || 'Failed to revoke access');
                                        setRevokingUserId(null);
                                      }
                                    }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase">Confirm</button>
                                    <button onClick={() => setRevokingUserId(null)} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl text-[10px] font-black uppercase">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingUserId(u.id);
                                        setIsAddingUser(false);
                                        setRevokingUserId(null);
                                      }} 
                                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all"
                                    >
                                      Edit
                                    </button>
                                    <button onClick={() => {
                                      // Log attempt to revoke
                                      if (u.role === 'Admin' && !isSuperAdmin(currentUser)) {
                                        storageService.logSecurityEvent(`BLOCKED: Non-super admin attempted to revoke admin: ${u.username}`, 'high');
                                        alert('Only super admin can revoke other admins.');
                                        return;
                                      }
                                      setRevokingUserId(u.id);
                                      setEditingUserId(null);
                                      setIsAddingUser(false);
                                    }} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-all">
                                      Revoke
                                    </button>
                                </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-12 animate-in fade-in duration-500">
                {/* Recover metadata — first under System Metadata so Restore is visible */}
                {!isEditor && (
                  <div className="bg-amber-50/80 p-12 rounded-[56px] border border-amber-200 shadow-sm">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-[0.4em] mb-2">Recover metadata</h4>
                    <p className="text-[11px] text-amber-800 mb-8">Backup or restore metadata from a file. You can also recover from assets or restore default markets &amp; models.</p>
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={handleImportMetadata}
                    />
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        onClick={handleBackupMetadata}
                        className="px-6 py-3 bg-gray-100 text-gray-800 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-gray-200 hover:bg-gray-200 transition-all"
                      >
                        Backup metadata
                      </button>
                      <button
                        type="button"
                        onClick={() => importFileRef.current?.click()}
                        className="px-6 py-3 bg-green-50 text-green-800 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-green-200 hover:bg-green-100 transition-all"
                      >
                        Import metadata
                      </button>
                      <button
                        type="button"
                        onClick={handleRecoverFromAssets}
                        className="px-6 py-3 bg-amber-100 text-amber-800 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-amber-200 hover:bg-amber-200 transition-all"
                      >
                        Recover from assets
                      </button>
                      <button
                        type="button"
                        onClick={handleRestoreDefaults}
                        className="px-6 py-3 bg-blue-50 text-blue-700 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-100 transition-all"
                      >
                        Restore default markets &amp; models
                      </button>
                    </div>
                  </div>
                )}

                {(['markets', 'platforms'] as const).map(type => (
                   <div key={type} className="bg-gray-50 p-12 rounded-[56px] border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-10">
                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.4em]">{type} Node Registry</h4>
                          {(!isAddingConfig || isAddingConfig !== type) && (
                            <button 
                              onClick={() => setIsAddingConfig(type)} 
                              className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                              + Register {type.slice(0, -1)}
                            </button>
                          )}
                          {isAddingConfig === type && (
                            <form onSubmit={handleAddConfigSubmit} className="flex gap-3">
                               <input 
                                  autoFocus
                                  type="text" 
                                  value={newConfigValue} 
                                  onChange={e => setNewConfigValue(e.target.value)} 
                                  className="px-6 py-3 bg-white border-2 border-blue-500 rounded-2xl outline-none text-xs font-black" 
                                  placeholder={`New ${type.slice(0, -1)} Entry...`} 
                               />
                               <button type="submit" className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></button>
                               <button type="button" onClick={() => setIsAddingConfig(null)} className="p-3 bg-white text-gray-400 rounded-2xl border border-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </form>
                          )}
                      </div>
                      <div className="flex flex-wrap gap-4">
                         {config[type].map(item => (
                           <div key={item} className="group relative px-6 py-4 bg-white border border-gray-200 rounded-3xl text-[12px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-3 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-50 transition-all">
                              {editingConfigItem?.type === type && editingConfigItem?.oldValue === item ? (
                                <form onSubmit={handleRenameConfigSubmit} className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editingConfigNewValue}
                                    onChange={e => setEditingConfigNewValue(e.target.value)}
                                    className="px-3 py-2 border-2 border-blue-500 rounded-xl outline-none text-xs font-black w-32"
                                  />
                                  <button type="submit" className="p-2 bg-blue-600 text-white rounded-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                                  <button type="button" onClick={() => { setEditingConfigItem(null); setEditingConfigNewValue(''); }} className="p-2 bg-gray-200 text-gray-600 rounded-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </form>
                              ) : (
                                <>
                                  {item}
                                  <button onClick={() => { setEditingConfigItem({ type, oldValue: item }); setEditingConfigNewValue(item); }} className="text-gray-300 hover:text-blue-600 transition-colors" title="Rename (updates config and existing assets)">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => {
                                        storageService.saveSystemConfig({
                                            ...config,
                                            [type]: config[type].filter(i => i !== item)
                                        });
                                    }} className="text-gray-200 hover:text-red-500 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </>
                              )}
                           </div>
                         ))}
                      </div>
                   </div>
                ))}

                {/* Brands Node Registry */}
                <div className="bg-gray-50 p-12 rounded-[56px] border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.4em]">Brands Node Registry</h4>
                    {(!isAddingConfig || isAddingConfig !== 'brands') && (
                      <button
                        onClick={() => setIsAddingConfig('brands')}
                        className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                        + Register brand
                      </button>
                    )}
                    {isAddingConfig === 'brands' && (
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const val = newConfigValue.trim();
                        const brands = config.brands ?? BRANDS;
                        if (val && !brands.includes(val)) {
                          await storageService.saveSystemConfig({ ...config, brands: [...brands, val] });
                          setIsAddingConfig(null);
                          setNewConfigValue('');
                        }
                      }} className="flex gap-3">
                        <input
                          autoFocus
                          type="text"
                          value={newConfigValue}
                          onChange={e => setNewConfigValue(e.target.value)}
                          className="px-6 py-3 bg-white border-2 border-blue-500 rounded-2xl outline-none text-xs font-black"
                          placeholder="New brand name..."
                        />
                        <button type="submit" className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></button>
                        <button type="button" onClick={() => setIsAddingConfig(null)} className="p-3 bg-white text-gray-400 rounded-2xl border border-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </form>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {(config.brands ?? BRANDS).map(b => (
                      <div key={b} className="group relative px-6 py-4 bg-white border border-gray-200 rounded-3xl text-[12px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-5 hover:border-blue-500 hover:shadow-2xl transition-all">
                        {b}
                        {isAdmin && (
                          <button onClick={() => {
                            const brands = (config.brands ?? BRANDS).filter(x => x !== b);
                            storageService.saveSystemConfig({ ...config, brands: brands.length ? brands : [...BRANDS] });
                          }} className="text-gray-200 hover:text-red-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-12 rounded-[56px] border border-gray-100 shadow-sm">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.4em] mb-6">Models by brand</h4>
                  <p className="text-xs text-gray-500 mb-8">Editors and Admins can add and reorder models. Only Admins can delete metadata.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {(config.brands ?? BRANDS).map(brand => (
                      <div key={brand} className="bg-white p-8 rounded-3xl border border-gray-200">
                        <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-6">{brand} models</h5>
                        {addingModelForBrand === brand ? (
                          <form onSubmit={handleAddModelForBrand} className="flex gap-3 mb-6">
                            <input
                              autoFocus
                              type="text"
                              value={newModelValue}
                              onChange={e => setNewModelValue(e.target.value)}
                              className="flex-1 px-4 py-3 bg-gray-50 border-2 border-blue-500 rounded-2xl outline-none text-xs font-black"
                              placeholder="New model name..."
                            />
                            <button type="submit" className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></button>
                            <button type="button" onClick={() => { setAddingModelForBrand(null); setNewModelValue(''); }} className="p-3 bg-gray-100 text-gray-500 rounded-2xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingModelForBrand(brand)}
                            className="mb-6 px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                          >
                            + Add model to {brand}
                          </button>
                        )}
                        <div className="flex flex-wrap gap-3">
                          {modelsForBrand(brand).map((model, idx, arr) => (
                            <div key={model} className="group relative px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-[12px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                              {model}
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMoveModelInBrand(brand, model, 'up')}
                                  disabled={idx === 0}
                                  className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move up"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveModelInBrand(brand, model, 'down')}
                                  disabled={idx === arr.length - 1}
                                  className="text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move down"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveModelFromBrand(brand, model)}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-12 animate-in zoom-in-95 duration-500">
                 <div className="grid grid-cols-3 gap-8">
                    {[
                      { label: 'Creative Node Count', value: assets.length.toLocaleString(), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4' },
                      { label: 'Cloud Storage Load', value: storageFormatted, icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' },
                      { label: 'Distributed Personel', value: users.length, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857' }
                    ].map(stat => (
                      <div key={stat.label} className="p-12 bg-gray-50/50 rounded-[56px] border border-gray-100 group hover:bg-white hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-50 transition-all">
                          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} /></svg>
                          </div>
                          <p className="text-6xl font-black text-gray-900 mb-2 tracking-tighter leading-none">{stat.value}</p>
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mt-3">{stat.label}</p>
                      </div>
                    ))}
                 </div>
                 <div className="p-14 bg-gradient-to-br from-[#0a0a0a] to-[#111111] text-white rounded-[64px] shadow-2xl relative overflow-hidden border border-white/5">
                    <div className="relative z-10">
                      <h4 className="text-[12px] font-black uppercase tracking-[0.6em] mb-12 text-blue-500">Live Infrastructure Health</h4>
                      <div className="space-y-8">
                          {[
                            { name: 'Google Distributed Firestore', region: 'Multi-Region (High Avail.)', status: 'OPERATIONAL' },
                            { name: 'Project Binary Storage Hub', region: 'Global Edge Cache', status: 'SYNCHRONIZED' },
                            { name: 'Gemini Creative Engine', region: 'Multimodal V3', status: 'ACTIVE' }
                          ].map(node => (
                            <div key={node.name} className="flex items-center justify-between pb-8 border-b border-white/5 last:border-0 last:pb-0">
                                <div>
                                  <span className="text-base font-black block tracking-tight">{node.name}</span>
                                  <span className="text-[10px] font-bold opacity-30 uppercase tracking-[0.3em]">{node.region}</span>
                                </div>
                                <div className="flex items-center gap-3 px-6 py-2.5 bg-green-500/10 text-green-400 text-[11px] font-black rounded-full border border-green-500/20 shadow-lg shadow-green-500/5">
                                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                                  {node.status}
                                </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    {/* Decorative Flare */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[180px] -mr-80 -mt-80"></div>
                 </div>
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="space-y-12 animate-in fade-in duration-500">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Usage & Activity</h3>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Dashboard loads (each open in 24h), logins, downloads — distinct users inferred by IP</p>
                </div>

                {/* ——— OVERVIEW (time range) ——— */}
                {(() => {
                  const rangeStart = activityRange === 'all' ? 0 : Date.now() - Number(activityRange) * 24 * 60 * 60 * 1000;
                  const inRange = <T extends { timestamp: number }>(x: T) => x.timestamp >= rangeStart;
                  // Usage = dashboard loads (each time dashboard is opened in 24h), not just credential logins
                  const dashboardViewsInRange = loginLogs.filter(l => inRange(l) && l.eventType === 'dashboard_view');
                  const loginsInRange = loginLogs.filter(inRange);
                  const downloadsInRange = downloadLogs.filter(inRange);
                  const uploadsInRange = assets.filter(a => (a.createdAt ?? 0) >= rangeStart);
                  const totalLogins = dashboardViewsInRange.length;
                  const uniqueLogins = [...new Set(dashboardViewsInRange.map(l => l.ip))].length;
                  const totalUploads = uploadsInRange.length;
                  const totalDownloads = downloadsInRange.length;
                  const rangeLabels: { value: ActivityRange; label: string }[] = [
                    { value: '7', label: 'Last 7 days' },
                    { value: '14', label: 'Last 2 weeks' },
                    { value: '30', label: '30 days' },
                    { value: '90', label: '90 days' },
                    { value: 'all', label: 'All time' }
                  ];
                  return (
                    <div className="bg-white p-8 rounded-[40px] border border-gray-200 shadow-sm">
                      <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.4em] mb-4">Overview</h4>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {rangeLabels.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setActivityRange(value)}
                            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activityRange === value ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Dashboard loads</p>
                          <p className="text-3xl font-black text-gray-900 mt-1">{totalLogins.toLocaleString()}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">Times dashboard opened in period</p>
                        </div>
                        <div className="p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Unique IPs</p>
                          <p className="text-3xl font-black text-gray-900 mt-1">{uniqueLogins.toLocaleString()}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">Distinct IPs (dashboard loads)</p>
                        </div>
                        <div className="p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Total uploads</p>
                          <p className="text-3xl font-black text-gray-900 mt-1">{totalUploads.toLocaleString()}</p>
                        </div>
                        <div className="p-6 rounded-2xl border-2 border-gray-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
                          <p className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Total downloads</p>
                          <p className="text-3xl font-black text-gray-900 mt-1">{totalDownloads.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ——— LOGINS (credential + dashboard loads) ——— */}
                <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 shadow-sm">
                  <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.4em] mb-6">Activity log (logins &amp; dashboard loads)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total logins</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{loginLogs.length.toLocaleString()}</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Unique IPs (all time)</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{[...new Set(loginLogs.map(l => l.ip))].length.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">Proxy for distinct users</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Logins today</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{loginLogs.filter(l => new Date(l.timestamp).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Unique IPs (last 7 days)</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{(() => {
                        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                        const recent = loginLogs.filter(l => l.timestamp >= weekAgo);
                        return [...new Set(recent.map(l => l.ip))].length;
                      })()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">Logins per day (last 14 days)</p>
                      <div className="space-y-2">
                        {(() => {
                          const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
                          const days: string[] = [];
                          for (let i = 13; i >= 0; i--) {
                            const d = new Date();
                            d.setDate(d.getDate() - i);
                            days.push(dayKey(d.getTime()));
                          }
                          const byDay = loginLogs.reduce<Record<string, number>>((acc, l) => {
                            const k = dayKey(l.timestamp);
                            acc[k] = (acc[k] || 0) + 1;
                            return acc;
                          }, {});
                          const maxDay = Math.max(1, ...Object.values(byDay));
                          return days.map(d => (
                            <div key={d} className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-gray-500 w-24">{d}</span>
                              <div className="flex-1 h-5 bg-gray-200 rounded overflow-hidden">
                                <div className="h-full bg-green-600 rounded" style={{ width: `${((byDay[d] || 0) / maxDay) * 100}%` }} />
                              </div>
                              <span className="text-xs font-black text-gray-700 w-8 text-right">{byDay[d] || 0}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">Recent logins (last 50)</p>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Date / Time</th>
                              <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Event</th>
                              <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">User</th>
                              <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Country</th>
                              <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">IP</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {loginLogs.slice(0, 50).map(l => (
                              <tr key={l.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-700">{new Date(l.timestamp).toLocaleString()}</td>
                                <td className="px-3 py-2">{l.eventType === 'dashboard_view' ? 'Dashboard load' : 'Login'}</td>
                                <td className="px-3 py-2 font-bold">{l.username}</td>
                                <td className="px-3 py-2 text-gray-600">{l.country}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{l.ip}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {loginLogs.length === 0 && <p className="p-4 text-center text-gray-400 text-xs font-bold">No activity recorded yet</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ——— DOWNLOADS ——— */}
                <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 shadow-sm">
                  <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.4em] mb-6">Downloads</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total downloads</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{downloadLogs.length.toLocaleString()}</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Unique locations</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{[...new Set(downloadLogs.map(d => d.country || 'Unknown'))].length}</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Downloads today</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{downloadLogs.filter(d => new Date(d.timestamp).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Unique IPs (downloads)</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{[...new Set(downloadLogs.map(d => d.ip))].length}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">Downloads by country</p>
                    {(() => {
                      const byCountry = downloadLogs.reduce<Record<string, number>>((acc, log) => {
                        const key = log.country || 'Unknown';
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                      }, {});
                      const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
                      const maxCount = sorted[0]?.[1] ?? 1;
                      return sorted.length === 0 ? (
                        <p className="text-xs text-gray-400">No downloads yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {sorted.slice(0, 12).map(([country, count]) => (
                            <div key={country} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{country}</span>
                              <span className="text-xs font-black text-blue-600">{count}</span>
                            </div>
                          ))}
                          {sorted.length > 12 && <span className="text-xs text-gray-400">+{sorted.length - 12} more</span>}
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">Download history (last 100) — content, user, country</p>
                  <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Date / Time</th>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Content</th>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Format</th>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">User</th>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">Country</th>
                          <th className="px-3 py-2 font-black uppercase tracking-wider text-gray-500">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {downloadLogs.slice(0, 100).map(d => (
                          <tr key={d.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{new Date(d.timestamp).toLocaleString()}</td>
                            <td className="px-3 py-2 font-bold text-gray-900 truncate max-w-[180px]" title={d.assetTitle || d.assetId || '—'}>{d.assetTitle || d.assetId || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{d.format || 'original'}</td>
                            <td className="px-3 py-2 text-gray-600">{d.username || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{d.country}</td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{d.ip || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {downloadLogs.length === 0 && <p className="p-4 text-center text-gray-400 text-xs font-bold">No downloads recorded yet</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Threat Monitoring</h3>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-1">Unauthorized Access is Monitored and Reported</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {isSuperAdmin(currentUser) && !isAddingActionLog && !editingActionLog && (
                      <>
                        <button
                          onClick={() => setIsAddingActionLog(true)}
                          className="px-6 py-3 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-purple-700 transition-all"
                        >
                          + Add Action Log
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Clear ALL security logs? This will remove all existing logs including mock data. This action cannot be undone.')) {
                              try {
                                await storageService.clearAllSecurityLogs();
                                await storageService.logSecurityEvent(`All security logs cleared by ${currentUser.username}`, 'medium');
                              } catch (err: any) {
                                alert(err.message || 'Failed to clear logs');
                              }
                            }
                          }}
                          className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-red-700 transition-all"
                        >
                          Clear All Logs
                        </button>
                      </>
                    )}
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 text-red-600 rounded-full text-[10px] font-black uppercase">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                      Live Intrusion Detection Active
                    </div>
                  </div>
                </div>

                {/* Add/Edit Action Log Form (Super Admin Only) */}
                {(isAddingActionLog || editingActionLog) && isSuperAdmin(currentUser) && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        if (editingActionLog) {
                          await storageService.updateActionLog(editingActionLog.id, {
                            event: newActionLog.event,
                            severity: newActionLog.severity,
                          });
                          setEditingActionLog(null);
                        } else {
                          await storageService.addActionLog(
                            newActionLog.event,
                            newActionLog.severity,
                            currentUser.username
                          );
                          setIsAddingActionLog(false);
                        }
                        setNewActionLog({ event: '', severity: 'medium' });
                      } catch (err: any) {
                        alert(err.message || 'Failed to save action log');
                      }
                    }}
                    className="bg-purple-50 p-10 rounded-[48px] border-2 border-purple-200 space-y-6"
                  >
                    <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                      {editingActionLog ? 'Edit Action Log' : 'Add Action Log'}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                          Event Description
                        </label>
                        <input
                          required
                          type="text"
                          value={newActionLog.event}
                          onChange={(e) => setNewActionLog({ ...newActionLog, event: e.target.value })}
                          className="w-full px-6 py-4 bg-white border-2 border-purple-300 rounded-2xl outline-none focus:border-purple-500 text-sm font-bold"
                          placeholder="e.g. Manual security audit performed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                          Severity Level
                        </label>
                        <select
                          value={newActionLog.severity}
                          onChange={(e) => setNewActionLog({ ...newActionLog, severity: e.target.value as any })}
                          className="w-full px-6 py-4 bg-white border-2 border-purple-300 rounded-2xl outline-none focus:border-purple-500 text-sm font-bold"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-8 py-4 bg-purple-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-purple-700 transition-all"
                      >
                        {editingActionLog ? 'Update Log' : 'Add Log'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingActionLog(false);
                          setEditingActionLog(null);
                          setNewActionLog({ event: '', severity: 'medium' });
                        }}
                        className="px-8 py-4 bg-white text-gray-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-gray-50/50 rounded-[48px] overflow-hidden border border-gray-100 shadow-sm">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Event</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">IP</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Location</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Risk</th>
                          {isSuperAdmin(currentUser) && (
                            <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                          )}
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-gray-100">
                      {securityLogs.length > 0 ? securityLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white transition-all group">
                          <td className="px-4 py-4 align-top max-w-[400px]">
                            <div className="flex items-start gap-2">
                              <p className="text-gray-900 font-black text-xs leading-tight" title={log.event}>
                                {log.event}
                              </p>
                              {log.isActionLog && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[7px] font-black uppercase rounded border border-purple-200 whitespace-nowrap">
                                  Action
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight mt-1">
                              {new Date(log.timestamp).toLocaleString()}
                              {log.createdBy && ` • ${log.createdBy}`}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <code className="block bg-gray-100 px-2 py-1 rounded text-[10px] font-mono text-gray-600" title={log.ip}>
                              {log.ip}
                            </code>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="block text-[10px] font-bold text-gray-500 uppercase" title={log.location}>
                              {log.location}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                log.severity === 'high' ? 'bg-red-50 border-red-100 text-red-600' :
                                log.severity === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                                'bg-blue-50 border-blue-100 text-blue-600'
                            }`}>{log.severity}</span>
                          </td>
                          {isSuperAdmin(currentUser) && (
                            <td className="px-4 py-4 align-top text-center">
                              {log.isActionLog ? (
                                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingActionLog(log);
                                      setNewActionLog({ event: log.event, severity: log.severity });
                                      setIsAddingActionLog(false);
                                    }}
                                    className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase hover:bg-blue-100 transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm('Delete this action log?')) {
                                        try {
                                          await storageService.deleteActionLog(log.id);
                                        } catch (err: any) {
                                          alert(err.message || 'Failed to delete');
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-50 text-red-600 rounded text-[8px] font-black uppercase hover:bg-red-100 transition-all"
                                  >
                                    Del
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-300 text-[8px] font-black uppercase italic">Auto</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={isSuperAdmin(currentUser) ? 5 : 4} className="px-4 py-20 text-center text-gray-300 font-black uppercase tracking-[0.4em]">
                            No Live Threat Data Registered
                          </td>
                        </tr>
                      )}
                    </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-10 bg-gray-900 rounded-[48px] border border-white/5 text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  NOTE: All unauthorized attempts to access BYD Assets Hub project binaries are automatically logged by the cloud node. 
                  Geolocation data is utilized during audit sessions to ensure physical traceability of marketing creative downloads. 
                  Unauthorized distribution of assets violates internal compliance protocols.
                  {isSuperAdmin(currentUser) && (
                    <span className="block mt-3 text-purple-400">
                      SUPER ADMIN: You can add, edit, and delete action logs manually for audit purposes.
                    </span>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
