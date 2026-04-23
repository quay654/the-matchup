// GET /api/share-image?teamA=Lakers&teamB=Celtics&pick=Lakers+%2B3.5&stars=4&level=STRONG&odds=%2B150&book=FanDuel
// Returns a 1080x1920 PNG of the shareable report card using @vercel/og

export const config = { runtime: "edge" };

import { ImageResponse } from "@vercel/og";

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const teamA = searchParams.get("teamA") || "Away";
  const teamB = searchParams.get("teamB") || "Home";
  const pick = searchParams.get("pick") || teamA;
  const stars = parseInt(searchParams.get("stars") || "3", 10);
  const level = searchParams.get("level") || "MODERATE";
  const odds = searchParams.get("odds") || "+100";
  const book = searchParams.get("book") || "FanDuel";

  const starEmojis = Array.from({ length: 5 }, (_, i) => i < stars ? "★" : "☆").join("");

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 80 }}>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>⚔ The Matchup</div>
        </div>

        {/* Eyebrow */}
        <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7, marginBottom: 24 }}>
          AI Analyst Pick
        </div>

        {/* Confidence */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "16px 32px", alignSelf: "flex-start", marginBottom: 60 }}>
          <span style={{ fontSize: 36, letterSpacing: 4 }}>{starEmojis}</span>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4 }}>{level}</span>
        </div>

        {/* Pick hero */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 28, opacity: 0.8, fontStyle: "italic", marginBottom: 12 }}>The pick</div>
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1.05 }}>{pick}</div>
        </div>

        {/* Matchup */}
        <div style={{ marginTop: 80, paddingTop: 60, borderTop: "2px solid rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7, marginBottom: 20 }}>
            Matchup
          </div>
          <div style={{ fontSize: 64, fontWeight: 500 }}>
            {teamA} <span style={{ opacity: 0.6, fontStyle: "italic" }}>vs</span> {teamB}
          </div>
        </div>

        {/* Best price */}
        <div style={{ marginTop: 60 }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7, marginBottom: 12 }}>
            Best price
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 80, fontWeight: 700 }}>{odds}</span>
            <span style={{ fontSize: 32, opacity: 0.8 }}>on {book}</span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 40, borderTop: "2px solid rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 }}>
            thematchup.app
          </div>
          <div style={{ fontSize: 24, opacity: 0.7 }}>Full report ↗</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
