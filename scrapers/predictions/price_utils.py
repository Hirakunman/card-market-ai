"""
価格データの集計・ブレンドユーティリティ
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

SOURCE_WEIGHT = {
    "mercari": 0.65,
    "mercari_psa": 0.0,
    "yuyutei": 0.35,
}


def parse_ts(raw: str) -> datetime:
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


def remove_outliers(prices: list[int]) -> list[int]:
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


def aggregate_daily(history: list) -> dict[str, dict[str, int]]:
    """
    日×ソースごとに価格の中央値を返す
    history: [{price, recorded_at, source}, ...] 新しい順
    """
    buckets: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))

    for row in history:
        src = row.get("source") or "unknown"
        if src == "mercari_psa":
            continue
        ts = parse_ts(row["recorded_at"])
        day = ts.date().isoformat()
        buckets[day][src].append(int(row["price"]))

    result: dict[str, dict[str, int]] = {}
    for day, sources in buckets.items():
        result[day] = {}
        for src, prices in sources.items():
            clean = remove_outliers(prices)
            s = sorted(clean)
            n = len(s)
            if n == 0:
                continue
            if n % 2 == 1:
                result[day][src] = s[n // 2]
            else:
                result[day][src] = (s[n // 2 - 1] + s[n // 2]) // 2
    return result


def _median(values: list[int]) -> Optional[int]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) // 2


def get_blended_daily(daily: dict[str, dict[str, int]]) -> list[tuple[str, int]]:
    """日次ブレンド価格（メルカリ優先）を古い順で返す"""
    days = sorted(daily.keys())
    blended = []
    for day in days:
        sources = daily[day]
        mercari = sources.get("mercari")
        yuyutei = sources.get("yuyutei")

        if mercari and yuyutei:
            price = round(mercari * 0.65 + yuyutei * 0.35)
        elif mercari:
            price = mercari
        elif yuyutei:
            price = yuyutei
        else:
            # その他ソース
            vals = list(sources.values())
            m = _median(vals)
            if m is None:
                continue
            price = m
        blended.append((day, price))
    return blended


def calc_momentum(blended: list[tuple[str, int]], days: int = 7) -> Optional[float]:
    """直近 vs N日前の変化率（%）"""
    if len(blended) < 2:
        return None
    latest_day, latest_price = blended[-1]
    if latest_price <= 0:
        return None

    target_idx = max(0, len(blended) - 1 - days)
    _, old_price = blended[target_idx]
    if old_price <= 0:
        return None
    return round((latest_price - old_price) / old_price * 100, 1)


def get_current_price(history: list) -> tuple[int, bool]:
    """
    現在価格とメルカリデータ有無を返す
    Returns: (price, has_mercari)
    """
    daily = aggregate_daily(history)
    blended = get_blended_daily(daily)
    if not blended:
        raw = [int(h["price"]) for h in history if h.get("source") != "mercari_psa"]
        clean = remove_outliers(raw)
        return (clean[0] if clean else history[0]["price"], False)

    _, price = blended[-1]
    has_mercari = any(
        "mercari" in daily.get(day, {})
        for day, _ in blended[-3:]  # 直近3日以内にメルカリデータ
    )
    return price, has_mercari


def calc_rise_score(
    change_1w: float,
    change_1m: float,
    confidence: str,
    momentum_7d: Optional[float],
    has_mercari: bool,
    mercari_surge: bool,
    mercari_change_7d: Optional[float],
    reprint_risk: str,
) -> float:
    """
    高騰信頼スコア（0〜100）
    ランキング並び替え用。低信頼・再販リスクは自動減点。
    """
    if change_1m <= 0 and change_1w <= 0:
        return 0.0

    score = 0.0
    score += min(max(change_1m, 0) * 1.8, 35)
    score += min(max(change_1w, 0) * 2.5, 30)

    if momentum_7d is not None and momentum_7d > 0:
        score += min(momentum_7d * 0.8, 20)

    if mercari_surge and mercari_change_7d:
        score += min(float(mercari_change_7d) * 0.4, 20)
    elif has_mercari:
        score += 8

    conf_mult = {"low": 0.35, "medium": 0.75, "high": 1.0}
    score *= conf_mult.get(confidence, 0.35)

    if reprint_risk == "high":
        score *= 0.25
    elif reprint_risk == "medium":
        score *= 0.55
    elif reprint_risk == "low":
        score *= 0.85

    return round(min(100.0, max(0.0, score)), 1)
