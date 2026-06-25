"use client";

import React from "react";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined") {
          window.print();
        }
      }}
      className="bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2 px-4 rounded flex items-center gap-2 transition-colors cursor-pointer print:hidden"
    >
      <Printer className="w-4 h-4" />
      Print Pass
    </button>
  );
}
