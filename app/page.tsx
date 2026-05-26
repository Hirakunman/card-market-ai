import Link from "next/link";
import { TrendingUp, TrendingDown, Search, BarChart2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GameBadge } from "@/components/GameBadge";

export const dynamic = "force-dynamic";

type PredEntry = {
  card_id: string;
  current_price: number;
  pred_1m: number;
  change_1m: number;
  confidence: string;
  cards: {
    id: string;
    name: string;
    game: string;
    set_name: string;
    image_url: string | null;
  };
};

async function getTopPredictions() {
  const [riseRes, fallRes] = await Promise.all([
    supabase
      .from("predictions")
      .select("card_id,current_price,pred_1m,change_1m,confidence,cards(id,name,game,set_name,image_url)")
      .gt("change_1m", 0)
      .order("change_1m", { ascending: false })
      .limit(5),
    supabase
      .from("predictions")
      .select("card_id,current_price,pred_1m,change_1m,confidence,cards(id,name,game,set_name,image_url)")
      .lt("change_1m", 0)
      .order("change_1m", { ascending: true })
      .limit(5),
  ]);
  if (riseRes.error) console.error("home rise error:", riseRes.error.message);
  if (fallRes.error) console.error("home fall error:", fallRes.error.message);
  return {
    rise: (riseRes.data ?? []) as PredEntry[],
    fall: (fallRes.data ?? []) as PredEntry[],
  };
}

export default async function HomePage() {
  const { rise, fall } = await getTopPredictions();

  return (
    <div className="space-y-12">
      {/* ヒーロー */}
      <section className="text-center space-y-4 pt-4">
        <h1 className="text-3xl font-bold tracking-tight">
          カード価格を、株のように分析する
        </h1>
        <p className="text-[#9ca3af] max-w-xl mx-auto">
          ポケモン・ワンピース・遊戯王・MTGの価格を毎日自動収集。
          過去データをもとに1週間後・1ヶ月後・1年後の参考価格を算出します。
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Search className="w-4 h-4" />
          カードを検索する
        </Link>
      </section>

      {/* 予測ランキング 2カラム */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PredRankingCard
          title="高騰予測ランキング"
          subtitle="1ヶ月後予測"
          icon={<TrendingUp className="w-5 h-5 text-green-400" />}
          entries={rise}
          type="rise"
          href="/ranking/rise"
        />
        <PredRankingCard
          title="暴落予測ランキング"
          subtitle="1ヶ月後予測"
          icon={<TrendingDown className="w-5 h-5 text-red-400" />}
          entries={fall}
          type="fall"
          href="/ranking/fall"
        />
      </section>

      {rise.length === 0 && fall.length === 0 && (
        <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-8 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-[#9ca3af] mx-auto" />
          <p className="font-medium">予測データ生成中</p>
          <p className="text-sm text-[#9ca3af]">
            価格データが蓄積されると予測ランキングが表示されます。
          </p>
        </div>
      )}
    </div>
  );
}

function PredRankingCard({
  title,
  subtitle,
  icon,
  entries,
  type,
  href,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  entries: PredEntry[];
  type: "rise" | "fall";
  href: string;
}) {
  const accentColor = type === "rise" ? "#22c55e" : "#ef4444";

  return (
    <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2e]">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold">{title}</span>
          <span className="text-xs text-[#9ca3af]">{subtitle}</span>
        </div>
        <Link href={href} className="text-xs text-blue-400 hover:text-blue-300">
          全件表示 →
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="p-6 text-sm text-center text-[#9ca3af]">データなし</p>
      ) : (
        <ul className="divide-y divide-[#2a2a2e]">
          {entries.map((entry, i) => {
            const card = entry.cards;
            const changeAmt = entry.pred_1m - entry.current_price;
            return (
              <li key={entry.card_id}>
                <Link
                  href={`/card/${card.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1e] transition-colors"
                >
                  <span className="text-sm font-bold text-[#9ca3af] w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  {card.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image_url}
                      alt={card.name}
                      className="w-8 h-11 object-contain rounded shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-11 bg-[#1e1e22] rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <GameBadge game={card.game as "pokemon" | "onepiece" | "yugioh" | "mtg"} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">
                      ¥{entry.pred_1m.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold tabular-nums" style={{ color: accentColor }}>
                      {type === "rise" ? "▲" : "▼"} {Math.abs(entry.change_1m).toFixed(1)}%
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
