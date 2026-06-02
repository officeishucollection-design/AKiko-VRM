import React, { useState, useEffect, useRef } from 'react';
import { Camera, Barcode, HardDrive, RefreshCw, CheckCircle2, AlertCircle, Play, Video, Sparkles, Focus, ShieldAlert, Key } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const playBeep = (freq = 1000) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (error) {
    console.error('Audio beep failed', error);
  }
};

export default function LiveStation({ active }) {
  const [stream, setStream] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('standby'); // standby, initializing, active, error
  const [cameraError, setCameraError] = useState('');
  
  // Session states
  const [currentAwb, setCurrentAwb] = useState(null);
  const [duration, setDuration] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [isFocused, setIsFocused] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Background uploads tracker
  const [uploads, setUploads] = useState([]);

  // Refs for tracking mutable variables inside async callbacks safely
  const currentAwbRef = useRef(null);
  const durationRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);

  // Keep input focused automatically
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active, currentAwb]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (active && inputRef.current && !isSimulating) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [active, isSimulating]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Initialize camera and start recording
  const acquireStreamAndRecord = async (awb) => {
    let activeStream = streamRef.current;

    if (!activeStream) {
      try {
        setCameraStatus('initializing');
        setCameraError('');
        
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        
        streamRef.current = activeStream;
        setStream(activeStream);
        setCameraStatus('active');
        
        // Wait a small moment for video ref to mount if needed
        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = activeStream;
          }
        }, 100);
      } catch (err) {
        console.error('Camera capture failed:', err);
        setCameraStatus('error');
        setCameraError(err.name === 'NotAllowedError' 
          ? 'Camera/Microphone permissions were denied. Please grant permission to record package streams.'
          : 'Could not access device camera. Make sure no other application is using it.'
        );
        addUploadStatus(awb, 0, 'error', 'Camera access failed');
        return;
      }
    } else {
      setCameraStatus('active');
      if (videoPreviewRef.current && !videoPreviewRef.current.srcObject) {
        videoPreviewRef.current.srcObject = activeStream;
      }
    }

    startRecorder(awb, activeStream);
  };

  const startRecorder = (awb, activeStream) => {
    // Reset chunks and state refs
    chunksRef.current = [];
    currentAwbRef.current = awb;
    setCurrentAwb(awb);
    setDuration(0);
    durationRef.current = 0;

    try {
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

      const recorder = new MediaRecorder(activeStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunksRef.current, { type: mimeType });
        const stoppedAwb = awb;
        const stoppedDuration = durationRef.current;
        
        triggerBackgroundUpload(stoppedAwb, videoBlob, stoppedDuration);
      };

      recorder.start();

      // Set duration timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);

    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      addUploadStatus(awb, 0, 'error', `MediaRecorder Error: ${err.message}`);
    }
  };

  // Stop current recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Stop recording manually, save file and release camera back to standby
  const handleManualStop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }

    setCurrentAwb(null);
    currentAwbRef.current = null;
    setCameraStatus('standby');
  };

  // Asynchronous background upload trigger
  const triggerBackgroundUpload = async (awb, blob, recordDuration) => {
    const uploadId = Date.now();
    
    // Add uploading log
    setUploads(prev => [
      {
        id: uploadId,
        awb,
        duration: recordDuration,
        status: 'uploading',
        timestamp: new Date()
      },
      ...prev
    ]);

    try {
      const fileType = blob.type || 'video/webm';

      // 1. Fetch presigned S3 upload URL
      const presignedRes = await fetch(`${API_URL}/api/records/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awb, contentType: fileType })
      });

      if (!presignedRes.ok) {
        const errJson = await presignedRes.json();
        throw new Error(errJson.error || 'Failed to generate upload URL.');
      }

      const { uploadUrl, fileUrl, isMock } = await presignedRes.json();

      // 2. Upload video binary
      const uploadRes = await fetch(uploadUrl, {
        method: isMock ? 'POST' : 'PUT',
        headers: { 'Content-Type': fileType },
        body: blob
      });

      if (!uploadRes.ok) {
        throw new Error('S3 Storage Upload failed.');
      }

      let finalVideoUrl = fileUrl;
      if (isMock) {
        const uploadJson = await uploadRes.json();
        finalVideoUrl = `${API_URL}${uploadJson.url}`;
      }

      // 3. Register database record
      const saveRes = await fetch(`${API_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb,
          videoUrl: finalVideoUrl,
          duration: recordDuration,
          isMock
        })
      });

      if (!saveRes.ok) {
        const saveErr = await saveRes.json();
        throw new Error(saveErr.error || 'Failed to save DB metadata.');
      }

      // Update upload state to success
      setUploads(prev => 
        prev.map(item => item.id === uploadId ? { ...item, status: 'success' } : item)
      );
      playBeep(1400); // success tone

    } catch (err) {
      console.error(`Upload failed for AWB ${awb}:`, err);
      // Update upload state to error
      setUploads(prev => 
        prev.map(item => item.id === uploadId ? { ...item, status: 'error', errorMsg: err.message } : item)
      );
      playBeep(550); // error tone
    }
  };

  const addUploadStatus = (awb, durationValue, status, errorMsg = '') => {
    setUploads(prev => [
      {
        id: Date.now(),
        awb,
        duration: durationValue,
        status,
        errorMsg,
        timestamp: new Date()
      },
      ...prev
    ]);
  };

  // Main barcode scan event handler
  const handleBarcodeScanned = (scannedCode) => {
    const cleanCode = scannedCode.trim();
    if (!cleanCode) return;

    // Ignore double scans of the same active item
    if (currentAwb && currentAwb.toLowerCase() === cleanCode.toLowerCase()) {
      return;
    }

    // 1. If currently recording, stop the session (saves & uploads in background)
    if (currentAwb) {
      stopRecording();
    }

    // 2. Start recording the new package immediately (camera is opened if not already)
    playBeep(1000); // scan sound
    acquireStreamAndRecord(cleanCode);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) {
      handleBarcodeScanned(inputVal.trim());
      setInputVal('');
    }
  };

  const handleSimulateHardwareScan = () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    setInputVal('');
    
    const targetAwb = `AWB-${Math.floor(100000000 + Math.random() * 900000000)}`;
    let currentText = '';
    let index = 0;
    
    if (inputRef.current) inputRef.current.focus();

    const typingInterval = setInterval(() => {
      if (index < targetAwb.length) {
        currentText += targetAwb[index];
        setInputVal(currentText);
        index++;
      } else {
        clearInterval(typingInterval);
        
        setTimeout(() => {
          handleBarcodeScanned(targetAwb);
          setInputVal('');
          setIsSimulating(false);
        }, 150);
      }
    }, 20);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start animate-fade-in">
      
      {/* LEFT: Camera & Scan Buffer (2/3 width) */}
      <div className="lg:col-span-2 space-y-6">
        
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">
            Order Scan Station
          </h2>
          <p className="text-slate-400 text-sm">
            Scan order barcodes with your connected handheld scanner. Camera records video automatically.
          </p>
        </div>

        {/* Viewport: Standby vs Active Recording */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative bg-black aspect-video flex items-center justify-center">
          
          {cameraStatus === 'active' && currentAwb && (
            <>
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Status Header overlay */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none select-none">
                <div className="flex items-center gap-2 bg-red-600/95 backdrop-blur-md px-4 py-2 rounded-full border border-red-500/20 shadow-lg shadow-red-600/10">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                  </span>
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    RECORDING AWB: <span className="font-mono">{currentAwb}</span>
                  </span>
                </div>

                <div className="bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/15 text-xs font-mono font-black text-red-200">
                  {formatDuration(duration)}
                </div>
              </div>

              {/* Manual Stop Button */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <button
                  type="button"
                  onClick={handleManualStop}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:scale-102 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center gap-2 border border-red-500/20"
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-sm"></span>
                  Stop & Save Recording
                </button>
              </div>
            </>
          )}

          {cameraStatus === 'standby' && (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 animate-scale-up">
              <div className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-glow flex items-center justify-center animate-pulse-slow">
                <Barcode className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Scan Station Standby</h3>
                <p className="text-slate-400 text-xs md:text-sm max-w-sm leading-relaxed">
                  The camera is currently off. Scan a package barcode using your **handheld barcode scanner** to turn on the camera and start recording automatically.
                </p>
              </div>
            </div>
          )}

          {cameraStatus === 'initializing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-slate-400 text-sm">Activating camera recording feed...</p>
            </div>
          )}

          {cameraStatus === 'error' && (
            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-semibold text-white">Camera Error</h3>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Barcode Scanner Focus Area */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 relative">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Click here / Keep focused for Handheld Barcode Scanner..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isSimulating}
                className="w-full bg-dark-900 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3.5 text-base font-mono font-bold tracking-wide text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
            
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3.5 rounded-xl font-bold transition-all text-sm shrink-0 flex items-center gap-1.5"
            >
              Manual Scan
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1.5">
              <Focus className={`w-3.5 h-3.5 ${isFocused ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              {isFocused ? (
                <span className="text-emerald-400 font-semibold">Handheld Scanner Hooked & Ready</span>
              ) : (
                <span className="text-yellow-400 font-semibold">Click page to focus scanner link</span>
              )}
            </span>
            <span>USB/Bluetooth Barcode Scanner</span>
          </div>
        </div>

        {/* Simulator */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Testing Handheld Barcode Scanner
            </h4>
            <p className="text-slate-400 text-xs">
              Simulate physical keystrokes of a handheld scanner typing a barcode and pressing enter.
            </p>
          </div>

          <button
            onClick={handleSimulateHardwareScan}
            disabled={isSimulating}
            className="w-full bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {isSimulating ? 'Typing barcode...' : 'Simulate Handheld Barcode Scanner Scan'}
          </button>
        </div>

      </div>

      {/* RIGHT: Activity Sidebar (1/3 width) */}
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
          
          <div className="p-5 border-b border-white/5 bg-slate-800/10">
            <h3 className="font-bold text-white text-sm tracking-wider uppercase mb-3 text-slate-400">Activity Log</h3>
            
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-dark-900/60 p-3 border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Scanned</span>
                <span className="text-xl font-extrabold text-white">{uploads.length}</span>
              </div>
              <div className="bg-dark-900/60 p-3 border border-white/5 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Saved</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {uploads.filter(u => u.status === 'success').length}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 max-h-[460px] overflow-y-auto min-h-[300px] space-y-4">
            {uploads.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-center space-y-3 text-slate-600">
                <Barcode className="w-10 h-10 text-slate-700/80" />
                <p className="text-xs max-w-[180px] leading-relaxed">Scan a barcode to start recording.</p>
              </div>
            ) : (
              uploads.map((upload) => (
                <div 
                  key={upload.id} 
                  className="p-3.5 bg-dark-900/40 border border-white/5 rounded-xl flex items-center justify-between gap-3 relative animate-scale-up"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="font-mono font-bold text-xs text-white truncate pr-1">
                      {upload.awb}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <span>Duration: {upload.duration}s</span>
                      <span>•</span>
                      <span>{new Date(upload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    {upload.errorMsg && (
                      <div className="text-[9px] text-red-400 font-medium leading-tight">
                        {upload.errorMsg}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {upload.status === 'uploading' && (
                      <div className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold bg-yellow-400/5 border border-yellow-500/10 px-2 py-1 rounded-md">
                        <RefreshCw className="w-3 h-3 animate-spin text-yellow-400" />
                        Saving
                      </div>
                    )}
                    
                    {upload.status === 'success' && (
                      <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-400/5 border border-emerald-500/10 px-2 py-1 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Stored
                      </div>
                    )}
                    
                    {upload.status === 'error' && (
                      <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold bg-red-400/5 border border-red-500/10 px-2 py-1 rounded-md">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        Failed
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
