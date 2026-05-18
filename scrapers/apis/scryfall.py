"""
Scryfall API（完全無料・登録不要）からMTGカードデータを取得する
https://scryfall.com/docs/api
"""

import time
import requests
from utils.supabase_client import upsert_cards

API_BASE = "https://api.scryfall.com"


def fetch_cards_by_set(set_code: str) -> list[dict]:
    """指定セットのMTGカードを取得"""
    cards = []
    url = f"{API_BASE}/cards/search"
    params = {"q": f"set:{set_code}", "order": "name"}

    while url:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 404:
            print(f"  set {set_code} not found")
            return []
        resp.raise_for_status()
        data = resp.json()
        cards.extend(data.get("data", []))

        url = data.get("next_page") if data.get("has_more") else None
        params = {}  # next_pageにはパラメータ込み
        time.sleep(0.1)  # Scryfall推奨: 50〜100ms間隔

    return cards


def transform_card(raw: dict) -> dict:
    """APIレスポンスをSupabaseのcardsテーブル形式に変換"""
    image_uris = raw.get("image_uris", {})
    # 両面カードの場合
    if not image_uris and raw.get("card_faces"):
        image_uris = raw["card_faces"][0].get("image_uris", {})

    return {
        "name": raw.get("name", ""),
        "name_ja": None,
        "game": "mtg",
        "set_name": raw.get("set_name", ""),
        "set_code": raw.get("set"),
        "rarity": raw.get("rarity"),
        "image_url": image_uris.get("small") or image_uris.get("normal"),
        "external_id": raw["id"],
    }


def sync_recent_sets() -> None:
    """直近の標準セットを同期"""
    recent_sets = ["dft", "fdn", "dsk", "blb"]  # 定期的に追加
    for set_code in recent_sets:
        print(f"Fetching MTG cards for set: {set_code}")
        raw_cards = fetch_cards_by_set(set_code)
        records = [transform_card(c) for c in raw_cards]
        upsert_cards(records)
        time.sleep(1)


if __name__ == "__main__":
    sync_recent_sets()
