import { Sparkles, MapPin, Home, Cloud, Wind, CloudRain } from "lucide-react";
import SectionHeader from "./SectionHeader";
import StatusBadge from "./StatusBadge";
import ConfidenceStars from "./ConfidenceStars";

export default function ReportView({ report }) {
  const { matchup, venue, weather, mlbStartingPitchers, mlbBullpen, aiSummary,
    confidence, atsTrends, injuries, stars, headToHead, odds } = report;

  return (
    <section className="border-t border-black/10 pt-16 pb-24 space-y-20">

      {/* VENUE & WEATHER */}
      <div className={`grid ${weather ? "md:grid-cols-2" : ""} gap-4`}>
        {/* Venue card */}
        <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={14} className="text-emerald-600" />
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-semibold">Venue</span>
          </div>
          <div className="font-display text-2xl text-black leading-tight">{venue.name}</div>
          <div className="text-sm text-black/70 mt-1">{venue.city}</div>
          <div className="flex items-center gap-2 mt-4">
            <Home size={12} className="text-black/50" />
            <span className="text-xs text-black/70">
              {venue.outdoor ? "Outdoor stadium" : venue.retractable ? "Retractable roof" : "Indoor arena"}
            </span>
          </div>
        </div>

        {/* Weather card — only outdoor */}
        {weather && (
          <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Cloud size={14} className="text-sky-600" />
              <span className="text-xs uppercase tracking-[0.2em] text-sky-700 font-semibold">Game-time weather</span>
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <div className="font-display text-4xl text-black tabular-nums">{weather.temp}°F</div>
              <div className="text-base text-black/70">{weather.condition}</div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <div className="flex items-center gap-1 text-xs text-black/60 mb-0.5">
                  <Wind size={10} /> Wind
                </div>
                <div className="text-black font-medium">{weather.wind}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-black/60 mb-0.5">
                  <CloudRain size={10} /> Precip
                </div>
                <div className="text-black font-medium">{weather.precip}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-black/60 mb-0.5">
                  <span className="text-[10px]">💧</span> Humidity
                </div>
                <div className="text-black font-medium">{weather.humidity}</div>
              </div>
            </div>
            <div className="text-xs text-black/70 italic border-t border-sky-100 pt-3">
              {weather.impact}
            </div>
          </div>
        )}
      </div>

      {/* 01 — AI ANALYST */}
      <div>
        <SectionHeader num="01" eyebrow="AI Analyst · Exclusive" title="What you need to know" />

        {/* Confidence card */}
        <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-bold">
                  {confidence.level} PICK
                </span>
                <ConfidenceStars count={confidence.stars} />
              </div>
              <div className="font-display text-3xl md:text-4xl text-black mb-2">
                {confidence.pick}
              </div>
              <div className="text-sm text-black/70 italic max-w-lg">
                {confidence.reasoning}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={16} className="text-emerald-600" />
          <span className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-semibold">AI Summary</span>
        </div>
        <div className="font-display text-xl md:text-2xl leading-relaxed space-y-5 text-black">
          {aiSummary.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      {/* 02 — INJURIES */}
      <div>
        <SectionHeader num="02" eyebrow="Availability" title="Injury report" />
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(injuries).map(([team, list]) => (
            <div key={team} className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-4 font-semibold">{team}</div>
              <div className="space-y-4">
                {list.length === 0 ? (
                  <div className="text-sm text-black/50 italic">No injuries reported.</div>
                ) : (
                  list.map((inj, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base text-black font-medium truncate">{inj.player}</div>
                        <div className="text-sm text-black/60 mt-0.5 break-words">{inj.note}</div>
                      </div>
                      <StatusBadge status={inj.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 03 — SUPERSTAR L5 */}
      <div>
        <SectionHeader num="03" eyebrow="Recent Form" title="Superstar · last 5" />
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(stars).map(([team, data]) => (
            <div key={team} className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
              <div className="mb-5 min-w-0">
                <div className="text-xs uppercase tracking-[0.2em] text-black/60 font-semibold truncate">{team}</div>
                <div className="font-display text-xl md:text-2xl mt-1 text-black truncate">{data.name}</div>
              </div>
              <div className="space-y-3">
                {data.last5.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-black/[0.06] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-black/60 tabular-nums w-12 text-sm">{g.date}</span>
                      <span className="text-black/80 w-10 font-medium text-sm">{g.opp}</span>
                      <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                        g.result === "W" ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-black/60"
                      }`}>
                        {g.result}
                      </span>
                    </div>
                    <span className="text-black tabular-nums text-xs font-medium">{g.line}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 03.5 — MLB STARTING PITCHERS */}
      {mlbStartingPitchers && (
        <div>
          <SectionHeader num="03.5" eyebrow="MLB · Starting Pitchers" title="The mound" />
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(mlbStartingPitchers).map(([team, p]) => (
              <div key={team} className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-black/[0.08]">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-black/60 font-semibold">{team}</div>
                    <div className="font-display text-2xl mt-1 text-black">{p.name}</div>
                    <div className="text-sm text-black/70 mt-0.5">{p.hand} · {p.record}</div>
                  </div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "ERA", value: p.era.toFixed(2), hot: p.era < 3.50 },
                    { label: "WHIP", value: p.whip.toFixed(2), hot: p.whip < 1.15 },
                    { label: "K/9", value: p.k9.toFixed(1), hot: false },
                    { label: "BB/9", value: p.bb9.toFixed(1), hot: false },
                  ].map(({ label, value, hot }) => (
                    <div key={label}>
                      <div className="text-[10px] uppercase tracking-widest text-black/50 mb-1">{label}</div>
                      <div className={`font-display text-2xl tabular-nums ${hot ? "text-emerald-600" : "text-black"}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Last 3 starts */}
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.15em] text-black/60 mb-2 font-semibold">Last 3 starts</div>
                  <div className="space-y-1.5">
                    {p.last3.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-black/60 tabular-nums w-14">{s.date}</span>
                          <span className="text-black/80 w-8 font-medium">{s.opp}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.result === "W" ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-black/60"
                          }`}>
                            {s.result}
                          </span>
                        </div>
                        <div className="tabular-nums text-black/80">
                          <span className="font-semibold">{s.ip}</span> IP · <span className="text-black/60">{s.er} ER · {s.k} K</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vs opponent */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-1">
                    Career vs opponent
                  </div>
                  <div className="text-sm text-black">
                    <span className="tabular-nums font-bold">{p.vsOpponent.ip}</span> IP ·
                    <span className="tabular-nums font-bold"> {p.vsOpponent.era.toFixed(2)}</span> ERA ·
                    <span className="tabular-nums font-bold"> {p.vsOpponent.k}</span> K
                    <span className="text-black/60 ml-1 italic">({p.vsOpponent.note})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 03.6 — MLB BULLPEN */}
      {mlbBullpen && (
        <div>
          <SectionHeader num="03.6" eyebrow="MLB · Relief" title="Bullpen report" />
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(mlbBullpen).map(([team, bp]) => (
              <div key={team} className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-black/60 font-semibold">{team}</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="font-display text-2xl text-black">Bullpen</div>
                      <div className="text-sm text-black/60">#{bp.rank} in MLB</div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border font-bold ${
                    bp.status === "Fresh" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                    bp.status === "Taxed" ? "text-red-700 bg-red-50 border-red-200" :
                    "text-amber-700 bg-amber-50 border-amber-200"
                  }`}>
                    {bp.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Season ERA", value: bp.era.toFixed(2), hot: bp.era < 3.50 },
                    { label: "L7 ERA", value: bp.last7_era.toFixed(2), hot: bp.last7_era < 3.50 },
                    { label: "Save %", value: bp.save_pct, hot: false },
                  ].map(({ label, value, hot }) => (
                    <div key={label}>
                      <div className="text-[10px] uppercase tracking-widest text-black/50 mb-1">{label}</div>
                      <div className={`font-display text-2xl tabular-nums ${hot ? "text-emerald-600" : "text-black"}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-black/10 pt-4">
                  <div className="text-[10px] uppercase tracking-widest text-black/50 font-bold mb-2">Closer</div>
                  <div className="flex items-baseline justify-between">
                    <div className="font-display text-lg text-black">{bp.closer.name}</div>
                    <div className="text-sm tabular-nums text-black/80">
                      <span className="font-bold">{bp.closer.saves}</span> SV ·
                      <span className="font-bold"> {bp.closer.era.toFixed(2)}</span> ERA
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-black/60 mt-4 italic">
            "Taxed" indicates the bullpen has thrown heavy innings in recent games — fatigue may impact performance.
          </div>
        </div>
      )}

      {/* 04 — HEAD TO HEAD */}
      <div>
        <SectionHeader num="04" eyebrow="History" title="Head to head" />
        <div className="bg-white border border-black/10 rounded-2xl p-8 shadow-sm">
          <div className="grid md:grid-cols-[1fr_1.5fr] gap-10">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-2 font-semibold">Last meeting</div>
              <div className="font-display text-2xl text-black break-words">{headToHead.lastMeeting}</div>
              <div className="text-base text-black/70 mt-1 break-words">{headToHead.score}</div>
              <div className="mt-6 font-display italic text-lg text-black border-l-2 border-emerald-400 pl-4">
                {headToHead.trend}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-3 font-semibold">Season series</div>
              <div className="space-y-2">
                {headToHead.season.map((m, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 py-2.5 border-b border-black/[0.06] last:border-0">
                    <div className="text-black/60 tabular-nums text-sm sm:w-20 flex-shrink-0">{m.date}</div>
                    <div className="flex-1 text-black font-medium text-sm min-w-0 truncate sm:px-2">{m.result}</div>
                    <div className="text-black/70 text-sm flex-shrink-0">{m.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 05 — ATS TRENDS */}
      <div>
        <SectionHeader num="05" eyebrow="Betting Trends" title="Against the spread" />
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(atsTrends).map(([team, trends]) => (
            <div key={team} className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-5 font-semibold">{team}</div>
              <div className="space-y-5">
                {trends.map((t, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-black/80">{t.label}</span>
                      <span className={`tabular-nums font-bold ${t.hot ? "text-emerald-600" : "text-black/70"}`}>
                        {t.value}
                      </span>
                    </div>
                    <div className="h-1 bg-black/[0.08] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${t.pct}%`,
                          background: t.hot ? "#10b981" : "rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-black/60 mt-4 italic">
          Trends in green indicate a 70%+ coverage rate.
        </div>
      </div>

      {/* 06 — ODDS */}
      <div>
        <SectionHeader num="06" eyebrow="Market" title="Odds & lines" />

        {/* Best value banner */}
        <div className="rounded-2xl p-6 mb-4 border-2 border-emerald-200 bg-emerald-50/50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] mb-2 text-emerald-700 font-bold">
              Best value spotted
            </div>
            <div className="font-display text-2xl text-black">
              {odds.bestValue.team}{" "}
              <span className="tabular-nums text-emerald-600">{odds.bestValue.odds}</span>
            </div>
            <div className="text-sm text-black/70 mt-1">on {odds.bestValue.book}</div>
          </div>
          <div className="text-sm text-black/60 tabular-nums">{odds.updated}</div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Moneyline */}
          <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-4 font-semibold">Moneyline</div>
            <div className="space-y-3">
              {odds.moneyline.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-black/70 truncate flex-shrink-0 w-20">{row.book}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`tabular-nums font-medium ${row.best === matchup.teamA ? "text-emerald-600 font-bold" : "text-black"}`}>
                      {row[matchup.teamA]}
                    </span>
                    <span className="text-black/30">·</span>
                    <span className={`tabular-nums font-medium ${row.best === matchup.teamB ? "text-emerald-600 font-bold" : "text-black"}`}>
                      {row[matchup.teamB]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spread */}
          <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-4 font-semibold">Spread</div>
            <div className="space-y-3">
              {odds.spread.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-black/70 truncate flex-shrink-0 w-20">{row.book}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-black font-medium">{row.line}</span>
                    <span className="text-black/30">·</span>
                    <span className={`tabular-nums font-medium ${row.best ? "text-emerald-600 font-bold" : "text-black"}`}>
                      {row.juice}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-black/60 mb-4 font-semibold">Total (O/U)</div>
            <div className="space-y-3">
              {odds.total.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-black/70 truncate flex-shrink-0 w-20">{row.book}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-black font-medium">{row.line}</span>
                    <span className="text-black/30">·</span>
                    <span className={`tabular-nums font-medium ${row.best ? "text-emerald-600 font-bold" : "text-black"}`}>
                      {row.juice}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-black/10 pt-6 text-sm text-black/60 italic max-w-xl">
        Odds and stats powered by API-Sports, The Odds API, and Anthropic Claude. For entertainment purposes only.
      </div>
    </section>
  );
}
