"""
Pokémon TCG API（完全無料・登録不要）からカードマスターデータを取得する
https://pokemontcg.io/
"""

import time
import requests
from utils.supabase_client import upsert_cards

API_BASE = "https://api.pokemontcg.io/v2"
PAGE_SIZE = 250


def fetch_all_cards(set_id=None):  # type: ignore
    """指定セット（またはすべて）のカードを取得"""
    cards = []
    page = 1

    while True:
        params: dict = {"pageSize": PAGE_SIZE, "page": page}
        if set_id:
            params["q"] = f"set.id:{set_id}"

        resp = requests.get(f"{API_BASE}/cards", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        batch = data.get("data", [])
        cards.extend(batch)

        print(f"  page {page}: {len(batch)} cards (total: {len(cards)})")

        if len(cards) >= data.get("totalCount", 0):
            break
        page += 1
        time.sleep(0.3)  # APIに負荷をかけない

    return cards


def transform_card(raw: dict) -> dict:
    """APIレスポンスをSupabaseのcardsテーブル形式に変換"""
    return {
        "name": raw.get("name", ""),
        "name_ja": None,
        "game": "pokemon",
        "set_name": raw.get("set", {}).get("name", ""),
        "set_code": raw.get("set", {}).get("id"),
        "rarity": raw.get("rarity"),
        "image_url": raw.get("images", {}).get("small"),
        "external_id": raw["id"],
    }


def sync_recent_sets() -> None:
    """直近の主要セットを同期（初回以降の差分更新用）"""
    # 最新の3セットのIDを指定（定期的に更新する）
    recent_set_ids = [
        "sv8a",  # 例：最新弾
        "sv8",
        "sv7",
    ]
    for set_id in recent_set_ids:
        print(f"Fetching Pokemon cards for set: {set_id}")
        raw_cards = fetch_all_cards(set_id=set_id)
        records = [transform_card(c) for c in raw_cards]
        upsert_cards(records)
        time.sleep(1)


def sync_all() -> None:
    """全カードを同期（初回セットアップ用）"""
    print("Fetching all Pokemon cards...")
    raw_cards = fetch_all_cards()
    records = [transform_card(c) for c in raw_cards]
    upsert_cards(records)


if __name__ == "__main__":
    sync_recent_sets()
