import React, { useState, useEffect, useRef } from 'react';
import { Camera, Video, AlertCircle, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const RECORDING_LIMIT_SECONDS = 10; // Auto-stop after 10 seconds

export default function Recorder({ awb, onFinish, onCancel }) {
  const [stream, setStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  
  const [recordingState, setRecordingState] = useState('initializing'); // initializing, active, uploading, success, error
  const [secondsRemaining, setSecondsRemaining] = useState(RECORDING_LIMIT_SECONDS);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  const videoPreviewRef = useRef(null);
  const timerRef = useRef(null);
  const durationRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Initialize camera and start recording automatically
  useEffect(() => {
    let activeStream = null;

    const startCameraAndRecord = async () => {
      try {
        setRecordingState('initializing');
        setErrorMsg('');
        
        // Request video and audio permissions
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        
        activeStream = userStream;
        setStream(userStream);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = userStream;
        }

        // Initialize MediaRecorder
        // Check supported MIME types
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4'; // Safari fallback
        }

        const recorder = new MediaRecorder(userStream, { mimeType });
        mediaRecorderRef.current = recorder;
        setMediaRecorder(recorder);

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const videoBlob = new Blob(chunks, { type: mimeType });
          // Stop all stream tracks to release camera
          userStream.getTracks().forEach(track => track.stop());
          
          // Proceed to upload the blob
          uploadRecording(videoBlob, chunks);
        };

        // Start recording immediately
        recorder.start();
        setRecordingState('active');
        
        // Start countdown timer
        let timer = RECORDING_LIMIT_SECONDS;
        setSecondsRemaining(timer);
        timerRef.current = setInterval(() => {
          timer -= 1;
          setSecondsRemaining(timer);
          setDuration(prev => prev + 1);

          if (timer <= 0) {
            stopRecording();
          }
        }, 1000);

      } catch (err) {
        console.error('Camera/Recorder initialization failed:', err);
        setRecordingState('error');
        setErrorMsg(err.name === 'NotAllowedError' 
          ? 'Camera or microphone access was denied. Please allow camera permissions to record.' 
          : 'Could not access camera or microphone. Please ensure they are connected and not in use by another app.'
        );
      }
    };

    startCameraAndRecord();

    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [awb]);

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('uploading');
    }
  };

  const uploadRecording = async (blob, chunks) => {
    try {
      setRecordingState('uploading');
      
      // Determine file extension
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileType = blob.type || 'video/webm';

      // 1. Fetch Presigned URL
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

      // 2. Perform direct upload to S3 (or mock local handler)
      const uploadHeaders = { 'Content-Type': fileType };
      
      const uploadRes = await fetch(uploadUrl, {
        method: isMock ? 'POST' : 'PUT',
        headers: uploadHeaders,
        body: blob
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload video to storage bucket.');
      }

      // If mock, the backend returns the uploaded video endpoint path in JSON
      let finalVideoUrl = fileUrl;
      if (isMock) {
        const uploadJson = await uploadRes.json();
        finalVideoUrl = `${API_URL}${uploadJson.url}`;
      }

      // 3. Register record metadata on backend MongoDB
      const saveRes = await fetch(`${API_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awb,
          videoUrl: finalVideoUrl,
          duration: duration || RECORDING_LIMIT_SECONDS,
          isMock
        })
      });

      if (!saveRes.ok) {
        const saveErr = await saveRes.json();
        throw new Error(saveErr.error || 'Failed to save record metadata in database.');
      }

      setRecordingState('success');
    } catch (err) {
      console.error('Upload flow failed:', err);
      setRecordingState('error');
      setErrorMsg(err.message || 'An error occurred during S3 upload or database storage.');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20 text-brand-glow text-xs font-semibold mb-2">
          <Video className="w-3.5 h-3.5" />
          Active Session
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white">
          AWB: <span className="text-indigo-400 font-mono select-all">{awb}</span>
        </h2>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
        {/* Video Preview */}
        {(recordingState === 'initializing' || recordingState === 'active') && (
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Glowing recording header overlay */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-semibold text-white tracking-widest uppercase">
                  {recordingState === 'initializing' ? 'CAM INIT' : 'REC'}
                </span>
              </div>

              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-mono font-bold text-white">
                00:{secondsRemaining.toString().padStart(2, '0')}
              </div>
            </div>

            {/* Progress bar overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900/60">
              <div 
                className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsRemaining / RECORDING_LIMIT_SECONDS) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Uploading panel */}
        {recordingState === 'uploading' && (
          <div className="p-12 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="w-16 h-16 rounded-full border-t-2 border-indigo-400 animate-spin flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Uploading Recording</h3>
              <p className="text-slate-400 text-xs max-w-xs">
                Saving video file to AWS S3 bucket and registering data to MongoDB database. Please wait...
              </p>
            </div>
          </div>
        )}

        {/* Success screen */}
        {recordingState === 'success' && (
          <div className="p-10 flex flex-col items-center justify-center space-y-6 text-center animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Video Resource Linked Successfully</h3>
              <p className="text-slate-400 text-xs max-w-sm">
                AWB <span className="font-mono text-indigo-300 font-semibold">{awb}</span> is now recorded and safely stored.
              </p>
            </div>

            <div className="flex gap-3 w-full max-w-xs justify-center pt-2">
              <button
                onClick={onFinish}
                className="flex-1 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                Scan Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error screen */}
        {recordingState === 'error' && (
          <div className="p-10 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Recording Error</h3>
              <p className="text-slate-400 text-xs max-w-sm">{errorMsg}</p>
            </div>

            <div className="flex gap-3 w-full max-w-xs justify-center pt-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Try Scan Again
              </button>
            </div>
          </div>
        )}

        {/* Control Button for active recording */}
        {recordingState === 'active' && (
          <div className="p-6 bg-slate-900/40 border-t border-white/5 flex justify-center gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={stopRecording}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/20 hover:scale-103 transition-all flex items-center gap-1.5"
            >
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Stop and Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
