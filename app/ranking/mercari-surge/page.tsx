import Link from "next/link";
import Image from "next/image";
import { Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GameBadge } from "@/components/GameBadge";
import type { Game } from "@/types";

export const revalidate = 3600;
export const metadata = { title: "メルカリ急騰ランキング | CardMarket AI" };

type SurgeEntry = {
  card_id: string;
  mercari_price: number;
  mercari_change_7d: number;
  cards: {
    id: string;
    name: string;
    game: string;
    set_name: string;
    rarity: string | null;
    image_url: string | null;
  };
};

async function getMercariSurges(): Promise<SurgeEntry[]> {
  const { data } = await supabase
    .from("card_insights")
    .select("card_id,mercari_price,mercari_change_7d,cards(id,name,game,set_name,rarity,image_url)")
    .eq("mercari_surge", true)
    .order("mercari_change_7d", { ascending: false })
    .limit(50);

  return (data ?? []) as SurgeEntry[];
}

export default async function MercariSurgePage() {
  const entries = await getMercariSurges();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flame className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold">メルカリ急騰ランキング</h1>
          <p className="text-sm text-[#9ca3af]">
            過去7日でメルカリ売切相場が15%以上上昇したカード
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-xs text-[#9ca3af]">
        メルカリの売切商品価格をもとに算出しています。実際の取引価格は商品状態・送料込み等で変動します。
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
          <Flame className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>急騰データを収集中です。</p>
          <p className="text-xs mt-2">メルカリ相場が7日分たまると表示されます。</p>
        </div>
      ) : (
        <>
          {/* PC テーブル */}
          <div className="hidden md:block rounded-lg border border-[#2a2a2e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2e] bg-[#141416]">
                  <th className="text-center px-3 py-3 text-[#9ca3af] w-10">#</th>
                  <th className="text-left px-4 py-3 text-[#9ca3af]">カード</th>
                  <th className="text-right px-4 py-3 text-[#9ca3af]">メルカリ相場</th>
                  <th className="text-right px-4 py-3 text-orange-400">7日騰落率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2e]">
                {entries.map((entry, i) => {
                  const card = entry.cards;
                  return (
                    <tr key={entry.card_id} className="hover:bg-[#1a1a1e]">
                      <td className="px-3 py-3 text-center text-[#9ca3af] font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/card/${card.id}`} className="flex items-center gap-3 hover:text-blue-400">
                          <div className="w-8 h-11 relative shrink-0">
                            {card.image_url ? (
                              <Image src={card.image_url} alt="" fill className="object-contain rounded" sizes="32px" />
                            ) : (
                              <div className="w-full h-full bg-[#1e1e22] rounded" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{card.name}</p>
                            <GameBadge game={card.game as Game} />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ¥{entry.mercari_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-400 tabular-nums">
                        ▲ +{entry.mercari_change_7d}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* モバイル */}
          <div className="md:hidden space-y-2">
            {entries.map((entry, i) => {
              const card = entry.cards;
              return (
                <Link
                  key={entry.card_id}
                  href={`/card/${card.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2a2e] bg-[#141416] hover:border-orange-500/50"
                >
                  <span className="text-xs text-[#9ca3af] font-mono w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.name}</p>
                    <p className="text-xs text-[#9ca3af]">¥{entry.mercari_price.toLocaleString()}</p>
                  </div>
                  <span className="text-orange-400 font-bold text-sm">+{entry.mercari_change_7d}%</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
