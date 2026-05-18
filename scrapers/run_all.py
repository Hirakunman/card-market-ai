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

    # 価格スクレイピング後に予測を更新
    print("=== 価格予測更新開始 ===")
    try:
        from predictions.predictor import run_predictions
        run_predictions()
    except Exception as e:
        print(f"ERROR running predictions: {e}")
    print("=== 価格予測更新完了 ===")


def run_cards():
    print("=== カードマスター同期開始（日本版）===")
    from apis.pokemon_jp import sync_recent_sets as pokemon_sync
    from apis.ygo_prodeck import sync_all as ygo_sync
    from apis.scryfall import sync_recent_sets as mtg_sync
    from apis.onepiece import sync_recent_sets as op_sync

    try:
        print("--- ポケモン公式（日本）---")
        pokemon_sync()
    except Exception as e:
        print(f"ERROR Pokemon JP sync: {e}")

    try:
        print("--- 遊戯王（日本語）---")
        ygo_sync()
    except Exception as e:
        print(f"ERROR YuGiOh sync: {e}")

    try:
        print("--- MTG Scryfall（日本語）---")
        mtg_sync()
    except Exception as e:
        print(f"ERROR MTG sync: {e}")

    try:
        print("--- ワンピースカード ---")
        op_sync()
    except Exception as e:
        print(f"ERROR One Piece sync: {e}")

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
