"""
価格変動予測エンジン（高騰精度重視版）

- メルカリ実売 + 遊々亭をブレンドした現在値
- 7日モメンタム + 線形トレンドの複合予測
- rise_score で高騰ランキングの信頼度を数値化
"""

from datetime import datetime, timezone
from typing import Optional

from utils.supabase_client import get_client
from predictions.price_utils import (
    parse_ts,
    remove_outliers,
    aggregate_daily,
    get_blended_daily,
    calc_momentum,
    get_current_price,
    calc_rise_score,
)

GAME_YEAR_TREND = {
    "pokemon":  0.08,
    "onepiece": 0.12,
    "yugioh":   0.05,
    "mtg":      0.07,
}

RARITY_VOLATILITY = {
    "SAR": 1.8, "UR": 1.6, "SR": 1.4, "RR": 1.1,
    "R": 0.9, "U": 0.7, "C": 0.5,
    "SEC": 1.9, "SP": 1.7, "L": 1.5,
    "20th Secret Rare": 2.0, "Prismatic Secret Rare": 1.9,
    "Ultimate Rare": 1.7, "Ghost Rare": 1.6,
    "Secret Rare": 1.5, "Ultra Rare": 1.3,
    "Mythic Rare": 1.6, "Rare": 1.2,
}


def get_confidence(data_days: int, has_mercari: bool) -> str:
    """メルカリデータがあると信頼度が上がりやすい"""
    if data_days >= 30 and has_mercari:
        return "high"
    if data_days >= 30 or (data_days >= 14 and has_mercari):
        return "medium"
    if data_days >= 7 or (data_days >= 3 and has_mercari):
        return "medium" if has_mercari else "low"
    return "low"


