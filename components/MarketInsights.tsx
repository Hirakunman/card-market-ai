import { AlertTriangle, TrendingUp, Shield, Calendar } from "lucide-react";
import type { CardInsight } from "@/types";

type Props = {
  insight: CardInsight | null;
};

const RISK_CONFIG = {
  none:   { label: "再販情報なし", color: "#9ca3af", bg: "rgba(156,163,175,0.08)" },
  low:    { label: "再販リスク: 低", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  medium: { label: "再販リスク: 中", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  high:   { label: "再販リスク: 高", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
};

export function MarketInsights({ insight }: Props) {
  if (!insight) {
    return (
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4">
        <h2 className="font-semibold mb-2">市場シグナル</h2>
        <p className="text-sm text-[#9ca3af]">
          メルカリ相場・PSA価格・再販情報はデータ収集中です。
        </p>
      </div>
    );
  }

  const hasMercari = insight.mercari_price != null;
  const hasPsa = insight.psa10_price != null || insight.psa9_price != null;
  const hasReprint = insight.reprint_risk !== "none";
  const risk = RISK_CONFIG[insight.reprint_risk] ?? RISK_CONFIG.none;

  if (!hasMercari && !hasPsa && !hasReprint) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4 space-y-4">
      <h2 className="font-semibold">市場シグナル</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* メルカリ相場 */}
        {hasMercari && (
          <div className={`rounded-lg border p-3 space-y-1 ${insight.mercari_surge ? "border-orange-500/50 bg-orange-500/5" : "border-[#2a2a2e]"}`}>
            <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
              <TrendingUp className="w-3.5 h-3.5" />
              メルカリ相場（売切）
            </div>
            <p className="text-lg font-bold tabular-nums">
              ¥{insight.mercari_price!.toLocaleString()}
            </p>
            {insight.mercari_change_7d != null && (
              <p className={`text-sm font-medium ${insight.mercari_surge ? "text-orange-400" : "text-[#9ca3af]"}`}>
                {insight.mercari_surge ? "🔥 急騰 " : ""}
                7日 {insight.mercari_change_7d > 0 ? "+" : ""}
                {insight.mercari_change_7d}%
              </p>
            )}
          </div>
        )}

        {/* PSA価格 */}
        {hasPsa && (
          <div className="rounded-lg border border-[#2a2a2e] p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
              <Shield className="w-3.5 h-3.5" />
              PSA鑑定品（メルカリ）
            </div>
            {insight.psa10_price && (
              <p className="text-sm">
                <span className="text-[#9ca3af]">PSA10 </span>
                <span className="font-bold tabular-nums">¥{insight.psa10_price.toLocaleString()}</span>
              </p>
            )}
            {insight.psa9_price && (
              <p className="text-sm">
                <span className="text-[#9ca3af]">PSA9 </span>
                <span className="font-bold tabular-nums">¥{insight.psa9_price.toLocaleString()}</span>
              </p>
            )}
            {insight.psa_premium_pct != null && (
              <p className="text-xs text-blue-400">
                素体比 +{insight.psa_premium_pct}% プレミアム
              </p>
            )}
          </div>
        )}

        {/* 再販リスク */}
        {hasReprint && (
          <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: risk.color + "40", backgroundColor: risk.bg }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: risk.color }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {risk.label}
            </div>
            {insight.reprint_title && (
              <p className="text-xs leading-snug line-clamp-3">{insight.reprint_title}</p>
            )}
            {insight.reprint_date && (
              <p className="text-xs text-[#9ca3af] flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(insight.reprint_date).toLocaleDateString("ja-JP")}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[#9ca3af]">
        ※ メルカリ・PSA価格は売切商品の参考値です。再販情報は公式発表を自動収集しています。
      </p>
    </div>
  );
}
