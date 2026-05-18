import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClientOrNull(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

// ダミーのクエリビルダー（環境変数なし時に空データを返す）
function createNullQuery() {
  const noop: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_, prop) => {
      if (prop === "then") return undefined; // Promise化させない
      if (prop === "execute" || prop === "single") {
        return () => Promise.resolve({ data: null, error: null });
      }
      // limit, select, eq などチェーンメソッドは自分自身を返す
      return () => new Proxy(noop, handler);
    },
  };
  return new Proxy(noop, handler);
}

export const supabase = {
  from: (table: string) => {
    const client = getClientOrNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!client) return createNullQuery() as any;
    return client.from(table);
  },
};

export const createServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
