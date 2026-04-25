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

  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
    const userId = req.headers["x-user-id"] || null;
    const key = userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
    const limit = userId ? 50 : 10;

    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 86400);
    return { allowed: count <= limit, count, limit };
  } catch {
    // Redis auth failure or connection issue — allow the request
    return { allowed: true };
  }
}

// ── ESPN team ID map (stable IDs, no API key required) ────────────────────
const ESPN_TEAM_IDS = {
  nba: {
    "Atlanta Hawks": 1, "Boston Celtics": 2, "Brooklyn Nets": 17, "Charlotte Hornets": 30,
    "Chicago Bulls": 4, "Cleveland Cavaliers": 5, "Dallas Mavericks": 6, "Denver Nuggets": 7,
    "Detroit Pistons": 8, "Golden State Warriors": 9, "Houston Rockets": 10, "Indiana Pacers": 11,
    "LA Clippers": 12, "Los Angeles Lakers": 13, "Memphis Grizzlies": 29, "Miami Heat": 14,
    "Milwaukee Bucks": 15, "Minnesota Timberwolves": 16, "New Orleans Pelicans": 3,
    "New York Knicks": 18, "Oklahoma City Thunder": 25, "Orlando Magic": 19, "Philadelphia 76ers": 20,
    "Phoenix Suns": 21, "Portland Trail Blazers": 22, "Sacramento Kings": 23, "San Antonio Spurs": 24,
    "Toronto Raptors": 28, "Utah Jazz": 26, "Washington Wizards": 27,
  },
  nfl: {
    "Arizona Cardinals": 22, "Atlanta Falcons": 1, "Baltimore Ravens": 33, "Buffalo Bills": 2,
    "Carolina Panthers": 29, "Chicago Bears": 3, "Cincinnati Bengals": 4, "Cleveland Browns": 5,
    "Dallas Cowboys": 6, "Denver Broncos": 7, "Detroit Lions": 8, "Green Bay Packers": 9,
    "Houston Texans": 34, "Indianapolis Colts": 11, "Jacksonville Jaguars": 30, "Kansas City Chiefs": 12,
    "Las Vegas Raiders": 13, "Los Angeles Chargers": 24, "Los Angeles Rams": 14, "Miami Dolphins": 15,
    "Minnesota Vikings": 16, "New England Patriots": 17, "New Orleans Saints": 18, "New York Giants": 19,
    "New York Jets": 20, "Philadelphia Eagles": 21, "Pittsburgh Steelers": 23, "San Francisco 49ers": 25,
    "Seattle Seahawks": 26, "Tampa Bay Buccaneers": 27, "Tennessee Titans": 10, "Washington Commanders": 28,
  },
  mlb: {
    "Arizona Diamondbacks": 29, "Athletics": 11, "Atlanta Braves": 15, "Baltimore Orioles": 1,
    "Boston Red Sox": 2, "Chicago Cubs": 16, "Chicago White Sox": 4, "Cincinnati Reds": 17,
    "Cleveland Guardians": 5, "Colorado Rockies": 27, "Detroit Tigers": 6, "Houston Astros": 18,
    "Kansas City Royals": 7, "Los Angeles Angels": 3, "Los Angeles Dodgers": 19, "Miami Marlins": 28,
    "Milwaukee Brewers": 8, "Minnesota Twins": 9, "New York Mets": 21, "New York Yankees": 10,
    "Philadelphia Phillies": 22, "Pittsburgh Pirates": 23, "San Diego Padres": 25, "San Francisco Giants": 26,
    "Seattle Mariners": 12, "St. Louis Cardinals": 24, "Tampa Bay Rays": 30, "Texas Rangers": 13,
    "Toronto Blue Jays": 14, "Washington Nationals": 20,
  },
  nhl: {
    "Anaheim Ducks": 25, "Boston Bruins": 1, "Buffalo Sabres": 2, "Calgary Flames": 3,
    "Carolina Hurricanes": 7, "Chicago Blackhawks": 4, "Colorado Avalanche": 17, "Columbus Blue Jackets": 29,
    "Dallas Stars": 9, "Detroit Red Wings": 5, "Edmonton Oilers": 6, "Florida Panthers": 26,
    "Los Angeles Kings": 8, "Minnesota Wild": 30, "Montreal Canadiens": 10, "Nashville Predators": 27,
    "New Jersey Devils": 11, "New York Islanders": 12, "New York Rangers": 13, "Ottawa Senators": 14,
    "Philadelphia Flyers": 15, "Pittsburgh Penguins": 16, "San Jose Sharks": 18, "Seattle Kraken": 124292,
    "St. Louis Blues": 19, "Tampa Bay Lightning": 20, "Toronto Maple Leafs": 21, "Utah Mammoth": 129764,
    "Vancouver Canucks": 22, "Vegas Golden Knights": 37, "Washington Capitals": 23, "Winnipeg Jets": 28,
  },
};

