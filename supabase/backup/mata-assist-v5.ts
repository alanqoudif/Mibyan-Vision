// mata-assist as deployed before the accessibility features (Supabase version 5), kept for rollback.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const MODELS: Record<string, string> = {
  smart: "google/gemini-3.8-flash",
  fast: "google/gemini-3.5-flash-lite",
};

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Key lives in Supabase Vault (secret "mata_openrouter_key"); an env secret overrides it.
let cachedKey: string | null = Deno.env.get("MATA_OPENROUTER_KEY") ?? null;
async function openrouterKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const { data, error } = await db.rpc("mata_openrouter_key");
  if (error) console.error("vault read failed", error.message);
  cachedKey = (data as string | null) ?? null;
  return cachedKey;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SILENT = "<silent>";

type Lang = "ar" | "en";

const BASE: Record<Lang, string> = {
  ar: `أنت "مبيان"، عيون ذكية لشخص كفيف أو ضعيف بصر، تشوف من كاميرا نظارته أو جواله.
- تكلم بلهجة خليجية بسيطة وودودة، وجمل قصيرة لأن ردك ينقرا بصوت عالي.
- لا تستخدم ماركداون ولا رموز ولا قوائم مرقمة ولا إيموجي.
- ابدأ دايمًا بأهم شي، وإذا فيه خطر (سيارة، درج، حفرة، عائق، شي حار) قوله أول كلمة.
- استخدم اتجاهات واضحة: قدامك، يمينك، يسارك، على بعد كم خطوة، أو اتجاه الساعة.
- لا تحاول تعرف هوية الأشخاص من وجوههم؛ وصف شكلهم وتصرفهم بس.
- إذا الصورة مو واضحة أو مظلمة، قول له يحرك راسه أو يقرّب، ولا تألف.
- إذا وصلك صوت، اكتب أول سطر بالضبط بهالشكل: § ثم نص سؤاله كما سمعته، وبعدين سطر جديد وجوابك.`,
  en: `You are "Mubayan", smart eyes for a blind or low-vision person, seeing through the camera on their glasses or phone.
- Speak in plain, warm, everyday English with short sentences, because your reply is read aloud.
- No markdown, symbols, numbered lists or emoji.
- Always lead with the most important thing. If there is any hazard (car, stairs, hole, obstacle, something hot), say it first.
- Use clear directions: in front of you, on your left, on your right, how many steps away, or clock positions.
- Never try to identify people from their faces; only describe how they look and what they are doing.
- If the image is blurry or dark, ask them to move their head or get closer. Never make things up.
- If you receive audio, write the first line exactly as: § followed by their question as you heard it, then a new line, then your answer.`,
};

const MODE_PROMPTS: Record<Lang, Record<string, string>> = {
  ar: {
    describe: "وصف المكان اللي قدامه: وين هو، أهم الأشياء ومواقعها، وأي عوائق.",
    read: "اقرأ النص اللي في الصورة حرفيًا وبالترتيب الطبيعي للقراءة. إذا طويل، قول نوعه وعنوانه وأول فقرة واسأله يكمل.",
    find: "ساعده يلقى الشي اللي يدوره. إذا ما قال وش يدور، اذكر الأغراض الصغيرة الظاهرة ومواقعها بدقة.",
    money: "تعرّف على العملات الورقية أو المعدنية الظاهرة: العملة، الفئة، والعدد، والمجموع.",
    people: "كم شخص قدامه، وين مكانهم، وش يسوون، وتعابيرهم. بدون تحديد هوية.",
    ask: "جاوب سؤاله بالاعتماد على الصورة إذا لها علاقة.",
    live: `أنت في الوضع المباشر: توصلك صورة جديدة كل كم ثانية وهو يمشي أو يتحرك.
القواعد:
- إذا اللي تشوفه هو نفس اللي قلته قبل أو قريب منه، أو ما فيه شي مهم، رد بـ ${SILENT} فقط وبدون أي كلمة ثانية. هذا هو الرد المتوقع أغلب الوقت.
- إذا فيه خطر قريب (سيارة، درج، حفرة، عائق قدامه، باب زجاج، شي بيصدمه) ابدأ ردك بـ ! وبعدين جملة قصيرة جدًا.
- غير كذا، قول جملة وحدة كاملة وقصيرة (أقل من ١٥ كلمة) بس إذا تغيّر شي مفيد: دخل مكان جديد، شخص يقرب، لوحة أو كتابة واضحة، إشارة مشاة.`,
  },
  en: {
    describe: "Describe the scene in front of them: where they are, the main objects and where they are, and any obstacles.",
    read: "Read the text in the image word for word, in natural reading order. If it is long, say what it is, its title and the first paragraph, then ask if they want more.",
    find: "Help them find what they are looking for. If they did not say, list the small objects you can see and exactly where they are.",
    money: "Identify the banknotes or coins: currency, denomination, count and total.",
    people: "How many people are in front of them, where they are, what they are doing and their expressions. Never identify anyone.",
    ask: "Answer their question, using the image when it is relevant.",
    live: `You are in live mode: you receive a new frame every few seconds while they walk or move around.
Rules:
- If what you see is the same as, or close to, what you already told them, or nothing matters, reply with ${SILENT} only and nothing else. This is the expected reply most of the time.
- If there is a nearby hazard (car, stairs, hole, obstacle ahead, glass door, something they may bump into), start with ! followed by one very short sentence.
- Otherwise say one complete short sentence (under 15 words) only when something useful changed: they entered a new place, someone is approaching, a clear sign or text, a pedestrian signal.`,
  },
};

