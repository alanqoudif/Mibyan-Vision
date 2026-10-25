import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

/**
 * "Someone see with me". The blind user's app opens a session and gets an 8-digit code,
 * then uploads a glasses frame every couple of seconds. A helper enters the code in their
 * own copy of the app, sees the latest frame and sends short messages that are read aloud.
 *
 * User actions (need device_id): start, frame, end.
 * Helper actions (need only the code): join, view, say.
 *
 * Trusted helpers, so the blind user never has to read a code out:
 * - invite (user) → a 6-digit code, entered once by the helper with accept (helper device_id).
 * - start with `notify` ("all" or a contact id) pushes a notification to those helpers that
 *   opens the view directly.
 * - contacts / remove (user), helping / leave / token (helper).
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

function newCode(digits = 8) {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** digits;
  return String(n).padStart(digits, "0");
}

function name(v: unknown) {
  return typeof v === "string" ? v.trim().slice(0, 60) : "";
}

const PUSH: Record<"ar" | "en", (who: string) => { title: string; body: string }> = {
  ar: (who) => ({ title: `${who} يبيك تشوف معه`, body: "اضغط عشان تشوف من نظارته وتوجهه." }),
  en: (who) => ({ title: `${who} needs you to see with them`, body: "Tap to see through their glasses and guide them." }),
};

/** Notifies the user's trusted helpers (all, or one id). Returns the names that were reached. */
async function notifyHelpers(deviceId: string, notify: unknown, code: string): Promise<string[]> {
  let q = db
    .from("mata_helper_contacts")
    .select("helper_name, owner_name, push_token, lang")
    .eq("owner_device", deviceId)
    .not("push_token", "is", null);
  if (notify !== "all") {
    const id = Number(notify);
    if (!Number.isInteger(id)) return [];
    q = q.eq("id", id);
  }
  const { data } = await q;
  if (!data?.length) return [];
  const messages = data.map((c) => ({
    to: c.push_token,
    ...PUSH[c.lang === "en" ? "en" : "ar"](c.owner_name),
    sound: "default",
    priority: "high",
    interruptionLevel: "time-sensitive",
    data: { url: `/help-view?code=${code}` },
  }));
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  }).catch((e) => {
    console.error("push failed", e);
    return null;
  });
  if (!res?.ok) return [];
  const tickets = ((await res.json().catch(() => ({}))) as { data?: { status?: string }[] }).data ?? [];
  return data.filter((_, i) => tickets[i]?.status === "ok").map((c) => c.helper_name);
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
        if (!error) return json({ code, notified: body.notify ? await notifyHelpers(deviceId, body.notify, code) : [] });
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

    // ---------- trusted helpers ----------

    case "invite": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      await db.from("mata_helper_invites").delete().eq("device_id", deviceId);
      for (let i = 0; i < 5; i++) {
        const code = newCode(6);
        const { error } = await db.from("mata_helper_invites").insert({ code, device_id: deviceId });
        if (!error) return json({ code });
      }
      return json({ error: "could not create a code" }, 500);
    }

    case "accept": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      const helperName = name(body.helper_name);
      const ownerName = name(body.owner_name);
      if (!helperName || !ownerName) return json({ error: "names required" }, 400);
      const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
      const { data: invite } = await db
        .from("mata_helper_invites")
        .select("device_id")
        .eq("code", code)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!invite) return json({ error: "not found" }, 404);
      if (invite.device_id === deviceId) return json({ error: "own invite" }, 400);
      const { error } = await db.from("mata_helper_contacts").upsert(
        {
          owner_device: invite.device_id,
          helper_device: deviceId,
          helper_name: helperName,
          owner_name: ownerName,
          push_token: typeof body.push_token === "string" ? body.push_token.slice(0, 200) : null,
          lang: body.lang === "en" ? "en" : "ar",
        },
        { onConflict: "owner_device,helper_device" },
      );
      if (error) return json({ error: error.message }, 500);
      await db.from("mata_helper_invites").delete().eq("code", code);
      return json({ ok: true });
    }

    case "contacts": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      const { data } = await db
        .from("mata_helper_contacts")
        .select("id, helper_name, push_token")
        .eq("owner_device", deviceId)
        .order("created_at");
      return json({ contacts: (data ?? []).map((c) => ({ id: c.id, name: c.helper_name, reachable: !!c.push_token })) });
    }

    case "remove": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      await db.from("mata_helper_contacts").delete().eq("owner_device", deviceId).eq("id", Number(body.id));
      return json({ ok: true });
    }

    case "helping": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      const { data } = await db
        .from("mata_helper_contacts")
        .select("id, owner_name")
        .eq("helper_device", deviceId)
        .order("created_at");
      return json({ people: (data ?? []).map((c) => ({ id: c.id, name: c.owner_name })) });
    }

    case "leave": {
      if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
      await db.from("mata_helper_contacts").delete().eq("helper_device", deviceId).eq("id", Number(body.id));
      return json({ ok: true });
    }

    case "token": {
      if (deviceId.length < 8 || typeof body.push_token !== "string") return json({ error: "bad request" }, 400);
      await db.from("mata_helper_contacts").update({ push_token: body.push_token.slice(0, 200) }).eq("helper_device", deviceId);
      return json({ ok: true });
    }
  }
  return json({ error: "unknown action" }, 400);
});
