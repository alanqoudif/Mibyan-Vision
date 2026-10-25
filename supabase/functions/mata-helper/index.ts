import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

/**
 * "Someone see with me". The blind user's app opens a session and gets an 8-digit code,
 * then uploads a glasses frame every couple of seconds. A helper enters the code in their
 * own copy of the app, sees the latest frame and sends short messages that are read aloud.
 *
 * User actions (need device_id): start, frame, end.
 * Helper actions (need only the code): join, view, say.
 */

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FRAME = 400_000; // base64 chars, ~300 KB JPEG

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function newCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000;
  return String(n).padStart(8, "0");
}

/** A live (not ended, not expired) session, optionally owned by `deviceId`. */
async function live(code: unknown, deviceId?: string) {
  if (typeof code !== "string" || !/^[0-9]{8}$/.test(code)) return null;
  let q = db
    .from("mata_helper_sessions")
    .select("code, device_id, frame, frame_at, joined_at")
    .eq("code", code)
    .eq("ended", false)
    .gt("expires_at", new Date().toISOString());
  if (deviceId) q = q.eq("device_id", deviceId);
  const { data } = await q.maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const deviceId = typeof body?.device_id === "string" ? body.device_id.slice(0, 64) : "";

  switch (action) {
    case "start": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      // End anything this device left open.
      await db.from("mata_helper_sessions").update({ ended: true }).eq("device_id", deviceId).eq("ended", false);
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const { error } = await db.from("mata_helper_sessions").insert({ code, device_id: deviceId });
        if (!error) return json({ code });
      }
      return json({ error: "could not create a code" }, 500);
    }

    case "frame": {
      const s = await live(body.code, deviceId);
      if (!s) return json({ error: "ended" }, 410);
      if (typeof body.image === "string" && body.image.length <= MAX_FRAME) {
        await db
          .from("mata_helper_sessions")
          .update({ frame: body.image, frame_at: new Date().toISOString() })
          .eq("code", s.code);
      }
      const after = Number(body.after) || 0;
      const { data } = await db
        .from("mata_helper_messages")
        .select("id, body")
        .eq("code", s.code)
        .gt("id", after)
        .order("id")
        .limit(20);
      return json({ joined: !!s.joined_at, messages: data ?? [] });
    }

    case "end": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      await db.from("mata_helper_sessions").update({ ended: true, frame: null }).eq("code", body.code).eq("device_id", deviceId);
      return json({ ok: true });
    }

    case "join": {
      const s = await live(body.code);
      if (!s) return json({ error: "not found" }, 404);
      if (!s.joined_at) {
        await db.from("mata_helper_sessions").update({ joined_at: new Date().toISOString() }).eq("code", s.code);
      }
      return json({ ok: true });
    }

    case "view": {
      const s = await live(body.code);
      if (!s) return json({ ended: true });
      return json({ ended: false, frame: s.frame, frame_at: s.frame_at });
    }

    case "say": {
      const s = await live(body.code);
      if (!s) return json({ error: "ended" }, 410);
      const text = typeof body.body === "string" ? body.body.trim().slice(0, 300) : "";
      if (!text) return json({ error: "empty" }, 400);
      await db.from("mata_helper_messages").insert({ code: s.code, body: text });
      return json({ ok: true });
    }
  }
  return json({ error: "unknown action" }, 400);
});
