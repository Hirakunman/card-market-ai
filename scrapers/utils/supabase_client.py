import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def upsert_cards(cards: list[dict]) -> None:
    """cardsテーブルにupsert（game + external_id をキーに重複排除）"""
    if not cards:
        return
    client = get_client()
    client.table("cards").upsert(cards, on_conflict="game,external_id").execute()
    print(f"  upserted {len(cards)} cards")


def insert_prices(prices: list[dict]) -> None:
    """pricesテーブルにINSERT（価格は常に新規追加）"""
    if not prices:
        return
    client = get_client()
    client.table("prices").insert(prices).execute()
    print(f"  inserted {len(prices)} prices")


def get_card_id(game: str, external_id: str) -> Optional[str]:
    """game + external_id から内部UUIDを取得"""
    client = get_client()
    res = (
        client.table("cards")
        .select("id")
        .eq("game", game)
        .eq("external_id", str(external_id))
        .single()
        .execute()
    )
    return res.data["id"] if res.data else None
