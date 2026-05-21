"""
メルカリ対象カードの優先選定（高騰精度向上）
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from utils.supabase_client import get_client


def get_mercari_target_cards(game: Optional[str] = None, limit: int = 200) -> list[dict]:
    client = get_client()
    targets: list[dict] = []
    seen_ids: set[str] = set()

    def add_cards(cards: list):
        for c in cards:
            if c["id"] not in seen_ids:
                seen_ids.add(c["id"])
                targets.append(c)

    # 1. 急騰中カードを最優先
    surge_res = (
        client.table("card_insights")
        .select("card_id")
        .eq("mercari_surge", True)
        .limit(50)
        .execute()
    )
    surge_ids = [r["card_id"] for r in (surge_res.data or [])]
    if surge_ids:
        q = client.table("cards").select("id,name,game").in_("id", surge_ids)
        if game:
            q = q.eq("game", game)
        add_cards(q.execute().data or [])

    # 2. 高額カードでメルカリ未更新
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    high_price_res = (
        client.table("prices")
        .select("card_id")
        .eq("source", "yuyutei")
        .order("price", desc=True)
        .limit(limit * 4)
        .execute()
    )
    high_ids = list(dict.fromkeys(p["card_id"] for p in (high_price_res.data or [])))

    stale_cards = []
    no_mercari = []
    fresh_cards = []

    for cid in high_ids:
        if cid in seen_ids:
            continue
        card_res = client.table("cards").select("id,name,game").eq("id", cid).maybe_single().execute()
        card = card_res.data
        if not card:
            continue
        if game and card.get("game") != game:
            continue

        insight_res = (
            client.table("card_insights")
            .select("mercari_price,updated_at")
            .eq("card_id", cid)
            .maybe_single()
            .execute()
        )
        insight = insight_res.data
        if not insight or not insight.get("mercari_price"):
            no_mercari.append(card)
        elif insight.get("updated_at", "") < stale_cutoff:
            stale_cards.append(card)
        else:
            fresh_cards.append(card)

    add_cards(stale_cards)
    add_cards(no_mercari)
    add_cards(fresh_cards)

    # 3. 補充
    if len(targets) < limit:
        fill_res = (
            client.table("prices")
            .select("card_id")
            .eq("source", "yuyutei")
            .limit(limit * 5)
            .execute()
        )
        fill_ids = [p["card_id"] for p in (fill_res.data or []) if p["card_id"] not in seen_ids]
        if fill_ids:
            q = client.table("cards").select("id,name,game").in_("id", fill_ids[:limit * 2])
            if game:
                q = q.eq("game", game)
            add_cards(q.execute().data or [])

    return targets[:limit]
