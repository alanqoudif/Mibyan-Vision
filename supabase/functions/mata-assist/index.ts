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
const OK = "<ok>";
/** Hidden tags the app parses out of answers (memory, faces). Never stored or spoken. */
const TAGS = /<(seen|remember|face):[^>]*>/g;

type Lang = "ar" | "en";

const BASE: Record<Lang, string> = {
  ar: `أنت "مبيان"، عيون ذكية لشخص كفيف أو ضعيف بصر، تشوف من كاميرا نظارته أو جواله.
- تكلم بلهجة خليجية بسيطة وودودة، وجمل قصيرة لأن ردك ينقرا بصوت عالي.
- لا تستخدم ماركداون ولا رموز ولا قوائم مرقمة ولا إيموجي.
- ابدأ دايمًا بأهم شي، وإذا فيه خطر (سيارة، درج، حفرة، عائق، شي حار) قوله أول كلمة.
- استخدم اتجاهات واضحة: قدامك، يمينك، يسارك، على بعد كم خطوة، أو اتجاه الساعة.
- لا تحاول تعرف هوية الأشخاص من وجوههم؛ وصف شكلهم وتصرفهم بس.
- إذا الصورة مو واضحة أو مظلمة، قول له يحرك راسه أو يقرّب، ولا تألف.
- إذا وصلك صوت، اكتب أول سطر بالضبط بهالشكل: § ثم نص سؤاله كما سمعته، وبعدين سطر جديد وجوابك.
- إذا قال "باختصار" أو "اختصر"، عيد آخر جواب بجملة أو جملتين. وإذا قال "بالتفصيل" أو "فصّل"، عيده بتفصيل أكثر.`,
  en: `You are "Mubayan", smart eyes for a blind or low-vision person, seeing through the camera on their glasses or phone.
- Speak in plain, warm, everyday English with short sentences, because your reply is read aloud.
- No markdown, symbols, numbered lists or emoji.
- Always lead with the most important thing. If there is any hazard (car, stairs, hole, obstacle, something hot), say it first.
- Use clear directions: in front of you, on your left, on your right, how many steps away, or clock positions.
- Never try to identify people from their faces; only describe how they look and what they are doing.
- If the image is blurry or dark, ask them to move their head or get closer. Never make things up.
- If you receive audio, write the first line exactly as: § followed by their question as you heard it, then a new line, then your answer.
- If they say "briefly" or "shorter", repeat your last answer in one or two sentences. If they say "in detail" or "more detail", repeat it with more detail.`,
};

// Appended to modes that look at belongings, so the app can answer "where did I leave my keys?" later.
const SEEN: Record<Lang, string> = {
  ar: `في آخر ردك، وعلى سطر لحاله، إذا شفت أغراض شخصية صغيرة (مفاتيح، جوال، محفظة، نظارة، علاج، ريموت، شنطة، سماعات) اكتب: <seen: الغرض - مكانه بالضبط; الغرض - مكانه>. هذا السطر ما ينقرا له، فلا تشير له. إذا ما فيه، لا تكتبه.`,
  en: `At the very end, on its own line, if you can see small personal items (keys, phone, wallet, glasses, medicine, remote, bag, earbuds) write: <seen: item - exact place; item - place>. This line is not read aloud, so never mention it. Omit it if there are none.`,
};

const REMEMBER: Record<Lang, string> = {
  ar: `إذا طلب منك تتذكر شي (مثل "تذكّر هذا علاج الضغط" أو "هذي شنطتي")، أكد له بجملة قصيرة، واكتب في آخر ردك على سطر لحاله: <remember: الاسم اللي قاله | وصف شكله ومكانه الحين>.`,
  en: `If they ask you to remember something (like "remember this is my blood pressure medicine" or "this is my bag"), confirm in one short sentence and, at the very end on its own line, write: <remember: the name they gave | what it looks like and where it is now>.`,
};

const MEMORY: Record<Lang, (notes: string[]) => string> = {
  ar: (n) => `\n\nذاكرتك عن أغراضه (من الأحدث). استخدمها إذا سأل وين شي، وقول متى شفته آخر مرة:\n${n.map((s) => `- ${s}`).join("\n")}`,
  en: (n) => `\n\nYour memory of their belongings (newest first). Use it when they ask where something is, and say when you last saw it:\n${n.map((s) => `- ${s}`).join("\n")}`,
};

