
import React, { useState } from 'react';
import { Asset, UserRole } from '../types';

interface AssetCardProps {
  asset: Asset;
  userRole: UserRole;
  onPreview: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, userRole, onPreview, onEdit, onDelete }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isHighPerformer = (asset.ctr && asset.ctr > 2) || (asset.cr && asset.cr > 1.5);
  const isAdmin = userRole === 'Admin';
  const canEdit = userRole === 'Editor' || userRole === 'Admin';

  const isAllowedProxyHost = (u: URL) => {
    return u.hostname === 'firebasestorage.googleapis.com' || u.hostname === 'storage.googleapis.com';
  };

  const maybeProxyUrl = (url: string) => {
    try {
      const u = new URL(url);
      if (isAllowedProxyHost(u)) {
        return `/api/fetch-image?url=${encodeURIComponent(u.toString())}`;
      }
    } catch {
      // ignore (data: urls, relative urls)
    }
    return url;
  };

  const guessFilename = (url: string, fallbackBase: string) => {
    const cleaned = url.split('?')[0] || '';
    const last = cleaned.split('/').pop() || '';
    const extMatch = last.match(/\.(png|jpe?g|webp|gif)$/i);
    const ext = (extMatch?.[0] || '.jpg').toLowerCase();
    const safeBase = (fallbackBase || 'asset')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .slice(0, 80) || 'asset';
    return safeBase.endsWith(ext) ? safeBase : `${safeBase}${ext}`;
  };

  const forceDownloadUrl = async (url: string, filenameBase: string) => {
    const filename = guessFilename(url, filenameBase);
    const fetchUrl = maybeProxyUrl(url);

    // Best path: fetch bytes -> Blob -> object URL -> download (works even when `download` is ignored).
    try {
      const res = await fetch(fetchUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(blobUrl);
      return;
    } catch (err) {
      // Likely CORS blocked fetch; fall back to trying direct download attribute.
      console.warn('Direct fetch download failed, falling back:', err);
    }

    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    } catch (err) {
      console.warn('Download attribute fallback failed, opening new tab:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(asset.id);
    setIsConfirmingDelete(false);
  };

  return (
    <div 
      className={`group bg-white rounded-[32px] border-2 overflow-hidden transition-all duration-500 flex flex-col h-full relative cursor-pointer ${isHighPerformer ? 'border-blue-500 shadow-blue-100 shadow-2xl' : 'border-transparent hover:border-blue-200 shadow-xl shadow-gray-100 hover:shadow-2xl'}`}
      onClick={() => onPreview(asset)}
    >
      {isHighPerformer && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter rounded-full shadow-lg flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          Elite Asset
        </div>
      )}

      {isAdmin && !isConfirmingDelete && (
        <button 
          onClick={handleDelete}
          className="absolute top-4 right-4 z-20 p-2.5 bg-red-50 text-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white hover:scale-110 shadow-lg"
          title="Archive Asset"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      )}

      {/* Confirmation Overlay for Sandbox compatibility */}
      {isConfirmingDelete && (
        <div className="absolute inset-0 z-40 bg-red-600/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-white text-xs font-black uppercase tracking-[0.2em] mb-4">Permanent Deletion?</p>
            <div className="flex gap-3">
                <button onClick={confirmDelete} className="px-5 py-2.5 bg-white text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Confirm</button>
                <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} className="px-5 py-2.5 bg-red-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
            </div>
        </div>
      )}

      {/* Visual Preview */}
      <div className="relative h-56 bg-gray-50 flex items-center justify-center overflow-hidden">
        {asset.type === 'image' && asset.url && (
          <img src={asset.url} alt={asset.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        )}
        {asset.type === 'video' && asset.url && (
            <div className="relative w-full h-full">
               <img src={asset.url} alt={asset.title} className="w-full h-full object-cover opacity-90" />
               <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                   <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                        <svg className="w-7 h-7 text-gray-900 ml-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                   </div>
               </div>
            </div>
        )}
        {asset.type === 'design' && (
           <div className="p-10 bg-orange-50/50 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-white rounded-3xl shadow-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Master Source File</span>
           </div>
        )}
        {asset.type === 'text' && (
          <div className="p-8 w-full h-full overflow-hidden relative bg-blue-50/50">
            <p className="text-gray-800 text-sm italic font-serif leading-relaxed line-clamp-5">"{asset.content}"</p>
          </div>
        )}
        
        {/* Hover Actions */}
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canEdit && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(asset); }}
                  className="bg-white px-4 py-2.5 rounded-2xl text-gray-900 hover:bg-blue-600 hover:text-white transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Modify
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onPreview(asset); }}
                className="bg-gray-900 px-4 py-2.5 rounded-2xl text-white hover:bg-black transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
              >
                Preview
              </button>
            </div>

            {asset.type === 'image' && asset.url && (
              <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => void forceDownloadUrl(asset.url!, asset.title || 'asset')}
                  className="bg-white px-4 py-2.5 rounded-2xl text-gray-900 hover:bg-gray-100 transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap disabled:opacity-50"
                >
                  Download
                </button>
                <a
                  href="https://www.pxbee.com/ai-image-extender/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 px-4 py-2.5 rounded-2xl text-white hover:bg-blue-700 transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap"
                  title="Open PxBee AI Image Extender (Story resize/outpaint)"
                >
                  Resize
                </a>
                <a
                  href="https://ai.studio/apps/drive/1RIQCDDeZ-toZvjsRMJU4JTQDQrO4xpSt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#111111] px-4 py-2.5 rounded-2xl text-white hover:bg-black transition-all shadow-2xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap"
                  title="Open AI Studio image edit app"
                >
                  Edit Image Text
                </a>
              </div>
            )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col bg-white">
        <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-tight">{asset.market}</span>
            <span className="px-2 py-1 rounded-lg bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-tight">{asset.platform}</span>
        </div>

        <h3 className="text-lg font-black text-gray-900 line-clamp-1 mb-1 tracking-tight">{asset.title}</h3>
        <p className="text-[11px] text-blue-500/60 font-black uppercase mb-3 tracking-widest">{asset.carModel}</p>
        
        {/* Objectives */}
        {asset.objectives && asset.objectives.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {asset.objectives.map(obj => (
              <span key={obj} className="px-2 py-0.5 rounded-md bg-green-50 text-[9px] font-black text-green-700 uppercase tracking-tight border border-green-100">
                {obj}
              </span>
            ))}
          </div>
        )}

        {/* Performance Metrics Summary */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {asset.ctr !== undefined && (
            <div className={`flex-1 min-w-[60px] p-2 rounded-xl text-center border ${asset.ctr > 2 ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-transparent'}`}>
              <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">CTR</p>
              <p className={`text-xs font-black ${asset.ctr > 2 ? 'text-green-700' : 'text-gray-900'}`}>{asset.ctr}%</p>
            </div>
          )}
          {asset.cr !== undefined && (
            <div className={`flex-1 min-w-[60px] p-2 rounded-xl text-center border ${asset.cr > 1.5 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent'}`}>
              <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">CR</p>
              <p className={`text-xs font-black ${asset.cr > 1.5 ? 'text-blue-700' : 'text-gray-900'}`}>{asset.cr}%</p>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              {new Date(asset.createdAt).toLocaleDateString()}
            </div>
            <span className="truncate max-w-[80px] bg-gray-50 px-2 py-1 rounded-md">{asset.uploadedBy}</span>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
