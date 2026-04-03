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
      <div className="flex flex-col h-full w-16 items-center py-6 bg-[var(--hub-surface)] border-r border-[var(--hub-border)]">
        <button
          onClick={onToggleCollapse}
          className="p-2.5 rounded-xl text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)] hover:text-[var(--hub-text)] transition-all mb-6"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
        </button>
        <div className="w-8 h-8 bg-[var(--hub-primary)] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
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
    <div className="flex flex-col h-full bg-[var(--hub-surface)]">
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-[var(--hub-primary)] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h14" /></svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-[var(--hub-text)] tracking-tight truncate">Assets Hub</h1>
              <p className="text-[11px] text-[var(--hub-muted)] truncate">BYD marketing library</p>
            </div>
          </div>
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="p-2 rounded-lg text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)] hover:text-[var(--hub-text)] transition-all flex-shrink-0" title="Collapse sidebar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>

        {canOpenCommandCenter && (
          <button onClick={onOpenAdmin} className="w-full mb-5 flex items-center gap-2.5 px-3 py-2.5 bg-[var(--hub-text)] text-white rounded-[var(--hub-radius-sm)] text-[13px] font-medium hover:opacity-95 transition-all shadow-sm">
            <svg className="w-4 h-4 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4" /></svg>
            Settings &amp; admin
          </button>
        )}

        <p className="text-[11px] text-[var(--hub-muted)] mb-3 leading-snug">Narrow your library with the filters below. Everything updates instantly.</p>

        <nav className="space-y-2">
          {/* Brand */}
          <div className="rounded-[var(--hub-radius-sm)] border border-[var(--hub-border)] overflow-hidden bg-[var(--hub-elevated)]/50">
            <button
              onClick={() => toggleSection('brand')}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--hub-elevated)] text-left"
            >
              <span className="text-[12px] font-semibold text-[var(--hub-text)]">Brand</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.brand ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.brand && (
              <div className="p-2 space-y-0.5 bg-[var(--hub-surface)]">
                <button onClick={() => onSelectBrand('All')} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedBrand === 'All' ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>All brands</button>
                {(config.brands && config.brands.length ? config.brands : BRANDS).map(b => (
                  <button key={b} onClick={() => onSelectBrand(b)} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedBrand === b ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>{b}</button>
                ))}
              </div>
            )}
          </div>

          {/* Models — resets to "All" when brand changes so switching brand shows assets immediately */}
          <div className="rounded-[var(--hub-radius-sm)] border border-[var(--hub-border)] overflow-hidden bg-[var(--hub-elevated)]/50">
            <button
              onClick={() => toggleSection('models')}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--hub-elevated)] text-left"
            >
              <span className="text-[12px] font-semibold text-[var(--hub-text)]">Car model</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.models ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.models && (
              <div className="p-2 space-y-0.5 bg-[var(--hub-surface)] max-h-48 overflow-y-auto">
                <button onClick={() => onSelectModel('All')} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedModel === 'All' ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>All models</button>
                {modelsToShow.map(m => (
                  <button key={m} onClick={() => onSelectModel(m)} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedModel === m ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>{m}</button>
                ))}
              </div>
            )}
          </div>

          {/* Markets */}
          <div className="rounded-[var(--hub-radius-sm)] border border-[var(--hub-border)] overflow-hidden bg-[var(--hub-elevated)]/50">
            <button
              onClick={() => toggleSection('markets')}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--hub-elevated)] text-left"
            >
              <span className="text-[12px] font-semibold text-[var(--hub-text)]">Market / region</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSections.markets ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openSections.markets && (
              <div className="p-2 space-y-0.5 bg-[var(--hub-surface)] max-h-48 overflow-y-auto">
                <button onClick={() => onSelectMarket('All')} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedMarket === 'All' ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>All markets</button>
                {(() => {
                  const allowed = user.allowedMarkets && user.allowedMarkets.length > 0 ? user.allowedMarkets : null;
                  const showGlobal = !allowed || allowed.includes('Global');
                  const marketsToList = allowed ? config.markets.filter(m => allowed.includes(m)) : config.markets;
                  return (
                    <>
                      {showGlobal && (
                        <button onClick={() => onSelectMarket('Global')} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedMarket === 'Global' ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>Global</button>
                      )}
                      {marketsToList.map(m => (
                        <button key={m} onClick={() => onSelectMarket(m)} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${selectedMarket === m ? 'bg-[var(--hub-primary-soft)] text-[var(--hub-primary)]' : 'text-[var(--hub-muted)] hover:bg-[var(--hub-elevated)]'}`}>{m}</button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="p-4 bg-[var(--hub-elevated)] border-t border-[var(--hub-border)]">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 bg-[var(--hub-primary)] rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{user.username[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--hub-text)] truncate">{user.fullName}</p>
            <p className="text-[11px] text-[var(--hub-muted)]">{user.role}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full py-2.5 bg-[var(--hub-surface)] border border-[var(--hub-border)] text-[var(--hub-text)] rounded-[var(--hub-radius-sm)] text-[13px] font-medium hover:bg-[var(--hub-elevated)] transition-all">Log out</button>
      </div>
    </div>
  );
};

export default Sidebar;
