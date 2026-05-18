import { TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PredictionRankingTable } from "@/components/PredictionRankingTable";

export const revalidate = 3600;
export const metadata = { title: "暴落予測ランキング | CardMarket AI" };

export default async function FallRankingPage() {
  const { data } = await supabase
    .from("predictions")
    .select("card_id,current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days,cards(id,name,game,set_name,rarity,image_url)")
    .or("change_1w.lt.0,change_1m.lt.0,change_1y.lt.0")
    .order("change_1m", { ascending: true })
    .limit(200);

  const entries = (data ?? []) as Parameters<typeof PredictionRankingTable>[0]["entries"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">暴落予測ランキング</h1>
          <p className="text-sm text-[#9ca3af]">
            過去の価格推移から統計的に下落が見込まれるカード TOP50 — 期間・並び順を変更できます
          </p>
        </div>
      </div>

      <PredictionRankingTable entries={entries} type="fall" />
    </div>
  );
}
