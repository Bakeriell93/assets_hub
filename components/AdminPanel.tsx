
import React, { useState, useEffect } from 'react';
import { User, UserRole, Asset, SystemConfig } from '../types';
import { storageService, SecurityLog } from '../services/storageService';

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
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'stats' | 'security'>('users');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isAddingConfig, setIsAddingConfig] = useState<keyof SystemConfig | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  // Backfill cache for older assets that may not have `size` stored in Firestore.
  const [resolvedAssetSizes, setResolvedAssetSizes] = useState<Record<string, number>>({});

  // Form states
  const [newUser, setNewUser] = useState({ fullName: '', username: '', password: '', role: 'Viewer' as UserRole });
  const [newConfigValue, setNewConfigValue] = useState('');

  useEffect(() => {
    const unsubLogs = storageService.subscribeToSecurityLogs(setSecurityLogs);
    return () => unsubLogs();
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tryResolveRemoteFileSize = async (url: string): Promise<number | null> => {
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
        createdAt: Date.now()
      });
      setIsAddingUser(false);
      setNewUser({ fullName: '', username: '', password: '', role: 'Viewer' });
    }
  };

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
            {[
              { id: 'users', label: 'Team Identities', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { id: 'config', label: 'System Metadata', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
              { id: 'stats', label: 'Live Telemetry', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 01-2 2h22a2 2 0 01-2-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6' },
              { id: 'security', label: 'Threat Monitor', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }
            ].map(tab => (
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
                      onClick={() => setIsAddingUser(true)} 
                      className="px-8 py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                      Provision New User
                    </button>
                  )}
                </div>

                {isAddingUser && (
                  <form onSubmit={handleAddUserSubmit} className="bg-gray-50 p-10 rounded-[48px] border border-gray-100 space-y-8 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                        <input required type="text" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm" placeholder="e.g. Fakhri Ashour" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unique Username</label>
                        <input required type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm" placeholder="fakhri_admin" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Secure Key (Password)</label>
                        <input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-6 py-5 bg-white border border-gray-200 rounded-3xl outline-none focus:border-blue-500 text-sm font-bold shadow-sm" placeholder="••••••••" />
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
                    <div className="flex gap-4 pt-4">
                      <button type="submit" className="px-10 py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-blue-200">Commit Identity</button>
                      <button type="button" onClick={() => setIsAddingUser(false)} className="px-10 py-5 bg-white text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl border border-gray-200">Abort</button>
                    </div>
                  </form>
                )}

                <div className="bg-gray-50/50 rounded-[48px] overflow-hidden border border-gray-100 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-100/30">
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Authorized Identity</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Permission</th>
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
                                <button onClick={() => {
                                  // Log attempt to revoke
                                  if (u.role === 'Admin' && !isSuperAdmin(currentUser)) {
                                    storageService.logSecurityEvent(`BLOCKED: Non-super admin attempted to revoke admin: ${u.username}`, 'high');
                                    alert('Only super admin can revoke other admins.');
                                    return;
                                  }
                                  setRevokingUserId(u.id);
                                }} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Revoke Access</button>
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
                {(['markets', 'models', 'platforms'] as const).map(type => (
                   <div key={type} className="bg-gray-50 p-12 rounded-[56px] border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-10">
                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.4em]">{type} Node Registry</h4>
                          {!isAddingConfig || isAddingConfig !== type ? (
                            <button 
                              onClick={() => setIsAddingConfig(type)} 
                              className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                              + Register {type.slice(0, -1)}
                            </button>
                          ) : (
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
                           <div key={item} className="group relative px-6 py-4 bg-white border border-gray-200 rounded-3xl text-[12px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-5 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-50 transition-all">
                              {item}
                              <button onClick={() => {
                                  storageService.saveSystemConfig({
                                      ...config,
                                      [type]: config[type].filter(i => i !== item)
                                  });
                              }} className="text-gray-200 hover:text-red-500 transition-colors">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                           </div>
                         ))}
                      </div>
                   </div>
                ))}
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

            {activeTab === 'security' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Threat Monitoring</h3>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-1">Unauthorized Access is Monitored and Reported</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 text-red-600 rounded-full text-[10px] font-black uppercase">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                    Live Intrusion Detection Active
                  </div>
                </div>

                <div className="bg-gray-50/50 rounded-[48px] overflow-hidden border border-gray-100 shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-100/30">
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Event Description</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Network Node (IP)</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Geo-Location</th>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-widest">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {securityLogs.length > 0 ? securityLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white transition-all group">
                          <td className="px-10 py-8">
                            <p className="text-gray-900 font-black text-sm">{log.event}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{new Date(log.timestamp).toLocaleString()}</p>
                          </td>
                          <td className="px-10 py-8">
                            <code className="bg-gray-100 px-3 py-1 rounded text-xs font-mono text-gray-600">{log.ip}</code>
                          </td>
                          <td className="px-10 py-8">
                            <span className="text-[11px] font-bold text-gray-500 uppercase">{log.location}</span>
                          </td>
                          <td className="px-10 py-8">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                log.severity === 'high' ? 'bg-red-50 border-red-100 text-red-600' :
                                log.severity === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                                'bg-blue-50 border-blue-100 text-blue-600'
                            }`}>{log.severity}</span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-10 py-20 text-center text-gray-300 font-black uppercase tracking-[0.4em]">No Live Threat Data Registered</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-10 bg-gray-900 rounded-[48px] border border-white/5 text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  NOTE: All unauthorized attempts to access BYD Assets Hub project binaries are automatically logged by the cloud node. 
                  Geolocation data is utilized during audit sessions to ensure physical traceability of marketing creative downloads. 
                  Unauthorized distribution of assets violates internal compliance protocols.
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
