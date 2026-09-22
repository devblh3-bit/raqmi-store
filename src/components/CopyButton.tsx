"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all duration-200 active:scale-95 ${
        copied
          ? "bg-emerald-600 text-white"
          : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500 hover:text-white dark:text-emerald-200"
      } ${className}`}
    >
      {copied ? (
        <>
          <span>✓</span> Copied!
        </>
      ) : (
        <>
          <span>📋</span> {label}
        </>
      )}
    </button>
  );
}
