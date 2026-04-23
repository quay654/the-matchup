// POST /api/save-report  { report, teamA, teamB, sport }
// Saves a report to Supabase and returns a short shareable slug.

import { createClient } from "@supabase/supabase-js";

function nanoid(n = 5) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < n; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { report, teamA, teamB, sport } = req.body || {};
  if (!report || !teamA || !teamB) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    // Return a fake slug so the UI still works during development
    const slug = `${teamA.toLowerCase()}-${teamB.toLowerCase()}-${nanoid(5)}`;
    return res.status(200).json({ slug, url: `/r/${slug}`, note: "Supabase not configured" });
  }

  const slug = `${teamA.toLowerCase().replace(/\s+/g, "-")}-${teamB.toLowerCase().replace(/\s+/g, "-")}-${nanoid(5)}`;

  try {
    const { error } = await supabase.from("saved_reports").insert({
      slug,
      user_id: null, // TODO: extract from auth header if present
      team_a: teamA,
      team_b: teamB,
      sport,
      report_json: report,
    });

    if (error) throw error;

    return res.status(200).json({ slug, url: `/r/${slug}` });
  } catch (err) {
    console.error("save-report error:", err);
    // Still return a slug so the UI doesn't break
    return res.status(200).json({ slug, url: `/r/${slug}`, error: "Database save failed" });
  }
}
