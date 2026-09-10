/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { LogOut, Settings, Loader2 } from "lucide-react";

interface DashboardHeaderProps {
  role: "admin" | "client";
  isSignOutLoading?: boolean;
  onSignOut: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  clientStatus?: "active" | "restricted";
}

export default function DashboardHeader({
  role,
  isSignOutLoading = false,
  onSignOut,
  isSidebarOpen = false,
  onToggleSidebar,
  clientStatus,
}: DashboardHeaderProps) {
  return (
    <header className="bg-primary-dark text-white px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm shrink-0">
      {/* Logo */}
      <div className="flex items-center min-w-0 ml-4 sm:ml-10 md:ml-20 lg:ml-28">
        <img
          src="/image.png"
          alt="Starzs Marine Logo"
          className="h-13 sm:h-14 md:h-16 w-auto object-contain shrink-0"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3.5">
        {role === "client" && clientStatus === "restricted" && (
          <span className="bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm">
            Restricted Mode
          </span>
        )}

        {role === "admin" && onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden xl:flex items-center gap-2 text-xs font-bold px-3.5 py-2 border border-zinc-700 hover:border-[#11035E] hover:bg-[#11035E] hover:text-white hover:shadow-md rounded-sm transition-all cursor-pointer text-zinc-200"
          >
            <Settings className="w-4 h-4 text-zinc-300" />
            {isSidebarOpen ? "Close Settings" : "System Settings"}
          </button>
        )}

        <button
          type="button"
          onClick={onSignOut}
          disabled={isSignOutLoading}
          className="flex items-center gap-2 text-xs font-bold px-3.5 py-2 border border-zinc-700 hover:border-[#11035E] hover:bg-[#11035E] hover:text-white hover:shadow-md rounded-sm transition-all disabled:opacity-50 cursor-pointer text-zinc-200"
        >
          {isSignOutLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 text-zinc-300" />
          )}
          Sign Out
        </button>
      </div>
    </header>
  );
}
