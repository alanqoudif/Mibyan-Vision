import type { ModeId } from '@/lib/modes';

/** Spoken commands the app acts on itself, read from the transcribed question. */
export type Command = 'stop' | 'brief' | 'detail';

const STOP = /^(خلاص|وقف|اوقف|اسكت|بس|كفايه|كفى|يكفي|stop|enough|be quiet|quiet|that'?s enough|ok stop)$/;
const BRIEF = /(باختصار|اختصر|مختصر|briefly|shorter|in short|be brief)/;
const DETAIL = /(بالتفصيل|فصل|تفاصيل اكثر|more detail|in detail|elaborate)/;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // harakat, tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[.,!?؟،؛:"'«»…-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Stop" only counts on its own, so "stop sign ahead?" is still a question. */
export function matchCommand(question: string): Command | null {
  const q = normalize(question);
  if (STOP.test(q) || STOP.test(q.replace(/^(يا )?مبيان /, ''))) return 'stop';
  if (BRIEF.test(q)) return 'brief';
  if (DETAIL.test(q)) return 'detail';
  return null;
}

/**
 * Plain "ask" questions that are really one of the specialised tools, checked in order so
 * "read this screen" goes to screens before text. Each tool has its own tuned prompt and aim
 * coaching, so the user never has to pick one from a list.
 */
const INTENTS: [Exclude<ModeId, 'ask' | 'live' | 'where'>, RegExp][] = [
  ['meds', /(الدوا الصح|الدواء الصح|هذا دوا|هذا علاجي|دوايي|دوائي|right medicine|my medicine|my pills)/],
  [
    'product',
    /(تاريخ الانتهاء|متي تنتهي|متي ينتهي|وش هالعلبه|ايش هالعلبه|هالمنتج|expir|what is this box|what product)/,
  ],
  ['money', /(فلوس|ريال|عمله|كم المبلغ|money|cash|banknote|how much is this note)/],
  ['menu', /(المنيو|منيو|الفاتوره|فاتوره|menu|bill|receipt)/],
  ['screen', /(الشاشه|شاشه|الازرار|المكيف|الريموت|الغساله|screen|display|buttons|remote)/],
  ['read', /(اقرا|اقري|وش مكتوب|ايش مكتوب|الورقه|الكتاب|\bread\b|what does it say|written)/],
  ['clothes', /(لون|الوان|بقعه|ثوب|ملابس|لبسي|colou?r|stain|outfit|clothes)/],
  ['people', /(مين حولي|مين قدامي|الناس|اشخاص|who is around|who'?s here|people)/],
  ['find', /(دور لي|دوري لي|ابحث عن|ساعدني (القي|الاقي)|find my|help me find|look for)/],
  ['describe', /(وش قدامي|ايش قدامي|وش حولي|صف لي|وصف لي|what'?s in front|describe|what do you see)/],
];

/** The specialised tool a free-form question belongs to, if any. */
export function matchMode(question: string): (typeof INTENTS)[number][0] | null {
  const q = normalize(question).replace(/^(يا )?مبيان /, '');
  return INTENTS.find(([, re]) => re.test(q))?.[0] ?? null;
}

const QIBLA = /(القبله|اتجاه الكعبه|qibla)/;
const LIVE = /(الوضع المباشر|راقب معي|live mode|watch with me)/;
const WHERE = /(وين انا|فين انا|where am i)/;
const CALL = /^(اتصل|اتصلي|كلم|نادي|call|ring|get)\s+(.+)$/;
const ANYONE = /(احد|حد|someone|anyone|somebody|help)/;

export type SpokenRoute =
  | { pathname: '/qibla' }
  | { pathname: '/live' }
  | { pathname: '/session'; params: { mode: 'where' } }
  | { pathname: '/helper'; params: { notify: string } }
  | { dial: string };

/**
 * Questions that are really "open that screen": "where's the qibla", "call mom to see with me",
 * "where am I", "start live mode". `contactId` resolves a spoken name to a trusted helper, and
 * `phoneOf` to a saved emergency number ("call dad" dials him when he isn't a helper).
 */
export function matchRoute(
  question: string,
  contactId: (text: string) => number | undefined,
  phoneOf: (text: string) => string | undefined = () => undefined,
): SpokenRoute | null {
  const q = normalize(question).replace(/^(يا )?مبيان /, '');
  const call = q.match(CALL);
  if (call) {
    const id = contactId(question);
    if (id !== undefined) return { pathname: '/helper', params: { notify: String(id) } };
    const phone = phoneOf(question);
    if (phone) return { dial: phone };
    if (ANYONE.test(call[2])) return { pathname: '/helper', params: { notify: 'all' } };
  }
  if (QIBLA.test(q)) return { pathname: '/qibla' };
  if (LIVE.test(q)) return { pathname: '/live' };
  if (WHERE.test(q)) return { pathname: '/session', params: { mode: 'where' } };
  return null;
}
