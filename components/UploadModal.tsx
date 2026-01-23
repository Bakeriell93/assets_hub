
import React, { useState } from 'react';
import { Asset, CAR_MODELS, CarModel, MARKETS, Market, PLATFORMS, Platform, AssetType, SystemConfig } from '../types';

// Fixed: Added config to props interface and used it for select options
// Adjusted onSave signature to omit 'status' and 'size' as they are handled by storageService.addAsset
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<Asset, 'id' | 'createdAt' | 'status' | 'size'>, file?: File) => void;
  config: SystemConfig;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSave, config }) => {
  const [title, setTitle] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [type, setType] = useState<AssetType>('image');
  // Fixed: Initialized state using config with fallback to constants
  const [market, setMarket] = useState<Market>(config.markets[0] || MARKETS[0]);
  const [platform, setPlatform] = useState<Platform>(config.platforms[0] || PLATFORMS[0]);
  const [carModel, setCarModel] = useState<CarModel>(config.models[0] || CAR_MODELS[0]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Fixed: Renamed metrics field 'cpa' to 'cpl' to match the Asset interface definition in types.ts
  const [ctr, setCtr] = useState<string>('');
  const [cpl, setCpl] = useState<string>('');
  const [cr, setCr] = useState<string>('');
  const [comments, setComments] = useState('');
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && type === 'video') {
      const fileName = file.name.toLowerCase();
      if (file.type === 'video/quicktime' || fileName.endsWith('.mov') || fileName.endsWith('.qt')) {
        alert('QuickTime MOV files (like ProRes) may not play in browsers. Please convert to MP4 (H.264) before uploading for reliable playback.');
        return;
      }
    }
    
    // Fixed: The 'status' property is now omitted from this call as it's added by storageService.addAsset
    onSave({
      title,
      type,
      market,
      platform,
      carModel,
      objectives: [], // Empty array provided as default for simple upload
      content: type === 'text' ? content : undefined,
      uploadedBy: uploaderName || 'Anonymous',
      ctr: ctr ? parseFloat(ctr) : undefined,
      cpl: cpl ? parseFloat(cpl) : undefined,
      cr: cr ? parseFloat(cr) : undefined,
      comments: comments || undefined
    }, file || undefined);
    
    // Reset form
    setTitle('');
    setUploaderName('');
    setContent('');
    setFile(null);
    setCtr('');
    setCpl('');
    setCr('');
    setComments('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-900 opacity-60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900">Upload Asset</h3>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Title</label>
                    <input
                      required
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g. Summer Campaign Header"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uploader Name</label>
                    <input
                      required
                      type="text"
                      value={uploaderName}
                      onChange={(e) => setUploaderName(e.target.value)}
                      className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as AssetType)}
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                            <option value="text">Text / Copy</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                        <select
                            value={market}
                            onChange={(e) => setMarket(e.target.value as Market)}
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            {(config.markets.length > 0 ? config.markets : MARKETS).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                        <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as Platform)}
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            {(config.platforms.length > 0 ? config.platforms : PLATFORMS).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Car Model</label>
                        <select
                            value={carModel}
                            onChange={(e) => setCarModel(e.target.value as CarModel)}
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                            {(config.models.length > 0 ? config.models : CAR_MODELS).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-3">Performance Metrics (Optional)</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">CTR (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={ctr}
                                onChange={(e) => setCtr(e.target.value)}
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">CR (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={cr}
                                onChange={(e) => setCr(e.target.value)}
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">CPL (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={cpl}
                                onChange={(e) => setCpl(e.target.value)}
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comments & Info</label>
                    <textarea
                        rows={2}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Additional context about this asset..."
                    ></textarea>
                </div>

                {type === 'text' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ad Copy Content</label>
                        <textarea
                            required
                            rows={4}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="Paste your ad copy here..."
                        ></textarea>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all relative ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                            <input
                                type="file"
                                required={true}
                                accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*'}
                                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="pointer-events-none">
                                <svg className={`mx-auto h-10 w-10 mb-2 ${file ? 'text-blue-500' : 'text-gray-400'}`} stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <p className="text-sm font-semibold text-gray-700">
                                    {file ? file.name : `Drop or click to upload ${type}`}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">High quality files recommended</p>
                            </div>
                        </div>
                    </div>
                )}

              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-2xl">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-md px-6 py-2.5 bg-blue-600 text-base font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Save Asset
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
