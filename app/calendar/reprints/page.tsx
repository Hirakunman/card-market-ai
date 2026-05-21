import Link from "next/link";
import { Calendar, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GameBadge } from "@/components/GameBadge";
import type { ReprintEvent, Game } from "@/types";

export const revalidate = 3600;
export const metadata = { title: "再販カレンダー | CardMarket AI" };

const IMPACT_LABEL = {
  high:   { text: "影響大", color: "#ef4444" },
  medium: { text: "影響中", color: "#f59e0b" },
  low:    { text: "影響小", color: "#9ca3af" },
};

async function getReprintEvents(): Promise<ReprintEvent[]> {
  const { data } = await supabase
    .from("reprint_events")
    .select("*")
    .order("event_date", { ascending: false })
    .limit(100);
  return (data ?? []) as ReprintEvent[];
}

export default async function ReprintCalendarPage() {
  const events = await getReprintEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">再販カレンダー</h1>
          <p className="text-sm text-[#9ca3af]">
            公式発表の再販・追加生産情報を自動収集しています
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] px-4 py-3 text-xs text-[#9ca3af]">
        再販が発表されると、該当セットのカードは価格下落リスクが高まります。
        カード詳細ページでも再販リスクが表示されます。
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-[#2a2a2e] p-12 text-center text-[#9ca3af]">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>再販情報を収集中です。</p>
          <p className="text-xs mt-2">次回の自動収集後に表示されます。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const impact = IMPACT_LABEL[ev.impact] ?? IMPACT_LABEL.medium;
            return (
              <div
                key={ev.id}
                className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="shrink-0 text-sm text-[#9ca3af] tabular-nums w-24">
                  {new Date(ev.event_date).toLocaleDateString("ja-JP")}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GameBadge game={ev.game as Game} />
                    <span
                      className="text-xs px-2 py-0.5 rounded border font-medium"
                      style={{ color: impact.color, borderColor: impact.color + "40" }}
                    >
                      {impact.text}
                    </span>
                    {ev.set_name && (
                      <span className="text-xs text-[#9ca3af]">{ev.set_name}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug">{ev.title}</p>
                </div>
                <a
                  href={ev.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  公式 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      <Link href="/" className="text-sm text-[#9ca3af] hover:text-white">
        ← ホームに戻る
      </Link>
    </div>
  );
}
