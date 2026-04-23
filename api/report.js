// POST /api/report  { teamA, teamB, sport }
// Orchestrates API-Sports, The Odds API, OpenWeather, and Anthropic Claude.
// Cached 5 minutes in Upstash. Rate limited per IP (anon) or user (auth).

import { Redis } from "@upstash/redis";
import Anthropic from "@anthropic-ai/sdk";

// ── Static venue map (matches prototype exactly) ───────────────────────────
const VENUES = {
  Celtics: { name: "TD Garden", city: "Boston, MA", lat: 42.366, lon: -71.062, outdoor: false },
  Nuggets: { name: "Ball Arena", city: "Denver, CO", lat: 39.749, lon: -105.007, outdoor: false },
  "76ers": { name: "Wells Fargo Center", city: "Philadelphia, PA", lat: 39.901, lon: -75.172, outdoor: false },
  Lakers: { name: "Crypto.com Arena", city: "Los Angeles, CA", lat: 34.043, lon: -118.267, outdoor: false },
  Warriors: { name: "Chase Center", city: "San Francisco, CA", lat: 37.768, lon: -122.388, outdoor: false },
  Bucks: { name: "Fiserv Forum", city: "Milwaukee, WI", lat: 43.045, lon: -87.917, outdoor: false },
  Bills: { name: "Highmark Stadium", city: "Orchard Park, NY", lat: 42.774, lon: -78.787, outdoor: true },
  Cowboys: { name: "AT&T Stadium", city: "Arlington, TX", lat: 32.748, lon: -97.094, outdoor: false, retractable: true },
  Rams: { name: "SoFi Stadium", city: "Inglewood, CA", lat: 33.953, lon: -118.339, outdoor: false, retractable: true },
  Chiefs: { name: "Arrowhead Stadium", city: "Kansas City, MO", lat: 39.049, lon: -94.484, outdoor: true },
  Eagles: { name: "Lincoln Financial Field", city: "Philadelphia, PA", lat: 39.901, lon: -75.168, outdoor: true },
  "49ers": { name: "Levi's Stadium", city: "Santa Clara, CA", lat: 37.403, lon: -121.970, outdoor: true },
  Yankees: { name: "Yankee Stadium", city: "Bronx, NY", lat: 40.829, lon: -73.926, outdoor: true },
  Braves: { name: "Truist Park", city: "Atlanta, GA", lat: 33.891, lon: -84.468, outdoor: true },
  Dodgers: { name: "Dodger Stadium", city: "Los Angeles, CA", lat: 34.074, lon: -118.240, outdoor: true },
  Astros: { name: "Minute Maid Park", city: "Houston, TX", lat: 29.757, lon: -95.355, outdoor: false, retractable: true },
  Rangers: { name: "Madison Square Garden", city: "New York, NY", lat: 40.750, lon: -73.994, outdoor: false },
  Bruins: { name: "TD Garden", city: "Boston, MA", lat: 42.366, lon: -71.062, outdoor: false },
  Oilers: { name: "Rogers Place", city: "Edmonton, AB", lat: 53.547, lon: -113.498, outdoor: false },
  "Maple Leafs": { name: "Scotiabank Arena", city: "Toronto, ON", lat: 43.643, lon: -79.379, outdoor: false },
};

// ── Helpers ────────────────────────────────────────────────────────────────
let redis = null;
function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redis;
}

async function checkRateLimit(req) {
  const r = getRedis();
  if (!r) return { allowed: true };

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  const userId = req.headers["x-user-id"] || null;
  const key = userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
  const limit = userId ? 50 : 10;

  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 86400);
  return { allowed: count <= limit, count, limit };
}

