import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "sign in required" }, 401);
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return reply({ error: "invalid session" }, 401);

  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
  if (deviceId.length < 8 || deviceId.length > 64) return reply({ error: "invalid device_id" }, 400);

  const { data: existing, error: lookupError } = await db.from("mata_device_links").select("user_id").eq("device_id", deviceId).maybeSingle();
  if (lookupError) return reply({ error: "device link unavailable" }, 503);
  if (existing && existing.user_id !== user.id) return reply({ error: "device is linked to another account" }, 409);
  if (!existing) {
    const { error: insertError } = await db.from("mata_device_links").insert({ device_id: deviceId, user_id: user.id });
    if (insertError && insertError.code !== "23505") return reply({ error: "could not link device" }, 503);
    if (insertError) {
      const { data: raced } = await db.from("mata_device_links").select("user_id").eq("device_id", deviceId).maybeSingle();
      if (!raced || raced.user_id !== user.id) return reply({ error: "device is linked to another account" }, 409);
    }
  }

  const { error: historyError } = await db.from("mata_sessions").update({ user_id: user.id }).eq("device_id", deviceId).is("user_id", null);
  if (historyError) return reply({ error: "device linked, but history could not be attached" }, 503);
  return reply({ linked: true });
});
