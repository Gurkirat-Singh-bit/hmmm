import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import type { NotificationEvent, NotificationPort, NotificationPreferences, RecordingPermission } from '@/features/domain/contracts';
import { readPreferences } from '@/features/onboarding/storage';

import { publishForegroundFeedback } from './foreground-feedback';

const channelId = 'hmmmidea-processing';
const captureIdPattern = /^capture-[A-Za-z0-9_-]+$/u;
const scheduledNotificationIds = new Set<string>();

type NotificationRouteHandler = (captureId: string) => void;

let routeHandler: NotificationRouteHandler | null = null;

function eventEnabled(preferences: NotificationPreferences, event: NotificationEvent) {
  return preferences.enabled && (event.type === 'processing-complete' ? preferences.reportReady : preferences.processingFailed);
}

function captureIdFromData(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const value = (data as { captureId?: unknown }).captureId;
  return typeof value === 'string' && captureIdPattern.test(value) ? value : null;
}

function genericNotificationCaptureId(identifier: unknown) {
  if (typeof identifier !== 'string') return null;
  const match = /^report:(capture-[A-Za-z0-9_-]+):\d+$/u.exec(identifier)
    ?? /^failed:(capture-[A-Za-z0-9_-]+):(?:transcribe-capture|generate-report):\d+$/u.exec(identifier);
  return match?.[1] ?? null;
}

function genericNotificationId(identifier: unknown) {
  return genericNotificationCaptureId(identifier) !== null;
}

function responseCaptureId(response: Notifications.NotificationResponse) {
  return captureIdFromData(response.notification.request.content.data);
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  if (!genericNotificationId(response.notification.request.identifier)) return;
  const captureId = responseCaptureId(response);
  if (!captureId || genericNotificationCaptureId(response.notification.request.identifier) !== captureId) return;
  scheduledNotificationIds.delete(response.notification.request.identifier);
  if (!routeHandler) return;
  try {
    routeHandler(captureId);
    Notifications.clearLastNotificationResponse();
  } catch {
    // Keep the native response available for a later ready navigation tree.
  }
}

/** Binds notification taps to the guarded internal idea route. */
export function registerNotificationResponseHandler(handler: NotificationRouteHandler) {
  if (Platform.OS !== 'android') return () => undefined;
  routeHandler = handler;
  const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) handleNotificationResponse(last);
  } catch {
    // A missing native response is equivalent to no pending route.
  }
  return () => {
    subscription.remove();
    if (routeHandler === handler) routeHandler = null;
  };
}

function permission(status: Notifications.NotificationPermissionsStatus): RecordingPermission | 'provisional' {
  if (status.granted) return 'granted';
  if (status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'provisional';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Background processing',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

async function scheduledGenericIds() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled
      .filter((notification) => genericNotificationId(notification.identifier))
      .map((notification) => notification.identifier);
  } catch {
    return [] as string[];
  }
}

/** Cancels only Hmmmidea's generic processing alerts, including after relaunch. */
export async function cancelPendingGenericNotifications(preferences?: NotificationPreferences) {
  if (Platform.OS !== 'android') return;
  const ids = new Set([...scheduledNotificationIds, ...(await scheduledGenericIds())]);
  const allow = preferences ?? { enabled: false, reportReady: false, processingFailed: false };
  for (const id of ids) {
    const isReport = id.startsWith('report:');
    if (allow.enabled && (isReport ? allow.reportReady : allow.processingFailed)) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      scheduledNotificationIds.delete(id);
    } catch {
      // Keep the ID tracked so the next foreground or preference change retries.
    }
  }
}

async function scheduleBackgroundCompletion(notificationId: string, event: NotificationEvent) {
  if (Platform.OS !== 'android') return;
  if (genericNotificationCaptureId(notificationId) !== event.captureId) return;
  const preferences = await readPreferences();
  if (!eventEnabled(preferences.notifications, event)) return;
  const initialAppState = AppState.currentState;
  if (initialAppState === 'active') {
    publishForegroundFeedback(event);
    return;
  }
  const currentPermission = permission(await Notifications.getPermissionsAsync());
  if (currentPermission !== 'granted' && currentPermission !== 'provisional') return;
  await ensureAndroidChannel();
  // Preference and foreground state can change while permission/channel calls await.
  const latest = await readPreferences();
  if (!eventEnabled(latest.notifications, event)) return;
  if (AppState.currentState === 'active') {
    publishForegroundFeedback(event);
    return;
  }
  scheduledNotificationIds.add(notificationId);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: 'Hmmmidea',
        body: event.type === 'processing-complete' ? 'Background processing finished.' : 'Background processing needs attention.',
        sound: false,
        data: { captureId: event.captureId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId },
    });
  } catch (error) {
    scheduledNotificationIds.delete(notificationId);
    throw error;
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') void cancelPendingGenericNotifications();
});

/** Android-only notifications carry no idea title, transcript, source audio, or provider data. */
export const androidNotificationPort: NotificationPort = {
  async getPermission() {
    if (Platform.OS !== 'android') return 'denied';
    return permission(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    if (Platform.OS !== 'android') return 'denied';
    return permission(await Notifications.requestPermissionsAsync());
  },

  schedule: scheduleBackgroundCompletion,

  async cancel(notificationId) {
    if (Platform.OS === 'android') {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      scheduledNotificationIds.delete(notificationId);
    }
  },
};
