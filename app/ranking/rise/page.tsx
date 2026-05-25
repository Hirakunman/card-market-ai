import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PredictionRankingTable } from "@/components/PredictionRankingTable";

export const revalidate = 1800;
export const metadata = { title: "高騰予測ランキング | CardMarket AI" };

async function getRiseEntries() {
  // まず rise_score 順（列がある場合）
  const scored = await supabase
    .from("predictions")
    .select(
      "card_id,current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days,rise_score,mercari_confirmed,cards(id,name,game,set_name,rarity,image_url)"
    )
    .gt("rise_score", 5)
    .order("rise_score", { ascending: false })
    .limit(200);

  if (!scored.error && (scored.data?.length ?? 0) > 0) {
    return scored.data ?? [];
  }

  // フォールバック: rise_score列未作成 or データなし → 上昇率順
  const fallback = await supabase
    .from("predictions")
    .select(
      "card_id,current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days,cards(id,name,game,set_name,rarity,image_url)"
    )
    .gt("change_1m", 0)
    .order("change_1m", { ascending: false })
    .limit(200);

  return fallback.data ?? [];
}

export default async function RiseRankingPage() {
  const entries = (await getRiseEntries()) as Parameters<
    typeof PredictionRankingTable
  >[0]["entries"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">高騰予測ランキング</h1>
          <p className="text-sm text-[#9ca3af]">
            過去の価格推移から上昇が見込まれるカード — 信頼スコア順で表示
          </p>
        </div>
      </div>

      <PredictionRankingTable entries={entries} type="rise" />
    </div>
  );
}
