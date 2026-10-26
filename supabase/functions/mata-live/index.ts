import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Realtime live mode on the Gemini Live API. The app connects to Google directly (lowest
 * latency for audio and video) with a short-lived token from here, so the API key never
 * leaves the server. The session setup, prompt included, also comes from here.
 *
 * Gemini Live answers the user's own questions about what it sees. It answers every turn,
 * so it can't be left to speak up on its own; spotting hazards stays with mata-assist's live
 * mode, and the app hands each alert to Gemini Live to say in its voice (`say` + the alert).
 *
 * Secret: GEMINI_API_KEY. Optional: MATA_LIVE_MODEL, MATA_LIVE_VOICE.
 */
const MODEL = Deno.env.get("MATA_LIVE_MODEL") ?? "gemini-3.8-live";
const VOICE = Deno.env.get("MATA_LIVE_VOICE") ?? "Kore";
const SOCKET =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Lang = "ar" | "en";

/** Put before an alert from the app, so it's read out as is. */
const SAY: Record<Lang, string> = {
  ar: "قل هذا بالضبط وبسرعة بدون أي إضافة: ",
  en: "Say exactly this, quickly, with nothing added: ",
};

const DIRECTIONS: Record<Lang, { clock: string; simple: string }> = {
  ar: {
    clock: "للاتجاهات استخدم نظام الساعة والخطوات: الساعة ١٢ قدامه، ٣ يمينه، ٩ يساره. مثل \"عمود على الساعة ١، خطوتين\".",
    simple: "استخدم اتجاهات واضحة: قدامك، يمينك، يسارك، وكم خطوة تقريبًا.",
  },
  en: {
    clock: "Give directions with clock positions and steps: 12 is straight ahead, 3 right, 9 left. For example \"pole at 1 o'clock, two steps\".",
    simple: "Use clear directions: ahead, left, right, and roughly how many steps.",
  },
};

const PROMPT: Record<Lang, (directions: string) => string> = {
  ar: (directions) => `أنت "مبيان"، عيون شخص كفيف وهو يمشي. تشوف فيديو من كاميرا نظارته وتسمعه من مايكها، وصوتك يطلع له في النظارة.
- رد دايمًا بالعربي بلهجة خليجية، حتى لو كلمك بلغة ثانية أو ما فهمت كلامه زين. لا تتكلم إنجليزي أبدًا.
- جمل قصيرة جدًا. السرعة أهم من التفصيل.
- إذا كلمك أو سألك، جاوبه على طول باختصار من اللي تشوفه. وإذا شفت خطر قريب (جدار، عمود، درج، حفرة، سيارة، باب زجاج) ابدأ فيه بكلمتين ثلاث، مثل "انتبه، جدار قدامك".
- إذا وصلك نص يبدأ بـ "${SAY.ar.trim()}" فهو تنبيه من التطبيق: قوله بالضبط وبسرعة، بدون أي كلمة زيادة.
- ${directions}
- لا تحاول تعرف هوية الأشخاص من وجوههم.
- إذا الصورة مظلمة أو مو واضحة، قول له مرة وحدة.`,
  en: (directions) => `You are "Mubayan", the eyes of a blind person while they walk. You see video from their glasses camera and hear them through its mic; your voice plays in the glasses.
- Always reply in English, even if they speak another language.
- Speak in very short sentences. Speed matters more than detail.
- If they talk to you or ask something, answer right away and briefly from what you see. If you see a nearby hazard (wall, pole, stairs, hole, car, glass door), start with it in two or three words, like "Careful, wall ahead".
- Text starting with "${SAY.en.trim()}" is an alert from the app: say it exactly and quickly, with no extra words.
- ${directions}
- Never try to identify people from their faces.
- If the image is dark or unclear, tell them once.`,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const lang: Lang = body?.lang === "en" ? "en" : "ar";
  const directions = DIRECTIONS[lang][body?.directions === "simple" ? "simple" : "clock"];

  const setup = {
    model: `models/${MODEL}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      mediaResolution: "MEDIA_RESOLUTION_LOW",
    },
    systemInstruction: { parts: [{ text: PROMPT[lang](directions) }] },
    realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 600 } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Without compression an audio+video session ends after 2 minutes.
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: {},
  };

  const now = Date.now();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
      // A constrained token's setup is the one that applies; what the client sends is ignored.
      bidiGenerateContentSetup: setup,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("auth_tokens", res.status, err.slice(0, 300));
    return json({ error: "token", status: res.status, detail: err.slice(0, 300) }, 502);
  }
  const token = (await res.json())?.name;
  if (!token) return json({ error: "token missing" }, 502);

  return json({
    url: `${SOCKET}?access_token=${encodeURIComponent(token)}`,
    say: SAY[lang],
    setup,
  });
});
