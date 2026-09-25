const gradients: Record<string, string> = {
  chatgpt: "from-emerald-700 via-teal-800 to-emerald-900",
  claude: "from-orange-600 via-amber-700 to-orange-800",
  gemini: "from-sky-600 via-blue-700 to-indigo-800",
  spotify: "from-zinc-800 via-zinc-900 to-black",
  netflix: "from-red-700 via-red-800 to-red-950",
  youtube: "from-red-600 via-red-700 to-red-800",
  canva: "from-cyan-600 via-sky-700 to-blue-800",
  notion: "from-zinc-700 via-zinc-800 to-zinc-900",
  nordvpn: "from-sky-700 via-blue-800 to-indigo-900",
  adobe: "from-red-600 via-rose-700 to-red-800",
  microsoft: "from-blue-600 via-blue-700 to-sky-800",
  figma: "from-violet-600 via-purple-700 to-fuchsia-800",
  capcut: "from-slate-900 via-zinc-800 to-neutral-950",
  windows: "from-blue-600 via-sky-600 to-cyan-700",
  vpn: "from-emerald-600 via-teal-700 to-cyan-800",
  gmail: "from-red-600 via-rose-700 to-red-800",
  aws: "from-amber-600 via-orange-600 to-amber-700",
  duolingo: "from-emerald-500 via-green-600 to-lime-600",
  quillbot: "from-green-600 via-emerald-700 to-teal-800",
};

export function ProductArt({ id, size = 56 }: { id: string; size?: number }) {
  const norm = id.toLowerCase();
  const matchedKey = Object.keys(gradients).find((k) => norm.includes(k));
  const g = (matchedKey && gradients[matchedKey]) ?? "from-zinc-700 via-zinc-800 to-zinc-900";
  return (
    <div
      className={`bg-gradient-to-br ${g} flex items-center justify-center rounded-2xl text-white font-black tracking-tight shadow-xs ring-1 ring-black/5 dark:ring-white/10 shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
      aria-hidden
    >
      {id.slice(0, 2).toUpperCase()}
    </div>
  );
}
