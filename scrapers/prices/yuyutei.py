"""
遊々亭 価格スクレイパー（Playwright対応・日本語版）

robots.txt: https://yuyu-tei.jp/robots.txt 確認済み
- Disallow: /user/ のみ → カード価格ページはアクセス可
- リクエスト間隔を3秒以上空ける

Playwright でJSレンダリングし div.card-product を解析
"""

import os
import re
import time
from typing import Optional

from utils.supabase_client import get_client

PLAYWRIGHT_BROWSERS_PATH = os.path.expanduser("~/.playwright-browsers")

# 遊々亭のゲームコード対応表
GAME_CONFIG = {
    "pokemon": {"code": "poc", "game": "pokemon"},
    "onepiece": {"code": "opc", "game": "onepiece"},
    "yugioh": {"code": "ygo", "game": "yugioh"},
}

# 最近の重要セットのみに絞る（古いセットはスキップ）
SKIP_SET_CODES = {"new", "damage", "sale", "search", "don"}


def get_set_codes(page, game_code: str) -> list:
    """トップページからセットコードを順序保持で取得（新しい順）"""
    try:
        page.goto(f"https://yuyu-tei.jp/top/{game_code}", timeout=20000)
        time.sleep(2)
        content = page.content()
        pattern = rf"/sell/{game_code}/s/([a-z0-9\-]+)"
        # 出現順を保持しつつ重複排除（ページ上部＝新しいセット）
        seen = set()
        codes = []
        for m in re.finditer(pattern, content):
            code = m.group(1)
            if code not in seen and code not in SKIP_SET_CODES and "?" not in code:
                seen.add(code)
                codes.append(code)
        return codes
    except Exception as e:
        print(f"  set code fetch error: {e}")
        return []


def scrape_set_page(page, game_code: str, set_code: str) -> list:
    """セットページから全カードの価格を取得"""
    url = f"https://yuyu-tei.jp/sell/{game_code}/s/{set_code}"
    try:
        page.goto(url, timeout=20000)
        time.sleep(2)
    except Exception as e:
        print(f"    load error {set_code}: {e}")
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page.content(), "html.parser")
    items = soup.select("div.card-product")

    results = []
    for item in items:
        try:
            img_tag = item.find("img", class_="card")
            name_tag = item.find("h4", class_="text-primary")
            price_tag = item.find("strong")
            span = item.find("span", class_="text-center")

            if not name_tag or not price_tag:
                continue

            name = name_tag.get_text(strip=True)
            price_text = re.sub(r"[^\d]", "", price_tag.get_text())
            if not price_text:
                continue
            price = int(price_text)
            if price <= 0:
                continue

            card_no = span.get_text(strip=True) if span else ""
            img_url = img_tag.get("src", "") if img_tag else ""
            img_alt = img_tag.get("alt", "") if img_tag else ""

            # alt属性からレアリティ取得: "120/083 MUR メガゲッコウガex"
            rarity = ""
            if img_alt:
                parts = img_alt.strip().split()
                if len(parts) >= 2:
                    rarity = parts[1]

            results.append({
                "name": name,
                "price": price,
                "image_url": img_url or None,
                "rarity": rarity or None,
                "set_name": set_code,
                "card_no": card_no,
            })
        except Exception:
            continue

    return results


def get_or_create_card(game: str, name: str, image_url=None, rarity=None, set_name="", card_no="") -> Optional[str]:
    """カード名でDBを検索し、なければ日本語名で新規作成してIDを返す"""
    client = get_client()

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

    # 新規作成
    ext_id = f"yuyutei_{game}_{re.sub(r'[^a-zA-Z0-9]', '_', name)[:40]}_{card_no[:10]}"
    new_card = {
        "name": name,
        "name_ja": name,
        "game": game,
        "set_name": set_name or "",
        "rarity": rarity,
        "image_url": image_url,
        "external_id": ext_id,
    }
    try:
        insert_res = client.table("cards").insert(new_card).execute()
        if insert_res.data:
            return insert_res.data[0]["id"]
    except Exception as e:
        # external_id重複の場合はもう一度検索
        res2 = (
            client.table("cards")
            .select("id")
            .eq("game", game)
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        if res2.data:
            return res2.data[0]["id"]
    return None


def save_prices(game: str, price_data: list) -> None:
    """価格データをSupabaseに保存"""
    client = get_client()
    saved = 0
    created = 0

    for item in price_data:
        card_id = get_or_create_card(
            game,
            item["name"],
            image_url=item.get("image_url"),
            rarity=item.get("rarity"),
            set_name=item.get("set_name", ""),
            card_no=item.get("card_no", ""),
        )
        if not card_id:
            continue

        try:
            client.table("prices").insert({
                "card_id": card_id,
                "source": "yuyutei",
                "price": item["price"],
                "condition": "NM",
            }).execute()
            saved += 1
        except Exception:
            pass

    print(f"  saved {saved} prices / {created} new cards for {game}")


def scrape_game(game_key: str, max_sets: int = 20) -> None:
    """Playwright でゲームの全セットを巡回して価格取得"""
    config = GAME_CONFIG.get(game_key)
    if not config:
        print(f"Unknown game: {game_key}")
        return

    game_code = config["code"]
    game = config["game"]
    print(f"\nScraping yuyutei: {game_key} ({game_code})")

    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = PLAYWRIGHT_BROWSERS_PATH

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  Playwright not installed. Run: pip install playwright && playwright install chromium")
        return

    all_prices = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({"Accept-Language": "ja-JP,ja;q=0.9"})

        set_codes = get_set_codes(page, game_code)
        print(f"  Found {len(set_codes)} sets")

        # 出現順（新しい順）で先頭から取得
        target_sets = set_codes[:max_sets]
        print(f"  Scraping {len(target_sets)} sets: {target_sets[:5]}...")

        for set_code in reversed(target_sets):
            prices = scrape_set_page(page, game_code, set_code)
            print(f"    {set_code}: {len(prices)} cards")
            all_prices.extend(prices)
            time.sleep(3)

        browser.close()

    print(f"  Total: {len(all_prices)} prices")
    if all_prices:
        save_prices(game, all_prices)


if __name__ == "__main__":
    for g in ["pokemon", "onepiece"]:
        scrape_game(g)
        time.sleep(5)