def calc_trend_rate(prices_asc: list) -> float:
    n = len(prices_asc)
    if n < 2:
        return 0.0
    base = prices_asc[0][0]
    if base <= 0:
        return 0.0
    days_list = [p[1] for p in prices_asc]
    rates = [(p[0] - base) / base for p in prices_asc]
    x_mean = sum(days_list) / n
    y_mean = sum(rates) / n
    numerator = sum((days_list[i] - x_mean) * (rates[i] - y_mean) for i in range(n))
    denominator = sum((days_list[i] - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    return numerator / denominator


def apply_mean_reversion(current_price: int, base_price: int, trend_rate: float) -> float:
    if base_price <= 0:
        return trend_rate
    deviation = (current_price - base_price) / base_price
    return trend_rate - 0.002 * deviation


def predict_card(card_id: str, game: str, rarity: Optional[str], price_history: list) -> dict:
    if not price_history:
        return None

    current_price, has_mercari = get_current_price(price_history)

    daily = aggregate_daily(price_history)
    blended = get_blended_daily(daily)
    momentum_7d = calc_momentum(blended, days=7)

    data_days = 0
    if len(price_history) >= 2:
        newest = parse_ts(price_history[0]["recorded_at"])
        oldest = parse_ts(price_history[-1]["recorded_at"])
        data_days = max(1, (newest - oldest).days)

    confidence = get_confidence(data_days, has_mercari)
    year_trend = GAME_YEAR_TREND.get(game, 0.06)
    vol = RARITY_VOLATILITY.get(rarity or "", 1.0)

    # ブレンド日次価格からトレンド計算
    if len(blended) >= 3:
        now = datetime.now(timezone.utc).date()
        prices_asc = []
        for day_str, price in blended:
            day = datetime.fromisoformat(day_str).date()
            days_ago = (now - day).days
            prices_asc.append((price, days_ago))
        daily_rate = calc_trend_rate(prices_asc)
        daily_rate = max(-0.05, min(0.05, daily_rate))
    else:
        daily_rate = year_trend / 365

    # モメンタムが強い場合は短期予測に反映（実売急騰を捉える）
    momentum_boost = 0.0
    if momentum_7d is not None and momentum_7d > 0:
        momentum_boost = min(momentum_7d / 100, 0.12)

    # 1週間後: トレンド + モメンタム（メルカリ急騰時はモメンタム比重UP）
    mom_weight = 0.55 if has_mercari else 0.25
    rate_1w = daily_rate * 7 * 0.65 * (1 - mom_weight) + momentum_boost * mom_weight
    pred_1w = max(1, round(current_price * (1 + rate_1w)))

    # 1ヶ月後
    base_price = blended[0][1] if blended else current_price
    adjusted_daily = apply_mean_reversion(current_price, base_price, daily_rate)
    rate_1m = adjusted_daily * 30 * 0.45 + (year_trend / 12) + momentum_boost * 0.3
    pred_1m = max(1, round(current_price * (1 + rate_1m)))

    # 1年後
    long_rate = daily_rate * 365 * 0.15 + year_trend + (vol - 1.0) * 0.05
    rate_1y = max(-0.8, min(0.8, long_rate))
    pred_1y = max(1, round(current_price * (1 + rate_1y)))

    def pct(pred, cur):
        if cur <= 0:
            return 0.0
        return round((pred - cur) / cur * 100, 1)

    change_1w = pct(pred_1w, current_price)
    change_1m = pct(pred_1m, current_price)
    change_1y = pct(pred_1y, current_price)

    return {
        "card_id": card_id,
        "current_price": current_price,
        "pred_1w": pred_1w,
        "pred_1m": pred_1m,
        "pred_1y": pred_1y,
        "change_1w": change_1w,
        "change_1m": change_1m,
        "change_1y": change_1y,
        "confidence": confidence,
        "data_days": data_days,
        "mercari_confirmed": has_mercari,
        "momentum_7d": momentum_7d,
        "_rise_inputs": {
            "change_1w": change_1w,
            "change_1m": change_1m,
            "confidence": confidence,
            "momentum_7d": momentum_7d,
            "has_mercari": has_mercari,
        },
    }


def apply_insights(prediction: dict, insights: Optional[dict]) -> dict:
    if not insights or not prediction:
        return prediction

    cur = prediction["current_price"]
    c1w = prediction["change_1w"]
    c1m = prediction["change_1m"]
    c1y = prediction["change_1y"]

    if insights.get("mercari_surge") and insights.get("mercari_change_7d"):
        boost = min(float(insights["mercari_change_7d"]) * 0.45, 20.0)
        c1w += boost
        c1m += boost * 0.5
        prediction["mercari_confirmed"] = True

    risk = insights.get("reprint_risk", "none")
    if risk == "high":
        c1m -= 15.0
        c1y -= 22.0
    elif risk == "medium":
        c1m -= 7.0
        c1y -= 12.0
    elif risk == "low":
        c1m -= 2.0
        c1y -= 4.0

    premium = insights.get("psa_premium_pct")
    if premium and float(premium) > 150:
        c1y += min(float(premium) * 0.025, 10.0)

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


def finalize_rise_score(prediction: dict, insights: Optional[dict]) -> dict:
    """rise_score を算出して prediction に付与"""
    ins = insights or {}
    prediction["rise_score"] = calc_rise_score(
        change_1w=prediction["change_1w"],
        change_1m=prediction["change_1m"],
        confidence=prediction["confidence"],
        momentum_7d=prediction.get("momentum_7d"),
        has_mercari=prediction.get("mercari_confirmed", False),
        mercari_surge=bool(ins.get("mercari_surge")),
        mercari_change_7d=ins.get("mercari_change_7d"),
        reprint_risk=ins.get("reprint_risk", "none"),
    )
    prediction.pop("_rise_inputs", None)
    prediction.pop("momentum_7d", None)
    return prediction


def run_predictions(game: Optional[str] = None, limit: int = 5000) -> None:
    client = get_client()
    print(f"=== 価格予測開始 (game={game or 'all'}) ===")

    prices_res = (
        client.table("prices")
        .select("card_id")
        .limit(limit * 30)
        .execute()
    )
    card_ids = list(dict.fromkeys(p["card_id"] for p in prices_res.data))[:limit]
    print(f"  価格データのあるカード: {len(card_ids)}枚")

    if not card_ids:
        print("  価格データなし。スキップ")
        return

    query = client.table("cards").select("id,game,rarity,set_name").in_("id", card_ids)
    if game:
        query = query.eq("game", game)
    cards = query.execute().data

    saved = 0
    skipped = 0

    for card in cards:
        card_id = card["id"]

        history_res = (
            client.table("prices")
            .select("price,recorded_at,source")
            .eq("card_id", card_id)
            .order("recorded_at", desc=True)
            .limit(120)
            .execute()
        )

        if not history_res.data:
            skipped += 1
            continue

        prediction = predict_card(card_id, card["game"], card.get("rarity"), history_res.data)
        if not prediction:
            skipped += 1
            continue

        insights = None
        try:
            insight_res = (
                client.table("card_insights")
                .select("*")
                .eq("card_id", card_id)
                .maybe_single()
                .execute()
            )
            insights = insight_res.data
            if insights:
                prediction = apply_insights(prediction, insights)
        except Exception:
            pass

        prediction = finalize_rise_score(prediction, insights)
        prediction["updated_at"] = datetime.now(timezone.utc).isoformat()

        try:
            client.table("predictions").upsert(prediction, on_conflict="card_id").execute()
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
