"""
メルカリ 価格スクレイパー

取得対象：直近の「売り切れ」商品（実際の取引価格）
URL: https://jp.mercari.com/search?keyword={カード名}&status=sold_out

Playwright で JS レンダリングし、売却済み価格の中央値・平均値を取得する。
1カードあたり検索1回、リクエスト間隔5秒以上。

robots.txt: /search は Disallow なし → アクセス可
利用規約的にはグレーゾーンのため、研究・参考目的のみ。
"""

import os
import re
import time
from typing import Optional
from utils.supabase_client import get_client

PLAYWRIGHT_BROWSERS_PATH = os.path.expanduser("~/.playwright-browsers")
SEARCH_BASE = "https://jp.mercari.com/search"

# カードゲームごとにメルカリ検索に付加するフィルタキーワード
GAME_KEYWORDS = {
    "pokemon":  "ポケモンカード",
    "onepiece": "ワンピースカード",
    "yugioh":   "遊戯王",
    "mtg":      "MTG マジック",
}


def search_sold_prices(page, card_name: str, game: str, max_items: int = 10) -> list[int]:
    """カード名でメルカリの売り切れ商品を検索し、価格リストを返す"""
    game_kw = GAME_KEYWORDS.get(game, "")
    keyword = f"{card_name} {game_kw}".strip()

    url = f"{SEARCH_BASE}?keyword={keyword}&status=sold_out&sort=created_time&order=desc"
    try:
        page.goto(url, timeout=25000)
        time.sleep(3)
    except Exception as e:
        print(f"    mercari load error: {e}")
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page.content(), "html.parser")

    prices = []

    # メルカリの商品リスト: li[data-testid="item-cell"] または mer-item-thumbnail
    for item in soup.select('[data-testid="item-cell"], mer-item-thumbnail'):
        try:
            price_el = (
                item.select_one('[data-testid="thumbnail-item-price"]')
                or item.select_one('.price')
                or item.select_one('[class*="price"]')
            )
            if not price_el:
                continue
            price_text = re.sub(r"[^\d]", "", price_el.get_text())
            if price_text:
                price = int(price_text)
                if 100 <= price <= 10_000_000:  # 100円〜1000万円の範囲
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


def scrape_mercari_prices(game: Optional[str] = None, limit: int = 100) -> None:
    """
    価格データのあるカードをSupabaseから取得し、メルカリで売却価格を検索して保存。
    limit: 1回の実行で処理するカード数（APIレート制限対策）
    """
    client = get_client()

    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = PLAYWRIGHT_BROWSERS_PATH

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed.")
        return

    print(f"\n=== メルカリ価格収集開始 (game={game or 'all'}) ===")

    # 価格データのあるカードIDを取得
    prices_res = client.table("prices").select("card_id").eq("source", "yuyutei").limit(limit * 3).execute()
    card_ids = list(set(p["card_id"] for p in prices_res.data))

    # カード情報を取得
    query = client.table("cards").select("id,name,game").in_("id", card_ids)
    if game:
        query = query.eq("game", game)
    cards_res = query.limit(limit).execute()
    cards = cards_res.data
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

            prices = search_sold_prices(page, card_name, game_key, max_items=10)

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
            except Exception as e:
                pass

            time.sleep(5)  # メルカリへの負荷軽減

            if saved % 20 == 0 and saved > 0:
                print(f"  ... {saved}件保存")

        browser.close()

    print(f"  完了: {saved}件保存")


if __name__ == "__main__":
    import sys
    game_arg = sys.argv[1] if len(sys.argv) > 1 else None
    scrape_mercari_prices(game=game_arg, limit=50)
