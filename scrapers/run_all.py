"""
GitHub Actions cron から呼ばれるエントリーポイント
毎朝6時・毎夜18時に自動実行される

使い方:
  cd scrapers
  python run_all.py --mode prices    # 価格更新のみ
  python run_all.py --mode cards     # カードマスター同期のみ
  python run_all.py --mode all       # 両方
"""

import sys
import argparse


def run_prices():
    print("=== 価格スクレイピング開始 ===")
    from prices.yuyutei import scrape_game
    for game in ["pokemon", "yugioh", "onepiece"]:
        try:
            scrape_game(game)
        except Exception as e:
            print(f"ERROR scraping {game}: {e}")
    print("=== 価格スクレイピング完了 ===")


def run_cards():
    print("=== カードマスター同期開始 ===")
    from apis.pokemon_tcg import sync_recent_sets as pokemon_sync
    from apis.ygo_prodeck import sync_all as ygo_sync
    from apis.scryfall import sync_recent_sets as mtg_sync

    try:
        print("--- Pokemon TCG API ---")
        pokemon_sync()
    except Exception as e:
        print(f"ERROR Pokemon sync: {e}")

    try:
        print("--- YGOPRODeck API ---")
        ygo_sync()
    except Exception as e:
        print(f"ERROR YuGiOh sync: {e}")

    try:
        print("--- Scryfall API ---")
        mtg_sync()
    except Exception as e:
        print(f"ERROR MTG sync: {e}")

    print("=== カードマスター同期完了 ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["prices", "cards", "all"],
        default="prices",
        help="実行モード: prices=価格のみ / cards=マスターのみ / all=両方",
    )
    args = parser.parse_args()

    if args.mode in ("cards", "all"):
        run_cards()
    if args.mode in ("prices", "all"):
        run_prices()
