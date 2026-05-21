export type Game = "pokemon" | "onepiece" | "yugioh" | "mtg";

export type Card = {
  id: string;
  name: string;
  name_ja: string | null;
  game: Game;
  set_name: string;
  set_code: string | null;
  rarity: string | null;
  image_url: string | null;
  external_id: string | null;
  created_at: string;
};

export type Price = {
  id: string;
  card_id: string;
  source: string;
  price: number;
  condition: "NM" | "LP" | "MP" | "HP" | "DMG" | null;
  grade?: string | null;
  recorded_at: string;
};

export type CardInsight = {
  card_id: string;
  mercari_price: number | null;
  mercari_change_7d: number | null;
  mercari_surge: boolean;
  psa10_price: number | null;
  psa9_price: number | null;
  psa_premium_pct: number | null;
  reprint_risk: "none" | "low" | "medium" | "high";
  reprint_title: string | null;
  reprint_date: string | null;
  updated_at: string;
};

export type ReprintEvent = {
  id: string;
  game: Game;
  title: string;
  set_name: string | null;
  event_date: string;
  source_url: string;
  impact: "high" | "medium" | "low";
  created_at: string;
};

export type CardWithLatestPrice = Card & {
  latest_price: number | null;
  price_7d_ago: number | null;
  change_rate: number | null;
};

export type Prediction = {
  id: string;
  card_id: string;
  current_price: number;
  pred_1w: number;
  pred_1m: number;
  pred_1y: number;
  change_1w: number;
  change_1m: number;
  change_1y: number;
  confidence: "low" | "medium" | "high";
  data_days: number;
  updated_at: string;
};

export type RankingEntry = {
  card: Card;
  latest_price: number;
  price_7d_ago: number;
  change_rate: number;
  change_amount: number;
};