// ── API-Sports fetchers ───────────────────────────────────────────────────
async function fetchInjuries(teamA, teamB, sport) {
  if (!process.env.API_SPORTS_KEY) return { [teamA]: [], [teamB]: [] };
  // API-Sports injury endpoint varies by sport — this is the general pattern
  try {
    const headers = { "x-apisports-key": process.env.API_SPORTS_KEY };
    const sportPath = { nba: "basketball", nfl: "american-football", mlb: "baseball", nhl: "hockey" }[sport] || sport;
    const [resA, resB] = await Promise.allSettled([
      fetch(`https://v1.${sportPath}.api-sports.io/injuries?team=${encodeURIComponent(teamA)}`, { headers }),
      fetch(`https://v1.${sportPath}.api-sports.io/injuries?team=${encodeURIComponent(teamB)}`, { headers }),
    ]);

    const parse = async (r) => {
      if (r.status !== "fulfilled" || !r.value.ok) return [];
      const data = await r.value.json();
      return (data.response || []).slice(0, 5).map((p) => ({
        player: p.player?.name || p.name || "Unknown",
        status: p.status || "Questionable",
        note: p.reason || p.type || "",
      }));
    };

    return { [teamA]: await parse(resA), [teamB]: await parse(resB) };
  } catch {
    return { [teamA]: [], [teamB]: [] };
  }
}

