import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * Ray-Ban Meta camera access through the Meta Wearables Device Access Toolkit.
 * Only present in a development/production build on iOS; `null` in Expo Go and on web,
 * where callers fall back to the phone camera.
 */
export type RegistrationState = 'unavailable' | 'available' | 'registering' | 'registered';
export type PermissionStatus = 'granted' | 'denied';

type Events = {
  onRegistrationChange(event: { state: RegistrationState }): void;
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
}

export const Glasses = requireOptionalNativeModule<MubayanGlassesModule>('MubayanGlasses');
