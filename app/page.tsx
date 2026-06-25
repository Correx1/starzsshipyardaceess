"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Lock, User, LogIn, Loader2, ShieldAlert 
} from "lucide-react";

function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "suspended") {
      return "Your Account has been suspended by the administrator. Please contact facility management.";
    }
    if (errorParam === "invalid_session") {
      return "Your session has expired or is invalid. Please sign in again.";
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid username or password.");
      }

      // Automatically route to the correct dashboard based on returned user role
      if (data.role === "admin") {
        router.push("/dashboard");
      } else if (data.role === "client") {
        router.push("/client/dashboard");
      } else {
        throw new Error("Invalid session role returned.");
      }
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during login.";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-sm border border-zinc-200/80 rounded shadow-2xl overflow-hidden relative z-10 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-5 text-center border-b border-zinc-100 shrink-0">
        <div className="inline-flex mb-4 shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STARZS Logo" className="h-14 w-auto object-contain" />
        </div>
        <h2 className="text-md font-black text-primary-dark tracking-tight uppercase">
          Access Portal
        </h2>
        <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider mt-1">
          Enter credentials to access your dashboard
        </p>
      </div>

      {/* Form Body */}
      <form onSubmit={handleLogin} className="p-6 space-y-4">
        {error && (
          <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2.5 rounded text-xs font-semibold flex items-start gap-2 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
            Username or Email
          </label>
          <div className="relative group focus-within:text-primary-blue text-zinc-400">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
              <User className="w-4 h-4 transition-colors group-focus-within:text-primary-blue" />
            </div>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or partner@corp.com"
              className="block w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-200 rounded text-xs md:text-sm text-zinc-800 placeholder-zinc-400 transition-all focus:outline-none focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/5"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative group focus-within:text-primary-blue text-zinc-400">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
              <Lock className="w-4 h-4 transition-colors group-focus-within:text-primary-blue" />
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-200 rounded text-xs md:text-sm text-zinc-800 placeholder-zinc-400 transition-all focus:outline-none focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/5"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-linear-to-r from-primary-dark to-primary-blue hover:from-primary-blue hover:to-primary-dark text-white text-xs md:text-sm font-bold py-2.5 md:py-3.5 rounded flex items-center justify-center gap-2 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue disabled:opacity-75 disabled:cursor-not-allowed hover:shadow cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Info */}
      <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 text-center shrink-0">
        <p className="text-[10px] text-zinc-400 font-medium leading-normal">
          Authorized personnel access only.
        </p>
      </div>
    </div>
  );
}

