import React, { useState } from 'react';
import { Asset } from '../types';

interface DownloadFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  packageAssets?: Asset[]; // All assets in package
  onDownload: (format: 'original' | 'webp' | 'png' | 'jpg', assetId?: string) => Promise<void>;
  onDownloadAll?: () => Promise<void>;
}

const DownloadFormatModal: React.FC<DownloadFormatModalProps> = ({
  isOpen,
  onClose,
  asset,
  packageAssets = [asset],
  onDownload,
  onDownloadAll,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'original' | 'webp' | 'png' | 'jpg'>('original');
  const [selectedAssetId, setSelectedAssetId] = useState<string | 'all'>(asset.id);
  const isPackage = packageAssets.length > 1;

  if (!isOpen) return null;

  // Detect original format from URL
  const detectOriginalFormat = (url?: string): string => {
    if (!url) return 'unknown';
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    const ext = match?.[1]?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'psd', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
    return 'unknown';
  };

  const originalFormat = detectOriginalFormat(asset.url);
  const isDesignFile = asset.type === 'design' || ['psd', 'ai', 'eps', 'svg'].includes(originalFormat);
  const isVideo = asset.type === 'video';
  const isImage = asset.type === 'image' && !isDesignFile;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (selectedAssetId === 'all' && onDownloadAll) {
        await onDownloadAll();
      } else {
        // For videos and design files, always use 'original'
        const formatToUse = (isVideo || isDesignFile) ? 'original' : selectedFormat;
        console.log('Starting download:', { formatToUse, selectedAssetId, isVideo, isDesignFile });
        await onDownload(formatToUse, selectedAssetId === 'all' ? undefined : selectedAssetId);
        console.log('Download function completed');
      }
      // Close modal after a short delay to allow download to start
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please try again or use the direct link.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatOptions: Array<{ value: 'original' | 'webp' | 'png' | 'jpg'; label: string; available: boolean }> = [
    { value: 'original', label: isVideo ? 'Original Video' : isDesignFile ? `Original (${originalFormat.toUpperCase()})` : `Original (${originalFormat.toUpperCase()})`, available: true },
    { value: 'webp', label: 'WebP', available: isImage },
    { value: 'png', label: 'PNG', available: isImage },
    { value: 'jpg', label: 'JPG', available: isImage },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">
            {isPackage ? 'Download Package' : 'Download Format'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isPackage && (
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
              Select Format/Platform
            </label>
            <button
              onClick={() => setSelectedAssetId('all')}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                selectedAssetId === 'all'
                  ? 'border-purple-600 bg-purple-50 text-purple-900'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-purple-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm uppercase tracking-wider">All Formats (ZIP)</span>
                {selectedAssetId === 'all' && (
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
            {packageAssets.map((pkgAsset) => (
              <button
                key={pkgAsset.id}
                onClick={() => setSelectedAssetId(pkgAsset.id)}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedAssetId === pkgAsset.id
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-sm uppercase tracking-wider block">{pkgAsset.platform}</span>
                    <span className="text-xs text-gray-500 font-bold mt-1">{pkgAsset.title}</span>
                  </div>
                  {selectedAssetId === pkgAsset.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!isPackage && (
          <div className="space-y-3">
            {formatOptions.filter(opt => opt.available).map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedFormat(option.value)}
                disabled={isDownloading}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedFormat === option.value
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm uppercase tracking-wider">{option.label}</span>
                  {selectedFormat === option.value && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {isDesignFile && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-xs font-bold text-orange-800">
              Design files (PSD, AI, etc.) can only be downloaded in their original format.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? 'Processing...' : 'Download'}
          </button>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadFormatModal;
