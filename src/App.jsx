import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Image as ImageIcon, Share2, Check } from "lucide-react";
import Header from "./components/Header";
import GamePicker from "./components/GamePicker";
import ReportView from "./components/ReportView";
import ShareModal from "./components/ShareModal";
import SharedReport from "./pages/SharedReport";
import { supabase } from "./lib/supabase";
import { buildMockReport } from "./lib/mockData";

function MainApp() {
  const [sport, setSport] = useState("nba");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [report, setReport] = useState(null);
  const reportRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGenerate = async (a, b, s) => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA: a, teamB: b, sport: s }),
      });

      if (res.status === 429) {
        setError("You've hit your daily report limit. Sign in for higher limits.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setReport(data);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      // Fallback to mock data when API isn't wired up yet
      const mock = buildMockReport(a, b, s);
      setReport(mock);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    if (!report) return;
    try {
      const res = await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          teamA: report.matchup.teamA,
          teamB: report.matchup.teamB,
          sport: report.matchup.sport,
        }),
      });
      if (res.ok) {
        const { slug } = await res.json();
        const url = `${window.location.origin}/r/${slug}`;
        await navigator.clipboard?.writeText(url).catch(() => {});
      } else {
        throw new Error("save failed");
      }
    } catch {
      const fallback = `${window.location.origin}/r/${report.matchup.teamA.toLowerCase()}-${report.matchup.teamB.toLowerCase()}-demo`;
      await navigator.clipboard?.writeText(fallback).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-italic { font-family: 'Fraunces', serif; font-style: italic; font-weight: 400; }
      `}</style>

      <Header user={user} />

      <main className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-16 pb-10">
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 mb-4 font-semibold">
            Sports Research · AI-Powered
          </div>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mb-6 max-w-3xl text-black">
            Build a matchup <span className="font-italic text-emerald-600">report.</span>
          </h1>
          <p className="text-lg text-black/70 max-w-xl leading-relaxed">
            Research any game in seconds. Injuries, recent form, head-to-head history, live odds, and an AI analyst take — all in one report.
          </p>
        </section>

        <GamePicker
          sport={sport}
          setSport={(s) => { setSport(s); setReport(null); }}
          teamA={teamA}
          setTeamA={setTeamA}
          teamB={teamB}
          setTeamB={setTeamB}
          onGenerate={handleGenerate}
          loading={loading}
        />

        {error && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="border-t border-black/10 pt-16 pb-24 text-center">
            <div className="inline-flex items-center gap-3 text-black/60">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Generating report…
            </div>
          </div>
        )}

        {report && !loading && (
          <>
            {/* Report header with share buttons */}
            <div ref={reportRef} className="flex items-center justify-between mb-8 flex-wrap gap-3 border-t border-black/10 pt-16">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-semibold">
                {report.matchup.teamA} vs {report.matchup.teamB} · {report.matchup.sport.toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 text-sm bg-emerald-500 text-white hover:bg-emerald-600 rounded-full px-4 py-2 font-medium transition-colors min-h-[44px]"
                >
                  <ImageIcon size={14} />
                  Share image
                </button>
                <button
                  onClick={handleShareLink}
                  className="flex items-center gap-2 text-sm text-black border border-black/15 hover:border-black/40 rounded-full px-4 py-2 font-medium transition-colors min-h-[44px]"
                >
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  {copied ? "Link copied" : "Share link"}
                </button>
              </div>
            </div>

            {/* Matchup hero */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-12 py-10">
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-2 font-semibold">Away</div>
                <div className="font-display text-4xl md:text-6xl leading-none text-black">{report.matchup.teamA}</div>
              </div>
              <div className="font-italic text-3xl text-black/40">vs</div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-2 font-semibold">Home</div>
                <div className="font-display text-4xl md:text-6xl leading-none text-black">{report.matchup.teamB}</div>
              </div>
            </div>

            <ReportView report={report} />
          </>
        )}
      </main>

      {showShareModal && report && (
        <ShareModal report={report} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/r/:slug" element={<SharedReport />} />
      </Routes>
    </BrowserRouter>
  );
}
