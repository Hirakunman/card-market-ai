import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rate: number | null;
  amount?: number | null;
  size?: "sm" | "md";
};

export function PriceChange({ rate, amount, size = "md" }: Props) {
  if (rate === null) return <span className="text-[#9ca3af]">—</span>;

  const isRise = rate > 0;
  const isFall = rate < 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        size === "sm" ? "text-xs" : "text-sm",
        isRise && "text-green-400",
        isFall && "text-red-400",
        !isRise && !isFall && "text-[#9ca3af]"
      )}
    >
      {isRise && <TrendingUp className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />}
      {isFall && <TrendingDown className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />}
      {!isRise && !isFall && <Minus className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />}
      {isRise ? "+" : ""}
      {rate.toFixed(1)}%
      {amount !== undefined && amount !== null && (
        <span className="font-normal text-[#9ca3af]">
          ({isRise ? "+" : ""}¥{amount.toLocaleString()})
        </span>
      )}
    </span>
  );
}
