import React, { useState, useEffect, useRef } from 'react';
import { Barcode, AlertCircle, Sparkles, Keyboard, Focus } from 'lucide-react';

const playBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // standard scanner beep
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (error) {
    console.error('Audio beep failed', error);
  }
};

export default function Scanner({ onScanSuccess, active }) {
  const [awbValue, setAwbValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFocused, setIsFocused] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const inputRef = useRef(null);

  // Auto-focus the input field on load and keep it focused
  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    }
  }, [active]);

  // Keep input focused globally for seamless hardware scanning
  useEffect(() => {
    const handleGlobalClick = () => {
      if (active && inputRef.current && !isSimulating) {
        inputRef.current.focus();
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [active, isSimulating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanAwb = awbValue.trim();
    
    if (!cleanAwb) {
      setErrorMsg('AWB code cannot be empty.');
      return;
    }
    
    playBeep();
    onScanSuccess(cleanAwb);
    setAwbValue(''); // Clear input
  };

  // Simulates a physical USB handheld scanner typing characters rapidly
  const handleSimulateHardwareScan = () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    setErrorMsg('');
    setAwbValue('');
    
    const targetAwb = `AWB-${Math.floor(100000000 + Math.random() * 900000000)}`;
    let currentText = '';
    let index = 0;
    
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Type 1 character every 25ms to simulate rapid hardware scanner typing
    const typingInterval = setInterval(() => {
      if (index < targetAwb.length) {
        currentText += targetAwb[index];
        setAwbValue(currentText);
        index++;
      } else {
        clearInterval(typingInterval);
        
        // Simulates the scanner sending an "Enter" keypress at the end
        setTimeout(() => {
          playBeep();
          onScanSuccess(targetAwb);
          setAwbValue('');
          setIsSimulating(false);
        }, 150);
      }
    }, 25);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">
          Hardware Barcode Scan Portal
        </h2>
        <p className="text-slate-400 text-sm md:text-base">
          Scan a barcode with your handheld scanner. The system will automatically detect the entry and begin recording.
        </p>
      </div>

      {/* Main Scanner Card UI */}
      <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden flex flex-col items-center justify-center space-y-8">
        
        {/* Holographic Laser Animation */}
        <div className="w-full max-w-sm aspect-[4/1] bg-dark-900 border border-slate-700/60 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner group">
          {/* Laser beam line */}
          <div className="absolute inset-x-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-[bounce_2s_infinite]"></div>
          
          {/* Faux Barcode background graphics */}
          <div className="flex gap-1.5 opacity-15 items-center select-none">
            <div className="w-2 h-16 bg-white"></div>
            <div className="w-4 h-16 bg-white"></div>
            <div className="w-1 h-16 bg-white"></div>
            <div className="w-3 h-16 bg-white"></div>
            <div className="w-1 h-16 bg-white"></div>
            <div className="w-5 h-16 bg-white"></div>
            <div className="w-2 h-16 bg-white"></div>
            <div className="w-1 h-16 bg-white"></div>
            <div className="w-3 h-16 bg-white"></div>
            <div className="w-4 h-16 bg-white"></div>
            <div className="w-2 h-16 bg-white"></div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Barcode className="w-12 h-12 text-indigo-400/80 animate-pulse" />
          </div>
        </div>

        {/* Input Target */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center justify-between">
              <span>Scanner Input Buffer</span>
              <span className={`flex items-center gap-1 text-[10px] ${isFocused ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {isFocused ? (
                  <>
                    <Focus className="w-3 h-3 text-emerald-400 animate-pulse" />
                    Scan Mode Ready (Auto-Focused)
                  </>
                ) : (
                  <>
                    <Keyboard className="w-3 h-3 text-yellow-400" />
                    Click anywhere to focus
                  </>
                )}
              </span>
            </label>
            
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Waiting for hardware scan..."
                value={awbValue}
                onChange={(e) => setAwbValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isSimulating}
                className="w-full bg-dark-900 border border-slate-700/60 rounded-xl px-4 py-3 text-lg font-mono font-bold tracking-wide text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-center placeholder:text-slate-600 shadow-lg"
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            Process Code Manually
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-400" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Test / Simulator module */}
      <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Hardware Scanner Simulator
          </h4>
          <p className="text-slate-400 text-xs">
            Don't have a handheld barcode scanner plugged in? Click below to simulate the exact keyboard inputs typed by a hardware scanner.
          </p>
        </div>

        <button
          onClick={handleSimulateHardwareScan}
          disabled={isSimulating}
          className="w-full bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 animate-spin-slow" />
          {isSimulating ? 'Simulating Scan...' : 'Simulate Handheld Scanner'}
        </button>
      </div>
    </div>
  );
}
