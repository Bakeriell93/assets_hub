
import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';

interface LoginProps {
  onLogin: (username: string, password: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');

    try {
      // Check for hardcoded admin first
      const verified = authService.verify(username, password);
      
      // Real-time security reporting
      await storageService.logSecurityEvent(`Login Attempt Identified: ${username || 'Anonymous'}`, verified.role === 'Admin' ? 'low' : 'medium');
      
      // If it's not the hardcoded admin and username was provided, check the cloud registry
      if (username && verified.username !== 'fakhri') {
        const cloudUser = await storageService.verifyCloudUser(username);
        if (cloudUser) {
           // We could override here if we want to trust Firestore over the authService's default Viewer
        }
      }
      
      onLogin(username || 'guest', password || 'test');
    } catch (err) {
      setError('Verification failed. Check connectivity.');
      await storageService.logSecurityEvent(`Failed Access Attempt: Critical Error`, 'high');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(37,99,235,0.3)]">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-3 uppercase">BYD Assets Hub</h1>
          <p className="text-blue-500/60 font-black uppercase text-[11px] tracking-[0.4em]">Enterprise Cloud Gateway</p>
        </div>

        <div className="bg-white rounded-[48px] p-12 shadow-[0_25px_80px_rgba(0,0,0,0.4)]">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Access Identity</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-7 py-5 bg-gray-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-600 outline-none transition-all font-black text-gray-900 shadow-sm"
                  placeholder="Enter User ID"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Secure Key</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-7 py-5 bg-gray-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-600 outline-none transition-all font-black text-gray-900 shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-red-100">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isVerifying}
                className="w-full py-6 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-[0_15px_35px_rgba(37,99,235,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
              >
                <div className="flex items-center gap-3">
                  {isVerifying && <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {isVerifying ? 'Verifying Node...' : 'Log in'}
                </div>
              </button>
              <p className="text-center mt-4 text-red-600 font-black uppercase text-[10px] tracking-widest animate-pulse">
                Just click, it's just a test for now
              </p>
            </div>

            <div className="text-center">
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                 Unauthorized access is monitored and reported.
               </p>
            </div>
          </form>
        </div>

        <p className="text-center mt-10 text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
          BYD GLOBAL MARKETING • ASIA / EUROPE / AMERICAS
        </p>
      </div>
    </div>
  );
};

export default Login;
