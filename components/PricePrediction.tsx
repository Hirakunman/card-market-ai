"use client";

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

const CONFIDENCE_LABEL = {
  low: { text: "低 (データ蓄積中)", color: "#9ca3af", bg: "#1e1e22" },
  medium: { text: "中", color: "#f59e0b", bg: "#2a2208" },
  high: { text: "高", color: "#22c55e", bg: "#052e16" },
};

function PredCard({
  label,
  price,
  change,
}: {
  label: string;
  price: number;
  change: number;
}) {
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp ? "#22c55e" : isDown ? "#ef4444" : "#9ca3af";
  const arrow = isUp ? "▲" : isDown ? "▼" : "―";

  return (
    <div className="flex-1 min-w-[100px] rounded-lg border border-[#2a2a2e] bg-[#0d0d0f] p-4 space-y-2">
      <p className="text-xs text-[#9ca3af] font-medium">{label}</p>
      <p className="text-xl font-bold tabular-nums">
        ¥{price.toLocaleString()}
      </p>
      <p className="text-sm font-semibold tabular-nums" style={{ color }}>
        {arrow} {Math.abs(change).toFixed(1)}%
      </p>
    </div>
  );
}

export function PricePrediction({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4">
        <h2 className="font-semibold mb-3">価格予測</h2>
        <p className="text-sm text-[#9ca3af]">
          価格データが貯まると自動で予測が生成されます。毎日スクレイピングが動いており、数日後から表示されます。
        </p>
      </div>
    );
  }

  const conf = CONFIDENCE_LABEL[prediction.confidence];

  return (
    <div className="rounded-lg border border-[#2a2a2e] bg-[#141416] p-4 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">価格予測</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#9ca3af]">
            データ期間: {prediction.data_days}日
          </span>
          <span
            className="px-2 py-0.5 rounded font-medium"
            style={{ color: conf.color, backgroundColor: conf.bg }}
          >
            信頼度: {conf.text}
          </span>
        </div>
      </div>

      {/* 予測カード */}
      <div className="flex gap-3 flex-wrap">
        <PredCard
          label="1週間後"
          price={prediction.pred_1w}
          change={prediction.change_1w}
        />
        <PredCard
          label="1ヶ月後"
          price={prediction.pred_1m}
          change={prediction.change_1m}
        />
        <PredCard
          label="1年後"
          price={prediction.pred_1y}
          change={prediction.change_1y}
        />
      </div>

      {/* 注意書き */}
      <div className="text-xs text-[#9ca3af] space-y-1">
        {prediction.confidence === "low" && (
          <p className="text-amber-500">
            ⚠ データ蓄積中のため予測精度は低めです。7日分以上貯まると精度が上がります。
          </p>
        )}
        <p>
          ※ 予測はアルゴリズムによる参考値です。投資・売買判断は自己責任でお願いします。
        </p>
      </div>
    </div>
  );
}
