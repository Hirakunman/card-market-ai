"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { GameBadge } from "@/components/GameBadge";

type Horizon = "1w" | "1m" | "1y";
type SortKey = "rate" | "amount";

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

const CONFIDENCE_COLOR: Record<string, string> = {
  low: "#9ca3af",
  medium: "#f59e0b",
  high: "#22c55e",
};

export function PredictionRankingTable({ entries, type }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const [sortKey, setSortKey] = useState<SortKey>("rate");

  const sorted = useMemo(() => {
    const changeKey = `change_${horizon}` as keyof PredEntry;
    const predKey = `pred_${horizon}` as keyof PredEntry;

    return [...entries]
      .filter((e) => {
        const change = e[changeKey] as number;
        return type === "rise" ? change > 0 : change < 0;
      })
      .sort((a, b) => {
        if (sortKey === "rate") {
          const ra = Math.abs(a[changeKey] as number);
          const rb = Math.abs(b[changeKey] as number);
          return rb - ra;
        } else {
          const amtA = Math.abs((a[predKey] as number) - a.current_price);
          const amtB = Math.abs((b[predKey] as number) - b.current_price);
          return amtB - amtA;
        }
      })
      .slice(0, 50);
  }, [entries, horizon, sortKey, type]);

  const accentColor = type === "rise" ? "#22c55e" : "#ef4444";
  const accentBg = type === "rise" ? "#052e16" : "#2d0707";

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 期間タブ */}
        <div className="flex rounded-lg border border-[#2a2a2e] overflow-hidden text-sm">
          {(["1w", "1m", "1y"] as Horizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className="px-4 py-2 transition-colors"
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

        {/* 並び替えタブ */}
        <div className="flex rounded-lg border border-[#2a2a2e] overflow-hidden text-sm">
          <button
            onClick={() => setSortKey("rate")}
            className="px-4 py-2 transition-colors"
            style={
              sortKey === "rate"
                ? { backgroundColor: "#1e1e22", color: "#f9fafb", fontWeight: 600 }
                : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
            }
          >
            利益率順（%）
          </button>
          <button
            onClick={() => setSortKey("amount")}
            className="px-4 py-2 transition-colors"
            style={
              sortKey === "amount"
                ? { backgroundColor: "#1e1e22", color: "#f9fafb", fontWeight: 600 }
                : { backgroundColor: "#0d0d0f", color: "#9ca3af" }
            }
          >
            上がり幅順（円）
          </button>
        </div>

        <span className="text-xs text-[#9ca3af] ml-auto">{sorted.length}件</span>
      </div>

      {/* テーブル */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
          <p>表示できるデータがありません。</p>
          <p className="text-xs mt-2">価格データが蓄積されると予測が生成されます。</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#2a2a2e] overflow-hidden">
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
                  {sortKey === "rate" ? "利益率" : "上がり幅"}
                </th>
                <th className="text-center px-3 py-3 text-[#9ca3af] font-medium">信頼度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2e]">
              {sorted.map((entry, i) => {
                const changeKey = `change_${horizon}` as keyof PredEntry;
                const predKey = `pred_${horizon}` as keyof PredEntry;
                const changeRate = entry[changeKey] as number;
                const predPrice = entry[predKey] as number;
                const changeAmt = predPrice - entry.current_price;
                const card = entry.cards;
                const confColor = CONFIDENCE_COLOR[entry.confidence] ?? "#9ca3af";

                return (
                  <tr key={entry.card_id} className="hover:bg-[#1a1a1e] transition-colors">
                    <td className="px-3 py-3 text-[#9ca3af] text-center font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/card/${card.id}`}
                        className="flex items-center gap-3 hover:text-blue-400"
                      >
                        {card.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={card.image_url}
                            alt=""
                            className="w-8 h-11 object-contain rounded shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-11 bg-[#1e1e22] rounded shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">{card.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <GameBadge game={card.game as "pokemon" | "onepiece" | "yugioh" | "mtg"} />
                            {card.rarity && (
                              <span className="text-xs text-[#9ca3af]">{card.rarity}</span>
                            )}
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
                      {sortKey === "rate" ? (
                        <span>
                          {changeRate > 0 ? "▲" : "▼"} {Math.abs(changeRate).toFixed(1)}%
                        </span>
                      ) : (
                        <span>
                          {changeAmt > 0 ? "+" : ""}¥{changeAmt.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ color: confColor }}
                      >
                        {entry.confidence === "high"
                          ? "高"
                          : entry.confidence === "medium"
                          ? "中"
                          : "低"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#9ca3af]">
        ※ 予測はアルゴリズムによる参考値です。投資・売買の判断は自己責任でお願いします。
      </p>
    </div>
  );
}
