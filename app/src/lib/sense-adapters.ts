import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';

import { streamAssist } from '@/lib/assist';
import { captureFromGlasses } from '@/lib/glasses';
import type { Lang } from '@/lib/i18n';
import { memoryNotes } from '@/lib/memory';
import { addRecord, getActiveShift, type RecordRow } from '@/lib/sixth';
import { getS } from '@/lib/strings';
import { speak } from '@/lib/voice';
import { CapabilityError, type Adapters, type DeviceKind } from '@mibyan/shared/sense';

/**
 * Connects the Sense runtime to what this phone can really do today.
 * - capture: the glasses camera when registered, otherwise the caller's phone-camera function.
 *   If neither is available it throws a CapabilityError (no placeholder image).
 * - describe / ocr / ask: the existing `mata-assist` function (describe, read, ask modes).
 * - speak: the app's voice. notify: an in-app alert (no push; says so in the docs).
 * - saveRecord: writes to the signed-in account's `vision_records`, only after the person approves.
 * - searchMemory: the on-phone memory (lib/memory). Nothing leaves the phone.
 * What is missing stays undefined on purpose, so a Sense that needs it fails with a clear capability error.
 */
export function createPhoneAdapters(opts: {
  lang: Lang;
  /** Takes a photo with the phone camera and returns a file:// URI, or undefined if unavailable. */
  phoneCapture?: () => Promise<string | undefined>;
  senseId?: string;
  /** Called with where the last image came from. */
  onSource?: (s: DeviceKind) => void;
}): Adapters {
  let lastSource: DeviceKind = 'phone_camera';
  const encode = async (imageRef: string) => {
    const ref = await ImageManipulator.manipulate(imageRef).resize({ width: 768 }).renderAsync();
    const image = (await ref.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG })).base64;
    if (!image) throw new Error('could not encode image');
    return image;
  };
  const S = getS(opts.lang);
  return {
    async capture() {
      const glasses = await captureFromGlasses('photo');
      if (glasses) return (lastSource = 'meta_glasses'), opts.onSource?.('meta_glasses'), { imageRef: glasses, source: 'meta_glasses' as const };
      const phone = await opts.phoneCapture?.();
      if (phone) return (lastSource = 'phone_camera'), opts.onSource?.('phone_camera'), { imageRef: phone, source: 'phone_camera' as const };
      throw new CapabilityError('camera', 'no glasses or phone camera available');
    },
    async describe(imageRef, prompt) {
      const text = await streamAssist({ mode: 'describe', image: await encode(imageRef), text: prompt, lang: opts.lang, model: 'fast' }, () => {});
      return { text: text.trim() };
    },
    async ocr(imageRef) {
      const text = await streamAssist({ mode: 'read', image: await encode(imageRef), lang: opts.lang, model: 'fast' }, () => {});
      return { text: text.trim() };
    },
    async ask(prompt) {
      const text = await streamAssist({ mode: 'ask', text: prompt, lang: opts.lang, model: 'fast' }, () => {});
      return { text: text.trim() };
    },
    async speak(text) {
      speak(text);
    },
    async notify(title, body) {
      Alert.alert(title, body);
    },
    async saveRecord(record) {
      const ok = await confirmWithUser(S.lvSaveAsk, String(record.observation ?? record.type ?? ''), opts.lang);
      if (!ok) throw new Error(opts.lang === 'ar' ? 'اخترتَ عدم حفظ السجل' : 'You chose not to save this record');
      const shift = await getActiveShift().catch(() => null);
      const type = (['observation', 'inspection', 'task_done', 'task_pending', 'issue'].includes(String(record.type)) ? record.type : 'observation') as RecordRow['type'];
      const id = await addRecord({
        shiftId: shift?.id,
        senseId: opts.senseId,
        type,
        text: String(record.observation ?? record.text ?? '(no text)'),
        flagged: record.flagged === true,
        consented: true, // the person just approved it above
        source: lastSource === 'meta_glasses' ? 'device' : 'phone',
      });
      return { id };
    },
    async searchMemory(query) {
      const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return memoryNotes(opts.lang)
        .map((text, i) => ({ id: `m${i}`, text }))
        .filter((m) => words.some((w) => m.text.toLowerCase().includes(w)))
        .slice(0, 3);
    },
  };
}

/** High-impact nodes ask the person first; there is no silent approval path. */
export function confirmWithUser(title: string, message: string, lang: Lang = 'en'): Promise<boolean> {
  const S = getS(lang);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: S.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: S.allow, onPress: () => resolve(true) },
    ], { onDismiss: () => resolve(false) }),
  );
}
