import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { Glasses } from '../../modules/mubayan-glasses';

// A helper request should show even when the helper has the app open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Screens opened from outside the app:
 * - Siri / Shortcuts / the Action button ("Mubayan, what's in front of me"), see
 *   plugins/with-shortcuts.js. Works from a cold start and while the app is in the background.
 * - A trusted contact's "help me see" notification, which carries the screen to open.
 * Whatever is open gets closed first, so a shortcut never stacks on top of another session.
 */
export function useExternalRoutes() {
  const router = useRouter();
  const ready = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!ready) return;
    const go = (route: string | null | undefined) => {
      if (!route?.startsWith('/')) return;
      if (router.canDismiss()) router.dismissAll();
      router.push(route as Href);
    };

    const fromShortcut = () => go(Glasses?.takePendingShortcut());
    fromShortcut();
    const shortcut = Glasses?.addListener('onShortcut', fromShortcut);

    const fromNotification = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      Notifications.clearLastNotificationResponse();
      go(r.notification.request.content.data?.url as string | undefined);
    };
    fromNotification(Notifications.getLastNotificationResponse());
    const tapped = Notifications.addNotificationResponseReceivedListener(fromNotification);

    return () => {
      shortcut?.remove();
      tapped.remove();
    };
  }, [ready, router]);
}
