# CardMarket AI — トレーディングカード市場分析サイト

ポケモン・ワンピース・遊戯王・MTGの価格を毎日自動収集し、高騰・暴落をリアルタイム表示するサービスです。

## 起動方法

```bash
npm run dev
```

http://localhost:3000 で確認できます。

---

## セットアップ手順（初回のみ）

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でアカウント作成（無料）
2. 新しいプロジェクトを作成
3. `Settings > API` からURL・Anon Key・Service Role Keyをコピー

### 2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて、Supabaseの値を貼り付けます。

### 3. データベーステーブル作成

Supabaseの `SQL Editor` を開き、`supabase/schema.sql` の内容を貼り付けて実行します。

### 4. カードマスターデータ取得（初回）

```bash
cd scrapers
pip install -r requirements.txt
cp .env.example .env
# .env にSupabaseの値を設定

python run_all.py --mode cards
```

※ 完了まで数分かかります。

### 5. GitHub Actionsの設定（自動化）

GitHubリポジトリの `Settings > Secrets and variables > Actions` に以下を登録：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

登録後は価格収集が毎朝6時・毎夜18時に自動実行されます。

---

## 技術スタック

| 用途 | 技術 |
|------|------|
| フロントエンド | Next.js 14 (App Router) |
| スタイリング | Tailwind CSS + shadcn/ui |
| グラフ | Recharts |
| データベース | Supabase (PostgreSQL) |
| スクレイパー | Python + requests + BeautifulSoup |
| 自動実行 | GitHub Actions (cron) |
| デプロイ | Vercel |

## デプロイ（Vercel）

1. GitHubにリポジトリをプッシュ
2. [vercel.com](https://vercel.com) でインポート
3. 環境変数を設定してデプロイ

---

## 免責事項

本サービスの価格情報は参考目的のみです。投資・売買の判断は自己責任でお願いします。
本サービスは各ゲームメーカーとは無関係のファンサービスです。
