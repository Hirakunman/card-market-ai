/**
 * 高騰信頼スコア（0〜100）— Python版と同じロジック
 * DB列追加不要。サーバー側で計算してランキングに使う。
 */

type Insight = {
  mercari_surge?: boolean;
  mercari_change_7d?: number | null;
  reprint_risk?: string;
} | null;

type Pred = {
  change_1w: number;
  change_1m: number;
  confidence: string;
  mercari_confirmed?: boolean;
};

export function calcRiseScore(pred: Pred, insight: Insight): number {
  const { change_1w, change_1m, confidence } = pred;
  if (change_1m <= 0 && change_1w <= 0) return 0;

  let score = 0;
  score += Math.min(Math.max(change_1m, 0) * 1.8, 35);
  score += Math.min(Math.max(change_1w, 0) * 2.5, 30);

  if (insight?.mercari_surge && insight.mercari_change_7d != null && insight.mercari_change_7d > 0) {
    score += Math.min(insight.mercari_change_7d * 0.4, 20);
  } else if (pred.mercari_confirmed || insight?.mercari_change_7d != null) {
    score += 8;
  }

  const confMult: Record<string, number> = { low: 0.35, medium: 0.75, high: 1.0 };
  score *= confMult[confidence] ?? 0.35;

  const risk = insight?.reprint_risk ?? "none";
  if (risk === "high") score *= 0.25;
  else if (risk === "medium") score *= 0.55;
  else if (risk === "low") score *= 0.85;

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}
