import React, { useState } from 'react';
import { Market, CarModel, User, SystemConfig, Brand, BRANDS, getModelsForBrand } from '../types';

interface SidebarProps {
  selectedMarket: Market | 'All';
  selectedModel: CarModel | 'All';
  selectedBrand: Brand | 'All';
  user: User;
  config: SystemConfig;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
  onSelectMarket,
  onSelectModel,
  onSelectBrand,
  onOpenAdmin,
  onLogout
}) => {
  const canOpenCommandCenter = user.role === 'Admin' || user.role === 'Editor';
  const modelsToShow = getModelsForBrand(config, selectedBrand);

  const [openSections, setOpenSections] = useState({ brand: true, markets: true, models: true });
  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full w-16 items-center py-6 bg-white border-r border-gray-100">
        <button
          onClick={onToggleCollapse}
          className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all mb-6"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h14" /></svg>
        </div>
        {canOpenCommandCenter && (
          <button onClick={onOpenAdmin} className="mt-6 p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all" title="Command Center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4" /></svg>
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onLogout} className="p-2.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all" title="Logout">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
        <div className="mt-4 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{user.username[0].toUpperCase()}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h14" /></svg>
            </div>
            <h1 className="text-base font-black text-gray-900 tracking-tight uppercase truncate">BYD Assets</h1>
          </div>
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all flex-shrink-0" title="Collapse sidebar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>

        {canOpenCommandCenter && (
          <button onClick={onOpenAdmin} className="w-full mb-6 flex items-center gap-2.5 px-3 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4" /></svg>
            Command Center
          </button>
        )}

        <nav className="space-y-1">
          {/* Brand */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleSection('brand')}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50/80 hover:bg-gray-50 text-left"
            >
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Brand</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.brand ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.brand && (
              <div className="p-2 space-y-0.5 bg-white">
                <button onClick={() => onSelectBrand('All')} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedBrand === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>All Brands</button>
                {BRANDS.map(b => (
                  <button key={b} onClick={() => onSelectBrand(b)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedBrand === b ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>{b}</button>
                ))}
              </div>
            )}
          </div>

          {/* Markets */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleSection('markets')}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50/80 hover:bg-gray-50 text-left"
            >
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Markets</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.markets ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.markets && (
              <div className="p-2 space-y-0.5 bg-white max-h-48 overflow-y-auto">
                <button onClick={() => onSelectMarket('All')} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedMarket === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>All Assets</button>
                <button onClick={() => onSelectMarket('Global')} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedMarket === 'Global' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Global</button>
                {config.markets.map(m => (
                  <button key={m} onClick={() => onSelectMarket(m)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedMarket === m ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>{m}</button>
                ))}
              </div>
            )}
          </div>

          {/* Models — resets to "All" when brand changes so switching brand shows assets immediately */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleSection('models')}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50/80 hover:bg-gray-50 text-left"
            >
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Models</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.models ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.models && (
              <div className="p-2 space-y-0.5 bg-white max-h-48 overflow-y-auto">
                <button onClick={() => onSelectModel('All')} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedModel === 'All' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>All Models</button>
                {modelsToShow.map(m => (
                  <button key={m} onClick={() => onSelectModel(m)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${selectedModel === m ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>{m}</button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="p-4 bg-gray-50/80 border-t border-gray-100">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{user.username[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">{user.fullName}</p>
            <p className="text-[9px] font-semibold text-gray-400 uppercase">{user.role}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-all">Logout</button>
      </div>
    </div>
  );
};

export default Sidebar;
