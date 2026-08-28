import { AppState, Platform } from 'react-native';

import type { NotificationEvent, NotificationPort, NotificationPreferences } from '@/features/domain/contracts';

import { publishForegroundFeedback } from './foreground-feedback';

type NotificationRouteHandler = (captureId: string) => void;

/**
 * System notifications are deliberately disabled for this release.
 * Expo Go cannot load Android notification APIs, so importing that module at
 * startup made the whole app fail before onboarding. Foreground job feedback
 * remains available and contains no idea content.
 */
export const androidNotificationPort: NotificationPort = {
  async getPermission() {
    return 'denied';
  },

  async requestPermission() {
    return 'denied';
  },

  async schedule(_notificationId: string, event: NotificationEvent) {
    if (Platform.OS === 'android' && AppState.currentState === 'active') {
      publishForegroundFeedback(event);
    }
  },

  async cancel() {},
};

export async function cancelPendingGenericNotifications(_preferences?: NotificationPreferences) {}

export function registerNotificationResponseHandler(_handler: NotificationRouteHandler) {
  return () => undefined;
}
