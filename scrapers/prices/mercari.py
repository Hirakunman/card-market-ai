"""
メルカリ 価格スクレイパー

取得対象：直近の「売り切れ」商品（実際の取引価格）
急騰検知：7日以内の前回価格と比較し、15%以上上昇で mercari_surge フラグを立てる
"""

import os
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Optional
from utils.supabase_client import get_client

PLAYWRIGHT_BROWSERS_PATH = os.path.expanduser("~/.playwright-browsers")
SEARCH_BASE = "https://jp.mercari.com/search"
SURGE_THRESHOLD = 15.0  # 15%以上で急騰フラグ

GAME_KEYWORDS = {
    "pokemon":  "ポケモンカード",
    "onepiece": "ワンピースカード",
    "yugioh":   "遊戯王",
    "mtg":      "MTG マジック",
}


def search_sold_prices(
    page,
    card_name: str,
    game: str,
    max_items: int = 10,
    raw_keyword: bool = False,
) -> list[int]:
    """カード名でメルカリの売り切れ商品を検索し、価格リストを返す"""
    if raw_keyword:
        keyword = card_name
    else:
        game_kw = GAME_KEYWORDS.get(game, "")
        keyword = f"{card_name} {game_kw}".strip()

    from urllib.parse import quote
    url = f"{SEARCH_BASE}?keyword={quote(keyword)}&status=sold_out&sort=created_time&order=desc"
    try:
        page.goto(url, timeout=25000)
        time.sleep(3)
    except Exception as e:
        print(f"    mercari load error: {e}")
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page.content(), "html.parser")

    prices = []
    for item in soup.select('[data-testid="item-cell"], mer-item-thumbnail'):
        try:
            price_el = (
                item.select_one('[data-testid="thumbnail-item-price"]')
                or item.select_one(".price")
                or item.select_one('[class*="price"]')
            )
            if not price_el:
                continue
            price_text = re.sub(r"[^\d]", "", price_el.get_text())
            if price_text:
                price = int(price_text)
                if 100 <= price <= 10_000_000:
                    prices.append(price)
        except Exception:
            continue

    return prices[:max_items]


def median_price(prices: list[int]) -> Optional[int]:
    if not prices:
        return None
    s = sorted(prices)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) // 2


def get_mercari_price_7d_ago(client, card_id: str) -> Optional[int]:
    """7日前以前の最新メルカリ素体価格"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    res = (
        client.table("prices")
        .select("price")
        .eq("card_id", card_id)
        .eq("source", "mercari")
        .is_("grade", "null")
        .lte("recorded_at", cutoff)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0]["price"] if res.data else None


def update_mercari_insight(client, card_id: str, current_price: int) -> None:
    """メルカリ急騰情報を card_insights に保存"""
    price_7d = get_mercari_price_7d_ago(client, card_id)
    change_7d = None
    surge = False

    if price_7d and price_7d > 0:
        change_7d = round((current_price - price_7d) / price_7d * 100, 1)
        surge = change_7d >= SURGE_THRESHOLD

    try:
        client.table("card_insights").upsert({
            "card_id": card_id,
            "mercari_price": current_price,
            "mercari_change_7d": change_7d,
            "mercari_surge": surge,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="card_id").execute()
    except Exception as e:
        print(f"    ERROR mercari insight {card_id}: {e}")


def scrape_mercari_prices(game: Optional[str] = None, limit: int = 100) -> None:
    """メルカリ売却価格を収集し、急騰検知も行う"""
    client = get_client()
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = PLAYWRIGHT_BROWSERS_PATH

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed.")
        return

    print(f"\n=== メルカリ価格収集開始 (game={game or 'all'}) ===")

    prices_res = (
        client.table("prices")
        .select("card_id")
        .eq("source", "yuyutei")
        .limit(limit * 5)
        .execute()
    )
    card_ids = list(dict.fromkeys(p["card_id"] for p in prices_res.data))[:limit]

    query = client.table("cards").select("id,name,game").in_("id", card_ids)
    if game:
        query = query.eq("game", game)
    cards = query.execute().data or []
    print(f"  対象カード: {len(cards)}枚")

    saved = 0
    surges = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(locale="ja-JP")
        page = ctx.new_page()

        for card in cards:
            card_id = card["id"]
            prices = search_sold_prices(page, card["name"], card["game"], max_items=10)

            if not prices:
                time.sleep(2)
                continue

            med = median_price(prices)
            if med is None:
                continue

            try:
                client.table("prices").insert({
                    "card_id": card_id,
                    "source": "mercari",
                    "price": med,
                    "condition": "NM",
                }).execute()
                saved += 1
                update_mercari_insight(client, card_id, med)
                # 急騰カウント
                insight_res = (
                    client.table("card_insights")
                    .select("mercari_surge")
                    .eq("card_id", card_id)
                    .single()
                    .execute()
                )
                if insight_res.data and insight_res.data.get("mercari_surge"):
                    surges += 1
            except Exception:
                pass

            time.sleep(5)

            if saved % 20 == 0 and saved > 0:
                print(f"  ... {saved}件保存")

        browser.close()

    print(f"  完了: {saved}件保存, 急騰検知: {surges}件")


if __name__ == "__main__":
    import sys
    game_arg = sys.argv[1] if len(sys.argv) > 1 else None
    scrape_mercari_prices(game=game_arg, limit=50)