function findESPNTeamId(teamName, sport) {
  const map = ESPN_TEAM_IDS[sport] || {};
  const lc = teamName.toLowerCase();
  for (const [name, id] of Object.entries(map)) {
    if (name.toLowerCase().includes(lc) || lc.includes(name.toLowerCase().split(" ").slice(-1)[0].toLowerCase())) {
      return id;
    }
  }
  return null;
}

// ── ESPN injuries (Bug #2 fix — replaces broken API-Sports call) ──────────
async function fetchInjuries(teamA, teamB, sport) {
  const espn = ESPN_SPORT_MAP[sport];
  if (!espn) return { [teamA]: [], [teamB]: [] };

  const STATUS_MAP = {
    "Out": "Out", "Doubtful": "Doubtful", "Questionable": "Questionable",
    "Probable": "Probable", "Day-To-Day": "Questionable", "IR": "Out",
    "PUP": "Out", "Suspended": "Out",
  };

  async function getInjuries(teamName) {
    try {
      const teamId = findESPNTeamId(teamName, sport);
      if (!teamId) return [];
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}/teams/${teamId}/injuries`;
      const res = await fetchWithTimeout(url);
      const data = await res.json();
      return (data.items || []).slice(0, 6).map((item) => ({
        player: item.athlete?.displayName || "Unknown",
        status: STATUS_MAP[item.status] || item.status || "Questionable",
        note: [item.details?.type, item.details?.side].filter(Boolean).join(" ") || item.type || "",
      }));
    } catch {
      return [];
    }
  }

  const [resA, resB] = await Promise.allSettled([getInjuries(teamA), getInjuries(teamB)]);
  return {
    [teamA]: resA.status === "fulfilled" ? resA.value : [],
    [teamB]: resB.status === "fulfilled" ? resB.value : [],
  };
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

    // Line movement tracking via Redis
    let lineMovement = null;
    if (spread.length) {
      const currentLine = spread[0].line;
      const r = getRedis();
      if (r) {
        try {
          const openKey = `open:spread:${sport}:${teamA.toLowerCase()}:${teamB.toLowerCase()}`;
          const openLine = await r.get(openKey);
          if (!openLine) {
            await r.setex(openKey, 86400, currentLine);
          } else if (openLine !== currentLine) {
            const openNum = parseFloat(openLine);
            const currNum = parseFloat(currentLine);
            const diff = currNum - openNum;
            lineMovement = {
              open: openLine,
              current: currentLine,
              moved: true,
              direction: diff < 0 ? "favored" : "faded",
              diff: Math.abs(diff).toFixed(1),
            };
          }
        } catch { /* ignore Redis errors */ }
      }
    }

    return {
      updated: "Updated just now",
      moneyline,
      spread,
      total,
      lineMovement,
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


// ── ESPN helpers ──────────────────────────────────────────────────────────
const ESPN_SPORT_MAP = {
  nba: { sport: "basketball", league: "nba" },
  nfl: { sport: "americanfootball", league: "nfl" },
  mlb: { sport: "baseball", league: "mlb" },
  nhl: { sport: "hockey", league: "nhl" },
};


function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function espnFindTeam(teamName, espn) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}`;
  const res = await fetchWithTimeout(`${base}/teams?limit=100`);
  const data = await res.json();
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
  const lc = teamName.toLowerCase();
  return teams.find((t) => {
    const d = (t.team?.displayName || "").toLowerCase();
    const n = (t.team?.nickname || "").toLowerCase();
    const s = (t.team?.shortDisplayName || "").toLowerCase();
    const a = (t.team?.abbreviation || "").toLowerCase();
    return d.includes(lc) || lc.includes(n) || lc.includes(s) || lc.includes(a) || n.includes(lc);
  })?.team || null;
}

// ── Franchise star map — used as primary identifier, ESPN provides stat lines ─
const FRANCHISE_STARS = {
  nba: {
    "Atlanta Hawks": "Trae Young", "Boston Celtics": "Jayson Tatum",
    "Brooklyn Nets": "Cam Thomas", "Charlotte Hornets": "LaMelo Ball",
    "Chicago Bulls": "Zach LaVine", "Cleveland Cavaliers": "Donovan Mitchell",
    "Dallas Mavericks": "Luka Doncic", "Denver Nuggets": "Nikola Jokic",
    "Detroit Pistons": "Cade Cunningham", "Golden State Warriors": "Stephen Curry",
    "Houston Rockets": "Alperen Sengun", "Indiana Pacers": "Tyrese Haliburton",
    "LA Clippers": "James Harden", "Los Angeles Lakers": "LeBron James",
    "Memphis Grizzlies": "Ja Morant", "Miami Heat": "Bam Adebayo",
    "Milwaukee Bucks": "Giannis Antetokounmpo", "Minnesota Timberwolves": "Anthony Edwards",
    "New Orleans Pelicans": "Zion Williamson", "New York Knicks": "Jalen Brunson",
    "Oklahoma City Thunder": "Shai Gilgeous-Alexander", "Orlando Magic": "Paolo Banchero",
    "Philadelphia 76ers": "Tyrese Maxey", "Phoenix Suns": "Devin Booker",
    "Portland Trail Blazers": "Scoot Henderson", "Sacramento Kings": "De'Aaron Fox",
    "San Antonio Spurs": "Victor Wembanyama", "Toronto Raptors": "Scottie Barnes",
    "Utah Jazz": "Lauri Markkanen", "Washington Wizards": "Kyle Kuzma",
  },
  nfl: {
    "Kansas City Chiefs": "Patrick Mahomes", "San Francisco 49ers": "Brock Purdy",
    "Philadelphia Eagles": "Jalen Hurts", "Buffalo Bills": "Josh Allen",
    "Dallas Cowboys": "Dak Prescott", "Baltimore Ravens": "Lamar Jackson",
    "Cincinnati Bengals": "Joe Burrow", "Miami Dolphins": "Tua Tagovailoa",
    "Detroit Lions": "Jared Goff", "Green Bay Packers": "Jordan Love",
    "Los Angeles Rams": "Matthew Stafford", "Tampa Bay Buccaneers": "Baker Mayfield",
    "New York Jets": "Aaron Rodgers", "Seattle Seahawks": "Geno Smith",
    "Jacksonville Jaguars": "Trevor Lawrence", "Houston Texans": "C.J. Stroud",
    "Cleveland Browns": "Deshaun Watson", "Pittsburgh Steelers": "Russell Wilson",
    "Las Vegas Raiders": "Davante Adams", "Los Angeles Chargers": "Justin Herbert",
    "New England Patriots": "Drake Maye", "Tennessee Titans": "Will Levis",
    "Indianapolis Colts": "Anthony Richardson", "Denver Broncos": "Bo Nix",
    "Chicago Bears": "Caleb Williams", "Minnesota Vikings": "Sam Darnold",
    "New York Giants": "Tommy DeVito", "Washington Commanders": "Jayden Daniels",
    "New Orleans Saints": "Derek Carr", "Carolina Panthers": "Bryce Young",
    "Atlanta Falcons": "Kirk Cousins", "Arizona Cardinals": "Kyler Murray",
  },
  mlb: {
    "Los Angeles Dodgers": "Shohei Ohtani", "New York Yankees": "Aaron Judge",
    "Atlanta Braves": "Ronald Acuna Jr.", "Houston Astros": "Jose Altuve",
    "Philadelphia Phillies": "Bryce Harper", "Texas Rangers": "Corey Seager",
    "Seattle Mariners": "Julio Rodriguez", "Baltimore Orioles": "Gunnar Henderson",
    "Minnesota Twins": "Byron Buxton", "San Diego Padres": "Fernando Tatis Jr.",
    "Boston Red Sox": "Rafael Devers", "Cleveland Guardians": "Jose Ramirez",
    "Toronto Blue Jays": "Bo Bichette", "Chicago Cubs": "Cody Bellinger",
    "Milwaukee Brewers": "Christian Yelich", "San Francisco Giants": "Matt Chapman",
    "New York Mets": "Francisco Lindor", "Cincinnati Reds": "Elly De La Cruz",
    "Colorado Rockies": "Ezequiel Tovar", "Pittsburgh Pirates": "Paul Skenes",
    "Miami Marlins": "Jazz Chisholm", "Arizona Diamondbacks": "Corbin Carroll",
    "Kansas City Royals": "Bobby Witt Jr.", "St. Louis Cardinals": "Nolan Arenado",
    "Washington Nationals": "CJ Abrams", "Oakland Athletics": "Brent Rooker",
    "Chicago White Sox": "Garrett Crochet", "Detroit Tigers": "Spencer Torkelson",
    "Tampa Bay Rays": "Randy Arozarena", "Los Angeles Angels": "Mike Trout",
  },
  nhl: {
    "Boston Bruins": "David Pastrnak", "Tampa Bay Lightning": "Nikita Kucherov",
    "Florida Panthers": "Aleksander Barkov", "Toronto Maple Leafs": "Auston Matthews",
    "Montreal Canadiens": "Cole Caufield", "Ottawa Senators": "Tim Stutzle",
    "Buffalo Sabres": "Tage Thompson", "Detroit Red Wings": "Dylan Larkin",
    "Carolina Hurricanes": "Sebastian Aho", "New York Rangers": "Artemi Panarin",
    "New York Islanders": "Mathew Barzal", "New Jersey Devils": "Jack Hughes",
    "Philadelphia Flyers": "Travis Konecny", "Pittsburgh Penguins": "Sidney Crosby",
    "Washington Capitals": "Alex Ovechkin", "Columbus Blue Jackets": "Zach Werenski",
    "Colorado Avalanche": "Nathan MacKinnon", "Minnesota Wild": "Kirill Kaprizov",
    "Nashville Predators": "Roman Josi", "Chicago Blackhawks": "Connor Bedard",
    "St. Louis Blues": "Jordan Kyrou", "Winnipeg Jets": "Mark Scheifele",
    "Dallas Stars": "Jason Robertson", "Vegas Golden Knights": "Jack Eichel",
    "Los Angeles Kings": "Anze Kopitar", "Anaheim Ducks": "Trevor Zegras",
    "San Jose Sharks": "Macklin Celebrini", "Seattle Kraken": "Matty Beniers",
    "Calgary Flames": "Nazem Kadri", "Vancouver Canucks": "Elias Pettersson",
    "Edmonton Oilers": "Connor McDavid", "Utah Mammoth": "Clayton Keller",
  },
};

function findFranchiseStar(teamName, sport) {
  const map = FRANCHISE_STARS[sport] || {};
  const lc = teamName.toLowerCase();
  for (const [name, star] of Object.entries(map)) {
    const nameLc = name.toLowerCase();
    // Match on full name, city, or nickname (last word of team name)
    const nickname = nameLc.split(" ").slice(-1)[0];
    if (nameLc.includes(lc) || lc.includes(nickname) || lc.includes(nameLc)) {
      return star;
    }
  }
  return null;
}

// ── Real star player data (ESPN) ──────────────────────────────────────────
function getESPNSeasonYear(sport) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (sport === "nba" || sport === "nhl") return month >= 9 ? year + 1 : year;
  if (sport === "nfl") return month >= 3 ? year : year - 1;
  return year;
}

