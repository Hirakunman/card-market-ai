import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像最適化: 遊々亭・YGOPRODeck・Scryfall の CDN を許可
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "card.yuyu-tei.jp" },
      { protocol: "https", hostname: "cdn.yuyu-tei.jp" },
      { protocol: "https", hostname: "images.ygoprodeck.com" },
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "**.scryfall.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 1日キャッシュ
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://card.yuyu-tei.jp https://cdn.yuyu-tei.jp https://images.ygoprodeck.com https://cards.scryfall.io https://*.scryfall.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // パフォーマンス: 不要ヘッダーを削除
  poweredByHeader: false,

  // 圧縮有効化
  compress: true,
};

export default nextConfig;