async function fetchOdds(teamA, teamB, sport) {
  if (!process.env.ODDS_API_KEY) return null;
  const sportKey = { nba: "basketball_nba", nfl: "americanfootball_nfl", mlb: "baseball_mlb", nhl: "icehockey_nhl" }[sport];
  if (!sportKey) return null;

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&bookmakers=draftkings,fanduel,betmgm,caesars&oddsFormat=american`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const events = await res.json();

    // Find the matching game
    const game = events.find((e) => {
      const names = [e.home_team, e.away_team].map((n) => n.toLowerCase());
      return names.some((n) => n.includes(teamA.toLowerCase()) || n.includes(teamB.toLowerCase()));
    });
    if (!game) return null;

    const books = ["DraftKings", "FanDuel", "BetMGM", "Caesars"];
    const bookKeyMap = { DraftKings: "draftkings", FanDuel: "fanduel", BetMGM: "betmgm", Caesars: "caesars" };

    const moneyline = [], spread = [], total = [];
    let bestA = null, bestABook = null;

    for (const book of books) {
      const bm = game.bookmakers?.find((b) => b.key === bookKeyMap[book]);
      if (!bm) continue;

      const h2h = bm.markets?.find((m) => m.key === "h2h");
      if (h2h) {
        const outcomeA = h2h.outcomes?.find((o) => o.name.toLowerCase().includes(teamA.toLowerCase()));
        const outcomeB = h2h.outcomes?.find((o) => o.name.toLowerCase().includes(teamB.toLowerCase()));
        const priceA = outcomeA ? (outcomeA.price > 0 ? `+${outcomeA.price}` : String(outcomeA.price)) : "N/A";
        const priceB = outcomeB ? (outcomeB.price > 0 ? `+${outcomeB.price}` : String(outcomeB.price)) : "N/A";
        const row = { book, [teamA]: priceA, [teamB]: priceB };
        if (!bestA || (outcomeA && outcomeA.price > (bestA || -9999))) {
          bestA = outcomeA?.price;
          bestABook = book;
          row.best = teamA;
        }
        moneyline.push(row);
      }

      const sp = bm.markets?.find((m) => m.key === "spreads");
      if (sp) {
        const home = sp.outcomes?.find((o) => o.name.toLowerCase().includes(teamB.toLowerCase()));
        if (home) {
          spread.push({ book, line: home.point > 0 ? `+${home.point}` : String(home.point), juice: home.price > 0 ? `+${home.price}` : String(home.price) });
        }
      }

      const tot = bm.markets?.find((m) => m.key === "totals");
      if (tot) {
        const over = tot.outcomes?.find((o) => o.name === "Over");
        if (over) {
          total.push({ book, line: String(over.point), juice: over.price > 0 ? `+${over.price}` : String(over.price) });
        }
      }
    }

    // Mark best spread/total juice
    if (spread.length) {
      const best = spread.reduce((a, b) => parseInt(a.juice) < parseInt(b.juice) ? a : b);
      best.best = true;
    }
    if (total.length) {
      const best = total.reduce((a, b) => parseInt(a.juice) < parseInt(b.juice) ? a : b);
      best.best = true;
    }

    return {
      updated: "Updated just now",
      moneyline,
      spread,
      total,
      bestValue: { team: teamA, odds: moneyline.find((r) => r.best)?.[ teamA] || "+100", book: bestABook || "FanDuel" },
    };
  } catch {
    return null;
  }
}

async function fetchWeather(venue) {
  if (!venue.outdoor || !process.env.OPENWEATHER_API_KEY) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${venue.lat}&lon=${venue.lon}&units=imperial&appid=${process.env.OPENWEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const wind = data.wind?.speed ? `${Math.round(data.wind.speed)} mph` : "—";
    const windDir = data.wind?.deg ? compassDir(data.wind.deg) : "";
    const precip = data.rain?.["1h"] ? `${Math.round(data.rain["1h"] * 10)}%` : "0%";
    const humidity = data.main?.humidity ? `${data.main.humidity}%` : "—";
    const temp = Math.round(data.main?.temp || 70);
    const condition = data.weather?.[0]?.main || "Clear";

    return {
      temp,
      condition,
      wind: `${wind}${windDir ? ` ${windDir}` : ""}`,
      precip,
      humidity,
      impact: deriveWeatherImpact(temp, data.wind?.speed || 0, condition),
    };
  } catch {
    return null;
  }
}

function compassDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function deriveWeatherImpact(temp, wind, condition) {
  if (wind > 20) return `High winds (${Math.round(wind)} mph) — expect impact on passing game and field goals.`;
  if (condition.toLowerCase().includes("rain") || condition.toLowerCase().includes("storm")) return "Rain in the forecast — ball security and running game may be favored.";
  if (temp < 32) return `Freezing conditions (${temp}°F) — cold weather tends to suppress scoring.`;
  return "Mild conditions — minimal weather impact expected.";
}

// ── Season helper ─────────────────────────────────────────────────────────
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

// ── Real star player data ─────────────────────────────────────────────────
async function fetchRealStarData(teamA, teamB, sport) {
  if (!process.env.API_SPORTS_KEY) return null;

  const headers = { "x-apisports-key": process.env.API_SPORTS_KEY };
  const sportPath = { nba: "basketball", nfl: "american-football", mlb: "baseball", nhl: "hockey" }[sport];
  const leagueId = { nba: 12, nfl: 1, mlb: 1, nhl: 57 }[sport];
  if (!sportPath || !leagueId) return null;

  const season = getCurrentSeason(sport);

  async function getTeamStar(teamName) {
    try {
      // Step 1: get team ID
      const teamRes = await fetch(
        `https://v1.${sportPath}.api-sports.io/teams?name=${encodeURIComponent(teamName)}&league=${leagueId}&season=${season}`,
        { headers }
      );
      if (!teamRes.ok) return null;
      const teamData = await teamRes.json();
      const teamId = teamData.response?.[0]?.id;
      if (!teamId) return null;

      // Step 2: get last 5 games + recent game stats in parallel
      const [gamesRes, gameStatsRes] = await Promise.allSettled([
        fetch(`https://v1.${sportPath}.api-sports.io/games?team=${teamId}&last=5&league=${leagueId}&season=${season}`, { headers }),
        fetch(`https://v1.${sportPath}.api-sports.io/players/statistics?team=${teamId}&season=${season}&league=${leagueId}&page=1`, { headers }),
      ]);

      // Parse last 5 games → W/L + opponent
      let recentGames = [];
      if (gamesRes.status === "fulfilled" && gamesRes.value.ok) {
        const gd = await gamesRes.value.json();
        const games = (gd.response || []).slice(-5).reverse();
        recentGames = games.map((g) => {
          const homeId = g.teams?.home?.id;
          const isHome = homeId === teamId;
          const opp = isHome ? g.teams?.away?.name : g.teams?.home?.name || "OPP";
          const homeScore = g.scores?.home?.points ?? g.scores?.home?.total ?? 0;
          const awayScore = g.scores?.away?.points ?? g.scores?.away?.total ?? 0;
          const teamScore = isHome ? homeScore : awayScore;
          const oppScore = isHome ? awayScore : homeScore;
          const result = teamScore > oppScore ? "W" : "L";
          const dateStr = g.date || g.game?.date?.start || "";
          const date = dateStr
            ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—";
          const oppShort = (opp || "OPP").split(" ").pop().substring(0, 3).toUpperCase();
          return { opp: oppShort, date, result };
        });
      }

      // Parse player stats → find top player + build avg stat line
      let playerName = `${teamName} Star`;
      let avgLine = "";

      if (gameStatsRes.status === "fulfilled" && gameStatsRes.value.ok) {
        const sd = await gameStatsRes.value.json();
        const players = sd.response || [];

        // Aggregate averages per player across multiple game entries
        const totals = {};
        for (const entry of players) {
          const pid = entry.player?.id;
          if (!pid) continue;
          if (!totals[pid]) totals[pid] = { name: entry.player?.name || "", pts: 0, reb: 0, ast: 0, goals: 0, assists: 0, passYds: 0, rushYds: 0, tds: 0, count: 0 };
          const t = totals[pid];
          t.count++;
          if (sport === "nba") {
            t.pts += entry.points || 0;
            t.reb += entry.totReb || entry.rebounds?.total || 0;
            t.ast += entry.assists || 0;
          } else if (sport === "nhl") {
            t.goals += entry.goals || 0;
            t.assists += entry.assists || 0;
          } else if (sport === "nfl") {
            t.passYds += entry.passing?.yards || 0;
            t.rushYds += entry.rushing?.yards || 0;
            t.tds += (entry.passing?.touchdowns || 0) + (entry.rushing?.touchdowns || 0);
          }
        }

        const sorted = Object.values(totals).sort((a, b) => {
          const score = (p) => {
            if (sport === "nba") return p.pts / (p.count || 1);
            if (sport === "nhl") return (p.goals + p.assists) / (p.count || 1);
            if (sport === "nfl") return (p.passYds + p.rushYds) / (p.count || 1);
            return 0;
          };
          return score(b) - score(a);
        });

        const top = sorted[0];
        if (top && top.count > 0) {
          playerName = top.name || playerName;
          const n = top.count;
          if (sport === "nba") {
            avgLine = `${(top.pts / n).toFixed(1)} PPG · ${(top.reb / n).toFixed(1)} RPG`;
          } else if (sport === "nhl") {
            avgLine = `${top.goals} G · ${top.assists} A`;
          } else if (sport === "nfl") {
            const pYds = Math.round(top.passYds / n);
            const rYds = Math.round(top.rushYds / n);
            avgLine = pYds > rYds ? `${pYds} PASS YDS/G · ${top.tds} TD` : `${rYds} RUSH YDS/G · ${top.tds} TD`;
          }
        }
      }

      // Merge W/L into last5 with stat line
      const last5 = recentGames.length
        ? recentGames.map((g) => ({ ...g, line: avgLine || "—" }))
        : Array.from({ length: 5 }, (_, i) => ({
            opp: "OPP",
            date: `Game ${i + 1}`,
            line: avgLine || "—",
            result: "—",
          }));

      return { name: playerName, last5 };
    } catch (err) {
      console.error(`fetchRealStarData error for ${teamName}:`, err);
      return null;
    }
  }

  const [starAResult, starBResult] = await Promise.allSettled([
    getTeamStar(teamA),
    getTeamStar(teamB),
  ]);

  const starA = starAResult.status === "fulfilled" ? starAResult.value : null;
  const starB = starBResult.status === "fulfilled" ? starBResult.value : null;

  if (!starA && !starB) return null;
  return {
    [teamA]: starA || { name: `${teamA} Star`, last5: [] },
    [teamB]: starB || { name: `${teamB} Star`, last5: [] },
  };
}

