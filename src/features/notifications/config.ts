/**
 * @file config.ts
 * @description Android channel metadata, generic notification copy, and preference filtering rules.
 * @author Gurkirat Singh
 * @license MIT
 */

import type {
  NotificationEvent,
  NotificationPreferences,
} from "@/features/domain/contracts";

export const NOTIFICATION_CHANNEL = {
  id: "idea-processing",
  name: "Idea processing",
  description:
    "Generic completion and failure alerts for background idea processing.",
} as const;

export const NOTIFICATION_DATA_KEYS = {
  captureId: "captureId",
  eventType: "eventType",
} as const;

/** Returns generic copy that never reveals user content on the lock screen. */
export function notificationCopy(event: NotificationEvent) {
  return event.type === "processing-complete"
    ? {
        title: "Your idea is ready",
        body: "Open Hmmmidea to review the report.",
      }
    : {
        title: "An idea needs attention",
        body: "Open Hmmmidea to retry processing.",
      };
}

/** Reports whether a queued or presented app notification still matches current preferences. */
export function notificationIsEnabled(
  eventType: unknown,
  preferences: NotificationPreferences,
) {
  if (!preferences.enabled) return false;
  if (eventType === "processing-complete") return preferences.reportReady;
  if (eventType === "processing-failed") return preferences.processingFailed;
  return false;
}

/** Reads a safe capture id from notification response data. */
export function notificationCaptureId(data: Record<string, unknown>) {
  const value = data[NOTIFICATION_DATA_KEYS.captureId];
  return typeof value === "string" && value.length > 0 ? value : null;
}
