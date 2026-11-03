import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Says a status change out loud for screen-reader users.
 *
 * Android: pair this with `accessibilityLiveRegion` on the visible text; TalkBack reads that itself.
 * iOS has no live regions, so VoiceOver gets an explicit announcement here.
 *
 * Use it for states that are otherwise silent (an error that is only written on screen).
 * Don't use it while the microphone is open: VoiceOver's own speech would be recorded as the
 * user's question. Listening and thinking already have earcons for that reason.
 */
export function useAnnounce(message: string | null | undefined) {
  useEffect(() => {
    if (!message || Platform.OS !== 'ios') return;
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on && !cancelled) AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    });
    return () => {
      cancelled = true;
    };
  }, [message]);
}
