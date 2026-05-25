"""
GitHub Actions cron から呼ばれるエントリーポイント

使い方:
  python run_all.py --mode prices    # 全価格収集 + 予測
  python run_all.py --mode mercari   # メルカリ重点 + 予測（高騰精度向上）
  python run_all.py --mode cards     # カードマスター同期
  python run_all.py --mode all       # 全部
"""

import argparse


def _run_migrations():
    try:
        from migrations.apply import apply_migrations
        apply_migrations()
    except Exception as e:
        print(f"WARN migrations: {e}")


def run_mercari():
    """メルカリ重点モード（1日3回実行用・高速）"""
    _run_migrations()
    print("=== メルカリ重点収集 ===")
    try:
        from prices.mercari import scrape_mercari_prices
        scrape_mercari_prices(limit=200)
    except Exception as e:
        print(f"ERROR scraping mercari: {e}")

    print("=== 価格予測更新 ===")
    try:
        from predictions.predictor import run_predictions
        run_predictions()
    except Exception as e:
        print(f"ERROR running predictions: {e}")


def run_prices():
    _run_migrations()
    print("=== 価格スクレイピング開始 ===")

    from prices.yuyutei import scrape_game
    for game in ["pokemon", "yugioh", "onepiece"]:
        try:
            scrape_game(game)
        except Exception as e:
            print(f"ERROR scraping {game} yuyutei: {e}")

    try:
        from prices.mercari import scrape_mercari_prices
        scrape_mercari_prices(limit=200)
    except Exception as e:
        print(f"ERROR scraping mercari: {e}")

    try:
        from prices.psa_mercari import scrape_psa_prices
        scrape_psa_prices(limit=80)
    except Exception as e:
        print(f"ERROR scraping psa: {e}")

    try:
        from events.reprints import sync_reprint_events
        sync_reprint_events()
    except Exception as e:
        print(f"ERROR syncing reprints: {e}")

    try:
        from insights.updater import update_reprint_risks
        update_reprint_risks()
    except Exception as e:
        print(f"ERROR updating reprint risks: {e}")

    print("=== 価格スクレイピング完了 ===")

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

    for label, fn in [
        ("ポケモン公式（日本）", pokemon_sync),
        ("遊戯王（日本語）", ygo_sync),
        ("MTG Scryfall（日本語）", mtg_sync),
        ("ワンピースカード", op_sync),
    ]:
        try:
            print(f"--- {label} ---")
            fn()
        except Exception as e:
            print(f"ERROR {label}: {e}")

    print("=== カードマスター同期完了 ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["prices", "mercari", "cards", "all"],
        default="prices",
    )
    args = parser.parse_args()

    if args.mode in ("cards", "all"):
        run_cards()
    if args.mode == "mercari":
        run_mercari()
    elif args.mode in ("prices", "all"):
        run_prices()
