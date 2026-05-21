"""
再販・追加生産情報スクレイパー

公式ニュースページから「再販」「追加生産」「再出荷」等のキーワードを含む
記事を自動収集し reprint_events テーブルに保存する。
"""

import re
from datetime import datetime, date
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from utils.supabase_client import get_client

HEADERS = {
    "User-Agent": "CardMarketAI-Bot/1.0 (price research; educational)",
    "Accept-Language": "ja-JP,ja;q=0.9",
}

REPRINT_KEYWORDS = ["再販", "追加生産", "再出荷", "受注生産", "追加販売", "再生産"]

# セット名らしき文字列をタイトルから抽出（「」内）
SET_PATTERN = re.compile(r"[「『]([^」』]+)[」』]")


def parse_japanese_date(text: str) -> Optional[date]:
    """2026.5.21 / 2026/05/21 形式を date に変換"""
    m = re.search(r"(\d{4})[./](\d{1,2})[./](\d{1,2})", text)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def extract_set_name(title: str) -> Optional[str]:
    matches = SET_PATTERN.findall(title)
    if matches:
        # 最も長いマッチをセット名とみなす
        return max(matches, key=len)
    return None


def guess_impact(title: str) -> str:
    """人気BOX・スタートデッキ等は影響大"""
    high_kw = ["スタートデッキ", "拡張パック", "スペシャル", "BOX", "メガ", "シャイニー"]
    if any(kw in title for kw in high_kw):
        return "high"
    if "追加" in title or "再販" in title:
        return "medium"
    return "low"


def scrape_news_list(base_url: str, game: str, link_pattern: str) -> list[dict]:
    """ニュース一覧ページから再販関連記事を抽出"""
    events = []
    try:
        res = requests.get(base_url, headers=HEADERS, timeout=20)
        res.raise_for_status()
    except Exception as e:
        print(f"    {game} reprint fetch error: {e}")
        return events

    soup = BeautifulSoup(res.text, "html.parser")
    seen_urls = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if link_pattern not in href:
            continue

        title = a.get_text(strip=True)
        if not title or len(title) < 8:
            continue
        if not any(kw in title for kw in REPRINT_KEYWORDS):
            continue

        full_url = urljoin(base_url, href)
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        # 日付はリンク周辺テキストまたはタイトル末尾から
        parent_text = a.parent.get_text(" ", strip=True) if a.parent else title
        event_date = parse_japanese_date(parent_text) or parse_japanese_date(title) or date.today()

        events.append({
            "game": game,
            "title": title[:300],
            "set_name": extract_set_name(title),
            "event_date": event_date.isoformat(),
            "source_url": full_url,
            "impact": guess_impact(title),
        })

    return events


def sync_reprint_events() -> None:
    """全ゲームの再販情報を同期"""
    client = get_client()
    print("\n=== 再販情報収集開始 ===")

    sources = [
        ("pokemon", "https://www.pokemon-card.com/info/", "/info/"),
        ("onepiece", "https://www.onepiece-cardgame.com/news/", "/news/"),
        ("yugioh", "https://www.yugioh-card.com/news/", "/news/"),
    ]

    all_events = []
    for game, url, pattern in sources:
        found = scrape_news_list(url, game, pattern)
        print(f"  {game}: {len(found)}件")
        all_events.extend(found)

    saved = 0
    for ev in all_events:
        try:
            client.table("reprint_events").upsert(ev, on_conflict="source_url").execute()
            saved += 1
        except Exception as e:
            print(f"    ERROR saving reprint: {e}")

    print(f"  完了: {saved}件保存")


if __name__ == "__main__":
    sync_reprint_events()
