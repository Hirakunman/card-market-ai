import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, Price } from "@/types";
import { GameBadge } from "@/components/GameBadge";
import { PriceChange } from "@/components/PriceChange";
import { PriceChart } from "@/components/PriceChart";
import { PricePrediction } from "@/components/PricePrediction";

export const revalidate = 3600;

type Params = { id: string };

async function getCard(id: string): Promise<Card | null> {
  const { data } = await supabase.from("cards").select("*").eq("id", id).single();
  return data;
}

type Prediction = {
  current_price: number;
  pred_1w: number;
  pred_1m: number;
  pred_1y: number;
  change_1w: number;
  change_1m: number;
  change_1y: number;
  confidence: "low" | "medium" | "high";
  data_days: number;
};

async function getPrediction(cardId: string): Promise<Prediction | null> {
  const { data } = await supabase
    .from("predictions")
    .select("*")
    .eq("card_id", cardId)
    .single();
  return data;
}

async function getPrices(cardId: string, days = 90): Promise<Price[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const { data } = await supabase
    .from("prices")
    .select("*")
    .eq("card_id", cardId)
    .gte("recorded_at", from.toISOString())
    .order("recorded_at", { ascending: true });

  return data ?? [];
}

export default async function CardDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [card, prices, prediction] = await Promise.all([
    getCard(id),
    getPrices(id),
    getPrediction(id),
  ]);

  if (!card) notFound();

  const latestPrice = prices.at(-1)?.price ?? null;
  const price7dAgo = prices.find(
    (p) =>
      new Date(p.recorded_at) <=
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  )?.price ?? null;

  const changeRate =
    latestPrice && price7dAgo
      ? ((latestPrice - price7dAgo) / price7dAgo) * 100
      : null;
  const changeAmount =
    latestPrice && price7dAgo ? latestPrice - price7dAgo : null;

  // ルールベース自動分析コメント（AI不要・無料）
  const analysisComment = generateAnalysis(changeRate, latestPrice, prices.length);

  return (
    <div className="space-y-8">
      {/* カード情報 */}
      <div className="flex gap-6 flex-wrap">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.name}
            className="w-36 h-auto object-contain rounded-lg shrink-0"
          />
        ) : (
          <div className="w-36 h-48 bg-[#1e1e22] rounded-lg shrink-0 flex items-center justify-center text-[#9ca3af] text-xs">
            No Image
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <GameBadge game={card.game} />
            {card.rarity && (
              <span className="text-xs text-[#9ca3af] border border-[#2a2a2e] px-2 py-0.5 rounded">
                {card.rarity}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{card.name}</h1>
          {card.name_ja && card.name_ja !== card.name && (
            <p className="text-[#9ca3af]">{card.name_ja}</p>
          )}
          <p className="text-sm text-[#9ca3af]">{card.set_name}</p>

          {latestPrice && (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-bold">¥{latestPrice.toLocaleString()}</span>
              <PriceChange rate={changeRate} amount={changeAmount} />
              <span className="text-xs text-[#9ca3af]">7日間比較</span>
            </div>
          )}
        </div>
      </div>

      {/* 価格グラフ */}
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">価格推移（過去90日）</h2>
          <span className="text-xs text-[#9ca3af]">データ点数: {prices.length}</span>
        </div>
        <PriceChart prices={prices} />
      </div>

      {/* 価格予測 */}
      <PricePrediction prediction={prediction} />

      {/* 自動分析コメント */}
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4 space-y-2">
        <h2 className="font-semibold text-sm text-[#9ca3af]">価格分析</h2>
        <p className="text-sm leading-relaxed">{analysisComment}</p>
        <p className="text-xs text-[#9ca3af]">
          ※ 価格情報は参考目的のみです。売買判断は自己責任でお願いします。
        </p>
      </div>

      {/* 価格履歴テーブル */}
      {prices.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2e] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a2e] bg-[#141416]">
            <h2 className="font-semibold text-sm">価格履歴</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2e]">
                <th className="text-left px-4 py-2 text-[#9ca3af] font-medium">日時</th>
                <th className="text-right px-4 py-2 text-[#9ca3af] font-medium">価格</th>
                <th className="text-right px-4 py-2 text-[#9ca3af] font-medium">出典</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2e]">
              {[...prices].reverse().slice(0, 20).map((p) => (
                <tr key={p.id} className="hover:bg-[#1a1a1e]">
                  <td className="px-4 py-2 text-[#9ca3af]">
                    {new Date(p.recorded_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    ¥{p.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-[#9ca3af]">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function generateAnalysis(
  changeRate: number | null,
  latestPrice: number | null,
  dataPoints: number
): string {
  if (!latestPrice || dataPoints < 2) {
    return "価格データが少ないため分析できません。データが蓄積されると自動分析が表示されます。";
  }

  const lines: string[] = [];

  if (changeRate === null) {
    lines.push("7日前の価格データがないため変動率を計算できません。");
  } else if (changeRate >= 30) {
    lines.push(`過去7日間で ${changeRate.toFixed(1)}% の急騰を記録しています。`);
    lines.push("大会環境での採用増加や在庫不足が原因の可能性があります。高値掴みに注意してください。");
  } else if (changeRate >= 10) {
    lines.push(`過去7日間で ${changeRate.toFixed(1)}% 上昇しています。`);
    lines.push("緩やかな需要増加が見られます。今後の動向を引き続き確認してください。");
  } else if (changeRate >= -10) {
    lines.push(`過去7日間の価格変動は ${changeRate.toFixed(1)}% で安定しています。`);
  } else if (changeRate >= -30) {
    lines.push(`過去7日間で ${Math.abs(changeRate).toFixed(1)}% 下落しています。`);
    lines.push("再録・弾落ちの可能性があります。下落が続く場合は売り時を検討してください。");
  } else {
    lines.push(`過去7日間で ${Math.abs(changeRate).toFixed(1)}% の急落を記録しています。`);
    lines.push("再録または環境外への転落が疑われます。底値を見極めてから動くことをお勧めします。");
  }

  return lines.join(" ");
}
