"""
PSA鑑定品のメルカリ相場スクレイパー

PSA10 / PSA9 の売り切れ商品の中央値を取得し prices テーブルに保存。
card_insights に PSAプレミアム率も記録する。
"""

import os
import time
from typing import Optional

from utils.supabase_client import get_client
from prices.mercari import search_sold_prices, median_price, GAME_KEYWORDS

PLAYWRIGHT_BROWSERS_PATH = os.path.expanduser("~/.playwright-browsers")

GRADES = ["PSA10", "PSA9"]


def scrape_psa_prices(game: Optional[str] = None, limit: int = 50) -> None:
    """PSA鑑定品のメルカリ相場を収集"""
    client = get_client()
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = PLAYWRIGHT_BROWSERS_PATH

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed.")
        return

    print(f"\n=== PSA相場収集開始 (game={game or 'all'}) ===")

    # 価格データのある人気カードを優先（遊々亭価格が高い順）
    prices_res = (
        client.table("prices")
        .select("card_id,price")
        .eq("source", "yuyutei")
        .order("price", desc=True)
        .limit(limit * 3)
        .execute()
    )
    card_ids = list(dict.fromkeys(p["card_id"] for p in prices_res.data))[:limit]

    query = client.table("cards").select("id,name,game").in_("id", card_ids)
    if game:
        query = query.eq("game", game)
    cards = query.execute().data or []
    print(f"  対象カード: {len(cards)}枚")

    saved = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(locale="ja-JP")
        page = ctx.new_page()

        for card in cards:
            card_id = card["id"]
            card_name = card["name"]
            game_key = card["game"]
            psa_prices = {}

            for grade in GRADES:
                game_kw = GAME_KEYWORDS.get(game_key, "")
                keyword = f"{card_name} {grade} {game_kw}".strip()
                prices = search_sold_prices(page, keyword, game_key, max_items=8, raw_keyword=True)
                med = median_price(prices)
                if med:
                    psa_prices[grade] = med
                    try:
                        client.table("prices").insert({
                            "card_id": card_id,
                            "source": "mercari_psa",
                            "price": med,
                            "grade": grade,
                            "condition": "NM",
                        }).execute()
                    except Exception:
                        pass
                time.sleep(4)

            if psa_prices:
                # 素体価格（遊々亭 or メルカリ素体）と比較してプレミアム率
                raw_res = (
                    client.table("prices")
                    .select("price")
                    .eq("card_id", card_id)
                    .in_("source", ["yuyutei", "mercari"])
                    .is_("grade", "null")
                    .order("recorded_at", desc=True)
                    .limit(1)
                    .execute()
                )
                raw_price = raw_res.data[0]["price"] if raw_res.data else None
                psa10 = psa_prices.get("PSA10")
                premium_pct = None
                if raw_price and psa10 and raw_price > 0:
                    premium_pct = round((psa10 - raw_price) / raw_price * 100, 1)

                insight = {
                    "card_id": card_id,
                    "psa10_price": psa_prices.get("PSA10"),
                    "psa9_price": psa_prices.get("PSA9"),
                    "psa_premium_pct": premium_pct,
                }
                try:
                    client.table("card_insights").upsert(
                        insight, on_conflict="card_id"
                    ).execute()
                    saved += 1
                except Exception as e:
                    print(f"    ERROR psa insight {card_id}: {e}")

            time.sleep(3)

        browser.close()

    print(f"  完了: {saved}件更新")


if __name__ == "__main__":
    import sys
    game_arg = sys.argv[1] if len(sys.argv) > 1 else None
    scrape_psa_prices(game=game_arg, limit=30)
