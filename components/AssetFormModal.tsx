
import React, { useState, useEffect } from 'react';
import { Asset, CAR_MODELS, CarModel, Collection, MARKETS, Market, PLATFORMS, Platform, AssetType, USAGE_RIGHTS, UsageRights, OBJECTIVES, AssetObjective, SystemConfig, Brand, BRANDS, getModelsForBrand } from '../types';
import { storageService } from '../services/storageService';

// Fixed: Added config to props interface to match App.tsx usage
interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<Asset, 'id' | 'createdAt'> | Partial<Asset>, file?: File) => void;
  onSavePackage?: (assets: Array<{ asset: Omit<Asset, 'id' | 'createdAt'>; file?: File }>) => void;
  editingAsset?: Asset | null;
  editingPackageAssets?: Asset[]; // All assets in the package being edited
  config: SystemConfig;
  collections: Collection[];
}

const AssetFormModal: React.FC<AssetFormModalProps> = ({ isOpen, onClose, onSave, onSavePackage, editingAsset, editingPackageAssets = [], config, collections }) => {
  const [title, setTitle] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [type, setType] = useState<AssetType>('image');
  // Fixed: Initialized state using config with fallback to constants
  const [market, setMarket] = useState<Market>(config.markets[0] || MARKETS[0]);
  const [platform, setPlatform] = useState<Platform>(config.platforms[0] || PLATFORMS[0]);
  const [carModel, setCarModel] = useState<CarModel>(getModelsForBrand(config, 'BYD')[0] || CAR_MODELS[0]);
  const [selectedCarModels, setSelectedCarModels] = useState<CarModel[]>([]);
  const [customCarModel, setCustomCarModel] = useState<string>('');
  const [selectedObjectives, setSelectedObjectives] = useState<AssetObjective[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileTitles, setFileTitles] = useState<Record<number, string>>({}); // Store custom titles for each file
  const [packageAssetTitles, setPackageAssetTitles] = useState<Record<string, string>>({}); // Store custom titles for package assets when editing
  const [packageThumbnails, setPackageThumbnails] = useState<Record<number, string>>({}); // Store generated thumbnails for package files
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null); // Selected thumbnail index for package preview
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [isPackageMode, setIsPackageMode] = useState(false);
  const [isChangingPreview, setIsChangingPreview] = useState(false); // For edit mode - show preview selection UI
  const [editPackageThumbnails, setEditPackageThumbnails] = useState<Record<string, string>>({}); // Thumbnails for editing existing package
  const [originalTitle, setOriginalTitle] = useState('');
  const [usageRights, setUsageRights] = useState<UsageRights>(USAGE_RIGHTS[0]);
  const [isCarModelsDropdownOpen, setIsCarModelsDropdownOpen] = useState(false);
  const [brand, setBrand] = useState<Brand>('BYD');
  const [packageNote, setPackageNote] = useState('');
  const modelsList = getModelsForBrand(config, brand);
  const [selectedPackageTypes, setSelectedPackageTypes] = useState<AssetType[]>(['image', 'video']);
  
  const [ctr, setCtr] = useState<string>('');
  const [cpl, setCpl] = useState<string>('');
  const [cr, setCr] = useState<string>('');
  const [comments, setComments] = useState('');
  
  useEffect(() => {
    if (editingAsset) {
      setTitle(editingAsset.title);
      setOriginalTitle(editingAsset.title);
      setUploaderName(editingAsset.uploadedBy);
      setType(editingAsset.type);
      setMarket(editingAsset.market);
      setPlatform(editingAsset.platform);
      // Support both old (carModel) and new (carModels) format
      const editModelsList = getModelsForBrand(config, editingAsset.brand || 'BYD');
      if (editingAsset.carModels && editingAsset.carModels.length > 0) {
        setSelectedCarModels(editingAsset.carModels);
        setCarModel(editModelsList[0] || CAR_MODELS[0]);
        setCustomCarModel('');
      } else {
        setCarModel(editingAsset.carModel);
        // Check if the model is not in the standard list, treat it as custom
        const isCustomModel = !(editModelsList.length > 0 ? editModelsList : CAR_MODELS).includes(editingAsset.carModel);
        if (isCustomModel) {
          setCustomCarModel(editingAsset.carModel);
          setCarModel('Other' as CarModel);
          setSelectedCarModels([]);
        } else {
          setCustomCarModel('');
          setSelectedCarModels([editingAsset.carModel]);
        }
      }
      setSelectedObjectives(editingAsset.objectives || []);
      setSelectedCollectionIds(editingAsset.collectionIds || []);
      setContent(editingAsset.content || '');
      setCtr(editingAsset.ctr?.toString() || '');
      setCr(editingAsset.cr?.toString() || '');
      setCpl(editingAsset.cpl?.toString() || '');
      setComments(editingAsset.comments || '');
      setUsageRights(editingAsset.usageRights || USAGE_RIGHTS[0]);
      setBrand(editingAsset.brand || 'BYD');
      setPackageNote(editingAsset.packageNote || '');
      setSelectedPackageTypes(editingAsset.packageAssetTypes?.length ? editingAsset.packageAssetTypes : ['image', 'video']);
      
      // If editing a package, initialize package asset titles
      if (editingPackageAssets.length > 1) {
        const titles: Record<string, string> = {};
        editingPackageAssets.forEach(asset => {
          titles[asset.id] = asset.title;
        });
        setPackageAssetTitles(titles);
        
        // Find current preview asset
        const currentPreviewId = editingAsset.packagePreviewAssetId;
        const currentPreviewIndex = editingPackageAssets.findIndex(a => a.id === currentPreviewId);
        if (currentPreviewIndex >= 0) {
          setSelectedPreviewIndex(currentPreviewIndex);
        } else {
          setSelectedPreviewIndex(0);
        }
      } else {
        setPackageAssetTitles({});
        setSelectedPreviewIndex(null);
      }
      setIsChangingPreview(false);
      setEditPackageThumbnails({});
    } else {
      setTitle('');
      setOriginalTitle('');
      setUploaderName('');
      setType('image');
      setMarket('Global' as Market);
      setPlatform(config.platforms[0] || PLATFORMS[0]);
      setCarModel(getModelsForBrand(config, 'BYD')[0] || CAR_MODELS[0]);
      setSelectedCarModels([]);
      setCustomCarModel('');
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
      setFileTitles({});
      setPackageAssetTitles({});
      setPackageThumbnails({});
      setEditPackageThumbnails({});
      setSelectedPreviewIndex(null);
      setIsChangingPreview(false);
      setIsPackageMode(false);
      setIsCarModelsDropdownOpen(false);
      setBrand('BYD');
      setPackageNote('');
      setSelectedPackageTypes(['image', 'video']);
    }
  }, [editingAsset, isOpen, config]);

  // Close dropdown when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsCarModelsDropdownOpen(false);
    }
  }, [isOpen]);

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

  const toggleCarModel = (model: CarModel) => {
    setSelectedCarModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const togglePackageType = (t: AssetType) => {
    setSelectedPackageTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const ASSET_TYPES: { value: AssetType; label: string }[] = [
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'design', label: 'Design / PSD' },
    { value: 'text', label: 'Text / Copy' },
  ];

  const buildCollectionTree = (parentId: string | null | undefined): Collection[] => {
    return collections.filter(c => (c.parentId ?? null) === parentId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedObjectives.length === 0) {
      alert("Please select at least one campaign objective.");
      return;
    }
    if (selectedCarModels.length === 0) {
      alert("Please select at least one car model.");
      return;
    }

    // Skip file validation when editing existing asset (only updating metadata)
    if (!editingAsset) {
      if (isPackageMode && files.length === 0) {
        alert("Please select at least one file for the package.");
        return;
      }

      if (!isPackageMode && !file && type !== 'text' && !content) {
        alert("Please select a file to upload.");
        return;
      }
    }

    if (isPackageMode && onSavePackage) {
      // Create package with multiple files
      const packageId = `pkg_${Date.now()}`;
      const previewAssetIndex = selectedPreviewIndex !== null ? selectedPreviewIndex : 0;
      const packageAssets = files.map((f, idx) => {
        // Infer asset type per file for package (image, video, or design)
        let fileType: AssetType = 'design';
        if (f.type.startsWith('image/')) fileType = 'image';
        else if (f.type.startsWith('video/')) fileType = 'video';
        else if (f.type.startsWith('text/')) fileType = 'text';
        else {
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) fileType = 'image';
          else if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) fileType = 'video';
        }

        // Extract platform from filename or use default
        const filename = f.name.toLowerCase();
        let assetPlatform = platform;
        if (filename.includes('google') || filename.includes('gads')) assetPlatform = 'Google';
        else if (filename.includes('meta') || filename.includes('facebook') || filename.includes('instagram')) assetPlatform = 'Meta';
        else if (filename.includes('video') || filename.includes('youtube')) assetPlatform = 'Video';
        else if (filename.includes('dooh') || filename.includes('display')) assetPlatform = 'DOOH';
        else if (filename.includes('banner')) assetPlatform = 'Banner';

        // Use custom per-file title if provided, otherwise use main title field, otherwise use filename
        const fileTitle = fileTitles[idx] || title || f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        // Handle car models: if "Other" is selected, use customCarModel
        const processedCarModels = selectedCarModels.length > 0 
          ? selectedCarModels.map(m => m === 'Other' ? (customCarModel || m) : m)
          : (carModel === 'Other' ? [customCarModel || carModel] : [carModel]);
        const primaryCarModel = processedCarModels[0] || carModel;

        return {
          asset: {
            title: fileTitle,
            type: fileType,
            market,
            platform: assetPlatform,
            carModel: primaryCarModel,
            carModels: processedCarModels.length > 1 ? processedCarModels : undefined,
            usageRights,
            objectives: selectedObjectives,
            ...(selectedCollectionIds.length > 0 ? { collectionIds: selectedCollectionIds } : {}),
            uploadedBy: uploaderName || 'Anonymous',
            ctr: ctr ? parseFloat(ctr) : undefined,
            cpl: cpl ? parseFloat(cpl) : undefined,
            cr: cr ? parseFloat(cr) : undefined,
            comments: comments || undefined,
            packageId,
            packageOrder: idx,
            originalFileName: f.name, // Store original Windows filename
            brand: brand || undefined,
            packageNote: packageNote.trim() || undefined,
            packageAssetTypes: selectedPackageTypes.length > 0 ? selectedPackageTypes : undefined,
            // Store which asset should be used as preview (will be set after upload with actual IDs)
            ...(idx === previewAssetIndex ? { packagePreviewAssetId: 'temp_' + idx } : {})
          } as Omit<Asset, 'id' | 'createdAt'>,
          file: f
        };
      });
      
      // After upload, we'll need to update the preview asset ID with the actual asset ID
      // This will be handled in the onSavePackage callback

      await onSavePackage(packageAssets);
      onClose();
      return;
    }

    // Handle car models: if "Other" is selected, use customCarModel
    const processedCarModels = selectedCarModels.length > 0 
      ? selectedCarModels.map(m => m === 'Other' ? (customCarModel || m) : m)
      : (carModel === 'Other' ? [customCarModel || carModel] : [carModel]);
    const primaryCarModel = processedCarModels[0] || (carModel === 'Other' ? customCarModel : carModel);

    // Editing should UPDATE, not create a new asset.
    if (editingAsset) {
      // If editing a package, update all package assets with new titles
      if (editingPackageAssets.length > 1) {
        const nextMainTitle = title.trim();
        const hasMainTitleChange = nextMainTitle.length > 0 && nextMainTitle !== originalTitle;
        
        // Determine the new preview asset ID if preview was changed
        let newPreviewAssetId: string | undefined = undefined;
        if (isChangingPreview && selectedPreviewIndex !== null && selectedPreviewIndex < editingPackageAssets.length) {
          newPreviewAssetId = editingPackageAssets[selectedPreviewIndex].id;
        }
        
        // Update all package assets
        for (const pkgAsset of editingPackageAssets) {
          const perItemTitle = packageAssetTitles[pkgAsset.id] || pkgAsset.title;
          const shouldUseMainTitle =
            hasMainTitleChange && perItemTitle === originalTitle;
          const newTitle = shouldUseMainTitle ? nextMainTitle : perItemTitle;
          const updates: Partial<Asset> = {
            title: newTitle,
            // Preserve other fields
            type: pkgAsset.type,
            market,
            platform,
            carModel: primaryCarModel,
            ...(processedCarModels.length > 1 ? { carModels: processedCarModels } : {}),
            objectives: selectedObjectives,
            usageRights,
            uploadedBy: uploaderName || 'Anonymous',
            ctr: ctr ? parseFloat(ctr) : undefined,
            cpl: cpl ? parseFloat(cpl) : undefined,
            cr: cr ? parseFloat(cr) : undefined,
            comments: comments || undefined,
            content: pkgAsset.content,
            url: pkgAsset.url,
            size: pkgAsset.size,
            status: pkgAsset.status,
            createdAt: pkgAsset.createdAt,
            collectionIds: selectedCollectionIds,
            brand: brand || undefined,
            packageNote: packageNote.trim() || undefined,
            packageAssetTypes: selectedPackageTypes.length > 0 ? selectedPackageTypes : undefined,
            // Update preview asset ID if changed
            ...(newPreviewAssetId !== undefined ? { packagePreviewAssetId: newPreviewAssetId } : {}),
          };
          await storageService.updateAsset(pkgAsset.id, updates);
        }
        onClose();
        return;
      }
      
      // Regular single asset edit
      const updates: Partial<Asset> = {
        title,
        type,
        market,
        platform,
        carModel: primaryCarModel,
        ...(processedCarModels.length > 1 ? { carModels: processedCarModels } : {}),
        objectives: selectedObjectives,
        usageRights,
        uploadedBy: uploaderName || 'Anonymous',
        ctr: ctr ? parseFloat(ctr) : undefined,
        cpl: cpl ? parseFloat(cpl) : undefined,
        cr: cr ? parseFloat(cr) : undefined,
        comments: comments || undefined,
        content: content || undefined,
        // Preserve these fields from original asset
        url: editingAsset.url,
        size: editingAsset.size,
        status: editingAsset.status,
        createdAt: editingAsset.createdAt,
        // Always send collectionIds so folder filter updates correctly (including empty to clear)
        collectionIds: selectedCollectionIds,
        brand: brand || undefined,
      };
      
      onSave(updates, file || undefined);
      return;
    }

    const data = {
      title,
      type,
      market,
      platform,
      carModel: primaryCarModel,
      ...(processedCarModels.length > 1 ? { carModels: processedCarModels } : {}),
      usageRights,
      objectives: selectedObjectives,
      collectionIds: selectedCollectionIds,
      content: type === 'text' ? content : undefined,
      uploadedBy: uploaderName || 'Anonymous',
      ctr: ctr ? parseFloat(ctr) : undefined,
      cpl: cpl ? parseFloat(cpl) : undefined,
      cr: cr ? parseFloat(cr) : undefined,
      comments: comments || undefined,
      brand: brand || undefined,
    };

    onSave(data, file || undefined);
    onClose();
  };

  const getCleanFilename = (asset: Asset): string => {
    if (asset.originalFileName) return asset.originalFileName;
    if (!asset.url) return 'file';
    try {
      // Prefer decoded Firebase storage path if possible: "content/123-name.ext"
      const storagePath = storageService.extractStoragePath(asset.url);
      const raw = storagePath ? storagePath.split('/').pop() || '' : (asset.url.split('?')[0] || '').split('/').pop() || '';
      const decoded = decodeURIComponent(raw);
      // Strip timestamp prefix used in uploads: "123456789-name.ext"
      return (decoded.replace(/^\d+-/, '') || decoded || 'file').trim();
    } catch {
      return 'file';
    }
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
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Brand</label>
                        <select value={brand} onChange={(e) => setBrand(e.target.value as Brand)} className={inputClasses}>
                            {BRANDS.map(b => (
                              <option key={b} className="text-gray-900 bg-white" value={b}>{b}</option>
                            ))}
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

                {isPackageMode || (editingAsset && editingPackageAssets.length > 1) ? (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Asset types in this package</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                      {ASSET_TYPES.map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPackageTypes.includes(value)}
                            onChange={() => togglePackageType(value)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-gray-900">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Asset Type</label>
                    <select value={type} disabled={!!editingAsset} onChange={(e) => setType(e.target.value as AssetType)} className={inputClasses}>
                      {ASSET_TYPES.map(({ value, label }) => (
                        <option key={value} className="text-gray-900 bg-white" value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(isPackageMode || (editingAsset && editingPackageAssets.length > 1)) && (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Package note (description on card)</label>
                    <textarea value={packageNote} onChange={(e) => setPackageNote(e.target.value)} rows={2} className={inputClasses} placeholder="e.g. Launch campaign visuals + videos" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Platform</label>
                        <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={inputClasses}>
                            {(config.platforms.length > 0 ? config.platforms : PLATFORMS).map(p => <option className="text-gray-900 bg-white" key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Car Models (Select all that apply)</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsCarModelsDropdownOpen(!isCarModelsDropdownOpen)}
                                className={`w-full rounded-xl border-gray-300 border-2 p-3 focus:border-blue-500 bg-white text-gray-900 outline-none transition-all font-medium shadow-sm cursor-pointer text-left flex items-center justify-between ${
                                    selectedCarModels.length === 0 ? 'text-gray-400' : ''
                                }`}
                            >
                                <span>
                                    {selectedCarModels.length === 0 
                                        ? 'Select car models...' 
                                        : selectedCarModels.length === 1 
                                            ? (selectedCarModels[0] === 'Other' ? customCarModel || 'Other' : selectedCarModels[0])
                                            : `${selectedCarModels.length} models selected`}
                                </span>
                                <svg 
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isCarModelsDropdownOpen ? 'transform rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {isCarModelsDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsCarModelsDropdownOpen(false)}
                                    />
                                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                        <div className="p-2 space-y-1">
                                            {(modelsList.length > 0 ? modelsList : CAR_MODELS).map(m => (
                                                <label
                                                    key={m}
                                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCarModels.includes(m)}
                                                        onChange={() => toggleCarModel(m)}
                                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">{m}</span>
                                                </label>
                                            ))}
                                            <label 
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCarModels.includes('Other' as CarModel)}
                                                    onChange={() => toggleCarModel('Other' as CarModel)}
                                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Other</span>
                                            </label>
                                            {selectedCarModels.includes('Other' as CarModel) && (
                                                <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={customCarModel}
                                                        onChange={(e) => setCustomCarModel(e.target.value)}
                                                        placeholder="Enter custom model name"
                                                        className="w-full rounded-lg border-gray-300 border-2 p-2.5 text-sm font-medium outline-none focus:border-blue-500 bg-gray-50"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        {selectedCarModels.length === 0 && (
                            <p className="text-[10px] text-gray-400 font-bold mt-2 ml-1">Please select at least one model</p>
                        )}
                        {selectedCarModels.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedCarModels.map((m, idx) => (
                                    <span
                                        key={`${m}-${idx}`}
                                        className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-100 text-blue-700 border border-blue-200"
                                    >
                                        {m === 'Other' ? customCarModel || 'Other' : m}
                                    </span>
                                ))}
                            </div>
                        )}
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
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Project folder (optional)</label>
                    {collections.length === 0 ? (
                      <div className="text-xs text-gray-400 font-bold bg-gray-50 border-2 border-gray-100 rounded-2xl p-4">
                        No projects yet. Create one in the Projects tab to link assets.
                      </div>
                    ) : (
                      <div className="mt-1 space-y-0 max-h-48 overflow-y-auto border-2 border-gray-100 rounded-xl p-3 bg-gray-50">
                        {(() => {
                          const renderCollectionNode = (c: Collection, depth: number) => (
                            <React.Fragment key={c.id}>
                              <div style={{ marginLeft: depth * 16 }} className="flex items-center gap-2 py-1">
                                <input
                                  type="checkbox"
                                  id={`col-${c.id}`}
                                  checked={selectedCollectionIds.includes(c.id)}
                                  onChange={() => toggleCollection(c.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <label htmlFor={`col-${c.id}`} className="text-xs font-bold text-gray-900 cursor-pointer truncate flex-1">{c.name}</label>
                              </div>
                              {buildCollectionTree(c.id).map(child => renderCollectionNode(child, depth + 1))}
                            </React.Fragment>
                          );
                          return buildCollectionTree(null).map(c => renderCollectionNode(c, 0));
                        })()}
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

                {/* Show package asset name editor when editing a package */}
                {editingAsset && editingPackageAssets.length > 1 && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Edit Package Asset Names</p>
                      {!isChangingPreview && (
                        <button
                          type="button"
                          onClick={async () => {
                            setIsChangingPreview(true);
                            // Generate thumbnails for existing package assets
                            setIsGeneratingThumbnails(true);
                            const thumbnails: Record<string, string> = {};
                            
                            for (const pkgAsset of editingPackageAssets) {
                              try {
                                if (pkgAsset.type === 'image' && pkgAsset.url) {
                                  // Generate image thumbnail
                                  const img = new Image();
                                  img.crossOrigin = 'anonymous';
                                  await new Promise<void>((resolve, reject) => {
                                    img.onload = () => {
                                      try {
                                        const canvas = document.createElement('canvas');
                                        const maxSize = 200;
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
                                          thumbnails[pkgAsset.id] = canvas.toDataURL('image/jpeg', 0.7);
                                        }
                                        resolve();
                                      } catch (err) {
                                        reject(err);
                                      }
                                    };
                                    img.onerror = () => reject(new Error('Failed to load image'));
                                    img.src = pkgAsset.url;
                                  });
                                } else if (pkgAsset.type === 'video' && pkgAsset.url) {
                                  // Generate video thumbnail
                                  const video = document.createElement('video');
                                  video.crossOrigin = 'anonymous';
                                  await new Promise<void>((resolve, reject) => {
                                    video.onloadedmetadata = () => {
                                      try {
                                        video.currentTime = 0.5;
                                      } catch {
                                        video.currentTime = 0;
                                      }
                                    };
                                    video.onseeked = () => {
                                      try {
                                        const canvas = document.createElement('canvas');
                                        const maxSize = 200;
                                        let width = video.videoWidth;
                                        let height = video.videoHeight;
                                        
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
                                          ctx.drawImage(video, 0, 0, width, height);
                                          thumbnails[pkgAsset.id] = canvas.toDataURL('image/jpeg', 0.7);
                                        }
                                        resolve();
                                      } catch (err) {
                                        reject(err);
                                      }
                                    };
                                    video.onerror = () => reject(new Error('Failed to load video'));
                                    video.src = pkgAsset.url;
                                    video.muted = true;
                                    video.load();
                                  });
                                }
                              } catch (err) {
                                console.warn(`Failed to generate thumbnail for ${pkgAsset.title}:`, err);
                              }
                            }
                            
                            setEditPackageThumbnails(thumbnails);
                            setIsGeneratingThumbnails(false);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Change Preview Cover
                        </button>
                      )}
                    </div>
                    
                    {!isChangingPreview ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {editingPackageAssets.map((pkgAsset) => (
                          <div key={pkgAsset.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className="text-[10px] font-bold text-gray-500 truncate flex-1"
                                title={getCleanFilename(pkgAsset)}
                              >
                                {getCleanFilename(pkgAsset)}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={packageAssetTitles[pkgAsset.id] || pkgAsset.title}
                              onChange={(e) => {
                                setPackageAssetTitles({ ...packageAssetTitles, [pkgAsset.id]: e.target.value });
                              }}
                              placeholder="Enter custom name..."
                              className="w-full px-3 py-2 text-xs font-bold text-gray-900 bg-white border-2 border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Select Preview Image</p>
                          <button
                            type="button"
                            onClick={() => setIsChangingPreview(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400">Choose which image/video thumbnail to display on the package card</p>
                        {isGeneratingThumbnails ? (
                          <div className="text-center py-4">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <p className="text-xs text-gray-500 mt-2">Generating thumbnails...</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                            {editingPackageAssets.map((pkgAsset, idx) => {
                              const thumbnail = editPackageThumbnails[pkgAsset.id];
                              const isSelected = selectedPreviewIndex === idx;
                              return (
                                <button
                                  key={pkgAsset.id}
                                  type="button"
                                  onClick={() => setSelectedPreviewIndex(idx)}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                    isSelected 
                                      ? 'border-blue-600 ring-2 ring-blue-200' 
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  title={pkgAsset.title}
                                >
                                  {thumbnail ? (
                                    <img 
                                      src={thumbnail} 
                                      alt={pkgAsset.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                      {pkgAsset.type === 'image' ? (
                                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 truncate">
                                    {idx + 1}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                              setFileTitles({});
                              setPackageThumbnails({});
                              setSelectedPreviewIndex(null);
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
                              accept={selectedPackageTypes.length > 1 ? '*/*' : selectedPackageTypes.includes('image') || selectedPackageTypes.includes('video') || selectedPackageTypes.includes('design') ? 'image/*,video/*,*/*' : '*/*'} 
                              onChange={async (e) => {
                                const selectedFiles = Array.from(e.target.files || []);
                                setFiles(selectedFiles);
                                // Initialize titles with default (filename without extension)
                                const initialTitles: Record<number, string> = {};
                                selectedFiles.forEach((f, idx) => {
                                  initialTitles[idx] = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                                });
                                setFileTitles(initialTitles);
                                
                                // Generate thumbnails for all files
                                setIsGeneratingThumbnails(true);
                                setSelectedPreviewIndex(0); // Default to first file
                                const thumbnails: Record<number, string> = {};
                                
                                for (let idx = 0; idx < selectedFiles.length; idx++) {
                                  const file = selectedFiles[idx];
                                  try {
                                    if (file.type.startsWith('image/')) {
                                      // Generate image thumbnail
                                      const img = new Image();
                                      const objectUrl = URL.createObjectURL(file);
                                      await new Promise<void>((resolve, reject) => {
                                        img.onload = () => {
                                          try {
                                            const canvas = document.createElement('canvas');
                                            const maxSize = 200;
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
                                              thumbnails[idx] = canvas.toDataURL('image/jpeg', 0.7);
                                            }
                                            URL.revokeObjectURL(objectUrl);
                                            resolve();
                                          } catch (err) {
                                            URL.revokeObjectURL(objectUrl);
                                            reject(err);
                                          }
                                        };
                                        img.onerror = () => {
                                          URL.revokeObjectURL(objectUrl);
                                          reject(new Error('Failed to load image'));
                                        };
                                        img.src = objectUrl;
                                      });
                                    } else if (file.type.startsWith('video/')) {
                                      // Generate video thumbnail
                                      const video = document.createElement('video');
                                      const objectUrl = URL.createObjectURL(file);
                                      await new Promise<void>((resolve, reject) => {
                                        video.onloadedmetadata = () => {
                                          try {
                                            video.currentTime = 0.5; // Seek to 0.5 seconds
                                          } catch {
                                            // If seeking fails, try at 0
                                            video.currentTime = 0;
                                          }
                                        };
                                        video.onseeked = () => {
                                          try {
                                            const canvas = document.createElement('canvas');
                                            const maxSize = 200;
                                            let width = video.videoWidth;
                                            let height = video.videoHeight;
                                            
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
                                              ctx.drawImage(video, 0, 0, width, height);
                                              thumbnails[idx] = canvas.toDataURL('image/jpeg', 0.7);
                                            }
                                            URL.revokeObjectURL(objectUrl);
                                            resolve();
                                          } catch (err) {
                                            URL.revokeObjectURL(objectUrl);
                                            reject(err);
                                          }
                                        };
                                        video.onerror = () => {
                                          URL.revokeObjectURL(objectUrl);
                                          reject(new Error('Failed to load video'));
                                        };
                                        video.src = objectUrl;
                                        video.muted = true;
                                        video.load();
                                      });
                                    }
                                  } catch (err) {
                                    console.warn(`Failed to generate thumbnail for ${file.name}:`, err);
                                  }
                                }
                                
                                setPackageThumbnails(thumbnails);
                                setIsGeneratingThumbnails(false);
                              }} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                            <div className="space-y-2 pointer-events-none">
                              <p className="text-sm font-bold text-gray-600">
                                {files.length > 0 ? `${files.length} file(s) selected` : selectedPackageTypes.length > 1 ? 'Upload files' : `Select multiple ${selectedPackageTypes[0] || type} files`}
                              </p>
                              <p className="text-xs text-gray-400">{selectedPackageTypes.length > 1 ? 'All file types allowed' : 'Upload different formats/dimensions for different platforms'}</p>
                            </div>
                          </div>
                          {files.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Customize Names (Optional)</p>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {files.map((f, idx) => (
                                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-bold text-gray-500 truncate flex-1" title={f.name}>
                                        {f.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newFiles = files.filter((_, i) => i !== idx);
                                          setFiles(newFiles);
                                          const newTitles = { ...fileTitles };
                                          const newThumbnails = { ...packageThumbnails };
                                          delete newTitles[idx];
                                          delete newThumbnails[idx];
                                          // Reindex remaining titles and thumbnails
                                          const reindexedTitles: Record<number, string> = {};
                                          const reindexedThumbnails: Record<number, string> = {};
                                          Object.keys(newTitles).forEach(oldIdx => {
                                            const oldIndex = parseInt(oldIdx);
                                            if (oldIndex > idx) {
                                              reindexedTitles[oldIndex - 1] = newTitles[oldIndex];
                                            } else {
                                              reindexedTitles[oldIndex] = newTitles[oldIndex];
                                            }
                                          });
                                          Object.keys(newThumbnails).forEach(oldIdx => {
                                            const oldIndex = parseInt(oldIdx);
                                            if (oldIndex > idx) {
                                              reindexedThumbnails[oldIndex - 1] = newThumbnails[oldIndex];
                                            } else {
                                              reindexedThumbnails[oldIndex] = newThumbnails[oldIndex];
                                            }
                                          });
                                          setFileTitles(reindexedTitles);
                                          setPackageThumbnails(reindexedThumbnails);
                                          if (selectedPreviewIndex === idx) {
                                            setSelectedPreviewIndex(0);
                                          } else if (selectedPreviewIndex !== null && selectedPreviewIndex > idx) {
                                            setSelectedPreviewIndex(selectedPreviewIndex - 1);
                                          }
                                        }}
                                        className="ml-2 text-red-500 hover:text-red-700 text-xs font-black"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={fileTitles[idx] || f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}
                                      onChange={(e) => {
                                        setFileTitles({ ...fileTitles, [idx]: e.target.value });
                                      }}
                                      placeholder="Enter custom name..."
                                      className="w-full px-3 py-2 text-xs font-bold text-gray-900 bg-white border-2 border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    />
                                  </div>
                                ))}
                              </div>
                              
                              {/* Thumbnail Selection */}
                              {Object.keys(packageThumbnails).length > 0 && (
                                <div className="space-y-3 mt-4">
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Select Preview Image</p>
                                  <p className="text-[10px] text-gray-400">Choose which image/video thumbnail to display on the package card</p>
                                  {isGeneratingThumbnails ? (
                                    <div className="text-center py-4">
                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                      <p className="text-xs text-gray-500 mt-2">Generating thumbnails...</p>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                      {files.map((f, idx) => {
                                        const thumbnail = packageThumbnails[idx];
                                        const isSelected = selectedPreviewIndex === idx;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedPreviewIndex(idx)}
                                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                              isSelected 
                                                ? 'border-blue-600 ring-2 ring-blue-200' 
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            title={f.name}
                                          >
                                            {thumbnail ? (
                                              <img 
                                                src={thumbnail} 
                                                alt={f.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                              </div>
                                            )}
                                            {isSelected && (
                                              <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                </div>
                                              </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 truncate">
                                              {idx + 1}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
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
