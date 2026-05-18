import { Game } from "@/types";
import { cn } from "@/lib/utils";

const GAME_LABELS: Record<Game, string> = {
  pokemon: "ポケモン",
  onepiece: "ワンピース",
  yugioh: "遊戯王",
  mtg: "MTG",
};

const GAME_COLORS: Record<Game, string> = {
  pokemon: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
  onepiece: "bg-red-900/40 text-red-300 border-red-800",
  yugioh: "bg-purple-900/40 text-purple-300 border-purple-800",
  mtg: "bg-blue-900/40 text-blue-300 border-blue-800",
};

export function GameBadge({ game }: { game: Game }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium",
        GAME_COLORS[game]
      )}
    >
      {GAME_LABELS[game]}
    </span>
  );
}
