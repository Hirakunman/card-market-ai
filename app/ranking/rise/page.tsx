import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PredictionRankingTable } from "@/components/PredictionRankingTable";

export const revalidate = 1800; // 30分（高騰データはこまめに更新）
export const metadata = { title: "高騰予測ランキング | CardMarket AI" };

export default async function RiseRankingPage() {
  const { data } = await supabase
    .from("predictions")
    .select(
      "card_id,current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days,rise_score,mercari_confirmed,cards(id,name,game,set_name,rarity,image_url),card_insights(mercari_surge,mercari_change_7d,reprint_risk)"
    )
    .gt("rise_score", 5)
    .order("rise_score", { ascending: false })
    .limit(200);

  const entries = (data ?? []) as Parameters<typeof PredictionRankingTable>[0]["entries"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">高騰予測ランキング</h1>
          <p className="text-sm text-[#9ca3af]">
            メルカリ実売・再販リスク・データ量を加味した信頼スコア順 — 精度の低い候補は自動除外
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] px-4 py-3 text-xs text-[#9ca3af] space-y-1">
        <p>🔥 = メルカリ急騰確認済み　✓ = 実売データあり　スコア = 高騰信頼度（0〜100）</p>
        <p>再販リスクが高いカードはスコアが自動的に下がり、ランキング上位に出にくくなります。</p>
      </div>

      <PredictionRankingTable entries={entries} type="rise" />
    </div>
  );
}
