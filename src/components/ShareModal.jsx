import { useState } from "react";
import { X, Download, Share } from "lucide-react";
import ShareableImage from "./ShareableImage";

async function getShareImagePng(params) {
  // Fetch the SVG from the API
  const url = `/api/share-image?${params}`;
  const resp = await fetch(url);
  const svgText = await resp.text();

  // Draw SVG onto canvas and export as PNG
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Use half resolution (540x960) to keep MMS size reasonable
      const canvas = document.createElement("canvas");
      canvas.width = 540;
      canvas.height = 960;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 540, 960);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      }, "image/png");
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export default function ShareModal({ report, onClose }) {
  const [sharing, setSharing] = useState(false);

  const buildParams = () =>
    new URLSearchParams({
      teamA: report.matchup.teamA,
      teamB: report.matchup.teamB,
      pick: report.confidence.pick,
      stars: report.confidence.stars,
      level: report.confidence.level,
      odds: report.odds?.bestValue?.odds || "+100",
      book: report.odds?.bestValue?.book || "FanDuel",
    }).toString();

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await getShareImagePng(buildParams());
      const file = new File([blob], `matchup-${report.matchup.teamA}-${report.matchup.teamB}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${report.matchup.teamA} vs ${report.matchup.teamB}`,
          text: `${report.confidence.pick} — The Matchup`,
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        // User cancelled — that's fine. Otherwise try download fallback.
        const url = `/api/share-image?${buildParams()}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = `matchup-${report.matchup.teamA}-${report.matchup.teamB}.png`;
        a.click();
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async () => {
    setSharing(true);
    try {
      const blob = await getShareImagePng(buildParams());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matchup-${report.matchup.teamA}-${report.matchup.teamB}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = `/api/share-image?${buildParams()}`;
      a.download = `matchup-${report.matchup.teamA}-${report.matchup.teamB}.png`;
      a.click();
    } finally {
      setSharing(false);
    }
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
          <button onClick={onClose} className="text-black/40 hover:text-black p-1">
            <X size={20} />
          </button>
        </div>

        {/* Image preview */}
        <div className="flex justify-center mb-5 bg-black/5 rounded-2xl p-4 overflow-hidden">
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{ transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-320px" }}
          >
            <ShareableImage report={report} />
          </div>
        </div>

        {/* Share buttons */}
        <div className="space-y-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full bg-emerald-500 text-white rounded-xl py-3.5 font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Share size={16} />
            {sharing ? "Preparing…" : "Share Image"}
          </button>
          <button
            onClick={handleDownload}
            disabled={sharing}
            className="w-full bg-black/5 hover:bg-black/10 text-black rounded-xl py-3.5 font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <div className="mt-4 text-xs text-black/40 italic text-center">
          Tap Share Image to send via text, Instagram, or any app
        </div>
      </div>
    </div>
  );
}
