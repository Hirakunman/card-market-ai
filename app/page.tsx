import Link from "next/link";
import { TrendingUp, TrendingDown, Search, BarChart2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RankingEntry } from "@/types";
import { GameBadge } from "@/components/GameBadge";
import { PriceChange } from "@/components/PriceChange";

export const revalidate = 3600; // 1時間ごとに再生成

async function getTopRankings() {
  const [riseRes, fallRes] = await Promise.all([
    supabase.from("ranking_rise").select("*").limit(5),
    supabase.from("ranking_fall").select("*").limit(5),
  ]);
  return {
    rise: (riseRes.data ?? []) as RankingEntry[],
    fall: (fallRes.data ?? []) as RankingEntry[],
  };
}

export default async function HomePage() {
  const { rise, fall } = await getTopRankings();

  return (
    <div className="space-y-12">
      {/* ヒーロー */}
      <section className="text-center space-y-4 pt-4">
        <h1 className="text-3xl font-bold tracking-tight">
          カード価格を、株のように分析する
        </h1>
        <p className="text-[#9ca3af] max-w-xl mx-auto">
          ポケモン・ワンピース・遊戯王・MTGの価格を毎日自動収集。
          高騰・暴落をリアルタイムで検知します。
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Search className="w-4 h-4" />
          カードを検索する
        </Link>
      </section>

      {/* ランキング 2カラム */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RankingCard
          title="高騰ランキング"
          subtitle="過去7日間"
          icon={<TrendingUp className="w-5 h-5 text-green-400" />}
          entries={rise}
          type="rise"
          href="/ranking/rise"
        />
        <RankingCard
          title="暴落ランキング"
          subtitle="過去7日間"
          icon={<TrendingDown className="w-5 h-5 text-red-400" />}
          entries={fall}
          type="fall"
          href="/ranking/fall"
        />
      </section>

      {/* データなし時の説明 */}
      {rise.length === 0 && fall.length === 0 && (
        <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-8 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-[#9ca3af] mx-auto" />
          <p className="font-medium">まだデータがありません</p>
          <p className="text-sm text-[#9ca3af]">
            スクレイパーを実行するとランキングが表示されます。
            <br />
            セットアップ手順は <code className="text-blue-400">README.md</code> を参照してください。
          </p>
        </div>
      )}
    </div>
  );
}

function RankingCard({
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
  entries: RankingEntry[];
  type: "rise" | "fall";
  href: string;
}) {
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
          {entries.map((entry, i) => (
            <li key={entry.card?.id ?? i}>
              <Link
                href={`/card/${entry.card?.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1e] transition-colors"
              >
                <span className="text-sm font-bold text-[#9ca3af] w-5 text-right shrink-0">
                  {i + 1}
                </span>
                {entry.card?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.card.image_url}
                    alt={entry.card.name}
                    className="w-8 h-11 object-contain rounded shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.card?.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {entry.card?.game && <GameBadge game={entry.card.game} />}
                    <span className="text-xs text-[#9ca3af]">{entry.card?.set_name}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">
                    ¥{entry.latest_price?.toLocaleString()}
                  </p>
                  <PriceChange rate={entry.change_rate} size="sm" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
