import React, { useState, useEffect, useRef } from 'react';
import { Camera, Barcode, Trash2, RotateCcw, Image as ImageIcon, Video, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Focus, ChevronRight, X } from 'lucide-react';

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
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (error) {
    console.error('Audio beep failed', error);
  }
};

export default function ReturnStation({ active }) {
  const [stream, setStream] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('standby'); // standby, initializing, active, error
  const [cameraError, setCameraError] = useState('');
  
  // Return Session states
  const [activeAwb, setActiveAwb] = useState(null);
  const [localPhotos, setLocalPhotos] = useState([]); // Array of Base64 DataURIs representing snaps
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  
  // UI Inputs and states
  const [inputVal, setInputVal] = useState('');
  const [isFocused, setIsFocused] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Submission upload flow state
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState('');
  const [history, setHistory] = useState([]);

  // Refs for camera recording
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
  }, [active, activeAwb, uploadStatus]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (active && inputRef.current && !isSimulating) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [active, isSimulating]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      closeCameraStream();
    };
  }, []);

  const closeCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Open camera stream on scan
  const initReturnCamera = async () => {
    if (streamRef.current) return streamRef.current;
    
    try {
      setCameraStatus('initializing');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraStatus('active');
      
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = mediaStream;
        }
      }, 100);
      
      return mediaStream;
    } catch (err) {
      console.error('Camera stream initialize failed for returns:', err);
      setCameraStatus('error');
      setCameraError('Unable to access device camera. Please check browser camera permissions.');
      return null;
    }
  };

  // Capture Base64 JPG snapshot of current video frame
  const handleCapturePhoto = () => {
    if (videoPreviewRef.current && cameraStatus === 'active') {
      const video = videoPreviewRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85); // 85% compression
      setLocalPhotos(prev => [...prev, photoDataUrl]);
      
      // Shutter click sound
      playBeep(1800);
    }
  };

  // Start Video recording
  const handleStartRecording = () => {
    const activeStream = streamRef.current;
    if (!activeStream || isRecording) return;

    chunksRef.current = [];
    setDuration(0);
    setVideoBlob(null);

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
        const recordedBlob = new Blob(chunksRef.current, { type: mimeType });
        setVideoBlob(recordedBlob);
      };

      recorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      playBeep(900); // start tone
    } catch (e) {
      console.error('Returns MediaRecorder error:', e);
    }
  };

  // Stop Video recording
  const handleStopRecording = () => {
    if (!isRecording) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    playBeep(700); // stop tone
  };

  const removePhoto = (index) => {
    setLocalPhotos(prev => prev.filter((_, i) => i !== index));
    playBeep(600);
  };

  const removeVideo = () => {
    setVideoBlob(null);
    setDuration(0);
    playBeep(600);
  };

  // Resets return session and standby camera
  const resetSession = () => {
    closeCameraStream();
    setActiveAwb(null);
    setLocalPhotos([]);
    setVideoBlob(null);
    setIsRecording(false);
    setDuration(0);
    setCameraStatus('standby');
    setUploadStatus('idle');
  };

  // Submits the return data (uploads photos + video to S3 and MongoDB)
  const handleSubmitReturn = async (awbToSubmit = activeAwb, photosToSubmit = localPhotos, videoToSubmit = videoBlob, durationToSubmit = duration) => {
    if (!awbToSubmit) return;
    
    setUploadStatus('uploading');
    setUploadProgress('Contacting server upload portal...');

    try {
      let resolvedIsMock = false;
      const uploadedPhotoUrls = [];

      // 1. Upload photos one by one
      for (let i = 0; i < photosToSubmit.length; i++) {
        setUploadProgress(`Uploading snaps (${i + 1} of ${photosToSubmit.length})...`);
        const photoDataUrl = photosToSubmit[i];
        
        // Convert base64 data to blob binary
        const blobRes = await fetch(photoDataUrl);
        const photoBlob = await blobRes.blob();

        // Get Presigned S3 url
        const presignedRes = await fetch(`${API_URL}/api/records/presigned-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            awb: awbToSubmit,
            contentType: 'image/jpeg',
            type: 'return',
            fileType: 'photo',
            fileIndex: i
          })
        });

        if (!presignedRes.ok) throw new Error(`Photo ${i + 1} registration failed.`);
        const { uploadUrl, fileUrl, isMock: s3Mock } = await presignedRes.json();
        resolvedIsMock = !!s3Mock;

        // Direct upload S3 PUT
        const uploadRes = await fetch(uploadUrl, {
          method: s3Mock ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: photoBlob
        });

        if (!uploadRes.ok) throw new Error(`Photo ${i + 1} upload failed.`);

        if (s3Mock) {
          const uploadJson = await uploadRes.json();
          uploadedPhotoUrls.push(`${API_URL}${uploadJson.url}`);
        } else {
          uploadedPhotoUrls.push(fileUrl);
        }
      }

      // 2. Upload video if recorded
      let finalVideoUrl = null;
      if (videoToSubmit) {
        setUploadProgress('Uploading video file...');

        const fileType = videoToSubmit.type || 'video/webm';
        const presignedRes = await fetch(`${API_URL}/api/records/presigned-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            awb: awbToSubmit,
            contentType: fileType,
            type: 'return',
            fileType: 'video'
          })
        });

        if (!presignedRes.ok) throw new Error('Video registration failed.');
        const { uploadUrl, fileUrl, isMock: s3Mock } = await presignedRes.json();
        resolvedIsMock = !!s3Mock;

        const uploadRes = await fetch(uploadUrl, {
          method: s3Mock ? 'POST' : 'PUT',
          headers: { 'Content-Type': fileType },
          body: videoToSubmit
        });

        if (!uploadRes.ok) throw new Error('Video upload failed.');

        if (s3Mock) {
          const uploadJson = await uploadRes.json();
          finalVideoUrl = `${API_URL}${uploadJson.url}`;
        } else {
          finalVideoUrl = fileUrl;
        }
      }

      // 3. Register return record metadata in MongoDB
      setUploadProgress('Registering return log inside database...');
      const saveRes = await fetch(`${API_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb: awbToSubmit,
          videoUrl: finalVideoUrl,
          photos: uploadedPhotoUrls,
          duration: durationToSubmit,
          type: 'return',
          isMock: resolvedIsMock
        })
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save return metadata log.');
      }

      setUploadStatus('success');
      playBeep(1500);

      // Add to local history list
      setHistory(prev => [
        {
          id: Date.now(),
          awb: awbToSubmit,
          photosCount: photosToSubmit.length,
          hasVideo: !!videoToSubmit,
          timestamp: new Date()
        },
        ...prev
      ]);

      // Return to standby after 1.5s
      setTimeout(() => {
        resetSession();
      }, 1500);

    } catch (err) {
      console.error(err);
      setUploadStatus('error');
      setUploadProgress(err.message || 'An error occurred during upload.');
    }
  };

  // Main barcode scan event handler
  const handleBarcodeScanned = async (scannedCode) => {
    const cleanCode = scannedCode.trim();
    if (!cleanCode) return;

    // Ignore double scans of the same active session
    if (activeAwb && activeAwb.toLowerCase() === cleanCode.toLowerCase()) {
      return;
    }

    // 1. If currently in a return session and have captured assets:
    // Auto-submit the current return in the background to prevent losing data
    if (activeAwb && (localPhotos.length > 0 || videoBlob)) {
      handleSubmitReturn(activeAwb, [...localPhotos], videoBlob, duration);
    }

    // 2. Clear state and start return session for new AWB
    playBeep(1000);
    setLocalPhotos([]);
    setVideoBlob(null);
    setIsRecording(false);
    setDuration(0);
    setUploadStatus('idle');
    setUploadProgress('');
    setActiveAwb(cleanCode);

    // Open camera stream
    await initReturnCamera();
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
    
    const targetAwb = `RET-${Math.floor(100000000 + Math.random() * 900000000)}`;
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

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start animate-fade-in">
      
      {/* LEFT: Camera / Photos & Video Station (2/3 width) */}
      <div className="lg:col-span-2 space-y-6">
        
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">
            Returns Station
          </h2>
          <p className="text-slate-400 text-sm">
            Scan returned package barcodes. Take snapshot photos of condition and record unboxing streams.
          </p>
        </div>

        {/* Viewport: Standby vs Active Return Session */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative bg-black aspect-video flex flex-col items-center justify-center">
          
          {cameraStatus === 'active' && activeAwb && (
            <>
              {uploadStatus === 'idle' ? (
                <>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Header Overlay info */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none select-none">
                    <div className="flex items-center gap-2 bg-indigo-600/95 backdrop-blur-md px-4 py-2 rounded-full border border-indigo-500/20 shadow-lg">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        RETURN SESSION: <span className="font-mono">{activeAwb}</span>
                      </span>
                    </div>

                    {isRecording && (
                      <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-red-500/20 text-xs font-mono font-black text-white">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        REC {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  {/* Actions overlays (Floating capture snap buttons!) */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between gap-4 z-10 pointer-events-auto">
                    
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      disabled={isRecording}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center gap-2 border border-indigo-500/20"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Photo
                    </button>

                    {isRecording ? (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="px-4 py-2.5 bg-red-650 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center gap-2 animate-pulse border border-red-500/20"
                      >
                        <span className="w-2.5 h-2.5 bg-white rounded-sm"></span>
                        Stop Recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center gap-2 border border-red-500/20"
                      >
                        <Video className="w-4 h-4" />
                        Record Video
                      </button>
                    )}

                  </div>
                </>
              ) : (
                /* Uploading screen state */
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 animate-scale-up">
                  {uploadStatus === 'uploading' && (
                    <>
                      <div className="w-16 h-16 rounded-full border-t-2 border-indigo-400 animate-spin flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      <h4 className="font-bold text-white text-sm">Uploading Assets...</h4>
                      <p className="text-xs text-slate-400 max-w-xs">{uploadProgress}</p>
                    </>
                  )}

                  {uploadStatus === 'success' && (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-9 h-9" />
                      </div>
                      <h4 className="font-bold text-white text-sm">Return Logs Saved</h4>
                      <p className="text-xs text-emerald-300">All photos and video are archived inside AWB returns folder.</p>
                    </>
                  )}

                  {uploadStatus === 'error' && (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                        <AlertCircle className="w-9 h-9" />
                      </div>
                      <h4 className="font-bold text-white text-sm">Submission Error</h4>
                      <p className="text-xs text-red-400 max-w-xs">{uploadProgress}</p>
                      <button
                        onClick={() => handleSubmitReturn()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                      >
                        Retry Upload
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {cameraStatus === 'standby' && (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 animate-scale-up">
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse-slow">
                <RotateCcw className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Returns Station Standby</h3>
                <p className="text-slate-400 text-xs md:text-sm max-w-sm leading-relaxed">
                  Scan a return package barcode using your **handheld barcode scanner** to initialize a Return inspection session and open the camera.
                </p>
              </div>
            </div>
          )}

          {cameraStatus === 'initializing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-slate-400 text-sm">Activating camera inspect feed...</p>
            </div>
          )}

          {cameraStatus === 'error' && (
            <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-semibold text-white">Camera Access Error</h3>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Scanner focus buffer */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 relative">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Click here / Keep focused for Return Barcode Scanner..."
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl font-bold transition-all text-sm shrink-0 flex items-center gap-1.5"
            >
              Scan Return
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1.5">
              <Focus className={`w-3.5 h-3.5 ${isFocused ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              {isFocused ? (
                <span className="text-emerald-400 font-semibold font-mono">Returns Scanner Linked</span>
              ) : (
                <span className="text-yellow-400 font-semibold font-mono">Click page to link scanner</span>
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
              Returns Scan Simulator
            </h4>
            <p className="text-slate-400 text-xs">
              Simulates a handheld barcode scan for returns (adds `RET-` prefix, triggers camera, and closes any previous active return session automatically).
            </p>
          </div>

          <button
            onClick={handleSimulateHardwareScan}
            disabled={isSimulating}
            className="w-full bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {isSimulating ? 'Scanning return code...' : 'Simulate Handheld Return Scan'}
          </button>
        </div>

      </div>

      {/* RIGHT: Active Return Inspection Assets List & Submit (1/3 width) */}
      <div className="space-y-6">
        
        {/* Inspection Panel */}
        {activeAwb && (
          <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 shadow-2xl flex flex-col space-y-5 animate-scale-up">
            
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Inspect Checklist</span>
              <h3 className="font-bold text-white text-sm font-mono truncate">{activeAwb}</h3>
            </div>

            {/* Photos Snapped Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                <span>Snapped Photos</span>
                <span className="text-slate-300 font-semibold font-mono">{localPhotos.length}</span>
              </label>

              {localPhotos.length === 0 ? (
                <div className="py-6 bg-dark-900/60 border border-dashed border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 text-[11px] gap-1">
                  <ImageIcon className="w-5 h-5 text-slate-700" />
                  <span>No photos captured yet</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-[160px] overflow-y-auto p-1 bg-dark-900/30 rounded-xl border border-white/5">
                  {localPhotos.map((photo, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                      <img src={photo} className="w-full h-full object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute inset-0 bg-red-650/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Video Stream</label>
              
              {videoBlob ? (
                <div className="p-3 bg-dark-900/60 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-indigo-300 font-semibold font-mono">
                    <Video className="w-4 h-4 text-indigo-400" />
                    video_recorded.webm ({duration}s)
                  </span>
                  <button
                    onClick={removeVideo}
                    className="p-1 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="py-3 bg-dark-900/40 border border-dashed border-slate-700/60 rounded-xl flex items-center justify-center text-slate-600 text-[11px] gap-2">
                  <Video className="w-4 h-4 text-slate-700" />
                  <span>No video stream captured</span>
                </div>
              )}
            </div>

            {/* Submit / Save Returns actions */}
            <div className="grid grid-cols-2 gap-3.5 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={resetSession}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                Discard
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmitReturn()}
                disabled={localPhotos.length === 0 && !videoBlob}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-850 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5"
              >
                Submit Return
              </button>
            </div>

          </div>
        )}

        {/* History Activities */}
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
          <div className="p-5 border-b border-white/5 bg-slate-800/10">
            <h3 className="font-bold text-white text-sm tracking-wider uppercase text-slate-400">Return Activity Queue</h3>
          </div>

          <div className="p-5 max-h-[300px] overflow-y-auto space-y-4">
            {history.length === 0 ? (
              <div className="h-[120px] flex flex-col items-center justify-center text-center space-y-2 text-slate-650">
                <RotateCcw className="w-8 h-8 text-slate-750" />
                <p className="text-[11px] leading-relaxed">No return sessions completed yet.</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="p-3 bg-dark-900/40 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-white">{item.awb}</span>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <span>Photos: {item.photosCount}</span>
                      <span>•</span>
                      <span>Video: {item.hasVideo ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                    Archived
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
