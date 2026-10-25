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
