
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { CAR_MODELS, CarModel, MARKETS, Market, PLATFORMS, Platform, Asset, SystemConfig } from '../types';

// Fixed: Added config to props interface and made defaults optional to match App.tsx usage
// Adjusted onSave signature to omit 'status' and 'size' as they are managed by the back-end storage logic
interface AICopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Omit<Asset, 'id' | 'createdAt' | 'status' | 'size'>) => void;
  defaultMarket?: Market | 'All';
  defaultModel?: CarModel | 'All';
  config: SystemConfig;
}

const AICopyModal: React.FC<AICopyModalProps> = ({ 
    isOpen, onClose, onSave, defaultMarket, defaultModel, config 
}) => {
  // Fixed: Initialized state using config with fallback to constants
  const [model, setModel] = useState<CarModel>(
    (defaultModel && defaultModel !== 'All') ? defaultModel : (config.models[0] || CAR_MODELS[0])
  );
  const [market, setMarket] = useState<Market>(
    (defaultMarket && defaultMarket !== 'All') ? defaultMarket : (config.markets[0] || MARKETS[0])
  );
  const [platform, setPlatform] = useState<Platform>(config.platforms[0] || PLATFORMS[0]);
  const [tone, setTone] = useState('Professional & Innovative');
  const [keyPoints, setKeyPoints] = useState('');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const copy = await geminiService.generateMarketingCopy(model, market, platform, tone, keyPoints);
      setGeneratedCopy(copy);
    } catch (err) {
      setError('Failed to generate copy. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedCopy) return;
    
    // Fixed: Added missing required 'objectives' property (empty array by default for AI generated text)
    // The status and size properties are now omitted from the call as per the updated prop interface
    onSave({
        title: `${model} ${platform} Ad - ${market}`,
        type: 'text',
        content: generatedCopy,
        market: market,
        platform: platform,
        carModel: model,
        uploadedBy: 'Gemini AI',
        objectives: []
    });
    onClose();
  };

  const controlClasses = "w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-900 opacity-60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 sm:mx-0 sm:h-10 sm:w-10 shadow-lg">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">
                  AI Copy Generator
                </h3>
                <div className="mt-4 space-y-4">
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Car Model</label>
                          <select 
                            value={model} 
                            onChange={(e) => setModel(e.target.value as CarModel)}
                            className={controlClasses}
                          >
                              {(config.models.length > 0 ? config.models : CAR_MODELS).map(m => <option key={m} value={m} className="text-gray-900 bg-white">{m}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Target Market</label>
                          <select 
                             value={market}
                             onChange={(e) => setMarket(e.target.value as Market)}
                             className={controlClasses}
                          >
                              {(config.markets.length > 0 ? config.markets : MARKETS).map(m => <option key={m} value={m} className="text-gray-900 bg-white">{m}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                          <select 
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as Platform)}
                            className={controlClasses}
                          >
                              {(config.platforms.length > 0 ? config.platforms : PLATFORMS).map(p => <option key={p} value={p} className="text-gray-900 bg-white">{p}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tone of Voice</label>
                          <input 
                            type="text" 
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            className={controlClasses}
                            placeholder="e.g., Exciting, Luxury, Family-safe"
                          />
                      </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key Selling Points (Optional)</label>
                    <textarea 
                        value={keyPoints}
                        onChange={(e) => setKeyPoints(e.target.value)}
                        rows={2}
                        className={controlClasses}
                        placeholder="e.g., 5-star safety, long range, 0-100 in 3.8s"
                    ></textarea>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                  )}

                  {generatedCopy && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Generated Result</label>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                            {generatedCopy}
                        </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {generatedCopy ? (
                <button
                    type="button"
                    onClick={handleSave}
                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                    Save to Hub
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isGenerating ? 'Generating...' : 'Generate Copy'}
                </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICopyModal;
