import { Swords } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Header({ user }) {
  const handleAuth = async () => {
    if (user) {
      await supabase.auth.signOut();
    } else {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    }
  };

  return (
    <header className="border-b border-black/10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Swords size={18} className="text-black" strokeWidth={2} />
          <span className="font-display text-xl text-black">The Matchup</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-black/60 hidden sm:block">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <button
            onClick={handleAuth}
            className="text-sm text-black/60 hover:text-black border border-black/15 hover:border-black/40 rounded-full px-4 py-1.5 transition-colors"
          >
            {user ? "Sign out" : "Sign in"}
          </button>
        </div>
      </div>
    </header>
  );
}
