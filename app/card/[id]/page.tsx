import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    .select("current_price,pred_1w,pred_1m,pred_1y,change_1w,change_1m,change_1y,confidence,data_days")
    .eq("card_id", cardId)
    .single();
  return data;
}

async function getPrices(cardId: string, days = 90): Promise<Price[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const { data } = await supabase
    .from("prices")
    .select("id,card_id,source,price,condition,recorded_at")
    .eq("card_id", cardId)
    .gte("recorded_at", from.toISOString())
    .order("recorded_at", { ascending: true });

  return data ?? [];
}

const GAME_LABELS: Record<string, string> = {
  pokemon: "ポケモン",
  onepiece: "ワンピース",
  yugioh: "遊戯王",
  mtg: "MTG",
};

// SEO: 動的メタデータ生成
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return { title: "カードが見つかりません" };

  const gameLabel = GAME_LABELS[card.game] ?? card.game;
  const title = `${card.name} | ${gameLabel}カード価格 - CardMarket AI`;
  const description = `${card.name}（${card.set_name ?? ""}）の価格推移・統計的参考予測を表示。${gameLabel}カードの相場をリアルタイムで確認できます。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(card.image_url ? { images: [{ url: card.image_url }] } : {}),
    },
  };
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const [card, prices, prediction] = await Promise.all([
    getCard(id),
    getPrices(id),
    getPrediction(id),
  ]);

  if (!card) notFound();

  const latestPrice = prices.at(-1)?.price ?? null;
  const price7dAgo =
    prices.find(
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

  const analysisComment = generateAnalysis(changeRate, latestPrice, prices.length);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* パンくずナビ */}
      <nav className="flex items-center gap-1 text-xs text-[#9ca3af]">
        <Link href="/" className="hover:text-white transition-colors">ホーム</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-white transition-colors">カード検索</Link>
        <span>/</span>
        <span className="text-white truncate max-w-[200px]">{card.name}</span>
      </nav>

      {/* カードヒーロー */}
      <div className="flex gap-5 flex-wrap sm:flex-nowrap">
        {/* 画像 */}
        <div className="w-32 sm:w-40 shrink-0">
          {card.image_url ? (
            <div className="relative w-full aspect-[2/3]">
              <Image
                src={card.image_url}
                alt={card.name}
                fill
                className="object-contain rounded-lg"
                priority
                sizes="(max-width: 640px) 128px, 160px"
              />
            </div>
          ) : (
            <div className="w-full aspect-[2/3] bg-[#1e1e22] rounded-lg flex items-center justify-center text-[#9ca3af] text-xs">
              No Image
            </div>
          )}
        </div>

        {/* カード情報 */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <GameBadge game={card.game} />
            {card.rarity && (
              <span className="text-xs text-[#9ca3af] border border-[#2a2a2e] px-2 py-0.5 rounded">
                {card.rarity}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{card.name}</h1>
          {card.name_ja && card.name_ja !== card.name && (
            <p className="text-sm text-[#9ca3af]">{card.name_ja}</p>
          )}
          {card.set_name && (
            <p className="text-sm text-[#9ca3af]">{card.set_name}</p>
          )}

          {latestPrice ? (
            <div className="flex items-baseline gap-3 flex-wrap pt-1">
              <span className="text-3xl font-bold tabular-nums">
                ¥{latestPrice.toLocaleString()}
              </span>
              <PriceChange rate={changeRate} amount={changeAmount} />
              <span className="text-xs text-[#9ca3af]">7日間比較</span>
            </div>
          ) : (
            <p className="text-sm text-[#9ca3af] pt-1">価格データなし</p>
          )}
        </div>
      </div>

      {/* 価格グラフ */}
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold">価格推移（過去90日）</h2>
          <span className="text-xs text-[#9ca3af]">{prices.length}件のデータ</span>
        </div>
        <PriceChart prices={prices} />
      </div>

      {/* 価格予測 */}
      <PricePrediction prediction={prediction} />

      {/* 分析コメント */}
      {prices.length >= 2 && (
        <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4 space-y-2">
          <h2 className="font-semibold text-sm text-[#9ca3af]">価格動向メモ</h2>
          <p className="text-sm leading-relaxed">{analysisComment}</p>
        </div>
      )}

      {/* 価格履歴テーブル */}
      {prices.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2e] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a2e] bg-[#141416]">
            <h2 className="font-semibold text-sm">価格履歴（直近20件）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2e]">
                  <th className="text-left px-4 py-2 text-[#9ca3af] font-medium whitespace-nowrap">日時</th>
                  <th className="text-right px-4 py-2 text-[#9ca3af] font-medium whitespace-nowrap">価格</th>
                  <th className="text-right px-4 py-2 text-[#9ca3af] font-medium whitespace-nowrap">出典</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2e]">
                {[...prices].reverse().slice(0, 20).map((p) => (
                  <tr key={p.id} className="hover:bg-[#1a1a1e] transition-colors">
                    <td className="px-4 py-2 text-[#9ca3af] whitespace-nowrap">
                      {new Date(p.recorded_at).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                      ¥{p.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-[#9ca3af] whitespace-nowrap">
                      {p.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 戻るリンク */}
      <Link
        href="/search"
        className="inline-flex items-center gap-1.5 text-sm text-[#9ca3af] hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        カード検索に戻る
      </Link>
    </div>
  );
}

function generateAnalysis(
  changeRate: number | null,
  latestPrice: number | null,
  dataPoints: number
): string {
  if (!latestPrice || dataPoints < 2) return "";

  if (changeRate === null) {
    return "7日前の価格データがないため変動率を計算できません。";
  }

  if (changeRate >= 30) {
    return `過去7日間で ${changeRate.toFixed(1)}% の急騰を記録。大会採用や在庫枯渇の可能性があります。高値掴みに注意してください。`;
  }
  if (changeRate >= 10) {
    return `過去7日間で ${changeRate.toFixed(1)}% 上昇。緩やかな需要増加が見られます。`;
  }
  if (changeRate >= -10) {
    return `過去7日間の価格変動は ${changeRate.toFixed(1)}% で比較的安定しています。`;
  }
  if (changeRate >= -30) {
    return `過去7日間で ${Math.abs(changeRate).toFixed(1)}% 下落。再録・弾落ちの可能性があります。`;
  }
  return `過去7日間で ${Math.abs(changeRate).toFixed(1)}% の急落。再録または環境外転落が疑われます。`;
}