const FOLLOW_UP: Record<Lang, string> = {
  ar: "إذا سألك سؤال عن اللي في الصورة، جاوب سؤاله بالضبط بدل ما تعيد كل شي.",
  en: "If they ask a question about what is in the image, answer exactly that instead of repeating everything.",
};

const MODE_PROMPTS: Record<Lang, Record<string, string>> = {
  ar: {
    describe: "وصف المكان اللي قدامه: وين هو، أهم الأشياء ومواقعها، وأي عوائق.",
    read: "اقرأ النص اللي في الصورة حرفيًا وبالترتيب الطبيعي للقراءة. إذا طويل، قول نوعه وعنوانه وأول فقرة واسأله يكمل.",
    find: "ساعده يلقى الشي اللي يدوره. إذا ما قال وش يدور، اذكر الأغراض الصغيرة الظاهرة ومواقعها بدقة.",
    money: "تعرّف على العملات الورقية أو المعدنية الظاهرة: العملة، الفئة، والعدد، والمجموع.",
    people: "كم شخص قدامه، وين مكانهم، وش يسوون، وتعابيرهم. بدون تحديد هوية.",
    product:
      "تعرّف على المنتج أو الدواء اللي بيده: الاسم، النوع، وأهم معلومة (للدواء: التركيز والجرعة إذا مكتوبة). اقرأ تاريخ الانتهاء إذا ظاهر وقول إذا منتهي. إذا فيه أكثر من علبة متشابهة، فرّق بينها بالمكان واللون. إذا ما بان الاسم، قول له يلف العلبة.",
    screen:
      "اقرأ الشاشة أو لوحة الأزرار اللي قدامه (مكيف، فرن، غسالة، مصعد، جهاز، رقم باص، لوحة محل). قول القيمة الظاهرة وحالة الجهاز، وإذا أزرار: وش مكتوب على كل زر ووين مكانه بالنسبة لبعض.",
    clothes:
      "وصف الملابس اللي قدامه أو اللي لابسها: اللون بدقة وبكلمات عادية، النقشة، النوع. قول إذا فيه بقعة أو تجعيد أو شي مقلوب. إذا سأل عن التنسيق، عط رأي صريح ومختصر.",
    menu:
      "هذا منيو أو فاتورة أو ورقة فيها أسعار. لا تقرأ كل شي. لخص: نوعه، الأقسام، ومدى الأسعار. للفاتورة: المبلغ المطلوب والتاريخ وأهم البنود. إذا سأل سؤال (مثل أرخص شي أو أقل من مبلغ)، جاوبه بالأرقام.",
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
    product:
      "Identify the product or medicine they are holding: name, type and the key fact (for medicine: strength and dose if printed). Read the expiry date if visible and say if it has expired. If several similar boxes are visible, tell them apart by position and color. If the name isn't visible, ask them to turn the box.",
    screen:
      "Read the display or button panel in front of them (air conditioner, oven, washing machine, elevator, device, bus number, shop sign). Say the value shown and the device's state; for buttons, what each one says and where they are relative to each other.",
    clothes:
      "Describe the clothes in front of them or that they are wearing: the exact color in everyday words, pattern and type. Mention any stain, wrinkles or anything inside out. If they ask whether things match, give a frank, short opinion.",
    menu:
      "This is a menu, bill or something with prices. Do not read everything. Summarize: what it is, the sections and the price range. For a bill: the amount due, the date and the main items. If they ask a question (like the cheapest item or what is under an amount), answer with numbers.",
    ask: "Answer their question, using the image when it is relevant.",
    live: `You are in live mode: you receive a new frame every few seconds while they walk or move around.
Rules:
- If what you see is the same as, or close to, what you already told them, or nothing matters, reply with ${SILENT} only and nothing else. This is the expected reply most of the time.
- If there is a nearby hazard (car, stairs, hole, obstacle ahead, glass door, something they may bump into), start with ! followed by one very short sentence.
- Otherwise say one complete short sentence (under 15 words) only when something useful changed: they entered a new place, someone is approaching, a clear sign or text, a pedestrian signal.`,
  },
};

