import { X, Download } from "lucide-react";
import ShareableImage from "./ShareableImage";

export default function ShareModal({ report, onClose }) {
  const handleDownload = async () => {
    // Use the /api/share-image endpoint to get a real PNG
    const params = new URLSearchParams({
      teamA: report.matchup.teamA,
      teamB: report.matchup.teamB,
      pick: report.confidence.pick,
      stars: report.confidence.stars,
      level: report.confidence.level,
      odds: report.odds.bestValue.odds,
      book: report.odds.bestValue.book,
    });
    const url = `/api/share-image?${params}`;

    try {
      // Try native share sheet first
      if (navigator.share) {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const file = new File([blob], "matchup.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "The Matchup" });
        return;
      }
    } catch {
      // fall through to download
    }

    // Fallback: direct download
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchup-${report.matchup.teamA}-${report.matchup.teamB}.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-semibold mb-1">
              Share
            </div>
            <h3 className="font-display text-xl text-black">Ready to post</h3>
          </div>
          <button
            onClick={onClose}
            className="text-black/40 hover:text-black p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Image preview */}
        <div className="flex justify-center mb-5 bg-black/5 rounded-2xl p-4 overflow-hidden">
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-320px" }}>
            <ShareableImage report={report} />
          </div>
        </div>

        {/* Share buttons */}
        <div className="space-y-2">
          <button
            onClick={handleDownload}
            className="w-full bg-emerald-500 text-white rounded-xl py-3 font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Download Image
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button className="bg-black/5 hover:bg-black/10 text-black rounded-xl py-2.5 text-sm font-medium transition-colors">
              Instagram
            </button>
            <button className="bg-black/5 hover:bg-black/10 text-black rounded-xl py-2.5 text-sm font-medium transition-colors">
              Twitter / X
            </button>
            <button className="bg-black/5 hover:bg-black/10 text-black rounded-xl py-2.5 text-sm font-medium transition-colors">
              More
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-black/50 italic text-center">
          Image dimensions: 1080 × 1920 (Instagram Stories / TikTok / Reels)
        </div>
      </div>
    </div>
  );
}
