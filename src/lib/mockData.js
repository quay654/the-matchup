// Mock data used locally when real API keys aren't present yet.
// The api/report.js serverless function replaces this with real data in production.

const stars = {
  Lakers: "LeBron James", Celtics: "Jayson Tatum",
  Warriors: "Stephen Curry", Nuggets: "Nikola Jokić",
  Bucks: "Giannis Antetokounmpo", "76ers": "Joel Embiid",
  Chiefs: "Patrick Mahomes", Bills: "Josh Allen",
  Eagles: "Jalen Hurts", Cowboys: "Dak Prescott",
  "49ers": "Brock Purdy", Rams: "Matthew Stafford",
  Dodgers: "Shohei Ohtani", Yankees: "Aaron Judge",
  Astros: "Yordan Alvarez", Braves: "Ronald Acuña Jr.",
  Oilers: "Connor McDavid", Rangers: "Artemi Panarin",
  "Maple Leafs": "Auston Matthews", Bruins: "David Pastrnak",
};

export const VENUES = {
  Celtics: { name: "TD Garden", city: "Boston, MA", outdoor: false },
  Nuggets: { name: "Ball Arena", city: "Denver, CO", outdoor: false },
  "76ers": { name: "Wells Fargo Center", city: "Philadelphia, PA", outdoor: false },
  Lakers: { name: "Crypto.com Arena", city: "Los Angeles, CA", outdoor: false },
  Warriors: { name: "Chase Center", city: "San Francisco, CA", outdoor: false },
  Bucks: { name: "Fiserv Forum", city: "Milwaukee, WI", outdoor: false },
  Bills: { name: "Highmark Stadium", city: "Orchard Park, NY", outdoor: true },
  Cowboys: { name: "AT&T Stadium", city: "Arlington, TX", outdoor: false, retractable: true },
  Rams: { name: "SoFi Stadium", city: "Inglewood, CA", outdoor: false, retractable: true },
  Chiefs: { name: "Arrowhead Stadium", city: "Kansas City, MO", outdoor: true },
  Eagles: { name: "Lincoln Financial Field", city: "Philadelphia, PA", outdoor: true },
  "49ers": { name: "Levi's Stadium", city: "Santa Clara, CA", outdoor: true },
  Yankees: { name: "Yankee Stadium", city: "Bronx, NY", outdoor: true },
  Braves: { name: "Truist Park", city: "Atlanta, GA", outdoor: true },
  Dodgers: { name: "Dodger Stadium", city: "Los Angeles, CA", outdoor: true },
  Astros: { name: "Minute Maid Park", city: "Houston, TX", outdoor: false, retractable: true },
  Rangers: { name: "Madison Square Garden", city: "New York, NY", outdoor: false },
  Bruins: { name: "TD Garden", city: "Boston, MA", outdoor: false },
  Oilers: { name: "Rogers Place", city: "Edmonton, AB", outdoor: false },
  "Maple Leafs": { name: "Scotiabank Arena", city: "Toronto, ON", outdoor: false },
};

function statLine(sport) {
  if (sport === "nba") return () => ({
    line: `${20 + Math.floor(Math.random() * 18)} PTS · ${4 + Math.floor(Math.random() * 8)} REB · ${3 + Math.floor(Math.random() * 9)} AST`,
    result: Math.random() > 0.5 ? "W" : "L",
  });
  if (sport === "nfl") return () => ({
    line: `${200 + Math.floor(Math.random() * 180)} YDS · ${1 + Math.floor(Math.random() * 4)} TD`,
    result: Math.random() > 0.5 ? "W" : "L",
  });
  if (sport === "mlb") return () => ({
    line: `${Math.floor(Math.random() * 4)}-${1 + Math.floor(Math.random() * 4)} · ${Math.floor(Math.random() * 3)} HR`,
    result: Math.random() > 0.5 ? "W" : "L",
  });
  return () => ({
    line: `${Math.floor(Math.random() * 3)} G · ${Math.floor(Math.random() * 3)} A`,
    result: Math.random() > 0.5 ? "W" : "L",
  });
}

