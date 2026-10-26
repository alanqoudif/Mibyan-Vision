import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import * as Earcons from '@/lib/earcons';
import { useI18n } from '@/lib/i18n';

import { Glasses, type RegistrationState } from '../../modules/mubayan-glasses';

/**
 * - `unsupported`: Expo Go / web — the native SDK isn't in this build, phone camera only.
 * - `unregistered`: the app hasn't been approved in Meta AI yet.
 * - `needsCamera`: approved, but camera access on the glasses isn't granted.
 * - `needsUpdate`: the toolkit app on the glasses is out of date; Meta AI updates it.
 * - `ready`: photos come from the glasses.
 */
export type GlassesStatus = 'unsupported' | 'unregistered' | 'registering' | 'needsCamera' | 'needsUpdate' | 'ready';

export function useGlasses() {
  const [status, setStatus] = useState<GlassesStatus>(Glasses ? 'unregistered' : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const needsUpdate = useCameraSource().needsUpdate;

  const refresh = useCallback(() => {
    Glasses?.getRegistrationState()
      .then(resolveStatus)
      .then(setStatus, (e) => setError(message(e)));
  }, []);

  useEffect(() => {
    if (!Glasses) return;
    Glasses.getRegistrationState()
      .then(resolveStatus)
      .then(setStatus, (e) => setError(message(e)));
    const reg = Glasses.addListener('onRegistrationChange', ({ state }) => {
      resolveStatus(state).then(setStatus, (e) => setError(message(e)));
    });
    // Approval happens inside Meta AI; re-check when the user comes back.
    const app = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      reg.remove();
      app.remove();
    };
  }, [refresh]);

  /** Walks the user through Meta AI: approve the app first, then camera access. */
  const connect = useCallback(async () => {
    if (!Glasses) return;
    setBusy(true);
    setError(null);
    try {
      if (needsUpdate || (await Glasses.needsAppUpdate())) {
        await Glasses.openAppUpdate();
        retryAt = 0;
        setSource({ glasses: source.glasses, frame: source.frame });
      } else if ((await Glasses.getRegistrationState()) !== 'registered') {
        await Glasses.register();
      } else if ((await Glasses.requestCameraPermission()) !== 'granted') {
        setError(t.glassesCameraDenied);
      }
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }, [needsUpdate, refresh, t]);

  return { status: needsUpdate && status === 'ready' ? 'needsUpdate' : status, busy, error, connect, refresh };
}

/**
 * Changes in where photos come from, worth telling the user about:
 * - `lost`: the glasses stopped answering, photos now come from the phone.
 * - `paused`: the glasses paused the camera (a tap on the touchpad resumes it).
 * - `back`: the glasses are answering again.
 */
export type GlassesNotice = 'lost' | 'paused' | 'back';

let lastSource: 'glasses' | GlassesNotice | null = null;
let pending: GlassesNotice | null = null;

function notice(n: GlassesNotice) {
  if (lastSource === n) return;
  // "back" only matters after a "lost" or "paused".
  if (n === 'back' && (lastSource === null || lastSource === 'glasses')) {
    lastSource = 'glasses';
    return;
  }
  lastSource = n === 'back' ? 'glasses' : n;
  pending = n;
  Earcons.play(n === 'back' ? 'up' : 'down');
}

/**
 * The latest unannounced change, if any. Screens read it after a capture and speak it
 * before the answer, so it isn't cut off by the answer's own speech.
 */
export function takeGlassesNotice(): GlassesNotice | null {
  const n = pending;
  pending = null;
  return n;
}

/**
 * Where photos come from right now, and the latest glasses photo to show as the preview.
 * Screens keep the phone camera closed while the glasses are the source.
 */
export type CameraSource = { glasses: boolean; frame?: string; needsUpdate?: boolean };

let source: CameraSource = { glasses: false };
let sourceVersion = 0;
const sourceListeners = new Set<() => void>();

function setSource(next: CameraSource) {
  source = next;
  sourceVersion++;
  sourceListeners.forEach((l) => l());
}

function subscribeSource(listener: () => void) {
  sourceListeners.add(listener);
  return () => sourceListeners.delete(listener);
}

export function useCameraSource(): CameraSource {
  useEffect(() => {
    if (!Glasses) return;
    // Before the first capture, start on the glasses if they're set up.
    const version = sourceVersion;
    Glasses.getRegistrationState()
      .then(resolveStatus)
      .then((status) => {
        if (sourceVersion === version) setSource({ ...source, glasses: status === 'ready' });
      })
      .catch(() => {});
  }, []);
  return useSyncExternalStore(subscribeSource, () => source);
}

// After a failed capture, the phone camera answers straight away for a while instead of
// every photo waiting for the glasses to fail again.
const RETRY_AFTER_MS = 20_000;
let retryAt = 0;

/**
 * A `file://` JPEG from the glasses, or `undefined` if they aren't set up or reachable.
 * `frame` grabs the latest video frame (instant, video resolution) instead of a photo.
 */
export async function captureFromGlasses(kind: 'photo' | 'frame' = 'photo'): Promise<string | undefined> {
  if (!Glasses || Date.now() < retryAt) return undefined;
  try {
    if ((await Glasses.getRegistrationState()) !== 'registered') {
      setSource({ glasses: false });
      return undefined;
    }
  } catch {
    return undefined;
  }
  try {
    const uri = kind === 'frame' ? await Glasses.captureFrame() : await Glasses.capturePhoto();
    notice('back');
    setSource({ glasses: true, frame: uri });
    return uri;
  } catch (e) {
    console.warn('glasses capture failed, using the phone camera', e);
    const paused = message(e).includes('paused');
    notice(paused ? 'paused' : 'lost');
    retryAt = Date.now() + (paused ? 3_000 : RETRY_AFTER_MS);
    setSource({ glasses: false, needsUpdate: message(e).includes('glasses-app-update') });
    return undefined;
  }
}

export function stopGlasses() {
  retryAt = 0;
  Glasses?.stop().catch(() => {});
}

async function resolveStatus(state: RegistrationState): Promise<GlassesStatus> {
  if (state === 'registering') return 'registering';
  if (state !== 'registered' || !Glasses) return 'unregistered';
  if ((await Glasses.getCameraPermission()) !== 'granted') return 'needsCamera';
  return (await Glasses.needsAppUpdate()) ? 'needsUpdate' : 'ready';
}

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