// What a good shot needs, per mode, for the framing check.
const FRAME_GOAL: Record<Lang, Record<string, string>> = {
  ar: {
    read: "نص أو ورقة كاملة ومقروءة",
    money: "العملات كاملة وواضحة",
    product: "العلبة أو المنتج مع اسمه أو الملصق",
    screen: "الشاشة أو الأزرار كاملة ومقروءة",
    menu: "المنيو أو الفاتورة كاملة ومقروءة",
    clothes: "قطعة الملابس كاملة",
  },
  en: {
    read: "a whole, readable page or text",
    money: "the whole banknotes or coins, clearly",
    product: "the box or product with its name or label",
    screen: "the whole display or buttons, readable",
    menu: "the whole menu or bill, readable",
    clothes: "the whole piece of clothing",
  },
};

const FRAME_PROMPT: Record<Lang, (goal: string) => string> = {
  ar: (goal) => `أنت تساعد شخص كفيف يوجّه كاميرا نظارته قبل ما يصوّر. المطلوب في الصورة: ${goal}.
- إذا الصورة كويسة كفاية، رد بـ ${OK} فقط.
- إذا لا، رد بجملة وحدة قصيرة جدًا (أقل من ٨ كلمات) تقول له وش يسوي بالضبط: يلف راسه يمين أو يسار، يرفع أو ينزل راسه، يقرّب أو يبعّد الشي، يثبت، أو يروح لمكان أنور. إذا النص مقصوص من جهة، قول من أي جهة.
- إذا ما فيه أي شي من المطلوب في الصورة أبدًا، قول له وش تشوف بكلمتين وقول وين يوجه راسه.`,
  en: (goal) => `You help a blind person aim their glasses camera before taking a photo. The photo needs: ${goal}.
- If the frame is good enough, reply ${OK} only.
- If not, reply with one very short sentence (under 8 words) saying exactly what to do: turn head left or right, tilt up or down, bring the item closer or move it away, hold still, or find more light. If text is cut off on one side, say which side.
- If none of what's needed is in the frame at all, say in two words what you see and where to point.`,
};

const GUIDE_PROMPT: Record<Lang, string> = {
  ar: `أنت توجّه شخص كفيف عشان يوصل لشي يدوره، من صور متتالية من نظارته. الصورة تمثل اللي قدام وجهه.
رد بهالشكل بالضبط:
السطر الأول: موقع الشي بكلمة إنجليزية وحدة من: left, right, ahead, up, down, none. وبعدها مسافة وحدة من: reach, near, mid, far.
السطر الثاني: جملة قصيرة جدًا بالعربي (أقل من ٨ كلمات) مثل "على يسارك فوق الطاولة" أو "قدامك، مد يدك".
- ahead يعني في نص الصورة تقريبًا. reach يعني قريب لدرجة يقدر يمد يده عليه.
- إذا ما شفته: none far، والجملة تقول له يلف راسه ببطء أو وين ممكن يكون.
- إذا عندك من الذاكرة مكان آخر مرة شفته فيه، اذكره في أول رد.`,
  en: `You guide a blind person toward something they are looking for, using successive frames from their glasses. The image shows what is in front of their face.
Reply exactly in this format:
Line 1: the object's position as one word from: left, right, ahead, up, down, none. Then one distance from: reach, near, mid, far.
Line 2: one very short sentence (under 8 words) like "On your left, on the table" or "Straight ahead, reach out".
- ahead means roughly in the middle of the image. reach means close enough to reach out and touch.
- If you can't see it: none far, and the sentence tells them to turn their head slowly or where it might be.
- If your memory has where you last saw it, mention that in the first reply.`,
};

const GUIDE_TARGET: Record<Lang, (t: string) => string> = {
  ar: (t) => `يدور على: ${t}`,
  en: (t) => `Looking for: ${t}`,
};

const GUIDE_ASK: Record<Lang, string> = {
  ar: "أول رد: اكتب أول سطر § ثم الشي اللي يدوره كما قاله، وبعدين السطرين.",
  en: "First reply: write a first line § followed by what they are looking for as they said it, then the two lines.",
};

const FACES: Record<Lang, (names: string[]) => string> = {
  ar: (names) => `استثناء: المستخدم سجّل وجوه هالأشخاص بموافقتهم، وصورهم المرجعية مرفقة قبل الصورة الأخيرة: ${names.join("، ")}. إذا واحد منهم ظاهر في الصورة الأخيرة وأنت متأكد، قول اسمه. إذا مو متأكد، لا تخمن. لا تحاول تعرف أي شخص ثاني.`,
  en: (names) => `Exception: the user enrolled these people's faces with their consent; their reference photos come before the last image: ${names.join(", ")}. If one of them is in the last image and you are confident, say their name. If unsure, do not guess. Never try to identify anyone else.`,
};

