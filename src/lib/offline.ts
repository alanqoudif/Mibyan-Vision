import { File, Paths } from 'expo-file-system';

import type { Lang } from '@/lib/i18n';
import type { ModeId } from '@/lib/modes';

import { Glasses } from '../../modules/mubayan-glasses';

/** Modes where reading the text out is still useful when the assistant can't be reached. */
export const READS_TEXT = new Set<ModeId>(['read', 'screen', 'menu', 'product', 'meds']);

/**
 * On-device text recognition (Apple Vision) of a base64 JPEG, for when there's no internet:
 * in a lift, a hospital basement, abroad. `null` when it isn't available (Expo Go, web)
 * or nothing was read.
 */
export async function readTextOffline(base64: string, lang: Lang): Promise<string | null> {
  if (!Glasses) return null;
  const file = new File(Paths.cache, `ocr-${Date.now()}.jpg`);
  try {
    file.create();
    file.write(base64, { encoding: 'base64' });
    const languages = lang === 'en' ? ['en-US', 'ar-SA'] : ['ar-SA', 'en-US'];
    const text = (await Glasses.recognizeText(file.uri, languages)).trim();
    return text || null;
  } catch (e) {
    console.warn('offline text failed', e);
    return null;
  } finally {
    try {
      file.delete();
    } catch {}
  }
}
