import { TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RankingEntry } from "@/types";
import { GameBadge } from "@/components/GameBadge";
import { PriceChange } from "@/components/PriceChange";
import Link from "next/link";

export const revalidate = 3600;

export const metadata = { title: "暴落ランキング | CardMarket AI" };

export default async function FallRankingPage() {
  const { data } = await supabase
    .from("ranking_fall")
    .select("*")
    .limit(50);

  const entries = (data ?? []) as RankingEntry[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">暴落ランキング</h1>
          <p className="text-sm text-[#9ca3af]">過去7日間で価格が下落したカード TOP50</p>
        </div>
      </div>

      <FallTable entries={entries} />
    </div>
  );
}

function FallTable({ entries }: { entries: RankingEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
        データがまだありません。スクレイパーを実行してください。
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#2a2a2e] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2e] bg-[#141416]">
            <th className="text-left px-4 py-3 text-[#9ca3af] font-medium w-10">#</th>
            <th className="text-left px-4 py-3 text-[#9ca3af] font-medium">カード</th>
            <th className="text-right px-4 py-3 text-[#9ca3af] font-medium">現在値</th>
            <th className="text-right px-4 py-3 text-[#9ca3af] font-medium">7日前</th>
            <th className="text-right px-4 py-3 text-[#9ca3af] font-medium">変動</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a2a2e]">
          {entries.map((entry, i) => (
            <tr key={entry.card?.id ?? i} className="hover:bg-[#1a1a1e] transition-colors">
              <td className="px-4 py-3 text-[#9ca3af] text-right">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/card/${entry.card?.id}`} className="flex items-center gap-3 hover:text-blue-400">
                  {entry.card?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.card.image_url} alt="" className="w-8 h-11 object-contain rounded shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">{entry.card?.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {entry.card?.game && <GameBadge game={entry.card.game} />}
                      <span className="text-xs text-[#9ca3af]">{entry.card?.set_name}</span>
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                ¥{entry.latest_price?.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-[#9ca3af] tabular-nums">
                ¥{entry.price_7d_ago?.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <PriceChange rate={entry.change_rate} amount={entry.change_amount} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
