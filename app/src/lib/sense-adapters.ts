import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';

import { streamAssist } from '@/lib/assist';
import { captureFromGlasses } from '@/lib/glasses';
import type { Lang } from '@/lib/i18n';
import { speak } from '@/lib/voice';
import { CapabilityError, type Adapters } from '@mibyan/shared/sense';

/**
 * Connects the Sense runtime to what this phone can really do today.
 * - capture: the glasses camera when registered, otherwise the caller's phone-camera function.
 *   If neither is available it throws a CapabilityError (no placeholder image).
 * - describe: the existing `mata-assist` function in `describe` mode.
 * Everything else is left undefined on purpose, so Senses that need it fail with a clear
 * capability error until a real adapter exists.
 */
export function createPhoneAdapters(opts: {
  lang: Lang;
  /** Takes a photo with the phone camera and returns a file:// URI, or undefined if unavailable. */
  phoneCapture?: () => Promise<string | undefined>;
}): Adapters {
  return {
    async capture() {
      const glasses = await captureFromGlasses('photo');
      if (glasses) return { imageRef: glasses, source: 'meta_glasses' as const };
      const phone = await opts.phoneCapture?.();
      if (phone) return { imageRef: phone, source: 'phone_camera' as const };
      throw new CapabilityError('camera', 'no glasses or phone camera available');
    },
    async describe(imageRef, prompt) {
      const ref = await ImageManipulator.manipulate(imageRef).resize({ width: 768 }).renderAsync();
      const image = (await ref.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG })).base64;
      if (!image) throw new Error('could not encode image');
      const text = await streamAssist({ mode: 'describe', image, text: prompt, lang: opts.lang, model: 'fast' }, () => {});
      return { text: text.trim() };
    },
    async speak(text) {
      speak(text);
    },
  };
}

/** High-impact nodes ask the person first; there is no silent approval path. */
export function confirmWithUser(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Allow', onPress: () => resolve(true) },
    ], { onDismiss: () => resolve(false) }),
  );
}
