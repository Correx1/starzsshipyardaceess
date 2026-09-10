"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { Search, Loader2, AlertTriangle, Camera, ArrowLeft, Key, RefreshCw, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import TicketVerification from "@/components/TicketVerification";
import CardVerification from "@/components/CardVerification";

function VerifySearchContent() {
  // Active in-page verified ticket state (keeps URL strictly /verify)
  const [verifiedTicket, setVerifiedTicket] = useState<any | null>(null);
  const [verifiedOrgName, setVerifiedOrgName] = useState<string>("Partner Client");

  // Active Company Card state
  const [activeCardNumber, setActiveCardNumber] = useState<string | null>(null);

  // Mode: "scanner" by default (straight in the scanner on opening), or "manual"
  const [mode, setMode] = useState<"scanner" | "manual">("scanner");
  
  // Manual Input State
  const [ticketInput, setTicketInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const readerElementId = "inline-gate-qr-reader";

  // Audio feedback on scan
  const playScanChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted
    }
  }, []);

  // Stop scanner safely
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Error stopping camera scanner:", err);
      }
      scannerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsCameraActive(false);
      setIsStartingCamera(false);
      setTorchOn(false);
    }
  }, []);

  // Query and open ticket in-page
  const openTicketVerification = useCallback(async (queryParam: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/verify/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryParam }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No matching entry pass found.");
      }

      await stopCamera();
      setVerifiedOrgName(data.clientOrgName || "Partner Client");
      setVerifiedTicket(data.ticket);
    } catch (err: any) {
      console.error("Lookup error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [stopCamera]);

  const handleScanText = useCallback((decodedText: string) => {
    const trimmed = decodedText.trim();
    if (!trimmed) return;

    playScanChime();

    // 1. Check if Card format (URL or raw card number)
    if (trimmed.includes("card=")) {
      const match = trimmed.match(/card=([^&#\s]+)/);
      if (match && match[1]) {
        stopCamera();
        setActiveCardNumber(decodeURIComponent(match[1]).toUpperCase());
        return;
      }
    }

    if (/^CRD-[A-Z0-9-]+$/i.test(trimmed) || trimmed.toUpperCase().startsWith("CRD-")) {
      stopCamera();
      setActiveCardNumber(trimmed.toUpperCase());
      return;
    }

    // 2. Check if Ticket URL containing /verify/
    let queryValue = trimmed;
    if (trimmed.includes("/verify/")) {
      const match = trimmed.match(/\/verify\/([^/?#\s]+)/);
      if (match && match[1]) {
        queryValue = decodeURIComponent(match[1]);
      }
    }

    openTicketVerification(queryValue);
  }, [openTicketVerification, playScanChime, stopCamera]);

  // Start scanner
  const startCamera = useCallback(async (cameraId?: string) => {
    if (!isMountedRef.current || verifiedTicket) return;
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      const container = document.getElementById(readerElementId);
      if (!container) {
        setIsStartingCamera(false);
        return;
      }

      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.72);
        return {
          width: Math.max(qrboxSize, 180),
          height: Math.max(qrboxSize, 180),
        };
      };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanText(decodedText);
        },
        () => {
          // Frame decode error (normal between frames)
        }
      );

      if (isMountedRef.current) {
        setIsCameraActive(true);
        setIsStartingCamera(false);

        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities();
          setHasTorch(Boolean(capabilities && (capabilities as any).torch));
        } catch {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      console.error("Camera start error:", err);
      if (isMountedRef.current) {
        setIsCameraActive(false);
        setIsStartingCamera(false);

        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Camera permission denied. Please allow camera permissions in browser or enter 6-digit PIN below."
            : "Camera scanner unavailable on this device. Please enter 6-digit PIN below."
        );
      }
    }
  }, [handleScanText, verifiedTicket]);

  // Initialize camera list and start on mount if in scanner mode and no ticket is being viewed
  useEffect(() => {
    isMountedRef.current = true;

    if (mode === "scanner" && !verifiedTicket) {
      const timer = setTimeout(() => {
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (!isMountedRef.current) return;
            if (devices && devices.length > 0) {
              setCameras(devices);
              const backCam = devices.find((d) =>
                /back|rear|environment/i.test(d.label)
              );
              const selected = backCam ? backCam.id : devices[0].id;
              setSelectedCameraId(selected);
              startCamera(selected);
            } else {
              startCamera();
            }
          })
          .catch(() => {
            if (isMountedRef.current) startCamera();
          });
      }, 100);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [mode, startCamera, stopCamera, verifiedTicket]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // Switch camera
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    startCamera(nextCam.id);
  };

  // Handle Manual PIN / Ticket Search
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = ticketInput.trim();
    if (!cleanInput) return;

    if (/^CRD-[A-Z0-9-]+$/i.test(cleanInput) || cleanInput.toUpperCase().startsWith("CRD-")) {
      await stopCamera();
      setActiveCardNumber(cleanInput.toUpperCase());
      return;
    }

    await openTicketVerification(cleanInput);
  };

  // If a ticket has been scanned/verified, render inspection view directly in-page without URL change!
  if (verifiedTicket) {
    return (
      <TicketVerification
        initialTicket={verifiedTicket}
        clientOrgName={verifiedOrgName}
        onBack={() => {
          setVerifiedTicket(null);
          setTicketInput("");
          setError(null);
          if (!activeCardNumber) {
            setMode("scanner");
          }
        }}
      />
    );
  }

  // If a Company Fleet Card is being verified
  if (activeCardNumber) {
    return (
      <CardVerification
        initialCardNumber={activeCardNumber}
        onSelectTicket={(ticket, orgName) => {
          setVerifiedOrgName(orgName);
          setVerifiedTicket(ticket);
        }}
        onBack={() => {
          setActiveCardNumber(null);
          setTicketInput("");
          setError(null);
          setMode("scanner");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-zinc-100 flex flex-col justify-between selection:bg-primary-blue selection:text-white">
      <style jsx global>{`
        #inline-gate-qr-reader {
          border: none !important;
          width: 100% !important;
          height: 100% !important;
        }
        #inline-gate-qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem;
        }
        #inline-gate-qr-reader__scan_region {
          min-height: 100% !important;
        }
      `}</style>
      
      {/* Top Header - Just Big Logo with Left Margin & Simple Back Link */}
      <div className="w-full pt-6 sm:pt-8 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/image.png" 
            alt="Starzs" 
            className="h-14 sm:h-20 w-auto object-contain" 
          />
        </Link>

        <Link
          href="/"
          className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
          title="Return to Portal"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>

      {/* Main Terminal Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-2xl p-5 sm:p-7 space-y-5">
          
          {/* SCANNER VIEW (DEFAULT ON OPENING) */}
          {mode === "scanner" && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-black border border-zinc-700/80 aspect-square flex items-center justify-center">
                
                {/* HTML5 QR Scanner Target Container */}
                <div id={readerElementId} className="w-full h-full flex items-center justify-center" />

                {/* Starting / Loading Overlay */}
                {(isStartingCamera || isLoading) && !cameraError && (
                  <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center space-y-2 z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-xs font-mono text-zinc-400">
                      {isLoading ? "Verifying Access Pass..." : "Initializing Scanner..."}
                    </span>
                  </div>
                )}

                {/* Live Aim / Scanner Target Overlay */}
                {isCameraActive && !isLoading && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
                    <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-lg relative shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-300"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-300"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-300"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-300"></div>
                      
                      {/* Animated Laser Scan Line */}
                      <div className="w-full h-0.5 bg-emerald-400/90 shadow-[0_0_8px_#34d399] animate-pulse mt-28"></div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-black/70 px-2 py-0.5 rounded mt-3 uppercase tracking-wider font-bold">
                      Align QR Code Within Box
                    </span>
                  </div>
                )}

                {/* Controls Overlay (Torch / Switch Camera) */}
                {isCameraActive && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2 rounded-full border transition-colors ${
                          torchOn
                            ? "bg-amber-400 text-black border-amber-300"
                            : "bg-black/60 text-white border-zinc-700 hover:bg-black"
                        }`}
                        title="Toggle Flashlight"
                      >
                        {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                      </button>
                    )}

                    {cameras.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSwitchCamera}
                        className="p-2 rounded-full bg-black/60 hover:bg-black text-white border border-zinc-700 transition-colors"
                        title="Switch Camera"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Error / Loading State */}
                {(cameraError || error) && (
                  <div className="absolute inset-0 bg-zinc-950 p-6 flex flex-col items-center justify-center text-center space-y-3 z-30">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-zinc-300 max-w-xs leading-relaxed">{error || cameraError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCameraError(null);
                        startCamera(selectedCameraId);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-bold cursor-pointer"
                    >
                      Retry Scanner
                    </button>
                  </div>
                )}
              </div>

              {/* Button to Switch to PIN / Ticket ID */}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode("manual");
                }}
                className="w-full bg-[#11035E] hover:bg-blue-900 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-blue-700/50 shadow-md text-xs sm:text-sm cursor-pointer"
              >
                <Key className="w-4 h-4 text-amber-400" />
                Or Enter 6-Digit PIN / Ticket ID
              </button>
            </div>
          )}

          {/* MANUAL PIN / TICKET VIEW */}
          {mode === "manual" && (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                  Manual Verification
                </span>
                <span className="text-sm font-extrabold text-white block mt-0.5">
                  Enter 6-Digit PIN or Ticket ID
                </span>
              </div>

              <form onSubmit={handleManualSearch} className="space-y-4">
                {error && (
                  <div className="bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 p-3 rounded text-xs font-medium flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <input
                    id="ticket_pin"
                    type="text"
                    placeholder="e.g. 921083 or STYD.1092"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    disabled={isLoading}
                    className="block w-full text-center tracking-widest font-mono text-xl font-bold py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder:text-zinc-600 placeholder:text-xs placeholder:font-sans placeholder:tracking-normal uppercase"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !ticketInput.trim()}
                  className="w-full bg-[#11035E] hover:bg-blue-900 text-white text-xs sm:text-sm font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer border border-blue-700/50 shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Verify Access
                    </>
                  )}
                </button>
              </form>

              {/* Button to Switch Back to Camera Scanner */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("scanner");
                }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-700 text-xs cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                Switch to Camera Scanner
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-4 px-6 text-center text-[10px] text-zinc-600">
        Starzs Marine &copy; 2026. Gate Security Access.
      </footer>
    </div>
  );
}

export default function VerifySearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    }>
      <VerifySearchContent />
    </Suspense>
  );
}
