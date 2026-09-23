"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel,
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const resolvedCopiedLabel = copiedLabel ?? "Copied!";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-all duration-200 shadow-xs active:scale-95 ${
        copied
          ? "bg-emerald-700 text-white ring-2 ring-emerald-400/40"
          : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      } ${className}`}
    >
      {copied ? (
        <>
          <span className="text-sm">✓</span> {resolvedCopiedLabel}
        </>
      ) : (
        <>
          <span>📋</span> {label}
        </>
      )}
    </button>
  );
}
