
import React from 'react';
import { Market, CarModel, User, SystemConfig, Brand, BRANDS, getModelsForBrand } from '../types';

interface SidebarProps {
  selectedMarket: Market | 'All';
  selectedModel: CarModel | 'All';
  selectedBrand: Brand | 'All';
  user: User;
  config: SystemConfig;
  onSelectMarket: (market: Market | 'All') => void;
  onSelectModel: (model: CarModel | 'All') => void;
  onSelectBrand: (brand: Brand | 'All') => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedMarket,
  selectedModel,
  selectedBrand,
  user,
  config,
  onSelectMarket,
  onSelectModel,
  onSelectBrand,
  onOpenAdmin,
  onLogout
}) => {
  const canOpenCommandCenter = user.role === 'Admin' || user.role === 'Editor';
  const modelsToShow = getModelsForBrand(config, selectedBrand);

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tighter uppercase">BYD Assets</h1>
        </div>

        {canOpenCommandCenter && (
          <button onClick={onOpenAdmin} className="w-full mb-10 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            Command Center
          </button>
        )}

        <div className="mb-10">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Brand</h3>
          <div className="space-y-1">
            <button onClick={() => onSelectBrand('All')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedBrand === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>All Brands</button>
            {BRANDS.map(b => (
              <button key={b} onClick={() => onSelectBrand(b)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedBrand === b ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>{b}</button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Markets</h3>
          <div className="space-y-1">
            <button onClick={() => onSelectMarket('All')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedMarket === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>All Assets</button>
            <button onClick={() => onSelectMarket('Global')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedMarket === 'Global' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>Global use assets</button>
            {config.markets.map(m => (
              <button key={m} onClick={() => onSelectMarket(m)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedMarket === m ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>{m}</button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Models</h3>
          <div className="space-y-1">
            <button onClick={() => onSelectModel('All')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedModel === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>All Models</button>
            {modelsToShow.map(m => (
              <button key={m} onClick={() => onSelectModel(m)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${selectedModel === m ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 bg-gray-50 border-t">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm">{user.username[0].toUpperCase()}</div>
          <div>
            <p className="text-xs font-black text-gray-900 truncate">{user.fullName}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase">{user.role}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full py-3 bg-white border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">Logout</button>
      </div>
    </div>
  );
};

export default Sidebar;