export default function GatewayPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#f0f4f8] relative overflow-hidden">
      
      {/* LEFT COLUMN: Clean SVG Tech Security Illustration (No text, no logo) */}
      <div className="hidden lg:flex items-center justify-center p-12 bg-primary-dark relative overflow-hidden text-white border-r border-zinc-800">
        {/* Background Image with Professional Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-luminosity"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80')" 
          }}
        />
        <div className="absolute inset-0 bg-linear-to-tr from-primary-dark via-primary-dark/95 to-primary-blue/80" />
        
        {/* Large Centered Premium SVG Tech Security Illustration */}
        <div className="relative z-10 w-full flex items-center justify-center">
          <svg viewBox="0 0 500 500" className="w-4/5 h-4/5 max-w-[380px] max-h-[380px] drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Gradients and Filters */}
            <defs>
              <linearGradient id="shieldGrad" x1="150" y1="100" x2="350" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="glowGrad" x1="100" y1="100" x2="400" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="accentGrad" x1="200" y1="150" x2="300" y2="350" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="16" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Tech Circle Grid */}
            <circle cx="250" cy="250" r="180" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.25" />
            <circle cx="250" cy="250" r="140" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <circle cx="250" cy="250" r="210" stroke="#3b82f6" strokeWidth="2" opacity="0.15" />

            {/* Tech Radar Sweeper Lines */}
            <line x1="250" y1="40" x2="250" y2="460" stroke="#3b82f6" strokeWidth="1" opacity="0.15" />
            <line x1="40" y1="250" x2="460" y2="250" stroke="#3b82f6" strokeWidth="1" opacity="0.15" />
            <line x1="100" y1="100" x2="400" y2="400" stroke="#3b82f6" strokeWidth="1" opacity="0.1" />
            <line x1="100" y1="400" x2="400" y2="100" stroke="#3b82f6" strokeWidth="1" opacity="0.1" />

            {/* Soft Cyan Background Glow */}
            <circle cx="250" cy="250" r="110" fill="url(#glowGrad)" filter="url(#glowFilter)" />

            {/* Isometric Hexagonal Base Plate */}
            <polygon points="250,380 370,310 370,190 250,120 130,190 130,310" stroke="#3b82f6" strokeWidth="2" fill="#020617" fillOpacity="0.75" strokeOpacity="0.4" />
            
            {/* Inner Hexagon Ring */}
            <polygon points="250,360 350,300 350,200 250,140 150,200 150,300" stroke="#1e40af" strokeWidth="1.5" fill="none" strokeOpacity="0.3" />

            {/* Glowing Tech nodes on Hexagon Vertices */}
            <circle cx="250" cy="120" r="4" fill="#60a5fa" filter="url(#glowFilter)" />
            <circle cx="370" cy="190" r="4" fill="#60a5fa" />
            <circle cx="370" cy="310" r="4" fill="#60a5fa" />
            <circle cx="250" cy="380" r="4" fill="#60a5fa" />
            <circle cx="130" cy="310" r="4" fill="#60a5fa" />
            <circle cx="130" cy="190" r="4" fill="#60a5fa" />

            {/* Large Glowing Shield Concept (Main Security Guard Graphic) */}
            <path d="M250,155 C295,155 325,170 325,170 C325,170 325,260 295,310 C275,340 250,355 250,355 C250,355 225,340 205,310 C175,260 175,170 175,170 C175,170 205,155 250,155 Z" fill="url(#shieldGrad)" stroke="#60a5fa" strokeWidth="3.5" filter="url(#glowFilter)" />
            
            {/* Inner Shield Lining */}
            <path d="M250,170 C285,170 310,182 310,182 C310,182 310,255 285,298 C267,325 250,338 250,338 C250,338 233,325 215,298 C190,255 190,182 190,182 C190,182 215,170 250,170 Z" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeOpacity="0.5" />

            {/* Digital Padlock/Key Details inside the Shield */}
            {/* Lock Shackle */}
            <path d="M230,235 V220 C230,208 239,200 250,200 C261,200 270,208 270,220 V235" stroke="url(#accentGrad)" strokeWidth="4" strokeLinecap="round" fill="none" />
            {/* Lock Body */}
            <rect x="220" y="235" width="60" height="42" rx="4" fill="url(#accentGrad)" stroke="#93c5fd" strokeWidth="1" />
            {/* Keyhole */}
            <circle cx="250" cy="252" r="5" fill="#020617" />
            <polygon points="247,255 253,255 255,268 245,268" fill="#020617" />

            {/* Tech connection tracks emanating from the Shield */}
            <path d="M250,120 V155" stroke="#60a5fa" strokeWidth="2" strokeDasharray="2 2" />
            <path d="M370,190 L325,200" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M130,190 L175,200" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M250,355 V380" stroke="#60a5fa" strokeWidth="2" strokeDasharray="2 2" />

            {/* Futuristic Orbiting Satellites / Data Packets */}
            <circle cx="210" cy="140" r="3" fill="#38bdf8" filter="url(#glowFilter)" />
            <circle cx="290" cy="140" r="3" fill="#38bdf8" filter="url(#glowFilter)" />
            <circle cx="345" cy="245" r="3" fill="#38bdf8" />
            <circle cx="155" cy="245" r="3" fill="#38bdf8" />
          </svg>
        </div>
      </div>

      {/* RIGHT COLUMN: Clean, Centered Form Portal on Soft Lighter Blue Background */}
      <div className="flex items-center justify-center p-4 sm:p-6 md:p-12 relative min-h-screen w-full bg-linear-to-br from-[#f0f4f8] via-[#e6eff5] to-[#d9e4ee]">
        {/* Premium Soft Grid Background Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(37,99,235,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.07)_1px,transparent_1px)] bg-size-[3rem_3rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-100 pointer-events-none" />
        
        {/* Soft cyan/blue ambient glow behind the card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary-blue/5 rounded-full blur-3xl pointer-events-none" />

        {/* Suspense wrapper to handle searchParams in Client component */}
        <Suspense fallback={
          <div className="bg-white w-full max-w-sm border border-zinc-200/80 rounded shadow-md p-8 text-center relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary-blue mx-auto mb-3" />
            <p className="text-xs text-zinc-500">Loading Access Portal...</p>
          </div>
        }>
          <UnifiedLoginForm />
        </Suspense>
      </div>

    </div>
  );
}

