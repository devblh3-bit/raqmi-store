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
};

export function ProductArt({ id, size = 56 }: { id: string; size?: number }) {
  const g = gradients[id] ?? "from-zinc-700 via-zinc-800 to-zinc-900";
  return (
    <div
      className={`bg-gradient-to-br ${g} flex items-center justify-center rounded-2xl text-white/90 font-black tracking-tight shadow-sm ring-1 ring-black/5`}
      style={{ width: size, height: size, fontSize: size * 0.28 }}
      aria-hidden
    >
      {id.slice(0, 2).toUpperCase()}
    </div>
  );
}
