import { createBrowserClient } from "@supabase/ssr";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("أضف إعدادات Supabase في ملف البيئة المحلي.");
  return createBrowserClient(url, key);
}
