"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Info } from "lucide-react";
import { GameBadge } from "@/components/GameBadge";

type Horizon = "1w" | "1m" | "1y";
type SortKey = "rate" | "amount" | "score";

type PredEntry = {
  card_id: string;
  current_price: number;
  pred_1w: number;
  pred_1m: number;
  pred_1y: number;
  change_1w: number;
  change_1m: number;
  change_1y: number;
  confidence: "low" | "medium" | "high";
  data_days: number;
  rise_score?: number;
  mercari_confirmed?: boolean;
  card_insights?: {
    mercari_surge?: boolean;
    mercari_change_7d?: number;
    reprint_risk?: string;
  } | null;
  cards: {
    id: string;
    name: string;
    game: string;
    set_name: string;
    rarity: string | null;
    image_url: string | null;
  };
};

type Props = {
  entries: PredEntry[];
  type: "rise" | "fall";
};

const HORIZON_LABEL: Record<Horizon, string> = {
  "1w": "1週間後",
  "1m": "1ヶ月後",
  "1y": "1年後",
};

const CONFIDENCE_DOT: Record<string, { color: string; label: string }> = {
  low:    { color: "#6b7280", label: "低" },
  medium: { color: "#f59e0b", label: "中" },
  high:   { color: "#22c55e", label: "高" },
};

