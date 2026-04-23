export default function StatusBadge({ status }) {
  const map = {
    Out: "text-red-700 bg-red-50 border-red-200",
    Doubtful: "text-orange-700 bg-orange-50 border-orange-200",
    Questionable: "text-amber-700 bg-amber-50 border-amber-200",
    Probable: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
  return (
    <span className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border font-bold ${map[status] || "text-black/60 bg-black/5 border-black/10"}`}>
      {status}
    </span>
  );
}
