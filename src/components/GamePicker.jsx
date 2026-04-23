import { useState, useEffect } from "react";
import { Calendar, Search, ChevronRight } from "lucide-react";

const SPORTS = [
  { id: "nba", name: "NBA" },
  { id: "nfl", name: "NFL" },
  { id: "mlb", name: "MLB" },
  { id: "nhl", name: "NHL" },
];

export default function GamePicker({ sport, setSport, teamA, setTeamA, teamB, setTeamB, onGenerate, loading }) {
  const [upcoming, setUpcoming] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      setGamesLoading(true);
      try {
        const res = await fetch(`/api/upcoming-games?sport=${sport}`);
        const data = await res.json();
        setUpcoming(data.games || []);
      } catch {
        setUpcoming([]);
      } finally {
        setGamesLoading(false);
      }
    };
    fetchGames();
  }, [sport]);

  const handlePickGame = (g) => {
    setTeamA(g.away);
    setTeamB(g.home);
    onGenerate(g.away, g.home, sport);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (teamA.trim() && teamB.trim()) {
      onGenerate(teamA.trim(), teamB.trim(), sport);
    }
  };

  return (
    <>
      {/* Sport selector */}
      <section className="pb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-4 font-semibold">
          Select sport
        </div>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSport(s.id); }}
              className={`px-6 py-3 rounded-full text-sm font-bold tracking-wide transition-all border ${
                sport === s.id
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "text-black border-black/15 hover:border-black/40 hover:bg-black/5"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {/* Upcoming games + manual input */}
      <section className="pb-16 grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-emerald-600" />
            <div className="text-xs uppercase tracking-[0.2em] text-black/70 font-semibold">
              Upcoming {SPORTS.find((s) => s.id === sport)?.name} Games
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden bg-white border border-black/10 shadow-sm">
            {gamesLoading ? (
              <div className="p-5 text-sm text-black/50 italic">Loading games…</div>
            ) : upcoming.length === 0 ? (
              <div className="p-5 text-sm text-black/50 italic">No games available.</div>
            ) : (
              upcoming.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => handlePickGame(g)}
                  className={`group w-full text-left p-5 hover:bg-emerald-50/50 transition-colors flex items-center justify-between ${
                    i !== upcoming.length - 1 ? "border-b border-black/[0.08]" : ""
                  }`}
                >
                  <div>
                    <div className="font-display text-xl leading-tight text-black">
                      {g.away} <span className="text-black/40">vs</span> {g.home}
                    </div>
                    <div className="text-sm text-black/60 mt-1">{g.time}</div>
                  </div>
                  <ChevronRight size={18} className="text-black/30 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Search size={14} className="text-emerald-600" />
            <div className="text-xs uppercase tracking-[0.2em] text-black/70 font-semibold">
              Or type teams
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              placeholder="Away team"
              style={{ fontSize: 16 }}
              className="w-full bg-white border border-black/15 rounded-xl px-4 py-3.5 text-black placeholder:text-black/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
            />
            <input
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              placeholder="Home team"
              style={{ fontSize: 16 }}
              className="w-full bg-white border border-black/15 rounded-xl px-4 py-3.5 text-black placeholder:text-black/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!teamA.trim() || !teamB.trim() || loading}
              className="w-full bg-emerald-500 text-white rounded-xl py-3.5 text-base font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {loading ? "Generating…" : "Generate report"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
