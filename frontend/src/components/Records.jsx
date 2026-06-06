import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, Play, Download, Trash2, Video, ChevronDown, ListFilter, AlertCircle, RefreshCw, X, FileSpreadsheet, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import JSZip from 'jszip';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export default function Records({ user }) {
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('order'); // order, return
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Search, Sorting, and Video/Photo viewer states
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [activeVideo, setActiveVideo] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [zippingAwb, setZippingAwb] = useState(null);
  const [selectedAwbs, setSelectedAwbs] = useState([]);
  const [isBulkZipping, setIsBulkZipping] = useState(false);
  
  // Detailed Filtering states
  const [datePreset, setDatePreset] = useState('all'); // all, today, yesterday, 7days, 30days, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9); // default 9

  // Reset pagination on filter changes
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(t);
  }, [search, sortBy, activeTab, datePreset, startDate, endDate, minDuration, maxDuration]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      const queryParams = new URLSearchParams({
        search,
        sortBy
      });

      const response = await fetch(`${API_URL}/api/records?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to retrieve recordings directory.');
      }
      
      const data = await response.json();
      setRecords(data);
    } catch (err) {
      console.error('Records fetch error:', err);
      setErrorMsg(err.message || 'Could not connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRecords();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, sortBy]);

  const handleDelete = async (awb) => {
    if (!window.confirm(`Are you sure you want to permanently delete AWB ${awb}? This will delete both the database entry and the video file.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/records/${awb}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording.');
      }

      setRecords(prev => prev.filter(r => r.awb !== awb));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Perform client-side granular filtering based on user options
  const getFilteredRecords = () => {
    return records.filter(record => {
      // Filter by active tab (order or return)
      const recordType = record.type || 'order';
      if (recordType !== activeTab) {
        return false;
      }

      const recordDate = new Date(record.recordedAt);
      const recordDuration = record.duration || 0;
      
      // 1. Date Presets Filter
      if (datePreset !== 'all') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (datePreset === 'today') {
          if (recordDate < startOfToday) return false;
        } else if (datePreset === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          if (recordDate < startOfYesterday || recordDate >= startOfToday) return false;
        } else if (datePreset === '7days') {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (recordDate < sevenDaysAgo) return false;
        } else if (datePreset === '30days') {
          const thirtyDaysAgo = new Date(startOfToday);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (recordDate < thirtyDaysAgo) return false;
        } else if (datePreset === 'custom') {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (recordDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (recordDate > end) return false;
          }
        }
      }

      // 2. Video Duration Range Filter
      if (minDuration !== '' && recordDuration < parseInt(minDuration)) {
        return false;
      }
      if (maxDuration !== '' && recordDuration > parseInt(maxDuration)) {
        return false;
      }

      return true;
    });
  };

  const filteredRecords = getFilteredRecords();

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredRecords.length / itemsPerPage);
  const safeCurrentPage = itemsPerPage === -1 ? 1 : Math.min(currentPage, Math.max(1, totalPages));
  const indexOfLastItem = safeCurrentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = itemsPerPage === -1 
    ? filteredRecords 
    : filteredRecords.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  // Reset selection on tab switch
  useEffect(() => {
    const t = setTimeout(() => {
      setSelectedAwbs([]);
    }, 0);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Export to Excel-compatible CSV file
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No records match your active filters to export.');
      return;
    }

    const headers = activeTab === 'return'
      ? ['Air Waybill (AWB)', 'Recorded Date & Time', 'Category', 'Video URL', 'Photo URLs (Semicolon Separated)']
      : ['Air Waybill (AWB)', 'Recorded Date & Time', 'Duration (seconds)', 'Category', 'Video URL'];
    
    const rows = filteredRecords.map(r => {
      if (activeTab === 'return') {
        return [
          r.awb,
          formatDate(r.recordedAt),
          r.type || 'return',
          r.videoUrl || 'N/A',
          r.photos && r.photos.length > 0 ? r.photos.join('; ') : 'N/A'
        ];
      } else {
        return [
          r.awb,
          formatDate(r.recordedAt),
          r.duration || 0,
          r.type || 'order',
          r.videoUrl || 'N/A'
        ];
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestampStr = new Date().toISOString().split('T')[0];
    const exportPrefix = activeTab === 'return' ? 'Returns' : 'Orders';
    link.setAttribute('href', url);
    link.setAttribute('download', `VRM_${exportPrefix}_Export_${timestampStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReturnZip = async (record) => {
    const awb = record.awb;
    setZippingAwb(awb);
    
    // Helper to get proxied S3 URL if the URL is not hosted locally to bypass CORS policy
    const getFetchUrl = (url) => {
      if (!url) return '';
      const isLocal = url.startsWith(API_URL) || url.startsWith('/') || url.startsWith('http://localhost:5000');
      if (isLocal) {
        return url;
      }
      return `${API_URL}/api/proxy?url=${encodeURIComponent(url)}`;
    };

    try {
      const zip = new JSZip();
      
      // 1. Download and append video if exists
      if (record.videoUrl) {
        const videoRes = await fetch(getFetchUrl(record.videoUrl));
        if (!videoRes.ok) throw new Error('Failed to retrieve video stream file.');
        const videoBlob = await videoRes.blob();
        
        // Extract file extension
        const ext = record.videoUrl.split(';')[0].split('/')[1] || 'webm';
        zip.file(`video_${awb}.${ext.split(';')[0]}`, videoBlob);
      }
      
      // 2. Download and append photos
      if (record.photos && record.photos.length > 0) {
        for (let i = 0; i < record.photos.length; i++) {
          const photoUrl = record.photos[i];
          const photoRes = await fetch(getFetchUrl(photoUrl));
          if (!photoRes.ok) throw new Error(`Failed to retrieve inspection snapshot ${i + 1}.`);
          const photoBlob = await photoRes.blob();
          
          const ext = photoUrl.split('.').pop().split('?')[0] || 'jpg';
          zip.file(`photo_${i + 1}.${ext}`, photoBlob);
        }
      }
      
      // 3. Compile zip
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // 4. Download file
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${awb}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      console.error('ZIP generation error:', err);
      alert(`ZIP Folder Download failed: ${err.message}.`);
    } finally {
      setZippingAwb(null);
    }
  };

  const handleBulkDownloadZip = async () => {
    if (selectedAwbs.length === 0) return;
    setIsBulkZipping(true);
    
    // Helper to get proxied S3 URL if the URL is not hosted locally to bypass CORS policy
    const getFetchUrl = (url) => {
      if (!url) return '';
      const isLocal = url.startsWith(API_URL) || url.startsWith('/') || url.startsWith('http://localhost:5000');
      if (isLocal) {
        return url;
      }
      return `${API_URL}/api/proxy?url=${encodeURIComponent(url)}`;
    };

    try {
      const zip = new JSZip();
      
      const selectedRecords = records.filter(r => selectedAwbs.includes(r.awb));
      
      for (const record of selectedRecords) {
        const folder = zip.folder(record.awb);
        
        // 1. Download and append video if exists
        if (record.videoUrl) {
          try {
            const videoRes = await fetch(getFetchUrl(record.videoUrl));
            if (videoRes.ok) {
              const videoBlob = await videoRes.blob();
              const ext = record.videoUrl.split(';')[0].split('/')[1] || 'webm';
              folder.file(`video_${record.awb}.${ext.split(';')[0]}`, videoBlob);
            }
          } catch (e) {
            console.error(`Failed to download video for AWB ${record.awb}:`, e);
          }
        }
        
        // 2. Download and append photos
        if (record.photos && record.photos.length > 0) {
          for (let i = 0; i < record.photos.length; i++) {
            try {
              const photoUrl = record.photos[i];
              const photoRes = await fetch(getFetchUrl(photoUrl));
              if (photoRes.ok) {
                const photoBlob = await photoRes.blob();
                const ext = photoUrl.split('.').pop().split('?')[0] || 'jpg';
                folder.file(`photo_${i + 1}.${ext}`, photoBlob);
              }
            } catch (e) {
              console.error(`Failed to download photo ${i + 1} for AWB ${record.awb}:`, e);
            }
          }
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const timestampStr = new Date().toISOString().split('T')[0];
      const exportType = activeTab === 'return' ? 'Returns' : 'Orders';
      link.download = `VRM_Bulk_${exportType}_${timestampStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      setSelectedAwbs([]);
    } catch (err) {
      console.error('Bulk ZIP download failed:', err);
      alert(`Bulk ZIP download failed: ${err.message}`);
    } finally {
      setIsBulkZipping(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">
            Records Directory
          </h2>
          <p className="text-slate-400 text-sm">
            Filter, search, review, and export video logs associated with package Air Waybills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export to Excel
          </button>
          
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-2 text-sm font-semibold text-indigo-300 shadow-md">
            Showing: {filteredRecords.length} of {records.filter(r => (r.type || 'order') === activeTab).length}
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex p-1 bg-slate-800/20 border border-white/5 rounded-xl w-fit gap-1 shadow-inner">
        <button
          onClick={() => setActiveTab('order')}
          className={`px-5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'order'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-4 h-4" />
          Order Logs
        </button>
        <button
          onClick={() => setActiveTab('return')}
          className={`px-5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'return'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Return Logs
        </button>
      </div>

      {/* Primary Search & Control Bar */}
      <div className="grid md:grid-cols-4 gap-4 bg-slate-800/20 p-4 rounded-xl border border-white/5 shadow-inner">
        
        {/* Search Input (2 cols) */}
        <div className="relative md:col-span-2">
          <Search className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search AWB numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600 shadow-sm"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-dark-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-brand-500 appearance-none transition-colors shadow-sm cursor-pointer"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="awb-asc">AWB (A to Z)</option>
            <option value="awb-desc">AWB (Z to A)</option>
            <option value="duration-desc">Duration (Longest)</option>
            <option value="duration-asc">Duration (Shortest)</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
        </div>

        {/* Toggle Detailed Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-full py-2 border rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 ${
            showFilters 
              ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/10' 
              : 'bg-dark-900 border-slate-700 text-slate-300 hover:bg-slate-800/40'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'More Filters'}
        </button>
      </div>

      {/* Expanded Granular Filters Section */}
      {showFilters && (
        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-xl shadow-inner space-y-6 animate-scale-up">
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Date & Time Preset Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Date Preset</label>
              <div className="relative">
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-white focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="custom">Custom Date Range</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 2. Custom Date Range Pickers (Only visible when 'custom' selected) */}
            {datePreset === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </>
            )}

            {/* 3. Duration Limits Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Min Duration (sec)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 3"
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Max Duration (sec)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 10"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          {/* Reset Filters Panel button */}
          <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
            <button
              onClick={() => {
                setDatePreset('all');
                setStartDate('');
                setEndDate('');
                setMinDuration('');
                setMaxDuration('');
              }}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Errors or Loading States */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400" />
          <div className="space-y-1.5 flex-1">
            <p className="text-sm font-semibold">Connection Error</p>
            <p className="text-xs text-red-300">{errorMsg}</p>
          </div>
          <button 
            onClick={fetchRecords}
            className="bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">Querying database files...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="py-16 glass-card rounded-2xl flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50 text-slate-500">
            <Video className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-white text-lg">No records found</h4>
            <p className="text-slate-400 text-sm max-w-sm">
              No package videos match your active filters or search terms. Try adjusting filter scopes.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Batch Action Banner */}
          {selectedAwbs.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-indigo-600/20 border border-indigo-500/30 rounded-xl shadow-lg animate-fade-in gap-4 animate-scale-up">
              <div className="text-xs md:text-sm font-semibold text-indigo-300">
                Selected <span className="text-white font-extrabold font-mono">{selectedAwbs.length}</span> {selectedAwbs.length === 1 ? 'log' : 'logs'} for batch action
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkDownloadZip}
                  disabled={isBulkZipping}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 transition-colors shadow-md active:scale-95"
                >
                  {isBulkZipping ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Zipping...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Bulk Save ZIP
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedAwbs([])}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Select All Checkbox Header */}
          {!loading && filteredRecords.length > 0 && (
            <div className="flex items-center justify-between bg-slate-850/45 px-4 py-3 rounded-xl border border-white/5 text-xs text-slate-400 animate-scale-up">
              <label className="flex items-center gap-2.5 cursor-pointer hover:text-slate-350 select-none">
                <input
                  type="checkbox"
                  checked={filteredRecords.length > 0 && filteredRecords.every(r => selectedAwbs.includes(r.awb))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAwbs(prev => {
                        const newSelection = [...prev];
                        filteredRecords.forEach(r => {
                          if (!newSelection.includes(r.awb)) newSelection.push(r.awb);
                        });
                        return newSelection;
                      });
                    } else {
                      const filteredAwbSet = new Set(filteredRecords.map(r => r.awb));
                      setSelectedAwbs(prev => prev.filter(awb => !filteredAwbSet.has(awb)));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-700 bg-black/40 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-300">Select All Visible Logs ({filteredRecords.length})</span>
              </label>
              {selectedAwbs.length > 0 && (
                <span className="font-mono text-indigo-300 font-bold">{selectedAwbs.length} Selected Total</span>
              )}
            </div>
          )}

          {/* Records Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentItems.map((record) => (
              <div 
                key={record.awb} 
                className="glass-card rounded-2xl overflow-hidden flex flex-col border border-white/5 relative group animate-scale-up"
              >
                {/* Media Card Preview */}
                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden border-b border-white/5">
                  {record.videoUrl && (
                    <video
                      src={record.videoUrl}
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity pointer-events-none"
                      muted
                      playsInline
                    />
                  )}
                  {!record.videoUrl && record.photos && record.photos.length > 0 && (
                    <img
                      src={record.photos[0]}
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity pointer-events-none"
                      alt=""
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/80 flex flex-col justify-between p-3 select-none">
                    <div className="flex justify-between items-center w-full pointer-events-auto">
                      <input
                        type="checkbox"
                        checked={selectedAwbs.includes(record.awb)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedAwbs(prev => [...prev, record.awb]);
                          } else {
                            setSelectedAwbs(prev => prev.filter(awb => awb !== record.awb));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-black/40 text-brand-600 focus:ring-brand-500 cursor-pointer transition-all"
                      />
                      <span className="px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-slate-300 font-medium tracking-wide">
                        {record.isMock ? 'Local Storage' : 'AWS S3'}
                      </span>
                    </div>
                  
                  {/* Video Play or Photo View Trigger Overlay */}
                  {record.videoUrl ? (
                    <div className="self-center w-12 h-12 rounded-full bg-brand-500/20 group-hover:bg-brand-600 border border-brand-500/30 group-hover:border-brand-500/50 text-indigo-300 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg cursor-pointer"
                      onClick={() => setActiveVideo({ awb: record.awb, url: record.videoUrl })}
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  ) : record.photos && record.photos.length > 0 ? (
                    <div className="self-center w-12 h-12 rounded-full bg-indigo-500/20 group-hover:bg-indigo-650 border border-indigo-500/30 group-hover:border-indigo-500/50 text-indigo-300 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg cursor-pointer"
                      onClick={() => setActivePhoto({ awb: record.awb, url: record.photos[0] })}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center w-full">
                    {record.videoUrl ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-500/30 text-[10px] text-indigo-200 font-semibold font-mono">
                        {record.duration}s
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/30 text-[10px] text-slate-400 font-semibold font-mono">
                        No Video
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-[10px] text-slate-400 font-bold capitalize">
                      {record.type || 'order'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Panel */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-extrabold text-white text-base font-mono tracking-tight select-all truncate">
                    {record.awb}
                  </h3>
                  
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(record.recordedAt)}</span>
                    </div>
                    {record.videoUrl && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Duration: {record.duration} seconds</span>
                      </div>
                    )}
                  </div>

                  {/* Return Photos Thumbnails row */}
                  {record.photos && record.photos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Inspection Snaps ({record.photos.length})</span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                        {record.photos.map((photo, i) => (
                          <div 
                            key={i} 
                            onClick={() => setActivePhoto({ awb: record.awb, url: photo })}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 cursor-zoom-in hover:border-brand-500 transition-colors"
                          >
                            <img src={photo} className="w-full h-full object-cover" alt="" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Grid */}
                <div className={`grid ${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-2 border-t border-white/5`}>
                  <button
                    onClick={() => setActiveVideo({ awb: record.awb, url: record.videoUrl })}
                    disabled={!record.videoUrl}
                    className="py-2 bg-brand-500/10 hover:bg-brand-600 disabled:opacity-30 disabled:hover:bg-brand-500/10 disabled:text-indigo-300 disabled:cursor-not-allowed text-brand-glow hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border border-brand-500/20"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Play
                  </button>
                  
                  {record.type === 'return' ? (
                    <button
                      type="button"
                      disabled={zippingAwb === record.awb || (record.photos.length === 0 && !record.videoUrl)}
                      onClick={() => handleDownloadReturnZip(record)}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {zippingAwb === record.awb ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                          Zipping...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Save ZIP
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href={record.videoUrl || '#'}
                      onClick={(e) => { if(!record.videoUrl) e.preventDefault(); }}
                      download={`AWB_${record.awb}.webm`}
                      target="_blank"
                      rel="noreferrer"
                      className={`py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${!record.videoUrl ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save
                    </a>
                  )}
                  
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(record.awb)}
                      className="py-2 bg-red-950/20 hover:bg-red-600 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {filteredRecords.length > 0 && (totalPages > 1 || itemsPerPage !== 9) && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-white/5 gap-4">
            <div className="text-xs text-slate-400">
              Showing <span className="font-semibold text-white">
                {itemsPerPage === -1 ? 1 : indexOfFirstItem + 1}
              </span> to{' '}
              <span className="font-semibold text-white">
                {itemsPerPage === -1 ? filteredRecords.length : Math.min(indexOfLastItem, filteredRecords.length)}
              </span>{' '}
              of <span className="font-semibold text-white">{filteredRecords.length}</span> records
            </div>
            
            {itemsPerPage !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-350 hover:text-white rounded-lg border border-slate-750 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  if (totalPages <= maxVisiblePages) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    let start = Math.max(1, safeCurrentPage - 2);
                    let end = Math.min(totalPages, safeCurrentPage + 2);
                    if (start === 1) {
                      end = maxVisiblePages;
                    } else if (end === totalPages) {
                      start = totalPages - maxVisiblePages + 1;
                    }
                    for (let i = start; i <= end; i++) pages.push(i);
                  }
                  return pages.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        safeCurrentPage === pageNum
                          ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/10'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ));
                })()}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-350 hover:text-white rounded-lg border border-slate-750 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Show:</span>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-dark-900 border border-slate-700 rounded-lg pl-2 pr-6 py-1 text-xs text-white focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
                >
                  <option value={9}>9 / page</option>
                  <option value={18}>18 / page</option>
                  <option value={36}>36 / page</option>
                  <option value={-1}>All</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 top-1 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-900 border border-white/10 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Play Video Resource</span>
                <h3 className="font-extrabold text-white text-base md:text-lg font-mono truncate max-w-md">
                  AWB: {activeVideo.awb}
                </h3>
              </div>
              <button 
                onClick={() => setActiveVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
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

            {/* Modal Footer Controls Info */}
            <div className="px-6 py-3 bg-slate-950/40 text-[11px] text-slate-500 flex justify-between">
              <span>Host Address: {activeVideo.url.substring(0, 48)}...</span>
              <a 
                href={activeVideo.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                Open in direct window
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setActivePhoto(null)}>
          <div className="bg-dark-900 border border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-extrabold text-white text-base md:text-lg font-mono truncate">
                AWB Photo: {activePhoto.awb}
              </h3>
              <button 
                onClick={() => setActivePhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full aspect-square md:aspect-video bg-black flex items-center justify-center">
              <img src={activePhoto.url} className="w-full h-full object-contain" alt="" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
