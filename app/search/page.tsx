"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
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

// PostgREST の ilike フィルタで特殊文字をエスケープ
function escapePostgrest(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-3 animate-pulse">
      <div className="w-full aspect-[2/3] bg-[#1e1e22] rounded mb-2" />
      <div className="h-3 bg-[#1e1e22] rounded w-3/4 mb-1.5" />
      <div className="h-3 bg-[#1e1e22] rounded w-1/2" />
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState<Game | "all">("all");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string, g: Game | "all") => {
    // 空クエリ＆全ゲームの場合は何もしない（DB全件取得防止）
    if (!q.trim() && g === "all") {
      setResults([]);
      setSearched(false);
      return;
    }

    // 前のリクエストをキャンセル
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setSearched(true);

    try {
      let req = supabase
        .from("cards")
        .select("id,name,name_ja,game,set_name,rarity,image_url")
        .order("name")
        .limit(60);

      if (g !== "all") req = req.eq("game", g);

      if (q.trim()) {
        const safe = escapePostgrest(q.trim());
        req = req.or(`name.ilike.%${safe}%,name_ja.ilike.%${safe}%`);
      }

      const { data, error } = await req;
      if (error) throw error;
      setResults(data ?? []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // デバウンス: 400ms 後に検索実行
  useEffect(() => {
    const timer = setTimeout(() => search(query, game), 400);
    return () => clearTimeout(timer);
  }, [query, game, search]);

  const clearQuery = () => setQuery("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">カード検索</h1>
        <p className="text-sm text-[#9ca3af] mt-1">
          約16,000枚以上の日本語カードから検索できます
        </p>
      </div>

      {/* 検索フォーム */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="カード名を入力…（例: ピカチュウ、リリカル）"
            autoComplete="off"
            className="w-full bg-[#141416] border border-[#2a2a2e] rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white"
              aria-label="クリア"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ゲームフィルタ */}
        <div className="flex gap-2 flex-wrap">
          {GAMES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setGame(value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                game === value
                  ? "bg-blue-600 text-white font-medium"
                  : "bg-[#1e1e22] text-[#9ca3af] hover:text-white hover:bg-[#2a2a2e]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 検索結果 */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af] space-y-2">
          <Search className="w-8 h-8 mx-auto opacity-40" />
          <p className="font-medium text-white">カードが見つかりませんでした</p>
          <p className="text-sm">別のキーワードや表記（ひらがな・カタカナ）で試してみてください</p>
        </div>
      )}

      {!loading && !searched && (
        <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-8 text-center text-[#9ca3af] space-y-2">
          <Search className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-sm">カード名を入力すると検索結果が表示されます</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-[#9ca3af]">{results.length}件{results.length >= 60 ? "（上位60件）" : ""}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.map((card) => (
              <Link
                key={card.id}
                href={`/card/${card.id}`}
                className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-3 hover:border-blue-500 transition-colors group"
              >
                {card.image_url ? (
                  <div className="w-full aspect-[2/3] relative mb-2">
                    <Image
                      src={card.image_url}
                      alt={card.name}
                      fill
                      className="object-contain rounded"
                      sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 18vw"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-[2/3] bg-[#1e1e22] rounded mb-2 flex items-center justify-center text-[#9ca3af] text-xs">
                    No Image
                  </div>
                )}
                <p className="text-xs font-medium line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                  {card.name}
                </p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <GameBadge game={card.game} />
                  {card.rarity && (
                    <span className="text-[10px] text-[#9ca3af]">{card.rarity}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
