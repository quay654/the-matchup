// GET /api/upcoming-games?sport=nba
// Returns today's games for the given sport from API-Sports.
// Falls back to an empty array if the API key isn't set or the call fails.
// Cached 10 minutes in Upstash Redis.

import { Redis } from "@upstash/redis";

const SPORT_LEAGUE_MAP = {
  nba: { sport: "basketball", league: 12 },   // NBA
  nfl: { sport: "american-football", league: 1 },  // NFL
  mlb: { sport: "baseball", league: 1 },       // MLB
  nhl: { sport: "hockey", league: 57 },        // NHL
};

// Normalize API-Sports game data into our shape
function normalizeGame(game, sport) {
  const home = game.teams?.home?.name || game.home_team || "";
  const away = game.teams?.away?.name || game.away_team || "";
  const dateStr = game.date || game.game?.date?.start || "";
  const date = dateStr ? new Date(dateStr) : null;
  const time = date
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })
    : "TBD";

  return {
    id: String(game.id || game.game?.id || Math.random()),
    away,
    home,
    time,
  };
}

let redis = null;
function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export default async function handler(req, res) {
  const sport = (req.query.sport || "nba").toLowerCase();
  const league = SPORT_LEAGUE_MAP[sport];

  if (!league) {
    return res.status(400).json({ error: "Unknown sport" });
  }

  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `upcoming:${sport}:${today}`;

  // Try cache first
  const r = getRedis();
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) {
        return res.status(200).json({ games: cached, cached: true });
      }
    } catch {
      // cache miss — continue
    }
  }

  // No API key — return empty (client falls back to mock)
  if (!process.env.API_SPORTS_KEY) {
    return res.status(200).json({ games: [], cached: false, note: "No API key configured" });
  }

  try {
    const url = `https://v1.${league.sport}.api-sports.io/games?league=${league.league}&date=${today}`;
    const apiRes = await fetch(url, {
      headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
    });
    const data = await apiRes.json();
    const games = (data.response || []).map((g) => normalizeGame(g, sport));

    // Cache 10 min
    if (r && games.length > 0) {
      await r.setex(cacheKey, 600, games);
    }

    return res.status(200).json({ games, cached: false });
  } catch (err) {
    console.error("upcoming-games error:", err);
    return res.status(200).json({ games: [], cached: false, error: "Upstream error" });
  }
}
