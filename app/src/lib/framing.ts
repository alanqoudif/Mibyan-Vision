import { streamAssist } from '@/lib/assist';
import type { Lang } from '@/lib/i18n';
import type { ModeId } from '@/lib/modes';

const OK = '<ok>';

/**
 * Asks the fast model whether a frame is good enough for `target` (text fully in view, note
 * not cut off…). Returns a short spoken tip, or `null` when the frame is fine — or when the
 * check fails, since a failed check should never block the real request.
 */
export async function checkFrame(target: ModeId, image: string, lang: Lang, signal?: AbortSignal): Promise<string | null> {
  try {
    const raw = await streamAssist({ mode: 'frame', target, image, model: 'fast', lang }, () => {}, signal);
    const tip = raw.trim();
    return !tip || tip.includes(OK) ? null : tip;
  } catch {
    return null;
  }
}
