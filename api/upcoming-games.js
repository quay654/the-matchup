// GET /api/upcoming-games?sport=nba
// Returns games for the next 7 days for the given sport from API-Sports.
// Falls back to an empty array if the API key isn't set or the call fails.
// Cached 30 minutes in Upstash Redis.

import { Redis } from "@upstash/redis";

const SPORT_LEAGUE_MAP = {
  nba: { sport: "basketball", league: 12 },
  nfl: { sport: "american-football", league: 1 },
  mlb: { sport: "baseball", league: 1 },
  nhl: { sport: "hockey", league: 57 },
};

function getCurrentSeason(sport) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (sport === "nba" || sport === "nhl") {
    if (month >= 9) return `${year}-${String(year + 1).slice(-2)}`;
    return `${year - 1}-${String(year).slice(-2)}`;
  }
  return String(year);
}

function toDateString(date) {
  return date.toISOString().split("T")[0];
}

function normalizeGame(game) {
  const home = game.teams?.home?.name || "";
  const away = game.teams?.away?.name || "";
  const dateStr = game.date || game.game?.date?.start || "";
  const date = dateStr ? new Date(dateStr) : null;

  const gameDate = date
    ? date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : "TBD";

  const time = date
    ? date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short",
      })
    : "TBD";

  return {
    id: String(game.id || game.game?.id || Math.random()),
    away,
    home,
    date: gameDate,
    time,
    // raw timestamp for sorting
    ts: date ? date.getTime() : 0,
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

  const today = new Date();
  const todayStr = toDateString(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = toDateString(endDate);

  const cacheKey = `upcoming7:${sport}:${todayStr}`;

  // Try cache first
  const r = getRedis();
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) return res.status(200).json({ games: cached, cached: true });
    } catch {
      // cache miss — continue
    }
  }

  if (!process.env.API_SPORTS_KEY) {
    return res.status(200).json({ games: [], cached: false, note: "No API key configured" });
  }

  try {
    const season = getCurrentSeason(sport);
    const url = `https://v1.${league.sport}.api-sports.io/games?league=${league.league}&season=${season}&from=${todayStr}&to=${endStr}`;
    const apiRes = await fetch(url, {
      headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
    });
    const data = await apiRes.json();

    const games = (data.response || [])
      .map(normalizeGame)
      .sort((a, b) => a.ts - b.ts); // chronological order

    // Cache 30 min
    if (r && games.length > 0) {
      await r.setex(cacheKey, 1800, games);
    }

    return res.status(200).json({ games, cached: false });
  } catch (err) {
    console.error("upcoming-games error:", err);
    return res.status(200).json({ games: [], cached: false, error: "Upstream error" });
  }
}
