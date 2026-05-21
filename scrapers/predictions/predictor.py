"""
価格変動予測エンジン

【予測ロジック】
データが貯まるほど精度が上がる段階的な設計：

1. data_days < 3  → 低信頼度。レアリティ・ゲーム別の平均変動率を使用
2. data_days 3-30 → 中信頼度。実際の価格トレンドを線形回帰で計算
3. data_days > 30 → 高信頼度。長期トレンド＋季節性＋ボラティリティ考慮

【予測の考え方】
- 1週間後: 直近トレンドの継続（勢いが弱まる係数を適用）
- 1ヶ月後: トレンド＋平均回帰圧力（高すぎる価格は戻る傾向）
- 1年後:  ゲーム・レアリティ別の長期傾向＋セット年齢によるプレミアム係数
"""

import math
from datetime import datetime, timezone
from typing import Optional
from utils.supabase_client import get_client

# ゲーム別・長期価格変動の傾向（年率）
# 人気ゲームほどカードのプレミアム化が起きやすい
GAME_YEAR_TREND = {
    "pokemon":  0.08,   # +8%/年（人気安定）
    "onepiece": 0.12,   # +12%/年（成長中）
    "yugioh":   0.05,   # +5%/年（成熟市場）
    "mtg":      0.07,   # +7%/年（収集需要安定）
}

# レアリティ別の価格変動リスク係数（高レアほど変動大）
RARITY_VOLATILITY = {
    # ポケモン
    "SAR": 1.8, "UR": 1.6, "SR": 1.4, "RR": 1.1,
    "R": 0.9, "U": 0.7, "C": 0.5,
    # ワンピース
    "SEC": 1.9, "SP": 1.7, "L": 1.5, "SR": 1.4,
    # 遊戯王
    "20th Secret Rare": 2.0, "Prismatic Secret Rare": 1.9,
    "Ultimate Rare": 1.7, "Ghost Rare": 1.6,
    "Secret Rare": 1.5, "Ultra Rare": 1.3,
    # MTG
    "Mythic Rare": 1.6, "Rare": 1.2,
}

# データ日数による信頼度
def parse_ts(raw: str) -> datetime:
    """マイクロ秒桁数が不揃いなタイムスタンプを安全にパース"""
    raw = raw.replace("Z", "+00:00")
    if "." in raw:
        base, frac = raw.split(".", 1)
        tz = ""
        for sep in ["+", "-"]:
            if sep in frac:
                idx = frac.index(sep)
                tz = sep + frac[idx + 1:]
                frac = frac[:idx]
                break
        frac = frac[:6].ljust(6, "0")
        raw = f"{base}.{frac}{tz}"
    return datetime.fromisoformat(raw)


def get_confidence(data_days: int) -> str:
    if data_days >= 30:
        return "high"
    elif data_days >= 7:
        return "medium"
    return "low"


def calc_trend_rate(prices_asc: list) -> float:
    """
    時系列価格リストから線形回帰で1日あたりの変化率を計算
    prices_asc: [(price, days_ago), ...] 古い順
    """
    n = len(prices_asc)
    if n < 2:
        return 0.0

    # 最初の価格を基準に変化率を計算
    base = prices_asc[0][0]
    if base <= 0:
        return 0.0

    # 最小二乗法で傾き計算
    days_list = [p[1] for p in prices_asc]
    rates = [(p[0] - base) / base for p in prices_asc]

    x_mean = sum(days_list) / n
    y_mean = sum(rates) / n

    numerator = sum((days_list[i] - x_mean) * (rates[i] - y_mean) for i in range(n))
    denominator = sum((days_list[i] - x_mean) ** 2 for i in range(n))

    if denominator == 0:
        return 0.0

    slope = numerator / denominator  # 1日あたりの変化率
    return slope


def apply_mean_reversion(current_price: int, base_price: int, trend_rate: float, horizon_days: int) -> float:
    """
    平均回帰圧力を適用。価格が大幅に上昇しているほど戻る圧力が強くなる
    """
    if base_price <= 0:
        return trend_rate

    deviation = (current_price - base_price) / base_price

    # ±50%超の乖離には強い回帰圧力
    reversion_strength = 0.002 * deviation
    adjusted_rate = trend_rate - reversion_strength

    return adjusted_rate


