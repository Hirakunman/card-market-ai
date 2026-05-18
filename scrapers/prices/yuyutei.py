"""
遊々亭 価格スクレイパー（日本語カード対応版）

robots.txt: https://yuyu-tei.jp/robots.txt を確認済み前提
- Disallow: /user/ のみ → カード価格ページはアクセス可
- リクエスト間隔を5秒以上空ける

カードが存在しない場合は日本語名で自動作成する
"""

import time
import re
import requests
from bs4 import BeautifulSoup
from utils.supabase_client import get_client

BASE_URL = "https://yuyu-tei.jp"
HEADERS = {
    "User-Agent": "CardMarketAI-Bot/1.0 (educational price tracking; contact: your@email.com)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

# 遊々亭のゲームコードと内部gameキーの対応
GAME_CONFIG = {
    "pokemon": {
        "path": "/game/poke/sell_price",
        "game": "pokemon",
    },
    "yugioh": {
        "path": "/game/ygo/sell_price",
        "game": "yugioh",
    },
    "onepiece": {
        "path": "/game/one/sell_price",
        "game": "onepiece",
    },
}


def fetch_price_list(game_key: str, page: int = 1) -> list:
    """指定ゲームの価格一覧ページをスクレイプ"""
    config = GAME_CONFIG.get(game_key)
    if not config:
        return []

    url = f"{BASE_URL}{config['path']}?page={page}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"  fetch error page {page}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    prices = []

    for row in soup.select("td.sell_price, .card-price-row, .product-item, li.card"):
        try:
            name_el = row.select_one(".card_name, .name, .product-name, h3, .CardName")
            price_el = row.select_one(".price, .sell_price, .product-price")
            img_el = row.select_one("img")

            if not name_el or not price_el:
                continue

            name = name_el.get_text(strip=True)
            price_text = price_el.get_text(strip=True)
            price_num = parse_price(price_text)

            # 画像URL
            image_url = None
            if img_el:
                src = img_el.get("src") or img_el.get("data-src", "")
                if src and not src.startswith("http"):
                    src = BASE_URL + src
                image_url = src or None

            # セット名・レアリティ
            rarity_el = row.select_one(".rarity, .card_rarity")
            rarity = rarity_el.get_text(strip=True) if rarity_el else None

            set_el = row.select_one(".set_name, .expansion, .series")
            set_name = set_el.get_text(strip=True) if set_el else ""

            if name and price_num and price_num > 0:
                prices.append({
                    "name": name,
                    "price": price_num,
                    "image_url": image_url,
                    "rarity": rarity,
                    "set_name": set_name,
                })
        except Exception:
            continue

    return prices


def parse_price(text: str):
    """「¥1,234」「1234円」などから数値を抽出"""
    cleaned = re.sub(r"[^\d]", "", text)
    return int(cleaned) if cleaned else None


def get_or_create_card(game_key: str, name: str, image_url=None, rarity=None, set_name="") -> str | None:
    """カード名でDBを検索し、なければ日本語名で新規作成してIDを返す"""
    client = get_client()
    game = GAME_CONFIG[game_key]["game"]

    # 既存カードを検索
    res = (
        client.table("cards")
        .select("id")
        .eq("game", game)
        .ilike("name", name)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]

    # 存在しない場合は日本語名で新規作成
    new_card = {
        "name": name,
        "name_ja": name,
        "game": game,
        "set_name": set_name or "",
        "rarity": rarity,
        "image_url": image_url,
        "external_id": f"yuyutei_{game}_{re.sub(r'[^a-zA-Z0-9ぁ-ん一-龥ァ-ヶ]', '_', name)[:50]}",
    }
    insert_res = client.table("cards").insert(new_card).execute()
    if insert_res.data:
        return insert_res.data[0]["id"]
    return None


def save_prices(game_key: str, price_data: list) -> None:
    """価格データを保存（カードが存在しなければ自動作成）"""
    client = get_client()
    saved = 0
    created = 0

    for item in price_data:
        card_id = get_or_create_card(
            game_key,
            item["name"],
            image_url=item.get("image_url"),
            rarity=item.get("rarity"),
            set_name=item.get("set_name", ""),
        )

        if not card_id:
            continue

        if card_id and not any(r.get("id") == card_id for r in []):
            # 既存カードなら価格追加、新規作成時もカウント
            pass

        client.table("prices").insert({
            "card_id": card_id,
            "source": "yuyutei",
            "price": item["price"],
            "condition": "NM",
        }).execute()
        saved += 1

    print(f"  saved {saved} prices for {game_key}")


def scrape_game(game_key: str, max_pages: int = 10) -> None:
    """指定ゲームの価格を複数ページ取得"""
    print(f"Scraping yuyutei prices: {game_key}")
    all_prices = []

    for page in range(1, max_pages + 1):
        prices = fetch_price_list(game_key, page)
        if not prices:
            break
        all_prices.extend(prices)
        print(f"  page {page}: {len(prices)} items")
        time.sleep(5)

    save_prices(game_key, all_prices)


if __name__ == "__main__":
    for g in ["pokemon", "yugioh", "onepiece"]:
        scrape_game(g)
        time.sleep(10)