export function PredictionRankingTable({ entries, type }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const [sortKey, setSortKey] = useState<SortKey>(type === "rise" ? "score" : "rate");

  const sorted = useMemo(() => {
    const changeKey = `change_${horizon}` as keyof PredEntry;
    const predKey   = `pred_${horizon}`   as keyof PredEntry;

    return [...entries]
      .filter((e) => {
        const change = e[changeKey] as number;
        return type === "rise" ? change > 0 : change < 0;
      })
      .sort((a, b) => {
        if (sortKey === "score" && type === "rise") {
          return (b.rise_score ?? 0) - (a.rise_score ?? 0);
        }
        if (sortKey === "rate") {
          return Math.abs(b[changeKey] as number) - Math.abs(a[changeKey] as number);
        }
        const amtA = Math.abs((a[predKey] as number) - a.current_price);
        const amtB = Math.abs((b[predKey] as number) - b.current_price);
        return amtB - amtA;
      })
      .slice(0, 50);
  }, [entries, horizon, sortKey, type]);

  const accentColor = type === "rise" ? "#22c55e" : "#ef4444";
  const accentBg    = type === "rise" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        {/* 期間タブ */}
        <div className="flex rounded-lg border border-[#2a2a2e] overflow-hidden text-sm">
          {(["1w", "1m", "1y"] as Horizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className="flex-1 px-3 py-2 transition-colors text-center"
              style={
                horizon === h
                  ? { backgroundColor: accentBg, color: accentColor, fontWeight: 600 }
                  : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
              }
            >
              {HORIZON_LABEL[h]}
            </button>
          ))}
        </div>

        {/* 並び替え */}
        <div className="flex rounded-lg border border-[#2a2a2e] overflow-hidden text-sm">
          {type === "rise" && (
            <button
              onClick={() => setSortKey("score")}
              className="flex-1 px-3 py-2 transition-colors text-center"
              style={
                sortKey === "score"
                  ? { backgroundColor: "#1e1e22", color: "#f9fafb", fontWeight: 600 }
                  : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
              }
            >
              信頼スコア
            </button>
          )}
          <button
            onClick={() => setSortKey("rate")}
            className="flex-1 px-3 py-2 transition-colors text-center"
            style={
              sortKey === "rate"
                ? { backgroundColor: "#1e1e22", color: "#f9fafb", fontWeight: 600 }
                : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
            }
          >
            利益率 %
          </button>
          <button
            onClick={() => setSortKey("amount")}
            className="flex-1 px-3 py-2 transition-colors text-center"
            style={
              sortKey === "amount"
                ? { backgroundColor: "#1e1e22", color: "#f9fafb", fontWeight: 600 }
                : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
            }
          >
            上昇幅 円
          </button>
        </div>

        <span className="text-xs text-[#9ca3af] sm:ml-auto">
          {sorted.length}件 / 上位50件
        </span>
      </div>

      {/* 注意書き */}
      <div className="flex items-start gap-2 text-xs text-[#9ca3af] bg-[#141416] border border-[#2a2a2e] rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          予測は過去価格の統計的参考値です。大会採用・再録・品薄など外的要因で急変します。
          売買判断は自己責任でお願いします。
        </span>
      </div>

      {/* テーブル（PC） / カードリスト（モバイル） */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
          <p>表示できるデータがありません。</p>
          <p className="text-xs mt-2">価格データが蓄積されると予測が表示されます。</p>
        </div>
      ) : (
        <>
          {/* ─── PC テーブル ─── */}
          <div className="hidden md:block rounded-lg border border-[#2a2a2e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2e] bg-[#141416]">
                  <th className="text-center px-3 py-3 text-[#9ca3af] font-medium w-10">#</th>
                  <th className="text-left px-4 py-3 text-[#9ca3af] font-medium">カード</th>
                  <th className="text-right px-4 py-3 text-[#9ca3af] font-medium">現在値</th>
                  <th className="text-right px-4 py-3 text-[#9ca3af] font-medium">
                    {HORIZON_LABEL[horizon]}予測
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: accentColor }}>
                    {sortKey === "rate" ? "利益率" : "上昇幅"}
                  </th>
                  <th className="text-center px-3 py-3 text-[#9ca3af] font-medium w-16">精度</th>
                  {type === "rise" && (
                    <th className="text-center px-3 py-3 text-[#9ca3af] font-medium w-14">Score</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2e]">
                {sorted.map((entry, i) => {
                  const changeKey = `change_${horizon}` as keyof PredEntry;
                  const predKey   = `pred_${horizon}`   as keyof PredEntry;
                  const changeRate  = entry[changeKey] as number;
                  const predPrice   = entry[predKey]   as number;
                  const changeAmt   = predPrice - entry.current_price;
                  const card        = entry.cards;
                  const dot         = CONFIDENCE_DOT[entry.confidence];
                  const insight     = entry.card_insights;
                  const badges      = (
                    <span className="flex gap-1 mt-0.5">
                      {entry.mercari_confirmed && (
                        <span className="text-[10px] text-green-400">✓実売</span>
                      )}
                      {insight?.mercari_surge && (
                        <span className="text-[10px] text-orange-400">🔥急騰</span>
                      )}
                    </span>
                  );

                  return (
                    <tr key={entry.card_id} className="hover:bg-[#1a1a1e] transition-colors">
                      <td className="px-3 py-3 text-[#9ca3af] text-center font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/card/${card.id}`} className="flex items-center gap-3 hover:text-blue-400 min-w-0">
                          <div className="w-8 h-11 relative shrink-0">
                            {card.image_url ? (
                              <Image src={card.image_url} alt="" fill className="object-contain rounded" sizes="32px" />
                            ) : (
                              <div className="w-full h-full bg-[#1e1e22] rounded" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{card.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <GameBadge game={card.game as "pokemon" | "onepiece" | "yugioh" | "mtg"} />
                              {card.rarity && (
                                <span className="text-xs text-[#9ca3af] truncate">{card.rarity}</span>
                              )}
                              {badges}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ¥{entry.current_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ¥{predPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: accentColor }}>
                        {sortKey === "rate"
                          ? `${changeRate > 0 ? "▲" : "▼"} ${Math.abs(changeRate).toFixed(1)}%`
                          : `${changeAmt > 0 ? "+" : ""}¥${changeAmt.toLocaleString()}`}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium" style={{ color: dot.color }}>
                          ● {dot.label}
                        </span>
                      </td>
                      {type === "rise" && (
                        <td className="px-3 py-3 text-center font-bold text-xs tabular-nums text-green-400">
                          {entry.rise_score ?? "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── モバイル カードリスト ─── */}
          <div className="md:hidden space-y-2">
            {sorted.map((entry, i) => {
              const changeKey  = `change_${horizon}` as keyof PredEntry;
              const predKey    = `pred_${horizon}`   as keyof PredEntry;
              const changeRate = entry[changeKey] as number;
              const predPrice  = entry[predKey]   as number;
              const changeAmt  = predPrice - entry.current_price;
              const card       = entry.cards;

              return (
                <Link
                  key={entry.card_id}
                  href={`/card/${card.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2a2e] bg-[#141416] hover:border-blue-500 transition-colors"
                >
                  <span className="text-xs text-[#9ca3af] font-mono w-5 shrink-0 text-center">{i + 1}</span>
                  <div className="w-9 h-12 relative shrink-0">
                    {card.image_url ? (
                      <Image src={card.image_url} alt="" fill className="object-contain rounded" sizes="36px" />
                    ) : (
                      <div className="w-full h-full bg-[#1e1e22] rounded" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <GameBadge game={card.game as "pokemon" | "onepiece" | "yugioh" | "mtg"} />
                      {card.rarity && (
                        <span className="text-[10px] text-[#9ca3af] truncate">{card.rarity}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#9ca3af] mt-0.5">
                      現在 ¥{entry.current_price.toLocaleString()} →{" "}
                      <span className="font-medium text-white">¥{predPrice.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm" style={{ color: accentColor }}>
                      {changeRate > 0 ? "▲" : "▼"} {Math.abs(changeRate).toFixed(1)}%
                    </p>
                    <p className="text-xs text-[#9ca3af] tabular-nums">
                      {changeAmt > 0 ? "+" : ""}¥{changeAmt.toLocaleString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