def remove_outliers(prices: list[int]) -> list[int]:
    """IQR法で外れ値を除去（フェイク高騰・誤入力対策）"""
    if len(prices) < 4:
        return prices
    s = sorted(prices)
    n = len(s)
    q1 = s[n // 4]
    q3 = s[(n * 3) // 4]
    iqr = q3 - q1
    lower = q1 - 2.0 * iqr
    upper = q3 + 2.0 * iqr
    filtered = [p for p in prices if lower <= p <= upper]
    return filtered if len(filtered) >= 2 else prices


def predict_card(card_id: str, game: str, rarity: Optional[str], price_history: list) -> dict:
    """
    1枚のカードの価格を予測する

    price_history: [{'price': int, 'recorded_at': str}, ...] 新しい順
    """
    if not price_history:
        return None

    # 外れ値を除去してからトレンド計算（フェイク高騰・誤入力対策）
    raw_prices = [p["price"] for p in price_history]
    clean_prices = remove_outliers(raw_prices)

    # クリーン後の最新価格を使用
    current_price = clean_prices[0] if clean_prices else price_history[0]["price"]
    data_days = 0

    if len(price_history) >= 2:
        newest = parse_ts(price_history[0]["recorded_at"])
        oldest = parse_ts(price_history[-1]["recorded_at"])
        data_days = max(1, (newest - oldest).days)

    confidence = get_confidence(data_days)
    year_trend = GAME_YEAR_TREND.get(game, 0.06)
    vol = RARITY_VOLATILITY.get(rarity or "", 1.0)

    # 価格データから実際のトレンドを計算
    if len(price_history) >= 3:
        now_ts = datetime.now(timezone.utc)
        prices_asc = []
        for p in reversed(price_history):
            ts = parse_ts(p["recorded_at"])
            days_from_start = (now_ts - ts).days
            prices_asc.append((p["price"], days_from_start))

        daily_rate = calc_trend_rate(prices_asc)
        # 異常値クリップ（1日±5%以上のトレンドは現実的でない）
        daily_rate = max(-0.05, min(0.05, daily_rate))
    else:
        # データが少ない場合はゲーム平均トレンドを使用
        daily_rate = year_trend / 365

    # 1週間後予測（7日）
    # 直近トレンドが継続するが、勢いが70%に減衰
    rate_1w = daily_rate * 7 * 0.7
    pred_1w = max(1, round(current_price * (1 + rate_1w)))

    # 1ヶ月後予測（30日）
    # トレンド継続（50%に減衰）＋平均回帰圧力
    base_price = price_history[-1]["price"] if price_history else current_price
    adjusted_daily = apply_mean_reversion(current_price, base_price, daily_rate, 30)
    rate_1m = adjusted_daily * 30 * 0.5 + (year_trend / 12)
    pred_1m = max(1, round(current_price * (1 + rate_1m)))

    # 1年後予測（365日）
    # 長期ゲームトレンド＋レアリティプレミアム＋セット年齢ボーナス
    # トレンド影響は20%のみ（長期は平均回帰が強い）
    long_rate = daily_rate * 365 * 0.2 + year_trend
    # レアリティが高いほど長期プレミアムが上乗せ
    rarity_bonus = (vol - 1.0) * 0.05
    rate_1y = long_rate + rarity_bonus
    # 1年後は±80%にクリップ（投機的すぎる予測を防ぐ）
    rate_1y = max(-0.8, min(0.8, rate_1y))
    pred_1y = max(1, round(current_price * (1 + rate_1y)))

    # 変化率（%）
    def pct(pred, cur):
        if cur <= 0:
            return 0.0
        return round((pred - cur) / cur * 100, 1)

    return {
        "card_id": card_id,
        "current_price": current_price,
        "pred_1w": pred_1w,
        "pred_1m": pred_1m,
        "pred_1y": pred_1y,
        "change_1w": pct(pred_1w, current_price),
        "change_1m": pct(pred_1m, current_price),
        "change_1y": pct(pred_1y, current_price),
        "confidence": confidence,
        "data_days": data_days,
    }


def apply_insights(prediction: dict, insights: Optional[dict]) -> dict:
    """市場シグナル（メルカリ急騰・再販・PSA）を予測に反映"""
    if not insights or not prediction:
        return prediction

    cur = prediction["current_price"]
    c1w = prediction["change_1w"]
    c1m = prediction["change_1m"]
    c1y = prediction["change_1y"]

    # メルカリ急騰 → 短期予測を上方修正（最大+15%）
    if insights.get("mercari_surge") and insights.get("mercari_change_7d"):
        boost = min(float(insights["mercari_change_7d"]) * 0.35, 15.0)
        c1w += boost
        c1m += boost * 0.4

    # 再販リスク → 中長期予測を下方修正
    risk = insights.get("reprint_risk", "none")
    if risk == "high":
        c1m -= 12.0
        c1y -= 20.0
    elif risk == "medium":
        c1m -= 6.0
        c1y -= 10.0
    elif risk == "low":
        c1m -= 2.0
        c1y -= 4.0

    # PSAプレミアム高 → 長期コレクター需要を反映
    premium = insights.get("psa_premium_pct")
    if premium and float(premium) > 150:
        c1y += min(float(premium) * 0.02, 8.0)

    def clamp(v, lo=-80.0, hi=80.0):
        return max(lo, min(hi, v))

    c1w, c1m, c1y = clamp(c1w), clamp(c1m), clamp(c1y)

    prediction["change_1w"] = round(c1w, 1)
    prediction["change_1m"] = round(c1m, 1)
    prediction["change_1y"] = round(c1y, 1)
    prediction["pred_1w"] = max(1, round(cur * (1 + c1w / 100)))
    prediction["pred_1m"] = max(1, round(cur * (1 + c1m / 100)))
    prediction["pred_1y"] = max(1, round(cur * (1 + c1y / 100)))
    return prediction


def run_predictions(game: Optional[str] = None, limit: int = 5000) -> None:
    """全カードの予測を計算してSupabaseに保存"""
    client = get_client()

    print(f"=== 価格予測開始 (game={game or 'all'}) ===")

    # バグ修正: 同一カードの重複price行を除去して正しく distinct card_ids を取得
    # 旧コードは limit(N) を price「行」に適用していたため、1カードに10行あると10行で埋まった
    prices_res = (
        client.table("prices")
        .select("card_id")
        .limit(limit * 30)   # 重複吸収のため多めに取得
        .execute()
    )
    # dict.fromkeys で挿入順を維持しつつ重複排除
    card_ids = list(dict.fromkeys(p["card_id"] for p in prices_res.data))[:limit]
    print(f"  価格データのあるカード: {len(card_ids)}枚")

    if not card_ids:
        print("  価格データなし。スキップ")
        return

    # カード情報を取得（ゲームフィルタ適用）
    query = client.table("cards").select("id,game,rarity,set_name").in_("id", card_ids)
    if game:
        query = query.eq("game", game)
    cards_res = query.execute()
    cards = cards_res.data

    print(f"  対象カード: {len(cards)}枚")

    saved = 0
    skipped = 0

    for card in cards:
        card_id = card["id"]
        game_key = card["game"]
        rarity = card.get("rarity")

        # 直近90日の価格履歴を取得（新しい順）
        history_res = (
            client.table("prices")
            .select("price,recorded_at")
            .eq("card_id", card_id)
            .order("recorded_at", desc=True)
            .limit(90)
            .execute()
        )

        if not history_res.data:
            skipped += 1
            continue

        prediction = predict_card(card_id, game_key, rarity, history_res.data)
        if not prediction:
            skipped += 1
            continue

        # 市場インサイト（メルカリ急騰・PSA・再販）を反映
        try:
            insight_res = (
                client.table("card_insights")
                .select("*")
                .eq("card_id", card_id)
                .single()
                .execute()
            )
            if insight_res.data:
                prediction = apply_insights(prediction, insight_res.data)
        except Exception:
            pass

        # upsert（既存なら更新）
        prediction["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            client.table("predictions").upsert(
                prediction,
                on_conflict="card_id"
            ).execute()
            saved += 1
        except Exception as e:
            print(f"    ERROR saving {card_id}: {e}")

        if saved % 100 == 0 and saved > 0:
            print(f"  ... {saved} 件保存済み")

    print(f"  完了: {saved}件保存, {skipped}件スキップ")


if __name__ == "__main__":
    import sys
    game_arg = sys.argv[1] if len(sys.argv) > 1 else None
    run_predictions(game=game_arg)