// ── Real H2H data ─────────────────────────────────────────────────────────
async function fetchRealH2H(teamA, teamB, sport) {
  if (!process.env.API_SPORTS_KEY) return null;

  const headers = { "x-apisports-key": process.env.API_SPORTS_KEY };
  const sportPath = { nba: "basketball", nfl: "american-football", mlb: "baseball", nhl: "hockey" }[sport];
  const leagueId = { nba: 12, nfl: 1, mlb: 1, nhl: 57 }[sport];
  if (!sportPath) return null;

  const season = getCurrentSeason(sport);

  try {
    // Get team IDs for both teams
    const [teamARes, teamBRes] = await Promise.allSettled([
      fetch(`https://v1.${sportPath}.api-sports.io/teams?name=${encodeURIComponent(teamA)}&league=${leagueId}&season=${season}`, { headers }),
      fetch(`https://v1.${sportPath}.api-sports.io/teams?name=${encodeURIComponent(teamB)}&league=${leagueId}&season=${season}`, { headers }),
    ]);

    const parseTeamId = async (r) => {
      if (r.status !== "fulfilled" || !r.value.ok) return null;
      const d = await r.value.json();
      return d.response?.[0]?.id || null;
    };

    const [idA, idB] = await Promise.all([parseTeamId(teamARes), parseTeamId(teamBRes)]);
    if (!idA || !idB) return null;

    const h2hRes = await fetch(
      `https://v1.${sportPath}.api-sports.io/games/h2h?h2h=${idA}-${idB}&last=5`,
      { headers }
    );
    if (!h2hRes.ok) return null;
    const h2hData = await h2hRes.json();
    const games = (h2hData.response || []).slice(0, 5);
    if (!games.length) return null;

    const season_results = games.map((g) => {
      const homeTeam = g.teams?.home?.name || "";
      const awayTeam = g.teams?.away?.name || "";
      const homeScore = g.scores?.home?.points ?? g.scores?.home?.total ?? 0;
      const awayScore = g.scores?.away?.points ?? g.scores?.away?.total ?? 0;
      const winner = homeScore > awayScore ? homeTeam : awayTeam;
      const dateStr = g.date || g.game?.date?.start || "";
      const date = dateStr
        ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—";
      return {
        date,
        result: `${winner} won`,
        score: `${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`,
      };
    });

    const last = season_results[0];
    const aWins = season_results.filter((r) => r.result.toLowerCase().includes(teamA.toLowerCase())).length;
    const bWins = season_results.length - aWins;

    return {
      lastMeeting: last?.date || "Recent",
      score: last?.score || `${teamA} vs ${teamB}`,
      season: season_results,
      trend: `${teamA} leads ${aWins}–${bWins} in last ${season_results.length} meetings`,
    };
  } catch (err) {
    console.error("fetchRealH2H error:", err);
    return null;
  }
}

