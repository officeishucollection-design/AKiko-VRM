import { useState, useEffect } from 'react';
import { 
  Camera, 
  ShieldAlert, 
  Database, 
  Video, 
  DatabaseZap, 
  BarChart3, 
  RotateCcw, 
  Users, 
  LogOut, 
  Loader2, 
  Boxes, 
  Scale, 
  FileSpreadsheet,
  Lock,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import LiveStation from './components/LiveStation';
import Records from './components/Records';
import Analytics from './components/Analytics';
import ReturnStation from './components/ReturnStation';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import ListManagement from './components/ListManagement';
import LockedModule from './components/LockedModule';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function App() {
  // activeModule: 'vrm' | 'lms' | 'cms' | 'rms' | 'users'
  const [activeModule, setActiveModule] = useState('vrm');
  // activeTab for VRM stations: 'scanner' | 'returns' | 'records' | 'analytics'
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

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('vrm-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('vrm-unauthorized', handleUnauthorized);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    checkStatus();
    setActiveModule('vrm');
    
    // Default tabs based on role
    if (userData.role === 'auditor') {
      setActiveTab('records');
    } else if (userData.role === 'operator') {
      if (userData.allowedStations?.includes('order')) {
        setActiveTab('scanner');
      } else if (userData.allowedStations?.includes('return')) {
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
    <div className="min-h-screen bg-dark-900 flex flex-col md:flex-row text-slate-200 font-sans antialiased">
      
      {/* Sleek, Simplified Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-dark-800 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6">
          
          {/* Main App Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight leading-tight">
                RunRave OpsSuite
              </h1>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide block">
                Operations Platform
              </span>
            </div>
          </div>

          {/* Operations Modules List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 px-2 block">
              Modules
            </span>

            {/* VRM - Active */}
            <button
              onClick={() => setActiveModule('vrm')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                activeModule === 'vrm'
                  ? 'bg-brand-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Video className={`w-4 h-4 ${activeModule === 'vrm' ? 'text-white' : 'text-indigo-400'}`} />
                <span>VRM (Video Resource)</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${activeModule === 'vrm' ? 'bg-emerald-300' : 'bg-emerald-500'}`}></span>
            </button>

            {/* LMS (Excel-Filler) - Active */}
            <button
              onClick={() => setActiveModule('lms')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                activeModule === 'lms'
                  ? 'bg-brand-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className={`w-4 h-4 ${activeModule === 'lms' ? 'text-white' : 'text-emerald-400'}`} />
                <span>LMS (List Management)</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${activeModule === 'lms' ? 'bg-emerald-300' : 'bg-emerald-500'}`}></span>
            </button>

            {/* CMS - Locked / Coming Soon */}
            <button
              onClick={() => setActiveModule('cms')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                activeModule === 'cms'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-amber-400/80" />
                <span>CMS (Claims)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Lock className="w-3 h-3" />
                Soon
              </div>
            </button>

            {/* RMS - Locked / Coming Soon */}
            <button
              onClick={() => setActiveModule('rms')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                activeModule === 'rms'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-purple-400/80" />
                <span>RMS (Returns)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <Lock className="w-3 h-3" />
                Soon
              </div>
            </button>
          </div>

          {/* Sub-Stations (Shown when in VRM) */}
          {activeModule === 'vrm' && (
            <div className="space-y-1 pt-2 border-t border-white/5 animate-fade-in">
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 px-2 block mb-1">
                VRM Stations
              </span>

              {/* Order Scan Station */}
              {(user.role === 'admin' || (user.role === 'operator' && user.allowedStations?.includes('order'))) && (
                <button
                  onClick={() => setActiveTab('scanner')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                    activeTab === 'scanner'
                      ? 'bg-slate-700/60 text-white border border-white/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                  Order Scan Station
                </button>
              )}

              {/* Returns Station */}
              {(user.role === 'admin' || (user.role === 'operator' && user.allowedStations?.includes('return'))) && (
                <button
                  onClick={() => setActiveTab('returns')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                    activeTab === 'returns'
                      ? 'bg-slate-700/60 text-white border border-white/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-indigo-400" />
                  Return Unbox Station
                </button>
              )}

              {/* Records Directory */}
              <button
                onClick={() => setActiveTab('records')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                  activeTab === 'records'
                    ? 'bg-slate-700/60 text-white border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Database className="w-4 h-4 text-indigo-400" />
                Records Directory
              </button>

              {/* Analytics */}
              {(user.role === 'admin' || user.role === 'auditor') && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-slate-700/60 text-white border border-white/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  Analytics Dashboard
                </button>
              )}
            </div>
          )}

          {/* User Management for Admins */}
          {user.role === 'admin' && (
            <div className="pt-2 border-t border-white/5">
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 px-2 block mb-1">
                Admin
              </span>
              <button
                onClick={() => setActiveModule('users')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                  activeModule === 'users'
                    ? 'bg-slate-700/60 text-white border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Users className="w-4 h-4 text-brand-400" />
                User Management
              </button>
            </div>
          )}

        </div>

        {/* Simplified User & Server Status Footer */}
        <div className="p-4 border-t border-white/5 space-y-3 bg-dark-900/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shrink-0 text-xs uppercase">
                {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                <span className="text-[9px] uppercase font-bold text-brand-400">{user.role}</span>
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

          {/* Server Connection Dot */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
            <span className="flex items-center gap-1.5">
              <DatabaseZap className="w-3 h-3 text-slate-500" /> API Server
            </span>
            {backendStatus === 'online' && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
              </span>
            )}
            {backendStatus === 'connecting' && (
              <span className="text-yellow-400 font-bold">Connecting...</span>
            )}
            {backendStatus === 'offline' && (
              <span className="text-red-400 font-bold">Offline</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 p-5 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* Simple & Clean Top Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">RunRave OpsSuite</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-semibold text-brand-300">
              {activeModule === 'vrm' && 'VRM'}
              {activeModule === 'lms' && 'List Management (LMS)'}
              {activeModule === 'cms' && 'CMS (Claims)'}
              {activeModule === 'rms' && 'RMS (Returns)'}
              {activeModule === 'users' && 'User Management'}
            </span>
            {activeModule === 'vrm' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-slate-300 capitalize font-medium">
                  {activeTab === 'scanner' && 'Order Scan'}
                  {activeTab === 'returns' && 'Return Unbox'}
                  {activeTab === 'records' && 'Records Directory'}
                  {activeTab === 'analytics' && 'Analytics'}
                </span>
              </>
            )}
          </div>

          {/* Quick Module Switcher Pills */}
          <div className="flex items-center gap-1 bg-dark-800 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveModule('vrm')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeModule === 'vrm' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              VRM
            </button>
            <button
              onClick={() => setActiveModule('lms')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeModule === 'lms' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              LMS
            </button>
            <button
              onClick={() => setActiveModule('cms')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                activeModule === 'cms' ? 'bg-slate-700 text-amber-300' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Lock className="w-3 h-3" /> CMS
            </button>
            <button
              onClick={() => setActiveModule('rms')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                activeModule === 'rms' ? 'bg-slate-700 text-amber-300' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Lock className="w-3 h-3" /> RMS
            </button>
          </div>
        </div>

        {/* Offline Alert */}
        {backendStatus === 'offline' && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl flex items-start gap-3 mb-6">
            <ShieldAlert className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold">Local Server Offline</p>
              <p className="text-red-300">
                Backend could not be reached at <code className="bg-black/30 px-1 py-0.5 rounded text-white font-mono">{API_URL}</code>.
              </p>
            </div>
          </div>
        )}

        {/* Module Content Rendering */}
        {activeModule === 'vrm' ? (
          <>
            {activeTab === 'scanner' && (user.role === 'admin' || (user.role === 'operator' && user.allowedStations?.includes('order'))) ? (
              <LiveStation active={activeTab === 'scanner'} user={user} />
            ) : activeTab === 'returns' && (user.role === 'admin' || (user.role === 'operator' && user.allowedStations?.includes('return'))) ? (
              <ReturnStation active={activeTab === 'returns'} user={user} />
            ) : activeTab === 'records' ? (
              <Records user={user} />
            ) : activeTab === 'analytics' && (user.role === 'admin' || user.role === 'auditor') ? (
              <Analytics user={user} />
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">
                Unauthorized view. Please choose a valid station.
              </div>
            )}
          </>
        ) : activeModule === 'lms' ? (
          <ListManagement user={user} />
        ) : activeModule === 'cms' ? (
          <LockedModule 
            moduleName="Claim Management System" 
            moduleCode="CMS"
            expectedFeatures={[
              "Marketplace dispute filing (Meesho, Amazon, Flipkart)",
              "Carrier damage & loss claims (Delhivery, BlueDart)",
              "Automated 1-click VRM video evidence attachment",
              "Dispute timeline & recovered payout analytics"
            ]}
            onBackToVrm={() => setActiveModule('vrm')}
            onBackToLms={() => setActiveModule('lms')}
          />
        ) : activeModule === 'rms' ? (
          <LockedModule 
            moduleName="Return Management System" 
            moduleCode="RMS"
            expectedFeatures={[
              "Customer return (CIR) & Courier RTO intake scanner",
              "QC condition grading (Grade A Pristine, Grade B Repack, Grade C Damaged)",
              "Fraud & duplicate item detection with unboxing video reference",
              "Automated restock disposition & inventory sync"
            ]}
            onBackToVrm={() => setActiveModule('vrm')}
            onBackToLms={() => setActiveModule('lms')}
          />
        ) : activeModule === 'users' && user.role === 'admin' ? (
          <UserManagement currentUser={user} />
        ) : (
          <div className="text-center py-20 text-slate-500 text-xs">
            Unauthorized view.
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
