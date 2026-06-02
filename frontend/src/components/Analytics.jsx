import React, { useState, useEffect } from 'react';
import { Barcode, Clock, HardDrive, BarChart3, ShieldCheck, Play, ArrowUpRight, ArrowDownRight, Calendar, Video, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Analytics() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/records`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      console.error('Failed to load analytics data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Compute stats
  const totalScans = records.length;
  
  const totalDuration = records.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  const avgDuration = totalScans > 0 ? (totalDuration / totalScans).toFixed(1) : 0;
  
  // Calculate mock file sizes (roughly 300KB per second of WebM video on average)
  const estimatedStorageMB = ((totalDuration * 300) / 1024).toFixed(1);

  // Group scans by day of the week (last 7 days)
  const getWeeklyActivity = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const activity = [];
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      activity.push({
        dayName: days[d.getDay()],
        dateStr: d.toDateString(),
        count: 0
      });
    }

    // Populate counts
    records.forEach(r => {
      const rDate = new Date(r.recordedAt).toDateString();
      const match = activity.find(a => a.dateStr === rDate);
      if (match) {
        match.count += 1;
      }
    });

    return activity;
  };

  const weeklyData = getWeeklyActivity();
  const maxCount = Math.max(...weeklyData.map(d => d.count), 4); // minimum ceiling of 4 for visual scale

  // Compute SVG Polyline points for line chart
  const getSvgPoints = () => {
    const width = 500;
    const height = 150;
    const padding = 30;
    
    const xStep = (width - padding * 2) / 6;
    const yMax = maxCount;
    
    return weeklyData.map((d, index) => {
      const x = padding + index * xStep;
      // Invert Y because SVG (0,0) is top-left
      const y = height - padding - (d.count / yMax) * (height - padding * 2);
      return { x, y, ...d };
    });
  };

  const points = getSvgPoints();
  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  // Area path (closes the shape at the bottom for gradient fill)
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`
    : '';

  const formatTime = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Compiling warehouse analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">
          Analytics Dashboard
        </h2>
        <p className="text-slate-400 text-sm">
          Real-time metrics, scanning frequency, and storage statistics for shipment video logging.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <Barcode className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              12%
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Scanned</span>
            <h3 className="text-3xl font-black text-white font-mono">{totalScans}</h3>
            <span className="text-[10px] text-slate-400 block">Logged air waybills</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              8%
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Avg Duration</span>
            <h3 className="text-3xl font-black text-white font-mono">{avgDuration}s</h3>
            <span className="text-[10px] text-slate-400 block">Seconds per package stream</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-red-400 bg-red-400/5 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" />
              2%
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Est. Storage</span>
            <h3 className="text-3xl font-black text-white font-mono">{estimatedStorageMB}MB</h3>
            <span className="text-[10px] text-slate-400 block">Disk/S3 space consumed</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mt-1.5 mr-1"></span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">System Health</span>
            <h3 className="text-3xl font-black text-emerald-400">100%</h3>
            <span className="text-[10px] text-slate-400 block">Local pipeline operational</span>
          </div>
        </div>

      </div>

      {/* Charts section */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Line Chart: Scans volume timeline (2/3 width) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <h4 className="font-bold text-white text-sm">Scan Activity Volume</h4>
              <p className="text-slate-400 text-xs">Total completed video logs over the last 7 days.</p>
            </div>
            <span className="text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded-lg">
              Daily Scans
            </span>
          </div>

          {/* SVG Area Line Chart */}
          <div className="w-full h-48 relative pt-4">
            {totalScans === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                No scanning activity data available.
              </div>
            ) : (
              <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  {/* Neon Glow Area Gradient */}
                  <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="30" y1="30" x2="470" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="30" y1="75" x2="470" y2="75" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="30" y1="120" x2="470" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

                {/* Filled Gradient Area */}
                {areaD && <path d={areaD} fill="url(#chartGlow)" />}

                {/* Glowing neon path line */}
                {pathD && (
                  <path 
                    d={pathD} 
                    fill="none" 
                    stroke="#818cf8" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round" 
                    className="drop-shadow-[0_2px_8px_rgba(99,102,241,0.5)]"
                  />
                )}

                {/* Interactive Points nodes */}
                {points.map((p, i) => (
                  <g key={i} className="group/node cursor-pointer">
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="4.5" 
                      fill="#ffffff" 
                      stroke="#4f46e5" 
                      strokeWidth="2.5"
                    />
                    {/* Hover text label */}
                    <text 
                      x={p.x} 
                      y={p.y - 12} 
                      textAnchor="middle" 
                      fill="#818cf8" 
                      fontSize="9" 
                      fontWeight="bold" 
                      className="opacity-80 font-mono"
                    >
                      {p.count}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>

          {/* X Axis Labels */}
          <div className="flex justify-between text-[10px] text-slate-500 font-bold px-7">
            {weeklyData.map((d, i) => (
              <span key={i}>{d.dayName}</span>
            ))}
          </div>
        </div>

        {/* Donut Chart: Pipeline Split (1/3 width) */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
          <div className="space-y-0.5">
            <h4 className="font-bold text-white text-sm">Pipeline Categorization</h4>
            <p className="text-slate-400 text-xs">Ratio of Order vs. Return streams.</p>
          </div>

          {/* Donut visualization */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* SVG circle stroke representation */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Returns gray base (0% right now) */}
              <circle cx="18" cy="18" r="15.91" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
              {/* Order blue segment (100% since returns are not added yet, but ready!) */}
              <circle 
                cx="18" cy="18" 
                r="15.91" 
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="3.2" 
                strokeDasharray="100 0" 
                strokeDashoffset="0"
                strokeLinecap="round"
                className="drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Order</span>
              <span className="text-lg font-black text-white">100%</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Order Logs
              </span>
              <span className="font-semibold text-white font-mono">{totalScans}</span>
            </div>
            <div className="flex items-center justify-between text-xs opacity-40">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
                Return Logs
              </span>
              <span className="font-semibold text-white font-mono">0 (Future)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Activity Log Feed */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="font-bold text-white text-sm">Recent Scans Feed</h4>
            <p className="text-slate-400 text-xs font-medium">Real-time log of the latest 5 scans performed at this station.</p>
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Latest logs
          </span>
        </div>

        {records.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No recent activity to display. Scan a package to fill the feed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Air Waybill (AWB)</th>
                  <th className="py-3 px-4">Time Scanned</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Storage Location</th>
                  <th className="py-3 px-4 text-center">Video Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.slice(0, 5).map((record) => (
                  <tr key={record.awb} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300 select-all">{record.awb}</td>
                    <td className="py-3 px-4 text-slate-300">{formatTime(record.recordedAt)}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-300">{record.duration}s</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[10px] text-slate-400 font-semibold">
                        {record.isMock ? 'Local disk fallback' : 'AWS S3 storage'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => setActiveVideo({ awb: record.awb, url: record.videoUrl })}
                        className="p-1.5 bg-brand-500/10 hover:bg-brand-600 border border-brand-500/20 hover:border-brand-500 text-brand-glow hover:text-white rounded-lg transition-all inline-flex items-center justify-center"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-900 border border-white/10 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Play Video Log</span>
                <h3 className="font-extrabold text-white text-base md:text-lg font-mono truncate max-w-md">
                  AWB: {activeVideo.awb}
                </h3>
              </div>
              <button 
                onClick={() => setActiveVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none"
              >
                <span className="text-base">✕</span>
              </button>
            </div>

            {/* Video Body Content */}
            <div className="aspect-video w-full bg-black relative flex items-center justify-center">
              <video
                src={activeVideo.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