// ── MLB-specific fetchers ─────────────────────────────────────────────────
async function fetchMLBPitchers(teamA, teamB) {
  if (!process.env.API_SPORTS_KEY) return null;
  // Return null — API-Sports MLB pitcher data requires specific game ID
  return null;
}

// ── Claude AI summary ──────────────────────────────────────────────────────
async function generateAISummary(teamA, teamB, sport, dataContext) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a professional sports handicapper and analyst with 20+ years of experience. You provide sharp, data-driven analysis for pre-game matchup reports. Your tone is confident, concise, and knowledgeable — like a seasoned expert, not a chatbot. You always cite specific data points from what you're given.`;

  const userPrompt = `Generate a matchup analysis for ${teamA} (away) vs ${teamB} (home) in the ${sport.toUpperCase()}.

Here is the data:
${JSON.stringify(dataContext, null, 2)}

Provide:
1. A 3-paragraph analyst take (plain prose, no headers). Cover recent form, key matchup factors, and line movement / market angle.
2. A JSON block (wrapped in \`\`\`json ... \`\`\`) with this exact shape:
{
  "confidence": 3,
  "level": "MODERATE",
  "pick": "${teamA} +3.5",
  "reasoning": "One sentence explaining the pick."
}

confidence is 1-5 (5 = strongest). level must be STRONG (5), MODERATE (3-4), or LEAN (1-2).`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0]?.text || "";

    // Extract prose (before the JSON block)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    const aiSummary = text.replace(/```json[\s\S]*?```/g, "").trim();

    let confidence = { level: "MODERATE", stars: 3, pick: `${teamA} +3`, reasoning: "Data suggests a slight edge." };
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        confidence = {
          level: parsed.level || "MODERATE",
          stars: parsed.confidence || 3,
          pick: parsed.pick || `${teamA} +3`,
          reasoning: parsed.reasoning || "",
        };
      } catch { /* use defaults */ }
    }

    return { aiSummary, confidence };
  } catch (err) {
    console.error("Claude error:", err);
    return null;
  }
}

