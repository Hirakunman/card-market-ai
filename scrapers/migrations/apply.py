"""
起動時マイグレーション — GitHub Actions から自動実行

SUPABASE_DB_URL が設定されていれば SQL を自動適用。
未設定でも予測保存はフォールバックで動作する。
"""

import os

MIGRATIONS = [
    "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS rise_score numeric(6,1) DEFAULT 0;",
    "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS mercari_confirmed boolean DEFAULT false;",
    "CREATE INDEX IF NOT EXISTS predictions_rise_score_idx ON predictions(rise_score DESC);",
    "ALTER TABLE prices ADD COLUMN IF NOT EXISTS grade text;",
]


def apply_migrations() -> None:
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("  migrations: SKIP (SUPABASE_DB_URL 未設定 — ランキングはサーバー計算で表示)")
        return

    try:
        import psycopg2
    except ImportError:
        print("  migrations: SKIP (psycopg2 未インストール)")
        return

    print("=== DBマイグレーション開始 ===")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        for sql in MIGRATIONS:
            cur.execute(sql)
        cur.close()
        conn.close()
        print("  migrations: 完了")
    except Exception as e:
        print(f"  migrations: WARN {e}")
