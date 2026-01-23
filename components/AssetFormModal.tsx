
import React, { useState, useEffect } from 'react';
import { Asset, CAR_MODELS, CarModel, Collection, MARKETS, Market, PLATFORMS, Platform, AssetType, USAGE_RIGHTS, UsageRights, OBJECTIVES, AssetObjective, SystemConfig } from '../types';

// Fixed: Added config to props interface to match App.tsx usage
interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<Asset, 'id' | 'createdAt'> | Partial<Asset>, file?: File) => void;
  onSavePackage?: (assets: Array<{ asset: Omit<Asset, 'id' | 'createdAt'>; file?: File }>) => void;
  editingAsset?: Asset | null;
  config: SystemConfig;
  collections: Collection[];
}

const AssetFormModal: React.FC<AssetFormModalProps> = ({ isOpen, onClose, onSave, onSavePackage, editingAsset, config, collections }) => {
  const [title, setTitle] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [type, setType] = useState<AssetType>('image');
  // Fixed: Initialized state using config with fallback to constants
  const [market, setMarket] = useState<Market>(config.markets[0] || MARKETS[0]);
  const [platform, setPlatform] = useState<Platform>(config.platforms[0] || PLATFORMS[0]);
  const [carModel, setCarModel] = useState<CarModel>(config.models[0] || CAR_MODELS[0]);
  const [selectedObjectives, setSelectedObjectives] = useState<AssetObjective[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isPackageMode, setIsPackageMode] = useState(false);
  const [usageRights, setUsageRights] = useState<UsageRights>(USAGE_RIGHTS[0]);
  
  const [ctr, setCtr] = useState<string>('');
  const [cpl, setCpl] = useState<string>('');
  const [cr, setCr] = useState<string>('');
  const [comments, setComments] = useState('');
  
  useEffect(() => {
    if (editingAsset) {
      setTitle(editingAsset.title);
      setUploaderName(editingAsset.uploadedBy);
      setType(editingAsset.type);
      setMarket(editingAsset.market);
      setPlatform(editingAsset.platform);
      setCarModel(editingAsset.carModel);
      setSelectedObjectives(editingAsset.objectives || []);
      setSelectedCollectionIds(editingAsset.collectionIds || []);
      setContent(editingAsset.content || '');
      setCtr(editingAsset.ctr?.toString() || '');
      setCr(editingAsset.cr?.toString() || '');
      setCpl(editingAsset.cpl?.toString() || '');
      setComments(editingAsset.comments || '');
      setUsageRights(editingAsset.usageRights || USAGE_RIGHTS[0]);
    } else {
      setTitle('');
      setUploaderName('');
      setType('image');
      setMarket('Global' as Market);
      setPlatform(config.platforms[0] || PLATFORMS[0]);
      setCarModel(config.models[0] || CAR_MODELS[0]);
      setSelectedObjectives([]);
      setSelectedCollectionIds([]);
      setContent('');
      setCtr('');
      setCr('');
      setCpl('');
      setComments('');
      setUsageRights(USAGE_RIGHTS[0]);
      setFile(null);
      setFiles([]);
      setIsPackageMode(false);
    }
  }, [editingAsset, isOpen, config]);

  if (!isOpen) return null;

  const toggleObjective = (obj: AssetObjective) => {
    setSelectedObjectives(prev => 
      prev.includes(obj) ? prev.filter(item => item !== obj) : [...prev, obj]
    );
  };

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedObjectives.length === 0) {
      alert("Please select at least one campaign objective.");
      return;
    }

    if (isPackageMode && files.length === 0) {
      alert("Please select at least one file for the package.");
      return;
    }

    if (!isPackageMode && !file && type !== 'text' && !content) {
      alert("Please select a file to upload.");
      return;
    }

    if (isPackageMode && onSavePackage) {
      // Create package with multiple files
      const packageId = `pkg_${Date.now()}`;
      const packageAssets = files.map((f, idx) => {
        // Extract platform from filename or use default
        const filename = f.name.toLowerCase();
        let assetPlatform = platform;
        if (filename.includes('google') || filename.includes('gads')) assetPlatform = 'Google';
        else if (filename.includes('meta') || filename.includes('facebook') || filename.includes('instagram')) assetPlatform = 'Meta';
        else if (filename.includes('video') || filename.includes('youtube')) assetPlatform = 'Video';
        else if (filename.includes('dooh') || filename.includes('display')) assetPlatform = 'DOOH';
        else if (filename.includes('banner')) assetPlatform = 'Banner';

        return {
          asset: {
            title: `${title} - ${assetPlatform}`,
            type,
            market,
            platform: assetPlatform,
            carModel,
            usageRights,
            objectives: selectedObjectives,
            ...(selectedCollectionIds.length > 0 ? { collectionIds: selectedCollectionIds } : {}),
            uploadedBy: uploaderName || 'Anonymous',
            ctr: ctr ? parseFloat(ctr) : undefined,
            cpl: cpl ? parseFloat(cpl) : undefined,
            cr: cr ? parseFloat(cr) : undefined,
            comments: comments || undefined,
            packageId,
            packageOrder: idx
          } as Omit<Asset, 'id' | 'createdAt'>,
          file: f
        };
      });

      await onSavePackage(packageAssets);
      onClose();
      return;
    }

    const data = {
      title,
      type,
      market,
      platform,
      carModel,
      usageRights,
      objectives: selectedObjectives,
      ...(selectedCollectionIds.length > 0 ? { collectionIds: selectedCollectionIds } : {}),
      content: type === 'text' ? content : undefined,
      uploadedBy: uploaderName || 'Anonymous',
      ctr: ctr ? parseFloat(ctr) : undefined,
      cpl: cpl ? parseFloat(cpl) : undefined,
      cr: cr ? parseFloat(cr) : undefined,
      comments: comments || undefined
    };

    onSave(data, file || undefined);
    onClose();
  };

  const inputClasses = "w-full rounded-xl border-gray-300 border-2 p-3 focus:border-blue-500 bg-white text-gray-900 outline-none transition-all font-medium shadow-sm cursor-pointer";

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md"></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">{editingAsset ? 'Edit Asset Info' : 'Upload New Asset'}</h3>
                <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-5 text-gray-900">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Asset Title</label>
                    <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClasses} placeholder="Title..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Uploader</label>
                    <input required type="text" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} className={inputClasses} placeholder="Name..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Asset Type</label>
                        <select value={type} disabled={!!editingAsset} onChange={(e) => setType(e.target.value as AssetType)} className={inputClasses}>
                            <option className="text-gray-900 bg-white" value="image">Image</option>
                            <option className="text-gray-900 bg-white" value="video">Video</option>
                            <option className="text-gray-900 bg-white" value="text">Text / Copy</option>
                            <option className="text-gray-900 bg-white" value="design">PSD or Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Market</label>
                        <select value={market} onChange={(e) => setMarket(e.target.value as Market)} className={inputClasses}>
                            <option className="text-gray-900 bg-white" value="Global">Global</option>
                            {(config.markets.length > 0 ? config.markets : MARKETS).map(m => <option className="text-gray-900 bg-white" key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Platform</label>
                        <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={inputClasses}>
                            {(config.platforms.length > 0 ? config.platforms : PLATFORMS).map(p => <option className="text-gray-900 bg-white" key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Car Model</label>
                        <select value={carModel} onChange={(e) => setCarModel(e.target.value as CarModel)} className={inputClasses}>
                            {(config.models.length > 0 ? config.models : CAR_MODELS).map(m => <option className="text-gray-900 bg-white" key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Campaign Objectives (Select all that apply)</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {OBJECTIVES.map(obj => (
                            <button
                                key={obj}
                                type="button"
                                onClick={() => toggleObjective(obj)}
                                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                                    selectedObjectives.includes(obj)
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                            >
                                {obj}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Projects (Optional)</label>
                    {collections.length === 0 ? (
                      <div className="text-xs text-gray-400 font-bold bg-gray-50 border-2 border-gray-100 rounded-2xl p-4">
                        No projects yet. Create one in the Projects tab to link assets.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {collections.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCollection(c.id)}
                            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                              selectedCollectionIds.includes(c.id)
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={c.name}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Usage Rights & Licensing</label>
                    <select value={usageRights} onChange={(e) => setUsageRights(e.target.value as UsageRights)} className={inputClasses}>
                        {USAGE_RIGHTS.map(r => <option className="text-gray-900 bg-white" key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border-2 border-gray-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Performance Metrics</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">CTR (%)</label>
                            <input type="number" step="0.01" value={ctr} onChange={(e) => setCtr(e.target.value)} className="w-full rounded-lg border-gray-300 border-2 p-2.5 text-sm font-bold outline-none bg-white text-gray-900 shadow-sm" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">CR (%)</label>
                            <input type="number" step="0.01" value={cr} onChange={(e) => setCr(e.target.value)} className="w-full rounded-lg border-gray-300 border-2 p-2.5 text-sm font-bold outline-none bg-white text-gray-900 shadow-sm" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">CPL (€)</label>
                            <input type="number" step="0.01" value={cpl} onChange={(e) => setCpl(e.target.value)} className="w-full rounded-lg border-gray-300 border-2 p-2.5 text-sm font-bold outline-none bg-white text-gray-900 shadow-sm" placeholder="0.00" />
                        </div>
                    </div>
                </div>

                {!editingAsset && (
                  <>
                    {type !== 'text' && (
                      <div className="flex items-center gap-3 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPackageMode}
                            onChange={(e) => {
                              setIsPackageMode(e.target.checked);
                              setFile(null);
                              setFiles([]);
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-black text-gray-700 uppercase tracking-widest">
                            Upload as Package (Multiple Formats)
                          </span>
                        </label>
                      </div>
                    )}
                    {type === 'text' ? (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Ad Copy Content</label>
                            <textarea required rows={4} value={content} onChange={(e) => setContent(e.target.value)} className={inputClasses} placeholder="Paste copy here..." />
                        </div>
                    ) : isPackageMode ? (
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-400 bg-gray-50/50 transition-colors relative">
                            <input 
                              type="file" 
                              required 
                              multiple
                              accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*'} 
                              onChange={(e) => {
                                const selectedFiles = Array.from(e.target.files || []);
                                setFiles(selectedFiles);
                              }} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                            <div className="space-y-2 pointer-events-none">
                              <p className="text-sm font-bold text-gray-600">
                                {files.length > 0 ? `${files.length} file(s) selected` : `Select multiple ${type} files`}
                              </p>
                              <p className="text-xs text-gray-400">Upload different formats/dimensions for different platforms</p>
                            </div>
                          </div>
                          {files.length > 0 && (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {files.map((f, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <span className="text-xs font-bold text-gray-700 truncate flex-1">{f.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                                    className="ml-2 text-red-500 hover:text-red-700 text-xs font-black"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-400 bg-gray-50/50 transition-colors relative">
                            <input type="file" required accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*'} onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="space-y-2 pointer-events-none">
                                <p className="text-sm font-bold text-gray-600">{file ? file.name : `Select ${type} file`}</p>
                                <p className="text-xs text-gray-400">High quality recommended</p>
                            </div>
                        </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-6 flex gap-3 rounded-b-3xl">
              <button type="submit" className="flex-1 rounded-xl py-3.5 bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
                {editingAsset ? 'Update Changes' : 'Publish Asset'}
              </button>
              <button type="button" onClick={onClose} className="px-6 rounded-xl py-3.5 bg-white border-2 border-gray-200 text-gray-600 font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssetFormModal;
