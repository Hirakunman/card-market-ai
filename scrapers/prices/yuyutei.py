"""
遊々亭 価格スクレイパー
robots.txt: https://yuyu-tei.jp/robots.txt を確認済み前提で使用すること

対象: ポケモンカード（他ゲームも同様の構造で拡張可能）
更新: 1日2回（GitHub Actions cron）
"""

import time
import re
import requests
from bs4 import BeautifulSoup
from utils.supabase_client import get_client, get_card_id

BASE_URL = "https://yuyu-tei.jp"
HEADERS = {
    "User-Agent": "CardMarketAI-Bot/1.0 (educational price tracking; contact: your@email.com)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

# 遊々亭のゲームコード
GAME_PATHS = {
    "pokemon": "/game/poke/sell_price",
    "yugioh": "/game/ygo/sell_price",
    "onepiece": "/game/one/sell_price",
}


def fetch_price_list(game: str, page: int = 1) -> list[dict]:
    """指定ゲームの価格一覧ページをスクレイプ"""
    path = GAME_PATHS.get(game)
    if not path:
        return []

    url = f"{BASE_URL}{path}?page={page}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"  fetch error: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    prices = []

    # 遊々亭のカード価格テーブルをパース
    # ※ サイト構造変更時はセレクタを更新すること
    for row in soup.select(".card-list-item, .sell-card-item, tr[data-card-id]"):
        try:
            name_el = row.select_one(".card-name, .name, td.name")
            price_el = row.select_one(".price, .sell-price, td.price")

            if not name_el or not price_el:
                continue

            name = name_el.get_text(strip=True)
            price_text = price_el.get_text(strip=True)
            price_num = parse_price(price_text)

            if price_num and price_num > 0:
                prices.append({"name": name, "price": price_num})
        except Exception:
            continue

    return prices


def parse_price(text: str):
    """「¥1,234」「1234円」などから数値を抽出"""
    cleaned = re.sub(r"[^\d]", "", text)
    return int(cleaned) if cleaned else None


def save_prices(game: str, price_data: list[dict]) -> None:
    """カード名でcardsテーブルを検索し、pricesテーブルに保存"""
    client = get_client()
    saved = 0

    for item in price_data:
        # カード名でID検索
        res = (
            client.table("cards")
            .select("id")
            .eq("game", game)
            .ilike("name", item["name"])
            .limit(1)
            .execute()
        )
        if not res.data:
            continue

        card_id = res.data[0]["id"]
        client.table("prices").insert({
            "card_id": card_id,
            "source": "yuyutei",
            "price": item["price"],
            "condition": "NM",
        }).execute()
        saved += 1

    print(f"  saved {saved} prices for {game}")


def scrape_game(game: str, max_pages: int = 5) -> None:
    """指定ゲームの価格を複数ページ取得"""
    print(f"Scraping yuyutei prices for: {game}")
    all_prices = []

    for page in range(1, max_pages + 1):
        prices = fetch_price_list(game, page)
        if not prices:
            break
        all_prices.extend(prices)
        print(f"  page {page}: {len(prices)} items")
        time.sleep(5)  # サーバー負荷軽減（重要）

    save_prices(game, all_prices)


if __name__ == "__main__":
    for g in ["pokemon", "yugioh", "onepiece"]:
        scrape_game(g)
        time.sleep(10)
