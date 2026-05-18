"""
ポケモンカード公式サイト（日本）からカードデータを取得する
https://www.pokemon-card.com/card-search/

robots.txt を確認の上使用すること
リクエスト間隔を十分に空ける（5秒以上）
"""

import time
import requests
from bs4 import BeautifulSoup
from utils.supabase_client import upsert_cards

BASE_URL = "https://www.pokemon-card.com"
HEADERS = {
    "User-Agent": "CardMarketAI-Bot/1.0 (price tracking research; contact: your@email.com)",
    "Accept-Language": "ja-JP,ja;q=0.9",
    "Referer": "https://www.pokemon-card.com/",
}

# 対象セットコード（日本版）
# 最新弾から順に追加していく
JAPANESE_SETS = [
    {"code": "SV8a", "name": "超電ブレイカー"},
    {"code": "SV8",  "name": "バイオレットex"},
    {"code": "SV7a", "name": "楽園ドラゴーナ"},
    {"code": "SV7",  "name": "ステラミラクル"},
    {"code": "SV6a", "name": "夜明けのトリッキングアート"},
    {"code": "SV6",  "name": "変幻の仮面"},
    {"code": "SV5K", "name": "ワイルドフォース"},
    {"code": "SV5M", "name": "サイバージャッジ"},
]


def fetch_set_cards(set_code: str, set_name: str) -> list:
    """指定セットのカードを公式サイトからスクレイプ"""
    cards = []
    page = 1

    while True:
        url = f"{BASE_URL}/card-search/index.php"
        params = {
            "keyword": "",
            "se[]": set_code,
            "pg": page,
        }

        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=15)
            resp.raise_for_status()
        except Exception as e:
            print(f"  fetch error page {page}: {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        # カード一覧の要素を取得
        card_items = soup.select(".CardList li, .card-item, li.cf")
        if not card_items:
            break

        for item in card_items:
            try:
                # カード名
                name_el = item.select_one(".card-name, .name, h3, .CardName")
                name = name_el.get_text(strip=True) if name_el else ""

                # 画像URL
                img_el = item.select_one("img")
                image_url = None
                if img_el:
                    src = img_el.get("src") or img_el.get("data-src", "")
                    if src and not src.startswith("http"):
                        src = BASE_URL + src
                    image_url = src or None

                # 詳細ページURL（外部IDとして使用）
                link_el = item.select_one("a")
                card_url = link_el.get("href", "") if link_el else ""
                external_id = f"{set_code}_{len(cards)}"
                if "id=" in card_url:
                    external_id = card_url.split("id=")[-1].split("&")[0]

                # レアリティ
                rarity_el = item.select_one(".rarity, .CardRarity")
                rarity = rarity_el.get_text(strip=True) if rarity_el else None

                if name:
                    cards.append({
                        "name": name,
                        "name_ja": name,
                        "game": "pokemon",
                        "set_name": set_name,
                        "set_code": set_code,
                        "rarity": rarity,
                        "image_url": image_url,
                        "external_id": external_id,
                    })
            except Exception:
                continue

        print(f"  page {page}: {len(card_items)} items (total: {len(cards)})")

        # 次のページがあるか確認
        next_el = soup.select_one(".next, a[rel='next'], .pager .next")
        if not next_el:
            break

        page += 1
        time.sleep(5)  # サーバー負荷軽減

    return cards


def sync_recent_sets() -> None:
    """直近の日本語ポケモンカードセットを同期"""
    for set_info in JAPANESE_SETS:
        print(f"Fetching Japanese Pokemon cards: {set_info['name']} ({set_info['code']})")
        cards = fetch_set_cards(set_info["code"], set_info["name"])
        if cards:
            upsert_cards(cards)
        else:
            print(f"  no cards found for {set_info['code']} (site structure may have changed)")
        time.sleep(5)


if __name__ == "__main__":
    sync_recent_sets()