// Returns seasontype priority list for the current date per sport.
// ESPN: 1=preseason, 2=regular season, 3=postseason.
// Primary is tried first; if < 5 completed games found, secondary supplements.
function getSeasonTypePriority(sport) {
  const month = new Date().getMonth() + 1; // 1–12
  if (sport === "nba" || sport === "nhl") {
    // Playoffs: mid-April through June
    if (month >= 4 && month <= 6) return [3, 2];
    return [2];
  }
  if (sport === "nfl") {
    // Playoffs: January–February
    if (month <= 2) return [3, 2];
    return [2];
  }
  if (sport === "mlb") {
    // Playoffs: October
    if (month === 10) return [3, 2];
    return [2];
  }
  return [2];
}

// Find a named player's stat line from a box score. Returns statLine string or null.
function getPlayerStatLine(teamBox, playerName, sport) {
  const statGroups = teamBox.statistics || [];
  const nameLc = playerName.toLowerCase();

  // For MLB: only look at batting group (has "AB" label) — skip pitching group
  // to avoid pitchers being selected via their "H" (hits allowed) stat
  const battingOnly = sport === "mlb";

  for (const group of statGroups) {
    const labels = group.labels || [];
    if (battingOnly && !labels.includes("AB")) continue;

    const athlete = (group.athletes || []).find((a) => {
      const dn = (a.athlete?.displayName || "").toLowerCase();
      // Match on full name or last name
      return dn === nameLc || dn.split(" ").slice(-1)[0] === nameLc.split(" ").slice(-1)[0];
    });
    if (!athlete) continue;

    const s = athlete.stats || [];
    const idx = (label) => labels.indexOf(label);
    let statLine = null;

    if (sport === "nba") {
      const pts = s[idx("PTS")]; const reb = s[idx("REB")]; const ast = s[idx("AST")];
      if (pts !== undefined) statLine = `${pts} PTS · ${reb ?? "—"} REB · ${ast ?? "—"} AST`;
    } else if (sport === "nhl") {
      const g = s[idx("G")] ?? "0"; const a = s[idx("A")] ?? "0";
      statLine = `${g} G · ${a} A`;
    } else if (sport === "mlb") {
      const h = s[idx("H")] ?? "0"; const ab = s[idx("AB")] ?? "0"; const rbi = s[idx("RBI")] ?? "0";
      statLine = `${h}-${ab} · ${rbi} RBI`;
    } else if (sport === "nfl") {
      const yds = s[idx("YDS")] ?? "0"; const td = s[idx("TD")] ?? "0";
      const cat = labels.includes("C/ATT") ? "PASS" : labels.includes("CAR") ? "RUSH" : "REC";
      statLine = `${yds} ${cat} YDS · ${td} TD`;
    }
    if (statLine) return statLine;
  }
  return null;
}

