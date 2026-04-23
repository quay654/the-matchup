export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    env: {
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasApiSports: !!process.env.API_SPORTS_KEY,
      hasOdds: !!process.env.ODDS_API_KEY,
      hasRedis: !!process.env.UPSTASH_REDIS_REST_URL,
      hasSupabase: !!process.env.VITE_SUPABASE_URL,
    },
  });
}
