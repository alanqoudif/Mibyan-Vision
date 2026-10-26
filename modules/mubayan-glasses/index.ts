import { NativeModule, requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

/**
 * Ray-Ban Meta camera access through the Meta Wearables Device Access Toolkit, plus the
 * other iOS-only bits the app needs (Siri shortcuts, on-device text recognition).
 * Only present in a development/production build on iOS; `null` in Expo Go and on web,
 * where callers fall back to the phone camera.
 */
export type RegistrationState = 'unavailable' | 'available' | 'registering' | 'registered';
export type PermissionStatus = 'granted' | 'denied';

type Events = {
  onRegistrationChange(event: { state: RegistrationState }): void;
  /** A Siri / Shortcuts / Action button intent ran; read it with `takePendingShortcut`. */
  onShortcut(event: Record<string, never>): void;
  /** Obstacle sensor readings, a few a second. */
  onObstacle(event: ObstacleReading): void;
  /** Realtime live mode (Gemini Live). */
  onLiveEvent(event: LiveEvent): void;
};

export type ObstacleReading = {
  /** 0 clear, 1 near, 2 close, 3 very close. */
  level: 0 | 1 | 2 | 3;
  side: 'left' | 'center' | 'right';
  /** What's in the way ahead, spoken name ("كرسي"), or '' when it isn't recognized. */
  label: string;
  /** Raw left / center / right closeness, for tuning `levels`. */
  values: [number, number, number];
};

export type LiveEvent =
  | { type: 'state'; state: 'connecting' | 'live' | 'reconnecting' | 'stopped' }
  | { type: 'user' | 'model'; text: string }
  | { type: 'speaking'; speaking: boolean }
  | { type: 'error'; message: string };

declare class MubayanGlassesModule extends NativeModule<Events> {
  getRegistrationState(): Promise<RegistrationState>;
  /** Opens Meta AI so the user can approve the app. Watch `onRegistrationChange` for the result. */
  register(): Promise<void>;
  /** True after a session failed because the toolkit app on the glasses is out of date. */
  needsAppUpdate(): Promise<boolean>;
  /** Opens Meta AI on the update screen for the toolkit app on the glasses. */
  openAppUpdate(): Promise<void>;
  getCameraPermission(): Promise<PermissionStatus>;
  /** Opens Meta AI if needed and resolves once the user comes back. */
  requestCameraPermission(): Promise<PermissionStatus>;
  /** JPEG from the glasses camera, as a `file://` URI. Keeps the stream warm for the next call. */
  capturePhoto(): Promise<string>;
  /** The latest frame of the glasses' video as a `file://` JPEG. Fast, at video resolution. */
  captureFrame(): Promise<string>;
  /**
   * Starts realtime live mode: the mic and one frame a second go to Gemini Live, and its
   * voice plays straight back. `endpoint` is the `mata-live` function that hands out tokens.
   */
  liveStart(endpoint: string, apiKey: string, lang: string, directions: string): Promise<void>;
  /**
   * Starts the parking-sensor style warnings on the glasses video (on-device depth, beeps
   * that speed up, a haptic and a spoken direction). `levels`: closeness values for near,
   * close and very close, ascending.
   */
  obstacleStart(levels: number[], lang: string): Promise<void>;
  obstacleStop(): Promise<void>;
  /** Has Gemini say an alert (spotted by the frame-by-frame look) in its voice, word for word. */
  liveSay(text: string): Promise<void>;
  liveStop(): Promise<void>;
  livePause(paused: boolean): Promise<void>;
  /** A phone-camera frame (base64 JPEG) for when the glasses aren't sending video. */
  liveSendFrame(base64: string): Promise<void>;
  /** Closes the camera stream and the connection to the glasses. */
  stop(): Promise<void>;
  /** On-device text recognition of a `file://` image; lines joined with newlines. */
  recognizeText(uri: string, languages: string[]): Promise<string>;
  /** The route the last shortcut asked for (e.g. `/live`), or null. Reading it clears it. */
  takePendingShortcut(): string | null;
}

export const Glasses = requireOptionalNativeModule<MubayanGlassesModule>('MubayanGlasses');

/** The glasses' live video, once a capture has started the camera stream. */
export const GlassesPreview: ComponentType<ViewProps> | null = Glasses ? requireNativeView('MubayanGlasses') : null;
