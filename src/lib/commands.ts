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

const QIBLA = /(القبله|اتجاه الكعبه|qibla)/;
const LIVE = /(الوضع المباشر|راقب معي|live mode|watch with me)/;
const WHERE = /(وين انا|فين انا|where am i)/;
const CALL = /^(اتصل|اتصلي|كلم|نادي|call|ring|get)\s+(.+)$/;
const ANYONE = /(احد|حد|someone|anyone|somebody|help)/;

export type SpokenRoute =
  | { pathname: '/qibla' }
  | { pathname: '/live' }
  | { pathname: '/session'; params: { mode: 'where' } }
  | { pathname: '/helper'; params: { notify: string } };

/**
 * Questions that are really "open that screen": "where's the qibla", "call mom to see with me",
 * "where am I", "start live mode". `contactId` resolves a spoken name to a trusted helper.
 */
export function matchRoute(question: string, contactId: (text: string) => number | undefined): SpokenRoute | null {
  const q = normalize(question).replace(/^(يا )?مبيان /, '');
  const call = q.match(CALL);
  if (call) {
    const id = contactId(question);
    if (id !== undefined) return { pathname: '/helper', params: { notify: String(id) } };
    if (ANYONE.test(call[2])) return { pathname: '/helper', params: { notify: 'all' } };
  }
  if (QIBLA.test(q)) return { pathname: '/qibla' };
  if (LIVE.test(q)) return { pathname: '/live' };
  if (WHERE.test(q)) return { pathname: '/session', params: { mode: 'where' } };
  return null;
}