const LIVE_CONTEXT: Record<Lang, (said: string[]) => string> = {
  ar: (said) => said.length ? `\n\nاللي قلته له قبل (لا تكرره):\n${said.map((s) => `- ${s}`).join("\n")}` : "\n\nهذي أول صورة، قول جملة وحدة عن وين هو.",
  en: (said) => said.length ? `\n\nWhat you already told them (do not repeat it):\n${said.map((s) => `- ${s}`).join("\n")}` : "\n\nThis is the first frame; say one sentence about where they are.",
};

const LIVE_FRAME: Record<Lang, string> = {
  ar: `صورة جديدة من الكاميرا. فيه شي جديد مهم؟ إذا لا، رد بـ ${SILENT}`,
  en: `New camera frame. Anything new and important? If not, reply ${SILENT}`,
};

const DETAIL: Record<Lang, [string, string]> = {
  ar: ["عط تفاصيل مفيدة بس بدون حشو.", "خلك مختصر جدًا: جملتين بالكثير."],
  en: ["Give useful detail, but no filler.", "Keep it very short: two sentences at most."],
};

const FALLBACK_Q: Record<Lang, string> = { ar: "وصف لي اللي قدامي.", en: "Describe what is in front of me." };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);

  if (req.method === "GET") {
    const deviceId = url.searchParams.get("device_id") ?? "";
    if (deviceId.length < 8) return json({ error: "device_id required" }, 400);
    const { data, error } = await db
      .from("mata_sessions")
      .select("id, mode, question, answer, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return json({ error: error.message }, 500);
    return json({ items: data });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const key = await openrouterKey();
  if (!key) return json({ error: "OpenRouter key is not configured" }, 500);

  const body = await req.json().catch(() => null);
  if (!body?.device_id) return json({ error: "device_id required" }, 400);

  const lang: Lang = body.lang === "en" ? "en" : "ar";
  const mode: string = MODE_PROMPTS[lang][body.mode] ? body.mode : "ask";
  const live = mode === "live";
  const model = MODELS[body.model] ?? MODELS.smart;
  const detail = DETAIL[lang][body.detail === false ? 1 : 0];

  const history = Array.isArray(body.history)
    ? body.history.slice(-8).filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    : [];

  const content: unknown[] = [];
  if (live) content.push({ type: "text", text: LIVE_FRAME[lang] });
  if (body.text) content.push({ type: "text", text: String(body.text).slice(0, 2000) });
  if (body.audio) content.push({ type: "input_audio", input_audio: { data: body.audio, format: body.audio_format ?? "m4a" } });
  if (body.image) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.image}` } });
  if (!content.length) content.push({ type: "text", text: FALLBACK_Q[lang] });

  // Live mode: past narrations go into the system prompt as "already said", which the model respects far better than chat turns.
  const system = live
    ? `${BASE[lang]}\n\n${MODE_PROMPTS[lang].live}${LIVE_CONTEXT[lang](history.map((m: any) => m.content).slice(-6))}`
    : `${BASE[lang]}\n\n${MODE_PROMPTS[lang][mode]}\n${detail}`;
  const messages = live
    ? [{ role: "system", content: system }, { role: "user", content }]
    : [{ role: "system", content: system }, ...history, { role: "user", content }];

  const started = Date.now();
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Mubayan Vision",
    },
    body: JSON.stringify({
      model,
      stream: true,
      reasoning: { effort: "minimal" },
      max_tokens: live ? 400 : 900,
      temperature: live ? 0.2 : 0.6,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return json({ error: "upstream", status: upstream.status, detail: err.slice(0, 500) }, 502);
  }

  // Pass the SSE stream straight through while collecting the text to store.
  let full = "";
  let buf = "";
  const decoder = new TextDecoder();
  const tap = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        try {
          full += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? "";
        } catch { /* keep-alive / partial */ }
      }
    },
    flush() {
      let question: string | null = body.text ? String(body.text) : null;
      let answer = full.trim();
      // Live frames with nothing new aren't worth keeping.
      if (!answer || answer.includes(SILENT)) return;
      const m = answer.match(/^§\s*(.*)\n?/);
      if (m) {
        question = m[1].trim();
        answer = answer.slice(m[0].length).trim();
      }
      if (live) answer = answer.replace(/^!\s*/, "");
      const save = db.from("mata_sessions").insert({
        device_id: String(body.device_id).slice(0, 64),
        mode,
        question,
        answer,
        model,
        latency_ms: Date.now() - started,
      });
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(save.then(({ error }) => error && console.error("save failed", error.message)));
    },
  });

  return new Response(upstream.body.pipeThrough(tap), {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
