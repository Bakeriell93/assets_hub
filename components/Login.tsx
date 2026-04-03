
import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { authService, AuthError } from '../services/authService';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
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
      const verifiedUser = await authService.verify(username, password);

      await storageService.logLogin(verifiedUser.username);
      await storageService.logSecurityEvent(
        `Login Success: ${verifiedUser.username}`,
        verifiedUser.role === 'Admin' ? 'low' : 'medium'
      );

      onLogin(verifiedUser);
    } catch (err: any) {
      const msg =
        err instanceof AuthError
          ? err.message
          : 'Login failed due to a system error. Please try again.';
      setError(msg);
      await storageService.logSecurityEvent(`Login Failed: ${username || 'unknown'}`, 'high');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(165deg, #e8ecf4 0%, #f4f6fa 45%, #eef1f6 100%)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--hub-primary)] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--hub-text)] tracking-tight mb-2">Sign in</h1>
          <p className="text-sm text-[var(--hub-muted)]">BYD Assets Hub — marketing asset library</p>
        </div>

        <div className="bg-[var(--hub-surface)] rounded-2xl p-8 sm:p-10 shadow-xl border border-[var(--hub-border)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--hub-text)] mb-2">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[var(--hub-elevated)] border border-[var(--hub-border)] rounded-xl focus:bg-white focus:border-[var(--hub-primary)] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-[var(--hub-text)]"
                  placeholder="Your username"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--hub-text)] mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[var(--hub-elevated)] border border-[var(--hub-border)] rounded-xl focus:bg-white focus:border-[var(--hub-primary)] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-[var(--hub-text)]"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-sm text-center border border-red-100">
                {error}
              </div>
            )}

            <div>
              <button 
                type="submit" 
                disabled={isVerifying}
                className="w-full py-3.5 bg-[var(--hub-primary)] text-white rounded-xl font-semibold hover:bg-[var(--hub-primary-hover)] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                {isVerifying ? 'Signing in…' : 'Continue'}
              </button>
            </div>

            <p className="text-center text-xs text-[var(--hub-muted)] leading-relaxed">
              Access is logged for security. Use your assigned credentials only.
            </p>
          </form>
        </div>

        <p className="text-center mt-8 text-[11px] text-[var(--hub-muted)]">
          BYD global marketing · internal use
        </p>
      </div>
    </div>
  );
};

export default Login;
