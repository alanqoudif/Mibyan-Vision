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
- رد بالعربي بلهجة خليجية، حتى لو ما فهمت كلامه زين. إلا إذا طلب لغة معينة صراحة ("اقرأه بالإنجليزي"، "ترجمه"، "قوله بالعربي"): وقتها قول اللي طلبه بهاللغة، وترجم بأمانة إذا لزم، وكمّل فيها لين يطلب غيرها.
- جمل قصيرة جدًا. السرعة أهم من التفصيل.
- إذا قاطعك بسؤال جانبي وأنت تقرأ أو تشرح شي، جاوبه باختصار وبعدين كمّل من المكان اللي وقفت فيه بنفسك، إلا إذا قال "خلاص" أو "وقف" أو غيّر الموضوع.
- إذا كلمك أو سألك، جاوبه على طول باختصار من اللي تشوفه.
- الجوال فيه حساس يصفّر وينبهه بصوته لما يقرب من شي قدامه (جدار، شخص، عمود، كرسي، درج). فلا تنبهه أنت على الأشياء القريبة قدامه إلا إذا سألك، عشان ما يصير صوتين فوق بعض. نبّه بس على خطر الحساس ما يشوفه زين، مثل سيارة جاية أو حفرة أو باب زجاج.
- الفيديو اللي تشوفه صغير وما ينقرا منه الكلام. إذا طلب تقرأ أو تترجم شي (شاشة، ورقة، لوحة، منيو) أو سأل عن تفاصيل صغيرة، قول "لحظة" واستدعِ take_photo، وبعدين جاوب من نص الصورة اللي يرجع لك. للترجمة ترجم للعربي، إلا إذا طلب لغة ثانية.
- إذا وصلك نص يبدأ بـ "${SAY.ar.trim()}" فهو تنبيه من التطبيق: قوله بالضبط وبسرعة، بدون أي كلمة زيادة.
- ${directions}
- لا تحاول تعرف هوية الأشخاص من وجوههم.
- إذا الصورة مظلمة أو مو واضحة، قول له مرة وحدة.`,
  en: (directions) => `You are "Mubayan", the eyes of a blind person while they walk. You see video from their glasses camera and hear them through its mic; your voice plays in the glasses.
- Reply in English, unless they explicitly ask for a language ("read it in Arabic", "translate it", "say it in French"): then say what they asked in that language, translating faithfully if needed, and keep using it until they ask otherwise.
- Speak in very short sentences. Speed matters more than detail.
- If they interrupt you with a side question while you're reading or explaining something, answer it briefly, then carry on from where you stopped on your own, unless they said "stop" or changed the subject.
- If they talk to you or ask something, answer right away and briefly from what you see.
- The phone has a sensor that beeps and speaks up when they get close to something ahead (wall, person, pole, chair, stairs). So don't warn about close things in front of them yourself unless asked, so two voices never talk over each other. Only warn about hazards the sensor can't judge well, like an approaching car, a hole or a glass door.
- The video you see is too small to read text. If they ask you to read or translate something (a screen, paper, sign, menu) or about small details, say "one moment", call take_photo, then answer from the text it returns. Translate into English, unless they ask for another language.
- Text starting with "${SAY.en.trim()}" is an alert from the app: say it exactly and quickly, with no extra words.
- ${directions}
- Never try to identify people from their faces.
- If the image is dark or unclear, tell them once.`,
};

/** Said when the app can answer location tool calls (builds that send `tools: true`). */
const LOCATION_PROMPT: Record<Lang, string> = {
  ar: `- إذا سألك وين هو أو وين موقعه، استخدم get_location. وإذا سأل عن أقرب مكان (مطعم، كوفي، صيدلية، مسجد، مستشفى، صراف، محطة، بقالة) استخدم find_nearby. لا تخمن الموقع من الصورة أبدًا.
- بعد ما توصلك النتيجة قولها بجملة أو جملتين: الاسم، المسافة، كم دقيقة مشي، والاتجاه مثل ما وصلك بالضبط. وإذا فيه أكثر من مكان اذكر الأقرب وبعده واحد بس.`,
  en: `- If they ask where they are, use get_location. If they ask for the nearest place (restaurant, café, pharmacy, mosque, hospital, ATM, gas station, grocery store), use find_nearby. Never guess the location from the video.
- Once the result arrives, say it in one or two sentences: the name, distance, walking minutes and direction exactly as given. If there are several, give the nearest and just one more.`,
};

const KINDS = ["restaurant", "cafe", "pharmacy", "mosque", "hospital", "atm", "fuel", "grocery"];

const TAKE_PHOTO = {
  name: "take_photo",
  description:
    "Takes a sharp, full-resolution photo with the user's glasses camera and returns the text found in it. Use it before reading or translating anything, or for small details the video is too blurry for.",
};

const LOCATION_TOOLS = [
  {
    name: "get_location",
    description: "The user's current location from the phone's GPS: street, district and city, with how precise it is.",
  },
  {
    name: "find_nearby",
    description: "Places of one kind nearest to the user, closest first, with distance, walking time and the direction from them.",
    parameters: {
      type: "OBJECT",
      properties: { kind: { type: "STRING", enum: KINDS, description: "The kind of place the user asked for." } },
      required: ["kind"],
    },
  },
];

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
  // Only builds that answer get_location / find_nearby ask for them; older ones never see them.
  const location = body?.tools === true;

  const setup = {
    model: `models/${MODEL}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      // Medium: low made signs and faces a blur; reading still goes through take_photo.
      mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
    },
    systemInstruction: { parts: [{ text: PROMPT[lang](directions) + (location ? `\n${LOCATION_PROMPT[lang]}` : "") }] },
    // The app answers with a full-resolution photo and the text read from it on the phone,
    // and (when it can) with GPS and nearby places.
    tools: [{ functionDeclarations: location ? [TAKE_PHOTO, ...LOCATION_TOOLS] : [TAKE_PHOTO] }],
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
