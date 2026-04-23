// GET /api/report/:slug
// Fetches a saved report from Supabase by its slug.

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  const slug = req.query.slug;
  if (!slug) {
    return res.status(400).json({ error: "Slug is required" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { data, error } = await supabase
      .from("saved_reports")
      .select("report_json")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(data.report_json);
  } catch (err) {
    console.error("fetch report error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
