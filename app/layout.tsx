import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CardMarket AI | トレーディングカード価格分析",
  description:
    "ポケモン・ワンピース・遊戯王・MTGの価格推移をリアルタイムで分析。高騰・暴落を自動検知。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-[#0d0d0f] text-[#f0f0f0] antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="border-t border-[#2a2a2e] mt-16 py-8 text-center text-sm text-[#9ca3af]">
          <p>CardMarket AI — 価格情報は参考目的のみです。投資判断は自己責任でお願いします。</p>
        </footer>
      </body>
    </html>
  );
}
