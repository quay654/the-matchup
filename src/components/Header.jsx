import { Swords } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-black/10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Swords size={18} className="text-black" strokeWidth={2} />
          <span className="font-display text-xl text-black">The Matchup</span>
        </div>
        <div className="text-sm text-black/60 hidden sm:block">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>
    </header>
  );
}