export function buildMockReport(teamA, teamB, sport) {
  const venue = VENUES[teamB] || { name: `${teamB} Home Venue`, city: "TBD", outdoor: false };
  const weather = venue.outdoor ? {
    temp: 62, condition: "Partly Cloudy", wind: "8 mph NE",
    precip: "10%", humidity: "54%",
    impact: "Mild conditions — minimal impact expected on passing or kicking game.",
  } : null;

  const gen = statLine(sport);
  const oppTeams = ["MIA", "PHX", "ATL", "CHI", "TOR"];
  const last5 = () => Array.from({ length: 5 }, (_, i) => ({
    opp: oppTeams[i], date: `Apr ${18 - i}`, ...gen(),
  }));

  const starA = stars[teamA] || `${teamA} Star`;
  const starB = stars[teamB] || `${teamB} Star`;

  const mlbStartingPitchers = sport === "mlb" ? {
    [teamA]: {
      name: "Tyler Glasnow", hand: "RHP", record: "8-3",
      era: 2.84, whip: 1.08, k9: 11.2, bb9: 2.6,
      last3: [
        { date: "Apr 17", opp: "SF", ip: "6.2", h: 4, er: 1, k: 9, bb: 2, result: "W" },
        { date: "Apr 12", opp: "SD", ip: "7.0", h: 3, er: 0, k: 11, bb: 1, result: "W" },
        { date: "Apr 07", opp: "ARI", ip: "5.1", h: 6, er: 3, k: 7, bb: 3, result: "L" },
      ],
      vsOpponent: { ip: "12.0", era: 3.00, k: 16, note: "2 career starts" },
    },
    [teamB]: {
      name: "Gerrit Cole", hand: "RHP", record: "7-4",
      era: 3.12, whip: 1.04, k9: 10.4, bb9: 2.1,
      last3: [
        { date: "Apr 16", opp: "BOS", ip: "7.0", h: 5, er: 2, k: 8, bb: 1, result: "W" },
        { date: "Apr 11", opp: "TB", ip: "6.0", h: 7, er: 4, k: 6, bb: 2, result: "L" },
        { date: "Apr 06", opp: "BAL", ip: "6.1", h: 4, er: 1, k: 10, bb: 0, result: "W" },
      ],
      vsOpponent: { ip: "24.2", era: 2.55, k: 31, note: "4 career starts" },
    },
  } : null;

  const mlbBullpen = sport === "mlb" ? {
    [teamA]: {
      era: 3.42, whip: 1.21, rank: 8, save_pct: "82%", last7_era: 2.88,
      status: "Fresh", closer: { name: "Evan Phillips", saves: 12, era: 1.98 },
    },
    [teamB]: {
      era: 4.18, whip: 1.34, rank: 22, save_pct: "71%", last7_era: 5.24,
      status: "Taxed", closer: { name: "Clay Holmes", saves: 9, era: 3.54 },
    },
  } : null;

  return {
    matchup: { teamA, teamB, sport },
    venue,
    weather,
    mlbStartingPitchers,
    mlbBullpen,
    aiSummary: `${teamA} arrives in form. ${starA} has been near a triple-double over the last 5 games, and the road record of 7-3 ATS over that span tells the real story.\n\n${teamB} is still dangerous at home, and ${starB} is quietly putting together one of the most efficient stretches of the season. The home crowd will be a factor, but the defense has leaked points in three straight.\n\nThe line opened at ${teamB} -4 and has ticked down to -3.5. Sharp money is on the visitor side, and the public remains heavily on ${teamB}. When this much public money fails to move the line, it's a signal the books are comfortable taking the other side.`,
    confidence: {
      level: "STRONG", stars: 4,
      pick: `${teamA} +3.5`,
      reasoning: "Multiple data points align: road form, ATS coverage, line movement, and recent injury to a key ${teamB} rotation piece.",
    },
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
    injuries: {
      [teamA]: [
        { player: "J. Smith", status: "Out", note: "Ankle" },
        { player: "M. Davis", status: "Questionable", note: "Knee · game-time decision" },
      ],
      [teamB]: [
        { player: "R. Johnson", status: "Doubtful", note: "Hamstring" },
      ],
    },
    stars: {
      [teamA]: { name: starA, last5: last5() },
      [teamB]: { name: starB, last5: last5() },
    },
    headToHead: {
      lastMeeting: "March 12, 2026",
      score: `${teamA} 112 — ${teamB} 108`,
      season: [
        { date: "Mar 12", result: `${teamA} won`, score: "112–108" },
        { date: "Jan 28", result: `${teamB} won`, score: "119–104" },
        { date: "Nov 15", result: `${teamA} won`, score: "98–96 OT" },
      ],
      trend: `${teamA} leads season series 2–1`,
    },
    odds: {
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
    },
  };
}
