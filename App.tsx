
import React, { useEffect, useState, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Sidebar from './components/Sidebar';
import AssetCard from './components/AssetCard';
import AssetFormModal from './components/AssetFormModal';
import AIInsightsModal from './components/AIInsightsModal';
import AdminPanel from './components/AdminPanel';
import BulkUploadModal from './components/BulkUploadModal';
import Login from './components/Login';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { Asset, Platform, Market, CarModel, User, UserRole, AssetObjective, SystemConfig, Collection, MARKETS, CAR_MODELS, PLATFORMS } from './types';

type SortOption = 'newest' | 'ctr' | 'cr' | 'cpl';
type ViewMode = 'repository' | 'analytics' | 'collections' | 'trash';

const SESSION_STORAGE_KEY = 'byd_assets_hub_session';

// Video Player Component with Plyr for better format support
const VideoPlayerComponent: React.FC<{
  videoUrl: string;
  videoFormat: string | null;
  isLikelyUnsupported: boolean;
  originalUrl: string;
}> = ({ videoUrl, videoFormat, isLikelyUnsupported, originalUrl }) => {
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  
  useEffect(() => {
    if (videoRef.current && !playerRef.current) {
      // Initialize Plyr player with better MOV support
      try {
        const isMov = originalUrl.toLowerCase().endsWith('.mov') || originalUrl.toLowerCase().endsWith('.qt');
        
        // Configure video element for better MOV streaming
        if (videoRef.current && isMov) {
          videoRef.current.preload = 'auto'; // Preload entire video for MOV files
          videoRef.current.load(); // Force load
        }
        
        playerRef.current = new Plyr(videoRef.current, {
          controls: [
            'play-large',
            'restart',
            'rewind',
            'play',
            'fast-forward',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'settings',
            'pip',
            'airplay',
            'fullscreen',
          ],
          settings: ['quality', 'speed'],
          keyboard: { focused: true, global: false },
          tooltips: { controls: true, seek: true },
          autoplay: false,
          clickToPlay: true,
          hideControls: true,
          resetOnEnd: false,
          disableContextMenu: false,
          loadSprite: false,
          iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
          blankVideo: 'https://cdn.plyr.io/static/blank.mp4',
          // Better configuration for MOV files with moov-at-end
          ...(isMov ? { 
            html5: { 
              vhs: { 
                overrideNative: false 
              },
              nativeVideoTracks: true,
              nativeAudioTracks: true,
              nativeTextTracks: true
            },
            // Force aggressive buffering for MOV
            seekTime: 5,
            volume: 1,
            muted: false
          } : {})
        });
        
        // Handle Plyr events
        playerRef.current.on('ready', () => {
          console.log('Plyr player ready for:', originalUrl);
          setVideoError(null);
        });
        
        // Listen to the underlying video element errors directly
        if (videoRef.current) {
          videoRef.current.addEventListener('error', (e) => {
            const video = e.currentTarget as HTMLVideoElement;
            const error = video.error;
            console.error('Video element error:', {
              code: error?.code,
              message: error?.message,
              url: videoUrl,
              format: videoFormat,
              networkState: video.networkState,
              readyState: video.readyState
            });
            
            // For MOV files, try one more time with different approach
            if (isMov && error?.code === 4) {
              console.log('MOV file format error, video may still load with different codec');
              // Don't show error immediately for MOV - give it time
              setTimeout(() => {
                if (video.error && video.error.code === 4) {
                  setVideoError('format');
                }
              }, 2000);
            } else if (error?.code === 4 || error?.message?.includes('Format') || error?.message?.includes('decode') || error?.message?.includes('MEDIA_ELEMENT_ERROR')) {
              setVideoError('format');
            } else {
              setVideoError('network');
            }
          }, { once: false });
        }
        
        playerRef.current.on('error', (event) => {
          console.error('Plyr error event:', event);
          const error = (event.detail as any)?.plyr?.media?.error;
          if (error) {
            console.error('Plyr video playback error:', {
              code: error.code,
              message: error.message,
              url: videoUrl,
              format: videoFormat,
            });
          }
        });
        
        playerRef.current.on('loadeddata', () => {
          console.log('Video loaded successfully with Plyr:', originalUrl);
          setVideoError(null);
        });
        
        playerRef.current.on('canplay', () => {
          console.log('Video can play:', originalUrl);
          setVideoError(null);
        });
      } catch (err) {
        console.error('Failed to initialize Plyr:', err);
        // Fallback to native video player - still try to play
      }
    }
    
    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (err) {
          console.error('Error destroying Plyr player:', err);
        }
      }
    };
  }, [videoUrl, videoFormat, originalUrl]);
  
  // Generate multiple source elements for better format support
  const getVideoSources = () => {
    const sources = [];
    const ext = originalUrl.toLowerCase().split('.').pop() || '';
    
    // For MOV files, try multiple approaches since many contain H.264
    if (ext === 'mov' || ext === 'qt') {
      // Try as MP4 first (many MOV files are H.264/MP4 compatible)
      sources.push({
        src: videoUrl,
        type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 + AAC
      });
      sources.push({
        src: videoUrl,
        type: 'video/mp4',
      });
      // Also try as QuickTime
      sources.push({
        src: videoUrl,
        type: 'video/quicktime',
      });
    } else {
      // Add primary source for other formats
      sources.push({
        src: videoUrl,
        type: videoFormat || 'video/mp4',
      });
    }
    
    // For AVI files, try different MIME types
    if (ext === 'avi') {
      sources.push({
        src: videoUrl,
        type: 'video/x-msvideo',
      });
      sources.push({
        src: videoUrl,
        type: 'video/avi',
      });
      // Try as MP4 in case it's H.264
      sources.push({
        src: videoUrl,
        type: 'video/mp4',
      });
    }
    
    return sources;
  };
  
  return (
    <div className="w-full flex items-center justify-center bg-black p-6 relative">
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-8 text-center">
          <div className="max-w-md">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wider">Video Format Not Supported</h3>
            <p className="text-sm text-gray-300 mb-4">
              {isLikelyUnsupported 
                ? 'This video format (.mov, .avi, etc.) is not natively supported by your browser. Please download the file to view it.'
                : 'Your browser cannot play this video format. Please try downloading the file.'}
            </p>
            <a
              href={videoUrl}
              download
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:bg-blue-700 transition-all"
            >
              Download Video
            </a>
          </div>
        </div>
      )}
      <video 
        ref={videoRef}
        key={videoUrl}
        className="plyr__video-embed w-full h-auto max-h-[90vh]"
        playsInline
        preload={originalUrl.toLowerCase().endsWith('.mov') || originalUrl.toLowerCase().endsWith('.qt') ? 'auto' : 'metadata'}
        muted={false}
        controlsList="nodownload"
        crossOrigin="anonymous"
      >
        {getVideoSources().map((source, index) => (
          <source key={index} src={source.src} type={source.type} />
        ))}
        Your browser does not support the video tag.
        <a href={videoUrl} download className="text-blue-400 underline">Download the video</a> instead.
      </video>
    </div>
  );
};

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
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

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
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  
  // Upload Progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

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
      
      // Run cleanup on mount and set up periodic cleanup (every hour)
      storageService.cleanupDeletedAssets();
      const cleanupInterval = setInterval(() => {
        storageService.cleanupDeletedAssets();
      }, 60 * 60 * 1000); // Every hour
      
      return () => { 
        unsubAssets(); 
        unsubConfig(); 
        unsubUsers(); 
        unsubCollections();
        clearInterval(cleanupInterval);
      };
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

  const handleSaveAsset = async (data: any, file?: File) => {
    try {
      // Editing should UPDATE, not create a new asset.
      if (editingAsset) {
        // Build updates object, preserving important fields
        const updates: Partial<Asset> = {
          title: data.title,
          type: data.type,
          market: data.market,
          platform: data.platform,
          carModel: data.carModel,
          objectives: data.objectives,
          usageRights: data.usageRights,
          uploadedBy: data.uploadedBy,
          ctr: data.ctr,
          cpl: data.cpl,
          cr: data.cr,
          comments: data.comments,
          content: data.content,
          // Preserve these fields from original asset
          url: editingAsset.url,
          size: editingAsset.size,
          status: editingAsset.status,
          createdAt: editingAsset.createdAt,
          // Only include collectionIds if it's provided and not undefined
          ...(data.collectionIds !== undefined ? { collectionIds: data.collectionIds } : {}),
        };
        
        await storageService.updateAsset(editingAsset.id, updates);
        setEditingAsset(null);
        setIsAssetModalOpen(false);
        return;
      }
      
      // Validate required fields for new asset
      if (!data.title || !data.market || !data.platform || !data.carModel) {
        alert('Please fill in all required fields (Title, Market, Platform, Car Model)');
        return;
      }
      
      if (!file && data.type !== 'text' && !data.content) {
        alert('Please select a file to upload');
        return;
      }
      
      // Show progress bar
      setUploadProgress(0);
      setUploadStatus('Uploading asset...');
      
      await storageService.addAsset(data, file, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadProgress(100);
      setUploadStatus('Upload complete!');
      
      // Close modal and reset progress after a brief delay
      setTimeout(() => {
        setIsAssetModalOpen(false);
        setUploadProgress(null);
        setUploadStatus('');
      }, 500);
    } catch (error: any) {
      console.error('Failed to save asset:', error);
      setUploadProgress(null);
      setUploadStatus('');
      alert(`Failed to upload asset: ${error.message || 'Unknown error'}`);
      // Don't close modal on error so user can retry
    }
  };

  const handleSavePackage = async (packageAssets: Array<{ asset: Omit<Asset, 'id' | 'createdAt'>; file?: File }>) => {
    try {
      if (packageAssets.length === 0) {
        alert('Package must contain at least one asset');
        return;
      }

      // Show progress bar
      setUploadProgress(0);
      setUploadStatus(`Uploading package (0/${packageAssets.length})...`);

      // Upload all assets in the package
      for (let i = 0; i < packageAssets.length; i++) {
        const { asset, file } = packageAssets[i];
        const assetProgress = (i / packageAssets.length) * 100;
        
        await storageService.addAsset(asset, file, (progress) => {
          // Calculate overall progress: previous assets + current asset progress
          const overallProgress = assetProgress + (progress / packageAssets.length);
          setUploadProgress(overallProgress);
          setUploadStatus(`Uploading package (${i + 1}/${packageAssets.length}): ${asset.title || 'Asset'}`);
        });
      }

      setUploadProgress(100);
      setUploadStatus('Package upload complete!');

      // Close modal and reset progress after a brief delay
      setTimeout(() => {
        setIsAssetModalOpen(false);
        setUploadProgress(null);
        setUploadStatus('');
      }, 500);
    } catch (error: any) {
      console.error('Failed to save package:', error);
      setUploadProgress(null);
      setUploadStatus('');
      alert(`Failed to upload package: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (trimmed) {
      await storageService.saveCollection({
        name: trimmed,
        assetIds: [],
        createdAt: Date.now()
      });
      setIsAddingCollection(false);
      setNewCollectionName('');
    }
  };

  const normalize = (s: any) => String(s || '').toLowerCase();
  const matchesSearch = (a: Asset, rawQuery: string) => {
    const q = normalize(rawQuery).trim();
    if (!q) return true;

    // Support multi-term search: every term must match somewhere.
    const terms = q.split(/\s+/).filter(Boolean);

    const haystack = [
      a.title,
      a.description,
      a.market,
      a.platform,
      a.carModel,
      ...(a.objectives || []),
      a.uploadedBy,
      a.usageRights,
      a.comments,
      a.content,
    ]
      .map(normalize)
      .join(' • ');

    return terms.every(t => haystack.includes(t));
  };

  const filteredAssets = assets.filter(a => {
    // In trash view, only show deleted assets. In other views, exclude deleted assets.
    if (viewMode === 'trash') {
      if (!a.deletedAt) return false; // Not deleted, don't show in trash
    } else {
      if (a.deletedAt) return false; // Deleted, don't show in main views
    }
    
    const mMatch = selectedMarket === 'All' || a.market === selectedMarket;
    const modelMatch = selectedModel === 'All' || a.carModel === selectedModel;
    const pMatch = selectedPlatform === 'All' || a.platform === selectedPlatform;
    const objMatch = selectedObjectives.length === 0 || selectedObjectives.some(o => a.objectives?.includes(o));
    const cMatch = !activeCollectionId || (a.collectionIds || []).includes(activeCollectionId);
    const sMatch = matchesSearch(a, searchQuery);
    return mMatch && modelMatch && pMatch && objMatch && cMatch && sMatch;
  });

  // Group assets by packageId - show only the first asset of each package, or standalone assets
  const packageMap = new Map<string, Asset[]>();
  const standaloneAssets: Asset[] = [];

  filteredAssets.forEach(asset => {
    if (asset.packageId) {
      if (!packageMap.has(asset.packageId)) {
        packageMap.set(asset.packageId, []);
      }
      packageMap.get(asset.packageId)!.push(asset);
    } else {
      standaloneAssets.push(asset);
    }
  });

  // Sort packages by their first asset's createdAt
  const packageGroups = Array.from(packageMap.values())
    .map(pkgAssets => ({
      packageId: pkgAssets[0].packageId!,
      assets: pkgAssets.sort((a, b) => (a.packageOrder || 0) - (b.packageOrder || 0)),
      representative: pkgAssets.sort((a, b) => (a.packageOrder || 0) - (b.packageOrder || 0))[0]
    }))
    .sort((a, b) => b.representative.createdAt - a.representative.createdAt);

  const sortedAssets = [
    ...packageGroups.map(g => g.representative),
    ...standaloneAssets.sort((a, b) => {
      // In trash view, sort by deletedAt (most recently deleted first)
      if (viewMode === 'trash') {
        return (b.deletedAt || 0) - (a.deletedAt || 0);
      }
      // In other views, use normal sorting
      if (sortBy === 'ctr') return (b.ctr || 0) - (a.ctr || 0);
      if (sortBy === 'cr') return (b.cr || 0) - (a.cr || 0);
      if (sortBy === 'cpl') return (a.cpl || 999) - (b.cpl || 999);
      return b.createdAt - a.createdAt;
    })
  ];

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
                   { id: 'collections', label: 'PROJECTS' },
                   { id: 'trash', label: 'TRASH' }
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
              <button onClick={() => setIsAIModalOpen(true)} className="px-10 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] hover:from-purple-700 hover:to-indigo-700 transition-all shadow-xl shadow-purple-200">AI Insights</button>
              {currentUser?.role !== 'Viewer' && (
                <>
                  <button onClick={() => setIsBulkUploadOpen(true)} className="px-10 py-4 bg-green-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-green-200 hover:bg-green-700 transition-all">BULK UPLOAD</button>
                  <button onClick={() => { setEditingAsset(null); setIsAssetModalOpen(true); }} className="px-10 py-4 bg-blue-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all">UPLOAD</button>
                </>
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
                    {activeCollectionId && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-purple-700 bg-purple-50 border border-purple-100 px-4 py-2 rounded-full">
                          Folder: {collections.find(c => c.id === activeCollectionId)?.name || 'Selected'}
                        </span>
                        <button
                          onClick={() => setActiveCollectionId(null)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black transition-all shadow-lg"
                          title="Leave this folder view"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7 7-7m-7 7h18" />
                          </svg>
                          Leave Folder
                        </button>
                      </div>
                    )}
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
                  {sortedAssets.map(asset => {
                    const packageAssets = asset.packageId 
                      ? packageMap.get(asset.packageId) || [asset]
                      : [asset];
                    return (
                      <AssetCard 
                        key={asset.id}
                        asset={asset}
                        packageAssets={packageAssets}
                        userRole={currentUser?.role!}
                        onPreview={setPreviewAsset}
                        onEdit={(a) => { setEditingAsset(a); setIsAssetModalOpen(true); }}
                        onDelete={storageService.deleteAsset}
                        onRestore={storageService.restoreAsset}
                        isTrashView={viewMode === 'trash'}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'analytics' && (
              <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                 <div className="flex items-end justify-between gap-6">
                   <div>
                     <h2 className="text-5xl font-black text-gray-900 tracking-tighter uppercase leading-none">CAMPAIGN ANALYTICS</h2>
                     <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.45em] mt-3">Compact overview • Counts + Performance</p>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="px-4 py-2 rounded-full bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
                       Total Assets: {assets.length}
                     </span>
                     <span className="px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-700">
                       Images: {assets.filter(a => a.type === 'image').length}
                     </span>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="bg-white p-10 rounded-[48px] shadow-xl shadow-gray-100 border border-gray-50">
                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.45em] mb-8">Engagement + Count by Model</h3>
                        <div className="space-y-7">
                           {config.models.map(m => {
                              const modelAssets = assets.filter(a => a.carModel === m);
                              const modelImageCount = modelAssets.filter(a => a.type === 'image').length;
                              const avgCtr = modelAssets.length ? modelAssets.reduce((sum, a) => sum + (a.ctr || 0), 0) / modelAssets.length : 0;
                              return (
                                <div key={m} className="space-y-3">
                                   <div className="flex justify-between items-center gap-4">
                                      <div className="min-w-0">
                                        <p className="text-[12px] font-black uppercase tracking-widest text-gray-900 truncate">{m}</p>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">
                                          {modelAssets.length} total • {modelImageCount} images
                                        </p>
                                      </div>
                                      <span className="shrink-0 text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        {avgCtr.toFixed(2)}% CTR
                                      </span>
                                   </div>
                                   <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-1">
                                      <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(avgCtr * 10, 100)}%` }}></div>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[48px] shadow-xl shadow-gray-100 border border-gray-50">
                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.45em] mb-8">Market Saturation (Count)</h3>
                        <div className="grid grid-cols-2 gap-5">
                           {config.markets.map(m => {
                              const marketCount = assets.filter(a => a.market === m).length;
                              const pct = assets.length ? (marketCount / assets.length) * 100 : 0;
                              return (
                                <div key={m} className="p-6 bg-gray-50/50 rounded-[28px] border border-gray-100 hover:bg-gray-900 transition-all group">
                                   <div className="flex items-center justify-between">
                                     <p className="text-[10px] font-black text-gray-400 group-hover:text-blue-400 uppercase tracking-[0.4em]">{m}</p>
                                     <span className="text-[10px] font-black text-blue-600 group-hover:text-white">{pct.toFixed(0)}%</span>
                                   </div>
                                   <p className="text-4xl font-black text-gray-900 group-hover:text-white transition-colors tracking-tighter mt-3">{marketCount}</p>
                                   <div className="mt-4 h-2 bg-gray-200 group-hover:bg-white/10 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-600 group-hover:bg-blue-400 rounded-full" style={{ width: `${pct}%` }}></div>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[48px] shadow-xl shadow-gray-100 border border-gray-50">
                      <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.45em] mb-8">Content Type Mix (per Model)</h3>
                      <div className="space-y-5">
                        {config.models.map(m => {
                          const modelAssets = assets.filter(a => a.carModel === m);
                          const img = modelAssets.filter(a => a.type === 'image').length;
                          const vid = modelAssets.filter(a => a.type === 'video').length;
                          const txt = modelAssets.filter(a => a.type === 'text').length;
                          const other = Math.max(0, modelAssets.length - img - vid - txt);
                          return (
                            <div key={m} className="p-6 bg-gray-50/50 rounded-[28px] border border-gray-100">
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-[12px] font-black uppercase tracking-widest text-gray-900 truncate">{m}</p>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{modelAssets.length} total</span>
                              </div>
                              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                                <div className="py-2 rounded-xl bg-white border border-gray-100">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Img</p>
                                  <p className="text-lg font-black text-gray-900">{img}</p>
                                </div>
                                <div className="py-2 rounded-xl bg-white border border-gray-100">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vid</p>
                                  <p className="text-lg font-black text-gray-900">{vid}</p>
                                </div>
                                <div className="py-2 rounded-xl bg-white border border-gray-100">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Txt</p>
                                  <p className="text-lg font-black text-gray-900">{txt}</p>
                                </div>
                                <div className="py-2 rounded-xl bg-white border border-gray-100">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Oth</p>
                                  <p className="text-lg font-black text-gray-900">{other}</p>
                                </div>
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
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em] mb-8">
                        {assets.filter(a => (a.collectionIds || []).includes(c.id)).length} Linked Creatives
                      </p>
                      <button
                        onClick={() => { setActiveCollectionId(c.id); setViewMode('repository'); }}
                        className="w-full py-5 bg-gray-50 text-gray-900 rounded-[28px] text-[11px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all"
                      >
                        ENTER FOLDER
                      </button>
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

            {viewMode === 'trash' && (
              <div className="space-y-16 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-6xl font-black text-gray-900 tracking-tighter uppercase leading-none">TRASH</h2>
                    <p className="text-[12px] font-black text-gray-400 mt-4 uppercase tracking-[0.4em]">Deleted Assets (Auto-deleted after 3 days)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-7xl font-black text-red-600 leading-none tracking-tighter">
                      {assets.filter(a => a.deletedAt).length}
                    </p>
                    <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.5em] mt-3">Deleted Items</p>
                  </div>
                </div>

                {filteredAssets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                    {sortedAssets.map(asset => {
                      const packageAssets = asset.packageId 
                        ? packageMap.get(asset.packageId) || [asset]
                        : [asset];
                      const daysUntilPermanent = asset.deletedAt 
                        ? Math.ceil((3 * 24 * 60 * 60 * 1000 - (Date.now() - asset.deletedAt)) / (24 * 60 * 60 * 1000))
                        : 0;
                      
                      return (
                        <div key={asset.id} className="relative">
                          <AssetCard 
                            asset={asset}
                            packageAssets={packageAssets}
                            userRole={currentUser?.role!}
                            onPreview={setPreviewAsset}
                            onEdit={(a) => { setEditingAsset(a); setIsAssetModalOpen(true); }}
                            onDelete={storageService.deleteAsset}
                            onRestore={storageService.restoreAsset}
                            isTrashView={true}
                          />
                          {daysUntilPermanent > 0 && (
                            <div className="absolute bottom-4 left-4 right-4 bg-red-50 border-2 border-red-200 rounded-xl p-2 text-center">
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                                Auto-deletes in {daysUntilPermanent} day{daysUntilPermanent !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-48 text-center border-4 border-dashed border-gray-100 rounded-[64px] bg-gray-50/30">
                    <p className="text-sm font-black text-gray-300 uppercase tracking-[0.6em]">TRASH IS EMPTY</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <AssetFormModal 
        isOpen={isAssetModalOpen} 
        onClose={() => { setIsAssetModalOpen(false); setEditingAsset(null); }} 
        onSave={handleSaveAsset}
        onSavePackage={handleSavePackage}
        editingAsset={editingAsset}
        config={config}
        collections={collections}
      />
      <AIInsightsModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)}
        assets={assets}
        collections={collections}
        config={config}
        currentView={viewMode}
        selectedMarket={selectedMarket !== 'All' ? selectedMarket : undefined}
        selectedModel={selectedModel !== 'All' ? selectedModel : undefined}
        selectedPlatform={selectedPlatform !== 'All' ? selectedPlatform : undefined}
      />
      {isAdminPanelOpen && <AdminPanel assets={assets} config={config} users={users} currentUser={currentUser!} onClose={() => setIsAdminPanelOpen(false)} />}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        config={config}
        onProgress={(progress, status) => {
          setUploadProgress(progress);
          setUploadStatus(status);
          if (progress === 0 && !status) {
            // Reset after delay
            setTimeout(() => {
              setUploadProgress(null);
              setUploadStatus('');
            }, 500);
          }
        }}
      />
      
      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Uploading Asset</h3>
              {uploadStatus && (
                <p className="text-sm font-bold text-gray-600">{uploadStatus}</p>
              )}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="h-full w-full bg-gradient-to-r from-blue-500 to-blue-600 animate-pulse"></div>
                </div>
              </div>
              <p className="text-xs font-black text-gray-400 text-center uppercase tracking-widest">
                {Math.round(uploadProgress)}% Complete
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={() => setPreviewAsset(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPreviewAsset(null)}></div>
          <div className="relative max-w-6xl max-h-[90vh] bg-white rounded-[40px] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => setPreviewAsset(null)}
                className="p-3 bg-white/90 hover:bg-white rounded-full transition-all shadow-lg"
              >
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {previewAsset.type === 'image' && previewAsset.url && (
              <img src={previewAsset.url} alt={previewAsset.title} className="w-full h-auto max-h-[90vh] object-contain" />
            )}
            {previewAsset.type === 'video' && previewAsset.url && (() => {
              // Use proxy only when needed (e.g., MOV conversion)
              const useStorageProxy = import.meta.env.VITE_STORAGE_PROXY === 'true';
              const isAllowedProxyHost = (u: URL) => {
                return (
                  u.hostname === 'firebasestorage.googleapis.com' ||
                  u.hostname === 'storage.googleapis.com' ||
                  u.hostname.endsWith('.firebasestorage.app') ||
                  u.hostname.endsWith('.appspot.com')
                );
              };
              const getVideoUrl = (url: string) => {
                try {
                  const u = new URL(url);
                  const path = u.pathname.toLowerCase();
                  const isMov = path.endsWith('.mov') || path.endsWith('.qt');
                  if (isAllowedProxyHost(u)) {
                    // For MOV files in preview, try conversion endpoint
                    if (isMov) {
                      return `/api/convert-video?url=${encodeURIComponent(url)}`;
                    }
                    if (useStorageProxy) {
                      return `/api/fetch-image?url=${encodeURIComponent(url)}`;
                    }
                  }
                } catch {
                  // Not a valid URL, return as-is
                }
                return url;
              };
              
              // Detect video format from URL - comprehensive format support
              const detectVideoFormat = (url: string): string | null => {
                try {
                  const u = new URL(url);
                  const path = u.pathname.toLowerCase();
                  const ext = path.split('.').pop() || '';
                  const formatMap: Record<string, string> = {
                    // MP4 variants (widely supported)
                    'mp4': 'video/mp4',
                    'm4v': 'video/mp4',
                    'm4a': 'video/mp4',
                    // WebM (open format, good browser support)
                    'webm': 'video/webm',
                    // OGG (open format)
                    'ogg': 'video/ogg',
                    'ogv': 'video/ogg',
                    'ogm': 'video/ogg',
                    // QuickTime/MOV - try as MP4 (many MOV files are H.264/MP4 compatible)
                    'mov': 'video/mp4', // Many MOV files contain H.264 which browsers support as MP4
                    'qt': 'video/mp4',
                    // AVI variants (limited browser support)
                    'avi': 'video/x-msvideo',
                    'divx': 'video/x-msvideo',
                    // Windows Media (limited support)
                    'wmv': 'video/x-ms-wmv',
                    'asf': 'video/x-ms-asf',
                    // Flash Video (deprecated)
                    'flv': 'video/x-flv',
                    'f4v': 'video/x-flv',
                    // Matroska (limited support)
                    'mkv': 'video/x-matroska',
                    'mk3d': 'video/x-matroska',
                    'mka': 'video/x-matroska',
                    'mks': 'video/x-matroska',
                    // Mobile formats
                    '3gp': 'video/3gpp',
                    '3g2': 'video/3gpp2',
                    '3gpp': 'video/3gpp',
                    '3gpp2': 'video/3gpp2',
                    // Other formats
                    'ts': 'video/mp2t',
                    'mts': 'video/mp2t',
                    'm2ts': 'video/mp2t',
                    'vob': 'video/dvd',
                  };
                  return formatMap[ext] || null;
                } catch {
                  return null;
                }
              };
              
              const videoUrl = getVideoUrl(previewAsset.url);
              const videoFormat = detectVideoFormat(previewAsset.url);
              // Formats that are likely unsupported by browsers (may need download)
              const isLikelyUnsupported = previewAsset.url.toLowerCase().match(/\.(mov|avi|wmv|flv|mkv|3gp|3g2|divx|asf|rm|rmvb|vob|ts|mts|m2ts)$/);
              
              return <VideoPlayerComponent 
                videoUrl={videoUrl} 
                videoFormat={videoFormat} 
                isLikelyUnsupported={!!isLikelyUnsupported}
                originalUrl={previewAsset.url}
              />;
            })()}
            {previewAsset.type === 'text' && (
              <div className="p-12 max-h-[90vh] overflow-y-auto">
                <h2 className="text-3xl font-black text-gray-900 mb-4">{previewAsset.title}</h2>
                <p className="text-lg text-gray-700 whitespace-pre-wrap">{previewAsset.content}</p>
              </div>
            )}
            {previewAsset.type === 'design' && (
              <div className="p-12 text-center">
                <h2 className="text-3xl font-black text-gray-900 mb-4">{previewAsset.title}</h2>
                <p className="text-gray-600">Design file - download to view</p>
              </div>
            )}
            
            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-3 py-1 rounded-lg bg-gray-200 text-[10px] font-black text-gray-700 uppercase">{previewAsset.market}</span>
                <span className="px-3 py-1 rounded-lg bg-blue-100 text-[10px] font-black text-blue-700 uppercase">{previewAsset.platform}</span>
                <span className="px-3 py-1 rounded-lg bg-purple-100 text-[10px] font-black text-purple-700 uppercase">{previewAsset.carModel}</span>
              </div>
              {previewAsset.objectives && previewAsset.objectives.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {previewAsset.objectives.map(obj => (
                    <span key={obj} className="px-3 py-1 rounded-lg bg-green-100 text-[10px] font-black text-green-700 uppercase">{obj}</span>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-600">Uploaded by {previewAsset.uploadedBy} • {new Date(previewAsset.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
