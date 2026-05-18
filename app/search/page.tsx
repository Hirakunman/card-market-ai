"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, Game } from "@/types";
import { GameBadge } from "@/components/GameBadge";

const GAMES: { value: Game | "all"; label: string }[] = [
  { value: "all", label: "全ゲーム" },
  { value: "pokemon", label: "ポケモン" },
  { value: "onepiece", label: "ワンピース" },
  { value: "yugioh", label: "遊戯王" },
  { value: "mtg", label: "MTG" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState<Game | "all">("all");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    let q = supabase
      .from("cards")
      .select("*")
      .order("name")
      .limit(60);

    if (game !== "all") q = q.eq("game", game);

    if (query.trim()) {
      q = q.or(
        `name.ilike.%${query}%,name_ja.ilike.%${query}%`
      );
    }

    const { data } = await q;
    setResults(data ?? []);
    setLoading(false);
  }, [query, game]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">カード検索</h1>

      {/* 検索フォーム */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="カード名を入力..."
            className="w-full bg-[#141416] border border-[#2a2a2e] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* ゲームフィルタ */}
        <div className="flex gap-2 flex-wrap">
          {GAMES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setGame(value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                game === value
                  ? "bg-blue-600 text-white"
                  : "bg-[#1e1e22] text-[#9ca3af] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 検索結果 */}
      {loading && (
        <p className="text-sm text-[#9ca3af]">検索中...</p>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
          カードが見つかりませんでした
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map((card) => (
            <Link
              key={card.id}
              href={`/card/${card.id}`}
              className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-3 hover:border-blue-500 transition-colors group"
            >
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-full aspect-[2/3] object-contain rounded mb-2"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-[#1e1e22] rounded mb-2 flex items-center justify-center text-[#9ca3af] text-xs">
                  No Image
                </div>
              )}
              <p className="text-xs font-medium truncate group-hover:text-blue-400 transition-colors">
                {card.name}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <GameBadge game={card.game} />
              </div>
              <p className="text-xs text-[#9ca3af] truncate mt-0.5">{card.set_name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
