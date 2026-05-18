"""
ワンピースカードゲーム公式サイトからカードデータを取得する
https://www.takaratomy.co.jp/products/wcard/

または、遊々亭のワンピースカード一覧からカード名・画像を取得
"""

import time
import requests
from bs4 import BeautifulSoup
from utils.supabase_client import upsert_cards

HEADERS = {
    "User-Agent": "CardMarketAI-Bot/1.0 (price tracking research; contact: your@email.com)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

# ワンピースカードの弾リスト（公式弾コード）
OP_SETS = [
    {"code": "OP-09", "name": "六皇"},
    {"code": "OP-08", "name": "二つの伝説"},
    {"code": "OP-07", "name": "500年後の未来"},
    {"code": "OP-06", "name": "双璧の覇者"},
    {"code": "OP-05", "name": "新時代の主役"},
    {"code": "OP-04", "name": "王国の覇者"},
    {"code": "OP-03", "name": "強大な敵"},
    {"code": "OP-02", "name": "頂上決戦"},
    {"code": "OP-01", "name": "ROMANCE DAWN"},
]


def fetch_from_official(set_code: str, set_name: str) -> list:
    """
    ワンピースカードゲーム公式データベースからスクレイプ
    https://www.takaratomy.co.jp/products/wcard/cardlist.html
    """
    cards = []
    url = "https://www.takaratomy.co.jp/products/wcard/cardlist.html"
    params = {"src_type": set_code}

    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for item in soup.select(".cardlist_item, .card_item, li.card"):
            try:
                name_el = item.select_one(".card_name, .name, h3")
                name = name_el.get_text(strip=True) if name_el else ""

                img_el = item.select_one("img")
                image_url = None
                if img_el:
                    src = img_el.get("src") or img_el.get("data-src", "")
                    if src and not src.startswith("http"):
                        src = "https://www.takaratomy.co.jp" + src
                    image_url = src or None

                rarity_el = item.select_one(".rarity, .card_rarity")
                rarity = rarity_el.get_text(strip=True) if rarity_el else None

                card_no_el = item.select_one(".card_no, .no")
                external_id = card_no_el.get_text(strip=True) if card_no_el else f"{set_code}_{len(cards)}"

                if name:
                    cards.append({
                        "name": name,
                        "name_ja": name,
                        "game": "onepiece",
                        "set_name": set_name,
                        "set_code": set_code,
                        "rarity": rarity,
                        "image_url": image_url,
                        "external_id": external_id,
                    })
            except Exception:
                continue

    except Exception as e:
        print(f"  fetch error for {set_code}: {e}")

    return cards


def sync_recent_sets() -> None:
    """直近のワンピースカードセットを同期"""
    for set_info in OP_SETS[:5]:  # 最新5弾
        print(f"Fetching One Piece cards: {set_info['name']} ({set_info['code']})")
        cards = fetch_from_official(set_info["code"], set_info["name"])
        if cards:
            upsert_cards(cards)
            print(f"  saved {len(cards)} cards")
        else:
            print(f"  no cards found (site structure may differ)")
        time.sleep(5)


if __name__ == "__main__":
    sync_recent_sets()
