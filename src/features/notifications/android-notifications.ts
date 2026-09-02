/**
 * @file android-notifications.ts
 * @description Android notification adapter for generic completion alerts and deep-link responses.
 * @author Gurkirat Singh
 * @license MIT
 */

import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState, Platform } from "react-native";

import type {
  NotificationEvent,
  NotificationPort,
  NotificationPreferences,
  RecordingPermission,
} from "@/features/domain/contracts";

import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_DATA_KEYS,
  notificationCaptureId,
  notificationCopy,
  notificationIsEnabled,
} from "./config";
import { publishForegroundFeedback } from "./foreground-feedback";

type NotificationRouteHandler = (captureId: string) => void;
type NotificationsModule = typeof import("expo-notifications");

/** Keeps Expo Go from importing an unavailable Android notification module. */
function canUseSystemNotifications() {
  return (
    Platform.OS === "android" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

/** Loads the native notification API only inside an Android development or production build. */
async function loadNotifications(): Promise<NotificationsModule | null> {
  return canUseSystemNotifications() ? import("expo-notifications") : null;
}

/** Converts Expo permission status into the app's platform-neutral permission value. */
function permissionStatus(status: string): RecordingPermission | "provisional" {
  if (status === "granted") return "granted";
  if (status === "undetermined") return "undetermined";
  if (status === "provisional") return "provisional";
  return "denied";
}

/** Creates the one Android channel used for generic processing outcomes. */
async function ensureChannel(notifications: NotificationsModule) {
  await notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL.id, {
    name: NOTIFICATION_CHANNEL.name,
    description: NOTIFICATION_CHANNEL.description,
    importance: notifications.AndroidImportance.DEFAULT,
  });
}

/** Schedules system alerts in the background and publishes in-app feedback in the foreground. */
export const androidNotificationPort: NotificationPort = {
  async getPermission() {
    const notifications = await loadNotifications();
    if (!notifications) return "denied";
    return permissionStatus((await notifications.getPermissionsAsync()).status);
  },

  async requestPermission() {
    const notifications = await loadNotifications();
    if (!notifications) return "denied";
    await ensureChannel(notifications);
    return permissionStatus(
      (await notifications.requestPermissionsAsync()).status,
    );
  },

  async schedule(notificationId: string, event: NotificationEvent) {
    if (AppState.currentState === "active") {
      publishForegroundFeedback(event);
      return;
    }
    const notifications = await loadNotifications();
    if (!notifications) return;
    await ensureChannel(notifications);
    await notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        ...notificationCopy(event),
        data: {
          [NOTIFICATION_DATA_KEYS.captureId]: event.captureId,
          [NOTIFICATION_DATA_KEYS.eventType]: event.type,
        },
      },
      trigger: null,
    });
  },

  async cancel(notificationId: string) {
    const notifications = await loadNotifications();
    if (!notifications) return;
    await Promise.allSettled([
      notifications.cancelScheduledNotificationAsync(notificationId),
      notifications.dismissNotificationAsync(notificationId),
    ]);
  },
};

/** Removes scheduled and visible alerts disabled by the current preference set. */
export async function cancelPendingGenericNotifications(
  preferences: NotificationPreferences,
) {
  const notifications = await loadNotifications();
  if (!notifications) return;
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const presented = await notifications.getPresentedNotificationsAsync();
  await Promise.all([
    ...scheduled
      .filter(
        ({ content }) =>
          !notificationIsEnabled(
            content.data?.[NOTIFICATION_DATA_KEYS.eventType],
            preferences,
          ),
      )
      .map(({ identifier }) =>
        notifications.cancelScheduledNotificationAsync(identifier),
      ),
    ...presented
      .filter(
        ({ request }) =>
          !notificationIsEnabled(
            request.content.data?.[NOTIFICATION_DATA_KEYS.eventType],
            preferences,
          ),
      )
      .map(({ request }) =>
        notifications.dismissNotificationAsync(request.identifier),
      ),
  ]);
}

/** Registers notification taps and forwards valid capture ids to Expo Router. */
export function registerNotificationResponseHandler(
  handler: NotificationRouteHandler,
) {
  let active = true;
  let remove: () => void = () => undefined;
  void loadNotifications()
    .then(async (notifications) => {
      if (!active || !notifications) return;
      const open = (data: Record<string, unknown>) => {
        const captureId = notificationCaptureId(data);
        if (captureId) handler(captureId);
      };
      const subscription =
        notifications.addNotificationResponseReceivedListener((response) => {
          open(response.notification.request.content.data);
        });
      remove = () => subscription.remove();
      const previous = await notifications.getLastNotificationResponseAsync();
      if (active && previous) open(previous.notification.request.content.data);
    })
    .catch(() => undefined);
  return () => {
    active = false;
    remove();
  };
}
