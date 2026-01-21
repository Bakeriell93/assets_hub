
import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import AssetCard from './components/AssetCard';
import AssetFormModal from './components/AssetFormModal';
import AICopyModal from './components/AICopyModal';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { Asset, Platform, Market, CarModel, User, UserRole, AssetObjective, SystemConfig, Collection, MARKETS, CAR_MODELS, PLATFORMS } from './types';

type SortOption = 'newest' | 'ctr' | 'cr' | 'cpl';
type ViewMode = 'repository' | 'analytics' | 'collections';

const SESSION_STORAGE_KEY = 'byd_assets_hub_session';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('repository');
  
  const [assets, setAssets] = useState<Asset[]>([]);
  // Use defaults from types.ts as initial state
  const [config, setConfig] = useState<SystemConfig>({ 
    markets: MARKETS, 
    models: CAR_MODELS, 
    platforms: PLATFORMS 
  });
  const [users, setUsers] = useState<User[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Filter States
  const [selectedMarket, setSelectedMarket] = useState<Market | 'All'>('All');
  const [selectedModel, setSelectedModel] = useState<CarModel | 'All'>('All');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'All'>('All');
  const [selectedObjectives, setSelectedObjectives] = useState<AssetObjective[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const user = JSON.parse(savedSession) as User;
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.warn('Failed to restore session:', err);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const unsubAssets = storageService.subscribeToAssets(setAssets);
      const unsubConfig = storageService.subscribeToConfig(setConfig);
      const unsubUsers = storageService.subscribeToUsers(setUsers);
      const unsubCollections = storageService.subscribeToCollections(setCollections);
      
      return () => { unsubAssets(); unsubConfig(); unsubUsers(); unsubCollections(); };
    }
  }, [isLoggedIn]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    // Save session to localStorage
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to save session:', err);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    // Clear session from localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName) {
      await storageService.saveCollection({
        name: newCollectionName,
        assetIds: [],
        createdAt: Date.now()
      });
      setIsAddingCollection(false);
      setNewCollectionName('');
    }
  };

  const filteredAssets = assets.filter(a => {
    const mMatch = selectedMarket === 'All' || a.market === selectedMarket;
    const modelMatch = selectedModel === 'All' || a.carModel === selectedModel;
    const pMatch = selectedPlatform === 'All' || a.platform === selectedPlatform;
    const objMatch = selectedObjectives.length === 0 || selectedObjectives.some(o => a.objectives?.includes(o));
    const sMatch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    return mMatch && modelMatch && pMatch && objMatch && sMatch;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'ctr') return (b.ctr || 0) - (a.ctr || 0);
    if (sortBy === 'cr') return (b.cr || 0) - (a.cr || 0);
    if (sortBy === 'cpl') return (a.cpl || 999) - (b.cpl || 999);
    return b.createdAt - a.createdAt;
  });

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <div className="w-80 bg-white border-r border-gray-100">
        <Sidebar 
          config={config}
          selectedMarket={selectedMarket}
          selectedModel={selectedModel}
          user={currentUser!}
          onSelectMarket={setSelectedMarket}
          onSelectModel={setSelectedModel}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-12 py-8 flex flex-col gap-6 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8 flex-1">
              <div className="flex bg-gray-100 p-2 rounded-[28px] border border-gray-200 shadow-inner">
                 {[
                   { id: 'repository', label: 'HUB' },
                   { id: 'analytics', label: 'ANALYTICS' },
                   { id: 'collections', label: 'PROJECTS' }
                 ].map(v => (
                   <button 
                    key={v.id}
                    onClick={() => setViewMode(v.id as ViewMode)}
                    className={`px-8 py-3.5 rounded-[22px] text-[10px] font-black uppercase tracking-[0.3em] transition-all ${viewMode === v.id ? 'bg-white text-gray-900 shadow-2xl' : 'text-gray-400 hover:text-gray-600'}`}
                   >{v.label}</button>
                 ))}
              </div>
              
              {viewMode === 'repository' && (
                <>
                  <div className="relative flex-1 max-w-sm">
                    <svg className="w-5 h-5 absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      className="w-full pl-14 pr-8 py-4 bg-gray-50 rounded-[28px] outline-none border-2 border-transparent focus:bg-white focus:border-blue-600 text-sm font-bold transition-all shadow-inner"
                      placeholder="Search BYD assets..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setIsAIModalOpen(true)} className="px-10 py-4 bg-[#111111] text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl shadow-gray-200">AI LAB</button>
              {currentUser?.role !== 'Viewer' && (
                <button onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }} className="px-10 py-4 bg-blue-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all">PUBLISH</button>
              )}
            </div>
          </div>
          
          {viewMode === 'repository' && (
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
              {['All', ...config.platforms].map(p => (
                <button 
                  key={p} 
                  onClick={() => setSelectedPlatform(p)}
                  className={`whitespace-nowrap px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-full transition-all border-2 ${selectedPlatform === p ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-300'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-12 bg-[#f8f9fc]">
          <div className="max-w-[1600px] mx-auto">
            {viewMode === 'repository' && (
              <div className="animate-in fade-in duration-700">
                <div className="flex items-end justify-between mb-16">
                  <div>
                    <h1 className="text-7xl font-black text-gray-900 tracking-tighter mb-4 leading-none uppercase">
                      {selectedMarket === 'All' ? 'GLOBAL' : selectedMarket} HUB
                    </h1>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-3 px-4 py-2 bg-green-500/10 text-green-600 text-[11px] font-black uppercase rounded-full border border-green-500/10 tracking-widest">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        CLOUD SYNCED
                      </span>
                      <span className="text-[11px] font-black text-gray-300 uppercase tracking-[0.3em]">Tier: {currentUser?.role}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-7xl font-black text-blue-600 leading-none tracking-tighter">{sortedAssets.length}</p>
                    <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.5em] mt-3">Active Creative Nodes</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                  {sortedAssets.map(asset => (
                    <AssetCard 
                      key={asset.id}
                      asset={asset}
                      userRole={currentUser?.role!}
                      onPreview={setPreviewAsset}
                      onEdit={(a) => { setEditingAsset(a); setIsAssetModalOpen(true); }}
                      onDelete={storageService.deleteAsset}
                    />
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'analytics' && (
              <div className="space-y-16 animate-in slide-in-from-bottom-8 duration-700">
                 <h2 className="text-6xl font-black text-gray-900 tracking-tighter uppercase">CAMPAIGN ANALYTICS</h2>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="bg-white p-14 rounded-[64px] shadow-2xl shadow-gray-100 border border-gray-50">
                        <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.5em] mb-12">Engagement Matrix by Model</h3>
                        <div className="space-y-10">
                           {config.models.map(m => {
                              const modelAssets = assets.filter(a => a.carModel === m);
                              const avgCtr = modelAssets.length ? modelAssets.reduce((sum, a) => sum + (a.ctr || 0), 0) / modelAssets.length : 0;
                              return (
                                <div key={m} className="space-y-4">
                                   <div className="flex justify-between items-center text-[12px] font-black uppercase tracking-widest">
                                      <span className="text-gray-900">{m}</span>
                                      <span className="text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl">{avgCtr.toFixed(2)}% CTR</span>
                                   </div>
                                   <div className="h-6 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-1.5">
                                      <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(avgCtr * 10, 100)}%` }}></div>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                    </div>
                    <div className="bg-white p-14 rounded-[64px] shadow-2xl shadow-gray-100 border border-gray-50">
                        <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.5em] mb-12">Regional Content Saturation</h3>
                        <div className="grid grid-cols-2 gap-8">
                           {config.markets.map(m => {
                              const marketCount = assets.filter(a => a.market === m).length;
                              const pct = assets.length ? (marketCount / assets.length) * 100 : 0;
                              return (
                                <div key={m} className="p-10 bg-gray-50/50 rounded-[48px] border border-gray-100 group hover:bg-gray-900 transition-all shadow-sm">
                                   <p className="text-[11px] font-black text-gray-400 group-hover:text-blue-400 uppercase tracking-[0.4em] mb-3">{m} CLUSTER</p>
                                   <p className="text-6xl font-black text-gray-900 group-hover:text-white transition-colors tracking-tighter">{marketCount}</p>
                                   <div className="mt-8 flex items-center gap-4">
                                      <div className="flex-1 h-2.5 bg-gray-200 group-hover:bg-white/10 rounded-full overflow-hidden p-0.5">
                                         <div className="h-full bg-blue-600 group-hover:bg-blue-400 rounded-full shadow-lg shadow-blue-500/20" style={{ width: `${pct}%` }}></div>
                                      </div>
                                      <span className="text-[11px] font-black text-blue-600 group-hover:text-white">{pct.toFixed(0)}%</span>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {viewMode === 'collections' && (
              <div className="space-y-16 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-6xl font-black text-gray-900 tracking-tighter uppercase leading-none">PROJECT FOLDERS</h2>
                    <p className="text-[12px] font-black text-gray-400 mt-4 uppercase tracking-[0.4em]">Multi-Market Campaign Containers</p>
                  </div>
                  <button onClick={() => setIsAddingCollection(true)} className="px-10 py-5 bg-[#111111] text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[28px] shadow-2xl hover:bg-black transition-all">NEW PROJECT</button>
                </div>

                {isAddingCollection && (
                  <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-md" onClick={() => setIsAddingCollection(false)}></div>
                    <form onSubmit={handleCreateCollection} className="relative w-full max-w-lg bg-white p-12 rounded-[56px] shadow-2xl space-y-8 border border-white/20">
                      <h3 className="text-3xl font-black text-gray-900 tracking-tight">Project Identification</h3>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Collection Title</label>
                        <input autoFocus required type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} className="w-full px-8 py-6 bg-gray-50 border-2 border-transparent focus:border-blue-600 rounded-3xl outline-none font-black text-gray-900" placeholder="e.g. Geneva Motorshow 2025" />
                      </div>
                      <div className="flex gap-4">
                        <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest">Initialize Node</button>
                        <button type="button" onClick={() => setIsAddingCollection(false)} className="px-10 py-5 bg-gray-100 text-gray-400 rounded-3xl text-[11px] font-black uppercase">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {collections.map(c => (
                    <div key={c.id} className="p-12 bg-white rounded-[64px] border-2 border-gray-100 hover:border-blue-500 transition-all shadow-xl group cursor-pointer relative overflow-hidden">
                      <div className="w-20 h-20 bg-gray-50 rounded-[32px] mb-10 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      </div>
                      <h4 className="text-3xl font-black text-gray-900 tracking-tighter mb-3 leading-tight uppercase">{c.name}</h4>
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mb-8">{c.assetIds.length} Linked Creatives</p>
                      <button className="w-full py-5 bg-gray-50 text-gray-900 rounded-[28px] text-[11px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all">ENTER NODE</button>
                    </div>
                  ))}
                  {collections.length === 0 && (
                    <div className="col-span-full py-48 text-center border-4 border-dashed border-gray-100 rounded-[64px] bg-gray-50/30">
                      <p className="text-sm font-black text-gray-300 uppercase tracking-[0.6em]">NO ACTIVE PROJECTS FOUND IN CLOUD REGISTRY</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <AssetFormModal 
        isOpen={isAssetModalOpen} 
        onClose={() => setIsAssetModalOpen(false)} 
        onSave={storageService.addAsset}
        editingAsset={editingAsset}
        config={config}
      />
      <AICopyModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        onSave={storageService.addAsset}
        config={config}
      />
      {isAdminPanelOpen && <AdminPanel assets={assets} config={config} users={users} onClose={() => setIsAdminPanelOpen(false)} />}
    </div>
  );
}

export default App;
