import React, { useState, useRef } from 'react';
import { Asset, CAR_MODELS, CarModel, MARKETS, Market, PLATFORMS, Platform, AssetType, USAGE_RIGHTS, UsageRights, OBJECTIVES, AssetObjective, SystemConfig } from '../types';
import { storageService } from '../services/storageService';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemConfig;
}

interface BulkUploadItem {
  id: string;
  file: File;
  preview?: string;
  title: string;
  type: AssetType;
  market: Market;
  platform: Platform;
  carModel: CarModel;
  objectives: AssetObjective[];
  usageRights: UsageRights;
  uploaderName: string;
  ctr?: string;
  cpl?: string;
  cr?: string;
  comments?: string;
  content?: string;
  isPublished: boolean;
}

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, config }) => {
  const [items, setItems] = useState<BulkUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: BulkUploadItem[] = files.map((file, idx) => {
      // Detect type from file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: AssetType = 'image';
      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) type = 'video';
      else if (['psd', 'ai', 'eps', 'pdf', 'svg'].includes(ext)) type = 'design';
      else if (['txt', 'md'].includes(ext)) type = 'text';

      // Generate preview for images
      let preview: string | undefined;
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }

      return {
        id: `bulk_${Date.now()}_${idx}`,
        file,
        preview,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        type,
        market: config.markets[0] || MARKETS[0],
        platform: config.platforms[0] || PLATFORMS[0],
        carModel: config.models[0] || CAR_MODELS[0],
        objectives: [],
        usageRights: USAGE_RIGHTS[0],
        uploaderName: '',
        isPublished: false
      };
    });

    setItems(prev => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateItem = (id: string, updates: Partial<BulkUploadItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const toggleObjective = (itemId: string, obj: AssetObjective) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newObjectives = item.objectives.includes(obj)
          ? item.objectives.filter(o => o !== obj)
          : [...item.objectives, obj];
        return { ...item, objectives: newObjectives };
      }
      return item;
    }));
  };

  const handlePublishAll = async () => {
    const unpublished = items.filter(item => !item.isPublished);
    if (unpublished.length === 0) {
      alert('All items have been published.');
      return;
    }

    // Validate all items
    for (const item of unpublished) {
      if (!item.title.trim()) {
        alert(`Please provide a title for "${item.file.name}"`);
        return;
      }
      if (item.objectives.length === 0) {
        alert(`Please select at least one objective for "${item.file.name}"`);
        return;
      }
      if (!item.uploaderName.trim()) {
        alert(`Please provide uploader name for "${item.file.name}"`);
        return;
      }
    }

    setIsUploading(true);
    try {
      for (const item of unpublished) {
        const assetData = {
          title: item.title,
          type: item.type,
          market: item.market,
          platform: item.platform,
          carModel: item.carModel,
          objectives: item.objectives,
          usageRights: item.usageRights,
          uploadedBy: item.uploaderName,
          ctr: item.ctr ? parseFloat(item.ctr) : undefined,
          cpl: item.cpl ? parseFloat(item.cpl) : undefined,
          cr: item.cr ? parseFloat(item.cr) : undefined,
          comments: item.comments || undefined,
          content: item.content || undefined,
          ...(item.type === 'text' && item.content ? { content: item.content } : {})
        };

        await storageService.addAsset(assetData, item.type === 'text' ? undefined : item.file);
        updateItem(item.id, { isPublished: true });
      }
      alert(`Successfully published ${unpublished.length} asset(s)!`);
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      alert(`Failed to publish some assets: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublishOne = async (item: BulkUploadItem) => {
    if (!item.title.trim()) {
      alert('Please provide a title');
      return;
    }
    if (item.objectives.length === 0) {
      alert('Please select at least one objective');
      return;
    }
    if (!item.uploaderName.trim()) {
      alert('Please provide uploader name');
      return;
    }

    setIsUploading(true);
    try {
      const assetData = {
        title: item.title,
        type: item.type,
        market: item.market,
        platform: item.platform,
        carModel: item.carModel,
        objectives: item.objectives,
        usageRights: item.usageRights,
        uploadedBy: item.uploaderName,
        ctr: item.ctr ? parseFloat(item.ctr) : undefined,
        cpl: item.cpl ? parseFloat(item.cpl) : undefined,
        cr: item.cr ? parseFloat(item.cr) : undefined,
        comments: item.comments || undefined,
        content: item.content || undefined,
        ...(item.type === 'text' && item.content ? { content: item.content } : {})
      };

      await storageService.addAsset(assetData, item.type === 'text' ? undefined : item.file);
      updateItem(item.id, { isPublished: true });
    } catch (error: any) {
      console.error('Publish error:', error);
      alert(`Failed to publish: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Clean up preview URLs
    items.forEach(item => {
      if (item.preview) {
        URL.revokeObjectURL(item.preview);
      }
    });
    setItems([]);
    onClose();
  };

  const inputClasses = "w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 text-sm";

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-75 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl w-full h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black tracking-tight">Bulk Upload</h3>
              <p className="text-sm font-bold opacity-90 mt-1">{items.length} file(s) selected</p>
            </div>
            <div className="flex items-center gap-4">
              {items.length > 0 && (
                <button
                  onClick={handlePublishAll}
                  disabled={isUploading || items.every(i => i.isPublished)}
                  className="px-6 py-3 bg-white text-blue-600 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isUploading ? 'Publishing...' : `Publish All (${items.filter(i => !i.isPublished).length})`}
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Upload Area */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors bg-white">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="bulk-upload-input"
                accept="image/*,video/*,.psd,.ai,.eps,.pdf,.svg,.txt,.md"
              />
              <label
                htmlFor="bulk-upload-input"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">Click to select files</p>
                  <p className="text-sm text-gray-500 mt-1">Images, Videos, Design Files, or Text Files</p>
                </div>
              </label>
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 font-bold text-lg">No files selected yet</p>
                <p className="text-gray-300 text-sm mt-2">Upload files to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                      item.isPublished
                        ? 'border-green-500 bg-green-50/30'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Preview Section */}
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {item.type === 'image' && item.preview && (
                        <img src={item.preview} alt={item.title} className="w-full h-full object-cover" />
                      )}
                      {item.type === 'video' && (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                      {item.type === 'design' && (
                        <div className="w-full h-full flex items-center justify-center bg-orange-50">
                          <svg className="w-16 h-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {item.type === 'text' && (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50">
                          <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      {item.isPublished && (
                        <div className="absolute top-2 right-2 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-black uppercase tracking-wider">
                          Published
                        </div>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="absolute top-2 left-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Form Section */}
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateItem(item.id, { title: e.target.value })}
                          className={inputClasses}
                          disabled={item.isPublished}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                            Market
                          </label>
                          <select
                            value={item.market}
                            onChange={(e) => updateItem(item.id, { market: e.target.value as Market })}
                            className={inputClasses}
                            disabled={item.isPublished}
                          >
                            {(config.markets.length > 0 ? config.markets : MARKETS).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                            Platform
                          </label>
                          <select
                            value={item.platform}
                            onChange={(e) => updateItem(item.id, { platform: e.target.value as Platform })}
                            className={inputClasses}
                            disabled={item.isPublished}
                          >
                            {(config.platforms.length > 0 ? config.platforms : PLATFORMS).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          Car Model
                        </label>
                        <select
                          value={item.carModel}
                          onChange={(e) => updateItem(item.id, { carModel: e.target.value as CarModel })}
                          className={inputClasses}
                          disabled={item.isPublished}
                        >
                          {(config.models.length > 0 ? config.models : CAR_MODELS).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          Objectives * (Select at least one)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {OBJECTIVES.map(obj => (
                            <button
                              key={obj}
                              type="button"
                              onClick={() => toggleObjective(item.id, obj)}
                              disabled={item.isPublished}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                item.objectives.includes(obj)
                                  ? 'bg-blue-600 text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              } ${item.isPublished ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {obj}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          Uploader Name *
                        </label>
                        <input
                          type="text"
                          value={item.uploaderName}
                          onChange={(e) => updateItem(item.id, { uploaderName: e.target.value })}
                          className={inputClasses}
                          disabled={item.isPublished}
                          placeholder="Enter your name"
                        />
                      </div>

                      {item.type === 'text' && (
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                            Content
                          </label>
                          <textarea
                            value={item.content || ''}
                            onChange={(e) => updateItem(item.id, { content: e.target.value })}
                            className={inputClasses}
                            rows={3}
                            disabled={item.isPublished}
                            placeholder="Paste text content here..."
                          />
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handlePublishOne(item)}
                          disabled={item.isPublished || isUploading}
                          className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                            item.isPublished
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {item.isPublished ? 'Published ✓' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
