import { NativeModule, requireOptionalNativeModule } from 'expo';

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
};

declare class MubayanGlassesModule extends NativeModule<Events> {
  getRegistrationState(): Promise<RegistrationState>;
  /** Opens Meta AI so the user can approve the app. Watch `onRegistrationChange` for the result. */
  register(): Promise<void>;
  getCameraPermission(): Promise<PermissionStatus>;
  /** Opens Meta AI if needed and resolves once the user comes back. */
  requestCameraPermission(): Promise<PermissionStatus>;
  /** JPEG from the glasses camera, as a `file://` URI. Keeps the stream warm for the next call. */
  capturePhoto(): Promise<string>;
  /** Closes the camera stream and the connection to the glasses. */
  stop(): Promise<void>;
  /** On-device text recognition of a `file://` image; lines joined with newlines. */
  recognizeText(uri: string, languages: string[]): Promise<string>;
  /** The route the last shortcut asked for (e.g. `/live`), or null. Reading it clears it. */
  takePendingShortcut(): string | null;
}

export const Glasses = requireOptionalNativeModule<MubayanGlassesModule>('MubayanGlasses');