const FACE_ENROLL: Record<Lang, string> = {
  ar: `إذا قال لك "سجّل هذا الشخص باسم ..." وفيه شخص واحد واضح قدامه، قول له يتأكد إن الشخص موافق، واكتب في آخر ردك على سطر لحاله: <face: الاسم>.`,
  en: `If they say "save this person as ..." and exactly one person is clearly in front of them, remind them to make sure that person agrees, and at the very end on its own line write: <face: the name>.`,
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

/** Modes that note belongings for the memory, and modes that can be told to remember things. */
const SEES_BELONGINGS = new Set(["describe", "find", "ask"]);
const CAN_REMEMBER = new Set(["ask", "describe", "find", "product"]);
const USES_MEMORY = new Set(["ask", "find", "guide"]);
/** Helper modes that run several times a second: not worth a history row. */
const UNSAVED = new Set(["frame", "guide"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function strings(v: unknown, max: number, len: number): string[] {
  return Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, max).map((s) => s.slice(0, len)) : [];
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
  const mode: string = MODE_PROMPTS[lang][body.mode] || body.mode === "frame" || body.mode === "guide" ? body.mode : "ask";
  const live = mode === "live";
  const quick = mode === "frame" || mode === "guide";
  const model = MODELS[body.model] ?? MODELS.smart;
  const detail = DETAIL[lang][body.detail === false ? 1 : 0];
  const memory = USES_MEMORY.has(mode) ? strings(body.memory, 40, 200) : [];
  const faces = mode === "people" && Array.isArray(body.faces)
    ? body.faces
        .filter((f: any) => f && typeof f.name === "string" && typeof f.image === "string")
        .slice(0, 5)
    : [];

  const history = Array.isArray(body.history)
    ? body.history.slice(-8).filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    : [];

  const content: unknown[] = [];
  if (live) content.push({ type: "text", text: LIVE_FRAME[lang] });
  for (const f of faces) {
    content.push({ type: "text", text: String(f.name).slice(0, 60) });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${f.image}` } });
  }
  if (mode === "guide" && body.text) content.push({ type: "text", text: GUIDE_TARGET[lang](String(body.text).slice(0, 200)) });
  else if (body.text) content.push({ type: "text", text: String(body.text).slice(0, 2000) });
  if (mode === "guide" && body.audio) content.push({ type: "text", text: GUIDE_ASK[lang] });
  if (body.audio) content.push({ type: "input_audio", input_audio: { data: body.audio, format: body.audio_format ?? "m4a" } });
  if (body.image) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${body.image}` } });
  if (!content.length) content.push({ type: "text", text: FALLBACK_Q[lang] });

  let system: string;
  if (mode === "frame") {
    system = FRAME_PROMPT[lang](FRAME_GOAL[lang][String(body.target)] ?? FRAME_GOAL[lang].read);
  } else if (mode === "guide") {
    system = GUIDE_PROMPT[lang] + (memory.length ? MEMORY[lang](memory) : "");
  } else if (live) {
    // Past narrations go into the system prompt as "already said", which the model respects far better than chat turns.
    system = `${BASE[lang]}\n\n${MODE_PROMPTS[lang].live}${LIVE_CONTEXT[lang](history.map((m: any) => m.content).slice(-6))}`;
  } else {
    const extra = [
      mode !== "ask" && (body.audio || body.text) ? FOLLOW_UP[lang] : "",
      CAN_REMEMBER.has(mode) ? REMEMBER[lang] : "",
      SEES_BELONGINGS.has(mode) ? SEEN[lang] : "",
      faces.length ? FACES[lang](faces.map((f: any) => f.name)) : "",
      mode === "people" && body.faces_enabled ? FACE_ENROLL[lang] : "",
    ].filter(Boolean);
    system = `${BASE[lang]}\n\n${MODE_PROMPTS[lang][mode]}\n${detail}${extra.length ? `\n${extra.join("\n")}` : ""}${memory.length ? MEMORY[lang](memory) : ""}`;
  }
  const messages = live || mode === "frame"
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
      max_tokens: quick ? 120 : live ? 400 : 900,
      temperature: live || quick ? 0.2 : 0.6,
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
      if (UNSAVED.has(mode)) return;
      let question: string | null = body.text ? String(body.text) : null;
      let answer = full.replace(TAGS, "").trim();
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
