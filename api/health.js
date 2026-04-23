import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  let redisOk = false;
  let redisError = null;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
      await r.set("health:ping", "pong", { ex: 10 });
      const val = await r.get("health:ping");
      redisOk = val === "pong";
    }
  } catch (err) {
    redisError = err.message;
  }

  res.status(200).json({
    ok: true,
    env: {
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasApiSports: !!process.env.API_SPORTS_KEY,
      hasOdds: !!process.env.ODDS_API_KEY,
      hasRedis: !!process.env.UPSTASH_REDIS_REST_URL,
      hasSupabase: !!process.env.VITE_SUPABASE_URL,
    },
    redis: { ok: redisOk, error: redisError },
  });
}
