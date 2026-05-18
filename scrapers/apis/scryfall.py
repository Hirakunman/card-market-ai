"""
Scryfall API（完全無料・登録不要）から日本語MTGカードデータを取得する
lang:ja で日本語版カードのみ取得
https://scryfall.com/docs/api
"""

import time
import requests
from utils.supabase_client import upsert_cards

API_BASE = "https://api.scryfall.com"


def fetch_japanese_cards_by_set(set_code: str) -> list:
    """指定セットの日本語MTGカードを取得"""
    cards = []
    url = f"{API_BASE}/cards/search"
    params = {"q": f"lang:ja set:{set_code}", "order": "name"}

    while url:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 404:
            print(f"  set {set_code} not found")
            return []
        resp.raise_for_status()
        data = resp.json()
        cards.extend(data.get("data", []))
        url = data.get("next_page") if data.get("has_more") else None
        params = {}
        time.sleep(0.1)

    return cards


def transform_card(raw: dict) -> dict:
    image_uris = raw.get("image_uris", {})
    if not image_uris and raw.get("card_faces"):
        image_uris = raw["card_faces"][0].get("image_uris", {})

    # 日本語名を優先
    printed_name = raw.get("printed_name") or raw.get("name", "")
    english_name = raw.get("name", "")

    return {
        "name": printed_name,
        "name_ja": printed_name,
        "game": "mtg",
        "set_name": raw.get("set_name", ""),
        "set_code": raw.get("set"),
        "rarity": raw.get("rarity"),
        "image_url": image_uris.get("small") or image_uris.get("normal"),
        "external_id": raw["id"],
    }


def sync_recent_sets() -> None:
    """直近の標準セットの日本語版を同期"""
    recent_sets = ["dft", "fdn", "dsk", "blb", "otj", "mkm", "lci"]
    for set_code in recent_sets:
        print(f"Fetching Japanese MTG cards for set: {set_code}")
        raw_cards = fetch_japanese_cards_by_set(set_code)
        if raw_cards:
            records = [transform_card(c) for c in raw_cards]
            upsert_cards(records)
            print(f"  {len(records)} Japanese cards saved for {set_code}")
        time.sleep(1)


if __name__ == "__main__":
    sync_recent_sets()
