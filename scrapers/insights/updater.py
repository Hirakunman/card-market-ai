"""
カード別市場インサイト更新

- reprint_events と cards.set_name をマッチングして再販リスクを付与
- card_insights テーブルを更新
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from utils.supabase_client import get_client


def _match_reprint_risk(set_name: str, events: list) -> tuple[str, Optional[str], Optional[str]]:
    """セット名と再販イベントを照合してリスクレベルを返す"""
    if not set_name:
        return "none", None, None

    set_lower = set_name.lower()
    best = None

    for ev in events:
        ev_set = ev.get("set_name") or ""
        ev_title = ev.get("title") or ""
        # セット名またはタイトルに部分一致
        if ev_set and (ev_set in set_name or set_name in ev_set):
            best = ev
            break
        if set_name in ev_title or any(part in ev_title for part in set_name.split() if len(part) > 2):
            best = ev
            break

    if not best:
        return "none", None, None

    impact = best.get("impact", "medium")
    risk_map = {"high": "high", "medium": "medium", "low": "low"}
    return risk_map.get(impact, "medium"), best.get("title"), best.get("event_date")


def update_reprint_risks() -> None:
    """全カードの再販リスクを reprint_events から更新"""
    client = get_client()
    print("\n=== 再販リスク更新開始 ===")

    # 直近90日以内の再販イベント
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    events_res = (
        client.table("reprint_events")
        .select("title,set_name,event_date,impact,game")
        .gte("event_date", cutoff)
        .execute()
    )
    events = events_res.data or []
    print(f"  再販イベント: {len(events)}件")

    if not events:
        return

    # セット名のあるカードを取得（バッチ処理）
    cards_res = (
        client.table("cards")
        .select("id,set_name,game")
        .neq("set_name", "")
        .limit(5000)
        .execute()
    )
    cards = cards_res.data or []
    updated = 0

    for card in cards:
        game_events = [e for e in events if e.get("game") == card["game"]]
        risk, title, ev_date = _match_reprint_risk(card.get("set_name", ""), game_events)
        if risk == "none":
            continue

        try:
            client.table("card_insights").upsert({
                "card_id": card["id"],
                "reprint_risk": risk,
                "reprint_title": title,
                "reprint_date": ev_date,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="card_id").execute()
            updated += 1
        except Exception as e:
            print(f"    ERROR insight {card['id']}: {e}")

    print(f"  完了: {updated}件更新")


if __name__ == "__main__":
    update_reprint_risks()
