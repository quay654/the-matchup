import { Swords } from "lucide-react";
import ConfidenceStars from "./ConfidenceStars";

export default function ShareableImage({ report }) {
  return (
    <div
      className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-8 flex flex-col"
      style={{ width: 360, height: 640, fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Swords size={16} strokeWidth={2.5} />
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>
          The Matchup
        </span>
      </div>

      {/* Eyebrow */}
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-semibold mb-3">
        AI Analyst Pick
      </div>

      {/* Confidence badge */}
      <div className="inline-flex self-start items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full mb-5">
        <ConfidenceStars count={report.confidence.stars} size={12} />
        <span className="text-[11px] font-bold tracking-widest uppercase">
          {report.confidence.level}
        </span>
      </div>

      {/* The pick — hero */}
      <div className="mb-2 min-w-0">
        <div
          style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 400, fontStyle: "italic" }}
          className="text-white/80"
        >
          The pick
        </div>
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: report.confidence.pick?.length > 16 ? 40 : 56,
            fontWeight: 600,
            lineHeight: 1.05,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
          className="mt-1"
        >
          {report.confidence.pick}
        </div>
      </div>

      {/* Matchup line */}
      <div className="mt-6 pt-6 border-t border-white/30 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-semibold mb-2">
          Matchup
        </div>
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: (report.matchup.teamA + report.matchup.teamB).length > 24 ? 16 : 22,
            fontWeight: 500,
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {report.matchup.teamA}
          <span className="text-white/60 mx-2" style={{ fontStyle: "italic", fontWeight: 400 }}>vs</span>
          {report.matchup.teamB}
        </div>
      </div>

      {/* Best value */}
      <div className="mt-5 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-semibold mb-1">
          Best price
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600 }}>
            {report.odds?.bestValue?.odds}
          </span>
          <span className="text-sm text-white/80 truncate">on {report.odds?.bestValue?.book}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="pt-4 border-t border-white/30 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-semibold">
          thematchup.app
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">
          Full report ↗
        </div>
      </div>
    </div>
  );
}
