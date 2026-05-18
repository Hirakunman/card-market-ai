"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Price } from "@/types";

type Props = {
  prices: Price[];
};

type ChartData = {
  date: string;
  price: number;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function aggregateByDay(prices: Price[]): ChartData[] {
  const map = new Map<string, number[]>();
  for (const p of prices) {
    const day = p.recorded_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(p.price);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: formatDate(date),
      price: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));
}

export function PriceChart({ prices }: Props) {
  const data = aggregateByDay(prices);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#9ca3af] text-sm">
        価格データがありません
      </div>
    );
  }

  const minPrice = Math.min(...data.map((d) => d.price));
  const maxPrice = Math.max(...data.map((d) => d.price));
  const domain: [number, number] = [
    Math.floor(minPrice * 0.9),
    Math.ceil(maxPrice * 1.1),
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#2a2a2e" }}
          tickLine={false}
        />
        <YAxis
          domain={domain}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `¥${v.toLocaleString()}`}
          width={72}
        />
        <Tooltip
          contentStyle={{
            background: "#141416",
            border: "1px solid #2a2a2e",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`¥${Number(value).toLocaleString()}`, "価格"]}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#3b82f6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
