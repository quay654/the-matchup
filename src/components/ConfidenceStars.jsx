import { Star } from "lucide-react";

export default function ConfidenceStars({ count, size = 18 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= count ? "#10b981" : "transparent"}
          className={i <= count ? "text-emerald-500" : "text-black/15"}
          strokeWidth={i <= count ? 0 : 2}
        />
      ))}
    </div>
  );
}
