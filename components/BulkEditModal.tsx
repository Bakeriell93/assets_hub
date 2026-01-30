import React, { useState, useEffect } from 'react';
import { Asset, Collection, Brand, BRANDS, MARKETS, Market, PLATFORMS, Platform, CAR_MODELS, CarModel, OBJECTIVES, AssetObjective, USAGE_RIGHTS, UsageRights, SystemConfig } from '../types';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Asset>) => void;
  config: SystemConfig;
  collections: Collection[];
}

const AS_IS = '__as_is__';

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onSave, config, collections }) => {
  const [brand, setBrand] = useState<Brand | ''>('');
  const [market, setMarket] = useState<string>(AS_IS);
  const [platform, setPlatform] = useState<string>(AS_IS);
  const [carModelsAsIs, setCarModelsAsIs] = useState(true);
  const [carModel, setCarModel] = useState<CarModel>(config.models[0] || CAR_MODELS[0]);
  const [selectedCarModels, setSelectedCarModels] = useState<CarModel[]>([]);
  const [customCarModel, setCustomCarModel] = useState('');
  const [objectivesAsIs, setObjectivesAsIs] = useState(true);
  const [selectedObjectives, setSelectedObjectives] = useState<AssetObjective[]>([]);
  const [collectionsAsIs, setCollectionsAsIs] = useState(true);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [usageRights, setUsageRights] = useState<string>(AS_IS);
  const [isCarModelsDropdownOpen, setIsCarModelsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBrand('');
      setMarket(AS_IS);
      setPlatform(AS_IS);
      setCarModelsAsIs(true);
      setCarModel(config.models[0] || CAR_MODELS[0]);
      setSelectedCarModels([]);
      setCustomCarModel('');
      setObjectivesAsIs(true);
      setSelectedObjectives([]);
      setCollectionsAsIs(true);
      setSelectedCollectionIds([]);
      setUsageRights(AS_IS);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const toggleObjective = (obj: AssetObjective) => {
    setSelectedObjectives(prev =>
      prev.includes(obj) ? prev.filter(x => x !== obj) : [...prev, obj]
    );
  };

  const toggleCarModel = (m: CarModel) => {
    setSelectedCarModels(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const buildCollectionTree = (parentId: string | null | undefined): Collection[] =>
    collections.filter(c => (c.parentId ?? null) === parentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only include fields the user explicitly changed; "As is" fields are omitted so existing values are kept
    const updates: Partial<Asset> = {};
    if (brand) updates.brand = brand;
    if (market !== AS_IS) updates.market = market as Market;
    if (platform !== AS_IS) updates.platform = platform as Platform;
    if (!carModelsAsIs) {
      const processedCarModels = selectedCarModels.length > 0
        ? selectedCarModels.map(m => m === 'Other' ? (customCarModel || m) : m)
        : (carModel === 'Other' ? [customCarModel || carModel] : [carModel]);
      updates.carModel = processedCarModels[0] || carModel;
      if (processedCarModels.length > 1) updates.carModels = processedCarModels;
    }
    if (!objectivesAsIs) updates.objectives = selectedObjectives;
    if (usageRights !== AS_IS) updates.usageRights = usageRights as UsageRights;
    if (!collectionsAsIs) updates.collectionIds = selectedCollectionIds;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    onSave(updates);
    onClose();
  };

  const inputClasses = 'w-full rounded-xl border-gray-300 border-2 p-3 focus:border-blue-500 bg-white text-gray-900 outline-none transition-all font-medium shadow-sm cursor-pointer';

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-white rounded-3xl shadow-xl max-w-xl w-full p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Bulk Edit</h3>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-6">Only common fields are shown. Changes apply to all selected cards (and all assets in selected packages).</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs font-medium text-gray-600 mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3">Only the fields you change will be updated. Leave &quot;— As is —&quot; (or the checkbox checked) for any field you do not want to change.</p>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Brand</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value as Brand | '')} className={inputClasses}>
                <option value="">— As is —</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Market</label>
                <select value={market} onChange={(e) => setMarket(e.target.value)} className={inputClasses}>
                  <option value={AS_IS}>— As is —</option>
                  <option value="Global">Global</option>
                  {(config.markets.length ? config.markets : MARKETS).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClasses}>
                  <option value={AS_IS}>— As is —</option>
                  {(config.platforms.length ? config.platforms : PLATFORMS).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Car Models</label>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={carModelsAsIs} onChange={(e) => setCarModelsAsIs(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-xs font-bold text-gray-600">— As is — (keep current)</span>
              </label>
              {!carModelsAsIs && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCarModelsDropdownOpen(!isCarModelsDropdownOpen)}
                    className={`w-full rounded-xl border-gray-300 border-2 p-3 text-left flex items-center justify-between ${inputClasses}`}
                  >
                    <span>{selectedCarModels.length === 0 ? 'Select...' : `${selectedCarModels.length} selected`}</span>
                    <svg className={`w-5 h-5 transition-transform ${isCarModelsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isCarModelsDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCarModelsDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-2">
                        {(config.models.length ? config.models : CAR_MODELS).map(m => (
                          <label key={m} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input type="checkbox" checked={selectedCarModels.includes(m)} onChange={() => toggleCarModel(m)} className="w-4 h-4 rounded text-blue-600" />
                            <span className="text-sm font-bold">{m}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <input type="checkbox" checked={selectedCarModels.includes('Other' as CarModel)} onChange={() => toggleCarModel('Other' as CarModel)} className="w-4 h-4 rounded text-blue-600" />
                          <span className="text-sm font-bold">Other</span>
                        </label>
                        {selectedCarModels.includes('Other' as CarModel) && (
                          <input type="text" value={customCarModel} onChange={(e) => setCustomCarModel(e.target.value)} placeholder="Custom model" className="w-full mt-2 p-2 border rounded-lg text-sm" />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Campaign Objectives</label>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={objectivesAsIs} onChange={(e) => setObjectivesAsIs(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-xs font-bold text-gray-600">— As is — (keep current)</span>
              </label>
              {!objectivesAsIs && (
                <div className="flex flex-wrap gap-2">
                  {OBJECTIVES.map(obj => (
                    <button key={obj} type="button" onClick={() => toggleObjective(obj)} className={`px-4 py-2 rounded-full text-xs font-black uppercase transition-all ${selectedObjectives.includes(obj) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{obj}</button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Usage Rights</label>
              <select value={usageRights} onChange={(e) => setUsageRights(e.target.value)} className={inputClasses}>
                <option value={AS_IS}>— As is —</option>
                {USAGE_RIGHTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-tighter mb-1.5 ml-1">Project folder</label>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={collectionsAsIs} onChange={(e) => setCollectionsAsIs(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-xs font-bold text-gray-600">— As is — (keep current)</span>
              </label>
              {!collectionsAsIs && (
                collections.length === 0 ? (
                  <p className="text-xs text-gray-400">No projects yet.</p>
                ) : (
                  <div className="mt-1 space-y-0 max-h-40 overflow-y-auto border-2 border-gray-100 rounded-xl p-3 bg-gray-50">
                    {(() => {
                      const renderNode = (c: Collection, depth: number) => (
                        <React.Fragment key={c.id}>
                          <div style={{ marginLeft: depth * 16 }} className="flex items-center gap-2 py-1">
                            <input type="checkbox" id={`bulk-col-${c.id}`} checked={selectedCollectionIds.includes(c.id)} onChange={() => toggleCollection(c.id)} className="w-4 h-4 rounded text-purple-600" />
                            <label htmlFor={`bulk-col-${c.id}`} className="text-xs font-bold cursor-pointer truncate flex-1">{c.name}</label>
                          </div>
                          {buildCollectionTree(c.id).map(child => renderNode(child, depth + 1))}
                        </React.Fragment>
                      );
                      return buildCollectionTree(null).map(c => renderNode(c, 0));
                    })()}
                  </div>
                )
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Apply to selected</button>
              <button type="button" onClick={onClose} className="px-8 py-4 bg-gray-100 text-gray-600 rounded-xl text-[11px] font-black uppercase">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;
