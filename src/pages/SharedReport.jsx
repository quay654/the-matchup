import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Swords } from "lucide-react";
import ReportView from "../components/ReportView";

export default function SharedReport() {
  const { slug } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/report/${slug}`);
        if (!res.ok) throw new Error("Report not found");
        const data = await res.json();
        setReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [slug]);

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .font-italic { font-family: 'Fraunces', serif; font-style: italic; font-weight: 400; }
      `}</style>

      <header className="border-b border-black/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Swords size={18} className="text-black" strokeWidth={2} />
            <span className="font-display text-xl text-black">The Matchup</span>
          </a>
          <div className="text-xs uppercase tracking-[0.2em] text-black/50 font-semibold">Shared report</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        {loading && (
          <div className="pt-24 pb-24 text-center">
            <div className="inline-flex items-center gap-3 text-black/60">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Loading report…
            </div>
          </div>
        )}

        {error && (
          <div className="pt-24 pb-24 text-center">
            <div className="text-black/60">{error}</div>
            <a href="/" className="mt-4 inline-block text-emerald-600 hover:underline">
              Generate a new report →
            </a>
          </div>
        )}

        {report && !loading && (
          <>
            <div className="border-t border-black/10 pt-16">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-semibold mb-8">
                {report.matchup.teamA} vs {report.matchup.teamB} · {report.matchup.sport.toUpperCase()}
              </div>
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
            </div>
            <ReportView report={report} />
          </>
        )}
      </main>
    </div>
  );
}
