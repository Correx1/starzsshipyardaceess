"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { Camera, X, RefreshCw, Zap, ZapOff, AlertCircle } from "lucide-react";

interface GateQrScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decoded: { type: "ticket" | "card" | "raw"; value: string }) => void;
}

export default function GateQrScanner({ isOpen, onClose, onScanSuccess }: GateQrScannerProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = "gate-qr-reader-region";

  // Play a brief high-tech audio chime upon successful scan
  const playScanChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted before interaction; safe to ignore
    }
  }, []);

  const handleScanText = useCallback((decodedText: string) => {
    playScanChime();

    // Parse decoded text:
    const trimmed = decodedText.trim();

    // 1. Check if card format (URL or raw code)
    if (trimmed.includes("card=")) {
      const match = trimmed.match(/card=([^&#\s]+)/);
      if (match && match[1]) {
        onScanSuccess({ type: "card", value: decodeURIComponent(match[1]) });
        return;
      }
    }

    if (/^CRD-[A-Z0-9-]+$/i.test(trimmed)) {
      onScanSuccess({ type: "card", value: trimmed.toUpperCase() });
      return;
    }

    // 2. Check if ticket format (URL or raw code)
    if (trimmed.includes("/verify/")) {
      const match = trimmed.match(/\/verify\/([^/?#\s]+)/);
      if (match && match[1]) {
        onScanSuccess({ type: "ticket", value: decodeURIComponent(match[1]) });
        return;
      }
    }

    if (/^STYD\.[A-Z0-9-]+$/i.test(trimmed)) {
      onScanSuccess({ type: "ticket", value: trimmed });
      return;
    }

    // 3. Check 6-digit numeric PIN
    if (/^\d{6}$/.test(trimmed)) {
      onScanSuccess({ type: "ticket", value: trimmed });
      return;
    }

    // Fallback: pass raw
    onScanSuccess({ type: "raw", value: trimmed });
  }, [onScanSuccess, playScanChime]);

  // Start Scanner with selected camera
  const startCamera = useCallback(async (cameraId: string) => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(readerElementId);
    }

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        cameraId,
        config,
        (decodedText) => {
          handleScanText(decodedText);
        },
        () => {
          // Ignore transient frame decode errors
        }
      );

      setIsScanning(true);
      setErrorMsg(null);

      // Check if torch/flashlight capability is supported
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.error("Camera start error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to access camera. Please check permissions.";
      setErrorMsg(errorMessage);
      setIsScanning(false);
    }
  }, [handleScanText]);

  // Discover Available Cameras
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera if available
          const backCam = devices.find((d) => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("rear") || 
            d.label.toLowerCase().includes("environment")
          );
          const initialCamId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(initialCamId);
          startCamera(initialCamId);
        } else {
          setErrorMsg("No video input devices / cameras found.");
        }
      })
      .catch((err) => {
        console.error("Camera permission error:", err);
        setErrorMsg("Camera access denied or unavailable. Please enable camera permission in your browser.");
      });

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen, startCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error("Torch error:", err);
    }
  };

  const handleStopAndClose = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignored
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Modal Header */}
        <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#11035E] border border-blue-600/40 flex items-center justify-center text-blue-300">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Live Gate Scanner
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                Point camera at Ticket QR Pass or Fleet Card
              </p>
            </div>
          </div>

          <button
            onClick={handleStopAndClose}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center max-w-xs space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-xs font-semibold text-rose-300">{errorMsg}</p>
              <button
                onClick={() => selectedCameraId && startCamera(selectedCameraId)}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              {/* html5-qrcode video mount point */}
              <div id={readerElementId} className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:object-cover" />

              {/* High-Tech HUD Scanner Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Visual Target Frame */}
                <div className="relative w-56 h-56 border-2 border-dashed border-emerald-400/70 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Corner Reticle Accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

                  {/* Laser Scan Sweeper Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse"></div>
                </div>

                <span className="mt-4 text-[10px] font-mono tracking-widest text-emerald-300 uppercase bg-black/60 px-3 py-1 rounded-full border border-emerald-500/30">
                  Align QR Code in Target Frame
                </span>
              </div>
            </>
          )}
        </div>

        {/* Controls Footer */}
        <div className="bg-zinc-950/90 p-3.5 border-t border-zinc-800 flex items-center justify-between gap-3">
          {/* Camera Selector */}
          {cameras.length > 1 && (
            <div className="flex-1">
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Flashlight / Torch Toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                torchOn
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
            >
              {torchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
              <span>{torchOn ? "Torch ON" : "Torch"}</span>
            </button>
          )}

          <button
            onClick={handleStopAndClose}
            className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 transition-colors cursor-pointer ml-auto"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
