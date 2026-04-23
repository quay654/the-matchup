// GET /api/upcoming-games?sport=nba
// Returns games for the next 7 days using ESPN's public scoreboard API (no key needed).
// Cached 30 minutes in Upstash Redis.

import { Redis } from "@upstash/redis";

const ESPN_SPORT_MAP = {
  nba: { sport: "basketball", league: "nba" },
  nfl: { sport: "americanfootball", league: "nfl" },
  mlb: { sport: "baseball", league: "mlb" },
  nhl: { sport: "hockey", league: "nhl" },
};

function toESPNDate(date) {
  // ESPN uses YYYYMMDD format
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function toDateString(date) {
  return date.toISOString().split("T")[0];
}

function normalizeESPNGame(event) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home");
  const away = comp?.competitors?.find((c) => c.homeAway === "away");

  const homeName = home?.team?.displayName || home?.team?.name || "";
  const awayName = away?.team?.displayName || away?.team?.name || "";

  const dateStr = event.date || "";
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

  const status = event.status?.type?.state || "pre";

  return {
    id: String(event.id || Math.random()),
    away: awayName,
    home: homeName,
    date: gameDate,
    time: status === "in" ? "LIVE" : status === "post" ? "Final" : time,
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
  const espn = ESPN_SPORT_MAP[sport];

  if (!espn) {
    return res.status(400).json({ error: "Unknown sport" });
  }

  const today = new Date();
  const todayStr = toDateString(today);
  const cacheKey = `upcoming7espn:${sport}:${todayStr}`;

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

  try {
    // Fetch next 3 days one day at a time and merge
    const days = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });

    const fetches = days.map((d) => {
      const dateParam = toESPNDate(d);
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}/scoreboard?dates=${dateParam}`;
      return fetch(url).then((r) => r.json()).catch(() => ({ events: [] }));
    });

    const results = await Promise.all(fetches);
    const allEvents = results.flatMap((data) => data.events || []);

    const games = allEvents
      .map(normalizeESPNGame)
      .filter((g) => g.away && g.home)
      .sort((a, b) => a.ts - b.ts);

    // Cache 30 min
    if (r && games.length > 0) {
      try { await r.setex(cacheKey, 1800, games); } catch { /* ignore */ }
    }

    return res.status(200).json({ games, cached: false });
  } catch (err) {
    console.error("upcoming-games error:", err);
    return res.status(200).json({ games: [], cached: false, error: err.message });
  }
}
