import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef } from 'react';

import * as Earcons from '@/lib/earcons';

const LOUD_DB = -38;
const SILENCE_MS = 1300;
const NO_VOICE_MS = 7000;
const MAX_LISTEN_MS = 15000;

/**
 * One spoken answer: opens the mic, waits for speech then a pause, and resolves with the
 * recording as base64 m4a (or `undefined` if nobody spoke). For screens that only need a short
 * phrase; the session screen keeps its own recorder for barge-in.
 */
export function useListen() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
      recorder.stop().catch(() => {});
    },
    [recorder],
  );

  const listen = useCallback(async (): Promise<string | undefined> => {
    cancelled.current = false;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return undefined;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    Earcons.play('listen');

    const start = Date.now();
    let heard = false;
    let lastLoud = start;
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        const now = Date.now();
        if ((recorder.getStatus().metering ?? -160) > LOUD_DB) {
          heard = true;
          lastLoud = now;
        }
        if (
          cancelled.current ||
          (heard && now - lastLoud > SILENCE_MS) ||
          (!heard && now - start > NO_VOICE_MS) ||
          now - start > MAX_LISTEN_MS
        ) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });

    await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (cancelled.current || !heard || !recorder.uri) return undefined;
    Earcons.play('send');
    return new File(recorder.uri).base64();
  }, [recorder]);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { listen, cancel };
}