async function fetchRealStarData(teamA, teamB, sport) {
  const espn = ESPN_SPORT_MAP[sport];
  if (!espn) return null;

  const base = `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}`;
  const seasonYear = getESPNSeasonYear(sport);

  async function getTeamStar(teamName) {
    try {
      const team = await espnFindTeam(teamName, espn);
      if (!team) return null;
      const teamId = team.id;
      const logo = team.logos?.[0]?.href || null;

      // Fetch from the correct season phase (playoff vs regular) with fallback.
      // Priority: e.g. during NBA playoffs → [3, 2] tries postseason first,
      // supplements with regular season if fewer than 5 completed games found.
      const seasonTypes = getSeasonTypePriority(sport);
      const seenIds = new Set();
      let allCompleted = [];

      for (const seasonType of seasonTypes) {
        if (allCompleted.length >= 5) break;
        try {
          const r = await fetchWithTimeout(
            `${base}/teams/${teamId}/schedule?season=${seasonYear}&seasontype=${seasonType}`
          );
          const d = await r.json();
          for (const e of (d.events || [])) {
            if (e.competitions?.[0]?.status?.type?.completed && !seenIds.has(e.id)) {
              seenIds.add(e.id);
              allCompleted.push(e);
            }
          }
        } catch { /* try next seasontype */ }
      }

      // Sort all collected games by date descending, take 5 most recent
      allCompleted.sort((a, b) => new Date(b.date) - new Date(a.date));
      const completed = allCompleted.slice(0, 5).reverse(); // oldest→newest for display

      if (!completed.length) return null;

      // Fetch box scores in parallel
      const boxResults = await Promise.allSettled(
        completed.map((e) =>
          fetchWithTimeout(`${base}/summary?event=${e.id}`).then((r) => r.json())
        )
      );

      // Star identity: hardcoded franchise star map is the source of truth.
      // Box scores only provide that player's stat line per game.
      const starName = findFranchiseStar(teamName, sport) || `${teamName} Star`;
      const last5 = [];

      for (let i = 0; i < completed.length; i++) {
        const event = completed[i];
        const comp = event.competitions?.[0];
        const homeComp = comp?.competitors?.find((c) => c.homeAway === "home");
        const awayComp = comp?.competitors?.find((c) => c.homeAway === "away");
        const isHome = homeComp?.team?.id === String(teamId);
        const opp = isHome
          ? (awayComp?.team?.abbreviation || awayComp?.team?.shortDisplayName || "OPP")
          : (homeComp?.team?.abbreviation || homeComp?.team?.shortDisplayName || "OPP");
        const teamScore = parseInt(isHome ? homeComp?.score : awayComp?.score) || 0;
        const oppScore = parseInt(isHome ? awayComp?.score : homeComp?.score) || 0;
        const result = teamScore > oppScore ? "W" : "L";
        const date = event.date
          ? new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
          : "—";

        let statLine = "—";

        if (boxResults[i]?.status === "fulfilled") {
          const bs = boxResults[i].value;
          const teamBox = bs.boxscore?.players?.find((p) => p.team?.id === String(teamId));
          if (teamBox) {
            statLine = getPlayerStatLine(teamBox, starName, sport) || "—";
          }
        }

        last5.push({ opp, date, line: statLine, result });
      }

      return { name: starName, last5, logo };
    } catch (err) {
      console.error(`ESPN star data error for ${teamName}:`, err);
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

// ── Real H2H data (ESPN) ──────────────────────────────────────────────────
async function fetchRealH2H(teamA, teamB, sport) {
  const espn = ESPN_SPORT_MAP[sport];
  if (!espn) return null;

  const base = `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}`;

  try {
    const [teamAData, teamBData] = await Promise.allSettled([
      espnFindTeam(teamA, espn),
      espnFindTeam(teamB, espn),
    ]);

    const tA = teamAData.status === "fulfilled" ? teamAData.value : null;
    const tB = teamBData.status === "fulfilled" ? teamBData.value : null;
    if (!tA || !tB) return null;

    // Get teamA's schedule across relevant season phases, find games vs teamB
    const seasonYear = getESPNSeasonYear(sport);
    const seasonTypes = getSeasonTypePriority(sport);
    const seenH2H = new Set();
    let allEvents = [];

    for (const seasonType of seasonTypes) {
      try {
        const r = await fetchWithTimeout(
          `${base}/teams/${tA.id}/schedule?season=${seasonYear}&seasontype=${seasonType}`
        );
        const d = await r.json();
        for (const e of (d.events || [])) {
          if (!seenH2H.has(e.id)) { seenH2H.add(e.id); allEvents.push(e); }
        }
      } catch { /* continue */ }
    }

    const h2hGames = allEvents
      .filter((e) => {
        const opponents = e.competitions?.[0]?.competitors || [];
        return (
          e.competitions?.[0]?.status?.type?.completed === true &&
          opponents.some((c) => c.team?.id === String(tB.id))
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .reverse();

    if (!h2hGames.length) return null;

    const season_results = h2hGames.map((e) => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const homeTeam = home?.team?.displayName || "";
      const awayTeam = away?.team?.displayName || "";
      const homeScore = parseInt(home?.score || 0);
      const awayScore = parseInt(away?.score || 0);
      const winner = homeScore > awayScore ? homeTeam : awayTeam;
      const date = e.date
        ? new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—";
      return {
        date,
        result: `${winner} won`,
        score: `${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`,
      };
    });

    const aWins = season_results.filter((r) => r.result.toLowerCase().includes(teamA.toLowerCase())).length;
    const bWins = season_results.length - aWins;
    const last = season_results[0];

    return {
      lastMeeting: last?.date || "Recent",
      score: last?.score || `${teamA} vs ${teamB}`,
      season: season_results,
      trend: aWins > bWins
        ? `${teamA} leads ${aWins}–${bWins} in last ${season_results.length} meetings`
        : aWins < bWins
        ? `${teamB} leads ${bWins}–${aWins} in last ${season_results.length} meetings`
        : `Series tied ${aWins}–${bWins} in last ${season_results.length} meetings`,
    };
  } catch (err) {
    console.error("ESPN H2H error:", err);
    return null;
  }
}

// ── MLB-specific fetchers ─────────────────────────────────────────────────
async function fetchMLBPitchers() {
  // MLB pitcher data requires a specific game ID — not yet implemented
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

// ── Injury impact rating ───────────────────────────────────────────────────
function getInjuryImpact(status, isStarPlayer) {
  if (isStarPlayer) {
    if (status === "Out" || status === "Doubtful") return "critical";
    if (status === "Questionable") return "high";
    return "moderate";
  }
  if (status === "Out") return "high";
  if (status === "Doubtful") return "moderate";
  if (status === "Questionable") return "monitor";
  return "low";
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

  // Fire ALL fetches in parallel — injuries, odds, weather, stars, H2H all at once
  const [
    injuriesResult,
    oddsResult,
    weatherResult,
    mlbPitchersResult,
    realStarsResult,
    realH2HResult,
  ] = await Promise.allSettled([
    fetchInjuries(teamA, teamB, sport),
    fetchOdds(teamA, teamB, sport),
    fetchWeather(venue),
    sport === "mlb" ? fetchMLBPitchers() : Promise.resolve(null),
    fetchRealStarData(teamA, teamB, sport),
    fetchRealH2H(teamA, teamB, sport),
  ]);

  const injuries = injuriesResult.status === "fulfilled" ? injuriesResult.value : { [teamA]: [], [teamB]: [] };
  const odds = (oddsResult.status === "fulfilled" && oddsResult.value) ? oddsResult.value : mockOdds(teamA, teamB);
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const mlbStartingPitchers = (mlbPitchersResult.status === "fulfilled") ? mlbPitchersResult.value : null;

  const stars =
    (realStarsResult.status === "fulfilled" && realStarsResult.value) ||
    mockStarData(teamA, teamB, sport);

  // Add impact rating to each injury entry
  const starNames = Object.values(stars).map((s) => (s.name || "").toLowerCase());
  const injuriesWithImpact = {};
  for (const [team, list] of Object.entries(injuries)) {
    injuriesWithImpact[team] = list.map((inj) => ({
      ...inj,
      impact: getInjuryImpact(
        inj.status,
        starNames.some((n) => n && inj.player && n.includes(inj.player.toLowerCase()))
      ),
    }));
  }

  const headToHead =
    (realH2HResult.status === "fulfilled" && realH2HResult.value) || {
      lastMeeting: "Recent season",
      score: `${teamA} vs ${teamB}`,
      season: [{ date: "Recent", result: `${teamA} won`, score: "See full H2H" }],
      trend: `${teamA} vs ${teamB} — season series`,
    };

  // Build context for Claude
  const dataContext = { injuries: injuriesWithImpact, odds, weather, stars, headToHead, sport, venue: { name: venue.name, city: venue.city } };
  const aiResult = await generateAISummary(teamA, teamB, sport, dataContext);

  const aiSummary = aiResult?.aiSummary || `${teamA} arrives with momentum. The line movement and market signals favor the visitor side.\n\n${teamB} hold home court advantage but recent defensive numbers have been leaky.\n\nSharp action is split — this one could go either way.`;
  const confidence = aiResult?.confidence || { level: "MODERATE", stars: 3, pick: `${teamA} +3`, reasoning: "Line movement and recent form edge the visitor." };

  const logos = {
    [teamA]: stars[teamA]?.logo || null,
    [teamB]: stars[teamB]?.logo || null,
  };

  const report = {
    matchup: { teamA, teamB, sport },
    logos,
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
    injuries: injuriesWithImpact,
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
