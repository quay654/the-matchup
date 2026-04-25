// GET /api/youtube?teamA=Celtics&teamB=76ers&sport=nba
// Returns the best YouTube highlight video ID for the matchup's recent H2H game.
// Requires YOUTUBE_API_KEY env var (free, Google Cloud Console).
// Results cached in Redis 24 hours — only burns 1 YouTube quota unit per unique matchup per day.

import { Redis } from "@upstash/redis";

let redis = null;
function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redis;
}

const SPORT_LEAGUE = { nba: "NBA", nfl: "NFL", mlb: "MLB", nhl: "NHL" };

export default async function handler(req, res) {
  const { teamA, teamB, sport } = req.query || {};
  if (!teamA || !teamB) return res.status(400).json({ error: "teamA and teamB required" });
  if (!process.env.YOUTUBE_API_KEY) return res.status(200).json({ videoId: null, reason: "no_api_key" });

  const cacheKey = `yt:${sport}:${teamA.toLowerCase()}:${teamB.toLowerCase()}`;
  const r = getRedis();

  // Cache check
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached !== null) return res.status(200).json(cached);
    } catch { /* miss */ }
  }

  const league = SPORT_LEAGUE[sport] || sport?.toUpperCase() || "";
  const year = new Date().getFullYear();
  // Search for the most recent game highlights between these two teams
  const query = `${teamA} vs ${teamB} ${league} highlights ${year}`;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("videoDuration", "medium");     // 4–20 min — real game recaps
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("maxResults", "5");
    url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

    const ytRes = await fetch(url.toString());
    if (!ytRes.ok) {
      const err = await ytRes.json();
      return res.status(200).json({ videoId: null, reason: err?.error?.message || "youtube_error" });
    }

    const data = await ytRes.json();
    const items = data.items || [];

    // Pick the best result — prefer official channels (NBA, NFL, ESPN) if present
    const PRIORITY_CHANNELS = ["nba", "nfl", "mlb", "nhl", "espn", "bleacherreport", "foxsports"];
    let best = items.find((item) =>
      PRIORITY_CHANNELS.some((ch) =>
        (item.snippet?.channelTitle || "").toLowerCase().includes(ch)
      )
    ) || items[0];

    const result = best
      ? {
          videoId: best.id?.videoId || null,
          title: best.snippet?.title || "",
          channel: best.snippet?.channelTitle || "",
          published: best.snippet?.publishedAt?.slice(0, 10) || "",
        }
      : { videoId: null, reason: "no_results" };

    // Cache 24 hours
    if (r) {
      try { await r.setex(cacheKey, 86400, result); } catch { /* ignore */ }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ videoId: null, reason: err.message });
  }
}