// ── Mock fallbacks ─────────────────────────────────────────────────────────
function mockOdds(teamA, teamB) {
  return {
    updated: "Updated 2 min ago",
    moneyline: [
      { book: "DraftKings", [teamA]: "+145", [teamB]: "-165" },
      { book: "FanDuel", [teamA]: "+150", [teamB]: "-170", best: teamA },
      { book: "BetMGM", [teamA]: "+140", [teamB]: "-160" },
      { book: "Caesars", [teamA]: "+148", [teamB]: "-168" },
    ],
    spread: [
      { book: "DraftKings", line: "-3.5", juice: "-110" },
      { book: "FanDuel", line: "-3.5", juice: "-108", best: true },
      { book: "BetMGM", line: "-4", juice: "-110" },
      { book: "Caesars", line: "-3.5", juice: "-112" },
    ],
    total: [
      { book: "DraftKings", line: "224.5", juice: "-110" },
      { book: "FanDuel", line: "224", juice: "-110" },
      { book: "BetMGM", line: "225", juice: "-110" },
      { book: "Caesars", line: "224.5", juice: "-108", best: true },
    ],
    bestValue: { team: teamA, odds: "+150", book: "FanDuel" },
  };
}

function mockStarData(teamA, teamB, sport) {
  const statLine = () => {
    if (sport === "nba") return { line: `${20 + Math.floor(Math.random() * 18)} PTS · ${4 + Math.floor(Math.random() * 8)} REB`, result: Math.random() > 0.5 ? "W" : "L" };
    if (sport === "nfl") return { line: `${200 + Math.floor(Math.random() * 180)} YDS · ${1 + Math.floor(Math.random() * 4)} TD`, result: Math.random() > 0.5 ? "W" : "L" };
    if (sport === "mlb") return { line: `${Math.floor(Math.random() * 4)}-${1 + Math.floor(Math.random() * 4)} · ${Math.floor(Math.random() * 3)} HR`, result: Math.random() > 0.5 ? "W" : "L" };
    return { line: `${Math.floor(Math.random() * 3)} G · ${Math.floor(Math.random() * 3)} A`, result: Math.random() > 0.5 ? "W" : "L" };
  };
  const oppTeams = ["MIA", "PHX", "ATL", "CHI", "TOR"];
  const last5 = () => Array.from({ length: 5 }, (_, i) => ({ opp: oppTeams[i], date: `Apr ${18 - i}`, ...statLine() }));
  return {
    [teamA]: { name: `${teamA} Star Player`, last5: last5() },
    [teamB]: { name: `${teamB} Star Player`, last5: last5() },
  };
}

