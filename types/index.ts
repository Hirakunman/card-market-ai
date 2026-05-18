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
  recorded_at: string;
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
