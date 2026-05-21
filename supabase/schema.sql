-- ============================================================
-- トレーディングカード市場分析サイト Supabase スキーマ
-- Supabase SQL Editorに貼り付けて実行する
-- ============================================================

-- カードマスターデータ
create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ja     text,
  game        text not null check (game in ('pokemon', 'onepiece', 'yugioh', 'mtg')),
  set_name    text not null default '',
  set_code    text,
  rarity      text,
  image_url   text,
  external_id text,
  created_at  timestamptz not null default now(),
  unique (game, external_id)
);

-- 全文検索インデックス
create index if not exists cards_name_search on cards using gin(to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(name_ja, '')));
create index if not exists cards_game_idx on cards(game);

-- 価格履歴
create table if not exists prices (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references cards(id) on delete cascade,
  source      text not null,
  price       integer not null,
  condition   text check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  recorded_at timestamptz not null default now()
);

create index if not exists prices_card_recorded on prices(card_id, recorded_at desc);
create index if not exists prices_recorded_at on prices(recorded_at desc);

-- ランキングビュー（7日間の変動率）
create or replace view ranking_rise as
with latest as (
  select distinct on (card_id) card_id, price, recorded_at
  from prices
  where condition = 'NM' or condition is null
  order by card_id, recorded_at desc
),
week_ago as (
  select distinct on (card_id) card_id, price, recorded_at
  from prices
  where recorded_at <= now() - interval '7 days'
    and (condition = 'NM' or condition is null)
  order by card_id, recorded_at desc
)
select
  c.*,
  l.price as latest_price,
  w.price as price_7d_ago,
  round(((l.price - w.price)::numeric / w.price) * 100, 1) as change_rate,
  (l.price - w.price) as change_amount
from latest l
join week_ago w on l.card_id = w.card_id
join cards c on c.id = l.card_id
where l.price > w.price
order by change_rate desc;

create or replace view ranking_fall as
with latest as (
  select distinct on (card_id) card_id, price, recorded_at
  from prices
  where condition = 'NM' or condition is null
  order by card_id, recorded_at desc
),
week_ago as (
  select distinct on (card_id) card_id, price, recorded_at
  from prices
  where recorded_at <= now() - interval '7 days'
    and (condition = 'NM' or condition is null)
  order by card_id, recorded_at desc
)
select
  c.*,
  l.price as latest_price,
  w.price as price_7d_ago,
  round(((l.price - w.price)::numeric / w.price) * 100, 1) as change_rate,
  (l.price - w.price) as change_amount
from latest l
join week_ago w on l.card_id = w.card_id
join cards c on c.id = l.card_id
where l.price < w.price
order by change_rate asc;

-- 価格予測テーブル
create table if not exists predictions (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid not null references cards(id) on delete cascade,
  current_price integer not null,
  pred_1w      integer,
  pred_1m      integer,
  pred_1y      integer,
  change_1w    numeric(6,1),
  change_1m    numeric(6,1),
  change_1y    numeric(6,1),
  confidence   text check (confidence in ('low', 'medium', 'high')) default 'low',
  data_days    integer default 0,
  rise_score   numeric(6,1) default 0,
  mercari_confirmed boolean default false,
  updated_at   timestamptz not null default now(),
  unique (card_id)
);

create index if not exists predictions_card_id on predictions(card_id);
create index if not exists predictions_updated on predictions(updated_at desc);
create index if not exists predictions_rise_score on predictions(rise_score desc);

-- 既存DBへのカラム追加（安全に再実行可）
alter table predictions add column if not exists rise_score numeric(6,1) default 0;
alter table predictions add column if not exists mercari_confirmed boolean default false;
create index if not exists predictions_rise_score_idx on predictions(rise_score desc);

-- Row Level Security（公開データは全員読み取り可）
alter table cards enable row level security;
alter table prices enable row level security;
alter table predictions enable row level security;

-- PSAグレード対応（PSA10/PSA9 等）
alter table prices add column if not exists grade text;

-- 再販・追加生産カレンダー
create table if not exists reprint_events (
  id          uuid primary key default gen_random_uuid(),
  game        text not null check (game in ('pokemon', 'onepiece', 'yugioh', 'mtg')),
  title       text not null,
  set_name    text,
  event_date  date not null,
  source_url  text not null,
  impact      text check (impact in ('high', 'medium', 'low')) default 'medium',
  created_at  timestamptz not null default now(),
  unique (source_url)
);

create index if not exists reprint_events_game_date on reprint_events(game, event_date desc);

-- カード別市場インサイト（メルカリ急騰・PSA・再販リスク）
create table if not exists card_insights (
  card_id           uuid primary key references cards(id) on delete cascade,
  mercari_price     integer,
  mercari_change_7d numeric(6,1),
  mercari_surge     boolean default false,
  psa10_price       integer,
  psa9_price        integer,
  psa_premium_pct   numeric(6,1),
  reprint_risk      text check (reprint_risk in ('none', 'low', 'medium', 'high')) default 'none',
  reprint_title     text,
  reprint_date      date,
  updated_at        timestamptz not null default now()
);

create index if not exists card_insights_surge on card_insights(mercari_surge) where mercari_surge = true;
create index if not exists card_insights_reprint on card_insights(reprint_risk);

alter table reprint_events enable row level security;
alter table card_insights enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'cards' and policyname = 'cards are public') then
    create policy "cards are public" on cards for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'prices' and policyname = 'prices are public') then
    create policy "prices are public" on prices for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'predictions' and policyname = 'predictions are public') then
    create policy "predictions are public" on predictions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reprint_events' and policyname = 'reprint_events are public') then
    create policy "reprint_events are public" on reprint_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'card_insights' and policyname = 'card_insights are public') then
    create policy "card_insights are public" on card_insights for select using (true);
  end if;
end $$;
