"use client";

import { Info } from "lucide-react";

type Prediction = {
  current_price: number;
  pred_1w: number;
  pred_1m: number;
  pred_1y: number;
  change_1w: number;
  change_1m: number;
  change_1y: number;
  confidence: "low" | "medium" | "high";
  data_days: number;
};

type Props = {
  prediction: Prediction | null;
};

const CONFIDENCE_CONFIG = {
  low: {
    label: "参考値（データ蓄積中）",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.1)",
    border: "#2a2a2e",
    message: "価格データが少ないため精度は低めです。7日分以上蓄積されると精度が上がります。",
  },
  medium: {
    label: "中程度の精度",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.07)",
    border: "#2a200a",
    message: "7日分以上のデータをもとに算出しています。",
  },
  high: {
    label: "比較的安定",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.07)",
    border: "#0a2010",
    message: "30日分以上のデータをもとに算出しています。",
  },
};

function PredCard({
  label,
  price,
  change,
  isLowConfidence,
}: {
  label: string;
  price: number;
  change: number;
  isLowConfidence: boolean;
}) {
  const isUp = change > 0.5;
  const isDown = change < -0.5;
  const color = isUp ? "#22c55e" : isDown ? "#ef4444" : "#9ca3af";
  const arrow = isUp ? "▲" : isDown ? "▼" : "―";

  return (
    <div className="flex-1 min-w-[100px] rounded-lg border border-[#2a2a2e] bg-[#0d0d0f] p-4">
      <p className="text-xs text-[#9ca3af] font-medium mb-2">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums mb-1 ${
          isLowConfidence ? "text-[#6b7280]" : ""
        }`}
      >
        ¥{price.toLocaleString()}
      </p>
      <p className="text-sm tabular-nums" style={{ color }}>
        {arrow} {Math.abs(change).toFixed(1)}%
      </p>
    </div>
  );
}

export function PricePrediction({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          価格推移の参考予測
          <Info className="w-3.5 h-3.5 text-[#9ca3af]" />
        </h2>
        <p className="text-sm text-[#9ca3af]">
          価格データが蓄積されると統計的な参考予測が生成されます。
        </p>
      </div>
    );
  }

  const conf = CONFIDENCE_CONFIG[prediction.confidence];
  const isLow = prediction.confidence === "low";

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{ borderColor: conf.border, backgroundColor: conf.bg }}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            価格推移の参考予測
            <Info className="w-3.5 h-3.5 text-[#9ca3af]" />
          </h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            過去の価格推移をもとにアルゴリズムが算出した統計的参考値
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span className="text-[#9ca3af]">{prediction.data_days}日分のデータ</span>
          <span
            className="px-2 py-0.5 rounded font-medium border"
            style={{
              color: conf.color,
              borderColor: conf.border,
              backgroundColor: "transparent",
            }}
          >
            {conf.label}
          </span>
        </div>
      </div>

      {/* 予測カード */}
      <div className="flex gap-3 flex-wrap">
        <PredCard label="1週間後" price={prediction.pred_1w} change={prediction.change_1w} isLowConfidence={isLow} />
        <PredCard label="1ヶ月後" price={prediction.pred_1m} change={prediction.change_1m} isLowConfidence={isLow} />
        <PredCard label="1年後" price={prediction.pred_1y} change={prediction.change_1y} isLowConfidence={isLow} />
      </div>

      {/* 注意事項（信頼度メッセージ） */}
      <div className="text-xs space-y-1.5 text-[#9ca3af] border-t border-[#2a2a2e] pt-3">
        <p style={{ color: conf.color }}>{conf.message}</p>
        <p>
          ⚠️ この予測は売買推奨ではありません。実際の価格は大会環境・再録・需給変動など
          予測不能な要因で大きく変動します。投資・売買の判断は必ず自己責任で行ってください。
        </p>
      </div>
    </div>
  );
}
