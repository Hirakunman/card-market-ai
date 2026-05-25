import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PredictionRankingTable } from "@/components/PredictionRankingTable";
import { calcRiseScore } from "@/lib/riseScore";

export const revalidate = 1800;
export const metadata = { title: "高騰予測ランキング | CardMarket AI" };

type RawEntry = {
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
    card_insights: {
      mercari_surge: boolean;
      mercari_change_7d: number | null;
      reprint_risk: string;
      mercari_price: number | null;
    } | null;
  };
};

async function getRiseEntries() {
  const { data, error } = await supabase
    .from("predictions")
    .select(
      "card_id,current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days,cards(id,name,game,set_name,rarity,image_url,card_insights(mercari_surge,mercari_change_7d,reprint_risk,mercari_price))"
    )
    .gt("change_1m", 0)
    .order("change_1m", { ascending: false })
    .limit(300);

  if (error || !data) return [];

  return (data as RawEntry[])
    .map((row) => {
      const insight = row.cards?.card_insights ?? null;
      const mercari_confirmed = insight?.mercari_price != null;
      const rise_score = calcRiseScore(
        { ...row, mercari_confirmed },
        insight
      );
      return {
        ...row,
        rise_score,
        mercari_confirmed,
        card_insights: insight,
      };
    })
    .filter((e) => e.rise_score > 3)
    .sort((a, b) => b.rise_score - a.rise_score)
    .slice(0, 200);
}

export default async function RiseRankingPage() {
  const entries = await getRiseEntries();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold">高騰予測ランキング</h1>
          <p className="text-sm text-[#9ca3af]">
            メルカリ実売・再販リスクを加味した信頼スコア順（ジョブが毎日自動更新）
          </p>
        </div>
      </div>

      <PredictionRankingTable
        entries={entries as Parameters<typeof PredictionRankingTable>[0]["entries"]}
        type="rise"
      />
    </div>
  );
}
