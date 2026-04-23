// GET /api/share-image?teamA=Lakers&teamB=Celtics&pick=Lakers+%2B3.5&stars=4&level=STRONG&odds=%2B150&book=FanDuel
// Returns a 1080x1920 PNG of the shareable report card using canvas

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const teamA = searchParams.get("teamA") || "Away";
  const teamB = searchParams.get("teamB") || "Home";
  const pick = searchParams.get("pick") || teamA;
  const stars = parseInt(searchParams.get("stars") || "3", 10);
  const level = searchParams.get("level") || "MODERATE";
  const odds = searchParams.get("odds") || "+100";
  const book = searchParams.get("book") || "FanDuel";

  const starFilled = "★".repeat(stars);
  const starEmpty = "☆".repeat(5 - stars);
  const starEmojis = starFilled + starEmpty;

  // Return an SVG as a PNG-like image (Vercel renders SVG inline)
  const svg = `
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981"/>
      <stop offset="100%" style="stop-color:#047857"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1920" fill="url(#bg)"/>

  <!-- Header -->
  <text x="80" y="160" font-family="system-ui, sans-serif" font-size="48" font-weight="700" fill="white" letter-spacing="3">⚔ The Matchup</text>

  <!-- Eyebrow -->
  <text x="80" y="280" font-family="system-ui, sans-serif" font-size="28" fill="rgba(255,255,255,0.7)" letter-spacing="6">AI ANALYST PICK</text>

  <!-- Confidence badge background -->
  <rect x="80" y="320" width="420" height="80" rx="40" fill="rgba(255,255,255,0.2)"/>
  <!-- Stars -->
  <text x="110" y="374" font-family="system-ui, sans-serif" font-size="40" fill="white" letter-spacing="4">${starEmojis}</text>
  <!-- Level -->
  <text x="310" y="374" font-family="system-ui, sans-serif" font-size="32" font-weight="800" fill="white" letter-spacing="4">${level}</text>

  <!-- "The pick" label -->
  <text x="80" y="520" font-family="system-ui, sans-serif" font-size="32" fill="rgba(255,255,255,0.8)" font-style="italic">The pick</text>

  <!-- Pick hero -->
  <text x="80" y="680" font-family="system-ui, sans-serif" font-size="110" font-weight="700" fill="white">${pick}</text>

  <!-- Divider -->
  <line x1="80" y1="820" x2="1000" y2="820" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>

  <!-- Matchup label -->
  <text x="80" y="890" font-family="system-ui, sans-serif" font-size="26" fill="rgba(255,255,255,0.7)" letter-spacing="6">MATCHUP</text>

  <!-- Matchup teams -->
  <text x="80" y="980" font-family="system-ui, sans-serif" font-size="68" font-weight="500" fill="white">${teamA} vs ${teamB}</text>

  <!-- Best price label -->
  <text x="80" y="1100" font-family="system-ui, sans-serif" font-size="26" fill="rgba(255,255,255,0.7)" letter-spacing="6">BEST PRICE</text>

  <!-- Odds -->
  <text x="80" y="1220" font-family="system-ui, sans-serif" font-size="100" font-weight="700" fill="white">${odds}</text>

  <!-- Book -->
  <text x="80" y="1300" font-family="system-ui, sans-serif" font-size="40" fill="rgba(255,255,255,0.8)">on ${book}</text>

  <!-- Footer divider -->
  <line x1="80" y1="1820" x2="1000" y2="1820" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>

  <!-- Footer left -->
  <text x="80" y="1880" font-family="system-ui, sans-serif" font-size="28" fill="rgba(255,255,255,0.7)" letter-spacing="4">THEMATCHUP.APP</text>

  <!-- Footer right -->
  <text x="900" y="1880" font-family="system-ui, sans-serif" font-size="28" fill="rgba(255,255,255,0.7)">Full report ↗</text>
</svg>`.trim();

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(svg);
}
