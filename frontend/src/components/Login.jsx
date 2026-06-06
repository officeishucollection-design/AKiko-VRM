import React, { useState, useEffect } from 'react';
import { KeyRound, User, UserPlus, ShieldAlert, Loader2, Video, Sparkles } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [systemEmpty, setSystemEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState('');

  // Check if system is empty (needs bootstrapping admin)
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/status`);
        if (res.ok) {
          const data = await res.json();
          if (!data.hasUsers) {
            setSystemEmpty(true);
            setIsRegisterMode(true); // Default to register mode for first run
          }
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkSystemStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (isRegisterMode && !fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }

    setLoading(true);
    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegisterMode
      ? { username: username.trim(), password, fullName: fullName.trim() }
      : { username: username.trim(), password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store in local storage
      localStorage.setItem('vrm_token', data.token);
      localStorage.setItem('vrm_user', JSON.stringify(data.user));
      
      // Notify parent component
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Server connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            Initializing Secure Link...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl relative z-10 border border-white/5">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4 animate-glow">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-extrabold text-white text-2xl tracking-tight leading-none font-sans">
            VRM Portal
          </h1>
          <span className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-2">
            Video Resource Manager
          </span>
        </div>

        {/* First Run Admin Banner */}
        {systemEmpty && (
          <div className="p-4 bg-brand-600/10 border border-brand-500/20 text-slate-200 rounded-2xl flex items-start gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-brand-300">System Initialization Mode</p>
              <p className="text-slate-400 mt-1">
                No users found. The first account created will be granted full **Administrator** privileges.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl flex items-start gap-2.5 mb-6">
            <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegisterMode && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. Ishu Collection"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600 lowercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : isRegisterMode ? (
              <>
                <UserPlus className="w-4 h-4" />
                Register & Initialize
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Mode Toggler (Only shown if system is NOT empty) */}
        {!systemEmpty && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
              }}
              className="text-xs font-semibold text-slate-400 hover:text-brand-400 transition-colors"
            >
              {isRegisterMode
                ? 'Already have an account? Sign In'
                : 'Need to create an account? Request Admin Setup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
