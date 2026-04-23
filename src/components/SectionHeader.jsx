export default function SectionHeader({ num, title, eyebrow }) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 mb-3 font-semibold">
          {eyebrow}
        </div>
      )}
      <div className="flex items-baseline gap-4">
        {num && <span className="text-base text-black/40 tabular-nums font-medium">{num}</span>}
        <h2 className="font-display text-3xl md:text-4xl text-black">{title}</h2>
      </div>
    </div>
  );
}
