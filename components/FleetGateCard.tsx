"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";

interface FleetGateCardProps {
  cardNumber: string;
  orgName: string;
  side?: "front" | "back" | "both";
  className?: string;
}

export function CardFront({
  cardNumber,
  orgName,
  className = "",
}: {
  cardNumber: string;
  orgName: string;
  className?: string;
}) {
  return (
    <div
      className={`w-[340px] h-[214px] sm:w-[356px] sm:h-[224px] rounded-xl relative overflow-hidden shadow-2xl border border-white/10 bg-[#11035E] bg-gradient-to-br from-[#0b023b] via-[#11035E] to-[#060122] text-white flex flex-col justify-between p-4 sm:p-5 print:break-inside-avoid print:shadow-none ${className}`}
      style={{ 
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}
    >
      {/* Geometric Circles Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.18)_0%,transparent_50%)] pointer-events-none"></div>
      <div className="absolute top-2 right-12 w-28 h-28 rounded-full border border-white/10 pointer-events-none"></div>
      <div className="absolute bottom-4 left-1/3 w-36 h-36 rounded-full border border-white/5 pointer-events-none"></div>

      {/* Top Header: Logo & GATE PASS beneath image on extreme right */}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono tracking-widest text-blue-200/70 uppercase">
            STARZS ACCESS
          </div>
          <div className="flex flex-col items-end">
            <img
              src="/image.png"
              alt="Starzs Logo"
              className="h-8 sm:h-9 w-auto object-contain brightness-110 drop-shadow"
            />
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-amber-400 mt-0.5">
              GATE PASS
            </span>
          </div>
        </div>
      </div>

      {/* Middle Area: Chip + Contactless waves */}
      <div className="relative z-10 flex items-center gap-2">
        <div className="w-10 h-7 rounded bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-600/50 shadow-inner flex flex-col justify-between p-1 shrink-0">
          <div className="w-full h-0.5 bg-amber-700/30 rounded-full"></div>
          <div className="w-full h-0.5 bg-amber-700/30 rounded-full"></div>
          <div className="w-full h-0.5 bg-amber-700/30 rounded-full"></div>
        </div>
        <div className="text-white/60 text-xs font-mono select-none tracking-tighter">
          ))))
        </div>
      </div>

      {/* Bottom Area: Name ABOVE Card Number */}
      <div className="relative z-10 space-y-1">
        {/* Name positioned above card number */}
        <div className="font-bold text-xs sm:text-sm text-amber-300 uppercase tracking-wide truncate max-w-[280px] drop-shadow-sm">
          {orgName}
        </div>

        <div>
          <span className="text-[7px] font-bold text-blue-200/80 uppercase tracking-widest block">
            CARD NUMBER
          </span>
          <div className="font-mono text-sm sm:text-base font-black text-white tracking-[0.16em] drop-shadow-sm">
            {cardNumber}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardBack({
  cardNumber,
  className = "",
}: {
  cardNumber: string;
  className?: string;
}) {
  const qrTargetUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify?card=${encodeURIComponent(
    cardNumber
  )}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    qrTargetUrl
  )}`;

  return (
    <div
      className={`w-[340px] h-[214px] sm:w-[356px] sm:h-[224px] rounded-xl relative overflow-hidden shadow-2xl border border-white/10 bg-[#0e024a] bg-gradient-to-br from-[#080124] via-[#0e024a] to-[#06011c] text-white flex flex-col justify-between print:break-inside-avoid print:shadow-none ${className}`}
      style={{ 
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}
    >
      {/* Black Magnetic Stripe across the top */}
      <div className="h-8 bg-black border-b border-white/10 w-full shrink-0"></div>

      {/* Center Section: Signature Strip + Logo & Clean QR Code */}
      <div className="px-4 sm:px-5 py-2 flex-1 flex flex-col justify-between">
        {/* Signature Strip */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/95 rounded h-6 px-2 flex items-center justify-between border border-zinc-300">
            <div className="flex-1 h-2.5 bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#f3f4f6_4px,#f3f4f6_8px)] rounded-xs"></div>
            <span className="text-[8px] font-mono text-zinc-600 font-bold ml-2">AUTH</span>
          </div>
          <span className="text-[6.5px] font-bold text-zinc-400 uppercase tracking-wider">
            SIGNATURE
          </span>
        </div>

        {/* Middle: Logo & Company details on the left, Clean QR on the right */}
        <div className="flex items-center justify-between gap-3 my-auto">
          <div className="flex flex-col items-start gap-1">
            <img
              src="/image.png"
              alt="Starzs Logo"
              className="h-7 sm:h-8 w-auto object-contain brightness-110 drop-shadow"
            />
            <div className="space-y-0.5 text-left">
              <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider text-white block leading-none">
                Starzs Marine & Engineering Ltd
              </span>
              <span className="text-[6px] sm:text-[6.5px] text-zinc-300 font-medium block leading-tight">
                Onne Oil & Gas Free Zone, Rivers State
              </span>
              <div className="flex items-center gap-1.5 text-[5.5px] sm:text-[6px] text-blue-200/90 font-mono leading-none pt-0.5">
                <span>info@starzs-marine.com</span>
                <span>&bull;</span>
                <span>+234 (0) 84 461 700</span>
              </div>
            </div>
          </div>

          {/* Clean QR Code directly on card */}
          <div className="shrink-0 flex flex-col items-center">
            <img
              src={qrCodeUrl}
              alt={`QR Code for ${cardNumber}`}
              width="64"
              height="64"
              className="w-16 sm:w-17 h-16 sm:h-17 rounded block shadow-sm border border-white/20"
            />
            <span className="text-[6px] font-bold text-amber-400 uppercase tracking-widest mt-0.5">
              SCAN AT GATE
            </span>
          </div>
        </div>

        {/* Disclaimer Footer */}
        <div className="pt-1.5 border-t border-white/10 text-center">
          <p className="text-[6.5px] sm:text-[7px] text-zinc-400 leading-tight">
            Property of Starzs Marine & Engineering Ltd. If found, return to Security Office, Onne Free Zone.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FleetGateCard({
  cardNumber,
  orgName,
  side = "both",
  className = "",
}: FleetGateCardProps) {
  if (side === "front") {
    return <CardFront cardNumber={cardNumber} orgName={orgName} className={className} />;
  }

  if (side === "back") {
    return <CardBack cardNumber={cardNumber} className={className} />;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-items-center ${className}`}>
      <div className="flex flex-col items-center w-full">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 print:hidden">
          Front Face
        </span>
        <CardFront cardNumber={cardNumber} orgName={orgName} />
      </div>
      <div className="flex flex-col items-center w-full">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 print:hidden">
          Reverse Face
        </span>
        <CardBack cardNumber={cardNumber} />
      </div>
    </div>
  );
}