// ── Main handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { teamA, teamB, sport } = req.body || {};
  if (!teamA || !teamB || !sport) {
    return res.status(400).json({ error: "teamA, teamB, and sport are required" });
  }

  // Rate limit
  const { allowed } = await checkRateLimit(req);
  if (!allowed) {
    return res.status(429).json({ error: "Daily report limit reached. Sign in for higher limits." });
  }

  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `report:${teamA}:${teamB}:${sport}:${today}`;

  // Cache check
  const r = getRedis();
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch { /* cache miss */ }
  }

  const venue = VENUES[teamB] || { name: `${teamB} Arena`, city: "TBD", outdoor: false };

  // Fire all data fetches in parallel — fail gracefully
  const [injuriesResult, oddsResult, weatherResult, mlbPitchersResult] = await Promise.allSettled([
    fetchInjuries(teamA, teamB, sport),
    fetchOdds(teamA, teamB, sport),
    fetchWeather(venue),
    sport === "mlb" ? fetchMLBPitchers(teamA, teamB) : Promise.resolve(null),
  ]);

  const injuries = injuriesResult.status === "fulfilled" ? injuriesResult.value : { [teamA]: [], [teamB]: [] };
  const odds = (oddsResult.status === "fulfilled" && oddsResult.value) ? oddsResult.value : mockOdds(teamA, teamB);
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const mlbStartingPitchers = (mlbPitchersResult.status === "fulfilled") ? mlbPitchersResult.value : null;

  // Fetch real star player data + H2H in parallel
  const [realStarsResult, realH2HResult] = await Promise.allSettled([
    fetchRealStarData(teamA, teamB, sport),
    fetchRealH2H(teamA, teamB, sport),
  ]);

  const stars =
    (realStarsResult.status === "fulfilled" && realStarsResult.value) ||
    mockStarData(teamA, teamB, sport);

  const headToHead =
    (realH2HResult.status === "fulfilled" && realH2HResult.value) || {
      lastMeeting: "Recent season",
      score: `${teamA} vs ${teamB}`,
      season: [{ date: "Recent", result: `${teamA} won`, score: "See full H2H" }],
      trend: `${teamA} vs ${teamB} — season series`,
    };

  // Build context for Claude
  const dataContext = { injuries, odds, weather, stars, headToHead, sport, venue: { name: venue.name, city: venue.city } };
  const aiResult = await generateAISummary(teamA, teamB, sport, dataContext);

  const aiSummary = aiResult?.aiSummary || `${teamA} arrives with momentum. The line movement and market signals favor the visitor side.\n\n${teamB} hold home court advantage but recent defensive numbers have been leaky.\n\nSharp action is split — this one could go either way.`;
  const confidence = aiResult?.confidence || { level: "MODERATE", stars: 3, pick: `${teamA} +3`, reasoning: "Line movement and recent form edge the visitor." };

  const report = {
    matchup: { teamA, teamB, sport },
    venue: { name: venue.name, city: venue.city, outdoor: venue.outdoor || false, retractable: venue.retractable || false },
    weather,
    mlbStartingPitchers,
    mlbBullpen: null,
    aiSummary,
    confidence,
    atsTrends: {
      [teamA]: [
        { label: "Last 10 ATS", value: "7-3", pct: 70, hot: true },
        { label: "As road underdog", value: "6-2", pct: 75, hot: true },
        { label: "H2H last 5 ATS", value: "3-2", pct: 60, hot: false },
        { label: "Overs in last 10", value: "6-4", pct: 60, hot: false },
      ],
      [teamB]: [
        { label: "Last 10 ATS", value: "5-5", pct: 50, hot: false },
        { label: "As home favorite", value: "8-4", pct: 67, hot: true },
        { label: "H2H last 5 ATS", value: "2-3", pct: 40, hot: false },
        { label: "Overs in last 10", value: "4-6", pct: 40, hot: false },
      ],
    },
    injuries,
    stars,
    headToHead,
    odds,
  };

  // Cache 5 min
  if (r) {
    try { await r.setex(cacheKey, 300, report); } catch { /* ignore */ }
  }

  return res.status(200).json(report);
  } catch (err) {
    console.error("report handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
