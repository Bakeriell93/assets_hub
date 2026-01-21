import React, { useState, useEffect, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { Asset, SystemConfig, Collection } from '../types';

interface AIInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  collections: Collection[];
  config: SystemConfig;
  currentView?: 'repository' | 'analytics' | 'collections';
  selectedMarket?: string;
  selectedModel?: string;
  selectedPlatform?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const AIInsightsModal: React.FC<AIInsightsModalProps> = ({
  isOpen,
  onClose,
  assets,
  collections,
  config,
  currentView = 'repository',
  selectedMarket,
  selectedModel,
  selectedPlatform,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoInsights, setAutoInsights] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAutoInsights('');
      setMessages([]);
      generateAutoInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentView, selectedMarket, selectedModel, selectedPlatform]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateAutoInsights = async () => {
    try {
      const insights = await geminiService.generateInsights(assets, collections, config, {
        currentView,
        selectedMarket,
        selectedModel,
        selectedPlatform,
      });
      setAutoInsights(insights);
      
      // Add auto insights as first message
      setMessages([{
        role: 'assistant',
        content: insights,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      console.error('Failed to generate insights:', err);
      setAutoInsights('Unable to generate insights at this time.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await geminiService.answerQuestion(
        input.trim(),
        assets,
        collections,
        config,
        {
          currentView,
          selectedMarket,
          selectedModel,
          selectedPlatform,
        }
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">AI Insights</h2>
                  <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">
                    {currentView === 'repository' ? 'Repository Analysis' : 
                     currentView === 'analytics' ? 'Analytics Intelligence' : 
                     'Collections Overview'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
            {messages.length === 0 && autoInsights && (
              <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-gray-900">Auto-Generated Insights</h3>
                </div>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{autoInsights}</div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-3xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 shadow-lg border border-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-3xl px-6 py-4 shadow-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-6 py-4 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your assets, performance, trends, or recommendations..."
                className="flex-1 px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none text-gray-900 font-medium transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setInput('What are the top performing assets?')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-700 transition-all"
              >
                Top performers
              </button>
              <button
                onClick={() => setInput('Which markets need more content?')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-700 transition-all"
              >
                Content gaps
              </button>
              <button
                onClick={() => setInput('Give me recommendations for improvement')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-700 transition-all"
              >
                Recommendations
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsightsModal;
