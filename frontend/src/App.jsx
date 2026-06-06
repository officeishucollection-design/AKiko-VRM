import React, { useState, useEffect } from 'react';
import { Camera, ShieldAlert, Database, Video, DatabaseZap, HardDrive, RefreshCw, BarChart3, RotateCcw, Users, LogOut, Loader2 } from 'lucide-react';
import LiveStation from './components/LiveStation';
import Records from './components/Records';
import Analytics from './components/Analytics';
import ReturnStation from './components/ReturnStation';
import Login from './components/Login';
import UserManagement from './components/UserManagement';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check backend server status
  const checkStatus = async () => {
    try {
      setBackendStatus('connecting');
      const response = await fetch(`${API_URL}/api/records?limit=1`);
      if (response.ok || response.status === 401) {
        // 401 Unauthorized means backend is online and running (since endpoint is protected)
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch (e) {
      setBackendStatus('offline');
    }
  };

  // Verify token on startup
  useEffect(() => {
    const verifyUser = async () => {
      const savedToken = localStorage.getItem('vrm_token');
      const savedUser = localStorage.getItem('vrm_user');
      
      if (savedToken && savedUser) {
        try {
          const res = await fetch(`${API_URL}/api/auth/me`);
          if (res.ok) {
            const data = await res.json();
            setUser(data);
          } else {
            localStorage.removeItem('vrm_token');
            localStorage.removeItem('vrm_user');
            setUser(null);
          }
        } catch (err) {
          console.error('User verification failed:', err);
          // If we fail to connect to server, fallback to offline state but keep user
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    verifyUser();
    checkStatus();
  }, []);

  // Listen for unauthorized events (global token expiry)
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('vrm-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('vrm-unauthorized', handleUnauthorized);
  }, []);

  const handleLoginSuccess = (userData, tokenData) => {
    setUser(userData);
    checkStatus();
    // Default tabs based on role
    if (userData.role === 'auditor') {
      setActiveTab('records');
    } else if (userData.role === 'operator') {
      if (userData.allowedStations.includes('order')) {
        setActiveTab('scanner');
      } else if (userData.allowedStations.includes('return')) {
        setActiveTab('returns');
      } else {
        setActiveTab('records');
      }
    } else {
      setActiveTab('scanner');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vrm_token');
    localStorage.removeItem('vrm_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            Authorizing Session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col md:flex-row text-slate-200">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-dark-800 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between shrink-0 animate-fade-in">
        <div className="p-6 space-y-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-sm tracking-tight leading-none font-sans">VRM Portal</h1>
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase font-sans">Video Resource Mgr</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {/* Order Scan - Admin or Operator with order access */}
            {(user.role === 'admin' || (user.role === 'operator' && user.allowedStations.includes('order'))) && (
              <button
                onClick={() => setActiveTab('scanner')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                  activeTab === 'scanner'
                    ? 'bg-brand-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Camera className="w-4 h-4" />
                Order Scan Station
              </button>
            )}

            {/* Returns Station - Admin or Operator with return access */}
            {(user.role === 'admin' || (user.role === 'operator' && user.allowedStations.includes('return'))) && (
              <button
                onClick={() => setActiveTab('returns')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                  activeTab === 'returns'
                    ? 'bg-brand-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                Returns Station
              </button>
            )}

            {/* Records - All roles */}
            <button
              onClick={() => setActiveTab('records')}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'records'
                  ? 'bg-brand-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Database className="w-4 h-4" />
              Records Directory
            </button>

            {/* Analytics - Admin or Auditor */}
            {(user.role === 'admin' || user.role === 'auditor') && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-brand-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics Dashboard
              </button>
            )}

            {/* User Management - Admin only */}
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                  activeTab === 'users'
                    ? 'bg-brand-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Users className="w-4 h-4" />
                User Management
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer User & System Indicators */}
        <div className="p-6 border-t border-white/5 space-y-5 bg-dark-900/30">
          
          {/* User Profile Card */}
          <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center font-bold text-white shrink-0 text-xs uppercase">
                {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate leading-tight">{user.fullName}</p>
                <span className="text-[9px] font-bold tracking-wider uppercase text-brand-400">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            <span className="text-[9px] font-bold tracking-widest uppercase text-slate-500 block">System Connection</span>
            
            {/* Express Server Indicator */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <DatabaseZap className="w-3.5 h-3.5 text-slate-500" /> Backend API
              </span>
              {backendStatus === 'online' && (
                <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                </span>
              )}
              {backendStatus === 'connecting' && (
                <span className="flex items-center gap-1 text-yellow-400 font-bold text-[11px] animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span> Connecting
                </span>
              )}
              {backendStatus === 'offline' && (
                <span className="flex items-center gap-1 text-red-400 font-bold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Offline
                </span>
              )}
            </div>

            {/* S3 Storage Indicator */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" /> AWS S3 Target
              </span>
              <span className="text-slate-500 text-[11px] font-bold">Configured</span>
            </div>
          </div>

          {backendStatus === 'offline' && (
            <button
              onClick={checkStatus}
              className="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/40 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-colors flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reconnect API
            </button>
          )}
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-6xl mx-auto w-full">
        {/* Offline Alert Banner */}
        {backendStatus === 'offline' && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl flex items-start gap-3 mb-6 animate-pulse-slow">
            <ShieldAlert className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs md:text-sm">
              <p className="font-semibold">Local Server Offline</p>
              <p className="text-red-300">
                The Express backend could not be reached at <code className="bg-black/30 px-1.5 py-0.5 rounded text-white font-mono">{API_URL}</code>. Ensure the server is running (`npm run dev` in backend directory).
              </p>
            </div>
          </div>
        )}

        {/* View Switches */}
        {activeTab === 'scanner' && (user.role === 'admin' || (user.role === 'operator' && user.allowedStations.includes('order'))) ? (
          <LiveStation active={activeTab === 'scanner'} user={user} />
        ) : activeTab === 'returns' && (user.role === 'admin' || (user.role === 'operator' && user.allowedStations.includes('return'))) ? (
          <ReturnStation active={activeTab === 'returns'} user={user} />
        ) : activeTab === 'records' ? (
          <Records user={user} />
        ) : activeTab === 'analytics' && (user.role === 'admin' || user.role === 'auditor') ? (
          <Analytics user={user} />
        ) : activeTab === 'users' && user.role === 'admin' ? (
          <UserManagement currentUser={user} />
        ) : (
          <div className="text-center py-20 text-slate-500 text-xs">
            Unauthorized view. Please choose a valid menu option.
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
