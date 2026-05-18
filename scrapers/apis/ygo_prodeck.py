"""
YGOPRODeck API（完全無料）から遊戯王日本語カードデータを取得する
language=jp パラメータで日本語名・日本語テキストを取得
"""

import time
import requests
from utils.supabase_client import upsert_cards

API_BASE = "https://db.ygoprodeck.com/api/v7"


def fetch_all_cards_japanese() -> list:
    """全遊戯王カードを日本語データで取得"""
    resp = requests.get(
        f"{API_BASE}/cardinfo.php",
        params={"language": "ja"},
        timeout=60
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def transform_card(raw: dict) -> dict:
    card_sets = raw.get("card_sets", [])
    set_name = card_sets[0].get("set_name", "") if card_sets else ""
    set_code = card_sets[0].get("set_code", "") if card_sets else None
    rarity = card_sets[0].get("set_rarity", "") if card_sets else None

    images = raw.get("card_images", [])
    image_url = images[0].get("image_url_small") if images else None

    # 日本語名があれば優先
    name_ja = raw.get("name")  # language=jp の場合は日本語名が入る
    name_en = raw.get("name")  # フォールバック

    return {
        "name": name_ja or name_en,
        "name_ja": name_ja,
        "game": "yugioh",
        "set_name": set_name,
        "set_code": set_code,
        "rarity": rarity,
        "image_url": image_url,
        "external_id": str(raw["id"]),
    }


def sync_all() -> None:
    print("Fetching all YuGiOh cards (Japanese)...")
    raw_cards = fetch_all_cards_japanese()
    print(f"  fetched {len(raw_cards)} cards")

    batch_size = 500
    for i in range(0, len(raw_cards), batch_size):
        batch = raw_cards[i: i + batch_size]
        records = [transform_card(c) for c in batch]
        upsert_cards(records)
        time.sleep(0.5)


if __name__ == "__main__":
    sync_all()
